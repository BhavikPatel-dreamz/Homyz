import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden()/unauthorized() + forbidden.tsx/unauthorized.tsx for
    // role-based 403/401 UI on SSR pages (auth boundary is still enforced in code).
    authInterrupts: true,
    // Server Actions are POST-only; restrict which Origins may invoke them.
    // Extend this list with your production/proxy hosts.
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
