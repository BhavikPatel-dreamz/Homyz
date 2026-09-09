import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { NewListingGetStarted } from "@/components/host/new-listing-get-started";
import { notFound, redirect } from "next/navigation";

type NewListingPageProps = {
  searchParams: Promise<{ type?: string | string[]; draftId?: string | string[] }>;
};

export default async function NewListingPage({ searchParams }: NewListingPageProps) {
  await requirePageRole([Role.USER, Role.HOST, Role.ADMIN]);
  const { type, draftId: draftIdParam } = await searchParams;
  const hostingType = Array.isArray(type) ? undefined : type ?? "HOME";
  const draftId = Array.isArray(draftIdParam) ? undefined : draftIdParam;

  if (hostingType !== "HOME" && hostingType !== "EXPERIENCE" && hostingType !== "SERVICE") {
    notFound();
  }

  // Drafts and published listings share the same editor. The destination
  // performs the authoritative ownership check before rendering any data.
  if (draftId) {
    redirect(`/host/listings/${encodeURIComponent(draftId)}/property-type`);
  }

  return <NewListingGetStarted initialHostingType={hostingType} />;
}
