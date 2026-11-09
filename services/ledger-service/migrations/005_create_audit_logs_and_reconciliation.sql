-- Payora Ledger Schema Migration: 005
-- Tables: audit_logs, reconciliation_reports

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);

CREATE TABLE IF NOT EXISTS reconciliation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL CHECK (status IN ('BALANCED', 'DISCREPANCY')),
    total_accounts INT NOT NULL,
    balanced_accounts INT NOT NULL,
    discrepancy_accounts INT NOT NULL,
    total_system_balance BIGINT NOT NULL,
    total_debits BIGINT NOT NULL,
    total_credits BIGINT NOT NULL,
    details JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_reports_created ON reconciliation_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_reports_status ON reconciliation_reports (status);
