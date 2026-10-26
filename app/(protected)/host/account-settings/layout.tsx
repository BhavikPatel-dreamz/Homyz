import type { Metadata } from "next";
import { Role } from "@/generated/prisma/enums";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { HostHeader } from "@/components/host/host-header";

export const metadata: Metadata = {
  title: "Host Account Settings | Homyz",
  description:
    "Manage host payout methods, tax documents, earnings reports, hosting preferences, and permissions on Homyz.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountSettingsRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforce server-side role-based authorization for all host account settings routes
  await requirePageRole([Role.HOST, Role.ADMIN]);

  return (
    <div className="flex min-h-screen flex-col bg-white pb-16 font-sans text-[#1F1F1F] selection:bg-[#FCDF9C] sm:pb-20">
      <HostHeader />
      <main className="w-full min-w-0 flex-1">{children}</main>
    </div>
  );
}

