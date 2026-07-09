# Tideway

Automatyczny serwis podsumowań trendów (PL + EN). Pobiera dane z Reddit, RSS, Google Trends i YouTube, generuje streszczenia przez AI i publikuje artykuły SEO-friendly.

## Stack

- **Next.js 16** (App Router, ISR)
- **Supabase** (Postgres)
- **OpenAI** lub **lokalny Ollama** (`AI_PROVIDER=openai|local`)
- **Vercel Cron**

## Źródła danych

| Typ | Auth | Status |
|-----|------|--------|
| **Hacker News** | brak (Firebase API) | ✅ aktywne |
| **Lobsters** | brak (RSS) | ✅ aktywne |
| RSS (TechCrunch, Verge, Ars, Wired, Spider's Web…) | brak | ✅ aktywne |
| Reddit | OAuth (wymaga akceptacji Reddit) | ⏸ wyłączone |
| Google Trends | brak | ⏸ wyłączone z artykułów |
| YouTube | API key (opcjonalnie) | opcjonalne |

Szczegóły Reddit: [docs/REDDIT.md](docs/REDDIT.md)

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
| `/api/cron/generate` | co 30 min (~5 artykułów / run, cel ~24–40/dzień) |
| `/api/cron/daily-rollup` | 06:00 UTC |
| `/api/cron/weekly-rollup | pon 07:00 UTC |

## Deploy (Vercel)

1. Połącz repo z Vercel
2. Ustaw env vars z `.env.local.example` — na produkcji **`NEXT_PUBLIC_SITE_URL=https://tideway.pl`**
3. **Domains** w Vercel → dodaj `tideway.pl` (primary) i `tideway.eu`
4. DNS u rejestratora:
   - `tideway.pl` → rekordy Vercel (A/CNAME jak w panelu)
   - `tideway.eu` → to samo (Vercel obsłuży obie)
5. `vercel.json` — crony + **301 z `tideway.eu` i `www.*` na `https://tideway.pl`**

| Domena | Rola |
|--------|------|
| `tideway.pl` | główna (canonical, SEO, sitemap) |
| `tideway.eu` | alias → redirect na `.pl` (rezerwa pod ekspansję EU) |

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
