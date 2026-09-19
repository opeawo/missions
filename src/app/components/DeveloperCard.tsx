import { countryName } from "@/lib/countries";
import { truncateWallet } from "@/lib/format";
import type { DeveloperCard as Card } from "@/lib/domain/types";

function LinkItem({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a className="text-[var(--accent)] underline-offset-2 hover:underline" href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

export function DeveloperCard({ developer, showWallet }: { developer: Card; showWallet?: boolean }) {
  return (
    <div className="card space-y-2">
      <div className="text-sm muted">Developer</div>
      <div className="text-lg font-semibold">{developer.display_name}</div>
      {developer.country && <p className="muted text-sm">{countryName(developer.country)}</p>}
      <div className="flex flex-wrap gap-3 text-sm">
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
