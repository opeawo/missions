import OpenAI from "openai";
import { DELIVERABLE_TYPES, DomainError, type DeliverableType } from "./types";
import { EFFORT_LEVELS, type EffortLevel } from "@/lib/pricing";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 400_000;
const MAX_TEXT = 12_000;

export type ProposedMission = {
  title: string;
  pitch: string;
  description: string;
  requirements: string;
  required_deliverables: DeliverableType[];
  effort: EffortLevel;
  public_post: boolean;
};

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

function normalizeMission(raw: Partial<ProposedMission>): ProposedMission | null {
  const title = String(raw.title || "").trim();
  const description = String(raw.description || raw.pitch || "").trim();
  if (!title || !description) return null;
  const effort = EFFORT_LEVELS.includes(raw.effort as EffortLevel)
    ? (raw.effort as EffortLevel)
    : "standard";
  const allowed = new Set<string>(DELIVERABLE_TYPES);
  let deliverables = (raw.required_deliverables || []).filter((d): d is DeliverableType =>
    allowed.has(d),
  );
  if (!deliverables.includes("repository")) deliverables = ["repository", ...deliverables];
  if (!deliverables.includes("demo")) deliverables = [...deliverables, "demo"];
  const publicPost = raw.public_post !== false;
  if (publicPost && !deliverables.some((d) => ["linkedin", "x", "substack", "blog"].includes(d))) {
    deliverables = [...deliverables, "linkedin"];
  }
  return {
    title: title.slice(0, 120),
    pitch: String(raw.pitch || description).trim().slice(0, 220),
    description,
    requirements: String(raw.requirements || "").trim(),
    required_deliverables: deliverables,
    effort,
    public_post: publicPost,
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
        content:
          "You design paid developer missions for a product. Be concrete and opinionated. JSON only.",
      },
      {
        role: "user",
        content: [
          "Read this product and propose 3 to 6 missions developers can ship.",
          "Each mission is one developer building a working example.",
          "Return JSON with keys:",
          "product_name, product_summary (1-2 sentences), category,",
          "missions: array of { title, pitch (one sentence), description, requirements,",
          "required_deliverables, effort, public_post }.",
          `effort must be one of: ${EFFORT_LEVELS.join(", ")}.`,
          `required_deliverables must be a subset of: ${DELIVERABLE_TYPES.join(", ")}.`,
          "Titles start with a verb. Do not mention pricing. Prefer real integrations over toy apps.",
          "",
          `Product URL: ${url}`,
          input.context?.trim() ? `Extra context:\n${input.context.trim().slice(0, 4000)}` : "",
          pageText ? `Page text:\n${pageText}` : "The page could not be fetched. Infer from the URL.",
        ]
          .filter(Boolean)
          .join("\n"),
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
