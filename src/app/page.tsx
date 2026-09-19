import { getProfile } from "@/lib/auth";
import { listCampaigns, listCompanySubmissions, listMissions, listOpenMissions } from "@/lib/domain";
import { MissionCard } from "./components/MissionCard";
import { SubmissionInbox } from "./components/SubmissionInbox";
import { DeveloperLanding } from "./components/DeveloperLanding";
import { formatReward } from "@/lib/format";
import Link from "next/link";
import { REGION_LABELS, type Region } from "@/lib/pricing";

export default async function HomePage() {
  const profile = await getProfile().catch(() => null);

  if (profile?.role === "company") {
    const [mine, campaigns, submissions] = await Promise.all([
      listMissions({ companyId: profile.id }),
      listCampaigns(profile.id),
      listCompanySubmissions(profile.id),
    ]);
    return (
      <div className="container-editorial space-y-12 py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl space-y-3">
            <h1 className="text-section">Your work</h1>
            <p className="text-lead">Paste a product URL. We’ll put developers on it.</p>
          </div>
          <Link href="/missions/new" className="btn-primary btn-icon" aria-label="Create missions">
            +
          </Link>
        </div>

        <section className="space-y-4">
          <h2 className="text-title">Submissions</h2>
          <SubmissionInbox submissions={submissions} />
        </section>

        {campaigns.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-title">Campaigns</h2>
            <div className="grid gap-px bg-border">
              {campaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="bg-background px-6 py-8 transition-colors hover:bg-muted"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-title">{campaign.product_name}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {REGION_LABELS[campaign.geography as Region] || campaign.geography} ·{" "}
                        {campaign.developer_target_count} developers · {campaign.status}
                      </p>
                    </div>
                    <p className="text-label text-accent">
                      {formatReward(campaign.total_budget, campaign.currency)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-title">Missions</h2>
          <div className="grid gap-3">
            {mine.length === 0 && <p className="text-sm text-muted-foreground">No missions yet.</p>}
            {mine.map((m) => (
              <MissionCard key={m.id} mission={m} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  const open = await listOpenMissions();

  if (profile?.role === "developer") {
    return (
      <div className="container-editorial space-y-12 py-16 md:py-24">
        <div>
          <h1 className="text-section">Open missions</h1>
          <p className="text-lead mt-3">Browse open projects that match your skills.</p>
        </div>
        <div className="grid gap-3">
          {open.length === 0 && (
            <p className="text-sm text-muted-foreground">No open missions right now.</p>
          )}
          {open.map((m) => (
            <MissionCard key={m.id} mission={m} />
          ))}
        </div>
      </div>
    );
  }

  return <DeveloperLanding featured={open[0] ?? null} />;
}
