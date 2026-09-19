import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import type { Profile } from "@/lib/domain/types";

const navLink = "text-muted transition-colors hover:text-foreground";

export function Header({ profile }: { profile: Profile | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-6 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          Missions
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/missions" className={navLink}>
            Browse
          </Link>
          {profile?.role === "company" && (
            <Link href="/missions/new" className={navLink}>
              New mission
            </Link>
          )}
          {profile ? (
            <>
              <Link href="/me" className={navLink}>
                {profile.display_name}
              </Link>
              <form action={signOut}>
                <button className="btn-ghost btn-sm" type="submit">
                  Sign out
                </button>
              </form>
            </>
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
