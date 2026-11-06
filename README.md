# Payora

Payora is a digital wallet backend and frontend built around a **double-entry ledger** engine (inspired by modern digital financial systems). Users hold balances, top-up, transfer funds (P2P), pay merchants, and cash out.

> **Disclaimer:** This is a portfolio/learning project. It uses **fake money and fake data only**. Never use real national ID numbers, phone numbers, bank accounts, or cards in tests, seeds, or screenshots.

---

## Architecture Overview

- **`gateway/`**: Nginx reverse proxy routing API requests and serving static assets
- **`services/ledger-service/`**: Core double-entry ledger, accounts, journal entries, append-only lines, transfers
- **`services/auth-service/`**: User registration, authentication, JWT tokens, transaction PIN, and device records
- **`services/risk-service/`**: Asynchronous risk analysis, velocity checks, and automatic hold rules
- **`services/notification-service/`**: Multi-channel notifications (in-app, Mailpit email, mock SMS)
- **`services/mock-provider/`**: Mock bank/MFS provider issuing HMAC-signed webhooks
- **`frontend/`**: React + Vite responsive web interface

---

## Getting Started

### 1. Prerequisites
- Node.js >= 20
- Docker & Docker Compose
- Gitleaks (for pre-commit safety checks)

### 2. Environment Setup
```bash
cp .env.example .env
npm run generate:secrets
```
This securely populates random secrets into `.env` without printing secrets to logs or terminal.

### 3. Start Infrastructure
```bash
docker compose up -d
```
Starts PostgreSQL, Redis, and Mailpit (Web UI available at `http://localhost:8025`).

### 4. Running Tests
```bash
npm test
```

### 5. Verify Security Guardrails
```bash
npm run test:guardrails
```
