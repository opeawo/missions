import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/auth";
import {
  getClaimForMission,
  getMission,
  getPaymentForMission,
  getProfileById,
  listSubmissions,
  toDeveloperCard,
} from "@/lib/domain";
import { formatDate, formatReward, explorerTxUrl } from "@/lib/format";
import { DeveloperCard } from "../../components/DeveloperCard";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="muted text-sm">{company?.display_name}</p>
          <h1 className="mt-1 text-3xl font-semibold">{mission.title}</h1>
          <p className="mt-3 text-[var(--accent)]">
            {formatReward(mission.reward_amount, mission.reward_currency)}
          </p>
        </div>
        <span className="badge">{mission.status}</span>
      </div>

      {payment?.status === "paid" && (
        <div className="card border-[var(--good)]/40">
          <p className="font-semibold text-[var(--good)]">Payout confirmed</p>
          <p className="muted mt-1 font-mono text-sm">{payment.transaction_hash}</p>
          {payment.transaction_hash && explorerTxUrl(payment.transaction_hash, payment.chain) && (
            <a
              className="mt-2 inline-block text-sm text-[var(--accent)]"
              href={explorerTxUrl(payment.transaction_hash, payment.chain)}
            >
              View on Basescan
            </a>
          )}
        </div>
      )}

      <div className="card space-y-3">
        <p className="whitespace-pre-wrap">{mission.description}</p>
        {mission.requirements && (
          <div>
            <h2 className="text-sm font-medium">Requirements</h2>
            <p className="muted mt-1 whitespace-pre-wrap">{mission.requirements}</p>
          </div>
        )}
        <p className="text-sm muted">
          Deliverables: {mission.required_deliverables.join(", ") || "none"} · Deadline{" "}
          {formatDate(mission.deadline)} · {mission.visibility}
        </p>
      </div>

      {isCompany && mission.status === "draft" && (
        <div className="flex gap-3">
          <PublishButton missionId={mission.id} />
          <Link href={`/missions/${mission.id}/edit`} className="btn-ghost">
            Edit
          </Link>
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
          <p className="font-medium">Your submission is {submission.status}.</p>
          {payment && (
            <p className="muted mt-2 text-sm">
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
        <p className="muted">Claimed. Waiting for the developer to submit proof.</p>
      )}
    </div>
  );
}
