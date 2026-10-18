// City simulation (ported from the 2D game): a street graph with precomputed shortest routes, places with
// door approaches, citizens with homes + roles running errands, vehicles, soldiers, pets, pigeons, river life.
// Pure logic on the x/z ground plane; main.js turns entities into instanced voxel meshes.
import { STREET, rand, rnd, rndi, pick, chance, SX, SZ, COLS, ROWS, PLAZA, CENTER, CITY, GATE_X, WALL, RIVER, PADDIES, FIELDS, HAMLETS, WX, WZ, occupied, onStatue, STATUE, EDGE_LIST, HSEG, alleyZ, YARD, PLAZA_R, AV_C } from "./world.js";
import { genPerson, TITLES } from "./people.js";

// ---- navigation graph from the world's street network: pedestrians use streets + alleys, vehicles streets only
const NC = COLS + 1, NR = ROWS + 1, NN = NC * NR, nid = (c, r) => r * NC + c;
export const NODES = []; for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) NODES.push({ x: SX[c], z: SZ[r] });
export const EDGES = EDGE_LIST.map((e) => [nid(...e.a), nid(...e.b)]);
const EDGE_INFO = new Map(); EDGE_LIST.forEach((e, i) => { const [a, b] = EDGES[i]; EDGE_INFO.set(a + ":" + b, { ...e, fwd: true }); EDGE_INFO.set(b + ":" + a, { ...e, fwd: false }); });
function floyd(edges) {
  const D = [...Array(NN)].map(() => new Float64Array(NN).fill(1e9)), N = [...Array(NN)].map(() => new Int16Array(NN).fill(-1));
  for (let i = 0; i < NN; i++) { D[i][i] = 0; N[i][i] = i; }
  for (const [a, b, len] of edges) { D[a][b] = D[b][a] = len; N[a][b] = b; N[b][a] = a; }
  for (let k = 0; k < NN; k++) for (let i = 0; i < NN; i++) { const dik = D[i][k]; if (dik >= 1e9) continue; for (let j = 0; j < NN; j++) if (dik + D[k][j] < D[i][j]) { D[i][j] = dik + D[k][j]; N[i][j] = N[i][k]; } }
  return [D, N];
}
// alleys are narrow: they cost 1.2× their length + 30, so through-traffic stays on the wide streets and alleys carry local trips
const elen = (a, b, e) => (e.pts ? e.pts.reduce((s, p, i, arr) => s + (i ? Math.hypot(p.x - arr[i - 1].x, p.z - arr[i - 1].z) : 0), 0) * 1.2 + 30 : Math.hypot(NODES[a].x - NODES[b].x, NODES[a].z - NODES[b].z));
const [DIST, NEXT] = floyd(EDGES.map(([a, b], i) => [a, b, elen(a, b, EDGE_LIST[i])]));
const [VDIST, VNEXT] = floyd(EDGES.filter((_, i) => EDGE_LIST[i].type === "street").map(([a, b]) => [a, b, elen(a, b, {})]));
const PED_NODES = [...new Set(EDGES.flat())];

// ---- congestion-aware routing: every walker's route is a fresh Dijkstra over the 81-node street graph where each
// edge costs its length + a penalty per slowed walker currently on it (and on the junctions it passes), smoothed over a
// few seconds, plus a little per-route noise so a crowd doesn't all switch to the same detour at once.
const ADJ = [...Array(NN)].map(() => []);   // [neighbour, length, edge index]
EDGES.forEach(([a, b], i) => { const len = elen(a, b, EDGE_LIST[i]); ADJ[a].push([b, len, i]); ADJ[b].push([a, len, i]); });
export const CONG = { edge: new Float32Array(EDGES.length), node: new Float32Array(NN), edgeNow: new Float32Array(EDGES.length), nodeNow: new Float32Array(NN), samples: 0 };
const PER_SLOW = 26, NOISE = 0.15;   // route cost of one slowed walker ≈ 9 units of extra walking
function route(from, to) {
  const dist = new Float64Array(NN).fill(1e9), prev = new Int16Array(NN).fill(-1), done = new Uint8Array(NN);
  dist[from] = 0;
  for (;;) {
    let u = -1, best = 1e9; for (let i = 0; i < NN; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0 || u === to) break; done[u] = 1;
    for (const [v, len, ei] of ADJ[u]) {
      const c = len * (1 + (rand() - 0.5) * NOISE) + PER_SLOW * (CONG.edge[ei] + CONG.node[v]);
      if (best + c < dist[v]) { dist[v] = best + c; prev[v] = u; }
    }
  }
  return { dist, prev };
}
/** Which street element is (x, z) on? → {node} at a junction, {edge} along a street segment, or null. */
function streetElement(x, z) {
  const H = STREET / 2 + 2; let c = 0, r = 0;
  for (let i = 1; i < SX.length; i++) if (Math.abs(SX[i] - x) < Math.abs(SX[c] - x)) c = i;
  for (let i = 1; i < SZ.length; i++) if (Math.abs(SZ[i] - z) < Math.abs(SZ[r] - z)) r = i;
  const inV = Math.abs(x - SX[c]) < H, inH = Math.abs(z - SZ[r]) < H;
  if (inV && inH) return { node: nid(c, r) };
  if (inH) { const c0 = x < SX[c] ? c - 1 : c; const ei = EDGE_IDX.get(nid(c0, r) + ":" + nid(c0 + 1, r)); return ei === undefined ? null : { edge: ei }; }
  if (inV) { const r0 = z < SZ[r] ? r - 1 : r; const ei = EDGE_IDX.get(nid(c, r0) + ":" + nid(c, r0 + 1)); return ei === undefined ? null : { edge: ei }; }
  return null;
}
const EDGE_IDX = new Map(); EDGES.forEach(([a, b], i) => { EDGE_IDX.set(a + ":" + b, i); EDGE_IDX.set(b + ":" + a, i); });
const GATE_NODE = nid(AV_C, ROWS);
const VEH_NODES = PED_NODES.filter((n) => n !== GATE_NODE && VDIST[GATE_NODE][n] < 1e9);   // vehicles stay on the street network reachable from the gate
const SEDGES = EDGES.filter(([a, b], i) => EDGE_LIST[i].type === "street" && VEH_NODES.includes(a) && VEH_NODES.includes(b));

const hyp = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const segAnchor = (x, z, n1, n2, alley = false) => ({ x, z, o: NODES[n1].z === NODES[n2].z ? "h" : "v", nodes: [n1, n2], alley });
const nodeAnchor = (n) => ({ x: NODES[n].x, z: NODES[n].z, o: "n", nodes: [n] });
function nearestNode(x, z, set = PED_NODES) { let best = set[0], bd = 1e9; for (const i of set) { const d = Math.hypot(NODES[i].x - x, NODES[i].z - z); if (d < bd) { bd = d; best = i; } } return best; }
const anchorPt = (e, a) => { const k = a.alley ? 0.25 : 1; return a.o === "h" ? { x: a.x, z: a.z + e.lz * k } : a.o === "v" ? { x: a.x + e.lx * k, z: a.z } : { x: a.x + e.lx, z: a.z + e.lz }; };
const nodePt = (e, n) => ({ x: NODES[n].x + e.lx, z: NODES[n].z + e.lz });
/** Waypoints for walking edge n→m: the alley's winding points (with a narrow personal lane), nothing extra for streets. */
function edgePts(e, n, m) { const info = EDGE_INFO.get(n + ":" + m); if (!info || !info.pts) return []; const pts = info.fwd ? info.pts : [...info.pts].reverse(); return pts.map((p) => ({ x: p.x, z: p.z + e.lz * 0.25 })); }
/**
 * Keep-right lanes: shifts a centre-line route sideways to the walker's right of travel (x east, z south: right of
 * (dx, dz) is (-dz, dx)), mitred at corners, so people going opposite ways use opposite sides of the street instead
 * of meeting head-on. `lane[i]` is the offset for point i (narrow in alleys).
 */
function keepRight(pts, lane) {
  const n = pts.length; if (n < 2) return pts;
  const dirs = []; for (let i = 0; i < n - 1; i++) { const dx = pts[i + 1].x - pts[i].x, dz = pts[i + 1].z - pts[i].z, d = Math.hypot(dx, dz); dirs.push(d > 1e-6 ? [dx / d, dz / d] : null); }
  for (let i = 0; i < n - 1; i++) if (!dirs[i]) dirs[i] = dirs[i - 1] ?? dirs.slice(i + 1).find(Boolean) ?? [1, 0];
  return pts.map((p, i) => {
    const a = dirs[Math.max(0, i - 1)], b = dirs[Math.min(n - 2, i)], ra = [-a[1], a[0]], rb = [-b[1], b[0]];
    let mx = ra[0] + rb[0], mz = ra[1] + rb[1]; const m = Math.hypot(mx, mz);
    if (m < 1e-6) { mx = rb[0]; mz = rb[1]; } else { mx /= m; mz /= m; }
    const k = lane[i] / Math.max(0.6, mx * rb[0] + mz * rb[1]);   // mitre, capped at sharp turns
    return { ...p, x: p.x + mx * k, z: p.z + mz * k };
  });
}
const CENTER_LINE = { lx: 0, lz: 0 };
const streetLane = (e) => e.lane ?? (e.lane = 1.5 + Math.abs(e.lx) * 0.75);   // 1.5..7.5 right of the centre line
const alleyLane = (e) => Math.min(2.2, 0.8 + Math.abs(e.lx) * 0.2);

function buildPath(e, from, to) {
  // The whole route (out of the doorway, along the streets, into the next doorway) is built on centre lines and then
  // shifted into this walker's keep-right lane, so in- and outgoing flows pass on opposite sides (doorways get a narrow lane).
  const pts = [], lanes = [], doorLane = (d) => (d.lane ? 1.2 + (d.lane - 1.2) * Math.abs(e.lx) / 8 : 1.9 + Math.abs(e.lx) * 0.04);   // wide openings: several sub-lanes
  if (from && from.approach.length) for (let i = from.approach.length - 2; i >= 0; i--) { pts.push(from.approach[i]); lanes.push(doorLane(from)); }
  const a1 = from ? from.anchor : nodeAnchor(nearestNode(e.x, e.z)), a2 = to.anchor, A1 = anchorPt(CENTER_LINE, a1), A2 = anchorPt(CENTER_LINE, a2);
  // the street-network part is built on centre lines, then shifted into this walker's keep-right lane
  const net = pts, SL = streetLane(e), AL = alleyLane(e);
  if (from && from.approach.length) { net.push(A1); lanes.push(a1.alley ? AL : SL); }
  const same = a1.nodes.length === a2.nodes.length && a1.nodes.every((n) => a2.nodes.includes(n));
  if (!same) { let best = 1e9, b1 = a1.nodes[0], b2 = a2.nodes[0];
    let bestR = null;
    for (const n1 of a1.nodes) { const R = route(n1, -1); for (const n2 of a2.nodes) { const c = hyp(A1, NODES[n1]) + R.dist[n2] + hyp(NODES[n2], A2); if (c < best) { best = c; b1 = n1; b2 = n2; bestR = R; } } }
    const chain = [b2]; for (let n = b2, g = 0; n !== b1 && g++ < 90;) { n = bestR.prev[n]; if (n < 0) break; chain.push(n); } chain.reverse();
    if (chain[0] !== b1) { chain.length = 0; for (let n = b1, g = 0; g++ < 90; n = NEXT[n][b2]) { chain.push(n); if (n === b2 || NEXT[n][b2] < 0) break; } }   // fallback: static shortest path
    net.push(nodePt(CENTER_LINE, chain[0])); lanes.push(SL);
    for (let k = 1; k < chain.length; k++) { for (const q of edgePts(CENTER_LINE, chain[k - 1], chain[k])) { net.push(q); lanes.push(AL); } net.push(nodePt(CENTER_LINE, chain[k])); lanes.push(SL); } }
  net.push(A2); lanes.push(a2.alley ? AL : SL);
  for (const p of to.approach) { pts.push(p); lanes.push(doorLane(to)); }
  const out = keepRight(pts, lanes).slice(); pts.length = 0; pts.push(...out);
  if (!to.hide && to.approach.length) { const L = pts[pts.length - 1]; pts[pts.length - 1] = { x: L.x + rnd(-3, 3), z: L.z + rnd(-2, 2) }; }
  return pts;
}
function randomStroll() { const i = Math.floor(rand() * EDGES.length), [a, b] = EDGES[i], E = EDGE_LIST[i], t = rnd(0.15, 0.85); let x = NODES[a].x + (NODES[b].x - NODES[a].x) * t, z = NODES[a].z + (NODES[b].z - NODES[a].z) * t;
  if (E.type === "alley") z = alleyZ(E.a[1], E.a[0], x); return { kind: "stroll", x, z, anchor: segAnchor(x, z, a, b, E.type === "alley"), approach: [], hide: false }; }

const FAMS = ["Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Zhao", "Huang", "Zhou", "Wu", "Xu", "Sun", "Ma", "Zhu", "Hu", "Guo", "Lin", "He", "Gao", "Luo"];
const GIVEN = ["Mei", "Lan", "Hua", "Jun", "Wei", "Ming", "Lei", "Ying", "Xiu", "Bo", "Fang", "Hong", "Jing", "Kai", "Ling", "Ping", "Qing", "Rui", "Tao", "Yan"];
const PETNAMES = ["Mantou", "Doudou", "Huahua", "Xiaobai", "Wangcai", "Dahuang", "Niuniu", "Tangyuan", "Huzi", "Pipi"];
const ROLE_OF = { farmer: "farmer", merchant: "merchant", porter: "porter", official: "official", monk: "monk", kid: "kid", soldier: "soldier" };

/**
 * Builds the population. `W` = world.layout() result. Returns {ents, pigeons, boats, ducks, step(dt), stats()}.
 * Entity fields main.js reads: look (person spec | {animal,…} | {model}), x, z, y, yaw, hidden, mv, hop.
 */
export function createSim(W) {
  const R = { pick, chance };
  // ---- places
  const HOUSES = [], HOMES = [], SHOPS = [], TEAHOUSES = [];
  for (const h of W.houses) {
    let anchor;
    if (h.node) anchor = nodeAnchor(nid(...h.node));
    else { const rr = h.south ? h.r + 1 : h.r, alley = HSEG[rr][h.c] === "alley"; anchor = segAnchor(h.doorX, alley ? alleyZ(rr, h.c, h.doorX) : SZ[rr], nid(h.c, rr), nid(h.c + 1, rr), alley); }
    const pl = { kind: h.type === "inn" ? "inn" : h.type === "shop" ? "shop" : h.type === "teahouse" ? "teahouse" : "home", x: h.doorX, z: h.inZ, anchor, approach: [{ x: h.doorX, z: h.outZ }, { x: h.doorX, z: h.inZ }], hide: true, house: h };
    HOUSES.push(pl); (pl.kind === "home" ? HOMES : SHOPS).push(pl); if (pl.kind === "teahouse") TEAHOUSES.push(pl);
  }
  const STALLS = [];
  // shoppers enter the market from the side street level with their stall (spreads traffic along the plaza edges)
  for (const s of W.stalls) for (const ox of [-6, 0, 6]) { const p = { x: s.x + ox, z: s.z + s.front * 9 }, c = p.x < CENTER.x ? AV_C - 1 : AV_C + 1;
    // enter from the nearest of the plaza's four surrounding streets (not just the two side streets)
    const zN = SZ[PLAZA_R], zS = SZ[PLAZA_R + 1], xW = SX[AV_C - 1], xE = SX[AV_C + 1], cx = p.x < GATE_X ? AV_C - 1 : AV_C;
    const opts = [[Math.abs(p.x - xW), () => segAnchor(xW, p.z, nid(AV_C - 1, PLAZA_R), nid(AV_C - 1, PLAZA_R + 1))], [Math.abs(p.x - xE), () => segAnchor(xE, p.z, nid(AV_C + 1, PLAZA_R), nid(AV_C + 1, PLAZA_R + 1))],
      [Math.abs(p.z - zN), () => segAnchor(p.x, zN, nid(cx, PLAZA_R), nid(cx + 1, PLAZA_R))], [Math.abs(p.z - zS), () => segAnchor(p.x, zS, nid(cx, PLAZA_R + 1), nid(cx + 1, PLAZA_R + 1))]].sort((a, b) => a[0] - b[0]);
    void c; STALLS.push({ kind: "stall", x: p.x, z: p.z, anchor: opts[0][1](), approach: [p], hide: false }); }
  const PAGODA = { kind: "pagoda", x: W.pagoda.x, z: W.pagoda.inZ, anchor: segAnchor(W.pagoda.x, SZ[W.pagoda.r], nid(W.pagoda.c, W.pagoda.r), nid(W.pagoda.c + 1, W.pagoda.r)), approach: [{ x: W.pagoda.x, z: W.pagoda.outZ }, { x: W.pagoda.x, z: W.pagoda.inZ }], hide: true, lane: 2.6 };
  const FORTP = { kind: "fort", x: GATE_X, z: W.fort.inZ, anchor: nodeAnchor(nid(AV_C, 2)), approach: [{ x: GATE_X, z: W.fort.outZ }, { x: GATE_X, z: W.fort.inZ }], hide: true, lane: 3.8 };   // the gatehouse passage is ~12 wide
  const FARMS = []; for (let i = 0; i < 50; i++) { const p = pick(PADDIES), fx = rnd(p.x + 4, p.x + p.w - 4), fz = p.z + 12 * rndi(0, Math.floor(p.d / 12) - 1) + rnd(2, 7), j = 0;
    FARMS.push({ kind: "farm", x: fx, z: fz, anchor: nodeAnchor(GATE_NODE), approach: [{ x: GATE_X + j, z: CITY.z1 - 4 }, { x: GATE_X + j, z: CITY.z1 + 26 }, { x: GATE_X + j, z: Math.max(CITY.z1 + 34, fz) }, { x: fx, z: fz }], hide: false, lane: 3.2 }); }
    // farmers follow the south road to their own field's row before turning off (no single fan-out point), in keep-right
    // lanes that fit the 10-wide gate tunnel

  // ---- entities
  const ents = [];
  const newEnt = (o) => { const e = Object.assign({ x: 0, z: 0, y: 0, yaw: rnd(0, 6.28), speed: rnd(9, 15), phase: rand() * 10, path: null, pi: 0, pause: 0, timer: 0, hidden: false, stuck: 0, ox: 0, oz: 0,
    lx: rnd(-8, 8), lz: rnd(-7, 7), cr: 1.8, w8: 1, mv: false, brain: "idle", activity: "", hop: 1, nocol: false }, o); ents.push(e); return e; };
  // looks come from a small library per archetype (+ tweak) so the renderer can instance them: ≤10 variants each
  const LIB = new Map();
  const lookFor = (arch, tweak) => { const key = arch + "|" + (tweak ? tweak.toString() : ""); let arr = LIB.get(key); if (!arr) LIB.set(key, (arr = []));
    if (arr.length < 10) { const p = genPerson(arch, R); if (tweak) tweak(p); arr.push(p); return p; } return pick(arr); };
  const person = (arch, o = {}, tweak) => { const p = lookFor(arch, tweak); return newEnt(Object.assign({ kind: "person", look: p, name: pick(FAMS) + " " + pick(GIVEN), title: TITLES[arch] ?? "Townsperson", role: ROLE_OF[arch] ?? "resident", cr: p.item === "pole" ? 3.6 : p.kid ? 1.9 : 2.4, scale: p.kid ? 0.72 : 1 }, o)); };
  const at = (e, x, z) => { e.x = x; e.z = z; return e; };

  const stayTime = (e, pl) => { switch (pl.kind) { case "home": return pl === e.home ? (e.role === "farmer" ? rnd(12, 40) : rnd(4, 16)) : rnd(3, 10); case "shop": return rnd(3, 8); case "inn": return rnd(4, 12); case "teahouse": return rnd(5, 14); case "pagoda": return e.role === "monk" ? rnd(20, 45) : rnd(10, 24); case "fort": return e.role === "official" ? rnd(25, 70) : rnd(5, 14); case "stall": return rnd(3, 9); case "farm": return rnd(50, 120); default: return rnd(0.5, 3); } };
  const insideText = (e, pl) => ({ home: pl === e.home ? "at home" : "visiting friends", shop: pl === e.home ? "minding the shop" : "browsing in a shop", inn: "having tea at the inn", teahouse: "sipping tea upstairs at the teahouse", pagoda: e.role === "monk" ? "meditating in the pagoda" : "praying at the pagoda", fort: e.role === "official" ? "holding court in the palace" : "on duty at the palace" })[pl.kind] ?? "";
  const stayText = (e, pl) => (pl.kind === "stall" ? (e.kind === "dog" ? "sniffing around the market" : e.role === "porter" ? "loading goods at a stall" : "haggling at a market stall") : pl.kind === "farm" ? "working the rice paddies" : e.kind === "dog" ? "sniffing a corner" : "taking a breather");
  function chooseNext(e) {
    const r = rand(), here = e.place;
    switch (e.role) {
      case "farmer": if (here && here.kind === "farm") return [e.home, "heading home from the fields"]; if (here === e.home) return [pick(FARMS), "off to work the rice paddies"]; return [e.home, "heading home"];
      case "merchant": if (here !== e.home && r < 0.5) return [e.home, "heading back to the shop"]; return r < 0.7 ? [pick(STALLS), "buying stock at the market"] : [randomStroll(), "out for a stroll"];
      case "porter": return here && here.kind === "stall" ? [pick(SHOPS), "delivering goods"] : [pick(STALLS), "fetching goods from the market"];
      case "official": if (here && here.kind === "fort") return r < 0.5 ? [pick(HOUSES), "inspecting a household"] : [pick(STALLS), "checking market prices"];
        if (r < 0.5) return [FORTP, "reporting to the palace"]; return here === e.home ? [pick(STALLS), "checking market prices"] : [e.home, "heading home"];   // not every errand ends at the one palace door
      case "monk": if (here !== PAGODA) return [PAGODA, "returning to the pagoda"]; return r < 0.5 ? [pick(STALLS), "collecting alms at the market"] : [randomStroll(), "wandering in contemplation"];
      case "kid": if (here !== e.home && r < 0.3) return [e.home, "running home"]; return r < 0.78 ? [randomStroll(), "playing in the street"] : [pick(STALLS), "begging for a sweet at the market"];
      case "dog": return r < 0.75 ? [randomStroll(), "trotting around town"] : [pick(STALLS), "looking for scraps at the market"];
    }
    if (here !== e.home && r < 0.35) return [e.home, "heading home"];
    const q = rand();
    if (q < 0.22) return [pick(STALLS), "going to the market"];
    if (q < 0.47) return [pick(HOMES), "visiting a friend"];
    if (q < 0.66) return [pick(SHOPS), "going shopping"];
    if (q < 0.72) return [pick(TEAHOUSES.length ? TEAHOUSES : SHOPS), "meeting a friend at the teahouse"];
    if (q < 0.78) return [PAGODA, "going to pray at the pagoda"];
    return [randomStroll(), "out for a stroll"];
  }
  /** Smoothed count of slowed walkers on a destination's street segment (its anchor). */
  const destCong = (pl) => { const n = pl?.anchor?.nodes; if (!n) return 0; if (n.length === 1) return CONG.node[n[0]]; const ei = EDGE_IDX.get(n[0] + ":" + n[1]); return ei === undefined ? 0 : CONG.edge[ei]; };
  const goNext = (e) => { let [pl, txt] = chooseNext(e);
    // a jammed destination street makes people more likely to pick another errand (homes and fixed duties excepted)
    for (let k = 0; k < 2 && pl !== e.home && pl?.kind !== "farm" && chance(Math.min(0.85, destCong(pl) / 6)); k++) [pl, txt] = chooseNext(e); e.dest = pl; e.activity = txt; e.path = buildPath(e, e.place, pl); e.pi = 0; };
  const arrive = (e) => { const pl = e.dest; e.place = pl; e.path = null; if (pl.hide) { e.hidden = true; e.timer = stayTime(e, pl); e.activity = insideText(e, pl); } else { e.pause = stayTime(e, pl); e.activity = stayText(e, pl); } };
  function initCitizen(e) {
    if (e.role === "farmer" && chance(0.5)) { const f = pick(FARMS); e.place = e.dest = f; at(e, f.x, f.z); e.pause = rnd(1, 120); e.activity = "working the rice paddies"; return; }   // spread over a whole shift: no rush hour at the gate
    if (e.home && chance(0.2)) { e.place = e.dest = e.home; at(e, e.home.x, e.home.z); e.hidden = true; e.timer = rnd(0, 14); e.activity = insideText(e, e.home); return; }
    const s = randomStroll(); e.place = s; const ap = anchorPt(e, s.anchor); at(e, ap.x, ap.z); goNext(e);
    const k = rndi(0, Math.max(0, e.path.length - 2)); e.pi = k; at(e, e.path[k].x + rnd(-1, 1), e.path[k].z + rnd(-1, 1));
  }

  const ARCHS = ["farmer", "farmer", "merchant", "merchant", "scholar", "official", "monk", "lady", "lady", "plain", "plain", "plain", "kid", "kid", "porter", "performer", "daoist"];
  for (let i = 0; i < 1100; i++) { const e = person(pick(ARCHS), { brain: "citizen" }); e.home = e.role === "monk" ? PAGODA : e.role === "merchant" ? pick(SHOPS) : pick(HOMES); initCitizen(e); }
  for (const s of W.stalls) { const v = person("merchant", { brain: "idle", w8: 0.05, nocol: true, title: "Stall keeper", activity: "selling wares" }, (p) => { p.item = null; }); at(v, s.x, s.z - s.front * 5); v.yaw = s.front > 0 ? 0 : Math.PI; }
  for (let i = 0; i < 45; i++) { const [a, b] = pick(SEDGES), t = rnd(0.2, 0.8), hz = NODES[a].z === NODES[b].z; let x = NODES[a].x + (NODES[b].x - NODES[a].x) * t, z = NODES[a].z + (NODES[b].z - NODES[a].z) * t;
    if (hz) z += pick([-10, 10]); else x += pick([-10, 10]); const n = chance(0.3) ? 3 : 2;
    for (let k = 0; k < n; k++) { const g = person(pick(["lady", "plain", "merchant", "scholar", "farmer", "kid"]), { brain: "idle", w8: 0.08, activity: "gossiping with the neighbours" }); const ang = (k / n) * Math.PI * 2; at(g, x + Math.cos(ang) * 3.4, z + Math.sin(ang) * 3.4); g.yaw = Math.atan2(x - g.x, z - g.z); } }

  // soldiers
  const guard = (x, z, yaw, item = "halberd", txt = "standing guard", title = "Guard") => { const g = person("soldier", { brain: "idle", w8: 0.05, title, activity: txt }, (p) => { p.item = item; }); at(g, x, z); g.yaw = yaw; return g; };
  for (const [x, z, y] of [[GATE_X - 12, CITY.z1 - 6, Math.PI], [GATE_X + 12, CITY.z1 - 6, Math.PI], [GATE_X - 14, CITY.z1 + 22, 0], [GATE_X + 14, CITY.z1 + 22, 0],
    [GATE_X - 14, W.fort.outZ - 1, 0], [GATE_X + 14, W.fort.outZ - 1, 0], [GATE_X - 8, YARD.z + YARD.d + 4, Math.PI], [GATE_X + 8, YARD.z + YARD.d + 4, Math.PI], [PLAZA.x + 3, PLAZA.z + 3, 0.8], [PLAZA.x + PLAZA.w - 3, PLAZA.z + 3, -0.8], [PLAZA.x + 3, PLAZA.z + PLAZA.d - 3, 2.4], [PLAZA.x + PLAZA.w - 3, PLAZA.z + PLAZA.d - 3, -2.4],
    [W.pagoda.x - 12, W.pagoda.outZ - 2, 0]]) guard(x, z, y);
  for (const n of [nid(1, 1), nid(7, 1), nid(1, 3), nid(7, 3), nid(0, 2), nid(8, 2), nid(2, 6), nid(6, 6), nid(1, 7), nid(7, 7), nid(2, 2), nid(6, 2)]) { const N = NODES[n]; guard(N.x - 12, N.z - 12, 0.8, pick(["spear", "halberd"])); guard(N.x - 8, N.z - 12, -0.8, pick(["spear", "halberd"])); }
  // palace yard (between the great hall and the gatehouse): two drill blocks either side of the avenue, archers, off-duty soldiers
  for (const side of [-1, 1]) for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) guard(GATE_X + side * (26 + col * 7), YARD.z + 10 + row * 7, Math.PI, "spear", "drilling in formation", "Palace guard");
  for (const side of [-1, 1]) { const s = person("soldier", { brain: "pace", w8: 0.2, title: "Drill sergeant", activity: "barking orders", speed: 6, ax: "x", a0: GATE_X + side * 24, a1: GATE_X + side * 64, fixed: YARD.z + 36 }, (p) => { p.item = "flag"; }); at(s, GATE_X + side * 40, YARD.z + 36); }
  for (let i = 0; i < 4; i++) guard(YARD.x + YARD.w - 50, YARD.z + 8 + i * 9, Math.PI / 2, "spear", "practising archery", "Archer");
  for (let i = 0; i < 12; i++) { const s = person("soldier", { brain: "yard", yard: { x: YARD.x + 4, z: YARD.z + 2, w: 50, d: YARD.d - 4 }, title: "Soldier", activity: "off duty in the palace yard" }); at(s, YARD.x + 28, YARD.z + 20); }
  for (let sq = 0; sq < 4; sq++) { const lead = person("soldier", { brain: "drive", speed: 8, trail: [], w8: 0.3, lx: rnd(-4, 4), lz: rnd(-4, 4), title: "Patrol captain", activity: "leading a patrol" }, (p) => { p.item = "flag"; });
    const s0 = pick(SEDGES); at(lead, NODES[s0[0]].x, NODES[s0[0]].z);
    for (let k = 1; k <= 4; k++) { const f = person("soldier", { brain: "follow", leader: lead, k, speed: 8, cr: 1.5, title: "Soldier", activity: "on patrol" }, (p) => { p.item = "spear"; }); at(f, lead.x - k * 4, lead.z); } }
  for (const beat of W.beats) for (let k = 0; k < (beat.a1 - beat.a0 > 150 ? 3 : 2); k++) { const t = rnd(beat.a0, beat.a1);
    const s = person("soldier", { brain: "pace", speed: rnd(4, 6), ax: beat.ax, a0: beat.a0, a1: beat.a1, fixed: beat.fixed, y: WALL.h, nocol: true, title: "Sentry", activity: "patrolling the city wall" }, (p) => { p.item = pick(["spear", "halberd", "flag"]); });
    if (beat.ax === "x") at(s, t, beat.fixed); else at(s, beat.fixed, t); }
  for (const tw of W.towers) { const s = person("soldier", { brain: "idle", y: 34, nocol: true, title: "Lookout", activity: "keeping watch from a tower" }, (p) => { p.item = "spear"; }); at(s, tw.x + rnd(-5, 5), tw.z + rnd(-5, 5)); s.yaw = rnd(0, 6.28); }

  // vehicles (models from Voxer; forward = +x)
  const VEH = { rickshaw: ["Rickshaw", "carrying a passenger across town", [14, 18]], sedan: ["Sedan chair", "bearing a noble through the streets", [7, 9]], oxcart: ["Ox cart", "hauling goods to market", [5, 6]], barrow: ["Wheelbarrow", "pushing a load of produce", [7, 9]] };
  for (const [model, n] of [["rickshaw", 15], ["sedan", 7], ["oxcart", 10], ["barrow", 14]]) for (let i = 0; i < n; i++) { const [name, act, sp] = VEH[model];
    const e = newEnt({ kind: "vehicle", look: { model }, brain: "drive", speed: rnd(...sp), cr: model === "barrow" ? 3 : 5, w8: 0.15, hop: 0.3, lx: rnd(-5, 5), lz: rnd(-5, 5), name, title: "", activity: act, trail: null });
    const s0 = pick(SEDGES), t = rand(); at(e, NODES[s0[0]].x + (NODES[s0[1]].x - NODES[s0[0]].x) * t, NODES[s0[0]].z + (NODES[s0[1]].z - NODES[s0[0]].z) * t); }

  // pets & critters
  const animal = (animal, variant, o) => newEnt(Object.assign({ kind: animal, look: { animal, variant }, cr: 1.5, hop: 1.4, name: pick(PETNAMES), title: animal === "dog" ? "Dog" : animal === "cat" ? "Cat" : "" }, o));
  const citizens = ents.filter((e) => e.brain === "citizen" && e.role !== "monk");
  for (let i = 0; i < 24; i++) { const o = pick(citizens), d = animal("dog", rndi(0, 6), { brain: "pet", owner: o, speed: 18, cr: 1.6 }); at(d, o.x - 3, o.z - 2); d.waitX = o.x; d.waitZ = o.z; }
  for (let i = 0; i < 30; i++) { const d = animal("dog", rndi(0, 6), { brain: "citizen", role: "dog", speed: rnd(15, 20) }); initCitizen(d); }
  for (let i = 0; i < 34; i++) { const c = animal("cat", rndi(0, 4), { brain: "cat", speed: rnd(8, 11), activity: "prowling" }); const s = randomStroll(); at(c, s.x + rnd(-15, 15), s.z + rnd(-15, 15)); c.pause = rnd(0, 8); }
  for (let i = 0; i < 28; i++) { const h = pick(W.houses), c = animal("cat", rndi(0, 4), { brain: "idle", nocol: true, activity: "napping on a rooftop", y: h.roofY, hop: 0 }); at(c, h.x + rnd(-8, 8), h.z); c.yaw = rnd(0, 6.28); }
  const field = (o) => { const e = newEnt(o); const p = fieldPt(e); return at(e, p.x, p.z); };
  function fieldPt(e) {
    if (e.band === "paddy") { const f = pick(FARMS); return { x: f.x, z: f.z }; }
    if (e.home2) { const a = rnd(0, 6.28), r = rnd(e.r0 ?? 20, e.r1 ?? 70); return { x: e.home2.x + Math.cos(a) * r, z: e.home2.z + Math.sin(a) * r }; }
    if (e.band === "fields") { const f = pick(FIELDS); return { x: rnd(f.x, f.x + f.w), z: rnd(f.z, f.z + f.d) }; }
    let x, z, n = 0; do { x = rnd(20, WX - 20); z = rnd(RIVER.zc(x) + RIVER.hw + 12, WZ - 20); } while (occupied(x, z, 4) && ++n < 30); return { x, z }; }
  for (let i = 0; i < 49; i++) { const p = lookFor(pick(["farmer", "farmer", "farmer", "porter", "kid", "lady", "plain"])), band = i % 3 === 0 ? "fields" : i % 3 === 1 ? "meadow" : "hamlet";
    field({ kind: "person", look: p, brain: "field", band, home2: band === "hamlet" ? pick(HAMLETS) : null, r0: 10, r1: 60, name: pick(FAMS) + " " + pick(GIVEN), title: band === "hamlet" ? "Villager" : TITLES[p.arch], activity: band === "fields" ? "tending the crops" : band === "hamlet" ? "doing chores in the village" : "wandering the countryside", pauseChance: 0.5, cr: 2.4, scale: p.kid ? 0.72 : 1 }); }
  for (const H of HAMLETS) { for (let i = 0; i < 4; i++) field({ kind: "cow", look: { animal: "cow", variant: pick(["spotted", "#8a5a32", "#c8a070"]) }, brain: "field", home2: { x: H.x + rnd(-40, 40), z: H.z + rnd(70, 110) }, r0: 0, r1: 28, speed: rnd(2, 4), cr: 3, hop: 0.4, pauseChance: 0.8, name: pick(PETNAMES), title: "Cow", activity: "grazing" });
    for (let i = 0; i < 6; i++) field({ kind: "sheep", look: { animal: "sheep", variant: 0 }, brain: "field", home2: { x: H.x + rnd(-60, 60), z: H.z - rnd(70, 100) }, r0: 0, r1: 24, speed: rnd(3, 5), cr: 2.2, hop: 0.6, pauseChance: 0.75, name: pick(PETNAMES), title: "Sheep", activity: "grazing" });
    for (let i = 0; i < 6; i++) field({ kind: "chicken", look: { animal: "chicken", variant: rndi(0, 3) }, brain: "field", home2: H, r0: 8, r1: 40, speed: rnd(4, 7), cr: 0.8, hop: 0.8, pauseChance: 0.6, name: "Chicken", title: "", activity: "scratching for grain" });
    for (let i = 0; i < 2; i++) field({ kind: "pig", look: { animal: "pig", variant: 0 }, brain: "field", home2: H, r0: 30, r1: 55, speed: rnd(4, 7), cr: 2.2, hop: 0.6, pauseChance: 0.6, name: "Pig", title: "", activity: "rooting in the mud" }); }
  for (let i = 0; i < 0; i++) field({ kind: "chicken", look: { animal: "chicken", variant: rndi(0, 3) }, brain: "field", speed: rnd(4, 7), cr: 0.8, hop: 0.8, pauseChance: 0.6, name: "Chicken", title: "", activity: "scratching for grain" });
  for (let i = 0; i < 0; i++) field({ kind: "pig", look: { animal: "pig", variant: 0 }, brain: "field", speed: rnd(4, 7), cr: 2.2, hop: 0.6, pauseChance: 0.6, name: "Pig", title: "", activity: "rooting in the mud" });
  for (let i = 0; i < 12; i++) field({ kind: "crane", look: { animal: "crane", variant: 0 }, band: "paddy", brain: "field", speed: rnd(3, 5), cr: 1.2, hop: 0.4, pauseChance: 0.8, name: "Crane", title: "", activity: "wading in the paddies" });
  // river folk: fishers on docks and banks, strollers along the south bank
  const bankZ = (x) => RIVER.zc(x) + RIVER.hw + 3;
  for (const dx of W.DOCKS) for (const ox of [-2, 2]) { const f = person(pick(["farmer", "plain", "kid"]), { brain: "idle", w8: 0.05, activity: "fishing off the dock", title: "Fisher", y: 1 }, (p) => { p.item = "rod"; }); at(f, dx + ox, RIVER.zc(dx) + 2); f.yaw = Math.PI; }
  for (let i = 0; i < 8; i++) { const x = rnd(40, WX - 40); if (Math.abs(x - W.WHEEL.x) < 30) continue; const f = person(pick(["farmer", "plain", "scholar"]), { brain: "idle", w8: 0.05, activity: "fishing in the river", title: "Fisher" }, (p) => { p.item = "rod"; }); at(f, x, bankZ(x)); f.yaw = Math.PI; }
  for (let i = 0; i < 7; i++) { const e = person(pick(["lady", "plain", "scholar", "kid", "monk"]), { brain: "bank", off: rnd(0, 4), speed: rnd(6, 9), activity: "strolling along the river" }); const x = rnd(30, WX - 30); at(e, x, bankZ(x) + e.off); }

  // ambient: pigeons, boats, ducks (no collisions)
  const pigeons = []; const pigeonSpot = () => { if (chance(0.6)) { let x, z; do { x = rnd(PLAZA.x + 4, PLAZA.x + PLAZA.w - 4); z = rnd(PLAZA.z + 4, PLAZA.z + PLAZA.d - 4); } while (Math.hypot(x - CENTER.x, z - CENTER.z) < 33); return { x, z }; } const s = randomStroll(); return { x: s.x + rnd(-8, 8), z: s.z + rnd(-8, 8) }; };
  for (let i = 0; i < 70; i++) { const s = pigeonSpot(); pigeons.push({ look: { animal: "pigeon", variant: rndi(0, 3) }, x: s.x, z: s.z, y: 0, yaw: rnd(0, 6.28), state: "ground", timer: rnd(0, 4), phase: rand() * 9 }); }
  const boats = []; for (let i = 0; i < 10; i++) boats.push({ look: { model: "boat" }, x: rnd(0, WX), vx: rnd(3, 6) * (chance(0.5) ? 1 : -1), lane: rnd(-5, 5), phase: rand() * 9 });
  const ducks = []; for (let fl = 0; fl < 5; fl++) { const x0 = rnd(0, WX), dir = chance(0.5) ? 1 : -1, sp = rnd(1.5, 3), lane = rnd(-7, 7); for (let k = 0; k < 5; k++) ducks.push({ look: { animal: "duck", variant: k === 0 ? 0 : rndi(0, 2) }, x0, k, dir, sp, lane, phase: rand() * 6 }); }

  // ---- behaviour
  const LOOK = 7;
  /** Look ahead along the walking direction: returns [ux, uz, speedFactor]. */
  function steer(e, ux, uz) {
    if (!(e.speed > 0)) return [ux, uz, 1];
    let sx = 0, sz = 0, cap = 1; const gx = Math.floor(e.x / CELL), gz = Math.floor(e.z / CELL);
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) { const cell = grid.get((gx + ox) * 4096 + gz + oz); if (!cell) continue;
      for (const j of cell) { const b = ents[j]; if (b === e || b.hidden) continue;
        const rx = b.x - e.x, rz = b.z - e.z, along = rx * ux + rz * uz; if (along <= 0 || along > LOOK) continue;
        const lat = rx * -uz + rz * ux, clear = e.cr + b.cr + 0.8; if (Math.abs(lat) > clear) continue;
        const same = b.mv && !b.waiting && b.hx !== undefined ? b.hx * ux + b.hz * uz : 0;   // only follow people actually walking our way; go around anyone standing
        if (same > 0.7) { // someone ahead going our way: fall in behind and match their pace (or wait if right on their heels)
          if (along < clear + 2.5) { const match = Math.min(1, (b.spd ?? b.speed) / e.speed);   // fall in at their pace; only stop when actually touching (no stop-go waves)
            cap = Math.min(cap, along < e.cr + b.cr ? 0.15 : along < clear ? Math.max(0.25, match * 0.9) : Math.max(0.35, match));
            if (match < 0.92) { const side = lat > 0 ? -1 : 1, w = 0.9 * (1 - along / LOOK); sx += -uz * side * w; sz += ux * side * w; } }   // slower walker ahead: ease off and drift past
        } else { // oncoming or standing still: veer away from them, keeping right when they're dead ahead
          const w = 1 - along / LOOK, side = Math.abs(lat) < 0.5 ? 1 : -Math.sign(lat); sx += -uz * side * w * 1.4; sz += ux * side * w * 1.4;
          if (along < clear && !b.mv) cap = Math.min(cap, 0.45); } } }
    if (e.waitT > 1.4) cap = Math.max(cap, 0.5);   // don't queue forever
    ux += sx; uz += sz; const n = Math.hypot(ux, uz) || 1; return [ux / n, uz / n, Number.isFinite(cap) ? cap : 1];
  }
  const walkPath = (e, dt) => {
    if (!e.path || e.pi >= e.path.length) return true;
    const p = e.path[e.pi], dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
    if (d <= Math.max(e.pi === e.path.length - 1 ? (e.dest && e.dest.hide ? 4 : e.dest && e.dest.kind === "stall" ? 4.5 : 2.5) : 1.2, e.speed * dt)) { e.x = p.x; e.z = p.z; e.pi++; e.stuck = 0; e.mv = true; return e.pi >= e.path.length; }
    const [ux, uz, cap] = d > 3 ? steer(e, dx / d, dz / d) : [dx / d, dz / d, 1];
    // ease toward the allowed speed (no instant stop/start), and count as waiting when nearly stopped
    e.cur = (e.cur ?? e.speed) + (e.speed * cap - (e.cur ?? e.speed)) * Math.min(1, dt * (cap < 1 ? 6 : 2.5));
    if (!Number.isFinite(e.cur)) e.cur = e.speed;
    e.spd = e.cur; e.waiting = e.waiting ? e.cur < e.speed * 0.3 : e.cur < e.speed * 0.1; e.waitT = e.waiting ? (e.waitT ?? 0) + dt : 0;   // hysteresis: no flicker
    if (e.waiting) { e.hx = ux; e.hz = uz; return false; }   // standing in line, still facing the way they're going
    const v = e.cur * dt; e.x += ux * v; e.z += uz * v; e.mv = true; e.hx = ux; e.hz = uz; e.face = Math.atan2(ux, uz); return false;
  };
  const stepToward = (e, tx, tz, speed, dt, stop = 0.6) => { const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz); if (d <= stop) return true; const v = Math.min(d, speed * dt); e.x += (dx / d) * v; e.z += (dz / d) * v; e.face = Math.atan2(dx, dz); e.hx = dx / d; e.hz = dz / d; e.spd = dt > 0 ? v / dt : speed; e.mv = true; return false; };
  const planDrive = (e) => { const here = nearestNode(e.x, e.z, VEH_NODES); let to, tries = 0; do { to = pick(VEH_NODES); } while ((to === here || VDIST[here][to] < 120) && ++tries < 50); const pts = [nodePt(CENTER_LINE, here)]; let n = here, g = 0; while (n !== to && g++ < 90) { n = VNEXT[n][to]; if (n < 0) break; pts.push(nodePt(CENTER_LINE, n)); } e.path = keepRight(pts, pts.map(() => streetLane(e))); e.pi = 0; };
  const BRAINS = {
    idle() {},
    citizen(e, dt) {
      if (e.hidden) { e.timer -= dt; if (e.timer <= 0) { e.hidden = false; const pl = e.place; goNext(e);
        // step out of the door already in this walker's keep-right lane (not all from the door's centre point)
        const ap = pl.approach, p0 = e.path?.[0], shift = ap && ap.length > 1 && p0 ? { x: p0.x - ap[ap.length - 2].x, z: p0.z - ap[ap.length - 2].z } : { x: 0, z: 0 };
        at(e, pl.x + shift.x, pl.z + shift.z); } return; }
      if (e.pause > 0) { e.pause -= dt; if (e.pause <= 0) goNext(e); return; }
      if (walkPath(e, dt)) arrive(e); },
    drive(e, dt) { if (e.pause > 0) { e.pause -= dt; return; } if (!e.path || e.pi >= e.path.length) planDrive(e);
      if (walkPath(e, dt)) { if (chance(0.3)) e.pause = rnd(1, 4); e.path = null; }
      if (e.trail) { const L = e.trail[e.trail.length - 1]; if (!L || Math.hypot(e.x - L.x, e.z - L.z) > 0.8) { e.trail.push({ x: e.x, z: e.z }); if (e.trail.length > 80) e.trail.shift(); } } },
    follow(e, dt) { const tr = e.leader.trail, tp = tr[Math.max(0, tr.length - 1 - e.k * 5)] ?? e.leader; const far = Math.hypot(tp.x - e.x, tp.z - e.z) > 8; stepToward(e, tp.x, tp.z, e.leader.speed * (far ? 1.6 : 1.15), dt); },
    pet(e, dt) { const o = e.owner; let tx, tz; if (!o.hidden) { tx = o.x - Math.sin(o.yaw) * 4; tz = o.z - Math.cos(o.yaw) * 4; e.waitX = o.x + 3; e.waitZ = o.z; } else { tx = e.waitX; tz = e.waitZ; }
      const d = Math.hypot(tx - e.x, tz - e.z); e.activity = o.hidden ? `waiting outside for ${o.name}` : `trotting after ${o.name}`; stepToward(e, tx, tz, d > 15 ? 30 : Math.max(o.speed * 1.2, 8), dt, 1.2); },
    cat(e, dt) { if (e.pause > 0) { e.pause -= dt; e.activity = "washing a paw"; return; } e.activity = "prowling";
      if (!e.path || e.pi >= e.path.length) { let x, z, tries = 0; do { x = e.x + rnd(-30, 30); z = e.z + rnd(-30, 30); } while ((x < CITY.x0 + 4 || x > CITY.x1 - 4 || z < CITY.z0 + 4 || z > CITY.z1 - 4 || onStatue(x, z, 4)) && ++tries < 10); e.path = [{ x, z }]; e.pi = 0; }
      if (walkPath(e, dt)) e.pause = rnd(3, 14); },
    field(e, dt) { if (e.pause > 0) { e.pause -= dt; return; } if (!e.path || e.pi >= e.path.length) { e.path = [fieldPt(e)]; e.pi = 0; } if (walkPath(e, dt) && chance(e.pauseChance ?? 0.4)) e.pause = rnd(1, 5); },
    yard(e, dt) { if (e.pause > 0) { e.pause -= dt; return; } if (!e.path || e.pi >= e.path.length) { const y = e.yard; e.path = [{ x: rnd(y.x, y.x + y.w), z: rnd(y.z, y.z + y.d) }]; e.pi = 0; } if (walkPath(e, dt) && chance(0.5)) e.pause = rnd(1, 6); },
    pace(e, dt) { if (e.pause > 0) { e.pause -= dt; return; } if (e.pt === undefined) e.pt = rnd(e.a0, e.a1); if (e.ax === "z" ? stepToward(e, e.fixed, e.pt, e.speed, dt) : stepToward(e, e.pt, e.fixed, e.speed, dt)) { e.pt = rnd(e.a0, e.a1); e.pause = rnd(1, 6); } },
    bank(e, dt) { if (e.pause > 0) { e.pause -= dt; return; } if (e.bt === undefined) e.bt = Math.max(30, Math.min(WX - 30, e.x + rnd(-150, 150))); const dx = e.bt - e.x; if (Math.abs(dx) < 1) { e.bt = undefined; e.pause = rnd(1, 6); return; }
      e.x += Math.sign(dx) * Math.min(e.speed * dt, Math.abs(dx)); e.z = bankZ(e.x) + e.off; e.face = dx > 0 ? Math.PI / 2 : -Math.PI / 2; e.mv = true; },
  };

  // collisions: foot circles push apart (standing / heavy things barely move), walkers sidestep right; props are solid
  const CELL = 8, grid = new Map(), OCELL = 24, ogrid = new Map();
  for (const o of W.obstacles) { const k = Math.floor(o.x / OCELL) * 4096 + Math.floor(o.z / OCELL); (ogrid.get(k) ?? ogrid.set(k, []).get(k)).push(o); }
  const movable = (e) => (e.pause > 0 && e.w8 === 1 ? 0.3 : e.w8);
  const sidestep = (e, sx, sz, amt) => { if (!e.path || e.pi >= e.path.length) return; const p = e.path[e.pi]; let hx = p.x - e.x, hz = p.z - e.z; const hl = Math.hypot(hx, hz); if (hl < 0.01) return; hx /= hl; hz /= hl; if (hx * sx + hz * sz > 0.25) { e.x += -hz * amt; e.z += hx * amt; } };
  function collide() {
    grid.clear();
    for (let i = 0; i < ents.length; i++) { const e = ents[i]; if (e.hidden || e.nocol) continue; const k = Math.floor(e.x / CELL) * 4096 + Math.floor(e.z / CELL); (grid.get(k) ?? grid.set(k, []).get(k)).push(i); }
    for (let i = 0; i < ents.length; i++) { const a = ents[i]; if (a.hidden || a.nocol) continue; const gx = Math.floor(a.x / CELL), gz = Math.floor(a.z / CELL);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) { const cell = grid.get((gx + ox) * 4096 + gz + oz); if (!cell) continue;
        for (const j of cell) { if (j <= i) continue; const b = ents[j]; let dx = b.x - a.x, dz = b.z - a.z; const minD = a.cr + b.cr, d2 = dx * dx + dz * dz; if (d2 >= minD * minD) continue;
          let d = Math.sqrt(d2); if (d < 0.01) { const t = rand() * 6.28; dx = Math.cos(t); dz = Math.sin(t); d = 1; }
          const nx = dx / d, nz = dz / d, ov = (minD - d) * 0.5, wa = movable(a), wb = movable(b), s = wa + wb || 1, fa = wa / s, fb = wb / s;
          a.x -= nx * ov * fa; a.z -= nz * ov * fa; b.x += nx * ov * fb; b.z += nz * ov * fb;
          if (a.mv) sidestep(a, nx, nz, ov * 1.4 * fa); if (b.mv) sidestep(b, -nx, -nz, ov * 1.4 * fb); } }
      const ogx = Math.floor(a.x / OCELL), ogz = Math.floor(a.z / OCELL);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) { const cell = ogrid.get((ogx + ox) * 4096 + ogz + oz); if (!cell) continue;
        for (const o of cell) { const dx = a.x - o.x, dz = a.z - o.z, minD = o.r + a.cr, d = Math.hypot(dx, dz); if (d >= minD || d < 0.01) continue; const push = minD - d; a.x += (dx / d) * push; a.z += (dz / d) * push; if (a.mv) sidestep(a, -dx / d, -dz / d, push * 0.8); } } }
  }
  /** Does the straight flight a→b pass through the statue (pigeons fly low, well under its 95-voxel height)? */
  const crossesStatue = (ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((STATUE.x - ax) * dx + (STATUE.z - az) * dz) / L)); return Math.hypot(ax + dx * t - STATUE.x, az + dz * t - STATUE.z) < 31; };
  const anyoneNear = (x, z, r) => { const gx = Math.floor(x / CELL), gz = Math.floor(z / CELL); for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) { const cell = grid.get((gx + ox) * 4096 + gz + oz); if (cell) for (const j of cell) { const e = ents[j]; if (e.kind !== "cat" && Math.hypot(e.x - x, e.z - z) < r) return true; } } return false; };

  let T = 0, congT = 0;
  function step(dt) {
    T += dt;
    for (const e of ents) { e.ox = e.x; e.oz = e.z; e.mv = false; BRAINS[e.brain](e, dt); }
    collide();
    // congestion sampling (every step) → smoothed per-edge / per-junction slowed-walker counts once a second
    for (const e of ents) { if (e.hidden || !e.path || e.kind !== "person" || e.brain !== "citizen") continue;
      if (!(e.waiting || (e.spd ?? e.speed) < e.speed * 0.35)) continue; const el = streetElement(e.x, e.z); if (!el) continue;
      if (el.node !== undefined) CONG.nodeNow[el.node]++; else CONG.edgeNow[el.edge]++; }
    CONG.samples++; congT += dt;
    if (congT >= 1) { const k = 1 / CONG.samples;
      for (let i = 0; i < CONG.edge.length; i++) { CONG.edge[i] = CONG.edge[i] * 0.6 + CONG.edgeNow[i] * k * 0.4; CONG.edgeNow[i] = 0; }
      for (let i = 0; i < NN; i++) { CONG.node[i] = CONG.node[i] * 0.6 + CONG.nodeNow[i] * k * 0.4; CONG.nodeNow[i] = 0; }
      CONG.samples = 0; congT = 0; }
    for (const e of ents) {
      if (e.mv && e.path && !e.waiting) { if (Math.hypot(e.x - e.ox, e.z - e.oz) < (e.spd ?? e.speed) * dt * 0.3) { e.stuck += dt; if (e.stuck > 2.5) { e.stuck = 0; e.pi++; } } else e.stuck = Math.max(0, e.stuck - dt); }
      if (e.mv && e.face !== undefined) { let d = e.face - e.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); e.yaw += d * Math.min(1, dt * 10); }
    }
    for (const g of pigeons) {
      if (g.state === "ground") { g.timer -= dt; g.y = 0;
        if (anyoneNear(g.x, g.z, 4) || (g.timer < 0 && chance(0.002))) { let s, tries = 0; do { s = pigeonSpot(); } while ((Math.hypot(s.x - g.x, s.z - g.z) > 140 || crossesStatue(g.x, g.z, s.x, s.z)) && ++tries < 16);
          if (crossesStatue(g.x, g.z, s.x, s.z)) { const a = Math.atan2(g.z - STATUE.z, g.x - STATUE.x) + rnd(-0.5, 0.5), r = Math.max(36, Math.hypot(g.x - STATUE.x, g.z - STATUE.z) + rnd(4, 14)); s = { x: STATUE.x + Math.cos(a) * r, z: STATUE.z + Math.sin(a) * r }; }   // never fly through the statue
          Object.assign(g, { state: "fly", hx: undefined, fx: g.x, fz: g.z, tx: s.x, tz: s.z, ft: 0, fd: Math.max(0.8, Math.hypot(s.x - g.x, s.z - g.z) / 30) }); g.yaw = Math.atan2(s.x - g.x, s.z - g.z); }
        else { if (g.timer < 0) { g.timer = rnd(1, 4); g.hx = g.x + rnd(-5, 5); g.hz = g.z + rnd(-5, 5); if (onStatue(g.hx, g.hz, 6)) g.hx = undefined; } if (g.hx !== undefined) { const dx = g.hx - g.x, dz = g.hz - g.z, d = Math.hypot(dx, dz); if (d > 0.3) { g.x += (dx / d) * Math.min(d, 4 * dt); g.z += (dz / d) * Math.min(d, 4 * dt); g.yaw = Math.atan2(dx, dz); } else g.hx = undefined; } } }
      if (g.state === "fly") { g.ft += dt / g.fd; const k = Math.min(1, g.ft); g.x = g.fx + (g.tx - g.fx) * k; g.z = g.fz + (g.tz - g.fz) * k; g.y = Math.sin(Math.PI * k) * Math.min(30, 8 + g.fd * 6); if (k >= 1) { g.state = "ground"; g.timer = rnd(2, 6); } }
    }
    for (const b of boats) { b.x += b.vx * dt; if (b.x < -500) b.x = WX + 500; if (b.x > WX + 500) b.x = -500; b.z = RIVER.zc(b.x) + b.lane; b.yaw = b.vx > 0 ? 0 : Math.PI; }
    for (const d of ducks) { const lx = (((d.x0 + d.dir * d.sp * T) % (WX + 600)) + (WX + 600)) % (WX + 600) - 300; d.x = lx - d.dir * d.k * 3.5; d.z = RIVER.zc(d.x) + d.lane + Math.sin(T * 1.3 + d.k) * 0.6; d.yaw = d.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  }
  const stats = () => { let out = 0, inside = 0; for (const e of ents) if (e.kind === "person") { if (e.hidden) inside++; else out++; } return { outside: out, inside, vehicles: ents.filter((e) => e.kind === "vehicle").length, actors: ents.length + pigeons.length + boats.length + ducks.length }; };
  return { ents, pigeons, boats, ducks, step, stats, get time() { return T; } };
}
