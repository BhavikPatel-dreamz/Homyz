"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
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

const ARTICLES: Record<ArticleId, ArticleContent> = {
  "hosting-regulations": {
    id: "hosting-regulations",
    title: "Learn about hosting regulations",
    subtitle: "Research local laws, taxes and permits.",
    readTime: "3 min read",
    date: "22 Apr 2026",
    author: "Homyz",
    image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80",
    summary: "Before you start hosting, it's important to understand how short-term rentals are regulated in your area.",
  },
  "disruptive-events": {
    id: "disruptive-events",
    title: "Major Disruptive Events Policy",
    subtitle: "Find out how Homyz handles unforeseen cancellations.",
    readTime: "4 min read",
    date: "15 Mar 2026",
    author: "Homyz Legal",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
    summary: "Clear guidelines on cancellations during natural disasters, government travel restrictions, and declared emergencies.",
  },
  "aircover": {
    id: "aircover",
    title: "How Protection for Hosts works",
    subtitle: "Top-to-bottom protection for every stay.",
    readTime: "3 min read",
    date: "10 Feb 2026",
    author: "Homyz Support",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
    summary: "Comprehensive host damage protection and liability insurance included with every booking.",
  },
  "safety-guidelines": {
    id: "safety-guidelines",
    title: "Safety guidelines for hosts",
    subtitle: "Follow these responsible safety practices for peace of mind.",
    readTime: "5 min read",
    date: "5 Jan 2026",
    author: "Homyz Trust & Safety",
    image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
    summary: "Practical safety checklist including smoke alarms, carbon monoxide detectors, emergency plans, and first-aid provisions.",
  },
};

export function LocalLawsView({
  setActiveSection,
  isSaving,
  handleSaveSection,
  listingCity,
}: LocalLawsViewProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [showResourceDrawer, setShowResourceDrawer] = useState(false);
  const [activeArticleId, setActiveArticleId] = useState<ArticleId>("hosting-regulations");
  const [copiedLink, setCopiedLink] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);
  const [showAiPromptHelper, setShowAiPromptHelper] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const cityDisplay = listingCity?.trim() || "your city";
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

  const aiPromptText = `What are the current short-term rental permits, zoning ordinances, registration requirements, and transient occupancy taxes for hosting a residential property in ${cityDisplay}? Please provide official government sources and municipal codes.`;

  const handleCopyAiPrompt = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(aiPromptText);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-2xl pb-16 font-sans text-zinc-900">
      {/* 1. Header & Back Button (Matching reference design) */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setActiveSection("description")}
          className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 text-sm transition-all cursor-pointer shadow-2xs"
          aria-label="Back to listing editor"
        >
          {/* Arrow Left SVG */}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F1F1F]">
          Local laws
        </h1>
      </div>

      {/* 2. Intro Paragraph */}
      <p className="text-sm text-zinc-600 font-normal leading-relaxed pt-0.5 max-w-xl">
        Take a moment to review the local laws that apply to your listing. We want to make sure you
        have everything you need to get off to a great start.
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
        className="rounded-2xl border border-zinc-200/90 bg-white p-3.5 sm:p-4 flex items-center gap-4 shadow-2xs hover:border-zinc-300 hover:shadow-xs transition-all cursor-pointer group max-w-xl select-none"
      >
        {/* Thumbnail Image */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 relative bg-zinc-100 border border-zinc-200/60">
          <Image
            src="https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=300&q=80"
            alt="Hosting regulations"
            fill
            sizes="80px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <span className="text-xs text-zinc-500 font-normal block">3 min read</span>
          <h2 className="text-sm sm:text-[15px] font-semibold text-[#1F1F1F] flex items-center gap-1.5 group-hover:text-zinc-700 transition-colors">
            Learn about hosting regulations
            <svg
              className="w-4 h-4 text-zinc-500 transition-transform group-hover:translate-x-0.5"
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
      <p className="text-xs sm:text-sm text-zinc-600 font-normal leading-relaxed max-w-xl">
        Most cities have rules covering home sharing, and the specific codes and ordinances can appear
        in many places (such as zoning, building, licensing or tax codes). In most places, you must
        register, get a permit, or obtain a licence before you list your property or accept guests.
        You may also be responsible for collecting and remitting certain taxes. In some places,
        short-term rentals could be prohibited altogether.
      </p>

      {/* 5. Body Paragraph 2 */}
      <p className="text-xs sm:text-sm text-zinc-600 font-normal leading-relaxed max-w-xl">
        Since you are responsible for your own decision to list, you should get comfortable with the
        applicable rules before listing on Homyz. To get you started, we offer some helpful
        resources under &ldquo;Your City Laws&rdquo;.
      </p>

      {/* 6. Text Link Trigger */}
      <div>
        <button
          type="button"
          onClick={() => {
            setActiveArticleId("hosting-regulations");
            setShowResourceDrawer(true);
          }}
          className="text-xs sm:text-sm font-semibold text-[#1F1F1F] underline underline-offset-3 hover:text-zinc-700 transition-colors cursor-pointer text-left"
        >
          Learn more about responsible hosting
        </button>
      </div>

      {/* 7. Legal Terms Disclaimer */}
      <p className="text-[11px] sm:text-xs text-zinc-500 font-normal leading-relaxed max-w-xl pt-2 border-t border-zinc-100">
        By accepting our Terms of Service and listing your space, you certify that you will follow
        applicable laws and regulations.
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
          className="rounded-full bg-[#FEE08B] hover:bg-[#FDD017] text-zinc-950 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          {isSaving ? "Saving..." : isSaved ? "Saved!" : "I understand & acknowledge"}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("description")}
          className="rounded-full bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-800 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          Cancel
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
            className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
          >
            {/* Top Bar (Resource Centre & Close Button) */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-20 border-b border-zinc-100 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800">
                {/* Book / Resource Icon */}
                <svg
                  className="w-4 h-4 text-zinc-800"
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
                <span>Resource Centre</span>
              </div>

              <button
                type="button"
                onClick={() => setShowResourceDrawer(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                aria-label="Close Resource Centre"
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
            <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6 text-zinc-800">
              {/* Back to main article if switched to related */}
              {activeArticleId !== "hosting-regulations" && (
                <button
                  type="button"
                  onClick={() => setActiveArticleId("hosting-regulations")}
                  className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 flex items-center gap-1 cursor-pointer mb-2"
                >
                  ← Back to hosting regulations
                </button>
              )}

              {/* Title & Subtitle */}
              <div>
                <h2
                  id="resource-centre-title"
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F1F1F] leading-tight"
                >
                  {activeArticle.title}
                </h2>
                <p className="text-base sm:text-lg text-zinc-600 font-normal mt-1.5 leading-snug">
                  {activeArticle.subtitle}
                </p>
                <p className="text-xs text-zinc-400 font-normal mt-2">
                  By {activeArticle.author} on {activeArticle.date}
                </p>
              </div>

              {/* Social Sharing Icons */}
              <div className="flex items-center gap-2 pt-1 border-b border-zinc-100 pb-4">
                {/* Copy Link Button */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  title="Copy link"
                  className="w-8 h-8 rounded-full border border-zinc-200 hover:bg-zinc-50 flex items-center justify-center text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer relative"
                >
                  {copiedLink ? (
                    <svg
                      className="w-3.5 h-3.5 text-emerald-600"
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
                  <span className="text-[11px] text-emerald-600 font-medium animate-in fade-in">
                    Link copied!
                  </span>
                )}

                {/* X / Twitter */}
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(activeArticle.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full border border-zinc-200 hover:bg-zinc-50 flex items-center justify-center text-zinc-600 hover:text-zinc-900 transition-colors"
                  aria-label="Share on X"
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
                  className="w-8 h-8 rounded-full border border-zinc-200 hover:bg-zinc-50 flex items-center justify-center text-zinc-600 hover:text-zinc-900 transition-colors"
                  aria-label="Share on Facebook"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
              </div>

              {/* Hero Image */}
              <div className="w-full h-56 sm:h-72 rounded-2xl overflow-hidden relative shadow-2xs border border-zinc-100">
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
                <div className="space-y-6 text-sm sm:text-[15px] leading-relaxed text-zinc-700">
                  <p>
                    Before you start hosting, it&apos;s important to understand how short-term rentals
                    are regulated in your area. Local rules might affect whether you can host, what
                    type of permit you need and which taxes apply.
                  </p>

                  <p>
                    For example, there may be registration requirements and zoning rules that limit
                    how you can use your space, or taxes such as occupancy tax or value-added tax.
                  </p>

                  <p>
                    While Homyz can&apos;t provide legal or tax advice, we can help you find useful
                    information to get started.
                  </p>

                  {/* Section 1: Visit the Help Centre */}
                  <div className="space-y-2 pt-2">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900">
                      Visit the Help Centre
                    </h3>
                    <p>
                      Homyz&apos;s Help Centre has{" "}
                      <span className="text-zinc-900 font-semibold underline underline-offset-2 cursor-pointer hover:text-zinc-700">
                        regional information
                      </span>{" "}
                      about laws, regulations, taxes, best practices and other considerations for
                      hosts. These guides are a starting point for understanding requirements in your
                      country, state, county or city.
                    </p>
                  </div>

                  {/* Section 2: Connect locally */}
                  <div className="space-y-2 pt-2">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900">
                      Connect locally
                    </h3>
                    <p>
                      Many local governments publish short-term rental policies on their official
                      websites. If you can&apos;t find the information online, try emailing or calling
                      them directly. If you&apos;re a tenant, review your lease and check with your
                      landlord.
                    </p>
                  </div>

                  {/* Section 3: Contact hosts */}
                  <div className="space-y-2 pt-2">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900">
                      Contact hosts
                    </h3>
                    <p>
                      Join a local{" "}
                      <span className="text-zinc-900 font-semibold underline underline-offset-2 cursor-pointer hover:text-zinc-700">
                        Host Club
                      </span>{" "}
                      or visit the global{" "}
                      <span className="text-zinc-900 font-semibold underline underline-offset-2 cursor-pointer hover:text-zinc-700">
                        Community Centre
                      </span>{" "}
                      to connect with experienced hosts who&apos;ve navigated local rules and
                      regulations. Most hosts are not licensed tax or legal advisers; it&apos;s a good
                      idea to verify any information you receive.
                    </p>
                    <p className="text-zinc-600">
                      A co-host could also help with licensing and permits.
                    </p>
                  </div>

                  {/* Section 4: Consult a professional */}
                  <div className="space-y-2 pt-2">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900">
                      Consult a professional
                    </h3>
                    <p>
                      Local lawyers or tax professionals can provide advice about the specific rules
                      in your area; they can help you stay in compliance as you prepare to host.
                    </p>
                  </div>

                  {/* Section 5: Learn more with AI */}
                  <div className="space-y-3 pt-2">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900">
                      Learn more with AI
                    </h3>
                    <p>
                      You can use AI tools to help identify regulations that may affect short-term
                      rentals in your area. Keep these tips in mind for getting useful results:
                    </p>
                    <ul className="space-y-3 pl-1">
                      <li className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 mt-2 shrink-0" />
                        <div>
                          <strong className="font-semibold text-zinc-900">
                            Be specific about your location.
                          </strong>{" "}
                          For example, if you want to host in {cityDisplay}, use the &ldquo;City of{" "}
                          {cityDisplay}&rdquo; in your queries. Otherwise, you might get results for the
                          wider regional district, which has different rules.
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 mt-2 shrink-0" />
                        <div>
                          <strong className="font-semibold text-zinc-900">
                            Read official sources.
                          </strong>{" "}
                          The most accurate information typically comes from government websites.
                          Local regulations change, so make sure you&apos;re seeing the latest.
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 mt-2 shrink-0" />
                        <div>
                          <strong className="font-semibold text-zinc-900">
                            Look at multiple levels.
                          </strong>{" "}
                          Short-term rentals may be affected by neighbourhood, city, county, state,
                          province, territory or country rules. Be sure to review all that apply.
                        </div>
                      </li>
                    </ul>

                    {/* Get Started Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAiPromptHelper(!showAiPromptHelper)}
                        className="rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs px-5 py-2.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        {showAiPromptHelper ? "Hide prompt" : "Get started"}
                      </button>
                    </div>

                    {/* AI Prompt Helper Card */}
                    {showAiPromptHelper && (
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                            <span className="text-amber-500">✨</span> Suggested AI Prompt for{" "}
                            {cityDisplay}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyAiPrompt}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                          >
                            {copiedPrompt ? "Copied!" : "Copy prompt"}
                          </button>
                        </div>
                        <p className="text-xs text-zinc-700 bg-white p-3 rounded-lg border border-zinc-200/80 font-mono leading-relaxed">
                          &ldquo;{aiPromptText}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Alternative Content for Disruptive Events */}
              {activeArticleId === "disruptive-events" && (
                <div className="space-y-4 text-sm leading-relaxed text-zinc-700">
                  <p>
                    Homyz&apos;s Major Disruptive Events Policy outlines circumstances where hosts or
                    guests may cancel eligible reservations with refunds, such as natural disasters,
                    declared health emergencies, and government-mandated travel restrictions.
                  </p>
                  <h3 className="text-base font-bold text-zinc-900 pt-2">
                    What qualifies as a disruptive event
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                    <li>Severe weather events making safe travel impossible</li>
                    <li>Official evacuation orders or emergency declarations</li>
                    <li>Widespread outages of critical public infrastructure</li>
                  </ul>
                </div>
              )}

              {/* Alternative Content for AirCover / Host Protection */}
              {activeArticleId === "aircover" && (
                <div className="space-y-4 text-sm leading-relaxed text-zinc-700">
                  <p>
                    Every Homyz host receives comprehensive protection whenever they welcome guests.
                    This includes damage protection, liability insurance, and 24-hour safety support.
                  </p>
                  <h3 className="text-base font-bold text-zinc-900 pt-2">Protection Highlights</h3>
                  <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                    <li>Up to SAR 3,000,000 in host damage protection</li>
                    <li>SAR 1,000,000 liability insurance</li>
                    <li>Pet damage, art, and deep cleaning protection</li>
                  </ul>
                </div>
              )}

              {/* Alternative Content for Safety Guidelines */}
              {activeArticleId === "safety-guidelines" && (
                <div className="space-y-4 text-sm leading-relaxed text-zinc-700">
                  <p>
                    Keeping guests safe is the cornerstone of great hosting. Ensure your space has
                    tested working smoke and carbon monoxide alarms, an accessible first-aid kit,
                    and a clear emergency evacuation map.
                  </p>
                  <h3 className="text-base font-bold text-zinc-900 pt-2">Safety Essentials</h3>
                  <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                    <li>Install interconnected smoke detectors in every bedroom</li>
                    <li>Maintain a serviced fire extinguisher in the kitchen</li>
                    <li>Clearly display local emergency telephone numbers</li>
                  </ul>
                </div>
              )}

              {/* Footnote & Timestamp */}
              <div className="pt-4 border-t border-zinc-100 space-y-3">
                <p className="text-xs italic text-zinc-400">
                  Information contained in this article may have changed since publication.
                </p>

                {/* Author badge & Helpful Feedback */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 font-bold text-xs">
                      H
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-zinc-900 block">
                        {activeArticle.author}
                      </span>
                      <span className="text-[11px] text-zinc-400">{activeArticle.date}</span>
                    </div>
                  </div>

                  {/* Feedback Thumb Icons */}
                  <div className="flex items-center gap-2 text-xs text-zinc-600">
                    {feedbackGiven ? (
                      <span className="text-emerald-600 font-medium animate-in fade-in">
                        Thank you for your feedback!
                      </span>
                    ) : (
                      <>
                        <span className="text-zinc-500">Was this helpful?</span>
                        <button
                          type="button"
                          onClick={() => setFeedbackGiven("up")}
                          className="w-7 h-7 rounded-full border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-600 cursor-pointer"
                          aria-label="Thumbs up"
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          onClick={() => setFeedbackGiven("down")}
                          className="w-7 h-7 rounded-full border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-600 cursor-pointer"
                          aria-label="Thumbs down"
                        >
                          👎
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* "You might also like" Section (Matching reference footer) */}
              <div className="pt-6 border-t border-zinc-100 space-y-4">
                <h4 className="text-sm font-bold text-zinc-900">You might also like</h4>
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
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 hover:border-zinc-300 bg-white"
                    }`}
                  >
                    <div className="w-full h-16 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-white font-bold text-xs mb-2">
                      Policy
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-zinc-900 group-hover:underline line-clamp-2">
                        Major Disruptive Events Policy
                      </h5>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1">
                        Find out how Homyz handles unforeseen cancellations.
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
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 hover:border-zinc-300 bg-white"
                    }`}
                  >
                    <div className="w-full h-16 rounded-lg overflow-hidden relative mb-2">
                      <Image
                        src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=300&q=80"
                        alt="Protection for Hosts"
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-zinc-900 group-hover:underline line-clamp-2">
                        How Protection for Hosts works
                      </h5>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1">
                        Top-to-bottom protection on damage and liability.
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
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200 hover:border-zinc-300 bg-white"
                    }`}
                  >
                    <div className="w-full h-16 rounded-lg overflow-hidden relative mb-2">
                      <Image
                        src="https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=300&q=80"
                        alt="Safety guidelines"
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-zinc-900 group-hover:underline line-clamp-2">
                        Safety guidelines for hosts
                      </h5>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1">
                        Follow these responsible safety practices.
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
