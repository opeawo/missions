import Link from "next/link";
import { marketingNav } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="container-editorial flex flex-col gap-8 py-10 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="font-display text-xl tracking-tight">
          Missions
        </Link>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-label text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="container-editorial py-6">
          <p className="text-label text-muted-foreground">© {new Date().getFullYear()} Missions</p>
        </div>
      </div>
    </footer>
  );
}
