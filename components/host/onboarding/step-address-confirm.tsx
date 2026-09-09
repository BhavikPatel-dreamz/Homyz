"use client";

import React from "react";
import { RealMap, LocationDetails } from "@/components/ui/real-map";
import { LocationCoords } from "./types";
import { StepProgressFooter } from "./step-progress-footer";
import { Container } from "@/components/ui";

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
  return (
    <main className="py-10">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col justify-between animate-in fade-in duration-200">
          <div className="max-w-2xl mx-auto w-full flex flex-col items-start my-auto">
            {/* Title & Subtitle */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1F1F1F] tracking-tight leading-tight mb-2">
              Confirm your address
            </h1>
            <p className="text-sm font-medium text-zinc-500 mb-8">
              Your address is only shared with guests after they’ve made a reservation.
            </p>

            {/* Address Form Inputs Stack */}
            <div className="flex flex-col gap-3.5 w-full mb-8">
              {/* Country / Region Select */}
              <div className="relative w-full">
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-4 pt-7 pb-2 rounded-2xl border border-zinc-300 focus:border-zinc-900 outline-none text-sm font-semibold text-[#1F1F1F] bg-white appearance-none cursor-pointer"
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
                <span className="absolute top-1.5 left-4 text-[11px] font-medium text-zinc-500 pointer-events-none">
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
                className="w-full px-4 py-3.5 rounded-2xl border border-zinc-300 focus:border-zinc-900 outline-none text-sm font-normal text-[#1F1F1F] bg-white placeholder:text-zinc-400 transition-colors"
              />

              {/* Apt, floor, bldg */}
              <input
                type="text"
                placeholder="Apt, floor, bldg (if applicable)"
                value={aptFloorBldg}
                onChange={(e) => setAptFloorBldg(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-zinc-300 focus:border-zinc-900 outline-none text-sm font-normal text-[#1F1F1F] bg-white placeholder:text-zinc-400 transition-colors"
              />

              {/* Street address */}
              <input
                type="text"
                placeholder="Street address"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-zinc-300 focus:border-zinc-900 outline-none text-sm font-normal text-[#1F1F1F] bg-white placeholder:text-zinc-400 transition-colors"
              />

              {/* District */}
              <input
                type="text"
                placeholder="District (if applicable)"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-zinc-300 focus:border-zinc-900 outline-none text-sm font-normal text-[#1F1F1F] bg-white placeholder:text-zinc-400 transition-colors"
              />

              {/* Postal code */}
              <input
                type="text"
                placeholder="Postal code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-zinc-300 focus:border-zinc-900 outline-none text-sm font-normal text-[#1F1F1F] bg-white placeholder:text-zinc-400 transition-colors"
              />

              {/* City / Town */}
              <input
                type="text"
                placeholder="City / Town"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-zinc-300 focus:border-zinc-900 outline-none text-sm font-normal text-[#1F1F1F] bg-white placeholder:text-zinc-400 transition-colors"
              />
            </div>

            {/* Show Specific Location Toggle Bar */}
            <div className="w-full py-4 border-t border-zinc-100 mb-6">
              <div className="flex items-center justify-between gap-4 mb-2">
                <h3 className="text-base font-semibold text-[#1F1F1F]">
                  Show your specific location
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSpecificLocation(!showSpecificLocation)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showSpecificLocation ? "bg-zinc-900" : "bg-zinc-200"
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${showSpecificLocation ? "translate-x-5" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>
              <p className="text-xs font-medium text-zinc-500 leading-relaxed max-w-xl">
                Show an approximate location to prospective guests while browsing, or display your exact pin. Your full address is only released once a booking is confirmed.
              </p>
            </div>

            {/* Real Interactive Leaflet Map Preview */}
            <div className="w-full rounded-3xl overflow-hidden border border-zinc-200 shadow-lg mb-4">
              <RealMap
                address={streetAddress}
                city={city}
                country={country}
                lat={coords.lat}
                lng={coords.lng}
                showExactLocation={showSpecificLocation}
                onLocationChange={onLocationChange}
                className="h-[280px] sm:h-[320px] w-full relative z-0"
              />
            </div>
          </div>

          <StepProgressFooter currentStep={4} onBack={onBack} onNext={onNext} isLoading={isLoading} />
        </div>
      </Container>
    </main>
  );
}
