import { getProfile } from "@/lib/auth";
import { listMissions, listOpenMissions } from "@/lib/domain";
import { MissionCard } from "./components/MissionCard";
import Link from "next/link";

export default async function HomePage() {
  const profile = await getProfile().catch(() => null);

  if (profile?.role === "company") {
    const mine = await listMissions({ companyId: profile.id });
    return (
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Your missions</h1>
            <p className="muted mt-2">Create work, review proof, pay in USDC.</p>
          </div>
          <Link href="/missions/new" className="btn-primary">
            New mission
          </Link>
        </div>
        <div className="grid gap-4">
          {mine.length === 0 && <p className="muted">No missions yet.</p>}
          {mine.map((m) => (
            <MissionCard key={m.id} mission={m} />
          ))}
        </div>
      </div>
    );
  }

  const open = await listOpenMissions();
  const heading = profile?.role === "developer" ? "Open missions" : "Missions";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{heading}</h1>
        <p className="muted mt-2">Claim paid technical work. Submit proof. Get USDC on Base.</p>
      </div>
      <div className="grid gap-4">
        {open.length === 0 && <p className="muted">No open missions right now.</p>}
        {open.map((m) => (
          <MissionCard key={m.id} mission={m} />
        ))}
      </div>
    </div>
  );
}
