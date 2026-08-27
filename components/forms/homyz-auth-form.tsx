"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { useState, useTransition, type FormEvent } from "react";
import { Alert } from "../ui";
import { registerAction } from "@/actions/auth/register";

export interface HomyzAuthFormProps {
  initialMode?: "login" | "signup";
  callbackUrl?: string;
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
  providers = {},
}: HomyzAuthFormProps) {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"login" | "signup">(initialMode);
  const [inputMethod, setInputMethod] = useState<"email" | "phone">("email");
  const [showPassword, setShowPassword] = useState(false);

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

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (authMode === "signup") {
      startTransition(async () => {
        const res = await registerAction({
          name: name.trim() || undefined,
          email: email.trim(),
          password,
          role,
        });

        if (!res.ok) {
          setError(res.error);
          return;
        }

        // Automatic sign in upon registration
        const loginRes = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (!loginRes || loginRes.error) {
          setSuccess("Account created! Please sign in with your credentials.");
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
        email: email.trim(),
        password,
        redirect: false,
      });

      if (!res || res.error) {
        setError(res?.error ?? "Invalid credentials. Please check your email and password.");
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
          setOtpMessage(`Verification code sent to ${fullPhone}. In dev, check server logs!`);
        } catch {
          setError("Network error sending code. Please try again.");
        }
      });
    } else {
      // Verify OTP
      startTransition(async () => {
        try {
          const res = await fetch("/api/v1/auth/otp/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              identifier: fullPhone,
              code: otpCode.trim(),
              purpose: "LOGIN",
            }),
          });
          const data = await res.json();
          if (!data.success) {
            setError(data.error?.message || "Invalid or expired code.");
            return;
          }
          setSuccess("Phone verified! Sign in with your password to complete login.");
          setInputMethod("email");
          setOtpSent(false);
        } catch {
          setError("Verification failed. Please try again.");
        }
      });
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto py-8 sm:py-12 px-4 sm:px-6 bg-white text-zinc-900">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* Left Column: Form Area */}
        <div className="w-full max-w-md mx-auto lg:mx-0 flex flex-col">
          {/* Back button */}
          <div className="mb-4">
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
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 hover:border-zinc-400 text-zinc-700 bg-white hover:bg-zinc-50 transition-colors"
              aria-label="Go back"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {/* Heading and Subtitle */}
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
            Log in or sign up
          </h1>

          <div className="mt-2 mb-6 text-sm text-zinc-600 flex items-center gap-1.5">
            {authMode === "login" ? (
              <>
                <span>Don&apos;t have an account?</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setError(null);
                  }}
                  className="font-semibold text-zinc-900 underline hover:text-amber-800"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                <span>Already have an account?</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setError(null);
                  }}
                  className="font-semibold text-zinc-900 underline hover:text-amber-800"
                >
                  Log in
                </button>
              </>
            )}
          </div>

          {/* Mobile Image: Shown above form on small screens like reference screenshot */}
          <div className="block lg:hidden mb-6 rounded-2xl overflow-hidden shadow-xs border border-zinc-200">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={inputMethod === "email" ? "/images/auth-traveler-street.jpg" : "/images/auth-traveler-water.jpg"}
                alt="Traveler with backpack"
                fill
                priority
                className="object-cover"
              />
            </div>
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
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
              {authMode === "signup" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-800">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-800"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-800">
                      Account Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole("USER")}
                        className={`rounded-xl border py-2.5 text-xs font-semibold transition-all ${
                          role === "USER"
                            ? "border-amber-400 bg-amber-50 text-amber-900"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        Guest (User)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole("HOST")}
                        className={`rounded-xl border py-2.5 text-xs font-semibold transition-all ${
                          role === "HOST"
                            ? "border-amber-400 bg-amber-50 text-amber-900"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        Host Properties
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Email Address */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-800">
                  Email address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="emailexample@gmail.com"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors focus:border-zinc-900"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-800">
                    Password *
                  </label>
                  {authMode === "login" && (
                    <Link
                      href="/forgot-password"
                      className="text-xs text-zinc-500 hover:text-zinc-900"
                    >
                      Forget password? <span className="underline">reset password</span>
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
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

              {/* Primary Continue Button */}
              <button
                type="submit"
                disabled={pending}
                className="mt-2 w-full rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] py-3.5 text-sm font-semibold text-zinc-900 transition-colors shadow-2xs disabled:opacity-50"
              >
                {pending ? "Please wait..." : "Continue"}
              </button>
            </form>
          ) : (
            /* Input Method 2: Phone Form */
            <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4">
              {!otpSent ? (
                <>
                  {/* Country Code */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-800">
                      Country code *
                    </label>
                    <div className="relative">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-zinc-300 bg-white px-4 py-3 pr-10 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-900"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-800">
                      Phone number *
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="XXXX-XXX-XX-XXX"
                      required
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors focus:border-zinc-900"
                    />
                  </div>

                  <p className="text-xs text-zinc-500 leading-relaxed">
                    We&apos;ll call or text you to confirm your number. Standard message and data rates apply.{" "}
                    <a href="#" className="underline text-zinc-800 font-medium">Privacy Policy</a>
                  </p>

                  <button
                    type="submit"
                    disabled={pending}
                    className="mt-2 w-full rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] py-3.5 text-sm font-semibold text-zinc-900 transition-colors shadow-2xs disabled:opacity-50"
                  >
                    {pending ? "Sending code..." : "Continue"}
                  </button>
                </>
              ) : (
                /* OTP Verification Step */
                <>
                  {otpMessage && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                      {otpMessage}
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-800">
                      Enter 6-digit Verification Code *
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      required
                      className="w-full text-center tracking-widest text-lg font-mono rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-zinc-900"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={pending || otpCode.length < 6}
                    className="mt-2 w-full rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] py-3.5 text-sm font-semibold text-zinc-900 transition-colors shadow-2xs disabled:opacity-50"
                  >
                    {pending ? "Verifying..." : "Verify & Continue"}
                  </button>
                </>
              )}
            </form>
          )}

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200" />
            <span className="text-xs text-zinc-400 lowercase tracking-wider">
              or
            </span>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          {/* Social login buttons: Google, Apple, Facebook */}
          <div className="grid grid-cols-3 gap-3">
            {/* Google */}
            {(providers.google ?? true) && (
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl })}
                className="flex items-center justify-center gap-2 rounded-full border border-[#D5D8FA] bg-[#E8EAFE] hover:bg-[#DDE0FC] py-3 px-3 transition-colors text-zinc-900 font-medium text-xs shadow-2xs"
                title="Continue with Google"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="hidden sm:inline">Google</span>
              </button>
            )}

            {/* Apple */}
            {(providers.apple ?? true) && (
              <button
                type="button"
                onClick={() => signIn("apple", { callbackUrl })}
                className="flex items-center justify-center gap-2 rounded-full border border-[#D5D8FA] bg-[#E8EAFE] hover:bg-[#DDE0FC] py-3 px-3 transition-colors text-zinc-900 font-medium text-xs shadow-2xs"
                title="Continue with Apple"
              >
                <svg className="h-4 w-4 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.58.67-.99 1.74-.88 2.76 1.02.08 2.01-.51 2.61-1.26z" />
                </svg>
                <span className="hidden sm:inline">Apple</span>
              </button>
            )}

            {/* Facebook */}
            {(providers.facebook ?? true) && (
              <button
                type="button"
                onClick={() => signIn("facebook", { callbackUrl })}
                className="flex items-center justify-center gap-2 rounded-full border border-[#D5D8FA] bg-[#E8EAFE] hover:bg-[#DDE0FC] py-3 px-3 transition-colors text-zinc-900 font-medium text-xs shadow-2xs"
                title="Continue with Facebook"
              >
                <svg className="h-4 w-4 fill-[#1877F2] shrink-0" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <span className="hidden sm:inline">Facebook</span>
              </button>
            )}
          </div>

          {/* Toggle between Email / Phone */}
          <div className="mt-4">
            {inputMethod === "email" ? (
              <button
                type="button"
                onClick={() => {
                  setInputMethod("phone");
                  setError(null);
                }}
                className="w-full rounded-full border border-zinc-900 hover:bg-zinc-50 py-3 text-xs font-semibold text-zinc-900 transition-colors"
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
                className="w-full rounded-full border border-zinc-900 hover:bg-zinc-50 py-3 text-xs font-semibold text-zinc-900 transition-colors"
              >
                Continue with email
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Hero Photo on Desktop */}
        <div className="hidden lg:block">
          <div className="relative aspect-[4/5] w-full max-w-[520px] rounded-3xl overflow-hidden shadow-xs border border-zinc-200">
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
    </div>
  );
}
