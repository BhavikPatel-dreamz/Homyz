import "server-only";

import { OperatingExpenseCategory, OperationalTaskStatus, Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { normalizeCurrencyCode } from "@/lib/currency";
import { prisma } from "@/lib/db/prisma";
import { accessibleHostListingWhere } from "@/lib/permissions/host-listing-access";

type TaskInput = { listingId: string; bookingId?: string | null; title: string; scheduledFor?: Date | null; notes?: string | null; actualExpenseCents?: number | null; currency?: string; idempotencyKey?: string | null };
type MaintenanceInput = Omit<TaskInput, "bookingId" | "idempotencyKey" | "scheduledFor"> & { serviceDate?: Date | null; nextServiceDate?: Date | null; equipmentReference?: string | null; usageReading?: number | null; usageUnit?: string | null };

async function assertListing(actor: AuthUser, listingId: string) {
  const listing = await prisma.listing.findFirst({ where: accessibleHostListingWhere(actor, { id: listingId }), select: { id: true } });
  if (!listing) throw AppError.forbidden("Listing not found or access denied.");
}
function positiveOrNull(value: number | null | undefined, field: string) { if (value !== undefined && value !== null && (!Number.isInteger(value) || value < 0)) throw AppError.badRequest(`${field} must be a non-negative whole number.`); }

export const hostOperationalRecordsService = {
  async overview(actor: AuthUser, listingId?: string) {
    const listingWhere = accessibleHostListingWhere(actor, listingId ? { id: listingId } : {});
    if (listingId) await assertListing(actor, listingId);
    const listings = await prisma.listing.findMany({ where: listingWhere, select: { id: true, title: true }, orderBy: { title: "asc" } });
    const ids = listings.map((listing) => listing.id);
    const [cleaning, maintenance] = await Promise.all([
      prisma.cleaningTask.findMany({ where: { listingId: { in: ids } }, orderBy: { scheduledFor: "asc" }, take: 50, include: { listing: { select: { title: true } } } }),
      prisma.maintenanceRecord.findMany({ where: { listingId: { in: ids } }, orderBy: { serviceDate: "desc" }, take: 50, include: { listing: { select: { title: true } } } }),
    ]);
    const completed = cleaning.filter((task) => task.status === OperationalTaskStatus.COMPLETED);
    const pending = cleaning.filter((task) => task.status === OperationalTaskStatus.PENDING || task.status === OperationalTaskStatus.SCHEDULED || task.status === OperationalTaskStatus.IN_PROGRESS);
    const now = new Date();
    const delayed = cleaning.filter((task) => task.status !== OperationalTaskStatus.COMPLETED && task.status !== OperationalTaskStatus.CANCELLED && task.scheduledFor && task.scheduledFor < now);
    const completionHours = completed.flatMap((task) => task.scheduledFor && task.completedAt ? [(task.completedAt.getTime() - task.scheduledFor.getTime()) / 3_600_000] : []);
    return {
      listings,
      cleaning: { total: cleaning.length, completed: completed.length, pending: pending.length, delayed: delayed.length, averageCompletionHours: completionHours.length ? Math.round((completionHours.reduce((sum, value) => sum + value, 0) / completionHours.length) * 10) / 10 : null, recordedExpensesCents: completed.reduce((sum, task) => sum + (task.actualExpenseCents ?? 0), 0), tasks: cleaning.map((task) => ({ ...task, scheduledFor: task.scheduledFor?.toISOString() ?? null, completedAt: task.completedAt?.toISOString() ?? null, createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString(), listingTitle: task.listing.title })) },
      maintenance: { equipmentUsageStatus: "DATA_UNAVAILABLE" as const, message: "Equipment runtime is unavailable until a permitted meter or manual usage reading is recorded.", records: maintenance.map((record) => ({ ...record, serviceDate: record.serviceDate?.toISOString() ?? null, completedAt: record.completedAt?.toISOString() ?? null, nextServiceDate: record.nextServiceDate?.toISOString() ?? null, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(), listingTitle: record.listing.title })) },
    };
  },
  async createCleaningTask(actor: AuthUser, input: TaskInput) {
    if (actor.role !== Role.HOST && actor.role !== Role.ADMIN) throw AppError.forbidden("Host access is required.");
    await assertListing(actor, input.listingId); positiveOrNull(input.actualExpenseCents, "Actual expense");
    if (input.bookingId) { const booking = await prisma.booking.findFirst({ where: { id: input.bookingId, listingId: input.listingId }, select: { id: true } }); if (!booking) throw AppError.badRequest("The booking does not belong to this listing."); }
    if (input.idempotencyKey) { const existing = await prisma.cleaningTask.findUnique({ where: { idempotencyKey: input.idempotencyKey } }); if (existing) { if (existing.hostId !== actor.id) throw AppError.forbidden("Task request key is not available."); return existing; } }
    const task = await prisma.cleaningTask.create({ data: { ...input, hostId: actor.id, title: input.title.trim(), notes: input.notes?.trim() || null, currency: normalizeCurrencyCode(input.currency || "SAR"), scheduledFor: input.scheduledFor ?? null, actualExpenseCents: input.actualExpenseCents ?? null } });
    // A cleaning expense supplied with the task becomes one canonical operating
    // expense with a task-derived idempotency key. No second expense is created
    // when the task is later marked complete.
    if (task.actualExpenseCents && task.actualExpenseCents > 0) {
      await prisma.operatingExpense.create({ data: { hostId: actor.id, listingId: task.listingId, bookingId: task.bookingId, category: OperatingExpenseCategory.CLEANING, amountCents: task.actualExpenseCents, currency: task.currency, expenseDate: task.scheduledFor ?? new Date(), sourceReference: `cleaning-task:${task.id}`, idempotencyKey: `cleaning-task-expense:${task.id}`, description: `Cleaning task: ${task.title}` } });
    }
    return task;
  },
  async updateCleaningStatus(actor: AuthUser, id: string, status: OperationalTaskStatus) {
    const task = await prisma.cleaningTask.findFirst({ where: { id }, select: { id: true, listingId: true, completedAt: true } }); if (!task) throw AppError.notFound("Cleaning task not found.");
    await assertListing(actor, task.listingId);
    return prisma.cleaningTask.update({ where: { id }, data: { status, completedAt: status === OperationalTaskStatus.COMPLETED ? new Date() : task.completedAt } });
  },
  async createMaintenanceRecord(actor: AuthUser, input: MaintenanceInput) {
    await assertListing(actor, input.listingId); positiveOrNull(input.actualExpenseCents, "Actual expense"); positiveOrNull(input.usageReading, "Usage reading");
    return prisma.maintenanceRecord.create({ data: { hostId: actor.id, listingId: input.listingId, title: input.title.trim(), notes: input.notes?.trim() || null, serviceDate: input.serviceDate ?? null, nextServiceDate: input.nextServiceDate ?? null, equipmentReference: input.equipmentReference?.trim() || null, usageReading: input.usageReading ?? null, usageUnit: input.usageUnit?.trim() || null, actualExpenseCents: input.actualExpenseCents ?? null, currency: normalizeCurrencyCode(input.currency || "SAR") } });
  },
};
