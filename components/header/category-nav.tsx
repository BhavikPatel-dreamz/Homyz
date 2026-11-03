"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";

interface NavCategory {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  isActive: boolean;
  isAvailable: boolean;
  badge?: string;
}

export function CategoryNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const isHomeOrListings = pathname === "/" || pathname?.startsWith("/listings");

  const categories: NavCategory[] = [
    {
      id: "homes",
      label: t("header_category_homes", "Homes"),
      href: "/",
      isActive: isHomeOrListings,
      isAvailable: true,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
          <path d="M9 21V12h6v9" />
        </svg>
      ),
    },
    {
      id: "experiences",
      label: t("header_category_experiences", "Experiences"),
      href: "#",
      isActive: false,
      isAvailable: false,
      badge: "Soon",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      ),
    },
    {
      id: "services",
      label: t("header_category_services", "Services"),
      href: "#",
      isActive: false,
      isAvailable: false,
      badge: "Soon",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    },
  ];

  const visibleCategories = mobile ? categories.filter((category) => category.isAvailable) : categories;

  return (
    <nav
      aria-label="Categories"
      className={mobile
        ? "no-scrollbar flex w-full items-center gap-2 overflow-x-auto overscroll-x-contain px-4 pb-2.5"
        : "hidden lg:flex items-center justify-center gap-6 lg:gap-8"}
    >
      {visibleCategories.map((cat) => {
        if (!cat.isAvailable) {
          return (
            <div
              key={cat.id}
              title="Coming soon"
              className="group flex flex-col items-center gap-1.5 py-1 text-zinc-400 cursor-not-allowed select-none opacity-60 transition-opacity hover:opacity-80"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400">{cat.icon}</span>
                <span className="text-sm font-medium text-zinc-400">{cat.label}</span>
                {cat.badge && (
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                    {cat.badge}
                  </span>
                )}
              </div>
            </div>
          );
        }

        return mobile ? (
          <Link
            key={cat.id}
            href={cat.href}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
              cat.isActive
                ? "border-zinc-300 bg-white font-medium text-[#1F1F1F] shadow-[0_2px_7px_rgba(0,0,0,0.12)]"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
            }`}
          >
            <span className="size-4">{cat.icon}</span>
            <span>{cat.label}</span>
          </Link>
        ) : (
          <Link
            key={cat.id}
            href={cat.href}
            className={`group relative flex flex-col items-center gap-1.5 py-1 text-sm transition-colors duration-200 outline-none ${
              cat.isActive
                ? "font-medium text-[#1F1F1F]"
                : "font-normal text-zinc-600 hover:text-[#1F1F1F]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`transition-transform duration-200 group-hover:scale-105 ${cat.isActive ? "text-[#1F1F1F]" : "text-zinc-500"}`}>
                {cat.icon}
              </span>
              <span className="font-medium">{cat.label}</span>
            </div>
            {/* Active underline indicator */}
            {cat.isActive && (
              <span
                aria-hidden="true"
                className="absolute -bottom-2.5 h-[2px] w-full rounded-full bg-[#1F1F1F] transition-all duration-300"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
