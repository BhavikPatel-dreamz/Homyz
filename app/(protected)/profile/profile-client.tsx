"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GuestDashboardSidebar } from "@/components/dashboard/guest-sidebar";
import {
  GUEST_NAV_ITEMS,
  normalizeTabId,
  extractTabFromQuery,
  extractSubTabFromQuery,
  extractProfileRoute,
  getProfileTabHref,
  getMgmtSubTabSlug,
  ProfileMgmtSubTab,
} from "@/lib/profile/tab-utils";
import { BUILTIN_TRAVEL_STAMPS, TravelStampItem } from "@/lib/stamps/stamps-data";
import { TravelStampGraphic } from "@/components/stamps/travel-stamp-graphics";
import { LogoutButton } from "@/components/admin/logout-button";
import { ReservationDashboard } from "@/components/dashboard/reservation-dashboard";
import { ReservationCardData } from "@/components/dashboard/reservation-card";
import { LoyaltyWalletView } from "@/components/profile/loyalty-wallet-view";
import { InviteEarnView } from "@/components/profile/invite-earn-view";
import { SavedListingsView } from "@/components/profile/saved-listings-view";
import { SupportChatView } from "@/components/profile/support-chat-view";
import { NotificationsView } from "@/components/profile/notifications-view";
import { ProfileManagementClient } from "@/app/(protected)/profile-management/profile-management-client";

export type PublicProfileData = {
  whereIWantToGo?: string;
  myWork?: string;
  spendTooMuchTime?: string;
  pets?: string;
  decadeBorn?: string;
  school?: string;
  uselessSkill?: string;
  funFact?: string;
  favoriteSong?: string;
  languages?: string;
  obsessedWith?: string;
  bioTitle?: string;
  whereILive?: string;
  bio?: string;
  stampsVisible?: boolean;
  profileVisible?: boolean;
  selectedStamps?: string[];
  customStamps?: TravelStampItem[];
};

type ProfileData = {
  id: string;
  name: string | null;
  phone: string | null;
  image: string | null;
  email: string | null;
  createdAt?: Date | string;
  publicProfile?: PublicProfileData | null;
};

export type UserStatsData = {
  trips: number;
  likes: number;
  reviews: number;
  yearsOnHomyz?: number;
};

const IconTranslate = () => (
  <svg className="w-4.5 h-4.5 text-zinc-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1 4c-1.5 3-3.5 5.5-6 7m2-7c1.5 2 3.5 4.5 5 7m6 3l4-8 4 8m-7-2h6" />
  </svg>
);

const MobileAccountIcon = ({ type }: { type: string }) => {
  const commonProps = {
    className: "h-5 w-5",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (type === "settings") {
    return <svg {...commonProps}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" /></svg>;
  }

  if (type === "help") {
    return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 1 1 3.05 2.32c-.85.28-.85.85-.85 1.68M12 17h.01" /></svg>;
  }

  if (type === "cohost") {
    return <svg {...commonProps}><circle cx="12" cy="8" r="3" /><path d="M7.5 19v-1.5a4.5 4.5 0 0 1 9 0V19M9 12.5 7 11l-2 2 2 2" /></svg>;
  }

  if (type === "gift") {
    return <svg {...commonProps}><rect x="4" y="10" width="16" height="10" rx="1" /><path d="M3 7h18v3H3zM12 7v13M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z" /></svg>;
  }

  return <svg {...commonProps}><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="10" r="2.5" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 15.5a4.5 4.5 0 0 1 6.5 3.5" /></svg>;
};

type ProfileClientProps = {
  initial: ProfileData;
  initialTripPhotos?: unknown[];
  initialStats?: UserStatsData;
  initialReservations?: ReservationCardData[];
  isOwner?: boolean;
  initialTab?: string;
  initialSubTab?: ProfileMgmtSubTab;
};

export function ProfileClient({
  initial,
  initialTripPhotos = [],
  initialStats = { trips: 12, likes: 0, reviews: 10, yearsOnHomyz: 4 },
  initialReservations = [],
  isOwner = true,
  initialTab,
  initialSubTab,
}: ProfileClientProps) {
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<string>(() =>
    initialTab ? normalizeTabId(initialTab) : extractProfileRoute({ searchParams }).tab
  );
  const [activeSubTab, setActiveSubTab] = useState<ProfileMgmtSubTab>(() =>
    initialSubTab || extractProfileRoute({ searchParams }).subTab
  );

  useEffect(() => {
    const route = extractProfileRoute({ searchParams });
    setActiveTab(route.tab);
    setActiveSubTab(route.subTab);
  }, [searchParams]);

  useEffect(() => {
    const handlePopState = () => {
      const route = extractProfileRoute();
      setActiveTab(route.tab);
      setActiveSubTab(route.subTab);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSelectTab = (tabId: string) => {
    const normalized = normalizeTabId(tabId);
    setActiveTab(normalized);
    const href = getProfileTabHref(normalized);
    window.history.pushState(null, "", href);
  };

  const pub = initial.publicProfile || {};
  const years = initialStats.yearsOnHomyz || (initial.createdAt ? Math.max(1, new Date().getFullYear() - new Date(initial.createdAt).getFullYear()) : 4);

  return (
    <div className="flex min-h-[85vh] w-full flex-col bg-white pb-14 pt-0 font-sans sm:pt-10 lg:pb-28 lg:pt-[88px]">
        <div className="mb-5 flex items-center justify-between lg:hidden">
          <button
            type="button"
            onClick={() => {
              if (activeTab !== "about_me") {
                handleSelectTab("about_me");
              } else {
                history.back();
              }
            }}
            aria-label="Go back"
            className="back-btn flex h-8 w-8 items-center justify-center rounded-full border border-[#D7D7D7] text-[#727272]"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          
        </div>

      <div className="grid grid-cols-1 sm:gap-8 gap-3 lg:grid-cols-[390px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[452px_minmax(0,1fr)]">

          <GuestDashboardSidebar
            activeId={activeTab}
            onSelectTab={handleSelectTab}
            avatarUrl={initial.image}
          />

          <main className="order-1 flex w-full min-w-0 flex-col lg:order-2 lg:pt-0">
            {activeTab === "about_me" && (
              <div className="flex flex-col animate-in fade-in">
                {/* 1. Header with Title & Yellow Edit Button */}
                <div className="mb-3 flex items-center gap-[19px] lg:mb-8 xl:mb-10">
                  <h2 className="text-[22px] leading-[30px] font-medium tracking-[-0.02em] text-[#1F1F1F] sm:text-[28px] sm:leading-[36px] lg:text-[32px] lg:leading-[40px] xl:text-[36px] xl:leading-[44px]">
                    <span className="lg:hidden text-[20px] leading-7">My profile</span>
                    <span className="hidden lg:inline">About me</span>
                  </h2>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => handleSelectTab("profile_management")}
                      className="hidden h-12 items-center justify-center rounded-full bg-[#FCDF9C] px-5 text-base font-normal text-[#1F1F1F] transition-colors hover:bg-[#F7D37D] lg:flex cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {/* 2. Profile Overview Card */}
                <div className="mb-0 flex flex-row items-start gap-6 lg:mb-[30px]">
                  {/* Rounded rectangular profile image */}
                  <div className="relative h-[124px] w-[124px] shrink-0 overflow-hidden rounded-xl border border-[#1F1F1F] bg-zinc-100 sm:h-[151px] sm:w-[233px] sm:rounded-2xl sm:border-2">
                    {initial.image ? (
                      <Image
                        src={initial.image}
                        alt={initial.name || "User profile image"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 639px) 124px, 233px"
                        priority
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                        <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Name, Location & 3 Circular Stats */}
                  <div className="flex min-h-[124px] min-w-0 flex-1 flex-col justify-center gap-3 sm:min-h-[151px] sm:w-[195px] sm:flex-none sm:gap-4">
                    <div className="flex flex-col gap-1 sm:gap-2">
                      <h3 className="truncate text-sm leading-5 font-semibold text-[#1F1F1F] sm:text-base sm:leading-6">
                        {initial.name || "Name"}
                      </h3>
                      <p className="truncate text-xs leading-[18px] font-normal text-[#727272] sm:text-sm sm:leading-[21px]">
                        {pub.whereILive || "Town, Country"}
                      </p>
                    </div>

                    {/* 3 Circular Stats */}
                    <div className="flex items-start justify-between gap-2 border-t border-[#727272] pt-2 sm:gap-6 sm:pt-4">
                      <div className="flex flex-col items-center">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#1F1F1F] bg-white text-[10px] font-normal text-[#1F1F1F] sm:h-[37px] sm:w-[37px] sm:text-sm">
                          {initialStats.trips || 12}
                        </div>
                        <span className="mt-1 text-[10px] leading-4 font-normal text-[#727272] sm:mt-1.5 sm:text-xs sm:leading-[18px]">Trips</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#1F1F1F] bg-white text-[10px] font-normal text-[#1F1F1F] sm:h-[37px] sm:w-[37px] sm:text-sm">
                          {initialStats.reviews || 10}
                        </div>
                        <span className="mt-1 text-[10px] leading-4 font-normal text-[#727272] sm:mt-1.5 sm:text-xs sm:leading-[18px]">Reviews</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#1F1F1F] bg-white text-[10px] font-normal text-[#1F1F1F] sm:h-[37px] sm:w-[37px] sm:text-sm">
                          {years}
                        </div>
                        <span className="mt-1 text-center text-[9px] leading-3 font-normal text-[#727272] sm:mt-1.5 sm:text-xs sm:leading-[18px]">
                          Years on<br />Homyz
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Languages Row */}
                <div className="hidden items-center gap-4 border-b border-[#727272] pb-6 text-base leading-6 font-normal text-[#1F1F1F] lg:flex">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F4F5]">
                    <IconTranslate />
                  </span>
                  <span>Speaks {pub.languages || "English and Russian"}</span>
                </div>

                {/* Where I've been Section (Public Profile - Only Selected Stamps, Hidden if stampsVisible === false) */}
                {pub.stampsVisible !== false && pub.selectedStamps && pub.selectedStamps.length > 0 && (
                  <>
                    <div className="hidden flex-col gap-4 border-t border-zinc-200/70 py-4 lg:flex">
                      <h3 className="text-xl font-semibold text-[#1F1F1F]">Where I&apos;ve been</h3>
                      <p className="text-xs text-zinc-500 -mt-2">Places visited and travel stamps collected.</p>
                      
                      {(() => {
                        const selectedIds = pub.selectedStamps || [];
                        const allStamps = [...BUILTIN_TRAVEL_STAMPS, ...(pub.customStamps || [])];
                        const visibleStamps = allStamps.filter((s) => selectedIds.includes(s.id));

                        if (visibleStamps.length === 0) {
                          return <p className="text-xs text-zinc-400 italic">No public stamps selected yet.</p>;
                        }

                        return (
                          <div className="flex items-center gap-8 overflow-x-auto py-3 scrollbar-none">
                            {visibleStamps.map((stamp) => (
                              <TravelStampGraphic key={stamp.id} stamp={stamp} size="md" />
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="my-4 hidden w-full border-b border-zinc-200/80 lg:block" />
                  </>
                )}

                {/* 3. My Reviews Section */}
                <div className="mt-8 hidden w-full max-w-[382px] flex-col gap-8 lg:flex">
                  <h3 className="text-xl leading-7 font-medium text-[#1F1F1F]">My reviews</h3>

                  <div className="flex flex-col items-start gap-3">
                    <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-full bg-zinc-200">
                        <Image
                          src="/images/header-user-avatar.jpg"
                          alt="Reviewer avatar"
                          fill
                          className="object-cover"
                          sizes="60px"
                        />
                    </div>

                    <div className="flex items-center gap-0.5 text-xl leading-5 text-[#1F1F1F]" aria-label="5 out of 5 stars">
                      ★★★★★
                    </div>

                    <p className="text-base leading-6 font-normal text-[#727272]">
                      Lorem ipsum dolor sit amet consectetur. Fames quis facilisis dolor turpis lacus eu tellus faucibus. Blandit porttitor justo pretium ridiculus. Metus non in gravida tristique. Vitae iaculis suscipit enim el...{" "}
                    <span className="cursor-pointer font-normal text-[#727272] hover:text-[#1F1F1F] underline underline-offset-2 transition">read more</span>
                    </p>
                  <p className="text-base leading-6 font-medium text-[#1D1D1D] ">Name, Country</p>
                  </div>

                  <div>
                    <button
                      type="button"
                    className="no-brush-border flex h-12 items-center justify-center rounded-full bg-[#FCDF9C] px-5 text-base leading-6 font-medium text-[#1F1F1F] transition-colors border border-transparent hover:border-[#1F1F1F] hover:bg-[#F3F4F5] hover:text-[#1F1F1F]"
                    >
                      Show review
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(activeTab === "upcoming_trips" || activeTab === "upcoming") && (
              <div className="flex flex-col animate-in fade-in">
                <ReservationDashboard
                  initialReservations={initialReservations}
                  initialTab="upcoming"
                  onTabChange={(filterTab) => {
                    if (filterTab === "past") handleSelectTab("past_bookings");
                    else if (filterTab === "upcoming") handleSelectTab("upcoming_trips");
                  }}
                />
              </div>
            )}

            {(activeTab === "past_bookings" || activeTab === "past") && (
              <div className="flex flex-col animate-in fade-in">
                <ReservationDashboard
                  initialReservations={initialReservations}
                  initialTab="past"
                  onTabChange={(filterTab) => {
                    if (filterTab === "upcoming") handleSelectTab("upcoming_trips");
                    else if (filterTab === "past") handleSelectTab("past_bookings");
                  }}
                />
              </div>
            )}

            {activeTab === "loyalty" && (
              <LoyaltyWalletView />
            )}

            {activeTab === "invite" && (
              <InviteEarnView user={initial} />
            )}

            {activeTab === "saved" && (
              <SavedListingsView />
            )}

            {activeTab === "profile_management" && (
              <ProfileManagementClient
                initial={initial}
                initialTripPhotos={initialTripPhotos as any}
                initialStats={initialStats}
                isOwner={isOwner}
                embedded={true}
                initialSubTab={activeSubTab}
                onSubTabChange={(sub) => {
                  setActiveSubTab(sub);
                  const href = getProfileTabHref("profile_management", sub);
                  window.history.pushState(null, "", href);
                }}
                onCancel={() => handleSelectTab("about_me")}
              />
            )}

            {activeTab === "support" && (
              <SupportChatView user={initial} />
            )}

            {activeTab === "notifications" && (
              <NotificationsView />
            )}
          </main>
        </div>

        <div className="mt-8 lg:hidden">
          <div>
            {[
              ["Account setting", "profile_management", "settings"],
              ["Help centre", "/help", "help"],
              ["Refer a Host", "/host/refer", "refer"],
              ["Find a co-Host", "/host/co-host", "cohost"],
              ["Gift Cards", "/gift-cards", "gift"],
            ].map(([label, target, icon], index) => {
              const isTab = target === "profile_management";
              return isTab ? (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleSelectTab("profile_management")}
                  className="flex w-full items-center gap-3 py-1.5 text-sm text-[#3F3F3F]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F4F5]">
                    <MobileAccountIcon type={icon} />
                  </span>
                  <span>{label}</span>
                  <svg className="ml-auto h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              ) : (
                <Link
                  key={label}
                  href={target}
                  className={`flex items-center gap-3 py-1.5 text-sm text-[#3F3F3F] ${
                    index === 1 ? "mb-1.5 border-b border-[#D7D7D7]" : ""
                  } ${index === 4 ? "border-b border-[#D7D7D7]" : ""}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F4F5]">
                    <MobileAccountIcon type={icon} />
                  </span>
                  <span>{label}</span>
                  <svg className="ml-auto h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              );
            })}
          </div>
          <LogoutButton callbackUrl="/login?logged_out=true" className="mt-3 !rounded-none !border-0 !p-0 text-sm! !font-medium text-[#1F1F1F]! underline! underline-offset-3!">
            Log out
          </LogoutButton>
        </div>
    </div>
  );
}
