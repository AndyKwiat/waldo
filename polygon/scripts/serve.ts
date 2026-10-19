/** Static server for the polygon city (no build step). `bun scripts/serve.ts` → http://localhost:3011 (PORT overrides). */
import { resolve, normalize } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

export function serve(port = Number(process.env.PORT ?? 3011)) {
  return Bun.serve({
    port,
    async fetch(req) {
      let p = decodeURIComponent(new URL(req.url).pathname);
      if (p === "/") p = "/index.html";
      const file = normalize(resolve(ROOT, "." + p));
      if (!file.startsWith(ROOT)) return new Response("forbidden", { status: 403 });
      const f = Bun.file(file);
      if (!(await f.exists())) return new Response("not found", { status: 404 });
      return new Response(f, { headers: { "cache-control": "no-store" } });
    },
  });
}

if (import.meta.main) {
  const s = serve();
  console.log(`Jade River City (polygon) → http://localhost:${s.port}/   (?view=plaza|town|overview|street|gate|fort|river|paddies|pagoda, &t=<sim seconds>, &seed=N, &low, &noshadow)`);
}
