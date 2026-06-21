# TrendPulse

Automatyczny serwis podsumowań trendów (PL + EN). Pobiera dane z Reddit, RSS, Google Trends i YouTube, generuje streszczenia przez AI i publikuje artykuły SEO-friendly.

## Stack

- **Next.js 16** (App Router, ISR)
- **Supabase** (Postgres)
- **OpenAI** (gpt-4o-mini)
- **Vercel Cron**

## Quick start

```bash
cp .env.local.example .env.local
# Uzupełnij zmienne środowiskowe

npm install
npx supabase db push   # lub uruchom migracje w Supabase Dashboard
npm run dev
```

## Cron endpoints

Wymagają nagłówka `Authorization: Bearer <CRON_SECRET>` lub `x-cron-secret`.

| Endpoint | Schedule |
|----------|----------|
| `/api/cron/ingest` | co 30 min |
| `/api/cron/generate` | co 15 min |
| `/api/cron/daily-rollup` | 06:00 UTC |
| `/api/cron/weekly-rollup | pon 07:00 UTC |

## Deploy (Vercel)

1. Połącz repo z Vercel
2. Ustaw env vars z `.env.local.example`
3. `vercel.json` konfiguruje crony automatycznie

## Struktura URL

| PL | EN |
|----|-----|
| `/trendy/technologia` | `/en/trends/technology` |
| `/dzienny-przeglad` | `/en/daily-digest` |
| `/artykul/[slug]` | `/en/article/[slug]` |

## Koszt operacyjny (szacunek)

- MVP (30–60 artykułów/dzień): **5–18 USD/mies.**
- API Reddit/RSS/Trends: darmowe w limitach
- YouTube: opcjonalne, wymaga `YOUTUBE_API_KEY`
