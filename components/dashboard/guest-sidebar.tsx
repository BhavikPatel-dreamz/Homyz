"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

export {
  GUEST_NAV_ITEMS,
  normalizeTabId,
  extractTabFromQuery,
  extractSubTabFromQuery,
  extractProfileRoute,
  parseProfilePathname,
  PROFILE_MGMT_SUB_TABS,
  normalizeMgmtSubTab,
  getMgmtSubTabSlug,
  getMgmtSubTabHref,
  getProfileTabHref,
} from "@/lib/profile/tab-utils";
export type {
  ProfileMgmtSubTab,
  ProfileMgmtSubTabItem,
  ParsedProfileRoute,
} from "@/lib/profile/tab-utils";
import {
  GUEST_NAV_ITEMS,
  normalizeTabId,
} from "@/lib/profile/tab-utils";

import { useLanguage, type TranslationKey } from "@/lib/i18n/language-context";

const NAV_ITEM_KEY_MAP: Record<string, TranslationKey> = {
  about_me: "profile_nav_about_me",
  upcoming_trips: "profile_nav_upcoming_trips",
  past_bookings: "profile_nav_past_bookings",
  invite: "profile_nav_invite_earn",
  saved: "profile_nav_saved_listings",
  profile_management: "profile_nav_profile_management",
  account_settings: "profile_nav_account_settings",
  support: "profile_nav_support",
  notifications: "profile_nav_notifications",
};

export function GuestDashboardSidebar({
  activeId,
  onSelectTab,
  avatarUrl,
}: {
  activeId: string;
  onSelectTab?: (tabId: string) => void;
  avatarUrl?: string | null;
}) {
  const currentActive = normalizeTabId(activeId);
  const { t } = useLanguage();

  return (
    <aside className="order-2 w-full shrink-0 lg:order-1 lg:w-[300px] xl:w-[452px]">
      <h1 className="mb-7 hidden tracking-[-0.02em] text-[#1F1F1F] lg:block xl:mb-10">
        {t("profile_nav_my_profile", "My profile")}
      </h1>

      <nav className="mobile-guest-grid grid md:grid-cols-3 grid-cols-2 gap-1.5 lg:block lg:mt-3 mt-5">
        {GUEST_NAV_ITEMS.map((item, index) => {
          const isActive = item.id === currentActive;
          const precedesActive = GUEST_NAV_ITEMS[index + 1]?.id === currentActive;
          const translatedLabel = NAV_ITEM_KEY_MAP[item.id]
            ? t(NAV_ITEM_KEY_MAP[item.id], item.label)
            : item.label;

          return (
            <Link
              key={item.id}
              href={item.href}
              scroll={false}
              aria-current={isActive ? "page" : undefined}
              onClick={(e) => {
                if (onSelectTab) {
                  e.preventDefault();
                  onSelectTab(item.id);
                }
              }}
              className={`group relative isolate min-h-[142px] flex flex-col items-center justify-center gap-2 rounded-lg border border-[#E5E5E5] px-2 py-4 text-center text-[16px] leading-5 font-normal shadow-[0_1px_3px_rgba(0,0,0,0.18)] transition-colors lg:h-[72px] lg:min-h-0 lg:w-full lg:flex-row lg:justify-start lg:gap-5 lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-b lg:border-[#D7D7D7] lg:px-0 lg:py-0 lg:text-left lg:text-[15px] lg:leading-6 lg:font-medium lg:shadow-none xl:h-[88px] xl:gap-6 xl:text-[20px] xl:leading-7 ${
                isActive
                  ? "bg-[#FCDF9C] text-[#1F1F1F] lg:bg-transparent lg:border-b-transparent"
                  : `bg-white text-[#1F1F1F] hover:bg-[#FFF8E8] lg:bg-transparent lg:hover:bg-transparent ${precedesActive ? "lg:border-b-transparent" : ""}`
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-6 right-0 -z-10 hidden rounded-l-[6px] rounded-r-[30px] bg-[#FCDF9C] transition-opacity lg:block xl:left-8 ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
              <div
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-[#1F1F1F] transition-colors lg:h-12 lg:w-12 xl:h-16 xl:w-16 ${
                  isActive
                    ? "bg-[#FCDF9C] ring-4 ring-white"
                    : "bg-white"
                }`}
              >
                {item.id === "about_me" ? (
                  <span className={`relative flex items-center justify-center overflow-hidden rounded-full border border-[#1F1F1F] ${isActive ? "h-full w-full" : "h-10 w-10"}`}>
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt="About me"
                        fill
                        sizes={isActive ? "(min-width: 1280px) 64px, (min-width: 1024px) 48px, 40px" : "40px"}
                        className="object-cover"
                      />
                    ) : (
                      <svg className="h-1/2 w-1/2 text-zinc-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    )}
                  </span>
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1F1F1F]">
                    <Image
                      src={item.image}
                      alt=""
                      width={24}
                      height={24}
                      className="h-6 w-6 object-contain"
                    />
                  </span>
                )}
              </div>
              <span className="max-w-[120px] whitespace-normal lg:max-w-none lg:truncate lg:whitespace-nowrap">{translatedLabel}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
