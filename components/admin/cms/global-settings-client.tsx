"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PERMISSIONS, hasPermission } from "@/lib/permissions/permissions";
import type { GlobalSettingsPayload } from "@/lib/cms/content-types";
import { toast } from "@/components/ui/toast";
import { BrandingMediaControl } from "./branding-media-control";

const DEFAULT_GLOBAL_LOGO = "/images/brand/homyz-logo-dark-v1.svg";
const DEFAULT_FAVICON = "/favicon.ico";

const ALL_LOCALES = [
  { code: "en", label: "English (en)" },
  { code: "ar", label: "العربية (ar)" },
  { code: "es", label: "Español (es)" },
  { code: "fr", label: "Français (fr)" },
  { code: "de", label: "Deutsch (de)" },
  { code: "hi", label: "हिन्दी (hi)" },
];

const CURRENCIES = ["SAR", "USD", "EUR", "AED", "GBP", "QAR", "KWD"];

export function GlobalSettingsClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const canEdit = hasPermission(user, PERMISSIONS.CMS_EDIT);

  const [settings, setSettings] = useState<GlobalSettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/admin/cms/settings");
        if (!res.ok) throw new Error("Failed to load global settings");
        const json = await res.json();
        setSettings(json.data || json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/admin/cms/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to update settings");
      }

      const updated = await res.json();
      setSettings(updated.data || updated);
      toast.success("Global website settings updated successfully!");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleLocale = (code: string) => {
    if (!settings) return;
    const current = settings.supportedLocales || [];
    let updated: string[];
    if (current.includes(code)) {
      if (current.length === 1) return; // Prevent deselecting all
      updated = current.filter((c) => c !== code);
    } else {
      updated = [...current, code];
    }
    setSettings({ ...settings, supportedLocales: updated });
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-zinc-500 text-sm">
        Loading global website settings...
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Failed to load settings configuration.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin/cms" className="text-xs text-zinc-500 hover:text-zinc-900 transition">
              ← CMS Hub
            </Link>
            <span className="text-zinc-300">/</span>
            <span className="text-xs font-medium text-zinc-700">Global Website Settings</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-medium text-zinc-900 mt-1">
            Global Website Settings
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Configure platform branding, official legal identity, contact channels, regional defaults, and global SEO.
          </p>
        </div>

        {canEdit && (
          <button
            type="submit"
            form="settings-form"
            disabled={saving}
            className="px-5 py-2 text-xs font-medium rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 transition disabled:opacity-50 shadow-xs"
          >
            {saving ? "Saving Changes..." : "Save Settings"}
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      <form id="settings-form" onSubmit={handleSave} className="space-y-8">
        {/* Section 1: Site Identity */}
        <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-medium text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2">
            1. Platform Identity & Branding
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Website / Platform Name
              </label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Tagline / Slogan
              </label>
              <input
                type="text"
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
            </div>

          </div>
        </div>

        {/* Section 2: Global branding and homepage media */}
        <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
          <div className="border-b border-zinc-100 pb-2">
            <h2 className="text-sm font-medium text-zinc-900 uppercase tracking-wider">2. Branding & Homepage Media</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Upload managed assets to the CMS Media Library. Header-specific logos inherit the global logo when left empty.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BrandingMediaControl
              label="Global Website Logo"
              description="Default logo for all public surfaces without an override."
              value={settings.globalLogoUrl || (settings.logoUrl === DEFAULT_GLOBAL_LOGO ? undefined : settings.logoUrl)}
              assetId={settings.globalLogoAssetId}
              kind="branding"
              disabled={!canEdit}
              onChange={(asset) => setSettings({ ...settings, globalLogoUrl: asset.url, globalLogoAssetId: asset.assetId, logoUrl: asset.url })}
              onClear={() => setSettings({ ...settings, globalLogoUrl: undefined, globalLogoAssetId: undefined, logoUrl: DEFAULT_GLOBAL_LOGO })}
            />
            <BrandingMediaControl
              label="Guest Header Logo"
              description="Optional override for traveler-facing navigation."
              value={settings.guestHeaderLogoUrl}
              assetId={settings.guestHeaderLogoAssetId}
              kind="branding"
              disabled={!canEdit}
              onChange={(asset) => setSettings({ ...settings, guestHeaderLogoUrl: asset.url, guestHeaderLogoAssetId: asset.assetId })}
              onClear={() => setSettings({ ...settings, guestHeaderLogoUrl: undefined, guestHeaderLogoAssetId: undefined })}
            />
            <BrandingMediaControl
              label="Host Header Logo"
              description="Optional override for host workspace navigation."
              value={settings.hostHeaderLogoUrl}
              assetId={settings.hostHeaderLogoAssetId}
              kind="branding"
              disabled={!canEdit}
              onChange={(asset) => setSettings({ ...settings, hostHeaderLogoUrl: asset.url, hostHeaderLogoAssetId: asset.assetId })}
              onClear={() => setSettings({ ...settings, hostHeaderLogoUrl: undefined, hostHeaderLogoAssetId: undefined })}
            />
            <BrandingMediaControl
              label="Admin Dashboard Logo"
              description="Optional override for the administrator sidebar."
              value={settings.adminLogoUrl}
              assetId={settings.adminLogoAssetId}
              kind="branding"
              disabled={!canEdit}
              onChange={(asset) => setSettings({ ...settings, adminLogoUrl: asset.url, adminLogoAssetId: asset.assetId })}
              onClear={() => setSettings({ ...settings, adminLogoUrl: undefined, adminLogoAssetId: undefined })}
            />
            <BrandingMediaControl
              label="Mobile Logo"
              description="Optional mobile-specific logo; falls back to the global logo."
              value={settings.mobileLogoUrl}
              assetId={settings.mobileLogoAssetId}
              kind="branding"
              disabled={!canEdit}
              onChange={(asset) => setSettings({ ...settings, mobileLogoUrl: asset.url, mobileLogoAssetId: asset.assetId })}
              onClear={() => setSettings({ ...settings, mobileLogoUrl: undefined, mobileLogoAssetId: undefined })}
            />
            {/* <BrandingMediaControl
              label="Favicon"
              description="Browser tab and bookmark icon. PNG, WebP and AVIF are supported."
              value={settings.faviconUrl === DEFAULT_FAVICON ? undefined : settings.faviconUrl}
              assetId={settings.faviconAssetId}
              kind="branding"
              disabled={!canEdit}
              onChange={(asset) => setSettings({ ...settings, faviconUrl: asset.url, faviconAssetId: asset.assetId })}
              onClear={() => setSettings({ ...settings, faviconUrl: DEFAULT_FAVICON, faviconAssetId: undefined })}
            /> */}
            <BrandingMediaControl
              label="Homepage Hero — Desktop"
              description="Wide homepage image for tablet and desktop visitors."
              value={settings.homepageHeroDesktopUrl}
              assetId={settings.homepageHeroDesktopAssetId}
              kind="homepage"
              disabled={!canEdit}
              onChange={(asset) => setSettings({ ...settings, homepageHeroDesktopUrl: asset.url, homepageHeroDesktopAssetId: asset.assetId })}
              onClear={() => setSettings({ ...settings, homepageHeroDesktopUrl: undefined, homepageHeroDesktopAssetId: undefined })}
            />
            <BrandingMediaControl
              label="Homepage Hero — Mobile"
              description="Optional portrait/mobile crop. It falls back to the default mobile hero."
              value={settings.homepageHeroMobileUrl}
              assetId={settings.homepageHeroMobileAssetId}
              kind="homepage"
              disabled={!canEdit}
              onChange={(asset) => setSettings({ ...settings, homepageHeroMobileUrl: asset.url, homepageHeroMobileAssetId: asset.assetId })}
              onClear={() => setSettings({ ...settings, homepageHeroMobileUrl: undefined, homepageHeroMobileAssetId: undefined })}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2 text-xs">
            <label className="block font-medium text-zinc-700">Desktop hero focal position
              <select value={settings.homepageHeroDesktopPosition || "center"} onChange={(e) => setSettings({ ...settings, homepageHeroDesktopPosition: e.target.value })} disabled={!canEdit} className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm disabled:opacity-60">
                <option value="center">Center</option><option value="center top">Top</option><option value="center 35%">Upper center</option><option value="center bottom">Bottom</option>
              </select>
            </label>
            <label className="block font-medium text-zinc-700">Mobile hero focal position
              <select value={settings.homepageHeroMobilePosition || "center 12%"} onChange={(e) => setSettings({ ...settings, homepageHeroMobilePosition: e.target.value })} disabled={!canEdit} className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm disabled:opacity-60">
                <option value="center">Center</option><option value="center top">Top</option><option value="center 12%">Upper center</option><option value="center bottom">Bottom</option>
              </select>
            </label>
          </div>
        </div>

        {/* Section 3: Legal Entity & Commercial Registration */}
        <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-medium text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2">
            3. Company Legal Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Legal Entity Name
              </label>
              <input
                type="text"
                value={settings.legalEntityName}
                onChange={(e) => setSettings({ ...settings, legalEntityName: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Commercial Registration / Tax Number (CR/VAT)
              </label>
              <input
                type="text"
                value={settings.businessRegistrationNumber}
                onChange={(e) => setSettings({ ...settings, businessRegistrationNumber: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-medium text-zinc-700 mb-1">
                Registered Business Address
              </label>
              <input
                type="text"
                value={settings.registeredAddress}
                onChange={(e) => setSettings({ ...settings, registeredAddress: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Official Contact Channels */}
        <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-medium text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2">
            4. Customer Support & Contact
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Customer Support Email
              </label>
              <input
                type="email"
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Customer Support Phone
              </label>
              <input
                type="text"
                value={settings.supportPhone}
                onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Localization & Regional Defaults */}
        <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-medium text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2">
            5. Languages & Currency Defaults
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Default Platform Language
              </label>
              <select
                value={settings.defaultLocale}
                onChange={(e) => setSettings({ ...settings, defaultLocale: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm bg-white"
              >
                {ALL_LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Default Currency
              </label>
              <select
                value={settings.defaultCurrency}
                onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm bg-white"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-medium text-zinc-700 mb-2">
                Active Supported Languages
              </label>
              <div className="flex flex-wrap gap-4">
                {ALL_LOCALES.map((l) => {
                  const isChecked = (settings.supportedLocales || []).includes(l.code);
                  return (
                    <label key={l.code} className="inline-flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleLocale(l.code)}
                        className="rounded border-zinc-300 text-zinc-900"
                      />
                      <span>{l.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Section 6: Social Channels */}
        <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-medium text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2">
            6. Official Social Channels
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Facebook URL</label>
              <input
                type="url"
                value={settings.socialMedia?.facebook || ""}
                onChange={(e) => setSettings({
                  ...settings,
                  socialMedia: { ...(settings.socialMedia || {}), facebook: e.target.value },
                })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">Twitter / X URL</label>
              <input
                type="url"
                value={settings.socialMedia?.twitter || ""}
                onChange={(e) => setSettings({
                  ...settings,
                  socialMedia: { ...(settings.socialMedia || {}), twitter: e.target.value },
                })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">Instagram URL</label>
              <input
                type="url"
                value={settings.socialMedia?.instagram || ""}
                onChange={(e) => setSettings({
                  ...settings,
                  socialMedia: { ...(settings.socialMedia || {}), instagram: e.target.value },
                })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">LinkedIn URL</label>
              <input
                type="url"
                value={settings.socialMedia?.linkedin || ""}
                onChange={(e) => setSettings({
                  ...settings,
                  socialMedia: { ...(settings.socialMedia || {}), linkedin: e.target.value },
                })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
            </div>
          </div>
        </div>

        {/* Section 7: SEO Defaults */}
        <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-medium text-zinc-900 uppercase tracking-wider border-b border-zinc-100 pb-2">
            7. Default Search Engine Optimization (SEO)
          </h2>
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Default Meta Title</label>
              <input
                type="text"
                value={settings.seo?.defaultMetaTitle || ""}
                onChange={(e) => setSettings({
                  ...settings,
                  seo: { ...(settings.seo || {}), defaultMetaTitle: e.target.value },
                })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">Default Meta Description</label>
              <textarea
                rows={2}
                value={settings.seo?.defaultMetaDescription || ""}
                onChange={(e) => setSettings({
                  ...settings,
                  seo: { ...(settings.seo || {}), defaultMetaDescription: e.target.value },
                })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">Default OpenGraph Image URL</label>
              <input
                type="text"
                value={settings.seo?.ogImageUrl || ""}
                onChange={(e) => setSettings({
                  ...settings,
                  seo: { ...(settings.seo || {}), ogImageUrl: e.target.value },
                })}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
            </div>
          </div>
        </div>

        {/* Bottom Save Bar */}
        {canEdit && (
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 transition disabled:opacity-50 shadow-sm"
            >
              {saving ? "Saving Changes..." : "Save Global Settings"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
