export const DELIVERABLE_TYPES = [
  "description",
  "repository",
  "demo",
  "linkedin",
  "x",
  "substack",
  "blog",
  "video",
  "files",
] as const;

export type DeliverableType = (typeof DELIVERABLE_TYPES)[number];

export type UserRole = "company" | "developer";
export type MissionStatus = "draft" | "open" | "claimed" | "completed" | "cancelled";
export type MissionVisibility = "public" | "private";
export type ClaimStatus = "active" | "withdrawn";
export type SubmissionStatus = "pending" | "approved" | "rejected";
export type PaymentStatus = "pending" | "processing" | "paid" | "failed";
export type FundingStatus = "unfunded" | "funding" | "funded" | "released";
export type RefundStatus = "pending" | "processing" | "sent" | "failed";
export type CampaignStatus = "draft" | "live" | "completed" | "cancelled";

export type OtherLink = { label: string; url: string };
export type Attachment = { name: string; url: string };

export type Actor = {
  id: string;
  role: UserRole;
  displayName: string;
};

export type Profile = {
  id: string;
  role: UserRole;
  display_name: string;
  /** Developer payout address. */
  wallet_address: string | null;
  country: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  substack_url: string | null;
  other_links: OtherLink[];
  created_at: string;
};

export type Mission = {
  id: string;
  company_id: string;
  /** Set when the mission belongs to a campaign; funding and payouts then run through the campaign wallet. */
  campaign_id: string | null;
  title: string;
  description: string;
  reward_amount: number | string;
  reward_currency: string;
  requirements: string;
  required_deliverables: DeliverableType[];
  visibility: MissionVisibility;
  status: MissionStatus;
  funding_status: FundingStatus;
  /** This mission's own collection wallet; organizations deposit reward + fee here. */
  deposit_address: string | null;
  deposit_wallet_label: string | null;
  deposit_smart_account_address: string | null;
  platform_fee_bps: number | null;
  platform_fee_amount: number | string | null;
  gross_amount: number | string | null;
  fee_transaction_hash: string | null;
  funded_at: string | null;
  deadline: string | null;
  discord_message_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type Claim = {
  id: string;
  mission_id: string;
  developer_id: string;
  status: ClaimStatus;
  claimed_at: string;
};

export type UrlVerification = {
  url: string;
  type: string;
  status: "verified" | "url_confirmed" | "could_not_verify" | "needs_company_review";
  detail: string;
};

export type Submission = {
  id: string;
  mission_id: string;
  claim_id: string;
  developer_id: string;
  description: string;
  repository_url: string | null;
  demo_url: string | null;
  video_url: string | null;
  post_urls: string[];
  attachments: Attachment[];
  status: SubmissionStatus;
  verification: { urls?: UrlVerification[] } | Record<string, never>;
  submitted_at: string;
};

export type Payment = {
  id: string;
  mission_id: string;
  submission_id: string;
  developer_id: string;
  amount: number | string;
  currency: string;
  chain: string;
  wallet_address: string;
  transaction_hash: string | null;
  status: PaymentStatus;
  error: string | null;
};

export type Campaign = {
  id: string;
  company_id: string;
  product_url: string;
  product_name: string;
  product_summary: string;
  geography: string;
  developer_target_count: number;
  total_budget: number | string;
  currency: string;
  status: CampaignStatus;
  funding_status: FundingStatus;
  deposit_address: string | null;
  deposit_wallet_label: string | null;
  deposit_smart_account_address: string | null;
  platform_fee_bps: number | null;
  platform_fee_amount: number | string | null;
  gross_amount: number | string | null;
  fee_transaction_hash: string | null;
  funded_at: string | null;
  ai_plan: Record<string, unknown>;
  created_at: string;
};

export type Refund = {
  id: string;
  mission_id: string;
  /** An address that previously deposited into the mission wallet. */
  to_address: string;
  amount: number | string;
  currency: string;
  chain: string;
  transaction_hash: string | null;
  status: RefundStatus;
  error: string | null;
  created_at: string;
};

export type MissionDraft = {
  title: string;
  description: string;
  requirements: string;
  required_deliverables: string[];
  suggested_reward: number;
};

/** Companies can change copy until someone claims the work. */
export function missionIsEditable(mission: Pick<Mission, "status">): boolean {
  return mission.status === "draft" || mission.status === "open";
}

/** Companies can change a reward until funds have been committed to the mission. */
export function missionRewardIsLocked(
  mission: Pick<Mission, "funding_status">,
): boolean {
  return mission.funding_status !== "unfunded";
}

export function parseCampaign(row: Campaign): Campaign {
  return {
    ...row,
    total_budget: Number(row.total_budget),
    platform_fee_amount: row.platform_fee_amount === null ? null : Number(row.platform_fee_amount),
    gross_amount: row.gross_amount === null ? null : Number(row.gross_amount),
    ai_plan: row.ai_plan ?? {},
  };
}

export type DeveloperCard = {
  id: string;
  display_name: string;
  country: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  substack_url: string | null;
  other_links: OtherLink[];
  wallet_address: string | null;
};

export class DomainError extends Error {
  constructor(
    message: string,
    public code: string = "domain_error",
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function blankToNull(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

export function missionUrl(id: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://missions.cv";
  return `${base}/missions/${id}`;
}

/** Postgres returns numeric columns as strings; missions are read in several modules. */
export function parseMission(row: Mission): Mission {
  return {
    ...row,
    reward_amount: Number(row.reward_amount),
    platform_fee_amount: row.platform_fee_amount === null ? null : Number(row.platform_fee_amount),
    gross_amount: row.gross_amount === null ? null : Number(row.gross_amount),
    funding_status: row.funding_status ?? "unfunded",
    campaign_id: row.campaign_id ?? null,
    required_deliverables: (row.required_deliverables ?? []) as DeliverableType[],
  };
}

export function toDeveloperCard(profile: Profile): DeveloperCard {
  return {
    id: profile.id,
    display_name: profile.display_name,
    country: profile.country,
    github_url: profile.github_url,
    linkedin_url: profile.linkedin_url,
    x_url: profile.x_url,
    substack_url: profile.substack_url,
    other_links: profile.other_links ?? [],
    wallet_address: profile.wallet_address,
  };
}
