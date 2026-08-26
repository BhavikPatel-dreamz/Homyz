"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";

import { resetPasswordAction } from "@/actions/auth/resetPassword";

import { Alert, buttonClass, inputClass, labelClass } from "../ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
          className="text-center text-sm font-medium text-zinc-900 dark:text-zinc-100"
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
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
