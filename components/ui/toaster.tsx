"use client";

import React, { useEffect, useState, useRef } from "react";
import { toastManager, ToastItem } from "./toast";

export interface ToasterProps {
  position?:
    | "top-right"
    | "top-left"
    | "top-center"
    | "bottom-right"
    | "bottom-left"
    | "bottom-center";
}

export function Toaster({ position = "top-right" }: ToasterProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toastManager.subscribe(setToasts);
  }, []);

  if (toasts.length === 0) return null;

  const positionClasses = {
    "top-right": "top-4 right-4 sm:top-5 sm:right-5 items-end",
    "top-left": "top-4 left-4 sm:top-5 sm:left-5 items-start",
    "top-center": "top-4 left-1/2 -translate-x-1/2 items-center",
    "bottom-right": "bottom-4 right-4 sm:bottom-5 sm:right-5 items-end",
    "bottom-left": "bottom-4 left-4 sm:bottom-5 sm:left-5 items-start",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center",
  };

  return (
    <div
      aria-label="Notifications"
      className={`fixed z-[99999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0 ${positionClasses[position]}`}
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(item.duration);

  useEffect(() => {
    if (item.duration <= 0) return;

    if (isPaused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, remainingTimeRef.current);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item.duration, item.id, isPaused]);

  function handleMouseEnter() {
    if (item.duration <= 0) return;
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    setIsPaused(true);
  }

  function handleMouseLeave() {
    if (item.duration <= 0) return;
    setIsPaused(false);
  }

  function handleDismiss() {
    setIsLeaving(true);
    setTimeout(() => {
      toastManager.dismiss(item.id);
    }, 200);
  }

  const iconMap = {
    success: (
      <div className="size-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs border border-emerald-200/80 dark:border-emerald-800/80">
        ✓
      </div>
    ),
    error: (
      <div className="size-6 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs border border-rose-200/80 dark:border-rose-800/80">
        ✕
      </div>
    ),
    warning: (
      <div className="size-6 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs border border-amber-200/80 dark:border-amber-800/80">
        !
      </div>
    ),
    info: (
      <div className="size-6 rounded-full bg-amber-100/90 dark:bg-amber-950/80 text-[#1F1F1F] dark:text-[#FEE08B] flex items-center justify-center font-black text-xs shrink-0 shadow-2xs border border-amber-300/80 dark:border-amber-700/80">
        ⓘ
      </div>
    ),
  };

  const borderTone = {
    success:
      "border-l-4 border-l-emerald-500 border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 shadow-xl shadow-emerald-900/5 dark:shadow-black/50",
    error:
      "border-l-4 border-l-rose-500 border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 shadow-xl shadow-rose-900/5 dark:shadow-black/50",
    warning:
      "border-l-4 border-l-amber-500 border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 shadow-xl shadow-amber-900/5 dark:shadow-black/50",
    info:
      "border-l-4 border-l-[#FEE08B] dark:border-l-amber-400 border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 shadow-xl shadow-zinc-900/5 dark:shadow-black/50",
  };

  const progressTone = {
    success: "bg-emerald-500",
    error: "bg-rose-500",
    warning: "bg-amber-500",
    info: "bg-[#FEE08B] dark:bg-amber-400",
  };

  return (
    <div
      role={item.type === "error" ? "alert" : "status"}
      aria-live={item.type === "error" ? "assertive" : "polite"}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border p-4 backdrop-blur-md transition-all duration-200 ease-out transform ${
        isLeaving ? "translate-x-full opacity-0 scale-95" : "translate-x-0 opacity-100 scale-100"
      } ${borderTone[item.type]}`}
    >
      <div className="flex items-start gap-3">
        {iconMap[item.type]}
        <div className="flex-1 text-xs space-y-0.5 pr-2">
          {item.title && (
            <div className="font-bold text-zinc-900 dark:text-zinc-100">{item.title}</div>
          )}
          <div className="font-medium text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {item.message}
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close notification"
          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors text-xs font-semibold shrink-0 cursor-pointer"
        >
          ✕
        </button>
      </div>

      {item.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full ${progressTone[item.type]}`}
            style={{
              animation: `toast-progress ${item.duration}ms linear forwards`,
              animationPlayState: isPaused ? "paused" : "running",
            }}
          />
        </div>
      )}
    </div>
  );
}
