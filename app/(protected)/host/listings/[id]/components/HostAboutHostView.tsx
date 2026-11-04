"use client";
/* eslint-disable react-hooks/set-state-in-effect -- local editable profile state must follow saved server data. */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "@/components/ui/toast";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { CloseIcon } from "@/components/ui/close-icon";
import { updateProfileAction } from "@/actions/user/updateProfile";
import { LANGUAGE_OPTIONS, getLanguageNameById } from "@/lib/utils/language-options";
import type { HostProfile } from "@/app/(protected)/host/listings/[id]/components/HostAndLocationViews";
import { useLanguage, type TranslationKey } from "@/lib/i18n/language-context";
import { AboutHostSkeleton } from "./YourSpaceSkeletons";

export type HostAboutData = {
  rating: number | null;
  reviewCount: number;
  reviews: Array<{
    id: string;
    author: { name: string | null; image: string | null };
    rating: number;
    comment: string;
    createdAt: string;
  }>;
  listings: Array<{
    id: string;
    title: string;
    propertyType: string | null;
    listingType: string | null;
    photos: string[];
    rating: number | null;
    reviewCount: number;
  }>;
};

export interface HostAboutHostViewProps {
  listingId: string;
  hostProfile: HostProfile;
  onHostProfileSaved: (
    profile: Record<string, unknown>,
    hostUpdate?: Pick<HostProfile, "image">,
  ) => void;
  hostAbout?: HostAboutData;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function getInitials(name: string | null): string {
  return (name || "Host")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getYearsHosting(createdAt: Date | string): number {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  const now = new Date();
  const years = Math.max(
    0,
    now.getFullYear() -
    created.getFullYear() -
    Number(
      now.getMonth() < created.getMonth() ||
      (now.getMonth() === created.getMonth() && now.getDate() < created.getDate()),
    ),
  );
  return years;
}

function formatReviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(date);
}

function ChevronLeftIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Prompt definitions (matching Airbnb screenshots)
// ---------------------------------------------------------------------------

type PromptItem = {
  key: string;
  label: string;
  icon: string;
  placeholder: string;
};

const PROMPT_DEFINITIONS: Array<{
  key: string;
  labelKey: TranslationKey;
  defaultLabel: string;
  icon: string;
  placeholderKey: TranslationKey;
  defaultPlaceholder: string;
}> = [
  { key: "decadeBorn", labelKey: "host_about_prompt_decade_born_label", defaultLabel: "Decade I was born", icon: "💡", placeholderKey: "host_about_prompt_decade_born_placeholder", defaultPlaceholder: "e.g. 90s, 80s, 70s" },
  { key: "whereIWantToGo", labelKey: "host_about_prompt_where_to_go_label", defaultLabel: "Where I've always wanted to go", icon: "🌐", placeholderKey: "host_about_prompt_where_to_go_placeholder", defaultPlaceholder: "e.g. USA, Japan, New Zealand" },
  { key: "myWork", labelKey: "host_about_prompt_my_work_label", defaultLabel: "My work", icon: "💼", placeholderKey: "host_about_prompt_my_work_placeholder", defaultPlaceholder: "e.g. Architect, Software Engineer" },
  { key: "homeUnique", labelKey: "host_about_prompt_home_unique_label", defaultLabel: "What makes my home unique", icon: "✨", placeholderKey: "host_about_prompt_home_unique_placeholder_short", defaultPlaceholder: "e.g. Sunny rooftop, quiet garden" },
  { key: "forGuests", labelKey: "host_about_prompt_for_guests_label", defaultLabel: "For guests, I always", icon: "🤝", placeholderKey: "host_about_prompt_for_guests_placeholder", defaultPlaceholder: "e.g. Provide fresh coffee & local tips" },
  { key: "school", labelKey: "host_about_prompt_school_label", defaultLabel: "Where I went to school", icon: "🎓", placeholderKey: "host_about_prompt_school_placeholder", defaultPlaceholder: "e.g. Harvard, Stanford, NYU" },
  { key: "uselessSkill", labelKey: "host_about_prompt_useless_skill_label", defaultLabel: "My most useless skill", icon: "🪄", placeholderKey: "host_about_prompt_useless_skill_placeholder", defaultPlaceholder: "e.g. I can wiggle my ears" },
  { key: "spendTooMuchTime", labelKey: "host_about_prompt_spend_time_label", defaultLabel: "I spend too much time", icon: "⏰", placeholderKey: "host_about_prompt_spend_time_placeholder", defaultPlaceholder: "e.g. coding, reading, cooking" },
  { key: "funFact", labelKey: "host_about_prompt_fun_fact_label", defaultLabel: "My fun fact", icon: "💡", placeholderKey: "host_about_prompt_fun_fact_placeholder", defaultPlaceholder: "e.g. I have traveled to 25 countries" },
  { key: "languages", labelKey: "host_about_prompt_languages_label", defaultLabel: "Languages I speak", icon: "🌐", placeholderKey: "host_about_prompt_languages_placeholder", defaultPlaceholder: "e.g. Arabic and English" },
  { key: "bioTitle", labelKey: "host_about_prompt_bio_title_label", defaultLabel: "My biography title would be", icon: "📖", placeholderKey: "host_about_prompt_bio_title_placeholder", defaultPlaceholder: "e.g. The Curious Nomad" },
  { key: "obsessedWith", labelKey: "host_about_prompt_obsessed_label", defaultLabel: "I'm obsessed with", icon: "🤍", placeholderKey: "host_about_prompt_obsessed_placeholder", defaultPlaceholder: "e.g. Sourdough baking, espresso" },
  { key: "whereILive", labelKey: "host_about_prompt_where_i_live_label", defaultLabel: "Where I live", icon: "📍", placeholderKey: "host_about_prompt_where_i_live_placeholder", defaultPlaceholder: "e.g. Riyadh, Saudi Arabia" },
  { key: "breakfast", labelKey: "host_about_prompt_breakfast_label", defaultLabel: "What's for breakfast", icon: "☕", placeholderKey: "host_about_prompt_breakfast_placeholder", defaultPlaceholder: "e.g. Scrambled eggs & fresh juice" },
  { key: "pets", labelKey: "host_about_prompt_pets_label", defaultLabel: "Pets", icon: "🐾", placeholderKey: "host_about_prompt_pets_placeholder", defaultPlaceholder: "e.g. Dogs, Cats, Parrots" },
];

// ---------------------------------------------------------------------------
// All Available Interests (matching Airbnb Screenshot)
// ---------------------------------------------------------------------------

type RawInterestOption = {
  id: string;
  defaultLabel: string;
  key: TranslationKey;
  icon: string;
};

const RAW_PRIMARY_INTERESTS: RawInterestOption[] = [
  { id: "films", defaultLabel: "Films", key: "interest_films", icon: "🎬" },
  { id: "food_scenes", defaultLabel: "Food scenes", key: "interest_food_scenes", icon: "🍲" },
  { id: "shopping", defaultLabel: "Shopping", key: "interest_shopping", icon: "🛍️" },
  { id: "swimming", defaultLabel: "Swimming", key: "interest_swimming", icon: "🏊" },
  { id: "outdoors", defaultLabel: "Outdoors", key: "interest_outdoors", icon: "🏕️" },
  { id: "live_music", defaultLabel: "Live music", key: "interest_live_music", icon: "🎵" },
  { id: "photography", defaultLabel: "Photography", key: "interest_photography", icon: "📷" },
  { id: "coffee", defaultLabel: "Coffee", key: "interest_coffee", icon: "☕" },
  { id: "cooking", defaultLabel: "Cooking", key: "interest_cooking", icon: "🍳" },
  { id: "local_culture", defaultLabel: "Local culture", key: "interest_local_culture", icon: "🏛️" },
  { id: "walking", defaultLabel: "Walking", key: "interest_walking", icon: "🚶" },
  { id: "animals", defaultLabel: "Animals", key: "interest_animals", icon: "🐾" },
  { id: "reading", defaultLabel: "Reading", key: "interest_reading", icon: "📖" },
  { id: "hiking", defaultLabel: "Hiking", key: "interest_hiking", icon: "🥾" },
  { id: "wine", defaultLabel: "Wine", key: "interest_wine", icon: "🍷" },
  { id: "fitness", defaultLabel: "Fitness", key: "interest_fitness", icon: "🏋️" },
];

const RAW_ADDITIONAL_INTERESTS: RawInterestOption[] = [
  { id: "art", defaultLabel: "Art", key: "interest_art", icon: "🎨" },
  { id: "architecture", defaultLabel: "Architecture", key: "interest_architecture", icon: "🏛️" },
  { id: "nature", defaultLabel: "Nature", key: "interest_nature", icon: "🌿" },
  { id: "sports", defaultLabel: "Sports", key: "interest_sports", icon: "⚽" },
  { id: "travel", defaultLabel: "Travel", key: "interest_travel", icon: "✈️" },
  { id: "history", defaultLabel: "History", key: "interest_history", icon: "📜" },
  { id: "gaming", defaultLabel: "Gaming", key: "interest_gaming", icon: "🎮" },
  { id: "yoga", defaultLabel: "Yoga", key: "interest_yoga", icon: "🧘" },
];

// Clean line SVG icons for the host-interest grid (supports id and labels).
const ASK_ABOUT_ICONS: Record<string, React.ReactNode> = {
  architecture: (
    <svg className="size-5 shrink-0 text-[#222222] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="9" y1="6" x2="9" y2="6.01" />
      <line x1="15" y1="6" x2="15" y2="6.01" />
      <line x1="9" y1="10" x2="9" y2="10.01" />
      <line x1="15" y1="10" x2="15" y2="10.01" />
      <line x1="9" y1="14" x2="9" y2="14.01" />
      <line x1="15" y1="14" x2="15" y2="14.01" />
      <path d="M9 18h6" />
    </svg>
  ),
  Architecture: (
    <svg className="size-5 shrink-0 text-[#1f1f1f] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="9" y1="6" x2="9" y2="6.01" />
      <line x1="15" y1="6" x2="15" y2="6.01" />
      <line x1="9" y1="10" x2="9" y2="10.01" />
      <line x1="15" y1="10" x2="15" y2="10.01" />
      <line x1="9" y1="14" x2="9" y2="14.01" />
      <line x1="15" y1="14" x2="15" y2="14.01" />
      <path d="M9 18h6" />
    </svg>
  ),
  cooking: (
    <svg className="size-5 shrink-0 text-[#222222] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 3v5a4 4 0 0 1-4 4H10A4 4 0 0 1 6 8V3" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <line x1="10" y1="3" x2="10" y2="7" />
      <line x1="14" y1="3" x2="14" y2="7" />
    </svg>
  ),
  Cooking: (
    <svg className="size-5 shrink-0 text-[#1f1f1f] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 3v5a4 4 0 0 1-4 4H10A4 4 0 0 1 6 8V3" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <line x1="10" y1="3" x2="10" y2="7" />
      <line x1="14" y1="3" x2="14" y2="7" />
    </svg>
  ),
  food_scenes: (
    <svg className="size-5 shrink-0 text-[#222222] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18h18" />
      <path d="M4 18a8 8 0 0 1 16 0" />
      <circle cx="12" cy="7" r="1" />
      <line x1="12" y1="8" x2="12" y2="10" />
    </svg>
  ),
  "Food scenes": (
    <svg className="size-5 shrink-0 text-[#1f1f1f] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18h18" />
      <path d="M4 18a8 8 0 0 1 16 0" />
      <circle cx="12" cy="7" r="1" />
      <line x1="12" y1="8" x2="12" y2="10" />
    </svg>
  ),
  history: (
    <svg className="size-5 shrink-0 text-[#222222] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="3" y1="3" x2="21" y2="3" />
      <line x1="7" y1="3" x2="7" y2="21" />
      <line x1="17" y1="3" x2="17" y2="21" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  ),
  History: (
    <svg className="size-5 shrink-0 text-[#1f1f1f] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="3" y1="3" x2="21" y2="3" />
      <line x1="7" y1="3" x2="7" y2="21" />
      <line x1="17" y1="3" x2="17" y2="21" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  ),
  sports: (
    <svg className="size-5 shrink-0 text-[#222222] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18" />
      <path d="M3 12a9 9 0 0 0 18 0" />
    </svg>
  ),
  "Live sports": (
    <svg className="size-5 shrink-0 text-[#1f1f1f] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18" />
      <path d="M3 12a9 9 0 0 0 18 0" />
    </svg>
  ),
  museums: (
    <svg className="size-5 shrink-0 text-[#222222] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 2L2 7h20L12 2z" />
    </svg>
  ),
  Museums: (
    <svg className="size-5 shrink-0 text-[#1f1f1f] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 2L2 7h20L12 2z" />
    </svg>
  ),
  outdoors: (
    <svg className="size-5 shrink-0 text-[#222222] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3l4 8H4l4-8z" />
      <path d="M14 8l5 10H9l5-10z" />
      <line x1="3" y1="21" x2="21" y2="21" />
    </svg>
  ),
  Outdoors: (
    <svg className="size-5 shrink-0 text-[#1f1f1f] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3l4 8H4l4-8z" />
      <path d="M14 8l5 10H9l5-10z" />
      <line x1="3" y1="21" x2="21" y2="21" />
    </svg>
  ),
  shopping: (
    <svg className="size-5 shrink-0 text-[#222222] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  Shopping: (
    <svg className="size-5 shrink-0 text-[#1f1f1f] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  gaming: (
    <svg className="size-5 shrink-0 text-[#222222] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="4" />
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <circle cx="15" cy="13" r="1" fill="currentColor" />
      <circle cx="18" cy="11" r="1" fill="currentColor" />
    </svg>
  ),
  "Video games": (
    <svg className="size-5 shrink-0 text-[#1f1f1f] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="4" />
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <circle cx="15" cy="13" r="1" fill="currentColor" />
      <circle cx="18" cy="11" r="1" fill="currentColor" />
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function HostAboutHostView({
  hostProfile,
  onHostProfileSaved,
  hostAbout,
  isLoading = false,
}: HostAboutHostViewProps) {
  const { t } = useLanguage();

  // Mode switch: "edit" vs "view" (public profile preview matching screenshot)
  const [activeTab, setActiveTab] = useState<"edit" | "view">("view");

  // Local synced copy of public profile
  const [profile, setProfile] = useState<Record<string, unknown>>(() => hostProfile.publicProfile ?? {});
  const [hostImage, setHostImage] = useState<string | null>(hostProfile.image ?? null);

  useEffect(() => {
    setProfile(hostProfile.publicProfile ?? {});
    setHostImage(hostProfile.image ?? null);
  }, [hostProfile.publicProfile, hostProfile.image]);

  const prompts = useMemo(() => getRecord(profile.prompts), [profile]);
  const hostName = hostProfile.name || t("host_about_host_badge", "Host");

  // Dynamically translated prompt items
  const promptItems: PromptItem[] = useMemo(() => {
    return PROMPT_DEFINITIONS.map((def) => ({
      key: def.key,
      label: t(def.labelKey, def.defaultLabel),
      icon: def.icon,
      placeholder: t(def.placeholderKey, def.defaultPlaceholder),
    }));
  }, [t]);

  // Dynamically translated interests
  const primaryInterests = useMemo(() => {
    return RAW_PRIMARY_INTERESTS.map((item) => ({
      id: item.id,
      label: t(item.key, item.defaultLabel),
      icon: item.icon,
      defaultLabel: item.defaultLabel,
    }));
  }, [t]);

  const additionalInterests = useMemo(() => {
    return RAW_ADDITIONAL_INTERESTS.map((item) => ({
      id: item.id,
      label: t(item.key, item.defaultLabel),
      icon: item.icon,
      defaultLabel: item.defaultLabel,
    }));
  }, [t]);

  const allInterests = useMemo(() => {
    return [...primaryInterests, ...additionalInterests];
  }, [primaryInterests, additionalInterests]);

  // Helper to get value from either top level or prompts object
  const getPromptValue = (key: string): string => {
    if (typeof profile[key] === "string" && (profile[key] as string).trim()) {
      return (profile[key] as string).trim();
    }
    if (typeof prompts[key] === "string" && (prompts[key] as string).trim()) {
      return (prompts[key] as string).trim();
    }
    if (key === "languages") {
      const langs = getStringList(profile.languages);
      if (langs.length > 0) {
        return langs
          .map((lang) => {
            const known = LANGUAGE_OPTIONS.find((l) => l.id === lang || l.name.toLowerCase() === lang.toLowerCase());
            return known ? getLanguageNameById(known.id) : lang;
          })
          .join(" and ");
      }
    }
    return "";
  };

  // Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>(() => {
    return getStringList(profile.interests);
  });

  // Modal states
  const [modalType, setModalType] = useState<"prompt" | "intro" | "interests" | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<PromptItem | null>(null);
  const [promptDraft, setPromptDraft] = useState("");

  // Intro Draft
  const [introDraftBio, setIntroDraftBio] = useState("");
  const MAX_BIO_LENGTH = 500;

  // Interests modal draft
  const [interestDraft, setInterestDraft] = useState<string[]>([]);
  const [showAllInterests, setShowAllInterests] = useState(false);

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const reviewsScrollRef = useRef<HTMLDivElement>(null);
  const listingsScrollRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Save Helpers
  // -------------------------------------------------------------------------

  const persistProfile = async (
    updates: Record<string, unknown>,
    hostUpdate?: Pick<HostProfile, "image">,
  ) => {
    setIsSaving(true);
    const nextProfile = {
      ...profile,
      ...updates,
    };

    // Strip system managed & legacy fields so updateProfileSchema doesn't reject
    const cleanProfile = { ...nextProfile };
    delete cleanProfile.rating;
    delete cleanProfile.reviewCount;
    delete cleanProfile.reviewsCount;
    delete cleanProfile.reviewScores;
    delete cleanProfile.hostingYears;
    delete cleanProfile.hostingTenure;
    delete cleanProfile.stampsVisible;
    delete cleanProfile.selectedStamps;
    delete cleanProfile.customStamps;
    delete cleanProfile.travelStamps;
    delete cleanProfile.travelStampsEnabled;
    delete cleanProfile.whereIveBeenVisible;

    try {
      const res = await updateProfileAction({
        publicProfile: cleanProfile,
        ...(hostUpdate?.image !== undefined ? { image: hostUpdate.image } : {}),
      });

      if (!res.ok) {
        throw new Error(res.error || t("host_about_profile_update_err", "Failed to update profile"));
      }

      setProfile(nextProfile);
      if (hostUpdate?.image !== undefined) {
        setHostImage(hostUpdate.image);
      }
      onHostProfileSaved(nextProfile, hostUpdate);
      toast.success(t("host_about_profile_updated_toast", "Profile updated"));
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("host_about_profile_save_err", "Failed to save profile");
      toast.error(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Save prompt modal
  const handleSavePrompt = async () => {
    if (!editingPrompt) return;
    const key = editingPrompt.key;
    const value = promptDraft.trim();

    let updates: Record<string, unknown> = {};
    if (key === "languages") {
      const langArray = value
        ? value
          .split(/,|\sand\s/i)
          .map((s) => s.trim())
          .filter(Boolean)
        : [];
      updates = { languages: langArray };
    } else {
      const updatedPrompts = { ...prompts, [key]: value };
      updates = {
        [key]: value,
        prompts: updatedPrompts,
      };
    }

    const ok = await persistProfile(updates);
    if (ok) setModalType(null);
  };

  // Save intro modal
  const handleSaveIntro = async () => {
    const updates = {
      bio: introDraftBio.trim(),
    };
    const ok = await persistProfile(updates);
    if (ok) setModalType(null);
  };

  // Save interests modal
  const handleSaveInterests = async () => {
    const ok = await persistProfile({ interests: interestDraft });
    if (ok) {
      setSelectedInterests(interestDraft);
      setModalType(null);
    }
  };

  // Avatar upload handler
  const handleAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("host_about_err_valid_image", "Please choose a valid image file"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("host_about_err_image_size", "Image file must be under 5MB"));
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/upload/avatar", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = (await res.json().catch(() => null)) as { error?: string; url?: string } | null;
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || t("host_about_err_image_upload", "Failed to upload image"));
      }

      await persistProfile({}, { image: data.url });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("host_about_err_photo_upload", "Failed to upload photo");
      toast.error(message);
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoading) return <AboutHostSkeleton />;

  const rating = hostAbout?.rating ?? null;
  const reviewCount = hostAbout?.reviewCount ?? 0;
  const tenureYears = getYearsHosting(hostProfile.createdAt);
  const workText = getPromptValue("myWork");
  const languagesText = getPromptValue("languages");
  const liveText = getPromptValue("whereILive");
  const bioHeadline = getString(profile.bio);
  const displayImage = hostImage;

  const askAboutList = selectedInterests.map((interest) => {
    const opt = allInterests.find(
      (i) =>
        i.id === interest ||
        i.id.toLowerCase() === interest.toLowerCase() ||
        i.defaultLabel.toLowerCase() === interest.toLowerCase() ||
        i.label.toLowerCase() === interest.toLowerCase(),
    );
    return {
      id: opt?.id || interest,
      label: opt?.label || interest,
      icon: opt?.icon || "✨",
    };
  });
  const reviews = hostAbout?.reviews ?? [];
  const hostListings = hostAbout?.listings ?? [];

  const scrollReviews = (dir: "left" | "right") => {
    if (reviewsScrollRef.current) {
      reviewsScrollRef.current.scrollBy({
        left: dir === "left" ? -320 : 320,
        behavior: "smooth",
      });
    }
  };

  const scrollListings = (dir: "left" | "right") => {
    if (listingsScrollRef.current) {
      listingsScrollRef.current.scrollBy({
        left: dir === "left" ? -230 : 230,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-6 pb-24 text-[#1f1f1f] dark:text-zinc-100 font-sans">
      {/* ------------------------------------------------------------------- */}
      {/* Top Header & Mode Switcher */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex items-center justify-between pb-6">
        <h1 className="text-2xl sm:text-[28px] font-medium tracking-tight text-[#1F1F1F] dark:text-white">
          {t("host_about_host_title", "About the host")}
        </h1>

        {/* View / Edit Mode Toggle Pills */}
        <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("view")}
            className={`rounded-full px-4 py-1.5 text-sm transition-all cursor-pointer ${activeTab === "view"
                ? "bg-white text-[#1F1F1F] shadow-xs dark:bg-zinc-900 dark:text-white font-medium"
              : "text-[#727272] hover:text-[#1F1F1F] dark:text-[#727272] dark:hover:text-white font-normal"
              }`}
          >
            {t("host_about_view_profile", "View profile")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            className={`rounded-full px-4 py-1.5 text-sm transition-all cursor-pointer ${activeTab === "edit"
              ? "bg-white text-[#1F1F1F] shadow-xs dark:bg-zinc-900 dark:text-white font-medium"
              : "text-[#727272] hover:text-[#1F1F1F] dark:text-[#727272] dark:hover:text-white font-normal"
              }`}
          >
            {t("host_about_edit_profile", "Edit profile")}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* VIEW PROFILE (Exact match to uploaded user screenshot)               */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === "view" && (
        <div className="space-y-8 pt-2 animate-in fade-in duration-200">
          {/* 1. Host Summary Card (Screenshot exact) */}
          <div className="w-full max-w-[346px] rounded-[28px] border border-zinc-200/90 bg-white p-6 shadow-[0_6px_20px_rgba(0,0,0,0.08)] dark:border-zinc-700 dark:bg-zinc-900">
            <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 items-center">
              {/* Left Column: Avatar & Superhost */}
              <div className="text-center">
                <div className="relative mx-auto size-[104px]">
                  <div className="size-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                    {displayImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={displayImage} alt={hostName} className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center bg-amber-100 text-3xl font-medium text-amber-950 dark:bg-amber-950/60 dark:text-amber-300">
                        {getInitials(hostName)}
                      </span>
                    )}
                  </div>
                  {hostProfile.isSuperhost && (
                    <span
                      title={t("host_about_superhost", "Superhost")}
                      className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full bg-[#E00B41] text-white shadow-md ring-2 ring-white"
                    >
                      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </span>
                  )}
                </div>
                <h3 className="mt-3 truncate text-lg font-medium leading-tight text-[#1f1f1f] dark:text-white">
                  {hostName}
                </h3>
                {hostProfile.isSuperhost && (
                  <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-[#717171] font-medium">
                    <svg className="size-3.5 text-[#1f1f1f] dark:text-zinc-200 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-2 2.5l-2.5 5.5 4.5-2 4.5 2L14 17.5a6 6 0 1 1-4 0z" />
                    </svg>
                    <span>{t("host_about_superhost", "Superhost")}</span>
                  </p>
                )}
              </div>

              {/* Right Column: Stats (Reviews, Rating, Tenure) */}
              <dl className="divide-y divide-zinc-200 dark:divide-zinc-700 pl-2">
                <div className="pb-2.5">
                  <dd className="text-[22px] font-medium leading-none text-[#1f1f1f] dark:text-white">
                    {reviewCount}
                  </dd>
                  <dt className="mt-1 text-[11px] text-[#717171] font-medium">{t("host_about_stat_reviews", "Reviews")}</dt>
                </div>
                <div className="py-2.5">
                  <dd className="text-[22px] font-medium leading-none text-[#1f1f1f] dark:text-white flex items-center gap-1">
                    {rating !== null ? <>{rating.toFixed(2)} <span className="text-base text-amber-500">★</span></> : "—"}
                  </dd>
                  <dt className="mt-1 text-[11px] text-[#717171] font-medium">{t("host_about_stat_rating", "Rating")}</dt>
                </div>
                <div className="pt-2.5">
                  <dd className="text-[22px] font-medium leading-none text-[#1f1f1f] dark:text-white">
                    {tenureYears}
                  </dd>
                  <dt className="mt-1 text-[11px] text-[#717171] font-medium">{t("host_about_stat_years_hosting", "Years hosting")}</dt>
                </div>
              </dl>
            </div>
          </div>

          {/* 2. Key Details (2 columns with clean line icons) */}
          {(workText || languagesText || liveText) && <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 text-sm text-[#1f1f1f] dark:text-zinc-200 pt-1 font-normal">
            {workText && <p className="flex items-center gap-3">
              <svg className="size-5 shrink-0 text-[#1f1f1f] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <span>My work: {workText}</span>
            </p>}
            {languagesText && <p className="flex items-center gap-3">
              <svg className="size-5 shrink-0 text-[#1f1f1f] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>Speaks {languagesText}</span>
            </p>}
            {liveText && <p className="flex items-center gap-3">
              <svg className="size-5 shrink-0 text-[#1f1f1f] dark:text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>Lives in {liveText}</span>
            </p>}
          </div>}

          {/* 3. Bio / Headline text */}
          {bioHeadline && <div className="pt-1">
            <p className="text-base text-[#1f1f1f] dark:text-zinc-200 leading-relaxed font-normal whitespace-pre-line">
              {bioHeadline}
            </p>
          </div>}

          {reviews.length > 0 && <>
            <div className="border-b border-zinc-200 dark:border-zinc-800" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-medium text-[#1f1f1f] dark:text-white">
                  {hostName}&apos;s reviews
                </h2>
                {/* Carousel Arrows */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous reviews"
                    onClick={() => scrollReviews("left")}
                    className="size-8 rounded-full border border-[#727272] bg-white flex items-center justify-center text-[#727272] hover:text-white hover:bg-[#1f1f1f] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition-colors duration-300 cursor-pointer select-none"
                  >
                    <ChevronLeftIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next reviews"
                    onClick={() => scrollReviews("right")}
                    className="size-8 rounded-full border border-[#727272] bg-white flex items-center justify-center text-[#727272] hover:text-white hover:bg-[#1f1f1f] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition-colors duration-300 cursor-pointer select-none"
                  >
                    <ChevronRightIcon className="size-4" />
                  </button>
                </div>
              </div>

              {/* Review Cards in a Scrollable Row */}
              <div
                ref={reviewsScrollRef}
                className="flex gap-4 overflow-x-auto pb-2 scroll-smooth no-scrollbar"
              >
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="w-[280px] sm:w-[310px] shrink-0 flex flex-col justify-between rounded-xl border border-zinc-200/90 bg-white p-5 shadow-2xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        {rev.author.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={rev.author.image} alt={rev.author.name || "Guest"} className="size-10 rounded-full object-cover" />
                        ) : (
                          <span className="size-10 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 flex items-center justify-center font-medium text-sm">
                            {getInitials(rev.author.name || "Guest")}
                          </span>
                        )}
                        <div>
                          <h4 className="text-sm font-medium text-[#1f1f1f] dark:text-white leading-tight">{rev.author.name || "Guest"}</h4>
                          <p className="text-xs text-[#727272] mt-0.5">{"★".repeat(rev.rating)} · {formatReviewDate(rev.createdAt)}</p>
                        </div>
                      </div>
                      <p className="mt-3.5 text-sm text-[#1f1f1f] dark:text-zinc-300 leading-relaxed line-clamp-4">
                        {rev.comment || "No written review."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </>}

          {askAboutList.length > 0 && <>
            <div className="border-b border-zinc-200 dark:border-zinc-800" />
            <div className="space-y-4">
              <h2 className="text-xl font-medium text-[#1f1f1f] dark:text-white">
                Ask {hostName} about
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 pt-1">
                {askAboutList.map((item, idx) => {
                  const iconNode = ASK_ABOUT_ICONS[item.label] || (
                    <span className="text-lg select-none">{item.icon}</span>
                  );
                  return (
                    <div key={idx} className="flex items-center gap-3 text-sm text-[#1f1f1f] dark:text-zinc-200 font-medium">
                      {iconNode}
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>}

          {hostListings.length > 0 && <>
            <div className="border-b border-zinc-200 dark:border-zinc-800" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-medium text-[#1f1f1f] dark:text-white">
                  {hostName}&apos;s listings
                </h2>
                {/* Carousel Arrows */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous listings"
                    onClick={() => scrollListings("left")}
                    className="size-8 rounded-full border border-[#727272] bg-white flex items-center justify-center text-[#727272] hover:text-white hover:bg-[#1f1f1f] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition-colors duration-300 cursor-pointer select-none"
                  >
                    <ChevronLeftIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next listings"
                    onClick={() => scrollListings("right")}
                    className="size-8 rounded-full border border-[#727272] bg-white flex items-center justify-center text-[#727272] hover:text-white hover:bg-[#1f1f1f] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition-colors duration-300 cursor-pointer select-none"
                  >
                    <ChevronRightIcon className="size-4" />
                  </button>
                </div>
              </div>

              {/* Listings Row */}
              <div
                ref={listingsScrollRef}
                className="flex items-start gap-4 overflow-x-auto pb-3 scroll-smooth no-scrollbar"
              >
                {hostListings.map((item) => (
                  <div key={item.id} className="w-[188px] shrink-0 space-y-3">
                    <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {item.photos[0] ? <img src={item.photos[0]} alt={item.title} className="size-full object-cover hover:scale-105 transition-transform duration-300" /> : <span className="flex size-full items-center justify-center text-xs text-zinc-500">No photo</span>}
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <p className="text-[#727272] text-xs font-medium">{item.listingType || item.propertyType || "Property"}</p>
                      <p className="truncate font-medium text-[#1f1f1f] dark:text-white text-sm leading-snug" title={item.title}>
                        {item.title}
                      </p>
                      <p className="text-[#727272] dark:text-zinc-300 text-xs">
                        {item.rating !== null ? `★ ${item.rating.toFixed(2)} · ` : ""}{item.reviewCount} reviews
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* EDIT MODE (Exact match to Airbnb Screenshots 2, 3, 4, 5)             */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === "edit" && (
        <div className="space-y-10 pt-2 animate-in fade-in duration-200">
          {/* Top Avatar Card (Screenshot 4) */}
          <div className="flex flex-col items-center text-center">
            <div className="relative group">
              <div className="size-36 rounded-full overflow-hidden bg-[#FDE8E8] dark:bg-zinc-800 flex items-center justify-center border-4 border-white shadow-md">
                {hostImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hostImage} alt={hostName} className="size-full object-cover" />
                ) : (
                  <span className="text-5xl font-medium text-[#E03A3A] select-none">
                    {getInitials(hostName)}
                  </span>
                )}
              </div>

              {/* Add / Change button badge at bottom of avatar */}
              <button
                type="button"
                disabled={isUploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-[#1F1F1F] shadow-md hover:bg-[#1f1f1f] hover:text-white transition-all cursor-pointer disabled:opacity-50 group duration-300"
              >
                <svg className="size-3.5 text-[#1F1F1F] group-hover:text-white transition duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {isUploadingAvatar
                  ? t("host_about_saving_button", "Uploading…")
                  : hostImage
                  ? t("host_about_avatar_change", "Change")
                  : t("host_about_add_button", "Add")}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileSelected}
                className="hidden"
                aria-label={t("host_about_avatar_upload_aria", "Upload profile image")}
              />
            </div>

            <p className="mt-6 max-w-lg text-sm text-[#727272] leading-relaxed">
              {t("host_about_intro_trust_desc", "Hosts and guests can see your profile and it may appear across Homyz to help us build trust in our community.")}{" "}
              <a href="#learn-more" onClick={(e) => e.preventDefault()} className="underline font-medium text-[#1F1F1F] dark:text-zinc-200">
                {t("host_about_learn_more", "Learn more")}
              </a>
            </p>
          </div>

          {/* Prompt Items List with Chevrons (Screenshots 3 & 4) */}
          <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {promptItems.map((item) => {
              const val = getPromptValue(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setEditingPrompt(item);
                    setPromptDraft(val);
                    setModalType("prompt");
                  }}
                  className="flex w-full items-center justify-between py-4 text-left transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 px-2 rounded-xl group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0 pr-4">
                    <span className="text-xl shrink-0 select-none">{item.icon}</span>
                    <div className="truncate text-sm sm:text-base text-[#1F1F1F] dark:text-zinc-100">
                      <span className="font-normal">{item.label}</span>
                      {val ? (
                        <span className="font-medium text-[#1f1f1f] dark:text-white">
                          : {val}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <svg
                    className="size-5 shrink-0 text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-white transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>

          {/* About Me Section (Screenshot 2) */}
          <div className="space-y-4 pt-2">
            <h2 className="text-xl font-medium text-[#1F1F1F] dark:text-white">
              {t("host_about_me_title", "About me")}
            </h2>

            <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
              {getString(profile.bio) ? (
                <p className="text-sm text-[#1f1f1f] dark:text-zinc-200 leading-relaxed whitespace-pre-line">
                  {getString(profile.bio)}
                </p>
              ) : (
                <p className="text-sm text-[#727272] italic">
                  {t("host_about_me_empty", "No intro added yet. Share a bit about yourself with your guests.")}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIntroDraftBio(getString(profile.bio));
                setModalType("intro");
              }}
              className="inline-flex items-center rounded-full border border-[#1F1F1F] px-4 py-2 text-sm font-medium bg-[#1f1f1f] text-white hover:text-[#1F1F1F] hover:bg-white dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {t("host_about_edit_intro", "Edit Intro")}
            </button>
          </div>

          {/* My Interests Section (Screenshots 1 & 5) */}
          <div className="space-y-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
            <h2 className="text-xl font-medium text-[#1F1F1F] dark:text-white">
              {t("host_about_interests_title", "My interests")}
            </h2>

            {selectedInterests.length > 0 ? (
              <div className="flex flex-wrap gap-2.5 pt-1">
                {selectedInterests.map((interest) => {
                  const opt = allInterests.find(
                    (i) =>
                      i.id === interest ||
                      i.id.toLowerCase() === interest.toLowerCase() ||
                      i.defaultLabel.toLowerCase() === interest.toLowerCase() ||
                      i.label.toLowerCase() === interest.toLowerCase(),
                  );
                  return (
                    <div
                      key={interest}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 shadow-2xs"
                    >
                      <span className="text-base select-none">{opt?.icon || "✨"}</span>
                      <span>{opt?.label || interest}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-[#727272]">
                {t("host_about_no_interests_selected", "No interests selected yet. Share what you enjoy doing.")}
              </p>
            )}

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setInterestDraft([...selectedInterests]);
                  setModalType("interests");
                }}
                className="inline-flex items-center rounded-full border border-[#1F1F1F] px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-white hover:text-[#1f1f1f] bg-[#1F1F1F] dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                {t("host_about_edit_interests", "Edit interests")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 1: Edit Specific Prompt Modal                                 */}
      {/* ------------------------------------------------------------------- */}
      {modalType === "prompt" && editingPrompt && (
        <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-400 pb-4 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl select-none">{editingPrompt.icon}</span>
                <h3 className="text-xl font-medium text-[#1F1F1F] dark:text-white">
                  {editingPrompt.label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="size-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer text-zinc-600 dark:text-zinc-300"
              >
                <CloseIcon className="size-4" />
              </button>
            </div>

            <div className="py-5">
              <label className="block text-xs font-medium text-[#727272] uppercase tracking-wider mb-2">
                {t("host_about_modal_your_answer", "Your Answer")}
              </label>
              <input
                type="text"
                autoFocus
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                placeholder={editingPrompt.placeholder}
                className="w-full rounded-lg border border-[#727272] bg-white px-4 py-3 text-sm sm:text-base text-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <p className="mt-2 text-xs text-[#727272]">
                {t("host_about_modal_prompt_visible_notice", "Visible to guests on your public listing and profile.")}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-6.75 py-3 rounded-full border border-[#1F1F1F] hover:bg-[#1F1F1F] text-sm font-medium text-[#1F1F1F] hover:text-white  transition-colors delay-300 duration-300 cursor-pointer"
              >
                {t("host_about_cancel_button", "Cancel")}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSavePrompt}
                className="px-4 py-3 rounded-full text-sm hover:bg-[#1F1F1F] text-[#1F1F1F] hover:text-white font-medium shadow-xs transition-colors delay-300 duration-300 flex items-center justify-center gap-2 min-w-[100px] border border-transparent hover:border-[#1F1F1F] bg-[#FCDF9C] cursor-pointer"
              >
                {isSaving ? t("host_about_saving_button", "Saving…") : t("host_about_save_button", "Save")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 2: About you (Edit Intro Modal, exact Airbnb popup)           */}
      {/* ------------------------------------------------------------------- */}
      {modalType === "intro" && (
        <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-[560px] rounded-[32px] bg-white p-7 sm:p-8 shadow-2xl dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 animate-in fade-in zoom-in-95 relative flex flex-col">
            {/* Header */}
            <div className="shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl sm:text-[26px] font-medium text-[#1f1f1f] dark:text-white leading-tight">
                 {t("host_about_modal_intro_title", "About you")}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  aria-label="Close dialog"
                  className="size-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer -mr-2 text-zinc-700 dark:text-zinc-300"
                >
                  <CloseIcon className="size-4" />
                </button>
              </div>
              <p className="mt-2 text-sm text-[#717171] leading-relaxed">
                {t("host_about_modal_intro_desc", "Tell us a little bit about yourself so your future Hosts or guests can get to know you.")}
              </p>
            </div>

            {/* Input Box */}
            <div className="mt-6">
              <div className="rounded-2xl border border-zinc-400 dark:border-zinc-700 p-4 focus-within:border-black dark:focus-within:border-white transition-colors">
                <textarea
                  rows={6}
                  maxLength={MAX_BIO_LENGTH}
                  value={introDraftBio}
                  onChange={(e) => setIntroDraftBio(e.target.value)}
                  placeholder={t("host_about_modal_intro_placeholder", "Tell us a little bit about yourself…")}
                  className="w-full bg-transparent text-sm sm:text-base text-[#222222] dark:text-white placeholder:text-zinc-400 focus:outline-none resize-none leading-relaxed"
                />
              </div>
              <div className="mt-2 text-right">
                <span className="text-xs text-[#717171]">
                  {t(
                    "host_about_modal_intro_chars_available",
                    { count: Math.max(0, MAX_BIO_LENGTH - introDraftBio.length) },
                    `${Math.max(0, MAX_BIO_LENGTH - introDraftBio.length)} characters available`,
                  )}
                </span>
              </div>
            </div>

            {/* Footer with Save Button */}
            <div className="mt-6 flex justify-end shrink-0">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveIntro}
                className="rounded-full bg-[#1f1f1f] border border-[#1f1f1f] hover:border-[#FCDF9C] px-8 py-3 text-sm font-medium text-white hover:bg-[#FCDF9C] hover:text-[#1f1f1f] dark:bg-white dark:text-zinc-950 transition-colors cursor-pointer disabled:opacity-50 duration-300"
              >
                {isSaving ? t("host_about_saving_button", "Saving…") : t("host_about_save_button", "Save")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL 3: What are you into? (Interests Modal, Screenshot 5)          */}
      {/* ------------------------------------------------------------------- */}
      {modalType === "interests" && (
        <ModalOverlay className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-medium text-[#1F1F1F] dark:text-white leading-tight">
                   {t("host_about_modal_interests_title", "What are you into?")}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  aria-label="Close dialog"
                  className="size-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer -mr-2 text-zinc-700 dark:text-zinc-300"
                >
                  <CloseIcon className="size-4" />
                </button>
              </div>
              <p className="mt-1.5 text-xs sm:text-sm text-[#727272] leading-relaxed">
                {t("host_about_modal_interests_desc", "Pick some interests that you enjoy and that you want to show on your profile.")}
              </p>
            </div>

            {/* Interest Pills Grid */}
            <div className="py-4 overflow-y-auto flex-1 custom-scrollbar pr-1">
              <div className="flex flex-wrap gap-2.5">
                {(showAllInterests ? allInterests : primaryInterests).map((opt) => {
                  const isSelected = interestDraft.some(
                    (i) =>
                      i === opt.id ||
                      i.toLowerCase() === opt.id.toLowerCase() ||
                      i.toLowerCase() === opt.defaultLabel.toLowerCase() ||
                      i.toLowerCase() === opt.label.toLowerCase(),
                  );
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setInterestDraft(
                            interestDraft.filter(
                              (i) =>
                                !(
                                  i === opt.id ||
                                  i.toLowerCase() === opt.id.toLowerCase() ||
                                  i.toLowerCase() === opt.defaultLabel.toLowerCase() ||
                                  i.toLowerCase() === opt.label.toLowerCase()
                                ),
                            ),
                          );
                        } else {
                          if (interestDraft.length >= 20) {
                            toast.error(t("host_about_err_max_interests", "Maximum 20 interests allowed"));
                            return;
                          }
                          setInterestDraft([...interestDraft, opt.label]);
                        }
                      }}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-sm font-medium transition-all cursor-pointer ${isSelected
                          ? "border-[#1F1F1F] bg-[#1F1F1F] text-white shadow-xs dark:border-white dark:bg-white dark:text-zinc-950 font-medium"
                          : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        }`}
                    >
                      <span className="text-base select-none">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAllInterests(!showAllInterests)}
                  className="text-xs font-medium underline text-[#1F1F1F] dark:text-zinc-200 cursor-pointer"
                >
                  {showAllInterests ? t("host_about_show_less", "Show less") : t("host_about_show_all", "Show all")}
                </button>
              </div>
            </div>

            {/* Footer with X/20 selected and Save button */}
            <div className="flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800 shrink-0">
              <span className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {interestDraft.length}/20 selected
              </span>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveInterests}
                className="rounded-full bg-[#1F1F1F] px-8 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-zinc-800 dark:bg-amber-400 dark:text-zinc-950 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSaving ? t("host_about_saving_button", "Saving…") : t("host_about_save_button", "Save")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
