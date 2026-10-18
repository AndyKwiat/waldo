// World layout (1 unit = 1 voxel; x = east, z = south, y = up) and the static scenery placement.
// Everything here is deterministic from the seed so screenshots are reproducible.
import * as THREE from "three";
import { rampRemap } from "../models/recipes/colors.js";

let seed = 20261017;
export const setSeed = (s) => { seed = s | 0; };
export function rand() { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export const rnd = (a, b) => a + rand() * (b - a), rndi = (a, b) => Math.floor(rnd(a, b + 1)), pick = (a) => a[Math.floor(rand() * a.length)], chance = (p) => rand() < p;

// ---- street network. A COLS × ROWS grid of blocks with irregular column widths / row depths. Each street segment
// between two intersections is a full "street", a narrow winding "alley" (pedestrians only), a "garden" (closed off —
// makes T-junctions), or "none" (inside the palace / under the plaza statue). The palace, the market square, the
// main north–south avenue, the city ring and a few cross avenues stay a clean grid.
export const STREET = 22, COLS = 8, ROWS = 8;
const lr = (() => { let s = 777; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })(); // fixed layout rng
const AV_C = 4, PAL_C = [3, 4], PAL_R = [0, 1], PLAZA_R = 4, PAGODA_BLOCK = [1, 3];
export const COLW = [...Array(COLS)].map((_, c) => (PAL_C.includes(c) ? 122 : 96 + Math.round(lr() * 22)));
export const ROWH = [...Array(ROWS)].map((_, r) => (PAL_R.includes(r) ? 86 : r === PLAZA_R ? 80 : 70 + Math.round(lr() * 14)));
export const X0 = 380, Z0 = 280;                       // city origin; everything outside is countryside
export const CW = COLW.reduce((a, b) => a + b, 0) + (COLS + 1) * STREET, CD = ROWH.reduce((a, b) => a + b, 0) + (ROWS + 1) * STREET;
export const WX = X0 * 2 + CW, WZ = Z0 + CD + 430;
export const SX = [X0 + STREET / 2]; for (let c = 0; c < COLS; c++) SX.push(SX[c] + COLW[c] + STREET);
export const SZ = [Z0 + STREET / 2]; for (let r = 0; r < ROWS; r++) SZ.push(SZ[r] + ROWH[r] + STREET);
export const block = (c, r) => ({ x: SX[c] + STREET / 2, z: SZ[r] + STREET / 2, w: COLW[c], d: ROWH[r] });
export const PALACE = { x: block(3, 0).x, z: block(3, 0).z, w: COLW[3] + STREET + COLW[4], d: ROWH[0] + STREET + ROWH[1] };
export const FORT = PALACE;
export const PLAZA = { ...block(3, PLAZA_R), w: COLW[3] + STREET + COLW[4] };
export const CENTER = { x: PLAZA.x + PLAZA.w / 2, z: PLAZA.z + PLAZA.d / 2 };
// the colossal marble Jupiter in the middle of the market square (model "statue", 104³ grid, front faces south):
// stepped pedestal footprint ±hx × ±hz around the centre, h = top of the thunderbolt
export const STATUE = { x: CENTER.x, z: CENTER.z, hx: 23, hz: 20, h: 95 };
export const onStatue = (x, z, m = 0) => Math.abs(x - STATUE.x) <= STATUE.hx + m && Math.abs(z - STATUE.z) <= STATUE.hz + m;
export { PAGODA_BLOCK, PLAZA_R, AV_C };
export const isSpecialBlock = (c, r) => (PAL_C.includes(c) && PAL_R.includes(r)) || (PAL_C.includes(c) && r === PLAZA_R) || (c === PAGODA_BLOCK[0] && r === PAGODA_BLOCK[1]);
export const inRect = (x, z, R, m = 0) => x >= R.x - m && x <= R.x + R.w + m && z >= R.z - m && z <= R.z + R.d + m;
export const CITY = { x0: X0, z0: Z0, x1: X0 + CW, z1: Z0 + CD };
export const CITY_R = { x: X0 - 30, z: Z0 - 30, w: CW + 60, d: CD + 60 };  // city incl. walls + towers
export const GATE_X = SX[AV_C];
// palace courtyard between the great hall and the gate (drill, archery, barracks)
export const YARD = { x: PALACE.x + 18, z: PALACE.z + 104, w: PALACE.w - 36, d: 46 };

// HSEG[r][c]: segment (c,r)–(c+1,r); VSEG[c][r]: segment (c,r)–(c,r+1)
export const HSEG = [...Array(ROWS + 1)].map(() => Array(COLS).fill("street"));
export const VSEG = [...Array(COLS + 1)].map(() => Array(ROWS).fill("street"));
HSEG[1][3] = HSEG[1][4] = VSEG[4][0] = VSEG[4][1] = "none";   // inside the palace
VSEG[4][PLAZA_R] = "none";                                     // the plaza's centre (the statue)
const MAIN_ROWS = new Set([0, 2, PLAZA_R, PLAZA_R + 1, ROWS]), MAIN_COLS = new Set([0, AV_C, COLS]);
const touchesSpecial = (cells) => cells.some(([c, r]) => c >= 0 && r >= 0 && c < COLS && r < ROWS && isSpecialBlock(c, r));
for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (HSEG[r][c] === "street" && !MAIN_ROWS.has(r) && !touchesSpecial([[c, r - 1], [c, r]]) && lr() < 0.38) HSEG[r][c] = "alley";
for (let c = 1; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (VSEG[c][r] === "street" && !MAIN_COLS.has(c) && !touchesSpecial([[c - 1, r], [c, r]]) && lr() < 0.32) VSEG[c][r] = "garden";
// winding centre line of an alley (stays inside its 22-wide strip)
const ALLEY_PH = HSEG.map((row, r) => row.map((_, c) => lr() * 6.28));
export function alleyZ(r, c, x) { const a = SX[c] + STREET / 2, b = SX[c + 1] - STREET / 2, t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return SZ[r] + 4.2 * Math.sin(Math.PI * t) * Math.sin(ALLEY_PH[r][c] + x / 13) + 1.5 * Math.sin(Math.PI * t) * Math.sin(x / 5.3); }
/** Every walkable edge for the simulation: {a:[c,r], b:[c,r], type, pts?} (alleys carry their winding points a→b). */
export const EDGE_LIST = [];
for (let r = 0; r <= ROWS; r++) for (let c = 0; c < COLS; c++) { const t = HSEG[r][c]; if (t !== "street" && t !== "alley") continue;
  const e = { a: [c, r], b: [c + 1, r], type: t }; if (t === "alley") { e.pts = []; for (let x = SX[c] + STREET / 2 + 4; x < SX[c + 1] - STREET / 2 - 2; x += 7) e.pts.push({ x, z: alleyZ(r, c, x) }); } EDGE_LIST.push(e); }
for (let c = 0; c <= COLS; c++) for (let r = 0; r < ROWS; r++) if (VSEG[c][r] === "street") EDGE_LIST.push({ a: [c, r], b: [c, r + 1], type: "street" });

/** Where a point falls in the city fabric: "street" | "alley" | "garden" | "plaza" | "block" | null (outside). */
export function cellAt(x, z) {
  if (x < CITY.x0 || x > CITY.x1 || z < CITY.z0 || z > CITY.z1) return null;
  if (inRect(x, z, PLAZA)) return "plaza";
  if (inRect(x, z, PALACE)) return "palace";
  let c = 0; while (c < COLS && x > SX[c + 1] - STREET / 2) c++;   // column band index (block c spans SX[c]+11 .. SX[c+1]-11)
  let r = 0; while (r < ROWS && z > SZ[r + 1] - STREET / 2) r++;
  const inColStreet = Math.abs(x - SX[c]) <= STREET / 2 || (c < COLS && Math.abs(x - SX[c + 1]) <= STREET / 2);
  const ci = Math.abs(x - SX[c]) <= STREET / 2 ? c : c + 1;          // nearest vertical street line index
  const inRowStreet = Math.abs(z - SZ[r]) <= STREET / 2 || (r < ROWS && Math.abs(z - SZ[r + 1]) <= STREET / 2);
  const ri = Math.abs(z - SZ[r]) <= STREET / 2 ? r : r + 1;
  if (inColStreet && inRowStreet) { // intersection square: street if any street touches it
    const touching = [HSEG[ri]?.[ci - 1], HSEG[ri]?.[ci], VSEG[ci]?.[ri - 1], VSEG[ci]?.[ri]];
    return touching.includes("street") ? "street" : touching.includes("alley") ? "alley" : "garden"; }
  if (inRowStreet) { const t = HSEG[ri][Math.min(c, COLS - 1)]; return t === "street" ? "street" : t === "alley" ? "alley" : "garden"; }
  if (inColStreet) { const t = VSEG[ci][Math.min(r, ROWS - 1)]; return t === "street" ? "street" : "garden"; }
  return "block";
}
export const isStreet = (x, z) => { const k = cellAt(x, z); return k === "street" || k === "plaza"; };

// walls: 24 tall, 9 deep, just outside the outer street ring; walkway centres (where sentries walk):
export const WALL = { h: 24, n: CITY.z0 - 5, s: CITY.z1 + 5, w: CITY.x0 - 5, e: CITY.x1 + 5 };
export const WALL_S = WALL.s;
// river north of the city (runs off both edges of the world), paddies + roads + farms + hamlets outside
export const RIVER = { zc: (x) => 158 + 10 * Math.sin(x / 120) + 5 * Math.sin(x / 37), hw: 15 };
export const ROADS = [{ x: GATE_X - 9, z: CITY.z1, w: 18, d: 4000 }, { x: -4000, z: CITY.z1 + 205, w: 8000, d: 14 }];
export const PADDIES = [{ x: GATE_X - 340, z: CITY.z1 + 34, w: 310, d: 150 }, { x: GATE_X + 30, z: CITY.z1 + 34, w: 310, d: 150 }];
export const FIELDS = [
  { x: 60, z: CITY.z0 + 10, w: 120, d: 90, crop: "cabbage" }, { x: 210, z: CITY.z0 + 40, w: 110, d: 120, crop: "wheat" }, { x: 70, z: CITY.z0 + 330, w: 150, d: 100, crop: "wheat" }, { x: 90, z: CITY.z0 + 560, w: 160, d: 110, crop: "cabbage" },
  { x: CITY.x1 + 70, z: CITY.z0 + 20, w: 130, d: 100, crop: "wheat" }, { x: CITY.x1 + 230, z: CITY.z0 + 170, w: 120, d: 110, crop: "cabbage" }, { x: CITY.x1 + 80, z: CITY.z0 + 380, w: 140, d: 90, crop: "cabbage" }, { x: CITY.x1 + 210, z: CITY.z0 + 600, w: 130, d: 100, crop: "wheat" },
  { x: GATE_X - 330, z: CITY.z1 + 240, w: 170, d: 90, crop: "wheat" }, { x: GATE_X + 120, z: CITY.z1 + 245, w: 190, d: 80, crop: "cabbage" },
];
export const HAMLETS = [{ x: 150, z: CITY.z0 + 230 }, { x: CITY.x1 + 210, z: CITY.z0 + 60 }, { x: GATE_X - 470, z: CITY.z1 + 320 }, { x: CITY.x1 + 190, z: CITY.z1 + 300 }, { x: 170, z: CITY.z0 + 760 }, { x: CITY.x1 + 230, z: CITY.z0 + 450 }];

/** True where countryside features (city, river, roads, paddies, fields, hamlets) leave no room for hills/forest. */
export function occupied(x, z, m = 0) {
  if (onStatue(x, z, m)) return true;
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
let STRIP_DOORS = {};
/** Bigger building types mixed into the outer rows: footprint offsets from the model centre (see FOOT in layout) + roof height. */
export const BIG_FOOT = { hall_house: { l: 25, r: 25, back: 18, roofY: 36 }, compound: { l: 30, r: 30, back: 19, roofY: 21 } };
export function layout() {
  placeBumps();
  const statics = [], houses = [], obstacles = [], stalls = [], crops = [], towers = [];
  const put = (model, x, z, rot = 0, o = {}) => { const s = { model, x, y: o.y ?? groundH(x, z), z, rot, remap: o.remap ?? null, key: model + (o.remapKey ?? "") }; statics.push(s); return s; };
  const ob = (x, z, r) => obstacles.push({ x, z, r });
  const TREES = ["tree_round", "tree_round", "tree_fruit", "tree_blossom", "tree_pine", "bamboo"];
  const tree = (x, z, kinds = TREES) => put(pick(kinds), x, z, rndi(0, 3));
  const houseVariant = (type) => { const roof = pick(ROOFS), wall = pick(WALLS), pillar = pick(PILLARS), cloth = pick(CLOTHS); return { remap: variantRemap({ roof, wall, pillar, cloth }), remapKey: `|${roof}|${wall}|${pillar}|${cloth}` }; };

  // ---- city blocks: 2–3 buildings per row (homes, shops, inns, manors); the south row faces south, the north row north
  const TYPES = ["home1", "home1", "home2", "home2", "shop", "shop", "inn", "manor", "manor"];
  const stripDoors = (STRIP_DOORS = {});      // "r:c" → door x's facing that street/alley strip (keep alley gardens clear)
  // Away from the centre the rows loosen up ("organic" factor f: 0 near the plaza/palace/avenue → 1 in the outer
  // districts). Rows are filled with a random mix of building types (incl. the big ones) and the spare width is split
  // unevenly, so neighbours across a street are offset by up to ~half a house; each house also gets its own setback,
  // so street fronts are jagged. Houses stay square to the street; doors follow each house.
  // Footprints as offsets from the model centre: l/r = half-widths, back = depth behind the centre (front edge ≈ +13).
  const FOOT = { home1: { l: 17, r: 17, back: 12 }, home2: { l: 16, r: 16, back: 12 }, shop: { l: 17, r: 17, back: 12 }, inn: { l: 16, r: 20, back: 12 }, manor: { l: 17, r: 17, back: 14 }, ...BIG_FOOT };
  const BIG = Object.keys(BIG_FOOT);
  const organicAt = (x, z) => { const d = Math.hypot(x - CENTER.x, z - CENTER.z), t = Math.min(1, Math.max(0, (d - 230) / 260)); return t * t * (3 - 2 * t); };
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (isSpecialBlock(c, r)) continue;
    const b = block(c, r), f = organicAt(b.x + b.w / 2, b.z + b.d / 2), rects = [];
    for (const south of [true, false]) {
      // choose the row's buildings: the old even rows near the centre, a greedy random fill further out
      let types;
      if (f < 0.25) types = [...Array(b.w >= 104 ? 3 : 2)].map(() => pick(TYPES));
      else { types = []; let used = 0;
        for (let k = 0; k < 6; k++) { const t = BIG.length && chance(0.3 * f) ? pick(BIG) : pick(TYPES), w = FOOT[t].l + FOOT[t].r + 2;
          if (used + w > b.w - 6) { if (types.length) break; continue; } types.push(t); used += w; if (chance(0.25 * f) && types.length >= 1 && used > b.w * 0.55) break; } }   // sometimes stop early: a garden
      const widths = types.map((t) => FOOT[t].l + FOOT[t].r + 2), n = types.length;
      const slack = Math.max(0, b.w - 6 - widths.reduce((a, w) => a + w, 0)), wts = [...Array(n + 1)].map(() => 1 - f + f * rnd(0.05, 1.95)), sw = wts.reduce((a, w) => a + w, 0);
      let cursor = b.x + 3 + slack * wts[0] / sw, prevEnd = b.x;
      for (let i = 0; i < n; i++) {
        const type = types[i], F = FOOT[type], x = Math.round(cursor + 1 + F.l);
        // setback: as deep as the opposite row allows (houses whose backs overlap this one in x), up to 12
        const x0 = x - F.l, x1 = x + F.r, front = 13;
        const opp = rects.filter((q) => q.south !== south && q.x1 > x0 && q.x0 < x1);
        const backLimit = south ? Math.max(b.z, ...opp.map((q) => q.z1)) + 2 : Math.min(b.z + b.d, ...opp.map((q) => q.z0)) - 2;   // z the back may reach
        const zFront0 = south ? b.z + b.d - front : b.z + front;   // centre with zero setback
        const maxDz = Math.max(0, Math.min(12, south ? (zFront0 - F.back) - backLimit : backLimit - (zFront0 + F.back)));
        const dz = Math.round(rnd(0, maxDz) * f), z = south ? zFront0 - dz : zFront0 + dz, rr = south ? r + 1 : r;
        put(type, x, z, south ? 0 : 2, houseVariant(type));
        rects.push({ south, x0, x1, z0: south ? z - F.back : z - 13, z1: south ? z + 13 : z + F.back });
        (stripDoors[rr + ":" + c] ??= []).push(x);
        houses.push({ type, x, z, south, c, r, doorX: x, outZ: south ? b.z + b.d + 3 : b.z - 3, inZ: south ? z + 7 : z - 7, roofY: F.roofY ?? (type === "home2" || type === "inn" ? 29 : type === "manor" ? 17 : 23) });
        // a wide gap before this house becomes a little garden at the street front
        if (cursor - prevEnd > 14 && f > 0.3) for (let gx = prevEnd + 6; gx < cursor - 5; gx += rnd(7, 10)) tree(gx, south ? b.z + b.d - rnd(6, 14) : b.z + rnd(6, 14), ["tree_round", "tree_fruit", "tree_blossom", "bamboo"]);
        prevEnd = cursor + widths[i]; cursor = prevEnd + slack * wts[i + 1] / sw;
      }
      if (b.x + b.w - prevEnd > 14 && f > 0.3) for (let gx = prevEnd + 6; gx < b.x + b.w - 5; gx += rnd(7, 10)) tree(gx, south ? b.z + b.d - rnd(6, 14) : b.z + rnd(6, 14), ["tree_round", "tree_fruit", "tree_blossom", "bamboo"]);
    }
    // back-yard trees in the middle of the block, wherever no house reaches
    for (let i = 0; i < 4; i++) { const tx = b.x + rnd(8, b.w - 8), tz = b.z + b.d / 2 + rnd(-4, 4); if (!rects.some((q) => tx > q.x0 - 3 && tx < q.x1 + 3 && tz > q.z0 - 3 && tz < q.z1 + 3)) tree(tx, tz); }
    { const px = b.x + rnd(14, b.w - 14), pz = b.z + b.d / 2; if (chance(0.5) && !rects.some((q) => px > q.x0 - 5 && px < q.x1 + 5 && pz > q.z0 - 5 && pz < q.z1 + 5)) put(pick(["well", "haystack", "crates", "jars"]), px, pz, rndi(0, 3)); }
  }
  // closed side streets become gardens (T-junctions), often with a teahouse at one end facing the open street
  for (let c = 1; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (VSEG[c][r] !== "garden") continue;
    const b = block(c, r), x = SX[c], south = HSEG[r + 1][c - 1] !== "none" && chance(0.5) || !HSEG[r][c - 1] || HSEG[r][c - 1] === "none";
    if (chance(0.7)) {
      const z = south ? b.z + b.d - 11 : b.z + 11;
      put("teahouse", x, z, south ? 0 : 2, houseVariant("teahouse"));
      houses.push({ type: "teahouse", x, z, south, c, r, node: [c, south ? r + 1 : r], doorX: x, outZ: south ? b.z + b.d + 3 : b.z - 3, inZ: south ? z + 6 : z - 6, roofY: 37 });
      for (let zz = south ? b.z + 6 : b.z + 26; south ? zz < b.z + b.d - 26 : zz < b.z + b.d - 6; zz += 11) tree(x + rnd(-4, 4), zz, ["bamboo", "tree_blossom", "tree_pine", "tree_round"]);
    } else { for (let zz = b.z + 6; zz < b.z + b.d - 4; zz += 10) tree(x + rnd(-5, 5), zz, ["bamboo", "tree_blossom", "tree_round", "tree_fruit"]); put("well", x, b.z + b.d / 2, 0); }
  }
  // winding alleys: gardens and lanterns along both sides of the path, leaving the doorways clear
  for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (HSEG[r][c] !== "alley") continue;
    const doors = stripDoors[r + ":" + c] ?? [];
    for (let x = SX[c] + STREET / 2 + 5; x < SX[c + 1] - STREET / 2 - 5; x += rnd(7, 11)) {
      if (doors.some((d) => Math.abs(d - x) < 8)) continue;
      const side = chance(0.5) ? 1 : -1, z = alleyZ(r, c, x) + side * rnd(6.5, 8.5);
      if (chance(0.15)) { put("lantern_post", x, z); continue; }
      if (chance(0.75)) tree(x, z, ["bamboo", "bamboo", "tree_blossom", "tree_round", "tree_fruit"]);
    }
  }
  // pagoda garden
  const pb = block(...PAGODA_BLOCK), pagoda = { x: pb.x + pb.w / 2, z: pb.z + pb.d / 2 + 2 };
  put("pagoda", pagoda.x, pagoda.z, 0); pagoda.outZ = pb.z + pb.d + 3; pagoda.inZ = pagoda.z + 8; pagoda.c = PAGODA_BLOCK[0]; pagoda.r = PAGODA_BLOCK[1] + 1;
  for (const [dx, dz] of [[-40, -26], [40, -26], [-42, 24], [42, 24], [-36, 0], [36, 2]]) tree(pagoda.x + dx, pagoda.z + dz, dz > 20 ? ["tree_blossom"] : ["tree_pine", "bamboo", "tree_round"]);
  // ---- the palace: red walls with gold caps, the old fortress gatehouse as its south gate, the great hall, side halls, a drill yard
  const P = PALACE, gold = { remap: variantRemap({ roof: "#e8b830" }), remapKey: "|gold" };
  const fort = { x: GATE_X, z: P.z + P.d - 16 };
  put("fort_gate", fort.x, fort.z, 0, { y: 0, ...gold }); fort.outZ = P.z + P.d + 3; fort.inZ = fort.z + 2;
  for (let x = P.x + 2; x < P.x + P.w - 12; x += 22) { put("palace_wall", x + 11, P.z + 2, 0, gold); if (Math.abs(x + 11 - GATE_X) > 62) put("palace_wall", x + 11, P.z + P.d - 3, 2, gold); }
  for (let z = P.z + 2; z < P.z + P.d - 12; z += 22) { put("palace_wall", P.x + 2, z + 11, 1, gold); put("palace_wall", P.x + P.w - 3, z + 11, 3, gold); }
  put("palace_hall", P.x + P.w / 2, P.z + 50, 0, gold);
  const sideHall = { remap: variantRemap({ roof: "#e8b830", wall: "#e8d0b8", pillar: "#c02a20" }), remapKey: "|palace" };
  for (const z of [P.z + 34, P.z + 74]) { put("home2", P.x + 26, z, 1, sideHall); put("home2", P.x + P.w - 26, z, 3, sideHall); }
  for (const [x, z] of [[P.x + 14, P.z + 14], [P.x + P.w - 14, P.z + 14], [P.x + 14, P.z + 100], [P.x + P.w - 14, P.z + 100]]) tree(x, z, ["tree_pine"]);
  for (let z = YARD.z + 4; z < P.z + P.d - 36; z += 14) for (const dx of [-14, 14]) { put("lantern_post", GATE_X + dx, z); ob(GATE_X + dx, z, 2); }
  for (let i = 0; i < 4; i++) put("target", YARD.x + YARD.w - 12, YARD.z + 8 + i * 9, 3);
  put("haystack", YARD.x + 8, YARD.z + 6, 0); put("crates", YARD.x + 24, YARD.z + 4, 1); put("jars", YARD.x + YARD.w - 40, YARD.z + 4, 0);
  // ---- market square: the giant statue of Jupiter in the middle, two rows of stalls, lantern posts
  put("statue", STATUE.x, STATUE.z, 0, { y: 0 });
  for (const dx of [-12, 0, 12]) for (const dz of [-9, 0, 9]) ob(STATUE.x + dx, STATUE.z + dz, 11);   // pedestal is solid: 3×3 circles cover its stepped, chamfered footprint
  for (const z of [PLAZA.z + 12, PLAZA.z + PLAZA.d - 12]) for (const x of [PLAZA.x + 24, PLAZA.x + 68, PLAZA.x + PLAZA.w - 68, PLAZA.x + PLAZA.w - 24]) {
    const north = z < CENTER.z, cloth = pick(CLOTHS), roof = pick(ROOFS);
    put("stall", x, z, north ? 0 : 2, { remap: variantRemap({ roof, cloth }), remapKey: `|${roof}|${cloth}` });
    ob(x - 4, z, 5); ob(x + 4, z, 5); stalls.push({ x, z, front: north ? 1 : -1 });
  }
  for (const [x, z] of [[PLAZA.x + 4, PLAZA.z + 4], [PLAZA.x + PLAZA.w - 4, PLAZA.z + 4], [PLAZA.x + 4, PLAZA.z + PLAZA.d - 4], [PLAZA.x + PLAZA.w - 4, PLAZA.z + PLAZA.d - 4], [CENTER.x - 36, CENTER.z], [CENTER.x + 36, CENTER.z]]) { put("lantern_post", x, z); ob(x, z, 2); }
  // street props along the kerbs of full streets
  for (let i = 0; i < 70; i++) { const e = pick(EDGE_LIST); if (e.type !== "street") continue; const t = rnd(0.25, 0.75), hz = e.a[1] === e.b[1];
    const x = (hz ? SX[e.a[0]] + (SX[e.b[0]] - SX[e.a[0]]) * t : SX[e.a[0]] + pick([-8, 8])), z = hz ? SZ[e.a[1]] + pick([-8, 8]) : SZ[e.a[1]] + (SZ[e.b[1]] - SZ[e.a[1]]) * t;
    if (cellAt(x, z) !== "street") continue; const m = pick(["lantern_post", "lantern_post", "jars", "crates", "haystack", "well"]); put(m, x, z, rndi(0, 3)); ob(x, z, m === "lantern_post" ? 2 : 5); }

  // ---- city walls (24 tall): 22-long segments, towers at corners and along the sides, gate in the south wall
  for (let x = CITY.x0 - 9; x < CITY.x1 + 9; x += 22) { put("wall", x + 11, CITY.z0 - 1, 0, { y: 0 }); if (Math.abs(x + 11 - GATE_X) >= 26) put("wall", x + 11, CITY.z1 + 1, 2, { y: 0 }); }
  for (let z = CITY.z0 - 9; z < CITY.z1 + 9; z += 22) { put("wall", CITY.x0 - 1, z + 11, 1, { y: 0 }); put("wall", CITY.x1 + 1, z + 11, 3, { y: 0 }); }
  put("city_gate", GATE_X, CITY.z1 + 5, 0, { y: 0 });
  const zA = SZ[3], zB = SZ[6], TX = [SX[2], SX[6]];
  for (const [x, z] of [[CITY.x0 - 14, CITY.z0 - 14], [CITY.x1 + 14, CITY.z0 - 14], [CITY.x0 - 14, CITY.z1 + 14], [CITY.x1 + 14, CITY.z1 + 14],
    [TX[0], CITY.z0 - 14], [TX[1], CITY.z0 - 14], [TX[0], CITY.z1 + 14], [TX[1], CITY.z1 + 14], [CITY.x0 - 14, zA], [CITY.x1 + 14, zA], [CITY.x0 - 14, zB], [CITY.x1 + 14, zB]]) { put("tower", x, z, 0, { y: 0 }); towers.push({ x, z }); }
  const beats = [ // sentry walking ranges on the wall walkways, between towers
    ...[[CITY.x0 + 2, TX[0] - 18], [TX[0] + 18, TX[1] - 18], [TX[1] + 18, CITY.x1 - 2]].map(([a0, a1]) => ({ ax: "x", a0, a1, fixed: WALL.n })),
    ...[[CITY.x0 + 2, TX[0] - 18], [TX[0] + 18, GATE_X - 30], [GATE_X + 30, TX[1] - 18], [TX[1] + 18, CITY.x1 - 2]].map(([a0, a1]) => ({ ax: "x", a0, a1, fixed: WALL.s })),
    ...[[CITY.z0 + 2, zA - 18], [zA + 18, zB - 18], [zB + 18, CITY.z1 - 2]].flatMap(([a0, a1]) => [{ ax: "z", a0, a1, fixed: WALL.w }, { ax: "z", a0, a1, fixed: WALL.e }]),
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
  // city floor: stone slabs on streets; garden strips (closed streets) and alleys with a winding paved path; blocks; plaza; palace
  F(CITY.x0, CITY.z0, CW, CD, "#b49c70");
  for (let z = CITY.z0; z < CITY.z1; z += 4) for (let x = CITY.x0 + ((z / 4) % 2 ? 3 : 0); x < CITY.x1; x += 6) {
    const k = cellAt(x + 2.5, z + 1.5);
    if (k === "street") F(x, z, 5, 3, pick(["#e0cfa4", "#e0cfa4", "#d8c69a", "#e6d7b0"]));
    else if (k === "alley" || k === "garden") F(x - 0.5, z - 0.5, 6, 4, pick(["#6cc04c", "#62b446", "#68bc4a", "#74c852"]));
  }
  for (let i = 0; i < 9000; i++) { const x = rnd(CITY.x0, CITY.x1), z = rnd(CITY.z0, CITY.z1), k = cellAt(x, z); if (k === "alley" || k === "garden") F(x, z, 1, 1, pick(["#ffffff", "#ffe050", "#ff80a0", "#4ea23a", "#90d866"])); }
  for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (HSEG[r][c] === "alley") {
    for (let x = SX[c] - STREET / 2; x <= SX[c + 1] + STREET / 2; x++) { const zc = alleyZ(r, c, x); F(x, zc - 3.5, 1, 7, "#b49c70"); if (x % 3 === 0) F(x, zc - 2.5 + ((x / 3) % 2) * 2, 2, 2, pick(["#e0cfa4", "#d8c69a", "#e6d7b0"])); }
    for (const d of (STRIP_DOORS[r + ":" + c] ?? [])) for (const s2 of [-1, 1]) { const z0 = alleyZ(r, c, d), z1 = SZ[r] + s2 * STREET / 2; F(d - 2, Math.min(z0, z1), 4, Math.abs(z1 - z0), "#c8b088"); }
  }
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) { if (isSpecialBlock(c, r)) continue; const b = block(c, r);
    F(b.x - 2, b.z - 2, b.w + 4, b.d + 4, "#d0ccc0"); F(b.x, b.z, b.w, b.d, "#6cc04c");
    for (let i = 0; i < 320; i++) F(b.x + rnd(0, b.w - 2), b.z + rnd(0, b.d - 1), rndi(1, 2), 1, pick(GR.concat(["#4ea23a", "#90d866", "#ffffff", "#ffe050"])));
    F(b.x + 8, b.z + b.d / 2 - 4, b.w - 16, 8, "#c8945a"); for (let x = b.x + 9; x < b.x + b.w - 9; x += 3) F(x, b.z + b.d / 2 - 3 + (x % 2), 1, 6, "#3aa848"); }
  { const pb = block(...PAGODA_BLOCK); F(pb.x - 2, pb.z - 2, pb.w + 4, pb.d + 4, "#d0ccc0"); F(pb.x, pb.z, pb.w, pb.d, "#6cc04c"); for (let i = 0; i < 300; i++) F(pb.x + rnd(0, pb.w - 2), pb.z + rnd(0, pb.d - 1), 1, 1, pick(GR.concat(["#ffffff", "#f8b8c8"]))); }
  F(PLAZA.x - 2, PLAZA.z - 2, PLAZA.w + 4, PLAZA.d + 4, "#c2ac80");
  for (let z = PLAZA.z; z < PLAZA.z + PLAZA.d; z += 6) for (let x = PLAZA.x + ((z / 6) % 2 ? 4 : 0); x < PLAZA.x + PLAZA.w; x += 8) F(x, z, 7, 5, pick(["#ecdcb4", "#ecdcb4", "#e6d4a8", "#f4e8c8"]));
  for (let z = STATUE.z - 30; z < STATUE.z + 30; z += 3) for (let x = STATUE.x - 30 + ((z / 3) % 2 ? 2 : 0); x < STATUE.x + 30; x += 4)   // pale flagstone disc round the pedestal
    if (Math.hypot(x + 1.75 - STATUE.x, z + 1.25 - STATUE.z) < 29.5) F(x, z, 3.5, 2.5, ["#d8d2c4", "#cfc8b8", "#e0dacc"][Math.floor(hash(x, z) * 3)]);
  for (const [r, col] of [[31, "#d0503a"], [38, "#c2ac80"], [46, "#d0503a"]]) for (let a = 0; a < Math.PI * 2; a += 0.6 / r) F(CENTER.x + Math.cos(a) * r, CENTER.z + Math.sin(a) * r, 1.5, 1.5, col);
  F(PALACE.x, PALACE.z, PALACE.w, PALACE.d, "#a89a86");
  for (let z = PALACE.z; z < PALACE.z + PALACE.d; z += 5) for (let x = PALACE.x + ((z / 5) % 2 ? 5 : 0); x < PALACE.x + PALACE.w; x += 10) F(x, z, 9, 4, pick(["#d8ccb8", "#d8ccb8", "#cfc2ac", "#e4dac8"]));
  F(GATE_X - 9, PALACE.z + 90, 18, PALACE.d - 90, "#f0ece4"); for (let z = PALACE.z + 90; z < PALACE.z + PALACE.d; z += 6) F(GATE_X - 9, z, 18, 1, "#d8d0c0");
  for (const [x0, x1] of [[PALACE.x + 4, PALACE.x + 48], [PALACE.x + PALACE.w - 48, PALACE.x + PALACE.w - 4]]) { F(x0, PALACE.z + 8, x1 - x0, 92, "#6cc04c"); for (let i = 0; i < 160; i++) F(rnd(x0, x1), PALACE.z + rnd(8, 100), 1, 1, pick(GR.concat(["#ffffff", "#ffe050"]))); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** Column mesher for heightmaps: top quads + exposed side quads, vertex colors from colorAt(h, isTop, x, z). Cell size `s`.
 *  Greedy: tops of equal height and identical color merge into rectangles; side quads with the same top, foot and color
 *  merge along their row. Colors are flat per quad, so merging never changes how anything looks. */
function heightfield(x0, x1, z0, z1, s, H, colorAt) {
  const pos = [], col = [], ind = [], nor = [];
  const quad = (a, b, c2, d, n, r, g, bl) => { const i = pos.length / 3; pos.push(...a, ...b, ...c2, ...d); for (let k = 0; k < 4; k++) { nor.push(...n); col.push(r, g, bl); } ind.push(i, i + 1, i + 2, i, i + 2, i + 3); };
  const C = new THREE.Color(), nx = Math.ceil((x1 - x0) / s), nz = Math.ceil((z1 - z0) / s), W = nx + 2;
  // heights with a one-cell border; per-cell top color and side base color
  const hh = new Float64Array(W * (nz + 2)), top = new Float64Array(nx * nz * 3), side = new Float64Array(nx * nz * 3);
  for (let i = -1; i <= nx; i++) for (let j = -1; j <= nz; j++) hh[(j + 1) * W + i + 1] = H(x0 + i * s, z0 + j * s);
  const hAt = (i, j) => hh[(j + 1) * W + i + 1];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const h = hAt(i, j); if (h <= 0) continue; const x = x0 + i * s, z = z0 + j * s, o = (j * nx + i) * 3;
    colorAt(h, true, x, z, C); top[o] = C.r; top[o + 1] = C.g; top[o + 2] = C.b;
    colorAt(h, false, x, z, C); side[o] = C.r; side[o + 1] = C.g; side[o + 2] = C.b;
  }
  const same = (arr, a, b) => arr[a * 3] === arr[b * 3] && arr[a * 3 + 1] === arr[b * 3 + 1] && arr[a * 3 + 2] === arr[b * 3 + 2];
  // tops: greedy rectangles (rows along z, then grow along x)
  const done = new Uint8Array(nx * nz);
  const topOk = (i, j, h, c) => !done[j * nx + i] && hAt(i, j) === h && same(top, j * nx + i, c);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const c = j * nx + i, h = hAt(i, j); if (h <= 0 || done[c]) continue;
    let dj = 1, di = 1;
    while (j + dj < nz && topOk(i, j + dj, h, c)) dj++;
    for (; i + di < nx; di++) { let k = 0; while (k < dj && topOk(i + di, j + k, h, c)) k++; if (k < dj) break; }
    for (let a = 0; a < di; a++) for (let b = 0; b < dj; b++) done[(j + b) * nx + i + a] = 1;
    const xa = x0 + i * s, xb = xa + di * s, za = z0 + j * s, zb = za + dj * s;
    quad([xa, h, za], [xa, h, zb], [xb, h, zb], [xb, h, za], [0, 1, 0], top[c * 3], top[c * 3 + 1], top[c * 3 + 2]);
  }
  // sides: runs of cells with the same height, neighbour height and side color
  const runs = (n, m, cell, emit) => {
    for (let b = 0; b < m; b++) for (let a = 0; a < n;) {
      const [i, j, ni, nj] = cell(a, b), h = hAt(i, j), hn = hAt(ni, nj);
      if (h <= 0 || hn >= h) { a++; continue; }
      let len = 1;
      for (; a + len < n; len++) { const [i2, j2, ni2, nj2] = cell(a + len, b); if (hAt(i2, j2) !== h || hAt(ni2, nj2) !== hn || !same(side, j2 * nx + i2, j * nx + i)) break; }
      const o = (j * nx + i) * 3; emit(i, j, len, h, hn, side[o], side[o + 1], side[o + 2]); a += len;
    }
  };
  runs(nx, nz, (a, b) => [a, b, a, b + 1], (i, j, len, h, hs, r, g, bl) => { const xa = x0 + i * s, xb = xa + len * s, zf = z0 + (j + 1) * s; quad([xa, hs, zf], [xb, hs, zf], [xb, h, zf], [xa, h, zf], [0, 0, 1], r * 0.92, g * 0.92, bl * 0.92); });
  runs(nx, nz, (a, b) => [a, b, a, b - 1], (i, j, len, h, hn, r, g, bl) => { const xa = x0 + i * s, xb = xa + len * s, z = z0 + j * s; quad([xa, hn, z], [xa, h, z], [xb, h, z], [xb, hn, z], [0, 0, -1], r * 0.8, g * 0.8, bl * 0.8); });
  runs(nz, nx, (a, b) => [b, a, b + 1, a], (i, j, len, h, he, r, g, bl) => { const xf = x0 + (i + 1) * s, za = z0 + j * s, zb = za + len * s; quad([xf, he, za], [xf, h, za], [xf, h, zb], [xf, he, zb], [1, 0, 0], r, g, bl); });
  runs(nz, nx, (a, b) => [b, a, b - 1, a], (i, j, len, h, hw, r, g, bl) => { const x = x0 + i * s, za = z0 + j * s, zb = za + len * s; quad([x, hw, za], [x, hw, zb], [x, h, zb], [x, h, za], [-1, 0, 0], r * 0.85, g * 0.85, bl * 0.85); });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(ind);
  return g;
}
const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

/** Voxel mountains beyond the river (2-voxel columns), reaching far past both edges of the world. */
// Mountain range north of the river: irregular peaks (seeded, so the layout is stable) — a tall back range and
// lower foothills in front, each peak with its own height, width, slope and ridge direction, plus smooth noise.
function vnoise(x, z) { // value noise, smooth in x and z, 0..1
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const PEAKS = (() => {
  let t = 977; const r = () => { t = (t + 0x6d2b79f5) | 0; let q = Math.imul(t ^ (t >>> 15), 1 | t); q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q; return ((q ^ (q >>> 14)) >>> 0) / 4294967296; };
  const out = [];
  for (const [zMin, zMax, hMin, hMax, gapMin, gapMax] of [[-110, -45, 62, 125, 40, 105], [-30, 25, 18, 46, 26, 70]])
    for (let x = -950 + r() * 60; x < WX + 950; x += gapMin + r() * (gapMax - gapMin)) {
      const h = hMin + (hMax - hMin) * Math.pow(r(), 0.8);
      out.push({ x, z: zMin + r() * (zMax - zMin), h, rx: h * (0.9 + r() * 1.1), rz: h * (0.7 + r() * 0.7), p: 1.1 + r() * 0.9, tilt: (r() - 0.5) * 0.8 });
    }
  return out.sort((p, q) => p.x - q.x);
})();
const PEAK_R = Math.max(...PEAKS.map((p) => Math.max(p.rx, p.rz) * 1.6));
function mountainH(x, z) {
  let h = 0;
  for (const p of PEAKS) {
    if (p.x < x - PEAK_R) continue; if (p.x > x + PEAK_R) break;
    const dx = x - p.x, dz = z - p.z, ex = dx * Math.cos(p.tilt) + dz * Math.sin(p.tilt), ez = -dx * Math.sin(p.tilt) + dz * Math.cos(p.tilt);
    const d = Math.hypot(ex / p.rx, ez / p.rz) * (0.85 + 0.3 * vnoise(x / 19 + p.x, z / 19)); // ragged flanks
    if (d < 1) h = Math.max(h, p.h * Math.pow(1 - d, p.p));
  }
  if (h <= 0) return 0;
  h += (vnoise(x / 11, z / 11) - 0.5) * 7 + (vnoise(x / 4.3, z / 4.3) - 0.5) * 3;
  return Math.max(0, Math.round(h));
}
export function mountainGeometry() {
  return heightfield(-900, WX + 900, -170, RIVER.zc(0) - RIVER.hw - 14, 2, (x, z) => (z > RIVER.zc(x) - RIVER.hw - 12 ? 0 : mountainH(x, z)), (h, top, x, z, C) => {
    const snow = 62 + 10 * vnoise(x / 9, z / 9), rock = 32 + 6 * vnoise(x / 7 + 50, z / 7);
    return C.set(h > snow ? (top ? "#f4f8ff" : "#c8d6ea") : h > rock ? (top ? (hash(x, z) > 0.5 ? "#8aa0b0" : "#7e94a6") : "#6a8090") : h > 14 ? (top ? (hash(x, z) > 0.5 ? "#4f9a5a" : "#478f52") : "#3a7a46") : top ? (hash(x, z) > 0.5 ? "#6cc04c" : "#62b446") : "#4e9a3a");
  });
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
