CREATE SCHEMA IF NOT EXISTS swaps_indexer;

CREATE TABLE IF NOT EXISTS swaps_indexer.indexer_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    process_name TEXT NOT NULL
);