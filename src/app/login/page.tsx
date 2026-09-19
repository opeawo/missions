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
    <div className="container-editorial mx-auto max-w-md space-y-8 py-16">
      <div>
        <h1 className="text-section">Sign in</h1>
        <p className="text-lead mt-3">
          Company and developer demo accounts live in your local env.
        </p>
      </div>
      <form action={action} className="card space-y-4">
        <FormError error={error} />
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <SubmitButton className="btn-primary w-full">Sign in</SubmitButton>
      </form>
    </div>
  );
}
