"use client";

import { useState } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { AdminPagination } from "./admin-pagination";

export type ReferralRewardRow = {
  id: string;
  inviter: { id: string; name: string | null; email: string | null };
  referredGuest: { id: string; name: string | null; email: string | null };
  points: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date | string;
  reviewedAt: Date | string | null;
  rejectionReason: string | null;
  reviewer: { id: string; name: string | null; email: string | null } | null;
  qualifyingBooking: { id: string; endDate: Date | string; status: string };
};

type Props = {
  initialItems: ReferralRewardRow[];
  initialTotal: number;
  canReview: boolean;
};

const labels = { PENDING: "Pending approval", APPROVED: "Credited", REJECTED: "Not approved" } as const;
const badgeStyle = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
} as const;

function formatDate(value: Date | string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "—";
}

function userLabel(user: { name: string | null; email: string | null }) {
  return user.name?.trim() || user.email || "Unknown user";
}

export function ReferralRewardsTable({ initialItems, initialTotal, canReview }: Props) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [status, setStatus] = useState<"ALL" | ReferralRewardRow["status"]>("PENDING");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ReferralRewardRow | null>(null);
  const [reason, setReason] = useState("");

  const load = async (nextPage = page, nextStatus = status) => {
    const params = new URLSearchParams({ page: String(nextPage), limit: "20" });
    if (nextStatus !== "ALL") params.set("status", nextStatus);
    const response = await fetch(`/api/v1/admin/referrals?${params}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "Unable to load referral credits.");
    setItems(payload.data);
    setTotal(payload.pagination.total);
    setPage(nextPage);
  };

  const changeStatus = async (nextStatus: typeof status) => {
    setStatus(nextStatus);
    try { await load(1, nextStatus); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to load referral credits."); }
  };

  const submitReview = async (row: ReferralRewardRow, action: "approve" | "reject", rejectionReason?: string) => {
    setBusyId(row.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/admin/referrals/${row.id}/${action}`, {
        method: "POST",
        headers: action === "reject" ? { "Content-Type": "application/json" } : undefined,
        body: action === "reject" ? JSON.stringify({ reason: rejectionReason }) : undefined,
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "Unable to review referral credit.");
      setRejecting(null);
      setReason("");
      setNotice(action === "approve" ? "Referral points have been credited." : "Referral credit was not approved.");
      await load(page, status);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to review referral credit.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-muted-foreground">Referral credits</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Review qualified stays before referral points are credited.</p>
        </div>
        <label className="text-sm font-medium text-[var(--muted-foreground)]">
          Status
          <select value={status} onChange={(event) => void changeStatus(event.target.value as typeof status)} className="ml-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-muted-foreground">
            <option value="PENDING">Pending approval</option>
            <option value="APPROVED">Credited</option>
            <option value="REJECTED">Not approved</option>
            <option value="ALL">All credits</option>
          </select>
        </label>
      </div>

      {notice ? <p role="status" className="mt-4 rounded-lg bg-[var(--surface-secondary)] px-3 py-2 text-sm text-muted-foreground">{notice}</p> : null}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            <tr><th className="pb-3 pr-4 font-medium">Inviter</th><th className="pb-3 pr-4 font-medium">Invited guest</th><th className="pb-3 pr-4 font-medium">Qualified stay</th><th className="pb-3 pr-4 font-medium">Points</th><th className="pb-3 pr-4 font-medium">Status</th><th className="pb-3 font-medium">Action</th></tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="py-4 pr-4"><p className="font-medium text-muted-foreground">{userLabel(row.inviter)}</p><p className="text-xs text-[var(--muted-foreground)]">{row.inviter.email}</p></td>
                <td className="py-4 pr-4"><p className="font-medium text-muted-foreground">{userLabel(row.referredGuest)}</p><p className="text-xs text-[var(--muted-foreground)]">{row.referredGuest.email}</p></td>
                <td className="py-4 pr-4 text-[var(--muted-foreground)]">{formatDate(row.qualifyingBooking.endDate)}</td>
                <td className="py-4 pr-4 font-semibold text-muted-foreground">{row.points.toLocaleString()}</td>
                <td className="py-4 pr-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeStyle[row.status]}`}>{labels[row.status]}</span>{row.rejectionReason ? <p className="mt-1 max-w-44 text-xs text-rose-700">{row.rejectionReason}</p> : null}</td>
                <td className="py-4">
                  {row.status === "PENDING" && canReview ? <div className="flex gap-2"><button type="button" disabled={busyId === row.id} onClick={() => void submitReview(row, "approve")} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Approve</button><button type="button" disabled={busyId === row.id} onClick={() => setRejecting(row)} className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50">Reject</button></div> : <span className="text-xs text-[var(--muted-foreground)]">{row.reviewer ? `Reviewed by ${userLabel(row.reviewer)}` : "—"}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">No referral credits match this status.</p> : null}
      </div>
      <div className="mt-5"><AdminPagination currentPage={page} totalPages={Math.max(1, Math.ceil(total / 20))} totalItems={total} pageSize={20} itemLabel="credits" onPageChange={(nextPage) => void load(nextPage)} /></div>

      {rejecting ? (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="reject-referral-title" onMouseDown={() => !busyId && setRejecting(null)}>
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="reject-referral-title" className="text-lg font-semibold text-muted-foreground">Reject referral credit</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">Give a short, auditable reason. This decision cannot be changed from this screen.</p>
            <label className="mt-4 block text-sm font-medium text-muted-foreground">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-muted-foreground" maxLength={500} /></label>
            <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={busyId === rejecting.id} onClick={() => setRejecting(null)} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-muted-foreground">Cancel</button><button type="button" disabled={busyId === rejecting.id || reason.trim().length < 5} onClick={() => void submitReview(rejecting, "reject", reason.trim())} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === rejecting.id ? "Saving…" : "Reject credit"}</button></div>
          </div>
        </ModalOverlay>
      ) : null}
    </section>
  );
}
