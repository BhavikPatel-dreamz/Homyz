"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatBookingDateRange } from "@/lib/booking/booking-date";
import { getBookingStatusPresentation } from "@/lib/booking/booking-status";
import { useLanguage } from "@/lib/i18n/language-context";

export interface ReservationCardData {
  id: string;
  listingId?: string | null;
  listingSlug?: string | null;
  propertyName?: string | null;
  location?: string | null;
  propertyImage?: string | null;
  startDate: Date | string;
  endDate: Date | string;
  guestName?: string | null;
  guestAvatar?: string | null;
  guestCount?: number;
  status?: string;
  checkInTime?: string;
  checkOutTime?: string;
  actionType?: "check_in" | "check_out" | "reserved";
  isToday?: boolean;
  cancellationPolicy?: string | null;
  isNonRefundable?: boolean;
  totalPrice?: number | null;
  currency?: string;
  createdAt?: Date | string;
}

function formatDates(start: Date | string, end: Date | string, fallbackText: string) {
  const first = new Date(start);
  const last = new Date(end);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) {
    return fallbackText;
  }
  const format = (date: Date, includeYear: boolean) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(includeYear ? { year: "numeric" as const } : {}),
      timeZone: "UTC",
    });
  return `${format(first, first.getUTCFullYear() !== last.getUTCFullYear())} – ${format(last, true)}`;
}

function StatusBadge({ status }: { status?: string }) {
  const { t } = useLanguage();
  const s = (status || "PENDING").toUpperCase();
  const presentation = getBookingStatusPresentation(s);
  if (s === "CONFIRMED" || s === "CURRENT_STAY") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-xs px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200/90 shadow-2xs">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {t("dashboard_status_confirmed", "Confirmed")}
      </span>
    );
  }
  if (s === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-xs px-2.5 py-1 text-xs font-medium text-zinc-700 border border-zinc-200 shadow-2xs">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        Completed
      </span>
    );
  }
  if (s === "EXPIRED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-xs px-2.5 py-1 text-xs font-medium text-zinc-500 border border-zinc-200 shadow-2xs">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        Expired
      </span>
    );
  }
  if (s === "DECLINED" || s === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-xs px-2.5 py-1 text-xs font-medium text-zinc-600 border border-zinc-200 shadow-2xs">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        Declined
      </span>
    );
  }
  if (s === "CANCELLED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-xs px-2.5 py-1 text-xs font-medium text-zinc-600 border border-zinc-200 shadow-2xs">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        {t("dashboard_status_cancelled", "Cancelled")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-xs px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200/90 shadow-2xs">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      {t("dashboard_status_pending", "Pending")}
    </span>
  );
}

export function ReservationCard({
  data,
  href,
}: {
  data: ReservationCardData;
  href?: string;
}) {
  const { t } = useLanguage();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const title = data.propertyName || t("dashboard_card_property_stay", "Property stay");
  const detailsHref = href || `/bookings/${data.id}`;
  const statusPresentation = getBookingStatusPresentation(data.status || "PENDING");
  const isPending = statusPresentation.status === "PENDING";
  return (
    <article className="group flex min-h-[304px] flex-col overflow-hidden rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_2px_4px_rgba(0,0,0,0.08)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.10)]">
      <div>
        {/* IMAGE WITH FLOATING BADGE OVERLAY */}
        <Link href={detailsHref} className="relative block aspect-[16/10] w-full overflow-hidden rounded-[18px] bg-[#F5F3EE]">
          {data.propertyImage && failedImage !== data.propertyImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.propertyImage}
              alt={title}
              loading="lazy"
              onError={() => setFailedImage(data.propertyImage ?? null)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs sm:text-sm text-zinc-400 bg-zinc-100">
              {t("dashboard_card_photo_unavailable", "Photo unavailable")}
            </span>
          )}

          {/* Status Badge Overlay */}
          <div className="pointer-events-none absolute left-3 top-3">
            <StatusBadge status={data.status} />
          </div>
        </Link>

        {/* PROPERTY INFO */}
        <div className="mt-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
            {formatDates(data.startDate, data.endDate, t("dashboard_card_dates_tbd", "Dates TBD"))}
          </p>

          <Link
            href={detailsHref}
            className="mt-1 block min-h-12 text-[16px] font-semibold leading-6 text-[#1F1F1F] transition-colors group-hover:text-zinc-700 line-clamp-2"
            title={title}
          >
            {title}
          </Link>

          {data.location && (
            <p className="mt-1 line-clamp-1 text-sm leading-5 text-slate-500">
              {data.location}
            </p>
          )}

          <p className="mt-2 text-sm text-slate-600">
            {data.guestCount || 1} {(data.guestCount || 1) === 1 ? "guest" : "guests"}
          </p>

          {/* {isPending && (
            <p className="mt-2 text-sm leading-5 text-amber-800">
              Your host is reviewing this request.
            </p>
          )} */}

          <p className="mt-2 text-[10px] font-medium tracking-[0.02em] text-slate-400">
            {t("dashboard_card_booking_num", "Booking #")}
            {data.id.slice(-8).toUpperCase()}
          </p>

          {/* <Link
            href={detailsHref}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#1F1F1F] underline underline-offset-4"
          >
            View details
          </Link> */}
        </div>
      </div>
    </article>
  );
}
