import "server-only";

import type { ComplianceStatus } from "@/lib/compliance/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FarmSummary = {
  id: string;
  name: string;
  commodity: string;
  municipality: string | null;
  area_ha: number;
  is_demo: boolean;
  last_check: { status: ComplianceStatus; created_at: string } | null;
};

/** Farms of the signed-in user (RLS) with their latest check. */
export async function listMyFarms(): Promise<FarmSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("farms")
    .select(
      "id, name, commodity, municipality, area_ha, is_demo, created_at, checks(status, created_at)",
    )
    .order("created_at", { ascending: true })
    .order("created_at", { referencedTable: "checks", ascending: false })
    .limit(1, { referencedTable: "checks" });
  if (error) throw new Error(`Could not list farms: ${error.message}`);
  return (data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    commodity: f.commodity,
    municipality: f.municipality,
    area_ha: Number(f.area_ha),
    is_demo: f.is_demo,
    last_check: (f.checks?.[0] as FarmSummary["last_check"]) ?? null,
  }));
}
