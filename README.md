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
- **thirdweb** — server wallets on Base: one collection wallet per mission, USDC transfers signed without a private key (`PAYMENT_MODE=mock` until you are ready)

Do not duplicate business rules in the MCP server.

## Setup

1. Create a Supabase project. In the SQL editor, run the migrations in
   [`supabase/migrations`](supabase/migrations) in order.
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
- `PAYMENT_MODE=mock` until live payouts. Only `live` sends real USDC on Base; any other value (including unset) stays mock.
- Optional: `DISCORD_WEBHOOK_URL`, `THIRDWEB_SECRET_KEY`, `PLATFORM_MASTER_WALLET_ADDRESS`, `OPENAI_API_KEY`

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

The product loop is meant to be driven as tool calls, not a marketing site:

`create_mission → list/get → claim_mission → submit_mission → list_reviews / get_submissions → approve_submission | reject_submission → get_payment`

Copy [`.cursor/mcp.json.example`](.cursor/mcp.json.example) to `.cursor/mcp.json` (gitignored) and point `cwd` at this checkout. `npm run mcp` loads `.env.local`, including production Supabase on this machine, so the tools write to the live service. Mission links use `NEXT_PUBLIC_APP_URL` (default `https://missions.cv`).

```json
{
  "mcpServers": {
    "missions": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/ABSOLUTE/PATH/TO/missions"
    }
  }
}
```

If you would rather inline env instead of `--env-file=.env.local`, set at least:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (`https://missions.cv` against production)
- `DEMO_COMPANY_EMAIL`
- `DEMO_DEVELOPER_EMAIL`
- `MISSIONS_MCP_KEY`
- `PAYMENT_MODE` (`mock` until live USDC)

Reload MCP in Cursor after saving the config.

**Hosted / other harnesses.** Stdio is what Cursor runs today. Streamable HTTP lives at `POST https://missions.cv/api/mcp` with `Authorization: Bearer YOUR_MISSIONS_MCP_KEY` (same value as `MISSIONS_MCP_KEY`). That route is in this repo; it is only on production after the next deploy that includes it. Until then, Cursor should use the stdio config above.

```json
{
  "mcpServers": {
    "missions": {
      "url": "https://missions.cv/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MISSIONS_MCP_KEY"
      }
    }
  }
}
```

Tools: `create_mission` (auto-publishes), `get_mission`, `list_missions`, `claim_mission`, `submit_mission`, `get_submissions`, `list_reviews`, `approve_submission`, `reject_submission`, `retry_payout`, `get_payment`.

Prove the loop against the env in `.env.local`:

```bash
npm run mcp:proof
```

## Payments

Money flows through thirdweb **server wallets**, so no private key is ever stored. The project
secret key authorises signing and thirdweb Vault holds the keys.

**Wallets**

- **One wallet per mission**, not per organization, so no wallet ever holds funds for more than one
  mission. Each is labelled `mission:<mission id>` and created with the mission; the company sees its
  deposit address on the mission page. The same label always resolves to the same wallet.
- One platform treasury receives every fee. Create a server wallet in the thirdweb dashboard
  (**Wallets → Server wallets**) and put its address in `PLATFORM_MASTER_WALLET_ADDRESS`.
- Deposit to the address the app shows (`missions.deposit_address`). `createServerWallet` also returns
  a separate predicted smart account address, stored as `missions.deposit_smart_account_address` for
  reference only.

**The 15% cut**

`PLATFORM_FEE_BPS` (default `1500`) is charged **on top** of the reward, so the developer always
receives the full amount. A 400 USDC mission costs the organization 460 USDC: 60 to the master
wallet, 400 to the developer. Amounts are computed in integer micro-USDC, and the truncating
division favours the organization by at most 0.000001 USDC.

**Lifecycle**

1. Creating a mission provisions its wallet. The organization deposits reward + fee into it.
2. Publishing calls `fundMission`, which transfers the fee to the master wallet, leaving exactly the
   reward behind, and marks the mission `funded`. Publishing fails with the exact shortfall if the
    is short.
3. Approving a submission sends the reward from the mission  to the developer and marks the
   mission `released`.

Because each  holds a single mission's money, funding needs no reserved-balance accounting: the
wallet balance *is* that mission's escrow. Approval also funds the mission first if it was never
charged, so the fee is collected on every payout. Funding is idempotent, and claiming the row before
transferring means concurrent publishes cannot double-charge.

**Returning unspent funds**

Money leaves a mission wallet in exactly three directions: the platform fee to the master wallet, the
reward to the developer, and unspent balance **back to the address that deposited it**. There is no
company-nominated refund or withdrawal address, deliberately. Letting a company pay USDC in at one
address and take it out at another is the standard shape of a laundering rail, and the platform would
be the one providing it.

So refunds are reconstructed from the chain rather than from user input. `usdcDepositsBySender` reads
USDC `Transfer` logs into the mission wallet and totals them per sender; the sweep then returns the
unspent balance to those senders, pro rata to what each sent.

Two rules keep this honest:

- **No address receives more than it deposited.** The deposit history read is capped at 500 transfers,
  and without this cap a truncated history would inflate each share.
- **Untraceable balance stays put.** If the unspent amount exceeds what can be attributed to known
  depositors, the remainder stays in the mission wallet rather than being pushed to whichever address
  happens to be known. thirdweb holds the key, so nothing is lost.

Sweeping is allowed when the wallet holds more than the mission still owes: the whole balance before
publishing or after the developer is paid, and the surplus above the reward while a mission is live.
Every outbound refund is recorded in the `refunds` table for audit, including failures.

- `PAYMENT_MODE=mock` records fees and payouts with `mock_*` hashes and moves no USDC.
- `PAYMENT_MODE=live` requires `THIRDWEB_SECRET_KEY` and `PLATFORM_MASTER_WALLET_ADDRESS`.
- Payouts never run in the browser. Duplicate payouts are blocked by a unique `payments.submission_id`.
- Failed payouts stay visible; use **Retry payout**.

Default USDC on Base: `0x63f36e5eF1E6a5Ed015ebb7AE43100141eE87e7D`.

## Deploy

Vercel: set the same env vars, `NEXT_PUBLIC_APP_URL` to the production URL, keep `PAYMENT_MODE=mock` until the master wallet exists and organizations have deposited USDC.
