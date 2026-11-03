import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7's `prisma-client` generator has no query engine binary, so a
// driver adapter is required. Keep this module deliberately simple: the
// instance below is shared through `globalThis` in development. Trying to
// validate the generated client via its private DMMF internals caused a fresh
// client (and therefore a new PostgreSQL pool) on every hot reload.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and configure it.",
  );
}

/**
 * pg-connection-string v2 treats these legacy modes as verify-full, but warns
 * because its next major release will adopt libpq's weaker semantics. Preserve
 * the current secure behaviour explicitly without requiring every deployment
 * to update its existing DATABASE_URL immediately.
 */
function useExplicitSslMode(connectionString: string): string {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");

  if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}

const connectionString = useExplicitSslMode(databaseUrl);

function getPoolSize(): number {
  const configuredSize = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "5", 10);

  return Number.isFinite(configuredSize) && configuredSize > 0
    ? configuredSize
    : 5;
}

const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      // The hosted database has a modest connection limit. This is enough
      // concurrency for the app while leaving room for migrations and tools.
      max: getPoolSize(),
    }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

// Reuse one Prisma client and its pool across every Turbopack hot reload.
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
