"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";

const items = [
  { href: "/", labelKey: "home_explore", fallback: "Explore", icon: "search" },
  { href: "/profile/tab/saved", labelKey: "header_wishlist", fallback: "Wishlists", icon: "heart" },
  { href: "/profile/tab/upcoming", labelKey: "header_trips", fallback: "Trips", icon: "trip" },
  { href: "/messages", labelKey: "header_messages", fallback: "Messages", icon: "message" },
  { href: "/profile", labelKey: "header_profile", fallback: "Profile", icon: "profile" },
] as const;

function NavIcon({ icon }: { icon: (typeof items)[number]["icon"] }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, className: "size-5 shrink-0" };
  if (icon === "heart") {
    return (
      <svg {...common}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }
  if (icon === "trip") {
    return (
      <svg viewBox="0 0 32 32" fill="currentColor" className="size-5.5 shrink-0">
        <path d="M16 1c2.008 0 3.463.963 4.751 3.269l.533 1.025c1.954 3.83 4.114 8.71 4.57 11.854.498 3.435-.494 6.703-2.723 8.974-2.19 2.23-5.228 3.378-8.555 3.232-3.327-.146-6.27-1.554-8.291-3.967-1.99-2.378-2.716-5.698-1.99-9.088.665-3.097 2.67-7.904 4.542-11.696l.542-1.072C10.686 2.023 12.164 1 14.184 1H16zm0 2.2c-1.385 0-2.348.65-3.32 2.458l-.48 1.011C10.384 10.375 8.44 15.045 7.82 17.935c-.569 2.65-.015 5.227 1.536 7.081 1.574 1.88 3.864 2.973 6.452 3.087 2.593.114 4.953-.78 6.647-2.506 1.745-1.778 2.518-4.323 2.128-7.012-.416-2.87-2.482-7.585-4.354-11.253l-.471-.979C18.775 3.86 17.82 3.2 16.438 3.2H16zm.116 11.8c2.812 0 5.091 2.298 5.091 5.132 0 2.835-2.28 5.133-5.091 5.133-2.813 0-5.093-2.298-5.093-5.133 0-2.834 2.28-5.132 5.093-5.132zm0 2.2c-1.6 0-2.893 1.312-2.893 2.932 0 1.62 1.293 2.933 2.893 2.933 1.6 0 2.891-1.313 2.891-2.933 0-1.62-1.292-2.932-2.891-2.932z" />
      </svg>
    );
  }
  if (icon === "message") {
    return (
      <svg {...common}>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    );
  }
  if (icon === "profile") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="10" r="3" />
        <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(65px+env(safe-area-inset-bottom))] border-t border-zinc-200/90 bg-white px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.04)] lg:hidden"
    >
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/" || pathname?.startsWith("/listings")
            : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] transition-colors ${
              active ? "font-medium text-[#E00B41]" : "font-normal text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <NavIcon icon={item.icon} />
            <span className="truncate">{t(item.labelKey, item.fallback)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
