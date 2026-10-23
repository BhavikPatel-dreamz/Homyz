import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7's `prisma-client` generator ships no query engine binary — a driver
// adapter is REQUIRED. We connect to PostgreSQL via `@prisma/adapter-pg`, which
// bundles `pg`. The connection URL comes from the environment (Next.js loads
// `.env` automatically; standalone scripts load it via `dotenv/config`). Freshly regenerated.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and configure it.",
  );
}

type PrismaRuntimeClient = PrismaClient & {
  _baseDmmf?: { modelMap?: Record<string, { fields?: Array<{ name: string }> }> };
  _dmmf?: { modelMap?: Record<string, { fields?: Array<{ name: string }> }> };
};

const createPrismaClient = (): PrismaClient => {
  if (process.env.NODE_ENV !== "production" && typeof require !== "undefined") {
    try {
      Object.keys(require.cache).forEach((key) => {
        if (key.includes("generated/prisma") || key.includes("generated\\prisma")) {
          delete require.cache[key];
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberately reload generated client in development
      const FreshClient = (require("@/generated/prisma/client") as {
        PrismaClient: typeof PrismaClient;
      }).PrismaClient;
      return new FreshClient({
        adapter: new PrismaPg({ connectionString }),
        log: ["error", "warn"],
      });
    } catch {
      // Fallback to static import if require fail
    }
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
};

// Reuse a single client across hot-reloads in dev to avoid exhausting connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getPrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma as PrismaRuntimeClient | undefined;
  const dmmfModels = existing?._baseDmmf?.modelMap ?? existing?._dmmf?.modelMap ?? {};
  const listingFields = dmmfModels.Listing?.fields ?? [];
  const hasHostingTypeField = listingFields.some((field) => field.name === "hostingType");
  const hasStatusField = listingFields.some((field) => field.name === "status");
  const hasIsFeaturedField = listingFields.some((field) => field.name === "isFeatured");

  if (
    existing &&
    hasHostingTypeField &&
    hasStatusField &&
    hasIsFeaturedField &&
    typeof existing.hostRegistrationRequest !== "undefined" &&
    typeof existing.hostPermissionOverride !== "undefined" &&
    typeof existing.adminPermissionOverride !== "undefined" &&
    typeof existing.adminInvitation !== "undefined" &&
    typeof existing.listingCoHost !== "undefined" &&
    typeof existing.appSettings !== "undefined" &&
    typeof existing.backgroundJob !== "undefined" &&
    typeof existing.listing !== "undefined"
  ) {
    return existing;
  }

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getPrismaClient();
