import React from "react";
import Link from "next/link";
import { ChevronRightIcon, ExternalLinkIcon } from "./icons";
import { SettingsStatusBadge, type BadgeVariant } from "./settings-status-badge";

export interface SettingsSectionCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  badgeVariant?: BadgeVariant;
  external?: boolean;
  disabled?: boolean;
  footerNote?: string;
  actionLabel?: string;
  className?: string;
}

export function SettingsSectionCard({
  title,
  description,
  href,
  icon,
  badge,
  badgeVariant = "neutral",
  external = false,
  disabled = false,
  footerNote,
  actionLabel,
  className = "",
}: SettingsSectionCardProps) {
  const content = (
    <div
      className={`relative flex h-full flex-col justify-between rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-xs transition-all duration-200 sm:p-7 ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md focus-within:ring-2 focus-within:ring-zinc-950 focus-within:ring-offset-2"
      } ${className}`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-100/90 text-[#1F1F1F] transition-colors group-hover:bg-[#FCDF9C]/40">
            {icon}
          </div>
          {badge && (
            <SettingsStatusBadge label={badge} variant={badgeVariant} dot />
          )}
        </div>

        <div className="mt-5">
          <h2 className="text-lg font-semibold tracking-tight text-[#1F1F1F] group-hover:text-black">
            {title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#727272]">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4">
        {footerNote ? (
          <span className="text-xs text-zinc-500">{footerNote}</span>
        ) : (
          <span className="text-xs font-medium text-zinc-600 group-hover:text-zinc-900">
            {actionLabel || "Manage settings"}
          </span>
        )}
        <div className="flex items-center gap-1 text-xs font-medium text-zinc-600 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-zinc-900">
          {actionLabel && <span>{actionLabel}</span>}
          {external ? <ExternalLinkIcon size={18} /> : <ChevronRightIcon size={18} />}
        </div>
      </div>
    </div>
  );

  if (disabled) {
    return <div className="group block h-full">{content}</div>;
  }

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group block h-full outline-none"
        aria-label={`${title}: ${description} (opens in new tab)`}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className="group block h-full outline-none"
      aria-label={`${title}: ${description}`}
    >
      {content}
    </Link>
  );
}

