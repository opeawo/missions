# Missions live demo (under 4 minutes)

Reset first so the table is clean:

```bash
npm run reset
npm run dev
```

Keep Cursor MCP connected (see README). Discord webhook optional but impressive.

## Talking track

**Line:** An agent inside Cursor can create paid work in the world. A developer can do it. The system can settle USDC.

### 1. Create from Cursor (45s)

In Cursor, on a product repo:

> Look at this repository and create a $5 Mission asking developers to build a compelling real-world example, deploy it, and write a public LinkedIn post. Required deliverables: repository, demo, linkedin, description. Make it public.

The agent calls `create_mission`. That **auto-publishes**.

Show:

- Tool result JSON with `id`, `status: open`, `url`
- The same Mission on `/missions`
- Discord `#missions` if the webhook is set (one post, never duplicated on edit)

If Discord is quiet, say the webhook is optional and keep moving.

### 2. Developer claims and submits (90s)

Sign out. Sign in as the developer (`DEMO_DEVELOPER_EMAIL`).

Open the Mission.

Point at the **developer card** after claim: name, country, GitHub, LinkedIn — who they are, not just a UUID.

Click **Claim this mission**.

Submit prepared URLs (do not code during judging):

- Description: one paragraph you already wrote
- Repository URL
- Demo URL
- LinkedIn URL in public posts

Submit. Automatic checks show Verified / URL confirmed / Could not verify / Needs company review. Say: **the company is still the final authority.**

### 3. Company approves and pays (60s)

Sign out. Sign in as the company.

Open the Mission. Show the claimant card + submission.

Click **Approve and pay**.

- Mock mode: hash `mock_…` appears immediately
- Live mode: tiny USDC on Base, hash + Basescan link

Both company and developer screens show payment status. If it fails, **Retry payout** — do not improvise a wallet transfer.

### 4. Close (20s)

Scroll the confirmation. Repeat: agent created work, human shipped proof, the protocol paid.

## If something is broken

| Symptom | Fix |
| --- | --- |
| Seeded mission missing | `npm run reset` |
| MCP cannot create | Check `MISSIONS_MCP_KEY`, `DEMO_COMPANY_EMAIL`, service role, `cwd` |
| Discord silent | Public + first publish only; `DISCORD_WEBHOOK_URL`; already has `discord_message_id` |
| Approve blocked | Developer `/me` wallet must be set |
| Live payout fails | Fund payout wallet, `PAYMENT_MODE=live`, keys present; or switch to mock |

## Do not do live

Do not build the example repo during the demo. Do not explain RLS. Do not add features. Do not open analytics.
