-- Missions core schema. Apply in the Supabase SQL editor or via CLI.

create extension if not exists "pgcrypto";

do $$ begin
  create type user_role as enum ('company', 'developer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type mission_status as enum ('draft', 'open', 'claimed', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type mission_visibility as enum ('public', 'private');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type claim_status as enum ('active', 'withdrawn');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type submission_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_status as enum ('pending', 'processing', 'paid', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null,
  display_name text not null,
  wallet_address text,
  country text,
  github_url text,
  linkedin_url text,
  x_url text,
  substack_url text,
  other_links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null,
  reward_amount numeric not null check (reward_amount > 0),
  reward_currency text not null default 'USDC',
  requirements text not null default '',
  required_deliverables text[] not null default '{}',
  visibility mission_visibility not null default 'public',
  status mission_status not null default 'draft',
  deadline timestamptz,
  discord_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null unique references public.missions (id) on delete cascade,
  developer_id uuid not null references public.profiles (id) on delete cascade,
  status claim_status not null default 'active',
  claimed_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  claim_id uuid not null references public.claims (id) on delete cascade,
  developer_id uuid not null references public.profiles (id) on delete cascade,
  description text not null default '',
  repository_url text,
  demo_url text,
  video_url text,
  post_urls text[] not null default '{}',
  attachments jsonb not null default '[]'::jsonb,
  status submission_status not null default 'pending',
  verification jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  submission_id uuid not null unique references public.submissions (id) on delete cascade,
  developer_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric not null,
  currency text not null default 'USDC',
  chain text not null default 'base',
  wallet_address text not null,
  transaction_hash text,
  status payment_status not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists missions_company_idx on public.missions (company_id);
create index if not exists missions_status_idx on public.missions (status);
create index if not exists submissions_mission_idx on public.submissions (mission_id);
create index if not exists claims_developer_idx on public.claims (developer_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists missions_set_updated_at on public.missions;
create trigger missions_set_updated_at
before update on public.missions
for each row execute procedure public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.claims enable row level security;
alter table public.submissions enable row level security;
alter table public.payments enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "missions_select" on public.missions;
create policy "missions_select" on public.missions
  for select using (
    (visibility = 'public' and status <> 'draft')
    or company_id = auth.uid()
    or exists (
      select 1 from public.claims c
      where c.mission_id = missions.id and c.developer_id = auth.uid()
    )
  );

drop policy if exists "missions_insert_company" on public.missions;
create policy "missions_insert_company" on public.missions
  for insert with check (
    company_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'company')
  );

drop policy if exists "missions_update_company" on public.missions;
create policy "missions_update_company" on public.missions
  for update using (company_id = auth.uid());

drop policy if exists "claims_select" on public.claims;
create policy "claims_select" on public.claims
  for select using (
    developer_id = auth.uid()
    or exists (select 1 from public.missions m where m.id = claims.mission_id and m.company_id = auth.uid())
  );

drop policy if exists "claims_insert_developer" on public.claims;
create policy "claims_insert_developer" on public.claims
  for insert with check (
    developer_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'developer')
  );

drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
  for select using (
    developer_id = auth.uid()
    or exists (select 1 from public.missions m where m.id = submissions.mission_id and m.company_id = auth.uid())
  );

drop policy if exists "submissions_insert_developer" on public.submissions;
create policy "submissions_insert_developer" on public.submissions
  for insert with check (developer_id = auth.uid());

drop policy if exists "submissions_update_developer" on public.submissions;
create policy "submissions_update_developer" on public.submissions
  for update using (developer_id = auth.uid());

drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments
  for select using (
    developer_id = auth.uid()
    or exists (select 1 from public.missions m where m.id = payments.mission_id and m.company_id = auth.uid())
  );
