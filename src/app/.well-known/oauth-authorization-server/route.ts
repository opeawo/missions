import {
  OAUTH_CORS_HEADERS,
  oauthAuthorizationMetadata,
  oauthJson,
} from "../../../../mcp/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  return oauthJson(oauthAuthorizationMetadata());
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS_HEADERS });
}
