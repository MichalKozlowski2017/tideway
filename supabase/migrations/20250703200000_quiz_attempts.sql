create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  score smallint not null check (score >= 0),
  total_questions smallint not null check (total_questions > 0),
  created_at timestamptz not null default now(),
  check (score <= total_questions)
);

create index quiz_attempts_article_id_idx on quiz_attempts (article_id, created_at desc);

alter table quiz_attempts enable row level security;
