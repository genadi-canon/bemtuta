import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Task photos and provider documents are uploaded through server actions.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
