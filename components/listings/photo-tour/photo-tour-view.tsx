"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import type {
  PhotoTourViewModel,
  TourPhotoItem,
  LayoutBlock,
} from "@/lib/listing/photo-tour-view-model";
import { FullscreenPhotoViewer } from "./fullscreen-photo-viewer";

export type PhotoTourViewProps = {
  viewModel: PhotoTourViewModel;
  listingTitle?: string;
  backHref?: string;
  onBack?: () => void;
  onShare?: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  saveDisabled?: boolean;
};

/**
 * Dynamically measures the actual rendered height of the main Homyz header.
 * Synchronizes with a CSS custom property `--app-header-height` and updates on resize.
 */
export function useAppHeaderHeight(): number {
  const [headerHeight, setHeaderHeight] = useState(88);

  useEffect(() => {
    const updateHeight = () => {
      const headerEl =
        document.querySelector<HTMLElement>("header.header") ||
        document.querySelector<HTMLElement>("header");
      if (headerEl) {
        const height = Math.round(headerEl.getBoundingClientRect().height);
        if (height > 0) {
          setHeaderHeight(height);
          document.documentElement.style.setProperty("--app-header-height", `${height}px`);
        }
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight, { passive: true });

    let observer: ResizeObserver | null = null;
    const headerEl =
      document.querySelector<HTMLElement>("header.header") ||
      document.querySelector<HTMLElement>("header");
    if (headerEl && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => updateHeight());
      observer.observe(headerEl);
    }

    return () => {
      window.removeEventListener("resize", updateHeight);
      observer?.disconnect();
    };
  }, []);

  return headerHeight;
}

export function PhotoTourView({
  viewModel,
  listingTitle,
  backHref,
  onBack,
  onShare,
  onSave,
  isSaved = false,
  saveDisabled = false,
}: PhotoTourViewProps) {
  const headerHeight = useAppHeaderHeight();
  const [activeSectionId, setActiveSectionId] = useState<string>(
    () => viewModel.sections[0]?.id || "",
  );
  const [navHeight, setNavHeight] = useState(72);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [unoptimizedMap, setUnoptimizedMap] = useState<Record<string, boolean>>({});

  const navRef = useRef<HTMLDivElement>(null);
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const isClickScrolling = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Measure the navigation strip height
  useEffect(() => {
    const updateNavHeight = () => {
      if (navRef.current) {
        const h = Math.round(navRef.current.getBoundingClientRect().height);
        if (h > 0) {
          setNavHeight(h);
          document.documentElement.style.setProperty("--photo-nav-height", `${h}px`);
        }
      }
    };
    updateNavHeight();
    window.addEventListener("resize", updateNavHeight, { passive: true });
    return () => window.removeEventListener("resize", updateNavHeight);
  }, []);


  // Scroll active category chip into view in the horizontal nav
  const scrollActiveChipIntoView = useCallback((categoryId: string) => {
    if (!categoryNavRef.current) return;
    const activeChip = categoryNavRef.current.querySelector<HTMLButtonElement>(
      `[data-category-id="${categoryId}"]`,
    );
    if (activeChip) {
      activeChip.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, []);

  // Scroll spy: observe which room section is in viewport
  useEffect(() => {
    if (viewModel.sections.length <= 1) return;

    const handleScroll = () => {
      if (isClickScrolling.current) return;

      const actualHeaderHeight =
        document.querySelector<HTMLElement>("header.header")?.offsetHeight || headerHeight;
      const actualNavHeight = navRef.current?.offsetHeight || navHeight;
      const threshold = actualHeaderHeight + actualNavHeight + 40;

      let currentId = viewModel.sections[0].id;
      for (const section of viewModel.sections) {
        const el = document.getElementById(`section-${section.id}`);
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= threshold) {
            currentId = section.id;
          }
        }
      }

      setActiveSectionId((prev) => {
        if (prev !== currentId) {
          scrollActiveChipIntoView(currentId);
          return currentId;
        }
        return prev;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [viewModel.sections, headerHeight, navHeight, scrollActiveChipIntoView]);

  // Click room thumbnail to scroll to section
  const scrollToSection = useCallback(
    (sectionId: string) => {
      const target = document.getElementById(`section-${sectionId}`);
      if (!target) return;

      isClickScrolling.current = true;
      setActiveSectionId(sectionId);

      const actualHeaderHeight =
        document.querySelector<HTMLElement>("header.header")?.offsetHeight || headerHeight;
      const actualNavHeight = navRef.current?.offsetHeight || navHeight;
      const totalOffset = actualHeaderHeight + actualNavHeight + 20;

      const targetTop = target.getBoundingClientRect().top + window.scrollY - totalOffset;

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });

      scrollActiveChipIntoView(sectionId);

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isClickScrolling.current = false;
      }, 750);
    },
    [headerHeight, navHeight, scrollActiveChipIntoView],
  );

  const handleSelectPhoto = useCallback((globalIndex: number) => {
    setSelectedPhotoIndex(globalIndex);
    setIsFullscreenOpen(true);
  }, []);

  const handleCloseFullscreen = useCallback(() => {
    setIsFullscreenOpen(false);
  }, []);

  const handleImgError = useCallback((url: string) => {
    if (!unoptimizedMap[url]) {
      setUnoptimizedMap((prev) => ({ ...prev, [url]: true }));
    } else {
      setFailed((prev) => ({ ...prev, [url]: true }));
    }
  }, [unoptimizedMap]);

  return (
    <div className="w-full bg-white text-[#1f1f1f]">
      {/*
        Sticky Photo / Room Navigation Strip:
        Positioned strictly below the main Homyz header via dynamic `top: ${headerHeight}px`.
        Guarantees zero overlap with the header at any viewport width.
        Border width matches the AppHeader Container size rather than stretching edge-to-edge.
      */}
      {viewModel.sections.length > 0 && (
        <nav
          ref={navRef}
          aria-label="Room categories navigation"
          style={{ top: `${headerHeight}px` }}
          className="sticky z-30 w-full bg-white/95 backdrop-blur-md transition-[top] duration-150"
        >
          <Container>
            <div className="flex items-center justify-between border-b border-[#727272]/20">
              {/* Optional Back Button */}
              {(backHref || onBack) && (
                <div className="shrink-0 pr-3 mr-1 border-r border-zinc-200 hidden sm:flex items-center">
                  {backHref ? (
                    <Link
                      href={backHref}
                      aria-label="Back to listing"
                      className="inline-flex items-center gap-1.5 rounded-full py-1.5 px-3 text-xs font-medium text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>Listing</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={onBack}
                      aria-label="Back to listing"
                      className="inline-flex items-center gap-1.5 rounded-full py-1.5 px-3 text-xs font-medium text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>Listing</span>
                    </button>
                  )}
                </div>
              )}

              {/* Horizontally scrollable room category cards */}
              <div
                ref={categoryNavRef}
                className="flex-1 flex items-center gap-3 overflow-x-auto py-2.5 [scrollbar-width:none] scroll-smooth"
              >
                {viewModel.sections.map((section) => {
                  const isActive = activeSectionId === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      data-category-id={section.id}
                      onClick={() => scrollToSection(section.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all shrink-0 cursor-pointer text-left border ${
                        isActive
                          ? "border-[#1f1f1f] bg-zinc-50 shadow-2xs"
                          : "border-transparent bg-transparent hover:bg-zinc-100/70"
                      }`}
                    >
                      <div className="relative size-10 sm:size-11 rounded-lg overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200/80">
                        <Image
                          src={section.coverPhoto.url}
                          alt=""
                          fill
                          style={{ objectFit: "cover" }}
                          sizes="44px"
                          loading="lazy"
                          unoptimized={Boolean(unoptimizedMap[section.coverPhoto.url])}
                          onError={() => handleImgError(section.coverPhoto.url)}
                        />
                      </div>
                      <div className="flex flex-col min-w-0 pr-1">
                        <span
                          className={`text-xs sm:text-sm truncate font-medium ${
                            isActive ? "text-[#1f1f1f]" : "text-zinc-600 group-hover:text-zinc-900"
                          }`}
                        >
                          {section.title}
                        </span>
                        <span className="text-[11px] font-normal text-zinc-400">
                          {section.photos.length} {section.photos.length === 1 ? "photo" : "photos"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right actions: Share and Save (if available) */}
              {(onShare || onSave) && (
                <div className="shrink-0 pl-3 ml-1 border-l border-zinc-200 hidden md:flex items-center gap-2">
                  {onShare && (
                    <button
                      type="button"
                      onClick={onShare}
                      aria-label="Share listing"
                      className="flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-[#1f1f1f] shadow-2xs hover:bg-zinc-50 transition cursor-pointer"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-4">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <path d="m8.6 10.6 6.8-4.1M8.6 13.4l6.8 4.1" />
                      </svg>
                    </button>
                  )}
                  {onSave && (
                    <button
                      type="button"
                      onClick={onSave}
                      disabled={saveDisabled}
                      aria-pressed={isSaved}
                      aria-label={isSaved ? "Remove from wishlist" : "Save listing"}
                      className={`flex size-9 items-center justify-center rounded-full border shadow-2xs transition disabled:opacity-50 cursor-pointer ${
                        isSaved
                          ? "border-red-300 bg-red-50 text-red-600"
                          : "border-zinc-200 bg-white text-[#1f1f1f] hover:bg-zinc-50"
                      }`}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" className="size-4">
                        <path d="M12 20.5 3.8 12a5.2 5.2 0 0 1 7.4-7.3L12 5.5l.8-.8a5.2 5.2 0 0 1 7.4 7.3L12 20.5Z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          </Container>
        </nav>
      )}

      {/* Main Content: Masonry / Adaptive Layout for each Room Section */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20 space-y-12 sm:space-y-16">
        {viewModel.sections.map((section) => (
          <section
            key={section.id}
            id={`section-${section.id}`}
            style={{
              scrollMarginTop: `${headerHeight + navHeight + 20}px`,
            }}
            className="border-b border-zinc-100 pb-12 sm:pb-16 last:border-b-0 last:pb-6"
          >
            {/* Room Section Header */}
            <div className="mb-5 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-medium text-[#1f1f1f] tracking-tight">
                {section.title}
              </h2>
              {section.details && (
                <p className="text-xs sm:text-sm font-normal text-zinc-500 mt-1">
                  {section.details}
                </p>
              )}
            </div>

            {/* Room Photo Blocks Grid */}
            <div className="space-y-3 sm:space-y-4">
              {section.blocks.map((block, blockIndex) => (
                <PhotoTourBlock
                  key={`${section.id}-block-${blockIndex}`}
                  block={block}
                  onSelectPhoto={handleSelectPhoto}
                  failed={failed}
                  unoptimizedMap={unoptimizedMap}
                  onImgError={handleImgError}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Fullscreen Photo Viewer */}
      {isFullscreenOpen && (
        <FullscreenPhotoViewer
          key={`fullscreen-${selectedPhotoIndex}`}
          photos={viewModel.allPhotos}
          initialIndex={selectedPhotoIndex}
          isOpen={isFullscreenOpen}
          onClose={handleCloseFullscreen}
          listingTitle={listingTitle}
          onShare={onShare}
        />
      )}
    </div>
  );
}

type PhotoTourBlockProps = {
  block: LayoutBlock;
  onSelectPhoto: (globalIndex: number) => void;
  failed: Record<string, boolean>;
  unoptimizedMap: Record<string, boolean>;
  onImgError: (url: string) => void;
};

function PhotoTourBlock({
  block,
  onSelectPhoto,
  failed,
  unoptimizedMap,
  onImgError,
}: PhotoTourBlockProps) {
  if (block.type === "single") {
    return (
      <div className="aspect-[16/10] sm:aspect-[21/9] w-full rounded-2xl overflow-hidden bg-zinc-100 relative">
        <PhotoCard
          photo={block.photo}
          onSelectPhoto={onSelectPhoto}
          failed={failed[block.photo.url]}
          unoptimized={Boolean(unoptimizedMap[block.photo.url])}
          onImgError={onImgError}
          priority={block.photo.globalIndex === 0}
          sizes="(max-width: 768px) 100vw, 1024px"
        />
      </div>
    );
  }

  if (block.type === "two-column") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 aspect-auto sm:aspect-[16/10]">
        {block.photos.map((photo) => (
          <div key={photo.id} className="aspect-[4/3] sm:aspect-auto sm:h-full rounded-2xl overflow-hidden bg-zinc-100 relative">
            <PhotoCard
              photo={photo}
              onSelectPhoto={onSelectPhoto}
              failed={failed[photo.url]}
              unoptimized={Boolean(unoptimizedMap[photo.url])}
              onImgError={onImgError}
              priority={photo.globalIndex === 0}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        ))}
      </div>
    );
  }

  if (block.type === "feature-right-stacked") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 aspect-auto md:aspect-[16/10]">
        <div className="md:col-span-2 aspect-[4/3] md:aspect-auto md:h-full rounded-2xl overflow-hidden bg-zinc-100 relative">
          <PhotoCard
            photo={block.feature}
            onSelectPhoto={onSelectPhoto}
            failed={failed[block.feature.url]}
            unoptimized={Boolean(unoptimizedMap[block.feature.url])}
            onImgError={onImgError}
            priority={block.feature.globalIndex === 0}
            sizes="(max-width: 768px) 100vw, 66vw"
          />
        </div>
        <div className="flex flex-col gap-3 sm:gap-4 md:col-span-1">
          {block.stacked.map((photo) => (
            <div key={photo.id} className="aspect-[4/3] flex-1 rounded-2xl overflow-hidden bg-zinc-100 relative">
              <PhotoCard
                photo={photo}
                onSelectPhoto={onSelectPhoto}
                failed={failed[photo.url]}
                unoptimized={Boolean(unoptimizedMap[photo.url])}
                onImgError={onImgError}
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === "feature-left-stacked") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 aspect-auto md:aspect-[16/10]">
        <div className="flex flex-col gap-3 sm:gap-4 md:col-span-1 order-2 md:order-1">
          {block.stacked.map((photo) => (
            <div key={photo.id} className="aspect-[4/3] flex-1 rounded-2xl overflow-hidden bg-zinc-100 relative">
              <PhotoCard
                photo={photo}
                onSelectPhoto={onSelectPhoto}
                failed={failed[photo.url]}
                unoptimized={Boolean(unoptimizedMap[photo.url])}
                onImgError={onImgError}
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
          ))}
        </div>
        <div className="md:col-span-2 aspect-[4/3] md:aspect-auto md:h-full rounded-2xl overflow-hidden bg-zinc-100 relative order-1 md:order-2">
          <PhotoCard
            photo={block.feature}
            onSelectPhoto={onSelectPhoto}
            failed={failed[block.feature.url]}
            unoptimized={Boolean(unoptimizedMap[block.feature.url])}
            onImgError={onImgError}
            sizes="(max-width: 768px) 100vw, 66vw"
          />
        </div>
      </div>
    );
  }

  if (block.type === "two-by-two") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {block.photos.map((photo) => (
          <div key={photo.id} className="aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 relative">
            <PhotoCard
              photo={photo}
              onSelectPhoto={onSelectPhoto}
              failed={failed[photo.url]}
              unoptimized={Boolean(unoptimizedMap[photo.url])}
              onImgError={onImgError}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        ))}
      </div>
    );
  }

  return null;
}

type PhotoCardProps = {
  photo: TourPhotoItem;
  onSelectPhoto: (globalIndex: number) => void;
  failed?: boolean;
  unoptimized?: boolean;
  onImgError: (url: string) => void;
  priority?: boolean;
  sizes: string;
};

function PhotoCard({
  photo,
  onSelectPhoto,
  failed,
  unoptimized,
  onImgError,
  priority = false,
  sizes,
}: PhotoCardProps) {
  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-100 p-4 text-center text-zinc-400">
        <svg className="size-6 mb-1 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <span className="text-xs font-normal text-zinc-500">Photo unavailable</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelectPhoto(photo.globalIndex)}
      aria-label={`Open photo ${photo.globalIndex + 1} of ${photo.roomName}`}
      className="group relative h-full w-full block cursor-pointer p-0 m-0 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
    >
      <Image
        src={photo.url}
        alt={photo.caption || `${photo.roomName} — Photo ${photo.roomIndex + 1}`}
        fill
        style={{ objectFit: "cover" }}
        sizes={sizes}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        unoptimized={unoptimized}
        onError={() => onImgError(photo.url)}
        className="transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

      {photo.caption && (
        <span className="absolute bottom-2.5 left-2.5 z-10 rounded-md bg-black/60 backdrop-blur-xs px-2.5 py-1 text-[11px] font-normal text-white">
          {photo.caption}
        </span>
      )}
    </button>
  );
}

export default PhotoTourView;
