"use client";

import { useState } from "react";
import { signIn } from "@/app/actions/auth";
import { SubmitButton } from "../components/SubmitButton";
import { FormError } from "../components/FormBanner";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  async function action(formData: FormData) {
    const result = await signIn(formData);
    if (result?.error) setError(result.error);
  }
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-3xl font-semibold">Sign in</h1>
      <p className="muted">Company and developer demo accounts live in your local env.</p>
      <form action={action} className="card space-y-4">
        <FormError error={error} />
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <SubmitButton>Sign in</SubmitButton>
      </form>
    </div>
  );
}
