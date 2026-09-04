"use client";

import React from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="footer mt-auto w-full bg-[#F3F4F5] text-black transition-colors">
      <Container>
        <div className="border-t border-[rgba(31,31,31,0.9)] pt-8 sm:pt-12 pb-6">
          {/* Columns Grid */}
          <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3">
            <button type="button" onClick={scrollToTop} aria-label="Scroll to top" className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-[#D8B86F] bg-[#FCDF9C] text-[#727272] sm:hidden">
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
            {/* Column 1: Support */}
            <div className="flex flex-col">
              <h4 className="lg:text-lg text-base font-medium text-[#1F1F1F] lg:mb-6 mb-5">
                Support
              </h4>
              <ul className="flex flex-col space-y-3">
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Get help with a safety issue
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Disability support
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Cancellation options
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Report neighborhood concern
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 2: Hosting */}
            <div className="flex flex-col">
              <h4 className="lg:text-lg text-base font-medium text-[#1F1F1F] lg:mb-6 mb-5">
                Hosting
              </h4>
              <ul className="flex flex-col space-y-3">
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Homyz your home
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Homyz your experience
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Homyz your service
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Homyz for Hosts
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Hosting resources
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Community forum
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Hosting responsibly
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Find a co-host
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Homyz */}
            <div className="flex flex-col">
              <h4 className="lg:text-lg text-base font-medium text-[#1F1F1F] lg:mb-6 mb-5">
                Homyz
              </h4>
              <ul className="flex flex-col space-y-3">
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    2025 Summer Release
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Newsroom
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Investors
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Gift cards
                  </Link>
                </li>
                <li>
                  <Link href="#" className="lg:text-base text-sm leading-6 text-[#000000] underline hover:text-[#727272] transition underline-offset-3">
                    Homyz.com emergency stays
                  </Link>
                </li>
              </ul>

              {/* Social Icons matching screenshot */}
              <div className="inline-flex items-center w-max max-w-auto space-x-6 mt-9 pt-4 border-t-2 border-[#1f1f1f]">
                <a href="#" className="text-[var(--muted-foreground)] hover:text-muted-foreground transition-colors" aria-label="Facebook">
                  <svg className="w-6 h-6 fill-[#1F1F1F] hover:fill-[#727272] transition-all duration-300 ease-in-out" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a href="#" className="text-[var(--muted-foreground)] hover:text-muted-foreground transition-colors" aria-label="Twitter">
                  <svg className="w-6 h-6 fill- hover:fill-[#727272] transition-all delay-duration ease-in-out" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.936 9.936 0 0024 4.59z" />
                  </svg>
                </a>
                <a href="#" className="text-[var(--muted-foreground)] hover:text-muted-foreground transition-colors" aria-label="Instagram">
                  <svg className="w-6 h-6 fill-[#1F1F1F] hover:fill-[#727272] transition-all delay-duration ease-in-out" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
              </div>

              {/* Back-to-Top Floating Yellow Circle Button matching screenshot */}
              <button
                type="button"
                onClick={scrollToTop}
                title="Scroll to top"
                aria-label="Scroll to top"
                className="absolute top-0 right-0 hidden h-8 w-8 items-center justify-center rounded-full bg-[#FBDE9B] hover:bg-[#F3F4F5] border border-transparent hover:border-[#1F1F1F] text-[#291E05] transition-transform sm:flex dark:bg-[#f59e0b] dark:text-[#1F1F1F] transition-colors"
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
            </div>
          </div>

          {/* Divider & Bottom Section */}
          <div className="flex flex-col-reverse items-start justify-between gap-5 pt-6 lg:text-base text-sm sm:flex-row sm:items-center sm:gap-4 sm:pt-6 text-black font-normal">
            <div className="flex flex-wrap items-center gap-4">
              <span>© 2026 Homyz, Inc.</span>
              <span className="hidden sm:inline">·</span>
              <Link href="#" className="hidden hover:underline sm:inline">Privacy</Link>
              <span className="hidden sm:inline">·</span>
              <Link href="#" className="hidden hover:underline sm:inline">Terms</Link>
              <span className="hidden sm:inline">·</span>
              <Link href="#" className="hidden hover:underline sm:inline">Sitemap</Link>
            </div>

            
          </div>
        </div>
      </Container>
    </footer>
  );
}
