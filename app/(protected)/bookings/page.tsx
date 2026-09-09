import { redirect } from "next/navigation";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab;
  if (tab === "past") {
    redirect("/profile?tab/past");
  }
  redirect("/profile?tab/upcoming");
}
