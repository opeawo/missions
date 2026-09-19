"use server";

import { requireActor } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { draftMission } from "@/lib/domain/draft";

export async function draftMissionAction(formData: FormData) {
  try {
    const { actor } = await requireActor();
    if (actor.role !== "company") return { error: "Only companies can draft missions" };
    const draft = await draftMission({
      instruction: String(formData.get("instruction") || ""),
      productWebsite: String(formData.get("productWebsite") || "") || undefined,
      documentation: String(formData.get("documentation") || "") || undefined,
      repositoryContext: String(formData.get("repositoryContext") || "") || undefined,
    });
    return { ok: true as const, draft };
  } catch (err) {
    if (err instanceof DomainError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Draft failed" };
  }
}
