"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma detail payload has target-specific shapes. */

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";

type Details = any;
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
function formatDate(value: string | Date | null | undefined) { return value ? dateTime.format(new Date(value)) : "—"; }
function title(value: string) { return value.replaceAll("_", " "); }
function badge(value: string) { return value === "RESOLVED" ? "bg-emerald-100 text-emerald-800" : value === "DISMISSED" ? "bg-slate-200 text-slate-700" : value === "CRITICAL" ? "bg-red-100 text-red-800" : value === "HIGH" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"; }

export function AdminModerationCaseDetailsClient({ initialDetails, canUpdate, canAssign, canDecide }: { initialDetails: Details; canUpdate: boolean; canAssign: boolean; canDecide: boolean }) {
  const router = useRouter(); const [details, setDetails] = useState(initialDetails); const caseRecord = details.case;
  const [moderators, setModerators] = useState<any[]>([]); const [note, setNote] = useState(""); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ status: string; resolutionCategory?: string; resolutionNotes?: string } | null>(null);
  useEffect(() => { if (!canAssign) return; fetch("/api/v1/admin/moderation/moderators").then(async (response) => response.ok ? response.json() : null).then((payload) => payload && setModerators(payload.data || [])).catch(() => undefined); }, [canAssign]);
  const refresh = async () => { const response = await fetch(`/api/v1/admin/moderation/cases/${caseRecord.id}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || "Could not refresh the case."); setDetails(payload.data); router.refresh(); };
  const update = async (input: Record<string, unknown>) => { setSaving(true); setError(null); try { const response = await fetch(`/api/v1/admin/moderation/cases/${caseRecord.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, expectedUpdatedAt: new Date(caseRecord.updatedAt).toISOString() }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || "Unable to update the case."); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to update the case."); } finally { setSaving(false); setConfirm(null); } };
  const addNote = async (event: FormEvent) => { event.preventDefault(); if (!note.trim()) return; setSaving(true); setError(null); try { const response = await fetch(`/api/v1/admin/moderation/cases/${caseRecord.id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || "Unable to add note."); setNote(""); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : "Unable to add note."); } finally { setSaving(false); } };
  const target = details.target?.data; const closed = ["RESOLVED", "DISMISSED"].includes(caseRecord.status);

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/admin/moderation/cases" className="text-sm font-medium text-indigo-700 hover:underline">← Moderation cases</Link><h1 className="mt-2 text-2xl font-semibold text-slate-900">{caseRecord.caseReference}</h1><p className="mt-1 text-sm text-slate-600">Content moderation investigation · no enforcement action is applied from this screen.</p></div><span className={`rounded-full px-3 py-1 text-sm font-semibold ${badge(caseRecord.status)}`}>{title(caseRecord.status)}</span></div>
    {error && <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold text-slate-900">Case summary</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{[["Content type", title(caseRecord.targetType)], ["Category", caseRecord.category], ["Reports", String(caseRecord._count.reports)], ["Created", formatDate(caseRecord.createdAt)], ["Last activity", formatDate(caseRecord.updatedAt)], ["Resolved", formatDate(caseRecord.resolvedAt)]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-900">{value}</dd></div>)}</dl></section>
        <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold text-slate-900">Reported content</h2>{!details.target?.available ? <p className="mt-3 text-sm text-slate-500">This content is unavailable or has been deleted. The case history is preserved.</p> : <TargetPreview targetType={caseRecord.targetType} data={target} />}</section>
        <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold text-slate-900">Individual reports <span className="text-slate-500">({caseRecord.reports.length})</span></h2><div className="mt-4 space-y-3">{caseRecord.reports.map((report: any) => <article key={report.id} className="rounded-lg border border-slate-200 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{report.reasonCode.replaceAll("_", " ")}</p><time className="text-slate-500">{formatDate(report.createdAt)}</time></div><p className="mt-1 text-slate-600">{report.description || "No additional report description."}</p><p className="mt-2 text-xs text-slate-500">Reporter: {report.reporter?.name || report.reporter?.email || "Unavailable"}{report.relatedBooking ? ` · Booking ${report.relatedBooking.id}` : ""}</p></article>)}{!caseRecord.reports.length && <p className="text-sm text-slate-500">No reports are linked to this case.</p>}</div></section>
        <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold text-slate-900">Evidence</h2><div className="mt-4 space-y-3">{caseRecord.evidence.map((evidence: any) => <div key={evidence.id} className="rounded-lg border border-slate-200 p-3 text-sm"><p className="font-medium">{evidence.displayName || title(evidence.evidenceType)}</p><p className="mt-1 text-xs text-slate-500">{title(evidence.evidenceType)} · {formatDate(evidence.createdAt)} · {evidence.accessScope.replaceAll("_", " ")}</p></div>)}{!caseRecord.evidence.length && <p className="text-sm text-slate-500">No evidence has been added. Private file references are not exposed in this dashboard.</p>}</div></section>
        <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold text-slate-900">Investigation timeline</h2><ol className="mt-4 space-y-4 border-l border-slate-200 pl-5">{caseRecord.activities.map((activity: any) => <li key={activity.id} className="relative text-sm before:absolute before:-left-[22px] before:top-1 before:size-2 before:rounded-full before:bg-slate-400"><p className="font-medium text-slate-900">{title(activity.action)}</p><p className="text-slate-600">{activity.actor?.name || activity.actor?.email || "System"} · {formatDate(activity.createdAt)}</p>{activity.metadata?.note && <p className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2 text-slate-700">{activity.metadata.note}</p>}</li>)}{!caseRecord.activities.length && <li className="text-sm text-slate-500">No activity recorded.</li>}</ol></section>
      </div>
      <aside className="space-y-5"><section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Investigation controls</h2><div className="mt-4 space-y-4 text-sm"><label className="block">Severity<select disabled={!canUpdate || saving} value={caseRecord.severity} onChange={(event) => void update({ severity: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="block">Priority<input disabled={!canUpdate || saving} type="number" min="-100" max="100" value={caseRecord.priority} onChange={(event) => void update({ priority: Number(event.target.value) })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>{canAssign && <label className="block">Assigned moderator<select disabled={saving} value={caseRecord.assignedModeratorId || ""} onChange={(event) => void update({ assignedModeratorId: event.target.value || null })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"><option value="">Unassigned</option>{moderators.map((moderator) => <option key={moderator.id} value={moderator.id}>{moderator.name || moderator.email}</option>)}</select></label>}<p className="text-xs text-slate-500">Assigned: {caseRecord.assignedModerator?.name || caseRecord.assignedModerator?.email || "No moderator"}</p></div></section>
        {canUpdate && <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Workflow</h2><div className="mt-3 flex flex-col gap-2">{caseRecord.status === "NEW" && <ActionButton label="Start review" disabled={saving} onClick={() => void update({ status: "IN_REVIEW" })} />}{["NEW", "IN_REVIEW", "REOPENED"].includes(caseRecord.status) && <ActionButton label="Needs information" disabled={saving} onClick={() => void update({ status: "NEEDS_INFORMATION" })} />}{caseRecord.status === "NEEDS_INFORMATION" && <ActionButton label="Resume review" disabled={saving} onClick={() => void update({ status: "IN_REVIEW" })} />}{!closed && <><ActionButton label="Resolve case" disabled={saving || !canDecide} onClick={() => setConfirm({ status: "RESOLVED" })} /><ActionButton label="Dismiss case" disabled={saving || !canDecide} onClick={() => setConfirm({ status: "DISMISSED" })} /></>}{closed && <ActionButton label="Reopen case" disabled={saving} onClick={() => void update({ status: "REOPENED" })} />}</div></section>}
        {canDecide && <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Internal note</h2><form onSubmit={addNote} className="mt-3 space-y-2"><label className="sr-only" htmlFor="moderation-note">Private moderator note</label><textarea id="moderation-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={5000} placeholder="Visible only to permitted moderators" className="min-h-28 w-full rounded-md border border-slate-300 p-2 text-sm" /><button disabled={saving || !note.trim()} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Add private note</button></form></section>}</aside>
    </div>
    {confirm && (
      <DecisionDialog
        status={confirm.status}
        targetType={caseRecord.targetType}
        saving={saving}
        onCancel={() => setConfirm(null)}
        onConfirm={(resolutionCategory, resolutionNotes, reviewAction, listingAction, mediaAction) =>
          void update({ status: confirm.status, resolutionCategory, resolutionNotes, reviewAction, listingAction, mediaAction })
        }
      />
    )}
  </main>;
}

function ActionButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return <button disabled={disabled} onClick={onClick} className="rounded-md border border-slate-300 px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{label}</button>;
}

function DecisionDialog({
  status,
  targetType,
  saving,
  onCancel,
  onConfirm,
}: {
  status: string;
  targetType: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (category: string, notes: string, reviewAction?: string, listingAction?: string, mediaAction?: string) => void;
}) {
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewAction, setReviewAction] = useState("NONE");
  const [listingAction, setListingAction] = useState("NONE");
  const [mediaAction, setMediaAction] = useState("NONE");

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="moderation-decision-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div>
          <h2 id="moderation-decision-title" className="text-lg font-semibold text-slate-900">
            {status === "RESOLVED" ? "Resolve" : "Dismiss"} moderation case
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Record investigation outcome. When content moderation or property action is required, choose the appropriate authorized action below.
          </p>
        </div>

        <label className="block text-xs font-semibold text-slate-700">
          Resolution category <span className="text-red-500">*</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-800"
            required
          >
            <option value="">Select a category</option>
            {["NO_VIOLATION", "VIOLATION_CONFIRMED", "INSUFFICIENT_EVIDENCE", "DUPLICATE_OR_MERGED", "UNABLE_TO_DETERMINE"].map((value) => (
              <option key={value} value={value}>{title(value)}</option>
            ))}
          </select>
        </label>

        {targetType === "REVIEW" && status === "RESOLVED" && (
          <label className="block text-xs font-semibold text-slate-700">
            Review enforcement action
            <select
              value={reviewAction}
              onChange={(e) => setReviewAction(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-800 font-medium"
            >
              <option value="NONE">Keep review published (Decision recorded only)</option>
              <option value="HIDE">Hide review (Removes from listing &amp; recalculates rating)</option>
              <option value="DELETE">Delete / Flag review (Confirmed policy violation)</option>
              <option value="RESTORE">Restore review (Re-incorporates into rating caches)</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Applying Hide or Delete will recalculate property rating averages, refresh Guest Favorite eligibility, and notify the author.
            </span>
          </label>
        )}

        {targetType === "LISTING" && status === "RESOLVED" && (
          <label className="block text-xs font-semibold text-slate-700">
            Listing moderation action
            <select
              value={listingAction}
              onChange={(e) => setListingAction(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-800 font-medium"
            >
              <option value="NONE">No listing action (Decision recorded only)</option>
              <option value="WARN_HOST">Issue compliance warning to host</option>
              <option value="REQUEST_CORRECTION">Request correction / changes from host</option>
              <option value="TEMPORARY_RESTRICTION">Apply temporary restriction (Pause &amp; unlist property)</option>
              <option value="SUSPEND">Suspend listing (Reject &amp; remove from marketplace)</option>
              <option value="RESTORE">Restore listing (Reactivate &amp; publish property)</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Pausing or suspending a listing immediately removes it from search and prevents new reservations, while safely preserving existing confirmed bookings without automatic cancellations.
            </span>
          </label>
        )}

        {targetType === "LISTING_PHOTO" && status === "RESOLVED" && (
          <label className="block text-xs font-semibold text-slate-700">
            Photo moderation action
            <select
              value={mediaAction}
              onChange={(e) => setMediaAction(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-800 font-medium"
            >
              <option value="NONE">Keep photo active (Decision recorded only)</option>
              <option value="REMOVE_PHOTO">Remove photo from listing gallery</option>
              <option value="REQUEST_REPLACEMENT">Request replacement from host</option>
              <option value="RESTORE_PHOTO">Restore photo to listing gallery</option>
              <option value="DISMISS">Dismiss report without changes</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Removing a photo automatically updates gallery ordering. If photos fall below the required 5, change requests will be flagged for the host.
            </span>
          </label>
        )}

        {(targetType === "PROFILE" || targetType === "USER") && status === "RESOLVED" && (
          <label className="block text-xs font-semibold text-slate-700">
            Profile photo moderation action
            <select
              value={mediaAction}
              onChange={(e) => setMediaAction(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-800 font-medium"
            >
              <option value="NONE">Keep avatar (Decision recorded only)</option>
              <option value="REMOVE_PHOTO">Remove avatar (Reset to safe default)</option>
              <option value="RESTORE_PHOTO">Restore prior avatar</option>
              <option value="DISMISS">Dismiss report without changes</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Removing an avatar clears the profile photo and notifies the user with instructions to upload a compliant avatar.
            </span>
          </label>
        )}

        <label className="block text-xs font-semibold text-slate-700">
          Internal decision rationale
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={5000}
            rows={3}
            placeholder="Record policy clauses verified and findings..."
            className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-800"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !category}
            onClick={() => onConfirm(category, notes, reviewAction, listingAction, mediaAction)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Confirm {status === "RESOLVED" ? "Resolution" : "Dismissal"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function TargetPreview({ targetType, data }: { targetType: string; data: any }) {
  if (targetType === "REVIEW") {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
              {data.direction === "HOST_TO_GUEST" ? "Host to Guest Review" : "Guest to Property Review"}
            </span>
            <span className="text-xs text-slate-500">ID: {data.id}</span>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge(data.status)}`}>
            {data.status}
          </span>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <span className="font-semibold text-slate-600">Review Author: </span>
            <span className="text-slate-900">{data.author?.name || "Unknown"} ({data.author?.email || "No email"})</span>
          </div>
          {data.targetUser && (
            <div>
              <span className="font-semibold text-slate-600">Reviewed Subject: </span>
              <span className="text-slate-900">{data.targetUser.name || "Unknown"} ({data.targetUser.email || "No email"})</span>
            </div>
          )}
          {data.listing && (
            <div>
              <span className="font-semibold text-slate-600">Listing: </span>
              <span className="text-slate-900">{data.listing.title} ({data.listing.city || "N/A"})</span>
            </div>
          )}
          {data.booking && (
            <div>
              <span className="font-semibold text-slate-600">Booking: </span>
              <span className="font-mono text-slate-900">{data.bookingId} ({data.booking.status})</span>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white p-3 border border-slate-200">
          <div className="flex items-center gap-1 font-semibold text-amber-600 text-sm">
            <span>★ {data.rating} / 5</span>
            {data.cleanliness && (
              <span className="ml-2 text-xs font-normal text-slate-500">
                (Cleanliness: {data.cleanliness}, Accuracy: {data.accuracy}, Comm: {data.communication}, Location: {data.location}, Value: {data.value})
              </span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-slate-800 text-sm font-normal">
            {data.comment || "No comment provided (rating only)."}
          </p>
        </div>

        {data.response && (
          <div className="rounded-lg bg-indigo-50/70 p-3 border border-indigo-100 text-xs">
            <p className="font-semibold text-indigo-900">
              Public Response from {data.response.user?.name || "Counterpart"}:
            </p>
            <p className="mt-1 text-slate-800 whitespace-pre-wrap">{data.response.content}</p>
          </div>
        )}

        <div className="pt-1 flex gap-3 text-xs font-medium text-indigo-700">
          <Link href={`/admin/moderation/reviews?search=${data.id}`} className="hover:underline">
            Manage in Review Moderation Queue →
          </Link>
          {data.listing?.id && (
            <Link href={`/admin/listings/${data.listing.id}`} className="hover:underline">
              View Property →
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (targetType === "LISTING") {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{data.title}</span>
            <span className="text-xs text-slate-500">ID: {data.id}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            <span className={`rounded-full px-2.5 py-0.5 ${badge(data.status)}`}>
              {data.status}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 ${data.published ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
              {data.published ? "PUBLISHED" : "UNPUBLISHED"}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 ${data.isPaused ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
              {data.isPaused ? "PAUSED" : "ACTIVE"}
            </span>
          </div>
        </div>

        {/* Media & Key Specs */}
        <div className="flex flex-col gap-4 sm:flex-row">
          {data.photos?.[0] ? (
            <div className="flex gap-2 overflow-x-auto shrink-0">
              {data.photos.slice(0, 3).map((photo: string, index: number) => (
                <Image
                  key={index}
                  src={photo}
                  alt={`Listing photo ${index + 1}`}
                  width={140}
                  height={95}
                  className="h-24 w-32 rounded-lg object-cover border border-slate-200"
                  unoptimized
                />
              ))}
            </div>
          ) : (
            <div className="flex h-24 w-32 items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-500">
              No photos
            </div>
          )}

          <div className="space-y-1.5 text-xs">
            <p className="text-sm font-semibold text-slate-900">
              ${(data.price / 100).toFixed(2)} <span className="text-xs font-normal text-slate-500">/ night</span>
            </p>
            <p className="text-slate-700">
              <span className="font-medium text-slate-500">Type: </span>
              {data.propertyType || "Property"} · {data.listingType || "Entire place"}
            </p>
            <p className="text-slate-700">
              <span className="font-medium text-slate-500">Location: </span>
              {data.address ? `${data.address}, ` : ""}{data.city || "Unknown city"}, {data.country || ""}
            </p>
            <p className="text-slate-700">
              <span className="font-medium text-slate-500">Host: </span>
              <span className="font-semibold text-slate-900">{data.host?.name || "Host"}</span> ({data.host?.email || "No email"}) · Status: {data.host?.status || "ACTIVE"}
            </p>
          </div>
        </div>

        {/* Description snippet */}
        {data.description && (
          <div className="rounded-lg bg-white p-3 border border-slate-200 text-xs text-slate-700">
            <span className="font-semibold text-slate-900 block mb-1">Listing Description:</span>
            <p className="line-clamp-3 whitespace-pre-wrap">{data.description}</p>
          </div>
        )}

        {/* Amenities preview */}
        {data.amenities?.length > 0 && (
          <div className="text-xs">
            <span className="font-semibold text-slate-600 mr-2">Amenities:</span>
            <span className="text-slate-700">{data.amenities.slice(0, 8).join(" · ")}{data.amenities.length > 8 ? ` +${data.amenities.length - 8} more` : ""}</span>
          </div>
        )}

        {/* Active & Upcoming Reservations */}
        <div className="rounded-lg bg-white p-3 border border-slate-200 text-xs">
          <p className="font-semibold text-slate-900">
            Active &amp; Upcoming Reservations ({data.bookings?.length || 0})
          </p>
          {data.bookings?.length ? (
            <div className="mt-2 divide-y divide-slate-100">
              {data.bookings.map((booking: any) => (
                <div key={booking.id} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-slate-900">{booking.guest?.name || "Guest"}</span>
                    <span className="text-slate-500 text-[11px] ml-1.5">
                      ({formatDate(booking.startDate)} – {formatDate(booking.endDate)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge(booking.status)}`}>
                      {booking.status}
                    </span>
                    <span className="text-slate-600 font-mono text-[11px]">
                      ${(booking.totalPrice / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-slate-500 text-xs">No active or upcoming reservations on record.</p>
          )}
        </div>

        {/* Prior Quality Incidents */}
        {data.qualityIncidents?.length > 0 && (
          <div className="rounded-lg bg-amber-50/70 p-3 border border-amber-200 text-xs">
            <p className="font-semibold text-amber-900">
              Prior Quality Incidents / Disputes ({data.qualityIncidents.length})
            </p>
            <div className="mt-1.5 space-y-1.5">
              {data.qualityIncidents.map((incident: any) => (
                <div key={incident.id} className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-slate-800">
                    <strong className="text-amber-800">{incident.category}</strong>: {incident.description?.slice(0, 100) || "No description"}
                  </span>
                  <span className="text-slate-500 text-[11px]">{formatDate(incident.createdAt)} · {incident.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prior Moderation Cases */}
        {data.relatedCases?.length > 1 && (
          <div className="rounded-lg bg-indigo-50/70 p-3 border border-indigo-200 text-xs">
            <p className="font-semibold text-indigo-900">
              Other Moderation Cases for this Property ({data.relatedCases.length - 1})
            </p>
            <div className="mt-1.5 space-y-1">
              {data.relatedCases.filter((c: any) => c.id !== data.id).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between">
                  <Link href={`/admin/moderation/cases/${c.id}`} className="text-indigo-700 hover:underline font-medium">
                    {c.caseReference} ({c.category})
                  </Link>
                  <span className="text-slate-500 text-[11px]">{c.status} · {formatDate(c.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-1 flex flex-wrap gap-4 text-xs font-medium text-indigo-700">
          <Link href={`/admin/listings/${data.id}`} className="hover:underline">
            Manage Property in Admin Console →
          </Link>
          <Link href={`/listings/${data.id}`} target="_blank" className="hover:underline">
            View Public Marketplace Listing ↗
          </Link>
        </div>
      </div>
    );
  }

  if (targetType === "LISTING_PHOTO") {
    const isCover = data.photos?.[0] === data.photoUrl;
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
              Listing Photo
            </span>
            {isCover && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                Cover Photo
              </span>
            )}
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${data.isCurrentlyInGallery ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
            {data.isCurrentlyInGallery ? "Active in Gallery" : "Removed / Not in Gallery"}
          </span>
        </div>

        {/* Large Image Preview & Property Meta */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {data.photoUrl ? (
            <div className="relative group overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Image
                src={data.photoUrl}
                alt="Reported listing media"
                width={320}
                height={220}
                className="max-h-60 w-auto rounded-lg object-contain bg-slate-900/5"
                unoptimized
              />
              <div className="p-2 bg-white/90 text-center text-xs font-medium text-slate-600 border-t border-slate-100">
                <a href={data.photoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  View Full Resolution ↗
                </a>
              </div>
            </div>
          ) : (
            <div className="flex h-40 w-56 items-center justify-center rounded-xl bg-slate-200 text-slate-400">
              No Photo Available
            </div>
          )}

          {data.id && (
            <div className="flex-1 space-y-2 text-xs">
              <h3 className="text-base font-semibold text-slate-900">{data.title}</h3>
              <p className="text-slate-600">
                <span className="font-medium text-slate-700">Host:</span> {data.host?.name || "Host"} ({data.host?.email || "No email"})
              </p>
              <p className="text-slate-600">
                <span className="font-medium text-slate-700">Listing Status:</span> {data.status} · {data.published ? "Published" : "Unpublished"} {data.isPaused ? "(Paused)" : ""}
              </p>
              <p className="text-slate-600">
                <span className="font-medium text-slate-700">Gallery Total:</span> {data.photos?.length ?? 0} photos
              </p>

              <div className="pt-2 flex flex-wrap gap-3">
                <Link href={`/admin/listings/${data.id}`} className="font-medium text-indigo-700 hover:underline">
                  Manage Property in Admin Console →
                </Link>
                <Link href={`/listings/${data.id}`} target="_blank" className="font-medium text-indigo-700 hover:underline">
                  View Public Listing ↗
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Gallery Thumbnails Comparison */}
        {data.photos && data.photos.length > 0 && (
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">
              Listing Gallery Context ({data.photos.length} photos)
            </p>
            <div className="flex flex-wrap gap-2">
              {data.photos.map((url: string, index: number) => {
                const isReported = url === data.photoUrl;
                return (
                  <div
                    key={index}
                    className={`relative rounded-lg overflow-hidden border-2 ${isReported ? "border-red-500 ring-2 ring-red-400" : "border-slate-200"}`}
                  >
                    <Image
                      src={url}
                      alt={`Photo ${index + 1}`}
                      width={64}
                      height={48}
                      className="h-12 w-16 object-cover"
                      unoptimized
                    />
                    {isReported && (
                      <span className="absolute bottom-0 inset-x-0 bg-red-600 text-white text-[9px] text-center font-bold">
                        Reported
                      </span>
                    )}
                    {index === 0 && !isReported && (
                      <span className="absolute top-0 left-0 bg-black/60 text-white text-[8px] px-1 rounded-br">
                        Cover
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (targetType === "USER" || targetType === "PROFILE") {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
            User Profile
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${data.photoUrl ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
            {data.photoUrl ? "Active Avatar" : "No Avatar / Removed"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {data.photoUrl ? (
            <div className="relative size-20 overflow-hidden rounded-full border-2 border-slate-300">
              <Image
                src={data.photoUrl}
                alt="Profile photo"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full bg-slate-200 text-2xl font-bold text-slate-500">
              {data.name?.[0]?.toUpperCase() || "U"}
            </div>
          )}
          <div className="space-y-1 text-xs">
            <p className="text-base font-semibold text-slate-900">{data.name || "Unnamed user"}</p>
            <p className="text-slate-600">{data.email}</p>
            <p className="text-slate-500">Role: <span className="font-medium text-slate-700">{data.role}</span> · Status: <span className="font-medium text-slate-700">{data.status}</span></p>
            <p className="text-slate-500">Joined: {formatDate(data.createdAt)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (targetType === "MESSAGE") {
    return (
      <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
        <p className="whitespace-pre-wrap">{data.content}</p>
        <p className="mt-2 text-xs text-slate-500">Sender: {data.sender?.name || data.sender?.email || "Unavailable"} · {formatDate(data.createdAt)}</p>
      </div>
    );
  }

  return <p className="mt-3 text-sm text-slate-500">A safe preview is unavailable for this content type.</p>;
}

