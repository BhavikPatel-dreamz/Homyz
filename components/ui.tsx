import type { ReactNode } from "react";

export { Button, primaryButtonInteractionClass } from "./ui/button";
export type { ButtonProps, ButtonVariant } from "./ui/button";
export { Container } from "./ui/container";
export type { ContainerProps } from "./ui/container";

// Presentational primitives shared by web pages. Homyz design system tokens.

export const inputClass =
  "brush-border w-full rounded-2xl border bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none transition-colors";

export const labelClass =
  "block text-xs font-semibold text-[var(--foreground)] mb-1";

export const buttonClass =
  "brush-button-border inline-flex items-center justify-center rounded-full border bg-[#FBDE9B] hover:bg-[#F7D37E] px-5 py-2.5 text-xs font-bold text-[#291E05] transition-all shadow-2xs disabled:opacity-50 dark:bg-[#f59e0b] dark:text-zinc-950 hover:scale-102 active:scale-98 cursor-pointer";

export const secondaryButtonClass =
  "brush-button-border inline-flex items-center justify-center rounded-full border bg-[var(--surface)] px-5 py-2.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors disabled:opacity-50 cursor-pointer shadow-2xs";

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
  tone?: "error" | "success" | "warning" | "info";
  children: ReactNode;
}) {
  const tones = {
    error: "border-rose-300/80 bg-rose-50/90 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60",
    success: "border-emerald-300/80 bg-emerald-50/90 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60",
    warning: "border-amber-300/80 bg-amber-50/90 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60",
    info: "border-sky-300/80 bg-sky-50/90 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60",
  };
  return (
    <div className={`rounded-lg w-full max-w-[483px] border px-4 py-3 text-xs font-normal ${tones[tone]}`}>
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
