import { createHash, randomBytes } from "node:crypto";
import {
  createAuthorizationCode,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  mcpResource,
  registerClient,
  verifyAccessToken,
} from "../mcp/oauth";
import { createAdminClient } from "../src/lib/supabase/admin";

async function main() {
  const email = process.env.DEMO_COMPANY_EMAIL;
  if (!email) throw new Error("Set DEMO_COMPANY_EMAIL");

  const admin = createAdminClient();
  const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = users.users.find((candidate) => candidate.email === email);
  if (!user) throw new Error(`Seeded user not found: ${email}`);

  const client = await registerClient({
    client_name: "Missions OAuth proof",
    redirect_uris: ["http://localhost:8787/callback"],
    token_endpoint_auth_method: "none",
  });
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const code = await createAuthorizationCode(
    {
      clientId: client.client_id,
      redirectUri: client.redirect_uris[0],
      codeChallenge: challenge,
      scope: "mcp",
      resource: mcpResource(),
    },
    user.id,
  );

  const first = await exchangeAuthorizationCode({
    code,
    clientId: client.client_id,
    redirectUri: client.redirect_uris[0],
    codeVerifier: verifier,
    resource: mcpResource(),
  });
  const firstAuth = await verifyAccessToken(first.access_token);
  if (firstAuth.extra?.userId !== user.id || !firstAuth.scopes.includes("mcp")) {
    throw new Error("Access token was not bound to the expected user and scope");
  }

  const rotated = await exchangeRefreshToken({
    refreshToken: first.refresh_token,
    clientId: client.client_id,
    resource: mcpResource(),
  });
  const rotatedAuth = await verifyAccessToken(rotated.access_token);
  if (rotatedAuth.extra?.userId !== user.id) {
    throw new Error("Rotated access token changed identity");
  }

  console.log(
    JSON.stringify({
      ok: true,
      client_id: client.client_id,
      user_id: user.id,
      role: rotatedAuth.extra?.role,
      resource: rotatedAuth.resource?.toString(),
      scopes: rotatedAuth.scopes,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
