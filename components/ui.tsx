import type { ReactNode } from "react";

// Presentational primitives shared by web pages. Clean, light Homyz design system.

export const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors focus:border-zinc-900";

export const labelClass =
  "block text-xs font-semibold text-zinc-800";

export const buttonClass =
  "inline-flex items-center justify-center rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] px-5 py-2.5 text-xs font-semibold text-zinc-900 transition-colors shadow-2xs disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs text-zinc-900 ${className}`}
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
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return (
    <div className={`rounded-xl border px-3.5 py-2.5 text-xs ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 border border-zinc-200/60 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-800">
      {children}
    </span>
  );
}
