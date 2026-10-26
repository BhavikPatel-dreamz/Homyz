"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll } from "@/lib/ui/body-scroll-lock";

export interface ModalOverlayProps extends ComponentPropsWithoutRef<"div"> {
  isOpen?: boolean;
  onClose?: () => void;
  portal?: boolean;
}

/** Render only while open. Preserves the existing overlay markup and styling, and applies universal smooth modal transitions. */
export function ModalOverlay({
  className = "",
  style,
  isOpen,
  onClose,
  onClick,
  portal = true,
  ...props
}: ModalOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
  }, [isOpen, mounted]);

  useEffect(() => {
    if (isOpen === false || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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

  const node = (
    <div
      {...props}
      ref={ref}
      onClick={handleClick}
      data-modal-overlay=""
      className={overlayClass}
      style={{ overscrollBehavior: "contain", ...style }}
    />
  );

  if (portal) {
    if (!mounted || typeof document === "undefined") {
      return null;
    }
    return createPortal(node, document.body);
  }

  return node;
}
