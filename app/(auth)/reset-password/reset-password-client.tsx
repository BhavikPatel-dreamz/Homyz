"use client";

import Link from "next/link";
import Image from "next/image";
import { AppHeader } from "@/components/dashboard/app-header";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { useLanguage } from "@/lib/i18n/language-context";

export function ResetPasswordClient({ token }: { token: string }) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen w-full bg-white text-[#1F1F1F] font-sans flex flex-col selection:bg-amber-100">
      <AppHeader />

      <main className="flex-1 w-full max-w-6xl mx-auto py-8 sm:py-12 px-4 sm:px-6 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left Column: Form */}
          <div className="w-full max-w-md mx-auto lg:mx-0 flex flex-col justify-center">
            {/* Heading */}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 mb-2">
              {t("auth_reset_title")}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 mb-6 leading-relaxed">
              {t("auth_reset_subtitle")}
            </p>

            <ResetPasswordForm token={token} />
          </div>

          {/* Right Column: Hero Photo on Desktop */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="relative aspect-[4/5] w-full max-w-[520px] rounded-3xl overflow-hidden shadow-xs border border-zinc-200">
              <Image
                src="/images/auth-traveler-street.jpg"
                alt="Homyz Traveler"
                fill
                priority
                sizes="(min-width: 1024px) 500px, 100vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-8 text-white">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-300 mb-1">
                  Account Protection
                </span>
                <h2 className="text-xl font-semibold">
                  Enhanced Credential Encryption
                </h2>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
