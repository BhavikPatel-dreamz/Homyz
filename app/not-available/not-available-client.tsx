"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui/container";
import { useLanguage, type TranslationKey } from "@/lib/i18n/language-context";

const SLUG_TO_KEY: Record<string, TranslationKey> = {
  "safety-issue": "footer_link_safety_issue",
  "disability-support": "footer_link_disability_support",
  "cancellation-options": "footer_link_cancellation_options",
  "report-neighborhood": "footer_link_report_neighborhood",
  "experience": "footer_link_homyz_experience",
  "service": "footer_link_homyz_service",
  "hosting-resources": "footer_link_hosting_resources",
  "community-forum": "footer_link_community_forum",
  "hosting-responsibly": "footer_link_hosting_responsibly",
  "summer-release": "footer_link_summer_release",
  "newsroom": "footer_link_newsroom",
  "careers": "footer_link_careers",
  "investors": "footer_link_investors",
  "emergency-stays": "footer_link_emergency_stays",
  "privacy": "footer_link_privacy",
  "terms": "footer_link_terms",
  "sitemap": "footer_link_sitemap",
};

export function NotAvailableClient() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  const pageSlug = searchParams?.get("page") ?? "";
  const queryTitle = searchParams?.get("title") ?? "";

  let resolvedTitle = "";
  if (pageSlug && SLUG_TO_KEY[pageSlug]) {
    resolvedTitle = t(SLUG_TO_KEY[pageSlug]);
  } else if (queryTitle) {
    resolvedTitle = queryTitle;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1F1F1F]">
      <AppHeader />
      <main className="flex-1 py-12 sm:py-20">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            {/* Badge / Icon */}
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#FCDF9C]/40 border border-[#D8B86F]/50 text-[#1F1F1F] shadow-xs">
              <svg
                aria-hidden="true"
                className="h-10 w-10 text-[#1F1F1F]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1 text-xs font-medium text-amber-900 mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              {t("page_not_available_badge", "Under Development")}
            </div>

            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#1F1F1F]">
              {t("page_not_available_title", "Currently this page is not available")}
            </h1>

            {resolvedTitle && (
              <p className="mt-3 inline-block rounded-xl bg-zinc-100 px-4 py-1.5 text-xs sm:text-sm font-medium text-zinc-700">
                <span className="text-zinc-500">{t("page_not_available_requested_page", "Requested Page")}:</span>{" "}
                <strong className="text-[#1F1F1F]">{resolvedTitle}</strong>
              </p>
            )}

            <p className="mt-4 text-sm sm:text-base text-zinc-600 max-w-lg mx-auto leading-relaxed">
              {t(
                "page_not_available_desc",
                "We are working on bringing this page to you soon. Please check back later."
              )}
            </p>

            {/* Quick Actions */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/"
                className="rounded-full bg-[#1F1F1F] px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors shadow-2xs"
              >
                {t("page_not_available_back_home", "Back to Home")}
              </Link>
              <Link
                href="/listings"
                className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-[#1F1F1F] hover:bg-zinc-50 transition-colors shadow-2xs"
              >
                {t("page_not_available_explore_stays", "Explore Stays")}
              </Link>
              <Link
                href="/help"
                className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-[#1F1F1F] hover:bg-zinc-50 transition-colors shadow-2xs"
              >
                {t("page_not_available_help_center", "Help Centre")}
              </Link>
            </div>

            {/* Help & Links Cards */}
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <Link
                href="/listings"
                className="group rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 hover:bg-zinc-100/70 hover:border-zinc-300 transition-all shadow-2xs"
              >
                <span className="text-2xl" aria-hidden="true">🏠</span>
                <h2 className="mt-3 text-sm font-semibold text-[#1F1F1F] group-hover:text-[#D8B86F] transition-colors">
                  {t("page_not_available_explore_stays", "Explore Stays")}
                </h2>
                <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                  {t("page_not_available_explore_stays_desc", "Browse verified homes, villas, and apartments.")}
                </p>
              </Link>

              <Link
                href="/help"
                className="group rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 hover:bg-zinc-100/70 hover:border-zinc-300 transition-all shadow-2xs"
              >
                <span className="text-2xl" aria-hidden="true">💬</span>
                <h2 className="mt-3 text-sm font-semibold text-[#1F1F1F] group-hover:text-[#D8B86F] transition-colors">
                  {t("page_not_available_help_center", "Help Centre")}
                </h2>
                <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                  {t("page_not_available_help_center_desc", "Find answers to questions and get 24/7 support.")}
                </p>
              </Link>

              <Link
                href="/become-a-host"
                className="group rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 hover:bg-zinc-100/70 hover:border-zinc-300 transition-all shadow-2xs"
              >
                <span className="text-2xl" aria-hidden="true">✨</span>
                <h2 className="mt-3 text-sm font-semibold text-[#1F1F1F] group-hover:text-[#D8B86F] transition-colors">
                  {t("page_not_available_become_host", "Become a Host")}
                </h2>
                <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                  {t("page_not_available_become_host_desc", "Start earning by sharing your space on Homyz.")}
                </p>
              </Link>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
