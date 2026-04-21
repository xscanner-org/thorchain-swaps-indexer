CREATE SCHEMA IF NOT EXISTS thorchain;

CREATE TABLE thorchain.transactions_stages (
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
CREATE TABLE thorchain.tx_base_info (
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
CREATE TABLE thorchain.txs (
    id BIGSERIAL PRIMARY KEY,
    tx_base_info_id BIGINT NOT NULL REFERENCES thorchain.tx_base_info(id) ON DELETE CASCADE,

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
CREATE TABLE thorchain.tx_detail_coins (
    id BIGSERIAL PRIMARY KEY,
    tx_id BIGINT NOT NULL REFERENCES thorchain.txs(id) ON DELETE CASCADE,
    coin_type VARCHAR NOT NULL CHECK (coin_type IN ('coin', 'gas')),
    asset VARCHAR NOT NULL,
    amount VARCHAR NOT NULL
);

-- Signers for Tx (tx.signers[])
CREATE TABLE thorchain.tx_signers (
    id BIGSERIAL PRIMARY KEY,
    tx_id BIGINT NOT NULL REFERENCES thorchain.txs(id) ON DELETE CASCADE,
    signer VARCHAR NOT NULL
);

-- Out hashes for Tx (tx.out_hashes[])
CREATE TABLE thorchain.tx_out_hashes (
    id BIGSERIAL PRIMARY KEY,
    tx_id BIGINT NOT NULL REFERENCES thorchain.txs(id) ON DELETE CASCADE,
    out_hash VARCHAR NOT NULL
);

-- Actions (tx_details.actions[])
CREATE TABLE thorchain.actions (
    id BIGSERIAL PRIMARY KEY,
    tx_base_info_id BIGINT NOT NULL REFERENCES thorchain.tx_base_info(id) ON DELETE CASCADE,
    chain VARCHAR NOT NULL,
    to_address VARCHAR NOT NULL,
    coin_asset VARCHAR NOT NULL,
    coin_amount VARCHAR NOT NULL,
    memo VARCHAR NOT NULL,
    original_memo VARCHAR NOT NULL,
    gas_rate INTEGER NOT NULL,
    in_hash VARCHAR NOT NULL,
    clout_spent VARCHAR,
    vault_pub_key VARCHAR,
    vault_pub_key_eddsa VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

-- MaxGas for Actions (actions.max_gas[])
CREATE TABLE thorchain.action_max_gas (
    id BIGSERIAL PRIMARY KEY,
    action_id BIGINT NOT NULL REFERENCES thorchain.actions(id) ON DELETE CASCADE,
    asset VARCHAR NOT NULL,
    amount VARCHAR NOT NULL,
    decimals INTEGER NOT NULL
);

-- OutTxs (tx_details.out_txs[])
CREATE TABLE thorchain.out_txs (
    id BIGSERIAL PRIMARY KEY,
    tx_base_info_id BIGINT NOT NULL REFERENCES thorchain.tx_base_info(id) ON DELETE CASCADE,
    out_tx_id VARCHAR NOT NULL,
    chain VARCHAR NOT NULL,
    from_address VARCHAR NOT NULL,
    to_address VARCHAR NOT NULL,
    memo VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Coins for OutTx (out_txs.coins[] and out_txs.gas[])
CREATE TABLE thorchain.out_tx_coins (
    id BIGSERIAL PRIMARY KEY,
    out_tx_id BIGINT NOT NULL REFERENCES thorchain.out_txs(id) ON DELETE CASCADE,
    coin_type VARCHAR NOT NULL CHECK (coin_type IN ('coin', 'gas')),
    asset VARCHAR NOT NULL,
    amount VARCHAR NOT NULL
);

-- Indexes
CREATE INDEX idx_tx_details_tx_id ON thorchain.tx_base_info(tx_id);
CREATE INDEX idx_txs_tx_base_info_id ON thorchain.txs(tx_base_info_id);
CREATE INDEX idx_txs_detail_from_address ON thorchain.txs(detail_from_address);
CREATE INDEX idx_actions_tx_base_info_id ON thorchain.actions(tx_base_info_id);
CREATE INDEX idx_actions_in_hash ON thorchain.actions(in_hash);
CREATE INDEX idx_out_txs_tx_base_info_id ON thorchain.out_txs(tx_base_info_id);

CREATE TABLE thorchain.indexed_hashes (
	protocol varchar(50) NOT NULL,
	hash varchar(200) NOT NULL,
	created_at timestamptz DEFAULT now() NULL,
	height int8 NOT NULL,
	state varchar(200) DEFAULT 'PENDING'::character varying NULL,
    PRIMARY KEY (protocol, hash)
);

CREATE TABLE thorchain.refund_events (
    protocol VARCHAR(50) NOT NULL,
    height BIGINT NOT NULL,
    id VARCHAR NOT NULL,
    coin VARCHAR NOT NULL,
    reason VARCHAR NOT NULL,
    PRIMARY KEY (protocol, id, height)
);

CREATE TABLE thorchain.swap_end_block_events (
    swap_event_id BIGSERIAL,
    height BIGINT NOT NULL,
    id VARCHAR NOT NULL,
    chain VARCHAR NOT NULL,
    coin VARCHAR NOT NULL,
    emit_asset VARCHAR NOT NULL,
    from_address VARCHAR NOT NULL,
    to_address VARCHAR NOT NULL,
    memo TEXT,
    mode VARCHAR NOT NULL,
    pool VARCHAR NOT NULL,
    liquidity_fee BIGINT NOT NULL,
    liquidity_fee_in_native_currency BIGINT NOT NULL,
    pool_slip INTEGER NOT NULL,
    swap_slip INTEGER NOT NULL,
    swap_target BIGINT NOT NULL,
    streaming_swap_count INTEGER NOT NULL,
    streaming_swap_quantity INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (swap_event_id)
);

CREATE INDEX idx_swap_end_block_events_height ON thorchain.swap_end_block_events(height);

CREATE TABLE thorchain.indexed_heights (
    height BIGINT NOT NULL,
    protocol VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (height, protocol)
);

CREATE TABLE thorchain.pools (
    asset VARCHAR NOT NULL,
    height BIGINT NOT NULL,
    short_code VARCHAR,
    status VARCHAR NOT NULL,
    pending_inbound_asset NUMERIC(50, 0) NOT NULL,
    pending_inbound_native_currency NUMERIC(50, 0) NOT NULL,
    balance_asset NUMERIC(50, 0) NOT NULL,
    balance_native_currency NUMERIC(50, 0) NOT NULL,
    asset_tor_price NUMERIC(50, 0) NOT NULL,
    pool_units NUMERIC(50, 0) NOT NULL,
    lp_units NUMERIC(50, 0) NOT NULL,
    synth_units NUMERIC(50, 0) NOT NULL,
    synth_supply NUMERIC(50, 0) NOT NULL,
    savers_depth NUMERIC(50, 0) NOT NULL,
    savers_units NUMERIC(50, 0) NOT NULL,
    savers_fill_bps VARCHAR NOT NULL,
    savers_capacity_remaining NUMERIC(50, 0) NOT NULL,
    synth_mint_paused BOOLEAN NOT NULL,
    synth_supply_remaining NUMERIC(50, 0) NOT NULL,
    derived_depth_bps INTEGER NOT NULL,
    trading_halted BOOLEAN NOT NULL,
    volume_native_currency NUMERIC(50, 0) NOT NULL,
    volume_asset NUMERIC(50, 0) NOT NULL,
    decimals INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (asset, height)
);

CREATE INDEX idx_pools_height ON thorchain.pools(height);

ALTER TABLE thorchain.transactions_stages ADD COLUMN outbound_signed_completed BOOLEAN DEFAULT NULL;

CREATE TABLE thorchain.parsed_swap_memos(
    hash VARCHAR PRIMARY KEY,
    asset VARCHAR NOT NULL,
    swap_limit NUMERIC(50, 0),
    swap_interval INTEGER,
    swap_quantity INTEGER,
    destination_address VARCHAR NOT NULL,
    refund_address VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE thorchain.parsed_swap_memos_affiliates(
    hash VARCHAR,
    affiliate VARCHAR NOT NULL,
    fee_basis_points INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (hash, affiliate)
);

CREATE TABLE thorchain.swap_quotes(
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
    recommended_min_amount_in NUMERIC(50, 0) NOT NULL,
    expected_amount_out NUMERIC(50, 0) NOT NULL,
    max_streaming_quantity INTEGER NOT NULL,
    streaming_swap_blocks INTEGER NOT NULL,
    total_swap_seconds INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);