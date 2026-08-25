# Tideway

Automatyczny serwis podsumowań trendów (PL + EN). Pobiera dane z RSS, Hacker News i innych źródeł, generuje streszczenia przez AI i publikuje artykuły.

## Stack

- **Next.js 16** (App Router, ISR)
- **Neon** (Postgres)
- **OpenAI** lub **lokalny Ollama** (`AI_PROVIDER=openai|local`)

## Quick start

```bash
cp .env.local.example .env.local
# Uzupełnij DATABASE_URL (Neon) oraz OPENAI_API_KEY / CRON_SECRET
npm install
npm run db:migrate   # opcjonalnie — schemat + seed na świeżym Neon
npm run dev
```

Panel lokalny: http://localhost:3000/panel

Health: http://localhost:3000/api/health

## Baza (Neon)

Migracje SQL żyją w `supabase/migrations/` (historyczna nazwa katalogu). Aplikacja łączy się przez `DATABASE_URL` (`@neondatabase/serverless`).

```bash
DATABASE_URL=... npm run db:migrate
```

Szczegóły: [docs/NEON.md](docs/NEON.md)
