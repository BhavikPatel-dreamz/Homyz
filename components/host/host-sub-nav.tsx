"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "../ui";
import Image from "next/image";
import styles from "./host-mobile-nav.module.css";

export interface HostSubNavProps {
  activeTab?: "today" | "calendar" | "listing" | "messages";
  listingId?: string;
  onFilterClick?: () => void;
  filterActive?: boolean;
  onMenuClick?: () => void;
  showRightActions?: boolean;
}

export function TodayNavIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="24"
      height="26"
      viewBox="0 0 28 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5.5 4.8C9.5 4.3 18.5 4.3 22.5 4.8C23.3 4.9 23.8 5.6 23.7 6.4L22.8 25.4C22.7 26.1 21.9 26.5 21.3 26.1L14 21.2L6.7 26.1C6.1 26.5 5.3 26.1 5.2 25.4L4.3 6.4C4.2 5.6 4.7 4.9 5.5 4.8Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 13.8L13 17.5L19.2 10"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CalendarNavIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/images/icons/date-picker-icon.svg"
      alt="Calendar Icon"
      width={24}
      height={19}
      priority
    />
  );
}

export function ListingNavIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/images/icons/listing-edit-icon.svg"
      alt="Listing Edit Icon"
      width={24}
      height={24}
      priority
    />
  );
}

export function MessagesNavIcon({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/images/icons/message-icon.svg"
      alt="Message Icon"
      width={24}
      height={24}
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
  listingId,
  onFilterClick,
  filterActive = false,
  onMenuClick,
  showRightActions = true,
}: HostSubNavProps) {
  const pathname = usePathname();

  let activeTab = explicitActiveTab;
  if (!activeTab) {
    if (pathname?.includes("/host/today")) activeTab = "today";
    else if (pathname?.includes("/host/calendar")) activeTab = "calendar";
    else if (pathname?.includes("/host/messages")) activeTab = "messages";
    else activeTab = "listing";
  }

  const listingHref = listingId ? `/host/listings/${listingId}` : "/host/listings";

  const tabs = [
    {
      id: "today",
      label: "Today",
      href: "/host/today",
      icon: <TodayNavIcon />,
      minWidthClass: "w-[92px] shrink-0",
    },
    {
      id: "calendar",
      label: "Calendar",
      href: "/host/calendar",
      icon: <CalendarNavIcon />,
      minWidthClass: "w-[110px] shrink-0",
    },
    {
      id: "listing",
      label: "Listing",
      href: listingHref,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M10 13h4M10 17h3" />
          <path d="M16 11l2-2" />
        </svg>
      ),
      minWidthClass: "w-[98px] shrink-0",
    },
    {
      id: "messages",
      label: "Messages",
      href: "/host/messages",
      icon: <MessagesNavIcon />,
      minWidthClass: "w-[118px] shrink-0",
    },
  ];

  const mobileActiveIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeTab));
  const notchX = 81.9 + mobileActiveIndex * 70.2;

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile host navigation"
        className={styles.nav}
      >
        <svg className={styles.background} viewBox="0 0 390 84" preserveAspectRatio="none" aria-hidden="true">
          <path d={`M0 0H${notchX - 34}C${notchX - 26} 0 ${notchX - 26} 30 ${notchX} 30C${notchX + 26} 30 ${notchX + 26} 0 ${notchX + 34} 0H390V84H0Z`} fill="#FCDF9C" />
        </svg>
        <div className={styles.tabs}>
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-label={tab.label}
              aria-current={selected ? "page" : undefined}
              className={`${styles.tab} ${selected ? styles.active : ""}`}
            >
              <span
                className={styles.iconCircle}
              >
                {tab.icon}
              </span>
              <span
                className={styles.label}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
        </div>
      </nav>

      {/* Desktop Sub Navigation matching nav bar.jpg */}
      <div className="host-sub-nav hidden pt-8 sm:block">
        <Container>
          <div className="mx-auto flex w-full items-center justify-between">
            {/* Left Nav Tabs */}
            <nav aria-label="Host navigation" className="flex items-center gap-4">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`group flex h-[76px] min-w-[108px] px-3.5 border flex-col items-center justify-center gap-1 rounded-[20px] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 ${
                      tab.minWidthClass
                    } ${
                      isActive
                      ? "bg-[#FCDF9C] border-[#FCDF9C] text-[#1F1F1F]"
                        : "bg-white border-[#727272] text-[#727272] hover:border-[#1F1F1F] hover:text-[#1F1F1F]"
                    }`}
                  >
                    <div className="shrink-0">{tab.icon}</div>
                    <span
                      className={`font-['Poppins'] font-normal text-base leading-tight whitespace-nowrap ${
                        isActive
                          ? "text-[#1F1F1F]"
                          : "text-[#727272] group-hover:text-[#1F1F1F]"
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
                  onClick={onMenuClick}
                  className="group flex h-[76px] w-[78px] shrink-0 flex-col items-center justify-center gap-1 rounded-[20px] bg-white border border-[#727272] text-[#727272] hover:border-[#1F1F1F] hover:text-[#1F1F1F] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 cursor-pointer"
                >
                  <MenuNavIcon className="shrink-0" />
                  <span className="font-['Poppins'] text-[14px] font-normal leading-tight text-[#727272] group-hover:text-[#1F1F1F]">
                    Menu
                  </span>
                </button>

                {/* Filters Button */}
                <button
                  type="button"
                  onClick={onFilterClick}
                  className={`group flex h-[76px] w-[80px] shrink-0 flex-col items-center justify-center gap-1 rounded-[20px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 cursor-pointer ${
                    filterActive
                      ? "bg-[#1F1F1F] border-[#1F1F1F] text-[#FCDF9C]"
                      : "bg-white border-[#727272] text-[#727272] hover:border-[#1F1F1F] hover:text-[#1F1F1F]"
                  }`}
                >
                  <FiltersNavIcon className="shrink-0" />
                  <span
                    className={`font-['Poppins'] text-[14px] leading-tight ${
                      filterActive
                        ? "font-medium text-[#FCDF9C]"
                        : "font-normal text-[#727272] group-hover:text-[#1F1F1F]"
                    }`}
                  >
                    Filters
                  </span>
                </button>
              </div>
            )}
          </div>
        </Container>
      </div>
    </>
  );
}
