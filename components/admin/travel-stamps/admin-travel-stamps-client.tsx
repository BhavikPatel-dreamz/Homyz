"use client";

import React, { useState, useTransition, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { AdminTravelStampDTO } from "@/types/travel";
import {
  createAdminTravelStampAction,
  updateAdminTravelStampAction,
  toggleAdminTravelStampActiveAction,
  archiveAdminTravelStampAction,
  deleteAdminTravelStampAction,
} from "@/actions/admin/travelStamps";
import { toast } from "@/components/ui/toast";

interface AdminTravelStampsClientProps {
  initialStamps: AdminTravelStampDTO[];
}

interface StampFormData {
  id?: string;
  displayName: string;
  title: string;
  city: string;
  country: string;
  countryCode: string;
  category: string;
  description: string;
  iconUrl: string;
  displayOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: StampFormData = {
  displayName: "",
  title: "",
  city: "",
  country: "",
  countryCode: "",
  category: "CITY",
  description: "",
  iconUrl: "",
  displayOrder: 0,
  isActive: true,
};

export function AdminTravelStampsClient({ initialStamps }: AdminTravelStampsClientProps) {
  const router = useRouter();
  const [stamps, setStamps] = useState<AdminTravelStampDTO[]>(initialStamps);
  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<StampFormData>(EMPTY_FORM);
  const [isUploading, setIsUploading] = useState(false);
  const [previewStamp, setPreviewStamp] = useState<AdminTravelStampDTO | null>(null);

  // Derive unique countries for filter
  const countries = useMemo(() => {
    const set = new Set<string>();
    stamps.forEach((s) => {
      if (s.country) set.add(s.country);
    });
    return Array.from(set).sort();
  }, [stamps]);

  // Filtered stamps
  const filteredStamps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stamps.filter((s) => {
      if (selectedStatus === "ACTIVE" && !s.isActive) return false;
      if (selectedStatus === "INACTIVE" && s.isActive) return false;
      if (selectedCountry !== "all" && s.country?.toLowerCase() !== selectedCountry.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      return (
        s.displayName.toLowerCase().includes(q) ||
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.country && s.country.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        s.slug.toLowerCase().includes(q)
      );
    });
  }, [stamps, search, selectedCountry, selectedStatus]);

  const stats = useMemo(() => {
    const total = stamps.length;
    const active = stamps.filter((s) => s.isActive).length;
    const inactive = total - active;
    const totalCollected = stamps.reduce((acc, curr) => acc + (curr.collectorCount || 0), 0);
    return { total, active, inactive, totalCollected };
  }, [stamps]);

  const handleOpenCreate = () => {
    setFormData({
      ...EMPTY_FORM,
      displayOrder: stamps.length + 1,
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (stamp: AdminTravelStampDTO) => {
    setFormData({
      id: stamp.id,
      displayName: stamp.displayName,
      title: stamp.title || stamp.displayName,
      city: stamp.city || "",
      country: stamp.country || "",
      countryCode: stamp.countryCode || "",
      category: stamp.category,
      description: stamp.description || "",
      iconUrl: stamp.iconUrl || stamp.imageUrl || "",
      displayOrder: stamp.displayOrder,
      isActive: stamp.isActive,
    });
    setIsFormOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpeg|jpg|webp|svg\+xml)$/)) {
      toast.error("Please upload a valid PNG, JPG, WebP, or SVG file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must not exceed 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);

      const res = await fetch("/api/v1/admin/travel-stamps/upload", {
        method: "POST",
        body: data,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to upload image");
      }

      setFormData((prev) => ({
        ...prev,
        iconUrl: json.url,
      }));
      toast.success("Stamp artwork uploaded successfully!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error uploading file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName.trim()) {
      toast.error("Stamp name is required.");
      return;
    }
    if (!formData.iconUrl.trim()) {
      toast.error("Stamp design artwork is required. Please upload an image.");
      return;
    }

    startTransition(async () => {
      try {
        if (formData.id) {
          const updated = await updateAdminTravelStampAction(formData.id, {
            displayName: formData.displayName,
            title: formData.title || formData.displayName,
            city: formData.city || null,
            country: formData.country || null,
            countryCode: formData.countryCode || null,
            category: formData.category,
            description: formData.description || null,
            iconUrl: formData.iconUrl,
            displayOrder: Number(formData.displayOrder) || 0,
            isActive: formData.isActive,
          });

          setStamps((prev) =>
            prev.map((s) =>
              s.id === updated.id
                ? {
                    ...s,
                    displayName: updated.displayName,
                    title: updated.title,
                    city: updated.city,
                    country: updated.country,
                    countryCode: updated.countryCode,
                    category: updated.category,
                    description: updated.description,
                    iconUrl: updated.iconUrl,
                    displayOrder: updated.displayOrder ?? s.displayOrder,
                    isActive: updated.isActive ?? s.isActive,
                  }
                : s
            )
          );
          toast.success("Travel stamp updated successfully!");
        } else {
          const created = await createAdminTravelStampAction({
            displayName: formData.displayName,
            title: formData.title || formData.displayName,
            city: formData.city || null,
            country: formData.country || null,
            countryCode: formData.countryCode || null,
            category: formData.category,
            description: formData.description || null,
            iconUrl: formData.iconUrl,
            displayOrder: Number(formData.displayOrder) || 0,
            isActive: formData.isActive,
          });

          setStamps((prev) => [
            ...prev,
            {
              id: created.id,
              slug: created.slug,
              displayName: created.displayName,
              title: created.title,
              city: created.city,
              country: created.country,
              countryCode: created.countryCode,
              description: created.description,
              iconUrl: created.iconUrl,
              imageUrl: created.iconUrl,
              category: created.category,
              isActive: created.isActive ?? true,
              displayOrder: created.displayOrder ?? 0,
              collectorCount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]);
          toast.success("Travel stamp created successfully!");
        }
        setIsFormOpen(false);
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to save stamp");
      }
    });
  };

  const handleToggleActive = async (stamp: AdminTravelStampDTO) => {
    startTransition(async () => {
      try {
        const updated = await toggleAdminTravelStampActiveAction(stamp.id);
        setStamps((prev) =>
          prev.map((s) => (s.id === stamp.id ? { ...s, isActive: updated.isActive ?? !s.isActive } : s))
        );
        toast.success(
          `Stamp ${updated.isActive ? "activated" : "deactivated"} successfully!`
        );
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to toggle status");
      }
    });
  };

  const handleArchive = async (stamp: AdminTravelStampDTO) => {
    if (!window.confirm(`Are you sure you want to archive "${stamp.displayName}"? Active guests who collected this stamp will keep it in their passport, but new guests won't be able to select it.`)) {
      return;
    }

    startTransition(async () => {
      try {
        await archiveAdminTravelStampAction(stamp.id);
        setStamps((prev) =>
          prev.map((s) => (s.id === stamp.id ? { ...s, isActive: false } : s))
        );
        toast.success(`"${stamp.displayName}" archived.`);
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to archive stamp");
      }
    });
  };

  const handleDelete = async (stamp: AdminTravelStampDTO) => {
    const msg = stamp.collectorCount > 0
      ? `"${stamp.displayName}" has already been collected by ${stamp.collectorCount} traveler(s). Deleting will safely archive it so existing guest passports are not corrupted. Proceed?`
      : `Are you sure you want to permanently delete "${stamp.displayName}"?`;

    if (!window.confirm(msg)) return;

    startTransition(async () => {
      try {
        const result = await deleteAdminTravelStampAction(stamp.id);
        if (result.archived) {
          setStamps((prev) =>
            prev.map((s) => (s.id === stamp.id ? { ...s, isActive: false } : s))
          );
          toast.info(`Stamp has active collectors, so it was safely deactivated.`);
        } else {
          setStamps((prev) => prev.filter((s) => s.id !== stamp.id));
          toast.success(`Stamp permanently deleted.`);
        }
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to delete stamp");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Travel Stamp Catalog
          </h1>
          <p className="mt-1 text-sm text-zinc-500 max-w-2xl">
            Create, design, and manage destination stamps. Approved stamps appear in traveler passports under &ldquo;Where I&apos;ve Been&rdquo;.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-black transition cursor-pointer"
        >
          <span className="text-base leading-none">+</span>
          <span>Create Travel Stamp</span>
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total Stamps</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Active Catalog</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Inactive / Archived</p>
          <p className="mt-1 text-2xl font-bold text-zinc-600">{stats.inactive}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Total Guest Collections</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{stats.totalCollected}</p>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by destination, city, country..."
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2 text-sm outline-none focus:border-amber-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600"
              >
                Clear
              </button>
            )}
          </div>

          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-amber-400"
          >
            <option value="all">All Countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1">
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                selectedStatus === status
                  ? "bg-white text-zinc-900 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {status === "ALL" ? "All" : status === "ACTIVE" ? "Active" : "Archived"}
            </button>
          ))}
        </div>
      </div>

      {/* Stamps Grid */}
      {filteredStamps.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredStamps.map((stamp) => (
            <div
              key={stamp.id}
              className={`flex flex-col justify-between rounded-2xl border transition shadow-2xs p-5 bg-white ${
                stamp.isActive
                  ? "border-zinc-200/90 hover:border-amber-300 hover:shadow-md"
                  : "border-zinc-200/60 bg-zinc-50/60 opacity-70"
              }`}
            >
              {/* Card Top: Design preview & order badge */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
                    #{stamp.displayOrder}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        stamp.isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                      }`}
                    >
                      {stamp.isActive ? "Active" : "Archived"}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200/70">
                      {stamp.category}
                    </span>
                  </div>
                </div>

                {/* Stamp Icon Graphic Preview */}
                <div className="flex justify-center py-2">
                  <div className="relative size-28 rounded-full border border-dashed border-zinc-300 p-2 flex items-center justify-center bg-zinc-50 shadow-2xs">
                    {stamp.iconUrl ? (
                      <Image
                        src={stamp.iconUrl}
                        alt={stamp.displayName}
                        width={90}
                        height={90}
                        unoptimized={Boolean(stamp.iconUrl.endsWith(".svg"))}
                        className="object-contain"
                      />
                    ) : (
                      <span className="text-3xl">🏛️</span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="mt-3 text-center">
                  <h3 className="text-sm font-bold text-zinc-900 truncate">
                    {stamp.title || stamp.displayName}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {[stamp.city, stamp.country].filter(Boolean).join(", ") || stamp.displayName}
                  </p>
                  {stamp.description && (
                    <p className="mt-2 text-[11px] leading-relaxed text-zinc-600 line-clamp-2 px-1">
                      {stamp.description}
                    </p>
                  )}
                  <div className="mt-3 text-[11px] text-zinc-400">
                    Collected by <strong className="text-zinc-700">{stamp.collectorCount}</strong> travelers
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="mt-5 pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewStamp(stamp)}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 transition cursor-pointer"
                  title="Preview how this stamp appears on guest profile"
                >
                  👁 Preview
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(stamp)}
                    className="rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(stamp)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer"
                  >
                    {stamp.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(stamp)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Delete or safely archive"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/70 p-12 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
            🛂
          </div>
          <h3 className="text-base font-bold text-zinc-800">No travel stamps found</h3>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
            {search || selectedCountry !== "all" || selectedStatus !== "ALL"
              ? "Try adjusting your search or filters to find stamps."
              : "Get started by creating your first destination travel stamp."}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-4 rounded-full bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-black transition cursor-pointer"
          >
            Create Travel Stamp
          </button>
        </div>
      )}

      {/* Create / Edit Stamp Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">
                  {formData.id ? "Edit Travel Stamp" : "Create New Travel Stamp"}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Upload custom destination artwork and configure guest visibility.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-full bg-zinc-100 p-1.5 text-zinc-500 hover:bg-zinc-200 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="max-h-[80vh] overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">
                    Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="e.g. Paris"
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  />
                  <span className="text-[10px] text-zinc-400">Short caption shown under stamp (e.g. Paris, Coffee)</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700">
                    Full Title / Explorer Tag
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Paris Explorer"
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  />
                  <span className="text-[10px] text-zinc-400">Used in detail dialogs and search tags</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="e.g. France"
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700">City / Destination</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Paris"
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  >
                    <option value="CITY">City</option>
                    <option value="COUNTRY">Country</option>
                    <option value="DESTINATION">Destination</option>
                    <option value="THEME">Theme / Lifestyle</option>
                    <option value="LANDMARK">Landmark</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Display Order</label>
                  <input
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value, 10) || 0 })}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Awarded for discovering Paris, Eiffel Tower views, and authentic French bistros."
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
              </div>

              {/* Artwork Upload & Preview */}
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4">
                <label className="block text-xs font-bold text-zinc-800 mb-1">
                  Stamp Design Artwork <span className="text-rose-500">*</span>
                </label>
                <p className="text-[11px] text-zinc-500 mb-3">
                  Upload a unique stamp illustration. Supports PNG, JPG, WebP, or SVG. Transparent backgrounds are highly recommended.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Artwork Preview Box */}
                  <div className="relative size-24 shrink-0 rounded-full border border-dashed border-zinc-300 p-2 flex items-center justify-center bg-white shadow-2xs">
                    {formData.iconUrl ? (
                      <Image
                        src={formData.iconUrl}
                        alt="Preview"
                        width={70}
                        height={70}
                        unoptimized={Boolean(formData.iconUrl.endsWith(".svg"))}
                        className="object-contain"
                      />
                    ) : (
                      <span className="text-xs text-zinc-400 text-center">No image</span>
                    )}
                  </div>

                  <div className="flex-1 w-full">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      className="block w-full text-xs text-zinc-600 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-zinc-900 file:text-white hover:file:bg-black file:cursor-pointer"
                    />
                    {isUploading && (
                      <p className="text-xs text-amber-600 font-medium mt-1">Uploading artwork...</p>
                    )}
                    {formData.iconUrl && (
                      <p className="text-[10px] text-zinc-400 truncate mt-1">
                        URL: {formData.iconUrl}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Guest Profile Live Preview Box */}
              {formData.iconUrl && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                  <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-2">
                    Live Guest Profile Preview (Where I&apos;ve Been)
                  </p>
                  <div className="flex justify-center py-2">
                    <div className="flex flex-col items-center">
                      <div className="relative size-28 rounded-full border border-dashed border-zinc-300 p-2 flex items-center justify-center bg-zinc-50/80 shadow-2xs">
                        <Image
                          src={formData.iconUrl}
                          alt="Live Preview"
                          width={80}
                          height={80}
                          unoptimized={Boolean(formData.iconUrl.endsWith(".svg"))}
                          className="object-contain"
                        />
                      </div>
                      <span className="text-xs font-medium text-zinc-700 text-center mt-2">
                        {formData.displayName || "Destination"}
                      </span>
                      <span className="text-[10px] text-zinc-400 capitalize">
                        {formData.category.toLowerCase()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-zinc-900">Active for Traveler Selection</p>
                  <p className="text-[11px] text-zinc-500">
                    When active, guests can discover and select this stamp in their passport.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="size-4 rounded accent-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-full border border-zinc-200 px-5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || isUploading}
                  className="rounded-full bg-zinc-900 px-6 py-2 text-xs font-bold text-white hover:bg-black transition disabled:opacity-50"
                >
                  {isPending ? "Saving..." : formData.id ? "Save Changes" : "Create Stamp"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guest Preview Modal */}
      {previewStamp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl p-6 text-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800">
              Guest Profile Preview
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              How this stamp renders in the guest&apos;s &ldquo;Where I&apos;ve Been&rdquo; section
            </p>

            <div className="my-8 flex justify-center">
              <div className="flex flex-col items-center">
                <div className="relative size-32 rounded-full border border-dashed border-zinc-300 p-2 flex items-center justify-center bg-zinc-50 shadow-2xs">
                  {previewStamp.iconUrl ? (
                    <Image
                      src={previewStamp.iconUrl}
                      alt={previewStamp.displayName}
                      width={96}
                      height={96}
                      unoptimized={Boolean(previewStamp.iconUrl.endsWith(".svg"))}
                      className="object-contain"
                    />
                  ) : (
                    <span className="text-4xl">🏛️</span>
                  )}
                </div>
                <span className="text-sm font-semibold text-zinc-800 mt-3">
                  {previewStamp.displayName}
                </span>
                <span className="text-[11px] text-zinc-400 capitalize">
                  {previewStamp.category.toLowerCase()}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-zinc-50 p-3 text-left text-xs text-zinc-600 space-y-1 mb-5">
              <p><strong>Title:</strong> {previewStamp.title || previewStamp.displayName}</p>
              <p><strong>Location:</strong> {[previewStamp.city, previewStamp.country].filter(Boolean).join(", ") || "N/A"}</p>
              <p><strong>Description:</strong> {previewStamp.description || "N/A"}</p>
              <p><strong>Status:</strong> {previewStamp.isActive ? "Available to guests" : "Archived"}</p>
            </div>

            <button
              type="button"
              onClick={() => setPreviewStamp(null)}
              className="w-full rounded-full bg-zinc-900 py-2.5 text-xs font-bold text-white hover:bg-black transition"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

