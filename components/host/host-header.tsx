"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { HomyzLogo } from "../ui/homyz-logo";
import { Container } from "@/components/ui/container";

export interface HostHeaderProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

const LANGUAGES = [
  { code: "en", name: "English (US)", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "hi", name: "Hindi (हिंदी)", flag: "🇮🇳" },
  { code: "zh", name: "Chinese (中文)", flag: "🇨🇳" },
  { code: "ja", name: "Japanese (日本語)", flag: "🇯🇵" },
];

export function HostHeader({ user }: HostHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(LANGUAGES[0]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  function triggerToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  function handleSwitchToTraveling() {
    triggerToast("Switching to Traveler Mode…");
    setTimeout(() => {
      router.push("/");
    }, 400);
  }

  function handleSelectLang(lang: typeof LANGUAGES[0]) {
    setCurrentLang(lang);
    setLangModalOpen(false);
    triggerToast(`Language updated to ${lang.name}`);
  }

  function handleLogout() {
    setMenuOpen(false);
    triggerToast("Logging out…");
    setTimeout(() => {
      router.push("/admin/login?logged_out=true");
    }, 500);
  }

  return (
    <>
      {/* ── STICKY HEADER BAR ── */}
      <header className="w-full border-b border-zinc-200/80 bg-white sticky top-0 z-40 relative font-sans">
        <Container className="flex items-center justify-between py-3.5 relative">
        {/* Left: Tagline in Cursive / Handwriting font */}
        <Link
          href="/"
          className="font-script text-2xl sm:text-3xl font-bold text-zinc-900 tracking-wide hover:opacity-90 transition-opacity select-none"
        >
          Stay like a homie.
        </Link>

        {/* Center: Homyz Brand Logo */}
        <Link
          href="/host/listings"
          className="flex items-center gap-2 hover:opacity-90 transition-all absolute left-1/2 -translate-x-1/2 group"
        >
          <HomyzLogo className="text-zinc-950 group-hover:scale-105 transition-transform shrink-0" size={28} />
          <span className="text-xl font-extrabold tracking-tight text-zinc-950 font-sans">
            homyz
          </span>
        </Link>

        {/* Right: Controls & Options (100% Reference UI Parity) */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Yellow Switch to Traveling Pill Button */}
          <button
            type="button"
            onClick={handleSwitchToTraveling}
            className="rounded-full bg-[#FDE29B] hover:bg-[#FCD885] text-zinc-900 font-normal text-sm sm:text-base px-6 py-2.5 sm:px-7 sm:py-3 transition-all cursor-pointer select-none"
          >
            switch to traveling
          </button>

          {/* Profile Avatar */}
          <div
            onClick={() => setProfileModalOpen(true)}
            className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
            title="View Host Profile"
          >
            <Image
              src={user?.image || "/images/header-user-avatar.jpg"}
              alt={user?.name || "Host Avatar"}
              fill
              className="object-cover"
              sizes="40px"
              priority
            />
          </div>

          {/* Language Icon Button (文A) */}
          <button
            type="button"
            onClick={() => setLangModalOpen(true)}
            className="w-10 h-10 rounded-full bg-[#F3F4F6] hover:bg-zinc-200/80 text-zinc-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Change Language"
          >
            <span className="font-sans font-medium text-xs tracking-tighter flex items-center justify-center">
              <span className="text-[13px] leading-none">文</span>
              <span className="text-[10px] font-bold leading-none -ml-0.5 transform translate-y-0.5">A</span>
            </span>
          </button>

          {/* Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-10 h-10 rounded-full bg-[#F3F4F6] hover:bg-zinc-200/80 text-zinc-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Menu"
          >
            <svg className="w-5 h-5 text-zinc-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>
        </Container>
      </header>

      {/* ── TOAST NOTIFICATION ── */}
      {toastMsg && (
        <div className="fixed top-16 right-6 z-50 px-4 py-2.5 rounded-2xl bg-zinc-900 text-white text-xs font-bold shadow-xl animate-in fade-in slide-in-from-top-2">
          {toastMsg}
        </div>
      )}

      {/* ── HAMBURGER DROPDOWN MENU ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-2xs" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute top-16 right-6 w-72 rounded-3xl bg-white p-3 shadow-2xl border border-zinc-200 space-y-1 animate-in zoom-in-95 duration-150 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-zinc-100 mb-1">
              <p className="text-xs font-bold text-zinc-900">{user?.name || "Host User"}</p>
              <p className="text-[11px] text-zinc-500 truncate">{user?.email || "host@homyz.com"}</p>
            </div>

            {/* Nav Items */}
            <Link
              href="/host/today"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                pathname === "/host/today" ? "bg-amber-50 text-amber-900" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <span>📋</span> Today
            </Link>

            <Link
              href="/host/calendar"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                pathname === "/host/calendar" ? "bg-amber-50 text-amber-900" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <span>📅</span> Calendar
            </Link>

            <Link
              href="/host/listings"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                pathname === "/host/listings" ? "bg-amber-50 text-amber-900" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <span>📑</span> Your Listings
            </Link>

            <Link
              href="/host/messages"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                pathname === "/host/messages" ? "bg-amber-50 text-amber-900" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <span>💬</span> Messages
            </Link>

            <div className="border-t border-zinc-100 my-1"></div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setProfileModalOpen(true);
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-all text-left"
            >
              <span>👤</span> Host Profile
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                handleSwitchToTraveling();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-all text-left"
            >
              <span>✈️</span> Switch to Traveling
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                triggerToast("Opening Help Center…");
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition-all text-left"
            >
              <span>❓</span> Help & Support
            </button>

            <div className="border-t border-zinc-100 my-1"></div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all text-left"
            >
              <span>🚪</span> Log Out
            </button>
          </div>
        </div>
      )}

      {/* ── LANGUAGE SELECTION MODAL ── */}
      {langModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-zinc-200 font-sans">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-900">Choose Language</h3>
              <button
                type="button"
                onClick={() => setLangModalOpen(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-500 hover:text-zinc-900 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelectLang(lang)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    currentLang.code === lang.code
                      ? "bg-amber-100 text-amber-950 border border-amber-300"
                      : "hover:bg-zinc-100 text-zinc-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span> {lang.name}
                  </span>
                  {currentLang.code === lang.code && <span className="text-xs">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── HOST PROFILE MODAL ── */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-5 border border-zinc-200 font-sans">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-900">Host Profile</h3>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-500 hover:text-zinc-900 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
              <div className="w-14 h-14 rounded-full bg-amber-400 text-zinc-950 font-black flex items-center justify-center text-xl shadow-xs">
                {user?.name?.slice(0, 1) || "H"}
              </div>
              <div>
                <h4 className="font-bold text-sm text-zinc-900">{user?.name || "Homyz Host User"}</h4>
                <p className="text-xs text-zinc-500">{user?.email || "host@homyz.com"}</p>
                <span className="inline-block mt-1 text-[10px] font-bold bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full">
                  Verified Host
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setProfileModalOpen(false);
                  router.push("/host/listings");
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 transition-all text-center"
              >
                Manage My Properties
              </button>
              <button
                type="button"
                onClick={() => {
                  setProfileModalOpen(false);
                  handleSwitchToTraveling();
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#FEE08B] text-zinc-950 font-bold hover:bg-[#FDE047] transition-all text-center"
              >
                Switch to Traveling Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
