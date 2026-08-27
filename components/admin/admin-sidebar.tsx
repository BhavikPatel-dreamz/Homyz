"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SidebarGroup {
  name: string;
  items: {
    label: string;
    href: string;
    icon: React.ReactNode;
    exact?: boolean;
  }[];
}

interface AdminSidebarProps {
  collapsed: boolean;
  setCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
  mobileOpen: boolean;
  setMobileOpen: (val: boolean) => void;
}

export function AdminSidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    WORKSPACE: true,
    MANAGEMENT: true,
    ADMINISTRATION: true,
    SYSTEM: true,
  });

  const toggleGroup = (groupName: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const navGroups: SidebarGroup[] = [
    {
      name: "WORKSPACE",
      items: [
        {
          label: "Dashboard",
          href: "/admin",
          exact: true,
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ),
        },
        {
          label: "Bookings",
          href: "/admin/bookings",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          label: "Listings",
          href: "/admin/listings",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          ),
        },
      ],
    },
    {
      name: "MANAGEMENT",
      items: [
        {
          label: "Hosts",
          href: "/admin/hosts",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V7m0 4h4m-4 0H7" />
            </svg>
          ),
        },
        {
          label: "Guests",
          href: "/admin/guests",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      name: "ADMINISTRATION",
      items: [
        {
          label: "Admin Accounts",
          href: "/admin/admins",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
        },
        {
          label: "Roles & Permissions",
          href: "/admin/roles",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          ),
        },
        {
          label: "Audit Logs",
          href: "/admin/activity-logs",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      name: "SYSTEM",
      items: [
        {
          label: "Settings",
          href: "/admin/settings",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          label: "Security",
          href: "/admin/security",
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ),
        },
      ],
    },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between py-4 select-none bg-[var(--surface)] text-[var(--foreground)] border-r border-[var(--border)]">
      {/* Brand Header */}
      <div>
        <div className="mb-6 px-3">
          {collapsed ? (
            /* Collapsed State: Centered Icon Only */
            <div className="flex items-center justify-center">
              <Link
                href="/admin"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] font-black shadow-2xs hover:scale-105 transition-transform"
                title="Homyz Admin Overview"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
                </svg>
              </Link>
            </div>
          ) : (
            /* Expanded State: Brand + Collapse Toggle Button */
            <div className="flex items-center justify-between px-1">
              <Link href="/admin" className="flex items-center gap-3 group overflow-hidden">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] font-black shadow-2xs transition-transform group-hover:scale-105">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-base font-black tracking-tight text-[var(--foreground)] leading-none">
                    homyz
                  </span>
                  <span className="text-[10px] font-bold tracking-wider text-amber-600 dark:text-amber-400 uppercase mt-0.5 whitespace-nowrap">
                    Admin Panel
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                className="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                title="Collapse sidebar"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Section Groups */}
        <div className="flex flex-col gap-4 px-3 overflow-y-auto max-h-[calc(100vh-140px)] scrollbar-none">
          {navGroups.map((group) => {
            const isOpen = openGroups[group.name] ?? true;

            return (
              <div key={group.name} className="flex flex-col gap-1">
                {/* Group Title Header */}
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.name)}
                    className="flex items-center justify-between px-3 py-1 text-[10px] font-bold tracking-widest text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors w-full text-left uppercase"
                  >
                    <span>{group.name}</span>
                    <svg
                      className={`w-3 h-3 text-[var(--muted-foreground)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}

                {/* Group Items */}
                {(collapsed || isOpen) && (
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const isActive = item.exact
                        ? pathname === item.href
                        : pathname.startsWith(item.href);

                      return (
                        <div key={item.href} className="relative group/item">
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                              isActive
                                ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-extrabold shadow-2xs"
                                : "text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
                            } ${collapsed ? "justify-center px-0 h-9" : ""}`}
                          >
                            {item.icon}
                            {!collapsed && (
                              <span className="truncate">{item.label}</span>
                            )}
                          </Link>

                          {/* Hover Tooltip when Collapsed */}
                          {collapsed && (
                            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1 text-[11px] font-semibold shadow-xl group-hover/item:block whitespace-nowrap">
                              {item.label}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar Footer Info */}
      {!collapsed && (
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] text-[11px] text-[var(--muted-foreground)] flex flex-col gap-0.5">
          <p className="font-bold text-[var(--foreground)]">Homyz Admin <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">v2.4</span></p>
          <p className="text-[10px]">Enterprise RBAC & Audit System</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed Left) */}
      <aside
        className={`hidden md:block sticky top-0 h-screen transition-all duration-300 ease-in-out shrink-0 z-40 ${
          collapsed ? "w-[72px]" : "w-[250px]"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Slide-out) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex w-4/5 max-w-xs flex-1 flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
