"use client";

import React, { useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { CANONICAL_AMENITIES, type CanonicalAmenity } from "@/lib/constants/amenities";
import { AmenityIcon } from "@/components/ui/amenity-icon";
import type { RoomItem } from "./PhotoTourManager";

// ─── Room Type Suggested Amenities Mapping ──────────────────────────────────
export const SUGGESTED_AMENITIES_BY_ROOM_TYPE: Record<string, string[]> = {
  BEDROOM: [
    "air_conditioning",
    "bed_linens",
    "clothing_storage",
    "essentials",
    "extra_pillows_blankets",
    "hangers",
    "heating",
    "iron",
    "room_darkening_shades",
    "safe",
    "tv",
    "workspace",
  ],
  KITCHEN: [
    "refrigerator",
    "freezer",
    "microwave",
    "oven",
    "stove",
    "dishwasher",
    "coffee_maker",
    "kettle",
    "toaster",
    "cooking_basics",
    "dishes_cutlery",
    "dining_table",
    "blender",
    "bbq_utensils",
  ],
  DINING_AREA: [
    "dining_table",
    "dishes_cutlery",
    "bbq_utensils",
    "air_conditioning",
    "heating",
  ],
  BATHROOM: [
    "shower",
    "bathtub",
    "hot_water",
    "hair_dryer",
    "towels",
    "shampoo",
    "conditioner",
    "body_soap",
    "toilet_paper",
    "bidet",
  ],
  HALF_BATHROOM: [
    "hot_water",
    "towels",
    "body_soap",
    "toilet_paper",
    "bidet",
    "hair_dryer",
  ],
  LIVING_ROOM: [
    "tv",
    "smart_tv",
    "sound_system",
    "wifi",
    "indoor_fireplace",
    "air_conditioning",
    "heating",
    "books",
    "board_games",
  ],
  WORKSPACE: [
    "workspace",
    "wifi",
    "smart_tv",
    "sound_system",
    "air_conditioning",
    "heating",
  ],
  ART_STUDIO: [
    "workspace",
    "wifi",
    "sound_system",
    "air_conditioning",
    "heating",
  ],
  GAME_ROOM: [
    "game_console",
    "pool_table",
    "board_games",
    "smart_tv",
    "sound_system",
    "wifi",
    "air_conditioning",
  ],
  GYM: [
    "gym",
    "towels",
    "air_conditioning",
    "sound_system",
    "smart_tv",
  ],
  SWIMMING_POOL: [
    "pool",
    "private_pool",
    "shared_pool",
    "hot_tub",
    "sauna",
  ],
  HOT_TUB: [
    "hot_tub",
    "towels",
  ],
  BALCONY: [
    "outdoor_furniture",
    "outdoor_dining_area",
    "hammock",
  ],
  PATIO: [
    "outdoor_furniture",
    "outdoor_dining_area",
    "bbq_grill",
    "fire_pit",
    "hammock",
  ],
  GARDEN: [
    "outdoor_furniture",
    "outdoor_dining_area",
    "bbq_grill",
    "fire_pit",
  ],
  BACKYARD: [
    "outdoor_furniture",
    "outdoor_dining_area",
    "bbq_grill",
    "fire_pit",
  ],
  LAUNDRY_ROOM: [
    "washer",
    "dryer",
    "iron",
    "drying_rack",
    "cleaning_available",
  ],
};

const DEFAULT_SUGGESTIONS = [
  "air_conditioning",
  "heating",
  "wifi",
  "workspace",
  "tv",
  "essentials",
];

// ─── Room Accessibility Features Catalog ────────────────────────────────────
export interface AccessibilityFeatureConfig {
  id: string;
  name: string;
  desc: string;
  iconType: "step-free" | "wide-door" | "grab-rails" | "roll-in-shower";
}

export const ROOM_ACCESSIBILITY_CATALOG: Record<string, AccessibilityFeatureConfig[]> = {
  BEDROOM: [
    {
      id: "step_free_access",
      name: "Step-free access",
      desc: "There are no steps or stairs to enter or move around this room.",
      iconType: "step-free",
    },
    {
      id: "wide_entrance",
      name: "Entrance wider than 32 inches (81 centimetres)",
      desc: "The doorway or entrance is at least 32 inches (81 cm) wide.",
      iconType: "wide-door",
    },
  ],
  BATHROOM: [
    {
      id: "step_free_access",
      name: "Step-free access",
      desc: "No steps or raised thresholds into the bathroom.",
      iconType: "step-free",
    },
    {
      id: "wide_entrance",
      name: "Entrance wider than 32 inches (81 centimetres)",
      desc: "Doorway is at least 32 inches (81 cm) wide.",
      iconType: "wide-door",
    },
    {
      id: "grab_rails",
      name: "Grab rails in shower or toilet",
      desc: "Grab bars firmly anchored for safety and support.",
      iconType: "grab-rails",
    },
    {
      id: "roll_in_shower",
      name: "Roll-in shower",
      desc: "Shower with level entry and no curb.",
      iconType: "roll-in-shower",
    },
  ],
  DEFAULT: [
    {
      id: "step_free_access",
      name: "Step-free access",
      desc: "There are no steps or stairs to enter or move around this space.",
      iconType: "step-free",
    },
    {
      id: "wide_entrance",
      name: "Entrance wider than 32 inches (81 centimetres)",
      desc: "The doorway or entrance is at least 32 inches (81 cm) wide.",
      iconType: "wide-door",
    },
  ],
};

// ─── SVG Accessibility Line Icons ───────────────────────────────────────────
function AccessibilityLineIcon({ type }: { type: AccessibilityFeatureConfig["iconType"] }) {
  if (type === "step-free") {
    return (
      <svg className="size-6 text-zinc-900 dark:text-zinc-100 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        {/* Step-free ramp with crossed stair symbol */}
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 19h5v-4h5v-4h5V7h3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5l16 14" strokeWidth="1.75" />
      </svg>
    );
  }
  if (type === "wide-door") {
    return (
      <svg className="size-6 text-zinc-900 dark:text-zinc-100 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        {/* Door frame with horizontal width measurement arrows */}
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v16M20 4v16" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M7 9.5l-3 2.5 3 2.5M17 9.5l3 2.5-3 2.5" />
      </svg>
    );
  }
  if (type === "grab-rails") {
    return (
      <svg className="size-6 text-zinc-900 dark:text-zinc-100 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="4" cy="6" r="1.5" fill="currentColor" />
        <circle cx="20" cy="6" r="1.5" fill="currentColor" />
        <circle cx="4" cy="12" r="1.5" fill="currentColor" />
        <circle cx="20" cy="12" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className="size-6 text-zinc-900 dark:text-zinc-100 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 20V9a7 7 0 0 1 14 0H9M4 20h16" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ROOM AMENITIES PANEL
// ─────────────────────────────────────────────────────────────────────────────
export interface RoomAmenitiesPanelProps {
  room: RoomItem;
  selectedAmenityIds: Set<string>;
  onToggleAmenity: (id: string) => void;
  onDone: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function RoomAmenitiesPanel({
  room,
  selectedAmenityIds,
  onToggleAmenity,
  onDone,
  onCancel,
  isSaving,
}: RoomAmenitiesPanelProps) {
  const [filterTab, setFilterTab] = useState<"all" | "suggested">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputId = useId();

  // All non-accessibility amenities sorted alphabetically
  const allAvailableAmenities = useMemo(() => {
    return CANONICAL_AMENITIES
      .filter((a) => a.category !== "accessibility")
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  // Suggested IDs for this specific room type
  const suggestedIds = useMemo(() => {
    const key = (room.type || "").toUpperCase();
    return new Set(SUGGESTED_AMENITIES_BY_ROOM_TYPE[key] || DEFAULT_SUGGESTIONS);
  }, [room.type]);

  // Filtered amenities list based on tab and search
  const visibleAmenities = useMemo(() => {
    let list = allAvailableAmenities;
    if (filterTab === "suggested") {
      list = list.filter((a) => suggestedIds.has(a.id));
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter((a) =>
        a.label.toLowerCase().includes(query) ||
        (a.description && a.description.toLowerCase().includes(query))
      );
    }
    return list;
  }, [allAvailableAmenities, filterTab, suggestedIds, searchQuery]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 animate-in fade-in duration-200">
      {/* Header with Top Action Buttons */}
      <div className="p-6 sm:p-8 pb-4 shrink-0 border-b border-zinc-100 dark:border-zinc-800 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
              Add amenities
            </h2>
            <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 mt-1">
              Let guests know which amenities are in this room or space.
            </p>
          </div>

          {/* Action buttons on top */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="text-xs font-medium text-zinc-800 dark:text-zinc-200 underline hover:text-zinc-950 dark:hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDone}
              disabled={isSaving}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2 text-xs font-medium hover:bg-black dark:hover:bg-white transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 shadow-2xs"
            >
              {isSaving ? (
                <>
                  <svg className="size-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                "Done"
              )}
            </button>
          </div>
        </div>

        {/* Filter Pills and Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-1">
          {/* All / Suggested Pills */}
          <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-zinc-100 dark:bg-zinc-800 self-start">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition cursor-pointer ${
                filterTab === "all"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("suggested")}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition cursor-pointer ${
                filterTab === "suggested"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              Suggested
            </button>
          </div>

          {/* Search Input with Magnifying Glass */}
          <div className="relative flex-1 sm:max-w-xs">
            <label htmlFor={searchInputId} className="sr-only">Search amenities</label>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <input
              id={searchInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search amenities"
              className="w-full rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 pl-9 pr-8 py-1.5 text-xs font-normal text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:border-zinc-900 dark:focus:border-zinc-300 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                title="Clear search"
              >
                <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Amenities Vertical List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-1 custom-scrollbar">
        {visibleAmenities.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              No amenities found
            </p>
            <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
              No matching amenities for &ldquo;{searchQuery}&rdquo;. Try another search term or switch to All.
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="inline-block text-xs font-medium text-zinc-900 dark:text-zinc-100 underline hover:text-black mt-2 cursor-pointer"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          visibleAmenities.map((amenity) => {
            const isChecked = selectedAmenityIds.has(amenity.id);

            return (
              <label
                key={amenity.id}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition cursor-pointer group select-none"
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-4">
                  <div className="size-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0 group-hover:scale-105 transition-transform">
                    <AmenityIcon id={amenity.id} className="size-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {amenity.label}
                    </p>
                    {amenity.description && (
                      <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 truncate max-w-sm">
                        {amenity.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Checkbox Aligned to the Right */}
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggleAmenity(amenity.id)}
                  className="size-5 rounded-md border-zinc-300 dark:border-zinc-600 text-zinc-900 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-zinc-900 shrink-0"
                />
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ROOM PRIVACY PANEL
// ─────────────────────────────────────────────────────────────────────────────
export interface RoomPrivacyPanelProps {
  room: RoomItem;
  hasPrivateBathroom: boolean;
  onTogglePrivateBathroom: () => void;
  hasDoorLock?: boolean;
  onToggleDoorLock?: () => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function RoomPrivacyPanel({
  room,
  hasPrivateBathroom,
  onTogglePrivateBathroom,
  hasDoorLock = false,
  onToggleDoorLock,
  onSave,
  onCancel,
  isSaving,
}: RoomPrivacyPanelProps) {
  const isBedroom = (room.type || "").toUpperCase() === "BEDROOM";
  const title = isBedroom ? "Bedroom privacy" : `${room.name} privacy`;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 animate-in fade-in duration-200">
      {/* Header with Top Action Buttons */}
      <div className="p-6 sm:p-8 pb-4 shrink-0 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 mt-1">
            Manage privacy and access for this room or space.
          </p>
        </div>

        {/* Action buttons on top */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="text-xs font-medium text-zinc-800 dark:text-zinc-200 underline hover:text-zinc-950 dark:hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2 text-xs font-medium hover:bg-black dark:hover:bg-white transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 shadow-2xs"
          >
            {isSaving ? (
              <>
                <svg className="size-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
        {/* For Bedrooms: Private Attached Bathroom */}
        {isBedroom && (
          <div className="flex items-center justify-between gap-6 py-2">
            <div className="space-y-1 max-w-sm">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Private attached bathroom
              </h3>
              <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 leading-relaxed">
                There&apos;s a bathroom attached to the guest&apos;s room that&apos;s just for them.
              </p>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={hasPrivateBathroom}
              onClick={onTogglePrivateBathroom}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                hasPrivateBathroom ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-700"
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block size-6 transform rounded-full bg-white dark:bg-zinc-900 shadow-md ring-0 transition duration-200 ease-in-out ${
                  hasPrivateBathroom ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}

        {/* Bedroom/Space Door Lock */}
        <div className="flex items-center justify-between gap-6 py-2 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="space-y-1 max-w-sm">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Lock on room door
            </h3>
            <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Guests can lock the door to their room or space from the inside and outside for safety and privacy.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={hasDoorLock}
            onClick={onToggleDoorLock}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              hasDoorLock ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-700"
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block size-6 transform rounded-full bg-white dark:bg-zinc-900 shadow-md ring-0 transition duration-200 ease-in-out ${
                hasDoorLock ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ROOM ACCESSIBILITY FEATURES PANEL
// ─────────────────────────────────────────────────────────────────────────────
export interface RoomAccessibilityPanelProps {
  room: RoomItem;
  selectedFeatureIds: Set<string>;
  onToggleFeature: (id: string) => void;
  accessibilityDetails: Array<{ featureId: string; photos: string[] }>;
  onAddPhotoEvidence?: (featureId: string, photoUrl: string) => void;
  onRemovePhotoEvidence?: (featureId: string, photoUrl: string) => void;
  onDone: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function RoomAccessibilityPanel({
  room,
  selectedFeatureIds,
  onToggleFeature,
  accessibilityDetails,
  onAddPhotoEvidence,
  onRemovePhotoEvidence,
  onDone,
  onCancel,
  isSaving,
}: RoomAccessibilityPanelProps) {
  const roomTypeKey = (room.type || "").toUpperCase();
  const catalog = ROOM_ACCESSIBILITY_CATALOG[roomTypeKey] || ROOM_ACCESSIBILITY_CATALOG.DEFAULT;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadFeatureId, setActiveUploadFeatureId] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeUploadFeatureId) return;

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/upload/listing-photo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data?.url && onAddPhotoEvidence) {
        onAddPhotoEvidence(activeUploadFeatureId, data.url);
      }
    } catch {
      // Fallback
    } finally {
      setIsUploadingPhoto(false);
      setActiveUploadFeatureId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 animate-in fade-in duration-200">
      {/* Hidden File Input for Evidence */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Header with Top Action Buttons */}
      <div className="p-6 sm:p-8 pb-4 shrink-0 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
            Accessibility features
          </h2>
          <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 mt-1">
            Select features that make this room accessible to guests.
          </p>
        </div>

        {/* Action buttons on top */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="text-xs font-medium text-zinc-800 dark:text-zinc-200 underline hover:text-zinc-950 dark:hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDone}
            disabled={isSaving}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2 text-xs font-medium hover:bg-black dark:hover:bg-white transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 shadow-2xs"
          >
            {isSaving ? (
              <>
                <svg className="size-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              "Done"
            )}
          </button>
        </div>
      </div>

      {/* Features List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
        {catalog.map((feature) => {
          const isSelected = selectedFeatureIds.has(feature.id);
          const detail = accessibilityDetails.find((d) => d.featureId === feature.id);
          const photos = detail?.photos || [];

          return (
            <div
              key={feature.id}
              className={`rounded-2xl border transition p-4 sm:p-5 ${
                isSelected
                  ? "border-zinc-900/10 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800/40"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="size-10 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-2xs">
                    <AccessibilityLineIcon type={feature.iconType} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {feature.name}
                    </h3>
                    <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-sm">
                      {feature.desc}
                    </p>
                  </div>
                </div>

                {/* Right (+) / Check Control */}
                <button
                  type="button"
                  onClick={() => onToggleFeature(feature.id)}
                  className={`size-8 rounded-full flex items-center justify-center text-sm font-medium transition cursor-pointer shrink-0 ${
                    isSelected
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xs"
                      : "border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-zinc-300"
                  }`}
                  title={isSelected ? "Remove feature" : "Add feature"}
                >
                  {isSelected ? "✓" : "+"}
                </button>
              </div>

              {/* Expandable Supporting Photo Section */}
              {isSelected && (
                <div className="mt-4 pt-4 border-t border-zinc-200/80 dark:border-zinc-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                      Supporting photo (optional)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveUploadFeatureId(feature.id);
                        fileInputRef.current?.click();
                      }}
                      disabled={isUploadingPhoto}
                      className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100 underline hover:text-black dark:hover:text-white cursor-pointer"
                    >
                      {isUploadingPhoto && activeUploadFeatureId === feature.id
                        ? "Uploading..."
                        : "+ Add photo"}
                    </button>
                  </div>

                  {photos.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pt-1">
                      {photos.map((photo) => (
                        <div key={photo} className="relative size-14 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0 group">
                          <img src={photo} alt="" className="size-full object-cover" />
                          <button
                            type="button"
                            onClick={() => onRemovePhotoEvidence?.(feature.id, photo)}
                            className="absolute top-1 right-1 size-4 rounded-full bg-black/70 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition cursor-pointer"
                            title="Remove photo"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ROOM SLEEPING ARRANGEMENTS PANEL
// ─────────────────────────────────────────────────────────────────────────────
const BED_TYPES_LIST = [
  { type: "QUEEN", label: "Queen bed", desc: "60 × 80 in (152 × 203 cm)" },
  { type: "KING", label: "King bed", desc: "76 × 80 in (193 × 203 cm)" },
  { type: "DOUBLE", label: "Double / Full bed", desc: "54 × 75 in (137 × 190 cm)" },
  { type: "SINGLE", label: "Single / Twin bed", desc: "38 × 75 in (97 × 190 cm)" },
  { type: "SOFA_BED", label: "Sofa bed", desc: "Convertible couch" },
];

export interface RoomSleepingPanelProps {
  room: RoomItem;
  beds: Array<{ type: string; count: number }>;
  onChangeBedCount: (bedType: string, delta: number) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function RoomSleepingPanel({
  room,
  beds,
  onChangeBedCount,
  onSave,
  onCancel,
  isSaving,
}: RoomSleepingPanelProps) {
  const bedCountByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of beds) {
      map.set(b.type.toUpperCase(), (map.get(b.type.toUpperCase()) || 0) + b.count);
    }
    return map;
  }, [beds]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 animate-in fade-in duration-200">
      {/* Header with Top Action Buttons */}
      <div className="p-6 sm:p-8 pb-4 shrink-0 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
            Sleeping arrangements
          </h2>
          <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 mt-1">
            Select the beds available in this room.
          </p>
        </div>

        {/* Action buttons on top */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="text-xs font-medium text-zinc-800 dark:text-zinc-200 underline hover:text-zinc-950 dark:hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2 text-xs font-medium hover:bg-black dark:hover:bg-white transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 shadow-2xs"
          >
            {isSaving ? (
              <>
                <svg className="size-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>

      {/* Bed items counters */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 custom-scrollbar">
        {BED_TYPES_LIST.map((b) => {
          const count = bedCountByType.get(b.type) || 0;

          return (
            <div
              key={b.type}
              className="flex items-center justify-between p-3.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition"
            >
              <div>
                <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  {b.label}
                </p>
                <p className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {b.desc}
                </p>
              </div>

              {/* Counter Controls */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onChangeBedCount(b.type, -1)}
                  disabled={count <= 0}
                  className="size-8 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-sm font-medium transition cursor-pointer hover:border-zinc-900 dark:hover:border-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <span className="w-5 text-center text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  {count}
                </span>
                <button
                  type="button"
                  onClick={() => onChangeBedCount(b.type, 1)}
                  className="size-8 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-sm font-medium transition cursor-pointer hover:border-zinc-900 dark:hover:border-zinc-300"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

