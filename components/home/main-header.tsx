"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useLanguage } from "@/lib/i18n/language-context";
import { DISPLAY_CURRENCIES, useCurrency } from "@/lib/currency-context";

function GuestMenuLink({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-2 px-1 py-1.5 text-xs transition-colors hover:text-zinc-500">
      {icon && <i className={`fa-solid ${icon} w-3.5 text-center text-[13px]`} aria-hidden="true" />}
      <span className={icon ? undefined : "pl-5.5"}>{label}</span>
    </Link>
  );
}

export function MainHeader() {
  const { data: session, status: sessionStatus } = useSession();
  const user = session?.user;
  const isHost = (user as { role?: string } | undefined)?.role === "HOST" || (user as { role?: string } | undefined)?.role === "ADMIN";
  const sessionLoading = sessionStatus === "loading";
  const { selectedLangLabel, setLanguage, t } = useLanguage();

  const [menuOpen, setMenuOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const { currency: selectedCurrency, setCurrency: setSelectedCurrency } = useCurrency();

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
    <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
        {/* Tagline Left */}
        <div className="w-1/3 flex items-center">
          <span className="tagline-cursive text-gray-800 font-semibold tracking-wide select-none">
            Stay like a homie.
          </span>
        </div>

        {/* Center Logo */}
        <div className="w-1/3 flex items-center justify-center">
          <Link
            className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-[#111111] hover:opacity-90 transition-opacity"
            href="/"
          >
            <svg
              className="w-7 h-7 text-black shrink-0"
              fill="none"
              viewBox="0 0 32 32"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 8V24M6 16H18M18 8V24"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="4.5"
              />
              <circle cx="25" cy="16" fill="currentColor" r="3" />
            </svg>
            <span>homyz</span>
          </Link>
        </div>

        {/* Right Navigation Actions */}
        <div className="w-1/3 flex items-center justify-end gap-3.5 relative" ref={menuRef}>
          {sessionLoading ? (
            <div className="h-9 w-32 animate-pulse rounded-full bg-gray-100" aria-hidden="true" />
          ) : isHost ? (
            <Link
              className="px-5 py-2 rounded-full bg-[#F3D79F] hover:bg-[#ebce92] text-sm font-medium text-gray-800 transition-all shadow-sm whitespace-nowrap"
              href="/host/listings"
            >
              {t("header_switch_hosting") || "Switch to hosting"}
            </Link>
          ) : user ? (
            <Link
              className="px-5 py-2 rounded-full bg-[#F3D79F] hover:bg-[#ebce92] text-sm font-medium text-gray-800 transition-all shadow-sm whitespace-nowrap"
              href="/host/onboarding"
            >
              {t("header_become_a_host") || "Become a host"}
            </Link>
          ) : null}

          {/* Language button */}
          <button
            type="button"
            aria-label={t("header_language") || "Select Language"}
            onClick={() => setLangModalOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition cursor-pointer"
          >
            <i className="fa-solid fa-language text-lg"></i>
          </button>

          {/* User profile badge */}
          <button
            type="button"
            aria-label="User Menu"
            onClick={() => setMenuOpen(!menuOpen)}
            disabled={sessionLoading}
            className="flex items-center gap-2 p-1.5 pl-2 border border-gray-200 rounded-full hover:shadow-sm cursor-pointer transition bg-white"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 relative shrink-0">
              {user?.image ? (
                <img alt="Avatar" className="h-full w-full object-cover" src={user.image} />
              ) : (
                <i className="fa-solid fa-user absolute inset-0 flex items-center justify-center text-[11px] text-gray-500" aria-hidden="true" />
              )}
            </div>
            <i className="fa-solid fa-bars text-gray-600 text-sm mr-1"></i>
          </button>

          {/* Profile Dropdown */}
          {menuOpen && !sessionLoading && (
            <div className="absolute right-0 top-full z-50 mt-3 w-[212px] rounded-xl border border-gray-100 bg-white p-4 shadow-xl text-gray-800 animate-in fade-in zoom-in-95">
              {user ? (
                isHost ? (
                  <div className="space-y-1">
                    <Link href="/host/listings" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">
                      {t("header_host_workspace") || "Host Workspace"}
                    </Link>
                    <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">
                      {t("header_dashboard") || "Dashboard"}
                    </Link>
                    <Link href="/profile" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">
                      Profile
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-1 text-[#1F1F1F]">
                    <div className="space-y-0.5 border-b border-zinc-200 pb-2">
                      <GuestMenuLink href="/profile/tab/saved" icon="fa-heart" label="Wishlists" onClick={() => setMenuOpen(false)} />
                      <GuestMenuLink href="/profile/tab/upcoming" icon="fa-route" label="Trips" onClick={() => setMenuOpen(false)} />
                      <GuestMenuLink href="/profile/tab/support" icon="fa-comment" label="Messages" onClick={() => setMenuOpen(false)} />
                      <GuestMenuLink href="/profile" icon="fa-circle-user" label="Profile" onClick={() => setMenuOpen(false)} />
                    </div>

                    <div className="space-y-0.5 border-b border-zinc-200 py-2">
                      <GuestMenuLink href="/profile/tab/notifications" icon="fa-bell" label="Notifications" onClick={() => setMenuOpen(false)} />
                      <GuestMenuLink href="/profile/tab/account_settings" icon="fa-gear" label="Account settings" onClick={() => setMenuOpen(false)} />
                      <button type="button" onClick={() => { setMenuOpen(false); setLangModalOpen(true); }} className="flex w-full items-center gap-2 px-1 py-1.5 text-left text-xs transition-colors hover:text-zinc-500">
                        <i className="fa-solid fa-globe w-3.5 text-center text-[13px]" aria-hidden="true" />
                        Languages &amp; currency
                      </button>
                      <GuestMenuLink href="/help" icon="fa-circle-question" label="Help Centre" onClick={() => setMenuOpen(false)} />
                    </div>

                    <div className="border-b border-zinc-200 py-2">
                      <Link href="/host/onboarding" onClick={() => setMenuOpen(false)} className="block px-1 py-1.5 transition-colors hover:text-zinc-500">
                        <p className="text-xs font-medium">Become a host</p>
                        <p className="mt-0.5 max-w-[155px] text-[10px] leading-3 text-zinc-500">It&apos;s easy to start hosting and earn extra income.</p>
                      </Link>
                    </div>

                    <div className="space-y-0.5 border-b border-zinc-200 py-2">
                      <GuestMenuLink href="/host/refer" label="Refer a host" onClick={() => setMenuOpen(false)} />
                      <GuestMenuLink href="/host/co-host" label="Find a co-host" onClick={() => setMenuOpen(false)} />
                    </div>

                    <button type="button" onClick={() => { setMenuOpen(false); void signOut({ callbackUrl: "/" }); }} className="w-full px-1 py-1.5 text-left text-xs transition-colors hover:text-zinc-500">
                      Log out
                    </button>
                  </div>
                )
              ) : (
                <div className="space-y-1">
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 text-sm font-medium text-[#1F1F1F] hover:bg-gray-50 rounded-xl transition"
                  >
                    {t("header_log_in") || "Log in"}
                  </Link>
                  <Link
                    href="/login?mode=signup"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition"
                  >
                    {t("header_sign_up") || "Sign up"}
                  </Link>
                  <div className="my-1 border-t border-gray-100" />
                  <Link
                    href="/host/onboarding"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition"
                  >
                    {t("header_homyz_your_home") || "Homyz your home"}
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Language Modal */}
      {langModalOpen && (
        <ModalOverlay className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 text-gray-900 relative">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
              <h3 className="text-base font-semibold text-gray-900">{t("header_languages_currency") || "Language & Region"}</h3>
              <button
                type="button"
                onClick={() => setLangModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  {t("header_language") || "Select Language"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["English (US)", "English (UK)", "Español", "Français", "Deutsch", "Hindi", "العربية"].map(
                    (lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setLanguage(lang)}
                        className={`p-2.5 rounded-xl border text-xs font-medium text-left transition cursor-pointer ${
                          selectedLangLabel === lang
                            ? "border-amber-400 bg-amber-50 text-amber-950 font-semibold"
                            : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                        }`}
                      >
                        {lang}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  {t("header_currency") || "Select Currency"}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DISPLAY_CURRENCIES.map(
                    (curr) => (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => setSelectedCurrency(curr)}
                        className={`p-2.5 rounded-xl border text-xs font-medium text-center transition cursor-pointer ${
                          selectedCurrency === curr
                            ? "border-amber-400 bg-amber-50 text-amber-950 font-semibold"
                            : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                        }`}
                      >
                        {curr}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-gray-100 pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setLangModalOpen(false)}
                className="rounded-full bg-gray-900 hover:bg-gray-800 text-white font-medium text-xs px-6 py-2.5 transition cursor-pointer"
              >
                {t("header_done") || "Save Preferences"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </header>
  );
}
