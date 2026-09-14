"use client";

import React from "react";
import { RealMap, type LocationDetails } from "@/components/ui/real-map";
import { LocationCoords } from "./types";
import { StepProgressFooter } from "./step-progress-footer";
import { Container } from "@/components/ui";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";

interface StepPinConfirmProps {
  streetAddress: string;
  aptFloorBldg?: string;
  district?: string;
  city: string;
  postalCode?: string;
  country: string;
  coords: LocationCoords;
  onPinChange: (lat: number, lng: number, details?: LocationDetails) => void;
  showSpecificLocation: boolean;
  setShowSpecificLocation: (val: boolean) => void;
  onEditAddress: () => void;
  onBack: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function StepPinConfirm({
  streetAddress,
  aptFloorBldg,
  district,
  city,
  postalCode,
  country,
  coords,
  onPinChange,
  showSpecificLocation,
  setShowSpecificLocation,
  onEditAddress,
  onBack,
  onConfirm,
  isLoading = false,
}: StepPinConfirmProps) {
  const formattedStreet = [streetAddress, aptFloorBldg].filter(Boolean).join(", ");
  const formattedRegion = [district, city, postalCode, country].filter(Boolean).join(", ");

  const handleMapLocationChange = (lat: number, lng: number, details?: LocationDetails) => {
    // Reverse-geocoded details keep the confirmed address in sync with a moved pin.
    onPinChange(lat, lng, details);
  };

  return (
    <main className="step-pin-confirm min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          {/* Mobile close control */}
          <OnboardingMobileCloseButton disabled={isLoading} />

          <div className="max-w-187.5 mx-auto w-full flex flex-col items-start my-auto">
            {/* Title & Subtitle */}
            <h1 className="mb-2">
              Is the pin in the right spot?
            </h1>
            <p className="sm:mb-6 mb-4">
              Your address is only shared with guests after they’ve made a reservation.
            </p>

            {/* Address Summary Bar with Edit button */}
            <div className="w-full rounded-2xl border border-zinc-200 bg-[#F9F9FB] p-4 mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center shrink-0 text-zinc-700 shadow-xs">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <div className="text-left min-w-0">
                  <p className="text-sm font-semibold text-[#1F1F1F] truncate">
                    {formattedStreet || "Street address"}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {formattedRegion || "City, Country"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onEditAddress}
                className="shrink-0 text-xs font-semibold text-zinc-900 underline hover:text-zinc-600 px-3 py-1.5 rounded-lg hover:bg-zinc-200/60 transition-colors cursor-pointer"
              >
                Edit address
              </button>
            </div>

            <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1.5">
              <span>💡</span> Drag the pin or click on the map to place it in the exact right spot.
            </p>

            {/* Interactive Leaflet Map with Draggable Marker */}
            <div className="w-full rounded-3xl overflow-hidden border border-zinc-200 shadow-lg sm:mb-6 mb-8">
              <RealMap
                address={streetAddress}
                city={city}
                country={country}
                lat={coords.lat}
                lng={coords.lng}
                preferInitialCoordinates={true}
                showExactLocation={showSpecificLocation}
                onLocationChange={handleMapLocationChange}
                className="h-[320px] sm:h-[460px] w-full relative z-0"
              />
            </div>

            {/* Show Specific Location Privacy Toggle */}
            <div className="w-full mb-6">
              <div className="flex items-center justify-between gap-4 mb-2">
                <h3 className="text-lg font-medium text-[#1F1F1F]">
                  Show your specific location
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSpecificLocation(!showSpecificLocation)}
                  aria-pressed={showSpecificLocation}
                  aria-label="Toggle show specific location"
                  className={`relative inline-flex sm:h-6 h-5 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    showSpecificLocation ? "bg-[#1F1F1F]" : "bg-[#DDDDDE]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block sm:h-5 h-4 sm:w-5 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      showSpecificLocation ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <p className="sm:text-base text-sm font-normal text-zinc-500 leading-relaxed max-w-xl">
                Show an approximate location to prospective guests while browsing, or display your exact pin. Your full address is only released once a booking is confirmed.
              </p>
            </div>
          </div>

          {/* Footer Controls: Back to address form, Next to confirm pin position */}
          <StepProgressFooter
            currentStep={4}
            onBack={onBack}
            onNext={onConfirm}
            isLoading={isLoading}
          />
        </div>
      </Container>
    </main>
  );
}
