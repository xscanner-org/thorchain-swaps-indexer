import {
    getHavingState,
    updateState,
} from '@/lib/thorchain/transactions/indexed-hashes/repository';
import { archiveSwap } from '@/lib/thorchain/transactions/archive-swap';
import winston, { createLogger } from 'winston';
import { ArchiveSwapResult } from '@/lib/types';
import { getStateMachineConfig } from '@/lib/indexer/repository';

const errorLogger = createLogger({
    format: winston.format.json(),
    defaultMeta: { service: 'STORED_INDEXED_HASH' },
    transports: [new winston.transports.Console()],
});

export default async function action() {
    const config = await getStateMachineConfig('thorchain', 'STORED_INDEXED_HASH');

    let batchSize = 100;
    if (config && config.batch_size) {
        batchSize = config.batch_size;
    }

    const list = await getHavingState({
        state: 'STORED_INDEXED_HASH',
        limit: batchSize,
    });

    for (const item of list) {
        try {
            const result = await archiveSwap(item.hash);
            await updateState(item.hash, result);
            console.log(`tx-updated-state: `, result);
        } catch (error: any) {
            const message = error.message;
            errorLogger.error(`${item.hash} error: ${message}`);
            await updateState(item.hash, ArchiveSwapResult.ArchiveFailed);
        }
    }
}
