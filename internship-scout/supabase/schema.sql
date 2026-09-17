-- ============================================================================
-- fyt — Supabase schema
-- Run this whole file in the Supabase SQL editor (Dashboard → SQL → New query).
-- It is idempotent: safe to re-run.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Admin allow-list. The backend ALSO checks ADMIN_EMAILS in its env, so this
-- table only needs to be right for RLS-level admin reads from the browser.
-- ----------------------------------------------------------------------------
create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.admin_emails (email)
values ('1yawarabbas1@gmail.com')
on conflict (email) do nothing;

-- ----------------------------------------------------------------------------
-- profiles — extends auth.users. Credits + plan live here.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  is_admin boolean not null default false,
  search_credits integer not null default 10,
  cover_letter_credits integer not null default 3,
  last_active_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

-- Create a profile row the moment a user signs up (email/password or OAuth).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, is_admin, search_credits, cover_letter_credits)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    exists (select 1 from public.admin_emails a where lower(a.email) = lower(coalesce(new.email, ''))),
    10,
    3
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- user_profiles — the plain-English context and what Claude parsed from it.
-- One row per user.
-- ----------------------------------------------------------------------------
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  raw_context text,
  context_hash text,
  parsed_profile jsonb,
  cv_url text,
  cv_filename text,
  cv_parsed jsonb,
  cv_suggestions jsonb,
  generated_cv jsonb,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- job_cache — scraped results cached for 6 hours per (keywords, location).
-- ----------------------------------------------------------------------------
create table if not exists public.job_cache (
  id uuid primary key default gen_random_uuid(),
  keywords_hash text not null,
  keywords text[] not null default '{}',
  location text not null default '',
  jobs jsonb not null default '[]'::jsonb,
  hit_count integer not null default 0,
  scraped_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (keywords_hash, location)
);

create index if not exists job_cache_expires_idx on public.job_cache (expires_at);

-- ----------------------------------------------------------------------------
-- search_runs — one row per search. Background job status lives here so the
-- frontend can poll progress instead of blocking on a 60-120s request.
-- ----------------------------------------------------------------------------
create table if not exists public.search_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  profile jsonb not null,
  keywords text[] not null default '{}',
  location text not null default '',
  status text not null default 'queued' check (status in ('queued', 'scraping', 'matching', 'done', 'error')),
  stage text,
  progress integer not null default 0,
  cache_hit boolean not null default false,
  jobs jsonb not null default '[]'::jsonb,
  total integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists search_runs_user_idx on public.search_runs (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- saved_jobs
-- ----------------------------------------------------------------------------
create table if not exists public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id text not null,
  job_data jsonb not null,
  notes text,
  saved_at timestamptz not null default now(),
  unique (user_id, job_id)
);

-- ----------------------------------------------------------------------------
-- job_details — full description fetched lazily from the job page (7 day cache)
-- ----------------------------------------------------------------------------
create table if not exists public.job_details (
  job_id text primary key,
  url text not null,
  description text,
  fetched_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- company_research — Claude + web search output, cached per company/role.
-- ----------------------------------------------------------------------------
create table if not exists public.company_research (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  company text not null,
  job_title text,
  research jsonb not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- cover_letters
-- ----------------------------------------------------------------------------
create table if not exists public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id text,
  job_title text not null,
  company text not null,
  letter_text text not null,
  tailored boolean not null default false,
  cv_suggestions jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cover_letters_user_idx on public.cover_letters (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- feedback
-- ----------------------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  message text,
  page text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- credit_log — every consumed credit. Daily limits are computed from this.
-- ----------------------------------------------------------------------------
create table if not exists public.credit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('search', 'cover_letter', 'refund_search', 'refund_cover_letter')),
  credits_used integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists credit_log_user_day_idx on public.credit_log (user_id, action, created_at desc);

-- ----------------------------------------------------------------------------
-- llm_usage — token accounting for the admin cost chart.
-- ----------------------------------------------------------------------------
create table if not exists public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists llm_usage_created_idx on public.llm_usage (created_at desc);

-- ----------------------------------------------------------------------------
-- waitlist — Pro "coming soon" emails.
-- ----------------------------------------------------------------------------
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  plan text not null default 'pro_monthly',
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- consume_credit — atomic daily-limit + balance check for free users.
-- Pro users are never charged. Returns json {ok, reason, remaining, used_today}.
-- ----------------------------------------------------------------------------
create or replace function public.consume_credit(
  p_user_id uuid,
  p_action text,
  p_daily_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_balance integer;
  v_used_today integer;
begin
  select plan into v_plan from public.profiles where id = p_user_id for update;
  if v_plan is null then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  if v_plan = 'pro' then
    insert into public.credit_log (user_id, action, credits_used) values (p_user_id, p_action, 0);
    return jsonb_build_object('ok', true, 'remaining', null, 'used_today', null, 'plan', 'pro');
  end if;

  select count(*) into v_used_today
  from public.credit_log
  where user_id = p_user_id
    and action = p_action
    and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';

  if v_used_today >= p_daily_limit then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit', 'used_today', v_used_today, 'limit', p_daily_limit);
  end if;

  if p_action = 'search' then
    select search_credits into v_balance from public.profiles where id = p_user_id;
  else
    select cover_letter_credits into v_balance from public.profiles where id = p_user_id;
  end if;

  if v_balance <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_credits', 'remaining', 0, 'used_today', v_used_today);
  end if;

  if p_action = 'search' then
    update public.profiles set search_credits = search_credits - 1 where id = p_user_id;
  else
    update public.profiles set cover_letter_credits = cover_letter_credits - 1 where id = p_user_id;
  end if;

  insert into public.credit_log (user_id, action, credits_used) values (p_user_id, p_action, 1);

  return jsonb_build_object('ok', true, 'remaining', v_balance - 1, 'used_today', v_used_today + 1, 'limit', p_daily_limit, 'plan', 'free');
end;
$$;

-- Refund one credit (used when a search fails on our side, never the user's).
create or replace function public.refund_credit(p_user_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select plan from public.profiles where id = p_user_id) = 'pro' then
    return;
  end if;
  if p_action = 'search' then
    update public.profiles set search_credits = search_credits + 1 where id = p_user_id;
    insert into public.credit_log (user_id, action, credits_used) values (p_user_id, 'refund_search', -1);
  else
    update public.profiles set cover_letter_credits = cover_letter_credits + 1 where id = p_user_id;
    insert into public.credit_log (user_id, action, credits_used) values (p_user_id, 'refund_cover_letter', -1);
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Storage bucket for uploaded CVs (private; backend signs URLs).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cvs', 'cvs', false, 10485760,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Row Level Security. The FastAPI backend uses the service-role key and
-- bypasses RLS; these policies protect direct browser access via the anon key.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

alter table public.profiles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.job_cache enable row level security;
alter table public.search_runs enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.job_details enable row level security;
alter table public.company_research enable row level security;
alter table public.cover_letters enable row level security;
alter table public.feedback enable row level security;
alter table public.credit_log enable row level security;
alter table public.llm_usage enable row level security;
alter table public.waitlist enable row level security;
alter table public.admin_emails enable row level security;

drop policy if exists "profiles: own read" on public.profiles;
create policy "profiles: own read" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles: own update (safe columns)" on public.profiles;
create policy "profiles: own update (safe columns)" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "user_profiles: own" on public.user_profiles;
create policy "user_profiles: own" on public.user_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "search_runs: own read" on public.search_runs;
create policy "search_runs: own read" on public.search_runs
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "saved_jobs: own" on public.saved_jobs;
create policy "saved_jobs: own" on public.saved_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cover_letters: own read" on public.cover_letters;
create policy "cover_letters: own read" on public.cover_letters
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "feedback: insert own" on public.feedback;
create policy "feedback: insert own" on public.feedback
  for insert with check (auth.uid() = user_id);

drop policy if exists "feedback: admin read" on public.feedback;
create policy "feedback: admin read" on public.feedback
  for select using (public.is_admin());

drop policy if exists "credit_log: own read" on public.credit_log;
create policy "credit_log: own read" on public.credit_log
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "llm_usage: admin read" on public.llm_usage;
create policy "llm_usage: admin read" on public.llm_usage
  for select using (public.is_admin());

drop policy if exists "job_cache: admin read" on public.job_cache;
create policy "job_cache: admin read" on public.job_cache
  for select using (public.is_admin());

drop policy if exists "waitlist: public insert" on public.waitlist;
create policy "waitlist: public insert" on public.waitlist
  for insert with check (true);

drop policy if exists "admin_emails: admin read" on public.admin_emails;
create policy "admin_emails: admin read" on public.admin_emails
  for select using (public.is_admin());

-- Storage: users can read their own CVs directly if they ever need to.
drop policy if exists "cvs: own read" on storage.objects;
create policy "cvs: own read" on storage.objects
  for select using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Protect plan/credits from client-side edits: only the service role may change them.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    return new;
  end if;
  new.plan := old.plan;
  new.is_admin := old.is_admin;
  new.search_credits := old.search_credits;
  new.cover_letter_credits := old.cover_letter_credits;
  new.email := old.email;
  return new;
end;
$$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- Housekeeping helper: purge expired cache rows (call from a cron or manually).
create or replace function public.purge_expired_job_cache()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  delete from public.job_cache where expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
