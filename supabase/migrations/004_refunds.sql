-- Unspent mission funds are returned only to the addresses that deposited them.
-- A company cannot nominate a destination, which is what would let a shell company
-- pay USDC in at one address and take it out at another.
-- Apply after 003_mission_wallets.sql.

do $$ begin
  create type refund_status as enum ('pending', 'processing', 'sent', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  -- Always an address that previously sent USDC to the mission wallet.
  to_address text not null,
  amount numeric not null check (amount > 0),
  currency text not null default 'USDC',
  chain text not null default 'base',
  transaction_hash text,
  status refund_status not null default 'pending',
  error text,
  created_at timestamptz not null default now()
);

create index if not exists refunds_mission_idx on public.refunds (mission_id);

alter table public.refunds enable row level security;

drop policy if exists "refunds_select" on public.refunds;
create policy "refunds_select" on public.refunds
  for select using (
    exists (
      select 1 from public.missions m
      where m.id = refunds.mission_id and m.company_id = auth.uid()
    )
  );
