import {
  OAUTH_CORS_HEADERS,
  OAuthError,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  getClient,
  oauthErrorResponse,
  oauthJson,
} from "../../../../mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      throw new OAuthError("invalid_request", "Token requests must be form encoded");
    }
    const form = new URLSearchParams(await request.text());
    const grantType = form.get("grant_type");
    const clientId = form.get("client_id") || "";
    if (!clientId || !(await getClient(clientId))) {
      throw new OAuthError("invalid_client", "Unknown OAuth client", 401);
    }

    if (grantType === "authorization_code") {
      const code = form.get("code");
      const redirectUri = form.get("redirect_uri");
      const codeVerifier = form.get("code_verifier");
      if (!code || !redirectUri || !codeVerifier) {
        throw new OAuthError(
          "invalid_request",
          "code, redirect_uri, and code_verifier are required",
        );
      }
      return oauthJson(
        await exchangeAuthorizationCode({
          code,
          clientId,
          redirectUri,
          codeVerifier,
          resource: form.get("resource") || undefined,
        }),
      );
    }

    if (grantType === "refresh_token") {
      const refreshToken = form.get("refresh_token");
      if (!refreshToken) {
        throw new OAuthError("invalid_request", "refresh_token is required");
      }
      return oauthJson(
        await exchangeRefreshToken({
          refreshToken,
          clientId,
          scope: form.get("scope") || undefined,
          resource: form.get("resource") || undefined,
        }),
      );
    }

    throw new OAuthError("unsupported_grant_type", "Unsupported grant_type");
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: OAUTH_CORS_HEADERS });
}
