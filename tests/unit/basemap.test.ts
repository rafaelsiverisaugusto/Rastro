import { describe, expect, it } from "vitest";

import {
  BASEMAP_YEAR,
  buildBasemapStyle,
  eoxAttribution,
  eoxLayerId,
  eoxTileUrl,
  PILOT_VIEW,
} from "@/lib/geo/basemap";

describe("basemap", () => {
  it("uses the layer identifiers published in EOX GetCapabilities", () => {
    expect(eoxLayerId(2016)).toBe("s2cloudless_3857");
    expect(eoxLayerId(2020)).toBe("s2cloudless-2020_3857");
  });

  it("builds a Web Mercator XYZ tile URL", () => {
    expect(eoxTileUrl(2016)).toBe(
      "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
    );
  });

  it("states the right license for each year", () => {
    expect(eoxAttribution(2016)).toContain("CC BY 4.0");
    expect(eoxAttribution(2016)).toContain("Contains modified Copernicus Sentinel data 2016");
    expect(eoxAttribution(2020)).toContain("CC BY-NC-SA 4.0");
  });

  it("default base map has no non-commercial restriction", () => {
    expect(BASEMAP_YEAR).toBeLessThanOrEqual(2016);
  });

  it("always carries the attribution in the raster source", () => {
    const style = buildBasemapStyle();
    const source = style.sources.satellite;
    expect(source.type).toBe("raster");
    expect(source).toHaveProperty("attribution", eoxAttribution(BASEMAP_YEAR));
  });

  it("starts centred on the pilot region in Pará", () => {
    const [lng, lat] = PILOT_VIEW.center;
    expect(lng).toBeGreaterThan(-54.5);
    expect(lng).toBeLessThan(-52);
    expect(lat).toBeGreaterThan(-4.5);
    expect(lat).toBeLessThan(-2.5);
  });
});
