import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; mode?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const signup = params.mode === "signup";
  return (
    <div className="container-editorial mx-auto max-w-md py-16">
      <LoginForm next={next} signup={signup} />
    </div>
  );
}
