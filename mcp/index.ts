import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createAdminClient } from "../src/lib/supabase/admin";
import {
  claimMission,
  createMission,
  getClaimForMission,
  getMission,
  getProfileById,
  listMissions,
  listSubmissions,
  missionUrl,
  submitWork,
  toDeveloperCard,
} from "../src/lib/domain";
import { approveSubmission } from "../src/lib/domain/payments";
import { getPaymentForMission } from "../src/lib/domain/payment-queries";
import type { Actor, Profile } from "../src/lib/domain/types";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(message: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true };
}

async function profileByEmail(email: string): Promise<Profile> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`No auth user for ${email}`);
  const profile = await getProfileById(user.id);
  if (!profile) throw new Error(`No profile for ${email}`);
  return profile;
}

function asActor(profile: Profile): Actor {
  return { id: profile.id, role: profile.role, displayName: profile.display_name };
}

async function companyActor(): Promise<Actor> {
  const key = process.env.MISSIONS_MCP_KEY;
  if (!key) throw new Error("MISSIONS_MCP_KEY is not set");
  const email = process.env.DEMO_COMPANY_EMAIL;
  if (!email) throw new Error("DEMO_COMPANY_EMAIL is not set");
  return asActor(await profileByEmail(email));
}

async function developerActor(): Promise<Actor> {
  const email = process.env.DEMO_DEVELOPER_EMAIL;
  if (!email) throw new Error("DEMO_DEVELOPER_EMAIL is not set");
  return asActor(await profileByEmail(email));
}

const server = new McpServer({ name: "missions", version: "1.0.0" });

server.tool(
  "create_mission",
  "Create and immediately publish a Mission. Public missions are posted to Discord once.",
  {
    title: z.string(),
    description: z.string(),
    reward_amount: z.number(),
    currency: z.string().optional(),
    requirements: z.string().optional(),
    required_deliverables: z.array(z.string()).optional(),
    visibility: z.enum(["public", "private"]).optional(),
    deadline: z.string().optional(),
  },
  async (args) => {
    try {
      const actor = await companyActor();
      const mission = await createMission(
        actor,
        {
          title: args.title,
          description: args.description,
          reward_amount: args.reward_amount,
          currency: args.currency,
          requirements: args.requirements,
          required_deliverables: args.required_deliverables,
          visibility: args.visibility,
          deadline: args.deadline,
        },
        { autoPublish: true },
      );
      return json({
        id: mission.id,
        status: mission.status,
        url: missionUrl(mission.id),
        discord_message_id: mission.discord_message_id,
      });
    } catch (e) {
      return err(e instanceof Error ? e.message : "create_mission failed");
    }
  },
);

server.tool("get_mission", "Get one mission, including claimant identity if claimed.", { id: z.string() }, async ({ id }) => {
  try {
    const mission = await getMission(id);
    if (!mission) return err("Mission not found");
    const claim = await getClaimForMission(id);
    const developer = claim ? await getProfileById(claim.developer_id) : null;
    const payment = await getPaymentForMission(id);
    return json({
      ...mission,
      url: missionUrl(mission.id),
      claimant: developer ? toDeveloperCard(developer) : null,
      payment: payment
        ? { status: payment.status, transaction_hash: payment.transaction_hash, error: payment.error }
        : null,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "get_mission failed");
  }
});

server.tool(
  "list_missions",
  "List missions. Defaults to open.",
  { status: z.string().optional() },
  async ({ status }) => {
    try {
      const missions = await listMissions({ status: status || "open" });
      return json(
        missions.map((m) => ({
          id: m.id,
          title: m.title,
          status: m.status,
          reward_amount: m.reward_amount,
          url: missionUrl(m.id),
        })),
      );
    } catch (e) {
      return err(e instanceof Error ? e.message : "list_missions failed");
    }
  },
);

server.tool("claim_mission", "Claim a mission as the demo developer.", { mission_id: z.string() }, async ({ mission_id }) => {
  try {
    const actor = await developerActor();
    const claim = await claimMission(actor, mission_id);
    return json({ id: claim.id, mission_id, status: "claimed", url: missionUrl(mission_id) });
  } catch (e) {
    return err(e instanceof Error ? e.message : "claim_mission failed");
  }
});

server.tool(
  "submit_mission",
  "Submit proof URLs as the demo developer.",
  {
    mission_id: z.string(),
    description: z.string().optional(),
    repository_url: z.string().optional(),
    demo_url: z.string().optional(),
    post_urls: z.array(z.string()).optional(),
    video_url: z.string().optional(),
  },
  async (args) => {
    try {
      const actor = await developerActor();
      const submission = await submitWork(actor, args.mission_id, args);
      return json({
        id: submission.id,
        status: submission.status,
        url: missionUrl(args.mission_id),
        verification: submission.verification,
      });
    } catch (e) {
      return err(e instanceof Error ? e.message : "submit_mission failed");
    }
  },
);

server.tool(
  "get_submissions",
  "List submissions for a mission, with developer identity.",
  { mission_id: z.string() },
  async ({ mission_id }) => {
    try {
      const submissions = await listSubmissions(mission_id);
      const claim = await getClaimForMission(mission_id);
      const developer = claim ? await getProfileById(claim.developer_id) : null;
      return json({
        mission_id,
        claimant: developer ? toDeveloperCard(developer) : null,
        submissions: submissions.map((s) => ({
          id: s.id,
          status: s.status,
          description: s.description,
          repository_url: s.repository_url,
          demo_url: s.demo_url,
          post_urls: s.post_urls,
          video_url: s.video_url,
          verification: s.verification,
          submitted_at: s.submitted_at,
        })),
      });
    } catch (e) {
      return err(e instanceof Error ? e.message : "get_submissions failed");
    }
  },
);

server.tool(
  "approve_submission",
  "Approve a submission and pay USDC (or mock payout).",
  { submission_id: z.string() },
  async ({ submission_id }) => {
    try {
      const actor = await companyActor();
      const result = await approveSubmission(actor, submission_id);
      return json({
        submission_id: result.submission.id,
        status: result.submission.status,
        payment: {
          id: result.payment.id,
          status: result.payment.status,
          transaction_hash: result.payment.transaction_hash,
          chain: result.payment.chain,
          error: result.payment.error,
        },
      });
    } catch (e) {
      return err(e instanceof Error ? e.message : "approve_submission failed");
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
