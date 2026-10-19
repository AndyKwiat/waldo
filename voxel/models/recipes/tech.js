// Mountain-city technology: stone bridge, water gate, rope-and-pulley machinery (bullwheel, ox capstan,
// gondola stations + car, cliff elevator + cage), airships and a mooring mast. Primitive wood, rope and iron.
// Coordinates: cell i of a grid S covers local [i - S/2, i - S/2 + 1] in x/z; y = 0 at the grid floor
// (pulley_wheel is pivot "center"). Attachment points are documented per model (local units, see the comments).
import { G, rng, figure } from "./lib.js";
import { M, ROOF, PILLAR, CLOTH, roofRamp, colRamp, clothRamp } from "./colors.js";
import { hipRoof } from "./buildings.js";

const C = colRamp(PILLAR), CL = clothRamp(CLOTH);
const ROPE = "#d4b27a", ROPED = "#a88550", IRON = "#4e4c58", IRONL = "#6e6c7a", IROND = "#36343e";
const EARTH = "#a07e54", EARTHD = "#86663e", EARTHL = "#b89468", MOSS = "#6a9a58";
const BAR = "#6a4424";

/** Sets every cell of the box for which inside() holds and that has a face neighbour outside (a hollow solid). */
function surf(g, x0, y0, z0, x1, y1, z1, inside, col) {
  const In = (x, y, z) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1 && inside(x, y, z);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (!In(x, y, z)) continue;
    if (!In(x + 1, y, z) || !In(x - 1, y, z) || !In(x, y + 1, z) || !In(x, y - 1, z) || !In(x, y, z + 1) || !In(x, y, z - 1)) g.set(x, y, z, col(x, y, z));
  }
}
/** Every cell whose centre lies within [r0, r1) of the axis through (cu, cv) (mesh units, i.e. cell centre = i + 0.5). */
function cyl(g, axis, cu, cv, r0, r1, a0, a1, col) {
  const R = Math.ceil(r1) + 1;
  for (let a = a0; a <= a1; a++) for (let u = Math.floor(cu - R); u <= cu + R; u++) for (let v = Math.floor(cv - R); v <= cv + R; v++) {
    const du = u + 0.5 - cu, dv = v + 0.5 - cv, r = Math.hypot(du, dv); if (r < r0 || r >= r1) continue;
    const c = typeof col === "function" ? col(du, dv, a, r) : col;
    if (axis === "y") g.set(u, a, v, c); else if (axis === "z") g.set(u, v, a, c); else g.set(a, u, v, c);
  }
}
const ashlar = (rnd) => (x, y, z) => (y % 3 === 2 ? M.stoneD : (x + z + (Math.floor(y / 3) % 2) * 3) % 6 === 0 ? M.stoneD : rnd() < 0.18 ? M.stoneL : M.stone);
const brick = (rnd) => (x, y, z) => (y % 3 === 0 ? M.brickD : ((x + z + (y % 6 < 3 ? 0 : 3)) % 6 === 0 ? M.brickD : rnd() < 0.12 ? M.brickL : M.brick));
/** Hanging lantern: hook at y, glowing body y-1..y-2, gold tassel y-3. */
function lantern(g, x, y, z) { g.set(x, y, z, M.goldD); g.set(x, y - 1, z, M.lantern); g.set(x, y - 2, z, M.lantern); g.set(x, y - 3, z, M.gold); }
/** Rope line with a twisted two-tone look. */
function rope(g, x0, y0, z0, x1, y1, z1) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1); for (let i = 0; i <= n; i++) g.set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, z0 + (z1 - z0) * i / n, i % 3 === 2 ? ROPED : ROPE); }
/** Railing along x or z: posts every `step`, top rail at y0 + h. */
function rail(g, axis, a0, a1, y0, k, h = 3, step = 3) {
  for (let a = a0; a <= a1; a++) { const p = (a - a0) % step === 0 || a === a1; const top = y0 + h;
    for (let y = y0; y <= top; y++) if (p || y === top || y === y0 + 1) { const c = y === top ? M.woodL : p ? M.woodD : M.wood; if (axis === "x") g.set(a, y, k, c); else g.set(k, y, a, c); } }
}
/** Plank deck (top face at y + 1), planks running along `along`. */
function deck(g, x0, x1, z0, z1, y, along = "z") { g.box(x0, y, z0, x1, y, z1, (x, yy, z) => { const a = along === "z" ? x : z; return a % 4 === 3 ? M.woodD : a % 2 ? M.wood : M.woodL; }); }
function crate(g, x, y, z, n) { g.box(x, y, z, x + n, y + n, z + n, (xx, yy, zz) => ((xx === x || xx === x + n) && (yy === y || yy === y + n || zz === z || zz === z + n) || (yy === y || yy === y + n) && (zz === z || zz === z + n) ? M.woodD : M.woodL)); }
function flagTo(g, x, y, z, len, h, c1, c2) { for (let i = 0; i < len; i++) { const hh = Math.max(1, Math.round(h * (1 - i / len))); for (let k = 0; k < hh; k++) g.set(x + i, y - k, z, (i + k) % 4 === 0 ? c2 : c1); } }

// ---------------------------------------------------------------------------------------------------------------
/** Arched stone bridge. Deck x −13..+13, z −11..+11, walk surface at y = 10; arch x −9..+9 down to y = 0. */
export function bridgeStone() {
  const S = 32, g = new G(S), rnd = rng(101), c = 16;
  const arch = (x, y) => Math.hypot(x + 0.5 - c, y + 0.5) < 9;
  const ash = ashlar(rnd);
  surf(g, 3, 0, 5, 28, 9, 26, (x, y) => !arch(x, y), (x, y, z) => {
    const xc = x + 0.5 - c, r = Math.hypot(xc, y + 0.5), face = z === 5 || z === 26;
    if (y === 9 && !face) { // paving
      if (z === 6 || z === 25) return x % 2 ? M.stone : M.stoneD;
      if (z === 15 || z === 16) return x % 3 === 0 ? M.stone : "#d6d2c6";
      return z % 4 === 1 || (x + (Math.floor(z / 4) % 2) * 2) % 5 === 0 ? M.stone : rnd() < 0.3 ? M.brickL : M.stoneL;
    }
    if (face && r >= 11.3 && r < 12) return M.stoneD;
    if (face && r < 11.3) { const seg = Math.floor((Math.atan2(y + 0.5, xc) / Math.PI) * 15); return seg === 7 ? "#e4e0d4" : seg % 2 ? M.stoneL : "#d8d4c8"; }
    if (r < 9.8 && Math.abs(xc) < 9.5) return y <= 1 && rnd() < 0.4 ? MOSS : (z % 4 === 0 || Math.floor(Math.atan2(y + 0.5, xc) * 9) % 2 ? M.stoneD : M.stone); // vault
    if (face && y <= 1 && rnd() < 0.35) return MOSS;
    return ash(x, y, z);
  });
  // parapets along both z edges (2 high), posts, lion posts at the ends, stone lanterns in the middle
  for (const z of [5, 26]) {
    for (let x = 3; x <= 28; x++) { g.set(x, 10, z, (x - 3) % 6 === 0 ? M.stoneD : M.stone); g.set(x, 11, z, M.stoneL); }
    for (const x of [9, 22]) { g.box(x, 10, z, x, 11, z, M.stoneL); g.set(x, 12, z, "#d8d4c8"); }
    for (const x0 of [3, 27]) { g.box(x0, 10, z, x0 + 1, 12, z, M.stoneL); g.box(x0, 13, z, x0 + 1, 13, z, M.stone);
      // little stone lion facing out along x, red ball
      const out = x0 === 3 ? x0 : x0 + 1, inn = x0 === 3 ? x0 + 1 : x0;
      g.set(out, 14, z, M.stoneL); g.set(inn, 14, z, M.stoneL); g.set(out, 15, z, M.stoneL); g.set(inn, 15, z, M.goldD); g.set(inn, 16, z, M.goldD); g.set(out, 16, z, M.stoneL);
      g.set(out + (x0 === 3 ? -1 : 1), 15, z, M.ink); g.set(out + (x0 === 3 ? -1 : 1), 14, z, M.red); }
    g.box(15, 10, z, 16, 12, z, M.stoneL); g.box(15, 13, z, 16, 13, z, M.stoneD);
    g.box(15, 14, z, 16, 15, z, M.lantern); g.box(15, 16, z, 16, 16, z, M.stoneD); g.set(z === 5 ? 15 : 16, 17, z, M.gold);
  }
  // name plaques on the outer faces above the keystone
  for (const z of [4, 27]) for (let x = 13; x <= 18; x++) g.set(x, 9, z, x === 15 || x === 16 ? M.gold : M.plaque);
  return g;
}

/** City wall section with an arched water opening and a half-raised portcullis. Walkway at y = 24. */
export function waterGate() {
  const S = 40, g = new G(S), rnd = rng(102), c = 20, br = brick(rnd);
  const open = (x, y) => { const xc = x + 0.5 - c; return Math.abs(xc) < 9 && (y < 5 || Math.hypot(xc, y + 0.5 - 5) < 9); };
  surf(g, 0, 0, 16, 39, 23, 24, (x, y) => !open(x, y), (x, y, z) => {
    const xc = x + 0.5 - c, face = z === 16 || z === 24, r = Math.hypot(xc, y + 0.5 - 5);
    if (y === 23 && !face) return M.stoneL;
    if (open(x, y + 1) || open(x + 1, y) || open(x - 1, y)) return z === 20 ? IROND : (z + y) % 3 === 0 ? M.stoneD : M.stone; // intrados + groove
    if (face && ((y >= 5 && r < 11.3) || (y < 5 && Math.abs(xc) < 11))) { const seg = Math.floor((Math.atan2(y + 0.5 - 5, xc) / Math.PI) * 13); return y >= 5 && seg === 6 ? "#e4e0d4" : y < 5 ? (y % 2 ? M.stoneL : M.stone) : seg % 2 ? M.stoneL : M.stone; }
    if (face && y <= 1) return rnd() < 0.4 ? MOSS : M.stoneD;
    return br(x, y, z);
  });
  for (let x = 0; x <= 39; x += 2) for (const z of [16, 24]) { g.set(x, 24, z, M.brick); g.set(x, 25, z, M.brickL); }
  for (const x of [4, 35]) for (const z of [16, 24]) g.box(x, 14, z, x, 17, z, M.ink);
  // portcullis: wooden grate with iron bands and spikes, bottom at y = 7 (half raised)
  for (let x = 11; x <= 28; x++) for (let y = 6; y <= 15; y++) {
    if (!open(x, y)) continue; const vb = (x - 11) % 3 === 1;
    if (y === 6) { if (vb) g.set(x, y, 20, IRONL); continue; }
    if (vb) g.set(x, y, 20, BAR); else if ((y - 7) % 3 === 0) g.set(x, y, 20, IRON);
  }
  for (let x = 11; x <= 28; x++) if (open(x, 7) && (x - 11) % 3 !== 1) g.set(x, 7, 20, IRON);
  // plaques + lanterns on both faces
  for (const [z, d] of [[25, 1], [15, -1]]) {
    for (let x = 17; x <= 22; x++) for (let y = 18; y <= 19; y++) g.set(x, y, z, (x === 19 || x === 20) && y === 18 ? M.gold : M.plaque);
    for (const x of [8, 31]) { g.set(x, 17, z, M.woodD); g.set(x, 17, z + d, M.woodD); lantern(g, x, 16, z + d); }
  }
  // windlass hut on the walkway that hauls the grate
  for (const x of [13, 26]) g.box(x, 24, 20, x, 27, 20, M.woodD);
  for (let x = 14; x <= 25; x++) { g.set(x, 26, 20, x % 2 ? ROPE : ROPED); g.set(x, 27, 20, x === 14 || x === 25 ? M.woodD : x % 2 ? ROPED : ROPE); }
  for (const x of [12, 27]) { g.set(x, 27, 20, IRON); g.set(x, 28, 20, IRON); g.set(x, 28, 21, M.woodL); }
  for (const x of [16, 23]) { g.box(x, 24, 21, x, 25, 21, ROPE); g.set(x, 23, 21, IROND); }
  for (let x = 15; x <= 24; x++) g.set(x, 23, 20, IROND);
  for (const [x, z] of [[11, 17], [28, 17], [11, 23], [28, 23]]) g.box(x, 24, z, x, 29, z, (xx, y) => (y === 29 ? C.d : C.base));
  for (let x = 11; x <= 28; x++) for (const z of [17, 23]) g.set(x, 29, z, x % 3 === 0 ? M.gold : M.beam);
  hipRoof(g, 9, 30, 15, 25, 30, { zs: [1, 1, 1], xs: [1, 1, 1] });
  return g;
}

/** Big wooden bullwheel, pivot centre, axle along z (rotate about z). Rope groove radius ≈ 10–11.6, flanges to 12.6. */
export function pulleyWheel() {
  const S = 28, g = new G(S), m = 14;
  // grooved rim: flanges at z 11 & 16, groove floor, rope wrap in the groove
  const strap = (du, dv) => { const t = ((Math.atan2(dv, du) / (2 * Math.PI)) * 8 + 8.5) % 1; return t < 0.12 || t > 0.88; };
  for (const z of [11, 16]) cyl(g, "z", m, m, 9, 12.6, z, z, (du, dv, a, r) => (strap(du, dv) ? (r > 11.9 ? IRONL : IRON) : r > 11.9 ? M.wood : Math.floor((Math.atan2(dv, du) / Math.PI) * 8 + 8) % 2 ? M.woodD : "#6a4426"));
  cyl(g, "z", m, m, 8, 10, 12, 15, (du, dv, a, r) => (r < 9 ? M.woodD : M.wood));
  cyl(g, "z", m, m, 10, 11.6, 12, 15, (du, dv, a) => ((Math.floor((Math.atan2(dv, du) / Math.PI) * 24 + 48) + a) % 3 === 0 ? ROPED : ROPE));
  // iron straps across the rim
  // spokes
  for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2, cx = Math.cos(t), sy = Math.sin(t);
    for (let x = 0; x < S; x++) for (let y = 0; y < S; y++) { const du = x + 0.5 - m, dv = y + 0.5 - m, along = du * cx + dv * sy, off = Math.abs(-du * sy + dv * cx);
      if (along > 2.5 && along < 8.5 && off < 0.75) for (const z of [13, 14]) g.set(x, y, z, along > 7.3 ? M.woodD : (k % 2 ? M.woodL : M.wood)); } }
  // iron hub with gold bolts, axle
  cyl(g, "z", m, m, 0, 3.3, 11, 16, (du, dv, a, r) => (r > 2.6 ? IRON : a === 11 || a === 16 ? IRONL : IRON));
  for (const [x, y] of [[12, 12], [15, 12], [12, 15], [15, 15]]) for (const z of [10, 17]) g.set(x, y, z, M.gold);
  cyl(g, "z", m, m, 0, 1.2, 9, 18, (du, dv, a) => (a === 9 || a === 18 ? IRONL : IROND));
  return g;
}

/** Ox capstan: upright rope drum on an iron pivot, two crossed sweep beams (radius 16) at y 6–7. Rotates about y. */
export function capstan() {
  const S = 40, g = new G(S), m = 20;
  cyl(g, "y", m, m, 0, 1.6, 0, 1, IROND); cyl(g, "y", m, m, 1.6, 2.4, 1, 1, IRON);
  cyl(g, "y", m, m, 0, 3.2, 2, 11, (du, dv, y, r) => {
    if (y === 2 || y === 11) return r > 2.6 ? IRON : M.woodD;
    if (y === 6 || y === 7) return M.woodD;
    const k = Math.floor((Math.atan2(dv, du) / Math.PI) * 6 + 12); return (k + y) % 3 === 0 ? ROPED : ROPE; });
  cyl(g, "y", m, m, 3.2, 4.2, 2, 2, M.woodD); cyl(g, "y", m, m, 3.2, 4.2, 11, 11, M.woodD);
  cyl(g, "y", m, m, 0, 2.4, 12, 12, IRON); g.box(19, 13, 19, 20, 13, 20, M.gold); g.box(19, 14, 19, 20, 14, 20, CL.d);
  // sweep beams (2×2), crossing inside the drum
  const beam = (a, y, b) => (a === 5 || a === 34 ? IRON : y === 6 ? M.woodD : (a + b) % 7 === 0 ? M.wood : M.woodL);
  g.box(4, 6, 19, 35, 7, 20, (x, y, z) => beam(x, y, z)); g.box(19, 6, 4, 20, 7, 35, (x, y, z) => beam(z, y, x));
  // braces from drum top to each arm, harness straps + red tassels at the beam ends
  for (const s of [1, -1]) for (const w of [19, 20]) {
    const a0 = s > 0 ? 23 : 16, a1 = s > 0 ? 29 : 10;
    g.line(a0, 10, w, a1, 8, w, M.wood); g.line(w, 10, a0, w, 8, a1, M.wood);
  }
  for (const a of [5, 34]) for (const w of [19, 20]) { g.box(a, 8, w, a, 9, w, M.woodD); g.box(w, 8, a, w, 9, a, M.woodD); }
  for (const a of [6, 33]) { g.box(a, 3, 19, a, 5, 19, ROPE); g.box(a, 3, 20, a, 5, 20, ROPED); g.box(19, 3, a, 19, 5, a, ROPE); g.box(20, 3, a, 20, 5, a, ROPED);
    g.set(a, 2, 19, IRONL); g.set(a, 2, 20, IRONL); g.set(19, 2, a, IRONL); g.set(20, 2, a, IRONL); }
  for (const a of [4, 35]) { g.set(a, 5, 19, CLOTH); g.set(a, 4, 19, CLOTH); g.set(19, 5, a, CLOTH); g.set(19, 4, a, CLOTH); }
  return g;
}

/** Ground gondola station: ox track ring (capstan centre at local (−12, 0, 0)), platform at y = 6, A-frame cable tower. */
export function gondolaStationLow() {
  const S = 64, g = new G(S), rnd = rng(105);
  const RX = 20, RZ = 32; // ring centre in mesh units → local (−12, 0)
  // packed-earth ox track, curbs, ruts, hoof marks; rope trench cover across the ring
  for (let x = 0; x < S; x++) for (let z = 0; z < S; z++) { const r = Math.hypot(x + 0.5 - RX, z + 0.5 - RZ); if (r < 12.5 || r >= 18.2) continue;
    let c = r >= 17.4 ? ((x + z) % 3 ? M.stoneD : M.stone) : r < 13.2 ? ((x + z) % 2 ? M.stone : M.stoneD)
      : Math.abs(r - 14.8) < 0.45 || Math.abs(r - 16.3) < 0.45 ? EARTHD : rnd() < 0.12 ? EARTHD : rnd() < 0.2 ? EARTHL : EARTH;
    if (z >= 30 && z <= 33 && x > RX) c = x % 2 ? M.woodD : M.wood;
    g.set(x, 0, z, c); }
  // haul rope from the drum, through the trench, under the platform, up the tower, over the sheave, out +x
  const R2 = (x0, x1, y0, y1) => { for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) for (const z of [31, 32]) g.set(x, y, z, (x + y) % 3 === 0 ? ROPED : ROPE); };
  R2(24, 32, 1, 2); R2(39, 57, 1, 2);
  for (let y = 1; y <= 27; y++) for (const x of [56, 57]) for (const z of [31, 32]) g.set(x, y, z, (y + x) % 3 === 0 ? ROPED : ROPE);
  for (const [x, y] of [[33, 1], [38, 1], [55, 0], [58, 0]]) for (const z of [30, 33]) g.set(x, y, z, IRON); // trench lips + guide block
  // platform x 38..63 (local +6..+31), z 24..39 (local −8..+7), walk surface y = 6
  deck(g, 38, 63, 24, 39, 5, "z");
  for (let x = 38; x <= 63; x++) for (const z of [24, 39]) g.set(x, 4, z, M.woodD);
  for (let x = 38; x <= 63; x += 5) g.box(x, 4, 25, x, 4, 38, M.woodD);
  for (const x of [38, 43, 48, 53, 58, 63]) for (const z of [24, 28, 35, 39]) { g.set(x, 0, z, M.stone); g.box(x, 1, z, x, 4, z, M.woodD); }
  for (const z of [24, 39]) for (const x of [38, 48, 58]) g.line(x, 1, z, x + 4, 4, z, M.wood);
  for (let x = 56; x <= 57; x++) for (const z of [31, 32]) for (const y of [4, 5]) g.set(x, y, z, (x + y) % 2 ? ROPE : ROPED);
  rail(g, "x", 38, 63, 6, 24); rail(g, "z", 24, 39, 6, 38); rail(g, "x", 38, 43, 6, 39); rail(g, "x", 48, 63, 6, 39);
  // gate posts at the boarding end (+x)
  for (const z of [24, 39]) { g.box(63, 6, z, 63, 12, z, (x, y) => (y === 12 ? C.d : C.base)); }
  // stairs down on the +z side (x 44..47), steps rising toward the deck
  for (let k = 0; k <= 5; k++) { const z = 45 - k; g.box(44, 0, z, 47, k, z, (x, y) => (y === k ? (x % 2 ? M.woodL : M.wood) : M.woodD)); }
  for (const z of [40, 41]) g.box(44, 0, z, 47, 5, z, (x, y) => (y === 5 ? M.woodL : M.woodD));
  for (const x of [43, 48]) { for (let k = 0; k <= 5; k++) g.box(x, k, 45 - k, x, k + 1, 45 - k, M.woodD); g.line(x, 4, 46, x, 9, 41, M.woodL); g.box(x, 6, 40, x, 9, 40, M.woodD); }
  // roofed waiting hall
  for (const [x, z] of [[39, 25], [39, 38], [51, 25], [51, 38], [45, 25], [45, 38]]) g.box(x, 6, z, x, 13, z, (xx, y) => (y === 13 ? C.d : C.base));
  for (let x = 39; x <= 51; x++) for (const z of [25, 38]) { g.set(x, 13, z, x % 3 === 0 ? M.gold : M.beam); }
  for (let z = 25; z <= 38; z++) for (const x of [39, 51]) g.set(x, 13, z, z % 3 === 0 ? M.gold : M.beam);
  hipRoof(g, 36, 54, 22, 41, 14, { pearl: true });
  lantern(g, 39, 12, 39); lantern(g, 51, 12, 39); lantern(g, 39, 12, 24); lantern(g, 51, 12, 24);
  g.box(41, 6, 26, 44, 7, 26, M.woodD); g.box(41, 6, 37, 44, 7, 37, M.woodD); // benches
  crate(g, 47, 6, 26, 2); crate(g, 47, 6, 29, 2); crate(g, 48, 9, 27, 1);
  for (let x = 41; x <= 49; x++) g.set(x, 12, 39 + 1, x === 44 || x === 46 ? M.gold : M.plaque); // signboard
  // A-frame cable tower: two frames at x 54..55 and 62..63, legs spread in z, top at y 32
  for (const xs of [[54, 55], [62, 63]]) for (const x of xs) {
    g.line(x, 0, 21, x, 31, 30, M.woodD); g.line(x, 0, 42, x, 31, 33, M.woodD);
    g.line(x, 0, 22, x, 31, 31, M.wood); g.line(x, 0, 41, x, 31, 32, M.wood);
    for (const y of [16, 24]) { const off = Math.round(((31 - y) / 31) * 9); g.box(x, y, 21 + 9 - off + 1, x, y, 42 - 9 + off - 1, xs[0] === 54 ? M.woodL : M.wood); }
    g.box(x, 32, 28, x, 33, 35, M.woodD); g.set(x, 0, 21, M.stone); g.set(x, 0, 42, M.stone);
  }
  for (const z of [29, 34]) { g.box(54, 27, z, 63, 27, z, M.woodL); g.box(54, 33, z, 63, 33, z, M.woodD); }
  for (const z of [24, 39]) g.line(55, 16, z + (z < 30 ? 1 : -1), 62, 24, z + (z < 30 ? 2 : -2), M.wood);
  // sheave at the top (centre mesh x 60, y 27): iron disc + axle, cable wraps its upper-left quarter
  cyl(g, "z", 60, 27, 0, 2.1, 31, 32, (du, dv, a, r) => (r < 0.8 ? M.gold : IRON)); g.box(60, 26, 29, 60, 26, 34, IROND);
  cyl(g, "z", 60, 27, 2.1, 4.1, 31, 32, (du, dv) => (du <= 0.6 && dv >= -0.6 ? ROPE : null));
  for (let x = 58; x <= 63; x++) for (const y of [29, 30]) for (const z of [31, 32]) g.set(x, y, z, (x + y) % 3 === 0 ? ROPED : ROPE);
  lantern(g, 63, 31, 28); lantern(g, 63, 31, 35);
  g.box(58, 34, 31, 58, 41, 31, M.woodD); flagTo(g, 59, 41, 31, 5, 3, CLOTH, M.gold);
  return g;
}

/** Upper gondola station: platform at y = 6, roof, trestles holding the bullwheel slot (wheel centre local (10.5, 19, 0)). */
export function gondolaStationHigh() {
  const S = 48, g = new G(S), WX = 34.5, WY = 19;
  // platform x 2..24 (local −22..0), z 16..31 (local −8..+7)
  deck(g, 2, 24, 16, 31, 5, "z");
  for (let x = 2; x <= 24; x++) for (const z of [16, 31]) g.set(x, 4, z, M.woodD);
  for (let x = 2; x <= 24; x += 5) g.box(x, 4, 17, x, 4, 30, M.woodD);
  for (const x of [2, 7, 12, 17, 22, 24]) for (const z of [16, 23, 24, 31]) { if (z === 23 || z === 24) { if (x % 10 !== 2) continue; } g.set(x, 0, z, M.stone); g.box(x, 1, z, x, 4, z, M.woodD); }
  for (const z of [16, 31]) for (const x of [2, 12]) g.line(x, 1, z, x + 4, 4, z, M.wood);
  rail(g, "x", 2, 24, 6, 16); rail(g, "x", 2, 8, 6, 31); rail(g, "x", 14, 24, 6, 31); rail(g, "z", 16, 31, 6, 24);
  for (const z of [16, 31]) g.box(2, 6, z, 2, 12, z, (x, y) => (y === 12 ? C.d : C.base)); // boarding gate at −x
  // stairs on the +z side, down toward −x
  for (let k = 0; k <= 5; k++) { const x = 9 + k; g.box(x, 0, 33, x, k, 36, (xx, y) => (y === k ? (xx % 2 ? M.woodL : M.wood) : M.woodD)); }
  g.box(9, 5, 32, 13, 5, 32, M.woodD); g.box(14, 0, 32, 14, 5, 36, (x, y) => (y === 5 ? M.woodL : M.woodD));
  for (const z of [32, 37]) { if (z === 37) g.line(8, 2, z, 14, 8, z, M.woodL); for (let k = 0; k <= 5; k++) g.box(9 + k, k, 37, 9 + k, k + 1, 37, M.woodD); }
  // roof over the waiting area
  for (const [x, z] of [[4, 17], [4, 30], [12, 17], [12, 30], [20, 17], [20, 30]]) g.box(x, 6, z, x, 13, z, (xx, y) => (y === 13 ? C.d : C.base));
  for (let x = 4; x <= 20; x++) for (const z of [17, 30]) g.set(x, 13, z, x % 3 === 0 ? M.gold : M.beam);
  for (let z = 17; z <= 30; z++) for (const x of [4, 20]) g.set(x, 13, z, z % 3 === 0 ? M.gold : M.beam);
  hipRoof(g, 1, 21, 14, 33, 14, { pearl: true });
  lantern(g, 4, 12, 31); lantern(g, 20, 12, 31); lantern(g, 4, 12, 16); lantern(g, 20, 12, 16);
  g.box(6, 6, 18, 10, 7, 18, M.woodD); g.box(14, 6, 18, 18, 7, 18, M.woodD);
  crate(g, 6, 6, 27, 2); crate(g, 9, 6, 28, 1);
  for (let x = 7; x <= 15; x++) g.set(x, 12, 32, x === 10 || x === 12 ? M.gold : M.plaque);
  // bullwheel trestles at z 18..19 and 28..29 (|local z| 4..6), bearings at the axle (mesh x 34.5, y 19)
  for (const zs of [[18, 19], [28, 29]]) for (const z of zs) {
    g.line(26, 0, z, 33, 16, z, M.woodD); g.line(43, 0, z, 36, 16, z, M.woodD);
    g.line(27, 0, z, 34, 15, z, M.wood); g.line(42, 0, z, 35, 15, z, M.wood);
    g.box(29, 6, z, 40, 6, z, M.woodL); g.box(26, 0, z, 27, 0, z, M.stone); g.box(42, 0, z, 43, 0, z, M.stone);
    g.box(33, 16, z, 36, 17, z, M.woodD); g.box(33, 20, z, 36, 21, z, M.woodD); g.box(33, 18, z, 33, 19, z, IRON); g.box(36, 18, z, 36, 19, z, IRON);
    g.box(33, 17, z, 36, 17, z, IRON); g.box(33, 20, z, 36, 20, z, IRON);
  }
  for (const x of [26, 27, 42, 43]) g.box(x, 0, 18, x, 1, 29, (xx, y) => (y === 1 ? M.woodL : M.woodD)); // ground sills across
  for (const zs of [[17, 16], [30, 31]]) g.line(29, 1, zs[1], 34, 14, zs[0], M.wood); // outrigger props
  // incoming cable from −x at y 29..30 (centre y 30), resting on the wheel top at mesh x 34.5
  for (let x = 0; x <= 29; x++) for (const y of [29, 30]) for (const z of [23, 24]) g.set(x, y, z, (x + y) % 3 === 0 ? ROPED : ROPE);
  g.box(24, 6, 31, 24, 24, 31, M.woodD); g.set(24, 25, 31, M.gold); flagTo(g, 25, 24, 31, 5, 3, CLOTH, M.gold); // flag pole
  void WX; void WY;
  return g;
}

/** Hanging cabin 10×8×8, floor top at y = 1, cable grip channel at the top centre (cable centre local (0, 22, 0)). */
export function gondolaCar() {
  const S = 24, g = new G(S);
  const x0 = 7, x1 = 16, z0 = 8, z1 = 15;
  g.box(x0, 0, z0, x1, 0, z1, (x) => (x % 2 ? M.woodD : M.wood));
  g.box(x0 + 1, -1, z0 + 1, x1 - 1, -1, z1 - 1, M.woodD);
  for (let y = 1; y <= 3; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    const edge = x === x0 || x === x1 || z === z0 || z === z1; if (!edge) continue;
    const door = (x === x0 || x === x1) && (z === 11 || z === 12);
    if (door) continue; g.set(x, y, z, y === 3 ? M.red : (x + z) % 3 === 0 ? M.woodD : M.woodL);
  }
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) g.box(x, 1, z, x, 7, z, PILLAR);
  for (const z of [10, 13]) for (const x of [x0, x1]) g.box(x, 1, z, x, 7, z, C.d); // door jambs
  for (let x = x0; x <= x1; x++) for (const z of [z0, z1]) g.set(x, 7, z, x % 3 === 0 ? M.gold : M.red);
  for (let z = z0; z <= z1; z++) for (const x of [x0, x1]) g.set(x, 7, z, z % 3 === 0 ? M.gold : M.red);
  for (const z of [z0 + 1, z1 - 1]) g.box(x0 + 1, 1, z, x1 - 1, 1, z, M.woodD); // benches
  hipRoof(g, x0 - 2, x1 + 2, z0 - 2, z1 + 2, 8, { zs: [1, 1, 1], xs: [1, 1, 1], pearl: false });
  lantern(g, x1 + 1, 7, 12); g.set(x1 + 1, 8, 12, M.woodD); lantern(g, x0 - 1, 7, 11); g.set(x0 - 1, 8, 11, M.woodD);
  // hanger arm: iron bar up from the roof to the grip
  g.box(11, 11, 11, 12, 19, 12, (x, y) => (y % 4 === 0 ? IRONL : IRON));
  g.line(9, 11, 11, 11, 15, 11, IRON); g.line(14, 11, 12, 12, 15, 12, IRON);
  // grip: jaws around a 2×2 cable channel (y 21..22, z 11..12) with rollers on top
  g.box(9, 20, 10, 14, 20, 13, IROND); g.box(9, 21, 10, 14, 22, 10, IRON); g.box(9, 21, 13, 14, 22, 13, IRON);
  for (const x of [9, 14]) { g.box(x, 23, 10, x, 23, 13, IRON); g.set(x, 22, 10, M.gold); g.set(x, 22, 13, M.gold); }
  g.box(10, 23, 10, 13, 23, 10, IROND); g.box(10, 23, 13, 13, 23, 13, IROND);
  return g;
}

/** Cliff lift tower: shaft 10×10 at x,z 0,0, top landing y = 30 out to −z, bullwheel slot (centre local (11, 48, 0)). */
export function elevatorTower() {
  const S = 48, g = new G(S), TOP = 41;
  const posts = [[17, 17], [29, 17], [17, 29], [29, 29]];
  for (const [px, pz] of posts) { g.box(px - 1, 0, pz - 1, px + 2, 0, pz + 2, M.stone); g.box(px, 1, pz, px + 1, TOP + 1, pz + 1, (x, y) => (y % 11 === 0 ? IRON : x === px ? M.woodD : M.wood)); }
  const girt = (y, faces) => { for (const f of faces) {
    if (f === "-x" || f === "+x") { const x = f === "-x" ? 17 : 30; g.box(x, y, 19, x, y, 28, M.woodL); }
    else { const z = f === "-z" ? 17 : 30; g.box(19, y, z, 28, y, z, M.woodL); } } };
  girt(11, ["-x", "+x", "-z", "+z"]); girt(22, ["-x", "+x", "-z", "+z"]); girt(29, ["-x", "+x", "+z"]); girt(TOP, ["-x", "-z", "+z"]);
  const xb = (f, ya, yb) => { if (f === "-x" || f === "+x") { const x = f === "-x" ? 17 : 30; g.line(x, ya, 19, x, yb, 28, M.wood); g.line(x, ya, 28, x, yb, 19, M.wood); }
    else { const z = f === "-z" ? 17 : 30; g.line(19, ya, z, 28, yb, z, M.wood); g.line(28, ya, z, 19, yb, z, M.wood); } };
  for (const [ya, yb] of [[1, 10], [12, 21], [23, 28], [30, 40]]) for (const f of ["-x", "+x", "-z", "+z"]) {
    if (f === "+z" && ya === 1) continue; if (f === "-z" && ya === 30) continue; if (f === "+x" && ya === 30) continue; xb(f, ya, yb); }
  // bottom entrance (+z): lintel, lanterns, threshold stones
  g.box(19, 9, 31, 28, 9, 31, C.base); for (const x of [18, 29]) lantern(g, x, 8, 31);
  for (let x = 19; x <= 28; x++) g.set(x, 0, 31, x % 2 ? M.stone : M.stoneL);
  // top landing: walkway deck at y 29 (surface y = 30), out to −z (z 7..18 → local −17..−6)
  deck(g, 19, 28, 7, 18, 29, "x");
  for (const x of [19, 28]) { g.box(x, 28, 7, x, 28, 18, M.woodD); g.line(x, 20, 17, x, 28, 10, M.wood); }
  rail(g, "z", 7, 16, 30, 19, 3, 3); rail(g, "z", 7, 16, 30, 28, 3, 3);
  for (const x of [19, 28]) { g.box(x, 30, 7, x, 35, 7, (xx, y) => (y === 35 ? C.d : C.base)); lantern(g, x === 19 ? 18 : 29, 34, 7); g.set(x === 19 ? 18 : 29, 35, 7, M.woodD); }
  for (let x = 19; x <= 28; x++) g.set(x, 36, 7, x % 3 === 0 ? M.gold : M.red);
  for (let x = 21; x <= 26; x++) g.set(x, 37, 7, x === 23 || x === 24 ? M.gold : M.plaque);
  g.box(19, 38, 17, 28, 38, 17, C.base);
  // ladder up the −x face
  for (const z of [20, 23]) g.box(16, 0, z, 16, TOP, z, M.woodD);
  for (let y = 1; y <= TOP; y += 2) g.box(16, y, 21, 16, y, 22, M.woodL);
  // head frame: beams along x on both z sides (z 17..19 and 28..30), from the shaft to the counterweight track
  for (const [za, zb] of [[17, 19], [28, 30]]) {
    g.box(17, TOP + 1, za, 47, TOP + 1, zb, (x, y, z) => (x % 6 === 0 ? IRON : z === za || z === zb ? M.woodD : M.wood));
    g.box(33, TOP + 2, za + (za === 17 ? 1 : 0), 36, TOP + 4, zb - (za === 17 ? 0 : 1), M.woodD); // axle cradle base
    for (const x of [33, 36]) g.box(x, TOP + 5, za === 17 ? 18 : 28, x, TOP + 6, za === 17 ? 19 : 29, IRON);
    g.box(34, TOP + 5, za === 17 ? 18 : 28, 35, TOP + 5, za === 17 ? 19 : 29, IROND);
    g.line(31, 30, za === 17 ? 18 : 29, 34, TOP, za === 17 ? 18 : 29, M.wood); // struts under the cradle
    g.line(38, 30, za === 17 ? 18 : 29, 35, TOP, za === 17 ? 18 : 29, M.wood);
  }
  // counterweight track at x 44..47 (local +20..+23), guide rails at z 20 and 27
  for (const z of [20, 27]) { g.box(45, 0, z, 46, TOP, z, (x, y) => (y % 10 === 0 ? IRON : x === 45 ? M.woodD : M.wood)); g.box(44, 0, z, 47, 0, z, M.stone); }
  for (const y of [11, 22, 33]) { for (const z of [20, 27]) g.box(31, y, z, 44, y, z, M.woodL); }
  for (const z of [20, 27]) { g.line(31, 1, z, 44, 10, z, M.wood); g.line(31, 12, z, 44, 21, z, M.wood); }
  // small roof on the −x side of the head frame
  for (const [x, z] of [[13, 15], [13, 32]]) g.box(x, 30, z, x, TOP + 1, z, (xx, y) => (y === TOP + 1 ? C.d : C.base));
  deck(g, 12, 16, 15, 32, 29, "z"); rail(g, "z", 15, 32, 30, 12, 2, 3);
  for (let z = 15; z <= 32; z++) g.set(13, TOP + 1, z, z % 3 === 0 ? M.gold : M.beam);
  hipRoof(g, 10, 21, 13, 34, TOP + 2, { zs: [1, 1, 1], xs: [1, 1, 1], maxLayers: 3 });
  lantern(g, 12, TOP + 1, 14); lantern(g, 12, TOP + 1, 33);
  return g;
}

/** Open lift cage, 9×9 at cells 4..12 (local −4..+5: centre +0.5,+0.5), floor top y = 1, rope ring on top. */
export function elevatorCage() {
  const S = 16, g = new G(S);
  g.box(4, 0, 4, 12, 0, 12, (x, y, z) => (x === 4 || x === 12 || z === 4 || z === 12 ? M.woodD : x % 2 ? M.wood : M.woodL));
  for (const [x, z] of [[4, 4], [12, 4], [4, 12], [12, 12]]) { g.box(x, 1, z, x, 7, z, PILLAR); g.set(x, 0, z, IRON); }
  for (const x of [4, 12]) { rail(g, "z", 4, 12, 1, x, 2, 2); }
  for (const z of [4, 12]) for (let x = 5; x <= 11; x++) g.set(x, 3, z, x % 2 ? ROPE : ROPED); // rope gate
  for (let a = 4; a <= 12; a++) { g.set(a, 7, 4, M.red); g.set(a, 7, 12, M.red); g.set(4, 7, a, M.red); g.set(12, 7, a, M.red); }
  for (const [x, z] of [[4, 4], [12, 4], [4, 12], [12, 12]]) rope(g, x + (x < 8 ? 1 : -1), 8, z + (z < 8 ? 1 : -1), x < 8 ? 7 : 9, 9, z < 8 ? 7 : 9);
  for (const [x, z] of [[7, 7], [8, 7], [9, 7], [7, 8], [9, 8], [7, 9], [8, 9], [9, 9]]) g.set(x, 9, z, (x + z) % 2 ? ROPE : ROPED);
  g.set(8, 10, 8, IRON); g.set(8, 9, 8, IROND);
  lantern(g, 5, 6, 5); crate(g, 9, 1, 9, 2);
  return g;
}

/** Patched-leather cargo airship facing +x: cigar envelope, boat-hull gondola, propeller, fins, pennants, crate net. */
export function airshipCargo() {
  const S = 64, g = new G(S), rnd = rng(110);
  const EX = 32, EY = 35, EZ = 32, RX = 22, RR = 7;
  const PAL = ["#d8a868", "#e0b878", "#c8902a", "#b8402a", "#d8a868", "#c89858", "#e8c890"];
  const patch = new Map(); const pk = (a, b) => { const k = a * 97 + b; if (!patch.has(k)) patch.set(k, PAL[Math.floor(rnd() * PAL.length)]); return patch.get(k); };
  const inside = (x, y, z) => { const dx = Math.abs(x + 0.5 - EX) / RX, dy = (y + 0.5 - EY) / RR, dz = (z + 0.5 - EZ) / RR; return dx ** 2.6 + dy * dy + dz * dz <= 1; };
  surf(g, 8, 26, 22, 56, 44, 42, inside, (x, y, z) => {
    const th = Math.atan2(y + 0.5 - EY, z + 0.5 - EZ), f = (th / (2 * Math.PI)) * 10, u = (x - 10) / 5;
    const n1 = ((u + f) % 1 + 1) % 1, n2 = ((u - f) % 1 + 1) % 1;
    if (x >= 52) return x >= 54 ? M.goldD : M.woodD;
    if ((n1 < 0.11 || n2 < 0.11) && y + 0.5 > EY - 3) return "#6a4a2a";
    if ((x - 10) % 11 === 0) return "#8a5a32";
    return pk(Math.floor((x - 10) / 11), Math.floor((th / (2 * Math.PI) + 1) * 6) % 6);
  });
  g.set(57, 35, 31, M.gold); g.set(57, 35, 32, M.gold);
  // tail fins (cruciform) at the stern
  const finC = (a, b) => ((a + b) % 4 === 0 ? M.cream : "#c83a2a");
  for (let x = 9; x <= 17; x++) { const h = Math.round((17 - x) * 0.8) + 2; for (let k = 0; k < h; k++) for (const z of [31, 32]) { const e = k === h - 1 || x === 9; g.set(x, 41 + k, z, e ? M.woodD : finC(x, k)); g.set(x, 29 - k, z, e ? M.woodD : finC(x, k)); }
    for (let k = 0; k < h; k++) for (const y of [34, 35]) { const e = k === h - 1 || x === 9; g.set(x, y, 38 + k, e ? M.woodD : finC(x, k)); g.set(x, y, 25 - k, e ? M.woodD : finC(x, k)); } }
  // boat-hull gondola, x 20..43, keel y 14, deck y 18, rails y 19
  const hz = 32;
  for (let x = 20; x <= 43; x++) { const w = Math.min(4, Math.floor((x - 19) / 1.6), Math.floor((44 - x) / 1.4)); if (w < 1) continue;
    for (let y = 14; y <= 18; y++) { const ww = y === 14 ? w - 1 : y === 15 ? Math.max(1, w - 0) : w; for (let z = hz - ww; z <= hz + ww - 1; z++) {
      const edge = z === hz - ww || z === hz + ww - 1 || y === 14; if (edge || y === 18) g.set(x, y, z, y === 18 ? (edge ? M.woodD : x % 2 ? M.woodL : M.wood) : y === 16 ? M.red : y === 14 ? M.woodD : M.wood); } }
    if (w >= 2) for (const z of [hz - w, hz + w - 1]) g.set(x, 19, z, x % 3 === 0 ? M.woodD : M.woodL); }
  for (const y of [19, 20, 21]) g.set(44, y, 31, M.woodD); g.set(45, 21, 31, M.woodD); // bow post
  // deckhouse
  g.box(27, 19, 30, 33, 22, 33, (x, y, z) => (y === 22 ? M.woodD : (z === 30 || z === 33) && y === 20 && x % 2 ? M.ink : M.wood));
  for (let x = 26; x <= 34; x++) for (let z = 29; z <= 34; z++) g.set(x, 23, z, z === 29 || z === 34 ? R.dark : R.base);
  for (let x = 27; x <= 33; x++) g.set(x, 24, 31, R.ridge), g.set(x, 24, 32, R.ridge);
  // crew: lookout at the bow, cranker at the stern
  figure(g, 38, 19, 31, { top: "#3a6ad8", bottom: "#2a2030", hat: "cap", hatColor: M.red });
  figure(g, 21, 19, 31, { top: "#8a5a32", bottom: "#3a2a22", hat: "straw" });
  g.box(24, 23, 32, 24, 23, 32, M.woodD); g.box(24, 22, 31, 24, 22, 33, IRON);
  // crank shaft to the stern propeller
  g.line(23, 22, 32, 15, 18, 32, IRON);
  for (let k = -4; k <= 4; k++) { g.set(15, 18 + k, 32, k === 0 ? M.gold : Math.abs(k) > 3 ? M.red : M.woodL); g.set(14, 18, 32 + k, k === 0 ? M.gold : Math.abs(k) > 3 ? M.red : M.woodL); }
  g.set(14, 18, 32, M.gold);
  // suspension ropes from the envelope belly to the rails
  for (const x of [22, 27, 32, 37, 42]) for (const [zt, zb] of [[29, 28], [35, 35]]) rope(g, x, 29, zt, x + (x < 32 ? 1 : x > 32 ? -1 : 0), 19, zb);
  rope(g, 20, 29, 32, 22, 19, 32); rope(g, 44, 29, 32, 42, 19, 32);
  // pennant line from the bow post to the envelope nose, and from the stern to the tail
  const pen = [M.red, M.gold, "#3a6ad8", M.jade, M.orange];
  for (let i = 0; i <= 10; i++) { const x = 45 + i, y = 21 + Math.round(i * 1.1); g.set(x, y, 31, ROPED); if (i % 2 === 1) { g.set(x, y - 1, 31, pen[(i >> 1) % 5]); g.set(x, y - 2, 31, pen[(i >> 1) % 5]); } }
  for (let i = 0; i <= 8; i++) { const x = 20 - i, y = 19 + Math.round(i * 1.0); g.set(x, y, 32, ROPED); if (i % 2 === 0 && i > 0) { g.set(x, y - 1, 32, pen[(i >> 1) % 5]); g.set(x, y - 2, 32, pen[(i >> 1) % 5]); } }
  // cargo net of crates below the hull
  rope(g, 32, 13, 32, 32, 11, 32); g.set(32, 10, 32, IRON);
  crate(g, 27, 1, 28, 3); crate(g, 32, 1, 29, 3); crate(g, 29, 5, 30, 3); crate(g, 34, 5, 32, 2);
  for (let y = 0; y <= 9; y++) { const w = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 4.5) / 6) ** 2)) * 6.5); for (const [x, z] of [[32 - w, 32], [32 + w, 32], [32, 32 - w], [32, 32 + w]]) if (!g.get(x, y, z)) g.set(x, y, z, y % 2 ? ROPE : ROPED); }
  for (const [dx, dz] of [[-6, 0], [6, 0], [0, -6], [0, 6]]) rope(g, 32 + dx, 5, 32 + dz, 32, 10, 32);
  return g;
}
const R = roofRamp(ROOF);

/** Small balloon airship facing +x: jade/cream gored balloon, wicker basket, little sail, lanterns. */
export function airshipSmall() {
  const S = 48, g = new G(S), rnd = rng(111);
  const BX = 24, BY = 30, BZ = 24;
  const inside = (x, y, z) => { const dx = (x + 0.5 - BX) / 10, dy = (y + 0.5 - BY) / (y + 0.5 < BY ? 11 : 10), dz = (z + 0.5 - BZ) / 10; const pinch = y + 0.5 < BY - 6 ? 1 + (BY - 6 - y) * 0.03 : 1; return (dx * dx + dz * dz) * pinch * pinch + dy * dy <= 1; };
  surf(g, 12, 18, 12, 36, 41, 36, inside, (x, y, z) => {
    const th = Math.atan2(z + 0.5 - BZ, x + 0.5 - BX), gore = Math.floor(((th / Math.PI + 1) / 2) * 12);
    if (y >= 39) return M.gold;
    if (y === 30 || y === 31) return (x + z) % 3 ? M.gold : M.goldD;
    if (y <= 20) return "#2a7a60";
    return gore % 2 ? M.jade : M.cream;
  });
  g.set(23, 42, 23, M.goldD); g.set(24, 42, 24, M.goldD); g.set(23, 42, 24, M.goldD); g.set(24, 42, 23, M.goldD); g.set(24, 43, 24, M.gold);
  // load ring at the mouth + ropes down to the basket corners
  cyl(g, "y", BX, BZ, 2.5, 3.6, 18, 18, M.woodD);
  for (const [x, z] of [[20, 20], [27, 20], [20, 27], [27, 27]]) rope(g, x + (x < 24 ? 2 : -2), 17, z + (z < 24 ? 2 : -2), x, 8, z);
  // wicker basket (x 20..27, z 20..27), rim y 7
  g.box(20, 2, 20, 27, 7, 27, (x, y, z) => { const e = x === 20 || x === 27 || z === 20 || z === 27; if (!e && y > 2) return undefined;
    if (y === 7) return M.woodD; if (y === 2) return M.strawD; return (x + z + y) % 2 ? M.straw : M.strawD; });
  figure(g, 23, 3, 22, { top: "#3a6ad8", bottom: "#2a2030", hat: "cap", hatColor: M.jade });
  for (const [x, z] of [[19, 22], [19, 25], [28, 22], [28, 25]]) { g.set(x, 5, z, "#c8a060"); g.set(x, 4, z, "#c8a060"); g.set(x, 6, z, ROPED); } // sandbags
  // lanterns on the +x corners
  for (const z of [20, 27]) { g.set(28, 8, z, M.woodD); g.set(29, 8, z, M.woodD); lantern(g, 29, 7, z); }
  // little sail on a boom off the stern (−x)
  g.box(19, 8, 24, 19, 16, 24, M.woodD); g.box(11, 8, 24, 19, 8, 24, M.woodD);
  for (let x = 12; x <= 18; x++) { const h = Math.round((x - 11) * 1.1); for (let y = 9; y <= 8 + h; y++) g.set(x, y, 24, y === 8 + h ? CL.d : (y + x) % 5 === 0 ? M.cream : CLOTH); }
  // bowsprit with a pennant
  g.line(28, 6, 24, 33, 8, 24, M.woodD); flagTo(g, 33, 12, 24, 4, 3, M.red, M.gold); g.box(33, 8, 24, 33, 12, 24, M.woodD);
  void rnd;
  return g;
}

/** Wooden mooring mast ~41 tall: stone footing, braces, rope ladder, top platform (surface y = 33), mooring ring, pennant. */
export function mooringMast() {
  const S = 48, g = new G(S), c = 24;
  g.box(18, 0, 18, 29, 1, 29, (x, y, z) => (y === 1 && (x === 18 || x === 29 || z === 18 || z === 29) ? M.stoneD : (x + z) % 4 ? M.stoneL : M.stone));
  g.box(22, 2, 22, 25, 20, 25, (x, y, z) => (y % 6 === 2 ? IRON : x === 22 || z === 22 ? M.woodD : M.wood));
  g.box(23, 21, 23, 24, 41, 24, (x, y) => (y % 7 === 0 ? IRON : x === 23 ? M.woodD : M.wood));
  for (const [x0, z0, x1, z1] of [[17, 23, 21, 23], [17, 24, 21, 24], [30, 23, 26, 23], [30, 24, 26, 24], [23, 17, 23, 21], [24, 17, 24, 21], [23, 30, 23, 26], [24, 30, 24, 26]]) { g.line(x0, 1, z0, x1, 12, z1, M.woodD); g.set(x0, 0, z0, M.stone); g.set(x0, 1, z0, M.stoneD); }
  // top platform (x,z 19..28), surface y = 33, railings, brackets
  deck(g, 19, 28, 19, 28, 32, "z");
  for (const [x, z] of [[19, 19], [28, 19], [19, 28], [28, 28]]) g.line(x < c ? 23 : 24, 24, z < c ? 23 : 24, x, 31, z, M.woodD);
  g.box(19, 31, 23, 28, 31, 24, M.woodD); g.box(23, 31, 19, 24, 31, 28, M.woodD);
  rail(g, "x", 19, 28, 33, 28, 2, 3); rail(g, "z", 19, 28, 33, 19, 2, 3); rail(g, "z", 19, 28, 33, 28, 2, 3);
  rail(g, "x", 19, 21, 33, 19, 2, 2); rail(g, "x", 26, 28, 33, 19, 2, 2); // gap for the ladder (x 22..25)
  for (const x of [21, 26]) g.box(x, 33, 19, x, 37, 19, (xx, y) => (y === 37 ? C.d : C.base));
  for (let x = 21; x <= 26; x++) g.set(x, 37, 19, x % 2 ? M.gold : M.red);
  lantern(g, 20, 36, 19); g.set(20, 37, 19, M.woodD); lantern(g, 27, 36, 19); g.set(27, 37, 19, M.woodD);
  // swivel cap + mooring ring in the x-y plane on top of the mast (ring centre local (0, 44.5, 0))
  g.box(22, 40, 22, 25, 40, 25, IRON); g.box(23, 41, 23, 24, 41, 24, IRONL);
  cyl(g, "z", c, 44.5, 2.2, 3.3, 23, 24, (du, dv) => (dv > 2.6 ? IRONL : IRON));
  // pennant pole at the −x−z corner, pennant streaming toward −x
  g.box(19, 33, 19, 19, 45, 19, M.woodD); g.set(19, 46, 19, M.gold);
  for (let i = 0; i < 11; i++) { const h = i < 3 ? 3 : i < 7 ? 2 : 1, y = 45 - (i > 5 ? 1 : 0); for (let k = 0; k < h; k++) g.set(18 - i, y - k, 19, i % 4 < 2 ? M.red : M.gold); }
  // rope ladder down the −z side (rails at x 22 and 25)
  for (let y = 2; y <= 32; y++) { const sag = y > 6 && y < 28 ? 1 : 0; for (const x of [22, 25]) g.set(x, y, 18 - sag, ROPE); if (y % 2 === 0) g.box(23, y, 18 - sag, 24, y, 18 - sag, M.woodL); }
  // coiled mooring lines on the footing
  cyl(g, "y", 28, 20, 0.6, 1.9, 2, 2, ROPE); cyl(g, "y", 28, 20, 0, 1.2, 3, 3, ROPED); cyl(g, "y", 20, 28, 0.6, 1.9, 2, 2, ROPED);
  return g;
}
