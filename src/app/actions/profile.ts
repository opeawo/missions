"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth";
import { DomainError, updateProfile } from "@/lib/domain";
import type { OtherLink } from "@/lib/domain/types";

export async function updateProfileAction(formData: FormData) {
  try {
    const { actor } = await requireActor();
    const labels = formData.getAll("link_label").map(String);
    const urls = formData.getAll("link_url").map(String);
    const other_links: OtherLink[] = labels
      .map((label, i) => ({ label: label || "Link", url: urls[i] || "" }))
      .filter((l) => l.url.trim());
    await updateProfile(actor, {
      display_name: String(formData.get("display_name") || ""),
      wallet_address: String(formData.get("wallet_address") || ""),
      country: String(formData.get("country") || ""),
      github_url: String(formData.get("github_url") || ""),
      linkedin_url: String(formData.get("linkedin_url") || ""),
      x_url: String(formData.get("x_url") || ""),
      substack_url: String(formData.get("substack_url") || ""),
      other_links,
    });
    revalidatePath("/me");
    return { ok: true as const };
  } catch (err) {
    if (err instanceof DomainError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Could not save profile" };
  }
}
