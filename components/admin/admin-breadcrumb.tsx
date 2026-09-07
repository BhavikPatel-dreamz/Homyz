"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminBreadcrumb() {
  const pathname = usePathname();

  const getBreadcrumbs = (path: string) => {
    const items = [{ label: "Admin", href: "/admin" }];

    if (path === "/admin" || path === "/admin/") {
      items.push({ label: "Overview", href: "/admin" });
      return items;
    }

    if (path.startsWith("/admin/hosts")) {
      items.push({ label: "Management", href: "/admin/hosts" });
      items.push({ label: "Hosts", href: "/admin/hosts" });
      if (path.split("/").length > 3) {
        items.push({ label: "Host Details", href: path });
      }
      return items;
    }

    if (path.startsWith("/admin/guests")) {
      items.push({ label: "Management", href: "/admin/guests" });
      items.push({ label: "Guests", href: "/admin/guests" });
      if (path.split("/").length > 3) {
        items.push({ label: "Guest Details", href: path });
      }
      return items;
    }

    if (path.startsWith("/admin/roles")) {
      items.push({ label: "Administration", href: "/admin/roles" });
      items.push({ label: "Roles & Permissions", href: "/admin/roles" });
      return items;
    }

    if (path.startsWith("/admin/admins")) {
      items.push({ label: "Administration", href: "/admin/admins" });
      items.push({ label: "Admin Accounts", href: "/admin/admins" });
      return items;
    }

    if (path.startsWith("/admin/activity-logs")) {
      items.push({ label: "Administration", href: "/admin/activity-logs" });
      items.push({ label: "Audit Logs", href: "/admin/activity-logs" });
      return items;
    }

    if (path.startsWith("/admin/security")) {
      items.push({ label: "System", href: "/admin/security" });
      items.push({ label: "Security", href: "/admin/security" });
      return items;
    }

    const parts = path.split("/").filter(Boolean);
    parts.forEach((part, idx) => {
      if (part === "admin") return;
      const href = "/" + parts.slice(0, idx + 1).join("/");
      const label = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, " ");
      items.push({ label, href });
    });

    return items;
  };

  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <nav className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] font-medium overflow-x-auto py-1 select-none">
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <div key={`${item.href}-${index}`} className="flex items-center gap-1.5 whitespace-nowrap">
            {index > 0 && (
              <svg className="w-3 h-3 text-[var(--muted-foreground)] opacity-60 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
            {isLast ? (
              <span className="font-semibold text-muted-foreground">{item.label}</span>
            ) : (
              <Link href={item.href} className="hover:text-muted-foreground transition-colors">
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
