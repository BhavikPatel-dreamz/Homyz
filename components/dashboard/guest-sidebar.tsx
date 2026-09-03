"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const IconProfile = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" />
    <path d="M2.92993 20.0001C3.39993 16.5201 6.37993 13.8001 9.99993 13.8001H13.9999C17.6199 13.8001 20.5999 16.5201 21.0699 20.0001" />
  </svg>
);

const IconUpcomingTrips = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 19V5C4 3.89543 4.89543 3 6 3H14L20 9V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19Z" />
    <path d="M14 3V9H20" />
  </svg>
);

const IconPastBookings = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
    <path d="M12 6V12L16 14" />
  </svg>
);

const IconWallet = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M22 12V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V6C2 4.89543 2.89543 4 4 4H18" />
    <path d="M18 4V12H22V4H18Z" />
    <circle cx="20" cy="8" r="1" />
  </svg>
);

const IconInvite = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M18 8C19.6569 8 21 6.65685 21 5C21 3.34315 19.6569 2 18 2C16.3431 2 15 3.34315 15 5C15 6.65685 16.3431 8 18 8Z" />
    <path d="M6 15C7.65685 15 9 13.6569 9 12C9 10.3431 7.65685 9 6 9C4.34315 9 3 10.3431 3 12C3 13.6569 4.34315 15 6 15Z" />
    <path d="M15 6.5L9 10.5" />
    <path d="M15 17.5L9 13.5" />
    <path d="M18 22C19.6569 22 21 20.6569 21 19C21 17.3431 19.6569 16 18 16C16.3431 16 15 17.3431 15 19C15 20.6569 16.3431 22 18 22Z" />
  </svg>
);

const IconSaved = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 12.27 18.6 15.36 13.45 20.03L12 21.35Z" />
  </svg>
);

const IconProfileMgmt = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconSupport = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const IconNotifications = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

export const GUEST_NAV_ITEMS = [
  { id: "about_me", label: "About me", href: "/profile", icon: IconProfile },
  { id: "upcoming_trips", label: "Upcoming Trips", href: "/bookings?tab=upcoming", icon: IconUpcomingTrips },
  { id: "past_bookings", label: "Past Bookings", href: "/bookings?tab=past", icon: IconPastBookings },
  { id: "loyalty", label: "Loyalty Points Wallet", href: "/profile?tab=loyalty", icon: IconWallet },
  { id: "invite", label: "Invite & Earn", href: "/profile?tab=invite", icon: IconInvite },
  { id: "saved", label: "Saved Listings", href: "/profile?tab=saved", icon: IconSaved },
  { id: "profile_management", label: "Profile Management", href: "/profile-management", icon: IconProfileMgmt },
  { id: "support", label: "Support / Chat with Agent", href: "/profile?tab=support", icon: IconSupport },
  { id: "notifications", label: "Notifications", href: "/profile?tab=notifications", icon: IconNotifications },
];

export function GuestDashboardSidebar({ activeId }: { activeId: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-full md:w-72 pr-0 md:pr-8 shrink-0 mb-8 md:mb-0">
      <h1 className="text-3xl font-extrabold text-zinc-900 mb-6 tracking-tight">
        My profile
      </h1>

      <nav className="flex flex-col space-y-1.5">
        {GUEST_NAV_ITEMS.map((item) => {
          const isActive =
            item.id === activeId ||
            (item.id === "about_me" && (pathname === "/profile" || pathname === "/profile/")) ||
            (item.id === "profile_management" && pathname?.startsWith("/profile-management"));

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all font-semibold text-sm ${
                isActive
                  ? "bg-[#FDE29B] text-zinc-900 shadow-2xs border border-amber-200/50"
                  : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <div className={`shrink-0 ${isActive ? "text-zinc-900" : "text-zinc-500"}`}>
                <item.icon />
              </div>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
