/**
 * Deterministic campaign pricing. The LLM proposes missions and classifies their
 * effort; every number here is computed by this module, so the model can never
 * invent money. Pure and dependency-free: the wizard uses it for live estimates in
 * the browser and the domain layer uses the same functions at launch.
 *
 * Multipliers are internal planning assumptions, configurable via
 * PRICING_CONFIG_JSON on the server (see resolvePricingConfig), not public claims.
 */

export const REGIONS = ["global", "us", "europe", "africa", "latam", "asia"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = {
  global: "Global",
  us: "United States",
  europe: "Europe",
  africa: "Africa",
  latam: "Latin America",
  asia: "Asia",
};

export const EFFORT_LEVELS = ["light", "standard", "deep"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export type PricingConfig = {
  /** Reward for a standard-effort mission at global baseline, in USDC. */
  baseReward: number;
  rewardFloor: number;
  rewardCeiling: number;
  roundTo: number;
  geoMultipliers: Record<Region, number>;
  effortMultipliers: Record<EffortLevel, number>;
};

export const DEFAULT_PRICING: PricingConfig = {
  baseReward: 250,
  rewardFloor: 100,
  rewardCeiling: 1500,
  roundTo: 25,
  geoMultipliers: {
    global: 1.0,
    africa: 0.7,
    latam: 0.8,
    asia: 0.8,
    europe: 1.2,
    us: 1.7,
  },
  effortMultipliers: {
    light: 0.8,
    standard: 1.0,
    deep: 1.6,
  },
};

/** Matches the server default of PLATFORM_FEE_BPS. Used for deposit estimates in the browser. */
export const PLATFORM_FEE_BPS = 1500;

export function depositForBudget(budget: number, bps: number = PLATFORM_FEE_BPS) {
  if (!Number.isFinite(budget) || budget <= 0) {
    return { budget: 0, fee: 0, required: 0, feePercent: bps / 100 };
  }
  const fee = Math.floor((budget * bps) / 100) / 100;
  return { budget, fee, required: budget + fee, feePercent: bps / 100 };
}

/** Server-side config hook: PRICING_CONFIG_JSON overrides any subset of the defaults. */
export function resolvePricingConfig(raw?: string): PricingConfig {
  if (!raw) return DEFAULT_PRICING;
  try {
    const parsed = JSON.parse(raw) as Partial<PricingConfig>;
    return {
      ...DEFAULT_PRICING,
      ...parsed,
      geoMultipliers: { ...DEFAULT_PRICING.geoMultipliers, ...parsed.geoMultipliers },
      effortMultipliers: { ...DEFAULT_PRICING.effortMultipliers, ...parsed.effortMultipliers },
    };
  } catch {
    return DEFAULT_PRICING;
  }
}

function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

/**
 * The "from" reward for one mission: base × effort × geography, clamped and rounded.
 * Per-developer offers on top of this floor are a later layer (MissionOffer).
 */
export function missionReward(
  effort: EffortLevel,
  region: Region,
  config: PricingConfig = DEFAULT_PRICING,
): number {
  const raw =
    config.baseReward * config.effortMultipliers[effort] * config.geoMultipliers[region];
  const clamped = Math.min(config.rewardCeiling, Math.max(config.rewardFloor, raw));
  return roundTo(clamped, config.roundTo);
}

export function averageReward(
  efforts: EffortLevel[],
  region: Region,
  config: PricingConfig = DEFAULT_PRICING,
): number {
  if (efforts.length === 0) return missionReward("standard", region, config);
  const total = efforts.reduce((sum, effort) => sum + missionReward(effort, region, config), 0);
  return total / efforts.length;
}

export type BudgetEstimate = {
  recommended: number;
  low: number;
  high: number;
  averageReward: number;
};

/** Campaign budget: developer count × the blended average mission reward. */
export function campaignBudget(
  efforts: EffortLevel[],
  developerCount: number,
  region: Region,
  config: PricingConfig = DEFAULT_PRICING,
): BudgetEstimate {
  const average = averageReward(efforts, region, config);
  const recommended = roundTo(developerCount * average, config.roundTo);
  return {
    recommended,
    low: roundTo(recommended * (2 / 3), config.roundTo),
    high: roundTo(recommended * (4 / 3), config.roundTo),
    averageReward: roundTo(average, config.roundTo),
  };
}

/** Cost of opening one seat on each selected mission — the lowest budget that can launch. */
export function firstWaveSpend(
  efforts: EffortLevel[],
  region: Region,
  config: PricingConfig = DEFAULT_PRICING,
): number {
  return firstWaveSpendFromRewards(efforts.map((effort) => missionReward(effort, region, config)));
}

/** Sum of the rewards the company actually set on each included mission. */
export function firstWaveSpendFromRewards(rewards: number[]): number {
  return Math.round(rewards.reduce((sum, reward) => sum + (Number.isFinite(reward) && reward > 0 ? reward : 0), 0) * 100) / 100;
}

/**
 * Budget from the rewards on the selected missions, not the effort table.
 * Lets a $1 demo stay a $1 demo instead of rounding back up to the $100 floor.
 */
export function campaignBudgetFromRewards(
  rewards: number[],
  developerCount: number,
): BudgetEstimate {
  const valid = rewards.filter((reward) => Number.isFinite(reward) && reward >= 1);
  const average = valid.length ? valid.reduce((sum, reward) => sum + reward, 0) / valid.length : 1;
  const recommended = Math.round(developerCount * average * 100) / 100;
  return {
    recommended,
    low: Math.round(recommended * (2 / 3) * 100) / 100,
    high: Math.round(recommended * (4 / 3) * 100) / 100,
    averageReward: Math.round(average * 100) / 100,
  };
}

/** "For this budget, region X gives you approximately N developers." */
export function developersForBudget(
  budget: number,
  efforts: EffortLevel[],
  region: Region,
  config: PricingConfig = DEFAULT_PRICING,
): number {
  const average = averageReward(efforts, region, config);
  return Math.max(1, Math.floor(budget / average));
}

export type OutputEstimate = {
  buildsLow: number;
  buildsHigh: number;
  postsLow: number;
  postsHigh: number;
};

/** Rough campaign output ranges for the summary screen. */
export function estimateOutput(developerCount: number): OutputEstimate {
  return {
    buildsLow: Math.max(1, Math.round(developerCount * 0.6)),
    buildsHigh: Math.max(1, Math.round(developerCount * 0.8)),
    postsLow: Math.max(1, Math.round(developerCount * 0.4)),
    postsHigh: Math.max(1, Math.round(developerCount * 0.6)),
  };
}
