import Link from "next/link";
import { formatReward } from "@/lib/format";
import type { Mission } from "@/lib/domain/types";

const youMight = [
  "Working demo",
  "Integration",
  "Workflow",
  "API or SDK",
  "Walkthrough",
  "Customer deploy",
];

export function DeveloperLanding({ featured }: { featured: Mission | null }) {
  return (
    <>
      <section className="container-editorial section space-y-8">
        <div className="max-w-4xl space-y-5">
          <h1 className="text-display">Get paid to flex your skills.</h1>
          <p className="text-lead">
            Discover products worth building with, complete useful technical projects, show what you
            made, and earn USDC.
          </p>
        </div>
        <Link href="/missions" className="btn-primary">
          See open Missions
        </Link>
      </section>

      <section className="border-t border-border">
        <div className="container-editorial section space-y-10">
          <p className="text-title max-w-xl">
            Small paid projects from software and AI companies.
          </p>
          <ul className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {youMight.map((item) => (
              <li key={item} className="bg-background px-6 py-8 text-title">
                {item}
              </li>
            ))}
          </ul>
          <Link href="/missions" className="btn-secondary">
            Browse Missions
          </Link>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="container-editorial section space-y-12">
          {featured ? (
            <article className="cell max-w-3xl space-y-6">
              <h2 className="text-title">{featured.title}</h2>
              <p>{featured.description}</p>
              <p className="text-label text-accent">
                From {formatReward(featured.reward_amount, featured.reward_currency)}
              </p>
              <Link href={`/missions/${featured.id}`} className="btn-primary">
                View Mission
              </Link>
            </article>
          ) : (
            <article className="cell max-w-3xl space-y-6">
              <p>
                Create a working real-world example using Northstar, deploy it, and explain what you
                built.
              </p>
              <p className="text-label text-accent">From 50 USDC</p>
              <Link href="/missions" className="btn-primary">
                View Mission
              </Link>
            </article>
          )}

          <div className="max-w-2xl space-y-5">
            <p className="text-title">
              The best Missions are small enough to finish quickly, but useful enough to become
              something you can show publicly.
            </p>
            <p className="text-lead">
              Every completed Mission can become another proof of what you can build.
            </p>
            <Link href="/missions" className="btn-secondary">
              See all Missions
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="container-editorial section max-w-2xl space-y-6">
          <p className="text-title">Put developers to work on your product.</p>
          <p className="text-lead">Give us a URL and we suggest the work.</p>
          <p className="text-lead">Developers build, submit proof, and get paid.</p>
          <Link href="/for-companies" className="btn-secondary">
            For Companies
          </Link>
        </div>
      </section>
    </>
  );
}
