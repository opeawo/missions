import { createAdminClient } from "@/lib/supabase/admin";
import { getMission, setMissionStatus } from "./missions";
import { getProfileById } from "./profiles";
import { getSubmission } from "./submissions";
import { getPaymentForSubmission } from "./payment-queries";
import { DomainError, type Actor, type Payment } from "./types";

const BASE_USDC = process.env.USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function paymentMode(): "mock" | "live" {
  return process.env.PAYMENT_MODE === "live" ? "live" : "mock";
}

async function sendUsdc(to: string, amount: number): Promise<{ hash: string; chain: string }> {
  if (paymentMode() === "mock") {
    return { hash: `mock_${Date.now()}`, chain: "base" };
  }

  const secretKey = process.env.THIRDWEB_SECRET_KEY;
  const privateKey = process.env.PAYOUT_WALLET_PRIVATE_KEY;
  if (!secretKey || !privateKey) {
    throw new DomainError(
      "Live payouts require THIRDWEB_SECRET_KEY and PAYOUT_WALLET_PRIVATE_KEY",
      "payout_config",
    );
  }

  const { createThirdwebClient, sendAndConfirmTransaction } = await import("thirdweb");
  const { privateKeyToAccount } = await import("thirdweb/wallets");
  const { base } = await import("thirdweb/chains");
  const { getContract } = await import("thirdweb");
  const { transfer } = await import("thirdweb/extensions/erc20");

  const client = createThirdwebClient({ secretKey });
  const account = privateKeyToAccount({ client, privateKey });
  const contract = getContract({
    client,
    chain: base,
    address: BASE_USDC,
  });
  const transaction = transfer({
    contract,
    to,
    amount: String(amount),
  });
  const receipt = await sendAndConfirmTransaction({ account, transaction });
  return { hash: receipt.transactionHash, chain: "base" };
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
    const { hash, chain } = await sendUsdc(developer.wallet_address, Number(mission.reward_amount));
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
    const { hash, chain } = await sendUsdc(typed.wallet_address, Number(typed.amount));
    const { data: paid, error: payErr } = await admin
      .from("payments")
      .update({ status: "paid", transaction_hash: hash, chain, error: null })
      .eq("id", paymentId)
      .select("*")
      .single();
    if (payErr) throw new DomainError(payErr.message, "db");
    await admin.from("submissions").update({ status: "approved" }).eq("id", typed.submission_id);
    await setMissionStatus(typed.mission_id, "completed");
    return paid as Payment;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payout failed";
    await admin.from("payments").update({ status: "failed", error: message }).eq("id", paymentId);
    throw new DomainError(message, "payout_failed");
  }
}
