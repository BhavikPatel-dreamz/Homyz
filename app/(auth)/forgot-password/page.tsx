import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import { AuthHeroImage } from "@/components/auth/auth-hero-image";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";

export const metadata = {
  title: "Forgot Password | Homyz Enterprise Console",
  description: "Request a password reset link for your Homyz account.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="account-page flex min-h-screen w-full flex-col overflow-x-hidden bg-white font-sans text-[#1F1F1F] selection:bg-amber-100">
      <AppHeader />

      <main className="flex w-full flex-1 items-start justify-center px-4 py-6 sm:px-6 sm:py-8 lg:items-center lg:px-8 lg:py-14">
        <div className="mx-auto flex w-full max-w-[1318px] flex-col items-center justify-between gap-8 lg:flex-row lg:gap-8 xl:gap-[56px]">
          <div className="mx-auto flex w-full max-w-[538px] flex-col lg:mx-0 lg:w-1/2 lg:max-w-none xl:w-[643px]">
            <div className="mb-2 flex flex-col gap-6 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full border border-[#727272] bg-[#F3F4F5] text-[#1F1F1F] transition-colors hover:bg-zinc-200 sm:self-auto"
                aria-label="Go back to login"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </Link>
              <h1 className="wrap-break-words">Forgot password?</h1>
            </div>

            <p className="mb-2 pl-0 font-['Poppins'] text-[15px] font-normal leading-relaxed text-[#727272] sm:mb-4 sm:pl-13.5 sm:text-[17px] lg:mb-6 lg:text-[18px]">
              Enter your account&apos;s email address and we&apos;ll send you a link to reset your password.
            </p>

            <AuthHeroImage mobile />

            <div className="flex w-full max-w-[538px] flex-col pl-0 lg:pl-13.5">
              <ForgotPasswordForm />
            </div>
          </div>

          <AuthHeroImage />
        </div>
      </main>
    </div>
  );
}
