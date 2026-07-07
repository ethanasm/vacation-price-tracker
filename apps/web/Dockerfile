# Next.js Frontend Dockerfile
FROM node:26-alpine AS base

WORKDIR /app
RUN apk add --no-cache libc6-compat
# Node >= 25 images no longer bundle corepack — install it before enabling
# (pnpm version is pinned by the packageManager field in package.json).
RUN npm install -g corepack@latest && corepack enable
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
RUN pnpm install

COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so the
# API base URL must be set here — a runtime env var would not reach the browser.
# Defaults to the dev URL; CI passes the prod origin via --build-arg.
ARG NEXT_PUBLIC_API_URL=https://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN pnpm run build

# Production stage
FROM base AS production

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next standalone output: server.js + minimal node_modules, plus static assets.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
