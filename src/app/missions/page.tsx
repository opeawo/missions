import { listOpenMissions } from "@/lib/domain";
import { MissionCard } from "../components/MissionCard";

export default async function MissionsPage() {
  const missions = await listOpenMissions();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Open missions</h1>
      <div className="grid gap-4">
        {missions.length === 0 && <p className="muted">Nothing open yet.</p>}
        {missions.map((m) => (
          <MissionCard key={m.id} mission={m} />
        ))}
      </div>
    </div>
  );
}
