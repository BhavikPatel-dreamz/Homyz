import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { disputeService } from "@/services/dispute.service";
import { listingService } from "@/services/listing.service";
import { HostHeader } from "@/components/host/host-header";
import { HostSubNav } from "@/components/host/host-sub-nav";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { HostResolutionCenterClient } from "@/components/host/host-resolution-center-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostResolutionCenterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole([Role.HOST]);
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const [data, listings] = await Promise.all([
    disputeService.listDisputesForHost(actor, {
      page: Number(value("page")) || 1,
      limit: 20,
      tab: value("tab") as "all" | "response_required" | "open" | "resolved" | undefined,
      search: value("search"),
      propertyId: value("propertyId"),
      status: value("status"),
      startDate: value("startDate"),
      endDate: value("endDate"),
    }),
    listingService.listForHost(actor, { take: 100 }),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] text-[#1F1F1F] sm:pb-0">
      <HostHeader />
      <HostSubNav activeTab="resolution" showRightActions={false} />
      <main className="flex-1 py-8 sm:py-10">
        <Container className="px-4 sm:px-6">
          <HostResolutionCenterClient data={data} listings={listings.items.map((listing) => ({ id: listing.id, title: listing.title }))} />
        </Container>
      </main>
      <Footer />
    </div>
  );
}
