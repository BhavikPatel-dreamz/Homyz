import { requirePageUser } from "@/lib/permissions/page-guards";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuestResolutionCenterPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageUser();
  const params = searchParams ? await searchParams : {};
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === "id" && !params.caseId) {
      if (typeof value === "string") query.set("caseId", value);
    } else if (typeof value === "string") {
      query.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, entry));
    }
  }

  query.set("view", "direct");

  redirect(`/profile/tab/support?${query.toString()}`);
}
