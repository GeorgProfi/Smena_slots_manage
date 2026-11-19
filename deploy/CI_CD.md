# CI/CD (GitHub Actions)

## CI (`/.github/workflows/ci.yml`)

На каждый PR и push в `main` / `classic_auth`:

- `npm run lint`
- `npm run build`
- Postgres 16: полная схема из `docker/postgres/init/01_schema.sql`, затем `npm run db:migrate` (дважды — проверка идемпотентности)

## CD (`/.github/workflows/deploy.yml`)

После успешного push в `main` или `classic_auth` (или вручную **Actions → Deploy → Run workflow**):

1. SSH на сервер
2. `git pull` нужной ветки
3. `deploy/deploy.sh`: `docker compose build app` → `migrate` → `up -d`

### Секреты в GitHub (Settings → Secrets and variables → Actions)

| Secret | Пример | Назначение |
|--------|--------|------------|
| `DEPLOY_HOST` | `151.243.180.100` | IP или hostname сервера |
| `DEPLOY_USER` | `ubuntu` / ваш пользователь SSH | |
| `DEPLOY_SSH_KEY` | приватный ключ (полное содержимое) | Доступ без пароля |
| `DEPLOY_PATH` | `/home/georg/Smena_slots_manage` | Каталог репозитория на сервере |
| `DEPLOY_SSH_PORT` | `22` | Опционально |

На сервере один раз:

```bash
git clone https://github.com/GeorgProfi/Smena_slots_manage.git
cd Smena_slots_manage
cp docker/app.prod.env.example .env
# заполните .env
chmod +x deploy/deploy.sh
```

Публичный ключ от пары для `DEPLOY_SSH_KEY` добавьте в `~/.ssh/authorized_keys` пользователя деплоя.

## Локально

```bash
npm run db:migrate
# или через Docker (Postgres должен быть healthy):
docker compose run --rm migrate
```

Новые SQL-файлы — в `docker/postgres/migrations/` с префиксом даты `YYYYMMDDHHMMSS_name.sql`. Полную схему для новых инсталляций обновляйте в `docker/postgres/init/01_schema.sql`.