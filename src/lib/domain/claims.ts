import { createAdminClient } from "@/lib/supabase/admin";
import { getMission, setMissionStatus } from "./missions";
import { DomainError, type Actor, type Claim } from "./types";

export async function claimMission(actor: Actor, missionId: string): Promise<Claim> {
  if (actor.role !== "developer") {
    throw new DomainError("Only developers can claim missions", "forbidden");
  }
  const mission = await getMission(missionId);
  if (!mission) throw new DomainError("Mission not found", "not_found");
  if (mission.status !== "open") {
    throw new DomainError("This mission is not open to claim", "invalid_state");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("claims")
    .insert({
      mission_id: missionId,
      developer_id: actor.id,
      status: "active",
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new DomainError("This mission is already claimed", "already_claimed");
    }
    throw new DomainError(error.message, "db");
  }
  await setMissionStatus(missionId, "claimed");
  return data as Claim;
}

export async function getClaimForMission(missionId: string): Promise<Claim | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("claims")
    .select("*")
    .eq("mission_id", missionId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new DomainError(error.message, "db");
  return (data as Claim) ?? null;
}

export async function listClaimsForDeveloper(developerId: string): Promise<Claim[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("claims")
    .select("*")
    .eq("developer_id", developerId)
    .order("claimed_at", { ascending: false });
  if (error) throw new DomainError(error.message, "db");
  return (data as Claim[]) ?? [];
}
