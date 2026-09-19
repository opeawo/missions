import { createAdminClient } from "../src/lib/supabase/admin";

type SeedUser = {
  email: string;
  password: string;
  role: "company" | "developer";
  display_name: string;
  extra?: Record<string, unknown>;
};

async function upsertUser(admin: ReturnType<typeof createAdminClient>, spec: SeedUser) {
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  let user = list.users.find((u) => u.email === spec.email);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email: spec.email,
      password: spec.password,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    user = created.data.user;
  }
  const { error } = await admin.from("profiles").upsert({
    id: user.id,
    role: spec.role,
    display_name: spec.display_name,
    ...spec.extra,
  });
  if (error) throw error;
  return user;
}

export async function seed(options?: { resetMissions?: boolean }) {
  const companyEmail = process.env.DEMO_COMPANY_EMAIL;
  const companyPassword = process.env.DEMO_COMPANY_PASSWORD;
  const developerEmail = process.env.DEMO_DEVELOPER_EMAIL;
  const developerPassword = process.env.DEMO_DEVELOPER_PASSWORD;
  if (!companyEmail || !companyPassword || !developerEmail || !developerPassword) {
    throw new Error("Set DEMO_COMPANY_EMAIL/PASSWORD and DEMO_DEVELOPER_EMAIL/PASSWORD in .env.local");
  }

  const admin = createAdminClient();
  const company = await upsertUser(admin, {
    email: companyEmail,
    password: companyPassword,
    role: "company",
    display_name: process.env.DEMO_COMPANY_NAME || "Northstar AI",
  });
  const developer = await upsertUser(admin, {
    email: developerEmail,
    password: developerPassword,
    role: "developer",
    display_name: process.env.DEMO_DEVELOPER_NAME || "Ada Okonkwo",
    extra: {
      wallet_address: process.env.DEMO_DEVELOPER_WALLET || null,
      country: process.env.DEMO_DEVELOPER_COUNTRY || "NG",
      github_url: process.env.DEMO_DEVELOPER_GITHUB || "https://github.com/adaokonkwo",
      linkedin_url: process.env.DEMO_DEVELOPER_LINKEDIN || "https://www.linkedin.com/in/adaokonkwo",
      x_url: process.env.DEMO_DEVELOPER_X || "https://x.com/adaokonkwo",
      substack_url: process.env.DEMO_DEVELOPER_SUBSTACK || null,
      other_links: [{ label: "Site", url: "https://adaokonkwo.dev" }],
    },
  });

  if (options?.resetMissions) {
    await admin.from("payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await admin.from("submissions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await admin.from("claims").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await admin.from("missions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const { data: existing } = await admin
    .from("missions")
    .select("id")
    .eq("company_id", company.id)
    .eq("title", "Ship a public Northstar example")
    .maybeSingle();

  let missionId = existing?.id as string | undefined;
  if (!missionId) {
    const { data, error } = await admin
      .from("missions")
      .insert({
        company_id: company.id,
        title: "Ship a public Northstar example",
        description:
          "Build a compelling real-world example using our product, deploy it, and write a public post explaining what you built and why it matters.",
        reward_amount: 25,
        reward_currency: "USDC",
        requirements:
          "Working demo, public repo, and a LinkedIn post. Keep the writeup concrete: problem, what you built, screenshot or clip.",
        required_deliverables: ["repository", "demo", "linkedin", "description"],
        visibility: "public",
        status: "open",
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    missionId = data.id;
  }

  return {
    companyId: company.id,
    developerId: developer.id,
    missionId,
    companyEmail,
    developerEmail,
  };
}
