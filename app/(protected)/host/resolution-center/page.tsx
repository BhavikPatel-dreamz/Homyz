import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostResolutionCenterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageRole([Role.HOST]);
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((entry) => query.append(key, entry));
  }

  const caseId = typeof params.caseId === "string" ? params.caseId : undefined;
  if (caseId) {
    query.delete("caseId");
    const qs = query.toString() ? `?${query.toString()}` : "";
    redirect(`/host/support/cases/${encodeURIComponent(caseId)}${qs}`);
  }

  // Preserve historic bookmarks while enforcing one host-facing support entry point.
  redirect(`/host/support${query.size ? `?${query.toString()}` : ""}`);
}
