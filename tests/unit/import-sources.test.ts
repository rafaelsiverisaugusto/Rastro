import { describe, expect, it } from "vitest";

import {
  assertLonLatWkt,
  bboxIntersects,
  chunk,
  clean,
  cqlBbox,
  cqlIn,
  deterExternalId,
  geometryBbox,
  parseHits,
  PILOT_BBOX,
  PILOT_MUNICIPALITIES,
  wfsUrl,
} from "../../scripts/lib/sources.mjs";

describe("import sources", () => {
  it("has the three pilot municipalities with their IBGE codes", () => {
    expect(PILOT_MUNICIPALITIES.map((m) => m.geocode)).toEqual(["1501725", "1504455", "1508159"]);
  });

  it("builds a CSV GetFeature URL with explicit SIRGAS 2000 axis order", () => {
    const url = new URL(
      wfsUrl("https://example.org/wfs", {
        typeName: "deter-amz:deter_amz",
        cql: cqlIn("mun_geocod", ["1508159", "1504455"]),
      }),
    );
    expect(url.searchParams.get("outputFormat")).toBe("csv");
    expect(url.searchParams.get("srsName")).toBe("EPSG:4674");
    expect(url.searchParams.get("CQL_FILTER")).toBe("mun_geocod IN ('1508159','1504455')");
  });

  it("asks only for the count when resultType is hits", () => {
    const url = new URL(wfsUrl("https://example.org/wfs", { typeName: "a:b", resultType: "hits" }));
    expect(url.searchParams.get("resultType")).toBe("hits");
    expect(url.searchParams.has("outputFormat")).toBe(false);
  });

  it("escapes quotes in CQL literals and builds a BBOX filter", () => {
    expect(cqlIn("name", ["O'Brien"])).toBe("name IN ('O''Brien')");
    expect(cqlBbox("geom", PILOT_BBOX)).toBe(
      "BBOX(geom,-54.2983,-4.2669,-52.2741,-2.6653,'EPSG:4674')",
    );
  });

  it("reads numberMatched from a hits response", () => {
    expect(parseHits('<wfs:FeatureCollection numberMatched="9013" numberReturned="0"/>')).toBe(
      9013,
    );
    expect(() => parseHits("<html>403</html>")).toThrow();
  });

  it("builds a DETER key that tells apart rows sharing the same gid", () => {
    const a = {
      gid: "13931_hist",
      view_date: "2021-10-03",
      classname: "DESMATAMENTO_CR",
      mun_geocod: "1508159",
    };
    const b = { ...a, view_date: "2019-05-06", classname: "MINERACAO", mun_geocod: "1503754" };
    expect(deterExternalId(a)).toBe("13931_hist|2021-10-03|DESMATAMENTO_CR|1508159");
    expect(deterExternalId(a)).not.toBe(deterExternalId(b));
  });

  it("cleans empty values and DBF padding", () => {
    expect(clean("")).toBeNull();
    expect(clean("\u0000\u0000")).toBeNull();
    expect(clean(" Arara ")).toBe("Arara");
  });

  it("rejects geometries with swapped axes", () => {
    expect(() => assertLonLatWkt("MULTIPOLYGON (((-53.99 -3.55, -53.98 -3.55)))")).not.toThrow();
    expect(() => assertLonLatWkt("MULTIPOLYGON (((-3.55 -53.99, -3.55 -53.98)))")).toThrow();
  });

  it("computes and compares bounding boxes", () => {
    const bbox = geometryBbox({
      type: "Polygon",
      coordinates: [
        [
          [-53.5, -3.5],
          [-53.4, -3.5],
          [-53.4, -3.4],
          [-53.5, -3.5],
        ],
      ],
    });
    expect(bbox).toEqual([-53.5, -3.5, -53.4, -3.4]);
    expect(bboxIntersects(bbox, PILOT_BBOX)).toBe(true);
    expect(bboxIntersects([-50, -2, -49, -1], PILOT_BBOX)).toBe(false);
  });

  it("splits arrays into chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
