import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page, TestInfo } from "@playwright/test";

/**
 * Fictitious e-mail of the e2e test user (never the demo account). One user
 * per parallel slot: workers run at the same time, and a new magic link
 * invalidates the previous one of the same user. parallelIndex is stable
 * (0 .. workers-1), so the number of test users stays small.
 */
export function e2eEmail(testInfo: TestInfo): string {
  return `e2e-${testInfo.parallelIndex}@rastro.example`;
}

export const hasSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/**
 * Signs the test user in through the real magic-link landing route: the
 * admin API generates the link (no e-mail is sent) and the browser opens
 * /auth/confirm with its token hash.
 */
export async function signInAsTestUser(
  page: Page,
  testInfo: TestInfo,
  next = "/app",
): Promise<string> {
  const email = e2eEmail(testInfo);
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) {
    // First run: the user does not exist yet.
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) throw created.error;
    return signInAsTestUser(page, testInfo, next);
  }
  // New users get a "signup" link, existing ones a "magiclink" link.
  const { hashed_token: hash, verification_type: type } = data.properties;
  await page.goto(`/auth/confirm?token_hash=${hash}&type=${type}&next=${encodeURIComponent(next)}`);
  return data.user.id;
}

/** Removes everything the test user created (checks cascade with farms). */
export async function deleteTestUserFarms(userId: string) {
  const { error } = await adminClient().from("farms").delete().eq("owner_id", userId);
  if (error) throw error;
}
