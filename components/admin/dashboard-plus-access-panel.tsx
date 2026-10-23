"use client";

import React, { useState, useTransition } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";
import type {
  HostDashboardEntitlements,
  HostDashboardGrantDetails,
} from "@/lib/entitlements/host-dashboard";
import {
  grantComplimentaryPlusAction,
  revokeComplimentaryPlusAction,
  setStandardOnlyAction,
  updateGrantExpirationAction,
} from "@/actions/admin/hostEntitlementActions";

interface DashboardPlusAccessPanelProps {
  hostId: string;
  hostName: string | null;
  hostEmail: string | null;
  hostStatus: string;
  initialEntitlements?: HostDashboardEntitlements;
  initialGrantHistory?: HostDashboardGrantDetails[];
  onEntitlementsUpdated?: (entitlements: HostDashboardEntitlements) => void;
}

type ModalType =
  | "grant_complimentary"
  | "grant_temporary"
  | "change_expiry"
  | "revoke"
  | "standard_only"
  | null;

export function DashboardPlusAccessPanel({
  hostId,
  hostName,
  hostEmail,
  hostStatus,
  initialEntitlements,
  initialGrantHistory = [],
  onEntitlementsUpdated,
}: DashboardPlusAccessPanelProps) {
  const [entitlements, setEntitlements] = useState<HostDashboardEntitlements | undefined>(
    initialEntitlements,
  );
  const [grantHistory, setGrantHistory] = useState<HostDashboardGrantDetails[]>(
    initialGrantHistory,
  );
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isPending, startTransition] = useTransition();

  // Form states
  const [startDate, setStartDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const activeGrant = entitlements?.grantDetails?.status === "ACTIVE"
    ? entitlements.grantDetails
    : grantHistory.find((g) => g.status === "ACTIVE") ?? null;

  const currentAccess = entitlements?.hasDashboardPlus ? "Plus" : "Standard";
  const accessSourceDisplay =
    entitlements?.source === "SUBSCRIPTION"
      ? "Paid Subscription"
      : entitlements?.source === "ADMIN"
      ? "Admin Grant"
      : entitlements?.source === "PROFILE"
      ? "Account Profile"
      : "None (Default)";

  const grantStatusDisplay = activeGrant
    ? activeGrant.expiresAt && new Date(activeGrant.expiresAt).getTime() <= Date.now()
      ? "Expired"
      : new Date(activeGrant.startsAt).getTime() > Date.now()
      ? "Scheduled"
      : "Active"
    : grantHistory[0]?.status === "REVOKED"
    ? "Revoked"
    : grantHistory[0]?.expiresAt && new Date(grantHistory[0].expiresAt).getTime() <= Date.now()
    ? "Expired"
    : "None";

  const expiryDisplay = activeGrant?.expiresAt
    ? new Date(activeGrant.expiresAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : activeGrant
    ? "Never (Permanent)"
    : "N/A";

  const lastUpdateDisplay = activeGrant
    ? new Date(activeGrant.updatedAt || activeGrant.createdAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : grantHistory[0]
    ? new Date(grantHistory[0].updatedAt || grantHistory[0].createdAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Never updated";

  const lastAdminDisplay = activeGrant
    ? activeGrant.grantedByAdmin?.name || activeGrant.grantedByAdmin?.email || "Administrator"
    : grantHistory[0]?.revokedByAdmin
    ? `Revoked by ${grantHistory[0].revokedByAdmin.name || grantHistory[0].revokedByAdmin.email}`
    : grantHistory[0]?.grantedByAdmin
    ? grantHistory[0].grantedByAdmin.name || grantHistory[0].grantedByAdmin.email || "Administrator"
    : "System Default";

  function openModal(type: ModalType) {
    setActiveModal(type);
    setReason("");
    setNotes("");
    if (type === "change_expiry" && activeGrant?.expiresAt) {
      const d = new Date(activeGrant.expiresAt);
      const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setExpiryDate(iso);
    } else {
      setExpiryDate("");
    }
    setStartDate("");
  }

  function closeModal() {
    if (isPending) return;
    setActiveModal(null);
  }

  function handleGrantComplimentary() {
    startTransition(async () => {
      const res = await grantComplimentaryPlusAction({
        hostId,
        expiresAt: null,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (!res.ok) {
        toast.error(res.error);
      } else {
        setEntitlements(res.data.entitlements);
        setGrantHistory(res.data.grantHistory);
        onEntitlementsUpdated?.(res.data.entitlements);
        toast.success("Complimentary Dashboard Plus granted immediately.");
        closeModal();
      }
    });
  }

  function handleGrantTemporary() {
    if (!expiryDate) {
      toast.error("Please specify an expiration date.");
      return;
    }

    startTransition(async () => {
      const res = await grantComplimentaryPlusAction({
        hostId,
        startsAt: startDate ? new Date(startDate).toISOString() : undefined,
        expiresAt: new Date(expiryDate).toISOString(),
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (!res.ok) {
        toast.error(res.error);
      } else {
        setEntitlements(res.data.entitlements);
        setGrantHistory(res.data.grantHistory);
        onEntitlementsUpdated?.(res.data.entitlements);
        toast.success("Temporary Dashboard Plus access granted.");
        closeModal();
      }
    });
  }

  function handleChangeExpiry() {
    startTransition(async () => {
      const res = await updateGrantExpirationAction({
        hostId,
        expiresAt: expiryDate ? new Date(expiryDate).toISOString() : null,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (!res.ok) {
        toast.error(res.error);
      } else {
        setEntitlements(res.data.entitlements);
        setGrantHistory(res.data.grantHistory);
        onEntitlementsUpdated?.(res.data.entitlements);
        toast.success("Expiration date updated.");
        closeModal();
      }
    });
  }

  function handleRevoke() {
    startTransition(async () => {
      const res = await revokeComplimentaryPlusAction({
        hostId,
        reason: reason.trim() || undefined,
      });

      if (!res.ok) {
        toast.error(res.error);
      } else {
        setEntitlements(res.data.entitlements);
        setGrantHistory(res.data.grantHistory);
        onEntitlementsUpdated?.(res.data.entitlements);
        toast.success("Complimentary Dashboard Plus access revoked.");
        closeModal();
      }
    });
  }

  function handleStandardOnly() {
    startTransition(async () => {
      const res = await setStandardOnlyAction({
        hostId,
        reason: reason.trim() || undefined,
      });

      if (!res.ok) {
        toast.error(res.error);
      } else {
        setEntitlements(res.data.entitlements);
        setGrantHistory(res.data.grantHistory);
        onEntitlementsUpdated?.(res.data.entitlements);
        toast.success("Host access set to Standard Only.");
        closeModal();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Dashboard Plus Access Card */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-muted-foreground">
                Dashboard Plus Access
              </h2>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  entitlements?.hasDashboardPlus
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                    : "bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                }`}
              >
                {entitlements?.hasDashboardPlus ? "Plus Active" : "Standard Tier"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Manage complimentary entitlements, review subscription sources, and configure time-limited Plus access.
            </p>
          </div>

          {/* Quick status pill */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)] font-mono">
              Access Status:
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {entitlements?.accessStatus || "Standard"}
            </span>
          </div>
        </div>

        {/* Detailed Fields Grid */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/50 p-4">
            <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              Host Identifier
            </p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground truncate">
              {hostName || "Unnamed Host"}
            </p>
            <p className="mt-0.5 text-[11px] font-mono text-[var(--muted-foreground)] truncate">
              {hostId}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/50 p-4">
            <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              Current Dashboard Tier
            </p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {currentAccess === "Plus" ? "Dashboard Plus" : "Standard Dashboard"}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
              Subscription: {entitlements?.status || "None"}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/50 p-4">
            <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              Effective Entitlement
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  entitlements?.hasDashboardPlus ? "bg-emerald-500" : "bg-zinc-400"
                }`}
              />
              <p className="text-sm font-semibold text-muted-foreground">
                {entitlements?.hasDashboardPlus ? "Granted" : "Not Granted"}
              </p>
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
              Source: {accessSourceDisplay}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/50 p-4">
            <p className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              Complimentary Expiration
            </p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground truncate">
              {expiryDisplay}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
              Status: {grantStatusDisplay}
            </p>
          </div>
        </div>

        {/* Audit Meta Information */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/30 px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
            <span className="font-semibold text-muted-foreground">Last Permission Update:</span>
            <span>{lastUpdateDisplay}</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
            <span className="font-semibold text-muted-foreground">Modified By:</span>
            <span>{lastAdminDisplay}</span>
          </div>
        </div>

        {/* Admin Controls Action Bar */}
        <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
          <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
            Admin Entitlement Controls
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {/* Option 2: Grant Complimentary Plus */}
            <button
              type="button"
              onClick={() => openModal("grant_complimentary")}
              disabled={isPending}
              className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-semibold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              Grant Complimentary Plus
            </button>

            {/* Option 3: Grant Temporary Plus */}
            <button
              type="button"
              onClick={() => openModal("grant_temporary")}
              disabled={isPending}
              className="rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 text-xs font-semibold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              Grant Temporary Plus
            </button>

            {/* Change Expiration (if active grant exists) */}
            {activeGrant && (
              <button
                type="button"
                onClick={() => openModal("change_expiry")}
                disabled={isPending}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-4 py-2 text-xs font-semibold text-muted-foreground transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                Change Expiration
              </button>
            )}

            {/* Option 4: Revoke Complimentary Access */}
            {activeGrant && (
              <button
                type="button"
                onClick={() => openModal("revoke")}
                disabled={isPending}
                className="rounded-full border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 px-4 py-2 text-xs font-semibold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                Revoke Complimentary Access
              </button>
            )}

            {/* Option 1: Standard Only */}
            <button
              type="button"
              onClick={() => openModal("standard_only")}
              disabled={isPending}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-4 py-2 text-xs font-semibold text-muted-foreground transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              Standard Only
            </button>
          </div>
        </div>
      </section>

      {/* Grant History Log */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">
              Permission & Grant History
            </h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Historical record of all complimentary grants, temporary expirations, and admin revocations.
            </p>
          </div>
          <span className="text-xs font-mono text-[var(--muted-foreground)]">
            Total Grants: {grantHistory.length}
          </span>
        </div>

        {grantHistory.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--muted-foreground)]">
            No previous complimentary grant records found for this host.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Expiration</th>
                  <th className="py-2.5 px-3">Granted By</th>
                  <th className="py-2.5 px-3">Revoked By</th>
                  <th className="py-2.5 px-3">Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {grantHistory.map((grant) => (
                  <tr key={grant.id} className="hover:bg-[var(--surface-secondary)]/50 transition-colors">
                    <td className="py-3 px-3 font-mono text-[11px] text-[var(--muted-foreground)]">
                      {new Date(grant.createdAt).toLocaleDateString("en-US")}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          grant.status === "ACTIVE"
                            ? grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now()
                              ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {grant.status === "ACTIVE"
                          ? grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now()
                            ? "Expired"
                            : "Active"
                          : "Revoked"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground font-medium">
                      {grant.expiresAt ? "Temporary" : "Complimentary"}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-[var(--muted-foreground)]">
                      {grant.expiresAt
                        ? new Date(grant.expiresAt).toLocaleDateString("en-US")
                        : "Never (Indefinite)"}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {grant.grantedByAdmin?.name || grant.grantedByAdmin?.email || "Admin"}
                    </td>
                    <td className="py-3 px-3 text-[var(--muted-foreground)]">
                      {grant.revokedByAdmin
                        ? grant.revokedByAdmin.name || grant.revokedByAdmin.email
                        : grant.status === "REVOKED"
                        ? "System / Admin"
                        : "—"}
                    </td>
                    <td className="py-3 px-3 text-[var(--muted-foreground)] max-w-xs truncate" title={grant.reason || grant.notes || ""}>
                      {grant.reason || grant.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Confirmation Modals */}

      {/* 1. Grant Complimentary Modal */}
      {activeModal === "grant_complimentary" && (
        <ModalOverlay className="fixed inset-0 z-999 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in" onMouseDown={closeModal}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-muted-foreground">
              Grant Complimentary Dashboard Plus
            </h3>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              This gives <strong>{hostName || hostEmail || "this host"}</strong> full complimentary access to all Dashboard Plus features without requiring payment. No subscription checkout or payment transaction is created.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Reason for access (optional)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. VIP Host Partnership, Support Compensation..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-muted-foreground outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Internal admin notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional notes for administrative tracking..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-muted-foreground outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGrantComplimentary}
                disabled={isPending}
                className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Granting..." : "Confirm & Grant Access"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 2. Grant Temporary Modal */}
      {activeModal === "grant_temporary" && (
        <ModalOverlay className="fixed inset-0 z-999 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in" onMouseDown={closeModal}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-muted-foreground">
              Grant Temporary Dashboard Plus Access
            </h3>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Configure time-limited complimentary access. Once the expiration date passes, complimentary Plus access ends automatically.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Expiration Date & Time (required)
                </label>
                <input
                  type="datetime-local"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-muted-foreground outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Start Date (optional, defaults to immediately)
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-muted-foreground outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Reason for access (optional)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. 30-day trial extension, promotional incentive..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-muted-foreground outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Internal admin notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Internal notes..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-muted-foreground outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGrantTemporary}
                disabled={isPending || !expiryDate}
                className="rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Granting..." : "Confirm Temporary Access"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 3. Change Expiry Modal */}
      {activeModal === "change_expiry" && (
        <ModalOverlay className="fixed inset-0 z-999 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in" onMouseDown={closeModal}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-muted-foreground">
              Update Expiration Date
            </h3>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Modify the expiration date for this complimentary grant. Leave empty to convert to indefinite (permanent) complimentary access.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  New Expiration Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-muted-foreground outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setExpiryDate("")}
                  className="mt-1 text-[11px] text-amber-600 hover:underline"
                >
                  Clear date (make permanent)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Reason for change (optional)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Extended by 14 days upon request..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-muted-foreground outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleChangeExpiry}
                disabled={isPending}
                className="rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Updating..." : "Update Expiration"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 4. Revoke Complimentary Modal */}
      {activeModal === "revoke" && (
        <ModalOverlay className="fixed inset-0 z-999 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in" onMouseDown={closeModal}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-muted-foreground">
              Revoke Complimentary Access
            </h3>

            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900/50 p-3 text-xs text-rose-800 dark:text-rose-300">
              <p className="font-semibold">Impact Warning</p>
              <p className="mt-1 leading-relaxed">
                Revoking will immediately remove complimentary Plus entitlement. If the host also has an independent active paid subscription, that paid entitlement is preserved. All historical host analytics, bookings, and financial records remain intact.
              </p>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Reason for revocation (optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Promotion period ended, administrative audit..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-muted-foreground outline-none focus:border-amber-500"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={isPending}
                className="rounded-full bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Revoking..." : "Confirm Revocation"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* 5. Standard Only Modal */}
      {activeModal === "standard_only" && (
        <ModalOverlay className="fixed inset-0 z-999 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in" onMouseDown={closeModal}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-muted-foreground">
              Set Host to Standard Only
            </h3>
            <p className="mt-2 text-xs text-[var(--muted-foreground)] leading-relaxed">
              This option ensures the host has access to Standard Dashboard features. Any admin-granted complimentary Plus access is revoked. If the host also has an active paid Plus subscription, that paid entitlement will NOT be cancelled or overridden.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Reason for change (optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Standard account reset..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-muted-foreground outline-none focus:border-amber-500"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStandardOnly}
                disabled={isPending}
                className="rounded-full bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 px-4 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isPending ? "Applying..." : "Confirm Standard Only"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

