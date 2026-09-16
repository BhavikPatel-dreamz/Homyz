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
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? tone === "rose" ? "bg-[#EF4662]" : "bg-[#DF4557]" : "bg-[#DDDDDE]"}`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-zinc-200 transition-transform ${checked ? "translate-x-5.5" : "translate-x-0.5"}`}
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
  if (props.activeSection === "about-host") return <AboutHostView {...props} />;
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
        <BackButton onClick={onBack} />
        <h1 className="text-4xl font-medium tracking-tight text-[#1F1F1F] sm:text-2xl">Location</h1>
        <button
          type="button"
          onClick={onBack}
          aria-label="Close location editor"
          className="absolute right-0 top-1 flex size-10 items-center justify-center text-4xl font-normal leading-none text-[#1F1F1F] sm:hidden"
        >
          ×
        </button>
      </div>



      {isLoading ? (
        <LocationSkeleton />
      ) : (
        <>
          {/* Interactive map with draggable pin */}
          <div className="space-y-2 pt-3 sm:pt-8">
            <div className="overflow-hidden rounded-[20px] border border-[#1F1F1F] bg-zinc-100 shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
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
              <p className="text-xs text-amber-700 animate-pulse">Finding this address on the map…</p>
            )}

            {(locationResolutionError || validationError) && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium"
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
                <label className="text-base font-normal text-[#1f1f1f] block mb-1">
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
                <label className="text-base font-normal text-[#1f1f1f] block mb-1">
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
                  <label className="text-base font-normal text-[#1f1f1f] block mb-1">
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
                  <label className="text-base font-normal text-[#1f1f1f] block mb-1">
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
                  <label className="text-base font-normal text-[#1f1f1f] block mb-1">
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
                  <label className="text-base font-normal text-[#1f1f1f] block mb-1">
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
                <p className="text-base font-medium text-[#1F1F1F]">Show you specific location</p>
                <p className="mt-1 text-[14px] leading-5 text-[#727272]">
                  Guests can see your exact pinpoint location before booking. When disabled, they only see an approximate general area until a reservation is confirmed.
                </p>
              </div>
              <Toggle
                checked={showExactLocation}
                onChange={() => setShowExactLocation(!showExactLocation)}
                tone="rose"
              />
            </div>
            <div className="flex items-start justify-between gap-4 border-t border-[#DDDDDE] pt-4">
              <div>
                <p className="text-base font-medium text-[#1F1F1F]">Address privacy for cancellation</p>
                <p className="mt-1 text-[14px] leading-5 text-[#727272]">
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
                className="cursor-pointer rounded-full border border-[#FCDF9C] bg-[#FCDF9C] px-5 py-2 text-sm font-medium text-[#1F1F1F] transition-colors duration-300 hover:border-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setOpen("")}
                className="cursor-pointer rounded-full border border-[#1f1f1f] bg-white px-5 py-2 text-sm font-medium text-[#1F1F1F] transition-colors duration-300 hover:bg-[#1f1f1f] hover:text-white"
              >
                Cancel
              </button>
            </div>
          </Card>

          {/* 5. Location Features */}
          <Card
            title="Location features"
            summary="Add details"
            open={open === "features"}
            onToggle={() => setOpen(open === "features" ? "" : "features")}
            mutedWhenOpen
          >
            <div className="grid grid-cols-1 gap-x-12 sm:grid-cols-2 sm:gap-x-16">
              {LOCATION_FEATURES.map(([id, label]) => (
                <div key={id} className="py-2.5 sm:py-3">
                  <div className="flex items-start justify-between gap-4 border-b border-[#D7D7D7] pb-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-normal leading-6 text-[#1F1F1F]">{label}</div>
                      <div className="mt-1 text-[14px] font-normal leading-5 text-[#727272]">Highlight this feature for prospective guests</div>
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
                className="cursor-pointer rounded-full border border-[#FCDF9C] bg-[#FCDF9C] px-5 py-2 text-sm font-medium text-[#1F1F1F] transition-colors duration-300 hover:border-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setOpen("")}
                className="cursor-pointer rounded-full border border-[#1f1f1f] bg-white px-5 py-2 text-sm font-medium text-[#1F1F1F] transition-colors duration-300 hover:bg-[#1f1f1f] hover:text-white"
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
                  className="rounded-full bg-[#FCDF9C] border border-[#FCDF9C] hover:border-[#1f1f1f] px-5 py-2 text-sm font-medium text-[#1F1F1F] hover:text-white transition-colors hover:bg-[#1f1f1f] disabled:opacity-60 cursor-pointer duration-300"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setOpen("")}
                  className="rounded-full bg-white border border-[#1f1f1f] hover:border-[#1f1f1f] px-5 py-2 text-sm font-medium text-[#1F1F1F] hover:text-white transition-colors hover:bg-[#1f1f1f] disabled:opacity-60 cursor-pointer duration-300"
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
    <section className={`overflow-hidden rounded-xl border border-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] ${open && mutedWhenOpen ? "bg-[#F3F4F5]" : "bg-white"}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-base font-medium text-[#1F1F1F]">{title}</span>
          {summary && !open && <span className="mt-0.5 block truncate text-[14px] font-normal text-[#727272]">{summary}</span>}
        </span>
          <span className={`flex size-6 shrink-0 items-center justify-center transition-transform duration-200 ease-out ${open ? "rotate-180" : "rotate-[270deg]"}`}>
          <Image src="/images/icons/chevron-down-dark.svg" alt={open ? "Collapse" : "Expand"} width={16} height={16} className="size-4 object-contain" />
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-[#DDDDDE] px-4 pb-4 pt-3.5">{children}</div>
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
    <div className="flex items-center justify-between gap-3 border-b border-zinc-200 py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <span className="block text-sm text-zinc-700">{label}</span>
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
      className="cursor-pointer rounded-full border border-[#FCDF9C] bg-[#FCDF9C] px-5 py-2 text-sm font-medium text-[#1F1F1F] transition-colors duration-300 hover:border-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white disabled:opacity-60"
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
  const { hostProfile, onHostProfileSaved } = props;
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [publicProfile, setPublicProfile] = useState<Record<string, unknown>>(
    hostProfile.publicProfile ?? {},
  );
  const [isStampEditorOpen, setIsStampEditorOpen] = useState(false);
  const raw = publicProfile;
  const [bio, setBio] = useState(String(raw.bio ?? ""));
  const [homeUnique, setHomeUnique] = useState(() => getPrompt(raw, "homeUnique"));
  const [guestsShouldKnow, setGuestsShouldKnow] = useState(() => getPrompt(raw, "guestsShouldKnow"));
  const [education, setEducation] = useState(() => getPrompt(raw, "education"));
  const [perfectGuest, setPerfectGuest] = useState(() => getPrompt(raw, "perfectGuest"));
  const [hobbies, setHobbies] = useState<string[]>(() => getTagList(raw.prompts && typeof raw.prompts === "object" ? (raw.prompts as Record<string, unknown>).hobbies : []));
  const [languages, setLanguages] = useState<string[]>(() => getLanguageIds(raw.languages));
  const [interests, setInterests] = useState<string[]>(() => getStringList(raw.interests));
  const [stampsVisible, setStampsVisible] = useState(raw.stampsVisible !== false);
  const [avatarUrl, setAvatarUrl] = useState(hostProfile.image);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showAllPrompts, setShowAllPrompts] = useState(false);

  useEffect(() => {
    const next = hostProfile.publicProfile ?? {};
    setPublicProfile(next);
    setBio(String(next.bio ?? ""));
    setHomeUnique(getPrompt(next, "homeUnique"));
    setGuestsShouldKnow(getPrompt(next, "guestsShouldKnow"));
    setEducation(getPrompt(next, "education"));
    setPerfectGuest(getPrompt(next, "perfectGuest"));
    setHobbies(getTagList(next.prompts && typeof next.prompts === "object" ? (next.prompts as Record<string, unknown>).hobbies : []));
    setLanguages(getLanguageIds(next.languages));
    setInterests(getStringList(next.interests));
    setStampsVisible(next.stampsVisible !== false);
    setAvatarUrl(hostProfile.image);
  }, [hostProfile.image, hostProfile.publicProfile]);

  const selectedStamps = Array.isArray(raw.selectedStamps)
    ? raw.selectedStamps.filter((v): v is string => typeof v === "string")
    : [];
  const visibleSelectedStamps = selectedStamps.slice(0, 4);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const result = await updateHostPublicProfileAction({
      bio,
      prompts: { homeUnique, guestsShouldKnow, hobbies, education, perfectGuest },
      languages,
      interests,
      stampsVisible,
      selectedStamps,
    });
    setSaving(false);
    if (result.ok) {
      onHostProfileSaved((result.data.publicProfile as Record<string, unknown>) ?? {});
      setMessage("Host profile saved and shared across your listings.");
      router.refresh();
    } else {
      setMessage(result.error);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/v1/upload/listing-photo", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") throw new Error(data.error || "Could not upload the profile photo.");
      const result = await updateProfileAction({ image: data.url });
      if (!result.ok) throw new Error(result.error || "Could not save the profile photo.");
      setAvatarUrl(data.url);
      onHostProfileSaved(raw, { image: data.url });
      if (session?.user) {
        await updateSession({ user: { ...session.user, image: data.url } });
      }
      setMessage("Profile photo updated.");
      router.refresh();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update the profile photo.");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  const profilePrompts = [
    ["Where I’ve always wanted to go", hobbies[0] || ""],
    ["My work", education],
    ["My favorite song in high school", ""],
    ["What makes my home unique", homeUnique],
    ["Pets", ""],
    ["Decade I was born", ""],
    ["Where I went to school", education],
    ["I spend too much time", hobbies[1] || ""],
    ["My most useless skill", ""],
    ["My fun fact", ""],
    ["I’m obsessed with", hobbies[2] || ""],
    ["Language I speak", languages[0] ? getLanguageNameById(languages[0]) : ""],
    ["My biography title would be", ""],
    ["Where I live", ""],
    ["For guests I always", guestsShouldKnow],
    ["What’s for breakfast", perfectGuest],
  ];
  const displayedInterests = interests.length > 0
    ? interests
    : ["Architecture", "Cooking", "Food scenes", "History", "Live sports", "Museums", "Outdoors", "Shopping", "Video games"];

  return (
    <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="w-full max-w-[760px] space-y-6 pb-12 sm:space-y-7">
      <header className="flex items-center gap-3">
        <Link href="/host/listings" aria-label="Back to listings" className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#1F1F1F] text-lg leading-none text-[#1F1F1F] transition-colors hover:bg-[#F3F4F5]">‹</Link>
        <h1 className="hidden text-2xl font-semibold tracking-tight text-[#1F1F1F] sm:block sm:text-[25px]">About the host</h1>
      </header>

      {props.isLoading ? (
        <AboutHostSkeleton />
      ) : (
        <>
          <section className="pt-1 sm:pt-0">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-5">
              <div className="relative mx-auto h-44 w-44 shrink-0 overflow-visible sm:mx-0 sm:h-[172px] sm:w-[235px]">
                <div className="h-full w-full overflow-hidden rounded-full border border-[#1F1F1F] bg-zinc-100 sm:rounded-xl">
                  {avatarUrl ? <img src={avatarUrl} alt={`${hostProfile.name || "Host"} profile`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-amber-100 text-3xl font-semibold text-amber-900">{initials(hostProfile.name)}</div>}
                </div>
                <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage} className="absolute -bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#FCDF9C] px-4 py-2 text-sm font-medium text-[#1F1F1F] shadow-sm transition-colors hover:bg-[#F7D37D] disabled:cursor-wait disabled:opacity-60">
                  <Image src="/images/icons/writing-pen.svg" alt="" width={15} height={15} className="size-3.5" />{uploadingImage ? "Uploading…" : "Edit"}
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" onChange={uploadAvatar} className="sr-only" />
              </div>
              <div className="max-w-sm space-y-2 text-sm leading-5 text-[#727272] sm:pt-0.5">
                <h2 className="text-xl font-semibold text-[#1F1F1F] sm:hidden">About the host</h2>
                <p>Your profile is visible to both hosts and guests, and may be shown throughout Homyz to support a trustworthy community. <Link href="/profile?tab/profile_management" className="font-medium text-[#1F1F1F] underline underline-offset-2">Learn more</Link></p>
              </div>
            </div>
          </section>

          <section className="grid gap-x-16 sm:grid-cols-2">
            {profilePrompts.map(([label, value], index) => (
              <div key={`${label}-${index}`} className={`flex min-h-14 items-center gap-3 border-b border-[#DDDDDE] py-2.5 ${index > 7 && !showAllPrompts ? "hidden sm:flex" : ""}`}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#727272]">
                  <Image src="/images/icons/about-me-active.svg" alt="" width={16} height={16} className="size-4 object-contain" />
                </span>
                <p className="min-w-0 truncate text-sm font-normal text-[#727272]">{label}{value ? <><span className="text-[#1F1F1F]">: </span><span className="font-medium text-[#1F1F1F]">{value}</span></> : ""}</p>
              </div>
            ))}
            {!showAllPrompts && <button type="button" onClick={() => setShowAllPrompts(true)} className="mt-3 w-fit text-sm font-medium underline underline-offset-2 sm:hidden">See more</button>}
          </section>

          <section className="rounded-xl bg-[#F3F4F5] p-4 shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
            <label htmlFor="host-bio" className="block text-sm font-medium text-[#1F1F1F]">About me</label>
            <textarea id="host-bio" value={bio} maxLength={2000} onChange={(event) => setBio(event.target.value)} placeholder="Type something about you" className="mt-3 min-h-28 w-full resize-y rounded-lg border border-[#DDDDDE] bg-white px-3 py-2.5 text-sm leading-6 text-[#1F1F1F] outline-none transition focus:border-[#727272]" />
          </section>

          <section className="rounded-xl border border-white bg-white p-4 shadow-[0_2px_4px_rgba(0,0,0,0.2)] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#DDDDDE] pb-3">
              <div>
                <h2 className="text-base font-medium text-[#1F1F1F]">Where I’ve been</h2>
                <p className="mt-1 text-sm text-[#727272]">Pick the stamps you want other people to see on your profile.</p>
              </div>
              <Toggle checked={stampsVisible} onChange={() => setStampsVisible((visible) => !visible)} tone="rose" />
            </div>
            <div className="flex min-h-52 flex-col gap-4 py-5">
              <div className="flex min-h-36 items-center gap-3">
                {selectedStamps.length > 0 ? (
                    <div className="flex items-center gap-2 sm:gap-4">
                      {visibleSelectedStamps.map((stampId) => {
                        const stamp = BUILTIN_TRAVEL_STAMPS.find((item) => item.id === stampId);
                        if (!stamp) return null;
                        return (
                          <div key={stamp.id} className="overflow-hidden rounded-xl bg-white">
                            <TravelStampGraphic stamp={stamp} size="md" />
                          </div>
                        );
                      })}
                    </div>
                ) : (
                  <p className="text-sm text-[#727272]">Choose stamps to show the places and experiences you love.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsStampEditorOpen(true)}
                className="inline-flex w-full justify-center rounded-full bg-[#FCDF9C] px-5 py-2.5 text-sm font-medium text-[#1F1F1F] transition-colors hover:bg-[#F7D37D] sm:w-fit"
              >
                Edit travel stamp
              </button>
            </div>
          </section>

          {isStampEditorOpen && (
            <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
              <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-zinc-200 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-200 pb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1F1F1F]">Where I&apos;ve been</h3>
                    <p className="text-xs text-zinc-500">Choose the travel stamps that appear on your profile.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsStampEditorOpen(false)}
                    className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
                  >
                    Close
                  </button>
                </div>
                <WhereIveBeenSelector
                  initialSelectedStamps={selectedStamps}
                  initialStampsVisible={stampsVisible}
                  currentPublicProfile={publicProfile}
                  maxStamps={10}
                  isOwner={true}
                  onSaved={(updatedProfile) => {
                    const nextProfile = { ...publicProfile, ...updatedProfile };
                    setPublicProfile(nextProfile);
                    setStampsVisible(updatedProfile.stampsVisible ?? nextProfile.stampsVisible ?? true);
                    onHostProfileSaved(nextProfile as Record<string, unknown>);
                    setIsStampEditorOpen(false);
                  }}
                />
              </div>
            </ModalOverlay>
          )}

          <section className="rounded-xl border border-white bg-white p-4 shadow-[0_2px_4px_rgba(0,0,0,0.2)] sm:p-5">
            <h2 className="border-b border-[#DDDDDE] pb-3 text-base font-medium text-[#1F1F1F]">My interests</h2>
            <div className="grid pt-3 sm:grid-cols-2 sm:gap-x-12">
              {displayedInterests.map((interest) => {
                const selected = interests.some((value) => value.localeCompare(interest, undefined, { sensitivity: "accent" }) === 0);
                return (
                  <button key={interest} type="button" aria-pressed={selected} onClick={() => setInterests((current) => selected ? current.filter((value) => value.localeCompare(interest, undefined, { sensitivity: "accent" }) !== 0) : [...current, interest])} className="flex min-h-12 items-center gap-3 border-b border-[#DDDDDE] py-2 text-left text-sm font-normal text-[#1F1F1F]">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#727272]"><Image src="/images/icons/about-me-active.svg" alt="" width={16} height={16} className="size-4 object-contain" /></span>
                    {interest}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => setInterests(REFERENCE_INTERESTS.slice(0, 9))} className="mt-5 inline-flex w-full justify-center rounded-full bg-[#FCDF9C] px-5 py-2.5 text-sm font-medium text-[#1F1F1F] hover:bg-[#F7D37D] sm:w-fit">Edit interests</button>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-xs text-zinc-600">{message}</p>
            <button type="submit" disabled={saving} className="rounded-full bg-[#FCDF9C] px-5 py-2.5 text-sm font-semibold text-[#1F1F1F] transition-colors hover:bg-[#F7D37D] disabled:cursor-wait disabled:opacity-60">{saving ? "Saving…" : "Save profile"}</button>
          </div>
        </>
      )}
    </form>
  );
}
function CoHostView(props: Props) {
  const { listingId, coHosts, setCoHosts } = props;
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
    <div className="max-w-xl space-y-5 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1>Co-hosts</h1>
          <p className="mt-1 text-sm font-normal text-[#727272]">
            Accepted co-hosts are active; pending invitations are not.
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="rounded-full bg-[#FEE08B] px-4 py-2 text-xs font-semibold transition-colors hover:bg-[#f8d36c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        >
          Invite co-host
        </button>
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
            className="max-h-[calc(100dvh-2rem)] w-full max-w-[340px] overflow-y-auto rounded-2xl bg-white px-6 py-7 text-[#222222] shadow-[0_18px_55px_rgba(0,0,0,0.16)] sm:max-w-[390px] sm:px-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-[24px] font-semibold leading-8 tracking-[-0.035em] sm:text-[26px]">Add your co-host&apos;s info</h2>
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
                ×
              </button>
            </div>

            <form
              className="mt-6"
              onSubmit={(event) => {
                event.preventDefault();
                void invite();
              }}
            >
              <div className="grid grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)] gap-2.5">
                <label className="block min-w-0 text-[13px] font-medium leading-5">
                  Country code <span aria-hidden="true">*</span>
                  <span className="relative mt-1.5 block">
                    <select
                      value={countryCode}
                      onChange={(event) => setCountryCode(event.target.value)}
                      aria-label="Country code"
                      className="h-11 w-full appearance-none rounded-lg border border-[#b0b0b0] bg-white px-2.5 pr-7 text-[12px] text-[#717171] outline-none transition focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
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
                <label className="block min-w-0 text-[13px] font-medium leading-5">
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
                    className="mt-1.5 h-11 w-full rounded-lg border border-[#b0b0b0] px-3 text-[12px] text-[#222] outline-none transition placeholder:text-[#9a9a9a] focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                  />
                </label>
              </div>

              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-[#dedede]" />
                <span className="text-[13px] text-[#555]">or</span>
                <span className="h-px flex-1 bg-[#dedede]" />
              </div>

              <label className="block text-[13px] font-medium leading-5">
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
                  className="mt-1.5 h-11 w-full rounded-lg border border-[#b0b0b0] px-3 text-[12px] text-[#222] outline-none transition placeholder:text-[#9a9a9a] focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                />
              </label>

              {inviteError && <p id="co-host-invite-error" role="alert" className="mt-3 text-xs text-rose-700">{inviteError}</p>}

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-full border border-[#777] px-4 py-2 text-[13px] font-medium transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || (!hasEmail && !hasPhone) || (hasEmail && hasPhone)}
                  className="rounded-full bg-[#FEE08B] px-5 py-2 text-[13px] font-semibold transition hover:bg-[#f8d36c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
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
