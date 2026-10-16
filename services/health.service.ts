import { prisma } from "@/lib/db/prisma";

export async function checkDatabaseReadiness(): Promise<"healthy" | "unavailable"> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "healthy";
  } catch {
    return "unavailable";
  }
}
