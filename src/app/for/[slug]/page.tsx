import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AUDIENCES, audienceBySlug } from "@/lib/audiences";
import { FIRST_LAUNCH_CREDIT_USD } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return AUDIENCES.map((audience) => ({ slug: audience.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const audience = audienceBySlug(slug);
  if (!audience) return { title: "Missions" };
  return {
    title: `${audience.nav} · Missions`,
    description: audience.lede,
  };
}

export default async function AudiencePage({ params }: Props) {
  const { slug } = await params;
  const audience = audienceBySlug(slug);
  if (!audience) notFound();

  return (
    <article>
      <header className="container-editorial section space-y-6 border-b border-border">
        <p className="text-label text-accent">{audience.eyebrow}</p>
        <h1 className="text-display max-w-4xl">{audience.headline}</h1>
        <p className="text-lead max-w-2xl">{audience.lede}</p>
        {audience.credit && (
          <p className="text-label">First launch includes a ${FIRST_LAUNCH_CREDIT_USD} credit.</p>
        )}
        <div className="flex flex-wrap gap-3 pt-4">
          <Link href="/missions/new" className="btn-primary">
            Put developers to work
          </Link>
          <Link href="/missions" className="btn-secondary">
            Browse missions
          </Link>
        </div>
      </header>

      <div className="container-editorial grid md:grid-cols-2">
        <section className="border-b border-border py-16 md:border-r md:pr-12 lg:pr-16">
          <p className="text-label text-muted-foreground">{audience.company.title}</p>
          <p className="mt-6 max-w-md text-[18px] leading-relaxed">{audience.company.body}</p>
          <ul className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
            {audience.company.bullets.map((item) => (
              <li key={item}>— {item}</li>
            ))}
          </ul>
        </section>
        <section className="border-b border-border py-16 md:pl-12 lg:pl-16">
          <p className="text-label text-muted-foreground">{audience.developer.title}</p>
          <p className="mt-6 max-w-md text-[18px] leading-relaxed">{audience.developer.body}</p>
          <ul className="mt-8 space-y-3 text-sm leading-relaxed text-muted-foreground">
            {audience.developer.bullets.map((item) => (
              <li key={item}>— {item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="container-editorial section">
        <p className="text-label text-muted-foreground">A mission looks like</p>
        <p className="text-title mt-5 max-w-3xl">{audience.example}</p>
        <p className="mt-10 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Companies paste a URL. We write the briefs. Developers claim, ship, and post proof.
          Approved work gets paid. You can watch the board here, in Discord, on X, or from Cursor
          via MCP.
        </p>
      </section>

      <nav className="border-t border-border">
        <div className="container-editorial flex flex-wrap gap-x-8 gap-y-3 py-8">
          {AUDIENCES.filter((item) => item.slug !== audience.slug).map((item) => (
            <Link
              key={item.slug}
              href={`/for/${item.slug}`}
              className="text-label text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.nav}
            </Link>
          ))}
        </div>
      </nav>
    </article>
  );
}
