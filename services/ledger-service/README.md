# Ledger Service

The core double-entry financial ledger service for Payora.

## Responsibilities
- Accounts and balances (assets, liabilities, revenue)
- Concurrency-safe journal entry builder and poster
- Transaction idempotency via `Idempotency-Key` headers
- Top-up handling and provider webhook verification
- P2P transfers, merchant payments, and cash-outs
- Reconciliations and statements

## Architecture
- `src/config/`: Zod-validated environment config (fail-fast)
- `src/domain/`: Pure domain logic (money math, entry builder, fee calculator)
- `src/repositories/`: Database queries with row-level locking
- `src/services/`: Application services orchestrating business use-cases
- `src/routes/`: Express route definitions
- `src/middleware/`: Idempotency, error handling, logging redaction
- `migrations/`: SQL migration files
- `tests/`: Unit, property, and concurrency tests
