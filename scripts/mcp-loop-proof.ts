/**
 * Exercise create → claim → submit → review → payout through the MCP stdio server
 * against whatever Supabase `.env.local` points at (production on this machine).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type Json = Record<string, unknown>;

function parseTool(result: { content: unknown; isError?: boolean }): Json {
  const content = result.content as { type: string; text?: string }[];
  const text = content.find((part) => part.type === "text")?.text;
  if (!text) throw new Error("MCP tool returned no text");
  const data = JSON.parse(text) as Json;
  if (result.isError || data.error) {
    throw new Error(String(data.error || text));
  }
  return data;
}

async function main() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "--env-file=.env.local", "mcp/index.ts"],
    cwd: root,
    stderr: "pipe",
  });

  const client = new Client({ name: "missions-mcp-proof", version: "1.0.0" });
  await client.connect(transport);

  const listed = await client.listTools();
  const tools = listed.tools.map((t) => t.name).sort();
  console.log("tools:", tools.join(", "));

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const created = parseTool(
    await client.callTool({
      name: "create_mission",
      arguments: {
        title: `[MCP proof] harness loop ${stamp}`,
        description:
          "Proof that Cursor can create paid work, claim it, submit a URL, review it, and record a USDC payout as tool calls.",
        reward_amount: 1,
        currency: "USDC",
        requirements: "Ship a public URL that loads.",
        required_deliverables: ["description", "repository", "demo"],
        visibility: "private",
      },
    }),
  );
  console.log("created:", JSON.stringify(created));

  const missionId = String(created.id);
  const listedOpen = parseTool(await client.callTool({ name: "list_missions", arguments: {} }));
  const openRows = listedOpen as unknown as { id: string }[];
  if (!Array.isArray(openRows) || !openRows.some((row) => row.id === missionId)) {
    throw new Error("list_missions did not include the new mission");
  }

  const claimed = parseTool(
    await client.callTool({ name: "claim_mission", arguments: { mission_id: missionId } }),
  );
  console.log("claimed:", JSON.stringify(claimed));

  const submitted = parseTool(
    await client.callTool({
      name: "submit_mission",
      arguments: {
        mission_id: missionId,
        description: "Public demo of the Missions marketplace loop, submitted from the MCP harness.",
        repository_url: "https://github.com/modelcontextprotocol/typescript-sdk",
        demo_url: "https://missions.cv",
      },
    }),
  );
  console.log("submitted:", JSON.stringify(submitted));

  const reviews = parseTool(await client.callTool({ name: "list_reviews", arguments: {} }));
  const reviewRows = (reviews.reviews as { id: string }[]) ?? [];
  if (!reviewRows.some((row) => row.id === submitted.id)) {
    throw new Error("list_reviews did not include the new submission");
  }

  const reviewed = parseTool(
    await client.callTool({
      name: "get_submissions",
      arguments: { mission_id: missionId },
    }),
  );
  console.log("reviewed:", JSON.stringify({ claimant: reviewed.claimant, submissions: reviewed.submissions }));

  const approved = parseTool(
    await client.callTool({
      name: "approve_submission",
      arguments: { submission_id: submitted.id },
    }),
  );
  console.log("approved:", JSON.stringify(approved));

  const payment = parseTool(
    await client.callTool({
      name: "get_payment",
      arguments: { mission_id: missionId },
    }),
  );
  console.log("payment:", JSON.stringify(payment));

  const finalMission = parseTool(
    await client.callTool({ name: "get_mission", arguments: { id: missionId } }),
  );
  console.log("final:", JSON.stringify({
    id: finalMission.id,
    status: finalMission.status,
    url: finalMission.url,
    payment: finalMission.payment,
  }));

  if (finalMission.status !== "completed") {
    throw new Error(`Expected completed mission, got ${String(finalMission.status)}`);
  }
  const pay = finalMission.payment as { status?: string; transaction_hash?: string } | null;
  if (pay?.status !== "paid" || !pay.transaction_hash) {
    throw new Error("Expected a paid payment with a transaction hash");
  }

  await client.close();
  console.log("ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
