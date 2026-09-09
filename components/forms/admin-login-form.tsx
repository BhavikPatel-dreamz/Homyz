"use client";

import React, { useState, useTransition, useEffect, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { Alert } from "../ui";
import { toast } from "@/components/ui/toast";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get("callbackUrl") || "/admin";
  const errorParam = searchParams.get("error");
  const loggedOutParam = searchParams.get("logged_out");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (loggedOutParam === "true") {
      toast.success("You have been signed out.");
    } else if (errorParam === "account_suspended") {
      setError("This account has been suspended by an administrator.");
    } else if (errorParam === "session_revoked") {
      setError("Your session was revoked. Please log in again.");
    }
  }, [loggedOutParam, errorParam]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    startTransition(async () => {
      const res = await signIn("credentials", {
        email: trimmedEmail,
        password,
        redirect: false,
      });

      if (!res || res.error) {
        let msg = "Invalid email or password. Please verify your credentials.";
        if (res?.error === "CredentialsSignin") {
          msg = "Incorrect email or password. Please check your credentials.";
        } else if (res?.error && res.error !== "Error") {
          msg = res.error;
        }
        setError(msg);
        toast.error(msg);
        return;
      }

      // Intelligent role-based redirection
      const session = await getSession();
      const isAdmin = session?.user?.role === "ADMIN" || Boolean(session?.user?.adminRoleSlug);

      toast.success("Signed in successfully!");

      let destination = callbackUrl;
      if (!isAdmin) {
        if (!destination || destination === "/admin" || destination.startsWith("/admin/")) {
          destination = "/dashboard";
        }
      }

      window.location.href = destination;
    });
  }

  return (
    <div className="w-full max-w-6xl mx-auto py-8 sm:py-12 px-4 sm:px-6 bg-white text-[#1F1F1F] font-sans flex flex-col justify-center">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Left Column: Form Area */}
        <div className="w-full max-w-md mx-auto lg:mx-0 flex flex-col justify-center">
          {/* Homyz Admin Logo */}
          <Link href="/" className="mb-6 flex items-center gap-3 group w-fit">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-[#FBDE9B] font-black shadow-xs transition-transform group-hover:scale-105">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-zinc-950 leading-none">
                homyz
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-amber-700 uppercase mt-1">
                Admin Console
              </span>
            </div>
          </Link>

          {/* Heading */}
          <h1 className="mb-6">
            Log in
          </h1>

          {/* Mobile Image */}
          <div className="block lg:hidden mb-6 rounded-2xl overflow-hidden shadow-xs border border-zinc-200">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src="/images/auth-traveler-street.jpg"
                alt="Traveler with backpack"
                fill
                priority
                className="object-cover object-center"
              />
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email Address */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-800">
                Email address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="emailexample@gmail.com"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-[#1F1F1F] placeholder:text-zinc-400 outline-none transition-colors focus:border-zinc-900"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-800">
                  Password *
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-zinc-500 hover:text-[#1F1F1F]"
                >
                  Forget password? <span className="underline">reset password</span>
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 pr-10 text-sm text-[#1F1F1F] placeholder:text-zinc-400 outline-none transition-colors focus:border-zinc-900"
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

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={pending}
              className="mt-2 w-full rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] py-3.5 text-sm font-semibold text-[#1F1F1F] transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {pending ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        {/* Right Column: Hero Photo on Desktop */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative aspect-[4/5] w-full max-w-[520px] rounded-3xl overflow-hidden shadow-xs border border-zinc-200">
            <Image
              src="/images/auth-traveler-street.jpg"
              alt="Traveler with backpack"
              fill
              priority
              sizes="(min-width: 1024px) 500px, 100vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
