import { redirect } from "next/navigation";
import { extractSubTabFromQuery, getMgmtSubTabSlug } from "@/lib/profile/tab-utils";

export default async function ProfileManagementPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sub = extractSubTabFromQuery(resolvedSearchParams);
  if (sub && sub !== "info") {
    const slug = getMgmtSubTabSlug(sub);
    redirect(`/profile?tab/profile_management/${slug}`);
  }
  redirect("/profile?tab/profile_management");
}
