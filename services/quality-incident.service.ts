import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  QualityIncidentCategory,
  QualityIncidentSeverity,
  QualityIncidentStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

export {
  QualityIncidentCategory,
  QualityIncidentSeverity,
  QualityIncidentStatus,
};

export type CreateQualityIncidentInput = {
  listingId: string;
  bookingId?: string | null;
  reportedById?: string | null;
  category: QualityIncidentCategory;
  status?: QualityIncidentStatus;
  severity?: QualityIncidentSeverity | null;
  description?: string | null;
  resolutionNotes?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

export type UpdateQualityIncidentStatusInput = {
  incidentId: string;
  status: QualityIncidentStatus;
  resolutionNotes?: string | null;
  severity?: QualityIncidentSeverity | null;
  resolvedAt?: Date | null;
};

/**
 * Dispatches an immediate listing-level Guest Favorite re-evaluation.
 * Lazy-imported to prevent circular module dependencies between
 * quality-incident and guest-favorite services.
 */
async function triggerGuestFavoriteReevaluation(listingId: string): Promise<void> {
  try {
    const { evaluateListingGuestFavoriteDaily } = await import(
      "@/services/guest-favorite.service"
    );
    await evaluateListingGuestFavoriteDaily(listingId);
  } catch (error) {
    console.error(
      `[QualityIncident] Immediate Guest Favorite recalculation failed for listing ${listingId}:`,
      error,
    );
  }
}

/**
 * Returns the count of confirmed quality incidents for a single listing.
 * Only CONFIRMED incidents count towards the Guest Favorite reliability failure rate.
 */
export async function getConfirmedQualityIncidentCount(listingId: string): Promise<number> {
  return prisma.listingQualityIncident.count({
    where: {
      listingId,
      status: QualityIncidentStatus.CONFIRMED,
    },
  });
}

/**
 * Batch-loads confirmed quality incident counts for multiple listings in a single
 * grouped aggregate query, preventing N+1 queries during marketplace daily evaluations.
 */
export async function getConfirmedQualityIncidentCounts(
  listingIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const id of listingIds) {
    counts.set(id, 0);
  }
  if (listingIds.length === 0) return counts;

  const rows = await prisma.listingQualityIncident.groupBy({
    by: ["listingId"],
    where: {
      listingId: { in: listingIds },
      status: QualityIncidentStatus.CONFIRMED,
    },
    _count: { id: true },
  });

  for (const row of rows) {
    counts.set(row.listingId, row._count.id);
  }
  return counts;
}

/**
 * Creates an auditable quality incident record.
 * Only CONFIRMED incidents count against Guest Favorite reliability.
 * If created directly as CONFIRMED, triggers immediate listing re-evaluation.
 */
export async function createQualityIncident(input: CreateQualityIncidentInput) {
  if (!input.listingId) {
    throw new Error("listingId is required");
  }

  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    select: { id: true },
  });
  if (!listing) {
    throw new Error(`Listing not found: ${input.listingId}`);
  }

  if (input.bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: { id: true, listingId: true, userId: true },
    });
    if (!booking) {
      throw new Error(`Booking not found: ${input.bookingId}`);
    }
    if (booking.listingId !== input.listingId) {
      throw new Error(`Booking ${input.bookingId} does not belong to listing ${input.listingId}`);
    }
    if (input.reportedById && booking.userId !== input.reportedById) {
      throw new Error(
        `Reported by user ${input.reportedById} does not match booking guest ${booking.userId}`,
      );
    }
  }

  const incidentStatus = input.status ?? QualityIncidentStatus.PENDING;

  const incident = await prisma.listingQualityIncident.create({
    data: {
      listingId: input.listingId,
      bookingId: input.bookingId ?? null,
      reportedById: input.reportedById ?? null,
      category: input.category,
      status: incidentStatus,
      severity: input.severity ?? null,
      description: input.description ?? null,
      resolutionNotes: input.resolutionNotes ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
      resolvedAt:
        incidentStatus === QualityIncidentStatus.RESOLVED ||
        incidentStatus === QualityIncidentStatus.REJECTED
          ? new Date()
          : null,
    },
  });

  // If created as CONFIRMED, immediately trigger listing-level Guest Favorite re-evaluation
  if (incidentStatus === QualityIncidentStatus.CONFIRMED) {
    await triggerGuestFavoriteReevaluation(incident.listingId);
  }

  return incident;
}

/**
 * Updates an incident's status and lifecycle state.
 *
 * Immediate re-evaluation behavior:
 * - When an incident transitions into CONFIRMED, the listing is re-evaluated immediately.
 * - When an incident transitions out of CONFIRMED (e.g. CONFIRMED -> REJECTED), the listing is re-evaluated immediately.
 */
export async function updateQualityIncidentStatus(input: UpdateQualityIncidentStatusInput) {
  const existing = await prisma.listingQualityIncident.findUnique({
    where: { id: input.incidentId },
  });
  if (!existing) {
    throw new Error(`Quality incident not found: ${input.incidentId}`);
  }

  const statusChanged = existing.status !== input.status;
  const isTransitioningToConfirmed =
    statusChanged && input.status === QualityIncidentStatus.CONFIRMED;
  const isTransitioningFromConfirmed =
    statusChanged && existing.status === QualityIncidentStatus.CONFIRMED;

  const resolvedAt =
    input.resolvedAt !== undefined
      ? input.resolvedAt
      : input.status === QualityIncidentStatus.RESOLVED ||
        input.status === QualityIncidentStatus.REJECTED
      ? existing.resolvedAt ?? new Date()
      : null;

  const updated = await prisma.listingQualityIncident.update({
    where: { id: input.incidentId },
    data: {
      status: input.status,
      resolutionNotes: input.resolutionNotes !== undefined ? input.resolutionNotes : existing.resolutionNotes,
      severity: input.severity !== undefined ? input.severity : existing.severity,
      resolvedAt,
    },
  });

  // Trigger immediate Guest Favorite re-evaluation whenever confirmed status changes
  if (isTransitioningToConfirmed || isTransitioningFromConfirmed) {
    await triggerGuestFavoriteReevaluation(existing.listingId);
  }

  return updated;
}

/**
 * Retrieves quality incidents for a listing (auditable log).
 */
export async function getListingQualityIncidents(listingId: string) {
  return prisma.listingQualityIncident.findMany({
    where: { listingId },
    orderBy: { createdAt: "desc" },
  });
}

