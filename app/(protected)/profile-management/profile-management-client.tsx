"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useState, useTransition, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { updateProfileAction } from "@/actions/user/updateProfile";
import {
  uploadTripPhotosAction,
  updateTripPhotoAction,
  deleteTripPhotoAction,
} from "@/actions/user/tripPhotos";
import { toast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/i18n/language-context";
import { GuestDashboardSidebar } from "@/components/dashboard/guest-sidebar";
import { TagPeopleInput, TaggedUser } from "@/components/ui/tag-people-input";
import { LocationSearchInput } from "@/components/ui/location-search-input";
import {
  extractSubTabFromQuery,
  getMgmtSubTabSlug,
  ProfileMgmtSubTab,
} from "@/lib/profile/tab-utils";
import {
  getLanguageDisplayNames,
  LANGUAGE_OPTIONS,
  getLanguageById,
  POPULAR_LANGUAGE_IDS,
} from "@/lib/utils/language-options";
import {
  POPULAR_GLOBAL_DESTINATIONS,
  searchLocations,
  type StructuredLocation,
} from "@/lib/location/geocoding";

export type PublicProfileData = {
  whereIWantToGo?: string;
  myWork?: string;
  spendTooMuchTime?: string;
  pets?: string;
  decadeBorn?: string;
  school?: string;
  uselessSkill?: string;
  funFact?: string;
  favoriteSong?: string;
  languages?: string | string[];
  obsessedWith?: string;
  bioTitle?: string;
  whereILive?: string;
  bio?: string;
  profileVisible?: boolean;
};

type ProfileData = {
  id: string;
  name: string | null;
  phone: string | null;
  image: string | null;
  email: string | null;
  publicProfile?: PublicProfileData | null;
};

export type TripPhotoItem = {
  id: string;
  userId: string;
  url: string;
  caption: string | null;
  location: string | null;
  tags: string[];
  createdAt: Date | string;
};

export type UserStatsData = {
  trips: number;
  likes: number;
  reviews: number;
};

export const MAX_BIO_LENGTH = 500;

type ProfileManagementClientProps = {
  initial: ProfileData;
  initialTripPhotos?: TripPhotoItem[];
  initialTripPhotosLoaded?: boolean;
  initialStats?: UserStatsData;
  isOwner?: boolean;
  embedded?: boolean;
  onCancel?: () => void;
  initialSubTab?: ProfileMgmtSubTab;
  onSubTabChange?: (subTab: ProfileMgmtSubTab) => void;
  onProfileUpdated?: (updated: ProfileData) => void;
};

function languagesForInput(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return getLanguageDisplayNames(value).join(", ");
  return value || "";
}

const IconSprig = () => (
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#1F1F1F] bg-white shadow-2xs">
    <Image
      src="/images/icons/post-bookings.svg"
      alt=""
      width={24}
      height={24}
      className="h-6 w-6 object-contain"
    />
  </div>
);

const IconCamera = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
    />
    <circle cx="12" cy="13" r="3" />
  </svg>
);
const IconPencil = () => (
  <svg
    className="w-3.5 h-3.5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
    />
  </svg>
);
const IconTrash = () => (
  <svg
    className="w-3.5 h-3.5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);


function LanguageMultiSelect({
  selected,
  onChange,
  disabled = false,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Deduplicate and canonicalize selected language entries
  const uniqueSelected = React.useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of selected) {
      if (!item) continue;
      const resolved = getLanguageById(item);
      const canonicalKey = resolved ? resolved.id.toLowerCase() : item.trim().toLowerCase();
      if (!seen.has(canonicalKey)) {
        seen.add(canonicalKey);
        result.push(resolved ? resolved.id : item.trim());
      }
    }
    return result;
  }, [selected]);

  // Helper to test if a language is already selected (by code or name)
  const isSelected = React.useCallback(
    (lang: (typeof LANGUAGE_OPTIONS)[number]) => {
      const targetId = lang.id.toLowerCase();
      const targetName = lang.name.toLowerCase();
      return uniqueSelected.some((s) => {
        const itemLower = s.trim().toLowerCase();
        if (itemLower === targetId || itemLower === targetName) return true;
        const resolved = getLanguageById(s);
        return resolved ? resolved.id.toLowerCase() === targetId : false;
      });
    },
    [uniqueSelected],
  );

  // Filter languages: all languages not yet selected that match the search query
  const query = search.trim().toLowerCase();
  const unselectedLanguages = React.useMemo(() => {
    return LANGUAGE_OPTIONS.filter((lang) => !isSelected(lang));
  }, [isSelected]);

  const filtered = React.useMemo(() => {
    if (!query) return unselectedLanguages;
    return unselectedLanguages.filter(
      (lang) =>
        lang.name.toLowerCase().includes(query) ||
        (lang.nativeName && lang.nativeName.toLowerCase().includes(query)) ||
        lang.id.toLowerCase() === query,
    );
  }, [unselectedLanguages, query]);

  // Popular languages (subset of unselected when search is empty)
  const popularLanguages = React.useMemo(() => {
    if (query) return [];
    return unselectedLanguages.filter((l) => POPULAR_LANGUAGE_IDS.includes(l.id));
  }, [unselectedLanguages, query]);

  const addLanguage = (langOrId: string) => {
    const resolved = getLanguageById(langOrId);
    const idToAdd = resolved ? resolved.id : langOrId.trim();
    if (!idToAdd) return;
    const targetKey = idToAdd.toLowerCase();
    const already = uniqueSelected.some((s) => {
      const match = getLanguageById(s);
      return (
        s.toLowerCase() === targetKey ||
        (match && match.id.toLowerCase() === targetKey)
      );
    });
    if (!already) {
      onChange([...uniqueSelected, idToAdd]);
    }
    setSearch("");
    setActiveIndex(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const removeLanguage = (itemToRemove: string) => {
    const targetLower = itemToRemove.trim().toLowerCase();
    const resolvedTarget = getLanguageById(itemToRemove);
    onChange(
      uniqueSelected.filter((s) => {
        const sLower = s.trim().toLowerCase();
        if (sLower === targetLower) return false;
        if (resolvedTarget) {
          const sResolved = getLanguageById(s);
          if (sResolved && sResolved.id.toLowerCase() === resolvedTarget.id.toLowerCase()) return false;
        }
        return true;
      }),
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0 && filtered[activeIndex]) {
      e.preventDefault();
      addLanguage(filtered[activeIndex].id);
    } else if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
      setActiveIndex(-1);
    } else if (e.key === "Backspace" && search === "" && selected.length > 0) {
      removeLanguage(selected[selected.length - 1]);
    }
  };

  React.useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Box containing selected chips and search input */}
      <div
        className={`flex flex-wrap gap-1.5 min-h-[44px] items-center rounded-xl border px-3 py-2 transition-all cursor-text ${
          open
            ? "border-[#1F1F1F] ring-2 ring-zinc-200/80 bg-white shadow-2xs"
            : disabled
            ? "border-zinc-200 bg-zinc-50 cursor-default"
            : "border-zinc-300 bg-white hover:border-zinc-400"
        }`}
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        {/* Selected chips */}
        {uniqueSelected.map((item, idx) => {
          const resolved = getLanguageById(item);
          const displayName = resolved ? resolved.name : item;
          const displayKey = resolved ? resolved.id : item;
          return (
            <span
              key={`chip-${displayKey}-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1F1F1F] pl-2.5 pr-1.5 py-1 text-xs font-medium text-white shadow-2xs leading-none"
            >
              <span>{displayName}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLanguage(item);
                  }}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors cursor-pointer"
                  aria-label={`Remove ${displayName}`}
                >
                  <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M2 2l6 6M8 2l-6 6" />
                  </svg>
                </button>
              )}
            </span>
          );
        })}

        {/* Search input inside chips container */}
        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveIndex(-1);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={
              selected.length === 0
                ? t("profile_info_languages_ph_empty", "Search & select languages (e.g. English, Arabic)...")
                : t("profile_info_languages_ph_more", "Add another language...")
            }
            className="flex-1 min-w-[140px] bg-transparent text-sm text-[#1F1F1F] placeholder-zinc-400 focus:outline-none py-1"
          />
        )}

        {/* Count badge when closed */}
        {!open && uniqueSelected.length > 0 && !disabled && (
          <span className="ml-auto shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
            {uniqueSelected.length} {t("profile_info_languages_selected", "selected")}
          </span>
        )}
      </div>

      {/* Dropdown panel */}
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-white border border-zinc-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-zinc-100 bg-zinc-50/70">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              {filtered.length} {filtered.length === 1 ? "Language" : "Languages"} Available
            </span>
            <span className="text-[10px] text-zinc-400">
              Press Enter to add · Esc to close
            </span>
          </div>

          {/* Quick popular tags when not searching */}
          {!query && popularLanguages.length > 0 && (
            <div className="px-3.5 py-2.5 border-b border-zinc-100 bg-zinc-50/30">
              <p className="text-[11px] font-medium text-zinc-400 mb-1.5">Commonly Spoken:</p>
              <div className="flex flex-wrap gap-1.5">
                {popularLanguages.slice(0, 8).map((pLang) => (
                  <button
                    key={`pop-${pLang.id}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addLanguage(pLang.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white hover:border-[#1F1F1F] hover:bg-zinc-900 hover:text-white px-2 py-0.5 text-xs font-medium text-[#1F1F1F] transition-all cursor-pointer"
                  >
                    <span>+</span>
                    <span>{pLang.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Scrollable list of ALL languages */}
          <div ref={listRef} className="max-h-60 overflow-y-auto overscroll-contain py-1 divide-y divide-zinc-50">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm font-medium text-zinc-600 mb-1">
                  {query ? `No languages match "${query}"` : "All languages have been selected"}
                </p>
                {query && (
                  <p className="text-xs text-zinc-400">
                    Try typing the English name or native spelling (e.g. Français, Español).
                  </p>
                )}
              </div>
            ) : (
              filtered.map((lang, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addLanguage(lang.id);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                      isActive
                        ? "bg-[#1F1F1F] text-white"
                        : "hover:bg-zinc-50 text-[#1F1F1F]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`text-xs ${isActive ? "text-zinc-300" : "text-zinc-400"}`}>🌐</span>
                      <span className="text-sm font-medium truncate">{lang.name}</span>
                    </div>
                    {lang.nativeName && lang.nativeName !== lang.name && (
                      <span
                        className={`text-xs shrink-0 ${
                          isActive ? "text-zinc-300" : "text-zinc-400"
                        }`}
                      >
                        {lang.nativeName}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer bar */}
          <div className="border-t border-zinc-100 bg-zinc-50/70 px-3.5 py-2 flex items-center justify-between text-xs">
            <span className="text-[11px] text-zinc-500">
              {uniqueSelected.length} selected
            </span>
            {uniqueSelected.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange([]);
                }}
                className="text-[11px] text-red-500 hover:text-red-700 font-medium transition-colors cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InlineLocationSearch({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(value);
  const [suggestions, setSuggestions] = React.useState<StructuredLocation[]>(POPULAR_GLOBAL_DESTINATIONS);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync internal query with incoming value
  React.useEffect(() => {
    setQuery(value);
  }, [value]);

  // Click outside: if user entered text but didn't select an address, revert to value
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
        // Do not allow invalid/free-text values: revert to verified saved value
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  // Debounced Place Search
  React.useEffect(() => {
    if (!open) return;
    const clean = query.trim();
    if (clean.length < 2) {
      setSuggestions(POPULAR_GLOBAL_DESTINATIONS);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchLocations(clean);
        setSuggestions(results || []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query, open]);

  const handleSelect = (dest: StructuredLocation) => {
    const formatted = dest.formattedAddress;
    setQuery(formatted);
    onChange(formatted);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(value);
      setActiveIndex(-1);
    }
  };

  const handleClear = () => {
    setQuery("");
    onChange("");
    setSuggestions(POPULAR_GLOBAL_DESTINATIONS);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Box with Map Pin */}
      <div
        className={`flex items-center gap-2.5 min-h-[44px] rounded-xl border px-3 py-2 transition-all ${
          open
            ? "border-[#1F1F1F] ring-2 ring-zinc-200/80 bg-white shadow-2xs"
            : disabled
            ? "border-zinc-200 bg-zinc-50 cursor-default"
            : "border-zinc-300 bg-white hover:border-zinc-400"
        }`}
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        <span className="text-zinc-500 text-sm shrink-0">📍</span>

        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (!open) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t("profile_info_where_live_ph", "Search town, city or country (e.g. Rome, Italy)...")}
          className="flex-1 min-w-0 bg-transparent text-sm text-[#1F1F1F] placeholder-zinc-400 focus:outline-none font-medium"
        />

        {query && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 transition-colors cursor-pointer"
            title="Clear location"
            aria-label="Clear location"
          >
            <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M2 2l6 6M8 2l-6 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown with Suggestions */}
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-white border border-zinc-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-zinc-100 bg-zinc-50/70">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              {query.trim().length >= 2 ? "Search Results" : "Popular Destinations"}
            </span>
            <span className="text-[10px] text-zinc-400">
              Select one to apply
            </span>
          </div>

          {loading ? (
            <div className="flex items-center gap-2.5 px-4 py-5 text-xs text-zinc-500">
              <svg className="w-4 h-4 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" className="opacity-75" />
              </svg>
              <span>Searching locations…</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-medium text-zinc-600 mb-1">
                No places found for &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs text-zinc-400">
                Try searching for a city, district, or country name.
              </p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto overscroll-contain py-1 divide-y divide-zinc-50">
              {suggestions.map((dest, idx) => {
                const isActive = idx === activeIndex;
                const isSelected =
                  value && dest.formattedAddress.toLowerCase() === value.toLowerCase();

                return (
                  <button
                    key={`${dest.formattedAddress}-${idx}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(dest);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                      isActive
                        ? "bg-[#1F1F1F] text-white"
                        : isSelected
                        ? "bg-amber-50 text-[#1F1F1F]"
                        : "hover:bg-zinc-50 text-[#1F1F1F]"
                    }`}
                  >
                    <span className={`text-xs shrink-0 ${isActive ? "text-zinc-300" : "text-zinc-400"}`}>📍</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${isActive ? "text-white" : "text-[#1F1F1F]"}`}>
                        {dest.locationName}
                      </p>
                      <p className={`text-xs truncate ${isActive ? "text-zinc-300" : "text-zinc-500"}`}>
                        {dest.formattedAddress}
                      </p>
                    </div>
                    {dest.countryCode && (
                      <span
                        className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {dest.countryCode}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer note */}
          <div className="border-t border-zinc-100 bg-zinc-50/70 px-3.5 py-1.5 text-[10px] text-zinc-400">
            Click a suggestion to set your location
          </div>
        </div>
      )}
    </div>
  );
}
export function ProfileManagementClient({
  initial,
  initialTripPhotos = [],
  initialTripPhotosLoaded = false,
  initialStats = { trips: 12, likes: 0, reviews: 10 },
  isOwner = true,
  embedded = false,
  onCancel,
  initialSubTab,
  onSubTabChange,
  onProfileUpdated,
}: ProfileManagementClientProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [activeMgmtTab, setActiveMgmtTab] = useState<ProfileMgmtSubTab>(() =>
    initialSubTab || extractSubTabFromQuery()
  );

  React.useEffect(() => {
    if (initialSubTab) {
      setActiveMgmtTab(initialSubTab);
    }
  }, [initialSubTab]);

  React.useEffect(() => {
    const handlePopState = () => {
      const sub = extractSubTabFromQuery(null, window.location.search);
      setActiveMgmtTab(sub);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSubTabClick = (tab: ProfileMgmtSubTab) => {
    setActiveMgmtTab(tab);
    if (tab === "photos" && !initialTripPhotosLoaded) {
      setIsTripPhotosLoading(true);
    }
    if (onSubTabChange) {
      onSubTabChange(tab);
    } else {
      const slug = getMgmtSubTabSlug(tab);
      window.history.pushState(null, "", `/profile/tab/profile_management/${slug}`);
    }
  };

  const [profileData, setProfileData] = useState<ProfileData>(initial);
  const [tripPhotos, setTripPhotos] =
    useState<TripPhotoItem[]>(initialTripPhotos);
  const [failedTripPhotoIds, setFailedTripPhotoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isTripPhotosLoading, setIsTripPhotosLoading] = useState(
    activeMgmtTab === "photos" && !initialTripPhotosLoaded,
  );
  const [pending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const { data: session, update: updateSession } = useSession();

  const [imageUrl, setImageUrl] = useState(initial.image || "");
  const [name, setName] = useState(profileData.name || initial.name || "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals & States
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editPhotoModal, setEditPhotoModal] = useState<TripPhotoItem | null>(
    null,
  );
  const [deletePhotoModal, setDeletePhotoModal] =
    useState<TripPhotoItem | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<TripPhotoItem | null>(
    null,
  );

  const pub = profileData.publicProfile || {};

  const [formDataState, setFormDataState] = useState<PublicProfileData>({
    whereIWantToGo: pub.whereIWantToGo || "",
    myWork: pub.myWork || "",
    spendTooMuchTime: pub.spendTooMuchTime || "",
    pets: pub.pets || "",
    decadeBorn: pub.decadeBorn || "",
    school: pub.school || "",
    uselessSkill: pub.uselessSkill || "",
    funFact: pub.funFact || "",
    favoriteSong: pub.favoriteSong || "",
    languages: (() => {
      const raw = Array.isArray(pub.languages)
        ? pub.languages
        : typeof pub.languages === "string"
        ? pub.languages.split(",").map((l: string) => l.trim()).filter(Boolean)
        : [];
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const l of raw) {
        if (!l) continue;
        const resolved = getLanguageById(l);
        const key = resolved ? resolved.id.toLowerCase() : l.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(resolved ? resolved.id : l.trim());
        }
      }
      return deduped;
    })(),
    obsessedWith: pub.obsessedWith || "",
    bioTitle: pub.bioTitle || "",
    whereILive: pub.whereILive || "",
    bio: pub.bio || "",
  });

  const handleInputChange = (field: keyof PublicProfileData, value: PublicProfileData[keyof PublicProfileData]) => {
    if (!isOwner) return;
    setFormDataState((prev) => ({ ...prev, [field]: value }));
  };

  const saveDirectProfileField = (fieldName: string, value: unknown) => {
    if (!isOwner) return;
    const nextPublicProfile = {
      ...pub,
      ...formDataState,
      [fieldName]: value,
    };
    startTransition(async () => {
      const res = await updateProfileAction({
        publicProfile: nextPublicProfile,
      });
      if (!res.ok) {
        toast.error(res.error || "Failed to update settings.");
        return;
      }
      if (res.data) {
        const updated = res.data as ProfileData;
        setProfileData(updated);
        onProfileUpdated?.(updated);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("homyz:profile-updated", { detail: updated }));
        }
      }
      toast.success("Settings updated successfully.");
      router.refresh();
    });
  };

  const onSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!isOwner || saveStatus === "saving" || pending) return;

    setSaveStatus("saving");

    const rawLanguages = typeof formDataState.languages === "string"
      ? formDataState.languages.split(",").map((l) => l.trim()).filter(Boolean)
      : formDataState.languages;
    const uniqueLanguages = Array.isArray(rawLanguages)
      ? Array.from(new Set(rawLanguages))
      : rawLanguages;

    const trimmedBio = (formDataState.bio || "").trim().slice(0, MAX_BIO_LENGTH);
    const trimmedWhereILive = (formDataState.whereILive || "").trim();
    const trimmedMyWork = (formDataState.myWork || "").trim();
    const trimmedSchool = (formDataState.school || "").trim();

    const payload = {
      image: imageUrl || initial.image || null,
      name: (name || initial.name || "").trim() || null,
      phone: initial.phone || null,
      publicProfile: {
        ...pub,
        ...formDataState,
        bio: trimmedBio || null,
        whereILive: trimmedWhereILive || null,
        myWork: trimmedMyWork || null,
        school: trimmedSchool || null,
        languages: uniqueLanguages || [],
      },
    };

    startTransition(async () => {
      try {
        const res = await updateProfileAction(payload);
        if (!res.ok) {
          setSaveStatus("error");
          toast.error(res.error || "Failed to update profile.");
          return;
        }
        const updated = res.data as ProfileData;
        setProfileData(updated);
        setSaveStatus("saved");
        toast.success("Profile changes saved successfully!");

        onProfileUpdated?.(updated);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("homyz:profile-updated", { detail: updated }));
        }

        setTimeout(() => {
          setSaveStatus("idle");
        }, 2500);

        router.refresh();
      } catch (err) {
        setSaveStatus("error");
        toast.error(err instanceof Error ? err.message : "Failed to update profile.");
      }
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isOwner) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/upload/listing-photo", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setImageUrl(data.url);

      const saveRes = await updateProfileAction({
        image: data.url,
        name: initial.name || null,
        phone: initial.phone || null,
        publicProfile: { ...pub, ...formDataState },
      });

      if (!saveRes.ok) {
        throw new Error(saveRes.error || "Failed to save updated avatar.");
      }

      if (saveRes.data) {
        const updated = saveRes.data as ProfileData;
        setProfileData(updated);
        onProfileUpdated?.(updated);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("homyz:profile-updated", { detail: updated }));
        }
      }

      if (session?.user) {
        await updateSession({ user: { ...session.user, image: data.url } });
      }

      toast.success("Profile image updated and saved.");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload error");
    } finally {
      setUploading(false);
    }
  };

  const managementWorkspace = (
    <div className="order-1 flex w-full min-w-0 flex-col animate-in fade-in lg:order-2 lg:justify-self-end">
      {!embedded && (
        <div className="mb-4 flex items-center justify-between sm:hidden">
          <button
            type="button"
            onClick={() => (onCancel ? onCancel() : router.back())}
            aria-label="Go back"
            className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full border border-[#aaa] bg-[#f5f5f5] text-[#727272] transition-colors hover:bg-zinc-200 sm:hidden"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="h-4 w-4"
            >
              <path d="m14 5-7 7 7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* 1. HERO AVATAR CARD & COMMUNITY NOTE */}
      <div className="mb-8 flex flex-col items-start gap-7 xl:flex-row xl:items-center xl:gap-6">
        <div
          className={`profile-avtar-card relative md:mt-5 mt-0 aspect-square w-[220px] max-w-full shrink-0 self-center sm:mt-0 sm:h-66 sm:w-90.5 sm:max-w-[calc(100%-48px)] sm:self-auto ${isOwner ? "mb-10 sm:mb-0" : ""}`}
        >
          <div className="relative h-full w-full overflow-hidden rounded-full border border-[#1F1F1F] bg-zinc-100 sm:rounded-3xl sm:shadow-2xs">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt="Profile photo"
                fill
                className="object-cover"
                sizes="(max-width: 639px) 220px, 362px"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-400">
                <svg
                  className="h-20 w-20"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
          </div>
          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-8 left-1/2 z-10 flex h-[52px] w-[110px] -translate-x-1/2 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#FCDF9C] text-base font-normal text-[#1F1F1F] transition-transform hover:bg-[#F7D37D] disabled:cursor-wait sm:bottom-auto sm:left-auto sm:-right-12 sm:top-1/2 sm:h-24 sm:w-24 sm:translate-x-0 sm:-translate-y-1/2"
              >
                <Image
                  src="/images/icons/camera.svg"
                  alt=""
                  width={24}
                  height={24}
                  aria-hidden="true"
                />
                <span>{uploading ? "..." : t("profile_mgmt_edit", "Edit")}</span>
              </button>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
            </>
          )}
        </div>

        <div className="flex-1 max-w-md xl:ml-15">
          <h1 className="mb-4 text-[26px] font-semibold leading-tight text-[#1F1F1F] sm:hidden">
            {t("profile_mgmt_my_profile", "My profile")}
          </h1>
          <p className="text-base text-[#727272] leading-relaxed font-normal">
            {t("profile_mgmt_community_note", "Your profile is visible to both hosts and guests, and may be shown throughout Homyz to support a trustworthy community.")}{" "}
            <span className="font-semibold underline cursor-pointer hover:text-black transition">
              {t("profile_mgmt_learn_more", "Learn more")}
            </span>
          </p>
        </div>
      </div>

      {/* 2. DEDICATED PROFILE MANAGEMENT TABS */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 mb-8 overflow-x-auto">
        <Link
          href="/profile/tab/profile_management/profile_information"
          onClick={(e) => {
            e.preventDefault();
            handleSubTabClick("info");
          }}
          className={`px-4 py-2 rounded-full text-base font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeMgmtTab === "info"
              ? "bg-zinc-900 text-white shadow-2xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {t("profile_mgmt_tab_info", "Profile Information")}
        </Link>

        <Link
          href="/profile/tab/profile_management/trip_photos"
          onClick={(e) => {
            e.preventDefault();
            handleSubTabClick("photos");
          }}
          className={`px-4 py-2 rounded-full text-base font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeMgmtTab === "photos"
              ? "bg-zinc-900 text-white shadow-2xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {t("profile_mgmt_tab_photos", "Trip Photos")} ({tripPhotos.length})
        </Link>

        <Link
          href="/profile/tab/profile_management/privacy_visibility"
          onClick={(e) => {
            e.preventDefault();
            handleSubTabClick("privacy");
          }}
          className={`px-4 py-2 rounded-full text-base font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeMgmtTab === "privacy"
              ? "bg-zinc-900 text-white shadow-2xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {t("profile_mgmt_tab_privacy", "Privacy & Visibility")}
        </Link>
      </div>

      {/* TAB 1: PROFILE INFORMATION */}
      {activeMgmtTab === "info" && (
        <form
          onSubmit={(e) => onSubmit(e)}
          className="w-full flex flex-col sm:gap-8 gap-0 -mt-8"
        >
          {/* RESPONSIVE TWO-COLUMN PROMPT LIST */}
          <div className="flex flex-wrap [&>div]:w-full md:[&>div]:py-6! [&>div]:py-3! md:[&>div:nth-child(odd)]:mr-12 md:[&>div:not(:last-child)]:w-[calc(50%-1.5rem)]">
            {/* Item 0: Full Name */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  {t("profile_info_full_name", "My full name")}
                </span>
                <input
                  value={name}
                  disabled={!isOwner}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full sm:text-base text-sm bg-transparent focus:outline-none ${
                    name
                      ? "text-[#1f1f1f] font-medium"
                      : "text-zinc-400 font-normal"
                  }`}
                  placeholder={t("profile_info_full_name_ph", "edit: Your full name")}
                />
              </div>
            </div>
            {/* Item 1 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  {t("profile_info_where_wanted", "Where I've always wanted to go")}
                </span>
                <input
                  value={formDataState.whereIWantToGo}
                  disabled={!isOwner}
                  onChange={(e) =>
                    handleInputChange("whereIWantToGo", e.target.value)
                  }
                  className={`w-full sm:text-base text-sm bg-transparent focus:outline-none ${
                    formDataState.whereIWantToGo
                      ? "text-[#1F1F1F] font-medium"
                      : "text-zinc-400 font-normal"
                  }`}
                  placeholder={t("profile_info_where_wanted_ph", "edit: Where have you always wanted to travel?")}
                />
              </div>
            </div>

            {/* Item 2 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  {t("profile_info_my_work", "My work")}
                </span>
                <input
                  value={formDataState.myWork}
                  disabled={!isOwner}
                  onChange={(e) => handleInputChange("myWork", e.target.value)}
                  className={`w-full sm:text-base text-sm bg-transparent focus:outline-none ${
                    formDataState.myWork
                      ? "text-[#1F1F1F] font-medium"
                      : "text-zinc-400 font-normal"
                  }`}
                  placeholder={t("profile_info_my_work_ph", "Add your work")}
                />
              </div>
            </div>

            {/* Item 3 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  {t("profile_info_spend_time", "I spend too much time")}
                </span>
                <input
                  value={formDataState.spendTooMuchTime}
                  disabled={!isOwner}
                  onChange={(e) =>
                    handleInputChange("spendTooMuchTime", e.target.value)
                  }
                  className={`w-full sm:text-base text-sm bg-transparent focus:outline-none ${
                    formDataState.spendTooMuchTime
                      ? "text-[#1F1F1F] font-medium"
                      : "text-zinc-400 font-normal"
                  }`}
                  placeholder={t("profile_info_spend_time_ph", "Add an answer")}
                />
              </div>
            </div>

            {/* Item 4 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  {t("profile_info_pets", "Pets")}
                </span>
                <input
                  value={formDataState.pets}
                  disabled={!isOwner}
                  onChange={(e) => handleInputChange("pets", e.target.value)}
                  className={`w-full sm:text-base text-sm bg-transparent focus:outline-none ${
                    formDataState.pets
                      ? "text-[#1F1F1F] font-medium"
                      : "text-zinc-400 font-normal"
                  }`}
                  placeholder={t("profile_info_pets_ph", "Add pets")}
                />
              </div>
            </div>

            {/* Item 5 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  {t("profile_info_decade_born", "Decade I was born")}
                </span>
                <input
                  value={formDataState.decadeBorn}
                  disabled={!isOwner}
                  onChange={(e) =>
                    handleInputChange("decadeBorn", e.target.value)
                  }
                  className={`w-full sm:text-base text-sm bg-transparent focus:outline-none ${
                    formDataState.decadeBorn
                      ? "text-[#1F1F1F] font-medium"
                      : "text-zinc-400 font-normal"
                  }`}
                  placeholder={t("profile_info_decade_born_ph", "Add decade")}
                />
              </div>
            </div>

            {/* Item 6 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  {t("profile_info_school", "Where I went to school")}
                </span>
                <input
                  value={formDataState.school}
                  disabled={!isOwner}
                  onChange={(e) => handleInputChange("school", e.target.value)}
                  className={`w-full sm:text-base text-sm bg-transparent focus:outline-none ${
                    formDataState.school
                      ? "text-[#1F1F1F] font-medium"
                      : "text-zinc-400 font-normal"
                  }`}
                  placeholder={t("profile_info_school_ph", "Add school")}
                />
              </div>
            </div>

            {/* Item 7 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  {t("profile_info_useless_skill", "My most useless skill")}
                </span>
                <input
                  value={formDataState.uselessSkill}
                  disabled={!isOwner}
                  onChange={(e) =>
                    handleInputChange("uselessSkill", e.target.value)
                  }
                  className={`w-full sm:text-base text-sm bg-transparent focus:outline-none ${
                    formDataState.uselessSkill
                      ? "text-[#1F1F1F] font-medium"
                      : "text-zinc-400 font-normal"
                  }`}
                  placeholder={t("profile_info_useless_skill_ph", "edit: What's your most useless skill?")}
                />
              </div>
            </div>

            {/* Item 8 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  {t("profile_info_fun_fact", "My fun fact")}
                </span>
                <input
                  value={formDataState.funFact}
                  disabled={!isOwner}
                  onChange={(e) => handleInputChange("funFact", e.target.value)}
                  className={`w-full sm:text-base text-sm bg-transparent focus:outline-none ${
                    formDataState.funFact
                      ? "text-[#1F1F1F] font-medium"
                      : "text-zinc-400 font-normal"
                  }`}
                  placeholder={t("profile_info_fun_fact_ph", "edit: What's your fun fact?")}
                />
              </div>
            </div>

            {/* Item 9 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  {t("profile_info_fav_song", "My favorite song in high school")}
                </span>
                <input
                  value={formDataState.favoriteSong}
                  disabled={!isOwner}
                  onChange={(e) =>
                    handleInputChange("favoriteSong", e.target.value)
                  }
                  className={`w-full sm:text-base text-sm bg-transparent focus:outline-none ${
                    formDataState.favoriteSong
                      ? "text-[#1F1F1F] font-medium"
                      : "text-zinc-400 font-normal"
                  }`}
                  placeholder={t("profile_info_fav_song_ph", "edit: What was your favorite song in high school?")}
                />
              </div>
            </div>

            {/* Item 10 */}
            <div className="item-box flex items-start gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <div className="mt-0.5">
                <IconSprig />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272] mb-1.5">
                  {t("profile_info_languages", "Languages I speak")}
                </span>
                <LanguageMultiSelect
                  selected={
                    Array.isArray(formDataState.languages)
                      ? formDataState.languages
                      : formDataState.languages
                      ? String(formDataState.languages)
                          .split(",")
                          .map((l) => l.trim())
                          .filter(Boolean)
                      : []
                  }
                  onChange={(ids) => handleInputChange("languages", ids)}
                  disabled={!isOwner}
                />
              </div>
            </div>

            {/* Item 11 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  {t("profile_info_obsessed_with", "I'm obsessed with")}
                </span>
                <input
                  value={formDataState.obsessedWith}
                  disabled={!isOwner}
                  onChange={(e) =>
                    handleInputChange("obsessedWith", e.target.value)
                  }
                  className={`w-full sm:text-base text-sm bg-transparent focus:outline-none ${
                    formDataState.obsessedWith
                      ? "text-[#1F1F1F] font-medium"
                      : "text-zinc-400 font-normal"
                  }`}
                  placeholder={t("profile_info_obsessed_with_ph", "What are you obsessed with?")}
                />
              </div>
            </div>

            {/* Item 12 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  {t("profile_info_bio_title", "My biography title would be")}
                </span>
                <input
                  value={formDataState.bioTitle}
                  disabled={!isOwner}
                  onChange={(e) =>
                    handleInputChange("bioTitle", e.target.value)
                  }
                  className={`w-full sm:text-base text-sm bg-transparent focus:outline-none ${
                    formDataState.bioTitle
                      ? "text-[#1F1F1F] font-medium"
                      : "text-zinc-400 font-normal"
                  }`}
                  placeholder={t("profile_info_bio_title_ph", "My biography title would be")}
                />
              </div>
            </div>

            {/* Item 13 */}
            <div className="item-box flex items-start gap-3.5 border-b border-zinc-200/80 pb-2.5">
              <div className="mt-0.5">
                <IconSprig />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272] mb-1.5">
                  {t("profile_info_where_live", "Where I live")}
                </span>
                {isOwner ? (
                  <InlineLocationSearch
                    value={formDataState.whereILive || ""}
                    onChange={(val) => handleInputChange("whereILive", val)}
                    disabled={!isOwner}
                  />
                ) : (
                  <div className="flex items-center gap-2 py-2">
                    <span className="text-zinc-500 text-sm">📍</span>
                    <span
                      className={`sm:text-base text-sm ${
                        formDataState.whereILive
                          ? "text-[#1F1F1F] font-medium"
                          : "text-zinc-400 font-normal"
                      }`}
                    >
                      {formDataState.whereILive || t("profile_info_not_specified", "Not specified")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* About me Textarea Box */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-medium text-[#1F1F1F]">
                {t("profile_info_about_me", "About me")}
              </h3>
              <span className={`text-xs ${((formDataState.bio || "").length >= MAX_BIO_LENGTH) ? "text-amber-600 font-semibold" : "text-zinc-500"}`}>
                {(formDataState.bio || "").length} / {MAX_BIO_LENGTH}
              </span>
            </div>
            <div className="rounded-lg border border-[#727272] p-4 sm:p-6 min-h-[120px] focus-within:border-zinc-400 transition-colors bg-white">
              <textarea
                value={formDataState.bio}
                disabled={!isOwner || saveStatus === "saving"}
                maxLength={MAX_BIO_LENGTH}
                onChange={(e) => {
                  const val = e.target.value.slice(0, MAX_BIO_LENGTH);
                  handleInputChange("bio", val);
                }}
                className="w-full h-full min-h-[90px] bg-transparent resize-y font-normal text-base text-[#1F1F1F] placeholder-zinc-400 focus:outline-none leading-relaxed"
                placeholder={t("profile_info_about_me_ph", "Tell hosts and guests a little about yourself, your hobbies, and travel style...")}
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              {t("profile_info_max_chars", "Maximum 450 characters. About me will be visible on your public profile and to hosts when booking.")}
            </p>
          </div>

          {isOwner && (
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={pending || saveStatus === "saving"}
                className={`inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap rounded-full px-7 py-3 text-base font-medium transition-colors cursor-pointer ${
                  saveStatus === "saving"
                    ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                    : saveStatus === "saved"
                    ? "bg-emerald-600 text-white"
                    : "bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1F1F1F] hover:text-white"
                }`}
              >
                {saveStatus === "saving" ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{t("profile_info_saving", "Saving...")}</span>
                  </>
                ) : saveStatus === "saved" ? (
                  <>
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{t("profile_info_saved", "Saved!")}</span>
                  </>
                ) : (
                  <span>{t("profile_info_save_btn", "Save profile")}</span>
                )}
              </button>
            </div>
          )}
        </form>
      )}

      {/* TAB 2: TRIP PHOTOS */}
      {activeMgmtTab === "photos" && (
        <div className="flex flex-col gap-6">
          <div className="flex sm:flex-nowrap flex-wrap sm:gap-0 gap-3 items-center sm:justify-between justify-center">
            <div>
              <h3 className="text-lg font-semibold text-[#1F1F1F]">
                {t("trip_photos_mgmt_title", "Trip Photos Management")}
              </h3>
              <p className="text-xs text-zinc-500">
                {t("trip_photos_mgmt_subtitle", "Upload and curate your travel memories")}
              </p>
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                className="flex items-center gap-2 bg-[#FCDF9C] hover:bg-[#F3F4F5] text-[#1F1F1F] border border-transparent hover:border-[#1F1F1F] hover:text-[#1F1F1F] font-semibold text-sm px-6 py-3 rounded-full transition-colors cursor-pointer shadow-2xs"
              >
                <IconCamera />
                <span>{t("trip_photos_upload_btn", "Upload Photos")}</span>
              </button>
            )}
          </div>

          {isTripPhotosLoading ? (
            <div
              aria-busy="true"
              aria-live="polite"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3"
            >
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="aspect-4/3 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100"
                />
              ))}
              <p className="sr-only">Loading trip photos</p>
            </div>
          ) : tripPhotos.length === 0 ? (
            <div className="border-2 border-dashed border-zinc-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center bg-zinc-50/50">
              <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mb-3">
                <IconCamera />
              </div>
              <p className="text-base font-semibold text-[#1F1F1F]">
                {t("trip_photos_empty_title", "You can upload best images of your trip")}
              </p>
              <p className="text-xs text-zinc-500 max-w-md mt-1 mb-6 leading-relaxed">
                {t("trip_photos_empty_subtitle", "Select multiple photos, tag travel companions, add captions and locations.")}
              </p>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(true)}
                  className="bg-[#FCDF9C] hover:bg-[#F3F4F5] text-[#1F1F1F] border border-transparent hover:border-[#1F1F1F] hover:text-[#1F1F1F] font-semibold text-sm px-6 py-3 rounded-full transition-colors cursor-pointer shadow-2xs"
                >
                  {t("trip_photos_upload_btn", "Upload Photos")}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {tripPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative aspect-4/3 rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200/80 shadow-2xs"
                >
                  {failedTripPhotoIds.has(photo.id) ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-zinc-100 px-4 text-center text-zinc-500">
                      <IconCamera />
                      <p className="text-xs font-medium">Image unavailable</p>
                    </div>
                  ) : (
                    <Image
                      src={photo.url}
                      alt={photo.caption || "Trip photo"}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                      sizes="(max-width: 640px) 100vw, 33vw"
                      onClick={() => setLightboxPhoto(photo)}
                      onError={() => {
                        setFailedTripPhotoIds((previous) =>
                          new Set(previous).add(photo.id),
                        );
                      }}
                    />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3.5 flex flex-col justify-between pointer-events-none">
                    {isOwner && (
                      <div className="flex justify-end gap-1.5 pointer-events-auto">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditPhotoModal(photo);
                          }}
                          className="w-8 h-8 rounded-full bg-white/95 hover:bg-white text-[#1F1F1F] flex items-center justify-center shadow-md transition-transform hover:scale-110 cursor-pointer"
                          title={t("trip_photos_edit_title", "Edit photo")}
                        >
                          <IconPencil />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletePhotoModal(photo);
                          }}
                          className="w-8 h-8 rounded-full bg-white/95 hover:bg-rose-500 hover:text-white text-rose-600 flex items-center justify-center shadow-md transition-transform hover:scale-110 cursor-pointer"
                          title={t("trip_photos_delete_title", "Delete photo")}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    )}

                    <div className="mt-auto">
                      {photo.location && (
                        <p className="text-xs font-semibold text-white truncate">
                          📍 {photo.location}
                        </p>
                      )}
                      {photo.caption && (
                        <p className="text-xs text-zinc-200 truncate mt-0.5">
                          {photo.caption}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PRIVACY & VISIBILITY */}
      {activeMgmtTab === "privacy" && (
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-xl font-semibold text-[#1F1F1F]">
              {t("profile_privacy_settings_title", "Privacy & Visibility Settings")}
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {t("profile_privacy_settings_desc", "Manage who can see your profile on Homyz.")}
            </p>
          </div>

          <div className="p-6 rounded-3xl border border-zinc-200/80 bg-white shadow-2xs space-y-6">
            {/* Row 1: Public Profile Visibility */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-[#1F1F1F]">
                  {t("profile_privacy_public_label", "Public Profile Visibility")}
                </h4>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {t("profile_privacy_public_desc", "Allow hosts and other guests to discover your profile")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Active/OFF Badge */}
                <span
                  className={`text-xs font-semibold px-3.5 py-1 rounded-full border transition-all ${
                    (formDataState.profileVisible ?? true)
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                      : "bg-zinc-200 text-zinc-700 border-zinc-300"
                  }`}
                >
                  {(formDataState.profileVisible ?? true)
                    ? t("profile_privacy_active", "Active")
                    : t("profile_privacy_off", "OFF")}
                </span>

                {/* Interactive Red Toggle Switch */}
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !(formDataState.profileVisible ?? true);
                    setFormDataState((prev) => ({
                      ...prev,
                      profileVisible: nextVal,
                    }));
                    saveDirectProfileField("profileVisible", nextVal);
                  }}
                  className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer focus:outline-none ${
                    (formDataState.profileVisible ?? true)
                      ? "bg-[#FA595D]"
                      : "bg-zinc-300"
                  }`}
                  title={
                    (formDataState.profileVisible ?? true)
                      ? t("profile_privacy_toggle_off_title", "Make profile private")
                      : t("profile_privacy_toggle_on_title", "Make profile public")
                  }
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-xs ${
                      (formDataState.profileVisible ?? true)
                        ? "translate-x-[22px]"
                        : "translate-x-[2px]"
                    }`}
                  />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );

  const modals = (
    <>
      {uploadModalOpen && (
        <MultiImageUploadModal
          onClose={() => setUploadModalOpen(false)}
          onUploaded={(newPhotos) => {
            setTripPhotos((prev) => {
              const photosById = new Map(prev.map((photo) => [photo.id, photo]));
              newPhotos.forEach((photo) => photosById.set(photo.id, photo));
              return [...photosById.values()].sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              );
            });
            setIsTripPhotosLoading(false);
            setUploadModalOpen(false);
          }}
        />
      )}

      {editPhotoModal && (
        <EditTripPhotoModal
          photo={editPhotoModal}
          onClose={() => setEditPhotoModal(null)}
          onSaved={(updated) => {
            setTripPhotos((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p)),
            );
            setEditPhotoModal(null);
          }}
          onDeleteTrigger={(p) => {
            setEditPhotoModal(null);
            setDeletePhotoModal(p);
          }}
        />
      )}

      {deletePhotoModal && (
        <DeleteTripPhotoModal
          photo={deletePhotoModal}
          onClose={() => setDeletePhotoModal(null)}
          onDeleted={(deletedId) => {
            setTripPhotos((prev) => prev.filter((p) => p.id !== deletedId));
            setDeletePhotoModal(null);
          }}
        />
      )}

      {lightboxPhoto && (
        <LightboxModal
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="w-full min-w-0">
        {managementWorkspace}
        {modals}
      </div>
    );
  }

  return (
    <div className="w-full bg-white min-h-[85vh] flex flex-col font-sans sm:py-8">
      <div className="mx-auto w-full">
        <div className="grid grid-cols-1 sm:gap-8 gap-0 lg:grid-cols-[390px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[452px_minmax(0,1fr)]">
          <GuestDashboardSidebar activeId="profile_management" />
          {managementWorkspace}
        </div>
      </div>
      {modals}
    </div>
  );
}

// ------------------------------------------------------------------
// MODAL COMPONENTS (UPLOAD, EDIT, DELETE, LIGHTBOX)
// ------------------------------------------------------------------
function MultiImageUploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: (photos: TripPhotoItem[]) => void;
}) {
  const { t } = useLanguage();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [caption, setCaption] = useState("");
  const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    completed: 0,
    total: 0,
    phase: "idle" as "idle" | "uploading" | "saving",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);

  React.useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} exceeds 10MB limit.`);
        continue;
      }
      if (!file.type.startsWith("image/")) {
        toast.error(`File ${file.name} is not an image.`);
        continue;
      }
      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setPreviews((prev) => {
      const next = [...prev, ...newPreviews];
      previewUrlsRef.current = next;
      return next;
    });
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    if (uploading) return;
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => {
      const removed = prev[idx];
      if (removed) URL.revokeObjectURL(removed);
      const next = prev.filter((_, i) => i !== idx);
      previewUrlsRef.current = next;
      return next;
    });
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFiles.length) return;
    setUploading(true);
    setUploadProgress({
      completed: 0,
      total: selectedFiles.length,
      phase: "uploading",
    });

    try {
      const uploadedUrls = new Array<string>(selectedFiles.length);
      let nextFileIndex = 0;

      const uploadFile = async (file: File, index: number) => {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/v1/upload/listing-photo", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Upload failed");
        if (!data?.url) throw new Error("Upload did not return an image URL");
        uploadedUrls[index] = data.url;
        setUploadProgress((current) => ({
          ...current,
          completed: current.completed + 1,
        }));
      };

      const worker = async () => {
        while (nextFileIndex < selectedFiles.length) {
          const index = nextFileIndex++;
          await uploadFile(selectedFiles[index], index);
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(3, selectedFiles.length) },
          () => worker(),
        ),
      );
      setUploadProgress((current) => ({ ...current, phase: "saving" }));

      const tags = taggedUsers.map((u) => u.name || u.email || u.id);

      const payload = uploadedUrls.map((url) => ({
        url,
        location: location.trim() || undefined,
        caption: caption.trim() || undefined,
        tags,
      }));

      const res = await uploadTripPhotosAction(payload);
      if (!res.ok) throw new Error(res.error || "Save trip photos failed");

      onUploaded(res.data as TripPhotoItem[]);
      toast.success("Trip photos uploaded successfully!");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload error");
      setUploading(false);
      setUploadProgress({ completed: 0, total: 0, phase: "idle" });
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 text-[#1F1F1F] relative my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
          <div>
            <h3 className="sm:text-lg text-sm sm:font-semibold font-normal text-[#1F1F1F] tracking-tight">
              {t("trip_photos_modal_upload_title", "Upload Trip Photos")}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {t("trip_photos_modal_upload_subtitle", "Add your favorite travel memories")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleUploadSubmit} className="space-y-5">
          {/* File Select Dropzone */}
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-300 hover:border-amber-400 bg-zinc-50/80 hover:bg-amber-50/20 rounded-2xl p-5 text-center cursor-pointer transition-all disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-2 shadow-2xs">
              <IconCamera />
            </div>
            <p className="text-xs font-semibold text-zinc-800">
              {t("trip_photos_dropzone_title", "Select trip photos")}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {t("trip_photos_dropzone_note", "You can upload best images of your trip (Max 10MB each)")}
            </p>
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </div>

          {/* Selected Photo Previews Grid */}
          {previews.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-800 mb-2">
                {t("trip_photos_selected_photos", "Selected Photos")} ({previews.length})
              </p>
              <div className="grid grid-cols-4 gap-2.5 max-h-36 overflow-y-auto p-1 bg-zinc-50 rounded-2xl border border-zinc-200/80">
                {previews.map((src, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-xl overflow-hidden border border-zinc-200 group"
                  >
                    <img
                      src={src}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      disabled={uploading}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/75 hover:bg-rose-600 text-white flex items-center justify-center text-[10px] transition-colors cursor-pointer"
                      title={t("trip_photos_remove_img", "Remove image")}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploading && (
            <div
              aria-live="polite"
              className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900"
            >
              <div className="flex items-center justify-between gap-3 font-semibold">
                <span>
                  {uploadProgress.phase === "saving"
                    ? "Saving your photos..."
                    : `Uploading ${uploadProgress.completed} of ${uploadProgress.total} photos...`}
                </span>
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber-700 border-t-transparent" />
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-100">
                <div
                  className="h-full rounded-full bg-amber-600 transition-[width] duration-200"
                  style={{
                    width: `${uploadProgress.total ? (uploadProgress.completed / uploadProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Location & Tag People (2-Column Grid on Desktop) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LocationSearchInput
              value={location}
              onChange={(val) => setLocation(val)}
              disabled={uploading}
            />

            <TagPeopleInput
              selectedUsers={taggedUsers}
              onChange={(users) => setTaggedUsers(users)}
              disabled={uploading}
            />
          </div>

          {/* Caption Multiline Field with Character Counter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#1F1F1F]">
                {t("trip_photos_caption_label", "Caption")}
              </label>
              <span className="text-[11px] font-semibold text-zinc-400">
                {caption.length} / 300
              </span>
            </div>
            <textarea
              value={caption}
              maxLength={300}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("trip_photos_caption_ph", "Tell the story behind this trip...")}
              className="w-full rounded-2xl border border-zinc-200 px-3.5 py-2.5 text-xs text-[#1F1F1F] placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 h-20 resize-none transition-all shadow-2xs"
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("trip_photos_cancel", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={uploading || selectedFiles.length === 0}
              className="bg-[#FDE29B] hover:bg-[#FCD885] text-[#1F1F1F] text-xs font-semibold px-7 py-2.5 rounded-full transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {uploading
                ? t("trip_photos_uploading", "Uploading...")
                : `${t("trip_photos_upload_submit", "Upload")} (${selectedFiles.length})`}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

function EditTripPhotoModal({
  photo,
  onClose,
  onSaved,
  onDeleteTrigger,
}: {
  photo: TripPhotoItem;
  onClose: () => void;
  onSaved: (updated: TripPhotoItem) => void;
  onDeleteTrigger: (p: TripPhotoItem) => void;
}) {
  const { t } = useLanguage();
  const [location, setLocation] = useState(photo.location || "");
  const [caption, setCaption] = useState(photo.caption || "");
  const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>(
    (photo.tags || []).map((t) => ({
      id: t,
      name: t,
      email: null,
      image: null,
    })),
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const tags = taggedUsers.map((u) => u.name || u.email || u.id);

      const res = await updateTripPhotoAction(photo.id, {
        location: location.trim() || undefined,
        caption: caption.trim() || undefined,
        tags,
      });

      if (!res.ok) throw new Error(res.error || "Update photo failed");
      onSaved(res.data as TripPhotoItem);
      toast.success("Photo details updated successfully!");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save error");
      setSaving(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 text-[#1F1F1F] relative my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
          <h3 className="text-lg font-semibold text-[#1F1F1F]">
            {t("trip_photos_edit_modal_title", "Edit Photo Details")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-zinc-200 shadow-2xs">
            <Image
              src={photo.url}
              alt="Photo"
              fill
              unoptimized
              className="object-cover"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LocationSearchInput
              value={location}
              onChange={(val) => setLocation(val)}
              disabled={saving}
            />

            <TagPeopleInput
              selectedUsers={taggedUsers}
              onChange={(users) => setTaggedUsers(users)}
              disabled={saving}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#1F1F1F]">
                {t("trip_photos_caption_label", "Caption")}
              </label>
              <span className="text-[11px] font-semibold text-zinc-400">
                {caption.length} / 300
              </span>
            </div>
            <textarea
              value={caption}
              maxLength={300}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("trip_photos_caption_ph", "Tell the story behind this trip...")}
              className="w-full rounded-2xl border border-zinc-200 px-3.5 py-2.5 text-xs text-[#1F1F1F] placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 h-20 resize-none transition-all shadow-2xs"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => onDeleteTrigger(photo)}
              className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
            >
              {t("trip_photos_delete_photo_link", "Delete Photo")}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("trip_photos_cancel", "Cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-w-32 items-center justify-center gap-2 rounded-full bg-[#FEE08B] px-8 py-2.5 text-xs font-semibold text-zinc-950 shadow-2xs transition-all hover:bg-[#FDE047] disabled:cursor-wait disabled:opacity-70"
              >
                {saving ? t("trip_photos_saving_details", "Saving...") : t("trip_photos_save_details", "Save Details")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

function DeleteTripPhotoModal({
  photo,
  onClose,
  onDeleted,
}: {
  photo: TripPhotoItem;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);

    try {
      const res = await deleteTripPhotoAction(photo.id);
      if (!res.ok) throw new Error(res.error || "Delete failed");
      onDeleted(photo.id);
      toast.success("Trip photo deleted successfully.");
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Deletion error");
      setDeleting(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 text-[#1F1F1F] relative my-auto">
        <h3 className="text-lg font-semibold text-[#1F1F1F] mb-2">
          {t("trip_photos_delete_modal_title", "Delete Trip Photo")}
        </h3>
        <p className="text-xs text-zinc-500 mb-4">
          {t("trip_photos_delete_confirm", "Are you sure you want to delete this trip photo?")}
        </p>

        <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-zinc-200 mb-4">
          <Image
            src={photo.url}
            alt="Photo"
            fill
            unoptimized
            className="object-cover"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 rounded-full text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
          >
            {t("trip_photos_cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-6 py-2 rounded-full disabled:opacity-50"
          >
            {deleting ? t("trip_photos_deleting", "Deleting...") : t("trip_photos_confirm_delete", "Confirm Delete")}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function LightboxModal({
  photo,
  onClose,
}: {
  photo: TripPhotoItem;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <ModalOverlay
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center cursor-default"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 text-white text-sm font-semibold"
        >
          ✕ {t("trip_photos_lightbox_close", "Close")}
        </button>
        <div className="relative w-full h-[70vh] rounded-2xl overflow-hidden shadow-2xl">
          <Image
            src={photo.url}
            alt="Photo"
            fill
            unoptimized
            className="object-contain"
            priority
          />
        </div>
      </div>
    </ModalOverlay>
  );
}
