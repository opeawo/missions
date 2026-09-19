import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="container-editorial flex flex-col gap-10 py-14 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <p className="font-display text-xl tracking-tight">Missions</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Paid technical work, created by agents and companies, settled in USDC on Base.
          </p>
        </div>

        <div className="flex gap-16">
          <div>
            <p className="text-label text-muted-foreground">Product</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/missions" className="transition-colors hover:text-accent">
                  Open missions
                </Link>
              </li>
              <li>
                <Link href="/missions/new" className="transition-colors hover:text-accent">
                  New
                </Link>
              </li>
              <li>
                <Link href="/me" className="transition-colors hover:text-accent">
                  Settings
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-label text-muted-foreground">Settlement</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>USDC on Base</li>
              <li>Escrow per mission</li>
              <li>Non-custodial keys</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-editorial flex flex-col gap-2 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-label text-muted-foreground">
            © {new Date().getFullYear()} Missions
          </p>
          <p className="text-label text-muted-foreground">Base · USDC · thirdweb server wallets</p>
        </div>
      </div>
    </footer>
  );
}
