"use client";

import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui/container";
import { useLanguage } from "@/lib/i18n/language-context";

export function CoHostClient() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1F1F1F]">
      <AppHeader />
      <main className="flex-1 py-10 sm:py-16">
        <Container>
          <div className="mx-auto max-w-3xl space-y-8 text-center">
            <div className="inline-flex size-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
              🗝️
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1F1F1F]">
                {t("host_cohost_hero_title", "Find an Experienced Co-Host")}
              </h1>
              <p className="text-sm sm:text-base text-zinc-600 max-w-md mx-auto">
                {t("host_cohost_hero_desc", "Connect with top-rated local hosts in your city who can help manage guest messaging, check-ins, cleaning, and maintenance.")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 space-y-2">
                <span className="text-2xl" aria-hidden="true">💬</span>
                <h3 className="text-sm font-semibold text-[#1F1F1F]">
                  {t("host_cohost_feature_comm_title", "Guest Communication")}
                </h3>
                <p className="text-xs text-[#727272]">
                  {t("host_cohost_feature_comm_desc", "24/7 guest support, check-in coordination, and inquiry responses.")}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 space-y-2">
                <span className="text-2xl" aria-hidden="true">🧹</span>
                <h3 className="text-sm font-semibold text-[#1F1F1F]">
                  {t("host_cohost_feature_clean_title", "Cleaning & Staging")}
                </h3>
                <p className="text-xs text-[#727272]">
                  {t("host_cohost_feature_clean_desc", "Turnovers, professional cleaning management, and restocking amenities.")}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 space-y-2">
                <span className="text-2xl" aria-hidden="true">📈</span>
                <h3 className="text-sm font-semibold text-[#1F1F1F]">
                  {t("host_cohost_feature_price_title", "Dynamic Pricing")}
                </h3>
                <p className="text-xs text-[#727272]">
                  {t("host_cohost_feature_price_desc", "Local rate optimization to maximize occupancy and revenue.")}
                </p>
              </div>
            </div>

            <div>
              <Link
                href="/host/listings"
                className="inline-flex rounded-full bg-[#1F1F1F] text-white px-8 py-3.5 text-sm font-semibold hover:bg-zinc-800 transition-colors"
              >
                {t("host_cohost_btn_manage_listings", "Manage Your Listings")}
              </Link>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
