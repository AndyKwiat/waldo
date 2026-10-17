// World layout (1 unit = 1 voxel; x = east, z = south, y = up) and the static scenery placement.
// Everything here is deterministic from the seed so screenshots are reproducible.
import * as THREE from "three";
import { rampRemap } from "../models/recipes/colors.js";

let seed = 20261017;
export const setSeed = (s) => { seed = s | 0; };
export function rand() { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export const rnd = (a, b) => a + rand() * (b - a), rndi = (a, b) => Math.floor(rnd(a, b + 1)), pick = (a) => a[Math.floor(rand() * a.length)], chance = (p) => rand() < p;

// ---- street grid: COLS × ROWS blocks separated by STREET-wide streets; nodes are intersections (c, r)
export const STREET = 22, BW = 106, BH = 76, COLS = 6, ROWS = 5;
export const X0 = 380, Z0 = 280;                       // city origin; everything outside is countryside
export const CW = COLS * BW + (COLS + 1) * STREET, CD = ROWS * BH + (ROWS + 1) * STREET;
export const WX = X0 * 2 + CW, WZ = Z0 + CD + 430;
export const SX = [...Array(COLS + 1)].map((_, c) => X0 + c * (BW + STREET) + STREET / 2);
export const SZ = [...Array(ROWS + 1)].map((_, r) => Z0 + r * (BH + STREET) + STREET / 2);
export const block = (c, r) => ({ x: X0 + STREET + c * (BW + STREET), z: Z0 + STREET + r * (BH + STREET), w: BW, d: BH });
export const FORT = { ...block(2, 0), w: BW * 2 + STREET };
export const PLAZA = { ...block(2, 2), w: BW * 2 + STREET };
export const CENTER = { x: PLAZA.x + PLAZA.w / 2, z: PLAZA.z + PLAZA.d / 2 };
export const PAGODA_BLOCK = [0, 1];
export const isSpecialBlock = (c, r) => ((r === 0 || r === 2) && (c === 2 || c === 3)) || (c === PAGODA_BLOCK[0] && r === PAGODA_BLOCK[1]);
export const inRect = (x, z, R, m = 0) => x >= R.x - m && x <= R.x + R.w + m && z >= R.z - m && z <= R.z + R.d + m;
export const CITY = { x0: X0, z0: Z0, x1: X0 + CW, z1: Z0 + CD };
export const CITY_R = { x: X0 - 30, z: Z0 - 30, w: CW + 60, d: CD + 60 };  // city incl. walls + towers
export const GATE_X = SX[3];
// walls: 24 tall, 9 deep, just outside the outer street ring; walkway centres (where sentries walk):
export const WALL = { h: 24, n: CITY.z0 - 5, s: CITY.z1 + 5, w: CITY.x0 - 5, e: CITY.x1 + 5 };
export const WALL_S = WALL.s;
// river north of the city (runs off both edges of the world), paddies + roads + farms + hamlets outside
export const RIVER = { zc: (x) => 158 + 10 * Math.sin(x / 120) + 5 * Math.sin(x / 37), hw: 15 };
export const ROADS = [{ x: GATE_X - 9, z: CITY.z1, w: 18, d: 4000 }, { x: -4000, z: CITY.z1 + 205, w: 8000, d: 14 }];
export const PADDIES = [{ x: GATE_X - 340, z: CITY.z1 + 34, w: 310, d: 150 }, { x: GATE_X + 30, z: CITY.z1 + 34, w: 310, d: 150 }];
export const FIELDS = [
  { x: 60, z: CITY.z0 + 10, w: 120, d: 90, crop: "cabbage" }, { x: 210, z: CITY.z0 + 40, w: 110, d: 120, crop: "wheat" }, { x: 70, z: CITY.z0 + 330, w: 150, d: 100, crop: "wheat" },
  { x: CITY.x1 + 70, z: CITY.z0 + 20, w: 130, d: 100, crop: "wheat" }, { x: CITY.x1 + 230, z: CITY.z0 + 170, w: 120, d: 110, crop: "cabbage" }, { x: CITY.x1 + 80, z: CITY.z0 + 380, w: 140, d: 90, crop: "cabbage" },
  { x: GATE_X - 330, z: CITY.z1 + 240, w: 170, d: 90, crop: "wheat" }, { x: GATE_X + 120, z: CITY.z1 + 245, w: 190, d: 80, crop: "cabbage" },
];
export const HAMLETS = [{ x: 150, z: CITY.z0 + 230 }, { x: CITY.x1 + 210, z: CITY.z0 + 60 }, { x: GATE_X - 470, z: CITY.z1 + 320 }, { x: CITY.x1 + 190, z: CITY.z1 + 300 }];

export function isStreet(x, z) {
  if (x < CITY.x0 || x > CITY.x1 || z < CITY.z0 || z > CITY.z1) return false;
  if (inRect(x, z, PLAZA)) return true;
  if (inRect(x, z, FORT)) return false;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (inRect(x, z, block(c, r))) return false;
  return true;
}
/** True where countryside features (city, river, roads, paddies, fields, hamlets) leave no room for hills/forest. */
export function occupied(x, z, m = 0) {
  if (inRect(x, z, CITY_R, m)) return true;
  if (Math.abs(z - RIVER.zc(x)) < RIVER.hw + 10 + m) return true;
  return ROADS.some((r) => inRect(x, z, r, m + 2)) || PADDIES.some((p) => inRect(x, z, p, m + 3)) || FIELDS.some((f) => inRect(x, z, f, m + 3)) || HAMLETS.some((h) => Math.hypot(x - h.x, z - h.z) < 62 + m);
}

// ---- rolling hills in the countryside (heights in whole voxels; 0 everywhere in the city)
const BUMPS = [];
function placeBumps() {
  for (let tries = 0; BUMPS.length < 30 && tries < 6000; tries++) {
    const r = rnd(28, 70), h = rnd(9, 22), x = rnd(-60, WX + 60), z = rnd(RIVER.zc(0) + 30, WZ + 60);
    if (occupied(x, z, r * 1.25)) continue; BUMPS.push({ x, z, r, h });
  }
}
export function groundH(x, z) {
  let h = 0; for (const b of BUMPS) { const d2 = ((x - b.x) ** 2 + (z - b.z) ** 2) / (b.r * b.r); if (d2 < 4) h += b.h * Math.exp(-d2 * 1.6); }
  if (h < 0.6 || occupied(x, z, 1)) return 0;   // hills never spill onto roads, fields, the river or the city
  return Math.round(h);
}

// ---- palettes for building variants
export const ROOFS = ["#3a9ab0", "#2f7fc8", "#3aa060", "#d8683a", "#c8463a", "#6a7fa0", "#2aa890", "#7a5ac0"];
export const WALLS = ["#f6e8c8", "#fbf2dc", "#f0dcb4", "#eae4d4"];
export const PILLARS = ["#d0402e", "#b8302a", "#e0502e"];
export const CLOTHS = ["#e04a3a", "#3a6ad8", "#3aa060", "#f0b830", "#8a4ab0"];
export function variantRemap(o = {}) { return Object.assign({}, o.roof && rampRemap("roof", o.roof), o.wall && rampRemap("wall", o.wall), o.pillar && rampRemap("pillar", o.pillar), o.cloth && rampRemap("cloth", o.cloth)); }

/**
 * Places all static scenery. Returns {statics, houses, stalls, obstacles, crops, ...}: statics are
 * {model, remap, x, y, z, rot} instances (rot in quarter turns); houses carry door data for the sim.
 */
export function layout() {
  placeBumps();
  const statics = [], houses = [], obstacles = [], stalls = [], crops = [], towers = [];
  const put = (model, x, z, rot = 0, o = {}) => { const s = { model, x, y: o.y ?? groundH(x, z), z, rot, remap: o.remap ?? null, key: model + (o.remapKey ?? "") }; statics.push(s); return s; };
  const ob = (x, z, r) => obstacles.push({ x, z, r });
  const TREES = ["tree_round", "tree_round", "tree_fruit", "tree_blossom", "tree_pine", "bamboo"];
  const tree = (x, z, kinds = TREES) => put(pick(kinds), x, z, rndi(0, 3));
  const houseVariant = (type) => { const roof = pick(ROOFS), wall = pick(WALLS), pillar = pick(PILLARS), cloth = pick(CLOTHS); return { remap: variantRemap({ roof, wall, pillar, cloth }), remapKey: `|${roof}|${wall}|${pillar}|${cloth}` }; };

  // city houses: three per row; the south row faces the street to the south, the north row faces north
  const TYPES = ["home1", "home1", "home2", "home2", "shop", "shop", "inn"];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (isSpecialBlock(c, r)) continue;
    const b = block(c, r);
    for (const south of [true, false]) for (const hx of [b.x + 18, b.x + 53, b.x + 88]) {
      const type = pick(TYPES), x = hx, z = south ? b.z + b.d - 13 : b.z + 13;
      put(type, x, z, south ? 0 : 2, houseVariant(type));
      houses.push({ type, x, z, south, c, r, doorX: x, outZ: south ? b.z + b.d + 3 : b.z - 3, inZ: south ? z + 7 : z - 7, roofY: type === "home2" || type === "inn" ? 29 : 23 });
    }
    for (let i = 0; i < 4; i++) tree(b.x + rnd(10, b.w - 10), b.z + rnd(32, 44));
    if (chance(0.6)) put(pick(["well", "haystack", "crates", "jars"]), b.x + rnd(14, b.w - 14), b.z + 38, rndi(0, 3));
  }
  // pagoda garden
  const pb = block(...PAGODA_BLOCK), pagoda = { x: pb.x + pb.w / 2, z: pb.z + pb.d / 2 + 2 };
  put("pagoda", pagoda.x, pagoda.z, 0); pagoda.outZ = pb.z + pb.d + 3; pagoda.inZ = pagoda.z + 8;
  for (const [dx, dz] of [[-40, -26], [40, -26], [-42, 24], [42, 24], [-36, 0], [36, 2], [-46, -6], [46, 8]]) tree(pagoda.x + dx, pagoda.z + dz, dz > 20 ? ["tree_blossom"] : ["tree_pine", "bamboo", "tree_round"]);
  // fortress: gate tower facing the street to the south; drill yard + archery behind it
  const fort = { x: GATE_X, z: FORT.z + FORT.d - 22 };
  put("fort_gate", fort.x, fort.z, 0); fort.outZ = FORT.z + FORT.d + 3; fort.inZ = fort.z + 2;
  for (let i = 0; i < 4; i++) put("target", FORT.x + FORT.w - 20, FORT.z + 10 + i * 9, 3);
  put("haystack", FORT.x + 12, FORT.z + 10, 0); put("crates", FORT.x + 30, FORT.z + 8, 1); put("jars", FORT.x + FORT.w - 50, FORT.z + 8, 0);
  // plaza: pavilion, stalls in two rows, lantern posts
  put("pavilion", CENTER.x, CENTER.z, 0); ob(CENTER.x, CENTER.z, 17);
  for (const z of [PLAZA.z + 12, PLAZA.z + PLAZA.d - 12]) for (const x of [PLAZA.x + 24, PLAZA.x + 66, PLAZA.x + PLAZA.w - 66, PLAZA.x + PLAZA.w - 24]) {
    const north = z < CENTER.z, cloth = pick(CLOTHS), roof = pick(ROOFS);
    put("stall", x, z, north ? 0 : 2, { remap: variantRemap({ roof, cloth }), remapKey: `|${roof}|${cloth}` });
    ob(x - 4, z, 5); ob(x + 4, z, 5); stalls.push({ x, z, front: north ? 1 : -1 });
  }
  for (const [x, z] of [[PLAZA.x + 4, PLAZA.z + 4], [PLAZA.x + PLAZA.w - 4, PLAZA.z + 4], [PLAZA.x + 4, PLAZA.z + PLAZA.d - 4], [PLAZA.x + PLAZA.w - 4, PLAZA.z + PLAZA.d - 4], [CENTER.x - 36, CENTER.z], [CENTER.x + 36, CENTER.z]]) { put("lantern_post", x, z); ob(x, z, 2); }
  for (let i = 0; i < 34; i++) { const c = rndi(0, COLS), r = rndi(0, ROWS - 1), hz = chance(0.5);
    const x = hz ? SX[c] + rnd(20, BW) : SX[c] + pick([-8, 8]), z = hz ? SZ[r] + pick([-8, 8]) : SZ[r] + rnd(20, BH);
    if (!isStreet(x, z) || inRect(x, z, PLAZA)) continue; const m = pick(["lantern_post", "lantern_post", "jars", "crates", "haystack", "well"]); put(m, x, z, rndi(0, 3)); ob(x, z, m === "lantern_post" ? 2 : 5); }

  // city walls (24 tall): 22-long segments, towers at corners and midpoints pushed outward, gate in the south wall
  for (let x = CITY.x0 - 9; x < CITY.x1 + 9; x += 22) { put("wall", x + 11, CITY.z0 - 1, 0, { y: 0 }); if (Math.abs(x + 11 - GATE_X) >= 26) put("wall", x + 11, CITY.z1 + 1, 2, { y: 0 }); }
  for (let z = CITY.z0 - 9; z < CITY.z1 + 9; z += 22) { put("wall", CITY.x0 - 1, z + 11, 1, { y: 0 }); put("wall", CITY.x1 + 1, z + 11, 3, { y: 0 }); }
  put("city_gate", GATE_X, CITY.z1 + 5, 0, { y: 0 });
  const zm = (CITY.z0 + CITY.z1) / 2;
  for (const [x, z] of [[CITY.x0 - 14, CITY.z0 - 14], [CITY.x1 + 14, CITY.z0 - 14], [CITY.x0 - 14, CITY.z1 + 14], [CITY.x1 + 14, CITY.z1 + 14],
    [SX[1], CITY.z0 - 14], [SX[5], CITY.z0 - 14], [SX[1], CITY.z1 + 14], [SX[5], CITY.z1 + 14], [CITY.x0 - 14, zm], [CITY.x1 + 14, zm]]) { put("tower", x, z, 0, { y: 0 }); towers.push({ x, z }); }
  const beats = [ // sentry walking ranges on the wall walkways, between towers
    ...[[CITY.x0 + 2, SX[1] - 18], [SX[1] + 18, SX[5] - 18], [SX[5] + 18, CITY.x1 - 2]].map(([a0, a1]) => ({ ax: "x", a0, a1, fixed: WALL.n })),
    ...[[CITY.x0 + 2, SX[1] - 18], [SX[1] + 18, GATE_X - 30], [GATE_X + 30, SX[5] - 18], [SX[5] + 18, CITY.x1 - 2]].map(([a0, a1]) => ({ ax: "x", a0, a1, fixed: WALL.s })),
    ...[[CITY.z0 + 2, zm - 18], [zm + 18, CITY.z1 - 2]].flatMap(([a0, a1]) => [{ ax: "z", a0, a1, fixed: WALL.w }, { ax: "z", a0, a1, fixed: WALL.e }]),
  ];

  // countryside: hamlets of farmhouses facing a little square, crop fields, forests, scattered trees, mill + docks
  for (const H of HAMLETS) {
    for (const [dx, dz, rot] of [[-34, -26, 0], [26, -30, 0], [-30, 30, 2], [32, 28, 2]]) put(chance(0.7) ? "home1" : "home2", H.x + dx, H.z + dz, rot, houseVariant("home"));
    put("well", H.x, H.z, 0); ob(H.x, H.z, 5); put("haystack", H.x + 52, H.z - 6, 0); put("haystack", H.x - 54, H.z + 4, 1); put("crates", H.x + 10, H.z + 12, 0);
    for (let i = 0; i < 6; i++) { const a = rnd(0, 6.28); tree(H.x + Math.cos(a) * rnd(64, 80), H.z + Math.sin(a) * rnd(64, 80), ["tree_fruit", "tree_round", "bamboo"]); }
  }
  for (const f of FIELDS) { const wheat = f.crop === "wheat";
    for (let z = f.z + 3; z < f.z + f.d - 2; z += wheat ? 3 : 5) for (let x = f.x + 3; x < f.x + f.w - 2; x += wheat ? 2 : 4) crops.push({ x: x + rnd(-0.4, 0.4), z, kind: f.crop }); }
  for (let k = 0; k < 26; k++) { // forests, preferably on hills
    const b = k < 18 && BUMPS[k] ? BUMPS[k] : null, cx = b ? b.x : rnd(0, WX), cz = b ? b.z : rnd(RIVER.zc(0) + 40, WZ), R = b ? b.r * 1.1 : rnd(30, 60);
    for (let i = 0; i < R * 0.9; i++) { const a = rnd(0, 6.28), d = Math.sqrt(rand()) * R, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (!occupied(x, z, 2) && x > -80 && x < WX + 80) tree(x, z, ["tree_pine", "tree_pine", "tree_round", "tree_round", "bamboo"]); }
  }
  for (let i = 0; i < 520; i++) { const x = rnd(-80, WX + 80), z = rnd(RIVER.zc(0) - 40, WZ + 60); if (occupied(x, z, 3) && !(Math.abs(z - RIVER.zc(x)) > RIVER.hw + 6 && Math.abs(z - RIVER.zc(x)) < RIVER.hw + 30 && !inRect(x, z, CITY_R, 4))) continue; tree(x, z); }
  for (let i = 0; i < 14; i++) { const p = pick(PADDIES); put("haystack", rnd(p.x, p.x + p.w), p.z - 12, rndi(0, 3)); }
  const WHEEL = { x: CITY.x0 - 120, z: RIVER.zc(CITY.x0 - 120) };
  put("home1", WHEEL.x + 36, RIVER.zc(WHEEL.x + 36) + RIVER.hw + 18, 2, { y: 0, remap: variantRemap({ roof: "#6a7fa0" }), remapKey: "|mill" });
  const DOCKS = [CITY.x0 + 140, CITY.x1 - 160];
  return { statics, houses, obstacles, stalls, crops, towers, beats, pagoda, fort, WHEEL, DOCKS, bumps: BUMPS };
}

// ---- ground: one texel per voxel, painted like the 2D map
export function groundTexture() {
  const c = document.createElement("canvas"); c.width = WX; c.height = WZ; const g = c.getContext("2d");
  const F = (x, z, w, d, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(z), Math.round(w), Math.round(d)); };
  const GR = ["#6cc04c", "#62b446", "#74c852", "#68bc4a"];
  F(0, 0, WX, WZ, "#6cc04c");
  for (let i = 0; i < 9000; i++) F(rnd(0, WX), rnd(0, WZ), rndi(8, 40), rndi(6, 30), pick(["#68bc4a", "#70c450", "#64b848"]));
  for (let i = 0; i < 40000; i++) F(rnd(0, WX), rnd(0, WZ), rndi(1, 3), rndi(1, 2), pick(GR.concat(["#4ea23a", "#90d866"])));
  for (let i = 0; i < 4000; i++) F(rnd(0, WX), rnd(0, WZ), 1, 1, pick(["#ffffff", "#ffe050", "#ff80a0", "#a0c0ff"]));
  for (const p of PADDIES) { F(p.x - 2, p.z - 2, p.w + 4, p.d + 4, "#b89a62"); for (let z = p.z; z < p.z + p.d; z += 12) { F(p.x, z, p.w, 9, "#5fb0d8"); F(p.x, z, p.w, 1, "#3f8ab8"); for (let i = 0; i < p.w / 8; i++) F(p.x + rnd(0, p.w - 4), z + rnd(2, 8), rndi(2, 5), 1, "#a8e0ff"); } }
  for (const f of FIELDS) { F(f.x - 2, f.z - 2, f.w + 4, f.d + 4, "#9a7040"); F(f.x, f.z, f.w, f.d, "#b8844a"); for (let z = f.z + 1; z < f.z + f.d; z += f.crop === "wheat" ? 3 : 5) F(f.x, z, f.w, 1, "#9a6a38"); }
  for (const H of HAMLETS) { g.fillStyle = "#c8a878"; g.beginPath(); g.arc(H.x, H.z, 22, 0, 6.3); g.fill(); }
  for (const r of ROADS) { const x0 = Math.max(0, r.x), z0 = Math.max(0, r.z), x1 = Math.min(WX, r.x + r.w), z1 = Math.min(WZ, r.z + r.d); F(x0, z0, x1 - x0, z1 - z0, "#c8a878");
    for (let i = 0; i < (x1 - x0) * (z1 - z0) / 30; i++) F(rnd(x0, x1), rnd(z0, z1), rndi(1, 3), 1, pick(["#b89868", "#d8bc8c", "#a88858"])); }
  for (let z = CITY.z1; z < WZ; z += 4) for (let x = GATE_X - 9 + ((z / 4) % 2 ? 3 : 0); x < GATE_X + 9; x += 6) F(x, z + 1, 5, 3, pick(["#e0cfa4", "#d8c69a", "#e6d7b0"]));
  for (let x = 0; x < WX; x++) { const zc = RIVER.zc(x), hw = RIVER.hw; F(x, zc - hw - 5, 1, 2 * hw + 10, "#e8d8a0"); F(x, zc - hw, 1, 2 * hw, "#3a8ac8"); F(x, zc - hw / 3, 1, hw * 0.66, "#2f78b8"); }
  for (let i = 0; i < 1600; i++) { const x = rnd(0, WX); F(x, RIVER.zc(x) + rnd(-RIVER.hw + 2, RIVER.hw - 2), rndi(2, 5), 1, "#a8e0ff"); }
  for (const dx of [CITY.x0 + 140, CITY.x1 - 160]) { const zc = RIVER.zc(dx); F(dx - 5, zc - 2, 10, RIVER.hw + 8, "#8a5a32"); for (let z = zc - 1; z < zc + RIVER.hw + 6; z += 2) F(dx - 5, z, 10, 1, "#b07a44"); }
  // city floor: stone slabs, then blocks of garden, plaza, fortress courtyard
  F(CITY.x0, CITY.z0, CW, CD, "#b49c70");
  for (let z = CITY.z0; z < CITY.z1; z += 4) for (let x = CITY.x0 + ((z / 4) % 2 ? 3 : 0); x < CITY.x1; x += 6) F(x, z, 5, 3, pick(["#e0cfa4", "#e0cfa4", "#d8c69a", "#e6d7b0"]));
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) { if ((r === 0 || r === 2) && (c === 2 || c === 3)) continue; const b = block(c, r);
    F(b.x - 2, b.z - 2, b.w + 4, b.d + 4, "#d0ccc0"); F(b.x, b.z, b.w, b.d, "#6cc04c");
    for (let i = 0; i < 320; i++) F(b.x + rnd(0, b.w - 2), b.z + rnd(0, b.d - 1), rndi(1, 2), 1, pick(GR.concat(["#4ea23a", "#90d866", "#ffffff", "#ffe050"])));
    F(b.x + 8, b.z + 34, b.w - 16, 8, "#c8945a"); for (let x = b.x + 9; x < b.x + b.w - 9; x += 3) F(x, b.z + 35 + (x % 2), 1, 6, "#3aa848"); }
  F(PLAZA.x - 2, PLAZA.z - 2, PLAZA.w + 4, PLAZA.d + 4, "#c2ac80");
  for (let z = PLAZA.z; z < PLAZA.z + PLAZA.d; z += 6) for (let x = PLAZA.x + ((z / 6) % 2 ? 4 : 0); x < PLAZA.x + PLAZA.w; x += 8) F(x, z, 7, 5, pick(["#ecdcb4", "#ecdcb4", "#e6d4a8", "#f4e8c8"]));
  for (const [r, col] of [[22, "#d0503a"], [34, "#c2ac80"], [46, "#d0503a"]]) for (let a = 0; a < Math.PI * 2; a += 0.6 / r) F(CENTER.x + Math.cos(a) * r, CENTER.z + Math.sin(a) * r, 1.5, 1.5, col);
  F(FORT.x, FORT.z, FORT.w, FORT.d, "#8e8474"); for (let z = FORT.z; z < FORT.z + FORT.d; z += 3) for (let x = FORT.x + ((z / 3) % 2 ? 3 : 0); x < FORT.x + FORT.w; x += 6) F(x, z, 5, 2, pick(["#c0b6a2", "#c0b6a2", "#dcd4c2"]));
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** Column mesher for heightmaps: top quads + exposed side quads, vertex colors from colorAt(h, isTop, x, z). Cell size `s`. */
function heightfield(x0, x1, z0, z1, s, H, colorAt) {
  const pos = [], col = [], ind = [], nor = [];
  const quad = (a, b, c2, d, n, color) => { const i = pos.length / 3; pos.push(...a, ...b, ...c2, ...d); for (let k = 0; k < 4; k++) { nor.push(...n); col.push(color.r, color.g, color.b); } ind.push(i, i + 1, i + 2, i, i + 2, i + 3); };
  const C = new THREE.Color();
  for (let x = x0; x < x1; x += s) for (let z = z0; z < z1; z += s) {
    const h = H(x, z); if (h <= 0) continue;
    quad([x, h, z], [x, h, z + s], [x + s, h, z + s], [x + s, h, z], [0, 1, 0], colorAt(h, true, x, z, C));
    const hs = H(x, z + s); if (hs < h) quad([x, hs, z + s], [x + s, hs, z + s], [x + s, h, z + s], [x, h, z + s], [0, 0, 1], colorAt(h, false, x, z, C).multiplyScalar(0.92));
    const hn = H(x, z - s); if (hn < h) quad([x, hn, z], [x, h, z], [x + s, h, z], [x + s, hn, z], [0, 0, -1], colorAt(h, false, x, z, C).multiplyScalar(0.8));
    const he = H(x + s, z); if (he < h) quad([x + s, he, z], [x + s, h, z], [x + s, h, z + s], [x + s, he, z + s], [1, 0, 0], colorAt(h, false, x, z, C));
    const hw = H(x - s, z); if (hw < h) quad([x, hw, z], [x, hw, z + s], [x, h, z + s], [x, h, z], [-1, 0, 0], colorAt(h, false, x, z, C).multiplyScalar(0.85));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(ind);
  return g;
}
const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

/** Voxel mountains beyond the river (2-voxel columns), reaching far past both edges of the world. */
export function mountainGeometry() {
  const ridgeZ = 30, H = (x, z) => {
    const ridge = 34 + 24 * Math.sin(x / 61) + 15 * Math.sin(x / 23 + 1.3) + 9 * Math.sin(x / 9.3);
    const fall = Math.max(0, (z - ridgeZ + 60) / 150); return Math.max(0, Math.round(ridge * (1 - fall * fall) + 5 * Math.sin(x / 13 + z / 6)));
  };
  return heightfield(-900, WX + 900, -120, RIVER.zc(0) - RIVER.hw - 14, 2, (x, z) => (z > RIVER.zc(x) - RIVER.hw - 12 ? 0 : H(x, z)), (h, top, x, z, C) =>
    C.set(h > 50 + 4 * Math.sin(x / 5) ? (top ? "#f4f8ff" : "#c8d6ea") : h > 34 ? (top ? "#8aa0b0" : "#6a8090") : h > 14 ? (top ? (hash(x, z) > 0.5 ? "#4f9a5a" : "#478f52") : "#3a7a46") : top ? (hash(x, z) > 0.5 ? "#6cc04c" : "#62b446") : "#4e9a3a"));
}
/** Rolling hills from groundH, meshed at 1 voxel so trees and people sit right on them. */
export function hillGeometry(bumps) {
  if (!bumps.length) return new THREE.BufferGeometry();
  const x0 = Math.floor(Math.min(...bumps.map((b) => b.x - 2 * b.r))), x1 = Math.ceil(Math.max(...bumps.map((b) => b.x + 2 * b.r)));
  const z0 = Math.floor(Math.min(...bumps.map((b) => b.z - 2 * b.r))), z1 = Math.ceil(Math.max(...bumps.map((b) => b.z + 2 * b.r)));
  return heightfield(x0, x1, z0, z1, 1, groundH, (h, top, x, z, C) => {
    const n = hash(x, z); if (!top) return C.set(h % 3 === 0 ? "#8a6a42" : "#5a9a3a");
    return C.set(n > 0.92 ? "#90d866" : n > 0.6 ? "#6cc04c" : n > 0.3 ? "#62b446" : "#5aac40").multiplyScalar(0.9 + Math.min(h, 16) * 0.012);
  });
}
