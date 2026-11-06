// Creates the demonstration data: the shared demo account and (later) its
// fictitious farms. Idempotent.
//
// Usage: npm run data:seed [-- account]
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
// DEMO_USER_PASSWORD (and optionally DEMO_USER_EMAIL) in .env.local.
import { createClient } from "@supabase/supabase-js";

const STEPS = ["account"];

function env(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
  return value;
}

const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user || data.users.length < 1000) return user ?? null;
  }
}

/** Shared demo account: fictitious e-mail, confirmed, password from the env. */
export async function ensureDemoAccount() {
  const email = env("DEMO_USER_EMAIL", "demo@rastro.example");
  const password = env("DEMO_USER_PASSWORD");
  if (password.length < 16) throw new Error("DEMO_USER_PASSWORD must have at least 16 characters");

  const existing = await findUserByEmail(email);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    console.log(`  demo account exists (${email}); password synced`);
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { demo: true },
  });
  if (error) throw error;
  console.log(`  demo account created (${email})`);
  return data.user.id;
}

const handlers = { account: ensureDemoAccount };

async function main() {
  const requested = process.argv.slice(2);
  const unknown = requested.filter((s) => !STEPS.includes(s));
  if (unknown.length) {
    console.error(`Unknown step(s): ${unknown.join(", ")}. Valid: ${STEPS.join(", ")}`);
    process.exit(1);
  }
  for (const step of requested.length ? requested : STEPS) {
    console.log(`▶ ${step}`);
    await handlers[step]();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
