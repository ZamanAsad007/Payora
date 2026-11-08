-- Payora Ledger Schema Migration: 004
-- Tables: limits, outbox

CREATE TABLE IF NOT EXISTS limits (
    user_id UUID PRIMARY KEY,
    daily_send_limit BIGINT NOT NULL DEFAULT 5000000, -- 50,000 BDT
    per_txn_limit BIGINT NOT NULL DEFAULT 2500000,   -- 25,000 BDT
    monthly_limit BIGINT NOT NULL DEFAULT 20000000,  -- 200,000 BDT
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outbox (
    id BIGSERIAL PRIMARY KEY,
    topic TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox (created_at ASC) WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outbox_topic ON outbox (topic);
