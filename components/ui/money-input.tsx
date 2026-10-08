"use client";

import { useState, useEffect, forwardRef, type ChangeEvent, type FocusEvent } from "react";
import { normalizeCurrencyCode } from "@/lib/currency";

export interface MoneyInputProps {
  id?: string;
  name?: string;
  value: number | string | null | undefined;
  currency?: string | null;
  onChange: (value: number | "") => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number | string;
  disabled?: boolean;
  error?: string;
  size?: "sm" | "md" | "lg";
  currencyPosition?: "prefix" | "suffix";
  className?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}

/**
 * Universal, dynamic MoneyInput component.
 * Respects authoritative property currency without any hardcoded currency codes or symbols.
 * Supports decimal inputs, mobile inputMode, empty intermediate states, focus/error styling,
 * and accessible screen reader labels.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      id,
      name,
      value,
      currency,
      onChange,
      onBlur,
      placeholder = "0",
      min = 0,
      max,
      step = "0.01",
      disabled = false,
      error,
      size = "md",
      currencyPosition = "prefix",
      className = "",
      ariaLabel,
      autoFocus = false,
    },
    ref,
  ) => {
    const normalizedCurrency = normalizeCurrencyCode(currency);
    const [localStr, setLocalStr] = useState<string>(() => {
      if (value === null || value === undefined || value === "") return "";
      return String(value);
    });

    useEffect(() => {
      if (value === null || value === undefined || value === "") {
        setLocalStr("");
      } else {
        const numVal = Number(value);
        if (Number.isFinite(numVal) && String(numVal) !== localStr && Number(localStr) !== numVal) {
          setLocalStr(String(value));
        }
      }
    }, [value]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "") {
        setLocalStr("");
        onChange("");
        return;
      }

      setLocalStr(raw);
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        onChange(parsed);
      }
    };

    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
      if (localStr === "" || isNaN(Number(localStr))) {
        // Leave empty or keep parent value
      } else {
        const num = Number(localStr);
        if (Number.isFinite(num)) {
          if (min !== undefined && num < min) {
            setLocalStr(String(min));
            onChange(min);
          } else if (max !== undefined && num > max) {
            setLocalStr(String(max));
            onChange(max);
          }
        }
      }
      onBlur?.(e);
    };

    const sizeClasses = {
      sm: "py-1.5 px-2.5 text-xs",
      md: "py-2.5 px-3 text-sm",
      lg: "py-3 px-4 text-base sm:text-lg",
    }[size];

    const currencyBadgeSize = {
      sm: "text-[11px] px-2",
      md: "text-xs px-2.5",
      lg: "text-sm sm:text-base px-3.5",
    }[size];

    return (
      <div className={`w-full ${className}`}>
        <div
          className={`relative flex items-center rounded-lg border bg-white dark:bg-zinc-800 transition-all min-h-[45px] ${
            error
              ? "border-rose-500"
            : "border-[#727272] dark:border-zinc-700 dark:hover:border-[#727272] focus-within:border-zinc-900 dark:focus-within:border-zinc-100"
          } ${disabled ? "opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-900" : ""}`}
        >
          {currencyPosition === "prefix" && (
            <span
              className={`font-medium text-[#1f1f1f] dark:text-zinc-400 select-none shrink-0 ${currencyBadgeSize}`}
              aria-hidden="true"
            >
              {normalizedCurrency}
            </span>
          )}

          <input
            ref={ref}
            id={id}
            name={name}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={localStr}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder={placeholder}
            autoFocus={autoFocus}
            aria-label={ariaLabel || `Amount in ${normalizedCurrency}`}
            aria-invalid={Boolean(error)}
            className={`w-full bg-transparent font-medium text-[#1f1f1f] dark:text-zinc-100 placeholder:text-[#727272] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${sizeClasses}`}
          />

          {currencyPosition === "suffix" && (
            <span
              className={`font-bold text-zinc-500 dark:text-zinc-400 select-none shrink-0 ${currencyBadgeSize}`}
              aria-hidden="true"
            >
              {normalizedCurrency}
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>
    );
  },
);

MoneyInput.displayName = "MoneyInput";

