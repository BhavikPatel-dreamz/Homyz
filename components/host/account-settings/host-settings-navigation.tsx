"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCardIcon,
  ReceiptTaxIcon,
  BarChartReportsIcon,
  ChevronRightIcon,
} from "./icons";

export interface NavItemConfig {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  description?: string;
  exact?: boolean;
}

export const HOST_SETTINGS_NAV_ITEMS: NavItemConfig[] = [
  {
    id: "payouts",
    label: "Payout Settings",
    href: "/host/account-settings/payouts",
    icon: <CreditCardIcon size={18} />,
    description: "Bank accounts & payout routing",
  },
  {
    id: "taxes",
    label: "Tax Information",
    href: "/host/account-settings/taxes",
    icon: <ReceiptTaxIcon size={18} />,
    description: "Taxpayers & VAT documents",
  },
  {
    id: "reports",
    label: "Earnings Reports",
    href: "/host/account-settings/earnings-reports",
    icon: <BarChartReportsIcon size={18} />,
    description: "Monthly & annual statements",
  },
];

export interface HostSettingsNavigationProps {
  className?: string;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}

export function HostSettingsNavigation({
  className = "",
  mobileOnly = false,
  desktopOnly = false,
}: HostSettingsNavigationProps) {
  const pathname = usePathname();

  const isItemActive = (item: NavItemConfig) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname?.startsWith(`${item.href}/`);
  };

  return (
    <>
      {/* Mobile Horizontal Pill Navigation (Visible below sm breakpoint) */}
      {!desktopOnly && (
        <nav
          aria-label="Host settings tabs"
          className={`flex sm:hidden overflow-x-auto pb-2 pt-1 scrollbar-none gap-2 px-1 -mx-4 ${className}`}
        >
          {HOST_SETTINGS_NAV_ITEMS.map((item) => {
            const active = isItemActive(item);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-all ${
                  active
                    ? "bg-[#1F1F1F] text-white shadow-xs"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* Desktop Vertical Sidebar Navigation */}
      {!mobileOnly && (
        <nav
          aria-label="Host settings menu"
          className={`hidden sm:flex flex-col gap-1 rounded-3xl border border-zinc-200/80 bg-white p-3 shadow-xs ${className}`}
        >
          <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Account Navigation
          </div>
          {HOST_SETTINGS_NAV_ITEMS.map((item) => {
            const active = isItemActive(item);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`group flex items-center justify-between rounded-2xl px-3.5 py-3 text-sm transition-all ${
                  active
                    ? "bg-amber-100/90 font-medium text-[#1F1F1F] shadow-2xs"
                    : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 font-normal"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      active
                        ? "bg-white text-zinc-950 shadow-2xs"
                        : "bg-zinc-100 text-zinc-600 group-hover:bg-white"
                    }`}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0 truncate">
                    <p className="truncate text-sm leading-tight">{item.label}</p>
                    {item.description && (
                      <p className="truncate text-[11px] text-zinc-500 mt-0.5 font-normal">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                <ChevronRightIcon
                  size={16}
                  className={`shrink-0 text-zinc-400 transition-transform ${
                    active ? "text-zinc-900 translate-x-0.5" : "group-hover:translate-x-0.5"
                  }`}
                />
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}

