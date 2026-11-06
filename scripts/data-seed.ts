// Creates the demonstration data: the shared demo account and its three
// fictitious farms (data/demo/*.geojson), locked, each with a compliance
// check run by the same code as the app. Idempotent; exits with an error if a
// farm does not get its expected status.
//
// Usage: npm run data:seed [-- account farms]
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
// DEMO_USER_PASSWORD (optionally DEMO_USER_EMAIL) in .env.local.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Polygon } from "geojson";

import { isCommodity } from "../src/lib/commodities";
import { checkFarmWith } from "../src/lib/compliance/check";
import type { ComplianceStatus } from "../src/lib/compliance/types";
import { validateFarmPolygon } from "../src/lib/geo/farm-geometry";

const STEPS = ["account", "farms"] as const;
type Step = (typeof STEPS)[number];
const DEMO_DIR = path.join(process.cwd(), "data", "demo");

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
  return value;
}

const supabase: SupabaseClient = createClient(
  env("NEXT_PUBLIC_SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const demoEmail = env("DEMO_USER_EMAIL", "demo@rastro.example");

async function findUserId(email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user) return user.id;
    if (data.users.length < 1000) return null;
  }
}

/** Shared demo account: fictitious e-mail, confirmed, password from the env. */
async function ensureDemoAccount(): Promise<string> {
  const password = env("DEMO_USER_PASSWORD");
  if (password.length < 16) throw new Error("DEMO_USER_PASSWORD must have at least 16 characters");
  const existing = await findUserId(demoEmail);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    console.log(`  demo account exists (${demoEmail}); password synced`);
    return existing;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: demoEmail,
    password,
    email_confirm: true,
    user_metadata: { demo: true },
  });
  if (error) throw error;
  console.log(`  demo account created (${demoEmail})`);
  return data.user.id;
}

type DemoFarm = {
  file: string;
  name: string;
  commodity: string;
  expected: ComplianceStatus;
  polygon: Polygon;
};

function readDemoFarms(): DemoFarm[] {
  return readdirSync(DEMO_DIR)
    .filter((f) => f.endsWith(".geojson"))
    .sort()
    .map((file) => {
      const fc = JSON.parse(readFileSync(path.join(DEMO_DIR, file), "utf8"));
      const props = fc.features?.[0]?.properties ?? {};
      const geometry = validateFarmPolygon(fc);
      if (!geometry.ok) throw new Error(`${file}: invalid polygon (${geometry.error})`);
      if (!props.fictitious) throw new Error(`${file}: must be marked as fictitious`);
      if (!isCommodity(props.commodity)) throw new Error(`${file}: unknown commodity`);
      return {
        file,
        name: String(props.name),
        commodity: props.commodity,
        expected: props.expected_status as ComplianceStatus,
        polygon: geometry.polygon,
      };
    });
}

function toEwkt(polygon: Polygon): string {
  const rings = polygon.coordinates
    .map((ring) => `(${ring.map(([x, y]) => `${x} ${y}`).join(",")})`)
    .join(",");
  return `SRID=4326;POLYGON(${rings})`;
}

async function seedFarms() {
  const ownerId = await findUserId(demoEmail);
  if (!ownerId) throw new Error("Demo account not found: run the 'account' step first");

  // Farms that visitors created in the shared demo account are removed, so
  // every seed leaves the demo exactly as designed.
  const { count: removed, error: cleanError } = await supabase
    .from("farms")
    .delete({ count: "exact" })
    .eq("owner_id", ownerId)
    .eq("is_demo", false);
  if (cleanError) throw cleanError;
  if (removed) console.log(`  removed ${removed} farm(s) created by visitors`);

  const failures: string[] = [];
  for (const farm of readDemoFarms()) {
    const row = {
      owner_id: ownerId,
      name: farm.name,
      commodity: farm.commodity,
      capture_method: "upload",
      geom: toEwkt(farm.polygon),
      is_demo: true,
      is_locked: true,
    };
    const { data: existing, error: findError } = await supabase
      .from("farms")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("is_demo", true)
      .eq("name", farm.name)
      .maybeSingle();
    if (findError) throw findError;

    let farmId: string;
    if (existing) {
      const { error } = await supabase.from("farms").update(row).eq("id", existing.id);
      if (error) throw error;
      // Old checks would show a stale verdict history; the seed starts clean.
      const { error: delError } = await supabase.from("checks").delete().eq("farm_id", existing.id);
      if (delError) throw delError;
      farmId = existing.id;
    } else {
      const { data, error } = await supabase.from("farms").insert(row).select("id").single();
      if (error) throw error;
      farmId = data.id;
    }

    const check = await checkFarmWith(supabase, farmId);
    const r = check.result;
    const summary = r.findings
      .map(
        (f) =>
          `${f.source} ${f.class ?? ""} ${f.detected_at ?? f.prodes_year} ${f.overlap_ha} ha (${f.effect})`,
      )
      .join("; ");
    const ok = check.status === farm.expected;
    console.log(
      `  ${ok ? "✓" : "✗"} ${farm.name}: ${r.farm_area_ha} ha, ${r.municipality?.name ?? "?"} → ${check.status}` +
        (summary ? ` [${summary}]` : ""),
    );
    if (!ok) failures.push(`${farm.name}: expected ${farm.expected}, got ${check.status}`);
  }
  if (failures.length) throw new Error(`Unexpected results:\n${failures.join("\n")}`);
}

const handlers: Record<Step, () => Promise<unknown>> = {
  account: ensureDemoAccount,
  farms: seedFarms,
};

async function main() {
  const requested = process.argv.slice(2);
  const unknown = requested.filter((s) => !(STEPS as readonly string[]).includes(s));
  if (unknown.length) {
    console.error(`Unknown step(s): ${unknown.join(", ")}. Valid: ${STEPS.join(", ")}`);
    process.exit(1);
  }
  const steps = requested.length ? STEPS.filter((s) => requested.includes(s)) : STEPS;
  for (const step of steps) {
    console.log(`▶ ${step}`);
    await handlers[step]();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
