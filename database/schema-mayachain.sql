CREATE SCHEMA IF NOT EXISTS mayachain;

CREATE TABLE mayachain.transactions_stages (
    protocol VARCHAR(50),
    hash TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- InboundObserved (required)
    inbound_observed_final_count INTEGER NOT NULL,
    inbound_observed_completed BOOLEAN NOT NULL,

    -- InboundConfirmationCounted (optional)
    inbound_confirmation_counted_remaining_seconds INTEGER,
    inbound_confirmation_counted_completed BOOLEAN,

    -- InboundFinalised (optional)
    inbound_finalised_completed BOOLEAN,

    -- SwapStatus (optional)
    swap_status_pending BOOLEAN,

    streaming_interval INTEGER,
    streaming_quantity INTEGER,
    streaming_count INTEGER,
    outbound_signed_scheduled_outbound_height INTEGER,
    outbound_delay_remaining_delay_blocks INTEGER,
    outbound_delay_remaining_delay_seconds INTEGER,

    -- SwapFinalised (optional)
    swap_finalised_completed BOOLEAN,
    PRIMARY KEY (hash, protocol)
);

-- Core transaction details
CREATE TABLE mayachain.tx_base_info (
    id BIGSERIAL PRIMARY KEY,
    tx_id VARCHAR NOT NULL UNIQUE,
    consensus_height INTEGER NOT NULL,
    finalised_height INTEGER NOT NULL,
    updated_vault BOOLEAN,
    outbound_height INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tx records (used for both tx and txs[])
CREATE TABLE mayachain.txs (
    id BIGSERIAL PRIMARY KEY,
    tx_base_info_id BIGINT NOT NULL REFERENCES mayachain.tx_base_info(id) ON DELETE CASCADE,

    -- TxDetail (nested tx.tx)
    detail_id VARCHAR NOT NULL,
    detail_chain VARCHAR NOT NULL,
    detail_from_address VARCHAR NOT NULL,
    detail_to_address VARCHAR NOT NULL,
    detail_memo VARCHAR,

    -- Tx fields
    status VARCHAR,
    external_observed_height INTEGER,
    observed_pub_key VARCHAR,
    external_confirmation_delay_height INTEGER,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Coins for TxDetail (tx.tx.coins and tx.tx.gas)
CREATE TABLE mayachain.tx_detail_coins (
    id BIGSERIAL PRIMARY KEY,
    tx_id BIGINT NOT NULL REFERENCES mayachain.txs(id) ON DELETE CASCADE,
    coin_type VARCHAR NOT NULL CHECK (coin_type IN ('coin', 'gas')),
    asset VARCHAR NOT NULL,
    amount VARCHAR NOT NULL
);

-- Signers for Tx (tx.signers[])
CREATE TABLE mayachain.tx_signers (
    id BIGSERIAL PRIMARY KEY,
    tx_id BIGINT NOT NULL REFERENCES mayachain.txs(id) ON DELETE CASCADE,
    signer VARCHAR NOT NULL
);

-- Out hashes for Tx (tx.out_hashes[])
CREATE TABLE mayachain.tx_out_hashes (
    id BIGSERIAL PRIMARY KEY,
    tx_id BIGINT NOT NULL REFERENCES mayachain.txs(id) ON DELETE CASCADE,
    out_hash VARCHAR NOT NULL
);

-- Actions (tx_details.actions[])
CREATE TABLE mayachain.actions (
    id BIGSERIAL PRIMARY KEY,
    tx_base_info_id BIGINT NOT NULL REFERENCES mayachain.tx_base_info(id) ON DELETE CASCADE,
    chain VARCHAR NOT NULL,
    to_address VARCHAR NOT NULL,
    coin_asset VARCHAR NOT NULL,
    coin_amount VARCHAR NOT NULL,
    memo VARCHAR NOT NULL,
    original_memo VARCHAR,
    gas_rate INTEGER NOT NULL,
    in_hash VARCHAR NOT NULL,
    clout_spent VARCHAR,
    vault_pub_key VARCHAR,
    vault_pub_key_eddsa VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

-- MaxGas for Actions (actions.max_gas[])
CREATE TABLE mayachain.action_max_gas (
    id BIGSERIAL PRIMARY KEY,
    action_id BIGINT NOT NULL REFERENCES mayachain.actions(id) ON DELETE CASCADE,
    asset VARCHAR NOT NULL,
    amount VARCHAR NOT NULL,
    decimals INTEGER NOT NULL
);

-- OutTxs (tx_details.out_txs[])
CREATE TABLE mayachain.out_txs (
    id BIGSERIAL PRIMARY KEY,
    tx_base_info_id BIGINT NOT NULL REFERENCES mayachain.tx_base_info(id) ON DELETE CASCADE,
    out_tx_id VARCHAR NOT NULL,
    chain VARCHAR NOT NULL,
    from_address VARCHAR NOT NULL,
    to_address VARCHAR NOT NULL,
    memo VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Coins for OutTx (out_txs.coins[] and out_txs.gas[])
CREATE TABLE mayachain.out_tx_coins (
    id BIGSERIAL PRIMARY KEY,
    out_tx_id BIGINT NOT NULL REFERENCES mayachain.out_txs(id) ON DELETE CASCADE,
    coin_type VARCHAR NOT NULL CHECK (coin_type IN ('coin', 'gas')),
    asset VARCHAR NOT NULL,
    amount VARCHAR NOT NULL
);

-- Indexes
CREATE INDEX idx_tx_details_tx_id ON mayachain.tx_base_info(tx_id);
CREATE INDEX idx_txs_tx_base_info_id ON mayachain.txs(tx_base_info_id);
CREATE INDEX idx_txs_detail_from_address ON mayachain.txs(detail_from_address);
CREATE INDEX idx_actions_tx_base_info_id ON mayachain.actions(tx_base_info_id);
CREATE INDEX idx_actions_in_hash ON mayachain.actions(in_hash);
CREATE INDEX idx_out_txs_tx_base_info_id ON mayachain.out_txs(tx_base_info_id);

CREATE TABLE mayachain.indexed_hashes (
	protocol varchar(50) NOT NULL,
	hash varchar(200) NOT NULL,
	created_at timestamptz DEFAULT now() NULL,
	height int8 NOT NULL,
	state varchar(200) DEFAULT 'PENDING'::character varying NULL,
    PRIMARY KEY (protocol, hash)
);

CREATE TABLE mayachain.refund_events (
    protocol VARCHAR(50) NOT NULL,
    height BIGINT NOT NULL,
    id VARCHAR NOT NULL,
    coin VARCHAR NOT NULL,
    reason VARCHAR NOT NULL,
    PRIMARY KEY (protocol, id, height)
);

CREATE TABLE mayachain.swap_end_block_events (
    swap_event_id BIGSERIAL,
    height BIGINT NOT NULL,
    id VARCHAR NOT NULL,
    chain VARCHAR NOT NULL,
    coin VARCHAR NOT NULL,
    emit_asset VARCHAR NOT NULL,
    from_address VARCHAR NOT NULL,
    to_address VARCHAR NOT NULL,
    memo TEXT,
    pool VARCHAR NOT NULL,
    liquidity_fee BIGINT NOT NULL,
    liquidity_fee_in_native_currency BIGINT NOT NULL,
    swap_slip INTEGER NOT NULL,
    swap_target BIGINT NOT NULL,
    streaming_swap_count INTEGER NOT NULL,
    streaming_swap_quantity INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (swap_event_id)
);

CREATE INDEX idx_swap_end_block_events_height ON mayachain.swap_end_block_events(height);

CREATE TABLE mayachain.indexed_heights (
    height BIGINT NOT NULL,
    protocol VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (height, protocol)
);

CREATE TABLE mayachain.pools (
    height BIGINT NOT NULL,
    asset VARCHAR NOT NULL,
    lp_units NUMERIC(50, 0) NOT NULL,
    pool_units NUMERIC(50, 0) NOT NULL,
    status VARCHAR NOT NULL,
    synth_units NUMERIC(50, 0) NOT NULL,
    synth_supply NUMERIC(50, 0) NOT NULL,
    pending_inbound_asset NUMERIC(50, 0) NOT NULL,
    pending_inbound_native_currency NUMERIC(50, 0) NOT NULL,
    balance_asset NUMERIC(50, 0) NOT NULL,
    balance_native_currency NUMERIC(50, 0) NOT NULL,
    bondable BOOLEAN,
    decimals INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (asset, height)
);

CREATE INDEX idx_mayachain_pools_height ON mayachain.pools(height);

ALTER TABLE mayachain.transactions_stages ADD COLUMN outbound_signed_completed BOOLEAN DEFAULT NULL;

CREATE TABLE mayachain.parsed_swap_memos(
    hash VARCHAR PRIMARY KEY,
    asset VARCHAR NOT NULL,
    swap_limit NUMERIC(50, 0),
    swap_interval INTEGER,
    swap_quantity INTEGER,
    destination_address VARCHAR NOT NULL,
    refund_address VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE mayachain.parsed_swap_memos_affiliates(
    hash VARCHAR,
    affiliate VARCHAR NOT NULL,
    fee_basis_points INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (hash, affiliate)
);

CREATE TABLE mayachain.swap_quotes(
    hash VARCHAR PRIMARY KEY,
    outbound_delay_blocks INTEGER NOT NULL DEFAULT 0,
    outbound_delay_seconds INTEGER NOT NULL DEFAULT 0,
    fees_asset VARCHAR NOT NULL,
    fees_affiliate NUMERIC(50, 0) NOT NULL,
    fees_outbound NUMERIC(50, 0) NOT NULL,
    fees_liquidity NUMERIC(50, 0) NOT NULL,
    fees_total NUMERIC(50, 0) NOT NULL,
    fees_slippage_bps INTEGER NOT NULL,
    fees_total_bps INTEGER NOT NULL,
    expiry BIGINT NOT NULL,
    dust_threshold NUMERIC(50, 0),
    recommended_min_amount_in NUMERIC(50, 0) NOT NULL,
    recommended_gas_rate NUMERIC(50, 0) NOT NULL,
    gas_rate_units VARCHAR NOT NULL,
    expected_amount_out NUMERIC(50, 0) NOT NULL,
    max_streaming_quantity INTEGER NOT NULL,
    streaming_swap_blocks INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);