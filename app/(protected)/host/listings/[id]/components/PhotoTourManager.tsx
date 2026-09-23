"use client";

import React, { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  PHOTO_TOUR_CATEGORIES,
  PHOTO_TOUR_CATEGORY_GROUPS,
  type PhotoRoomAssignment,
  type PhotoRoomType,
  resolvePhotoRoomType,
} from "@/lib/listing/photo-room-assignments";
import { PhotosSkeleton } from "./YourSpaceSkeletons";
import { useScrollbarDrag } from "@/components/ui/use-scrollbar-drag";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

interface PhotoTourManagerProps {
  photos: string[];
  photoRoomAssignments: PhotoRoomAssignment[];
  onChange: (photos: string[]) => void;
  onChangeRoomAssignments: (assignments: PhotoRoomAssignment[]) => void;
  onSave: () => void;
  isSaving: boolean;
  isLoading?: boolean;
  onBack?: () => void;
  setActiveSection?: (section: any) => void;
  presentation?: "host" | "admin";
}

function RoomSelect({
  id,
  value,
  disabled,
  onChange,
  roomOptionGroups,
  unassignedOptionLabel,
}: {
  id: string;
  value: PhotoRoomType | null;
  disabled: boolean;
  onChange: (roomType: PhotoRoomType | null) => void;
  roomOptionGroups: Array<{ label: string; options: Array<{ value: PhotoRoomType; label: string }> }>;
  unassignedOptionLabel: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange((event.target.value || null) as PhotoRoomType | null)}
        disabled={disabled}
        className="h-10 w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 pr-10 text-[13px] font-medium text-zinc-800 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-100/10"
      >
        <option value="" className="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100">{unassignedOptionLabel}</option>
        {roomOptionGroups.map((group) => (
          <optgroup key={group.label} label={group.label} className="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100">
            {group.options.map((option) => <option key={option.value} value={option.value} className="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100">{option.label}</option>)}
          </optgroup>
        ))}
      </select>
      <svg aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
      </svg>
    </div>
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
  presentation = "host",
}: PhotoTourManagerProps) {
  const { t } = useLanguage();
  const isAdmin = presentation === "admin";
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const roomTypeScrollerRef = useRef<HTMLDivElement>(null);
  const photoTourScrollRef = useRef<HTMLElement>(null);
  const photoTourScrollTrackRef = useRef<HTMLDivElement>(null);
  const photoTourScrollFrameRef = useRef<number | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => new Set());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRoomPickerOpen, setIsRoomPickerOpen] = useState(false);
  const [roomSearch, setRoomSearch] = useState("");
  const [photoTourScrollThumb, setPhotoTourScrollThumb] = useState({ height: 0, top: 0, visible: false });
  const { isDragging: isPhotoTourScrollbarDragging, onThumbPointerDown: onPhotoTourThumbPointerDown, scrollByPage: scrollPhotoTourByPage } = useScrollbarDrag(
    photoTourScrollRef,
    photoTourScrollTrackRef,
    photoTourScrollThumb.height,
  );

  const roomSections = useMemo(() => [
    ...PHOTO_TOUR_CATEGORIES.map((category) => ({
      roomType: category.id as PhotoRoomType | null,
      label: t(`host_room_cat_${category.id}` as any, category.label),
      description: category.description
        ? category.description
        : t("host_room_desc_fallback", "Use this room to organize the matching photos."),
      accent: category.group === "main_rooms" ? "bg-amber-100 text-amber-900" : category.group === "work_entertainment" ? "bg-indigo-100 text-indigo-900" : category.group === "indoor_areas" ? "bg-sky-100 text-sky-900" : category.group === "outdoor_areas" ? "bg-emerald-100 text-emerald-900" : category.group === "amenities_special_areas" ? "bg-cyan-100 text-cyan-900" : category.group === "parking_access" ? "bg-slate-200 text-slate-900" : category.group === "views_surroundings" ? "bg-rose-100 text-rose-900" : "bg-fuchsia-100 text-fuchsia-900",
    })),
    {
      roomType: null as PhotoRoomType | null,
      label: t("host_unassigned_photos", "Unassigned Photos"),
      description: t("host_unassigned_photos_desc", "Sort these photos into a room when you are ready."),
      accent: "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200",
    },
  ], [t]);

  const roomOptionGroups = useMemo(() => {
    const groupKeyMap: Record<string, string> = {
      main_rooms: "host_room_group_main_rooms",
      work_entertainment: "host_room_group_work_entertainment",
      indoor_areas: "host_room_group_indoor_areas",
      outdoor_areas: "host_room_group_outdoor_spaces",
      amenities_special_areas: "host_room_group_amenities_special",
      parking_access: "host_room_group_parking_access",
      views_surroundings: "host_room_group_views_surroundings",
      other: "host_room_group_other",
    };
    return PHOTO_TOUR_CATEGORY_GROUPS.map((group) => ({
      label: t((groupKeyMap[group.id] || `host_room_group_${group.id}`) as any, group.label),
      options: PHOTO_TOUR_CATEGORIES.filter((category) => category.group === group.id).map((category) => ({
        value: category.id,
        label: t(`host_room_cat_${category.id}` as any, category.label),
      })),
    }));
  }, [t]);

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
  const visibleRoomSections = roomSections.filter(
    ({ roomType }) => roomCount(roomType) > 0 || (photos.length === 0 && roomType === null),
  );
  const filteredRoomOptions = roomOptionGroups.map((group) => ({
    ...group,
    options: group.options.filter((option) =>
      option.label.toLowerCase().includes(roomSearch.toLowerCase()) ||
      option.value.toLowerCase().replace(/_/g, " ").includes(roomSearch.toLowerCase()),
    ),
  })).filter((group) => group.options.length > 0);

  const upload = async (file: File) => {
    if (!ACCEPTED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_FILE_SIZE) {
      throw new Error(t("host_photo_upload_format_err", "Use JPEG, PNG, WebP, or AVIF images up to 10 MB each."));
    }
    const data = new FormData();
    data.append("file", file);
    const response = await fetch("/api/v1/upload/listing-photo", { method: "POST", body: data });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok || !result || typeof result !== "object" || !("url" in result)) {
      throw new Error(result && typeof result === "object" && "error" in result ? String((result as { error: unknown }).error) : t("host_photo_upload_failed", "Photo upload failed. Please retry."));
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
      setError(cause instanceof Error ? cause.message : t("host_photo_upload_failed", "Photo upload failed. Please retry."));
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
      setError(cause instanceof Error ? cause.message : t("host_photo_replace_failed", "Photo replacement failed. Please retry."));
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

  const updatePhotoTourScrollThumb = React.useCallback(() => {
    if (isAdmin) return;
    if (photoTourScrollFrameRef.current !== null) cancelAnimationFrame(photoTourScrollFrameRef.current);

    photoTourScrollFrameRef.current = requestAnimationFrame(() => {
      const element = photoTourScrollRef.current;
      if (!element) {
        photoTourScrollFrameRef.current = null;
        return;
      }

      const hasOverflow = element.scrollHeight > element.clientHeight + 1;
      const trackHeight = photoTourScrollTrackRef.current?.clientHeight || element.clientHeight;
      const arrowSpace = 28;
      const usableTrackHeight = Math.max(0, trackHeight - arrowSpace * 2);
      const height = hasOverflow ? Math.min(60, usableTrackHeight) : 0;
      const maxTop = Math.max(0, usableTrackHeight - height);
      const scrollRange = Math.max(1, element.scrollHeight - element.clientHeight);
      const top = hasOverflow ? arrowSpace + Math.round((element.scrollTop / scrollRange) * maxTop) : 0;

      setPhotoTourScrollThumb((current) => (
        current.height === height && current.top === top && current.visible === hasOverflow
          ? current
          : { height, top, visible: hasOverflow }
      ));
      photoTourScrollFrameRef.current = null;
    });
  }, [isAdmin]);

  React.useEffect(() => {
    if (isAdmin) return;
    const element = photoTourScrollRef.current;
    if (!element) return;

    updatePhotoTourScrollThumb();
    const resizeObserver = new ResizeObserver(updatePhotoTourScrollThumb);
    const mutationObserver = new MutationObserver(updatePhotoTourScrollThumb);
    resizeObserver.observe(element);
    if (photoTourScrollTrackRef.current) resizeObserver.observe(photoTourScrollTrackRef.current);
    mutationObserver.observe(element, { childList: true, subtree: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (photoTourScrollFrameRef.current !== null) cancelAnimationFrame(photoTourScrollFrameRef.current);
    };
  }, [isAdmin, photoTourScrollThumb.visible, updatePhotoTourScrollThumb]);

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
        className={`group overflow-hidden rounded-xl border bg-white dark:bg-zinc-800 transition duration-200 ${selected ? "border-zinc-900 dark:border-amber-400 ring-2 ring-zinc-900/15 dark:ring-amber-400/20" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"}`}
      >
        <div className="relative aspect-[16/11] overflow-hidden bg-zinc-200 dark:bg-zinc-900">
          <img src={photo} alt={index === 0 ? t("host_cover_photo", "Cover photo") : t("host_listing_photo_alt", { number: index + 1 }, `Listing photo ${index + 1}`)} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
          <label className="absolute left-3 top-3 flex size-7 cursor-pointer items-center justify-center rounded-full bg-white/95 dark:bg-zinc-800/95 shadow-sm">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => togglePhotoSelection(index)}
              disabled={controlsDisabled}
              aria-label={t("host_select_photo_aria", { number: index + 1 }, `Select photo ${index + 1}`)}
              className="size-3.5 accent-zinc-900 dark:accent-amber-400 cursor-pointer"
            />
          </label>
          {index === 0 && <span className="absolute bottom-3 left-3 rounded-full bg-zinc-900 dark:bg-amber-400 px-2.5 py-1 text-[10px] font-semibold text-white dark:text-zinc-950 shadow-sm">{t("host_cover_photo")}</span>}
          <span className="absolute right-3 top-3 rounded-full bg-white/95 dark:bg-zinc-800/95 px-2 py-1 text-[10px] font-semibold text-zinc-700 dark:text-zinc-200 shadow-sm">#{index + 1}</span>
        </div>

        <div className="space-y-3 p-3.5">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400" htmlFor={`photo-room-${index}`}>
              {t("host_room_label", "Room")}
            </label>
            <RoomSelect
              id={`photo-room-${index}`}
              value={roomType}
              disabled={controlsDisabled}
              onChange={(nextRoom) => changeRoom(photo, nextRoom)}
              roomOptionGroups={roomOptionGroups}
              unassignedOptionLabel={t("host_unassigned_option", "Unassigned")}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-center sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-zinc-200 dark:border-zinc-700 dark:sm:divide-zinc-700">
            <button type="button" onClick={() => makeCover(index)} disabled={controlsDisabled || index === 0} className="col-span-2 flex min-h-11 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-[13px] font-medium leading-4 text-[#1f1f1f] transition hover:border-zinc-300 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-100 disabled:bg-zinc-50 disabled:text-zinc-400 disabled:opacity-100 sm:col-span-1 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-2 sm:hover:bg-transparent sm:hover:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-700/50 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-900/30 dark:disabled:text-zinc-500 dark:sm:bg-transparent dark:sm:hover:bg-transparent dark:sm:hover:text-white">
              {index === 0 ? t("host_cover_photo") : t("host_make_cover")}
            </button>
            <button type="button" onClick={() => { setReplaceIndex(index); replaceInput.current?.click(); }} disabled={controlsDisabled} className="flex min-h-11 items-center justify-center rounded-lg border border-zinc-200 bg-white px-2 text-[13px] font-medium leading-4 text-[#1f1f1f] transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:rounded-none sm:border-0 sm:bg-transparent sm:hover:bg-transparent sm:hover:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-700/50 dark:sm:bg-transparent dark:sm:hover:bg-transparent dark:sm:hover:text-white">{t("host_replace_photo")}</button>
            <button type="button" onClick={() => removePhoto(index)} disabled={controlsDisabled} className="flex min-h-11 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-2 text-[13px] font-medium leading-4 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-40 sm:rounded-none sm:border-0 sm:bg-transparent sm:hover:bg-transparent sm:hover:text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:sm:bg-transparent dark:sm:hover:bg-transparent dark:sm:hover:text-rose-300">{t("host_remove_photo")}</button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className={`relative w-full max-w-[1080px] ${isAdmin ? "" : "xl:h-[1850px]"}`}>
      <section
        ref={photoTourScrollRef}
        onScroll={updatePhotoTourScrollThumb}
        className={`custom-scrollbar w-full space-y-5 pb-12 ${isAdmin ? "" : "xl:h-full xl:overflow-y-auto xl:overscroll-contain xl:pr-[38px]"}`}
      >
        <input ref={addInput} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ""; void uploadFiles(files); }} />
        <input ref={replaceInput} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void replace(file); }} />

        <header className="overflow-hidden rounded-lg border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm">
          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 text-sm font-semibold text-[#727272] dark:text-zinc-400">{t("host_your_space")}</p>
              <h1>{t("host_photo_tour")}</h1>
              <p className="mt-2 max-w-xl text-sm leading-5 text-[#727272] dark:text-zinc-300">{t("host_photo_tour_desc")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => addInput.current?.click()} disabled={controlsDisabled} className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#1f1f1f] px-4 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-700 dark:hover:bg-zinc-600">
                {t("host_add_photos")}
              </button>
              <button type="button" disabled={controlsDisabled} onClick={onSave} className="inline-flex min-h-10 min-w-20 items-center justify-center rounded-full bg-[#FCDF9C] px-4 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f7cf71] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-400 dark:hover:bg-amber-300">
                {isSaving ? t("host_saving_btn") : t("host_save_btn")}
              </button>
            </div>
          </div>
          <div className="grid divide-y border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50 sm:grid-cols-3 sm:divide-x sm:divide-zinc-200 dark:sm:divide-zinc-700 sm:divide-y-0">
            <div className="px-5 py-3"><p className="text-xs font-semibold text-[#525252] dark:text-zinc-400">{t("host_gallery_photos", "Gallery photos")}</p><p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{photos.length}<span className="ml-1 text-xs font-medium text-[#727272] dark:text-zinc-400">{t("host_photos_unit", "photos")}</span></p></div>
            <div className="px-5 py-3"><p className="text-xs font-semibold text-[#525252] dark:text-zinc-400">{t("host_organized_by_room", "Organized by room")}</p><p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{assignedCount}<span className="ml-1 text-xs font-medium text-[#727272] dark:text-zinc-400">{t("host_assigned_unit", "assigned")}</span></p></div>
            <div className="px-5 py-3"><p className="text-xs font-semibold text-[#525252] dark:text-zinc-400">{t("host_still_to_organize", "Still to organize")}</p><p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{unassignedCount}<span className="ml-1 text-xs font-medium text-[#727272] dark:text-zinc-400">{t("host_unassigned_unit", "unassigned")}</span></p></div>
          </div>
          <div className="border-t border-zinc-200 bg-white px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800 sm:px-6">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#1f1f1f] dark:text-zinc-300">{t("host_photo_types_available", "Photo types available to assign")}</p>
              <div className="flex items-center gap-1.5">
                <button type="button" aria-label={t("host_scroll_room_types_left", "Scroll room types left")} onClick={() => scrollRoomTypes("left")} className="flex size-7 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 transition hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100">
                  <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button type="button" aria-label={t("host_scroll_room_types_right", "Scroll room types right")} onClick={() => scrollRoomTypes("right")} className="flex size-7 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 transition hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100">
                  <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>
            <div ref={roomTypeScrollerRef} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {roomSections.filter(({ roomType }) => roomType !== null).map(({ roomType, label, accent }) => (
                <span key={roomType} className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${accent}`}>
                  {label} · {roomCount(roomType)}
                </span>
              ))}
            </div>
          </div>
        </header>

        {photoMinimumRemaining > 0 && (
          <p className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">{t("host_add_more_photos_min", { count: photoMinimumRemaining })}</p>
        )}
        {error && <p role="alert" className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">{error} {t("host_choose_photo_retry", "Choose the photo again to retry.")}</p>}
        {uploading && <p className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">{t("host_uploading_securely", "Uploading securely. Your photo tour will stay open while the upload finishes.")}</p>}

        {selectedIndices.size > 0 && (
          <div className="relative z-20 grid grid-cols-1 gap-3 rounded-xl border border-zinc-900 bg-zinc-900 p-4 text-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800 xl:sticky xl:top-0 xl:grid-cols-[minmax(150px,1fr)_auto] xl:items-center">
            <p className="min-w-0 px-1 text-sm font-semibold leading-5">{t("host_photos_selected_count", { count: selectedIndices.size })}</p>
            <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-[auto_minmax(0,1fr)] min-[480px]:items-center sm:grid-cols-[auto_minmax(0,1fr)_auto]">
              <button type="button" onClick={() => setIsRoomPickerOpen(true)} disabled={controlsDisabled} className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg border border-white/40 bg-white/5 px-3 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                {t("host_add_room_or_space_btn", "+ Add a room or space")}
              </button>
              <div className="min-w-0 sm:w-full lg:w-60">
                <RoomSelect
                  id="selected-photo-room"
                  value={null}
                  disabled={controlsDisabled}
                  onChange={assignSelectedRoom}
                  roomOptionGroups={roomOptionGroups}
                  unassignedOptionLabel={t("host_unassigned_option", "Unassigned")}
                />
              </div>
              <button type="button" onClick={() => setSelectedIndices(new Set())} disabled={controlsDisabled} className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg border border-white/40 px-3 text-xs font-semibold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 min-[480px]:col-span-2 sm:col-span-1">{t("host_clear_selection", "Clear selection")}</button>
            </div>
          </div>
        )}

        {isRoomPickerOpen && (
          <div className="rounded-lg border border-[#727272] dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("host_add_room_or_space_title", "Add a room or space")}</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("host_add_room_or_space_subtitle", "Search and assign your selected photos to the right area.")}</p>
              </div>
              <button type="button" onClick={() => setIsRoomPickerOpen(false)} className="rounded-full bg-white hover:bg-[#1f1f1f] border border-[#1f1f1f] hover:border-[#1f1f1f] dark:border-zinc-700 px-2.5 py-1 text-base font-medium text-[#1f1f1f] hover:text-white dark:text-zinc-300 dark:hover:border-zinc-600 transition duration-300">{t("host_close", "Close")}</button>
            </div>
            <input
              value={roomSearch}
              onChange={(event) => setRoomSearch(event.target.value)}
              placeholder={t("host_search_rooms_placeholder", "Search rooms and spaces")}
              className="mb-4 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition focus:border-zinc-900 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-zinc-800 min-h-[56px] min-h-[45px]"
            />
            <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
              {filteredRoomOptions.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4 text-sm text-zinc-500 dark:text-zinc-400">{t("host_no_matching_rooms", "No matching room types found.")}</p>
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
                        className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5 text-left text-sm font-medium text-zinc-800 dark:text-zinc-200 transition hover:border-zinc-900 dark:hover:border-zinc-500 hover:bg-white dark:hover:bg-zinc-800"
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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#727272] bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/60">
              <p className="text-sm text-[#1f1f1f] dark:text-zinc-400">{t("host_drag_photo_instruction", "Drag photos to reorder them. The first photo is shown as your listing cover.")}</p>
              {photos.length > 0 && <button type="button" onClick={() => setSelectedIndices(new Set(photos.map((_, index) => index)))} disabled={controlsDisabled} className="text-sm font-semibold text-zinc-900 underline underline-offset-4 transition hover:text-zinc-600 disabled:opacity-50 dark:text-zinc-100 dark:hover:text-amber-400">{t("host_select_all", "Select all")}</button>}
            </div>

            {visibleRoomSections.map(({ roomType, label, description, accent }) => {
              const roomPhotos = photos
                .map((photo, index) => ({ photo, index }))
                .filter(({ photo }) => (roomByUrl.get(photo) ?? null) === roomType);
              return (
                <section key={roomType ?? "UNASSIGNED"} className="overflow-hidden rounded-lg border border-[#727272] bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-4 py-3.5 dark:border-zinc-700">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${accent}`}>{label.slice(0, 1)}</span>
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{label}</h2>
                        <p className="mt-0.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{description}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-white dark:bg-zinc-800 border border-transparent dark:border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300 shadow-sm">{roomPhotos.length}</span>
                  </div>
                  {roomPhotos.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 min-[1440px]:grid-cols-3">
                      {roomPhotos.map(({ photo, index }) => renderPhoto(photo, index))}
                    </div>
                  ) : (
                    <div className="m-4 flex min-h-28 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">{t("host_no_photos_assigned_here", "No photos assigned here yet.")}</div>
                  )}
                </section>
              );
            })}

            <button type="button" onClick={() => addInput.current?.click()} disabled={controlsDisabled} className="flex min-h-36 w-full flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white text-sm font-semibold text-zinc-700 transition hover:border-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-700/50">
              <span className="mb-2 flex size-9 items-center justify-center rounded-full border border-[#1f1f1f] bg-zinc-100 dark:bg-zinc-700">
                <Image src="/images/icons/add-icon.svg" alt="" width={18} height={18} />
              </span>
              {t("host_add_more_photos_btn", "Add more photos")}
              <span className="mt-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">{t("host_photo_upload_specs", "JPEG, PNG, WebP, or AVIF · up to 10 MB each")}</span>
            </button>
          </div>
        )}
      </section>
      {!isAdmin && photoTourScrollThumb.visible && (
        <div ref={photoTourScrollTrackRef} className="absolute inset-y-0 right-0 hidden w-[22px] rounded-[30px] bg-[#F3F4F5] dark:bg-zinc-800 xl:block">
          <button type="button" aria-label={t("host_scroll_photo_tour_up" as any, "Scroll photo tour up")} onClick={() => scrollPhotoTourByPage("up")} className="absolute left-0 top-1 z-10 flex size-[22px] items-center justify-center rounded-full text-[#727272] transition hover:bg-white/70 hover:text-[#1f1f1f] dark:text-zinc-300 dark:hover:bg-zinc-700">
            <svg aria-hidden="true" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m18 15-6-6-6 6" /></svg>
          </button>
          <div
            onPointerDown={onPhotoTourThumbPointerDown}
            className={`absolute left-0 top-0 w-[22px] touch-none select-none rounded-[30px] border border-white bg-[#DDDDDE] shadow-[0_2px_4px_rgba(0,0,0,0.25)] will-change-transform dark:border-zinc-700 dark:bg-zinc-600 ${isPhotoTourScrollbarDragging ? "cursor-grabbing" : "cursor-grab"}`}
            style={{ height: `${photoTourScrollThumb.height}px`, transform: `translate3d(0, ${photoTourScrollThumb.top}px, 0)` }}
          />
          <button type="button" aria-label={t("host_scroll_photo_tour_down" as any, "Scroll photo tour down")} onClick={() => scrollPhotoTourByPage("down")} className="absolute bottom-1 left-0 z-10 flex size-[22px] items-center justify-center rounded-full text-[#727272] transition hover:bg-white/70 hover:text-[#1f1f1f] dark:text-zinc-300 dark:hover:bg-zinc-700">
            <svg aria-hidden="true" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
