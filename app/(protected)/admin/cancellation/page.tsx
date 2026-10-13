import { redirect } from "next/navigation";

export default function CancellationRedirectPage() {
  redirect("/admin/bookings/cancellations");
}

