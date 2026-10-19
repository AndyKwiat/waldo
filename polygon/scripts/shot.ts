/**
 * Headless screenshots of the polygon city — the main way for an agent to *see* a change.
 *
 *   bun scripts/shot.ts                               # town view → shots/town.png
 *   bun scripts/shot.ts --views plaza,gate,river      # several named views (see VIEWS in src/main.js)
 *   bun scripts/shot.ts --t 20 --size 1400x900        # advance the simulation 20 s first; window size
 *   bun scripts/shot.ts --cam 300,80,500:350,0,400    # explicit camera position:target
 *   bun scripts/shot.ts --eval "city.follow(5)"       # run JS in the page before capturing
 *   bun scripts/shot.ts --sheet                       # also tile all captures into shots/sheet.png
 *
 * Prints page console errors and `city.stats()` so regressions show up in text too.
 * Uses headless Chrome with SwiftShader (software GL): slow but deterministic; `--low` is on by default.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "./serve";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = resolve(import.meta.dir, "..");
const args = process.argv.slice(2);
const opt = (k: string, d?: string) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const flag = (k: string) => args.includes(k);
const views = (opt("--views") ?? (opt("--cam") ? "custom" : "town")).split(",");
const [W, H] = (opt("--size") ?? "1280x800").split("x").map(Number);
const t = Number(opt("--t") ?? "6"), outDir = resolve(ROOT, opt("--out") ?? "shots");
const extra = opt("--params") ?? (flag("--hq") ? "" : "low");
mkdirSync(outDir, { recursive: true });

const server = serve(0);
const port = 9300 + Math.floor(Math.random() * 600);
const profile = `/tmp/jrc-chrome-${process.pid}`;
const chrome = Bun.spawn([CHROME, "--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-first-run",
  `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, `--user-data-dir=${profile}`, "about:blank"], { stdout: "ignore", stderr: "ignore" });
const cleanup = () => { chrome.kill(); server.stop(true); };

try {
  let page: any;
  for (let i = 0; i < 80 && !page; i++) { await Bun.sleep(150); page = (await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => [])).find((x: any) => x.type === "page"); }
  if (!page) throw new Error("chrome did not start");
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map<number, (v: any) => void>(); const logs: string[] = [];
  ws.onmessage = (m) => { const d = JSON.parse(String(m.data));
    if (d.id && pending.has(d.id)) { pending.get(d.id)!(d); pending.delete(d.id); }
    if (d.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(d.params.type)) logs.push(`console.${d.params.type}: ${d.params.args.map((a: any) => a.value ?? a.description).join(" ")}`);
    if (d.method === "Runtime.exceptionThrown") logs.push("EXCEPTION " + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text)); };
  const send = (method: string, params = {}) => new Promise<any>((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async (expr: string) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "eval failed"); return r.result?.result?.value; };
  await send("Runtime.enable"); await send("Page.enable");
  await send("Page.navigate", { url: `http://127.0.0.1:${server.port}/?${extra}` });
  const t0 = Date.now();
  while (!(await evalJS("window.city && (window.city.ready || window.city.error) ? true : false").catch(() => false))) { if (Date.now() - t0 > 180000) throw new Error("page never became ready"); await Bun.sleep(300); }
  const err = await evalJS("window.city.error || ''"); if (err) throw new Error("page error: " + err);
  console.log(`ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (t > 0) await evalJS(`city.advance(${t})`);
  const files: string[] = [];
  for (const v of views) {
    if (v === "custom") { const [p, q] = opt("--cam")!.split(":"); await evalJS(`city.cam([${p}],[${q}])`); } else await evalJS(`city.view(${JSON.stringify(v)})`);
    if (opt("--eval")) await evalJS(opt("--eval")!);
    await evalJS("city.advance(0.5)");
    const shot = await send("Page.captureScreenshot", { format: "png" });
    const file = resolve(outDir, `${v}.png`); writeFileSync(file, Buffer.from(shot.result.data, "base64")); files.push(file);
    console.log("wrote", file);
  }
  console.log("stats", JSON.stringify(await evalJS("city.stats()")));
  if (flag("--sheet") && files.length > 1) {
    const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${Math.min(3, files.length)},1fr);gap:4px">${files.map((f) => `<img style="width:100%" src="data:image/png;base64,${readFileSync(f).toString("base64")}">`).join("")}</body>`;
    await evalJS(`document.documentElement.innerHTML = ${JSON.stringify(html)}; new Promise(r => setTimeout(r, 600))`);
    const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); writeFileSync(resolve(outDir, "sheet.png"), Buffer.from(s.result.data, "base64")); console.log("wrote", resolve(outDir, "sheet.png"));
  }
  if (logs.length) console.log(logs.slice(0, 20).join("\n"));
  ws.close();
} finally { cleanup(); }
