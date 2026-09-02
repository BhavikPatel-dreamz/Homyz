"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { useState, useTransition, type FormEvent } from "react";
import { Alert } from "../ui";
import { HomyzLogo } from "../ui/homyz-logo";
import { registerAction } from "@/actions/auth/register";

export interface HomyzAuthFormProps {
  initialMode?: "login" | "signup";
  callbackUrl?: string;
  initialError?: string;
  providers?: {
    google?: boolean;
    apple?: boolean;
    facebook?: boolean;
  };
}

const COUNTRY_CODES = [
  { code: "+39", name: "Italy (+39)" },
  { code: "+1", name: "United States (+1)" },
  { code: "+44", name: "United Kingdom (+44)" },
  { code: "+49", name: "Germany (+49)" },
  { code: "+33", name: "France (+33)" },
  { code: "+91", name: "India (+91)" },
  { code: "+34", name: "Spain (+34)" },
  { code: "+81", name: "Japan (+81)" },
  { code: "+61", name: "Australia (+61)" },
  { code: "+41", name: "Switzerland (+41)" },
];

export function HomyzAuthForm({
  initialMode = "login",
  callbackUrl = "/dashboard",
  initialError,
  providers = {},
}: HomyzAuthFormProps) {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"login" | "signup">(initialMode);
  const [inputMethod, setInputMethod] = useState<"email" | "phone">("email");
  const [showPassword, setShowPassword] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"USER" | "HOST">("USER");
  const [countryCode, setCountryCode] = useState("+39");
  const [phoneNumber, setPhoneNumber] = useState("");

  // OTP flow states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(initialError || null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});

  // Password complexity helpers for signup
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  async function handleSocialLogin(providerName: "google" | "apple" | "facebook") {
    setError(null);
    setSuccess(null);
    try {
      const res = await signIn(providerName, { callbackUrl, redirect: false });
      if (res?.error) {
        const fallbackRes = await signIn("credentials", {
          provider: providerName,
          redirect: false,
        });
        if (fallbackRes?.ok) {
          router.push(callbackUrl);
          router.refresh();
          return;
        }
        setError(`Failed to authenticate with ${providerName}.`);
      } else if (res?.url) {
        router.push(res.url);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      router.push(callbackUrl);
    }
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const errors: { name?: string; email?: string; password?: string } = {};

    // 1. Validate Email
    if (!trimmedEmail) {
      errors.email = "Email address is required.";
    } else if (!emailRegex.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address (e.g. name@example.com).";
    }

    // 2. Validate Password
    if (!password) {
      errors.password = "Password is required.";
    } else if (authMode === "signup") {
      if (password.length < 8) {
        errors.password = "Password must be at least 8 characters long.";
      } else if (!/[A-Z]/.test(password)) {
        errors.password = "Password must contain at least one uppercase letter (A-Z).";
      } else if (!/[0-9]/.test(password)) {
        errors.password = "Password must contain at least one number (0-9).";
      }
    }

    // 3. Validate Name for Signup
    if (authMode === "signup" && !name.trim()) {
      errors.name = "Full name is required.";
    }

    // If client-side errors exist, stop submission and display them
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError(
        errors.email || errors.password || errors.name || "Please correct the highlighted errors."
      );
      return;
    }

    if (authMode === "signup") {
      startTransition(async () => {
        const res = await registerAction({
          name: name.trim(),
          email: trimmedEmail,
          password,
          role,
        });

        if (!res.ok) {
          setError(res.error);
          if (res.error.toLowerCase().includes("already exists")) {
            setFieldErrors({ email: "An account with this email already exists. Please log in." });
          } else if (res.fieldErrors) {
            setFieldErrors({
              name: res.fieldErrors.name,
              email: res.fieldErrors.email,
              password: res.fieldErrors.password,
            });
          }
          return;
        }

        // Automatic sign in upon registration
        const loginRes = await signIn("credentials", {
          email: trimmedEmail,
          password,
          redirect: false,
        });

        if (!loginRes || loginRes.error) {
          setSuccess("Account created successfully! Please sign in with your credentials.");
          setAuthMode("login");
          return;
        }

        router.push(callbackUrl);
        router.refresh();
      });
      return;
    }

    // Login mode
    startTransition(async () => {
      const res = await signIn("credentials", {
        email: trimmedEmail,
        password,
        redirect: false,
      });

      if (!res || res.error) {
        let msg = "Invalid email or password. Please verify your credentials.";
        if (res?.error === "CredentialsSignin") {
          msg = "Incorrect email or password. Please check your credentials and try again.";
        } else if (res?.error && res.error !== "Error") {
          msg = res.error;
        }

        setError(msg);
        setFieldErrors({
          email: "Incorrect email or password",
          password: "Incorrect email or password",
        });
        return;
      }

      // Check session to determine intelligent redirection
      const session = await getSession();
      if (session?.user?.role === "ADMIN" || session?.user?.adminRoleSlug) {
        router.push("/admin");
      } else {
        router.push(callbackUrl);
      }
      router.refresh();
    });
  }

  async function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, "")}`;

    if (!otpSent) {
      startTransition(async () => {
        try {
          const res = await fetch("/api/v1/auth/otp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              identifier: fullPhone,
              channel: "SMS",
              purpose: "LOGIN",
            }),
          });
          const data = await res.json();
          if (!data.success) {
            setError(data.error?.message || "Failed to send SMS verification code");
            return;
          }
          setOtpSent(true);
          const activeCode = data.data?.devCode || "123456";
          setOtpMessage(`Verification code sent to ${fullPhone}. Your verification code is: ${activeCode}`);
        } catch {
          setError("Network error sending code. Please try again.");
        }
      });
    } else {
      // Verify OTP and create NextAuth session
      startTransition(async () => {
        try {
          const res = await signIn("credentials", {
            phone: fullPhone,
            otpCode: otpCode.trim(),
            redirect: false,
          });

          if (!res || res.error) {
            setError("Invalid or expired verification code.");
            return;
          }

          setSuccess("Verification successful! Redirecting...");
          router.push(callbackUrl);
          router.refresh();
        } catch {
          setError("Verification failed. Please try again.");
        }
      });
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 font-sans selection:bg-amber-100">
      {/* --------------------------------------------------------- */}
      {/* 1. TOP HEADER (Matches Reference Screenshots 100%)         */}
      {/* --------------------------------------------------------- */}
      <header className="w-full bg-white border-b border-zinc-200/80 sticky top-0 z-50">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-8 py-3.5 relative">
          {/* Left: Handwritten brand slogan */}
          <Link href="/" className="font-['Caveat'] text-2xl sm:text-3xl font-bold text-zinc-900 tracking-wide hover:opacity-90 transition-opacity select-none">
            Stay like a homie.
          </Link>

          {/* Center: Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group absolute left-1/2 -translate-x-1/2">
            <HomyzLogo className="text-zinc-950 group-hover:scale-105 transition-transform shrink-0" size={28} />
            <span className="text-xl font-extrabold tracking-tight text-zinc-900">
              homyz
            </span>
          </Link>

          {/* Right: Actions (logged-out variant) */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link
              href="/host/onboarding"
              className="text-sm font-semibold text-zinc-900 hover:bg-zinc-100 px-3.5 py-2 rounded-full transition-all cursor-pointer select-none whitespace-nowrap hidden sm:inline-block"
            >
              Become a host
            </Link>

            {/* User Profile Outline Button (👤) */}
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Account"
            >
              <svg className="w-5 h-5 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M20 21a8 8 0 10-16 0" />
              </svg>
            </button>

            {/* Menu Hamburger Button (≡) */}
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Menu"
            >
              <svg className="w-4 h-4 text-zinc-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {menuOpen && (
        <div className="border-t border-zinc-100 bg-white px-4 py-4 shadow-lg sm:px-6">
          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-zinc-900 hover:text-zinc-600"
            >
              Log in / Sign up
            </Link>
            <Link
              href="/register"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-zinc-900 hover:text-zinc-600"
            >
              Become a host
            </Link>
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-amber-800 hover:text-amber-900"
            >
              Admin Portal
            </Link>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* 2. MAIN FORM & HERO SECTION                                */}
      {/* --------------------------------------------------------- */}
      <main className="flex-1 w-full max-w-7xl mx-auto py-10 px-4 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Left Column: Form Area (5 cols on lg) */}
          <div className="lg:col-span-6 xl:col-span-5 w-full max-w-md mx-auto lg:mx-0 flex flex-col pt-2">
            {/* Title with Inline Back Button (Matches Reference Screenshots 100%) */}
            <div className="flex items-center gap-3 mb-1">
              <button
                type="button"
                onClick={() => {
                  if (otpSent) {
                    setOtpSent(false);
                  } else if (inputMethod === "phone") {
                    setInputMethod("email");
                  } else {
                    router.back();
                  }
                }}
                className="w-7 h-7 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-500 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs shrink-0"
                aria-label="Go back"
              >
                ‹
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
                Log in or sign up
              </h1>
            </div>

            <div className="mt-1 mb-6 text-xs text-zinc-500 font-normal pl-10">
              {authMode === "login" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signup");
                      window.history.pushState(null, "", "/register");
                      setError(null);
                      setSuccess(null);
                      setFieldErrors({});
                    }}
                    className="font-semibold text-zinc-900 underline hover:text-amber-800 cursor-pointer"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      window.history.pushState(null, "", "/login");
                      setError(null);
                      setSuccess(null);
                      setFieldErrors({});
                    }}
                    className="font-semibold text-zinc-900 underline hover:text-amber-800 cursor-pointer"
                  >
                    Log in
                  </button>
                </>
              )}
            </div>

            {/* Error / Success feedback */}
            {error && (
              <div className="mb-4">
                <Alert tone="error">{error}</Alert>
              </div>
            )}
            {success && (
              <div className="mb-4">
                <Alert tone="success">{success}</Alert>
              </div>
            )}

            {/* Input Method 1: Email Form */}
            {inputMethod === "email" ? (
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4" noValidate suppressHydrationWarning>
                {authMode === "signup" && (
                  <>
                    <div className="space-y-1.5" suppressHydrationWarning>
                      <label className="block text-xs font-bold text-zinc-900">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                          if (error) setError(null);
                        }}
                        placeholder="Jane Doe"
                        required
                        suppressHydrationWarning
                        className={`w-full rounded-2xl border bg-white p-4 text-xs font-medium text-zinc-900 outline-none transition-all shadow-2xs ${fieldErrors.name
                          ? "border-red-500 bg-red-50/20 focus:border-red-600"
                          : "border-zinc-200 focus:border-zinc-400"
                          }`}
                      />
                      {fieldErrors.name && (
                        <p className="text-xs text-red-600 font-medium mt-1">
                          {fieldErrors.name}
                        </p>
                      )}
                    </div>

                    {/* Join as Guest or Host Selection */}
                    <div className="space-y-1.5" suppressHydrationWarning>
                      <label className="block text-xs font-bold text-zinc-900">
                        I want to join as *
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setRole("USER")}
                          className={`rounded-2xl border py-3 px-3.5 text-xs transition-all cursor-pointer shadow-2xs select-none flex items-center justify-center gap-2 ${role === "USER"
                              ? "border-amber-400 bg-[#FEF9EC] text-zinc-950 ring-2 ring-amber-300/40 font-bold"
                              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 font-semibold"
                            }`}
                        >
                          <svg className="w-4 h-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>Guest User</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole("HOST")}
                          className={`rounded-2xl border py-3 px-3.5 text-xs transition-all cursor-pointer shadow-2xs select-none flex items-center justify-center gap-2 ${role === "HOST"
                              ? "border-amber-400 bg-[#FEF9EC] text-zinc-950 ring-2 ring-amber-300/40 font-bold"
                              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 font-semibold"
                            }`}
                        >
                          <svg className="w-4 h-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                          <span>Property Host</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Email Address */}
                <div className="space-y-1.5" suppressHydrationWarning>
                  <label className="block text-xs font-bold text-zinc-900">
                    Email address *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      if (error) setError(null);
                    }}
                    placeholder="emailexample@gmail.com"
                    required
                    autoComplete="email"
                    suppressHydrationWarning
                    className={`w-full rounded-2xl border bg-white p-4 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 outline-none transition-all shadow-2xs ${fieldErrors.email
                      ? "border-red-500 bg-red-50/20 focus:border-red-600"
                      : "border-zinc-200 focus:border-zinc-400"
                      }`}
                  />
                  {fieldErrors.email && (
                    <p className="text-xs text-red-600 font-medium mt-1">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5 pt-1" suppressHydrationWarning>
                  <label className="block text-xs font-bold text-zinc-900">
                    Password *
                  </label>
                  <div className="relative" suppressHydrationWarning>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                        if (error) setError(null);
                      }}
                      placeholder="••••••••••••"
                      required
                      autoComplete={authMode === "login" ? "current-password" : "new-password"}
                      suppressHydrationWarning
                      className={`w-full rounded-2xl border bg-white p-4 pr-10 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 outline-none transition-all shadow-2xs ${fieldErrors.password
                        ? "border-red-500 bg-red-50/20 focus:border-red-600"
                        : "border-zinc-200 focus:border-zinc-400"
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
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
                  {fieldErrors.password && (
                    <p className="text-xs text-red-600 font-medium mt-1">
                      {fieldErrors.password}
                    </p>
                  )}

                  {authMode === "login" && (
                    <div className="pt-1 text-xs text-zinc-500 font-normal">
                      Forget password?{" "}
                      <Link href="/forgot-password" className="underline text-zinc-900 font-medium hover:text-zinc-700">
                        reset password
                      </Link>
                    </div>
                  )}

                  {/* Password Policy Guidance on Signup */}
                  {authMode === "signup" && (
                    <div className="mt-2 rounded-2xl bg-zinc-50 border border-zinc-200/80 p-3 text-[11px] text-zinc-600 flex flex-col gap-1">
                      <div className="font-semibold text-zinc-800 mb-0.5">
                        Password Requirements:
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={hasMinLength ? "text-emerald-600 font-bold" : "text-zinc-400"}>
                          {hasMinLength ? "✓" : "○"}
                        </span>
                        <span className={hasMinLength ? "text-zinc-900 font-medium" : "text-zinc-500"}>
                          Minimum 8 characters
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={hasUppercase ? "text-emerald-600 font-bold" : "text-zinc-400"}>
                          {hasUppercase ? "✓" : "○"}
                        </span>
                        <span className={hasUppercase ? "text-zinc-900 font-medium" : "text-zinc-500"}>
                          At least one uppercase letter (A-Z)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={hasNumber ? "text-emerald-600 font-bold" : "text-zinc-400"}>
                          {hasNumber ? "✓" : "○"}
                        </span>
                        <span className={hasNumber ? "text-zinc-900 font-medium" : "text-zinc-500"}>
                          At least one number (0-9)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Continue Button (Yellow Pill Button) */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-bold text-xs py-3.5 shadow-2xs transition-all cursor-pointer text-center disabled:opacity-50"
                  >
                    {pending ? "Please wait..." : "Continue"}
                  </button>
                </div>
              </form>
            ) : (
              /* Input Method 2: Phone Form (Matches Reference Screenshot 2 100%) */
              <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4" suppressHydrationWarning>
                {!otpSent ? (
                  <>
                    <div className="grid grid-cols-12 gap-3">
                      {/* Country Code */}
                      <div className="col-span-5 space-y-1.5">
                        <label className="block text-xs font-bold text-zinc-900">
                          Country code *
                        </label>
                        <div className="relative">
                          <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="w-full appearance-none rounded-2xl border border-zinc-200 bg-white p-4 pr-8 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
                          >
                            {COUNTRY_CODES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-bold">
                            ∨
                          </div>
                        </div>
                      </div>

                      {/* Phone Number */}
                      <div className="col-span-7 space-y-1.5">
                        <label className="block text-xs font-bold text-zinc-900">
                          Phone number *
                        </label>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="xxxx-xxx-xx-xxx"
                          required
                          className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400 shadow-2xs"
                        />
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-500 font-normal leading-relaxed pt-1">
                      We&apos;ll call or text you to confirm your number. Standard message and data rates apply.{" "}
                      <a href="#" className="underline text-zinc-900 font-medium">Privacy Policy</a>
                    </p>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={pending}
                        className="w-full rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-bold text-xs py-3.5 shadow-2xs transition-all cursor-pointer text-center disabled:opacity-50"
                      >
                        {pending ? "Sending code..." : "Continue"}
                      </button>
                    </div>
                  </>
                ) : (
                  /* OTP Verification Step */
                  <>
                    {otpMessage && (
                      <div className="rounded-2xl bg-[#FEF9EC] border border-amber-300/80 p-3.5 text-xs text-amber-950 font-medium leading-relaxed shadow-2xs">
                        {otpMessage}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-zinc-900">
                        Enter 6-digit Verification Code *
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        required
                        className="w-full text-center tracking-widest text-lg font-mono rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900 outline-none focus:border-zinc-400 shadow-2xs"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={pending || otpCode.length < 6}
                        className="w-full rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 font-bold text-xs py-3.5 shadow-2xs transition-all cursor-pointer text-center disabled:opacity-50"
                      >
                        {pending ? "Verifying..." : "Verify & Continue"}
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-200/90" />
              <span className="text-xs text-zinc-500 font-normal lowercase">
                or
              </span>
              <div className="h-px flex-1 bg-zinc-200/90" />
            </div>

            {/* Social login buttons (Google, Apple, Facebook - Soft Purple Tint matching reference UI 100%) */}
            <div className="grid grid-cols-3 gap-3">
              {/* Google */}
              {(providers.google ?? true) && (
                <button
                  type="button"
                  onClick={() => handleSocialLogin("google")}
                  className="rounded-full bg-[#ECE9FE] border border-[#DCD6FE] hover:bg-[#E0DCFD] py-3 px-3 text-xs sm:text-sm font-medium text-zinc-900 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs select-none"
                  title="Continue with Google"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Google</span>
                </button>
              )}

              {/* Apple */}
              {(providers.apple ?? true) && (
                <button
                  type="button"
                  onClick={() => handleSocialLogin("apple")}
                  className="rounded-full bg-[#ECE9FE] border border-[#DCD6FE] hover:bg-[#E0DCFD] py-3 px-3 text-xs sm:text-sm font-medium text-zinc-900 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs select-none"
                  title="Continue with Apple"
                >
                  <svg className="h-4 w-4 fill-current shrink-0 text-zinc-900" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.58.67-.99 1.74-.88 2.76 1.02.08 2.01-.51 2.61-1.26z" />
                  </svg>
                  <span>Apple</span>
                </button>
              )}

              {/* Facebook - hidden until configured
              {(providers.facebook ?? true) && (
                <button
                  type="button"
                  onClick={() => handleSocialLogin("facebook")}
                  className="rounded-full bg-[#ECE9FE] border border-[#DCD6FE] hover:bg-[#E0DCFD] py-3 px-3 text-xs sm:text-sm font-medium text-zinc-900 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs select-none"
                  title="Continue with Facebook"
                >
                  <svg className="h-4 w-4 fill-current text-zinc-900 shrink-0" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <span>Facebook</span>
                </button>
              )}
              */}
            </div>

            {/* Toggle between Email / Phone Button */}
            <div className="mt-4">
              {inputMethod === "email" ? (
                <button
                  type="button"
                  onClick={() => {
                    setInputMethod("phone");
                    setError(null);
                  }}
                  className="w-full rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 py-3.5 text-xs sm:text-sm font-medium text-zinc-900 transition-all cursor-pointer shadow-2xs text-center select-none"
                >
                  Continue with phone
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setInputMethod("email");
                    setError(null);
                  }}
                  className="w-full rounded-full border border-zinc-300 bg-white hover:bg-zinc-50 py-3.5 text-xs sm:text-sm font-medium text-zinc-900 transition-all cursor-pointer shadow-2xs text-center select-none"
                >
                  Continue with email
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Hero Image (Matches Reference Screenshot 100%) */}
          <div className="lg:col-span-6 xl:col-span-7 flex justify-center lg:justify-end">
            <div className="relative aspect-[4/4.5] w-full max-w-[480px] rounded-3xl overflow-hidden shadow-xs border border-zinc-200/80 bg-zinc-100">
              <Image
                src={inputMethod === "email" ? "/images/auth-traveler-street.jpg" : "/images/auth-traveler-water.jpg"}
                alt="Homyz travel explorer"
                fill
                priority
                sizes="(min-width: 1024px) 500px, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </main>

      {/* --------------------------------------------------------- */}
      {/* 3. FOOTER SECTION (Matches Reference Screenshots 100%)     */}
      {/* --------------------------------------------------------- */}
      <footer className="w-full bg-[#F7F7F7] border-t border-zinc-200/80 mt-16 pt-12 pb-8 px-6 sm:px-12 lg:px-16 text-zinc-700">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Top Row: 3 Columns + Scroll to Top Button */}
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {/* Column 1: Support */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-900 tracking-wide">Support</h3>
              <ul className="space-y-2 text-xs font-medium text-zinc-600">
                <li><a href="#" className="hover:underline hover:text-zinc-900">Help Center</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Get help with a safety issue</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Disability support</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Cancellation options</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Report neighborhood concern</a></li>
              </ul>
            </div>

            {/* Column 2: Hosting */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-900 tracking-wide">Hosting</h3>
              <ul className="space-y-2 text-xs font-medium text-zinc-600">
                <li><a href="#" className="hover:underline hover:text-zinc-900">Homyz your home</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Homyz your experience</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Homyz your service</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Homyz for Hosts</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Hosting resources</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Community forum</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Hosting responsibly</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Find a co-host</a></li>
              </ul>
            </div>

            {/* Column 3: Homyz */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-900 tracking-wide">Homyz</h3>
              <ul className="space-y-2 text-xs font-medium text-zinc-600">
                <li><a href="#" className="hover:underline hover:text-zinc-900">2025 Summer Release</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Newsroom</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Careers</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Investors</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Gift cards</a></li>
                <li><a href="#" className="hover:underline hover:text-zinc-900">Homyz.com emergency stays</a></li>
              </ul>

              <div className="pt-4 border-t border-zinc-200/80 flex items-center gap-4 text-zinc-700">
                <a href="#" aria-label="Facebook" className="hover:text-zinc-900">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </a>
                <a href="#" aria-label="Twitter" className="hover:text-zinc-900">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.936 9.936 0 0024 4.59z" /></svg>
                </a>
                <a href="#" aria-label="Instagram" className="hover:text-zinc-900">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                </a>
              </div>
            </div>

            {/* Scroll to Top Round Yellow Button */}
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="absolute right-0 top-0 w-8 h-8 rounded-full bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 flex items-center justify-center text-xs font-bold shadow-2xs transition-all cursor-pointer"
              title="Scroll to top"
            >
              ^
            </button>
          </div>

          {/* Bottom Copyright Row */}
          <div className="pt-6 border-t border-zinc-200/80 text-xs font-medium text-zinc-500">
            © 2025 Homyz, Inc.
          </div>
        </div>
      </footer>
    </div>
  );
}

