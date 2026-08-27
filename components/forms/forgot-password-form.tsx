"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";

import { forgotPasswordAction } from "@/actions/auth/forgotPassword";

import { Alert, buttonClass, inputClass, labelClass } from "../ui";

export function ForgotPasswordForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    startTransition(async () => {
      const res = await forgotPasswordAction({ email });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">
          If an account exists for that email, a password reset link is on its
          way.
        </Alert>
        <Link
          href="/login"
          className="text-center text-sm font-medium text-zinc-900 "
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
