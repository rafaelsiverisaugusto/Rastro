"use client";

import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type LngLatBoundsLike,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { useI18n } from "@/i18n/provider";
import { inpeAttributionHtml } from "@/lib/attribution";
import { buildBasemapStyle } from "@/lib/geo/basemap";
import { cn } from "@/lib/utils";

type MapState = "loading" | "ready" | "error";

export type InitialView =
  { center: [number, number]; zoom: number } | { bounds: LngLatBoundsLike; padding?: number };

export type MapCanvasProps = {
  className?: string;
  initialView: InitialView;
  /** Called once the style is loaded. May return a cleanup function. */
  onReady?: (map: MapLibreMap) => void | (() => void);
  testId?: string;
  label?: string;
};

/**
 * MapLibre map with the satellite base map, the INPE credit (always visible)
 * and loading/error states. Client only (WebGL).
 */
export default function MapCanvas({
  className,
  initialView,
  onReady,
  testId = "map",
  label,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const attributionRef = useRef<AttributionControl | null>(null);
  const onReadyRef = useRef(onReady);
  const initialViewRef = useRef(initialView);
  const [state, setState] = useState<MapState>("loading");
  const [attempt, setAttempt] = useState(0);
  const { t, locale } = useI18n();
  const localeRef = useRef(locale);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: MapLibreMap | undefined;
    let cleanup: void | (() => void);
    const frame = requestAnimationFrame(() => {
      const view = initialViewRef.current;
      try {
        map = new MapLibreMap({
          container,
          style: buildBasemapStyle(),
          ...("bounds" in view
            ? { bounds: view.bounds, fitBoundsOptions: { padding: view.padding ?? 32 } }
            : { center: view.center, zoom: view.zoom }),
          attributionControl: false,
        });
      } catch (error) {
        console.error(error);
        setState("error");
        return;
      }

      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
      const attribution = new AttributionControl({
        compact: true,
        customAttribution: inpeAttributionHtml(localeRef.current),
      });
      map.addControl(attribution, "bottom-right");
      mapRef.current = map;
      attributionRef.current = attribution;

      map.once("load", () => {
        if (!map) return;
        cleanup = onReadyRef.current?.(map);
        setState("ready");
      });
      map.on("error", (event) => console.warn(event.error));
    });

    return () => {
      cancelAnimationFrame(frame);
      if (typeof cleanup === "function") cleanup();
      map?.remove();
      mapRef.current = null;
      attributionRef.current = null;
    };
  }, [attempt]);

  // Keep the credit in the current language without recreating the map.
  useEffect(() => {
    localeRef.current = locale;
    const map = mapRef.current;
    const current = attributionRef.current;
    if (!map || !current) return;
    const next = new AttributionControl({
      compact: true,
      customAttribution: inpeAttributionHtml(locale),
    });
    map.removeControl(current);
    map.addControl(next, "bottom-right");
    attributionRef.current = next;
  }, [locale]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        ref={containerRef}
        className="h-full w-full"
        role="region"
        aria-label={label ?? t.map.label}
        data-testid={testId}
        data-state={state}
      />
      {state === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-brand-900/60 text-sm text-white">
          {t.map.loading}
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-brand-900 p-6 text-center text-white">
          <p className="max-w-xs text-sm">{t.map.error}</p>
          <button
            type="button"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-brand-900"
            onClick={() => {
              setState("loading");
              setAttempt((n) => n + 1);
            }}
          >
            {t.common.retry}
          </button>
        </div>
      )}
    </div>
  );
}
