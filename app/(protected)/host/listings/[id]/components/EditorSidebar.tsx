"use client";

import React from "react";
import { RealMap } from "@/components/ui/real-map";

interface EditorSidebarProps {
  editorTab: "space" | "arrival";
  setEditorTab: (tab: "space" | "arrival") => void;
  activeSection: string;
  setActiveSection: (section: any) => void;
  editTitle: string;
  editListingType: string;
  editPropertyType: string;
  editPrice: number;
  weeklyDiscount: number;
  monthlyDiscount: number;
  minNights: number;
  maxNights: number;
  editGuests: number;
  editDescription: string;
  editAmenities: string[];
  editPhotos: string[];
  editAddress: string;
  editCity: string;
  editCountry: string;
  showExactLocation: boolean;
  listing: any;
  coHostsList: any[];
  setIsAddCoHostModalOpen: (open: boolean) => void;
  bookingMethod: "instant" | "approve";
  checkInStart: string;
  checkOutTime: string;
  maxGuestsCount: number;
  carbonMonoxideAlarm: boolean;
  smokeAlarm: boolean;
  cancellationPolicy: string;
  customSlug?: string;
  checkInMethod: string;
  checkInEnd: string;
  wifiNetwork: string;
  houseManual: string;
  directions?: string;
}

export function EditorSidebar({
  editorTab,
  setEditorTab,
  activeSection,
  setActiveSection,
  editTitle,
  editListingType,
  editPropertyType,
  editPrice,
  weeklyDiscount,
  monthlyDiscount,
  minNights,
  maxNights,
  editGuests,
  editDescription,
  editAmenities,
  editPhotos,
  editAddress,
  editCity,
  editCountry,
  showExactLocation,
  listing,
  coHostsList,
  setIsAddCoHostModalOpen,
  bookingMethod,
  checkInStart,
  checkOutTime,
  maxGuestsCount,
  carbonMonoxideAlarm,
  smokeAlarm,
  cancellationPolicy,
  customSlug = "",
  checkInMethod,
  checkInEnd,
  wifiNetwork,
  houseManual,
  directions = "",
}: EditorSidebarProps) {
  return (
    <aside className="lg:col-span-5 xl:col-span-5 flex flex-col sticky top-20 self-start max-h-[calc(100vh-6rem)]">
      <div className="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-6 flex flex-col shadow-xs overflow-hidden max-h-[calc(100vh-6rem)]">
        {/* Header Title (Fixed) */}
        <div className="flex items-center justify-between pb-3 shrink-0">
          <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">Listing editor</h2>
        </div>

        {/* Sub-Pills: [Your space] [Arrival guide] ⚙️ (Fixed) */}
        <div className="flex items-center gap-2 pb-4 shrink-0 border-b border-zinc-200/60 mb-3">
          <button
            type="button"
            onClick={() => {
              setEditorTab("space");
              setActiveSection("description");
            }}
            className={`rounded-full font-extrabold text-xs px-4 py-1.5 transition-all cursor-pointer ${
              editorTab === "space"
                ? "bg-[#FEE08B] text-zinc-950 shadow-2xs border border-amber-300"
                : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
            }`}
          >
            Your space
          </button>

          <button
            type="button"
            onClick={() => {
              setEditorTab("arrival");
              setActiveSection("arrival-guide");
            }}
            className={`rounded-full font-bold text-xs px-4 py-1.5 transition-all cursor-pointer ${
              editorTab === "arrival"
                ? "bg-[#FEE08B] text-zinc-950 shadow-2xs border border-amber-300"
                : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
            }`}
          >
            Arrival guide
          </button>

          <button
            type="button"
            className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-xs transition-all cursor-pointer"
          >
            ⚙️
          </button>
        </div>

        {/* Scrollable Sidebar Content Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1.5 space-y-3 custom-scrollbar">
          {/* Photo Card Stack Preview */}
          <div
            onClick={() => setActiveSection("photos")}
            className="relative cursor-pointer group my-2 pr-3 pt-2"
          >
            <div className="absolute inset-0 translate-x-2.5 -translate-y-1 rounded-2xl border border-zinc-200 bg-white shadow-2xs" />
            <div className="absolute inset-0 translate-x-1.25 -translate-y-0.5 rounded-2xl border border-zinc-200 bg-white shadow-2xs" />

            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-zinc-300 bg-zinc-100 shadow-xs flex items-center justify-center">
              {editPhotos.length > 0 ? (
                <img
                  src={editPhotos[0]}
                  alt="Property cover"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400">
                  <span className="text-2xl mb-1">🏡</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/15 flex items-center justify-center">
                <span className="bg-white/95 backdrop-blur-md text-zinc-900 text-[11px] font-extrabold px-3.5 py-1.5 rounded-xl shadow-xs border border-white/60">
                  {editPhotos.length || 14} photos
                </span>
              </div>
            </div>
          </div>

          {/* Card Items Stack (Clickable sections matching Figma) */}
          {editorTab === "space" ? (
            <div className="space-y-3">
              {/* 1. Title */}
              <div
                onClick={() => setActiveSection("title")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "title"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Title
                </span>
                <span className="text-xs font-bold text-zinc-900 block truncate">
                  {editTitle || "Property Name"}
                </span>
              </div>

              {/* 2. Property type */}
              <div
                onClick={() => setActiveSection("propertyType")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "propertyType"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Property type
                </span>
                <span className="text-xs font-bold text-zinc-900 block">
                  {editListingType} · {editPropertyType}
                </span>
              </div>

              {/* 3. Pricing */}
              <div
                onClick={() => setActiveSection("pricing")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "pricing"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Pricing
                </span>
                <div className="text-xs text-zinc-800 space-y-0.5">
                  <p className="font-bold text-zinc-900">SR{editPrice} per night</p>
                  <p className="text-[11px] text-zinc-500">{weeklyDiscount}% weekly discount</p>
                  <p className="text-[11px] text-zinc-500">{monthlyDiscount}% monthly discount</p>
                </div>
              </div>

              {/* 4. Availability */}
              <div
                onClick={() => setActiveSection("availability")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "availability"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Availability
                </span>
                <div className="text-xs text-zinc-800 space-y-0.5">
                  <p className="font-bold text-zinc-900">
                    {minNights}-{maxNights} night stays
                  </p>
                  <p className="text-[11px] text-zinc-500">Same day advance notice</p>
                  <p className="text-[11px] text-zinc-500">10% monthly discount</p>
                </div>
              </div>

              {/* 5. Number of guests */}
              <div
                onClick={() => setActiveSection("guests")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "guests"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Number of guests
                </span>
                <span className="text-xs font-bold text-zinc-900 block">
                  {editGuests} guests
                </span>
              </div>

              {/* 6. Description */}
              <div
                onClick={() => setActiveSection("description")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "description"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Description
                </span>
                <p className="text-xs text-zinc-600 line-clamp-3 leading-relaxed">
                  {editDescription || "Lorem ipsum massa pellentesque enim lobortis mattis..."}
                </p>
              </div>

              {/* 7. Amenities */}
              <div
                onClick={() => setActiveSection("amenities")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "amenities" || activeSection === "add-amenities"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Amenities
                </span>
                <div className="space-y-1.5 text-xs text-zinc-800">
                  {editAmenities.slice(0, 3).map((am, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-zinc-400 text-[10px]">🛋️</span>
                      <span className="font-semibold">{am}</span>
                    </div>
                  ))}
                  {editAmenities.length > 3 && (
                    <span className="text-[10px] font-bold text-zinc-400 block pt-0.5">
                      +{editAmenities.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              {/* 8. Accessibility features */}
              <div
                onClick={() => setActiveSection("accessibility")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "accessibility"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Accessibility features
                </span>
                <span className="text-xs text-zinc-400 font-medium">Add details</span>
              </div>

              {/* 9. Location */}
              <div
                onClick={() => setActiveSection("location")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "location"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs"
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 block mb-2">Location</span>
                <RealMap
                  address={editAddress}
                  city={editCity}
                  country={editCountry}
                  showExactLocation={showExactLocation}
                  className="rounded-xl overflow-hidden border border-zinc-200/80 relative h-24 mb-2.5 pointer-events-none"
                />
                <span className="text-[11px] font-medium text-zinc-500 block truncate">
                  {editAddress
                    ? `${editAddress}, ${editCity}, ${editCountry}`
                    : "Location name, Postal Code, Country"}
                </span>
              </div>

              {/* 10. About the host (Exact Figma Split Layout) */}
              <div
                onClick={() => setActiveSection("about-host")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer ${
                  activeSection === "about-host"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs"
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 block mb-3">About the host</span>

                <div className="flex items-center justify-between">
                  {/* Left Column: Avatar + Name + Superhost badge */}
                  <div className="flex flex-col items-center text-center space-y-1 pr-2">
                    <div className="w-14 h-14 rounded-full overflow-hidden border border-zinc-200 shadow-2xs bg-zinc-100">
                      <img
                        src={
                          listing.host?.image ||
                          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                        }
                        alt="Host profile"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h4 className="text-xs font-bold text-zinc-900 leading-tight">
                      {listing.host?.name || "Host Name"}
                    </h4>
                    <span className="text-[10px] text-zinc-500 font-medium">Superhost</span>
                  </div>

                  {/* Right Column: 3 Stat Rows with Dividers */}
                  <div className="flex-1 pl-4 flex flex-col justify-center space-y-1.5">
                    <div className="pb-1.5 border-b border-zinc-200/80 text-center">
                      <span className="text-xs font-extrabold text-zinc-900 block leading-tight">
                        24
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">reviews</span>
                    </div>
                    <div className="pb-1.5 border-b border-zinc-200/80 text-center flex flex-col items-center">
                      <span className="text-xs font-extrabold text-zinc-900 leading-tight flex items-center justify-center gap-0.5">
                        4.98 <span className="text-amber-500 text-[10px]">★</span>
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">rating</span>
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-extrabold text-zinc-900 block leading-tight">
                        5
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">years hosting</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 11. Co-host */}
              <div
                onClick={() => {
                  setActiveSection("co-host");
                }}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "co-host"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-zinc-900 block">Co-host</span>
                  {coHostsList.length > 0 && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                      {coHostsList.length} Added
                    </span>
                  )}
                </div>
                {coHostsList.length > 0 ? (
                  <div className="text-[11px] text-zinc-700 font-medium space-y-0.5 pt-0.5">
                    {coHostsList.map((ch) => (
                      <p key={ch.id} className="truncate">
                        • {ch.email || ch.phone}
                      </p>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-zinc-400 font-medium block">Add details</span>
                )}
              </div>

              {/* 12. Booking settings */}
              <div
                onClick={() => setActiveSection("booking-settings")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "booking-settings"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 block mb-0.5">
                  Booking settings
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">
                  {bookingMethod === "instant" ? "Use instant book" : "Approve all bookings"}
                </p>
              </div>

              {/* 13. House rules */}
              <div
                onClick={() => setActiveSection("house-rules")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "house-rules"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 block mb-2">House rules</span>
                <div className="space-y-1 text-[11px] text-zinc-600 font-medium">
                  <div className="flex items-center gap-2">
                    <span>🕒</span>
                    <span>Check-in after {checkInStart || "3:00PM"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>⏱️</span>
                    <span>Check-out before {checkOutTime || "11:00AM"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>👥</span>
                    <span>{maxGuestsCount || editGuests || 2} guest maximum</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 pt-0.5 font-bold">+3 more</p>
                </div>
              </div>

              {/* 14. Guests safety */}
              <div
                onClick={() => setActiveSection("guests-safety")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "guests-safety"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 block mb-2.5">Guests safety</span>
                <div className="space-y-2 text-[11px] text-zinc-700 font-medium">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 shrink-0 shadow-2xs">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M12 3v1.5M15.75 3v1.5M12 7.5A4.5 4.5 0 007.5 12v3h9v-3A4.5 4.5 0 0012 7.5zM6 19.5h12" />
                      </svg>
                    </div>
                    <span className="text-zinc-700 text-[11px] font-medium leading-tight">
                      {carbonMonoxideAlarm
                        ? "Carbon monoxide alarm reported"
                        : "Carbon monoxide alarm not reported"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 shrink-0 shadow-2xs">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.364-6.364l-2.121 2.121M7.757 16.243l-2.121 2.121m12.728 0l-2.121-2.121M7.757 7.757L5.636 5.636" />
                      </svg>
                    </div>
                    <span className="text-zinc-700 text-[11px] font-medium leading-tight">
                      {smokeAlarm ? "Smoke alarm Instaled" : "Smoke alarm not reported"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 15. Cancellation policy */}
              <div
                onClick={() => setActiveSection("cancellation-policy")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "cancellation-policy"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 block mb-0.5">
                  Cancellation policy
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">{cancellationPolicy}</p>
              </div>

              {/* 16. Custom link */}
              <div
                onClick={() => setActiveSection("custom-link")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "custom-link"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 block mb-0.5">
                  Custom link
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">
                  {customSlug ? `homyz/${customSlug}` : "Add details"}
                </p>
              </div>
            </div>
          ) : (
            /* Arrival Guide Mode Sidebar Items (Matches Figma Screenshot 100%) */
            <div className="space-y-3">
              {/* Card 1: Check-in / Check-out */}
              <div
                onClick={() => setActiveSection("check-in-out")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "check-in-out"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-zinc-900 block">Check-In</span>
                  <p className="text-[11px] text-zinc-500 font-semibold">{checkInStart || "3:00 PM"}</p>
                </div>

                <div className="border-t border-indigo-100/80 my-3" />

                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-zinc-900 block">Check-out</span>
                  <p className="text-[11px] text-zinc-500 font-semibold">{checkOutTime || "12:00 PM"}</p>
                </div>
              </div>

              {/* Card 2: Directions */}
              <div
                onClick={() => setActiveSection("directions")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "directions"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 block mb-0.5">
                  Directions
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">
                  {directions && directions.trim() !== ""
                    ? directions.length > 25
                      ? directions.slice(0, 25) + "..."
                      : directions
                    : "Add details"}
                </p>
              </div>

              {/* Card 3: Check-In method */}
              <div
                onClick={() => setActiveSection("check-in-method")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "check-in-method"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 block mb-0.5">
                  Check-In method
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">
                  {checkInMethod === "SMART_LOCK" || checkInMethod === "Smart lock" ? "Smart lock" : checkInMethod || "Smart lock"}
                </p>
              </div>

              {/* Card 4: Wifi details */}
              <div
                onClick={() => setActiveSection("wifi-details")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "wifi-details"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 block mb-0.5">
                  Wifi details
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">
                  {wifiNetwork ? wifiNetwork : "Add details"}
                </p>
              </div>

              {/* Card 5: House manual */}
              <div
                onClick={() => setActiveSection("house-manual")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "house-manual"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 block mb-0.5">
                  House manual
                </span>
                <p className="text-[11px] text-zinc-500 font-normal">
                  {houseManual ? houseManual.slice(0, 30) + "..." : "Add details"}
                </p>
              </div>

              {/* Card 6: Description */}
              <div
                onClick={() => setActiveSection("description")}
                className={`rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
                  activeSection === "description"
                    ? "bg-[#ECE9FE] border-indigo-200 shadow-2xs"
                    : "bg-white border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 block mb-0.5">
                  Description
                </span>
                <p className="text-[11px] text-zinc-500 font-normal line-clamp-2 leading-relaxed">
                  Lorem ipsum massa pellentesque enim lobortis mattis elit lorem morbi viverra nec congue tempus et pellentesque
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
