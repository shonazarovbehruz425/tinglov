# syntax=docker/dockerfile:1.7

# ─────────────────────────────────────────────
# Stage 1 — builder: install deps + compile frontend
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2 — runner: slim production image, non-root USER node
# NOTE: runner node:22 bo'lishi shart — server/db.ts `node:sqlite` ishlatadi,
# u Node 22.5+ da mavjud (node:20 da yo'q → start crash).
# ─────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/tinglov.db

# Copy production artifacts from builder
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
# server/index.ts `../src/utils/validation` import qiladi — src ham kerak
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tsconfig.server.json ./tsconfig.server.json

# Persistent data directory for SQLite (mounted via volume)
RUN mkdir -p /data && chown -R node:node /data /app

# Non-root user (node image already provides 'node')
USER node

EXPOSE 3000

# HEALTHCHECK: node'ning o'z fetch'i (18+) — curl/wget kerak emas
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# CMD node server — use tsx loader because server is TypeScript
CMD ["node", "--import", "tsx", "server/index.ts"]
