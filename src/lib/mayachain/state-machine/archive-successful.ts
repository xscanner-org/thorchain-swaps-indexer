import winston, { createLogger } from 'winston';
import {
    getHavingState,
    updateState,
} from '@/lib/mayachain/transactions/indexed-hashes/repository';
import { getTransactionStage as getTransactionStageFromDb } from '@/lib/mayachain/transactions/tx-stages/repostiory';
import { get as getTransactionStageFromNode } from '@/api/mayachain/tx-stages';
import { getClient } from '@/database';
import { stagesChanged } from './utils';
import { getStateMachineConfig } from '@/lib/indexer/repository';

const errorLogger = createLogger({
    format: winston.format.json(),
    defaultMeta: { service: 'ARCHIVE_SUCCESSFUL' },
    transports: [new winston.transports.Console()],
});

export default async function action() {
    const config = await getStateMachineConfig('mayachain', 'ARCHIVE_SUCCESSFUL');

    let batchSize = 100;
    if (config && config.batch_size) {
        batchSize = config.batch_size;
    }

    const list = await getHavingState({
        state: 'ARCHIVE_SUCCESSFUL',
        limit: batchSize,
    });

    for (const item of list) {
        try {
            const stage = await getTransactionStageFromDb(item.hash, getClient());

            if (stage) {
                const nodeStage = await getTransactionStageFromNode(item.hash);
                if ('code' in nodeStage) return;

                const changed = stagesChanged(stage, nodeStage);
                if (changed) {
                    await updateState(item.hash, 'REINDEX_DATA');
                    continue;
                }

                const isSwapComplete =
                    Boolean(nodeStage.swap_finalised) && nodeStage.swap_finalised!.completed;

                const isOutboundComplete = nodeStage.outbound_signed
                    ? Boolean(nodeStage.outbound_signed.completed)
                    : true;

                if (isSwapComplete && isOutboundComplete) {
                    await updateState(item.hash, 'COMPLETE');
                    continue;
                }
            }
        } catch (error: any) {
            const message = error.message;
            errorLogger.error(`${item.hash} error: ${message}`);
            //   await updateState(item.hash, ArchiveSwapResult.ArchiveFailed);
        }
    }
}
