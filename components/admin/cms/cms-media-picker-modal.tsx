"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useSession } from "next-auth/react";
import { PERMISSIONS, hasPermission } from "@/lib/permissions/permissions";

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
  createdAt: string;
}

interface CmsMediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: { url: string; altText?: string; title?: string }) => void;
  currentUrl?: string;
  title?: string;
}

export function CmsMediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  currentUrl,
  title = "Select Image from Media Library",
}: CmsMediaPickerModalProps) {
  const { data: session } = useSession();
  const user = session?.user;
  const canUpload = hasPermission(user, PERMISSIONS.CMS_MEDIA_UPLOAD);

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set());

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "18",
      });
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/v1/admin/cms/media?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setAssets(data.items || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.warn("Failed to fetch media assets", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (isOpen) {
      fetchAssets();
    }
  }, [isOpen, fetchAssets]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^/.]+$/, ""));

      const res = await fetch("/api/v1/admin/cms/media", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || errJson.error || "Failed to upload image");
      }

      const json = await res.json();
      const uploaded = json.data || json;

      await fetchAssets();
      setSelectedAsset(uploaded);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmSelect = () => {
    if (selectedAsset) {
      onSelect({
        url: selectedAsset.url,
        altText: selectedAsset.altText || selectedAsset.title || undefined,
        title: selectedAsset.title || undefined,
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h3 className="text-base font-bold text-zinc-900">{title}</h3>
            <p className="text-xs text-zinc-500">
              Choose an existing asset from the library or upload a new photo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-3 bg-zinc-50 border-b border-zinc-100 text-xs">
          <input
            type="text"
            placeholder="Search by filename or title..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 w-full sm:w-64"
          />

          <div className="flex items-center gap-2">
            {canUpload && (
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white rounded-xl font-semibold cursor-pointer hover:bg-zinc-800 transition">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {uploading ? "Uploading..." : "Upload New Photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  disabled={uploading}
                  onChange={handleUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {uploadError && (
          <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
            {uploadError}
          </div>
        )}

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16 text-center text-zinc-400 text-xs">
              Loading media assets...
            </div>
          ) : assets.length === 0 ? (
            <div className="py-16 text-center text-zinc-400 text-xs space-y-2">
              <p>No media assets found in library.</p>
              {canUpload && (
                <p className="text-[11px] text-zinc-500">
                  Use the "Upload New Photo" button above to add assets.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {assets.map((asset) => {
                const isSelected = selectedAsset?.id === asset.id || currentUrl === asset.url;
                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition ${
                      isSelected
                        ? "border-emerald-600 ring-2 ring-emerald-500/20"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    {!brokenImageIds.has(asset.id) ? (
                      <img
                        src={asset.url}
                        alt={asset.altText || asset.title || "Media"}
                        loading="lazy"
                        onError={() => setBrokenImageIds((prev) => new Set(prev).add(asset.id))}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-zinc-400 p-2 text-center h-full bg-zinc-100">
                        <span className="text-[10px] font-semibold">Missing</span>
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-emerald-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-xs">
                        ✓
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 text-[10px] text-white truncate">
                      {asset.title || asset.originalFilename}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-100 bg-zinc-50 text-xs">
          <div className="text-zinc-500 truncate max-w-sm">
            {selectedAsset ? (
              <span>
                Selected: <strong className="text-zinc-800">{selectedAsset.title || selectedAsset.originalFilename}</strong> ({selectedAsset.mimeType.split("/")[1]?.toUpperCase()})
              </span>
            ) : (
              <span>Click any image to select it</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-zinc-200 text-zinc-600 rounded-xl font-semibold hover:bg-zinc-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedAsset}
              onClick={handleConfirmSelect}
              className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-40 transition"
            >
              Insert Selected Image
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}

