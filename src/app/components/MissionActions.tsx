"use client";

import { useState } from "react";
import {
  approveSubmissionAction,
  claimMissionAction,
  publishMissionAction,
  rejectSubmissionAction,
  retryPayoutAction,
  submitWorkAction,
} from "@/app/actions/missions";
import { SubmitButton } from "./SubmitButton";
import { FormError, FormSuccess } from "./FormBanner";
import { verificationLabel } from "@/lib/domain/verify";
import type { Mission, Payment, Submission } from "@/lib/domain/types";

export function PublishButton({ missionId }: { missionId: string }) {
  const [error, setError] = useState<string | null>(null);
  async function action() {
    const result = await publishMissionAction(missionId);
    if (result && "error" in result) setError(result.error);
  }
  return (
    <form action={action} className="space-y-2">
      <FormError error={error} />
      <SubmitButton>Publish mission</SubmitButton>
    </form>
  );
}

export function ClaimButton({ missionId }: { missionId: string }) {
  const [error, setError] = useState<string | null>(null);
  async function action() {
    const result = await claimMissionAction(missionId);
    if (result && "error" in result) setError(result.error);
  }
  return (
    <form action={action} className="space-y-2">
      <FormError error={error} />
      <SubmitButton>Claim this mission</SubmitButton>
    </form>
  );
}

export function SubmitWorkForm({ mission }: { mission: Mission }) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  async function action(formData: FormData) {
    setError(null);
    setOk(null);
    const result = await submitWorkAction(mission.id, formData);
    if (result && "error" in result) setError(result.error);
    else setOk("Submission received. Waiting for company review.");
  }
  return (
    <form action={action} className="card space-y-3">
      <h2 className="text-lg font-semibold">Submit work</h2>
      <FormError error={error} />
      <FormSuccess message={ok} />
      <p className="muted text-sm">
        Required: {mission.required_deliverables.join(", ") || "none specified"}
      </p>
      <div>
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={4} />
      </div>
      <div>
        <label htmlFor="repository_url">Repository URL</label>
        <input id="repository_url" name="repository_url" placeholder="https://github.com/..." />
      </div>
      <div>
        <label htmlFor="demo_url">Demo URL</label>
        <input id="demo_url" name="demo_url" placeholder="https://" />
      </div>
      <div>
        <label htmlFor="video_url">Video URL</label>
        <input id="video_url" name="video_url" />
      </div>
      <div>
        <label htmlFor="post_urls">Public post URLs (one per line)</label>
        <textarea
          id="post_urls"
          name="post_urls"
          rows={3}
          placeholder="https://linkedin.com/posts/...&#10;https://x.com/..."
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="attachment_name">Attachment name</label>
          <input id="attachment_name" name="attachment_name" />
        </div>
        <div>
          <label htmlFor="attachment_url">Attachment URL</label>
          <input id="attachment_url" name="attachment_url" />
        </div>
      </div>
      <SubmitButton>Submit evidence</SubmitButton>
    </form>
  );
}

export function ReviewPanel({
  missionId,
  submission,
  payment,
}: {
  missionId: string;
  submission: Submission;
  payment: Payment | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const urls = submission.verification?.urls ?? [];

  async function approve() {
    const result = await approveSubmissionAction(submission.id, missionId);
    if (result && "error" in result) setError(result.error);
  }
  async function reject() {
    const result = await rejectSubmissionAction(submission.id, missionId);
    if (result && "error" in result) setError(result.error);
  }
  async function retry() {
    if (!payment) return;
    const result = await retryPayoutAction(payment.id, missionId);
    if (result && "error" in result) setError(result.error);
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-semibold">Submission</h2>
      <FormError error={error} />
      {payment?.status === "paid" && (
        <FormSuccess message={`Paid. Tx ${payment.transaction_hash}`} />
      )}
      {payment?.status === "failed" && (
        <FormError error={payment.error || "Payout failed"} />
      )}
      <p>{submission.description}</p>
      <ul className="space-y-1 text-sm">
        {submission.repository_url && (
          <li>
            Repo:{" "}
            <a className="text-[var(--accent)]" href={submission.repository_url}>
              {submission.repository_url}
            </a>
          </li>
        )}
        {submission.demo_url && (
          <li>
            Demo:{" "}
            <a className="text-[var(--accent)]" href={submission.demo_url}>
              {submission.demo_url}
            </a>
          </li>
        )}
        {submission.video_url && (
          <li>
            Video:{" "}
            <a className="text-[var(--accent)]" href={submission.video_url}>
              {submission.video_url}
            </a>
          </li>
        )}
        {submission.post_urls?.map((u) => (
          <li key={u}>
            Post:{" "}
            <a className="text-[var(--accent)]" href={u}>
              {u}
            </a>
          </li>
        ))}
      </ul>
      {urls.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Automatic checks</h3>
          <ul className="mt-2 space-y-1 text-sm muted">
            {urls.map((u) => (
              <li key={u.url}>
                {verificationLabel(u.status)} — {u.type}: {u.detail}
              </li>
            ))}
          </ul>
          <p className="muted mt-2 text-xs">Company approval is the final authority.</p>
        </div>
      )}
      {submission.status === "pending" && (
        <div className="flex gap-3">
          <form action={approve}>
            <SubmitButton>Approve and pay</SubmitButton>
          </form>
          <form action={reject}>
            <SubmitButton className="btn-ghost">Reject</SubmitButton>
          </form>
        </div>
      )}
      {payment?.status === "failed" && (
        <form action={retry}>
          <SubmitButton>Retry payout</SubmitButton>
        </form>
      )}
    </div>
  );
}
