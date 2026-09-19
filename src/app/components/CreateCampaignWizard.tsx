"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { launchCampaignAction, planFromUrlAction } from "@/app/actions/campaigns";
import {
  REGION_LABELS,
  REGIONS,
  campaignBudget,
  developersForBudget,
  estimateOutput,
  missionReward,
  type Region,
} from "@/lib/pricing";
import type { ProductPlan, ProposedMission } from "@/lib/domain/plan";
import { FormError } from "./FormBanner";
import { MissionForm } from "./MissionForm";
import { formatReward } from "@/lib/format";

const COUNTS = [10, 25, 50, 100] as const;
const STEPS = ["Reading the product", "Finding developer use cases", "Estimating difficulty", "Planning missions"];

type Idea = ProposedMission & { included: boolean };

export function CreateCampaignWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [url, setUrl] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [statusIndex, setStatusIndex] = useState(0);

  const [product, setProduct] = useState<Pick<ProductPlan, "product_name" | "product_summary" | "category"> | null>(
    null,
  );
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [developers, setDevelopers] = useState(25);
  const [customCount, setCustomCount] = useState("");
  const [region, setRegion] = useState<Region>("global");

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => {
      setStatusIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 1400);
    return () => window.clearInterval(timer);
  }, [pending]);

  const included = ideas.filter((idea) => idea.included);
  const efforts = included.map((idea) => idea.effort);
  const count = customCount ? Math.max(1, Math.floor(Number(customCount) || 1)) : developers;
  const estimate = useMemo(
    () => campaignBudget(efforts, count, region),
    [efforts, count, region],
  );
  const output = estimateOutput(count);
  const usReach = developersForBudget(estimate.recommended, efforts, "us");
  const globalReach = developersForBudget(estimate.recommended, efforts, "global");

  function analyze(formData: FormData) {
    setError(null);
    const nextUrl = String(formData.get("url") || "");
    const nextContext = String(formData.get("context") || "");
    setUrl(nextUrl);
    setStatusIndex(0);
    start(async () => {
      const result = await planFromUrlAction({ url: nextUrl, context: nextContext || undefined });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setProduct({
        product_name: result.plan.product_name,
        product_summary: result.plan.product_summary,
        category: result.plan.category,
      });
      setIdeas(result.plan.missions.map((m) => ({ ...m, included: true })));
      setStep(2);
    });
  }

  function launch() {
    if (!product) return;
    setError(null);
    start(async () => {
      const result = await launchCampaignAction({
        product_url: url,
        product_name: product.product_name,
        product_summary: product.product_summary,
        category: product.category,
        geography: region,
        developer_target_count: count,
        missions: ideas,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(`/campaigns/${result.campaignId}`);
    });
  }

  if (showManual) {
    return (
      <div className="space-y-8">
        <button type="button" className="btn-quiet" onClick={() => setShowManual(false)}>
          ← Back to URL
        </button>
        <MissionForm />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      {pending && step === 1 ? (
        <UnderstandingState name={guessName(url)} index={statusIndex} />
      ) : (
        <>
          {step === 1 && (
            <ScreenOne
              error={error}
              showContext={showContext}
              onToggleContext={() => setShowContext((v) => !v)}
              onSubmit={analyze}
              onManual={() => setShowManual(true)}
            />
          )}
          {step === 2 && product && (
            <ScreenTwo
              product={product}
              ideas={ideas}
              error={error}
              onToggle={(index) =>
                setIdeas((prev) =>
                  prev.map((idea, i) => (i === index ? { ...idea, included: !idea.included } : idea)),
                )
              }
              onChange={(index, patch) =>
                setIdeas((prev) => prev.map((idea, i) => (i === index ? { ...idea, ...patch } : idea)))
              }
              onBack={() => setStep(1)}
              onNext={() => {
                if (included.length === 0) {
                  setError("Keep at least one mission");
                  return;
                }
                setError(null);
                setStep(3);
              }}
            />
          )}
          {step === 3 && (
            <ScreenThree
              count={count}
              preset={developers}
              customCount={customCount}
              region={region}
              estimate={estimate}
              usReach={usReach}
              globalReach={globalReach}
              onPreset={(n) => {
                setDevelopers(n);
                setCustomCount("");
              }}
              onCustom={setCustomCount}
              onRegion={setRegion}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}
          {step === 4 && product && (
            <ScreenFour
              product={product}
              included={included}
              count={count}
              region={region}
              estimate={estimate}
              output={output}
              pending={pending}
              error={error}
              onBack={() => setStep(3)}
              onLaunch={launch}
            />
          )}
        </>
      )}
    </div>
  );
}

function guessName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const stem = host.split(".")[0] || "your product";
    return stem.charAt(0).toUpperCase() + stem.slice(1);
  } catch {
    return "your product";
  }
}

function UnderstandingState({ name, index }: { name: string; index: number }) {
  return (
    <div className="space-y-8 py-10">
      <p className="text-label text-muted-foreground">Working</p>
      <h1 className="text-section">Understanding {name}…</h1>
      <ul className="space-y-3">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`text-lead ${i <= index ? "text-foreground" : "text-muted-foreground"}`}
          >
            {i < index ? "—" : i === index ? "→" : " "} {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScreenOne({
  error,
  showContext,
  onToggleContext,
  onSubmit,
  onManual,
}: {
  error: string | null;
  showContext: boolean;
  onToggleContext: () => void;
  onSubmit: (formData: FormData) => void;
  onManual: () => void;
}) {
  return (
    <form action={onSubmit} className="space-y-10">
      <div className="space-y-4">
        <h1 className="text-section">Put developers to work on your product.</h1>
        <p className="text-lead max-w-xl">
          Share your product or docs. We’ll figure out what developers should build, who should build
          it, and how to spend your budget.
        </p>
      </div>
      <FormError error={error} />
      <div>
        <label htmlFor="url">Product, API or docs URL</label>
        <input
          id="url"
          name="url"
          type="url"
          required
          placeholder="https://docs.yourproduct.com"
          autoFocus
        />
      </div>
      {showContext && (
        <div>
          <label htmlFor="context">Anything else we should know</label>
          <textarea
            id="context"
            name="context"
            rows={4}
            placeholder="Audience, languages, things to avoid…"
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-6">
        <button className="btn-primary" type="submit">
          Create missions
        </button>
        <button type="button" className="btn-quiet" onClick={onToggleContext}>
          {showContext ? "Hide context" : "Add context"}
        </button>
      </div>
      <button type="button" className="btn-quiet text-muted-foreground" onClick={onManual}>
        Write a single mission instead
      </button>
    </form>
  );
}

function ScreenTwo({
  product,
  ideas,
  error,
  onToggle,
  onChange,
  onBack,
  onNext,
}: {
  product: Pick<ProductPlan, "product_name" | "product_summary">;
  ideas: Idea[];
  error: string | null;
  onToggle: (index: number) => void;
  onChange: (index: number, patch: Partial<Idea>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const included = ideas.filter((idea) => idea.included).length;
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <p className="text-label text-muted-foreground">{product.product_name}</p>
        <h1 className="text-section">
          We found {ideas.length} ways developers could build with {product.product_name}.
        </h1>
        {product.product_summary && <p className="text-lead max-w-xl">{product.product_summary}</p>}
        <p className="text-sm text-muted-foreground">Edit any mission, or leave it out.</p>
      </div>
      <FormError error={error} />
      <div className="grid gap-px bg-border">
        {ideas.map((idea, index) => (
          <article
            key={`${index}-${idea.effort}`}
            className={`bg-background px-6 py-8 ${idea.included ? "" : "opacity-50"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <p className="text-label text-accent">From {formatReward(missionReward(idea.effort, "global"))}</p>
              <button type="button" className="btn-quiet" onClick={() => onToggle(index)}>
                {idea.included ? "Leave out" : "Include"}
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor={`mission-title-${index}`}>Title</label>
                <input
                  id={`mission-title-${index}`}
                  value={idea.title}
                  onChange={(e) => onChange(index, { title: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`mission-user-${index}`}>Target user</label>
                <input
                  id={`mission-user-${index}`}
                  value={idea.target_user}
                  onChange={(e) => onChange(index, { target_user: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`mission-pitch-${index}`}>Pitch</label>
                <textarea
                  id={`mission-pitch-${index}`}
                  rows={2}
                  value={idea.pitch}
                  onChange={(e) => onChange(index, { pitch: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`mission-description-${index}`}>Description</label>
                <textarea
                  id={`mission-description-${index}`}
                  rows={4}
                  value={idea.description}
                  onChange={(e) => onChange(index, { description: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor={`mission-requirements-${index}`}>Requirements</label>
                <textarea
                  id={`mission-requirements-${index}`}
                  rows={3}
                  value={idea.requirements}
                  onChange={(e) => onChange(index, { requirements: e.target.value })}
                />
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button type="button" className="btn-quiet" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="btn-primary" onClick={onNext} disabled={included === 0}>
          Next
        </button>
      </div>
    </div>
  );
}

function ScreenThree({
  count,
  preset,
  customCount,
  region,
  estimate,
  usReach,
  globalReach,
  onPreset,
  onCustom,
  onRegion,
  onBack,
  onNext,
}: {
  count: number;
  preset: number;
  customCount: string;
  region: Region;
  estimate: ReturnType<typeof campaignBudget>;
  usReach: number;
  globalReach: number;
  onPreset: (n: number) => void;
  onCustom: (value: string) => void;
  onRegion: (region: Region) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <h1 className="text-section">How far do you want to reach?</h1>
        <p className="text-lead max-w-xl">
          How many developers do you want, and where should they be? We’ll recommend a budget.
        </p>
      </div>

      <div>
        <p className="text-label text-muted-foreground">Developers</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={customCount === "" && preset === n ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
              onClick={() => onPreset(n)}
            >
              {n}
            </button>
          ))}
          <input
            className="w-28"
            inputMode="numeric"
            placeholder="Custom"
            value={customCount}
            onChange={(e) => onCustom(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
      </div>

      <div>
        <p className="text-label text-muted-foreground">Region</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={region === r ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
              onClick={() => onRegion(r)}
            >
              {REGION_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="cell space-y-3">
        <p className="text-label text-muted-foreground">Recommended budget</p>
        <p className="font-display text-4xl tracking-tight">{formatReward(estimate.recommended)}</p>
        <p className="text-sm text-muted-foreground">
          Estimated range {formatReward(estimate.low)} – {formatReward(estimate.high)}. Rewards start
          from {formatReward(estimate.averageReward)} and vary by complexity and region.
        </p>
        {region !== "us" && (
          <p className="text-sm text-muted-foreground">
            For this budget, Global reaches about {globalReach} developers. United States reaches
            about {usReach}.
          </p>
        )}
        {region === "us" && (
          <p className="text-sm text-muted-foreground">
            Global would reach about {globalReach} developers for the same budget.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <button type="button" className="btn-quiet" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="btn-primary" onClick={onNext} disabled={count < 1}>
          Next
        </button>
      </div>
    </div>
  );
}

function ScreenFour({
  product,
  included,
  count,
  region,
  estimate,
  output,
  pending,
  error,
  onBack,
  onLaunch,
}: {
  product: Pick<ProductPlan, "product_name">;
  included: Idea[];
  count: number;
  region: Region;
  estimate: ReturnType<typeof campaignBudget>;
  output: ReturnType<typeof estimateOutput>;
  pending: boolean;
  error: string | null;
  onBack: () => void;
  onLaunch: () => void;
}) {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <p className="text-label text-muted-foreground">Here’s what we recommend</p>
        <h1 className="text-section">{product.product_name} developer campaign</h1>
      </div>
      <FormError error={error} />
      <dl className="grid gap-px bg-border sm:grid-cols-2">
        <SummaryCell label="Developers" value={String(count)} />
        <SummaryCell label="Region" value={REGION_LABELS[region]} />
        <SummaryCell label="Missions" value={String(included.length)} />
        <SummaryCell label="Budget" value={formatReward(estimate.recommended)} />
      </dl>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          Estimated output: {output.buildsLow}–{output.buildsHigh} completed builds,{" "}
          {output.postsLow}–{output.postsHigh} public posts.
        </p>
        <p>
          {included.length} missions go live now, one developer each. The rest of the budget stays
          in the campaign wallet so you can put more developers to work without depositing again.
        </p>
        <p>
          Rewards start from {formatReward(estimate.averageReward)} and vary by complexity and
          geography. A 15% platform fee is added at funding.
        </p>
      </div>
      <ul className="space-y-2">
        {included.map((idea) => (
          <li key={idea.title} className="flex justify-between gap-4 text-sm">
            <span>{idea.title}</span>
            <span className="text-label text-muted-foreground">
              From {formatReward(missionReward(idea.effort, region))}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button type="button" className="btn-quiet" onClick={onBack} disabled={pending}>
          Edit plan
        </button>
        <button type="button" className="btn-primary" onClick={onLaunch} disabled={pending}>
          {pending ? "Launching…" : "Fund & launch"}
        </button>
      </div>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-6 py-8">
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className="mt-3 font-display text-3xl tracking-tight">{value}</dd>
    </div>
  );
}
