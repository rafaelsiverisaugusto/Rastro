import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { getSupabasePublicEnv } from "./env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers,
 * acting as the signed-in user (anon key + session cookies, subject to RLS).
 * Create one per request; never share it.
 */
export async function createSupabaseServerClient() {
  // Auth checks token expiry with the clock and calls the network: always at
  // request time, never during (runtime) prerendering.
  await connection();
  const { url, anonKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by the auth proxy (Phase 1).
        }
      },
    },
  });
}

/**
 * Service-role client: bypasses RLS. Server only, for writes that users must
 * not be able to forge (checks, dossiers, lots, alerts) and for imports.
 */
export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
