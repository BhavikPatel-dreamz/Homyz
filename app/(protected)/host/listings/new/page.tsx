import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { NewListingGetStarted } from "@/components/host/new-listing-get-started";
import { notFound } from "next/navigation";

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

  // Keep the creation flow in the step-based wizard even when a draft ID is
  // present in the URL. Redirects to a listing section only happen in the
  // dedicated edit screens, not while the host is creating a new listing.
  return <NewListingGetStarted initialHostingType={hostingType} />;
}
