The right strategy is to make Cursor build **one complete transaction first**, then layer on intelligence and polish.

Your P0 is:

> **Create Mission via MCP → publish → developer claims → submits proof URLs → company approves → USDC payout**

If that works reliably, you have a hackathon project. Everything else is secondary.

## Prework before you start coding

| Prework | Priority | Why |
|---|---:|---|
| Create Supabase project | P0 | Database + auth |
| Create thirdweb project | P0 | USDC payout |
| Decide chain, I would use Base | P0 | Keep payments simple |
| Create/fund a test payout wallet | P0 | Needed for live demo |
| Create Discord server + `#missions` channel | P0 | Distribution demo |
| Create Discord bot/token | P0 | Automatic mission posting |
| Create Vercel project | P0 | Public deployment |
| Decide exact Mission fields | P0 | Avoid schema churn |
| Create 1 company account + 1 developer account | P0 | Demo personas |
| Prepare one realistic AI product/repo for the demo | P0 | Your company-side starting point |
| Prepare one completed demo/submission | P0 | Never code the mission live during judging |
| OpenAI API key | P1 | Mission drafting, verification |
| GitHub OAuth/API | P1 | Repository verification |
| Firecrawl | P2 | Useful for scraping docs/posts, not essential |
| PostHog/Sentry/Resend | P2 | Production niceties, skip until core works |

### Lock this data model before coding

A Mission needs roughly:

```text
Mission
- id
- company_id
- title
- description
- reward_amount
- reward_currency
- requirements
- required_deliverables
- visibility: public/private
- status
- deadline
- created_at
```

Submission:

```text
Submission
- id
- mission_id
- developer_id
- description
- repository_url
- demo_url
- post_urls[]
- video_url
- attachments[]
- status
- submitted_at
```

Payment:

```text
Payment
- mission_id
- submission_id
- developer_id
- amount
- currency
- wallet_address
- transaction_hash
- status
```

Do not over-design this.

# Build priorities

| Priority | Build |
|---|---|
| **P0** | Web app, mission creation, mission page, claim, submit multiple URLs, approval, thirdweb payment |
| **P0** | MCP `create_mission` so Cursor/agents can create work |
| **P0** | Discord notification when Mission goes live |
| **P0** | One polished end-to-end demo |
| **P1** | `list_missions`, `get_submissions`, `approve_submission` through MCP |
| **P1** | AI assistance drafting Mission from repo/product context |
| **P1** | Basic automatic URL/proof checking |
| **P1** | Developer/company authentication |
| **P2** | GitHub verification |
| **P2** | Social-post content verification |
| **P2** | Matching/recommendations |
| **P2** | Reputation |
| **P2** | Analytics |
| **P2** | Search/filtering |
| **Do not build** | FDE marketplace, CRM, opportunity tracking, swarm visualization, complex campaign tooling |

# Prompt 1: Give Cursor the product constitution

Start a fresh repo and give Cursor this first. Do not ask it to code yet.

```text
We are building a hackathon project called Missions.

Missions lets companies and AI agents create paid technical work for developers.

The core transaction is:

Company/agent creates Mission
→ Mission is published
→ Developer claims it
→ Developer completes the work
→ Developer submits evidence
→ Company approves
→ Developer receives USDC

A Mission is intentionally generic. There are no mission types.

A company defines:
- title
- description
- reward
- requirements
- required deliverables
- public/private
- optional deadline

Required deliverables may include:
- repository URL
- live demo URL
- LinkedIn URL
- X URL
- Substack URL
- blog URL
- video URL
- files
- written description

Submissions can contain multiple URLs.

The product must be usable through:
1. a web app
2. an MCP server so Cursor or another AI agent can call it

New public Missions should optionally be posted to Discord.

Approved submissions should trigger a USDC payment using thirdweb.

Technology:
- Next.js / TypeScript
- Supabase
- thirdweb
- Discord API
- MCP
- Vercel

Do not add features outside this specification unless explicitly requested.

First:
1. propose the architecture
2. propose the database schema
3. propose the routes
4. propose the MCP tools
5. identify the shortest possible vertical slice

DO NOT IMPLEMENT YET.
```

Review what it proposes. Simplify anything that looks unnecessary.

# Prompt 2: Build the boring foundation

Once architecture looks right:

```text
Implement only the foundation for the vertical slice.

Set up:
- Next.js TypeScript application
- Supabase client
- database schema and migrations
- basic company and developer users
- Missions table
- Claims table
- Submissions table
- Payments table

Create seed data for:
- one AI company
- one developer
- one sample Mission

Do not implement Discord, MCP, thirdweb, AI, analytics or advanced styling yet.

Create a README explaining the architecture and environment variables.

Stop when I can run the application locally and see the seeded Mission.
```

Get this running before moving on.

# Prompt 3: Build the complete web transaction

This is your most important prompt.

```text
Now implement the complete Mission lifecycle through the web interface.

Company:
- create Mission
- edit Mission
- publish Mission
- see claimed developers
- see submissions
- approve or reject submission

Developer:
- browse open Missions
- open Mission
- claim Mission
- submit completed work

Submission must support:
- description
- repository URL
- demo URL
- multiple public post URLs
- video URL
- optional attachments

Mission creator can specify which deliverables are required.

Enforce required deliverables before allowing submission.

For payment, do NOT integrate thirdweb yet.
On approval, create a payment record with status "pending".

Prioritize functionality over visual polish.

Definition of done:
I can create a Mission as Company A, claim it as Developer B, submit GitHub + demo + LinkedIn URLs, approve the submission as Company A, and see a pending payment.
```

Do not move on until that loop works.

# Prompt 4: Make Missions callable

Now build the interesting hackathon piece.

```text
Add an MCP server for Missions.

Expose these tools:

create_mission
get_mission
list_missions
claim_mission
submit_mission
get_submissions
approve_submission

The MCP tools must use the exact same backend/database as the web app.

Do not duplicate business logic.

create_mission should accept:
- title
- description
- reward amount
- currency
- requirements
- required deliverables
- visibility
- optional deadline

submit_mission must support:
- description
- repository_url
- demo_url
- post_urls array
- video_url

Return concise structured results suitable for an AI agent.

Include setup instructions so I can connect this MCP server to Cursor.

Definition of done:
From Cursor, I can create a Mission and immediately see the same Mission on the web app.
```

**That last sentence is one of your hackathon wow moments.**

# Prompt 5: Add Discord distribution

```text
Add Discord distribution.

Whenever a public Mission is published, send a formatted message to a configured Discord #missions channel.

Message should include:

NEW MISSION
Title
Short description
Reward
Required deliverables
Deadline if present
Link to Mission

Do not build a complex Discord bot experience yet.

Only implement reliable outbound Mission posting.

Prevent duplicate Discord posts when a Mission is edited.
```

Now your live demonstration becomes:

**Cursor → MCP → Mission created → Discord notification**

That will look excellent.

# Prompt 6: Add real payment

Only now touch thirdweb.

```text
Integrate thirdweb for USDC payouts.

Requirement:
When a company approves a developer submission, an authorized server-side action can pay the developer's configured wallet address in USDC.

Requirements:
- payment must never originate from client-side code
- prevent duplicate payouts
- persist transaction hash
- persist chain
- persist amount
- persist payment status
- show failed payouts clearly
- show successful payout confirmation to developer and company

Create a safe test mode for development.

Do not redesign the Mission workflow.

Definition of done:
Approve submission → USDC transaction occurs → transaction hash appears in Missions.
```

For the demo, use a tiny real amount if practical. The visual event matters more than paying $300 for the demonstration.

# Prompt 7: Add lightweight verification

Do not attempt to build a fraud-detection company over the weekend.

```text
Add basic automated submission verification.

For every submitted URL:
- validate URL format
- attempt to confirm URL is reachable
- classify URL type: GitHub, LinkedIn, X, Substack, blog, demo, video, other
- record verification status

For URLs whose content can be retrieved:
- confirm that meaningful content exists
- optionally check whether the Mission product/name appears

Never claim content has been verified when the platform blocks access.

Display:
Verified
URL confirmed
Could not automatically verify
Needs company review

Company approval remains the final authority.
```

# Prompt 8: Add AI only where it improves the demo

Now let the model help create Missions.

```text
Add AI-assisted Mission creation.

The user can provide:
- product website
- documentation
- repository context
- free-text instruction

Generate a proposed Mission containing:
- concise title
- clear description
- developer requirements
- required deliverables
- suggested reward placeholder

The company must review and explicitly publish it.

Keep this as an assistant to create_mission, not a separate product flow.
```

Inside Cursor, this can feel particularly strong because the agent already has repo context.

You could simply say:

> Look at this repository and create a $400 Mission asking developers to build a compelling real-world example and publicly write about what they built.

MCP handles the actual creation.

# Final prompt: Hackathon hardening

Give Cursor this several hours before judging:

```text
We are entering demo-hardening mode.

Do not add any new product features.

Audit the full demo journey:

1. Create Mission through MCP from Cursor
2. Mission appears in web app
3. Mission posts to Discord
4. Developer claims Mission
5. Developer submits repository, demo and public post URLs
6. Company reviews submission
7. Company approves
8. USDC payout executes
9. Transaction confirmation appears

Find and fix anything that could make this sequence fail during a live demonstration.

Add:
- loading states
- useful error states
- retry handling
- seed/reset script
- demo accounts
- realistic demo data
- clear success screens

Prioritize reliability above architecture purity.

Give me a DEMO.md containing the exact clicks, commands and talking points required to demonstrate the product in under 4 minutes.
```

That final instruction is important.

## One rule for the entire hackathon

When you're tempted to add something, ask:

> **Does this make the Cursor → Mission → Discord → Developer → Submission → USDC moment better?**

If not, postpone it.

Your strongest technical demonstration is not the AI-generated mission description. It is that **an agent inside Cursor can cause real paid work to appear in the world, a human can execute it, and the system can settle the transaction.**

That is the thing to make bulletproof.