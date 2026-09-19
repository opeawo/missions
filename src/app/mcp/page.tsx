import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MCP · Missions",
  description: "Create and follow missions from Cursor, without leaving the editor.",
};

const MCP_URL = "https://missions.cv/api/mcp";

const snippet = `{
  "mcpServers": {
    "missions": {
      "url": "${MCP_URL}"
    }
  }
}`;

export default function McpPage() {
  return (
    <article>
      <header className="container-editorial section space-y-5">
        <p className="text-label text-accent">MCP</p>
        <h1 className="text-display max-w-3xl">Missions, inside the editor.</h1>
        <p className="text-lead max-w-2xl">
          Companies create work from Cursor. Developers list, claim, and follow it without opening
          another tab. Same missions as the site, Discord, and X.
        </p>
      </header>

      <div className="container-editorial grid md:grid-cols-2">
        <section className="space-y-6 border-b border-border py-16 md:border-r md:pr-12 lg:pr-16">
          <p className="text-label text-muted-foreground">Companies</p>
          <h2 className="text-title">Create from a product URL.</h2>
          <p>
            An agent writes the brief and publishes. One tool call, a live mission, a Discord post
            if you want one.
          </p>
        </section>
        <section className="space-y-6 border-b border-border py-16 md:pl-12 lg:pl-16">
          <p className="text-label text-muted-foreground">Developers</p>
          <h2 className="text-title">List, claim, submit.</h2>
          <p>
            List what’s open, claim it, submit the repo and the post. The company still approves on
            the site. You still get paid.
          </p>
        </section>
      </div>

      <section className="border-b border-border">
        <div className="container-editorial section max-w-3xl space-y-6">
          <p className="text-label text-muted-foreground">In Cursor</p>
          <p className="text-title">Add the hosted URL. Sign in when Cursor asks.</p>
          <p>
            Paste this into Cursor Settings → MCP. Cursor opens Missions so you can approve the
            connection. Tools run as your company or developer account.
          </p>
          <pre className="overflow-x-auto border border-border bg-muted px-5 py-5 font-mono text-[13px] leading-relaxed">{snippet}</pre>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Endpoint:{" "}
            <code className="font-mono text-foreground">{MCP_URL}</code>
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/missions" className="btn-primary">
              See open missions
            </Link>
            <Link href="/missions/new" className="btn-secondary">
              Create from the site
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}
