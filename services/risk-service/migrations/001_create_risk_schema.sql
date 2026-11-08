-- Payora Risk Schema Migration: 001
-- Tables: risk_rules, risk_flags

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS risk_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NULL,
    user_id UUID NOT NULL,
    rule_code TEXT NOT NULL REFERENCES risk_rules (code) ON DELETE RESTRICT,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLEARED', 'CONFIRMED')),
    metadata JSONB NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_flags_user_status ON risk_flags (user_id, status);
CREATE INDEX IF NOT EXISTS idx_risk_flags_severity ON risk_flags (severity);
CREATE INDEX IF NOT EXISTS idx_risk_flags_created ON risk_flags (created_at DESC);

-- Default risk rules seed
INSERT INTO risk_rules (code, name, description, config, active)
VALUES
    ('VELOCITY_SPIKE', 'High Velocity Spike', 'More than 5 transfers within 2 minutes', '{"maxCount": 5, "windowSeconds": 120, "severity": "HIGH"}', true),
    ('LARGE_AMOUNT', 'Unusually Large Amount', 'Transfer amount near or above 20,000 BDT', '{"thresholdPoisha": "2000000", "severity": "MEDIUM"}', true),
    ('NEW_PAYEE', 'First-Time Payee High Value', 'Large transfer to a newly added payee', '{"thresholdPoisha": "500000", "severity": "MEDIUM"}', true),
    ('NEW_DEVICE', 'Untrusted Device', 'Transfer initiated from an unverified or new device', '{"severity": "LOW"}', true)
ON CONFLICT (code) DO NOTHING;
