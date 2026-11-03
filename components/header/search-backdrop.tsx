"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useHeaderSearch } from "./header-search-context";

export function SearchBackdrop({ enabled = true }: { enabled?: boolean }) {
  const { isExpanded, setIsExpanded, setActiveField } = useHeaderSearch();

  useEffect(() => {
    if (!enabled || !isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsExpanded(false);
        setActiveField(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, isExpanded, setIsExpanded, setActiveField]);

  if (!enabled || !isExpanded || typeof document === "undefined") return null;

  // Keep the backdrop outside the sticky header's stacking context. Otherwise
  // `backdrop-filter` can stop sampling the scrolled page content behind it.
  return createPortal(
    <div
      aria-hidden="true"
      onClick={() => {
        setIsExpanded(false);
        setActiveField(null);
      }}
      className="fixed inset-0 z-[80] bg-black/25 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in cursor-pointer"
    />,
    document.body
  );
}
