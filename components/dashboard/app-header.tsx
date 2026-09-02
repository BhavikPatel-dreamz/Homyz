"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LogoutButton } from "@/components/admin/logout-button";
import { primaryButtonInteractionClass } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function AppHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user ?? null;
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
    <header className="sticky top-0 z-40 w-full bg-white text-zinc-900" suppressHydrationWarning>
      <Container>
        <div className="header-wrapper border-b border-[#1F1F1F]/900 w-full relative flex items-center justify-between py-5 lg:py-6">
          <Link href="/" className="hidden shrink-0 transition-opacity hover:opacity-80 md:block">
            <Image src="/images/brand/homyz-logo-dark-v2.svg" alt="Stay like a homie." width={200} height={53} className="h-auto w-[180px] xl:w-[200px]" priority />
          </Link>

          <Link href="/dashboard" className="group absolute left-1/2 -translate-x-1/2">
            <Image src="/images/brand/homyz-logo-dark-v1.svg" alt="Homyz" width={199} height={72} className="h-auto w-[130px] transition-transform group-hover:scale-[1.03] sm:w-[150px] lg:w-[166px]" priority />
          </Link>

          <div className="ml-auto flex items-center gap-2.5 sm:gap-3" ref={menuRef}>
            <Link href={role === "HOST" ? "/host/listings" : "/host/onboarding"} className={`hidden shrink-0 whitespace-nowrap rounded-full bg-[#FCDF9C] px-6 py-3 text-base font-medium text-[#1F1F1F] transition-colors lg:inline-flex ${primaryButtonInteractionClass}`}>
              {role === "HOST" ? "Switch to hosting" : "Become a host"}
            </Link>

            {user ? (
              <Link href="/profile" className="relative hidden h-9 w-9 shrink-0 overflow-hidden rounded-full transition-opacity hover:opacity-80 md:block" title="Profile">
                <Image src={user.image || "/images/header-user-avatar.jpg"} alt={user.name || "User avatar"} fill className="object-cover" sizes="36px" priority />
              </Link>
            ) : (
              <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="relative hidden h-9 w-9 shrink-0 overflow-hidden rounded-full transition-opacity hover:opacity-80 md:block" title="Account">
                <Image src="/images/header-user-avatar.jpg" alt="Account" fill className="object-cover" sizes="36px" priority />
              </button>
            )}

            <button type="button" onClick={() => setLangModalOpen(!langModalOpen)} className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F4F5] transition-colors hover:bg-zinc-200 sm:flex" title="Language" aria-label="Choose language and currency">
              <Image src="/images/icons/translate-icon.svg" alt="" width={24} height={24} className="h-6 w-6" />
            </button>

            <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F4F5] transition-colors hover:bg-zinc-200" aria-label="Open menu" aria-expanded={menuOpen}>
              <Image src="/images/icons/menu-icon.svg" alt="" width={16} height={14} className="h-[14px] w-4" />
            </button>

            {/* Dropdown Menu Container (Positioned below header, fully scrollable to avoid cut-off) */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2.5 w-72 sm:w-80 rounded-3xl border border-zinc-200/80 bg-white p-3.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 text-zinc-900 max-h-[calc(100vh-80px)] overflow-y-auto">
                {!user ? (
                  /* ------------------------------------------------------------- */
                  /* LOGGED OUT DROPDOWN MENU (100% Matches Reference Screenshot 3)*/
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

                    {/* Become a host Card Banner with Host Illustration */}
                    <Link
                      href="/host/onboarding"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 hover:bg-zinc-100/90 border border-zinc-200/60 transition-all group cursor-pointer"
                    >
                      <div className="pr-2">
                        <p className="text-sm font-bold text-zinc-900 group-hover:text-amber-600 transition-colors">Become a host</p>
                        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">It&apos;s easy to start hosting and earn extra income.</p>
                      </div>
                      {/* Host Illustration matching Screenshot 3 */}
                      <div className="w-12 h-14 flex items-center justify-center shrink-0">
                        <svg className="w-10 h-12 shrink-0" viewBox="0 0 40 48" fill="none">
                          <circle cx="20" cy="10" r="5" fill="#8D5B4C" />
                          <circle cx="20" cy="9" r="4" fill="#FFCDB2" />
                          <path d="M14 17C14 15.5 16.5 15 20 15C23.5 15 26 15.5 26 17L27 28H13L14 17Z" fill="#C84B31" />
                          <path d="M26 18L32 14C33 13.5 34 14.5 33.5 15.5L30 22L27 20Z" fill="#C84B31" />
                          <path d="M14 28H19V44H15V28Z" fill="#3D405B" />
                          <path d="M21 28H26V44H22V28Z" fill="#3D405B" />
                          <rect x="14" y="44" width="5" height="3" rx="1.5" fill="#2B2D42" />
                          <rect x="21" y="44" width="5" height="3" rx="1.5" fill="#2B2D42" />
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
                            className={`flex items-center px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl transition-colors ${pathname === item.href
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
      </Container>

      {/* ------------------------------------------------------------- */}
      {/* LANGUAGES & CURRENCY MODAL (Screen Centered Overlay)          */}
      {/* ------------------------------------------------------------- */}
      {langModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 text-zinc-900 relative animate-in zoom-in-95 my-auto mx-auto">
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
                      className={`p-3 rounded-2xl border text-xs font-semibold text-left transition-all cursor-pointer ${selectedLang === lang
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
                      className={`p-3 rounded-2xl border text-xs font-semibold text-center transition-all cursor-pointer ${selectedCurrency === curr
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
