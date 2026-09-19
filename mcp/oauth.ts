import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createAdminClient } from "../src/lib/supabase/admin";
import type { Profile, UserRole } from "../src/lib/domain/types";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const AUTHORIZATION_CODE_TTL_SECONDS = 5 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

type OAuthClient = {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  token_endpoint_auth_method: "none";
  created_at: string;
};

type AccessClaims = {
  typ: "access";
  iss: string;
  aud: string;
  sub: string;
  role: UserRole;
  client_id: string;
  scope: string;
  iat: number;
  exp: number;
  jti: string;
};

export class OAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function oauthIssuer(): string {
  return appUrl();
}

export function mcpResource(): string {
  return `${appUrl()}/api/mcp`;
}

export function protectedResourceMetadataUrl(): string {
  return `${appUrl()}/.well-known/oauth-protected-resource/api/mcp`;
}

function oauthSecret(): string {
  const secret = process.env.MISSIONS_OAUTH_SECRET;
  if (!secret) throw new Error("MISSIONS_OAUTH_SECRET is not set");
  return secret;
}

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function signJwt(payload: AccessClaims): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", oauthSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function parseAccessToken(token: string): AccessClaims {
  const parts = token.split(".");
  if (parts.length !== 3) throw new OAuthError("invalid_token", "Malformed access token", 401);
  const [header, body, suppliedSignature] = parts;
  const expectedSignature = createHmac("sha256", oauthSecret())
    .update(`${header}.${body}`)
    .digest();
  const supplied = Buffer.from(suppliedSignature, "base64url");
  if (
    supplied.length !== expectedSignature.length ||
    !timingSafeEqual(supplied, expectedSignature)
  ) {
    throw new OAuthError("invalid_token", "Invalid access token", 401);
  }

  let claims: AccessClaims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AccessClaims;
  } catch {
    throw new OAuthError("invalid_token", "Malformed access token", 401);
  }
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.typ !== "access" ||
    claims.iss !== oauthIssuer() ||
    claims.aud !== mcpResource() ||
    !claims.sub ||
    !claims.client_id ||
    !["company", "developer"].includes(claims.role) ||
    claims.exp <= now
  ) {
    throw new OAuthError("invalid_token", "Expired or invalid access token", 401);
  }
  return claims;
}

export async function verifyAccessToken(token: string): Promise<AuthInfo> {
  const claims = parseAccessToken(token);
  return {
    token,
    clientId: claims.client_id,
    scopes: claims.scope.split(" ").filter(Boolean),
    expiresAt: claims.exp,
    resource: new URL(claims.aud),
    extra: { userId: claims.sub, role: claims.role },
  };
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
}

export function validRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    if (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1")
    ) {
      return true;
    }
    return value === "cursor://anysphere.cursor-mcp/oauth/callback";
  } catch {
    return false;
  }
}

export async function registerClient(input: {
  client_name?: string;
  redirect_uris?: unknown;
  token_endpoint_auth_method?: string;
}): Promise<OAuthClient> {
  if (
    !Array.isArray(input.redirect_uris) ||
    input.redirect_uris.length === 0 ||
    !input.redirect_uris.every((uri) => typeof uri === "string" && validRedirectUri(uri))
  ) {
    throw new OAuthError("invalid_redirect_uri", "A valid redirect_uris array is required");
  }
  if (input.token_endpoint_auth_method && input.token_endpoint_auth_method !== "none") {
    throw new OAuthError("invalid_client_metadata", "Only public OAuth clients are supported");
  }

  const client: OAuthClient = {
    client_id: randomUUID(),
    client_name: input.client_name?.trim() || null,
    redirect_uris: [...new Set(input.redirect_uris as string[])],
    token_endpoint_auth_method: "none",
    created_at: new Date().toISOString(),
  };
  const { error } = await createAdminClient().from("mcp_oauth_clients").insert(client);
  if (error) throw new OAuthError("server_error", error.message, 500);
  return client;
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const { data, error } = await createAdminClient()
    .from("mcp_oauth_clients")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new OAuthError("server_error", error.message, 500);
  return (data as OAuthClient | null) ?? null;
}

export type AuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scope: string;
  resource: string;
};

export async function validateAuthorizationRequest(
  values: Record<string, string | string[] | undefined>,
): Promise<AuthorizationRequest & { client: OAuthClient }> {
  const one = (key: string) => {
    const value = values[key];
    return Array.isArray(value) ? value[0] : value;
  };
  if (one("response_type") !== "code") {
    throw new OAuthError("unsupported_response_type", "Only response_type=code is supported");
  }
  const clientId = one("client_id") || "";
  const redirectUri = one("redirect_uri") || "";
  const codeChallenge = one("code_challenge") || "";
  if (one("code_challenge_method") !== "S256" || !codeChallenge) {
    throw new OAuthError("invalid_request", "PKCE with code_challenge_method=S256 is required");
  }
  const client = await getClient(clientId);
  if (!client) throw new OAuthError("invalid_client", "Unknown OAuth client", 401);
  if (!client.redirect_uris.includes(redirectUri)) {
    throw new OAuthError("invalid_request", "redirect_uri is not registered");
  }
  const resource = one("resource") || mcpResource();
  if (resource !== mcpResource()) {
    throw new OAuthError("invalid_target", "Invalid MCP resource");
  }
  const requestedScopes = (one("scope") || "mcp").split(" ").filter(Boolean);
  if (requestedScopes.some((scope) => scope !== "mcp")) {
    throw new OAuthError("invalid_scope", "Only the mcp scope is supported");
  }
  return {
    client,
    clientId,
    redirectUri,
    codeChallenge,
    state: one("state"),
    scope: "mcp",
    resource,
  };
}

export async function createAuthorizationCode(
  request: AuthorizationRequest,
  userId: string,
): Promise<string> {
  const code = base64url(randomBytes(32));
  const { error } = await createAdminClient().from("mcp_oauth_authorization_codes").insert({
    code_hash: hash(code),
    client_id: request.clientId,
    user_id: userId,
    redirect_uri: request.redirectUri,
    code_challenge: request.codeChallenge,
    scope: request.scope,
    resource: request.resource,
    expires_at: new Date(Date.now() + AUTHORIZATION_CODE_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) throw new OAuthError("server_error", error.message, 500);
  return code;
}

async function profileForToken(userId: string): Promise<Profile> {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) throw new OAuthError("invalid_grant", "Missions profile no longer exists");
  return data as Profile;
}

async function issueTokens(
  profile: Profile,
  clientId: string,
  scope: string,
  resource: string,
) {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = signJwt({
    typ: "access",
    iss: oauthIssuer(),
    aud: resource,
    sub: profile.id,
    role: profile.role,
    client_id: clientId,
    scope,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
    jti: randomUUID(),
  });
  const refreshToken = base64url(randomBytes(48));
  const { error } = await createAdminClient().from("mcp_oauth_refresh_tokens").insert({
    token_hash: hash(refreshToken),
    client_id: clientId,
    user_id: profile.id,
    scope,
    resource,
    expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) throw new OAuthError("server_error", error.message, 500);
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope,
  };
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  resource?: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mcp_oauth_authorization_codes")
    .select("*")
    .eq("code_hash", hash(input.code))
    .maybeSingle();
  if (error || !data) throw new OAuthError("invalid_grant", "Invalid authorization code");
  if (
    data.used_at ||
    new Date(data.expires_at).getTime() <= Date.now() ||
    data.client_id !== input.clientId ||
    data.redirect_uri !== input.redirectUri ||
    (input.resource && data.resource !== input.resource)
  ) {
    throw new OAuthError("invalid_grant", "Invalid or expired authorization code");
  }
  if (
    input.codeVerifier.length < 43 ||
    input.codeVerifier.length > 128 ||
    hash(input.codeVerifier) !== data.code_challenge
  ) {
    throw new OAuthError("invalid_grant", "PKCE verification failed");
  }
  const { data: consumed, error: consumeError } = await admin
    .from("mcp_oauth_authorization_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", hash(input.code))
    .is("used_at", null)
    .select("code_hash");
  if (consumeError || !consumed?.length) {
    throw new OAuthError("invalid_grant", "Authorization code was already used");
  }
  return issueTokens(
    await profileForToken(data.user_id),
    data.client_id,
    data.scope,
    data.resource,
  );
}

export async function exchangeRefreshToken(input: {
  refreshToken: string;
  clientId: string;
  scope?: string;
  resource?: string;
}) {
  const admin = createAdminClient();
  const tokenHash = hash(input.refreshToken);
  const { data, error } = await admin
    .from("mcp_oauth_refresh_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (
    error ||
    !data ||
    data.revoked_at ||
    new Date(data.expires_at).getTime() <= Date.now() ||
    data.client_id !== input.clientId ||
    (input.resource && data.resource !== input.resource) ||
    (input.scope && input.scope !== data.scope)
  ) {
    throw new OAuthError("invalid_grant", "Invalid or expired refresh token");
  }
  const { data: revoked, error: revokeError } = await admin
    .from("mcp_oauth_refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .select("token_hash");
  if (revokeError || !revoked?.length) {
    throw new OAuthError("invalid_grant", "Refresh token was already used");
  }
  return issueTokens(
    await profileForToken(data.user_id),
    data.client_id,
    data.scope,
    data.resource,
  );
}

export function oauthAuthorizationMetadata() {
  const issuer = oauthIssuer();
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["mcp"],
  };
}

export function oauthProtectedResourceMetadata() {
  return {
    resource: mcpResource(),
    authorization_servers: [oauthIssuer()],
    scopes_supported: ["mcp"],
    bearer_methods_supported: ["header"],
    resource_name: "Missions MCP",
  };
}

export const OAUTH_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
} as const;

export function oauthJson(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(OAUTH_CORS_HEADERS)) headers.set(key, value);
  return Response.json(data, { ...init, headers });
}

export function oauthErrorResponse(error: unknown): Response {
  const known =
    error instanceof OAuthError
      ? error
      : new OAuthError("server_error", "OAuth request failed", 500);
  return oauthJson(
    { error: known.code, error_description: known.message },
    { status: known.status },
  );
}
