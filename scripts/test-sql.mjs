// Runs the SQL integration tests (tests/integration). Uses TEST_DATABASE_URL,
// or SUPABASE_DB_URL when RASTRO_SQL_TESTS_ON_SUPABASE=1 is set explicitly.
// Every test runs inside a transaction that is rolled back.
import { spawnSync } from "node:child_process";

const env = { ...process.env };
if (!env.TEST_DATABASE_URL && env.RASTRO_SQL_TESTS_ON_SUPABASE === "1") {
  env.TEST_DATABASE_URL = env.SUPABASE_DB_URL;
}
if (!env.TEST_DATABASE_URL) {
  console.error(
    "Set TEST_DATABASE_URL, or RASTRO_SQL_TESTS_ON_SUPABASE=1 to run against SUPABASE_DB_URL (rolled back).",
  );
  process.exit(1);
}
const result = spawnSync("npx", ["vitest", "run", "tests/integration"], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
