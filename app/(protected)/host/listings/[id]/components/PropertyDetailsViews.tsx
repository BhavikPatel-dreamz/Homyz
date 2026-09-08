"use client";

import React from "react";

interface PropertyDetailsViewsProps {
  activeSection: string;
  setActiveSection: (section: any) => void;
  feedbackMsg: { type: "success" | "error"; text: string } | null;
  isSaving: boolean;
  handleSaveSection: (sectionKey: any) => void;

  // Description
  editDescription: string;
  setEditDescription: (val: string) => void;
  editPropertyDetails: string;
  setEditPropertyDetails: (val: string) => void;
  editAccessDetails: string;
  setEditAccessDetails: (val: string) => void;
  interactionDetails?: string;
  setInteractionDetails?: (val: string) => void;
  otherDetails?: string;
  setOtherDetails?: (val: string) => void;
  openDescAccordion: string | null;
  setOpenDescAccordion: (val: string | null) => void;

  // Title
  editTitle: string;
  setEditTitle: (val: string) => void;

  // Property Type
  whichIsMostLike: string;
  setWhichIsMostLike: (val: string) => void;
  editPropertyType: string;
  setEditPropertyType: (val: string) => void;
  editListingType: string;
  setEditListingType: (val: string) => void;

  // Guests & Rooms
  editGuests: number;
  setEditGuests: (val: number) => void;
  editBedrooms: number;
  setEditBedrooms: (val: number) => void;
  editBeds: number;
  setEditBeds: (val: number) => void;
  editBathrooms: number;
  setEditBathrooms: (val: number) => void;

  // Additional Property Type Fields (Matches Figma screenshot 100%)
  buildingFloors?: number;
  setBuildingFloors?: (val: number) => void;
  listingFloor?: number;
  setListingFloor?: (val: number) => void;
  yearBuilt?: string;
  setYearBuilt?: (val: string) => void;
  propertySize?: string;
  setPropertySize?: (val: string) => void;
  propertySizeUnit?: string;
  setPropertySizeUnit?: (val: string) => void;

  // Amenities
  editAmenities: string[];
  setEditAmenities: (val: string[]) => void;

  // Accessibility
  accessibilityFeatures: any;
  setAccessibilityFeatures: (val: any) => void;
  expandedAccessibility?: string | null;
  setExpandedAccessibility?: (val: string | null) => void;
}

export function PropertyDetailsViews({
  activeSection,
  setActiveSection,
  feedbackMsg,
  isSaving,
  handleSaveSection,
  editDescription,
  setEditDescription,
  editPropertyDetails,
  setEditPropertyDetails,
  editAccessDetails,
  setEditAccessDetails,
  interactionDetails = "",
  setInteractionDetails,
  otherDetails = "",
  setOtherDetails,
  openDescAccordion,
  setOpenDescAccordion,
  editTitle,
  setEditTitle,
  whichIsMostLike,
  setWhichIsMostLike,
  editPropertyType,
  setEditPropertyType,
  editListingType,
  setEditListingType,
  buildingFloors = 1,
  setBuildingFloors,
  listingFloor = 1,
  setListingFloor,
  yearBuilt = "2002",
  setYearBuilt,
  propertySize = "",
  setPropertySize,
  propertySizeUnit = "XX",
  setPropertySizeUnit,
  editGuests,
  setEditGuests,
  editBedrooms,
  setEditBedrooms,
  editBeds,
  setEditBeds,
  editBathrooms,
  setEditBathrooms,
  editAmenities,
  setEditAmenities,
  accessibilityFeatures,
  setAccessibilityFeatures,
  expandedAccessibility = "disabled_parking",
  setExpandedAccessibility,
}: PropertyDetailsViewsProps) {
  return (
    <>
      {/* --------------------------------------------------------- */}
      {/* VIEW 1: DESCRIPTION */}
      {/* --------------------------------------------------------- */}
      {activeSection === "description" && (
        <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
          {/* Header & Back Button */}
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection("title")}
                className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
              >
                ‹
              </button>
              <h1>Description</h1>
            </div>
            <p className="text-xs text-zinc-400 font-normal pl-11">
              *These settings apply to all nights, unless you customize them by date.{" "}
              <a href="#" onClick={(e) => e.preventDefault()} className="underline cursor-pointer hover:text-zinc-700">
                Learn more
              </a>
            </p>
          </div>

          <div className="space-y-3 pt-1">
            {/* 1. Listing description */}
            <div className="rounded-2xl bg-zinc-100/90 border border-zinc-200/80 p-4 space-y-3 shadow-2xs">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setOpenDescAccordion(openDescAccordion === "description" ? null : "description")}
              >
                <div className="space-y-0.5">
                  <h3 className="font-semibold text-xs text-[#1F1F1F]">Listing description</h3>
                  <span className="text-[11px] text-zinc-400 font-normal block">
                    {editDescription ? `${500 - editDescription.length}/500 available` : "295/500 available"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-zinc-600 transition-transform ${
                      openDescAccordion === "description" ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {openDescAccordion === "description" && (
                <div className="space-y-3 pt-1">
                  <div className="rounded-xl bg-white border border-zinc-200 p-3 shadow-2xs">
                    <textarea
                      rows={5}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Describe your space, ambiance, surroundings, and amenities..."
                      className="w-full text-xs text-zinc-800 outline-none bg-transparent leading-relaxed resize-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveSection("description")}
                    className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            {/* 2. Your property */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-3 transition-all">
              <div
                onClick={() => setOpenDescAccordion(openDescAccordion === "property" ? null : "property")}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-xs text-[#1F1F1F]">Your property</h4>
                  <p className="text-[11px] text-zinc-400 font-normal">
                    {editPropertyDetails ? editPropertyDetails.slice(0, 40) + "..." : "Add details"}
                  </p>
                </div>
                <span className="text-zinc-400 text-sm font-semibold">{openDescAccordion === "property" ? "⌄" : "›"}</span>
              </div>

              {openDescAccordion === "property" && (
                <div className="space-y-3 pt-1">
                  <textarea
                    rows={4}
                    value={editPropertyDetails}
                    onChange={(e) => setEditPropertyDetails(e.target.value)}
                    placeholder="Provide additional details about your property layout or unique features..."
                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-800 outline-none focus:border-amber-400 leading-relaxed shadow-2xs"
                  />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveSection("description")}
                    className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            {/* 3. Guest access */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-3 transition-all">
              <div
                onClick={() => setOpenDescAccordion(openDescAccordion === "access" ? null : "access")}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-xs text-[#1F1F1F]">Guest access</h4>
                  <p className="text-[11px] text-zinc-400 font-normal">
                    {editAccessDetails ? editAccessDetails.slice(0, 40) + "..." : "Add details"}
                  </p>
                </div>
                <span className="text-zinc-400 text-sm font-semibold">{openDescAccordion === "access" ? "⌄" : "›"}</span>
              </div>

              {openDescAccordion === "access" && (
                <div className="space-y-3 pt-1">
                  <textarea
                    rows={4}
                    value={editAccessDetails}
                    onChange={(e) => setEditAccessDetails(e.target.value)}
                    placeholder="Specify which parts of the building or grounds guests can access..."
                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-800 outline-none focus:border-amber-400 leading-relaxed shadow-2xs"
                  />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveSection("description")}
                    className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            {/* 4. Interaction with guests */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-3 transition-all">
              <div
                onClick={() => setOpenDescAccordion(openDescAccordion === "interaction" ? null : "interaction")}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-xs text-[#1F1F1F]">Interaction with guests</h4>
                  <p className="text-[11px] text-zinc-400 font-normal">
                    {interactionDetails ? interactionDetails.slice(0, 40) + "..." : "Add details"}
                  </p>
                </div>
                <span className="text-zinc-400 text-sm font-semibold">{openDescAccordion === "interaction" ? "⌄" : "›"}</span>
              </div>

              {openDescAccordion === "interaction" && (
                <div className="space-y-3 pt-1">
                  <textarea
                    rows={4}
                    value={interactionDetails}
                    onChange={(e) => setInteractionDetails?.(e.target.value)}
                    placeholder="Share how much contact or assistance you provide to guests..."
                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-800 outline-none focus:border-amber-400 leading-relaxed shadow-2xs"
                  />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveSection("description")}
                    className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>

            {/* 5. Other details to note */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-3 transition-all">
              <div
                onClick={() => setOpenDescAccordion(openDescAccordion === "other" ? null : "other")}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-xs text-[#1F1F1F]">Other details to note</h4>
                  <p className="text-[11px] text-zinc-400 font-normal">
                    {otherDetails ? otherDetails.slice(0, 40) + "..." : "Add details"}
                  </p>
                </div>
                <span className="text-zinc-400 text-sm font-semibold">{openDescAccordion === "other" ? "⌄" : "›"}</span>
              </div>

              {openDescAccordion === "other" && (
                <div className="space-y-3 pt-1">
                  <textarea
                    rows={4}
                    value={otherDetails}
                    onChange={(e) => setOtherDetails?.(e.target.value)}
                    placeholder="Add any extra notes like stair access, elevator availability, or parking tips..."
                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-800 outline-none focus:border-amber-400 leading-relaxed shadow-2xs"
                  />
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveSection("description")}
                    className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 4: TITLE */}
      {/* --------------------------------------------------------- */}
      {activeSection === "title" && (
        <div className="space-y-6 animate-in fade-in max-w-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveSection("description")}
              className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm cursor-pointer"
            >
              ‹
            </button>
            <h1>Listing title</h1>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="e.g. Modern Villa in Downtown"
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 text-sm font-semibold text-[#1F1F1F] outline-none focus:border-zinc-900 transition-colors shadow-2xs"
            />
            <div className="flex justify-between items-center text-xs text-zinc-400 px-1">
              <span>50 characters maximum</span>
              <span>{editTitle.length}/50</span>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("title")}
              className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-xs transition-all cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Title"}
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 10: PROPERTY TYPE */}
      {/* --------------------------------------------------------- */}
      {activeSection === "propertyType" && (
        <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
          {/* Back button & Section Header */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveSection("description")}
              className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </button>
            <h1>Property type</h1>
          </div>

          <div className="space-y-5 pt-1">
            {/* 1. Which is most like your place? */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-800">Which is most like your place?</label>
              <div className="relative">
                <select
                  value={whichIsMostLike}
                  onChange={(e) => setWhichIsMostLike(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 pr-10 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors cursor-pointer shadow-2xs"
                >
                  <option value="Apartment">Apartment</option>
                  <option value="House">House</option>
                  <option value="Secondary unit">Secondary unit</option>
                  <option value="Unique space">Unique space</option>
                  <option value="Bed & breakfast">Bed & breakfast</option>
                  <option value="Boutique hotel">Boutique hotel</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 2. Property type */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-800">Property type</label>
              <div className="relative">
                <select
                  value={editPropertyType}
                  onChange={(e) => setEditPropertyType(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 pr-10 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors cursor-pointer shadow-2xs"
                >
                  <option value="Rental unit*">Rental unit*</option>
                  <option value="Condo">Condo</option>
                  <option value="Loft">Loft</option>
                  <option value="Serviced apartment">Serviced apartment</option>
                  <option value="Vacation home">Vacation home</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 font-normal pt-0.5">
                A rental place with a multi-unit residential building or complex.
              </p>
            </div>

            {/* 3. Listing type */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-800">Listing type</label>
              <div className="relative">
                <select
                  value={editListingType}
                  onChange={(e) => setEditListingType(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 pr-10 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors cursor-pointer shadow-2xs"
                >
                  <option value="Entire place">Entire place</option>
                  <option value="Private room">Private room</option>
                  <option value="Shared room">Shared room</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 font-normal pt-0.5 leading-relaxed">
                Guests have the whole place to themselves. This usually includes a bedroom, a bathroom and a kitchen.
              </p>
            </div>

            {/* 4. How many floors are in the building */}
            <div className="flex items-center justify-between py-1">
              <label className="text-xs font-semibold text-zinc-800">How many floors are in the building</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBuildingFloors?.(Math.max(1, buildingFloors - 1))}
                  className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer shadow-2xs transition-all"
                >
                  -
                </button>
                <span className="w-5 text-center text-xs font-semibold text-[#1F1F1F]">{buildingFloors}</span>
                <button
                  type="button"
                  onClick={() => setBuildingFloors?.(buildingFloors + 1)}
                  className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer shadow-2xs transition-all"
                >
                  +
                </button>
              </div>
            </div>

            {/* 5. Which floor is the listing on? */}
            <div className="flex items-center justify-between py-1">
              <label className="text-xs font-semibold text-zinc-800">Which floor is the listing on?</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setListingFloor?.(Math.max(1, listingFloor - 1))}
                  className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer shadow-2xs transition-all"
                >
                  -
                </button>
                <span className="w-5 text-center text-xs font-semibold text-[#1F1F1F]">{listingFloor}</span>
                <button
                  type="button"
                  onClick={() => setListingFloor?.(listingFloor + 1)}
                  className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-sm font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer shadow-2xs transition-all"
                >
                  +
                </button>
              </div>
            </div>

            {/* 6. Year built */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-800">Year built</label>
              <div className="relative">
                <select
                  value={yearBuilt}
                  onChange={(e) => setYearBuilt?.(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 pr-10 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors cursor-pointer shadow-2xs"
                >
                  {["2024", "2023", "2022", "2021", "2020", "2015", "2010", "2005", "2002", "2000", "1995", "1990"].map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 7. Property size & Unit */}
            <div className="space-y-1">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-800">Property size</label>
                  <input
                    type="text"
                    value={propertySize}
                    onChange={(e) => setPropertySize?.(e.target.value)}
                    placeholder="XX XXX"
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 text-xs font-medium text-zinc-800 outline-none focus:border-zinc-900 shadow-2xs placeholder:text-zinc-300"
                  />
                </div>
                <div className="col-span-1 space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-800">Unit</label>
                  <div className="relative">
                    <select
                      value={propertySizeUnit}
                      onChange={(e) => setPropertySizeUnit?.(e.target.value)}
                      className="w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3.5 pr-8 text-xs text-zinc-800 font-medium outline-none focus:border-zinc-900 transition-colors cursor-pointer shadow-2xs"
                    >
                      <option value="XX">XX</option>
                      <option value="SQM">SQM</option>
                      <option value="SQFT">SQFT</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500">
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 font-normal pt-0.5">
                The amount of indoor space that's available to guests.
              </p>
            </div>

            {/* 8. Your category block */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start pt-6 border-t border-zinc-200/80 mt-4">
              <div className="sm:col-span-7 space-y-2">
                <h3 className="font-semibold text-sm text-[#1F1F1F]">Your category</h3>
                <p className="text-[11px] text-zinc-500 leading-relaxed font-normal">
                  Lorem ipsum aliquam dignissim sollicitudin libero odio pulvinar fringilla sagittis facilisi erat tempor morbi proin sit pellentesque lacus in facilisis est purus aliquet mauris massa duis placerat tincidunt neque vulputate.
                </p>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="text-xs font-semibold text-[#1F1F1F] underline hover:text-amber-600 inline-block pt-1"
                >
                  Learn more
                </a>
              </div>
              <div className="sm:col-span-5 rounded-2xl bg-zinc-100/90 border border-zinc-200/80 p-5 flex items-center justify-center text-center h-full min-h-[100px]">
                <p className="text-xs font-semibold text-zinc-600 leading-snug">
                  *Your listing isn't part of a part yet.
                </p>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveSection("propertyType")}
                className="rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] border border-transparent hover:border-[#1F1F1F] text-[#1F1F1F] font-medium text-base px-8 py-2.5 transition-all cursor-pointer"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 6: NUMBER OF GUESTS */}
      {/* --------------------------------------------------------- */}
      {activeSection === "guests" && (
        <div className="space-y-10 animate-in fade-in max-w-xl py-12 font-sans flex flex-col items-center justify-center min-h-[400px]">
          {/* Main Question Heading */}
          <h2 className="text-sm font-medium text-zinc-700 text-center tracking-tight">
            How many guests can fit comfortably in your space ?
          </h2>

          {/* Main Counter Display with Soft Yellow Circle */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setEditGuests(Math.max(1, editGuests - 1))}
              className="w-9 h-9 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-zinc-600 text-base font-semibold hover:bg-zinc-100 cursor-pointer shadow-2xs transition-all"
            >
              -
            </button>

            <div className="w-16 h-16 rounded-full bg-[#FEE08B] border border-amber-300/60 flex items-center justify-center text-2xl font-semibold text-zinc-950 shadow-xs">
              {editGuests}
            </div>

            <button
              type="button"
              onClick={() => setEditGuests(editGuests + 1)}
              className="w-9 h-9 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-zinc-600 text-base font-semibold hover:bg-zinc-100 cursor-pointer shadow-2xs transition-all"
            >
              +
            </button>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("guests")}
              className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 5: AMENITIES */}
      {/* --------------------------------------------------------- */}
      {(activeSection === "amenities" || activeSection === "add-amenities") && (
        <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSection("description")}
                  className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
                >
                  ‹
                </button>
                <h1>Amenities</h1>
              </div>
              <p className="text-xs text-zinc-400 font-normal pl-11">
                You've added these to your listing so far.
              </p>
            </div>

            {/* Edit Pill & Plus Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveSection(activeSection === "add-amenities" ? "amenities" : "add-amenities")}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all"
              >
                <span>✏️</span>
                <span>{activeSection === "add-amenities" ? "Done" : "Edit"}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection(activeSection === "add-amenities" ? "amenities" : "add-amenities")}
                className="w-7 h-7 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-700 hover:bg-zinc-100 text-sm font-semibold cursor-pointer shadow-2xs transition-all"
              >
                {activeSection === "add-amenities" ? "✕" : "+"}
              </button>
            </div>
          </div>

          {activeSection === "add-amenities" ? (
            /* Add Amenities Selection View matching Figma Screenshot 100% */
            <div className="space-y-6 pt-1">
              {/* Category Filter Chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  "All", "Basics", "Bathroom", "Bedroom and laundry", "Entertainment",
                  "Family", "Heating and cooling", "Home safety", "Internet and office",
                  "Kitchen and dining", "Location features", "Outdoor", "Parking and facilities", "Services"
                ].map((cat, idx) => (
                  <button
                    key={cat}
                    type="button"
                    className={`rounded-full px-3.5 py-1 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs ${
                      idx === 0
                        ? "bg-zinc-900 text-white"
                        : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Full Amenities List */}
              <div className="divide-y divide-zinc-150/80 pt-2">
                {[
                  { name: "Air conditioning", icon: "🌬️", category: "Heating and cooling" },
                  { name: "Arcade games", icon: "🕹️", category: "Entertainment" },
                  { name: "Baby bath", icon: "🛁", category: "Family" },
                  { name: "Baby monitor", icon: "👶", category: "Family" },
                  { name: "Baby safety gates", icon: "🚪", category: "Family" },
                  { name: "Babysitter recommendation", icon: "👶", category: "Services" },
                  { name: "Backyard", icon: "🏡", category: "Outdoor" },
                  { name: "Baking sheet", icon: "🍪", category: "Kitchen and dining" },
                  { name: "Barbecue utensils", icon: "🥩", category: "Outdoor" },
                  { name: "Bathtub", icon: "🛁", category: "Bathroom" },
                  { name: "BBQ grill", icon: "🍖", category: "Outdoor" },
                  { name: "Beach access", icon: "🏖️", category: "Location features" },
                  { name: "Beach essentials", icon: "🏖️", category: "Location features" },
                  { name: "Bed linens", icon: "🛏️", category: "Bedroom and laundry" },
                  { name: "Bidet", icon: "🚽", category: "Bathroom" },
                  { name: "Bikes", icon: "🚲", category: "Services" },
                  { name: "Blender", icon: "🥤", category: "Kitchen and dining" },
                  { name: "Board games", icon: "🎲", category: "Entertainment" },
                  { name: "Boat slip", icon: "🚤", category: "Location features" },
                  { name: "Body soap", icon: "🧴", category: "Bathroom" },
                  { name: "Fire extinguisher", icon: "🧯", category: "Home safety" },
                  { name: "First aid kit", icon: "🩹", category: "Home safety" },
                  { name: "Free parking on premises", icon: "🅿️", category: "Parking and facilities" },
                  { name: "Hair dryer", icon: "💨", category: "Bathroom" },
                  { name: "Hangers", icon: "👔", category: "Bedroom and laundry" },
                  { name: "Hot water", icon: "♨️", category: "Basics" },
                  { name: "Iron", icon: "👔", category: "Bedroom and laundry" },
                  { name: "Kitchen", icon: "🍳", category: "Kitchen and dining" },
                  { name: "Shampoo", icon: "🧴", category: "Bathroom" },
                  { name: "Shower gel", icon: "🧼", category: "Bathroom" },
                  { name: "Smoke alarm", icon: "🚨", category: "Home safety" },
                  { name: "TV", icon: "📺", category: "Entertainment" },
                  { name: "Wifi", icon: "📶", category: "Internet and office" }
                ].map((item) => {
                  const isSelected = editAmenities.includes(item.name);
                  return (
                    <div
                      key={item.name}
                      onClick={() => {
                        if (isSelected) {
                          setEditAmenities(editAmenities.filter((a) => a !== item.name));
                        } else {
                          setEditAmenities([...editAmenities, item.name]);
                        }
                      }}
                      className="py-3 flex items-center justify-between cursor-pointer group select-none"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-xs shrink-0 shadow-2xs group-hover:border-zinc-300">
                          {item.icon}
                        </div>
                        <span className="font-semibold text-xs text-[#1F1F1F]">{item.name}</span>
                      </div>

                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-[#FEE08B] border border-amber-300/60 flex items-center justify-center text-zinc-950 font-semibold text-xs shadow-2xs">
                          ✓
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-zinc-600 group-hover:bg-zinc-100 text-xs font-semibold shadow-2xs transition-all">
                          +
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Done Button */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setActiveSection("amenities")}
                  className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Main Amenities List View matching Figma screenshot 100% */
            <div className="space-y-4 pt-2">
              <div className="divide-y divide-zinc-150/80">
                {editAmenities.map((am) => {
                  const detailsMap: Record<string, { icon: string; desc?: string }> = {
                    "Air conditioning": { icon: "🌬️", desc: "A system that cools and controls the humidity of an indoor space" },
                    "Bed linens": { icon: "🛏️", desc: "Cotton." },
                    "Body soap": { icon: "🧴" },
                    "Fire extinguisher": { icon: "🧯" },
                    "First aid kit": { icon: "🩹" },
                    "Free parking": { icon: "🅿️", desc: "Parking garage" },
                    "Free parking on premises": { icon: "🅿️", desc: "Parking garage" },
                    "Hair dryer": { icon: "💨" },
                    "Hangers": { icon: "👔" },
                    "Hot water": { icon: "♨️" },
                    "Iron": { icon: "👔" },
                    "Kitchen": { icon: "🍳", desc: "A space for cooking meals that includes at least a refrigerator, oven and stovetop" },
                    "Shampoo": { icon: "🧴" },
                    "Shower gel": { icon: "🧼" },
                    "Smoke alarm": { icon: "🚨", desc: "Lorem ipsum vitae nec duis in in urna molestie a." },
                    "TV": { icon: "📺", desc: "Lorem ipsum vitae nec duis in in urna molestie a." },
                    "Wifi": { icon: "📶", desc: "Lorem ipsum vitae nec duis in in urna molestie a." },
                  };
                  const meta = detailsMap[am] || { icon: "🛋️" };

                  return (
                    <div key={am} className="py-3.5 flex items-start gap-4">
                      <div className="w-9 h-9 rounded-full border border-zinc-200/80 bg-white flex items-center justify-center text-sm shrink-0 shadow-2xs">
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5 space-y-0.5">
                        <h4 className="font-semibold text-xs text-[#1F1F1F] tracking-tight">{am}</h4>
                        {meta.desc && (
                          <p className="text-[11px] text-zinc-400 font-normal leading-relaxed">
                            {meta.desc}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditAmenities(editAmenities.filter((a) => a !== am))}
                        className="text-[11px] text-zinc-400 hover:text-rose-600 font-medium cursor-pointer pt-1 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Save Button */}
              <div className="pt-4">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveSection("amenities")}
                  className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* VIEW 2: ACCESSIBILITY FEATURES */}
      {/* --------------------------------------------------------- */}
      {activeSection === "accessibility" && (
        <div className="space-y-6 animate-in fade-in max-w-xl pb-10 font-sans">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection("description")}
                className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs"
              >
                ‹
              </button>
              <h1>Accessibility features</h1>
            </div>

            {/* Top Right Done Button */}
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("accessibility")}
              className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-6 py-2 shadow-2xs transition-all cursor-pointer"
            >
              {isSaving ? "Saving..." : "Done"}
            </button>
          </div>

          {/* List of Accessibility Features */}
          <div className="space-y-3 pt-2">
            {[
              {
                id: "disabled_parking",
                name: "Disabled parking spot",
                icon: "♿",
                desc: "Lorem ipsum blandit nibh tellus at sit in risus viverra tincidunt purus penatibus odio iaculis eget at fringilla neque morbi."
              },
              {
                id: "lit_path",
                name: "Lit path to the guest entrance",
                icon: "💡",
                desc: "Path from entrance to listing is well-lit for safety."
              },
              {
                id: "step_free",
                name: "Step-free access",
                icon: "🪜",
                desc: "No steps, stairs, or curbs required to enter the property."
              },
              {
                id: "entrance_32",
                name: "Guest entrance wider than 32 inches",
                icon: "↔️",
                desc: "Entrance doorway clearance is at least 32 inches wide."
              },
              {
                id: "pool_hoist",
                name: "Swimming pool or hot tub hoist",
                icon: "🏊",
                desc: "Pool or hot tub is equipped with a mechanical lift."
              },
              {
                id: "ceiling_hoist",
                name: "Ceiling or mobile hoist",
                icon: "🏗️",
                desc: "Equipped with a mobile or ceiling lift device."
              }
            ].map((feature) => {
              const isSelected = Array.isArray(accessibilityFeatures)
                ? accessibilityFeatures.includes(feature.name) || accessibilityFeatures.includes(feature.id)
                : false;
              const isExpanded = expandedAccessibility === feature.id;

              if (isExpanded) {
                return (
                  /* Expanded Grey Container Card matching Figma Screenshot 1 */
                  <div
                    key={feature.id}
                    className="rounded-2xl bg-zinc-100/90 border border-zinc-200/80 p-5 space-y-4 shadow-2xs animate-in fade-in"
                  >
                    {/* Top Row: Icon, Title, Description, Minus Button */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-sm shrink-0 shadow-2xs mt-0.5">
                          {feature.icon}
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-semibold text-xs text-[#1F1F1F]">{feature.name}</h3>
                          <p className="text-[11px] text-zinc-500 font-normal leading-relaxed max-w-md">
                            {feature.desc}
                          </p>
                        </div>
                      </div>

                      {/* Minus Button to Collapse */}
                      <button
                        type="button"
                        onClick={() => setExpandedAccessibility?.(null)}
                        className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-zinc-700 hover:bg-zinc-100 text-xs font-semibold shrink-0 shadow-2xs transition-all cursor-pointer"
                      >
                        -
                      </button>
                    </div>

                    {/* Examples Gallery Grid */}
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-semibold text-zinc-500">Examples:</span>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="aspect-[4/3] rounded-xl bg-zinc-200/80 border border-zinc-300/40 flex items-center justify-center text-[10px] text-zinc-400 font-medium">
                          Photo 1
                        </div>
                        <div className="aspect-[4/3] rounded-xl bg-zinc-200/80 border border-zinc-300/40 flex items-center justify-center text-[10px] text-zinc-400 font-medium">
                          Photo 2
                        </div>
                        <div className="aspect-[4/3] rounded-xl bg-zinc-200/80 border border-zinc-300/40 flex items-center justify-center text-[10px] text-zinc-400 font-medium">
                          Photo 3
                        </div>
                      </div>
                    </div>

                    {/* Feature Selection Options */}
                    <div className="space-y-2 pt-1">
                      {/* Option 1: I don't have this feature */}
                      <div
                        onClick={() => {
                          if (Array.isArray(accessibilityFeatures)) {
                            setAccessibilityFeatures(
                              accessibilityFeatures.filter((f: string) => f !== feature.name && f !== feature.id)
                            );
                          }
                        }}
                        className={`rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all ${
                          !isSelected
                            ? "bg-white border-2 border-zinc-900 shadow-2xs"
                            : "bg-white border border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          !isSelected ? "border-zinc-900 bg-zinc-900" : "border-zinc-400"
                        }`}>
                          {!isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="font-semibold text-xs text-[#1F1F1F]">I don't have this feature</span>
                      </div>

                      {/* Option 2: I have this feature */}
                      <div
                        onClick={() => {
                          if (Array.isArray(accessibilityFeatures)) {
                            if (!isSelected) {
                              setAccessibilityFeatures([...accessibilityFeatures, feature.name]);
                            }
                          } else {
                            setAccessibilityFeatures([feature.name]);
                          }
                        }}
                        className={`rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all ${
                          isSelected
                            ? "bg-white border-2 border-zinc-900 shadow-2xs"
                            : "bg-white border border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? "border-zinc-900 bg-zinc-900" : "border-zinc-400"
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="font-semibold text-xs text-[#1F1F1F]">I have this feature</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                /* Collapsed Line Item */
                <div
                  key={feature.id}
                  className="py-3 flex items-center justify-between cursor-pointer group select-none border-b border-zinc-150/80"
                >
                  <div
                    className="flex items-center gap-4 flex-1"
                    onClick={() => setExpandedAccessibility?.(feature.id)}
                  >
                    <div className="w-9 h-9 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-sm shrink-0 shadow-2xs group-hover:border-zinc-300">
                      {feature.icon}
                    </div>
                    <span className="font-semibold text-xs text-[#1F1F1F] tracking-tight">{feature.name}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExpandedAccessibility?.(isExpanded ? null : feature.id)}
                    className="w-7 h-7 rounded-full border border-zinc-300 bg-white flex items-center justify-center text-zinc-600 group-hover:bg-zinc-100 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>

          {/* Bottom Save/Done Button */}
          <div className="pt-4">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveSection("accessibility")}
              className="rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
