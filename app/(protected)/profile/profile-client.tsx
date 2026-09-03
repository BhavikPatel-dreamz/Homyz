"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GuestDashboardSidebar } from "@/components/dashboard/guest-sidebar";
import { BUILTIN_TRAVEL_STAMPS, TravelStampItem } from "@/lib/stamps/stamps-data";
import { TravelStampGraphic } from "@/components/stamps/travel-stamp-graphics";

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

type ProfileClientProps = {
  initial: ProfileData;
  initialTripPhotos?: any[];
  initialStats?: UserStatsData;
  isOwner?: boolean;
};

const IconTranslate = () => (
  <svg className="w-4 h-4 text-zinc-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1 4c-1.5 3-3.5 5.5-6 7m2-7c1.5 2 3.5 4.5 5 7m6 3l4-8 4 8m-7-2h6" />
  </svg>
);

export function ProfileClient({
  initial,
  initialStats = { trips: 12, likes: 0, reviews: 10, yearsOnHomyz: 4 },
  isOwner = true,
}: ProfileClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTabParam = searchParams.get("tab") || "about_me";

  const pub = initial.publicProfile || {};
  const years = initialStats.yearsOnHomyz || (initial.createdAt ? Math.max(1, new Date().getFullYear() - new Date(initial.createdAt).getFullYear()) : 4);

  return (
    <div className="w-full bg-white min-h-[85vh] flex flex-col font-sans py-8">
      <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 md:px-8">
        <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
          {/* ------------------------------------------------------------------ */}
          {/* LEFT SIDEBAR (EXACT MATCH TO SCREENSHOT 1)                         */}
          {/* ------------------------------------------------------------------ */}
          <GuestDashboardSidebar activeId={activeTabParam === "about_me" ? "about_me" : activeTabParam} />

          {/* ------------------------------------------------------------------ */}
          {/* RIGHT CONTENT AREA ("About me" OVERVIEW - SCREENSHOT 1)           */}
          {/* ------------------------------------------------------------------ */}
          <main className="flex-1 flex flex-col max-w-3xl">
            {activeTabParam === "about_me" ? (
              <div className="flex flex-col animate-in fade-in">
                {/* 1. Header with Title & Yellow Edit Button */}
                <div className="flex items-center gap-4 mb-6">
                  <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">
                    About me
                  </h2>
                  {isOwner && (
                    <Link
                      href="/profile-management"
                      className="bg-[#FDE29B] hover:bg-[#FCD885] text-zinc-900 font-bold text-xs px-5 py-1.5 rounded-full transition-all shadow-2xs hover:scale-105"
                    >
                      Edit
                    </Link>
                  )}
                </div>

                {/* 2. Profile Overview Card */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-1 mb-6">
                  {/* Rounded rectangular profile image */}
                  <div className="relative w-44 h-36 rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100 shrink-0 shadow-2xs">
                    {initial.image ? (
                      <Image
                        src={initial.image}
                        alt={initial.name || "User profile image"}
                        fill
                        className="object-cover"
                        sizes="176px"
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
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="text-xl font-bold text-zinc-900">
                        {initial.name || "Guest Member"}
                      </h3>
                      <p className="text-xs font-semibold text-zinc-500 mt-0.5">
                        {pub.whereILive || "Town, Country"}
                      </p>
                    </div>

                    {/* 3 Circular Stats */}
                    <div className="flex items-center gap-4 mt-1">
                      <div className="flex flex-col items-center">
                        <div className="w-11 h-11 rounded-full border border-zinc-200/90 bg-white flex items-center justify-center text-sm font-extrabold text-zinc-900 shadow-2xs">
                          {initialStats.trips || 12}
                        </div>
                        <span className="text-[11px] font-semibold text-zinc-500 mt-1">Trips</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className="w-11 h-11 rounded-full border border-zinc-200/90 bg-white flex items-center justify-center text-sm font-extrabold text-zinc-900 shadow-2xs">
                          {initialStats.reviews || 10}
                        </div>
                        <span className="text-[11px] font-semibold text-zinc-500 mt-1">Reviews</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className="w-11 h-11 rounded-full border border-zinc-200/90 bg-white flex items-center justify-center text-sm font-extrabold text-zinc-900 shadow-2xs">
                          {years}
                        </div>
                        <span className="text-[11px] font-semibold text-zinc-500 mt-1 text-center leading-tight">
                          Years on<br />Homyz
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Languages Row */}
                <div className="flex items-center gap-2 text-xs font-medium text-zinc-700 py-3 border-t border-zinc-200/70">
                  <IconTranslate />
                  <span>Speaks {pub.languages || "English and Russian"}</span>
                </div>

                {/* Where I've been Section (Public Profile - Only Selected Stamps, Hidden if stampsVisible === false) */}
                {pub.stampsVisible !== false && (
                  <>
                    <div className="flex flex-col gap-4 py-4 border-t border-zinc-200/70">
                      <h3 className="text-xl font-bold text-zinc-900">Where I've been</h3>
                      <p className="text-xs text-zinc-500 -mt-2">Places visited and travel stamps collected.</p>
                      
                      {(() => {
                        const selectedIds = pub.selectedStamps && pub.selectedStamps.length > 0
                          ? pub.selectedStamps
                          : ["paris", "coffee"];
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

                    <div className="w-full border-b border-zinc-200/80 my-4" />
                  </>
                )}

                {/* 3. My Reviews Section */}
                <div className="flex flex-col gap-4 mt-2">
                  <h3 className="text-xl font-bold text-zinc-900">My reviews</h3>

                  <div className="flex flex-col gap-3 p-5 rounded-2xl bg-zinc-50/60 border border-zinc-200/80">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border border-zinc-200 shrink-0 bg-zinc-200">
                        <Image
                          src="/images/header-user-avatar.jpg"
                          alt="Reviewer avatar"
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                      <div>
                        <div className="flex items-center text-amber-500 text-xs">
                          ★★★★★
                        </div>
                        <p className="text-xs font-bold text-zinc-900">Sophia, Germany</p>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 leading-relaxed">
                      Lorem ipsum dolor sit amet consectetur. Fames quis facilisis dolor turpis lacus eu tellus faucibus. Blandit porttitor justo pretium ridiculus. Metus non in gravida tristique. Vitae iaculis suscipit enim el...{" "}
                      <span className="font-bold text-zinc-900 underline cursor-pointer">read more</span>
                    </p>
                  </div>

                  <div className="mt-2">
                    <button
                      type="button"
                      className="bg-[#FDE29B] hover:bg-[#FCD885] text-zinc-900 font-bold text-xs px-6 py-2.5 rounded-full transition-all shadow-2xs hover:scale-105 cursor-pointer"
                    >
                      Show review
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-zinc-200 rounded-3xl my-4">
                <h3 className="text-xl font-bold text-zinc-800 mb-2">
                  Guest Dashboard Workspace
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mb-4">
                  Manage your bookings, saved listings, wallet points and account settings.
                </p>
                <Link
                  href="/profile"
                  className="bg-[#FDE29B] text-zinc-900 font-bold px-6 py-2 rounded-full hover:bg-[#FCD885] transition-colors text-xs"
                >
                  Back to About me
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
