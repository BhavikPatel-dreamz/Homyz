"use client";

import React, { useEffect, useState } from "react";
import type { TileLayerProps } from "react-leaflet";

/**
 * Standard CARTO Basemap TileLayer for React Leaflet.
 * Uses NEXT_PUBLIC_CARTO_API_KEY from environment to prevent "API KEY REQUIRED" watermarks.
 * SSR-safe for Next.js and testing environments.
 */
export function CartoTileLayer(props?: Partial<TileLayerProps>) {
  const [TileComponent, setTileComponent] = useState<React.ComponentType<TileLayerProps> | null>(null);

  useEffect(() => {
    let isMounted = true;
    import("react-leaflet").then((mod) => {
      if (isMounted) {
        setTileComponent(() => mod.TileLayer);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!TileComponent) return null;

  const rawKey = process.env.NEXT_PUBLIC_CARTO_API_KEY ?? "";
  const apiKey = rawKey.trim().replace(/^["']|["']$/g, "");
  const tileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${apiKey}`;

  return (
    <TileComponent
      url={tileUrl}
      attribution="&copy; OpenStreetMap contributors &copy; CARTO"
      subdomains={["a", "b", "c", "d"]}
      maxZoom={20}
      {...props}
    />
  );
}

