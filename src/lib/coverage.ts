import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { cacheLife, cacheTag } from "next/cache";

import { getSupabasePublicEnv } from "@/lib/supabase/env";

export type CoverageOutline = Feature<Polygon | MultiPolygon, { municipalities: string[] }>;

/**
 * Simplified outline of the pilot region. Public data that changes only when
 * the import runs, so it is cached on the server.
 */
export async function getCoverageOutline(): Promise<CoverageOutline | null> {
  "use cache";
  cacheLife("days");
  cacheTag("coverage");
  const { url, anonKey } = getSupabasePublicEnv();
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("coverage_outline");
  if (error) throw new Error(`coverage_outline failed: ${error.message}`);
  return (data as CoverageOutline | null) ?? null;
}
