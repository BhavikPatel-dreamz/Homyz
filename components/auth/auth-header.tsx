"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { HomyzLogo } from "../ui/homyz-logo";

export function AuthHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="w-full bg-white border-b border-zinc-200/80 sticky top-0 z-50">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-8 py-3.5 relative">
        {/* Left: Handwritten brand slogan */}
        <Link href="/" className="font-['Caveat'] text-2xl sm:text-3xl font-bold text-zinc-900 tracking-wide hover:opacity-90 transition-opacity select-none">
          Stay like a homie.
        </Link>

        {/* Center: Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group absolute left-1/2 -translate-x-1/2">
          <HomyzLogo className="text-zinc-950 group-hover:scale-105 transition-transform shrink-0" size={28} />
          <span className="text-xl font-extrabold tracking-tight text-zinc-900">
            homyz
          </span>
        </Link>

        {/* Right: Actions (logged-out variant) */}
        <div className="flex items-center gap-2.5 sm:gap-3">
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

          {/* Menu Hamburger Button (≡) */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Menu"
          >
            <svg className="w-4 h-4 text-zinc-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {menuOpen && (
        <div className="border-t border-zinc-100 bg-white px-4 py-4 shadow-lg sm:px-6">
          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-zinc-900 hover:text-zinc-600"
            >
              Log in / Sign up
            </Link>
            <Link
              href="/register"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-zinc-900 hover:text-zinc-600"
            >
              Become a host
            </Link>
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-amber-800 hover:text-amber-900"
            >
              Admin Portal
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
