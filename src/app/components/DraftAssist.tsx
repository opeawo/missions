"use client";

import { useState } from "react";
import { draftMissionAction } from "@/app/actions/ai";
import { SubmitButton } from "./SubmitButton";
import { FormError } from "./FormBanner";
import type { MissionDraft } from "@/lib/domain/types";

export function DraftAssist({ onApply }: { onApply: (draft: MissionDraft) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function action(formData: FormData) {
    setError(null);
    const result = await draftMissionAction(formData);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    if ("draft" in result && result.draft) onApply(result.draft);
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="muted text-sm">Start from a prompt instead of a blank form.</p>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide AI assist" : "Draft with AI"}
        </button>
      </div>
      {open && (
        <form action={action} className="mt-5 space-y-4 border-t border-line pt-5">
          <FormError error={error} />
          <div>
            <label htmlFor="instruction">Instruction</label>
            <textarea
              id="instruction"
              name="instruction"
              required
              rows={3}
              placeholder="Build a compelling real-world example and write about it publicly."
            />
          </div>
          <div>
            <label htmlFor="productWebsite">Product website</label>
            <input id="productWebsite" name="productWebsite" placeholder="https://" />
          </div>
          <div>
            <label htmlFor="documentation">Documentation or notes</label>
            <textarea id="documentation" name="documentation" rows={3} />
          </div>
          <div>
            <label htmlFor="repositoryContext">Repository context</label>
            <textarea id="repositoryContext" name="repositoryContext" rows={4} />
          </div>
          <SubmitButton>Generate draft</SubmitButton>
          <p className="muted text-xs">You still review and publish. AI never goes live on its own.</p>
        </form>
      )}
    </div>
  );
}
