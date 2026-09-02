"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface HostSubNavProps {
  activeTab?: "today" | "calendar" | "listing" | "messages";
  listingId?: string;
}

export function HostSubNav({ activeTab: explicitActiveTab, listingId }: HostSubNavProps) {
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
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="3" width="14" height="18" rx="3" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
    },
    {
      id: "calendar",
      label: "Calendar",
      href: "/host/calendar",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M16 2v4M8 2v4M4 9.5h16" />
          <circle cx="9" cy="14" r="0.75" fill="currentColor" />
          <circle cx="12" cy="14" r="0.75" fill="currentColor" />
          <circle cx="15" cy="14" r="0.75" fill="currentColor" />
          <circle cx="9" cy="17.5" r="0.75" fill="currentColor" />
          <circle cx="12" cy="17.5" r="0.75" fill="currentColor" />
        </svg>
      ),
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
    },
    {
      id: "messages",
      label: "Messages",
      href: "/host/messages",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          <path d="M8 11.5h8M8 14.5h5" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-full bg-white border-b border-zinc-200/80 px-4 sm:px-8 py-3.5 shrink-0 select-none">
      <div className="max-w-7xl mx-auto flex items-center gap-3.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-[22px] px-4 py-2.5 min-w-[76px] sm:min-w-[82px] h-[74px] transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${
                isActive
                  ? "bg-[#FDE29B] border border-amber-300/90 text-zinc-950 font-bold"
                  : "bg-white border border-zinc-200 text-zinc-600 font-medium hover:border-zinc-300 hover:bg-zinc-50/80 hover:text-zinc-900"
              }`}
            >
              <div className={isActive ? "text-zinc-950" : "text-zinc-500"}>
                {tab.icon}
              </div>
              <span className={`text-[12px] leading-none ${isActive ? "font-bold text-zinc-950" : "font-medium text-zinc-600"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
