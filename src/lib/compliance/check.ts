import type { SupabaseClient } from "@supabase/supabase-js";

import { BORDER_TOLERANCE_M } from "./constants";
import { evaluateCompliance } from "./evaluate";
import type { ComplianceFacts, ComplianceResult, ImageryStatus } from "./types";

export type FarmCheck = {
  id: string;
  status: ComplianceResult["status"];
  result: ComplianceResult;
};

/**
 * Runs and stores the compliance check of a farm with a service-role client.
 * Facts come from PostGIS (compliance_facts_for_farm); the verdict comes only
 * from evaluateCompliance. Shared by the app (runFarmCheck) and the seed.
 */
export async function checkFarmWith(
  supabase: SupabaseClient,
  farmId: string,
  options: { imagery?: ImageryStatus } = {},
): Promise<FarmCheck> {
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
