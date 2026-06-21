# Supabase (Tideway)

Hosted project for the trend aggregation pipeline.

| | |
|---|---|
| Name | `trendpulse` |
| Ref | `ilzffbrlponaxfbhduzz` |
| URL | `https://ilzffbrlponaxfbhduzz.supabase.co` |
| Region | `eu-central-1` (Frankfurt) |
| Dashboard | https://supabase.com/dashboard/project/ilzffbrlponaxfbhduzz |

## Local secrets

App keys live in **`.env.local`** (gitignored). Copy from `.env.local.example` if missing.

Database password for CLI (`supabase link`, `psql`) is stored locally in `config/supabase.credentials.local` (gitignored).

## Schema

Migration applied: `supabase/migrations/20250621000000_initial_schema.sql`

Tables: `sources`, `raw_items`, `articles`, `daily_rollups`, `generation_jobs`

Seed: 13 sources (Reddit, RSS, Google Trends, YouTube) — run via SQL editor or `supabase/seed.sql`.

## CLI

```bash
cd /Users/michal/Sites/tideway
supabase link --project-ref ilzffbrlponaxfbhduzz
supabase db push
```

## RLS

- Public read: published `articles` and related `daily_rollups`
- Service role: full access for cron routes (server-only `SUPABASE_SERVICE_ROLE_KEY`)

## Verify

```bash
curl http://localhost:3000/api/health
```

After ingest cron:

```sql
select count(*) from raw_items;
select count(*) from sources;
```
