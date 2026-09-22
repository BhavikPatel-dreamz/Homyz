import { notFound } from "next/navigation";
import { requirePagePermission, requirePageRole } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hasPermission } from "@/lib/permissions/permissions";
import { Role } from "@/generated/prisma/enums";
import { HostListingEditorClient, type HostListingData } from "@/app/(protected)/host/listings/[id]/host-listing-editor-client";
import { slugToSection, serializeListingForEditor } from "@/app/(protected)/host/listings/[id]/section-helpers";
import { listingService } from "@/services/listing.service";
import { getNonRefundableDiscountPercentage } from "@/services/app-settings.service";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ section?: string }>;
}

export default async function AdminListingDetailPage({ params, searchParams }: PageProps) {
  const admin = await requirePageRole([Role.ADMIN]);
  await requirePagePermission(PERMISSIONS.LISTINGS_VIEW);
  const resolvedParams = await params;
  const listingId = resolvedParams.id;
  const initialSection = slugToSection((searchParams ? await searchParams : {}).section);

  const detail = await listingService.getAdminListingDetail(listingId);
  if (!detail) {
    notFound();
  }
  const { listing, auditLogs, auditLogTotal, reviewer, approvedBy } = detail;

  const nonRefundableEntry =
    listing.discounts && typeof listing.discounts === "object"
      ? (listing.discounts as Record<string, unknown>).non_refundable
      : null;
  const listingNonRefundablePercentage =
    typeof nonRefundableEntry === "object" &&
    nonRefundableEntry !== null &&
    typeof (nonRefundableEntry as Record<string, unknown>).percentage === "number"
      ? (nonRefundableEntry as Record<string, number>).percentage
      : null;
  const nonRefundableDiscountPercentage =
    listingNonRefundablePercentage ?? (await getNonRefundableDiscountPercentage());

  const serializedListing = serializeListingForEditor(listing, {
    nonRefundableDiscountPercentage,
    reviewer,
    approvedBy,
  });

  // TEMPORARILY DISABLED: guidebooks are intentionally off in admin until the feature is ready.
  const initialGuidebooks: any[] = [];

  return (
    <HostListingEditorClient
      listing={serializedListing}
      initialSection={initialSection}
      initialGuidebooks={initialGuidebooks}
      routeBase="/admin/listings"
      presentation="admin"
      adminCapabilities={{
        canApprove: hasPermission(admin, PERMISSIONS.LISTINGS_APPROVE),
        canSuspend: hasPermission(admin, PERMISSIONS.LISTINGS_SUSPEND),
        canEdit: hasPermission(admin, PERMISSIONS.LISTINGS_EDIT),
      }}
      initialAuditLogs={auditLogs.map((item: typeof auditLogs[number]) => ({ ...item, createdAt: item.createdAt.toISOString() }))}
      initialAuditLogTotal={auditLogTotal}
    />
  );
}
