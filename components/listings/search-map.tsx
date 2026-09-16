"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { PublicListingDTO } from "@/services/mappers";

interface SearchMapProps {
  listings: Pick<PublicListingDTO, "id" | "title" | "price" | "city" | "latitude" | "longitude">[];
  highlightedId?: string | null;
  /** Called when the user searches the current map viewport bounds */
  onBoundsChange?: (bounds: {
    neLat: number;
    neLng: number;
    swLat: number;
    swLng: number;
  }) => void;
  onMarkerClick?: (listingId: string) => void;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  className?: string;
  center?: [number, number];
  zoom?: number;
}

interface LeafletMap {
  remove(): void;
  getBounds(): LeafletBounds;
  fitBounds(bounds: [[number, number], [number, number]], opts?: { padding: [number, number] }): void;
  on(event: string, fn: (e?: any) => void): void;
  off(event: string, fn: (e?: any) => void): void;
  setView(center: [number, number], zoom: number): void;
  getZoom(): number;
}

interface LeafletBounds {
  getNorthEast(): { lat: number; lng: number };
  getSouthWest(): { lat: number; lng: number };
}

interface LeafletMarker {
  remove(): void;
  on(event: string, fn: () => void): void;
}

// Dynamic Leaflet import to avoid SSR issues
async function loadLeaflet() {
  const L = (await import("leaflet" as any)) as any;
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
  return L;
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const bounceDebounce = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticMoveRef = useRef(false);

  const [hasMoved, setHasMoved] = useState(false);
  const [searchAsMove, setSearchAsMove] = useState(false);

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
    if (!mapRef.current || !onBoundsChange) return;
    const bounds = mapRef.current.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    setHasMoved(false);
    onBoundsChange({ neLat: ne.lat, neLng: ne.lng, swLat: sw.lat, swLng: sw.lng });
  }, [onBoundsChange]);

  const handleUserMapMovement = useCallback(() => {
    if (isProgrammaticMoveRef.current) {
      isProgrammaticMoveRef.current = false;
      return;
    }

    if (searchAsMove) {
      if (bounceDebounce.current) clearTimeout(bounceDebounce.current);
      bounceDebounce.current = setTimeout(() => {
        triggerBoundsSearch();
      }, 600);
    } else {
      setHasMoved(true);
    }
  }, [searchAsMove, triggerBoundsSearch]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let isMounted = true;

    (async () => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const L = await loadLeaflet();
      if (!isMounted || !containerRef.current || mapRef.current) return;

      const initialCenter: [number, number] = center || [24.7136, 46.6753];
      const map = L.map(containerRef.current, { zoomControl: true }) as LeafletMap;
      isProgrammaticMoveRef.current = true;
      map.setView(initialCenter, zoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      mapRef.current = map;

      const moveHandler = () => handleUserMapMovement();
      map.on("dragend", moveHandler);
      map.on("zoomend", moveHandler);
    })();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Center update when props change
  useEffect(() => {
    if (!mapRef.current || !center) return;
    isProgrammaticMoveRef.current = true;
    mapRef.current.setView(center, zoom);
    setHasMoved(false);
  }, [center?.[0], center?.[1], zoom]);

  // Update markers when listings change
  useEffect(() => {
    if (!mapRef.current) return;

    let isMounted = true;

    (async () => {
      const L = await loadLeaflet();
      if (!isMounted || !mapRef.current) return;

      const map = mapRef.current;

      // Remove old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      const validListings = listings.filter(
        (l) =>
          typeof l.latitude === "number" &&
          typeof l.longitude === "number" &&
          Number.isFinite(l.latitude) &&
          Number.isFinite(l.longitude),
      );

      if (validListings.length === 0) {
        if (center) {
          isProgrammaticMoveRef.current = true;
          map.setView(center, zoom);
        }
        return;
      }

      const bounds: [[number, number], [number, number]][] = [];

      for (const listing of validListings) {
        const lat = listing.latitude as number;
        const lng = listing.longitude as number;
        const priceSAR = Math.round(listing.price / 100);
        const isHighlighted = listing.id === highlightedId;

        // Price pill marker (Airbnb-style)
        const icon = L.divIcon({
          html: `<div style="
            background:${isHighlighted ? "#1f1f1f" : "#fff"};
            color:${isHighlighted ? "#FCDF9C" : "#1f1f1f"};
            border:2px solid ${isHighlighted ? "#1f1f1f" : "#d4d4d8"};
            border-radius:20px;
            padding:3px 8px;
            font-size:12px;
            font-weight:600;
            white-space:nowrap;
            box-shadow:0 1px 4px rgba(0,0,0,.18);
            cursor:pointer;
          ">SAR ${priceSAR}</div>`,
          className: "",
          iconAnchor: [0, 0],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(map) as LeafletMarker;

        const detailUrl = buildDetailUrl(listing.id);
        marker.on("click", () => {
          if (onMarkerClick) {
            onMarkerClick(listing.id);
          } else {
            window.location.href = detailUrl;
          }
        });

        markersRef.current.set(listing.id, marker);
        bounds.push([[lat, lng], [lat, lng]]);
      }

      // If user searched for a specific center, keep map on that center!
      // Otherwise fit bounds to all listings
      if (center) {
        isProgrammaticMoveRef.current = true;
        map.setView(center, zoom);
      } else if (bounds.length > 0) {
        const allCoords: [number, number][] = validListings.map((l) => [
          l.latitude as number,
          l.longitude as number,
        ]);
        const latitudes = allCoords.map((c) => c[0]);
        const longitudes = allCoords.map((c) => c[1]);
        const sw: [number, number] = [Math.min(...latitudes), Math.min(...longitudes)];
        const ne: [number, number] = [Math.max(...latitudes), Math.max(...longitudes)];
        isProgrammaticMoveRef.current = true;
        map.fitBounds([sw, ne], { padding: [40, 40] });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [listings, highlightedId, buildDetailUrl, onMarkerClick, center?.[0], center?.[1], zoom]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label="Property location map"
        role="region"
      />

      {/* Floating "Search this area" Button (Airbnb style) */}
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

      {/* Bottom map overlay: "Search as I move the map" checkbox */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-200 shadow-md flex items-center gap-2 text-xs font-medium text-zinc-800">
        <input
          type="checkbox"
          id="search-as-move"
          checked={searchAsMove}
          onChange={(e) => {
            setSearchAsMove(e.target.checked);
            if (e.target.checked && hasMoved) {
              triggerBoundsSearch();
            }
          }}
          className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
        />
        <label htmlFor="search-as-move" className="cursor-pointer select-none text-[11px]">
          Search as I move the map
        </label>
      </div>
    </div>
  );
}
