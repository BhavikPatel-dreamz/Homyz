"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";

import { resetPasswordAction } from "@/actions/auth/resetPassword";

import { Alert, buttonClass, inputClass, labelClass } from "../ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [showPassword, setShowPassword] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    startTransition(async () => {
      const res = await resetPasswordAction({ token, password });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
    });
  }

  if (!token) {
    return <Alert>This reset link is missing its token.</Alert>;
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">Your password has been updated.</Alert>
        <Link
          href="/login"
          className="text-center text-sm font-medium text-zinc-900 "
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={labelClass}>
          New password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            className={`${inputClass} pr-10`}
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
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
