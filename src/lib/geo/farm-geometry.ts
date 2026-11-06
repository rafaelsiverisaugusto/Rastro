import area from "@turf/area";
import kinks from "@turf/kinks";
import type { Feature, Polygon, Position } from "geojson";

/**
 * Limits for a farm polygon. Validated in the browser (instant feedback) and
 * again on the server before saving (the client is never trusted).
 */
export const FARM_LIMITS = {
  minAreaHa: 0.5,
  maxAreaHa: 5_000,
  maxVertices: 5_000,
  /** EUDR geolocation: at least 6 decimals; we keep 7 (about 1 cm). */
  decimals: 7,
} as const;

/** Rough bounding box of Brazil, to catch swapped or projected coordinates. */
const BRAZIL_BBOX = { minLon: -74.5, minLat: -34, maxLon: -28.5, maxLat: 5.5 };

export type FarmGeometryError =
  | "not_polygon"
  | "multiple_polygons"
  | "too_few_points"
  | "invalid_coordinates"
  | "outside_brazil"
  | "self_intersecting"
  | "too_small"
  | "too_large"
  | "too_many_vertices";

export type FarmGeometryResult =
  | { ok: true; polygon: Polygon; areaHa: number }
  | { ok: false; error: FarmGeometryError; areaHa?: number };

const round = (value: number) => Number(value.toFixed(FARM_LIMITS.decimals));

function isPosition(p: unknown): p is Position {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    typeof p[0] === "number" &&
    typeof p[1] === "number" &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1])
  );
}

/** Rounds, drops altitude and repeated points, and closes the ring. */
function normalizeRing(ring: Position[]): Position[] {
  const out: Position[] = [];
  for (const p of ring) {
    const q = [round(p[0]), round(p[1])];
    const last = out[out.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) out.push([...first]);
  return out;
}

/**
 * Accepts a Polygon, a Feature, a FeatureCollection with exactly one area, or
 * a MultiPolygon with a single part. Returns the polygon rings or an error.
 */
export function extractPolygonRings(
  input: unknown,
): { ok: true; rings: unknown[] } | { ok: false; error: FarmGeometryError } {
  if (!input || typeof input !== "object") return { ok: false, error: "not_polygon" };
  const obj = input as { type?: string; [k: string]: unknown };

  if (obj.type === "FeatureCollection") {
    const features = Array.isArray(obj.features) ? (obj.features as Feature[]) : [];
    const areas = features.filter(
      (f) => f?.geometry?.type === "Polygon" || f?.geometry?.type === "MultiPolygon",
    );
    if (areas.length === 0) return { ok: false, error: "not_polygon" };
    if (areas.length > 1) return { ok: false, error: "multiple_polygons" };
    return extractPolygonRings(areas[0].geometry);
  }
  if (obj.type === "Feature") return extractPolygonRings(obj.geometry);
  if (obj.type === "GeometryCollection") {
    return extractPolygonRings({
      type: "FeatureCollection",
      features: ((obj.geometries as unknown[]) ?? []).map((g) => ({
        type: "Feature",
        geometry: g,
      })),
    });
  }
  if (obj.type === "MultiPolygon") {
    const parts = Array.isArray(obj.coordinates) ? obj.coordinates : [];
    if (parts.length !== 1)
      return { ok: false, error: parts.length ? "multiple_polygons" : "not_polygon" };
    return { ok: true, rings: parts[0] as unknown[] };
  }
  if (obj.type === "Polygon" && Array.isArray(obj.coordinates)) {
    return { ok: true, rings: obj.coordinates as unknown[] };
  }
  return { ok: false, error: "not_polygon" };
}

/** Validates and normalizes a farm area (EPSG:4326, lon/lat). */
export function validateFarmPolygon(input: unknown): FarmGeometryResult {
  const extracted = extractPolygonRings(input);
  if (!extracted.ok) return extracted;

  const rings: Position[][] = [];
  for (const ring of extracted.rings) {
    if (!Array.isArray(ring) || !ring.every(isPosition)) {
      return { ok: false, error: "invalid_coordinates" };
    }
    rings.push(normalizeRing(ring));
  }
  if (rings.length === 0 || rings[0].length < 4) return { ok: false, error: "too_few_points" };
  if (rings.some((r) => r.length < 4)) return { ok: false, error: "too_few_points" };

  const vertices = rings.reduce((n, r) => n + r.length, 0);
  if (vertices > FARM_LIMITS.maxVertices) return { ok: false, error: "too_many_vertices" };

  const outside = rings
    .flat()
    .some(
      ([lon, lat]) =>
        lon < BRAZIL_BBOX.minLon ||
        lon > BRAZIL_BBOX.maxLon ||
        lat < BRAZIL_BBOX.minLat ||
        lat > BRAZIL_BBOX.maxLat,
    );
  if (outside) return { ok: false, error: "outside_brazil" };

  const polygon: Polygon = { type: "Polygon", coordinates: rings };
  if (kinks(polygon).features.length > 0) return { ok: false, error: "self_intersecting" };

  const areaHa = area(polygon) / 10_000;
  if (areaHa < FARM_LIMITS.minAreaHa) return { ok: false, error: "too_small", areaHa };
  if (areaHa > FARM_LIMITS.maxAreaHa) return { ok: false, error: "too_large", areaHa };

  return { ok: true, polygon, areaHa };
}

/** Area in hectares for live display (no validation). */
export function polygonAreaHa(polygon: Polygon): number {
  return area(polygon) / 10_000;
}
