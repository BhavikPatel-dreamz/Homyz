"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities -- legacy editor integration */

import { BackButton } from "@/components/ui/back-button";
import { useScrollbarDrag } from "@/components/ui/use-scrollbar-drag";
import Image from "next/image";

import React from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { AMENITY_ICON_SOURCES, CANONICAL_AMENITIES, getAmenityMeta, normalizeAmenities, normalizeAmenityId, getAmenityTranslationKey } from "@/lib/constants/amenities";
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

function getBedTypeLabel(type: string, t: (key: any, ...args: any[]) => string): string {
  const key = `host_bed_${type.toLowerCase()}`;
  const translated = t(key);
  if (translated && translated !== key) return translated;
  return type.toLowerCase().replace(/_/g, " ") + " bed";
}

function getRoomTypeLabel(type: string, t: (key: any, ...args: any[]) => string): string {
  const key = `host_room_type_${type.toLowerCase()}`;
  const translated = t(key);
  if (translated && translated !== key) return translated;
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
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
  const { t } = useLanguage();
  const handleBack = (fallback = "propertyType") => {
    setActiveSection(fallback as any);
  };
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
  const { isDragging: isAmenitiesScrollbarDragging, onThumbPointerDown: onAmenitiesThumbPointerDown, scrollByPage: scrollAmenitiesByPage } = useScrollbarDrag(
    amenitiesScrollRef,
    amenitiesScrollTrackRef,
    amenitiesScrollThumb.height,
  );
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
      const arrowSpace = 28;
      const usableTrackHeight = Math.max(0, trackHeight - arrowSpace * 2);
      // Preserve the compact Figma thumb while mapping its travel exactly to
      // the content scroll range.
      const height = hasOverflow ? Math.min(60, usableTrackHeight) : 0;
      const maxTop = Math.max(0, usableTrackHeight - height);
      const scrollRange = Math.max(1, element.scrollHeight - element.clientHeight);
      const top = hasOverflow ? arrowSpace + Math.round((element.scrollTop / scrollRange) * maxTop) : 0;

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
        <div className="w-full max-w-full space-y-6 animate-in fade-in pb-10 font-sans lg:max-w-[calc(100%-75px)]">
          {/* Header & Back Button */}
          <div className="sm:space-y-1.5 space-y-3">
            <div className="flex items-start gap-6">
              <BackButton onClick={() => setActiveSection("title")} className="mt-2" />
              <div>
                <h1>{t("host_description_heading")}</h1>
                <p className="text-sm leading-5 text-[#727272] dark:text-zinc-400 max-w-[491px]">
                  {t("host_availability_subtitle")}{" "}
                  <a href="#" onClick={(e) => e.preventDefault()} className="underline cursor-pointer text-[#1f1f1f] hover:text-[#727272] dark:text-zinc-100 dark:hover:text-amber-400">
                    {t("host_learn_more")}
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
              <div className="rounded-xl border border-white bg-white p-4 shadow-[0px_2px_4px_0px_#00000040] space-y-3 transition-all duration-300 dark:bg-zinc-800/90 dark:border-zinc-700">
                <div
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setOpenDescAccordion(openDescAccordion === "description" ? null : "description")}
                >
                  <div className="space-y-0.5">
                    <h3 className="font-medium text-base text-[#1F1F1F] dark:text-zinc-100">{t("host_listing_description_title")}</h3>
                    <span className="text-base text-[#727272] font-normal block dark:text-zinc-400">
                      {Math.max(0, 500 - (editDescription?.length || 0))}/500 {t("host_available")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Image
                      src="/images/icons/chevron-down-dark.svg"
                      alt={openDescAccordion === "description" ? t("host_collapse") : t("host_expand")}
                      width={16}
                      height={16}
                      className={`size-4 object-contain transition-transform duration-200 ease-out dark:invert ${openDescAccordion === "description" ? "rotate-180" : "rotate-[270deg]"}`}
                    />
                  </div>
                </div>

                {openDescAccordion === "description" && (
                  <div className="space-y-3 pt-1">
                    <div className="rounded-xl bg-white border border-zinc-200 p-1 shadow-2xs dark:bg-zinc-900 dark:border-zinc-700">
                      <textarea
                        rows={5}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder={t("host_description_placeholder")}
                        className="w-full text-base text-[#727272] outline-none bg-transparent leading-relaxed resize-none p-4 sm:p-5 font-normal dark:text-zinc-200 dark:placeholder-zinc-500"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveSection("description")}
                      className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-8 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-zinc-700 dark:hover:text-white dark:hover:border-zinc-600"
                    >
                      {isSaving ? t("host_saving") : t("host_save")}
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Your property */}
              <div className="rounded-xl border border-white bg-white p-4 shadow-[0px_2px_4px_0px_#00000040] space-y-3 transition-all duration-300 dark:bg-zinc-800/90 dark:border-zinc-700">
                <div
                  onClick={() => setOpenDescAccordion(openDescAccordion === "property" ? null : "property")}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="space-y-0.5">
                    <h4 className="font-medium text-base text-[#1F1F1F] dark:text-zinc-100">{t("host_your_property_title")}</h4>
                    <p className="text-base text-[#727272] font-normal dark:text-zinc-400">
                      {editPropertyDetails ? editPropertyDetails.slice(0, 40) + "..." : t("host_add_details")}
                    </p>
                  </div>
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt={openDescAccordion === "property" ? t("host_collapse") : t("host_expand")}
                    width={16}
                    height={16}
                    className={`size-4 object-contain transition-transform duration-200 ease-out dark:invert ${openDescAccordion === "property" ? "rotate-180" : "rotate-[270deg]"}`}
                  />
                </div>

                {openDescAccordion === "property" && (
                  <div className="space-y-3 pt-1">
                    <textarea
                      rows={4}
                      value={editPropertyDetails}
                      onChange={(e) => setEditPropertyDetails(e.target.value)}
                      placeholder={t("host_property_details_placeholder")}
                      className="w-full rounded-lg border border-[#727272] bg-white px-4 py-3.5 text-md font-normal text-[#727272] outline-none focus:border-[#1F1F1F] transition-colors shadow-2xs min-h-[56px] dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:focus:border-zinc-400 dark:placeholder-zinc-500"
                    />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveSection("description", "property")}
                      className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-8 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-zinc-700 dark:hover:text-white dark:hover:border-zinc-600"
                    >
                      {isSaving ? t("host_saving") : t("host_save")}
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Guest access */}
              <div className="rounded-xl border border-white bg-white p-4 shadow-[0px_2px_4px_0px_#00000040] space-y-3 transition-all duration-300 dark:bg-zinc-800/90 dark:border-zinc-700">
                <div
                  onClick={() => setOpenDescAccordion(openDescAccordion === "access" ? null : "access")}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="space-y-0.5">
                    <h4 className="font-medium text-base text-[#1F1F1F] dark:text-zinc-100">{t("host_guest_access_title")}</h4>
                    <p className="text-base text-[#727272] font-normal dark:text-zinc-400">
                      {editAccessDetails ? editAccessDetails.slice(0, 40) + "..." : t("host_add_details")}
                    </p>
                  </div>
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt={openDescAccordion === "access" ? t("host_collapse") : t("host_expand")}
                    width={16}
                    height={16}
                    className={`size-4 object-contain transition-transform duration-200 ease-out dark:invert ${openDescAccordion === "access" ? "rotate-180" : "rotate-[270deg]"}`}
                  />
                </div>

                {openDescAccordion === "access" && (
                  <div className="space-y-3 pt-1">
                    <textarea
                      rows={4}
                      value={editAccessDetails}
                      onChange={(e) => setEditAccessDetails(e.target.value)}
                      placeholder={t("host_guest_access_placeholder")}
                      className="w-full rounded-lg border border-[#727272] bg-white px-4 py-3.5 text-md font-normal text-[#727272] outline-none focus:border-[#1F1F1F] transition-colors shadow-2xs min-h-[56px] dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:focus:border-zinc-400 dark:placeholder-zinc-500"
                    />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveSection("description", "access")}
                      className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-8 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-zinc-700 dark:hover:text-white dark:hover:border-zinc-600"
                    >
                      {isSaving ? t("host_saving") : t("host_save")}
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Interaction with guests */}
              <div className="rounded-xl border border-white bg-white p-4 shadow-[0px_2px_4px_0px_#00000040] space-y-3 transition-all duration-300 dark:bg-zinc-800/90 dark:border-zinc-700">
                <div
                  onClick={() => setOpenDescAccordion(openDescAccordion === "interaction" ? null : "interaction")}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="space-y-0.5">
                    <h4 className="font-medium text-base text-[#1F1F1F] dark:text-zinc-100">{t("host_guest_interaction_title")}</h4>
                    <p className="text-base text-[#727272] font-normal dark:text-zinc-400">
                      {interactionDetails ? interactionDetails.slice(0, 40) + "..." : t("host_add_details")}
                    </p>
                  </div>
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt={openDescAccordion === "interaction" ? t("host_collapse") : t("host_expand")}
                    width={16}
                    height={16}
                    className={`size-4 object-contain transition-transform duration-200 ease-out dark:invert ${openDescAccordion === "interaction" ? "rotate-180" : "rotate-[270deg]"}`}
                  />
                </div>

                {openDescAccordion === "interaction" && (
                  <div className="space-y-3 pt-1">
                    <textarea
                      rows={4}
                      value={interactionDetails}
                      onChange={(e) => setInteractionDetails?.(e.target.value)}
                      placeholder={t("host_guest_interaction_placeholder")}
                      className="w-full rounded-lg border border-[#727272] bg-white px-4 py-3.5 text-md font-normal text-[#727272] outline-none focus:border-[#1F1F1F] transition-colors shadow-2xs min-h-[56px] dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:focus:border-zinc-400 dark:placeholder-zinc-500"
                    />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveSection("description", "interaction")}
                      className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-8 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-zinc-700 dark:hover:text-white dark:hover:border-zinc-600"
                    >
                      {isSaving ? t("host_saving") : t("host_save")}
                    </button>
                  </div>
                )}
              </div>

              {/* 5. Other details to note */}
              <div className="rounded-xl border border-white bg-white p-4 shadow-[0px_2px_4px_0px_#00000040] space-y-3 transition-all duration-300 dark:bg-zinc-800/90 dark:border-zinc-700">
                <div
                  onClick={() => setOpenDescAccordion(openDescAccordion === "other" ? null : "other")}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="space-y-0.5">
                    <h4 className="font-medium text-base text-[#1F1F1F] dark:text-zinc-100">{t("host_other_details_title")}</h4>
                    <p className="text-base text-[#727272] font-normal dark:text-zinc-400">
                      {otherDetails ? otherDetails.slice(0, 40) + "..." : t("host_add_details")}
                    </p>
                  </div>
                  <Image
                    src="/images/icons/chevron-down-dark.svg"
                    alt={openDescAccordion === "other" ? t("host_collapse") : t("host_expand")}
                    width={16}
                    height={16}
                    className={`size-4 object-contain transition-transform duration-200 ease-out dark:invert ${openDescAccordion === "other" ? "rotate-180" : "rotate-[270deg]"}`}
                  />
                </div>

                {openDescAccordion === "other" && (
                  <div className="space-y-3 pt-1">
                    <textarea
                      rows={4}
                      value={otherDetails}
                      onChange={(e) => setOtherDetails?.(e.target.value)}
                      placeholder={t("host_other_details_placeholder")}
                      className="w-full rounded-lg border border-[#727272] bg-white px-4 py-3.5 text-md font-normal text-[#727272] outline-none focus:border-[#1F1F1F] transition-colors shadow-2xs min-h-[56px] dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:focus:border-zinc-400 dark:placeholder-zinc-500"
                    />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveSection("description", "other")}
                      className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-8 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-zinc-700 dark:hover:text-white dark:hover:border-zinc-600"
                    >
                      {isSaving ? t("host_saving") : t("host_save")}
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
        <div className="w-full max-w-xl space-y-6 animate-in fade-in pb-10">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <BackButton onClick={() => setActiveSection("description")} />
            <h1 className="min-w-0">{t("host_listing_title")}</h1>
          </div>

          {isLoading ? (
            <TitleSkeleton />
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={t("host_title_placeholder")}
                className="w-full rounded-lg border border-[#727272] bg-white px-4 py-3.5 text-md font-normal text-[#727272] outline-none focus:border-[#1F1F1F] transition-colors shadow-2xs min-h-[56px]"
              />
              <div className="flex justify-between items-center text-xs text-[#727272] mb-0">
                <span>{t("host_title_max_chars")}</span>
                <span>{editTitle.length}/50</span>
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveSection("title")}
                className="mt-12 whitespace-nowrap rounded-full bg-[#FCDF9C] px-6 py-3 text-sm font-medium text-[#1F1F1F] transition-colors lg:inline-flex border border-transparent hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white"
              >
                {isSaving ? t("host_saving") : t("host_save_title")}
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
            <BackButton onClick={() => setActiveSection("description")} />
            <h1>{t("host_property_type_heading")}</h1>
          </div>

          {isLoading ? (
            <PropertyTypeSkeleton />
          ) : (
            <div className="space-y-5 pt-1">
              <div className="max-w-none space-y-5 lg:max-w-[491px]">
                {/* 1. Which is most like your place? */}
                <div className="space-y-3">
                  <label className="block text-base font-normal text-[#1F1F1F] dark:text-zinc-100">{t("host_which_is_most_like")}</label>
                  <div className="relative">
                    <select
                      value={whichIsMostLike}
                      onChange={(e) => setWhichIsMostLike(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3.5 pr-10 text-base text-[#727272] dark:text-zinc-100 font-normal outline-none focus:border-[#1F1F1F] dark:focus:border-zinc-500 transition-colors cursor-pointer min-h-[56px]"
                    >
                      <option value="APARTMENT">{t("host_category_apartment")}</option>
                      <option value="HOUSE">{t("host_category_house")}</option>
                      <option value="SECONDARY_UNIT">{t("host_type_secondary_unit")}</option>
                      <option value="UNIQUE_SPACE">{t("host_type_unique_space")}</option>
                      <option value="BED_AND_BREAKFAST">{t("host_type_bed_and_breakfast")}</option>
                      <option value="BOUTIQUE_HOTEL">{t("host_type_boutique_hotel")}</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500 dark:text-zinc-300">
                      <svg width="16" height="9" viewBox="0 0 16 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 1L8 8L1 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 2. Property type */}
                <div className="space-y-3">
                  <label className="block text-base font-normal text-[#1F1F1F] dark:text-zinc-100">{t("host_property_type_heading")}</label>
                  <div className="relative">
                    <select
                      value={editPropertyType}
                      onChange={(e) => {
                        setEditPropertyType(e.target.value);
                        setWhichIsMostLike(normalizeMostLikeSelection(e.target.value));
                      }}
                      className="w-full appearance-none rounded-lg border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3.5 pr-10 text-base text-[#727272] dark:text-zinc-100 font-normal outline-none focus:border-[#1F1F1F] dark:focus:border-zinc-500 transition-colors cursor-pointer min-h-[56px]"
                    >
                      <option value="APARTMENT">{t("host_category_apartment")}</option>
                      <option value="HOUSE">{t("host_category_house")}</option>
                      <option value="VILLA">{t("host_category_villa")}</option>
                      <option value="CABIN">{t("host_type_cabin")}</option>
                      <option value="COTTAGE">{t("host_type_cottage")}</option>
                      <option value="STUDIO">{t("host_type_studio")}</option>
                      <option value="LOFT">{t("host_type_loft")}</option>
                      <option value="PENTHOUSE">{t("host_type_penthouse")}</option>
                      <option value="TOWNHOUSE">{t("host_type_townhouse")}</option>
                      <option value="GUEST_HOUSE">{t("host_category_guest_house")}</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500 dark:text-zinc-300">
                      <svg width="16" height="9" viewBox="0 0 16 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 1L8 8L1 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs text-[#727272] dark:text-zinc-400 font-normal pt-0.5">
                    {t("host_apartment_desc")}
                  </p>
                </div>

                {/* 3. Listing type */}
                <div className="space-y-3">
                  <label className="block text-base font-normal text-[#1F1F1F] dark:text-zinc-100">{t("host_place_type_entire_title")}</label>
                  <div className="relative">
                    <select
                      value={editListingType}
                      onChange={(e) => setEditListingType(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3.5 pr-10 text-base text-[#727272] dark:text-zinc-100 font-normal outline-none focus:border-[#1F1F1F] dark:focus:border-zinc-500 transition-colors cursor-pointer min-h-[56px]"
                    >
                      <option value="ENTIRE_PLACE">{t("host_place_type_entire_title")}</option>
                      <option value="ROOM">{t("host_type_private_room")}</option>
                      <option value="SHARED_ROOM">{t("host_place_type_shared_title")}</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500 dark:text-zinc-300">
                      <svg width="16" height="9" viewBox="0 0 16 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 1L8 8L1 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-xs text-[#727272] dark:text-zinc-400 font-normal pt-0.5 leading-relaxed">
                    {t("host_entire_place_desc")}
                  </p>
                </div>

                {/* Conditional Building / Floor Details */}
                {isApartmentLike ? (
                  <>
                    {/* 4. How many floors are in the building */}
                    <div className="flex sm:flex-row flex-col sm:items-center items-start justify-between gap-5">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{t("host_how_many_floors")}</label>
                      <div className="flex items-center sm:gap-3 gap-1 min-w-[86px]">
                        <button
                          type="button"
                          onClick={() => setBuildingFloors?.(Math.max(1, (buildingFloors || 1) - 1))}
                          className="w-8 h-8 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-xl font-normal text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer transition-all duration-300"
                        >
                          <Image src="/images/icons/minus-icon.svg" alt="Decrease" width={14} height={14} className="size-3.5 object-contain dark:invert" />
                        </button>
                        <span className="w-5 text-center text-xs font-semibold text-[#1F1F1F] dark:text-zinc-100">{buildingFloors || 1}</span>
                        <button
                          type="button"
                          onClick={() => setBuildingFloors?.((buildingFloors || 1) + 1)}
                          className="w-8 h-8 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-xl font-normal text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer transition-all duration-300"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* 5. Which floor is the listing on? */}
                    <div className="flex sm:flex-row flex-col sm:items-center items-start justify-between gap-5">
                      <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{t("host_which_floor")}</label>
                      <div className="flex items-center sm:gap-3 gap-1 min-w-[86px]">
                        <button
                          type="button"
                          onClick={() => setListingFloor?.(Math.max(0, (listingFloor || 1) - 1))}
                          className="w-8 h-8 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-xl font-normal text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer transition-all duration-300"
                        >
                          <Image src="/images/icons/minus-icon.svg" alt="Decrease" width={14} height={14} className="size-3.5 object-contain dark:invert" />
                        </button>
                        <span className="w-5 text-center text-xs font-semibold text-[#1F1F1F] dark:text-zinc-100">{listingFloor ?? 1}</span>
                        <button
                          type="button"
                          onClick={() => setListingFloor?.((listingFloor || 0) + 1)}
                          className="w-8 h-8 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-xl font-normal text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer transition-all duration-300"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Elevator Available */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{t("host_elevator_available")}</label>
                        <p className="text-base text-[#727272] dark:text-zinc-400 font-normal">{t("host_elevator_desc")}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setElevatorAvailable?.(false)}
                          className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${elevatorAvailable === false
                            ? "bg-[#FEE08B] dark:bg-amber-400 border-amber-300 dark:border-amber-400 text-zinc-950 shadow-2xs"
                            : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                            }`}
                        >
                          ✕
                        </button>
                        <button
                          type="button"
                          onClick={() => setElevatorAvailable?.(true)}
                          className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold cursor-pointer transition-all ${elevatorAvailable === true
                            ? "bg-[#FEE08B] dark:bg-amber-400 border-amber-300 dark:border-amber-400 text-zinc-950 shadow-2xs"
                            : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
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
                        <p className="text-base text-[#1F1F1F] dark:text-zinc-100 font-normal">{t("host_how_many_floors")}</p>
                      </div>
                      <div className="flex items-center sm:gap-3 gap-1 min-w-[86px]">
                        <button
                          type="button"
                          onClick={() => setBuildingFloors?.(Math.max(1, (buildingFloors || 1) - 1))}
                          className="w-8 h-8 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-xl font-normal text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer transition-all duration-300"
                        >
                          <Image src="/images/icons/minus-icon.svg" alt="Decrease" width={14} height={14} className="size-3.5 object-contain dark:invert" />
                        </button>
                        <span className="w-5 text-center text-xs font-semibold text-[#1F1F1F] dark:text-zinc-100">{buildingFloors || 1}</span>
                        <button
                          type="button"
                          onClick={() => setBuildingFloors?.((buildingFloors || 1) + 1)}
                          className="w-8 h-8 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-xl font-normal text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer transition-all duration-300"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex sm:flex-row flex-col sm:items-center items-start justify-between gap-5">
                      <div className="space-y-0.5">
                        <p className="text-base text-[#1F1F1F] dark:text-zinc-100 font-normal">{t("host_private_exterior_door")}</p>
                      </div>
                      <div className="flex items-center gap-3 min-w-[86px]">
                        <button
                          type="button"
                          onClick={() => setPrivateEntrance?.(false)}
                          className={`w-8 h-8 rounded-full border flex items-center justify-center text-lg font-normal cursor-pointer transition-all ${privateEntrance === false
                            ? "bg-[#FEE08B] dark:bg-amber-400 border-[#FEE08B] dark:border-amber-400 text-[#1F1F1F] dark:text-zinc-950"
                            : "bg-white dark:bg-zinc-800 border-[#1F1F1F] dark:border-zinc-700 text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] dark:hover:bg-zinc-700 hover:text-white"
                            }`}
                        >
                          ✕
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrivateEntrance?.(true)}
                          className={`w-8 h-8 rounded-full border flex items-center justify-center text-lg font-normal cursor-pointer transition-all ${privateEntrance === true
                            ? "bg-[#FEE08B] dark:bg-amber-400 border-[#FEE08B] dark:border-amber-400 text-[#1F1F1F] dark:text-zinc-950"
                            : "bg-white dark:bg-zinc-800 border-[#1F1F1F] dark:border-zinc-700 text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] dark:hover:bg-zinc-700 hover:text-white"
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
                  <label className="block text-base font-normal text-[#1F1F1F] dark:text-zinc-100">{t("host_year_built")}</label>
                  <div className="relative">
                    <select
                      value={yearBuilt}
                      onChange={(e) => setYearBuilt?.(e.target.value)}
                      className="h-14 w-full appearance-none rounded-lg border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 pr-10 text-[#727272] dark:text-zinc-100 font-normal outline-none transition-colors cursor-pointer focus:border-[#1F1F1F] dark:focus:border-zinc-500 sm:h-11 sm:px-3 sm:pr-9 text-base"
                    >
                      <option value="">{t("host_select_year_optional")}</option>
                      {["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2018", "2015", "2010", "2005", "2000", "1995", "1990", "1980"].map((yr) => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 dark:text-zinc-300">
                      <svg width="14" height="8" viewBox="0 0 16 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 1L8 8L1 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 7. Property size & Unit */}
                <div className="space-y-2">
                  <div className="grid max-w-md grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
                    <div className="space-y-2">
                      <label className="block text-base font-normal text-[#1F1F1F] dark:text-zinc-100">{t("host_property_size")}</label>
                      <input
                        type="number"
                        value={propertySize}
                        onChange={(e) => setPropertySize?.(e.target.value)}
                        placeholder="e.g. 120"
                        min={1}
                        max={50000}
                        className="h-14 w-full rounded-lg border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 text-base font-normal text-[#727272] dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition-colors shadow-2xs focus:border-[#1F1F1F] dark:focus:border-zinc-500 sm:h-11 sm:px-3"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-base font-normal text-[#1F1F1F] dark:text-zinc-100">{t("host_unit")}</label>
                      <div className="relative">
                        <select
                          value={propertySizeUnit}
                          onChange={(e) => setPropertySizeUnit?.(e.target.value)}
                          className="h-14 w-full appearance-none rounded-lg border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 pr-10 text-base font-normal text-[#727272] dark:text-zinc-100 outline-none transition-colors shadow-2xs focus:border-[#1F1F1F] dark:focus:border-zinc-500 sm:h-11 sm:px-3 sm:pr-8"
                        >
                          <option value="SQM">SQM (m²)</option>
                          <option value="SQFT">SQFT (sq ft)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 dark:text-zinc-300">
                          <svg width="14" height="8" viewBox="0 0 16 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 1L8 8L1 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="pt-0.5 text-xs font-normal text-[#727272] dark:text-zinc-400">
                    {t("host_property_size_desc")}
                  </p>
                </div>
              </div>

              {/* 8. Category Information */}
              <div className="grid grid-cols-1 gap-6 pt-8 sm:grid-cols-[minmax(0,1fr)_20.25rem] sm:items-end">
                <div className="space-y-3">
                  <h3 className="text-2xl font-medium text-[#1F1F1F] dark:text-zinc-100">{t("host_your_category")}</h3>
                  <p className="text-base font-normal leading-relaxed text-[#727272] dark:text-zinc-400 mb-0">
                    {t("host_your_category_desc")}
                  </p>
                  <button type="button" className="text-base font-normal text-[#1F1F1F] dark:text-zinc-100 underline underline-offset-2 hover:text-[#727272] dark:hover:text-amber-400 transition-all duration-300">Learn more</button>
                </div>
                <div className="flex min-h-12 items-center rounded-lg bg-zinc-100 dark:bg-zinc-800/80 px-5 text-base font-normal text-[#1F1F1F] dark:text-zinc-200 sm:min-h-[140px] sm:rounded-[24px]">
                  {t("host_not_part_of_part")}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveSection("propertyType")}
                  className="w-full rounded-full border border-transparent bg-[#FCDF9C] dark:bg-amber-400 dark:text-zinc-950 px-4 py-2.25 text-lg font-medium text-[#1F1F1F] transition-all duration-300 cursor-pointer hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:text-white dark:hover:border-zinc-600 sm:w-auto sm:py-2.5 sm:text-base min-w-[136px]"
                >
                  {isSaving ? t("host_saving_btn") : t("host_save_btn")}
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
              <BackButton onClick={() => setActiveSection("propertyType")} className="mt-2" />
              <div className="space-y-1.5">
                <h1>{activeSection === "guests" ? t("host_number_of_guests") : t("host_sleeping_arrangements_title")}</h1>
                <p className="text-sm leading-5 text-[#727272] dark:text-zinc-400">
                  {activeSection === "guests" ? t("host_how_many_guests_question") : t("host_sleeping_arrangements_subtitle")}
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
                <div className={`${activeSection === "guests" ? "flex min-h-[500px] flex-col items-center justify-center gap-9 pb-14" : "space-y-4 rounded-md border border-[#DDDDDE] dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4"}`}>
                  {activeSection === "guests" && (
                    <p className="max-w-[320px] text-center text-xl font-normal leading-7 text-[#727272] dark:text-zinc-300">
                      {t("host_how_many_guests_question")}
                    </p>
                  )}
                  <div className={`flex items-center ${activeSection === "guests" ? "gap-12" : "justify-between"}`}>
                    {activeSection !== "guests" && (
                      <div>
                        <h3 className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100">{t("host_maximum_guests")}</h3>
                        <p className="text-[14px] font-normal text-[#727272] dark:text-zinc-400">{t("host_max_guests_desc")}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditGuests(Math.max(1, editGuests - 1))}
                        className={`${activeSection === "guests" ? "size-14 sm:size-16" : "size-8"} rounded-full border border-[#1f1f1f] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-[#1f1f1f] dark:text-zinc-100 hover:text-white hover:bg-[#1f1f1f] dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer transition-all shrink-0`}
                        aria-label="Decrease guests"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={activeSection === "guests" ? "size-7 sm:size-8" : "size-4"}
                        >
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                      <span className={`${activeSection === "guests" ? "flex w-[97px] min-h-[110px] items-center justify-center rounded-full bg-[#FCDF9C] dark:bg-amber-400 text-[#1F1F1F] dark:text-zinc-950 text-[42px]" : "w-5 text-center text-base text-[#1F1F1F] dark:text-zinc-100"} font-normal`}>{editGuests}</span>
                      <button
                        type="button"
                        onClick={() => setEditGuests(Math.min(MAX_GUEST_CAPACITY, editGuests + 1))}
                        className={`${activeSection === "guests" ? "size-14 sm:size-16" : "size-8"} rounded-full border border-[#1f1f1f] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-[#1f1f1f] dark:text-zinc-100 hover:text-white hover:bg-[#1f1f1f] dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer transition-all shrink-0`}
                        aria-label="Increase guests"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={activeSection === "guests" ? "size-7 sm:size-8" : "size-4"}
                        >
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Quick Counters: Bedrooms & Beds */}
                  {activeSection !== "guests" && <div className="flex flex-col gap-3 border-t border-[#DDDDDE] dark:border-zinc-700 pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">{t("host_bedrooms")}</span>
                        <span className="text-[14px] font-normal text-[#727272] dark:text-zinc-400">{t("host_bedrooms_desc")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditBedrooms(Math.max(0, editBedrooms - 1))}
                          className="size-8 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-base font-normal text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer"
                        >
                          <Image src="/images/icons/minus-icon.svg" alt="Decrease bedrooms" width={14} height={14} className="size-3.5 object-contain dark:invert" />
                        </button>
                        <span className="w-5 text-center text-base font-normal text-[#1F1F1F] dark:text-zinc-100">{editBedrooms}</span>
                        <button
                          type="button"
                          onClick={() => setEditBedrooms(Math.min(30, editBedrooms + 1))}
                          className="size-8 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-base font-normal text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 block">{t("host_beds")}</span>
                        <span className="text-[14px] font-normal text-[#727272] dark:text-zinc-400">{t("host_beds_desc")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditBeds(Math.max(1, editBeds - 1))}
                          className="size-8 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-base font-normal text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer"
                        >
                          <Image src="/images/icons/minus-icon.svg" alt="Decrease beds" width={14} height={14} className="size-3.5 object-contain dark:invert" />
                        </button>
                        <span className="w-5 text-center text-base font-normal text-[#1F1F1F] dark:text-zinc-100">{editBeds}</span>
                        <button
                          type="button"
                          onClick={() => setEditBeds(Math.min(50, editBeds + 1))}
                          className="size-8 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-base font-normal text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer"
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
                    <h3 className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100">{t("host_room_by_room_arrangements")}</h3>
                    <p className="text-[14px] font-normal text-[#727272] dark:text-zinc-400">{t("host_room_by_room_desc")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const roomIndex = (rooms || []).length + 1;
                      const newRoom: RoomData = {
                        id: `room_${Date.now()}`,
                        name: `${t("host_bedroom_name_prefix")} ${roomIndex}`,
                        type: "BEDROOM",
                        beds: [{ type: "QUEEN", count: 1 }],
                      };
                      const updated = [...(rooms || []), newRoom];
                      setRooms?.(updated);
                      setEditBedrooms(updated.filter((r) => r.type === "BEDROOM").length);
                      const totalBeds = updated.reduce((sum, r) => sum + r.beds.reduce((bSum, b) => bSum + b.count, 0), 0);
                      setEditBeds(Math.max(1, totalBeds));
                    }}
                    className="rounded-full bg-[#FCDF9C] dark:bg-amber-400 px-4 py-2 text-sm font-medium text-[#1F1F1F] dark:text-zinc-950 hover:bg-[#1f1f1f] hover:text-white dark:hover:bg-zinc-700 dark:hover:text-white cursor-pointer transition-colors whitespace-nowrap">
                    {t("host_add_room")}
                  </button>
                </div>

                {/* Render Rooms List */}
                {(!rooms || rooms.length === 0) ? (
                  <div className="rounded-md border border-dashed border-[#DDDDDE] dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-6 text-center space-y-2">
                    <p className="text-[14px] text-[#727272] dark:text-zinc-400">{t("host_no_rooms_yet")}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const defaultRoom: RoomData = {
                          id: "room_1",
                          name: `${t("host_bedroom_name_prefix")} 1`,
                          type: "BEDROOM",
                          beds: [{ type: "QUEEN", count: 1 }],
                        };
                        setRooms?.([defaultRoom]);
                      }}
                      className="text-xs font-semibold text-amber-700 dark:text-amber-400 underline cursor-pointer"
                    >
                      {t("host_add_bedroom_1")}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rooms.map((room, roomIdx) => (
                      <div key={room.id || roomIdx} className="rounded-md border border-[#DDDDDE] dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 space-y-3">
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
                              className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100 bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-[#1F1F1F] dark:focus:border-zinc-400 outline-none px-1 py-0.5"
                            />
                            <span className="text-[14px] font-normal bg-zinc-100 dark:bg-zinc-700 text-[#727272] dark:text-zinc-300 px-2 py-0.5 rounded-full">
                              {getRoomTypeLabel(room.type, t)}
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
                            className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition-colors p-1"
                            title={t("host_remove_room")}
                          >
                            ✕
                          </button>
                        </div>

                        {/* Beds in this room */}
                        <div className="space-y-2 pt-1">
                          {room.beds.map((bed, bedIdx) => (
                            <div key={bedIdx} className="flex items-center justify-between text-base py-2 border-b border-[#DDDDDE] dark:border-zinc-700 last:border-0">
                              <span className="text-[#1F1F1F] dark:text-zinc-100 font-normal">
                                {getBedTypeLabel(bed.type, t)}
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
                                  className="size-7 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-base text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer"
                                >
                                  <Image src="/images/icons/minus-icon.svg" alt="Decrease bed count" width={12} height={12} className="size-3 object-contain dark:invert" />
                                </button>
                                <span className="w-5 text-center font-normal text-[#1F1F1F] dark:text-zinc-100">{bed.count}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...rooms];
                                    updated[roomIdx].beds[bedIdx].count += 1;
                                    setRooms?.(updated);
                                    const totalBeds = updated.reduce((sum, r) => sum + r.beds.reduce((bSum, b) => bSum + b.count, 0), 0);
                                    setEditBeds(Math.max(1, totalBeds));
                                  }}
                                  className="size-7 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-base text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer"
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
                              className="text-[14px] font-normal text-[#727272] dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-[#DDDDDE] dark:border-zinc-700 rounded-md px-3 py-2 outline-none cursor-pointer"
                            >
                              <option value="">{t("host_add_bed_type")}</option>
                              <option value="KING">{t("host_bed_king")}</option>
                              <option value="QUEEN">{t("host_bed_queen")}</option>
                              <option value="DOUBLE">{t("host_bed_double")}</option>
                              <option value="SINGLE">{t("host_bed_single")}</option>
                              <option value="TWIN">{t("host_bed_twin")}</option>
                              <option value="SOFA_BED">{t("host_bed_sofa_bed")}</option>
                              <option value="BUNK_BED">{t("host_bed_bunk_bed")}</option>
                              <option value="CRIB">{t("host_bed_crib")}</option>
                              <option value="FLOOR_MATTRESS">{t("host_bed_floor_mattress")}</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>}

              {/* Section 3: Bathroom Breakdown */}
              {activeSection !== "guests" && <div className="max-w-[491px] rounded-md border border-[#DDDDDE] dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 space-y-4">
                <div>
                  <h3 className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100">{t("host_bathroom_breakdown")}</h3>
                  <p className="text-[14px] font-normal text-[#727272] dark:text-zinc-400">{t("host_bathroom_breakdown_desc")}</p>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-[#1f1f1f] dark:text-zinc-100 block">{t("host_full_bathrooms")}</span>
                      <span className="sm:text-sm text-xs text-[#727272] dark:text-zinc-400 leading-tight">{t("host_full_bathrooms_desc")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.max(0, (fullBathrooms || 1) - 1);
                          setFullBathrooms?.(val);
                          setEditBathrooms(val + (halfBathrooms || 0));
                        }}
                        className="size-7 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-base text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer"
                      >
                        <Image src="/images/icons/minus-icon.svg" alt="Decrease full bathrooms" width={14} height={14} className="size-3.5 object-contain dark:invert" />
                      </button>
                      <span className="w-4 text-center text-base font-medium text-[#1f1f1f] dark:text-zinc-100">{fullBathrooms ?? 1}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const val = (fullBathrooms || 0) + 1;
                          setFullBathrooms?.(val);
                          setEditBathrooms(val + (halfBathrooms || 0));
                        }}
                        className="size-7 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-base text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-700">
                    <div>
                      <span className="text-sm font-medium text-[#1f1f1f] dark:text-zinc-100 block">{t("host_half_bathrooms")}</span>
                      <span className="sm:text-sm text-xs text-[#727272] dark:text-zinc-400 leading-tight">{t("host_half_bathrooms_desc")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.max(0, (halfBathrooms || 0) - 1);
                          setHalfBathrooms?.(val);
                          setEditBathrooms((fullBathrooms || 1) + val);
                        }}
                        className="size-7 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-base text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer"
                      >
                        <Image src="/images/icons/minus-icon.svg" alt="Decrease half bathrooms" width={14} height={14} className="size-3.5 object-contain dark:invert" />
                      </button>
                      <span className="w-4 text-center text-base font-medium text-[#1f1f1f] dark:text-zinc-100">{halfBathrooms ?? 0}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const val = (halfBathrooms || 0) + 1;
                          setHalfBathrooms?.(val);
                          setEditBathrooms((fullBathrooms || 1) + val);
                        }}
                        className="size-7 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-base text-[#1F1F1F] dark:text-zinc-100 hover:bg-[#1F1F1F] hover:text-white dark:hover:bg-zinc-700 dark:hover:border-zinc-600 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-700">
                    <div>
                      <span className="text-sm font-medium text-[#1f1f1f] dark:text-zinc-100 block">{t("host_bathroom_privacy")}</span>
                      <span className="sm:text-sm text-xs text-[#727272] dark:text-zinc-400 leading-tight">{t("host_bathroom_privacy_desc")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPrivateBathrooms?.(fullBathrooms || 1);
                          setSharedBathrooms?.(0);
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer duration-300 ${(sharedBathrooms ?? 0) === 0
                          ? "bg-[#FCDF9C] dark:bg-amber-400 border border-transparent text-[#1f1f1f] dark:text-zinc-950 hover:bg-[#1f1f1f] hover:text-white dark:hover:bg-zinc-700 dark:hover:text-white"
                          : "bg-[#F3F4F5] dark:bg-zinc-800 border border-transparent dark:border-zinc-700 text-[#1f1f1f] dark:text-zinc-100 hover:bg-[#1f1f1f] hover:text-white dark:hover:bg-zinc-700"
                          }`}
                      >
                        {t("host_bathroom_private")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSharedBathrooms?.(1);
                          setPrivateBathrooms?.(0);
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer duration-300 ${(sharedBathrooms ?? 0) > 0
                          ? "bg-[#FCDF9C] dark:bg-amber-400 border border-transparent text-[#1f1f1f] dark:text-zinc-950 hover:bg-[#1f1f1f] hover:text-white dark:hover:bg-zinc-700 dark:hover:text-white"
                          : "bg-[#F3F4F5] dark:bg-zinc-800 border border-[#1f1f1f] dark:border-zinc-700 text-[#1f1f1f] dark:text-zinc-100 hover:bg-[#1f1f1f] hover:text-white dark:hover:bg-zinc-700"
                          }`}
                      >
                        {t("host_bathroom_shared")}
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
                  className={`${activeSection === "guests" ? "w-full sm:w-auto sm:min-w-[136px]" : ""} rounded-full bg-[#FCDF9C] dark:bg-amber-400 hover:bg-[#1F1F1F] dark:hover:bg-zinc-700 text-[#1F1F1F] dark:text-zinc-950 hover:text-white dark:hover:text-white font-medium text-sm px-8 py-3.5 shadow-2xs transition-all duration-300 cursor-pointer`}
                >
                  {isSaving ? t("host_saving") : t("host_save")}
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
        const getAmenityLabel = (id: string, fallback: string) => {
          const key = getAmenityTranslationKey(id) as keyof typeof import("@/messages/en.json");
          const translated = t(key);
          return translated && translated !== key ? translated : fallback;
        };

        const getAmenityDescription = (id: string, fallbackDesc?: string) => {
          const key = `host_amenity_desc_${id}` as keyof typeof import("@/messages/en.json");
          const translated = t(key);
          return translated && translated !== key ? translated : (fallbackDesc || "");
        };

        const AMENITY_FILTER_CATEGORIES = [
          { id: "all", label: t("host_amenity_cat_all") },
          { id: "favorites", label: t("host_amenity_cat_favorites") },
          { id: "bathroom", label: t("host_amenity_cat_bathroom") },
          { id: "bedroom_laundry", label: t("host_amenity_cat_bedroom_laundry") },
          { id: "entertainment", label: t("host_amenity_cat_entertainment") },
          { id: "family", label: t("host_amenity_cat_family") },
          { id: "climate", label: t("host_amenity_cat_climate") },
          { id: "safety", label: t("host_amenity_cat_safety") },
          { id: "internet_workspace", label: t("host_amenity_cat_internet_workspace") },
          { id: "kitchen_dining", label: t("host_amenity_cat_kitchen_dining") },
          { id: "location_features", label: t("host_amenity_cat_location_features") },
          { id: "outdoor", label: t("host_amenity_cat_outdoor") },
          { id: "parking_facilities", label: t("host_amenity_cat_parking_facilities") },
          { id: "services", label: t("host_amenity_cat_services") },
        ];

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
          const localizedName = getAmenityLabel(item.id, item.label);
          const localizedDesc = getAmenityDescription(item.id, item.description);
          return (
            item.label.toLowerCase().includes(q) ||
            localizedName.toLowerCase().includes(q) ||
            (item.description && item.description.toLowerCase().includes(q)) ||
            (localizedDesc && localizedDesc.toLowerCase().includes(q)) ||
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
                  <BackButton className="mt-2" onClick={() => {
                    setIsEditingAmenityList(false);
                    setActiveSection(activeSection === "add-amenities" ? "amenities" : "description");
                  }} />
                  <div className="space-y-1">
                    <h1>
                      {activeSection === "add-amenities" ? t("host_add_amenities_heading") : t("host_amenities_heading")}
                    </h1>
                    <p className="text-sm leading-5 text-[#727272] dark:text-zinc-400">
                      {activeSection === "add-amenities" ? t("host_amenities_subtitle") : t("host_amenities_added_so_far")}
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
                  className={`flex items-center rounded-full px-4.5 py-2 text-base font-medium transition-all duration-300 group disabled:cursor-not-allowed disabled:opacity-50 min-h-[48px] ${activeSection === "add-amenities" || isEditingAmenityList
                    ? "bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1F1F1F] hover:text-white dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-amber-300 dark:hover:text-zinc-950"
                    : "bg-[#F3F4F5] hover:bg-[#1F1F1F] text-[#1F1F1F] hover:text-white dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:border dark:border-zinc-700"
                    }`}
                >
                  {activeSection === "amenities" && !isEditingAmenityList && (
                    <Image
                      src="/images/icons/writing-pen.svg"
                      alt=""
                      width={24}
                      height={24}
                      className="mr-2 size-6 object-contain transition-[filter] group-hover:brightness-0 group-hover:invert dark:invert"
                    />
                  )}
                  {activeSection === "add-amenities" || isEditingAmenityList ? (isSaving ? t("host_saving") : t("host_done")) : t("host_edit")}
                </button>
                {activeSection === "amenities" && !isEditingAmenityList && <button
                  type="button"
                  onClick={() => setActiveSection("add-amenities")}
                  className="size-12 rounded-full bg-[#F3F4F5] dark:bg-zinc-800 dark:border dark:border-zinc-700 flex items-center justify-center text-[#1F1F1F] dark:text-zinc-100 hover:text-white hover:bg-[#1f1f1f] dark:hover:bg-zinc-700 text-2xl font-normal cursor-pointer transition-all"
                  aria-label={t("host_add_amenities_heading")}
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
                    placeholder={t("host_search_amenities_placeholder")}
                    className="w-full rounded-md border border-[#DDDDDE] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 focus:border-[#1F1F1F] dark:focus:border-amber-400 focus:outline-none text-sm font-normal text-[#1F1F1F] dark:text-zinc-100 placeholder:text-[#727272] dark:placeholder:text-zinc-500 transition-all"
                  />
                  {amenitySearch && (
                    <button
                      type="button"
                      onClick={() => setAmenitySearch("")}
                      className="absolute right-3 top-2.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
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
                        ? "border-[#727272] bg-[#F3F4F5] text-[#1F1F1F] dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                        : "border-[#727272] hover:border-[#1F1F1F] bg-white text-[#727272] hover:text-[#1F1F1F] hover:bg-[#F3F4F5] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:border-zinc-500"
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
                    className="custom-scrollbar lg:h-[1850px] divide-y divide-[#DDDDDE] dark:divide-zinc-800 overflow-x-hidden overflow-y-auto pt-6 pr-1 lg:pr-[85px]"
                  >
                    {filteredCatalog.length === 0 ? (
                      <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                        {t("host_no_amenities_matching")}
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
                              <div className="size-10 rounded-full border border-[#1f1f1f] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-base shrink-0 group-hover:border-[#727272] dark:group-hover:border-zinc-500">
                                {iconSource ? (
                                  <Image src={iconSource} alt="" width={24} height={24} className="size-6 object-contain dark:invert" />
                                ) : (
                                  item.icon || "✨"
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-medium text-base text-[#1F1F1F] dark:text-zinc-100 block">
                                  {getAmenityLabel(item.id, item.label)}
                                </span>
                              </div>
                            </div>

                            {isSelected ? (
                              <div className="size-8 rounded-full bg-[#FCDF9C] dark:bg-amber-400 flex items-center justify-center text-[#1F1F1F] dark:text-zinc-950 font-normal text-base shrink-0">
                                <Image src="/images/icons/right-mark.svg" alt={t("host_selected")} width={11} height={10} className="size-2.5 object-contain dark:invert-0" />
                              </div>
                            ) : (
                              <div className="size-8 rounded-full border border-[#1f1f1f] dark:border-zinc-700 bg-[#F3F4F5] dark:bg-zinc-800 flex items-center justify-center text-[#1f1f1f] dark:text-zinc-100 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-700 text-base font-normal transition-all shrink-0">
                                <Image src="/images/icons/add-Icon.svg" alt={t("host_add")} width={14} height={14} className="size-3.5 object-contain dark:invert" />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  {amenitiesScrollThumb.visible && (
                    <div ref={amenitiesScrollTrackRef} className="absolute inset-y-0 right-0 hidden w-[22px] rounded-[30px] bg-[#F3F4F5] dark:bg-zinc-800 lg:block">
                      <button type="button" aria-label="Scroll amenities up" onClick={() => scrollAmenitiesByPage("up")} className="absolute left-0 top-1 z-10 flex size-[22px] items-center justify-center rounded-full text-[#727272] transition hover:bg-white/70 hover:text-[#1f1f1f] dark:text-zinc-300 dark:hover:bg-zinc-700">
                        <svg aria-hidden="true" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m18 15-6-6-6 6" /></svg>
                      </button>
                      <div
                        onPointerDown={onAmenitiesThumbPointerDown}
                        className={`absolute left-0 top-0 w-[22px] touch-none select-none rounded-[30px] border border-white bg-[#DDDDDE] shadow-[0_2px_4px_rgba(0,0,0,0.25)] will-change-transform dark:border-zinc-700 dark:bg-zinc-600 ${isAmenitiesScrollbarDragging ? "cursor-grabbing" : "cursor-grab"}`}
                        style={{ height: `${amenitiesScrollThumb.height}px`, transform: `translate3d(0, ${amenitiesScrollThumb.top}px, 0)` }}
                      />
                      <button type="button" aria-label="Scroll amenities down" onClick={() => scrollAmenitiesByPage("down")} className="absolute bottom-1 left-0 z-10 flex size-[22px] items-center justify-center rounded-full text-[#727272] transition hover:bg-white/70 hover:text-[#1f1f1f] dark:text-zinc-300 dark:hover:bg-zinc-700">
                        <svg aria-hidden="true" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              /* Main Amenities List View */
              <div className="max-w-[716px] space-y-2 pt-1">
                {editAmenities.length === 0 ? (
                  <div className="p-8 text-center rounded-md border border-dashed border-[#DDDDDE] dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-3">
                    <p className="text-[14px] text-[#727272] dark:text-zinc-400 font-normal">
                      {t("host_no_amenities_added_yet")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveSection("add-amenities")}
                      className="rounded-full bg-[#FEE08B] dark:bg-amber-400 hover:bg-[#FDE047] dark:hover:bg-amber-300 text-zinc-950 font-semibold text-xs px-6 py-2 shadow-2xs transition-all cursor-pointer"
                    >
                      {t("host_add_amenities_btn")}
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-[#DDDDDE] dark:divide-zinc-800">
                    {editAmenities.map((am) => {
                      const meta = getAmenityMeta(am);
                      const localizedLabel = getAmenityLabel(meta.id, meta.label);
                      const iconSource = AMENITY_ICON_SOURCES[meta.id];
                      return (
                        <div key={am} className="py-3 flex items-start sm:gap-6 gap-4">
                          {isEditingAmenityList ? (
                            <button
                              type="button"
                              onClick={() => toggleAmenity(am)}
                              className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-[#B9B9BA] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base font-normal text-[#727272] dark:text-zinc-300 hover:border-[#1F1F1F] dark:hover:border-zinc-500 hover:bg-[#F3F4F5] dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                              aria-label={t("host_remove_amenity", { name: localizedLabel })}
                            >
                              <Image src="/images/icons/minus-icon.svg" alt={t("host_remove_amenity", { name: localizedLabel })} width={14} height={14} className="size-3.5 object-contain dark:invert" />
                            </button>
                          ) : (
                            <div className="size-10 rounded-full border border-[#B9B9BA] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-sm shrink-0">
                              {iconSource ? (
                                <Image src={iconSource} alt="" width={20} height={20} className="size-6 object-contain dark:invert" />
                              ) : (
                                meta.icon || "✨"
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <h4 className="font-medium text-lg text-[#1F1F1F] dark:text-zinc-100">
                              {localizedLabel}
                            </h4>
                            {getAmenityDescription(meta.id, meta.description) ? (
                              <p className="sm:text-base text-sm text-[#727272] dark:text-zinc-400 font-normal leading-5">
                                {getAmenityDescription(meta.id, meta.description)}
                              </p>
                            ) : null}
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
        <div className="w-full max-w-full space-y-6 animate-in fade-in pb-10 font-sans lg:max-w-[calc(100%-75px)]">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <BackButton onClick={() => setActiveSection("description")} />
              <h1>{t("host_acc_features_heading")}</h1>
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
            <p role="alert" className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
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
                    name: t("host_acc_disabled_parking_name"),
                    icon: "♿",
                    desc: t("host_acc_disabled_parking_desc")
                  },
                  {
                    id: "lit_path",
                    name: t("host_acc_lit_path_name"),
                    icon: "💡",
                    desc: t("host_acc_lit_path_desc")
                  },
                  {
                    id: "step_free",
                    name: t("host_acc_step_free_name"),
                    icon: "🪜",
                    desc: t("host_acc_step_free_desc")
                  },
                  {
                    id: "entrance_32",
                    name: t("host_acc_wide_entrance_name"),
                    icon: "↔️",
                    desc: t("host_acc_wide_entrance_desc")
                  },
                  {
                    id: "pool_hoist",
                    name: t("host_acc_pool_hoist_name"),
                    icon: "🏊",
                    desc: t("host_acc_pool_hoist_desc")
                  },
                  {
                    id: "ceiling_hoist",
                    name: t("host_acc_ceiling_hoist_name"),
                    icon: "🏗️",
                    desc: t("host_acc_ceiling_hoist_desc")
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
                        className={`grid overflow-hidden rounded-2xl transition-[grid-template-rows,opacity,padding,transform,border-color] duration-300 ease-in-out ${isCollapsing || isOpening
                          ? "pointer-events-none grid-rows-[0fr] -translate-y-1 border-transparent bg-transparent p-0 opacity-0"
                          : "grid-rows-[1fr] translate-y-0 border border-[#1f1f1f] dark:border-zinc-700 bg-zinc-100/90 dark:bg-zinc-800/90 p-5 opacity-100 shadow-2xs"
                          }`}
                      >
                        <div className="min-h-0 overflow-hidden space-y-4">
                          {/* Top Row: the feature heading and minus button both collapse the card. */}
                          <div
                            onClick={() => collapseAccessibilityFeature(feature.id)}
                            className="flex cursor-pointer items-start justify-between gap-4"
                          >
                            <div className="flex flex-1 items-start gap-3.5">
                              <div className="w-10 h-10 rounded-full border border-[#1f1f1f] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-sm shrink-0 shadow-2xs mt-0.5">
                                {feature.icon}
                              </div>
                              <div className="space-y-1">
                                <h3 className="font-medium text-base text-[#1F1F1F] dark:text-zinc-100">{feature.name}</h3>
                                <p className="text-sm text-[#727272] dark:text-zinc-400 font-normal leading-relaxed max-w-md">
                                  {feature.desc}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                collapseAccessibilityFeature(feature.id);
                              }}
                              className="w-8 h-8 rounded-full border border-[#1f1f1f] dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold shrink-0 shadow-2xs transition-all cursor-pointer"
                            >
                              <Image src="/images/icons/minus-icon.svg" alt={t("host_acc_collapse_alt")} width={12} height={12} className="size-3 object-contain dark:invert" />
                            </button>
                          </div>

                        {/* Examples Gallery Grid */}
                        <div className="space-y-2 pt-1">
                          <span className="text-sm mb-3 font-normal text-[#727272] dark:text-zinc-400">{t("host_acc_examples")}</span>
                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
                            <div className="aspect-[4/4] rounded-xl bg-[#D9D9D9] dark:bg-zinc-700 border border-[#D9D9D9] dark:border-zinc-700 flex items-center justify-center text-[10px] text-[#1f1f1f] dark:text-zinc-200 font-medium">
                              {/* Photo 1 */}
                            </div>
                            <div className="aspect-[4/4] rounded-xl bg-[#D9D9D9] dark:bg-zinc-700 border border-[#D9D9D9] dark:border-zinc-700 flex items-center justify-center text-[10px] text-[#1f1f1f] dark:text-zinc-200 font-medium">
                              {/* Photo 2 */}
                            </div>
                            <div className="aspect-[4/4] rounded-xl bg-[#D9D9D9] dark:bg-zinc-700 border border-[#D9D9D9] dark:border-zinc-700 flex items-center justify-center text-[10px] text-[#1f1f1f] dark:text-zinc-200 font-medium">
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
                              ? "bg-white dark:bg-zinc-900 border border-[#1f1f1f] dark:border-zinc-500"
                              : "bg-transparent border border-[#727272] dark:border-zinc-700 hover:border-[#1f1f1f] dark:hover:border-zinc-500"
                              }`}
                          >
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${!isSelected ? "border-zinc-900 dark:border-zinc-100 bg-[#1f1f1f] dark:bg-zinc-100" : "border-[#727272] dark:border-zinc-600"
                              }`}>
                              {!isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-zinc-950" />}
                            </div>
                            <span className={`${!isSelected ? "font-semibold" : "font-medium"} text-base text-[#1F1F1F] dark:text-zinc-100`}>{t("host_acc_dont_have_feature")}</span>
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
                              ? "bg-white dark:bg-zinc-900 border border-[#1f1f1f] dark:border-zinc-500"
                              : "bg-transparent border border-[#727272] dark:border-zinc-700 hover:border-[#1f1f1f] dark:hover:border-zinc-500"
                              }`}
                          >
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100" : "border-zinc-400 dark:border-zinc-600"
                              }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-zinc-950" />}
                            </div>
                            <span className={`${isSelected ? "font-semibold" : "font-medium"} text-base text-[#1F1F1F] dark:text-zinc-100`}>{t("host_acc_have_feature")}</span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3.5 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <h4 className="text-base font-medium text-[#1F1F1F] dark:text-zinc-100">{t("host_acc_photos_heading")}</h4>
                                <p className="mt-0.5 text-xs text-[#727272] dark:text-zinc-400">{t("host_acc_photos_subtitle")}</p>
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
                                className="rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm font-medium text-[#1f1f1f] dark:text-zinc-100 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60"
                              >
                                {uploadingAccessibilityPhoto && accessibilityPhotoFeatureId === featureId ? t("host_acc_uploading_photo") : t("host_acc_add_photos_btn")}
                              </button>
                            </div>

                            {featurePhotos.length > 0 ? (
                              <div className="grid grid-cols-3 gap-2">
                                {featurePhotos.map((photo) => (
                                  <div key={photo} className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                                    <img src={photo} alt={t("host_acc_photo_evidence_alt", { name: feature.name })} className="h-full w-full object-cover" />
                                    <button
                                      type="button"
                                      aria-label={t("host_acc_remove_photo", { name: feature.name })}
                                      onClick={() => updateAccessibilityDetail(featureId, (detail) => ({ ...detail, photos: detail.photos.filter((item) => item !== photo) }))}
                                      className="absolute right-1 top-1 rounded-full bg-white/95 dark:bg-zinc-900/95 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 dark:border dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">{t("host_acc_photo_required_warning")}</p>
                            )}
                          </div>
                        )}
                        </div>
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
                        <div className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center text-sm shrink-0 shadow-2xs group-hover:border-zinc-300 dark:group-hover:border-zinc-600">
                          {feature.icon}
                        </div>
                        <span className="font-medium text-base text-[#1F1F1F] dark:text-zinc-100 tracking-tight">{feature.name}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => expandAccessibilityFeature(feature.id)}
                        className="w-8 h-8 rounded-full border border-[#1F1F1F] dark:border-zinc-700 bg-[#F3F4F5] dark:bg-zinc-800 flex items-center justify-center text-[#1f1f1f] dark:text-zinc-100 group-hover:bg-[#1f1f1f] dark:group-hover:bg-zinc-700 text-lg font-normal transition-all cursor-pointer group duration-300"
                      >
                        <Image src="/images/icons/add-icon.svg" alt={t("host_acc_add_alt")} width={14} height={14} className="size-3.5 object-contain group-hover:transform-filter group-hover:brightness-0 group-hover:invert dark:invert" />
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
                  className="rounded-full bg-[#FCDF9C] dark:bg-amber-400 hover:bg-[#1F1F1F] dark:hover:bg-amber-300 text-[#1f1f1f] dark:text-zinc-950 hover:text-white dark:hover:text-zinc-950 font-medium text-sm px-8 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300"
                >
                  {uploadingAccessibilityPhoto ? t("host_acc_uploading") : isSaving ? t("host_saving") : t("host_acc_save")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
