# VolunTy

**VolunTy** is a free and open-source platform for managing work and volunteer scheduling.


![Next.js](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)


## Quick Start (Docker Postgres)

### Вариант A: всё в Docker

```bash
docker compose up --build
```

Переменные по умолчанию в [`docker/app.env`](docker/app.env). Приложение: [http://localhost:3000](http://localhost:3000). Схема БД — `docker/postgres/init/` при первом старте Postgres.

### Вариант B: только Postgres в Docker, Next на хосте

1. **Start database**
   ```bash
   docker compose up -d postgres
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   Для хоста: `DATABASE_URL=postgresql://volunty:volunty@localhost:5432/volunty`, `POSTGRES_HOST=localhost`.

3. **Install & run**
   ```bash
   npm install
   npm run dev
   ```

4. **First super admin**
   - Register at [http://localhost:3000/signup](http://localhost:3000/signup)
   - In psql or any SQL client:
     ```sql
     UPDATE public.profiles SET role = 'super_admin'
     WHERE id = (SELECT id FROM auth_users WHERE email = 'you@example.com');
     ```

5. **Password reset in dev**  
   Reset links are printed to the server console (`[password-reset] ...`).

## Architecture

- **Next.js 14** App Router
- **PostgreSQL 16** in Docker (`auth_users`, application tables, triggers)
- **iron-session** HTTP-only cookie sessions (no Supabase)
- **pg** connection pool from API routes

Legacy SQL under `supabase/migrations/` is kept for reference; the active schema is `docker/postgres/init/01_schema.sql`.

## Integrations

- **Authentication:** Email/password (bcrypt + server sessions)
- **Database:** PostgreSQL
- **Notifications:** Browser push (optional VAPID keys)

## License

MIT
