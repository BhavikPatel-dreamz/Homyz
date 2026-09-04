import type { NextConfig } from "next";

function extraOrigins(): string[] {
  const hosts = new Set<string>([
    "localhost:3000",
    "dd-33.dynamicdreamz.net",
    "*.dynamicdreamz.net",
  ]);

  const raw = [
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.SERVER_ACTION_ALLOWED_ORIGINS,
  ]
    .filter(Boolean)
    .join(",");

  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      if (trimmed.includes("://")) {
        hosts.add(new URL(trimmed).host);
      } else {
        hosts.add(trimmed);
      }
    } catch {
      // Ignore malformed build-time origin values.
    }
  }

  return [...hosts];
}

const actionOrigins = extraOrigins();

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: actionOrigins,
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
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
      },
    ],
  },
  // Native / Node-only packages stay out of the RSC bundle.
  serverExternalPackages: ["ioredis", "@aws-sdk/client-s3", "@prisma/adapter-pg"],
  outputFileTracingIncludes: {
    "/*": ["./generated/prisma/**/*"],
  },
  experimental: {
    // Enables forbidden()/unauthorized() + forbidden.tsx/unauthorized.tsx for
    // role-based 403/401 UI on SSR pages (auth boundary is still enforced in code).
    authInterrupts: true,
    // Server Actions are POST-only; restrict which Origins may invoke them.
    // Pass production ALB/CloudFront host via APP_URL or SERVER_ACTION_ALLOWED_ORIGINS at image build.
    serverActions: {
      allowedOrigins: actionOrigins,
    },
  },
};

export default nextConfig;
