import { kml } from "@tmcw/togeojson";

export type FarmFileError = "unsupported_file" | "unreadable_file" | "file_too_large";

export const MAX_FARM_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Reads a GeoJSON or KML file into GeoJSON (in the browser; KML needs
 * DOMParser). Validation of the area itself is done by validateFarmPolygon.
 */
export function parseFarmFile(
  name: string,
  text: string,
): { ok: true; geojson: unknown } | { ok: false; error: FarmFileError } {
  const lower = name.toLowerCase();
  try {
    if (lower.endsWith(".geojson") || lower.endsWith(".json")) {
      return { ok: true, geojson: JSON.parse(text) };
    }
    if (lower.endsWith(".kml")) {
      const doc = new DOMParser().parseFromString(text, "text/xml");
      if (doc.getElementsByTagName("parsererror").length > 0) {
        return { ok: false, error: "unreadable_file" };
      }
      return { ok: true, geojson: kml(doc) };
    }
  } catch {
    return { ok: false, error: "unreadable_file" };
  }
  return { ok: false, error: "unsupported_file" };
}
