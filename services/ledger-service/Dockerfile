# Multi-stage build for Ledger Core Service
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY services/ledger-service/package*.json ./services/ledger-service/

RUN npm ci --workspace=@payora/ledger-service --omit=dev && \
    mkdir -p /app/services/ledger-service/node_modules

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

USER node

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/services/ledger-service/node_modules ./services/ledger-service/node_modules
COPY --chown=node:node services/ledger-service/src ./services/ledger-service/src
COPY --chown=node:node services/ledger-service/migrations ./services/ledger-service/migrations
COPY --chown=node:node services/ledger-service/package.json ./services/ledger-service/package.json
COPY --chown=node:node package.json ./

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "services/ledger-service/src/index.js"]
