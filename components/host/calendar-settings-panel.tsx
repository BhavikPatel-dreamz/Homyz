"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import { BackButton } from "@/components/ui/back-button";
import type { ListingDTO } from "@/services/mappers";
import { convertCurrency, resolvePropertyCurrency } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";
import { useLanguage } from "@/lib/i18n/language-context";
import { dateScopedCancellationPolicyOptions } from "@/lib/booking/date-cancellation-policy";

type DiscountDetails = {
  enabled?: boolean;
  percentage?: number;
  discountPercentage?: number;
  daysInAdvance?: number;
  daysBefore?: number;
  startDate?: string | null;
  endDate?: string | null;
};

function asDiscountDetails(value: unknown): DiscountDetails | undefined {
  return typeof value === "object" && value !== null
    ? (value as DiscountDetails)
    : undefined;
}

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
          <span className="block text-base font-normal text-[#1f1f1f] dark:text-zinc-100">
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

type MobileSettingsTab = "pricing" | "discounts" | "availability" | "cancellations";
type MobileSettingsEditor =
  | "base-price"
  | "weekend-price"
  | "fees"
  | "weekly"
  | "monthly"
  | "early-bird"
  | "last-minute"
  | "new-listing"
  | "custom-promotion"
  | "min-nights"
  | "max-nights"
  | "guest-capacity"
  | "advance-notice"
  | "same-day-cutoff"
  | "short-policy"
  | "long-policy";

type MobileDiscountKey = "weekly" | "monthly" | "early_bird" | "last_minute" | "new_listing" | "custom_promotion";

function SettingsSummaryCard({
  label,
  description,
  value,
  onClick,
  children,
}: {
  label: string;
  description?: string;
  value?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-5 text-[#222222] dark:text-zinc-100">{label}</p>
        {description && <p className="mt-1 text-sm leading-5 text-[#717171] dark:text-zinc-400">{description}</p>}
        {value !== undefined && <div className="mt-3 text-[24px] font-medium leading-7 tracking-[-0.02em] text-[#222222] dark:text-zinc-100">{value}</div>}
      </div>
      {children}
      {onClick && <svg className="mt-1 size-5 shrink-0 text-[#222222] dark:text-zinc-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>}
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-3 rounded-[18px] border border-[#dddddd] bg-white px-[18px] py-[20px] text-left transition-[border-color,transform,background-color] hover:border-[#b8b8b8] active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600">
      {content}
    </button>
  ) : <div className="flex w-full items-start gap-3 rounded-[18px] border border-[#dddddd] bg-white px-[18px] py-[20px] dark:border-zinc-700 dark:bg-zinc-900">{content}</div>;
}

function SettingsSwitch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative mt-0.5 flex h-8 w-14 shrink-0 items-center rounded-full border p-0.5 transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222222] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 dark:focus-visible:ring-white dark:focus-visible:ring-offset-zinc-950 ${checked ? "border-[#222222] bg-[#222222] dark:border-white dark:bg-white" : "border-[#b8b8b8] bg-[#b8b8b8] dark:border-zinc-600 dark:bg-zinc-700"}`}
    >
      <span className={`size-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.28)] transition-transform duration-200 ease-out dark:bg-zinc-950 ${checked ? "translate-x-6" : "translate-x-0"}`} />
    </button>
  );
}

function SettingsToggleCard({
  label,
  description,
  value,
  checked,
  disabled,
  onOpen,
  onToggle,
}: {
  label: string;
  description: string;
  value: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[18px] border border-[#dddddd] bg-white px-[18px] py-[20px] dark:border-zinc-700 dark:bg-zinc-900">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left transition-opacity hover:opacity-75">
        <p className="text-[15px] font-medium leading-5 text-[#222222] dark:text-zinc-100">{label}</p>
        <p className="mt-1 text-sm leading-5 text-[#717171] dark:text-zinc-400">{description}</p>
        <p className="mt-3 text-[24px] font-medium leading-7 tracking-[-0.02em] text-[#222222] dark:text-zinc-100">{value}</p>
      </button>
      <SettingsSwitch label={label} checked={checked} disabled={disabled} onChange={onToggle} />
    </div>
  );
}

/** A focused listing-level editor for the compact calendar workspace. */
export function MobileCalendarSettings({
  listing,
  saving,
  notice,
  onSave,
  onClose,
}: {
  listing: ListingDTO;
  saving: boolean;
  notice: string;
  onSave: (values: Record<string, unknown>) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<MobileSettingsTab>("pricing");
  const [editor, setEditor] = useState<MobileSettingsEditor | null>(null);
  const [message, setMessage] = useState("");
  const [smartPricing, setSmartPricing] = useState(Boolean(listing.smartPricing));
  const [allowSameDayRequests, setAllowSameDayRequests] = useState(listing.allowSameDayRequests !== false);
  const tabRefs = useRef<Record<MobileSettingsTab, HTMLButtonElement | null>>({
    pricing: null,
    discounts: null,
    availability: null,
    cancellations: null,
  });
  const currency = resolvePropertyCurrency(listing);
  const discounts = listing.discounts && typeof listing.discounts === "object"
    ? listing.discounts as Record<string, unknown>
    : {};
  const percentage = (value: unknown, fallback = 0) => {
    const details = asDiscountDetails(value);
    const raw = details?.percentage ?? details?.discountPercentage ?? value;
    if (typeof raw === "number" || typeof raw === "string") return Number(raw) || 0;
    return value === true || details ? fallback : 0;
  };
  const basePrice = (listing.weekdayBasePrice ?? listing.price ?? 0) / 100;
  const weekendPrice = listing.weekendPrice == null ? null : listing.weekendPrice / 100;
  const cleaningFee = (listing.cleaningFee ?? 0) / 100;
  const extraGuestFee = Number((listing as Record<string, unknown>).extraGuestFee ?? 0) / 100;
  const getDiscount = (entry: unknown, fallback = 0) => {
    const details = asDiscountDetails(entry);
    const value = percentage(entry, fallback);
    return {
      details,
      value,
      enabled: details?.enabled !== false && value > 0,
    };
  };
  const weeklyConfig = getDiscount(discounts.weekly, 10);
  const monthlyConfig = getDiscount(discounts.monthly, 25);
  const earlyBirdConfig = getDiscount(discounts.early_bird ?? discounts.earlyBird, 10);
  const lastMinuteConfig = getDiscount(discounts.last_minute ?? discounts.lastMinute, 15);
  const newListingEntry = discounts.new_listing ?? discounts.newListing;
  const newListingConfig = getDiscount(newListingEntry, 20);
  const customPromotionConfig = getDiscount(discounts.custom_promotion, 15);
  const weekly = weeklyConfig.value;
  const monthly = monthlyConfig.value;
  const earlyBird = earlyBirdConfig.value;
  const lastMinute = lastMinuteConfig.value;
  const newListing = newListingConfig.value;
  const customPromotion = customPromotionConfig.value;
  const formatAmount = (amount: number) => `${currency} ${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(amount)}`;
  const policyLabel = (policy: string | null | undefined) => (policy || "FLEXIBLE").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  const weekendAdjustment = weekendPrice !== null && basePrice > 0 ? Math.round(((weekendPrice - basePrice) / basePrice) * 100) : null;

  const save = async (values: Record<string, unknown>, closeEditor = true) => {
    setMessage("");
    const result = await onSave(values);
    if (result === true) {
      setMessage(t("host_calendar_notice_saved", "Changes saved."));
      if (closeEditor) setEditor(null);
      return true;
    }
    setMessage(t("host_calendar_notice_could_not_save", "Could not save. Please try again."));
    return false;
  };

  useEffect(() => {
    if (!editor) return;
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [editor]);
  const fieldClass = "mt-2 h-12 w-full rounded-xl border border-[#bdbdbd] bg-white px-3.5 text-base font-medium text-[#1F1F1F] outline-none transition-colors focus:border-[#222222] focus:ring-1 focus:ring-[#222222] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
  const tabs: Array<{ id: MobileSettingsTab; label: string }> = [
    { id: "pricing", label: t("host_calendar_price_settings", "Pricing") },
    { id: "discounts", label: t("host_calendar_stay_discounts_heading", "Discounts") },
    { id: "availability", label: t("host_calendar_avail_settings", "Availability") },
    { id: "cancellations", label: t("host_calendar_cancellation_policy", "Cancellations") },
  ];

  const openEditor = (nextEditor: MobileSettingsEditor) => {
    setMessage("");
    setEditor(nextEditor);
  };
  const discountEntry = (key: MobileDiscountKey) => key === "new_listing" ? newListingEntry : discounts[key];
  const discountValues = (
    key: MobileDiscountKey,
    value: number,
    enabled = value > 0,
    extra: Record<string, unknown> = {},
  ) => ({
    discounts: {
      ...discounts,
      [key]: {
        ...asDiscountDetails(discountEntry(key)),
        ...extra,
        enabled,
        percentage: value,
      },
    },
  });
  const toggleDiscount = (key: MobileDiscountKey, enabled: boolean, editorForValue: MobileSettingsEditor) => {
    const current = getDiscount(discountEntry(key), key === "weekly" ? 10 : key === "monthly" ? 25 : key === "last_minute" ? 15 : key === "new_listing" ? 20 : key === "early_bird" ? 10 : 15);
    if (enabled && current.value <= 0) {
      setMessage(t("host_calendar_discount_amount_required", "Set a discount amount before enabling it."));
      openEditor(editorForValue);
      return;
    }
    void save(discountValues(key, current.value, enabled), false);
  };
  const handleEditorSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const number = (name: string) => Number(data.get(name));
    if (editor === "base-price") {
      const value = number("price");
      if (!Number.isFinite(value) || value <= 0) return setMessage(t("host_calendar_err_valid_price", "Enter a valid price greater than 0."));
      await save({ price: Math.round(value * 100), weekdayBasePrice: Math.round(value * 100) });
    } else if (editor === "weekend-price") {
      const raw = String(data.get("weekendPrice") ?? "");
      const value = raw === "" ? null : Number(raw);
      if (value !== null && (!Number.isFinite(value) || value < 0)) return setMessage(t("host_calendar_err_valid_price", "Enter a valid price."));
      await save({ weekendPrice: value === null ? null : Math.round(value * 100) });
    } else if (editor === "fees") {
      const nextCleaningFee = number("cleaningFee");
      const nextExtraGuestFee = number("extraGuestFee");
      const includedGuests = number("includedGuests");
      if (![nextCleaningFee, nextExtraGuestFee].every((value) => Number.isFinite(value) && value >= 0) || !Number.isInteger(includedGuests) || includedGuests < 1 || includedGuests > (listing.guests ?? 1)) return setMessage(t("host_calendar_included_guests_invalid", "Included guests must be between 1 and the maximum guest capacity."));
      await save({
        cleaningFee: Math.round(nextCleaningFee * 100),
        extraGuestFee: Math.round(nextExtraGuestFee * 100),
        discounts: {
          ...discounts,
          includedGuests,
          baseGuests: includedGuests,
        },
      });
    } else if (["weekly", "monthly", "early-bird", "last-minute", "new-listing", "custom-promotion"].includes(editor || "")) {
      const value = number("percentage");
      if (!Number.isFinite(value) || value < 0 || value > 100) return setMessage(t("host_calendar_err_price_discount_range", "Enter a discount percentage between 0 and 100%."));
      const key: MobileDiscountKey = editor === "early-bird" ? "early_bird" : editor === "last-minute" ? "last_minute" : editor === "new-listing" ? "new_listing" : editor === "custom-promotion" ? "custom_promotion" : editor as "weekly" | "monthly";
      const days = Number(data.get("bookingWindow"));
      if ((key === "early_bird" || key === "last_minute") && (!Number.isInteger(days) || days < 0 || days > 365)) return setMessage(t("host_calendar_discount_window_invalid", "Enter a booking window between 0 and 365 days."));
      const startDate = String(data.get("startDate") ?? "");
      const endDate = String(data.get("endDate") ?? "");
      if (key === "custom_promotion" && startDate && endDate && startDate > endDate) return setMessage(t("host_calendar_promo_dates_invalid", "The promotion end date must be on or after the start date."));
      await save(discountValues(key, value, value > 0, key === "early_bird" ? { daysInAdvance: days } : key === "last_minute" ? { daysBefore: days } : key === "custom_promotion" ? { startDate: startDate || null, endDate: endDate || null } : {}));
    } else if (editor === "min-nights") {
      const value = number("minNights");
      if (!Number.isInteger(value) || value < 1 || value > (listing.maxNights ?? 365)) return setMessage(t("host_calendar_max_stay_err_gte_min", "Minimum stay must be at least 1 and cannot exceed maximum stay."));
      await save({ minNights: value });
    } else if (editor === "max-nights") {
      const value = number("maxNights");
      if (!Number.isInteger(value) || value < (listing.minNights ?? 1) || value > 365) return setMessage(t("host_calendar_max_stay_err_gte_min", "Maximum stay must be greater than or equal to minimum stay."));
      await save({ maxNights: value });
    } else if (editor === "guest-capacity") {
      const value = number("guests");
      const includedGuests = Number(discounts.includedGuests ?? discounts.baseGuests ?? 1);
      if (!Number.isInteger(value) || value < 1 || value > 50 || value < includedGuests) return setMessage(t("host_calendar_max_guests_err_at_least_1", "Maximum guest capacity must be at least the included guest count."));
      await save({ guests: value });
    } else if (editor === "advance-notice") {
      await save({ advanceNotice: String(data.get("advanceNotice")) });
    } else if (editor === "same-day-cutoff") {
      await save({ sameDayCutoff: String(data.get("sameDayCutoff")) });
    } else if (editor === "short-policy") {
      await save({ cancellationPolicy: String(data.get("cancellationPolicy")) });
    } else if (editor === "long-policy") {
      await save({ longTermCancellationPolicy: String(data.get("longTermCancellationPolicy")) });
    }
  };

  const editorTitle: Record<MobileSettingsEditor, string> = {
    "base-price": t("host_calendar_weekday_base_rate", "Per night"),
    "weekend-price": t("host_calendar_custom_weekend_price", "Weekend price"),
    fees: t("host_calendar_additional_charges_heading", "Fees"),
    weekly: t("host_calendar_weekly_discount_label", "Weekly"),
    monthly: t("host_calendar_monthly_discount_label", "Monthly"),
    "early-bird": t("host_calendar_early_bird_discount", "Early-bird"),
    "last-minute": t("host_calendar_last_minute_discount", "Last-minute"),
    "new-listing": t("host_calendar_new_listing_promo", "New listing promotion"),
    "custom-promotion": t("host_calendar_custom_promo", "Custom promotion"),
    "min-nights": t("host_calendar_minimum_nights", "Minimum nights"),
    "max-nights": t("host_calendar_max_stay_label", "Maximum nights"),
    "guest-capacity": t("host_calendar_max_guest_label", "Maximum guest capacity"),
    "advance-notice": t("host_calendar_advance_notice_label", "Advance notice"),
    "same-day-cutoff": t("host_calendar_same_day_cutoff_label", "Same-day advance notice"),
    "short-policy": t("host_calendar_cancellation_policy", "Short-term stays"),
    "long-policy": t("host_calendar_long_term_policy", "Long-term stays"),
  };

  return (
    <section className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-white text-[#1F1F1F] dark:bg-zinc-950 dark:text-zinc-100">
      <header className="flex items-center justify-between px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label={t("host_close", "Close settings")} className="flex size-10 items-center justify-center rounded-full bg-[#f3f3f3] text-xl transition-colors hover:bg-[#e8e8e8] dark:bg-zinc-800">
          ×
        </button>
        <span className="rounded-full border border-[#dedede] px-3 py-1.5 text-xs font-medium dark:border-zinc-700">{currency}</span>
      </header>
      <div className="px-5 pb-4">
        <h1 className="text-2xl sm:text-[28px] font-medium tracking-tight text-[#222222] dark:text-zinc-100">{t("host_calendar_settings", "Settings")}</h1>
        <div className="-mx-5 mt-3 flex max-w-none gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((item) => (
            <button key={item.id} ref={(node) => { tabRefs.current[item.id] = node; }} type="button" onClick={() => { setTab(item.id); setMessage(""); requestAnimationFrame(() => tabRefs.current[item.id]?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })); }} aria-pressed={tab === item.id} className={`shrink-0 rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors ${tab === item.id ? "bg-[#1F1F1F] text-white dark:bg-white dark:text-zinc-950" : "bg-[#f5f5f5] text-[#1F1F1F] hover:bg-[#ececec] dark:bg-zinc-900 dark:text-zinc-200"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 touch-pan-y overscroll-contain overflow-x-hidden overflow-y-auto px-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {tab === "pricing" && (
          <div className="space-y-4">
            <SettingsSummaryCard label={t("host_calendar_weekday_base_rate", "Per night")} value={formatAmount(basePrice)} onClick={() => openEditor("base-price")} />
            <SettingsSummaryCard label={t("host_calendar_custom_weekend_price", "Weekend adjustment")} value={weekendAdjustment === null ? t("host_calendar_weekend_not_configured", "Not configured") : `${weekendAdjustment > 0 ? "+" : ""}${weekendAdjustment}%`} description={weekendPrice === null ? t("host_calendar_weekend_placeholder", "Uses the base rate") : formatAmount(weekendPrice)} onClick={() => openEditor("weekend-price")} />
            <SettingsSummaryCard label={t("host_calendar_smart_pricing", "Smart Pricing")} description={t("host_calendar_smart_pricing_description", "Your prices will be automatically adjusted based on guest demand.")}><SettingsSwitch label={t("host_calendar_smart_pricing", "Smart Pricing")} checked={smartPricing} disabled={saving} onChange={() => { const next = !smartPricing; void save({ smartPricing: next }, false).then((saved) => { if (saved) setSmartPricing(next); }); }} /></SettingsSummaryCard>
            <SettingsSummaryCard label={t("host_calendar_additional_charges_heading", "Fees")} description={[cleaningFee > 0 && t("host_calendar_cleaning_fee_label", "Cleaning fee"), extraGuestFee > 0 && t("host_calendar_extra_guest_fee_label", "Extra guest fee")].filter(Boolean).join(", ") || t("host_calendar_no_fees", "No additional fees")} onClick={() => openEditor("fees")} />
          </div>
        )}
        {tab === "discounts" && (
          <div className="space-y-4">
            <SettingsToggleCard label={t("host_calendar_weekly_discount_label", "Weekly")} description={t("host_calendar_weekly_discount_sub", "For 7 nights or more")} value={weeklyConfig.enabled ? `${weekly}%` : t("host_calendar_off", "Off")} checked={weeklyConfig.enabled} disabled={saving} onOpen={() => openEditor("weekly")} onToggle={() => toggleDiscount("weekly", !weeklyConfig.enabled, "weekly")} />
            <SettingsToggleCard label={t("host_calendar_monthly_discount_label", "Monthly")} description={t("host_calendar_monthly_discount_sub", "For 28 nights or more")} value={monthlyConfig.enabled ? `${monthly}%` : t("host_calendar_off", "Off")} checked={monthlyConfig.enabled} disabled={saving} onOpen={() => openEditor("monthly")} onToggle={() => toggleDiscount("monthly", !monthlyConfig.enabled, "monthly")} />
            <SettingsToggleCard label={t("host_calendar_early_bird_discount", "Early-bird")} description={t("host_calendar_early_bird_sub", { days: earlyBirdConfig.details?.daysInAdvance ?? 30 }, `For bookings made at least ${earlyBirdConfig.details?.daysInAdvance ?? 30} days in advance`)} value={earlyBirdConfig.enabled ? `${earlyBird}%` : t("host_calendar_off", "Off")} checked={earlyBirdConfig.enabled} disabled={saving} onOpen={() => openEditor("early-bird")} onToggle={() => toggleDiscount("early_bird", !earlyBirdConfig.enabled, "early-bird")} />
            <SettingsToggleCard label={t("host_calendar_last_minute_discount", "Last-minute")} description={t("host_calendar_last_minute_sub", { days: lastMinuteConfig.details?.daysBefore ?? 2 }, `For stays booked within ${lastMinuteConfig.details?.daysBefore ?? 2} days before arrival`)} value={lastMinuteConfig.enabled ? `${lastMinute}%` : t("host_calendar_off", "Off")} checked={lastMinuteConfig.enabled} disabled={saving} onOpen={() => openEditor("last-minute")} onToggle={() => toggleDiscount("last_minute", !lastMinuteConfig.enabled, "last-minute")} />
            <SettingsToggleCard label={t("host_calendar_new_listing_promo", "New listing promotion")} description={t("host_calendar_new_listing_sub", { pct: newListing || 0 }, `${newListing || 0}% promotion for the first eligible bookings`)} value={newListingConfig.enabled ? `${newListing}%` : t("host_calendar_off", "Off")} checked={newListingConfig.enabled} disabled={saving} onOpen={() => openEditor("new-listing")} onToggle={() => toggleDiscount("new_listing", !newListingConfig.enabled, "new-listing")} />
            <SettingsToggleCard label={t("host_calendar_custom_promo", "Custom promotion")} description={customPromotionConfig.details?.startDate || customPromotionConfig.details?.endDate ? `${customPromotionConfig.details?.startDate || t("host_calendar_any_date", "Any date")} – ${customPromotionConfig.details?.endDate || t("host_calendar_any_date", "Any date")}` : t("host_calendar_custom_promo_helper", "Property-wide promotional discount applied to eligible stays.")} value={customPromotionConfig.enabled ? `${customPromotion}%` : t("host_calendar_off", "Off")} checked={customPromotionConfig.enabled} disabled={saving} onOpen={() => openEditor("custom-promotion")} onToggle={() => toggleDiscount("custom_promotion", !customPromotionConfig.enabled, "custom-promotion")} />
          </div>
        )}
        {tab === "availability" && (
          <div className="space-y-4">
            <SettingsSummaryCard label={t("host_calendar_minimum_nights", "Minimum nights")} value={listing.minNights ?? 1} onClick={() => openEditor("min-nights")} />
            <SettingsSummaryCard label={t("host_calendar_max_stay_label", "Maximum nights")} value={listing.maxNights ?? 365} onClick={() => openEditor("max-nights")} />
            <SettingsSummaryCard label={t("host_calendar_max_guest_label", "Maximum guest capacity")} value={listing.guests ?? 1} onClick={() => openEditor("guest-capacity")} />
            <SettingsSummaryCard label={t("host_calendar_advance_notice_label", "Advance notice")} value={listing.advanceNotice || t("host_notice_same_day", "Same day")} onClick={() => openEditor("advance-notice")} />
            <SettingsSummaryCard label={t("host_calendar_same_day_cutoff_label", "Same-day booking cutoff")} description={allowSameDayRequests ? undefined : t("host_calendar_same_day_disabled", "Same-day requests are currently disabled")} value={listing.sameDayCutoff || "12:00 AM"} onClick={() => openEditor("same-day-cutoff")} />
            <SettingsSummaryCard label={t("host_calendar_allow_same_day_title", "Allow same-day booking requests")} description={t("host_calendar_allow_same_day_subtitle", "Let guests book on the day of arrival before the cutoff time.")}><SettingsSwitch label={t("host_calendar_allow_same_day_title", "Allow same-day booking requests")} checked={allowSameDayRequests} disabled={saving} onChange={() => { const next = !allowSameDayRequests; void save({ allowSameDayRequests: next }, false).then((saved) => { if (saved) setAllowSameDayRequests(next); }); }} /></SettingsSummaryCard>
          </div>
        )}
        {tab === "cancellations" && (
          <div className="space-y-4">
            <SettingsSummaryCard label={t("host_calendar_short_term_stays", "Short-term stays")} description={t("host_calendar_short_term_description", "For less than 28 nights")} value={policyLabel(listing.cancellationPolicy)} onClick={() => openEditor("short-policy")} />
            <SettingsSummaryCard label={t("host_calendar_long_term_stays", "Long-term stays")} description={t("host_calendar_long_term_description", "For 28 nights or more")} value={policyLabel(listing.longTermCancellationPolicy)} onClick={() => openEditor("long-policy")} />
            <p className="px-3 pt-3 text-center text-sm leading-5 text-[#717171] dark:text-zinc-400">{t("host_calendar_policy_checkin_scope", "Changes apply to new reservations. Existing bookings keep their saved terms.")}</p>
          </div>
        )}
        {(message || notice) && <p role={message ? "status" : "alert"} className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{message || notice}</p>}
      </div>
      {editor && <div className="fixed inset-0 z-[120] flex touch-pan-y items-end bg-black/40 p-0 sm:items-center sm:justify-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditor(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="calendar-setting-editor-title" className="flex max-h-[calc(100dvh-1rem)] w-full min-h-0 flex-col overflow-y-auto overscroll-contain rounded-t-[24px] bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl animate-in slide-in-from-bottom duration-200 dark:bg-zinc-950 sm:max-w-md sm:rounded-[24px] sm:animate-in sm:zoom-in-95">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#dddddd] dark:bg-zinc-700" />
          <div className="mb-5 flex items-center justify-between gap-3"><h2 id="calendar-setting-editor-title" className="text-lg sm:text-xl font-medium tracking-tight text-[#222222] dark:text-zinc-100">{editorTitle[editor]}</h2><button type="button" onClick={() => setEditor(null)} disabled={saving} aria-label={t("host_close", "Close")} className="flex size-9 items-center justify-center rounded-full bg-[#f3f3f3] text-xl dark:bg-zinc-800">×</button></div>
          <form onSubmit={handleEditorSubmit} className="space-y-5">
            {editor === "base-price" && <label className="block text-sm font-medium">{t("host_calendar_weekday_base_rate", "Per night")}<input autoFocus name="price" defaultValue={basePrice} type="number" min="0.01" step="0.01" inputMode="decimal" className={fieldClass} /><span className="mt-2 block text-sm font-normal text-[#717171]">{currency} · {t("host_calendar_per_night", "per night")}</span></label>}
            {editor === "weekend-price" && <label className="block text-sm font-medium">{t("host_calendar_custom_weekend_price", "Weekend price")}<input autoFocus name="weekendPrice" defaultValue={weekendPrice ?? ""} placeholder={t("host_calendar_weekend_placeholder", "Use base rate")} type="number" min="0" step="0.01" inputMode="decimal" className={fieldClass} /><span className="mt-2 block text-sm font-normal text-[#717171]">{t("host_calendar_weekend_helper", "Leave empty to use the base rate.")}</span></label>}
            {editor === "fees" && <><label className="block text-sm font-medium">{t("host_calendar_cleaning_fee_label", "Cleaning fee")}<input autoFocus name="cleaningFee" defaultValue={cleaningFee} type="number" min="0" step="0.01" inputMode="decimal" className={fieldClass} /><span className="mt-1 block text-xs font-normal text-[#717171]">{t("host_calendar_per_stay", "Per stay")}</span></label><label className="block text-sm font-medium">{t("host_calendar_extra_guest_fee_label", "Extra guest fee")}<input name="extraGuestFee" defaultValue={extraGuestFee} type="number" min="0" step="0.01" inputMode="decimal" className={fieldClass} /><span className="mt-1 block text-xs font-normal text-[#717171]">{t("host_calendar_per_guest_per_night", "Per guest, per night")}</span></label><label className="block text-sm font-medium">{t("host_calendar_included_guests_label", "Included guests")}<input name="includedGuests" defaultValue={Number(discounts.includedGuests ?? discounts.baseGuests ?? 1)} type="number" min="1" max={listing.guests ?? 1} step="1" inputMode="numeric" className={fieldClass} /><span className="mt-1 block text-xs font-normal text-[#717171]">{t("host_calendar_included_guests_helper", { max: listing.guests ?? 1 }, `Included before the extra guest fee applies (maximum ${listing.guests ?? 1}).`)}</span></label></>}
            {["weekly", "monthly", "early-bird", "last-minute", "new-listing", "custom-promotion"].includes(editor) && <><label className="block text-sm font-medium">{t("host_calendar_discount_percentage", "Discount percentage")}<div className="relative"><input autoFocus name="percentage" defaultValue={editor === "weekly" ? weekly : editor === "monthly" ? monthly : editor === "early-bird" ? earlyBird : editor === "last-minute" ? lastMinute : editor === "new-listing" ? newListing : customPromotion} type="number" min="0" max="100" step="1" inputMode="numeric" className={`${fieldClass} pr-10`} /><span className="absolute bottom-3 right-3.5 text-sm text-[#717171]">%</span></div></label>{editor === "early-bird" && <label className="block text-sm font-medium">{t("host_calendar_advance_booking_days", "Days in advance")}<input name="bookingWindow" defaultValue={earlyBirdConfig.details?.daysInAdvance ?? 30} type="number" min="0" max="365" step="1" inputMode="numeric" className={fieldClass} /></label>}{editor === "last-minute" && <label className="block text-sm font-medium">{t("host_calendar_last_minute_window", "Days before arrival")}<input name="bookingWindow" defaultValue={lastMinuteConfig.details?.daysBefore ?? 2} type="number" min="0" max="365" step="1" inputMode="numeric" className={fieldClass} /></label>}{editor === "custom-promotion" && <><label className="block text-sm font-medium">{t("host_calendar_promotion_start", "Promotion start date")}<input name="startDate" defaultValue={customPromotionConfig.details?.startDate || ""} type="date" className={fieldClass} /></label><label className="block text-sm font-medium">{t("host_calendar_promotion_end", "Promotion end date")}<input name="endDate" defaultValue={customPromotionConfig.details?.endDate || ""} type="date" className={fieldClass} /></label></>}</>}
            {editor === "min-nights" && <label className="block text-sm font-medium">{t("host_calendar_minimum_nights", "Minimum nights")}<input autoFocus name="minNights" defaultValue={listing.minNights ?? 1} type="number" min="1" max={listing.maxNights ?? 365} step="1" inputMode="numeric" className={fieldClass} /></label>}
            {editor === "max-nights" && <label className="block text-sm font-medium">{t("host_calendar_max_stay_label", "Maximum nights")}<input autoFocus name="maxNights" defaultValue={listing.maxNights ?? 365} type="number" min={listing.minNights ?? 1} max="365" step="1" inputMode="numeric" className={fieldClass} /></label>}
            {editor === "guest-capacity" && <label className="block text-sm font-medium">{t("host_calendar_max_guest_label", "Maximum guest capacity")}<input autoFocus name="guests" defaultValue={listing.guests ?? 1} type="number" min={Number(discounts.includedGuests ?? discounts.baseGuests ?? 1)} max="50" step="1" inputMode="numeric" className={fieldClass} /><span className="mt-2 block text-sm font-normal text-[#717171]">{t("host_calendar_max_guest_helper", "This must not be less than the number of included guests.")}</span></label>}
            {editor === "advance-notice" && <label className="block text-sm font-medium">{t("host_calendar_advance_notice_label", "Advance notice")}<select name="advanceNotice" defaultValue={listing.advanceNotice || "Same day"} className={fieldClass}><option value="Same day">{t("host_notice_same_day", "Same day")}</option><option value="At least 1 day">{t("host_notice_at_least_1_day", "At least 1 day")}</option><option value="At least 2 days">{t("host_notice_at_least_2_days", "At least 2 days")}</option><option value="At least 3 days">{t("host_notice_at_least_3_days", "At least 3 days")}</option><option value="At least 7 days">{t("host_notice_at_least_7_days", "At least 7 days")}</option></select></label>}
            {editor === "same-day-cutoff" && <label className="block text-sm font-medium">{t("host_calendar_same_day_cutoff_label", "Same-day advance notice")}<select name="sameDayCutoff" defaultValue={listing.sameDayCutoff || "12:00 AM"} className={fieldClass}><option value="12:00 AM">12:00 AM</option><option value="6:00 AM">6:00 AM</option><option value="12:00 PM">12:00 PM</option><option value="3:00 PM">3:00 PM</option><option value="6:00 PM">6:00 PM</option><option value="9:00 PM">9:00 PM</option></select></label>}
            {editor === "short-policy" && <label className="block text-sm font-medium">{t("host_calendar_cancellation_policy", "Cancellation policy")}<select name="cancellationPolicy" defaultValue={listing.cancellationPolicy || "FLEXIBLE"} className={fieldClass}>{dateScopedCancellationPolicyOptions.map((option) => <option key={option.policyId} value={option.policyId}>{option.policyName.replace(/ Policy$/, "")}</option>)}</select></label>}
            {editor === "long-policy" && <label className="block text-sm font-medium">{t("host_calendar_long_term_policy", "Long-term cancellation policy")}<select name="longTermCancellationPolicy" defaultValue={listing.longTermCancellationPolicy || "FIRM"} className={fieldClass}><option value="FIRM">{t("host_calendar_policy_firm", "Firm")}</option><option value="STRICT">{t("host_calendar_policy_strict", "Strict")}</option></select></label>}
            {message && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{message}</p>}
            <div className="flex gap-3 pt-1"><button type="button" onClick={() => setEditor(null)} disabled={saving} className="min-h-12 flex-1 rounded-xl border border-[#222222] text-sm font-medium disabled:opacity-50">{t("host_calendar_cancel", "Cancel")}</button><button type="submit" disabled={saving} className="min-h-12 flex-1 rounded-xl bg-[#222222] text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950">{saving ? t("host_calendar_saving", "Saving…") : t("host_calendar_save", "Save")}</button></div>
          </form>
        </section>
      </div>}
    </section>
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
  onSave: (values: Record<string, unknown>) => Promise<unknown>;
}) {
  const { currency: displayCurrency, formatMajor } = useCurrency();
  const { t } = useLanguage();
  // The calendar opens on the concise Figma-style overview. Pricing and
  // availability retain their existing full editors one click away.
  const [panel, setPanel] = useState<"pricing" | "overview" | "availability">("overview");
  const [dirty, setDirty] = useState(false);
  const [validation, setValidation] = useState("");
  const [formKey, setFormKey] = useState(0);

  const rawDiscounts =
    typeof listing.discounts === "object" && listing.discounts !== null
      ? (listing.discounts as Record<string, unknown>)
      : {};
  const weeklyDetails = asDiscountDetails(rawDiscounts.weekly);
  const monthlyDetails = asDiscountDetails(rawDiscounts.monthly);
  const earlyBirdDetails = asDiscountDetails(rawDiscounts.early_bird);
  const lastMinuteDetails = asDiscountDetails(rawDiscounts.last_minute);
  const customPromoDetails = asDiscountDetails(rawDiscounts.custom_promotion);

  const weeklyDiscount =
    weeklyDetails
      ? weeklyDetails.percentage ?? 10
      : Number(rawDiscounts.weekly || 0);

  const monthlyDiscount =
    monthlyDetails
      ? monthlyDetails.percentage ?? 25
      : Number(rawDiscounts.monthly || 0);

  const earlyBirdDiscount =
    earlyBirdDetails
      ? earlyBirdDetails.percentage ?? 10
      : Number(rawDiscounts.early_bird || 0);
  const earlyBirdDaysInAdvance =
    earlyBirdDetails
      ? Number(earlyBirdDetails.daysInAdvance ?? 30)
      : 30;

  const lastMinuteDiscount =
    lastMinuteDetails
      ? lastMinuteDetails.percentage ?? 10
      : Number(rawDiscounts.last_minute || 0);
  const lastMinuteDaysBefore =
    lastMinuteDetails
      ? Number(lastMinuteDetails.daysBefore ?? 2)
      : 2;

  const customPromoDiscount =
    customPromoDetails
      ? customPromoDetails.percentage ?? 15
      : Number(rawDiscounts.custom_promotion || 0);

  const newListingEntry = rawDiscounts.new_listing ?? rawDiscounts.newListing;
  const newListingDetails = asDiscountDetails(newListingEntry);
  const newListingDiscount =
    newListingDetails
      ? Number(newListingDetails.percentage ?? newListingDetails.discountPercentage ?? 20)
      : newListingEntry === true
        ? 20
        : Number(newListingEntry || 0);

  const discountEnabled = (entry: unknown, percentage: number) => {
    return asDiscountDetails(entry)?.enabled !== false && percentage > 0;
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
        className={`relative flex h-8 w-14 shrink-0 items-center rounded-full border p-0.5 transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222222] focus-visible:ring-offset-2 dark:focus-visible:ring-white dark:focus-visible:ring-offset-zinc-950 cursor-pointer ${enabled ? "border-[#222222] bg-[#222222] dark:border-white dark:bg-white" : "border-[#b8b8b8] bg-[#b8b8b8] dark:border-zinc-600 dark:bg-zinc-700"
          }`}
      >
        <span
          className={`size-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.28)] transition-transform duration-200 ease-out dark:bg-zinc-950 ${enabled ? "translate-x-6" : "translate-x-0"
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
            {clearLabel || t("host_calendar_clear", "Clear")}
          </button>
        )}
      </div>

      <div className="relative flex items-center rounded-lg border border-[#727272] sm:min-h-[56px] min-h-[45px] dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-2xs transition-all focus-within:outline-0 hover:border-zinc-400 dark:hover:border-zinc-600">
        {prefix ? (
          <span className="pl-3.5 pr-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 select-none shrink-0">
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

  const renderAvailabilityNumberRow = ({
    name,
    label,
    defaultValue,
    min,
    max,
  }: {
    name: string;
    label: string;
    defaultValue: number;
    min: number;
    max: number;
  }) => (
    <label
      htmlFor={`input-${name}`}
      className="flex min-h-[60px] cursor-text items-center gap-3 rounded-[12px] border border-white bg-[#F3F4F5] px-5 py-3 shadow-[0px_2px_4px_0px_#00000040] transition-shadow focus-within:ring-2 focus-within:ring-[#1f1f1f]/15 dark:border-white/20 dark:bg-zinc-800"
    >
      <span className="min-w-0 flex-1 text-sm text-[#727272] dark:text-zinc-400">
        {label}
      </span>
      <input
        id={`input-${name}`}
        aria-label={label}
        name={name}
        type="number"
        defaultValue={defaultValue}
        min={min}
        max={max}
        step="1"
        inputMode="numeric"
        className="w-16 bg-transparent text-right text-base font-medium text-[#1f1f1f] outline-none [appearance:textfield] dark:text-zinc-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </label>
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
                {t("host_calendar_price_settings", "Price settings")}
              </p>
              <div className="mt-3 flex flex-col gap-1.5 text-sm leading-5 text-[#727272] dark:text-[#727272]">
                <div>{formatMajor(listing.weekdayBasePrice / 100, listingCurrency)} {t("host_calendar_per_night", "/ night")}</div>
               <div>
                  {weeklyDiscount}% {t("host_calendar_weekly_discount_label", "Weekly discount")}
                </div>
                <div>
                  {monthlyDiscount}% {t("host_calendar_monthly_discount_label", "Monthly discount")}
                </div>
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
                {t("host_calendar_avail_settings", "Availability settings")}
              </p>
              <div className="mt-3 flex flex-col gap-1.5 text-sm font-normal leading-5 text-[#727272] dark:text-zinc-400">
                <div>
                  {listing.minNights ?? 1}–{listing.maxNights ?? 365} {t("host_dash_nights", "nights")}
                </div>
                <div>
                  {listing.advanceNotice || t("host_notice_same_day", "Same day")} {t("host_calendar_advance_notice", "advance notice")}
                </div>
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
        aria-label={t("host_calendar_back_to_settings", "Back to calendar settings")}
        onClick={() => {
          if (dirty && typeof window !== "undefined") {
            if (!window.confirm(t("host_calendar_unsaved_confirm", "You have unsaved changes in this selection. Discard them?"))) {
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
              setValidation(t("host_calendar_min_stay_err_at_least_1", "Minimum stay must be at least 1 night."));
              return;
            }
            if (!Number.isFinite(maxN) || maxN < minN) {
              setValidation(t("host_calendar_max_stay_err_gte_min", "Maximum stay must be greater than or equal to minimum stay."));
              return;
            }
            if (!Number.isFinite(guestsCount) || guestsCount < 1) {
              setValidation(t("host_calendar_max_guests_err_at_least_1", "Maximum guests must be at least 1."));
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
          className="space-y-7 pb-6"
        >
          <div>
            <h2 className="text-base font-medium text-[#1f1f1f] dark:text-zinc-100">
              {t("host_calendar_avail_settings", "Availability settings")}
            </h2>
            <p className="mt-1 text-sm text-[#727272] dark:text-zinc-400">
              {t("host_calendar_avail_form_desc", "Set global trip length rules and booking notice requirements.")}
            </p>
          </div>

          <section className="border-y border-[#E7E7E7] py-5 dark:border-zinc-800">
            <h3 className="text-base font-medium text-[#1f1f1f] dark:text-zinc-100">
              Trip length
            </h3>
            <div className="mt-5 space-y-3">
              {renderAvailabilityNumberRow({
                name: "minNights",
                label: t("host_calendar_min_stay_label", "Minimum stay"),
                defaultValue: listing.minNights ?? 1,
                min: 1,
                max: 365,
              })}

              {renderAvailabilityNumberRow({
                name: "maxNights",
                label: t("host_calendar_max_stay_label", "Maximum stay"),
                defaultValue: listing.maxNights ?? 365,
                min: 1,
                max: 365,
              })}

            {renderInputField({
              name: "guests",
              label: t("host_calendar_max_guest_label", "Maximum guest capacity"),
              defaultValue: listing.guests ?? 1,
              suffix: "guests",
              min: 1,
              max: 50,
              inputMode: "numeric",
              helperText: t("host_calendar_max_guest_helper", "Maximum number of guests allowed per booking."),
            })}

            <div className="space-y-1">
              <label
                htmlFor="advanceNoticeSelect"
                className="block text-sm font-medium text-[#1f1f1f] dark:text-zinc-200"
              >
                {t("host_calendar_advance_notice_label", "Advance notice")}
              </label>
              <div className="relative flex items-center">
                <select
                  id="advanceNoticeSelect"
                  name="advanceNotice"
                  defaultValue={listing.advanceNotice || "Same day"}
                  className="w-full appearance-none bg-transparent px-3.5 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer pr-10 border border-[#727272] sm:min-h-[56px] min-h-[45px] focus-within:outline-0 focus-within:shadow-none focus-visible:outline-0 focus-visible:shadow-none rounded-lg hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600 transition-colors [&>option]:bg-white dark:[&>option]:bg-zinc-800 [&>option]:text-zinc-900 dark:[&>option]:text-zinc-100"
                >
                  <option value="Same day">{t("host_notice_same_day", "Same day")}</option>
                  <option value="At least 1 day">{t("host_notice_at_least_1_day", "At least 1 day")}</option>
                  <option value="At least 2 days">{t("host_notice_at_least_2_days", "At least 2 days")}</option>
                  <option value="At least 3 days">{t("host_notice_at_least_3_days", "At least 3 days")}</option>
                  <option value="At least 7 days">{t("host_notice_at_least_7_days", "At least 7 days")}</option>
                </select>
                <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center text-[#727272] dark:text-zinc-400">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-[#727272] dark:text-zinc-400">
                {t("host_notice_required_before", "Required lead time before a guest can check in.")}
              </p>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="sameDayCutoffSelect"
                className="block text-sm font-medium text-[#1f1f1f] dark:text-zinc-200"
              >
                {t("host_calendar_same_day_cutoff_label", "Same-day booking cutoff")}
              </label>
              <div className="relative flex items-center">
                <select
                  id="sameDayCutoffSelect"
                  name="sameDayCutoff"
                  defaultValue={listing.sameDayCutoff || "12:00 AM"}
                  className="w-full appearance-none bg-transparent px-3.5 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer pr-10 border border-[#727272] sm:min-h-[56px] min-h-[45px] focus-within:outline-0 focus-within:shadow-none focus-visible:outline-0 focus-visible:shadow-none rounded-lg hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600 transition-colors [&>option]:bg-white dark:[&>option]:bg-zinc-800 [&>option]:text-zinc-900 dark:[&>option]:text-zinc-100"
                >
                  <option value="12:00 AM">{t("host_calendar_cutoff_midnight", "12:00 AM (Midnight)")}</option>
                  <option value="6:00 AM">6:00 AM</option>
                  <option value="12:00 PM">{t("host_calendar_cutoff_noon", "12:00 PM (Noon)")}</option>
                  <option value="3:00 PM">3:00 PM</option>
                  <option value="6:00 PM">6:00 PM</option>
                  <option value="9:00 PM">9:00 PM</option>
                </select>
                <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center text-[#727272] dark:text-zinc-400">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-[#727272] dark:text-zinc-400">
                {t("host_calendar_same_day_cutoff_helper", "Time after which guests cannot book a same-day reservation.")}
              </p>
            </div>

              <div className="flex items-center justify-between gap-3 rounded-[12px] border border-white bg-[#F3F4F5] px-5 py-4 shadow-[0_2px_4px_0px_#00000040] dark:border-zinc-700/80 dark:bg-zinc-800/70 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/80 transition-colors">
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-[#1f1f1f] dark:text-zinc-200">
                  {t("host_calendar_allow_same_day_title", "Allow same-day booking requests")}
                </span>
                <span className="block text-xs text-[#727272] dark:text-zinc-400 mt-0.5">
                  {t("host_calendar_allow_same_day_subtitle", "Let guests book on the day of arrival before the cutoff time.")}
                </span>
              </div>
              <label className="relative shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  name="allowSameDayRequests"
                  defaultChecked={listing.allowSameDayRequests !== false}
                  className="peer sr-only"
                />
                <span aria-hidden="true" className="relative flex h-8 w-14 items-center rounded-full border border-[#b8b8b8] bg-[#b8b8b8] p-0.5 transition-[background-color,border-color,box-shadow] peer-checked:border-[#222222] peer-checked:bg-[#222222] peer-focus-visible:ring-2 peer-focus-visible:ring-[#222222] peer-focus-visible:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-700 dark:peer-checked:border-white dark:peer-checked:bg-white dark:peer-focus-visible:ring-white dark:peer-focus-visible:ring-offset-zinc-900 after:size-6 after:rounded-full after:bg-white after:shadow-[0_1px_3px_rgba(0,0,0,0.28)] after:transition-transform after:duration-200 after:ease-out peer-checked:after:translate-x-6 dark:after:bg-zinc-950" />
              </label>
            </div>
          </div>
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
            <div className="sticky bottom-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs pt-3 pb-1 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 z-10 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={saving}
                className="flex-1 rounded-full border border-[#727272] hover:border-[#1f1f1f] dark:border-[#1f1f1f] bg-white dark:bg-[#1f1f1f] hover:bg-[#1f1f1f] dark:hover:bg-[#1f1f1f] text-[#1f1f1f] hover:text-white dark:text-zinc-300 font-medium py-2.5 text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {t("host_calendar_discard", "Discard")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-full text-sm hover:bg-[#1F1F1F] text-[#1F1F1F] hover:text-white hover:border-[#1F1F1F] bg-[#FCDF9C] font-medium py-2.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {saving ? t("host_calendar_saving", "Saving…") : t("host_calendar_save_avail", "Save")}
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
                t(
                  "host_calendar_err_price_discount_range",
                  "Please enter a valid base price and discount percentages between 0 and 100%.",
                ),
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
                ...customPromoDetails,
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
                {t("host_calendar_price_settings", "Price settings")}
              </h2>
              <p className="mt-0.5 text-sm text-[#727272] dark:text-[#727272]">
                {t("host_calendar_base_rates_desc", "Default rates applied unless customized for specific calendar dates.")}
              </p>
            </div>

            {renderInputField({
              name: "price",
              label: t("host_calendar_weekday_base_rate", "Weekday base rate"),
              defaultValue:
                toDisplayMajor(listing.weekdayBasePrice / 100),
              prefix: displayCurrency,
              min: 1,
              max: 100000,
              step: "0.01",
              inputMode: "decimal",
              helperText: t("host_calendar_weekday_helper", "Applies to Sunday through Wednesday nights."),
            })}

            <ExpandControl
              title={t("host_calendar_custom_weekend_price", "Custom weekend price")}
              subtitle={
                customWeekendPriceVal
                  ? `${displayCurrency} ${Number(customWeekendPriceVal).toLocaleString("en", { maximumFractionDigits: 2 })} / night`
                  : `${t("host_calendar_weekend_not_configured", "Not configured")} (defaults to ${formatMajor(listing.weekdayBasePrice / 100, listingCurrency)})`
              }
              defaultOpen={Boolean(listing.weekendPrice)}
            >
              {renderInputField({
                name: "weekendPrice",
                label: `${t("host_calendar_custom_weekend_price", "Custom weekend price")} (${displayCurrency})`,
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
                placeholder: t("host_calendar_weekend_placeholder", "Leave empty to use base rate"),
                helperText:
                  t("host_calendar_weekend_helper", "Applies to Thursday & Friday nights. Leave empty to use the weekday base rate."),
                onClear: customWeekendPriceVal
                  ? () => {
                    setCustomWeekendPriceVal("");
                    setDirty(true);
                  }
                  : undefined,
                clearLabel: t("host_calendar_clear", "Clear"),
              })}
            </ExpandControl>
          </section>

          {/* Discounts */}
          <section className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-5">
            <div>
              <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                {t("host_calendar_stay_discounts_heading", "Stay Length Discounts")}
              </h3>
              <p className="mt-0.5 text-sm text-[#727272] dark:text-[#727272]">
                {t("host_calendar_stay_discounts_desc", "Encourage longer reservations with stay duration discounts.")}
              </p>
            </div>

            <ExpandControl
              title={t("host_calendar_weekly_discount_label", "Weekly (7+ nights)")}
              subtitle={t("host_calendar_weekly_discount_sub", "Applied automatically to bookings of 7 nights or more.")}
              defaultOpen={weeklyEnabled}
              control={discountToggle(
                "weeklyEnabled",
                t("host_calendar_toggle_weekly", "Toggle weekly discount"),
                weeklyEnabled,
                setWeeklyEnabled
              )}
            >
              {renderInputField({
                name: "weekly",
                label: t("host_calendar_weekly_discount_label", "Weekly discount"),
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
              title={t("host_calendar_monthly_discount_label", "Monthly (28+ nights)")}
              subtitle={t("host_calendar_monthly_discount_sub", "Applied automatically to bookings of 28 nights or more.")}
              defaultOpen={monthlyEnabled}
              control={discountToggle(
                "monthlyEnabled",
                t("host_calendar_toggle_monthly", "Toggle monthly discount"),
                monthlyEnabled,
                setMonthlyEnabled
              )}
            >
              {renderInputField({
                name: "monthly",
                label: t("host_calendar_monthly_discount_label", "Monthly discount"),
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
              title={t("host_calendar_early_bird_discount", "Early-bird discount (30+ days advance)")}
              subtitle={t("host_calendar_early_bird_sub", "For bookings made at least 30 days before arrival.")}
              defaultOpen={earlyBirdEnabled}
              control={discountToggle(
                "earlyBirdEnabled",
                t("host_calendar_toggle_early_bird", "Toggle early-bird discount"),
                earlyBirdEnabled,
                setEarlyBirdEnabled
              )}
            >
              {renderInputField({
                name: "earlyBird",
                label: t("host_calendar_early_bird_discount", "Early-bird discount"),
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
              title={t("host_calendar_last_minute_discount", "Last-minute discount (within 2 days)")}
              subtitle={t("host_calendar_last_minute_sub", "For bookings made within 2 days before arrival.")}
              defaultOpen={lastMinuteEnabled}
              control={discountToggle(
                "lastMinuteEnabled",
                t("host_calendar_toggle_last_minute", "Toggle last-minute discount"),
                lastMinuteEnabled,
                setLastMinuteEnabled
              )}
            >
              {renderInputField({
                name: "lastMinute",
                label: t("host_calendar_last_minute_discount", "Last-minute discount"),
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
                {t("host_calendar_promotions_heading", "Promotions")}
              </h3>
              <p className="mt-0.5 text-sm text-[#727272] dark:text-zinc-400">
                {t("host_calendar_promotions_desc", "Special promotional offers across your listing.")}
              </p>
            </div>

            <ExpandControl
              title={t("host_calendar_new_listing_promo", "New listing promotion")}
              subtitle={
                newListingEnabled && newListingDiscount > 0
                  ? t("host_calendar_new_listing_sub", { pct: newListingDiscount }, `${newListingDiscount}% promotion for the first eligible bookings`)
                  : t("host_calendar_no_new_listing_promo", "No new listing promotion configured")
              }
              defaultOpen={newListingEnabled}
              control={discountToggle(
                "newListingEnabled",
                t("host_calendar_toggle_new_listing", "Toggle new listing promotion"),
                newListingEnabled,
                setNewListingEnabled
              )}
            >
              {renderInputField({
                name: "newListing",
                label: t("host_calendar_new_listing_promo", "New listing discount (first 3 bookings)"),
                defaultValue: newListingDiscount,
                suffix: "%",
                min: 1,
                max: 100,
                step: "1",
                inputMode: "numeric",
                readOnly: !newListingEnabled,
                helperText: t("host_calendar_new_listing_helper", "Applied automatically to eligible new listings until the first 3 bookings are completed."),
              })}
            </ExpandControl>

            <ExpandControl
              title={t("host_calendar_custom_promo", "Custom promotion")}
              subtitle={
                customPromoEnabled && customPromoDiscount > 0
                  ? t("host_calendar_custom_promo_configured", { pct: customPromoDiscount }, `${customPromoDiscount}% promotional discount configured`)
                  : t("host_calendar_custom_promo", "Property-wide promotional discount")
              }
              defaultOpen={customPromoEnabled}
              control={discountToggle(
                "customPromoEnabled",
                t("host_calendar_toggle_custom_promo", "Toggle custom promotion"),
                customPromoEnabled,
                setCustomPromoEnabled
              )}
            >
              {renderInputField({
                name: "customPromo",
                label: t("host_calendar_custom_promo", "Special promotional discount"),
                defaultValue: customPromoDiscount,
                suffix: "%",
                min: 1,
                max: 100,
                step: "1",
                inputMode: "numeric",
                readOnly: !customPromoEnabled,
                helperText: t("host_calendar_custom_promo_helper", "Global promotional discount applied to eligible stays."),
              })}
            </ExpandControl>
          </section>

          {/* Additional Charges */}
          <section className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-5">
            <div>
              <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                {t("host_calendar_additional_charges_heading", "Additional Charges")}
              </h3>
              <p className="mt-0.5 text-sm text-[#727272] dark:text-zinc-400">
                {t("host_calendar_additional_charges_desc", "Host-defined fees for guests and cleaning.")}
              </p>
            </div>

            {renderInputField({
              name: "cleaningFee",
              label: t("host_calendar_cleaning_fee_label", "Cleaning fee"),
              defaultValue: toDisplayMajor((listing.cleaningFee || 0) / 100),
              prefix: displayCurrency,
              suffix: "/ stay",
              min: 0,
              max: 10000,
              step: "0.01",
              inputMode: "decimal",
              helperText: t("host_calendar_cleaning_fee_helper", "One-time host cleaning fee recorded with property."),
            })}

            {renderInputField({
              name: "extraGuestFee",
              label: t("host_calendar_extra_guest_fee_label", "Extra guest fee"),
              defaultValue: toDisplayMajor((listing.extraGuestFee || 0) / 100),
              prefix: displayCurrency,
              suffix: t("host_calendar_per_guest_per_night", "/ guest / night"),
              min: 0,
              max: 10000,
              step: "0.01",
              inputMode: "decimal",
              helperText: t("host_calendar_extra_guest_fee_helper", "Fee charged per extra guest per night beyond included guest capacity."),
            })}

            {renderInputField({
              name: "includedGuests",
              label: t("host_calendar_included_guests_label", "Included guests"),
              defaultValue: String(
                rawDiscounts.includedGuests ??
                rawDiscounts.baseGuests ??
                1
              ),
              suffix: t("host_dash_guest_plural", "guests"),
              min: 1,
              max: listing.guests || 20,
              step: "1",
              inputMode: "numeric",
              helperText: t("host_calendar_included_guests_helper", { max: listing.guests || 1 }, `Base capacity included before extra guest fee applies (max capacity: ${listing.guests || 1}).`),
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
                {t("host_calendar_discard", "Discard")}
              </button>
              <button
                type="submit"
                disabled={saving}
                  className="rounded-lg bg-[#FCDF9C] hover:bg-[#1f1f1f] text-[#1f1f1f] hover:text-white font-medium py-2.5 text-xs transition-colors cursor-pointer disabled:opacity-50 px-2 flex-1"
              >
                {saving ? t("host_calendar_saving", "Saving…") : t("host_calendar_save_price", "Save price settings")}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
