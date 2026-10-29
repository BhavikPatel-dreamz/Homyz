import { Prisma } from "@/generated/prisma/client";
import { LoyaltyActivityType } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";

export async function recordLoyaltyActivity(input: { userId: string; type: LoyaltyActivityType; eventKey: string; summary: string; sourceType: string; sourceId: string; link?: string | null; metadata?: Prisma.InputJsonValue; occurredAt?: Date }) {
  try {
    return await prisma.loyaltyActivity.upsert({
      where: { userId_eventKey: { userId: input.userId, eventKey: input.eventKey } },
      create: { ...input, link: input.link ?? null, metadata: input.metadata, occurredAt: input.occurredAt ?? new Date() },
      update: {},
    });
  } catch (error: any) {
    if (error?.code === "P2002") return prisma.loyaltyActivity.findUnique({ where: { userId_eventKey: { userId: input.userId, eventKey: input.eventKey } } });
    throw error;
  }
}

export async function listLoyaltyActivity(userId: string, options: { skip?: number; take?: number; type?: LoyaltyActivityType } = {}) {
  if (!userId) throw AppError.unauthorized();
  const skip = Math.max(0, Math.trunc(options.skip ?? 0));
  const take = Math.min(50, Math.max(1, Math.trunc(options.take ?? 20)));
  const where = { userId, ...(options.type ? { type: options.type } : {}) };
  const [items, total] = await Promise.all([
    prisma.loyaltyActivity.findMany({ where, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], skip, take, select: { id: true, type: true, summary: true, sourceType: true, sourceId: true, link: true, occurredAt: true, createdAt: true } }),
    prisma.loyaltyActivity.count({ where }),
  ]);
  return { items, total, skip, take };
}
