"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { HomyzLogo } from "@/components/ui/homyz-logo";

// ---------------------------------------------------------------------------
// Explicit route-to-navigation mapping.
// Maps each pathname prefix to the active "nav key" so that:
//   /admin/bookings/refunds  → key "refunds"   (Financial Management)
//   /admin/bookings/payments → key "payments"  (Financial Management)
//   /admin/bookings/calendar → key "calendar"  (Bookings child)
// and NOT to the parent "bookings" key.
// ---------------------------------------------------------------------------
const ROUTE_NAV_KEY: Array<{ prefix: string; key: string; exact?: boolean }> = [
  // Bookings children — must come before the parent catch-all
  { prefix: "/admin/bookings/all",           key: "bookings-all" },
  { prefix: "/admin/bookings/calendar",      key: "calendar" },
  { prefix: "/admin/bookings/cancellations", key: "cancellations" },
  // Financial Management — lives under /admin/bookings/* URLs but belongs to a different group
  { prefix: "/admin/bookings/refunds",       key: "refunds" },
  { prefix: "/admin/bookings/payments",      key: "payments" },
  { prefix: "/admin/bookings/payouts",       key: "payouts" },
  // Support & Operations
  { prefix: "/admin/bookings/disputes",      key: "disputes" },
  { prefix: "/admin/bookings/communications",key: "communications" },
  { prefix: "/admin/bookings/notifications", key: "notifications" },
  // Insights
  { prefix: "/admin/bookings/analytics",     key: "analytics" },
  { prefix: "/admin/bookings/reports",       key: "reports" },
  // Bookings parent (catch-all for /admin/bookings — must be last bookings entry)
  { prefix: "/admin/bookings",               key: "bookings-overview" },
  // Workspace / Management / Administration / System
  { prefix: "/admin/listings",               key: "listings" },
  { prefix: "/admin/hosts",                  key: "hosts" },
  { prefix: "/admin/guests",                 key: "guests" },
  { prefix: "/admin/referrals",              key: "referrals" },
  { prefix: "/admin/admins",                 key: "admins" },
  { prefix: "/admin/activity-logs",          key: "audit-logs" },
  { prefix: "/admin/settings",              key: "settings" },
  { prefix: "/admin/security",              key: "security" },
  { prefix: "/admin/roles",                 key: "roles" },
  { prefix: "/admin/users",                 key: "users" },
  { prefix: "/admin/sessions",              key: "sessions" },
  { prefix: "/admin",                        key: "dashboard", exact: true },
];

/** Resolve the active nav key for the given pathname. */
function resolveActiveKey(pathname: string): string {
  for (const { prefix, key, exact } of ROUTE_NAV_KEY) {
    if (exact ? pathname === prefix : pathname === prefix || pathname.startsWith(prefix + "/")) {
      return key;
    }
  }
  return "";
}

/** The set of nav keys that belong to the Bookings expandable group. */
const BOOKINGS_CHILD_KEYS = new Set([
  "bookings-overview",
  "bookings-all",
  "calendar",
  "cancellations",
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  requiredPermission?: string | string[];
}

interface NavGroup {
  name: string;
  items: (NavItem | BookingsParentItem)[];
}

interface BookingsParentItem extends NavItem {
  children: NavItem[];
}

function isBookingsParent(item: NavItem | BookingsParentItem): item is BookingsParentItem {
  return "children" in item;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface AdminSidebarProps {
  collapsed: boolean;
  setCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
  mobileOpen: boolean;
  setMobileOpen: (val: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AdminSidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const user = session?.user;
  const permissions = user?.permissions || [];
  const isSuper =
    user?.role === "ADMIN" &&
    (user?.adminRoleSlug === "super_admin" || user?.adminRoleSlug === "super-admin");

  const activeKey = resolveActiveKey(pathname);
  const isBookingsActive = BOOKINGS_CHILD_KEYS.has(activeKey);

  // Section groups open/closed state
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    WORKSPACE: true,
    "FINANCIAL MANAGEMENT": true,
    MANAGEMENT: true,
    "SUPPORT & OPERATIONS": true,
    INSIGHTS: true,
    ADMINISTRATION: true,
    SYSTEM: true,
  });

  // Bookings submenu expanded state — auto-expands when on a booking child route
  const [bookingsOpen, setBookingsOpen] = useState<boolean>(isBookingsActive);

  // Keep bookings open when navigating to any booking child page
  useEffect(() => {
    if (isBookingsActive) setBookingsOpen(true);
  }, [isBookingsActive]);

  const toggleGroup = (groupName: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const hasMenuPermission = (reqPerm?: string | string[]): boolean => {
    if (isSuper) return true;
    if (!reqPerm) return true;
    if (permissions.includes("*")) return true;
    if (Array.isArray(reqPerm)) return reqPerm.some((p) => permissions.includes(p));
    return permissions.includes(reqPerm);
  };

  // ---------------------------------------------------------------------------
  // Navigation configuration
  // ---------------------------------------------------------------------------
  const navGroups: NavGroup[] = [
    {
      name: "WORKSPACE",
      items: [
        {
          key: "dashboard",
          label: "Dashboard",
          href: "/admin",
          requiredPermission: PERMISSIONS.DASHBOARD_VIEW,
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ),
        },
        // Bookings — expandable parent with children
        {
          key: "bookings-overview",
          label: "Bookings",
          href: "/admin/bookings",
          requiredPermission: PERMISSIONS.BOOKINGS_VIEW,
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
          children: [
            {
              key: "bookings-overview",
              label: "Booking Overview",
              href: "/admin/bookings",
              requiredPermission: PERMISSIONS.BOOKINGS_VIEW,
              icon: (
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              ),
            },
            {
              key: "bookings-all",
              label: "All Bookings",
              href: "/admin/bookings/all",
              requiredPermission: PERMISSIONS.BOOKINGS_VIEW,
              icon: (
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              ),
            },
            {
              key: "calendar",
              label: "Reservation Calendar",
              href: "/admin/bookings/calendar",
              requiredPermission: PERMISSIONS.BOOKINGS_VIEW,
              icon: (
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              ),
            },
            {
              key: "cancellations",
              label: "Cancellations",
              href: "/admin/bookings/cancellations",
              requiredPermission: PERMISSIONS.BOOKINGS_VIEW,
              icon: (
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
          ],
        } as BookingsParentItem,
        {
          key: "listings",
          label: "Listings",
          href: "/admin/listings",
          requiredPermission: PERMISSIONS.LISTINGS_VIEW,
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          ),
        },
      ],
    },
    {
      name: "FINANCIAL MANAGEMENT",
      items: [
        {
          key: "payments",
          label: "Payments",
          href: "/admin/bookings/payments",
          requiredPermission: [PERMISSIONS.PAYMENTS_VIEW, PERMISSIONS.BOOKINGS_VIEW],
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          ),
        },
        {
          key: "refunds",
          label: "Refunds",
          href: "/admin/bookings/refunds",
          requiredPermission: [PERMISSIONS.BOOKINGS_VIEW, PERMISSIONS.PAYMENTS_VIEW, PERMISSIONS.PAYMENTS_REFUND],
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          key: "payouts",
          label: "Host Payouts",
          href: "/admin/bookings/payouts",
          requiredPermission: [PERMISSIONS.PAYOUTS_VIEW, PERMISSIONS.BOOKINGS_VIEW],
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      name: "MANAGEMENT",
      items: [
        {
          key: "hosts",
          label: "Hosts",
          href: "/admin/hosts",
          requiredPermission: PERMISSIONS.HOSTS_VIEW,
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V7m0 4h4m-4 0H7" />
            </svg>
          ),
        },
        {
          key: "guests",
          label: "Guests",
          href: "/admin/guests",
          requiredPermission: PERMISSIONS.GUESTS_VIEW,
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
        },
        {
          key: "referrals",
          label: "Referral Credits",
          href: "/admin/referrals",
          requiredPermission: PERMISSIONS.REFERRALS_VIEW,
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H2v-2a4 4 0 014-4h3m6-10a4 4 0 110 8 4 4 0 010-8zM7.5 4a3.5 3.5 0 110 7 3.5 3.5 0 010-7z" />
            </svg>
          ),
        },
      ],
    },
    {
      name: "SUPPORT & OPERATIONS",
      items: [
        {
          key: "disputes",
          label: "Disputes",
          href: "/admin/bookings/disputes",
          requiredPermission: [PERMISSIONS.DISPUTES_VIEW, PERMISSIONS.BOOKINGS_VIEW],
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
        },
        {
          key: "communications",
          label: "Communications",
          href: "/admin/bookings/communications",
          requiredPermission: [PERMISSIONS.COMMUNICATIONS_VIEW, PERMISSIONS.BOOKINGS_VIEW],
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 12.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
        },
        {
          key: "notifications",
          label: "Notifications",
          href: "/admin/bookings/notifications",
          requiredPermission: [PERMISSIONS.NOTIFICATIONS_VIEW, PERMISSIONS.BOOKINGS_VIEW],
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          ),
        },
      ],
    },
    {
      name: "INSIGHTS",
      items: [
        {
          key: "analytics",
          label: "Analytics",
          href: "/admin/bookings/analytics",
          requiredPermission: [PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.REPORTS_VIEW, PERMISSIONS.BOOKINGS_VIEW],
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
        },
        {
          key: "reports",
          label: "Reports",
          href: "/admin/bookings/reports",
          requiredPermission: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.BOOKINGS_VIEW],
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      name: "ADMINISTRATION",
      items: [
        {
          key: "admins",
          label: "Admin Accounts",
          href: "/admin/admins",
          requiredPermission: PERMISSIONS.ADMINS_VIEW,
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
        },
        {
          key: "audit-logs",
          label: "Audit Logs",
          href: "/admin/activity-logs",
          requiredPermission: PERMISSIONS.ACTIVITY_LOGS_VIEW,
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
          key: "settings",
          label: "Settings",
          href: "/admin/settings",
          requiredPermission: PERMISSIONS.SETTINGS_VIEW,
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          key: "security",
          label: "Security",
          href: "/admin/security",
          requiredPermission: [PERMISSIONS.SECURITY_LOGS_VIEW, PERMISSIONS.SETTINGS_VIEW],
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ),
        },
      ],
    },
  ];

  // Filter groups based on permissions, including Bookings children
  const filteredNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => hasMenuPermission(item.requiredPermission))
        .map((item) => {
          if (isBookingsParent(item)) {
            return {
              ...item,
              children: item.children.filter((child) =>
                hasMenuPermission(child.requiredPermission)
              ),
            };
          }
          return item;
        }),
    }))
    .filter((group) => group.items.length > 0);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const renderNavItem = (item: NavItem, isChild = false) => {
    const isActive = activeKey === item.key;

    return (
      <div key={item.href} className="relative group/item">
        <Link
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2.5 rounded-xl text-xs transition-all ${
            isChild ? "px-2.5 py-1.5 font-medium" : "px-3 py-2 font-semibold"
          } ${
            isActive
              ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold shadow-2xs"
              : isChild
              ? "text-muted-foreground hover:bg-[var(--surface-secondary)] hover:text-foreground"
              : "text-muted-foreground hover:bg-[var(--surface-secondary)] hover:text-foreground"
          } ${collapsed ? "justify-center px-0 h-9" : ""}`}
        >
          {item.icon}
          {!collapsed && <span className="truncate">{item.label}</span>}
        </Link>

        {/* Collapsed tooltip */}
        {collapsed && (
          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden rounded-md bg-[var(--primary)] text-primary-foreground px-3 py-1 text-[11px] font-semibold shadow-xl group-hover/item:block whitespace-nowrap">
            {item.label}
          </div>
        )}
      </div>
    );
  };

  const renderBookingsParent = (item: BookingsParentItem) => {
    const isParentActive = isBookingsActive;

    if (collapsed) {
      // In collapsed mode show parent icon with tooltip only
      return (
        <div key={item.href} className="relative group/item">
          <Link
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center justify-center h-9 rounded-xl transition-all ${
              isParentActive
                ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-2xs"
                : "text-muted-foreground hover:bg-[var(--surface-secondary)] hover:text-foreground"
            }`}
          >
            {item.icon}
          </Link>
          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 hidden rounded-md bg-[var(--primary)] text-primary-foreground px-3 py-1 text-[11px] font-semibold shadow-xl group-hover/item:block whitespace-nowrap">
            Bookings
          </div>
        </div>
      );
    }

    return (
      <div key={item.href} className="flex flex-col gap-0.5">
        {/* Parent row: label navigates, chevron toggles */}
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            isParentActive
              ? "text-foreground bg-[var(--surface-secondary)]"
              : "text-muted-foreground hover:bg-[var(--surface-secondary)] hover:text-foreground"
          }`}
        >
          <Link
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </Link>
          <button
            type="button"
            aria-expanded={bookingsOpen}
            aria-label="Toggle Bookings submenu"
            onClick={(e) => {
              e.preventDefault();
              setBookingsOpen((prev) => !prev);
            }}
            className="flex items-center justify-center h-5 w-5 shrink-0 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          >
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${bookingsOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Children */}
        {bookingsOpen && (
          <div className="flex flex-col gap-0.5 mt-0.5 border-l border-[var(--border)] ml-4 pl-2">
            {item.children.map((child) => renderNavItem(child, true))}
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Sidebar body
  // ---------------------------------------------------------------------------
  const sidebarContent = (
    <div className="flex h-full flex-col justify-between py-4 select-none bg-[var(--surface)] text-muted-foreground border-r border-[var(--border)]">
      {/* Brand Header */}
      <div>
        <div className="mb-6 px-3">
          {collapsed ? (
            <div className="flex items-center justify-center">
              <Link
                href="/admin"
                className="flex items-center justify-center hover:scale-105 transition-transform"
                title="Homyz Admin Overview"
              >
                <HomyzLogo className="text-muted-foreground shrink-0" size={26} />
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between px-1">
              <Link href="/admin" className="flex items-center gap-3 group overflow-hidden">
                <HomyzLogo className="text-muted-foreground group-hover:scale-105 transition-transform shrink-0" size={26} />
                <div className="flex flex-col min-w-0">
                  <span className="text-base font-black tracking-tight text-muted-foreground leading-none">
                    homyz
                  </span>
                  <span className="text-[10px] font-semibold tracking-wider text-amber-600 dark:text-amber-400 uppercase mt-0.5 whitespace-nowrap">
                    Admin Panel
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                className="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-muted-foreground transition-colors"
                title="Collapse sidebar"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        <div className="flex flex-col gap-4 px-3 overflow-y-auto max-h-[calc(100vh-140px)] scrollbar-none">
          {filteredNavGroups.map((group) => {
            const isOpen = openGroups[group.name] ?? true;

            return (
              <div key={group.name} className="flex flex-col gap-1">
                {/* Group Title */}
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.name)}
                    className="flex items-center justify-between px-3 py-1 text-[10px] font-semibold tracking-widest text-[var(--muted-foreground)] hover:text-muted-foreground transition-colors w-full text-left uppercase"
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
                    {group.items.map((item) =>
                      isBookingsParent(item)
                        ? renderBookingsParent(item)
                        : renderNavItem(item)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar Footer */}
      {!collapsed && (
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] text-[11px] text-[var(--muted-foreground)] flex flex-col gap-0.5">
          <p className="font-semibold text-muted-foreground">Homyz Admin <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">v2.4</span></p>
          <p className="text-[10px]">Enterprise RBAC &amp; Audit System</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:block sticky top-0 h-screen transition-all duration-300 ease-in-out shrink-0 z-40 ${
          collapsed ? "w-[72px]" : "w-[250px]"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex w-4/5 max-w-xs flex-1 flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
