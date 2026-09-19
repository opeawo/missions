import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import type { Profile } from "@/lib/domain/types";

export function Header({ profile }: { profile: Profile | null }) {
  return (
    <header className="border-b border-[var(--line)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Missions
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/missions" className="muted hover:text-[var(--fg)]">
            Browse
          </Link>
          {profile?.role === "company" && (
            <Link href="/missions/new" className="muted hover:text-[var(--fg)]">
              New mission
            </Link>
          )}
          {profile ? (
            <>
              <Link href="/me" className="muted hover:text-[var(--fg)]">
                {profile.display_name}
              </Link>
              <form action={signOut}>
                <button className="btn-ghost text-sm" type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn-primary">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
