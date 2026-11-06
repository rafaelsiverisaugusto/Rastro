"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Feature, Polygon, Position } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";

import MapCanvas from "@/components/map/map-canvas";
import { PILOT_VIEW } from "@/lib/geo/basemap";
import {
  addCoverageLayer,
  boundsOf,
  MAP_COLORS,
  setFarmLayer,
  setTrackLayer,
} from "@/lib/geo/map-layers";

export type FarmEditorMapProps = {
  /** "draw": Terra Draw is active. "view": shows `polygon` read-only. */
  mode: "draw" | "view";
  polygon: Polygon | null;
  /** Draw mode: called with the current polygon (drawing = still open). */
  onDrawChange?: (polygon: Polygon | null, drawing: boolean) => void;
  /** Changing this value clears the drawing. */
  resetKey?: number;
  track?: Position[];
  position?: Position | null;
  coverage: Feature | null;
  className?: string;
};

const FARM = MAP_COLORS.farm as `#${string}`;

export default function FarmEditorMap({
  mode,
  polygon,
  onDrawChange,
  resetKey = 0,
  track = [],
  position = null,
  coverage,
  className,
}: FarmEditorMapProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const onDrawChangeRef = useRef(onDrawChange);

  useEffect(() => {
    onDrawChangeRef.current = onDrawChange;
  }, [onDrawChange]);

  const handleReady = useCallback(
    (m: MapLibreMap) => {
      addCoverageLayer(m, coverage);
      setFarmLayer(m, null);
      setTrackLayer(m, [], null);
      setMap(m);
      return () => setMap(null);
    },
    [coverage],
  );

  // Terra Draw lifecycle (draw mode only).
  useEffect(() => {
    if (!map || mode !== "draw") return;
    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawPolygonMode({
          styles: {
            fillColor: FARM,
            fillOpacity: 0.15,
            outlineColor: FARM,
            outlineWidth: 3,
            closingPointColor: FARM,
            closingPointWidth: 8,
            closingPointOutlineColor: "#FFFFFF",
            closingPointOutlineWidth: 2,
          },
        }),
        new TerraDrawSelectMode({
          flags: {
            polygon: {
              feature: {
                draggable: false,
                coordinates: { midpoints: true, draggable: true, deletable: true },
              },
            },
          },
          styles: {
            selectedPolygonColor: FARM,
            selectedPolygonFillOpacity: 0.15,
            selectedPolygonOutlineColor: FARM,
            selectedPolygonOutlineWidth: 3,
            selectionPointColor: FARM,
            selectionPointWidth: 8,
            selectionPointOutlineColor: "#FFFFFF",
            selectionPointOutlineWidth: 2,
            midPointColor: "#FFFFFF",
            midPointOutlineColor: FARM,
            midPointWidth: 5,
          },
        }),
      ],
    });
    draw.start();
    draw.setMode("polygon");

    const emit = () => {
      const feature = draw
        .getSnapshot()
        .find((f) => f.geometry.type === "Polygon" && f.properties?.mode === "polygon");
      if (!feature) {
        onDrawChangeRef.current?.(null, false);
        return;
      }
      const drawing = Boolean(feature.properties?.currentlyDrawing);
      onDrawChangeRef.current?.(feature.geometry as Polygon, drawing);
    };
    draw.on("change", emit);
    draw.on("finish", (id) => {
      draw.setMode("select");
      draw.selectFeature(id);
      emit();
    });
    drawRef.current = draw;

    return () => {
      drawRef.current = null;
      try {
        draw.stop();
      } catch {
        // The map may already be gone.
      }
    };
  }, [map, mode]);

  // "Start over".
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw || resetKey === 0) return;
    draw.clear();
    draw.setMode("polygon");
    onDrawChangeRef.current?.(null, false);
  }, [resetKey]);

  // Read-only polygon (GPS, upload, review).
  useEffect(() => {
    if (!map) return;
    setFarmLayer(map, mode === "view" ? polygon : null);
    if (mode === "view" && polygon) {
      const bounds = boundsOf(polygon.coordinates[0]);
      if (bounds) map.fitBounds(bounds, { padding: 48, maxZoom: 17, duration: 600 });
    }
  }, [map, mode, polygon]);

  // GPS track and current position.
  useEffect(() => {
    if (!map) return;
    setTrackLayer(map, track, position);
    if (position)
      map.easeTo({ center: position as [number, number], zoom: Math.max(map.getZoom(), 16) });
  }, [map, track, position]);

  return (
    <MapCanvas
      className={className}
      initialView={PILOT_VIEW}
      onReady={handleReady}
      testId="farm-editor-map"
    />
  );
}
