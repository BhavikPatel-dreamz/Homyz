"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";

export function MainHeader() {
  const { data: session } = useSession();
  const user = session?.user;

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

  const defaultAvatar =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBBdiSK8HN6FA3kFyTh0ShlWjVu0iUzWxQO55KIKqSCm1hKrIOJa-ZLQPtnOovhahbWaNp94HT1fwH8XRdXzh2DfxzxhDqlYL2dO3MAGhOxWSL1uhc5pnQ_Fv_KkANfTZMYR3SdluHP8a9W4lBhDMly0-ukCqEURsH4-rOBW3QPzay-7oKDpkX9XjwpkER-YdQrtSye4K1_SW11uyCVS4rf02YGXkMDOr2XN1jG3DGx4V3vOVnqSMqfYg";

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
          <Link
            className="px-5 py-2 rounded-full bg-[#F3D79F] hover:bg-[#ebce92] text-sm font-medium text-gray-800 transition-all shadow-sm whitespace-nowrap"
            href="/host/onboarding"
          >
            Become a host
          </Link>

          {/* Language button */}
          <button
            type="button"
            aria-label="Select Language"
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
            className="flex items-center gap-2 p-1.5 pl-2 border border-gray-200 rounded-full hover:shadow-sm cursor-pointer transition bg-white"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 relative shrink-0">
              <img
                alt="Avatar"
                className="w-full h-full object-cover"
                src={user?.image || defaultAvatar}
              />
            </div>
            <i className="fa-solid fa-bars text-gray-600 text-sm mr-1"></i>
          </button>

          {/* Profile Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-3 w-64 rounded-2xl border border-gray-100 bg-white p-3 shadow-xl z-50 text-gray-800 animate-in fade-in zoom-in-95">
              {user ? (
                <div className="space-y-1">
                  <div className="px-3 py-2 border-b border-gray-100 mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user.name || user.email}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-xl transition"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-xl transition"
                  >
                    Profile Settings
                  </Link>
                  <Link
                    href="/host/listings"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-xl transition"
                  >
                    Host Workspace
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 text-sm font-medium text-[#1F1F1F] hover:bg-gray-50 rounded-xl transition"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/login?mode=signup"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition"
                  >
                    Sign up
                  </Link>
                  <div className="my-1 border-t border-gray-100" />
                  <Link
                    href="/host/onboarding"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-xl transition"
                  >
                    Homyz your home
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
              <h3 className="text-base font-semibold text-gray-900">Language &amp; Region</h3>
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
                  Select Language
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["English (US)", "English (UK)", "Español", "Français", "Deutsch", "Italiano"].map(
                    (lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setSelectedLang(lang)}
                        className={`p-2.5 rounded-xl border text-xs font-medium text-left transition cursor-pointer ${
                          selectedLang === lang
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
                  Select Currency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["USD ($)", "EUR (€)", "GBP (£)", "CAD ($)", "AUD ($)", "INR (₹)"].map(
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
                Save Preferences
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </header>
  );
}
