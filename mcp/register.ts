import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createAdminClient } from "../src/lib/supabase/admin";
import {
  approveSubmission,
  claimMission,
  createMission,
  getClaimForMission,
  getMission,
  getPaymentForMission,
  getPaymentForSubmission,
  getProfileById,
  listCompanySubmissions,
  listMissions,
  listSubmissions,
  missionUrl,
  rejectSubmission,
  retryPayout,
  submitWork,
  toDeveloperCard,
} from "../src/lib/domain";
import type { Actor, Payment, Profile, Submission } from "../src/lib/domain/types";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(message: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true };
}

function paymentSummary(payment: Payment | null) {
  if (!payment) return null;
  return {
    id: payment.id,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    chain: payment.chain,
    wallet_address: payment.wallet_address,
    transaction_hash: payment.transaction_hash,
    error: payment.error,
  };
}

function submissionSummary(submission: Submission) {
  return {
    id: submission.id,
    status: submission.status,
    description: submission.description,
    repository_url: submission.repository_url,
    demo_url: submission.demo_url,
    post_urls: submission.post_urls,
    video_url: submission.video_url,
    verification: submission.verification,
    submitted_at: submission.submitted_at,
  };
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

/**
 * Shared tool surface for stdio (Cursor) and Streamable HTTP (`/api/mcp`).
 * Business rules stay in `src/lib/domain` — this file only maps tools onto that API.
 */
export function createMissionsMcpServer(): McpServer {
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    process.env.NEXT_PUBLIC_APP_URL = "https://missions.cv";
  }

  const server = new McpServer({ name: "missions", version: "1.0.0" });

  server.tool(
    "create_mission",
    "Create and immediately publish paid work as the demo company. Public missions are posted to Discord once.",
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
          title: mission.title,
          status: mission.status,
          funding_status: mission.funding_status,
          reward_amount: mission.reward_amount,
          reward_currency: mission.reward_currency,
          url: missionUrl(mission.id),
          discord_message_id: mission.discord_message_id,
          payment_mode: process.env.PAYMENT_MODE === "live" ? "live" : "mock",
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : "create_mission failed");
      }
    },
  );

  server.tool(
    "get_mission",
    "Get one mission: claimant, submissions, and payout status.",
    { id: z.string() },
    async ({ id }) => {
      try {
        const mission = await getMission(id);
        if (!mission) return err("Mission not found");
        const claim = await getClaimForMission(id);
        const developer = claim ? await getProfileById(claim.developer_id) : null;
        const [payment, submissions] = await Promise.all([
          getPaymentForMission(id),
          listSubmissions(id),
        ]);
        return json({
          id: mission.id,
          title: mission.title,
          description: mission.description,
          status: mission.status,
          funding_status: mission.funding_status,
          reward_amount: mission.reward_amount,
          reward_currency: mission.reward_currency,
          required_deliverables: mission.required_deliverables,
          visibility: mission.visibility,
          url: missionUrl(mission.id),
          claimant: developer ? toDeveloperCard(developer) : null,
          submissions: submissions.map(submissionSummary),
          payment: paymentSummary(payment),
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : "get_mission failed");
      }
    },
  );

  server.tool(
    "list_missions",
    "List missions. Defaults to open. Pass status=all for every status, or claimed/completed/draft.",
    { status: z.string().optional() },
    async ({ status }) => {
      try {
        const filter = !status || status === "open" ? { status: "open" } : status === "all" ? {} : { status };
        const missions = await listMissions(filter);
        return json(
          missions.map((m) => ({
            id: m.id,
            title: m.title,
            status: m.status,
            funding_status: m.funding_status,
            reward_amount: m.reward_amount,
            reward_currency: m.reward_currency,
            url: missionUrl(m.id),
          })),
        );
      } catch (e) {
        return err(e instanceof Error ? e.message : "list_missions failed");
      }
    },
  );

  server.tool(
    "claim_mission",
    "Claim a mission as the demo developer.",
    { mission_id: z.string() },
    async ({ mission_id }) => {
      try {
        const actor = await developerActor();
        const claim = await claimMission(actor, mission_id);
        return json({ id: claim.id, mission_id, status: "claimed", url: missionUrl(mission_id) });
      } catch (e) {
        return err(e instanceof Error ? e.message : "claim_mission failed");
      }
    },
  );

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
    "List submissions for a mission, with developer identity and payout if any.",
    { mission_id: z.string() },
    async ({ mission_id }) => {
      try {
        const submissions = await listSubmissions(mission_id);
        const claim = await getClaimForMission(mission_id);
        const developer = claim ? await getProfileById(claim.developer_id) : null;
        const withPayments = await Promise.all(
          submissions.map(async (s) => ({
            ...submissionSummary(s),
            payment: paymentSummary(await getPaymentForSubmission(s.id)),
          })),
        );
        return json({
          mission_id,
          url: missionUrl(mission_id),
          claimant: developer ? toDeveloperCard(developer) : null,
          submissions: withPayments,
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : "get_submissions failed");
      }
    },
  );

  server.tool(
    "list_reviews",
    "Company review inbox: submissions across this company's missions. Defaults to pending.",
    { status: z.enum(["pending", "approved", "rejected", "all"]).optional() },
    async ({ status }) => {
      try {
        const actor = await companyActor();
        const rows = await listCompanySubmissions(actor.id);
        const wanted = status ?? "pending";
        const filtered = wanted === "all" ? rows : rows.filter((row) => row.status === wanted);
        const reviews = await Promise.all(
          filtered.map(async (row) => ({
            ...submissionSummary(row),
            mission_id: row.mission_id,
            mission_title: row.mission_title,
            url: missionUrl(row.mission_id),
            payment: paymentSummary(await getPaymentForSubmission(row.id)),
          })),
        );
        return json({ status: wanted, reviews });
      } catch (e) {
        return err(e instanceof Error ? e.message : "list_reviews failed");
      }
    },
  );

  server.tool(
    "approve_submission",
    "Approve a submission and pay USDC on Base, or record a mock payout when PAYMENT_MODE is not live.",
    { submission_id: z.string() },
    async ({ submission_id }) => {
      try {
        const actor = await companyActor();
        const result = await approveSubmission(actor, submission_id);
        return json({
          submission_id: result.submission.id,
          status: result.submission.status,
          payment: paymentSummary(result.payment),
          payment_mode: process.env.PAYMENT_MODE === "live" ? "live" : "mock",
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : "approve_submission failed");
      }
    },
  );

  server.tool(
    "reject_submission",
    "Reject a pending submission as the demo company. The mission stays claimed so the developer can resubmit.",
    { submission_id: z.string() },
    async ({ submission_id }) => {
      try {
        const actor = await companyActor();
        const submission = await rejectSubmission(actor, submission_id);
        return json({
          submission_id: submission.id,
          status: submission.status,
          mission_id: submission.mission_id,
          url: missionUrl(submission.mission_id),
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : "reject_submission failed");
      }
    },
  );

  server.tool(
    "retry_payout",
    "Retry a failed USDC payout (or mock payout) for a payment id.",
    { payment_id: z.string() },
    async ({ payment_id }) => {
      try {
        const actor = await companyActor();
        const payment = await retryPayout(actor, payment_id);
        return json({
          payment: paymentSummary(payment),
          payment_mode: process.env.PAYMENT_MODE === "live" ? "live" : "mock",
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : "retry_payout failed");
      }
    },
  );

  server.tool(
    "get_payment",
    "Inspect the latest payout for a mission, or the payout tied to a submission.",
    {
      mission_id: z.string().optional(),
      submission_id: z.string().optional(),
    },
    async ({ mission_id, submission_id }) => {
      try {
        if (!mission_id && !submission_id) {
          return err("Pass mission_id or submission_id");
        }
        const payment = submission_id
          ? await getPaymentForSubmission(submission_id)
          : await getPaymentForMission(mission_id!);
        if (!payment) return json({ payment: null, payment_mode: process.env.PAYMENT_MODE === "live" ? "live" : "mock" });
        const mission = await getMission(payment.mission_id);
        return json({
          payment: paymentSummary(payment),
          mission_id: payment.mission_id,
          url: mission ? missionUrl(mission.id) : null,
          mission_status: mission?.status ?? null,
          payment_mode: process.env.PAYMENT_MODE === "live" ? "live" : "mock",
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : "get_payment failed");
      }
    },
  );

  return server;
}
