import { createAdminClient } from "@/lib/supabase/admin";
import { DomainError, type Payment } from "./types";

export async function getPaymentForSubmission(submissionId: string): Promise<Payment | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payments")
    .select("*")
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (error) throw new DomainError(error.message, "db");
  return (data as Payment) ?? null;
}

export async function getPaymentForMission(missionId: string): Promise<Payment | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payments")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new DomainError(error.message, "db");
  return (data as Payment) ?? null;
}
