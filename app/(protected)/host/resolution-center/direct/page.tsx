import { DirectResolutionCenter } from "@/components/resolution/direct-resolution-center";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HostDirectResolutionCenterPage() {
  await requirePageRole([Role.HOST]);
  return <div className="min-h-screen bg-white text-[#1F1F1F]"><HostHeader /><Container className="px-4 sm:px-6"><DirectResolutionCenter audience="host" /></Container></div>;
}
