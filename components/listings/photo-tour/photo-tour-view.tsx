"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PhotoTourViewModel, TourPhotoItem } from "@/lib/listing/photo-tour-view-model";
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
  onReserve?: () => void;
  reserveLabel?: string;
};

export function PhotoTourView({
  viewModel, listingTitle, backHref, onBack, onShare, onSave,
  isSaved = false, saveDisabled = false, onReserve, reserveLabel = "Reserve",
}: PhotoTourViewProps) {
  const [activeSectionId, setActiveSectionId] = useState(viewModel.sections[0]?.id ?? "");
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [unoptimized, setUnoptimized] = useState<Record<string, boolean>>({});
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const clickScrollingRef = useRef(false);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleImageError = useCallback((url: string) => {
    setUnoptimized((current) => {
      if (!current[url]) return { ...current, [url]: true };
      setFailed((currentFailed) => ({ ...currentFailed, [url]: true }));
      return current;
    });
  }, []);

  const revealCategory = useCallback((id: string) => {
    categoryNavRef.current
      ?.querySelector<HTMLElement>(`[data-category-id="${id}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, []);

  useEffect(() => {
    if (viewModel.sections.length < 2 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (clickScrollingRef.current) return;
      const visible = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const id = visible?.target.getAttribute("data-section-id");
      if (!id) return;
      setActiveSectionId((current) => current === id ? current : id);
      revealCategory(id);
    }, { rootMargin: "-42% 0px -48% 0px", threshold: [0.01, 0.2, 0.5] });
    Object.values(sectionRefs.current).forEach((section) => section && observer.observe(section));
    return () => observer.disconnect();
  }, [revealCategory, viewModel.sections.length]);

  useEffect(() => () => { if (clickTimerRef.current) clearTimeout(clickTimerRef.current); }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isFullscreenOpen) onBack?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreenOpen, onBack]);

  const scrollToSection = useCallback((sectionId: string) => {
    const section = sectionRefs.current[sectionId];
    if (!section) return;
    clickScrollingRef.current = true;
    setActiveSectionId(sectionId);
    revealCategory(sectionId);
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => { clickScrollingRef.current = false; }, 650);
  }, [revealCategory]);

  const openPhoto = useCallback((index: number) => {
    setSelectedPhotoIndex(index);
    setIsFullscreenOpen(true);
  }, []);

  const backControl = backHref ? (
    <Link href={backHref} aria-label="Back to listing" className="inline-flex size-11 items-center justify-center rounded-full transition hover:bg-zinc-100"><BackIcon /></Link>
  ) : (
    <button type="button" onClick={onBack} aria-label="Back to listing" className="inline-flex size-11 items-center justify-center rounded-full transition hover:bg-zinc-100"><BackIcon /></button>
  );

  return (
    <div className="w-full bg-white text-[#222222]">
      <div className="lg:hidden min-h-[100dvh] bg-white">
        <header className="sticky top-0 z-30 overflow-visible border-b border-black/10 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div className="flex h-14 items-center justify-between px-4 sm:px-6">
            {backControl}
            {onShare ? <button type="button" onClick={onShare} aria-label="Share listing" className="inline-flex size-11 items-center justify-center rounded-full transition hover:bg-zinc-100"><ShareIcon /></button> : <span className="size-11" />}
          </div>
          <h1 className="px-5 pb-5 pt-4 text-[22px] leading-6 font-medium tracking-[-0.03em] sm:px-6">Photo tour</h1>
          {viewModel.sections.length > 0 && (
            <div
              ref={categoryNavRef}
              className="flex min-h-[12.75rem] items-start gap-3 overflow-x-auto px-5 pb-4 pt-2 sm:min-h-[14rem] sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {viewModel.sections.map((section) => {
                const active = activeSectionId === section.id;
                return <button key={section.id} type="button" data-category-id={section.id} onClick={() => scrollToSection(section.id)} aria-current={active ? "true" : undefined} className="group flex w-36 shrink-0 flex-col text-left sm:w-40">
                  <div className={`relative h-36 w-36 overflow-hidden rounded-2xl bg-zinc-100 sm:h-40 sm:w-40 ${active ? "ring-2 ring-[#222] ring-offset-2" : ""}`}>
                    <TourImage photo={section.coverPhoto} alt="" priority={section.coverPhoto.globalIndex === 0} unoptimized={Boolean(unoptimized[section.coverPhoto.url])} failed={failed[section.coverPhoto.url]} onError={handleImageError} sizes="160px" />
                  </div>
                  <span className={`mt-2 block max-w-36 truncate text-[13px] ${active ? "font-medium text-[#222]" : "text-[#555]"}`}>{section.title}</span>
                </button>;
              })}
            </div>
          )}
        </header>
        <main className="px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-7 sm:px-6">
          {viewModel.sections.length === 0 ? <EmptyTour /> : viewModel.sections.map((section, sectionIndex) => (
            <section key={section.id} ref={(element) => { sectionRefs.current[section.id] = element; }} data-section-id={section.id} className="scroll-mt-[22rem] border-b border-black/10 pb-9 last:border-0">
              <div className={sectionIndex === 0 ? "mb-5" : "mb-5 pt-9"}>
                <h2 className="text-[22px] leading-7 font-medium tracking-[-0.03em]">{section.title}</h2>
                {section.details && <p className="mt-1 text-sm text-[#717171]">{section.details}</p>}
              </div>
              <MobileRoomGallery photos={section.photos} onSelect={openPhoto} failed={failed} unoptimized={unoptimized} onError={handleImageError} />
            </section>
          ))}
        </main>
        {onReserve && <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button type="button" onClick={onReserve} className="pointer-events-auto min-h-12 rounded-full bg-[#e61e4d] px-7 py-3 text-sm font-medium text-white shadow-[0_8px_22px_rgba(0,0,0,0.22)] transition-transform active:scale-[0.98]">{reserveLabel}</button>
        </div>}
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-8 py-3">
            {backHref ? <Link href={backHref} className="inline-flex size-11 items-center justify-center rounded-full transition hover:bg-zinc-100" aria-label="Back to listing"><BackIcon /></Link> : onBack ? <button type="button" onClick={onBack} className="inline-flex size-11 items-center justify-center rounded-full transition hover:bg-zinc-100" aria-label="Back to listing"><BackIcon /></button> : null}
            <div ref={categoryNavRef} className="flex flex-1 gap-3 overflow-x-auto [scrollbar-width:none]">
              {viewModel.sections.map((section) => <button key={section.id} type="button" data-category-id={section.id} onClick={() => scrollToSection(section.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-2 py-1.5 text-left ${activeSectionId === section.id ? "bg-zinc-100" : "hover:bg-zinc-50"}`}>
                <div className="relative size-10 overflow-hidden rounded-lg bg-zinc-100"><TourImage photo={section.coverPhoto} alt="" unoptimized={Boolean(unoptimized[section.coverPhoto.url])} failed={failed[section.coverPhoto.url]} onError={handleImageError} sizes="40px" /></div>
                <span className="text-sm font-medium">{section.title}</span>
              </button>)}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {onShare && <button type="button" onClick={onShare} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium underline underline-offset-2 transition hover:bg-zinc-100" aria-label="Share listing"><ShareIcon /><span>Share</span></button>}
              {onSave && <button type="button" onClick={onSave} disabled={saveDisabled} aria-pressed={isSaved} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium underline underline-offset-2 transition hover:bg-zinc-100 disabled:opacity-50" aria-label={isSaved ? "Remove from wishlist" : "Save listing"}><HeartIcon filled={isSaved} /><span>{isSaved ? "Saved" : "Save"}</span></button>}
            </div>
          </div>
        </div>
        <main className="mx-auto max-w-5xl space-y-16 px-8 py-12">
          {viewModel.sections.map((section) => <section key={section.id} ref={(element) => { sectionRefs.current[section.id] = element; }} data-section-id={section.id} className="scroll-mt-24 border-b border-zinc-100 pb-16 last:border-0">
            <h2 className="mb-2 text-2xl font-medium">{section.title}</h2>
            {section.details && <p className="mb-6 text-sm text-zinc-500">{section.details}</p>}
            <DesktopRoomGallery photos={section.photos} onSelect={openPhoto} failed={failed} unoptimized={unoptimized} onError={handleImageError} />
          </section>)}
        </main>
      </div>
      {isFullscreenOpen && <FullscreenPhotoViewer key={`photo-${selectedPhotoIndex}`} photos={viewModel.allPhotos} initialIndex={selectedPhotoIndex} isOpen onClose={() => setIsFullscreenOpen(false)} listingTitle={listingTitle} onShare={onShare} />}
    </div>
  );
}

type GalleryProps = { photos: TourPhotoItem[]; onSelect: (index: number) => void; failed: Record<string, boolean>; unoptimized: Record<string, boolean>; onError: (url: string) => void };
function MobileRoomGallery({ photos, onSelect, failed, unoptimized, onError }: GalleryProps) {
  if (!photos.length) return null;
  const [first, ...rest] = photos;
  return <div className="space-y-2">
    <PhotoButton photo={first} onSelect={onSelect} failed={failed[first.url]} unoptimized={Boolean(unoptimized[first.url])} onError={onError} className="aspect-[1.38] rounded-2xl" sizes="(max-width: 1023px) 100vw, 760px" priority={first.globalIndex === 0} />
    {rest.length > 0 && <div className="grid grid-cols-2 gap-2">{rest.map((photo) => <PhotoButton key={photo.id} photo={photo} onSelect={onSelect} failed={failed[photo.url]} unoptimized={Boolean(unoptimized[photo.url])} onError={onError} className="aspect-[1.05] rounded-xl" sizes="(max-width: 1023px) 50vw, 380px" />)}</div>}
  </div>;
}
function DesktopRoomGallery({ photos, onSelect, failed, unoptimized, onError }: GalleryProps) {
  if (!photos.length) return null;
  const [first, ...rest] = photos;
  return <div className="space-y-3">
    <PhotoButton photo={first} onSelect={onSelect} failed={failed[first.url]} unoptimized={Boolean(unoptimized[first.url])} onError={onError} className="aspect-[16/8] rounded-2xl" sizes="1024px" priority={first.globalIndex === 0} />
    {rest.length > 0 && <div className="grid grid-cols-2 gap-3">{rest.map((photo) => <PhotoButton key={photo.id} photo={photo} onSelect={onSelect} failed={failed[photo.url]} unoptimized={Boolean(unoptimized[photo.url])} onError={onError} className="aspect-[4/3] rounded-2xl" sizes="50vw" />)}</div>}
  </div>;
}
type PhotoButtonProps = { photo: TourPhotoItem; onSelect: (index: number) => void; failed: boolean; unoptimized: boolean; onError: (url: string) => void; className: string; sizes: string; priority?: boolean };
function PhotoButton({ photo, onSelect, failed, unoptimized, onError, className, sizes, priority }: PhotoButtonProps) {
  return <button type="button" onClick={() => onSelect(photo.globalIndex)} aria-label={`Open photo ${photo.globalIndex + 1} of ${photo.roomName}`} className={`group relative block w-full overflow-hidden bg-zinc-100 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${className}`}>
    <TourImage photo={photo} alt={photo.caption || `${photo.roomName} — photo ${photo.roomIndex + 1}`} priority={priority} failed={failed} unoptimized={unoptimized} onError={onError} sizes={sizes} className="transition-transform duration-300 group-hover:scale-[1.02]" />
  </button>;
}
type TourImageProps = { photo: TourPhotoItem; alt: string; priority?: boolean; failed: boolean; unoptimized: boolean; onError: (url: string) => void; sizes: string; className?: string };
function TourImage({ photo, alt, priority, failed, unoptimized, onError, sizes, className }: TourImageProps) {
  if (failed) return <span className="flex size-full items-center justify-center p-3 text-center text-xs text-zinc-400">Photo unavailable</span>;
  return <Image src={photo.url} alt={alt} fill sizes={sizes} priority={priority} loading={priority ? "eager" : "lazy"} unoptimized={unoptimized} onError={() => onError(photo.url)} className={className} style={{ objectFit: "cover" }} />;
}
function EmptyTour() { return <div className="flex min-h-56 items-center justify-center rounded-2xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">Photos for this listing are not available yet.</div>; }
function BackIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" /></svg>; }
function ShareIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V3m0 0L7.5 7.5M12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>; }
function HeartIcon({ filled }: { filled: boolean }) { return <svg aria-hidden="true" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" className="size-5"><path d="M12 20.5 3.8 12a5.2 5.2 0 0 1 7.4-7.3L12 5.5l.8-.8a5.2 5.2 0 0 1 7.4 7.3L12 20.5Z" /></svg>; }

export default PhotoTourView;
