// World layout (1 unit = 1 voxel; x = east, z = south, y = up) and the static scenery placement.
// Everything here is deterministic from the seed so screenshots are reproducible.
import * as THREE from "three";
import { rampRemap } from "../models/recipes/colors.js";

let seed = 20261017;
export const setSeed = (s) => { seed = s | 0; };
export function rand() { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export const rnd = (a, b) => a + rand() * (b - a), rndi = (a, b) => Math.floor(rnd(a, b + 1)), pick = (a) => a[Math.floor(rand() * a.length)], chance = (p) => rand() < p;

// ---- street grid: COLS × ROWS blocks separated by STREET-wide streets; nodes are intersections (c, r)
export const STREET = 22, BW = 84, BH = 76, COLS = 6, ROWS = 4;
export const X0 = 70, Z0 = 130;
export const CW = COLS * BW + (COLS + 1) * STREET, CD = ROWS * BH + (ROWS + 1) * STREET;
export const WX = X0 * 2 + CW, WZ = Z0 + CD + 120;
export const SX = [...Array(COLS + 1)].map((_, c) => X0 + c * (BW + STREET) + STREET / 2);
export const SZ = [...Array(ROWS + 1)].map((_, r) => Z0 + r * (BH + STREET) + STREET / 2);
export const block = (c, r) => ({ x: X0 + STREET + c * (BW + STREET), z: Z0 + STREET + r * (BH + STREET), w: BW, d: BH });
export const FORT = { ...block(2, 0), w: BW * 2 + STREET };
export const PLAZA = { ...block(2, 2), w: BW * 2 + STREET };
export const CENTER = { x: PLAZA.x + PLAZA.w / 2, z: PLAZA.z + PLAZA.d / 2 };
export const PAGODA_BLOCK = [0, 1];
export const isSpecialBlock = (c, r) => ((r === 0 || r === 2) && (c === 2 || c === 3)) || (c === PAGODA_BLOCK[0] && r === PAGODA_BLOCK[1]);
export const inRect = (x, z, R) => x >= R.x && x <= R.x + R.w && z >= R.z && z <= R.z + R.d;
export const CITY = { x0: X0, z0: Z0, x1: X0 + CW, z1: Z0 + CD };
// river north of the city, paddies south of it
export const RIVER = { zc: (x) => 66 + 6 * Math.sin(x / 90) + 3 * Math.sin(x / 31), hw: 13 };
export const GATE_X = SX[3], WALL_S = CITY.z1 + 4;
export const PADDIES = [{ x: 30, z: WALL_S + 22, w: GATE_X - 70, d: 70 }, { x: GATE_X + 40, z: WALL_S + 22, w: WX - GATE_X - 70, d: 70 }];

export function isStreet(x, z) {
  if (x < CITY.x0 || x > CITY.x1 || z < CITY.z0 || z > CITY.z1) return false;
  if (inRect(x, z, PLAZA)) return true;
  if (inRect(x, z, FORT)) return false;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (inRect(x, z, block(c, r))) return false;
  return true;
}

// ---- palettes for building variants
export const ROOFS = ["#3a9ab0", "#2f7fc8", "#3aa060", "#d8683a", "#c8463a", "#6a7fa0", "#2aa890", "#7a5ac0"];
export const WALLS = ["#f6e8c8", "#fbf2dc", "#f0dcb4", "#eae4d4"];
export const PILLARS = ["#d0402e", "#b8302a", "#e0502e"];
export const CLOTHS = ["#e04a3a", "#3a6ad8", "#3aa060", "#f0b830", "#8a4ab0"];
export function variantRemap(o = {}) { return Object.assign({}, o.roof && rampRemap("roof", o.roof), o.wall && rampRemap("wall", o.wall), o.pillar && rampRemap("pillar", o.pillar), o.cloth && rampRemap("cloth", o.cloth)); }

/**
 * Places all static scenery. Returns {statics, houses, stalls, obstacles, pagoda, fort, ...} where statics are
 * {model, remap, x, y, z, rot} instances (rot in quarter turns) and houses carry door data for the sim.
 */
export function layout() {
  const statics = [], houses = [], obstacles = [], stalls = [];
  const put = (model, x, z, rot = 0, o = {}) => { const s = { model, x, y: o.y ?? 0, z, rot, remap: o.remap ?? null, key: model + (o.remapKey ?? "") }; statics.push(s); return s; };
  const ob = (x, z, r) => obstacles.push({ x, z, r });
  const tree = (x, z) => put(pick(["tree_round", "tree_round", "tree_fruit", "tree_blossom", "tree_pine", "bamboo"]), x, z, rndi(0, 3));

  // houses: two per row, south row faces the street to the south, north row faces north
  const TYPES = ["home1", "home1", "home2", "home2", "shop", "shop", "inn"];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (isSpecialBlock(c, r)) continue;
    const b = block(c, r);
    for (const south of [true, false]) for (const hx of [b.x + 21, b.x + 63]) {
      const type = pick(TYPES), roof = pick(ROOFS), wall = pick(WALLS), pillar = pick(PILLARS), cloth = pick(CLOTHS);
      const x = hx + rndi(-1, 1), z = south ? b.z + b.d - 13 : b.z + 13;
      put(type, x, z, south ? 0 : 2, { remap: variantRemap({ roof, wall, pillar, cloth }), remapKey: `|${roof}|${wall}|${pillar}|${cloth}` });
      houses.push({ type, x, z, south, c, r, doorX: x, outZ: south ? b.z + b.d + 3 : b.z - 3, inZ: south ? z + 7 : z - 7, roofY: type === "home2" || type === "inn" ? 29 : 23 });
    }
    tree(b.x + 42, b.z + b.d - 10); tree(b.x + 42, b.z + 10);
    for (let i = 0; i < 3; i++) tree(b.x + rnd(10, 74), b.z + rnd(32, 44));
    if (chance(0.5)) put(pick(["well", "haystack", "crates", "jars"]), b.x + rnd(14, 70), b.z + 38, rndi(0, 3));
  }
  // pagoda garden
  const pb = block(...PAGODA_BLOCK), pagoda = { x: pb.x + pb.w / 2, z: pb.z + pb.d / 2 + 2 };
  put("pagoda", pagoda.x, pagoda.z, 0);
  pagoda.outZ = pb.z + pb.d + 3; pagoda.inZ = pagoda.z + 8;
  for (const [dx, dz] of [[-34, -26], [34, -26], [-34, 24], [34, 24], [-30, 0], [30, 2]]) put(dz > 20 ? "tree_blossom" : pick(["tree_pine", "bamboo", "tree_round"]), pagoda.x + dx, pagoda.z + dz, rndi(0, 3));
  // fortress: gate tower facing the street to the south, drill yard + archery behind it
  const fort = { x: GATE_X, z: FORT.z + FORT.d - 22 };
  put("fort_gate", fort.x, fort.z, 0);
  fort.outZ = FORT.z + FORT.d + 3; fort.inZ = fort.z + 2;
  for (let i = 0; i < 4; i++) { put("target", FORT.x + FORT.w - 20, FORT.z + 10 + i * 9, 3); }
  put("haystack", FORT.x + 12, FORT.z + 10, 0); put("crates", FORT.x + 30, FORT.z + 8, 1); put("jars", FORT.x + FORT.w - 50, FORT.z + 8, 0);
  // plaza: pavilion, stalls in two rows, lantern posts
  put("pavilion", CENTER.x, CENTER.z, 0); ob(CENTER.x, CENTER.z, 17);
  for (const z of [PLAZA.z + 12, PLAZA.z + PLAZA.d - 12]) for (const x of [PLAZA.x + 24, PLAZA.x + 60, PLAZA.x + PLAZA.w - 60, PLAZA.x + PLAZA.w - 24]) {
    const north = z < CENTER.z, cloth = pick(CLOTHS), roof = pick(ROOFS);
    put("stall", x, z, north ? 0 : 2, { remap: variantRemap({ roof, cloth }), remapKey: `|${roof}|${cloth}` });
    ob(x - 4, z, 5); ob(x + 4, z, 5); stalls.push({ x, z, front: north ? 1 : -1 });
  }
  for (const [x, z] of [[PLAZA.x + 4, PLAZA.z + 4], [PLAZA.x + PLAZA.w - 4, PLAZA.z + 4], [PLAZA.x + 4, PLAZA.z + PLAZA.d - 4], [PLAZA.x + PLAZA.w - 4, PLAZA.z + PLAZA.d - 4], [CENTER.x - 34, CENTER.z], [CENTER.x + 34, CENTER.z]]) { put("lantern_post", x, z); ob(x, z, 2); }
  // street props (kept off the middle of the street)
  for (let i = 0; i < 26; i++) { const c = rndi(0, COLS), r = rndi(0, ROWS - 1), hz = chance(0.5);
    const x = hz ? SX[c] + rnd(20, BW) : SX[c] + pick([-8, 8]), z = hz ? SZ[r] + pick([-8, 8]) : SZ[r] + rnd(20, BH);
    if (!isStreet(x, z) || inRect(x, z, PLAZA)) continue; const m = pick(["lantern_post", "lantern_post", "jars", "crates", "haystack", "well"]); put(m, x, z, rndi(0, 3)); ob(x, z, m === "lantern_post" ? 2 : 5); }

  // city wall: segments 22 long, watchtowers at corners/intervals, gate in the south wall
  const walls = { segs: [] };
  const wallRun = (x0, x1, z, rot) => { for (let x = x0; x < x1; x += 22) { if (rot === 0 && z === WALL_S && Math.abs(x + 11 - GATE_X) < 34) continue; put("wall", x + 11, z, rot); } };
  wallRun(CITY.x0 - 8, CITY.x1 + 8, CITY.z0 - 4, 0); wallRun(CITY.x0 - 8, CITY.x1 + 8, WALL_S, 2);
  for (let z = CITY.z0 - 4; z < WALL_S; z += 22) { put("wall", CITY.x0 - 4, z + 11, 1); put("wall", CITY.x1 + 4, z + 11, 3); }
  put("city_gate", GATE_X, WALL_S + 6, 0);
  for (const [x, z] of [[CITY.x0 - 4, CITY.z0 - 4], [CITY.x1 + 4, CITY.z0 - 4], [CITY.x0 - 4, WALL_S], [CITY.x1 + 4, WALL_S], [SX[1], CITY.z0 - 4], [SX[5], CITY.z0 - 4], [SX[1], WALL_S], [SX[5], WALL_S], [CITY.x0 - 4, SZ[2]], [CITY.x1 + 4, SZ[2]]]) put("tower", x, z, 0);
  walls.runs = [[CITY.x0 + 20, GATE_X - 40, WALL_S], [GATE_X + 40, CITY.x1 - 20, WALL_S], [CITY.x0 + 20, CITY.x1 - 20, CITY.z0 - 4]]; // sentry beats on the wall tops

  // countryside: river mill, docks, trees, farm props
  const WHEEL = { x: 150, z: RIVER.zc(150) };
  put("home1", WHEEL.x + 34, RIVER.zc(WHEEL.x + 34) + RIVER.hw + 16, 2, { remap: variantRemap({ roof: "#6a7fa0" }), remapKey: "|mill" });
  const DOCKS = [330, 610];
  for (let i = 0; i < 150; i++) { const x = rnd(8, WX - 8), z = rnd(8, WZ - 8);
    if (x > CITY.x0 - 16 && x < CITY.x1 + 16 && z > CITY.z0 - 16 && z < WALL_S + 16) continue;
    if (Math.abs(z - RIVER.zc(x)) < RIVER.hw + 6 || z < 36) continue;
    if (PADDIES.some((p) => x > p.x - 4 && x < p.x + p.w + 4 && z > p.z - 4 && z < p.z + p.d + 4) || Math.abs(x - GATE_X) < 20 && z > WALL_S) continue;
    tree(x, z); }
  for (let i = 0; i < 8; i++) put("haystack", pick([rnd(20, GATE_X - 40), rnd(GATE_X + 40, WX - 20)]), WALL_S + rnd(12, 18), rndi(0, 3));
  return { statics, houses, obstacles, stalls, pagoda, fort, walls, WHEEL, DOCKS };
}

// ---- ground: one texel per voxel, painted like the 2D map
export function groundTexture() {
  const c = document.createElement("canvas"); c.width = WX; c.height = WZ; const g = c.getContext("2d");
  const F = (x, z, w, d, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(z), Math.round(w), Math.round(d)); };
  const GR = ["#6cc04c", "#62b446", "#74c852", "#68bc4a"];
  F(0, 0, WX, WZ, "#6cc04c");
  for (let i = 0; i < 9000; i++) F(rnd(0, WX), rnd(0, WZ), rndi(1, 3), rndi(1, 2), pick(GR.concat(["#4ea23a", "#90d866"])));
  for (let i = 0; i < 900; i++) F(rnd(0, WX), rnd(0, WZ), 1, 1, pick(["#ffffff", "#ffe050", "#ff80a0", "#a0c0ff"]));
  // paddies: water strips with bunds
  for (const p of PADDIES) { F(p.x - 2, p.z - 2, p.w + 4, p.d + 4, "#b89a62"); for (let z = p.z; z < p.z + p.d; z += 12) { F(p.x, z, p.w, 9, "#5fb0d8"); F(p.x, z, p.w, 1, "#3f8ab8"); for (let i = 0; i < p.w / 8; i++) F(p.x + rnd(0, p.w - 4), z + rnd(2, 8), rndi(2, 5), 1, "#a8e0ff"); } }
  // road from the south gate
  F(GATE_X - 9, WALL_S, 18, WZ - WALL_S, "#b49c70"); for (let z = WALL_S; z < WZ; z += 4) for (let x = GATE_X - 9 + ((z / 4) % 2 ? 3 : 0); x < GATE_X + 9; x += 6) F(x, z + 1, 5, 3, pick(["#e0cfa4", "#d8c69a", "#e6d7b0"]));
  // river with sandy banks
  for (let x = 0; x < WX; x++) { const zc = RIVER.zc(x), hw = RIVER.hw; F(x, zc - hw - 4, 1, 2 * hw + 8, "#e8d8a0"); F(x, zc - hw, 1, 2 * hw, "#3a8ac8"); F(x, zc - hw / 3, 1, hw * 0.66, "#2f78b8"); }
  for (let i = 0; i < 500; i++) { const x = rnd(0, WX); F(x, RIVER.zc(x) + rnd(-RIVER.hw + 2, RIVER.hw - 2), rndi(2, 5), 1, "#a8e0ff"); }
  // city floor: stone slabs, then blocks of garden, plaza, fortress courtyard
  F(CITY.x0, CITY.z0, CW, CD, "#b49c70");
  for (let z = CITY.z0; z < CITY.z1; z += 4) for (let x = CITY.x0 + ((z / 4) % 2 ? 3 : 0); x < CITY.x1; x += 6) F(x, z, 5, 3, pick(["#e0cfa4", "#e0cfa4", "#d8c69a", "#e6d7b0"]));
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) { if ((r === 0 || r === 2) && (c === 2 || c === 3)) continue; const b = block(c, r);
    F(b.x - 2, b.z - 2, b.w + 4, b.d + 4, "#d0ccc0"); F(b.x, b.z, b.w, b.d, "#6cc04c");
    for (let i = 0; i < 260; i++) F(b.x + rnd(0, b.w - 2), b.z + rnd(0, b.d - 1), rndi(1, 2), 1, pick(GR.concat(["#4ea23a", "#90d866", "#ffffff", "#ffe050"])));
    F(b.x + 8, b.z + 34, b.w - 16, 8, "#c8945a"); for (let x = b.x + 9; x < b.x + b.w - 9; x += 3) F(x, b.z + 35 + (x % 2), 1, 6, "#3aa848"); }
  F(PLAZA.x - 2, PLAZA.z - 2, PLAZA.w + 4, PLAZA.d + 4, "#c2ac80");
  for (let z = PLAZA.z; z < PLAZA.z + PLAZA.d; z += 6) for (let x = PLAZA.x + ((z / 6) % 2 ? 4 : 0); x < PLAZA.x + PLAZA.w; x += 8) F(x, z, 7, 5, pick(["#ecdcb4", "#ecdcb4", "#e6d4a8", "#f4e8c8"]));
  for (const [r, col] of [[22, "#d0503a"], [34, "#c2ac80"], [46, "#d0503a"]]) for (let a = 0; a < Math.PI * 2; a += 0.6 / r) F(CENTER.x + Math.cos(a) * r, CENTER.z + Math.sin(a) * r, 1.5, 1.5, col);
  F(FORT.x, FORT.z, FORT.w, FORT.d, "#8e8474"); for (let z = FORT.z; z < FORT.z + FORT.d; z += 3) for (let x = FORT.x + ((z / 3) % 2 ? 3 : 0); x < FORT.x + FORT.w; x += 6) F(x, z, 5, 2, pick(["#c0b6a2", "#c0b6a2", "#dcd4c2"]));
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** Voxel mountains beyond the river: a heightmap meshed as columns (top + exposed sides). */
export function mountainGeometry() {
  const D = 46, x0 = -60, x1 = WX + 60, H = (x, z) => {
    const ridge = 30 + 22 * Math.sin(x / 47) + 14 * Math.sin(x / 19 + 1.3) + 9 * Math.sin(x / 7.3);
    const fall = Math.max(0, (z + 30) / (D + 30)); return Math.max(1, Math.round(ridge * (1 - fall * fall) + 6 * Math.sin(x / 11 + z / 5)));
  };
  const pos = [], col = [], ind = [], nor = [];
  const colorAt = (h, top, x) => new THREE.Color(h > 46 + 4 * Math.sin(x / 5) ? (top ? "#f4f8ff" : "#c8d6ea") : h > 30 ? (top ? "#8aa0b0" : "#6a8090") : h > 12 ? (top ? "#4f9a5a" : "#3a7a46") : top ? "#6cc04c" : "#4e9a3a");
  const quad = (a, b, c2, d, n, color) => { const i = pos.length / 3; pos.push(...a, ...b, ...c2, ...d); for (let k = 0; k < 4; k++) { nor.push(...n); col.push(color.r, color.g, color.b); } ind.push(i, i + 1, i + 2, i, i + 2, i + 3); };
  for (let x = x0; x < x1; x++) for (let z = -40; z < D; z++) {
    const h = H(x, z), c = colorAt(h, true, x), s = colorAt(h, false, x);
    quad([x, h, z], [x, h, z + 1], [x + 1, h, z + 1], [x + 1, h, z], [0, 1, 0], c);
    const hs = H(x, z + 1); if (hs < h) quad([x, hs, z + 1], [x + 1, hs, z + 1], [x + 1, h, z + 1], [x, h, z + 1], [0, 0, 1], s.clone().multiplyScalar(0.92));
    const he = H(x + 1, z); if (he < h) quad([x + 1, he, z], [x + 1, h, z], [x + 1, h, z + 1], [x + 1, he, z + 1], [1, 0, 0], s);
    const hw = H(x - 1, z); if (hw < h) quad([x, hw, z], [x, hw, z + 1], [x, h, z + 1], [x, h, z], [-1, 0, 0], s.clone().multiplyScalar(0.85));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(ind);
  return g;
}
