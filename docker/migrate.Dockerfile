FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY scripts/migrate.mjs scripts/migrate.mjs
COPY docker/postgres/migrations docker/postgres/migrations

ENV MIGRATIONS_DIR=/app/docker/postgres/migrations

CMD ["node", "scripts/migrate.mjs"]