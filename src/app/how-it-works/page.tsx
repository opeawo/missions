import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it Works · Missions",
  description:
    "Browse open projects, use the company’s product, submit proof, and get paid. Companies share a URL. Missions figures out the work.",
};

export default function HowItWorksPage() {
  return (
    <article>
      <header className="container-editorial section space-y-5">
        <p className="text-label text-accent">How it Works</p>
        <h1 className="text-display max-w-3xl">
          Developers build, submit proof, and get paid.
        </h1>
      </header>

      <div className="container-editorial grid md:grid-cols-2">
        <section className="space-y-6 border-b border-border py-16 md:border-r md:pr-12 lg:pr-16">
          <p className="text-label text-muted-foreground">Developers</p>
          <p>Browse open projects that match your skills.</p>
          <p>Use the company’s product, API, SDK, or software to complete the project.</p>
          <p>You submit the finished work and proof.</p>
          <p>If it is approved, you get paid.</p>
          <p>Approved work is paid in USDC.</p>
          <Link href="/missions" className="btn-primary">
            See open Missions
          </Link>
        </section>

        <section className="space-y-6 border-b border-border py-16 md:pl-12 lg:pl-16">
          <p className="text-label text-muted-foreground">Companies</p>
          <p>Put developers to work on your product.</p>
          <p>Give us a URL and we suggest the work.</p>
          <p>
            Share your product or docs. Missions figures out what developers should build, who
            should build it, and what to pay.
          </p>
          <p>Paste your product or documentation URL.</p>
          <p>Developers build, submit proof, and get paid.</p>
          <Link href="/for-companies" className="btn-secondary">
            For Companies
          </Link>
        </section>
      </div>
    </article>
  );
}
