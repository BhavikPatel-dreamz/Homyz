import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { recordPublicDiagnostic } from "@/lib/diagnostics/public-diagnostics";

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
function withExplicitSslMode(connectionString: string): string {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");

  if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}

const connectionString = withExplicitSslMode(databaseUrl);

function getPoolSize(): number {
  const configuredSize = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "5", 10);

  return Number.isFinite(configuredSize) && configuredSize > 0
    ? configuredSize
    : 5;
}

function getPrismaErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Z0-9]{4,10}$/i.test(code) ? code : null;
}

const createPrismaClient = () => {
  const client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      // The hosted database has a modest connection limit. This is enough
      // concurrency for the app while leaving room for migrations and tools.
      max: getPoolSize(),
    }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          try {
            return await query(args);
          } catch (error) {
            await recordPublicDiagnostic({
              source: "database",
              message: `Prisma ${model}.${operation} failed.`,
              error,
              metadata: {
                model,
                operation,
                code: getPrismaErrorCode(error),
              },
            });
            throw error;
          }
        },
      },
      async $queryRaw({ operation, args, query }) {
        try {
          return await query(args);
        } catch (error) {
          await recordPublicDiagnostic({
            source: "database",
            message: `Prisma ${operation} failed.`,
            error,
            metadata: { operation, code: getPrismaErrorCode(error) },
          });
          throw error;
        }
      },
      async $executeRaw({ operation, args, query }) {
        try {
          return await query(args);
        } catch (error) {
          await recordPublicDiagnostic({
            source: "database",
            message: `Prisma ${operation} failed.`,
            error,
            metadata: { operation, code: getPrismaErrorCode(error) },
          });
          throw error;
        }
      },
      async $queryRawUnsafe({ operation, args, query }) {
        try {
          return await query(args);
        } catch (error) {
          await recordPublicDiagnostic({
            source: "database",
            message: `Prisma ${operation} failed.`,
            error,
            metadata: { operation, code: getPrismaErrorCode(error) },
          });
          throw error;
        }
      },
      async $executeRawUnsafe({ operation, args, query }) {
        try {
          return await query(args);
        } catch (error) {
          await recordPublicDiagnostic({
            source: "database",
            message: `Prisma ${operation} failed.`,
            error,
            metadata: { operation, code: getPrismaErrorCode(error) },
          });
          throw error;
        }
      },
    },
  });
};

// Keep the exported client typed as the base PrismaClient. The runtime instance
// is wrapped with a diagnostic query extension, but that extension changes the
// transaction-client type enough to break callers annotated with
// Prisma.TransactionClient. Casting back to the base client preserves the
// familiar types while the extension continues to run at runtime.
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

// Reuse one Prisma client and its pool across every Turbopack hot reload.
export const prisma =
  (globalForPrisma.prisma ?? createPrismaClient()) as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
