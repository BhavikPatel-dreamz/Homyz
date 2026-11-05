import { Role } from "@/generated/prisma/enums";
import { Container } from "@/components/ui";
import { HostHeader } from "@/components/host/host-header";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { getHostDashboardEntitlements } from "@/lib/entitlements/host-dashboard";
import { forbidden } from "next/navigation";
import { hostOperationalRecordsService } from "@/services/host-operational-records.service";
import { HostOperationsClient } from "./host-operations-client";

export const dynamic = "force-dynamic";

export default async function HostOperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole([Role.HOST, Role.ADMIN]);
  if (!(await getHostDashboardEntitlements(actor)).features.OPERATIONS_AND_PROFITABILITY) {
    forbidden();
  }

  const params = await searchParams;
  const single = (val: string | string[] | undefined) => (Array.isArray(val) ? val[0] : val);
  const selectedListingId = single(params.propertyId) || single(params.listingId);
  const currency = single(params.currency) || "SAR";

  const data = await hostOperationalRecordsService.overview(actor, {
    listingId: selectedListingId,
    currency,
  });

  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-zinc-900 sm:pb-0">
      <HostHeader />
      <main className="w-full min-w-0 flex-1 py-8 sm:py-10">
        <Container className="max-w-6xl px-4 sm:px-6">
          <HostOperationsClient
            initialData={data}
            initialListingId={selectedListingId || ""}
            initialCurrency={currency}
          />
        </Container>
      </main>
    </div>
  );
}
