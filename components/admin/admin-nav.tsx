"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { Badge } from "../ui";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";

export function AdminNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const user = session?.user;

  const navItems = [
    {
      href: "/admin",
      label: "Dashboard",
      permission: PERMISSIONS.DASHBOARD_VIEW,
      exact: true,
    },
    {
      href: "/admin/admins",
      label: "Admin Users",
      permission: PERMISSIONS.ADMINS_VIEW,
    },
    {
      href: "/admin/users",
      label: "All Users",
      permission: PERMISSIONS.USERS_VIEW,
    },
    {
      href: "/admin/roles",
      label: "Roles & Permissions",
      permission: PERMISSIONS.ROLES_VIEW,
    },
    {
      href: "/admin/activity-logs",
      label: "Activity Logs",
      permission: PERMISSIONS.ACTIVITY_LOGS_VIEW,
    },
    {
      href: "/admin/security",
      label: "Security",
      permission: PERMISSIONS.SECURITY_LOGS_VIEW,
    },
    {
      href: "/admin/sessions",
      label: "Sessions",
      permission: PERMISSIONS.SESSIONS_VIEW,
    },
    {
      href: "/admin/settings",
      label: "Settings",
      permission: PERMISSIONS.SETTINGS_VIEW,
    },
  ];

  // Filter based on user permissions; defaults to showing nav during initial hydration
  const allowedNav = navItems.filter((item) => {
    if (!user) return true;
    return hasPermission(
      {
        id: user.id,
        role: user.role,
        email: user.email ?? null,
        status: user.status,
        adminRoleSlug: user.adminRoleSlug,
        permissions: user.permissions,
      },
      item.permission,
    );
  });

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white shadow-2xs">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
        {/* Left: Brand & Admin Tag */}
        <div className="flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-bold text-base">
              H
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-zinc-900">
                homyz
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-amber-700 -mt-1">
                Admin Console
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Navigation Pills */}
        <nav className="hidden lg:flex items-center gap-1.5 overflow-x-auto py-1">
          {allowedNav.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#FBDE9B] text-zinc-950 font-bold shadow-2xs"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: User & Actions */}
        <div className="flex items-center gap-3">
          {/* Link to view public app */}
          <Link
            href="/dashboard"
            className="hidden md:inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-full px-3 py-1.5 hover:bg-zinc-50 transition-colors"
            title="View App Dashboard"
          >
            <span>View App</span>
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </Link>

          {user ? (
            <div className="hidden sm:flex items-center gap-2.5">
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-zinc-900">
                  {user.name || user.email?.split("@")[0]}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {user.adminRoleSlug || user.role}
                </span>
              </div>
              <Badge>
                {user.adminRoleSlug === "super_admin"
                  ? "Super Admin"
                  : user.role}
              </Badge>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-full border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 px-3.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors"
          >
            Sign out
          </button>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            aria-label="Toggle navigation"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Nav Bar */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-zinc-200 bg-white px-4 py-3 shadow-md">
          <div className="grid grid-cols-2 gap-2">
            {allowedNav.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-xl px-3 py-2 text-xs font-medium ${
                    isActive
                      ? "bg-[#FBDE9B] text-zinc-950 font-bold"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between">
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="text-xs text-zinc-600 hover:text-zinc-900 underline"
            >
              ← Go to App Dashboard
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
