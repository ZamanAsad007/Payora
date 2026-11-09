# Multi-stage build for Notification Service
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY services/notification-service/package*.json ./services/notification-service/

RUN npm ci --workspace=@payora/notification-service --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

USER node

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node services/notification-service/src ./services/notification-service/src
COPY --chown=node:node services/notification-service/package.json ./services/notification-service/package.json
COPY --chown=node:node package.json ./

EXPOSE 3002

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3002/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "services/notification-service/src/index.js"]
