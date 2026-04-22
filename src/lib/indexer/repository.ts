import { getClient } from '@/database';
import { IndexedHeight } from './indexed-height';
import { StateMachineConfig } from './state-machine-config';

export async function getIndexedHeight(
    {
        protocol,
    }: {
        protocol: string;
    },
    schema = 'thorchain',
): Promise<IndexedHeight | null> {
    const db = getClient('r');
    const query = `SELECT * FROM ${schema}.indexed_heights WHERE protocol = $1`;
    const response = await db.query<IndexedHeight>(query, [protocol]);
    return response.rows[0] ?? null;
}

export async function updateIndexedHeight(
    {
        protocol,
        height,
    }: {
        protocol: string;
        height: number;
    },
    schema = 'thorchain',
): Promise<boolean> {
    const db = getClient('rw');
    const query = `UPDATE ${schema}.indexed_heights SET height = $1 WHERE protocol = $2`;
    await db.query(query, [height, protocol]);
    return true;
}

export async function storeIndexedHeight(
    {
        protocol,
        height,
    }: {
        protocol: string;
        height: number;
    },
    schema = 'thorchain',
): Promise<IndexedHeight | null> {
    const db = getClient('rw');
    const query = `INSERT INTO ${schema}.indexed_heights (height, protocol) VALUES ($1, $2) ON CONFLICT DO NOTHING`;
    const response = await db.query<IndexedHeight>(query, [height, protocol]);
    return response.rows[0] ? response.rows[0] : null;
}

export async function getStateMachineConfig(
    protocol: string,
    state: string,
): Promise<StateMachineConfig | null> {
    const db = getClient('r');
    const query = `SELECT * FROM swaps_indexer.state_machine_config WHERE protocol = $1 AND state = $2`;
    const response = await db.query<StateMachineConfig>(query, [protocol, state]);
    return response.rows[0] ?? null;
}
