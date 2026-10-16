"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PERMISSIONS, hasPermission } from "@/lib/permissions/permissions";
import { ModalOverlay } from "@/components/ui/modal-overlay";

interface MediaAsset {
  id: string;
  key: string;
  url: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  title: string | null;
  altText: string | null;
  status: string;
  metadata?: any;
  createdAt: string;
  uploader?: { id: string; name: string | null; email: string | null };
  _count?: { references: number };
}

interface MediaUsageItem {
  contentId: string;
  contentTitle: string;
  contentType: string;
  versionId: string;
  versionNumber: number;
  isLivePublished: boolean;
  isCurrentDraft: boolean;
  isHistorical: boolean;
  isScheduled: boolean;
  locale: string;
}

interface MediaUsageSummary {
  assetId: string;
  originalFilename: string;
  url: string;
  totalReferences: number;
  livePublishedCount: number;
  currentDraftCount: number;
  historicalCount: number;
  scheduledCount: number;
  canPermanentlyDelete: boolean;
  canArchive: boolean;
  references: MediaUsageItem[];
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export default function CmsMediaLibraryPage() {
  const { data: session } = useSession();
  const user = session?.user;

  // Permissions
  const canUpload = hasPermission(user, PERMISSIONS.CMS_MEDIA_UPLOAD);
  const canDelete = hasPermission(user, PERMISSIONS.CMS_MEDIA_DELETE);
  const canEdit = hasPermission(user, PERMISSIONS.CMS_MEDIA_UPLOAD);

  // Listing State
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Selection & Bulk State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Uploading State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Fallback for broken images
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set());

  // Three-dot Dropdown State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [viewAsset, setViewAsset] = useState<MediaAsset | null>(null);
  const [editAsset, setEditAsset] = useState<MediaAsset | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAltText, setEditAltText] = useState("");
  const [editAltTexts, setEditAltTexts] = useState<Record<string, string>>({
    ar: "",
    es: "",
    fr: "",
    de: "",
    hi: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Usage Modal
  const [usageAsset, setUsageAsset] = useState<MediaAsset | null>(null);
  const [usageData, setUsageData] = useState<MediaUsageSummary | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Replace Modal
  const [replaceAsset, setReplaceAsset] = useState<MediaAsset | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacePreviewUrl, setReplacePreviewUrl] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  // Delete Modal
  const [deleteAsset, setDeleteAsset] = useState<MediaAsset | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<MediaUsageSummary | null>(null);
  const [checkingDeleteUsage, setCheckingDeleteUsage] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Bulk Delete Modal
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);

  // Fetch Media Assets
  const fetchMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "24",
      });
      if (search.trim()) params.set("search", search.trim());
      if (formatFilter !== "all") params.set("mimeType", formatFilter);

      const res = await fetch(`/api/v1/admin/cms/media?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load media assets");
      const json = await res.json();
      const data = json.data || json;
      setAssets(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      setError(err.message || "Failed to fetch media assets");
    } finally {
      setLoading(false);
    }
  }, [page, search, formatFilter]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Close three-dot menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".media-menu-container")) {
        setActiveMenuId(null);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(`Uploading "${file.name}"...`);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name.replace(/\.[^/.]+$/, ""));

    try {
      const res = await fetch("/api/v1/admin/cms/media", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || errJson.error || "Upload failed");
      }

      setSuccess(`Uploaded "${file.name}" successfully!`);
      await fetchMedia();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
      e.target.value = "";
    }
  };

  // Copy URL with clipboard feedback
  const handleCopyUrl = async (url: string, id: string) => {
    try {
      const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("Failed to copy URL to clipboard");
    }
  };

  // Open Edit Details Modal
  const openEditModal = (asset: MediaAsset) => {
    setEditAsset(asset);
    setEditTitle(asset.title || asset.originalFilename);
    setEditAltText(asset.altText || "");
    const existingAlts = asset.metadata?.altTexts || {};
    setEditAltTexts({
      ar: existingAlts.ar || "",
      es: existingAlts.es || "",
      fr: existingAlts.fr || "",
      de: existingAlts.de || "",
      hi: existingAlts.hi || "",
    });
    setActiveMenuId(null);
  };

  // Save Edit Details
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAsset) return;

    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/cms/media/${editAsset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          altText: editAltText.trim(),
          altTexts: editAltTexts,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.error || "Failed to update metadata");
      }

      setSuccess(`Updated metadata for "${editAsset.originalFilename}"`);
      setEditAsset(null);
      await fetchMedia();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Open Usage Modal
  const openUsageModal = async (asset: MediaAsset) => {
    setUsageAsset(asset);
    setLoadingUsage(true);
    setActiveMenuId(null);
    try {
      const res = await fetch(`/api/v1/admin/cms/media/${asset.id}`);
      if (res.ok) {
        const json = await res.json();
        setUsageData(json.data?.usage || null);
      }
    } catch (err) {
      console.warn("Failed to fetch usage:", err);
    } finally {
      setLoadingUsage(false);
    }
  };

  // Open Replace Modal
  const openReplaceModal = (asset: MediaAsset) => {
    setReplaceAsset(asset);
    setReplaceFile(null);
    setReplacePreviewUrl(null);
    setActiveMenuId(null);
  };

  // Execute Replace Image
  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceAsset || !replaceFile) return;

    setReplacing(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", replaceFile);

    try {
      const res = await fetch(`/api/v1/admin/cms/media/${replaceAsset.id}/replace`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || err.error || "Replacement failed");
      }

      setSuccess(`Replaced file for "${replaceAsset.originalFilename}" successfully!`);
      setReplaceAsset(null);
      setReplaceFile(null);
      await fetchMedia();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setReplacing(false);
    }
  };

  // Open Delete Confirmation Modal with Usage Check
  const openDeleteModal = async (asset: MediaAsset) => {
    setDeleteAsset(asset);
    setDeleteUsage(null);
    setCheckingDeleteUsage(true);
    setActiveMenuId(null);

    try {
      const res = await fetch(`/api/v1/admin/cms/media/${asset.id}`);
      if (res.ok) {
        const json = await res.json();
        setDeleteUsage(json.data?.usage || null);
      }
    } catch (err) {
      console.warn("Failed to check delete usage:", err);
    } finally {
      setCheckingDeleteUsage(false);
    }
  };

  // Confirm Single Delete
  const handleConfirmDelete = async (forceArchive = false) => {
    if (!deleteAsset) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/cms/media/${deleteAsset.id}?forceArchive=${forceArchive}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || errJson.error || "Delete failed");
      }

      setSuccess(
        forceArchive
          ? `Archived "${deleteAsset.originalFilename}" to protect revision history.`
          : `Permanently deleted "${deleteAsset.originalFilename}".`
      );

      // Remove from selection if selected
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteAsset.id);
        return next;
      });

      setDeleteAsset(null);
      await fetchMedia();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Bulk Selection Toggle
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select / Deselect All on current page
  const handleSelectAll = () => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map((a) => a.id)));
    }
  };

  // Confirm Bulk Delete
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setBulkDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/cms/media/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || errJson.error || "Bulk delete failed");
      }

      const json = await res.json();
      const result = json.data || json;
      setBulkResult(result);

      if (result.deleted?.length > 0) {
        setSuccess(`Deleted ${result.deleted.length} unreferenced asset(s).`);
      }
      if (result.blocked?.length > 0) {
        setError(`${result.blocked.length} asset(s) were protected from deletion because they are actively in use.`);
      }

      setSelectedIds(new Set());
      await fetchMedia();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              CMS Media Library
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              {total} assets
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Manage photography, marketing graphics, and responsive banners across the Homyz platform.
          </p>
        </div>

        {canUpload && (
          <div>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs sm:text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition cursor-pointer shadow-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>{uploading ? "Uploading..." : "Upload New Image"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                disabled={uploading}
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-300 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-between shadow-2xs">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-between shadow-2xs">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess(null)} className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {uploadProgress && (
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-zinc-900 dark:border-zinc-100 border-t-transparent rounded-full animate-spin" />
          <span>{uploadProgress}</span>
        </div>
      )}

      {/* Top Controls & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <svg className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search filename, title, or alt text..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 pr-3.5 py-2 text-xs sm:text-sm border border-zinc-200 dark:border-zinc-700 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-800 transition"
          />
        </div>

        {/* MIME Type Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 text-xs">
          {[
            { id: "all", label: "All Formats" },
            { id: "image/jpeg", label: "JPEG" },
            { id: "image/png", label: "PNG" },
            { id: "image/webp", label: "WebP" },
            { id: "image/avif", label: "AVIF" },
          ].map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => {
                setFormatFilter(fmt.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition ${
                formatFilter === fmt.id
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xs"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {fmt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-zinc-900 text-white p-3 rounded-2xl shadow-md text-xs sm:text-sm transition animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="font-bold">{selectedIds.size} asset(s) selected</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-zinc-400 hover:text-white underline text-xs"
            >
              Deselect All
            </button>
          </div>

          <div className="flex items-center gap-2">
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  setBulkResult(null);
                  setShowBulkDeleteModal(true);
                }}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition shadow-xs flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}

      {/* Media Grid Canvas */}
      <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        {/* Selection / Count bar */}
        <div className="flex items-center justify-between text-xs text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-zinc-800 dark:hover:text-zinc-200">
            <input
              type="checkbox"
              checked={assets.length > 0 && selectedIds.size === assets.length}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded text-zinc-900 border-zinc-300 dark:border-zinc-700 focus:ring-zinc-900"
            />
            <span>Select All on Page ({assets.length})</span>
          </label>

          <span>
            Showing Page {page} of {totalPages} ({total} total assets)
          </span>
        </div>

        {/* Content State */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col bg-white dark:bg-zinc-900 shadow-2xs"
              >
                <div className="relative aspect-square w-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer">
                  <div className="absolute top-2 left-2 size-5 rounded-md bg-white/50 dark:bg-zinc-700/50" />
                  <div className="absolute top-2 right-2 h-4 w-12 rounded-md bg-white/50 dark:bg-zinc-700/50" />
                </div>
                <div className="p-3 text-xs flex flex-col justify-between flex-1 gap-2 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                    <div className="h-2.5 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-zinc-700">No media assets found</p>
            <p className="text-xs text-zinc-400">
              {search || formatFilter !== "all"
                ? "Try adjusting your search query or format filters."
                : "Upload photography or banner graphics using the button above."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {assets.map((asset) => {
              const isSelected = selectedIds.has(asset.id);
              const isBroken = brokenImageIds.has(asset.id);
              const isReferenced = (asset._count?.references ?? 0) > 0;
              const formatTag = asset.mimeType.split("/")[1]?.toUpperCase() || "IMG";

              return (
                <div
                  key={asset.id}
                  className={`group relative border rounded-2xl overflow-hidden transition flex flex-col bg-white dark:bg-zinc-900 ${
                    isSelected
                      ? "border-zinc-900 dark:border-zinc-100 ring-2 ring-zinc-900/10 dark:ring-zinc-100/10 shadow-xs"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs"
                  }`}
                >
                  {/* Thumbnail Container */}
                  <div
                    onClick={() => setViewAsset(asset)}
                    className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden cursor-pointer flex items-center justify-center"
                  >
                    {!isBroken ? (
                      <img
                        src={asset.url}
                        alt={asset.altText || asset.title || asset.originalFilename}
                        loading="lazy"
                        onError={() => {
                          setBrokenImageIds((prev) => new Set(prev).add(asset.id));
                        }}
                        className="object-cover w-full h-full group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 p-2 text-center space-y-1">
                        <svg className="w-8 h-8 opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">Image Missing</span>
                      </div>
                    )}

                    {/* Checkbox (top-left) */}
                    <div
                      onClick={(e) => toggleSelect(asset.id, e)}
                      className="absolute top-2 left-2 z-10 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-xs p-1 rounded-md shadow-2xs hover:bg-white dark:hover:bg-zinc-700 transition"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-3.5 h-3.5 rounded text-zinc-900 border-zinc-300 dark:border-zinc-700 focus:ring-zinc-900 cursor-pointer"
                      />
                    </div>

                    {/* Usage Tag (top-right) */}
                    <div className="absolute top-2 right-2 z-10">
                      {isReferenced ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openUsageModal(asset);
                          }}
                          className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-blue-600/90 text-white backdrop-blur-xs hover:bg-blue-700 transition shadow-2xs"
                        >
                          {asset._count?.references} in use
                        </button>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-600/90 text-white backdrop-blur-xs shadow-2xs">
                          Unused
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Info & Three-Dot Menu */}
                  <div className="p-3 text-xs flex flex-col justify-between flex-1 gap-1.5 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-start justify-between gap-1">
                      <div className="truncate flex-1">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={asset.title || asset.originalFilename}>
                          {asset.title || asset.originalFilename}
                        </p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                          {formatTag} • {formatBytes(asset.size)}
                        </p>
                      </div>

                      {/* Three-Dot Dropdown */}
                      <div className="relative media-menu-container">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === asset.id ? null : asset.id);
                          }}
                          className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                          aria-label="Media actions"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>

                        {activeMenuId === asset.id && (
                          <div className="absolute right-0 bottom-full mb-1 z-30 w-44 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 py-1 text-xs divide-y divide-zinc-100 dark:divide-zinc-800">
                            <div className="py-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setViewAsset(asset);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-3 py-1.5 text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                              >
                                <span>👁️</span> View Image
                              </button>

                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(asset)}
                                  className="w-full px-3 py-1.5 text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                                >
                                  <span>✏️</span> Edit Details
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleCopyUrl(asset.url, asset.id)}
                                className="w-full px-3 py-1.5 text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                              >
                                <span>📋</span> {copiedId === asset.id ? "Copied!" : "Copy Image URL"}
                              </button>

                              <button
                                type="button"
                                onClick={() => openUsageModal(asset)}
                                className="w-full px-3 py-1.5 text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                              >
                                <span>🔗</span> View Usage ({asset._count?.references ?? 0})
                              </button>
                            </div>

                            <div className="py-0.5">
                              {canUpload && (
                                <button
                                  type="button"
                                  onClick={() => openReplaceModal(asset)}
                                  className="w-full px-3 py-1.5 text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                                >
                                  <span>🔄</span> Replace Image
                                </button>
                              )}

                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => openDeleteModal(asset)}
                                  className="w-full px-3 py-1.5 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium flex items-center gap-2"
                                >
                                  <span>🗑️</span> Delete Image
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-4 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition"
            >
              Previous Page
            </button>

            <span>
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition"
            >
              Next Page
            </button>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: VIEW FULL IMAGE LIGHTBOX */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: VIEW FULL-SIZE IMAGE PREVIEW & METRICS */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {viewAsset && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="truncate mr-4">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {viewAsset.title || viewAsset.originalFilename}
                </h3>
                <p className="text-xs text-zinc-400 font-mono">
                  {viewAsset.mimeType} • {formatBytes(viewAsset.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewAsset(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 bg-zinc-900 dark:bg-zinc-950 flex items-center justify-center overflow-auto max-h-[60vh]">
              <img
                src={viewAsset.url}
                alt={viewAsset.altText || viewAsset.title || "Full Media"}
                className="max-h-[55vh] max-w-full object-contain rounded-lg"
              />
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-md">
                Path: {viewAsset.url}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyUrl(viewAsset.url, viewAsset.id)}
                  className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-700 transition shadow-2xs"
                >
                  {copiedId === viewAsset.id ? "Copied!" : "Copy URL"}
                </button>
                <a
                  href={viewAsset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition shadow-xs"
                >
                  Open in New Tab
                </a>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: EDIT METADATA & MULTILINGUAL ALT TEXT */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {editAsset && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Edit Media Details</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Update image title and accessibility alt texts</p>
              </div>
              <button
                type="button"
                onClick={() => setEditAsset(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Primary Alt Text (English)
                </label>
                <textarea
                  rows={2}
                  value={editAltText}
                  onChange={(e) => setEditAltText(e.target.value)}
                  placeholder="Describe image for screen readers and SEO..."
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 outline-none"
                />
              </div>

              {/* Multilingual Alt Texts */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 block">
                  Multilingual Alt Texts (Optional)
                </span>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-0.5">
                      العربية (Arabic - RTL)
                    </label>
                    <input
                      type="text"
                      dir="rtl"
                      value={editAltTexts.ar || ""}
                      onChange={(e) => setEditAltTexts({ ...editAltTexts, ar: e.target.value })}
                      placeholder="وصف الصورة بالعربية..."
                      className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-0.5">Español (Spanish)</label>
                    <input
                      type="text"
                      value={editAltTexts.es || ""}
                      onChange={(e) => setEditAltTexts({ ...editAltTexts, es: e.target.value })}
                      placeholder="Descripción de la imagen en español..."
                      className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditAsset(null)}
                  className="px-3.5 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition shadow-xs"
                >
                  {savingEdit ? "Saving..." : "Save Details"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: VIEW USAGE DETAILS */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {usageAsset && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Media Usage Analysis</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Referencing CMS items for "{usageAsset.originalFilename}"
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUsageAsset(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg p-1"
              >
                ✕
              </button>
            </div>

            {loadingUsage ? (
              <div className="py-12 text-center text-zinc-400 text-xs">
                Scanning CMS revisions and publications...
              </div>
            ) : !usageData || usageData.totalReferences === 0 ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  No Active References Found
                </div>
                <p>This image is not currently referenced in any CMS content, banners, or pages. It is safe to delete.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                    <span className="block text-lg font-bold text-zinc-900 dark:text-zinc-100">{usageData.livePublishedCount}</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Live Published</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                    <span className="block text-lg font-bold text-zinc-900 dark:text-zinc-100">{usageData.currentDraftCount}</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Current Drafts</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                    <span className="block text-lg font-bold text-zinc-900 dark:text-zinc-100">{usageData.historicalCount}</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Historical</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">Referencing Items</span>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {usageData.references.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-800/40 hover:bg-white dark:hover:bg-zinc-800 text-xs transition"
                      >
                        <div className="truncate mr-2">
                          <Link
                            href={`/admin/cms/${item.contentId}`}
                            className="font-bold text-zinc-900 dark:text-zinc-100 hover:underline truncate block"
                          >
                            {item.contentTitle}
                          </Link>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {item.contentType} • Rev #{item.versionNumber} ({item.locale.toUpperCase()})
                          </span>
                        </div>

                        <div className="shrink-0">
                          {item.isLivePublished && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-800/50">
                              LIVE STOREFRONT
                            </span>
                          )}
                          {item.isCurrentDraft && !item.isLivePublished && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-transparent dark:border-amber-800/50">
                              ACTIVE DRAFT
                            </span>
                          )}
                          {item.isHistorical && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                              HISTORICAL REV
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setUsageAsset(null)}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 4: REPLACE MEDIA ASSET */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {replaceAsset && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Replace Media Asset</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Swaps the image file while preserving all existing CMS references
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplaceAsset(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReplaceSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 rounded-xl space-y-1">
                <span className="font-bold block">Important Notice</span>
                <p>
                  Replacing this asset will safely update its imagery without breaking references across live banners or revisions.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700">
                  <img
                    src={replacePreviewUrl || replaceAsset.url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1">
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Select Replacement Image
                  </label>
                  <input
                    type="file"
                    required
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setReplaceFile(f);
                        setReplacePreviewUrl(URL.createObjectURL(f));
                      }
                    }}
                    className="text-xs text-zinc-600 dark:text-zinc-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-900 dark:file:bg-zinc-100 file:text-white dark:file:text-zinc-900 hover:file:bg-zinc-800 dark:hover:file:bg-zinc-200 cursor-pointer"
                  />
                  {replaceFile && (
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                      New: {replaceFile.name} ({formatBytes(replaceFile.size)})
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setReplaceAsset(null)}
                  className="px-3.5 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!replaceFile || replacing}
                  className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition shadow-xs"
                >
                  {replacing ? "Replacing..." : "Confirm Replacement"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 5: DELETE CONFIRMATION & SAFETY GUARD */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {deleteAsset && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Delete Media Asset</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{deleteAsset.originalFilename}</p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteAsset(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg p-1"
              >
                ✕
              </button>
            </div>

            {checkingDeleteUsage ? (
              <div className="py-8 text-center text-xs text-zinc-400">
                Verifying CMS references and safety guardrails...
              </div>
            ) : deleteUsage && (deleteUsage.livePublishedCount > 0 || deleteUsage.currentDraftCount > 0 || deleteUsage.scheduledCount > 0) ? (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-300 rounded-2xl text-xs space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                  Deletion Blocked: Asset in Active Use
                </div>
                <p>
                  This image is currently used by{" "}
                  <strong>
                    {deleteUsage.livePublishedCount + deleteUsage.currentDraftCount + deleteUsage.scheduledCount}
                  </strong>{" "}
                  active CMS item(s).
                </p>
                <div className="space-y-1 bg-white/60 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800/40 max-h-32 overflow-y-auto text-zinc-800 dark:text-zinc-200">
                  {deleteUsage.references
                    .filter((r) => r.isLivePublished || r.isCurrentDraft || r.isScheduled)
                    .map((r, i) => (
                      <div key={i} className="truncate text-[11px]">
                        • <strong>{r.contentTitle}</strong> ({r.isLivePublished ? "LIVE STOREFRONT" : "ACTIVE DRAFT"})
                      </div>
                    ))}
                </div>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 italic">
                  Replace or remove these references in the CMS editor before deleting this file.
                </p>
              </div>
            ) : deleteUsage && deleteUsage.historicalCount > 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 rounded-2xl text-xs space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Protected: Referenced by Historical Revisions
                </div>
                <p>
                  This image is referenced by{" "}
                  <strong>{deleteUsage.historicalCount}</strong> older historical revision(s).
                  Permanently deleting the physical file would break snapshot previews and rollback history.
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  You can archive this image to remove it from the active library while preserving historical previews.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Safe to Delete
                </div>
                <p>
                  This image has <strong>0 references</strong> across live content, drafts, and history. It is safe to permanently delete from both the database and cloud storage.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setDeleteAsset(null)}
                className="px-3.5 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>

              {deleteUsage && deleteUsage.historicalCount > 0 && deleteUsage.livePublishedCount === 0 && deleteUsage.currentDraftCount === 0 && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => handleConfirmDelete(true)}
                  className="px-4 py-2 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition shadow-xs"
                >
                  {deleting ? "Archiving..." : "Archive from Library"}
                </button>
              )}

              {deleteUsage && deleteUsage.canPermanentlyDelete && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => handleConfirmDelete(false)}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition shadow-xs"
                >
                  {deleting ? "Deleting..." : "Permanently Delete"}
                </button>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 6: BULK DELETE CONFIRMATION */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {showBulkDeleteModal && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Bulk Delete Management</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {selectedIds.size} assets queued for deletion
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs space-y-1 text-zinc-700 dark:text-zinc-300">
              <span className="font-bold block text-zinc-900 dark:text-zinc-100">Safety Guardrail Notice</span>
              <p>
                Each selected asset will be analyzed. Any asset actively in use by live published or draft CMS content will be automatically protected and skipped. Only completely unreferenced files will be permanently deleted.
              </p>
            </div>

            {bulkResult && (
              <div className="space-y-2 text-xs">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 block">Operation Results</span>
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl space-y-1 text-zinc-800 dark:text-zinc-200">
                  <div>✅ Deleted: {bulkResult.deleted?.length ?? 0} unreferenced asset(s)</div>
                  <div>🛡️ Protected from deletion: {bulkResult.blocked?.length ?? 0} in-use asset(s)</div>
                  {bulkResult.failed?.length > 0 && (
                    <div className="text-rose-600 dark:text-rose-400">❌ Failed: {bulkResult.failed.length} asset(s)</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-3.5 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                {bulkResult ? "Done" : "Cancel"}
              </button>

              {!bulkResult && (
                <button
                  type="button"
                  disabled={bulkDeleting}
                  onClick={handleConfirmBulkDelete}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 disabled:opacity-50 transition shadow-xs"
                >
                  {bulkDeleting ? "Processing..." : `Confirm Delete (${selectedIds.size})`}
                </button>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
