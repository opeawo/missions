-- Campaigns: the URL-first creation flow. A campaign owns a budget, a wallet, and
-- a set of AI-proposed missions. Additive only — existing missions keep working
-- without a campaign.
-- Apply after 004_refunds.sql.

do $$ begin
  create type campaign_status as enum ('draft', 'live', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.profiles (id) on delete cascade,
  product_url text not null,
  product_name text not null,
  product_summary text not null default '',
  geography text not null default 'global',
  developer_target_count integer not null default 25 check (developer_target_count > 0),
  total_budget numeric not null check (total_budget > 0),
  currency text not null default 'USDC',
  status campaign_status not null default 'draft',
  -- Same funding lifecycle as missions: the campaign wallet collects the budget,
  -- the platform fee leaves at funding, rewards are paid from what remains.
  funding_status funding_status not null default 'unfunded',
  deposit_address text,
  deposit_wallet_label text,
  deposit_smart_account_address text,
  platform_fee_bps integer,
  platform_fee_amount numeric,
  gross_amount numeric,
  fee_transaction_hash text,
  funded_at timestamptz,
  -- Full AI analysis: product understanding, mission ideas, pricing snapshot.
  ai_plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.missions
  add column if not exists campaign_id uuid references public.campaigns (id) on delete set null;

create index if not exists campaigns_company_idx on public.campaigns (company_id);
create index if not exists missions_campaign_idx on public.missions (campaign_id);

alter table public.campaigns enable row level security;

drop policy if exists "campaigns_select_own" on public.campaigns;
create policy "campaigns_select_own" on public.campaigns
  for select using (company_id = auth.uid());
