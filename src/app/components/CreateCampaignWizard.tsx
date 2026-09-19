"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { planFromUrlAction, prepareCampaignAction } from "@/app/actions/campaigns";
import {
  REGION_LABELS,
  REGIONS,
  campaignBudgetFromRewards,
  depositForBudget,
  estimateOutput,
  firstWaveSpendFromRewards,
  missionReward,
  type BudgetEstimate,
  type Region,
} from "@/lib/pricing";
import type { CampaignFunding } from "@/lib/domain";
import type { ProductPlan, ProposedMission } from "@/lib/domain/plan";
import { FormError } from "./FormBanner";
import { CampaignLaunchPanel } from "./CampaignLaunchPanel";
import { MissionForm } from "./MissionForm";
import { formatReward } from "@/lib/format";
import { FIRST_LAUNCH_CREDIT_USD } from "@/lib/site";

const COUNTS = [10, 25, 50, 100] as const;
const STEPS = ["Reading the product", "Finding developer use cases", "Estimating difficulty", "Planning missions"];

type Idea = ProposedMission & { included: boolean; reward_amount: number };

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
  const [budgetText, setBudgetText] = useState("");
  const [prepared, setPrepared] = useState<{
    campaignId: string;
    funding: CampaignFunding;
    walletError: string | null;
  } | null>(null);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => {
      setStatusIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 1400);
    return () => window.clearInterval(timer);
  }, [pending]);

  const included = ideas.filter((idea) => idea.included);
  const rewards = included.map((idea) => idea.reward_amount);
  const count = customCount ? Math.max(1, Math.floor(Number(customCount) || 1)) : developers;
  const estimate = useMemo(
    () => campaignBudgetFromRewards(rewards, count),
    [count, rewards.join(",")],
  );
  const output = estimateOutput(count);
  const minimum = firstWaveSpendFromRewards(rewards);
  const budget = budgetText === "" ? estimate.recommended : Number(budgetText) || 0;
  const deposit = depositForBudget(budget);
  const developerReach = Math.max(
    1,
    Math.floor((budget || estimate.recommended) / Math.max(estimate.averageReward, 1)),
  );

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
      setIdeas(
        result.plan.missions.map((m) => ({
          ...m,
          included: true,
          reward_amount: missionReward(m.effort, "global"),
        })),
      );
      setStep(2);
    });
  }

  function prepare() {
    if (!product) return;
    setError(null);
    start(async () => {
      const result = await prepareCampaignAction({
        product_url: url,
        product_name: product.product_name,
        product_summary: product.product_summary,
        category: product.category,
        geography: region,
        developer_target_count: count,
        total_budget: budget,
        missions: ideas,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPrepared(result);
      if (result.walletError) setError(result.walletError);
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
                if (included.some((idea) => !Number.isFinite(idea.reward_amount) || idea.reward_amount < 1)) {
                  setError("Each included mission needs a reward of at least 1 USDC");
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
              budget={budget}
              budgetText={budgetText}
              minimum={minimum}
              deposit={deposit}
              globalReach={developerReach}
              onPreset={(n) => {
                setDevelopers(n);
                setCustomCount("");
              }}
              onCustom={setCustomCount}
              onRegion={setRegion}
              onBudget={setBudgetText}
              onBack={() => setStep(2)}
              onNext={() => {
                if (budget < minimum) {
                  setError(`Budget must be at least ${formatReward(minimum)} to fund the first missions`);
                  return;
                }
                setError(null);
                setStep(4);
              }}
            />
          )}
          {step === 4 && product && (
            <ScreenFour
              product={product}
              included={included}
              count={count}
              region={region}
              budget={budget}
              estimate={estimate}
              deposit={deposit}
              output={output}
              pending={pending}
              error={error}
              prepared={prepared}
              onBack={() => setStep(3)}
              onPrepare={prepare}
              onLaunched={() => {
                if (prepared) router.push(`/campaigns/${prepared.campaignId}`);
              }}
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
        <p className="text-label text-accent">${FIRST_LAUNCH_CREDIT_USD} credit on your first launch</p>
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
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-40">
                <label htmlFor={`mission-reward-${index}`}>Reward (USDC)</label>
                <input
                  id={`mission-reward-${index}`}
                  type="number"
                  min={1}
                  step="1"
                  inputMode="decimal"
                  value={Number.isFinite(idea.reward_amount) ? idea.reward_amount : ""}
                  onChange={(e) => onChange(index, { reward_amount: Number(e.target.value) })}
                />
              </div>
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
  budget,
  budgetText,
  minimum,
  deposit,
  globalReach,
  onPreset,
  onCustom,
  onRegion,
  onBudget,
  onBack,
  onNext,
}: {
  count: number;
  preset: number;
  customCount: string;
  region: Region;
  estimate: BudgetEstimate;
  budget: number;
  budgetText: string;
  minimum: number;
  deposit: ReturnType<typeof depositForBudget>;
  globalReach: number;
  onPreset: (n: number) => void;
  onCustom: (value: string) => void;
  onRegion: (region: Region) => void;
  onBudget: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const belowMinimum = budget > 0 && budget < minimum;
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <h1 className="text-section">Set your budget</h1>
        <p className="text-lead max-w-xl">
          How many developers do you want, and where should they be? Edit the budget, or keep our
          recommendation.
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

      <div className="cell space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <label htmlFor="campaign-budget-plan">Budget</label>
            <input
              id="campaign-budget-plan"
              className="mt-2 max-w-56"
              type="number"
              min="0.01"
              step="0.01"
              value={budgetText === "" ? estimate.recommended : budgetText}
              onChange={(e) => onBudget(e.target.value)}
            />
          </div>
          {budgetText !== "" && Number(budgetText) !== estimate.recommended && (
            <button type="button" className="btn-quiet" onClick={() => onBudget("")}>
              Use recommended {formatReward(estimate.recommended)}
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Recommended {formatReward(estimate.recommended)} (range {formatReward(estimate.low)} –{" "}
          {formatReward(estimate.high)}). Deposit {formatReward(deposit.required)} including a{" "}
          {deposit.feePercent}% fee of {formatReward(deposit.fee)}.
        </p>
        {belowMinimum && (
          <p className="text-sm text-accent">
            Needs at least {formatReward(minimum)} to fund the first missions.
          </p>
        )}
        {region !== "us" && (
          <p className="text-sm text-muted-foreground">
            At these rewards, this budget funds about {globalReach} developers.
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
        <button type="button" className="btn-primary" onClick={onNext} disabled={count < 1 || belowMinimum}>
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
  budget,
  estimate,
  deposit,
  output,
  pending,
  error,
  prepared,
  onBack,
  onPrepare,
  onLaunched,
}: {
  product: Pick<ProductPlan, "product_name">;
  included: Idea[];
  count: number;
  region: Region;
  budget: number;
  estimate: BudgetEstimate;
  deposit: ReturnType<typeof depositForBudget>;
  output: ReturnType<typeof estimateOutput>;
  pending: boolean;
  error: string | null;
  prepared: { campaignId: string; funding: CampaignFunding; walletError: string | null } | null;
  onBack: () => void;
  onPrepare: () => void;
  onLaunched: () => void;
}) {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <p className="text-label text-muted-foreground">Fund and launch</p>
        <h1 className="text-section">{product.product_name} developer campaign</h1>
      </div>
      <FormError error={error} />
      <dl className="grid gap-px bg-border sm:grid-cols-2">
        <SummaryCell label="Developers" value={String(count)} />
        <SummaryCell label="Region" value={REGION_LABELS[region]} />
        <SummaryCell label="Missions" value={String(included.length)} />
        <SummaryCell label="Budget" value={formatReward(budget)} />
      </dl>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          Estimated output: {output.buildsLow}–{output.buildsHigh} completed builds,{" "}
          {output.postsLow}–{output.postsHigh} public posts.
        </p>
        <p>
          {included.length} missions go live now, one developer each. The rest of the budget stays
          in this campaign&apos;s wallet so you can put more developers to work without depositing
          again.
        </p>
        <p>
          Deposit {formatReward(deposit.required)}: {formatReward(budget)} for developers plus a{" "}
          {deposit.feePercent}% fee of {formatReward(deposit.fee)}. Rewards start from{" "}
          {formatReward(estimate.averageReward)}.
        </p>
      </div>
      <ul className="space-y-2">
        {included.map((idea) => (
          <li key={idea.title} className="flex justify-between gap-4 text-sm">
            <span>{idea.title}</span>
            <span className="text-label text-muted-foreground">
              {formatReward(idea.reward_amount)}
            </span>
          </li>
        ))}
      </ul>
      {prepared ? (
        <CampaignLaunchPanel
          campaignId={prepared.campaignId}
          funding={prepared.funding}
          onLaunched={onLaunched}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button type="button" className="btn-quiet" onClick={onBack} disabled={pending}>
            Edit plan
          </button>
          <button type="button" className="btn-primary" onClick={onPrepare} disabled={pending}>
            {pending ? "Creating wallet…" : "Show deposit address"}
          </button>
        </div>
      )}
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
