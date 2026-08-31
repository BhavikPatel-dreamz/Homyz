"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/permissions/permissions";

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
    <div className="w-full border-b border-zinc-200/80 bg-white/95 backdrop-blur-md mb-6 sticky top-[57px] z-30 shadow-2xs">
      <div className="mx-auto flex max-w-7xl items-center gap-1.5 px-4 sm:px-6 lg:px-8 overflow-x-auto py-2.5 scrollbar-none">
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
                  ? "bg-[#FBDE9B] text-[#291E05] font-extrabold shadow-2xs dark:bg-[#f59e0b] dark:text-zinc-950"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
