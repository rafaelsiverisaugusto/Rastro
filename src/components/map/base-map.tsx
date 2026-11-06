"use client";

import { PILOT_VIEW } from "@/lib/geo/basemap";

import MapCanvas from "./map-canvas";

/** Home page map: satellite view of the pilot region. */
export default function BaseMap({ className }: { className?: string }) {
  return <MapCanvas className={className} initialView={PILOT_VIEW} testId="base-map" />;
}
