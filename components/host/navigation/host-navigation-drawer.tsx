"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";
import { HostDrawerNotifications } from "./host-drawer-notifications";

export type HostDrawerView = "MENU" | "NOTIFICATIONS";
export { HostDrawerNotifications };

const drawerNavigationItemBaseClass =
  "flex min-h-12 w-full items-center rounded-xl px-3.5 py-2 text-base font-medium leading-5 transition cursor-pointer text-left md:text-[15px]";
const drawerNavigationItemActiveClass =
  "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-white";
const drawerNavigationItemInactiveClass =
  "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/60 dark:hover:text-white";
const drawerNavigationContentClass = "flex min-w-0 items-center gap-3";
const drawerNavigationIconClass = "size-5 shrink-0 text-zinc-600 dark:text-zinc-400";

function drawerNavigationItemClass(isActive: boolean): string {
  return `${drawerNavigationItemBaseClass} justify-between ${
    isActive ? drawerNavigationItemActiveClass : drawerNavigationItemInactiveClass
  }`;
}

export interface HostNavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  } | null;
  unreadCount?: number | null;
  onOpenLanguagesCurrency: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DRAWER HEADER
// ─────────────────────────────────────────────────────────────────────────────
export interface DrawerHeaderProps {
  onClose: () => void;
  unreadCount?: number | null;
  onNotificationsClick?: () => void;
  view?: HostDrawerView;
  onBackToMenu?: () => void;
}

export function DrawerHeader({
  onClose,
  unreadCount,
  onNotificationsClick,
  view = "MENU",
  onBackToMenu,
}: DrawerHeaderProps) {
  if (view === "NOTIFICATIONS") {
    return (
      <div className="flex items-center justify-between px-6 sm:px-7 pt-6 sm:pt-7 pb-4 shrink-0 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          {/* Back button returning to Menu */}
          <button
            type="button"
            onClick={onBackToMenu}
            className="size-10 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition cursor-pointer -ml-2 shrink-0"
            aria-label="Back to host menu"
            title="Back to menu"
          >
            <svg
              className="size-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>

          <h2
            id="host-drawer-heading"
            className="text-2xl sm:text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100 truncate"
          >
            Notifications
          </h2>

          {unreadCount !== null && unreadCount !== undefined && unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-medium text-white shadow-2xs shrink-0"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>

        {/* Circular Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="size-10 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition cursor-pointer shrink-0 ml-2"
          aria-label="Close menu"
          title="Close menu"
        >
          <svg
            className="size-4.5 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-6 sm:px-7 pt-6 sm:pt-7 pb-4 shrink-0">
      <h2
        id="host-drawer-heading"
        className="text-2xl sm:text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100"
      >
        Menu
      </h2>

      <div className="flex items-center gap-2">
        {/* Notifications Icon Button */}
        <button
          type="button"
          onClick={onNotificationsClick}
          className="relative size-10 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
          aria-label={
            unreadCount && unreadCount > 0
              ? `${unreadCount} unread notifications`
              : "Notifications"
          }
          title="Notifications"
        >
          <svg
            className="size-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {unreadCount !== null && unreadCount !== undefined && unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-medium text-white shadow-2xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Circular Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="size-10 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
          aria-label="Close menu"
          title="Close menu"
        >
          <svg
            className="size-4.5 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DRAWER USER PROFILE SECTION
// ─────────────────────────────────────────────────────────────────────────────
export interface DrawerProfileProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  } | null;
  onClick: () => void;
}

export function DrawerProfile({ user, onClick }: DrawerProfileProps) {
  const [avatarError, setAvatarError] = useState(false);
  const displayName = user?.name || user?.email || "Host";
  const displayEmail = user?.email || "";
  const roleName = user?.role || "HOST";

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/60 p-4 flex items-center justify-between gap-3 hover:bg-zinc-100/70 dark:hover:bg-zinc-800 transition cursor-pointer group"
      aria-label={`View profile for ${displayName}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Avatar */}
        <div className="size-11 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0 relative flex items-center justify-center border border-zinc-200/80 dark:border-zinc-600">
          {user?.image && !avatarError ? (
            <Image
              src={user.image}
              alt={displayName}
              fill
              className="object-cover"
              sizes="44px"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300 uppercase">
              {displayName.charAt(0) || "H"}
            </span>
          )}
        </div>

        {/* Name and Email */}
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-black dark:group-hover:text-white transition-colors">
            {displayName}
          </p>
          {displayEmail && (
            <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
              {displayEmail}
            </p>
          )}
        </div>
      </div>

      {/* Role Badge */}
      <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 px-2.5 py-0.5 text-[11px] font-medium shrink-0">
        {roleName}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. OPTIONAL HOST RESOURCES CARD (Airbnb Inspired Promotional Card)
// ─────────────────────────────────────────────────────────────────────────────
export interface HostResourcesCardProps {
  onGetStarted: () => void;
  onSwitchTraveling?: () => void;
}

export function HostResourcesCard({ onGetStarted, onSwitchTraveling }: HostResourcesCardProps) {
  // Get started link to /host/onboarding for new hosts
  const handleSwitchTraveling = onSwitchTraveling ?? onGetStarted;

  return (
    <div className="rounded-[22px] border border-[#E7E2DA] bg-[#F5F3EF] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.04)]">
      <div className="relative mx-auto mb-4 flex h-[116px] w-full max-w-[270px] items-center justify-center">
        <div className="absolute left-2 top-5 h-[88px] w-[90px] overflow-hidden rounded-[18px] border border-white/80 shadow-[0_12px_24px_rgba(0,0,0,0.12)] -rotate-12 bg-zinc-200">
          <Image
            src="/images/listing/listing-img-01.png"
            alt=""
            fill
            className="object-cover"
            sizes="90px"
            unoptimized
          />
        </div>

        <div className="relative z-10 h-[104px] w-[94px] overflow-hidden rounded-[18px] border border-white/80 shadow-[0_18px_28px_rgba(0,0,0,0.14)] bg-zinc-200">
          <Image
            src="/images/listing/listing-img-02.png"
            alt=""
            fill
            className="object-cover"
            sizes="94px"
            unoptimized
          />
        </div>

        <div className="absolute right-2 top-5 h-[88px] w-[90px] overflow-hidden rounded-[18px] border border-white/80 shadow-[0_12px_24px_rgba(0,0,0,0.12)] rotate-12 bg-zinc-200">
          <Image
            src="/images/listing/listing-img-03.png"
            alt=""
            fill
            className="object-cover"
            sizes="90px"
            unoptimized
          />
        </div>
      </div>

      <div className="text-center">
        <p className="text-[18px] font-medium leading-6 tracking-[-0.02em] text-zinc-900">
          New to hosting?
        </p>
        <p className="mx-auto mt-1 max-w-[245px] text-[14px] font-normal leading-5 text-zinc-600">
          Discover helpful tips and best practices to welcome your first guests.
        </p>
      </div>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={handleSwitchTraveling}
          className="inline-flex h-[48px] items-center justify-center gap-2 rounded-full bg-[#1F1F1F] px-6 text-[14px] font-medium text-white shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition hover:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-zinc-300 cursor-pointer"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="size-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 3l4 4-4 4M20 7H9a5 5 0 0 0-5 5v1m-4 8 4-4-4-4m4 4h11a5 5 0 0 0 5-5v-1" />
          </svg>
          <span>Switch to Travelling</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DRAWER NAVIGATION LIST
// ─────────────────────────────────────────────────────────────────────────────
export interface DrawerNavigationProps {
  currentPath: string;
  onNavigate: (href: string) => void;
  onOpenLanguagesCurrency: () => void;
  unreadCount?: number | null;
  isAdmin?: boolean;
}

export function DrawerNavigation({
  currentPath,
  onNavigate,
  onOpenLanguagesCurrency,
  unreadCount,
  isAdmin = false,
}: DrawerNavigationProps) {
  const isDashboardActive = currentPath === "/host/dashboard";
  const isEarningsActive = currentPath.startsWith("/host/earnings");
  const isInsightsActive = currentPath.startsWith("/host/insights");
  const isSupportActive =
    currentPath.startsWith("/host/support") ||
    currentPath.startsWith("/host/resolution-center");
  const isProfileActive = currentPath === "/profile";
  const isNotificationsActive = currentPath.startsWith("/profile/tab/notifications");
  const isSettingsActive = currentPath.startsWith("/host/account-settings");
  const isCoHostActive = currentPath.startsWith("/host/co-host");
  const isReferActive = currentPath.startsWith("/host/refer");
  const isAdminActive = currentPath.startsWith("/admin");
  const isTodayActive = currentPath === "/host/today" || currentPath.startsWith("/host/today/");
  const isCalendarActive = currentPath === "/host/calendar" || currentPath.startsWith("/host/calendar/");
  const isListingsActive = currentPath === "/host/listings" || currentPath.startsWith("/host/listings/");
  const isMessagesActive = currentPath === "/host/messages" || currentPath.startsWith("/host/messages/");

  return (
    <nav className="space-y-1 py-1" aria-label="Host navigation items">
      {/* <button type="button" onClick={() => onNavigate("/host/today")} className={drawerNavigationItemClass(isTodayActive)}>
        <div className={drawerNavigationContentClass}>
          <svg className={drawerNavigationIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
          </svg>
          <span className="min-w-0">Today</span>
        </div>
      </button>

      <button type="button" onClick={() => onNavigate("/host/calendar")} className={drawerNavigationItemClass(isCalendarActive)}>
        <div className={drawerNavigationContentClass}>
          <svg className={drawerNavigationIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 3v4M8 3v4M3 10h18" />
          </svg>
          <span className="min-w-0">Calendar</span>
        </div>
      </button>

      <button type="button" onClick={() => onNavigate("/host/listings")} className={drawerNavigationItemClass(isListingsActive)}>
        <div className={drawerNavigationContentClass}>
          <svg className={drawerNavigationIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
          </svg>
          <span className="min-w-0">Listings</span>
        </div>
      </button>

      <button type="button" onClick={() => onNavigate("/host/messages")} className={drawerNavigationItemClass(isMessagesActive)}>
        <div className={drawerNavigationContentClass}>
          <svg className={drawerNavigationIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-5.5a7.5 7.5 0 1 1 17-4z" />
          </svg>
          <span className="min-w-0">Messages</span>
        </div>
      </button> */}

      <div className="my-2 border-t border-zinc-100 dark:border-zinc-800/80" />

      {/* 1. Dashboard */}
      <button
        type="button"
        onClick={() => onNavigate("/host/dashboard")}
        className={drawerNavigationItemClass(isDashboardActive)}
      >
        <div className={drawerNavigationContentClass}>
          <svg className={drawerNavigationIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V9m6 10V5m6 14v-7m4 7H2" />
          </svg>
          <span className="min-w-0">Dashboard</span>
        </div>
      </button>

      {/* 2. Earnings */}
      <button
        type="button"
        onClick={() => onNavigate("/host/earnings")}
        className={drawerNavigationItemClass(isEarningsActive)}
      >
        <div className={drawerNavigationContentClass}>
          <svg className={drawerNavigationIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <rect width="20" height="14" x="2" y="5" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="2" x2="22" y1="10" y2="10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="min-w-0">Earnings</span>
        </div>
      </button>

      {/* 3. Insights */}
      <button
        type="button"
        onClick={() => onNavigate("/host/insights")}
        className={drawerNavigationItemClass(isInsightsActive)}
      >
        <div className={drawerNavigationContentClass}>
          <svg className={drawerNavigationIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-5 5-4-4-3 3" />
          </svg>
          <span className="min-w-0">Insights</span>
        </div>
      </button>

      {/* 4. Help & Resolution Center */}
      <button
        type="button"
        onClick={() => onNavigate("/host/support")}
        className={drawerNavigationItemClass(isSupportActive)}
      >
        <div className={drawerNavigationContentClass}>
          <svg className={drawerNavigationIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="min-w-0">Help &amp; Resolution Center</span>
        </div>
      </button>

      {/* 5. Profile */}
      {/* <button
        type="button"
        onClick={() => onNavigate("/profile")}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition cursor-pointer text-left ${
          isProfileActive
            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white font-medium"
            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-950 dark:hover:text-white font-normal"
        }`}
      >
        <div className="flex items-center gap-3.5">
          <svg className="size-5 shrink-0 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>Profile</span>
        </div>
      </button> */}

      {/* 6. Notifications */}
      {/* <button
        type="button"
        onClick={() => onNavigate("/profile/tab/notifications")}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition cursor-pointer text-left ${
          isNotificationsActive
            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white font-medium"
            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-950 dark:hover:text-white font-normal"
        }`}
      >
        <div className="flex items-center gap-3.5">
          <svg className="size-5 shrink-0 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span>Notifications</span>
        </div>
        {unreadCount !== null && unreadCount !== undefined && unreadCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-medium text-white shadow-2xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button> */}

      {/* 7. Account settings */}
      <button
        type="button"
        onClick={() => onNavigate("/host/account-settings")}
        className={drawerNavigationItemClass(isSettingsActive)}
      >
        <div className={drawerNavigationContentClass}>
          <svg className={drawerNavigationIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="min-w-0">Account settings</span>
        </div>
      </button>

      {/* 8. Languages & currency */}
      <button
        type="button"
        onClick={onOpenLanguagesCurrency}
        className={drawerNavigationItemClass(false)}
      >
        <div className={drawerNavigationContentClass}>
          <svg className={drawerNavigationIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="2" y1="12" x2="22" y2="12" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
          </svg>
          <span className="min-w-0">Languages &amp; currency</span>
        </div>
      </button>

      {/* Thin Divider */}
      <div className="my-2 border-t border-zinc-100 dark:border-zinc-800/80" />

      {/* 9. Create a new listing */}
      <button
        type="button"
        onClick={() => onNavigate("/host/listings/new")}
        className={drawerNavigationItemClass(false)}
      >
        <div className={drawerNavigationContentClass}>
          <svg className={drawerNavigationIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="min-w-0">Create a new listing</span>
        </div>
      </button>

      {/* 10. Find a co-host */}
      {/* <button
        type="button"
        onClick={() => onNavigate("/host/co-host")}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition cursor-pointer text-left ${
          isCoHostActive
            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white font-medium"
            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-950 dark:hover:text-white font-normal"
        }`}
      >
        <div className="flex items-center gap-3.5">
          <svg className="size-5 shrink-0 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Find a co-host</span>
        </div>
      </button> */}

      {/* 11. Refer a host */}
      <button
        type="button"
        onClick={() => onNavigate("/host/refer")}
        className={drawerNavigationItemClass(isReferActive)}
      >
        <div className={drawerNavigationContentClass}>
          <svg className={drawerNavigationIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
          <span className="min-w-0">Refer a host</span>
        </div>
      </button>

      {/* 12. Admin (Only if Admin Role) */}
      {isAdmin && (
        <button
          type="button"
          onClick={() => onNavigate("/admin")}
            className={drawerNavigationItemClass(isAdminActive)}
        >
            <div className={drawerNavigationContentClass}>
              <svg className={drawerNavigationIconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span className="min-w-0">Admin</span>
          </div>
        </button>
      )}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DRAWER FOOTER
// ─────────────────────────────────────────────────────────────────────────────
export interface DrawerFooterProps {
  onLogout: () => void;
}

export function DrawerFooter({ onLogout }: DrawerFooterProps) {
  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800 p-4 sm:p-5 shrink-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs">
      <button
        type="button"
        onClick={onLogout}
        className={`${drawerNavigationItemBaseClass} gap-3 ${drawerNavigationItemInactiveClass}`}
      >
        <svg
          className="size-5 shrink-0 text-zinc-600 dark:text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
          />
        </svg>
        <span>Log out</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. MAIN HOST NAVIGATION DRAWER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function HostNavigationDrawer({
  isOpen,
  onClose,
  user,
  unreadCount,
  onOpenLanguagesCurrency,
}: HostNavigationDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [activeView, setActiveView] = useState<HostDrawerView>("MENU");
  const menuScrollRef = useRef<HTMLDivElement>(null);
  const savedMenuScrollTopRef = useRef<number>(0);
  const activeViewRef = useRef<HostDrawerView>("MENU");
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const router = useRouter();
  const pathname = usePathname();
  const drawerRef = useRef<HTMLElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleOpenNotifications = useCallback(() => {
    if (menuScrollRef.current) {
      savedMenuScrollTopRef.current = menuScrollRef.current.scrollTop;
    }
    setActiveView("NOTIFICATIONS");
  }, []);

  const handleBackToMenu = useCallback(() => {
    setActiveView("MENU");
    requestAnimationFrame(() => {
      if (menuScrollRef.current) {
        menuScrollRef.current.scrollTop = savedMenuScrollTopRef.current;
      }
    });
  }, []);

  // Reset to default MENU view when drawer closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setActiveView("MENU");
        savedMenuScrollTopRef.current = 0;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync open / close animation states strictly on isOpen changes
  useEffect(() => {
    if (isOpen) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsRendered(true);
      // Double requestAnimationFrame ensures initial translate-x-full is painted before animating to translate-x-0
      const frame = requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => cancelAnimationFrame(frame);
    } else {
      // Trigger exit animation: slide drawer out & fade overlay out
      setIsVisible(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsRendered(false);
      }, 300);
    }
  }, [isOpen]);

  // Lock body scroll while open
  useLayoutEffect(() => {
    if (!isOpen) return;
    const unlock = lockBodyScroll();
    return () => unlock();
  }, [isOpen]);

  // Keep keyboard focus inside the modal drawer and return it to its trigger.
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusFrame = window.requestAnimationFrame(() => {
      const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (firstFocusable ?? drawerRef.current)?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeViewRef.current === "NOTIFICATIONS") {
          e.preventDefault();
          handleBackToMenu();
          return;
        }
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !drawerRef.current) return;

      const focusableElements = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && (document.activeElement === firstFocusable || !drawerRef.current.contains(document.activeElement))) {
        e.preventDefault();
        lastFocusable?.focus();
      } else if (!e.shiftKey && (document.activeElement === lastFocusable || !drawerRef.current.contains(document.activeElement))) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) {
        window.requestAnimationFrame(() => previousFocus.focus());
      }
    };
  }, [isOpen, handleBackToMenu]);

  const handleNavigate = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  const handleLogout = useCallback(() => {
    onClose();
    signOut({ callbackUrl: "/login?logged_out=true" });
  }, [onClose]);

  const handleOpenLanguage = useCallback(() => {
    onClose();
    onOpenLanguagesCurrency();
  }, [onClose, onOpenLanguagesCurrency]);

  const shouldRender = mounted && (isOpen || isRendered);
  if (!shouldRender || typeof document === "undefined") {
    return null;
  }

  const isAdmin = user?.role === "ADMIN";

  return createPortal(
    <div
      className="fixed inset-0 z-9999 overflow-hidden"
      data-host-navigation-drawer-root=""
    >
      {/* ── Background Overlay (Click outside to close) ── */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-[9998] bg-black/35 backdrop-blur-[1px] cursor-pointer transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* ── Sliding Navigation Drawer ── */}
      <aside
        ref={drawerRef}
        id="host-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="host-drawer-heading"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`fixed top-0 right-0 bottom-0 z-[9999] flex flex-col w-full md:w-[400px] max-w-full h-[100dvh] bg-white dark:bg-zinc-900 rounded-none md:rounded-l-3xl shadow-[-12px_0_35px_rgba(0,0,0,0.12)] border-l border-zinc-200/80 dark:border-zinc-800 overscroll-contain overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          isVisible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Top Header with Close (X) Button */}
        <DrawerHeader
          onClose={onClose}
          unreadCount={unreadCount}
          onNotificationsClick={handleOpenNotifications}
          view={activeView}
          onBackToMenu={handleBackToMenu}
        />

        {/* View 1: Host Menu Content */}
        <div
          ref={menuScrollRef}
          className={`flex-1 overflow-y-auto px-6 sm:px-7 py-2 space-y-5 custom-scrollbar ${
            activeView === "MENU" ? "block" : "hidden"
          }`}
          aria-hidden={activeView !== "MENU"}
        >
          {/* User Profile Card */}
          <DrawerProfile
            user={user}
            onClick={() => handleNavigate("/profile")}
          />

          {/* Optional Host Resources Card (Airbnb Inspired) */}
          <HostResourcesCard
            onGetStarted={() => handleNavigate("/host/onboarding")}
            onSwitchTraveling={() => handleNavigate("/")}
          />

          {/* Host Navigation Rows */}
          <DrawerNavigation
            currentPath={pathname || ""}
            onNavigate={handleNavigate}
            onOpenLanguagesCurrency={handleOpenLanguage}
            unreadCount={unreadCount}
            isAdmin={isAdmin}
          />
        </div>

        {/* View 2: Host Notifications Content */}
        <div
          className={`flex-1 flex flex-col min-h-0 overflow-hidden ${
            activeView === "NOTIFICATIONS" ? "flex" : "hidden"
          }`}
          aria-hidden={activeView !== "NOTIFICATIONS"}
        >
          <HostDrawerNotifications
            isActive={activeView === "NOTIFICATIONS"}
            onClose={onClose}
            onNavigate={handleNavigate}
          />
        </div>

        {/* Footer (Only in MENU view) */}
        {activeView === "MENU" && (
          <DrawerFooter onLogout={handleLogout} />
        )}
      </aside>
    </div>,
    document.body
  );
}

