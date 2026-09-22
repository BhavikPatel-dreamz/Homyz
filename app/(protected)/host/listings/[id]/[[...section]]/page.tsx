import { notFound, forbidden } from "next/navigation";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { HostListingEditorClient } from "../host-listing-editor-client";
import { getNonRefundableDiscountPercentage } from "@/services/app-settings.service";
import { listingService } from "@/services/listing.service";
import { slugToSection, serializeListingForEditor } from "../section-helpers";

interface PageProps {
  params: Promise<{ id: string; section?: string[] }>;
  searchParams?: Promise<{ section?: string }>;
}

export default async function HostListingEditorPage({ params, searchParams }: PageProps) {
  const actor = await requirePageRole([Role.USER, Role.HOST, Role.ADMIN]);
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const listingId = resolvedParams.id;

  const listing = await listingService.getEditorWorkspaceListing(listingId);

  if (!listing || listing.deletedAt) {
    notFound();
  }
  const nonRefundableEntry = listing.discounts && typeof listing.discounts === "object"
    ? (listing.discounts as Record<string, unknown>).non_refundable
    : null;
  const listingNonRefundablePercentage = typeof nonRefundableEntry === "object" && nonRefundableEntry !== null
    && typeof (nonRefundableEntry as Record<string, unknown>).percentage === "number"
      ? (nonRefundableEntry as Record<string, number>).percentage
      : null;
  const nonRefundableDiscountPercentage = listingNonRefundablePercentage ?? await getNonRefundableDiscountPercentage();

  const isAcceptedCoHost = listing.coHosts.some(
    (coHost: typeof listing.coHosts[number]) => coHost.status === "ACCEPTED" && coHost.userId === actor.id,
  );

  // Listing owners, accepted co-hosts, and admins can open the workspace.
  if (actor.role !== Role.ADMIN && listing.hostId !== actor.id && !isAcceptedCoHost) {
    forbidden();
  }

  const rawSection = resolvedParams.section?.[0] || resolvedSearchParams.section;
  const initialSection = slugToSection(rawSection);

  const serializedListing = serializeListingForEditor(listing, {
    nonRefundableDiscountPercentage,
  });

  // TEMPORARILY DISABLED: guidebook feature is being held back until the UI/data flow is stable.
  // Prefetch guidebooks associated with this listing to avoid an extra client fetch
  const initialGuidebooks: any[] = [];

  return (
    <HostListingEditorClient
      listing={serializedListing}
      initialSection={initialSection}
      initialGuidebooks={initialGuidebooks}
    />
  );
}
