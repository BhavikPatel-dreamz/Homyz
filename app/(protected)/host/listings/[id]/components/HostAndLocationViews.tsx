"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { BackButton } from "@/components/ui/back-button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { RealMap, type LocationDetails } from "@/components/ui/real-map";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import type { StructuredAddress } from "@/lib/location/geocoding";
import {
  inviteListingCoHostAction,
  revokeListingCoHostAction,
} from "@/actions/host/cohosts";
import { updateHostPublicProfileAction } from "@/actions/host/profile";
import { updateProfileAction } from "@/actions/user/updateProfile";
import { BUILTIN_TRAVEL_STAMPS } from "@/lib/stamps/stamps-data";
import { TravelStampGraphic } from "@/components/stamps/travel-stamp-graphics";
import { WhereIveBeenSelector } from "@/components/profile/where-ive-been-selector";
import { COUNTRY_CODES, getCountryByCallingCode } from "@/lib/auth/country-codes";
import { getLanguageNameById, LANGUAGE_OPTIONS } from "@/lib/utils/language-options";
import {
  LocationSkeleton,
  AboutHostSkeleton,
  CoHostSkeleton,
} from "./YourSpaceSkeletons";
import { AdminAboutHostView } from "@/app/(protected)/admin/listings/[id]/components/AdminAboutHostView";
import { HostAboutHostView } from "./HostAboutHostView";
import { CloseIcon } from "@/components/ui/close-icon";

type CoHost = {
  id: string;
  email: string | null;
  phone: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "REVOKED";
  invitedAt: Date | string;
  expiresAt: Date | string | null;
  acceptedAt: Date | string | null;
  user: { id: string; name: string | null; image: string | null } | null;
};
export type HostProfile = {
  name: string | null;
  image: string | null;
  createdAt: Date | string;
  publicProfile: Record<string, unknown> | null;
  email?: string | null;
  rating?: number | null;
};
interface Props {
  activeSection: string;
  onBack: () => void;
  isSaving: boolean;
  isLoading?: boolean;
  handleSaveSection: (sectionKey: "location") => void;
  editAddress: string;
  setEditAddress: (value: string) => void;
  editApartment?: string;
  setEditApartment?: (value: string) => void;
  neighborhoodDescription: string;
  setNeighborhoodDescription: (value: string) => void;
  gettingAround: string;
  setGettingAround: (value: string) => void;
  scenicViews: Record<string, boolean>;
  setScenicViews: (value: Record<string, boolean>) => void;
  locationFeatures: string[];
  setLocationFeatures: (value: string[]) => void;
  editCity: string;
  setEditCity: (value: string) => void;
  editDistrict: string;
  setEditDistrict: (value: string) => void;
  editPostalCode: string;
  setEditPostalCode: (value: string) => void;
  editCountry: string;
  setEditCountry: (value: string) => void;
  latitude: number | null;
  longitude: number | null;
  setLatitude: (value: number | null) => void;
  setLongitude: (value: number | null) => void;
  locationResolutionError: string | null;
  setLocationResolutionError: (value: string | null) => void;
  locationIsResolving: boolean;
  setLocationIsResolving: (value: boolean) => void;
  showExactLocation: boolean;
  setShowExactLocation: (value: boolean) => void;
  addressPrivacyForCancellation: boolean;
  setAddressPrivacyForCancellation: (value: boolean) => void;
  openLocationAccordion?: string | null;
  setOpenLocationAccordion?: (val: string | null) => void;
  listingId: string;
  coHosts: CoHost[];
  setCoHosts: React.Dispatch<React.SetStateAction<CoHost[]>>;
  hostProfile: HostProfile;
  onHostProfileSaved: (
    profile: Record<string, unknown>,
    hostUpdate?: Pick<HostProfile, "image">,
  ) => void;
  presentation?: "host" | "admin";
  canEdit?: boolean;
}
const LOCATION_FEATURES = [
  ["near_public_transport", "Near public transport"],
  ["near_landmarks", "Near landmarks"],
  ["resort_access", "Resort access"],
  ["beach_access", "Beach access"],
  ["lake_access", "Lake access"],
  ["quiet_neighborhood", "Quiet neighborhood"],
] as const;

const SCENIC_VIEWS = [
  ["bay_view", "Bay view"],
  ["marina_view", "Marina view"],
  ["beach_view", "Beach view"],
  ["mountain_view", "Mountain view"],
  ["canal_view", "Canal view"],
  ["ocean_view", "Ocean view"],
  ["city_skyline_view", "City skyline view"],
  ["park_view", "Park view"],
  ["courtyard_view", "Courtyard view"],
  ["pool_view", "Pool view"],
  ["desert_view", "Desert view"],
  ["resort_view", "Resort view"],
  ["garden_view", "Garden view"],
  ["river_view", "River view"],
  ["golf_course_view", "Golf course view"],
  ["sea_view", "Sea view"],
  ["harbor_view", "Harbor view"],
  ["valley_view", "Valley view"],
  ["lake_view", "Lake view"],
  ["vineyard_view", "Vineyard view"],
] as const;
function Toggle({
  checked,
  onChange,
  tone = "amber",
}: {
  checked: boolean;
  onChange: () => void;
  tone?: "amber" | "rose";
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? tone === "rose" ? "bg-[#EF4662]" : "bg-[#DF4557]" : "bg-[#DDDDDE] dark:bg-zinc-700"}`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white dark:bg-zinc-100 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-600 transition-transform ${checked ? "translate-x-5.5" : "translate-x-0.5"}`}
      />
    </button>
  );
}
function initials(name: string | null) {
  return (name || "Host")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
export function HostAndLocationViews(props: Props) {
  if (props.activeSection === "location") return <LocationView {...props} />;
  if (props.activeSection === "about-host") {
    if (props.presentation === "admin") {
      return (
        <AdminAboutHostView
          listingId={props.listingId}
          hostProfile={props.hostProfile}
          onHostProfileSaved={props.onHostProfileSaved}
          canEdit={props.canEdit ?? true}
        />
      );
    }
    return <AboutHostView {...props} />;
  }
  if (props.activeSection === "co-host") return <CoHostView {...props} />;
  return null;
}
function LocationContextEditor(props: Props) {
  const toggleFeature = (id: string) =>
    props.setLocationFeatures(
      props.locationFeatures.includes(id)
        ? props.locationFeatures.filter((value) => value !== id)
        : [...props.locationFeatures, id],
    );
  const toggleView = (id: string) =>
    props.setScenicViews({
      ...props.scenicViews,
      [id]: !props.scenicViews[id],
    });
  return (
    <section className="max-w-xl space-y-5 pb-10">
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Location features</h2>
        <p className="text-xs text-zinc-500">
          Choose up to three location advantages. Beach access is managed as an
          amenity.
        </p>
        {LOCATION_FEATURES.map(([id, label]) => (
          <FeatureToggle
            key={id}
            label={label}
            checked={props.locationFeatures.includes(id)}
            onChange={() => toggleFeature(id)}
          />
        ))}
        <SaveButton
          saving={props.isSaving}
          onSave={() => props.handleSaveSection("location")}
        />
      </section>
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Neighborhood</h2>
        <p className="text-xs text-zinc-500">
          Tell guests what they can expect from the neighborhood and what is
          nearby.
        </p>
        <textarea
          value={props.neighborhoodDescription}
          maxLength={2000}
          onChange={(event) =>
            props.setNeighborhoodDescription(event.target.value)
          }
          placeholder="Describe the area, attractions, and local conveniences."
          className="input min-h-28"
        />
        <SaveButton
          saving={props.isSaving}
          onSave={() => props.handleSaveSection("location")}
        />
      </section>
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Getting around</h2>
        <textarea
          value={props.gettingAround}
          maxLength={2000}
          onChange={(event) => props.setGettingAround(event.target.value)}
          placeholder="Share transit, parking, walking, rideshare, or nearby stations."
          className="input min-h-28"
        />
        <SaveButton
          saving={props.isSaving}
          onSave={() => props.handleSaveSection("location")}
        />
      </section>
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Scenic views</h2>
        <div className="grid grid-cols-2 gap-3">
          {SCENIC_VIEWS.map(([id, label]) => (
            <FeatureToggle
              key={id}
              label={label}
              checked={Boolean(props.scenicViews[id])}
              onChange={() => toggleView(id)}
            />
          ))}
        </div>
        <SaveButton
          saving={props.isSaving}
          onSave={() => props.handleSaveSection("location")}
        />
      </section>
    </section>
  );
}
function LocationView(props: Props) {
  const {
    editAddress,
    setEditAddress,
    editApartment = "",
    setEditApartment,
    editDistrict,
    setEditDistrict,
    editCity,
    setEditCity,
    editPostalCode,
    setEditPostalCode,
    editCountry,
    setEditCountry,
    latitude,
    longitude,
    setLatitude,
    setLongitude,
    locationResolutionError,
    setLocationResolutionError,
    locationIsResolving,
    setLocationIsResolving,
    neighborhoodDescription,
    setNeighborhoodDescription,
    gettingAround,
    setGettingAround,
    scenicViews,
    setScenicViews,
    locationFeatures,
    setLocationFeatures,
    showExactLocation,
    setShowExactLocation,
    addressPrivacyForCancellation,
    setAddressPrivacyForCancellation,
    isSaving,
    handleSaveSection,
    isLoading,
    openLocationAccordion,
    setOpenLocationAccordion,
    onBack,
  } = props;

  const [internalOpen, setInternalOpen] = useState<string | null>("sharing");
  const open = openLocationAccordion !== undefined ? openLocationAccordion : internalOpen;
  const setOpen = setOpenLocationAccordion ?? setInternalOpen;

  // Search query input initialized from available address fields
  const [searchQuery, setSearchQuery] = useState(() =>
    [editAddress, editDistrict, editCity, editCountry].filter(Boolean).join(", ")
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync search input if address is externally updated
  useEffect(() => {
    if (!searchQuery && (editAddress || editCity)) {
      setSearchQuery([editAddress, editDistrict, editCity, editCountry].filter(Boolean).join(", "));
    }
  }, [editAddress, editDistrict, editCity, editCountry]);

  const handleAutocompleteSelect = (selected: StructuredAddress) => {
    setSearchQuery(selected.formattedAddress);
    setLatitude(selected.latitude);
    setLongitude(selected.longitude);
    setLocationResolutionError(null);
    setLocationIsResolving(false);
    setValidationError(null);

    const street = selected.streetAddress || selected.formattedAddress.split(",")[0].trim();
    setEditAddress(street);
    if (selected.district) setEditDistrict(selected.district);
    if (selected.city) setEditCity(selected.city);
    if (selected.postalCode) setEditPostalCode(selected.postalCode);
    if (selected.country) setEditCountry(selected.country);
  };

  const handleMapLocationChange = (lat: number, lng: number, details?: LocationDetails) => {
    setLatitude(lat);
    setLongitude(lng);
    setLocationResolutionError(null);
    setLocationIsResolving(false);
    setValidationError(null);

    if (details) {
      if (details.address) setEditAddress(details.address);
      if (details.apartment && setEditApartment) setEditApartment(details.apartment);
      if (details.district) setEditDistrict(details.district);
      if (details.city) setEditCity(details.city);
      if (details.postalCode) setEditPostalCode(details.postalCode);
      if (details.country) setEditCountry(details.country);

      if (details.formattedAddress) {
        setSearchQuery(details.formattedAddress);
      } else {
        const fullStr = [
          details.address || editAddress,
          details.district || editDistrict,
          details.city || editCity,
          details.country || editCountry,
        ]
          .filter(Boolean)
          .join(", ");
        if (fullStr) setSearchQuery(fullStr);
      }
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  const handleSave = () => {
    if (!editAddress.trim() && !editCity.trim()) {
      setValidationError("Please enter an address or city for this listing.");
      return;
    }
    if (latitude === null || longitude === null || isNaN(latitude) || isNaN(longitude)) {
      setValidationError("Please choose a location on the map or search an address.");
      return;
    }
    setValidationError(null);
    handleSaveSection("location");
  };

  return (
    <div className="w-full max-w-[880px] space-y-3 pb-10 sm:space-y-5">
      <div className="relative flex items-start gap-6 pt-1 sm:pt-0">
        <BackButton onClick={onBack} className="mt-1" />
        <h1>Location</h1>
        <button
          type="button"
          onClick={onBack}
          aria-label="Close location editor"
          className="absolute right-0 top-1 flex size-10 items-center justify-center text-4xl font-normal leading-none text-[#1F1F1F] dark:text-zinc-100 sm:hidden"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>



      {isLoading ? (
        <LocationSkeleton />
      ) : (
        <>
          {/* Interactive map with draggable pin */}
          <div className="space-y-2 pt-3 sm:pt-8">
            <div className="overflow-hidden rounded-[20px] border border-[#1F1F1F] dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
              <RealMap
                address={editAddress}
                city={editCity}
                country={editCountry}
                lat={latitude ?? undefined}
                lng={longitude ?? undefined}
                preferInitialCoordinates={true}
                showExactLocation={showExactLocation}
                onLocationChange={handleMapLocationChange}
                onLocationError={(message) => {
                  setLocationIsResolving(false);
                  setLocationResolutionError(message);
                }}
                className="relative z-0 h-[256px] w-full sm:h-[482px]"
              />
            </div>

            {locationIsResolving && (
              <p className="text-xs text-amber-700 dark:text-amber-400 animate-pulse">Finding this address on the map…</p>
            )}

            {(locationResolutionError || validationError) && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300 font-medium"
              >
                {validationError || locationResolutionError}
              </p>
            )}
          </div>

          {/* 3. Address Details Accordion */}
          <Card
            title="Address"
            summary={[editAddress, editCity, editPostalCode, editCountry].filter(Boolean).join(", ") || "Add location, Post Code, Country"}
            open={open === "address"}
            onToggle={() => setOpen(open === "address" ? "" : "address")}
          >
            <div className="space-y-3">
              <AddressAutocomplete
                value={searchQuery}
                onChange={setSearchQuery}
                onSelect={handleAutocompleteSelect}
                onClear={handleClearSearch}
                placeholder="Search by street, building, city, or postal code..."
              />
              <div>
                <label className="text-base font-normal text-[#1f1f1f] dark:text-zinc-200 block mb-1">
                  Street address
                </label>
                <input
                  value={editAddress}
                  onChange={(e) => {
                    setEditAddress(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder="Street and house or building number"
                  className="input"
                />
              </div>

              <div>
                <label className="text-base font-normal text-[#1f1f1f] dark:text-zinc-200 block mb-1">
                  Apt, suite, unit (optional)
                </label>
                <input
                  value={editApartment}
                  onChange={(e) => setEditApartment?.(e.target.value)}
                  placeholder="Apartment, unit, or suite number"
                  className="input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-base font-normal text-[#1f1f1f] dark:text-zinc-200 block mb-1">
                    District / Neighborhood
                  </label>
                  <input
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    placeholder="District or neighborhood"
                    className="input"
                  />
                </div>
                <div>
                  <label className="text-base font-normal text-[#1f1f1f] dark:text-zinc-200 block mb-1">
                    City
                  </label>
                  <input
                    value={editCity}
                    onChange={(e) => {
                      setEditCity(e.target.value);
                      setValidationError(null);
                    }}
                    placeholder="City"
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-base font-normal text-[#1f1f1f] dark:text-zinc-200 block mb-1">
                    Postal code
                  </label>
                  <input
                    value={editPostalCode}
                    onChange={(e) => setEditPostalCode(e.target.value)}
                    placeholder="Postal code"
                    className="input"
                  />
                </div>
                <div>
                  <label className="text-base font-normal text-[#1f1f1f] dark:text-zinc-200 block mb-1">
                    Country
                  </label>
                  <input
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    placeholder="Country"
                    className="input"
                  />
                </div>
              </div>

              <div className="pt-2">
                <SaveButton saving={isSaving} onSave={handleSave} />
              </div>
            </div>
          </Card>

          {/* 4. Location Sharing */}
          <Card
            title="Location sharing"
            summary="Show listing’s specific location"
            open={open === "sharing"}
            onToggle={() => setOpen(open === "sharing" ? "" : "sharing")}
            mutedWhenOpen
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100">Show you specific location</p>
                <p className="mt-1 text-sm leading-5 text-[#727272] dark:text-zinc-400">
                  Guests can see your exact pinpoint location before booking. When disabled, they only see an approximate general area until a reservation is confirmed.
                </p>
              </div>
              <Toggle
                checked={showExactLocation}
                onChange={() => setShowExactLocation(!showExactLocation)}
                tone="rose"
              />
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-[#DDDDDE] dark:border-zinc-700 pt-4">
              <div>
                <p className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100">Address privacy for cancellation</p>
                <p className="mt-1 text-sm leading-5 text-[#727272] dark:text-zinc-400">
                  Keep your full address private until a reservation is confirmed, even when a guest cancels.
                </p>
              </div>
              <Toggle
                checked={addressPrivacyForCancellation}
                onChange={() => setAddressPrivacyForCancellation(!addressPrivacyForCancellation)}
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="rounded-full bg-[#FEE08B] border border-[#FEE08B] hover:border-[#1f1f1f] text-[#1F1F1F]  hover:bg-[#1f1f1f] hover:text-white font-medium text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setOpen("")}
                className="rounded-full border border-[#1f1f1f] hover:border-[#1f1f1f] bg-white hover:bg-[#1f1f1f] text-[#1f1f1f] font-medium hover:text-white text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </Card>

          {/* 5. Location Features */}
          <Card
            title="Location features"
            summary={locationFeatures.length > 0 ? `${locationFeatures.length} selected` : "Add details"}
            open={open === "features"}
            onToggle={() => setOpen(open === "features" ? "" : "features")}
            mutedWhenOpen
          >
            <div className="grid grid-cols-1 gap-x-12 sm:grid-cols-2 sm:gap-x-16">
              {LOCATION_FEATURES.map(([id, label]) => (
                <div key={id} className="py-2.5 sm:py-3">
                  <div className="flex items-start justify-between gap-4 border-b border-[#D7D7D7] dark:border-zinc-700 pb-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-normal leading-6 text-[#1F1F1F] dark:text-zinc-100">{label}</div>
                      <div className="mt-1 text-[14px] font-normal leading-5 text-[#727272] dark:text-zinc-400">Highlight this feature for prospective guests</div>
                    </div>
                    <Toggle
                      checked={locationFeatures.includes(id)}
                      onChange={() =>
                        setLocationFeatures(
                          locationFeatures.includes(id)
                            ? locationFeatures.filter((value) => value !== id)
                            : [...locationFeatures, id],
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-full bg-[#FEE08B] border border-[#FEE08B] hover:border-[#1f1f1f] text-[#1F1F1F]  hover:bg-[#1f1f1f] hover:text-white font-medium text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setOpen("")}
                className="rounded-full border border-[#1f1f1f] hover:border-[#1f1f1f] bg-white hover:bg-[#1f1f1f] text-[#1f1f1f] font-medium hover:text-white text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </Card>

          {/* 6. Neighborhood Description */}
          <Card
            title="Neighborhood description"
            summary="Add details"
            open={open === "neighborhood"}
            onToggle={() => setOpen(open === "neighborhood" ? "" : "neighborhood")}
          >
            <textarea
              value={neighborhoodDescription}
              maxLength={2000}
              onChange={(e) => setNeighborhoodDescription(e.target.value)}
              placeholder="Describe the area, attractions, and local conveniences."
              className="input min-h-28"
            />
            <p className="text-right text-xs text-zinc-400">
              {neighborhoodDescription.length}/2000
            </p>
            <SaveButton saving={isSaving} onSave={handleSave} />
          </Card>

          {/* 7. Getting Around */}
          <Card
            title="Getting around"
            summary="Add details"
            open={open === "getting-around"}
            onToggle={() => setOpen(open === "getting-around" ? "" : "getting-around")}
          >
            <textarea
              value={gettingAround}
              maxLength={2000}
              onChange={(e) => setGettingAround(e.target.value)}
              placeholder="Share transit, parking, walking, rideshare, or nearby stations."
              className="input min-h-28"
            />
            <p className="text-right text-xs text-zinc-400">
              {gettingAround.length}/2000
            </p>
            <SaveButton saving={isSaving} onSave={handleSave} />
          </Card>

          {/* 8. Scenic Views */}
          <Card
            title="Scenic views"
            summary="Add details"
            open={open === "views"}
            onToggle={() => setOpen(open === "views" ? "" : "views")}
          >
            <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-6">
              {SCENIC_VIEWS.map(([id, label]) => (
                <FeatureToggle
                  key={id}
                  label={label}
                  checked={Boolean(scenicViews[id])}
                  onChange={() =>
                    setScenicViews({ ...scenicViews, [id]: !scenicViews[id] })
                  }
                />
              ))}
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-full bg-[#FEE08B] border border-[#FEE08B] hover:border-[#1f1f1f] text-[#1F1F1F]  hover:bg-[#1f1f1f] hover:text-white font-medium text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setOpen("")}
                className="rounded-full border border-[#1f1f1f] hover:border-[#1f1f1f] bg-white hover:bg-[#1f1f1f] text-[#1f1f1f] font-medium hover:text-white text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
function Card({
  title,
  summary,
  open,
  onToggle,
  mutedWhenOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  mutedWhenOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-white dark:border-zinc-700 shadow-[0_2px_4px_rgba(0,0,0,0.2)] ${open && mutedWhenOpen ? "bg-[#F3F4F5] dark:bg-zinc-800/90" : "bg-white dark:bg-zinc-800"}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-base font-medium text-[#1F1F1F] dark:text-zinc-100">{title}</span>
          {summary && !open && <span className="mt-0.5 block truncate text-[14px] font-normal text-[#727272] dark:text-zinc-400">{summary}</span>}
        </span>
        <span className={`flex size-6 shrink-0 items-center justify-center transition-transform duration-200 ease-out ${open ? "rotate-180" : "rotate-[270deg]"}`}>
          <Image src="/images/icons/chevron-down-dark.svg" alt={open ? "Collapse" : "Expand"} width={16} height={16} className="size-4 object-contain dark:invert" />
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-[#DDDDDE] dark:border-zinc-700 px-4 pb-4 pt-3.5">{children}</div>
      )}
    </section>
  );
}
function FeatureToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-700 py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <span className="block text-sm text-zinc-700 dark:text-zinc-200">{label}</span>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}
function SaveButton({
  saving,
  onSave,
}: {
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <button
      type="button"
      disabled={saving}
      onClick={onSave}
      className="cursor-pointer rounded-full border border-[#FCDF9C] bg-[#FCDF9C] dark:bg-amber-400 dark:border-amber-400 dark:text-zinc-950 px-5 py-2 text-sm font-medium text-[#1F1F1F] transition-colors duration-300 hover:border-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white dark:hover:bg-zinc-700 dark:hover:text-white dark:hover:border-zinc-600 disabled:opacity-60"
    >
      {saving ? "Saving…" : "Save"}
    </button>
  );
}
const REFERENCE_INTERESTS = [
  "Architecture", "Cooking", "Food", "History", "Music", "Outdoors", "Photography", "Sports", "Travel",
] as const;

function getPrompt(raw: Record<string, unknown>, key: string): string {
  const prompts = raw.prompts;
  if (!prompts || typeof prompts !== "object" || Array.isArray(prompts)) return "";
  const value = (prompts as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function getStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function getTagList(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return getStringList(value);
}

function getLanguageIds(value: unknown): string[] {
  if (Array.isArray(value)) return getStringList(value);
  if (typeof value !== "string") return [];
  return value.split(/,|\sand\s/i).map((name) => LANGUAGE_OPTIONS.find((language) => language.name.toLowerCase() === name.trim().toLowerCase())?.id).filter((id): id is string => Boolean(id));
}

function AboutHostView(props: Props) {
  return (
    <HostAboutHostView
      listingId={props.listingId}
      hostProfile={props.hostProfile}
      onHostProfileSaved={props.onHostProfileSaved}
      isLoading={props.isLoading}
    />
  );
}
function CoHostView(props: Props) {
  const { listingId, coHosts, setCoHosts, onBack } = props;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+39");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const selectedCountry = getCountryByCallingCode(countryCode);
  const phone = phoneNumber.trim()
    ? `${countryCode}${phoneNumber.replace(/\D/g, "")}`
    : "";
  const hasEmail = email.trim().length > 0;
  const hasPhone = phone.length > countryCode.length;

  const closeModal = () => {
    if (saving) return;
    setOpen(false);
    setInviteError(null);
  };
  const openModal = () => {
    setInviteError(null);
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        setOpen(false);
        setInviteError(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, saving]);
  const invite = async () => {
    if (!hasEmail && !hasPhone) {
      setInviteError("Enter a phone number or an email address.");
      return;
    }
    if (hasEmail && hasPhone) {
      setInviteError("Use either a phone number or an email address, not both.");
      return;
    }
    setSaving(true);
    setInviteError(null);
    const result = await inviteListingCoHostAction(listingId, hasEmail ? { email: email.trim() } : { phone });
    setSaving(false);
    if (result.ok) {
      setCoHosts((items) => [result.data as CoHost, ...items]);
      setOpen(false);
      setEmail("");
      setPhoneNumber("");
      setMessage(
        hasEmail
          ? "Invitation email queued. Ask your co-host to check their inbox and spam folder."
          : "Text invitation sent.",
      );
    } else setInviteError(result.fieldErrors?.email || result.fieldErrors?.phone || result.error);
  };
  const revoke = async (id: string) => {
    if (!window.confirm("Remove this co-host or cancel this invitation?"))
      return;
    const result = await revokeListingCoHostAction(listingId, id);
    if (result.ok)
      setCoHosts((items) =>
        items.map((item) => (item.id === id ? (result.data as CoHost) : item)),
      );
    else setMessage(result.error);
  };
  const active = coHosts.filter(
    (item) => item.status === "PENDING" || item.status === "ACCEPTED",
  );
  return (
    <div className="w-full max-w-full space-y-5 pb-10 lg:max-w-[calc(100%-75px)]">
      <div className="flex items-start gap-6">
        <BackButton onClick={onBack} className="mt-2" />
        <div className="flex w-full justify-between">
          <div className="flex flex-col items-start">
            <h1>Co-hosts</h1>
            <p className="mt-1 text-sm font-normal text-[#727272]">
              Accepted co-hosts are active, pending invitations are not.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={openModal}
              className="rounded-full bg-[#FEE08B] px-5 py-2.5 text-sm font-medium transition-colors text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 duration-300"
            >
              Invite co-host
            </button>
          </div>
        </div>
      </div>

      {props.isLoading ? (
        <CoHostSkeleton />
      ) : (
        <>
          {message && <p aria-live="polite" className="text-sm text-zinc-600">{message}</p>}
          {active.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
              No co-hosts or pending invitations.
            </p>
          ) : (
            <div className="space-y-3">
              {active.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {item.user?.name || item.email || item.phone}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {item.status === "PENDING"
                        ? `Invitation pending${item.email ? " · sent by email" : " · sent by text"}`
                        : "Accepted co-host"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revoke(item.id)}
                    className="text-xs font-semibold underline"
                  >
                    {item.status === "PENDING" ? "Cancel" : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {open && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-[340px] overflow-y-auto rounded-2xl bg-white px-6 py-7 text-[#222222] shadow-[0_18px_55px_rgba(0,0,0,0.16)] sm:max-w-[390px] sm:px-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-medium" id={titleId}>Add your co-host&apos;s info</h3>
                <p id={descriptionId} className="mt-1.5 text-[14px] leading-5 text-[#717171]">
                  We&apos;ll text or email them the invite
                </p>
              </div>
              <button
                type="button"
                aria-label="Close invite co-host dialog"
                onClick={closeModal}
                disabled={saving}
                className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-[26px] font-light leading-none transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-40"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>

            <form
              className="mt-6"
              onSubmit={(event) => {
                event.preventDefault();
                void invite();
              }}
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)]">
                <label className="block min-w-0 text-sm font-medium leading-5">
                  Country code <span aria-hidden="true">*</span>
                  <span className="relative mt-1.5 block">
                    <select
                      value={countryCode}
                      onChange={(event) => setCountryCode(event.target.value)}
                      aria-label="Country code"
                      className="h-11 w-full appearance-none rounded-lg border border-[#b0b0b0] bg-white px-2.5 pr-7 text-sm text-[#1f1f1f] outline-none transition focus:border-zinc-900 font-normal"
                    >
                      {COUNTRY_CODES.map((country, index) => (
                        <option key={`${country.iso2}-${country.code}-${index}`} value={country.code}>
                          {country.name} ({country.code})
                        </option>
                      ))}
                    </select>
                    <svg aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </span>
                </label>
                <label className="block min-w-0 text-sm font-medium leading-5">
                  Phone number <span aria-hidden="true">*</span>
                  <input
                    autoFocus
                    type="tel"
                    inputMode="tel"
                    value={phoneNumber}
                    onChange={(event) => {
                      setPhoneNumber(event.target.value);
                      setInviteError(null);
                    }}
                    placeholder={selectedCountry?.placeholder || "5XX XXX XXXX"}
                    aria-describedby={inviteError ? "co-host-invite-error" : undefined}
                    className="mt-1.5 h-11 w-full rounded-lg border border-[#b0b0b0] px-3 text-sm text-[#1f1f1f] outline-none transition placeholder:text-[#9a9a9a] font-normal"
                  />
                </label>
              </div>

              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-[#dedede]" />
                <span className="text-[13px] text-[#555]">or</span>
                <span className="h-px flex-1 bg-[#dedede]" />
              </div>

              <label className="block text-sm font-medium leading-5">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setInviteError(null);
                  }}
                  placeholder="name@example.com"
                  aria-describedby={inviteError ? "co-host-invite-error" : undefined}
                  className="mt-1.5 h-11 w-full rounded-lg border border-[#b0b0b0] px-3 text-sm text-[#1f1f1f] outline-none transition placeholder:text-[#9a9a9a] font-normal"
                />
              </label>

              {inviteError && <p id="co-host-invite-error" role="alert" className="mt-3 text-xs text-rose-700">{inviteError}</p>}

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-full border border-[#1f1f1f] hover:border-[#1f1f1f] bg-white hover:bg-[#1f1f1f] text-[#1f1f1f] font-medium hover:text-white text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || (!hasEmail && !hasPhone) || (hasEmail && hasPhone)}
                  className="rounded-full bg-[#FEE08B] border border-[#FEE08B] hover:border-[#1f1f1f] text-[#1F1F1F]  hover:bg-[#1f1f1f] hover:text-white font-medium text-sm px-7 py-2.5 transition-all duration-300 cursor-pointer disabled:cursor-wait disabled:opacity-60"
                >
                  {saving ? "Sending…" : "Next"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
