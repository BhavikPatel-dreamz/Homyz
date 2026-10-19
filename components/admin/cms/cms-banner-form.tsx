"use client";

import React, { useState } from "react";
import { CmsMediaPickerModal } from "./cms-media-picker-modal";

export interface BannerPayload {
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl?: string;
  buttonText?: string;
  backgroundColor?: string;
  textColor?: string;
}

export interface CmsBannerFormProps {
  payload: BannerPayload;
  onChange: (updatedPayload: BannerPayload) => void;
  title: string;
  onTitleChange: (title: string) => void;
  slug: string;
  onSlugChange: (slug: string) => void;
  changeSummary: string;
  onChangeSummaryChange: (summary: string) => void;
  errors?: Record<string, string>;
}

export function CmsBannerForm({
  payload,
  onChange,
  title,
  onTitleChange,
  slug,
  onSlugChange,
  changeSummary,
  onChangeSummaryChange,
  errors = {},
}: CmsBannerFormProps) {
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const updateField = (field: keyof BannerPayload, value: any) => {
    onChange({
      ...payload,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Content Identity */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-3 flex items-center justify-between">
          <span>Banner Identity & Route</span>
          <span className="text-[11px] font-normal text-zinc-400">Required attributes</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Internal Admin Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Diwali Offers 2026"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              Identifies this item in the CMS table and audit logs.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              URL Slug (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. diwali-offers"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              Slug used for deep-linking or targeted placement rules.
            </p>
          </div>
        </div>
      </div>

      {/* Banner Content & Copy */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-3 flex items-center justify-between">
          <span>Banner Headline & Copy</span>
          <span className="text-[11px] font-normal text-zinc-400">Rendered on storefront</span>
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Banner Headline <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Celebrate Diwali with Exclusive Retreats"
              value={payload.title || ""}
              onChange={(e) => updateField("title", e.target.value)}
              className={`w-full px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 ${
                errors.title ? "border-rose-400 bg-rose-50/20" : "border-zinc-200"
              }`}
            />
            {errors.title && (
              <p className="text-xs text-rose-600 mt-1">{errors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Subtitle / Description
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Save up to 25% on luxury villas and cozy boutique stays for family vacations."
              value={payload.description || ""}
              onChange={(e) => updateField("description", e.target.value)}
              className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* Imagery & Media */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-3 flex items-center justify-between">
          <span>Banner Imagery</span>
          <span className="text-[11px] font-normal text-zinc-400">Media asset</span>
        </h3>

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-zinc-700">
            Banner Image URL <span className="text-rose-500">*</span>
          </label>

          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <input
              type="text"
              required
              placeholder="/images/home/hero-banner.png or full image URL"
              value={payload.imageUrl || ""}
              onChange={(e) => updateField("imageUrl", e.target.value)}
              className={`flex-1 px-3.5 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 w-full ${
                errors.imageUrl ? "border-rose-400 bg-rose-50/20" : "border-zinc-200"
              }`}
            />

            <button
              type="button"
              onClick={() => setShowMediaPicker(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition shrink-0 w-full sm:w-auto justify-center"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Browse Media Library
            </button>
          </div>

          {errors.imageUrl && (
            <p className="text-xs text-rose-600">{errors.imageUrl}</p>
          )}

          {/* Image Thumbnail Preview */}
          {payload.imageUrl && (
            <div className="flex items-center gap-4 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
              <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-zinc-200 shrink-0 border border-zinc-300">
                <img
                  src={payload.imageUrl}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-semibold text-zinc-800 truncate">{payload.imageUrl}</p>
                <p className="text-zinc-400 text-[11px] mt-0.5">Active banner visual asset</p>
              </div>
              <button
                type="button"
                onClick={() => updateField("imageUrl", "")}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Button & Destination Link */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-3">
          Call to Action & Destination
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              CTA Button Label
            </label>
            <input
              type="text"
              placeholder="e.g. Explore Offers"
              value={payload.buttonText || ""}
              onChange={(e) => updateField("buttonText", e.target.value)}
              className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Destination URL / Route
            </label>
            <input
              type="text"
              placeholder="e.g. /search?discount=true or /listings"
              value={payload.linkUrl || ""}
              onChange={(e) => updateField("linkUrl", e.target.value)}
              className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>
      </div>

      {/* Appearance & Color Styling */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-3">
          Banner Theme & Color Palette
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Background Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={payload.backgroundColor || "#1F1F1F"}
                onChange={(e) => updateField("backgroundColor", e.target.value)}
                className="w-10 h-10 p-0.5 rounded-lg border border-zinc-200 cursor-pointer"
              />
              <input
                type="text"
                value={payload.backgroundColor || "#1F1F1F"}
                onChange={(e) => updateField("backgroundColor", e.target.value)}
                className="flex-1 px-3.5 py-2 border border-zinc-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Text & Headline Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={payload.textColor || "#FFFFFF"}
                onChange={(e) => updateField("textColor", e.target.value)}
                className="w-10 h-10 p-0.5 rounded-lg border border-zinc-200 cursor-pointer"
              />
              <input
                type="text"
                value={payload.textColor || "#FFFFFF"}
                onChange={(e) => updateField("textColor", e.target.value)}
                className="flex-1 px-3.5 py-2 border border-zinc-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Revision Note */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
        <label className="block text-xs font-semibold text-zinc-700">
          Revision Change Summary
        </label>
        <input
          type="text"
          placeholder="e.g. Updated festive headline and refreshed CTA destination link"
          value={changeSummary}
          onChange={(e) => onChangeSummaryChange(e.target.value)}
          className="w-full px-3.5 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
        <p className="text-[11px] text-zinc-400">
          Documented in immutable audit history for this revision.
        </p>
      </div>

      {/* Media Picker Modal */}
      <CmsMediaPickerModal
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        currentUrl={payload.imageUrl}
        onSelect={(asset) => {
          updateField("imageUrl", asset.url);
        }}
      />
    </div>
  );
}

