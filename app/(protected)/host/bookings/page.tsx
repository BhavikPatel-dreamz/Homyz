import { Role } from "@/generated/prisma/enums";
import { Footer } from "@/components/dashboard/footer";
import { HostBookingApprovals } from "@/components/host/host-booking-approvals";
import { HostHeader } from "@/components/host/host-header";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { bookingService } from "@/services/booking.service";

export default async function HostBookingApprovalsPage() {
  const actor = await requirePageRole([Role.HOST]);
  const bookings = await bookingService.listPendingForHost(actor);
  return <div className="flex min-h-screen flex-col bg-white text-zinc-900"><HostHeader /><main className="flex-1 px-4 sm:px-6"><HostBookingApprovals bookings={bookings.map((booking) => ({ ...booking, startDate: booking.startDate.toISOString(), endDate: booking.endDate.toISOString(), createdAt: booking.createdAt.toISOString() }))} /></main><Footer /></div>;
}
