"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth";
import { DomainError, ensureMissionWallet, sweepMissionWallet } from "@/lib/domain";

function fail(err: unknown): { error: string } {
  if (err instanceof DomainError) return { error: err.message };
  if (err instanceof Error) return { error: err.message };
  return { error: "Something went wrong" };
}

export async function provisionMissionWalletAction(missionId: string) {
  try {
    const { actor } = await requireActor();
    const mission = await ensureMissionWallet(actor, missionId);
    revalidatePath(`/missions/${missionId}`);
    return { ok: true as const, address: mission.deposit_address };
  } catch (err) {
    return fail(err);
  }
}

export async function sweepMissionWalletAction(missionId: string) {
  try {
    const { actor } = await requireActor();
    const refunds = await sweepMissionWallet(actor, missionId);
    revalidatePath(`/missions/${missionId}`);
    return { ok: true as const, count: refunds.length };
  } catch (err) {
    return fail(err);
  }
}
