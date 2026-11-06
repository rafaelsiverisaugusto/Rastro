"use client";

import { useCallback } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

import MapCanvas from "@/components/map/map-canvas";
import type { FarmMapLayers } from "@/lib/farm-detail";
import { addReferenceLayers, setFarmLayer } from "@/lib/geo/map-layers";

export default function FarmResultMap({
  layers,
  className,
}: {
  layers: FarmMapLayers;
  className?: string;
}) {
  const onReady = useCallback(
    (map: MapLibreMap) => {
      addReferenceLayers(map, layers);
      setFarmLayer(map, layers.farm);
    },
    [layers],
  );
  const [minX, minY, maxX, maxY] = layers.bbox;
  return (
    <MapCanvas
      className={className}
      initialView={{
        bounds: [
          [minX, minY],
          [maxX, maxY],
        ],
        padding: 16,
      }}
      onReady={onReady}
      testId="farm-result-map"
    />
  );
}
