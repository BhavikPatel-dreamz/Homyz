"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { BackButton } from "@/components/ui/back-button";
import type { ListingDTO } from "@/services/mappers";

const controlClass =
  "rounded-xl bg-[#F3F4F5] px-3.5 py-3 shadow-[0_2px_4px_#00000025] border border-white";

function ExpandControl({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <details className={`${controlClass} group`}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm text-[#1F1F1F]">{title}</span>
          {subtitle && (
            <span className="mt-1 block text-sm leading-5 text-[#727272]">
              {subtitle}
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          className="text-lg font-light leading-4 group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="mt-4 border-t border-zinc-200 pt-3 text-xs leading-5 text-[#727272]">
        {children}
      </div>
    </details>
  );
}

export function CalendarSettingsPanel({
  listing,
  saving,
  notice,
  onSave,
}: {
  listing: ListingDTO;
  saving: boolean;
  notice: string;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}) {
  const [panel, setPanel] = useState<"pricing" | "overview" | "availability">(
    "pricing",
  );
  const [dirty, setDirty] = useState(false);
  const [validation, setValidation] = useState("");
  const discounts = Array.isArray(listing.discounts)
    ? Object.fromEntries(
        listing.discounts
          .filter((value): value is string => typeof value === "string")
          .map((key) => [
            key,
            key === "weekly"
              ? 10
              : key === "monthly"
                ? 25
                : key === "new_listing"
                  ? 20
                  : 15,
          ]),
      )
    : ((listing.discounts || {}) as Record<string, number>);
  const editorHref = `/host/listings/${listing.id}/pricing`;
  const input = (
    name: string,
    label: string,
    value: number | string,
    suffix = "",
    max?: number,
  ) => (
    <label className={`block ${controlClass}`}>
      <span className="mb-2 block text-sm text-[#1F1F1F]">{label}</span>
      <span className="flex items-center gap-1 text-sm font-medium">
        {suffix === "SR" && <span>SR</span>}
        <input
          aria-label={label}
          name={name}
          defaultValue={value}
          type="number"
          min="0"
          max={max}
          step="0.01"
          required={name !== "weekendPrice"}
          className={`${suffix === "%" ? "w-7" : "w-full"} min-w-0 bg-transparent outline-offset-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        />
        {suffix === "%" && <span>%</span>}
      </span>
    </label>
  );
  if (panel === "overview")
    return (
      <div className="space-y-8 text-sm">
        <button
          className="flex w-full justify-between text-left"
          onClick={() => setPanel("pricing")}
        >
          Price settings <span>›</span>
        </button>
        <button
          className="flex w-full justify-between text-left"
          onClick={() => setPanel("availability")}
        >
          Availability settings <span>›</span>
        </button>
      </div>
    );
  return (
    <div className="text-[#1F1F1F]">
      <BackButton
        aria-label="Back to calendar settings"
        onClick={() => setPanel("overview")}
        className="mb-5"
      />
      {panel === "availability" ? (
        <div className="space-y-5">
          <h2 className="text-sm font-medium">Availability settings</h2>
          <div className={controlClass}>
            <p className="text-xs text-[#727272]">Trip length</p>
            <p className="mt-2 text-sm">
              {listing.minNights}–{listing.maxNights} nights
            </p>
          </div>
          <p className="text-xs leading-5 text-[#727272]">
            Select dates on the calendar to manage availability.
          </p>
          <Link
            href={`/host/listings/${listing.id}/availability`}
            className="block text-xs underline"
          >
            Edit availability and connect calendars
          </Link>
        </div>
      ) : (
        <form
          onChange={() => setDirty(true)}
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const number = (key: string) => Number(data.get(key));
            const price = number("price"),
              weekly = number("weekly"),
              monthly = number("monthly");
            if (
              !Number.isFinite(price) ||
              price < 0 ||
              weekly < 0 ||
              weekly > 100 ||
              monthly < 0 ||
              monthly > 100
            ) {
              setValidation(
                "Enter a valid price and discounts between 0 and 100%.",
              );
              return;
            }
            setValidation("");
            await onSave({
              price: Math.round(price * 100),
              weekendPrice:
                data.get("weekendPrice") === ""
                  ? null
                  : Math.round(number("weekendPrice") * 100),
              discounts: { ...discounts, weekly, monthly },
              cleaningFee: Math.round(number("cleaningFee") * 100),
            });
          }}
        >
          <section className="space-y-3 pb-6">
            <div>
              <h2 className="text-sm font-medium">Price settings</h2>
              <p className="mt-1 text-xs leading-5 text-[#727272]">
                These apply to all nights, unless you customize them by date.
              </p>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-normal">Base price</span>
              <div className="relative inline-flex shrink-0 items-center">
                <Image
                  src="/images/icons/SAR-icon.svg"
                  alt=""
                  width={20}
                  height={19}
                  className="pointer-events-none absolute left-3"
                />
                <select
                  aria-label="Pricing currency"
                  defaultValue="SAR"
                  className="h-10 w-[114px] cursor-pointer appearance-none rounded-full border border-[#858585] bg-white pl-10 pr-8 text-base font-normal text-[#1F1F1F] focus-visible:outline-none"
                >
                  <option value="SAR">SAR</option>
                </select>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 size-4 text-[#1F1F1F]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
            {input("price", "Per night", listing.price / 100, "SR")}
            <ExpandControl title="Custom weekend price">
              {input(
                "weekendPrice",
                "Per night · SR",
                listing.weekendPrice == null ? "" : listing.weekendPrice / 100,
              )}
            </ExpandControl>
            <ExpandControl title="Smart pricing">
              <p>
                Automatic pricing is not available yet. Set your base and
                weekend rates above.
              </p>
            </ExpandControl>
          </section>
          <section className="space-y-3 border-t border-[#F3F4F5] py-6">
            <h3 className="text-sm font-medium">Discounts</h3>
            <p className="pb-1 text-xs leading-4 text-[#727272]">
              Offer lower nightly rates for longer stays.
            </p>
            {input(
              "weekly",
              "Weekly (7 nights +)",
              discounts.weekly || 0,
              "%",
              100,
            )}
            {input(
              "monthly",
              "Monthly (28 nights +)",
              discounts.monthly || 0,
              "%",
              100,
            )}
            <ExpandControl
              title="More discounts"
              subtitle="Early birds | Last minute"
            >
              <Link href={editorHref} className="underline">
                Manage additional discounts
              </Link>
            </ExpandControl>
          </section>
          <section className="space-y-3 border-t border-[#F3F4F5] py-6">
            <h3 className="text-sm font-medium">Promotions</h3>
            <p className="pb-1 text-xs leading-4 text-[#727272]">
              Manage offers and discounts for your listing.
            </p>
            <ExpandControl
              title="Custom promotion"
              subtitle="Choose the dates and discounts"
            >
              <Link href={editorHref} className="underline">
                View promotion options
              </Link>
            </ExpandControl>
            <ExpandControl title="Show past promotions">
              <p>No promotion history is available.</p>
            </ExpandControl>
          </section>
          <section className="space-y-3 border-t border-[#F3F4F5] py-6">
            <h3 className="text-sm font-medium">Additional charges</h3>
            <ExpandControl title="Fees" subtitle="Cleaning, pets, extra guests">
              {input(
                "cleaningFee",
                "Cleaning fee · SR",
                (listing.cleaningFee || 0) / 100,
              )}
              <Link href={editorHref} className="mt-3 block underline text-sm text-[#1F1F1F]">
                More fee settings
              </Link>
            </ExpandControl>
          </section>
          {(dirty || saving) && (
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-[#FDE29B] px-4 py-2.5 text-xs font-medium disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          )}
          {(notice || validation) && (
            <p
              role={validation ? "alert" : "status"}
              className="mt-3 text-xs leading-5"
            >
              {validation || notice}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
