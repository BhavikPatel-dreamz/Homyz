"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { BrandLogo } from "@/components/branding/brand-logo";
import { useBranding } from "@/components/branding/branding-provider";

// ---------------------------------------------------------------------------
// Route-to-navigation key mapping
// ---------------------------------------------------------------------------
const ROUTE_NAV_KEY: Array<{ prefix: string; key: string; exact?: boolean }> = [
  // Bookings sub-pages
  { prefix: "/admin/bookings/all", key: "bookings-all" },
  { prefix: "/admin/bookings/calendar", key: "calendar" },
  { prefix: "/admin/bookings/cancellations", key: "cancellations" },
  // Financial Management
  { prefix: "/admin/bookings/refunds", key: "refunds" },
  { prefix: "/admin/bookings/payments", key: "payments" },
  { prefix: "/admin/bookings/payouts", key: "payouts" },
  // Support & Operations
  { prefix: "/admin/support/notifications", key: "support-notifications" },
  { prefix: "/admin/support/analytics", key: "support-analytics" },
  { prefix: "/admin/support", key: "support-cases" },
  { prefix: "/admin/bookings/disputes", key: "disputes" },
  { prefix: "/admin/bookings/communications", key: "communications" },
  { prefix: "/admin/bookings/notifications", key: "notifications" },
  { prefix: "/admin/moderation/reviews", key: "moderation-reviews" },
  { prefix: "/admin/moderation/reported-listings", key: "moderation-listings" },
  { prefix: "/admin/moderation", key: "moderation" },
  // Insights / Reports
  { prefix: "/admin/analytics", key: "analytics-hub" },
  { prefix: "/admin/bookings/analytics", key: "analytics" },
  { prefix: "/admin/bookings/reports", key: "reports" },
  // Core Modules
  { prefix: "/admin/bookings", key: "bookings-overview" },
  { prefix: "/admin/listings", key: "listings" },
  { prefix: "/admin/hosts", key: "hosts" },
  { prefix: "/admin/guests", key: "guests" },
  { prefix: "/admin/loyalty", key: "loyalty" },
  { prefix: "/admin/referrals", key: "referrals" },
  { prefix: "/admin/travel-stamps", key: "travel-stamps" },
  { prefix: "/admin/admins", key: "admins" },
  { prefix: "/admin/activity-logs", key: "audit-logs" },
  { prefix: "/admin/roles", key: "roles" },
  { prefix: "/admin/security", key: "security" },
  { prefix: "/admin/cms/settings", key: "cms-settings" },
  { prefix: "/admin/settings", key: "settings" },
  { prefix: "/admin", key: "dashboard", exact: true },
];

function resolveActiveKey(pathname: string): string {
  for (const { prefix, key, exact } of ROUTE_NAV_KEY) {
    if (exact ? pathname === prefix : pathname === prefix || pathname.startsWith(prefix + "/")) {
      return key;
    }
  }
  return "";
}

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
  badge?: string | number;
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
  const branding = useBranding();

  const user = session?.user;
  const permissions = user?.permissions || [];
  const isSuper =
    user?.role === "ADMIN" &&
    (user?.adminRoleSlug === "super_admin" || user?.adminRoleSlug === "super-admin");

  const activeKey = resolveActiveKey(pathname);
  const isBookingsActive = BOOKINGS_CHILD_KEYS.has(activeKey);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    WORKSPACE: true,
    "FINANCIAL MANAGEMENT": true,
    "USER MANAGEMENT": true,
    "LOYALTY & REWARDS": true,
    "SUPPORT & OPERATIONS": true,
    "SYSTEM MANAGEMENT": true,
  });

  const [bookingsOpen, setBookingsOpen] = useState<boolean>(isBookingsActive);
  const resolvedBookingsOpen = bookingsOpen || isBookingsActive;

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
  // Navigation Groups aligned with Airbnb-inspired SaaS architecture
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
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
          ),
        },
        {
          key: "analytics-hub",
          label: "Analytics & Reports",
          href: "/admin/analytics",
          requiredPermission: [PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.REPORTS_VIEW, PERMISSIONS.DASHBOARD_VIEW],
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          ),
        },
        {
          key: "bookings-overview",
          label: "Bookings",
          href: "/admin/bookings",
          requiredPermission: PERMISSIONS.BOOKINGS_VIEW,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          ),
          children: [
            {
              key: "bookings-overview",
              label: "Overview",
              href: "/admin/bookings",
              requiredPermission: PERMISSIONS.BOOKINGS_VIEW,
              icon: (
                <svg className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              ),
            },
            {
              key: "bookings-all",
              label: "All Bookings",
              href: "/admin/bookings/all",
              requiredPermission: PERMISSIONS.BOOKINGS_VIEW,
              icon: (
                <svg className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              ),
            },
            {
              key: "calendar",
              label: "Calendar",
              href: "/admin/bookings/calendar",
              requiredPermission: PERMISSIONS.BOOKINGS_VIEW,
              icon: (
                <svg className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              ),
            },
            {
              key: "cancellations",
              label: "Cancellations",
              href: "/admin/bookings/cancellations",
              requiredPermission: PERMISSIONS.BOOKINGS_VIEW,
              icon: (
                <svg className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
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
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
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
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          ),
        },
        {
          key: "refunds",
          label: "Refunds",
          href: "/admin/bookings/refunds",
          requiredPermission: [PERMISSIONS.BOOKINGS_VIEW, PERMISSIONS.PAYMENTS_VIEW, PERMISSIONS.PAYMENTS_REFUND],
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          ),
        },
        {
          key: "payouts",
          label: "Host Payouts",
          href: "/admin/bookings/payouts",
          requiredPermission: [PERMISSIONS.PAYOUTS_VIEW, PERMISSIONS.BOOKINGS_VIEW],
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          ),
        },
      ],
    },
    {
      name: "USER MANAGEMENT",
      items: [
        {
          key: "hosts",
          label: "Hosts",
          href: "/admin/hosts",
          requiredPermission: PERMISSIONS.HOSTS_VIEW,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          ),
        },
        {
          key: "guests",
          label: "Guests",
          href: "/admin/guests",
          requiredPermission: PERMISSIONS.GUESTS_VIEW,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
        {
          key: "admins",
          label: "Administrators",
          href: "/admin/admins",
          requiredPermission: PERMISSIONS.ADMINS_VIEW,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          ),
        },
      ],
    },
    {
      name: "LOYALTY & REWARDS",
      items: [
        {
          key: "loyalty",
          label: "StayElite",
          href: "/admin/loyalty",
          requiredPermission: PERMISSIONS.LOYALTY_OVERVIEW_VIEW,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ),
        },
        {
          key: "referrals",
          label: "Referral Credits",
          href: "/admin/referrals",
          requiredPermission: PERMISSIONS.REFERRALS_VIEW,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          ),
        },
        {
          key: "travel-stamps",
          label: "Travel Stamps",
          href: "/admin/travel-stamps",
          requiredPermission: PERMISSIONS.DASHBOARD_VIEW,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          ),
        },
      ],
    },
    {
      name: "SUPPORT & OPERATIONS",
      items: [
        {
          key: "support-cases",
          label: "Support Cases",
          href: "/admin/support",
          requiredPermission: PERMISSIONS.DISPUTES_VIEW,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          ),
        },
        {
          key: "support-analytics",
          label: "Support Analytics",
          href: "/admin/support/analytics",
          requiredPermission: PERMISSIONS.DISPUTES_VIEW,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          ),
        },
        {
          key: "disputes",
          label: "Disputes",
          href: "/admin/bookings/disputes",
          requiredPermission: [PERMISSIONS.DISPUTES_VIEW, PERMISSIONS.BOOKINGS_VIEW],
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ),
        },
        {
          key: "moderation",
          label: "Moderation",
          href: "/admin/moderation",
          requiredPermission: PERMISSIONS.MODERATION_CASE_READ,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          ),
        },
        {
          key: "moderation-reviews",
          label: "Reviews",
          href: "/admin/moderation/reviews",
          requiredPermission: PERMISSIONS.REVIEWS_VIEW,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ),
        },
        {
          key: "moderation-listings",
          label: "Reported Listings",
          href: "/admin/moderation/reported-listings",
          requiredPermission: PERMISSIONS.MODERATION_CASE_READ,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
          ),
        },
        {
          key: "communications",
          label: "Communications",
          href: "/admin/bookings/communications",
          requiredPermission: [PERMISSIONS.COMMUNICATIONS_VIEW, PERMISSIONS.BOOKINGS_VIEW],
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          ),
        },
        {
          key: "notifications",
          label: "Notifications",
          href: "/admin/bookings/notifications",
          requiredPermission: [PERMISSIONS.NOTIFICATIONS_VIEW, PERMISSIONS.BOOKINGS_VIEW],
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          ),
        },
      ],
    },
    {
      name: "SYSTEM MANAGEMENT",
      items: [
        {
          key: "roles",
          label: "Roles & Permissions",
          href: "/admin/roles",
          requiredPermission: PERMISSIONS.ROLES_VIEW,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <rect x="16" y="8" width="6" height="8" rx="1" />
            </svg>
          ),
        },
        {
          key: "audit-logs",
          label: "Activity Logs",
          href: "/admin/activity-logs",
          requiredPermission: PERMISSIONS.ACTIVITY_LOGS_VIEW,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          ),
        },
        {
          key: "security",
          label: "Security Center",
          href: "/admin/security",
          requiredPermission: [PERMISSIONS.SECURITY_LOGS_VIEW, PERMISSIONS.SETTINGS_VIEW],
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          ),
        },
        {
          key: "cms-settings",
          label: "Global Settings",
          href: "/admin/cms/settings",
          requiredPermission: PERMISSIONS.CMS_VIEW,
          icon: (
            <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          ),
        },
      ],
    },
  ];

  // Filter groups based on permissions
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
  // Render Item
  // ---------------------------------------------------------------------------
  const renderNavItem = (item: NavItem, isChild = false) => {
    const isActive = activeKey === item.key;

    return (
      <div key={item.href} className="relative group/item">
        <Link
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2.5 rounded-xl transition-all cursor-pointer ${
            isChild ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-xs"
          } ${
            isActive
              ? "bg-zinc-900 text-white font-medium shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 font-medium"
          } ${collapsed ? "justify-center px-0 h-9" : ""}`}
        >
          {item.icon}
          {!collapsed && (
            <span className="truncate flex-1 min-w-0">{item.label}</span>
          )}
          {!collapsed && item.badge !== undefined && (
            <span
              className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                isActive ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {item.badge}
            </span>
          )}
        </Link>

        {/* Collapsed Tooltip */}
        {collapsed && (
          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-50 hidden rounded-lg bg-zinc-900 text-white px-2.5 py-1 text-xs font-medium shadow-xl group-hover/item:block whitespace-nowrap">
            {item.label}
          </div>
        )}
      </div>
    );
  };

  const renderBookingsParent = (item: BookingsParentItem) => {
    const isParentActive = isBookingsActive;

    if (collapsed) {
      return (
        <div key={item.href} className="relative group/item">
          <Link
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center justify-center h-9 rounded-xl transition-all cursor-pointer ${
              isParentActive
                ? "bg-zinc-900 text-white shadow-xs"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {item.icon}
          </Link>
          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-50 hidden rounded-lg bg-zinc-900 text-white px-2.5 py-1 text-xs font-medium shadow-xl group-hover/item:block whitespace-nowrap">
            Bookings
          </div>
        </div>
      );
    }

    return (
      <div key={item.href} className="flex flex-col gap-0.5">
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
            isParentActive && !resolvedBookingsOpen
              ? "bg-zinc-900 text-white shadow-xs"
              : isParentActive
              ? "bg-zinc-100 text-zinc-900 font-medium"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
          <Link
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 flex-1 min-w-0"
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </Link>
          <button
            type="button"
            aria-expanded={resolvedBookingsOpen}
            aria-label="Toggle Bookings submenu"
            onClick={(e) => {
              e.preventDefault();
              setBookingsOpen((prev) => !prev);
            }}
            className="flex size-5 items-center justify-center rounded hover:bg-zinc-200/60 transition-colors text-zinc-400 hover:text-zinc-700 cursor-pointer"
          >
            <svg
              className={`size-3 transition-transform duration-200 ${
                resolvedBookingsOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {/* Sub-items */}
        {resolvedBookingsOpen && (
          <div className="flex flex-col gap-0.5 mt-0.5 ml-4 pl-2 border-l border-zinc-200">
            {item.children.map((child) => renderNavItem(child, true))}
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Sidebar Body
  // ---------------------------------------------------------------------------
  const sidebarContent = (
    <div className="flex h-full flex-col justify-between py-4 select-none bg-white text-zinc-900 border-r border-zinc-200/80">
      {/* Brand Header */}
      <div>
        <div className="mb-5 px-3">
          {collapsed ? (
            <div className="flex items-center justify-center">
              <Link
                href="/admin"
                className="flex items-center justify-center hover:scale-105 transition-transform"
                title="Homyz Admin Overview"
              >
                <BrandLogo
                  src={branding.adminLogoUrl}
                  fallbackSrc="/images/brand/homyz-logo-dark-v1.svg"
                  alt="Homyz"
                  width={104}
                  height={38}
                  className="h-7 w-8 object-contain"
                />
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between px-1">
              <Link href="/admin" className="flex items-center gap-2.5 group overflow-hidden">
                <BrandLogo
                  src={branding.adminLogoUrl}
                  fallbackSrc="/images/brand/homyz-logo-dark-v1.svg"
                  alt="Homyz"
                  width={140}
                  height={52}
                  className="h-8 w-[92px] shrink-0 object-contain object-left transition-transform group-hover:scale-105"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-medium tracking-wider text-amber-700 bg-amber-50 border border-amber-200/60 rounded-md px-1.5 py-0.5 uppercase whitespace-nowrap">
                    Admin
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                className="hidden md:flex size-7 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Collapse sidebar"
              >
                <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        <div className="flex flex-col gap-3 px-3 overflow-y-auto max-h-[calc(100vh-140px)] scrollbar-none">
          {filteredNavGroups.map((group) => {
            const isOpen = openGroups[group.name] ?? true;

            return (
              <div key={group.name} className="flex flex-col gap-1">
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.name)}
                    className="flex items-center justify-between px-3 py-1 text-[10px] font-medium tracking-widest text-zinc-400 hover:text-zinc-600 transition-colors w-full text-left uppercase cursor-pointer"
                  >
                    <span>{group.name}</span>
                    <svg
                      className={`size-3 text-zinc-400 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                )}

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
        <div className="px-4 py-3 border-t border-zinc-100 text-[11px] text-zinc-500 flex flex-col gap-0.5">
          <p className="font-medium text-zinc-800">
            Homyz Platform{" "}
            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200/50">
              v2.5
            </span>
          </p>
          <p className="text-[10px] text-zinc-400 font-normal">
            Enterprise RBAC &amp; Audit Logged
          </p>
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
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex w-4/5 max-w-xs flex-1 flex-col shadow-2xl animate-in slide-in-from-left duration-200 z-10">
            {sidebarContent}
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
