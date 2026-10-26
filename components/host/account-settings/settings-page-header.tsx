import React from "react";
import Link from "next/link";
import { ArrowLeftIcon, ChevronRightIcon } from "./icons";
import { SettingsStatusBadge, type BadgeVariant } from "./settings-status-badge";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface SettingsPageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  breadcrumbs?: BreadcrumbItem[];
  badge?: string;
  badgeVariant?: BadgeVariant;
  actions?: React.ReactNode;
  className?: string;
}

export function SettingsPageHeader({
  title,
  subtitle,
  backHref = "/host/account-settings",
  backLabel = "Host Account Settings",
  breadcrumbs,
  badge,
  badgeVariant = "neutral",
  actions,
  className = "",
}: SettingsPageHeaderProps) {
  return (
    <header className={`mb-8 border-b border-zinc-200/80 pb-6 ${className}`}>
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumbs" className="mb-4 flex items-center gap-1.5 text-xs text-zinc-500">
        <Link
          href="/host/account-settings"
          className="hover:text-zinc-900 transition-colors focus-visible:outline-none focus-visible:underline"
        >
          Host Account Settings
        </Link>
        {breadcrumbs &&
          breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.label + idx}>
              <ChevronRightIcon size={14} className="text-zinc-400 shrink-0" />
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-zinc-900 transition-colors focus-visible:outline-none focus-visible:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-zinc-800" aria-current="page">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
      </nav>

      {/* Mobile Back Button */}
      {backHref && (
        <div className="mb-3 block sm:hidden">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-950 transition-colors"
          >
            <ArrowLeftIcon size={16} />
            <span>{backLabel}</span>
          </Link>
        </div>
      )}

      {/* Main Title Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#1F1F1F] sm:text-3xl">
              {title}
            </h1>
            {badge && (
              <SettingsStatusBadge label={badge} variant={badgeVariant} dot />
            )}
          </div>
          {subtitle && (
            <p className="mt-1.5 text-sm text-[#727272] sm:text-base max-w-3xl">
              {subtitle}
            </p>
          )}
        </div>

        {actions && <div className="shrink-0 flex items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}

