"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";
import { TagPeopleInput, type TaggedUser } from "@/components/ui/tag-people-input";
import type {
  DestinationDto,
  TravelPhotoOwnerDto,
  TravelStatsDto,
  TravelTripOwnerDto,
  UserDestinationDto,
} from "@/lib/validation/travel-trip";
import type { LegacyTripPhotoOwnerDto } from "@/services/travel-trip.service";

type DraftAsset = { id: string; originalFileName: string; thumbnailUrl: string | null };
type Tab = "trips" | "photos" | "places";
type ComposerState =
  | { kind: "create" }
  | { kind: "trip"; trip: TravelTripOwnerDto }
  | { kind: "photo"; photo: TravelPhotoOwnerDto }
  | { kind: "destination" }
  | { kind: "draft"; assetId: string };
type NewFile = { id: string; file: File; previewUrl: string; progress: number; state: "selected" | "uploading" | "ready" | "failed"; assetId?: string; error?: string };
type PhotoDetail = { caption: string; location: string; tags: TaggedUser[] };

const MAX_PER_TRIP = 5;
const accepted = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function requestError(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body) {
    const error = body.error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  }
  return fallback;
}

async function json(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...init });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(requestError(body, "The request could not be completed."));
  return body;
}

function dateValue(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function TravelMemoriesManager() {
  const [tab, setTab] = useState<Tab>("trips");
  const [stats, setStats] = useState<TravelStatsDto | null>(null);
  const [trips, setTrips] = useState<TravelTripOwnerDto[]>([]);
  const [photos, setPhotos] = useState<TravelPhotoOwnerDto[]>([]);
  const [legacy, setLegacy] = useState<LegacyTripPhotoOwnerDto[]>([]);
  const [drafts, setDrafts] = useState<DraftAsset[]>([]);
  const [places, setPlaces] = useState<UserDestinationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [photoFilter, setPhotoFilter] = useState<"all" | "album" | "draft" | "legacy">("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResult, tripResult, photoResult, draftResult, placeResult] = await Promise.all([
        json("/api/v1/travel-profiles/me/stats"),
        json("/api/v1/travel-trips?limit=50"),
        json("/api/v1/travel-trips/photos?limit=50"),
        json("/api/v1/travel-media"),
        json("/api/v1/travel-profiles/me/destinations"),
      ]);
      setStats(statsResult.stats || null);
      setTrips(tripResult.trips || []);
      setPhotos(photoResult.photos || []);
      setLegacy(photoResult.legacyPhotos || []);
      setDrafts(draftResult.assets || []);
      setPlaces(placeResult.destinations || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load your travel memories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  useEffect(() => {
    window.requestAnimationFrame(() => window.scrollTo(0, 0));
  }, []);

  const deleteTrip = async (trip: TravelTripOwnerDto) => {
    if (!window.confirm(`Delete “${trip.title}”? Attached photos remain private drafts.`)) return;
    try {
      await json(`/api/v1/travel-trips/${trip.id}`, { method: "DELETE" });
      toast.success("Trip album deleted.");
      await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete trip."); }
  };
  const removePlace = async (place: UserDestinationDto) => {
    if (!place.selfDeclared) return;
    if (!window.confirm(`Remove ${place.name} from your self-declared places?`)) return;
    try {
      const result = await json(`/api/v1/travel-profiles/me/destinations/${place.id}`, { method: "DELETE" });
      toast.success(result.preservedVerifiedBooking ? "The verified booking record was preserved." : "Destination removed.");
      await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not remove destination."); }
  };

  const totalPhotos = photos.length + drafts.length + legacy.length;
  const photoGroups = {
    album: photos,
    draft: drafts,
    legacy,
  };

  return (
    <section className="space-y-6" aria-labelledby="travel-memories-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id="travel-memories-title" className="text-lg font-bold text-zinc-950">My Travel Memories</h3>
          <p className="text-xs text-zinc-500">Manage your trips, photos, and visited places together.</p>
        </div>
        <button type="button" onClick={() => setComposer({ kind: "create" })} className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800">
          + Create Travel Memory
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Verified Trips", stats?.verifiedTrips], ["Travel Albums", stats?.travelAlbums], ["Visited Cities", stats?.visitedCities], ["Visited Countries", stats?.visitedCountries], ["Photos", totalPhotos],
        ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xs"><p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 text-2xl font-bold text-zinc-950">{loading ? "—" : value ?? 0}</p></div>)}
      </div>

      <div className="flex gap-2 border-b border-zinc-200" role="tablist" aria-label="Travel memories sections">
        {([ ["trips", "My Trips"], ["photos", `All Photos (${totalPhotos})`], ["places", "Visited Places"] ] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`border-b-2 px-3 py-2 text-xs font-semibold transition ${tab === id ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}>{label}</button>)}
      </div>

      {tab === "trips" && <div>
        {loading ? <MemorySkeleton /> : trips.length === 0 ? <EmptyState title="No travel albums yet" detail="Create an empty album, add a destination, or upload photos from one place." action={() => setComposer({ kind: "create" })} /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{trips.map((trip) => <article key={trip.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"><div className="relative aspect-video bg-zinc-100">{trip.coverThumbnailUrl ? <Image src={trip.coverThumbnailUrl} alt={trip.title} fill unoptimized className="object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-zinc-400">No cover selected</span>}<span className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">{trip.photoCount}/5 photos</span></div><div className="space-y-1 p-4"><h4 className="font-bold text-zinc-950">{trip.title}</h4><p className="text-xs text-zinc-600">{trip.destination ? `${trip.destination.name}, ${trip.destination.countryName}` : "No destination selected"}</p><p className="text-[11px] text-zinc-500">{dateValue(trip.startedAt) || "No dates"}{trip.endedAt ? ` – ${dateValue(trip.endedAt)}` : ""}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setComposer({ kind: "trip", trip })} className="rounded-full border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold">Edit trip / manage photos</button><button type="button" onClick={() => void deleteTrip(trip)} className="rounded-full px-2 py-1.5 text-[11px] font-semibold text-rose-700">Delete</button></div></div></article>)}</div>}
      </div>}

      {tab === "photos" && <div className="space-y-4">
        <div className="flex flex-wrap gap-2">{(["all", "album", "draft", "legacy"] as const).map((filter) => <button type="button" key={filter} onClick={() => setPhotoFilter(filter)} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${photoFilter === filter ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-700"}`}>{filter === "album" ? "Album photos" : filter === "draft" ? "Private drafts" : filter === "legacy" ? "Legacy photos" : "All"}</button>)}</div>
        {loading ? <MemorySkeleton /> : <div className="space-y-6">
          {(photoFilter === "all" || photoFilter === "album") && photoGroups.album.length > 0 && <PhotoSection title="Album photos" count={photoGroups.album.length}>{photoGroups.album.map((photo) => <PhotoTile key={photo.id} src={photo.thumbnailUrl} label={photo.caption || photo.tripTitle || "Album photo"} badge={photo.tripTitle || "Album"} action="Edit" onAction={() => setComposer({ kind: "photo", photo })} />)}</PhotoSection>}
          {(photoFilter === "all" || photoFilter === "draft") && photoGroups.draft.length > 0 && <PhotoSection title="Private drafts" count={photoGroups.draft.length} description="Ready uploads stay private until you attach them to an album.">{photoGroups.draft.map((asset) => <PhotoTile key={asset.id} src={asset.thumbnailUrl} label={asset.originalFileName} badge="Private draft" action="Add to trip" onAction={() => setComposer({ kind: "draft", assetId: asset.id })} />)}</PhotoSection>}
          {(photoFilter === "all" || photoFilter === "legacy") && photoGroups.legacy.length > 0 && <PhotoSection title="Legacy trip photos" count={photoGroups.legacy.length} description="Historical photos remain separate from secure album media and are not automatically published.">{photoGroups.legacy.map((photo) => <PhotoTile key={photo.id} src={photo.url} label={photo.caption || "Legacy trip photo"} badge="Legacy" />)}</PhotoSection>}
          {totalPhotos === 0 && <EmptyState title="No travel photos yet" detail="Create one memory to upload private photos or start an album." action={() => setComposer({ kind: "create" })} />}
        </div>}
      </div>}

      {tab === "places" && <div>{loading ? <MemorySkeleton /> : places.length === 0 ? <EmptyState title="No visited places yet" detail="Add a place manually, or completed Homyz stays will appear here automatically." action={() => setComposer({ kind: "destination" })} /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{places.map((place) => <article key={place.id} className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><h4 className="font-bold text-sm text-zinc-950">{place.name}</h4><p className="mt-1 text-xs text-zinc-600">{place.countryName}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${place.isVerified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{place.isVerified ? "Verified stay" : "Self-declared"}</span></div><p className="mt-3 text-[11px] text-zinc-500">{place.tripsCount} album{place.tripsCount === 1 ? "" : "s"} · {place.activeEvidenceCount} evidence</p><div className="mt-3 flex gap-2">{place.selfDeclared && <button type="button" onClick={() => void removePlace(place)} className="text-[11px] font-semibold text-rose-700">Remove self-declaration</button>}{!place.selfDeclared && <span className="text-[11px] text-zinc-500">Booking-backed stays are preserved</span>}</div></article>)}</div>}</div>}

      {composer && <TravelMemoryComposer state={composer} trips={trips} drafts={drafts} onClose={() => setComposer(null)} onSaved={async () => { setComposer(null); await refresh(); }} />}
    </section>
  );
}

function MemorySkeleton() { return <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((key) => <div key={key} className="h-36 animate-pulse rounded-2xl bg-zinc-100" />)}</div>; }
function EmptyState({ title, detail, action }: { title: string; detail: string; action: () => void }) { return <div className="rounded-3xl border-2 border-dashed border-zinc-200 px-6 py-12 text-center"><h4 className="font-bold text-zinc-950">{title}</h4><p className="mx-auto mt-2 max-w-md text-xs text-zinc-500">{detail}</p><button type="button" onClick={action} className="mt-4 rounded-full bg-[#FCDF9C] px-4 py-2 text-xs font-semibold text-zinc-950">Create Travel Memory</button></div>; }
function PhotoSection({ title, count, description, children }: { title: string; count: number; description?: string; children: ReactNode }) { return <section><h4 className="text-sm font-bold text-zinc-950">{title} <span className="text-zinc-400">({count})</span></h4>{description && <p className="mt-1 mb-3 text-[11px] text-zinc-500">{description}</p>}<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div></section>; }
function PhotoTile({ src, label, badge, action, onAction }: { src: string | null; label: string; badge: string; action?: string; onAction?: () => void }) { return <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"><div className="relative aspect-square bg-zinc-100">{src ? <Image src={src} alt={label} fill unoptimized className="object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-zinc-400">Preview unavailable</span>}<span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[9px] font-semibold text-white">{badge}</span></div><div className="flex items-center justify-between gap-2 p-2"><p className="truncate text-[11px] text-zinc-600">{label}</p>{action && <button type="button" onClick={onAction} className="shrink-0 text-[10px] font-semibold text-zinc-950 underline">{action}</button>}</div></article>; }

function TravelMemoryComposer({ state, trips, drafts, onClose, onSaved }: { state: ComposerState; trips: TravelTripOwnerDto[]; drafts: DraftAsset[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [step, setStep] = useState(state.kind === "destination" ? 1 : 0);
  const [tripId, setTripId] = useState(state.kind === "trip" ? state.trip.id : "new");
  const [title, setTitle] = useState(state.kind === "trip" ? state.trip.title : "");
  const [description, setDescription] = useState(state.kind === "trip" ? state.trip.description || "" : "");
  const [startedAt, setStartedAt] = useState(state.kind === "trip" ? dateValue(state.trip.startedAt) : "");
  const [endedAt, setEndedAt] = useState(state.kind === "trip" ? dateValue(state.trip.endedAt) : "");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [destinationResults, setDestinationResults] = useState<DestinationDto[]>([]);
  const [destination, setDestination] = useState<DestinationDto | null>(state.kind === "trip" ? state.trip.destination : null);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [activeDestinationIndex, setActiveDestinationIndex] = useState(-1);
  const [assetIds, setAssetIds] = useState<string[]>(state.kind === "draft" ? [state.assetId] : []);
  const [newFiles, setNewFiles] = useState<NewFile[]>([]);
  const [details, setDetails] = useState<Record<string, PhotoDetail>>(
    state.kind === "photo"
      ? {
          [state.photo.id]: {
            caption: state.photo.caption || "",
            location: state.photo.location || "",
            tags: (state.photo.tags || []).map((tag) => ({
              id: tag.user.id,
              name: tag.user.name,
              image: tag.user.image,
              email: null,
            })),
          },
        }
      : {},
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef<string[]>([]);
  const destinationRequest = useRef<AbortController | null>(null);

  const selectedTrip = trips.find((trip) => trip.id === tripId);
  const selectedCount = assetIds.length + newFiles.length;
  const remaining = tripId !== "new" ? Math.max(0, MAX_PER_TRIP - (selectedTrip?.photoCount || 0)) : MAX_PER_TRIP;
  const currentDetail = (key: string) => details[key] || { caption: "", location: "", tags: [] };
  const setDetail = (key: string, next: Partial<PhotoDetail>) => setDetails((previous) => ({ ...previous, [key]: { ...currentDetail(key), ...next } }));

  useEffect(() => () => { previewUrls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  useEffect(() => {
    const query = destinationQuery.trim();
    destinationRequest.current?.abort();
    if (query.length < 2) return;
    const controller = new AbortController();
    destinationRequest.current = controller;
    const timer = window.setTimeout(async () => {
      setDestinationLoading(true);
      try {
        const response = await fetch(`/api/v1/travel-destinations/search?q=${encodeURIComponent(query)}`, { credentials: "include", signal: controller.signal });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(requestError(body, "Could not search destinations."));
        if (controller.signal.aborted) return;
        const unique = new Map<string, DestinationDto>();
        for (const item of body?.destinations || []) unique.set(item.id, item);
        setDestinationResults([...unique.values()]);
        setActiveDestinationIndex(-1);
      } catch (searchError) {
        if (!controller.signal.aborted) {
          setDestinationResults([]);
          setError(searchError instanceof Error ? searchError.message : "Could not search destinations.");
        }
      } finally {
        if (!controller.signal.aborted) setDestinationLoading(false);
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [destinationQuery]);

  const addFiles = (list: FileList | File[]) => {
    const available = MAX_PER_TRIP - selectedCount;
    const additions: NewFile[] = [];
    for (const file of Array.from(list).slice(0, available)) {
      if (!accepted.has(file.type) || file.size > 10 * 1024 * 1024) { toast.error(`${file.name} must be JPEG, PNG, WebP, or AVIF and no larger than 10 MB.`); continue; }
      const previewUrl = URL.createObjectURL(file); previewUrls.current.push(previewUrl);
      additions.push({ id: crypto.randomUUID(), file, previewUrl, progress: 0, state: "selected" });
    }
    setNewFiles((previous) => [...previous, ...additions]);
  };
  const uploadFile = async (item: NewFile): Promise<string | null> => {
    setNewFiles((previous) => previous.map((candidate) => candidate.id === item.id ? { ...candidate, state: "uploading", progress: 0, error: undefined } : candidate));
    try {
      const session = await json("/api/v1/travel-media/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: item.file.name, mimeType: item.file.type, size: item.file.size, mediaType: "TRAVEL_PHOTO" }) });
      const upload = session.upload as { id: string; assetId: string; uploadUrl: string };
      await new Promise<void>((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open("POST", upload.uploadUrl); xhr.withCredentials = true; xhr.upload.onprogress = (event) => { if (event.lengthComputable) setNewFiles((previous) => previous.map((candidate) => candidate.id === item.id ? { ...candidate, progress: Math.round((event.loaded / event.total) * 100) } : candidate)); }; xhr.onerror = () => reject(new Error("Network interruption during upload.")); xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("File upload failed.")); const form = new FormData(); form.append("file", item.file); xhr.send(form); });
      await json(`/api/v1/travel-media/uploads/${upload.id}/finalize`, { method: "POST" });
      for (let attempt = 0; attempt < 80; attempt += 1) { await new Promise((resolve) => window.setTimeout(resolve, 650)); const check = await json(`/api/v1/travel-media/uploads/${upload.id}`); if (check.upload?.status === "READY") { setNewFiles((previous) => previous.map((candidate) => candidate.id === item.id ? { ...candidate, state: "ready", progress: 100, assetId: upload.assetId } : candidate)); return upload.assetId; } if (["FAILED", "CANCELLED"].includes(check.upload?.status)) throw new Error(check.upload?.failureReason || "Image processing failed."); }
      throw new Error("Image processing is taking longer than expected.");
    } catch (uploadError) { const message = uploadError instanceof Error ? uploadError.message : "Upload failed."; setNewFiles((previous) => previous.map((candidate) => candidate.id === item.id ? { ...candidate, state: "failed", error: message } : candidate)); return null; }
  };
  const saveDrafts = async () => {
    setSaving(true); setError(null);
    try {
      await Promise.all(newFiles.filter((file) => file.state === "selected" || file.state === "failed").map(uploadFile));
      toast.success("Ready uploads were saved as private drafts.");
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save photo drafts.");
    } finally {
      setSaving(false);
    }
  };
  const resolveSelectedDestination = async (): Promise<DestinationDto | null> => {
    if (!destination || !destination.id.startsWith("temp-")) return destination;

    // Search results from the global dataset are virtual until selected. Reuse the
    // existing self-declared destination flow to persist its canonical record.
    const result = await json("/api/v1/travel-profiles/me/destinations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: destination.name,
        countryCode: destination.countryCode,
        countryName: destination.countryName,
        regionName: destination.regionName,
        regionCode: destination.regionCode,
        latitude: destination.latitude,
        longitude: destination.longitude,
        providerPlaceId: destination.providerPlaceId,
      }),
    });

    return { ...destination, id: result.destination.destinationId };
  };
  const save = async () => {
    setError(null);
    if (state.kind === "photo") {
      setSaving(true);
      try {
        const detail = currentDetail(state.photo.id);
        await json(`/api/v1/travel-trips/${state.photo.tripId}/photos/${state.photo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caption: detail.caption || null, location: detail.location || null }) });
        const selectedUserIds = new Set(detail.tags.map((tag) => tag.id));
        for (const tag of state.photo.tags || []) {
          if (!selectedUserIds.has(tag.user.id)) await json(`/api/v1/travel-trips/${state.photo.tripId}/photos/${state.photo.id}/tags/${tag.id}`, { method: "DELETE" });
        }
        const existingUserIds = new Set((state.photo.tags || []).map((tag) => tag.user.id));
        for (const user of detail.tags) {
          if (!existingUserIds.has(user.id)) await json(`/api/v1/travel-trips/${state.photo.tripId}/photos/${state.photo.id}/tags`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taggedUserId: user.id }) });
        }
        toast.success("Photo details updated."); await onSaved();
      } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not update photo."); } finally { setSaving(false); }
      return;
    }
    if (state.kind === "destination" && !destination) { setError("Select a destination before saving."); return; }
    if (tripId === "new" && state.kind !== "destination" && !title.trim()) { setError("A trip title is required when creating an album."); return; }
    if (destinationQuery.trim() && !destination) { setError("Choose a destination from the search results or clear the field."); return; }
    if (startedAt && endedAt && new Date(startedAt) > new Date(endedAt)) { setError("Start date cannot be after end date."); return; }
    if (selectedCount > remaining) { setError(`This trip only has ${remaining} available photo slot${remaining === 1 ? "" : "s"}.`); return; }
    setSaving(true);
    try {
      if (state.kind === "destination" && destination) {
        await json("/api/v1/travel-profiles/me/destinations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: destination.name, countryCode: destination.countryCode, countryName: destination.countryName, regionName: destination.regionName, regionCode: destination.regionCode, latitude: destination.latitude, longitude: destination.longitude, providerPlaceId: destination.providerPlaceId, firstVisitedAt: startedAt || null, lastVisitedAt: endedAt || null }) });
        toast.success("Self-declared destination added."); await onSaved(); return;
      }
      const resolvedDestination = await resolveSelectedDestination();
      const destinationId = resolvedDestination?.id || null;
      let finalTripId = tripId;
      if (tripId === "new") { const created = await json("/api/v1/travel-trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), description: description.trim() || null, destinationId, startedAt: startedAt || null, endedAt: endedAt || null }) }); finalTripId = created.trip.id; }
      else if (state.kind === "trip") { await json(`/api/v1/travel-trips/${tripId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), description: description.trim() || null, destinationId, startedAt: startedAt || null, endedAt: endedAt || null }) }); }
      const uploaded = await Promise.all(newFiles.filter((file) => file.state === "selected" || file.state === "failed").map(uploadFile));
      const allAssetIds = [...assetIds, ...uploaded.filter((id): id is string => Boolean(id))];
      const attached: Array<{ photoId: string }> = [];
      for (const assetId of allAssetIds) {
        const result = await json(`/api/v1/travel-trips/${finalTripId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaAssetId: assetId, destinationId }),
        });
        attached.push({ photoId: result.photo.id });
      }
      // New albums receive a useful cover without asking for per-photo decisions.
      // Existing albums keep their selected cover intact.
      if (tripId === "new" && attached[0]) {
        await json(`/api/v1/travel-trips/${finalTripId}/cover`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId: attached[0].photoId }) });
      }
      toast.success("Travel memory saved."); await onSaved();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save travel memory."); } finally { setSaving(false); }
  };
  const hasUnsavedCreation = state.kind !== "photo" && state.kind !== "trip" && Boolean(
    assetIds.length || newFiles.length || title.trim() || description.trim() || startedAt || endedAt || destination,
  );
  const closeComposer = () => {
    if (hasUnsavedCreation && !window.confirm("Discard this unfinished travel memory?")) return;
    onClose();
  };

  return <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-xs"><section role="dialog" aria-modal="true" aria-labelledby="travel-memory-composer-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4"><div><h2 id="travel-memory-composer-title" className="font-bold text-zinc-950">{state.kind === "photo" ? "Edit photo details" : "Create Travel Memory"}</h2><p className="mt-0.5 text-xs text-zinc-500">{state.kind === "photo" ? "Update your photo without opening another workflow." : "Trips, photos, and places in one guided flow."}</p></div><button type="button" onClick={closeComposer} disabled={saving} className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100" aria-label="Close composer">×</button></header>
    {state.kind !== "photo" && <div className="flex gap-2 border-b border-zinc-100 px-5 py-3">{["1. Photos", "2. Trip & place", "3. Review & save"].map((label, index) => <button type="button" key={label} onClick={() => setStep(index)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${step === index ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-500"}`}>{label}</button>)}</div>}
    <div className="min-h-0 flex-1 overflow-y-auto p-5">{error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      {state.kind === "photo" ? <PhotoDetailEditor detail={currentDetail(state.photo.id)} onChange={(next) => setDetail(state.photo.id, next)} /> : <>{step === 0 && <div className="space-y-5"><div className="rounded-2xl border border-dashed border-zinc-300 p-5 text-center" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}><input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(event) => event.target.files && addFiles(event.target.files)} /><p className="font-semibold text-sm text-zinc-950">Add photos</p><p className="mt-1 text-xs text-zinc-500">Drop images here or choose files. JPEG, PNG, WebP, AVIF up to 10 MB.</p><button type="button" onClick={() => inputRef.current?.click()} className="mt-3 rounded-full bg-[#FCDF9C] px-4 py-2 text-xs font-semibold">Choose files</button></div><div><p className="mb-2 text-xs font-semibold text-zinc-800">Use existing private drafts</p>{drafts.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{drafts.map((asset) => <button type="button" key={asset.id} onClick={() => setAssetIds((previous) => previous.includes(asset.id) ? previous.filter((id) => id !== asset.id) : [...previous, asset.id].slice(0, MAX_PER_TRIP))} className={`relative overflow-hidden rounded-xl border ${assetIds.includes(asset.id) ? "border-amber-500 ring-2 ring-amber-200" : "border-zinc-200"}`}>{asset.thumbnailUrl ? <Image src={asset.thumbnailUrl} alt={asset.originalFileName} width={160} height={160} unoptimized className="aspect-square object-cover" /> : <span className="flex aspect-square items-center justify-center text-[10px] text-zinc-500">No preview</span>}</button>)}</div> : <p className="text-xs text-zinc-500">No private drafts are ready.</p>}</div>{newFiles.length > 0 && <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{newFiles.map((file) => <div key={file.id} className="relative overflow-hidden rounded-xl bg-zinc-100"><Image src={file.previewUrl} alt={file.file.name} width={160} height={160} unoptimized className="aspect-square object-cover" /><button type="button" onClick={() => setNewFiles((previous) => previous.filter((item) => item.id !== file.id))} className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white">×</button>{file.state === "uploading" && <span className="absolute inset-x-0 bottom-0 bg-black/65 p-1 text-center text-[10px] text-white">{file.progress}%</span>}</div>)}</div>}</div>}
      {step === 1 && <div className="space-y-4">{state.kind !== "destination" && <div><label className="text-xs font-semibold">Album</label><select value={tripId} onChange={(event) => { const nextTripId = event.target.value; const trip = trips.find((item) => item.id === nextTripId); setTripId(nextTripId); if (trip) { setTitle(trip.title); setDescription(trip.description || ""); setStartedAt(dateValue(trip.startedAt)); setEndedAt(dateValue(trip.endedAt)); setDestination(trip.destination); setDestinationQuery(trip.destination ? `${trip.destination.name}, ${trip.destination.countryName}` : ""); } }} className="mt-1 w-full rounded-xl border border-zinc-200 p-3 text-sm"><option value="new">Create a new album</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title} ({trip.photoCount}/5)</option>)}</select></div>}{state.kind !== "destination" && tripId === "new" && <Field label="Trip title"><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" placeholder="e.g. Summer in Dubai" /></Field>}<DestinationAutocomplete destination={destination} query={destinationQuery} results={destinationResults} open={destinationOpen} loading={destinationLoading} activeIndex={activeDestinationIndex} onOpen={() => setDestinationOpen(true)} onClear={() => { setDestination(null); setDestinationQuery(""); setDestinationResults([]); setDestinationLoading(false); setDestinationOpen(true); }} onChange={(value) => { setDestination(null); setDestinationQuery(value); setDestinationResults([]); setDestinationLoading(false); setDestinationOpen(true); setActiveDestinationIndex(-1); setError(null); }} onSelect={(item) => { setDestination(item); setDestinationQuery(`${item.name}, ${item.countryName}`); setDestinationResults([]); setDestinationOpen(false); setActiveDestinationIndex(-1); }} onKeyDown={(event) => { if (event.key === "Escape") { setDestinationOpen(false); return; } if (event.key === "ArrowDown") { event.preventDefault(); setDestinationOpen(true); setActiveDestinationIndex((index) => Math.min(index + 1, destinationResults.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setActiveDestinationIndex((index) => Math.max(index - 1, 0)); } if (event.key === "Enter" && activeDestinationIndex >= 0 && destinationResults[activeDestinationIndex]) { event.preventDefault(); const item = destinationResults[activeDestinationIndex]; setDestination(item); setDestinationQuery(`${item.name}, ${item.countryName}`); setDestinationResults([]); setDestinationOpen(false); } }} /><div className="grid gap-3 sm:grid-cols-2"><Field label="Start date"><input type="date" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" /></Field><Field label="End date"><input type="date" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" /></Field></div>{state.kind !== "destination" && tripId === "new" && <Field label="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} className="min-h-20 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" placeholder="Optional travel story" /></Field>}{state.kind === "destination" && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">This records a self-declared place. It does not verify a stay or create an album.</p>}</div>}
      {step === 2 && <div className="space-y-3 rounded-2xl border border-zinc-200 p-4 text-sm"><p><strong>Album:</strong> {state.kind === "destination" ? "No album — destination only" : tripId === "new" ? title || "Untitled album" : selectedTrip?.title}</p>{destination && <p><strong>Destination:</strong> {destination.name}{destination.regionName ? `, ${destination.regionName}` : ""}, {destination.countryName}</p>}{(startedAt || endedAt) && <p><strong>Dates:</strong> {startedAt || "—"}{endedAt ? ` – ${endedAt}` : ""}</p>}{description && <p><strong>Description:</strong> {description}</p>}<p><strong>Photos:</strong> {selectedCount} selected · {remaining} available slots</p>{selectedCount > 0 && <div className="grid grid-cols-5 gap-2">{assetIds.map((id) => { const asset = drafts.find((item) => item.id === id); return asset?.thumbnailUrl ? <Image key={id} src={asset.thumbnailUrl} alt={asset.originalFileName} width={80} height={80} unoptimized className="aspect-square rounded-lg object-cover" /> : null; })}{newFiles.map((file) => <Image key={file.id} src={file.previewUrl} alt={file.file.name} width={80} height={80} unoptimized className="aspect-square rounded-lg object-cover" />)}</div>}<p><strong>Visibility:</strong> Private draft. Nothing is published by this flow.</p>{newFiles.some((file) => file.state === "failed") && <p className="text-rose-700">Some uploads failed. Retry by saving again; completed assets will not be duplicated.</p>}</div>}</>}</div>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-5 py-4"><button type="button" disabled={saving} onClick={() => step > 0 ? setStep(step - 1) : closeComposer()} className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold">{step > 0 && state.kind !== "photo" ? "Back" : "Cancel"}</button><div className="flex gap-2">{state.kind !== "photo" && step === 0 && newFiles.length > 0 && <button type="button" disabled={saving} onClick={() => void saveDrafts()} className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold">Save as Draft</button>}{state.kind !== "photo" && step < 2 ? <button type="button" onClick={() => setStep(step + 1)} className="rounded-full bg-[#FCDF9C] px-4 py-2 text-xs font-semibold">Continue</button> : <button type="button" disabled={saving} onClick={() => void save()} className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : state.kind === "photo" ? "Save changes" : "Save Travel Memory"}</button>}</div></footer>
  </section></ModalOverlay>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs font-semibold text-zinc-800"><span>{label}</span><div className="mt-1">{children}</div></label>; }
function DestinationAutocomplete({ destination, query, results, open, loading, activeIndex, onOpen, onClear, onChange, onSelect, onKeyDown }: { destination: DestinationDto | null; query: string; results: DestinationDto[]; open: boolean; loading: boolean; activeIndex: number; onOpen: () => void; onClear: () => void; onChange: (value: string) => void; onSelect: (item: DestinationDto) => void; onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void }) { const listId = "travel-memory-destination-results"; const showResults = open && !destination && query.trim().length >= 2; return <div className="relative"><label htmlFor="travel-memory-destination" className="block text-xs font-semibold text-zinc-800">Destination</label><div className="relative mt-1"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">⌖</span><input id="travel-memory-destination" role="combobox" aria-autocomplete="list" aria-controls={listId} aria-expanded={showResults} aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} value={query} onFocus={onOpen} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} className="w-full rounded-xl border border-zinc-200 py-2 pl-9 pr-10 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100" placeholder="Search city or country..." />{destination && <button type="button" onClick={onClear} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 hover:bg-zinc-100" aria-label="Clear destination">×</button>}{loading && <span className="absolute right-3 top-1/2 size-3 -translate-y-1/2 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" aria-label="Searching destinations" />}</div>{showResults && <div id={listId} role="listbox" className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">{results.map((item, index) => <button type="button" key={item.id} id={`${listId}-${index}`} role="option" aria-selected={activeIndex === index} onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(item)} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs ${activeIndex === index ? "bg-amber-50" : "hover:bg-zinc-50"}`}><span className="text-base text-zinc-400">⌖</span><span><span className="block font-semibold text-zinc-900">{item.name}</span><span className="block text-zinc-500">{[item.regionName, item.countryName].filter(Boolean).join(", ")}</span></span></button>)}{!loading && results.length === 0 && <p className="px-3 py-3 text-xs text-zinc-500">No matching destinations found.</p>}</div>}{open && !destination && query.trim().length < 2 && <p className="mt-1 text-[11px] text-zinc-500">Type at least two characters to search real destinations.</p>}</div>; }
function PhotoDetailEditor({ detail, onChange, index, cover, onCover }: { detail: PhotoDetail; onChange: (next: Partial<PhotoDetail>) => void; index?: number; cover?: boolean; onCover?: () => void }) { return <div className="rounded-2xl border border-zinc-200 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold text-zinc-950">{index === undefined ? "Photo details" : `Photo ${index + 1}`}</p>{onCover && <button type="button" onClick={onCover} className={`rounded-full px-3 py-1 text-[10px] font-semibold ${cover ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-700"}`}>{cover ? "Album cover" : "Use as cover"}</button>}</div><div className="grid gap-3 sm:grid-cols-2"><Field label="Caption"><input value={detail.caption} onChange={(event) => onChange({ caption: event.target.value })} maxLength={500} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" placeholder="Add a caption" /></Field><Field label="Photo location"><input value={detail.location} onChange={(event) => onChange({ location: event.target.value })} maxLength={150} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" placeholder="Where was this taken?" /></Field></div><div className="mt-3"><TagPeopleInput selectedUsers={detail.tags} onChange={(tags) => onChange({ tags })} /></div></div>; }
