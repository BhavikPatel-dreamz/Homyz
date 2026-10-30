import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HostDirectResolutionCenterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageRole([Role.HOST]);
  const params = await searchParams;
  const caseId = typeof params.caseId === "string" ? params.caseId : undefined;
  if (caseId) {
    redirect(`/host/support/cases/${encodeURIComponent(caseId)}?view=direct`);
  }
  redirect(`/host/support?view=direct`);
}
