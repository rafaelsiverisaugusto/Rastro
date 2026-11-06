// Pure helpers and configuration for the reference-data import.
// Every endpoint, layer and field name here was checked against the live
// services on 2026-11-05 (see DATA_SOURCES.md). Do not rename without checking.

/** Pilot municipalities (IBGE codes), chosen by the team. */
export const PILOT_MUNICIPALITIES = [
  { geocode: "1501725", name: "Brasil Novo" },
  { geocode: "1504455", name: "Medicilândia" },
  { geocode: "1508159", name: "Uruará" },
];

/** Bounding box of the three municipalities, EPSG:4674: [minX, minY, maxX, maxY]. */
export const PILOT_BBOX = [-54.2983, -4.2669, -52.2741, -2.6653];

/** Scripts identify themselves honestly (some servers reject anonymous clients). */
export const USER_AGENT = "Rastro/0.1 (+https://github.com/rafaelsiverisaugusto/Rastro)";

/** First PRODES year imported. 2020 is kept as pre-cutoff context. */
export const PRODES_MIN_YEAR = 2020;

export const SOURCES = {
  coverage: {
    wfs: "https://terrabrasilis.dpi.inpe.br/geoserver/prodes-amazon-nb/wfs",
    typeName: "prodes-amazon-nb:municipalities_amazon_biome",
  },
  deter: {
    wfs: "https://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/deter_amz/wfs",
    typeName: "deter-amz:deter_amz",
  },
  prodes: {
    wfs: "https://terrabrasilis.dpi.inpe.br/geoserver/prodes-amazon-nb/wfs",
    typeName: "prodes-amazon-nb:yearly_deforestation_biome",
  },
  ti: {
    // Download link published on the official FUNAI page
    // https://www.gov.br/funai/pt-br/atuacao/terras-indigenas/geoprocessamento-e-mapas
    url: "https://geoserver.funai.gov.br/geoserver/Funai/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Funai:tis_poligonais&CQL_FILTER=uf_sigla%20LIKE%20%27%25PA%25%27&outputFormat=SHAPE-ZIP",
    shapefile: "tis_poligonais",
    // The FUNAI server omits its intermediate certificate. This is the "CA
    // Issuers" URL from its own certificate (AIA), published by Sectigo (D-014).
    intermediateCaUrl: "http://crt.sectigo.com/SectigoPublicServerAuthenticationCAOVR36.crt",
  },
  uc: {
    // https://dados.mma.gov.br/dataset/unidadesdeconservacao (CNUC 2025_08, see D-010)
    url: "https://dados.mma.gov.br/dataset/44b6dc8a-dc82-4a84-8d95-1b0da7c85dac/resource/6ba9a557-87e8-4882-acb7-b3e0f0ea192d/download/shp_cnuc_2025_08.zip",
    shapefile: "cnuc_2025_08",
    edition: "2025_08",
  },
};

/** Quotes a value for an ECQL string literal. */
export function cqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function cqlIn(field, values) {
  return `${field} IN (${values.map(cqlString).join(",")})`;
}

/**
 * @param {string} field
 * @param {number[]} bbox [minX, minY, maxX, maxY] in EPSG:4674
 */
export function cqlBbox(field, [minX, minY, maxX, maxY]) {
  return `BBOX(${field},${minX},${minY},${maxX},${maxY},'EPSG:4674')`;
}

/**
 * WFS 2.0 GetFeature URL. CSV keeps full coordinate precision (JSON and GML are
 * rounded to 4 decimals by the INPE GeoServer) and srsName is always explicit
 * so the axis order is lon/lat (D-008).
 *
 * @param {string} base
 * @param {{ typeName: string, cql?: string, resultType?: "hits", outputFormat?: string }} options
 */
export function wfsUrl(base, { typeName, cql, resultType, outputFormat = "csv" }) {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: typeName,
    srsName: "EPSG:4674",
  });
  if (resultType === "hits") params.set("resultType", "hits");
  else params.set("outputFormat", outputFormat);
  if (cql) params.set("CQL_FILTER", cql);
  return `${base}?${params.toString()}`;
}

/** Reads numberMatched from a WFS 2.0 resultType=hits response. */
export function parseHits(xml) {
  const match = /numberMatched="(\d+)"/.exec(xml);
  if (!match) throw new Error(`WFS hits response without numberMatched: ${xml.slice(0, 200)}`);
  return Number(match[1]);
}

/** DETER gid is not unique; this combination is (D-008). */
export function deterExternalId(row) {
  return [row.gid, row.view_date, row.classname, row.mun_geocod].join("|");
}

/** Empty strings from CSV/DBF become null. DBF padding (NUL bytes) is removed. */
export function clean(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replaceAll("\u0000", "").trim();
  return text === "" ? null : text;
}

export function toNumber(value) {
  const text = clean(value);
  if (text === null) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Sanity check that WKT is lon/lat inside Brazil (catches swapped axes). */
export function assertLonLatWkt(wkt) {
  const match = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/.exec(wkt);
  if (!match) throw new Error(`Geometry without coordinates: ${String(wkt).slice(0, 80)}`);
  const [x, y] = [Number(match[1]), Number(match[2])];
  if (x < -75 || x > -30 || y < -35 || y > 6) {
    throw new Error(`Coordinates out of Brazil or swapped axes: ${x} ${y}`);
  }
}

/** Bounding box of a GeoJSON geometry: [minX, minY, maxX, maxY]. */
export function geometryBbox(geometry) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const walk = (coords) => {
    if (typeof coords[0] === "number") {
      minX = Math.min(minX, coords[0]);
      maxX = Math.max(maxX, coords[0]);
      minY = Math.min(minY, coords[1]);
      maxY = Math.max(maxY, coords[1]);
    } else {
      for (const c of coords) walk(c);
    }
  };
  walk(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

export function bboxIntersects(a, b) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

/** Splits an array into chunks of at most `size` items. */
export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
