"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { completeRegistrationProfileAction } from "@/actions/auth/completeProfile";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { isValidE164Phone, normalizePhone } from "@/lib/auth/normalization";
import { COUNTRY_CODES, getCountryByCallingCode } from "@/lib/auth/country-codes";
import type { RequiredProfileField } from "@/lib/auth/profile-completion";

type FieldErrors = Partial<Record<"name" | "birthDate" | "email" | "phone", string>>;

const inputClass =
  "h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-[#1F1F1F] outline-none transition focus:border-[#1F1F1F] focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100";

export function ProfileCompletionModal() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const missingFields = user?.missingProfileFields ?? [];
  const shouldOpen = status === "authenticated" && user?.profileComplete === false;

  if (!shouldOpen || !user) return null;

  return (
    <ProfileCompletionDialog
      key={`${user.id}:${missingFields.join(",")}`}
      initialName={missingFields.includes("name") ? "" : user.name?.trim() ?? ""}
      missingFields={missingFields}
    />
  );
}

function ProfileCompletionDialog({
  initialName,
  missingFields,
}: {
  initialName: string;
  missingFields: RequiredProfileField[];
}) {
  const router = useRouter();
  const { update } = useSession();
  const needsEmail = missingFields.includes("email");
  const needsPhone = missingFields.includes("phone");

  const [name, setName] = useState(initialName);
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");

  // Phone: split into country code + local number (mirrors login page)
  const [countryCode, setCountryCode] = useState("+39");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  // Per-country digit length validation
  const selectedCountry = getCountryByCallingCode(countryCode);
  const minPhoneLen = selectedCountry?.minLength ?? 7;
  const maxPhoneLen = selectedCountry?.maxLength ?? 15;
  const cleanPhoneDigits = phoneNumber.replace(/\D/g, "");

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (name.trim().length < 2) errors.name = "Enter your full name.";
    if (!birthDate) {
      errors.birthDate = "Birth date is required.";
    } else {
      const parsed = new Date(`${birthDate}T00:00:00.000Z`);
      const today = new Date().toISOString().slice(0, 10);
      if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== birthDate ||
        birthDate < "1900-01-01" ||
        birthDate > today
      ) {
        errors.birthDate = "Enter a valid birth date.";
      }
    }
    if (needsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (needsPhone) {
      if (!cleanPhoneDigits) {
        errors.phone = "Mobile number is required.";
      } else if (cleanPhoneDigits.length < minPhoneLen || cleanPhoneDigits.length > maxPhoneLen) {
        errors.phone = `Enter a valid number for ${selectedCountry?.name ?? "the selected country"} (${minPhoneLen}–${maxPhoneLen} digits).`;
      } else {
        const fullPhone = `${countryCode}${cleanPhoneDigits}`;
        if (!isValidE164Phone(normalizePhone(fullPhone))) {
          errors.phone = "Enter a valid mobile number.";
        }
      }
    }
    return errors;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    startTransition(async () => {
      const fullPhone = needsPhone
        ? normalizePhone(`${countryCode}${cleanPhoneDigits}`)
        : undefined;

      const result = await completeRegistrationProfileAction({
        name: name.trim(),
        birthDate,
        ...(needsEmail ? { email: email.trim().toLowerCase() } : {}),
        ...(fullPhone ? { phone: fullPhone } : {}),
      });

      if (!result.ok) {
        setError(result.error);
        setFieldErrors((result.fieldErrors ?? {}) as FieldErrors);
        return;
      }

      // Refresh the one shared session source immediately.
      await update();
      router.refresh();
    });
  }

  return (
    <ModalOverlay
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]"
      role="presentation"
      data-testid="profile-completion-overlay"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-completion-title"
        aria-describedby="profile-completion-description"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[520px] overflow-y-auto overscroll-contain rounded-[24px] bg-white text-[#1F1F1F] shadow-2xl"
      >
        <div className="border-b border-zinc-200 px-6 py-5 text-center sm:px-8">
          <h2 id="profile-completion-title" className="text-xl font-semibold tracking-tight">
            Let&apos;s complete your profile
          </h2>
          <p id="profile-completion-description" className="mt-1 text-sm text-zinc-500">
            This information is required to use your Homyz account.
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-5 px-6 py-6 sm:px-8">
          {error ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {/* Full name */}
          <div>
            <label htmlFor="profile-full-name" className="mb-2 block text-sm font-semibold">
              Full name <span aria-hidden="true">*</span>
            </label>
            <input
              id="profile-full-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              autoComplete="name"
              autoFocus
              required
              disabled={pending}
              aria-invalid={Boolean(fieldErrors.name)}
            />
            {fieldErrors.name ? <p className="mt-1.5 text-xs text-red-600">{fieldErrors.name}</p> : null}
          </div>

          {/* Birth date */}
          <div>
            <label htmlFor="profile-birth-date" className="mb-2 block text-sm font-semibold">
              Birth date <span aria-hidden="true">*</span>
            </label>
            <input
              id="profile-birth-date"
              type="date"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              className={inputClass}
              autoComplete="bday"
              required
              disabled={pending}
              aria-invalid={Boolean(fieldErrors.birthDate)}
            />
            {fieldErrors.birthDate ? <p className="mt-1.5 text-xs text-red-600">{fieldErrors.birthDate}</p> : null}
          </div>

          {/* Email (optional field) */}
          {needsEmail ? (
            <div>
              <label htmlFor="profile-email" className="mb-2 block text-sm font-semibold">
                Email address <span aria-hidden="true">*</span>
              </label>
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                autoComplete="email"
                placeholder="name@example.com"
                required
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email ? <p className="mt-1.5 text-xs text-red-600">{fieldErrors.email}</p> : null}
            </div>
          ) : null}

          {/* Mobile number — country code dropdown + local number (mirrors login page) */}
          {needsPhone ? (
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Mobile number <span aria-hidden="true">*</span>
              </label>

              <div className="flex gap-2">
                {/* Country code selector — shows flag+code when closed, full list when open */}
                <div className="relative shrink-0 w-[110px]">
                  {/* Visible display: flag + code only */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center gap-1.5 pl-3 pr-8 text-sm text-[#1F1F1F] font-medium"
                  >
                    <span>{selectedCountry?.flag ?? "🌍"}</span>
                    <span>{countryCode}</span>
                  </div>
                  {/* Transparent select on top — native OS dropdown still shows full names */}
                  <select
                    value={countryCode}
                    onChange={(e) => {
                      setCountryCode(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    disabled={pending}
                    aria-label="Country calling code"
                    className="h-12 w-full appearance-none rounded-xl border border-zinc-300 bg-transparent pl-3 pr-8 text-transparent outline-none transition focus:border-[#1F1F1F] focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 cursor-pointer"
                  >
                    {COUNTRY_CODES.map((c, idx) => (
                      <option key={`${c.iso2}-${c.code}-${idx}`} value={c.code} className="text-[#1F1F1F]">
                        {c.flag} {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                  {/* Chevron icon */}
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#1F1F1F]">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {/* Local phone number */}
                <input
                  id="profile-phone"
                  type="tel"
                  inputMode="numeric"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value.replace(/\D/g, ""));
                    setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  placeholder={selectedCountry?.placeholder ?? "5XX XXX XXX"}
                  required
                  disabled={pending}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className="h-12 flex-1 min-w-0 rounded-xl border border-zinc-300 bg-white px-4 text-sm text-[#1F1F1F] placeholder:text-zinc-400 outline-none transition focus:border-[#1F1F1F] focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100"
                />
              </div>

              {fieldErrors.phone ? (
                <p className="mt-1.5 text-xs text-red-600">{fieldErrors.phone}</p>
              ) : (
                <p className="mt-1.5 text-xs text-zinc-500">
                  Select your country, then enter your local number.
                </p>
              )}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#1F1F1F] px-5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-65"
          >
            {pending ? "Saving profile…" : "Save and continue"}
          </button>
        </form>
      </section>
    </ModalOverlay>
  );
}
