"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BackButton } from "@/components/ui/back-button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { BUILTIN_TRAVEL_STAMPS } from "@/lib/stamps/stamps-data";
import { TravelStampGraphic } from "@/components/stamps/travel-stamp-graphics";
import { WhereIveBeenSelector } from "@/components/profile/where-ive-been-selector";
import { LANGUAGE_OPTIONS, getLanguageNameById } from "@/lib/utils/language-options";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  updateHostPublicProfileAction,
  updateHostListingPhotoAction,
} from "@/actions/host/profile";
import { updateProfileAction } from "@/actions/user/updateProfile";
import type { HostProfile } from "@/app/(protected)/host/listings/[id]/components/HostAndLocationViews";
import { toast } from "@/components/ui/toast";
import { AboutHostSkeleton } from "./YourSpaceSkeletons";

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

const SUGGESTED_HOBBIES = [
  "Cooking",
  "Photography",
  "Hiking",
  "Gardening",
  "Live sports",
  "Art & design",
  "Reading",
  "Music",
] as const;

export interface HostAboutHostViewProps {
  listingId: string;
  hostProfile: HostProfile;
  onHostProfileSaved: (
    profile: Record<string, unknown>,
    hostUpdate?: Pick<HostProfile, "image">,
  ) => void;
  isLoading?: boolean;
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

function getHobbyTranslationKey(name: string): any {
  return `host_hobby_${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
}

function getInterestTranslationKey(name: string): any {
  return `host_interest_${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
}

export function HostAboutHostView({
  listingId,
  hostProfile,
  onHostProfileSaved,
  isLoading = false,
}: HostAboutHostViewProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { data: session, update: updateSession } = useSession();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const aboutHostScrollRef = useRef<HTMLDivElement>(null);
  const aboutHostScrollTrackRef = useRef<HTMLDivElement>(null);
  const aboutHostScrollFrameRef = useRef<number | null>(null);
  const [aboutHostScrollThumb, setAboutHostScrollThumb] = useState({ height: 0, top: 0, visible: false });

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
  const [avatarUrl, setAvatarUrl] = useState(hostProfile.image);

  // Local transient states for adding items
  const [hobbyInput, setHobbyInput] = useState("");
  const [interestInput, setInterestInput] = useState("");
  const [languageSearch, setLanguageSearch] = useState("");
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [isStampEditorOpen, setIsStampEditorOpen] = useState(false);

  // Status & feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync state if external hostProfile changes
  useEffect(() => {
    const next = hostProfile.publicProfile ?? {};
    setBio(String(next.bio ?? ""));
    setHomeUnique(getPrompt(next, "homeUnique"));
    setGuestsShouldKnow(getPrompt(next, "guestsShouldKnow"));
    setEducation(getPrompt(next, "education"));
    setPerfectGuest(getPrompt(next, "perfectGuest"));
    setBiography(getPrompt(next, "biography") || String(next.bioTitle ?? ""));
    setHobbies(getTagList(next.prompts && typeof next.prompts === "object" ? (next.prompts as Record<string, unknown>).hobbies : []));
    setLanguages(getLanguageIds(next.languages));
    setInterests(getStringList(next.interests));
    setStampsVisible(next.stampsVisible !== false);
    setSelectedStamps(Array.isArray(next.selectedStamps) ? next.selectedStamps.filter((v): v is string => typeof v === "string") : []);
    setAvatarUrl(hostProfile.image);
  }, [hostProfile.image, hostProfile.publicProfile]);

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
    if (!hostProfile.createdAt) return t("host_about_new_host") || "New host";
    const startYear = new Date(hostProfile.createdAt).getFullYear();
    const currentYear = new Date().getFullYear();
    const diff = Math.max(0, currentYear - startYear);
    return diff >= 1 ? (t("host_about_hosting_years", { count: diff }) || `Hosting for ${diff} year${diff > 1 ? "s" : ""}`) : (t("host_about_joined_recently") || "Joined recently");
  }, [hostProfile.createdAt, t]);

  // Derive rating (system information, read-only)
  const hostRating = useMemo(() => {
    const r = (hostProfile as any).rating;
    if (typeof r === "number" && r > 0) return `★ ${r.toFixed(1)}`;
    return t("host_about_new_host") || "New host";
  }, [hostProfile, t]);

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

  // Save changes to database via Server Action
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isDirty || isSaving) return;
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

      const result = await updateHostPublicProfileAction({
        listingId,
        profile: payload,
      });

      setIsSaving(false);

      if (result.ok) {
        if (result.data) {
          const updatedProfile = ((result.data as any).publicProfile as Record<string, unknown>) ?? payload;
          onHostProfileSaved(updatedProfile);
        }
        const successMsg = t("host_about_saved_success") || "Host profile saved successfully! Changes are shared across all of your listings.";
        toast.success(successMsg);
        setFeedback({
          type: "success",
          text: successMsg,
        });
        router.refresh();
      } else {
        const errorMsg = result.error || (t("host_about_saved_failed") || "Failed to save host profile.");
        toast.error(errorMsg);
        setFeedback({
          type: "error",
          text: errorMsg,
        });
      }
    } catch (err: any) {
      setIsSaving(false);
      const errorMsg = (t("host_about_saved_failed") || "Error saving host profile: ") + (err.message || String(err));
      toast.error(errorMsg);
      setFeedback({
        type: "error",
        text: errorMsg,
      });
    }
  };

  // Upload avatar photo
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/v1/upload/listing-photo", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") {
        throw new Error(data.error || "Could not upload the profile photo.");
      }

      // Update photo via listing-aware action
      const result = await updateHostListingPhotoAction({
        listingId,
        image: data.url,
      });

      if (!result.ok) {
        // Fallback to updateProfileAction
        const fallback = await updateProfileAction({ image: data.url });
        if (!fallback.ok) throw new Error(result.error || fallback.error || "Could not save the profile photo.");
      }

      setAvatarUrl(data.url);
      onHostProfileSaved(rawProfile, { image: data.url });

      if (session?.user) {
        await updateSession({ user: { ...session.user, image: data.url } });
      }

      toast.success("Profile photo updated successfully.");
      setFeedback({
        type: "success",
        text: "Profile photo updated successfully.",
      });
      router.refresh();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Could not update the profile photo.";
      toast.error(errorMsg);
      setFeedback({
        type: "error",
        text: errorMsg,
      });
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  // Add hobby handler
  const handleAddHobby = (hobbyToAdd?: string) => {
    const value = (hobbyToAdd || hobbyInput).trim();
    if (!value) return;
    if (!hobbies.some((h) => h.toLowerCase() === value.toLowerCase())) {
      setHobbies((prev) => [...prev, value]);
    }
    setHobbyInput("");
  };

  // Remove hobby handler
  const handleRemoveHobby = (hobbyToRemove: string) => {
    setHobbies((prev) => prev.filter((h) => h !== hobbyToRemove));
  };

  // Add interest handler
  const handleAddInterest = (interestToAdd?: string) => {
    const value = (interestToAdd || interestInput).trim();
    if (!value) return;
    if (!interests.some((i) => i.toLowerCase() === value.toLowerCase())) {
      setInterests((prev) => [...prev, value]);
    }
    setInterestInput("");
  };

  // Remove interest handler
  const handleRemoveInterest = (interestToRemove: string) => {
    setInterests((prev) => prev.filter((i) => i !== interestToRemove));
  };

  // Toggle language handler
  const handleToggleLanguage = (langId: string) => {
    if (languages.includes(langId)) {
      setLanguages((prev) => prev.filter((id) => id !== langId));
    } else {
      setLanguages((prev) => [...prev, langId]);
    }
  };

  // Filter languages by search query
  const filteredLanguages = useMemo(() => {
    const q = languageSearch.trim().toLowerCase();
    if (!q) return LANGUAGE_OPTIONS;
    return LANGUAGE_OPTIONS.filter((lang) => lang.name.toLowerCase().includes(q));
  }, [languageSearch]);

  const updateAboutHostScrollThumb = React.useCallback(() => {
    if (aboutHostScrollFrameRef.current !== null) cancelAnimationFrame(aboutHostScrollFrameRef.current);

    aboutHostScrollFrameRef.current = requestAnimationFrame(() => {
      const element = aboutHostScrollRef.current;
      if (!element) return;

      const hasOverflow = element.scrollHeight > element.clientHeight + 1;
      const trackHeight = aboutHostScrollTrackRef.current?.clientHeight || element.clientHeight;
      const height = hasOverflow ? Math.min(60, trackHeight) : 0;
      const maxTop = Math.max(0, trackHeight - height);
      const scrollRange = Math.max(1, element.scrollHeight - element.clientHeight);
      const top = hasOverflow ? Math.round((element.scrollTop / scrollRange) * maxTop) : 0;

      setAboutHostScrollThumb((current) => (
        current.height === height && current.top === top && current.visible === hasOverflow
          ? current
          : { height, top, visible: hasOverflow }
      ));
      aboutHostScrollFrameRef.current = null;
    });
  }, []);

  useEffect(() => {
    const element = aboutHostScrollRef.current;
    if (!element) return;

    updateAboutHostScrollThumb();
    const resizeObserver = new ResizeObserver(updateAboutHostScrollThumb);
    const mutationObserver = new MutationObserver(updateAboutHostScrollThumb);
    resizeObserver.observe(element);
    if (aboutHostScrollTrackRef.current) resizeObserver.observe(aboutHostScrollTrackRef.current);
    mutationObserver.observe(element, { childList: true, subtree: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (aboutHostScrollFrameRef.current !== null) cancelAnimationFrame(aboutHostScrollFrameRef.current);
    };
  }, [aboutHostScrollThumb.visible, updateAboutHostScrollThumb]);

  if (isLoading) {
    return <AboutHostSkeleton />;
  }

  return (
    <div className="relative w-full max-w-full lg:max-w-[calc(100%-20px)] xl:max-w-[calc(100%-75px)]">
      <div
        ref={aboutHostScrollRef}
        onScroll={updateAboutHostScrollThumb}
        className="custom-scrollbar space-y-8 pb-28 sm:pr-1 lg:h-[1850px] lg:overflow-x-hidden lg:overflow-y-auto sm:pl-1.5 lg:pr-[50px] xl:pr-[100px]"
      >
        {/* Top Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-6">
            <BackButton
              aria-label={t("host_back_to_listings_aria") || "Back to listings"}
              onClick={() => router.push("/host/listings")}
            />
            <div>
              <h1>
                {t("host_about_host_title") || "About the host"}
              </h1>
            </div>
          </div>
        </header>

        {/* Global Community Notice */}
        <div className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/80 p-4 sm:p-5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-sm">
            <p>
              {t("host_about_community_notice") || "Your host profile is visible to guests throughout Homyz to build trust and authenticity. Any updates you make here automatically sync across all properties you host."}
            </p>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            role="alert"
            className={`flex items-center justify-between gap-3 rounded-xl p-4 text-sm font-medium transition-all ${feedback.type === "success"
              ? "border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300"
              : "border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300"
              }`}
          >
            <div className="flex items-center gap-2.5">
              {feedback.type === "success" ? (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">✓</span>
              ) : (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs text-white">!</span>
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold hover:opacity-75"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. Host Profile Card (Airbnb Style) */}
        <section className="profile-card">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:gap-7">
            {/* Avatar Container */}
            <div className="relative mx-auto shrink-0 sm:mx-0 sm:w-[362px] w-[200px] sm:h-[264px] h-[200px]">
              <div className="size-full overflow-hidden sm:rounded-[20px] rounded-full border-2 border-[#1f1f1f] dark:border-zinc-700 bg-[#727272] dark:bg-zinc-800">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={`${hostProfile.name || "Host"} avatar`}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-amber-100 dark:bg-amber-950/60 text-3xl font-bold text-amber-900 dark:text-amber-300">
                    {getInitials(hostProfile.name)}
                  </div>
                )}
              </div>
              {/* Edit Photo Button */}
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute -bottom-6 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#FCDF9C] dark:border-amber-400 bg-[#FCDF9C] dark:bg-amber-400 px-5 py-2.75 text-base font-normal text-[#1f1f1f] dark:text-zinc-950 transition-all hover:bg-[#1f1f1f] dark:hover:bg-amber-300 group disabled:opacity-60 duration-300 hover:text-white dark:hover:text-zinc-950 hover:border-[#1f1f1f] dark:hover:border-amber-300"
              >
                <Image src="/images/icons/camera.svg" alt="" width={24} height={17} className="max-w-6 object-contain group-hover:transform-filter group-hover:brightness-0 group-hover:invert dark:invert transition-all duration-300" />
                {uploadingImage ? (t("host_about_uploading_photo") || "Uploading…") : (t("host_about_edit_photo") || "Edit")}
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="sr-only"
              />
            </div>

            {/* Identity & Badges */}
            <div className="flex-1 space-y-3 text-center sm:text-left sm:mt-0 mt-4">
              <div>
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <h2 className="text-xl font-medium text-[#1f1f1f] dark:text-zinc-100 sm:text-2xl">
                    {hostProfile.name || "Host Profile"}
                  </h2>
                  <span className="inline-flex items-center rounded-full bg-[#d1e6ff] dark:bg-blue-950/80 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {t("host_about_host_badge") || "Host"}
                  </span>
                </div>
                {(hostProfile.email || session?.user?.email) && (
                  <p className="wordbreak-all whitespace-normal mt-0.5 text-sm text-[#727272] dark:text-zinc-400">{hostProfile.email || session?.user?.email}</p>
                )}
              </div>

              {/* Badges Row (System Information: Rating & Tenure) */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#727272] dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  <span className="text-amber-500">★</span>
                  <span>{hostRating}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#727272] dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  <svg className="size-3.5 text-zinc-500 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{hostingTenure}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. About Me / Biography Card */}
        <section className="rounded-xl border border-white dark:border-zinc-700 bg-[#F3F4F5] dark:bg-zinc-800/90 p-4 shadow-[0px_2px_4px_0px_#00000040] sm:p-6">
          <div className="border-b border-[#727272] dark:border-zinc-700 pb-4">
            <h2 className="text-lg font-medium text-[#1f1f1f] dark:text-zinc-100">{t("host_about_section_about_me") || "About me"}</h2>
            <p className="mt-0.5 text-sm font-normal text-[#727272] dark:text-zinc-400">
              {t("host_about_section_about_me_desc") || "Introduce yourself to prospective guests. This appears at the top of your host profile."}
            </p>
          </div>

          <div className="mt-5 space-y-5">
            {/* Biography Headline */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="host-biography" className="block text-base font-normal text-[#1f1f1f] dark:text-zinc-100">
                  {t("host_about_bio_headline_label") || "My biography headline"}
                </label>
                <span className="text-xs text-[#727272] dark:text-zinc-400">{biography.length} / 500</span>
              </div>
              <input
                id="host-biography"
                type="text"
                maxLength={500}
                value={biography}
                onChange={(e) => setBiography(e.target.value)}
                placeholder={t("host_about_bio_headline_placeholder") || "e.g., Architect & design enthusiast welcoming travelers to Milan"}
                className="mt-1.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-base text-[#1f1f1f] dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition-all focus:border-zinc-900 dark:focus:border-amber-400 sm:min-h-[60px] min-h-[56px]"
              />
            </div>

            {/* Long-form Bio */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="host-bio" className="block text-base font-normal text-[#1f1f1f] dark:text-zinc-100">
                  {t("host_about_bio_desc_label") || "Biography / Description"}
                </label>
                <span className="text-xs text-[#727272] dark:text-zinc-400">{bio.length} / 2,000</span>
              </div>
              <textarea
                id="host-bio"
                rows={5}
                maxLength={2000}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t("host_about_bio_desc_placeholder") || "Tell guests about your background, why you enjoy hosting, your passions, or your personal philosophy on hospitality..."}
                className="mt-1.5 w-full resize-y rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-base text-[#1f1f1f] dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition-all focus:border-zinc-900 dark:focus:border-amber-400"
              />
            </div>
          </div>
        </section>

        {/* 3. Host Details & Prompts Card */}
        <section className="rounded-xl border border-white dark:border-zinc-700 bg-white dark:bg-zinc-800/90 p-4 shadow-[0px_2px_4px_0px_#00000040] sm:p-6">
          <div className="border-b border-[#727272] dark:border-zinc-700 pb-4">
            <h2 className="text-lg font-medium text-[#1f1f1f] dark:text-zinc-100">{t("host_about_prompts_title") || "Host details & prompts"}</h2>
            <p className="mt-0.5 text-sm font-normal text-[#727272] dark:text-zinc-400">
              {t("host_about_prompts_desc") || "Answer structured prompts to give guests helpful insights into your home and hospitality style."}
            </p>
          </div>

          <div className="mt-5 space-y-6">
            {/* Prompt 1: What makes your home unique */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="prompt-home-unique" className="text-base font-normal text-[#1f1f1f] dark:text-zinc-100">
                    {t("host_about_prompt_home_unique_label") || "What makes your home unique"}
                  </label>
                  <p className="text-xs text-[#727272] dark:text-zinc-400">
                    {t("host_about_prompt_home_unique_hint") || "Special architecture, scenic views, cozy garden, or interior styling."}
                  </p>
                </div>
                <span className="text-xs text-[#727272] dark:text-zinc-400">{homeUnique.length} / 500</span>
              </div>
              <input
                id="prompt-home-unique"
                type="text"
                maxLength={500}
                value={homeUnique}
                onChange={(e) => setHomeUnique(e.target.value)}
                placeholder={t("host_about_prompt_home_unique_placeholder") || "e.g., Restored mid-century flat with floor-to-ceiling windows and sun terrace"}
                className="mt-2 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition-all focus:border-zinc-900 dark:focus:border-amber-400 sm:min-h-[60px] min-h-[56px]"
              />
            </div>

            {/* Prompt 2: What guests should know */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="prompt-guests-should-know" className="text-base font-normal text-[#1f1f1f] dark:text-zinc-100">
                    {t("host_about_prompt_guests_should_know_label") || "What guests should know"}
                  </label>
                  <p className="text-xs text-[#727272] dark:text-zinc-400">
                    {t("host_about_prompt_guests_should_know_hint") || "Your hosting style, check-in approach, and communication preferences."}
                  </p>
                </div>
                <span className="text-xs text-[#727272] dark:text-zinc-400">{guestsShouldKnow.length} / 500</span>
              </div>
              <input
                id="prompt-guests-should-know"
                type="text"
                maxLength={500}
                value={guestsShouldKnow}
                onChange={(e) => setGuestsShouldKnow(e.target.value)}
                placeholder={t("host_about_prompt_guests_should_know_placeholder") || "e.g., Always reachable via the app for insider tips, but I respect your complete privacy"}
                className="mt-2 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition-all focus:border-zinc-900 dark:focus:border-amber-400 sm:min-h-[60px] min-h-[56px]"
              />
            </div>

            {/* Prompt 3: Where I went to school / Education */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="prompt-education" className="text-base font-normal text-[#1f1f1f] dark:text-zinc-100">
                    {t("host_about_prompt_education_label") || "Where I went to school / Education & background"}
                  </label>
                  <p className="text-xs text-[#727272] dark:text-zinc-400">
                    {t("host_about_prompt_education_hint") || "Your alma mater, studies, or career background."}
                  </p>
                </div>
                <span className="text-xs text-[#727272] dark:text-zinc-400">{education.length} / 300</span>
              </div>
              <input
                id="prompt-education"
                type="text"
                maxLength={300}
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                placeholder={t("host_about_prompt_education_placeholder") || "e.g., Studied Architecture at Politecnico di Milano"}
                className="mt-2 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition-all focus:border-zinc-900 dark:focus:border-amber-400 sm:min-h-[60px] min-h-[56px]"
              />
            </div>

            {/* Prompt 4: My perfect guest */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="prompt-perfect-guest" className="text-base font-normal text-[#1f1f1f] dark:text-zinc-100">
                    {t("host_about_prompt_perfect_guest_label") || "My perfect guest"}
                  </label>
                  <p className="text-xs text-[#727272] dark:text-zinc-400">
                    {t("host_about_prompt_perfect_guest_hint") || "Who loves staying at your property or matches your house vibe."}
                  </p>
                </div>
                <span className="text-xs text-[#727272] dark:text-zinc-400">{perfectGuest.length} / 300</span>
              </div>
              <input
                id="prompt-perfect-guest"
                type="text"
                maxLength={300}
                value={perfectGuest}
                onChange={(e) => setPerfectGuest(e.target.value)}
                placeholder={t("host_about_prompt_perfect_guest_placeholder") || "e.g., Respectful travelers, culture seekers, and remote creatives"}
                className="mt-2 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition-all focus:border-zinc-900 dark:focus:border-amber-400 sm:min-h-[60px] min-h-[56px]"
              />
            </div>
          </div>
        </section>

        {/* 4. Languages Spoken */}
        <section className="rounded-xl border border-white dark:border-zinc-700 bg-white dark:bg-zinc-800/90 p-4 shadow-[0px_2px_4px_0px_#00000040] sm:p-6">
          <div className="border-b border-[#727272] dark:border-zinc-700 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-[#1f1f1f] dark:text-zinc-100">{t("host_about_languages_title") || "Languages you speak"}</h2>
                <p className="mt-0.5 text-sm text-[#727272] dark:text-zinc-400">
                  {t("host_about_languages_desc") || "Help international guests know which languages you can communicate in."}
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                {t("host_selected_count", { count: languages.length }) || `${languages.length} selected`}
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {/* Selected Language Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {languages.length > 0 ? (
                languages.map((langId) => (
                  <span
                    key={langId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3.5 py-1.5 text-xs font-normal text-zinc-800 dark:text-zinc-200"
                  >
                    {getLanguageNameById(langId)}
                    <button
                      type="button"
                      onClick={() => handleToggleLanguage(langId)}
                      aria-label={`Remove ${getLanguageNameById(langId)}`}
                      className="size-4 rounded-full text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">{t("host_about_no_languages_selected") || "No languages selected yet. Add languages below."}</p>
              )}
            </div>

            {/* Search / Select Dropdown */}
            <div className="relative">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={languageSearch}
                    onFocus={() => setIsLanguageDropdownOpen(true)}
                    onChange={(e) => {
                      setLanguageSearch(e.target.value);
                      setIsLanguageDropdownOpen(true);
                    }}
                    placeholder={t("host_about_languages_search_placeholder") || "Search and add a language (e.g., English, French, Spanish)..."}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-[#1f1f1f] dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition-all focus:border-zinc-900 dark:focus:border-amber-400 sm:min-h-[60px] min-h-[56px]"
                  />
                  {languageSearch && (
                    <button
                      type="button"
                      onClick={() => setLanguageSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsLanguageDropdownOpen((prev) => !prev)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2.5 text-base font-medium text-[#1f1f1f] dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 sm:w-auto sm:min-h-[60px] min-h-[56px]"
                >
                  {isLanguageDropdownOpen ? (t("host_about_close_button") || "Close") : (t("host_about_browse_all_button") || "Browse all")}
                </button>
              </div>

              {/* Dropdown Options List */}
              {isLanguageDropdownOpen && (
                <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 shadow-xl">
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {filteredLanguages.map((lang) => {
                      const isSelected = languages.includes(lang.id);
                      return (
                        <button
                          key={lang.id}
                          type="button"
                          onClick={() => handleToggleLanguage(lang.id)}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${isSelected
                            ? "bg-zinc-900 dark:bg-amber-400 text-white dark:text-zinc-950"
                            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}
                        >
                          <span className="truncate">{lang.name}</span>
                          {isSelected && <span className="ml-1 text-xs">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 5. Hobbies & Passions */}
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/90 p-6 shadow-xs sm:p-7">
          <div className="border-b border-zinc-100 dark:border-zinc-700 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-[#1f1f1f] dark:text-zinc-100">{t("host_about_hobbies_title") || "Hobbies & passions"}</h2>
                <p className="mt-0.5 text-sm text-[#727272] dark:text-zinc-400">
                  {t("host_about_hobbies_desc") || "Share what you enjoy doing outside of hosting to spark conversations with guests."}
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                {t("host_about_hobbies_added_count", { count: hobbies.length }) || `${hobbies.length} added`}
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {/* Active Hobby Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {hobbies.length > 0 ? (
                hobbies.map((hobby) => (
                  <span
                    key={hobby}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3.5 py-1.5 text-xs font-normal text-zinc-800 dark:text-zinc-200"
                  >
                    {t(getHobbyTranslationKey(hobby), hobby)}
                    <button
                      type="button"
                      onClick={() => handleRemoveHobby(hobby)}
                      aria-label={`Remove ${hobby}`}
                      className="size-4 rounded-full text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">{t("host_about_no_hobbies_added") || "No hobbies added yet. Type below or pick suggestions."}</p>
              )}
            </div>

            {/* Add Custom Hobby Input */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={hobbyInput}
                onChange={(e) => setHobbyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddHobby();
                  }
                }}
                placeholder={t("host_about_hobbies_input_placeholder") || "Add a hobby or obsession (e.g., Trail running, Baking sourdough, Vinyl records)..."}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-[#1f1f1f] dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition-all focus:border-zinc-900 dark:focus:border-amber-400 sm:min-h-[60px] min-h-[56px]"
              />
              <button
                type="button"
                onClick={() => handleAddHobby()}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-base font-medium text-[#1f1f1f] dark:text-zinc-100 transition-colors duration-300 hover:border-[#1f1f1f] dark:hover:border-zinc-500 hover:bg-black dark:hover:bg-zinc-700 hover:text-white sm:min-h-[60px] sm:min-w-[80px] sm:w-auto min-h-[56px]"
              >
                {t("host_about_add_button") || "Add"}
              </button>
            </div>

            {/* Suggested Quick-Add Pills */}
            <div>
              <p className="text-base font-medium text-[#1f1f1f] dark:text-zinc-100">{t("host_about_suggestions_label") || "Suggestions:"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {SUGGESTED_HOBBIES.map((sug) => {
                  const isAdded = hobbies.some((h) => h.toLowerCase() === sug.toLowerCase());
                  if (isAdded) return null;
                  return (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleAddHobby(sug)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-normal text-[#1f1f1f] dark:text-zinc-200 transition-colors hover:border-zinc-500 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <span>+</span> {t(getHobbyTranslationKey(sug), sug)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 6. Where I’ve Been (Travel Stamps) */}
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/90 p-6 shadow-xs sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-700 pb-4">
            <div>
              <h2 className="text-lg font-medium text-[#1f1f1f] dark:text-zinc-100">{t("host_about_travel_stamps_title") || "Where I’ve been"}</h2>
              <p className="mt-0.5 text-sm text-[#727272] dark:text-zinc-400">
                {t("host_about_travel_stamps_desc") || "Pick the stamp you want to appear on your profile"}
              </p>
            </div>

            {/* Visibility Switch */}
            <div className="flex items-center gap-2.5">

              <button
                type="button"
                role="switch"
                aria-checked={stampsVisible}
                aria-label={t("host_about_stamps_toggle_aria") || "Toggle public visibility of travel stamps"}
                onClick={() => setStampsVisible((prev) => !prev)}
                className={`relative inline-flex h-4.75 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${stampsVisible ? "bg-[#DF4557]" : "bg-[#DDDDDE] dark:bg-zinc-700"
                  }`}
              >
                <span
                  className={`pointer-events-none inline-block size-3.75 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${stampsVisible ? "translate-x-6.5" : "translate-x-0"
                    }`}
                />
              </button>
            </div>
          </div>

          {/* Stamps Gallery Preview */}
          <div className="mt-5 space-y-4">
            <div className="flex w-full min-h-24 items-center">
              {selectedStamps.length > 0 ? (
                <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-4 sm:grid-cols-2">
                  {selectedStamps.slice(0, 8).map((stampId) => {
                    const stamp = BUILTIN_TRAVEL_STAMPS.find((item) => item.id === stampId);
                    if (!stamp) return null;
                    return (
                      <div
                        key={stamp.id}
                      >
                        <TravelStampGraphic stamp={stamp} size="lg" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  {t("host_about_no_stamps_selected") || "No travel stamps selected. Pick the stamps you want other people to see on your profile."}
                </p>
              )}
            </div>

            <div className="flex flex-col items-stretch gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {t("host_about_stamps_selected_count", { count: selectedStamps.length }) || `${selectedStamps.length} / 10 stamps selected`}
              </span>
              <button
                type="button"
                onClick={() => setIsStampEditorOpen(true)}
                className="w-full rounded-full border border-[#FCDF9C] dark:border-amber-400 bg-[#FCDF9C] dark:bg-amber-400 px-5 py-2 text-sm font-medium text-[#1f1f1f] dark:text-zinc-950 transition-colors duration-300 hover:border-[#1f1f1f] dark:hover:border-amber-300 hover:bg-[#1f1f1f] dark:hover:bg-amber-300 hover:text-white dark:hover:text-zinc-950 sm:w-auto"
              >
                {t("host_about_edit_travel_stamps_button") || "Edit travel stamp"}
              </button>
            </div>
          </div>
        </section>

        {/* Modal Overlay for Travel Stamps Selector */}
        {isStampEditorOpen && (
          <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs w-full h-full">
            <div className="max-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-y-auto overscroll-contain rounded-xl bg-white dark:bg-zinc-900 p-4 shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-700 sm:p-6">
              <WhereIveBeenSelector
                initialSelectedStamps={selectedStamps}
                initialStampsVisible={stampsVisible}
                currentPublicProfile={rawProfile}
                maxStamps={10}
                isOwner={true}
                onSaved={(updatedProfile) => {
                  const nextProfile = { ...rawProfile, ...updatedProfile };
                  setSelectedStamps(
                    Array.isArray(updatedProfile.selectedStamps)
                      ? updatedProfile.selectedStamps
                      : selectedStamps,
                  );
                  if (typeof updatedProfile.stampsVisible === "boolean") {
                    setStampsVisible(updatedProfile.stampsVisible);
                  }
                  onHostProfileSaved(nextProfile as Record<string, unknown>);
                  setIsStampEditorOpen(false);
                }}
              />
            </div>
          </ModalOverlay>
        )}

        {/* 7. My Interests */}
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/90 p-6 shadow-xs sm:p-7">
          <div className="border-b border-zinc-100 dark:border-zinc-700 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-[#1f1f1f] dark:text-zinc-100">{t("host_about_interests_title") || "My interests"}</h2>
                <p className="mt-0.5 text-sm text-[#727272] dark:text-zinc-400">
                  {t("host_about_interests_desc") || "Choose topics you care about to connect with guests who share similar passions."}
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                {t("host_selected_count", { count: interests.length }) || `${interests.length} selected`}
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {/* Active Interest Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {interests.length > 0 ? (
                interests.map((interest) => (
                  <span
                    key={interest}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3.5 py-1.5 text-xs font-normal text-zinc-800 dark:text-zinc-200"
                  >
                    {t(getInterestTranslationKey(interest), interest)}
                    <button
                      type="button"
                      onClick={() => handleRemoveInterest(interest)}
                      aria-label={`Remove ${interest}`}
                      className="size-4 rounded-full text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      ×
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">{t("host_about_no_interests_added") || "No interests added yet. Pick from reference interests below."}</p>
              )}
            </div>

            {/* Add Custom Interest Input */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddInterest();
                  }
                }}
                placeholder={t("host_about_interests_input_placeholder") || "Add a custom interest (e.g., Ceramic art, Cycling, Modern literature)..."}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-[#1f1f1f] dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none transition-all focus:border-zinc-900 dark:focus:border-amber-400 sm:min-h-[60px] min-h-[56px]"
              />
              <button
                type="button"
                onClick={() => handleAddInterest()}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-base font-medium text-[#1f1f1f] dark:text-zinc-100 transition-colors duration-300 hover:border-[#1f1f1f] dark:hover:border-zinc-500 hover:bg-black dark:hover:bg-zinc-700 hover:text-white sm:min-h-[60px] sm:min-w-[80px] sm:w-auto min-h-[56px]"
              >
                {t("host_about_add_button") || "Add"}
              </button>
            </div>

            {/* Reference Interests List */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{t("host_about_popular_interests_label") || "Popular interests:"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {REFERENCE_INTERESTS.map((ref) => {
                  const isSelected = interests.some((i) => i.toLowerCase() === ref.toLowerCase());
                  if (isSelected) return null;
                  return (
                    <button
                      key={ref}
                      type="button"
                      onClick={() => handleAddInterest(ref)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-normal text-[#1f1f1f] dark:text-zinc-200 transition-colors hover:border-zinc-500 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <span>+</span> {t(getInterestTranslationKey(ref), ref)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 8. Sticky Action Footer Bar (Airbnb Style) */}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleCancel}
            disabled={!isDirty || isSaving}
            className="w-full rounded-full border border-[#1f1f1f] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-5 py-2 text-sm font-medium text-[#1f1f1f] dark:text-zinc-100 transition-colors duration-300 hover:bg-[#1f1f1f] dark:hover:bg-zinc-700 hover:text-white disabled:opacity-50 sm:w-auto"
          >
            {t("host_about_cancel_button") || "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={!isDirty || isSaving}
            className="w-full rounded-full border border-[#FCDF9C] dark:border-amber-400 bg-[#FCDF9C] dark:bg-amber-400 px-5 py-2 text-sm font-medium text-[#1f1f1f] dark:text-zinc-950 transition-colors duration-300 hover:border-[#1f1f1f] dark:hover:border-amber-300 hover:bg-[#1f1f1f] dark:hover:bg-amber-300 hover:text-white dark:hover:text-zinc-950 disabled:opacity-50 sm:w-auto"
          >
            {isSaving && (
              <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {isSaving ? (t("host_about_saving_changes") || "Saving changes…") : (t("host_about_save_profile_button") || "Save profile")}
          </button>
        </div>
      </div>
      {aboutHostScrollThumb.visible && (
        <div ref={aboutHostScrollTrackRef} aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[22px] rounded-[30px] bg-[#F3F4F5] dark:bg-zinc-800 lg:block">
          <div
            className="absolute left-0 top-0 w-[22px] rounded-[30px] border border-white dark:border-zinc-700 bg-[#DDDDDE] dark:bg-zinc-600 shadow-[0_2px_4px_rgba(0,0,0,0.25)] will-change-transform"
            style={{ height: `${aboutHostScrollThumb.height}px`, transform: `translate3d(0, ${aboutHostScrollThumb.top}px, 0)` }}
          />
        </div>
      )}
    </div>
  );
}
