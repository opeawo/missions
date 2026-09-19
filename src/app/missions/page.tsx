import { listOpenMissions } from "@/lib/domain";
import { MissionCard } from "../components/MissionCard";

export default async function MissionsPage() {
  const missions = await listOpenMissions();
  return (
    <div className="container-editorial space-y-8 py-16">
      <h1 className="text-section">Open missions</h1>
      <div className="grid gap-3">
        {missions.length === 0 && <p className="muted text-sm">Nothing open yet.</p>}
        {missions.map((m) => (
          <MissionCard key={m.id} mission={m} />
        ))}
      </div>
    </div>
  );
}
