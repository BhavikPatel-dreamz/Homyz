"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminSubNav() {
  const pathname = usePathname();

  const links = [
    { href: "/admin", label: "Overview", exact: true },
    { href: "/admin/hosts", label: "Host Management" },
    { href: "/admin/guests", label: "Guest Management" },
    { href: "/admin/roles", label: "Roles & Permissions" },
    { href: "/admin/admins", label: "Admin Accounts" },
    { href: "/admin/activity-logs", label: "Audit Logs" },
  ];

  return (
    <div className="w-full border-b border-[var(--border-subtle)] bg-[var(--surface)]/95 backdrop-blur-md mb-6 sticky top-[57px] z-30 shadow-2xs">
      <div className="mx-auto flex max-w-7xl items-center gap-1.5 px-4 sm:px-6 lg:px-8 overflow-x-auto py-2.5 scrollbar-none">
        {links.map((link) => {
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
      </div>
    </div>
  );
}
