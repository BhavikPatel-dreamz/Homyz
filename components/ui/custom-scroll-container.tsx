"use client";

import React, { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useScrollbarDrag } from "@/components/ui/use-scrollbar-drag";

interface CustomScrollContainerProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  scrollRef?: RefObject<HTMLDivElement | null>;
  trackClassName?: string;
  minThumbHeight?: number;
  maxThumbHeight?: number;
}

export function CustomScrollContainer({
  children,
  className = "",
  containerClassName = "",
  scrollRef,
  trackClassName = "",
  minThumbHeight = 32,
  maxThumbHeight = 64,
}: CustomScrollContainerProps) {
  const internalScrollRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [thumb, setThumb] = useState({ height: 0, top: 0, visible: false });

  const resolvedScrollRef = scrollRef || internalScrollRef;

  const { isDragging, onThumbPointerDown } = useScrollbarDrag(
    resolvedScrollRef,
    trackRef,
    thumb.height,
  );

  const updateScrollThumb = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const element = resolvedScrollRef.current;
      const track = trackRef.current;
      if (!element) return;

      const hasOverflow = element.scrollHeight > element.clientHeight + 1;
      const trackHeight = track?.clientHeight || element.clientHeight;

      const rawHeight = (element.clientHeight / element.scrollHeight) * trackHeight;
      const height = hasOverflow
        ? Math.max(minThumbHeight, Math.min(maxThumbHeight, Math.round(rawHeight)))
        : 0;

      const usableTrackHeight = Math.max(0, trackHeight - height);
      const scrollRange = Math.max(1, element.scrollHeight - element.clientHeight);
      const top = hasOverflow ? Math.round((element.scrollTop / scrollRange) * usableTrackHeight) : 0;

      setThumb((current) =>
        current.height === height && current.top === top && current.visible === hasOverflow
          ? current
          : { height, top, visible: hasOverflow }
      );

      animationFrameRef.current = null;
    });
  }, [maxThumbHeight, minThumbHeight, resolvedScrollRef]);

  useEffect(() => {
    const element = resolvedScrollRef.current;
    if (!element) return;

    updateScrollThumb();
    const resizeObserver = new ResizeObserver(updateScrollThumb);
    const mutationObserver = new MutationObserver(updateScrollThumb);

    resizeObserver.observe(element);
    if (trackRef.current) resizeObserver.observe(trackRef.current);
    mutationObserver.observe(element, { childList: true, subtree: true, characterData: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [resolvedScrollRef, updateScrollThumb]);

  const handleTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target === thumbRef.current) return;
    if (event.button !== 0) return;

    const track = trackRef.current;
    const scrollElement = resolvedScrollRef.current;
    if (!track || !scrollElement) return;

    const rect = track.getBoundingClientRect();
    const clickY = event.clientY - rect.top;
    const usableTrackHeight = Math.max(1, rect.height - thumb.height);
    const targetRatio = Math.max(0, Math.min(1, (clickY - thumb.height / 2) / usableTrackHeight));
    const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);

    scrollElement.scrollTo({
      top: targetRatio * maxScrollTop,
      behavior: "smooth",
    });
  };

  const setScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      internalScrollRef.current = node;
      if (scrollRef) {
        if (typeof scrollRef === "function") {
          (scrollRef as (instance: HTMLDivElement | null) => void)(node);
        } else if ("current" in scrollRef) {
          (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      }
    },
    [scrollRef]
  );

  return (
    <div className={`relative w-full ${containerClassName}`}>
      <div
        ref={setScrollRef}
        onScroll={updateScrollThumb}
        className={`no-scrollbar overflow-y-auto ${className}`}
      >
        {children}
      </div>

      {thumb.visible && (
        <div
          onPointerDown={handleTrackPointerDown}
          className={`absolute right-0.5 top-2 bottom-2 z-10 flex w-3 cursor-pointer select-none justify-center touch-none ${trackClassName}`}
          aria-hidden="true"
        >
          {/* Scrollbar Track Pill with visible Figma box-shadow */}
          <div
            ref={trackRef}
            className="relative h-full w-[3px] rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.22)]"
          >
            {/* Scrollbar Thumb Pill */}
            <div
              ref={thumbRef}
              onPointerDown={onThumbPointerDown}
              className={`absolute left-0 w-full rounded-full bg-[#EBA900] will-change-transform ${
                isDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
              style={{
                height: `${thumb.height}px`,
                transform: `translate3d(0, ${thumb.top}px, 0)`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
