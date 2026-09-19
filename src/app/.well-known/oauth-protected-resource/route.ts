import {
  OAUTH_CORS_HEADERS,
  oauthJson,
  oauthProtectedResourceMetadata,
} from "../../../../mcp/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  return oauthJson(oauthProtectedResourceMetadata());
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS_HEADERS });
}
