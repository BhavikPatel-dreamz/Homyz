"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { acceptInvitationAction } from "@/actions/admin/invitationActions";
import { Alert, Button } from "@/components/ui";
import { authFieldErrorClass, authLabelClass } from "@/components/auth/auth-form.styles";

export function AcceptInvitationForm({
  token,
  email,
  name,
  roleName,
}: {
  token: string;
  email: string;
  name: string | null;
  roleName: string;
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    repeatPassword?: string;
  }>({});

  // Password complexity helpers matching register page
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === repeatPassword;
  const isFormValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const errors: { password?: string; repeatPassword?: string } = {};

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters long.";
    } else if (!/[A-Z]/.test(password)) {
      errors.password = "Password must contain at least one uppercase letter (A-Z).";
    } else if (!/[0-9]/.test(password)) {
      errors.password = "Password must contain at least one number (0-9).";
    }

    if (!repeatPassword) {
      errors.repeatPassword = "Confirm password is required.";
    } else if (password !== repeatPassword) {
      errors.repeatPassword = "Passwords do not match.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    startTransition(async () => {
      const res = await acceptInvitationAction({
        token,
        password,
        confirmPassword: repeatPassword,
      });

      if (!res.ok) {
        setError(res.error || "Failed to set password. Please check your invitation link.");
        return;
      }

      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col gap-5 text-center py-2 animate-in fade-in zoom-in-95">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-zinc-950 font-['Poppins']">
            Account Activated!
          </h2>
          <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed font-['Poppins']">
            Your administrator password has been set. You can now sign in to access the Homyz Admin Console.
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs sm:text-sm text-emerald-900 font-medium font-['Poppins']">
          Admin account for <strong className="font-semibold">{email}</strong> is now active.
        </div>

        <Link
          href="/login"
          className="auth-action-button box-border inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium text-[#1F1F1F] transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 border border-[#727272] hover:border-[#1F1F1F] hover:bg-[#F3F4F5] hover:text-[#1F1F1F] h-12 min-h-12 sm:h-[56px] sm:min-h-[56px] bg-[#FCDF9C] px-6 py-4 sm:text-lg text-base leading-6 active:border-[#1F1F1F] active:bg-[#F3F4F5] w-full mt-2"
        >
          Sign In to Admin Console →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 lg:gap-5" suppressHydrationWarning>
      {error && (
        <Alert tone="error">{error}</Alert>
      )}

      {/* Account Info Pill */}
      <div className="rounded-lg bg-zinc-50 border border-zinc-200/80 p-3 flex items-center justify-between gap-3 text-xs sm:text-sm font-['Poppins']">
        <div className="min-w-0 truncate">
          <span className="text-zinc-500">Account for: </span>
          <strong className="text-zinc-900 font-semibold">{name ? `${name} (${email})` : email}</strong>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
          {roleName}
        </span>
      </div>

      {/* Password */}
      <div className="flex flex-col gap-2" suppressHydrationWarning>
        <label className={authLabelClass}>
          Password *
        </label>
        <div className="relative h-[56px]" suppressHydrationWarning>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
              if (error) setError(null);
            }}
            placeholder="••••••••••••"
            required
            autoComplete="new-password"
            suppressHydrationWarning
            className="w-full h-full rounded-[8px] border border-[#727272] bg-white px-4 pr-12 font-['Poppins'] font-normal text-[15px] sm:text-[16px] text-[#1F1F1F] placeholder:text-[#1F1F1F]/50 outline-none focus:border-[#1F1F1F]"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
            aria-label="Toggle password visibility"
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {fieldErrors.password && (
          <p className={authFieldErrorClass}>{fieldErrors.password}</p>
        )}

        {/* Password Requirements Box - Exactly matching register page */}
        <div className="rounded-lg bg-zinc-50 border border-zinc-200/80 p-3 text-zinc-600 flex flex-col gap-1 mt-1 font-['Poppins']">
          <div className="font-semibold text-zinc-800 mb-0.5 text-xs sm:text-sm">Password Requirements:</div>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className={hasMinLength ? "text-emerald-600 font-semibold" : "text-zinc-400"}>
              {hasMinLength ? "✓" : "○"}
            </span>
            <span className={hasMinLength ? "text-[#1F1F1F] font-medium" : "text-zinc-500"}>
              Minimum 8 characters
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className={hasUppercase ? "text-emerald-600 font-semibold" : "text-zinc-400"}>
              {hasUppercase ? "✓" : "○"}
            </span>
            <span className={hasUppercase ? "text-[#1F1F1F] font-medium" : "text-zinc-500"}>
              At least one uppercase letter (A-Z)
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className={hasNumber ? "text-emerald-600 font-semibold" : "text-zinc-400"}>
              {hasNumber ? "✓" : "○"}
            </span>
            <span className={hasNumber ? "text-[#1F1F1F] font-medium" : "text-zinc-500"}>
              At least one number (0-9)
            </span>
          </div>
        </div>
      </div>

      {/* Repeat Password */}
      <div className="flex flex-col gap-2">
        <label className="font-['Poppins'] font-medium text-[15px] sm:text-[18px] leading-[23px] text-[#1F1F1F]">
          Repeat password *
        </label>
        <div className="relative h-[56px]">
          <input
            type={showRepeatPassword ? "text" : "password"}
            value={repeatPassword}
            onChange={(e) => {
              setRepeatPassword(e.target.value);
              if (fieldErrors.repeatPassword) setFieldErrors((prev) => ({ ...prev, repeatPassword: undefined }));
              if (error) setError(null);
            }}
            placeholder="••••••••••••"
            required
            autoComplete="new-password"
            className="w-full h-full rounded-[8px] border border-[#727272] bg-white px-4 pr-12 font-['Poppins'] font-normal text-[15px] sm:text-[16px] text-[#1F1F1F] placeholder:text-[#1F1F1F]/50 outline-none focus:border-[#1F1F1F]"
          />
          <button
            type="button"
            onClick={() => setShowRepeatPassword(!showRepeatPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
            aria-label="Toggle repeat password visibility"
          >
            {showRepeatPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {fieldErrors.repeatPassword && (
          <p className={authFieldErrorClass}>{fieldErrors.repeatPassword}</p>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={pending || !isFormValid}
        fullWidth
        isLoading={pending}
        loadingText="Activating Account…"
        className="auth-action-button mt-2"
      >
        Set Password & Activate Account
      </Button>
    </form>
  );
}
