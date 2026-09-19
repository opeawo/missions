import { DomainError, type Mission } from "./types";

function extractMessageId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const rec = payload as { id?: string };
  return rec.id ?? null;
}

export async function notifyMissionPublished(mission: Mission): Promise<string | null> {
  if (mission.visibility !== "public") return null;
  if (mission.discord_message_id) return mission.discord_message_id;

  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://missions.cv";
  const deliverables =
    mission.required_deliverables?.length > 0
      ? mission.required_deliverables.join(", ")
      : "Company will specify";
  const deadline = mission.deadline
    ? new Date(mission.deadline).toUTCString()
    : "None";
  const short =
    mission.description.length > 240
      ? `${mission.description.slice(0, 237)}...`
      : mission.description;

  const content = [
    "**NEW MISSION**",
    `**${mission.title}**`,
    short,
    `Reward: ${mission.reward_amount} ${mission.reward_currency}`,
    `Required deliverables: ${deliverables}`,
    `Deadline: ${deadline}`,
    `Link: ${appUrl}/missions/${mission.id}`,
  ].join("\n");

  const waitUrl = webhook.includes("?") ? `${webhook}&wait=true` : `${webhook}?wait=true`;
  const res = await fetch(waitUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new DomainError(`Discord post failed: ${text || res.status}`, "discord_failed");
  }

  try {
    const json = await res.json();
    return extractMessageId(json);
  } catch {
    return `posted-${mission.id}`;
  }
}
