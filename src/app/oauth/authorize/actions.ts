"use server";

import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import {
  createAuthorizationCode,
  validateAuthorizationRequest,
} from "../../../../mcp/oauth";

export async function approveMcpConnection(formData: FormData) {
  const values = Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  );
  const request = await validateAuthorizationRequest(values);
  const profile = await getProfile();
  if (!profile) {
    throw new Error("Sign in required");
  }
  const code = await createAuthorizationCode(request, profile.id);
  const callback = new URL(request.redirectUri);
  callback.searchParams.set("code", code);
  if (request.state) callback.searchParams.set("state", request.state);
  redirect(callback.toString());
}
