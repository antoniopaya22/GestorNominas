# ─── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files for caching
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

RUN npm ci

# Copy source
COPY backend/ backend/
COPY frontend/ frontend/

# Build backend (TypeScript → JS)
RUN npm run build --workspace=backend

# Build frontend (Astro → static)
RUN npm run build --workspace=frontend

# ─── Stage 2: Production ────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json ./
COPY backend/package.json backend/

# Install production deps only
RUN npm ci --workspace=backend --omit=dev && \
    apk del python3 make g++ && \
    rm -rf /root/.npm /tmp/*

# Copy built backend
COPY --from=builder /app/backend/dist/ backend/dist/

# Copy built frontend
COPY --from=builder /app/frontend/dist/ frontend/dist/

# Copy migration files (needed for db:migrate at startup)
COPY --from=builder /app/backend/src/db/ backend/src/db/
COPY backend/drizzle.config.ts backend/

# Data directory (SQLite + uploads)
RUN mkdir -p /app/data/uploads

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=../data/nominas.db
ENV UPLOAD_DIR=../data/uploads

# Run migrations then start
CMD ["sh", "-c", "cd backend && npx tsx src/db/migrate.ts && node dist/index.js"]
