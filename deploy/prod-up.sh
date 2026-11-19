#!/usr/bin/env bash
# Прод: пересборка и проверка, что приложение слушает 127.0.0.1:3000 (для nginx).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

if [[ ! -f .env ]]; then
  echo "Нет файла .env — скопируйте: cp docker/app.prod.env.example .env"
  exit 1
fi

echo "==> Подсказка: не смешивайте docker-compose.dev.yml с prod (конфликт :3000)"
echo "==> Сборка и запуск..."
"${COMPOSE[@]}" up -d --build

echo "==> Статус контейнеров:"
"${COMPOSE[@]}" ps

echo "==> Ожидание готовности приложения (до 90 с)..."
for i in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 2 http://127.0.0.1:3000/ 2>/dev/null || true)"
  if [[ "$code" =~ ^[23] ]]; then
    echo "OK: http://127.0.0.1:3000/ → HTTP $code"
    if command -v ss >/dev/null 2>&1 && ss -tlnp 2>/dev/null | grep -q ':3000 '; then
      echo "Порт 3000 слушается на хосте."
    fi
    exit 0
  fi
  sleep 3
done

echo "ОШИБКА: на 127.0.0.1:3000 нет ответа — nginx будет отдавать 502."
echo "Логи приложения:"
docker logs volunty-app --tail 80 2>&1 || true
echo "---"
echo "Частые причины:"
echo "  • Запуск без -f docker-compose.prod.yml (порт 3000 не проброшен на хост)"
echo "  • Одновременно dev + prod compose (address already in use на :3000)"
echo "  • Падение сборки (мало RAM на сервере) — смотрите вывод docker compose build"
exit 1