# Next.js Frontend Dockerfile
FROM node:20-alpine AS base

WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable
ENV NEXT_TELEMETRY_DISABLED=1

# Development stage
FROM base AS development

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install 2>/dev/null || echo "No package.json yet"

COPY . .

ENV NODE_ENV=development

# Run with HTTPS if certificates exist, otherwise HTTP
CMD ["sh", "-c", "if [ -f /app/certs/localhost-key.pem ]; then node server.js; else pnpm run dev:http; fi"]

# Builder stage
FROM base AS builder

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install 2>/dev/null || echo "No package.json yet"

COPY . .

RUN pnpm run build 2>/dev/null || echo "No build script yet"

# Production stage
FROM base AS production

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public 2>/dev/null || true
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./ 2>/dev/null || true
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static 2>/dev/null || true

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
