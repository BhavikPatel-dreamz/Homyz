"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CloseIcon } from "@/components/ui/close-icon";
import { RealMap, LocationDetails } from "@/components/ui/real-map";
import { LocationCoords } from "./types";
import { StepProgressFooter } from "./step-progress-footer";
import { Container } from "@/components/ui";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";


interface StepAddressConfirmProps {
  country: string;
  setCountry: (val: string) => void;
  shortAddress: string;
  setShortAddress: (val: string) => void;
  aptFloorBldg: string;
  setAptFloorBldg: (val: string) => void;
  streetAddress: string;
  setStreetAddress: (val: string) => void;
  district: string;
  setDistrict: (val: string) => void;
  postalCode: string;
  setPostalCode: (val: string) => void;
  city: string;
  setCity: (val: string) => void;
  showSpecificLocation: boolean;
  setShowSpecificLocation: (val: boolean) => void;
  coords: LocationCoords;
  onLocationChange: (lat: number, lng: number, details?: LocationDetails) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepAddressConfirm({
  country,
  setCountry,
  shortAddress,
  setShortAddress,
  aptFloorBldg,
  setAptFloorBldg,
  streetAddress,
  setStreetAddress,
  district,
  setDistrict,
  postalCode,
  setPostalCode,
  city,
  setCity,
  showSpecificLocation,
  setShowSpecificLocation,
  coords,
  onLocationChange,
  onBack,
  onNext,
  isLoading = false,
}: StepAddressConfirmProps) {

  const router = useRouter();

  const handleBack = () => {
    if (!isLoading) {
      router.back();
    }
  };
  return (
    <main className="step-address-confirm min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">

          {/* Mobile-only close control shared by onboarding steps.  */}
          <OnboardingMobileCloseButton disabled={isLoading} />

          
          <div className="max-w-187.5 mx-auto w-full flex flex-col items-start my-auto">
            {/* Title & Subtitle */}
            <h1 className="mb-2">
              Confirm your address
            </h1>
            <p className="sm:mb-8.75 mb-8">
              Your address is only shared with guests after they’ve made a reservation.
            </p>

            {/* Address Form Inputs Stack */}
            <div className="flex flex-col gap-3.5 w-full">
              {/* Country / Region Select */}
              <div className="relative w-full">
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-4 pt-7 pb-2 rounded-lg border border-[#1F1F1F] focus:border-[#727272] outline-none text-lg font-medium text-[#1F1F1F] bg-white appearance-none cursor-pointer"
                >
                  <option value="Saudi Arabia - SA">Saudi Arabia - SA</option>
                  <option value="United Arab Emirates - AE">United Arab Emirates - AE</option>
                  <option value="Kuwait - KW">Kuwait - KW</option>
                  <option value="Qatar - QA">Qatar - QA</option>
                  <option value="Bahrain - BH">Bahrain - BH</option>
                  <option value="Oman - OM">Oman - OM</option>
                  <option value="United States - US">United States - US</option>
                  <option value="United Kingdom - GB">United Kingdom - GB</option>
                </select>
                <span className="absolute top-1.5 left-4 text-base font-normal text-[#727272] pointer-events-none">
                  Country / region
                </span>
                <svg className="w-5 h-5 text-zinc-600 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>

              {/* Short address */}
              <input
                type="text"
                placeholder="Short address (if applicable)"
                value={shortAddress}
                onChange={(e) => setShortAddress(e.target.value)}
                className="w-full px-4 py-2 h-14 rounded-lg border border-[#1F1F1F] focus:border-[#727272] outline-none sm:text-lg text-base font-normal text-[#1F1F1F] bg-white placeholder:text-[#727272]"
              />

              {/* Apt, floor, bldg */}
              <input
                type="text"
                placeholder="Apt, floor, bldg (if applicable)"
                value={aptFloorBldg}
                onChange={(e) => setAptFloorBldg(e.target.value)}
                className="w-full px-4 py-2 h-14 rounded-lg border border-[#1F1F1F] focus:border-[#727272] outline-none sm:text-lg text-base font-normal text-[#1F1F1F] bg-white placeholder:text-[#727272]"
              />

              {/* Street address */}
              <input
                type="text"
                placeholder="Street address"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                className="w-full px-4 py-2 h-14 rounded-lg border border-[#1F1F1F] focus:border-[#727272] outline-none sm:text-lg text-base font-normal text-[#1F1F1F] bg-white placeholder:text-[#727272]"
              />

              {/* District */}
              <input
                type="text"
                placeholder="District (if applicable)"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-4 py-2 h-14 rounded-lg border border-[#1F1F1F] focus:border-[#727272] outline-none sm:text-lg text-base font-normal text-[#1F1F1F] bg-white placeholder:text-[#727272]"
              />

              {/* Postal code */}
              <input
                type="text"
                placeholder="Postal code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-4 py-2 h-14 rounded-lg border border-[#1F1F1F] focus:border-[#727272] outline-none sm:text-lg text-base font-normal text-[#1F1F1F] bg-white placeholder:text-[#727272]"
              />

              {/* City / Town */}
              <input
                type="text"
                placeholder="City / Town"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-2 h-14 rounded-lg border border-[#1F1F1F] focus:border-[#727272] outline-none sm:text-lg text-base font-normal text-[#1F1F1F] bg-white placeholder:text-[#727272]"
              />
            </div>

            {/* Show Specific Location Toggle Bar */}
            <div className="w-full my-6">
              <div className="flex items-center justify-between gap-4 mb-2">
                <h3 className="text-lg font-medium text-[#1F1F1F]">
                  Show your specific location
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSpecificLocation(!showSpecificLocation)}
                  className={`relative inline-flex sm:h-6 h-5 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showSpecificLocation ? "bg-[#1F1F1F]" : "bg-[#DDDDDE]"
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block sm:h-5 h-4 sm:w-5 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${showSpecificLocation ? "translate-x-5" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>
              <p className="sm:text-base text-sm font-normal text-zinc-500 leading-relaxed max-w-xl">
                Show an approximate location to prospective guests while browsing, or display your exact pin. Your full address is only released once a booking is confirmed.
              </p>
            </div>

            {/* Real Interactive Leaflet Map Preview */}
            <div className="w-full rounded-3xl overflow-hidden border border-zinc-200 shadow-lg sm:mb-4 mb-12">
              <RealMap
                address={streetAddress}
                city={city}
                country={country}
                lat={coords.lat}
                lng={coords.lng}
                showExactLocation={showSpecificLocation}
                onLocationChange={onLocationChange}
                className="h-[256px] sm:h-[482px] w-full relative z-0"
              />
            </div>
          </div>

          <StepProgressFooter currentStep={4} onBack={onBack} onNext={onNext} isLoading={isLoading} />
        </div>
      </Container>
    </main>
  );
}
