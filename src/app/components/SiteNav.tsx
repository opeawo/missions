import Link from "next/link";
import type { Profile } from "@/lib/domain/types";
import { AccountMenu } from "./AccountMenu";

const navLink = "text-label text-muted-foreground transition-colors hover:text-foreground";

export function SiteNav({ profile }: { profile: Profile | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="container-editorial flex h-20 items-center justify-between gap-6">
        <Link href="/" className="font-display text-xl tracking-tight">
          Missions
        </Link>

        <nav className="flex items-center gap-3 sm:gap-5">
          <Link href="/missions" className={`${navLink} hidden sm:inline-flex`}>
            Missions
          </Link>
          {profile?.role === "company" && (
            <Link href="/missions/new" className="btn-primary btn-icon" aria-label="Create missions">
              +
            </Link>
          )}
          {profile ? (
            <AccountMenu name={profile.display_name} />
          ) : (
            <Link href="/login" className="btn-primary btn-sm">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
