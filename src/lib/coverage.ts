import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { cacheLife, cacheTag } from "next/cache";

export type CoverageOutline = Feature<Polygon | MultiPolygon, { municipalities: string[] }>;

/**
 * Simplified outline of the pilot region. Public data that changes only when
 * the import runs, so it is cached on the server for days. It is a visual aid
 * only (the server check decides coverage), so failures never break the page
 * or the build: they return null and are cached for minutes only.
 */
export async function getCoverageOutline(): Promise<CoverageOutline | null> {
  "use cache";
  cacheTag("coverage");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("coverage_outline");
    if (!error && data) {
      cacheLife("days");
      return data as CoverageOutline;
    }
    console.error("coverage_outline failed:", error?.message ?? "empty");
  }
  cacheLife("minutes");
  return null;
}
