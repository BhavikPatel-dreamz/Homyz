"use client";

import React, { useMemo, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  PHOTO_TOUR_CATEGORIES,
  PHOTO_TOUR_CATEGORY_GROUPS,
  type PhotoRoomAssignment,
  type PhotoRoomType,
  resolvePhotoRoomType,
} from "@/lib/listing/photo-room-assignments";
import { PhotosSkeleton } from "./YourSpaceSkeletons";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const ROOM_LABELS_SHOWN_IN_EDITOR = [
  "Living Room",
  "Bedroom",
  "Bathroom",
  "Kitchen",
  "Dining Area",
  "Workspace",
  "Exterior",
  "Patio or Balcony",
  "Pool or Hot Tub",
  "Unassigned Photos",
] as const;
void ROOM_LABELS_SHOWN_IN_EDITOR;

const ROOM_SECTIONS: Array<{
  roomType: PhotoRoomType | null;
  label: string;
  description: string;
  accent: string;
}> = [
  ...PHOTO_TOUR_CATEGORIES.map((category) => ({
    roomType: category.id,
    label: category.label,
    description: category.description ?? "Use this room to organize the matching photos.",
    accent: category.group === "main_rooms" ? "bg-amber-100 text-amber-900" : category.group === "work_entertainment" ? "bg-indigo-100 text-indigo-900" : category.group === "indoor_areas" ? "bg-sky-100 text-sky-900" : category.group === "outdoor_areas" ? "bg-emerald-100 text-emerald-900" : category.group === "amenities_special_areas" ? "bg-cyan-100 text-cyan-900" : category.group === "parking_access" ? "bg-slate-200 text-slate-900" : category.group === "views_surroundings" ? "bg-rose-100 text-rose-900" : "bg-fuchsia-100 text-fuchsia-900",
  })),
  { roomType: null, label: "Unassigned Photos", description: "Sort these photos into a room when you are ready.", accent: "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200" },
];

const ROOM_OPTION_GROUPS: Array<{ label: string; options: Array<{ value: PhotoRoomType; label: string }> }> =
  PHOTO_TOUR_CATEGORY_GROUPS.map((group) => ({
    label: group.label,
    options: PHOTO_TOUR_CATEGORIES.filter((category) => category.group === group.id).map((category) => ({
      value: category.id,
      label: category.label,
    })),
  }));

interface PhotoTourManagerProps {
  photos: string[];
  photoRoomAssignments: PhotoRoomAssignment[];
  onChange: (photos: string[]) => void;
  onChangeRoomAssignments: (assignments: PhotoRoomAssignment[]) => void;
  onSave: () => void;
  isSaving: boolean;
  isLoading?: boolean;
}

function RoomSelect({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: PhotoRoomType | null;
  disabled: boolean;
  onChange: (roomType: PhotoRoomType | null) => void;
}) {
  return (
    <select
      id={id}
      value={value ?? ""}
      onChange={(event) => onChange((event.target.value || null) as PhotoRoomType | null)}
      disabled={disabled}
      className="w-full appearance-none rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-100 outline-none transition focus:border-zinc-900 dark:focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <option value="" className="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100">Unassigned</option>
      {ROOM_OPTION_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label} className="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100">
          {group.options.map((option) => <option key={option.value} value={option.value} className="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100">{option.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export function PhotoTourManager({
  photos,
  photoRoomAssignments,
  onChange,
  onChangeRoomAssignments,
  onSave,
  isSaving,
  isLoading,
}: PhotoTourManagerProps) {
  const { t } = useLanguage();
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const roomTypeScrollerRef = useRef<HTMLDivElement>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => new Set());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRoomPickerOpen, setIsRoomPickerOpen] = useState(false);
  const [roomSearch, setRoomSearch] = useState("");

  const roomByUrl = useMemo(
    () => new Map(
      photoRoomAssignments.map(({ url, roomType, roomCategory, categoryId }) => [
        url,
        resolvePhotoRoomType(roomType ?? roomCategory ?? categoryId ?? null),
      ]),
    ),
    [photoRoomAssignments],
  );
  const assignedCount = photos.filter((photo) => roomByUrl.has(photo)).length;
  const unassignedCount = photos.length - assignedCount;
  const photoMinimumRemaining = Math.max(0, 5 - photos.length);
  const controlsDisabled = isSaving || uploading;
  const roomCount = (roomType: PhotoRoomType | null) =>
    photos.filter((photo) => (roomByUrl.get(photo) ?? null) === roomType).length;
  const visibleRoomSections = ROOM_SECTIONS.filter(
    ({ roomType }) => roomCount(roomType) > 0 || (photos.length === 0 && roomType === null),
  );
  const filteredRoomOptions = ROOM_OPTION_GROUPS.map((group) => ({
    ...group,
    options: group.options.filter((option) =>
      option.label.toLowerCase().includes(roomSearch.toLowerCase()) ||
      option.value.toLowerCase().replace(/_/g, " ").includes(roomSearch.toLowerCase()),
    ),
  })).filter((group) => group.options.length > 0);

  const upload = async (file: File) => {
    if (!ACCEPTED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_FILE_SIZE) {
      throw new Error("Use JPEG, PNG, WebP, or AVIF images up to 10 MB each.");
    }
    const data = new FormData();
    data.append("file", file);
    const response = await fetch("/api/v1/upload/listing-photo", { method: "POST", body: data });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok || !result || typeof result !== "object" || !("url" in result)) {
      throw new Error(result && typeof result === "object" && "error" in result ? String((result as { error: unknown }).error) : "Photo upload failed. Please retry.");
    }
    return String((result as { url: string }).url);
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      onChange([...photos, ...(await Promise.all(files.map(upload)))]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Photo upload failed. Please retry.");
    } finally {
      setUploading(false);
    }
  };

  const replace = async (file: File) => {
    if (replaceIndex === null) return;
    const index = replaceIndex;
    setReplaceIndex(null);
    setUploading(true);
    setError(null);
    try {
      const next = [...photos];
      next[index] = await upload(file);
      onChange(next);
      setSelectedIndices(new Set());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Photo replacement failed. Please retry.");
    } finally {
      setUploading(false);
    }
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...photos];
    const [photo] = next.splice(from, 1);
    next.splice(to, 0, photo);
    onChange(next);
    setSelectedIndices(new Set());
  };

  const changeRoom = (url: string, roomType: PhotoRoomType | null) => {
    const withoutPhoto = photoRoomAssignments.filter((assignment) => assignment.url !== url);
    onChangeRoomAssignments(roomType ? [...withoutPhoto, { url, roomType }] : withoutPhoto);
  };

  const togglePhotoSelection = (index: number) => {
    setSelectedIndices((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const assignSelectedRoom = (roomType: PhotoRoomType | null) => {
    const selectedUrls = new Set(Array.from(selectedIndices, (index) => photos[index]));
    const remainingAssignments = photoRoomAssignments.filter(({ url }) => !selectedUrls.has(url));
    const nextAssignments = roomType
      ? [...remainingAssignments, ...Array.from(selectedUrls, (url) => ({ url, roomType }))]
      : remainingAssignments;
    onChangeRoomAssignments(nextAssignments);
    setSelectedIndices(new Set());
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, itemIndex) => itemIndex !== index));
    setSelectedIndices(new Set());
  };

  const makeCover = (index: number) => {
    if (index === 0) return;
    const next = [...photos];
    const [cover] = next.splice(index, 1);
    next.unshift(cover);
    onChange(next);
    setSelectedIndices(new Set());
  };

  const scrollRoomTypes = (direction: "left" | "right") => {
    const scroller = roomTypeScrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({
      left: direction === "left" ? -220 : 220,
      behavior: "smooth",
    });
  };

  const renderPhoto = (photo: string, index: number) => {
    const roomType = roomByUrl.get(photo) ?? null;
    const selected = selectedIndices.has(index);
    return (
      <article
        key={`${photo}-${index}`}
        draggable={!controlsDisabled}
        onDragStart={() => setDragIndex(index)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (dragIndex !== null) reorder(dragIndex, index);
          setDragIndex(null);
        }}
        className={`group overflow-hidden rounded-2xl border bg-white dark:bg-zinc-800 shadow-sm transition duration-200 ${selected ? "border-zinc-900 dark:border-amber-400 ring-2 ring-zinc-900/15 dark:ring-amber-400/20" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-md"}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-zinc-200 dark:bg-zinc-900">
          <img src={photo} alt={index === 0 ? "Cover photo" : `Listing photo ${index + 1}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
          <label className="absolute left-3 top-3 flex size-7 cursor-pointer items-center justify-center rounded-full bg-white/95 dark:bg-zinc-800/95 shadow-sm">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => togglePhotoSelection(index)}
              disabled={controlsDisabled}
              aria-label={`Select photo ${index + 1}`}
              className="size-3.5 accent-zinc-900 dark:accent-amber-400"
            />
          </label>
          {index === 0 && <span className="absolute bottom-3 left-3 rounded-full bg-zinc-900 dark:bg-amber-400 px-2.5 py-1 text-[10px] font-semibold text-white dark:text-zinc-950 shadow-sm">{t("host_cover_photo")}</span>}
          <span className="absolute right-3 top-3 rounded-full bg-white/95 dark:bg-zinc-800/95 px-2 py-1 text-[10px] font-semibold text-zinc-700 dark:text-zinc-200 shadow-sm">#{index + 1}</span>
        </div>

        <div className="space-y-3 p-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400" htmlFor={`photo-room-${index}`}>
              Room
            </label>
            <RoomSelect id={`photo-room-${index}`} value={roomType} disabled={controlsDisabled} onChange={(nextRoom) => changeRoom(photo, nextRoom)} />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-700 pt-2.5">
            <button type="button" onClick={() => makeCover(index)} disabled={controlsDisabled || index === 0} className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:text-black dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
              {index === 0 ? t("host_cover_photo") : t("host_make_cover")}
            </button>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => { setReplaceIndex(index); replaceInput.current?.click(); }} disabled={controlsDisabled} className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:text-black dark:hover:text-white disabled:opacity-40">{t("host_replace_photo")}</button>
              <button type="button" onClick={() => removePhoto(index)} disabled={controlsDisabled} className="text-xs font-semibold text-rose-700 dark:text-rose-400 transition hover:text-rose-900 dark:hover:text-rose-300 disabled:opacity-40">{t("host_remove_photo")}</button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <section className="max-w-5xl space-y-6 pb-12">
      <input ref={addInput} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ""; void uploadFiles(files); }} />
      <input ref={replaceInput} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void replace(file); }} />

      <header className="overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm">
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{t("host_your_space")}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100 sm:text-3xl">{t("host_photo_tour")}</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Help guests understand your place at a glance. Assign each existing or new gallery photo to a room—your original image files and gallery order stay exactly the same.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => addInput.current?.click()} disabled={controlsDisabled} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-900 dark:border-zinc-600 bg-zinc-900 dark:bg-zinc-700 px-4 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60">
              {t("host_add_photos")}
            </button>
            <button type="button" disabled={controlsDisabled} onClick={onSave} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#FEE08B] dark:bg-amber-400 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-[#fbd46a] dark:hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
              {isSaving ? t("host_saving_btn") : t("host_save_btn")}
            </button>
          </div>
        </div>
        <div className="grid divide-y border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 sm:grid-cols-3 sm:divide-x sm:divide-zinc-200 dark:sm:divide-zinc-700 sm:divide-y-0">
          <div className="px-5 py-3.5"><p className="text-xs text-zinc-500 dark:text-zinc-400">Gallery photos</p><p className="mt-0.5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{photos.length}<span className="ml-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">photos</span></p></div>
          <div className="px-5 py-3.5"><p className="text-xs text-zinc-500 dark:text-zinc-400">Organized by room</p><p className="mt-0.5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{assignedCount}<span className="ml-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">assigned</span></p></div>
          <div className="px-5 py-3.5"><p className="text-xs text-zinc-500 dark:text-zinc-400">Still to organize</p><p className="mt-0.5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{unassignedCount}<span className="ml-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">unassigned</span></p></div>
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-700 px-5 py-4 sm:px-7">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Photo types available to assign</p>
            <div className="flex items-center gap-1.5">
              <button type="button" aria-label="Scroll room types left" onClick={() => scrollRoomTypes("left")} className="flex size-7 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 transition hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100">
                ←
              </button>
              <button type="button" aria-label="Scroll room types right" onClick={() => scrollRoomTypes("right")} className="flex size-7 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 transition hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100">
                →
              </button>
            </div>
          </div>
          <div ref={roomTypeScrollerRef} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {ROOM_SECTIONS.filter(({ roomType }) => roomType !== null).map(({ roomType, label, accent }) => (
              <span key={roomType} className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${accent}`}>
                {label} · {roomCount(roomType)}
              </span>
            ))}
          </div>
        </div>
      </header>

      {photoMinimumRemaining > 0 && (
        <p className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">Add {photoMinimumRemaining} more {photoMinimumRemaining === 1 ? "photo" : "photos"} to meet the 5-photo listing minimum.</p>
      )}
      {error && <p role="alert" className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">{error} Choose the photo again to retry.</p>}
      {uploading && <p className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">Uploading securely. Your photo tour will stay open while the upload finishes.</p>}

      {selectedIndices.size > 0 && (
        <div className="sticky top-3 z-10 flex flex-col gap-3 rounded-2xl border border-zinc-900 dark:border-zinc-700 bg-zinc-900 dark:bg-zinc-800 p-3 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <p className="px-1 text-sm font-semibold">{selectedIndices.size} {selectedIndices.size === 1 ? "photo" : "photos"} selected</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setIsRoomPickerOpen(true)} disabled={controlsDisabled} className="inline-flex items-center justify-center rounded-xl border border-white/40 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
              + Add a room or space
            </button>
            <div className="min-w-40"><RoomSelect id="selected-photo-room" value={null} disabled={controlsDisabled} onChange={assignSelectedRoom} /></div>
            <button type="button" onClick={() => setSelectedIndices(new Set())} disabled={controlsDisabled} className="rounded-xl border border-white/40 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-50">Clear selection</button>
          </div>
        </div>
      )}

      {isRoomPickerOpen && (
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Add a room or space</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Search and assign your selected photos to the right area.</p>
            </div>
            <button type="button" onClick={() => setIsRoomPickerOpen(false)} className="rounded-full border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600">Close</button>
          </div>
          <input
            value={roomSearch}
            onChange={(event) => setRoomSearch(event.target.value)}
            placeholder="Search rooms and spaces"
            className="mb-4 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition focus:border-zinc-900 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-zinc-800"
          />
          <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
            {filteredRoomOptions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4 text-sm text-zinc-500 dark:text-zinc-400">No matching room types found.</p>
            ) : filteredRoomOptions.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">{group.label}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        assignSelectedRoom(option.value);
                        setIsRoomPickerOpen(false);
                        setRoomSearch("");
                      }}
                      className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 text-left text-sm font-medium text-zinc-800 dark:text-zinc-200 transition hover:border-zinc-900 dark:hover:border-zinc-500 hover:bg-white dark:hover:bg-zinc-800"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? <PhotosSkeleton /> : (
        <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const files = Array.from(event.dataTransfer.files); if (files.length) void uploadFiles(files); }} className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Drag a photo to adjust its gallery order. The first image remains your cover photo.</p>
            {photos.length > 0 && <button type="button" onClick={() => setSelectedIndices(new Set(photos.map((_, index) => index)))} disabled={controlsDisabled} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 underline underline-offset-4 hover:text-zinc-600 dark:hover:text-amber-400 disabled:opacity-50">Select all</button>}
          </div>

          {visibleRoomSections.map(({ roomType, label, description, accent }) => {
            const roomPhotos = photos
              .map((photo, index) => ({ photo, index }))
              .filter(({ photo }) => (roomByUrl.get(photo) ?? null) === roomType);
            return (
              <section key={roomType ?? "UNASSIGNED"} className="rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${accent}`}>{label.slice(0, 1)}</span>
                    <div>
                      <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">{label}</h2>
                      <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white dark:bg-zinc-800 border border-transparent dark:border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300 shadow-sm">{roomPhotos.length}</span>
                </div>
                {roomPhotos.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {roomPhotos.map(({ photo, index }) => renderPhoto(photo, index))}
                  </div>
                ) : (
                  <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 text-center text-sm text-zinc-500 dark:text-zinc-400">No photos assigned here yet.</div>
                )}
              </section>
            );
          })}

          <button type="button" onClick={() => addInput.current?.click()} disabled={controlsDisabled} className="flex min-h-36 w-full flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-400 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-200 transition hover:border-zinc-900 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 disabled:cursor-not-allowed disabled:opacity-60">
            <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-700 text-xl text-zinc-900 dark:text-zinc-100">+</span>
            Add more photos
            <span className="mt-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">JPEG, PNG, WebP, or AVIF · up to 10 MB each</span>
          </button>
        </div>
      )}
    </section>
  );
}
