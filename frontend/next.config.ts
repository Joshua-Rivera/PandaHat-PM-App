import type { NextConfig } from "next";

// Proxy /api/* to FastAPI so the browser talks to one origin (no CORS, and the
// backend URL never needs to be baked into client code).
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
