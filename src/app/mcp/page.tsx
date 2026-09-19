import type { Metadata } from "next";
import Link from "next/link";
import { siteLinks } from "@/lib/site";

export const metadata: Metadata = {
  title: "MCP · Missions",
  description: "Create and follow missions from Cursor, without leaving the editor.",
};

const snippet = `{
  "mcpServers": {
    "missions": {
      "command": "npx",
      "args": ["tsx", "mcp/index.ts"],
      "cwd": "/ABSOLUTE/PATH/TO/missions"
    }
  }
}`;

export default function McpPage() {
  return (
    <article className="container-editorial section max-w-3xl space-y-12">
      <header className="space-y-5">
        <p className="text-label text-accent">MCP</p>
        <h1 className="text-section">Missions, inside the editor.</h1>
        <p className="text-lead">
          Companies create work from Cursor. Developers list, claim, and follow it without opening
          another tab. Same missions as the site, Discord, and X.
        </p>
      </header>

      <div className="grid gap-px bg-border sm:grid-cols-2">
        <section className="bg-background px-6 py-10">
          <h2 className="text-title">For companies</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            An agent writes the brief from your product URL and publishes. One tool call, a live
            mission, a Discord post if you want one.
          </p>
        </section>
        <section className="bg-background px-6 py-10">
          <h2 className="text-title">For developers</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            List what’s open, claim it, submit the repo and the post. The company still approves on
            the site. You still get paid.
          </p>
        </section>
      </div>

      <section className="space-y-4">
        <p className="text-label text-muted-foreground">In Cursor</p>
        <pre className="overflow-x-auto border border-border bg-muted px-5 py-5 font-mono text-[13px] leading-relaxed">
          {snippet}
        </pre>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Point <code>cwd</code> at a checkout of Missions and load the same env the web app uses.
          Details live in the{" "}
          <a href={siteLinks.github} className="underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
            repo
          </a>
          .
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/missions" className="btn-primary">
          See open missions
        </Link>
        <Link href="/missions/new" className="btn-secondary">
          Create from the site
        </Link>
      </div>
    </article>
  );
}
