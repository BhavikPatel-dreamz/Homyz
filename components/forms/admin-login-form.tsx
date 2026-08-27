"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn, getSession, signOut } from "next-auth/react";
import { useState, useTransition, type FormEvent } from "react";
import { Alert, Badge } from "../ui";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (!res || res.error) {
        setError(res?.error || "Invalid administrative credentials.");
        return;
      }

      // Verify the signed in user actually has administrative privileges
      const session = await getSession();
      if (session?.user?.role !== "ADMIN" && !session?.user?.adminRoleSlug) {
        await signOut({ redirect: false });
        setError("Access denied: Your account does not have administrative privileges.");
        return;
      }

      router.push("/admin");
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-6xl mx-auto bg-white text-zinc-900">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Form Column */}
        <div className="w-full max-w-md mx-auto lg:mx-0 flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 hover:border-zinc-400 text-zinc-700 bg-white hover:bg-zinc-50 transition-colors"
              aria-label="Go home"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>

            <Badge>Admin Portal</Badge>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
            Administrator Sign In
          </h1>
          <p className="mt-2 mb-6 text-sm text-zinc-500">
            Sign in to access system management, roles, and platform controls.
          </p>

          {/* Mobile Image */}
          <div className="block lg:hidden mb-6 rounded-2xl overflow-hidden shadow-xs border border-zinc-200">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src="/images/auth-traveler-street.jpg"
                alt="Admin Traveler"
                fill
                priority
                className="object-cover"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-800">
                Admin Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@homyz.local"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors focus:border-zinc-900"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-800">
                  Password *
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-zinc-500 hover:text-zinc-900"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors focus:border-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
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

            <button
              type="submit"
              disabled={pending}
              className="mt-2 w-full rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] py-3.5 text-sm font-semibold text-zinc-900 transition-colors shadow-2xs disabled:opacity-50"
            >
              {pending ? "Authenticating..." : "Log in to Admin"}
            </button>
          </form>

          <div className="mt-8 rounded-2xl bg-[#F8F9FA] border border-zinc-200 p-4 text-xs text-zinc-600">
            <div className="flex items-center gap-2 font-semibold text-zinc-900 mb-1">
              <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Security Notice
            </div>
            All administrative access attempts, IP addresses, and session timestamps are logged and monitored in compliance with platform security policies.
          </div>

          <div className="mt-4 text-center">
            <Link
              href="/login"
              className="text-xs text-zinc-500 hover:text-zinc-900 underline"
            >
              Back to general user login
            </Link>
          </div>
        </div>

        {/* Right Column Photo */}
        <div className="hidden lg:block">
          <div className="relative aspect-[4/5] w-full max-w-[520px] rounded-3xl overflow-hidden shadow-xs border border-zinc-200">
            <Image
              src="/images/auth-traveler-street.jpg"
              alt="Homyz Admin Explorer"
              fill
              priority
              sizes="(min-width: 1024px) 500px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
