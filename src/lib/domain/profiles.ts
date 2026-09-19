import { createAdminClient } from "@/lib/supabase/admin";
import {
  blankToNull,
  DomainError,
  toDeveloperCard,
  type Actor,
  type OtherLink,
  type Profile,
} from "./types";

export async function getProfileById(id: string): Promise<Profile | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw new DomainError(error.message, "db");
  return (data as Profile) ?? null;
}

export async function updateProfile(
  actor: Actor,
  input: {
    display_name?: string;
    wallet_address?: string | null;
    country?: string | null;
    github_url?: string | null;
    linkedin_url?: string | null;
    x_url?: string | null;
    substack_url?: string | null;
    other_links?: OtherLink[];
  },
): Promise<Profile> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (input.display_name !== undefined) {
    const name = input.display_name.trim();
    if (!name) throw new DomainError("Display name is required", "validation");
    patch.display_name = name;
  }
  if (actor.role === "developer") {
    if (input.wallet_address !== undefined) patch.wallet_address = blankToNull(input.wallet_address);
    if (input.country !== undefined) patch.country = blankToNull(input.country);
    if (input.github_url !== undefined) patch.github_url = blankToNull(input.github_url);
    if (input.linkedin_url !== undefined) patch.linkedin_url = blankToNull(input.linkedin_url);
    if (input.x_url !== undefined) patch.x_url = blankToNull(input.x_url);
    if (input.substack_url !== undefined) patch.substack_url = blankToNull(input.substack_url);
    if (input.other_links !== undefined) {
      patch.other_links = input.other_links.filter((l) => l.url.trim());
    }
  }
  const { data, error } = await admin
    .from("profiles")
    .update(patch)
    .eq("id", actor.id)
    .select("*")
    .single();
  if (error) throw new DomainError(error.message, "db");
  return data as Profile;
}

export { toDeveloperCard };
