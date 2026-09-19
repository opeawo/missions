import { countryName } from "@/lib/countries";
import { truncateWallet } from "@/lib/format";
import type { DeveloperCard as Card } from "@/lib/domain/types";

function LinkItem({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a
      className="text-accent underline-offset-4 hover:underline"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {label}
    </a>
  );
}

export function DeveloperCard({ developer, showWallet }: { developer: Card; showWallet?: boolean }) {
  return (
    <div className="card space-y-3">
      <div>
        <p className="muted text-xs uppercase tracking-wide">Developer</p>
        <p className="mt-1.5 font-medium tracking-tight">{developer.display_name}</p>
        {developer.country && (
          <p className="muted mt-0.5 text-sm">{countryName(developer.country)}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        <LinkItem href={developer.github_url} label="GitHub" />
        <LinkItem href={developer.linkedin_url} label="LinkedIn" />
        <LinkItem href={developer.x_url} label="X" />
        <LinkItem href={developer.substack_url} label="Substack" />
        {developer.other_links?.map((l) => (
          <LinkItem key={l.url} href={l.url} label={l.label || "Link"} />
        ))}
      </div>
      {showWallet && (
        <p className="muted font-mono text-xs">{truncateWallet(developer.wallet_address)}</p>
      )}
    </div>
  );
}
