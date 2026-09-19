# Missions

Companies and AI agents create paid technical work. Developers claim it, submit proof, and get USDC on Base.

Core loop:

`Cursor (MCP) → published Mission → Discord → developer claims → proof URLs → company approves → USDC`

## Architecture

- **Next.js App Router** — web UI and server actions
- **`src/lib/domain`** — one status machine used by the web app and MCP
- **Supabase** — Auth, Postgres, RLS
- **MCP stdio server** (`mcp/index.ts`) — Cursor tools; service role + demo company identity
- **Discord webhook** — one outbound post when a public Mission first goes `open`
- **thirdweb** — server-side USDC transfer on Base (`PAYMENT_MODE=mock` until you are ready)

Do not duplicate business rules in the MCP server.

## Setup

1. Create a Supabase project. In the SQL editor, run [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql).
2. Copy env:

```bash
cp .env.example .env.local
```

3. Fill at least:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (`http://localhost:3000` locally)
- `DEMO_COMPANY_EMAIL` / `DEMO_COMPANY_PASSWORD`
- `DEMO_DEVELOPER_EMAIL` / `DEMO_DEVELOPER_PASSWORD`
- `DEMO_DEVELOPER_WALLET` (Base address that should receive USDC)
- `MISSIONS_MCP_KEY` (any long random string; Cursor must use the same value)
- `PAYMENT_MODE=mock` until live payouts
- Optional: `DISCORD_WEBHOOK_URL`, `THIRDWEB_SECRET_KEY`, `PAYOUT_WALLET_PRIVATE_KEY`, `OPENAI_API_KEY`

4. Create demo identities and the sample Mission:

```bash
npm run seed
```

This uses the Auth admin API to create the company and developer users if they do not exist, fills the developer profile (GitHub, LinkedIn, country, wallet), and inserts one open Mission.

5. Run the app:

```bash
npm run dev
```

Open `/missions` and you should see **Ship a public Northstar example**.

Sign in at `/login` with the demo emails.

Reset the demo (deletes missions/claims/submissions/payments, reseeds the sample Mission, keeps users):

```bash
npm run reset
```

## Cursor MCP

Add to Cursor MCP settings (project or user):

```json
{
  "mcpServers": {
    "missions": {
      "command": "npx",
      "args": ["tsx", "mcp/index.ts"],
      "cwd": "/ABSOLUTE/PATH/TO/missions",
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "same as .env.local",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "same",
        "SUPABASE_SERVICE_ROLE_KEY": "same",
        "NEXT_PUBLIC_APP_URL": "http://localhost:3000",
        "DEMO_COMPANY_EMAIL": "company@missions.dev",
        "DEMO_DEVELOPER_EMAIL": "developer@missions.dev",
        "MISSIONS_MCP_KEY": "same as .env.local",
        "DISCORD_WEBHOOK_URL": "optional",
        "PAYMENT_MODE": "mock"
      }
    }
  }
}
```

Or run `npm run mcp` after env is loaded.

Tools: `create_mission` (auto-publishes), `get_mission`, `list_missions`, `claim_mission`, `submit_mission`, `get_submissions`, `approve_submission`.

The live demo story is: agent creates work (`create_mission`), human claims and submits on the web, company approves (web or `approve_submission`).

## Payments

- `PAYMENT_MODE=mock` writes a `mock_*` transaction hash so the UI works without chain funds.
- `PAYMENT_MODE=live` sends USDC on Base via thirdweb from `PAYOUT_WALLET_PRIVATE_KEY`.
- Payouts never run in the browser. Duplicate payouts are blocked by a unique `payments.submission_id`.
- Failed payouts stay visible; use **Retry payout**.

Default USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

## Deploy

Vercel: set the same env vars, `NEXT_PUBLIC_APP_URL` to the production URL, keep `PAYMENT_MODE=mock` until the payout wallet is funded.
