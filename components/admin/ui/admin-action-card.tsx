import React from "react";
import Link from "next/link";

export type ActionSeverity = "critical" | "urgent" | "attention" | "all-clear";

interface AdminActionCardProps {
  title: string;
  count: number;
  description?: string;
  href: string;
  icon?: React.ReactNode;
  severity?: ActionSeverity;
  actionLabel?: string;
  className?: string;
}

const severityConfig: Record<
  ActionSeverity,
  { badge: string; bg: string; text: string; border: string }
> = {
  critical: {
    badge: "Critical",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200/70",
  },
  urgent: {
    badge: "Urgent",
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200/70",
  },
  attention: {
    badge: "Action required",
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200/70",
  },
  "all-clear": {
    badge: "All clear",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200/70",
  },
};

const defaultActionIcon = (
  <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

export function AdminActionCard({
  title,
  count,
  description,
  href,
  icon = defaultActionIcon,
  severity,
  actionLabel,
  className = "",
}: AdminActionCardProps) {
  const effectiveSeverity: ActionSeverity =
    severity || (count === 0 ? "all-clear" : count > 5 ? "urgent" : "attention");

  const config = severityConfig[effectiveSeverity];

  return (
    <Link
      href={href}
      className={`group relative flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-2xs transition-all hover:border-zinc-300 hover:shadow-xs ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-amber-50 group-hover:text-amber-700">
          {icon}
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.bg} ${config.text} ${config.border}`}
        >
          {config.badge}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-medium tracking-tight text-zinc-900">
            {count}
          </span>
          <span className="text-xs font-medium text-zinc-700 group-hover:text-amber-700 transition-colors truncate">
            {title}
          </span>
        </div>
        <p className="mt-1 text-xs font-normal text-zinc-500 leading-tight">
          {description}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-zinc-600 group-hover:text-amber-700 transition-colors pt-2 border-t border-zinc-100">
        <span>Review now</span>
        <svg
          className="size-3.5 transition-transform group-hover:translate-x-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  );
}

