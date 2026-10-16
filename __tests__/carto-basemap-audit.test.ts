import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Load .env.local if present
const envLocalPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

import {
  getCartoTileUrl,
  MAP_CONFIG,
  CARTO_ATTRIBUTION,
  CARTO_SUBDOMAINS,
  type CartoLayer,
} from "../components/listings/search-map";
import { CartoTileLayer } from "../components/listings/carto-tile-layer";

console.log("\n==================================================================");
console.log("   CARTO BASEMAP TILE LAYER & API KEY AUDIT SUITE                 ");
console.log("==================================================================\n");

// --- [1] NEXT_PUBLIC_CARTO_API_KEY Configuration Audit ---
console.log("--- [1] Environment Variable Audit ---");
assert(
  fs.existsSync(envLocalPath),
  ".env.local file must exist in project root",
);
const envLocalContent = fs.readFileSync(envLocalPath, "utf-8");
assert(
  envLocalContent.includes("NEXT_PUBLIC_CARTO_API_KEY="),
  ".env.local must define NEXT_PUBLIC_CARTO_API_KEY",
);

const envExamplePath = path.resolve(__dirname, "../.env.example");
const envExampleContent = fs.readFileSync(envExamplePath, "utf-8");
assert(
  envExampleContent.includes("NEXT_PUBLIC_CARTO_API_KEY="),
  ".env.example must document NEXT_PUBLIC_CARTO_API_KEY",
);
console.log("✓ Environment variable NEXT_PUBLIC_CARTO_API_KEY verified in .env.local and .env.example!");

// --- [2] CARTO URL Construction & API Key Append Audit ---
console.log("\n--- [2] Tile URL Construction Audit ---");
const voyagerUrl = getCartoTileUrl("voyager");
console.log("Voyager URL:", voyagerUrl);
assert(
  voyagerUrl.startsWith("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}"),
  "Voyager URL must use CARTO rastertiles endpoint",
);
assert(
  voyagerUrl.includes("?key="),
  "Every CARTO tile request must have ?key= appended to eliminate 'API KEY REQUIRED' watermark",
);

// Verify standard CARTO layers
const layers: CartoLayer[] = [
  "voyager",
  "voyager_nolabels",
  "voyager_only_labels",
  "light_all",
];
for (const layer of layers) {
  const url = getCartoTileUrl(layer);
  assert(
    url.includes(`/rastertiles/${layer}/`),
    `Tile URL must correctly target CARTO layer: ${layer}`,
  );
  assert(
    url.includes("?key="),
    `Layer ${layer} must append ?key=`,
  );
}
console.log("✓ Standard CARTO layers (voyager, voyager_nolabels, voyager_only_labels, light_all) verified!");

// Verify Retina Option
const retinaUrl = getCartoTileUrl("voyager", { retina: true });
assert(
  retinaUrl.includes("{r}.png?key="),
  "Retina-enabled URL must include {r} placeholder before .png",
);
console.log("✓ Retina {r} option verified:", retinaUrl);

// --- [3] CARTO Map Config & Attribution Audit ---
console.log("\n--- [3] Map Configuration & Attribution Audit ---");
assert.strictEqual(MAP_CONFIG.maxZoom, 20, "MAP_CONFIG.maxZoom must be 20 for CARTO basemap");
assert.deepStrictEqual(
  CARTO_SUBDOMAINS,
  ["a", "b", "c", "d"],
  "CARTO subdomains must be ['a', 'b', 'c', 'd']",
);
assert(
  CARTO_ATTRIBUTION.includes("CARTO") && CARTO_ATTRIBUTION.includes("OpenStreetMap"),
  "CARTO_ATTRIBUTION must credit OpenStreetMap and CARTO",
);
assert(
  MAP_CONFIG.tileUrl.includes("?key="),
  "MAP_CONFIG.tileUrl must include ?key= query param",
);
console.log("✓ Map configuration (maxZoom 20, subdomains a/b/c/d, CARTO attribution) verified!");

// --- [4] React-Leaflet CartoTileLayer Component Audit ---
console.log("\n--- [4] React-Leaflet CartoTileLayer Component Audit ---");
assert.strictEqual(
  typeof CartoTileLayer,
  "function",
  "CartoTileLayer must be exported as a React functional component",
);
const cartoLayerCode = fs.readFileSync(
  path.resolve(__dirname, "../components/listings/carto-tile-layer.tsx"),
  "utf-8",
);
assert(
  cartoLayerCode.includes("TileLayer"),
  "carto-tile-layer.tsx must use TileLayer",
);
assert(
  cartoLayerCode.includes("?key="),
  "carto-tile-layer.tsx must append ?key= to tile URL",
);
assert(
  cartoLayerCode.includes("process.env.NEXT_PUBLIC_CARTO_API_KEY"),
  "carto-tile-layer.tsx must consume process.env.NEXT_PUBLIC_CARTO_API_KEY",
);
console.log("✓ React-Leaflet CartoTileLayer component verified!");

// --- [5] Source Code Watermark & Old URL Audit ---
console.log("\n--- [5] Source Code Cleanliness & Old URL Audit ---");
const searchMapSource = fs.readFileSync(
  path.resolve(__dirname, "../components/listings/search-map.tsx"),
  "utf-8",
);
// Ensure no unkeyed cartocdn URL exists in search-map.tsx
const unkeyedCarto = /basemaps\.cartocdn\.com\/[^\s"']+\.png(?!\?key=)/.test(searchMapSource);
assert(
  !unkeyedCarto,
  "No unkeyed CARTO tile URL should exist in search-map.tsx",
);
console.log("✓ No unkeyed CARTO tile URLs found in search-map.tsx!");

console.log("\n==================================================================");
console.log("   ALL CARTO BASEMAP AUDIT TESTS PASSED (5/5)                     ");
console.log("==================================================================\n");

