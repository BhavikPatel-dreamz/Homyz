import { GlobalSettingsClient } from "@/components/admin/cms/global-settings-client";

export const metadata = {
  title: "Global Website Settings | Admin CMS | Homyz",
  description: "Configure site identity, legal information, contact details, regional defaults, and default SEO.",
};

export default function AdminGlobalSettingsPage() {
  return <GlobalSettingsClient />;
}

