import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab;
  if (tab === "past") {
    redirect("/profile/tab/past");
  }
  redirect("/profile/tab/upcoming");
}
