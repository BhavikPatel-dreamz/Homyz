"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RealMap, LocationDetails } from "@/components/ui/real-map";
import { LocationCoords } from "./types";
import { StepProgressFooter } from "./step-progress-footer";
import { Container } from "@/components/ui";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";
import { ADDRESS_COUNTRIES, formatAddressCountry } from "@/lib/location/address-countries";
import { useLanguage } from "@/lib/i18n/language-context";
import { reverseGeocodeLocation, parseNominatimAddress, type StructuredAddress } from "@/lib/location/geocoding";

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
  showMapPreview?: boolean;
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
  showMapPreview = true,
}: StepAddressConfirmProps) {
  const router = useRouter();
  const { t } = useLanguage();

  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoSuccess, setGeoSuccess] = useState<boolean>(false);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  const handleBack = () => {
    if (!isLoading) {
      router.back();
    }
  };

  const handleUseCurrentLocation = () => {
    if (isLocating || isLoading) return;

    if (typeof window === "undefined" || !navigator || !("geolocation" in navigator)) {
      setGeoError(
        t("host_geo_unsupported", "Geolocation is not supported by your browser.")
      );
      return;
    }

    setIsLocating(true);
    setGeoError(null);
    setGeoSuccess(false);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          let structured: StructuredAddress | null = null;
          try {
            structured = await reverseGeocodeLocation(lat, lng);
          } catch {
            // Fallback handled below
          }

          if (!structured) {
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
                { headers: { "User-Agent": "HomyzApp/1.0", "Accept-Language": "en" } }
              );
              if (res.ok) {
                const data = await res.json();
                structured = parseNominatimAddress(data);
              }
            } catch {
              // Handled below
            }
          }

          if (structured) {
            if (structured.country) {
              setCountry(formatAddressCountry(structured.country, structured.countryCode));
            }
            if (structured.streetAddress) {
              setStreetAddress(structured.streetAddress);
            }
            if (structured.district) {
              setDistrict(structured.district);
            }
            if (structured.city) {
              setCity(structured.city);
            }
            if (structured.postalCode) {
              setPostalCode(structured.postalCode);
            }
            if (structured.formattedAddress) {
              setShortAddress(structured.formattedAddress);
            }

            const details: LocationDetails = {
              address: structured.streetAddress,
              district: structured.district,
              city: structured.city,
              state: structured.state,
              postalCode: structured.postalCode,
              country: structured.country,
              countryCode: structured.countryCode,
              formattedAddress: structured.formattedAddress,
            };

            onLocationChange(lat, lng, details);
          } else {
            const fallbackStr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            setShortAddress(fallbackStr);
            onLocationChange(lat, lng, { formattedAddress: fallbackStr });
          }

          setGeoSuccess(true);
          if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
          successTimeoutRef.current = setTimeout(() => {
            setGeoSuccess(false);
          }, 3500);
        } catch {
          setGeoError(
            t("host_geo_failed", "Unable to detect your address. Please enter it manually.")
          );
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoError(
              t(
                "host_geo_permission_denied",
                "Location access was denied. Please search for your address manually or enable location permissions."
              )
            );
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoError(
              t(
                "host_geo_unavailable",
                "Unable to determine your current location. Please enter your address manually."
              )
            );
            break;
          case error.TIMEOUT:
            setGeoError(
              t(
                "host_geo_timeout",
                "Location request timed out. Please try again or search manually."
              )
            );
            break;
          default:
            setGeoError(
              t(
                "host_geo_unavailable",
                "Unable to determine your current location. Please enter your address manually."
              )
            );
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  return (
    <main className="step-address-confirm min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          {/* Mobile-only close control shared by onboarding steps. */}
          <OnboardingMobileCloseButton disabled={isLoading} />

          <div className="max-w-187.5 mx-auto w-full flex flex-col items-start my-auto">
            {/* Title & Subtitle */}
            <h1 className="mb-2">
              {t("host_address_confirm_title")}
            </h1>
            <p className="sm:mb-6 mb-4">
              {t("host_pin_confirm_desc")}
            </p>

            {/* Current Location Action Button & Status Bar */}
            <div className="w-full mb-4">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={isLocating || isLoading}
                aria-label={t("host_use_current_location", "Use my current location")}
                aria-busy={isLocating}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-[#F9F9FB] hover:bg-zinc-100 active:scale-95 px-4 py-2 text-xs sm:text-sm font-medium text-[#1F1F1F] shadow-2xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1F1F1F]"
              >
                {isLocating ? (
                  <>
                    <span className="size-4 rounded-full border-2 border-[#1F1F1F] border-t-transparent animate-spin shrink-0" />
                    <span>{t("host_detecting_location", "Detecting your location...")}</span>
                  </>
                ) : geoSuccess ? (
                  <>
                    <svg className="size-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-emerald-700 font-medium">{t("host_location_detected", "Location detected")}</span>
                  </>
                ) : (
                  <>
                    <svg className="size-4 text-[#1F1F1F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="7" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                    </svg>
                    <span>{t("host_use_current_location", "Use my current location")}</span>
                  </>
                )}
              </button>

              {/* Dismissible Alert */}
              {geoError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mt-3 flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/95 p-3 sm:p-4 text-xs sm:text-sm font-medium text-rose-800 shadow-md animate-in fade-in"
                >
                  <div className="flex items-start gap-2.5">
                    <svg className="size-4 sm:size-5 shrink-0 text-rose-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="9" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
                    </svg>
                    <span className="leading-snug">{geoError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGeoError(null)}
                    className="shrink-0 text-rose-600 hover:text-rose-800 p-1 rounded-full hover:bg-rose-100 transition-colors cursor-pointer"
                    aria-label={t("common_dismiss", "Dismiss")}
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Address Form Inputs Stack */}
            <div className="flex flex-col gap-3.5 w-full">
              {/* Country / Region Select */}
              <div className="relative w-full">
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-4 pt-7 pb-2 rounded-lg border border-[#1F1F1F] focus:border-[#727272] outline-none text-lg font-medium text-[#1F1F1F] bg-white appearance-none cursor-pointer"
                >
                  <option value="" disabled>{t("host_select_country")}</option>
                  {country && !ADDRESS_COUNTRIES.some((item) => item.value === country) && (
                    <option value={country}>{country}</option>
                  )}
                  {ADDRESS_COUNTRIES.map((item) => (
                    <option key={item.iso2} value={item.value}>{item.value}</option>
                  ))}
                </select>
                <span className="absolute top-1.5 left-4 text-base font-normal text-[#727272] pointer-events-none">
                  {t("host_country_region")}
                </span>
                <svg className="w-5 h-5 text-zinc-600 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>

              {/* Short address */}
              <input
                type="text"
                placeholder={t("host_short_address")}
                value={shortAddress}
                onChange={(e) => setShortAddress(e.target.value)}
                className="w-full px-4 py-2 h-14 rounded-lg border border-[#1F1F1F] focus:border-[#727272] outline-none sm:text-lg text-base font-normal text-[#1F1F1F] bg-white placeholder:text-[#727272]"
              />

              {/* Apt, floor, bldg */}
              <input
                type="text"
                placeholder={t("host_apt_floor_bldg")}
                value={aptFloorBldg}
                onChange={(e) => setAptFloorBldg(e.target.value)}
                className="w-full px-4 py-2 h-14 rounded-lg border border-[#1F1F1F] focus:border-[#727272] outline-none sm:text-lg text-base font-normal text-[#1F1F1F] bg-white placeholder:text-[#727272]"
              />

              {/* Street address */}
              <input
                type="text"
                placeholder={t("host_street_address")}
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                className="w-full px-4 py-2 h-14 rounded-lg border border-[#1F1F1F] focus:border-[#727272] outline-none sm:text-lg text-base font-normal text-[#1F1F1F] bg-white placeholder:text-[#727272]"
              />

              {/* District */}
              <input
                type="text"
                placeholder={t("host_district")}
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-4 py-2 h-14 rounded-lg border border-[#1F1F1F] focus:border-[#727272] outline-none sm:text-lg text-base font-normal text-[#1F1F1F] bg-white placeholder:text-[#727272]"
              />

              {/* Postal code */}
              <input
                type="text"
                placeholder={t("host_postal_code")}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-4 py-2 h-14 rounded-lg border border-[#1F1F1F] focus:border-[#727272] outline-none sm:text-lg text-base font-normal text-[#1F1F1F] bg-white placeholder:text-[#727272]"
              />

              {/* City / Town */}
              <input
                type="text"
                placeholder={t("host_city_town")}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-2 h-14 rounded-lg border border-[#1F1F1F] focus:border-[#727272] outline-none sm:text-lg text-base font-normal text-[#1F1F1F] bg-white placeholder:text-[#727272]"
              />
            </div>

            {showMapPreview && (
              <>
                {/* Show Specific Location Toggle Bar */}
                <div className="w-full my-6">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <h3 className="text-lg font-medium text-[#1F1F1F]">
                      {t("host_show_specific_location")}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowSpecificLocation(!showSpecificLocation)}
                      className={`relative inline-flex sm:h-6 h-5 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        showSpecificLocation ? "bg-[#DF4557]" : "bg-[#DDDDDE]"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block sm:h-5 h-4 sm:w-5 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          showSpecificLocation ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="sm:text-base text-sm font-normal text-[#727272] leading-relaxed max-w-xl">
                    {t("host_show_specific_location_desc")}
                  </p>
                  <button type="button" className="underline text-[#1F1F1F] text-sm font-medium mt-1 inline-block hover:opacity-80">
                    {t("host_learn_more")}
                  </button>
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
              </>
            )}
          </div>

          <StepProgressFooter currentStep={4} onBack={onBack} onNext={onNext} isLoading={isLoading} />
        </div>
      </Container>
    </main>
  );
}
