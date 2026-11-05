import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "./env";

/** Supabase client for Client Components (anon key, subject to RLS). */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
