import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Actor, Profile } from "@/lib/domain/types";

export async function getSessionUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile) ?? null;
}

export async function requireActor(): Promise<{ actor: Actor; profile: Profile }> {
  const profile = await getProfile();
  if (!profile) {
    throw new Error("Sign in required");
  }
  return {
    actor: { id: profile.id, role: profile.role, displayName: profile.display_name },
    profile,
  };
}
