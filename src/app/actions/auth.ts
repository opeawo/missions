"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProfile, DomainError } from "@/lib/domain";
import { createServerSupabase } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/domain/types";

function safeNext(formData: FormData) {
  const requestedNext = String(formData.get("next") || "");
  return requestedNext.startsWith("/oauth/authorize?") ? requestedNext : "/";
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const next = safeNext(formData);
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect(next);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  const display_name = String(formData.get("display_name") || "").trim();
  const role = String(formData.get("role") || "") as UserRole;
  const next = safeNext(formData);

  if (!email || !password) return { error: "Email and password are required" };
  if (password.length < 6) return { error: "Password must be at least 6 characters" };
  if (password !== confirm) return { error: "Passwords do not match" };
  if (!display_name) return { error: "Display name is required" };
  if (role !== "company" && role !== "developer") {
    return { error: "Choose company or developer" };
  }

  const supabase = await createServerSupabase();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/login`,
      data: { display_name, role },
    },
  });
  if (error) return { error: error.message };
  if (!data.user) return { error: "Could not create account" };
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: "An account with this email already exists. Sign in instead." };
  }

  try {
    await createProfile({ id: data.user.id, role, display_name });
  } catch (err) {
    if (err instanceof DomainError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Could not create profile" };
  }

  if (!data.session) {
    return { message: "Check your email to confirm your account, then sign in." };
  }

  revalidatePath("/");
  redirect(next);
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/login");
}
