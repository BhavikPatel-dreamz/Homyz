"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui/container";
import type { StaticPagePayload } from "@/lib/cms/content-types";

interface StaticPageClientProps {
  slug: string;
  title: string;
  payload: StaticPagePayload;
  publishedAt?: string;
  isPreview?: boolean;
}

export function StaticPageClient({
  slug,
  title,
  payload,
  publishedAt,
  isPreview,
}: StaticPageClientProps) {
  const [activeSection, setActiveSection] = useState<string>(
    payload.sections[0]?.id || "section-0"
  );
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});

  const toggleAccordion = (id: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -90;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1F1F1F]">
      <AppHeader />

      {isPreview && (
        <div className="bg-amber-500 text-white text-xs font-semibold py-2 px-4 text-center tracking-wide">
          PREVIEW MODE — Viewing unpublished draft revision for /{slug}
        </div>
      )}

      {/* Hero Header */}
      <section className="border-b border-zinc-200 bg-[#F9FAFB] py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-4xl space-y-4">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs text-zinc-500">
              <Link href="/" className="hover:text-zinc-900 transition">
                Home
              </Link>
              <span>/</span>
              <span className="text-zinc-900 font-medium">
                {payload.heroTitle || title}
              </span>
            </nav>

            {payload.badge && (
              <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-[#FCDF9C] text-[#291E05] rounded-full">
                {payload.badge}
              </span>
            )}

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-900">
              {payload.heroTitle || title}
            </h1>

            {payload.heroSubtitle && (
              <p className="text-base sm:text-lg text-zinc-600 leading-relaxed max-w-2xl">
                {payload.heroSubtitle}
              </p>
            )}

            {(payload.lastUpdated || publishedAt) && (
              <div className="pt-2 text-xs text-zinc-400">
                Last updated: {payload.lastUpdated || (publishedAt ? new Date(publishedAt).toLocaleDateString() : "Recently")}
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Sticky Navigation / Table of Contents (Desktop) */}
            {payload.sections.length > 1 && (
              <aside className="hidden lg:block lg:col-span-4">
                <div className="sticky top-24 space-y-4 p-5 rounded-2xl bg-zinc-50 border border-zinc-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    On this page
                  </h3>
                  <ul className="space-y-1.5 text-sm">
                    {payload.sections.map((section, idx) => {
                      const sectionId = section.id || `section-${idx}`;
                      const isActive = activeSection === sectionId;
                      return (
                        <li key={sectionId}>
                          <button
                            type="button"
                            onClick={() => scrollToSection(sectionId)}
                            className={`w-full text-left px-3 py-2 rounded-xl transition text-xs font-medium ${
                              isActive
                                ? "bg-zinc-900 text-white font-semibold"
                                : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
                            }`}
                          >
                            {section.title || `Section ${idx + 1}`}
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="pt-4 border-t border-zinc-200">
                    <Link
                      href="/help"
                      className="text-xs font-medium text-zinc-700 hover:text-zinc-900 underline flex items-center gap-1"
                    >
                      Need help? Visit Help Centre →
                    </Link>
                  </div>
                </div>
              </aside>
            )}

            {/* Content Sections */}
            <div className={`space-y-12 ${payload.sections.length > 1 ? "lg:col-span-8" : "lg:col-span-12 max-w-4xl mx-auto"}`}>
              {payload.sections.map((section, idx) => {
                const sectionId = section.id || `section-${idx}`;

                return (
                  <section
                    key={sectionId}
                    id={sectionId}
                    className="scroll-mt-24 space-y-4"
                  >
                    {section.title && (
                      <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 border-b border-zinc-100 pb-3">
                        {section.title}
                      </h2>
                    )}

                    {/* Layout Variants */}
                    {section.layout === "CALLOUT" ? (
                      <div className={`p-6 rounded-2xl border ${
                        section.calloutVariant === "warning"
                          ? "bg-amber-50 border-amber-200 text-amber-900"
                          : section.calloutVariant === "success"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                          : section.calloutVariant === "tip"
                          ? "bg-violet-50 border-violet-200 text-violet-900"
                          : "bg-blue-50 border-blue-200 text-blue-900"
                      }`}>
                        <div className="prose prose-sm max-w-none leading-relaxed whitespace-pre-line font-medium">
                          {section.body}
                        </div>
                      </div>
                    ) : section.layout === "ACCORDION" && section.items && section.items.length > 0 ? (
                      <div className="space-y-4">
                        <div className="prose prose-sm max-w-none text-zinc-700 leading-relaxed whitespace-pre-line">
                          {section.body}
                        </div>
                        <div className="divide-y divide-zinc-200 border-y border-zinc-200">
                          {section.items.map((item, itemIdx) => {
                            const accId = `${sectionId}-item-${itemIdx}`;
                            const isOpen = openAccordions[accId];
                            return (
                              <div key={accId} className="py-4">
                                <button
                                  type="button"
                                  onClick={() => toggleAccordion(accId)}
                                  className="w-full flex items-center justify-between text-left font-semibold text-zinc-900 text-sm hover:text-zinc-600 transition"
                                >
                                  <span>{item.label}</span>
                                  <span className="text-lg leading-none font-bold text-zinc-400">
                                    {isOpen ? "−" : "+"}
                                  </span>
                                </button>
                                {isOpen && (
                                  <div className="pt-3 text-sm text-zinc-600 leading-relaxed whitespace-pre-line">
                                    {item.text}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : section.layout === "TWO_COLUMN" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-zinc-50 p-6 rounded-2xl border border-zinc-200">
                        <div className="prose prose-sm max-w-none text-zinc-700 leading-relaxed whitespace-pre-line">
                          {section.body}
                        </div>
                        {section.imageUrl && (
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={section.imageUrl}
                              alt={section.imageAlt || section.title || ""}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      /* STANDARD LAYOUT */
                      <div className="prose prose-zinc max-w-none text-zinc-700 leading-relaxed whitespace-pre-line text-sm sm:text-base">
                        {section.body}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}

