"use client";

import React, { useEffect, useRef } from "react";
import { getCategoryIcon } from "@/lib/validation/guidebook";

export interface MapPlacePin {
  id: string;
  title: string;
  category: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  isFavorite?: boolean;
}

interface GuidebookMapProps {
  places: MapPlacePin[];
  activePlaceId?: string | null;
  onSelectPlace?: (id: string) => void;
  centerLat?: number;
  centerLng?: number;
  className?: string;
}

export function GuidebookMap({
  places,
  activePlaceId,
  onSelectPlace,
  centerLat = 24.7136,
  centerLng = 46.6753,
  className = "w-full h-full min-h-[360px] rounded-3xl overflow-hidden border border-zinc-200 relative shadow-2xs",
}: GuidebookMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const markersMapRef = useRef<Map<string, any>>(new Map());

  // Filter valid places with coordinates
  const validPlaces = places.filter(
    (p) =>
      p.latitude != null &&
      p.longitude != null &&
      !isNaN(p.latitude) &&
      !isNaN(p.longitude) &&
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude)
  );

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let isMounted = true;

    // Load Leaflet CSS if not already loaded
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Clean up previous instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const initialCenter =
        validPlaces.length > 0
          ? [validPlaces[0].latitude!, validPlaces[0].longitude!]
          : [centerLat, centerLng];

      const map = L.map(mapContainerRef.current, {
        center: initialCenter as [number, number],
        zoom: validPlaces.length > 0 ? 13 : 12,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      markersGroupRef.current = markersGroup;

      renderMarkers(L);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when places or active place changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import("leaflet").then((L) => {
      renderMarkers(L);
    });
  }, [places, activePlaceId]);

  const renderMarkers = (L: any) => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;
    markersGroupRef.current.clearLayers();
    markersMapRef.current.clear();

    const bounds = L.latLngBounds([]);

    validPlaces.forEach((place, index) => {
      const isSelected = activePlaceId === place.id;
      const iconText = getCategoryIcon(place.category);

      const markerHtml = `
        <div class="cursor-pointer transition-all transform duration-200 ${
          isSelected ? "scale-125 z-50" : "hover:scale-110 z-10"
        }">
          <div class="flex items-center justify-center w-8 h-8 rounded-full border-2 ${
            isSelected
              ? "bg-[#FEE08B] border-amber-500 shadow-md ring-2 ring-amber-300"
              : place.isFavorite
              ? "bg-amber-100 border-amber-400 shadow-xs"
              : "bg-white border-zinc-300 shadow-xs"
          } text-xs font-bold text-zinc-900">
            ${place.isFavorite ? "⭐" : iconText}
          </div>
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-zinc-800 rotate-45 rounded-[1px]"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "custom-guidebook-pin",
        html: markerHtml,
        iconSize: [32, 36],
        iconAnchor: [16, 36],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([place.latitude!, place.longitude!], {
        icon: customIcon,
      }).addTo(markersGroupRef.current);

      marker.bindPopup(`
        <div class="p-1 font-sans text-xs">
          <p class="font-bold text-zinc-900 leading-tight">${place.title}</p>
          ${place.address ? `<p class="text-[10px] text-zinc-500 mt-0.5">${place.address}</p>` : ""}
          ${place.isFavorite ? `<span class="inline-block mt-1 text-[9px] bg-amber-100 text-amber-900 font-semibold px-1.5 py-0.5 rounded">⭐ Host favorite</span>` : ""}
        </div>
      `);

      marker.on("click", () => {
        onSelectPlace?.(place.id);
      });

      markersMapRef.current.set(place.id, marker);
      bounds.extend([place.latitude!, place.longitude!]);
    });

    // Auto-fit bounds if we have pins
    if (validPlaces.length > 1 && bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else if (validPlaces.length === 1) {
      mapInstanceRef.current.setView(
        [validPlaces[0].latitude!, validPlaces[0].longitude!],
        14
      );
    }
  };

  // Center on active pin when selected
  useEffect(() => {
    if (!activePlaceId || !mapInstanceRef.current) return;
    const activePlace = validPlaces.find((p) => p.id === activePlaceId);
    if (activePlace?.latitude && activePlace?.longitude) {
      mapInstanceRef.current.panTo([activePlace.latitude, activePlace.longitude], {
        animate: true,
        duration: 0.5,
      });
      const marker = markersMapRef.current.get(activePlaceId);
      marker?.openPopup();
    }
  }, [activePlaceId]);

  return (
    <div className={className}>
      <div ref={mapContainerRef} className="w-full h-full" />
      {validPlaces.length === 0 && (
        <div className="absolute inset-0 bg-zinc-50/80 backdrop-blur-2xs flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <span className="text-3xl mb-2">🗺️</span>
          <p className="text-xs font-semibold text-zinc-700">Add places with addresses</p>
          <p className="text-[11px] text-zinc-400 mt-0.5 max-w-xs">
            Places you add with locations will appear as interactive pins on this map.
          </p>
        </div>
      )}
    </div>
  );
}
