"use client";

import React, { useEffect, useState } from "react";
import { toastManager, ToastItem } from "./toast";

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toastManager.subscribe(setToasts);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (item.duration <= 0) return;
    const timer = setTimeout(() => {
      handleDismiss();
    }, item.duration);

    return () => clearTimeout(timer);
  }, [item.duration, item.id]);

  function handleDismiss() {
    setIsLeaving(true);
    setTimeout(() => {
      toastManager.dismiss(item.id);
    }, 200);
  }

  const iconMap = {
    success: (
      <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs shrink-0">
        ✓
      </div>
    ),
    error: (
      <div className="h-6 w-6 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black text-xs shrink-0">
        ✕
      </div>
    ),
    warning: (
      <div className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-xs shrink-0">
        !
      </div>
    ),
    info: (
      <div className="h-6 w-6 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black text-xs shrink-0">
        ⓘ
      </div>
    ),
  };

  const borderTone = {
    success: "border-emerald-500/40 bg-[var(--surface)] text-muted-foreground shadow-xl shadow-emerald-900/10",
    error: "border-rose-500/40 bg-[var(--surface)] text-muted-foreground shadow-xl shadow-rose-900/10",
    warning: "border-amber-500/40 bg-[var(--surface)] text-muted-foreground shadow-xl shadow-amber-900/10",
    info: "border-sky-500/40 bg-[var(--surface)] text-muted-foreground shadow-xl shadow-sky-900/10",
  };

  const progressTone = {
    success: "bg-emerald-500",
    error: "bg-rose-500",
    warning: "bg-amber-500",
    info: "bg-sky-500",
  };

  return (
    <div
      role={item.type === "error" ? "alert" : "status"}
      aria-live={item.type === "error" ? "assertive" : "polite"}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 ease-out transform ${
        isLeaving ? "translate-x-full opacity-0 scale-95" : "translate-x-0 opacity-100 scale-100"
      } ${borderTone[item.type]}`}
    >
      <div className="flex items-start gap-3">
        {iconMap[item.type]}
        <div className="flex-1 text-xs space-y-0.5 pr-2">
          {item.title && <div className="font-extrabold text-muted-foreground">{item.title}</div>}
          <div className="font-semibold text-muted-foreground leading-relaxed">{item.message}</div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close notification"
          className="text-[var(--muted-foreground)] hover:text-muted-foreground p-1 rounded-lg transition-colors text-xs font-bold shrink-0"
        >
          ✕
        </button>
      </div>

      {item.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--surface-secondary)]">
          <div
            className={`h-full ${progressTone[item.type]}`}
            style={{
              animation: `toast-progress ${item.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}
