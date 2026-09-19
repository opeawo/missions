import Link from "next/link";
import type { CompanySubmissionRow } from "@/lib/domain";
import { formatDate } from "@/lib/format";

export function SubmissionInbox({ submissions }: { submissions: CompanySubmissionRow[] }) {
  if (submissions.length === 0) {
    return <p className="text-sm text-muted-foreground">No submissions yet.</p>;
  }

  const pending = submissions.filter((s) => s.status === "pending");
  const rest = submissions.filter((s) => s.status !== "pending");
  const ordered = [...pending, ...rest];

  return (
    <div className="grid gap-px bg-border">
      {ordered.map((submission) => (
        <Link
          key={submission.id}
          href={`/missions/${submission.mission_id}`}
          className="bg-background px-6 py-6 transition-colors hover:bg-muted"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-title">{submission.mission_title}</p>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {submission.description || "Work submitted — open to review evidence."}
              </p>
              <p className="muted mt-2 text-xs">{formatDate(submission.submitted_at)}</p>
            </div>
            <span className="badge" data-status={submission.status}>
              {submission.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
