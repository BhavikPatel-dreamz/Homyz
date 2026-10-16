"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

type DragState = {
  pointerId: number;
  startY: number;
  startScrollTop: number;
  maxScrollTop: number;
  maxThumbTop: number;
};

export function useScrollbarDrag(
  scrollRef: RefObject<HTMLElement | null>,
  trackRef: RefObject<HTMLElement | null>,
  thumbHeight: number,
) {
  const dragStateRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const stopDragging = useCallback(() => {
    dragStateRef.current = null;
    setIsDragging(false);
  }, []);

  const onThumbPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;

    const scrollElement = scrollRef.current;
    const trackElement = trackRef.current;
    if (!scrollElement || !trackElement) return;

    const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
    const maxThumbTop = Math.max(0, trackElement.clientHeight - thumbHeight);
    if (maxScrollTop === 0 || maxThumbTop === 0) return;

    event.preventDefault();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: scrollElement.scrollTop,
      maxScrollTop,
      maxThumbTop,
    };
    setIsDragging(true);
  }, [scrollRef, thumbHeight, trackRef]);

  const scrollByPage = useCallback((direction: "up" | "down") => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    scrollElement.scrollBy({
      top: (direction === "up" ? -1 : 1) * Math.max(120, Math.round(scrollElement.clientHeight * 0.8)),
      behavior: "smooth",
    });
  }, [scrollRef]);

  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      const dragState = dragStateRef.current;
      const scrollElement = scrollRef.current;
      if (!dragState || !scrollElement || event.pointerId !== dragState.pointerId) return;

      const pointerDelta = event.clientY - dragState.startY;
      const nextScrollTop = dragState.startScrollTop + (pointerDelta / dragState.maxThumbTop) * dragState.maxScrollTop;
      scrollElement.scrollTop = Math.min(dragState.maxScrollTop, Math.max(0, nextScrollTop));
    };

    const end = (event: globalThis.PointerEvent) => {
      if (dragStateRef.current?.pointerId === event.pointerId) stopDragging();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [scrollRef, stopDragging]);

  return { isDragging, onThumbPointerDown, scrollByPage };
}
