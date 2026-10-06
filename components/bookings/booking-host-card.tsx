import React from "react";
import { useLanguage } from "@/lib/i18n/language-context";

interface BookingHostCardProps {
  hostName: string | null;
  hostImage: string | null;
  hostSince?: Date | string | null;
  isConfirmed: boolean;
  onContactHost: () => void;
}

function formatYear(val?: Date | string | null): string {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.getFullYear().toString();
}

export function BookingHostCard({
  hostName,
  hostImage,
  hostSince,
  isConfirmed,
  onContactHost,
}: BookingHostCardProps) {
  const { t } = useLanguage();
  const displayName = hostName || "Host";
  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "H";

  const memberYear = formatYear(hostSince);

  return (
    <section className="border-b border-zinc-200 py-7" aria-labelledby="host-heading">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:rounded-3xl rounded-lg border border-zinc-200 bg-white p-6 shadow-2xs">
        <div className="flex items-center gap-4">
          {hostImage ? (
            <img
              src={hostImage}
              alt={displayName}
              className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-zinc-200"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg font-bold text-amber-900 ring-2 ring-amber-200">
              {initials}
            </div>
          )}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#727272]">
              {t("booking_details_property_host", "Property Host")}
            </span>
            <h2 id="host-heading" className="text-lg font-semibold text-[#1F1F1F]">
              {t("booking_details_hosted_by", { name: displayName }, "Hosted by {name}")}
            </h2>
            {memberYear && (
              <p className="text-xs text-[#727272] mt-0.5">
                {t("booking_details_hosting_since", { year: memberYear }, "Hosting on Homyz since {year}")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:self-center">
          <button
            type="button"
            onClick={onContactHost}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#1F1F1F] hover:bg-[#D9D9D9] text-white hover:text-[#1f1f1f] px-4 py-2 text-sm font-semibold transition-colors duration-300 cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>{t("booking_details_message_host_btn", "Message host")}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

