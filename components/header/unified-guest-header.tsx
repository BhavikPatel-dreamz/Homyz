"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useLanguage } from "@/lib/i18n/language-context";
import { DISPLAY_CURRENCIES, useCurrency } from "@/lib/currency-context";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { primaryButtonInteractionClass } from "@/components/ui/button";
import dynamic from "next/dynamic";
import {
  useUnreadNotificationCount,
  refreshUnreadNotificationCount,
  invalidateUnreadNotificationCount,
  resetUnreadNotificationCount,
} from "@/lib/notifications/unread-count-store";
import { useHeaderSearch } from "./header-search-context";
import { CategoryNav } from "./category-nav";
import { CompactSearchBar } from "./compact-search-bar";
import { ExpandedSearchBar } from "./expanded-search-bar";
import { SearchBackdrop } from "./search-backdrop";
import { MobileSearchDialog } from "./mobile-search-dialog";
import { BrandLogo } from "@/components/branding/brand-logo";
import { useBranding } from "@/components/branding/branding-provider";

const BecomeHostModal = dynamic(
  () => import("@/components/host/become-host-modal").then((mod) => mod.BecomeHostModal),
  { ssr: false }
);

interface UnifiedGuestHeaderProps {
  showBottomBorder?: boolean;
}

export function UnifiedGuestHeader({ showBottomBorder }: UnifiedGuestHeaderProps) {
  const branding = useBranding();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status: sessionStatus, update } = useSession();
  const user = session?.user;
  const sessionLoading = sessionStatus === "loading";
  const role = (user as { role?: string } | undefined)?.role;
  const isHost = role === "HOST" || role === "ADMIN";

  const { t, selectedLangLabel, setLanguage } = useLanguage();
  const { currency: selectedCurrency, setCurrency: setSelectedCurrency } = useCurrency();
  const unreadCount = useUnreadNotificationCount();

  const {
    isExpanded,
    setIsExpanded,
    setActiveField,
    destination,
    compactDestination,
    compactDates,
    compactGuests,
    setIsMobileSearchOpen,
  } = useHeaderSearch();

  // Scroll detection for homepage
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const isHomePage = pathname === "/" || pathname === "" || pathname === null;
  const isListingsPage = pathname === "/listings" || pathname === "/listings/";
  const isListingDetailPage = Boolean(
    (pathname?.startsWith("/listings/") &&
      pathname !== "/listings/" &&
      !pathname?.endsWith("/book") &&
      !pathname?.endsWith("/photos")) ||
      pathname?.startsWith("/stay/"),
  );
  const usesCompactHomeHeader = isHomePage && !isListingsPage;
  const supportsHeaderSearch = isHomePage || isListingsPage || isListingDetailPage;
  const isSearchExpanded = supportsHeaderSearch && isExpanded;

  // The compact search belongs on the search results page, on details pages (desktop),
  // and on the home page after scrolling past the hero search.
  const showCompactSearch = isListingsPage || isListingDetailPage || (isHomePage && isScrolled);

  // Profile menu & modals
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [langModalOpen, setLangModalOpen] = useState<boolean>(false);
  const [becomeHostModalOpen, setBecomeHostModalOpen] = useState<boolean>(false);
  const [isConvertingRole, setIsConvertingRole] = useState<boolean>(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Scroll listener for homepage hero transition
  useEffect(() => {
    if (!isHomePage) return;

    const checkScroll = () => {
      const heroSearchEl =
        document.getElementById("homepage-hero-search") ||
        document.getElementById("homepage-mobile-search");

      let scrolled = false;
      if (heroSearchEl) {
        const rect = heroSearchEl.getBoundingClientRect();
        // The hero search bar has scrolled past the 80px header height
        scrolled = rect.bottom <= 80;
      } else {
        // Fallback: 320px down is past the hero search form
        scrolled = window.scrollY > 320;
      }

      setIsScrolled(scrolled);
      if (!scrolled && isExpanded) {
        setIsExpanded(false);
        setActiveField(null);
      }
    };

    window.addEventListener("scroll", checkScroll, { passive: true });
    return () => window.removeEventListener("scroll", checkScroll);
  }, [isHomePage, isExpanded, setIsExpanded, setActiveField]);

  // Click outside to close user menu & expanded search
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (
        headerRef.current &&
        !headerRef.current.contains(event.target as Node) &&
        !(event.target as Element)?.closest?.("[role='dialog']") &&
        !(event.target as Element)?.closest?.("[role='listbox']")
      ) {
        if (isExpanded) {
          setIsExpanded(false);
          setActiveField(null);
        }
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setLangModalOpen(false);
        if (isExpanded) {
          setIsExpanded(false);
          setActiveField(null);
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded, setIsExpanded, setActiveField]);

  // Notifications sync
  useEffect(() => {
    resetUnreadNotificationCount();
    if (!user) return;

    void refreshUnreadNotificationCount();
    const handleNotificationsUpdated = () => {
      invalidateUnreadNotificationCount();
      void refreshUnreadNotificationCount({ force: true });
    };

    window.addEventListener("homyz:notifications-updated", handleNotificationsUpdated);
    return () => window.removeEventListener("homyz:notifications-updated", handleNotificationsUpdated);
  }, [user]);

  // Role conversion to host
  const handleBecomeHost = async () => {
    if (isConvertingRole) return;
    setIsConvertingRole(true);
    try {
      const res = await fetch("/api/v1/host/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.error("Failed to convert to host:", data);
      }
      await update?.();
      router.push("/host/listings");
      router.refresh();
    } catch (err) {
      console.error("Error becoming a host:", err);
      router.push("/host/listings");
    } finally {
      setIsConvertingRole(false);
    }
  };

  return (
    <>
      <header
        ref={headerRef}
        className={`sticky top-0 ${isSearchExpanded ? "z-[90]" : "z-40"} w-full bg-white text-[#1F1F1F] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
          isSearchExpanded
            ? "h-[160px] shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
            : isListingsPage
            ? "h-[72px] sm:h-20"
            : usesCompactHomeHeader
            ? "min-h-[78px] pt-[env(safe-area-inset-top)] lg:h-20 lg:min-h-0 lg:pt-0"
            : "min-h-[96px]"
        }`}
      >
        {usesCompactHomeHeader && (
          <div className="lg:hidden">
            <div className="px-4 pt-3 pb-2">
              <button
                id="homepage-mobile-search"
                type="button"
                onClick={() => setIsMobileSearchOpen(true)}
                className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-5 text-[14px] font-medium text-[#1F1F1F] shadow-[0_4px_12px_rgba(0,0,0,0.10)] transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4 shrink-0" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <span className="truncate">{destination ? compactDestination : t("home_start_search", "Start your search")}</span>
              </button>
            </div>
          </div>
        )}

        {isListingsPage && (
          /* Mobile / Tablet Compact Search Header (screens < lg) on /listings */
          <div className="flex lg:hidden w-full h-full items-center justify-between gap-2 px-3 sm:px-4 min-w-0 max-w-full overflow-hidden">
            {/* Left: Back button */}
            <button
              type="button"
              aria-label="Back"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/");
                }
              }}
              className="size-10 rounded-full flex items-center justify-center text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-5 text-[#1F1F1F]">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>

            {/* Center: Search Summary Pill (Truncates gracefully with ellipsis) */}
            <button
              type="button"
              aria-label="Edit search"
              onClick={() => setIsMobileSearchOpen(true)}
              className="flex-1 min-w-0 h-[54px] sm:h-[58px] rounded-full border border-zinc-200/90 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-md transition-all px-3 sm:px-4 flex flex-col justify-center items-center text-center cursor-pointer select-none active:scale-[0.99] overflow-hidden"
            >
              <span className="w-full block truncate text-[13px] sm:text-[14px] font-medium text-[#1F1F1F]">
                {compactDestination}
              </span>
              <span className="w-full block truncate text-[11px] sm:text-[12px] text-zinc-500 mt-0.5">
                {`${compactDates} · ${compactGuests}`}
              </span>
            </button>

            {/* Right: Filter / Sliders Button */}
            <button
              type="button"
              aria-label="Filters"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("homyz:open-filters"));
              }}
              className="size-10 rounded-full border border-zinc-200/90 bg-white shadow-2xs flex items-center justify-center text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="size-4.5 text-[#1F1F1F]">
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
            </button>
          </div>
        )}

        {/* Standard / Desktop Header Row */}
        <div
          className={`mx-auto box-border w-full max-w-[1600px] items-center justify-between px-6 ${
            isListingsPage || usesCompactHomeHeader ? "hidden lg:flex" : "flex"
          } ${
            isListingsPage || usesCompactHomeHeader
              ? "h-20"
              : "min-h-[96px] py-0 md:min-h-0 md:py-4 lg:py-5"
          } ${showBottomBorder || isListingsPage ? "md:border-b md:border-[#727272]/20" : ""}`}
        >
          {/* ── Left: Homyz Brand Logo ── */}
          <div className="flex items-center min-w-[140px] lg:min-w-[180px]">
            <Link
              href="/"
              className="flex items-center gap-2.5 transition-opacity hover:opacity-85 focus-visible:outline-none"
              aria-label="Homyz home"
            >
              <BrandLogo
                src={branding.guestHeaderLogoUrl}
                fallbackSrc="/images/brand/homyz-logo-dark-v1.svg"
                alt="Homyz"
                width={140}
                height={40}
                className="h-auto w-[125px] md:w-[135px] lg:w-[145px]"
                priority
              />
            </Link>
          </div>

          {/* ── Center: Homepage/listings search only ── */}
          <div className="flex-1 flex items-center justify-center px-2 min-w-0">
            {isSearchExpanded ? (
              /* When search is expanded, top center shows Category tabs */
              <div className="animate-in fade-in duration-200">
                <CategoryNav />
              </div>
            ) : showCompactSearch ? (
              /* When compact search is active (listings page or scrolled on home) */
              <div className="animate-in fade-in zoom-in-95 duration-200 w-full flex justify-center">
                <CompactSearchBar />
              </div>
            ) : null}
          </div>

          {/* ── Right: User Actions & Profile Menu ── */}
          <div
            className="flex items-center justify-end gap-2 sm:gap-3 min-w-[140px] lg:min-w-[180px] relative"
            ref={menuRef}
          >
            {sessionLoading ? (
              <div className="h-8 w-28 animate-pulse rounded-full bg-zinc-100 hidden sm:block" />
            ) : isHost ? (
              <Link
                href="/host/today"
                className={`hidden sm:inline-flex shrink-0 whitespace-nowrap rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] px-3.5 py-1.5 text-xs font-medium text-[#1F1F1F] hover:text-white transition-colors duration-200 ${primaryButtonInteractionClass}`}
              >
                {t("header_switch_hosting", "Switch to hosting")}
              </Link>
            ) : user ? (
              <button
                type="button"
                onClick={handleBecomeHost}
                disabled={isConvertingRole}
                className={`hidden sm:inline-flex shrink-0 whitespace-nowrap rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] px-3.5 py-1.5 text-xs font-medium text-[#1F1F1F] hover:text-white transition-colors duration-200 cursor-pointer ${primaryButtonInteractionClass}`}
              >
                {isConvertingRole ? t("host_loading", "Loading...") : t("header_become_a_host", "Become a host")}
              </button>
            ) : (
              <Link
                href="/login?callbackUrl=/host/onboarding"
                className={`hidden sm:inline-flex shrink-0 whitespace-nowrap rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] px-3.5 py-1.5 text-xs font-medium text-[#1F1F1F] hover:text-white transition-colors duration-200 ${primaryButtonInteractionClass}`}
              >
                {t("header_become_a_host", "Become a host")}
              </Link>
            )}

            {/* User Avatar Circle Button (Airbnb Style) */}
            <button
              type="button"
              aria-label="User profile"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
              className="size-9 rounded-full overflow-hidden shrink-0 transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 cursor-pointer"
            >
              {user?.image && user.image !== failedAvatarUrl ? (
                <div className="relative size-full">
                  <Image
                    src={user.image}
                    alt={user.name || "User avatar"}
                    fill
                    sizes="36px"
                    className="object-cover"
                    onError={() => setFailedAvatarUrl(user.image ?? null)}
                  />
                </div>
              ) : user ? (
                <div className="size-full flex items-center justify-center bg-[#EDE9FE] text-[#6D28D9] text-sm font-medium">
                  {user.name ? user.name.charAt(0).toUpperCase() : user.email ? user.email.charAt(0).toUpperCase() : "U"}
                </div>
              ) : (
                <div className="size-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
            </button>

            {/* Circular Hamburger Menu Button with Notification Dot (Airbnb Style) */}
            <button
              type="button"
              aria-label="User menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
              className="relative size-9 rounded-full bg-zinc-100 hover:bg-zinc-200/90 flex items-center justify-center text-zinc-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4 text-zinc-700">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>

              {unreadCount !== null && unreadCount > 0 && (
                <span
                  aria-label={`${unreadCount} unread notifications`}
                  className="absolute top-1 right-1 size-2.5 rounded-full bg-[#E51D52] ring-2 ring-white"
                />
              )}
            </button>

            {/* ── User Dropdown Menu ── */}
            {menuOpen && !sessionLoading && (
              <div className="absolute right-0 top-full mt-3 w-72 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl z-50 text-[#1F1F1F] animate-in fade-in zoom-in-95 duration-150">
                {user ? (
                  <div className="space-y-1">
                    {/* User identifier */}
                    <div className="px-3 py-2 border-b border-zinc-100 mb-1">
                      <p className="text-sm font-medium text-[#1F1F1F] truncate">{user.name || user.email}</p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{user.email}</p>
                    </div>

                    {/* Navigation links */}
                    <div className="space-y-0.5 border-b border-zinc-100 pb-2">
                      <Link
                        href="/profile/tab/saved"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-zinc-50 rounded-xl transition-colors"
                      >
                        <Image src="/images/icons/wishlist.svg" alt="" width={16} height={16} className="size-4 object-contain" />
                        <span>{t("header_wishlist", "Wishlist")}</span>
                      </Link>
                      <Link
                        href="/profile/tab/upcoming"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-zinc-50 rounded-xl transition-colors"
                      >
                        <Image src="/images/icons/trip.svg" alt="" width={16} height={16} className="size-4 object-contain" />
                        <span>{t("header_trips", "Trips")}</span>
                      </Link>
                      <Link
                        href="/messages"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-zinc-50 rounded-xl transition-colors"
                      >
                        <Image src="/images/icons/messages.svg" alt="" width={16} height={16} className="size-4 object-contain" />
                        <span>{t("header_messages", "Messages")}</span>
                      </Link>
                      <Link
                        href="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-zinc-50 rounded-xl transition-colors"
                      >
                        <Image src="/images/icons/profile.svg" alt="" width={16} height={16} className="size-4 object-contain" />
                        <span>{t("header_profile", "Profile")}</span>
                      </Link>
                      <Link
                        href="/travel-profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-zinc-50 rounded-xl transition-colors"
                      >
                        <Image src="/images/icons/trip.svg" alt="" width={16} height={16} className="size-4 object-contain" />
                        <span>Travel Profile</span>
                      </Link>
                    </div>

                    {/* Settings & Help */}
                    <div className="space-y-0.5 border-b border-zinc-100 py-2">
                      <Link
                        href="/profile/tab/notifications"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-zinc-50 rounded-xl transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Image src="/images/icons/Notifications.svg" alt="" width={16} height={16} className="size-4 object-contain" />
                          <span>{t("header_notifications", "Notifications")}</span>
                        </div>
                        {unreadCount !== null && unreadCount > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-medium text-white">
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                      <Link
                        href="/profile/tab/account_settings"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-zinc-50 rounded-xl transition-colors"
                      >
                        <Image src="/images/icons/setting.svg" alt="" width={16} height={16} className="size-4 object-contain" />
                        <span>{t("header_account_settings", "Account settings")}</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setLangModalOpen(true);
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-zinc-50 rounded-xl transition-colors cursor-pointer text-left"
                      >
                        <Image src="/images/icons/translate-icon.svg" alt="" width={16} height={16} className="size-4 object-contain" />
                        <span>{t("header_languages_currency", "Languages & currency")}</span>
                      </button>
                      <Link
                        href="/help"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-zinc-50 rounded-xl transition-colors"
                      >
                        <Image src="/images/icons/help.svg" alt="" width={16} height={16} className="size-4 object-contain" />
                        <span>{t("header_help_centre", "Help Centre")}</span>
                      </Link>
                    </div>

                    {/* Host action or conversion */}
                    <div className="py-2 border-b border-zinc-100">
                      {isHost ? (
                        <Link
                          href="/host/today"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-2 text-sm font-medium bg-[#FCDF9C]/50 hover:bg-[#FCDF9C] rounded-xl transition-colors"
                        >
                          <Image src="/images/icons/streamline-freehand/home-chimney-2--Streamline-Freehand.svg" alt="" width={16} height={16} className="size-4 object-contain" />
                          <span>{t("header_switch_hosting", "Switch to hosting")}</span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            setBecomeHostModalOpen(true);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm font-medium hover:bg-zinc-50 rounded-xl transition-colors cursor-pointer"
                        >
                          {t("header_become_a_host", "Become a host")}
                        </button>
                      )}
                    </div>

                    {/* Sign out */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          void signOut({ callbackUrl: "/login?logged_out=true" });
                        }}
                        className="w-full text-left px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      >
                        {t("header_sign_out", "Sign out")}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Logged out menu */
                  <div className="space-y-1">
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3.5 py-2.5 text-sm font-medium text-[#1F1F1F] hover:bg-zinc-50 rounded-xl transition-colors"
                    >
                      {t("header_log_in", "Log in")}
                    </Link>
                    <Link
                      href="/login?mode=signup"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3.5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded-xl transition-colors"
                    >
                      {t("header_sign_up", "Sign up")}
                    </Link>
                    <div className="my-1 border-t border-zinc-100" />
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setBecomeHostModalOpen(true);
                      }}
                      className="block w-full px-3.5 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded-xl transition-colors cursor-pointer"
                    >
                      {t("header_become_a_host", "Become a host")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setLangModalOpen(true);
                      }}
                      className="flex w-full items-center gap-3 px-3.5 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <span>{t("header_languages_currency", "Languages & currency")}</span>
                    </button>
                    <Link
                      href="/help"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 rounded-xl transition-colors"
                    >
                      {t("header_help_centre", "Help Centre")}
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Expanded Search Row (shown when expanded) ── */}
        {isSearchExpanded && (
          <div className="w-full px-4 sm:px-6 lg:px-12 pb-5 animate-in fade-in slide-in-from-top-2 duration-250">
            <ExpandedSearchBar />
          </div>
        )}
      </header>

      {/* ── Background Dimming Backdrop ── */}
      <SearchBackdrop enabled={supportsHeaderSearch} />

      {/* ── Mobile Search Sheet/Dialog ── */}
      <MobileSearchDialog />

      {/* ── Languages & Currency Modal ── */}
      {langModalOpen && (
        <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 text-[#1F1F1F] relative animate-in zoom-in-95 my-auto mx-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-5">
              <h3 className="text-base font-medium text-[#1F1F1F]">{t("header_languages_currency", "Language & Currency")}</h3>
              <button
                type="button"
                onClick={() => setLangModalOpen(false)}
                className="size-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Language Selection */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  {t("header_language", "Select Language")}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {["English (US)", "English (UK)", "Español", "Français", "Deutsch", "Hindi", "العربية"].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLanguage(lang)}
                      className={`p-3 rounded-2xl border text-xs font-medium text-left transition-all cursor-pointer ${
                        selectedLangLabel === lang
                          ? "border-amber-400 bg-amber-50 text-amber-950 font-medium"
                          : "border-zinc-200 bg-white text-[#1F1F1F] hover:bg-zinc-50"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency Selection */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  {t("header_currency", "Select Currency")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DISPLAY_CURRENCIES.map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setSelectedCurrency(curr)}
                      className={`p-3 rounded-2xl border text-xs font-medium text-center transition-all cursor-pointer ${
                        selectedCurrency === curr
                          ? "border-amber-400 bg-amber-50 text-amber-950 font-medium"
                          : "border-zinc-200 bg-white text-[#1F1F1F] hover:bg-zinc-50"
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
                className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs px-6 py-2.5 transition-all cursor-pointer"
              >
                {t("header_done", "Done")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Become A Host Modal */}
      <BecomeHostModal
        isOpen={becomeHostModalOpen}
        onClose={() => setBecomeHostModalOpen(false)}
      />
    </>
  );
}
