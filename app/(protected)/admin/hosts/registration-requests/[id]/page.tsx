import { redirect } from "next/navigation";

export default function RedirectToHosts() {
  redirect("/admin/hosts");
}
