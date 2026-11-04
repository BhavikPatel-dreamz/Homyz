import { Suspense, type ReactNode } from "react";
import { forbidden, notFound } from "next/navigation";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { getNonRefundableDiscountPercentage } from "@/services/app-settings.service";
import { guidebookService } from "@/services/guidebook.service";
import { listingService } from "@/services/listing.service";
import { serializeListingForEditor } from "./section-helpers";
import { ListingEditorRouteWorkspace } from "./listing-editor-route-workspace";
import HostListingLoading from "./loading";

type HostListingLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

/**
 * This is deliberately the only data owner for all `/host/listings/[id]/*`
 * routes. A layout is retained while moving between child route segments, so
 * the sidebar and already-loaded listing data do not remount or refetch.
 */
export default function HostListingLayout({ children, params }: HostListingLayoutProps) {
  return (
    <>
      <Suspense fallback={<HostListingLoading />}>
        <ListingEditorData params={params} />
      </Suspense>
      {children}
    </>
  );
}

async function ListingEditorData({ params }: Pick<HostListingLayoutProps, "params">) {
  const [{ id: listingId }, actor] = await Promise.all([
    params,
    requirePageRole([Role.USER, Role.HOST, Role.ADMIN]),
  ]);

  const listing = await listingService.getEditorWorkspaceListing(listingId);

  if (!listing || listing.deletedAt) {
    notFound();
  }

  const isAcceptedCoHost = listing.coHosts.some(
    (coHost: typeof listing.coHosts[number]) => coHost.status === "ACCEPTED" && coHost.userId === actor.id,
  );

  if (actor.role !== Role.ADMIN && listing.hostId !== actor.id && !isAcceptedCoHost) {
    forbidden();
  }

  const nonRefundableEntry = listing.discounts && typeof listing.discounts === "object"
    ? (listing.discounts as Record<string, unknown>).non_refundable
    : null;
  const listingNonRefundablePercentage = typeof nonRefundableEntry === "object" && nonRefundableEntry !== null
    && typeof (nonRefundableEntry as Record<string, unknown>).percentage === "number"
      ? (nonRefundableEntry as Record<string, number>).percentage
      : null;

  // The profile and guidebook reads are independent of one another. The
  // global discount setting is only read when the listing does not override
  // it, avoiding a request that was previously unnecessary in that case.
  const [initialGuidebooks, hostAbout, fallbackNonRefundableDiscountPercentage] = await Promise.all([
    guidebookService.getGuidebooksForHost(actor),
    listingService.getHostAboutProfileData(listing.hostId),
    listingNonRefundablePercentage === null
      ? getNonRefundableDiscountPercentage()
      : Promise.resolve(listingNonRefundablePercentage),
  ]);

  const serializedListing = serializeListingForEditor(listing, {
    nonRefundableDiscountPercentage: listingNonRefundablePercentage ?? fallbackNonRefundableDiscountPercentage,
  });
  serializedListing.hostAbout = hostAbout;

  return <ListingEditorRouteWorkspace listing={serializedListing} initialGuidebooks={initialGuidebooks} />;
}
