# Multi-stage build for Risk Service
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY services/risk-service/package*.json ./services/risk-service/

RUN npm ci --workspace=@payora/risk-service --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3003

USER node

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node services/risk-service/src ./services/risk-service/src
COPY --chown=node:node services/risk-service/package.json ./services/risk-service/package.json
COPY --chown=node:node package.json ./

EXPOSE 3003

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3003/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "services/risk-service/src/index.js"]
