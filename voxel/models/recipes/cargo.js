// Big ox-powered cargo lift: a stackable timber shaft section, the head gantry on the clifftop (rope drums,
// tiled roof, lanterns) and the 32×32 cage that carries an ox cart and a few people.
// Coordinates: cell i of a grid S covers local [i - S/2, i - S/2 + 1] in x/z; y = 0 at the grid floor.
// Shaft: posts centred at x, z = ±19 (cells local 17..20 / −21..−18), clear interior |x|, |z| < 17,
// the −z side open against the cliff. Hoist ropes hang at x = ±10, z = 0.
import { G } from "./lib.js";
import { M, PILLAR, colRamp } from "./colors.js";
import { hipRoof } from "./buildings.js";

const C = colRamp(PILLAR);
const ROPE = "#d4b27a", ROPED = "#a88550", IRON = "#4e4c58", IRONL = "#6e6c7a", IROND = "#36343e";

function lantern(g, x, y, z) { g.set(x, y, z, M.goldD); g.set(x, y - 1, z, M.lantern); g.set(x, y - 2, z, M.lantern); g.set(x, y - 3, z, M.gold); }
function cyl(g, axis, cu, cv, r0, r1, a0, a1, col) {
  const R = Math.ceil(r1) + 1;
  for (let a = a0; a <= a1; a++) for (let u = Math.floor(cu - R); u <= cu + R; u++) for (let v = Math.floor(cv - R); v <= cv + R; v++) {
    const du = u + 0.5 - cu, dv = v + 0.5 - cv, r = Math.hypot(du, dv); if (r < r0 || r >= r1) continue;
    const c = typeof col === "function" ? col(du, dv, a, r) : col;
    if (axis === "y") g.set(u, a, v, c); else if (axis === "z") g.set(u, v, a, c); else g.set(a, u, v, c);
  }
}
function rail(g, axis, a0, a1, y0, k, h = 3, step = 3) {
  for (let a = a0; a <= a1; a++) { const p = (a - a0) % step === 0 || a === a1; const top = y0 + h;
    for (let y = y0; y <= top; y++) if (p || y === top || y === y0 + 1) { const c = y === top ? M.woodL : p ? M.woodD : M.wood; if (axis === "x") g.set(a, y, k, c); else g.set(k, y, a, c); } }
}
/** A 2-thick diagonal timber (thickness along `thick` axis cells t0..t1) — draws the line twice offset in y for weight. */
function strut(g, x0, y0, z0, x1, y1, z1, c = M.wood) { g.line(x0, y0, z0, x1, y1, z1, c); g.line(x0, y0 + 1, z0, x1, y1 + 1, z1, M.woodD); }

// shaft geometry in grid-48 cells
const S48 = 48, PA = [3, 6], PB = [41, 44]; // post cell ranges (local −21..−18 and 17..20)
const post = (g, xr, zr, y0, y1, band) => g.box(xr[0], y0, zr[0], xr[1], y1, zr[1], (x, y, z) => {
  if (band(y)) return (x + z) % 2 ? IRON : IRONL;
  const edge = (x === xr[0] || x === xr[1]) && (z === zr[0] || z === zr[1]);
  return edge ? M.woodD : (x + z + Math.floor(y / 4)) % 3 === 0 ? M.woodL : M.wood;
});
/** Horizontal beam on a side face. side: "-x" | "+x" | "+z" | "-z"; spans between the posts; y0..y1. */
function girt(g, side, y0, y1, depth = [0, 3]) {
  const along = (a) => (a % 4 === 0 ? M.woodD : M.woodL);
  if (side === "-x" || side === "+x") { const xr = side === "-x" ? PA : PB; g.box(xr[0] + depth[0], y0, 7, xr[0] + depth[1], y1, 40, (x, y, z) => (y === y0 && y0 !== y1 ? M.woodD : along(z))); }
  else { const zr = side === "-z" ? PA : PB; g.box(7, y0, zr[0] + depth[0], 40, y1, zr[0] + depth[1], (x, y) => (y === y0 && y0 !== y1 ? M.woodD : along(x))); }
}
/** X-brace in the panel ya..yb of a side face, on the outer two cell layers, iron boss at the crossing. */
function xbrace(g, side, ya, yb) {
  const ym = (ya + yb) / 2;
  if (side === "-x" || side === "+x") { for (const x of side === "-x" ? [3, 4] : [43, 44]) { strut(g, x, ya, 7, x, yb - 1, 40); strut(g, x, yb - 1, 7, x, ya, 40); }
    const x = side === "-x" ? 3 : 44; g.box(x, Math.floor(ym) - 1, 22, x, Math.floor(ym) + 2, 25, IRON); g.set(x, Math.floor(ym), 23, M.gold); g.set(x, Math.floor(ym) + 1, 24, M.gold); }
  else { for (const z of side === "-z" ? [3, 4] : [43, 44]) { strut(g, 7, ya, z, 40, yb - 1, z); strut(g, 40, ya, z, 7, yb - 1, z); }
    const z = side === "-z" ? 3 : 44; g.box(22, Math.floor(ym) - 1, z, 25, Math.floor(ym) + 2, z, IRON); g.set(23, Math.floor(ym), z, M.gold); g.set(24, Math.floor(ym) + 1, z, M.gold); }
}

/** One 30-tall stackable shaft section (grid 48). Bottom and top girts are 1 high so stacked sections meet in a 2-high beam. */
export function cargoLiftSection() {
  const g = new G(S48), H = 30;
  const band = (y) => y === 0 || y === H - 1 || y === 14 || y === 15;
  for (const xr of [PA, PB]) for (const zr of [PA, PB]) post(g, xr, zr, 0, H - 1, band);
  for (const s of ["-x", "+x", "+z"]) { girt(g, s, 0, 0); girt(g, s, H - 1, H - 1); girt(g, s, 14, 15); xbrace(g, s, 1, 14); xbrace(g, s, 16, 29); }
  // guide rails on the inside of ±x (cells local 17 / −18, i.e. just outside the clear shaft), at z = 0
  for (const [xr, xb] of [[41, 42], [6, 5]]) {
    g.box(xb, 0, 22, xb, H - 1, 25, (x, y, z) => (z === 22 || z === 25 ? M.woodD : M.woodL));
    g.box(xr, 0, 23, xr, H - 1, 24, (x, y) => (y % 5 === 0 ? IRONL : y % 5 === 4 ? IROND : IRON));
  }
  // −z: open to the cliff; iron anchor straps from the back posts into the rock
  for (const x of [...PA, ...PB]) for (const y of [7, 22]) g.box(x, y, 0, x, y, 2, x % 2 ? IRON : IROND);
  for (const xr of [PA, PB]) for (const y of [7, 22]) { g.box(xr[0], y, 0, xr[1], y, 0, IROND); g.set(xr[0] + 1, y + 1, 0, M.gold); }
  // ladder up the outer +x face (rungs every 3 → tiles cleanly)
  for (const z of [31, 35]) g.box(45, 0, z, 45, H - 1, z, M.woodD);
  for (let y = 1; y < H; y += 3) g.box(45, y, 32, 45, y, 34, M.woodL);
  for (const y of [5, 20]) for (const z of [31, 35]) g.set(46, y, z, IRON);
  return g;
}

/** Head gantry on the clifftop (grid 48), y = 0 at the clifftop. Deck |x|, |z| < 17 clear to y 16; carts leave toward −z.
 * Rope drums on one axle along x at y 23, z +5 (rope tangent at z = 0); ropes hang at x = ±10, z = 0. */
export function cargoLiftHead() {
  const g = new G(S48), TOP = 28;
  const band = (y) => y === 0 || y === 17 || y === 18 || y === TOP;
  for (const xr of [PA, PB]) for (const zr of [PA, PB]) post(g, xr, zr, 0, TOP, band);
  // girts: base on the three closed sides (matches the shaft below), heavy plates at y 17–18 and TOP all round
  for (const s of ["-x", "+x", "+z"]) { girt(g, s, 0, 0); xbrace(g, s, 1, 17); }
  for (const s of ["-x", "+x", "+z", "-z"]) { girt(g, s, 17, 18); girt(g, s, TOP - 1, TOP); }
  // upper storey left open on ±z so the drums show; knee braces at the corners instead
  for (const z of [4, 5, 42, 43]) { g.line(7, 22, z, 11, 26, z, M.wood); g.line(40, 22, z, 36, 26, z, M.wood); g.line(7, 23, z, 10, 26, z, M.woodD); g.line(40, 23, z, 37, 26, z, M.woodD); }
  // knee braces in the open −z portal (outside the deck: z cells 3..6)
  for (const z of [4, 5]) { g.line(7, 13, z, 11, 16, z, M.wood); g.line(40, 13, z, 36, 16, z, M.wood); }
  // red-and-blue painted lintel + name board over the −z portal (toward the clifftop) and the +z face
  for (const z of [2, 45]) {
    for (let x = 7; x <= 40; x++) g.set(x, 17, z, x % 3 === 0 ? M.gold : M.beam);
    for (let x = 7; x <= 40; x++) g.set(x, 18, z, C.base);
    for (let x = 18; x <= 29; x++) for (const y of [19, 20, 21]) g.set(x, y, z, y === 21 || x === 18 || x === 29 ? M.red : (x === 21 || x === 22 || x === 25 || x === 26) && y !== 21 ? M.gold : M.plaque);
  }
  // axle along x: centre y 23, z 29 (cells y 22–23, z 28–29), bearings on the ±x upper girts
  const AY = 23, AZ = 29;
  for (const xr of [PA, PB]) { g.box(xr[0], 19, 26, xr[1], 21, 31, (x, y, z) => (y === 21 ? IRON : z === 26 || z === 31 ? M.woodD : M.wood)); // bearing pedestals
    g.box(xr[0], 24, 27, xr[1], 24, 30, IRON); for (const x of xr) { g.set(x, 24, 27, M.gold); g.set(x, 24, 30, M.gold); } }
  cyl(g, "x", AY, AZ, 0, 1.45, 1, 46, (du, dv, a) => (a <= 2 || a >= 45 ? IRONL : a % 6 === 0 ? IRON : IROND));
  // the two rope drums (x 30..37 → rope at cells 33–34, local +10; x 10..17 → cells 13–14, local −10)
  const drum = (x0, x1) => {
    const strap = (du, dv) => { const t = ((Math.atan2(dv, du) / (2 * Math.PI)) * 8 + 8.5) % 1; return t < 0.12 || t > 0.88; };
    for (const x of [x0, x1]) cyl(g, "x", AY, AZ, 1.45, 5.9, x, x, (du, dv, a, r) => (r > 5.2 ? (strap(du, dv) ? IRONL : M.woodD) : strap(du, dv) ? IRON : r < 3 ? M.woodD : M.wood));
    cyl(g, "x", AY, AZ, 1.45, 5, x0 + 1, x1 - 1, (du, dv, a) => ((Math.floor((Math.atan2(dv, du) / Math.PI) * 20 + 40) + a) % 3 === 0 ? ROPED : ROPE));
    for (const x of [x0 - 1, x1 + 1]) cyl(g, "x", AY, AZ, 1.45, 2.6, x, x, IRON);
  };
  drum(30, 37); drum(10, 17);
  // centre ratchet wheel + pawl (brake), x 22..25
  cyl(g, "x", AY, AZ, 1.45, 4, 22, 25, (du, dv, a, r) => (r > 3.2 ? ((Math.floor((Math.atan2(dv, du) / Math.PI) * 8 + 16) % 2) ? IRONL : IROND) : a === 22 || a === 25 ? IRON : M.woodD));
  for (let y = 19; y <= 27; y++) g.set(23, y, 34 + (y > 25 ? 0 : 0), y === 27 ? M.goldD : M.woodD);
  g.box(23, 27, 32, 23, 27, 33, IRON); g.box(23, 18, 33, 24, 18, 35, M.woodD); g.box(20, 18, 34, 27, 18, 35, M.woodL);
  // big spur gears on both axle ends (drive from the ox capstans)
  for (const x of [1, 2, 45, 46]) cyl(g, "x", AY, AZ, 1.45, 6.8, x, x, (du, dv, a, r) => {
    const th = Math.atan2(dv, du), tooth = Math.floor((th / Math.PI) * 10 + 20) % 2 === 0;
    if (r > 5.9) return tooth ? M.woodD : undefined; if (r > 5.1) return IRON;
    return Math.abs(du) < 0.8 || Math.abs(dv) < 0.8 ? M.woodL : r < 2.4 ? IRON : undefined; });
  // hoist ropes: from each drum's −z tangent (z cells 23–24) straight down into the shaft
  for (const xs of [[13, 14], [33, 34]]) for (let y = 0; y <= AY; y++) for (const x of xs) for (const z of [23, 24]) g.set(x, y, z, (y + x + z) % 3 === 0 ? ROPED : ROPE);
  // a little tiled roof over the drums on short red posts standing on the top plates
  for (const x of [5, 42]) for (const z of [21, 36]) g.box(x, TOP + 1, z, x, TOP + 4, z, (xx, y) => (y === TOP + 4 ? C.d : C.base));
  for (const z of [21, 36]) for (let x = 5; x <= 42; x++) g.set(x, TOP + 4, z, x % 3 === 0 ? M.gold : M.beam);
  for (const x of [5, 42]) for (let z = 21; z <= 36; z++) g.set(x, TOP + 4, z, z % 3 === 0 ? M.gold : M.beam);
  hipRoof(g, 1, 46, 18, 39, TOP + 5, { zs: [2, 2, 1, 1, 1, 1, 1], xs: [2, 1, 1, 1, 1, 1, 1], pearl: true });
  // lanterns: at the portals (hung from the y 17 plates, outside the deck) and at the eave corners
  for (const x of [9, 38]) { lantern(g, x, 16, 2); lantern(g, x, 16, 45); }
  for (const [x, z] of [[1, 18], [46, 18], [1, 39], [46, 39]]) lantern(g, x, TOP + 5, z);
  for (const [x, z] of [[3, 3], [44, 3], [3, 44], [44, 44]]) { g.set(x, TOP + 1, z, C.d); g.set(x, TOP + 2, z, M.gold); } // post caps
  return g;
}

/** Cage (grid 40): 32×32 deck, cells 4..35 (|x|, |z| ≤ 16), floor top at y 2. Rails on ±x, ends open along z.
 * Corner posts to y 12, side beams y 12–13, a yoke over the middle at y 17–18 with rope rings at x = ±10 (y 19–21). */
export function cargoLiftCage() {
  const S = 40, g = new G(S), A = 4, B = 35;
  // under-frame: joists along x every 4 cells, iron-shod edge beams; planks along z (the driving direction)
  g.box(A, 0, A, B, 0, B, (x, y, z) => ((z - A) % 4 === 0 || z === B || x === A || x === B ? M.woodD : undefined));
  g.box(A, 1, A, B, 1, B, (x, y, z) => {
    if (x === A || x === B) return M.woodD;
    if (z === A || z === B) return (x % 3 === 0 ? IRONL : IRON); // iron-shod lips at the open ends
    if (x === 14 || x === 15 || x === 24 || x === 25) return M.woodD; // wheel tracks (cart axle ~10 wide)
    return x % 4 === 3 ? M.woodD : x % 2 ? M.wood : M.woodL; });
  for (const x of [A, B]) for (const z of [A, 12, 20, 27, B]) g.set(x, 0, z, IRON);
  // corner posts (2×2, red), up to y 12
  const corners = [[A, A], [B - 1, A], [A, B - 1], [B - 1, B - 1]];
  for (const [x, z] of corners) g.box(x, 2, z, x + 1, 12, z + 1, (xx, y) => (y === 2 ? IRON : y === 12 ? C.d : C.base));
  // middle posts on ±x at z 19–20 up to the yoke
  for (const x of [A, B - 1]) g.box(x, 2, 19, x + 1, 18, 20, (xx, y) => (y === 2 ? IRON : y === 12 || y === 13 ? C.d : C.base));
  // railings on ±x (between the posts), with a gold-capped mid rail
  for (const x of [A, B]) { rail(g, "z", A + 2, B - 2, 2, x, 4, 4); for (let z = A + 2; z <= B - 2; z++) g.set(x, 6, z, z % 4 === 2 ? M.goldD : M.woodL); }
  // top frame: side beams along z at y 12–13, red with a blue-and-gold painted band
  for (const x of [A, B]) for (let z = A; z <= B; z++) { g.set(x, 13, z, z % 3 === 0 ? M.gold : M.beam); g.set(x, 12, z, C.base); }
  for (const x of [A + 1, B - 1]) for (let z = A; z <= B; z++) g.set(x, 13, z, C.d);
  // knee braces from the corner posts to the side beams
  for (const x of [A, B]) { g.line(x, 9, A + 2, x, 11, A + 5, M.woodD); g.line(x, 9, B - 2, x, 11, B - 5, M.woodD); }
  // the yoke: crossbeam along x over the middle (z 19–20, y 17–18), knee braces to the mid posts
  g.box(A, 17, 19, B, 18, 20, (x, y) => (x === A || x === B ? IRON : y === 17 ? M.woodD : x % 4 === 0 ? M.wood : M.woodL));
  for (const z of [19, 20]) { g.line(A + 2, 14, z, A + 5, 16, z, M.woodD); g.line(B - 2, 14, z, B - 5, 16, z, M.woodD); }
  for (let x = A + 1; x <= B - 1; x++) g.set(x, 19, 19, x % 3 === 0 ? M.gold : M.red);
  // rope rings at x = ±10 (cells 9–10 and 29–30): iron eye plates + loops
  for (const x0 of [9, 29]) {
    g.box(x0 - 1, 19, 20, x0 + 2, 19, 20, IROND);
    for (const z of [19, 20]) { g.set(x0 - 1, 20, z, IRON); g.set(x0 + 2, 20, z, IRON); g.set(x0 - 1, 21, z, IRONL); g.set(x0 + 2, 21, z, IRONL); g.set(x0, 22, z, IRONL); g.set(x0 + 1, 22, z, IRONL); }
    g.box(x0, 23, 19, x0 + 1, 24, 20, (x, y, z) => ((x + y + z) % 3 === 0 ? ROPED : ROPE)); // rope stub knotted on
  }
  // hanging lantern under the yoke, to the side of the cart lane
  g.set(31, 16, 19, IROND); lantern(g, 31, 15, 19);
  // a few things in the side bays: crate, rope coil, sacks
  g.box(6, 2, 6, 8, 4, 8, (x, y, z) => ((x === 6 || x === 8) && (y === 2 || y === 4) || (y === 2 || y === 4) && (z === 6 || z === 8) ? M.woodD : M.woodL));
  cyl(g, "y", 32, 32, 0.8, 2.4, 2, 3, (du, dv, a) => ((a + Math.round(du)) % 2 ? ROPED : ROPE));
  for (const [x, z] of [[31, 7], [32, 9]]) { g.box(x, 2, z, x + 1, 3, z + 1, M.straw); g.set(x, 4, z, M.strawD); }
  return g;
}
