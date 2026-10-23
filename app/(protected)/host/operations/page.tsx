import { Role } from "@/generated/prisma/enums";
import { Container } from "@/components/ui";
import { HostHeader } from "@/components/host/host-header";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { hostOperationalRecordsService } from "@/services/host-operational-records.service";
import { HostOperationsClient } from "./host-operations-client";

export const dynamic = "force-dynamic";
export default async function HostOperationsPage() {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  const data = await hostOperationalRecordsService.overview(actor);
  return <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-zinc-900 sm:pb-0"><HostHeader /><main className="w-full min-w-0 flex-1 py-8 sm:py-10"><Container className="max-w-6xl px-4 sm:px-6"><HostOperationsClient initialData={data} /></Container></main></div>;
}
