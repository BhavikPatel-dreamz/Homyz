"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { forgotPasswordAction } from "@/actions/auth/forgotPassword";

export function ForgotPasswordForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [emailVal, setEmailVal] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const email = emailVal.trim().toLowerCase();

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    startTransition(async () => {
      const res = await forgotPasswordAction({ email });
      if (!res.ok) {
        setError(res.error || "Failed to send reset link. Please check your email.");
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col gap-5 py-2 animate-in fade-in zoom-in-95">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-zinc-950">
            Check Your Email
          </h2>
          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
            If an account exists for <strong className="text-zinc-800">{emailVal}</strong>, we have sent password reset instructions to your inbox.
          </p>
        </div>

        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 font-medium">
          Please check your spam or junk folder if you don&apos;t see the email within a few minutes.
        </div>

        <Link
          href="/admin/login"
          className="w-full rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] py-3.5 text-sm font-bold text-zinc-900 transition-colors shadow-2xs text-center inline-block cursor-pointer mt-2"
        >
          ← Return to Sign In
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-semibold text-zinc-800">
          Email address *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={emailVal}
          onChange={(e) => setEmailVal(e.target.value)}
          placeholder="emailexample@gmail.com"
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors focus:border-zinc-900"
        />
      </div>

      <button
        type="submit"
        disabled={pending || !emailVal.trim()}
        className="mt-2 w-full rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] py-3.5 text-sm font-semibold text-zinc-900 transition-colors shadow-2xs disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
      >
        {pending && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
        )}
        <span>{pending ? "Sending Reset Link…" : "Send Reset Link"}</span>
      </button>

      <div className="text-center pt-2">
        <Link
          href="/admin/login"
          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors underline"
        >
          Remember your password? Log in
        </Link>
      </div>
    </form>
  );
}
