import distance from "@turf/distance";
import simplify from "@turf/simplify";
import type { Polygon, Position } from "geojson";

/** GPS walking mode (PLANO.md 10). */
export const GPS_SETTINGS = {
  /** A new point every 5 m walked. */
  minStepM: 5,
  /** Readings worse than 20 m are discarded. */
  maxAccuracyM: 20,
  /** Simplification tolerance when closing the track (degrees, about 1.5 m). */
  simplifyToleranceDeg: 0.000015,
} as const;

export type GpsFix = { lon: number; lat: number; accuracy: number };

export type GpsTrack = { points: Position[]; discarded: number };

export const emptyTrack: GpsTrack = { points: [], discarded: 0 };

/** Adds a GPS reading to the track, applying the accuracy and step filters. */
export function addFix(track: GpsTrack, fix: GpsFix): GpsTrack {
  if (!(fix.accuracy <= GPS_SETTINGS.maxAccuracyM)) {
    return { ...track, discarded: track.discarded + 1 };
  }
  const point: Position = [fix.lon, fix.lat];
  const last = track.points[track.points.length - 1];
  if (last && distance(last, point, { units: "meters" }) < GPS_SETTINGS.minStepM) return track;
  return { ...track, points: [...track.points, point] };
}

/** Closes the walked track into a simplified polygon (null if too short). */
export function trackToPolygon(track: GpsTrack): Polygon | null {
  if (track.points.length < 3) return null;
  const ring = [...track.points, track.points[0]];
  const polygon: Polygon = { type: "Polygon", coordinates: [ring] };
  const simplified = simplify(polygon, {
    tolerance: GPS_SETTINGS.simplifyToleranceDeg,
    highQuality: true,
  });
  return simplified.coordinates[0].length >= 4 ? simplified : polygon;
}
