import { createAdminClient } from "@/lib/supabase/admin";
import {
  campaignBudget,
  missionReward,
  resolvePricingConfig,
  type Region,
} from "@/lib/pricing";
import { notifyMissionPublished } from "./discord";
import { parseCampaign, parseMission, DomainError, type Actor, type Campaign, type Mission } from "./types";
import type { ProposedMission } from "./plan";
import {
  assertAddress,
  masterWalletAddress,
  paymentMode,
  provisionServerWallet,
  sendUsdcFrom,
  splitFee,
  toAmount,
  toDecimalString,
  usdcBalanceMicros,
} from "./wallets";

export type LaunchMissionInput = ProposedMission & { included: boolean };

export type LaunchCampaignInput = {
  product_url: string;
  product_name: string;
  product_summary: string;
  category?: string;
  geography: Region;
  developer_target_count: number;
  missions: LaunchMissionInput[];
};

function assertCompany(actor: Actor) {
  if (actor.role !== "company") {
    throw new DomainError("Only companies can run campaigns", "forbidden");
  }
}

function pricing() {
  return resolvePricingConfig(process.env.PRICING_CONFIG_JSON);
}

function campaignWalletLabel(campaignId: string): string {
  return `campaign:${campaignId}`;
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (error) throw new DomainError(error.message, "db");
  return data ? parseCampaign(data as Campaign) : null;
}

export async function listCampaigns(companyId: string): Promise<Campaign[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campaigns")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw new DomainError(error.message, "db");
  return ((data ?? []) as Campaign[]).map(parseCampaign);
}

export async function listCampaignMissions(campaignId: string): Promise<Mission[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("missions")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) throw new DomainError(error.message, "db");
  return ((data ?? []) as Mission[]).map(parseMission);
}

async function ownedCampaign(actor: Actor, campaignId: string): Promise<Campaign> {
  assertCompany(actor);
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new DomainError("Campaign not found", "not_found");
  if (campaign.company_id !== actor.id) throw new DomainError("Not your campaign", "forbidden");
  return campaign;
}

export async function ensureCampaignWallet(actor: Actor, campaignId: string): Promise<Campaign> {
  const campaign = await ownedCampaign(actor, campaignId);
  if (campaign.deposit_address) return campaign;
  const label = campaignWalletLabel(campaignId);
  const wallet = await provisionServerWallet(label);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campaigns")
    .update({
      deposit_address: wallet.address,
      deposit_smart_account_address: wallet.smartAccountAddress,
      deposit_wallet_label: label,
    })
    .eq("id", campaignId)
    .select("*")
    .single();
  if (error) throw new DomainError(error.message, "db");
  return parseCampaign(data as Campaign);
}

/**
 * Takes the platform fee from the campaign wallet. The remaining USDC is the pool
 * that developer payouts draw from. Idempotent.
 */
export async function fundCampaign(actor: Actor, campaignId: string): Promise<Campaign> {
  const campaign = await ownedCampaign(actor, campaignId);
  if (campaign.funding_status !== "unfunded") return campaign;

  const split = splitFee(campaign.total_budget);
  const admin = createAdminClient();
  const { data: claimed, error: claimError } = await admin
    .from("campaigns")
    .update({ funding_status: "funding" })
    .eq("id", campaignId)
    .eq("funding_status", "unfunded")
    .select("id")
    .maybeSingle();
  if (claimError) throw new DomainError(claimError.message, "db");
  if (!claimed) return (await getCampaign(campaignId))!;

  try {
    let feeTransactionHash = `mock_fee_${Date.now()}`;
    if (paymentMode() === "live") {
      const ready = await ensureCampaignWallet(actor, campaignId);
      const from = assertAddress(ready.deposit_address, "Campaign wallet");
      const balance = await usdcBalanceMicros(from);
      if (balance < split.grossMicros) {
        throw new DomainError(
          `Deposit ${toDecimalString(split.grossMicros - balance)} more USDC to ${from}. ` +
            `Budget ${toDecimalString(split.rewardMicros)} plus ${split.bps / 100}% fee ` +
            `${toDecimalString(split.feeMicros)} = ${toDecimalString(split.grossMicros)} USDC.`,
          "insufficient_funds",
        );
      }
      feeTransactionHash =
        split.feeMicros > 0n
          ? await sendUsdcFrom(from, [
              { to: masterWalletAddress(), amountMicros: split.feeMicros },
            ])
          : "no_fee";
    }

    const { data, error } = await admin
      .from("campaigns")
      .update({
        funding_status: "funded",
        platform_fee_bps: split.bps,
        platform_fee_amount: toDecimalString(split.feeMicros),
        gross_amount: toDecimalString(split.grossMicros),
        fee_transaction_hash: feeTransactionHash,
        funded_at: new Date().toISOString(),
      })
      .eq("id", campaignId)
      .select("*")
      .single();
    if (error) throw new DomainError(error.message, "db");
    return parseCampaign(data as Campaign);
  } catch (err) {
    await admin
      .from("campaigns")
      .update({ funding_status: "unfunded" })
      .eq("id", campaignId)
      .eq("funding_status", "funding");
    throw err;
  }
}

export type CampaignFunding = {
  address: string | null;
  budget: number;
  fee: number;
  required: number;
  balance: number;
  shortfall: number;
  status: Campaign["funding_status"];
  mode: "mock" | "live";
};

export async function getCampaignFunding(actor: Actor, campaignId: string): Promise<CampaignFunding> {
  const campaign = await ownedCampaign(actor, campaignId);
  const split = splitFee(campaign.total_budget);
  let balance = 0n;
  if (campaign.deposit_address) {
    try {
      balance = await usdcBalanceMicros(campaign.deposit_address);
    } catch {
      balance = 0n;
    }
  }
  const outstanding = campaign.funding_status === "unfunded" ? split.grossMicros : 0n;
  return {
    address: campaign.deposit_address,
    budget: toAmount(split.rewardMicros),
    fee: toAmount(split.feeMicros),
    required: toAmount(split.grossMicros),
    balance: toAmount(balance),
    shortfall: toAmount(balance >= outstanding ? 0n : outstanding - balance),
    status: campaign.funding_status,
    mode: paymentMode(),
  };
}

async function publishCampaignMission(mission: Mission): Promise<Mission> {
  if (mission.status !== "draft") return mission;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("missions")
    .update({
      status: "open",
      funding_status: "funded",
      funded_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
    })
    .eq("id", mission.id)
    .select("*")
    .single();
  if (error) throw new DomainError(error.message, "db");
  const opened = parseMission(data as Mission);
  if (opened.visibility !== "public") return opened;
  const messageId = await notifyMissionPublished(opened);
  if (!messageId) return opened;
  const { data: posted, error: postError } = await admin
    .from("missions")
    .update({ discord_message_id: messageId })
    .eq("id", mission.id)
    .select("*")
    .single();
  if (postError) throw new DomainError(postError.message, "db");
  return parseMission(posted as Mission);
}

/**
 * Creates the campaign, writes the selected missions, charges the platform fee,
 * and opens the missions. Money is calculated here — the client estimate is ignored.
 */
export async function launchCampaign(
  actor: Actor,
  input: LaunchCampaignInput,
): Promise<{ campaign: Campaign; missions: Mission[] }> {
  assertCompany(actor);
  const included = input.missions.filter((m) => m.included);
  if (included.length === 0) {
    throw new DomainError("Keep at least one mission", "validation");
  }
  const count = Math.floor(Number(input.developer_target_count));
  if (!Number.isFinite(count) || count < 1 || count > 500) {
    throw new DomainError("Pick how many developers you want to reach", "validation");
  }

  const config = pricing();
  const efforts = included.map((m) => m.effort);
  const budget = campaignBudget(efforts, count, input.geography, config);

  const admin = createAdminClient();
  const { data: campaignRow, error: campaignError } = await admin
    .from("campaigns")
    .insert({
      company_id: actor.id,
      product_url: input.product_url,
      product_name: input.product_name.trim() || "Campaign",
      product_summary: input.product_summary.trim(),
      geography: input.geography,
      developer_target_count: count,
      total_budget: budget.recommended,
      currency: "USDC",
      status: "draft",
      ai_plan: {
        category: input.category || "",
        missions: included,
        estimate: budget,
      },
    })
    .select("*")
    .single();
  if (campaignError) throw new DomainError(campaignError.message, "db");
  let campaign = parseCampaign(campaignRow as Campaign);

  const missionRows = included.map((idea) => ({
    company_id: actor.id,
    campaign_id: campaign.id,
    title: idea.title.trim(),
    description: idea.description.trim(),
    requirements: idea.requirements.trim(),
    required_deliverables: idea.required_deliverables,
    reward_amount: missionReward(idea.effort, input.geography, config),
    reward_currency: "USDC",
    visibility: idea.visibility === "private" ? ("private" as const) : ("public" as const),
    status: "draft" as const,
  }));

  const { data: inserted, error: missionError } = await admin
    .from("missions")
    .insert(missionRows)
    .select("*");
  if (missionError) throw new DomainError(missionError.message, "db");
  let missions = ((inserted ?? []) as Mission[]).map(parseMission);

  try {
    campaign = await ensureCampaignWallet(actor, campaign.id);
  } catch {
    // Wallet can be created on the campaign page if thirdweb is not ready.
  }

  try {
    campaign = await fundCampaign(actor, campaign.id);
  } catch (err) {
    // Live mode: campaign exists, missions stay drafts until the wallet is funded.
    if (err instanceof DomainError && err.code === "insufficient_funds") {
      return { campaign, missions };
    }
    throw err;
  }

  const opened: Mission[] = [];
  for (const mission of missions) {
    opened.push(await publishCampaignMission(mission));
  }
  missions = opened;

  const { data: live, error: liveError } = await admin
    .from("campaigns")
    .update({ status: "live" })
    .eq("id", campaign.id)
    .select("*")
    .single();
  if (liveError) throw new DomainError(liveError.message, "db");
  campaign = parseCampaign(live as Campaign);

  return { campaign, missions };
}

export async function retryCampaignLaunch(actor: Actor, campaignId: string): Promise<Campaign> {
  let campaign = await ownedCampaign(actor, campaignId);
  if (campaign.status === "live" && campaign.funding_status === "funded") return campaign;
  campaign = await fundCampaign(actor, campaignId);
  const missions = await listCampaignMissions(campaignId);
  for (const mission of missions) {
    if (mission.status === "draft") await publishCampaignMission(mission);
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campaigns")
    .update({ status: "live" })
    .eq("id", campaignId)
    .select("*")
    .single();
  if (error) throw new DomainError(error.message, "db");
  return parseCampaign(data as Campaign);
}
