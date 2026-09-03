"use client";

import React, { useState, useEffect, useTransition } from "react";
import type {
  HostPermissionsResolution,
  ResolvedHostPermission,
  ThreeStateOverride,
  EffectiveState,
} from "@/lib/permissions/host-permissions";
import { HOST_PERMISSION_CATEGORIES } from "@/lib/permissions/host-permissions";
import {
  getHostPermissionsAction,
  updateHostPermissionOverrideAction,
  resetHostPermissionsAction,
} from "@/actions/admin/hostPermissionActions";
import { toast } from "@/components/ui/toast";
import { HorizontalTabSlider } from "@/components/ui/horizontal-tab-slider";

interface HostPermissionsTabProps {
  hostId: string;
  hostName: string | null;
  hostEmail: string | null;
  hostStatus: string;
  initialResolution?: HostPermissionsResolution;
}

export function HostPermissionsTab({
  hostId,
  hostName,
  hostEmail,
  hostStatus,
  initialResolution,
}: HostPermissionsTabProps) {
  const [resolution, setResolution] = useState<HostPermissionsResolution | null>(
    initialResolution || null,
  );
  const [loading, setLoading] = useState(!initialResolution);
  const [error, setError] = useState<string | null>(null);

  // Local unsaved changes state map: permissionSlug -> ThreeStateOverride
  const [stagedOverrides, setStagedOverrides] = useState<Record<string, ThreeStateOverride>>({});
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [isPending, startTransition] = useTransition();

  // Load data if not provided
  useEffect(() => {
    if (!initialResolution) {
      loadData();
    }
  }, [hostId, initialResolution]);

  async function loadData() {
    setLoading(true);
    setError(null);
    const res = await getHostPermissionsAction(hostId);
    if (!res.ok) {
      setError(res.error);
    } else {
      setResolution(res.data);
      setStagedOverrides({});
      setSelectedSlugs([]);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center shadow-2xs">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
        <p className="mt-3 text-xs font-semibold text-[var(--muted-foreground)]">
          Loading Host Access & Permission Matrix...
        </p>
      </div>
    );
  }

  if (error || !resolution) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900/50 p-6 text-xs text-rose-800 dark:text-rose-300 space-y-3">
        <strong className="block text-sm font-bold">Failed to load permissions</strong>
        <p>{error || "Unable to fetch host permission resolution."}</p>
        <button
          onClick={loadData}
          className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-rose-700 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  const { permissions, summary } = resolution;
  const isSuspended = hostStatus === "SUSPENDED";

  // Compute pending changed permissions count
  const changedSlugs = Object.keys(stagedOverrides).filter((slug) => {
    const original = permissions.find((p) => p.slug === slug);
    return original && original.overrideEffect !== stagedOverrides[slug];
  });
  const hasUnsavedChanges = changedSlugs.length > 0;

  // Filter permissions based on active category and search
  const filteredPermissions = permissions.filter((p) => {
    const matchesCat = activeCategory === "all" || p.category === activeCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Handle single override radio change
  function handleSelectOverride(slug: string, effect: ThreeStateOverride) {
    setStagedOverrides((prev) => ({
      ...prev,
      [slug]: effect,
    }));
  }

  // Handle Bulk Selection
  function toggleSelectAllFiltered() {
    const filteredSlugs = filteredPermissions.map((p) => p.slug);
    const allSelected = filteredSlugs.every((s) => selectedSlugs.includes(s));
    if (allSelected) {
      setSelectedSlugs((prev) => prev.filter((s) => !filteredSlugs.includes(s)));
    } else {
      setSelectedSlugs((prev) => Array.from(new Set([...prev, ...filteredSlugs])));
    }
  }

  function handleBulkStageEffect(effect: ThreeStateOverride) {
    if (selectedSlugs.length === 0) return;
    const nextOverrides = { ...stagedOverrides };
    for (const slug of selectedSlugs) {
      nextOverrides[slug] = effect;
    }
    setStagedOverrides(nextOverrides);
    toast.success(`Staged ${selectedSlugs.length} permissions to '${effect}'. Click "Save Changes" to commit.`);
  }

  // Save all staged changes
  function handleConfirmSave() {
    if (!hasUnsavedChanges) return;

    startTransition(async () => {
      let successCount = 0;
      let lastErr = "";

      for (const slug of changedSlugs) {
        const effect = stagedOverrides[slug];
        const res = await updateHostPermissionOverrideAction(
          hostId,
          slug,
          effect,
          overrideReason,
        );
        if (res.ok) {
          successCount++;
          setResolution(res.data);
        } else {
          lastErr = res.error;
        }
      }

      setShowSaveConfirmModal(false);
      setOverrideReason("");
      setStagedOverrides({});
      setSelectedSlugs([]);

      if (successCount > 0) {
        toast.success(`Successfully saved ${successCount} host permission override${
          successCount > 1 ? "s" : ""
        }!`);
      } else if (lastErr) {
        toast.error(lastErr);
      }
    });
  }

  // Reset all host permissions to defaults
  function handleConfirmReset() {
    startTransition(async () => {
      const res = await resetHostPermissionsAction(hostId, overrideReason);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        setResolution(res.data);
        setStagedOverrides({});
        setSelectedSlugs([]);
        toast.success("All host permission overrides have been reset to Default Host permissions.");
      }
      setShowResetModal(false);
      setOverrideReason("");
    });
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground">
      {/* Suspended Host Warning Card */}
      {isSuspended && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 dark:bg-amber-950/40 dark:border-amber-900/50 p-4 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-3 shadow-2xs">
          <span className="text-base leading-none">⚠️</span>
          <div>
            <strong className="block font-bold text-muted-foreground">Host Account is SUSPENDED</strong>
            This host account is currently suspended. Backend authorization automatically enforces{" "}
            <strong>DENY</strong> for all host operations regardless of individual permission overrides until the account is unsuspended.
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Total Permissions</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold tracking-tight text-muted-foreground">
              {summary.totalCount}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${
                isSuspended
                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
              }`}
            >
              {isSuspended ? "0 Active (Suspended)" : `${summary.effectiveAllowedCount} Effective Allowed`}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Inherited (Default)</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400">
              {summary.inheritedCount}
            </span>
            <span className="text-xs font-bold text-[var(--muted-foreground)]">
              Baseline Role
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Allowed Overrides</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
              {summary.allowedOverridesCount}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">
              Explicit Allow
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Denied Overrides</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
              {summary.deniedOverridesCount}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50">
              Explicit Deny
            </span>
          </div>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-muted-foreground">
              Host Access & Permission Management
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Manage permission overrides for <strong>{hostName || hostEmail}</strong> (#
              {hostId}). Individual overrides supercede default Host role permissions.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {hasUnsavedChanges && (
              <span className="text-xs font-bold text-amber-800 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 animate-pulse">
                {changedSlugs.length} Unsaved {changedSlugs.length === 1 ? "Change" : "Changes"}
              </span>
            )}

            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              disabled={isPending}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-all inline-flex items-center gap-2 disabled:opacity-50 shadow-2xs"
            >
              {isPending && (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              <span>{isPending ? "Resetting..." : "Reset to Defaults"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSaveConfirmModal(true)}
              disabled={!hasUnsavedChanges || isPending}
              className={`rounded-full px-5 py-2 text-xs font-extrabold transition-all shadow-2xs inline-flex items-center gap-2 ${
                hasUnsavedChanges
                  ? "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)]"
                  : "bg-[var(--surface-secondary)] text-[var(--muted-foreground)] cursor-not-allowed border border-[var(--border)]"
              }`}
            >
              {isPending && (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              <span>{isPending ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </div>

        {/* Toolbar: Category Pills & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[var(--surface-secondary)] p-3 rounded-2xl border border-[var(--border-subtle)]">
          {/* Category Filter Pills */}
          <HorizontalTabSlider className="lg:max-w-[70%]">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === "all"
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-extrabold shadow-2xs"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-muted-foreground"
              }`}
            >
              All Categories ({permissions.length})
            </button>
            {HOST_PERMISSION_CATEGORIES.map((cat) => {
              const count = permissions.filter((p) => p.category === cat.id).length;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-extrabold shadow-2xs"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-muted-foreground"
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </HorizontalTabSlider>

          {/* Search Box */}
          <div className="relative w-full lg:w-64">
            <input
              type="text"
              placeholder="Search permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] text-muted-foreground pl-3.5 pr-8 py-1.5 text-xs outline-none focus:border-[var(--accent)] transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-muted-foreground hover:bg-[var(--surface-secondary)] transition-colors"
                title="Clear search"
                aria-label="Clear search"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Bulk Action Controls */}
        {selectedSlugs.length > 0 && (
          <div className="flex items-center justify-between gap-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs">
            <span className="font-bold text-amber-900 dark:text-amber-300">
              {selectedSlugs.length} permission{selectedSlugs.length > 1 ? "s" : ""} selected for bulk action
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBulkStageEffect("ALLOW")}
                className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-2xs"
              >
                Allow Selected
              </button>
              <button
                type="button"
                onClick={() => handleBulkStageEffect("DENY")}
                className="px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-2xs"
              >
                Deny Selected
              </button>
              <button
                type="button"
                onClick={() => handleBulkStageEffect("INHERITED")}
                className="px-3 py-1.5 rounded-full bg-zinc-700 hover:bg-zinc-800 text-white font-bold transition-all shadow-2xs"
              >
                Reset to Inherited
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlugs([])}
                className="text-[var(--muted-foreground)] hover:text-muted-foreground text-xs underline ml-2 font-bold"
              >
                Deselect
              </button>
            </div>
          </div>
        )}

        {/* Permission List Table */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      filteredPermissions.length > 0 &&
                      filteredPermissions.every((p) => selectedSlugs.includes(p.slug))
                    }
                    onChange={toggleSelectAllFiltered}
                    className="rounded border-[var(--border)]"
                  />
                </th>
                <th className="py-3.5 px-4">Permission & Description</th>
                <th className="py-3.5 px-4 w-32">Category</th>
                <th className="py-3.5 px-4 w-64 text-center">Override Selection</th>
                <th className="py-3.5 px-4 w-40 text-center">Effective Status</th>
                <th className="py-3.5 px-4 w-44">Permission Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredPermissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--muted-foreground)]">
                    No permissions match the current filter or search criteria.
                  </td>
                </tr>
              ) : (
                filteredPermissions.map((perm) => {
                  const currentStagedEffect =
                    stagedOverrides[perm.slug] !== undefined
                      ? stagedOverrides[perm.slug]
                      : perm.overrideEffect;

                  const isStagedChanged = currentStagedEffect !== perm.overrideEffect;
                  const isChecked = selectedSlugs.includes(perm.slug);

                  // Calculate live preview effective status
                  let previewEffective: EffectiveState = perm.defaultEffect;
                  let previewSourceLabel = "Inherited from Host Role";
                  if (currentStagedEffect === "ALLOW") {
                    previewEffective = "ALLOW";
                    previewSourceLabel = "Explicitly Allowed by Admin";
                  } else if (currentStagedEffect === "DENY") {
                    previewEffective = "DENY";
                    previewSourceLabel = "Denied by Admin";
                  }

                  if (isSuspended) {
                    previewEffective = "DENY";
                  }

                  return (
                    <tr
                      key={perm.slug}
                      className={`transition-colors ${
                        isStagedChanged
                          ? "bg-amber-500/10"
                          : isChecked
                          ? "bg-[var(--surface-secondary)]"
                          : "hover:bg-[var(--surface-secondary)]"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 align-middle">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSlugs((prev) => [...prev, perm.slug]);
                            } else {
                              setSelectedSlugs((prev) =>
                                prev.filter((s) => s !== perm.slug),
                              );
                            }
                          }}
                          className="rounded border-[var(--border)]"
                        />
                      </td>

                      {/* Permission Info */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-muted-foreground">{perm.label}</span>
                          <span className="text-[10px] font-mono text-[var(--muted-foreground)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                            {perm.slug}
                          </span>
                          {isStagedChanged && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                              Modified
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                          {perm.description}
                        </p>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 align-middle">
                        <span className="capitalize font-semibold text-[var(--muted-foreground)]">
                          {perm.category}
                        </span>
                      </td>

                      {/* Three-State Override Switcher */}
                      <td className="py-3.5 px-4 align-middle text-center">
                        <div className="inline-flex items-center justify-center gap-1 bg-[var(--surface-secondary)] p-1 rounded-full border border-[var(--border)]">
                          <button
                            type="button"
                            onClick={() => handleSelectOverride(perm.slug, "INHERITED")}
                            className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
                              currentStagedEffect === "INHERITED"
                                ? "bg-[var(--surface)] text-muted-foreground shadow-2xs border border-[var(--border)]"
                                : "text-[var(--muted-foreground)] hover:text-muted-foreground"
                            }`}
                            title="Inherit default permission from Host role"
                          >
                            Inherited
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectOverride(perm.slug, "ALLOW")}
                            className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
                              currentStagedEffect === "ALLOW"
                                ? "bg-emerald-600 text-white shadow-2xs"
                                : "text-[var(--muted-foreground)] hover:text-emerald-600"
                            }`}
                            title="Explicitly ALLOW this permission for host"
                          >
                            Allow
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectOverride(perm.slug, "DENY")}
                            className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
                              currentStagedEffect === "DENY"
                                ? "bg-rose-600 text-white shadow-2xs"
                                : "text-[var(--muted-foreground)] hover:text-rose-600"
                            }`}
                            title="Explicitly DENY this permission for host"
                          >
                            Deny
                          </button>
                        </div>
                      </td>

                      {/* Effective Status Badge */}
                      <td className="py-3.5 px-4 align-middle text-center">
                        {isSuspended ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50">
                            ✕ Denied (Suspended)
                          </span>
                        ) : previewEffective === "ALLOW" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">
                            ✓ Allowed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50">
                            ✕ Denied
                          </span>
                        )}
                      </td>

                      {/* Source Display */}
                      <td className="py-3.5 px-4 align-middle">
                        <span className="text-[11px] text-[var(--muted-foreground)] font-medium block">
                          {previewSourceLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* SAVE CHANGES CONFIRMATION MODAL */}
      {showSaveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-muted-foreground">
              Confirm Permission Changes
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              You are updating access settings for <strong>{hostName || hostEmail}</strong> (#
              {hostId}). Updating permissions will immediately adjust what this host can access on the platform and write to the audit log.
            </p>

            <div className="bg-[var(--surface-secondary)] p-3 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold">
              Pending Changes ({changedSlugs.length}):
              <ul className="mt-1 space-y-1 font-mono text-[11px] text-[var(--muted-foreground)] max-h-32 overflow-y-auto">
                {changedSlugs.map((slug) => (
                  <li key={slug}>
                    • {slug} → <strong className="text-muted-foreground">{stagedOverrides[slug]}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1">
                Reason / Administrative Note (Optional)
              </label>
              <textarea
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Specify reason for changing host permissions..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 text-xs outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setShowSaveConfirmModal(false)}
                disabled={isPending}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-bold text-muted-foreground hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isPending}
                className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 py-2 font-extrabold text-[var(--accent-foreground)] shadow-2xs inline-flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {isPending && (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                <span>{isPending ? "Saving Changes..." : "Confirm & Save Changes"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET TO DEFAULTS CONFIRMATION MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-muted-foreground">
              Reset Host Permissions
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              This will remove all custom permission overrides for{" "}
              <strong>{hostName || hostEmail}</strong> and restore the host to the default Host
              permissions baseline.
            </p>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-900 dark:text-amber-300 font-medium">
              ℹ️ Note: This will not change account status or delete any host property data.
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1">
                Reason / Note (Optional)
              </label>
              <textarea
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for resetting permissions..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 text-xs outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isPending}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-bold text-muted-foreground hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isPending}
                className="rounded-full bg-rose-600 hover:bg-rose-700 px-5 py-2 font-extrabold text-white shadow-2xs inline-flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {isPending && (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                <span>{isPending ? "Resetting..." : "Reset to Defaults"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
