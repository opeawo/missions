import { formatReward } from "@/lib/format";
import type { Mission } from "@/lib/domain/types";
import Link from "next/link";

export function MissionCard({ mission }: { mission: Mission }) {
  return (
    <Link href={`/missions/${mission.id}`} className="card block hover:border-[var(--accent)]/50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{mission.title}</h2>
          <p className="muted mt-2 line-clamp-2 text-sm">{mission.description}</p>
        </div>
        <span className="badge">{mission.status}</span>
      </div>
      <p className="mt-4 text-sm text-[var(--accent)]">
        {formatReward(mission.reward_amount, mission.reward_currency)}
      </p>
    </Link>
  );
}
