import { getClient } from '@/database';
import { Tx, TxDetails, get as getTxDetails } from '@/api/thorchain/tx-details';
import { Stages, get as getTxStages } from '@/api/thorchain/tx-stages';

import { storeTransactionCoins } from './tx-coins/repository';
import { storeTransactionOutHash } from './out-hashes/repository';
import { storeTransactionOutTx } from './out-txs/repository';
import { storeTransactionOutTxCoin } from './out-tx-coins/repository';
import { storeActionMaxGas } from './action-max-gas/repository';
import { storeTransactionSigner } from './tx-signers/repository';
import { storeTransactionAction } from './tx-actions/repository';
import { storeTransactionStage } from './tx-stages/repostiory';
import { storeInnerTransaction } from './inner-txs/repository';
import { storeTransactionBaseInfo } from './tx-base-info/repository';
import { isSwapMemo, parseSwapMemo } from '@/lib/memo';
import { ArchiveSwapResult } from '@/lib/types';
import { getSwapQuote } from '@/api/thorchain/swap-quote';
import { storeSwapQuote } from '../swap-quote/repository';

async function processSwapQuote(hash: string, height: number, tx: Tx): Promise<void> {
    try {
        const isSwap = isSwapMemo(tx.tx.memo);
        if (isSwap && tx.tx.memo) {
            const memoData = parseSwapMemo('thorchain', hash, tx.tx.memo);
            if (memoData) {
                const affiliates = memoData.affiliates.map((i) => i.affiliate).join('/');
                const affiliateBpss = memoData.affiliates
                    .map((i) => i.fee_basis_points.toString())
                    .join('/');

                const swapQuote = await getSwapQuote({
                    height: height.toString(),
                    from_asset: tx.tx.coins[0].asset,
                    to_asset: memoData.parsed.asset,
                    amount: tx.tx.coins[0].amount,
                    destination: memoData.parsed.destination_address,
                    affiliate: affiliates,
                    affiliate_bps: affiliateBpss,
                });

                if (swapQuote && 'fees' in swapQuote) {
                    await storeSwapQuote(hash, swapQuote);
                }
            }
        }
    } catch (error: any) {
        console.error('process-swap-quote error: ' + error.message);
    }
}

export async function archiveSwap(swapHash: string): Promise<ArchiveSwapResult> {
    const db = getClient('rw');
    let stages = await getTxStages(swapHash);
    const details = await getTxDetails(swapHash);

    if ('message' in details && 'code' in details) return ArchiveSwapResult.ErrorDetails;
    const detail = details as TxDetails;

    if ('message' in stages && 'code' in stages) return ArchiveSwapResult.ErrorStages;
    stages = stages as Stages;

    const isSwap = isSwapMemo(detail.tx.tx.memo);
    if (!isSwap) return ArchiveSwapResult.Skipped;

    await storeTransactionStage(
        {
            protocol: 'thorchain',
            hash: swapHash,
            inbound_observed_final_count: stages.inbound_observed.final_count,
            inbound_observed_completed: stages.inbound_observed.completed,
            inbound_confirmation_counted_remaining_seconds:
                stages.inbound_confirmation_counted?.remaining_confirmation_seconds ?? null,
            inbound_confirmation_counted_completed:
                stages.inbound_confirmation_counted?.completed ?? null,
            inbound_finalised_completed: stages.inbound_finalised?.completed ?? null,
            swap_status_pending: stages.swap_status?.pending ?? null,
            swap_finalised_completed: stages.swap_finalised?.completed ?? null,
            streaming_interval: stages.swap_status?.streaming?.interval ?? 0,
            streaming_quantity: stages.swap_status?.streaming?.quantity ?? 0,
            streaming_count: stages.swap_status?.streaming?.count ?? 0,
            outbound_signed_scheduled_outbound_height:
                stages.outbound_signed?.scheduled_outbound_height ?? null,
            outbound_delay_remaining_delay_blocks:
                stages.outbound_delay?.remaining_delay_blocks ?? null,
            outbound_delay_remaining_delay_seconds:
                stages.outbound_delay?.remaining_delay_seconds ?? null,
            outbound_signed_completed: stages.outbound_signed?.completed ?? null,
        },
        db,
    );

    const baseId = await storeTransactionBaseInfo(db, {
        tx_id: detail.tx_id,
        consensus_height: detail.consensus_height,
        finalised_height: detail.finalised_height,
        updated_vault: detail.updated_vault ?? null,
        outbound_height: detail.outbound_height ?? null,
    });
    console.log('archive-swap stored base-id: ' + baseId);

    if (baseId) {
        if (detail.actions) {
            for (const action of detail.actions) {
                const actionId = await storeTransactionAction(db, {
                    tx_base_info_id: baseId,
                    chain: action.chain,
                    to_address: action.to_address,
                    coin_asset: action.coin.asset,
                    coin_amount: action.coin.amount,
                    memo: action.memo,
                    original_memo: action.original_memo,
                    gas_rate: action.gas_rate,
                    in_hash: action.in_hash,
                    clout_spent: action.clout_spent,
                    vault_pub_key: action.vault_pub_key ?? null,
                    vault_pub_key_eddsa: action.vault_pub_key_eddsa ?? null,
                });
                console.log('archive-swap stored action-id: ' + actionId);

                if (actionId) {
                    for (const gas of action.max_gas) {
                        await storeActionMaxGas(db, {
                            action_id: actionId,
                            asset: gas.asset,
                            amount: gas.amount,
                            decimals: gas.decimals,
                        });
                    }
                }
            }
        }

        if (detail.out_txs) {
            for (const outTx of detail.out_txs) {
                const outTxId = await storeTransactionOutTx(db, {
                    tx_base_info_id: baseId,
                    out_tx_id: outTx.id,
                    chain: outTx.chain,
                    from_address: outTx.from_address,
                    to_address: outTx.to_address,
                    memo: outTx.memo,
                });
                console.log('archive-swap stored out-tx id: ' + outTxId);

                if (outTxId) {
                    for (const coin of outTx.coins) {
                        await storeTransactionOutTxCoin(db, {
                            out_tx_id: outTxId,
                            coin_type: 'coin',
                            asset: coin.asset,
                            amount: coin.amount,
                        });
                    }

                    for (const gas of outTx.gas) {
                        await storeTransactionOutTxCoin(db, {
                            out_tx_id: outTxId,
                            coin_type: 'gas',
                            asset: gas.asset,
                            amount: gas.amount,
                        });
                    }
                }
            }
        }

        if (detail.txs.length > 0) {
            for (const tx of detail.txs) {
                const txId = await storeInnerTransaction(db, {
                    tx_base_info_id: baseId,
                    detail_id: tx.tx.id,
                    detail_chain: tx.tx.chain,
                    detail_from_address: tx.tx.from_address,
                    detail_to_address: tx.tx.to_address,
                    detail_memo: tx.tx.memo,
                    status: tx.status ?? null,
                    external_observed_height: tx.external_observed_height ?? null,
                    observed_pub_key: tx.observed_pub_key ?? null,
                    external_confirmation_delay_height:
                        tx.external_confirmation_delay_height ?? null,
                });
                console.log('archive-swap stored tx id: ' + txId);

                if (txId) {
                    if (Array.isArray(tx.out_hashes)) {
                        for (const outHash of tx.out_hashes) {
                            await storeTransactionOutHash(db, {
                                out_hash: outHash,
                                tx_id: txId,
                            });
                        }
                    }

                    for (const coin of tx.tx.coins) {
                        await storeTransactionCoins(db, {
                            coin_type: 'coin',
                            amount: coin.amount,
                            asset: coin.asset,
                            tx_id: txId,
                        });
                    }

                    if (tx.tx.gas && Array.isArray(tx.tx.gas)) {
                        for (const gas of tx.tx.gas) {
                            await storeTransactionCoins(db, {
                                coin_type: 'gas',
                                amount: gas.amount,
                                asset: gas.asset,
                                tx_id: txId,
                            });
                        }
                    }

                    if (tx.signers) {
                        for (const signer of tx.signers) {
                            await storeTransactionSigner(db, {
                                tx_id: txId,
                                signer,
                            });
                        }
                    }
                }
            }

            await processSwapQuote(swapHash, detail.consensus_height, detail.tx);
        }

        return ArchiveSwapResult.ArchiveSuccessful;
    }

    return ArchiveSwapResult.ArchiveFailed;
}
