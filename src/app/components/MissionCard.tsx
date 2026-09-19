import { formatReward } from "@/lib/format";
import type { Mission } from "@/lib/domain/types";
import Link from "next/link";

export function MissionCard({ mission }: { mission: Mission }) {
  return (
    <Link href={`/missions/${mission.id}`} className="cell cell-link block">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-medium tracking-tight">{mission.title}</h2>
          <p className="muted mt-1.5 line-clamp-2 text-sm">{mission.description}</p>
        </div>
        <span className="badge" data-status={mission.status}>
          {mission.status}
        </span>
      </div>
      <p className="mt-4 text-sm tabular-nums text-accent">
        {mission.campaign_id ? "From " : ""}
        {formatReward(mission.reward_amount, mission.reward_currency)}
      </p>
    </Link>
  );
}
