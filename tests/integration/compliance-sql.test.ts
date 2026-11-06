/**
 * Runs public.compliance_facts (PostGIS) on the synthetic fixtures and checks
 * the verdict of evaluateCompliance. Needs TEST_DATABASE_URL: in CI, a
 * throwaway PostGIS container; locally it may point to the Supabase database,
 * because everything runs inside a transaction that is always rolled back.
 */
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { BORDER_TOLERANCE_M } from "@/lib/compliance/constants";
import { evaluateCompliance } from "@/lib/compliance/evaluate";
import type { ComplianceFacts } from "@/lib/compliance/types";

import { COMPLIANCE_CASES, COVERAGE } from "../fixtures/compliance-cases";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("compliance_facts (SQL) + evaluateCompliance", () => {
  let client: pg.Client;

  beforeAll(async () => {
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url!);
    client = new pg.Client({
      connectionString: url,
      ssl: local ? false : { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query("begin");
    await client.query("set local search_path = public, extensions");

    const geo = "st_setsrid(st_geomfromgeojson($3), 4326)";
    for (const c of COVERAGE) {
      await client.query(
        `insert into coverage_regions (name, mun_geocode, geom) values ($1, $2, st_multi(${geo}))`,
        [c.name, c.mun_geocode, JSON.stringify(c.geom)],
      );
    }
    for (const c of COMPLIANCE_CASES) {
      for (const [i, d] of c.deforestation.entries()) {
        await client.query(
          `insert into deforestation (source, external_id, class_name, detected_at, prodes_year, area_ha, geom)
           values ($1, $2, $4, $5, $6, st_area(${geo}::geography) / 10000, st_multi(${geo}))`,
          [
            d.source,
            `TEST|${c.id}|${i}`,
            JSON.stringify(d.geom),
            d.class_name,
            d.detected_at,
            d.prodes_year,
          ],
        );
      }
      for (const [i, p] of c.protected_areas.entries()) {
        await client.query(
          `insert into protected_areas (kind, external_id, name, geom)
           values ($1, $2, $4, st_multi(${geo}))`,
          [p.kind, `TEST|${c.id}|${i}`, JSON.stringify(p.geom), p.name],
        );
      }
    }
  });

  afterAll(async () => {
    if (!client) return;
    await client.query("rollback");
    await client.end();
  });

  it.each(COMPLIANCE_CASES.map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const { rows } = await client.query(
      "select compliance_facts(st_setsrid(st_geomfromgeojson($1), 4326), $2) as facts",
      [JSON.stringify(c.farm), BORDER_TOLERANCE_M],
    );
    const facts = rows[0].facts as ComplianceFacts;
    const result = evaluateCompliance(facts);

    expect(result.status, c.description).toBe(c.expected.status);
    expect(result.findings, c.description).toHaveLength(c.expected.findings);
    if (c.expected.info !== undefined) {
      expect(result.findings.filter((f) => f.effect === "info")).toHaveLength(c.expected.info);
    }
    if (c.expected.border_tolerance_applied !== undefined) {
      expect(result.parameters.border_tolerance_applied).toBe(c.expected.border_tolerance_applied);
    }
    if (c.expected.municipality !== undefined) {
      expect(result.municipality?.name).toBe(c.expected.municipality);
    }
    // Areas come from geography: the 400 m x 400 m farm is 16 ha.
    if (c.id === "no_overlap") expect(result.farm_area_ha).toBeCloseTo(16, 1);
  });

  it("counts identical DETER rows (same geometry, date and class) only once", async () => {
    const c = COMPLIANCE_CASES.find((x) => x.id === "deter_after_cutoff")!;
    const d = c.deforestation[0];
    await client.query("savepoint dup");
    await client.query(
      `insert into deforestation (source, external_id, class_name, detected_at, geom)
       values ('DETER', 'TEST|dup', $2, $3, st_multi(st_setsrid(st_geomfromgeojson($1), 4326)))`,
      [JSON.stringify(d.geom), d.class_name, d.detected_at],
    );
    const { rows } = await client.query(
      "select compliance_facts(st_setsrid(st_geomfromgeojson($1), 4326), $2) as facts",
      [JSON.stringify(c.farm), BORDER_TOLERANCE_M],
    );
    await client.query("rollback to savepoint dup");
    expect((rows[0].facts as ComplianceFacts).deforestation).toHaveLength(1);
  });

  it("is not executable by anon or authenticated users", async () => {
    const { rows } = await client.query(
      `select has_function_privilege('anon', 'public.compliance_facts(extensions.geometry, double precision)', 'execute') as anon,
              has_function_privilege('authenticated', 'public.compliance_facts_for_farm(uuid, double precision)', 'execute') as auth`,
    );
    expect(rows[0]).toEqual({ anon: false, auth: false });
  });
});
