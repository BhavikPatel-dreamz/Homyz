"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { RealMap, type LocationDetails } from "@/components/ui/real-map";
import {
  inviteListingCoHostAction,
  revokeListingCoHostAction,
} from "@/actions/host/cohosts";
import { updateProfileAction } from "@/actions/user/updateProfile";
import { BUILTIN_TRAVEL_STAMPS } from "@/lib/stamps/stamps-data";
import { TravelStampGraphic } from "@/components/stamps/travel-stamp-graphics";

type CoHost = {
  id: string;
  email: string | null;
  phone: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "REVOKED";
  invitedAt: Date | string;
  expiresAt: Date | string | null;
  acceptedAt: Date | string | null;
  user: { id: string; name: string | null; image: string | null } | null;
};
export type HostProfile = {
  name: string | null;
  image: string | null;
  createdAt: Date | string;
  publicProfile: Record<string, unknown> | null;
};
interface Props {
  activeSection: string;
  isSaving: boolean;
  handleSaveSection: (sectionKey: "location") => void;
  editAddress: string;
  setEditAddress: (value: string) => void;
  neighborhoodDescription: string;
  setNeighborhoodDescription: (value: string) => void;
  gettingAround: string;
  setGettingAround: (value: string) => void;
  scenicViews: Record<string, boolean>;
  setScenicViews: (value: Record<string, boolean>) => void;
  locationFeatures: string[];
  setLocationFeatures: (value: string[]) => void;
  editCity: string;
  setEditCity: (value: string) => void;
  editCountry: string;
  setEditCountry: (value: string) => void;
  showExactLocation: boolean;
  setShowExactLocation: (value: boolean) => void;
  listingId: string;
  coHosts: CoHost[];
  setCoHosts: React.Dispatch<React.SetStateAction<CoHost[]>>;
  hostProfile: HostProfile;
  onHostProfileSaved: (
    profile: Record<string, unknown>,
    hostUpdate?: Pick<HostProfile, "image">,
  ) => void;
}
const LOCATION_FEATURES = [
  ["near_public_transport", "Near public transport"],
  ["near_landmarks", "Near landmarks"],
  ["resort_access", "Resort access"],
] as const;
const SCENIC_VIEWS = [
  ["city_view", "City view"],
  ["mountain_view", "Mountain view"],
  ["ocean_view", "Ocean view"],
  ["garden_view", "Garden view"],
  ["river_view", "River view"],
  ["lake_view", "Lake view"],
] as const;
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-rose-500" : "bg-zinc-300"}`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}
interface Props {
  editDistrict: string;
  setEditDistrict: (value: string) => void;
  editPostalCode: string;
  setEditPostalCode: (value: string) => void;
  latitude: number | null;
  longitude: number | null;
  setLatitude: (value: number | null) => void;
  setLongitude: (value: number | null) => void;
  locationResolutionError: string | null;
  setLocationResolutionError: (value: string | null) => void;
  locationIsResolving: boolean;
  setLocationIsResolving: (value: boolean) => void;
}
function initials(name: string | null) {
  return (name || "Host")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
export function HostAndLocationViews(props: Props) {
  if (props.activeSection === "location")
    return (
      <>
        <EnhancedLocationView {...props} />
        <LocationContextEditor {...props} />
      </>
    );
  if (props.activeSection === "about-host") return <AboutHostView {...props} />;
  if (props.activeSection === "co-host") return <CoHostView {...props} />;
  return null;
}
function LocationContextEditor(props: Props) {
  const toggleFeature = (id: string) =>
    props.setLocationFeatures(
      props.locationFeatures.includes(id)
        ? props.locationFeatures.filter((value) => value !== id)
        : [...props.locationFeatures, id],
    );
  const toggleView = (id: string) =>
    props.setScenicViews({
      ...props.scenicViews,
      [id]: !props.scenicViews[id],
    });
  return (
    <section className="max-w-xl space-y-5 pb-10">
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Location features</h2>
        <p className="text-xs text-zinc-500">
          Choose up to three location advantages. Beach access is managed as an
          amenity.
        </p>
        {LOCATION_FEATURES.map(([id, label]) => (
          <FeatureToggle
            key={id}
            label={label}
            checked={props.locationFeatures.includes(id)}
            onChange={() => toggleFeature(id)}
          />
        ))}
        <SaveButton
          saving={props.isSaving}
          onSave={() => props.handleSaveSection("location")}
        />
      </section>
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Neighborhood</h2>
        <p className="text-xs text-zinc-500">
          Tell guests what they can expect from the neighborhood and what is
          nearby.
        </p>
        <textarea
          value={props.neighborhoodDescription}
          maxLength={2000}
          onChange={(event) =>
            props.setNeighborhoodDescription(event.target.value)
          }
          placeholder="Describe the area, attractions, and local conveniences."
          className="input min-h-28"
        />
        <SaveButton
          saving={props.isSaving}
          onSave={() => props.handleSaveSection("location")}
        />
      </section>
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Getting around</h2>
        <textarea
          value={props.gettingAround}
          maxLength={2000}
          onChange={(event) => props.setGettingAround(event.target.value)}
          placeholder="Share transit, parking, walking, rideshare, or nearby stations."
          className="input min-h-28"
        />
        <SaveButton
          saving={props.isSaving}
          onSave={() => props.handleSaveSection("location")}
        />
      </section>
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Scenic views</h2>
        <div className="grid grid-cols-2 gap-3">
          {SCENIC_VIEWS.map(([id, label]) => (
            <FeatureToggle
              key={id}
              label={label}
              checked={Boolean(props.scenicViews[id])}
              onChange={() => toggleView(id)}
            />
          ))}
        </div>
        <SaveButton
          saving={props.isSaving}
          onSave={() => props.handleSaveSection("location")}
        />
      </section>
    </section>
  );
}
function EnhancedLocationView(props: Props) {
  const updateFromMap = (
    lat: number,
    lng: number,
    details?: LocationDetails,
  ) => {
    props.setLatitude(lat);
    props.setLongitude(lng);
    props.setLocationIsResolving(false);
    props.setLocationResolutionError(null);
    if (details?.address) props.setEditAddress(details.address);
    if (details?.city) props.setEditCity(details.city);
    if (details?.district) props.setEditDistrict(details.district);
    if (details?.postalCode) props.setEditPostalCode(details.postalCode);
    if (details?.country) props.setEditCountry(details.country);
  };
  const onAddressChange = (value: string) => {
    props.setEditAddress(value);
    props.setLocationResolutionError(null);
    props.setLocationIsResolving(Boolean(value || props.editCity));
  };
  return (
    <div className="max-w-xl space-y-5 pb-10">
      <div>
        <h1>Location</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Saved map coordinates are retained until you change the address or
          move the pin.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-zinc-200">
        <RealMap
          address={props.editAddress}
          city={props.editCity}
          country={props.editCountry}
          lat={props.latitude ?? undefined}
          lng={props.longitude ?? undefined}
          preferInitialCoordinates
          showExactLocation={props.showExactLocation}
          onLocationChange={updateFromMap}
          onLocationError={(message) => {
            props.setLocationIsResolving(false);
            props.setLocationResolutionError(message);
          }}
          className="h-64 w-full"
        />
      </div>
      {props.locationIsResolving && (
        <p className="text-xs text-amber-700">Finding this address…</p>
      )}
      {props.locationResolutionError && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
        >
          {props.locationResolutionError}
        </p>
      )}
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Address</h2>
        <input
          value={props.editAddress}
          onChange={(event) => onAddressChange(event.target.value)}
          placeholder="Street address"
          className="input"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            value={props.editCity}
            onChange={(event) => {
              props.setEditCity(event.target.value);
              props.setLocationIsResolving(true);
              props.setLocationResolutionError(null);
            }}
            placeholder="City"
            className="input"
          />
          <input
            value={props.editDistrict}
            onChange={(event) => props.setEditDistrict(event.target.value)}
            placeholder="District"
            className="input"
          />
          <input
            value={props.editPostalCode}
            onChange={(event) => props.setEditPostalCode(event.target.value)}
            placeholder="Postal code"
            className="input"
          />
          <input
            value={props.editCountry}
            onChange={(event) => {
              props.setEditCountry(event.target.value);
              props.setLocationIsResolving(true);
              props.setLocationResolutionError(null);
            }}
            placeholder="Country"
            className="input"
          />
        </div>
        <div className="flex items-center justify-between gap-4 pt-2">
          <div>
            <p className="text-sm font-medium">Show exact location</p>
            <p className="text-xs text-zinc-500">
              Guests otherwise see an approximate map area.
            </p>
          </div>
          <Toggle
            checked={props.showExactLocation}
            onChange={() =>
              props.setShowExactLocation(!props.showExactLocation)
            }
          />
        </div>
        <SaveButton
          saving={props.isSaving || props.locationIsResolving}
          onSave={() => props.handleSaveSection("location")}
        />
      </section>
    </div>
  );
}
function LocationView({
  editAddress,
  setEditAddress,
  neighborhoodDescription,
  setNeighborhoodDescription,
  gettingAround,
  setGettingAround,
  scenicViews,
  setScenicViews,
  locationFeatures,
  setLocationFeatures,
  editCity,
  setEditCity,
  editCountry,
  setEditCountry,
  showExactLocation,
  setShowExactLocation,
  isSaving,
  handleSaveSection,
}: Props) {
  const [open, setOpen] = useState("address");
  const save = () => {
    handleSaveSection("location");
    setOpen("");
  };
  return (
    <div className="max-w-xl space-y-4 pb-10">
      <div>
        <h1>Location</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Share useful area context without making safety guarantees.
        </p>
      </div>
      <div className="h-60 overflow-hidden rounded-2xl border border-zinc-200">
        <RealMap
          address={editAddress}
          city={editCity}
          country={editCountry}
          showExactLocation={showExactLocation}
        />
      </div>
      <Card
        title="Address"
        open={open === "address"}
        onToggle={() => setOpen(open === "address" ? "" : "address")}
      >
        <input
          value={editAddress}
          onChange={(e) => setEditAddress(e.target.value)}
          placeholder="Street address"
          className="input"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            value={editCity}
            onChange={(e) => setEditCity(e.target.value)}
            placeholder="City"
            className="input"
          />
          <input
            value={editCountry}
            onChange={(e) => setEditCountry(e.target.value)}
            placeholder="Country"
            className="input"
          />
        </div>
        <SaveButton saving={isSaving} onSave={save} />
      </Card>
      <Card
        title="Location sharing"
        open={open === "sharing"}
        onToggle={() => setOpen(open === "sharing" ? "" : "sharing")}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Show exact location</p>
            <p className="text-xs text-zinc-500">
              Otherwise guests see only an approximate map area.
            </p>
          </div>
          <Toggle
            checked={showExactLocation}
            onChange={() => setShowExactLocation(!showExactLocation)}
          />
        </div>
        <SaveButton saving={isSaving} onSave={save} />
      </Card>
      <Card
        title="Location features"
        open={open === "features"}
        onToggle={() => setOpen(open === "features" ? "" : "features")}
      >
        {LOCATION_FEATURES.map(([id, label]) => (
          <FeatureToggle
            key={id}
            label={label}
            checked={locationFeatures.includes(id)}
            onChange={() =>
              setLocationFeatures(
                locationFeatures.includes(id)
                  ? locationFeatures.filter((value) => value !== id)
                  : [...locationFeatures, id],
              )
            }
          />
        ))}
        <SaveButton saving={isSaving} onSave={save} />
      </Card>
      <Card
        title="Neighborhood description"
        open={open === "neighborhood"}
        onToggle={() => setOpen(open === "neighborhood" ? "" : "neighborhood")}
      >
        <textarea
          value={neighborhoodDescription}
          maxLength={2000}
          onChange={(e) => setNeighborhoodDescription(e.target.value)}
          placeholder="Describe the area, attractions, and local conveniences."
          className="input min-h-28"
        />
        <p className="text-right text-xs text-zinc-400">
          {neighborhoodDescription.length}/2000
        </p>
        <SaveButton saving={isSaving} onSave={save} />
      </Card>
      <Card
        title="Getting around"
        open={open === "getting-around"}
        onToggle={() =>
          setOpen(open === "getting-around" ? "" : "getting-around")
        }
      >
        <textarea
          value={gettingAround}
          maxLength={2000}
          onChange={(e) => setGettingAround(e.target.value)}
          placeholder="Share transit, parking, walking, or rideshare details."
          className="input min-h-28"
        />
        <p className="text-right text-xs text-zinc-400">
          {gettingAround.length}/2000
        </p>
        <SaveButton saving={isSaving} onSave={save} />
      </Card>
      <Card
        title="Scenic views"
        open={open === "views"}
        onToggle={() => setOpen(open === "views" ? "" : "views")}
      >
        <div className="grid grid-cols-2 gap-3">
          {SCENIC_VIEWS.map(([id, label]) => (
            <FeatureToggle
              key={id}
              label={label}
              checked={Boolean(scenicViews[id])}
              onChange={() =>
                setScenicViews({ ...scenicViews, [id]: !scenicViews[id] })
              }
            />
          ))}
        </div>
        <SaveButton saving={isSaving} onSave={save} />
      </Card>
    </div>
  );
}
function Card({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <span className="text-sm font-semibold">{title}</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-zinc-100 p-5">{children}</div>
      )}
    </section>
  );
}
function FeatureToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-zinc-700">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}
function SaveButton({
  saving,
  onSave,
}: {
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <button
      type="button"
      disabled={saving}
      onClick={onSave}
      className="rounded-full bg-[#FEE08B] px-5 py-2 text-xs font-semibold disabled:opacity-60"
    >
      {saving ? "Saving…" : "Save"}
    </button>
  );
}
const PROFILE_FIELDS = [
  ["whereIWantToGo", "Where I’ve always wanted to go"],
  ["uselessSkill", "My most useless skill"],
  ["myWork", "My work"],
  ["funFact", "My fun fact"],
  ["favoriteSong", "My favorite song in high school"],
  ["obsessedWith", "I’m obsessed with"],
  ["homeUnique", "What makes my home unique"],
  ["spokenLanguages", "Languages I speak"],
  ["pets", "Pets"],
  ["bioTitle", "My biography title would be"],
  ["decadeBorn", "Decade I was born"],
  ["whereILive", "Where I live"],
  ["school", "Where I went to school"],
  ["guestsShouldKnow", "For guests I always"],
  ["spendTooMuchTime", "I spend too much time"],
  ["breakfast", "What’s for breakfast"],
] as const;

const REFERENCE_INTERESTS = [
  ["architecture", "Architecture"],
  ["cooking", "Cooking"],
  ["food_scenes", "Food scenes"],
  ["history", "History"],
  ["live_sports", "Live sports"],
  ["museums", "Museums"],
  ["outdoors", "Outdoors"],
  ["shopping", "Shopping"],
  ["video_games", "Video games"],
] as const;

type ProfileFieldKey = (typeof PROFILE_FIELDS)[number][0];
type ProfileDetails = Record<ProfileFieldKey, string>;

function profileDetailsFrom(raw: Record<string, unknown>): ProfileDetails {
  const prompts = raw.prompts && typeof raw.prompts === "object" && !Array.isArray(raw.prompts)
    ? raw.prompts as Record<string, unknown>
    : {};
  const languageValue = raw.languages;
  const spokenLanguages = Array.isArray(languageValue)
    ? languageValue.filter((value): value is string => typeof value === "string").join(", ")
    : typeof languageValue === "string" ? languageValue : "";
  return Object.fromEntries(PROFILE_FIELDS.map(([key]) => {
    const value = key === "spokenLanguages"
      ? spokenLanguages
      : raw[key] ?? prompts[key];
    return [key, typeof value === "string" ? value : ""];
  })) as ProfileDetails;
}

function ProfilePromptIcon() {
  return (
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm text-zinc-600">
      ✦
    </span>
  );
}

function AboutHostView({ hostProfile, onHostProfileSaved }: Props) {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const raw = hostProfile.publicProfile ?? {};
  const [bio, setBio] = useState(String(raw.bio ?? ""));
  const [details, setDetails] = useState<ProfileDetails>(() => profileDetailsFrom(raw));
  const [interests, setInterests] = useState<string[]>(
    Array.isArray(raw.interests)
      ? raw.interests.filter((v): v is string => typeof v === "string")
      : [],
  );
  const [stampsVisible, setStampsVisible] = useState(raw.stampsVisible !== false);
  const [avatarUrl, setAvatarUrl] = useState(hostProfile.image);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingInterests, setEditingInterests] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const next = hostProfile.publicProfile ?? {};
    setBio(String(next.bio ?? ""));
    setDetails(profileDetailsFrom(next));
    setInterests(Array.isArray(next.interests) ? next.interests.filter((v): v is string => typeof v === "string") : []);
    setStampsVisible(next.stampsVisible !== false);
    setAvatarUrl(hostProfile.image);
  }, [hostProfile.image, hostProfile.publicProfile]);

  const selectedStamps = Array.isArray(raw.selectedStamps)
    ? raw.selectedStamps.filter((v): v is string => typeof v === "string")
    : [];
  const selectedStamp = BUILTIN_TRAVEL_STAMPS.find((stamp) => selectedStamps.includes(stamp.id));

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const currentPrompts = raw.prompts && typeof raw.prompts === "object" && !Array.isArray(raw.prompts)
      ? raw.prompts as Record<string, unknown>
      : {};
    const result = await updateProfileAction({
      publicProfile: {
        ...raw,
        ...details,
        bio,
        interests,
        stampsVisible,
        // Keep the original public prompt contract current for existing listing and public views.
        prompts: {
          ...currentPrompts,
          homeUnique: details.homeUnique,
          guestsShouldKnow: details.guestsShouldKnow,
          hobbies: details.spendTooMuchTime,
          education: details.school,
        },
        languages: details.spokenLanguages,
      },
    });
    setSaving(false);
    if (result.ok) {
      onHostProfileSaved((result.data.publicProfile as Record<string, unknown>) ?? {});
      setMessage("Host profile saved and shared across your listings.");
    } else {
      setMessage(result.error);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/v1/upload/listing-photo", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") throw new Error(data.error || "Could not upload the profile photo.");
      const result = await updateProfileAction({ image: data.url });
      if (!result.ok) throw new Error(result.error || "Could not save the profile photo.");
      setAvatarUrl(data.url);
      onHostProfileSaved(raw, { image: data.url });
      setMessage("Profile photo updated.");
      router.refresh();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update the profile photo.");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  return (
    <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="w-full space-y-5 pb-12">
      <header className="flex items-center gap-3">
        <Link href="/host/listings" aria-label="Back to listings" className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 text-sm text-zinc-500 transition-colors hover:bg-zinc-100">‹</Link>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1F1F1F]">About the host</h1>
      </header>

      <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="relative h-48 w-full shrink-0 overflow-visible sm:h-44 sm:w-60">
          <div className="h-full w-full overflow-hidden rounded-2xl border border-zinc-300 bg-zinc-100 shadow-2xs">
            {avatarUrl ? <img src={avatarUrl} alt={`${hostProfile.name || "Host"} profile`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-amber-100 text-3xl font-semibold text-amber-900">{initials(hostProfile.name)}</div>}
          </div>
          <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage} className="absolute -bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#FCDF9C] px-4 py-2 text-xs font-semibold text-[#1F1F1F] shadow-sm transition-colors hover:bg-[#F7D37D] disabled:cursor-wait disabled:opacity-60">
            <span aria-hidden="true">▧</span>{uploadingImage ? "Uploading…" : "Edit"}
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" onChange={uploadAvatar} className="sr-only" />
        </div>
        <p className="max-w-sm text-sm leading-6 text-[#727272]">Your profile is visible to both hosts and guests, and may be shown throughout Homyz to support a trustworthy community. <Link href="/profile-management" className="font-medium underline underline-offset-2 hover:text-zinc-950">Learn more</Link></p>
      </section>

      <section className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
        {PROFILE_FIELDS.map(([key, label]) => (
          <label key={key} className="flex min-w-0 items-center gap-3 border-b border-zinc-200 py-3.5">
            <ProfilePromptIcon />
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="shrink-0 text-sm text-zinc-500">{label}{details[key] ? ":" : ""}</span>
              <input value={details[key]} maxLength={300} onChange={(event) => setDetails((current) => ({ ...current, [key]: event.target.value }))} aria-label={label} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#1F1F1F] outline-none" />
            </span>
          </label>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 shadow-2xs">
        <label htmlFor="host-bio" className="block text-sm font-semibold text-[#1F1F1F]">About me</label>
        <textarea id="host-bio" value={bio} maxLength={2000} onChange={(event) => setBio(event.target.value)} placeholder="Tell guests a little about yourself." className="mt-3 min-h-28 w-full resize-y rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm leading-6 text-[#1F1F1F] outline-none transition focus:border-zinc-500" />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1F1F1F]">Where I’ve been</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Choose the travel stamps that appear on your profile.</p>
          </div>
          <Toggle checked={stampsVisible} onChange={() => setStampsVisible((visible) => !visible)} />
        </div>
        <div className="flex min-h-32 items-center justify-between gap-4 py-4">
          {selectedStamp ? <TravelStampGraphic stamp={selectedStamp} size="md" /> : <p className="text-sm text-zinc-500">{selectedStamps.length ? `${selectedStamps.length} travel stamp${selectedStamps.length === 1 ? "" : "s"} selected.` : "No travel stamps selected yet."}</p>}
          <div className="min-w-0 text-right">
            {selectedStamps.length > 0 && <p className="truncate text-xs text-zinc-500">{selectedStamps.length} selected</p>}
            <Link href="/profile-management" className="mt-2 inline-flex rounded-full bg-[#FCDF9C] px-4 py-2 text-xs font-semibold text-[#1F1F1F] transition-colors hover:bg-[#F7D37D]">Edit travel stamps</Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
        <div className="border-b border-zinc-200 pb-3">
          <h2 className="text-sm font-semibold text-[#1F1F1F]">My interests</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Select the things you enjoy sharing with guests.</p>
        </div>
        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {REFERENCE_INTERESTS.map(([interest, label]) => {
            const selected = interests.includes(interest);
            const rowClass = "flex w-full items-center gap-3 border-b border-zinc-200 py-3 text-left text-sm text-[#1F1F1F]";
            const content = <><span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${selected && editingInterests ? "border-[#1F1F1F] bg-[#1F1F1F] text-white" : "border-zinc-300 text-zinc-500"}`}>{selected && editingInterests ? "✓" : "◫"}</span>{label}</>;
            return editingInterests ? <button key={interest} type="button" aria-pressed={selected} onClick={() => setInterests((current) => selected ? current.filter((value) => value !== interest) : [...current, interest])} className={`${rowClass} transition-colors hover:text-zinc-600`}>{content}</button> : <div key={interest} className={rowClass}>{content}</div>;
          })}
        </div>
        <button type="button" onClick={() => setEditingInterests((editing) => !editing)} className="mt-4 rounded-full bg-[#FCDF9C] px-4 py-2 text-xs font-semibold text-[#1F1F1F] transition-colors hover:bg-[#F7D37D]">{editingInterests ? "Done editing interests" : "Edit interests"}</button>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs text-zinc-600">{message}</p>
        <button type="submit" disabled={saving} className="rounded-full bg-[#FCDF9C] px-5 py-2.5 text-sm font-semibold text-[#1F1F1F] transition-colors hover:bg-[#F7D37D] disabled:cursor-wait disabled:opacity-60">{saving ? "Saving…" : "Save profile"}</button>
      </div>
    </form>
  );
}
function CoHostView({ listingId, coHosts, setCoHosts }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const invite = async () => {
    setSaving(true);
    const result = await inviteListingCoHostAction(listingId, { email });
    setSaving(false);
    if (result.ok) {
      setCoHosts((items) => [result.data as CoHost, ...items]);
      setOpen(false);
      setEmail("");
      setMessage("Invitation sent.");
    } else setMessage(result.error);
  };
  const revoke = async (id: string) => {
    if (!window.confirm("Remove this co-host or cancel this invitation?"))
      return;
    const result = await revokeListingCoHostAction(listingId, id);
    if (result.ok)
      setCoHosts((items) =>
        items.map((item) => (item.id === id ? (result.data as CoHost) : item)),
      );
    else setMessage(result.error);
  };
  const active = coHosts.filter(
    (item) => item.status === "PENDING" || item.status === "ACCEPTED",
  );
  return (
    <div className="max-w-xl space-y-5 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1>Co-hosts</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Accepted co-hosts are active; pending invitations are not.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-[#FEE08B] px-4 py-2 text-xs font-semibold"
        >
          Invite co-host
        </button>
      </div>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
      {active.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
          No co-hosts or pending invitations.
        </p>
      ) : (
        <div className="space-y-3">
          {active.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 p-4"
            >
              <div>
                <p className="font-medium">
                  {item.user?.name || item.email || item.phone}
                </p>
                <p className="text-xs text-zinc-500">
                  {item.status === "PENDING"
                    ? "Invitation pending"
                    : "Accepted co-host"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => revoke(item.id)}
                className="text-xs font-semibold underline"
              >
                {item.status === "PENDING" ? "Cancel" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}
      {open && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6">
            <h2 className="text-lg font-semibold">Invite a co-host</h2>
            <p className="mt-1 text-xs text-zinc-500">
              They will receive a secure email invitation.
            </p>
            <input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="input mt-5"
            />
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={invite}
                className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Sending…" : "Send invitation"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
