/**
 * Drives the Voxer editor (../../voxer, or $VOXER_DIR) headlessly so model recipes can be built with
 * Voxer's own draw ops, snapshot renderer and scene format.
 *
 * Why not the voxer MCP server? It starts its app server against voxer/models/, which would overwrite
 * the user's _autosave.json. Here we import Voxer's server with an in-memory store on a private port and
 * point a headless Chrome page at it, then talk to the page over Voxer's HTTP RPC (/api/rpc).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const VOXER_DIR = process.env.VOXER_DIR ?? resolve(import.meta.dir, "../../../voxer");

export interface Voxer {
  /** Calls window.voxer.api[method](params) in the page (see voxer/src/agent/Api.ts). */
  rpc(method: string, params?: unknown): Promise<any>;
  close(): void;
}

export async function startVoxer(): Promise<Voxer> {
  if (!existsSync(resolve(VOXER_DIR, "server/index.ts"))) throw new Error(`Voxer not found at ${VOXER_DIR} (set VOXER_DIR)`);
  if (!existsSync(resolve(VOXER_DIR, "public/main.js"))) {
    const b = Bun.spawnSync([process.execPath, "run", "build"], { cwd: VOXER_DIR, stderr: "pipe" });
    if (b.exitCode !== 0) throw new Error("voxer build failed: " + b.stderr.toString());
  }
  const { startServer } = await import(resolve(VOXER_DIR, "server/index.ts"));
  const { launchChrome } = await import(resolve(VOXER_DIR, "scripts/lib/chrome.ts"));
  const server = startServer(0, resolve(VOXER_DIR, "public"), {}); // no modelsDir → in-memory, nothing written to voxer/models
  const base = `http://127.0.0.1:${server.port}`;
  const chrome = await launchChrome({ url: `${base}/?agent=headless`, width: 1100, height: 900 });
  for (let i = 0; ; i++) {
    const s = await fetch(base + "/api/agent/status").then((r) => r.json()).catch(() => null);
    if (s?.active) break;
    if (i > 120) { chrome.kill(); server.stop(true); throw new Error("voxer page did not connect"); }
    await Bun.sleep(250);
  }
  return {
    async rpc(method, params = {}) {
      const r = await fetch(base + "/api/rpc", { method: "POST", body: JSON.stringify({ method, params }) });
      const body = (await r.json()) as { result?: unknown; error?: string };
      if (body.error) throw new Error(`${method}: ${body.error}`);
      return body.result;
    },
    close() { chrome.kill(); server.stop(true); },
  };
}
