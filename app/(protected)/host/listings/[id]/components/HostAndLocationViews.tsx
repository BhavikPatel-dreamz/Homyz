"use client";

import { BackButton } from "@/components/ui/back-button";

import React from "react";
import { RealMap } from "@/components/ui/real-map";

interface HostAndLocationViewsProps {
  activeSection: string;
  setActiveSection: (section: any) => void;
  isSaving: boolean;
  handleSaveSection: (sectionKey: any) => void;

  // Location
  editAddress: string;
  setEditAddress: (val: string) => void;
  editCity: string;
  setEditCity: (val: string) => void;
  editCountry: string;
  setEditCountry: (val: string) => void;
  showExactLocation: boolean;
  setShowExactLocation: (val: boolean) => void;

  // Co-Hosts
  coHostsList: any[];
  setIsAddCoHostModalOpen: (open: boolean) => void;

  // Photos
  editPhotos: string[];
  setEditPhotos: (photos: string[]) => void;

  // About Host
  listing: any;
  hostInterests: string[];
  setHostInterests: (val: string[]) => void;
  isEditingInterests: boolean;
  setIsEditingInterests: (val: boolean) => void;
}

export function HostAndLocationViews({
  activeSection,
  setActiveSection,
  isSaving,
  handleSaveSection,
  editAddress,
  setEditAddress,
  editCity,
  setEditCity,
  editCountry,
  setEditCountry,
  showExactLocation,
  setShowExactLocation,
  coHostsList,
  setIsAddCoHostModalOpen,
  editPhotos,
  setEditPhotos,
  listing,
  hostInterests,
  setHostInterests,
  isEditingInterests,
  setIsEditingInterests,
}: HostAndLocationViewsProps) {
  return (
    <>
      {/* --------------------------------------------------------- */}
      {/* VIEW 3: LOCATION */}
      {/* --------------------------------------------------------- */}
      {activeSection === "location" && (
        <LocationAccordionView
          editAddress={editAddress}
          setEditAddress={setEditAddress}
          editCity={editCity}
          setEditCity={setEditCity}
          editCountry={editCountry}
          setEditCountry={setEditCountry}
          showExactLocation={showExactLocation}
          setShowExactLocation={setShowExactLocation}
          isSaving={isSaving}
          handleSaveSection={handleSaveSection}
          setActiveSection={setActiveSection}
        />
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 11: CO-HOST MANAGEMENT */}
      {/* --------------------------------------------------------- */}
      {/* --------------------------------------------------------- */}
      {/* VIEW: CO-HOST MANAGEMENT (Matches Figma Screenshot 100%) */}
      {/* --------------------------------------------------------- */}
      {activeSection === "co-host" && (
        <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
          {/* Main Empty State Container */}
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-12 px-4">
            {/* Balloon Envelope Illustration Graphic */}
            <div className="relative w-48 h-44 flex items-center justify-center">
              <div className="relative w-36 h-32 bg-amber-50/60 rounded-3xl border-2 border-dashed border-amber-200/90 flex flex-col items-center justify-center shadow-2xs">
                {/* Balloons */}
                <div className="absolute -top-6 flex items-center gap-1">
                  <span className="w-5 h-7 rounded-full bg-rose-400 opacity-90 shadow-xs block transform -rotate-12" />
                  <span className="w-6 h-8 rounded-full bg-amber-300 opacity-90 shadow-xs block transform -translate-y-2" />
                  <span className="w-5 h-7 rounded-full bg-rose-300 opacity-90 shadow-xs block transform rotate-12" />
                </div>
                {/* Envelope Graphic */}
                <div className="w-20 h-16 bg-white border border-zinc-200 rounded-xl shadow-xs flex items-center justify-center relative mt-3">
                  <span className="text-xl">✉️</span>
                  <div className="absolute bottom-1 w-8 h-0.5 bg-rose-300 rounded-full" />
                </div>
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-2 max-w-sm">
              <h2 className="text-2xl font-semibold tracking-tight text-[#1F1F1F]">Invite a co-host</h2>
              <p className="text-xs text-zinc-500 font-normal leading-relaxed">
                A co-host can help you with everything from managing your calendar to welcoming guests.
              </p>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setIsAddCoHostModalOpen(true);
                }}
                className="text-xs font-semibold text-[#1F1F1F] underline hover:text-zinc-700 block pt-0.5"
              >
                Learn more about
              </a>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={() => setIsAddCoHostModalOpen(true)}
              className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-9 py-3 shadow-2xs transition-all cursor-pointer mt-2"
            >
              Get started
            </button>
          </div>

          {/* Invited Co-hosts list */}
          {coHostsList.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-zinc-200/80">
              <h3 className="font-semibold text-xs text-[#1F1F1F]">Invited Co-hosts ({coHostsList.length})</h3>
              <div className="space-y-2.5">
                {coHostsList.map((ch) => (
                  <div key={ch.id} className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 bg-white shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center font-semibold text-amber-800 text-xs">
                        CH
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#1F1F1F]">{ch.email || ch.phone}</p>
                        <p className="text-[10px] text-zinc-400">{ch.status} · {ch.dateAdded}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-rose-500 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 15: PHOTOS */}
      {/* --------------------------------------------------------- */}
      {activeSection === "photos" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-zinc-150 pb-4">
            <div className="flex items-center gap-3">
              <BackButton onClick={() => setActiveSection("description")} />
              <h1>Photos tour</h1>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {editPhotos.map((photo, i) => (
              <div key={i} className="relative group aspect-[4/3] rounded-2xl overflow-hidden border border-zinc-200 shadow-2xs">
                <img src={photo} alt={`Listing photo ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setEditPhotos(editPhotos.filter((_, index) => index !== i))}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("photos")}
              className="whitespace-nowrap rounded-full bg-[#FCDF9C] px-6 py-3 text-sm font-medium text-[#1F1F1F] transition-colors lg:inline-flex border border-transparent hover:border-[#1F1F1F] hover:bg-[#F3F4F5] hover:text-[#1F1F1F]"
            >
              {isSaving ? "Saving..." : "Save Photo Tour"}
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW: ABOUT THE HOST (Matches Figma Screenshots 100%) */}
      {/* --------------------------------------------------------- */}
      {activeSection === "about-host" && (
        <AboutHostFullView
          listing={listing}
          hostInterests={hostInterests}
          setHostInterests={setHostInterests}
          isEditingInterests={isEditingInterests}
          setIsEditingInterests={setIsEditingInterests}
          setActiveSection={setActiveSection}
          isSaving={isSaving}
          handleSaveSection={handleSaveSection}
        />
      )}
    </>
  );
}

interface LocationAccordionViewProps {
  editAddress: string;
  setEditAddress: (val: string) => void;
  editCity: string;
  setEditCity: (val: string) => void;
  editCountry: string;
  setEditCountry: (val: string) => void;
  showExactLocation: boolean;
  setShowExactLocation: (val: boolean) => void;
  isSaving: boolean;
  handleSaveSection: (sectionKey: any) => void;
  setActiveSection: (val: string) => void;
}

function LocationAccordionView({
  editAddress,
  setEditAddress,
  editCity,
  setEditCity,
  editCountry,
  setEditCountry,
  showExactLocation,
  setShowExactLocation,
  isSaving,
  handleSaveSection,
  setActiveSection,
}: LocationAccordionViewProps) {
  const [openAccordion, setOpenAccordion] = React.useState<string | null>("sharing");
  const [addressPrivacyCancellation, setAddressPrivacyCancellation] = React.useState(false);
  const [locationFeatures, setLocationFeatures] = React.useState<Record<string, boolean>>({
    beachAccess: false,
    lakeAccess: false,
    laundromatNearby: false,
    privateEntrance: false,
    resortAccess: false,
    skiInOut: false,
    waterfront: false,
  });
  const [scenicViews, setScenicViews] = React.useState<Record<string, boolean>>({});

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("description")} />
        <h1>Location</h1>
      </div>

      {/* Map Preview Box */}
      <div className="rounded-2xl overflow-hidden border border-zinc-200 shadow-2xs h-64 relative bg-zinc-100">
        <RealMap
          address={editAddress}
          city={editCity}
          country={editCountry}
          showExactLocation={showExactLocation}
          className="w-full h-full"
        />
      </div>

      {/* Accordion Cards Container */}
      <div className="space-y-3">
        {/* CARD 1: ADDRESS */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden transition-all">
          <div
            onClick={() => setOpenAccordion(openAccordion === "address" ? null : "address")}
            className="p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-50/60 select-none"
          >
            <div className="space-y-0.5">
              <h3 className="font-semibold text-xs text-[#1F1F1F]">Address</h3>
              <p className="text-[11px] text-zinc-400 font-normal">
                {editAddress || editCity || editCountry
                  ? `${editAddress}, ${editCity}, ${editCountry}`
                  : "Add location, Post Code, Country"}
              </p>
            </div>
            <span className="text-zinc-400 text-xs font-semibold">
              {openAccordion === "address" ? "›" : "›"}
            </span>
          </div>

          {openAccordion === "address" && (
            <div className="px-5 pb-5 pt-1 space-y-4 border-t border-zinc-100 animate-in fade-in">
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-zinc-700">Street address</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="e.g. 123 Main St"
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-medium text-zinc-800 outline-none focus:border-zinc-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-zinc-700">City</label>
                    <input
                      type="text"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      placeholder="e.g. Riyadh"
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-medium text-zinc-800 outline-none focus:border-zinc-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-zinc-700">Country</label>
                    <input
                      type="text"
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      placeholder="e.g. Saudi Arabia"
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-medium text-zinc-800 outline-none focus:border-zinc-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    handleSaveSection("location");
                    setOpenAccordion(null);
                  }}
                  className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-6 py-2 shadow-2xs transition-all cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenAccordion(null)}
                  className="rounded-full bg-white border border-zinc-200 text-zinc-700 font-semibold text-xs px-6 py-2 shadow-2xs hover:bg-zinc-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CARD 2: LOCATION SHARING (Matches Figma Screenshot 1 Left/Middle 100%) */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden transition-all">
          <div
            onClick={() => setOpenAccordion(openAccordion === "sharing" ? null : "sharing")}
            className="p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-50/60 select-none"
          >
            <div className="space-y-0.5">
              <h3 className="font-semibold text-xs text-[#1F1F1F]">Location sharing</h3>
              <p className="text-[11px] text-zinc-400 font-normal">
                Show listing's specific location
              </p>
            </div>
            <span className="text-zinc-400 text-xs font-semibold">›</span>
          </div>

          {openAccordion === "sharing" && (
            <div className="px-5 pb-5 pt-1 space-y-5 border-t border-zinc-100 animate-in fade-in">
              {/* Toggle 1: Show your specific location */}
              <div className="flex items-start justify-between gap-4 pt-2">
                <div className="space-y-1 max-w-md">
                  <h4 className="font-semibold text-xs text-[#1F1F1F]">Show your specific location</h4>
                  <p className="text-[11px] text-zinc-400 font-normal leading-relaxed">
                    Lorem ipsum massa pellentesque enim lobortis mattis elit lorem morbi viverra nec congue tempus et pellentesque nibh lobortis et mi placerat iaculis habitasse ac.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExactLocation(!showExactLocation)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 mt-0.5 ${
                    showExactLocation ? "bg-rose-500" : "bg-zinc-300"
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
                      showExactLocation ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Toggle 2: Address privacy for cancellation */}
              <div className="flex items-start justify-between gap-4 border-t border-zinc-100 pt-4">
                <div className="space-y-1 max-w-md">
                  <h4 className="font-semibold text-xs text-[#1F1F1F]">Address privacy for cancellation</h4>
                  <p className="text-[11px] text-zinc-400 font-normal leading-relaxed">
                    Lorem ipsum massa pellentesque enim lobortis mattis elit lorem morbi viverra nec congue tempus et pellentesque nibh lobortis et mi placerat iaculis habitasse ac.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddressPrivacyCancellation(!addressPrivacyCancellation)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 mt-0.5 ${
                    addressPrivacyCancellation ? "bg-rose-500" : "bg-zinc-300"
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
                      addressPrivacyCancellation ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    handleSaveSection("location");
                    setOpenAccordion(null);
                  }}
                  className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-6 py-2 shadow-2xs transition-all cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenAccordion(null)}
                  className="rounded-full bg-white border border-zinc-200 text-zinc-700 font-semibold text-xs px-6 py-2 shadow-2xs hover:bg-zinc-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CARD 3: LOCATION FEATURES (Matches Figma Screenshot 1 Right 100%) */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden transition-all">
          <div
            onClick={() => setOpenAccordion(openAccordion === "features" ? null : "features")}
            className="p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-50/60 select-none"
          >
            <div className="space-y-0.5">
              <h3 className="font-semibold text-xs text-[#1F1F1F]">Location features</h3>
              <p className="text-[11px] text-zinc-400 font-normal">Add details</p>
            </div>
            <span className="text-zinc-400 text-xs font-semibold">›</span>
          </div>

          {openAccordion === "features" && (
            <div className="px-5 pb-5 pt-2 space-y-5 border-t border-zinc-100 animate-in fade-in">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-1">
                {/* Feature 1 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-[#1F1F1F]">Beach access</span>
                    <p className="text-[10px] text-zinc-400 font-normal">Lorem ipsum integer habitasse</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLocationFeatures({ ...locationFeatures, beachAccess: !locationFeatures.beachAccess })
                    }
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      locationFeatures.beachAccess ? "bg-rose-500" : "bg-zinc-300"
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
                        locationFeatures.beachAccess ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Feature 2 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-[#1F1F1F]">Resort access</span>
                    <p className="text-[10px] text-zinc-400 font-normal">Lorem ipsum integer habitasse</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLocationFeatures({ ...locationFeatures, resortAccess: !locationFeatures.resortAccess })
                    }
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      locationFeatures.resortAccess ? "bg-rose-500" : "bg-zinc-300"
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
                        locationFeatures.resortAccess ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Feature 3 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-[#1F1F1F]">Lake access</span>
                    <p className="text-[10px] text-zinc-400 font-normal">Lorem ipsum integer habitasse</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLocationFeatures({ ...locationFeatures, lakeAccess: !locationFeatures.lakeAccess })
                    }
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      locationFeatures.lakeAccess ? "bg-rose-500" : "bg-zinc-300"
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
                        locationFeatures.lakeAccess ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Feature 4 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-[#1F1F1F]">Ski-in/ski-out</span>
                    <p className="text-[10px] text-zinc-400 font-normal">Lorem ipsum integer habitasse</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLocationFeatures({ ...locationFeatures, skiInOut: !locationFeatures.skiInOut })
                    }
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      locationFeatures.skiInOut ? "bg-rose-500" : "bg-zinc-300"
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
                        locationFeatures.skiInOut ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Feature 5 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-[#1F1F1F]">Laundromat nearby</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLocationFeatures({
                        ...locationFeatures,
                        laundromatNearby: !locationFeatures.laundromatNearby,
                      })
                    }
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      locationFeatures.laundromatNearby ? "bg-rose-500" : "bg-zinc-300"
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
                        locationFeatures.laundromatNearby ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Feature 6 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-[#1F1F1F]">Waterfront</span>
                    <p className="text-[10px] text-zinc-400 font-normal">Lorem ipsum integer habitasse</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLocationFeatures({ ...locationFeatures, waterfront: !locationFeatures.waterfront })
                    }
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      locationFeatures.waterfront ? "bg-rose-500" : "bg-zinc-300"
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
                        locationFeatures.waterfront ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Feature 7: Private entrance */}
                <div className="flex items-center justify-between col-span-2 pt-1 border-t border-zinc-100">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-[#1F1F1F]">Private entrance</span>
                    <p className="text-[11px] text-zinc-400 font-normal">An entrance that's only available to guests</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setLocationFeatures({
                        ...locationFeatures,
                        privateEntrance: !locationFeatures.privateEntrance,
                      })
                    }
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      locationFeatures.privateEntrance ? "bg-rose-500" : "bg-zinc-300"
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
                        locationFeatures.privateEntrance ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    handleSaveSection("location");
                    setOpenAccordion(null);
                  }}
                  className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-6 py-2 shadow-2xs transition-all cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenAccordion(null)}
                  className="rounded-full bg-white border border-zinc-200 text-zinc-700 font-semibold text-xs px-6 py-2 shadow-2xs hover:bg-zinc-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CARD 4: NEIGHBORHOOD DESCRIPTION */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden transition-all">
          <div
            onClick={() => setOpenAccordion(openAccordion === "neighborhood" ? null : "neighborhood")}
            className="p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-50/60 select-none"
          >
            <div className="space-y-0.5">
              <h3 className="font-semibold text-xs text-[#1F1F1F]">Neighborhood description</h3>
              <p className="text-[11px] text-zinc-400 font-normal">Add details</p>
            </div>
            <span className="text-zinc-400 text-xs font-semibold">›</span>
          </div>

          {openAccordion === "neighborhood" && (
            <div className="px-5 pb-5 pt-1 space-y-4 border-t border-zinc-100 animate-in fade-in">
              <textarea
                rows={3}
                placeholder="Describe your neighborhood..."
                className="w-full rounded-xl border border-zinc-300 bg-white p-3.5 text-xs font-medium text-zinc-800 outline-none focus:border-zinc-900"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpenAccordion(null)}
                  className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-6 py-2 shadow-2xs transition-all cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setOpenAccordion(null)}
                  className="rounded-full bg-white border border-zinc-200 text-zinc-700 font-semibold text-xs px-6 py-2 shadow-2xs hover:bg-zinc-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CARD 5: GETTING AROUND */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden transition-all">
          <div
            onClick={() => setOpenAccordion(openAccordion === "gettingAround" ? null : "gettingAround")}
            className="p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-50/60 select-none"
          >
            <div className="space-y-0.5">
              <h3 className="font-semibold text-xs text-[#1F1F1F]">Getting around</h3>
              <p className="text-[11px] text-zinc-400 font-normal">Add details</p>
            </div>
            <span className="text-zinc-400 text-xs font-semibold">›</span>
          </div>

          {openAccordion === "gettingAround" && (
            <div className="px-5 pb-5 pt-1 space-y-4 border-t border-zinc-100 animate-in fade-in">
              <textarea
                rows={3}
                placeholder="Add information about transit, parking, or walking..."
                className="w-full rounded-xl border border-zinc-300 bg-white p-3.5 text-xs font-medium text-zinc-800 outline-none focus:border-zinc-900"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpenAccordion(null)}
                  className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-6 py-2 shadow-2xs transition-all cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setOpenAccordion(null)}
                  className="rounded-full bg-white border border-zinc-200 text-zinc-700 font-semibold text-xs px-6 py-2 shadow-2xs hover:bg-zinc-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CARD 6: SCENIC VIEWS (Matches Figma Screenshot 1 100%) */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-2xs overflow-hidden transition-all">
          <div
            onClick={() => setOpenAccordion(openAccordion === "views" ? null : "views")}
            className="p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-50/60 select-none"
          >
            <div className="space-y-0.5">
              <h3 className="font-semibold text-xs text-[#1F1F1F]">Scenic views</h3>
              <p className="text-[11px] text-zinc-400 font-normal">Add details</p>
            </div>
            <span className="text-zinc-400 text-xs font-semibold">
              {openAccordion === "views" ? "∨" : "›"}
            </span>
          </div>

          {openAccordion === "views" && (
            <div className="px-5 pb-5 pt-2 space-y-5 border-t border-zinc-100 animate-in fade-in bg-zinc-50/40">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3.5 pt-1">
                {[
                  "Bay view", "Marina view",
                  "Beach view", "Mountain view",
                  "Canal view", "Ocean view",
                  "City skyline view", "Park view",
                  "Courtyard view", "Pool view",
                  "Desert view", "Resort view",
                  "Garden view", "River view",
                  "Golf course view", "Sea view",
                  "Harbor view", "Valley view",
                  "Lake view", "Vineyard view"
                ].map((viewName) => {
                  const isChecked = Boolean(scenicViews[viewName]);
                  return (
                    <div key={viewName} className="flex items-center justify-between py-0.5">
                      <span className="font-semibold text-xs text-zinc-800 tracking-tight">{viewName}</span>
                      <button
                        type="button"
                        onClick={() => setScenicViews({ ...scenicViews, [viewName]: !isChecked })}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                          isChecked ? "bg-rose-500" : "bg-zinc-300"
                        }`}
                      >
                        <span
                          className={`block w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
                            isChecked ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-zinc-200/60">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    handleSaveSection("location");
                    setOpenAccordion(null);
                  }}
                  className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-6 py-2 shadow-2xs transition-all cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenAccordion(null)}
                  className="rounded-full bg-white border border-zinc-200 text-zinc-700 font-semibold text-xs px-6 py-2 shadow-2xs hover:bg-zinc-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface AboutHostFullViewProps {
  listing: any;
  hostInterests: string[];
  setHostInterests: (interests: string[]) => void;
  isEditingInterests: boolean;
  setIsEditingInterests: (val: boolean) => void;
  setActiveSection: (section: any) => void;
  isSaving: boolean;
  handleSaveSection: (sectionKey: any) => void;
}

export function AboutHostFullView({
  listing,
  hostInterests,
  setHostInterests,
  isEditingInterests,
  setIsEditingInterests,
  setActiveSection,
  isSaving,
  handleSaveSection,
}: AboutHostFullViewProps) {
  const [aboutText, setAboutText] = React.useState(listing.host?.about || "");
  const [whereBeenStamp, setWhereBeenStamp] = React.useState(true);

  const qnaItems = [
    { label: "Where I've always wanted to go", icon: "🌍" },
    { label: "My most useless skill", icon: "🎨" },
    { label: "My work: Architect", icon: "📐" },
    { label: "My fun fact", icon: "💡" },
    { label: "My favorite song in high school", icon: "🎵" },
    { label: "I'm obsessed with", icon: "💖" },
    { label: "What makes my home unique", icon: "🏡" },
    { label: "Language I speak", icon: "🌐" },
    { label: "Pets", icon: "🐾" },
    { label: "My biography title would be", icon: "📖" },
    { label: "Decade I was born", icon: "⏳" },
    { label: "Where I live", icon: "📍" },
    { label: "Where I went to school", icon: "🎓" },
    { label: "For guests I always", icon: "☕" },
    { label: "I spend too much time", icon: "⏰" },
    { label: "What's for breakfast", icon: "🍳" },
  ];

  const interestList = [
    { name: "Architecture", icon: "🏛️" },
    { name: "Cooking", icon: "🍳" },
    { name: "Food scenes", icon: "🍲" },
    { name: "History", icon: "📜" },
    { name: "Live sports", icon: "⚽" },
    { name: "Museums", icon: "🎨" },
    { name: "Outdoors", icon: "🌲" },
    { name: "Shopping", icon: "🛍️" },
    { name: "Video games", icon: "🎮" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
      {/* Back button & Title Header */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("description")} />
        <h1>About the host</h1>
      </div>

      {/* 1. Host Photo & Info Card */}
      <div className="flex items-start gap-5 pt-1">
        {/* Photo Container */}
        <div className="relative w-52 h-44 rounded-2xl overflow-hidden border border-zinc-200 shadow-2xs shrink-0 group">
          <img
            src={listing.host?.image || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"}
            alt="Host profile"
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-4 py-1.5 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>📷</span>
            <span>Edit</span>
          </button>
        </div>

        {/* Info Text */}
        <div className="pt-2 space-y-1 text-xs text-zinc-500 font-normal leading-relaxed">
          <p>
            Your profile is visible to both hosts and guests, and may be shown throughout Homyz to support a trustworthy community.{" "}
            <a href="#" onClick={(e) => e.preventDefault()} className="underline font-semibold text-zinc-700 hover:text-[#1F1F1F]">
              Learn more
            </a>
          </p>
        </div>
      </div>

      {/* 2. 2-Column Host Q&A Items */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-4 border-y border-zinc-200/80">
        {qnaItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-xs shrink-0 shadow-2xs">
              {item.icon}
            </div>
            <span className="text-xs font-semibold text-zinc-700 truncate">{item.label}</span>
          </div>
        ))}
      </div>

      {/* 3. About me Card */}
      <div className="rounded-2xl bg-zinc-100/90 border border-zinc-200/80 p-5 space-y-2.5 shadow-2xs">
        <h3 className="font-semibold text-xs text-[#1F1F1F]">About me</h3>
        <textarea
          rows={3}
          value={aboutText}
          onChange={(e) => setAboutText(e.target.value)}
          placeholder="Type something about you"
          className="w-full rounded-xl bg-white border border-zinc-200 p-4 text-xs font-medium text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-zinc-900 shadow-2xs leading-relaxed"
        />
      </div>

      {/* 4. Where I've been Card */}
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[#1F1F1F]">Where I've been</h3>
          <button
            type="button"
            onClick={() => setWhereBeenStamp(!whereBeenStamp)}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
              whereBeenStamp ? "bg-rose-500" : "bg-zinc-300"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform shadow-xs ${
                whereBeenStamp ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <p className="text-xs text-zinc-500 font-normal">Pick the stamp you want to appear on your profile</p>

        {/* Eiffel Tower Travel Stamp Illustration */}
        <div className="w-36 h-36 relative flex items-center justify-center">
          <div className="w-32 h-32 rounded-full border-2 border-dashed border-rose-300 p-2 flex flex-col items-center justify-center text-center bg-rose-50/30">
            <span className="text-xs font-serif tracking-widest text-zinc-700">stay like a homyz</span>
            <span className="text-2xl pt-1">🗼</span>
            <span className="text-xs font-semibold text-[#1F1F1F] tracking-wider">Paris</span>
          </div>
        </div>

        <button
          type="button"
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-6 py-2.5 shadow-2xs cursor-pointer transition-all"
        >
          Edit travel stamp
        </button>
      </div>

      {/* 5. My interests Card */}
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 space-y-5 shadow-2xs">
        <h3 className="font-semibold text-sm text-[#1F1F1F]">My interests</h3>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
          {interestList.map((interest) => (
            <div key={interest.name} className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-xs shrink-0 shadow-2xs">
                {interest.icon}
              </div>
              <span className="text-xs font-semibold text-zinc-800">{interest.name}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsEditingInterests(!isEditingInterests)}
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-6 py-2.5 shadow-2xs cursor-pointer transition-all"
        >
          Edit interests
        </button>
      </div>
    </div>
  );
}
