// Applies pending migrations in supabase/migrations to the remote database.
// Usage: npm run db:push  (reads SUPABASE_DB_URL from .env.local)
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("Missing SUPABASE_DB_URL in .env.local");
  process.exit(1);
}

const require = createRequire(import.meta.url);
const cli = require.resolve("supabase/dist/supabase.js");
const extra = process.argv.slice(2); // e.g. --dry-run

const result = spawnSync(
  process.execPath,
  [cli, "db", "push", `--remote=${dbUrl}`, "--yes", ...extra],
  {
    stdio: "inherit",
  },
);
process.exit(result.status ?? 1);
