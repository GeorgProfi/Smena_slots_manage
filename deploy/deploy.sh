#!/usr/bin/env bash
# Deploy on the server: build, migrate, restart app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

if [[ -f .env ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

echo "==> Building images (sequential, lower peak RAM)..."
COMPOSE_PARALLEL_LIMIT=1 "${COMPOSE[@]}" build migrate app

echo "==> Running database migrations..."
"${COMPOSE[@]}" run --rm migrate

echo "==> Starting services..."
"${COMPOSE[@]}" up -d postgres app

echo "==> Done."
"${COMPOSE[@]}" ps