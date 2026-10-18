// Landmark trees (giant camphor, golden ginkgo) and garden plots that fill a house slot in a block row.
// Trees: 64³ grid, trunk centred on the grid centre (cells 30..33 / 31..32 straddle the centre line), y = 0 at the ground.
// Gardens: 40³ grid like the houses — footprint cells x 4..35, z 8..32 (offsets −16..+16, −12..+13), front +Z,
// entrance at the front centre (cells x 18..21 = offsets −2..+2).
// Never paint M.lantern / M.paper / M.lattice here: those glow at night.
import { G, rng } from "./lib.js";
import { M } from "./colors.js";
import { hipRoof } from "./buildings.js";

const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];
const lerp = (a, b, t) => a + (b - a) * t;

/** Thick tapering limb: a sweep of spheres from a to b, radius r0 → r1. */
function tube(g, a, b, r0, r1, col) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(2, Math.ceil(d * 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t), z = lerp(a[2], b[2], t), r = lerp(r0, r1, t);
    if (r < 0.75) { g.set(x, y, z, col(Math.round(x), Math.round(y), Math.round(z))); continue; }
    const R = Math.ceil(r);
    for (let yy = Math.floor(y - R); yy <= y + R; yy++) for (let zz = Math.floor(z - R); zz <= z + R; zz++) for (let xx = Math.floor(x - R); xx <= x + R; xx++)
      if ((xx - x) ** 2 + (yy - y) ** 2 + (zz - z) ** 2 <= r * r + 0.25 && yy >= 0) g.set(xx, yy, zz, col(xx, yy, zz));
  }
}

/** One foliage clump (flattened ellipsoid, ragged rim) shaded by its own height: dark underside → light top. */
function clump(g, cx, cy, cz, rx, ry, rz, cols, rnd, o = {}) {
  const [D, B, L, LL] = cols, lim = o.lim ?? 99, ox = o.ox ?? cx, oz = o.oz ?? cz;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let z = Math.floor(cz - rz); z <= cz + rz; z++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
    if (d > 1 || (d > 0.72 && rnd() < 0.4) || Math.hypot(x + 0.5 - ox, z + 0.5 - oz) > lim || y < 0) continue;
    const t = (y - (cy - ry)) / (2 * ry) + (rnd() - 0.5) * 0.3;
    g.set(x, y, z, t > 0.8 ? LL : t > 0.55 ? L : t > 0.3 ? B : D);
  }
}

// ---------------------------------------------------------------- giant trees

/** Ancient camphor: gnarled flared trunk, six heavy boughs, a broad layered crown of overlapping clumps, surface roots. */
export function treeCamphor() {
  const S = 64, g = new G(S), rnd = rng(731), c = 32; // c = grid centre line (cells 30..33 straddle it)
  const bark = ["#6a4628", "#7a5232", "#5a3a22", "#866040"];
  const barkCol = (x, y, z) => { const a = Math.atan2(z + 0.5 - c, x + 0.5 - c), groove = Math.floor((a + Math.PI) * 4 + y * 0.15) % 3 === 0;
    const r = rnd(); return groove ? M.trunkD : x + 0.5 > c + 0.8 && r < 0.6 ? "#5e3c22" : r < 0.12 ? "#8e6a46" : r < 0.3 ? "#6a4628" : M.trunk; };
  // surface roots snaking out over the ground
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + rnd() * 0.5, len = 7 + rnd() * 6; let px = c + Math.cos(a) * 2.5, pz = c + Math.sin(a) * 2.5, py = 2.5, r = 1.6, ang = a;
    for (let s = 0; s < 4; s++) {
      ang += (rnd() - 0.5) * 0.7; const nx = px + Math.cos(ang) * len / 4, nz = pz + Math.sin(ang) * len / 4, ny = Math.max(0.3, py - 0.9);
      tube(g, [px, py, pz], [nx, ny, nz], r, Math.max(0.5, r - 0.35), (x, y, z) => (y === 0 && rnd() < 0.3 ? M.trunkD : rnd() < 0.3 ? "#6a4628" : M.trunk));
      px = nx; pz = nz; py = ny; r = Math.max(0.5, r - 0.35);
    }
  }
  // trunk: flared base, slight lean and twist, knots
  for (let y = 0; y <= 17; y++) {
    const r = 2.4 + Math.max(0, 4 - y) * 0.55 + (y > 10 ? (y - 10) * 0.08 : 0), ox = Math.sin(y * 0.35) * 0.5, oz = Math.cos(y * 0.28) * 0.4 - 0.2;
    const R = Math.ceil(r) + 1;
    for (let z = c - R - 1; z <= c + R; z++) for (let x = c - R - 1; x <= c + R; x++)
      if ((x + 0.5 - c - ox) ** 2 + (z + 0.5 - c - oz) ** 2 <= r * r) g.set(x, y, z, barkCol(x, y, z));
  }
  for (const [kx, ky, kz] of [[c + 2.6, 6, c], [c - 3.2, 9, c + 1], [c, 12, c - 3.2], [c - 1, 4, c + 3.4]]) tube(g, [kx, ky, kz], [kx, ky + 1, kz], 1.1, 1, () => M.trunkD);
  // boughs: split at ~14–17, heavy limbs climbing outward; ends carry the crown's clumps
  const boughs = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3 + (rnd() - 0.5) * 0.5, R = 11.5 + rnd() * 4, H = [21, 27, 23, 29, 22, 26][k] + rnd() * 2, y0 = 13 + rnd() * 4;
    const mid = [c + Math.cos(a) * R * 0.45, lerp(y0, H, 0.55) + 1.5, c + Math.sin(a) * R * 0.45], end = [c + Math.cos(a) * R, H, c + Math.sin(a) * R];
    tube(g, [c + Math.cos(a) * 1.2, y0, c + Math.sin(a) * 1.2], mid, 1.9, 1.4, barkCol);
    tube(g, mid, end, 1.4, 0.8, barkCol);
    const b = a + (rnd() < 0.5 ? -0.6 : 0.6); // a side twig
    tube(g, mid, [c + Math.cos(b) * R * 0.85, H + 3, c + Math.sin(b) * R * 0.85], 1, 0.6, barkCol);
    boughs.push({ a, R, H, b });
  }
  tube(g, [c, 16, c], [c + 0.5, 30, c - 0.5], 2.1, 1.2, barkCol); // leader
  // crown: low broad shelves at the bough ends, a middle ring, a domed top — painted low → high so tops win
  const A = ["#1a4f24", "#2a7a34", "#34964a", "#4cb050"], Bc = ["#1f5e2a", "#2e8a3a", "#44a848", "#62c058"], Cc = ["#24692f", "#3aa848", "#62c25a", "#8ad870"];
  const cl = [];
  for (const { a, R, H, b } of boughs) {
    cl.push([c + Math.cos(a) * R, H + 2, c + Math.sin(a) * R, 6 + rnd() * 1.2, 3.6, A]);
    cl.push([c + Math.cos(b) * R * 0.85, H + 5, c + Math.sin(b) * R * 0.85, 5, 3.4, Bc]);
  }
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.9, R = 7 + rnd() * 2.5; cl.push([c + Math.cos(a) * R, 33 + rnd() * 3, c + Math.sin(a) * R, 6, 3.8, k % 2 ? Bc : A]); }
  cl.push([c, 39, c, 7, 4, Cc]); cl.push([c + 3, 43, c - 1, 4.5, 3, Cc]); cl.push([c - 3, 42, c + 2, 4, 3, Cc]);
  cl.sort((p, q) => p[1] - q[1]);
  for (const [x, y, z, r, ry, cols] of cl) clump(g, x, y, z, r, ry, r * (0.85 + rnd() * 0.3), cols, rnd, { lim: 22, ox: c, oz: c });
  // fresh light-green/bronze new leaves speckled on the upper surfaces
  for (let i = 0; i < 260; i++) { const x = c - 22 + Math.floor(rnd() * 44), z = c - 22 + Math.floor(rnd() * 44);
    for (let y = 50; y > 20; y--) { if (g.get(x, y, z)) { if (rnd() < 0.7) g.set(x, y, z, rnd() < 0.75 ? "#a8e070" : "#c8d860"); break; } } }
  return g;
}

/** Golden ginkgo: tall slender grey-brown trunk, irregular tiers of fan-leaf clumps in autumn gold, fallen leaves. */
export function treeGinkgo() {
  const S = 64, g = new G(S), rnd = rng(2024), c = 32;
  const bark = (x, y, z) => { const r = rnd(); return x + 0.5 > c + 0.4 && r < 0.55 ? "#5a4a3c" : r < 0.15 ? "#8a7864" : r < 0.35 ? "#5a4a3c" : "#6e5c4a"; };
  // fallen leaves: a golden carpet thinning outwards (drawn first so the trunk/roots win)
  const fall = ["#e8a818", "#f8c828", "#ffd84a", "#f0b020", "#ffe680"];
  for (let z = c - 19; z < c + 19; z++) for (let x = c - 19; x < c + 19; x++) { const d = Math.hypot(x + 0.5 - c, z + 0.5 - c); if (d < 2) continue;
    const p = d < 8 ? 0.72 : d < 13 ? 0.42 - (d - 8) * 0.04 : 0.2 - (d - 13) * 0.03; if (rnd() < p) g.set(x, 0, z, pick(rnd, fall)); }
  // trunk: 4 wide flare at the foot, 2 wide above, gentle sway
  for (let y = 0; y <= 44; y++) { const r = y < 3 ? 2.3 - y * 0.2 : y < 30 ? 1.45 : 1.0, ox = Math.sin(y * 0.12) * 0.6;
    for (let z = c - 3; z <= c + 2; z++) for (let x = c - 3; x <= c + 2; x++) if ((x + 0.5 - c - ox) ** 2 + (z + 0.5 - c) ** 2 <= r * r) g.set(x, y, z, bark(x, y, z)); }
  for (const a of [0.4, 2.2, 3.9, 5.3]) tube(g, [c + Math.cos(a) * 1.5, 1, c + Math.sin(a) * 1.5], [c + Math.cos(a) * 4, 0, c + Math.sin(a) * 4], 1, 0.6, bark);
  // tiers: short near-horizontal branches carrying flat clumps, narrowing upwards (radius ≤ ~15, well inside ±22)
  const cols = [["#c88a14", "#e8a818", "#f8c828", "#ffe066"], ["#d09418", "#f0b420", "#ffd23a", "#fff07a"], ["#b87c14", "#e0a020", "#f8c030", "#ffe066"]];
  const tiers = [[10, 11.5], [15.5, 11], [21, 10], [26.5, 9], [32, 7.5], [37, 5.5]];
  const cl = [];
  tiers.forEach(([y, R], i) => {
    const n = i < 3 ? 4 : 3, off = rnd() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a = off + (k / n) * Math.PI * 2 + (rnd() - 0.5) * 1.1, L = R * (0.55 + rnd() * 0.45), ey = y + rnd() * 3.5;
      const ex = c + Math.cos(a) * L, ez = c + Math.sin(a) * L;
      tube(g, [c, y - 1.5, c], [ex, ey, ez], 0.9, 0.5, bark);
      const rr = 3 + R * 0.28 + rnd() * 1.2;
      cl.push([ex, ey + 1, ez, rr, 2.4 + rnd() * 1.2, cols[(i + k) % 3]]);
      if (rnd() < 0.6) cl.push([lerp(c, ex, 0.5), ey + 1.5 + rnd() * 1.5, lerp(c, ez, 0.5), rr * 0.7, 2.4, cols[(i + k + 1) % 3]]);
    }
  });
  cl.push([c, 42, c, 4.5, 3, cols[1]]); cl.push([c + 0.5, 45.5, c - 0.5, 2.6, 2.2, cols[1]]);
  cl.sort((p, q) => p[1] - q[1]);
  for (const [x, y, z, r, ry, cc] of cl) clump(g, x, y, z, r, ry, r * (0.8 + rnd() * 0.35), cc, rnd, { lim: 21, ox: c, oz: c });
  // a few leaves mid-fall
  for (let i = 0; i < 10; i++) { const a = rnd() * Math.PI * 2, d = 4 + rnd() * 13, y = 2 + Math.floor(rnd() * 8); const x = c + Math.cos(a) * d, z = c + Math.sin(a) * d; if (!g.get(x, y, z)) g.set(x, y, z, pick(rnd, fall)); }
  return g;
}

// ---------------------------------------------------------------- garden plots

const X0 = 4, X1 = 35, Z0 = 8, Z1 = 32, CX = 20; // plot cells; gate cells x 18..21
const GRASS = ["#5ab040", "#62b844", "#6cc04a", "#58a83e"];
const TILE = "#4a5664", TILEL = "#6a7888", PLASTER = "#f4efe2", PLASTERD = "#e2dccc";
const GRAVEL = ["#d8d2c2", "#cac4b4", "#e4dece", "#bcb6a6"];

/** Trim anything that spills outside the house footprint (cells x 3..36, z 8..32 = offsets −17..+17, −12..+13). */
function crop(g) { const S = g.size; for (const k of [...g.v.keys()]) { const x = k % S, z = Math.floor(k / S) % S; if (x < 3 || x > 36 || z < 8 || z > 32) g.v.delete(k); } return g; }
function grass(g, rnd) { for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) g.set(x, 0, z, pick(rnd, GRASS)); }
/** Whitewashed garden wall with a grey tile coping; height h (coping on top). Skips cells for which skip(x,z) is true. */
function gardenWall(g, rnd, h, skip, frontH = h) {
  for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) {
    if (!(x === X0 || x === X1 || z === Z0 || z === Z1) || skip(x, z)) continue;
    const H = z === Z1 ? frontH : h;
    for (let y = 1; y < H; y++) g.set(x, y, z, y === 1 ? M.skirt : rnd() < 0.12 ? PLASTERD : PLASTER);
    g.set(x, H, z, (x + z) % 2 ? TILE : TILEL);
  }
}
/** Gate: red posts with gold caps and a little tiled lintel over the opening (cells x 18..21). */
function gate(g, z) {
  for (const x of [17, 22]) { g.box(x, 1, z, x, 6, z, (xx, y) => (y === 6 ? M.gold : y === 1 ? M.stoneD : M.red)); }
  for (let x = 15; x <= 24; x++) { g.set(x, 7, z, x === 15 || x === 24 ? TILEL : TILE); g.set(x, 7, z - 1, TILEL); g.set(x, 7, z + 1 > Z1 ? z : z + 1, TILEL); }
  for (let x = 16; x <= 23; x++) g.set(x, 8, z, TILE);
  g.set(15, 8, z, TILE); g.set(24, 8, z, TILE); g.set(14, 8, z, TILEL); g.set(25, 8, z, TILEL);
  for (let x = 18; x <= 21; x++) g.set(x, 6, z, x === 19 || x === 20 ? M.gold : M.plaque);
}
function gravelPath(g, rnd, x0, z0, x1, z1) { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) g.set(x, 0, z, pick(rnd, GRAVEL)); }
/** Small flowering/leafy tree: thin trunk + a few blobs (radius ~3.5), height ≈ h. */
function smallTree(g, rnd, x, z, h, cols) {
  const th = Math.round(h * 0.45);
  g.box(x, 1, z, x, th, z, M.trunk); g.set(x + 1, 1, z, M.trunkD);
  g.line(x, th - 1, z, x - 2, th + 1, z, M.trunk); g.line(x, th - 1, z, x + 2, th + 1, z + 1, M.trunkD);
  const cy = th + 2.5;
  for (const [dx, dy, dz, r] of [[0, 0.5, 0, 3.4], [-2, -0.5, 0.5, 2.4], [2, -0.5, 0.5, 2.4], [0, -0.5, -2, 2.4], [0, -0.5, 2, 2.4], [0.3, 2.6, 0, 2.3]])
    clump(g, x + dx + 0.5, cy + dy, z + dz + 0.5, r, r * 0.8, r, cols, rnd);
}
const BLOSSOM = [M.pinkD, M.pink, M.pinkL, "#ffffff"];
/** Stone lantern (tōrō-style), 4×4 base at cells x..x+3, z..z+3, 7 tall. Grey stone only. */
function stoneLantern(g, x, z) {
  g.box(x, 1, z, x + 3, 1, z + 3, M.stoneD);
  g.box(x + 1, 2, z + 1, x + 2, 3, z + 2, M.stone);
  g.box(x, 4, z, x + 3, 4, z + 3, M.stoneL);
  g.box(x, 5, z, x + 3, 5, z + 3, (xx, y, zz) => ((xx === x + 1 || xx === x + 2) && (zz === z || zz === z + 3) || (zz === z + 1 || zz === z + 2) && (xx === x || xx === x + 3) ? "#4a4440" : M.stone));
  g.box(x - 1, 6, z - 1, x + 4, 6, z + 4, M.stoneD); g.box(x, 7, z, x + 3, 7, z + 3, M.stone); g.box(x + 1, 8, z + 1, x + 2, 8, z + 2, M.stoneL);
}
/** Wooden bench along x (cells x..x+len-1) at depth z; back rest on side zb (z±1) unless null. */
function bench(g, x, z, len, zb) {
  for (let i = 0; i < len; i++) g.set(x + i, 2, z, i % 2 ? M.woodL : M.wood);
  for (const xx of [x, x + len - 1]) g.set(xx, 1, z, M.woodD);
  if (zb != null) for (let i = 0; i < len; i++) { g.set(x + i, 3, zb, M.woodL); if (i === 0 || i === len - 1) { g.set(x + i, 2, zb, M.woodD); g.set(x + i, 1, zb, M.woodD); } }
}

export function gardenFlower() {
  const S = 40, g = new G(S), rnd = rng(77);
  grass(g, rnd);
  gardenWall(g, rnd, 4, (x, z) => z === Z1 && x >= 17 && x <= 22, 2);
  for (let x = X0; x <= X1; x++) if (x < 17 || x > 22) g.set(x, 2, Z1, x % 2 ? M.woodL : "#f4efe2"); // front: low wall + white/wood railing
  for (let x = X0; x <= X1; x++) if (x < 17 || x > 22) g.set(x, 3, Z1, (x - X0) % 3 === 0 ? M.red : null);
  gate(g, Z1);
  // paths: gate → back, a cross walk, a round gravel court around the lantern
  gravelPath(g, rnd, 18, Z0 + 1, 21, Z1); gravelPath(g, rnd, X0 + 4, 19, X1 - 4, 21);
  for (let z = 15; z <= 25; z++) for (let x = 14; x <= 25; x++) if (Math.hypot(x + 0.5 - CX, z + 0.5 - 20.5) <= 4.6) g.set(x, 0, z, pick(rnd, GRAVEL));
  for (let a = 0; a < 64; a++) { const t = (a / 64) * Math.PI * 2; g.set(Math.floor(CX + Math.cos(t) * 4.9), 0, Math.floor(20.5 + Math.sin(t) * 4.9), M.stoneD); } // court kerb
  for (let z = 26; z <= Z1 - 1; z++) { g.set(17, 0, z, M.stoneD); g.set(22, 0, z, M.stoneD); }
  // raised beds, each its own colour scheme
  const beds = [
    [6, 23, 15, 30, ["#ff6aa0", "#ffffff", "#f8b8c8", "#ff8ab8"]],
    [24, 23, 33, 30, ["#e8343c", "#ffd23a", "#e8343c", "#ff5a4a"]],
    [9, 10, 15, 16, ["#9a5ad8", "#c890f0", "#ffffff", "#7a48c0"]],
    [24, 10, 30, 16, ["#ffd23a", "#f07a2a", "#fff07a", "#ffb030"]],
  ];
  for (const [x0, z0, x1, z1, fl] of beds) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (edge) { g.set(x, 1, z, (x + z) % 2 ? M.stone : M.stoneL); continue; }
      g.set(x, 1, z, "#6a4a32");
      g.set(x, 2, z, rnd() < 0.5 ? M.leafD : M.leaf);
      const r = rnd();
      if (r < 0.55) g.set(x, 3, z, pick(rnd, fl)); else if (r < 0.7) g.set(x, 2, z, pick(rnd, fl)); else if (r < 0.8) g.set(x, 3, z, M.leafL);
    }
  }
  // blossom trees in the back corners, clipped shrubs at the cross-walk ends and by the gate
  smallTree(g, rnd, 8, 12, 12, BLOSSOM); smallTree(g, rnd, 31, 12, 11, ["#d86a9a", "#f08ab8", "#ffb8d8", "#ffe0e8"]);
  for (const [x, z] of [[6, 20], [33, 20], [14.5, 31], [25.5, 31]]) clump(g, x + 0.5, 2.2, z + 0.5, 1.9, 1.6, 1.4, [M.leafD, M.leaf, M.leafL, M.leafLL], rnd);
  // flowers along the foot of the side and back walls
  for (let z = Z0 + 1; z < Z1; z++) for (const x of [X0 + 1, X1 - 1]) if ((z < 18 || z > 22) && !g.get(x, 1, z)) { if (rnd() < 0.55) g.set(x, 1, z, pick(rnd, ["#ff6aa0", "#ffd23a", "#ffffff", "#9a5ad8"])); else g.set(x, 1, z, M.leafD); }
  for (let x = X0 + 2; x < X1 - 1; x++) if (x < 17 || x > 22) if (rnd() < 0.5) g.set(x, 1, Z0 + 1, pick(rnd, ["#ff6aa0", "#ffd23a", "#ffffff"]));
  stoneLantern(g, 18, 19);
  bench(g, 8, 18, 5, 17); bench(g, 27, 18, 5, 17);
  bench(g, 14, 9, 4, null); // under the back wall, facing the court
  return crop(g);
}

export function gardenPond() {
  const S = 40, g = new G(S), rnd = rng(91);
  grass(g, rnd);
  gardenWall(g, rnd, 4, (x, z) => z === Z1 && x >= 17 && x <= 22, 3);
  // leak windows in the back wall (lattice of dark tiles)
  for (const wx of [8, 28]) for (let x = wx; x <= wx + 3; x++) for (let y = 2; y <= 3; y++) g.set(x, y, Z0, (x + y) % 2 ? TILE : null);
  gate(g, Z1);
  // pond: union of blobs, rocky rim, deeper water in the middle
  const blobs = [[16, 21, 9.5, 5.5], [26.5, 19.5, 6.5, 5], [10.5, 24.5, 5, 3.6], [29, 24.5, 4, 3]];
  const inside = (x, z) => blobs.some(([bx, bz, rx, rz]) => ((x + 0.5 - bx) / rx) ** 2 + ((z + 0.5 - bz) / rz) ** 2 <= 1);
  const depth = (x, z) => { let d = 0; for (let k = 1; k <= 3; k++) if ([[k, 0], [-k, 0], [0, k], [0, -k]].every(([a, b]) => inside(x + a, z + b))) d = k; return d; };
  const ROCK = ["#b8b8b0", "#a0a09a", "#c8c8c0", "#8e8e88"];
  for (let z = Z0 + 1; z < Z1; z++) for (let x = X0 + 1; x < X1; x++) {
    if (!inside(x, z)) continue; const d = depth(x, z);
    if (d === 0) { g.set(x, 0, z, pick(rnd, ROCK)); if (rnd() < 0.55) g.set(x, 1, z, pick(rnd, ROCK)); }
    else g.set(x, 0, z, d === 1 ? "#5aa8d8" : d === 2 ? M.water : M.waterD);
  }
  // lily pads with a few pink flowers, two koi
  for (const [x, z] of [[11, 24], [12, 25], [10, 23], [26, 17], [27, 18], [25, 18], [30, 24], [14, 18], [9, 25]]) if (depth(x, z) > 0) {
    g.set(x, 0, z, (x + z) % 2 ? "#3a9a48" : "#58c060"); if ((x * 7 + z) % 3 === 0) g.set(x, 1, z, (x + z) % 2 ? "#ff9ac0" : "#ffffff"); }
  for (const [x, z, dx, dz] of [[12, 20, 1, 0], [25, 21, 0, -1]]) { g.set(x, 0, z, "#ffffff"); g.set(x + dx, 0, z + dz, M.orange); g.set(x + 2 * dx, 0, z + 2 * dz, M.orange); g.set(x + 3 * dx, 0, z + 3 * dz, "#f8a050"); }
  // arched red bridge from the gate path to the back terrace
  gravelPath(g, rnd, 18, 28, 21, Z1);
  for (let z = 14; z <= 27; z++) {
    const t = (z - 14) / 13, y = 1 + Math.round(Math.sin(t * Math.PI) * 2.6);
    for (let x = 18; x <= 21; x++) { g.set(x, y, z, (z % 2) ? M.woodL : M.wood); if (y > 1) g.set(x, y - 1, z, x === 18 || x === 21 ? M.woodD : null); }
    for (const x of [17, 22]) { g.set(x, y, z, M.woodD); g.set(x, y + 1, z, z % 3 === 0 ? M.red : null); g.set(x, y + 2, z, M.red); if (z % 3 === 0) g.set(x, y + 3, z, M.gold); }
  }
  for (const x of [17, 22]) for (const z of [14, 27]) g.box(x, 1, z, x, 3, z, M.stone);
  // back terrace: stone flags and an open pavilion with a bench
  for (let z = Z0 + 1; z <= 13; z++) for (let x = 12; x <= 27; x++) g.set(x, 0, z, (x + z) % 3 ? M.stoneL : M.stone);
  g.box(13, 1, 9, 26, 1, 12, (x, y, z) => (x === 13 || x === 26 || z === 12 ? M.stoneD : M.stone));
  for (const [x, z] of [[14, 9], [25, 9], [14, 12], [25, 12]]) g.box(x, 2, z, x, 7, z, (xx, y) => (y === 7 ? "#9a2a22" : M.red));
  for (let x = 14; x <= 25; x++) { g.set(x, 7, 12, x % 3 === 0 ? M.gold : M.beam); g.set(x, 7, 9, M.beam); }
  for (let x = 15; x <= 24; x++) g.set(x, 6, 12, x % 2 ? M.red : null); // fretwork under the front beam
  bench(g, 16, 10, 8, 9);
  hipRoof(g, 11, 28, 8, 14, 8, { zs: [1, 1, 1], xs: [1, 1, 1] });
  // scholar's rocks: tall porous limestone
  const lime = ["#c4c4bc", "#aeaea6", "#d4d4cc", "#98988f"];
  for (const [x, z, h, w] of [[7, 18, 8, 1.6], [31, 13, 6, 1.4], [25, 27, 4, 1.2], [8, 13, 4, 1.1]]) {
    for (let y = 1; y <= h; y++) { const r = w * (y < 2 ? 1.2 : 0.8 + 0.45 * Math.sin(y * 1.3 + x)), ox = Math.sin(y * 0.9 + z) * 0.7;
      for (let zz = z - 2; zz <= z + 2; zz++) for (let xx = x - 2; xx <= x + 2; xx++) if ((xx - x - ox) ** 2 + (zz - z) ** 2 <= r * r) g.set(xx, y, zz, rnd() < 0.13 ? "#5e5e5a" : pick(rnd, lime)); }
  }
  // bamboo clumps: back-left corner and front-right corner
  const bamboo = (bx, bz, n) => { for (let i = 0; i < n; i++) {
    const x = bx + Math.round((rnd() - 0.5) * 5), z = bz + Math.round((rnd() - 0.5) * 4), h = 10 + Math.floor(rnd() * 5);
    for (let y = 1; y < h; y++) g.set(x, y, z, y % 4 === 3 ? M.leafD : M.leafLL);
    for (let k = 0; k < 6; k++) { const yy = h - 1 - Math.floor(rnd() * 5), dx = Math.round((rnd() - 0.5) * 4), dz = Math.round((rnd() - 0.5) * 4); g.line(x, yy, z, x + dx, yy + 1, z + dz, rnd() < 0.5 ? M.leaf : M.leafL); } } };
  bamboo(7, 10.5, 7); bamboo(31, 29, 7);
  // weeping willow on the right bank
  { const x = 32, z = 16; g.box(x, 1, z, x, 6, z, M.trunk); g.line(x, 5, z, x - 2, 8, z, M.trunkD); g.line(x, 5, z, x, 8, z + 2, M.trunk);
    const W = ["#4aa040", "#6abc4a", "#8ad060", "#a8e070"];
    clump(g, x - 1 + 0.5, 9.5, z + 0.5, 4.2, 2.6, 4.2, W, rnd);
    for (let i = 0; i < 34; i++) { const a = rnd() * Math.PI * 2, d = 2.5 + rnd() * 2, sx = Math.round(x - 1 + Math.cos(a) * d), sz = Math.round(z + Math.sin(a) * d), lo = 2 + Math.floor(rnd() * 4);
      if (sx > X1 - 1) continue; for (let y = 8; y >= lo; y--) g.set(sx, y, sz, y % 2 ? W[1] : W[2]); } }
  // blossom tree front-left
  smallTree(g, rnd, 9, 27, 11, BLOSSOM);
  // flower edging along the path and the inner wall foot
  for (let z = 28; z < Z1; z++) for (const x of [16, 23]) g.set(x, 1, z, pick(rnd, ["#ff6aa0", "#ffd23a", "#ffffff", "#9a5ad8"]));
  for (let x = X0 + 1; x < X1; x++) if ((x < 15 || x > 24) && !g.get(x, 1, Z1 - 1)) g.set(x, 1, Z1 - 1, rnd() < 0.6 ? pick(rnd, ["#ff6aa0", "#ffd23a", "#ffffff", "#e8343c"]) : M.leafD);
  for (let z = 15; z < 28; z++) for (const x of [X0 + 1]) if (!g.get(x, 1, z)) g.set(x, 1, z, rnd() < 0.5 ? pick(rnd, ["#ff6aa0", "#ffffff", "#9a5ad8"]) : M.leafD);
  // stepping stones across the lawn from the left bank to the terrace
  for (const [x, z] of [[11, 14], [10, 16]]) g.box(x, 0, z, x + 1, 0, z, M.stoneL);
  return crop(g);
}
