import { createAdminClient } from "@/lib/supabase/admin";
import { getCampaign } from "./campaigns";
import { fundMission, releaseMissionFunding } from "./funding";
import { getMission, setMissionStatus } from "./missions";
import { getProfileById } from "./profiles";
import { getSubmission } from "./submissions";
import { getPaymentForSubmission } from "./payment-queries";
import { DomainError, type Actor, type Mission, type Payment } from "./types";
import { assertAddress, paymentMode, sendUsdcFrom, toMicros } from "./wallets";

/**
 * Standalone missions pay from their own wallet. Campaign missions pay from the
 * campaign pool so the company funds once.
 */
async function payDeveloper(
  mission: Mission,
  to: string,
  amount: number,
): Promise<{ hash: string; chain: string }> {
  if (paymentMode() === "mock") {
    return { hash: `mock_${Date.now()}`, chain: "base" };
  }

  let from: string | null = mission.deposit_address;
  if (mission.campaign_id) {
    const campaign = await getCampaign(mission.campaign_id);
    from = campaign?.deposit_address ?? null;
  }
  const sender = assertAddress(from, mission.campaign_id ? "Campaign wallet" : "Mission wallet");
  const hash = await sendUsdcFrom(sender, [{ to, amountMicros: toMicros(amount) }]);
  return { hash, chain: "base" };
}

export async function approveSubmission(actor: Actor, submissionId: string): Promise<{
  submission: { id: string; status: string };
  payment: Payment;
}> {
  const submission = await getSubmission(submissionId);
  if (!submission) throw new DomainError("Submission not found", "not_found");
  const mission = await getMission(submission.mission_id);
  if (!mission) throw new DomainError("Mission not found", "not_found");
  if (actor.role !== "company" || mission.company_id !== actor.id) {
    throw new DomainError("Only the company can approve submissions", "forbidden");
  }
  if (submission.status === "approved") {
    const existing = await getPaymentForSubmission(submissionId);
    if (existing) return { submission: { id: submission.id, status: submission.status }, payment: existing };
  }
  if (submission.status !== "pending") {
    throw new DomainError("Submission is not pending", "invalid_state");
  }

  const developer = await getProfileById(submission.developer_id);
  if (!developer?.wallet_address) {
    throw new DomainError("Developer has not set a payout wallet", "no_wallet");
  }

  const existingPay = await getPaymentForSubmission(submissionId);
  if (existingPay?.status === "paid") {
    throw new DomainError("Payout already completed", "duplicate_payout");
  }

  // A mission that was never charged is charged here, so the fee is never skipped.
  const funded = await fundMission(actor, mission.id);

  const admin = createAdminClient();
  let payment: Payment;
  if (existingPay) {
    payment = existingPay;
  } else {
    const { data, error } = await admin
      .from("payments")
      .insert({
        mission_id: mission.id,
        submission_id: submission.id,
        developer_id: developer.id,
        amount: mission.reward_amount,
        currency: mission.reward_currency,
        chain: "base",
        wallet_address: developer.wallet_address,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        const again = await getPaymentForSubmission(submissionId);
        if (again) payment = again;
        else throw new DomainError(error.message, "db");
      } else {
        throw new DomainError(error.message, "db");
      }
    } else {
      payment = data as Payment;
    }
  }

  await admin.from("payments").update({ status: "processing", error: null }).eq("id", payment.id);

  try {
    const { hash, chain } = await payDeveloper(
      funded,
      developer.wallet_address,
      Number(mission.reward_amount),
    );
    const { data: paid, error: payErr } = await admin
      .from("payments")
      .update({
        status: "paid",
        transaction_hash: hash,
        chain,
        error: null,
      })
      .eq("id", payment.id)
      .select("*")
      .single();
    if (payErr) throw new DomainError(payErr.message, "db");

    await admin.from("submissions").update({ status: "approved" }).eq("id", submission.id);
    await releaseMissionFunding(mission.id);
    await setMissionStatus(mission.id, "completed");
    return {
      submission: { id: submission.id, status: "approved" },
      payment: paid as Payment,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payout failed";
    const { data: failed } = await admin
      .from("payments")
      .update({ status: "failed", error: message })
      .eq("id", payment.id)
      .select("*")
      .single();
    throw new DomainError(
      `Approval saved a payment record but payout failed: ${message}`,
      "payout_failed",
    );
    void failed;
  }
}

export async function retryPayout(actor: Actor, paymentId: string): Promise<Payment> {
  const admin = createAdminClient();
  const { data: payment, error } = await admin
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw new DomainError(error.message, "db");
  if (!payment) throw new DomainError("Payment not found", "not_found");
  const typed = payment as Payment;
  if (typed.status === "paid") return typed;

  const mission = await getMission(typed.mission_id);
  if (!mission) throw new DomainError("Mission not found", "not_found");
  if (actor.role !== "company" || mission.company_id !== actor.id) {
    throw new DomainError("Only the company can retry payouts", "forbidden");
  }

  await admin.from("payments").update({ status: "processing", error: null }).eq("id", paymentId);
  try {
    const { hash, chain } = await payDeveloper(
      mission,
      typed.wallet_address,
      Number(typed.amount),
    );
    const { data: paid, error: payErr } = await admin
      .from("payments")
      .update({ status: "paid", transaction_hash: hash, chain, error: null })
      .eq("id", paymentId)
      .select("*")
      .single();
    if (payErr) throw new DomainError(payErr.message, "db");
    await admin.from("submissions").update({ status: "approved" }).eq("id", typed.submission_id);
    await releaseMissionFunding(typed.mission_id);
    await setMissionStatus(typed.mission_id, "completed");
    return paid as Payment;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payout failed";
    await admin.from("payments").update({ status: "failed", error: message }).eq("id", paymentId);
    throw new DomainError(message, "payout_failed");
  }
}
