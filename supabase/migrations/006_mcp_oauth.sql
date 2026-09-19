-- OAuth 2.1 state for the hosted MCP service.
-- Apply after 005_campaigns.sql.

create table if not exists public.mcp_oauth_clients (
  client_id text primary key,
  client_name text,
  redirect_uris text[] not null,
  token_endpoint_auth_method text not null default 'none'
    check (token_endpoint_auth_method = 'none'),
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_oauth_authorization_codes (
  code_hash text primary key,
  client_id text not null references public.mcp_oauth_clients (client_id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scope text not null default 'mcp',
  resource text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists public.mcp_oauth_refresh_tokens (
  token_hash text primary key,
  client_id text not null references public.mcp_oauth_clients (client_id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  scope text not null default 'mcp',
  resource text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mcp_oauth_codes_expires_idx
  on public.mcp_oauth_authorization_codes (expires_at);
create index if not exists mcp_oauth_refresh_expires_idx
  on public.mcp_oauth_refresh_tokens (expires_at);

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_authorization_codes enable row level security;
alter table public.mcp_oauth_refresh_tokens enable row level security;

-- No public policies: OAuth state is server-only through the service-role client.
