"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth";
import {
  DomainError,
  ensureCampaignWallet,
  planFromUrl,
  prepareCampaign,
  retryCampaignLaunch,
  updateCampaignBudget,
} from "@/lib/domain";
import type { CampaignFunding, LaunchCampaignInput } from "@/lib/domain/campaigns";
import type { ProductPlan } from "@/lib/domain/plan";

function fail(err: unknown): { error: string } {
  if (err instanceof DomainError) return { error: err.message };
  if (err instanceof Error) return { error: err.message };
  return { error: "Something went wrong" };
}

function revalidateCampaign(campaignId: string) {
  revalidatePath("/");
  revalidatePath("/missions");
  revalidatePath(`/campaigns/${campaignId}`);
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

export async function prepareCampaignAction(
  input: LaunchCampaignInput,
): Promise<
  { campaignId: string; funding: CampaignFunding; walletError: string | null } | { error: string }
> {
  try {
    const { actor } = await requireActor();
    const prepared = await prepareCampaign(actor, input);
    revalidateCampaign(prepared.campaign.id);
    return {
      campaignId: prepared.campaign.id,
      funding: prepared.funding,
      walletError: prepared.walletError,
    };
  } catch (err) {
    return fail(err);
  }
}

export async function updateCampaignBudgetAction(
  campaignId: string,
  totalBudget: number,
): Promise<{ funding: CampaignFunding } | { error: string }> {
  try {
    const { actor } = await requireActor();
    const funding = await updateCampaignBudget(actor, campaignId, totalBudget);
    revalidateCampaign(campaignId);
    return { funding };
  } catch (err) {
    return fail(err);
  }
}

export async function provisionCampaignWalletAction(campaignId: string) {
  try {
    const { actor } = await requireActor();
    const campaign = await ensureCampaignWallet(actor, campaignId);
    revalidateCampaign(campaignId);
    return { ok: true as const, address: campaign.deposit_address };
  } catch (err) {
    return fail(err);
  }
}

export async function retryCampaignLaunchAction(campaignId: string) {
  try {
    const { actor } = await requireActor();
    await retryCampaignLaunch(actor, campaignId);
    revalidateCampaign(campaignId);
    return { ok: true as const, campaignId };
  } catch (err) {
    return fail(err);
  }
}
