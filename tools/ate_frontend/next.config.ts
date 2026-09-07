import type { NextConfig } from "next";

/**
 * On Vercel, set API_PROXY_TARGET + NEXT_PUBLIC_API_BASE_URL=/api so the
 * browser talks same-origin (avoids CORS / "Failed to fetch" to Render).
 *
 * Portable/desktop builds must NEVER rewrite /api/* to the integration server
 * on :8810 — dashboard APIs are mocked in src/app/api/[...path]/route.ts.
 */
const apiProxyTarget = (process.env.API_PROXY_TARGET || "").replace(/\/$/, "");
const portableDefault =
  process.env.NEXT_PUBLIC_OFFLINE_DESKTOP ??
  process.env.OFFLINE_DESKTOP ??
  (process.env.VERCEL || apiProxyTarget.includes("onrender.com") ? "0" : "1");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  env: {
    NEXT_PUBLIC_OFFLINE_DESKTOP: portableDefault,
    OFFLINE_DESKTOP: portableDefault,
    API_PROXY_TARGET: apiProxyTarget || "http://127.0.0.1:8810",
  },
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
  async rewrites() {
    if (portableDefault === "1" || process.env.OFFLINE_DESKTOP === "1") return [];
    if (!apiProxyTarget || apiProxyTarget.endsWith(":8810")) return [];
    if (!apiProxyTarget.includes("onrender.com")) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
