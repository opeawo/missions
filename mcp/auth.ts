import { timingSafeEqual } from "node:crypto";

/** Compare a presented bearer/header value to MISSIONS_MCP_KEY without leaking it. */
export function mcpKeyAuthorized(presented: string | null | undefined): boolean {
  const expected = process.env.MISSIONS_MCP_KEY;
  if (!expected || !presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return req.headers.get("x-missions-mcp-key");
}
