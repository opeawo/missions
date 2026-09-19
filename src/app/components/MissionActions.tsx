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
    <form action={action} className="card space-y-4">
      <div>
        <h2 className="font-medium tracking-tight">Submit work</h2>
        <p className="muted mt-1 text-sm">
          Required: {mission.required_deliverables.join(", ") || "none specified"}
        </p>
      </div>
      <FormError error={error} />
      <FormSuccess message={ok} />
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
      <div className="border-t border-line pt-4">
        <SubmitButton>Submit evidence</SubmitButton>
      </div>
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
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-medium tracking-tight">Submission</h2>
        <span className="badge" data-status={submission.status}>
          {submission.status}
        </span>
      </div>
      <FormError error={error} />
      {payment?.status === "paid" && (
        <FormSuccess message={`Paid. Tx ${payment.transaction_hash}`} />
      )}
      {payment?.status === "failed" && <FormError error={payment.error || "Payout failed"} />}
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{submission.description}</p>
      <ul className="space-y-1.5 text-sm">
        <EvidenceLink label="Repo" href={submission.repository_url} />
        <EvidenceLink label="Demo" href={submission.demo_url} />
        <EvidenceLink label="Video" href={submission.video_url} />
        {submission.post_urls?.map((u) => (
          <EvidenceLink key={u} label="Post" href={u} />
        ))}
      </ul>
      {urls.length > 0 && (
        <div className="border-t border-line pt-4">
          <h3 className="text-label text-muted-foreground">
            Automatic checks
          </h3>
          <ul className="muted mt-2 space-y-1 text-sm">
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
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <form action={approve}>
            <SubmitButton>Approve and pay</SubmitButton>
          </form>
          <form action={reject}>
            <SubmitButton className="btn-quiet">Reject</SubmitButton>
          </form>
        </div>
      )}
      {payment?.status === "failed" && (
        <form action={retry}>
          <SubmitButton className="btn-ghost">Retry payout</SubmitButton>
        </form>
      )}
    </div>
  );
}

function EvidenceLink({ label, href }: { label: string; href: string | null }) {
  if (!href) return null;
  return (
    <li className="flex gap-2">
      <span className="muted w-14 shrink-0">{label}</span>
      <a
        className="truncate text-accent underline-offset-4 hover:underline"
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        {href}
      </a>
    </li>
  );
}
