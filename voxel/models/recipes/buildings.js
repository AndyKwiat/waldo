// Building recipes: houses, shop, inn, pagoda, gates, walls, towers, market stall, plaza pavilion.
// Front faces +Z. Canonical ROOF / WALL / PILLAR / CLOTH colors get re-colored per variant by the renderer.
import { G, rng, wheel } from "./lib.js";
import { M, ROOF, WALL, PILLAR, CLOTH, roofRamp, wallRamp, colRamp } from "./colors.js";

const R = roofRamp(ROOF), Wl = wallRamp(WALL), C = colRamp(PILLAR);

/** Stacked-layer hip roof with tile channels, hip ridges, round eave caps, upturned corners and a ridge with end curls. */
export function hipRoof(g, xa, xb, za, zb, y0, o = {}) {
  const zs = o.zs ?? [2, 2, 1], xs = o.xs ?? [2, 1, 1], maxL = o.maxLayers ?? 99;
  let X0 = xa, X1 = xb, Z0 = za, Z1 = zb, y = y0, k = 0, last = null;
  while (Z1 - Z0 >= 2 && X1 - X0 >= 2 && k < maxL) {
    const nx0 = X0 + (xs[k] ?? 1), nx1 = X1 - (xs[k] ?? 1), nz0 = Z0 + (zs[k] ?? 1), nz1 = Z1 - (zs[k] ?? 1);
    for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) {
      const side = x < nx0 || x > nx1, fb = z < nz0 || z > nz1; let c;
      if (k === 0 && (x === X0 || x === X1 || z === Z0 || z === Z1)) c = (z === Z0 || z === Z1 ? x : z) % 3 === 0 ? R.dark : R.cap;
      else if (side && fb) c = R.ridge;
      else if (fb) c = x % 3 === 0 ? R.dark : (z === nz0 - 1 || z === nz1 + 1) && k > 0 && x % 3 === 1 ? R.light : R.base;
      else if (side) c = z % 3 === 0 ? R.dark : R.side;
      else c = R.base;
      g.set(x, y, z, c);
    }
    last = { X0, X1, Z0, Z1, y };
    X0 = nx0; X1 = nx1; Z0 = nz0; Z1 = nz1; y++; k++;
  }
  // upturned eave corners
  for (const [cx, cz, dx, dz] of [[xa, za, -1, -1], [xb, za, 1, -1], [xa, zb, -1, 1], [xb, zb, 1, 1]]) {
    g.set(cx, y0 + 1, cz, R.cap); g.set(cx + dx, y0 + 1, cz + dz, R.cap); g.set(cx + dx, y0 + 2, cz + dz, R.ridge);
  }
  if (o.ridge !== false && last) {
    const zc = Math.floor((last.Z0 + last.Z1) / 2), yr = last.y + 1;
    for (let x = last.X0; x <= last.X1; x++) { g.set(x, yr, zc, R.ridge); if (last.Z1 - last.Z0 >= 3) g.set(x, yr, zc + 1, R.ridge); }
    for (const [ex, d] of [[last.X0, -1], [last.X1, 1]]) { g.set(ex, yr + 1, zc, R.ridge); g.set(ex + d, yr + 2, zc, R.ridge); g.set(ex, yr + 2, zc, R.dark); }
    if (o.pearl) { g.set(Math.round((last.X0 + last.X1) / 2), yr + 1, zc, M.gold); g.set(Math.round((last.X0 + last.X1) / 2), yr + 2, zc, M.gold); }
    return yr;
  }
  return last ? last.y : y0;
}

/** Plaster walls (shell) with a brick skirt, a shaded top row and red corner posts. */
function walls(g, x0, x1, z0, z1, y0, y1, rnd, skirt = true) {
  g.shell(x0, y0, z0, x1, y1, z1, (x, y, z) => {
    if ((x === x0 || x === x1) && (z === z0 || z === z1)) return y === y1 ? C.d : C.base;
    if (skirt && y <= y0 + 1) return (x + z + y) % 4 === 0 ? M.skirtD : M.skirt;
    if (y === y1) return Wl.shadow;
    const r = rnd(); return r < 0.1 ? Wl.d : r < 0.14 ? Wl.l : Wl.base;
  });
}
/** Recessed lattice window on a face. face: 'front'|'back'|'left'|'right'; a0 = first cell along the face. */
function windowAt(g, face, x0, x1, z0, z1, a0, y0, w = 4, h = 5, kind = "lattice") {
  const at = (a, y, d, c) => { // d = depth into the wall (0 = face, 1 = inside, -1 = outside)
    if (face === "front") g.set(a, y, z1 - d, c); else if (face === "back") g.set(a, y, z0 + d, c);
    else if (face === "left") g.set(x0 + d, y, a, c); else g.set(x1 - d, y, a, c); };
  for (let a = a0 - 1; a <= a0 + w; a++) for (let y = y0 - 1; y <= y0 + h; y++) {
    const inside = a >= a0 && a < a0 + w && y >= y0 && y < y0 + h;
    if (inside) { at(a, y, 0, null); at(a, y, 1, kind === "lattice" ? ((a + y) % 2 === 0 ? M.lattice : M.paper) : kind === "slats" ? (a % 2 === 0 ? M.lattice : M.paper) : M.paper); }
    else at(a, y, 0, y === y0 - 1 ? M.woodL : M.wood);
  }
  for (let a = a0 - 1; a <= a0 + w; a++) at(a, y0 - 1, -1, M.woodL); // sill
}
function doorAt(g, cx, z1, y0, h, plaque) {
  for (let x = cx - 2; x <= cx + 1; x++) for (let y = y0; y < y0 + h; y++) {
    g.set(x, y, z1, null);
    g.set(x, y, z1 - 1, x === cx - 1 ? M.doorD : (x === cx - 2 || x === cx + 1) && (y - y0) % 3 === 1 ? M.gold : M.door);
  }
  for (let y = y0; y <= y0 + h; y++) { g.set(cx - 3, y, z1, (y - y0) % 3 === 1 ? M.gold : M.red); g.set(cx + 2, y, z1, (y - y0) % 3 === 1 ? M.gold : M.red); }
  for (let x = cx - 3; x <= cx + 2; x++) g.set(x, y0 + h, z1, M.woodD);
  if (plaque) { for (let x = cx - 2; x <= cx + 1; x++) g.set(x, y0 + h + 1, z1 + 1, x === cx - 1 || x === cx ? M.gold : M.plaque); }
}
function lantern(g, x, y, z) { g.set(x, y, z, M.goldD); g.set(x, y - 1, z, M.lantern); g.set(x, y - 2, z, M.lantern); g.set(x, y - 3, z, M.gold); }
function beamRow(g, x0, x1, y, z) { for (let x = x0; x <= x1; x++) g.set(x, y, z, x % 3 === 0 ? M.gold : M.beam); }
function crates(g, x, y, z) { g.box(x, y, z, x + 2, y + 1, z + 2, (xx, yy, zz) => (xx === x + 1 && zz === z + 2 ? M.woodD : M.woodL)); g.box(x, y + 2, z, x + 1, y + 3, z + 1, M.wood); }
function jarAt(g, x, y, z, c) { g.box(x, y, z, x + 1, y + 1, z + 1, c); g.set(x, y + 2, z, c); g.set(x + 1, y + 2, z + 1, M.ink); }

/** Houses. kind: home1 (one storey) | home2 (two storeys) | shop (awning, goods, signboard) | inn (two storeys + banner) */
export function house(kind) {
  const two = kind === "home2" || kind === "inn";
  const S = 40, g = new G(S), rnd = rng(kind.length * 17 + 5);
  const x0 = 8, x1 = 31, z0 = 12, z1 = 27, cx = 20, H1 = two ? 9 : 12;
  g.box(x0 - 3, 0, z0 - 2, x1 + 3, 0, z1 + 4, (x, y, z) => (x === x0 - 3 || x === x1 + 3 || z === z0 - 2 || z === z1 + 4 ? M.stoneD : (x * 3 + z * 5) % 11 === 0 ? M.stone : M.stoneL));
  walls(g, x0, x1, z0, z1, 1, H1, rnd);
  doorAt(g, cx, z1, 1, two ? 7 : 9, !two);
  const wy = two ? 3 : 4, wh = two ? 4 : 5;
  windowAt(g, "front", x0, x1, z0, z1, x0 + 2, wy, 4, wh, "lattice"); windowAt(g, "front", x0, x1, z0, z1, x1 - 5, wy, 4, wh, kind === "home1" ? "slats" : "lattice");
  windowAt(g, "back", x0, x1, z0, z1, x0 + 4, wy, 4, wh); windowAt(g, "back", x0, x1, z0, z1, x1 - 7, wy, 4, wh);
  windowAt(g, "left", x0, x1, z0, z1, z0 + 6, wy, 4, wh, "slats"); windowAt(g, "right", x0, x1, z0, z1, z0 + 6, wy, 4, wh, "slats");
  // front colonnade + painted beam
  const pz = z1 + 2, posts = kind === "shop" ? [x0, x1] : [x0, x0 + 6, x1 - 6, x1];
  for (const px of posts) { g.set(px, 1, pz, M.stone); g.box(px, 2, pz, px, H1, pz, (x, y) => (y === H1 ? C.d : C.base)); }
  beamRow(g, x0, x1, H1, pz); beamRow(g, x0, x1, H1, pz - 1);
  if (kind !== "inn") { lantern(g, x0 + 3, H1 - 1, pz); lantern(g, x1 - 3, H1 - 1, pz); }
  if (!two) hipRoof(g, x0 - 4, x1 + 4, z0 - 3, z1 + 4, H1 + 1);
  else {
    hipRoof(g, x0 - 3, x1 + 3, z0 - 3, z1 + 4, H1 + 1, { maxLayers: 3, zs: [1, 1, 1], xs: [1, 1, 1], ridge: false });
    const u0 = x0 + 2, u1 = x1 - 2, w0 = z0 + 2, w1 = z1 - 2, Y = H1 + 4, H2 = Y + 7;
    walls(g, u0, u1, w0, w1, Y, H2, rnd, false);
    for (const a of [u0 + 2, u0 + 9, u1 - 5]) windowAt(g, "front", u0, u1, w0, w1, a, Y + 2, 4, 4, "lattice");
    windowAt(g, "back", u0, u1, w0, w1, u0 + 4, Y + 2, 4, 4); windowAt(g, "left", u0, u1, w0, w1, w0 + 4, Y + 2, 4, 4, "slats"); windowAt(g, "right", u0, u1, w0, w1, w0 + 4, Y + 2, 4, 4, "slats");
    for (let x = u0 - 1; x <= u1 + 1; x++) { g.set(x, Y + 1, w1 + 2, C.base); if (x % 2 === 0) g.set(x, Y, w1 + 2, C.d); }
    if (kind === "inn") { lantern(g, u0 + 1, H2 - 1, w1 + 1); lantern(g, u1 - 1, H2 - 1, w1 + 1); }
    hipRoof(g, u0 - 4, u1 + 4, w0 - 3, w1 + 4, H2 + 1);
  }
  if (kind === "shop") { // striped awning, signboard, produce baskets
    for (let x = cx - 6; x <= cx + 5; x++) { const st = (x & 1) ? M.cream : CLOTH; g.set(x, 9, z1 + 1, st); g.set(x, 8, z1 + 2, st); g.set(x, 7, z1 + 3, st); if (x % 2 === 0) g.set(x, 6, z1 + 3, CLOTH); }
    for (let x = cx - 5; x <= cx + 4; x++) g.set(x, 11, z1 + 1, x % 2 === 0 ? M.gold : M.plaque);
    for (const bx of [cx - 9, cx + 6]) { g.box(bx, 1, z1 + 3, bx + 2, 1, z1 + 4, M.woodL); for (let x = bx; x <= bx + 2; x++) for (let z = z1 + 3; z <= z1 + 4; z++) g.set(x, 2, z, [M.veg, M.orange, M.tomato][(x + z) % 3]); }
  }
  if (kind === "inn") { // tall banner pole
    g.box(x1 + 5, 1, z1 + 3, x1 + 5, 30, z1 + 3, M.woodD); g.set(x1 + 5, 31, z1 + 3, M.gold);
    for (let y = 17; y <= 29; y++) for (let x = x1 + 6; x <= x1 + 8; x++) g.set(x, y, z1 + 3, y === 29 || y === 17 || x === x1 + 8 ? CLOTH : (y % 4 === 0 && x === x1 + 7) ? M.ink : M.cream);
  }
  if (kind === "home1") { crates(g, x1 + 1, 1, z0 - 1); jarAt(g, x0 - 3, 1, z1 + 2, M.jarBlue); }
  if (kind === "home2") { jarAt(g, x1 + 1, 1, z1 + 2, M.jarBrown); g.box(x0 - 3, 1, z0 - 1, x0 - 2, 2, z0 + 2, M.woodL); }
  return g;
}

const brick = (rnd) => (x, y, z) => (y % 3 === 0 ? M.brickD : ((x + z + (y % 6 < 3 ? 0 : 3)) % 6 === 0 ? M.brickD : rnd() < 0.12 ? M.brickL : M.brick));
/** Box with only its surface cells (keeps big masonry light). */
function hull(g, x0, y0, z0, x1, y1, z1, c) { g.box(x0, y0, z0, x1, y1, z1, (x, y, z) => (x === x0 || x === x1 || y === y0 || y === y1 || z === z0 || z === z1 ? c(x, y, z) : undefined)); }
function crenelRing(g, x0, x1, z0, z1, y, edgesOnly) { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const e = x === x0 || x === x1 || z === z0 || z === z1; if (e && (x + z) % 2 === 0 && (!edgesOnly || z === z0 || z === z1)) g.set(x, y, z, M.brick); } }
function tunnel(g, xa, xb, z0, z1, h) { const mid = (xa + xb) / 2, r = (xb - xa) / 2; for (let z = z0; z <= z1; z++) for (let x = xa; x <= xb; x++) for (let y = 0; y <= h + r; y++) { const top = y <= h || Math.hypot(x - mid, (y - h) * 1.2) <= r; if (top) g.set(x, y, z, null); } }

export function pagoda() {
  const S = 64, g = new G(S), rnd = rng(77), c = 32;
  g.box(c - 17, 0, c - 17, c + 16, 1, c + 16, (x, y, z) => (y === 1 && (x + z) % 5 ? M.stoneL : M.stoneD));
  g.box(c - 4, 0, c + 17, c + 3, 0, c + 18, M.stoneL);
  let y = 2, hw = 12;
  for (let t = 0; t < 5; t++) {
    const h = t === 0 ? 10 : 7, x0 = c - hw, x1 = c + hw - 1, z0 = c - hw, z1 = c + hw - 1;
    walls(g, x0, x1, z0, z1, y, y + h - 1, rnd, t === 0);
    for (const face of ["front", "back", "left", "right"]) {
      const a = face === "left" || face === "right" ? c - 2 : c - 2;
      if (t === 0 && face === "front") doorAt(g, c, z1, y, 8, true); else windowAt(g, face, x0, x1, z0, z1, a, y + 2, 4, Math.min(5, h - 3), t % 2 ? "slats" : "lattice");
    }
    for (let x = x0; x <= x1; x++) { g.set(x, y + h - 1, z1 + 1, x % 3 === 0 ? M.gold : M.beam); g.set(x, y + h - 1, z0 - 1, M.beam); }
    hipRoof(g, x0 - 4, x1 + 4, z0 - 4, z1 + 4, y + h, t === 4 ? { pearl: true } : { maxLayers: 3, zs: [1, 1, 1], xs: [1, 1, 1], ridge: false });
    y += h + 2; hw -= 2;
  }
  const top = 61; for (let yy = 52; yy <= top; yy++) g.set(c, yy, c, M.gold); for (const yy of [54, 57]) g.disc(c, yy, c, 1, M.goldD);
  return g;
}

// City walls are 24 tall (walkway on top at y=24) — see world.js for how they're placed.
export function cityGate() {
  const S = 64, g = new G(S), rnd = rng(31);
  hull(g, 8, 0, 24, 55, 31, 41, brick(rnd)); g.box(9, 31, 25, 54, 31, 40, M.stoneL);
  crenelRing(g, 8, 55, 24, 41, 32, true); crenelRing(g, 8, 55, 24, 41, 33, true);
  tunnel(g, 27, 36, 24, 41, 14);
  for (const x of [26, 37]) g.box(x, 0, 40, x, 14, 42, M.door);
  for (let x = 28; x <= 35; x++) g.set(x, 22, 42, x === 31 || x === 32 ? M.gold : M.plaque);
  for (const x of [14, 20, 43, 49]) g.box(x, 14, 41, x + 1, 17, 41, M.ink);
  walls(g, 16, 47, 26, 39, 32, 40, rnd, false);
  for (const a of [19, 30, 40]) windowAt(g, "front", 16, 47, 26, 39, a, 34, 4, 4); for (const a of [19, 40]) windowAt(g, "back", 16, 47, 26, 39, a, 34, 4, 4);
  beamRow(g, 16, 47, 40, 40);
  hipRoof(g, 12, 51, 22, 43, 41, { pearl: true });
  return g;
}

export function fortGate() {
  const S = 104, g = new G(S), rnd = rng(41);
  hull(g, 12, 0, 40, 91, 19, 63, brick(rnd)); g.box(13, 19, 41, 90, 19, 62, M.stoneL);
  crenelRing(g, 12, 91, 40, 63, 20, true);
  tunnel(g, 46, 57, 40, 63, 12);
  for (const x of [45, 58]) g.box(x, 0, 62, x, 12, 64, M.door);
  for (let x = 47; x <= 56; x++) g.set(x, 17, 64, x % 3 === 0 ? M.gold : M.plaque);
  for (const bx of [0, 86]) { hull(g, bx, 0, 36, bx + 17, 25, 67, brick(rnd)); g.box(bx + 1, 25, 37, bx + 16, 25, 66, M.stoneL); crenelRing(g, bx, bx + 17, 36, 67, 26, false);
    walls(g, bx + 3, bx + 14, 46, 57, 26, 31, rnd, false); hipRoof(g, bx + 1, bx + 16, 43, 60, 32); }
  walls(g, 26, 77, 43, 60, 20, 29, rnd, false);
  for (const a of [30, 40, 60, 70]) windowAt(g, "front", 26, 77, 43, 60, a, 22, 4, 5); windowAt(g, "front", 26, 77, 43, 60, 50, 22, 4, 5, "slats");
  for (let x = 26; x <= 77; x += 6) g.box(x, 20, 61, x, 29, 61, (xx, y) => (y === 29 ? C.d : C.base));
  beamRow(g, 26, 77, 29, 61);
  hipRoof(g, 22, 81, 39, 64, 30, { maxLayers: 3, zs: [1, 1, 1], xs: [1, 1, 1], ridge: false });
  walls(g, 32, 71, 46, 57, 33, 40, rnd, false);
  for (const a of [36, 46, 56, 64]) windowAt(g, "front", 32, 71, 46, 57, a, 35, 4, 4, "lattice");
  for (let x = 31; x <= 72; x++) { g.set(x, 34, 59, C.base); if (x % 2 === 0) g.set(x, 33, 59, C.d); }
  hipRoof(g, 28, 75, 42, 61, 41, { pearl: true });
  for (const fx of [40, 63]) { g.box(fx, 20, 64, fx, 30, 64, M.woodD); g.box(fx + 1, 26, 64, fx + 4, 29, 64, M.gold); }
  return g;
}

export function wallSegment() { // 22 long (x 5..26), footprint z 8..16, walkway at y=24
  const S = 32, g = new G(S), rnd = rng(5);
  hull(g, 5, 0, 8, 26, 23, 16, brick(rnd)); g.box(5, 23, 9, 26, 23, 15, M.stoneL);
  for (let x = 5; x <= 26; x += 2) for (const z of [8, 16]) { g.set(x, 24, z, M.brick); g.set(x, 25, z, M.brickL); }
  for (const x of [9, 20]) for (const z of [8, 16]) g.box(x, 14, z, x, 17, z, M.ink);
  for (let x = 5; x <= 26; x++) for (const z of [8, 16]) g.set(x, 0, z, M.stoneD);
  return g;
}

export function watchtower() { // 28×28 body, 34 tall, pavilion on top
  const S = 56, g = new G(S), rnd = rng(6);
  hull(g, 14, 0, 14, 41, 33, 41, brick(rnd)); g.box(15, 33, 15, 40, 33, 40, M.stoneL); crenelRing(g, 14, 41, 14, 41, 34, false); crenelRing(g, 14, 41, 14, 41, 35, false);
  for (const [x, z] of [[17, 17], [38, 17], [17, 38], [38, 38]]) g.box(x, 34, z, x, 40, z, (xx, y) => (y === 40 ? C.d : C.base));
  for (const y of [12, 20, 28]) for (const [x, z] of [[27, 41], [27, 14], [14, 27], [41, 27]]) g.box(x, y, z, x + (z === 27 ? 0 : 1), y + 2, z + (z === 27 ? 1 : 0), M.ink);
  hipRoof(g, 14, 41, 14, 41, 41, { zs: [2, 1, 1], xs: [2, 1, 1], pearl: true });
  return g;
}

export function stall() {
  const S = 24, g = new G(S), rnd = rng(12);
  g.box(5, 0, 11, 18, 3, 14, (x, y, z) => (z === 14 && x % 3 === 0 ? M.woodD : y === 3 ? M.woodL : M.wood));
  const goods = [M.tomato, M.orange, M.veg, M.hay, M.jarBlue, M.cream, M.pink];
  for (let x = 6; x <= 17; x++) for (let z = 11; z <= 14; z++) if (rnd() < 0.7) g.set(x, 4, z, goods[Math.floor(rnd() * goods.length)]);
  for (const [x, z] of [[5, 11], [18, 11], [5, 14], [18, 14]]) g.box(x, 0, z, x, 10, z, PILLAR);
  hipRoof(g, 3, 20, 9, 16, 11, { zs: [1, 1, 1], xs: [1, 1, 1] });
  lantern(g, 5, 10, 15); lantern(g, 18, 10, 15);
  return g;
}

export function pavilion() {
  const S = 40, g = new G(S), c = 20;
  g.disc(c, 0, c, 15.5, M.stoneD); g.disc(c, 1, c, 14.5, (x, y, z) => ((x + z) % 4 ? M.stoneL : M.stone));
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8, x = Math.round(c + Math.cos(a) * 11), z = Math.round(c + Math.sin(a) * 11); g.box(x, 2, z, x, 12, z, (xx, y) => (y === 12 ? C.d : C.base)); }
  for (let k = 0; k < 64; k++) { const a = (k / 64) * Math.PI * 2; const x = c + Math.cos(a) * 12, z = c + Math.sin(a) * 12; g.set(x, 4, z, C.base); if (k % 2 === 0) g.set(x, 3, z, C.d); }
  for (let k = 0; k < 64; k++) { const a = (k / 64) * Math.PI * 2; g.set(c + Math.cos(a) * 11, 12, c + Math.sin(a) * 11, k % 4 ? M.beam : M.gold); }
  hipRoof(g, 6, 33, 6, 33, 13, { maxLayers: 3, zs: [1, 1, 1], xs: [1, 1, 1], ridge: false });
  g.shell(14, 16, 14, 25, 19, 25, (x, y, z) => ((x === 14 || x === 25) && (z === 14 || z === 25) ? PILLAR : y === 19 ? Wl.shadow : (x + z) % 2 ? M.paper : M.lattice));
  hipRoof(g, 11, 28, 11, 28, 20, { pearl: true });
  return g;
}

/** Three-storey teahouse: narrow (fits a 22-wide garden strip), balconies, lanterns, outdoor tables. Door at x=24, front edge z=33. */
export function teahouse() {
  const S = 48, g = new G(S), rnd = rng(91), cx = 24;
  g.box(13, 0, 14, 34, 0, 34, (x, y, z) => (x === 13 || x === 34 || z === 14 || z === 34 ? M.stoneD : (x + z) % 5 ? M.stoneL : M.stone));
  walls(g, 17, 30, 17, 30, 1, 9, rnd); doorAt(g, cx, 30, 1, 7, true);
  windowAt(g, "left", 17, 30, 17, 30, 21, 3, 4, 4, "slats"); windowAt(g, "right", 17, 30, 17, 30, 21, 3, 4, 4, "slats"); windowAt(g, "back", 17, 30, 17, 30, 21, 3, 4, 4);
  for (const px of [17, 30]) { g.set(px, 1, 32, M.stone); g.box(px, 2, 32, px, 9, 32, (x, y) => (y === 9 ? C.d : C.base)); }
  beamRow(g, 17, 30, 9, 32); beamRow(g, 17, 30, 9, 31); lantern(g, 20, 8, 32); lantern(g, 27, 8, 32);
  hipRoof(g, 14, 33, 14, 33, 10, { maxLayers: 2, zs: [1, 1], xs: [1, 1], ridge: false });
  walls(g, 18, 29, 18, 29, 12, 18, rnd, false);
  for (const a of [19, 25]) windowAt(g, "front", 18, 29, 18, 29, a, 14, 4, 3, "lattice"); windowAt(g, "left", 18, 29, 18, 29, 22, 14, 4, 3); windowAt(g, "right", 18, 29, 18, 29, 22, 14, 4, 3);
  for (let x = 16; x <= 31; x++) { g.set(x, 13, 31, C.base); if (x % 2 === 0) g.set(x, 12, 31, C.d); }
  lantern(g, 16, 18, 31); lantern(g, 31, 18, 31);
  hipRoof(g, 15, 32, 15, 32, 19, { maxLayers: 2, zs: [1, 1], xs: [1, 1], ridge: false });
  walls(g, 19, 28, 19, 28, 21, 26, rnd, false);
  windowAt(g, "front", 19, 28, 19, 28, 22, 22, 4, 3, "slats"); windowAt(g, "back", 19, 28, 19, 28, 22, 22, 4, 3, "slats");
  for (let x = 17; x <= 30; x++) { g.set(x, 22, 30, C.base); if (x % 2 === 0) g.set(x, 21, 30, C.d); }
  hipRoof(g, 15, 32, 15, 32, 27, { pearl: true });
  g.box(34, 1, 32, 34, 25, 32, M.woodD); g.set(34, 26, 32, M.gold);
  for (let y = 14; y <= 24; y++) for (let x = 35; x <= 36; x++) g.set(x, y, 32, y === 14 || y === 24 ? CLOTH : y % 3 === 0 && x === 35 ? M.ink : M.cream);
  for (const tx of [14, 31]) { g.box(tx, 1, 33, tx + 1, 2, 33, M.woodL); g.set(tx, 3, 33, M.jarBrown); g.set(tx - 1, 1, 33, M.woodD); g.set(tx + 2, 1, 33, M.woodD); }
  return g;
}

/** Walled courtyard manor (siheyuan): perimeter wall with a roofed gateway, main hall at the back, two side wings,
 *  a courtyard tree. Same footprint/door as the houses: gateway at x=20, front edge z=31. */
export function manor() {
  const S = 40, g = new G(S), rnd = rng(57), cx = 20;
  g.box(3, 0, 7, 36, 0, 32, (x, y, z) => (x === 3 || x === 36 || z === 7 || z === 32 ? M.stoneD : x > 6 && x < 33 && z > 21 && z < 30 ? ((x + z) % 2 ? M.stoneL : M.stone) : M.stoneL));
  g.shell(4, 1, 8, 35, 7, 31, (x, y, z) => (y === 1 ? M.skirt : y === 7 ? Wl.shadow : rnd() < 0.1 ? Wl.d : Wl.base));
  for (let x = 4; x <= 35; x++) for (let z = 8; z <= 31; z++) if (x === 4 || x === 35 || z === 8 || z === 31) { g.set(x, 8, z, (x + z) % 3 ? R.base : R.dark); if ((x === 4 || x === 35) !== (z === 8 || z === 31) || x === 4 || x === 35) g.set(x, 9, z, R.ridge); }
  for (let x = 4; x <= 35; x++) { g.set(x, 9, 8, R.ridge); g.set(x, 9, 31, R.ridge); }
  for (let x = cx - 2; x <= cx + 1; x++) for (let y = 1; y <= 7; y++) { g.set(x, y, 31, null); g.set(x, y, 30, x === cx - 1 ? M.doorD : M.door); }
  for (const px of [cx - 4, cx + 3]) g.box(px, 1, 32, px, 9, 32, (x, y) => (y === 9 ? C.d : C.base));
  beamRow(g, cx - 4, cx + 3, 9, 32); lantern(g, cx - 4, 8, 33); lantern(g, cx + 3, 8, 33);
  hipRoof(g, cx - 7, cx + 6, 28, 34, 10, { zs: [1, 1, 1], xs: [1, 1, 1] });
  walls(g, 9, 30, 10, 19, 1, 9, rnd); doorAt(g, cx, 19, 1, 7, false);
  windowAt(g, "front", 9, 30, 10, 19, 11, 3, 4, 4, "lattice"); windowAt(g, "front", 9, 30, 10, 19, 25, 3, 4, 4, "lattice");
  for (const px of [9, 14, 25, 30]) g.box(px, 1, 21, px, 9, 21, (x, y) => (y === 9 ? C.d : C.base)); beamRow(g, 9, 30, 9, 21); beamRow(g, 9, 30, 9, 20);
  hipRoof(g, 6, 33, 7, 23, 10);
  for (const [a, b] of [[6, 11], [28, 33]]) { walls(g, a, b, 21, 28, 1, 6, rnd); windowAt(g, a < 20 ? "right" : "left", a, b, 21, 28, 23, 2, 3, 3, "slats"); hipRoof(g, a - 2, b + 2, 19, 30, 7, { zs: [1, 1, 1], xs: [1, 1, 1] }); }
  g.box(19, 1, 25, 20, 4, 26, M.trunk); g.ball(19.5, 7, 25.5, 4, 3, 3.5, (x, y) => (y > 8 ? M.pinkL : y > 6 ? M.pink : M.pinkD));
  for (const [x, z] of [[14, 27], [25, 27]]) { g.box(x, 1, z, x + 1, 1, z + 1, M.jarBlue); g.set(x, 2, z, M.leaf); g.set(x + 1, 2, z + 1, M.leafL); }
  return g;
}

/** The palace's great hall: a double-roofed hall on a three-tier marble terrace with a grand staircase. Front faces +Z. */
export function palaceHall() {
  const S = 128, g = new G(S), rnd = rng(66), c = 64, MAR = "#ece8e0", MARD = "#cfcac0", MARL = "#f8f6f0";
  const tier = (x0, x1, z0, z1, y0) => { g.box(x0, y0, z0, x1, y0 + 1, z1, (x, y, z) => (x === x0 || x === x1 || z === z0 || z === z1 ? (y === y0 + 1 ? MARL : MARD) : y === y0 + 1 ? ((x + z) % 7 ? MAR : MARD) : undefined));
    for (let x = x0; x <= x1; x += 3) { g.set(x, y0 + 2, z0, MARL); g.set(x, y0 + 2, z1, MARL); } for (let z = z0; z <= z1; z += 3) { g.set(x0, y0 + 2, z, MARL); g.set(x1, y0 + 2, z, MARL); } };
  tier(10, 117, 26, 101, 0); tier(14, 113, 30, 97, 2); tier(18, 109, 34, 93, 4);
  for (let s = 0; s <= 5; s++) { const za = 104 - 2 * s; g.box(52, s, za, 75, s, za + 1, (x) => (x >= 61 && x <= 66 ? "#d8c890" : MARL)); }
  for (let x = 52; x <= 75; x++) for (let z = 94; z <= 105; z++) for (let y = 3; y <= 6; y++) if (g.get(x, y, z) === MARL && (x === 52 || x === 75)) g.set(x, y + 1, z, MARD);
  for (const lx of [46, 79]) { g.box(lx, 0, 104, lx + 2, 2, 106, MARD); g.box(lx, 3, 104, lx + 2, 6, 106, "#9a9488"); g.box(lx, 7, 105, lx + 2, 8, 106, "#9a9488"); g.set(lx + 1, 7, 107, M.ink); }
  walls(g, 24, 103, 42, 85, 6, 27, rnd, false);
  for (const dx of [44, 64, 84]) doorAt(g, dx, 85, 6, 14, true);
  for (const a of [28, 51, 71, 94]) windowAt(g, "front", 24, 103, 42, 85, a, 10, 6, 9, "lattice");
  for (const a of [30, 50, 70, 90]) windowAt(g, "back", 24, 103, 42, 85, a, 10, 6, 9, "lattice");
  for (const a of [50, 70]) { windowAt(g, "left", 24, 103, 42, 85, a, 10, 6, 9, "slats"); windowAt(g, "right", 24, 103, 42, 85, a, 10, 6, 9, "slats"); }
  for (let px = 24; px <= 103; px += 8) { g.set(px, 6, 89, MARD); g.box(px, 7, 89, px, 27, 89, (x, y) => (y === 27 ? C.d : C.base)); g.box(px, 6, 38, px, 27, 38, (x, y) => (y === 27 ? C.d : C.base)); }
  for (const z of [86, 87, 88, 89]) beamRow(g, 24, 103, 27, z);
  hipRoof(g, 18, 109, 36, 93, 28, { maxLayers: 4, zs: [1, 1, 1, 1], xs: [1, 1, 1, 1], ridge: false });
  walls(g, 32, 95, 48, 79, 32, 42, rnd, false);
  for (const a of [36, 48, 60, 72, 84]) windowAt(g, "front", 32, 95, 48, 79, a, 35, 5, 5, "lattice");
  for (let px = 32; px <= 95; px += 9) g.box(px, 32, 81, px, 42, 81, (x, y) => (y === 42 ? C.d : C.base)); beamRow(g, 32, 95, 42, 81); beamRow(g, 32, 95, 42, 80);
  for (let x = 31; x <= 96; x++) { g.set(x, 33, 82, C.base); if (x % 2 === 0) g.set(x, 32, 82, C.d); }
  hipRoof(g, 24, 103, 40, 87, 43, { pearl: true });
  return g;
}

/** Red palace wall, 22 long, capped with tiles (canonical ROOF → imperial gold in world.js). Footprint z 13..18. */
export function palaceWall() {
  const S = 32, g = new G(S);
  g.box(5, 0, 13, 26, 13, 18, (x, y, z) => (x !== 5 && x !== 26 && z !== 13 && z !== 18 && y > 0 && y < 13 ? undefined : y <= 1 ? "#8a2a24" : y === 13 ? "#6a2020" : "#b8302a"));
  for (let x = 5; x <= 26; x++) { for (let z = 12; z <= 19; z++) g.set(x, 14, z, z === 12 || z === 19 ? (x % 3 ? R.cap : R.dark) : R.base); for (let z = 14; z <= 17; z++) g.set(x, 15, z, x % 3 ? R.base : R.dark); g.set(x, 16, 15, R.ridge); g.set(x, 16, 16, R.ridge); }
  return g;
}

/** Two-storey merchant guild hall: stone terrace, pillar colonnade porch, skirt roof between storeys, an upper
 *  gallery/balcony with railing and a big name plaque, a broad main hip roof. Same door convention as the houses:
 *  door centred at local x=0, front wall local z=+7, porch +8..+10, terrace edge +11, front step +12. Grid 56. */
export function hallHouse() {
  const S = 56, c = 28, g = new G(S), rnd = rng(123), X = (v) => c + v, Z = (v) => c + v;
  // two-step stone terrace + front stair
  const px0 = X(-24), px1 = X(23), pz0 = Z(-16), pz1 = Z(11);
  g.box(px0, 0, pz0, px1, 1, pz1, (x, y, z) => (x === px0 || x === px1 || z === pz0 || z === pz1 ? (y === 1 ? M.stone : M.stoneD) : y === 0 ? undefined : (x * 3 + z * 5) % 11 === 0 ? M.stone : M.stoneL));
  g.box(X(-7), 0, Z(12), X(6), 0, Z(12), (x) => (x === X(-7) || x === X(6) ? M.stone : M.stoneL));
  // ground floor
  const x0 = X(-21), x1 = X(20), z0 = Z(-14), z1 = Z(7), H1 = 11;
  walls(g, x0, x1, z0, z1, 2, H1, rnd);
  doorAt(g, c, z1, 2, 8, false);
  for (let y = 2; y <= 10; y++) for (const x of [X(-4), X(3)]) g.set(x, y, z1, y % 3 === 0 ? M.gold : M.red); // wider red door frame
  for (let x = X(-4); x <= X(3); x++) g.set(x, 10, z1, x % 2 ? M.gold : M.woodD);
  for (const a of [X(-18), X(-11), X(7), X(14)]) windowAt(g, "front", x0, x1, z0, z1, a, 4, 4, 5, "lattice");
  for (const a of [X(-16), X(-6), X(2), X(12)]) windowAt(g, "back", x0, x1, z0, z1, a, 4, 4, 5);
  for (const a of [Z(-10), Z(0)]) { windowAt(g, "left", x0, x1, z0, z1, a, 4, 4, 5, "slats"); windowAt(g, "right", x0, x1, z0, z1, a, 4, 4, 5, "slats"); }
  // porch colonnade
  const pz = Z(10);
  for (const px of [X(-21), X(-14), X(-7), X(6), X(13), X(20)]) { g.set(px, 2, pz, M.stone); g.box(px, 3, pz, px, H1, pz, (x, y) => (y === H1 ? C.d : C.base)); }
  beamRow(g, x0, x1, H1, pz); beamRow(g, x0, x1, H1, pz - 1); beamRow(g, x0, x1, H1, pz - 2);
  for (const lx of [X(-18), X(-11), X(10), X(17)]) lantern(g, lx, H1 - 1, pz);
  // skirt roof between the storeys
  hipRoof(g, x0 - 3, x1 + 3, z0 - 3, Z(11), H1 + 1, { maxLayers: 3, zs: [1, 1, 1], xs: [1, 1, 1], ridge: false });
  // upper floor (set back for the balcony)
  const u0 = X(-17), u1 = X(16), w0 = Z(-12), w1 = Z(2), Y = H1 + 4, H2 = Y + 8;
  walls(g, u0, u1, w0, w1, Y, H2, rnd, false);
  for (const a of [X(-14), X(-8), X(5), X(11)]) windowAt(g, "front", u0, u1, w0, w1, a, Y + 2, 4, 4, "lattice");
  windowAt(g, "front", u0, u1, w0, w1, X(-2), Y, 4, 6, "slats"); // balcony door
  for (const a of [X(-12), X(-2), X(8)]) windowAt(g, "back", u0, u1, w0, w1, a, Y + 2, 4, 4);
  for (const a of [Z(-8), Z(-2)]) { windowAt(g, "left", u0, u1, w0, w1, a, Y + 2, 4, 4, "slats"); windowAt(g, "right", u0, u1, w0, w1, a, Y + 2, 4, 4, "slats"); }
  // balcony deck, railing, gallery posts
  const bz = Z(8);
  g.box(u0 - 1, Y - 1, w1 + 1, u1 + 1, Y - 1, bz, (x, y, z) => (z === bz ? M.woodD : x % 2 ? M.wood : M.woodL));
  for (let x = u0 - 1; x <= u1 + 1; x++) { g.set(x, Y + 1, bz, C.base); if (x % 2 === 0) g.set(x, Y, bz, C.d); }
  for (const z of [w1 + 1, w1 + 3, w1 + 5]) for (const x of [u0 - 1, u1 + 1]) { g.set(x, Y + 1, z, C.base); g.set(x, Y, z, C.d); }
  for (const qx of [X(-18), X(-10), X(9), X(17)]) g.box(qx, Y, bz, qx, H2, bz, (x, y) => (y === H2 ? C.d : C.base));
  beamRow(g, u0 - 1, u1 + 1, H2, bz); beamRow(g, u0 - 1, u1 + 1, H2, bz - 1);
  for (const lx of [X(-14), X(-6), X(5), X(13)]) lantern(g, lx, H2 - 1, bz);
  // the hall's name plaque, hung on the balcony railing above the door
  for (let x = X(-6); x <= X(5); x++) for (let y = Y - 1; y <= Y + 3; y++) {
    const edge = x === X(-6) || x === X(5) || y === Y - 1 || y === Y + 3;
    g.set(x, y, bz + 1, edge ? M.gold : (y === Y + 1 && x % 3 !== 2) || (y !== Y + 1 && x % 3 === 0) ? M.gold : M.plaque);
  }
  // main roof
  hipRoof(g, u0 - 5, u1 + 5, w0 - 4, Z(10), H2 + 1, { pearl: true });
  // terrace dressing: big jars, stone lions by the stair, potted shrubs
  jarAt(g, X(-23), 2, Z(8), M.jarBlue); jarAt(g, X(21), 2, Z(8), M.jarBlue); jarAt(g, X(-23), 2, Z(-15), M.jarBrown);
  for (const lx of [X(-10), X(8)]) { g.box(lx, 2, Z(10), lx + 1, 3, Z(11), M.stone); g.box(lx, 4, Z(11), lx + 1, 5, Z(11), M.stoneL); g.set(lx, 5, Z(11), M.stoneD); g.set(lx + 1, 4, Z(11), M.stoneD); }
  crates(g, X(21), 2, Z(-15));
  return g;
}

/** Merchant warehouse compound: a long two-level storehouse at the back (loft doors, hoist), an open storage shed and
 *  a closed granary as side wings, a tiled-cap front wall with a roofed gatehouse, and a paved yard full of crates,
 *  jars, hay and an ox cart. Gate centred at local x=0, front wall local z=+9, apron edge +12. Grid 64. */
export function compound() {
  const S = 64, c = 32, g = new G(S), rnd = rng(321), X = (v) => c + v, Z = (v) => c + v;
  const ax0 = X(-28), ax1 = X(27), az0 = Z(-18), az1 = Z(12);
  g.box(ax0, 0, az0, ax1, 0, az1, (x, y, z) => (x === ax0 || x === ax1 || z === az0 || z === az1 ? M.stoneD
    : x > X(-19) && x < X(18) && z > Z(-8) && z < Z(9) ? ((x + z) % 2 ? M.stoneL : M.stone) : (x * 3 + z * 5) % 11 === 0 ? M.stone : M.stoneL));
  // --- storehouse at the back
  const h0 = X(-25), h1 = X(24), hz0 = Z(-16), hz1 = Z(-8), HH = 15;
  walls(g, h0, h1, hz0, hz1, 1, HH, rnd);
  for (let y = 8; y <= 8; y++) for (let x = h0; x <= h1; x++) if (x !== h0 && x !== h1) { g.set(x, y, hz1, M.wood); g.set(x, y, hz0, M.wood); } // floor beam line
  for (const dx of [X(-12), X(0), X(12)]) { // big ground doors + loft doors above
    for (let x = dx - 2; x <= dx + 1; x++) for (let y = 1; y <= 5; y++) { g.set(x, y, hz1, null); g.set(x, y, hz1 - 1, x === dx - 1 || x === dx ? M.doorD : M.door); }
    for (let y = 1; y <= 6; y++) { g.set(dx - 3, y, hz1, M.woodD); g.set(dx + 2, y, hz1, M.woodD); } for (let x = dx - 3; x <= dx + 2; x++) g.set(x, 6, hz1, M.woodD);
    for (let x = dx - 1; x <= dx; x++) for (let y = 10; y <= 13; y++) { g.set(x, y, hz1, null); g.set(x, y, hz1 - 1, M.woodD); }
    for (let y = 9; y <= 14; y++) { g.set(dx - 2, y, hz1, M.wood); g.set(dx + 1, y, hz1, M.wood); } for (let x = dx - 2; x <= dx + 1; x++) { g.set(x, 9, hz1 + 1, M.woodL); g.set(x, 14, hz1, M.wood); }
  }
  for (const a of [X(-20), X(-7), X(5), X(17)]) windowAt(g, "front", h0, h1, hz0, hz1, a, 10, 3, 3, "slats");
  for (const a of [X(-20), X(-8), X(4), X(16)]) windowAt(g, "back", h0, h1, hz0, hz1, a, 10, 3, 3, "slats");
  for (const s of ["left", "right"]) windowAt(g, s, h0, h1, hz0, hz1, Z(-12), 10, 3, 3, "slats");
  // hoist beam over the middle loft door
  g.box(X(0), 15, hz1 + 1, X(0), 15, hz1 + 3, M.woodD); g.box(X(0), 11, hz1 + 3, X(0), 14, hz1 + 3, M.straw); g.box(X(-1), 9, hz1 + 3, X(0), 10, hz1 + 3, M.hay);
  beamRow(g, h0, h1, HH, hz1 + 1);
  hipRoof(g, h0 - 3, h1 + 3, hz0 - 2, hz1 + 2, HH + 1, { pearl: true });
  // --- left wing: open storage shed facing the yard
  const l0 = X(-27), l1 = X(-19), wz0 = Z(-4), wz1 = Z(9), WH = 8;
  g.shell(l0, 1, wz0, l1, WH, wz1, (x, y, z) => (x === l1 && z !== wz0 && z !== wz1 ? undefined : (x === l0 || x === l1) && (z === wz0 || z === wz1) ? C.base : y <= 2 ? M.skirt : y === WH ? Wl.shadow : rnd() < 0.1 ? Wl.d : Wl.base));
  for (const z of [wz0 + 4, wz0 + 8]) g.box(l1, 1, z, l1, WH, z, (x, y) => (y === WH ? C.d : C.base));
  beamRow(g, l0, l1, WH, wz1 + 1); for (let z = wz0; z <= wz1; z++) g.set(l1, WH, z, z % 3 === 0 ? M.gold : M.beam);
  windowAt(g, "front", l0, l1, wz0, wz1, X(-25), 3, 4, 4, "slats");
  for (let z = wz0 + 1; z <= wz1 - 1; z++) for (let x = l0 + 1; x <= l0 + 3; x++) { g.set(x, 1, z, M.hay); g.set(x, 2, z, (x + z) % 3 ? M.hay : M.hayD); if (z % 4) g.set(x, 3, z, x === l0 + 3 ? M.hayD : M.hayL); }
  for (const z of [wz0 + 2, wz0 + 6]) jarAt(g, l0 + 5, 1, z, M.jarBrown);
  hipRoof(g, l0 - 2, l1 + 2, wz0 - 2, wz1 + 2, WH + 1, { zs: [1, 1, 1], xs: [1, 1, 1] });
  // --- right wing: closed granary with vents and a big yard door
  const r0 = X(18), r1 = X(26);
  walls(g, r0, r1, wz0, wz1, 1, WH, rnd);
  for (let z = Z(1); z <= Z(4); z++) for (let y = 1; y <= 5; y++) { g.set(r0, y, z, null); g.set(r0 + 1, y, z, z === Z(2) ? M.doorD : M.door); }
  for (let y = 1; y <= 6; y++) { g.set(r0, y, Z(0), M.woodD); g.set(r0, y, Z(5), M.woodD); } for (let z = Z(0); z <= Z(5); z++) g.set(r0, 6, z, M.woodD);
  windowAt(g, "front", r0, r1, wz0, wz1, X(20), 4, 4, 3, "slats"); windowAt(g, "right", r0, r1, wz0, wz1, Z(2), 4, 4, 3, "slats");
  for (const vz of [wz0 + 2, wz1 - 2]) g.set(r1, 7, vz, M.ink);
  for (const z of [wz0 + 2, wz1 - 2]) jarAt(g, r0 - 2, 1, z, M.jarBlue);
  hipRoof(g, r0 - 2, r1 + 2, wz0 - 2, wz1 + 2, WH + 1, { zs: [1, 1, 1], xs: [1, 1, 1] });
  // --- front wall with tiled cap, gatehouse in the middle
  const fz = Z(9);
  for (let x = l1 + 1; x <= r0 - 1; x++) {
    for (let y = 1; y <= 6; y++) g.set(x, y, fz, y === 1 ? M.skirt : y === 6 ? Wl.shadow : rnd() < 0.1 ? Wl.d : Wl.base);
    g.set(x, 7, fz - 1, x % 3 ? R.base : R.dark); g.set(x, 7, fz + 1, x % 3 ? R.base : R.dark); g.set(x, 7, fz, R.base); g.set(x, 8, fz, R.ridge);
  }
  const gx0 = X(-6), gx1 = X(5), gz0 = Z(6), GH = 9;
  g.shell(gx0, 1, gz0, gx1, GH, fz, (x, y, z) => ((x === gx0 || x === gx1) && (z === gz0 || z === fz) ? C.base : y <= 2 ? M.skirt : y === GH ? Wl.shadow : rnd() < 0.1 ? Wl.d : Wl.base));
  doorAt(g, c, fz, 1, 7, true);
  for (let x = c - 2; x <= c + 1; x++) for (let y = 1; y <= 7; y++) { g.set(x, y, fz - 1, null); g.set(x, y, gz0, null); } // open passage
  for (let x = c - 2; x <= c + 1; x++) g.set(x, 7, gz0, M.woodD);
  for (const px of [gx0, gx1]) { g.set(px, 1, fz + 2, M.stone); g.box(px, 2, fz + 2, px, GH, fz + 2, (x, y) => (y === GH ? C.d : C.base)); }
  beamRow(g, gx0, gx1, GH, fz + 2); beamRow(g, gx0, gx1, GH, fz + 1);
  lantern(g, gx0 + 2, GH - 1, fz + 2); lantern(g, gx1 - 2, GH - 1, fz + 2);
  hipRoof(g, gx0 - 3, gx1 + 3, gz0 - 1, fz + 2, GH + 1, { zs: [1, 1, 1], xs: [1, 1, 1], pearl: true });
  // apron in front + stone bollards
  for (const bx of [X(-10), X(9)]) { g.box(bx, 1, Z(11), bx, 2, Z(11), M.stone); g.set(bx, 3, Z(11), M.stoneL); }
  // --- yard: crate stacks, jar rows, ox cart with hay, a well
  crates(g, X(-17), 1, Z(-6)); crates(g, X(-14), 1, Z(-6)); crates(g, X(-17), 1, Z(-3)); crates(g, X(13), 1, Z(-6));
  for (let i = 0; i < 4; i++) jarAt(g, X(-17) + i * 3, 1, Z(1), i % 2 ? M.jarBrown : M.jarBlue);
  const cx0 = X(6), cz = Z(1); // cart, shafts toward +x
  g.box(cx0, 3, cz - 1, cx0 + 6, 3, cz + 2, (x, y, z) => (z === cz - 1 || z === cz + 2 ? M.woodD : M.woodL));
  g.box(cx0 + 1, 4, cz - 1, cx0 + 5, 5, cz + 2, (x, y, z) => ((x + y + z) % 3 ? M.hay : M.hayD)); g.box(cx0 + 2, 6, cz, cx0 + 4, 6, cz + 1, M.hayL);
  g.line(cx0 + 7, 3, cz - 1, cx0 + 10, 2, cz - 1, M.woodD); g.line(cx0 + 7, 3, cz + 2, cx0 + 10, 2, cz + 2, M.woodD);
  wheel(g, cx0 + 3, 2, cz - 2, 2); wheel(g, cx0 + 3, 2, cz + 3, 2);
  g.box(X(-3), 1, Z(-5), X(2), 1, Z(-4), M.woodL); g.box(X(-3), 2, Z(-5), X(-1), 2, Z(-4), M.veg); g.box(X(0), 2, Z(-5), X(2), 2, Z(-4), M.orange); // produce baskets
  return g;
}
