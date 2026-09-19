-- Organization collection wallets and the platform fee split.
-- Apply after 001_init.sql.

do $$ begin
  create type funding_status as enum ('unfunded', 'funding', 'funded', 'released');
exception when duplicate_object then null;
end $$;

-- For companies, wallet_address is the thirdweb server wallet we provision and
-- the address organizations deposit USDC into. For developers it stays the
-- payout address they enter themselves.
alter table public.profiles
  add column if not exists wallet_label text,
  add column if not exists smart_account_address text,
  add column if not exists wallet_provisioned_at timestamptz;

alter table public.missions
  add column if not exists funding_status funding_status not null default 'unfunded',
  add column if not exists platform_fee_bps integer,
  add column if not exists platform_fee_amount numeric,
  add column if not exists gross_amount numeric,
  add column if not exists fee_transaction_hash text,
  add column if not exists funded_at timestamptz;

-- Reserved balance is summed over a company's funding/funded missions.
create index if not exists missions_funding_idx on public.missions (company_id, funding_status);
