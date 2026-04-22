CREATE SCHEMA IF NOT EXISTS swaps_indexer;

CREATE TABLE IF NOT EXISTS swaps_indexer.indexer_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    process_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS swaps_indexer.state_machine_config (
    protocol VARCHAR NOT NULL,
    state VARCHAR NOT NULL,
    batch_size INT NOT NULL,
    PRIMARY KEY (protocol, state)
);

INSERT INTO swaps_indexer.state_machine_config (protocol, state, batch_size) VALUES
    ('thorchain', 'STORED_INDEXED_HASH', 100),
    ('thorchain', 'REINDEX_DATA', 100),
    ('thorchain', 'ARCHIVE_SUCCESSFUL', 100),
    ('mayachain', 'STORED_INDEXED_HASH', 100),
    ('mayachain', 'REINDEX_DATA', 100),
    ('mayachain', 'ARCHIVE_SUCCESSFUL', 100)
ON CONFLICT (protocol, state) DO NOTHING;
