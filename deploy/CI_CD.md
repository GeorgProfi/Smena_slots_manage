# CI/CD (GitHub Actions)

## CI (`/.github/workflows/ci.yml`)

На каждый PR и push в `main` / `classic_auth`:

- `npm run lint`
- `npm run build`
- Postgres 16: полная схема из `docker/postgres/init/01_schema.sql`, затем `npm run db:migrate` (дважды — проверка идемпотентности)

## CD (только вручную)

Автодеплой после push **отключён**. Варианты:

### 1. Workflow **Deploy** (только выкладка)

**Actions → Deploy → Run workflow** — выберите ветку (`classic_auth` / `main`) и запустите.

### 2. Workflow **CI** с деплоем после проверок

**Actions → CI → Run workflow** — включите **«После успешного CI задеплоить на сервер»**, выберите ветку.

Оба варианта используют окружение **`production`** (в GitHub: *Settings → Environments → production* можно включить **Required reviewers** — дополнительная ручная кнопка «Approve deployment»).

На сервере:

1. SSH
2. `git pull` выбранной ветки
3. `deploy/deploy.sh`: `docker compose build app` → `migrate` → `up -d`

### Секреты в GitHub (Settings → Secrets and variables → Actions)

| Secret | Пример | Назначение |
|--------|--------|------------|
| `DEPLOY_HOST` | `151.243.180.100` | IP или hostname сервера |
| `DEPLOY_USER` | `ubuntu` / ваш пользователь SSH | |
| `DEPLOY_SSH_KEY` | приватный ключ (полное содержимое) | Доступ без пароля |
| `DEPLOY_PATH` | `/home/georg/Smena_slots_manage` | Каталог репозитория на сервере |
| `DEPLOY_SSH_PORT` | `22` | Опционально |

### Сборка на маленьком VPS (OOM / `signal: killed`)

Образ `migrate` собирается без полного `npm ci` (только `pg`). `deploy/deploy.sh` строит **migrate → app** по очереди (`COMPOSE_PARALLEL_LIMIT=1`).

Если при сборке **app** процесс всё равно убивается — добавьте swap на сервере, например 2 ГБ:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
grep -q swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

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