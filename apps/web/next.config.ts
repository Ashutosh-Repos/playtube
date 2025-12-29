import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/database", "@repo/env", "@repo/events", "@repo/redis"],
};

export default nextConfig;
