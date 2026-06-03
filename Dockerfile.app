# ── Stage 1: Build ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN npm install -g bun

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY . .

RUN bunx prisma generate
RUN bun run build

# ── Stage 2: Production ────────────────────────────────────────────────────────
FROM node:22-alpine

# Install docker-cli for sandbox management
RUN apk add --no-cache docker-cli dumb-init

# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy built application
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Set ownership to non-root user
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
