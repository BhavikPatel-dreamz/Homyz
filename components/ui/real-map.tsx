"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { MAP_CONFIG } from "@/components/listings/search-map";
import { reverseGeocodeLocation } from "@/lib/location/geocoding";

interface LeafletMapInstance {
  remove: () => void;
  setView: (center: [number, number], zoom: number) => void;
  getZoom: () => number;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface LeafletMarkerInstance {
  setLatLng: (center: [number, number]) => void;
  getLatLng: () => { lat: number; lng: number };
}

interface LeafletCircleInstance {
  setLatLng: (center: [number, number]) => void;
  setRadius: (radius: number) => void;
  setStyle: (style: { fillOpacity: number }) => void;
}

export interface LocationDetails {
  address?: string;
  apartment?: string;
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
  formattedAddress?: string;
}

interface RealMapProps {
  address?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  /** Keep a previously saved pin until the host deliberately changes address text. */
  preferInitialCoordinates?: boolean;
  showExactLocation?: boolean;
  /** Enables pin dragging, click-to-move, and address geocoding for host tools. */
  allowLocationEditing?: boolean;
  /** Defers the Leaflet bundle until this map reaches the viewport. */
  lazyLoad?: boolean;
  ariaLabel?: string;
  onLocationChange?: (lat: number, lng: number, details?: LocationDetails) => void;
  onLocationError?: (message: string) => void;
  className?: string;
}

export function RealMap({
  address = "",
  city = "Riyadh",
  country = "Saudi Arabia",
  lat: initialLat,
  lng: initialLng,
  preferInitialCoordinates = false,
  showExactLocation = true,
  allowLocationEditing = true,
  lazyLoad = false,
  ariaLabel = "Property location map",
  onLocationChange,
  onLocationError,
  className = "h-[220px] w-full rounded-3xl overflow-hidden border border-zinc-200 shadow-xs relative",
}: RealMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMapInstance | null>(null);
  const markerRef = useRef<LeafletMarkerInstance | null>(null);
  const circleRef = useRef<LeafletCircleInstance | null>(null);
  const isInternalUpdateRef = useRef(false);
  const didRunForwardGeocodeRef = useRef(false);
  const [shouldLoadMap, setShouldLoadMap] = useState(!lazyLoad);
  const [mapLoadError, setMapLoadError] = useState(false);

  // Default to Riyadh coordinates (24.7136, 46.6753) if not provided
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat || 24.7136,
    lng: initialLng || 46.6753,
  });

  const [isLoadingGeocode, setIsLoadingGeocode] = useState(false);
  const reverseDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const reverseCacheRef = useRef<Map<string, LocationDetails | null>>(new Map());
  const reverseRequestIdRef = useRef(0);

  // The public listing page keeps this heavy dependency below the fold. Host
  // editor maps opt out so their editable pin remains immediately available.
  useEffect(() => {
    if (!lazyLoad) {
      setShouldLoadMap(true);
      return;
    }
    const element = mapContainerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setShouldLoadMap(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoadMap(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [lazyLoad]);

  // Synchronize internal coords when parent lat/lng props change from outside (e.g. autocomplete selection)
  useEffect(() => {
    if (
      Number.isFinite(initialLat) &&
      Number.isFinite(initialLng) &&
      (initialLat !== coords.lat || initialLng !== coords.lng)
    ) {
      if (!isInternalUpdateRef.current) {
        setCoords({ lat: initialLat!, lng: initialLng! });
      }
      isInternalUpdateRef.current = false;
    }
  }, [initialLat, initialLng, coords.lat, coords.lng]);

  // Reverse geocode when map pin changes position with debouncing & caching
  const handlePositionChange = useCallback(
    (newLat: number, newLng: number) => {
      setCoords({ lat: newLat, lng: newLng });
      const requestId = ++reverseRequestIdRef.current;

      if (reverseDebounceRef.current) {
        clearTimeout(reverseDebounceRef.current);
      }

      setIsLoadingGeocode(true);
      reverseDebounceRef.current = setTimeout(async () => {
        const cacheKey = `${newLat.toFixed(5)},${newLng.toFixed(5)}`;
        const applyLocationChange = (details?: LocationDetails) => {
          if (requestId !== reverseRequestIdRef.current) return;

          isInternalUpdateRef.current = true;
          onLocationChange?.(newLat, newLng, details);
        };

        if (reverseCacheRef.current.has(cacheKey)) {
          applyLocationChange(reverseCacheRef.current.get(cacheKey) ?? undefined);
          if (requestId === reverseRequestIdRef.current) setIsLoadingGeocode(false);
          return;
        }

        try {
          const res = await reverseGeocodeLocation(newLat, newLng);
          if (res) {
            const details: LocationDetails = {
              address: res.streetAddress,
              apartment: res.apartment,
              district: res.district,
              city: res.city,
              state: res.state,
              postalCode: res.postalCode,
              country: res.country,
              countryCode: res.countryCode,
              formattedAddress: res.formattedAddress,
            };
            reverseCacheRef.current.set(cacheKey, details);
            applyLocationChange(details);
          } else {
            reverseCacheRef.current.set(cacheKey, null);
            applyLocationChange();
          }
        } catch {
          applyLocationChange();
        } finally {
          if (requestId === reverseRequestIdRef.current) setIsLoadingGeocode(false);
        }
      }, 350);
    },
    [onLocationChange]
  );

  // Forward Geocode: Update map center when text address/city changes from input boxes
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    if (!allowLocationEditing || (!address && !city)) return;

    // A saved coordinate is authoritative on first render. This prevents an
    // automatic forward-geocode of the displayed address from overwriting it.
    if (!didRunForwardGeocodeRef.current) {
      didRunForwardGeocodeRef.current = true;
      if (preferInitialCoordinates && Number.isFinite(initialLat) && Number.isFinite(initialLng)) {
        return;
      }
    }

    const fullQuery = [address, city, country].filter(Boolean).join(", ");
    if (!fullQuery) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setIsLoadingGeocode(true);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`,
          { signal: controller.signal, headers: { "User-Agent": "HomyzApp/1.0" } }
        );
        if (!response.ok) {
          throw new Error("We couldn't find that address. Move the pin or refine the address and try again.");
        }
        const data = await response.json();
        if (data && data.length > 0) {
          const newLat = parseFloat(data[0].lat);
          const newLng = parseFloat(data[0].lon);
          setCoords({ lat: newLat, lng: newLng });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          onLocationError?.(err instanceof Error ? err.message : "We couldn't resolve that address.");
        }
      } finally {
        setIsLoadingGeocode(false);
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [address, allowLocationEditing, city, country, initialLat, initialLng, onLocationError, preferInitialCoordinates]);

  // Load Leaflet CSS and Initialize Map
  useEffect(() => {
    if (!shouldLoadMap || !mapContainerRef.current) return;

    // Load Leaflet CSS dynamically if not already loaded
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Clean up previous instance if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 14,
        zoomControl: false,
      });

      // Match the listings search map basemap so the host editor and listing pages look consistent.
      L.tileLayer(MAP_CONFIG.tileUrl, {
        attribution: MAP_CONFIG.attribution,
        maxZoom: MAP_CONFIG.maxZoom,
        minZoom: MAP_CONFIG.minZoom,
        subdomains: MAP_CONFIG.subdomains,
      }).addTo(map);

      // Custom Homyz Yellow Pin Icon
      const customPinIcon = L.divIcon({
        className: "homyz-custom-pin",
        html: `<div style="width: 40px; height: 40px; border-radius: 9999px; background-color: #FEE08B; border: 2px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; items-center: center; justify-content: center; font-size: 18px; font-weight: bold; color: #09090b;">🏠</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      // Marker
      const marker = L.marker([coords.lat, coords.lng], {
        icon: customPinIcon,
        draggable: allowLocationEditing,
      }).addTo(map);

      // Radial Glow Area Circle (Matching Homyz location sharing design)
      const circle = L.circle([coords.lat, coords.lng], {
        color: "#FEE08B",
        fillColor: "#FEE08B",
        fillOpacity: showExactLocation ? 0.25 : 0.4,
        radius: showExactLocation ? 180 : 1_000,
        weight: 1.5,
      }).addTo(map);

      markerRef.current = marker;
      circleRef.current = circle;
      mapInstanceRef.current = map;

      // Click on map to reposition marker and update inputs dynamically
      if (allowLocationEditing) {
        map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
          const { lat: clickLat, lng: clickLng } = e.latlng;
          handlePositionChange(clickLat, clickLng);
        });

        // Drag marker to reposition and update inputs dynamically
        marker.on("dragend", () => {
          const position = marker.getLatLng();
          handlePositionChange(position.lat, position.lng);
        });
      }
    }).catch(() => {
      if (isMounted) setMapLoadError(true);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [allowLocationEditing, handlePositionChange, shouldLoadMap]);

  // Update map center & marker when coords or showExactLocation changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;

    mapInstanceRef.current.setView([coords.lat, coords.lng], mapInstanceRef.current.getZoom() || 14);
    markerRef.current.setLatLng([coords.lat, coords.lng]);

    if (circleRef.current) {
      circleRef.current.setLatLng([coords.lat, coords.lng]);
      circleRef.current.setRadius(showExactLocation ? 180 : 1_000);
      circleRef.current.setStyle({ fillOpacity: showExactLocation ? 0.25 : 0.4 });
    }
  }, [coords, showExactLocation]);

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  return (
    <div className={className}>
      <div ref={mapContainerRef} className="w-full h-full z-0" role="img" aria-label={ariaLabel} aria-busy={!shouldLoadMap} />

      {!shouldLoadMap && !mapLoadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 text-xs text-zinc-500">
          Loading map…
        </div>
      )}

      {mapLoadError && (
        <div role="status" className="absolute inset-0 flex items-center justify-center bg-zinc-100 px-4 text-center text-xs text-zinc-600">
          Map details are temporarily unavailable.
        </div>
      )}

      {/* Geocoding Loading Indicator */}
      {isLoadingGeocode && (
        <div className="absolute top-3 left-3 bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 shadow-xs z-10 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          Updating address details...
        </div>
      )}

      {/* Zoom Controls Overlay (Top Right - Matches Figma Layout) */}
      {!mapLoadError && shouldLoadMap && <div className="absolute top-3 right-3 flex flex-col gap-3 items-center text-xs font-semibold text-zinc-800 dark:text-zinc-100 z-10">
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 border border-transparent dark:border-zinc-700 cursor-pointer rounded-full transition-colors text-2xl font-normal shadow-md"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 border border-transparent dark:border-zinc-700 cursor-pointer rounded-full transition-colors text-2xl font-normal shadow-md"
          title="Zoom out"
        >
          <Image src="/images/icons/minus-icon.svg" alt="Zoom out" width={14} height={14} className="size-3.5 object-contain dark:invert" />
        </button>
      </div>}
    </div>
  );
}
