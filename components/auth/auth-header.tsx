"use client";

import Link from "next/link";
import { useState } from "react";

export function AuthHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="w-full bg-white border-b border-zinc-200/80 sticky top-0 z-50">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 flex items-center justify-center text-zinc-900">
              <svg viewBox="0 0 32 32" className="w-7 h-7 fill-current" aria-hidden="true">
                <path d="M8 6a2 2 0 0 1 2 2v6h12V8a2 2 0 1 1 4 0v16a2 2 0 1 1-4 0v-6H10v6a2 2 0 1 1-4 0V8a2 2 0 0 1 2-2z" />
                <circle cx="16" cy="11" r="3" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Center: Main Logo on desktop */}
        <div className="hidden md:flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <svg viewBox="0 0 32 32" className="w-7 h-7 fill-zinc-900" aria-hidden="true">
              <path d="M6 10a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10zm12-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V6z" />
            </svg>
            <span className="text-xl font-bold tracking-tight text-zinc-900">
              homyz
            </span>
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/register"
            className="hidden sm:inline-flex items-center justify-center rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] px-5 py-2 text-xs font-semibold text-zinc-900 transition-colors shadow-2xs"
          >
            Become a host
          </Link>

          {/* User Icon button */}
          <Link
            href="/login"
            className="hidden md:flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors"
            title="Profile"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </Link>

          {/* Language selector */}
          <button
            type="button"
            className="hidden md:flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors"
            title="Select Language"
          >
            <span className="text-xs font-medium">文A</span>
          </button>

          {/* Hamburger Menu button */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 hover:border-zinc-300 text-zinc-800 hover:bg-zinc-50 transition-colors"
            aria-label="Menu"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
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
              href="/admin/login"
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
