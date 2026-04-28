import winston, { createLogger } from 'winston';
import {
    getHavingState,
    updateState,
} from '@/lib/thorchain/transactions/indexed-hashes/repository';
import { getTransactionStages } from '@/lib/thorchain/transactions/tx-stages/repostiory';
import { getClient } from '@/database';
import { get as getTransactionStageFromNode } from '@/api/thorchain/tx-stages';
import { getStateMachineConfig } from '@/lib/indexer/repository';
import { ArchiveSwapResult } from '@/lib/types';

const errorLogger = createLogger({
    format: winston.format.json(),
    defaultMeta: { service: 'ARCHIVE_FAILED' },
    transports: [new winston.transports.Console()],
});

export default async function action() {
    const db = getClient()

    try {
        const state = ArchiveSwapResult.ArchiveFailed
        const config = await getStateMachineConfig('thorchain', state);

        let batchSize = 250;
        if (config && config.batch_size) {
            batchSize = config.batch_size;
        }

        const failedTxs = await getHavingState({
            state: state,
            limit: batchSize
        })

        const hashes = failedTxs.map(tx => tx.hash)
        const stagesFromDb = await getTransactionStages(hashes, db)
        const stagesSet = new Set(stagesFromDb.map(st => st.hash));

        for (const failedTx of failedTxs) {
            const hash = failedTx.hash;

            if (stagesSet.has(hash)) {
                await updateState(hash, 'REINDEX_DATA')
            } else {
                const stageFromNode = await getTransactionStageFromNode(hash)
                if ('inbound_observed' in stageFromNode) {
                    await updateState(hash, 'STORED_INDEXED_HASH')
                } else {
                    await updateState(hash, 'RETRY_FAILED')
                }
            }
        }

    } catch (error) {
        const message = `ARCHIVE_FAILED error: ${JSON.stringify(error)}`
        errorLogger.error(message)
    }
}
