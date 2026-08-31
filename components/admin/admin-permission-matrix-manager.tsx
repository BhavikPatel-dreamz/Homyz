"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Alert } from "../ui";
import {
  updateAdminPermissionsAction,
  resetAdminPermissionsAction,
} from "@/actions/admin/adminManagement";
import type {
  AdminPermissionResolution,
  ThreeStateOverride,
} from "@/lib/permissions/admin-permission-service";

export function AdminPermissionMatrixManager({
  initialResolution,
}: {
  initialResolution: AdminPermissionResolution;
}) {
  const [resolution, setResolution] = useState<AdminPermissionResolution>(initialResolution);
  const { summary, permissions } = resolution;

  // Staged local state map: permissionSlug -> ThreeStateOverride
  const [stagedOverrides, setStagedOverrides] = useState<Record<string, ThreeStateOverride>>(() => {
    const map: Record<string, ThreeStateOverride> = {};
    for (const p of permissions) {
      map[p.slug] = p.overrideEffect;
    }
    return map;
  });

  // UI state
  const [search, setSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "modules">("table");

  // Modals state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [reason, setReason] = useState("");

  const [feedback, setFeedback] = useState<{ tone: "error" | "success" | "warning"; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Get list of unique modules
  const modules = Array.from(new Set(permissions.map((p) => p.module)));

  // Calculate pending unsaved changes
  const changedSlugs = permissions
    .filter((p) => stagedOverrides[p.slug] !== p.overrideEffect)
    .map((p) => p.slug);
  const unsavedCount = changedSlugs.length;

  // Filter permissions
  const filteredPermissions = permissions.filter((p) => {
    const matchesModule = selectedModule === "ALL" || p.module === selectedModule;
    const matchesSearch =
      !search.trim() ||
      p.action.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase()) ||
      p.module.toLowerCase().includes(search.toLowerCase());
    return matchesModule && matchesSearch;
  });

  // Calculate live stats based on staged state
  let liveAllowed = 0;
  let liveDenied = 0;
  let liveInherited = 0;

  for (const p of permissions) {
    const staged = stagedOverrides[p.slug] || "INHERIT";
    if (staged === "ALLOW") {
      liveAllowed++;
    } else if (staged === "DENY") {
      liveDenied++;
    } else {
      liveInherited++;
      if (p.roleDefault) liveAllowed++;
      else liveDenied++;
    }
  }

  // Row stage change
  function handleStageChange(slug: string, effect: ThreeStateOverride) {
    setStagedOverrides((prev) => ({
      ...prev,
      [slug]: effect,
    }));
  }

  // Checkbox row toggle
  function toggleSelectSlug(slug: string) {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  // Toggle select all filtered
  function toggleSelectAllFiltered() {
    const filteredSlugs = filteredPermissions.map((p) => p.slug);
    const allSelected = filteredSlugs.every((s) => selectedSlugs.includes(s));
    if (allSelected) {
      setSelectedSlugs((prev) => prev.filter((s) => !filteredSlugs.includes(s)));
    } else {
      setSelectedSlugs((prev) => Array.from(new Set([...prev, ...filteredSlugs])));
    }
  }

  // Apply bulk stage to selected or filtered
  function handleBulkStageEffect(effect: ThreeStateOverride, targetSlugs?: string[]) {
    const slugsToUpdate = targetSlugs || (selectedSlugs.length > 0 ? selectedSlugs : filteredPermissions.map((p) => p.slug));
    if (slugsToUpdate.length === 0) return;

    const updated = { ...stagedOverrides };
    for (const slug of slugsToUpdate) {
      updated[slug] = effect;
    }
    setStagedOverrides(updated);
    setFeedback({
      tone: "warning",
      msg: `Staged ${slugsToUpdate.length} permission(s) to '${effect}'. Click "Save Changes" to commit.`,
    });
  }

  // Reset local staged changes
  function handleCancelStaged() {
    const map: Record<string, ThreeStateOverride> = {};
    for (const p of permissions) {
      map[p.slug] = p.overrideEffect;
    }
    setStagedOverrides(map);
    setSelectedSlugs([]);
    setReason("");
    setFeedback(null);
  }

  // Execute Save API
  function handleConfirmSave() {
    setFeedback(null);

    const updates: { permission: string; effect: ThreeStateOverride }[] = [];
    for (const p of permissions) {
      const current = stagedOverrides[p.slug];
      if (current !== p.overrideEffect) {
        updates.push({ permission: p.slug, effect: current });
      }
    }

    if (updates.length === 0) {
      setShowSaveModal(false);
      setFeedback({ tone: "warning", msg: "No permission changes to save." });
      return;
    }

    startTransition(async () => {
      const res = await updateAdminPermissionsAction(summary.adminId, updates, reason);
      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error });
        return;
      }

      setResolution(res.data);
      const newMap: Record<string, ThreeStateOverride> = {};
      for (const p of res.data.permissions) {
        newMap[p.slug] = p.overrideEffect;
      }
      setStagedOverrides(newMap);
      setSelectedSlugs([]);
      setShowSaveModal(false);
      setReason("");
      setFeedback({
        tone: "success",
        msg: `Successfully saved ${updates.length} permission override(s) for ${summary.adminName || summary.adminEmail}.`,
      });
    });
  }

  // Execute Reset API
  function handleConfirmReset() {
    setFeedback(null);

    startTransition(async () => {
      const res = await resetAdminPermissionsAction(summary.adminId, reason || "Reset to role defaults");
      if (!res.ok) {
        setFeedback({ tone: "error", msg: res.error });
        return;
      }

      setResolution(res.data);
      const newMap: Record<string, ThreeStateOverride> = {};
      for (const p of res.data.permissions) {
        newMap[p.slug] = p.overrideEffect;
      }
      setStagedOverrides(newMap);
      setSelectedSlugs([]);
      setShowResetModal(false);
      setReason("");
      setFeedback({
        tone: "success",
        msg: "All individual permission overrides have been reset to role defaults.",
      });
    });
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-[var(--foreground)]">
      {/* Header breadcrumb & info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] mb-1">
            <Link href="/admin/admins" className="hover:text-[var(--foreground)] underline">
              Admin Management
            </Link>
            <span>/</span>
            <span>Individual Permissions</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Manage Permissions: <span className="text-[var(--accent)]">{summary.adminName}</span>
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Configure granular permission overrides for <strong className="text-[var(--foreground)]">{summary.adminEmail}</strong>.
          </p>
        </div>

        <Link
          href="/admin/admins"
          className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold hover:bg-[var(--surface-secondary)] transition-all shadow-2xs self-start sm:self-auto"
        >
          ← Back to Admins
        </Link>
      </div>

      {/* Action feedback alert */}
      {feedback && (
        <Alert tone={feedback.tone}>
          <div className="flex items-center justify-between">
            <span>{feedback.msg}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs underline ml-4 hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        </Alert>
      )}

      {/* Super Admin System Protection Banner */}
      {summary.isSuperAdmin ? (
        <div className="rounded-2xl border border-amber-300/80 bg-amber-50 dark:bg-amber-950/40 p-5 text-amber-900 dark:text-amber-200 shadow-2xs flex flex-col gap-2">
          <div className="flex items-center gap-2.5 font-extrabold text-sm">
            <span className="text-base">🛡️</span>
            <span>Super Admin System Role</span>
          </div>
          <p className="text-xs leading-relaxed opacity-95">
            Super Admin is a protected system-level role with fixed full access. Individual permissions cannot be edited, removed, or overridden for Super Admin accounts.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Metric Cards Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                Total Permissions
              </span>
              <span className="text-2xl font-black mt-1 text-[var(--foreground)]">
                {summary.totalPermissions}
              </span>
            </div>

            <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                Allowed
              </span>
              <span className="text-2xl font-black mt-1 text-emerald-900 dark:text-emerald-200">
                {liveAllowed}
              </span>
            </div>

            <div className="rounded-2xl border border-rose-300/60 bg-rose-50/50 dark:bg-rose-950/30 p-3.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                Denied
              </span>
              <span className="text-2xl font-black mt-1 text-rose-900 dark:text-rose-200">
                {liveDenied}
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                Inherited
              </span>
              <span className="text-2xl font-black mt-1 text-[var(--foreground)]">
                {liveInherited}
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                Admin Status
              </span>
              <span
                className={`mt-1.5 inline-flex items-center self-start px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  summary.adminStatus === "SUSPENDED"
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                }`}
              >
                {summary.adminStatus}
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                Assigned Role
              </span>
              <span className="text-xs font-black mt-1 text-[var(--foreground)] truncate">
                {summary.roleName}
              </span>
            </div>
          </div>

          {/* Module Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedModule("ALL")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all whitespace-nowrap shadow-2xs ${
                selectedModule === "ALL"
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
              }`}
            >
              All Modules ({permissions.length})
            </button>
            {modules.map((m) => {
              const count = permissions.filter((p) => p.module === m).length;
              const isSelected = selectedModule === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedModule(m)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all whitespace-nowrap shadow-2xs ${
                    isSelected
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
                  }`}
                >
                  {m} ({count})
                </button>
              );
            })}
          </div>

          {/* Controls Bar: Search, View Layout Switcher & Bulk Selection Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search permissions or action name..."
                  className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] py-1.5 pl-8 pr-4 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                />
                <svg
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* View Layout Switcher (Table Matrix vs Grouped Cards) */}
              <div className="inline-flex items-center p-1 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-1 text-xs font-extrabold rounded-full transition-all ${
                    viewMode === "table"
                      ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  📊 Table Matrix
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("modules")}
                  className={`px-3 py-1 text-xs font-extrabold rounded-full transition-all ${
                    viewMode === "modules"
                      ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  🗂️ Module Cards
                </button>
              </div>
            </div>

            {/* Quick Bulk Staging Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
              <span className="text-[11px] font-bold text-[var(--muted-foreground)] mr-1">
                {selectedSlugs.length > 0 ? `Selected (${selectedSlugs.length}):` : "Bulk Filtered:"}
              </span>
              <button
                type="button"
                onClick={() => handleBulkStageEffect("ALLOW")}
                className="rounded-full border border-emerald-300/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-3 py-1 text-[11px] font-bold hover:bg-emerald-100 transition-all shadow-2xs"
              >
                Allow
              </button>
              <button
                type="button"
                onClick={() => handleBulkStageEffect("DENY")}
                className="rounded-full border border-rose-300/80 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 px-3 py-1 text-[11px] font-bold hover:bg-rose-100 transition-all shadow-2xs"
              >
                Deny
              </button>
              <button
                type="button"
                onClick={() => handleBulkStageEffect("INHERIT")}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] px-3 py-1 text-[11px] font-bold hover:opacity-80 transition-all shadow-2xs"
              >
                Inherit
              </button>
              {selectedSlugs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedSlugs([])}
                  className="text-[11px] underline text-[var(--muted-foreground)] hover:text-[var(--foreground)] ml-1"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>

          {/* Unsaved changes notice bar */}
          {unsavedCount > 0 && (
            <div className="rounded-2xl border border-amber-300/80 bg-amber-50 dark:bg-amber-950/40 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="text-amber-800 dark:text-amber-300 font-extrabold text-xs">
                  ⚠️ {unsavedCount} unsaved permission change{unsavedCount > 1 ? "s" : ""} staged.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(true)}
                  disabled={pending}
                  className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 py-2 text-xs font-black text-[var(--accent-foreground)] shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-50 transition-all"
                >
                  <span>Save Changes</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelStaged}
                  disabled={pending}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* VIEW 1: Table Matrix View without Role Default Column */}
          {viewMode === "table" && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredPermissions.length > 0 &&
                          filteredPermissions.every((p) => selectedSlugs.includes(p.slug))
                        }
                        onChange={toggleSelectAllFiltered}
                        className="h-4 w-4 rounded accent-[var(--accent)] cursor-pointer"
                        title="Select/Deselect all filtered rows"
                      />
                    </th>
                    <th className="py-3.5 px-4 w-40">Module</th>
                    <th className="py-3.5 px-4">Permission</th>
                    <th className="py-3.5 px-4 w-56 text-center">Individual Override</th>
                    <th className="py-3.5 px-4 w-44 text-right">Effective Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filteredPermissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[var(--muted-foreground)]">
                        No permissions found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPermissions.map((p) => {
                      const stagedEffect = stagedOverrides[p.slug] || "INHERIT";
                      const isStagedChanged = stagedEffect !== p.overrideEffect;
                      const isSelected = selectedSlugs.includes(p.slug);

                      let liveAllowed = false;
                      let liveStatus = "Inherited";
                      let liveSource = "Admin Role";

                      if (stagedEffect === "ALLOW") {
                        liveAllowed = true;
                        liveStatus = "Allowed";
                        liveSource = "Individual Admin Override";
                      } else if (stagedEffect === "DENY") {
                        liveAllowed = false;
                        liveStatus = "Denied";
                        liveSource = "Individual Admin Override";
                      } else {
                        liveAllowed = p.roleDefault;
                        liveStatus = "Inherited";
                        liveSource = "Admin Role";
                      }

                      return (
                        <tr
                          key={p.slug}
                          className={`transition-colors ${
                            isSelected
                              ? "bg-[var(--accent)]/10"
                              : isStagedChanged
                              ? "bg-amber-50/40 dark:bg-amber-950/20"
                              : "hover:bg-[var(--surface-secondary)]"
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectSlug(p.slug)}
                              className="h-4 w-4 rounded accent-[var(--accent)] cursor-pointer"
                            />
                          </td>
                          <td className="py-3.5 px-4 font-bold text-[var(--foreground)]">
                            {p.module}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-[var(--foreground)]">{p.action}</div>
                            <div className="text-[11px] text-[var(--muted-foreground)] leading-tight">
                              {p.description}
                            </div>
                            <div className="text-[10px] font-mono text-[var(--muted-foreground)] opacity-70 mt-0.5">
                              {p.slug}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {/* 3-State Radio Switch (Inherit / Allow / Deny) */}
                            <div className="inline-flex items-center p-1 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleStageChange(p.slug, "INHERIT")}
                                className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full transition-all cursor-pointer ${
                                  stagedEffect === "INHERIT"
                                    ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                }`}
                                title="Inherit role default permission"
                              >
                                Inherit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStageChange(p.slug, "ALLOW")}
                                className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full transition-all cursor-pointer ${
                                  stagedEffect === "ALLOW"
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "text-[var(--muted-foreground)] hover:text-emerald-700 dark:hover:text-emerald-300"
                                }`}
                                title="Explicitly ALLOW this permission"
                              >
                                Allow
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStageChange(p.slug, "DENY")}
                                className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full transition-all cursor-pointer ${
                                  stagedEffect === "DENY"
                                    ? "bg-rose-600 text-white shadow-xs"
                                    : "text-[var(--muted-foreground)] hover:text-rose-700 dark:hover:text-rose-300"
                                }`}
                                title="Explicitly DENY this permission"
                              >
                                Deny
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-2xs ${
                                  liveAllowed
                                    ? "bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : "bg-rose-100/90 text-rose-800 border border-rose-300/80 dark:bg-rose-950/60 dark:text-rose-300"
                                }`}
                              >
                                {liveAllowed ? "Allowed" : "Denied"} ({liveStatus})
                              </span>
                              <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                                {liveSource}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* VIEW 2: Grouped Module Cards View */}
          {viewMode === "modules" && (
            <div className="flex flex-col gap-6">
              {(selectedModule === "ALL" ? modules : [selectedModule]).map((modName) => {
                const modPerms = filteredPermissions.filter((p) => p.module === modName);
                if (modPerms.length === 0) return null;

                const modSlugs = modPerms.map((p) => p.slug);

                return (
                  <div
                    key={modName}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs flex flex-col gap-4"
                  >
                    {/* Module Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                      <div>
                        <h3 className="font-extrabold text-sm uppercase tracking-wider text-[var(--foreground)]">
                          {modName} Module
                        </h3>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          {modPerms.length} configurable permission item{modPerms.length > 1 ? "s" : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 self-start sm:self-auto">
                        <span className="text-[11px] font-bold text-[var(--muted-foreground)] mr-1">Module:</span>
                        <button
                          type="button"
                          onClick={() => handleBulkStageEffect("ALLOW", modSlugs)}
                          className="rounded-full border border-emerald-300/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 text-[11px] font-bold hover:bg-emerald-100 transition-all shadow-2xs"
                        >
                          Allow All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkStageEffect("DENY", modSlugs)}
                          className="rounded-full border border-rose-300/80 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 px-2.5 py-1 text-[11px] font-bold hover:bg-rose-100 transition-all shadow-2xs"
                        >
                          Deny All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkStageEffect("INHERIT", modSlugs)}
                          className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] px-2.5 py-1 text-[11px] font-bold hover:opacity-80 transition-all shadow-2xs"
                        >
                          Reset Module
                        </button>
                      </div>
                    </div>

                    {/* Permissions Items Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {modPerms.map((p) => {
                        const stagedEffect = stagedOverrides[p.slug] || "INHERIT";

                        let liveAllowed = false;
                        if (stagedEffect === "ALLOW") liveAllowed = true;
                        else if (stagedEffect === "DENY") liveAllowed = false;
                        else liveAllowed = p.roleDefault;

                        return (
                          <div
                            key={p.slug}
                            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-3.5 shadow-2xs flex flex-col justify-between gap-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-xs text-[var(--foreground)]">{p.action}</h4>
                                <p className="text-[11px] text-[var(--muted-foreground)] leading-snug mt-0.5">
                                  {p.description}
                                </p>
                              </div>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  liveAllowed
                                    ? "bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : "bg-rose-100/90 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                }`}
                              >
                                {liveAllowed ? "Allowed" : "Denied"}
                              </span>
                            </div>

                            <div className="flex items-center justify-end pt-2 border-t border-[var(--border-subtle)] text-[11px]">
                              <div className="inline-flex items-center p-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)]">
                                <button
                                  type="button"
                                  onClick={() => handleStageChange(p.slug, "INHERIT")}
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                    stagedEffect === "INHERIT" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "text-[var(--muted-foreground)]"
                                  }`}
                                >
                                  Inherit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStageChange(p.slug, "ALLOW")}
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                    stagedEffect === "ALLOW" ? "bg-emerald-600 text-white" : "text-[var(--muted-foreground)]"
                                  }`}
                                >
                                  Allow
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStageChange(p.slug, "DENY")}
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                    stagedEffect === "DENY" ? "bg-rose-600 text-white" : "text-[var(--muted-foreground)]"
                                  }`}
                                >
                                  Deny
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Save & Reset Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              disabled={pending}
              className="rounded-full border border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 px-4 py-2 text-xs font-bold hover:bg-rose-100 transition-all shadow-2xs self-start sm:self-auto disabled:opacity-50"
            >
              Reset to Role Defaults
            </button>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Link
                href="/admin/admins"
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold hover:bg-[var(--surface-secondary)] transition-all"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => setShowSaveModal(true)}
                disabled={pending || unsavedCount === 0}
                className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-6 py-2 text-xs font-black text-[var(--accent-foreground)] transition-all shadow-2xs inline-flex items-center gap-2 disabled:opacity-50"
              >
                {pending && (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* SAVE CHANGES CONFIRMATION MODAL (Matching Host Permission Modal UI Exactly) */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-[var(--foreground)] p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-[var(--foreground)]">
              Confirm Permission Changes
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              You are updating access settings for <strong>{summary.adminName || summary.adminEmail}</strong> (
              #{summary.adminId}). Updating permissions will immediately adjust what this admin can access on the platform and write to the audit log.
            </p>

            <div className="bg-[var(--surface-secondary)] p-3 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold">
              Pending Changes ({changedSlugs.length}):
              <ul className="mt-1 space-y-1 font-mono text-[11px] text-[var(--muted-foreground)] max-h-32 overflow-y-auto">
                {changedSlugs.map((slug) => (
                  <li key={slug}>
                    • {slug} → <strong className="text-[var(--foreground)]">{stagedOverrides[slug]}</strong>
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
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Specify reason for changing permissions..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] p-2.5 text-xs outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                disabled={pending}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={pending}
                className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 py-2 font-extrabold text-[var(--accent-foreground)] shadow-2xs inline-flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {pending && (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                <span>{pending ? "Saving Changes..." : "Confirm & Save Changes"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET TO DEFAULTS CONFIRMATION MODAL (Matching Host Permission Modal UI Exactly) */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-[var(--foreground)] p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-[var(--foreground)]">
              Reset Admin Permissions
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              This will remove all custom permission overrides for{" "}
              <strong>{summary.adminName || summary.adminEmail}</strong> and restore the admin to the default <strong>{summary.roleName}</strong> permissions baseline.
            </p>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-900 dark:text-amber-300 font-medium">
              ℹ️ Note: This will not change account status or delete any admin user data.
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1">
                Reason / Note (Optional)
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for resetting permissions..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] p-2.5 text-xs outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={pending}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={pending}
                className="rounded-full bg-rose-600 hover:bg-rose-700 px-5 py-2 font-extrabold text-white shadow-2xs inline-flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {pending && (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                <span>{pending ? "Resetting..." : "Reset to Defaults"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
