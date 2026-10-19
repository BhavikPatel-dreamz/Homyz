"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PERMISSIONS, hasPermission } from "@/lib/permissions/permissions";

interface CmsContentItem {
  id: string;
  type: string;
  title: string;
  slug: string | null;
  locale: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  createdBy?: { name?: string | null; email?: string | null };
  publication?: { publishedAt: string; version?: { versionNumber: number } } | null;
  _count?: { versions: number };
}

const CONTENT_TYPES = [
  { value: "", label: "All Content Types" },
  { value: "HERO_SECTION", label: "Hero Section" },
  { value: "HOMEPAGE_BANNER", label: "Homepage Banner" },
  { value: "FEATURED_CITIES", label: "Featured Cities" },
  { value: "FEATURED_LISTINGS", label: "Featured Listings" },
  { value: "PROPERTY_COLLECTION", label: "Property Collection" },
  { value: "PROMOTIONAL_CAMPAIGN", label: "Promotional Campaign" },
  { value: "FAQ_ITEM", label: "FAQ Item" },
  { value: "FAQ_CATEGORY", label: "FAQ Category" },
  { value: "STATIC_PAGE", label: "Static Page" },
  { value: "SEO_LANDING_PAGE", label: "SEO Landing Page" },
  { value: "ANNOUNCEMENT_BAR", label: "Announcement Bar" },
  { value: "NAVIGATION_CONFIG", label: "Navigation Config" },
  { value: "FOOTER_CONFIG", label: "Footer Config" },
];

const STATUS_FILTERS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "UNPUBLISHED", label: "Unpublished" },
  { value: "ARCHIVED", label: "Archived" },
];

export default function CmsManagementPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [items, setItems] = useState<CmsContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  // New Content Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState("HOMEPAGE_BANNER");
  const [createTitle, setCreateTitle] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [creating, setCreating] = useState(false);

  const canCreate = hasPermission(user, PERMISSIONS.CMS_CREATE);
  const canPublish = hasPermission(user, PERMISSIONS.CMS_PUBLISH);
  const canUnpublish = hasPermission(user, PERMISSIONS.CMS_UNPUBLISH);
  const canEdit = hasPermission(user, PERMISSIONS.CMS_EDIT);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });
      if (search) params.set("search", search);
      if (selectedType) params.set("type", selectedType);
      if (selectedStatus) params.set("status", selectedStatus);

      const res = await fetch(`/api/v1/admin/cms/content?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load content (${res.status})`);
      }
      const json = await res.json();
      const data = json.data || json;
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      setActionError(err.message || "Failed to fetch content list");
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedType, selectedStatus]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return;

    setCreating(true);
    setActionError(null);
    try {
      // Fetch default payload for type
      const typesRes = await fetch("/api/v1/admin/cms/types");
      const typesJson = await typesRes.json().catch(() => ({}));
      const typesList = Array.isArray(typesJson?.data)
        ? typesJson.data
        : Array.isArray(typesJson)
        ? typesJson
        : [];
      const currentDef = typesList.find((t: any) => t.type === createType);

      const basePayload = currentDef?.defaultPayload || {};
      const payload = {
        ...basePayload,
        title: createTitle,
      };

      const cleanSlug = createSlug.trim().replace(/^\/+|\/+$/g, "");

      const res = await fetch("/api/v1/admin/cms/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: createType,
          title: createTitle,
          slug: cleanSlug || undefined,
          payload,
          changeSummary: "Initial content creation",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let errMsg = "Failed to create content";
        if (typeof errorData.error === "string") {
          errMsg = errorData.error;
        } else if (errorData.error?.message) {
          errMsg = errorData.error.message;
          if (Array.isArray(errorData.error.details) && errorData.error.details.length > 0) {
            const detailMsgs = errorData.error.details.map((d: any) => `${d.path}: ${d.message}`).join(", ");
            errMsg += ` (${detailMsgs})`;
          }
        } else if (errorData.message) {
          errMsg = errorData.message;
        }
        throw new Error(errMsg);
      }

      const resJson = await res.json().catch(() => ({}));
      const createdItem = resJson.data || resJson;

      setShowCreateModal(false);
      setCreateTitle("");
      setCreateSlug("");
      if (createdItem?.id) {
        window.location.href = `/admin/cms/${createdItem.id}`;
      } else {
        await fetchContent();
      }
    } catch (err: any) {
      setActionError(err.message || "Creation failed");
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/v1/admin/cms/content/${id}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Publish failed");
      }
      await fetchContent();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUnpublish = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to remove this content from the live website?")) return;
    try {
      const res = await fetch(`/api/v1/admin/cms/content/${id}/unpublish`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Unpublish failed");
      }
      await fetchContent();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Published</span>;
      case "DRAFT":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Draft</span>;
      case "UNPUBLISHED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-200 text-zinc-700">Unpublished</span>;
      case "ARCHIVED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Archived</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border)] pb-5">
        <h1 className="text-xl font-bold text-[var(--foreground)]">
          CMS Content Management
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Manage homepage banners, sections, static pages, and marketing content.
        </p>
      </div>
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search by title or slug..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="px-3.5 py-2 text-sm border border-zinc-200 rounded-xl w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {canCreate && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create Content
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-medium">
            {actionError}
          </div>
        )}

        {/* Content Table */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Content Item</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Revisions</th>
                  <th className="px-5 py-3.5">Last Updated</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-zinc-400">
                      Loading CMS content...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-zinc-400">
                      No content items found matching current filters.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/60 transition">
                      <td className="px-5 py-4">
                        <Link href={`/admin/cms/${item.id}`} className="font-semibold text-zinc-900 hover:underline">
                          {item.title}
                        </Link>
                        {item.slug && (
                          <div className="text-xs text-zinc-400 font-mono mt-0.5">
                            /{item.slug} ({item.locale})
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-zinc-600">
                        {item.type.replace(/_/g, " ")}
                      </td>
                      <td className="px-5 py-4">
                        {statusBadge(item.status)}
                      </td>
                      <td className="px-5 py-4 text-xs text-zinc-500">
                        {item._count?.versions || 1} revision(s)
                      </td>
                      <td className="px-5 py-4 text-xs text-zinc-500">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-right space-x-2">
                        <Link
                          href={`/admin/cms/${item.id}`}
                          className="inline-flex items-center px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition"
                        >
                          Edit
                        </Link>
                        {item.status !== "PUBLISHED" && canPublish && (
                          <button
                            type="button"
                            onClick={(e) => handlePublish(item.id, e)}
                            className="inline-flex items-center px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition"
                          >
                            Publish
                          </button>
                        )}
                        {item.status === "PUBLISHED" && canUnpublish && (
                          <button
                            type="button"
                            onClick={(e) => handleUnpublish(item.id, e)}
                            className="inline-flex items-center px-2.5 py-1.5 border border-zinc-200 text-zinc-600 rounded-lg text-xs font-semibold hover:bg-zinc-100 transition"
                          >
                            Unpublish
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
            <div>
              Total: <span className="font-semibold text-zinc-700">{total}</span> content items
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-zinc-200 rounded-lg bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 font-medium"
              >
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-zinc-200 rounded-lg bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 font-medium"
              >
                Next
              </button>
            </div>
          </div>
        </div>

      {/* Create Content Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900">Create New Content</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Content Type</label>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  {CONTENT_TYPES.filter((t) => t.value !== "").map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Internal Title / Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer 2027 Main Hero"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  URL Slug (Optional for pages/collections)
                </label>
                <input
                  type="text"
                  placeholder="e.g. luxury-villas"
                  value={createSlug}
                  onChange={(e) => setCreateSlug(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-700 rounded-xl text-sm font-semibold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create & Edit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

