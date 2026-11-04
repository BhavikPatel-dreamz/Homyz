"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BuildingBankIcon,
  CreditCardIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ChevronRightIcon,
  LockIcon,
  HelpCircleIcon,
  InfoIcon,
} from "@/components/host/account-settings";

// Known Saudi bank prefixes for instant UI feedback
const SAMA_BANK_MAP: Record<string, string> = {
  "10": "Saudi National Bank (SNB / الأهلي)",
  "20": "Riyad Bank (بنك الرياض)",
  "80": "Al Rajhi Bank (مصرف الراجحي)",
  "05": "Alinma Bank (مصرف الإنماء)",
  "50": "Banque Saudi Fransi (البنك السعودي الفرنسي)",
  "45": "SAB (Saudi Awwal Bank / الأول)",
  "15": "Bank AlJazira (بنك الجزيرة)",
  "65": "The Saudi Investment Bank (الاستثمار)",
  "55": "Bank AlBilad (بنك البلاد)",
  "30": "Arab National Bank (العربي)",
  "60": "Gulf International Bank (بنك الخليج)",
  "75": "Emirates NBD KSA (الإمارات دبي الوطني)",
};

function liveCheckSaudiIban(raw: string): {
  valid: boolean;
  clean: string;
  formatted: string;
  bankName?: string;
  error?: string;
} {
  const clean = raw.replace(/[\s\-_]/g, "").toUpperCase();

  if (!clean.startsWith("SA")) {
    return {
      valid: false,
      clean,
      formatted: clean,
      error: "Saudi IBAN must start with 'SA'",
    };
  }

  const formatted = clean.replace(/(.{4})/g, "$1 ").trim();

  if (clean.length < 24) {
    const bankCode = clean.length >= 6 ? clean.slice(4, 6) : undefined;
    return {
      valid: false,
      clean,
      formatted,
      bankName: bankCode ? SAMA_BANK_MAP[bankCode] : undefined,
      error: `Saudi IBAN must be 24 characters (currently ${clean.length}/24)`,
    };
  }

  if (clean.length > 24) {
    return {
      valid: false,
      clean,
      formatted,
      error: `IBAN is too long (${clean.length} characters)`,
    };
  }

  // Mod-97 checksum algorithm
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  let numeric = "";
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      numeric += (code - 55).toString();
    } else {
      numeric += ch;
    }
  }

  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = remainder.toString() + numeric.slice(i, i + 7);
    remainder = Number(chunk) % 97;
  }

  const bankCode = clean.slice(4, 6);
  const detectedBank = SAMA_BANK_MAP[bankCode] || "Licensed Saudi Commercial Bank";

  if (remainder !== 1) {
    return {
      valid: false,
      clean,
      formatted,
      bankName: detectedBank,
      error: "Invalid IBAN checksum digits. Please verify the account number.",
    };
  }

  return {
    valid: true,
    clean,
    formatted,
    bankName: detectedBank,
  };
}

function liveCheckPayPalEmail(raw: string): {
  valid: boolean;
  clean: string;
  error?: string;
} {
  const clean = raw.trim().toLowerCase();
  if (!clean) {
    return { valid: false, clean, error: "PayPal email is required." };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clean)) {
    return { valid: false, clean, error: "Please enter a valid PayPal email address." };
  }
  return { valid: true, clean };
}

export function AddPayoutMethodWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [country, setCountry] = useState<string>("SA");
  const [payoutType, setPayoutType] = useState<string>("SAUDI_IBAN");
  const [accountHolderName, setAccountHolderName] = useState<string>("");
  const [rawIban, setRawIban] = useState<string>("SA");
  const [paypalEmail, setPaypalEmail] = useState<string>("");
  const [routingCode, setRoutingCode] = useState<string>("");
  const [isDefault, setIsDefault] = useState<boolean>(true);
  const [confirmedCertification, setConfirmedCertification] = useState<boolean>(false);

  // Submission State
  const [loading, setLoading] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [createdMethod, setCreatedMethod] = useState<any>(null);

  // PayPal Gateway Status
  const [paypalStatus, setPaypalStatus] = useState<{
    isConfigured: boolean;
    isCountrySupported: boolean;
    statusLabel: string;
    message: string;
  }>({
    isConfigured: false,
    isCountrySupported: true,
    statusLabel: "Integration setup required",
    message:
      "PayPal is supported in Saudi Arabia (USD). Direct platform automated disbursements require PayPal Business Payouts credentials. In the meantime, use your Saudi IBAN bank account for instant zero-fee SAR deposits.",
  });

  // Derived validation
  const ibanCheck = liveCheckSaudiIban(rawIban);
  const paypalCheck = liveCheckPayPalEmail(paypalEmail);

  // Fetch PayPal Gateway Status from Backend
  useEffect(() => {
    let isMounted = true;
    fetch(`/api/v1/host/payout-methods/paypal-status?country=${country}`)
      .then((res) => res.json())
      .then((payload) => {
        if (isMounted && payload?.data) {
          setPaypalStatus(payload.data);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [country]);

  const handleIbanInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();
    if (!val.startsWith("SA") && val.length > 0) {
      val = "SA" + val.replace(/SA/g, "");
    }
    setRawIban(val);
  };

  const handleNextFromStep1 = () => {
    if (country === "SA") setCurrentStep(2);
  };

  const handleNextFromStep2 = () => {
    if (payoutType === "PAYPAL" && !paypalStatus.isConfigured) {
      setSubmissionError(
        "PayPal Payouts integration is currently pending provider credentials. Please select Saudi IBAN or contact administration.",
      );
      return;
    }
    setSubmissionError(null);
    setCurrentStep(3);
  };

  const handleNextFromStep3 = () => {
    if (!accountHolderName.trim()) {
      setSubmissionError("Beneficiary account holder name is required.");
      return;
    }

    if (payoutType === "SAUDI_IBAN") {
      if (!ibanCheck.valid) {
        setSubmissionError(ibanCheck.error || "Please provide a valid Saudi IBAN.");
        return;
      }
    } else if (payoutType === "PAYPAL") {
      if (!paypalCheck.valid) {
        setSubmissionError(paypalCheck.error || "Please provide a valid PayPal email address.");
        return;
      }
    }

    setSubmissionError(null);
    setCurrentStep(4);
  };

  const handleSubmit = async () => {
    if (!confirmedCertification) {
      setSubmissionError("Please confirm the authorization statement before continuing.");
      return;
    }

    setLoading(true);
    setSubmissionError(null);

    try {
      const isPayPal = payoutType === "PAYPAL";
      const payloadBody = isPayPal
        ? {
            type: "PAYPAL",
            accountHolderName: accountHolderName.trim(),
            bankName: "PayPal",
            paypalEmail: paypalCheck.clean,
            country: "SA",
            currency: "USD",
            isDefault,
          }
        : {
            type: "SAUDI_IBAN",
            accountHolderName: accountHolderName.trim(),
            bankName: ibanCheck.bankName || "Saudi Commercial Bank",
            iban: ibanCheck.clean,
            routingCode: routingCode.trim() || undefined,
            country: "SA",
            currency: "SAR",
            isDefault,
          };

      const res = await fetch("/api/v1/host/payout-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message || payload?.message || "Failed to register payout method.");
      }

      setCreatedMethod(payload.data || payload);
      setCurrentStep(5);
      router.refresh();
    } catch (err: any) {
      setSubmissionError(err.message || "An error occurred during account registration.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Wizard Step Progress Tracker */}
      <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-500 mb-2">
          <span>Step {currentStep} of 5</span>
          <span className="text-zinc-900 font-medium">
            {currentStep === 1 && "Select Billing Country"}
            {currentStep === 2 && "Choose Payout Method"}
            {currentStep === 3 && (payoutType === "PAYPAL" ? "PayPal Account Details" : "Bank Account Details")}
            {currentStep === 4 && "Review & Confirm"}
            {currentStep === 5 && "Complete"}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5 h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`h-full transition-all ${
                step <= currentStep ? "bg-zinc-950" : "bg-transparent"
              }`}
            />
          ))}
        </div>
      </div>

      {submissionError && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm text-rose-900 shadow-2xs">
          <AlertTriangleIcon size={18} className="text-rose-600 shrink-0" />
          <span className="font-medium">{submissionError}</span>
        </div>
      )}

      {/* STEP 1: Country Selection */}
      {currentStep === 1 && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xs">
          <h2 className="text-lg font-medium text-zinc-950">Where is your payout account located?</h2>
          <p className="mt-1 text-xs sm:text-sm text-zinc-600">
            Select the country of your financial institution or PayPal account. Saudi Arabia is fully supported with direct Saudi IBAN deposits (SAR) and PayPal account payouts (USD).
          </p>

          <div className="mt-6 space-y-3">
            <label
              className={`flex items-center justify-between rounded-2xl border p-4 cursor-pointer transition-all ${
                country === "SA"
                  ? "border-zinc-950 bg-zinc-50/80 shadow-xs"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <span className="text-2xl">🇸🇦</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-zinc-950 text-sm">Saudi Arabia (المملكة العربية السعودية)</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">Supported</span>
                  </div>
                  <p className="text-xs text-zinc-500">Supports Saudi IBAN (SARIE) and PayPal (USD)</p>
                </div>
              </div>
              <input
                type="radio"
                name="country"
                value="SA"
                checked={country === "SA"}
                onChange={() => setCountry("SA")}
                className="size-4 text-zinc-950 focus:ring-zinc-900"
              />
            </label>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={handleNextFromStep1}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-zinc-800 transition-colors shadow-2xs"
            >
              <span>Continue</span>
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Payout Method Type */}
      {currentStep === 2 && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xs">
          <h2 className="text-lg font-medium text-zinc-950">Choose how you want to get paid</h2>
          <p className="mt-1 text-xs sm:text-sm text-zinc-600">
            Select your preferred payout method. Both Saudi IBAN bank accounts and PayPal are supported in Saudi Arabia.
          </p>

          <div className="mt-6 space-y-4">
            {/* Bank Account (Saudi IBAN) */}
            <label
              className={`flex items-center justify-between rounded-2xl border p-4 cursor-pointer transition-all ${
                payoutType === "SAUDI_IBAN"
                  ? "border-zinc-950 bg-zinc-50/80 shadow-xs"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-900 shadow-2xs">
                  <BuildingBankIcon size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-zinc-950 text-sm">Bank account (Saudi IBAN)</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">Recommended</span>
                  </div>
                  <p className="text-xs text-zinc-500">Fast SARIE transfer in SAR · Zero platform fees · Direct local deposit</p>
                </div>
              </div>
              <input
                type="radio"
                name="payoutType"
                value="SAUDI_IBAN"
                checked={payoutType === "SAUDI_IBAN"}
                onChange={() => setPayoutType("SAUDI_IBAN")}
                className="size-4 text-zinc-950 focus:ring-zinc-900"
              />
            </label>

            {/* PayPal Option */}
            <div
              className={`flex flex-col rounded-2xl border p-4 transition-all ${
                paypalStatus.isConfigured
                  ? payoutType === "PAYPAL"
                    ? "border-zinc-950 bg-zinc-50/80 shadow-xs cursor-pointer"
                    : "border-zinc-200 hover:border-zinc-300 cursor-pointer"
                  : "border-zinc-200 bg-zinc-50/60"
              }`}
              onClick={() => {
                if (paypalStatus.isConfigured) setPayoutType("PAYPAL");
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-blue-600 shadow-2xs">
                    <CreditCardIcon size={20} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-zinc-950 text-sm">PayPal</p>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200/80">
                        Supported in Saudi Arabia
                      </span>
                      {paypalStatus.isConfigured ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                          Available (USD)
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
                          Integration setup required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      Disbursed in USD at SAMA fixed peg (1 USD = 3.75 SAR) · Direct local bank withdrawal supported by PayPal
                    </p>
                  </div>
                </div>
                <input
                  type="radio"
                  name="payoutType"
                  value="PAYPAL"
                  disabled={!paypalStatus.isConfigured}
                  checked={payoutType === "PAYPAL"}
                  onChange={() => {
                    if (paypalStatus.isConfigured) setPayoutType("PAYPAL");
                  }}
                  className="size-4 text-zinc-950 focus:ring-zinc-900 disabled:opacity-40"
                />
              </div>

              {/* Status explanation when unconfigured */}
              {!paypalStatus.isConfigured && (
                <div className="mt-3 rounded-xl bg-amber-50/90 border border-amber-200/80 p-3 text-xs text-amber-900 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <InfoIcon size={16} className="text-amber-700 shrink-0 mt-0.5" />
                    <p>
                      <strong>Merchant Integration Status:</strong> PayPal accounts in Saudi Arabia are fully eligible to receive USD disbursements and withdraw to local Saudi banks in SAR. Automated Homyz platform disbursements require PayPal Business Payouts credentials. In the meantime, use your Saudi IBAN bank account for instant zero-fee SAR deposits.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="rounded-full border border-zinc-200 px-5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNextFromStep2}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-zinc-800 transition-colors shadow-2xs"
            >
              <span>Continue</span>
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Details Input (Saudi IBAN or PayPal) */}
      {currentStep === 3 && payoutType === "SAUDI_IBAN" && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xs">
          <h2 className="text-lg font-medium text-zinc-950">Enter your Saudi Bank details</h2>
          <p className="mt-1 text-xs sm:text-sm text-zinc-600">
            For anti-money laundering and SAMA regulatory compliance, the beneficiary name must match your legal identity.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-600 mb-1.5">
                Beneficiary Legal Name *
              </label>
              <input
                type="text"
                placeholder="Full name matching your bank statement"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                className="w-full rounded-2xl border border-zinc-300 px-4 py-2.5 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-hidden focus:ring-1 focus:ring-zinc-950 shadow-2xs"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Must match the identity verified on your Homyz Host account.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-600 mb-1.5">
                Saudi IBAN *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="SA03 8000 0000 0000 0000 0000"
                  value={ibanCheck.formatted || rawIban}
                  onChange={handleIbanInput}
                  maxLength={29}
                  className={`w-full rounded-2xl border px-4 py-2.5 font-mono text-sm tracking-wider shadow-2xs focus:outline-hidden ${
                    ibanCheck.valid
                      ? "border-emerald-500 bg-emerald-50/20 text-zinc-950 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                      : rawIban.length >= 24 && !ibanCheck.valid
                      ? "border-rose-400 bg-rose-50/20 text-rose-950 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                      : "border-zinc-300 text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950"
                  }`}
                />
                {ibanCheck.valid && (
                  <div className="absolute right-3.5 top-3 text-emerald-600">
                    <CheckCircleIcon size={18} />
                  </div>
                )}
              </div>

              {/* Detected Bank Indicator */}
              {ibanCheck.bankName && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-1.5 border border-zinc-200 text-xs text-zinc-800">
                  <BuildingBankIcon size={16} className="text-zinc-600" />
                  <span className="font-medium text-zinc-900">{ibanCheck.bankName}</span>
                </div>
              )}

              {/* Validation Feedback */}
              {rawIban.length > 2 && !ibanCheck.valid && (
                <p className="mt-1.5 text-xs text-amber-700 font-medium">
                  {ibanCheck.error}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-600 mb-1.5">
                Account Nickname / Routing Reference (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Primary Rental Account"
                value={routingCode}
                onChange={(e) => setRoutingCode(e.target.value)}
                className="w-full rounded-2xl border border-zinc-300 px-4 py-2.5 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-hidden focus:ring-1 focus:ring-zinc-950 shadow-2xs"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="mt-1 size-4 rounded text-zinc-950 focus:ring-zinc-900"
                />
                <span className="text-xs sm:text-sm text-zinc-800 leading-snug">
                  <strong>Set as default payout method</strong>
                  <span className="block text-zinc-500 text-xs">All upcoming completed booking revenues will be routed to this account.</span>
                </span>
              </label>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="rounded-full border border-zinc-200 px-5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNextFromStep3}
              disabled={!ibanCheck.valid || !accountHolderName.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-zinc-800 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Review Details</span>
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 (Alternate): PayPal Account Details */}
      {currentStep === 3 && payoutType === "PAYPAL" && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xs">
          <h2 className="text-lg font-medium text-zinc-950">Enter your PayPal account details</h2>
          <p className="mt-1 text-xs sm:text-sm text-zinc-600">
            Disbursements will be calculated from your SAR booking earnings and issued to your PayPal balance in USD at the SAMA official exchange rate.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-600 mb-1.5">
                Beneficiary Legal Name *
              </label>
              <input
                type="text"
                placeholder="Full name matching your PayPal account"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                className="w-full rounded-2xl border border-zinc-300 px-4 py-2.5 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-hidden focus:ring-1 focus:ring-zinc-950 shadow-2xs"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Must match the identity registered on your PayPal account.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-600 mb-1.5">
                PayPal Recipient Email *
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="your-paypal-email@example.com"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  className={`w-full rounded-2xl border px-4 py-2.5 text-sm shadow-2xs focus:outline-hidden ${
                    paypalCheck.valid
                      ? "border-emerald-500 bg-emerald-50/20 text-zinc-950 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                      : paypalEmail.length > 2 && !paypalCheck.valid
                      ? "border-rose-400 bg-rose-50/20 text-rose-950 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                      : "border-zinc-300 text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950"
                  }`}
                />
                {paypalCheck.valid && (
                  <div className="absolute right-3.5 top-3 text-emerald-600">
                    <CheckCircleIcon size={18} />
                  </div>
                )}
              </div>
              {paypalEmail.length > 2 && !paypalCheck.valid && (
                <p className="mt-1.5 text-xs text-amber-700 font-medium">
                  {paypalCheck.error}
                </p>
              )}
            </div>

            {/* Currency & Peg Notice */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700 space-y-1.5">
              <div className="flex items-center justify-between font-medium text-zinc-900 pb-1 border-b border-zinc-200/80">
                <span>Disbursement Currency</span>
                <span className="font-mono text-xs">USD (US Dollars)</span>
              </div>
              <p className="text-[11px] text-zinc-600 pt-1 leading-relaxed">
                <strong>Exchange Rate Policy:</strong> PayPal Payouts API does not support direct SAR disbursements. Earnings are converted from SAR to USD using the SAMA official fixed peg (1 USD = 3.75 SAR). You can hold USD in your PayPal account or withdraw to your Saudi bank account in SAR.
              </p>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="mt-1 size-4 rounded text-zinc-950 focus:ring-zinc-900"
                />
                <span className="text-xs sm:text-sm text-zinc-800 leading-snug">
                  <strong>Set as default payout method</strong>
                  <span className="block text-zinc-500 text-xs">All upcoming completed booking revenues will be routed to this PayPal account.</span>
                </span>
              </label>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="rounded-full border border-zinc-200 px-5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNextFromStep3}
              disabled={!paypalCheck.valid || !accountHolderName.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-zinc-800 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Review Details</span>
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Review & Confirm */}
      {currentStep === 4 && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xs">
          <h2 className="text-lg font-medium text-zinc-950">Review and confirm payout method</h2>
          <p className="mt-1 text-xs sm:text-sm text-zinc-600">
            Please verify all details before submitting. In accordance with security protocol, payout account identifiers cannot be edited after registration.
          </p>

          <div className="mt-6 rounded-2xl bg-zinc-50 p-5 border border-zinc-200/90 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs sm:text-sm">
              <div>
                <span className="text-zinc-500 font-medium">Payout Provider:</span>
                <p className="font-medium text-zinc-950 mt-0.5">
                  {payoutType === "PAYPAL" ? "PayPal" : ibanCheck.bankName || "Commercial Bank"}
                </p>
              </div>
              <div>
                <span className="text-zinc-500 font-medium">Beneficiary Name:</span>
                <p className="font-medium text-zinc-950 mt-0.5">{accountHolderName}</p>
              </div>
              <div>
                <span className="text-zinc-500 font-medium">Account Identifier:</span>
                <p className="font-mono font-medium text-zinc-950 mt-0.5">
                  {payoutType === "PAYPAL" ? paypalCheck.clean : ibanCheck.formatted}
                </p>
              </div>
              <div>
                <span className="text-zinc-500 font-medium">Currency & Rail:</span>
                <p className="font-medium text-zinc-950 mt-0.5">
                  {payoutType === "PAYPAL"
                    ? "USD (US Dollars) · PayPal Payouts (SAMA Peg: 3.75 SAR/USD)"
                    : "SAR (Saudi Arabian Riyal) · SARIE Direct Deposit"}
                </p>
              </div>
            </div>

            <div className="border-t border-zinc-200/80 pt-3 flex items-center justify-between text-xs">
              <span className="text-zinc-600">Designated as Default:</span>
              <span className={`font-medium ${isDefault ? "text-emerald-700" : "text-zinc-700"}`}>
                {isDefault ? "Yes, primary account" : "No, auxiliary method"}
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedCertification}
                onChange={(e) => setConfirmedCertification(e.target.checked)}
                className="mt-1 size-4 rounded text-zinc-950 focus:ring-zinc-900"
              />
              <span className="text-xs text-amber-950 leading-relaxed">
                <strong>Legal Certification & Authorization:</strong>{" "}
                {payoutType === "PAYPAL"
                  ? "I certify that I am the authorized holder of this PayPal account, that it is verified to receive funds, and I authorize Homyz to disburse my hosting earnings in USD at the SAMA fixed exchange rate."
                  : "I certify that I am the authorized holder of this bank account, that the beneficiary name matches my legal registration, and I authorize Homyz to transfer hosting earnings via SAMA SARIE."}
              </span>
            </label>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              disabled={loading}
              className="rounded-full border border-zinc-200 px-5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!confirmedCertification || loading}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-zinc-800 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LockIcon size={15} />
              <span>{loading ? "Registering Account..." : "Save Payout Method"}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Success & Verification Outcome */}
      {currentStep === 5 && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xs text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mb-4">
            <CheckCircleIcon size={32} />
          </div>

          <h2 className="text-xl font-medium text-zinc-950">
            Payout Method Registered Successfully!
          </h2>

          <p className="mt-2 text-xs sm:text-sm text-zinc-600 max-w-md mx-auto leading-relaxed">
            Your {createdMethod?.bankName === "PayPal" ? "PayPal account" : "bank account at " + (createdMethod?.bankName || "your bank")} (
            {createdMethod?.ibanMasked}) has been registered to your host profile.
          </p>

          <div className="mt-6 max-w-lg mx-auto rounded-2xl bg-zinc-50 p-4 border border-zinc-200 text-left text-xs sm:text-sm">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <span className="text-zinc-500">Status</span>
              <span className="font-medium text-emerald-700">
                {createdMethod?.status === "VERIFIED" ? "Verified for Disbursements" : "Pending Verification"}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
              {createdMethod?.status === "VERIFIED"
                ? "Your host identity is already verified. This payout method is active and ready to receive guest reservation settlements automatically."
                : "Your account details have been recorded. Administrative verification ensures your beneficiary name matches platform records before the first disbursement."}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/host/account-settings/payouts"
              className="rounded-full bg-zinc-950 px-6 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-zinc-800 transition-colors shadow-2xs"
            >
              View Payout Settings
            </Link>
            <Link
              href="/host/earnings"
              className="rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-xs sm:text-sm font-medium text-zinc-800 hover:bg-zinc-50 transition-colors"
            >
              Open Earnings Hub
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
