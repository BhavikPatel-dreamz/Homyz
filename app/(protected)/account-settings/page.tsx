import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PersonalInfoView } from "@/components/account-settings/personal-info-view";

export const metadata: Metadata = {
  title: "Account Settings | Homyz",
  description: "Manage your personal information and account settings.",
};

// Redirects /account-settings (and legacy /account-settings/personal-info) to My profile Account settings tab
export default function AccountSettingsIndexPage() {
  redirect("/profile/tab/account_settings");
}

