// Imports the reference layers of the pilot region into Supabase:
// coverage (municipalities), DETER, PRODES, indigenous lands (TI) and
// conservation units (UC). Each step runs in a transaction, is idempotent and
// records a row in data_snapshots.
//
// Usage: npm run data:import [-- coverage deter prodes ti uc]
// Needs SUPABASE_DB_URL in .env.local. Optional SUPABASE_DB_CA_CERT: path to the
// Supabase root certificate (Project Settings > Database > SSL) to verify TLS.
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import https from "node:https";
import tls from "node:tls";

import { parse } from "csv-parse/sync";
import { unzipSync } from "fflate";
import pg from "pg";
import * as shapefile from "shapefile";

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
  PRODES_MIN_YEAR,
  SOURCES,
  toNumber,
  USER_AGENT,
  wfsUrl,
} from "./lib/sources.mjs";

const STEPS = ["coverage", "deter", "prodes", "ti", "uc"];
const BATCH_SIZE = 500;

// Geometry pipeline shared by every layer: SIRGAS 2000 -> WGS 84, repaired,
// polygons only, always MultiPolygon.
const toStoredGeom = (expr) =>
  `st_multi(st_collectionextract(st_makevalid(st_transform(st_setsrid(${expr}, 4674), 4326)), 3))`;

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function fetchWithRetry(url, { attempts = 3, timeoutMs = 300_000 } = {}) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return response;
    } catch (error) {
      lastError = error;
      if (i < attempts) {
        console.warn(`  attempt ${i} failed (${error.message}); retrying…`);
        await new Promise((resolve) => setTimeout(resolve, 2000 * i));
      }
    }
  }
  throw lastError;
}

async function wfsHits(source, cql) {
  const response = await fetchWithRetry(
    wfsUrl(source.wfs, { typeName: source.typeName, cql, resultType: "hits" }),
  );
  return parseHits(await response.text());
}

/** Downloads a WFS layer as CSV and checks that nothing was truncated. */
async function wfsRecords(source, cql) {
  const expected = await wfsHits(source, cql);
  const url = wfsUrl(source.wfs, { typeName: source.typeName, cql });
  const text = await (await fetchWithRetry(url)).text();
  if (text.trimStart().startsWith("<")) {
    throw new Error(`WFS returned XML instead of CSV: ${text.slice(0, 300)}`);
  }
  const records = parse(text, { columns: true, skip_empty_lines: true });
  if (records.length !== expected) {
    throw new Error(`WFS returned ${records.length} rows, expected ${expected} (truncated?)`);
  }
  for (const record of records) assertLonLatWkt(record.geom);
  return { records, url };
}

/**
 * GET over HTTPS trusting the default roots plus one intermediate certificate.
 * Used for servers that do not send their intermediate (D-014): the chain is
 * still fully verified against the system roots.
 */
async function httpsGetWithIntermediate(url, intermediateUrl) {
  const der = Buffer.from(await (await fetchWithRetry(intermediateUrl)).arrayBuffer());
  const intermediate = new X509Certificate(der).toString();
  const ca = [...tls.rootCertificates, intermediate];
  for (let i = 1; ; i++) {
    try {
      return await new Promise((resolve, reject) => {
        const request = https.get(
          url,
          { ca, headers: { "User-Agent": USER_AGENT }, timeout: 300_000 },
          (response) => {
            if (response.statusCode !== 200) {
              response.resume();
              reject(new Error(`HTTP ${response.statusCode} for ${url}`));
              return;
            }
            const parts = [];
            response.on("data", (part) => parts.push(part));
            response.on("end", () => resolve(Buffer.concat(parts)));
            response.on("error", reject);
          },
        );
        request.on("timeout", () => request.destroy(new Error("timeout")));
        request.on("error", reject);
      });
    } catch (error) {
      if (i >= 3) throw error;
      console.warn(`  attempt ${i} failed (${error.message}); retrying…`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * i));
    }
  }
}

async function downloadShapefile(url, baseName, { intermediateCaUrl } = {}) {
  const zip = intermediateCaUrl
    ? new Uint8Array(await httpsGetWithIntermediate(url, intermediateCaUrl))
    : new Uint8Array(await (await fetchWithRetry(url)).arrayBuffer());
  const files = unzipSync(zip, {
    filter: (file) => file.name.split("/").pop().startsWith(`${baseName}.`),
  });
  const find = (ext) => {
    const name = Object.keys(files).find((n) => n.toLowerCase().endsWith(`${baseName}.${ext}`));
    return name ? files[name] : undefined;
  };
  const shp = find("shp");
  const dbf = find("dbf");
  if (!shp || !dbf) throw new Error(`Shapefile ${baseName} not found in ${url}`);
  const encodingFile = find("cst") ?? find("cpg");
  const encoding = encodingFile
    ? new TextDecoder().decode(encodingFile).trim().slice(0, 20)
    : "utf-8";
  const toArrayBuffer = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);

  const reader = await shapefile.open(toArrayBuffer(shp), toArrayBuffer(dbf), { encoding });
  const features = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value.geometry) features.push(value);
  }
  return { features, encoding, bytes: zip.byteLength };
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

function sslConfig() {
  const caPath = process.env.SUPABASE_DB_CA_CERT;
  if (caPath) return { ca: readFileSync(caPath, "utf8") };
  console.warn(
    "SUPABASE_DB_CA_CERT not set: TLS is encrypted but the server certificate is not verified.",
  );
  return { rejectUnauthorized: false };
}

async function inTransaction(client, fn) {
  await client.query("begin");
  try {
    const result = await fn();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function recordSnapshot(client, source, details) {
  await client.query(
    "insert into data_snapshots (source, synced_at, details) values ($1, now(), $2)",
    [source, details],
  );
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

async function importCoverage(client) {
  const geocodes = PILOT_MUNICIPALITIES.map((m) => m.geocode);
  const { records, url } = await wfsRecords(SOURCES.coverage, cqlIn("geocodigo", geocodes));
  if (records.length !== geocodes.length) {
    throw new Error(`Expected ${geocodes.length} municipalities, got ${records.length}`);
  }
  const rows = records.map((r) => ({
    name: clean(r.nome),
    mun_geocode: clean(r.geocodigo),
    wkt: r.geom,
  }));

  await inTransaction(client, async () => {
    await client.query(
      `insert into coverage_regions (name, mun_geocode, geom)
       select r.name, r.mun_geocode, ${toStoredGeom("st_geomfromtext(r.wkt)")}
       from jsonb_to_recordset($1::jsonb) as r(name text, mun_geocode text, wkt text)
       on conflict (mun_geocode) do update set name = excluded.name, geom = excluded.geom`,
      [JSON.stringify(rows)],
    );
    await client.query(
      "delete from coverage_regions where mun_geocode is null or not (mun_geocode = any($1))",
      [geocodes],
    );
    const { rows: stats } = await client.query(
      "select count(*)::int as n, round(sum(st_area(geom::geography)) / 1e6) as km2 from coverage_regions",
    );
    await recordSnapshot(client, "COVERAGE", {
      layer: SOURCES.coverage.typeName,
      url,
      municipalities: rows.map((r) => `${r.name} (${r.mun_geocode})`),
      area_km2: Number(stats[0].km2),
    });
    console.log(`  ${stats[0].n} municipalities, ${stats[0].km2} km²`);
  });
}

async function upsertDeforestation(client, rows, { onlyInCoverage }) {
  let written = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const { rowCount } = await client.query(
      `with input as (
         select r.*, ${toStoredGeom("st_geomfromtext(r.wkt)")} as g
         from jsonb_to_recordset($1::jsonb) as r(
           source text, external_id text, class_name text, detected_at date, prodes_year int,
           satellite text, sensor text, municipality text, mun_geocode text,
           published_month date, wkt text)
       )
       insert into deforestation (source, external_id, class_name, detected_at, prodes_year,
         satellite, sensor, municipality, mun_geocode, published_month, area_ha, geom)
       select source, external_id, class_name, detected_at, prodes_year, satellite, sensor,
         municipality, mun_geocode, published_month, st_area(g::geography) / 10000, g
       from input
       where not st_isempty(g)
         ${onlyInCoverage ? "and exists (select 1 from coverage_regions c where st_intersects(c.geom, g))" : ""}
       on conflict (source, external_id) do update set
         class_name = excluded.class_name, detected_at = excluded.detected_at,
         prodes_year = excluded.prodes_year, satellite = excluded.satellite,
         sensor = excluded.sensor, municipality = excluded.municipality,
         mun_geocode = excluded.mun_geocode, published_month = excluded.published_month,
         area_ha = excluded.area_ha, geom = excluded.geom, imported_at = now()`,
      [JSON.stringify(batch)],
    );
    written += rowCount;
    process.stdout.write(`\r  ${written} rows written`);
  }
  process.stdout.write("\n");
  return written;
}

async function importDeter(client) {
  const geocodes = PILOT_MUNICIPALITIES.map((m) => m.geocode);
  const { records, url } = await wfsRecords(SOURCES.deter, cqlIn("mun_geocod", geocodes));
  const rows = records.map((r) => ({
    source: "DETER",
    external_id: deterExternalId(r),
    class_name: clean(r.classname),
    detected_at: clean(r.view_date),
    prodes_year: null,
    satellite: clean(r.satellite),
    sensor: clean(r.sensor),
    municipality: clean(r.municipality),
    mun_geocode: clean(r.mun_geocod),
    published_month: clean(r.publish_month),
    wkt: r.geom,
  }));
  const keys = new Set(rows.map((r) => r.external_id));
  if (keys.size !== rows.length) throw new Error("Duplicate DETER keys: see D-008");

  await inTransaction(client, async () => {
    const written = await upsertDeforestation(client, rows, { onlyInCoverage: false });
    const { rows: stats } = await client.query(
      `select count(*)::int as n, max(detected_at)::text as latest, min(detected_at)::text as earliest
       from deforestation where source = 'DETER' and not is_synthetic`,
    );
    await recordSnapshot(client, "DETER", {
      layer: SOURCES.deter.typeName,
      url,
      fetched: rows.length,
      written,
      total_in_db: stats[0].n,
      earliest: stats[0].earliest,
      latest_view_date: stats[0].latest,
    });
    console.log(`  DETER in DB: ${stats[0].n}, ${stats[0].earliest} to ${stats[0].latest}`);
  });
}

async function importProdes(client) {
  const cql = `${cqlBbox("geom", PILOT_BBOX)} AND year >= ${PRODES_MIN_YEAR}`;
  const { records, url } = await wfsRecords(SOURCES.prodes, cql);
  const rows = records.map((r) => ({
    source: "PRODES",
    external_id: clean(r.uuid),
    class_name: clean(r.class_name),
    detected_at: clean(r.image_date),
    prodes_year: toNumber(r.year),
    satellite: clean(r.satellite),
    sensor: clean(r.sensor),
    municipality: null,
    mun_geocode: null,
    published_month: null,
    wkt: r.geom,
  }));

  await inTransaction(client, async () => {
    // The bbox is wider than the three municipalities: keep only what touches them.
    const written = await upsertDeforestation(client, rows, { onlyInCoverage: true });
    const { rows: stats } = await client.query(
      `select count(*)::int as n, max(prodes_year) as latest_year,
              jsonb_object_agg(prodes_year, n) as by_year
       from (select prodes_year, count(*)::int as n from deforestation
             where source = 'PRODES' group by 1) t`,
    );
    await recordSnapshot(client, "PRODES", {
      layer: SOURCES.prodes.typeName,
      url,
      min_year: PRODES_MIN_YEAR,
      fetched_in_bbox: rows.length,
      written_in_coverage: written,
      latest_year: stats[0].latest_year,
      by_year: stats[0].by_year,
    });
    console.log(`  PRODES in DB by year: ${JSON.stringify(stats[0].by_year)}`);
  });
}

async function importProtectedAreas(client, kind, { features, url, encoding }, mapProps, edition) {
  const candidates = features.filter((f) => bboxIntersects(geometryBbox(f.geometry), PILOT_BBOX));
  await inTransaction(client, async () => {
    await client.query("delete from protected_areas where kind = $1", [kind]);
    let written = 0;
    // One at a time: protected-area polygons can be very large.
    for (const feature of candidates) {
      const props = mapProps(feature.properties);
      const { rowCount } = await client.query(
        `with g as (select ${toStoredGeom("st_geomfromgeojson($5)")} as geom)
         insert into protected_areas (kind, external_id, name, category, source_date, geom)
         select $1, $2, $3, $4, $6, g.geom from g
         where exists (select 1 from coverage_regions c where st_intersects(c.geom, g.geom))`,
        [
          kind,
          props.external_id,
          props.name,
          props.category,
          JSON.stringify(feature.geometry),
          props.source_date,
        ],
      );
      written += rowCount;
    }
    const { rows: names } = await client.query(
      "select name from protected_areas where kind = $1 order by name",
      [kind],
    );
    await recordSnapshot(client, kind, {
      url,
      edition,
      encoding,
      features_in_file: features.length,
      candidates_in_bbox: candidates.length,
      written_in_coverage: written,
      names: names.map((r) => r.name),
    });
    console.log(
      `  ${kind} in coverage: ${written} (${names.map((r) => r.name).join(", ") || "none"})`,
    );
  });
}

async function importTi(client) {
  const file = await downloadShapefile(SOURCES.ti.url, SOURCES.ti.shapefile, {
    intermediateCaUrl: SOURCES.ti.intermediateCaUrl,
  });
  await importProtectedAreas(
    client,
    "TI",
    { ...file, url: SOURCES.ti.url },
    (p) => ({
      external_id: clean(p.terrai_cod),
      name: clean(p.terrai_nom),
      category: clean(p.fase_ti),
      source_date: clean(p.data_atual),
    }),
    null,
  );
}

async function importUc(client) {
  const file = await downloadShapefile(SOURCES.uc.url, SOURCES.uc.shapefile);
  await importProtectedAreas(
    client,
    "UC",
    { ...file, url: SOURCES.uc.url },
    (p) => ({
      external_id: clean(p.cd_cnuc),
      name: clean(p.nome_uc),
      category: clean(p.categoria),
      source_date: SOURCES.uc.edition,
    }),
    SOURCES.uc.edition,
  );
}

// ---------------------------------------------------------------------------

const handlers = {
  coverage: importCoverage,
  deter: importDeter,
  prodes: importProdes,
  ti: importTi,
  uc: importUc,
};

async function main() {
  const requested = process.argv.slice(2);
  const unknown = requested.filter((s) => !STEPS.includes(s));
  if (unknown.length) {
    console.error(`Unknown step(s): ${unknown.join(", ")}. Valid: ${STEPS.join(", ")}`);
    process.exit(1);
  }
  const steps = requested.length ? STEPS.filter((s) => requested.includes(s)) : STEPS;

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error("Missing SUPABASE_DB_URL in .env.local");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString, ssl: sslConfig() });
  await client.connect();
  await client.query("set search_path = public, extensions");

  try {
    const { rows } = await client.query("select count(*)::int as n from coverage_regions");
    if (!steps.includes("coverage") && rows[0].n === 0) {
      throw new Error("coverage_regions is empty: run the 'coverage' step first");
    }
    for (const step of steps) {
      const started = Date.now();
      console.log(`▶ ${step}`);
      await handlers[step](client);
      console.log(`  done in ${((Date.now() - started) / 1000).toFixed(1)} s`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
