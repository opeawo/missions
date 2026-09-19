import { createAdminClient } from "@/lib/supabase/admin";
import { getClaimForMission } from "./claims";
import { getMission } from "./missions";
import { classifyUrl, verifySubmissionUrls } from "./verify";
import {
  DomainError,
  type Actor,
  type Attachment,
  type DeliverableType,
  type Submission,
} from "./types";

export type SubmitInput = {
  description?: string;
  repository_url?: string | null;
  demo_url?: string | null;
  video_url?: string | null;
  post_urls?: string[];
  attachments?: Attachment[];
};

function hasDeliverable(
  required: DeliverableType[],
  key: DeliverableType,
  ok: boolean,
) {
  if (!required.includes(key)) return;
  if (!ok) {
    throw new DomainError(`Missing required deliverable: ${key}`, "validation");
  }
}

function enforceRequired(required: DeliverableType[], input: SubmitInput) {
  const posts = (input.post_urls ?? []).filter(Boolean);
  const types = posts.map(classifyUrl);
  hasDeliverable(required, "description", Boolean(input.description?.trim()));
  hasDeliverable(required, "repository", Boolean(input.repository_url?.trim()));
  hasDeliverable(required, "demo", Boolean(input.demo_url?.trim()));
  hasDeliverable(required, "video", Boolean(input.video_url?.trim()));
  hasDeliverable(required, "files", Boolean((input.attachments ?? []).length));
  hasDeliverable(required, "linkedin", types.includes("linkedin"));
  hasDeliverable(required, "x", types.includes("x"));
  hasDeliverable(required, "substack", types.includes("substack"));
  hasDeliverable(required, "blog", types.includes("blog") || types.includes("other"));
}

export async function submitWork(
  actor: Actor,
  missionId: string,
  input: SubmitInput,
): Promise<Submission> {
  if (actor.role !== "developer") {
    throw new DomainError("Only developers can submit work", "forbidden");
  }
  const mission = await getMission(missionId);
  if (!mission) throw new DomainError("Mission not found", "not_found");
  if (mission.status !== "claimed") {
    throw new DomainError("Mission is not in a submittable state", "invalid_state");
  }
  const claim = await getClaimForMission(missionId);
  if (!claim || claim.developer_id !== actor.id) {
    throw new DomainError("You have not claimed this mission", "forbidden");
  }

  enforceRequired(mission.required_deliverables, input);

  const verification = {
    urls: await verifySubmissionUrls({
      missionTitle: mission.title,
      repository_url: input.repository_url,
      demo_url: input.demo_url,
      video_url: input.video_url,
      post_urls: input.post_urls,
    }),
  };

  const payload = {
    mission_id: missionId,
    claim_id: claim.id,
    developer_id: actor.id,
    description: input.description?.trim() || "",
    repository_url: input.repository_url?.trim() || null,
    demo_url: input.demo_url?.trim() || null,
    video_url: input.video_url?.trim() || null,
    post_urls: (input.post_urls ?? []).map((u) => u.trim()).filter(Boolean),
    attachments: input.attachments ?? [],
    status: "pending" as const,
    verification,
    submitted_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("submissions")
    .select("id")
    .eq("claim_id", claim.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await admin
      .from("submissions")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new DomainError(error.message, "db");
    return data as Submission;
  }

  const { data, error } = await admin.from("submissions").insert(payload).select("*").single();
  if (error) throw new DomainError(error.message, "db");
  return data as Submission;
}

export async function listSubmissions(missionId: string): Promise<Submission[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("submissions")
    .select("*")
    .eq("mission_id", missionId)
    .order("submitted_at", { ascending: false });
  if (error) throw new DomainError(error.message, "db");
  return (data as Submission[]) ?? [];
}

export type CompanySubmissionRow = Submission & { mission_title: string };

export async function listCompanySubmissions(companyId: string): Promise<CompanySubmissionRow[]> {
  const admin = createAdminClient();
  const { data: missions, error: missionError } = await admin
    .from("missions")
    .select("id, title")
    .eq("company_id", companyId);
  if (missionError) throw new DomainError(missionError.message, "db");
  const rows = (missions ?? []) as { id: string; title: string }[];
  if (rows.length === 0) return [];

  const titles = new Map(rows.map((m) => [m.id, m.title]));
  const { data, error } = await admin
    .from("submissions")
    .select("*")
    .in(
      "mission_id",
      rows.map((m) => m.id),
    )
    .order("submitted_at", { ascending: false });
  if (error) throw new DomainError(error.message, "db");
  return ((data as Submission[]) ?? []).map((submission) => ({
    ...submission,
    mission_title: titles.get(submission.mission_id) ?? "Mission",
  }));
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("submissions").select("*").eq("id", id).maybeSingle();
  if (error) throw new DomainError(error.message, "db");
  return (data as Submission) ?? null;
}

export async function rejectSubmission(actor: Actor, submissionId: string): Promise<Submission> {
  const submission = await getSubmission(submissionId);
  if (!submission) throw new DomainError("Submission not found", "not_found");
  const mission = await getMission(submission.mission_id);
  if (!mission) throw new DomainError("Mission not found", "not_found");
  if (actor.role !== "company" || mission.company_id !== actor.id) {
    throw new DomainError("Only the company can reject submissions", "forbidden");
  }
  if (submission.status !== "pending") {
    throw new DomainError("Submission is not pending", "invalid_state");
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("submissions")
    .update({ status: "rejected" })
    .eq("id", submissionId)
    .select("*")
    .single();
  if (error) throw new DomainError(error.message, "db");
  return data as Submission;
}
