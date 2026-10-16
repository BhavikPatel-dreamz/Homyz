"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";

/** Render only while open. Preserves the existing overlay markup and styling. */
export function ModalOverlay({ style, ...props }: ComponentPropsWithoutRef<"div">) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let release: (() => void) | undefined;
    const syncVisibility = () => {
      // Responsive drawers can remain mounted but become hidden on desktop.
      const visible = element.getClientRects().length > 0 && window.getComputedStyle(element).visibility !== "hidden";
      if (visible && !release) release = lockBodyScroll();
      else if (!visible && release) {
        release();
        release = undefined;
      }
    };
    syncVisibility();
    const observer = new ResizeObserver(syncVisibility);
    observer.observe(element);
    window.addEventListener("resize", syncVisibility);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncVisibility);
      release?.();
    };
  }, []);

  return <div {...props} ref={ref} style={{ overscrollBehavior: "contain", ...style }} />;
}
