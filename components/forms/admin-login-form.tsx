"use client";

import React, { useState, useTransition, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { Alert, Button } from "../ui";
import { toast } from "@/components/ui/toast";
import { AppHeader } from "@/components/dashboard/app-header";
import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthHeroImage } from "@/components/auth/auth-hero-image";
import { Footer } from "@/components/dashboard/footer";
import { authInputClass, authLabelClass } from "@/components/auth/auth-form.styles";

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

  const isFormValid = Boolean(email.trim() && password);

  return (
    <div className="account-page min-h-screen flex flex-col bg-white text-[#1F1F1F] font-sans selection:bg-amber-100 overflow-x-hidden w-full">
      {/* 1. TOP HEADER (Unified AppHeader with official logo) */}
      <AppHeader />

      {/* 2. MAIN FORM & HERO SECTION (Matches /login structure) */}
      <main className="flex-1 w-full flex items-center justify-center py-6 sm:py-8 lg:py-22.5 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[1318px] flex flex-col lg:flex-row items-start justify-between gap-8 lg:gap-8 xl:gap-[56px] mx-auto">
          {/* Left Column: Form Area */}
          <div className="left-column lg:pt-2.5 w-full max-w-[538px] lg:max-w-none lg:w-1/2 xl:w-[643px] flex flex-col mx-auto lg:mx-0">
            {/* Header / Title area with Slide Back Button */}
            <AuthHeading
              title="Log in"
              onBack={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/");
                }
              }}
            />

            {/* Subtitle */}
            <div className="pl-0 sm:pl-13.5 mb-2 sm:mb-4 lg:mb-6 font-['Poppins'] font-normal text-[15px] sm:text-[17px] lg:text-[18px] leading-relaxed text-[#727272]">
              Enter your credentials to access the admin portal.
            </div>

            {/* Mobile/Tablet Hero Image */}
            <AuthHeroImage
              mobile
              src="/images/auth-traveler-street.jpg"
              alt="Traveler carrying a backpack on a city street"
            />

            {/* Error feedback */}
            {error && (
              <div className="mb-4 pl-0 sm:pl-13.5 flex flex-col gap-2.5">
                <Alert tone="error">{error}</Alert>
              </div>
            )}

            {/* FORM CONTAINER */}
            <div className="w-full max-w-[538px] pl-0 lg:pl-13.5 flex flex-col gap-5 lg:gap-6">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                {/* Email address */}
                <div className="flex flex-col gap-2">
                  <label className={authLabelClass}>
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
                    className={`${authInputClass} placeholder:text-[#1F1F1F]/50`}
                  />
                </div>

                {/* Password */}
                <div className="flex flex-col gap-2">
                  <label className={authLabelClass}>
                    Password *
                  </label>
                  <div className="relative h-[56px]">
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
                      className="w-full h-full rounded-[8px] border border-[#727272] bg-white px-4 pr-12 font-['Poppins'] font-normal text-[15px] sm:text-[16px] text-[#1F1F1F] placeholder:text-[#1F1F1F]/50 outline-none focus:border-[#1F1F1F]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Link
                      href="/forgot-password"
                      className="font-['Poppins'] text-xs sm:text-sm text-[#1F1F1F] hover:underline font-normal cursor-pointer"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>

                {/* Continue / Sign in Button */}
                <Button
                  type="submit"
                  disabled={pending || !isFormValid}
                  fullWidth
                  isLoading={pending}
                  loadingText="Signing in..."
                  className="auth-action-button mt-2"
                >
                  Log in
                </Button>
              </form>
            </div>
          </div>

          {/* Right Column: Hero Image (Fluid on lg, fixed 619px on xl) */}
          <AuthHeroImage
            src="/images/auth-traveler-street.jpg"
            alt="Traveler carrying a backpack on a city street"
          />
        </div>
      </main>

      {/* 3. FOOTER */}
      <Footer />
    </div>
  );
}
