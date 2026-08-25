# Neon (Tideway)

Serverless Postgres for the trend aggregation pipeline.

| | |
|---|---|
| Name | `tideway` |
| Project ID | `damp-rain-05566549` |
| Console | https://console.neon.tech/app/projects/damp-rain-05566549 |

## Local secrets

App keys live in **`.env.local`** (gitignored). Copy from `.env.local.example` if missing.

Required:

```bash
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
```

Use the **pooled** connection string from the Neon console for the Next.js app and scripts.

## Schema

SQL migrations: `supabase/migrations/` (applied in filename order).

Seed: `supabase/seed.sql` (RSS / HN / Lobsters / YouTube sources).

```bash
npm run db:migrate
```

Tables: `sources`, `raw_items`, `articles`, `daily_rollups`, `generation_jobs`, `quiz_attempts`, `article_slug_redirects`

## App access

Server-only via `@neondatabase/serverless` (`lib/db/client.ts`). Published filters (`is_published = true`) live in the query layer.

## Verify

```bash
curl http://localhost:3000/api/health
```

```sql
select count(*) from sources;
select count(*) from raw_items;
select count(*) from articles;
```

## Egress note

Free plan includes **5 GB** public network transfer / month. Prefer narrow column lists and page caching (see `ARTICLE_*_COLUMNS` and `revalidate` on pages).
