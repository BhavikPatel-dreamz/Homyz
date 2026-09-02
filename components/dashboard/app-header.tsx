"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LogoutButton } from "@/components/admin/logout-button";
import { HomyzLogo } from "@/components/ui/homyz-logo";

export function AppHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const role = user?.role;

  const [menuOpen, setMenuOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState("English (US)");
  const [selectedCurrency, setSelectedCurrency] = useState("USD ($)");
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
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 bg-white/95 backdrop-blur-md text-zinc-900 transition-colors" suppressHydrationWarning>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-8 py-3 relative">
        {/* Left: Handwritten brand slogan */}
        <Link href="/" className="font-['Caveat'] text-2xl sm:text-3xl font-bold text-zinc-900 tracking-wide hover:opacity-90 transition-opacity select-none shrink-0">
          Stay like a homie.
        </Link>

        {/* Center: Brand Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 group absolute left-1/2 -translate-x-1/2">
          <HomyzLogo className="text-zinc-950 group-hover:scale-105 transition-transform shrink-0" size={28} />
          <span className="text-xl font-extrabold tracking-tight text-zinc-900 hidden sm:inline-block">
            homyz
          </span>
        </Link>

        {/* Right: Actions (100% Reference UI Parity) */}
        <div className="flex items-center gap-2.5 sm:gap-3" ref={menuRef}>
          {user ? (
            /* ------------------------------------------------------------- */
            /* LOGGED IN HEADER RIGHT SIDE (Screenshot 1 Parity)            */
            /* ------------------------------------------------------------- */
            <>
              {/* Become a host / Switch to hosting Yellow Pill */}
              <Link
                href={role === "HOST" ? "/host/listings" : "/host/onboarding"}
                className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-900 font-semibold text-xs sm:text-sm px-5 py-2.5 transition-all cursor-pointer select-none whitespace-nowrap shadow-2xs hidden sm:inline-block"
              >
                {role === "HOST" ? "Switch to hosting" : "Become a host"}
              </Link>

              {/* Profile Avatar Image */}
              <Link
                href="/profile"
                className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 shadow-2xs border border-zinc-200 cursor-pointer hover:opacity-90 transition-opacity"
                title="Profile"
              >
                <Image
                  src={user?.image || "/images/header-user-avatar.jpg"}
                  alt={user?.name || "User Avatar"}
                  fill
                  className="object-cover"
                  sizes="40px"
                  priority
                />
              </Link>

              {/* Language Icon Button (文A) */}
              <button
                type="button"
                onClick={() => setLangModalOpen(!langModalOpen)}
                className="w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Language"
              >
                <span className="font-sans font-medium text-xs tracking-tighter flex items-center justify-center">
                  <span className="text-[13px] leading-none">文</span>
                  <span className="text-[10px] font-bold leading-none -ml-0.5">A</span>
                </span>
              </button>

              {/* Hamburger Menu Button */}
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                aria-label="Menu"
              >
                <svg className="w-4.5 h-4.5 text-zinc-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </svg>
              </button>
            </>
          ) : (
            /* ------------------------------------------------------------- */
            /* LOGGED OUT HEADER RIGHT SIDE (Screenshot 2 Parity)           */
            /* ------------------------------------------------------------- */
            <>
              {/* Become a Host Link (Plain text) */}
              <Link
                href="/host/onboarding"
                className="text-sm font-semibold text-zinc-900 hover:bg-zinc-100 px-3.5 py-2 rounded-full transition-all cursor-pointer select-none whitespace-nowrap hidden sm:inline-block"
              >
                Become a host
              </Link>

              {/* User Profile Outline Button (👤) */}
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Account"
              >
                <svg className="w-5 h-5 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M20 21a8 8 0 10-16 0" />
                </svg>
              </button>

              {/* Hamburger Menu Button (≡) */}
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                aria-label="Menu"
              >
                <svg className="w-4.5 h-4.5 text-zinc-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </svg>
              </button>
            </>
          )}

          {/* Dropdown Menu Container */}
          {menuOpen && (
            <div className="absolute right-4 top-14 w-72 sm:w-80 rounded-3xl border border-zinc-200/80 bg-white p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 text-zinc-900">
              {!user ? (
                /* ------------------------------------------------------------- */
                /* LOGGED OUT DROPDOWN MENU (100% Matches Reference Screenshot) */
                /* ------------------------------------------------------------- */
                <div className="space-y-1">
                  {/* Languages & currency */}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setLangModalOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 rounded-2xl transition-colors text-left cursor-pointer"
                  >
                    <svg className="w-5 h-5 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span>Languages &amp; currency</span>
                  </button>

                  {/* Help Centre */}
                  <Link
                    href="/help"
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 rounded-2xl transition-colors text-left"
                  >
                    <svg className="w-5 h-5 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Help Centre</span>
                  </Link>

                  <div className="my-2 border-t border-zinc-100" />

                  {/* Become a host Card Banner */}
                  <Link
                    href="/host/onboarding"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 hover:bg-zinc-100/90 border border-zinc-200/60 transition-all group cursor-pointer"
                  >
                    <div className="pr-2">
                      <p className="text-sm font-bold text-zinc-900 group-hover:text-amber-600 transition-colors">Become a host</p>
                      <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">It&apos;s easy to start hosting and earn extra income.</p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-2xs">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                  </Link>

                  <div className="my-2 border-t border-zinc-100" />

                  {/* Refer a host */}
                  <Link
                    href="/host/refer"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3.5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 rounded-2xl transition-colors"
                  >
                    Refer a host
                  </Link>

                  {/* Find a co-host */}
                  <Link
                    href="/host/co-host"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3.5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 rounded-2xl transition-colors"
                  >
                    Find a co-host
                  </Link>

                  <div className="my-2 border-t border-zinc-100" />

                  {/* Log in or sign up */}
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3.5 py-2.5 text-sm font-bold text-zinc-900 hover:bg-zinc-50 rounded-2xl transition-colors"
                  >
                    Log in or sign up
                  </Link>
                </div>
              ) : (
                /* ------------------------------------------------------------- */
                /* LOGGED IN DROPDOWN MENU                                      */
                /* ------------------------------------------------------------- */
                <div className="space-y-1">
                  <div className="border-b border-zinc-100 px-3.5 py-3 mb-1">
                    <p className="text-sm font-bold text-zinc-900 truncate">{user.name || user.email}</p>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{user.email}</p>
                    <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-800">
                      {role || "USER"}
                    </span>
                  </div>

                  <div className="py-1">
                    {navItems.map((item) => {
                      if (item.requireHost && role !== "HOST" && role !== "ADMIN") return null;
                      if (item.requireAdmin && role !== "ADMIN") return null;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className={`flex items-center px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl transition-colors ${
                            pathname === item.href
                              ? "bg-amber-100 text-amber-950 font-bold"
                              : "text-zinc-800 hover:bg-zinc-50"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>

                  <div className="border-t border-zinc-100 pt-2 mt-1 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setLangModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2 text-xs sm:text-sm font-medium text-zinc-800 hover:bg-zinc-50 rounded-xl transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <span>Languages &amp; currency</span>
                    </button>

                    <LogoutButton variant="menu-item" callbackUrl="/login?logged_out=true">
                      Sign out
                    </LogoutButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* LANGUAGES & CURRENCY MODAL                                    */}
      {/* ------------------------------------------------------------- */}
      {langModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 text-zinc-900 relative animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-5">
              <h3 className="text-lg font-bold text-zinc-900">Languages &amp; currency</h3>
              <button
                type="button"
                onClick={() => setLangModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Language Selection */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">Language</label>
                <div className="grid grid-cols-2 gap-2">
                  {["English (US)", "English (UK)", "Español", "Français", "Deutsch", "Hindi"].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setSelectedLang(lang)}
                      className={`p-3 rounded-2xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                        selectedLang === lang
                          ? "border-amber-400 bg-amber-50 text-amber-950 font-bold"
                          : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency Selection */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">Currency</label>
                <div className="grid grid-cols-3 gap-2">
                  {["USD ($)", "EUR (€)", "GBP (£)", "CAD ($)", "AUD ($)", "INR (₹)"].map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setSelectedCurrency(curr)}
                      className={`p-3 rounded-2xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                        selectedCurrency === curr
                          ? "border-amber-400 bg-amber-50 text-amber-950 font-bold"
                          : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-zinc-100 pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setLangModalOpen(false)}
                className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs px-6 py-2.5 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
