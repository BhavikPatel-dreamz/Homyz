import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Footer } from "@/components/dashboard/footer";
import { HostCalendarWorkspace } from "@/components/host/host-calendar-workspace";
import { getHostWorkspace } from "@/services/host-workspace.service";

export default async function HostCalendarPage() {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const data = await getHostWorkspace(actor);
  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] selection:bg-[#FEE08B] sm:pb-0">
      <HostHeader />
      <HostCalendarWorkspace {...data} />
      <Footer />
    </div>
  );
}
