import { config } from 'dotenv';
config();

import winston, { createLogger } from 'winston';
import {
    getIndexedHeight,
    storeIndexedHeight,
    updateIndexedHeight,
} from './lib/indexer/repository';
import { scheduleJob } from 'node-schedule';
import { getLastBlockSafe } from './lib/utils';
import { Mutex } from 'async-mutex';
import { indexHeight as indexHeightThorchain } from '@/lib/thorchain/catch-up';
import { indexHeight as indexHeightMayachain } from '@/lib/mayachain/catch-up';
import { onStartup } from './lib/indexer/indexer-runs';

let processId: string | undefined;

const logger = createLogger({
    format: winston.format.json(),
    defaultMeta: { service: 'indexer-catch-up' },
    transports: [new winston.transports.Console()],
});

const errorLogger = createLogger({
    format: winston.format.json(),
    defaultMeta: { service: 'indexer-catch-up-job-errors' },
    transports: [
        new winston.transports.File({
            filename: 'indexer-catch-up-job-errors.log',
        }),
    ],
});

const locks = {
    thorchain: new Mutex(),
    mayachain: new Mutex(),
};

async function catchUp(protocol: 'thorchain' | 'mayachain'): Promise<void> {
    const lock = locks[protocol];

    if (lock.isLocked()) {
        logger.info('catch-up job already running... job terminated');
        return;
    }

    await lock.acquire();
    logger.info('catch-up job started');
    const currentHeight = await getLastBlockSafe(protocol);
    if (currentHeight === null) {
        lock.release();
        return;
    }

    logger.info('catch-up current height: ' + currentHeight);
    let indexedHeight = await getIndexedHeight({ protocol }, protocol);
    if (!indexedHeight) {
        logger.info(`catch-up storing height to start from ` + currentHeight);
        await storeIndexedHeight({ height: currentHeight, protocol }, protocol);
    }

    indexedHeight = await getIndexedHeight({ protocol }, protocol);

    if (!indexedHeight) {
        logger.info(`catch-up height not found ` + currentHeight);
        lock.release();
        return;
    }

    logger.info('catch-up indexed height: ' + indexedHeight.height);
    const heightNum = Number(indexedHeight.height);

    if (heightNum >= currentHeight) {
        lock.release();
        return;
    }

    const difference = currentHeight - heightNum;
    for (let index = 1; index < difference; index++) {
        const height = index + heightNum;
        logger.info('catch-up processing height: ' + height);

        if (protocol === 'thorchain') {
            const state = await indexHeightThorchain(height);
            if (state.halt) {
                lock.release();
                return;
            }
            await updateIndexedHeight({ protocol, height: height }, protocol);
        } else if (protocol === 'mayachain') {
            const state = await indexHeightMayachain(height);
            if (state.halt) {
                lock.release();
                return;
            }
            await updateIndexedHeight({ protocol, height: height }, protocol);
        }
    }

    lock.release();
}

scheduleJob('catch-up', '*/1 * * * *', async () => {
    const protocol: 'thorchain' | 'mayachain' = 'mayachain';
    try {
        await catchUp(protocol);
    } catch (error: any) {
        const msg = `${processId} ${protocol}` + ' catch-up failure: ' + error.message;
        errorLogger.error(msg);
    } finally {
        locks[protocol].release();
    }
});

scheduleJob('catch-up', '*/1 * * * *', async () => {
    const protocol: 'thorchain' | 'mayachain' = 'thorchain';
    try {
        await catchUp(protocol);
    } catch (error: any) {
        const msg = `${processId} ${protocol}` + ' catch-up failure: ' + error.message;
        errorLogger.error(msg);
    } finally {
        locks[protocol].release();
    }
});

async function start() {
    const record = await onStartup('catch-up');
    processId = record.id;
    return `Process ID: ${processId.toString()}`;
}

start().then(console.log).catch(console.error);
