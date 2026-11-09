# Multi-stage build for Mock Payment Provider
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY services/mock-provider/package*.json ./services/mock-provider/

RUN npm ci --workspace=@payora/mock-provider --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3004

USER node

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node services/mock-provider/src ./services/mock-provider/src
COPY --chown=node:node services/mock-provider/package.json ./services/mock-provider/package.json
COPY --chown=node:node package.json ./

EXPOSE 3004

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3004/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "services/mock-provider/src/index.js"]
