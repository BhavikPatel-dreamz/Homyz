import { redirect } from "next/navigation";

export default async function AdminReviewsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value !== undefined) params.set(key, value);
  }
  const query = params.toString();
  redirect(`/admin/moderation/reviews${query ? `?${query}` : ""}`);
}

