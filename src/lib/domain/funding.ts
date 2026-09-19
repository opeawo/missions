import { createAdminClient } from "@/lib/supabase/admin";
import { DomainError, parseMission, type Actor, type Mission } from "./types";
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

export function missionWalletLabel(missionId: string): string {
  return `mission:${missionId}`;
}

function assertCompany(actor: Actor) {
  if (actor.role !== "company") {
    throw new DomainError("Only companies fund missions", "forbidden");
  }
}

async function readMission(missionId: string): Promise<Mission> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("missions")
    .select("*")
    .eq("id", missionId)
    .maybeSingle();
  if (error) throw new DomainError(error.message, "db");
  if (!data) throw new DomainError("Mission not found", "not_found");
  return parseMission(data as Mission);
}

async function ownedMission(actor: Actor, missionId: string): Promise<Mission> {
  assertCompany(actor);
  const mission = await readMission(missionId);
  if (mission.company_id !== actor.id) throw new DomainError("Not your mission", "forbidden");
  return mission;
}

/**
 * Every mission collects into its own thirdweb server wallet, so a compromise or
 * mistake is contained to that one mission's funds. Labels are stable, so this is
 * safe to call repeatedly.
 */
export async function ensureMissionWallet(actor: Actor, missionId: string): Promise<Mission> {
  const mission = await ownedMission(actor, missionId);
  if (mission.deposit_address) return mission;

  const label = missionWalletLabel(missionId);
  const wallet = await provisionServerWallet(label);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("missions")
    .update({
      deposit_address: wallet.address,
      deposit_smart_account_address: wallet.smartAccountAddress,
      deposit_wallet_label: label,
    })
    .eq("id", missionId)
    .select("*")
    .single();
  if (error) throw new DomainError(error.message, "db");
  return parseMission(data as Mission);
}

export type MissionFunding = {
  address: string | null;
  smartAccountAddress: string | null;
  /** Reward paid to the developer. */
  reward: number;
  /** Platform cut, charged on top of the reward. */
  fee: number;
  /** What the organization deposits: reward + fee. */
  required: number;
  balance: number;
  shortfall: number;
  feeBps: number;
  status: Mission["funding_status"];
  mode: "mock" | "live";
  balanceError: string | null;
};

export async function getMissionFunding(
  actor: Actor,
  missionId: string,
): Promise<MissionFunding> {
  const mission = await ownedMission(actor, missionId);
  const split = splitFee(mission.reward_amount);

  let balance = 0n;
  let balanceError: string | null = null;
  if (mission.deposit_address) {
    try {
      balance = await usdcBalanceMicros(mission.deposit_address);
    } catch (err) {
      balanceError = err instanceof Error ? err.message : "Could not read the wallet balance";
    }
  }

  // Once funded the fee has already left the wallet, so only the reward is still owed.
  const outstanding = mission.funding_status === "unfunded" ? split.grossMicros : split.rewardMicros;

  return {
    address: mission.deposit_address,
    smartAccountAddress: mission.deposit_smart_account_address,
    reward: toAmount(split.rewardMicros),
    fee: toAmount(split.feeMicros),
    required: toAmount(split.grossMicros),
    balance: toAmount(balance),
    shortfall: toAmount(balance >= outstanding ? 0n : outstanding - balance),
    feeBps: split.bps,
    status: mission.funding_status,
    mode: paymentMode(),
    balanceError,
  };
}

/**
 * Charges the organization before work goes live: the platform fee moves from the
 * mission wallet to the master wallet, leaving exactly the reward behind for the
 * developer. Idempotent — an already funded mission is returned as is.
 */
export async function fundMission(actor: Actor, missionId: string): Promise<Mission> {
  const mission = await ownedMission(actor, missionId);
  if (mission.funding_status !== "unfunded") return mission;

  const admin = createAdminClient();

  if (mission.campaign_id) {
    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .select("funding_status")
      .eq("id", mission.campaign_id)
      .maybeSingle();
    if (campaignError) throw new DomainError(campaignError.message, "db");
    if (campaign?.funding_status !== "funded") {
      throw new DomainError("Fund the campaign before this mission can go live", "unfunded_campaign");
    }
    const { data, error } = await admin
      .from("missions")
      .update({
        funding_status: "funded",
        funded_at: new Date().toISOString(),
        fee_transaction_hash: "campaign",
      })
      .eq("id", missionId)
      .eq("funding_status", "unfunded")
      .select("*")
      .single();
    if (error) throw new DomainError(error.message, "db");
    return parseMission(data as Mission);
  }

  const split = splitFee(mission.reward_amount);

  // Claiming the row first is atomic, so two concurrent publishes cannot both
  // charge the fee for the same mission.
  const { data: claimed, error: claimError } = await admin
    .from("missions")
    .update({ funding_status: "funding" })
    .eq("id", missionId)
    .eq("funding_status", "unfunded")
    .select("id")
    .maybeSingle();
  if (claimError) throw new DomainError(claimError.message, "db");
  if (!claimed) return await readMission(missionId);

  try {
    let feeTransactionHash = `mock_fee_${Date.now()}`;

    if (paymentMode() === "live") {
      const funded = await ensureMissionWallet(actor, missionId);
      const from = assertAddress(funded.deposit_address, "Mission wallet");
      const balance = await usdcBalanceMicros(from);
      if (balance < split.grossMicros) {
        throw new DomainError(
          `Deposit ${toDecimalString(split.grossMicros - balance)} more USDC to ${from} to publish this mission. ` +
            `Reward ${toDecimalString(split.rewardMicros)} plus ${split.bps / 100}% fee ` +
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

    const { data: result, error: resultError } = await admin
      .from("missions")
      .update({
        funding_status: "funded",
        platform_fee_bps: split.bps,
        platform_fee_amount: toDecimalString(split.feeMicros),
        gross_amount: toDecimalString(split.grossMicros),
        fee_transaction_hash: feeTransactionHash,
        funded_at: new Date().toISOString(),
      })
      .eq("id", missionId)
      .select("*")
      .single();
    if (resultError) throw new DomainError(resultError.message, "db");
    return parseMission(result as Mission);
  } catch (err) {
    await admin
      .from("missions")
      .update({ funding_status: "unfunded" })
      .eq("id", missionId)
      .eq("funding_status", "funding");
    throw err;
  }
}

/** Called once the developer has been paid and the mission wallet is spent. */
export async function releaseMissionFunding(missionId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("missions")
    .update({ funding_status: "released" })
    .eq("id", missionId)
    .eq("funding_status", "funded");
  if (error) throw new DomainError(error.message, "db");
}
