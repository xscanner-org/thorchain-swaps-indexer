import winston, { createLogger } from 'winston';
import { getHavingState } from '@/lib/mayachain/transactions/indexed-hashes/repository';
import { updateArchivedSwap } from '../transactions/update-archived-swap';
import { getStateMachineConfig } from '@/lib/indexer/repository';

const errorLogger = createLogger({
    format: winston.format.json(),
    defaultMeta: { service: 'REINDEX_DATA' },
    transports: [new winston.transports.Console()],
});

export default async function action() {
    const config = await getStateMachineConfig('mayachain', 'REINDEX_DATA');

    let batchSize = 100;
    if (config && config.batch_size) {
        batchSize = config.batch_size;
    }

    const list = await getHavingState({
        state: 'REINDEX_DATA',
        limit: batchSize,
    });

    for (const item of list) {
        try {
            await updateArchivedSwap(item.hash);
        } catch (error: any) {
            const message = error.message;
            errorLogger.error(`${item.hash} error: ${message}`);
            //   await updateState(item.hash, ArchiveSwapResult.ArchiveFailed);
        }
    }
}
