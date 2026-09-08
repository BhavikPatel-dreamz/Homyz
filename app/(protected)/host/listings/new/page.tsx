import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { NewListingGetStarted } from "@/components/host/new-listing-get-started";
import { notFound } from "next/navigation";

type NewListingPageProps = {
  searchParams: Promise<{ type?: string | string[] }>;
};

export default async function NewListingPage({ searchParams }: NewListingPageProps) {
  await requirePageRole([Role.USER, Role.HOST, Role.ADMIN]);
  const { type } = await searchParams;
  const hostingType = Array.isArray(type) ? undefined : type ?? "HOME";

  if (hostingType !== "HOME" && hostingType !== "EXPERIENCE" && hostingType !== "SERVICE") {
    notFound();
  }

  return <NewListingGetStarted initialHostingType={hostingType} />;
}
