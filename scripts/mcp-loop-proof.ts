/**
 * Exercise the complete loop through two role-scoped MCP sessions.
 * The company and developer identities come from seeded users, never from the server.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMissionsMcpServer } from "../mcp/register";
import { createAdminClient } from "../src/lib/supabase/admin";
import type { Actor, Profile } from "../src/lib/domain/types";

type Json = Record<string, unknown>;

function parseTool(result: { content: unknown; isError?: boolean }): Json {
  const content = result.content as { type: string; text?: string }[];
  const text = content.find((part) => part.type === "text")?.text;
  if (!text) throw new Error("MCP tool returned no text");
  const data = JSON.parse(text) as Json;
  if (result.isError || data.error) throw new Error(String(data.error || text));
  return data;
}

async function actorByEmail(email: string): Promise<Actor> {
  const admin = createAdminClient();
  const { data: users, error: userError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (userError) throw userError;
  const user = users.users.find((candidate) => candidate.email === email);
  if (!user) throw new Error(`Seeded user not found: ${email}`);
  const { data, error } = await admin.from("profiles").select("*").eq("id", user.id).single();
  if (error) throw error;
  const profile = data as Profile;
  return { id: profile.id, role: profile.role, displayName: profile.display_name };
}

async function connect(actor: Actor) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMissionsMcpServer(actor);
  const client = new Client({ name: `missions-proof-${actor.role}`, version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

async function main() {
  // A proof harness must never move real funds, even when production env is loaded.
  process.env.PAYMENT_MODE = "mock";
  const companyEmail = process.env.DEMO_COMPANY_EMAIL;
  const developerEmail = process.env.DEMO_DEVELOPER_EMAIL;
  if (!companyEmail || !developerEmail) {
    throw new Error("Set DEMO_COMPANY_EMAIL and DEMO_DEVELOPER_EMAIL");
  }

  const [companyActor, developerActor] = await Promise.all([
    actorByEmail(companyEmail),
    actorByEmail(developerEmail),
  ]);
  const [company, developer] = await Promise.all([
    connect(companyActor),
    connect(developerActor),
  ]);

  const companyIdentity = parseTool(
    await company.callTool({ name: "whoami", arguments: {} }),
  );
  const developerIdentity = parseTool(
    await developer.callTool({ name: "whoami", arguments: {} }),
  );
  if (companyIdentity.role !== "company" || developerIdentity.role !== "developer") {
    throw new Error("MCP sessions are not bound to the expected roles");
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const created = parseTool(
    await company.callTool({
      name: "create_mission",
      arguments: {
        title: `[MCP proof] role-scoped loop ${stamp}`,
        description:
          "Proof that two authenticated users can complete the Missions MCP transaction.",
        reward_amount: 1,
        currency: "USDC",
        requirements: "Ship a public URL that loads.",
        required_deliverables: ["description", "repository", "demo"],
        visibility: "private",
      },
    }),
  );
  const missionId = String(created.id);
  console.log("created:", JSON.stringify(created));

  const claimed = parseTool(
    await developer.callTool({
      name: "claim_mission",
      arguments: { mission_id: missionId },
    }),
  );
  console.log("claimed:", JSON.stringify(claimed));

  const submitted = parseTool(
    await developer.callTool({
      name: "submit_mission",
      arguments: {
        mission_id: missionId,
        description: "Submitted through the authenticated developer MCP session.",
        repository_url: "https://github.com/modelcontextprotocol/typescript-sdk",
        demo_url: "https://missions.cv",
      },
    }),
  );
  console.log("submitted:", JSON.stringify(submitted));

  const reviews = parseTool(
    await company.callTool({ name: "list_reviews", arguments: {} }),
  );
  const reviewRows = (reviews.reviews as { id: string }[]) ?? [];
  if (!reviewRows.some((row) => row.id === submitted.id)) {
    throw new Error("Company review inbox did not include the developer submission");
  }

  const approved = parseTool(
    await company.callTool({
      name: "approve_submission",
      arguments: { submission_id: submitted.id },
    }),
  );
  console.log("approved:", JSON.stringify(approved));

  const finalMission = parseTool(
    await company.callTool({ name: "get_mission", arguments: { id: missionId } }),
  );
  if (finalMission.status !== "completed") {
    throw new Error(`Expected completed mission, got ${String(finalMission.status)}`);
  }
  const payment = finalMission.payment as {
    status?: string;
    transaction_hash?: string;
  } | null;
  if (payment?.status !== "paid" || !payment.transaction_hash) {
    throw new Error("Expected a paid payment with a transaction hash");
  }
  console.log("final:", JSON.stringify(finalMission));

  await Promise.all([company.close(), developer.close()]);
  console.log("ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
