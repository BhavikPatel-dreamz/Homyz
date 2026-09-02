import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost:3000",
    "dd-33.dynamicdreamz.net",
    "*.dynamicdreamz.net",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "platform-lookaside.fbsbx.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // ioredis uses Node's `net`/`tls`; opt it out of Server Component bundling so
  // it's loaded via native require (top-level key per Next 16). Route Handlers
  // and RSC run on the nodejs runtime, so this is safe. Redis stays optional —
  // if the package is absent, the cache layer bypasses it at runtime.
  serverExternalPackages: ["ioredis"],
  experimental: {
    // Enables forbidden()/unauthorized() + forbidden.tsx/unauthorized.tsx for
    // role-based 403/401 UI on SSR pages (auth boundary is still enforced in code).
    authInterrupts: true,
    // Server Actions are POST-only; restrict which Origins may invoke them.
    // Extend this list with your production/proxy hosts.
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "dd-33.dynamicdreamz.net",
        "*.dynamicdreamz.net",
      ],
    },
  },
};

export default nextConfig;
