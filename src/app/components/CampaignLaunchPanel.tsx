"use client";

import { useEffect, useState } from "react";
import {
  provisionCampaignWalletAction,
  retryCampaignLaunchAction,
  updateCampaignBudgetAction,
} from "@/app/actions/campaigns";
import type { CampaignFunding } from "@/lib/domain";
import { formatReward } from "@/lib/format";
import { FormError } from "./FormBanner";
import { DepositAddress } from "./DepositAddress";
import { SubmitButton } from "./SubmitButton";

export function CampaignLaunchPanel({
  campaignId,
  funding,
  onLaunched,
}: {
  campaignId: string;
  funding: CampaignFunding;
  onLaunched?: () => void;
}) {
  const [current, setCurrent] = useState(funding);
  const [budget, setBudget] = useState(String(funding.budget));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const canEditBudget = current.status === "unfunded";
  const feePercent = current.required > 0 && current.budget > 0
    ? Math.round((current.fee / current.budget) * 1000) / 10
    : 15;

  useEffect(() => {
    setCurrent(funding);
    setBudget(String(funding.budget));
  }, [funding]);

  async function saveBudget() {
    setError(null);
    setPending(true);
    const result = await updateCampaignBudgetAction(campaignId, Number(budget));
    setPending(false);
    if (result && "error" in result) setError(result.error);
    else if (result && "funding" in result) setCurrent(result.funding);
  }

  async function provision() {
    setError(null);
    setPending(true);
    const result = await provisionCampaignWalletAction(campaignId);
    setPending(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    if (result && "address" in result && result.address) {
      setCurrent((prev) => ({ ...prev, address: result.address }));
    }
  }

  async function launch() {
    setError(null);
    const result = await retryCampaignLaunchAction(campaignId);
    if (result && "error" in result) setError(result.error);
    else onLaunched?.();
  }

  return (
    <div className="cell space-y-5">
      <div>
        <h2 className="text-title">Fund this campaign</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Deposit {formatReward(current.required)} to the address below. That covers your budget
          plus the {feePercent}% platform fee.
        </p>
      </div>
      <FormError error={error} />
      {canEditBudget && (
        <div>
          <label htmlFor="campaign-budget">Budget</label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              id="campaign-budget"
              className="max-w-48"
              type="number"
              min="0.01"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <button type="button" className="btn-secondary" onClick={saveBudget} disabled={pending}>
              {pending ? "Saving…" : "Update budget"}
            </button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatReward(current.budget)} for developers plus {formatReward(current.fee)} fee ={" "}
            {formatReward(current.required)} to deposit.
          </p>
        </div>
      )}
      {current.address ? (
        <DepositAddress address={current.address} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No deposit address yet. Create this campaign&apos;s wallet to fund it.
          </p>
          <button type="button" className="btn-secondary" onClick={provision} disabled={pending}>
            {pending ? "Creating wallet…" : "Create deposit wallet"}
          </button>
        </div>
      )}
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-label text-muted-foreground">Balance</dt>
          <dd className="mt-1">{formatReward(current.balance)}</dd>
        </div>
        <div>
          <dt className="text-label text-muted-foreground">Needed</dt>
          <dd className="mt-1">{formatReward(current.required)}</dd>
        </div>
        <div>
          <dt className="text-label text-muted-foreground">Still short</dt>
          <dd className="mt-1">{formatReward(current.shortfall)}</dd>
        </div>
      </dl>
      {current.mode === "mock" && (
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
