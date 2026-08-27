import type { ReactNode } from "react";

// Presentational primitives shared by web pages. Homyz design system tokens.

export const inputClass =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none transition-colors focus:border-[var(--muted-foreground)]";

export const labelClass =
  "block text-xs font-semibold text-[var(--foreground)] mb-1";

export const buttonClass =
  "inline-flex items-center justify-center rounded-full bg-[#FBDE9B] hover:bg-[#F7D37E] px-5 py-2.5 text-xs font-bold text-[#291E05] transition-all shadow-2xs disabled:opacity-50 dark:bg-[#f59e0b] dark:text-zinc-950 hover:scale-102 active:scale-98 cursor-pointer";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-50 cursor-pointer shadow-2xs";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xs text-[var(--card-foreground)] transition-colors ${className}`}
    >
      {children}
    </div>
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: ReactNode;
}) {
  const tones = {
    error: "border-[var(--error)]/30 bg-[var(--error)]/10 text-[var(--error)]",
    success: "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 text-xs font-medium ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-3 py-0.5 text-[11px] font-extrabold text-[var(--accent-foreground)] shadow-2xs">
      {children}
    </span>
  );
}
