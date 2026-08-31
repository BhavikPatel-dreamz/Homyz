import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7's `prisma-client` generator ships no query engine binary — a driver
// adapter is REQUIRED. We connect to PostgreSQL via `@prisma/adapter-pg`, which
// bundles `pg`. The connection URL comes from the environment (Next.js loads
// `.env` automatically; standalone scripts load it via `dotenv/config`).
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and configure it.",
  );
}

const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

// Reuse a single client across hot-reloads in dev to avoid exhausting connections.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function getPrismaClient() {
  if (
    globalForPrisma.prisma &&
    typeof (globalForPrisma.prisma as any).hostPermissionOverride !== "undefined" &&
    typeof (globalForPrisma.prisma as any).adminPermissionOverride !== "undefined" &&
    typeof (globalForPrisma.prisma as any).adminInvitation !== "undefined"
  ) {
    return globalForPrisma.prisma;
  }
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getPrismaClient();
