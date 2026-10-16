import { HostListingsWorkspace } from "@/components/host/host-listings-workspace";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { listingService } from "@/services/listing.service";
import { Role } from "@/generated/prisma/enums";

export default async function HostListingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string; q?: string; tab?: string; page?: string }>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const actor = await requirePageRole([Role.USER, Role.HOST, Role.ADMIN]);
  const requestedTab = (sp?.tab || "ALL").toUpperCase();
  const requestedPage = Math.max(1, parseInt(sp?.page || "1", 10) || 1);
  const requestedSearch = sp?.q || "";
  const initialShowSearch = Boolean(sp?.search === "true" || sp?.search === "1" || sp?.q);

  const { items, total, totalCount, totalPages, counts } = await listingService.listForHost(actor, {
    cardOnly: true,
    skip: (requestedPage - 1) * 12,
    take: 12,
    page: requestedPage,
    limit: 12,
    tab: requestedTab,
    search: requestedSearch,
  });

  return (
    <HostListingsWorkspace
      initialListings={items}
      initialTotalCount={totalCount ?? total}
      initialTotalPages={totalPages}
      initialTab={requestedTab}
      initialPage={requestedPage}
      initialCounts={counts}
      currentUserId={actor.id}
      initialShowSearch={initialShowSearch}
      initialSearchQuery={requestedSearch}
    />
  );
}
