import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["thirdweb", "openai"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
