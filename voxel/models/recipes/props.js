// Trees, street props, vehicles (forward = +X) and river pieces.
import { G, rng, figure, seated, wheel } from "./lib.js";
import { M, ROOF, CLOTH, PILLAR, roofRamp, clothRamp } from "./colors.js";
import { hipRoof } from "./buildings.js";

const R = roofRamp(ROOF), CL = clothRamp(CLOTH);

/** Leafy canopy from overlapping blobs with ragged edges, shaded dark → light by height plus noise. */
function canopy(g, blobs, cols, rnd) {
  const [D, B, L, LL] = cols, cells = [];
  for (const [cx, cy, cz, r] of blobs) { const ry = r * 0.85;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let z = Math.floor(cz - r); z <= cz + r; z++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / r) ** 2; if (d <= 1 && !(d > 0.8 && rnd() < 0.35)) cells.push([x, y, z]); } }
  const top = Math.max(...cells.map((c) => c[1])), bot = Math.min(...cells.map((c) => c[1]));
  for (const [x, y, z] of cells) { const t = (y - bot) / (top - bot) + (rnd() - 0.5) * 0.35; g.set(x, y, z, t > 0.85 ? LL : t > 0.55 ? L : t > 0.25 ? B : D); }
}
export function tree(kind) {
  const S = 24, g = new G(S), rnd = rng(kind.length * 13 + 1), c = 12;
  if (kind === "pine") {
    g.box(c, 0, c, c, 4, c, M.trunk);
    let y = 3; for (const r of [7, 6, 5, 4, 3, 2]) { for (let k = 0; k < 3; k++) { const rr = r - k * 0.9; if (rr > 0.4) g.disc(c, y + k, c, rr, (x, yy, z) => (k === 0 ? M.leafD : rnd() < 0.3 ? M.leafL : M.leaf)); } y += 3; }
    g.set(c, y, c, M.leafL);
    return g;
  }
  if (kind === "bamboo") {
    for (let i = 0; i < 9; i++) { const x = c + Math.round((rnd() - 0.5) * 9), z = c + Math.round((rnd() - 0.5) * 9), h = 13 + Math.floor(rnd() * 9);
      for (let y = 0; y < h; y++) g.set(x, y, z, y % 4 === 3 ? M.leafD : M.leafLL);
      for (let k = 0; k < 6; k++) { const yy = h - 1 - Math.floor(rnd() * 6), dx = Math.round((rnd() - 0.5) * 4), dz = Math.round((rnd() - 0.5) * 4); g.line(x, yy, z, x + dx, yy + 1, z + dz, rnd() < 0.5 ? M.leaf : M.leafL); } }
    return g;
  }
  g.box(c, 0, c, c + 1, 7, c + 1, (x) => (x === c + 1 ? M.trunkD : M.trunk)); g.set(c - 1, 0, c, M.trunk); g.set(c + 2, 0, c + 1, M.trunkD);
  g.line(c, 6, c, c - 3, 9, c, M.trunk); g.line(c + 1, 6, c + 1, c + 4, 9, c + 1, M.trunkD);
  const blobs = [[c + 0.5, 12, c + 0.5, 6], [c - 3.5, 10, c, 4.5], [c + 4.5, 10, c + 1, 4.5], [c, 10, c - 3.5, 4.5], [c + 1, 10, c + 4.5, 4.5], [c + 0.5, 15.5, c + 0.5, 4]];
  canopy(g, blobs, kind === "blossom" ? [M.pinkD, M.pink, M.pinkL, "#ffffff"] : [M.leafD, M.leaf, M.leafL, M.leafLL], rnd);
  if (kind === "fruit") for (let i = 0; i < 18; i++) { const a = rnd() * Math.PI * 2, y = 8 + rnd() * 9; const x = c + Math.cos(a) * 6.2, z = c + Math.sin(a) * 6.2; if (g.get(x, y, z)) g.set(x, y, z, M.orange); }
  return g;
}

export function lanternPost() { const g = new G(12), c = 6; g.box(c - 1, 0, c - 1, c + 1, 0, c + 1, M.stone); g.box(c, 1, c, c, 13, c, PILLAR); g.box(c - 3, 13, c, c + 3, 13, c, PILLAR);
  for (const x of [c - 3, c + 3]) { g.set(x, 12, c, M.goldD); g.box(x, 10, c, x, 11, c, M.lantern); g.set(x, 9, c, M.gold); } return g; }
export function well() { const g = new G(16), c = 7;
  for (let y = 0; y <= 3; y++) for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; g.set(c + Math.cos(a) * 5, y, c + Math.sin(a) * 5, y === 3 ? M.stoneL : (k + y) % 3 ? M.stone : M.stoneD); }
  g.disc(c, 2, c, 4, M.waterD); for (const x of [c - 5, c + 5]) g.box(x, 4, c, x, 10, c, M.wood); g.box(c - 5, 10, c, c + 5, 10, c, M.woodD); g.box(c, 6, c, c, 9, c, M.ink); g.box(c, 5, c, c, 5, c, M.stoneD);
  hipRoof(g, c - 6, c + 6, c - 4, c + 4, 11, { zs: [1, 1, 1], xs: [1, 1, 1] }); return g; }
export function haystack() { const g = new G(14), rnd = rng(3); g.ball(7, 0, 7, 6, 8, 6, (x, y) => (rnd() < 0.2 ? M.hayD : y > 5 ? M.hayL : M.hay)); return g; }
export function jars() { const g = new G(12), prof = [1.4, 2, 2.4, 2.4, 2, 1.4, 1.2];
  for (const [cx, cz, col, h] of [[3, 3, M.jarBlue, 7], [8, 4, M.jarBrown, 6], [5, 8, "#3aa060", 5]]) for (let y = 0; y < h; y++) g.disc(cx, y, cz, prof[Math.min(y, 6)] * (h / 7 + 0.3), y === h - 1 ? M.ink : y === 2 ? "#ffffff" : col);
  return g; }
export function crateStack() { const g = new G(12);
  const crate = (x, y, z, n) => g.box(x, y, z, x + n, y + n, z + n, (xx, yy, zz) => ((xx === x || xx === x + n) && (yy === y || yy === y + n || zz === z || zz === z + n) || (yy === y || yy === y + n) && (zz === z || zz === z + n) ? M.woodD : M.woodL));
  crate(1, 0, 1, 5); crate(6, 0, 3, 4); crate(2, 6, 2, 4); return g; }
export function target() { const g = new G(12), c = 6; g.line(c - 2, 0, c, c, 6, c, M.wood); g.line(c + 2, 0, c, c, 6, c, M.wood);
  for (const [r, col] of [[5, M.hay], [4, M.tomato], [3, M.cream], [2, M.tomato], [1, M.cream]]) g.disc(c, 7, c + 1, r, col, "z"); return g; }

// ---- vehicles (forward +X)
export function rickshaw() { const g = new G(24);
  wheel(g, 8, 5, 6, 5); wheel(g, 8, 5, 17, 5); g.line(8, 5, 6, 8, 5, 17, M.woodD);
  g.box(5, 6, 7, 12, 8, 16, (x, y) => (y === 8 ? CL.d : CLOTH)); g.box(5, 9, 7, 5, 12, 16, CLOTH);
  for (let z = 7; z <= 16; z++) { g.set(5, 13, z, "#3a3440"); g.set(6, 14, z, "#3a3440"); g.set(7, 14, z, "#3a3440"); g.set(8, 13, z, "#4a4450"); }
  seated(g, 8, 9, 10, { top: "#d04a6a" });
  g.line(12, 7, 7, 21, 6, 7, M.woodL); g.line(12, 7, 16, 21, 6, 16, M.woodL);
  figure(g, 17, 0, 10, { top: "#f0e8d0", bottom: "#3a6ad8", hat: "straw" }); return g; }
export function oxcart() { const g = new G(32), rnd = rng(8);
  g.box(2, 4, 9, 15, 4, 18, M.wood); for (const z of [9, 18]) g.box(2, 5, z, 15, 6, z, M.woodL); g.box(2, 5, 9, 2, 6, 18, M.woodL);
  wheel(g, 8, 5, 8, 5); wheel(g, 8, 5, 19, 5); g.line(8, 5, 8, 8, 5, 19, M.woodD);
  g.ball(8, 6, 13.5, 6, 5, 4, (x, y) => (rnd() < 0.2 ? M.hayD : y > 9 ? M.hayL : M.hay));
  seated(g, 14, 5, 12, { top: "#8a5a32", hat: "straw" });
  g.line(15, 5, 13, 20, 5, 13, M.woodD);
  const ox = "#8a5a32", oxD = "#6a4424", oxL = "#a87a4a";
  g.box(19, 5, 11, 27, 9, 16, (x, y) => (y === 9 ? oxL : y === 5 ? oxD : ox)); for (const [x, z] of [[20, 11], [20, 16], [26, 11], [26, 16]]) g.box(x, 0, z, x, 4, z, oxD);
  g.box(28, 7, 12, 30, 10, 15, ox); g.box(31, 7, 12, 31, 8, 15, oxL); g.set(30, 9, 12, M.ink); g.set(30, 9, 15, M.ink);
  g.line(28, 11, 12, 28, 12, 10, M.cream); g.line(28, 11, 15, 28, 12, 17, M.cream); g.box(18, 6, 13, 18, 8, 13, oxD);
  g.box(27, 10, 10, 27, 10, 17, M.woodD); return g; }
export function sedan() { const g = new G(24);
  g.box(8, 6, 8, 15, 15, 15, (x, y, z) => (y === 6 || y === 15 ? M.gold : (z === 8 || z === 15) && y >= 9 && y <= 12 && x >= 10 && x <= 13 ? M.paper : x === 15 ? CL.d : CLOTH));
  hipRoof(g, 6, 17, 6, 17, 16, { zs: [1, 1, 1], xs: [1, 1, 1], pearl: true });
  for (const z of [7, 16]) g.line(0, 10, z, 23, 10, z, M.woodL);
  figure(g, 1, 0, 10, { top: "#c8342a", bottom: "#c8342a", hat: "cap" }); figure(g, 19, 0, 10, { top: "#c8342a", bottom: "#c8342a", hat: "cap" }); return g; }
export function barrow() { const g = new G(16), rnd = rng(4);
  g.box(7, 3, 5, 13, 4, 10, M.woodL); for (let x = 7; x <= 13; x++) for (let z = 5; z <= 10; z++) if (rnd() < 0.8) g.set(x, 5, z, [M.veg, M.orange, M.tomato, M.hay][Math.floor(rnd() * 4)]);
  wheel(g, 13, 3, 7, 2.5); wheel(g, 13, 3, 8, 2.5); g.line(7, 4, 5, 3, 5, 5, M.woodD); g.line(7, 4, 10, 3, 5, 10, M.woodD); g.box(8, 0, 5, 8, 2, 5, M.woodD); g.box(8, 0, 10, 8, 2, 10, M.woodD);
  figure(g, 0, 0, 6, { top: "#8a8a96", bottom: "#3a2a22", hat: "straw" }); return g; }

// ---- river
export function boat() { const g = new G(32), c = 16;
  for (let x = 1; x <= 30; x++) { const w = Math.min(4, Math.floor((x - 1) / 2), Math.floor((30 - x) / 2)); if (w < 1) continue;
    for (let y = 0; y <= 3; y++) { const ww = y === 0 ? w - 1 : w; for (let z = c - ww; z <= c + ww; z++) { const edge = z === c - ww || z === c + ww || y === 0; if (edge || y === 1) g.set(x, y, z, y === 3 ? M.woodL : y === 0 ? M.woodD : M.wood); } } }
  for (const x of [1, 2, 29, 30]) g.set(x, 4, c, M.woodL);
  for (let x = 10; x <= 19; x++) for (let z = c - 4; z <= c + 4; z++) { const y = 4 + Math.round(Math.sqrt(Math.max(0, 16 - (z - c) ** 2))); g.set(x, y, z, x % 2 ? "#d8b070" : "#b89050"); if (Math.abs(z - c) === 4) g.box(x, 4, z, x, y, z, x % 2 ? "#d8b070" : "#b89050"); }
  figure(g, 4, 1, c - 1, { top: "#3a6ad8", bottom: "#2a2030", hat: "straw" }); g.line(7, 9, c - 2, 0, 0, c - 2, M.woodL);
  g.box(22, 2, c - 2, 24, 3, c + 1, M.woodL); g.box(25, 2, c - 1, 26, 4, c, M.jarBrown); return g; }
export function waterwheel() { const g = new G(28), c = 13;
  for (const z of [10, 15]) wheel(g, c, c, z, 11, M.woodD, M.wood);
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; g.box(Math.round(c + Math.cos(a) * 11.5), Math.round(c + Math.sin(a) * 11.5), 10, Math.round(c + Math.cos(a) * 12.4), Math.round(c + Math.sin(a) * 12.4), 15, M.woodL); }
  g.line(c, c, 7, c, c, 18, M.ink); return g; }
