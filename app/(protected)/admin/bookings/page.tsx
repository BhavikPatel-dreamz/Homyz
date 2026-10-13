import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { bookingService } from "@/services/booking.service";
import { AdminBookingDashboardClient } from "./admin-booking-dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminBookingsDashboardPage() {
  const actor = await requirePageRole([Role.ADMIN]);

  const [summary, pendingRequests, recentBookings, recentActivity] = await Promise.all([
    bookingService.getAdminBookingSummary(actor, { period: "all" }),
    bookingService.getAdminPendingRequests(actor, 5),
    bookingService.getAdminRecentBookings(actor, 8),
    bookingService.getAdminRecentActivity(actor, 8),
  ]);

  return (
    <AdminBookingDashboardClient
      initialSummary={summary}
      initialPendingRequests={pendingRequests}
      initialRecentBookings={recentBookings}
      initialRecentActivity={recentActivity}
    />
  );
}
