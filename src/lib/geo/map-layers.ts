import type { Feature, FeatureCollection, Geometry, Polygon, Position } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

import { classifyDeforestation } from "@/lib/compliance/evaluate";
import type { DeforestationOverlap } from "@/lib/compliance/types";

/** Map palette (PLANO.md 11). */
export const MAP_COLORS = {
  farm: "#E8B33A",
  afterCutoff: "#D24A3C",
  attention: "#F97316",
  beforeCutoff: "#9CA3AF",
  protected: "#60A5FA",
  coverage: "#FFFFFF",
  track: "#E8B33A",
} as const;

export type DeforestationCategory = "after" | "attention" | "before";

type DeforestationProps = {
  source: "DETER" | "PRODES";
  class_name: string | null;
  detected_at: string | null;
  prodes_year: number | null;
  is_synthetic: boolean;
};

/**
 * Same classification as the verdict (classifyDeforestation), so the map can
 * never contradict the result.
 */
export function deforestationCategory(p: DeforestationProps): DeforestationCategory {
  const { effect } = classifyDeforestation({
    id: 0,
    external_id: null,
    overlap_ha: 1,
    ...p,
  } satisfies DeforestationOverlap);
  return effect === "non_compliant" ? "after" : effect === "attention" ? "attention" : "before";
}

const empty: FeatureCollection = { type: "FeatureCollection", features: [] };

function setOrAddSource(map: MapLibreMap, id: string, data: FeatureCollection | Feature) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource(id, { type: "geojson", data });
}

export function addCoverageLayer(map: MapLibreMap, outline: Feature | null) {
  setOrAddSource(map, "coverage", outline ?? empty);
  if (map.getLayer("coverage-line")) return;
  map.addLayer({
    id: "coverage-line",
    type: "line",
    source: "coverage",
    paint: {
      "line-color": MAP_COLORS.coverage,
      "line-width": 2,
      "line-dasharray": [3, 2],
      "line-opacity": 0.85,
    },
  });
}

export function addReferenceLayers(
  map: MapLibreMap,
  layers: { deforestation: FeatureCollection; protected_areas: FeatureCollection },
) {
  const deforestation: FeatureCollection = {
    type: "FeatureCollection",
    features: layers.deforestation.features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        category: deforestationCategory(f.properties as DeforestationProps),
      },
    })),
  };
  setOrAddSource(map, "protected", layers.protected_areas);
  setOrAddSource(map, "deforestation", deforestation);
  if (!map.getLayer("protected-fill")) {
    map.addLayer({
      id: "protected-fill",
      type: "fill",
      source: "protected",
      paint: { "fill-color": MAP_COLORS.protected, "fill-opacity": 0.15 },
    });
    map.addLayer({
      id: "protected-line",
      type: "line",
      source: "protected",
      paint: { "line-color": MAP_COLORS.protected, "line-width": 2 },
    });
  }
  if (!map.getLayer("deforestation-fill")) {
    const color = [
      "match",
      ["get", "category"],
      "after",
      MAP_COLORS.afterCutoff,
      "attention",
      MAP_COLORS.attention,
      MAP_COLORS.beforeCutoff,
    ] as const;
    map.addLayer({
      id: "deforestation-fill",
      type: "fill",
      source: "deforestation",
      paint: {
        "fill-color": color as unknown as string,
        "fill-opacity": ["match", ["get", "category"], "before", 0.35, 0.55],
      },
    });
    map.addLayer({
      id: "deforestation-line",
      type: "line",
      source: "deforestation",
      paint: { "line-color": color as unknown as string, "line-width": 1 },
    });
  }
}

export function setFarmLayer(map: MapLibreMap, polygon: Polygon | null) {
  setOrAddSource(
    map,
    "farm",
    polygon ? { type: "Feature", geometry: polygon, properties: {} } : empty,
  );
  if (map.getLayer("farm-fill")) return;
  map.addLayer({
    id: "farm-fill",
    type: "fill",
    source: "farm",
    paint: { "fill-color": MAP_COLORS.farm, "fill-opacity": 0.12 },
  });
  map.addLayer({
    id: "farm-line",
    type: "line",
    source: "farm",
    paint: { "line-color": MAP_COLORS.farm, "line-width": 3 },
  });
}

export function setTrackLayer(map: MapLibreMap, points: Position[], current: Position | null) {
  const features: Feature<Geometry>[] = [];
  if (points.length >= 2) {
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: points },
      properties: {},
    });
  }
  if (current) {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: current },
      properties: {},
    });
  }
  setOrAddSource(map, "track", { type: "FeatureCollection", features });
  if (map.getLayer("track-line")) return;
  map.addLayer({
    id: "track-line",
    type: "line",
    source: "track",
    filter: ["==", ["geometry-type"], "LineString"],
    paint: { "line-color": MAP_COLORS.track, "line-width": 3, "line-dasharray": [2, 1] },
  });
  map.addLayer({
    id: "track-position",
    type: "circle",
    source: "track",
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": 7,
      "circle-color": "#2563EB",
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-width": 2,
    },
  });
}

/** [minX, minY, maxX, maxY] of a polygon or point list. */
export function boundsOf(coords: Position[]): [[number, number], [number, number]] | null {
  if (coords.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of coords) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}
