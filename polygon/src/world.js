// World layout (1 unit ≈ the old voxel; x = east, z = south, y = up) and the static scenery placement.
// Everything here is deterministic from the seed so screenshots are reproducible.
import { PERCHES } from "./perches.js";

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
/** Spots on the statue where pigeons can perch (local offsets on its ledges, see perches.js). */
export const STATUE_PERCHES = PERCHES;
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
// terrace levels of the street lines (see "the mountain" below); a north–south segment between lines of different level is a stair
export const LV = [334, 334, 334, 334, 244, 244, 162, 86, 10];
export const isStairSeg = (c, r) => LV[r] !== LV[r + 1];
// stairs: the grand stair down the main avenue (double width) plus one more per cliff band; the rest become garden strips
// (lifts on every band carry carts and anyone in a hurry)
const KEEP_STAIR = { 3: 7, 5: 0, 6: 8, 7: 3 };
for (let r = 0; r < ROWS; r++) if (isStairSeg(0, r)) for (let c = 0; c <= COLS; c++) if (c !== AV_C && c !== KEEP_STAIR[r] && VSEG[c][r] === "street") VSEG[c][r] = "garden";
export const STAIR_HALF = (c) => (c === AV_C ? STREET : STREET / 2);
// the river runs down the middle of the city in a stone channel along street column RIVER_C (no north–south street there)
export const RIVER_C = 5, RIVER_HW = 27, RX = SX[RIVER_C] + 16;   // a wide river: its channel runs just east of street column 5
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
export const CLIFF_Z = CITY.z0 - 95, PLATEAU = 568, POOL = { x: RX, z: CLIFF_Z + 44, r: 38 }, GORGE = 46;   // falls at the back of a slot GORGE deep
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
  hw: RIVER_HW,
  x: (z) => (z <= CITY.z1 + 20 ? RX : RX + 30 * Math.sin((z - CITY.z1 - 20) / 130) * sstep((z - CITY.z1 - 20) / 80) + 10 * Math.sin((z - CITY.z1) / 47) * sstep((z - CITY.z1 - 20) / 120)),
  halfW: (z) => (z <= CITY.z1 + 20 ? RIVER_HW : RIVER_HW + 15 * sstep((z - CITY.z1 - 20) / 60)),
  /** water surface height */
  y: (z) => (z < CLIFF_Z - GORGE + 2 ? PLATEAU - 3 : z < CLIFF_Z ? LV[0] - 3 : z < CITY.z0 - 6 ? LV[0] - 3 : z <= CITY.z1 + 6 ? Math.max(0.25, levelAt(z) - 4) : z < CITY.z1 + 30 ? Math.max(0.25, 6 * (1 - (z - CITY.z1 - 6) / 24)) : 0.25),
};
export const inRiver = (x, z, m = 0) => z > -400 && Math.abs(x - RIVER.x(z)) < RIVER.halfW(z) + m;
export const ROADS = [{ x: GATE_X - 9, z: CITY.z1, w: 18, d: 4000 }, { x: -4000, z: CITY.z1 + 205, w: 8000, d: 14 }];
export const PADDIES = [{ x: GATE_X - 340, z: CITY.z1 + 110, w: 310, d: 80 }, { x: GATE_X + 26, z: CITY.z1 + 40, w: RX - 90 - GATE_X - 26, d: 150 }, { x: RX + 90, z: CITY.z1 + 40, w: 240, d: 150 }];
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
    .map((p) => ({ ...p, h: Math.round(outerBase((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2)) }));
  // a village next to a field shares its shelf (one level to walk between them)
  const nf = FIELDS.length; for (let i = nf; i < PADS.length; i++) { const p = PADS[i], cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
    let best = null, bd = 220; for (let j = 0; j < nf; j++) { const q = PADS[j], d = Math.hypot((q.x0 + q.x1) / 2 - cx, (q.z0 + q.z1) / 2 - cz); if (d < bd) { bd = d; best = q; } }
    if (best) p.h = best.h; }
  return PADS;
}
function bumpsAt(x, z) { let h = 0; for (const b of BUMPS) { const d2 = ((x - b.x) ** 2 + (z - b.z) ** 2) / (b.r * b.r); if (d2 < 4) h += b.h * Math.exp(-d2 * 1.6); } return h; }
// ---- the cliffs inside the city: the drop between two terraces runs along the middle of each block as a jagged rock
// face (its edge wanders in z, its columns are ragged), crisp only where the lift tower stands against it
export const CLIFF_W = 5;
// cargo lifts: one per cliff band, on the east side of the city, at these block columns (the cliff is straight where a lift stands against it)
export const LIFT_SPOTS = [[3, 6], [5, 7], [6, 6], [7, 6]].map(([r, c]) => ({ r, c, x: Math.round(block(c, r).x + block(c, r).w / 2), mid: (SZ[r] + SZ[r + 1]) / 2 }));
export const liftAt = (r, x) => LIFT_SPOTS.find((l) => l.r === r && Math.abs(x - l.x) < 26);
export function cliffZ(r, x) {
  const mid = (SZ[r] + SZ[r + 1]) / 2;
  if (liftAt(r, x)) return mid;
  return mid + 9 * (vnoise(x / 19, r * 7.3) - 0.5) + 4 * (vnoise(x / 6.5, r * 3.1 + 40) - 0.5);
}
export const onCliff = (r, x, z) => LV[r] !== LV[r + 1] && Math.abs(z - cliffZ(r, x)) < CLIFF_W + 9;
/** City terrace height (no river): street lines flat, block halves at their street's level, stairs on north–south streets. */
export function cityH(x, z) {
  const pb = block(...PAGODA_BLOCK);
  if (x >= pb.x - 1 && x <= pb.x + pb.w + 1 && z >= pb.z - 1 && z <= pb.z + pb.d + 1) return LV[PAGODA_BLOCK[1] + 1];
  if (z > SZ[0] + STREET / 2 && z < SZ[ROWS] - STREET / 2) {
    let r = 0; while (r < ROWS - 1 && z >= SZ[r + 1]) r++;
    const top = LV[r], bot = LV[r + 1], d = top - bot;
    if (d > 0 && Math.abs(z - SZ[r]) > STREET / 2 && Math.abs(z - SZ[r + 1]) > STREET / 2) {
      for (let c = 0; c <= COLS; c++) {
        if (VSEG[c][r] !== "street" || Math.abs(x - SX[c]) >= STAIR_HALF(c)) continue;   // a stair down the whole segment (the main avenue's is double width)
        const z0 = SZ[r] + STREET / 2, z1 = SZ[r + 1] - STREET / 2, t = Math.max(0, Math.min(1, (z - z0) / (z1 - z0)));
        return Math.round(top - d * t);
      }
      const zc = cliffZ(r, x);
      if (z < zc - CLIFF_W - 4) return top; if (z > zc + CLIFF_W + 4) return bot;
      const crisp = !!liftAt(r, x);
      if (crisp) return z < zc ? top : bot;
      const t = (z - (zc - CLIFF_W)) / (2 * CLIFF_W) + (vnoise(x / 8, z / 6) - 0.5) * 0.6 + (vnoise(x / 13, z / 4 + r) - 0.5) * 0.5;
      return Math.round(top - d * Math.max(0, Math.min(1, t)));
    }
  }
  return levelAt(z);
}
/** How far the mountain's flanks rise beside the city (0 inside its x range); they fade out toward the lowland. */
export function flankRise(x, z) {
  const dx = Math.max(CITY.x0 - 10 - x, x - CITY.x1 - 10, 0); if (dx <= 0) return 0;
  const k = 1 - sstep((z - (CITY.z1 - 160)) / 420), base = z < CITY.z0 ? LV[0] : z <= CITY.z1 ? levelAt(z) : 0;
  if (k <= 0) return 0;
  const cap = (PLATEAU + 30 - base) * k * (0.72 + 0.4 * vnoise(x / 70, z / 70));
  const raw = cap * sstep(dx / 170) + 34 * (vnoise(x / 23, z / 23) - 0.5) * sstep(dx / 30) * k;
  // break the slope into rock ledges: heights snap to steps ~26 high whose edges wander, faces get ragged columns
  const step = 26, q = step * Math.floor((raw + 14 * vnoise(x / 13, z / 13) + 6 * vnoise(x / 8, z / 8)) / step);
  const ledge = Math.max(0, Math.min(raw, q + 4 * vnoise(x / 9 + 30, z / 9)));
  return ledge + 3 * (vnoise(x / 7, z / 7) - 0.5) * sstep(dx / 20) * k;   // (low-poly: no voxel-scale raggedness)
}
/** Terrain outside the city's x range before pads/bumps: terrace or lowland level + the mountain flank. */
function outerBase(x, z) {
  const base = z < CITY.z0 ? LV[0] : z <= CITY.z1 + 12 ? levelAt(z) : LV[ROWS] * Math.max(0, 1 - (z - CITY.z1 - 12) / 28);
  return base + flankRise(x, z);
}
// ---- the zig-zag stone stair from the city's top terrace (east edge) up the flank to the NE upland village + wheat field.
// Legs run along z across the slope; each leg sits where the natural ground is about its own height, so the stair hugs
// the mountain (cut into it here, built up in masonry there). Lazily computed from the raw terrain.
let STAIR = null;
export function upStair() {
  if (STAIR) return STAIR;
  const f = FIELDS[4], top = { x: f.x - 3, z: f.z + 45 }, topY = Math.round(terrainH0(f.x + f.w / 2, f.z + f.d / 2));
  const foot = { x: CITY.x1 + 4, z: f.z + 120, y: LV[0] }, n = 6, zA = f.z + 20, zB = f.z + 92, pts = [{ ...foot }];
  let z = foot.z > (zA + zB) / 2 ? zB : zA;
  for (let k = 0; k < n; k++) {
    const y0 = LV[0] + ((topY - LV[0]) * k) / n, y1 = LV[0] + ((topY - LV[0]) * (k + 1)) / n, want = (y0 + y1) / 2;
    let best = CITY.x1 + 8, bd = 1e9; for (let x = CITY.x1 + 6; x < f.x - 10; x += 2) { const d = Math.abs(terrainH0(x, (zA + zB) / 2) - want); if (d < bd) { bd = d; best = x; } }
    const x = Math.min(f.x - 8 - (n - 1 - k) * 9, Math.max(pts[pts.length - 1].x + (k ? 9 : 22), best));   // legs ≥ 9 apart, all before the field
    pts.push({ x, z, y: y0 }); z = z === zA ? zB : zA; pts.push({ x, z, y: y1 });
  }
  pts.push({ x: top.x, z: pts[pts.length - 1].z, y: topY }, { x: top.x + 4, z: top.z, y: topY });
  return (STAIR = { pts, foot, top: pts[pts.length - 1] });
}
/** Height of the stair surface at (x, z) if it is on the stair (risers every 2 units), else null. */
export function stairH(x, z) {
  const P = upStair().pts;
  let best = null, bd = 3.6;
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L)), d = Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
    if (d < bd) { bd = d; const len = Math.sqrt(L), s = Math.floor((t * len) / 2) * 2 / Math.max(1, len); best = Math.round(a.y + (b.y - a.y) * Math.min(1, s)); } }
  return best;
}
export const onStair = (x, z, m = 0) => { const P = upStair().pts; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L)); if (Math.hypot(a.x + dx * t - x, a.z + dz * t - z) < 3.6 + m) return true; } return false; };
/** Terrain surface (what the ground mesh shows): the zig-zag stair where it runs, else the natural terrain. */
export function terrainH(x, z) {
  if (STAIR && x > CITY.x1 && x < FIELDS[4].x + 10 && z > FIELDS[4].z && z < FIELDS[4].z + 140) { const h = stairH(x, z); if (h !== null) return h; }
  return terrainH0(x, z);
}
/** Natural terrain: mountain plateau, shelf, city terraces, flanks, lowland, river channel. */
export function terrainH0(x, z) {
  let h;
  if (z < CLIFF_Z) {
    // the great cliff: four tiers whose faces wander in and out, ragged columns, narrow ledges, the plateau above
    const into = CLIFF_Z - z, wob = (k) => 10 * vnoise(x / 29 + k * 17, k * 3.1) + 6 * vnoise(x / 8 + k * 5, k);
    const tiers = [[0, LV[0] + 30], [6, LV[0] + 58], [12, LV[0] + 88], [17, LV[0] + 112], [23, LV[0] + 142], [28, LV[0] + 168], [34, LV[0] + 194], [40, LV[0] + 216]];   // many short ledges
    const jag = 8 * (vnoise(x / 9, z / 9) - 0.5) + 4 * (vnoise(x / 5 + 9, z / 5) - 0.5);   // ragged buttresses along each face
    let tierH = PLATEAU; for (const [d, th] of tiers) if (into < d + wob(d) + jag) { tierH = th + Math.round(10 * vnoise(x / 9, z / 9 + d) - 5 + 6 * (vnoise(x / 6, z / 6 + d) - 0.5)); break; }
    const edge = sstep((into - 60) / 60);
    const flat = 1 - sstep((Math.hypot(x - (GX + 40), z - (CLIFF_Z - 110)) - 90) / 40);   // the shrine's meadow stays flat
    h = Math.min(tierH, PLATEAU) + (tierH >= PLATEAU ? mountainH(x, z) * edge * (1 - flat) : 0);
    const dr = Math.abs(x - RX);
    if (dr < RIVER_HW + 2 && into < GORGE) return LV[0] - 7;                                   // the slot canyon the falls drop into
    if (dr < RIVER_HW && z > CLIFF_Z - 260) h = Math.min(h, PLATEAU - 6);                       // the river's bed on the plateau
    return Math.round(h);
  }
  const dx = Math.max(CITY.x0 - x, x - CITY.x1, 0), inCityZ = z < CITY.z1 + 40;
  if (dx === 0 && inCityZ) h = z < CITY.z0 ? LV[0] : z <= CITY.z1 + 12 ? cityH(x, z) : LV[ROWS] * Math.max(0, 1 - (z - CITY.z1 - 12) / 28);
  else {
    h = outerBase(x, z);
    if (dx > 30 || z > CITY.z1 + 40) {
      let bp = null, bo = 50; for (const p of pads()) { const ox = Math.max(p.x0 - x, x - p.x1, 0), oz = Math.max(p.z0 - z, z - p.z1, 0), o = Math.hypot(ox, oz); if (o < bo) { bo = o; bp = p; } }
      if (bp) { const w = sstep(bo / 50); h = bp.h * (1 - w) + h * w; }   // the nearest flat pad wins
      const b = bumpsAt(x, z); if (b >= 0.6 && !occupied(x, z, 1) && !bp) h += b;
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
for (let r = 0; r <= ROWS; r++) { const w = HSEG[r][RIVER_C - 1], e = HSEG[r][RIVER_C], ok = (k) => k && k !== "none"; if (ok(w) || ok(e)) BRIDGES.push({ r, x: RX, z: SZ[r], y: LV[r], half: RIVER_HW + 12 }); }
// ---- wood-and-rope transport (sim + rendering share these definitions)
// A transport is a line of stops along a rope/shaft path; cars shuttle stop to stop and back, dwelling at each.
//   path: rope points (gondolas: support tops; lifts: the shaft bottom/top), stops: [{v: path vertex, board: {x,z,y},
//   links: [[c,r],…] street junctions it walks to, via: point on the street}], cap in people (a cart counts 4).
// GONDOLA 1: market-terrace riverside station → pylons → the mountain shrine on the plateau (ox capstan below).
// GONDOLA 2: the gate terrace (bottom of the city) → a stop on the plaza terrace → the plateau, west of the river.
// LIFTS: counterweighted cargo lifts, two per cliff band, big enough for an ox cart — carts can only climb by lift.
const GB = block(RIVER_C, PLAZA_R);
export const GX = RX + 50;                                    // gondola 1 runs straight north along x = GX
// Stations are placed with rot 1 (model +x → world north): local (x, z) → world (z, −x). Low station: cable exit local
// (32, 30, 0), capstan (−12, 0, 0). High station: cable in at (−24, 30, 0), bullwheel (10.5, 19, 0). Car grip 21 above floor.
export const GONDOLA_LOW = { x: GX, z: GB.z + 40, y: LV[PLAZA_R] };
export const CAPSTAN = { x: GX, z: GONDOLA_LOW.z + 12, y: LV[PLAZA_R] };
export const GONDOLA_HIGH = { x: GX, z: CLIFF_Z - 90, y: PLATEAU };
export const SHRINE = { x: GX + 84, z: CLIFF_Z - 120, y: PLATEAU };                 // the mountain shrine on the plateau
// gondola 2
const G2B = block(2, ROWS - 1), G2M = block(2, PLAZA_R);
export const GX2 = Math.round(G2B.x + G2B.w / 2);
export const G2 = { low: { x: GX2, z: CITY.z1 + 52, y: 0 }, mid: { x: GX2, z: Math.round((SZ[PLAZA_R] + SZ[PLAZA_R + 1]) / 2), y: LV[PLAZA_R] }, high: { x: GX2, z: CLIFF_Z - 90, y: PLATEAU } };
G2.capstan = { x: GX2, z: G2.low.z + 12, y: G2.low.y };
export const PLATEAU_BRIDGE = { x: RX, z: CLIFF_Z - 100, y: PLATEAU };   // carries the plateau path over the river between the two gondolas
const gStop = (v, st, end, links, via) => ({ v, board: { x: st.x + 11, z: st.z + (end === "low" ? -14 : 12), y: st.y }, links, via });
const pylonOver = (x, r, h) => ({ x, z: Math.round(cliffZ(r, x) - 16), y: LV[r] + h, base: LV[r], h });
const G2_PYLONS = [{ x: GX2, z: SZ[ROWS], y: LV[ROWS] + 64, base: LV[ROWS], h: 64 }, pylonOver(GX2, 7, 46), pylonOver(GX2, 6, 46), pylonOver(GX2, 5, 46), pylonOver(GX2, 3, 46), { x: GX2, z: CLIFF_Z - 54, y: PLATEAU + 48, base: PLATEAU, h: 48 }];
export const TRANSPORTS = [
  { id: "gondola", kind: "gondola", name: "Gondola", cars: 2, cap: 10, speed: 13, dwell: 9, hang: 21, sag: 8, capstan: CAPSTAN, wheel: { x: GX, y: PLATEAU + 19, z: GONDOLA_HIGH.z - 10.5 },
    path: [{ x: GX, z: GONDOLA_LOW.z - 32, y: LV[PLAZA_R] + 30 }, { x: GX, z: SZ[3] + 28, y: LV[3] + 84 }, { x: GX, z: CLIFF_Z - 54, y: PLATEAU + 48 }, { x: GX, z: GONDOLA_HIGH.z + 24, y: PLATEAU + 30 }],
    pylons: [{ x: GX, z: SZ[3] + 28, y: LV[3], h: 84 }, { x: GX, z: CLIFF_Z - 54, y: PLATEAU, h: 48 }],
    stops: [gStop(0, GONDOLA_LOW, "low", [[RIVER_C, PLAZA_R], [RIVER_C + 1, PLAZA_R]], { x: GX + 11, z: SZ[PLAZA_R] }), gStop(3, GONDOLA_HIGH, "high", [], null)] },
  { id: "gondola2", kind: "gondola", name: "Mountain gondola", cars: 2, cap: 10, speed: 14, dwell: 10, hang: 21, sag: 8, capstan: G2.capstan, wheel: { x: GX2, y: PLATEAU + 19, z: G2.high.z - 10.5 },
    path: [{ x: GX2, z: G2.low.z - 32, y: G2.low.y + 30 }, ...G2_PYLONS.slice(0, 4).map((p) => ({ x: p.x, z: p.z, y: p.y })), { x: GX2, z: G2.mid.z, y: G2.mid.y + 30 }, ...G2_PYLONS.slice(4).map((p) => ({ x: p.x, z: p.z, y: p.y })), { x: GX2, z: G2.high.z + 24, y: PLATEAU + 30 }],
    pylons: G2_PYLONS.map((p) => ({ x: p.x, z: p.z, y: p.base, h: p.h })),
    stops: [gStop(0, G2.low, "low", [[2, ROWS], [3, ROWS]], { x: GX2 + 11, z: SZ[ROWS] }), { v: 5, board: { x: GX2 + 11, z: G2.mid.z + 12, y: G2.mid.y }, links: [[2, PLAZA_R], [3, PLAZA_R], [2, PLAZA_R + 1], [3, PLAZA_R + 1]], via: null }, gStop(8, G2.high, "high", [], null)] },
  ...LIFT_SPOTS.map((l, k) => ({ id: "lift" + k, kind: "elevator", name: "Cargo lift", cars: 1, cap: 10, speed: 7, dwell: 8, hang: 0, sag: 0, x: l.x, z: l.mid + 18, r: l.r, phase: k * 7.3,
    path: [{ x: l.x, z: l.mid + 18, y: LV[l.r + 1] }, { x: l.x, z: l.mid + 18, y: LV[l.r] }],
    stops: [{ v: 0, board: { x: l.x, z: l.mid + 42, y: LV[l.r + 1] }, links: [[l.c, l.r + 1], [l.c + 1, l.r + 1]], via: { x: l.x, z: SZ[l.r + 1] } },
            { v: 1, board: { x: l.x, z: l.mid - 8, y: LV[l.r] }, links: [[l.c, l.r], [l.c + 1, l.r]], via: { x: l.x, z: SZ[l.r] } }] })),
];
export const LIFTS = TRANSPORTS.filter((T) => T.kind === "elevator");
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
  { x0: GX - 10, x1: GX + 10, z0: SZ[0], z1: SZ[PLAZA_R] },                         // under gondola 1's rope
  { x0: RX - RIVER_HW - 5, x1: RX + RIVER_HW + 5, z0: CITY.z0 - 40, z1: CITY.z1 + 30 },   // the river and its banks
  { x0: GB.x - 2, x1: GB.x + GB.w + 2, z0: GB.z - 2, z1: GB.z + GB.d + 2 },          // gondola 1's lower station block
  { x0: GX2 - 12, x1: GX2 + 12, z0: SZ[0], z1: SZ[ROWS] },                           // under gondola 2's rope
  { x0: GX2 - 34, x1: GX2 + 34, z0: SZ[ROWS] - 12, z1: G2.low.z + 36 }, { x0: GX2 - 30, x1: GX2 + 30, z0: G2.mid.z - 24, z1: G2.mid.z + 26 },   // its stations
  ...LIFT_SPOTS.map((l) => ({ x0: l.x - 26, x1: l.x + 26, z0: l.mid - 20, z1: l.mid + 50 })),   // lifts + their aprons
  ...[3, 5, 6, 7].map((r) => ({ x0: SX[AV_C] - STREET - 2, x1: SX[AV_C] + STREET + 2, z0: SZ[r], z1: SZ[r + 1] })),   // the grand stair
  { x0: block(1, 6).x + 8, x1: block(1, 6).x + 32, z0: block(1, 6).z + 2, z1: block(1, 6).z + 28 },   // the district's mooring mast
];
export const isReserved = (x0, z0, x1, z1) => RESERVED.some((r) => x1 > r.x0 && x0 < r.x1 && z1 > r.z0 && z0 < r.z1);
// path arc lengths + per-stop s, cached on each transport
function geom(T) {
  if (T._g) return T._g;
  const P = T.path, L = []; let tot = 0; for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y, P[i].z - P[i - 1].z); L.push(l); tot += l; }
  const cum = [0]; for (const l of L) cum.push(cum[cum.length - 1] + l);
  const ss = T.stops.map((st) => cum[st.v] / tot), legs = []; for (let i = 0; i < ss.length - 1; i++) legs.push(Math.max(4, (cum[T.stops[i + 1].v] - cum[T.stops[i].v]) / T.speed));
  // timeline: dwell@0, leg 0→1, dwell@1, …, dwell@n-1, leg n-1→n-2, dwell@n-2, …, leg 1→0
  const seq = [], n = ss.length; let t = 0;
  for (let i = 0; i < n; i++) { seq.push({ t, d: T.dwell, dock: i, next: i < n - 1 ? 1 : -1 }); t += T.dwell; if (i < n - 1) { seq.push({ t, d: legs[i], a: ss[i], b: ss[i + 1] }); t += legs[i]; } }
  for (let i = n - 1; i > 0; i--) { seq.push({ t, d: legs[i - 1], a: ss[i], b: ss[i - 1] }); t += legs[i - 1]; if (i - 1 > 0) { seq.push({ t, d: T.dwell, dock: i - 1, next: -1 }); t += T.dwell; } }
  return (T._g = { L, tot, ss, seq, period: t });
}
/** Where car k is at time t: {s 0..1 along the path, dock: stop index | null, next: direction (+1/-1) it leaves in, rem: s left docked}. */
export function carState(T, k, t) {
  const g = geom(T), u = ((((t + (T.phase ?? 0)) + (k * g.period) / T.cars) % g.period) + g.period) % g.period, ease = (v) => v * v * (3 - 2 * v);
  for (const q of g.seq) if (u < q.t + q.d) return q.dock !== undefined ? { s: g.ss[q.dock], dock: q.dock, next: q.next, rem: q.t + q.d - u } : { s: q.a + (q.b - q.a) * ease((u - q.t) / q.d), dock: null, dir: Math.sign(q.b - q.a) };
  return { s: 0, dock: 0, next: 1, rem: 0 };
}
/** Point on a transport's rope/shaft at s (gondola spans sag between supports); y is the car's floor. */
export function carPos(T, s) {
  const g = geom(T), P = T.path;
  let d = s * g.tot, i = 0; while (i < g.L.length - 1 && d > g.L[i]) { d -= g.L[i]; i++; }
  const u = Math.max(0, Math.min(1, d / g.L[i])), a = P[i], b = P[i + 1];
  return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, y: a.y + (b.y - a.y) * u - T.sag * Math.sin(Math.PI * u) - T.hang, rope: a.y + (b.y - a.y) * u - T.sag * Math.sin(Math.PI * u) };
}

BRIDGES.push({ r: -1, x: PLATEAU_BRIDGE.x, z: PLATEAU_BRIDGE.z, y: PLATEAU, half: RIVER_HW + 12 });
/** Walking height: the terrain, except on bridges (deck level). */
export function groundH(x, z) {
  for (const b of BRIDGES) if (Math.abs(x - b.x) <= b.half && Math.abs(z - b.z) <= STREET / 2) return b.y;
  return terrainH(x, z);
}

// ---- palettes for building variants
export const ROOFS = ["#3a9ab0", "#2f7fc8", "#3aa060", "#d8683a", "#c8463a", "#6a7fa0", "#2aa890", "#7a5ac0"];
export const WALLS = ["#f6e8c8", "#fbf2dc", "#f0dcb4", "#eae4d4"];
export const PILLARS = ["#d0402e", "#b8302a", "#e0502e"];
export const CLOTHS = ["#e04a3a", "#3a6ad8", "#3aa060", "#f0b830", "#8a4ab0"];
/** Per-instance colour slots for a model (roof / wall / pillar / cloth); unset slots keep the model's own colours. */
export function variantRemap(o = {}) { return { roof: o.roof ?? null, wall: o.wall ?? null, pillar: o.pillar ?? null, cloth: o.cloth ?? null }; }

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
// every model exists in the polygon edition (kept so the layout code reads like the voxel one)
export function setAvailableModels() {}
export const hasModel = () => true;
const MODELS_EXTRA = { has: () => true };
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
        const mid = b.z + b.d / 2, backLimit = south ? Math.max(b.z, mid + 14, ...opp.map((q) => q.z1 + 2)) : Math.min(b.z + b.d, mid - 14, ...opp.map((q) => q.z0 - 2));   // z the back may reach (never past the retaining wall in the middle)
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
    const side = () => (chance(0.5) ? 1 : -1) * rnd(15, 19);   // the middle of the block is the retaining wall: keep things on one terrace
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
      for (let zz = south ? b.z + 6 : b.z + 26; south ? zz < b.z + b.d - 26 : zz < b.z + b.d - 6; zz += 11) if (!onCliff(r, x, zz)) tree(x + rnd(-4, 4), zz, ["bamboo", "tree_blossom", "tree_pine", "tree_round"]);
    } else { for (let zz = b.z + 6; zz < b.z + b.d - 4; zz += 10) if (!onCliff(r, x, zz)) tree(x + rnd(-5, 5), zz, ["bamboo", "tree_blossom", "tree_round", "tree_fruit"]); if (!onCliff(r, x, b.z + b.d / 2)) put("well", x, b.z + b.d / 2, 0); }
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
  if (has("bridge_stone")) for (const b of BRIDGES) for (const dx of [-26, 0, 26]) put("bridge_stone", b.x + dx, b.z, 0, { y: b.y - 10 });   // three arches span the wide river
  if (has("gondola_station_low")) { put("gondola_station_low", GONDOLA_LOW.x, GONDOLA_LOW.z, 1); for (const dz of [-30, -20, -10]) ob(GX, GONDOLA_LOW.z + dz, 6); }
  if (has("gondola_station_high")) put("gondola_station_high", GONDOLA_HIGH.x, GONDOLA_HIGH.z, 1);
  // cargo lifts: a stack of shaft sections from the lower terrace up the cliff (scaled to fit the drop exactly), the head gantry on the clifftop
  for (const T of LIFTS) { const bot = T.path[0].y, top = T.path[1].y, n = Math.max(1, Math.round((top - bot) / 30)), sec = (top - bot) / n;
    if (has("cargo_lift_section")) { for (let k = 0; k < n; k++) { const st = put("cargo_lift_section", T.x, T.z, 0, { y: bot + sec * k }); st.scale = [1, sec / 30, 1]; } if (has("cargo_lift_head")) put("cargo_lift_head", T.x, T.z, 0, { y: top }); }
    else if (has("elevator_tower")) for (let k = 0; k < n; k++) { const st = put("elevator_tower", T.x, T.z, 0, { y: bot + sec * k }); st.scale = [3.2, sec / 30, 3.2]; }
    for (const sx of [-1, 1]) ob(T.x + sx * 21, T.z, 3); }
  // gondola 2: ox-hauled bottom station on the gate terrace, a stop on the plaza terrace, the top station on the plateau, and a bridge over the river up there
  if (has("gondola_station_low")) { put("gondola_station_low", G2.low.x, G2.low.z, 1); for (const dz of [-30, -20, -10]) ob(GX2, G2.low.z + dz, 6); }
  if (has("gondola_station_high")) { put("gondola_station_high", G2.mid.x, G2.mid.z, 1); put("gondola_station_high", G2.high.x, G2.high.z, 1); }
  if (has("bridge_stone")) for (const dx of [-26, 0, 26]) put("bridge_stone", PLATEAU_BRIDGE.x + dx, PLATEAU_BRIDGE.z, 0, { y: PLATEAU - 10 });
  put("pagoda", SHRINE.x, SHRINE.z, 0); for (const sx of [-1, 1]) if (has("lion_statue")) put("lion_statue", SHRINE.x + sx * 12, SHRINE.z + 24, 0);
  if (has("incense_burner")) put("incense_burner", SHRINE.x, SHRINE.z + 34, 0);
  for (let k = 0; k < 16; k++) { const a = k / 16 * 6.28, d = rnd(58, 80); tree(SHRINE.x + Math.cos(a) * d, SHRINE.z + Math.sin(a) * d * 0.8, ["tree_pine", "tree_pine", "tree_blossom", "bamboo"]); }
  if (has("mooring_mast")) for (const m of MASTS) { put("mooring_mast", m.x, m.z, 0); ob(m.x, m.z, 4); }
  // lantern posts on the stair's landings
  { const P = upStair().pts; for (let i = 2; i < P.length - 2; i += 2) put("lantern_post", P[i].x + 5, P[i].z, 0, { y: terrainH(P[i].x, P[i].z) }); }
  // ---- city walls (24 tall): 22-long segments, towers at corners and along the sides, gate in the south wall
  // walls follow the terraces: each segment sits at the lower of its two ends (the uphill end is buried, never floating)
  const lowAt = (pts) => Math.min(...pts.map(([x, z]) => terrainH(x, z)));
  // where the mountain flank rises right beside the city it is the wall: no masonry needed there
  const mountainWall = (x, z) => flankRise(x < (CITY.x0 + CITY.x1) / 2 ? CITY.x0 - 70 : CITY.x1 + 70, z) > 45;
  for (let x = CITY.x0 - 9; x < CITY.x1 + 9; x += 22) { const cx = x + 11; if (Math.abs(cx - RX) < 62) continue;
    if (!mountainWall(cx, CITY.z0 - 1)) put("wall", cx, CITY.z0 - 1, 0, { y: lowAt([[cx - 11, CITY.z0 - 1], [cx + 11, CITY.z0 - 1]]) });
    if (Math.abs(cx - GATE_X) >= 26 && Math.abs(cx - GX2) >= 22) put("wall", cx, CITY.z1 + 1, 2, { y: lowAt([[cx - 11, CITY.z1 + 1], [cx + 11, CITY.z1 + 1]]) }); }
  for (let z = CITY.z0 - 9; z < CITY.z1 + 9; z += 22) for (const [x, rot] of [[CITY.x0 - 1, 1], [CITY.x1 + 1, 3]]) {
    const pts = [[x, z], [x, z + 22]];
    if (pts.some(([px, pz]) => mountainWall(px, pz)) || Math.abs(terrainH(x, z) - terrainH(x, z + 22)) > 20) continue;   // the mountain (or a terrace cliff) does the job
    put("wall", x, z + 11, rot, { y: lowAt(pts) }); }
  // where the wide river passes through the walls: three arched water gates side by side
  if (MODELS_EXTRA.has("water_gate")) for (const [z, rot] of [[CITY.z0 - 1, 0], [CITY.z1 + 1, 2]]) for (const dx of [-40, 0, 40]) put("water_gate", RX + dx, z, rot, { y: lowAt([[RX - 60, z], [RX + 60, z]]) });
  else for (const [z, rot] of [[CITY.z0 - 1, 0], [CITY.z1 + 1, 2]]) for (const dx of [-50, -28, 28, 50]) put("wall", RX + dx, z, rot, { y: lowAt([[RX + dx - 11, z], [RX + dx + 11, z]]) });
  put("city_gate", GATE_X, CITY.z1 + 5, 0);
  const zA = SZ[3], zB = SZ[6], TX = [SX[2], SX[6]];
  for (const [x, z] of [[CITY.x0 - 14, CITY.z0 - 14], [CITY.x1 + 14, CITY.z0 - 14], [CITY.x0 - 14, CITY.z1 + 14], [CITY.x1 + 14, CITY.z1 + 14],
    [TX[0], CITY.z0 - 14], [TX[1], CITY.z0 - 14], [TX[0], CITY.z1 + 14], [TX[1], CITY.z1 + 14], [CITY.x0 - 14, zA], [CITY.x1 + 14, zA], [CITY.x0 - 14, zB], [CITY.x1 + 14, zB]]) { if (mountainWall(x, z) || Math.abs(x - RX) < 50) continue; const ty = lowAt([[x - 9, z - 9], [x + 9, z - 9], [x - 9, z + 9], [x + 9, z + 9]]); put("tower", x, z, 0, { y: ty }); towers.push({ x, z, y: ty }); }
  const beats = [ // sentry walking ranges on the wall walkways that still exist, between towers
    ...[[CITY.x0 + 2, TX[0] - 18], [TX[0] + 18, TX[1] - 18], [TX[1] + 18, CITY.x1 - 2]].flatMap(([a0, a1]) => [[a0, Math.min(a1, RX - 64)], [Math.max(a0, RX + 64), a1]]).filter(([a0, a1]) => a1 - a0 > 30 && !mountainWall(a0, WALL.n) && !mountainWall(a1, WALL.n)).map(([a0, a1]) => ({ ax: "x", a0, a1, fixed: WALL.n })),
    ...[[CITY.x0 + 2, TX[0] - 18], [TX[0] + 18, GATE_X - 30], [GATE_X + 30, TX[1] - 18], [TX[1] + 18, CITY.x1 - 2]].flatMap(([a0, a1]) => [[a0, Math.min(a1, RX - 64)], [Math.max(a0, RX + 64), a1]]).filter(([a0, a1]) => a1 - a0 > 30).map(([a0, a1]) => ({ ax: "x", a0, a1, fixed: WALL.s })),
    ...[[CITY.z0 + 2, zA - 18], [zA + 18, zB - 18], [zB + 18, CITY.z1 - 2]].flatMap(([a0, a1]) => [{ ax: "z", a0, a1, fixed: WALL.w }, { ax: "z", a0, a1, fixed: WALL.e }])
      .filter((b) => { for (let z = b.a0; z <= b.a1; z += 11) if (mountainWall(b.fixed, z) || Math.abs(terrainH(b.fixed, z) - terrainH(b.fixed, b.a0)) > 6) return false; return true; }),
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

export function hash(x, z) { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); }

/** Voxel mountains beyond the river (2-voxel columns), reaching far past both edges of the world. */
// Mountain range north of the river: irregular peaks (seeded, so the layout is stable) — a tall back range and
// lower foothills in front, each peak with its own height, width, slope and ridge direction, plus smooth noise.
export function vnoise(x, z) { // value noise, smooth in x and z, 0..1
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
export function mountainH(x, z) {
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
export const ROCK = ["#8c8e92", "#797b80", "#9a9ca0", "#6c6e74", "#84868b", "#a6a8aa", "#90908c"];

