import { redirect } from "next/navigation";

export default async function AdminPermissionsRedirect({
  searchParams,
}: {
  // Next may pass `searchParams` as a Promise in some runtimes
  searchParams: Promise<{ userId?: string | undefined }> | { userId?: string | undefined };
}) {
  const params = await searchParams;
  const userId = params?.userId;

  if (!userId) {
    // No userId provided — redirect back to admins list
    redirect("/admin/admins");
  }

  // Redirect to the canonical per-admin permissions page
  redirect(`/admin/admins/${encodeURIComponent(userId as string)}/permissions`);
}
