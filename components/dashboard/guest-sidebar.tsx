"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const GUEST_NAV_ITEMS = [
  { id: "about_me", label: "About me", href: "/profile", image: "/images/icons/profile-img.jpg" },
  { id: "upcoming_trips", label: "Upcoming Trips", href: "/bookings?tab=upcoming", image: "/images/icons/upcoming-trips.svg" },
  { id: "past_bookings", label: "Past Bookings", href: "/bookings?tab=past", image: "/images/icons/post-bookings.svg" },
  { id: "loyalty", label: "Loyalty Points Wallet", href: "/profile?tab=loyalty", image: "/images/icons/loyalty-points-wallet.svg" },
  { id: "invite", label: "Invite & Earn", href: "/profile?tab=invite", image: "/images/icons/invite-earn.svg" },
  { id: "saved", label: "Saved Listings", href: "/profile?tab=saved", image: "/images/icons/saved-listing.svg" },
  { id: "profile_management", label: "Profile Management", href: "/profile-management", image: "/images/icons/profile-management.svg" },
  { id: "support", label: "Support / Chat with Agent", href: "/profile?tab=support", image: "/images/icons/support-chat-with-agent.svg" },
  { id: "notifications", label: "Notifications", href: "/profile?tab=notifications", image: "/images/icons/Notifications.svg" },
];

export function GuestDashboardSidebar({
  activeId,
}: {
  activeId: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="order-2 w-full shrink-0 lg:order-1 lg:w-[390px] xl:w-[452px]">
      <h1 className="mb-7 hidden tracking-[-0.02em] text-[#1F1F1F] lg:block xl:mb-10">
        My profile
      </h1>

      <nav className="grid grid-cols-2 gap-1.5 lg:block">
        {GUEST_NAV_ITEMS.map((item) => {
          const isActive =
            item.id === activeId ||
            (item.id === "about_me" && (pathname === "/profile" || pathname === "/profile/")) ||
            (item.id === "profile_management" && pathname?.startsWith("/profile-management"));

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`group relative isolate min-h-[142px] flex-col items-center justify-center gap-2 rounded-lg border border-[#E5E5E5] px-2 py-4 text-center text-[16px] leading-5 font-normal shadow-[0_1px_3px_rgba(0,0,0,0.18)] transition-colors lg:h-[72px] lg:min-h-0 lg:w-full lg:flex-row lg:justify-start lg:gap-5 lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-b lg:border-[#D7D7D7] lg:px-0 lg:py-0 lg:text-left lg:text-[15px] lg:leading-6 lg:font-medium lg:shadow-none xl:h-[88px] xl:gap-6 xl:text-[20px] xl:leading-7 ${
                ["about_me", "upcoming_trips", "past_bookings"].includes(item.id)
                  ? "hidden lg:flex"
                  : "flex"
              } ${
                isActive
                  ? "bg-white text-[#1F1F1F] lg:bg-transparent lg:border-b-transparent"
                  : "bg-white text-[#1F1F1F] hover:bg-[#FFF8E8] lg:bg-transparent lg:hover:bg-transparent"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 -left-5 -z-10 hidden duration-400 lg:right-3 xl:-right-2 lg:block transition-all ease-in-out ${
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <Image
                  src="/images/icons/about-me-active.svg"
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 460px, 398px"
                  className="object-fill"
                />
              </span>
              <div
                className={`relative flex h-10 w-10 lg:w-12 lg:h-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#1F1F1F] bg-white text-[#1F1F1F] xl:h-16 xl:w-16 transition-all duration-400 ease-in-out ${
                  isActive && item.id === "about_me"
                    ? ""
                    : "xl:border-0"
                }`}
              >
                {item.id === "about_me" ? (
                  <Image
                    src={item.image}
                    alt="About me"
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <span
                      className={`flex items-center justify-center rounded-full xl:border xl:border-[#1F1F1F] transition-all ease-in-out duration-400 ${
                      isActive
                        ? "xl:h-16 xl:w-16"
                        : "xl:h-10 xl:w-10 group-hover:xl:h-16 group-hover:xl:w-16"
                    }`}
                  >
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
              <span className="max-w-[120px] whitespace-normal lg:max-w-none lg:truncate lg:whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
