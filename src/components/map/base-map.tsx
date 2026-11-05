"use client";

import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { buildBasemapStyle, PILOT_VIEW } from "@/lib/geo/basemap";
import { useDictionary } from "@/i18n/provider";
import { cn } from "@/lib/utils";

type MapState = "loading" | "ready" | "error";

export default function BaseMap({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<MapState>("loading");
  const [attempt, setAttempt] = useState(0);
  const t = useDictionary();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: MapLibreMap | undefined;
    // Created on the next frame so the container has its final size and all
    // state updates happen in callbacks, not synchronously in the effect.
    const frame = requestAnimationFrame(() => {
      try {
        map = new MapLibreMap({
          container,
          style: buildBasemapStyle(),
          center: PILOT_VIEW.center,
          zoom: PILOT_VIEW.zoom,
          attributionControl: false,
        });
      } catch (error) {
        // Typically: WebGL unavailable in this browser.
        console.error(error);
        setState("error");
        return;
      }

      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
      map.addControl(new AttributionControl({ compact: true }), "bottom-right");

      map.once("load", () => setState("ready"));
      // Individual tile failures are recoverable and only logged.
      map.on("error", (event) => console.warn(event.error));
    });

    return () => {
      cancelAnimationFrame(frame);
      map?.remove();
    };
  }, [attempt]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        ref={containerRef}
        className="h-full w-full"
        role="region"
        aria-label={t.map.label}
        data-testid="base-map"
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
