import { redirect } from "next/navigation";

export default async function ProfileManagementPage() {
  redirect("/profile?tab=profile_management");
}
