"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LogoutButton } from "@/components/admin/logout-button";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

export function AppHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const role = user?.role;

  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<"hosting" | "traveling">("hosting");
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

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/bookings", label: "Bookings" },
    { href: "/host/listings", label: "My listings", requireHost: true },
    { href: "/host/onboarding", label: "Become a Host / Application" },
    { href: "/admin", label: "Admin", requireAdmin: true },
    { href: "/profile", label: "Profile" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8 gap-4">

        {/* Left: Brand Logo */}
        <div className="flex items-center gap-6 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs transition-transform group-hover:scale-105">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
              </svg>
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
              homyz
            </span>
          </Link>
        </div>

        {/* Center: Main Navigation Menu */}
        <nav className="hidden sm:flex items-center gap-1 bg-[var(--surface-secondary)]/80 p-1.5 rounded-full border border-[var(--border)] shadow-2xs">
          {navItems.map((item) => {
            if (item.requireHost && role !== "HOST" && role !== "ADMIN") return null;
            if (item.requireAdmin && role !== "ADMIN") return null;

            const isActive =
              item.href === "/admin"
                ? pathname.startsWith("/admin")
                : item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-[#FBDE9B] text-[#291E05] font-extrabold shadow-2xs dark:bg-[#f59e0b] dark:text-zinc-950"
                    : "text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Traveling / Hosting Switcher */}
          <Link
            href={role === "HOST" ? "/host/listings" : "/host/onboarding"}
            className="hidden sm:inline-flex whitespace-nowrap items-center rounded-full bg-[#FBDE9B] hover:bg-[#F7D37E] px-4 py-2 text-xs font-bold text-[#291E05] shadow-2xs transition-all hover:scale-102 active:scale-98 dark:bg-[#f59e0b] dark:text-zinc-950 dark:hover:bg-[#d97706]"
          >
            {role === "HOST" ? "switch to hosting" : "become a host"}
          </Link>


          {/* Theme Switcher */}
          <div className="hidden sm:block">
            <ThemeSwitcher />
          </div>

          {/* User Menu Trigger */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 pr-3 hover:border-[var(--muted-foreground)] transition-all shadow-2xs"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--foreground)] font-bold text-xs overflow-hidden">
                {user?.image ? (
                  <img src={user.image} alt={user.name || "User"} className="h-full w-full object-cover" />
                ) : (
                  <span>{user?.email?.charAt(0).toUpperCase() || "U"}</span>
                )}
              </div>
              <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl z-50 animate-in fade-in zoom-in-95">
                {user && (
                  <div className="border-b border-[var(--border)] px-3 py-2.5 mb-1">
                    <p className="text-xs font-bold text-[var(--foreground)] truncate">{user.name || user.email}</p>
                    <p className="text-[11px] text-[var(--muted-foreground)] truncate">{user.email}</p>
                    <span className="mt-1 inline-block rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--accent-foreground)]">
                      {role || "USER"}
                    </span>
                  </div>
                )}

                {/* Mobile View Nav Links inside Dropdown */}
                <div className="py-1 sm:hidden border-b border-[var(--border)] mb-1">
                  {navItems.map((item) => {
                    if (item.requireHost && role !== "HOST" && role !== "ADMIN") return null;
                    if (item.requireAdmin && role !== "ADMIN") return null;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center px-3 py-2 text-xs font-medium rounded-xl transition-colors ${
                          pathname === item.href
                            ? "bg-[#FBDE9B] text-[#291E05] font-bold dark:bg-[#f59e0b] dark:text-zinc-950"
                            : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>

                <div className="py-1">
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center px-3 py-2 text-xs font-medium rounded-xl text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                  >
                    Account Settings
                  </Link>
                </div>

                <div className="border-t border-[var(--border)] pt-2 mt-1 flex flex-col gap-1">
                  <div className="px-3 py-1 flex items-center justify-between sm:hidden">
                    <span className="text-xs text-[var(--muted-foreground)]">Theme</span>
                    <ThemeSwitcher compact />
                  </div>
                  {user ? (
                    <LogoutButton variant="menu-item" callbackUrl="/login?logged_out=true">
                      Sign out
                    </LogoutButton>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center px-3 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] rounded-xl transition-colors"
                    >
                      Sign in
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}
