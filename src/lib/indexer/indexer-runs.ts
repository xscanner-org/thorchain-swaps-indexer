import { getClient } from "@/database";

export interface IndexerRun {
    id: string;
    start_time: string;
    process_name: string;
}

export async function onStartup(processName: string): Promise<{ id: string }> {
    const db = getClient('rw');
    const query = `INSERT INTO swaps_indexer.indexer_runs(start_time, process_name) VALUES(now(), $1) RETURNING id`;
    const reponse = await db.query<{ id: string }>(query, [processName])
    if (reponse.rows[0]) {
        return reponse.rows[0];
    }

    throw new Error('Could not create a start up entry');
}