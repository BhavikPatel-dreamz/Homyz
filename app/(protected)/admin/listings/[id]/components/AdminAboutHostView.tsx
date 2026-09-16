"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { BUILTIN_TRAVEL_STAMPS } from "@/lib/stamps/stamps-data";
import { TravelStampGraphic } from "@/components/stamps/travel-stamp-graphics";
import { WhereIveBeenSelector } from "@/components/profile/where-ive-been-selector";
import { LANGUAGE_OPTIONS, getLanguageNameById } from "@/lib/utils/language-options";
import { adminUpdateListingHostProfileAction } from "@/actions/admin/listingActions";
import { toast } from "@/components/ui/toast";
import type { HostProfile } from "@/app/(protected)/host/listings/[id]/components/HostAndLocationViews";

const REFERENCE_INTERESTS = [
  "Architecture",
  "Cooking",
  "Food",
  "History",
  "Music",
  "Outdoors",
  "Photography",
  "Sports",
  "Travel",
] as const;

interface AdminAboutHostViewProps {
  listingId: string;
  hostProfile: HostProfile;
  onHostProfileSaved: (
    profile: Record<string, unknown>,
    hostUpdate?: Pick<HostProfile, "image">,
  ) => void;
  canEdit?: boolean;
}

function getPrompt(raw: Record<string, unknown>, key: string): string {
  const prompts = raw.prompts;
  if (!prompts || typeof prompts !== "object" || Array.isArray(prompts)) return "";
  const value = (prompts as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function getStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function getTagList(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return getStringList(value);
}

function getLanguageIds(value: unknown): string[] {
  if (Array.isArray(value)) return getStringList(value);
  if (typeof value !== "string") return [];
  return value
    .split(/,|\sand\s/i)
    .map((name) => LANGUAGE_OPTIONS.find((lang) => lang.name.toLowerCase() === name.trim().toLowerCase())?.id)
    .filter((id): id is string => Boolean(id));
}

function getInitials(name: string | null): string {
  return (name || "Host")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function AdminAboutHostView({
  listingId,
  hostProfile,
  onHostProfileSaved,
  canEdit = true,
}: AdminAboutHostViewProps) {
  const router = useRouter();

  // Baseline persisted state
  const rawProfile = useMemo(() => hostProfile.publicProfile ?? {}, [hostProfile.publicProfile]);

  // Form states
  const [bio, setBio] = useState(() => String(rawProfile.bio ?? ""));
  const [homeUnique, setHomeUnique] = useState(() => getPrompt(rawProfile, "homeUnique"));
  const [guestsShouldKnow, setGuestsShouldKnow] = useState(() => getPrompt(rawProfile, "guestsShouldKnow"));
  const [education, setEducation] = useState(() => getPrompt(rawProfile, "education"));
  const [perfectGuest, setPerfectGuest] = useState(() => getPrompt(rawProfile, "perfectGuest"));
  const [biography, setBiography] = useState(() => getPrompt(rawProfile, "biography") || String(rawProfile.bioTitle ?? ""));
  const [hobbies, setHobbies] = useState<string[]>(() =>
    getTagList(rawProfile.prompts && typeof rawProfile.prompts === "object" ? (rawProfile.prompts as Record<string, unknown>).hobbies : []),
  );
  const [languages, setLanguages] = useState<string[]>(() => getLanguageIds(rawProfile.languages));
  const [interests, setInterests] = useState<string[]>(() => getStringList(rawProfile.interests));
  const [stampsVisible, setStampsVisible] = useState(rawProfile.stampsVisible !== false);
  const [selectedStamps, setSelectedStamps] = useState<string[]>(() =>
    Array.isArray(rawProfile.selectedStamps) ? rawProfile.selectedStamps.filter((v): v is string => typeof v === "string") : [],
  );

  // Local transient states for adding items
  const [hobbyInput, setHobbyInput] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [languageSearch, setLanguageSearch] = useState("");
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [isStampEditorOpen, setIsStampEditorOpen] = useState(false);

  // Status & feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Compute dirty state
  const isDirty = useMemo(() => {
    const initialBio = String(rawProfile.bio ?? "");
    const initialHomeUnique = getPrompt(rawProfile, "homeUnique");
    const initialGuestsShouldKnow = getPrompt(rawProfile, "guestsShouldKnow");
    const initialEducation = getPrompt(rawProfile, "education");
    const initialPerfectGuest = getPrompt(rawProfile, "perfectGuest");
    const initialBiography = getPrompt(rawProfile, "biography") || String(rawProfile.bioTitle ?? "");
    const initialHobbies = getTagList(rawProfile.prompts && typeof rawProfile.prompts === "object" ? (rawProfile.prompts as Record<string, unknown>).hobbies : []);
    const initialLanguages = getLanguageIds(rawProfile.languages);
    const initialInterests = getStringList(rawProfile.interests);
    const initialStampsVisible = rawProfile.stampsVisible !== false;
    const initialStamps = Array.isArray(rawProfile.selectedStamps) ? rawProfile.selectedStamps.filter((v): v is string => typeof v === "string") : [];

    return (
      bio !== initialBio ||
      homeUnique !== initialHomeUnique ||
      guestsShouldKnow !== initialGuestsShouldKnow ||
      education !== initialEducation ||
      perfectGuest !== initialPerfectGuest ||
      biography !== initialBiography ||
      JSON.stringify(hobbies) !== JSON.stringify(initialHobbies) ||
      JSON.stringify(languages) !== JSON.stringify(initialLanguages) ||
      JSON.stringify(interests) !== JSON.stringify(initialInterests) ||
      stampsVisible !== initialStampsVisible ||
      JSON.stringify(selectedStamps) !== JSON.stringify(initialStamps)
    );
  }, [
    rawProfile,
    bio,
    homeUnique,
    guestsShouldKnow,
    education,
    perfectGuest,
    biography,
    hobbies,
    languages,
    interests,
    stampsVisible,
    selectedStamps,
  ]);

  // Derive authoritative tenure (years since registration)
  const hostingTenure = useMemo(() => {
    if (!hostProfile.createdAt) return "New host";
    const startYear = new Date(hostProfile.createdAt).getFullYear();
    const currentYear = new Date().getFullYear();
    const diff = Math.max(0, currentYear - startYear);
    return diff >= 1 ? `Hosting for ${diff} year${diff > 1 ? "s" : ""}` : "New host (< 1 year)";
  }, [hostProfile.createdAt]);

  // Derive rating (system information, read-only)
  const hostRating = useMemo(() => {
    const r = (hostProfile as any).rating;
    if (typeof r === "number" && r > 0) return `★ ${r.toFixed(1)}`;
    return "New host";
  }, [hostProfile]);

  // Discard changes & restore initial persisted values
  const handleCancel = () => {
    setBio(String(rawProfile.bio ?? ""));
    setHomeUnique(getPrompt(rawProfile, "homeUnique"));
    setGuestsShouldKnow(getPrompt(rawProfile, "guestsShouldKnow"));
    setEducation(getPrompt(rawProfile, "education"));
    setPerfectGuest(getPrompt(rawProfile, "perfectGuest"));
    setBiography(getPrompt(rawProfile, "biography") || String(rawProfile.bioTitle ?? ""));
    setHobbies(getTagList(rawProfile.prompts && typeof rawProfile.prompts === "object" ? (rawProfile.prompts as Record<string, unknown>).hobbies : []));
    setLanguages(getLanguageIds(rawProfile.languages));
    setInterests(getStringList(rawProfile.interests));
    setStampsVisible(rawProfile.stampsVisible !== false);
    setSelectedStamps(Array.isArray(rawProfile.selectedStamps) ? rawProfile.selectedStamps.filter((v): v is string => typeof v === "string") : []);
    setFeedback(null);
  };

  // Save changes to database via Admin Server Action
  const handleSave = async () => {
    if (!canEdit || !isDirty || isSaving) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const payload = {
        bio,
        prompts: {
          homeUnique: homeUnique.trim() || undefined,
          guestsShouldKnow: guestsShouldKnow.trim() || undefined,
          hobbies: hobbies.length > 0 ? hobbies : undefined,
          education: education.trim() || undefined,
          perfectGuest: perfectGuest.trim() || undefined,
          biography: biography.trim() || undefined,
        },
        languages,
        interests,
        stampsVisible,
        selectedStamps,
      };

      const result = await adminUpdateListingHostProfileAction({
        listingId,
        profile: payload,
      });

      setIsSaving(false);

      if (result.ok) {
        if (result.data) {
          onHostProfileSaved(result.data);
        }
        const successMsg = "Host profile changes saved successfully. Changes are shared across all of this host's listings.";
        toast.success(successMsg);
        setFeedback({
          type: "success",
          text: successMsg,
        });
        router.refresh();
      } else {
        const errorMsg = result.error || "Failed to save host profile.";
        toast.error(errorMsg);
        setFeedback({
          type: "error",
          text: errorMsg,
        });
      }
    } catch (err: any) {
      setIsSaving(false);
      const errorMsg = "Error saving host profile: " + (err.message || String(err));
      toast.error(errorMsg);
      setFeedback({
        type: "error",
        text: errorMsg,
      });
    }
  };

  // Add hobby tag
  const addHobby = () => {
    const trimmed = hobbyInput.trim();
    if (!trimmed) return;
    if (!hobbies.some((h) => h.toLowerCase() === trimmed.toLowerCase())) {
      setHobbies((prev) => [...prev, trimmed]);
    }
    setHobbyInput("");
  };

  const removeHobby = (index: number) => {
    setHobbies((prev) => prev.filter((_, i) => i !== index));
  };

  // Add interest tag
  const addInterest = (interestToAdd: string) => {
    const trimmed = interestToAdd.trim();
    if (!trimmed) return;
    if (!interests.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setInterests((prev) => [...prev, trimmed]);
    }
    setInterestInput("");
  };

  const removeInterest = (interestToRemove: string) => {
    setInterests((prev) => prev.filter((item) => item.toLowerCase() !== interestToRemove.toLowerCase()));
  };

  // Toggle language
  const addLanguage = (langId: string) => {
    if (!languages.includes(langId)) {
      setLanguages((prev) => [...prev, langId]);
    }
    setLanguageSearch("");
    setIsLanguageDropdownOpen(false);
  };

  const removeLanguage = (langId: string) => {
    setLanguages((prev) => prev.filter((id) => id !== langId));
  };

  const filteredLanguages = useMemo(() => {
    const search = languageSearch.trim().toLowerCase();
    return LANGUAGE_OPTIONS.filter((lang) => {
      const alreadySelected = languages.includes(lang.id);
      if (alreadySelected) return false;
      if (!search) return true;
      return (
        lang.name.toLowerCase().includes(search) ||
        lang.id.toLowerCase().includes(search) ||
        (lang.nativeName && lang.nativeName.toLowerCase().includes(search))
      );
    }).slice(0, 10);
  }, [languages, languageSearch]);

  return (
    <div className="w-full max-w-4xl space-y-6 pb-20 font-sans text-zinc-900 animate-in fade-in duration-200">
      {/* 1. Header with Breadcrumb & Admin Context */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md">
            Admin Workspace
          </span>
          <span className="text-zinc-400">/</span>
          <span className="text-xs font-semibold text-zinc-500">Your Space</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950 mt-2">
          About Host
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Manage the public profile, background details, languages, and travel information for this listing&apos;s host.
        </p>
      </div>

      {!canEdit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>You have view-only access for listing management. Editable fields are disabled.</span>
        </div>
      )}

      {/* 2. Host Profile Card (Admin Card) */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-zinc-100">
          <div className="flex items-center gap-4">
            <div className="relative h-18 w-18 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-2xs">
              {hostProfile.image ? (
                <img
                  src={hostProfile.image}
                  alt={`${hostProfile.name || "Host"} avatar`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-indigo-50 text-xl font-bold text-indigo-700">
                  {getInitials(hostProfile.name)}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-zinc-950 leading-tight">
                  {hostProfile.name || "Unnamed Host"}
                </h2>
                <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                  Primary Host
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-mono">
                ID: {hostProfile.name ? `host-${hostProfile.name.toLowerCase().replace(/\s+/g, "")}` : "N/A"}
              </p>
            </div>
          </div>

          {/* System Information: Rating & Tenure (Strictly Read-Only) */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50 px-4 py-2.5 text-center min-w-[110px]">
              <span className="text-xs text-zinc-500 block uppercase font-bold tracking-wider text-[10px]">
                Host Rating
              </span>
              <span className="text-sm font-bold text-zinc-900 mt-0.5 block flex items-center justify-center gap-1">
                {hostRating}
              </span>
              <span className="text-[9px] text-zinc-400 block mt-0.5 font-medium">System derived</span>
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50 px-4 py-2.5 text-center min-w-[130px]">
              <span className="text-xs text-zinc-500 block uppercase font-bold tracking-wider text-[10px]">
                Hosting Tenure
              </span>
              <span className="text-sm font-bold text-zinc-900 mt-0.5 block">
                {hostingTenure}
              </span>
              <span className="text-[9px] text-zinc-400 block mt-0.5 font-medium">Account age</span>
            </div>
          </div>
        </div>

        <div className="pt-4 flex items-center justify-between text-xs text-zinc-500">
          <p>
            Host profile data is stored globally on the host account and displayed across their public listings.
          </p>
        </div>
      </section>

      {/* 3. Host Details (Admin Card) */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-6">
        <div>
          <h2 className="text-base font-bold text-zinc-950 tracking-tight">Host Details</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Structured highlights and personality prompts displayed to guests.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* What makes your home unique */}
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <label htmlFor="homeUnique" className="text-xs font-bold text-zinc-800">
                What makes your home unique
              </label>
              <span className="text-[11px] text-zinc-400">{homeUnique.length}/500</span>
            </div>
            <textarea
              id="homeUnique"
              rows={2}
              maxLength={500}
              disabled={!canEdit}
              value={homeUnique}
              onChange={(e) => setHomeUnique(e.target.value)}
              placeholder="e.g. Peaceful backyard terrace overlooking the city hills with direct garden access."
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100 disabled:cursor-not-allowed transition-colors"
            />
          </div>

          {/* What guests should know */}
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <label htmlFor="guestsShouldKnow" className="text-xs font-bold text-zinc-800">
                What guests should know
              </label>
              <span className="text-[11px] text-zinc-400">{guestsShouldKnow.length}/500</span>
            </div>
            <textarea
              id="guestsShouldKnow"
              rows={2}
              maxLength={500}
              disabled={!canEdit}
              value={guestsShouldKnow}
              onChange={(e) => setGuestsShouldKnow(e.target.value)}
              placeholder="e.g. I respond promptly to guest messages and love sharing local restaurant recommendations."
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100 disabled:cursor-not-allowed transition-colors"
            />
          </div>

          {/* Languages spoken (Multi-select) */}
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-800">
                Languages spoken
              </label>
              <span className="text-[11px] text-zinc-400">{languages.length} selected</span>
            </div>

            {/* Selected Language Chips */}
            <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] p-2 rounded-xl border border-zinc-200 bg-zinc-50/70">
              {languages.length === 0 ? (
                <span className="text-xs text-zinc-400 px-1 italic">No languages selected yet</span>
              ) : (
                languages.map((langId) => (
                  <span
                    key={langId}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-800 shadow-2xs"
                  >
                    <span>{getLanguageNameById(langId)}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => removeLanguage(langId)}
                        className="text-zinc-400 hover:text-zinc-700 cursor-pointer ml-0.5"
                        aria-label={`Remove ${getLanguageNameById(langId)}`}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>

            {/* Add Language Combobox */}
            {canEdit && (
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={languageSearch}
                    onChange={(e) => {
                      setLanguageSearch(e.target.value);
                      setIsLanguageDropdownOpen(true);
                    }}
                    onFocus={() => setIsLanguageDropdownOpen(true)}
                    placeholder="Search and add languages (e.g. English, Arabic, Spanish)..."
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
                  />
                  {isLanguageDropdownOpen && (
                    <button
                      type="button"
                      onClick={() => setIsLanguageDropdownOpen(false)}
                      className="rounded-xl border border-zinc-300 px-3 text-xs text-zinc-600 hover:bg-zinc-100"
                    >
                      Done
                    </button>
                  )}
                </div>

                {isLanguageDropdownOpen && filteredLanguages.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg divide-y divide-zinc-50">
                    {filteredLanguages.map((lang) => (
                      <li key={lang.id}>
                        <button
                          type="button"
                          onClick={() => addLanguage(lang.id)}
                          className="w-full px-4 py-2 text-left text-xs font-medium text-zinc-800 hover:bg-zinc-50 flex items-center justify-between cursor-pointer"
                        >
                          <span>{lang.name}</span>
                          {lang.nativeName && (
                            <span className="text-[11px] text-zinc-400">{lang.nativeName}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* My hobbies */}
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-800">
                My hobbies
              </label>
              <span className="text-[11px] text-zinc-400">{hobbies.length}/20 tags</span>
            </div>

            {/* Hobby Tags */}
            <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] p-2 rounded-xl border border-zinc-200 bg-zinc-50/70">
              {hobbies.length === 0 ? (
                <span className="text-xs text-zinc-400 px-1 italic">No hobbies added yet</span>
              ) : (
                hobbies.map((hobby, index) => (
                  <span
                    key={`${hobby}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-800 shadow-2xs"
                  >
                    <span>{hobby}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => removeHobby(index)}
                        className="text-zinc-400 hover:text-zinc-700 cursor-pointer ml-0.5"
                        aria-label={`Remove ${hobby}`}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>

            {/* Add Hobby Input */}
            {canEdit && (
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={60}
                  value={hobbyInput}
                  onChange={(e) => setHobbyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addHobby();
                    }
                  }}
                  placeholder="Type a hobby and press enter (e.g. Scuba diving, Gardening)..."
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
                />
                <button
                  type="button"
                  onClick={addHobby}
                  disabled={!hobbyInput.trim()}
                  className="rounded-xl bg-zinc-900 text-white px-4 py-2 text-xs font-semibold hover:bg-black disabled:bg-zinc-200 disabled:text-zinc-400 cursor-pointer"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Education / background */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="education" className="text-xs font-bold text-zinc-800">
                Education / background
              </label>
              <span className="text-[11px] text-zinc-400">{education.length}/300</span>
            </div>
            <input
              id="education"
              type="text"
              maxLength={300}
              disabled={!canEdit}
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              placeholder="e.g. Architecture Degree from King Saud University"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* Biography headline prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="biography" className="text-xs font-bold text-zinc-800">
                Biography headline
              </label>
              <span className="text-[11px] text-zinc-400">{biography.length}/500</span>
            </div>
            <input
              id="biography"
              type="text"
              maxLength={500}
              disabled={!canEdit}
              value={biography}
              onChange={(e) => setBiography(e.target.value)}
              placeholder="e.g. Architect & World Traveler hosting in Riyadh"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* My perfect guest */}
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <label htmlFor="perfectGuest" className="text-xs font-bold text-zinc-800">
                My perfect guest
              </label>
              <span className="text-[11px] text-zinc-400">{perfectGuest.length}/300</span>
            </div>
            <input
              id="perfectGuest"
              type="text"
              maxLength={300}
              disabled={!canEdit}
              value={perfectGuest}
              onChange={(e) => setPerfectGuest(e.target.value)}
              placeholder="e.g. Respectful travelers who appreciate thoughtful architecture and quiet evenings."
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100 disabled:cursor-not-allowed"
            />
            <p className="text-[11px] text-zinc-400 italic">
              Profile note only; does not affect guest eligibility or automated booking rules.
            </p>
          </div>
        </div>
      </section>

      {/* 4. About Me (Long-Form Textarea) */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-950 tracking-tight">About Me</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Long-form host biography displayed on the public property listing page and the host profile.
            </p>
          </div>
          <span className="text-xs text-zinc-400 font-mono">{bio.length}/2000</span>
        </div>

        <textarea
          rows={5}
          maxLength={2000}
          disabled={!canEdit}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell guests about your background, your hosting style, what you love about your city, and what makes your stays memorable..."
          className="w-full rounded-xl border border-zinc-300 bg-white p-3.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100 disabled:cursor-not-allowed leading-relaxed"
        />
      </section>

      {/* 5. Where I've Been (Travel Stamps & Public Visibility) */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-bold text-zinc-950 tracking-tight">Where I&apos;ve Been</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Travel stamps showcasing places and experiences the host has visited.
            </p>
          </div>

          {/* Visibility Toggle [ ON / OFF ] */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-semibold text-zinc-700">
              Show on public profile:
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={stampsVisible}
              disabled={!canEdit}
              onClick={() => setStampsVisible((v) => !v)}
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed ${
                stampsVisible
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200"
                  : "bg-zinc-200 text-zinc-700 border border-zinc-300 hover:bg-zinc-300"
              }`}
            >
              [ {stampsVisible ? "ON" : "OFF"} ]
            </button>
          </div>
        </div>

        {/* Travel Stamps Gallery */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 min-h-[90px] p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
            {selectedStamps.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">No travel stamps selected yet.</p>
            ) : (
              selectedStamps.map((stampId) => {
                const stamp = BUILTIN_TRAVEL_STAMPS.find((item) => item.id === stampId);
                if (!stamp) return null;
                return (
                  <div key={stamp.id} className="overflow-hidden rounded-xl bg-white border border-zinc-200 shadow-2xs p-1">
                    <TravelStampGraphic stamp={stamp} size="sm" />
                  </div>
                );
              })
            )}
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setIsStampEditorOpen(true)}
              className="rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 px-4 py-2 text-xs font-semibold shadow-2xs cursor-pointer"
            >
              Manage travel stamps ({selectedStamps.length}/10)
            </button>
          )}
        </div>

        {/* Modal for selecting travel stamps */}
        {isStampEditorOpen && (
          <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200">
              <div className="mb-4 flex items-center justify-between border-b border-zinc-200 pb-3">
                <div>
                  <h3 className="text-base font-bold text-zinc-950">Select Travel Stamps</h3>
                  <p className="text-xs text-zinc-500">Pick up to 10 stamps for the host&apos;s public profile.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStampEditorOpen(false)}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
                >
                  ✕ Close
                </button>
              </div>

              <WhereIveBeenSelector
                initialSelectedStamps={selectedStamps}
                initialStampsVisible={stampsVisible}
                currentPublicProfile={rawProfile}
                maxStamps={10}
                isOwner={true}
                onSaved={(updatedProfile) => {
                  if (Array.isArray(updatedProfile.selectedStamps)) {
                    setSelectedStamps(updatedProfile.selectedStamps as string[]);
                  }
                  if (typeof updatedProfile.stampsVisible === "boolean") {
                    setStampsVisible(updatedProfile.stampsVisible);
                  }
                  setIsStampEditorOpen(false);
                }}
              />
            </div>
          </ModalOverlay>
        )}
      </section>

      {/* 6. My Interests (Multi-select, Selected Chips with [ × ], + Add Interest) */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-950 tracking-tight">My Interests</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Personal interests and topics displayed on the host&apos;s profile.
            </p>
          </div>
          <span className="text-xs text-zinc-400 font-mono">{interests.length}/20</span>
        </div>

        {/* Selected Chips with [ × ] */}
        <div className="flex flex-wrap items-center gap-2 min-h-[44px] p-3 rounded-xl border border-zinc-200 bg-zinc-50/70">
          {interests.length === 0 ? (
            <span className="text-xs text-zinc-400 italic">No interests selected yet</span>
          ) : (
            interests.map((interest) => (
              <span
                key={interest}
                className="inline-flex items-center gap-1.5 rounded-full bg-white border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-800 shadow-2xs hover:border-zinc-400 transition-colors"
              >
                <span>{interest}</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeInterest(interest)}
                    className="text-zinc-400 hover:text-rose-600 transition-colors cursor-pointer text-xs ml-0.5"
                    aria-label={`Remove ${interest}`}
                  >
                    ✕
                  </button>
                )}
              </span>
            ))
          )}
        </div>

        {/* Quick-Add from Reference Dataset */}
        {canEdit && (
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
              Suggested Interests
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {REFERENCE_INTERESTS.map((refInterest) => {
                const isSelected = interests.some((item) => item.toLowerCase() === refInterest.toLowerCase());
                if (isSelected) return null;
                return (
                  <button
                    key={refInterest}
                    type="button"
                    onClick={() => addInterest(refInterest)}
                    className="rounded-full border border-dashed border-zinc-300 bg-white hover:bg-zinc-50 hover:border-zinc-400 text-zinc-700 px-3 py-1 text-xs font-medium transition-colors cursor-pointer"
                  >
                    + {refInterest}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Interest Input */}
        {canEdit && (
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              maxLength={60}
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addInterest(interestInput);
                }
              }}
              placeholder="Add custom interest..."
              className="w-full max-w-xs rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
            />
            <button
              type="button"
              onClick={() => addInterest(interestInput)}
              disabled={!interestInput.trim()}
              className="rounded-xl bg-zinc-900 text-white px-4 py-2 text-xs font-semibold hover:bg-black disabled:bg-zinc-200 disabled:text-zinc-400 cursor-pointer"
            >
              + Add interest
            </button>
          </div>
        )}
      </section>

      {/* 7. Feedback Alerts */}
      {feedback && (
        <div
          role="alert"
          className={`rounded-xl border p-4 text-xs font-medium flex items-center gap-2 animate-in fade-in ${
            feedback.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-rose-300 bg-rose-50 text-rose-900"
          }`}
        >
          {feedback.type === "success" ? (
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 8. Sticky Action Buttons: [ Cancel ]  [ Save ] */}
      {canEdit && (
        <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {isDirty ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved changes
              </span>
            ) : (
              <span className="text-xs text-zinc-400">All changes saved</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!isDirty || isSaving}
              onClick={handleCancel}
              className="rounded-xl border border-zinc-300 bg-white px-5 py-2 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!isDirty || isSaving}
              onClick={handleSave}
              className="rounded-xl bg-zinc-900 px-6 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-black disabled:cursor-not-allowed disabled:bg-zinc-300 cursor-pointer transition-colors"
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

