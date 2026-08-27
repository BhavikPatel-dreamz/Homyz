"use client";

export function AuthFooter() {
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <footer className="w-full bg-[#F3F4F5] border-t border-zinc-200 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Support */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900">
                Support
              </h3>
              <button
                type="button"
                onClick={scrollToTop}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FBDE9B] text-zinc-900 hover:bg-[#F3D382] transition-colors md:hidden"
                aria-label="Back to top"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>
            <ul className="mt-4 space-y-2.5 text-xs text-zinc-600">
              <li><a href="#" className="hover:underline">Help Center</a></li>
              <li><a href="#" className="hover:underline">Get help with a safety issue</a></li>
              <li><a href="#" className="hover:underline">Disability support</a></li>
              <li><a href="#" className="hover:underline">Cancellation options</a></li>
              <li><a href="#" className="hover:underline">Report neighborhood concern</a></li>
            </ul>
          </div>

          {/* Hosting */}
          <div>
            <h3 className="text-sm font-bold text-zinc-900">
              Hosting
            </h3>
            <ul className="mt-4 space-y-2.5 text-xs text-zinc-600">
              <li><a href="#" className="hover:underline">Homyz your home</a></li>
              <li><a href="#" className="hover:underline">Homyz your experience</a></li>
              <li><a href="#" className="hover:underline">Homyz your service</a></li>
              <li><a href="#" className="hover:underline">Homyz for Hosts</a></li>
              <li><a href="#" className="hover:underline">Hosting resources</a></li>
              <li><a href="#" className="hover:underline">Community forum</a></li>
              <li><a href="#" className="hover:underline">Hosting responsibly</a></li>
              <li><a href="#" className="hover:underline">Find a co-host</a></li>
            </ul>
          </div>

          {/* Homyz */}
          <div className="relative">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900">
                Homyz
              </h3>
              <button
                type="button"
                onClick={scrollToTop}
                className="hidden md:flex h-7 w-7 items-center justify-center rounded-full bg-[#FBDE9B] text-zinc-900 hover:bg-[#F3D382] transition-colors"
                aria-label="Back to top"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>
            <ul className="mt-4 space-y-2.5 text-xs text-zinc-600">
              <li><a href="#" className="hover:underline">2025 Summer Release</a></li>
              <li><a href="#" className="hover:underline">Newsroom</a></li>
              <li><a href="#" className="hover:underline">Careers</a></li>
              <li><a href="#" className="hover:underline">Investors</a></li>
              <li><a href="#" className="hover:underline">Gift cards</a></li>
              <li><a href="#" className="hover:underline">Homyz.com emergency stays</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom divider and copyright */}
        <div className="mt-12 border-t border-zinc-200 pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-zinc-600">
              {/* Facebook */}
              <a href="#" className="hover:text-zinc-900" aria-label="Facebook">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
                </svg>
              </a>
              {/* Twitter/X */}
              <a href="#" className="hover:text-zinc-900" aria-label="Twitter">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              {/* Instagram */}
              <a href="#" className="hover:text-zinc-900" aria-label="Instagram">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
            </div>

            <p className="text-xs text-zinc-500">
              © 2026 Homyz, Inc.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
