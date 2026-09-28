import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { personalInfoService } from "@/services/personal-info.service";
import { PersonalInfoView } from "@/components/account-settings/personal-info-view";

export const metadata: Metadata = {
  title: "Personal Information — Account Settings | Homyz",
  description: "Manage your legal name, email, phone number, and address.",
};

import { redirect } from "next/navigation";

export default function PersonalInfoPage() {
  redirect("/profile/tab/account_settings");
}

