"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { TravelPhotoDTO, TravelStampPickerPageDTO, UserTravelStampDTO } from "@/types/travel";
import { addTravelStampSelectionsAction, createCustomTravelStampAction, deleteCustomTravelStampAction, setStampPublicAction, updateCustomTravelStampAction } from "@/actions/travel/travelStampsAndBadges";
import { toast } from "@/components/ui/toast";

interface TravelStampManagerModalProps {
  isOpen: boolean;
  stamps: UserTravelStampDTO[];
  initialCustomStamp?: UserTravelStampDTO | null;
  onClose: () => void;
  onStampsChange: (stamps: UserTravelStampDTO[]) => void;
}

type ArtworkSource = "upload" | "photo";
const PAGE_SIZE = 9;
const MAX_CUSTOM_STAMP_SIZE = 5 * 1024 * 1024;

function pageCacheKey(page: number, search: string, country: string) {
  return `${page}:${search.toLocaleLowerCase()}:${country.toLocaleLowerCase()}`;
}

function uploadCustomArtwork(file: File, onProgress: (progress: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/v1/travel-media/stamps/custom-upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.max(1, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onerror = () => reject(new Error("Artwork upload failed. Please try again."));
    xhr.onload = () => {
      let data: { url?: string; error?: string } = {};
      try { data = JSON.parse(xhr.responseText) as { url?: string; error?: string }; } catch { /* non-JSON proxy response */ }
      if (xhr.status < 200 || xhr.status >= 300 || !data.url) {
        reject(new Error(data.error || "Artwork upload failed. Please try again."));
        return;
      }
      onProgress(100);
      resolve(data.url);
    };
    const formData = new FormData();
    formData.set("file", file);
    xhr.send(formData);
  });
}

export function TravelStampManagerModal({ isOpen, stamps, initialCustomStamp = null, onClose, onStampsChange }: TravelStampManagerModalProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [countries, setCountries] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<TravelStampPickerPageDTO | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState(Boolean(initialCustomStamp));
  const [editingCustomStamp, setEditingCustomStamp] = useState<UserTravelStampDTO | null>(initialCustomStamp);
  const [displayName, setDisplayName] = useState(initialCustomStamp?.stamp.displayName || "");
  const [customCountry, setCustomCountry] = useState(initialCustomStamp?.stamp.country || "");
  const [customCity, setCustomCity] = useState(initialCustomStamp?.stamp.city || "");
  const [isPublic, setIsPublic] = useState(initialCustomStamp?.isPublic ?? true);
  const [artworkSource, setArtworkSource] = useState<ArtworkSource>("upload");
  const [artworkUrl, setArtworkUrl] = useState<string | null>(initialCustomStamp?.stamp.iconUrl || null);
  const [sourcePhotoId, setSourcePhotoId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<TravelPhotoDTO[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isUploadingArtwork, setIsUploadingArtwork] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [customError, setCustomError] = useState<string | null>(null);
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [isDeletingCustom, setIsDeletingCustom] = useState(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cacheRef = useRef(new Map<string, TravelStampPickerPageDTO>());
  const requestIdRef = useRef(0);
  const touchStartXRef = useRef<number | null>(null);

  const resetCustomEditor = useCallback((stamp: UserTravelStampDTO | null = null) => {
    setEditingCustomStamp(stamp);
    setDisplayName(stamp?.stamp.displayName || "");
    setCustomCountry(stamp?.stamp.country || "");
    setCustomCity(stamp?.stamp.city || "");
    setIsPublic(stamp?.isPublic ?? true);
    setArtworkSource("upload");
    setArtworkUrl(stamp?.stamp.iconUrl || null);
    setSourcePhotoId(null);
    setUploadProgress(0);
    setCustomError(null);
    setIsDeleteConfirmationOpen(false);
  }, []);
  const openCustomEditor = useCallback((stamp: UserTravelStampDTO | null = null) => {
    resetCustomEditor(stamp);
    setIsCustomEditorOpen(true);
  }, [resetCustomEditor]);

  const fetchPage = useCallback(async (nextPage: number, nextSearch: string, nextCountry: string, options: { prefetch?: boolean; force?: boolean } = {}) => {
    const key = pageCacheKey(nextPage, nextSearch, nextCountry);
    if (!options.force) {
      const cached = cacheRef.current.get(key);
      if (cached) { if (!options.prefetch) setResult(cached); return cached; }
    }
    const requestId = ++requestIdRef.current;
    if (!options.prefetch) { setIsLoading(true); setError(null); }
    try {
      const params = new URLSearchParams({ page: String(nextPage), limit: String(PAGE_SIZE) });
      if (nextSearch) params.set("search", nextSearch);
      if (nextCountry !== "all") params.set("country", nextCountry);
      const response = await fetch(`/api/v1/travel-media/stamps/catalog?${params}`);
      const data = (await response.json()) as TravelStampPickerPageDTO & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load destination stamps.");
      cacheRef.current.set(key, data);
      if (!options.prefetch && requestId === requestIdRef.current) setResult(data);
      return data;
    } catch (err) {
      if (!options.prefetch && requestId === requestIdRef.current) setError(err instanceof Error ? err.message : "Unable to load destination stamps.");
      return null;
    } finally {
      if (!options.prefetch && requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  const loadPhotos = useCallback(async () => {
    if (photos.length || isLoadingPhotos) return;
    setIsLoadingPhotos(true);
    try {
      const response = await fetch("/api/v1/travel-media/photos?limit=24");
      const data = (await response.json()) as { photos?: TravelPhotoDTO[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load your travel photos.");
      setPhotos(data.photos || []);
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : "Unable to load your travel photos.");
    } finally { setIsLoadingPhotos(false); }
  }, [isLoadingPhotos, photos.length]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!isOpen) return;
    void fetchPage(page, debouncedSearch, country).then((data) => {
      if (data?.hasMore) void fetchPage(page + 1, debouncedSearch, country, { prefetch: true });
    });
  }, [country, debouncedSearch, fetchPage, isOpen, page]);
  useEffect(() => {
    if (!isOpen || countries.length) return;
    let cancelled = false;
    void fetch("/api/v1/travel-media/stamps/catalog/countries").then(async (response) => {
      const data = (await response.json()) as { countries?: string[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load countries.");
      if (!cancelled) setCountries(data.countries || []);
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load countries.");
    });
    return () => { cancelled = true; };
  }, [countries.length, isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === "Escape") {
        if (isDeleteConfirmationOpen) setIsDeleteConfirmationOpen(false);
        else if (isCustomEditorOpen) setIsCustomEditorOpen(false);
        else onClose();
        return;
      }
      if (target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA") return;
      if (event.key === "ArrowLeft" && page > 1) setPage((value) => value - 1);
      if (event.key === "ArrowRight" && result && page < result.totalPages) setPage((value) => value + 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCustomEditorOpen, isDeleteConfirmationOpen, isOpen, onClose, page, result]);

  if (!isOpen) return null;

  const totalPages = result?.totalPages || 1;
  const goNext = () => { if (page < totalPages) setPage((value) => value + 1); };
  const goPrevious = () => { if (page > 1) setPage((value) => value - 1); };
  const toggleSelection = (id: string, isAlreadyCollected: boolean) => {
    if (isAlreadyCollected || isSaving) return;
    setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const handleSave = async () => {
    if (!selectedIds.size || isSaving) return;
    setIsSaving(true); setError(null);
    try {
      const updated = await addTravelStampSelectionsAction({ catalogStampIds: [...selectedIds] });
      onStampsChange(updated); setSelectedIds(new Set()); cacheRef.current.clear();
      await fetchPage(page, debouncedSearch, country, { force: true });
      toast.success("Stamps added to your travel profile.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add destination stamps.";
      setError(message); toast.error(message);
    } finally { setIsSaving(false); }
  };
  const handleArtworkFile = async (file: File | undefined) => {
    if (!file || isUploadingArtwork) return;
    if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(file.type)) { setCustomError("Choose a PNG, JPG, or WebP image."); return; }
    if (file.size > MAX_CUSTOM_STAMP_SIZE) { setCustomError("Custom stamp artwork must be 5 MB or smaller."); return; }
    setCustomError(null); setIsUploadingArtwork(true); setUploadProgress(1);
    try {
      const url = await uploadCustomArtwork(file, setUploadProgress);
      setArtworkUrl(url); setSourcePhotoId(null); setArtworkSource("upload");
    } catch (err) { setCustomError(err instanceof Error ? err.message : "Artwork upload failed."); }
    finally { setIsUploadingArtwork(false); }
  };
  const selectPhoto = (photo: TravelPhotoDTO) => {
    setArtworkSource("photo"); setSourcePhotoId(photo.id); setArtworkUrl(photo.mediumUrl || photo.url); setCustomError(null);
  };
  const handleSaveCustom = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName) { setCustomError("Give your personal stamp a name."); return; }
    if (!artworkUrl && !sourcePhotoId) { setCustomError("Upload artwork or choose one of your travel photos."); return; }
    setIsSavingCustom(true); setCustomError(null);
    try {
      let updated: UserTravelStampDTO;
      if (editingCustomStamp) {
        updated = await updateCustomTravelStampAction(editingCustomStamp.stampId, { displayName: trimmedName, country: customCountry || null, city: customCity || null, ...(artworkSource === "photo" ? { sourcePhotoId } : { artworkUrl }) });
        if (updated.isPublic !== isPublic) updated = await setStampPublicAction(updated.id, isPublic);
        onStampsChange(stamps.map((stamp) => stamp.id === updated.id ? updated : stamp));
        toast.success("Personal stamp updated.");
      } else {
        updated = await createCustomTravelStampAction({ displayName: trimmedName, country: customCountry || null, city: customCity || null, ...(artworkSource === "photo" ? { sourcePhotoId } : { artworkUrl }), isPublic });
        onStampsChange([...stamps.filter((stamp) => stamp.id !== updated.id), updated]);
        cacheRef.current.clear(); void fetchPage(page, debouncedSearch, country, { force: true });
        toast.success("Personal stamp saved to your collection.");
      }
      setIsCustomEditorOpen(false); resetCustomEditor();
    } catch (err) { setCustomError(err instanceof Error ? err.message : "Unable to save your personal stamp."); }
    finally { setIsSavingCustom(false); }
  };
  const handleDeleteCustom = async () => {
    if (!editingCustomStamp || isDeletingCustom) return;
    setIsDeletingCustom(true);
    try {
      await deleteCustomTravelStampAction(editingCustomStamp.stampId);
      onStampsChange(stamps.filter((stamp) => stamp.stampId !== editingCustomStamp.stampId));
      setIsDeleteConfirmationOpen(false); setIsCustomEditorOpen(false); resetCustomEditor(); cacheRef.current.clear();
      void fetchPage(page, debouncedSearch, country, { force: true }); toast.success("Personal stamp deleted.");
    } catch (err) { setCustomError(err instanceof Error ? err.message : "Unable to delete this personal stamp."); }
    finally { setIsDeletingCustom(false); }
  };
  const selectedPhoto = photos.find((photo) => photo.id === sourcePhotoId);
  const previewUrl = artworkSource === "photo" ? selectedPhoto?.mediumUrl || selectedPhoto?.url || artworkUrl : artworkUrl;

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-5">
    <button type="button" aria-label="Close stamp picker" onClick={onClose} className="absolute inset-0 cursor-default" />
    <div role="dialog" aria-modal="true" aria-labelledby="stamp-manager-title" className="relative z-10 flex max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[85vh] sm:max-w-[820px] sm:rounded-3xl">
      <header className="flex shrink-0 items-start justify-between border-b border-zinc-100 bg-white px-4 py-3 sm:px-6 sm:py-4"><div><h2 id="stamp-manager-title" className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">My Travel Stamps</h2><p className="mt-1 text-xs text-zinc-500 sm:text-sm">Collect destination stamps or create a personal keepsake.</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => openCustomEditor()} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100">Create personal stamp</button><button type="button" onClick={onClose} aria-label="Close" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800">✕</button></div></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">{error}</div>}
        <div className="flex flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search city, country or stamp..." aria-label="Search city, country or stamp" className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 pr-14 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />{search && <button type="button" onClick={() => { setSearch(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500 hover:text-zinc-900">Clear</button>}</div><select value={country} onChange={(event) => { setCountry(event.target.value); setPage(1); }} aria-label="Filter stamps by country" className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-700 outline-none focus:border-amber-400"><option value="all">All Countries</option>{countries.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        <div className="mt-5"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-zinc-900">Explore Destination Stamps</h3><p className="mt-0.5 text-xs text-zinc-500">{result ? `${result.totalCount} matching stamp${result.totalCount === 1 ? "" : "s"}` : "Loading catalog…"}</p></div>{selectedIds.size > 0 && <span className="shrink-0 text-xs font-semibold text-amber-700">{selectedIds.size} selected</span>}</div>
          {isLoading && !result ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{Array.from({ length: PAGE_SIZE }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-zinc-100" />)}</div> : result?.items.length ? <div onTouchStart={(event) => { touchStartXRef.current = event.changedTouches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const start = touchStartXRef.current; const end = event.changedTouches[0]?.clientX; touchStartXRef.current = null; if (start !== null && end !== undefined && Math.abs(end - start) > 48) { if (end < start) goNext(); else goPrevious(); } }} className="grid grid-cols-2 gap-3 md:grid-cols-3" aria-live="polite">{result.items.map((item) => { const selected = selectedIds.has(item.id); const disabled = item.isAlreadyCollected || isSaving; return <button key={item.id} type="button" disabled={disabled} aria-pressed={selected} onClick={() => toggleSelection(item.id, item.isAlreadyCollected)} className={`group relative min-h-36 rounded-2xl border p-3 text-left transition ${item.isAlreadyCollected ? "cursor-not-allowed border-zinc-100 bg-zinc-50 opacity-70" : selected ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300" : "border-zinc-200 bg-white hover:border-amber-300 hover:bg-amber-50/30"}`}><div className="relative mx-auto flex size-16 items-center justify-center overflow-hidden rounded-full border border-dashed border-zinc-300 bg-zinc-50 p-1.5 sm:size-[72px]">{item.iconUrl ? <Image src={item.iconUrl} alt={item.displayName} fill loading="lazy" sizes="72px" unoptimized={item.iconUrl.endsWith(".svg")} className="object-contain p-1" /> : <span className="text-2xl">✈️</span>}</div><p className="mt-2 truncate text-center text-sm font-bold text-zinc-900">{item.displayName}</p><p className="mt-0.5 truncate text-center text-[11px] text-zinc-500">{[item.cityName, item.countryName].filter(Boolean).join(", ") || item.category}</p><span className={`mt-2 block text-center text-[11px] font-semibold ${item.isAlreadyCollected ? "text-emerald-700" : selected ? "text-amber-700" : "text-zinc-700"}`}>{item.isAlreadyCollected ? "✓ Added" : selected ? "✓ Selected" : item.isCustom ? "Personal" : "+ Add"}</span></button>; })}</div> : !isLoading ? <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center"><p className="text-sm font-semibold text-zinc-900">No destination stamps found</p><p className="mt-1 text-xs text-zinc-500">Try a different city, country, or stamp name.</p></div> : null}
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4"><button type="button" onClick={goPrevious} disabled={page <= 1 || isLoading} className="rounded-full border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40">← Previous</button><span className="text-xs font-medium text-zinc-500">Page {result?.page || page} of {totalPages}</span><button type="button" onClick={goNext} disabled={page >= totalPages || isLoading} className="rounded-full border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40">Next →</button></div>
        </div>
      </div>
      <footer className="flex shrink-0 items-center justify-between border-t border-zinc-100 bg-white px-4 py-3 sm:px-6"><button type="button" onClick={onClose} disabled={isSaving} className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50">Cancel</button><button type="button" onClick={selectedIds.size ? handleSave : onClose} disabled={isSaving} className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? "Adding…" : selectedIds.size ? `Add ${selectedIds.size} Stamp${selectedIds.size === 1 ? "" : "s"}` : "Done"}</button></footer>
    </div>
    {isCustomEditorOpen && <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5"><div role="dialog" aria-modal="true" aria-labelledby="custom-stamp-title" className="max-h-[100dvh] w-full overflow-y-auto bg-white p-5 shadow-2xl sm:max-h-[85vh] sm:max-w-lg sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h3 id="custom-stamp-title" className="text-lg font-bold text-zinc-900">{editingCustomStamp ? "Edit personal stamp" : "Create personal stamp"}</h3><p className="mt-1 text-xs text-zinc-500">Use a PNG, JPG, or WebP under 5 MB, or one of your travel photos.</p></div><button type="button" onClick={() => setIsCustomEditorOpen(false)} aria-label="Close personal stamp editor" className="rounded-full bg-zinc-100 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-200">✕</button></div>
      {customError && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{customError}</div>}
      <div className="mt-5 grid gap-4"><label className="grid gap-1.5 text-xs font-semibold text-zinc-700">Stamp name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} placeholder="e.g. My first solo trip" className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-amber-400" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-semibold text-zinc-700">Country <span className="font-normal text-zinc-400">(optional)</span><input value={customCountry} onChange={(event) => setCustomCountry(event.target.value)} maxLength={80} className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-amber-400" /></label><label className="grid gap-1.5 text-xs font-semibold text-zinc-700">City <span className="font-normal text-zinc-400">(optional)</span><input value={customCity} onChange={(event) => setCustomCity(event.target.value)} maxLength={80} className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-amber-400" /></label></div>
        <div><p className="text-xs font-semibold text-zinc-700">Artwork</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => { setArtworkSource("upload"); setSourcePhotoId(null); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${artworkSource === "upload" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>Upload image</button><button type="button" onClick={() => { setArtworkSource("photo"); void loadPhotos(); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${artworkSource === "photo" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>Travel photo</button></div></div>
        {artworkSource === "upload" ? <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4"><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { void handleArtworkFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /><button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploadingArtwork} className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50">{isUploadingArtwork ? `Uploading ${uploadProgress}%` : artworkUrl ? "Replace uploaded artwork" : "Choose image"}</button>{isUploadingArtwork && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200"><div className="h-full bg-amber-500 transition-all" style={{ width: `${uploadProgress}%` }} /></div>}</div> : <div className="rounded-2xl border border-zinc-200 p-3">{isLoadingPhotos ? <p className="py-5 text-center text-xs text-zinc-500">Loading your travel photos…</p> : photos.length ? <div className="grid grid-cols-4 gap-2">{photos.map((photo) => <button key={photo.id} type="button" onClick={() => selectPhoto(photo)} aria-pressed={sourcePhotoId === photo.id} className={`relative aspect-square overflow-hidden rounded-lg border-2 ${sourcePhotoId === photo.id ? "border-amber-500" : "border-transparent"}`}><Image src={photo.thumbnailUrl || photo.mediumUrl || photo.url} alt={photo.caption || "Travel photo"} fill sizes="96px" className="object-cover" /></button>)}</div> : <p className="py-5 text-center text-xs text-zinc-500">No travel photos yet. Upload an image instead.</p>}</div>}
        <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5"><div><p className="text-xs font-semibold text-zinc-800">Show on public profile</p><p className="text-[11px] text-zinc-500">You can change this later.</p></div><button type="button" role="switch" aria-checked={isPublic} onClick={() => setIsPublic((value) => !value)} className={`relative inline-flex h-6 w-11 rounded-full ${isPublic ? "bg-emerald-500" : "bg-zinc-300"}`}><span className={`inline-block size-5 translate-y-0.5 rounded-full bg-white shadow transition ${isPublic ? "translate-x-5" : "translate-x-0.5"}`} /></button></div>
        <div className="flex items-center gap-4"><div className="relative size-20 shrink-0 overflow-hidden rounded-full border border-dashed border-zinc-300 bg-zinc-50">{previewUrl ? <Image src={previewUrl} alt="Personal stamp preview" fill sizes="80px" className="object-cover" /> : <span className="flex size-full items-center justify-center text-2xl">✈️</span>}</div><p className="text-xs leading-relaxed text-zinc-500">Artwork is shown inside a circular stamp preview. For the cleanest result, use a centered square image.</p></div></div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><div>{editingCustomStamp && <button type="button" onClick={() => setIsDeleteConfirmationOpen(true)} disabled={isSavingCustom || isDeletingCustom} className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50">Delete personal stamp</button>}</div><div className="flex gap-2"><button type="button" onClick={() => setIsCustomEditorOpen(false)} disabled={isSavingCustom} className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700">Cancel</button><button type="button" onClick={() => void handleSaveCustom()} disabled={isSavingCustom || isUploadingArtwork} className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{isSavingCustom ? "Saving…" : editingCustomStamp ? "Save changes" : "Save personal stamp"}</button></div></div>
      {isDeleteConfirmationOpen && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4"><p className="text-sm font-semibold text-rose-900">Delete this personal stamp permanently?</p><p className="mt-1 text-xs text-rose-800">Its artwork and collection entry will be removed and cannot be recovered.</p><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setIsDeleteConfirmationOpen(false)} disabled={isDeletingCustom} className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700">Keep it</button><button type="button" onClick={() => void handleDeleteCustom()} disabled={isDeletingCustom} className="rounded-full bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{isDeletingCustom ? "Deleting…" : "Delete"}</button></div></div>}
    </div></div>}
  </div>;
}
