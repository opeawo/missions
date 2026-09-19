"use client";

import { useState } from "react";
import { signIn, signUp } from "@/app/actions/auth";
import { SubmitButton } from "../components/SubmitButton";
import { FormError, FormSuccess } from "../components/FormBanner";

export function LoginForm({ next, signup: startOnSignup }: { next?: string; signup?: boolean }) {
  const [signup, setSignup] = useState(Boolean(startOnSignup));
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function action(formData: FormData) {
    setError(null);
    setOk(null);
    const result = signup ? await signUp(formData) : await signIn(formData);
    if (result?.error) setError(result.error);
    if (result && "message" in result && result.message) {
      setOk(result.message);
      setSignup(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-section">{signup ? "Create account" : "Sign in"}</h1>
        <p className="text-lead mt-3">
          {signup
            ? "Use email and password. Choose whether you post missions or claim them."
            : "Sign in to manage missions or connect your account to Cursor."}
        </p>
      </div>
      <form action={action} className="card space-y-4">
        <FormError error={error} />
        <FormSuccess message={ok} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {signup ? (
          <>
            <div>
              <label htmlFor="display_name">Display name</label>
              <input
                id="display_name"
                name="display_name"
                type="text"
                required
                autoComplete="name"
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-2 font-mono text-[12px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                I am a
              </legend>
              <label>
                <input type="radio" name="role" value="company" required />
                Company — I post missions
              </label>
              <label>
                <input type="radio" name="role" value="developer" required />
                Developer — I claim missions
              </label>
            </fieldset>
          </>
        ) : null}
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
            minLength={signup ? 6 : undefined}
            autoComplete={signup ? "new-password" : "current-password"}
          />
        </div>
        {signup ? (
          <div>
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
        ) : null}
        <SubmitButton className="btn-primary w-full">
          {signup ? "Create account" : "Sign in"}
        </SubmitButton>
        <p className="muted text-center text-sm">
          {signup ? "Already have an account?" : "Need an account?"}{" "}
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => {
              setError(null);
              setOk(null);
              setSignup(!signup);
            }}
          >
            {signup ? "Sign in" : "Create one"}
          </button>
        </p>
      </form>
    </div>
  );
}
