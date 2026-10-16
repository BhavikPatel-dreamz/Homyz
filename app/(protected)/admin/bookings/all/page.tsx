import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { bookingService } from "@/services/booking.service";
import { AdminAllBookingsClient } from "./admin-all-bookings-client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminAllBookingsPage({ searchParams }: PageProps) {
  const actor = await requirePageRole([Role.ADMIN]);
  const resolvedParams = await searchParams;

  const page = Math.max(1, Number(resolvedParams.page) || 1);
  const limit = Math.min(50, Math.max(10, Number(resolvedParams.limit) || 20));
  const tab = typeof resolvedParams.tab === "string" ? resolvedParams.tab : undefined;
  const search = typeof resolvedParams.search === "string" ? resolvedParams.search : undefined;
  const sortBy = typeof resolvedParams.sortBy === "string" ? (resolvedParams.sortBy as any) : undefined;
  const sortOrder = typeof resolvedParams.sortOrder === "string" ? (resolvedParams.sortOrder as any) : undefined;
  const bookingType = typeof resolvedParams.bookingType === "string" ? resolvedParams.bookingType : undefined;
  const paymentStatus = typeof resolvedParams.paymentStatus === "string" ? resolvedParams.paymentStatus : undefined;
  const city = typeof resolvedParams.city === "string" ? resolvedParams.city : undefined;
  const checkInFrom = typeof resolvedParams.checkInFrom === "string" ? resolvedParams.checkInFrom : undefined;
  const checkInTo = typeof resolvedParams.checkInTo === "string" ? resolvedParams.checkInTo : undefined;
  const checkOutFrom = typeof resolvedParams.checkOutFrom === "string" ? resolvedParams.checkOutFrom : undefined;
  const checkOutTo = typeof resolvedParams.checkOutTo === "string" ? resolvedParams.checkOutTo : undefined;
  const createdFrom = typeof resolvedParams.createdFrom === "string" ? resolvedParams.createdFrom : undefined;
  const createdTo = typeof resolvedParams.createdTo === "string" ? resolvedParams.createdTo : undefined;

  const result = await bookingService.listForAdmin(actor, {
    page,
    limit,
    tab,
    search,
    sortBy,
    sortOrder,
    bookingType,
    paymentStatus,
    city,
    checkInFrom,
    checkInTo,
    checkOutFrom,
    checkOutTo,
    createdFrom,
    createdTo,
  });

  return (
    <AdminAllBookingsClient
      initialBookings={result.items}
      initialPagination={{
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      }}
    />
  );
}

