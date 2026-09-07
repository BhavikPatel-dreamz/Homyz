"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { acceptInvitationAction } from "@/actions/admin/invitationActions";

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
      setError("Please ensure your password meets all complexity requirements.");
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
      <div className="flex flex-col gap-5 text-center py-2 animate-in fade-in zoom-in-95">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-zinc-950">
            Account Activated!
          </h2>
          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
            Your administrator password has been set. You can now sign in to access the Homyz Admin Console.
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 font-medium">
          Admin account for <strong className="font-semibold">{email}</strong> is now active.
        </div>

        <Link
          href="/admin/login"
          className="w-full rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] py-3.5 text-sm font-semibold text-[#1F1F1F] transition-colors shadow-2xs text-center inline-block cursor-pointer mt-2"
        >
          Sign In to Admin Console →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 font-medium animate-in fade-in">
          {error}
        </div>
      )}

      {/* Invitation Details Info Card */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 flex items-center gap-3.5 shadow-2xs">
        <div className="h-10 w-10 rounded-full bg-zinc-900 text-white font-semibold flex items-center justify-center text-sm shrink-0">
          {(name?.[0] || email?.[0] || "A").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="text-xs font-semibold text-[#1F1F1F] truncate">
              {name || "Administrator"}
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
              Role: {roleName}
            </span>
          </div>
          <div className="text-xs text-zinc-500 font-mono truncate">{email}</div>
        </div>
      </div>

      {/* Create New Password */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-semibold text-zinc-800">
          Create New Password *
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
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 pr-10 text-sm text-[#1F1F1F] placeholder:text-zinc-400 outline-none transition-colors focus:border-zinc-900"
            placeholder="••••••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors p-1"
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

      {/* Confirm Password */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className="text-xs font-semibold text-zinc-800">
          Confirm Password *
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-[#1F1F1F] placeholder:text-zinc-400 outline-none transition-colors focus:border-zinc-900"
          placeholder="••••••••••••"
        />
      </div>

      {/* Live Complexity Checklist */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 text-xs flex flex-col gap-2">
        <div className="font-semibold text-zinc-700 uppercase tracking-wider text-[10px]">
          Password Requirements:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-colors ${
              minLength
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-white text-zinc-500 border-zinc-200"
            }`}
          >
            <span className="font-semibold">{minLength ? "✓" : "○"}</span> At least 8 characters
          </div>
          <div
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-colors ${
              hasUpper
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-white text-zinc-500 border-zinc-200"
            }`}
          >
            <span className="font-semibold">{hasUpper ? "✓" : "○"}</span> One uppercase (A-Z)
          </div>
          <div
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-colors ${
              hasNumber
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-white text-zinc-500 border-zinc-200"
            }`}
          >
            <span className="font-semibold">{hasNumber ? "✓" : "○"}</span> One number (0-9)
          </div>
          {confirmPassword ? (
            <div
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-colors ${
                matches
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              <span className="font-semibold">{matches ? "✓" : "✕"}</span> Passwords match
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-zinc-200 bg-white text-zinc-400 text-[11px]">
              <span>○</span> Match confirmation
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={pending || !minLength || !hasUpper || !hasNumber || !matches}
        className="mt-2 w-full rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] py-3.5 text-sm font-semibold text-[#1F1F1F] transition-colors shadow-2xs disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
      >
        {pending && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
        )}
        <span>{pending ? "Activating Account…" : "Set Password & Activate Account"}</span>
      </button>
    </form>
  );
}
