"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { ListingDTO } from "@/services/mappers";

export type HostReservation = {
  id: string;
  listingId: string;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  guestName: string;
  guestImage: string | null;
};
export type HostWorkspaceProps = {
  listings: ListingDTO[];
  bookings: HostReservation[];
};
export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const money = (price: number) =>
  `SR ${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(price / 100)}`;
export const shortDate = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export function PropertyPhoto({
  listing,
  className = "",
}: {
  listing: ListingDTO;
  className?: string;
}) {
  // Uploaded property images may come from any configured storage provider.
  return listing.photos[0] ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={listing.photos[0]}
      alt={listing.title}
      className={`object-cover ${className}`}
    />
  ) : (
    <span
      className={`flex items-center justify-center bg-zinc-100 text-zinc-400 ${className}`}
      aria-label="No property photo"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-8h6v8" />
      </svg>
    </span>
  );
}

export function WorkspaceDialog({
  title,
  children,
  onClose,
  dark = false,
  maxWidth = "max-w-md",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dark?: boolean;
  maxWidth?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab" || !node) return;
      const elements = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select, textarea, [tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length);
      const first = elements[0],
        last = elements.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === node)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === node)
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    node?.addEventListener("keydown", handleKey);
    return () => {
      node?.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, []);
  return (
    <ModalOverlay
      className={`fixed inset-0 z-[100] flex ${dark ? "items-end sm:items-center" : "items-center"} justify-center bg-black/30 p-4 backdrop-blur-xs`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[88dvh] w-full ${maxWidth} overflow-y-auto rounded-2xl p-6 shadow-2xl outline-none ${dark ? "bg-[#1F1F1F] text-white" : "bg-white text-[#1F1F1F]"}`}
      >
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-100 dark:border-white/10 pb-4">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="flex size-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-700 transition-colors"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </ModalOverlay>
  );
}

export function ReservationDetails({
  booking,
  listing,
  onClose,
  onMoney,
}: {
  booking: HostReservation;
  listing: ListingDTO;
  onClose: () => void;
  onMoney: () => void;
}) {
  const start = new Date(booking.startDate);
  const end = new Date(booking.endDate);
  const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const nightlyRate = listing.price;
  const roomFee = nights * nightlyRate;
  const cleaningFee = listing.cleaningFee || Math.round(nightlyRate * 0.35);
  const serviceFee = Math.round(roomFee * 0.12);
  const guestTotal = roomFee + cleaningFee + serviceFee;
  const hostServiceFee = Math.round(roomFee * 0.03);
  const hostPayout = roomFee + cleaningFee - hostServiceFee;

  return (
    <WorkspaceDialog title="Reservation details" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-6 text-sm">
        {/* Confirmed Header & Guest Info */}
        <div className="rounded-2xl bg-zinc-50 p-5 border border-zinc-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Confirmed
            </span>
          </div>

          <div className="flex items-start gap-4">
            {booking.guestImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={booking.guestImage}
                alt={booking.guestName}
                className="size-14 rounded-full object-cover border border-zinc-200"
              />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-900 font-semibold text-lg border border-amber-200">
                {booking.guestName[0] || "G"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-zinc-900">{booking.guestName}</h3>
              <p className="text-xs text-zinc-600 mt-0.5 truncate">{listing.title}</p>
              <p className="text-xs text-zinc-500">{[listing.city, listing.country].filter(Boolean).join(", ")}</p>
              <p className="mt-2 text-xs font-medium text-zinc-800">
                {shortDate(booking.startDate)} – {shortDate(booking.endDate)} ({nights} {nights === 1 ? "night" : "nights"}) • 2 guests
              </p>
            </div>
          </div>
        </div>

        {/* About Guest Card */}
        <div className="rounded-2xl border border-zinc-200 p-4 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            About {booking.guestName}
          </h4>
          <div className="space-y-1.5 text-xs text-zinc-700">
            <div className="flex items-center gap-2">
              <span className="text-amber-500">★</span>
              <span>5.0 rating from 1 review</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600">✔</span>
              <span>Identity verified</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">📅</span>
              <span>Joined Homyz in 2022</span>
            </div>
          </div>
          <button type="button" className="text-xs font-medium text-zinc-900 underline pt-1">
            Show profile
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onMoney}
            className="w-full rounded-full border border-zinc-900 px-4 py-3 font-medium text-xs hover:bg-zinc-50 transition-colors shadow-2xs"
          >
            Send or request money
          </button>
          <a
            href="/host/messages"
            className="w-full rounded-full bg-[#1F1F1F] px-4 py-3 text-center text-xs font-medium text-white hover:bg-black transition-colors shadow-2xs"
          >
            Message
          </a>
        </div>

        {/* Booking Details */}
        <div>
          <h4 className="font-semibold text-zinc-900 text-sm mb-3">Booking details</h4>
          <dl className="divide-y divide-zinc-100 text-xs">
            <div className="py-2.5 flex justify-between">
              <dt className="text-zinc-500">Guests</dt>
              <dd className="font-medium text-zinc-800">2 Adults</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-zinc-500">Check-in</dt>
              <dd className="font-medium text-zinc-800">{shortDate(booking.startDate)} ({listing.checkInStart || "15:00"})</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-zinc-500">Check-out</dt>
              <dd className="font-medium text-zinc-800">{shortDate(booking.endDate)} ({listing.checkOutTime || "11:00"})</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-zinc-500">Booking date</dt>
              <dd className="font-medium text-zinc-800">{shortDate(booking.createdAt)}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-zinc-500">Confirmation code</dt>
              <dd className="font-mono text-zinc-800">{booking.id.slice(-8).toUpperCase()}</dd>
            </div>
            <div className="py-2.5 flex justify-between">
              <dt className="text-zinc-500">Cancellation policy</dt>
              <dd className="font-medium capitalize text-zinc-800">
                {listing.cancellationPolicy.replaceAll("_", " ").toLowerCase()}
              </dd>
            </div>
          </dl>
          <a href="/host/calendar" className="inline-block text-xs font-medium text-zinc-900 underline mt-2">
            Show calendar
          </a>
        </div>

        {/* Financial Breakdown: Guest Paid */}
        <div className="border-t border-zinc-200 pt-4">
          <h4 className="font-semibold text-zinc-900 text-sm mb-3">Guest paid</h4>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-zinc-500">{money(nightlyRate)} × {nights} {nights === 1 ? "night" : "nights"}</dt>
              <dd className="text-zinc-800">{money(roomFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Cleaning fee</dt>
              <dd className="text-zinc-800">{money(cleaningFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Homyz service fee</dt>
              <dd className="text-zinc-800">{money(serviceFee)}</dd>
            </div>
            <div className="flex justify-between border-t border-zinc-100 pt-2 font-semibold text-sm">
              <dt className="text-zinc-900">Total (SAR)</dt>
              <dd className="text-zinc-900">{money(guestTotal)}</dd>
            </div>
          </dl>
        </div>

        {/* Financial Breakdown: Host Payout */}
        <div className="border-t border-zinc-200 pt-4">
          <h4 className="font-semibold text-zinc-900 text-sm mb-3">Host payout</h4>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-zinc-500">{nights} {nights === 1 ? "night" : "nights"} room fee</dt>
              <dd className="text-zinc-800">{money(roomFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Host service fee (3.0% + VAT)</dt>
              <dd className="text-rose-600">- {money(hostServiceFee)}</dd>
            </div>
            <div className="flex justify-between border-t border-zinc-100 pt-2 font-semibold text-sm">
              <dt className="text-zinc-900">Total payout (SAR)</dt>
              <dd className="text-emerald-700">{money(hostPayout)}</dd>
            </div>
          </dl>
        </div>

        {/* Bottom Document Links */}
        <div className="border-t border-zinc-200 pt-3 space-y-2 text-xs">
          <button type="button" className="flex w-full items-center justify-between py-1.5 text-zinc-700 hover:text-zinc-950">
            <span>VAT invoice</span>
            <span>›</span>
          </button>
          <button type="button" className="flex w-full items-center justify-between py-1.5 text-zinc-700 hover:text-zinc-950">
            <span>Transaction history</span>
            <span>›</span>
          </button>
        </div>
      </div>
    </WorkspaceDialog>
  );
}

export function MoneyDialog({
  booking,
  onClose,
}: {
  booking: HostReservation;
  onClose: () => void;
}) {
  const start = new Date(booking.startDate);
  const end = new Date(booking.endDate);
  const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <WorkspaceDialog title="Send or request money" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-5 text-sm">
        <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">From</p>
          <p className="my-1 font-bold text-base text-zinc-900">{booking.guestName}</p>
          <p className="text-xs text-zinc-500">
            {shortDate(booking.startDate)} – {shortDate(booking.endDate)} ({nights} {nights === 1 ? "night" : "nights"}) • 2 guests
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-2 font-semibold text-zinc-900 text-sm">What would you like to do?</legend>
          <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors">
            <input type="radio" name="money-action" defaultChecked className="size-4 accent-[#1F1F1F]" />
            <span className="text-sm font-medium text-zinc-800">Send money</span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer transition-colors">
            <input type="radio" name="money-action" className="size-4 accent-[#1F1F1F]" />
            <span className="text-sm font-medium text-zinc-800">Request money</span>
          </label>
        </fieldset>

        <p className="rounded-xl bg-amber-50 p-3.5 text-xs text-amber-900 leading-relaxed border border-amber-200/60">
          Payments are securely handled via Homyz escrow. You can also contact your guest directly through Messages.
        </p>

        <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 underline"
          >
            Cancel
          </button>
          <a
            href="/host/messages"
            className="rounded-full bg-[#1F1F1F] px-6 py-2.5 text-xs font-semibold text-white hover:bg-black transition-colors"
          >
            Next
          </a>
        </div>
      </div>
    </WorkspaceDialog>
  );
}
