import { redirect } from "next/navigation";

interface ListingBookRedirectProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ListingBookRedirectPage({
  params,
  searchParams,
}: ListingBookRedirectProps) {
  const { id } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") {
      qs.set(key, value);
    } else if (Array.isArray(value)) {
      qs.set(key, value.join(","));
    }
  }
  const queryString = qs.toString();
  redirect(`/book/${id}${queryString ? `?${queryString}` : ""}`);
}

