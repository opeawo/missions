"use client";

import { useState } from "react";
import { retryCampaignLaunchAction } from "@/app/actions/campaigns";
import type { CampaignFunding } from "@/lib/domain";
import { formatReward } from "@/lib/format";
import { FormError } from "./FormBanner";
import { SubmitButton } from "./SubmitButton";

export function CampaignLaunchPanel({
  campaignId,
  funding,
}: {
  campaignId: string;
  funding: CampaignFunding;
}) {
  const [error, setError] = useState<string | null>(null);

  async function launch() {
    setError(null);
    const result = await retryCampaignLaunchAction(campaignId);
    if (result && "error" in result) setError(result.error);
  }

  return (
    <div className="cell space-y-5">
      <div>
        <h2 className="text-title">Fund this campaign</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Deposit {formatReward(funding.required)} to the address below. That covers the developer
          budget plus the platform fee.
        </p>
      </div>
      <FormError error={error} />
      {funding.address ? (
        <div>
          <p className="text-label text-muted-foreground">Deposit address (Base USDC)</p>
          <p className="mt-2 break-all font-mono text-sm">{funding.address}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          The campaign wallet is created on the first launch attempt.
        </p>
      )}
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-label text-muted-foreground">Balance</dt>
          <dd className="mt-1">{formatReward(funding.balance)}</dd>
        </div>
        <div>
          <dt className="text-label text-muted-foreground">Needed</dt>
          <dd className="mt-1">{formatReward(funding.required)}</dd>
        </div>
        <div>
          <dt className="text-label text-muted-foreground">Still short</dt>
          <dd className="mt-1">{formatReward(funding.shortfall)}</dd>
        </div>
      </dl>
      {funding.mode === "mock" && (
        <p className="text-label text-muted-foreground">
          PAYMENT_MODE=mock — launch records the fee and opens missions without moving USDC.
        </p>
      )}
      <form action={launch}>
        <SubmitButton>Fund & launch</SubmitButton>
      </form>
    </div>
  );
}
