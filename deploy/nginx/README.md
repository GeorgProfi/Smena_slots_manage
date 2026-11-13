# HTTPS (nginx + Certbot) для smenaslots.duckdns.org

Сервер: **151.243.180.100** → DuckDNS **smenaslots.duckdns.org**.

Сессионные куки в production с флагом `Secure` — нужен доступ по **https://smenaslots.duckdns.org**, не по `http://IP:3000`.

## 1. DuckDNS

В [duckdns.org](https://www.duckdns.org) для домена `smenaslots` должен быть указан IP **151.243.180.100**.

## 2. Docker (только localhost)

На сервере в каталоге проекта создайте `.env` (или скопируйте `docker/app.prod.env.example`):

```bash
cp docker/app.prod.env.example .env
# задайте SESSION_SECRET и POSTGRES_PASSWORD
```

Запуск с прод-привязкой портов (приложение недоступно снаружи по :3000):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Приложение: `http://127.0.0.1:3000`. Postgres по умолчанию **только внутри Docker**. Локально: `docker exec -it volunty-postgres psql -U volunty -d volunty`.

### Доступ к БД извне (DBeaver, pgAdmin, с другого сервера)

На хосте часто занят `:5432` — наружу публикуем **5433**:

```bash
# в .env при необходимости:
# POSTGRES_PUBLISH_BIND=0.0.0.0
# POSTGRES_PUBLISH_PORT=5433

docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.db-expose.yml up -d
```

Подключение:

```text
Host: 151.243.180.100  (или smenaslots.duckdns.org)
Port: 5433
Database: volunty
User: volunty
Password: из .env POSTGRES_PASSWORD
```

**Безопасность:** смените `POSTGRES_PASSWORD`, откройте порт только для своего IP:

```bash
sudo ufw allow from ВАШ_IP to any port 5433 proto tcp
# не используйте «ufw allow 5433» для всего интернета без крайней нужды
```

## 3. nginx на хосте

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/certbot
```

**До certbot** (пока нет сертификата):

```bash
sudo cp deploy/nginx/smenaslots.duckdns.org.http-only.conf /etc/nginx/sites-available/smenaslots
sudo ln -sf /etc/nginx/sites-available/smenaslots /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Откройте firewall:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## 4. Let's Encrypt

```bash
sudo certbot --nginx -d smenaslots.duckdns.org
```

Certbot обновит конфиг nginx. Либо после выпуска сертификата замените сайт полным конфигом:

```bash
sudo cp deploy/nginx/smenaslots.duckdns.org.conf /etc/nginx/sites-available/smenaslots
sudo nginx -t && sudo systemctl reload nginx
```

Проверка продления: `sudo certbot renew --dry-run`.

## 5. Проверка

- `https://smenaslots.duckdns.org` — без предупреждения о сертификате.
- Регистрация / вход — кука `volunty_session` в DevTools.

## Пересборка после смены URL

В `.env` должно быть `NEXT_PUBLIC_APP_URL=https://smenaslots.duckdns.org`, затем:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```
