/**
 * Builds every model recipe (models/recipes) inside the Voxer editor, headlessly:
 *   new_scene → run(ops) → snapshot (saved to models/sheets/<name>.png) → serialize (models/<name>.json)
 *
 *   bun scripts/build-models.ts              # all recipes
 *   bun scripts/build-models.ts home1 shop   # just these
 *   bun scripts/build-models.ts --views front,iso,iso_left,top --tile 320
 *
 * Look at the sheet PNGs after a change — they are Voxer's own labeled multi-view renders.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { startVoxer } from "./voxer";
import { RECIPES } from "../models/recipes/index.js";

const ROOT = resolve(import.meta.dir, "..");
const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]!; args.splice(i, 2); return v; };
const views = opt("--views", "front,iso,iso_left,top").split(",");
const tile = Number(opt("--tile", "300"));
const names = args.length ? args : Object.keys(RECIPES);
for (const n of names) if (!(n in RECIPES)) throw new Error(`unknown recipe ${n}; have: ${Object.keys(RECIPES).join(", ")}`);

mkdirSync(resolve(ROOT, "models/sheets"), { recursive: true });
const manifestPath = resolve(ROOT, "models/manifest.json");
const manifest: Record<string, { size: number; voxels: number; bbox: unknown }> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};

const vox = await startVoxer();
try {
  for (const name of names) {
    const t0 = performance.now();
    const g = (RECIPES as Record<string, () => any>)[name]!();
    await vox.rpc("new_scene", { size: g.size });
    await vox.rpc("run", { ops: g.toOps() });
    const info = await vox.rpc("info");
    const scene = await vox.rpc("serialize");
    writeFileSync(resolve(ROOT, `models/${name}.json`), JSON.stringify(scene));
    // snapshots are best-effort: SwiftShader occasionally stalls on big scenes, so retry smaller, then move on
    for (const [v, t] of [[views, tile], [["front", "iso"], 200]] as const) {
      try { const snap = await vox.rpc("snapshot", { views: v, tile: t }); writeFileSync(resolve(ROOT, `models/sheets/${name}.png`), Buffer.from(snap.data, "base64")); break; }
      catch (e) { console.warn(`  ${name}: snapshot failed (${(e as Error).message}); ${t === 200 ? "skipping sheet" : "retrying smaller"}`); }
    }
    manifest[name] = { size: g.size, voxels: info.count ?? info.voxels ?? g.v.size, bbox: info.bbox };
    console.log(`${name.padEnd(14)} ${String(g.v.size).padStart(6)} voxels  ${Math.round(performance.now() - t0)} ms`);
  }
} finally {
  vox.close();
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
