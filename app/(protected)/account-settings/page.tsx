import { redirect } from "next/navigation";

// Redirects /account-settings (and legacy /account-settings/personal-info) to My profile Account settings tab
export default function AccountSettingsIndexPage() {
  redirect("/profile/tab/account_settings");
}

