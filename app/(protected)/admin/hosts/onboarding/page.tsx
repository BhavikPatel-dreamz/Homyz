import { redirect } from "next/navigation";

export default function HostOnboardingRedirect() {
  redirect("/admin/hosts");
}
