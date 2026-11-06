"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LogoutButton } from "./logout-button";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { AdminBreadcrumb } from "./admin-breadcrumb";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  invalidateUnreadNotificationCount,
  refreshUnreadNotificationCount,
  resetUnreadNotificationCount,
  useUnreadNotificationCount,
} from "@/lib/notifications/unread-count-store";

interface AdminHeaderProps {
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
}

export function AdminHeader({
  onToggleSidebar,
  onOpenMobileSidebar,
}: AdminHeaderProps) {
  const { data: session } = useSession();
  const user = session?.user;
  const hasUser = Boolean(user);
  const role = user?.role;
  const { t } = useLanguage();
  const unreadCount = useUnreadNotificationCount();

  const [menuOpen, setMenuOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    resetUnreadNotificationCount();
    if (!hasUser) return;
    void refreshUnreadNotificationCount();
    const refresh = () => {
      invalidateUnreadNotificationCount();
      void refreshUnreadNotificationCount({ force: true });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const poll = window.setInterval(onVisible, 30_000);
    window.addEventListener("homyz:notifications-updated", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("homyz:notifications-updated", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hasUser, user?.email]);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-zinc-200/80 bg-white/95 backdrop-blur-md">
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left Side: Sidebar Toggle & Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="md:hidden flex size-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors shadow-2xs cursor-pointer"
            title={t("header_open_navigation_menu", "Open navigation menu")}
          >
            <svg
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden md:flex size-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-2xs cursor-pointer"
            title={t("header_toggle_sidebar_collapse", "Toggle sidebar collapse")}
          >
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="15" y2="18" />
            </svg>
          </button>

          {/* Breadcrumb Trail */}
          <div className="hidden sm:block min-w-0">
            <AdminBreadcrumb />
          </div>
        </div>

        {/* Right Side: Quick Search, Notifications, Theme, Profile Dropdown */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Header Quick Search */}
          <div className="relative hidden md:block w-48 lg:w-64">
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder={t("admin_search_placeholder", "Search admin app...")}
              className="w-full rounded-full border border-zinc-200 bg-zinc-50/70 py-1.5 pl-8 pr-8 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/10 transition-all font-normal"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {quickSearch && (
              <button
                type="button"
                onClick={() => setQuickSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex size-4 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                <svg
                  className="size-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Notifications Bell */}
          <Link
            href="/admin/bookings/notifications"
            className="relative flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors shadow-2xs cursor-pointer"
            title={t("header_notifications", "Notifications")}
            aria-label={
              unreadCount && unreadCount > 0
                ? `${t("header_notifications", "Notifications")}, ${unreadCount} unread`
                : t("header_notifications", "Notifications")
            }
          >
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount !== null && unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-medium text-white ring-2 ring-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>

          {/* Theme Selector */}
          <div className="hidden sm:block">
            <ThemeSwitcher />
          </div>

          {/* Profile Dropdown Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white p-1 pr-3 hover:border-zinc-300 transition-all shadow-2xs cursor-pointer"
            >
              <div className="flex size-7 items-center justify-center rounded-full bg-amber-100 text-amber-900 font-medium text-xs overflow-hidden border border-amber-200/50">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt={user.name || "User"}
                    className="size-full object-cover"
                  />
                ) : (
                  <span>
                    {user?.name?.charAt(0).toUpperCase() ||
                      user?.email?.charAt(0).toUpperCase() ||
                      "A"}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline-block text-xs font-medium text-zinc-800 truncate max-w-[100px]">
                {user?.name?.split(" ")[0] || "Admin"}
              </span>
              <svg
                className="size-3.5 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Profile Dropdown Card */}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-zinc-200/90 bg-white p-3.5 shadow-xl z-50 animate-in fade-in zoom-in-95">
                {/* User Info Header */}
                <div className="flex items-center gap-3 border-b border-zinc-100 pb-3 mb-2.5 px-1">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900 font-medium text-sm overflow-hidden border border-amber-200/60">
                    {user?.image ? (
                      <img
                        src={user.image}
                        alt={user.name || "User"}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span>
                        {user?.name?.charAt(0).toUpperCase() ||
                          user?.email?.charAt(0).toUpperCase() ||
                          "A"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-xs font-medium text-zinc-900 truncate">
                      {user?.name || "Homyz Admin"}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate font-normal">
                      {user?.email || "admin@homyz.local"}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-amber-50 border border-amber-200/60 text-amber-800 px-2 py-0.5 text-[10px] font-medium w-fit">
                      {role || "ADMIN"}
                    </span>
                  </div>
                </div>

                {/* Dropdown Menu Links */}
                <div className="flex flex-col gap-0.5">
                  <Link
                    href="/admin/admins"
                    prefetch={false}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    <svg
                      className="size-4 text-zinc-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                    <span>Admin Accounts</span>
                  </Link>

                  <Link
                    href="/admin/security"
                    prefetch={false}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    <svg
                      className="size-4 text-zinc-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>{t("header_security_access", "Security & Access")}</span>
                  </Link>
                </div>

                {/* Sign Out Action */}
                <div className="border-t border-zinc-100 pt-2 mt-2">
                  <LogoutButton variant="menu-item" callbackUrl="/login?logged_out=true">
                    {t("header_sign_out", "Sign Out")}
                  </LogoutButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
