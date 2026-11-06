import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

import { checkFarmWith, type FarmCheck } from "./check";
import type { ImageryStatus } from "./types";

export type { FarmCheck };

/**
 * Runs the compliance check of a farm on the server and stores it in `checks`.
 * Uses the service role: users cannot write checks. The caller must make sure
 * the user owns the farm.
 */
export async function runFarmCheck(
  farmId: string,
  options: { imagery?: ImageryStatus } = {},
): Promise<FarmCheck> {
  return checkFarmWith(createSupabaseAdminClient(), farmId, options);
}
