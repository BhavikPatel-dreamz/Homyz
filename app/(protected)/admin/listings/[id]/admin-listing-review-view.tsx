"use client";

import { useState } from "react";
import { toast } from "@/components/ui/toast";
import {
  adminModerateListingQualityAction,
  adminToggleDisableListingAction,
  adminToggleFeatureListingAction,
  adminToggleVisibilityAction,
  getAdminListingAuditHistoryAction,
} from "@/actions/admin/listingActions";

type ListingReviewData = {
  id: string;
  title: string;
  status: string;
  published: boolean;
  isPaused: boolean;
  isFeatured: boolean;
  rejectionReason?: string | null;
  approvedAt?: Date | string | null;
};

export type ListingAuditItem = {
  id: string;
  action: string;
  description: string;
  actorEmail: string | null;
  createdAt: string;
};

function getStatusLabel(listing: ListingReviewData) {
  if (listing.isPaused) return "Paused";
  if (listing.published) return "Published";
  if (listing.status === "ACTIVE" || listing.status === "APPROVED") return "Unpublished (Approved)";
  if (listing.status === "PENDING_REVIEW") return "Pending review";
  if (listing.status === "CHANGES_REQUESTED") return "Changes requested";
  if (listing.status === "REJECTED") return "Rejected";
  if (listing.status === "DRAFT") return "Draft";
  if (listing.status === "IN_PROGRESS") return "In progress";
  return listing.status ? listing.status.replace(/_/g, " ") : "Unpublished";
}

export function AdminListingReviewView({
  listing,
  missingRequirements,
  auditLogs,
  auditTotal,
  auditOnly = false,
  canApprove,
  canSuspend,
  canEdit,
  onNavigate,
  onListingChange,
}: {
  listing: ListingReviewData;
  missingRequirements: Array<{ section: string; label: string }>;
  auditLogs: ListingAuditItem[];
  auditTotal: number;
  auditOnly?: boolean;
  canApprove: boolean;
  canSuspend: boolean;
  canEdit: boolean;
  onNavigate: (section: string) => void;
  onListingChange: (change: Partial<ListingReviewData>) => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditItems, setAuditItems] = useState(auditLogs);
  const [auditLoading, setAuditLoading] = useState(false);
  const auditPageSize = 10;
  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / auditPageSize));

  async function changeAuditPage(nextPage: number) {
    if (nextPage < 1 || nextPage > auditTotalPages || auditLoading) return;
    setAuditLoading(true);
    const result = await getAdminListingAuditHistoryAction({ listingId: listing.id, page: nextPage, pageSize: auditPageSize });
    setAuditLoading(false);
    if (!result.ok) {
      const msg = result.error || "Unable to load audit history.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setAuditItems(result.data.items);
    setAuditPage(result.data.page);
  }

  async function run(
    action: string,
    task: () => Promise<{ ok: boolean; data?: Partial<ListingReviewData>; error?: string }>,
  ) {
    setSaving(action);
    setError(null);
    const result = await task();
    setSaving(null);
    if (!result?.ok) {
      const msg = result?.error || "Unable to update this listing.";
      setError(msg);
      toast.error(msg);
      return;
    }
    const successMessages: Record<string, string> = {
      approve: "Listing approved and published successfully.",
      unpublish: "Listing unpublished successfully.",
      publish: "Listing published successfully.",
      pause: result.data?.isPaused ? "Listing paused." : "Listing resumed.",
      feature: result.data?.isFeatured ? "Listing marked as featured." : "Listing removed from featured.",
      changes: "Requested changes sent to host.",
      reject: "Listing rejected.",
    };
    toast.success(successMessages[action] || "Listing updated successfully.");
    if (result.data) onListingChange(result.data);
  }

  if (auditOnly) {
    return <section className="space-y-4 animate-in fade-in">
      <div><p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Admin review</p><h1 className="mt-1">Listing audit history</h1><p className="mt-1">Listing-only administrative actions. Sensitive guide data is never recorded here.</p></div>
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
        {auditItems.length === 0 ? <p className="p-5 text-xs text-[var(--muted-foreground)]">No listing administration activity yet.</p> : <ul className="divide-y divide-[var(--border-subtle)]">{auditItems.map((item) => <li key={item.id} className="flex gap-3 p-4"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-500" /><div className="min-w-0"><p className="text-xs font-semibold text-[var(--foreground)]">{item.description}</p><p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{item.actorEmail || "System"} · {new Date(item.createdAt).toLocaleString()}</p></div></li>)}</ul>}
        {auditTotal > auditPageSize && <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-4 py-3"><p className="text-[11px] text-[var(--muted-foreground)]">Page {auditPage} of {auditTotalPages} · {auditTotal} entries</p><div className="flex gap-2"><button type="button" onClick={() => changeAuditPage(auditPage - 1)} disabled={auditPage === 1 || auditLoading} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold disabled:opacity-40">Previous</button><button type="button" onClick={() => changeAuditPage(auditPage + 1)} disabled={auditPage === auditTotalPages || auditLoading} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold disabled:opacity-40">{auditLoading ? "Loading…" : "Next"}</button></div></div>}
      </div>
    </section>;
  }

  return <section className="space-y-5 animate-in fade-in">
    <div><p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Admin review</p><h1 className="mt-1">Review & listing controls</h1><p className="mt-1">Review completeness and manage this property’s approval, visibility, and placement.</p></div>
    {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2>Review summary</h2><p className="mt-1">{missingRequirements.length ? `${missingRequirements.length} required item${missingRequirements.length === 1 ? "" : "s"} need attention.` : "All shared listing requirements are complete."}</p></div><span className={`rounded-full px-3 py-1 text-[11px] font-bold ${missingRequirements.length ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>{missingRequirements.length ? "ACTION NEEDED" : "READY TO REVIEW"}</span></div>
      {missingRequirements.length > 0 && <div className="mt-4 divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border)]">{missingRequirements.map((item) => <button type="button" key={item.section} onClick={() => onNavigate(item.section)} className="flex w-full items-center justify-between px-3 py-3 text-left text-xs hover:bg-[var(--surface-secondary)]"><span>{item.label}</span><span className="text-[var(--muted-foreground)]">Open →</span></button>)}</div>}
    </div>
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
      <h2>Approval & publication</h2>
      <p className="mt-1 flex items-center gap-2">
        <span>Current status:</span>
        <strong
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
            listing.isPaused
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              : listing.published
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : listing.status === "ACTIVE" || listing.status === "APPROVED"
              ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
              : listing.status === "PENDING_REVIEW"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
              : listing.status === "REJECTED"
              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          {getStatusLabel(listing)}
        </strong>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {canApprove && (
          <button
            type="button"
            disabled={saving !== null || missingRequirements.length > 0 || (listing.status !== "PENDING_REVIEW" && listing.status !== "DRAFT") || listing.published}
            onClick={() => run("approve", () => adminModerateListingQualityAction({ listingId: listing.id, action: "APPROVE" }))}
            className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving === "approve" ? "Approving…" : "Approve"}
          </button>
        )}
        {canApprove && (
          <button
            type="button"
            disabled={saving !== null || !listing.published}
            onClick={() => run("unpublish", () => adminToggleVisibilityAction({ listingId: listing.id, published: false }))}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {saving === "unpublish" ? "Unpublishing…" : "Unpublish"}
          </button>
        )}
        {canApprove && (
          <button
            type="button"
            disabled={saving !== null || listing.published || missingRequirements.length > 0}
            onClick={() => run("publish", () => adminToggleVisibilityAction({ listingId: listing.id, published: true }))}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {saving === "publish" ? "Publishing…" : "Publish"}
          </button>
        )}
        {canSuspend && (
          <button
            type="button"
            disabled={saving !== null}
            onClick={() => run("pause", () => adminToggleDisableListingAction({ listingId: listing.id, isPaused: !listing.isPaused }))}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {saving === "pause" ? "Updating…" : listing.isPaused ? "Resume" : "Pause / unlist"}
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            disabled={saving !== null}
            onClick={() => run("feature", () => adminToggleFeatureListingAction({ listingId: listing.id, isFeatured: !listing.isFeatured }))}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {saving === "feature" ? "Updating…" : listing.isFeatured ? "Unfeature" : "Feature property"}
          </button>
        )}
      </div>
    </div>
    {canApprove && (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
        <h2>Request changes or reject</h2>
        <p className="mt-1">Provide listing-specific feedback for the host.</p>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-3 w-full"
          rows={4}
          placeholder="Describe the required listing changes…"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving !== null || !reason.trim() || listing.status !== "PENDING_REVIEW"}
            onClick={() => run("changes", () => adminModerateListingQualityAction({ listingId: listing.id, action: "REQUEST_CHANGES", reason }))}
            className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 disabled:opacity-50 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800"
          >
            {saving === "changes" ? "Submitting…" : "Request changes"}
          </button>
          <button
            type="button"
            disabled={saving !== null || !reason.trim() || listing.status !== "PENDING_REVIEW"}
            onClick={() => run("reject", () => adminModerateListingQualityAction({ listingId: listing.id, action: "REJECT", reason }))}
            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800"
          >
            {saving === "reject" ? "Rejecting…" : "Reject listing"}
          </button>
        </div>
      </div>
    )}
  </section>;
}
