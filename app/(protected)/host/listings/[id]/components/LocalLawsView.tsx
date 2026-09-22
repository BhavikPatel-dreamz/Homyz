"use client";
import { BackButton } from "@/components/ui/back-button";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useLanguage } from "@/lib/i18n/language-context";
import type { SectionKey } from "../section-helpers";

interface LocalLawsViewProps {
  setActiveSection: (section: SectionKey) => void;
  isSaving: boolean;
  handleSaveSection: (section: SectionKey) => void;
  listingCity?: string | null;
  listingCountry?: string | null;
}

// Available Resource Centre Articles
type ArticleId = "hosting-regulations" | "disruptive-events" | "aircover" | "safety-guidelines";

interface ArticleContent {
  id: ArticleId;
  title: string;
  subtitle: string;
  readTime: string;
  date: string;
  author: string;
  image: string;
  summary: string;
}

export function LocalLawsView({
  setActiveSection,
  isSaving,
  handleSaveSection,
  listingCity,
}: LocalLawsViewProps) {
  const { t } = useLanguage();
  const [isSaved, setIsSaved] = useState(false);
  const [showResourceDrawer, setShowResourceDrawer] = useState(false);
  const [activeArticleId, setActiveArticleId] = useState<ArticleId>("hosting-regulations");
  const [copiedLink, setCopiedLink] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);
  const [showAiPromptHelper, setShowAiPromptHelper] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const cityDisplay = listingCity?.trim() || t("host_local_laws_your_city");

  const ARTICLES: Record<ArticleId, ArticleContent> = {
    "hosting-regulations": {
      id: "hosting-regulations",
      title: t("host_local_laws_art1_title"),
      subtitle: t("host_local_laws_art1_subtitle"),
      readTime: t("host_local_laws_read_time_3min"),
      date: t("host_local_laws_art1_date"),
      author: t("host_local_laws_art1_author"),
      image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80",
      summary: t("host_local_laws_art1_summary"),
    },
    "disruptive-events": {
      id: "disruptive-events",
      title: t("host_local_laws_art2_title"),
      subtitle: t("host_local_laws_art2_subtitle"),
      readTime: t("host_local_laws_read_time_4min"),
      date: t("host_local_laws_art2_date"),
      author: t("host_local_laws_art2_author"),
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
      summary: t("host_local_laws_art2_summary"),
    },
    "aircover": {
      id: "aircover",
      title: t("host_local_laws_art3_title"),
      subtitle: t("host_local_laws_art3_subtitle"),
      readTime: t("host_local_laws_read_time_3min"),
      date: t("host_local_laws_art3_date"),
      author: t("host_local_laws_art3_author"),
      image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
      summary: t("host_local_laws_art3_summary"),
    },
    "safety-guidelines": {
      id: "safety-guidelines",
      title: t("host_local_laws_art4_title"),
      subtitle: t("host_local_laws_art4_subtitle"),
      readTime: t("host_local_laws_read_time_5min"),
      date: t("host_local_laws_art4_date"),
      author: t("host_local_laws_art4_author"),
      image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
      summary: t("host_local_laws_art4_summary"),
    },
  };

  const activeArticle = ARTICLES[activeArticleId];

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showResourceDrawer) {
        setShowResourceDrawer(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showResourceDrawer]);

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const aiPromptText = t("host_local_laws_ai_prompt_template", { city: cityDisplay });

  const handleCopyAiPrompt = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(aiPromptText);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-2xl pb-16 font-sans text-zinc-900 dark:text-zinc-100">
      {/* 1. Header & Back Button */}
      <div className="flex items-center gap-6">
        <BackButton onClick={() => setActiveSection("arrival-guide")} />
        <h1>{t("host_local_laws_heading")}</h1>
      </div>

      {/* 2. Intro Paragraph */}
      <p className="text-sm leading-5 text-[#727272] dark:text-zinc-400 max-w-[491px]">
        {t("host_local_laws_intro")}
      </p>

      {/* 3. Regulation Article Card Link (Interactive Trigger) */}
      <div
        onClick={() => {
          setActiveArticleId("hosting-regulations");
          setShowResourceDrawer(true);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setActiveArticleId("hosting-regulations");
            setShowResourceDrawer(true);
          }
        }}
        className="rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 flex items-center gap-4 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs transition-all cursor-pointer group max-w-xl select-none"
      >
        {/* Thumbnail Image */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 relative bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700">
          <Image
            src="https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=300&q=80"
            alt={t("host_local_laws_hosting_regulations_alt")}
            fill
            sizes="80px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal block">
            {t("host_local_laws_read_time_3min")}
          </span>
          <h2 className="text-sm sm:text-[15px] font-semibold text-[#1F1F1F] dark:text-zinc-100 flex items-center gap-1.5 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">
            {t("host_local_laws_learn_regulations_title")}
            <svg
              className="w-4 h-4 text-zinc-500 dark:text-zinc-400 transition-transform group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </h2>
        </div>
      </div>

      {/* 4. Body Paragraph 1 */}
      <p className="text-xs sm:text-sm text-[#727272] dark:text-zinc-400 font-normal leading-relaxed max-w-xl">
        {t("host_local_laws_body_p1")}
      </p>

      {/* 5. Body Paragraph 2 */}
      <p className="text-xs sm:text-sm text-[#727272] dark:text-zinc-400 font-normal leading-relaxed max-w-xl">
        {t("host_local_laws_body_p2")}
      </p>

      {/* 6. Documented Action & Text Link Triggers */}
      <div className="space-y-2.5 pt-1">
        <div>
          <button
            type="button"
            onClick={() => {
              setActiveArticleId("hosting-regulations");
              setShowResourceDrawer(true);
            }}
            className="text-xs sm:text-sm font-normal text-zinc-600 dark:text-zinc-400 underline underline-offset-3 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer text-left"
          >
            {t("host_local_laws_link_regulations_apply")}
          </button>
        </div>
        <div>
          <button
            type="button"
            onClick={() => {
              setActiveArticleId("hosting-regulations");
              setShowResourceDrawer(true);
            }}
            className="text-xs sm:text-sm font-normal text-zinc-600 dark:text-zinc-400 underline underline-offset-3 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer text-left"
          >
            {t("host_local_laws_link_responsible_hosting")}
          </button>
        </div>
      </div>

      {/* 7. Legal Terms Disclaimer */}
      <p className="text-sm text-zinc-500 dark:text-zinc-400 font-normal leading-relaxed max-w-xl pt-2 border-t border-zinc-100 dark:border-zinc-800">
        {t("host_local_laws_legal_disclaimer")}
      </p>

      {/* 8. Save & Acknowledge Actions */}
      <div className="flex items-center gap-3 pt-3">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => {
            handleSaveSection("local-laws");
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-7 py-2.5 transition-all cursor-pointer border border-transparent hover:border-[#1F1F1F] duration-300 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-zinc-700 dark:hover:text-white dark:hover:border-zinc-600"
        >
          {isSaving ? t("host_saving") : isSaved ? t("host_saved") : t("host_local_laws_acknowledge_btn")}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("description")}
          className="inline-flex items-center gap-1.5 rounded-full bg-white hover:bg-[#1F1F1F] text-[#1f1f1f] hover:text-white font-medium text-sm px-7 py-2.5 transition-all cursor-pointer border border-[#1f1f1f] hover:border-[#1F1F1F] duration-300 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-zinc-700 dark:hover:text-white dark:hover:border-zinc-600"
        >
          {t("host_cancel")}
        </button>
      </div>

      {/* ================================================================= */}
      {/* 9. RESOURCE CENTRE ARTICLE MODAL                                   */}
      {/* Follows AGENTS.md rule: ModalOverlay outer overlay, locks scroll  */}
      {/* ================================================================= */}
      {showResourceDrawer && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          {/* Backdrop Click Dismiss */}
          <div
            className="absolute inset-0"
            onClick={() => setShowResourceDrawer(false)}
            aria-hidden="true"
          />

          {/* Centered modal container */}
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="resource-centre-title"
            className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white dark:bg-zinc-900 animate-in zoom-in-95 duration-200"
          >
            {/* Top Bar (Resource Centre & Close Button) */}
            <div className="sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm z-20 border-b border-zinc-100 dark:border-zinc-800 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-[#1f1f1f] dark:text-zinc-200">
                {/* Book / Resource Icon */}
                <svg
                  className="w-6 h-6 text-zinc-800 dark:text-zinc-200"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                <h2 className="text-xl">{t("host_local_laws_resource_centre")}</h2>
              </div>

              <button
                type="button"
                onClick={() => setShowResourceDrawer(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label={t("host_local_laws_close_resource_centre")}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Article Content */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6 text-zinc-800 dark:text-zinc-200">
              {/* Back to main article if switched to related */}
              {activeArticleId !== "hosting-regulations" && (
                <button
                  type="button"
                  onClick={() => setActiveArticleId("hosting-regulations")}
                  className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer mb-2"
                >
                  {t("host_local_laws_back_to_hosting_regulations")}
                </button>
              )}

              {/* Title & Subtitle */}
              <div>
                <h2 id="resource-centre-title">
                  {activeArticle.title}
                </h2>
                <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 font-normal mt-1.5 leading-snug">
                  {activeArticle.subtitle}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-normal mt-2">
                  {t("host_local_laws_by_author_date", { author: activeArticle.author, date: activeArticle.date })}
                </p>
              </div>

              {/* Social Sharing Icons */}
              <div className="flex items-center gap-2 pt-1 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                {/* Copy Link Button */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  title={t("host_local_laws_copy_link")}
                  aria-label={t("host_local_laws_copy_link")}
                  className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer relative"
                >
                  {copiedLink ? (
                    <svg
                      className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  )}
                </button>
                {copiedLink && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in">
                    {t("host_local_laws_link_copied")}
                  </span>
                )}

                {/* X / Twitter */}
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(activeArticle.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  aria-label={t("host_local_laws_share_on_x")}
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>

                {/* Facebook */}
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://homyz.app/resource-center")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  aria-label={t("host_local_laws_share_on_facebook")}
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
              </div>

              {/* Hero Image */}
              <div className="w-full h-56 sm:h-72 rounded-2xl overflow-hidden relative shadow-2xs border border-zinc-100 dark:border-zinc-800">
                <Image
                  src={activeArticle.image}
                  alt={activeArticle.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 672px"
                  priority
                  className="object-cover"
                />
              </div>

              {/* Article Content based on Active Article */}
              {activeArticleId === "hosting-regulations" && (
                <div className="space-y-6 text-sm sm:text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <p>{t("host_local_laws_art1_p1")}</p>
                  <p>{t("host_local_laws_art1_p2")}</p>
                  <p>{t("host_local_laws_art1_p3")}</p>

                  {/* Section 1: Visit the Help Centre */}
                  <div className="space-y-2 pt-2">
                    <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("host_local_laws_art1_sec1_title")}
                    </h3>
                    <p>
                      {t("host_local_laws_art1_sec1_text1")}{" "}
                      <span className="text-zinc-900 dark:text-zinc-100 font-semibold underline underline-offset-2 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
                        {t("host_local_laws_art1_sec1_link")}
                      </span>{" "}
                      {t("host_local_laws_art1_sec1_text2")}
                    </p>
                  </div>

                  {/* Section 2: Connect locally */}
                  <div className="space-y-2 pt-2">
                    <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("host_local_laws_art1_sec2_title")}
                    </h3>
                    <p>{t("host_local_laws_art1_sec2_text")}</p>
                  </div>

                  {/* Section 3: Contact hosts */}
                  <div className="space-y-2 pt-2">
                    <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("host_local_laws_art1_sec3_title")}
                    </h3>
                    <p>
                      {t("host_local_laws_art1_sec3_text1")}{" "}
                      <span className="text-zinc-900 dark:text-zinc-100 font-semibold underline underline-offset-2 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
                        {t("host_local_laws_art1_sec3_link1")}
                      </span>{" "}
                      {t("host_local_laws_art1_sec3_text2")}{" "}
                      <span className="text-zinc-900 dark:text-zinc-100 font-semibold underline underline-offset-2 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
                        {t("host_local_laws_art1_sec3_link2")}
                      </span>{" "}
                      {t("host_local_laws_art1_sec3_text3")}
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      {t("host_local_laws_art1_sec3_text4")}
                    </p>
                  </div>

                  {/* Section 4: Consult a professional */}
                  <div className="space-y-2 pt-2">
                    <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("host_local_laws_art1_sec4_title")}
                    </h3>
                    <p>{t("host_local_laws_art1_sec4_text")}</p>
                  </div>

                  {/* Section 5: Learn more with AI */}
                  <div className="space-y-3 pt-2">
                    <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("host_local_laws_art1_sec5_title")}
                    </h3>
                    <p>{t("host_local_laws_art1_sec5_intro")}</p>
                    <ul className="space-y-3 pl-1">
                      <li className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-300 mt-2 shrink-0" />
                        <div>
                          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {t("host_local_laws_art1_sec5_tip1_bold")}
                          </strong>{" "}
                          {t("host_local_laws_art1_sec5_tip1_text", { city: cityDisplay })}
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-300 mt-2 shrink-0" />
                        <div>
                          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {t("host_local_laws_art1_sec5_tip2_bold")}
                          </strong>{" "}
                          {t("host_local_laws_art1_sec5_tip2_text")}
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-300 mt-2 shrink-0" />
                        <div>
                          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {t("host_local_laws_art1_sec5_tip3_bold")}
                          </strong>{" "}
                          {t("host_local_laws_art1_sec5_tip3_text")}
                        </div>
                      </li>
                    </ul>

                    {/* Get Started Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAiPromptHelper(!showAiPromptHelper)}
                        className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-semibold text-xs px-5 py-2.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        {showAiPromptHelper ? t("host_local_laws_hide_prompt") : t("host_local_laws_get_started")}
                      </button>
                    </div>

                    {/* AI Prompt Helper Card */}
                    {showAiPromptHelper && (
                      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-4 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                            <span className="text-amber-500">✨</span>{" "}
                            {t("host_local_laws_suggested_ai_prompt", { city: cityDisplay })}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyAiPrompt}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
                          >
                            {copiedPrompt ? t("host_local_laws_copied") : t("host_local_laws_copy_prompt")}
                          </button>
                        </div>
                        <p className="text-xs text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-700 font-mono leading-relaxed">
                          &ldquo;{aiPromptText}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Alternative Content for Disruptive Events */}
              {activeArticleId === "disruptive-events" && (
                <div className="space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <p>{t("host_local_laws_art2_p1")}</p>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 pt-2">
                    {t("host_local_laws_art2_heading")}
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                    <li>{t("host_local_laws_art2_item1")}</li>
                    <li>{t("host_local_laws_art2_item2")}</li>
                    <li>{t("host_local_laws_art2_item3")}</li>
                  </ul>
                </div>
              )}

              {/* Alternative Content for AirCover / Host Protection */}
              {activeArticleId === "aircover" && (
                <div className="space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <p>{t("host_local_laws_art3_p1")}</p>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 pt-2">
                    {t("host_local_laws_art3_heading")}
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                    <li>{t("host_local_laws_art3_item1")}</li>
                    <li>{t("host_local_laws_art3_item2")}</li>
                    <li>{t("host_local_laws_art3_item3")}</li>
                  </ul>
                </div>
              )}

              {/* Alternative Content for Safety Guidelines */}
              {activeArticleId === "safety-guidelines" && (
                <div className="space-y-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <p>{t("host_local_laws_art4_p1")}</p>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 pt-2">
                    {t("host_local_laws_art4_heading")}
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                    <li>{t("host_local_laws_art4_item1")}</li>
                    <li>{t("host_local_laws_art4_item2")}</li>
                    <li>{t("host_local_laws_art4_item3")}</li>
                  </ul>
                </div>
              )}

              {/* Footnote & Timestamp */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                <p className="text-xs italic text-zinc-400 dark:text-zinc-500">
                  {t("host_local_laws_footnote")}
                </p>

                {/* Author badge & Helpful Feedback */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 font-bold text-xs">
                      H
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
                        {activeArticle.author}
                      </span>
                      <span className="text-xs text-[#1f1f1f] dark:text-zinc-500">{activeArticle.date}</span>
                    </div>
                  </div>

                  {/* Feedback Thumb Icons */}
                  <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {feedbackGiven ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in">
                        {t("host_local_laws_feedback_thanks")}
                      </span>
                    ) : (
                      <>
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {t("host_local_laws_was_this_helpful")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFeedbackGiven("up")}
                          className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 cursor-pointer"
                          aria-label={t("host_local_laws_thumbs_up")}
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          onClick={() => setFeedbackGiven("down")}
                          className="w-7 h-7 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 cursor-pointer"
                          aria-label={t("host_local_laws_thumbs_down")}
                        >
                          👎
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* "You might also like" Section (Matching reference footer) */}
              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {t("host_local_laws_you_might_also_like")}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Card 1 */}
                  <div
                    onClick={() => {
                      setActiveArticleId("disruptive-events");
                      setFeedbackGiven(null);
                    }}
                    role="button"
                    tabIndex={0}
                    className={`p-3 rounded-xl border transition-all cursor-pointer group flex flex-col justify-between ${
                      activeArticleId === "disruptive-events"
                        ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
                        : "border-zinc-200 hover:border-zinc-300 bg-white dark:border-zinc-800 dark:hover:border-zinc-700 dark:bg-zinc-900"
                    }`}
                  >
                    <div className="w-full h-16 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-white font-bold text-xs mb-2">
                      {t("host_local_laws_policy_badge")}
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:underline line-clamp-2">
                        {t("host_local_laws_art2_title")}
                      </h5>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1">
                        {t("host_local_laws_art2_subtitle")}
                      </p>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div
                    onClick={() => {
                      setActiveArticleId("aircover");
                      setFeedbackGiven(null);
                    }}
                    role="button"
                    tabIndex={0}
                    className={`p-3 rounded-xl border transition-all cursor-pointer group flex flex-col justify-between ${
                      activeArticleId === "aircover"
                        ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
                        : "border-zinc-200 hover:border-zinc-300 bg-white dark:border-zinc-800 dark:hover:border-zinc-700 dark:bg-zinc-900"
                    }`}
                  >
                    <div className="w-full h-16 rounded-lg overflow-hidden relative mb-2">
                      <Image
                        src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=300&q=80"
                        alt={t("host_local_laws_art3_title")}
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:underline line-clamp-2">
                        {t("host_local_laws_art3_title")}
                      </h5>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1">
                        {t("host_local_laws_art3_card_sub")}
                      </p>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div
                    onClick={() => {
                      setActiveArticleId("safety-guidelines");
                      setFeedbackGiven(null);
                    }}
                    role="button"
                    tabIndex={0}
                    className={`p-3 rounded-xl border transition-all cursor-pointer group flex flex-col justify-between ${
                      activeArticleId === "safety-guidelines"
                        ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
                        : "border-zinc-200 hover:border-zinc-300 bg-white dark:border-zinc-800 dark:hover:border-zinc-700 dark:bg-zinc-900"
                    }`}
                  >
                    <div className="w-full h-16 rounded-lg overflow-hidden relative mb-2">
                      <Image
                        src="https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=300&q=80"
                        alt={t("host_local_laws_art4_title")}
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:underline line-clamp-2">
                        {t("host_local_laws_art4_title")}
                      </h5>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1">
                        {t("host_local_laws_art4_card_sub")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </ModalOverlay>
      )}
    </div>
  );
}
