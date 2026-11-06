import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null; isDemo: boolean };

/** Fictitious e-mail of the shared demonstration account (no real person). */
export function demoEmail(): string {
  return process.env.DEMO_USER_EMAIL ?? "demo@rastro.example";
}

/**
 * Data Access Layer: the verified user of this request, or null. Reads the
 * session cookies, so callers must render behind a <Suspense> boundary.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const email = typeof claims.email === "string" ? claims.email : null;
  return { id: claims.sub, email, isDemo: email === demoEmail() };
}

/** Like getCurrentUser, but sends visitors without a session to /entrar. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar");
  return user;
}

/** Only relative paths inside the app are accepted as redirect targets. */
export function safeNextPath(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}
