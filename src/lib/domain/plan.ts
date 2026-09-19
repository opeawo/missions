import { readFileSync } from "node:fs";
import { join } from "node:path";
import OpenAI from "openai";
import { DELIVERABLE_TYPES, DomainError, type DeliverableType, type MissionVisibility } from "./types";
import { EFFORT_LEVELS, type EffortLevel } from "@/lib/pricing";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 400_000;
const MAX_TEXT = 12_000;
const PROMPT_PATH = join(process.cwd(), "src/lib/domain/mission-generator-prompt.md");

export type ProposedMission = {
  title: string;
  pitch: string;
  description: string;
  target_user: string;
  requirements: string;
  required_deliverables: DeliverableType[];
  effort: EffortLevel;
  /** Company-set USDC reward. When omitted, launch falls back to the effort table. */
  reward_amount?: number;
  estimated_effort: string;
  visibility: MissionVisibility;
  public_post: boolean;
  suggested_public_proof: string;
  why_useful: string;
  why_showcases: string;
};

function generatorPrompt(): string {
  return readFileSync(PROMPT_PATH, "utf8");
}

export type ProductPlan = {
  product_name: string;
  product_summary: string;
  category: string;
  missions: ProposedMission[];
};

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function assertHttpUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new DomainError("Paste a full URL, starting with https://", "invalid_url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new DomainError("Only http and https URLs are supported", "invalid_url");
  }
  return parsed.toString();
}

async function readPublicUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "MissionsBot/1.0 (product briefing)" },
      redirect: "follow",
    });
    if (!res.ok) {
      throw new DomainError(`Could not read that URL (${res.status})`, "fetch_failed");
    }
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
    const text = new TextDecoder("utf-8", { fatal: false }).decode(slice);
    const contentType = res.headers.get("content-type") || "";
    const body = contentType.includes("html") ? htmlToText(text) : text;
    return body.slice(0, MAX_TEXT);
  } catch (err) {
    if (err instanceof DomainError) throw err;
    throw new DomainError(
      "Could not read that URL. Check it is public, or add a short note under Add context.",
      "fetch_failed",
    );
  } finally {
    clearTimeout(timer);
  }
}

function mapDeliverable(value: string): DeliverableType | null {
  const text = value.trim().toLowerCase();
  if ((DELIVERABLE_TYPES as readonly string[]).includes(text)) return text as DeliverableType;
  if (/github|repo|readme/.test(text)) return "repository";
  if (/demo|live url|deploy|interactive/.test(text)) return "demo";
  if (/linkedin/.test(text)) return "linkedin";
  if (/\bx\b|twitter/.test(text)) return "x";
  if (/substack/.test(text)) return "substack";
  if (/blog|dev\.to|medium|article/.test(text)) return "blog";
  if (/video|youtube/.test(text)) return "video";
  if (/screenshot|file|walkthrough|notes/.test(text)) return "files";
  if (/description|write-?up|explanation/.test(text)) return "description";
  return null;
}

function normalizeDeliverables(raw: unknown): DeliverableType[] {
  const values = Array.isArray(raw) ? raw.map(String) : [];
  const mapped = values
    .map(mapDeliverable)
    .filter((d): d is DeliverableType => Boolean(d));
  const unique = [...new Set(mapped)];
  if (!unique.includes("repository")) unique.unshift("repository");
  return unique;
}

type RawMission = Partial<ProposedMission> & {
  visibility?: string;
  public_post?: boolean;
  required_deliverables?: unknown;
  suggested_skills?: unknown;
};

function effortFromRaw(raw: RawMission): EffortLevel {
  const effort = String(raw.effort || "").trim();
  if (EFFORT_LEVELS.includes(effort as EffortLevel)) return effort as EffortLevel;
  const hours = String(raw.estimated_effort || "").toLowerCase();
  if (/\b([6-9]|1[0-9]|[2-9][0-9])\b/.test(hours) && /hour/.test(hours)) return "standard";
  if (/advanced|deep|multi-?day/.test(hours)) return "deep";
  return "light";
}

function visibilityFromRaw(raw: RawMission): MissionVisibility {
  const value = String(raw.visibility || "").trim().toLowerCase();
  if (value === "private") return "private";
  return "public";
}

function composeRequirements(raw: RawMission): string {
  const skills = Array.isArray(raw.suggested_skills)
    ? raw.suggested_skills.map(String).filter(Boolean).join(", ")
    : "";
  const targetUser = String(raw.target_user || "").trim();
  const whyUseful = String(raw.why_useful || "").trim();
  const whyShowcases = String(raw.why_showcases || "").trim();
  const proof = String(raw.suggested_public_proof || "").trim();
  const hours = String(raw.estimated_effort || "").trim();
  return [
    targetUser ? `Target user: ${targetUser}` : "",
    String(raw.requirements || "").trim(),
    skills ? `Suggested skills: ${skills}` : "",
    hours ? `Estimated effort: ${hours}` : "",
    whyUseful ? `Why it is useful: ${whyUseful}` : "",
    whyShowcases ? `Why it showcases the product: ${whyShowcases}` : "",
    proof ? `Suggested public proof: ${proof}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normalizeMission(raw: RawMission): ProposedMission | null {
  const title = String(raw.title || "").trim();
  const description = String(raw.description || raw.pitch || "").trim();
  if (!title || !description) return null;
  const visibility = visibilityFromRaw(raw);
  const publicPost = visibility === "public" && raw.public_post !== false;
  const deliverables = normalizeDeliverables(raw.required_deliverables);
  if (
    publicPost &&
    !deliverables.some((d) => ["linkedin", "x", "substack", "blog", "video"].includes(d))
  ) {
    deliverables.push("linkedin");
  }
  const targetUser = String(raw.target_user || "").trim();
  const whyUseful = String(raw.why_useful || "").trim();
  const whyShowcases = String(raw.why_showcases || "").trim();
  return {
    title: title.slice(0, 120),
    pitch: String(raw.pitch || description).trim().slice(0, 220),
    description,
    target_user: targetUser.slice(0, 160),
    requirements: composeRequirements(raw),
    required_deliverables: deliverables,
    effort: effortFromRaw(raw),
    estimated_effort: String(raw.estimated_effort || "").trim().slice(0, 80),
    visibility,
    public_post: publicPost,
    suggested_public_proof: String(raw.suggested_public_proof || "").trim().slice(0, 220),
    why_useful: whyUseful.slice(0, 280),
    why_showcases: whyShowcases.slice(0, 280),
  };
}

export async function planFromUrl(input: {
  url: string;
  context?: string;
}): Promise<ProductPlan> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new DomainError("OPENAI_API_KEY is not configured", "ai_config");

  const url = assertHttpUrl(input.url);
  let pageText = "";
  try {
    pageText = await readPublicUrl(url);
  } catch (err) {
    if (!input.context?.trim()) throw err;
  }

  const client = new OpenAI({ apiKey: key });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: generatorPrompt(),
      },
      {
        role: "user",
        content: [
          `Product URL: ${url}`,
          input.context?.trim() ? `Extra context:\n${input.context.trim().slice(0, 4000)}` : "",
          pageText ? `Page text:\n${pageText}` : "The page could not be fetched. Infer from the URL and extra context only. Do not invent capabilities.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new DomainError("Model returned an empty plan", "ai");
  const parsed = JSON.parse(raw) as Partial<ProductPlan>;
  const missions = (parsed.missions || [])
    .map((m) => normalizeMission(m))
    .filter((m): m is ProposedMission => Boolean(m))
    .slice(0, 6);
  if (missions.length < 3) {
    throw new DomainError("Could not propose enough missions from that URL. Try docs or a repo.", "ai");
  }
  return {
    product_name: String(parsed.product_name || "Your product").trim().slice(0, 80),
    product_summary: String(parsed.product_summary || "").trim().slice(0, 400),
    category: String(parsed.category || "").trim().slice(0, 80),
    missions,
  };
}
