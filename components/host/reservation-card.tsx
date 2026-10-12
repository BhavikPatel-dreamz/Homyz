"use client";

import { PropertyPhoto } from "./host-workspace-shared";
import type { OperationalEvent } from "@/lib/booking/host-reservation-events";
import type { ListingDTO } from "@/services/mappers";

export function ReservationCard({
  event,
  selected,
  isActive,
  priorityLabel,
  onSelect,
}: {
  event: OperationalEvent;
  selected: boolean;
  isActive: boolean;
  priorityLabel?: string;
  onSelect: () => void;
}) {
  const { booking, listing } = event;
  const badgeLetter = booking.guestName && booking.guestName !== "(Name)"
    ? booking.guestName.charAt(0).toUpperCase()
    : "G";
  const guestCount = booking.guests || 1;

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`Open reservation for ${booking.guestName || "Guest"} at ${listing.title}`}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
          keyboardEvent.preventDefault();
          onSelect();
        }
      }}
      aria-current={isActive ? "true" : undefined}
      className={`group relative flex min-h-[330px] w-full min-w-0 cursor-pointer select-none flex-col items-center justify-center rounded-[12px] border border-zinc-100 px-4 py-8 font-sans transition-colors duration-300 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F1F1F] sm:min-h-[362px] sm:rounded-[20px] ${
        isActive
          ? "bg-[#FCDF9C]"
          : selected
            ? "bg-white ring-2 ring-[#1F1F1F] hover:bg-[#FCDF9C]"
            : "bg-white hover:bg-[#FCDF9C]"
      }`}
      style={{ boxShadow: "0 1px 5px rgba(0, 0, 0, 0.20)" }}
    >
      {isActive && (
        <span className="absolute top-3.5 right-3.5 z-10 rounded-full bg-[#1F1F1F] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase shadow-xs sm:text-[11px]">
          {priorityLabel}
        </span>
      )}

      <div className="relative flex w-[170px] flex-col items-center gap-[28px] sm:gap-[32px]">
        <div className="flex flex-col items-center justify-center text-center">
          <span className="font-sans text-[16px] leading-[24px] font-medium text-[#1F1F1F]">
            {event.timeDisplay}
          </span>
          <span
            className={`font-sans text-[14px] leading-[21px] font-normal transition-colors duration-300 ease-in-out ${
              isActive || selected ? "text-[#1F1F1F]" : "text-[#727272] group-hover:text-[#1F1F1F]"
            }`}
          >
            {event.subtitleDisplay}
          </span>
          {event.dateDisplay && (
            <span className="mt-0.5 font-sans text-[12px] leading-[18px] text-[#727272]">
              {event.dateDisplay}
            </span>
          )}
        </div>

        <div className="flex w-[170px] flex-col items-center gap-[10px] sm:gap-[12px]">
          <div className="relative flex flex-col items-center">
            <div className="h-[110px] w-[149.79px] overflow-hidden rounded-[23px] border border-[#1F1F1F] transition-all duration-300 ease-in-out">
              <PropertyPhoto
                listing={listing as unknown as ListingDTO}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="absolute -top-[20px] left-1/2 z-10 flex h-[40px] w-[40px] -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border border-black bg-white shadow-xs">
              {booking.guestImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={booking.guestImage}
                  alt={booking.guestName || "Guest"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-sans text-[16px] leading-[24px] font-medium text-[#1F1F1F]">
                  {badgeLetter}
                </span>
              )}
            </div>
          </div>

          <div
            className={`flex min-h-[36px] w-full min-w-0 flex-col items-center justify-center text-center font-sans text-[12px] leading-[18px] font-normal transition-colors duration-300 ease-in-out ${
              isActive || selected ? "text-[#1F1F1F]" : "text-[#727272] group-hover:text-[#1F1F1F]"
            }`}
          >
            <span className="line-clamp-1 max-w-full break-words font-medium">{listing.title},</span>
            <span className="line-clamp-1 max-w-full break-words">
              {[listing.district, listing.city].filter(Boolean).join(", ") || "Location"}
            </span>
          </div>

          <div
            className={`flex items-center gap-1.5 font-sans text-[12px] leading-[18px] font-normal transition-colors duration-300 ease-in-out ${
              isActive || selected ? "text-[#1F1F1F]" : "text-[#727272] group-hover:text-[#1F1F1F]"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
              aria-hidden="true"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>{guestCount} {guestCount === 1 ? "guest" : "guests"}</span>
          </div>

          <div
            className={`flex h-[32px] w-[32px] items-center justify-center rounded-full border border-[#1F1F1F] transition-colors duration-300 ease-in-out ${
              isActive || selected ? "bg-white" : "bg-[#FCDF9C] group-hover:bg-white"
            }`}
            aria-hidden="true"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`origin-center transition-transform duration-300 ease-in-out ${
                selected ? "rotate-45" : "rotate-0 group-hover:rotate-45"
              }`}
            >
              <path
                d="M2 2H8V8"
                stroke="#1F1F1F"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
