import "server-only";

import type { FeatureCollection, Polygon } from "geojson";

import type { ComplianceResult, ComplianceStatus } from "@/lib/compliance/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FarmMapLayers = {
  farm: Polygon;
  bbox: [number, number, number, number];
  deforestation: FeatureCollection;
  protected_areas: FeatureCollection;
};

export type FarmDetail = {
  id: string;
  name: string;
  commodity: string;
  municipality: string | null;
  area_ha: number;
  is_demo: boolean;
  check: { status: ComplianceStatus; result: ComplianceResult; created_at: string } | null;
  layers: FarmMapLayers;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A farm of the signed-in user (RLS), its latest check and map layers. Null if not found. */
export async function getFarmDetail(id: string): Promise<FarmDetail | null> {
  if (!UUID_RE.test(id)) return null;
  const supabase = await createSupabaseServerClient();
  const [farmRes, checkRes, layersRes] = await Promise.all([
    supabase
      .from("farms")
      .select("id, name, commodity, municipality, area_ha, is_demo")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("checks")
      .select("status, result, created_at")
      .eq("farm_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("farm_map_layers", { p_farm_id: id }),
  ]);
  if (farmRes.error) throw new Error(`farm: ${farmRes.error.message}`);
  if (checkRes.error) throw new Error(`check: ${checkRes.error.message}`);
  if (layersRes.error) throw new Error(`layers: ${layersRes.error.message}`);
  if (!farmRes.data || !layersRes.data) return null;
  const f = farmRes.data;
  return {
    id: f.id,
    name: f.name,
    commodity: f.commodity,
    municipality: f.municipality,
    area_ha: Number(f.area_ha),
    is_demo: f.is_demo,
    check: (checkRes.data as FarmDetail["check"]) ?? null,
    layers: layersRes.data as FarmMapLayers,
  };
}
