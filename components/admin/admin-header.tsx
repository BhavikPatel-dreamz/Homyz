"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LogoutButton } from "./logout-button";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { AdminBreadcrumb } from "./admin-breadcrumb";
import { Container } from "@/components/ui/container";

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
  const role = user?.role;

  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<"hosting" | "traveling">("hosting");
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

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">

        {/* Left Side: Sidebar Toggle & Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors shadow-2xs"
            title="Open navigation menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] transition-colors shadow-2xs"
            title="Toggle sidebar collapse"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>

          {/* Breadcrumb Trail */}
          <div className="hidden sm:block min-w-0">
            <AdminBreadcrumb />
          </div>
        </div>

        {/* Right Side: Quick Search, Notifications, Mode Switcher, Theme, Profile Dropdown */}
        <div className="flex items-center gap-3 shrink-0">

          {/* Header Quick Search */}
          <div className="relative hidden md:block w-48 lg:w-64">
            <input
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Search admin app..."
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] py-1.5 pl-8 pr-8 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)] pointer-events-none"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {quickSearch && (
              <button
                type="button"
                onClick={() => setQuickSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
                title="Clear search"
                aria-label="Clear search"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Notifications Bell */}
          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] transition-colors shadow-2xs"
            title="Notifications"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-[var(--surface)]" />
          </button>

          {/* Secondary Traveling / Hosting Switcher */}
          <button
            type="button"
            onClick={() => setMode(mode === "hosting" ? "traveling" : "hosting")}
            className="hidden xl:inline-flex whitespace-nowrap items-center rounded-full border border-amber-300/80 bg-[var(--card-highlight)] hover:opacity-90 px-3.5 py-1.5 text-xs font-bold text-[var(--accent-foreground)] shadow-2xs transition-all"
          >
            Switch to {mode === "hosting" ? "traveling" : "hosting"}
          </button>

          {/* Theme Selector */}
          <div className="hidden sm:block">
            <ThemeSwitcher />
          </div>

          {/* Profile Dropdown Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 pr-3 hover:border-[var(--muted-foreground)] transition-all shadow-2xs"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold text-xs overflow-hidden">
                {user?.image ? (
                  <img src={user.image} alt={user.name || "User"} className="h-full w-full object-cover" />
                ) : (
                  <span>{user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "A"}</span>
                )}
              </div>
              <span className="hidden sm:inline-block text-xs font-bold text-[var(--foreground)] truncate max-w-[90px]">
                {user?.name?.split(" ")[0] || "Admin"}
              </span>
              <svg className="w-3.5 h-3.5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Profile Dropdown Card */}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xl z-50 animate-in fade-in zoom-in-95">
                {/* User Info Header */}
                <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-3 mb-2.5 px-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold text-sm overflow-hidden">
                    {user?.image ? (
                      <img src={user.image} alt={user.name || "User"} className="h-full w-full object-cover" />
                    ) : (
                      <span>{user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "A"}</span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-xs font-bold text-[var(--foreground)] truncate">
                      {user?.name || "Homyz Admin"}
                    </p>
                    <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                      {user?.email || "admin@homyz.local"}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] px-2 py-0.5 text-[10px] font-extrabold w-fit">
                      {role || "ADMIN"}
                    </span>
                  </div>
                </div>

                {/* Dropdown Menu Links */}
                <div className="flex flex-col gap-0.5">
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
                  >
                    <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Account Settings
                  </Link>

                  <Link
                    href="/admin/security"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
                  >
                    <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Security & Access
                  </Link>
                </div>

                {/* Sign Out Action */}
                <div className="border-t border-[var(--border-subtle)] pt-2 mt-2">
                  <LogoutButton variant="menu-item" callbackUrl="/admin/login?logged_out=true">
                    Sign Out
                  </LogoutButton>
                </div>
              </div>
            )}
          </div>

        </div>
      </Container>
    </header>
  );
}
