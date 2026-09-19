import OpenAI from "openai";
import { DELIVERABLE_TYPES, DomainError, type MissionDraft } from "./types";

export type DraftRequest = {
  instruction: string;
  productWebsite?: string;
  documentation?: string;
  repositoryContext?: string;
};

export async function draftMission(input: DraftRequest): Promise<MissionDraft> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new DomainError("OPENAI_API_KEY is not configured", "ai_config");
  }
  const client = new OpenAI({ apiKey: key });
  const prompt = [
    "Create a paid developer Mission. Return JSON only with keys:",
    "title, description, requirements, required_deliverables (array), suggested_reward (number USD).",
    `required_deliverables must be a subset of: ${DELIVERABLE_TYPES.join(", ")}.`,
    "Always include repository and a public writing deliverable (linkedin, x, substack, or blog).",
    "",
    `Instruction: ${input.instruction}`,
    input.productWebsite ? `Product website: ${input.productWebsite}` : "",
    input.documentation ? `Documentation:\n${input.documentation.slice(0, 8000)}` : "",
    input.repositoryContext ? `Repository context:\n${input.repositoryContext.slice(0, 8000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write concise, high-signal paid work briefs for developers. No mission types. No fluff.",
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new DomainError("Model returned an empty draft", "ai");
  const parsed = JSON.parse(raw) as MissionDraft;
  return {
    title: parsed.title,
    description: parsed.description,
    requirements: parsed.requirements,
    required_deliverables: (parsed.required_deliverables || []).filter((d) =>
      (DELIVERABLE_TYPES as readonly string[]).includes(d),
    ),
    suggested_reward: Number(parsed.suggested_reward) || 400,
  };
}
