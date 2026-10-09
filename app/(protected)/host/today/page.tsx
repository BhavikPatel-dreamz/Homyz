import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Footer } from "@/components/dashboard/footer";
import { HostTodayWorkspace } from "@/components/host/host-today-workspace";
import { getHostWorkspace } from "@/services/host-workspace.service";
import { bookingDateKey } from "@/lib/booking/booking-date";
import type { ReservationPeriod } from "@/lib/booking/host-reservation-events";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostTodayPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; page?: string; listing?: string }>;
} = {}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
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
  const initialPropertyId = resolvedParams?.listing || null;

  const data = await getHostWorkspace(actor, {
    tab: initialTab,
    propertyId: initialPropertyId,
    page: initialPage,
    limit: 12,
    includeCancelled: true,
  });
  const renderedAt = new Date();
  const today = bookingDateKey(renderedAt);
  const initialCurrentTimeMinutes = renderedAt.getHours() * 60 + renderedAt.getMinutes();

  return (
    <div className="flex min-h-screen flex-col bg-white pb-0 font-sans text-[#1F1F1F] selection:bg-[#FEE08B] sm:pb-0">
      <HostHeader />
      <HostTodayWorkspace
        {...data}
        initialTab={initialTab}
        initialPage={initialPage}
        today={today}
        initialCurrentTimeMinutes={initialCurrentTimeMinutes}
      />
      <Footer />
    </div>
  );
}
