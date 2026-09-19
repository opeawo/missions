import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import {
  OAuthError,
  validateAuthorizationRequest,
} from "../../../../mcp/oauth";
import { approveMcpConnection } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function hidden(name: string, value: string | undefined) {
  return value ? <input type="hidden" name={name} value={value} /> : null;
}

export default async function AuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  const values = await searchParams;
  let request;
  try {
    request = await validateAuthorizationRequest(values);
  } catch (error) {
    const message = error instanceof OAuthError ? error.message : "Invalid OAuth request";
    return (
      <main className="container-editorial mx-auto max-w-lg space-y-6 py-16">
        <p className="text-label text-accent">MCP connection failed</p>
        <h1 className="text-section">Invalid authorization request</h1>
        <p className="text-lead">{message}</p>
      </main>
    );
  }

  const profile = await getProfile();
  if (!profile) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === "string") params.set(key, value);
    }
    const next = `/oauth/authorize?${params.toString()}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <main className="container-editorial mx-auto max-w-lg space-y-8 py-16">
      <div className="space-y-3">
        <p className="text-label text-accent">Connect MCP</p>
        <h1 className="text-section">Connect Cursor to Missions?</h1>
        <p className="text-lead">
          {request.client.client_name || "Cursor"} will use Missions as{" "}
          <strong>{profile.display_name}</strong> ({profile.role}).
        </p>
      </div>

      <section className="card space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Cursor can call Missions tools with your account. Company accounts can create and review
          missions. Developer accounts can claim and submit work.
        </p>
        <form action={approveMcpConnection}>
          {hidden("response_type", "code")}
          {hidden("client_id", request.clientId)}
          {hidden("redirect_uri", request.redirectUri)}
          {hidden("code_challenge", request.codeChallenge)}
          {hidden("code_challenge_method", "S256")}
          {hidden("scope", request.scope)}
          {hidden("resource", request.resource)}
          {hidden("state", request.state)}
          <button type="submit" className="btn-primary w-full">
            Connect Cursor
          </button>
        </form>
      </section>
    </main>
  );
}
