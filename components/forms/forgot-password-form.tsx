"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { forgotPasswordAction } from "@/actions/auth/forgotPassword";
import { authInputClass, authLabelClass } from "@/components/auth/auth-form.styles";
import { Alert } from "@/components/ui";
import { Button } from "@/components/ui/button";

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
          <h2 className="text-2xl font-semibold text-zinc-950">
            Check Your Email
          </h2>
          <p className="mt-1.5 text-sm font-normal leading-6 text-[#727272]">
            If an account exists for <strong className="text-zinc-800">{emailVal}</strong>, we have sent password reset instructions to your inbox.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm font-normal leading-6 text-amber-900">
          Please check your spam or junk folder if you don&apos;t see the email within a few minutes.
        </div>

        <Link
          href="/login"
          className="auth-action-button brush-button-border box-border inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium text-[#1F1F1F] transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 border border-transparent hover:border-[#1F1F1F] hover:bg-[#F3F4F5] hover:text-[#1F1F1F] h-12 min-h-12 sm:h-[56px] sm:min-h-[56px] bg-[#FCDF9C] px-6 py-4 sm:text-lg text-base leading-6 active:border-[#1F1F1F] active:bg-[#F3F4F5] w-full"
        >
          ← Return to Sign In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 lg:gap-6">
      {error && (
        <Alert tone="error">{error}</Alert>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className={authLabelClass}>
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
          className={`${authInputClass} placeholder:text-[#1F1F1F]/50`}
        />
      </div>

      <Button
        type="submit"
        disabled={pending || !emailVal.trim()}
        fullWidth
        isLoading={pending}
        loadingText="Sending Reset Link…"
        className="auth-action-button mt-2 h-12 min-h-12 py-0 sm:h-[57px] sm:min-h-[57px]"
      >
        Send Reset Link
      </Button>

      <div className="text-center pt-2">
        <Link
          href="/login"
          className="font-['Poppins'] text-[14px] font-normal text-[#1F1F1F] underline transition-opacity hover:opacity-80 sm:text-[16px]"
        >
          Remember your password? Log in
        </Link>
      </div>
    </form>
  );
}
