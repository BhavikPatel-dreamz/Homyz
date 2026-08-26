"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, useTransition, type FormEvent } from "react";

import { registerAction } from "@/actions/auth/register";

import { Alert, buttonClass, inputClass, labelClass } from "../ui";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    const nameValue = String(fd.get("name") ?? "").trim();
    // SECURITY: only USER / HOST are ever offered; the server enforces this too.
    const role = String(fd.get("role") ?? "USER");
    const input = { email, password, role, name: nameValue || undefined };

    startTransition(async () => {
      const res = await registerAction(input);
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      // Auto sign-in after signup for a smooth first-run experience.
      await signIn("credentials", { email, password, redirect: false });
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={labelClass}>
          Name
        </label>
        <input id="name" name="name" type="text" className={inputClass} />
      </div>
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
        {fieldErrors.email ? (
          <p className="text-xs text-red-600">{fieldErrors.email}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
        {fieldErrors.password ? (
          <p className="text-xs text-red-600">{fieldErrors.password}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="role" className={labelClass}>
          I want to
        </label>
        <select id="role" name="role" defaultValue="USER" className={inputClass}>
          <option value="USER">Book places to stay</option>
          <option value="HOST">List my property (host)</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-zinc-900 dark:text-zinc-100"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
