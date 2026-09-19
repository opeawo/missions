import type { UrlVerification } from "./types";

export function classifyUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "github.com" || host.endsWith(".github.io")) return "github";
    if (host.includes("linkedin.com")) return "linkedin";
    if (host === "x.com" || host === "twitter.com") return "x";
    if (host.endsWith("substack.com")) return "substack";
    if (host.includes("youtube.com") || host.includes("youtu.be") || host.includes("loom.com") || host.includes("vimeo.com"))
      return "video";
    if (host.includes("vercel.app") || host.includes("netlify.app") || host.includes("railway.app")) return "demo";
    return "blog";
  } catch {
    return "other";
  }
}

function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function probe(url: string, keywords: string[]): Promise<UrlVerification> {
  const type = classifyUrl(url);
  if (!isValidHttpUrl(url)) {
    return { url, type, status: "could_not_verify", detail: "Invalid URL format" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "MissionsBot/1.0" },
    });
    if (res.status === 405 || res.status === 403 || res.status === 401) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "MissionsBot/1.0" },
      });
    }

    if (res.status === 401 || res.status === 403) {
      return {
        url,
        type,
        status: "needs_company_review",
        detail: "The platform blocked automated access. Company review required.",
      };
    }
    if (!res.ok) {
      return { url, type, status: "could_not_verify", detail: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html") && res.body) {
      const text = (await res.text()).slice(0, 80_000).toLowerCase();
      const meaningful = text.length > 200;
      if (!meaningful) {
        return { url, type, status: "url_confirmed", detail: "Reachable, little content retrieved" };
      }
      const hit = keywords.some((k) => k && text.includes(k.toLowerCase()));
      if (hit) {
        return { url, type, status: "verified", detail: "Reachable and mentions the Mission" };
      }
      return { url, type, status: "url_confirmed", detail: "Reachable with content" };
    }

    return { url, type, status: "url_confirmed", detail: "URL is reachable" };
  } catch {
    return {
      url,
      type,
      status: "could_not_verify",
      detail: "Could not automatically verify (timeout or network).",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function verifySubmissionUrls(input: {
  missionTitle: string;
  repository_url?: string | null;
  demo_url?: string | null;
  video_url?: string | null;
  post_urls?: string[];
}): Promise<UrlVerification[]> {
  const urls = [
    input.repository_url,
    input.demo_url,
    input.video_url,
    ...(input.post_urls ?? []),
  ].filter((u): u is string => Boolean(u && u.trim()));

  const keywords = input.missionTitle.split(/\s+/).filter((w) => w.length > 3);
  const results: UrlVerification[] = [];
  for (const url of urls) {
    results.push(await probe(url.trim(), keywords));
  }
  return results;
}

export function verificationLabel(status: UrlVerification["status"]): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "url_confirmed":
      return "URL confirmed";
    case "could_not_verify":
      return "Could not automatically verify";
    case "needs_company_review":
      return "Needs company review";
  }
}
