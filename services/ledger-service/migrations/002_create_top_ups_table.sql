-- Payora Ledger Schema Migration: 002
-- Table: top_ups

CREATE TABLE IF NOT EXISTS top_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    provider_ref TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'INITIATED' CHECK (status IN (
        'INITIATED',
        'PROVIDER_PENDING',
        'COMPLETED',
        'FAILED',
        'EXPIRED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_top_ups_provider_ref ON top_ups (provider_ref);
CREATE INDEX IF NOT EXISTS idx_top_ups_user_created ON top_ups (user_id, created_at DESC);
