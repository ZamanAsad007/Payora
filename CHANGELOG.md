# Changelog

All notable changes to the Payora Digital Wallet & Ledger project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-09

### Added

#### Core Ledger Engine (`@payora/ledger-service`)
- **Double-Entry Architecture:** Every transaction records at least 2 balanced ledger lines ($\sum \text{Debits} \equiv \sum \text{Credits}$).
- **Database Trigger Invariants:** PostgreSQL append-only trigger blocking `UPDATE` and `DELETE` on `ledger_lines`, and deferred constraint trigger verifying line balance before commit.
- **Deterministic Row Locking:** Lexicographical ordered pessimistic row locking (`ORDER BY id ASC FOR UPDATE`) preventing database deadlocks under high-contention bi-directional transfers.
- **Integer Minor Units:** Precision arithmetic using integer poisha (`BIGINT`), completely eliminating floating-point rounding bugs.
- **Transaction Types:** Full lifecycle for Wallet Top-Up, P2P Transfers, Merchant QR Payments, and Agent Cash-Out.
- **Compensating Reversals:** Administrative reversals create balanced compensating entries swapping debits and credits while safeguarding against overdrafts and double reversals.
- **Automated Ledger Reconciliation:** Scheduled and on-demand reconciliation job verifying account cached balances against cumulative ledger lines and system-wide debit/credit conservation.
- **Statement Exports:** High-quality PDF statement generation (`pdfkit`) and RFC 4180-compliant CSV exports with opening/closing period balances.

#### Authentication & Security (`@payora/auth-service`)
- **Dual-Credential Security:** Argon2/Bcrypt password authentication plus a separate 5-digit numeric transaction PIN required for money movements.
- **Brute-Force Lockout:** PIN lockout after 3 consecutive invalid attempts with 30-minute cooldown window.
- **JWT & Token Refresh:** Secure token issuance with sliding window refresh mechanism.
- **Device Fingerprinting:** Recording client fingerprints and tracking trusted vs. new devices.

#### Risk & Fraud Rules (`@payora/risk-service`)
- **Velocity Rule Engine:** Real-time asynchronous detection of rapid transfer velocity (>5 transfers in 2 minutes).
- **Anomalous Amount Checks:** Rejection or flagging of single transfers exceeding per-transaction or daily thresholds.
- **New Payee & New Device Flags:** Automatic flagging and temporary account holds for suspicious high-value transfers to newly added recipients.

#### Multi-Channel Notifications (`@payora/notification-service`)
- **Multi-Channel Dispatch:** In-App inbox notifications, Mailpit SMTP emails via Nodemailer, and mock SMS alerts.
- **PII Protection:** Global phone number masking (`+88017****5678`) across all message templates and application logs.

#### Mock Provider (`@payora/mock-provider`)
- **HMAC-SHA256 Webhooks:** Cryptographically signed callbacks with replay protection and timestamp tolerance windows.

#### Frontend Web Application (`@payora/frontend`)
- **React 18 & Vite SPA:** Clean, modern fintech dashboard built with Tailwind CSS, Lucide icons, and TanStack Query.
- **Financial Flows:** Send Money with payee picker, Add Money provider simulation, Pay Merchant QR workflow, and Agent Cash-Out.
- **Admin Dashboard:** Platform KPI metrics, reconciliation runner with discrepancy alerts, risk flag review tools, account freeze/unfreeze controls, and audit trail search.

#### Infrastructure & CI/CD
- **Full Docker Compose Stack:** Orchestrated multi-stage containers for Postgres 16, Redis 7, Mailpit, 5 microservices, React SPA, and Nginx Gateway.
- **Zero-Secret Guardrails:** Pre-commit hooks (`gitleaks` + blocklist), fail-fast Zod configuration loaders, and GitHub Actions secret scanning.
- **Comprehensive Test Suite:** 132 passing tests spanning unit tests, generative property-based tests (`fast-check`), and multi-threaded concurrency suites.
