import type { Metadata } from "next";
import Link from "next/link";
import { siteLinks } from "@/lib/site";

export const metadata: Metadata = {
  title: "For Companies · Missions",
  description:
    "Put developers to work on your product. Give us a URL and we suggest the work. Developers build, submit proof, and get paid.",
};

const channels = [
  { href: "/missions/new", label: "Web", external: false },
  { href: siteLinks.discord, label: "Discord", external: true },
  { href: "/mcp", label: "MCP", external: false },
  { href: "/mcp", label: "AI agents", external: false },
];

export default function ForCompaniesPage() {
  return (
    <article>
      <header className="container-editorial section space-y-8">
        <p className="text-label text-accent">For companies</p>
        <div className="max-w-3xl space-y-4">
          <h1 className="text-display">Put developers to work on your product.</h1>
          <p className="text-lead">Give us a URL and we suggest the work.</p>
          <p className="text-lead">Developers build, submit proof, and get paid.</p>
        </div>
        <Link href="/missions/new" className="btn-primary">
          Create Missions
        </Link>
      </header>

      <section className="border-t border-border">
        <div className="container-editorial section max-w-3xl space-y-6">
          <p className="text-title">
            Share your product or docs. Missions figures out what developers should build, who
            should build it, and what to pay.
          </p>
          <p>
            A developer who has already built with your product is often the best person to help a
            customer use it.
          </p>
          <p className="text-lead">
            When you have a customer in a geography your team cannot cover, or a customer too small
            for your internal solutions team, create another Mission and send the work to developers
            who already know your product.
          </p>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="container-editorial section space-y-10">
          <div className="max-w-xl space-y-4">
            <p>Create and manage Missions through:</p>
            <ul className="grid gap-px bg-border sm:grid-cols-4">
              {channels.map((channel) => (
                <li key={channel.label}>
                  {channel.external ? (
                    <a
                      href={channel.href}
                      className="block bg-background px-6 py-8 text-title transition-colors hover:bg-muted"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {channel.label}
                    </a>
                  ) : (
                    <Link
                      href={channel.href}
                      className="block bg-background px-6 py-8 text-title transition-colors hover:bg-muted"
                    >
                      {channel.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="max-w-xl space-y-6">
            <p>Your product does not need to live inside another platform.</p>
            <p className="text-title">Paste your product or documentation URL.</p>
            <Link href="/missions/new" className="btn-primary">
              Create Missions
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}
