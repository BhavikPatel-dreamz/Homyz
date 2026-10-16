"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export function HostOnboardingSubNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const user = session?.user;
  const permissions = user?.permissions || [];
  const isSuper =
    user?.role === "ADMIN" &&
    (user?.adminRoleSlug === "super_admin" || user?.adminRoleSlug === "super-admin");

  const hasTabPermission = (reqPerm?: string | string[]): boolean => {
    if (isSuper) return true;
    if (!reqPerm) return true;
    if (permissions.includes("*")) return true;
    if (Array.isArray(reqPerm)) {
      return reqPerm.some((p) => permissions.includes(p));
    }
    return permissions.includes(reqPerm);
  };

  const tabs = [
    {
      href: "/admin/hosts/onboarding/registration-requests",
      label: "Registration Requests",
      requiredPermission: [PERMISSIONS.HOST_REGISTRATION_VIEW, PERMISSIONS.HOSTS_VIEW],
    },
    {
      href: "/admin/hosts/onboarding/documents",
      label: "Documents",
      requiredPermission: [
        PERMISSIONS.HOST_REGISTRATION_VIEW_DOCUMENTS,
        PERMISSIONS.HOST_REGISTRATION_VIEW,
        PERMISSIONS.HOST_COMPLIANCE_VIEW,
      ],
    },
    {
      href: "/admin/hosts/onboarding/compliance",
      label: "Compliance",
      requiredPermission: [PERMISSIONS.HOST_COMPLIANCE_VIEW, PERMISSIONS.HOSTS_VIEW],
    },
    {
      href: "/admin/hosts/onboarding/progress",
      label: "Progress",
      requiredPermission: [PERMISSIONS.HOST_ONBOARDING_VIEW, PERMISSIONS.HOSTS_VIEW],
    },
  ];

  const visibleTabs = tabs.filter((t) => hasTabPermission(t.requiredPermission));

  return (
    <div className="w-full border-b border-[var(--border-subtle)] bg-[var(--surface)] py-2 mb-6">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-1">
        {visibleTabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href === "/admin/hosts/onboarding/registration-requests" &&
              (pathname === "/admin/hosts/onboarding" ||
                pathname.startsWith("/admin/hosts/onboarding/registration-requests")));

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs transition-all ${
                isActive
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold shadow-2xs"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-muted-foreground font-semibold"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
