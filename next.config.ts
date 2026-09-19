import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["thirdweb", "openai", "@modelcontextprotocol/sdk"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
