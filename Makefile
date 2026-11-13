# ==============================================================================
# Payora (৳) - Digital Wallet & Double-Entry Ledger Engine
# Docker & Development Control Makefile
# ==============================================================================

.DEFAULT_GOAL := help
SHELL := /bin/bash

# Styling colors
CYAN   := \033[36m
GREEN  := \033[32m
YELLOW := \033[33m
RED    := \033[31m
RESET  := \033[0m
BOLD   := \033[1m

.PHONY: help setup init up up-build down down-v clean restart ps status logs \
        logs-gateway logs-ledger logs-auth logs-risk logs-notif logs-mock logs-frontend logs-db logs-redis logs-mail \
        migrate seed dev test test-guardrails shell-db shell-redis shell-ledger shell-auth

## help: Display available make commands
help:
	@echo -e "${BOLD}${CYAN}Payora (৳) - Digital Wallet Management Commands${RESET}"
	@echo -e "Usage: make ${YELLOW}<target>${RESET}\n"
	@awk '/^## / { \
		desc = substr($$0, 4); \
		getline; \
		split($$0, t, ":"); \
		printf "  ${GREEN}%-18s${RESET} %s\n", t[1], desc; \
	}' $(MAKEFILE_LIST)
	@echo ""

# ------------------------------------------------------------------------------
# Setup & Initialization
# ------------------------------------------------------------------------------

## setup: Initialize environment (.env), generate cryptographic secrets, and configure git hooks
setup: init

## init: Alias for setup
init:
	@echo -e "${CYAN}==> Initializing Payora environment...${RESET}"
	@if [ ! -f .env ]; then \
		echo -e "${YELLOW}Creating .env from .env.example...${RESET}"; \
		cp .env.example .env; \
	fi
	@echo -e "${CYAN}==> Generating cryptographic secrets...${RESET}"
	@node scripts/generate-secrets.js
	@if [ -d .githooks ]; then \
		echo -e "${CYAN}==> Configuring Git pre-commit hooks...${RESET}"; \
		git config core.hooksPath .githooks; \
	fi
	@echo -e "${GREEN}==> Initialization complete.${RESET}"

# ------------------------------------------------------------------------------
# Docker Lifecycle Management
# ------------------------------------------------------------------------------

## build: Build all docker container images
build:
	@echo -e "${CYAN}==> Building Docker images...${RESET}"
	docker compose build

## build-nc: Build all docker container images without cache
build-nc:
	@echo -e "${CYAN}==> Building Docker images (no cache)...${RESET}"
	docker compose build --no-cache

## up: Start all microservices in the background (detached mode)
up:
	@echo -e "${CYAN}==> Starting Payora containers in detached mode...${RESET}"
	docker compose up -d
	@echo -e "${GREEN}==> Services started. Access the Web SPA at http://localhost:8080${RESET}"

## up-build: Build images and start all containers in the background
up-build:
	@echo -e "${CYAN}==> Building and launching Payora cluster...${RESET}"
	docker compose up --build -d
	@echo -e "${GREEN}==> Services started. Access the Web SPA at http://localhost:8080${RESET}"

## down: Stop all running containers
down:
	@echo -e "${YELLOW}==> Stopping Payora containers...${RESET}"
	docker compose down

## down-v: Stop containers and wipe persistent database & cache volumes (CLEAN SLATE)
down-v:
	@echo -e "${RED}==> Stopping containers and purging database volumes...${RESET}"
	docker compose down -v

## clean: Alias for down-v (wipes containers and persistent volumes)
clean: down-v

## restart: Restart all docker services
restart:
	@echo -e "${YELLOW}==> Restarting Payora services...${RESET}"
	docker compose restart

## ps: Show status and health of all containers
ps: status

## status: Display running container status
status:
	@echo -e "${CYAN}==> Payora Cluster Status:${RESET}"
	docker compose ps

# ------------------------------------------------------------------------------
# Database Migrations & Seed Data
# ------------------------------------------------------------------------------

## migrate: Run database schema migrations across all microservices
migrate:
	@echo -e "${CYAN}==> Running database schema migrations...${RESET}"
	@node scripts/migrate.js

## seed: Seed development demo accounts, merchant, agent, and initial balances
seed:
	@echo -e "${CYAN}==> Seeding demo users, wallets, and credentials...${RESET}"
	@node scripts/seed-users.js

## dev: Complete bootstrap: setup, start docker, run migrations, and seed demo accounts
dev: init up-build migrate seed
	@echo -e "\n${BOLD}${GREEN}================================================================${RESET}"
	@echo -e "${BOLD}${GREEN}🎉 Payora Full-Stack Cluster is Ready!${RESET}"
	@echo -e "  • Web Application (SPA):  ${CYAN}http://localhost:8080${RESET}"
	@echo -e "  • API Gateway:            ${CYAN}http://localhost:8080/api${RESET}"
	@echo -e "  • Mailpit (Email UI):     ${CYAN}http://localhost:8025${RESET}"
	@echo -e "  • Ledger API (Direct):    ${CYAN}http://localhost:3000${RESET}"
	@echo -e "  • Auth API (Direct):      ${CYAN}http://localhost:3001${RESET}"
	@echo -e "${BOLD}${GREEN}================================================================${RESET}\n"

# ------------------------------------------------------------------------------
# Logs Streaming
# ------------------------------------------------------------------------------

## logs: Stream real-time logs from all running containers
logs:
	docker compose logs -f

## logs-gateway: Stream logs from Nginx API gateway
logs-gateway:
	docker compose logs -f gateway

## logs-ledger: Stream logs from Ledger core service
logs-ledger:
	docker compose logs -f ledger-service

## logs-auth: Stream logs from Auth service
logs-auth:
	docker compose logs -f auth-service

## logs-risk: Stream logs from Risk & Fraud service
logs-risk:
	docker compose logs -f risk-service

## logs-notif: Stream logs from Notification service
logs-notif:
	docker compose logs -f notification-service

## logs-mock: Stream logs from Mock Provider service
logs-mock:
	docker compose logs -f mock-provider

## logs-frontend: Stream logs from React Frontend container
logs-frontend:
	docker compose logs -f frontend

## logs-db: Stream logs from PostgreSQL database
logs-db:
	docker compose logs -f postgres

## logs-redis: Stream logs from Redis cache & queue
logs-redis:
	docker compose logs -f redis

## logs-mail: Stream logs from Mailpit SMTP service
logs-mail:
	docker compose logs -f mailpit

# ------------------------------------------------------------------------------
# Interactive Container Shells
# ------------------------------------------------------------------------------

## shell-db: Open interactive psql console in PostgreSQL container
shell-db:
	docker compose exec postgres psql -U postgres -d payora_ledger

## shell-redis: Open interactive redis-cli in Redis container
shell-redis:
	docker compose exec redis redis-cli

## shell-ledger: Open interactive sh in Ledger service container
shell-ledger:
	docker compose exec ledger-service sh

## shell-auth: Open interactive sh in Auth service container
shell-auth:
	docker compose exec auth-service sh

# ------------------------------------------------------------------------------
# Testing & Verification
# ------------------------------------------------------------------------------

## test: Run full test suite across all services (135 tests)
test:
	@echo -e "${CYAN}==> Running complete test suite...${RESET}"
	npm test

## test-guardrails: Verify gitleaks and secret scan guardrails
test-guardrails:
	@echo -e "${CYAN}==> Testing pre-commit security guardrails...${RESET}"
	npm run test:guardrails
