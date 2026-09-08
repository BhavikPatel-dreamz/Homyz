"use client";

import React from "react";

import { normalizeAmenityId } from "@/lib/constants/amenities";

interface AmenityOption {
  id: string;
  label: string;
  category: "favorites" | "standout" | "safety";
  icon: React.ReactNode;
}

interface StepAmenitiesProps {
  selectedAmenities: string[];
  onToggleAmenity: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepAmenities({
  selectedAmenities,
  onToggleAmenity,
  onBack,
  onNext,
  isLoading = false,
}: StepAmenitiesProps) {

  const favoriteAmenities: AmenityOption[] = [
    {
      id: "wifi",
      label: "Wifi",
      category: "favorites",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
        </svg>
      ),
    },
    {
      id: "tv",
      label: "TV",
      category: "favorites",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-6-3v3m-6.9-3h13.8c.994 0 1.8-.806 1.8-1.8V5.55c0-.994-.806-1.8-1.8-1.8H5.1c-.994 0-1.8.806-1.8 1.8v9.9c0 .994.806 1.8 1.8 1.8z" />
        </svg>
      ),
    },
    {
      id: "kitchen",
      label: "Kitchen",
      category: "favorites",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 009-9H3a9 9 0 009 9zm0 0V3m-4 6h8" />
        </svg>
      ),
    },
    {
      id: "washer",
      label: "Washer",
      category: "favorites",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 3h13.5A2.25 2.25 0 0121 5.25v13.5A2.25 2.25 0 0118.75 21H5.25A2.25 2.25 0 013 18.75V5.25A2.25 2.25 0 015.25 3zm6.75 4.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
        </svg>
      ),
    },
    {
      id: "free_parking",
      label: "Free parking",
      category: "favorites",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM3 9h15l3 4.5V17.25H3V9z" />
        </svg>
      ),
    },
    {
      id: "paid_parking",
      label: "Paid parking",
      category: "favorites",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-9h4.5a2.25 2.25 0 010 4.5H9" />
        </svg>
      ),
    },
    {
      id: "air_conditioning",
      label: "AC",
      category: "favorites",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m-6-6l12-6m0 6L6 9" />
        </svg>
      ),
    },
    {
      id: "workspace",
      label: "Workspace",
      category: "favorites",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
        </svg>
      ),
    },
  ];

  const standoutAmenities: AmenityOption[] = [
    {
      id: "pool",
      label: "Pool",
      category: "standout",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 16.5c2.25 0 3.75 1.5 6 1.5s3.75-1.5 6-1.5 3.75 1.5 6 1.5M3.75 19.5c2.25 0 3.75 1.5 6 1.5s3.75-1.5 6-1.5 3.75 1.5 6 1.5M9 7.5a3 3 0 116 0 3 3 0 01-6 0z" />
        </svg>
      ),
    },
    {
      id: "hot_tub",
      label: "Hot tub",
      category: "standout",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a6 6 0 0012 0v-1.5H3V15zm6-6.75V3m4.5 5.25V4.5m-9 3.75V6" />
        </svg>
      ),
    },
    {
      id: "patio",
      label: "Patio",
      category: "standout",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3L2.25 10.5h19.5L12 3zm0 7.5v10.5m-4.5-6h9" />
        </svg>
      ),
    },
    {
      id: "bbq_grill",
      label: "BBQ grill",
      category: "standout",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        </svg>
      ),
    },
    {
      id: "outdoor_dining_area",
      label: "Outdoor dining area",
      category: "standout",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M6 9h12M9 15h6M12 3v18" />
        </svg>
      ),
    },
    {
      id: "fire_pit",
      label: "Fire pit",
      category: "standout",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c1.5 2 3 3.5 3 6.5a4.5 4.5 0 11-9 0c0-3 1.5-4.5 3-6.5 1.5 2 3 2 3 0z" />
        </svg>
      ),
    },
    {
      id: "pool_table",
      label: "Pool table",
      category: "standout",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm-2.25-9a2.25 2.25 0 114.5 0 2.25 2.25 0 01-4.5 0z" />
        </svg>
      ),
    },
    {
      id: "indoor_fireplace",
      label: "Indoor fireplace",
      category: "standout",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m-6-6h12M4.5 6h15v12h-15V6z" />
        </svg>
      ),
    },
    {
      id: "piano",
      label: "Piano",
      category: "standout",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66a.225.225 0 00.162-.216V6.553z" />
        </svg>
      ),
    },
  ];

  const safetyItems: AmenityOption[] = [
    {
      id: "smoke_alarm",
      label: "Smoke alarm",
      category: "safety",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
      ),
    },
    {
      id: "first_aid_kit",
      label: "First aid kit",
      category: "safety",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "fire_extinguisher",
      label: "Fire extinguisher",
      category: "safety",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        </svg>
      ),
    },
  ];

  const normalizedSelected = selectedAmenities.map(normalizeAmenityId);

  const renderAmenityCard = (item: AmenityOption) => {
    const isSelected = normalizedSelected.includes(item.id);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onToggleAmenity(item.id)}
        className={`flex items-center gap-3 px-5 py-4 rounded-2xl border text-sm font-semibold transition-all cursor-pointer select-none text-left ${
          isSelected
            ? "border-indigo-400 bg-[#EEF2FF] text-[#1F1F1F] ring-1 ring-indigo-400 shadow-xs"
            : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
        }`}
      >
        <div
          className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
            isSelected
              ? "border-indigo-500 bg-white text-indigo-600"
              : "border-zinc-200 bg-white text-zinc-600"
          }`}
        >
          {item.icon}
        </div>
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <main className="flex-1 w-full flex flex-col justify-between px-6 lg:px-16 py-10 my-auto animate-in fade-in duration-200">
      <div className="max-w-4xl mx-auto w-full flex flex-col items-start my-auto">
        {/* Header & Subtitle */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1F1F1F] tracking-tight leading-tight mb-2">
          Tell guests what your place has to offer
        </h1>
        <p className="text-sm font-medium text-zinc-500 mb-10">
          You can add more amenities after you publish your listing.
        </p>

        <div className="flex flex-col gap-8 w-full">
          {/* Section 1: Guest Favorites */}
          <div>
            <h3 className="text-base font-semibold text-[#1F1F1F] mb-4">
              What about these quest favorites?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full">
              {favoriteAmenities.map(renderAmenityCard)}
            </div>
          </div>

          {/* Section 2: Standout Amenities */}
          <div>
            <h3 className="text-base font-semibold text-[#1F1F1F] mb-4">
              Do you have any standout amenities?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full">
              {standoutAmenities.map(renderAmenityCard)}
            </div>
          </div>

          {/* Section 3: Safety Items */}
          <div>
            <h3 className="text-base font-semibold text-[#1F1F1F] mb-4">
              Do you have any of these safety items?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full">
              {safetyItems.map(renderAmenityCard)}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer Bar */}
      <div className="max-w-7xl mx-auto w-full flex items-center justify-end gap-3 pt-8 border-t border-zinc-100 mt-12">
        <button
          type="button"
          onClick={onBack}
          className="px-7 py-2.5 rounded-full border border-zinc-300 hover:bg-zinc-100 text-sm font-semibold text-zinc-800 transition-colors cursor-pointer"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading}
          className="px-8 py-2.5 rounded-full bg-[#FCDF9C] hover:bg-[#ebd08d] text-sm font-semibold text-[#1F1F1F] shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 min-w-[100px]"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-[#1F1F1F] shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading...</span>
            </>
          ) : (
            "Next"
          )}
        </button>
      </div>
    </main>
  );
}
