import { createAdminClient } from "@/lib/supabase/admin";
import { DomainError, parseMission, type Actor, type Mission, type Refund } from "./types";
import {
  assertAddress,
  paymentMode,
  sendUsdcFrom,
  splitFee,
  toAmount,
  toDecimalString,
  usdcBalanceMicros,
  usdcDepositsBySender,
} from "./wallets";

async function ownedMission(actor: Actor, missionId: string): Promise<Mission> {
  if (actor.role !== "company") {
    throw new DomainError("Only companies can return mission funds", "forbidden");
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("missions")
    .select("*")
    .eq("id", missionId)
    .maybeSingle();
  if (error) throw new DomainError(error.message, "db");
  if (!data) throw new DomainError("Mission not found", "not_found");
  const mission = parseMission(data as Mission);
  if (mission.company_id !== actor.id) throw new DomainError("Not your mission", "forbidden");
  return mission;
}

/** USDC in the wallet that is still committed to the developer. */
function outstandingMicros(mission: Mission): bigint {
  if (mission.funding_status === "funded") return splitFee(mission.reward_amount).rewardMicros;
  return 0n;
}

type SweepPlan = {
  balanceMicros: bigint;
  outstandingMicros: bigint;
  sweepableMicros: bigint;
  allocations: { to: string; micros: bigint }[];
  blockedReason: string | null;
};

const EMPTY_PLAN: SweepPlan = {
  balanceMicros: 0n,
  outstandingMicros: 0n,
  sweepableMicros: 0n,
  allocations: [],
  blockedReason: null,
};

/**
 * Works out what can be returned and to whom. Every allocation goes back to an
 * address that funded this mission, pro rata to what it sent, so funds can never
 * leave through an address that did not put them in.
 */
async function planSweep(mission: Mission): Promise<SweepPlan> {
  if (!mission.deposit_address) {
    return { ...EMPTY_PLAN, blockedReason: "This mission has no wallet yet." };
  }
  if (mission.funding_status === "funding") {
    return { ...EMPTY_PLAN, blockedReason: "Funding is in progress." };
  }

  const outstanding = outstandingMicros(mission);
  let balance = 0n;
  try {
    balance = await usdcBalanceMicros(mission.deposit_address);
  } catch (err) {
    return {
      ...EMPTY_PLAN,
      outstandingMicros: outstanding,
      blockedReason: err instanceof Error ? err.message : "Could not read the wallet balance",
    };
  }

  const sweepable = balance > outstanding ? balance - outstanding : 0n;
  const base = {
    balanceMicros: balance,
    outstandingMicros: outstanding,
    sweepableMicros: sweepable,
  };
  if (sweepable === 0n) {
    return { ...base, allocations: [], blockedReason: null };
  }

  // Only read event history once there is something to return.
  const deposits = await usdcDepositsBySender(mission.deposit_address);
  if (deposits.length === 0) {
    return {
      ...base,
      allocations: [],
      blockedReason: "No incoming deposit found, so there is no address to return funds to.",
    };
  }

  return { ...base, allocations: allocate(sweepable, deposits), blockedReason: null };
}

/**
 * Splits the returnable balance across depositors in proportion to what each sent,
 * and never gives an address more than it deposited. That cap is the invariant that
 * matters: the deposit history read is capped at 500 transfers, and without it a
 * truncated history would inflate each share. Anything left unallocated stays in the
 * mission wallet rather than being pushed somewhere it did not come from.
 */
function allocate(
  sweepable: bigint,
  deposits: { from: string; amountMicros: bigint }[],
): { to: string; micros: bigint }[] {
  const total = deposits.reduce((sum, deposit) => sum + deposit.amountMicros, 0n);
  if (total === 0n) return [];

  const shares = deposits.map((deposit) => {
    const share = (sweepable * deposit.amountMicros) / total;
    return {
      to: deposit.from,
      micros: share > deposit.amountMicros ? deposit.amountMicros : share,
      deposited: deposit.amountMicros,
    };
  });

  // Integer division leaves dust. Hand it to the largest depositor with room for it;
  // deposits arrive sorted largest first.
  let dust = sweepable - shares.reduce((sum, share) => sum + share.micros, 0n);
  for (const share of shares) {
    if (dust <= 0n) break;
    const room = share.deposited - share.micros;
    const take = room < dust ? room : dust;
    share.micros += take;
    dust -= take;
  }

  return shares
    .filter((share) => share.micros > 0n)
    .map((share) => ({ to: share.to, micros: share.micros }));
}

export type SweepAllocation = { to: string; amount: number };

export type MissionSweep = {
  balance: number;
  /** Still owed to the developer, so never swept. */
  outstanding: number;
  /** Unspent balance, whether or not all of it can be traced to a depositor. */
  sweepable: number;
  /** Total actually being returned, which is the sum of the allocations. */
  returning: number;
  allocations: SweepAllocation[];
  /** Set when nothing can be returned right now. */
  blockedReason: string | null;
};

export async function getMissionSweep(actor: Actor, missionId: string): Promise<MissionSweep> {
  const mission = await ownedMission(actor, missionId);
  const plan = await planSweep(mission);
  return {
    balance: toAmount(plan.balanceMicros),
    outstanding: toAmount(plan.outstandingMicros),
    sweepable: toAmount(plan.sweepableMicros),
    returning: toAmount(plan.allocations.reduce((sum, item) => sum + item.micros, 0n)),
    allocations: plan.allocations.map((allocation) => ({
      to: allocation.to,
      amount: toAmount(allocation.micros),
    })),
    blockedReason: plan.blockedReason,
  };
}

/** Returns unspent USDC to the addresses that deposited it. */
export async function sweepMissionWallet(actor: Actor, missionId: string): Promise<Refund[]> {
  const mission = await ownedMission(actor, missionId);
  const plan = await planSweep(mission);
  if (plan.blockedReason) throw new DomainError(plan.blockedReason, "sweep_blocked");
  if (plan.allocations.length === 0) {
    throw new DomainError("There is no unspent balance to return", "nothing_to_sweep");
  }

  const from = assertAddress(mission.deposit_address, "Mission wallet");
  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("refunds")
    .insert(
      plan.allocations.map((allocation) => ({
        mission_id: missionId,
        to_address: allocation.to,
        amount: toDecimalString(allocation.micros),
        status: "processing" as const,
      })),
    )
    .select("*");
  if (error) throw new DomainError(error.message, "db");
  const ids = ((inserted ?? []) as Refund[]).map((refund) => refund.id);

  try {
    const hash =
      paymentMode() === "mock"
        ? `mock_refund_${Date.now()}`
        : await sendUsdcFrom(
            from,
            plan.allocations.map((allocation) => ({
              to: allocation.to,
              amountMicros: allocation.micros,
            })),
          );

    const { data: sent, error: sentError } = await admin
      .from("refunds")
      .update({ status: "sent", transaction_hash: hash, error: null })
      .in("id", ids)
      .select("*");
    if (sentError) throw new DomainError(sentError.message, "db");
    return parseRefunds(sent);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed";
    await admin.from("refunds").update({ status: "failed", error: message }).in("id", ids);
    throw err instanceof DomainError ? err : new DomainError(message, "refund_failed");
  }
}

export async function listRefunds(missionId: string): Promise<Refund[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("refunds")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false });
  if (error) throw new DomainError(error.message, "db");
  return parseRefunds(data);
}

function parseRefunds(rows: unknown): Refund[] {
  return ((rows ?? []) as Refund[]).map((refund) => ({
    ...refund,
    amount: Number(refund.amount),
  }));
}
