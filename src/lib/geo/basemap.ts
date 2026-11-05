import type { StyleSpecification } from "maplibre-gl";

/**
 * Satellite base map: EOX Sentinel-2 cloudless mosaic (WMTS, Web Mercator).
 *
 * The layer year is the only knob. Per EOX's WMTSCapabilities (checked on
 * 2026-11-05), 2016 and 2017 are CC BY 4.0 and 2018 onwards are
 * CC BY-NC-SA 4.0. The 2017 mosaic has no data over Brazil (blank tiles), so
 * 2016 is the only unrestricted option with coverage of the pilot region.
 * See DATA_SOURCES.md and docs/decisoes.md.
 */
export const BASEMAP_YEAR = 2016;

/** WMTS layer identifiers as published in EOX's GetCapabilities. */
export function eoxLayerId(year: number): string {
  // 2016 is published without a year suffix.
  return year === 2016 ? "s2cloudless_3857" : `s2cloudless-${year}_3857`;
}

export function eoxTileUrl(year: number): string {
  return `https://tiles.maps.eox.at/wmts/1.0.0/${eoxLayerId(year)}/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg`;
}

export function eoxAttribution(year: number): string {
  const license =
    year <= 2017
      ? '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>'
      : '<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a>';
  return (
    `<a href="https://cloudless.eox.at" target="_blank" rel="noopener">EOxCloudless</a> ` +
    `by <a href="https://eox.at" target="_blank" rel="noopener">EOX IT Services GmbH</a> ` +
    `(Contains modified Copernicus Sentinel data ${year}), ${license}`
  );
}

export function buildBasemapStyle(year: number = BASEMAP_YEAR): StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: [eoxTileUrl(year)],
        tileSize: 256,
        maxzoom: 17,
        attribution: eoxAttribution(year),
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#173427" } },
      { id: "satellite", type: "raster", source: "satellite" },
    ],
  };
}

/**
 * Pilot region: cocoa municipalities on the Transamazônica (Medicilândia and
 * Uruará, Pará). Approximate view used until the coverage polygon is imported
 * in Phase 1.
 */
export const PILOT_VIEW = {
  center: [-53.35, -3.45] as [number, number],
  zoom: 8.5,
};
