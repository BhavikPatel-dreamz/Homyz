"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities -- legacy editor integration */

import { BackButton } from "@/components/ui/back-button";

import React from "react";
import { CANONICAL_AMENITIES, getAmenityMeta, normalizeAmenities, normalizeAmenityId } from "@/lib/constants/amenities";
import {
  normalizeAccessibilityFeature,
  normalizeMostLikeSelection,
  type AccessibilityFeatureDetail,
} from "@/lib/constants/listing-enums";

export interface BedItem {
  type: string;
  count: number;
}

export interface RoomData {
  id: string;
  name: string;
  type: "BEDROOM" | "LIVING_ROOM" | "OTHER";
  beds: BedItem[];
}

interface PropertyDetailsViewsProps {
  activeSection: string;
  setActiveSection: (section: any) => void;
  feedbackMsg: { type: "success" | "error"; text: string } | null;
  isSaving: boolean;
  handleSaveSection: (sectionKey: any, sectionSubtype?: "property" | "access" | "interaction" | "other") => void;

  // Description
  editDescription: string;
  setEditDescription: (val: string) => void;
  editPropertyDetails: string;
  setEditPropertyDetails: (val: string) => void;
  editAccessDetails: string;
  setEditAccessDetails: (val: string) => void;
  interactionDetails?: string;
  setInteractionDetails?: (val: string) => void;
  otherDetails?: string;
  setOtherDetails?: (val: string) => void;
  openDescAccordion: string | null;
  setOpenDescAccordion: (val: string | null) => void;

  // Title
  editTitle: string;
  setEditTitle: (val: string) => void;

  // Property Type
  whichIsMostLike: string;
  setWhichIsMostLike: (val: string) => void;
  editPropertyType: string;
  setEditPropertyType: (val: string) => void;
  editListingType: string;
  setEditListingType: (val: string) => void;

  // Guests & Rooms
  editGuests: number;
  setEditGuests: (val: number) => void;
  editBedrooms: number;
  setEditBedrooms: (val: number) => void;
  editBeds: number;
  setEditBeds: (val: number) => void;
  editBathrooms: number;
  setEditBathrooms: (val: number) => void;

  // Professional Property Details
  buildingFloors?: number;
  setBuildingFloors?: (val: number) => void;
  listingFloor?: number;
  setListingFloor?: (val: number) => void;
  yearBuilt?: string;
  setYearBuilt?: (val: string) => void;
  propertySize?: string;
  setPropertySize?: (val: string) => void;
  propertySizeUnit?: string;
  setPropertySizeUnit?: (val: string) => void;
  privateEntrance?: boolean;
  setPrivateEntrance?: (val: boolean) => void;
  elevatorAvailable?: boolean;
  setElevatorAvailable?: (val: boolean) => void;

  // Rooms & Sleeping Arrangements
  rooms?: RoomData[];
  setRooms?: (rooms: RoomData[]) => void;
  fullBathrooms?: number;
  setFullBathrooms?: (val: number) => void;
  halfBathrooms?: number;
  setHalfBathrooms?: (val: number) => void;
  privateBathrooms?: number;
  setPrivateBathrooms?: (val: number) => void;
  sharedBathrooms?: number;
  setSharedBathrooms?: (val: number) => void;

  // Amenities
  editAmenities: string[];
  setEditAmenities: (val: string[]) => void;

  // Accessibility
  accessibilityFeatures: any;
  setAccessibilityFeatures: (val: any) => void;
  accessibilityDetails?: AccessibilityFeatureDetail[];
  setAccessibilityDetails?: (val: AccessibilityFeatureDetail[]) => void;
  expandedAccessibility?: string | null;
  setExpandedAccessibility?: (val: string | null) => void;
}

const MAX_GUEST_CAPACITY = 50;

export function PropertyDetailsViews({
  activeSection,
  setActiveSection,
  feedbackMsg,
  isSaving,
  handleSaveSection,
  editDescription,
  setEditDescription,
  editPropertyDetails,
  setEditPropertyDetails,
  editAccessDetails,
  setEditAccessDetails,
  interactionDetails = "",
  setInteractionDetails,
  otherDetails = "",
  setOtherDetails,
  openDescAccordion,
  setOpenDescAccordion,
  editTitle,
  setEditTitle,
  whichIsMostLike,
  setWhichIsMostLike,
  editPropertyType,
  setEditPropertyType,
  editListingType,
  setEditListingType,
  buildingFloors = 1,
  setBuildingFloors,
  listingFloor = 1,
  setListingFloor,
  yearBuilt = "",
  setYearBuilt,
  propertySize = "",
  setPropertySize,
  propertySizeUnit = "SQM",
  setPropertySizeUnit,
  privateEntrance = false,
  setPrivateEntrance,
  elevatorAvailable = false,
  setElevatorAvailable,
  rooms = [],
  setRooms,
  fullBathrooms = 1,
  setFullBathrooms,
  halfBathrooms = 0,
  setHalfBathrooms,
  privateBathrooms = 1,
  setPrivateBathrooms,
  sharedBathrooms = 0,
  setSharedBathrooms,
  editGuests,
  setEditGuests,
  editBedrooms,
  setEditBedrooms,
  editBeds,
  setEditBeds,
  editBathrooms,
  setEditBathrooms,
  editAmenities,
  setEditAmenities,
  accessibilityFeatures,
  setAccessibilityFeatures,
  accessibilityDetails = [],
  setAccessibilityDetails,
  expandedAccessibility = "disabled_parking",
  setExpandedAccessibility,
}: PropertyDetailsViewsProps) {
  const [amenityCategory, setAmenityCategory] = React.useState<string>("all");
  const [amenitySearch, setAmenitySearch] = React.useState<string>("");
  const accessibilityPhotoInput = React.useRef<HTMLInputElement>(null);
  const [accessibilityPhotoFeatureId, setAccessibilityPhotoFeatureId] = React.useState<string | null>(null);
  const [uploadingAccessibilityPhoto, setUploadingAccessibilityPhoto] = React.useState(false);
  const [accessibilityPhotoError, setAccessibilityPhotoError] = React.useState<string | null>(null);

  const updateAccessibilityDetail = (featureId: string, updater: (detail: AccessibilityFeatureDetail) => AccessibilityFeatureDetail) => {
    const current = accessibilityDetails.find((detail) => detail.featureId === featureId) ?? { featureId, photos: [] };
    const next = updater(current);
    setAccessibilityDetails?.([
      ...accessibilityDetails.filter((detail) => detail.featureId !== featureId),
      { featureId, photos: [...new Set(next.photos)].slice(0, 10) },
    ]);
  };

  const uploadAccessibilityPhotos = async (featureId: string, files: File[]) => {
    if (!files.length) return;
    const invalidFile = files.find((file) => !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024);
    if (invalidFile) {
      setAccessibilityPhotoError("Use JPEG, PNG, WebP, or AVIF images up to 10 MB each.");
      return;
    }

    setUploadingAccessibilityPhoto(true);
    setAccessibilityPhotoError(null);
    try {
      const uploadedPhotos = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/v1/upload/listing-photo", { method: "POST", body: formData });
        const result: unknown = await response.json().catch(() => null);
        if (!response.ok || !result || typeof result !== "object" || !("url" in result)) {
          throw new Error(result && typeof result === "object" && "error" in result ? String((result as { error: unknown }).error) : "Photo upload failed. Please retry.");
        }
        return String((result as { url: string }).url);
      }));
      updateAccessibilityDetail(featureId, (detail) => ({ ...detail, photos: [...detail.photos, ...uploadedPhotos] }));
    } catch (error) {
      setAccessibilityPhotoError(error instanceof Error ? error.message : "Photo upload failed. Please retry.");
    } finally {
      setUploadingAccessibilityPhoto(false);
    }
  };

  const isApartmentLike = [
    "APARTMENT",
    "CONDO",
    "LOFT",
    "RENTAL_UNIT",
    "SERVICED_APARTMENT",
    "Apartment",
    "Condo",
    "Loft",
    "Serviced apartment",
    "Rental unit*",
  ].includes(whichIsMostLike) || [
    "APARTMENT",
    "CONDO",
    "LOFT",
    "RENTAL_UNIT",
    "SERVICED_APARTMENT",
    "Apartment",
    "Condo",
    "Loft",
    "Serviced apartment",
    "Rental unit*",
  ].includes(editPropertyType);
  return (
    <>
      {/* --------------------------------------------------------- */}
      {/* VIEW 1: DESCRIPTION */}
      {/* --------------------------------------------------------- */}
      {activeSection === "description" && (
        <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
          {/* Header & Back Button */}
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <BackButton onClick={() => setActiveSection("title")} />
              <h1>Description</h1>
            </div>
            <p className="text-base text-[#727272] font-normal pl-11">
              *These settings apply to all nights, unless you customize them by date.{" "}
              <a href="#" onClick={(e) => e.preventDefault()} className="underline cursor-pointer hover:text-zinc-700">
                Learn more
              </a>
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {/* 1. Listing description */}
            <div className="rounded-2xl bg-zinc-100/90 border border-zinc-200/80 p-4 space-y-3 shadow-2xs">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setOpenDescAccordion(openDescAccordion === "description" ? null : "description")}
              >
                <div className="space-y-0.5">
                  <h3 className="font-medium text-base text-[#1F1F1F]">Listing description</h3>
                  <span className="text-base text-[#727272] font-normal block">
                    {editDescription ? `${500 - editDescription.length}/500 available` : "295/500 available"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-zinc-600 transition-transform ${
                      openDescAccordion === "description" ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {openDescAccordion === "description" && (
                <div className="space-y-3 pt-1">
                  <div className="rounded-xl bg-white border border-zinc-200 p-3 shadow-2xs">
                    <textarea
                      rows={5}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Describe your space, ambiance, surroundings, and amenities..."
                      className="w-full text-xs text-zinc-800 outline-none bg-transparent leading-relaxed resize-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveSection("description")}
                    className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] text-zinc-950 font-medium text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F]"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            {/* 2. Your property */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-3 transition-all">
              <div
                onClick={() => setOpenDescAccordion(openDescAccordion === "property" ? null : "property")}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="space-y-0.5">
                  <h4 className="font-medium text-base text-[#1F1F1F]">Your property</h4>
                  <p className="text-base text-[#727272] font-normal">
                    {editPropertyDetails ? editPropertyDetails.slice(0, 40) + "..." : "Add details"}
                  </p>
                </div>
                <svg
                  className={`w-4 h-4 text-zinc-600 transition-transform ${openDescAccordion === "property" ? "rotate-180" : ""
                    }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {openDescAccordion === "property" && (
                <div className="space-y-3 pt-1">
                  <textarea
                    rows={4}
                    value={editPropertyDetails}
                    onChange={(e) => setEditPropertyDetails(e.target.value)}
                    placeholder="Tell guests more about the property itself."
                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-800 outline-none focus:border-amber-400 leading-relaxed shadow-2xs"
                  />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveSection("description", "property")}
                    className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] text-zinc-950 font-medium text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F]"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            {/* 3. Guest access */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-3 transition-all">
              <div
                onClick={() => setOpenDescAccordion(openDescAccordion === "access" ? null : "access")}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="space-y-0.5">
                  <h4 className="font-medium text-base text-[#1F1F1F]">Guest access</h4>
                  <p className="text-base text-[#727272] font-normal">
                    {editAccessDetails ? editAccessDetails.slice(0, 40) + "..." : "Add details"}
                  </p>
                </div>
                <svg
                  className={`w-4 h-4 text-zinc-600 transition-transform ${openDescAccordion === "access" ? "rotate-180" : ""
                    }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {openDescAccordion === "access" && (
                <div className="space-y-3 pt-1">
                  <textarea
                    rows={4}
                    value={editAccessDetails}
                    onChange={(e) => setEditAccessDetails(e.target.value)}
                    placeholder="Explain which spaces guests can use."
                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-800 outline-none focus:border-amber-400 leading-relaxed shadow-2xs"
                  />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveSection("description", "access")}
                    className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] text-zinc-950 font-medium text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F]"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            {/* 4. Interaction with guests */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-3 transition-all">
              <div
                onClick={() => setOpenDescAccordion(openDescAccordion === "interaction" ? null : "interaction")}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="space-y-0.5">
                  <h4 className="font-medium text-base text-[#1F1F1F]">Interaction with guests</h4>
                  <p className="text-base text-[#727272] font-normal">
                    {interactionDetails ? interactionDetails.slice(0, 40) + "..." : "Add details"}
                  </p>
                </div>
                <svg
                  className={`w-4 h-4 text-zinc-600 transition-transform ${openDescAccordion === "interaction" ? "rotate-180" : ""
                    }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {openDescAccordion === "interaction" && (
                <div className="space-y-3 pt-1">
                  <textarea
                    rows={4}
                    value={interactionDetails}
                    onChange={(e) => setInteractionDetails?.(e.target.value)}
                    placeholder="Let guests know how much interaction they can expect."
                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-800 outline-none focus:border-amber-400 leading-relaxed shadow-2xs"
                  />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveSection("description", "interaction")}
                    className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] text-zinc-950 font-medium text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F]"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            {/* 5. Other details to note */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-3 transition-all">
              <div
                onClick={() => setOpenDescAccordion(openDescAccordion === "other" ? null : "other")}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="space-y-0.5">
                  <h4 className="font-medium text-base text-[#1F1F1F]">Other details to note</h4>
                  <p className="text-base text-[#727272] font-normal">
                    {otherDetails ? otherDetails.slice(0, 40) + "..." : "Add details"}
                  </p>
                </div>
                <svg
                  className={`w-4 h-4 text-zinc-600 transition-transform ${openDescAccordion === "other" ? "rotate-180" : ""
                    }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {openDescAccordion === "other" && (
                <div className="space-y-3 pt-1">
                  <textarea
                    rows={4}
                    value={otherDetails}
                    onChange={(e) => setOtherDetails?.(e.target.value)}
                    placeholder="Share anything else guests should know before booking."
                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-800 outline-none focus:border-amber-400 leading-relaxed shadow-2xs"
                  />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveSection("description", "other")}
                    className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] text-zinc-950 font-medium text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F]"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 4: TITLE */}
      {/* --------------------------------------------------------- */}
      {activeSection === "title" && (
        <div className="space-y-6 animate-in fade-in max-w-xl">
          <div className="flex items-center gap-3">
            <BackButton onClick={() => setActiveSection("description")} />
            <h1>Listing title</h1>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="e.g. Modern Villa in Downtown"
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 text-sm font-semibold text-[#1F1F1F] outline-none focus:border-zinc-900 transition-colors shadow-2xs"
            />
            <div className="flex justify-between items-center text-xs text-zinc-400 px-1">
              <span>50 characters maximum</span>
              <span>{editTitle.length}/50</span>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("title")}
              className="whitespace-nowrap rounded-full bg-[#FCDF9C] px-6 py-3 text-sm font-medium text-[#1F1F1F] transition-colors lg:inline-flex border border-transparent hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white"
            >
              {isSaving ? "Saving..." : "Save Title"}
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 10: PROPERTY TYPE */}
      {/* --------------------------------------------------------- */}
      {activeSection === "propertyType" && (
        <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
          {/* Back button & Section Header */}
          <div className="flex items-center gap-3">
            <BackButton onClick={() => setActiveSection("description")} />
            <h1>Property type</h1>
          </div>

          <div className="space-y-5 pt-1">
            {/* 1. Which is most like your place? */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-800">Which is most like your place?</label>
              <div className="relative">
                <select
                  value={whichIsMostLike}
                  onChange={(e) => setWhichIsMostLike(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 pr-10 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors cursor-pointer shadow-2xs"
                >
                  <option value="APARTMENT">Apartment</option>
                  <option value="HOUSE">House</option>
                  <option value="SECONDARY_UNIT">Secondary unit</option>
                  <option value="UNIQUE_SPACE">Unique space</option>
                  <option value="BED_AND_BREAKFAST">Bed & breakfast</option>
                  <option value="BOUTIQUE_HOTEL">Boutique hotel</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 2. Property type */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-800">Property type</label>
              <div className="relative">
                <select
                  value={editPropertyType}
                  onChange={(e) => {
                    setEditPropertyType(e.target.value);
                    setWhichIsMostLike(normalizeMostLikeSelection(e.target.value));
                  }}
                  className="w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 pr-10 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors cursor-pointer shadow-2xs"
                >
                  <option value="APARTMENT">Apartment</option>
                  <option value="HOUSE">House</option>
                  <option value="VILLA">Villa</option>
                  <option value="CABIN">Cabin</option>
                  <option value="COTTAGE">Cottage</option>
                  <option value="STUDIO">Studio</option>
                  <option value="LOFT">Loft</option>
                  <option value="PENTHOUSE">Penthouse</option>
                  <option value="TOWNHOUSE">Townhouse</option>
                  <option value="GUEST_HOUSE">Guest house</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
              <p className="text-base text-[#727272] font-normal pt-0.5">
                A rental place with a multi-unit residential building or complex.
              </p>
            </div>

            {/* 3. Listing type */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-800">Listing type</label>
              <div className="relative">
                <select
                  value={editListingType}
                  onChange={(e) => setEditListingType(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 pr-10 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors cursor-pointer shadow-2xs"
                >
                  <option value="ENTIRE_PLACE">Entire place</option>
                  <option value="ROOM">Private room</option>
                  <option value="SHARED_ROOM">Shared room</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
              <p className="text-base text-[#727272] font-normal pt-0.5 leading-relaxed">
                Guests have the whole place to themselves. This usually includes a bedroom, a bathroom and a kitchen.
              </p>
            </div>

            {/* Conditional Building / Floor Details */}
            {isApartmentLike ? (
              <>
                {/* 4. How many floors are in the building */}
                <div className="flex items-center justify-between py-1">
                  <label className="text-xs font-semibold text-zinc-800">How many floors are in the building</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setBuildingFloors?.(Math.max(1, (buildingFloors || 1) - 1))}
                      className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer shadow-2xs transition-all"
                    >
                      -
                    </button>
                    <span className="w-5 text-center text-xs font-semibold text-[#1F1F1F]">{buildingFloors || 1}</span>
                    <button
                      type="button"
                      onClick={() => setBuildingFloors?.((buildingFloors || 1) + 1)}
                      className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer shadow-2xs transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 5. Which floor is the listing on? */}
                <div className="flex items-center justify-between py-1">
                  <label className="text-xs font-semibold text-zinc-800">Which floor is the listing on?</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setListingFloor?.(Math.max(0, (listingFloor || 1) - 1))}
                      className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer shadow-2xs transition-all"
                    >
                      -
                    </button>
                    <span className="w-5 text-center text-xs font-semibold text-[#1F1F1F]">{listingFloor ?? 1}</span>
                    <button
                      type="button"
                      onClick={() => setListingFloor?.((listingFloor || 0) + 1)}
                      className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer shadow-2xs transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Elevator Available */}
                <div className="flex items-center justify-between py-1">
                  <div className="space-y-0.5">
                    <label className="text-xs font-semibold text-zinc-800">Elevator available</label>
                    <p className="text-base text-[#727272] font-normal">Is there an elevator to access this floor?</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setElevatorAvailable?.(false)}
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${
                        elevatorAvailable === false
                          ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                          : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      ✕
                    </button>
                    <button
                      type="button"
                      onClick={() => setElevatorAvailable?.(true)}
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${
                        elevatorAvailable === true
                          ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                          : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      ✓
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Standalone House / Villa fields */}
                <div className="flex items-center justify-between py-1">
                  <div className="space-y-0.5">
                    <label className="text-xs font-semibold text-zinc-800">Stories / levels</label>
                    <p className="text-base text-[#727272] font-normal">How many floors/levels does this house have?</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setBuildingFloors?.(Math.max(1, (buildingFloors || 1) - 1))}
                      className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer shadow-2xs transition-all"
                    >
                      -
                    </button>
                    <span className="w-5 text-center text-xs font-semibold text-[#1F1F1F]">{buildingFloors || 1}</span>
                    <button
                      type="button"
                      onClick={() => setBuildingFloors?.((buildingFloors || 1) + 1)}
                      className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer shadow-2xs transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="space-y-0.5">
                    <label className="text-xs font-semibold text-zinc-800">Private entrance</label>
                    <p className="text-base text-[#727272] font-normal">Guests have their own private exterior door or gate</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPrivateEntrance?.(false)}
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${
                        privateEntrance === false
                          ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                          : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      ✕
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrivateEntrance?.(true)}
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${
                        privateEntrance === true
                          ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                          : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      ✓
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 6. Year built */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-800">Year built</label>
              <div className="relative">
                <select
                  value={yearBuilt}
                  onChange={(e) => setYearBuilt?.(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 pr-10 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors cursor-pointer shadow-2xs"
                >
                  <option value="">Select year (optional)</option>
                  {["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2018", "2015", "2010", "2005", "2000", "1995", "1990", "1980"].map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 7. Property size & Unit */}
            <div className="space-y-1">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-800">Property size</label>
                  <input
                    type="number"
                    value={propertySize}
                    onChange={(e) => setPropertySize?.(e.target.value)}
                    placeholder="e.g. 120"
                    min={1}
                    max={50000}
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 text-xs font-medium text-zinc-800 outline-none focus:border-zinc-900 shadow-2xs placeholder:text-zinc-300"
                  />
                </div>
                <div className="col-span-1 space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-800">Unit</label>
                  <div className="relative">
                    <select
                      value={propertySizeUnit}
                      onChange={(e) => setPropertySizeUnit?.(e.target.value)}
                      className="w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 pr-8 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors cursor-pointer shadow-2xs"
                    >
                      <option value="SQM">SQM (m²)</option>
                      <option value="SQFT">SQFT (sq ft)</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-base text-[#727272] font-normal pt-0.5">
                The amount of indoor space available to guests.
              </p>
            </div>

            {/* 8. Category Information */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start pt-6 border-t border-zinc-200/80 mt-4">
              <div className="sm:col-span-7 space-y-2">
                <h3 className="font-semibold text-sm text-[#1F1F1F]">Property categorization</h3>
                <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                  Categorizing your place accurately helps guests find the exact space type they need. Your listing is classified based on your property type and amenities.
                </p>
              </div>
              <div className="sm:col-span-5 rounded-2xl bg-zinc-100/90 border border-zinc-200/80 p-5 flex flex-col items-center justify-center text-center h-full min-h-[90px]">
                <span className="text-xs font-semibold text-zinc-800">{whichIsMostLike}</span>
                <span className="text-[11px] text-zinc-500">{editPropertyType} · {editListingType}</span>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveSection("propertyType")}
                className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] border border-transparent hover:border-[#1F1F1F] text-[#1F1F1F] font-medium text-base px-8 py-2.5 transition-all cursor-pointer"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: GUESTS & SLEEPING ARRANGEMENTS */}
      {/* --------------------------------------------------------- */}
      {(activeSection === "guests" || activeSection === "sleeping-arrangements") && (
        <div className="space-y-8 animate-in fade-in max-w-xl pb-10 font-sans">
          {/* Header */}
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection("propertyType")}
                className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
              >
                ‹
              </button>
              <h1>Guests & Sleeping arrangements</h1>
            </div>
            <p className="text-xs text-zinc-500 font-normal pl-11">
              Configure maximum capacity, bedroom sleeping arrangements, and bathroom breakdown.
            </p>
          </div>

          {/* Section 1: Guest Capacity Counter */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-zinc-900">Maximum guests</h3>
                <p className="text-[11px] text-zinc-400">Total number of guests allowed to stay</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditGuests(Math.max(1, editGuests - 1))}
                  className="w-8 h-8 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-zinc-700 font-semibold text-sm hover:bg-zinc-100 cursor-pointer transition-all shadow-2xs"
                >
                  -
                </button>
                <span className="w-6 text-center text-sm font-semibold text-zinc-950">{editGuests}</span>
                <button
                  type="button"
                  onClick={() => setEditGuests(Math.min(MAX_GUEST_CAPACITY, editGuests + 1))}
                  className="w-8 h-8 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-zinc-700 font-semibold text-sm hover:bg-zinc-100 cursor-pointer transition-all shadow-2xs"
                >
                  +
                </button>
              </div>
            </div>

            {/* Quick Counters: Bedrooms & Beds */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-100">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 block">Bedrooms</span>
                  <span className="text-[11px] text-zinc-400">Total bedroom spaces</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditBedrooms(Math.max(0, editBedrooms - 1))}
                    className="w-7 h-7 rounded-full border border-zinc-300 flex items-center justify-center text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-4 text-center text-xs font-semibold text-zinc-900">{editBedrooms}</span>
                  <button
                    type="button"
                    onClick={() => setEditBedrooms(Math.min(30, editBedrooms + 1))}
                    className="w-7 h-7 rounded-full border border-zinc-300 flex items-center justify-center text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 block">Beds</span>
                  <span className="text-[11px] text-zinc-400">Total beds available</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditBeds(Math.max(1, editBeds - 1))}
                    className="w-7 h-7 rounded-full border border-zinc-300 flex items-center justify-center text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-4 text-center text-xs font-semibold text-zinc-900">{editBeds}</span>
                  <button
                    type="button"
                    onClick={() => setEditBeds(Math.min(50, editBeds + 1))}
                    className="w-7 h-7 rounded-full border border-zinc-300 flex items-center justify-center text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Room-Level Sleeping Arrangements */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-zinc-900">Room-by-room sleeping arrangements</h3>
                <p className="text-[11px] text-zinc-400">Specify beds for each bedroom or common space</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const roomIndex = (rooms || []).length + 1;
                  const newRoom: RoomData = {
                    id: `room_${Date.now()}`,
                    name: `Bedroom ${roomIndex}`,
                    type: "BEDROOM",
                    beds: [{ type: "QUEEN", count: 1 }],
                  };
                  const updated = [...(rooms || []), newRoom];
                  setRooms?.(updated);
                  setEditBedrooms(updated.filter((r) => r.type === "BEDROOM").length);
                  const totalBeds = updated.reduce((sum, r) => sum + r.beds.reduce((bSum, b) => bSum + b.count, 0), 0);
                  setEditBeds(Math.max(1, totalBeds));
                }}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-3 py-1.5 rounded-full cursor-pointer transition-colors"
              >
                + Add room
              </button>
            </div>

            {/* Render Rooms List */}
            {(!rooms || rooms.length === 0) ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center space-y-2">
                <p className="text-xs text-zinc-500">No rooms configured yet.</p>
                <button
                  type="button"
                  onClick={() => {
                    const defaultRoom: RoomData = {
                      id: "room_1",
                      name: "Bedroom 1",
                      type: "BEDROOM",
                      beds: [{ type: "QUEEN", count: 1 }],
                    };
                    setRooms?.([defaultRoom]);
                  }}
                  className="text-xs font-semibold text-amber-700 underline cursor-pointer"
                >
                  Add Bedroom 1
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {rooms.map((room, roomIdx) => (
                  <div key={room.id || roomIdx} className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🛏️</span>
                        <input
                          type="text"
                          value={room.name}
                          onChange={(e) => {
                            const updated = [...rooms];
                            updated[roomIdx] = { ...updated[roomIdx], name: e.target.value };
                            setRooms?.(updated);
                          }}
                          className="text-xs font-semibold text-zinc-900 border-b border-transparent hover:border-zinc-300 focus:border-zinc-900 outline-none px-1 py-0.5"
                        />
                        <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                          {room.type}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = rooms.filter((_, idx) => idx !== roomIdx);
                          setRooms?.(updated);
                          setEditBedrooms(updated.filter((r) => r.type === "BEDROOM").length);
                          const totalBeds = updated.reduce((sum, r) => sum + r.beds.reduce((bSum, b) => bSum + b.count, 0), 0);
                          setEditBeds(Math.max(1, totalBeds));
                        }}
                        className="text-xs text-zinc-400 hover:text-red-600 cursor-pointer transition-colors p-1"
                        title="Remove room"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Beds in this room */}
                    <div className="space-y-2 pl-6 pt-1">
                      {room.beds.map((bed, bedIdx) => (
                        <div key={bedIdx} className="flex items-center justify-between text-xs py-1 border-b border-zinc-50 last:border-0">
                          <span className="text-zinc-700 font-medium capitalize">
                            {bed.type.toLowerCase().replace(/_/g, " ")} bed
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...rooms];
                                const currentCount = bed.count;
                                if (currentCount <= 1) {
                                  updated[roomIdx].beds = updated[roomIdx].beds.filter((_, bIdx) => bIdx !== bedIdx);
                                } else {
                                  updated[roomIdx].beds[bedIdx].count = currentCount - 1;
                                }
                                setRooms?.(updated);
                                const totalBeds = updated.reduce((sum, r) => sum + r.beds.reduce((bSum, b) => bSum + b.count, 0), 0);
                                setEditBeds(Math.max(1, totalBeds));
                              }}
                              className="w-6 h-6 rounded-full border border-zinc-300 flex items-center justify-center text-xs text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-4 text-center font-semibold text-zinc-900">{bed.count}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...rooms];
                                updated[roomIdx].beds[bedIdx].count += 1;
                                setRooms?.(updated);
                                const totalBeds = updated.reduce((sum, r) => sum + r.beds.reduce((bSum, b) => bSum + b.count, 0), 0);
                                setEditBeds(Math.max(1, totalBeds));
                              }}
                              className="w-6 h-6 rounded-full border border-zinc-300 flex items-center justify-center text-xs text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Add Bed to this Room */}
                      <div className="pt-2">
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const bedType = e.target.value;
                            const updated = [...rooms];
                            const existingBed = updated[roomIdx].beds.find((b) => b.type === bedType);
                            if (existingBed) {
                              existingBed.count += 1;
                            } else {
                              updated[roomIdx].beds.push({ type: bedType, count: 1 });
                            }
                            setRooms?.(updated);
                            const totalBeds = updated.reduce((sum, r) => sum + r.beds.reduce((bSum, b) => bSum + b.count, 0), 0);
                            setEditBeds(Math.max(1, totalBeds));
                            e.target.value = "";
                          }}
                          className="text-[11px] font-medium text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer"
                        >
                          <option value="">+ Add bed type...</option>
                          <option value="KING">King bed</option>
                          <option value="QUEEN">Queen bed</option>
                          <option value="DOUBLE">Double bed</option>
                          <option value="SINGLE">Single bed</option>
                          <option value="TWIN">Twin bed</option>
                          <option value="SOFA_BED">Sofa bed</option>
                          <option value="BUNK_BED">Bunk bed</option>
                          <option value="CRIB">Crib</option>
                          <option value="FLOOR_MATTRESS">Floor mattress</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Bathroom Breakdown */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
            <div>
              <h3 className="text-xs font-semibold text-zinc-900">Bathroom breakdown</h3>
              <p className="text-[11px] text-zinc-400">Specify full and half bathrooms available to guests</p>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 block">Full bathrooms</span>
                  <span className="text-[11px] text-zinc-400">Includes shower/bathtub, sink, and toilet</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const val = Math.max(0, (fullBathrooms || 1) - 1);
                      setFullBathrooms?.(val);
                      setEditBathrooms(val + (halfBathrooms || 0));
                    }}
                    className="w-7 h-7 rounded-full border border-zinc-300 flex items-center justify-center text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-4 text-center text-xs font-semibold text-zinc-900">{fullBathrooms ?? 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const val = (fullBathrooms || 0) + 1;
                      setFullBathrooms?.(val);
                      setEditBathrooms(val + (halfBathrooms || 0));
                    }}
                    className="w-7 h-7 rounded-full border border-zinc-300 flex items-center justify-center text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 block">Half bathrooms</span>
                  <span className="text-[11px] text-zinc-400">Includes sink and toilet only (no bath or shower)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const val = Math.max(0, (halfBathrooms || 0) - 1);
                      setHalfBathrooms?.(val);
                      setEditBathrooms((fullBathrooms || 1) + val);
                    }}
                    className="w-7 h-7 rounded-full border border-zinc-300 flex items-center justify-center text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-4 text-center text-xs font-semibold text-zinc-900">{halfBathrooms ?? 0}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const val = (halfBathrooms || 0) + 1;
                      setHalfBathrooms?.(val);
                      setEditBathrooms((fullBathrooms || 1) + val);
                    }}
                    className="w-7 h-7 rounded-full border border-zinc-300 flex items-center justify-center text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 block">Bathroom privacy</span>
                  <span className="text-[11px] text-zinc-400">Are the bathrooms private or shared with host/others?</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPrivateBathrooms?.(fullBathrooms || 1);
                      setSharedBathrooms?.(0);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      (sharedBathrooms ?? 0) === 0
                        ? "bg-[#FEE08B] border border-amber-300 text-zinc-950 shadow-2xs"
                        : "bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    Private
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSharedBathrooms?.(1);
                      setPrivateBathrooms?.(0);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      (sharedBathrooms ?? 0) > 0
                        ? "bg-[#FEE08B] border border-amber-300 text-zinc-950 shadow-2xs"
                        : "bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    Shared
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2 aaaaaaaaaaaaaaaaaaaaaaaaaaaa">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("guests")}
              className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] text-[#1F1F1F] font-medium text-sm px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 5: AMENITIES */}
      {/* --------------------------------------------------------- */}
      {(activeSection === "amenities" || activeSection === "add-amenities") && (() => {
        const AMENITY_FILTER_CATEGORIES = [
          { id: "all", label: "All" },
          { id: "favorites", label: "Favorites" },
          { id: "kitchen_dining", label: "Kitchen & dining" },
          { id: "bathroom", label: "Bathroom" },
          { id: "bedroom_laundry", label: "Bedroom & laundry" },
          { id: "climate", label: "Heating & cooling" },
          { id: "entertainment", label: "Entertainment" },
          { id: "outdoor", label: "Outdoor" },
          { id: "standout", label: "Standout & pool" },
          { id: "facilities", label: "Parking & facilities" },
          { id: "safety", label: "Safety" },
          { id: "services", label: "Services" },
        ] as const;

        const normalizedSelectedIds = new Set(
          editAmenities.map((a) => normalizeAmenityId(a)).filter(Boolean)
        );

        const filteredCatalog = CANONICAL_AMENITIES.filter((item) => {
          if (amenityCategory !== "all") {
            if (amenityCategory === "favorites") {
              if (!item.isPopular && item.category !== "favorites" && item.category !== "essentials") {
                return false;
              }
            } else if (amenityCategory === "facilities") {
              if (item.category !== "facilities" && item.category !== "parking") {
                return false;
              }
            } else if (amenityCategory === "standout") {
              if (item.category !== "standout" && item.category !== "premium") {
                return false;
              }
            } else if (amenityCategory === "services") {
              if (item.category !== "services" && item.category !== "family" && item.category !== "accessibility") {
                return false;
              }
            } else if (item.category !== amenityCategory) {
              return false;
            }
          }
          if (!amenitySearch.trim()) return true;
          const q = amenitySearch.toLowerCase().trim();
          return (
            item.label.toLowerCase().includes(q) ||
            (item.description && item.description.toLowerCase().includes(q)) ||
            item.id.toLowerCase().includes(q)
          );
        });

        const toggleAmenity = (idOrLabel: string) => {
          const canon = normalizeAmenityId(idOrLabel);
          if (!canon) return;
          const current: string[] = normalizeAmenities(editAmenities);
          if (current.includes(canon)) {
            setEditAmenities(current.filter((a: string) => a !== canon));
          } else {
            setEditAmenities([...current, canon]);
          }
        };

        return (
          <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeSection === "add-amenities") {
                        setActiveSection("amenities");
                      } else {
                        setActiveSection("description");
                      }
                    }}
                    className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
                  >
                    ‹
                  </button>
                  <h1 className="tracking-tight text-[#1F1F1F]">
                    {activeSection === "add-amenities" ? "Add amenities" : "Amenities"}
                  </h1>
                </div>
                <p className="text-base text-[#727272] font-normal pl-11">
                  {activeSection === "add-amenities"
                    ? `${normalizedSelectedIds.size} amenities selected for your listing.`
                    : `You've added ${normalizedSelectedIds.size} ${normalizedSelectedIds.size === 1 ? "amenity" : "amenities"} to your listing.`}
                </p>
              </div>

              {/* Edit / Add Switch Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={async () => {
                    if (activeSection === "add-amenities") {
                      await handleSaveSection("amenities");
                      setActiveSection("amenities");
                    } else {
                      setActiveSection("add-amenities");
                    }
                  }}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all"
                >
                  <span>{activeSection === "add-amenities" ? "✓" : "✏️"}</span>
                  <span>{activeSection === "add-amenities" ? (isSaving ? "Saving..." : "Done") : "Add amenities"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection(activeSection === "add-amenities" ? "amenities" : "add-amenities")}
                  className="w-7 h-7 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 hover:bg-zinc-100 text-sm font-semibold cursor-pointer shadow-2xs transition-all"
                >
                  {activeSection === "add-amenities" ? "✕" : "+"}
                </button>
              </div>
            </div>

            {activeSection === "add-amenities" ? (
              /* Add Amenities Selection View */
              <div className="space-y-5 pt-1">
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={amenitySearch}
                    onChange={(e) => setAmenitySearch(e.target.value)}
                    placeholder="Search amenities (e.g. Wifi, Pool, Kitchen)..."
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 focus:bg-white focus:border-amber-400 focus:outline-none text-xs text-[#1F1F1F] placeholder-zinc-400 transition-all"
                  />
                  {amenitySearch && (
                    <button
                      type="button"
                      onClick={() => setAmenitySearch("")}
                      className="absolute right-3 top-2.5 text-xs text-zinc-400 hover:text-zinc-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Category Filter Chips */}
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {AMENITY_FILTER_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setAmenityCategory(cat.id)}
                      className={`rounded-full px-3.5 py-1 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs ${
                        amenityCategory === cat.id
                          ? "bg-zinc-900 text-white"
                          : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Filtered Amenities List */}
                <div className="divide-y divide-zinc-150/80 pt-1 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                  {filteredCatalog.length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 text-xs">
                      No amenities found matching "{amenitySearch}".
                    </div>
                  ) : (
                    filteredCatalog.map((item) => {
                      const isSelected = normalizedSelectedIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleAmenity(item.id)}
                          className="py-3 flex items-center justify-between cursor-pointer group select-none hover:bg-zinc-50/70 px-2 rounded-xl transition-all"
                        >
                          <div className="flex items-center gap-3.5 min-w-0 pr-4">
                            <div className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-xs shrink-0 shadow-2xs group-hover:border-zinc-300">
                              {item.icon || "✨"}
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-base text-[#1F1F1F] block tracking-tight">
                                {item.label}
                              </span>
                              {item.description && (
                                <span className="text-[10px] text-zinc-400 font-normal truncate block">
                                  {item.description}
                                </span>
                              )}
                            </div>
                          </div>

                          {isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-[#FEE08B] border border-amber-300/60 flex items-center justify-center text-zinc-950 font-semibold text-xs shadow-2xs shrink-0">
                              ✓
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-zinc-600 group-hover:bg-zinc-100 text-xs font-semibold shadow-2xs transition-all shrink-0">
                              +
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Save & Done Buttons */}
                <div className="flex items-center gap-3 pt-3 border-t border-zinc-200/60">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={async () => {
                      await handleSaveSection("amenities");
                      setActiveSection("amenities");
                    }}
                    className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] disabled:opacity-50 text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
                  >
                    {isSaving ? "Saving..." : "Save & apply"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection("amenities")}
                    className="rounded-full bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-semibold text-xs px-6 py-2.5 shadow-2xs transition-all cursor-pointer"
                  >
                    Back to list
                  </button>
                </div>
              </div>
            ) : (
              /* Main Amenities List View */
              <div className="space-y-4 pt-1">
                {editAmenities.length === 0 ? (
                  <div className="p-10 text-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 space-y-3">
                    <p className="text-xs text-zinc-500 font-normal">
                      No amenities added yet. Tell guests what makes your place special!
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveSection("add-amenities")}
                      className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-6 py-2 shadow-2xs transition-all cursor-pointer"
                    >
                      + Add amenities
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-150/80">
                    {editAmenities.map((am) => {
                      const meta = getAmenityMeta(am);
                      return (
                        <div key={am} className="py-3.5 flex items-start gap-4">
                          <div className="w-9 h-9 rounded-full border border-zinc-200/80 bg-white flex items-center justify-center text-sm shrink-0 shadow-2xs">
                            {meta.icon || "✨"}
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5 space-y-0.5">
                            <h4 className="font-medium text-base text-[#1F1F1F] tracking-tight">
                              {meta.label}
                            </h4>
                            {meta.description && (
                              <p className="text-base text-[#727272] font-normal leading-relaxed">
                                {meta.description}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleAmenity(am)}
                            className="text-[11px] text-zinc-400 hover:text-rose-600 font-medium cursor-pointer pt-1 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Save & Add More Buttons */}
                <div className="flex items-center gap-3 pt-4 border-t border-zinc-200/60">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveSection("amenities")}
                    className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] disabled:opacity-50 text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection("add-amenities")}
                    className="rounded-full bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-semibold text-xs px-6 py-2.5 shadow-2xs transition-all cursor-pointer"
                  >
                    + Add more amenities
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* --------------------------------------------------------- */}
      {/* VIEW 2: ACCESSIBILITY FEATURES */}
      {/* --------------------------------------------------------- */}
      {activeSection === "accessibility" && (
        <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BackButton onClick={() => setActiveSection("description")} />
              <h1>Accessibility features</h1>
            </div>

          </div>

          <input
            ref={accessibilityPhotoInput}
            className="hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={(event) => {
              const featureId = event.currentTarget.dataset.featureId;
              const files = Array.from(event.target.files || []);
              event.target.value = "";
              if (featureId) void uploadAccessibilityPhotos(featureId, files);
            }}
          />
          {accessibilityPhotoError && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {accessibilityPhotoError}
            </p>
          )}

          {/* List of Accessibility Features */}
          <div className="space-y-3 pt-2">
            {[
              {
                id: "disabled_parking",
                name: "Disabled parking spot",
                icon: "♿",
                desc: "Dedicated accessible parking spot with ample space near the entrance."
              },
              {
                id: "lit_path",
                name: "Lit path to the guest entrance",
                icon: "💡",
                desc: "Path from entrance to listing is well-lit for safety."
              },
              {
                id: "step_free",
                name: "Step-free access",
                icon: "🪜",
                desc: "No steps, stairs, or curbs required to enter the property."
              },
              {
                id: "entrance_32",
                name: "Guest entrance wider than 32 inches",
                icon: "↔️",
                desc: "Entrance doorway clearance is at least 32 inches wide."
              },
              {
                id: "pool_hoist",
                name: "Swimming pool or hot tub hoist",
                icon: "🏊",
                desc: "Pool or hot tub is equipped with a mechanical lift."
              },
              {
                id: "ceiling_hoist",
                name: "Ceiling or mobile hoist",
                icon: "🏗️",
                desc: "Equipped with a mobile or ceiling lift device."
              }
            ].map((feature) => {
              const featureId = normalizeAccessibilityFeature(feature.id);
              const isSelected = Array.isArray(accessibilityFeatures)
                ? accessibilityFeatures.some((value: string) => normalizeAccessibilityFeature(value) === featureId)
                : false;
              const featurePhotos = accessibilityDetails.find((detail) => detail.featureId === featureId)?.photos ?? [];
              const isExpanded = expandedAccessibility === feature.id;

              if (isExpanded) {
                return (
                  /* Expanded Grey Container Card matching Figma Screenshot 1 */
                  <div
                    key={feature.id}
                    className="rounded-2xl bg-zinc-100/90 border border-zinc-200/80 p-5 space-y-4 shadow-2xs animate-in fade-in"
                  >
                    {/* Top Row: Icon, Title, Description, Minus Button */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-sm shrink-0 shadow-2xs mt-0.5">
                          {feature.icon}
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-medium text-base text-[#1F1F1F]">{feature.name}</h3>
                          <p className="text-[11px] text-zinc-500 font-normal leading-relaxed max-w-md">
                            {feature.desc}
                          </p>
                        </div>
                      </div>

                      {/* Minus Button to Collapse */}
                      <button
                        type="button"
                        onClick={() => setExpandedAccessibility?.(null)}
                        className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-zinc-700 hover:bg-zinc-100 text-xs font-semibold shrink-0 shadow-2xs transition-all cursor-pointer"
                      >
                        -
                      </button>
                    </div>

                    {/* Examples Gallery Grid */}
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-semibold text-zinc-500">Examples:</span>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="aspect-[4/3] rounded-xl bg-zinc-200/80 border border-zinc-300/40 flex items-center justify-center text-[10px] text-zinc-400 font-medium">
                          Photo 1
                        </div>
                        <div className="aspect-[4/3] rounded-xl bg-zinc-200/80 border border-zinc-300/40 flex items-center justify-center text-[10px] text-zinc-400 font-medium">
                          Photo 2
                        </div>
                        <div className="aspect-[4/3] rounded-xl bg-zinc-200/80 border border-zinc-300/40 flex items-center justify-center text-[10px] text-zinc-400 font-medium">
                          Photo 3
                        </div>
                      </div>
                    </div>

                    {/* Feature Selection Options */}
                    <div className="space-y-2 pt-1">
                      {/* Option 1: I don't have this feature */}
                      <div
                        onClick={() => {
                          if (Array.isArray(accessibilityFeatures)) {
                            setAccessibilityFeatures(
                              accessibilityFeatures.filter((value: string) => normalizeAccessibilityFeature(value) !== featureId)
                            );
                          }
                          setAccessibilityDetails?.(accessibilityDetails.filter((detail) => detail.featureId !== featureId));
                        }}
                        className={`rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all ${
                          !isSelected
                            ? "bg-white border-2 border-zinc-900 shadow-2xs"
                            : "bg-white border border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          !isSelected ? "border-zinc-900 bg-zinc-900" : "border-zinc-400"
                        }`}>
                          {!isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="font-medium text-base text-[#1F1F1F]">I don't have this feature</span>
                      </div>

                      {/* Option 2: I have this feature */}
                      <div
                        onClick={() => {
                          if (Array.isArray(accessibilityFeatures)) {
                            if (!isSelected) {
                              setAccessibilityFeatures([...accessibilityFeatures, featureId]);
                            }
                          } else {
                            setAccessibilityFeatures([featureId]);
                          }
                        }}
                        className={`rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all ${
                          isSelected
                            ? "bg-white border-2 border-zinc-900 shadow-2xs"
                            : "bg-white border border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? "border-zinc-900 bg-zinc-900" : "border-zinc-400"
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="font-medium text-base text-[#1F1F1F]">I have this feature</span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="rounded-xl border border-zinc-200 bg-white p-3.5 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-semibold text-[#1F1F1F]">Photos of this feature</h4>
                            <p className="mt-0.5 text-[11px] text-zinc-500">Add at least one photo to verify this accessibility feature.</p>
                          </div>
                          <button
                            type="button"
                            disabled={uploadingAccessibilityPhoto}
                            onClick={() => {
                              setAccessibilityPhotoFeatureId(featureId);
                              if (accessibilityPhotoInput.current) {
                                accessibilityPhotoInput.current.dataset.featureId = featureId;
                              }
                              accessibilityPhotoInput.current?.click();
                            }}
                            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60"
                          >
                            {uploadingAccessibilityPhoto && accessibilityPhotoFeatureId === featureId ? "Uploading…" : "Add photos"}
                          </button>
                        </div>

                        {featurePhotos.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {featurePhotos.map((photo) => (
                              <div key={photo} className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100">
                                <img src={photo} alt={`${feature.name} evidence`} className="h-full w-full object-cover" />
                                <button
                                  type="button"
                                  aria-label={`Remove ${feature.name} photo`}
                                  onClick={() => updateAccessibilityDetail(featureId, (detail) => ({ ...detail, photos: detail.photos.filter((item) => item !== photo) }))}
                                  className="absolute right-1 top-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">A photo is required before this feature can be saved.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                /* Collapsed Line Item */
                <div
                  key={feature.id}
                  className="py-3 flex items-center justify-between cursor-pointer group select-none border-b border-zinc-150/80"
                >
                  <div
                    className="flex items-center gap-4 flex-1"
                    onClick={() => setExpandedAccessibility?.(feature.id)}
                  >
                    <div className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-sm shrink-0 shadow-2xs group-hover:border-zinc-300">
                      {feature.icon}
                    </div>
                    <span className="font-medium text-base text-[#1F1F1F] tracking-tight">{feature.name}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedAccessibility?.(isExpanded ? null : feature.id)}
                    className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-zinc-600 group-hover:bg-zinc-100 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>

          {/* Bottom Save/Done Button */}
          <div className="pt-4">
            <button
              type="button"
              disabled={isSaving || uploadingAccessibilityPhoto}
              onClick={() => handleSaveSection("accessibility")}
              className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] text-zinc-950 font-medium text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F]"
            >
              {uploadingAccessibilityPhoto ? "Uploading..." : isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
