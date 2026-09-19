"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth";
import { DomainError, launchCampaign, planFromUrl, retryCampaignLaunch } from "@/lib/domain";
import type { LaunchCampaignInput } from "@/lib/domain/campaigns";
import type { ProductPlan } from "@/lib/domain/plan";

function fail(err: unknown): { error: string } {
  if (err instanceof DomainError) return { error: err.message };
  if (err instanceof Error) return { error: err.message };
  return { error: "Something went wrong" };
}

export async function planFromUrlAction(input: {
  url: string;
  context?: string;
}): Promise<{ plan: ProductPlan } | { error: string }> {
  try {
    const { actor } = await requireActor();
    if (actor.role !== "company") return { error: "Only companies can create missions" };
    const plan = await planFromUrl(input);
    return { plan };
  } catch (err) {
    return fail(err);
  }
}

export async function launchCampaignAction(
  input: LaunchCampaignInput,
): Promise<{ campaignId: string } | { error: string }> {
  try {
    const { actor } = await requireActor();
    const { campaign } = await launchCampaign(actor, input);
    revalidatePath("/");
    revalidatePath("/missions");
    revalidatePath(`/campaigns/${campaign.id}`);
    return { campaignId: campaign.id };
  } catch (err) {
    return fail(err);
  }
}

export async function retryCampaignLaunchAction(campaignId: string) {
  try {
    const { actor } = await requireActor();
    await retryCampaignLaunch(actor, campaignId);
    revalidatePath("/");
    revalidatePath("/missions");
    revalidatePath(`/campaigns/${campaignId}`);
    return { ok: true as const };
  } catch (err) {
    return fail(err);
  }
}
