-- Payora Base Ledger Schema Migration: 001
-- Tables: accounts, journal_entries, ledger_lines, idempotency_keys
-- Includes append-only trigger and deferred balanced entry constraint trigger.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NULL,
    type TEXT NOT NULL CHECK (type IN (
        'USER_WALLET',
        'MERCHANT_WALLET',
        'SYSTEM_BANK_CLEARING',
        'SYSTEM_FEE_REVENUE',
        'SYSTEM_AGENT_CASH'
    )),
    currency TEXT NOT NULL DEFAULT 'BDT',
    balance BIGINT NOT NULL DEFAULT 0 CHECK (
        type NOT IN ('USER_WALLET', 'MERCHANT_WALLET') OR balance >= 0
    ),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_owner_type ON accounts (owner_id, type);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts (status);

-- 2. Journal Entries Table
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN (
        'TOP_UP',
        'P2P',
        'MERCHANT_PAYMENT',
        'CASH_OUT',
        'FEE',
        'REVERSAL'
    )),
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN (
        'PENDING',
        'COMPLETED',
        'FAILED',
        'REVERSED'
    )),
    reference TEXT UNIQUE NOT NULL,
    description TEXT,
    reverses_entry_id UUID NULL REFERENCES journal_entries (id),
    initiated_by UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_created ON journal_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON journal_entries (reference);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reverses ON journal_entries (reverses_entry_id) WHERE reverses_entry_id IS NOT NULL;

-- 3. Ledger Lines Table (Append-Only)
CREATE TABLE IF NOT EXISTS ledger_lines (
    id BIGSERIAL PRIMARY KEY,
    entry_id UUID NOT NULL REFERENCES journal_entries (id) ON DELETE RESTRICT,
    account_id UUID NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
    direction TEXT NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_lines_account_created ON ledger_lines (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_lines_entry ON ledger_lines (entry_id);

-- 4. Idempotency Keys Table
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT NOT NULL,
    user_id UUID NOT NULL,
    request_hash TEXT NOT NULL,
    response JSONB NULL,
    status_code INT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created ON idempotency_keys (created_at);

-- 5. Append-Only Trigger on ledger_lines
CREATE OR REPLACE FUNCTION trg_prevent_ledger_line_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Ledger lines are append-only. Modification and deletion are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_lines_immutable ON ledger_lines;
CREATE TRIGGER trg_ledger_lines_immutable
BEFORE UPDATE OR DELETE ON ledger_lines
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_ledger_line_mutation();

-- 6. Deferred Constraint Trigger: Ensure Balanced Journal Entry
CREATE OR REPLACE FUNCTION trg_check_balanced_journal_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_balance BIGINT;
    v_line_count INT;
BEGIN
    SELECT
        COUNT(*),
        COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE -amount END), 0)
    INTO v_line_count, v_balance
    FROM ledger_lines
    WHERE entry_id = NEW.entry_id;

    IF v_line_count < 2 THEN
        RAISE EXCEPTION 'Journal entry % must have at least 2 ledger lines (found %)', NEW.entry_id, v_line_count;
    END IF;

    IF v_balance <> 0 THEN
        RAISE EXCEPTION 'Journal entry % is unbalanced: debits minus credits = %', NEW.entry_id, v_balance;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_balanced_entry ON ledger_lines;
CREATE CONSTRAINT TRIGGER trg_enforce_balanced_entry
AFTER INSERT ON ledger_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION trg_check_balanced_journal_entry();
