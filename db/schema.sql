-- CineRank schema — paste into Supabase SQL editor (Database → SQL Editor → New query).
-- This file is schema definition only. All application reads/writes go through the
-- Supabase JS query builder (.select/.insert/.update/.eq…), never hand-built SQL
-- strings (CLAUDE.md § Coding Conventions / § Security & Secrets #2).

-- ---------------------------------------------------------------------------
-- 5.1  movies — the growing taste profile
-- ---------------------------------------------------------------------------
create table if not exists movies (
  id           uuid primary key default gen_random_uuid(),
  tmdb_id      integer not null unique,          -- dedup: one clean DB-level answer to § 3.4
  title        text    not null,
  year         integer,
  description  text,                             -- TMDB overview
  poster_url   text,
  rating       numeric(3,1),                     -- 0.0–10.0, nullable until rated
  review       text,
  created_at   timestamptz not null default now(),
  constraint rating_range check (rating is null or (rating >= 0 and rating <= 10))
);

create index if not exists movies_rating_idx on movies (rating desc nulls last);

-- ---------------------------------------------------------------------------
-- 5.2  recommendation_logs — every AI recommendation run, auditable
-- ---------------------------------------------------------------------------
create table if not exists recommendation_logs (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  prompt_version     text    not null,           -- e.g. "recommend_v1"
  input_movie_ids    uuid[]  not null,           -- top-N movies used as taste signal
  raw_model_output   jsonb,                      -- exactly what the model returned
  suggested_titles   text[],                     -- parsed titles, post TMDB validation
  model_used         text,
  tokens_used        integer,
  estimated_cost_usd numeric(10,6)               -- hard requirement (CLAUDE.md § Coding Conventions)
);

-- ---------------------------------------------------------------------------
-- 5.3  taste_verdict_logs — same discipline, lighter feature
-- ---------------------------------------------------------------------------
create table if not exists taste_verdict_logs (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  prompt_version     text    not null,           -- e.g. "taste_verdict_v1"
  input_movie_ids    uuid[]  not null,           -- ALL rated movies (overall taste, not favorites)
  verdict_text       text,
  model_used         text,
  tokens_used        integer,
  estimated_cost_usd numeric(10,6)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Single-user app by design (SPEC § 1). The frontend key is the anon key, which
-- respects RLS — this is the concrete least-privilege demo (CLAUDE.md § Security
-- & Scope). The backend also uses the anon key: it never needs service_role.
-- These policies allow the anon role full access to the single user's data.
-- ---------------------------------------------------------------------------
alter table movies              enable row level security;
alter table recommendation_logs enable row level security;
alter table taste_verdict_logs  enable row level security;

create policy "anon full access - movies"              on movies              for all to anon using (true) with check (true);
create policy "anon full access - recommendation_logs" on recommendation_logs for all to anon using (true) with check (true);
create policy "anon full access - taste_verdict_logs"  on taste_verdict_logs  for all to anon using (true) with check (true);
