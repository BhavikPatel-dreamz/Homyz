"use client";

import React, { useEffect } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";

export interface SettingsResponsiveDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function SettingsResponsiveDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className = "",
}: SettingsResponsiveDrawerProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/50 backdrop-blur-2xs p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-zinc-200/80 sm:max-w-lg animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ${className}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 p-5 sm:p-6 shrink-0">
          <div>
            <h2 id="drawer-title" className="text-lg sm:text-xl font-bold text-[#1F1F1F]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-xs sm:text-sm text-[#727272]">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-sm text-zinc-700 overscroll-contain">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-zinc-100 p-4 sm:p-5 bg-zinc-50/70 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

