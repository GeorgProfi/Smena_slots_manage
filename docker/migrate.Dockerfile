# Minimal image: only `pg` (no full npm ci — saves RAM on small VPS during build)
FROM node:20-alpine
WORKDIR /app

RUN npm install --omit=dev --no-package-lock --no-audit --no-fund pg@8.13.1

COPY scripts/migrate.mjs scripts/migrate.mjs
COPY docker/postgres/migrations docker/postgres/migrations

ENV MIGRATIONS_DIR=/app/docker/postgres/migrations

CMD ["node", "scripts/migrate.mjs"]