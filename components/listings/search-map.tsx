"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { PublicListingCardDTO } from "@/services/mappers";
import { getCurrencyForCountry } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";

// ─── Minimal Leaflet Type Stubs (SSR-safe) ────────────────────────────────────
interface LeafletMap {
  remove(): void;
  getBounds(): LeafletBounds;
  fitBounds(bounds: [[number, number], [number, number]], opts?: { padding: [number, number]; maxZoom?: number }): void;
  on(event: string, fn: (e?: unknown) => void): void;
  off(event: string, fn: (e?: unknown) => void): void;
  setView(center: [number, number], zoom: number): void;
  getZoom(): number;
  zoomIn(delta?: number): void;
  zoomOut(delta?: number): void;
  invalidateSize(options?: boolean | { debounceMoveend?: boolean }): void;
}

interface LeafletBounds {
  getNorthEast(): { lat: number; lng: number };
  getSouthWest(): { lat: number; lng: number };
}

interface LeafletMarker {
  remove(): void;
  on(event: string, fn: () => void): void;
  getElement?(): HTMLElement | undefined;
}

// ─── Configurable Tile Provider ───────────────────────────────────────────────
export type CartoLayer =
  | "voyager"
  | "voyager_nolabels"
  | "voyager_only_labels"
  | "light_all";

/**
 * Builds the CARTO basemap tile URL with the API key properly appended.
 * Appends ?key=${process.env.NEXT_PUBLIC_CARTO_API_KEY} to eliminate "API KEY REQUIRED" watermarks.
 * Supports standard CARTO layers: voyager, voyager_nolabels, voyager_only_labels, light_all.
 */
export function getCartoTileUrl(
  layer: CartoLayer = "voyager",
  options?: { retina?: boolean }
): string {
  const rawKey = process.env.NEXT_PUBLIC_CARTO_API_KEY ?? "";
  const key = rawKey.trim().replace(/^["']|["']$/g, "");
  const retinaSuffix = options?.retina ? "{r}" : "";
  return `https://{s}.basemaps.cartocdn.com/rastertiles/${layer}/{z}/{x}/{y}${retinaSuffix}.png?key=${key}`;
}

export const CARTO_ATTRIBUTION =
  '&copy; OpenStreetMap contributors &copy; CARTO';

export const CARTO_SUBDOMAINS = ["a", "b", "c", "d"];

/**
 * English-language raster tile URL.
 * Stadia Maps "Alidade Smooth" renders place labels in English (romanized script)
 * globally — including Arabic-script regions like Saudi Arabia and UAE.
 * This replaces CARTO raster tiles which bake in local-script labels (Arabic, etc.)
 * that cannot be overridden at runtime.
 * No API key required for standard usage; supports {r} retina suffix.
 */
const ENGLISH_TILE_URL =
  "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png";
const ENGLISH_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> ' +
  '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';

export const MAP_CONFIG = {
  // Stadia Maps Alidade Smooth — English labels globally (no local-script Arabic watermarks)
  // Override via NEXT_PUBLIC_MAP_TILE_URL env var to use a custom tile provider
  tileUrl:
    process.env.NEXT_PUBLIC_MAP_TILE_URL ||
    ENGLISH_TILE_URL,
  attribution:
    process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
    ENGLISH_ATTRIBUTION,
  subdomains: [] as string[], // Stadia Maps uses a single host, no sub-domain rotation needed
  maxZoom: 20,
  minZoom: 2,
  defaultCenter: [24.7136, 46.6753] as [number, number], // Riyadh default / fallback (SAR)
  defaultZoom: 13,
};

export { CartoTileLayer } from "./carto-tile-layer";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ListingForMap = Pick<
  PublicListingCardDTO,
  "id" | "title" | "price" | "city" | "country" | "latitude" | "longitude"
>;

export interface SearchMapProps {
  listings: ListingForMap[];
  highlightedId?: string | null;
  /** Called when the user triggers a bounds-based area search */
  onBoundsChange?: (bounds: {
    neLat: number;
    neLng: number;
    swLat: number;
    swLng: number;
  }) => void;
  /** Called when a price marker is clicked — parent handles selection/scroll */
  onMarkerClick?: (listingId: string) => void;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  className?: string;
  center?: [number, number];
  zoom?: number;
}

interface PositionedListing {
  listing: ListingForMap;
  lat: number;
  lng: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function loadLeaflet() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L = (await import("leaflet" as any)) as any;
  // Suppress default icon URL resolution (we use custom price badges / pills)
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  return L;
}

/** Returns an inline CSS string for the price pill marker. */
function pillStyle(isHighlighted: boolean): string {
  return [
    `background:${isHighlighted ? "#18181b" : "#ffffff"}`,
    `color:${isHighlighted ? "#fbde9b" : "#18181b"}`,
    `border:2px solid ${isHighlighted ? "#18181b" : "#e4e4e7"}`,
    "border-radius:24px",
    "padding:4px 10px",
    "font-size:12px",
    "font-weight:700",
    "white-space:nowrap",
    `box-shadow:0 3px 10px rgba(0,0,0,${isHighlighted ? ".28" : ".12"})`,
    "cursor:pointer",
    "line-height:1.3",
    "letter-spacing:-0.01em",
    "transition:transform 0.15s ease,box-shadow 0.15s ease,background-color 0.15s ease",
    `transform:${isHighlighted ? "scale(1.15)" : "scale(1)"}`,
    "position:relative",
    `z-index:${isHighlighted ? "1000" : "10"}`,
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
  ].join(";");
}

/** Updates every marker's DOM style in-place — avoids rebuilding all markers on card hover. */
function applyHighlights(
  markersRef: React.MutableRefObject<Map<string, LeafletMarker>>,
  highlightedId: string | null | undefined,
) {
  markersRef.current.forEach((marker, id) => {
    const el = marker.getElement?.();
    if (!el) return;
    const inner = el.querySelector("div") as HTMLElement | null;
    if (!inner) return;
    inner.style.cssText = pillStyle(id === highlightedId);
  });
}

/**
 * Detects identical or extremely close coordinates (< 0.00015 distance)
 * and distributes them radially so all stays are distinctly visible and clickable.
 */
function resolveCoordinateCollisions(listings: ListingForMap[]): PositionedListing[] {
  const result: PositionedListing[] = [];
  const groups = new Map<string, ListingForMap[]>();

  for (const item of listings) {
    if (
      typeof item.latitude !== "number" ||
      typeof item.longitude !== "number" ||
      !Number.isFinite(item.latitude) ||
      !Number.isFinite(item.longitude) ||
      (item.latitude === 0 && item.longitude === 0)
    ) {
      continue;
    }
    // Round to 4 decimal places (~11 meters) to detect collisions
    const key = `${item.latitude.toFixed(4)}_${item.longitude.toFixed(4)}`;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  groups.forEach((items) => {
    if (items.length === 1) {
      result.push({
        listing: items[0],
        lat: items[0].latitude!,
        lng: items[0].longitude!,
      });
    } else {
      // Multiple listings at the exact same coordinates: apply slight radial offset (~15m)
      const centerLat = items[0].latitude!;
      const centerLng = items[0].longitude!;
      const count = items.length;
      const radius = 0.00018;

      items.forEach((item, index) => {
        const angle = (index / count) * 2 * Math.PI;
        result.push({
          listing: item,
          lat: centerLat + radius * Math.cos(angle),
          lng: centerLng + radius * Math.sin(angle),
        });
      });
    }
  });

  return result;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function SearchMap({
  listings,
  highlightedId,
  onBoundsChange,
  onMarkerClick,
  checkIn,
  checkOut,
  guests,
  className = "w-full h-full",
  center,
  zoom = 13,
}: SearchMapProps) {
  const { formatPrice } = useCurrency();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const bounceDebounce = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticMoveRef = useRef(false);

  /**
   * Tracks the ID of the first listing in the CURRENT result set.
   * When it changes, we know it's a brand-new search (not an infinite-scroll append)
   * and we should fit the map bounds to the new results.
   */
  const firstListingIdRef = useRef<string | null>(null);

  /** Always-current reference to highlightedId — used inside async Effects. */
  const highlightedIdRef = useRef(highlightedId);
  highlightedIdRef.current = highlightedId;

  const [mapError, setMapError] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [searchAsMove, setSearchAsMove] = useState(false);

  // ── Stable callbacks ────────────────────────────────────────────────────────
  const buildDetailUrl = useCallback(
    (listingId: string) => {
      const params = new URLSearchParams();
      if (checkIn) params.set("checkIn", checkIn);
      if (checkOut) params.set("checkOut", checkOut);
      if (guests && guests > 1) params.set("guests", String(guests));
      const qs = params.toString();
      return `/listings/${listingId}${qs ? `?${qs}` : ""}`;
    },
    [checkIn, checkOut, guests],
  );

  const triggerBoundsSearch = useCallback(() => {
    const activeMap = mapRef.current || mapInstance;
    if (!activeMap || !onBoundsChange) return;
    const bounds = activeMap.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    setHasMoved(false);
    onBoundsChange({ neLat: ne.lat, neLng: ne.lng, swLat: sw.lat, swLng: sw.lng });
  }, [mapInstance, onBoundsChange]);

  const handleUserMapMovement = useCallback(() => {
    // If the movement was triggered by our own code (setView / fitBounds),
    // swallow the event so we don't enter a search → fitBounds → search loop.
    if (isProgrammaticMoveRef.current) {
      isProgrammaticMoveRef.current = false;
      return;
    }
    if (searchAsMove) {
      if (bounceDebounce.current) clearTimeout(bounceDebounce.current);
      bounceDebounce.current = setTimeout(() => triggerBoundsSearch(), 600);
    } else {
      setHasMoved(true);
    }
  }, [searchAsMove, triggerBoundsSearch]);

  // ── Effect 1: Initialize Leaflet map — runs ONCE ──────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      try {
        if (!document.getElementById("leaflet-css")) {
          const link = document.createElement("link");
          link.id = "leaflet-css";
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(link);
        }

        const L = await loadLeaflet();
        if (!isMounted || !containerRef.current || mapRef.current) return;

        const initialCenter: [number, number] = center ?? MAP_CONFIG.defaultCenter;
        const map = L.map(containerRef.current, {
          zoomControl: false, // We provide modern custom controls (+ / -)
          scrollWheelZoom: true, // Enable mouse wheel zoom in and zoom out
          doubleClickZoom: true, // Enable double-click zooming
          touchZoom: true, // Enable touch pinch zoom
        }) as LeafletMap;

        isProgrammaticMoveRef.current = true;
        map.setView(initialCenter, zoom);

        L.tileLayer(MAP_CONFIG.tileUrl, {
          attribution: MAP_CONFIG.attribution,
          subdomains: MAP_CONFIG.subdomains,
          maxZoom: MAP_CONFIG.maxZoom,
          minZoom: MAP_CONFIG.minZoom,
        }).addTo(map);

        mapRef.current = map;
        setMapInstance(map);

        const moveHandler = () => handleUserMapMovement();
        map.on("dragend", moveHandler);
        map.on("zoomend", moveHandler);

        if (typeof ResizeObserver !== "undefined" && containerRef.current) {
          resizeObserver = new ResizeObserver(() => {
            if (mapRef.current) {
              mapRef.current.invalidateSize();
            }
          });
          resizeObserver.observe(containerRef.current);
        }
      } catch (err) {
        if (isMounted) {
          setMapError("Map failed to load. Property results are still available below.");
          console.error("[SearchMap] Leaflet initialization error:", err);
        }
      }
    })();

    return () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapInstance(null);
      }
      if (bounceDebounce.current) clearTimeout(bounceDebounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Effect 2: Sync map center when destination coordinates change ────────
  useEffect(() => {
    const activeMap = mapRef.current || mapInstance;
    if (!activeMap || !center) return;
    // Only set view if there are no listings to frame yet
    if (listings.length === 0) {
      isProgrammaticMoveRef.current = true;
      activeMap.setView(center, zoom);
      setHasMoved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInstance, center?.[0], center?.[1], zoom]);

  // ── Effect 3: Rebuild price markers & auto-fit bounds on listings change ──
  useEffect(() => {
    const activeMap = mapRef.current || mapInstance;
    if (!activeMap) return;
    let isMounted = true;

    (async () => {
      const L = await loadLeaflet();
      if (!isMounted) return;
      const map = mapRef.current || mapInstance;
      if (!map) return;

      // Remove previous markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      // Resolve coordinate collisions (offset identical addresses so all are visible)
      const positionedListings = resolveCoordinateCollisions(listings);

      // Detect brand-new search vs. infinite-scroll append
      const newFirstId = positionedListings[0]?.listing.id ?? null;
      const isNewSearch = newFirstId !== firstListingIdRef.current;
      firstListingIdRef.current = newFirstId;

      if (positionedListings.length === 0) {
        return;
      }

      const allCoords: [number, number][] = [];

      // Render individual price markers for ALL listings so they appear immediately on first load
      for (const item of positionedListings) {
        const listing = item.listing;
        const lat = item.lat;
        const lng = item.lng;
        const currency = getCurrencyForCountry(listing.country);
        // Formats as e.g. SAR 450, £99, $120
        const priceLabel = formatPrice(listing.price, currency);

        const icon = L.divIcon({
          html: `<div style="${pillStyle(false)}">${priceLabel}</div>`,
          className: "leaflet-price-pill",
          iconAnchor: [28, 14],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(map) as LeafletMarker;

        marker.on("click", () => {
          if (onMarkerClick) {
            onMarkerClick(listing.id);
          } else {
            window.location.href = buildDetailUrl(listing.id);
          }
        });

        markersRef.current.set(listing.id, marker);
        allCoords.push([lat, lng]);
      }

      // Apply current highlight in-place
      applyHighlights(markersRef, highlightedIdRef.current);

      // Auto-fit bounds so all property locations are immediately visible in the map on first load
      if (isNewSearch && allCoords.length > 0) {
        const lats = allCoords.map((c) => c[0]);
        const lngs = allCoords.map((c) => c[1]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        isProgrammaticMoveRef.current = true;
        if (minLat === maxLat && minLng === maxLng) {
          map.setView([minLat, minLng], 14);
        } else {
          map.fitBounds(
            [
              [minLat, minLng],
              [maxLat, maxLng],
            ],
            { padding: [50, 50], maxZoom: 15 },
          );
        }
      }
    })();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInstance, listings, buildDetailUrl, onMarkerClick, formatPrice]);

  // ── Effect 4: In-place highlight update — no marker rebuild ──────────────
  useEffect(() => {
    applyHighlights(markersRef, highlightedId);
  }, [highlightedId]);

  // ── Zoom Controls Handlers ────────────────────────────────────────────────
  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  // ── Error state ───────────────────────────────────────────────────────────
  if (mapError) {
    return (
      <div
        className={`relative ${className} bg-zinc-50 flex flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-200`}
        role="alert"
      >
        <span className="text-3xl" aria-hidden="true">🗺️</span>
        <p className="text-xs text-zinc-500 text-center px-6 font-medium max-w-[220px]">
          {mapError}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label="Property location map"
        role="region"
      />

      {/* Modern Airbnb-Style Zoom Controls (+ / -) */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col bg-white/95 backdrop-blur-md rounded-xl border border-zinc-200/80 shadow-md overflow-hidden">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          className="w-8 h-8 flex items-center justify-center text-zinc-800 hover:bg-zinc-100 transition-colors border-b border-zinc-100 text-sm font-semibold cursor-pointer"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          className="w-8 h-8 flex items-center justify-center text-zinc-800 hover:bg-zinc-100 transition-colors text-sm font-semibold cursor-pointer"
        >
          −
        </button>
      </div>

      {/* Floating "Search this area" button — appears after user pans/zooms */}
      {hasMoved && onBoundsChange && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in zoom-in-95 duration-200">
          <button
            type="button"
            onClick={triggerBoundsSearch}
            className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-900 font-semibold px-4 py-2.5 rounded-full shadow-lg border border-zinc-200 transition-all text-xs cursor-pointer hover:shadow-xl active:scale-95"
          >
            <svg
              className="w-3.5 h-3.5 text-zinc-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <span>Search this area</span>
          </button>
        </div>
      )}

      {/* "Search as I move the map" checkbox */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-200/80 shadow-md flex items-center gap-2 text-xs font-medium text-zinc-800">
        <input
          type="checkbox"
          id="search-as-move"
          checked={searchAsMove}
          onChange={(e) => {
            setSearchAsMove(e.target.checked);
            if (e.target.checked && hasMoved) triggerBoundsSearch();
          }}
          className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
        />
        <label htmlFor="search-as-move" className="cursor-pointer select-none text-[11px] font-semibold text-zinc-700">
          Search as I move the map
        </label>
      </div>
    </div>
  );
}
