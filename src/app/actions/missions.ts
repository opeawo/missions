"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth";
import {
  DomainError,
  createMission,
  publishMission,
  updateMission,
  claimMission,
  submitWork,
  rejectSubmission,
} from "@/lib/domain";
import { approveSubmission, retryPayout } from "@/lib/domain/payments";

function fail(err: unknown): { error: string } {
  if (err instanceof DomainError) return { error: err.message };
  if (err instanceof Error) return { error: err.message };
  return { error: "Something went wrong" };
}

export async function createMissionAction(formData: FormData) {
  try {
    const { actor } = await requireActor();
    const deliverables = formData.getAll("deliverables").map(String);
    const mission = await createMission(actor, {
      title: String(formData.get("title") || ""),
      description: String(formData.get("description") || ""),
      reward_amount: Number(formData.get("reward_amount") || 0),
      currency: String(formData.get("currency") || "USDC"),
      requirements: String(formData.get("requirements") || ""),
      required_deliverables: deliverables,
      visibility: formData.get("visibility") === "private" ? "private" : "public",
      deadline: String(formData.get("deadline") || "") || null,
    });
    revalidatePath("/");
    revalidatePath("/missions");
    redirect(`/missions/${mission.id}`);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
    return fail(err);
  }
}

export async function updateMissionAction(missionId: string, formData: FormData) {
  try {
    const { actor } = await requireActor();
    const deliverables = formData.getAll("deliverables").map(String);
    await updateMission(actor, missionId, {
      title: String(formData.get("title") || ""),
      description: String(formData.get("description") || ""),
      reward_amount: Number(formData.get("reward_amount") || 0),
      currency: String(formData.get("currency") || "USDC"),
      requirements: String(formData.get("requirements") || ""),
      required_deliverables: deliverables,
      visibility: formData.get("visibility") === "private" ? "private" : "public",
      deadline: String(formData.get("deadline") || "") || null,
    });
    revalidatePath(`/missions/${missionId}`);
    redirect(`/missions/${missionId}`);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
    return fail(err);
  }
}

export async function publishMissionAction(missionId: string) {
  try {
    const { actor } = await requireActor();
    await publishMission(actor, missionId);
    revalidatePath(`/missions/${missionId}`);
    revalidatePath("/missions");
    return { ok: true as const };
  } catch (err) {
    return fail(err);
  }
}

export async function claimMissionAction(missionId: string) {
  try {
    const { actor } = await requireActor();
    await claimMission(actor, missionId);
    revalidatePath(`/missions/${missionId}`);
    return { ok: true as const };
  } catch (err) {
    return fail(err);
  }
}

export async function submitWorkAction(missionId: string, formData: FormData) {
  try {
    const { actor } = await requireActor();
    const post_urls = String(formData.get("post_urls") || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const attachmentUrl = String(formData.get("attachment_url") || "").trim();
    const attachmentName = String(formData.get("attachment_name") || "file").trim();
    await submitWork(actor, missionId, {
      description: String(formData.get("description") || ""),
      repository_url: String(formData.get("repository_url") || "") || null,
      demo_url: String(formData.get("demo_url") || "") || null,
      video_url: String(formData.get("video_url") || "") || null,
      post_urls,
      attachments: attachmentUrl ? [{ name: attachmentName, url: attachmentUrl }] : [],
    });
    revalidatePath(`/missions/${missionId}`);
    return { ok: true as const };
  } catch (err) {
    return fail(err);
  }
}

export async function approveSubmissionAction(submissionId: string, missionId: string) {
  try {
    const { actor } = await requireActor();
    await approveSubmission(actor, submissionId);
    revalidatePath(`/missions/${missionId}`);
    return { ok: true as const };
  } catch (err) {
    return fail(err);
  }
}

export async function rejectSubmissionAction(submissionId: string, missionId: string) {
  try {
    const { actor } = await requireActor();
    await rejectSubmission(actor, submissionId);
    revalidatePath(`/missions/${missionId}`);
    return { ok: true as const };
  } catch (err) {
    return fail(err);
  }
}

export async function retryPayoutAction(paymentId: string, missionId: string) {
  try {
    const { actor } = await requireActor();
    await retryPayout(actor, paymentId);
    revalidatePath(`/missions/${missionId}`);
    return { ok: true as const };
  } catch (err) {
    return fail(err);
  }
}
