import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { NewListingGetStarted } from "@/components/host/new-listing-get-started";

export default async function NewListingPage() {
  await requirePageRole([Role.USER, Role.HOST, Role.ADMIN]);

  return <NewListingGetStarted />;
}
