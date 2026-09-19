import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { bearerToken, mcpKeyAuthorized } from "../../../../mcp/auth";
import { createMissionsMcpServer } from "../../../../mcp/register";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, mcp-session-id, Last-Event-ID, mcp-protocol-version, x-missions-mcp-key",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function unauthorized() {
  return withCors(
    new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": "Bearer",
      },
    }),
  );
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

async function handle(req: Request): Promise<Response> {
  if (!mcpKeyAuthorized(bearerToken(req))) return unauthorized();

  const server = createMissionsMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return withCors(await transport.handleRequest(req));
}

export { handle as DELETE, handle as GET, handle as POST };
