import { config } from 'dotenv';
config();

import { scheduleJob } from 'node-schedule';
import { Mutex } from 'async-mutex';

import storedIndexedHashThorchain from '@/lib/thorchain/state-machine/stored-indexed-hash';
import archiveSuccessfulThorchain from '@/lib/thorchain/state-machine/archive-successful';
import reIndexDataThorchain from '@/lib/thorchain/state-machine/reindex-data';

import storedIndexedHashMayachain from '@/lib/mayachain/state-machine/stored-indexed-hash';
import archiveSuccessfulMayachain from '@/lib/mayachain/state-machine/archive-successful';
import reIndexDataMayachain from '@/lib/mayachain/state-machine/reindex-data';

import { IndexedHashState } from './lib/types';
import { ArchiveSwapResult } from './lib/types';
import { onStartup } from './lib/indexer/indexer-runs';

let processId;

async function transition(
    protocol: 'thorchain' | 'mayachain',
    lock: Mutex,
    state: IndexedHashState,
): Promise<void> {
    if (lock.isLocked()) return;
    await lock.acquire();

    try {
        switch (state) {
            case 'STORED_INDEXED_HASH': {
                const fn =
                    protocol === 'thorchain'
                        ? storedIndexedHashThorchain
                        : storedIndexedHashMayachain;
                await fn();
                break;
            }
            case 'REINDEX_DATA': {
                const fn = protocol === 'thorchain' ? reIndexDataThorchain : reIndexDataMayachain;
                await fn();
                break;
            }
            case 'ARCHIVE_SUCCESSFUL': {
                const fn =
                    protocol === 'thorchain'
                        ? archiveSuccessfulThorchain
                        : archiveSuccessfulMayachain;
                await fn();
                break;
            }
            case ArchiveSwapResult.ErrorStages: {
                console.log(state);
                break;
            }
            case ArchiveSwapResult.ErrorDetails: {
                console.log(state);
                break;
            }
            case ArchiveSwapResult.ArchiveSuccessful: {
                console.log(state);
                break;
            }
            case ArchiveSwapResult.Skipped: {
                console.log(state);
                break;
            }
            case ArchiveSwapResult.ArchiveFailed: {
                console.log(state);
                break;
            }
        }
    } catch {
        console.log(`Error in state transition for ${state}`);
    }

    lock.release();
}

const scheduleForAll = `*/10 * * * * *`;

const mayaSihLock = new Mutex();
scheduleJob('STORED_INDEXED_HASH', scheduleForAll, async () =>
    transition('mayachain', mayaSihLock, 'STORED_INDEXED_HASH'),
);
const mayaRILock = new Mutex();
scheduleJob('REINDEX_DATA', scheduleForAll, async () =>
    transition('mayachain', mayaRILock, 'REINDEX_DATA'),
);
const mayaAsLock = new Mutex();
scheduleJob('ARCHIVE_SUCCESSFUL', scheduleForAll, async () =>
    transition('mayachain', mayaAsLock, 'ARCHIVE_SUCCESSFUL'),
);

const thorSihLock = new Mutex();
scheduleJob('STORED_INDEXED_HASH', scheduleForAll, async () =>
    transition('thorchain', thorSihLock, 'STORED_INDEXED_HASH'),
);
const thorRILock = new Mutex();
scheduleJob('REINDEX_DATA', scheduleForAll, async () =>
    transition('thorchain', thorRILock, 'REINDEX_DATA'),
);
const thorAsLock = new Mutex();
scheduleJob('ARCHIVE_SUCCESSFUL', scheduleForAll, async () =>
    transition('thorchain', thorAsLock, 'ARCHIVE_SUCCESSFUL'),
);

async function start() {
    const record = await onStartup('state-machine');
    processId = record.id
    return `Process ID: ${record.id.toString()}`
}

start().then(console.log).catch(console.error);