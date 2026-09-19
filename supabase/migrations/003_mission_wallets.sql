-- Collection wallets are per mission, not per organization: one mission's funds are
-- never held in a wallet shared with another mission or another company.
-- Apply after 002_org_wallets.sql.

alter table public.missions
  add column if not exists deposit_address text,
  add column if not exists deposit_wallet_label text,
  add column if not exists deposit_smart_account_address text;

-- Organizations no longer hold a wallet of their own. On profiles, wallet_address
-- goes back to meaning the developer's payout address.
alter table public.profiles
  drop column if exists wallet_label,
  drop column if exists smart_account_address,
  drop column if exists wallet_provisioned_at;
