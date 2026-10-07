"use client";
/* eslint-disable react-hooks/set-state-in-effect -- async option loaders intentionally reset stale results when dialogs close */

import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { BackButton } from "@/components/ui/back-button";
import { toast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/i18n/language-context";
import type { PlaceSearchResult } from "@/lib/location/places-search";
import {
  searchLocations,
  type StructuredLocation,
} from "@/lib/location/geocoding";
import { getCategoryIcon, getCategoryLabel } from "@/lib/validation/guidebook";
import {
  addGuidebookItemAction,
  createGuidebookAction,
  createGuidebookCategoryAction,
  deleteGuidebookAction,
  deleteGuidebookItemAction,
  getGuidebookByIdAction,
  getGuidebooksAction,
  setGuidebookListingsAction,
  updateGuidebookAction,
  updateGuidebookItemAction,
} from "@/actions/host/guidebooks";

type ItemType = "PLACE" | "NEIGHBORHOOD" | "CITY_ADVICE" | "TIP";
type ModalType =
  | "add-menu"
  | "place-form"
  | "neighborhood-form"
  | "advice-form"
  | "listings"
  | "cover"
  | "delete-item"
  | "delete-guidebook"
  | null;

interface GuidebookItemData {
  id: string;
  type: ItemType;
  title: string;
  category: string;
  categoryLabel?: string | null;
  adviceType?: string | null;
  description?: string | null;
  hostTip?: string | null;
  photo?: string | null;
  photos?: string[];
  placeProviderId?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isFavorite?: boolean;
}

interface ListingOption {
  id: string;
  title: string;
  city?: string | null;
  coverPhoto?: string | null;
  published?: boolean;
  status?: string;
}

interface GuidebookDetailData {
  id: string;
  hostId: string;
  title: string;
  coverImage?: string | null;
  description?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  published: boolean;
  items: GuidebookItemData[];
  listings: ListingOption[];
  eligibleListings: ListingOption[];
  categories: Array<{ id: string; name: string }>;
  host?: { id: string; name: string | null; image: string | null };
}

interface GuidebooksManagerProps {
  listingId: string;
  listingCity?: string;
  listingCountry?: string;
  listingLatitude?: number | null;
  listingLongitude?: number | null;
  setActiveSection: (section: string) => void;
  initialGuidebooks?: GuidebookSummary[];
}

interface GuidebookSummary {
  id: string;
  title: string;
  coverImage?: string | null;
  itemsCount?: number;
  listings?: ListingOption[];
  [key: string]: unknown;
}

function actionError(result: unknown, fallback: string) {
  if (
    result &&
    typeof result === "object" &&
    "error" in result &&
    typeof result.error === "string"
  )
    return result.error;
  return fallback;
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path strokeLinecap="round" d="M5 5l14 14M19 5 5 19" />
    </svg>
  );
}

function AddOptionIcon({
  type,
}: {
  type: "place" | "neighbourhood" | "advice";
}) {
  if (type === "neighbourhood")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="size-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <path
          strokeLinejoin="round"
          d="m3 7 8-3 10 3 8-3v21l-8 3-10-3-8 3V7Z"
        />
        <path d="M11 4v21M21 7v21" />
      </svg>
    );
  if (type === "advice")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="size-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <path d="M11 23h10M12 27h8" />
        <path d="M10.5 21c-2-1.7-3.5-4.3-3.5-7a9 9 0 1 1 18 0c0 2.7-1.3 5.1-3.5 7-.9.8-1.5 1.8-1.5 3h-8c0-1.2-.6-2.2-1.5-3Z" />
        <path d="M16 9v9" />
      </svg>
    );
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="size-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M25 13c0 7-9 15-9 15S7 20 7 13a9 9 0 1 1 18 0Z" />
      <circle cx="16" cy="13" r="3" />
    </svg>
  );
}

function AdviceIcon({ type }: { type: string }) {
  const common = "size-7";
  if (type === "DONT_MISS")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className={common}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16Z" />
        <circle cx="16" cy="16" r="4" />
        <path d="M16 3v3M7 6l2 3M25 6l-2 3" />
      </svg>
    );
  if (type === "BOOK_BEFORE")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className={common}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <rect x="5" y="7" width="22" height="20" rx="2" />
        <path d="M10 4v6M22 4v6M5 13h22" />
      </svg>
    );
  if (type === "WHAT_TO_PACK")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className={common}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M10 10V7a6 6 0 0 1 12 0v3" />
        <rect x="6" y="10" width="20" height="17" rx="2" />
        <path d="M11 10v17M21 10v17" />
      </svg>
    );
  if (type === "USEFUL_PHRASES")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className={common}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M5 7h17a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8l-6 5v-5H5a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Z" />
        <path d="M10 12h8M10 16h6" />
      </svg>
    );
  if (type === "WAYS_TO_SAVE")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className={common}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M5 16c0-6 5-10 12-10 6 0 10 4 10 10 0 5-4 9-10 9H9l-3 3v-6c-1-2-1-4-1-6Z" />
        <path d="M15 10h5M28 13h2v6h-3M11 25v3M22 24v4" />
        <circle cx="12" cy="14" r="1" />
      </svg>
    );
  if (type === "TRAVELLING_WITH_KIDS")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className={common}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="16" cy="12" r="6" />
        <path d="M11 8 8 5M21 8l3-3M10 18c-4 1-6 4-6 8h24c0-4-2-7-6-8M13 13h.1M19 13h.1M13 16c2 1 4 1 6 0" />
      </svg>
    );
  if (type === "CUSTOMS_CULTURE")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className={common}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M7 27V15c0-2 3-2 3 0v4M10 19V9c0-2 3-2 3 0v9M13 18V7c0-2 3-2 3 0v11M16 18v-9c0-2 3-2 3 0v10l3-3c2-2 4 1 2 3l-6 8H7" />
      </svg>
    );
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className={common}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="8" y="4" width="16" height="24" rx="3" />
      <path d="M11 8h10v10H11zM12 23h.1M20 23h.1M11 19h10" />
    </svg>
  );
}

function GuidebookModal({
  title,
  onClose,
  children,
  footer,
  width = "max-w-[570px]",
}: {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <ModalOverlay
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title || "Guidebook dialog"}
        className={`flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-[32px] bg-white shadow-2xl sm:max-h-[92dvh] sm:rounded-[32px] ${width}`}
      >
        <header className="shrink-0 px-6 pb-2 pt-5 sm:px-8 sm:pt-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-ml-2 flex size-10 items-center justify-center rounded-full text-[#1f1f1f] hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <CloseIcon />
          </button>
          {title && (
            <h2 className="mt-5 text-[24px] font-semibold leading-tight text-[#1f1f1f]">
              {title}
            </h2>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-7 pt-4 sm:px-8">
          {children}
        </div>
        {footer && (
          <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-zinc-200 bg-white px-6 py-4 sm:px-8">
            {footer}
          </footer>
        )}
      </section>
    </ModalOverlay>
  );
}

function ModalFooter({
  cancel,
  save,
  disabled,
  saving,
  saveLabel,
}: {
  cancel: () => void;
  save: () => void;
  disabled?: boolean;
  saving?: boolean;
  saveLabel?: string;
}) {
  const { t } = useLanguage();
  return (
    <>
      <button
        type="button"
        onClick={cancel}
        className="text-sm font-medium underline underline-offset-2"
      >
        {t("host_cancel", "Cancel")}
      </button>
      <button
        type="button"
        onClick={save}
        disabled={disabled || saving}
        className="min-w-28 rounded-xl bg-[#222] px-7 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
      >
        {saving ? t("host_guidebook_saving", "Saving…") : (saveLabel || t("host_guidebooks_save", "Save"))}
      </button>
    </>
  );
}

function CategoryCards({
  categories,
  selected,
  onSelect,
}: {
  categories: Array<{ id: string; label: string }>;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          role="radio"
          aria-checked={selected === category.id}
          onClick={() => onSelect(category.id)}
          className="flex min-h-18 w-full items-center justify-between rounded-2xl border border-zinc-200 px-6 py-4 text-left transition hover:border-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span className="font-semibold text-[#1f1f1f]">{category.label}</span>
          <span
            className={`size-6 rounded-full border ${selected === category.id ? "border-[7px] border-[#222]" : "border-zinc-400"}`}
          />
        </button>
      ))}
    </div>
  );
}

function PhotoUploader({
  photos,
  setPhotos,
  upload,
  uploading,
  single = false,
}: {
  photos: string[];
  setPhotos: (photos: string[]) => void;
  upload: (files: File[]) => Promise<void>;
  uploading: boolean;
  single?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <div
          className={`grid gap-3 ${single ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}
        >
          {photos.map((photo, index) => (
            <div
              key={photo}
              className={`relative overflow-hidden rounded-xl bg-zinc-100 ${single ? "h-56" : "aspect-square"}`}
            >
              <Image
                src={photo}
                alt={`Uploaded photo ${index + 1}`}
                fill
                sizes={single ? "520px" : "160px"}
                unoptimized
                className="object-cover"
              />
              <button
                type="button"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() =>
                  setPhotos(photos.filter((item) => item !== photo))
                }
                className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/70 text-white"
              >
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length < (single ? 1 : 8) && (
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-zinc-100 px-4 text-sm font-medium hover:bg-zinc-200">
          {uploading
            ? t("host_guidebook_uploading", "Uploading…")
            : photos.length
              ? t("host_guidebook_add_more_photos", "Add more photos")
              : t("host_guidebook_add_photos", "Add photos")}
          <input
            type="file"
            multiple={!single}
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={uploading}
            className="sr-only"
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              event.target.value = "";
              if (files.length) void upload(files);
            }}
          />
        </label>
      )}
    </div>
  );
}

function GuidebookRecommendationForm({
  kind,
  title,
  setTitle,
  recommendation,
  setRecommendation,
  category,
  setCategory,
  photos,
  setPhotos,
  categories,
  uploading,
  uploadPhotos,
  saving,
  onCreateCategory,
  onCancel,
  onSave,
}: {
  kind: "place" | "neighbourhood";
  title: string;
  setTitle: (value: string) => void;
  recommendation: string;
  setRecommendation: (value: string) => void;
  category: string;
  setCategory: (id: string, label: string) => void;
  photos: string[];
  setPhotos: (photos: string[]) => void;
  categories: Array<{ id: string; label: string }>;
  uploading: boolean;
  uploadPhotos: (files: File[]) => Promise<void>;
  saving: boolean;
  onCreateCategory: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const isPlace = kind === "place";
  const { t } = useLanguage();
  return (
    <GuidebookModal
      onClose={onCancel}
      footer={
        <ModalFooter
          cancel={onCancel}
          save={onSave}
          saving={saving}
          disabled={!title.trim() || !recommendation.trim() || !category}
        />
      }
    >
      <div className="space-y-7">
        <div className="flex items-start gap-4">
          <div className="relative flex size-[104px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 border border-zinc-200/70 text-3xl">
            {photos[0] ? (
              <Image
                src={photos[0]}
                alt=""
                fill
                sizes="104px"
                unoptimized
                className="object-cover"
              />
            ) : isPlace ? (
              <span className="text-3xl text-zinc-600">📍</span>
            ) : (
              <span className="text-3xl text-zinc-600">🗺️</span>
            )}
            {photos[0] && (
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setPhotos([])}
                className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black"
              >
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#717171]">
              {isPlace ? t("host_guidebook_poi_label", "Point of interest") : t("host_guidebook_neighbourhood_label", "Neighbourhood")}
            </p>
            <input
              autoFocus={!title}
              value={title}
              maxLength={150}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-0.5 w-full border-0 border-b border-transparent py-0.5 text-xl sm:text-2xl font-semibold text-[#222] outline-none placeholder:text-zinc-400 focus:border-zinc-400"
              placeholder={isPlace ? t("host_guidebook_place_name_ph", "Place name") : t("host_guidebook_neighbourhood_name_ph", "Neighbourhood name")}
            />
            <div className="mt-3">
              <label className="inline-flex cursor-pointer items-center rounded-full border border-zinc-900 bg-white px-4 py-1.5 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-50">
                {uploading
                  ? t("host_guidebook_uploading", "Uploading…")
                  : photos.length > 0
                    ? t("host_guidebook_change_photo", "Change photo")
                    : t("host_guidebook_add_photos", "Add photos")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  disabled={uploading}
                  className="sr-only"
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    event.target.value = "";
                    if (files.length) void uploadPhotos(files);
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <div>
          <label className="block">
            <span className="mb-2 block text-base sm:text-lg font-semibold text-[#222]">
              {isPlace ? t("host_guidebook_why_recommend_place", "Why do you recommend this place?") : t("host_guidebook_why_recommend_neighbourhood", "Why do you recommend this neighbourhood?")}
            </span>
            <textarea
              rows={4}
              maxLength={1200}
              value={recommendation}
              onChange={(event) => setRecommendation(event.target.value)}
              className="w-full rounded-2xl border border-zinc-300 p-4 text-sm text-[#222] placeholder:text-[#717171] outline-none transition focus:border-black"
              placeholder={
                isPlace
                  ? t("host_guidebook_tip_placeholder", "Write a tip that will help travellers get the most out of their visit.")
                  : t("host_guidebook_area_tip_placeholder", "Share what travellers should know about this area.")
              }
            />
          </label>
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-semibold text-[#222]">
            {isPlace ? t("host_guidebook_categorise_place", "Categorise this place (Required)") : t("host_guidebook_categorise_neighbourhood", "Categorise this neighbourhood (Required)")}
          </h3>
          <p className="mb-3.5 mt-1 text-sm text-[#717171]">
            {t("host_guidebook_categorise_desc", "Organise your recommendations by theme to help travellers find what they're looking for.")}
          </p>
          <CategoryCards
            categories={categories}
            selected={category}
            onSelect={(id) =>
              setCategory(
                id,
                categories.find((item) => item.id === id)?.label || "",
              )
            }
          />
          <button
            type="button"
            onClick={onCreateCategory}
            className="mt-4 text-sm font-semibold underline underline-offset-2 text-[#222] hover:text-black"
          >
            ✎ {t("host_guidebook_create_category", "Create a category")}
          </button>
        </div>
      </div>
    </GuidebookModal>
  );
}

export function GuidebooksManager({
  listingId,
  listingCity,
  listingCountry,
  listingLatitude,
  listingLongitude,
  setActiveSection,
  initialGuidebooks,
}: GuidebooksManagerProps) {
  const { t } = useLanguage();
  const [view, setView] = useState<"list" | "create" | "editor">("list");
  const [guidebooks, setGuidebooks] = useState<GuidebookSummary[]>(
    initialGuidebooks || [],
  );
  const [guidebook, setGuidebook] = useState<GuidebookDetailData | null>(null);
  const [loading, setLoading] = useState(initialGuidebooks === undefined);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const [editingItem, setEditingItem] = useState<GuidebookItemData | null>(
    null,
  );
  const [deleteItem, setDeleteItem] = useState<GuidebookItemData | null>(null);
  const [guidebookToDelete, setGuidebookToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createLocation, setCreateLocation] = useState(listingCity || "");
  const [createLocationDetails, setCreateLocationDetails] =
    useState<StructuredLocation | null>(null);
  const [locationResults, setLocationResults] = useState<StructuredLocation[]>(
    [],
  );
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(
    null,
  );
  const [formTitle, setFormTitle] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formText, setFormText] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formCategoryLabel, setFormCategoryLabel] = useState("");
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [adviceType, setAdviceType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [listingSelection, setListingSelection] = useState<string[]>([]);
  const [coverDraft, setCoverDraft] = useState<string[]>([]);

  const loadGuidebooks = async () => {
    setLoading(true);
    const result = await getGuidebooksAction();
    if (result.ok && Array.isArray(result.data))
      setGuidebooks(result.data as GuidebookSummary[]);
    else toast.error(actionError(result, "Could not load guidebooks."));
    setLoading(false);
  };

  useEffect(() => {
    if (initialGuidebooks === undefined) void loadGuidebooks();
  }, [initialGuidebooks]);

  useEffect(() => {
    if (
      view !== "create" ||
      createLocation.trim().length < 2 ||
      createLocationDetails?.formattedAddress === createLocation
    ) {
      setLocationResults([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      const results = await searchLocations(createLocation).catch(() => []);
      if (active) setLocationResults(results);
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [createLocation, createLocationDetails, view]);

  const openGuidebook = async (id: string) => {
    setLoading(true);
    const result = await getGuidebookByIdAction(id);
    if (result.ok && result.data) {
      setGuidebook(result.data as GuidebookDetailData);
      setView("editor");
    } else toast.error(actionError(result, "Could not open this guidebook."));
    setLoading(false);
  };

  const closeModal = () => {
    if (categoryDialog) {
      setCategoryDialog(false);
      return;
    }
    if (!saving && !uploading) setModal(null);
  };
  const resetForm = () => {
    setEditingItem(null);
    setSelectedPlace(null);
    setFormTitle("");
    setFormAddress("");
    setFormText("");
    setFormCategory("");
    setFormCategoryLabel("");
    setFormPhotos([]);
    setAdviceType("");
  };
  const openAddMenu = () => {
    resetForm();
    setModal("add-menu");
  };

  const openItemForEdit = (item: GuidebookItemData) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormAddress(item.address || "");
    setFormText(item.description || "");
    setFormCategory(item.category);
    setFormCategoryLabel(item.categoryLabel || getCategoryLabel(item.category));
    setFormPhotos(
      item.photos?.length ? item.photos : item.photo ? [item.photo] : [],
    );
    setAdviceType(item.adviceType || item.category);
    if (item.type === "PLACE") {
      setSelectedPlace({
        id: item.placeProviderId || item.id,
        name: item.title,
        address: item.address || "",
        category: item.category as PlaceSearchResult["category"],
        latitude: item.latitude || 0,
        longitude: item.longitude || 0,
        placeProviderId: item.placeProviderId || item.id,
      });
      setModal("place-form");
    } else if (item.type === "NEIGHBORHOOD") setModal("neighborhood-form");
    else setModal("advice-form");
  };

  const uploadPhotos = async (
    files: File[],
    target: "item" | "cover" = "item",
  ) => {
    if (!guidebook) {
      toast.error("Open a guidebook before uploading photos.");
      return;
    }
    const current = target === "cover" ? coverDraft : formPhotos;
    const seenFiles = new Set<string>();
    const accepted = files
      .filter((file) => {
        const signature = `${file.name}:${file.size}:${file.lastModified}`;
        if (seenFiles.has(signature)) return false;
        seenFiles.add(signature);
        if (
          !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
            file.type,
          )
        ) {
          toast.error(`${file.name}: unsupported image type.`);
          return false;
        }
        if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}: image must be under 10 MB.`);
          return false;
        }
        return true;
      })
      .slice(0, Math.max(0, (target === "cover" ? 1 : 8) - current.length));
    if (!accepted.length) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of accepted) {
      const body = new FormData();
      body.append("file", file);
      body.append("guidebookId", guidebook.id);
      try {
        const response = await fetch("/api/v1/upload/guidebook-photo", {
          method: "POST",
          body,
        });
        const data = await response.json();
        if (!response.ok || !data.url)
          throw new Error(data.error || "Upload failed.");
        if (!current.includes(data.url) && !uploaded.includes(data.url))
          uploaded.push(data.url);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : `Could not upload ${file.name}.`,
        );
      }
    }
    if (target === "cover") setCoverDraft([...current, ...uploaded].slice(-1));
    else setFormPhotos([...current, ...uploaded]);
    setUploading(false);
  };

  const referenceCategories = useMemo(
    () => [
      { id: "FOOD_AND_DRINK", label: t("host_guidebook_cat_food_scene", "Food scene") },
      { id: "SIGHTSEEING", label: t("host_guidebook_cat_sightseeing", "Sightseeing") },
    ],
    [t],
  );

  const categoryOptions = useMemo(
    () => [
      ...referenceCategories,
      ...(guidebook?.categories || []).map((category) => ({
        id: `CUSTOM:${category.id}`,
        label: category.name,
      })),
    ],
    [referenceCategories, guidebook?.categories],
  );

  const adviceTypes = useMemo(
    () => [
      { id: "GETTING_AROUND", label: t("host_guidebook_advice_getting_around", "Getting around") },
      { id: "DONT_MISS", label: t("host_guidebook_advice_dont_miss", "Don't miss") },
      { id: "CUSTOMS_CULTURE", label: t("host_guidebook_advice_customs_culture", "Customs and culture") },
      { id: "WAYS_TO_SAVE", label: t("host_guidebook_advice_ways_to_save", "Ways to save") },
      { id: "BOOK_BEFORE", label: t("host_guidebook_advice_book_before", "Book before you go") },
      { id: "WHAT_TO_PACK", label: t("host_guidebook_advice_what_to_pack", "What to pack") },
      { id: "USEFUL_PHRASES", label: t("host_guidebook_advice_useful_phrases", "Useful phrases") },
      { id: "TRAVELLING_WITH_KIDS", label: t("host_guidebook_advice_with_kids", "Travelling with kids") },
    ],
    [t],
  );

  const saveCustomCategory = async () => {
    if (!guidebook || newCategory.trim().length < 2) return;
    setSaving(true);
    const result = await createGuidebookCategoryAction(guidebook.id, {
      name: newCategory,
    });
    if (result.ok && result.data) {
      const category = result.data as { id: string; name: string };
      setGuidebook((current) =>
        current
          ? { ...current, categories: [...current.categories, category] }
          : current,
      );
      setFormCategory(`CUSTOM:${category.id}`);
      setFormCategoryLabel(category.name);
      setNewCategory("");
      setCategoryDialog(false);
    } else toast.error(actionError(result, "Could not create category."));
    setSaving(false);
  };

  const saveItem = async (type: "PLACE" | "NEIGHBORHOOD" | "CITY_ADVICE") => {
    if (!guidebook) return;
    const payload = {
      type,
      title: formTitle.trim(),
      category: type === "CITY_ADVICE" ? adviceType : formCategory,
      categoryLabel:
        type === "CITY_ADVICE"
          ? adviceTypes.find((item) => item.id === adviceType)?.label
          : formCategoryLabel || getCategoryLabel(formCategory),
      adviceType: type === "CITY_ADVICE" ? adviceType : null,
      description: formText.trim(),
      photo: formPhotos[0] || null,
      photos: formPhotos,
      address:
        type === "PLACE"
          ? selectedPlace?.address || null
          : formAddress.trim() || null,
      latitude: type === "PLACE" ? selectedPlace?.latitude : null,
      longitude: type === "PLACE" ? selectedPlace?.longitude : null,
      placeProviderId: type === "PLACE" ? selectedPlace?.placeProviderId : null,
    };
    setSaving(true);
    const result = editingItem
      ? await updateGuidebookItemAction(guidebook.id, editingItem.id, payload)
      : await addGuidebookItemAction(guidebook.id, payload);
    if (result.ok && result.data) {
      const saved = result.data as GuidebookItemData;
      saved.photos = saved.photos || formPhotos;
      setGuidebook((current) =>
        current
          ? {
              ...current,
              items: editingItem
                ? current.items.map((item) =>
                    item.id === editingItem.id ? saved : item,
                  )
                : [...current.items, saved],
            }
          : current,
      );
      setModal(null);
      resetForm();
      toast.success(
        editingItem ? "Recommendation updated." : "Recommendation added.",
      );
    } else
      toast.error(actionError(result, "Could not save this recommendation."));
    setSaving(false);
  };

  const saveListings = async () => {
    if (!guidebook) return;
    setSaving(true);
    const result = await setGuidebookListingsAction(guidebook.id, {
      listingIds: listingSelection,
    });
    if (result.ok) {
      setGuidebook({
        ...guidebook,
        listings: guidebook.eligibleListings.filter((listing) =>
          listingSelection.includes(listing.id),
        ),
      });
      setModal(null);
      toast.success("Listings updated.");
    } else toast.error(actionError(result, "Could not update listings."));
    setSaving(false);
  };

  const saveCover = async () => {
    if (!guidebook) return;
    setSaving(true);
    const coverImage = coverDraft[0] || null;
    const result = await updateGuidebookAction(guidebook.id, { coverImage });
    if (result.ok) {
      setGuidebook({ ...guidebook, coverImage });
      setModal(null);
      toast.success("Cover updated.");
    } else toast.error(actionError(result, "Could not update the cover."));
    setSaving(false);
  };

  const confirmDeleteItem = async () => {
    if (!guidebook || !deleteItem) return;
    setSaving(true);
    const result = await deleteGuidebookItemAction(guidebook.id, deleteItem.id);
    if (result.ok) {
      setGuidebook({
        ...guidebook,
        items: guidebook.items.filter((item) => item.id !== deleteItem.id),
      });
      setDeleteItem(null);
      setModal(null);
      toast.success("Recommendation removed.");
    } else
      toast.error(actionError(result, "Could not remove this recommendation."));
    setSaving(false);
  };

  const confirmDeleteGuidebook = async () => {
    if (!guidebookToDelete) return;
    setSaving(true);
    const result = await deleteGuidebookAction(guidebookToDelete.id);
    if (result.ok) {
      setGuidebooks((current) =>
        current.filter((item) => item.id !== guidebookToDelete.id),
      );
      if (guidebook?.id === guidebookToDelete.id) {
        setGuidebook(null);
        setView("list");
      }
      setGuidebookToDelete(null);
      setModal(null);
      toast.success("Guidebook deleted.");
    } else {
      toast.error(actionError(result, "Could not delete this guidebook."));
    }
    setSaving(false);
  };

  const createGuidebook = async (event: React.FormEvent) => {
    event.preventDefault();
    if (createTitle.trim().length < 2) return;
    setSaving(true);
    const result = await createGuidebookAction({
      title: createTitle,
      city: createLocationDetails?.city || createLocation || listingCity,
      country: createLocationDetails?.country || listingCountry,
      latitude: createLocationDetails?.latitude ?? listingLatitude,
      longitude: createLocationDetails?.longitude ?? listingLongitude,
      formattedAddress:
        createLocationDetails?.formattedAddress || createLocation,
      listingIds: [listingId],
      published: true,
    });
    if (result.ok && result.data) {
      await openGuidebook((result.data as { id: string }).id);
      setCreateTitle("");
    } else toast.error(actionError(result, "Could not create the guidebook."));
    setSaving(false);
  };

  const groupedItems = useMemo(
    () => ({
      PLACE: guidebook?.items.filter((item) => item.type === "PLACE") || [],
      NEIGHBORHOOD:
        guidebook?.items.filter((item) => item.type === "NEIGHBORHOOD") || [],
      CITY_ADVICE:
        guidebook?.items.filter(
          (item) => item.type === "CITY_ADVICE" || item.type === "TIP",
        ) || [],
    }),
    [guidebook?.items],
  );
  return (
    <div className="pb-16">
      {view === "list" && (
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-5">
              <BackButton onClick={() => setActiveSection("arrival-guide")} />
              <div>
                <h1 className="text-3xl font-semibold">{t("host_guidebooks_title", "Guidebooks")}</h1>
                <p className="mt-2 text-[#727272]">
                  {t("host_guidebooks_subtext", "Share your favorite places and local tips with guests.")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setView("create")}
              className="rounded-full bg-[#FCDF9C] px-5 py-3 text-sm font-semibold hover:bg-[#222] hover:text-white"
            >
              {t("host_guidebooks_create_title", "Create a guidebook")}
            </button>
          </div>
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="h-64 animate-pulse rounded-3xl bg-zinc-100"
                />
              ))}
            </div>
          ) : guidebooks.length === 0 ? (
            <div className="mx-auto max-w-xl rounded-3xl border border-zinc-200 bg-white px-8 py-14 text-center">
              <div className="text-4xl">📖</div>
              <h2 className="mt-4 text-2xl font-semibold">
                {t("host_guidebooks_create_title", "Create a guidebook")}
              </h2>
              <p className="mt-2 text-[#727272]">
                {t("host_guidebooks_create_desc", "Create a guidebook to easily share local tips with guests.")}
              </p>
              <button
                type="button"
                onClick={() => setView("create")}
                className="mt-6 rounded-xl bg-[#222] px-6 py-3 text-sm font-semibold text-white"
              >
                {t("host_guidebooks_create_title", "Create a guidebook")}
              </button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {guidebooks.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="relative h-44 bg-[#FCDF9C]">
                    {item.coverImage ? (
                      <Image
                        src={item.coverImage}
                        alt=""
                        fill
                        sizes="500px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-5xl">
                        📍
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h2 className="text-xl font-semibold">{item.title}</h2>
                    <p className="mt-1 text-sm text-[#727272]">
                      {t("host_guidebooks_recs_count", "{count} recommendations").replace("{count}", String(item.itemsCount || 0))} ·{" "}
                      {item.listings?.length || 0} listings
                    </p>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => void openGuidebook(item.id)}
                        className="rounded-xl bg-[#222] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGuidebookToDelete({
                            id: item.id,
                            title: item.title,
                          });
                          setModal("delete-guidebook");
                        }}
                        className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "create" && (
        <div className="mx-auto max-w-2xl">
          <div className="mb-7 flex items-start gap-5">
            <BackButton onClick={() => setView("list")} />
            <div>
              <h1 className="text-3xl font-semibold">{t("host_guidebooks_create_title", "Create a guidebook")}</h1>
              <p className="mt-2 text-[#727272]">
                {t("host_guidebook_create_intro", "Start with a title and location. You can add recommendations next.")}
              </p>
            </div>
          </div>
          <form
            onSubmit={createGuidebook}
            className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-7"
          >
            <label className="block">
              <span className="mb-2 block font-semibold">{t("host_guidebook_title_label", "Guidebook title")}</span>
              <input
                required
                minLength={2}
                maxLength={100}
                value={createTitle}
                onChange={(event) => setCreateTitle(event.target.value)}
                className="w-full rounded-xl border border-zinc-400 px-4 py-3 outline-none focus:border-black"
                placeholder={t("host_guidebook_create_title_ph", "e.g. Shihab's guide to Mumbai")}
              />
            </label>
            <label className="relative block">
              <span className="mb-2 block font-semibold">{t("host_guidebook_primary_location", "Primary location")}</span>
              <input
                value={createLocation}
                onChange={(event) => {
                  setCreateLocation(event.target.value);
                  setCreateLocationDetails(null);
                }}
                className="w-full rounded-xl border border-zinc-400 px-4 py-3 outline-none focus:border-black"
                placeholder={t("host_guidebook_city_or_neighbourhood", "City or neighbourhood")}
              />
              {locationResults.length > 0 && (
                <div className="absolute z-20 mt-2 max-h-52 w-full overflow-auto rounded-xl border bg-white p-2 shadow-xl">
                  {locationResults.map((location) => (
                    <button
                      key={`${location.latitude}-${location.longitude}`}
                      type="button"
                      onClick={() => {
                        setCreateLocation(location.formattedAddress);
                        setCreateLocationDetails(location);
                        setLocationResults([]);
                      }}
                      className="block w-full rounded-lg p-3 text-left hover:bg-zinc-100"
                    >
                      <strong>{location.locationName}</strong>
                      <span className="block text-xs text-[#727272]">
                        {location.formattedAddress}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setView("list")}
                className="px-5 py-3 text-sm font-semibold underline"
              >
                {t("host_cancel", "Cancel")}
              </button>
              <button
                disabled={saving || createTitle.trim().length < 2}
                className="rounded-xl bg-[#222] px-6 py-3 text-sm font-semibold text-white disabled:bg-zinc-200"
              >
                {saving ? t("host_guidebook_creating", "Creating…") : t("host_create_guidebook", "Create guidebook")}
              </button>
            </div>
          </form>
        </div>
      )}

      {view === "editor" && guidebook && (
        <div className="mx-auto max-w-6xl space-y-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-start gap-5">
              <BackButton
                onClick={() => {
                  setView("list");
                  void loadGuidebooks();
                }}
              />
              <div>
                <p className="text-sm uppercase tracking-wide text-[#727272]">
                  {t("host_guidebook_badge", "Host guidebook")}
                </p>
                <h1 className="mt-1 text-3xl font-semibold">
                  {guidebook.host?.name
                    ? t("host_guidebook_host_heading", "{name}’s guidebook").replace("{name}", guidebook.host.name)
                    : guidebook.title}
                </h1>
                <p className="mt-2 text-sm text-[#727272]">
                  {guidebook.title} · {t("host_guidebooks_recs_count", "{count} recommendations").replace("{count}", String(guidebook.items.length))}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setListingSelection(
                    guidebook.listings.map((item) => item.id),
                  );
                  setModal("listings");
                }}
                className="rounded-full border border-zinc-400 px-5 py-2.5 text-sm font-medium hover:border-black"
              >
                {t("host_guidebook_choose_listings", "Choose listings")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCoverDraft(
                    guidebook.coverImage ? [guidebook.coverImage] : [],
                  );
                  setModal("cover");
                }}
                className="rounded-full border border-zinc-400 px-5 py-2.5 text-sm font-medium hover:border-black"
              >
                {t("host_guidebook_edit_cover", "Edit cover")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGuidebookToDelete({
                    id: guidebook.id,
                    title: guidebook.title,
                  });
                  setModal("delete-guidebook");
                }}
                className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-rose-600 hover:border-rose-300 hover:bg-rose-50"
              >
                {t("host_delete_guidebook", "Delete guidebook")}
              </button>
            </div>
          </div>
          {guidebook.coverImage && (
            <div className="relative h-48 overflow-hidden rounded-3xl sm:h-64">
              <Image
                src={guidebook.coverImage}
                alt="Guidebook cover"
                fill
                sizes="1100px"
                unoptimized
                className="object-cover"
              />
            </div>
          )}
          {guidebook.items.length === 0 ? (
            <div className="rounded-3xl border border-zinc-300 bg-white px-7 py-14 text-center">
              <div className="text-4xl">🗺️</div>
              <h2 className="mt-5 text-2xl font-medium">
                {t("host_guidebook_share_recs_title", "Share your recommendations")}
              </h2>
              <p className="mt-2 text-[#727272]">
                {t("host_guidebook_share_recs_desc", "Suggest places to visit, where to eat and more.")}
              </p>
              <button
                type="button"
                onClick={openAddMenu}
                className="mt-7 rounded-xl bg-[#222] px-7 py-3 text-sm font-semibold text-white"
              >
                {t("host_guidebook_add_to_guidebook", "Add to guidebook")}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">{t("host_guidebook_recommendations_heading", "Recommendations")}</h2>
                <button
                  type="button"
                  onClick={openAddMenu}
                  className="rounded-xl bg-[#222] px-6 py-3 text-sm font-semibold text-white"
                >
                  {t("host_guidebook_add_to_guidebook", "Add to guidebook")}
                </button>
              </div>
              {(["PLACE", "NEIGHBORHOOD", "CITY_ADVICE"] as const).map(
                (group) =>
                  groupedItems[group].length > 0 && (
                    <section key={group} className="space-y-4">
                      <h3 className="text-xl font-semibold">
                        {group === "PLACE"
                          ? t("host_guidebook_group_places", "Places")
                          : group === "NEIGHBORHOOD"
                            ? t("host_guidebook_group_neighbourhoods", "Neighbourhoods")
                            : t("host_guidebook_group_city_advice", "City advice")}
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {groupedItems[group].map((item) => (
                          <article
                            key={item.id}
                            className="flex min-h-40 gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
                          >
                            <div className="relative size-28 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                              {item.photo ? (
                                <Image
                                  src={item.photo}
                                  alt=""
                                  fill
                                  sizes="112px"
                                  unoptimized
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-3xl">
                                  {group === "CITY_ADVICE" ? (
                                    <AdviceIcon
                                      type={item.adviceType || item.category}
                                    />
                                  ) : (
                                    getCategoryIcon(item.category)
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium uppercase tracking-wide text-[#727272]">
                                {item.categoryLabel ||
                                  getCategoryLabel(item.category)}
                              </p>
                              <h4 className="mt-1 truncate text-lg font-semibold">
                                {item.title}
                              </h4>
                              <p className="mt-2 line-clamp-2 text-sm text-[#727272]">
                                {item.description}
                              </p>
                              <div className="mt-4 flex gap-4 text-sm font-medium">
                                <button
                                  type="button"
                                  onClick={() => openItemForEdit(item)}
                                  className="underline"
                                >
                                  {t("host_guidebook_edit_action", "Edit")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteItem(item);
                                    setModal("delete-item");
                                  }}
                                  className="text-red-600 underline"
                                >
                                  {t("host_guidebook_remove_action", "Remove")}
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ),
              )}
            </>
          )}
        </div>
      )}

      {modal === "add-menu" && (
        <GuidebookModal title={t("host_guidebook_modal_add_title", "What do you want to add?")} onClose={closeModal}>
          <div className="space-y-4">
            {[
              {
                title: t("host_guidebook_opt_places", "Places"),
                subtitle: t("host_guidebook_opt_places_desc", "Where should travellers go?"),
                icon: "place" as const,
                action: () => {
                  setModal("place-form");
                },
              },
              {
                title: t("host_guidebook_opt_neighbourhoods", "Neighbourhoods"),
                subtitle: t("host_guidebook_opt_neighbourhoods_desc", "What are the areas like?"),
                icon: "neighbourhood" as const,
                action: () => {
                  setModal("neighborhood-form");
                },
              },
              {
                title: t("host_guidebook_opt_city_advice", "City advice"),
                subtitle: t("host_guidebook_opt_city_advice_desc", "What should travellers know?"),
                icon: "advice" as const,
                action: () => setModal("advice-form"),
              },
            ].map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={item.action}
                className="flex min-h-24 w-full items-center justify-between rounded-2xl border border-zinc-200 px-6 text-left transition hover:border-black focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span>
                  <strong className="block">{item.title}</strong>
                  <span className="mt-1 block text-sm text-[#727272]">
                    {item.subtitle}
                  </span>
                </span>
                <AddOptionIcon type={item.icon} />
              </button>
            ))}
          </div>
        </GuidebookModal>
      )}

      {(modal === "place-form" || modal === "neighborhood-form") && (
        <GuidebookRecommendationForm
          kind={modal === "place-form" ? "place" : "neighbourhood"}
          title={formTitle}
          setTitle={setFormTitle}
          recommendation={formText}
          setRecommendation={setFormText}
          category={formCategory}
          setCategory={(id, label) => {
            setFormCategory(id);
            setFormCategoryLabel(label);
          }}
          photos={formPhotos}
          setPhotos={setFormPhotos}
          categories={categoryOptions}
          uploading={uploading}
          uploadPhotos={(files) => uploadPhotos(files)}
          saving={saving}
          onCreateCategory={() => setCategoryDialog(true)}
          onCancel={closeModal}
          onSave={() =>
            void saveItem(modal === "place-form" ? "PLACE" : "NEIGHBORHOOD")
          }
        />
      )}

      {modal === "advice-form" && (
        <GuidebookModal
          title={t("host_guidebook_advice_modal_title", "What's your advice about?")}
          onClose={closeModal}
          footer={
            <ModalFooter
              cancel={closeModal}
              save={() => void saveItem("CITY_ADVICE")}
              saving={saving}
              disabled={!adviceType || !formTitle.trim() || !formText.trim()}
            />
          }
        >
          <div className="grid grid-cols-4 gap-x-3 gap-y-7">
            {adviceTypes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAdviceType(item.id)}
                className="flex flex-col items-center gap-2 text-center text-xs sm:text-sm"
              >
                <span
                  className={`flex size-16 items-center justify-center rounded-full border text-2xl transition ${adviceType === item.id ? "border-[#222] bg-[#222] text-white" : "border-zinc-300 bg-white"}`}
                >
                  <AdviceIcon type={item.id} />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-8 space-y-6">
            <label className="block">
              <span className="mb-2 block text-base sm:text-lg font-semibold text-[#222]">
                {t("host_guidebook_advice_title_label", "Advice title")}
              </span>
              <input
                value={formTitle}
                maxLength={150}
                onChange={(event) => setFormTitle(event.target.value)}
                className="w-full rounded-2xl border border-zinc-300 px-4 py-3.5 text-sm text-[#222] placeholder:text-[#717171] outline-none transition focus:border-black"
                placeholder={t("host_guidebook_advice_title_ph", "E.g.: The underground is the fastest way to get around")}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-base sm:text-lg font-semibold text-[#222]">
                {t("host_guidebook_your_advice_label", "Your advice")}
              </span>
              <textarea
                rows={5}
                maxLength={1200}
                value={formText}
                onChange={(event) => setFormText(event.target.value)}
                className="w-full rounded-2xl border border-zinc-300 p-4 text-sm text-[#222] placeholder:text-[#717171] outline-none transition focus:border-black resize-y"
                placeholder={t("host_guidebook_advice_text_ph", "Write a tip that will help travellers get the most out of their visit.")}
              />
            </label>
          </div>
        </GuidebookModal>
      )}

      {categoryDialog && (
        <GuidebookModal
          title={t("host_guidebook_create_cat_title", "Create a category")}
          onClose={() => setCategoryDialog(false)}
          width="max-w-md"
          footer={
            <ModalFooter
              cancel={() => setCategoryDialog(false)}
              save={() => void saveCustomCategory()}
              saving={saving}
              disabled={newCategory.trim().length < 2}
            />
          }
        >
          <label className="block">
            <span className="mb-2 block text-base font-semibold text-[#222]">{t("host_guidebook_cat_name_label", "Category name")}</span>
            <input
              autoFocus
              maxLength={80}
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm text-[#222] placeholder:text-zinc-400 outline-none transition focus:border-black"
              placeholder={t("host_guidebook_cat_name_ph", "e.g. Architecture")}
            />
          </label>
        </GuidebookModal>
      )}

      {modal === "listings" && (
        <GuidebookModal
          title={t("host_guidebook_choose_listings", "Choose listings")}
          onClose={closeModal}
          footer={
            <ModalFooter
              cancel={closeModal}
              save={() => void saveListings()}
              saving={saving}
            />
          }
        >
          <p className="mb-5 text-sm text-[#727272]">
            {t("host_guidebook_choose_listings_desc", "Choose where guests can discover this guidebook.")}
          </p>
          <div className="space-y-3">
            {guidebook?.eligibleListings.map((listing) => (
              <label
                key={listing.id}
                className="flex cursor-pointer items-center gap-4 rounded-2xl border border-zinc-200 p-3 hover:border-zinc-500"
              >
                <span className="relative size-16 overflow-hidden rounded-xl bg-zinc-100">
                  {listing.coverPhoto && (
                    <Image
                      src={listing.coverPhoto}
                      alt=""
                      fill
                      sizes="64px"
                      unoptimized
                      className="object-cover"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{listing.title}</strong>
                  <span className="text-sm text-[#727272]">
                    {listing.city || t("host_guidebook_location_not_set", "Location not set")}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={listingSelection.includes(listing.id)}
                  onChange={() =>
                    setListingSelection((current) =>
                      current.includes(listing.id)
                        ? current.filter((id) => id !== listing.id)
                        : [...current, listing.id],
                    )
                  }
                  className="size-5 accent-black"
                />
              </label>
            ))}
          </div>
        </GuidebookModal>
      )}

      {modal === "cover" && (
        <GuidebookModal
          title={t("host_guidebook_edit_cover", "Edit cover")}
          onClose={closeModal}
          footer={
            <ModalFooter
              cancel={closeModal}
              save={() => void saveCover()}
              saving={saving}
            />
          }
        >
          <PhotoUploader
            photos={coverDraft}
            setPhotos={setCoverDraft}
            upload={(files) => uploadPhotos(files, "cover")}
            uploading={uploading}
            single
          />
          {coverDraft.length === 0 && (
            <div className="mt-5 flex h-44 items-center justify-center rounded-2xl bg-[#FCDF9C] text-5xl">
              📍
            </div>
          )}
        </GuidebookModal>
      )}
      {modal === "delete-item" && (
        <GuidebookModal
          title={t("host_guidebook_remove_item_title", "Remove this recommendation?")}
          onClose={closeModal}
          width="max-w-md"
          footer={
            <ModalFooter
              cancel={closeModal}
              save={() => void confirmDeleteItem()}
              saving={saving}
              saveLabel={t("host_guidebook_remove_btn", "Remove")}
            />
          }
        >
          <p className="text-[#727272]">
            {t("host_guidebook_remove_item_desc", "This removes “{title}” from the guidebook. Other recommendations will not be affected.").replace("{title}", deleteItem?.title || "")}
          </p>
        </GuidebookModal>
      )}
      {modal === "delete-guidebook" && guidebookToDelete && (
        <GuidebookModal
          title={t("host_guidebook_delete_title", "Delete this guidebook?")}
          onClose={closeModal}
          width="max-w-md"
          footer={
            <ModalFooter
              cancel={closeModal}
              save={() => void confirmDeleteGuidebook()}
              saving={saving}
              saveLabel={t("host_guidebook_delete_btn", "Delete")}
            />
          }
        >
          <p className="text-[#727272]">
            {t("host_guidebook_delete_desc", "Are you sure you want to delete “{title}”? This action cannot be undone and will permanently remove this guidebook and its recommendations.").replace("{title}", guidebookToDelete.title || "")}
          </p>
        </GuidebookModal>
      )}
    </div>
  );
}
