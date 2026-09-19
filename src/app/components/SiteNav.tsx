import Link from "next/link";
import type { Profile } from "@/lib/domain/types";
import { marketingNav } from "@/lib/site";
import { AccountMenu } from "./AccountMenu";

const navLink = "text-label whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground";

export function SiteNav({ profile }: { profile: Profile | null }) {
  const auth = profile ? (
    <AccountMenu name={profile.display_name} />
  ) : (
    <Link href="/login" className="btn-primary btn-sm">
      Sign in
    </Link>
  );

  const create =
    profile?.role === "company" ? (
      <Link href="/missions/new" className="btn-primary btn-icon" aria-label="Create missions">
        +
      </Link>
    ) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="container-editorial flex flex-col gap-3 py-4 md:h-20 md:flex-row md:items-center md:justify-between md:gap-6 md:py-0">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-xl tracking-tight">
            Missions
          </Link>
          <div className="flex items-center gap-3 md:hidden">
            {create}
            {auth}
          </div>
        </div>

        <nav className="flex items-center gap-x-5 overflow-x-auto">
          {marketingNav.map((item) => (
            <Link key={item.href} href={item.href} className={navLink}>
              {item.label}
            </Link>
          ))}
          <div className="ml-auto hidden items-center gap-3 md:flex">
            {create}
            {auth}
          </div>
        </nav>
      </div>
    </header>
  );
}
