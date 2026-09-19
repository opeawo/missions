import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/auth";
import {
  getClaimForMission,
  getMission,
  getPaymentForMission,
  getMissionFunding,
  getMissionSweep,
  getProfileById,
  listRefunds,
  listSubmissions,
  toDeveloperCard,
  type MissionFunding,
  type MissionSweep,
  type Refund,
} from "@/lib/domain";
import { formatDate, formatReward, explorerTxUrl } from "@/lib/format";
import { missionIsEditable } from "@/lib/domain/types";
import { DeveloperCard } from "../../components/DeveloperCard";
import { MissionWalletPanel } from "../../components/MissionWalletPanel";
import {
  ClaimButton,
  PublishButton,
  ReviewPanel,
  SubmitWorkForm,
} from "../../components/MissionActions";

export default async function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mission = await getMission(id);
  if (!mission) notFound();
  const profile = await getProfile().catch(() => null);
  const claim = await getClaimForMission(id);
  const submissions = await listSubmissions(id);
  const submission = submissions[0] ?? null;
  const payment = await getPaymentForMission(id);
  const claimant = claim ? await getProfileById(claim.developer_id) : null;
  const company = await getProfileById(mission.company_id);

  const isCompany = profile?.id === mission.company_id;
  const isClaimant = profile?.id === claim?.developer_id;

  let funding: MissionFunding | null = null;
  let sweep: MissionSweep | null = null;
  let refunds: Refund[] = [];
  if (isCompany && profile && !mission.campaign_id) {
    const actor = { id: profile.id, role: profile.role, displayName: profile.display_name };
    [funding, sweep, refunds] = await Promise.all([
      getMissionFunding(actor, mission.id),
      getMissionSweep(actor, mission.id),
      listRefunds(mission.id),
    ]);
  }

  return (
    <div className="container-editorial space-y-8 py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="muted text-sm">{company?.display_name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{mission.title}</h1>
          <p className="mt-2 tabular-nums text-accent">
            {mission.campaign_id ? "From " : ""}
            {formatReward(mission.reward_amount, mission.reward_currency)}
          </p>
        </div>
        <span className="badge" data-status={mission.status}>
          {mission.status}
        </span>
      </div>

      {payment?.status === "paid" && (
        <div className="card border-good/30 bg-good/5">
          <p className="text-sm font-medium text-good">Payout confirmed</p>
          <p className="muted mt-1.5 break-all font-mono text-xs">{payment.transaction_hash}</p>
          {payment.transaction_hash && explorerTxUrl(payment.transaction_hash, payment.chain) && (
            <a
              className="mt-3 inline-block text-sm text-accent underline-offset-4 hover:underline"
              href={explorerTxUrl(payment.transaction_hash, payment.chain)}
            >
              View on Basescan
            </a>
          )}
        </div>
      )}

      <div className="card space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{mission.description}</p>
        {mission.requirements && (
          <div>
            <h2 className="text-label text-muted-foreground">Requirements</h2>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
              {mission.requirements}
            </p>
          </div>
        )}
        <p className="muted border-t border-line pt-4 text-sm">
          Deliverables: {mission.required_deliverables.join(", ") || "none"} · Deadline{" "}
          {formatDate(mission.deadline)} · {mission.visibility}
        </p>
      </div>

      {funding &&
        !mission.campaign_id &&
        (mission.funding_status !== "released" || funding.balance > 0 || refunds.length > 0) && (
          <MissionWalletPanel
            missionId={mission.id}
            funding={funding}
            sweep={sweep}
            refunds={refunds}
          />
        )}

      {mission.campaign_id && isCompany && (
        <Link href={`/campaigns/${mission.campaign_id}`} className="btn-quiet">
          ← Campaign
        </Link>
      )}

      {isCompany && missionIsEditable(mission) && (
        <div className="flex flex-wrap items-start gap-2">
          {mission.status === "draft" && !mission.campaign_id && (
            <PublishButton missionId={mission.id} />
          )}
          {missionIsEditable(mission) && (
            <Link href={`/missions/${mission.id}/edit`} className="btn-secondary">
              Edit
            </Link>
          )}
        </div>
      )}

      {claimant && (
        <DeveloperCard developer={toDeveloperCard(claimant)} showWallet={isCompany || isClaimant} />
      )}

      {profile?.role === "developer" && mission.status === "open" && !claim && (
        <ClaimButton missionId={mission.id} />
      )}

      {isClaimant && mission.status === "claimed" && <SubmitWorkForm mission={mission} />}

      {isClaimant && submission && !isCompany && (
        <div className="card">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Your submission is</span>
            <span className="badge" data-status={submission.status}>
              {submission.status}
            </span>
          </div>
          {payment && (
            <p className="muted mt-3 break-all text-sm">
              Payment {payment.status}
              {payment.transaction_hash ? ` · ${payment.transaction_hash}` : ""}
              {payment.error ? ` · ${payment.error}` : ""}
            </p>
          )}
        </div>
      )}

      {isCompany && submission && (
        <ReviewPanel missionId={mission.id} submission={submission} payment={payment} />
      )}

      {isCompany && claim && !submission && (
        <p className="muted text-sm">Claimed. Waiting for the developer to submit proof.</p>
      )}
    </div>
  );
}
