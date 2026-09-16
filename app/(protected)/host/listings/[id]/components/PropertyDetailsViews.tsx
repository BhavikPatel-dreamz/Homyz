"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities -- legacy editor integration */

import { BackButton } from "@/components/ui/back-button";
import Image from "next/image";

import React from "react";
import { AMENITY_ICON_SOURCES, CANONICAL_AMENITIES, getAmenityMeta, normalizeAmenities, normalizeAmenityId } from "@/lib/constants/amenities";
import {
  normalizeAccessibilityFeature,
  normalizeMostLikeSelection,
  type AccessibilityFeatureDetail,
} from "@/lib/constants/listing-enums";
import {
  TitleSkeleton,
  PropertyTypeSkeleton,
  GuestsSkeleton,
  SleepingArrangementsSkeleton,
  DescriptionSkeleton,
  AmenitiesSkeleton,
  AccessibilitySkeleton,
} from "./YourSpaceSkeletons";

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
  isLoading?: boolean;
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
  isLoading,
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
  const [isEditingAmenityList, setIsEditingAmenityList] = React.useState(false);
  const [collapsingAccessibilityFeature, setCollapsingAccessibilityFeature] = React.useState<string | null>(null);
  const [openingAccessibilityFeature, setOpeningAccessibilityFeature] = React.useState<string | null>(null);
  const accessibilityCollapseTimerRef = React.useRef<number | null>(null);
  const accessibilityOpenFrameRef = React.useRef<number | null>(null);
  const amenitiesScrollRef = React.useRef<HTMLDivElement>(null);
  const amenitiesScrollTrackRef = React.useRef<HTMLDivElement>(null);
  const amenitiesScrollFrameRef = React.useRef<number | null>(null);
  const [amenitiesScrollThumb, setAmenitiesScrollThumb] = React.useState({ height: 0, top: 0, visible: false });
  const accessibilityPhotoInput = React.useRef<HTMLInputElement>(null);
  const [accessibilityPhotoFeatureId, setAccessibilityPhotoFeatureId] = React.useState<string | null>(null);
  const [uploadingAccessibilityPhoto, setUploadingAccessibilityPhoto] = React.useState(false);
  const [accessibilityPhotoError, setAccessibilityPhotoError] = React.useState<string | null>(null);

  const collapseAccessibilityFeature = React.useCallback((featureId: string) => {
    if (accessibilityCollapseTimerRef.current !== null) {
      window.clearTimeout(accessibilityCollapseTimerRef.current);
    }

    setCollapsingAccessibilityFeature(featureId);
    accessibilityCollapseTimerRef.current = window.setTimeout(() => {
      setExpandedAccessibility?.(null);
      setCollapsingAccessibilityFeature(null);
      accessibilityCollapseTimerRef.current = null;
    }, 300);
  }, [setExpandedAccessibility]);

  const expandAccessibilityFeature = React.useCallback((featureId: string) => {
    if (accessibilityOpenFrameRef.current !== null) {
      cancelAnimationFrame(accessibilityOpenFrameRef.current);
    }

    setExpandedAccessibility?.(featureId);
    setOpeningAccessibilityFeature(featureId);
    accessibilityOpenFrameRef.current = requestAnimationFrame(() => {
      accessibilityOpenFrameRef.current = requestAnimationFrame(() => {
        setOpeningAccessibilityFeature(null);
        accessibilityOpenFrameRef.current = null;
      });
    });
  }, [setExpandedAccessibility]);

  React.useEffect(() => () => {
    if (accessibilityCollapseTimerRef.current !== null) {
      window.clearTimeout(accessibilityCollapseTimerRef.current);
    }
    if (accessibilityOpenFrameRef.current !== null) {
      cancelAnimationFrame(accessibilityOpenFrameRef.current);
    }
  }, []);

  const updateAmenitiesScrollThumb = React.useCallback(() => {
    if (amenitiesScrollFrameRef.current !== null) cancelAnimationFrame(amenitiesScrollFrameRef.current);

    amenitiesScrollFrameRef.current = requestAnimationFrame(() => {
      const element = amenitiesScrollRef.current;
      if (!element) return;

      const hasOverflow = element.scrollHeight > element.clientHeight + 1;
      const trackHeight = amenitiesScrollTrackRef.current?.clientHeight || element.clientHeight;
      // Preserve the compact Figma thumb while mapping its travel exactly to
      // the content scroll range.
      const height = hasOverflow ? Math.min(60, trackHeight) : 0;
      const maxTop = Math.max(0, trackHeight - height);
      const scrollRange = Math.max(1, element.scrollHeight - element.clientHeight);
      const top = hasOverflow ? Math.round((element.scrollTop / scrollRange) * maxTop) : 0;

      setAmenitiesScrollThumb((current) => (
        current.height === height && current.top === top && current.visible === hasOverflow
          ? current
          : { height, top, visible: hasOverflow }
      ));
      amenitiesScrollFrameRef.current = null;
    });
  }, []);

  React.useEffect(() => {
    const element = amenitiesScrollRef.current;
    if (!element) return;

    updateAmenitiesScrollThumb();
    const resizeObserver = new ResizeObserver(updateAmenitiesScrollThumb);
    const mutationObserver = new MutationObserver(updateAmenitiesScrollThumb);
    resizeObserver.observe(element);
    if (amenitiesScrollTrackRef.current) resizeObserver.observe(amenitiesScrollTrackRef.current);
    mutationObserver.observe(element, { childList: true, subtree: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (amenitiesScrollFrameRef.current !== null) cancelAnimationFrame(amenitiesScrollFrameRef.current);
    };
  }, [activeSection, amenitiesScrollThumb.visible, updateAmenitiesScrollThumb]);

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
        <div className="space-y-6 animate-in fade-in max-w-[calc(100%-75px)] pb-10 font-sans">
          {/* Header & Back Button */}
          <div className="sm:space-y-1.5 space-y-3">
            <div className="flex items-start gap-6">
              <BackButton onClick={() => setActiveSection("title")} />
              <div>
                <h1>Description</h1>
                <p className="sm:text-base text-sm text-[#727272] font-normal">
                  *These settings apply to all nights, unless you customize them by date.{" "}
                  <a href="#" onClick={(e) => e.preventDefault()} className="underline cursor-pointer text-[#1f1f1f] hover:text-[#727272]">
                    Learn more
                  </a>
                </p>
              </div>
            </div>

          </div>

          {isLoading ? (
            <DescriptionSkeleton />
          ) : (
            <div className="space-y-3 pt-1">
              {/* 1. Listing description */}
              <div className="rounded-xl bg-zinc-100/90 border border-white p-4 space-y-3 shadow-[0px_2px_4px_0px_#00000040] duration-300">
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
                    <Image
                      src="/images/icons/chevron-down-dark.svg"
                      alt={openDescAccordion === "description" ? "Collapse" : "Expand"}
                      width={16}
                      height={16}
                      className={`size-4 object-contain transition-transform duration-200 ease-out ${openDescAccordion === "description" ? "rotate-180" : "rotate-[270deg]"}`}
                    />
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
                        className="w-full text-base text-[#727272] outline-none bg-transparent leading-relaxed resize-none"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveSection("description")}
                      className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-8 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Your property */}
              <div className="rounded-xl border border-white bg-white p-4 shadow-[0px_2px_4px_0px_#00000040] space-y-3 transition-all duration-300">
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
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt={openDescAccordion === "property" ? "Collapse" : "Expand"}
                    width={16}
                    height={16}
                    className={`size-4 object-contain transition-transform duration-200 ease-out ${openDescAccordion === "property" ? "rotate-180" : "rotate-[270deg]"}`}
                  />
                </div>

                {openDescAccordion === "property" && (
                  <div className="space-y-3 pt-1">
                    <textarea
                      rows={4}
                      value={editPropertyDetails}
                      onChange={(e) => setEditPropertyDetails(e.target.value)}
                      placeholder="Tell guests more about the property itself."
                      className="w-full rounded-lg border border-[#727272] bg-white px-4 py-3.5 text-md font-normal text-[#727272] outline-none focus:border-[#1F1F1F] transition-colors shadow-2xs min-h-[56px"
                    />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveSection("description", "property")}
                      className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-8 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Guest access */}
              <div className="rounded-xl border border-white bg-white p-4 shadow-[0px_2px_4px_0px_#00000040] space-y-3 transition-all duration-300">
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
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt={openDescAccordion === "access" ? "Collapse" : "Expand"}
                    width={16}
                    height={16}
                    className={`size-4 object-contain transition-transform duration-200 ease-out ${openDescAccordion === "access" ? "rotate-180" : "rotate-[270deg]"}`}
                  />
                </div>

                {openDescAccordion === "access" && (
                  <div className="space-y-3 pt-1">
                    <textarea
                      rows={4}
                      value={editAccessDetails}
                      onChange={(e) => setEditAccessDetails(e.target.value)}
                      placeholder="Explain which spaces guests can use."
                      className="w-full rounded-lg border border-[#727272] bg-white px-4 py-3.5 text-md font-normal text-[#727272] outline-none focus:border-[#1F1F1F] transition-colors shadow-2xs min-h-[56px"
                    />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveSection("description", "access")}
                      className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-8 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Interaction with guests */}
              <div className="rounded-xl border border-white bg-white p-4 shadow-[0px_2px_4px_0px_#00000040] space-y-3 transition-all duration-300">
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
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt={openDescAccordion === "interaction" ? "Collapse" : "Expand"}
                    width={16}
                    height={16}
                    className={`size-4 object-contain transition-transform duration-200 ease-out ${openDescAccordion === "interaction" ? "rotate-180" : "rotate-[270deg]"}`}
                  />
                </div>

                {openDescAccordion === "interaction" && (
                  <div className="space-y-3 pt-1">
                    <textarea
                      rows={4}
                      value={interactionDetails}
                      onChange={(e) => setInteractionDetails?.(e.target.value)}
                      placeholder="Let guests know how much interaction they can expect."
                      className="w-full rounded-lg border border-[#727272] bg-white px-4 py-3.5 text-md font-normal text-[#727272] outline-none focus:border-[#1F1F1F] transition-colors shadow-2xs min-h-[56px"
                    />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveSection("description", "interaction")}
                      className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-8 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>

              {/* 5. Other details to note */}
              <div className="rounded-xl border border-white bg-white p-4 shadow-[0px_2px_4px_0px_#00000040] space-y-3 transition-all duration-300">
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
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt={openDescAccordion === "other" ? "Collapse" : "Expand"}
                    width={16}
                    height={16}
                    className={`size-4 object-contain transition-transform duration-200 ease-out ${openDescAccordion === "other" ? "rotate-180" : "rotate-[270deg]"}`}
                  />
                </div>

                {openDescAccordion === "other" && (
                  <div className="space-y-3 pt-1">
                    <textarea
                      rows={4}
                      value={otherDetails}
                      onChange={(e) => setOtherDetails?.(e.target.value)}
                      placeholder="Share anything else guests should know before booking."
                      className="w-full rounded-lg border border-[#727272] bg-white px-4 py-3.5 text-md font-normal text-[#727272] outline-none focus:border-[#1F1F1F] transition-colors shadow-2xs min-h-[56px"
                    />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveSection("description", "other")}
                      className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-8 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 4: TITLE */}
      {/* --------------------------------------------------------- */}
      {activeSection === "title" && (
        <div className="space-y-6 animate-in fade-in max-w-xl">
          <div className="flex items-center gap-6">
            <BackButton onClick={() => setActiveSection("description")} />
            <h1>Listing title</h1>
          </div>

          {isLoading ? (
            <TitleSkeleton />
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="e.g. Modern Villa in Downtown"
                className="w-full rounded-lg border border-[#727272] bg-white px-4 py-3.5 text-md font-normal text-[#727272] outline-none focus:border-[#1F1F1F] transition-colors shadow-2xs min-h-[56px]"
              />
              <div className="flex justify-between items-center text-xs text-[#727272] mb-0">
                <span>50 characters maximum</span>
                <span>{editTitle.length}/50</span>
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveSection("title")}
                className="mt-12 whitespace-nowrap rounded-full bg-[#FCDF9C] px-6 py-3 text-sm font-medium text-[#1F1F1F] transition-colors lg:inline-flex border border-transparent hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white"
              >
                {isSaving ? "Saving..." : "Save Title"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 10: PROPERTY TYPE */}
      {/* --------------------------------------------------------- */}
      {activeSection === "propertyType" && (
        <div className="space-y-6 animate-in fade-in pb-10 pr-0 font-sans lg:pr-6">
          {/* Back button & Section Header */}
          <div className="flex items-center gap-6">
            <span className="hidden lg:block"><BackButton onClick={() => setActiveSection("description")} /></span>
            <h1>Property type</h1>
          </div>

          {isLoading ? (
            <PropertyTypeSkeleton />
          ) : (
            <div className="space-y-5 pt-1">
              <div className="max-w-none space-y-5 lg:max-w-[491px]">
                {/* 1. Which is most like your place? */}
                <div className="space-y-3">
                  <label className="block text-base font-normal text-[#1F1F1F]">Which is most like your place?</label>
                  <div className="relative">
                    <select
                      value={whichIsMostLike}
                      onChange={(e) => setWhichIsMostLike(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-[#727272] bg-white px-4 py-3.5 pr-10 text-base text-[#727272] font-normal outline-none focus:border-[#1F1F1F] transition-colors cursor-pointer min-h-[56px]"
                    >
                      <option value="APARTMENT">Apartment</option>
                      <option value="HOUSE">House</option>
                      <option value="SECONDARY_UNIT">Secondary unit</option>
                      <option value="UNIQUE_SPACE">Unique space</option>
                      <option value="BED_AND_BREAKFAST">Bed & breakfast</option>
                      <option value="BOUTIQUE_HOTEL">Boutique hotel</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                      <svg width="16" height="9" viewBox="0 0 16 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 1L8 8L1 1" stroke="#1D1D1D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 2. Property type */}
                <div className="space-y-3">
                  <label className="block text-base font-normal text-[#1F1F1F]">Property type</label>
                  <div className="relative">
                    <select
                      value={editPropertyType}
                      onChange={(e) => {
                        setEditPropertyType(e.target.value);
                        setWhichIsMostLike(normalizeMostLikeSelection(e.target.value));
                      }}
                      className="w-full appearance-none rounded-lg border border-[#727272] bg-white px-4 py-3.5 pr-10 text-base text-[#727272] font-normal outline-none focus:border-[#1F1F1F] transition-colors cursor-pointer min-h-[56px]"
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
                      <svg width="16" height="9" viewBox="0 0 16 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 1L8 8L1 1" stroke="#1D1D1D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs text-[#727272] font-normal pt-0.5">
                    A rental place with a multi-unit residential building or complex.
                  </p>
                </div>

                {/* 3. Listing type */}
                <div className="space-y-3">
                  <label className="block text-base font-normal text-[#1F1F1F]">Listing type</label>
                  <div className="relative">
                    <select
                      value={editListingType}
                      onChange={(e) => setEditListingType(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-[#727272] bg-white px-4 py-3.5 pr-10 text-base text-[#727272] font-normal outline-none focus:border-[#1F1F1F] transition-colors cursor-pointer min-h-[56px]"
                    >
                      <option value="ENTIRE_PLACE">Entire place</option>
                      <option value="ROOM">Private room</option>
                      <option value="SHARED_ROOM">Shared room</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                      <svg width="16" height="9" viewBox="0 0 16 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 1L8 8L1 1" stroke="#1D1D1D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs text-[#727272] font-normal pt-0.5 leading-relaxed">
                    Guests have the whole place to themselves. This usually includes a bedroom, a bathroom and a kitchen.
                  </p>
                </div>

                {/* Conditional Building / Floor Details */}
                {isApartmentLike ? (
                  <>
                    {/* 4. How many floors are in the building */}
                    <div className="flex sm:flex-row flex-col sm:items-center items-start justify-between gap-5">
                      <label className="text-xs font-semibold text-zinc-800">How many floors are in the building</label>
                      <div className="flex items-center sm:gap-3 gap-1 min-w-[86px]">
                        <button
                          type="button"
                          onClick={() => setBuildingFloors?.(Math.max(1, (buildingFloors || 1) - 1))}
                          className="w-8 h-8 rounded-full border border[#1F1F1F] bg-white flex items-center justify-center text-xl font-normal text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer transition-all duration-300"
                        >
                          <Image src="/images/icons/minus-icon.svg" alt="Decrease" width={14} height={14} className="size-3.5 object-contain" />
                        </button>
                        <span className="w-5 text-center text-xs font-semibold text-[#1F1F1F]">{buildingFloors || 1}</span>
                        <button
                          type="button"
                          onClick={() => setBuildingFloors?.((buildingFloors || 1) + 1)}
                          className="w-8 h-8 rounded-full border border[#1F1F1F] bg-white flex items-center justify-center text-xl font-normal text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer transition-all duration-300"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* 5. Which floor is the listing on? */}
                    <div className="flex sm:flex-row flex-col sm:items-center items-start justify-between gap-5">
                      <label className="text-xs font-semibold text-zinc-800">Which floor is the listing on?</label>
                      <div className="flex items-center sm:gap-3 gap-1 min-w-[86px]">
                        <button
                          type="button"
                          onClick={() => setListingFloor?.(Math.max(0, (listingFloor || 1) - 1))}
                          className="w-8 h-8 rounded-full border border[#1F1F1F] bg-white flex items-center justify-center text-xl font-normal text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer transition-all duration-300"
                        >
                          <Image src="/images/icons/minus-icon.svg" alt="Decrease" width={14} height={14} className="size-3.5 object-contain" />
                        </button>
                        <span className="w-5 text-center text-xs font-semibold text-[#1F1F1F]">{listingFloor ?? 1}</span>
                        <button
                          type="button"
                          onClick={() => setListingFloor?.((listingFloor || 0) + 1)}
                          className="w-8 h-8 rounded-full border border[#1F1F1F] bg-white flex items-center justify-center text-xl font-normal text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer transition-all duration-300"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Elevator Available */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-xs font-semibold text-zinc-800">Elevator available</label>
                        <p className="text-base text-[#727272] font-normal">Is there an elevator to access this floor?</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setElevatorAvailable?.(false)}
                          className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${elevatorAvailable === false
                            ? "bg-[#FEE08B] border-amber-300 text-zinc-950 shadow-2xs"
                            : "bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                            }`}
                        >
                          ✕
                        </button>
                        <button
                          type="button"
                          onClick={() => setElevatorAvailable?.(true)}
                          className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${elevatorAvailable === true
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
                    <div className="flex sm:flex-row flex-col sm:items-center items-start justify-between gap-5">
                      <div className="space-y-0.5">
                        <p className="text-base text-[#1F1F1F] font-normal">How many floors are in the building?</p>
                      </div>
                      <div className="flex items-center sm:gap-3 gap-1 min-w-[86px]">
                        <button
                          type="button"
                          onClick={() => setBuildingFloors?.(Math.max(1, (buildingFloors || 1) - 1))}
                          className="w-8 h-8 rounded-full border border[#1F1F1F] bg-white flex items-center justify-center text-xl font-normal text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer transition-all duration-300"
                        >
                          <Image src="/images/icons/minus-icon.svg" alt="Decrease" width={14} height={14} className="size-3.5 object-contain" />
                        </button>
                        <span className="w-5 text-center text-xs font-semibold text-[#1F1F1F]">{buildingFloors || 1}</span>
                        <button
                          type="button"
                          onClick={() => setBuildingFloors?.((buildingFloors || 1) + 1)}
                          className="w-8 h-8 rounded-full border border[#1F1F1F] bg-white flex items-center justify-center text-xl font-normal text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer transition-all duration-300"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex sm:flex-row flex-col sm:items-center items-start justify-between gap-5">
                      <div className="space-y-0.5">
                        <p className="text-base text-[#1F1F1F] font-normal">Guests have their own private exterior door or gate</p>
                      </div>
                      <div className="flex items-center gap-3 min-w-[86px]">
                        <button
                          type="button"
                          onClick={() => setPrivateEntrance?.(false)}
                          className={`w-8 h-8 rounded-full border flex items-center justify-center text-lg font-normal cursor-pointer transition-all ${privateEntrance === false
                            ? "bg-[#FEE08B] border-[#FEE08B] text-[#1F1F1F]"
                            : "bg-white border-[#1F1F1F] text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white"
                            }`}
                        >
                          ✕
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrivateEntrance?.(true)}
                          className={`w-8 h-8 rounded-full border flex items-center justify-center text-lg font-normal cursor-pointer transition-all ${privateEntrance === true
                            ? "bg-[#FEE08B] border-[#FEE08B] text-[#1F1F1F]"
                            : "bg-white border-[#1F1F1F] text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white"
                            }`}
                        >
                          ✓
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* 6. Year built */}
                <div className="w-full space-y-2 sm:w-[13.5rem]">
                  <label className="block text-base font-normal text-[#1F1F1F]">Year built</label>
                  <div className="relative">
                    <select
                      value={yearBuilt}
                      onChange={(e) => setYearBuilt?.(e.target.value)}
                      className="h-14 w-full appearance-none rounded-lg border border-[#727272] bg-white px-4 pr-10 text-[#727272] font-normal outline-none transition-colors cursor-pointer focus:border-[#1F1F1F] sm:h-11 sm:px-3 sm:pr-9 text-base"
                    >
                      <option value="">Select year (optional)</option>
                      {["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2018", "2015", "2010", "2005", "2000", "1995", "1990", "1980"].map((yr) => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                      <svg width="14" height="8" viewBox="0 0 16 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 1L8 8L1 1" stroke="#1D1D1D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 7. Property size & Unit */}
                <div className="space-y-2">
                  <div className="grid max-w-md grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
                    <div className="space-y-2">
                      <label className="block text-base font-normal text-[#1F1F1F]">Property size</label>
                      <input
                        type="number"
                        value={propertySize}
                        onChange={(e) => setPropertySize?.(e.target.value)}
                        placeholder="e.g. 120"
                        min={1}
                        max={50000}
                        className="h-14 w-full rounded-lg border border-[#727272] bg-white px-4 text-base font-normal text-[#727272] outline-none transition-colors shadow-2xs focus:border-[#1F1F1F] sm:h-11 sm:px-3"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-base font-normal text-[#1F1F1F]">Unit</label>
                      <div className="relative">
                        <select
                          value={propertySizeUnit}
                          onChange={(e) => setPropertySizeUnit?.(e.target.value)}
                          className="h-14 w-full appearance-none rounded-lg border border-[#727272] bg-white px-4 pr-10 text-base font-normal text-[#727272] outline-none transition-colors shadow-2xs focus:border-[#1F1F1F] sm:h-11 sm:px-3 sm:pr-8"
                        >
                          <option value="SQM">SQM (m²)</option>
                          <option value="SQFT">SQFT (sq ft)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                          <svg width="14" height="8" viewBox="0 0 16 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 1L8 8L1 1" stroke="#1D1D1D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="pt-0.5 text-xs font-normal text-[#727272]">
                    The amount of indoor space that&apos;s available to guests.
                  </p>
                </div>
              </div>

              {/* 8. Category Information */}
              <div className="grid grid-cols-1 gap-6 pt-8 sm:grid-cols-[minmax(0,1fr)_20.25rem] sm:items-end">
                <div className="space-y-3">
                  <h3 className="text-2xl font-medium text-[#1F1F1F]">Your category</h3>
                  <p className="text-base font-normal leading-relaxed text-[#727272] mb-0">
                    Categorizing your place accurately helps guests find the exact space type they need. Your listing is classified based on your property type and amenities.
                  </p>
                  <button type="button" className="text-base font-normal text-[#1F1F1F] underline underline-offset-2 hover:text-[#727272] transition-all duration-300">Learn more</button>
                </div>
                <div className="flex min-h-12 items-center rounded-lg bg-zinc-100 px-5 text-base font-normal text-[#1F1F1F] sm:min-h-[140px] sm:rounded-[24px]">
                  *Your listing isn&apos;t part of a part yet.
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveSection("propertyType")}
                  className="w-full rounded-full border border-transparent bg-[#FCDF9C] px-4 py-2.25 text-lg font-medium text-[#1F1F1F] transition-all duration-300 cursor-pointer hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white sm:w-auto sm:py-2.5 sm:text-base min-w-[136px]"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: GUESTS & SLEEPING ARRANGEMENTS */}
      {/* --------------------------------------------------------- */}
      {(activeSection === "guests" || activeSection === "sleeping-arrangements") && (
        <div className={activeSection === "guests" ? "w-full max-w-none animate-in fade-in pb-6 font-sans" : "w-full animate-in fade-in pb-10 font-sans"}>
          {/* Header */}
          <div className={activeSection === "guests" ? "hidden" : "space-y-1"}>
            <div className="flex items-start gap-6 max-w-[491px]">
              <BackButton onClick={() => setActiveSection("propertyType")} />
              <div className="space-y-1.5">
                <h1 className="text-2xl font-medium tracking-tight text-[#1F1F1F]">{activeSection === "guests" ? "Number of guests" : "Sleeping arrangements"}</h1>
                <p className="text-[14px] leading-5 text-[#727272]">
                  {activeSection === "guests" ? "How many guests can fit comfortably in your space?" : "Configure bedroom sleeping arrangements and bathroom breakdown."}
                </p>
              </div>
            </div>

          </div>

          {isLoading ? (
            activeSection === "sleeping-arrangements" ? (
              <SleepingArrangementsSkeleton />
            ) : (
              <GuestsSkeleton />
            )
          ) : (
            <div className="space-y-6 pt-12">
              {/* Section 1: Guest Capacity Counter */}
              <div className={`Guest-Capacity-Counter max-w-[491px] ${activeSection === "guests" ? "mx-auto" : ""}`}>
                <div className={`${activeSection === "guests" ? "flex min-h-[500px] flex-col items-center justify-center gap-9 pb-14" : "space-y-4 rounded-md border border-[#DDDDDE] bg-white p-4"}`}>
                  {activeSection === "guests" && (
                    <p className="max-w-[320px] text-center text-xl font-normal leading-7 text-[#727272]">
                      How many guests can fit comfortably in your space?
                    </p>
                  )}
                  <div className={`flex items-center ${activeSection === "guests" ? "gap-12" : "justify-between"}`}>
                    {activeSection !== "guests" && (
                      <div>
                        <h3 className="text-base font-medium text-[#1F1F1F]">Maximum guests</h3>
                        <p className="text-[14px] font-normal text-[#727272]">Total number of guests allowed to stay</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditGuests(Math.max(1, editGuests - 1))}
                        className={`${activeSection === "guests" ? "size-8" : "size-8"} rounded-full border border-[#1f1f1f] bg-white flex items-center justify-center text-[#1f1f1f] hover:text-white font-normal text-lg hover:bg-[#1f1f1f] cursor-pointer transition-all`}
                      >
                        <Image src="/images/icons/minus-icon.svg" alt="Decrease guests" width={14} height={14} className="size-3.5 object-contain" />
                      </button>
                      <span className={`${activeSection === "guests" ? "flex w-[97px] min-h-[110px] items-center justify-center rounded-full bg-[#FCDF9C] text-[42px]" : "w-5 text-center text-base"} font-normal text-[#1F1F1F]`}>{editGuests}</span>
                      <button
                        type="button"
                        onClick={() => setEditGuests(Math.min(MAX_GUEST_CAPACITY, editGuests + 1))}
                        className={`${activeSection === "guests" ? "size-8" : "size-8"} rounded-full border border-[#1f1f1f] bg-white flex items-center justify-center text-[#1f1f1f] hover:text-white font-normal text-lg hover:bg-[#1f1f1f] cursor-pointer transition-all`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Quick Counters: Bedrooms & Beds */}
                  {activeSection !== "guests" && <div className="flex flex-col gap-3 border-t border-[#DDDDDE] pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-base font-medium text-[#1F1F1F] block">Bedrooms</span>
                        <span className="text-[14px] font-normal text-[#727272]">Total bedroom spaces</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditBedrooms(Math.max(0, editBedrooms - 1))}
                          className="size-8 rounded-full border border-[#1F1F1F] flex items-center justify-center text-base font-normal text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer"
                        >
                          <Image src="/images/icons/minus-icon.svg" alt="Decrease bedrooms" width={14} height={14} className="size-3.5 object-contain" />
                        </button>
                        <span className="w-5 text-center text-base font-normal text-[#1F1F1F]">{editBedrooms}</span>
                        <button
                          type="button"
                          onClick={() => setEditBedrooms(Math.min(30, editBedrooms + 1))}
                          className="size-8 rounded-full border border-[#1F1F1F] flex items-center justify-center text-base font-normal text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-base font-medium text-[#1F1F1F] block">Beds</span>
                        <span className="text-[14px] font-normal text-[#727272]">Total beds available</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditBeds(Math.max(1, editBeds - 1))}
                          className="size-8 rounded-full border border-[#1F1F1F] flex items-center justify-center text-base font-normal text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer"
                        >
                          <Image src="/images/icons/minus-icon.svg" alt="Decrease beds" width={14} height={14} className="size-3.5 object-contain" />
                        </button>
                        <span className="w-5 text-center text-base font-normal text-[#1F1F1F]">{editBeds}</span>
                        <button
                          type="button"
                          onClick={() => setEditBeds(Math.min(50, editBeds + 1))}
                          className="size-8 rounded-full border border-[#1F1F1F] flex items-center justify-center text-base font-normal text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>}
                </div>
              </div>

              {/* Section 2: Room-Level Sleeping Arrangements */}
              {activeSection !== "guests" && <div className="max-w-[491px] space-y-4">
                <div className="flex sm:flex-row flex-col sm:items-center items-start justify-between gap-6">
                  <div>
                    <h3 className="text-base font-medium text-[#1F1F1F]">Room-by-room sleeping arrangements</h3>
                    <p className="text-[14px] font-normal text-[#727272]">Specify beds for each bedroom or common space</p>
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
                    className="rounded-full bg-[#FCDF9C] px-4 py-2 text-sm font-medium text-[#1F1F1F] hover:bg-[#1f1f1f] hover:text-white cursor-pointer transition-colors whitespace-nowrap">
                    + Add room
                  </button>
                </div>

                {/* Render Rooms List */}
                {(!rooms || rooms.length === 0) ? (
                  <div className="rounded-md border border-dashed border-[#DDDDDE] bg-zinc-50 p-6 text-center space-y-2">
                    <p className="text-[14px] text-[#727272]">No rooms configured yet.</p>
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
                      <div key={room.id || roomIdx} className="rounded-md border border-[#DDDDDE] bg-white p-4 space-y-3">
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
                              className="text-base font-medium text-[#1F1F1F] border-b border-transparent hover:border-zinc-300 focus:border-[#1F1F1F] outline-none px-1 py-0.5"
                            />
                            <span className="text-[14px] font-normal bg-zinc-100 text-[#727272] px-2 py-0.5 rounded-full">
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
                        <div className="space-y-2 pt-1">
                          {room.beds.map((bed, bedIdx) => (
                            <div key={bedIdx} className="flex items-center justify-between text-base py-2 border-b border-[#DDDDDE] last:border-0">
                              <span className="text-[#1F1F1F] font-normal capitalize">
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
                                  className="size-7 rounded-full border border-[#1F1F1F] flex items-center justify-center text-base text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer"
                                >
                                  <Image src="/images/icons/minus-icon.svg" alt="Decrease bed count" width={12} height={12} className="size-3 object-contain" />
                                </button>
                                <span className="w-5 text-center font-normal text-[#1F1F1F]">{bed.count}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...rooms];
                                    updated[roomIdx].beds[bedIdx].count += 1;
                                    setRooms?.(updated);
                                    const totalBeds = updated.reduce((sum, r) => sum + r.beds.reduce((bSum, b) => bSum + b.count, 0), 0);
                                    setEditBeds(Math.max(1, totalBeds));
                                  }}
                                  className="size-7 rounded-full border border-[#1F1F1F] flex items-center justify-center text-base text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer"
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
                              className="text-[14px] font-normal text-[#727272] bg-white border border-[#DDDDDE] rounded-md px-3 py-2 outline-none cursor-pointer"
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
              </div>}

              {/* Section 3: Bathroom Breakdown */}
              {activeSection !== "guests" && <div className="max-w-[491px] rounded-md border border-[#DDDDDE] bg-white p-4 space-y-4">
                <div>
                  <h3 className="text-base font-medium text-[#1F1F1F]">Bathroom breakdown</h3>
                  <p className="text-[14px] font-normal text-[#727272]">Specify full and half bathrooms available to guests</p>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-[#1f1f1f] block">Full bathrooms</span>
                      <span className="sm:text-sm text-xs text-[#727272] leading-tight">Includes shower/bathtub, sink, and toilet</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.max(0, (fullBathrooms || 1) - 1);
                          setFullBathrooms?.(val);
                          setEditBathrooms(val + (halfBathrooms || 0));
                        }}
                        className="size-7 rounded-full border border-[#1F1F1F] flex items-center justify-center text-base text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer"
                      >
                        <Image src="/images/icons/minus-icon.svg" alt="Decrease full bathrooms" width={14} height={14} className="size-3.5 object-contain" />
                      </button>
                      <span className="w-4 text-center text-base font-medium text-[#1f1f1f]">{fullBathrooms ?? 1}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const val = (fullBathrooms || 0) + 1;
                          setFullBathrooms?.(val);
                          setEditBathrooms(val + (halfBathrooms || 0));
                        }}
                        className="size-7 rounded-full border border-[#1F1F1F] flex items-center justify-center text-base text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                    <div>
                      <span className="text-sm font-medium text-[#1f1f1f] block">Half bathrooms</span>
                      <span className="sm:text-sm text-xs text-[#727272] leading-tight">Includes sink and toilet only (no bath or shower)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.max(0, (halfBathrooms || 0) - 1);
                          setHalfBathrooms?.(val);
                          setEditBathrooms((fullBathrooms || 1) + val);
                        }}
                        className="size-7 rounded-full border border-[#1F1F1F] flex items-center justify-center text-base text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer"
                      >
                        <Image src="/images/icons/minus-icon.svg" alt="Decrease half bathrooms" width={14} height={14} className="size-3.5 object-contain" />
                      </button>
                      <span className="w-4 text-center text-base font-medium text-[#1f1f1f]">{halfBathrooms ?? 0}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const val = (halfBathrooms || 0) + 1;
                          setHalfBathrooms?.(val);
                          setEditBathrooms((fullBathrooms || 1) + val);
                        }}
                        className="size-7 rounded-full border border-[#1F1F1F] flex items-center justify-center text-base text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                    <div>
                      <span className="text-sm font-medium text-[#1f1f1f] block">Bathroom privacy</span>
                      <span className="sm:text-sm text-xs text-[#727272] leading-tight">Are the bathrooms private or shared with host/others?</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPrivateBathrooms?.(fullBathrooms || 1);
                          setSharedBathrooms?.(0);
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer duration-300 ${(sharedBathrooms ?? 0) === 0
                          ? "bg-[#FCDF9C] border border-transparent text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white"
                          : "bg-[#F3F4F5] border border-transparent text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white"
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
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer duration-300 ${(sharedBathrooms ?? 0) > 0
                          ? "bg-[#FCDF9C] border border-transparent text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white"
                          : "bg-[#F3F4F5] border border-[#1f1f1f] text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white"
                          }`}
                      >
                        Shared
                      </button>
                    </div>
                  </div>
                </div>
              </div>}

              {/* Save Button */}
              <div className={`${activeSection === "guests" ? "pt-2 text-center" : "pt-2"}`}>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveSection("guests")}
                  className={`${activeSection === "guests" ? "w-full sm:w-auto sm:min-w-[136px]" : ""} rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1F1F1F] hover:text-white font-medium text-sm px-8 py-3.5 shadow-2xs transition-all duration-300 cursor-pointer`}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 5: AMENITIES */}
      {/* --------------------------------------------------------- */}
      {(activeSection === "amenities" || activeSection === "add-amenities") && (() => {
        const AMENITY_FILTER_CATEGORIES = [
          { id: "all", label: "All" },
          { id: "favorites", label: "Basics" },
          { id: "bathroom", label: "Bathroom" },
          { id: "bedroom_laundry", label: "Bedroom and laundry" },
          { id: "entertainment", label: "Entertainment" },
          { id: "family", label: "Family" },
          { id: "climate", label: "Heating and cooling" },
          { id: "safety", label: "Home safety" },
          { id: "internet_workspace", label: "Internet and office" },
          { id: "kitchen_dining", label: "Kitchen and dining" },
          { id: "location_features", label: "Location features" },
          { id: "outdoor", label: "Outdoor" },
          { id: "parking_facilities", label: "Parking and facilities" },
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
            } else if (amenityCategory === "location_features") {
              if (item.category !== "facilities" && item.category !== "standout" && item.category !== "premium") {
                return false;
              }
            } else if (amenityCategory === "parking_facilities") {
              if (item.category !== "parking" && item.category !== "facilities") {
                return false;
              }
            } else if (amenityCategory === "services") {
              if (item.category !== "services") {
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
          <div className="w-full sm:max-w-[calc(100%-75px)] space-y-5 animate-in fade-in font-sans">
            {/* Header */}
            <div className="flex sm:flex-row flex-col sm:gap-0 gap-5 sm:items-center items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-start gap-6">
                  <BackButton onClick={() => {
                    setIsEditingAmenityList(false);
                    setActiveSection(activeSection === "add-amenities" ? "amenities" : "description");
                  }} />
                  <div className="space-y-1">
                    <h1 className="text-2xl font-medium tracking-tight text-[#1F1F1F]">
                      {activeSection === "add-amenities" ? "Add amenities" : "Amenities"}
                    </h1>
                    <p className="sm:text-[14px] text-xs font-normal leading-5.5 text-[#727272]">
                      You&apos;ve added these to your listing so far.
                    </p>
                  </div>
                </div>

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
                    } else if (isEditingAmenityList) {
                      await handleSaveSection("amenities");
                      setIsEditingAmenityList(false);
                    } else {
                      setIsEditingAmenityList(true);
                    }
                  }}
                  className={`flex items-center rounded-full px-4.5 py-2 text-base font-medium text-[#1F1F1F] hover:text-white duration-300 group transition-all disabled:cursor-not-allowed disabled:opacity-50 min-h-[48px] ${activeSection === "add-amenities" || isEditingAmenityList
                    ? "bg-[#FCDF9C] hover:bg-[#1F1F1F]"
                    : "bg-[#F3F4F5] hover:bg-[#1F1F1F]"
                    }`}
                >
                  {activeSection === "amenities" && !isEditingAmenityList && (
                    <Image
                      src="/images/icons/writing-pen.svg"
                      alt=""
                      width={24}
                      height={24}
                      className="mr-2 size-6 object-contain transition-[filter] group-hover:brightness-0 group-hover:invert"
                    />
                  )}
                  {activeSection === "add-amenities" || isEditingAmenityList ? (isSaving ? "Saving..." : "Done") : "Edit"}
                </button>
                {activeSection === "amenities" && !isEditingAmenityList && <button
                  type="button"
                  onClick={() => setActiveSection("add-amenities")}
                  className="size-12 rounded-full bg-[#F3F4F5] flex items-center justify-center text-[#1F1F1F] hover:text-white hover:bg-[#1f1f1f] text-2xl font-normal cursor-pointer transition-all"
                  aria-label="Add amenities"
                >
                  +
                </button>}
              </div>
            </div>

            {isLoading ? (
              <AmenitiesSkeleton />
            ) : activeSection === "add-amenities" ? (
              /* Add Amenities Selection View */
              <div className="space-y-3 pt-1">
                {/* Search remains available on compact screens without changing the desktop Figma layout. */}
                <div className="relative sm:hidden">
                  <input
                    type="text"
                    value={amenitySearch}
                    onChange={(e) => setAmenitySearch(e.target.value)}
                    placeholder="Search amenities (e.g. Wifi, Pool, Kitchen)..."
                    className="w-full rounded-md border border-[#DDDDDE] bg-white px-3 py-2.5 focus:border-[#1F1F1F] focus:outline-none text-sm font-normal text-[#1F1F1F] placeholder:text-[#727272] transition-all"
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
                <div className="flex flex-wrap gap-x-1 gap-y-2 pt-2">
                  {AMENITY_FILTER_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setAmenityCategory(cat.id)}
                      className={`rounded-full border px-6 py-2 text-sm font-normal transition-all cursor-pointer ${amenityCategory === cat.id
                        ? "border-[#727272] bg-[#F3F4F5] text-[#1F1F1F]"
                        : "border-[#727272] hover:border-[#1F1F1F] bg-white text-[#727272] hover:text-[#1F1F1F] hover:bg-[#F3F4F5]"
                        }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Filtered Amenities List */}
                <div className="relative min-h-0">
                  <div
                    ref={amenitiesScrollRef}
                    onScroll={updateAmenitiesScrollThumb}
                    className="custom-scrollbar lg:h-[1850px] divide-y divide-[#DDDDDE] overflow-x-hidden overflow-y-auto pt-6 pr-1 lg:pr-[85px]"
                  >
                    {filteredCatalog.length === 0 ? (
                      <div className="py-12 text-center text-zinc-400 text-xs">
                        No amenities found matching "{amenitySearch}".
                      </div>
                    ) : (
                      filteredCatalog.map((item) => {
                        const isSelected = normalizedSelectedIds.has(item.id);
                        const iconSource = AMENITY_ICON_SOURCES[item.id];
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleAmenity(item.id)}
                            className="flex items-center justify-between gap-3 py-3 cursor-pointer group select-none transition-all"
                          >
                            <div className="flex items-center sm:gap-6 gap-4 min-w-0 pr-4">
                              <div className="size-10 rounded-full border border-[#1f1f1f] bg-white flex items-center justify-center text-base shrink-0 group-hover:border-[#727272]">
                                {iconSource ? (
                                  <Image src={iconSource} alt="" width={24} height={24} className="size-6 object-contain" />
                                ) : (
                                  item.icon || "✨"
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-medium text-base text-[#1F1F1F] block">
                                  {item.label}
                                </span>
                              </div>
                            </div>

                            {isSelected ? (
                              <div className="size-8 rounded-full bg-[#FCDF9C] flex items-center justify-center text-[#1F1F1F] font-normal text-base shrink-0">
                                <Image src="/images/icons/right-mark.svg" alt="Selected" width={11} height={10} className="size-2.5 object-contain" />
                              </div>
                            ) : (
                              <div className="size-8 rounded-full border border-[#1f1f1f] bg-[#F3F4F5] flex items-center justify-center text-[#1f1f1f] group-hover:bg-zinc-100 text-base font-normal transition-all shrink-0">
                                <Image src="/images/icons/add-Icon.svg" alt="Add" width={14} height={14} className="size-3.5 object-contain" />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  {amenitiesScrollThumb.visible && (
                    <div ref={amenitiesScrollTrackRef} aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[22px] rounded-[30px] bg-[#F3F4F5] lg:block">
                      <div
                        className="absolute left-0 top-0 w-[22px] rounded-[30px] border border-white bg-[#DDDDDE] shadow-[0_2px_4px_rgba(0,0,0,0.25)] will-change-transform"
                        style={{ height: `${amenitiesScrollThumb.height}px`, transform: `translate3d(0, ${amenitiesScrollThumb.top}px, 0)` }}
                      />
                    </div>
                  )}
                </div>

              </div>
            ) : (
              /* Main Amenities List View */
              <div className="max-w-[716px] space-y-2 pt-1">
                {editAmenities.length === 0 ? (
                  <div className="p-8 text-center rounded-md border border-dashed border-[#DDDDDE] bg-zinc-50/50 space-y-3">
                    <p className="text-[14px] text-[#727272] font-normal">
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
                  <div className="divide-y divide-[#DDDDDE]">
                    {editAmenities.map((am) => {
                      const meta = getAmenityMeta(am);
                      const iconSource = AMENITY_ICON_SOURCES[meta.id];
                      return (
                        <div key={am} className="py-3 flex items-start sm:gap-6 gap-4">
                          {isEditingAmenityList ? (
                            <button
                              type="button"
                              onClick={() => toggleAmenity(am)}
                              className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-[#B9B9BA] bg-white text-base font-normal text-[#727272] hover:border-[#1F1F1F] hover:bg-[#F3F4F5] cursor-pointer transition-colors"
                              aria-label={`Remove ${meta.label}`}
                            >
                              <Image src="/images/icons/minus-icon.svg" alt={`Remove ${meta.label}`} width={14} height={14} className="size-3.5 object-contain" />
                            </button>
                          ) : (
                            <div className="size-10 rounded-full border border-[#B9B9BA] bg-white flex items-center justify-center text-sm shrink-0">
                              {iconSource ? (
                                <Image src={iconSource} alt="" width={20} height={20} className="size-6 object-contain" />
                              ) : (
                                meta.icon || "✨"
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <h4 className="font-medium text-lg text-[#1F1F1F]">
                              {meta.label}
                            </h4>
                            {meta.description && (
                              <p className="sm:text-base text-sm text-[#727272] font-normal leading-5">
                                {meta.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}
          </div>
        );
      })()}

      {/* --------------------------------------------------------- */}
      {/* VIEW 2: ACCESSIBILITY FEATURES */}
      {/* --------------------------------------------------------- */}
      {activeSection === "accessibility" && (
        <div className="space-y-6 animate-in fade-in max-w-[calc(100%-75px)] pb-10 font-sans">
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

          {isLoading ? (
            <AccessibilitySkeleton />
          ) : (
            <>
              {/* List of Accessibility Features */}
              <div className="sm:mt-[64px] mt-6">
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
                  const isCollapsing = collapsingAccessibilityFeature === feature.id;
                  const isOpening = openingAccessibilityFeature === feature.id;

                  if (isExpanded) {
                    return (
                      /* Expanded Grey Container Card matching Figma Screenshot 1 */
                      <div
                        key={feature.id}
                        className={`overflow-hidden rounded-2xl space-y-4 transition-[max-height,opacity,padding,transform,border-color] duration-300 ease-in-out ${isCollapsing || isOpening
                          ? "pointer-events-none max-h-0 -translate-y-1 border-transparent bg-transparent p-0 opacity-0"
                          : "max-h-[1600px] translate-y-0 border border-[#1f1f1f] bg-zinc-100/90 p-5 opacity-100 shadow-2xs"
                          }`}
                      >
                        {/* Top Row: Icon, Title, Description, Minus Button */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-full border border-[#1f1f1f] bg-white flex items-center justify-center text-sm shrink-0 shadow-2xs mt-0.5">
                              {feature.icon}
                            </div>
                            <div className="space-y-1">
                              <h3 className="font-medium text-base text-[#1F1F1F]">{feature.name}</h3>
                              <p className="text-base text-[#727272] font-normal leading-relaxed max-w-md">
                                {feature.desc}
                              </p>
                            </div>
                          </div>

                          {/* Minus Button to Collapse */}
                          <button
                            type="button"
                            onClick={() => collapseAccessibilityFeature(feature.id)}
                            className="w-8 h-8 rounded-full border border-[#1f1f1f] bg-white flex items-center justify-center text-zinc-700 hover:bg-zinc-100 text-xs font-semibold shrink-0 shadow-2xs transition-all cursor-pointer"
                          >
                            <Image src="/images/icons/minus-icon.svg" alt="Collapse" width={12} height={12} className="size-3 object-contain" />
                          </button>
                        </div>

                        {/* Examples Gallery Grid */}
                        <div className="space-y-2 pt-1">
                          <span className="text-sm mb-3 font-normal text-[#727272]">Examples:</span>
                          <div className="grid grid-cols-4 gap-6">
                            <div className="aspect-[4/4] rounded-xl bg-[#D9D9D9] border border-[#D9D9D9] flex items-center justify-center text-[10px] text-[#1f1f1f] font-medium">
                              {/* Photo 1 */}
                            </div>
                            <div className="aspect-[4/4] rounded-xl bg-[#D9D9D9] border border-[#D9D9D9] flex items-center justify-center text-[10px] text-[#1f1f1f] font-medium">
                              {/* Photo 2 */}
                            </div>
                            <div className="aspect-[4/4] rounded-xl bg-[#D9D9D9] border border-[#D9D9D9] flex items-center justify-center text-[10px] text-[#1f1f1f] font-medium">
                              {/* Photo 3 */}
                            </div>
                          </div>
                        </div>

                        {/* Feature Selection Options */}
                        <div className="feature-selection-options space-y-2 pt-1 max-w-[490px]">
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
                            className={`rounded-lg p-3.5 flex items-center gap-8 cursor-pointer transition-all ${!isSelected
                              ? "bg-white border border-[#1f1f1f]"
                              : "bg-transparent border border-[#727272] hover:border-[#1f1f1f]"
                              }`}
                          >
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${!isSelected ? "border-zinc-900 bg-[#1f1f1f]" : "border-[#727272]"
                              }`}>
                              {!isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <span className={`${!isSelected ? "font-semibold" : "font-medium"} text-base text-[#1F1F1F]`}>I don't have this feature</span>
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
                            className={`rounded-lg p-3.5 flex items-center gap-8 cursor-pointer transition-all ${isSelected
                              ? "bg-white border border-[#1f1f1f]"
                              : "bg-transparent border border-[#727272] hover:border-[#1f1f1f]"
                              }`}
                          >
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? "border-zinc-900 bg-zinc-900" : "border-zinc-400"
                              }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <span className={`${isSelected ? "font-semibold" : "font-medium"} text-base text-[#1F1F1F]`}>I have this feature</span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="rounded-xl border border-zinc-200 bg-white p-3.5 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <h4 className="text-base font-medium text-[#1F1F1F]">Photos of this feature</h4>
                                <p className="mt-0.5 text-xs text-[#727272]">Add at least one photo to verify this accessibility feature.</p>
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
                                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60"
                              >
                                {uploadingAccessibilityPhoto && accessibilityPhotoFeatureId === featureId ? "Uploading…" : "+ Add photos"}
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
                              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">A photo is required before this feature can be saved.</p>
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
                      className="py-3 px-5 flex items-center justify-between cursor-pointer group select-none"
                    >
                      <div
                        className="flex items-center gap-3 flex-1"
                        onClick={() => expandAccessibilityFeature(feature.id)}
                      >
                        <div className="w-10 h-10 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-sm shrink-0 shadow-2xs group-hover:border-zinc-300">
                          {feature.icon}
                        </div>
                        <span className="font-medium text-base text-[#1F1F1F] tracking-tight">{feature.name}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => expandAccessibilityFeature(feature.id)}
                        className="w-8 h-8 rounded-full border border-[#1F1F1F] bg-[#F3F4F5] flex items-center justify-center text-[#1f1f1f] group-hover:bg-[#1f1f1f] text-lg font-normal transition-all cursor-pointer group duration-300"
                      >
                        <Image src="/images/icons/add-Icon.svg" alt="Add" width={14} height={14} className="size-3.5 object-contain group-hover:transform-filter group-hover:brightness-0 group-hover:invert" />
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
                  className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-8 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300"
                >
                  {uploadingAccessibilityPhoto ? "Uploading..." : isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
