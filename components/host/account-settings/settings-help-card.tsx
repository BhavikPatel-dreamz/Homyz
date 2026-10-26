import React from "react";
import Link from "next/link";
import { HelpCircleIcon, ExternalLinkIcon } from "./icons";

export interface HelpLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface SettingsHelpCardProps {
  title: string;
  description: string;
  links?: HelpLink[];
  icon?: React.ReactNode;
  className?: string;
}

export function SettingsHelpCard({
  title,
  description,
  links,
  icon,
  className = "",
}: SettingsHelpCardProps) {
  return (
    <aside
      className={`rounded-3xl border border-zinc-200/90 bg-zinc-50/80 p-5 sm:p-6 text-sm text-[#1F1F1F] ${className}`}
      aria-labelledby="help-card-title"
    >
      <div className="flex items-start gap-3.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-white border border-zinc-200/70 text-zinc-800 shadow-2xs">
          {icon || <HelpCircleIcon size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 id="help-card-title" className="text-sm font-semibold text-[#1F1F1F]">
            {title}
          </h3>
          <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#727272]">
            {description}
          </p>

          {links && links.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-zinc-200/60 pt-3 text-xs font-semibold">
              {links.map((link) => {
                if (link.external) {
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-zinc-900 hover:text-black underline underline-offset-4"
                    >
                      <span>{link.label}</span>
                      <ExternalLinkIcon size={13} className="shrink-0" />
                    </a>
                  );
                }
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="inline-flex items-center gap-1.5 text-zinc-900 hover:text-black underline underline-offset-4"
                  >
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

