"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { acceptInvitationAction } from "@/actions/admin/invitationActions";
import { Alert, buttonClass, inputClass, labelClass } from "../ui";

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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Password requirement checks
  const minLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const matches = password.length > 0 && password === confirmPassword;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!minLength || !hasUpper || !hasNumber) {
      setError("Please ensure your password meets all complexity requirements below.");
      return;
    }

    startTransition(async () => {
      const res = await acceptInvitationAction({
        token,
        password,
        confirmPassword,
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
      <div className="flex flex-col gap-6 text-center py-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Account Activated Successfully!
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Your confidential administrator password has been set. You can now sign in with your new credentials.
          </p>
        </div>

        <Alert tone="success">
          Admin account for <strong>{email}</strong> is now active.
        </Alert>

        <Link
          href="/login"
          className={`${buttonClass} inline-flex items-center justify-center gap-2`}
        >
          Sign In to Admin Console →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}

      <div className="bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/60 mb-2">
        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
          Invitation Details
        </div>
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {name ? `${name} (${email})` : email}
        </div>
        <div className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-0.5">
          Role: {roleName}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={labelClass}>
          Create New Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pr-10`}
            placeholder="••••••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
            aria-label="Toggle password visibility"
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className={labelClass}>
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
          placeholder="••••••••••••"
        />
      </div>

      {/* Live Complexity Checklist */}
      <div className="bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs flex flex-col gap-1.5">
        <div className="font-semibold text-zinc-600 dark:text-zinc-400">Password Requirements:</div>
        <div className={`flex items-center gap-2 ${minLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-zinc-400"}`}>
          <span>{minLength ? "✓" : "○"}</span> At least 8 characters
        </div>
        <div className={`flex items-center gap-2 ${hasUpper ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-zinc-400"}`}>
          <span>{hasUpper ? "✓" : "○"}</span> At least one uppercase letter (A-Z)
        </div>
        <div className={`flex items-center gap-2 ${hasNumber ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-zinc-400"}`}>
          <span>{hasNumber ? "✓" : "○"}</span> At least one number (0-9)
        </div>
        {confirmPassword && (
          <div className={`flex items-center gap-2 ${matches ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-rose-500 font-medium"}`}>
            <span>{matches ? "✓" : "✕"}</span> Passwords match
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={pending || !minLength || !hasUpper || !hasNumber || !matches}
        className={`${buttonClass} mt-2`}
      >
        {pending ? "Activating Account…" : "Set Password & Activate Account"}
      </button>
    </form>
  );
}
