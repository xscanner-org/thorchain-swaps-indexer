import { Pool } from 'pg';
import { TransactionStage } from '@/lib/thorchain/transactions/types';

export async function storeTransactionStage(
    data: Omit<TransactionStage, 'created_at' | 'updated_at'>,
    db: Pool,
): Promise<boolean> {
    const cols = `protocol, hash, inbound_observed_final_count, inbound_observed_completed, inbound_confirmation_counted_remaining_seconds, inbound_confirmation_counted_completed, inbound_finalised_completed, swap_status_pending, swap_finalised_completed, streaming_interval, streaming_quantity, streaming_count, outbound_signed_scheduled_outbound_height, outbound_signed_completed, outbound_delay_remaining_delay_blocks, outbound_delay_remaining_delay_seconds`;
    const query = `INSERT INTO thorchain.transactions_stages (${cols}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT DO NOTHING;`;
    await db.query(query, [
        data.protocol,
        data.hash,
        data.inbound_observed_final_count,
        data.inbound_observed_completed,
        data.inbound_confirmation_counted_remaining_seconds,
        data.inbound_confirmation_counted_completed,
        data.inbound_finalised_completed,
        data.swap_status_pending,
        data.swap_finalised_completed,
        data.streaming_interval,
        data.streaming_quantity,
        data.streaming_count,
        data.outbound_signed_scheduled_outbound_height,
        data.outbound_signed_completed,
        data.outbound_delay_remaining_delay_blocks,
        data.outbound_delay_remaining_delay_seconds,
    ]);
    return true;
}

export async function getTransactionStage(
    hash: string,
    db: Pool,
): Promise<TransactionStage | null> {
    const query = `SELECT * FROM thorchain.transactions_stages WHERE hash = $1`;
    const response = await db.query<TransactionStage>(query, [hash]);
    return response.rows[0] ? response.rows[0] : null;
}

export async function getTransactionStages(
    hashes: string[],
    db: Pool,
): Promise<TransactionStage[]> {
    const query = `SELECT * FROM thorchain.transactions_stages WHERE hash = ANY($1)`;
    const response = await db.query<TransactionStage>(query, [hashes]);
    return response.rows;
}


export async function updateTransactionStage(
    data: Omit<TransactionStage, 'protocol' | 'created_at' | 'updated_at'>,
    db: Pool,
): Promise<boolean> {
    const query = `
    UPDATE thorchain.transactions_stages SET
      inbound_observed_final_count = $2,
      inbound_observed_completed = $3,
      inbound_confirmation_counted_remaining_seconds = $4,
      inbound_confirmation_counted_completed = $5,
      inbound_finalised_completed = $6,
      swap_status_pending = $7,
      swap_finalised_completed = $8,
      streaming_interval = $9,
      streaming_quantity = $10,
      streaming_count = $11,
      outbound_signed_scheduled_outbound_height = $12,
      outbound_signed_completed = $13,
      outbound_delay_remaining_delay_blocks = $14,
      outbound_delay_remaining_delay_seconds = $15
    WHERE hash = $1
  `;
    await db.query(query, [
        data.hash,
        data.inbound_observed_final_count,
        data.inbound_observed_completed,
        data.inbound_confirmation_counted_remaining_seconds,
        data.inbound_confirmation_counted_completed,
        data.inbound_finalised_completed,
        data.swap_status_pending,
        data.swap_finalised_completed,
        data.streaming_interval,
        data.streaming_quantity,
        data.streaming_count,
        data.outbound_signed_scheduled_outbound_height,
        data.outbound_signed_completed,
        data.outbound_delay_remaining_delay_blocks,
        data.outbound_delay_remaining_delay_seconds,
    ]);
    return true;
}
