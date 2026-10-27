"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type {
  TravelStampPickerPageDTO,
  UserTravelStampDTO,
} from "@/types/travel";
import { addTravelStampSelectionsAction } from "@/actions/travel/travelStampsAndBadges";
import { toast } from "@/components/ui/toast";

interface TravelStampManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStampsChange: (stamps: UserTravelStampDTO[]) => void;
}

const PAGE_SIZE = 9;

function pageCacheKey(page: number, search: string, country: string) {
  return `${page}:${search.toLocaleLowerCase()}:${country.toLocaleLowerCase()}`;
}

export function TravelStampManagerModal({
  isOpen,
  onClose,
  onStampsChange,
}: TravelStampManagerModalProps) {
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
  const cacheRef = useRef(new Map<string, TravelStampPickerPageDTO>());
  const requestIdRef = useRef(0);
  const touchStartXRef = useRef<number | null>(null);

  const fetchPage = useCallback(
    async (
      nextPage: number,
      nextSearch: string,
      nextCountry: string,
      options: { prefetch?: boolean; force?: boolean } = {},
    ) => {
      const key = pageCacheKey(nextPage, nextSearch, nextCountry);
      if (!options.force) {
        const cached = cacheRef.current.get(key);
        if (cached) {
          if (!options.prefetch) setResult(cached);
          return cached;
        }
      }
      const requestId = ++requestIdRef.current;
      if (!options.prefetch) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: String(PAGE_SIZE),
        });
        if (nextSearch) params.set("search", nextSearch);
        if (nextCountry !== "all") params.set("country", nextCountry);
        const response = await fetch(
          `/api/v1/travel-media/stamps/catalog?${params}`,
        );
        const data = (await response.json()) as TravelStampPickerPageDTO & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error || "Unable to load destination stamps.");
        cacheRef.current.set(key, data);
        if (!options.prefetch && requestId === requestIdRef.current)
          setResult(data);
        return data;
      } catch (err) {
        if (!options.prefetch && requestId === requestIdRef.current)
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load destination stamps.",
          );
        return null;
      } finally {
        if (!options.prefetch && requestId === requestIdRef.current)
          setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!isOpen) return;
    void fetchPage(page, debouncedSearch, country).then((data) => {
      if (data?.hasMore)
        void fetchPage(page + 1, debouncedSearch, country, { prefetch: true });
    });
  }, [country, debouncedSearch, fetchPage, isOpen, page]);

  useEffect(() => {
    if (!isOpen || countries.length) return;
    let cancelled = false;
    void fetch("/api/v1/travel-media/stamps/catalog/countries")
      .then(async (response) => {
        const data = (await response.json()) as {
          countries?: string[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error || "Unable to load countries.");
        if (!cancelled) setCountries(data.countries || []);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Unable to load countries.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [countries.length, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "SELECT") return;
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && page > 1) setPage((value) => value - 1);
      if (event.key === "ArrowRight" && result && page < result.totalPages)
        setPage((value) => value + 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, page, result]);

  if (!isOpen) return null;

  const totalPages = result?.totalPages || 1;
  const goNext = () => {
    if (page < totalPages) setPage((value) => value + 1);
  };
  const goPrevious = () => {
    if (page > 1) setPage((value) => value - 1);
  };
  const toggleSelection = (id: string, isAlreadyCollected: boolean) => {
    if (isAlreadyCollected || isSaving) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const handleSave = async () => {
    if (!selectedIds.size || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await addTravelStampSelectionsAction({
        catalogStampIds: [...selectedIds],
      });
      onStampsChange(updated);
      setSelectedIds(new Set());
      cacheRef.current.clear();
      await fetchPage(page, debouncedSearch, country, { force: true });
      toast.success("Stamps added to your travel profile.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to add destination stamps.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-5">
      <button
        type="button"
        aria-label="Close stamp picker"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stamp-manager-title"
        className="relative z-10 flex max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[85vh] sm:max-w-[820px] sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-start justify-between border-b border-zinc-100 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h2
              id="stamp-manager-title"
              className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl"
            >
              My Travel Stamps
            </h2>
            <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
              Collect destination stamps from places you&apos;ve visited.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800"
          >
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700"
            >
              {error}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search city, country or stamp..."
                aria-label="Search city, country or stamp"
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 pr-14 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500 hover:text-zinc-900"
                >
                  Clear
                </button>
              )}
            </div>
            <select
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                setPage(1);
              }}
              aria-label="Filter stamps by country"
              className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-700 outline-none focus:border-amber-400"
            >
              <option value="all">All Countries</option>
              {countries.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Explore Destination Stamps
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {result
                    ? `${result.totalCount} matching stamp${result.totalCount === 1 ? "" : "s"}`
                    : "Loading catalog…"}
                </p>
              </div>
              {selectedIds.size > 0 && (
                <span className="shrink-0 text-xs font-semibold text-amber-700">
                  {selectedIds.size} selected
                </span>
              )}
            </div>
            {isLoading && !result ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {Array.from({ length: PAGE_SIZE }, (_, index) => (
                  <div
                    key={index}
                    className="h-36 animate-pulse rounded-2xl bg-zinc-100"
                  />
                ))}
              </div>
            ) : result?.items.length ? (
              <div
                onTouchStart={(event) => {
                  touchStartXRef.current =
                    event.changedTouches[0]?.clientX ?? null;
                }}
                onTouchEnd={(event) => {
                  const start = touchStartXRef.current;
                  const end = event.changedTouches[0]?.clientX;
                  touchStartXRef.current = null;
                  if (
                    start !== null &&
                    end !== undefined &&
                    Math.abs(end - start) > 48
                  ) {
                    if (end < start) goNext();
                    else goPrevious();
                  }
                }}
                className="grid grid-cols-2 gap-3 md:grid-cols-3"
                aria-live="polite"
              >
                {result.items.map((item) => {
                  const selected = selectedIds.has(item.id);
                  const disabled = item.isAlreadyCollected || isSaving;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={disabled}
                      aria-pressed={selected}
                      onClick={() =>
                        toggleSelection(item.id, item.isAlreadyCollected)
                      }
                      className={`group relative min-h-36 rounded-2xl border p-3 text-left transition ${item.isAlreadyCollected ? "cursor-not-allowed border-zinc-100 bg-zinc-50 opacity-70" : selected ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300" : "border-zinc-200 bg-white hover:border-amber-300 hover:bg-amber-50/30"}`}
                    >
                      <div className="relative mx-auto flex size-16 items-center justify-center overflow-hidden rounded-full border border-dashed border-zinc-300 bg-zinc-50 p-1.5 sm:size-[72px]">
                        {item.iconUrl ? (
                          <Image
                            src={item.iconUrl}
                            alt={item.displayName}
                            fill
                            loading="lazy"
                            sizes="72px"
                            unoptimized={item.iconUrl.endsWith(".svg")}
                            className="object-contain p-1"
                          />
                        ) : (
                          <span className="text-2xl">✈️</span>
                        )}
                      </div>
                      <p className="mt-2 truncate text-center text-sm font-bold text-zinc-900">
                        {item.displayName}
                      </p>
                      <p className="mt-0.5 truncate text-center text-[11px] text-zinc-500">
                        {[item.cityName, item.countryName]
                          .filter(Boolean)
                          .join(", ") || item.category}
                      </p>
                      <span
                        className={`mt-2 block text-center text-[11px] font-semibold ${item.isAlreadyCollected ? "text-emerald-700" : selected ? "text-amber-700" : "text-zinc-700"}`}
                      >
                        {item.isAlreadyCollected
                          ? "✓ Added"
                          : selected
                            ? "✓ Selected"
                            : "+ Add"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : !isLoading ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-10 text-center">
                <p className="text-sm font-semibold text-zinc-900">
                  No destination stamps found
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Try a different city, country, or stamp name.
                </p>
              </div>
            ) : null}
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={goPrevious}
                disabled={page <= 1 || isLoading}
                className="rounded-full border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Previous
              </button>
              <span className="text-xs font-medium text-zinc-500">
                Page {result?.page || page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={page >= totalPages || isLoading}
                className="rounded-full border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
        <footer className="flex shrink-0 items-center justify-between border-t border-zinc-100 bg-white px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={selectedIds.size ? handleSave : onClose}
            disabled={isSaving}
            className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "Adding…"
              : selectedIds.size
                ? `Add ${selectedIds.size} Stamp${selectedIds.size === 1 ? "" : "s"}`
                : "Done"}
          </button>
        </footer>
      </div>
    </div>
  );
}
