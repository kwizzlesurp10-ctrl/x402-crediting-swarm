import type { NextConfig } from "next";
import path from "node:path";

const isContainer = Boolean(process.env.RENDER || process.env.RAILWAY_STATIC_URL || process.env.DOCKER);

const nextConfig: NextConfig = {
  ...(isContainer ? { output: "standalone" } : {}),
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    const cors = [
      { key: "Access-Control-Allow-Origin", value: "*" },
      {
        key: "Access-Control-Expose-Headers",
        value: "PAYMENT-REQUIRED, PAYMENT-RESPONSE, WWW-Authenticate",
      },
    ];
    return [
      { source: "/api/swarm", headers: cors },
      { source: "/openapi.json", headers: cors },
      { source: "/llms.txt", headers: cors },
      { source: "/.well-known/:path*", headers: cors },
      { source: "/mcp", headers: cors },
      { source: "/a2a", headers: cors },
    ];
  },
  async rewrites() {
    return [
      { source: "/mcp", destination: "/.well-known/mcp.json" },
      { source: "/.well-known/mcp", destination: "/.well-known/mcp.json" },
    ];
  },
};

export default nextConfig;
