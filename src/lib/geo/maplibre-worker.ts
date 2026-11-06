import { getVersion, setWorkerUrl } from "maplibre-gl";

let configured = false;

/**
 * Points MapLibre to the worker copied into public/ by
 * scripts/copy-maplibre-worker.mjs (same version as the installed package).
 * Without it, GeoJSON sources (farm, deforestation, coverage) never render.
 */
export function configureMaplibreWorker() {
  if (configured) return;
  setWorkerUrl(`/maplibre/maplibre-gl-worker.${getVersion()}.mjs`);
  configured = true;
}
