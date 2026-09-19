"use client";

import { useState } from "react";
import { updateProfileAction } from "@/app/actions/profile";
import { COUNTRY_OPTIONS } from "@/lib/countries";
import type { Profile } from "@/lib/domain/types";
import { SubmitButton } from "./SubmitButton";
import { FormError, FormSuccess } from "./FormBanner";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const extra = profile.other_links?.length ? profile.other_links : [{ label: "", url: "" }];

  async function action(formData: FormData) {
    setError(null);
    setOk(null);
    const result = await updateProfileAction(formData);
    if (result && "error" in result && result.error) setError(result.error);
    else setOk("Saved");
  }

  return (
    <form action={action} className="card space-y-4">
      <FormError error={error} />
      <FormSuccess message={ok} />
      <div>
        <label htmlFor="display_name">Display name</label>
        <input id="display_name" name="display_name" defaultValue={profile.display_name} required />
      </div>
      {profile.role === "developer" && (
        <>
          <div>
            <label htmlFor="country">Country of residence</label>
            <select id="country" name="country" defaultValue={profile.country ?? ""}>
              <option value="">Select</option>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wallet_address">Payout wallet (Base / USDC)</label>
            <input
              id="wallet_address"
              name="wallet_address"
              defaultValue={profile.wallet_address ?? ""}
              placeholder="0x..."
            />
          </div>
          <div>
            <label htmlFor="github_url">GitHub</label>
            <input id="github_url" name="github_url" defaultValue={profile.github_url ?? ""} />
          </div>
          <div>
            <label htmlFor="linkedin_url">LinkedIn</label>
            <input id="linkedin_url" name="linkedin_url" defaultValue={profile.linkedin_url ?? ""} />
          </div>
          <div>
            <label htmlFor="x_url">X / Twitter</label>
            <input id="x_url" name="x_url" defaultValue={profile.x_url ?? ""} />
          </div>
          <div>
            <label htmlFor="substack_url">Substack</label>
            <input id="substack_url" name="substack_url" defaultValue={profile.substack_url ?? ""} />
          </div>
          <div className="space-y-2">
            <p className="muted text-sm">Other links</p>
            {extra.map((l, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <input name="link_label" placeholder="Label" defaultValue={l.label} />
                <input name="link_url" placeholder="https://" defaultValue={l.url} />
              </div>
            ))}
          </div>
        </>
      )}
      <div className="border-t border-line pt-4">
        <SubmitButton>Save profile</SubmitButton>
      </div>
    </form>
  );
}
