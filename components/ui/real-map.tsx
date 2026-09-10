"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface LocationDetails {
  address?: string;
  city?: string;
  district?: string;
  postalCode?: string;
  country?: string;
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
  onLocationChange,
  onLocationError,
  className = "h-[220px] w-full rounded-3xl overflow-hidden border border-zinc-200 shadow-xs relative",
}: RealMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const isInternalUpdateRef = useRef(false);
  const didRunForwardGeocodeRef = useRef(false);

  // Default to Riyadh coordinates (24.7136, 46.6753) if not provided
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat || 24.7136,
    lng: initialLng || 46.6753,
  });

  const [isLoadingGeocode, setIsLoadingGeocode] = useState(false);
  const reverseCacheRef = useRef<Map<string, LocationDetails>>(new Map());
  const reverseDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Reverse geocode when map pin changes position with debouncing & caching
  const handlePositionChange = useCallback(
    (newLat: number, newLng: number) => {
      setCoords({ lat: newLat, lng: newLng });

      if (reverseDebounceRef.current) {
        clearTimeout(reverseDebounceRef.current);
      }

      const cacheKey = `${newLat.toFixed(4)},${newLng.toFixed(4)}`;
      const cached = reverseCacheRef.current.get(cacheKey);
      if (cached) {
        isInternalUpdateRef.current = true;
        if (onLocationChange) {
          onLocationChange(newLat, newLng, cached);
        }
        return;
      }

      setIsLoadingGeocode(true);
      reverseDebounceRef.current = setTimeout(async () => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}&zoom=18&addressdetails=1`,
            { headers: { "User-Agent": "HomyzApp/1.0" } }
          );
          if (!response.ok) {
            throw new Error(`Nominatim reverse error ${response.status}`);
          }
          const data = await response.json();

          if (data && data.address) {
            const a = data.address;
            const streetAddress = a.road || a.pedestrian || a.suburb || a.neighbourhood || a.amenity || "";
            const cityName = a.city || a.town || a.municipality || a.county || a.state || "";
            const districtName = a.suburb || a.neighbourhood || a.city_district || "";
            const postalCodeStr = a.postcode || "";
            const countryName = a.country || "";
            const fullAddress = data.display_name || [streetAddress, districtName, cityName, countryName].filter(Boolean).join(", ");

            const details: LocationDetails = {
              address: streetAddress,
              city: cityName,
              district: districtName,
              postalCode: postalCodeStr,
              country: countryName,
              formattedAddress: fullAddress,
            };

            reverseCacheRef.current.set(cacheKey, details);
            isInternalUpdateRef.current = true;

            if (onLocationChange) {
              onLocationChange(newLat, newLng, details);
            }
          } else if (onLocationChange) {
            onLocationChange(newLat, newLng);
          }
        } catch {
          // Graceful fallback on network or rate limit failure: maintain coordinates safely
          if (onLocationChange) onLocationChange(newLat, newLng);
        } finally {
          setIsLoadingGeocode(false);
        }
      }, 400);
    },
    [onLocationChange]
  );

  // Forward Geocode: Update map center when text address/city changes from input boxes
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    if (!address && !city) return;

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
  }, [address, city, country, initialLat, initialLng, onLocationError, preferInitialCoordinates]);

  // Load Leaflet CSS and Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

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

      // Tile Layer (OpenStreetMap)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
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
        draggable: true,
      }).addTo(map);

      // Radial Glow Area Circle (Matching Homyz location sharing design)
      const circle = L.circle([coords.lat, coords.lng], {
        color: "#FEE08B",
        fillColor: "#FEE08B",
        fillOpacity: showExactLocation ? 0.25 : 0.4,
        radius: showExactLocation ? 180 : 450,
        weight: 1.5,
      }).addTo(map);

      markerRef.current = marker;
      circleRef.current = circle;
      mapInstanceRef.current = map;

      // Click on map to reposition marker and update inputs dynamically
      map.on("click", (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        handlePositionChange(clickLat, clickLng);
      });

      // Drag marker to reposition and update inputs dynamically
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        handlePositionChange(position.lat, position.lng);
      });
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [handlePositionChange]); // Run once on mount

  // Update map center & marker when coords or showExactLocation changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;

    mapInstanceRef.current.setView([coords.lat, coords.lng], mapInstanceRef.current.getZoom() || 14);
    markerRef.current.setLatLng([coords.lat, coords.lng]);

    if (circleRef.current) {
      circleRef.current.setLatLng([coords.lat, coords.lng]);
      circleRef.current.setRadius(showExactLocation ? 180 : 450);
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
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Geocoding Loading Indicator */}
      {isLoadingGeocode && (
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-200 text-[11px] font-semibold text-zinc-700 shadow-xs z-10 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          Updating address details...
        </div>
      )}

      {/* Zoom Controls Overlay (Top Right - Matches Figma Layout) */}
      <div className="absolute top-3 right-3 flex flex-col gap-3 items-center divide-y divide-zinc-200 text-xs font-semibold text-zinc-800 z-10">
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-8 h-8 flex items-center justify-center bg-white hover:bg-zinc-100 cursor-pointer rounded-full transition-colors text-2xl font-normal shadow-md"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-8 h-8 flex items-center justify-center bg-white hover:bg-zinc-100 cursor-pointer rounded-full transition-colors text-2xl font-normal shadow-md"
          title="Zoom out"
        >
          -
        </button>
      </div>
    </div>
  );
}
