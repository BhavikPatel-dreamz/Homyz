"use client";

import React from "react";
import Image from "next/image";

import { normalizeAmenityId } from "@/lib/constants/amenities";
import { Container } from "@/components/ui";
import { OnboardingBackButton } from "./onboarding-back-button";
import { OnboardingPrimaryButton } from "./onboarding-primary-button";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";


interface AmenityOption {
  id: string;
  label: string;
  category: "favorites" | "standout" | "safety";
  icon: React.ReactNode;
}

const amenityIconPaths: Record<string, string> = {
  wifi: "/images/icons/wifi.svg",
  tv: "/images/icons/tv.svg",
  kitchen: "/images/icons/kitchen.svg",
  washer: "/images/icons/washer.svg",
  free_parking: "/images/icons/free-parking.svg",
  paid_parking: "/images/icons/paid-parking.svg",
  air_conditioning: "/images/icons/ac.svg",
  workspace: "/images/icons/workspace.svg",
  pool: "/images/icons/pool.svg",
  hot_tub: "/images/icons/hot-tub.svg",
  patio: "/images/icons/patio.svg",
  bbq_grill: "/images/icons/bbg-grill.svg",
  outdoor_dining_area: "/images/icons/outdoor-dining-area.svg",
  fire_pit: "/images/icons/fire-pit.svg",
  pool_table: "/images/icons/pool-table.svg",
  indoor_fireplace: "/images/icons/indoor-fireplace.svg",
  piano: "/images/icons/piano.svg",
  smoke_alarm: "/images/icons/smoke-alarm.svg",
  first_aid_kit: "/images/icons/first-aid-kit.svg",
  fire_extinguisher: "/images/icons/fire-extinguisher.svg",
};

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
        className={`flex items-center gap-3 px-3.25 sm:py-3.25 py-3 rounded-lg border sm:text-base text-sm sm:font-medium font-normal transition-all cursor-pointer select-none text-left ${isSelected
          ? "bg-[#E9EBFF] text-[#1F1F1F]"
          : "bg-white text-[#1F1F1F] hover:border-[#1F1F1F] hover:bg-[#E9EBFF]"
          }`}
      >
        <div
          className="w-10 h-10 rounded-full border border-[#1F1F1F] flex items-center justify-center shrink-0 transition-colors"
        >
          <Image
            src={amenityIconPaths[item.id]}
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
            unoptimized
            className="h-6 w-6 object-contain"
          />
        </div>
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <main className="step-amenities min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">

          {/* Mobile-only close control shared by onboarding steps.  */}
          <OnboardingMobileCloseButton disabled={isLoading} />

          <div className="max-w-[748px] mx-auto w-full flex flex-col items-start my-auto">
            {/* Header & Subtitle */}
            <h1 data-aos="fade-up" className="mb-2">
              Tell guests what your place has to offer
            </h1>
            <p data-aos="fade-up" data-aos-delay="100" className="sm:mb-10 mb-8">
              You can add more amenities after you publish your listing.
            </p>

            <div className="flex flex-col sm:gap-12 gap-8 w-full">
              {/* Section 1: Guest Favorites */}
              <div data-aos="fade-up" data-aos-delay="200">
                <h3 className="text-lg font-medium text-[#1F1F1F] mb-4">
                  What about these quest favorites?
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 sm:gap-3.5 gap-2 w-full">
                  {favoriteAmenities.map(renderAmenityCard)}
                </div>
              </div>

              {/* Section 2: Standout Amenities */}
              <div data-aos="fade-up" data-aos-delay="300">
                <h3 className="text-lg font-medium text-[#1F1F1F] mb-4">
                  Do you have any standout amenities?
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 sm:gap-3.5 gap-2 w-full">
                  {standoutAmenities.map(renderAmenityCard)}
                </div>
              </div>

              {/* Section 3: Safety Items */}
              <div data-aos="fade-up" data-aos-delay="400">
                <h3 className="text-lg font-medium text-[#1F1F1F] mb-4">
                  Do you have any of these safety items?
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 sm:gap-3.5 gap-2 w-full">
                  {safetyItems.map(renderAmenityCard)}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Footer Bar */}
          <div className="max-w-7xl mx-auto w-full flex items-center justify-end sm:mt-8 sm:pt-0 pt-8 mt-auto">
            <OnboardingBackButton
              onClick={onBack}
              disabled={isLoading}
            />
            <OnboardingPrimaryButton
              onClick={onNext}
              isLoading={isLoading}
              label="Next"
            />
          </div>
        </div>
      </Container>
    </main>
  );
}
