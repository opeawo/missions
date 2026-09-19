import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  OAuthError,
  bearerToken,
  protectedResourceMetadataUrl,
  verifyAccessToken,
} from "../../../../mcp/oauth";
import { createMissionsMcpServer } from "../../../../mcp/register";
import { getProfileById } from "@/lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, mcp-session-id, Last-Event-ID, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function unauthorized() {
  return withCors(
    new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${protectedResourceMetadataUrl()}"`,
      },
    }),
  );
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

async function handle(req: Request): Promise<Response> {
  const token = bearerToken(req);
  if (!token) return unauthorized();

  let authInfo;
  try {
    authInfo = await verifyAccessToken(token);
  } catch (error) {
    if (error instanceof OAuthError) return unauthorized();
    throw error;
  }
  if (!authInfo.scopes.includes("mcp")) return unauthorized();
  const userId = String(authInfo.extra?.userId || "");
  const profile = await getProfileById(userId);
  if (!profile) return unauthorized();

  const server = createMissionsMcpServer({
    id: profile.id,
    role: profile.role,
    displayName: profile.display_name,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return withCors(await transport.handleRequest(req, { authInfo }));
}

export { handle as DELETE, handle as GET, handle as POST };
