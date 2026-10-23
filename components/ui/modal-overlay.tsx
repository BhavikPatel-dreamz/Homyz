"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";

export interface ModalOverlayProps extends ComponentPropsWithoutRef<"div"> {
  isOpen?: boolean;
  onClose?: () => void;
}

/** Render only while open. Preserves the existing overlay markup and styling, and applies universal smooth modal transitions. */
export function ModalOverlay({
  className = "",
  style,
  isOpen,
  onClose,
  onClick,
  ...props
}: ModalOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (isOpen === false) return;
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
  }, [isOpen]);

  if (isOpen === false) {
    return null;
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented && onClose && e.target === e.currentTarget) {
      onClose();
    }
  };

  const hasBackdropOut = className.includes("modal-backdrop-animate-out");
  const overlayClass = hasBackdropOut
    ? className
    : className.includes("modal-backdrop-animate-in")
      ? className
      : `modal-backdrop-animate-in ${className}`.trim();

  return (
    <div
      {...props}
      ref={ref}
      onClick={handleClick}
      data-modal-overlay=""
      className={overlayClass}
      style={{ overscrollBehavior: "contain", ...style }}
    />
  );
}
