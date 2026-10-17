// Building recipes: houses, shop, inn, pagoda, gates, walls, towers, market stall, plaza pavilion.
// Front faces +Z. Canonical ROOF / WALL / PILLAR / CLOTH colors get re-colored per variant by the renderer.
import { G, rng } from "./lib.js";
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

export function cityGate() {
  const S = 56, g = new G(S), rnd = rng(31);
  hull(g, 6, 0, 20, 49, 15, 35, brick(rnd)); g.box(7, 15, 21, 48, 15, 34, M.stoneL);
  crenelRing(g, 6, 49, 20, 35, 16, true);
  tunnel(g, 24, 31, 20, 35, 8);
  for (const x of [23, 32]) g.box(x, 0, 34, x, 8, 36, M.door);
  for (let x = 25; x <= 30; x++) g.set(x, 13, 36, x === 27 || x === 28 ? M.gold : M.plaque);
  walls(g, 13, 42, 22, 33, 16, 23, rnd, false);
  for (const a of [16, 25, 34]) windowAt(g, "front", 13, 42, 22, 33, a, 18, 4, 4); for (const a of [16, 34]) windowAt(g, "back", 13, 42, 22, 33, a, 18, 4, 4);
  beamRow(g, 13, 42, 23, 34);
  hipRoof(g, 9, 46, 18, 37, 24);
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

export function wallSegment() {
  const S = 24, g = new G(S), rnd = rng(5);
  hull(g, 0, 0, 8, 21, 11, 14, brick(rnd)); g.box(0, 11, 9, 21, 11, 13, M.stoneL);
  for (let x = 0; x <= 21; x += 2) { g.set(x, 12, 8, M.brick); g.set(x, 12, 14, M.brick); }
  return g;
}

export function watchtower() {
  const S = 32, g = new G(S), rnd = rng(6);
  hull(g, 6, 0, 6, 25, 15, 25, brick(rnd)); g.box(7, 15, 7, 24, 15, 24, M.stoneL); crenelRing(g, 6, 25, 6, 25, 16, false);
  for (const [x, z] of [[8, 8], [23, 8], [8, 23], [23, 23]]) g.box(x, 16, z, x, 20, z, (xx, y) => (y === 20 ? C.d : C.base));
  for (const y of [8, 11]) { g.box(15, y, 25, 16, y + 1, 25, M.ink); g.box(15, y, 6, 16, y + 1, 6, M.ink); }
  hipRoof(g, 6, 25, 6, 25, 21, { zs: [2, 1, 1], xs: [2, 1, 1] });
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
