// Copies the MapLibre web worker to public/ so the browser can load it.
// MapLibre 6 resolves its worker relative to its own module file, which does
// not exist once the bundler merges it into a chunk (docs/decisoes.md D-019).
// Runs before `dev` and `build`; the copy is not versioned in git.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(
  readFileSync(path.join(root, "node_modules/maplibre-gl/package.json"), "utf8"),
);
const outDir = path.join(root, "public", "maplibre");
const target = `maplibre-gl-worker.${pkg.version}.mjs`;

mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(outDir)) {
  if (file !== target) rmSync(path.join(outDir, file));
}
copyFileSync(
  path.join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"),
  path.join(outDir, target),
);
console.log(`MapLibre worker ${pkg.version} -> public/maplibre/${target}`);
