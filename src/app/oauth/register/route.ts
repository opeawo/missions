import {
  OAUTH_CORS_HEADERS,
  oauthErrorResponse,
  oauthJson,
  registerClient,
} from "../../../../mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as {
      client_name?: string;
      redirect_uris?: unknown;
      token_endpoint_auth_method?: string;
    };
    const client = await registerClient(input);
    return oauthJson(
      {
        ...client,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: "mcp",
      },
      { status: 201 },
    );
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS_HEADERS });
}
