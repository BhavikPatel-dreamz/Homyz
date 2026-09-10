import { HostListingsWorkspace } from "@/components/host/host-listings-workspace";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { listingService } from "@/services/listing.service";
import { Role } from "@/generated/prisma/enums";

export default async function HostListingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ search?: string; q?: string }>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const actor = await requirePageRole([Role.USER, Role.HOST, Role.ADMIN]);
  const { items } = await listingService.listForHost(actor, {
    skip: 0,
    take: 100,
  });

  return (
    <HostListingsWorkspace
      initialListings={items}
      currentUserId={actor.id}
      initialShowSearch={Boolean(sp?.search === "true" || sp?.search === "1" || sp?.q)}
      initialSearchQuery={sp?.q || ""}
    />
  );
}
