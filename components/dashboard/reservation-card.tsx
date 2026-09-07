"use client";

import React, { useState } from "react";

export interface ReservationCardData {
  id: string;
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
}

function formatDates(start: Date | string, end: Date | string) {
  const first = new Date(start);
  const last = new Date(end);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) {
    return "Dates TBD";
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

export function ReservationCard({
  data,
  onSelect,
}: {
  data: ReservationCardData;
  onSelect?: (data: ReservationCardData) => void;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const title = data.propertyName || "Property name";
  const content = (
    <>
      <span className="relative block aspect-[288/256] w-full overflow-hidden rounded-[24px] border border-[#727272] bg-[#F5F3EE]">
        {data.propertyImage && failedImage !== data.propertyImage ? (
          // Listing photos may use custom storage domains.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.propertyImage}
            alt={title}
            loading="lazy"
            onError={() => setFailedImage(data.propertyImage ?? null)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-sm text-[#727272]">
            Photo unavailable
          </span>
        )}
      </span>
      <span className="mt-6 block break-words text-base font-semibold leading-7 text-[#1F1F1F]">
        {title}
      </span>
      <span className="mt-2 block text-sm font-normal leading-6 text-[#727272]">
        {formatDates(data.startDate, data.endDate)}
      </span>
    </>
  );

  return onSelect ? (
    <button
      type="button"
      onClick={() => onSelect(data)}
      aria-label={`View reservation for ${title}`}
      className="block w-full min-w-0 cursor-pointer rounded-[24px] text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F1F1F]"
    >
      {content}
    </button>
  ) : (
    <article className="w-full min-w-0 text-left">{content}</article>
  );
}
