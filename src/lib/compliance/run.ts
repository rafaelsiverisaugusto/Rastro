import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

import { BORDER_TOLERANCE_M } from "./constants";
import { evaluateCompliance } from "./evaluate";
import type { ComplianceFacts, ComplianceResult, ImageryStatus } from "./types";

export type FarmCheck = {
  id: string;
  status: ComplianceResult["status"];
  result: ComplianceResult;
};

/**
 * Runs the compliance check of a farm on the server and stores it in `checks`.
 * Facts come from PostGIS (public.compliance_facts_for_farm); the verdict comes
 * only from evaluateCompliance. Uses the service role: users cannot write checks.
 * The caller must make sure the user owns the farm.
 */
export async function runFarmCheck(
  farmId: string,
  options: { imagery?: ImageryStatus } = {},
): Promise<FarmCheck> {
  const supabase = createSupabaseAdminClient();

  const { data: facts, error: factsError } = await supabase.rpc("compliance_facts_for_farm", {
    p_farm_id: farmId,
    border_tolerance_m: BORDER_TOLERANCE_M,
  });
  if (factsError) throw new Error(`compliance_facts_for_farm failed: ${factsError.message}`);

  const result = evaluateCompliance(facts as ComplianceFacts, options);

  const { data: check, error: insertError } = await supabase
    .from("checks")
    .insert({ farm_id: farmId, status: result.status, result })
    .select("id")
    .single();
  if (insertError) throw new Error(`Could not store the check: ${insertError.message}`);

  if (result.municipality) {
    // Best effort: the farm's municipality comes from the coverage region.
    await supabase
      .from("farms")
      .update({ municipality: result.municipality.name })
      .eq("id", farmId)
      .is("municipality", null);
  }

  return { id: check.id as string, status: result.status, result };
}
