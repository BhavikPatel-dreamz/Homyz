"use client";

import React, { useState } from "react";
import Image from "next/image";

export interface CmsVisualPreviewProps {
  type: string;
  payload: Record<string, any>;
  title?: string;
  versionNumber?: number;
  locale?: string;
  className?: string;
}

export function CmsVisualPreview({
  type,
  payload,
  title,
  versionNumber,
  locale = "en",
  className = "",
}: CmsVisualPreviewProps) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [imgError, setImgError] = useState(false);
  const [direction, setDirection] = useState<"ltr" | "rtl">(locale === "ar" ? "rtl" : "ltr");

  // Keep direction in sync if locale prop changes
  React.useEffect(() => {
    setDirection(locale === "ar" ? "rtl" : "ltr");
  }, [locale]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Viewport Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-100 p-2 rounded-xl text-xs">
        <div className="flex items-center gap-2 font-semibold text-zinc-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Visual Renderer</span>
          {versionNumber !== undefined && (
            <span className="text-zinc-400 font-normal">
              (Snapshot #{versionNumber})
            </span>
          )}
          {locale && (
            <span className="px-1.5 py-0.5 rounded-md bg-zinc-200 text-zinc-700 font-mono text-[10px] uppercase">
              {locale}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* LTR / RTL Direction Toggle */}
          <div className="flex items-center bg-white p-0.5 rounded-lg border border-zinc-200 text-[11px]">
            <button
              type="button"
              onClick={() => setDirection("ltr")}
              className={`px-2 py-0.5 rounded font-medium transition ${
                direction === "ltr"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              LTR
            </button>
            <button
              type="button"
              onClick={() => setDirection("rtl")}
              className={`px-2 py-0.5 rounded font-medium transition ${
                direction === "rtl"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              RTL (العربية)
            </button>
          </div>

          {/* Viewport Buttons */}
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-zinc-200">
            <button
              type="button"
              onClick={() => setViewport("desktop")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
                viewport === "desktop"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setViewport("mobile")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
                viewport === "mobile"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Mobile (375px)
            </button>
          </div>
        </div>
      </div>

      {/* Render Canvas */}
      <div className="flex justify-center bg-zinc-50 border border-zinc-200 rounded-2xl p-4 sm:p-6 min-h-[300px] overflow-x-auto">
        <div
          dir={direction}
          className={`transition-all duration-300 w-full ${
            viewport === "mobile"
              ? "max-w-[375px] rounded-3xl border-8 border-zinc-800 shadow-2xl overflow-hidden bg-white"
              : "w-full"
          }`}
        >
          {type === "HOMEPAGE_BANNER" && (
            <BannerRenderer
              payload={payload}
              viewport={viewport}
              imgError={imgError}
              setImgError={setImgError}
            />
          )}

          {type === "HERO_SECTION" && (
            <HeroSectionRenderer payload={payload} viewport={viewport} />
          )}

          {type === "PROMOTIONAL_CAMPAIGN" && (
            <PromoRenderer payload={payload} viewport={viewport} />
          )}

          {type === "STATIC_PAGE" && (
            <StaticPageRenderer payload={payload} viewport={viewport} />
          )}

          {type === "FAQ_ITEM" && (
            <FaqItemRenderer payload={payload} />
          )}

          {![
            "HOMEPAGE_BANNER",
            "HERO_SECTION",
            "PROMOTIONAL_CAMPAIGN",
            "STATIC_PAGE",
            "FAQ_ITEM",
          ].includes(type) && (
            <GenericRenderer type={type} payload={payload} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Renderers
// ─────────────────────────────────────────────────────────────────────────────

function BannerRenderer({
  payload,
  viewport,
  imgError,
  setImgError,
}: {
  payload: Record<string, any>;
  viewport: "desktop" | "mobile";
  imgError: boolean;
  setImgError: (err: boolean) => void;
}) {
  const title = payload.title || "Banner Headline";
  const description = payload.description || "";
  const imageUrl = payload.imageUrl || "/images/home/hero-banner.png";
  const buttonText = payload.buttonText || "Explore Now";
  const linkUrl = payload.linkUrl || "#";
  const backgroundColor = payload.backgroundColor || "#1F1F1F";
  const textColor = payload.textColor || "#FFFFFF";

  return (
    <div
      className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-md transition"
      style={{ backgroundColor, color: textColor }}
    >
      {/* Background Graphic / Image */}
      {imageUrl && !imgError && (
        <div className="absolute inset-0 z-0 opacity-40 mix-blend-overlay pointer-events-none">
          <img
            src={imageUrl}
            alt={title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center"
          />
        </div>
      )}

      {/* Content Layout */}
      <div
        className={`relative z-10 flex ${
          viewport === "mobile"
            ? "flex-col p-6 text-center items-center gap-4"
            : "flex-col md:flex-row items-center justify-between p-8 sm:p-12 gap-8"
        }`}
      >
        <div className={`space-y-3 ${viewport === "mobile" ? "w-full" : "max-w-xl"}`}>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-white/10 backdrop-blur-xs border border-white/10">
            Featured Highlight
          </div>

          <h2
            className={`font-extrabold tracking-tight leading-tight ${
              viewport === "mobile" ? "text-xl" : "text-2xl sm:text-3xl lg:text-4xl"
            }`}
            style={{ color: textColor }}
          >
            {title}
          </h2>

          {description && (
            <p
              className={`leading-relaxed opacity-90 ${
                viewport === "mobile" ? "text-xs" : "text-sm sm:text-base"
              }`}
            >
              {description}
            </p>
          )}

          {linkUrl && linkUrl !== "#" && (
            <div className="text-[11px] opacity-70 font-mono">
              Destination: {linkUrl}
            </div>
          )}
        </div>

        {/* CTA Button */}
        {buttonText && (
          <div className="shrink-0">
            <span
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold text-sm shadow-md transition transform hover:scale-105"
              style={{
                backgroundColor: textColor === "#FFFFFF" || textColor === "#ffffff" ? "#FFFFFF" : "#1F1F1F",
                color: textColor === "#FFFFFF" || textColor === "#ffffff" ? "#1F1F1F" : "#FFFFFF",
              }}
            >
              {buttonText}
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
          </div>
        )}
      </div>

      {imgError && (
        <div className="absolute top-2 right-2 bg-amber-500/80 text-white text-[10px] px-2 py-0.5 rounded-md backdrop-blur-xs">
          Image preview unavailable
        </div>
      )}
    </div>
  );
}

function HeroSectionRenderer({
  payload,
  viewport,
}: {
  payload: Record<string, any>;
  viewport: "desktop" | "mobile";
}) {
  const heading = payload.heading || "Find your next perfect stay";
  const subheading = payload.subheading || "";
  const bg = payload.backgroundImageUrl || "/images/home/hero.png";

  return (
    <div className="relative rounded-3xl overflow-hidden min-h-[300px] flex items-center justify-center p-6 text-white text-center bg-zinc-900">
      <div className="absolute inset-0 z-0 opacity-60">
        <img src={bg} alt="Hero" className="w-full h-full object-cover" />
      </div>
      <div className="relative z-10 max-w-lg space-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold">{heading}</h1>
        {subheading && <p className="text-xs sm:text-sm text-zinc-200">{subheading}</p>}
        {payload.showSearchBar && (
          <div className="bg-white/95 rounded-full p-2 max-w-sm mx-auto shadow-lg flex items-center justify-between text-xs text-zinc-400 px-4">
            <span>Anywhere • Any week • Add guests</span>
            <span className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold">
              🔍
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PromoRenderer({
  payload,
  viewport,
}: {
  payload: Record<string, any>;
  viewport: "desktop" | "mobile";
}) {
  return (
    <div className="border border-amber-200 bg-amber-50 rounded-2xl p-6 space-y-3">
      <div className="flex items-center justify-between">
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white uppercase">
          {payload.discountPercent ? `${payload.discountPercent}% OFF` : "PROMOTION"}
        </span>
        {payload.promoCode && (
          <span className="font-mono text-xs font-bold text-amber-900 bg-amber-200/60 px-2 py-0.5 rounded">
            CODE: {payload.promoCode}
          </span>
        )}
      </div>
      <h3 className="text-lg font-bold text-zinc-900">{payload.headline || payload.campaignName}</h3>
      {payload.subheadline && <p className="text-xs text-zinc-600">{payload.subheadline}</p>}
      <button type="button" className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-semibold">
        {payload.ctaText || "Book Now"}
      </button>
    </div>
  );
}

function StaticPageRenderer({ payload }: { payload: Record<string, any> }) {
  return (
    <div className="bg-white rounded-2xl p-6 space-y-4 border border-zinc-200">
      <div className="border-b border-zinc-100 pb-3">
        <h2 className="text-xl font-bold text-zinc-900">{payload.heroTitle || "Page Title"}</h2>
        {payload.heroSubtitle && <p className="text-xs text-zinc-500 mt-1">{payload.heroSubtitle}</p>}
      </div>
      {Array.isArray(payload.sections) && payload.sections.length > 0 && (
        <div className="space-y-3">
          {payload.sections.map((s: any, idx: number) => (
            <div key={idx} className="space-y-1">
              <h4 className="font-bold text-sm text-zinc-800">{s.title}</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FaqItemRenderer({ payload }: { payload: Record<string, any> }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-zinc-200 rounded-xl p-4 bg-white space-y-2">
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between cursor-pointer font-bold text-sm text-zinc-900"
      >
        <span>{payload.question || "Frequently Asked Question"}</span>
        <span>{open ? "−" : "+"}</span>
      </div>
      {open && (
        <div className="text-xs text-zinc-600 pt-2 border-t border-zinc-100 leading-relaxed">
          {payload.answer}
        </div>
      )}
    </div>
  );
}

function GenericRenderer({
  type,
  payload,
}: {
  type: string;
  payload: Record<string, any>;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-zinc-200 space-y-3">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-700 uppercase">
          {type}
        </span>
        <span className="text-xs text-zinc-500">Live preview structured attributes</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {Object.entries(payload).map(([k, v]) => (
          <div key={k} className="p-2 bg-zinc-50 rounded-lg border border-zinc-100">
            <span className="font-semibold text-zinc-500 block text-[10px]">{k}</span>
            <span className="text-zinc-800 truncate block">
              {typeof v === "object" ? JSON.stringify(v) : String(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

