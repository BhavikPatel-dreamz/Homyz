"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/permissions/permissions";

import { HorizontalTabSlider } from "@/components/ui/horizontal-tab-slider";
import { Container } from "@/components/ui/container";

export function AdminSubNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const user = session?.user;
  const permissions = user?.permissions || [];
  const isSuper =
    user?.role === "ADMIN" &&
    (user?.adminRoleSlug === "super_admin" || user?.adminRoleSlug === "super-admin");

  const hasMenuPermission = (reqPerm?: string | string[]): boolean => {
    if (isSuper) return true;
    if (!reqPerm) return true;
    if (permissions.includes("*")) return true;
    if (Array.isArray(reqPerm)) {
      return reqPerm.some((p) => permissions.includes(p));
    }
    return permissions.includes(reqPerm);
  };

  const links = [
    { href: "/admin", label: "Overview", exact: true, requiredPermission: PERMISSIONS.DASHBOARD_VIEW },
    {
      href: "/admin/hosts",
      label: "Hosts",
      requiredPermission: PERMISSIONS.HOSTS_VIEW,
    },
    {
      href: "/admin/guests",
      label: "Guests",
      requiredPermission: PERMISSIONS.GUESTS_VIEW,
    },
    { href: "/admin/admins", label: "Admin Accounts", requiredPermission: PERMISSIONS.ADMINS_VIEW },
    { href: "/admin/activity-logs", label: "Audit Logs", requiredPermission: PERMISSIONS.ACTIVITY_LOGS_VIEW },
  ];

  const visibleLinks = links.filter((link) => hasMenuPermission(link.requiredPermission));

  return (
    <div className="w-full border-b border-[var(--border-subtle)] bg-[var(--surface)]/95 backdrop-blur-md mb-6 sticky top-[57px] z-30 shadow-2xs">
      <Container className="py-2.5">
        <HorizontalTabSlider>
          {visibleLinks.map((link) => {
            const isActive = link.exact
              ? pathname === "/admin"
              : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-extrabold shadow-2xs"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </HorizontalTabSlider>
      </Container>
    </div>
  );
}
