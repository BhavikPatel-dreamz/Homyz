import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";
import { AppHeader } from "@/components/dashboard/app-header";
import { HomyzLogo } from "@/components/ui/homyz-logo";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";

export const metadata = {
  title: "Forgot Password | Homyz Enterprise Console",
  description: "Request a password reset link for your Homyz account.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 font-sans selection:bg-amber-100">
      {/* Top Header matching login / auth pages */}
      <AppHeader />

      {/* Main Container */}
      <Container as="main" className="flex-1 py-10 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Left Column: Form */}
          <div className="lg:col-span-6 xl:col-span-5 w-full max-w-md mx-auto lg:mx-0 flex flex-col">
            {/* Homyz Brand Logo (Identical to AppHeader logo) */}
            <Link href="/" className="mb-6 flex items-center gap-2 group w-fit">
              <HomyzLogo className="text-zinc-950 group-hover:scale-105 transition-transform shrink-0" size={32} />
              <span className="text-2xl font-extrabold tracking-tight text-zinc-900">
                homyz
              </span>
            </Link>

            {/* Back Button + Heading */}
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/login"
                className="w-7 h-7 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-500 hover:bg-zinc-100 text-sm transition-all cursor-pointer shadow-2xs shrink-0"
                aria-label="Go back to login"
              >
                ‹
              </Link>
              <h1>
                Forgot password?
              </h1>
            </div>
            <p className="text-xs text-zinc-500 mb-6 leading-relaxed pl-10">
              Enter your account&apos;s email address below and we&apos;ll send you a link to reset your password.
            </p>

            <ForgotPasswordForm />
          </div>

          {/* Right Column: Hero Photo */}
          <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 items-center justify-center">
            <div className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden shadow-xs border border-zinc-200">
              <Image
                src="/images/auth-traveler-street.jpg"
                alt="Homyz Traveler"
                fill
                priority
                sizes="(min-width: 1024px) 600px, 100vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-8 text-white">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-300 mb-1">
                  Account Security
                </span>
                <h2 className="text-xl font-bold">
                  Fast &amp; Secure Password Recovery
                </h2>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
