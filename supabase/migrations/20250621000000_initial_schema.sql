-- TrendPulse core schema

create extension if not exists "pgcrypto";

create type source_type as enum ('reddit', 'rss', 'youtube', 'google_trends');
create type raw_item_status as enum ('pending', 'processed', 'skipped', 'failed');
create type article_type as enum ('trend_item', 'daily_digest', 'weekly_digest', 'rising_falling');
create type rollup_type as enum ('daily', 'weekly');
create type job_status as enum ('running', 'completed', 'failed');

create table sources (
  id uuid primary key default gen_random_uuid(),
  type source_type not null,
  config jsonb not null default '{}',
  category text not null,
  locale text not null default 'pl',
  enabled boolean not null default true,
  fetch_interval_min integer not null default 30,
  created_at timestamptz not null default now()
);

create table raw_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  external_id text not null,
  title text not null,
  description text,
  url text not null,
  engagement_score numeric not null default 0,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  content_hash text not null,
  status raw_item_status not null default 'pending',
  unique (source_id, external_id)
);

create table articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  locale text not null,
  category text not null,
  article_type article_type not null default 'trend_item',
  seo_title text not null,
  seo_description text not null,
  headline text not null,
  lead text not null,
  summary jsonb not null default '[]',
  why_it_matters text not null,
  tags text[] not null default '{}',
  source_item_ids uuid[] not null default '{}',
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_published boolean not null default true,
  unique (slug, locale)
);

create table daily_rollups (
  id uuid primary key default gen_random_uuid(),
  locale text not null,
  rollup_type rollup_type not null,
  period_date date not null,
  article_id uuid not null references articles(id) on delete cascade,
  metrics jsonb not null default '{}',
  unique (locale, rollup_type, period_date)
);

create table generation_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status job_status not null default 'running',
  items_processed integer not null default 0,
  tokens_used integer not null default 0,
  error text
);

create index raw_items_content_hash_idx on raw_items (content_hash);
create index raw_items_status_idx on raw_items (status) where status = 'pending';
create index articles_locale_category_published_idx on articles (locale, category, published_at desc);
create index articles_tags_gin_idx on articles using gin (tags);
create index articles_search_idx on articles using gin (
  to_tsvector('simple', coalesce(headline, '') || ' ' || coalesce(lead, ''))
);

alter table sources enable row level security;
alter table raw_items enable row level security;
alter table articles enable row level security;
alter table daily_rollups enable row level security;
alter table generation_jobs enable row level security;

create policy "Public read published articles"
  on articles for select
  using (is_published = true);

create policy "Public read rollups via published articles"
  on daily_rollups for select
  using (
    exists (
      select 1 from articles a
      where a.id = daily_rollups.article_id and a.is_published = true
    )
  );

create policy "Service role full access sources"
  on sources for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role full access raw_items"
  on raw_items for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role full access articles"
  on articles for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role full access rollups"
  on daily_rollups for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Service role full access jobs"
  on generation_jobs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
