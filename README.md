# Tideway

> **Projekt zakończony (lipiec 2026).** Serwis nie publikuje nowych treści. Repozytorium zarchiwizowane jako portfolio techniczne.

Automatyczny serwis podsumowań trendów (PL + EN). Pobierał dane z RSS, Hacker News i innych źródeł, generował streszczenia przez AI i publikował artykuły.

## Zamknięcie

| Krok | Status |
|------|--------|
| Crony wyłączone (`vercel.json`) | ✅ |
| `noindex` + pusty sitemap | ✅ |
| Endpointy cron → HTTP 410 na produkcji | ✅ |
| Supabase paused | ręcznie w dashboardzie |
| Vercel project | usuń w panelu po ostatnim deployu |
| OpenAI / Reddit keys | revoke w panelach dostawców |

Lokalny dev: ustaw `PROJECT_SHUTDOWN=false` w `.env.local` tylko jeśli potrzebujesz uruchomić pipeline archiwalnie.

## Stack

- **Next.js 16** (App Router, ISR)
- **Supabase** (Postgres)
- **OpenAI** lub **lokalny Ollama** (`AI_PROVIDER=openai|local`)

## Quick start (archiwum)

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

## Licencja

Kod pozostaje w repozytorium do wglądu; produkt `tideway.pl` nie jest utrzymywany.
