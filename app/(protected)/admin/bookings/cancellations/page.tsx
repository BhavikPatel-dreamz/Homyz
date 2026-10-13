import React from "react";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { bookingService } from "@/services/booking.service";
import { AdminCancellationsClient } from "./admin-cancellations-client";

export const dynamic = "force-dynamic";

export default async function AdminBookingsCancellationsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    tab?: string;
    search?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const actor = await requirePageRole([Role.ADMIN]);
  const sp = searchParams ? await searchParams : undefined;

  const page = sp?.page ? parseInt(sp.page, 10) : 1;
  const limit = sp?.limit ? parseInt(sp.limit, 10) : 20;
  const tab = sp?.tab || "all";
  const search = sp?.search || undefined;
  const sortBy = sp?.sortBy as any;
  const sortOrder = sp?.sortOrder as any;

  const [summary, cancellationsData] = await Promise.all([
    bookingService.getCancellationSummaryForAdmin(actor),
    bookingService.listCancellationsForAdmin(actor, {
      page,
      limit,
      tab,
      search,
      sortBy,
      sortOrder,
    }),
  ]);

  return (
    <AdminCancellationsClient
      initialSummary={summary}
      initialCancellations={cancellationsData.cancellations}
      initialPagination={cancellationsData.pagination}
      initialTab={tab}
      initialSearch={search}
    />
  );
}

