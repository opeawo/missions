import { createAdminClient } from "@/lib/supabase/admin";
import { notifyMissionPublished } from "./discord";
import { ensureMissionWallet, fundMission } from "./funding";
import {
  DELIVERABLE_TYPES,
  DomainError,
  missionIsEditable,
  missionRewardIsLocked,
  parseMission,
  type Actor,
  type DeliverableType,
  type Mission,
  type MissionVisibility,
} from "./types";

export type CreateMissionInput = {
  title: string;
  description: string;
  reward_amount: number;
  currency?: string;
  requirements?: string;
  required_deliverables?: string[];
  visibility?: MissionVisibility;
  deadline?: string | null;
  campaign_id?: string | null;
};

function assertCompany(actor: Actor) {
  if (actor.role !== "company") {
    throw new DomainError("Only companies can manage missions", "forbidden");
  }
}

function normalizeDeliverables(list: string[] | undefined): DeliverableType[] {
  const allowed = new Set<string>(DELIVERABLE_TYPES);
  return (list ?? []).filter((d): d is DeliverableType => allowed.has(d));
}

function assertValidReward(reward: number) {
  if (!Number.isFinite(reward) || reward < 1) {
    throw new DomainError("Reward must be at least 1 USDC", "validation");
  }
}

export async function createMission(
  actor: Actor,
  input: CreateMissionInput,
  opts?: { autoPublish?: boolean },
): Promise<Mission> {
  assertCompany(actor);
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title || !description) {
    throw new DomainError("Title and description are required", "validation");
  }
  assertValidReward(input.reward_amount);

  const autoPublish = Boolean(opts?.autoPublish);
  const visibility = input.visibility ?? "public";
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("missions")
    .insert({
      company_id: actor.id,
      title,
      description,
      reward_amount: input.reward_amount,
      reward_currency: input.currency || "USDC",
      requirements: input.requirements?.trim() || "",
      required_deliverables: normalizeDeliverables(input.required_deliverables),
      visibility,
      status: "draft",
      deadline: input.deadline || null,
      campaign_id: input.campaign_id || null,
    })
    .select("*")
    .single();
  if (error) throw new DomainError(error.message, "db");

  let mission = parseMission(data as Mission);

  // Campaign missions are funded from the campaign wallet, not a per-mission one.
  if (!mission.campaign_id) {
    try {
      mission = await ensureMissionWallet(actor, mission.id);
    } catch {
      // Left unprovisioned; ensureMissionWallet runs again on demand.
    }
  }

  // Publishing charges the platform fee, so auto-publish goes through the same gate.
  return autoPublish ? await publishMission(actor, mission.id) : mission;
}

async function postDiscordIfNeeded(mission: Mission): Promise<Mission> {
  if (mission.discord_message_id) return mission;
  const messageId = await notifyMissionPublished(mission);
  if (!messageId) return mission;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("missions")
    .update({ discord_message_id: messageId })
    .eq("id", mission.id)
    .select("*")
    .single();
  if (error) throw new DomainError(error.message, "db");
  return parseMission(data as Mission);
}

export async function updateMission(
  actor: Actor,
  id: string,
  input: CreateMissionInput,
): Promise<Mission> {
  assertCompany(actor);
  const existing = await getMission(id);
  if (!existing) throw new DomainError("Mission not found", "not_found");
  if (existing.company_id !== actor.id) throw new DomainError("Not your mission", "forbidden");
  if (!missionIsEditable(existing)) {
    throw new DomainError("This mission can no longer be edited", "invalid_state");
  }

  const rewardLocked = missionRewardIsLocked(existing);
  if (!rewardLocked) assertValidReward(input.reward_amount);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("missions")
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      reward_amount: rewardLocked ? existing.reward_amount : input.reward_amount,
      reward_currency: rewardLocked
        ? existing.reward_currency
        : input.currency || existing.reward_currency,
      requirements: input.requirements?.trim() || "",
      required_deliverables: normalizeDeliverables(input.required_deliverables),
      visibility: input.visibility ?? existing.visibility,
      deadline: input.deadline || null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new DomainError(error.message, "db");
  return parseMission(data as Mission);
}

export async function publishMission(actor: Actor, id: string): Promise<Mission> {
  assertCompany(actor);
  const existing = await getMission(id);
  if (!existing) throw new DomainError("Mission not found", "not_found");
  if (existing.company_id !== actor.id) throw new DomainError("Not your mission", "forbidden");
  if (existing.status !== "draft") {
    throw new DomainError("Mission is already published", "invalid_state");
  }

  // Organizations pay the platform fee before the work is visible to developers.
  await fundMission(actor, id);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("missions")
    .update({ status: "open", published_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new DomainError(error.message, "db");
  return postDiscordIfNeeded(parseMission(data as Mission));
}

export async function getMission(id: string): Promise<Mission | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("missions").select("*").eq("id", id).maybeSingle();
  if (error) throw new DomainError(error.message, "db");
  return data ? parseMission(data as Mission) : null;
}

export async function listMissions(filter?: {
  status?: string;
  companyId?: string;
}): Promise<Mission[]> {
  const admin = createAdminClient();
  let q = admin.from("missions").select("*").order("created_at", { ascending: false });
  if (filter?.status) q = q.eq("status", filter.status);
  if (filter?.companyId) q = q.eq("company_id", filter.companyId);
  const { data, error } = await q;
  if (error) throw new DomainError(error.message, "db");
  return (data as Mission[]).map(parseMission);
}

export async function listOpenMissions(): Promise<Mission[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("missions")
    .select("*")
    .eq("status", "open")
    .eq("visibility", "public")
    .order("published_at", { ascending: false });
  if (error) throw new DomainError(error.message, "db");
  return (data as Mission[]).map(parseMission);
}

export async function setMissionStatus(
  id: string,
  status: Mission["status"],
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("missions").update({ status }).eq("id", id);
  if (error) throw new DomainError(error.message, "db");
}
