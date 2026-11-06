"use server";

import type { Polygon } from "geojson";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { isCaptureMethod, isCommodity } from "@/lib/commodities";
import { runFarmCheck } from "@/lib/compliance/run";
import { validateFarmPolygon, type FarmGeometryError } from "@/lib/geo/farm-geometry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateFarmError =
  | { field: "name" | "commodity" | "method" }
  | { field: "geometry"; error: FarmGeometryError }
  | { field: "server" };

function toEwkt(polygon: Polygon): string {
  const rings = polygon.coordinates
    .map((ring) => `(${ring.map(([x, y]) => `${x} ${y}`).join(",")})`)
    .join(",");
  return `SRID=4326;POLYGON(${rings})`;
}

/**
 * Creates the farm (as the user, under RLS), runs the compliance check on the
 * server and opens the result. The geometry is validated again here.
 */
export async function createFarm(input: {
  name: string;
  commodity: string;
  method: string;
  geometry: unknown;
}): Promise<CreateFarmError> {
  const user = await requireUser("/app/fazendas/nova");

  const name = String(input.name ?? "").trim();
  if (name.length < 2 || name.length > 80) return { field: "name" };
  if (!isCommodity(input.commodity)) return { field: "commodity" };
  if (!isCaptureMethod(input.method)) return { field: "method" };
  const geometry = validateFarmPolygon(input.geometry);
  if (!geometry.ok) return { field: "geometry", error: geometry.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("farms")
    .insert({
      owner_id: user.id,
      name,
      commodity: input.commodity,
      capture_method: input.method,
      geom: toEwkt(geometry.polygon),
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("insert farm failed:", error?.code, error?.message);
    if (error?.code === "23514") return { field: "geometry", error: "self_intersecting" };
    return { field: "server" };
  }

  try {
    await runFarmCheck(data.id);
  } catch (checkError) {
    // The farm exists; its page offers to run the check again.
    console.error(checkError);
  }
  redirect(`/app/fazendas/${data.id}`);
}

/** Runs the check again for a farm of the signed-in user. */
export async function recheckFarm(farmId: string): Promise<{ ok: false } | never> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  // RLS: only finds the farm if it belongs to the user.
  const { data } = await supabase.from("farms").select("id").eq("id", farmId).maybeSingle();
  if (!data) return { ok: false };
  try {
    await runFarmCheck(farmId);
  } catch (error) {
    console.error(error);
    return { ok: false };
  }
  redirect(`/app/fazendas/${farmId}`);
}
