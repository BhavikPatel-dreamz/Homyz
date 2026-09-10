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
import { Alert } from "@/components/ui";
import { GuestDashboardSidebar } from "@/components/dashboard/guest-sidebar";
import { TagPeopleInput, TaggedUser } from "@/components/ui/tag-people-input";
import { LocationSearchInput } from "@/components/ui/location-search-input";
import { WhereIveBeenSelector } from "@/components/profile/where-ive-been-selector";
import {
  extractSubTabFromQuery,
  getMgmtSubTabSlug,
  ProfileMgmtSubTab,
} from "@/lib/profile/tab-utils";

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
  languages?: string;
  obsessedWith?: string;
  bioTitle?: string;
  whereILive?: string;
  bio?: string;
  stampsVisible?: boolean;
  profileVisible?: boolean;
  selectedStamps?: string[];
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

type ProfileManagementClientProps = {
  initial: ProfileData;
  initialTripPhotos?: TripPhotoItem[];
  initialStats?: UserStatsData;
  isOwner?: boolean;
  embedded?: boolean;
  onCancel?: () => void;
  initialSubTab?: ProfileMgmtSubTab;
  onSubTabChange?: (subTab: ProfileMgmtSubTab) => void;
};

// Hand-drawn Paris Eiffel Tower Stamp
function StampParis() {
  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full" viewBox="0 0 160 160">
          <circle
            cx="80"
            cy="88"
            r="54"
            fill="#FDE8EB"
            stroke="#A1A1AA"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <path id="parisArc" d="M 28,68 A 62,62 0 0,1 132,68" fill="none" />
          <text
            className="text-[13px] fill-zinc-800"
            style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
          >
            <textPath href="#parisArc" startOffset="50%" textAnchor="middle">
              stay like a homie.
            </textPath>
          </text>
          <g
            stroke="#27272A"
            strokeWidth="1.75"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="80" y1="34" x2="80" y2="48" />
            <circle cx="80" cy="33" r="1.5" fill="#27272A" />
            <polygon points="76,48 84,48 82,72 78,72" />
            <line x1="74" y1="72" x2="86" y2="72" />
            <polygon points="76,72 84,72 87,105 73,105" />
            <line x1="70" y1="105" x2="90" y2="105" />
            <line x1="75" y1="88" x2="85" y2="88" />
            <path d="M 73,105 L 63,142" />
            <path d="M 87,105 L 97,142" />
            <path d="M 69,142 C 72,120 88,120 91,142" />
            <line x1="58" y1="142" x2="102" y2="142" />
          </g>
        </svg>
      </div>
      <span className="text-sm font-serif italic text-zinc-800 mt-1">
        Paris
      </span>
    </div>
  );
}

// Hand-drawn Coffee Moka Pot Stamp
function StampCoffee() {
  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full" viewBox="0 0 160 160">
          <circle
            cx="80"
            cy="88"
            r="54"
            fill="#EEF2FF"
            stroke="#A1A1AA"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <path id="coffeeArc" d="M 28,68 A 62,62 0 0,1 132,68" fill="none" />
          <text
            className="text-[13px] fill-zinc-800"
            style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
          >
            <textPath href="#coffeeArc" startOffset="50%" textAnchor="middle">
              stay like a homie.
            </textPath>
          </text>
          <g
            stroke="#27272A"
            strokeWidth="1.75"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="80" cy="48" r="3" fill="#27272A" />
            <path d="M 68,62 L 80,51 L 92,62 Z" />
            <polygon points="68,62 92,62 88,92 72,92" />
            <line x1="66" y1="92" x2="94" y2="92" />
            <line x1="66" y1="96" x2="94" y2="96" />
            <polygon points="72,96 88,96 92,134 68,134" />
            <path d="M 92,68 C 108,70 108,110 90,115" />
            <path d="M 68,66 L 58,76 L 68,84" />
            <line x1="65" y1="134" x2="95" y2="134" />
          </g>
        </svg>
      </div>
      <span className="text-sm font-serif italic text-zinc-800 mt-1">
        Coffee
      </span>
    </div>
  );
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

export function ProfileManagementClient({
  initial,
  initialTripPhotos = [],
  initialStats = { trips: 12, likes: 0, reviews: 10 },
  isOwner = true,
  embedded = false,
  onCancel,
  initialSubTab,
  onSubTabChange,
}: ProfileManagementClientProps) {
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
    if (onSubTabChange) {
      onSubTabChange(tab);
    } else {
      const slug = getMgmtSubTabSlug(tab);
      window.history.pushState(null, "", `/profile?tab/profile_management/${slug}`);
    }
  };

  const [profileData, setProfileData] = useState<ProfileData>(initial);
  const [tripPhotos, setTripPhotos] =
    useState<TripPhotoItem[]>(initialTripPhotos);
  const [pending, startTransition] = useTransition();
  const { data: session, update: updateSession } = useSession();

  const [msg, setMsg] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
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
    languages: pub.languages || "English and Russian",
    obsessedWith: pub.obsessedWith || "",
    bioTitle: pub.bioTitle || "",
    whereILive: pub.whereILive || "Bucharest, Romania",
    bio:
      pub.bio ||
      "Your profile's got star power—hosts and guests can check it out, helping Homyz stay awesome and trustworthy!",
    stampsVisible: pub.stampsVisible !== false,
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
      if (res.ok && res.data) {
        setProfileData(res.data as ProfileData);
        router.refresh();
      }
    });
  };

  const onSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!isOwner) return;
    setMsg(null);

    const payload = {
      image: imageUrl || initial.image || null,
      name: name || initial.name || null,
      phone: initial.phone || null,
      publicProfile: formDataState,
    };

    startTransition(async () => {
      const res = await updateProfileAction(payload);
      if (!res.ok) {
        setMsg({
          tone: "error",
          text: res.error || "Failed to update profile.",
        });
        return;
      }
      setMsg({ tone: "success", text: "Profile changes saved successfully!" });
      setProfileData(res.data as ProfileData);
      router.refresh();
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isOwner) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/upload/listing-photo", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setImageUrl(data.url);

      const saveRes = await updateProfileAction({
        image: data.url,
        name: initial.name || null,
        phone: initial.phone || null,
        publicProfile: formDataState,
      });

      if (!saveRes.ok) {
        throw new Error(saveRes.error || "Failed to save updated avatar.");
      }

      if (session?.user) {
        await updateSession({ user: { ...session.user, image: data.url } });
      }

      setMsg({ tone: "success", text: "Profile image updated and saved." });
      router.refresh();
    } catch (err: unknown) {
      setMsg({ tone: "error", text: err instanceof Error ? err.message : "Upload error" });
    } finally {
      setUploading(false);
    }
  };

  const stampsVisible = formDataState.stampsVisible !== false;

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
      {msg && (
        <div className="mb-6">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}

      {/* 1. HERO AVATAR CARD & COMMUNITY NOTE */}
      <div className="mb-8 flex flex-col items-start gap-7 sm:flex-row sm:items-center sm:gap-6">
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
                <span>{uploading ? "..." : "Edit"}</span>
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

        <div className="flex-1 max-w-md sm:ml-15">
          <h1 className="mb-4 text-[26px] font-semibold leading-tight text-[#1F1F1F] sm:hidden">
            My profile
          </h1>
          <p className="text-base text-[#727272] leading-relaxed font-normal">
            Your profile is visible to both hosts and guests, and may be shown
            throughout Homyz to support a trustworthy community.{" "}
            <span className="font-semibold underline cursor-pointer hover:text-black transition">
              Learn more
            </span>
          </p>
        </div>
      </div>

      {/* 2. DEDICATED PROFILE MANAGEMENT TABS */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 mb-8 overflow-x-auto">
        <Link
          href="/profile?tab/profile_management/profile_information"
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
          Profile Information
        </Link>

        <Link
          href="/profile?tab/profile_management/trip_photos"
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
          Trip Photos ({tripPhotos.length})
        </Link>

        <Link
          href="/profile?tab/profile_management/where_ive_been"
          onClick={(e) => {
            e.preventDefault();
            handleSubTabClick("stamps");
          }}
          className={`px-4 py-2 rounded-full text-base font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeMgmtTab === "stamps"
              ? "bg-zinc-900 text-white shadow-2xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          Where I&apos;ve Been
        </Link>

        <Link
          href="/profile?tab/profile_management/privacy_visibility"
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
          Privacy & Visibility
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
                  My full name
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
                  placeholder="edit: Your full name"
                />
              </div>
            </div>
            {/* Item 1 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  Where I&apos;ve always wanted to go
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
                  placeholder="edit: Where have you always wanted to travel?"
                />
              </div>
            </div>

            {/* Item 2 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  My work
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
                  placeholder="Add your work"
                />
              </div>
            </div>

            {/* Item 3 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  I spend too much time
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
                  placeholder="Add an answer"
                />
              </div>
            </div>

            {/* Item 4 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  Pets
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
                  placeholder="Add pets"
                />
              </div>
            </div>

            {/* Item 5 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  Decade I was born
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
                  placeholder="Add decade"
                />
              </div>
            </div>

            {/* Item 6 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  Where I went to school
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
                  placeholder="Add school"
                />
              </div>
            </div>

            {/* Item 7 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  My most useless skill
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
                  placeholder="edit: What's your most useless skill?"
                />
              </div>
            </div>

            {/* Item 8 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  My fun fact
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
                  placeholder="edit: What's your fun fact?"
                />
              </div>
            </div>

            {/* Item 9 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  My favorite song in high school
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
                  placeholder="edit: What was your favorite song in high school?"
                />
              </div>
            </div>

            {/* Item 10 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  Languages I speak:{" "}
                  {formDataState.languages || "English and Russian"}
                </span>
                <input
                  value={formDataState.languages}
                  disabled={!isOwner}
                  onChange={(e) =>
                    handleInputChange("languages", e.target.value)
                  }
                  className="w-full sm:text-lg text-sm bg-transparent text-[#1F1F1F] font-medium focus:outline-none"
                  placeholder="Languages"
                />
              </div>
            </div>

            {/* Item 11 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  I&apos;m obsessed with
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
                  placeholder="What are you obsessed with?"
                />
              </div>
            </div>

            {/* Item 12 */}
            <div className="item-box flex items-center gap-3.5 pb-2.5 border-b border-zinc-200/80">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  My biography title would be
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
                  placeholder="My biography title would be"
                />
              </div>
            </div>

            {/* Item 13 */}
            <div className="flex items-center gap-3.5 border-b border-zinc-200/80 pb-2.5">
              <IconSprig />
              <div className="flex-1 min-w-0">
                <span className="block sm:text-base text-sm font-normal text-[#727272]">
                  Where I live:{" "}
                  {formDataState.whereILive || "Bucharest, Romania"}
                </span>
                <input
                  value={formDataState.whereILive}
                  disabled={!isOwner}
                  onChange={(e) =>
                    handleInputChange("whereILive", e.target.value)
                  }
                  className="w-full md:text-lg text-sm bg-transparent text-[#1F1F1F] font-medium focus:outline-none"
                  placeholder="Town, Country"
                />
              </div>
            </div>
          </div>

          {/* About me Textarea Box */}
          <div className="mt-4">
            <h3 className="text-lg font-medium text-[#1F1F1F] mb-3">
              About me
            </h3>
            <div className="rounded-lg border border-[#727272] p-6 min-h-[100px] focus-within:border-zinc-400 transition-colors bg-white">
              <textarea
                value={formDataState.bio}
                disabled={!isOwner}
                onChange={(e) => handleInputChange("bio", e.target.value)}
                onBlur={() => onSubmit()}
                className="w-full h-full bg-transparent resize-none font-normal text-base text-[#727272] placeholder-[#1f1f1f80 focus:outline-none leading-relaxed"
                placeholder="Your profile's got star power—hosts and guests can check it out, helping Homyz stay awesome and trustworthy!"
              />
            </div>
          </div>

          {isOwner && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={pending}
                className="hidden shrink-0 whitespace-nowrap rounded-full bg-[#FCDF9C] px-6 py-3 text-base font-medium text-[#1F1F1F] transition-colors lg:inline-flex border border-transparent hover:border-[#1F1F1F] hover:bg-[#F3F4F5] hover:text-[#1F1F1F]"
              >
                {pending ? "Saving..." : "Save profile"}
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
                Trip Photos Management
              </h3>
              <p className="text-xs text-zinc-500">
                Upload and curate your travel memories
              </p>
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                className="flex items-center gap-2 bg-[#FCDF9C] hover:bg-[#F3F4F5] text-[#1F1F1F] border border-transparent hover:border-[#1F1F1F] hover:text-[#1F1F1F] font-semibold text-sm px-6 py-3 rounded-full transition-colors cursor-pointer shadow-2xs"
              >
                <IconCamera />
                <span>Upload Photos</span>
              </button>
            )}
          </div>

          {tripPhotos.length === 0 ? (
            <div className="border-2 border-dashed border-zinc-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center bg-zinc-50/50">
              <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mb-3">
                <IconCamera />
              </div>
              <p className="text-base font-semibold text-[#1F1F1F]">
                You can upload best images of your trip
              </p>
              <p className="text-xs text-zinc-500 max-w-md mt-1 mb-6 leading-relaxed">
                Select multiple photos, tag travel companions, add captions and
                locations.
              </p>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(true)}
                  className="bg-[#FCDF9C] hover:bg-[#F3F4F5] text-[#1F1F1F] border border-transparent hover:border-[#1F1F1F] hover:text-[#1F1F1F] font-semibold text-sm px-6 py-3 rounded-full transition-colors cursor-pointer shadow-2xs"
                >
                  Upload Photos
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
                  <Image
                    src={photo.url}
                    alt={photo.caption || "Trip photo"}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                    sizes="(max-width: 640px) 100vw, 33vw"
                    onClick={() => setLightboxPhoto(photo)}
                  />

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
                          title="Edit photo"
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
                          title="Delete photo"
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

      {/* TAB 3: WHERE I'VE BEEN (STAMPS & VISIBILITY TOGGLE - Figma Compliant) */}
      {activeMgmtTab === "stamps" && (
        <WhereIveBeenSelector
          initialSelectedStamps={
            formDataState.selectedStamps || pub.selectedStamps || []
          }
          initialStampsVisible={stampsVisible}
          maxStamps={10}
          isOwner={isOwner}
          currentPublicProfile={pub}
          onSaved={(updatedProfile) => {
            if (updatedProfile) {
              setFormDataState((prev) => ({
                ...prev,
                stampsVisible:
                  updatedProfile.stampsVisible ?? prev.stampsVisible,
                selectedStamps:
                  updatedProfile.selectedStamps ?? prev.selectedStamps,
              }));
            }
          }}
        />
      )}

      {/* TAB 4: PRIVACY & VISIBILITY */}
      {activeMgmtTab === "privacy" && (
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-xl font-semibold text-[#1F1F1F]">
              Privacy & Visibility Settings
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Manage who can see your profile and travel history on Homyz.
            </p>
          </div>

          <div className="p-6 rounded-3xl border border-zinc-200/80 bg-white shadow-2xs space-y-6">
            {/* Row 1: Public Profile Visibility */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-[#1F1F1F]">
                  Public Profile Visibility
                </h4>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Allow hosts and other guests to discover your profile
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
                  {(formDataState.profileVisible ?? true) ? "Active" : "OFF"}
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
                      ? "Make profile private"
                      : "Make profile public"
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

            {/* Row 2: Show Travel Stamps ("Where I've Been") */}
            <div className="flex items-center justify-between gap-4 pt-5 border-t border-zinc-100">
              <div>
                <h4 className="text-sm font-semibold text-[#1F1F1F]">
                  Show Travel Stamps (&quot;Where I&apos;ve Been&quot;)
                </h4>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Display your collected country stamps publicly
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Active/OFF Badge */}
                <span
                  className={`text-xs font-semibold px-3.5 py-1 rounded-full border transition-all ${
                    stampsVisible
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                      : "bg-zinc-200 text-zinc-700 border-zinc-300"
                  }`}
                >
                  {stampsVisible ? "Active" : "OFF"}
                </span>

                {/* Interactive Red Toggle Switch matching screenshot */}
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !stampsVisible;
                    setFormDataState((prev) => ({
                      ...prev,
                      stampsVisible: nextVal,
                    }));
                    saveDirectProfileField("stampsVisible", nextVal);
                  }}
                  className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer focus:outline-none ${
                    stampsVisible ? "bg-[#FA595D]" : "bg-zinc-300"
                  }`}
                  title={
                    stampsVisible
                      ? "Hide stamps from public profile"
                      : "Show stamps on public profile"
                  }
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-xs ${
                      stampsVisible ? "translate-x-[22px]" : "translate-x-[2px]"
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
            setTripPhotos((prev) => [...newPhotos, ...prev]);
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [caption, setCaption] = useState("");
  const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError(null);

    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`File ${file.name} exceeds 10MB limit.`);
        continue;
      }
      if (!file.type.startsWith("image/")) {
        setError(`File ${file.name} is not an image.`);
        continue;
      }
      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFiles.length) return;
    setUploading(true);
    setError(null);

    try {
      const uploadedUrls: string[] = [];
      for (const file of selectedFiles) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/v1/upload/listing-photo", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        uploadedUrls.push(data.url);
      }

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload error");
      setUploading(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 text-[#1F1F1F] relative my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#1F1F1F] tracking-tight">
              Upload Trip Photos
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Add your favorite travel memories
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        <form onSubmit={handleUploadSubmit} className="space-y-5">
          {/* File Select Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-300 hover:border-amber-400 bg-zinc-50/80 hover:bg-amber-50/20 rounded-2xl p-5 text-center cursor-pointer transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-2 shadow-2xs">
              <IconCamera />
            </div>
            <p className="text-xs font-semibold text-zinc-800">
              Select trip photos
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              You can upload best images of your trip (Max 10MB each)
            </p>
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
          </div>

          {/* Selected Photo Previews Grid */}
          {previews.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-800 mb-2">
                Selected Photos ({previews.length})
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
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/75 hover:bg-rose-600 text-white flex items-center justify-center text-[10px] transition-colors cursor-pointer"
                      title="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
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
                Caption
              </label>
              <span className="text-[11px] font-semibold text-zinc-400">
                {caption.length} / 300
              </span>
            </div>
            <textarea
              value={caption}
              maxLength={300}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tell the story behind this trip..."
              className="w-full rounded-2xl border border-zinc-200 px-3.5 py-2.5 text-xs text-[#1F1F1F] placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 h-20 resize-none transition-all shadow-2xs"
            />
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || selectedFiles.length === 0}
              className="bg-[#FDE29B] hover:bg-[#FCD885] text-[#1F1F1F] text-xs font-semibold px-7 py-2.5 rounded-full transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {uploading ? "Uploading..." : `Upload (${selectedFiles.length})`}
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
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const tags = taggedUsers.map((u) => u.name || u.email || u.id);

      const res = await updateTripPhotoAction(photo.id, {
        location: location.trim() || undefined,
        caption: caption.trim() || undefined,
        tags,
      });

      if (!res.ok) throw new Error(res.error || "Update photo failed");
      onSaved(res.data as TripPhotoItem);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save error");
      setSaving(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 text-[#1F1F1F] relative my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
          <h3 className="text-lg font-semibold text-[#1F1F1F]">
            Edit Photo Details
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-zinc-200 shadow-2xs">
            <Image src={photo.url} alt="Photo" fill className="object-cover" />
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
                Caption
              </label>
              <span className="text-[11px] font-semibold text-zinc-400">
                {caption.length} / 300
              </span>
            </div>
            <textarea
              value={caption}
              maxLength={300}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tell the story behind this trip..."
              className="w-full rounded-2xl border border-zinc-200 px-3.5 py-2.5 text-xs text-[#1F1F1F] placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 h-20 resize-none transition-all shadow-2xs"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => onDeleteTrigger(photo)}
              className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
            >
              Delete Photo
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-semibold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-[#FDE29B] hover:bg-[#FCD885] text-[#1F1F1F] text-xs font-semibold px-6 py-2 rounded-full disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {saving ? "Saving..." : "Save Details"}
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
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const res = await deleteTripPhotoAction(photo.id);
      if (!res.ok) throw new Error(res.error || "Delete failed");
      onDeleted(photo.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Deletion error");
      setDeleting(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 text-[#1F1F1F] relative my-auto">
        <h3 className="text-lg font-semibold text-[#1F1F1F] mb-2">
          Delete Trip Photo
        </h3>
        <p className="text-xs text-zinc-500 mb-4">
          Are you sure you want to delete this trip photo?
        </p>

        {error && (
          <div className="mb-4">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-zinc-200 mb-4">
          <Image src={photo.url} alt="Photo" fill className="object-cover" />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 rounded-full text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-6 py-2 rounded-full disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Confirm Delete"}
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
          ✕ Close
        </button>
        <div className="relative w-full h-[70vh] rounded-2xl overflow-hidden shadow-2xl">
          <Image
            src={photo.url}
            alt="Photo"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>
    </ModalOverlay>
  );
}
