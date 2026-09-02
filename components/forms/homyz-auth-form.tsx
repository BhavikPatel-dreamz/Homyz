"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { useState, useTransition, type FormEvent } from "react";
import { Alert, Button } from "../ui";
import { registerAction } from "@/actions/auth/register";
import { AppHeader } from "@/components/dashboard/app-header";
import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthHeroImage } from "@/components/auth/auth-hero-image";
import { AuthMethodToggle } from "@/components/auth/auth-method-toggle";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import type { AuthMode, AuthProviders, SocialProvider } from "@/components/auth/auth-form.types";
import { authFieldErrorClass, authInputClass, authLabelClass } from "@/components/auth/auth-form.styles";
import { Container } from "@/components/ui/container";

export interface HomyzAuthFormProps {
  initialMode?: "login" | "signup";
  callbackUrl?: string;
  initialError?: string;
  providers?: AuthProviders;
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
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  const [inputMethod, setInputMethod] = useState<"phone" | "email">("phone");
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
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
    repeatPassword?: string;
  }>({});

  // Password complexity helpers for signup
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  async function handleSocialLogin(providerName: SocialProvider) {
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

    const cleanNumber = phoneNumber.replace(/\D/g, "");
    if (!cleanNumber) {
      setError("Please enter a valid phone number.");
      return;
    }

    const fullPhone = `${countryCode}${cleanNumber}`;

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
    <div className="min-h-screen flex flex-col bg-white text-[#1F1F1F] font-sans selection:bg-amber-100 overflow-x-hidden w-full">
      {/* --------------------------------------------------------- */}
      {/* 1. TOP HEADER (Unified AppHeader)                          */}
      {/* --------------------------------------------------------- */}
      <AppHeader />

      {/* --------------------------------------------------------- */}
      {/* 2. MAIN FORM & HERO SECTION (Fully Responsive)             */}
      {/* --------------------------------------------------------- */}
      <main className="flex-1 w-full flex items-center justify-center py-6 sm:py-8 lg:py-14 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[1318px] flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-8 xl:gap-[56px] mx-auto">
          {/* Left Column: Form Area */}
          <div className="w-full max-w-[538px] lg:max-w-none lg:w-1/2 xl:w-[643px] flex flex-col mx-auto lg:mx-0">
            {/* Header / Title area with Slide Back Button */}
            <AuthHeading
              onBack={() => {
                  if (otpSent) {
                    setOtpSent(false);
                  } else if (inputMethod === "email") {
                    setInputMethod("phone");
                  } else {
                    router.back();
                  }
              }}
            />

            {/* Subtitle */}
            <div className="pl-0 sm:pl-13.5 mb-2 sm:mb-4 lg:mb-6 font-['Poppins'] font-normal text-[15px] sm:text-[17px] lg:text-[18px] leading-relaxed text-[#727272]">
              {authMode === "login" ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signup");
                      window.history.pushState(null, "", "/register");
                      setError(null);
                      setSuccess(null);
                    }}
                    className="underline text-[#1F1F1F] hover:opacity-80 font-normal cursor-pointer"
                  >
                    Log in
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
                    }}
                    className="underline text-[#1F1F1F] hover:opacity-80 font-normal cursor-pointer"
                  >
                    Log in
                  </button>
                </>
              )}
            </div>

            {/* Mobile/Tablet Hero Image (between subtitle and form inputs, matches mobile.jpg 100%, hidden on lg+) */}
            <AuthHeroImage mobile />

            {/* Error / Success feedback */}
            {error && (
              <div className="mb-4 pl-0 sm:pl-13.5">
                <Alert tone="error">{error}</Alert>
              </div>
            )}
            {success && (
              <div className="mb-4 pl-0 sm:pl-13.5">
                <Alert tone="success">{success}</Alert>
              </div>
            )}

            {/* FORM CONTAINER (Frame 1996663726 - responsive width) */}
            <div className="w-full max-w-[538px] pl-0 lg:pl-13.5 flex flex-col gap-5 lg:gap-6">
              {inputMethod === "phone" ? (
                /* ==================== PHONE FORM ==================== */
                <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4 lg:gap-5" suppressHydrationWarning>
                  {!otpSent ? (
                    <>
                      {/* Country code + Phone number row */}
                      <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-3 w-full">
                        {/* Country code (full width on mobile, 171px on sm+) */}
                        <div className="flex flex-col gap-1.5 sm:gap-2 w-full sm:w-[171px] shrink-0">
                          <label className="font-['Poppins'] font-medium text-base sm:text-lg leading-[24px] text-[#1F1F1F]">
                            Country code *
                          </label>
                          <div className="relative h-[56px]">
                            <select
                              value={countryCode}
                              onChange={(e) => setCountryCode(e.target.value)}
                              className="w-full h-full appearance-none rounded-[8px] border border-[#72727299] bg-white px-4 pr-10 font-['Poppins'] font-normal text-[15px] sm:text-[16px] text-[#1F1F1F] outline-none focus:border-[#1F1F1F] transition-colors cursor-pointer"
                            >
                              {COUNTRY_CODES.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#1F1F1F]">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* Phone number (full width on mobile, flex-1 on sm+) */}
                        <div className="flex flex-col gap-1.5 sm:gap-2 flex-1 w-full min-w-0">
                          <label className="font-['Poppins'] font-medium text-[15px] sm:text-[18px] leading-[23px] text-[#1F1F1F]">
                            Phone number *
                          </label>
                          <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="xxxx-xxx-xx-xxx"
                            required
                            className="w-full h-[56px] rounded-[8px] border border-[#727272] bg-white px-4 font-['Poppins'] font-normal text-[15px] sm:text-[16px] text-[#1F1F1F] placeholder:text-[#727272] outline-none focus:border-[#1F1F1F] transition-colors"
                          />
                        </div>
                      </div>

                      {/* Disclaimer text */}
                      <p className="font-['Poppins'] font-normal text-sm leading-5.25 text-[#727272]">
                        We’ll call or text you to confirm your number. Standard message and data rates apply.{" "}
                        <a href="#" className="underline text-[#1F1F1F] hover:text-[#727272]">
                          Privacy Policy
                        </a>
                      </p>

                      {/* Continue Button (Height 56px, bg #FCDF9C, border #1F1F1F, radius 30px) */}
                      <Button
                        type="submit"
                        disabled={pending}
                        fullWidth
                        isLoading={pending}
                        loadingText="Sending code..."
                      >
                        Continue
                      </Button>
                    </>
                  ) : (
                    /* OTP Verification */
                    <div className="flex flex-col gap-4">
                      {otpMessage && (
                        <div className="rounded-xl bg-[#FEF9EC] border border-amber-300 p-3.5 text-xs text-amber-950 font-medium">
                          {otpMessage}
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <label className="font-['Poppins'] font-medium text-[15px] sm:text-[18px] text-[#1F1F1F]">
                          Enter 6-digit Verification Code *
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="123456"
                          required
                          className="w-full h-[56px] text-center tracking-widest text-lg font-mono rounded-[8px] border border-[#727272] bg-white p-4 text-[#1F1F1F] outline-none focus:border-[#1F1F1F]"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={pending || otpCode.length < 6}
                        fullWidth
                        isLoading={pending}
                        loadingText="Verifying..."
                      >
                        Verify &amp; Continue
                      </Button>
                    </div>
                  )}
                </form>
              ) : (
                /* ==================== EMAIL FORM ==================== */
                <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4" noValidate suppressHydrationWarning>
                  {authMode === "signup" && (
                    <>
                      <div className="flex flex-col gap-2">
                        <label className={authLabelClass}>
                          Full name *
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
                          className="w-full h-[56px] rounded-[8px] border border-[#727272] bg-white px-4 font-['Poppins'] text-[15px] sm:text-[16px] text-[#1F1F1F] placeholder:text-[#1F1F1F]/50 outline-none focus:border-[#1F1F1F]"
                        />
                        {fieldErrors.name && (
                          <p className={authFieldErrorClass}>{fieldErrors.name}</p>
                        )}
                      </div>

                      {/* Join as Guest / Host */}
                      <div className="flex flex-col gap-2">
                        <label className={authLabelClass}>
                          I want to join as *
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setRole("USER")}
                            className={`h-[52px] rounded-[12px] border text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              role === "USER"
                                ? "border-[#1F1F1F] bg-[#FCDF9C] text-[#1F1F1F]"
                                : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                            }`}
                          >
                            Guest User
                          </button>
                          <button
                            type="button"
                            onClick={() => setRole("HOST")}
                            className={`h-[52px] rounded-[12px] border text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              role === "HOST"
                                ? "border-[#1F1F1F] bg-[#FCDF9C] text-[#1F1F1F]"
                                : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
                            }`}
                          >
                            Property Host
                          </button>
                        </div>
                      </div>
                    </>
                  )}

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
                        if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                        if (error) setError(null);
                      }}
                      placeholder="emailexample@gmail.com"
                      required
                      autoComplete="email"
                      className={`${authInputClass} placeholder:text-[#1F1F1F]/50`}
                    />
                    {fieldErrors.email && (
                      <p className={authFieldErrorClass}>{fieldErrors.email}</p>
                    )}
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
                          if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                          if (error) setError(null);
                        }}
                        placeholder="••••••••••••"
                        required
                        autoComplete={authMode === "login" ? "current-password" : "new-password"}
                        className="w-full h-full rounded-[8px] border border-[#727272] bg-white px-4 pr-12 font-['Poppins'] font-normal text-[15px] sm:text-[16px] text-[#1F1F1F] placeholder:text-[#1F1F1F]/50 outline-none focus:border-[#1F1F1F]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
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
                    {fieldErrors.password && (
                      <p className={authFieldErrorClass}>{fieldErrors.password}</p>
                    )}

                    {authMode === "signup" && (
                      <div className="rounded-lg bg-zinc-50 border border-zinc-200/80 p-3 text-[11px] text-zinc-600 flex flex-col gap-1 mt-1">
                        <div className="font-semibold text-zinc-800 mb-0.5">Password Requirements:</div>
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

                  {authMode === "signup" && (
                    <div className="flex flex-col gap-2">
                      <label className="font-['Poppins'] font-medium text-[15px] sm:text-[18px] leading-[23px] text-[#1F1F1F]">
                        Repeat password *
                      </label>
                      <input
                        type="password"
                        value={repeatPassword}
                        onChange={(e) => {
                          setRepeatPassword(e.target.value);
                          if (fieldErrors.repeatPassword) setFieldErrors((prev) => ({ ...prev, repeatPassword: undefined }));
                          if (error) setError(null);
                        }}
                        placeholder="••••••••••••"
                        required
                        className={`${authInputClass} placeholder:text-[#1F1F1F]/50`}
                      />
                      {fieldErrors.repeatPassword && (
                        <p className={authFieldErrorClass}>{fieldErrors.repeatPassword}</p>
                      )}
                    </div>
                  )}

                  {authMode === "login" && (
                    <div className="text-sm text-[#727272] font-normal">
                      Forget password?{" "}
                      <Link href="/forgot-password" className="underline text-[#1F1F1F] hover:opacity-80">
                        reset password
                      </Link>
                    </div>
                  )}

                  {/* Continue Button */}
                  <Button
                    type="submit"
                    disabled={pending}
                    fullWidth
                    isLoading={pending}
                    className="mt-2"
                  >
                    Continue
                  </Button>
                </form>
              )}

              {/* Divider (Frame 1996663724) */}
              <div className="flex items-center gap-3 sm:gap-4 w-full my-1">
                <div className="h-[1px] flex-1 bg-[#727272]" />
                <span className="font-['Poppins'] font-normal text-[15px] sm:text-[16px] leading-[24px] text-[#1F1F1F]">
                  or
                </span>
                <div className="h-[1px] flex-1 bg-[#727272]" />
              </div>

              {/* Social Buttons (Frame 1996663725 - Google, Apple, Facebook in 1 row) */}
              <SocialLoginButtons providers={providers} onLogin={handleSocialLogin} />

              {/* Bottom Toggle Button (Continue with email / phone) */}
              <AuthMethodToggle
                inputMethod={inputMethod}
                onToggle={() => {
                  setInputMethod(inputMethod === "phone" ? "email" : "phone");
                  setError(null);
                }}
              />
            </div>
          </div>

          {/* Right Column: Hero Image (Fluid on lg, fixed 619px on xl) */}
          <AuthHeroImage />
        </div>
      </main>

      {/* --------------------------------------------------------- */}
      {/* 3. FOOTER SECTION (Matches mobile.jpg & Desktop design)    */}
      {/* --------------------------------------------------------- */}
      <footer className="w-full bg-[#FAFAFA] border-t border-[#E5E5E5] mt-12 pt-10 sm:pt-12 pb-8 text-[#1F1F1F]">
        <Container className="space-y-10">
          {/* 3 Columns Grid + Desktop Scroll to Top Button */}
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {/* Column 1: Support */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-['Poppins'] text-base font-semibold text-[#1F1F1F] tracking-wide">
                  Support
                </h3>
                {/* Mobile Scroll to Top Button (visible on mobile only, matching mobile.jpg) */}
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="md:hidden w-8 h-8 rounded-full bg-[#FCDF9C] hover:bg-[#f5d687] text-[#1F1F1F] flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0"
                  title="Scroll to top"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              </div>
              <ul className="space-y-2.5 font-['Poppins'] text-sm font-normal text-[#1F1F1F]">
                <li><a href="#" className="underline hover:text-black">Help Center</a></li>
                <li><a href="#" className="underline hover:text-black">Get help with a safety issue</a></li>
                <li><a href="#" className="underline hover:text-black">Disability support</a></li>
                <li><a href="#" className="underline hover:text-black">Cancellation options</a></li>
                <li><a href="#" className="underline hover:text-black">Report neighborhood concern</a></li>
              </ul>
            </div>

            {/* Column 2: Hosting */}
            <div className="space-y-3">
              <h3 className="font-['Poppins'] text-base font-semibold text-[#1F1F1F] tracking-wide">
                Hosting
              </h3>
              <ul className="space-y-2.5 font-['Poppins'] text-sm font-normal text-[#1F1F1F]">
                <li><a href="#" className="underline hover:text-black">Homyz your home</a></li>
                <li><a href="#" className="underline hover:text-black">Homyz your experience</a></li>
                <li><a href="#" className="underline hover:text-black">Homyz your service</a></li>
                <li><a href="#" className="underline hover:text-black">Homyz for Hosts</a></li>
                <li><a href="#" className="underline hover:text-black">Hosting resources</a></li>
                <li><a href="#" className="underline hover:text-black">Community forum</a></li>
                <li><a href="#" className="underline hover:text-black">Hosting responsibly</a></li>
                <li><a href="#" className="underline hover:text-black">Find a co-host</a></li>
              </ul>
            </div>

            {/* Column 3: Homyz */}
            <div className="space-y-3">
              <h3 className="font-['Poppins'] text-base font-semibold text-[#1F1F1F] tracking-wide">
                Homyz
              </h3>
              <ul className="space-y-2.5 font-['Poppins'] text-sm font-normal text-[#1F1F1F]">
                <li><a href="#" className="underline hover:text-black">2025 Summer Release</a></li>
                <li><a href="#" className="underline hover:text-black">Newsroom</a></li>
                <li><a href="#" className="underline hover:text-black">Careers</a></li>
                <li><a href="#" className="underline hover:text-black">Investors</a></li>
                <li><a href="#" className="underline hover:text-black">Gift cards</a></li>
                <li><a href="#" className="underline hover:text-black">Homyz.com emergency stays</a></li>
              </ul>
            </div>

            {/* Desktop Scroll to Top Button (hidden on mobile) */}
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="hidden md:flex absolute right-0 top-0 w-8 h-8 rounded-full bg-[#FCDF9C] hover:bg-[#f5d687] text-[#1F1F1F] items-center justify-center transition-all cursor-pointer shadow-xs"
              title="Scroll to top"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>

          {/* Separator Line */}
          <div className="w-full max-w-[200px] md:max-w-none h-[1px] bg-[#E5E5E5]" />

          {/* Social Icons row */}
          <div className="flex items-center gap-5 text-[#1F1F1F]">
            <a href="#" aria-label="Facebook" className="hover:opacity-75">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            </a>
            <a href="#" aria-label="Twitter" className="hover:opacity-75">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.936 9.936 0 0024 4.59z" /></svg>
            </a>
            <a href="#" aria-label="Instagram" className="hover:opacity-75">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
            </a>
          </div>

          {/* Bottom Copyright Row */}
          <div className="font-['Poppins'] text-sm font-normal text-[#1F1F1F]">
            © 2026 Homyz, Inc.
          </div>
        </Container>
      </footer>
    </div>
  );
}
