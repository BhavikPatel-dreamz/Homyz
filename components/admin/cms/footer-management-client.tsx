"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PERMISSIONS, hasPermission } from "@/lib/permissions/permissions";
import type { FooterConfigPayload } from "@/lib/cms/content-types";

const APPROVED_STATIC_PAGES = [
  { slug: "about", label: "About Us (/about)" },
  { slug: "terms", label: "Terms of Service (/terms)" },
  { slug: "privacy", label: "Privacy Policy (/privacy)" },
  { slug: "cookies", label: "Cookie Policy (/cookies)" },
  { slug: "safety", label: "Safety Information (/safety)" },
  { slug: "accessibility", label: "Accessibility & Disability Support (/accessibility)" },
  { slug: "cancellation-policy", label: "Cancellation Policy (/cancellation-policy)" },
  { slug: "anti-discrimination", label: "Anti-discrimination Policy (/anti-discrimination)" },
  { slug: "hosting-resources", label: "Hosting Resources (/hosting-resources)" },
  { slug: "hosting-responsibly", label: "Hosting Responsibly (/hosting-responsibly)" },
  { slug: "contact", label: "Contact Us (/contact)" },
  { slug: "careers", label: "Careers (/careers)" },
  { slug: "newsroom", label: "Newsroom (/newsroom)" },
  { slug: "help", label: "Help Centre (/help)" },
  { slug: "become-a-host", label: "Become a Host (/become-a-host)" },
  { slug: "host/onboarding", label: "Host Onboarding (/host/onboarding)" },
  { slug: "host/co-host", label: "Find a Co-Host (/host/co-host)" },
  { slug: "giftcards", label: "Gift Cards (/giftcards)" },
];

const LOCALES = [
  { code: "en", label: "English" },
  { code: "ar", label: "العربية (Arabic)" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "hi", label: "हिन्दी" },
];

export function FooterManagementClient() {
  const { data: session } = useSession();
  const user = session?.user;

  const canEdit = hasPermission(user, PERMISSIONS.CMS_EDIT);
  const canPublish = hasPermission(user, PERMISSIONS.CMS_PUBLISH);
  const canRollback = hasPermission(user, PERMISSIONS.CMS_ROLLBACK);

  const [locale, setLocale] = useState("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Footer data state
  const [payload, setPayload] = useState<FooterConfigPayload | null>(null);
  const [status, setStatus] = useState<string>("DRAFT");
  const [versionNumber, setVersionNumber] = useState<number>(0);
  const [publishedVersionNumber, setPublishedVersionNumber] = useState<number | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState<"columns" | "social" | "bottom" | "appearance">("columns");

  const loadFooter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/cms/footer?locale=${locale}`);
      if (!res.ok) throw new Error("Failed to load footer data");
      const json = await res.json();
      const data = json.data || json;
      setPayload(data.payload);
      setStatus(data.status);
      setVersionNumber(data.versionNumber);
      setPublishedVersionNumber(data.publishedVersionNumber);
      setVersions(data.versions || []);
    } catch (err: any) {
      setError(err.message || "Failed to load footer");
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    loadFooter();
  }, [loadFooter]);

  const handleSaveDraft = async () => {
    if (!payload) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/v1/admin/cms/footer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "draft",
          locale,
          payload,
          changeSummary: `Admin saved draft in ${locale.toUpperCase()}`,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to save draft");
      }
      setSuccess("Draft saved successfully!");
      await loadFooter();
    } catch (err: any) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!payload) return;
    if (!confirm("Are you sure you want to publish these footer changes to the LIVE website?")) return;
    setPublishing(true);
    setError(null);
    setSuccess(null);
    try {
      // Save draft first to ensure latest changes are saved
      await fetch("/api/v1/admin/cms/footer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "draft",
          locale,
          payload,
          changeSummary: `Draft pre-publish save in ${locale.toUpperCase()}`,
        }),
      });

      const res = await fetch("/api/v1/admin/cms/footer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          locale,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Publish failed");
      }
      setSuccess("Footer configuration successfully published live!");
      await loadFooter();
    } catch (err: any) {
      setError(err.message || "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const handleRollback = async (targetVersionId: string) => {
    if (!confirm("Roll back footer to this previous revision? This will publish that revision live.")) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/v1/admin/cms/footer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rollback",
          locale,
          versionId: targetVersionId,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Rollback failed");
      }
      setSuccess("Footer rolled back and published successfully!");
      setShowHistory(false);
      await loadFooter();
    } catch (err: any) {
      setError(err.message || "Rollback failed");
    }
  };

  // Column Manipulation
  const addColumn = () => {
    if (!payload) return;
    const newCol = {
      id: `col-${Date.now()}`,
      title: "New Column",
      displayOrder: payload.columns.length + 1,
      enabled: true,
      links: [],
    };
    setPayload({
      ...payload,
      columns: [...payload.columns, newCol],
    });
  };

  const removeColumn = (colIndex: number) => {
    if (!payload) return;
    const cols = [...payload.columns];
    cols.splice(colIndex, 1);
    setPayload({ ...payload, columns: cols });
  };

  const updateColumnTitle = (colIndex: number, title: string) => {
    if (!payload) return;
    const cols = [...payload.columns];
    cols[colIndex] = { ...cols[colIndex], title };
    setPayload({ ...payload, columns: cols });
  };

  const toggleColumnEnabled = (colIndex: number) => {
    if (!payload) return;
    const cols = [...payload.columns];
    cols[colIndex] = { ...cols[colIndex], enabled: !cols[colIndex].enabled };
    setPayload({ ...payload, columns: cols });
  };

  const moveColumn = (colIndex: number, direction: "up" | "down") => {
    if (!payload) return;
    const cols = [...payload.columns];
    const targetIdx = direction === "up" ? colIndex - 1 : colIndex + 1;
    if (targetIdx < 0 || targetIdx >= cols.length) return;
    const temp = cols[colIndex];
    cols[colIndex] = cols[targetIdx];
    cols[targetIdx] = temp;
    // Reassign displayOrder
    cols.forEach((c, idx) => {
      c.displayOrder = idx + 1;
    });
    setPayload({ ...payload, columns: cols });
  };

  // Link Manipulation
  const addLinkToColumn = (colIndex: number) => {
    if (!payload) return;
    const cols = [...payload.columns];
    const col = { ...cols[colIndex] };
    const newLink = {
      id: `lnk-${Date.now()}`,
      label: "New Link",
      href: "/about",
      targetPageSlug: "about",
      openInNewTab: false,
      enabled: true,
      displayOrder: (col.links || []).length + 1,
    };
    col.links = [...(col.links || []), newLink];
    cols[colIndex] = col;
    setPayload({ ...payload, columns: cols });
  };

  const removeLinkFromColumn = (colIndex: number, linkIndex: number) => {
    if (!payload) return;
    const cols = [...payload.columns];
    const col = { ...cols[colIndex] };
    const links = [...col.links];
    links.splice(linkIndex, 1);
    col.links = links;
    cols[colIndex] = col;
    setPayload({ ...payload, columns: cols });
  };

  const updateLink = (colIndex: number, linkIndex: number, updates: any) => {
    if (!payload) return;
    const cols = [...payload.columns];
    const col = { ...cols[colIndex] };
    const links = [...col.links];
    links[linkIndex] = { ...links[linkIndex], ...updates };
    col.links = links;
    cols[colIndex] = col;
    setPayload({ ...payload, columns: cols });
  };

  const moveLink = (colIndex: number, linkIndex: number, direction: "up" | "down") => {
    if (!payload) return;
    const cols = [...payload.columns];
    const col = { ...cols[colIndex] };
    const links = [...col.links];
    const targetIdx = direction === "up" ? linkIndex - 1 : linkIndex + 1;
    if (targetIdx < 0 || targetIdx >= links.length) return;
    const temp = links[linkIndex];
    links[linkIndex] = links[targetIdx];
    links[targetIdx] = temp;
    links.forEach((l, idx) => {
      l.displayOrder = idx + 1;
    });
    col.links = links;
    cols[colIndex] = col;
    setPayload({ ...payload, columns: cols });
  };

  // Social Links
  const addSocialLink = () => {
    if (!payload) return;
    const newSocial = {
      id: `soc-${Date.now()}`,
      platform: "facebook",
      url: "https://facebook.com",
      enabled: true,
      displayOrder: (payload.socialLinks || []).length + 1,
    };
    setPayload({
      ...payload,
      socialLinks: [...(payload.socialLinks || []), newSocial],
    });
  };

  const updateSocialLink = (index: number, updates: any) => {
    if (!payload) return;
    const list = [...(payload.socialLinks || [])];
    list[index] = { ...list[index], ...updates };
    setPayload({ ...payload, socialLinks: list });
  };

  const removeSocialLink = (index: number) => {
    if (!payload) return;
    const list = [...(payload.socialLinks || [])];
    list.splice(index, 1);
    setPayload({ ...payload, socialLinks: list });
  };

  // Bottom Links
  const addBottomLink = () => {
    if (!payload) return;
    const newLink = {
      id: `bot-${Date.now()}`,
      label: "Legal Link",
      href: "/terms",
      targetPageSlug: "terms",
      openInNewTab: false,
      enabled: true,
      displayOrder: (payload.bottomLinks || []).length + 1,
    };
    setPayload({
      ...payload,
      bottomLinks: [...(payload.bottomLinks || []), newLink],
    });
  };

  const updateBottomLink = (index: number, updates: any) => {
    if (!payload) return;
    const list = [...(payload.bottomLinks || [])];
    list[index] = { ...list[index], ...updates };
    setPayload({ ...payload, bottomLinks: list });
  };

  const removeBottomLink = (index: number) => {
    if (!payload) return;
    const list = [...(payload.bottomLinks || [])];
    list.splice(index, 1);
    setPayload({ ...payload, bottomLinks: list });
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-zinc-500 text-sm">
        Loading footer configuration...
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Failed to initialize footer editor.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin/cms" className="text-xs text-zinc-500 hover:text-zinc-900 transition">
              ← CMS Hub
            </Link>
            <span className="text-zinc-300">/</span>
            <span className="text-xs font-semibold text-zinc-700">Footer Management</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 mt-1">
            Global Footer Management
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Manage footer columns, links, social platforms, legal disclaimers, and live publishing.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Locale Selector */}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-zinc-300 bg-white text-zinc-800"
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>

          {/* History Button */}
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 transition"
          >
            History ({versions.length})
          </button>

          {/* Save Draft */}
          {canEdit && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold rounded-xl border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
          )}

          {/* Publish Live */}
          {canPublish && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
            >
              {publishing ? "Publishing..." : "Publish Live"}
            </button>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-zinc-600">Status:</span>
          <span className={`px-2 py-0.5 rounded-full font-bold ${
            status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}>
            {status}
          </span>
          <span className="text-zinc-500">
            Draft: <strong className="text-zinc-800">#{versionNumber}</strong>
          </span>
          <span className="text-zinc-500">
            Live Revision: <strong className="text-zinc-800">{publishedVersionNumber ? `#${publishedVersionNumber}` : "None"}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 text-zinc-500">
          <span>Columns: <strong>{payload.columns.length}</strong></span>
          <span>·</span>
          <span>Links: <strong>{payload.columns.reduce((acc, c) => acc + (c.links?.length || 0), 0)}</strong></span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
          {success}
        </div>
      )}

      {/* Editor Tabs & Device Preview Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("columns")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
              activeTab === "columns"
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            Columns & Links ({payload.columns.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("social")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
              activeTab === "social"
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            Social Icons ({payload.socialLinks?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bottom")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
              activeTab === "bottom"
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            Bottom Legal Links ({payload.bottomLinks?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("appearance")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
              activeTab === "appearance"
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            Appearance & Notices
          </button>
        </div>

        {/* Live Preview Device Toggle */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setPreviewDevice("desktop")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
              previewDevice === "desktop" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            🖥 Desktop Preview
          </button>
          <button
            type="button"
            onClick={() => setPreviewDevice("mobile")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
              previewDevice === "mobile" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            📱 Mobile Preview
          </button>
        </div>
      </div>

      {/* Main Grid: Editor on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Editor Column */}
        <div className="xl:col-span-7 space-y-6">
          {/* TAB 1: COLUMNS & LINKS */}
          {activeTab === "columns" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                  Navigation Columns
                </h3>
                <button
                  type="button"
                  onClick={addColumn}
                  className="px-3 py-1.5 text-xs font-semibold bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition"
                >
                  + Add Column
                </button>
              </div>

              <div className="space-y-4">
                {payload.columns.map((col, colIdx) => (
                  <div
                    key={col.id || `col-${colIdx}`}
                    className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-bold text-zinc-400">#{colIdx + 1}</span>
                        <input
                          type="text"
                          value={col.title}
                          onChange={(e) => updateColumnTitle(colIdx, e.target.value)}
                          placeholder="Column Title (e.g. Support)"
                          className="px-2.5 py-1 text-sm font-bold text-zinc-900 border border-zinc-200 rounded-lg flex-1 max-w-xs focus:ring-1 focus:ring-zinc-900"
                        />
                        <button
                          type="button"
                          onClick={() => toggleColumnEnabled(colIdx)}
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold transition ${
                            col.enabled !== false ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {col.enabled !== false ? "Enabled" : "Disabled"}
                        </button>
                      </div>

                      <div className="flex items-center gap-1 text-xs">
                        <button
                          type="button"
                          disabled={colIdx === 0}
                          onClick={() => moveColumn(colIdx, "up")}
                          className="p-1 hover:bg-zinc-100 rounded text-zinc-600 disabled:opacity-30"
                          title="Move Left/Up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={colIdx === payload.columns.length - 1}
                          onClick={() => moveColumn(colIdx, "down")}
                          className="p-1 hover:bg-zinc-100 rounded text-zinc-600 disabled:opacity-30"
                          title="Move Right/Down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeColumn(colIdx)}
                          className="p-1 hover:bg-rose-50 text-rose-600 rounded ml-1"
                          title="Delete Column"
                        >
                          🗑
                        </button>
                      </div>
                    </div>

                    {/* Links List in Column */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          Links in this column ({col.links?.length || 0})
                        </span>
                        <button
                          type="button"
                          onClick={() => addLinkToColumn(colIdx)}
                          className="text-xs font-semibold text-zinc-900 hover:underline"
                        >
                          + Add Link
                        </button>
                      </div>

                      {(col.links || []).length === 0 ? (
                        <div className="p-3 text-center text-xs text-zinc-400 bg-zinc-50 rounded-xl">
                          No links yet. Click &quot;+ Add Link&quot; above.
                        </div>
                      ) : (
                        (col.links || []).map((link, linkIdx) => (
                          <div
                            key={link.id || `lnk-${linkIdx}`}
                            className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 text-xs"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Label */}
                              <input
                                type="text"
                                value={link.label}
                                onChange={(e) => updateLink(colIdx, linkIdx, { label: e.target.value })}
                                placeholder="Link Label"
                                className="px-2 py-1 text-xs font-medium border border-zinc-200 rounded-lg flex-1 min-w-[120px] bg-white"
                              />

                              {/* Static Page Quick Selector */}
                              <select
                                value={link.targetPageSlug || ""}
                                onChange={(e) => {
                                  const slug = e.target.value;
                                  if (slug) {
                                    updateLink(colIdx, linkIdx, {
                                      targetPageSlug: slug,
                                      href: `/${slug}`,
                                    });
                                  }
                                }}
                                className="px-2 py-1 text-xs border border-zinc-200 rounded-lg bg-white max-w-[150px]"
                              >
                                <option value="">Target Page...</option>
                                {APPROVED_STATIC_PAGES.map((p) => (
                                  <option key={p.slug} value={p.slug}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>

                              {/* URL */}
                              <input
                                type="text"
                                value={link.href}
                                onChange={(e) => updateLink(colIdx, linkIdx, { href: e.target.value, targetPageSlug: undefined })}
                                placeholder="Custom URL (/terms)"
                                className="px-2 py-1 text-xs font-medium border border-zinc-200 rounded-lg flex-1 min-w-[140px] bg-white"
                              />

                              {/* Badge */}
                              <input
                                type="text"
                                value={link.badge || ""}
                                onChange={(e) => updateLink(colIdx, linkIdx, { badge: e.target.value })}
                                placeholder="Badge (e.g. New)"
                                className="px-2 py-1 text-xs font-medium border border-zinc-200 rounded-lg w-24 bg-white"
                              />

                              {/* Actions */}
                              <div className="flex items-center gap-1">
                                <label className="inline-flex items-center gap-1 text-[11px] text-zinc-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={link.openInNewTab || false}
                                    onChange={(e) => updateLink(colIdx, linkIdx, { openInNewTab: e.target.checked })}
                                    className="rounded border-zinc-300 text-zinc-900"
                                  />
                                  New Tab
                                </label>
                                <button
                                  type="button"
                                  disabled={linkIdx === 0}
                                  onClick={() => moveLink(colIdx, linkIdx, "up")}
                                  className="p-1 hover:bg-zinc-200 rounded text-zinc-600 disabled:opacity-30"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={linkIdx === (col.links || []).length - 1}
                                  onClick={() => moveLink(colIdx, linkIdx, "down")}
                                  className="p-1 hover:bg-zinc-200 rounded text-zinc-600 disabled:opacity-30"
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeLinkFromColumn(colIdx, linkIdx)}
                                  className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                                >
                                  🗑
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: SOCIAL LINKS */}
          {activeTab === "social" && (
            <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                    Footer Social Channels
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Official social media icons displayed in the footer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSocialLink}
                  className="px-3 py-1.5 text-xs font-semibold bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition"
                >
                  + Add Social Icon
                </button>
              </div>

              <div className="space-y-3 pt-2">
                {(payload.socialLinks || []).map((social, idx) => (
                  <div key={social.id || idx} className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs">
                    <select
                      value={social.platform}
                      onChange={(e) => updateSocialLink(idx, { platform: e.target.value })}
                      className="px-2.5 py-1.5 border border-zinc-200 rounded-lg bg-white font-medium capitalize"
                    >
                      <option value="facebook">Facebook</option>
                      <option value="twitter">Twitter / X</option>
                      <option value="instagram">Instagram</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="youtube">YouTube</option>
                    </select>

                    <input
                      type="url"
                      value={social.url}
                      onChange={(e) => updateSocialLink(idx, { url: e.target.value })}
                      placeholder="https://..."
                      className="flex-1 px-2.5 py-1.5 border border-zinc-200 rounded-lg bg-white"
                    />

                    <label className="inline-flex items-center gap-1.5 text-zinc-600">
                      <input
                        type="checkbox"
                        checked={social.enabled !== false}
                        onChange={(e) => updateSocialLink(idx, { enabled: e.target.checked })}
                        className="rounded border-zinc-300 text-zinc-900"
                      />
                      Active
                    </label>

                    <button
                      type="button"
                      onClick={() => removeSocialLink(idx)}
                      className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: BOTTOM LEGAL LINKS */}
          {activeTab === "bottom" && (
            <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                    Bottom Copyright & Legal Links
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Rendered horizontally alongside copyright (e.g. Privacy, Terms, Cookies).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addBottomLink}
                  className="px-3 py-1.5 text-xs font-semibold bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition"
                >
                  + Add Legal Link
                </button>
              </div>

              <div className="space-y-3 pt-2">
                {(payload.bottomLinks || []).map((bLink, idx) => (
                  <div key={bLink.id || idx} className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs">
                    <input
                      type="text"
                      value={bLink.label}
                      onChange={(e) => updateBottomLink(idx, { label: e.target.value })}
                      placeholder="Label (e.g. Privacy)"
                      className="w-32 px-2.5 py-1.5 border border-zinc-200 rounded-lg bg-white font-medium"
                    />

                    <input
                      type="text"
                      value={bLink.href}
                      onChange={(e) => updateBottomLink(idx, { href: e.target.value })}
                      placeholder="URL (/privacy)"
                      className="flex-1 px-2.5 py-1.5 border border-zinc-200 rounded-lg bg-white"
                    />

                    <label className="inline-flex items-center gap-1.5 text-zinc-600">
                      <input
                        type="checkbox"
                        checked={bLink.enabled !== false}
                        onChange={(e) => updateBottomLink(idx, { enabled: e.target.checked })}
                        className="rounded border-zinc-300 text-zinc-900"
                      />
                      Active
                    </label>

                    <button
                      type="button"
                      onClick={() => removeBottomLink(idx)}
                      className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: APPEARANCE & NOTICES */}
          {activeTab === "appearance" && (
            <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-xs space-y-6">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                Appearance & Disclaimer Notices
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Copyright Notice
                  </label>
                  <input
                    type="text"
                    value={payload.copyrightNotice || ""}
                    onChange={(e) => setPayload({ ...payload, copyrightNotice: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                    placeholder="© 2026 Homyz, Inc. All rights reserved."
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Legal Notice / Regulatory Disclaimers (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={payload.legalNotice || ""}
                    onChange={(e) => setPayload({ ...payload, legalNotice: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm"
                    placeholder="Licensed under Saudi Ministry of Tourism. CR: 1010892341."
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1">
                      Background Color
                    </label>
                    <input
                      type="text"
                      value={payload.appearance?.backgroundColor || "#F3F4F5"}
                      onChange={(e) => setPayload({
                        ...payload,
                        appearance: { ...(payload.appearance || {}), backgroundColor: e.target.value },
                      })}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1">
                      Text Color
                    </label>
                    <input
                      type="text"
                      value={payload.appearance?.textColor || "#000000"}
                      onChange={(e) => setPayload({
                        ...payload,
                        appearance: { ...(payload.appearance || {}), textColor: e.target.value },
                      })}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1">
                      Border Color
                    </label>
                    <input
                      type="text"
                      value={payload.appearance?.borderColor || "rgba(31,31,31,0.9)"}
                      onChange={(e) => setPayload({
                        ...payload,
                        appearance: { ...(payload.appearance || {}), borderColor: e.target.value },
                      })}
                      className="w-full px-3 py-1.5 border border-zinc-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-3 border-t border-zinc-100">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={payload.showBackToTop !== false}
                      onChange={(e) => setPayload({ ...payload, showBackToTop: e.target.checked })}
                      className="rounded border-zinc-300 text-zinc-900"
                    />
                    <span className="font-semibold text-zinc-800">Show Floating Back-to-Top Button</span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={payload.showSocialIcons !== false}
                      onChange={(e) => setPayload({ ...payload, showSocialIcons: e.target.checked })}
                      className="rounded border-zinc-300 text-zinc-900"
                    />
                    <span className="font-semibold text-zinc-800">Show Social Channel Icons</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Interactive Preview Column */}
        <div className="xl:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Live Preview ({previewDevice.toUpperCase()})
            </h3>
            <span className="text-[11px] text-zinc-400">
              Matches public website rendering
            </span>
          </div>

          <div className={`mx-auto transition-all duration-300 ${
            previewDevice === "mobile" ? "max-w-[360px]" : "w-full"
          }`}>
            <div
              className="p-6 rounded-3xl border border-zinc-300 shadow-sm overflow-hidden"
              style={{
                backgroundColor: payload.appearance?.backgroundColor || "#F3F4F5",
                color: payload.appearance?.textColor || "#000000",
              }}
            >
              {/* Columns */}
              <div className={`grid gap-6 ${previewDevice === "mobile" ? "grid-cols-1" : "grid-cols-3"}`}>
                {payload.columns
                  .filter((c) => c.enabled !== false)
                  .map((col, idx) => (
                    <div key={col.id || idx} className="space-y-3">
                      <h4 className="text-sm font-bold text-zinc-900">
                        {col.title}
                      </h4>
                      <ul className="space-y-2">
                        {(col.links || [])
                          .filter((l) => l.enabled !== false)
                          .map((link) => (
                            <li key={link.id || link.href}>
                              <span className="text-xs text-zinc-800 underline underline-offset-2 hover:text-zinc-500 cursor-pointer inline-flex items-center gap-1">
                                {link.label}
                                {link.badge && (
                                  <span className="text-[9px] uppercase font-bold px-1 rounded bg-zinc-200">
                                    {link.badge}
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
              </div>

              {/* Social Channels in Preview */}
              {payload.showSocialIcons !== false && (payload.socialLinks || []).length > 0 && (
                <div className="mt-6 pt-4 border-t border-zinc-300 flex items-center gap-4 text-xs font-semibold text-zinc-700">
                  <span>Social:</span>
                  {(payload.socialLinks || []).filter((s) => s.enabled !== false).map((s) => (
                    <span key={s.id || s.platform} className="capitalize text-zinc-600 bg-white px-2 py-0.5 rounded border border-zinc-200">
                      {s.platform}
                    </span>
                  ))}
                </div>
              )}

              {/* Bottom Copyright & Links */}
              <div className="mt-6 pt-4 border-t border-zinc-300 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600">
                <span>{payload.copyrightNotice || "© 2026 Homyz, Inc."}</span>
                {(payload.bottomLinks || [])
                  .filter((b) => b.enabled !== false)
                  .map((b) => (
                    <React.Fragment key={b.id || b.href}>
                      <span>·</span>
                      <span className="hover:underline cursor-pointer">{b.label}</span>
                    </React.Fragment>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revision History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-900">
                Footer Revision History
              </h3>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="text-zinc-400 hover:text-zinc-700 text-lg leading-none font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {versions.length === 0 ? (
                <div className="py-8 text-center text-zinc-400 text-xs">
                  No revisions found.
                </div>
              ) : (
                versions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-200 bg-zinc-50 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-zinc-900 text-sm">Revision #{v.versionNumber}</strong>
                        {v.isPublished && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px]">
                            Live
                          </span>
                        )}
                        {v.isDraft && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full text-[10px]">
                            Draft
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-500 mt-1">
                        {v.changeSummary || "No description"} · {new Date(v.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {canRollback && !v.isPublished && (
                      <button
                        type="button"
                        onClick={() => handleRollback(v.id)}
                        className="px-3 py-1 bg-zinc-900 text-white rounded-xl font-semibold hover:bg-zinc-800 transition"
                      >
                        Rollback
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

