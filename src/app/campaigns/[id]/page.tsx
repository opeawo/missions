import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import {
  getCampaign,
  getCampaignFunding,
  listCampaignMissions,
  listCompanySubmissions,
} from "@/lib/domain";
import { formatReward } from "@/lib/format";
import { REGION_LABELS, type Region } from "@/lib/pricing";
import { missionIsEditable } from "@/lib/domain/types";
import { MissionCard } from "../../components/MissionCard";
import { CampaignLaunchPanel } from "../../components/CampaignLaunchPanel";
import { SubmissionInbox } from "../../components/SubmissionInbox";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const campaign = await getCampaign(id);
  if (!campaign) notFound();
  if (campaign.company_id !== profile.id) redirect("/");

  const actor = { id: profile.id, role: profile.role, displayName: profile.display_name };
  const [missions, funding, allSubmissions] = await Promise.all([
    listCampaignMissions(id),
    getCampaignFunding(actor, id),
    listCompanySubmissions(profile.id),
  ]);
  const missionIds = new Set(missions.map((m) => m.id));
  const submissions = allSubmissions.filter((s) => missionIds.has(s.mission_id));
  const regionLabel = REGION_LABELS[campaign.geography as Region] || campaign.geography;
  const live = campaign.status === "live";

  return (
    <div className="container-editorial space-y-12 py-16">
      <div className="space-y-3">
        <p className="text-label text-muted-foreground">
          {live ? "Live" : "Waiting on funds"} · {regionLabel} · {campaign.developer_target_count}{" "}
          developers
        </p>
        <h1 className="text-section">{campaign.product_name}</h1>
        {campaign.product_summary && (
          <p className="text-lead max-w-2xl">{campaign.product_summary}</p>
        )}
        <p className="text-sm text-muted-foreground">
          <a className="underline-offset-4 hover:underline" href={campaign.product_url}>
            {campaign.product_url}
          </a>
        </p>
      </div>

      <dl className="grid gap-px bg-border sm:grid-cols-3">
        <div className="bg-background px-6 py-8">
          <dt className="text-label text-muted-foreground">Budget</dt>
          <dd className="mt-3 font-display text-3xl tracking-tight">
            {formatReward(campaign.total_budget, campaign.currency)}
          </dd>
        </div>
        <div className="bg-background px-6 py-8">
          <dt className="text-label text-muted-foreground">Missions</dt>
          <dd className="mt-3 font-display text-3xl tracking-tight">{missions.length}</dd>
        </div>
        <div className="bg-background px-6 py-8">
          <dt className="text-label text-muted-foreground">Status</dt>
          <dd className="mt-3 font-display text-3xl tracking-tight">{campaign.status}</dd>
        </div>
      </dl>

      {!live && <CampaignLaunchPanel campaignId={campaign.id} funding={funding} />}

      <section className="space-y-4">
        <h2 className="text-title">Submissions</h2>
        <SubmissionInbox submissions={submissions} />
      </section>

      <div className="space-y-4">
        <h2 className="text-title">Missions</h2>
        <div className="grid gap-3">
          {missions.map((mission) => (
            <div key={mission.id} className="space-y-2">
              <MissionCard mission={mission} />
              {missionIsEditable(mission) && (
                <Link href={`/missions/${mission.id}/edit`} className="btn-quiet">
                  Edit mission
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      <Link href="/" className="btn-quiet">
        ← All missions
      </Link>
    </div>
  );
}
