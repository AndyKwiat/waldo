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
const AV_C = 4, PAL_C = [3, 4], PAL_R = [0, 1, 2], PLAZA_R = 4, PAGODA_BLOCK = [1, 3];
export const COLW = [...Array(COLS)].map((_, c) => (PAL_C.includes(c) ? 122 : 96 + Math.round(lr() * 22)));
export const ROWH = [...Array(ROWS)].map((_, r) => { const v = PAL_R.includes(r) && r < 2 || r === PLAZA_R ? 0 : 70 + Math.round(lr() * 14); return r < 2 ? 86 : r === PLAZA_R ? 80 : r === 2 ? 84 : v; });   // rows 0–2 are the palace (row 2 still draws from lr so the rest of the layout stays put)
export const X0 = 380, Z0 = 280;                       // city origin; everything outside is countryside
export const CW = COLW.reduce((a, b) => a + b, 0) + (COLS + 1) * STREET, CD = ROWH.reduce((a, b) => a + b, 0) + (ROWS + 1) * STREET;
export const WX = X0 * 2 + CW, WZ = Z0 + CD + 430;
export const SX = [X0 + STREET / 2]; for (let c = 0; c < COLS; c++) SX.push(SX[c] + COLW[c] + STREET);
export const SZ = [Z0 + STREET / 2]; for (let r = 0; r < ROWS; r++) SZ.push(SZ[r] + ROWH[r] + STREET);
export const block = (c, r) => ({ x: SX[c] + STREET / 2, z: SZ[r] + STREET / 2, w: COLW[c], d: ROWH[r] });
export const PALACE = { x: block(3, 0).x, z: block(3, 0).z, w: COLW[3] + STREET + COLW[4], d: ROWH[0] + ROWH[1] + ROWH[2] + 2 * STREET };
export const FORT = PALACE;
export const PLAZA = { ...block(3, PLAZA_R), w: COLW[3] + STREET + COLW[4] };
export const CENTER = { x: PLAZA.x + PLAZA.w / 2, z: PLAZA.z + PLAZA.d / 2 };
// the colossal marble Jupiter in the middle of the market square (model "statue", 104³ grid, front faces south):
// stepped pedestal footprint ±hx × ±hz around the centre, h = top of the thunderbolt
export const STATUE = { x: CENTER.x, z: CENTER.z, hx: 23, hz: 20, h: 95 };
/** Spots on the statue where pigeons can perch (local offsets; flat ledges with 3 cells of headroom), baked from
 *  models/statue.json — regenerate with the snippet in README "Statue" if the statue changes. */
let STATUE_PERCHES = [];
try { STATUE_PERCHES = typeof process !== "undefined" ? JSON.parse(require("fs").readFileSync(new URL("../models/statue.perches.json", import.meta.url), "utf8")) : await (await fetch(new URL("../models/statue.perches.json", import.meta.url))).json(); } catch { STATUE_PERCHES = []; }
export { STATUE_PERCHES };
export const onStatue = (x, z, m = 0) => Math.abs(x - STATUE.x) <= STATUE.hx + m && Math.abs(z - STATUE.z) <= STATUE.hz + m;
export { PAGODA_BLOCK, PLAZA_R, AV_C };
export const isSpecialBlock = (c, r) => (PAL_C.includes(c) && PAL_R.includes(r)) || (PAL_C.includes(c) && r === PLAZA_R) || (c === PAGODA_BLOCK[0] && r === PAGODA_BLOCK[1]);
export const inRect = (x, z, R, m = 0) => x >= R.x - m && x <= R.x + R.w + m && z >= R.z - m && z <= R.z + R.d + m;
export const CITY = { x0: X0, z0: Z0, x1: X0 + CW, z1: Z0 + CD };
export const CITY_R = { x: X0 - 30, z: Z0 - 30, w: CW + 60, d: CD + 60 };  // city incl. walls + towers
export const GATE_X = SX[AV_C];
// palace courtyard between the great hall and the gate (drill, archery, barracks)
export const YARD = { x: PALACE.x + 18, z: PALACE.z + PALACE.d - 100, w: PALACE.w - 36, d: 46 };
// the great hall: model "palace_great_hall" (256 grid) centred at HALL; its bottom terrace's front edge is HALL.z + HALL.front
export const HALL = { x: PALACE.x + PALACE.w / 2, z: PALACE.z + 96, front: 74 };

// HSEG[r][c]: segment (c,r)–(c+1,r); VSEG[c][r]: segment (c,r)–(c,r+1)
export const HSEG = [...Array(ROWS + 1)].map(() => Array(COLS).fill("street"));
export const VSEG = [...Array(COLS + 1)].map(() => Array(ROWS).fill("street"));
HSEG[1][3] = HSEG[1][4] = HSEG[2][3] = HSEG[2][4] = VSEG[4][0] = VSEG[4][1] = VSEG[4][2] = "none";   // inside the palace
VSEG[4][PLAZA_R] = "none";                                     // the plaza's centre (the statue)
const MAIN_ROWS = new Set([0, 3, PLAZA_R, PLAZA_R + 1, ROWS]), MAIN_COLS = new Set([0, AV_C, COLS]);
const touchesSpecial = (cells) => cells.some(([c, r]) => c >= 0 && r >= 0 && c < COLS && r < ROWS && isSpecialBlock(c, r));
for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (HSEG[r][c] === "street" && !MAIN_ROWS.has(r) && !touchesSpecial([[c, r - 1], [c, r]]) && lr() < 0.38) HSEG[r][c] = "alley";
for (let c = 1; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (VSEG[c][r] === "street" && !MAIN_COLS.has(c) && !touchesSpecial([[c - 1, r], [c, r]]) && lr() < 0.32) VSEG[c][r] = "garden";
// the river runs down the middle of the city in a stone channel along street column RIVER_C (no north–south street there)
export const RIVER_C = 5, RX = SX[RIVER_C];
for (let r = 0; r < ROWS; r++) VSEG[RIVER_C][r] = "river";
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
// ---- the mountain: the city climbs the mountainside in terraces (south = the gate, low; north = the palace, high).
// Every east–west street line r sits at level LV[r]; inside a block the step down to the next street happens at the
// block's middle (a stone retaining wall), north–south streets climb it as stairs. North of the city a shelf at the top
// level holds a pool, then a sheer cliff up to the mountain plateau; the river falls off it, runs through the city in a
// channel with a waterfall at every terrace, and leaves under the south wall into the lowland paddies.
export const LV = [118, 118, 118, 118, 88, 88, 60, 34, 10];
export const CLIFF_Z = CITY.z0 - 95, PLATEAU = 196, POOL = { x: RX, z: CLIFF_Z + 34, r: 26 };
const sstep = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** Terrace level for any z in the city band (steps at block middles). */
export function levelAt(z) {
  if (z <= SZ[0]) return LV[0]; if (z >= SZ[ROWS]) return LV[ROWS];
  let r = 0; while (r < ROWS - 1 && z >= SZ[r + 1]) r++;
  return z < (SZ[r] + SZ[r + 1]) / 2 ? LV[r] : LV[r + 1];
}
/** Smooth slope through the street levels (countryside east/west of the city). */
function slopeAt(z) {
  if (z <= SZ[0]) return LV[0]; if (z >= CITY.z1 + 40) return 0;
  if (z >= SZ[ROWS]) return LV[ROWS] * (1 - (z - SZ[ROWS]) / (CITY.z1 + 40 - SZ[ROWS]));
  let r = 0; while (r < ROWS - 1 && z >= SZ[r + 1]) r++;
  return LV[r] + (LV[r + 1] - LV[r]) * sstep((z - SZ[r]) / (SZ[r + 1] - SZ[r]));
}
/** The river's centre line x and half-width at z (it runs north → south). */
export const RIVER = {
  hw: 9,
  x: (z) => (z <= CITY.z1 + 20 ? RX : RX + 46 * Math.sin((z - CITY.z1 - 20) / 110) * sstep((z - CITY.z1 - 20) / 80) + 14 * Math.sin((z - CITY.z1) / 41) * sstep((z - CITY.z1 - 20) / 120)),
  halfW: (z) => (z <= CITY.z1 + 20 ? 9 : 9 + 5 * sstep((z - CITY.z1 - 20) / 60)),
  /** water surface height */
  y: (z) => (z < CLIFF_Z ? PLATEAU - 3 : z < CITY.z0 - 6 ? LV[0] - 3 : z <= CITY.z1 + 6 ? Math.max(0.25, levelAt(z) - 4) : z < CITY.z1 + 30 ? Math.max(0.25, 6 * (1 - (z - CITY.z1 - 6) / 24)) : 0.25),
};
export const inRiver = (x, z, m = 0) => z > -400 && Math.abs(x - RIVER.x(z)) < RIVER.halfW(z) + m;
export const ROADS = [{ x: GATE_X - 9, z: CITY.z1, w: 18, d: 4000 }, { x: -4000, z: CITY.z1 + 205, w: 8000, d: 14 }];
export const PADDIES = [{ x: GATE_X - 340, z: CITY.z1 + 40, w: 310, d: 150 }, { x: GATE_X + 26, z: CITY.z1 + 40, w: SX[5] - GATE_X - 70, d: 150 }, { x: SX[5] + 70, z: CITY.z1 + 40, w: 250, d: 150 }];
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
  if (z > CLIFF_Z && inRiver(x, z, 10 + m)) return true;
  if (z < CLIFF_Z + 40 && z > CLIFF_Z - 10) return true;   // the cliff and the shelf below it
  return ROADS.some((r) => inRect(x, z, r, m + 2)) || PADDIES.some((p) => inRect(x, z, p, m + 3)) || FIELDS.some((f) => inRect(x, z, f, m + 3)) || HAMLETS.some((h) => Math.hypot(x - h.x, z - h.z) < 62 + m);
}

// ---- rolling hills in the countryside (heights in whole voxels; 0 everywhere in the city)
const BUMPS = [];
function placeBumps() {
  for (let tries = 0; BUMPS.length < 30 && tries < 6000; tries++) {
    const r = rnd(28, 70), h = rnd(9, 22), x = rnd(-60, WX + 60), z = rnd(CLIFF_Z + 60, WZ + 60);
    if (occupied(x, z, r * 1.25)) continue; BUMPS.push({ x, z, r, h });
  }
}
// flat pads under countryside features (fields, hamlets, paddies) so they don't sit on the slope
let PADS = null;
function pads() {
  if (PADS) return PADS;
  PADS = [...FIELDS.map((f) => ({ x0: f.x - 6, z0: f.z - 6, x1: f.x + f.w + 6, z1: f.z + f.d + 6 })), ...HAMLETS.map((h) => ({ x0: h.x - 80, z0: h.z - 70, x1: h.x + 80, z1: h.z + 70 }))]
    .map((p) => ({ ...p, h: Math.round(slopeAt((p.z0 + p.z1) / 2)) }));
  return PADS;
}
function bumpsAt(x, z) { let h = 0; for (const b of BUMPS) { const d2 = ((x - b.x) ** 2 + (z - b.z) ** 2) / (b.r * b.r); if (d2 < 4) h += b.h * Math.exp(-d2 * 1.6); } return h; }
/** City terrace height (no river): street lines flat, block halves at their street's level, stairs on north–south streets. */
function cityH(x, z) {
  const pb = block(...PAGODA_BLOCK);
  if (x >= pb.x - 1 && x <= pb.x + pb.w + 1 && z >= pb.z - 1 && z <= pb.z + pb.d + 1) return LV[PAGODA_BLOCK[1] + 1];
  if (z > SZ[0] + STREET / 2 && z < SZ[ROWS] - STREET / 2) {
    let r = 0; while (r < ROWS - 1 && z >= SZ[r + 1]) r++;
    const top = LV[r], bot = LV[r + 1], d = top - bot;
    if (d > 0 && Math.abs(z - SZ[r]) > STREET / 2 && Math.abs(z - SZ[r + 1]) > STREET / 2) for (let c = 0; c <= COLS; c++) {
      if (VSEG[c][r] !== "street" || Math.abs(x - SX[c]) >= STREET / 2) continue;   // garden strips step at the middle like blocks
      const mid = (SZ[r] + SZ[r + 1]) / 2, t = Math.max(0, Math.min(1, (z - (mid - d)) / (2 * d)));
      return Math.round(top - d * t);   // stairs: one step up every two units
    }
  }
  return levelAt(z);
}
/** Terrain surface (what the ground mesh shows): mountain plateau, shelf, city terraces, slopes, lowland, river channel. */
export function terrainH(x, z) {
  let h;
  if (z < CLIFF_Z) {
    // a rugged cliff: 3–4 tiers whose faces wander in and out, narrow ledges between them, the plateau above
    const into = CLIFF_Z - z, wob = (k) => 7 * vnoise(x / 23 + k * 17, k * 3.1) + 3 * vnoise(x / 7 + k * 5, k);
    const tiers = [[0, 150], [9, 168], [17, 184]];
    let tierH = PLATEAU; for (const [d, th] of tiers) if (into < d + wob(d)) { tierH = th + Math.round(4 * vnoise(x / 11, d)); break; }
    const edge = sstep((into - 30) / 60);
    const flat = 1 - sstep((Math.hypot(x - (GX - 40), z - (CLIFF_Z - 110)) - 80) / 40);   // the shrine's meadow stays flat
    h = Math.min(tierH, PLATEAU) + (tierH >= PLATEAU ? mountainH(x, z) * edge * (1 - flat) : 0);
    if (Math.abs(x - RX) < 10 && z > CLIFF_Z - 220) h = into < 26 ? 0 : Math.min(h, PLATEAU - 6);   // the river's gorge on the plateau, cut clean through the tiers (the falls)
    if (h <= 0) return LV[0] - 7;
    return Math.round(h);
  }
  const dx = Math.max(CITY.x0 - x, x - CITY.x1, 0), inCityZ = z < CITY.z1 + 40;
  const terr = z < CITY.z0 ? LV[0] : z <= CITY.z1 + 12 ? (dx === 0 ? cityH(x, z) : levelAt(z)) : LV[ROWS] * Math.max(0, 1 - (z - CITY.z1 - 12) / 28);
  if (dx === 0 && inCityZ) h = terr;
  else {
    const t = sstep((dx - 40) / 70), base = terr * (1 - t) + slopeAt(z) * t;
    h = base;
    if (dx > 30 || z > CITY.z1 + 40) {
      for (const p of pads()) { const ox = Math.max(p.x0 - x, x - p.x1, 0), oz = Math.max(p.z0 - z, z - p.z1, 0), o = Math.hypot(ox, oz); if (o < 50) { const w = sstep(o / 50); h = p.h * (1 - w) + h * w; break; } }
      const b = bumpsAt(x, z); if (b >= 0.6 && !occupied(x, z, 1)) h += b;
    }
  }
  // river channel (and the pool on the shelf below the falls)
  if (Math.hypot(x - POOL.x, z - POOL.z) < POOL.r) return Math.round(LV[0] - 8);
  if (z > CITY.z0 - 30 && inRiver(x, z)) return z < CITY.z1 + 20 ? Math.max(3, Math.round(levelAt(Math.min(z, CITY.z1)) - 7)) : 0;
  if (z >= CLIFF_Z && z <= CITY.z0 - 30 && inRiver(x, z)) return Math.round(LV[0] - 7);
  return Math.max(0, Math.round(h));
}
/** Where bridges carry the east–west streets over the river (street lines r with a street on both banks). */
export const BRIDGES = [];
for (let r = 0; r <= ROWS; r++) { const w = HSEG[r][RIVER_C - 1], e = HSEG[r][RIVER_C]; if (w && e && w !== "none" && e !== "none") BRIDGES.push({ r, x: RX, z: SZ[r], y: LV[r] }); }
// ---- wood-and-rope transport (sim + rendering share these definitions)
// The GONDOLA climbs from the riverside station on the plaza terrace (block 5,4) over a pylon on the upper terrace,
// the north wall and the great cliff, to the mountain shrine on the plateau; two cars shuttle on one rope (one up, one
// down), hauled by oxen at a capstan in the lower station. The LIFT is a counterweighted cage in a timber tower on the
// 30-high retaining wall of block (6,3), between the plaza terrace and the palace terrace. People ride both.
const GB = block(RIVER_C, PLAZA_R), EB = block(6, 3);
export const GX = RX + 20;                                    // the gondola rope runs straight north along x = GX
// Stations are placed with rot 1 (model +x → world north): local (x, z) → world (z, −x). Low station: cable exit local
// (32, 30, 0), capstan (−12, 0, 0), platform x 6..32 at y 6, stairs at local x 12..16 on +z. High station: cable in at
// (−24, 30, 0), bullwheel (10.5, 19, 0). Car grip is 21 above its floor.
export const GONDOLA_LOW = { x: GX, z: GB.z + 40, y: LV[PLAZA_R] };
export const CAPSTAN = { x: GX, z: GONDOLA_LOW.z + 12, y: LV[PLAZA_R] };
export const GONDOLA_HIGH = { x: GX, z: CLIFF_Z - 90, y: PLATEAU };
export const SHRINE = { x: GX - 80, z: CLIFF_Z - 116, y: PLATEAU };                 // the mountain shrine on the plateau
const ELX = EB.x + EB.w / 2, EMID = EB.z + EB.d / 2;
export const LIFT = { x: ELX, z: EMID + 7, y: LV[4], wheel: { x: ELX + 11, y: LV[4] + 48, z: EMID + 7 } };
export const TRANSPORTS = [
  { id: "gondola", kind: "gondola", name: "Gondola", cars: 2, cap: 10, travel: 34, dwell: 9, hang: 21, sag: 6,
    path: [{ x: GX, z: GONDOLA_LOW.z - 32, y: LV[PLAZA_R] + 30 }, { x: GX, z: SZ[3] + 28, y: LV[3] + 44 }, { x: GX, z: GONDOLA_HIGH.z + 24, y: PLATEAU + 30 }],
    pylons: [{ x: GX, z: SZ[3] + 28, y: LV[3], h: 44 }],
    ends: { A: { x: GX + 11, z: GONDOLA_LOW.z - 14, y: LV[PLAZA_R] }, B: { x: GX + 11, z: GONDOLA_HIGH.z + 12, y: PLATEAU } },
    links: { A: [[RIVER_C, PLAZA_R], [RIVER_C + 1, PLAZA_R]], B: [] }, via: { A: { x: GX + 11, z: SZ[PLAZA_R] }, B: null }, cost: 160 },
  { id: "lift", kind: "elevator", name: "Lift", cars: 1, cap: 6, travel: 7, dwell: 6, hang: 0, sag: 0,
    path: [{ x: ELX, z: EMID + 7, y: LV[4] }, { x: ELX, z: EMID + 7, y: LV[3] }],
    ends: { A: { x: ELX, z: EMID + 16, y: LV[4] }, B: { x: ELX, z: EMID - 13, y: LV[3] } },
    links: { A: [[6, 4], [7, 4]], B: [[6, 3], [7, 3]] }, via: { A: { x: ELX, z: SZ[4] }, B: { x: ELX, z: SZ[3] } }, cost: 30 },
];
/** Mooring masts where cargo airships call (y = ground). */
export const MASTS = [
  { x: PALACE.x + PALACE.w - 46, z: PALACE.z + PALACE.d - 140 },
  { x: SHRINE.x + 44, z: SHRINE.z - 30 },
  { x: RX + 190, z: CITY.z1 + 240 },
  { x: HAMLETS[0].x + 40, z: HAMLETS[0].z + 46 },
  { x: block(1, 6).x + 20, z: block(1, 6).z + 14 },
];
/** Rects kept free of houses/trees for the transport (corridors, stations). */
export const RESERVED = [
  { x0: GX - 10, x1: GX + 10, z0: SZ[0], z1: SZ[PLAZA_R] },                         // under the gondola rope
  { x0: GB.x - 2, x1: GB.x + GB.w + 2, z0: GB.z - 2, z1: GB.z + GB.d + 2 },          // the lower station's block
  { x0: ELX - 16, x1: ELX + 26, z0: EB.z, z1: EB.z + EB.d },                        // the lift and its two approaches
  ...[4].map((k) => ({ x0: block(1, 6).x + 8, x1: block(1, 6).x + 32, z0: block(1, 6).z + 2, z1: block(1, 6).z + 28 })),   // the district's mooring mast
];
export const isReserved = (x0, z0, x1, z1) => RESERVED.some((r) => x1 > r.x0 && x0 < r.x1 && z1 > r.z0 && z0 < r.z1);
/** Where car k is at time t: {s 0..1 along the path, dock "A"|"B"|null, rem: seconds left in this dock}. */
export function carState(T, k, t) {
  const P = 2 * (T.dwell + T.travel), u = (((t + (k * P) / T.cars) % P) + P) % P, ease = (v) => v * v * (3 - 2 * v);
  if (u < T.dwell) return { s: 0, dock: "A", rem: T.dwell - u };
  if (u < T.dwell + T.travel) return { s: ease((u - T.dwell) / T.travel), dock: null, dir: 1 };
  if (u < 2 * T.dwell + T.travel) return { s: 1, dock: "B", rem: 2 * T.dwell + T.travel - u };
  return { s: 1 - ease((u - 2 * T.dwell - T.travel) / T.travel), dock: null, dir: -1 };
}
/** Point on a transport's rope/shaft at s (gondola spans sag between supports); y is the car's floor. */
export function carPos(T, s) {
  const P = T.path, L = []; let tot = 0; for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y, P[i].z - P[i - 1].z); L.push(l); tot += l; }
  let d = s * tot, i = 0; while (i < L.length - 1 && d > L[i]) { d -= L[i]; i++; }
  const u = Math.max(0, Math.min(1, d / L[i])), a = P[i], b = P[i + 1];
  return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, y: a.y + (b.y - a.y) * u - T.sag * Math.sin(Math.PI * u) - T.hang, rope: a.y + (b.y - a.y) * u - T.sag * Math.sin(Math.PI * u) };
}

/** Walking height: the terrain, except on bridges (deck level). */
export function groundH(x, z) {
  for (const b of BRIDGES) if (Math.abs(x - b.x) <= 13 && Math.abs(z - b.z) <= STREET / 2) return b.y;
  return terrainH(x, z);
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
/** Garden plots that take a building slot (no door), and landmark trees taller than the houses. */
export const GARDENS = ["garden_flower", "garden_pond"], GIANT_TREES = ["tree_camphor", "tree_ginkgo"];
/** Optional palace models (built by a separate recipe pass); missing ones are skipped. */
export const GREAT_HALL = "palace_great_hall";
let MODELS_EXTRA = new Set();
export function setAvailableModels(names) { MODELS_EXTRA = new Set(names); }
export const hasModel = (m) => MODELS_EXTRA.has(m);
export const BIG_FOOT = { hall_house: { l: 25, r: 25, back: 18, roofY: 36 }, compound: { l: 30, r: 30, back: 19, roofY: 21 } };
export function layout() {
  placeBumps();
  const statics = [], houses = [], obstacles = [], stalls = [], crops = [], towers = [], giants = [];
  const put = (model, x, z, rot = 0, o = {}) => { const s = { model, x, y: o.y ?? groundH(x, z), z, rot, remap: o.remap ?? null, key: model + (o.remapKey ?? "") }; statics.push(s); return s; };
  const ob = (x, z, r) => obstacles.push({ x, z, r });
  const TREES = ["tree_round", "tree_round", "tree_fruit", "tree_blossom", "tree_pine", "bamboo"];
  const tree = (x, z, kinds = TREES) => (isReserved(x - 3, z - 3, x + 3, z + 3) ? null : put(pick(kinds), x, z, rndi(0, 3)));
  const houseVariant = (type) => { const roof = pick(ROOFS), wall = pick(WALLS), pillar = pick(PILLARS), cloth = pick(CLOTHS); return { remap: variantRemap({ roof, wall, pillar, cloth }), remapKey: `|${roof}|${wall}|${pillar}|${cloth}` }; };

  // ---- city blocks: 2–3 buildings per row (homes, shops, inns, manors); the south row faces south, the north row north
  const TYPES = ["home1", "home1", "home2", "home2", "shop", "shop", "inn", "manor", "manor"];
  const stripDoors = (STRIP_DOORS = {});      // "r:c" → door x's facing that street/alley strip (keep alley gardens clear)
  // Away from the centre the rows loosen up ("organic" factor f: 0 near the plaza/palace/avenue → 1 in the outer
  // districts). Rows are filled with a random mix of building types (incl. the big ones) and the spare width is split
  // unevenly, so neighbours across a street are offset by up to ~half a house; each house also gets its own setback,
  // so street fronts are jagged. Houses stay square to the street; doors follow each house.
  // Footprints as offsets from the model centre: l/r = half-widths, back = depth behind the centre (front edge ≈ +13).
  const FOOT = { garden_flower: { l: 17, r: 17, back: 12 }, garden_pond: { l: 17, r: 17, back: 12 }, home1: { l: 17, r: 17, back: 12 }, home2: { l: 16, r: 16, back: 12 }, shop: { l: 17, r: 17, back: 12 }, inn: { l: 16, r: 20, back: 12 }, manor: { l: 17, r: 17, back: 14 }, ...BIG_FOOT };
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
      // sprinkle gardens: some slots become a flower or pond garden (a bit more often away from the centre)
      for (let k = 0; k < types.length; k++) if (!BIG_FOOT[types[k]] && chance(0.07 + 0.1 * f)) types[k] = pick(GARDENS);
      const widths = types.map((t) => FOOT[t].l + FOOT[t].r + 2), n = types.length;
      const slack = Math.max(0, b.w - 6 - widths.reduce((a, w) => a + w, 0)), wts = [...Array(n + 1)].map(() => 1 - f + f * rnd(0.05, 1.95)), sw = wts.reduce((a, w) => a + w, 0);
      let cursor = b.x + 3 + slack * wts[0] / sw, prevEnd = b.x;
      for (let i = 0; i < n; i++) {
        const type = types[i], F = FOOT[type], x = Math.round(cursor + 1 + F.l);
        // setback: as deep as the opposite row allows (houses whose backs overlap this one in x), up to 12
        const x0 = x - F.l, x1 = x + F.r, front = 13;
        const opp = rects.filter((q) => q.south !== south && q.x1 > x0 && q.x0 < x1);
        const mid = b.z + b.d / 2, backLimit = south ? Math.max(b.z, mid + 2, ...opp.map((q) => q.z1 + 2)) : Math.min(b.z + b.d, mid - 2, ...opp.map((q) => q.z0 - 2));   // z the back may reach (never past the retaining wall in the middle)
        const zFront0 = south ? b.z + b.d - front : b.z + front;   // centre with zero setback
        const maxDz = Math.max(0, Math.min(12, south ? (zFront0 - F.back) - backLimit : backLimit - (zFront0 + F.back)));
        const dz = Math.round(rnd(0, maxDz) * f), z = south ? zFront0 - dz : zFront0 + dz, rr = south ? r + 1 : r;
        if (isReserved(x0, south ? z - F.back : z - 13, x1, south ? z + 13 : z + F.back)) { prevEnd = cursor + widths[i]; cursor = prevEnd + slack * wts[i + 1] / sw; continue; }   // keep transport corridors clear
        rects.push({ south, x0, x1, z0: south ? z - F.back : z - 13, z1: south ? z + 13 : z + F.back });
        if (GARDENS.includes(type)) { put(type, x, z, south ? 0 : 2, houseVariant(type)); prevEnd = cursor + widths[i]; cursor = prevEnd + slack * wts[i + 1] / sw; continue; }   // a garden: no door
        put(type, x, z, south ? 0 : 2, houseVariant(type));
        (stripDoors[rr + ":" + c] ??= []).push(x);
        houses.push({ type, x, z, south, c, r, doorX: x, outZ: south ? b.z + b.d + 3 : b.z - 3, inZ: south ? z + 7 : z - 7, roofY: F.roofY ?? (type === "home2" || type === "inn" ? 29 : type === "manor" ? 17 : 23) });
        // a wide gap before this house becomes a little garden at the street front
        if (cursor - prevEnd > 14 && f > 0.3) for (let gx = prevEnd + 6; gx < cursor - 5; gx += rnd(7, 10)) tree(gx, south ? b.z + b.d - rnd(6, 14) : b.z + rnd(6, 14), ["tree_round", "tree_fruit", "tree_blossom", "bamboo"]);
        prevEnd = cursor + widths[i]; cursor = prevEnd + slack * wts[i + 1] / sw;
      }
      if (b.x + b.w - prevEnd > 14 && f > 0.3) for (let gx = prevEnd + 6; gx < b.x + b.w - 5; gx += rnd(7, 10)) tree(gx, south ? b.z + b.d - rnd(6, 14) : b.z + rnd(6, 14), ["tree_round", "tree_fruit", "tree_blossom", "bamboo"]);
    }
    // now and then a giant landmark tree in the back-yard strip between the two rows (trunk clear of every building)
    const side = () => (chance(0.5) ? 1 : -1) * rnd(4, 7);   // the middle of the block is the retaining wall: keep things on one terrace
    if (chance(0.24)) for (let tries = 0; tries < 8; tries++) { const tx = b.x + rnd(16, b.w - 16), tz = b.z + b.d / 2 + side();
      if (rects.some((q) => tx > q.x0 - 5 && tx < q.x1 + 5 && tz > q.z0 - 5 && tz < q.z1 + 5) || giants.some((g) => Math.hypot(g.x - tx, g.z - tz) < 80)) continue;
      if (isReserved(tx - 20, tz - 20, tx + 20, tz + 20)) continue;
      giants.push({ x: tx, z: tz }); put(pick(GIANT_TREES), tx, tz, rndi(0, 3)); ob(tx, tz, 4); break; }
    // back-yard trees in the middle of the block, wherever no house reaches
    for (let i = 0; i < 4; i++) { const tx = b.x + rnd(8, b.w - 8), tz = b.z + b.d / 2 + side(); if (!rects.some((q) => tx > q.x0 - 3 && tx < q.x1 + 3 && tz > q.z0 - 3 && tz < q.z1 + 3)) tree(tx, tz); }
    { const px = b.x + rnd(14, b.w - 14), pz = b.z + b.d / 2 + side(); if (chance(0.5) && !isReserved(px - 5, pz - 5, px + 5, pz + 5) && !rects.some((q) => px > q.x0 - 5 && px < q.x1 + 5 && pz > q.z0 - 5 && pz < q.z1 + 5)) put(pick(["well", "haystack", "crates", "jars"]), px, pz, rndi(0, 3)); }
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
  put("fort_gate", fort.x, fort.z, 0, gold); fort.outZ = P.z + P.d + 3; fort.inZ = fort.z + 2;
  for (let x = P.x + 2; x < P.x + P.w - 12; x += 22) { put("palace_wall", x + 11, P.z + 2, 0, gold); if (Math.abs(x + 11 - GATE_X) > 62) put("palace_wall", x + 11, P.z + P.d - 3, 2, gold); }
  for (let z = P.z + 2; z < P.z + P.d - 12; z += 22) { put("palace_wall", P.x + 2, z + 11, 1, gold); put("palace_wall", P.x + P.w - 3, z + 11, 3, gold); }
  // the great hall on its marble terraces at the back, a long ceremonial approach lined with dragon columns, guardian
  // lions at the gate and at the foot of the hall's stair, bronze incense burners, side halls, the drill yard by the gate
  if (MODELS_EXTRA.has(GREAT_HALL)) put(GREAT_HALL, HALL.x, HALL.z, 0, gold); else put("palace_hall", HALL.x, HALL.z - 20, 0, gold);
  const hb = HALL.z + HALL.front;   // foot of the terraces
  for (let k = 0; k < 9; k++) ob(HALL.x - 80 + k * 20, HALL.z, 26);
  const sideHall = { remap: variantRemap({ roof: "#e8b830", wall: "#e8d0b8", pillar: "#c02a20" }), remapKey: "|palace" };
  for (const z of [hb + 26, hb + 66]) { put("home2", P.x + 22, z, 1, sideHall); put("home2", P.x + P.w - 22, z, 3, sideHall); }
  for (const [x, z] of [[P.x + 14, P.z + 14], [P.x + P.w - 14, P.z + 14], [P.x + 14, P.z + 150], [P.x + P.w - 14, P.z + 150], [P.x + 16, hb + 100], [P.x + P.w - 16, hb + 100]]) tree(x, z, ["tree_pine"]);
  if (MODELS_EXTRA.has("tree_ginkgo")) for (const dx of [-108, 108]) put("tree_ginkgo", HALL.x + dx, HALL.z + 40, 0);
  const statue = (m, x, z, rot, r) => { if (!MODELS_EXTRA.has(m)) return; put(m, x, z, rot); ob(x, z, r); };
  // lions: a pair at the hall stair, a pair just inside the gate, a pair outside it facing the city
  for (const sx of [-1, 1]) { statue("lion_statue", HALL.x + sx * 24, hb + 10, 0, 7); statue("lion_statue", GATE_X + sx * 22, P.z + P.d - 44, 0, 7); statue("lion_statue", GATE_X + sx * 22, P.z + P.d + 8, 0, 7); }
  // dragon columns flanking the approach, incense burners on the axis
  for (let z = hb + 24; z < YARD.z - 6; z += 30) for (const sx of [-1, 1]) statue("dragon_statue", HALL.x + sx * 30, z, 0, 6);
  for (const z of [hb + 18, hb + 50]) statue("incense_burner", HALL.x, z, 0, 5);
  for (let z = YARD.z + 4; z < P.z + P.d - 36; z += 14) for (const dx of [-14, 14]) { put("lantern_post", GATE_X + dx, z); ob(GATE_X + dx, z, 2); }
  for (let i = 0; i < 4; i++) put("target", YARD.x + YARD.w - 12, YARD.z + 8 + i * 9, 3);
  put("haystack", YARD.x + 8, YARD.z + 6, 0); put("crates", YARD.x + 24, YARD.z + 4, 1); put("jars", YARD.x + YARD.w - 40, YARD.z + 4, 0);
  // ---- market square: the giant statue of Jupiter in the middle, two rows of stalls, lantern posts
  put("statue", STATUE.x, STATUE.z, 0);
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

  // ---- bridges, the gondola and lift stations, the mountain shrine, airship masts
  const has = (m) => MODELS_EXTRA.has(m);
  if (has("bridge_stone")) for (const b of BRIDGES) put("bridge_stone", b.x, b.z, 0, { y: b.y - 10 });
  if (has("gondola_station_low")) { put("gondola_station_low", GONDOLA_LOW.x, GONDOLA_LOW.z, 1); for (const dz of [-30, -20, -10]) ob(GX, GONDOLA_LOW.z + dz, 6); }
  if (has("gondola_station_high")) put("gondola_station_high", GONDOLA_HIGH.x, GONDOLA_HIGH.z, 1);
  if (has("elevator_tower")) { put("elevator_tower", LIFT.x, LIFT.z, 0, { y: LIFT.y }); ob(LIFT.x + 20, LIFT.z, 5); }
  put("pagoda", SHRINE.x, SHRINE.z, 0); for (const sx of [-1, 1]) if (has("lion_statue")) put("lion_statue", SHRINE.x + sx * 12, SHRINE.z + 24, 0);
  if (has("incense_burner")) put("incense_burner", SHRINE.x, SHRINE.z + 34, 0);
  for (let k = 0; k < 16; k++) { const a = k / 16 * 6.28, d = rnd(58, 80); tree(SHRINE.x + Math.cos(a) * d, SHRINE.z + Math.sin(a) * d * 0.8, ["tree_pine", "tree_pine", "tree_blossom", "bamboo"]); }
  if (has("mooring_mast")) for (const m of MASTS) { put("mooring_mast", m.x, m.z, 0); ob(m.x, m.z, 4); }
  // ---- city walls (24 tall): 22-long segments, towers at corners and along the sides, gate in the south wall
  // walls follow the terraces: each segment sits at the lower of its two ends (the uphill end is buried, never floating)
  const lowAt = (pts) => Math.min(...pts.map(([x, z]) => terrainH(x, z)));
  for (let x = CITY.x0 - 9; x < CITY.x1 + 9; x += 22) { const cx = x + 11; if (Math.abs(cx - RX) < 22) continue;
    put("wall", cx, CITY.z0 - 1, 0, { y: lowAt([[cx - 11, CITY.z0 - 1], [cx + 11, CITY.z0 - 1]]) });
    if (Math.abs(cx - GATE_X) >= 26) put("wall", cx, CITY.z1 + 1, 2, { y: lowAt([[cx - 11, CITY.z1 + 1], [cx + 11, CITY.z1 + 1]]) }); }
  for (let z = CITY.z0 - 9; z < CITY.z1 + 9; z += 22) for (const [x, rot] of [[CITY.x0 - 1, 1], [CITY.x1 + 1, 3]]) put("wall", x, z + 11, rot, { y: lowAt([[x, z], [x, z + 22]]) });
  // where the river passes through the walls: arched water gates (north: in from the pool; south: out to the paddies)
  if (MODELS_EXTRA.has("water_gate")) for (const [z, rot] of [[CITY.z0 - 1, 0], [CITY.z1 + 1, 2]]) put("water_gate", RX, z, rot, { y: lowAt([[RX - 20, z], [RX + 20, z]]) });
  else for (const [z, rot] of [[CITY.z0 - 1, 0], [CITY.z1 + 1, 2]]) for (const dx of [-16, 16]) put("wall", RX + dx, z, rot, { y: lowAt([[RX + dx - 11, z], [RX + dx + 11, z]]) });
  put("city_gate", GATE_X, CITY.z1 + 5, 0);
  const zA = SZ[3], zB = SZ[6], TX = [SX[2], SX[6]];
  for (const [x, z] of [[CITY.x0 - 14, CITY.z0 - 14], [CITY.x1 + 14, CITY.z0 - 14], [CITY.x0 - 14, CITY.z1 + 14], [CITY.x1 + 14, CITY.z1 + 14],
    [TX[0], CITY.z0 - 14], [TX[1], CITY.z0 - 14], [TX[0], CITY.z1 + 14], [TX[1], CITY.z1 + 14], [CITY.x0 - 14, zA], [CITY.x1 + 14, zA], [CITY.x0 - 14, zB], [CITY.x1 + 14, zB]]) { const ty = lowAt([[x - 9, z - 9], [x + 9, z - 9], [x - 9, z + 9], [x + 9, z + 9]]); put("tower", x, z, 0, { y: ty }); towers.push({ x, z, y: ty }); }
  const beats = [ // sentry walking ranges on the wall walkways, between towers
    ...[[CITY.x0 + 2, TX[0] - 18], [TX[0] + 18, TX[1] - 18], [TX[1] + 18, CITY.x1 - 2]].map(([a0, a1]) => ({ ax: "x", a0, a1, fixed: WALL.n })),
    ...[[CITY.x0 + 2, TX[0] - 18], [TX[0] + 18, GATE_X - 30], [GATE_X + 30, TX[1] - 18], [TX[1] + 18, CITY.x1 - 2]].map(([a0, a1]) => ({ ax: "x", a0, a1, fixed: WALL.s })),
    ...[[CITY.z0 + 2, zA - 18], [zA + 18, zB - 18], [zB + 18, CITY.z1 - 2]].flatMap(([a0, a1]) => [{ ax: "z", a0, a1, fixed: WALL.w }, { ax: "z", a0, a1, fixed: WALL.e }]),
  ];

  // countryside: hamlets of farmhouses facing a little square, crop fields, forests, scattered trees, mill + docks
  for (const H of HAMLETS) {
    for (const [dx, dz, rot] of [[-34, -26, 0], [26, -30, 0], [-30, 30, 2], [32, 28, 2]]) put(chance(0.7) ? "home1" : "home2", H.x + dx, H.z + dz, rot, houseVariant("home"));
    if (chance(0.7)) { const a = rnd(0, 6.28); put(pick(GIANT_TREES), H.x + Math.cos(a) * 100, H.z + Math.sin(a) * 100, rndi(0, 3)); }   // a village landmark tree
    put("well", H.x, H.z, 0); ob(H.x, H.z, 5); put("haystack", H.x + 52, H.z - 6, 0); put("haystack", H.x - 54, H.z + 4, 1); put("crates", H.x + 10, H.z + 12, 0);
    for (let i = 0; i < 6; i++) { const a = rnd(0, 6.28); tree(H.x + Math.cos(a) * rnd(64, 80), H.z + Math.sin(a) * rnd(64, 80), ["tree_fruit", "tree_round", "bamboo"]); }
  }
  for (const f of FIELDS) { const wheat = f.crop === "wheat";
    for (let z = f.z + 3; z < f.z + f.d - 2; z += wheat ? 3 : 5) for (let x = f.x + 3; x < f.x + f.w - 2; x += wheat ? 2 : 4) crops.push({ x: x + rnd(-0.4, 0.4), z, kind: f.crop }); }
  for (let k = 0; k < 26; k++) { // forests, preferably on hills
    const b = k < 18 && BUMPS[k] ? BUMPS[k] : null, cx = b ? b.x : rnd(0, WX), cz = b ? b.z : rnd(CLIFF_Z + 60, WZ), R = b ? b.r * 1.1 : rnd(30, 60);
    for (let i = 0; i < R * 0.9; i++) { const a = rnd(0, 6.28), d = Math.sqrt(rand()) * R, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (!occupied(x, z, 2) && x > -80 && x < WX + 80) tree(x, z, ["tree_pine", "tree_pine", "tree_round", "tree_round", "bamboo"]); }
  }
  for (let i = 0; i < 520; i++) { const x = rnd(-80, WX + 80), z = rnd(CLIFF_Z + 50, WZ + 60), dr = Math.abs(x - RIVER.x(z)); if (occupied(x, z, 3) && !(dr > RIVER.halfW(z) + 6 && dr < RIVER.halfW(z) + 30 && !inRect(x, z, CITY_R, 4) && z > CITY.z1 + 30)) continue; tree(x, z); }
  // pines along the plateau's edge above the cliff, and trees on the shelf around the pool
  for (let x = -60; x < WX + 60; x += rnd(14, 30)) if (Math.abs(x - RX) > 24) tree(x, CLIFF_Z - rnd(8, 30), ["tree_pine", "tree_pine", "tree_round"]);
  for (let i = 0; i < 26; i++) { const a = rnd(0, 6.28), d = rnd(POOL.r + 6, POOL.r + 26), x = POOL.x + Math.cos(a) * d, z = POOL.z + Math.sin(a) * d * 0.7; if (z > CLIFF_Z + 6 && z < CITY.z0 - 16 && !inRiver(x, z, 3)) tree(x, z, ["tree_blossom", "bamboo", "tree_round", "tree_pine"]); }
  for (let i = 0; i < 14; i++) { const p = pick(PADDIES); put("haystack", rnd(p.x, p.x + p.w), p.z - 12, rndi(0, 3)); }
  // the mill: a water wheel on the lowland river below the city (the wheel turns in the y–z plane: the river flows south)
  const wz = PADDIES[0].z + PADDIES[0].d + 60, WHEEL = { z: wz, x: RIVER.x(wz) - RIVER.halfW(wz) - 1 };
  put("home1", WHEEL.x - 24, wz, 1, { remap: variantRemap({ roof: "#6a7fa0" }), remapKey: "|mill" });
  const DOCKS = [CITY.z1 + 260, CITY.z1 + 360];   // z of the two fishing docks (on the river's east bank)
  for (const dz of DOCKS) ob(RIVER.x(dz) + RIVER.halfW(dz) + 3, dz, 4);
  return { statics, houses, obstacles, stalls, crops, towers, beats, pagoda, fort, WHEEL, DOCKS, bumps: BUMPS, statuePerches: STATUE_PERCHES };
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
  for (let z = CITY.z1 + 4; z < WZ; z++) { const xc = RIVER.x(z), hw = RIVER.halfW(z); F(xc - hw - 5, z, 2 * hw + 10, 1, "#e8d8a0"); F(xc - hw, z, 2 * hw, 1, "#3a8ac8"); F(xc - hw / 3, z, hw * 0.66, 1, "#2f78b8"); }
  for (let i = 0; i < 900; i++) { const z = rnd(CITY.z1 + 4, WZ), hw = RIVER.halfW(z); F(RIVER.x(z) + rnd(-hw + 2, hw - 2), z, 1, rndi(2, 5), "#a8e0ff"); }
  for (const dz of [CITY.z1 + 260, CITY.z1 + 360]) { const xr = RIVER.x(dz) + RIVER.halfW(dz); F(xr - 2, dz - 5, 12, 10, "#8a5a32"); for (let x = xr - 1; x < xr + 10; x += 2) F(x, dz - 5, 1, 10, "#b07a44"); }
  // the shelf below the cliff: a pebble beach round the pool
  { g.fillStyle = "#cfc4a8"; g.beginPath(); g.ellipse(POOL.x, POOL.z, POOL.r + 8, POOL.r * 0.9 + 6, 0, 0, 6.3); g.fill(); }
  // city floor: stone slabs on streets; garden strips (closed streets) and alleys with a winding paved path; blocks; plaza; palace
  F(CITY.x0, CITY.z0, CW, CD, "#b49c70");
  for (let z = CITY.z0; z < CITY.z1; z += 4) for (let x = CITY.x0 + ((z / 4) % 2 ? 3 : 0); x < CITY.x1; x += 6) {
    const k = cellAt(x + 2.5, z + 1.5);
    if (k === "alley" || k === "garden") F(x - 0.5, z - 0.5, 6, 4, pick(["#6cc04c", "#62b446", "#68bc4a", "#74c852"]));
  }
  // Street paving follows the street: running-bond slabs laid lengthwise along each segment (5×3 with 1-unit joints,
  // rows offset by half a slab), edged with a kerb of narrow stones; intersections get a square-set grid of 4×4 flags
  // inside a kerb border, so every junction reads as its own little square.
  const SLAB = ["#e0cfa4", "#e0cfa4", "#d8c69a", "#e6d7b0", "#dccb9e"];
  const bandH = (z) => SZ.some((sz) => Math.abs(z - sz) < STREET / 2), bandV = (x) => SX.some((sx) => Math.abs(x - sx) < STREET / 2);
  const streetAt = (x, z) => cellAt(x, z) === "street";
  for (let r = 0; r < SZ.length; r++) { // along x (east–west segments): rows of slabs 5 long in x
    const z0 = SZ[r] - STREET / 2;
    for (let row = 0; row * 4 < STREET - 2; row++) { const z = z0 + 1 + row * 4;
      for (let x = CITY.x0 + (row % 2 ? 3 : 0); x < CITY.x1; x += 6) { const cx = x + 2.5, cz = z + 1.5; if (!streetAt(cx, cz) || bandV(cx)) continue; F(x, z, 5, 3, pick(SLAB)); } }
    for (const kz of [z0, z0 + STREET - 1]) for (let x = CITY.x0; x < CITY.x1; x += 2) if (streetAt(x + 1, kz + 0.5) && !bandV(x + 1)) F(x, kz, 1.6, 1, pick(["#c8b48a", "#bea880"]));
  }
  for (let c = 0; c < SX.length; c++) { // along z (north–south segments): columns of slabs 5 long in z
    const x0 = SX[c] - STREET / 2;
    for (let col = 0; col * 4 < STREET - 2; col++) { const x = x0 + 1 + col * 4;
      for (let z = CITY.z0 + (col % 2 ? 3 : 0); z < CITY.z1; z += 6) { const cx = x + 1.5, cz = z + 2.5; if (!streetAt(cx, cz) || bandH(cz)) continue; F(x, z, 3, 5, pick(SLAB)); } }
    for (const kx of [x0, x0 + STREET - 1]) for (let z = CITY.z0; z < CITY.z1; z += 2) if (streetAt(kx + 0.5, z + 1) && !bandH(z + 1)) F(kx, z, 1, 1.6, pick(["#c8b48a", "#bea880"]));
  }
  for (const sx of SX) for (const sz of SZ) { // intersections: kerb-bordered square of square flags
    if (!streetAt(sx, sz)) continue;
    const x0 = sx - STREET / 2, z0 = sz - STREET / 2;
    F(x0, z0, STREET, STREET, "#bea880");
    for (let z = z0 + 1; z < z0 + STREET - 1; z += 5) for (let x = x0 + 1; x < x0 + STREET - 1; x += 5) F(x, z, Math.min(4, x0 + STREET - 1 - x), Math.min(4, z0 + STREET - 1 - z), pick(SLAB));
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
  const hb = HALL.z + HALL.front;   // white marble processional way from the hall to the gate, with a darker border
  F(GATE_X - 13, hb - 4, 26, PALACE.d - (hb - PALACE.z) + 4, "#c8bca8"); F(GATE_X - 11, hb - 4, 22, PALACE.d - (hb - PALACE.z) + 4, "#f0ece4"); for (let z = hb; z < PALACE.z + PALACE.d; z += 6) F(GATE_X - 11, z, 22, 1, "#d8d0c0");
  for (const [x0, x1] of [[PALACE.x + 4, PALACE.x + 30], [PALACE.x + PALACE.w - 30, PALACE.x + PALACE.w - 4]]) { F(x0, PALACE.z + 8, x1 - x0, 170, "#6cc04c"); for (let i = 0; i < 200; i++) F(rnd(x0, x1), PALACE.z + rnd(8, 178), 1, 1, pick(GR.concat(["#ffffff", "#ffe050"]))); }
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
  for (const [zMin, zMax, hMin, hMax, gapMin, gapMax] of [[-140, -50, 70, 140, 40, 105], [-20, 90, 18, 52, 26, 70]])
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
/**
 * Terrain mesher (voxel columns, greedy). Tops are either textured with the painted ground (uv = world xz over the
 * world rect; vertex colour white) or vertex-coloured; side faces carry a "brick" uv (along-wall, height) for the
 * retaining-wall texture. Output: one geometry with groups 0 = textured tops, 1 = brick sides, 2 = vertex-coloured faces.
 */
function terrainField(x0, x1, z0, z1, s, H, o) {
  const P = [], N = [], C = [], U = [], idx = [[], [], []];
  const quad = (grp, a, b, c2, d, n, col, uv) => { const i = P.length / 3; P.push(...a, ...b, ...c2, ...d); for (let k = 0; k < 4; k++) { N.push(...n); C.push(col[0], col[1], col[2]); } U.push(...uv); idx[grp].push(i, i + 1, i + 2, i, i + 2, i + 3); };
  const nx = Math.ceil((x1 - x0) / s), nz = Math.ceil((z1 - z0) / s), W = nx + 2, hh = new Float32Array(W * (nz + 2));
  for (let i = -1; i <= nx; i++) for (let j = -1; j <= nz; j++) hh[(j + 1) * W + i + 1] = H(x0 + i * s, z0 + j * s);
  const hAt = (i, j) => hh[(j + 1) * W + i + 1], col = new THREE.Color(), WHITE = [1, 1, 1];
  const tex = (x, z) => [x / WX, 1 - z / WZ];
  // tops: textured where o.textured(x, z), else coloured; greedy over equal height (+ equal colour when coloured)
  const done = new Uint8Array(nx * nz), key = new Float32Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const h = hAt(i, j); if (h <= 0) continue; const x = x0 + i * s, z = z0 + j * s;
    if (o.textured?.(x, z)) key[j * nx + i] = -1; else { o.topColor(h, x, z, col); key[j * nx + i] = Math.round(col.r * 255) * 65536 + Math.round(col.g * 255) * 256 + Math.round(col.b * 255); } }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const c = j * nx + i, h = hAt(i, j); if (h <= 0 || done[c]) continue; const k = key[c], ok = (a, b) => !done[b * nx + a] && hAt(a, b) === h && key[b * nx + a] === k;
    let dj = 1, di = 1; while (j + dj < nz && ok(i, j + dj)) dj++;
    for (; i + di < nx; di++) { let q = 0; while (q < dj && ok(i + di, j + q)) q++; if (q < dj) break; }
    for (let a = 0; a < di; a++) for (let b = 0; b < dj; b++) done[(j + b) * nx + i + a] = 1;
    const xa = x0 + i * s, xb = xa + di * s, za = z0 + j * s, zb = za + dj * s;
    if (k === -1) quad(0, [xa, h, za], [xa, h, zb], [xb, h, zb], [xb, h, za], [0, 1, 0], WHITE, [...tex(xa, za), ...tex(xa, zb), ...tex(xb, zb), ...tex(xb, za)]);
    else quad(2, [xa, h, za], [xa, h, zb], [xb, h, zb], [xb, h, za], [0, 1, 0], [((k >> 16) & 255) / 255, ((k >> 8) & 255) / 255, (k & 255) / 255], [0, 0, 0, 0, 0, 0, 0, 0]);
  }
  // sides: runs along each row where the neighbour is lower; brick group where o.brick(x, z)
  const side = (i, j, len, h, hn, dir) => {
    const x = x0 + i * s, z = z0 + j * s, brick = o.brick?.(x, z, h - hn);
    o.sideColor(h, hn, x, z, col); const sh = dir === 0 ? 0.92 : dir === 1 ? 0.8 : dir === 2 ? 1 : 0.85, cc = [col.r * sh, col.g * sh, col.b * sh];
    let a, b, c2, d, n, al;
    if (dir === 0) { const xa = x, xb = x + len * s, zf = z + s; a = [xa, hn, zf]; b = [xb, hn, zf]; c2 = [xb, h, zf]; d = [xa, h, zf]; n = [0, 0, 1]; al = [xa, xb]; }
    else if (dir === 1) { const xa = x, xb = x + len * s; a = [xa, hn, z]; b = [xa, h, z]; c2 = [xb, h, z]; d = [xb, hn, z]; n = [0, 0, -1]; al = [xa, xb]; }
    else if (dir === 2) { const xf = x + s, za = z, zb = z + len * s; a = [xf, hn, za]; b = [xf, h, za]; c2 = [xf, h, zb]; d = [xf, hn, zb]; n = [1, 0, 0]; al = [za, zb]; }
    else { const za = z, zb = z + len * s; a = [x, hn, za]; b = [x, hn, zb]; c2 = [x, h, zb]; d = [x, h, za]; n = [-1, 0, 0]; al = [za, zb]; }
    const uv = (p) => [(dir < 2 ? p[0] : p[2]) / 6, p[1] / 3];
    quad(brick ? 1 : 2, a, b, c2, d, n, cc, [...uv(a), ...uv(b), ...uv(c2), ...uv(d)]);
  };
  const runs = (n, m, cell, dir) => {
    for (let b = 0; b < m; b++) for (let a = 0; a < n;) {
      const [i, j, ni, nj] = cell(a, b), h = hAt(i, j), hn = hAt(ni, nj);
      if (h <= 0 || hn >= h) { a++; continue; }
      let len = 1; for (; a + len < n; len++) { const [i2, j2, ni2, nj2] = cell(a + len, b); if (hAt(i2, j2) !== h || hAt(ni2, nj2) !== hn) break; }
      side(i, j, len, h, Math.max(0, hn), dir); a += len;
    }
  };
  runs(nx, nz, (a, b) => [a, b, a, b + 1], 0); runs(nx, nz, (a, b) => [a, b, a, b - 1], 1);
  runs(nz, nx, (a, b) => [b, a, b + 1, a], 2); runs(nz, nx, (a, b) => [b, a, b - 1, a], 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  const all = [...idx[0], ...idx[1], ...idx[2]]; g.setIndex(all);
  g.addGroup(0, idx[0].length, 0); g.addGroup(idx[0].length, idx[1].length, 1); g.addGroup(idx[0].length + idx[1].length, idx[2].length, 2);
  g.computeBoundingSphere(); return g;
}
const inCityWalls = (x, z) => x > CITY.x0 - 30 && x < CITY.x1 + 30 && z > CLIFF_Z - 2 && z < CITY.z1 + 30;
function mountainColor(h, x, z, C) {
  const r = h - PLATEAU, snow = 62 + 10 * vnoise(x / 9, z / 9), rock = 30 + 6 * vnoise(x / 7 + 50, z / 7);
  if (h < PLATEAU - 4) return C.set(hash(x, z) > 0.5 ? "#6cc04c" : "#62b446");
  return C.set(r > snow ? "#f4f8ff" : r > rock ? (hash(x, z) > 0.5 ? "#8aa0b0" : "#7e94a6") : r > 12 ? (hash(x, z) > 0.5 ? "#4f9a5a" : "#478f52") : hash(x, z) > 0.5 ? "#5cae48" : "#54a442");
}
function sideColorAt(h, hn, x, z, C) {
  if (inCityWalls(x, z) && (z > CITY.z0 - 40 || inRiver(x, z, 4) || Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 4)) return C.set("#c8bea8");   // dressed stone retaining walls, channel and pool
  if (z < CLIFF_Z + 2 && z > CLIFF_Z - 40 && h > LV[0] + 4) { const k = hash(Math.floor(x / 5), Math.floor(h / 9)); return C.set(k > 0.66 ? "#8e8c92" : k > 0.33 ? "#7c7a82" : "#9a968e"); }   // the great cliff: rock in vertical bands
  if (h > PLATEAU - 4) return mountainColor(h, x, z, C).multiplyScalar(0.8);
  return C.set(h % 3 === 0 ? "#8a6a42" : "#5a9a3a");                                    // earth banks on the slopes
}
/** The ground: {main} = the world rect (textured tops, brick retaining walls) and {outer} = mountains + slopes beyond it. */
export function terrainGeometry() {
  const main = terrainField(0, WX, CLIFF_Z, WZ, 2, terrainH, { textured: (x, z) => z >= CLIFF_Z, topColor: mountainColor, sideColor: sideColorAt, brick: (x, z, d) => inCityWalls(x, z) && d >= 2 && (z > CITY.z0 - 40 || inRiver(x, z, 4) || Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 4) });
  const parts = [
    terrainField(-900, WX + 900, -420, CLIFF_Z, 4, terrainH, { topColor: mountainColor, sideColor: sideColorAt }),
    terrainField(-900, 0, CLIFF_Z, WZ + 300, 4, terrainH, { topColor: (h, x, z, C) => C.set(hash(x, z) > 0.5 ? "#6cc04c" : "#62b446"), sideColor: sideColorAt }),
    terrainField(WX, WX + 900, CLIFF_Z, WZ + 300, 4, terrainH, { topColor: (h, x, z, C) => C.set(hash(x, z) > 0.5 ? "#6cc04c" : "#62b446"), sideColor: sideColorAt }),
  ];
  return { main, outer: parts };
}
