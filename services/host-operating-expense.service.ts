import "server-only";

import { OperatingExpenseCategory, OperatingExpenseStatus, Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { normalizeCurrencyCode } from "@/lib/currency";

type ExpenseInput = {
  listingId: string;
  bookingId?: string | null;
  category: OperatingExpenseCategory;
  amountCents: number;
  currency: string;
  expenseDate: Date;
  description?: string | null;
  sourceReference?: string | null;
  idempotencyKey?: string | null;
};

async function assertExpenseScope(actor: AuthUser, listingId: string, bookingId?: string | null) {
  const listing = await prisma.listing.findFirst({ where: { id: listingId, hostId: actor.id, deletedAt: null }, select: { id: true } });
  if (!listing) throw AppError.forbidden("Listing not found or access denied.");
  if (bookingId) {
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, listingId }, select: { id: true } });
    if (!booking) throw AppError.badRequest("The booking does not belong to the selected listing.");
  }
}

function toDto(expense: {
  id: string; listingId: string; bookingId: string | null; category: OperatingExpenseCategory; status: OperatingExpenseStatus;
  amountCents: number; currency: string; expenseDate: Date; description: string | null; sourceReference: string | null;
  voidedAt: Date | null; voidReason: string | null; createdAt: Date; updatedAt: Date;
}) {
  return { ...expense, expenseDate: expense.expenseDate.toISOString(), voidedAt: expense.voidedAt?.toISOString() ?? null, createdAt: expense.createdAt.toISOString(), updatedAt: expense.updatedAt.toISOString() };
}

export const hostOperatingExpenseService = {
  async list(actor: AuthUser, options: { listingId?: string; category?: OperatingExpenseCategory; startDate?: Date; endDate?: Date; take?: number; skip?: number }) {
    const where = {
      hostId: actor.id,
      ...(options.listingId ? { listingId: options.listingId } : {}),
      ...(options.category ? { category: options.category } : {}),
      ...(options.startDate || options.endDate ? { expenseDate: { ...(options.startDate ? { gte: options.startDate } : {}), ...(options.endDate ? { lte: options.endDate } : {}) } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.operatingExpense.findMany({ where, orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }], skip: options.skip ?? 0, take: Math.min(options.take ?? 50, 100) }),
      prisma.operatingExpense.count({ where }),
    ]);
    return { items: items.map(toDto), total };
  },

  async create(actor: AuthUser, input: ExpenseInput) {
    if (actor.role !== Role.HOST && actor.role !== Role.ADMIN) throw AppError.forbidden("Host access is required.");
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw AppError.badRequest("Expense amount must be a positive minor-unit amount.");
    await assertExpenseScope(actor, input.listingId, input.bookingId);
    const currency = normalizeCurrencyCode(input.currency);
    if (input.idempotencyKey) {
      const existing = await prisma.operatingExpense.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        if (existing.hostId !== actor.id) throw AppError.forbidden("Expense request key is not available.");
        return toDto(existing);
      }
    }
    if (input.sourceReference?.trim()) {
      const duplicate = await prisma.operatingExpense.findFirst({
        where: { hostId: actor.id, listingId: input.listingId, sourceReference: input.sourceReference.trim(), status: OperatingExpenseStatus.ACTIVE },
        select: { id: true },
      });
      if (duplicate) throw AppError.conflict("An active expense with this source reference already exists for this property.");
    }
    const expense = await prisma.operatingExpense.create({
      data: { ...input, hostId: actor.id, currency, sourceReference: input.sourceReference?.trim() || null, description: input.description?.trim() || null },
    });
    return toDto(expense);
  },

  async update(actor: AuthUser, id: string, input: Partial<ExpenseInput>) {
    const existing = await prisma.operatingExpense.findFirst({ where: { id, hostId: actor.id } });
    if (!existing) throw AppError.notFound("Operating expense not found.");
    if (existing.status === OperatingExpenseStatus.VOIDED) throw AppError.conflict("A voided expense cannot be edited.");
    const listingId = input.listingId ?? existing.listingId;
    const bookingId = input.bookingId === undefined ? existing.bookingId : input.bookingId;
    await assertExpenseScope(actor, listingId, bookingId);
    if (input.amountCents !== undefined && (!Number.isInteger(input.amountCents) || input.amountCents <= 0)) throw AppError.badRequest("Expense amount must be positive.");
    const expense = await prisma.operatingExpense.update({
      where: { id },
      data: {
        ...(input.listingId !== undefined ? { listingId } : {}), ...(input.bookingId !== undefined ? { bookingId } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}), ...(input.amountCents !== undefined ? { amountCents: input.amountCents } : {}),
        ...(input.currency !== undefined ? { currency: normalizeCurrencyCode(input.currency) } : {}), ...(input.expenseDate !== undefined ? { expenseDate: input.expenseDate } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}), ...(input.sourceReference !== undefined ? { sourceReference: input.sourceReference?.trim() || null } : {}),
      },
    });
    return toDto(expense);
  },

  async void(actor: AuthUser, id: string, reason?: string) {
    const existing = await prisma.operatingExpense.findFirst({ where: { id, hostId: actor.id } });
    if (!existing) throw AppError.notFound("Operating expense not found.");
    if (existing.status === OperatingExpenseStatus.VOIDED) return toDto(existing);
    const expense = await prisma.operatingExpense.update({ where: { id }, data: { status: OperatingExpenseStatus.VOIDED, voidedAt: new Date(), voidReason: reason?.trim() || null } });
    return toDto(expense);
  },
};
