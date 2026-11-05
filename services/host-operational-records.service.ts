import "server-only";

import { OperatingExpenseCategory, OperatingExpenseStatus, OperationalTaskStatus, Role, BookingStatus } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { normalizeCurrencyCode } from "@/lib/currency";
import { prisma } from "@/lib/db/prisma";
import { accessibleHostListingWhere } from "@/lib/permissions/host-listing-access";

export type TaskInput = {
  listingId: string;
  bookingId?: string | null;
  title: string;
  status?: OperationalTaskStatus;
  scheduledFor?: Date | null;
  notes?: string | null;
  actualExpenseCents?: number | null;
  currency?: string;
  idempotencyKey?: string | null;
};

export type TaskUpdateInput = {
  title?: string;
  status?: OperationalTaskStatus;
  scheduledFor?: Date | null;
  actualExpenseCents?: number | null;
  notes?: string | null;
};

export type MaintenanceInput = {
  listingId: string;
  title: string;
  status?: OperationalTaskStatus;
  serviceDate?: Date | null;
  nextServiceDate?: Date | null;
  equipmentReference?: string | null;
  usageReading?: number | null;
  usageUnit?: string | null;
  actualExpenseCents?: number | null;
  currency?: string;
  notes?: string | null;
};

export type MaintenanceUpdateInput = {
  title?: string;
  status?: OperationalTaskStatus;
  serviceDate?: Date | null;
  nextServiceDate?: Date | null;
  equipmentReference?: string | null;
  usageReading?: number | null;
  usageUnit?: string | null;
  actualExpenseCents?: number | null;
  notes?: string | null;
};

async function assertListing(actor: AuthUser, listingId: string) {
  const listing = await prisma.listing.findFirst({
    where: accessibleHostListingWhere(actor, { id: listingId }),
    select: { id: true, title: true, hostId: true },
  });
  if (!listing) throw AppError.forbidden("Listing not found or access denied.");
  return listing;
}

function positiveOrNull(value: number | null | undefined, field: string) {
  if (value !== undefined && value !== null && (!Number.isInteger(value) || value < 0)) {
    throw AppError.badRequest(`${field} must be a non-negative whole number in minor units.`);
  }
}

export const hostOperationalRecordsService = {
  async overview(actor: AuthUser, options: { listingId?: string; currency?: string } = {}) {
    const listingId = options.listingId;
    const selectedCurrency = normalizeCurrencyCode(options.currency || "SAR");
    const listingWhere = accessibleHostListingWhere(actor, listingId ? { id: listingId } : {});
    if (listingId) await assertListing(actor, listingId);

    const listings = await prisma.listing.findMany({
      where: listingWhere,
      select: { id: true, title: true, city: true, country: true },
      orderBy: { title: "asc" },
    });
    const ids = listings.map((listing) => listing.id);

    const [cleaning, maintenance, checkouts] = ids.length ? await Promise.all([
      prisma.cleaningTask.findMany({
        where: { listingId: { in: ids } },
        orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
        include: {
          listing: { select: { title: true } },
          booking: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              user: { select: { name: true } },
            },
          },
        },
      }),
      prisma.maintenanceRecord.findMany({
        where: { listingId: { in: ids } },
        orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }],
        include: { listing: { select: { title: true } } },
      }),
      prisma.booking.findMany({
        where: {
          listingId: { in: ids },
          status: BookingStatus.CONFIRMED,
          endDate: {
            gte: new Date(Date.now() - 30 * 86_400_000),
            lte: new Date(Date.now() + 30 * 86_400_000),
          },
        },
        select: {
          id: true,
          listingId: true,
          startDate: true,
          endDate: true,
          user: { select: { name: true } },
          listing: { select: { title: true } },
        },
        orderBy: { endDate: "desc" },
        take: 20,
      }),
    ]) : [[], [], []];

    const now = new Date();

    // Cleaning breakdown
    const cleaningCompleted = cleaning.filter((task) => task.status === OperationalTaskStatus.COMPLETED);
    const cleaningPending = cleaning.filter(
      (task) => task.status === OperationalTaskStatus.PENDING || task.status === OperationalTaskStatus.SCHEDULED,
    );
    const cleaningInProgress = cleaning.filter((task) => task.status === OperationalTaskStatus.IN_PROGRESS);
    const cleaningDelayed = cleaning.filter(
      (task) =>
        task.status !== OperationalTaskStatus.COMPLETED &&
        task.status !== OperationalTaskStatus.CANCELLED &&
        task.scheduledFor &&
        task.scheduledFor < now,
    );
    const completionHours = cleaningCompleted.flatMap((task) =>
      task.scheduledFor && task.completedAt
        ? [(task.completedAt.getTime() - task.scheduledFor.getTime()) / 3_600_000]
        : [],
    );
    const recordedCleaningExpensesCents = cleaningCompleted.reduce(
      (sum, task) => sum + (task.actualExpenseCents ?? 0),
      0,
    );

    // Maintenance breakdown
    const maintenanceCompleted = maintenance.filter((rec) => rec.status === OperationalTaskStatus.COMPLETED);
    const maintenancePending = maintenance.filter(
      (rec) => rec.status === OperationalTaskStatus.PENDING || rec.status === OperationalTaskStatus.SCHEDULED,
    );
    const maintenanceInProgress = maintenance.filter((rec) => rec.status === OperationalTaskStatus.IN_PROGRESS);
    const maintenanceDelayed = maintenance.filter(
      (rec) =>
        rec.status !== OperationalTaskStatus.COMPLETED &&
        rec.status !== OperationalTaskStatus.CANCELLED &&
        ((rec.serviceDate && rec.serviceDate < now) || (rec.nextServiceDate && rec.nextServiceDate < now)),
    );
    const recordedMaintenanceExpensesCents = maintenance.reduce(
      (sum, rec) => sum + (rec.actualExpenseCents ?? 0),
      0,
    );

    const hasReadings = maintenance.some((rec) => rec.usageReading !== null && rec.usageReading !== undefined);
    const equipmentUsageStatus = hasReadings ? ("AVAILABLE" as const) : ("DATA_UNAVAILABLE" as const);
    const equipmentMessage = hasReadings
      ? "Equipment readings are logged from manual meter and runtime records."
      : "Equipment runtime is unavailable until a permitted meter or manual usage reading is recorded.";

    const totalOperationsExpenseCents = recordedCleaningExpensesCents + recordedMaintenanceExpensesCents;

    return {
      listings,
      selectedListingId: listingId || null,
      currency: selectedCurrency,
      financialSummary: {
        recordedCleaningExpensesCents,
        recordedMaintenanceExpensesCents,
        totalOperationsExpenseCents,
        currency: selectedCurrency,
      },
      cleaning: {
        total: cleaning.length,
        completed: cleaningCompleted.length,
        pending: cleaningPending.length,
        inProgress: cleaningInProgress.length,
        delayed: cleaningDelayed.length,
        averageCompletionHours: completionHours.length
          ? Math.round((completionHours.reduce((sum, value) => sum + value, 0) / completionHours.length) * 10) / 10
          : null,
        recordedExpensesCents: recordedCleaningExpensesCents,
        tasks: cleaning.map((task) => ({
          id: task.id,
          listingId: task.listingId,
          listingTitle: task.listing.title,
          bookingId: task.bookingId,
          status: task.status,
          title: task.title,
          scheduledFor: task.scheduledFor?.toISOString() ?? null,
          completedAt: task.completedAt?.toISOString() ?? null,
          actualExpenseCents: task.actualExpenseCents,
          currency: task.currency,
          notes: task.notes,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
          guestName: task.booking?.user?.name || null,
          bookingDates: task.booking
            ? `${task.booking.startDate.toISOString().slice(0, 10)} to ${task.booking.endDate.toISOString().slice(0, 10)}`
            : null,
        })),
      },
      maintenance: {
        total: maintenance.length,
        completed: maintenanceCompleted.length,
        pending: maintenancePending.length,
        inProgress: maintenanceInProgress.length,
        delayed: maintenanceDelayed.length,
        recordedExpensesCents: recordedMaintenanceExpensesCents,
        equipmentUsageStatus,
        message: equipmentMessage,
        records: maintenance.map((record) => ({
          id: record.id,
          listingId: record.listingId,
          listingTitle: record.listing.title,
          status: record.status,
          title: record.title,
          equipmentReference: record.equipmentReference,
          serviceDate: record.serviceDate?.toISOString() ?? null,
          completedAt: record.completedAt?.toISOString() ?? null,
          nextServiceDate: record.nextServiceDate?.toISOString() ?? null,
          usageReading: record.usageReading,
          usageUnit: record.usageUnit,
          actualExpenseCents: record.actualExpenseCents,
          currency: record.currency,
          notes: record.notes,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
        })),
      },
      recentCheckouts: checkouts.map((b) => ({
        bookingId: b.id,
        listingId: b.listingId,
        listingTitle: b.listing.title,
        guestName: b.user?.name || "Guest",
        checkoutDate: b.endDate.toISOString().slice(0, 10),
      })),
    };
  },

  async createCleaningTask(actor: AuthUser, input: TaskInput) {
    if (actor.role !== Role.HOST && actor.role !== Role.ADMIN) throw AppError.forbidden("Host access is required.");
    await assertListing(actor, input.listingId);
    positiveOrNull(input.actualExpenseCents, "Actual expense");

    if (input.bookingId) {
      const booking = await prisma.booking.findFirst({
        where: { id: input.bookingId, listingId: input.listingId },
        select: { id: true },
      });
      if (!booking) throw AppError.badRequest("The booking does not belong to this listing.");
    }

    if (input.idempotencyKey) {
      const existing = await prisma.cleaningTask.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        if (existing.hostId !== actor.id) throw AppError.forbidden("Task request key is not available.");
        return existing;
      }
    }

    const currency = normalizeCurrencyCode(input.currency || "SAR");
    const status = input.status || (input.scheduledFor ? OperationalTaskStatus.SCHEDULED : OperationalTaskStatus.PENDING);
    const completedAt = status === OperationalTaskStatus.COMPLETED ? new Date() : null;

    const task = await prisma.cleaningTask.create({
      data: {
        hostId: actor.id,
        listingId: input.listingId,
        bookingId: input.bookingId || null,
        title: input.title.trim(),
        status,
        scheduledFor: input.scheduledFor ?? null,
        completedAt,
        notes: input.notes?.trim() || null,
        actualExpenseCents: input.actualExpenseCents ?? null,
        currency,
        idempotencyKey: input.idempotencyKey || null,
      },
    });

    // Create canonical OperatingExpense if expense is recorded
    if (task.actualExpenseCents && task.actualExpenseCents > 0) {
      await prisma.operatingExpense.create({
        data: {
          hostId: actor.id,
          listingId: task.listingId,
          bookingId: task.bookingId,
          category: OperatingExpenseCategory.CLEANING,
          amountCents: task.actualExpenseCents,
          currency: task.currency,
          expenseDate: task.scheduledFor ?? new Date(),
          sourceReference: `cleaning-task:${task.id}`,
          idempotencyKey: `cleaning-task-expense:${task.id}`,
          description: `Cleaning task: ${task.title}`,
        },
      });
    }

    return task;
  },

  async updateCleaningTask(actor: AuthUser, id: string, input: TaskUpdateInput) {
    const task = await prisma.cleaningTask.findFirst({
      where: { id },
      select: {
        id: true,
        hostId: true,
        listingId: true,
        bookingId: true,
        title: true,
        status: true,
        scheduledFor: true,
        completedAt: true,
        actualExpenseCents: true,
        currency: true,
      },
    });
    if (!task) throw AppError.notFound("Cleaning task not found.");
    await assertListing(actor, task.listingId);
    positiveOrNull(input.actualExpenseCents, "Actual expense");

    const newStatus = input.status ?? task.status;
    const completedAt =
      newStatus === OperationalTaskStatus.COMPLETED
        ? task.completedAt || new Date()
        : newStatus === OperationalTaskStatus.PENDING || newStatus === OperationalTaskStatus.SCHEDULED || newStatus === OperationalTaskStatus.IN_PROGRESS
          ? null
          : task.completedAt;

    const actualExpenseCents =
      input.actualExpenseCents !== undefined ? input.actualExpenseCents : task.actualExpenseCents;

    const updatedTask = await prisma.cleaningTask.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        status: newStatus,
        completedAt,
        ...(input.scheduledFor !== undefined ? { scheduledFor: input.scheduledFor } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        actualExpenseCents,
      },
    });

    // Synchronize OperatingExpense
    const sourceRef = `cleaning-task:${id}`;
    const existingExpense = await prisma.operatingExpense.findFirst({
      where: { hostId: actor.id, sourceReference: sourceRef },
    });

    if (newStatus === OperationalTaskStatus.CANCELLED) {
      if (existingExpense && existingExpense.status === OperatingExpenseStatus.ACTIVE) {
        await prisma.operatingExpense.update({
          where: { id: existingExpense.id },
          data: {
            status: OperatingExpenseStatus.VOIDED,
            voidedAt: new Date(),
            voidReason: "Cleaning task cancelled",
          },
        });
      }
    } else if (actualExpenseCents && actualExpenseCents > 0) {
      if (existingExpense) {
        await prisma.operatingExpense.update({
          where: { id: existingExpense.id },
          data: {
            amountCents: actualExpenseCents,
            expenseDate: updatedTask.completedAt ?? updatedTask.scheduledFor ?? new Date(),
            description: `Cleaning task: ${updatedTask.title}`,
            status: OperatingExpenseStatus.ACTIVE,
            voidedAt: null,
            voidReason: null,
          },
        });
      } else {
        await prisma.operatingExpense.create({
          data: {
            hostId: actor.id,
            listingId: task.listingId,
            bookingId: task.bookingId,
            category: OperatingExpenseCategory.CLEANING,
            amountCents: actualExpenseCents,
            currency: task.currency,
            expenseDate: updatedTask.completedAt ?? updatedTask.scheduledFor ?? new Date(),
            sourceReference: sourceRef,
            idempotencyKey: `cleaning-task-expense:${id}`,
            description: `Cleaning task: ${updatedTask.title}`,
          },
        });
      }
    } else if (actualExpenseCents === 0 || actualExpenseCents === null) {
      if (existingExpense && existingExpense.status === OperatingExpenseStatus.ACTIVE) {
        await prisma.operatingExpense.update({
          where: { id: existingExpense.id },
          data: {
            status: OperatingExpenseStatus.VOIDED,
            voidedAt: new Date(),
            voidReason: "Cleaning cost removed",
          },
        });
      }
    }

    return updatedTask;
  },

  async deleteCleaningTask(actor: AuthUser, id: string) {
    const task = await prisma.cleaningTask.findFirst({
      where: { id },
      select: { id: true, listingId: true },
    });
    if (!task) throw AppError.notFound("Cleaning task not found.");
    await assertListing(actor, task.listingId);

    // Void associated operating expense if present
    const sourceRef = `cleaning-task:${id}`;
    const existingExpense = await prisma.operatingExpense.findFirst({
      where: { hostId: actor.id, sourceReference: sourceRef },
    });
    if (existingExpense && existingExpense.status === OperatingExpenseStatus.ACTIVE) {
      await prisma.operatingExpense.update({
        where: { id: existingExpense.id },
        data: {
          status: OperatingExpenseStatus.VOIDED,
          voidedAt: new Date(),
          voidReason: "Cleaning task deleted",
        },
      });
    }

    return prisma.cleaningTask.delete({ where: { id } });
  },

  async createMaintenanceRecord(actor: AuthUser, input: MaintenanceInput) {
    if (actor.role !== Role.HOST && actor.role !== Role.ADMIN) throw AppError.forbidden("Host access is required.");
    await assertListing(actor, input.listingId);
    positiveOrNull(input.actualExpenseCents, "Actual expense");
    positiveOrNull(input.usageReading, "Usage reading");

    const currency = normalizeCurrencyCode(input.currency || "SAR");
    const status = input.status || (input.serviceDate ? OperationalTaskStatus.SCHEDULED : OperationalTaskStatus.PENDING);
    const completedAt = status === OperationalTaskStatus.COMPLETED ? new Date() : null;

    const record = await prisma.maintenanceRecord.create({
      data: {
        hostId: actor.id,
        listingId: input.listingId,
        title: input.title.trim(),
        status,
        serviceDate: input.serviceDate ?? null,
        completedAt,
        nextServiceDate: input.nextServiceDate ?? null,
        equipmentReference: input.equipmentReference?.trim() || null,
        usageReading: input.usageReading ?? null,
        usageUnit: input.usageUnit?.trim() || null,
        actualExpenseCents: input.actualExpenseCents ?? null,
        currency,
        notes: input.notes?.trim() || null,
      },
    });

    // Create canonical OperatingExpense if expense is recorded
    if (record.actualExpenseCents && record.actualExpenseCents > 0) {
      await prisma.operatingExpense.create({
        data: {
          hostId: actor.id,
          listingId: record.listingId,
          category: OperatingExpenseCategory.MAINTENANCE,
          amountCents: record.actualExpenseCents,
          currency: record.currency,
          expenseDate: record.serviceDate ?? new Date(),
          sourceReference: `maintenance-record:${record.id}`,
          idempotencyKey: `maintenance-record-expense:${record.id}`,
          description: `Maintenance: ${record.title}`,
        },
      });
    }

    return record;
  },

  async updateMaintenanceRecord(actor: AuthUser, id: string, input: MaintenanceUpdateInput) {
    const record = await prisma.maintenanceRecord.findFirst({
      where: { id },
      select: {
        id: true,
        hostId: true,
        listingId: true,
        title: true,
        status: true,
        serviceDate: true,
        completedAt: true,
        actualExpenseCents: true,
        currency: true,
      },
    });
    if (!record) throw AppError.notFound("Maintenance record not found.");
    await assertListing(actor, record.listingId);
    positiveOrNull(input.actualExpenseCents, "Actual expense");
    positiveOrNull(input.usageReading, "Usage reading");

    const newStatus = input.status ?? record.status;
    const completedAt =
      newStatus === OperationalTaskStatus.COMPLETED
        ? record.completedAt || new Date()
        : newStatus === OperationalTaskStatus.PENDING || newStatus === OperationalTaskStatus.SCHEDULED || newStatus === OperationalTaskStatus.IN_PROGRESS
          ? null
          : record.completedAt;

    const actualExpenseCents =
      input.actualExpenseCents !== undefined ? input.actualExpenseCents : record.actualExpenseCents;

    const updatedRecord = await prisma.maintenanceRecord.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        status: newStatus,
        completedAt,
        ...(input.serviceDate !== undefined ? { serviceDate: input.serviceDate } : {}),
        ...(input.nextServiceDate !== undefined ? { nextServiceDate: input.nextServiceDate } : {}),
        ...(input.equipmentReference !== undefined ? { equipmentReference: input.equipmentReference?.trim() || null } : {}),
        ...(input.usageReading !== undefined ? { usageReading: input.usageReading } : {}),
        ...(input.usageUnit !== undefined ? { usageUnit: input.usageUnit?.trim() || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        actualExpenseCents,
      },
    });

    // Synchronize OperatingExpense
    const sourceRef = `maintenance-record:${id}`;
    const existingExpense = await prisma.operatingExpense.findFirst({
      where: { hostId: actor.id, sourceReference: sourceRef },
    });

    if (newStatus === OperationalTaskStatus.CANCELLED) {
      if (existingExpense && existingExpense.status === OperatingExpenseStatus.ACTIVE) {
        await prisma.operatingExpense.update({
          where: { id: existingExpense.id },
          data: {
            status: OperatingExpenseStatus.VOIDED,
            voidedAt: new Date(),
            voidReason: "Maintenance record cancelled",
          },
        });
      }
    } else if (actualExpenseCents && actualExpenseCents > 0) {
      if (existingExpense) {
        await prisma.operatingExpense.update({
          where: { id: existingExpense.id },
          data: {
            amountCents: actualExpenseCents,
            expenseDate: updatedRecord.serviceDate ?? updatedRecord.completedAt ?? new Date(),
            description: `Maintenance: ${updatedRecord.title}`,
            status: OperatingExpenseStatus.ACTIVE,
            voidedAt: null,
            voidReason: null,
          },
        });
      } else {
        await prisma.operatingExpense.create({
          data: {
            hostId: actor.id,
            listingId: record.listingId,
            category: OperatingExpenseCategory.MAINTENANCE,
            amountCents: actualExpenseCents,
            currency: record.currency,
            expenseDate: updatedRecord.serviceDate ?? updatedRecord.completedAt ?? new Date(),
            sourceReference: sourceRef,
            idempotencyKey: `maintenance-record-expense:${id}`,
            description: `Maintenance: ${updatedRecord.title}`,
          },
        });
      }
    } else if (actualExpenseCents === 0 || actualExpenseCents === null) {
      if (existingExpense && existingExpense.status === OperatingExpenseStatus.ACTIVE) {
        await prisma.operatingExpense.update({
          where: { id: existingExpense.id },
          data: {
            status: OperatingExpenseStatus.VOIDED,
            voidedAt: new Date(),
            voidReason: "Maintenance cost removed",
          },
        });
      }
    }

    return updatedRecord;
  },

  async deleteMaintenanceRecord(actor: AuthUser, id: string) {
    const record = await prisma.maintenanceRecord.findFirst({
      where: { id },
      select: { id: true, listingId: true },
    });
    if (!record) throw AppError.notFound("Maintenance record not found.");
    await assertListing(actor, record.listingId);

    // Void associated operating expense if present
    const sourceRef = `maintenance-record:${id}`;
    const existingExpense = await prisma.operatingExpense.findFirst({
      where: { hostId: actor.id, sourceReference: sourceRef },
    });
    if (existingExpense && existingExpense.status === OperatingExpenseStatus.ACTIVE) {
      await prisma.operatingExpense.update({
        where: { id: existingExpense.id },
        data: {
          status: OperatingExpenseStatus.VOIDED,
          voidedAt: new Date(),
          voidReason: "Maintenance record deleted",
        },
      });
    }

    return prisma.maintenanceRecord.delete({ where: { id } });
  },
};
