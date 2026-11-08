-- Payora Ledger Schema Migration: 003
-- Tables: merchants, payees

CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NULL,
    name TEXT NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
    qr_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchants_owner ON merchants (owner_id);
CREATE INDEX IF NOT EXISTS idx_merchants_account ON merchants (account_id);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants (status);

CREATE TABLE IF NOT EXISTS payees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    payee_account_id UUID NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
    nickname TEXT NOT NULL,
    first_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, payee_account_id)
);

CREATE INDEX IF NOT EXISTS idx_payees_user ON payees (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payees_account ON payees (payee_account_id);
