import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Footer } from "@/components/dashboard/footer";
import { HostCalendarWorkspace } from "@/components/host/host-calendar-workspace";
import { getHostWorkspace } from "@/services/host-workspace.service";

export default async function HostCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<{ listingId?: string; month?: string; view?: string }>;
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const data = await getHostWorkspace(actor);
  const sp = searchParams ? await searchParams : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-white pb-0 font-sans text-[#1F1F1F] selection:bg-[#FEE08B]">
      <HostHeader />
      <HostCalendarWorkspace
        {...data}
        initialListingId={sp?.listingId}
        initialMonth={sp?.month}
        initialView={sp?.view}
      />
      <Footer />
    </div>
  );
}
