"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { demoEmail, safeNextPath } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; code: "invalid_email" | "rate_limited" | "failed" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
}

export async function sendMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email) || email === demoEmail()) {
    return { status: "error", code: "invalid_email" };
  }
  const next = safeNextPath(formData.get("next"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    console.error("signInWithOtp failed:", error.status, error.code);
    return { status: "error", code: error.status === 429 ? "rate_limited" : "failed" };
  }
  return { status: "sent", email };
}

export type DemoState = { status: "idle" } | { status: "error" };

/** Signs in to the shared demonstration account (fictitious farms only). */
export async function signInAsDemo(_prev: DemoState, formData: FormData): Promise<DemoState> {
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password) {
    console.error("DEMO_USER_PASSWORD is not set");
    return { status: "error" };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: demoEmail(), password });
  if (error) {
    console.error("demo sign-in failed:", error.status, error.code);
    return { status: "error" };
  }
  redirect(safeNextPath(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
