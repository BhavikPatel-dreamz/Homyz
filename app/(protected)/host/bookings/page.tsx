import { redirect } from "next/navigation";

export default async function HostBookingApprovalsPage() {
  // Keep existing bookmarks working while Today is the single queue for
  // requests that require the host's decision.
  redirect("/host/today?tab=pending");
}
