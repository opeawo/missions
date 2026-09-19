"use client";

import { useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { FormError } from "./FormBanner";
import { missionRewardIsLocked, DELIVERABLE_TYPES, type DeliverableType, type Mission } from "@/lib/domain/types";
import { createMissionAction, updateMissionAction } from "@/app/actions/missions";
import { DraftAssist } from "./DraftAssist";
import { depositForBudget } from "@/lib/pricing";
import { formatReward } from "@/lib/format";

const labels: Record<DeliverableType, string> = {
  description: "Written description",
  repository: "Repository URL",
  demo: "Live demo URL",
  linkedin: "LinkedIn post",
  x: "X post",
  substack: "Substack post",
  blog: "Blog post",
  video: "Video URL",
  files: "File attachment",
};

export function MissionForm({ mission }: { mission?: Mission }) {
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(mission?.title ?? "");
  const [description, setDescription] = useState(mission?.description ?? "");
  const [requirements, setRequirements] = useState(mission?.requirements ?? "");
  const [reward, setReward] = useState(String(mission?.reward_amount ?? "400"));
  const [selected, setSelected] = useState<string[]>(
    mission?.required_deliverables ?? ["repository", "demo", "linkedin"],
  );
  const rewardLocked = mission ? missionRewardIsLocked(mission) : false;
  const deposit = depositForBudget(Number(reward) || 0);

  async function action(formData: FormData) {
    setError(null);
    const result = mission
      ? await updateMissionAction(mission.id, formData)
      : await createMissionAction(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="space-y-8">
      {!mission && (
        <DraftAssist
          onApply={(d) => {
            setTitle(d.title);
            setDescription(d.description);
            setRequirements(d.requirements);
            setReward(String(d.suggested_reward));
            setSelected(d.required_deliverables);
          }}
        />
      )}
      <form action={action} className="card space-y-5">
        <FormError error={error} />
        <div>
          <label htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            required
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="requirements">Requirements</label>
          <textarea
            id="requirements"
            name="requirements"
            rows={4}
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="reward_amount">Budget (developer reward)</label>
            <input
              id="reward_amount"
              name="reward_amount"
              type="number"
              min="1"
              step="0.01"
              required
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              readOnly={rewardLocked}
            />
            {rewardLocked ? (
              <p className="muted mt-1.5 text-xs">Budget is locked after funding.</p>
            ) : (
              <p className="muted mt-1.5 text-xs">
                Minimum 1 USDC. Deposit {formatReward(deposit.required)} to fund:{" "}
                {formatReward(deposit.budget)} reward plus a {deposit.feePercent}% fee of{" "}
                {formatReward(deposit.fee)}. After you save, this mission gets its own wallet address.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="currency">Currency</label>
            <input
              id="currency"
              name="currency"
              defaultValue={mission?.reward_currency ?? "USDC"}
              readOnly={rewardLocked}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="visibility">Visibility</label>
            <select id="visibility" name="visibility" defaultValue={mission?.visibility ?? "public"}>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
          <div>
            <label htmlFor="deadline">Deadline (optional)</label>
            <input
              id="deadline"
              name="deadline"
              type="datetime-local"
              defaultValue={mission?.deadline ? mission.deadline.slice(0, 16) : ""}
            />
          </div>
        </div>
        <fieldset>
          <legend className="mb-3 text-label text-muted-foreground">Required deliverables</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {DELIVERABLE_TYPES.map((d) => {
              const checked = selected.includes(d);
              return (
                <label
                  key={d}
                  className={`mb-0 flex cursor-pointer items-center gap-2.5 border px-3 py-2.5 text-sm transition-colors ${
                    checked
                      ? "border-accent/40 bg-accent/5 text-foreground"
                      : "border-border text-foreground hover:border-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="deliverables"
                    value={d}
                    checked={checked}
                    onChange={(e) => {
                      setSelected((prev) =>
                        e.target.checked ? [...prev, d] : prev.filter((x) => x !== d),
                      );
                    }}
                  />
                  <span>{labels[d]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="border-t border-line pt-4">
          <SubmitButton>{mission ? "Save changes" : "Create draft"}</SubmitButton>
        </div>
      </form>
    </div>
  );
}
