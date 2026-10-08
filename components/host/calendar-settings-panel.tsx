"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { BackButton } from "@/components/ui/back-button";
import type { ListingDTO } from "@/services/mappers";
import { convertCurrency, resolvePropertyCurrency } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";

function ExpandControl({
  title,
  subtitle,
  children,
  defaultOpen = false,
  control,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  control?: ReactNode;
}) {
  return (
    <details
      className="group overflow-hidden rounded-[12px] border border-[#FFFFFF] bg-[#F3F4F5] transition-all duration-200 group-open:border-[#bdbdbd] group-open:shadow-[0_3px_12px_rgba(31,31,31,0.06)] dark:border-zinc-700/80 dark:bg-zinc-800/40 dark:hover:border-zinc-600 dark:group-open:border-zinc-600 shadow-[0px_2px_4px_0px_#00000040]"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 transition-colors dark:hover:bg-zinc-800/70 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-[#1f1f1f] dark:text-zinc-100">
            {title}
          </span>
          {subtitle && (
            <span className="mt-1 block text-xs font-normal leading-normal text-[#727272] dark:text-zinc-400">
              {subtitle}
            </span>
          )}
          {control && <div className="mt-3">{control}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="relative size-4" aria-hidden="true">
            <Image
              src="/images/icons/homyz/stroke/Plus.svg"
              alt=""
              width={16}
              height={16}
              className="size-4 transition-opacity duration-200 group-open:opacity-0"
            />
            <Image
              src="/images/icons/minus-icon.svg"
              alt=""
              width={14}
              height={1}
              className="absolute left-1/2 top-1/2 hidden h-px w-3.5 -translate-x-1/2 -translate-y-1/2 group-open:block"
            />
          </span>
        </div>
      </summary>
      <div className="space-y-3 border-t border-[#ececec] bg-[#fafafa] p-4 dark:border-zinc-700/80 dark:bg-zinc-900/40">
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
  const { currency: displayCurrency, formatMajor } = useCurrency();
  // The calendar opens on the concise Figma-style overview. Pricing and
  // availability retain their existing full editors one click away.
  const [panel, setPanel] = useState<"pricing" | "overview" | "availability">("overview");
  const [dirty, setDirty] = useState(false);
  const [validation, setValidation] = useState("");
  const [formKey, setFormKey] = useState(0);

  const rawDiscounts =
    typeof listing.discounts === "object" && listing.discounts !== null
      ? (listing.discounts as Record<string, any>)
      : {};

  const weeklyDiscount =
    typeof rawDiscounts.weekly === "object"
      ? rawDiscounts.weekly?.percentage ?? 10
      : Number(rawDiscounts.weekly || 0);

  const monthlyDiscount =
    typeof rawDiscounts.monthly === "object"
      ? rawDiscounts.monthly?.percentage ?? 25
      : Number(rawDiscounts.monthly || 0);

  const earlyBirdDiscount =
    typeof rawDiscounts.early_bird === "object"
      ? rawDiscounts.early_bird?.percentage ?? 10
      : Number(rawDiscounts.early_bird || 0);
  const earlyBirdDaysInAdvance =
    typeof rawDiscounts.early_bird === "object"
      ? Number(rawDiscounts.early_bird?.daysInAdvance ?? 30)
      : 30;

  const lastMinuteDiscount =
    typeof rawDiscounts.last_minute === "object"
      ? rawDiscounts.last_minute?.percentage ?? 10
      : Number(rawDiscounts.last_minute || 0);
  const lastMinuteDaysBefore =
    typeof rawDiscounts.last_minute === "object"
      ? Number(rawDiscounts.last_minute?.daysBefore ?? 2)
      : 2;

  const customPromoDiscount =
    typeof rawDiscounts.custom_promotion === "object"
      ? rawDiscounts.custom_promotion?.percentage ?? 15
      : Number(rawDiscounts.custom_promotion || 0);

  const newListingEntry = rawDiscounts.new_listing ?? rawDiscounts.newListing;
  const newListingDiscount =
    typeof newListingEntry === "object" && newListingEntry !== null
      ? Number(newListingEntry.percentage ?? newListingEntry.discountPercentage ?? 20)
      : newListingEntry === true
        ? 20
        : Number(newListingEntry || 0);

  const discountEnabled = (entry: unknown, percentage: number) => {
    if (typeof entry === "object" && entry !== null) {
      return (entry as Record<string, unknown>).enabled !== false && percentage > 0;
    }
    return percentage > 0;
  };

  const [weeklyEnabled, setWeeklyEnabled] = useState(() =>
    discountEnabled(rawDiscounts.weekly, weeklyDiscount)
  );
  const [monthlyEnabled, setMonthlyEnabled] = useState(() =>
    discountEnabled(rawDiscounts.monthly, monthlyDiscount)
  );
  const [earlyBirdEnabled, setEarlyBirdEnabled] = useState(() =>
    discountEnabled(rawDiscounts.early_bird, earlyBirdDiscount)
  );
  const [lastMinuteEnabled, setLastMinuteEnabled] = useState(() =>
    discountEnabled(rawDiscounts.last_minute, lastMinuteDiscount)
  );
  const [newListingEnabled, setNewListingEnabled] = useState(() =>
    discountEnabled(newListingEntry, newListingDiscount)
  );
  const [customPromoEnabled, setCustomPromoEnabled] = useState(() =>
    discountEnabled(rawDiscounts.custom_promotion, customPromoDiscount)
  );

  const discountToggle = (
    name: string,
    label: string,
    enabled: boolean,
    setEnabled: (value: boolean) => void
  ) => (
    <>
      <input
        type="checkbox"
        name={name}
        checked={enabled}
        onChange={(event) => setEnabled(event.target.checked)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setEnabled(!enabled);
          setDirty(true);
        }}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${enabled ? "bg-[#DF4557]" : "bg-zinc-300 dark:bg-zinc-600"
          }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-xs transition-transform ${enabled ? "translate-x-5" : "translate-x-0"
            }`}
        />
      </button>
    </>
  );

  const listingCurrency = resolvePropertyCurrency(listing);
  const toDisplayMajor = (amount: number) =>
    convertCurrency(amount, listingCurrency, displayCurrency);
  const toNativeMajor = (amount: number) =>
    convertCurrency(amount, displayCurrency, listingCurrency);

  // State to support explicitly clearing weekend price
  const [customWeekendPriceVal, setCustomWeekendPriceVal] = useState<string>(
    listing.weekendPrice == null ? "" : String(toDisplayMajor(listing.weekendPrice / 100))
  );

  const handleDiscard = () => {
    setFormKey((k) => k + 1);
    setWeeklyEnabled(discountEnabled(rawDiscounts.weekly, weeklyDiscount));
    setMonthlyEnabled(discountEnabled(rawDiscounts.monthly, monthlyDiscount));
    setEarlyBirdEnabled(discountEnabled(rawDiscounts.early_bird, earlyBirdDiscount));
    setLastMinuteEnabled(discountEnabled(rawDiscounts.last_minute, lastMinuteDiscount));
    setNewListingEnabled(discountEnabled(newListingEntry, newListingDiscount));
    setCustomPromoEnabled(discountEnabled(rawDiscounts.custom_promotion, customPromoDiscount));
    setCustomWeekendPriceVal(
      listing.weekendPrice == null ? "" : String(toDisplayMajor(listing.weekendPrice / 100))
    );
    setDirty(false);
    setValidation("");
  };

  const renderInputField = ({
    name,
    label,
    defaultValue,
    value,
    onChange,
    suffix = "",
    prefix = "",
    min = 0,
    max,
    step = "1",
    helperText,
    inputMode = "numeric",
    placeholder,
    onClear,
    clearLabel,
    readOnly = false,
  }: {
    name: string;
    label: string;
    defaultValue?: number | string;
    value?: number | string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    suffix?: string;
    prefix?: string;
    min?: number;
    max?: number;
    step?: string;
    helperText?: string;
    inputMode?: "numeric" | "decimal" | "text";
    placeholder?: string;
    onClear?: () => void;
    clearLabel?: string;
    readOnly?: boolean;
  }) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label
          htmlFor={`input-${name}`}
          className="text-sm font-normal text-[#1f1f1f] dark:text-zinc-200"
        >
          {label}
        </label>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-[#DF4557] hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 transition-colors cursor-pointer text-left"
          >
            {clearLabel || "Remove"}
          </button>
        )}
      </div>

      <div className="relative flex items-center rounded-lg border border-[#727272] sm:min-h-[56px] min-h-[45px] dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-2xs transition-all focus-within:outline-0 hover:border-zinc-400 dark:hover:border-zinc-600">
        {prefix ? (
          <span className="pl-3.5 pr-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 select-none shrink-0">
            {prefix}
          </span>
        ) : null}

        <input
          id={`input-${name}`}
          aria-label={label}
          name={name}
          defaultValue={defaultValue}
          value={value}
          onChange={onChange}
          type="number"
          min={min}
          max={max}
          step={step}
          inputMode={inputMode}
          placeholder={placeholder}
          readOnly={readOnly}
          className="w-full min-w-0 bg-transparent px-3.5 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none read-only:cursor-not-allowed read-only:text-zinc-400 read-only:bg-zinc-50/60 dark:read-only:bg-zinc-900/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        {suffix ? (
          <span className="pr-3.5 pl-1 text-xs font-medium capitalize text-[#727272] dark:text-zinc-400 select-none shrink-0">
            {suffix}
          </span>
        ) : null}
      </div>

      {helperText && (
        <p className="text-xs leading-relaxed text-[#727272] dark:text-zinc-400">
          {helperText}
        </p>
      )}
    </div>
  );

  if (panel === "overview") {
    return (
      <div className="text-sm text-[#222222] dark:text-zinc-100">
        <div className="divide-y divide-[#DDDDDE] dark:divide-zinc-800">
          <button
            type="button"
            className="group flex w-full items-start justify-between gap-4 pb-8 text-left transition-colors hover:text-zinc-950 dark:hover:text-white cursor-pointer"
            onClick={() => setPanel("pricing")}
          >
            <div className="min-w-0">
              <p className="text-base font-medium text-[#222222] dark:text-zinc-100">
                Price settings
              </p>
              <div className="mt-3 flex flex-col gap-1.5 text-sm leading-5 text-[#727272] dark:text-[#727272]">
                <div>{formatMajor(((listing as any).weekdayBasePrice ?? listing.price) / 100, listingCurrency)} per night</div>
                <div>{weeklyDiscount}% weekly discount</div>
                <div>{monthlyDiscount}% monthly discount</div>
              </div>
            </div>
            <svg
              className="mt-0.5 size-5 shrink-0 text-[#222222] transition-transform group-hover:translate-x-0.5 dark:text-zinc-200"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          <button
            type="button"
            className="group flex w-full items-start justify-between gap-4 sm:py-8 py-5 text-left transition-colors hover:text-zinc-950 dark:hover:text-white cursor-pointer"
            onClick={() => setPanel("availability")}
          >
            <div className="min-w-0">
              <p className="text-base font-medium text-[#222222] dark:text-zinc-100">
                Availability settings
              </p>
              <div className="mt-3 flex flex-col gap-1.5 text-sm font-normal leading-5 text-[#727272] dark:text-zinc-400">
                <div>{listing.minNights ?? 1}–{listing.maxNights ?? 365} night stays</div>
                <div>{(listing as any).advanceNotice || "Same day"} advance notice</div>
              </div>
            </div>
            <svg
              className="mt-0.5 size-5 shrink-0 text-[#222222] transition-transform group-hover:translate-x-0.5 dark:text-zinc-200"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-[#1F1F1F] dark:text-zinc-100">
      <BackButton
        aria-label="Back to calendar settings"
        onClick={() => {
          if (dirty && typeof window !== "undefined") {
            if (!window.confirm("You have unsaved changes. Discard them?")) {
              return;
            }
          }
          handleDiscard();
          setPanel("overview");
        }}
        className="mb-4 cursor-pointer"
      />

      {panel === "availability" ? (
        /* Availability Settings Form */
        <form
          key={`avail-${formKey}`}
          onChange={() => setDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const minN = Number(data.get("minNights"));
            const maxN = Number(data.get("maxNights"));
            const guestsCount = Number(data.get("guests"));
            const advNotice = String(data.get("advanceNotice"));
            const cutoff = String(data.get("sameDayCutoff"));
            const allowSameDay = data.get("allowSameDayRequests") === "on";

            if (!Number.isFinite(minN) || minN < 1) {
              setValidation("Minimum stay must be at least 1 night.");
              return;
            }
            if (!Number.isFinite(maxN) || maxN < minN) {
              setValidation("Maximum stay must be greater than or equal to minimum stay.");
              return;
            }
            if (!Number.isFinite(guestsCount) || guestsCount < 1) {
              setValidation("Maximum guests must be at least 1.");
              return;
            }

            setValidation("");
            await onSave({
              minNights: minN,
              maxNights: maxN,
              guests: guestsCount,
              advanceNotice: advNotice,
              sameDayCutoff: cutoff,
              allowSameDayRequests: allowSameDay,
            });
            setDirty(false);
          }}
          className="space-y-5 pb-6"
        >
          <div>
            <h2 className="text-base font-medium text-[#1f1f1f] dark:text-zinc-100">
              Availability settings
            </h2>
            <p className="mt-1 text-sm text-[#727272] dark:text-zinc-400">
              Set global trip length rules and booking notice requirements.
            </p>
          </div>

          <div className="space-y-4">
            {renderInputField({
              name: "minNights",
              label: "Minimum stay",
              defaultValue: listing.minNights ?? 1,
              suffix: "nights",
              min: 1,
              max: 365,
              inputMode: "numeric",
              helperText: "Shortest reservation length guests can book.",
            })}

            {renderInputField({
              name: "maxNights",
              label: "Maximum stay",
              defaultValue: listing.maxNights ?? 365,
              suffix: "nights",
              min: 1,
              max: 365,
              inputMode: "numeric",
              helperText: "Longest reservation length guests can book.",
            })}

            {renderInputField({
              name: "guests",
              label: "Maximum guest capacity",
              defaultValue: (listing as any).guests ?? 1,
              suffix: "guests",
              min: 1,
              max: 50,
              inputMode: "numeric",
              helperText: "Maximum number of guests allowed per booking.",
            })}

            <div className="space-y-1">
              <label
                htmlFor="advanceNoticeSelect"
                className="block text-sm font-medium text-[#1f1f1f] dark:text-zinc-200"
              >
                Advance notice
              </label>
              <div className="relative flex items-center">
                <select
                  id="advanceNoticeSelect"
                  name="advanceNotice"
                  defaultValue={(listing as any).advanceNotice || "Same day"}
                  className="w-full appearance-none bg-transparent px-3.5 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer pr-9 border border-[#727272] sm:min-h-[56px] min-h-[45px] focus-within:outline-0 focus-within:shadow-none focus-visible:outline-0 focus-visible:shadow-none rounded-lg"
                >
                  <option value="Same day">Same day</option>
                  <option value="At least 1 day">At least 1 day</option>
                  <option value="At least 2 days">At least 2 days</option>
                  <option value="At least 3 days">At least 3 days</option>
                  <option value="At least 7 days">At least 7 days</option>
                </select>
                <span className="pointer-events-none absolute right-3.5 text-xs text-zinc-400">
                  ▾
                </span>
              </div>
              <p className="text-xs text-[#727272] dark:text-zinc-400">
                Required lead time before a guest can check in.
              </p>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="sameDayCutoffSelect"
                className="block text-sm font-medium text-[#1f1f1f] dark:text-zinc-200"
              >
                Same-day booking cutoff
              </label>
              <div className="w-full appearance-none bg-transparent px-3.5 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer pr-9 border border-[#727272] sm:min-h-[56px] min-h-[45px] focus-within:outline-0 focus-within:shadow-none focus-visible:outline-0 focus-visible:shadow-none rounded-lg">
                <select
                  id="sameDayCutoffSelect"
                  name="sameDayCutoff"
                  defaultValue={(listing as any).sameDayCutoff || "12:00 AM"}
                  className="w-full appearance-none bg-transparent px-3.5 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer pr-9"
                >
                  <option value="12:00 AM">12:00 AM (Midnight)</option>
                  <option value="6:00 AM">6:00 AM</option>
                  <option value="12:00 PM">12:00 PM (Noon)</option>
                  <option value="3:00 PM">3:00 PM</option>
                  <option value="6:00 PM">6:00 PM</option>
                  <option value="9:00 PM">9:00 PM</option>
                </select>
                <span className="pointer-events-none absolute right-3.5 text-xs text-zinc-400">
                  ▾
                </span>
              </div>
              <p className="text-xs text-[#727272] dark:text-zinc-400">
                Time after which guests cannot book a same-day reservation.
              </p>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800/40 p-3.5 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer">
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-[#1f1f1f] dark:text-zinc-200">
                  Allow same-day booking requests
                </span>
                <span className="block text-xs text-[#727272] dark:text-zinc-400 mt-0.5">
                  Let guests book on the day of arrival before the cutoff time.
                </span>
              </div>
              <input
                type="checkbox"
                name="allowSameDayRequests"
                defaultChecked={(listing as any).allowSameDayRequests !== false}
                className="size-5 rounded border-zinc-300 text-amber-500 focus:ring-amber-400 cursor-pointer accent-[#1f1f1f]"
              />
            </label>
          </div>

          {(validation || notice) && (
            <div
              role={validation ? "alert" : "status"}
              className={`rounded-xl p-3 text-xs leading-5 font-medium ${validation
                ? "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60"
                }`}
            >
              {validation || notice}
            </div>
          )}

          {/* Sticky Action Footer */}
          {(dirty || saving) && (
            <div className="sticky bottom-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs pt-3 pb-1 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 z-10 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={saving}
                className="flex-1 rounded-lg border border-zinc-300 dark:border-[#1f1f1f] bg-white dark:bg-[#1f1f1f] hover:bg-zinc-100 dark:hover:bg-[#1f1f1f] text-[#1f1f1f] hover:text-white dark:text-zinc-300 font-medium py-2.5 text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-[#FCDF9C] hover:bg-amber-300 text-[#1f1f1f] hover:text-white font-medium py-2.5 text-sm transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {saving ? "Saving…" : "Save availability"}
              </button>
            </div>
          )}
        </form>
      ) : (
        /* Price Settings Form */
        <form
          key={`price-${formKey}`}
          onChange={() => setDirty(true)}
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const num = (key: string) => Number(data.get(key));

            const price = toNativeMajor(num("price"));
            const weekendPriceRaw = data.get("weekendPrice");
            const weekendPriceVal =
              weekendPriceRaw === "" || weekendPriceRaw == null
                ? null
                : Math.round(toNativeMajor(Number(weekendPriceRaw)) * 100);

            const weekly = num("weekly");
            const monthly = num("monthly");
            const earlyBird = num("earlyBird");
            const lastMinute = num("lastMinute");
            const newListing = num("newListing");
            const customPromo = num("customPromo");
            const weeklyIsEnabled = data.get("weeklyEnabled") === "on";
            const monthlyIsEnabled = data.get("monthlyEnabled") === "on";
            const earlyBirdIsEnabled = data.get("earlyBirdEnabled") === "on";
            const lastMinuteIsEnabled = data.get("lastMinuteEnabled") === "on";
            const newListingIsEnabled = data.get("newListingEnabled") === "on";
            const customPromoIsEnabled = data.get("customPromoEnabled") === "on";
            const cleaning = data.get("cleaningFee")
              ? Math.round(toNativeMajor(num("cleaningFee")) * 100)
              : 0;
            const extraGuest = data.get("extraGuestFee")
              ? Math.round(toNativeMajor(num("extraGuestFee")) * 100)
              : 0;
            const includedGuestsVal = data.get("includedGuests")
              ? Math.max(1, Math.round(Number(data.get("includedGuests"))))
              : (rawDiscounts.includedGuests ?? rawDiscounts.baseGuests ?? 1);

            if (
              !Number.isFinite(price) ||
              price <= 0 ||
              weekly < 0 ||
              weekly > 100 ||
              monthly < 0 ||
              monthly > 100 ||
              earlyBird < 0 ||
              earlyBird > 100 ||
              lastMinute < 0 ||
              lastMinute > 100 ||
              newListing < 0 ||
              newListing > 100 ||
              customPromo < 0 ||
              customPromo > 100 ||
              (weeklyIsEnabled && weekly <= 0) ||
              (monthlyIsEnabled && monthly <= 0) ||
              (earlyBirdIsEnabled && earlyBird <= 0) ||
              (lastMinuteIsEnabled && lastMinute <= 0) ||
              (newListingIsEnabled && newListing <= 0) ||
              (customPromoIsEnabled && customPromo <= 0)
            ) {
              setValidation(
                "Please enter a valid base price and discount percentages between 0 and 100%."
              );
              return;
            }

            setValidation("");
            const updatedDiscounts = {
              ...rawDiscounts,
              weekly: { enabled: weeklyIsEnabled, percentage: weekly },
              monthly: { enabled: monthlyIsEnabled, percentage: monthly },
              early_bird:
              {
                enabled: earlyBirdIsEnabled,
                percentage: earlyBird,
                daysInAdvance: earlyBirdDaysInAdvance,
              },
              last_minute:
              {
                enabled: lastMinuteIsEnabled,
                percentage: lastMinute,
                daysBefore: lastMinuteDaysBefore,
              },
              new_listing:
                { enabled: newListingIsEnabled, percentage: newListing },
              custom_promotion:
              {
                ...(typeof rawDiscounts.custom_promotion === "object"
                  ? rawDiscounts.custom_promotion
                  : {}),
                enabled: customPromoIsEnabled,
                percentage: customPromo,
              },
              includedGuests: includedGuestsVal,
              baseGuests: includedGuestsVal,
            };

            await onSave({
              price: Math.round(price * 100),
              weekdayBasePrice: Math.round(price * 100),
              weekendPrice: weekendPriceVal,
              discounts: updatedDiscounts,
              cleaningFee: cleaning,
              extraGuestFee: extraGuest,
            });
            setDirty(false);
          }}
          className="space-y-6 pb-6"
        >
          {/* Base & Weekend Rates */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-medium text-[#1f1f1f] dark:text-zinc-100">
                Price settings
              </h2>
              <p className="mt-0.5 text-sm text-[#727272] dark:text-[#727272]">
                These apply to all nights, unless you customize them by date.
              </p>
            </div>

            {renderInputField({
              name: "price",
              label: "Weekday base rate",
              defaultValue:
                toDisplayMajor(((listing as any).weekdayBasePrice ?? listing.price) / 100),
              prefix: displayCurrency,
              min: 1,
              max: 100000,
              step: "0.01",
              inputMode: "decimal",
              helperText: "Applies to Sunday through Wednesday nights.",
            })}

            <ExpandControl
              title="Custom weekend price"
              subtitle={
                customWeekendPriceVal
                  ? `${displayCurrency} ${Number(customWeekendPriceVal).toLocaleString("en", { maximumFractionDigits: 2 })} / night`
                  : `Not configured (defaults to ${formatMajor(((listing as any).weekdayBasePrice ?? listing.price) / 100, listingCurrency)})`
              }
              defaultOpen={Boolean(listing.weekendPrice)}
            >
              {renderInputField({
                name: "weekendPrice",
                label: `Weekend rate (${displayCurrency})`,
                value: customWeekendPriceVal,
                onChange: (e) => {
                  setCustomWeekendPriceVal(e.target.value);
                  setDirty(true);
                },
                prefix: displayCurrency,
                min: 0,
                max: 100000,
                step: "0.01",
                inputMode: "decimal",
                placeholder: "Leave empty to use base rate",
                helperText:
                  "Applies to Thursday & Friday nights. Leave empty to use the weekday base rate.",
                onClear: customWeekendPriceVal
                  ? () => {
                    setCustomWeekendPriceVal("");
                    setDirty(true);
                  }
                  : undefined,
                clearLabel: "Clear",
              })}
            </ExpandControl>
          </section>

          {/* Discounts */}
          <section className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-5">
            <div>
              <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                Discounts
              </h3>
              <p className="mt-0.5 text-sm text-[#727272] dark:text-[#727272]">
                Encourage longer reservations with stay duration discounts.
              </p>
            </div>

            <ExpandControl
              title="Weekly ( 7 nights + )"
              subtitle="Applied automatically to bookings of 7 nights or more."
              defaultOpen={weeklyEnabled}
              control={discountToggle(
                "weeklyEnabled",
                "Toggle weekly discount",
                weeklyEnabled,
                setWeeklyEnabled
              )}
            >
              {renderInputField({
                name: "weekly",
                label: "Weekly discount",
                defaultValue: weeklyDiscount,
                suffix: "%",
                min: 1,
                max: 100,
                step: "1",
                inputMode: "numeric",
                readOnly: !weeklyEnabled,
              })}
            </ExpandControl>

            <ExpandControl
              title="Monthly (28+ nights)"
              subtitle="Applied automatically to bookings of 28 nights or more."
              defaultOpen={monthlyEnabled}
              control={discountToggle(
                "monthlyEnabled",
                "Toggle monthly discount",
                monthlyEnabled,
                setMonthlyEnabled
              )}
            >
              {renderInputField({
                name: "monthly",
                label: "Monthly discount",
                defaultValue: monthlyDiscount,
                suffix: "%",
                min: 1,
                max: 100,
                step: "1",
                inputMode: "numeric",
                readOnly: !monthlyEnabled,
              })}
            </ExpandControl>

            <ExpandControl
              title="Early-bird (30+ days advance)"
              subtitle="For bookings made at least 30 days before arrival."
              defaultOpen={earlyBirdEnabled}
              control={discountToggle(
                "earlyBirdEnabled",
                "Toggle early-bird discount",
                earlyBirdEnabled,
                setEarlyBirdEnabled
              )}
            >
              {renderInputField({
                name: "earlyBird",
                label: "Early-bird discount",
                defaultValue: earlyBirdDiscount,
                suffix: "%",
                min: 1,
                max: 100,
                step: "1",
                inputMode: "numeric",
                readOnly: !earlyBirdEnabled,
              })}
            </ExpandControl>

            <ExpandControl
              title="Last-minute (within 2 days)"
              subtitle="For bookings made within 2 days before arrival."
              defaultOpen={lastMinuteEnabled}
              control={discountToggle(
                "lastMinuteEnabled",
                "Toggle last-minute discount",
                lastMinuteEnabled,
                setLastMinuteEnabled
              )}
            >
              {renderInputField({
                name: "lastMinute",
                label: "Last-minute discount",
                defaultValue: lastMinuteDiscount,
                suffix: "%",
                min: 1,
                max: 100,
                step: "1",
                inputMode: "numeric",
                readOnly: !lastMinuteEnabled,
              })}
            </ExpandControl>
          </section>

          {/* Promotions */}
          <section className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-5">
            <div>
              <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                Promotions
              </h3>
              <p className="mt-0.5 text-sm text-[#727272] dark:text-zinc-400">
                Special promotional offers across your listing.
              </p>
            </div>

            <ExpandControl
              title="New listing promotion"
              subtitle={
                newListingEnabled && newListingDiscount > 0
                  ? `${newListingDiscount}% promotion for the first eligible bookings`
                  : "No new listing promotion configured"
              }
              defaultOpen={newListingEnabled}
              control={discountToggle(
                "newListingEnabled",
                "Toggle new listing promotion",
                newListingEnabled,
                setNewListingEnabled
              )}
            >
              {renderInputField({
                name: "newListing",
                label: "New listing discount (first 3 bookings)",
                defaultValue: newListingDiscount,
                suffix: "%",
                min: 1,
                max: 100,
                step: "1",
                inputMode: "numeric",
                readOnly: !newListingEnabled,
                helperText: "Applied automatically to eligible new listings until the first 3 bookings are completed.",
              })}
            </ExpandControl>

            <ExpandControl
              title="Custom promotion"
              subtitle={
                customPromoEnabled && customPromoDiscount > 0
                  ? `${customPromoDiscount}% promotional discount configured`
                  : "Property-wide promotional discount"
              }
              defaultOpen={customPromoEnabled}
              control={discountToggle(
                "customPromoEnabled",
                "Toggle custom promotion",
                customPromoEnabled,
                setCustomPromoEnabled
              )}
            >
              {renderInputField({
                name: "customPromo",
                label: "Special promotional discount",
                defaultValue: customPromoDiscount,
                suffix: "%",
                min: 1,
                max: 100,
                step: "1",
                inputMode: "numeric",
                readOnly: !customPromoEnabled,
                helperText: "Global promotional discount applied to eligible stays.",
              })}
            </ExpandControl>
          </section>

          {/* Additional Charges */}
          <section className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-5">
            <div>
              <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                Additional Charges
              </h3>
              <p className="mt-0.5 text-sm text-[#727272] dark:text-zinc-400">
                Host-defined fees for guests and cleaning.
              </p>
            </div>

            {renderInputField({
              name: "cleaningFee",
              label: "Cleaning fee",
              defaultValue: toDisplayMajor(((listing as any).cleaningFee || 0) / 100),
              prefix: displayCurrency,
              suffix: "/ stay",
              min: 0,
              max: 10000,
              step: "0.01",
              inputMode: "decimal",
              helperText: "One-time host cleaning fee recorded with property.",
            })}

            {renderInputField({
              name: "extraGuestFee",
              label: "Extra guest fee",
              defaultValue: toDisplayMajor(((listing as any).extraGuestFee || 0) / 100),
              prefix: displayCurrency,
              suffix: "/ guest / night",
              min: 0,
              max: 10000,
              step: "0.01",
              inputMode: "decimal",
              helperText: "Fee charged per extra guest per night beyond included guest capacity.",
            })}

            {renderInputField({
              name: "includedGuests",
              label: "Included guests",
              defaultValue: String(
                rawDiscounts.includedGuests ??
                rawDiscounts.baseGuests ??
                1
              ),
              suffix: "guests",
              min: 1,
              max: listing.guests || 20,
              step: "1",
              inputMode: "numeric",
              helperText: `Base capacity included before extra guest fee applies (max capacity: ${listing.guests || 1}).`,
            })}
          </section>

          {(validation || notice) && (
            <div
              role={validation ? "alert" : "status"}
              className={`rounded-xl p-3 text-xs leading-5 font-medium ${validation
                ? "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60"
                }`}
            >
              {validation || notice}
            </div>
          )}

          {/* Sticky Action Footer */}
          {(dirty || saving) && (
              <div className="sticky bottom-0 bg-white/95 dark:bg-[#1f1f1f] backdrop-blur-xs py-3 pb-1 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 z-10 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={saving}
                  className="rounded-lg border border-[#1f1f1f] bg-white dark:bg-[#1f1f1f] hover:bg-zinc-100 dark:hover:bg-[#1f1f1f] text-[#1f1f1f] dark:text-white font-medium py-2.5 text-xs transition-colors cursor-pointer disabled:opacity-50 px-2 flex-1"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={saving}
                  className="rounded-lg bg-[#FCDF9C] hover:bg-[#1f1f1f] text-[#1f1f1f] hover:text-white font-medium py-2.5 text-xs transition-colors cursor-pointer disabled:opacity-50 px-2 flex-1"
              >
                {saving ? "Saving…" : "Save price settings"}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
