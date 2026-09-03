"use client";

import React from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="w-full border-t border-[var(--border)] bg-[var(--surface-secondary)]/60 text-[var(--foreground)] transition-colors mt-auto">
      <Container className="py-12">
        {/* Columns Grid matching Reference Screenshot */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 relative">
          {/* Column 1: Support */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold tracking-wider text-[var(--foreground)] uppercase">
              Support
            </h4>
            <ul className="flex flex-col gap-2.5 text-xs text-[var(--muted-foreground)]">
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Get help with a safety issue
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Disability support
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Cancellation options
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Report neighborhood concern
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Hosting */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold tracking-wider text-[var(--foreground)] uppercase">
              Hosting
            </h4>
            <ul className="flex flex-col gap-2.5 text-xs text-[var(--muted-foreground)]">
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Homyz your home
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Homyz your experience
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Homyz your service
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Homyz for Hosts
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Hosting resources
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Community forum
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Hosting responsibly
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Find a co-host
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Homyz */}
          <div className="flex flex-col gap-3 relative">
            <h4 className="text-xs font-bold tracking-wider text-[var(--foreground)] uppercase">
              Homyz
            </h4>
            <ul className="flex flex-col gap-2.5 text-xs text-[var(--muted-foreground)]">
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  2025 Summer Release
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Newsroom
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Investors
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Gift cards
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--foreground)] hover:underline transition-colors">
                  Homyz.com emergency stays
                </Link>
              </li>
            </ul>

            {/* Back-to-Top Floating Yellow Circle Button matching screenshot */}
            <button
              type="button"
              onClick={scrollToTop}
              title="Scroll to top"
              aria-label="Scroll to top"
              className="brush-back-to-top-border absolute top-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-[#FBDE9B] text-[#291E05] hover:scale-110 transition-transform shadow-2xs dark:bg-[#f59e0b] dark:text-zinc-950"
            >
              <svg className="w-4 h-4 fill-current stroke-current" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Divider & Bottom Section */}
        <div className="mt-12 border-t border-[var(--border)] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--muted-foreground)]">
          <div className="flex flex-wrap items-center gap-4">
            <span>© 2026 Homyz, Inc.</span>
            <span>·</span>
            <Link href="#" className="hover:underline">Privacy</Link>
            <span>·</span>
            <Link href="#" className="hover:underline">Terms</Link>
            <span>·</span>
            <Link href="#" className="hover:underline">Sitemap</Link>
          </div>

          {/* Social Icons matching screenshot */}
          <div className="flex items-center gap-4">
            <a href="#" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors" aria-label="Facebook">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            <a href="#" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors" aria-label="Twitter">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.936 9.936 0 0024 4.59z"/>
              </svg>
            </a>
            <a href="#" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors" aria-label="Instagram">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
