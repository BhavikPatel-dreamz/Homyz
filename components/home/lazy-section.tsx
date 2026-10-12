"use client";

import React, { useEffect, useRef, useState } from "react";
import { HomeSectionSkeleton } from "./home-section-skeleton";

export interface LazySectionProps {
  children: React.ReactNode;
  priority?: boolean;
}

/**
 * Intelligent viewport-based lazy loader for below-the-fold homepage carousels.
 * Priority sections render immediately. Deferred sections render a lightweight,
 * layout-identical skeleton placeholder until within 600px of viewport, preventing
 * layout shifts (CLS: 0) while drastically reducing initial DOM size and hydration overhead.
 */
export function LazySection({ children, priority = false }: LazySectionProps) {
  const [isVisible, setIsVisible] = useState(
    () => priority || (typeof window !== "undefined" && typeof IntersectionObserver === "undefined"),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (priority || isVisible) return;
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [priority, isVisible]);

  if (priority || isVisible) {
    return <>{children}</>;
  }

  return (
    <div ref={containerRef} className="min-h-[340px]">
      <HomeSectionSkeleton count={5} />
    </div>
  );
}
