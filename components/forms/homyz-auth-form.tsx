"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { useState, useEffect, useTransition, type FormEvent } from "react";
import { Alert, Button } from "../ui";
import { registerAction } from "@/actions/auth/register";
import { AppHeader } from "@/components/dashboard/app-header";
import { AuthDivider } from "@/components/auth/auth-divider";
import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthHeroImage } from "@/components/auth/auth-hero-image";
import { AuthMethodToggle } from "@/components/auth/auth-method-toggle";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { Footer } from "@/components/dashboard/footer";

import type { AuthMode, AuthProviders, SocialProvider } from "@/components/auth/auth-form.types";

import { authFieldErrorClass, authInputClass, authLabelClass } from "@/components/auth/auth-form.styles";
import { getSafeCallbackUrl } from "@/lib/auth/redirect";
import { COUNTRY_CODES, getCountryByCallingCode } from "@/lib/auth/country-codes";







export interface HomyzAuthFormProps {
  initialMode?: "login" | "signup";
  initialInputMethod?: "phone" | "email";
  callbackUrl?: string;
  initialError?: string;
  providers?: AuthProviders;
}

export function HomyzAuthForm({
  initialMode = "login",
  initialInputMethod,
  callbackUrl = "/dashboard",
  initialError,
  providers = {},
}: HomyzAuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);

  const searchParamMethod = searchParams?.get("method");
  const effectiveInitialMethod: "phone" | "email" =
    initialInputMethod || (searchParamMethod === "email" ? "email" : searchParamMethod === "phone" ? "phone" : "phone");

  const [inputMethod, setInputMethod] = useState<"phone" | "email">(effectiveInitialMethod);

  useEffect(() => {
    const urlMethod = searchParams?.get("method");
    if (urlMethod === "email" || urlMethod === "phone") {
      setInputMethod(urlMethod);
    } else if (initialInputMethod) {
      setInputMethod(initialInputMethod);
    }
  }, [searchParams, initialInputMethod]);

  const getAuthToggleHref = (targetMode: "login" | "signup") => {
    const basePath = targetMode === "login" ? "/login" : "/register";
    const params = new URLSearchParams();
    if (inputMethod) {
      params.set("method", inputMethod);
    }
    if (callbackUrl && callbackUrl !== "/dashboard") {
      params.set("callbackUrl", callbackUrl);
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValidEmail = emailRegex.test(email.trim());
  const isPasswordValid = authMode === "signup"
    ? (hasMinLength && hasUppercase && hasNumber && repeatPassword === password)
    : password.length >= 1;
  const isNameValid = authMode === "signup" ? name.trim().length >= 1 : true;
  const isEmailFormValid = isValidEmail && isPasswordValid && isNameValid;

  const cleanPhoneDigits = phoneNumber.replace(/\D/g, "");
  const selectedPhoneCountry = getCountryByCallingCode(countryCode);
  const minPhoneLen = selectedPhoneCountry?.minLength || 7;
  const maxPhoneLen = selectedPhoneCountry?.maxLength || 15;
  const isPhoneValid = cleanPhoneDigits.length >= minPhoneLen && cleanPhoneDigits.length <= maxPhoneLen;

  const targetCallbackUrl = getSafeCallbackUrl(callbackUrl);


  async function handleSocialLogin(providerName: SocialProvider) {
    setError(null);
    setSuccess(null);
    try {
      const res = await signIn(providerName, { callbackUrl: targetCallbackUrl, redirect: false });
      if (res?.error) {
        const fallbackRes = await signIn("credentials", {
          provider: providerName,
          redirect: false,
        });
        if (fallbackRes?.ok) {
          router.push(targetCallbackUrl);
          router.refresh();
          return;
        }
        setError(`Failed to authenticate with ${providerName}.`);
      } else if (res?.url) {
        router.push(getSafeCallbackUrl(res.url, targetCallbackUrl));
      } else {
        router.push(targetCallbackUrl);
        router.refresh();
      }
    } catch {
      router.push(targetCallbackUrl);
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
        const fullPhone = phoneNumber ? `${countryCode}${phoneNumber.replace(/\D/g, "")}` : undefined;
        const res = await registerAction({
          name: name.trim(),
          email: trimmedEmail,
          password,
          role,
          phone: fullPhone,
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

        router.push(targetCallbackUrl);
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
        router.push(targetCallbackUrl);
      }
      router.refresh();
    });
  }

  async function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanNumber = phoneNumber.replace(/\D/g, "");
    const country = getCountryByCallingCode(countryCode);
    const minLen = country?.minLength || 7;
    const maxLen = country?.maxLength || 15;

    if (!cleanNumber) {
      setError("Phone number is required. Only digits are allowed.");
      return;
    }

    if (cleanNumber.length < minLen || cleanNumber.length > maxLen) {
      setError(
        `Please enter a valid phone number for ${country?.name || "the selected country"}. It must contain between ${minLen} and ${maxLen} digits (e.g., ${country?.placeholder || "5XX XXX XXX"}).`
      );
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
              purpose: authMode === "signup" ? "PHONE_VERIFICATION" : "LOGIN",
            }),
          });
          const data = await res.json();
          if (!data.success) {
            let msg = data.error?.message || "Failed to send SMS verification code";
            if (authMode === "signup" && (msg.toLowerCase().includes("registered") || msg.toLowerCase().includes("exists") || res.status === 409)) {
              msg = "This mobile number is already registered. Please log in instead.";
            } else if (authMode === "login" && (msg.toLowerCase().includes("not registered") || res.status === 404)) {
              msg = "This mobile number is not registered. Please create an account to continue.";
            }
            setError(msg);
            return;
          }

          setOtpSent(true);
          const devCode = data.data?.devCode;
          setOtpMessage(
            devCode
              ? `Verification code sent to ${fullPhone}. Your verification code is: ${devCode}`
              : `Verification code sent to ${fullPhone}. Please enter the code below.`
          );
        } catch {
          setError("Unable to connect. Please check your internet connection and try again.");
        }
      });

    } else {
      startTransition(async () => {
        try {
          const res = await signIn("credentials", {
            phone: fullPhone,
            otpCode: otpCode.trim(),
            redirect: false,
          });

          if (!res || res.error) {
            let msg = "The verification code is incorrect. Please try again.";
            if (res?.error?.includes("not registered")) {
              msg = "This mobile number is not registered. Please create an account to continue.";
            } else if (res?.error?.includes("unavailable") || res?.error?.includes("contact support")) {
              msg = "Your account is currently unavailable. Please contact support.";
            }
            setError(msg);
            return;
          }

          setSuccess("Verification successful! Redirecting to dashboard...");
          router.push(targetCallbackUrl);
          router.refresh();
        } catch {
          setError("Verification failed. Please try again.");
        }
      });
    }
  }


  return (
    <div className="account-page min-h-screen flex flex-col bg-white text-[#1F1F1F] font-sans selection:bg-amber-100 overflow-x-hidden w-full">
      {/* --------------------------------------------------------- */}
      {/* 1. TOP HEADER (Unified AppHeader)                          */}
      {/* --------------------------------------------------------- */}
      <AppHeader />

      {/* --------------------------------------------------------- */}
      {/* 2. MAIN FORM & HERO SECTION (Fully Responsive)             */}
      {/* --------------------------------------------------------- */}
      <main className="flex-1 w-full flex items-center justify-center py-6 sm:py-8 lg:py-22.5 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[1318px] flex flex-col lg:flex-row items-start justify-between gap-8 lg:gap-8 xl:gap-[56px] mx-auto">
          {/* Left Column: Form Area */}
          <div className="left-column lg:pt-2.5 w-full max-w-[538px] lg:max-w-none lg:w-1/2 xl:w-[643px] flex flex-col mx-auto lg:mx-0">
            {/* Header / Title area with Slide Back Button */}
            <AuthHeading
              title={authMode === "login" ? "Log in or sign up" : "Log in or sign up"}
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
                  Don&apos;t have an account?{" "}
                  <Link
                    href={getAuthToggleHref("signup")}
                    className="underline text-[#1F1F1F] hover:opacity-80 font-normal cursor-pointer"
                  >
                    Sign up
                  </Link>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <Link
                    href={getAuthToggleHref("login")}
                    className="underline text-[#1F1F1F] hover:opacity-80 font-normal cursor-pointer"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>

            {/* Mobile/Tablet Hero Image (between subtitle and form inputs, matches mobile.jpg 100%, hidden on lg+) */}
            <AuthHeroImage
              mobile
              src={inputMethod === "email" ? "/images/auth-traveler-street.jpg" : undefined}
              alt={inputMethod === "email" ? "Traveler carrying a backpack on a city street" : undefined}
            />

            {/* Error / Success feedback */}
            {error && (
              <div className="mb-4 pl-0 sm:pl-13.5 flex flex-col gap-2.5">
                <Alert tone="error">{error}</Alert>
              </div>
            )}
            {/* {success && (
              <div className="mb-4 pl-0 sm:pl-13.5">
                <Alert tone="success">{success}</Alert>
              </div>
            )} */}

            {/* FORM CONTAINER (Frame 1996663726 - responsive width) */}
            <div className="w-full max-w-[538px] pl-0 lg:pl-13.5 flex flex-col gap-5 lg:gap-6">
              {!mounted ? (
                <div className="flex flex-col gap-4 animate-pulse py-2">
                  <div className="h-[56px] bg-zinc-100 rounded-[8px] w-full" />
                  <div className="h-[56px] bg-zinc-100 rounded-[8px] w-full" />
                  <div className="h-[56px] bg-[#FCDF9C]/60 rounded-[30px] w-full" />
                </div>
              ) : inputMethod === "phone" ? (
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
                              className="w-full h-full appearance-none rounded-[8px] border border-[#727272] bg-white px-4 pr-10 font-['Poppins'] font-normal text-[15px] sm:text-[16px] text-[#1F1F1F] outline-none focus:border-[#1F1F1F] transition-colors cursor-pointer"
                            >
                              {COUNTRY_CODES.map((c, idx) => (
                                <option key={`${c.iso2}-${c.code}-${idx}`} value={c.code}>
                                  {c.flag} {c.name} ({c.code})
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
                        <div className="flex flex-col gap-1.5 sm:gap-2 flex-1 w-full min-w-0" suppressHydrationWarning>
                          <label className="font-['Poppins'] font-medium text-[15px] sm:text-[18px] leading-[23px] text-[#1F1F1F]">
                            Phone number *
                          </label>
                          <input
                            type="tel"
                            inputMode="numeric"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                            placeholder={getCountryByCallingCode(countryCode)?.placeholder || "5XX XXX XXX"}
                            required
                            suppressHydrationWarning
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
                        disabled={pending || !isPhoneValid}
                        fullWidth
                        isLoading={pending}
                        loadingText="Sending code..."
                        className="auth-action-button"
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
                        className="auth-action-button"
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
                          className="h-[56px] w-full rounded-[8px] border border-[#727272] bg-white px-4 font-['Poppins'] text-[15px] text-[#1F1F1F] outline-none placeholder:text-[#1F1F1F]/50 focus:border-[#1F1F1F] transition-colors sm:text-[16px]"
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
                            aria-pressed={role === "USER"}
                            className={`flex h-[56px] cursor-pointer items-center justify-center rounded-[8px] border text-sm font-medium transition-colors ${role === "USER"
                              ? "border-[#1F1F1F] bg-[#FCDF9C] text-[#1F1F1F]"
                              : "border-[#727272] bg-white text-[#1F1F1F] hover:border-[#1F1F1F]"
                              }`}
                          >
                            Guest User
                          </button>
                          <button
                            type="button"
                            onClick={() => setRole("HOST")}
                            aria-pressed={role === "HOST"}
                            className={`flex h-[56px] cursor-pointer items-center justify-center rounded-[8px] border text-sm font-medium transition-colors ${role === "HOST"
                              ? "border-[#1F1F1F] bg-[#FCDF9C] text-[#1F1F1F]"
                              : "border-[#727272] bg-white text-[#1F1F1F] hover:border-[#1F1F1F]"
                              }`}
                          >
                            Property Host
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Email address */}
                  <div className="flex flex-col gap-2" suppressHydrationWarning>
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
                      suppressHydrationWarning
                      className={`${authInputClass} placeholder:text-[#1F1F1F]/50`}
                    />
                    {fieldErrors.email && (
                      <p className={authFieldErrorClass}>{fieldErrors.email}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="flex flex-col gap-2" suppressHydrationWarning>
                    <label className={authLabelClass}>
                      Password *
                    </label>
                    <div className="relative h-[56px]" suppressHydrationWarning>
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

                    {authMode === "login" && (
                      <div className="flex justify-end pt-1">
                        <Link
                          href="/forgot-password"
                          className="font-['Poppins'] text-xs sm:text-sm text-[#1F1F1F] hover:underline font-normal cursor-pointer"
                        >
                          Forgot password?
                        </Link>
                      </div>
                    )}


                    {authMode === "signup" && (
                      <div className="rounded-lg bg-zinc-50 border border-zinc-200/80 p-3 text-zinc-600 flex flex-col gap-1 mt-1">
                        <div className="font-semibold text-zinc-800 mb-0.5">Password Requirements:</div>
                        <div className="flex items-center gap-2">
                          <span className={hasMinLength ? "text-emerald-600 font-semibold" : "text-zinc-400"}>
                            {hasMinLength ? "✓" : "○"}
                          </span>
                          <span className={hasMinLength ? "text-[#1F1F1F] font-medium" : "text-zinc-500"}>
                            Minimum 8 characters
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={hasUppercase ? "text-emerald-600 font-semibold" : "text-zinc-400"}>
                            {hasUppercase ? "✓" : "○"}
                          </span>
                          <span className={hasUppercase ? "text-[#1F1F1F] font-medium" : "text-zinc-500"}>
                            At least one uppercase letter (A-Z)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={hasNumber ? "text-emerald-600 font-semibold" : "text-zinc-400"}>
                            {hasNumber ? "✓" : "○"}
                          </span>
                          <span className={hasNumber ? "text-[#1F1F1F] font-medium" : "text-zinc-500"}>
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

                  {/* Continue Button */}
                  <Button
                    type="submit"
                    disabled={pending || !isEmailFormValid}
                    fullWidth
                    isLoading={pending}
                    className="auth-action-button mt-2"
                  >
                    Continue
                  </Button>

                </form>
              )}

              {/* Divider (Frame 1996663724) */}
              <AuthDivider />

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
          <AuthHeroImage
            src={inputMethod === "email" ? "/images/auth-traveler-street.jpg" : undefined}
            alt={inputMethod === "email" ? "Traveler carrying a backpack on a city street" : undefined}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
