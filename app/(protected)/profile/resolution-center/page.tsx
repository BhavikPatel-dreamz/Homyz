import { DirectResolutionCenter } from "@/components/resolution/direct-resolution-center";
import { requirePageUser } from "@/lib/permissions/page-guards";

export const dynamic = "force-dynamic";

export default async function GuestResolutionCenterPage() {
  await requirePageUser();
  return (
    <div className="w-full">
      <DirectResolutionCenter audience="guest" />
    </div>
  );
}
