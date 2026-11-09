# Multi-stage build for Auth Service
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY services/auth-service/package*.json ./services/auth-service/

RUN npm ci --workspace=@payora/auth-service --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

USER node

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node services/auth-service/src ./services/auth-service/src
COPY --chown=node:node services/auth-service/package.json ./services/auth-service/package.json
COPY --chown=node:node package.json ./

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "services/auth-service/src/index.js"]
