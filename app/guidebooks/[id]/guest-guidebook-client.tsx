"use client";

import React, { useState } from "react";
import Link from "next/link";
import { GuidebookMap, MapPlacePin } from "@/components/guidebook/guidebook-map";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import {
  GUIDEBOOK_CATEGORIES,
  getCategoryLabel,
  getCategoryIcon,
} from "@/lib/validation/guidebook";

interface GuidebookItem {
  id: string;
  type: "PLACE" | "NEIGHBORHOOD" | "TIP";
  title: string;
  category: string;
  description?: string | null;
  hostTip?: string | null;
  photo?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isFavorite?: boolean;
  sortOrder?: number;
}

interface PublicGuidebookData {
  id: string;
  title: string;
  coverImage?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  formattedAddress?: string | null;
  published: boolean;
  updatedAt: string;
  host: {
    id: string;
    name: string;
    image?: string | null;
    yearsHosting: number;
  };
  items: GuidebookItem[];
  listings: Array<{ id: string; title: string; city?: string | null; coverPhoto?: string | null }>;
}

export function GuestGuidebookClient({
  guidebook,
  viewerId,
}: {
  guidebook: PublicGuidebookData;
  viewerId?: string | null;
}) {
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  const isOwner = viewerId === guidebook.host.id;
  const cover =
    guidebook.coverImage ||
    "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80";

  // Filter items
  const filteredItems = guidebook.items.filter((item) => {
    if (activeCategory !== "ALL") {
      if (activeCategory === "FAVORITES" && !item.isFavorite) return false;
      if (activeCategory === "TIPS" && item.type !== "TIP") return false;
      if (
        activeCategory !== "FAVORITES" &&
        activeCategory !== "TIPS" &&
        item.category !== activeCategory
      ) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchTip = item.hostTip?.toLowerCase().includes(q);
      const matchAddr = item.address?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchTip && !matchAddr) return false;
    }
    return true;
  });

  // Map Pins
  const mapPins: MapPlacePin[] = guidebook.items
    .filter((item) => item.latitude != null && item.longitude != null)
    .map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      latitude: item.latitude,
      longitude: item.longitude,
      address: item.address,
      isFavorite: item.isFavorite,
    }));

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2500);
  };

  return (
    <div className="min-h-screen bg-zinc-50/50 pb-20 font-sans">
      {/* Toast Notification */}
      {copyToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-zinc-900 text-white px-5 py-3 text-xs font-semibold shadow-xl border border-zinc-700 animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2">
          <span>✓</span>
          <span>Guidebook link copied to clipboard!</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-bold text-zinc-900 hover:text-zinc-700 transition-colors"
          >
            ← Back to Homyz
          </Link>
          <span className="text-zinc-300">|</span>
          <span className="text-xs font-semibold text-zinc-500 truncate max-w-xs">
            {guidebook.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <span className="text-[10px] font-semibold bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full">
              Preview Mode
            </span>
          )}
          <button
            type="button"
            onClick={handleShare}
            className="rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold px-4 py-1.5 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>🔗</span>
            <span>Share</span>
          </button>
        </div>
      </header>

      {/* Hero Banner with Host Attribution */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 pb-4">
        <div className="relative h-64 sm:h-80 w-full rounded-3xl overflow-hidden shadow-sm">
          <img src={cover} alt={guidebook.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />

          {/* Hero Content */}
          <div className="absolute bottom-6 left-6 right-6 text-white flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Local Host Guidebook
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                {guidebook.title}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-200 font-medium">
                {guidebook.city ? `${guidebook.city}${guidebook.country ? `, ${guidebook.country}` : ""} · ` : ""}
                {guidebook.items.length} curated recommendations
              </p>
            </div>

            {/* Host Badge */}
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 shrink-0">
              {guidebook.host.image ? (
                <img
                  src={guidebook.host.image}
                  alt={guidebook.host.name}
                  className="w-11 h-11 rounded-full object-cover border border-white/40 shadow-xs"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-amber-400 text-zinc-950 font-bold flex items-center justify-center text-sm shadow-xs">
                  {guidebook.host.name[0]?.toUpperCase() || "H"}
                </div>
              )}
              <div>
                <span className="text-xs font-bold block leading-tight text-white">
                  {guidebook.host.name}
                </span>
                <span className="text-[11px] text-zinc-300 font-medium block">
                  {guidebook.host.yearsHosting > 0
                    ? `${guidebook.host.yearsHosting} years hosting`
                    : "Verified Host"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-4 space-y-6">
        {/* Search & Category Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-3 border border-zinc-200 shadow-2xs">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setActiveCategory("ALL")}
              className={`rounded-full px-3.5 py-1.5 font-semibold text-xs transition-all shrink-0 cursor-pointer ${
                activeCategory === "ALL"
                  ? "bg-zinc-900 text-white shadow-2xs"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              All ({guidebook.items.length})
            </button>

            {guidebook.items.some((it) => it.isFavorite) && (
              <button
                type="button"
                onClick={() => setActiveCategory("FAVORITES")}
                className={`rounded-full px-3.5 py-1.5 font-semibold text-xs transition-all shrink-0 cursor-pointer ${
                  activeCategory === "FAVORITES"
                    ? "bg-amber-400 text-zinc-950 shadow-2xs"
                    : "bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100"
                }`}
              >
                ⭐ Host favorites
              </button>
            )}

            {GUIDEBOOK_CATEGORIES.map((cat) => {
              const count = guidebook.items.filter((it) => it.category === cat.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`rounded-full px-3.5 py-1.5 font-semibold text-xs transition-all shrink-0 cursor-pointer ${
                    activeCategory === cat.id
                      ? "bg-zinc-900 text-white shadow-2xs"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {cat.icon} {cat.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative sm:w-64 shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search this guidebook..."
              className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-xs font-medium text-zinc-900 outline-none focus:bg-white focus:border-zinc-400 shadow-2xs"
            />
            <span className="absolute left-2.5 top-2 text-xs text-zinc-400">🔍</span>
          </div>
        </div>

        {/* Split Layout: Left Cards, Right Desktop Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Recommendations Cards */}
          <div className="lg:col-span-7 space-y-4">
            {filteredItems.length === 0 ? (
              <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center space-y-2">
                <span className="text-3xl">🔍</span>
                <h3 className="text-sm font-bold text-zinc-900">No matching recommendations</h3>
                <p className="text-xs text-zinc-500 font-normal">
                  Try clearing your search query or selecting a different category filter.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = activePlaceId === item.id;
                const icon = getCategoryIcon(item.category);
                const label = getCategoryLabel(item.category);

                return (
                  <article
                    key={item.id}
                    onMouseEnter={() => {
                      if (item.latitude && item.longitude) setActivePlaceId(item.id);
                    }}
                    className={`rounded-3xl border bg-white p-5 transition-all shadow-xs flex flex-col sm:flex-row items-start gap-5 ${
                      isSelected
                        ? "border-amber-400 ring-2 ring-amber-200 shadow-md"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    {/* Photo or Category Fallback */}
                    <div className="w-full sm:w-32 h-36 sm:h-32 rounded-2xl overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200/80 flex items-center justify-center relative">
                      {item.photo ? (
                        <img src={item.photo} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-4xl">{icon}</span>
                      )}
                      {item.isFavorite && (
                        <div className="absolute top-2 left-2 bg-amber-400 text-zinc-950 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                          ⭐ Favorite
                        </div>
                      )}
                    </div>

                    {/* Information */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="text-sm font-bold text-zinc-900 leading-snug truncate">
                            {item.title}
                          </h3>
                        </div>
                        <span className="text-xs text-zinc-500 font-medium">
                          {icon} {label}
                          {item.address ? ` · ${item.address}` : ""}
                        </span>
                      </div>

                      {/* Personal Host Recommendation Quote */}
                      {item.description && (
                        <p className="text-xs text-zinc-700 font-normal leading-relaxed italic border-l-2 border-amber-300 pl-3 py-0.5">
                          "{item.description}"
                        </p>
                      )}

                      {/* Host Insider Tip */}
                      {item.hostTip && (
                        <div className="p-2.5 rounded-2xl bg-amber-50/80 border border-amber-200/60 text-xs text-amber-900 font-medium flex items-start gap-2">
                          <span className="shrink-0 text-sm">💡</span>
                          <span className="leading-relaxed">
                            <strong className="font-bold">Host tip: </strong>
                            {item.hostTip}
                          </span>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* Right Column: Desktop Interactive Map */}
          <div className="hidden lg:block lg:col-span-5 sticky top-24">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Area Map ({mapPins.length} locations)
                </span>
                <span className="text-[11px] text-zinc-400">Interactive recommendations map</span>
              </div>
              <div className="h-[560px]">
                <GuidebookMap
                  places={mapPins}
                  activePlaceId={activePlaceId}
                  onSelectPlace={(id) => setActivePlaceId(id)}
                  centerLat={guidebook.items[0]?.latitude || 24.7136}
                  centerLng={guidebook.items[0]?.longitude || 46.6753}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Floating "Show Map" Button */}
      {mapPins.length > 0 && (
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
          <button
            type="button"
            onClick={() => setIsMobileMapOpen(true)}
            className="rounded-full bg-zinc-900 text-white font-semibold text-xs px-5 py-3 shadow-xl flex items-center gap-2 border border-zinc-700 cursor-pointer"
          >
            <span>🗺️</span>
            <span>Show Map ({mapPins.length})</span>
          </button>
        </div>
      )}

      {/* Mobile Fullscreen Map Drawer / Modal */}
      {isMobileMapOpen && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end lg:hidden">
          <div className="bg-white rounded-t-3xl w-full h-[85vh] p-4 flex flex-col space-y-3 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
              <span className="text-xs font-bold text-zinc-900">
                Guidebook Map ({mapPins.length} places)
              </span>
              <button
                type="button"
                onClick={() => setIsMobileMapOpen(false)}
                className="w-8 h-8 rounded-full border border-zinc-200 text-zinc-600 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 w-full rounded-2xl overflow-hidden">
              <GuidebookMap
                places={mapPins}
                activePlaceId={activePlaceId}
                onSelectPlace={(id) => {
                  setActivePlaceId(id);
                  setIsMobileMapOpen(false);
                }}
                centerLat={guidebook.items[0]?.latitude || 24.7136}
                centerLng={guidebook.items[0]?.longitude || 46.6753}
              />
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
