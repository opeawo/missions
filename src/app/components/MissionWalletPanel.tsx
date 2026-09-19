"use client";

import { useEffect, useState } from "react";
import {
  provisionMissionWalletAction,
  sweepMissionWalletAction,
} from "@/app/actions/wallets";
import type { MissionFunding, MissionSweep, Refund } from "@/lib/domain";
import { formatReward, truncateWallet } from "@/lib/format";
import { SubmitButton } from "./SubmitButton";
import { FormError, FormSuccess } from "./FormBanner";
import { DepositAddress } from "./DepositAddress";

export function MissionWalletPanel({
  missionId,
  funding,
  sweep,
  refunds,
}: {
  missionId: string;
  funding: MissionFunding;
  sweep: MissionSweep | null;
  refunds: Refund[];
}) {
  const [error, setError] = useState<string | null>(funding.balanceError);
  const [ok, setOk] = useState<string | null>(null);
  const feePercent = funding.feeBps / 100;
  const funded = funding.status !== "unfunded";
  const canSweep = Boolean(sweep && sweep.allocations.length > 0);

  async function provision() {
    setError(null);
    const result = await provisionMissionWalletAction(missionId);
    if (result && "error" in result) setError(result.error);
  }

  useEffect(() => {
    if (funding.address) return;
    let cancelled = false;
    void provisionMissionWalletAction(missionId).then((result) => {
      if (cancelled) return;
      if (result && "error" in result) setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [funding.address, missionId]);

  async function sweepFunds() {
    setError(null);
    setOk(null);
    const result = await sweepMissionWalletAction(missionId);
    if (result && "error" in result) setError(result.error);
    else setOk("Unspent USDC returned to the depositing address.");
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-medium tracking-tight">Mission wallet</h2>
        <p className="muted mt-1 text-sm">
          {funded
            ? `Fee of ${formatReward(funding.fee)} collected. The reward stays here until you approve the work.`
            : `Deposit ${formatReward(funding.required)} to publish: ${formatReward(funding.reward)} for the developer plus a ${feePercent}% platform fee of ${formatReward(funding.fee)}.`}
        </p>
      </div>

      <FormError error={error} />
      <FormSuccess message={ok} />

      {funding.address ? (
        <>
          <DepositAddress address={funding.address} />
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="muted text-xs uppercase tracking-wide">Balance</dt>
              <dd className="mt-1 text-sm tabular-nums">{formatReward(funding.balance)}</dd>
            </div>
            <div>
              <dt className="muted text-xs uppercase tracking-wide">
                {funded ? "Reward held" : "Required"}
              </dt>
              <dd className="mt-1 text-sm tabular-nums">
                {formatReward(funded ? funding.reward : funding.required)}
              </dd>
            </div>
            <div>
              <dt className="muted text-xs uppercase tracking-wide">Still needed</dt>
              <dd className={`mt-1 text-sm tabular-nums ${funding.shortfall > 0 ? "" : "text-good"}`}>
                {formatReward(funding.shortfall)}
              </dd>
            </div>
          </dl>
          {canSweep && sweep && (
            <div className="space-y-2 border-t border-line pt-4">
              <p className="text-sm font-medium">
                {formatReward(sweep.returning)} to return
                {sweep.returning < sweep.sweepable
                  ? ` of ${formatReward(sweep.sweepable)} unspent`
                  : ""}
              </p>
              <p className="muted text-sm">
                Returned only to the address that deposited it, never to one you choose:
              </p>
              <ul className="space-y-1 font-mono text-xs">
                {sweep.allocations.map((allocation) => (
                  <li key={allocation.to}>
                    {truncateWallet(allocation.to)} → {formatReward(allocation.amount)}
                  </li>
                ))}
              </ul>
              <form action={sweepFunds}>
                <SubmitButton className="btn-ghost">Return unspent USDC</SubmitButton>
              </form>
            </div>
          )}

          {sweep?.blockedReason && <p className="muted text-xs">{sweep.blockedReason}</p>}

          {refunds.length > 0 && (
            <div className="space-y-1 border-t border-line pt-4">
              <p className="text-sm font-medium">Returned funds</p>
              <ul className="space-y-1 text-xs muted">
                {refunds.map((refund) => (
                  <li key={refund.id} className="font-mono">
                    {formatReward(refund.amount)} → {truncateWallet(refund.to_address)} ·{" "}
                    {refund.status}
                    {refund.error ? ` · ${refund.error}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {funding.mode === "mock" && (
            <p className="muted text-xs">
              PAYMENT_MODE=mock — fees and payouts are recorded but no USDC moves.
            </p>
          )}
        </>
      ) : (
        <form action={provision} className="space-y-2">
          <p className="muted text-sm">
            No wallet yet. This mission gets its own thirdweb server wallet, so its funds are never
            mixed with another mission&apos;s.
          </p>
          <SubmitButton>Create mission wallet</SubmitButton>
        </form>
      )}
    </div>
  );
}
