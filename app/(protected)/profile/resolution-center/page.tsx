import { DirectResolutionCenter } from "@/components/resolution/direct-resolution-center";
import { requirePageUser } from "@/lib/permissions/page-guards";

export const dynamic = "force-dynamic";

export default async function GuestResolutionCenterPage() {
  await requirePageUser();
  return <main className="px-4 sm:px-6 lg:px-8"><DirectResolutionCenter audience="guest" /></main>;
}
