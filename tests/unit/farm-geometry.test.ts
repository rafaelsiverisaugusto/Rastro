// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { parseFarmFile } from "@/lib/geo/farm-file";
import { FARM_LIMITS, validateFarmPolygon } from "@/lib/geo/farm-geometry";
import { addFix, emptyTrack, GPS_SETTINGS, trackToPolygon } from "@/lib/geo/gps-track";

// About 400 m x 400 m (16 ha) near Medicilândia.
const LON = -52.9;
const LAT = -3.45;
const D = 400 / 111_000;
const square = {
  type: "Polygon",
  coordinates: [
    [
      [LON, LAT],
      [LON + D, LAT],
      [LON + D, LAT + D],
      [LON, LAT + D],
      [LON, LAT],
    ],
  ],
};

describe("validateFarmPolygon", () => {
  it("accepts a valid polygon and computes its area", () => {
    const r = validateFarmPolygon(square);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.areaHa).toBeCloseTo(16, 0);
  });

  it("accepts Feature, FeatureCollection with one area and single-part MultiPolygon", () => {
    expect(validateFarmPolygon({ type: "Feature", geometry: square, properties: {} }).ok).toBe(
      true,
    );
    expect(
      validateFarmPolygon({
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: { type: "Point", coordinates: [LON, LAT] } },
          { type: "Feature", geometry: square },
        ],
      }).ok,
    ).toBe(true);
    expect(
      validateFarmPolygon({ type: "MultiPolygon", coordinates: [square.coordinates] }).ok,
    ).toBe(true);
  });

  it("refuses files with more than one area", () => {
    const fc = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: square },
        { type: "Feature", geometry: square },
      ],
    };
    expect(validateFarmPolygon(fc)).toEqual({ ok: false, error: "multiple_polygons" });
  });

  it("closes an open ring, drops altitude and rounds to 7 decimals", () => {
    const open = {
      type: "Polygon",
      coordinates: [
        [
          [LON + 0.000000012, LAT, 120],
          [LON + D, LAT],
          [LON + D, LAT + D],
          [LON, LAT + D],
        ],
      ],
    };
    const r = validateFarmPolygon(open);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const ring = r.polygon.coordinates[0];
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      expect(ring[0]).toEqual([LON, LAT]);
      expect(ring.every((p) => p.length === 2)).toBe(true);
    }
  });

  it("refuses self-intersecting polygons (bow tie)", () => {
    const bowTie = {
      type: "Polygon",
      coordinates: [
        [
          [LON, LAT],
          [LON + D, LAT + D],
          [LON + D, LAT],
          [LON, LAT + D],
          [LON, LAT],
        ],
      ],
    };
    expect(validateFarmPolygon(bowTie)).toEqual({ ok: false, error: "self_intersecting" });
  });

  it("refuses areas that are too small or too large", () => {
    const tiny = {
      type: "Polygon",
      coordinates: [
        [
          [LON, LAT],
          [LON + 0.0003, LAT],
          [LON + 0.0003, LAT + 0.0003],
          [LON, LAT],
        ],
      ],
    };
    expect(validateFarmPolygon(tiny)).toMatchObject({ ok: false, error: "too_small" });
    const huge = {
      type: "Polygon",
      coordinates: [
        [
          [LON, LAT],
          [LON + 1, LAT],
          [LON + 1, LAT + 1],
          [LON, LAT],
        ],
      ],
    };
    expect(validateFarmPolygon(huge)).toMatchObject({ ok: false, error: "too_large" });
    expect(FARM_LIMITS.minAreaHa).toBeGreaterThan(0);
  });

  it("refuses swapped axes or coordinates outside Brazil", () => {
    const swapped = {
      type: "Polygon",
      coordinates: [square.coordinates[0].map(([x, y]) => [y, x])],
    };
    expect(validateFarmPolygon(swapped)).toEqual({ ok: false, error: "outside_brazil" });
  });

  it("refuses garbage", () => {
    expect(validateFarmPolygon(null)).toEqual({ ok: false, error: "not_polygon" });
    expect(validateFarmPolygon({ type: "Point", coordinates: [LON, LAT] })).toEqual({
      ok: false,
      error: "not_polygon",
    });
    expect(validateFarmPolygon({ type: "Polygon", coordinates: [[["a", "b"]]] })).toEqual({
      ok: false,
      error: "invalid_coordinates",
    });
    expect(
      validateFarmPolygon({
        type: "Polygon",
        coordinates: [
          [
            [LON, LAT],
            [LON + D, LAT],
            [LON, LAT],
          ],
        ],
      }),
    ).toEqual({ ok: false, error: "too_few_points" });
  });
});

describe("GPS track", () => {
  const step = 10 / 111_000; // about 10 m

  it("discards readings with poor accuracy", () => {
    const t = addFix(emptyTrack, { lon: LON, lat: LAT, accuracy: GPS_SETTINGS.maxAccuracyM + 5 });
    expect(t.points).toHaveLength(0);
    expect(t.discarded).toBe(1);
  });

  it("adds a point only after walking at least 5 m", () => {
    let t = addFix(emptyTrack, { lon: LON, lat: LAT, accuracy: 5 });
    t = addFix(t, { lon: LON + 0.00002, lat: LAT, accuracy: 5 }); // about 2 m
    expect(t.points).toHaveLength(1);
    t = addFix(t, { lon: LON + step, lat: LAT, accuracy: 5 });
    expect(t.points).toHaveLength(2);
  });

  it("closes the walk into a valid polygon", () => {
    let t = emptyTrack;
    const side = 40; // 40 steps of 10 m = 400 m per side
    const walk: [number, number][] = [];
    for (let i = 0; i < side; i++) walk.push([LON + i * step, LAT]);
    for (let i = 0; i < side; i++) walk.push([LON + side * step, LAT + i * step]);
    for (let i = side; i > 0; i--) walk.push([LON + i * step, LAT + side * step]);
    for (let i = side; i > 0; i--) walk.push([LON, LAT + i * step]);
    for (const [lon, lat] of walk) t = addFix(t, { lon, lat, accuracy: 4 });

    const polygon = trackToPolygon(t);
    expect(polygon).not.toBeNull();
    // Collinear points along the sides are simplified away.
    expect(polygon!.coordinates[0].length).toBeLessThan(10);
    const r = validateFarmPolygon(polygon);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.areaHa).toBeCloseTo(16, 0);
  });

  it("needs at least three points", () => {
    expect(trackToPolygon({ points: [[LON, LAT]], discarded: 0 })).toBeNull();
  });
});

describe("parseFarmFile", () => {
  it("reads GeoJSON", () => {
    const r = parseFarmFile("fazenda.geojson", JSON.stringify(square));
    expect(r.ok && validateFarmPolygon(r.geojson).ok).toBe(true);
  });

  it("reads KML", () => {
    const coords = square.coordinates[0].map(([x, y]) => `${x},${y},0`).join(" ");
    const text = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>A</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;
    const r = parseFarmFile("fazenda.kml", text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(validateFarmPolygon(r.geojson).ok).toBe(true);
  });

  it("rejects other formats and broken files", () => {
    expect(parseFarmFile("fazenda.shp", "x")).toEqual({ ok: false, error: "unsupported_file" });
    expect(parseFarmFile("fazenda.geojson", "{oops")).toEqual({
      ok: false,
      error: "unreadable_file",
    });
  });
});
