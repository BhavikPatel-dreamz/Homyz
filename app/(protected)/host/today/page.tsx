import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Footer } from "@/components/dashboard/footer";
import { HostTodayWorkspace } from "@/components/host/host-today-workspace";
import { bookingDateKey } from "@/lib/booking/booking-date";
import type { ReservationPeriod } from "@/lib/booking/host-reservation-events";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostTodayPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; page?: string; listing?: string }>;
} = {}) {
  await requirePageRole([Role.HOST, Role.ADMIN]);
  const resolvedParams = searchParams ? await searchParams : {};
  const requestedTab = resolvedParams?.tab;
  const initialTab: ReservationPeriod =
    requestedTab === "upcoming" ||
    requestedTab === "staying" ||
    requestedTab === "completed" ||
    requestedTab === "pending" ||
    requestedTab === "cancelled" ||
    requestedTab === "all"
      ? requestedTab
      : "today";
  const initialPage = Number(resolvedParams?.page) || 1;

  const renderedAt = new Date();
  const today = bookingDateKey(renderedAt);
  const initialCurrentTimeMinutes = renderedAt.getHours() * 60 + renderedAt.getMinutes();

  return (
    <div className="flex min-h-screen flex-col bg-white pb-0 font-sans text-[#1F1F1F] selection:bg-[#FCDF9C] sm:pb-0">
      <HostHeader />
      <HostTodayWorkspace
        // The workspace fetches its first view from /api/v1/host/workspace on
        // mount. Keeping this page free of the database workspace query lets
        // the client mount and recover from API failures instead of remaining
        // indefinitely in Next's route-level loading fallback.
        listings={[]}
        bookings={[]}
        initialTab={initialTab}
        initialPage={initialPage}
        today={today}
        initialCurrentTimeMinutes={initialCurrentTimeMinutes}
      />
      <Footer />
    </div>
  );
}
