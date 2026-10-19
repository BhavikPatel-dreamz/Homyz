"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { useLanguage } from "@/lib/i18n/language-context";
import type { FooterConfigPayload } from "@/lib/cms/content-types";

// High-quality baseline fallback configuration with 0 broken links
const DEFAULT_FALLBACK_FOOTER: FooterConfigPayload = {
  columns: [
    {
      id: "col-support",
      title: "Support",
      displayOrder: 1,
      enabled: true,
      links: [
        { id: "lnk-help", label: "Help Center", href: "/help", enabled: true, displayOrder: 1 },
        { id: "lnk-safety", label: "Get help with a safety issue", href: "/safety", targetPageSlug: "safety", enabled: true, displayOrder: 2 },
        { id: "lnk-disability", label: "Disability support", href: "/accessibility", targetPageSlug: "accessibility", enabled: true, displayOrder: 3 },
        { id: "lnk-cancellation", label: "Cancellation options", href: "/cancellation-policy", targetPageSlug: "cancellation-policy", enabled: true, displayOrder: 4 },
        { id: "lnk-report", label: "Report neighborhood concern", href: "/anti-discrimination", targetPageSlug: "anti-discrimination", enabled: true, displayOrder: 5 },
      ],
    },
    {
      id: "col-hosting",
      title: "Hosting",
      displayOrder: 2,
      enabled: true,
      links: [
        { id: "lnk-homyz-home", label: "Homyz your home", href: "/become-a-host", enabled: true, displayOrder: 1 },
        { id: "lnk-homyz-exp", label: "Homyz your experience", href: "/hosting-resources", targetPageSlug: "hosting-resources", enabled: true, displayOrder: 2 },
        { id: "lnk-homyz-srv", label: "Homyz your service", href: "/hosting-responsibly", targetPageSlug: "hosting-responsibly", enabled: true, displayOrder: 3 },
        { id: "lnk-for-hosts", label: "Homyz for Hosts", href: "/host/onboarding", enabled: true, displayOrder: 4 },
        { id: "lnk-hosting-res", label: "Hosting resources", href: "/hosting-resources", targetPageSlug: "hosting-resources", enabled: true, displayOrder: 5 },
        { id: "lnk-hosting-resp", label: "Hosting responsibly", href: "/hosting-responsibly", targetPageSlug: "hosting-responsibly", enabled: true, displayOrder: 6 },
        { id: "lnk-find-cohost", label: "Find a co-host", href: "/host/co-host", enabled: true, displayOrder: 7 },
      ],
    },
    {
      id: "col-homyz",
      title: "Homyz",
      displayOrder: 3,
      enabled: true,
      links: [
        { id: "lnk-newsroom", label: "Newsroom", href: "/newsroom", targetPageSlug: "newsroom", enabled: true, displayOrder: 1 },
        { id: "lnk-careers", label: "Careers", href: "/careers", targetPageSlug: "careers", enabled: true, displayOrder: 2 },
        { id: "lnk-about", label: "About Us", href: "/about", targetPageSlug: "about", enabled: true, displayOrder: 3 },
        { id: "lnk-giftcards", label: "Gift cards", href: "/giftcards", enabled: true, displayOrder: 4 },
        { id: "lnk-contact", label: "Contact Us", href: "/contact", targetPageSlug: "contact", enabled: true, displayOrder: 5 },
      ],
    },
  ],
  socialLinks: [
    { id: "soc-fb", platform: "facebook", url: "https://facebook.com", enabled: true, displayOrder: 1 },
    { id: "soc-tw", platform: "twitter", url: "https://twitter.com", enabled: true, displayOrder: 2 },
    { id: "soc-ig", platform: "instagram", url: "https://instagram.com", enabled: true, displayOrder: 3 },
  ],
  bottomLinks: [
    { id: "bot-privacy", label: "Privacy", href: "/privacy", targetPageSlug: "privacy", enabled: true, displayOrder: 1 },
    { id: "bot-terms", label: "Terms", href: "/terms", targetPageSlug: "terms", enabled: true, displayOrder: 2 },
    { id: "bot-cookies", label: "Cookies", href: "/cookies", targetPageSlug: "cookies", enabled: true, displayOrder: 3 },
  ],
  copyrightNotice: "© 2026 Homyz, Inc.",
  legalNotice: "",
  showBackToTop: true,
  showSocialIcons: true,
  appearance: {
    backgroundColor: "#F3F4F5",
    textColor: "#000000",
    mutedTextColor: "#727272",
    borderColor: "rgba(31,31,31,0.9)",
    accentColor: "#FCDF9C",
  },
};

export function Footer() {
  const { t, language } = useLanguage();
  const [footerConfig, setFooterConfig] = useState<FooterConfigPayload>(DEFAULT_FALLBACK_FOOTER);

  useEffect(() => {
    let isMounted = true;
    async function loadFooter() {
      try {
        const res = await fetch(`/api/v1/cms/footer?locale=${language}`);
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json;
          if (isMounted && data && Array.isArray(data.columns) && data.columns.length > 0) {
            setFooterConfig(data);
          }
        }
      } catch (err) {
        console.warn("[Footer] Could not fetch dynamic footer config, using baseline fallback:", err);
      }
    }

    loadFooter();
    return () => {
      isMounted = false;
    };
  }, [language]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const visibleColumns = (footerConfig.columns || [])
    .filter((col) => col.enabled !== false)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const visibleSocialLinks = (footerConfig.socialLinks || [])
    .filter((s) => s.enabled !== false)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const visibleBottomLinks = (footerConfig.bottomLinks || [])
    .filter((b) => b.enabled !== false)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const renderSocialIcon = (platform: string) => {
    const p = platform.toLowerCase();
    switch (p) {
      case "facebook":
        return (
          <svg className="w-6 h-6 fill-[#1F1F1F] hover:fill-[#727272] transition-all duration-300 ease-in-out" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        );
      case "twitter":
      case "x":
        return (
          <svg className="w-6 h-6 fill-[#1F1F1F] hover:fill-[#727272] transition-all duration-300 ease-in-out" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        );
      case "instagram":
        return (
          <svg className="w-6 h-6 fill-[#1F1F1F] hover:fill-[#727272] transition-all duration-300 ease-in-out" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        );
      case "linkedin":
        return (
          <svg className="w-6 h-6 fill-[#1F1F1F] hover:fill-[#727272] transition-all duration-300 ease-in-out" viewBox="0 0 24 24">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
          </svg>
        );
      case "youtube":
        return (
          <svg className="w-6 h-6 fill-[#1F1F1F] hover:fill-[#727272] transition-all duration-300 ease-in-out" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6 fill-[#1F1F1F] hover:fill-[#727272] transition-all duration-300 ease-in-out" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
    }
  };

  return (
    <footer
      className="footer mt-auto w-full transition-colors"
      style={{
        backgroundColor: footerConfig.appearance?.backgroundColor || "#F3F4F5",
        color: footerConfig.appearance?.textColor || "#000000",
      }}
    >
      <Container>
        <div
          className="pt-8 sm:pt-12 pb-6"
          style={{
            borderTop: `1px solid ${footerConfig.appearance?.borderColor || "rgba(31,31,31,0.9)"}`,
          }}
        >
          {/* Columns Grid */}
          <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3">
            {footerConfig.showBackToTop !== false && (
              <button
                type="button"
                onClick={scrollToTop}
                aria-label={t("footer_scroll_to_top", "Scroll to top")}
                className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-[#D8B86F] bg-[#FCDF9C] text-[#727272] sm:hidden"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 15 6-6 6 6" />
                </svg>
              </button>
            )}

            {visibleColumns.map((col, idx) => {
              const colLinks = (col.links || [])
                .filter((lnk) => lnk.enabled !== false)
                .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

              const isLastColumn = idx === visibleColumns.length - 1;

              return (
                <div key={col.id || `col-${idx}`} className="flex flex-col">
                  <h4 className="lg:text-lg text-base font-medium text-[#1F1F1F] lg:mb-6 mb-5">
                    {col.title}
                  </h4>
                  <ul className="flex flex-col space-y-3">
                    {colLinks.map((link) => (
                      <li key={link.id || link.href}>
                        <Link
                          href={link.href}
                          target={link.openInNewTab ? "_blank" : undefined}
                          rel={link.openInNewTab ? "noopener noreferrer" : undefined}
                          className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3 inline-flex items-center gap-1.5"
                        >
                          <span>{link.label}</span>
                          {link.badge && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-800 no-underline">
                              {link.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {/* If this is the last column, render Social Icons and Floating Desktop Back-to-Top button */}
                  {isLastColumn && (
                    <>
                      {footerConfig.showSocialIcons !== false && visibleSocialLinks.length > 0 && (
                        <div className="inline-flex items-center w-max max-w-auto space-x-6 mt-9 pt-4 border-t-2 border-[#1f1f1f]">
                          {visibleSocialLinks.map((social) => (
                            <a
                              key={social.id || social.platform}
                              href={social.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--muted-foreground)] hover:text-muted-foreground transition-colors"
                              aria-label={social.label || social.platform}
                            >
                              {renderSocialIcon(social.platform)}
                            </a>
                          ))}
                        </div>
                      )}

                      {footerConfig.showBackToTop !== false && (
                        <button
                          type="button"
                          onClick={scrollToTop}
                          title={t("footer_scroll_to_top", "Scroll to top")}
                          aria-label={t("footer_scroll_to_top", "Scroll to top")}
                          className="absolute top-0 right-0 hidden h-8 w-8 items-center justify-center rounded-full bg-[#FCDF9C] hover:bg-[#F3F4F5] border border-transparent hover:border-[#1F1F1F] text-[#291E05] transition-transform sm:flex dark:bg-[#f59e0b] dark:text-[#1F1F1F] transition-colors"
                        >
                          <svg
                            aria-hidden="true"
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#1F1F1F"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m18 15-6-6-6 6" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider & Bottom Section */}
          <div className="flex flex-col-reverse items-start justify-between gap-5 pt-6 lg:text-base text-sm sm:flex-row sm:items-center sm:gap-4 sm:pt-6 text-black font-normal">
            <div className="flex flex-wrap items-center gap-4">
              <span>{footerConfig.copyrightNotice || t("footer_copyright", "© 2026 Homyz, Inc.")}</span>
              {visibleBottomLinks.map((bLink) => (
                <React.Fragment key={bLink.id || bLink.href}>
                  <span className="hidden sm:inline">·</span>
                  <Link
                    href={bLink.href}
                    target={bLink.openInNewTab ? "_blank" : undefined}
                    rel={bLink.openInNewTab ? "noopener noreferrer" : undefined}
                    className="hover:underline"
                  >
                    {bLink.label}
                  </Link>
                </React.Fragment>
              ))}
            </div>
            {footerConfig.legalNotice && (
              <div className="text-xs text-zinc-500">
                {footerConfig.legalNotice}
              </div>
            )}
          </div>
        </div>
      </Container>
    </footer>
  );
}
