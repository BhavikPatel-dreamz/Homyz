"use client";

import { useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { CANONICAL_AMENITIES } from "@/lib/constants/amenities";
import { LANGUAGE_OPTIONS } from "@/lib/utils/language-options";

export type ListingFilterValues = {
  minPrice?: number;
  maxPrice?: number;
  propertyTypes: string[];
  listingType: "" | "ROOM" | "ENTIRE_PLACE";
  amenities: string[];
  accessibility: string[];
  languages: string[];
  bedrooms: number;
  beds: number;
  bathrooms: number;
  instantBook: boolean;
  featured: boolean;
  pets: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onApply: (filters: ListingFilterValues) => void;
  initialFilters: ListingFilterValues;
  availablePriceRange?: { min: number; max: number };
  currencySymbol: string;
  baseSearchParams: string;
  currentTotal: number;
  isApplying?: boolean;
};

const ADVANCED_FILTER_KEYS = [
  "minPrice", "maxPrice", "propertyType", "propertyTypes", "listingType", "amenities",
  "accessibility", "languages", "bedrooms", "beds", "bathrooms", "instantBook", "featured", "pets",
];

const amenityGroups = [
  { title: "Popular", ids: ["wifi", "tv", "washer", "kitchen", "pool", "hair_dryer"] },
  { title: "Essentials", ids: ["dryer", "air_conditioning", "heating", "workspace", "iron"] },
  { title: "Features", ids: ["hot_tub", "free_parking", "ev_charger", "gym", "bbq_grill", "indoor_fireplace"] },
];

const PRIMARY_PROPERTY_TYPES = [
  { id: "HOUSE", label: "House", icon: "house" },
  { id: "APARTMENT", label: "Flat", icon: "flat" },
  { id: "GUEST_HOUSE", label: "Guest house", icon: "guestHouse" },
  { id: "BOUTIQUE_HOTEL", label: "Hotel", icon: "hotel" },
] as const;

const FILTER_LANGUAGE_OPTIONS = LANGUAGE_OPTIONS;

function copyFilters(filters: ListingFilterValues): ListingFilterValues {
  return { ...filters, propertyTypes: [...filters.propertyTypes], amenities: [...filters.amenities], accessibility: [...filters.accessibility], languages: [...filters.languages] };
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function filterSignature(filters: ListingFilterValues) {
  return JSON.stringify({
    ...filters,
    propertyTypes: [...filters.propertyTypes].sort(),
    amenities: [...filters.amenities].sort(),
    accessibility: [...filters.accessibility].sort(),
    languages: [...filters.languages].sort(),
  });
}

function FilterPill({ active, children, ...props }: ComponentPropsWithoutRef<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 text-left text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 ${active ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-700"} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

function CounterRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4">
      <span className="text-sm text-zinc-800">{label}</span>
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0} aria-label={`Decrease ${label}`} className="flex size-7 items-center justify-center rounded-full bg-zinc-100 text-lg font-light text-zinc-700 transition hover:bg-zinc-200 disabled:text-zinc-300">−</button>
        <span className="min-w-7 text-center text-sm text-zinc-800">{value === 0 ? "Any" : value >= 8 ? "8+" : value}</span>
        <button type="button" onClick={() => onChange(Math.min(8, value + 1))} disabled={value >= 8} aria-label={`Increase ${label}`} className="flex size-7 items-center justify-center rounded-full bg-zinc-100 text-lg font-light text-zinc-700 transition hover:bg-zinc-200 disabled:text-zinc-300">+</button>
      </div>
    </div>
  );
}

function PropertyTypeIcon({ type }: { type: (typeof PRIMARY_PROPERTY_TYPES)[number]["icon"] }) {
  const shared = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, className: "size-5" };
  if (type === "flat") return <svg {...shared}><path d="M4 21V5h11v16M15 10h5v11M7 8h2m-2 4h2m-2 4h2m4-8h1m-1 4h1m-7 9v-3h4v3" /></svg>;
  if (type === "guestHouse") return <svg {...shared}><path d="M3 21h18M5 21V6h14v15M3 6h18M8 3v6m8-6v6M8 12h3m2 0h3m-8 4h3m2 0h3" /></svg>;
  if (type === "hotel") return <svg {...shared}><path d="M4 21V5h16v16M7 8h2m3 0h2m3 0h0M7 12h2m3 0h2m3 0h0M10 21v-4h4v4" /></svg>;
  return <svg {...shared}><path d="m3 11 9-8 9 8v10H3zM9 21v-6h6v6M8 10h.01M16 10h.01" /></svg>;
}

export function ListingFilterModal({ open, onClose, onApply, initialFilters, availablePriceRange, currencySymbol, baseSearchParams, currentTotal, isApplying = false }: Props) {
  const availableMin = Math.max(0, Math.round((availablePriceRange?.min ?? 0) / 100));
  const availableMax = Math.max(availableMin, Math.round((availablePriceRange?.max ?? 0) / 100));
  const hasPriceRange = availableMax > availableMin;
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useState(() => copyFilters(initialFilters));
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const [draftCount, setDraftCount] = useState<number | null>(null);
  const [isCounting, setIsCounting] = useState(false);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [open, onClose]);

  const normalisedDraft = useMemo(() => ({
    ...draft,
    minPrice: Math.min(Math.max(draft.minPrice ?? availableMin, availableMin), availableMax),
    maxPrice: Math.max(Math.min(draft.maxPrice ?? availableMax, availableMax), availableMin),
  }), [draft, availableMin, availableMax]);
  const normalisedInitialFilters = useMemo(() => ({
    ...initialFilters,
    minPrice: Math.min(Math.max(initialFilters.minPrice ?? availableMin, availableMin), availableMax),
    maxPrice: Math.max(Math.min(initialFilters.maxPrice ?? availableMax, availableMax), availableMin),
  }), [initialFilters, availableMin, availableMax]);
  const hasDraftChanges = filterSignature(normalisedDraft) !== filterSignature(normalisedInitialFilters);

  const clearAll = () => setDraft({
    minPrice: availableMin,
    maxPrice: availableMax,
    propertyTypes: [],
    listingType: "",
    amenities: [],
    accessibility: [],
    languages: [],
    bedrooms: 0,
    beds: 0,
    bathrooms: 0,
    instantBook: false,
    featured: false,
    pets: false,
  });

  useEffect(() => {
    if (!open || !hasDraftChanges) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams(baseSearchParams);
      ADVANCED_FILTER_KEYS.forEach((key) => params.delete(key));
      params.delete("page");
      params.set("page", "1");
      params.set("limit", "1");
      params.set("countOnly", "true");
      if (normalisedDraft.minPrice > availableMin) params.set("minPrice", String(normalisedDraft.minPrice * 100));
      if (normalisedDraft.maxPrice < availableMax) params.set("maxPrice", String(normalisedDraft.maxPrice * 100));
      if (normalisedDraft.propertyTypes.length) params.set("propertyTypes", normalisedDraft.propertyTypes.join(","));
      if (normalisedDraft.listingType) params.set("listingType", normalisedDraft.listingType);
      if (normalisedDraft.amenities.length) params.set("amenities", normalisedDraft.amenities.join(","));
      if (normalisedDraft.accessibility.length) params.set("accessibility", normalisedDraft.accessibility.join(","));
      if (normalisedDraft.languages.length) params.set("languages", normalisedDraft.languages.join(","));
      (["bedrooms", "beds", "bathrooms"] as const).forEach((key) => { if (normalisedDraft[key] > 0) params.set(key, String(normalisedDraft[key])); });
      if (normalisedDraft.instantBook) params.set("instantBook", "true");
      if (normalisedDraft.featured) params.set("featured", "true");
      if (normalisedDraft.pets) params.set("pets", "1");
      setIsCounting(true);
      try {
        const response = await fetch(`/api/v1/listings?${params}`, { credentials: "same-origin", signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json();
        setDraftCount(payload.pagination?.total ?? payload.total ?? 0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setDraftCount(null);
      } finally {
        setIsCounting(false);
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, hasDraftChanges, baseSearchParams, normalisedDraft, availableMin, availableMax]);

  if (!open) return null;
  const amenityById = new Map(CANONICAL_AMENITIES.map((amenity) => [amenity.id, amenity]));
  const extraAmenities = CANONICAL_AMENITIES.filter((amenity) => !amenityGroups.flatMap((group) => group.ids).includes(amenity.id) && amenity.category !== "accessibility");
  const accessibilityAmenities = CANONICAL_AMENITIES.filter((amenity) => amenity.category === "accessibility");
  const shownCount = hasDraftChanges ? (draftCount ?? currentTotal) : currentTotal;

  const updatePrice = (key: "minPrice" | "maxPrice", rawValue: string) => {
    if (rawValue === "") return setDraft((previous) => ({ ...previous, [key]: key === "minPrice" ? availableMin : availableMax }));
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    const bounded = Math.min(availableMax, Math.max(availableMin, Math.round(value)));
    setDraft((previous) => key === "minPrice"
      ? { ...previous, minPrice: Math.min(bounded, previous.maxPrice ?? availableMax) }
      : { ...previous, maxPrice: Math.max(bounded, previous.minPrice ?? availableMin) });
  };

  const propertyTypeLabels = new Map<string, string>(PRIMARY_PROPERTY_TYPES.map((type) => [type.id, type.label]));
  const languageLabels = new Map(FILTER_LANGUAGE_OPTIONS.map((language) => [language.id, language.name]));
  const selectedFilters: Array<{ id: string; label: string; clear: () => void }> = [];
  const priceChanged = normalisedDraft.minPrice > availableMin || normalisedDraft.maxPrice < availableMax;
  if (priceChanged) {
    const label = normalisedDraft.minPrice > availableMin && normalisedDraft.maxPrice < availableMax
      ? `${currencySymbol}${normalisedDraft.minPrice.toLocaleString()} – ${currencySymbol}${normalisedDraft.maxPrice.toLocaleString()}`
      : normalisedDraft.minPrice > availableMin
      ? `From ${currencySymbol}${normalisedDraft.minPrice.toLocaleString()}`
      : `Up to ${currencySymbol}${normalisedDraft.maxPrice.toLocaleString()}`;
    selectedFilters.push({ id: "price", label, clear: () => setDraft((previous) => ({ ...previous, minPrice: availableMin, maxPrice: availableMax })) });
  }
  if (normalisedDraft.listingType) selectedFilters.push({ id: "listingType", label: normalisedDraft.listingType === "ROOM" ? "Room" : "Entire home", clear: () => setDraft((previous) => ({ ...previous, listingType: "" })) });
  normalisedDraft.propertyTypes.forEach((type) => selectedFilters.push({ id: `type-${type}`, label: propertyTypeLabels.get(type) ?? type, clear: () => setDraft((previous) => ({ ...previous, propertyTypes: previous.propertyTypes.filter((item) => item !== type) })) }));
  (["bedrooms", "beds", "bathrooms"] as const).forEach((key) => {
    const value = normalisedDraft[key];
    if (value > 0) selectedFilters.push({ id: key, label: `${value >= 8 ? "8+" : value}+ ${key}`, clear: () => setDraft((previous) => ({ ...previous, [key]: 0 })) });
  });
  normalisedDraft.amenities.forEach((amenityId) => selectedFilters.push({ id: `amenity-${amenityId}`, label: amenityById.get(amenityId)?.label ?? amenityId, clear: () => setDraft((previous) => ({ ...previous, amenities: previous.amenities.filter((item) => item !== amenityId) })) }));
  normalisedDraft.accessibility.forEach((featureId) => selectedFilters.push({ id: `accessibility-${featureId}`, label: amenityById.get(featureId)?.label ?? featureId, clear: () => setDraft((previous) => ({ ...previous, accessibility: previous.accessibility.filter((item) => item !== featureId) })) }));
  normalisedDraft.languages.forEach((languageId) => selectedFilters.push({ id: `language-${languageId}`, label: languageLabels.get(languageId) ?? languageId, clear: () => setDraft((previous) => ({ ...previous, languages: previous.languages.filter((item) => item !== languageId) })) }));
  if (normalisedDraft.instantBook) selectedFilters.push({ id: "instantBook", label: "Instant Book", clear: () => setDraft((previous) => ({ ...previous, instantBook: false })) });
  if (normalisedDraft.pets) selectedFilters.push({ id: "pets", label: "Allows pets", clear: () => setDraft((previous) => ({ ...previous, pets: false })) });
  if (normalisedDraft.featured) selectedFilters.push({ id: "featured", label: "Guest favourite", clear: () => setDraft((previous) => ({ ...previous, featured: false })) });

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:px-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="listing-filter-title" className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-h-[88dvh] sm:rounded-[28px]">
        <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4 sm:px-6">
          <span className="size-10" aria-hidden="true" />
          <h2 id="listing-filter-title" className="text-base font-semibold text-zinc-950">Filters</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close filters" className="flex size-10 items-center justify-center rounded-full text-zinc-800 transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">✕</button>
        </header>
        {selectedFilters.length > 0 && (
          <section aria-label="Selected filters" className="shrink-0 border-b border-zinc-200 px-5 py-4 sm:px-6">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="text-sm font-semibold text-zinc-900">Selected</h3>
              <button type="button" onClick={clearAll} className="text-xs font-semibold underline underline-offset-2 hover:text-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">Clear all</button>
            </div>
            <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
              {selectedFilters.map((filter) => <button key={filter.id} type="button" onClick={filter.clear} aria-label={`Remove ${filter.label} filter`} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-zinc-950 px-3 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"><span>{filter.label}</span><span aria-hidden="true">×</span></button>)}
            </div>
          </section>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 sm:px-6">
          <div className="border-b border-zinc-200 py-7">
            <h3 className="mb-4 text-base font-semibold text-zinc-900">Type of place</h3>
            <div className="grid grid-cols-3 rounded-xl border border-zinc-300 p-1" role="radiogroup" aria-label="Type of place">
              {([ ["", "Any type"], ["ROOM", "Room"], ["ENTIRE_PLACE", "Entire home"] ] as const).map(([value, label]) => <button key={value || "any"} type="button" role="radio" aria-checked={draft.listingType === value} onClick={() => setDraft((previous) => ({ ...previous, listingType: value }))} className={`min-h-10 rounded-lg px-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 ${draft.listingType === value ? "border border-zinc-950 bg-white shadow-sm" : "border border-transparent hover:bg-zinc-50"}`}>{label}</button>)}
            </div>
          </div>

          <div className="border-b border-zinc-200 py-7">
            <h3 className="text-base font-semibold text-zinc-900">Price range</h3>
            <p className="mt-1 text-xs text-zinc-600">Nightly price, before taxes and fees</p>
            {hasPriceRange ? <>
              <div className="mt-7 h-14 border-b border-zinc-300" aria-hidden="true"><div className="flex h-full items-end gap-1">{Array.from({ length: 32 }, (_, index) => <span key={index} className="flex-1 rounded-t bg-zinc-300" style={{ height: `${18 + Math.round(70 * Math.sin((index / 31) * Math.PI))}%` }} />)}</div></div>
              <div className="relative mt-1 h-9">
                <div className="absolute top-4 h-1 rounded bg-zinc-200" style={{ left: 0, right: 0 }} />
                <div className="absolute top-4 h-1 rounded bg-zinc-950" style={{ left: `${((normalisedDraft.minPrice - availableMin) / (availableMax - availableMin)) * 100}%`, right: `${100 - ((normalisedDraft.maxPrice - availableMin) / (availableMax - availableMin)) * 100}%` }} />
                <input type="range" min={availableMin} max={availableMax} step={Math.max(1, Math.round((availableMax - availableMin) / 200))} value={normalisedDraft.minPrice} onChange={(event) => updatePrice("minPrice", event.target.value)} aria-label="Minimum price" className="absolute inset-0 z-10 h-9 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-300 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-zinc-300 [&::-moz-range-thumb]:bg-white" />
                <input type="range" min={availableMin} max={availableMax} step={Math.max(1, Math.round((availableMax - availableMin) / 200))} value={normalisedDraft.maxPrice} onChange={(event) => updatePrice("maxPrice", event.target.value)} aria-label="Maximum price" className="pointer-events-none absolute inset-0 z-20 h-9 w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-300 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-zinc-300 [&::-moz-range-thumb]:bg-white" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {([ ["minPrice", "Minimum"], ["maxPrice", "Maximum"] ] as const).map(([key, label]) => <label key={key} className="rounded-xl border border-zinc-300 px-3 py-2 focus-within:border-zinc-950 focus-within:ring-1 focus-within:ring-zinc-950"><span className="block text-[11px] font-medium text-zinc-500">{label}</span><span className="mt-0.5 flex items-center gap-1"><span className="text-sm text-zinc-500">{currencySymbol}</span><input inputMode="numeric" value={normalisedDraft[key]} onChange={(event) => updatePrice(key, event.target.value.replace(/[^0-9]/g, ""))} className="min-w-0 w-full bg-transparent text-sm font-semibold outline-none" /></span></label>)}
              </div>
            </> : <p className="mt-5 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">Price controls become available when matching homes have prices.</p>}
          </div>

          <div className="space-y-4 border-b border-zinc-200 py-7">
            <h2 className="mb-2 text-base font-semibold text-zinc-950">Rooms and beds</h2>
            <CounterRow label="Bedrooms" value={draft.bedrooms} onChange={(bedrooms) => setDraft((previous) => ({ ...previous, bedrooms }))} />
            <CounterRow label="Beds" value={draft.beds} onChange={(beds) => setDraft((previous) => ({ ...previous, beds }))} />
            <CounterRow label="Bathrooms" value={draft.bathrooms} onChange={(bathrooms) => setDraft((previous) => ({ ...previous, bathrooms }))} />
          </div>

          <div className="border-b border-zinc-200 py-7">
            <h2 className="mb-4 text-base font-semibold text-zinc-950">Property type</h2>
            <div className="flex flex-wrap gap-2">
              {PRIMARY_PROPERTY_TYPES.map((propertyType) => <button key={propertyType.id} type="button" aria-pressed={draft.propertyTypes.includes(propertyType.id)} onClick={() => setDraft((previous) => ({ ...previous, propertyTypes: toggle(previous.propertyTypes, propertyType.id) }))} className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 ${draft.propertyTypes.includes(propertyType.id) ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-700"}`}><PropertyTypeIcon type={propertyType.icon} />{propertyType.label}</button>)}
            </div>
          </div>

          <div className="border-b border-zinc-200 py-7">
            <h2 className="mb-5 text-lg font-semibold text-zinc-950">Amenities</h2>
            <div className="space-y-5">{amenityGroups.map((group) => <div key={group.title}><h3 className="mb-2.5 text-sm font-semibold text-zinc-800">{group.title}</h3><div className="flex flex-wrap gap-2">{group.ids.map((id) => amenityById.get(id)).filter(Boolean).map((amenity) => <FilterPill key={amenity!.id} active={draft.amenities.includes(amenity!.id)} onClick={() => setDraft((previous) => ({ ...previous, amenities: toggle(previous.amenities, amenity!.id) }))}><span aria-hidden="true">{amenity!.icon}</span>{amenity!.label}</FilterPill>)}</div></div>)}</div>
            {showAllAmenities && <div className="mt-5 flex flex-wrap gap-2">{extraAmenities.map((amenity) => <FilterPill key={amenity.id} active={draft.amenities.includes(amenity.id)} onClick={() => setDraft((previous) => ({ ...previous, amenities: toggle(previous.amenities, amenity.id) }))}><span aria-hidden="true">{amenity.icon}</span>{amenity.label}</FilterPill>)}</div>}
            <button type="button" onClick={() => setShowAllAmenities((value) => !value)} className="mt-5 text-sm font-semibold underline underline-offset-2 hover:text-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">{showAllAmenities ? "Show less" : "Show more"}</button>
          </div>

          <div className="border-b border-zinc-200 py-7">
            <h2 className="mb-4 text-lg font-semibold text-zinc-950">Booking options</h2>
            <div className="flex flex-wrap gap-2">
              <FilterPill active={draft.instantBook} onClick={() => setDraft((previous) => ({ ...previous, instantBook: !previous.instantBook }))}>⚡ Instant Book</FilterPill>
              <FilterPill active={draft.amenities.includes("self_check_in")} onClick={() => setDraft((previous) => ({ ...previous, amenities: toggle(previous.amenities, "self_check_in") }))}>🔑 Self check-in</FilterPill>
              <FilterPill active={draft.pets} onClick={() => setDraft((previous) => ({ ...previous, pets: !previous.pets }))}>🐾 Allows pets</FilterPill>
              <FilterPill active={draft.featured} onClick={() => setDraft((previous) => ({ ...previous, featured: !previous.featured }))}>★ Guest favourite</FilterPill>
            </div>
          </div>

          <div className="border-b border-zinc-200 py-7">
            <button type="button" onClick={() => setShowAccessibility((value) => !value)} aria-expanded={showAccessibility} className="flex w-full items-center justify-between text-left text-lg font-semibold text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">Accessibility features <span aria-hidden="true">{showAccessibility ? "⌃" : "⌄"}</span></button>
            {showAccessibility && <div className="mt-5 grid gap-3 sm:grid-cols-2">{accessibilityAmenities.map((amenity) => <label key={amenity.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-zinc-800"><input type="checkbox" checked={draft.accessibility.includes(amenity.id)} onChange={() => setDraft((previous) => ({ ...previous, accessibility: toggle(previous.accessibility, amenity.id) }))} className="size-5 rounded border-zinc-400 text-zinc-950 focus:ring-zinc-950" />{amenity.label}</label>)}</div>}
          </div>

          <div className="border-b border-zinc-200 py-7">
            <button type="button" onClick={() => setShowLanguages((value) => !value)} aria-expanded={showLanguages} className="flex w-full items-center justify-between text-left text-lg font-semibold text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">Host languages <span aria-hidden="true">{showLanguages ? "⌃" : "⌄"}</span></button>
            {showLanguages && <div className="mt-5 grid max-h-72 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">{FILTER_LANGUAGE_OPTIONS.map((language) => <label key={language.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-zinc-800"><input type="checkbox" checked={draft.languages.includes(language.id)} onChange={() => setDraft((previous) => ({ ...previous, languages: toggle(previous.languages, language.id) }))} className="size-5 rounded border-zinc-400 text-zinc-950 focus:ring-zinc-950" />{language.name}</label>)}</div>}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-zinc-200 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <button type="button" onClick={clearAll} className="text-sm font-semibold underline underline-offset-2 hover:text-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">Clear all</button>
          <button type="button" disabled={isApplying || (hasDraftChanges && isCounting)} onClick={() => onApply(normalisedDraft)} className="min-h-12 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950">{hasDraftChanges && isCounting ? "Finding places…" : `Show ${shownCount.toLocaleString()} ${shownCount === 1 ? "place" : "places"}`}</button>
        </footer>
      </section>
    </ModalOverlay>
  );
}
