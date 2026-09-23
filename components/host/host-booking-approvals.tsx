"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";

type PendingBooking = {
  id: string;
  startDate: string;
  endDate: string;
  guests: number;
  createdAt: string;
  guest: { name: string | null; image: string | null };
  listing: { title: string; city: string | null; country: string | null; photos: string[] };
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function HostBookingApprovals({ bookings }: { bookings: PendingBooking[] }) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approveAll = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/host/bookings/approve-all", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "Unable to approve bookings right now.");
      setIsConfirmOpen(false);
      router.refresh();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Unable to approve bookings right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return <div className="mx-auto w-full max-w-6xl py-8 sm:py-12">
    <div className="flex flex-wrap items-end justify-between gap-5 border-b border-zinc-200 pb-7">
      <div><p className="text-sm font-medium text-zinc-500">Host tools</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">Pending booking requests</h1><p className="mt-2 text-sm text-zinc-600">Review the active requests for your listings, then confirm them together.</p></div>
      {bookings.length > 0 && <button type="button" onClick={() => setIsConfirmOpen(true)} className="min-h-11 rounded-xl bg-[#1F1F1F] px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700">Approve all ({bookings.length})</button>}
    </div>

    {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {bookings.length === 0 ? <div className="mt-8 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-14 text-center"><h2 className="text-lg font-semibold text-zinc-900">No pending booking requests</h2><p className="mt-2 text-sm text-zinc-600">New requests will appear here when guests request a stay at one of your listings.</p></div> : <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {bookings.map((booking) => {
        const location = [booking.listing.city, booking.listing.country].filter(Boolean).join(", ");
        return <article key={booking.id} className="overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          {booking.listing.photos[0] ? <img src={booking.listing.photos[0]} alt={booking.listing.title} className="aspect-[16/10] w-full rounded-2xl object-cover" /> : <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-zinc-100 text-sm text-zinc-500">Photo unavailable</div>}
          <h2 className="mt-4 truncate text-lg font-semibold text-zinc-900">{booking.listing.title}</h2>
          {location && <p className="mt-1 text-sm text-zinc-600">{location}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-zinc-200 pt-4 text-sm"><div><dt className="text-zinc-500">Guest</dt><dd className="mt-1 font-medium text-zinc-900">{booking.guest.name || "Guest"}</dd></div><div><dt className="text-zinc-500">Guests</dt><dd className="mt-1 font-medium text-zinc-900">{booking.guests}</dd></div><div><dt className="text-zinc-500">Check-in</dt><dd className="mt-1 font-medium text-zinc-900">{formatDate(booking.startDate)}</dd></div><div><dt className="text-zinc-500">Check-out</dt><dd className="mt-1 font-medium text-zinc-900">{formatDate(booking.endDate)}</dd></div></dl>
        </article>;
      })}
    </div>}

    {isConfirmOpen && <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="approve-bookings-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 id="approve-bookings-title" className="text-xl font-semibold text-zinc-900">Approve all pending bookings?</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">This will confirm {bookings.length} active pending {bookings.length === 1 ? "booking" : "bookings"}. Guests will see the updated status immediately.</p>
        <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={isSubmitting} onClick={() => setIsConfirmOpen(false)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100">Cancel</button><button type="button" disabled={isSubmitting} onClick={approveAll} className="min-h-11 rounded-xl bg-[#1F1F1F] px-5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:bg-zinc-300">{isSubmitting ? "Approving…" : "Approve all"}</button></div>
      </div>
    </ModalOverlay>}
  </div>;
}
