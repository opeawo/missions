export const FIRST_LAUNCH_CREDIT_USD = 50;

export const siteLinks = {
  discord: process.env.NEXT_PUBLIC_DISCORD_URL || "https://discord.com",
  x: process.env.NEXT_PUBLIC_X_URL || "https://x.com",
  github: process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com",
} as const;

export const marketingNav = [
  { href: "/missions", label: "Missions" },
  { href: "/for-companies", label: "For Companies" },
  { href: "/how-it-works", label: "How it Works" },
  { href: "/mcp", label: "MCP" },
] as const;
