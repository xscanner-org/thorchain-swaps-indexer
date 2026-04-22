import { getClient } from '@/database';
import { IndexedHash } from './indexed-hashes';

export async function store(
    indexedHash: Omit<IndexedHash, 'created_at'>,
    blocktime?: string,
): Promise<boolean> {
    const dbReadWrite = await getClient('rw');

    const cols = `protocol, hash, height, state, created_at`;
    const placeholders = `$1,$2,$3,$4${blocktime ? ',$5' : ''}`;
    const query = `INSERT INTO thorchain.indexed_hashes(${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`;
    await dbReadWrite.query(query, [
        indexedHash.protocol,
        indexedHash.hash,
        indexedHash.height,
        indexedHash.state,
        blocktime,
    ]);

    return true;
}

export async function get({
    hashes,
    protocol,
}: {
    hashes: string[];
    protocol: string;
}): Promise<IndexedHash[]> {
    const dbReadWrite = await getClient('r');
    const protocolClause = `protocol = '${protocol}'`;
    const formatString = (str: string) => `'${str}'`;

    let hashClause = '';
    if (hashes.length > 0) {
        hashClause =
            hashes.length === 1
                ? `hash = ${formatString(hashes[0])} AND`
                : `hash IN (${hashes.map((h) => formatString(h)).join(',')}) AND`;
    }

    const where = `WHERE ${hashClause} ${protocolClause}`;
    const query = `SELECT * FROM thorchain.indexed_hashes ${where}`;
    const response = await dbReadWrite.query<IndexedHash>(query);
    return response.rows;
}

export async function getHavingState({
    state,
    limit,
    orderByHeight,
}: {
    state: string;
    limit: number;
    orderByHeight?: 'ASC' | 'DESC';
}): Promise<IndexedHash[]> {
    const dbReadWrite = await getClient('r');
    const orderClause = orderByHeight ? ` ORDER BY height ${orderByHeight}` : '';
    const query = `SELECT * FROM thorchain.indexed_hashes WHERE state = $1${orderClause} LIMIT $2`;
    const response = await dbReadWrite.query<IndexedHash>(query, [state, limit]);
    return response.rows;
}

export async function getHavingStates({
    states,
    limit,
}: {
    states: string[];
    limit: number;
}): Promise<IndexedHash[]> {
    const dbReadWrite = await getClient('r');
    const _states = states.map((s) => `'${s}'`).join(',');
    const query = `SELECT * FROM thorchain.indexed_hashes WHERE state IN (${_states}) LIMIT $1`;
    const response = await dbReadWrite.query<IndexedHash>(query, [limit]);
    return response.rows;
}

export async function updateState(hash: string, state: string): Promise<boolean> {
    const dbReadWrite = await getClient('rw');
    const query = `UPDATE thorchain.indexed_hashes SET state = $1 WHERE hash = $2`;
    await dbReadWrite.query(query, [state, hash]);
    return true;
}
