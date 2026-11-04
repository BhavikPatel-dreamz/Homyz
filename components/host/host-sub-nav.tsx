"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Container } from "../ui";
import Image from "next/image";
import styles from "./host-mobile-nav.module.css";
import { useLanguage } from "@/lib/i18n/language-context";
import { useUnreadNotificationCount } from "@/lib/notifications/unread-count-store";

export interface HostSubNavProps {
  activeTab?: "today" | "calendar" | "listing" | "messages" | "resolution";
  listingId?: string;
  onFilterClick?: () => void;
  filterActive?: boolean;
  onMenuClick?: () => void;
  showRightActions?: boolean;
  showMobileNav?: boolean;
  showDesktopNav?: boolean;
}

export function TodayNavIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/images/icons/today-icon.svg"
      alt=""
      width={24}
      height={19}
      className={className}
      priority
    />
  );
}

export function CalendarNavIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/images/icons/date-picker-icon.svg"
      alt=""
      width={24}
      height={19}
      className={className}
      priority
    />
  );
}

export function ListingNavIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/images/icons/listing-edit-icon.svg"
      alt=""
      width={24}
      height={24}
      className={className}
      priority
    />
  );
}

export function MessagesNavIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/images/icons/message-icon.svg"
      alt=""
      width={24}
      height={24}
      className={className}
      priority
    />
  );
}

export function MenuNavIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <line x1="4" y1="6.5" x2="20" y2="6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="17.5" x2="20" y2="17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function FiltersNavIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 26 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <line x1="5.5" y1="3" x2="5.5" y2="25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="5.5" cy="18" r="2.6" stroke="currentColor" strokeWidth="1.6" fill="white" />
      <line x1="13" y1="3" x2="13" y2="25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="13" cy="9.5" r="2.6" stroke="currentColor" strokeWidth="1.6" fill="white" />
      <line x1="20.5" y1="3" x2="20.5" y2="25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="20.5" cy="18" r="2.6" stroke="currentColor" strokeWidth="1.6" fill="white" />
    </svg>
  );
}

export function HostSubNav({
  activeTab: explicitActiveTab,
  onFilterClick,
  filterActive = false,
  onMenuClick,
  showRightActions = true,
  showMobileNav = true,
  showDesktopNav = true,
}: HostSubNavProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const unreadNotificationCount = useUnreadNotificationCount();
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleMenuState = (event: Event) => {
      setMenuOpen(Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open));
    };
    window.addEventListener("homyz:host-menu-state", handleMenuState);
    return () => window.removeEventListener("homyz:host-menu-state", handleMenuState);
  }, []);

  useEffect(() => {
    const mobileViewport = window.matchMedia("(max-width: 767px)");
    let activeController: AbortController | null = null;
    let isMounted = true;

    const loadUnreadMessages = async () => {
      if (!mobileViewport.matches || document.visibilityState !== "visible") return;
      activeController?.abort();
      activeController = new AbortController();
      try {
        const response = await fetch(
          "/api/v1/messages/conversations?role=host&take=1",
          { cache: "no-store", signal: activeController.signal },
        );
        const payload = await response.json();
        if (isMounted && response.ok && payload?.success && typeof payload.data?.unreadTotal === "number") {
          setUnreadMessageCount(payload.data.unreadTotal);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Unable to refresh unread host messages:", error);
        }
      }
    };

    const refreshForViewport = () => {
      if (mobileViewport.matches) void loadUnreadMessages();
      else activeController?.abort();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void loadUnreadMessages();
    };
    const handleMessagesUpdated = (event: Event) => {
      const unreadTotal = (event as CustomEvent<{ unreadTotal?: number }>).detail?.unreadTotal;
      if (typeof unreadTotal === "number") setUnreadMessageCount(unreadTotal);
      else void loadUnreadMessages();
    };
    const interval = window.setInterval(() => void loadUnreadMessages(), 30_000);

    refreshForViewport();
    mobileViewport.addEventListener("change", refreshForViewport);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("homyz:messages-updated", handleMessagesUpdated);
    return () => {
      isMounted = false;
      activeController?.abort();
      window.clearInterval(interval);
      mobileViewport.removeEventListener("change", refreshForViewport);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("homyz:messages-updated", handleMessagesUpdated);
    };
  }, []);

  let activeTab = explicitActiveTab;
  if (!activeTab && pathname) {
    if (pathname === "/host/today" || pathname.startsWith("/host/today/")) {
      activeTab = "today";
    } else if (pathname === "/host/calendar" || pathname.startsWith("/host/calendar/")) {
      activeTab = "calendar";
    } else if (pathname === "/host/messages" || pathname.startsWith("/host/messages/")) {
      activeTab = "messages";
    } else if (pathname === "/host/resolution-center" || pathname.startsWith("/host/resolution-center/")) {
      activeTab = "resolution";
    } else if (pathname === "/host/listings" || pathname.startsWith("/host/listings/")) {
      activeTab = "listing";
    }
  }

  const handleMenuClick = () => {
    if (onMenuClick) {
      onMenuClick();
    } else {
      window.dispatchEvent(new CustomEvent("homyz:toggle-menu"));
    }
  };

  const listingHref = "/host/listings";

  const tabs = [
    {
      id: "today",
      label: t("host_nav_today"),
      href: "/host/today",
      icon: <TodayNavIcon className="size-6" />,
      minWidthClass: "w-[92px] shrink-0",
    },
    {
      id: "calendar",
      label: t("host_nav_calendar"),
      href: "/host/calendar",
      icon: <CalendarNavIcon className="size-6" />,
      minWidthClass: "w-[110px] shrink-0",
    },
    {
      id: "listing",
      label: t("host_nav_listing"),
      href: listingHref,
      icon: <ListingNavIcon className="size-6" />,
      minWidthClass: "w-[98px] shrink-0",
    },
    {
      id: "messages",
      label: t("host_nav_messages"),
      href: "/host/messages",
      icon: <MessagesNavIcon className="size-6" />,
      minWidthClass: "w-[118px] shrink-0",
    },
  ];

  return (
    <>
      {/* Mobile Bottom Navigation */}
      {showMobileNav && (
        <nav
          aria-label="Mobile host navigation"
          data-host-mobile-nav=""
          className={styles.nav}
        >
          <div className={styles.tabs}>
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                onClick={() => {
                  if (menuOpen) window.dispatchEvent(new CustomEvent("homyz:toggle-menu"));
                }}
                aria-label={tab.id === "messages" && unreadMessageCount > 0 ? `${tab.label}, ${unreadMessageCount} unread conversations` : tab.label}
                aria-current={selected ? "page" : undefined}
                className={`${styles.tab} ${selected ? styles.active : ""}`}
              >
                <span className={styles.icon}>
                  {tab.icon}
                  {tab.id === "messages" && unreadMessageCount > 0 && (
                    <span className={styles.badge} aria-hidden="true">
                      {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                    </span>
                  )}
                </span>
                <span className={styles.label}>
                  {"shortLabel" in tab && typeof tab.shortLabel === "string" ? tab.shortLabel : tab.label}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={handleMenuClick}
            aria-label={unreadNotificationCount && unreadNotificationCount > 0 ? `Menu, ${unreadNotificationCount} unread notifications` : "Menu"}
            aria-expanded={menuOpen}
            aria-controls="host-navigation-drawer"
            className={`${styles.tab} ${menuOpen ? styles.active : ""}`}
          >
            <span className={styles.icon}>
              <MenuNavIcon className="size-6" />
              {unreadNotificationCount !== null && unreadNotificationCount > 0 && (
                <span className={styles.badge} aria-hidden="true">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
              )}
            </span>
            <span className={styles.label}>{t("host_nav_menu") || "Menu"}</span>
          </button>
          </div>
        </nav>
      )}

      {/* Desktop Sub Navigation matching nav bar.jpg */}
      {showDesktopNav && (
        <div className="host-sub-nav hidden pt-8 sm:block">
          <Container>
            <div className="mx-auto flex w-full items-center justify-between">
              {/* Left Nav Tabs */}
              <nav aria-label="Host navigation" className="flex items-center gap-3 xl:gap-4 overflow-x-auto scrollbar-none py-1">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`group flex h-[76px] px-3.5 border flex-col items-center justify-center gap-1 rounded-[20px] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 ${
                        tab.minWidthClass
                      } ${
                        isActive
                        ? "bg-[#FCDF9C] border-[#FCDF9C] text-[#1F1F1F] dark:bg-amber-400 dark:border-amber-400 dark:text-zinc-950"
                          : "bg-white border-[#727272] text-[#727272] hover:border-[#1F1F1F] hover:text-[#1F1F1F] dark:bg-zinc-800/80 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
                      }`}
                    >
                      <div className="shrink-0">{tab.icon}</div>
                      <span
                        className={`font-['Poppins'] font-normal text-[15px] leading-tight whitespace-nowrap ${
                          isActive
                            ? "text-[#1F1F1F] dark:text-zinc-950"
                            : "text-[#727272] group-hover:text-[#1F1F1F] dark:text-zinc-300 dark:group-hover:text-zinc-100"
                        }`}
                      >
                        {tab.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>

              {/* Right Actions: Menu & Filters */}
              {showRightActions && (
                <div className="flex items-center gap-4">
                  {/* Menu Button */}
                  <button
                    type="button"
                    onClick={handleMenuClick}
                    aria-label={t("host_nav_menu") || "Host menu"}
                    className="group flex h-[76px] w-[78px] shrink-0 flex-col items-center justify-center gap-1 rounded-[20px] bg-white border border-[#727272] text-[#727272] hover:border-[#1F1F1F] hover:text-[#1F1F1F] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 cursor-pointer dark:bg-zinc-800/80 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
                  >
                    <MenuNavIcon className="shrink-0" />
                    <span className="font-['Poppins'] text-[14px] font-normal leading-tight text-[#727272] group-hover:text-[#1F1F1F] dark:text-zinc-300 dark:group-hover:text-zinc-100">
                      {t("host_nav_menu")}
                    </span>
                  </button>

                  {/* Filters Button */}
                  <button
                    type="button"
                    onClick={onFilterClick}
                    className={`group flex h-[76px] w-[80px] shrink-0 flex-col items-center justify-center gap-1 rounded-[20px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 cursor-pointer ${
                      filterActive
                        ? "bg-[#1F1F1F] border-[#1F1F1F] text-[#FCDF9C] dark:bg-zinc-700 dark:border-zinc-600 dark:text-amber-300"
                        : "bg-white border-[#727272] text-[#727272] hover:border-[#1F1F1F] hover:text-[#1F1F1F] dark:bg-zinc-800/80 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
                    }`}
                  >
                    <FiltersNavIcon className="shrink-0" />
                    <span
                      className={`font-['Poppins'] text-[14px] leading-tight ${
                        filterActive
                          ? "font-medium text-[#FCDF9C] dark:text-amber-300"
                          : "font-normal text-[#727272] group-hover:text-[#1F1F1F] dark:text-zinc-300 dark:group-hover:text-zinc-100"
                      }`}
                    >
                      {t("host_nav_filters")}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </Container>
        </div>
      )}
    </>
  );
}
