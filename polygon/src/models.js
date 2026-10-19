// Low-poly static models: buildings, palace, landmarks, trees, props, vehicles, rope machinery, airships, the statue.
// Each model is a function painting into a Builder (geo.js). Conventions (same as the voxel edition so the shared
// layout fits): placed by the centre of the footprint in x/z, y = 0 at the floor, front faces +z; vehicles and boats
// face +x. Footprints and attachment points match the old voxel models (see README "Models").
import { Builder, ROOF, WALLC, PIL, CLOTHC, shade, rng } from "./geo.js";
import { PED, FIG, EAGLE } from "./perches.js";

export const C = {
  stone: "#b0aca2", stoneD: "#8e8a82", stoneL: "#cdc8bc", skirt: "#9e978b",
  wood: "#8a5a32", woodD: "#5e3a1e", woodL: "#b07a44", paper: "#f6e6b8", lattice: "#8a5a32",
  door: "#c8342a", doorD: "#9a2a22", gold: "#f0c040", goldD: "#b8862a", beam: "#2f6fa8", jade: "#3aa080", plaque: "#2a2a48",
  red: "#d8342a", lantern: "#e0382c", leaf: "#3aa848", leafD: "#2a7f38", leafL: "#58c060", leafLL: "#86d870",
  trunk: "#7a5232", trunkD: "#5a3a22", pink: "#f6b4c6", pinkD: "#de8aa2", pinkL: "#ffdce6", hay: "#e8c048", hayD: "#c8a030", hayL: "#f6dc78",
  water: "#3a8ac8", waterD: "#2a6aa8", cream: "#fff4d8", ink: "#2a1f2d", skin: "#f0c498", straw: "#e0c080", strawD: "#b89858",
  jarBlue: "#2f6fa8", jarBrown: "#a0603a", veg: "#58c060", orange: "#f07a2a", tomato: "#e04a3a",
  marble: "#eeebe4", marbleD: "#d4cfc4", marbleL: "#faf8f2", iron: "#4e4c58", ironL: "#6e6c7a", rope: "#d4b27a", ropeD: "#a88550",
  earth: "#a07e54", earthD: "#86663e", brick: "#bdb39f", brickD: "#9a907e", brickL: "#d2cab8", moss: "#6a9a58",
};

// ---------------------------------------------------------------------------------------------------------------
// shared building parts
/** Hanging lantern (glows at night + a light source): hook at y, body below. */
export function lantern(b, x, y, z, s = 1) {
  b.cyl(x, y - 0.35 * s, z, 0.35 * s, y, 0.22 * s, 6, C.goldD, { bottom: false });
  b.glowing("lantern", () => b.cyl(x, y - 1.9 * s, z, 0.62 * s, y - 0.35 * s, 0.62 * s, 6, C.lantern, { top: false, bottom: false }));
  b.cyl(x, y - 2.5 * s, z, 0.05, y - 1.9 * s, 0.45 * s, 6, C.gold, { bottom: false });
  b.light(x, y - 1.2 * s, z, "lantern");
}
/** A window on a wall face. face: "front" (+z), "back" (-z), "left" (-x), "right" (+x); u = centre along the face. */
function windowOn(b, face, X0, X1, Z0, Z1, u, y, w, h, kind = "lattice", lit = true) {
  // flat quads standing just proud of the wall: a dark frame, the paper (or slatted) pane, lattice bars
  b.save(() => {
    if (face === "front") b.t(u, 0, Z1); else if (face === "back") b.t(u, 0, Z0).ry(Math.PI); else if (face === "right") b.t(X1, 0, u).ry(Math.PI / 2); else b.t(X0, 0, u).ry(-Math.PI / 2);
    const q = (x0, y0, x1, y1, z, col) => b.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], col);
    q(-w / 2 - 0.4, y - 0.4, w / 2 + 0.4, y + h + 0.4, 0.06, C.woodD);
    b.quad([-w / 2 - 0.4, y + h + 0.4, 0.06], [w / 2 + 0.4, y + h + 0.4, 0.06], [w / 2 + 0.5, y + h + 0.5, 0.45], [-w / 2 - 0.5, y + h + 0.5, 0.45], C.woodD);   // a little sill-cap
    const pane = () => q(-w / 2, y, w / 2, y + h, 0.12, kind === "slats" ? C.woodL : C.paper);
    if (lit && kind !== "slats") b.glowing("window", pane); else pane();
    if (kind === "lattice") { q(-0.14, y, 0.14, y + h, 0.18, C.lattice); q(-w / 2, y + h / 2 - 0.14, w / 2, y + h / 2 + 0.14, 0.18, C.lattice); }
    else for (let k = 1; k < 4; k++) { const yy = y + (h * k) / 4; q(-w / 2, yy - 0.13, w / 2, yy + 0.13, 0.18, C.woodD); }
    if (lit && kind !== "slats") b.light(0, y + h / 2, 1, "window");
  });
}
/** Plastered walls with a stone skirt, a painted beam band under the eaves and corner posts. */
function walls(b, x0, x1, z0, z1, y0, y1, o = {}) {
  b.box(x0 - 0.3, y0, z0 - 0.3, x1 + 0.3, y0 + 1, z1 + 0.3, C.skirt, { bottom: false });
  b.box(x0, y0 + 1, z0, x1, y1 - 1, z1, o.wall ?? WALLC(1), { bottom: false, top: false === o.top ? undefined : WALLC(0.8) });
  b.box(x0 - 0.2, y1 - 1, z0 - 0.2, x1 + 0.2, y1, z1 + 0.2, o.band ?? C.beam, { bottom: false, top: C.woodD });
  if (o.posts !== false) for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) b.box(x - 0.6, y0 + 1, z - 0.6, x + 0.6, y1 - 1, z + 0.6, PIL(0.9), { bottom: false });
}
/** Red double door with gold studs at local x = cx on the front face z. */
function door(b, cx, z, y0, h, w = 4, plaque = false) {
  b.box(cx - w / 2 - 0.4, y0, z - 0.1, cx + w / 2 + 0.4, y0 + h + 0.5, z + 0.25, C.woodD, { bottom: false });
  b.box(cx - w / 2, y0, z + 0.25, cx - 0.05, y0 + h, z + 0.4, C.door, { bottom: false }); b.box(cx + 0.05, y0, z + 0.25, cx + w / 2, y0 + h, z + 0.4, C.doorD, { bottom: false });
  for (const sx of [-1, 1]) b.cube(cx + sx * 0.6, y0 + h * 0.45, z + 0.5, 0.35, 0.6, 0.2, C.gold);
  if (plaque) b.box(cx - 1.8, y0 + h + 0.8, z + 0.2, cx + 1.8, y0 + h + 2.2, z + 0.5, C.plaque, { bottom: false });
}
/** Row of pillars with a painted beam along x at depth z. */
function colonnade(b, xs, z, y0, y1, beamX0, beamX1) {
  for (const x of xs) { b.cyl(x, y0, z, 0.75, y0 + 0.6, 0.75, 6, C.stone, { bottom: false }); b.cyl(x, y0 + 0.6, z, 0.5, y1, 0.5, 6, PIL(1), { bottom: false, top: false }); }
  b.box(beamX0, y1 - 0.2, z - 0.55, beamX1, y1 + 0.9, z + 0.55, C.beam, { top: C.woodD });
  for (let x = beamX0 + 1.5; x < beamX1 - 1; x += 3) b.quad([x - 0.3, y1 + 0.1, z + 0.6], [x + 0.3, y1 + 0.1, z + 0.6], [x + 0.3, y1 + 0.7, z + 0.6], [x - 0.3, y1 + 0.7, z + 0.6], C.gold);
}
function stonePlatform(b, x0, x1, z0, z1, h = 1) { b.box(x0, 0, z0, x1, h, z1, C.stoneL, { bottom: false, sides: C.stoneD }); }
function railing(b, a, c, y, h = 1.4, col = C.woodL, step = 2.4) {
  const [x0, z0] = a, [x1, z1] = c, len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / step));
  b.beam([x0, y + h, z0], [x1, y + h, z1], 0.18, col); b.beam([x0, y + h * 0.45, z0], [x1, y + h * 0.45, z1], 0.12, col);
  for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; b.beam([x, y, z], [x, y + h + 0.15, z], 0.17, C.woodD); }
}
function crate(b, x, y, z, s, col = C.woodL) { b.cube(x, y, z, s, s, s, col, { top: shade(col, 1.08) }); b.cube(x, y + s - 0.01, z, s + 0.1, 0.3, s + 0.1, C.woodD); b.cube(x, y, z, s + 0.1, 0.3, s + 0.1, C.woodD); }
function jar(b, x, y, z, s, col) { b.cyl(x, y, z, 0.6 * s, y + 0.5 * s, 0.95 * s, 7, col).cyl(x, y + 0.5 * s, z, 0.95 * s, y + 1.3 * s, 0.85 * s, 7, col).cyl(x, y + 1.3 * s, z, 0.85 * s, y + 1.7 * s, 0.4 * s, 7, col).cyl(x, y + 1.7 * s, z, 0.45 * s, y + 1.9 * s, 0.45 * s, 7, C.ink); }
function flag(b, x, y, z, len, h, col, col2) { b.quad([x, y, z], [x, y - h, z], [x + len, y - h * 0.65, z], [x + len, y - h * 0.15, z], col); b.quad([x + len, y - h * 0.15, z], [x + len, y - h * 0.65, z], [x, y - h, z], [x, y, z], col2 ?? col); }
/** Box with an arched tunnel along z (gates, bridges): solid [x0,x1]×[y0,y1]×[z0,z1], opening |x - ax| < r up to spring + r. */
function archBlock(b, x0, x1, y0, y1, z0, z1, ax, r, spring, col, o = {}) {
  const n = 8, top = o.top ?? col, inner = o.inner ?? shade(col, 0.82);
  b.box(x0, y0, z0, ax - r, y1, z1, col, { top }); b.box(ax + r, y0, z0, x1, y1, z1, col, { top });
  const arc = []; for (let k = 0; k <= n; k++) { const a = Math.PI - (k / n) * Math.PI; arc.push([ax + Math.cos(a) * r, spring + Math.sin(a) * r]); }
  // spandrel above the arch on both faces + the deck slab top
  for (let k = 0; k < n; k++) { const [xa, ya] = arc[k], [xb, yb] = arc[k + 1];
    b.quad([xa, ya, z1], [xb, yb, z1], [xb, y1, z1], [xa, y1, z1], col); b.quad([xb, yb, z0], [xa, ya, z0], [xa, y1, z0], [xb, y1, z0], col);
    b.quad([xa, ya, z1], [xa, ya, z0], [xb, yb, z0], [xb, yb, z1], inner); }
  b.quad([ax - r, y1, z1], [ax + r, y1, z1], [ax + r, y1, z0], [ax - r, y1, z0], top);
  b.quad([ax - r, y0, z0], [ax - r, spring, z0], [ax - r, spring, z1], [ax - r, y0, z1], inner); b.quad([ax + r, y0, z1], [ax + r, spring, z1], [ax + r, spring, z0], [ax + r, y0, z0], inner);
  void o;
}
function crenels(b, x0, x1, z, y, w = 1.6, gap = 1.6, d = 1.2, col = C.brick) { for (let x = x0; x + w <= x1 + 0.01; x += w + gap) b.box(x, y, z - d / 2, x + w, y + 1.8, z + d / 2, col, { bottom: false }); }

// ---------------------------------------------------------------------------------------------------------------
// houses (40-grid footprint: platform ±15 × −10..+13, walls ±12 × ±8, door at x 0 on the front wall z +8)
function house(kind) {
  return (b) => {
    const two = kind === "home2" || kind === "inn", H1 = two ? 9 : 12, x0 = -12, x1 = 12, z0 = -8, z1 = 8;
    stonePlatform(b, -15, 15, -10, 13, 1);
    walls(b, x0, x1, z0, z1, 1, H1 + 1);
    door(b, 0, z1, 1, two ? 7 : 9, 4, !two);
    const wy = two ? 3.5 : 4.5, wh = two ? 3.5 : 4.5;
    windowOn(b, "front", x0, x1, z0, z1, -8, wy, 4, wh, "lattice"); windowOn(b, "front", x0, x1, z0, z1, 8, wy, 4, wh, kind === "home1" ? "slats" : "lattice");
    windowOn(b, "back", x0, x1, z0, z1, -6, wy, 4, wh); windowOn(b, "back", x0, x1, z0, z1, 6, wy, 4, wh, "slats");
    windowOn(b, "left", x0, x1, z0, z1, -2, wy, 4, wh, "slats"); windowOn(b, "right", x0, x1, z0, z1, -2, wy, 4, wh, "slats");
    colonnade(b, kind === "shop" ? [x0, x1] : [x0, x0 + 6, x1 - 6, x1], 10, 1, H1, x0 - 0.6, x1 + 0.6);
    b.box(x0, H1 + 0.6, 8, x1, H1 + 1, 10.5, C.woodD);
    if (kind !== "inn") { lantern(b, x0 + 3, H1 - 0.3, 10); lantern(b, x1 - 3, H1 - 0.3, 10); }
    if (!two) b.roof(x0, x1, z0, z1 + 2, H1 + 1, 9.5, { ov: 3.6, up: 1.8 });
    else {
      b.roof(x0, x1, z0, z1 + 2, H1 + 1, 3.2, { ov: 3, up: 1.4, ridge: false, bands: 2 });
      const u0 = -10, u1 = 10, w0 = -6, w1 = 6, Y = H1 + 2.5, H2 = Y + 8;
      walls(b, u0, u1, w0, w1, Y, H2);
      for (const a of [-6.5, 0, 6.5]) windowOn(b, "front", u0, u1, w0, w1, a, Y + 2.5, 3.6, 3.5, "lattice");
      windowOn(b, "back", u0, u1, w0, w1, 0, Y + 2.5, 4, 3.5); windowOn(b, "left", u0, u1, w0, w1, 0, Y + 2.5, 3.4, 3.5, "slats"); windowOn(b, "right", u0, u1, w0, w1, 0, Y + 2.5, 3.4, 3.5, "slats");
      b.box(u0 - 1, Y + 0.5, w1, u1 + 1, Y + 1, w1 + 2, C.woodD); railing(b, [u0 - 1, w1 + 1.8], [u1 + 1, w1 + 1.8], Y + 1, 1.4, PIL(1));
      if (kind === "inn") { lantern(b, u0 + 1, H2 - 0.5, w1 + 1.5); lantern(b, u1 - 1, H2 - 0.5, w1 + 1.5); }
      b.roof(u0, u1, w0, w1 + 1, H2, 8.5, { ov: 3.6, up: 1.8 });
    }
    if (kind === "shop") { // striped awning, signboard, produce
      for (let i = 0; i < 6; i++) { const xa = -6 + i * 2, col = i % 2 ? C.cream : CLOTHC(1); b.quad([xa, 9.5, 8.6], [xa, 7, 12.2], [xa + 2, 7, 12.2], [xa + 2, 9.5, 8.6], col); b.quad([xa + 2, 9.5, 8.6], [xa + 2, 7, 12.2], [xa, 7, 12.2], [xa, 9.5, 8.6], i % 2 ? shade(C.cream, 0.8) : CLOTHC(0.7)); }
      b.box(-5, 10.6, 8.2, 5, 12, 8.6, C.plaque); b.box(-1.5, 11, 8.6, 1.5, 11.6, 8.75, C.gold, { bottom: false });
      for (const bx of [-9.5, 7.5]) { b.box(bx - 1.5, 1, 11, bx + 1.5, 2, 13, C.woodL); for (let k = 0; k < 4; k++) b.blob(bx - 0.8 + (k % 2) * 1.6, 2.3, 11.6 + Math.floor(k / 2) * 0.9, 0.7, 0.5, 0.6, [C.veg, C.orange, C.tomato, C.hay][(k + (bx > 0 ? 1 : 0)) % 4], { seed: k + 3 }); }
    }
    if (kind === "inn") { // tall banner pole
      b.cyl(17, 1, 11.5, 0.35, 31, 0.3, 5, C.woodD); b.cone(17, 31, 11.5, 0.5, 1.2, 5, C.gold);
      b.box(17.3, 17, 11.35, 20.2, 29, 11.65, C.cream); b.box(17.3, 28.3, 11.3, 20.4, 29.3, 11.7, CLOTHC(1)); b.box(17.3, 16.6, 11.3, 20.4, 17.4, 11.7, CLOTHC(1));
      for (let y = 19; y < 28; y += 3) b.box(18.2, y, 11.25, 19.3, y + 1.4, 11.75, C.ink);
    }
    if (kind === "home1") { crate(b, 13, 1, -9, 2.2); crate(b, 13.4, 3.2, -9.2, 1.6, C.wood); jar(b, -13.5, 1, 11, 1, C.jarBlue); }
    if (kind === "home2") { jar(b, 13.5, 1, 11, 1.1, C.jarBrown); b.box(-14.5, 1, -9.5, -13, 2.5, -6, C.woodL); }
  };
}
/** Walled courtyard manor (siheyuan): gateway at x 0 on the front (z +12), main hall at the back, side wings, a tree. */
function manor(b) {
  stonePlatform(b, -17, 17, -13, 13, 0.6);
  // perimeter wall with a tiled coping, gap for the gateway
  const wallSeg = (xa, za, xb, zb) => { b.box(Math.min(xa, xb) - 0.6, 0.6, Math.min(za, zb) - 0.6, Math.max(xa, xb) + 0.6, 7, Math.max(za, zb) + 0.6, WALLC(1), { top: WALLC(0.8) });
    b.box(Math.min(xa, xb) - 1.1, 7, Math.min(za, zb) - 1.1, Math.max(xa, xb) + 1.1, 7.6, Math.max(za, zb) + 1.1, ROOF(1)); b.box(Math.min(xa, xb) - 0.4, 7.6, Math.min(za, zb) - 0.4, Math.max(xa, xb) + 0.4, 8.3, Math.max(za, zb) + 0.4, ROOF(0.5)); };
  wallSeg(-16, -12, 16, -12); wallSeg(-16, -12, -16, 12); wallSeg(16, -12, 16, 12); wallSeg(-16, 12, -3, 12); wallSeg(3, 12, 16, 12);
  // gateway
  door(b, 0, 11.4, 0.6, 7, 5, false);
  colonnade(b, [-3.5, 3.5], 13, 0.6, 9, -4.5, 4.5);
  b.roof(-4, 4, 10, 14, 9.6, 3.5, { ov: 2.2, up: 1.2, bands: 2 }); lantern(b, -3.5, 8.6, 14); lantern(b, 3.5, 8.6, 14);
  // main hall at the back
  walls(b, -11, 11, -10, -1, 0.6, 9.6);
  door(b, 0, -1, 0.6, 7, 3.6); windowOn(b, "front", -11, 11, -10, -1, -7, 3, 3.6, 3.6); windowOn(b, "front", -11, 11, -10, -1, 7, 3, 3.6, 3.6);
  colonnade(b, [-11, -6, 6, 11], 0.6, 0.6, 9.4, -11.6, 11.6);
  b.roof(-11, 11, -10, 1, 9.6, 7.5, { ov: 3, up: 1.6 });
  // side wings
  for (const [a, c] of [[-14, -8], [8, 14]]) { walls(b, a, c, 2, 9, 0.6, 7); windowOn(b, a < 0 ? "right" : "left", a, c, 2, 9, 5.5, 2.5, 2.6, 2.6, "slats"); b.roof(a, c, 2, 9, 7, 4, { ov: 1.6, up: 1, axis: "z" }); }
  // courtyard: blossom tree and two potted plants
  b.cyl(0, 0.6, 5.5, 0.6, 5, 0.4, 5, C.trunk); b.blob(0, 7, 5.5, 3.8, 2.6, 3.2, [C.pinkD, C.pink, C.pinkL], { seed: 11 });
  for (const x of [-5.5, 5.5]) { b.cyl(x, 0.6, 9, 0.8, 1.8, 0.9, 6, C.jarBlue); b.blob(x, 2.4, 9, 0.9, 0.8, 0.9, C.leafL, { seed: 4 }); }
}
/** Two-storey guild hall on a stone terrace (56-grid: ±25 × −18..+13), door at x 0, front wall +7, terrace edge +11. */
function hallHouse(b) {
  stonePlatform(b, -24, 24, -17, 11, 1); stonePlatform(b, -22, 22, -15, 9.5, 2);
  for (let k = 0; k < 2; k++) b.box(-4, 0, 11 + k * 0 - 0.01, 4, 1 - k * 0, 12.5, C.stoneL);
  walls(b, -20, 20, -13, 7, 2, 14);
  door(b, 0, 7, 2, 8, 5, false);
  for (const u of [-15, -8, 8, 15]) windowOn(b, "front", -20, 20, -13, 7, u, 5, 4, 5);
  for (const u of [-12, 0, 12]) windowOn(b, "back", -20, 20, -13, 7, u, 5, 4, 5, u ? "lattice" : "slats");
  for (const u of [-6, 2]) { windowOn(b, "left", -20, 20, -13, 7, u, 5, 4, 5, "slats"); windowOn(b, "right", -20, 20, -13, 7, u, 5, 4, 5, "slats"); }
  colonnade(b, [-20, -13, -6.5, 6.5, 13, 20], 9, 2, 14, -20.6, 20.6);
  b.box(-20.6, 14.4, 6.8, 20.6, 15, 10, C.woodD);
  b.roof(-20, 20, -13, 9.5, 15, 3.6, { ov: 2.8, up: 1.4, ridge: false, bands: 2 });
  // gallery storey
  walls(b, -17, 17, -11, 5, 17, 26);
  for (const u of [-11, -4, 4, 11]) windowOn(b, "front", -17, 17, -11, 5, u, 19.5, 3.6, 4);
  windowOn(b, "left", -17, 17, -11, 5, -3, 19.5, 3.6, 4, "slats"); windowOn(b, "right", -17, 17, -11, 5, -3, 19.5, 3.6, 4, "slats");
  b.box(-18, 17.6, 5, 18, 18.2, 8, C.woodD); railing(b, [-18, 7.8], [18, 7.8], 18.2, 1.5, PIL(1));
  b.box(-4, 21.5, 5.6, 4, 24.5, 6.1, C.plaque); b.box(-2.6, 22.4, 6.1, 2.6, 23.6, 6.25, C.gold, { bottom: false });
  for (const x of [-14, 14]) lantern(b, x, 25.2, 7);
  b.roof(-17, 17, -11, 6, 26, 10.5, { ov: 4.2, up: 2.2 });
}
/** Warehouse courtyard (64-grid: ±30 × −19..+13): long sheds round a yard, a roofed gate on the front. */
function compound(b) {
  stonePlatform(b, -30, 30, -19, 13, 0.5);
  const seg = (x0, z0, x1, z1) => { b.box(x0, 0.5, z0, x1, 6.5, z1, WALLC(1), { top: WALLC(0.8) }); b.box(x0 - 0.5, 6.5, z0 - 0.5, x1 + 0.5, 7.2, z1 + 0.5, ROOF(1)); };
  seg(-29.5, 10.5, -4, 12); seg(4, 10.5, 29.5, 12);
  // back warehouse
  walls(b, -27, 27, -17, -6, 0.5, 11);
  for (const u of [-18, -6, 6, 18]) { b.box(u - 2.4, 0.5, -6, u + 2.4, 7.5, -5.6, C.woodD); b.box(u - 2, 0.5, -5.6, u + 2, 7, -5.4, C.wood); }
  for (const u of [-12, 0, 12]) windowOn(b, "back", -27, 27, -17, -6, u, 6, 4, 3, "slats");
  b.roof(-27, 27, -17, -6, 11, 9, { ov: 2.6, up: 1.6 });
  // side sheds
  for (const [a, c] of [[-28, -19], [19, 28]]) { walls(b, a, c, -4, 9, 0.5, 8); windowOn(b, a < 0 ? "right" : "left", a, c, -4, 9, 2.5, 3, 4, 3, "lattice"); b.roof(a, c, -4, 9, 8, 5, { ov: 2, up: 1.2, axis: "z" }); }
  // yard goods
  for (const [x, z] of [[-10, 2], [-7.5, 3], [9, 1], [10, 4]]) crate(b, x, 0.5, z, 2.4);
  jar(b, -2, 0.5, -1, 1.2, C.jarBrown); jar(b, 1, 0.5, -2, 1, C.jarBlue);
  b.box(4, 0.5, 4, 8, 1.5, 7, C.woodL); b.blob(6, 2, 5.5, 2.2, 1.2, 1.6, [C.hayD, C.hay, C.hayL], { seed: 3 });
  // gate
  door(b, 0, 11.4, 0.5, 7.5, 7, false);
  colonnade(b, [-4, 4], 12.6, 0.5, 9.5, -5, 5);
  b.roof(-4.5, 4.5, 10, 13.5, 10, 3.5, { ov: 2.2, up: 1.2, bands: 2 }); b.box(-2.6, 8.2, 13.2, 2.6, 9.4, 13.5, C.plaque);
  lantern(b, -4, 9.2, 13.5); lantern(b, 4, 9.2, 13.5);
}
/** Three-storey teahouse for a 22-wide garden strip (48-grid: −11..+13 × ±11): door x 0, front edge +10. */
function teahouse(b) {
  stonePlatform(b, -10, 10, -10, 10, 1);
  walls(b, -7, 7, -7, 7, 1, 10);
  door(b, 0, 7, 1, 7, 3.6, true);
  windowOn(b, "front", -7, 7, -7, 7, -4.5, 4, 2.6, 3.6); windowOn(b, "front", -7, 7, -7, 7, 4.5, 4, 2.6, 3.6);
  for (const f of ["left", "right", "back"]) windowOn(b, f, -7, 7, -7, 7, 0, 4, 4, 3.6);
  b.roof(-7, 7, -7, 7, 10, 3, { ov: 3, up: 1.4, ridge: false, bands: 2 });
  b.box(-8.5, 11, -8.5, 8.5, 11.6, 8.5, C.woodD); for (const [a, c] of [[[-8.4, 8.4], [8.4, 8.4]], [[-8.4, -8.4], [-8.4, 8.4]], [[8.4, -8.4], [8.4, 8.4]]]) railing(b, a, c, 11.6, 1.4, PIL(1));
  walls(b, -6, 6, -6, 6, 11.6, 19);
  for (const f of ["front", "back", "left", "right"]) windowOn(b, f, -6, 6, -6, 6, 0, 13.5, 4.4, 3.4, f === "front" ? "lattice" : "slats");
  b.roof(-6, 6, -6, 6, 19, 3, { ov: 2.6, up: 1.4, ridge: false, bands: 2 });
  walls(b, -5, 5, -5, 5, 20.5, 27);
  windowOn(b, "front", -5, 5, -5, 5, 0, 22, 4, 3, "slats"); windowOn(b, "back", -5, 5, -5, 5, 0, 22, 4, 3, "slats");
  b.roof(-5, 5, -5, 5, 27, 7.5, { ov: 3, up: 1.8, finial: C.gold, ridgeLen: 0 });
  for (const [x, z] of [[-8.2, 8.2], [8.2, 8.2]]) lantern(b, x, 10.2, z);
  lantern(b, -6.6, 18.4, 6.6); lantern(b, 6.6, 18.4, 6.6);
  // banner, outdoor tables
  b.cyl(10, 1, 8, 0.3, 26, 0.25, 5, C.woodD); b.cone(10, 26, 8, 0.45, 1, 5, C.gold);
  b.box(10.3, 14, 7.85, 12.6, 24, 8.15, C.cream); b.box(10.3, 23.4, 7.8, 12.8, 24.2, 8.2, CLOTHC(1)); b.box(10.3, 13.6, 7.8, 12.8, 14.4, 8.2, CLOTHC(1));
  for (const tx of [-6, 6]) { b.cyl(tx, 0, 12, 1.2, 1.9, 1.2, 6, C.woodL, { top: C.wood }); for (const sx of [-1.8, 1.8]) b.cyl(tx + sx, 0, 12, 0.5, 1.1, 0.5, 5, C.woodD); jar(b, tx, 1.9, 12, 0.35, C.jarBrown); }
}
/** Flower garden plot (house footprint, no door): low wall, gravel paths, flower beds, two blossom trees, a gate arch. */
function gardenFlower(b) {
  b.box(-16, 0, -12, 16, 0.4, 13, "#6cc04c", { sides: C.stoneD });
  for (const [x0, z0, x1, z1] of [[-16, -12, 16, -11], [-16, 12, 16, 13], [-16, -12, -15, 13], [15, -12, 16, 13]]) b.box(x0, 0, z0, x1, 1.6, z1, C.stoneL, { top: C.stone });
  b.box(-1.5, 0.4, -11, 1.5, 0.55, 12, "#d8cca8"); b.box(-15, 0.4, -0.8, 15, 0.55, 0.8, "#d8cca8");
  b.box(-2.6, 0.4, -2, 2.6, 0.65, 2, "#c8bc98"); b.cyl(0, 0.6, 0, 1.4, 1.6, 1.2, 8, C.stoneL); b.blob(0, 2.2, 0, 1, 0.8, 1, C.pink, { seed: 2 });
  const R = rng(5), FL = ["#f8f0f8", "#ffe050", "#ff80a0", "#e04a3a", "#a080e0", "#f07a2a"];
  for (const [x0, z0] of [[-14, -10], [3, -10], [-14, 2], [3, 2]]) for (let i = 0; i < 14; i++) { const x = x0 + 1 + R() * 9.5, z = z0 + 1 + R() * 7.5; b.cyl(x, 0.4, z, 0.5, 1 + R() * 0.6, 0.6, 5, C.leafD); b.blob(x, 1.6 + R() * 0.5, z, 0.55, 0.45, 0.55, FL[Math.floor(R() * FL.length)], { seed: i }); }
  for (const x of [-10, 10]) { b.cyl(x, 0.4, -6.5, 0.45, 5, 0.3, 5, C.trunk); b.blob(x, 7.2, -6.5, 3.2, 2.4, 3, [C.pinkD, C.pink, C.pinkL], { seed: x + 30 }); }
  // little paifang gate at the street front
  for (const x of [-2.4, 2.4]) b.cyl(x, 0.4, 11.5, 0.35, 6.5, 0.35, 6, PIL(1));
  b.box(-3.4, 6.2, 11, 3.4, 6.9, 12, C.beam); b.roof(-2.8, 2.8, 11.2, 11.8, 7, 1.6, { ov: 1.4, up: 0.8, bands: 2 });
}
/** Pond garden plot: a lily pond with a zig-zag bridge, rocks, a small pavilion, trees. */
function gardenPond(b) {
  b.box(-16, 0, -12, 16, 0.4, 13, "#6cc04c", { sides: C.stoneD });
  for (const [x0, z0, x1, z1] of [[-16, -12, 16, -11], [-16, 12, 16, 13], [-16, -12, -15, 13], [15, -12, 16, 13]]) b.box(x0, 0, z0, x1, 1.6, z1, C.stoneL, { top: C.stone });
  const pond = []; for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; pond.push([Math.cos(a) * 11 * (1 + 0.12 * Math.sin(k * 2.3)), Math.sin(a) * 7 * (1 + 0.1 * Math.cos(k * 1.7)) - 1]); }
  b.flat(pond.map(([x, z]) => [x * 1.08, z * 1.1]), 0.45, "#c8bca0"); b.flat(pond, 0.55, "#3a8ac8");
  for (let i = 0; i < 6; i++) b.cyl(-6 + i * 2.3, 0.56, -3 + (i % 3) * 2, 0.7, 0.62, 0.7, 6, "#4ea23a");
  const R = rng(9); for (let i = 0; i < 9; i++) { const a = R() * 6.28; b.blob(Math.cos(a) * 12, 0.6, Math.sin(a) * 7.8 - 1, 1 + R(), 0.8 + R() * 0.8, 1 + R() * 0.6, ["#8e8a84", "#a6a49c", "#7c7872"], { seed: i + 2 }); }
  // zig-zag bridge
  for (const [xa, za, xb, zb] of [[-2, 7, -2, 2], [-2, 2, 2, -1], [2, -1, 2, -6]]) { const L = Math.hypot(xb - xa, zb - za); b.save(() => { b.t((xa + xb) / 2, 0, (za + zb) / 2).ry(Math.atan2(xb - xa, zb - za)); b.box(-1, 1, -L / 2, 1, 1.4, L / 2, C.woodL); }); }
  // pavilion at the back
  for (const [x, z] of [[-11, -9], [-6, -9], [-11, -5], [-6, -5]]) b.cyl(x, 0.4, z, 0.35, 5.6, 0.35, 6, PIL(1));
  b.box(-11.6, 0.4, -9.6, -5.4, 1, -4.4, C.stoneL); b.roof(-11, -6, -9, -5, 5.6, 4, { ov: 1.8, up: 1.2, finial: C.gold });
  for (const [x, z, c] of [[10, -8, [C.leafD, C.leaf, C.leafL]], [11, 8, [C.pinkD, C.pink, C.pinkL]], [-12, 8, [C.leafD, C.leaf, C.leafLL]]]) { b.cyl(x, 0.4, z, 0.45, 4.5, 0.3, 5, C.trunk); b.blob(x, 6.4, z, 3, 2.4, 3, c, { seed: x * 3 + z }); }
}

/** Market stall (24-grid: ±10 × −4..+6): a counter of goods under a little tiled roof with a striped valance. */
function stall(b) {
  b.box(-9, 0, -3, 9, 0.4, 5, C.woodD);
  b.box(-8.5, 0.4, 1.4, 8.5, 4, 4.6, C.woodL, { top: C.wood, front: C.woodL });
  const goods = [C.veg, C.orange, C.tomato, C.hay, "#a080e0", C.jarBlue];
  for (let k = 0; k < 8; k++) { const x = -7.2 + k * 2.05; if (k % 3 === 2) jar(b, x, 4, 3, 0.55, goods[k % 6]); else { b.cyl(x, 4, 3, 0.9, 4.6, 1.1, 6, C.straw); b.blob(x, 4.9, 3, 0.8, 0.45, 0.8, goods[k % 6], { seed: k }); } }
  b.box(-8.5, 0.4, -3, 8.5, 6, -2.4, C.wood); for (const x of [-6, 0, 6]) crate(b, x, 0.4, -1, 1.8);
  for (const [x, z] of [[-9, -3], [9, -3], [-9, 5], [9, 5]]) b.box(x - 0.45, 0.4, z - 0.45, x + 0.45, 12, z + 0.45, PIL(1));
  for (let i = 0; i < 9; i++) { const x0 = -9.4 + i * 2.1, col = i % 2 ? C.cream : CLOTHC(1); b.box(x0, 10, 5.2, x0 + 2.1, 11.6, 5.5, col, { bottom: col }); }
  b.roof(-9, 9, -3, 5, 12, 4.2, { ov: 1.8, up: 1.4 });
  lantern(b, -9, 11.6, 5.8, 0.75); lantern(b, 9, 11.6, 5.8, 0.75);
}

// ---------------------------------------------------------------------------------------------------------------
// landmarks
function pagoda(b) {
  b.box(-17, 0, -17, 17, 2, 17, C.stoneL, { sides: C.stoneD }); b.box(-4, 0, 17, 4, 1, 19, C.stoneL);
  let y = 2, hw = 12;
  for (let t = 0; t < 5; t++) {
    const h = t === 0 ? 10 : 7;
    walls(b, -hw, hw, -hw, hw, y, y + h);
    for (const f of ["front", "back", "left", "right"]) { if (t === 0 && f === "front") door(b, 0, hw, y, 7, 4, true); else windowOn(b, f, -hw, hw, -hw, hw, 0, y + 2, 3.6, Math.min(4, h - 3), t % 2 ? "slats" : "lattice"); }
    b.box(-hw - 0.4, y + h - 0.8, -hw - 0.4, hw + 0.4, y + h, hw + 0.4, C.beam);
    b.roof(-hw, hw, -hw, hw, y + h, t === 4 ? 6 : 2.6, { ov: 4, up: 2.2, ridge: t === 4 ? undefined : false, bands: t === 4 ? 4 : 2, ridgeLen: 0 });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lantern(b, sx * (hw + 3.2), y + h - 0.2, sz * (hw + 3.2), 0.8);
    y += h + 2; hw -= 2;
  }
  b.cyl(0, y + 4, 0, 0.5, 61, 0.2, 6, C.gold); for (const yy of [54, 56.5]) b.cyl(0, yy, 0, 1.3, yy + 0.7, 1.3, 8, C.goldD); b.blob(0, 61, 0, 0.7, 0.7, 0.7, C.gold);
}
/** A walled city gate (64-grid: ±24 × −11..+13): a stone gatehouse block (walkway 31) with a tunnel and a hall on top. */
function cityGate(b) {
  archBlock(b, -24, 24, 0, 31, -8, 10, 0, 5, 14, C.brick, { top: C.stoneL });
  for (const z of [-8.6, 10.6]) crenels(b, -24, 24, z, 31, 1.8, 1.7, 1.2);
  for (const sx of [-1, 1]) { b.box(sx * 5 - 0.6 * sx - 0.3, 0, 9.2, sx * 5 + 0.3 * sx, 14, 11, C.door); }
  b.box(-3.6, 21, 10, 3.6, 24, 10.5, C.plaque); b.box(-1.4, 22, 10.5, 1.4, 23, 10.7, C.gold, { bottom: false });
  for (const x of [-16, -10, 10, 16]) b.box(x - 0.5, 14, 10, x + 0.5, 17, 10.3, C.ink, { bottom: false });
  walls(b, -16, 16, -6, 8, 31, 40);
  for (const u of [-10, 0, 10]) windowOn(b, "front", -16, 16, -6, 8, u, 33.5, 4, 4); for (const u of [-9, 9]) windowOn(b, "back", -16, 16, -6, 8, u, 33.5, 4, 4);
  colonnade(b, [-16, -8, 8, 16], 9.6, 31, 39.6, -16.6, 16.6);
  b.roof(-16, 16, -6, 9.6, 40, 10.5, { ov: 4, up: 2.2 });
  for (const x of [-12, 12]) lantern(b, x, 39, 9.6);
}
/** The palace gatehouse (104-grid: ±52 × ±16): long stone base with a central tunnel, a red hall on top, corner pavilions. */
function fortGate(b) {
  archBlock(b, -52, 52, 0, 22, -16, 16, 0, 6, 12, C.brick, { top: C.stoneL });
  for (const z of [-16.6, 16.6]) crenels(b, -52, 52, z, 22, 2, 2.2, 1.2);
  for (const sx of [-1, 1]) b.box(sx * 6 - 0.6 * sx - 0.3, 0, 15, sx * 6 + 0.3 * sx, 12, 17, C.door);
  b.box(-4, 15, 16, 4, 19, 16.6, C.plaque); b.box(-2, 16.2, 16.6, 2, 17.8, 16.8, C.gold, { bottom: false });
  walls(b, -26, 26, -9, 9, 22, 34, { wall: "#c8402e" });
  for (const u of [-18, -9, 0, 9, 18]) windowOn(b, "front", -26, 26, -9, 9, u, 25, 4.5, 5);
  colonnade(b, [-26, -18, -9, 9, 18, 26], 11.5, 22, 33.6, -26.6, 26.6);
  b.roof(-26, 26, -9, 11.5, 34, 4, { ov: 3.6, up: 1.6, ridge: false, bands: 2 });
  walls(b, -20, 20, -6, 7, 37, 43, { wall: "#c8402e" });
  b.roof(-20, 20, -6, 8, 43, 8, { ov: 4, up: 2.2, finial: C.gold });
  for (const sx of [-1, 1]) { const x = sx * 43; walls(b, x - 7, x + 7, -7, 7, 22, 30, { wall: "#c8402e" }); b.roof(x - 7, x + 7, -7, 7, 30, 6.5, { ov: 3, up: 1.8, ridgeLen: 0 }); }
  for (const x of [-22, -12, 12, 22]) lantern(b, x, 33, 11.5);
}
/** City wall segment (32-grid: ±11 × −8..+1, walkway at 24 tall, crenels both sides). */
function wallSeg(b) {
  b.box(-11, 0, -8, 11, 24, 1, C.brick, { top: C.stoneL });
  for (let y = 3; y < 24; y += 3) { b.box(-11.02, y, -8.05, 11.02, y + 0.25, -7.95, C.brickD, { bottom: false }); b.box(-11.02, y, 0.95, 11.02, y + 0.25, 1.05, C.brickD, { bottom: false }); }
  crenels(b, -11, 11, -7.6, 24, 1.8, 1.9, 0.9); crenels(b, -10, 11, 0.6, 24, 1.8, 1.9, 0.9);
  for (const x of [-5, 5]) b.box(x - 0.35, 14, -8.15, x + 0.35, 17, -7.9, C.ink, { bottom: false });
}
/** Square watchtower (56-grid: ±15), 44 high with a crenellated top and a pyramid roof to 56. */
function tower(b) {
  b.box(-15, 0, -15, 15, 36, 15, C.brick, { inset: 1, top: C.stoneL });
  for (let y = 4; y < 36; y += 4) b.box(-15.02 + y / 36, y, -15.02 + y / 36, 15.02 - y / 36, y + 0.3, 15.02 - y / 36, C.brickD, { bottom: false, top: false });
  for (const [z, ry] of [[14.2, 0], [-14.2, Math.PI]]) b.at(0, 0, 0, ry, () => { b.box(-0.5, 18, z, 0.5, 22, z + 0.3, C.ink); b.box(-0.5, 27, z, 0.5, 31, z + 0.3, C.ink); });
  walls(b, -11, 11, -11, 11, 36, 44, { posts: true });
  for (const f of ["front", "back", "left", "right"]) windowOn(b, f, -11, 11, -11, 11, 0, 38.5, 4, 3, "slats");
  b.roof(-11, 11, -11, 11, 44, 11, { ov: 4, up: 2, ridgeLen: 0, finial: C.gold });
  for (const [x, z] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) b.cube(x, 36, z, 2, 2, 2, C.brick);
}
/** Water gate (40-grid: ±20 × −6..+7): a tall arch over the river with a half-raised portcullis and a windlass hut. */
function waterGate(b) {
  archBlock(b, -20, 20, 0, 30, -6, 7, 0, 12, 12, C.brick, { top: C.stoneL });
  crenels(b, -20, 20, -6.6, 30, 1.8, 1.8, 1); crenels(b, -20, 20, 7.6, 30, 1.8, 1.8, 1);
  // portcullis
  for (let x = -11; x <= 11; x += 2.2) b.box(x - 0.35, 9, 0.2, x + 0.35, 24, 0.9, C.woodD); for (let y = 11; y < 24; y += 3) b.box(-11.5, y, 0.1, 11.5, y + 0.5, 1, C.iron);
  for (let x = -11; x <= 11; x += 2.2) b.cone(x, 9, 0.55, 0.35, -1.2, 4, C.iron);
  for (const z of [7.2, -6.3]) { b.box(-3.6, 25, z, 3.6, 28, z + (z > 0 ? 0.5 : -0.5), C.plaque); for (const x of [-15, 15]) lantern(b, x, 27, z + (z > 0 ? 0.6 : -0.6)); }
  walls(b, -6, 6, -4, 5, 30, 35); b.roof(-6, 6, -4, 5, 35, 3.2, { ov: 2, up: 1.2 });
  b.beam([-5, 33, 5.8], [5, 33, 5.8], 0.6, C.wood, 8);
}
/** Red palace wall (32-grid: ±11 × −3..+3, 13 high) under a tiled coping (roof slot → imperial gold). */
function palaceWall(b) {
  b.box(-11, 0, -3, 11, 13, 3, "#b8302a", { bottom: false, top: "#6a2020" });
  b.box(-11.02, 0, -3.05, 11.02, 1.4, 3.05, "#8a2a24", { bottom: false, top: false });
  b.roof(-11, 11, -3, 3, 13, 2.6, { ov: 1.2, up: 0, bands: 2, axis: "x", ridgeLen: 1.3 });
}

// ---------------------------------------------------------------------------------------------------------------
// the palace's great hall: three marble terraces (±100 × ±74), a grand stair, a four-roofed hall 190 high
function greatHall(b) {
  const MAR = C.marble, MARD = C.marbleD, MARL = C.marbleL;
  const tier = (hx, z0, z1, y0, y1) => { b.box(-hx, y0, z0, hx, y1, z1, MARL, { sides: MARD, bottom: false });
    // balustrade: rail + posts
    const yy = y1, pts = [[-hx + 1, z0 + 1], [hx - 1, z0 + 1], [hx - 1, z1 - 1], [-hx + 1, z1 - 1]];
    for (let k = 0; k < 4; k++) { const [ax, az] = pts[k], [cx, cz] = pts[(k + 1) % 4]; if (k === 2) { // front: leave the stair open
        b.box(Math.min(ax, cx), yy, az - 0.4, -17, yy + 1.6, az + 0.4, MAR); b.box(17, yy, az - 0.4, Math.max(ax, cx), yy + 1.6, az + 0.4, MAR); continue; }
      b.box(Math.min(ax, cx) - 0.4, yy, Math.min(az, cz) - 0.4, Math.max(ax, cx) + 0.4, yy + 1.6, Math.max(az, cz) + 0.4, MAR); }
    for (let x = -hx + 1; x <= hx - 1; x += 8) for (const z of [z0 + 1, z1 - 1]) if (z === z0 + 1 || Math.abs(x) > 18) b.cube(x, yy, z, 1.4, 2.4, 1.4, MARL);
    for (let z = z0 + 1; z <= z1 - 1; z += 8) for (const x of [-hx + 1, hx - 1]) b.cube(x, yy, z, 1.4, 2.4, 1.4, MARL);
  };
  tier(100, -74, 74, 0, 10); tier(88, -66, 56, 10, 20); tier(76, -58, 40, 20, 30);
  // grand stair: three flights with a carved dragon ramp up the middle
  for (const [zTop, zBot, yTop, yBot] of [[40, 56, 30, 20], [56, 74, 20, 10], [74, 86, 10, 0]]) {
    const n = Math.round((yTop - yBot) / 1.25);
    for (let s = 0; s < n; s++) { const t0 = s / n, z = zTop + (zBot - zTop) * t0, y = yTop - (yTop - yBot) * t0 - (yTop - yBot) / n; b.box(-16, yBot, z, 16, y + (yTop - yBot) / n, z + (zBot - zTop) / n, s % 2 ? MARL : MAR, { bottom: false }); }
    b.save(() => { const L = Math.hypot(zBot - zTop, yTop - yBot), a = Math.atan2(yTop - yBot, zBot - zTop); b.t(0, (yTop + yBot) / 2 + 0.4, (zTop + zBot) / 2).rx(a); b.box(-4, -0.4, -L / 2, 4, 0.6, L / 2, "#d8c890"); });
    for (const sx of [-1, 1]) b.save(() => { const L = Math.hypot(zBot - zTop, yTop - yBot), a = Math.atan2(yTop - yBot, zBot - zTop); b.t(sx * 16.8, (yTop + yBot) / 2 + 1, (zTop + zBot) / 2).rx(a); b.box(-0.8, -1, -L / 2, 0.8, 1.2, L / 2, MARD); });
  }
  // ground floor: a hall ringed by red columns
  walls(b, -60, 60, -42, 30, 30, 66, { wall: "#c8402e" });
  for (const u of [-45, -30, -15, 15, 30, 45]) windowOn(b, "front", -60, 60, -42, 30, u, 38, 8, 14);
  for (const u of [-40, -20, 0, 20, 40]) windowOn(b, "back", -60, 60, -42, 30, u, 38, 8, 14);
  for (const u of [-25, 0]) { windowOn(b, "left", -60, 60, -42, 30, u, 38, 8, 14, "slats"); windowOn(b, "right", -60, 60, -42, 30, u, 38, 8, 14, "slats"); }
  for (const x of [-20, 0, 20]) door(b, x, 30, 30, 22, 9, true);
  for (let x = -66; x <= 66; x += 11) for (const z of [36, -48]) { b.cyl(x, 30, z, 1.9, 31.2, 1.9, 8, MARL); b.cyl(x, 31.2, z, 1.3, 64.5, 1.3, 8, PIL(1)); }
  for (let z = -37; z <= 25; z += 12.4) for (const x of [-66, 66]) { b.cyl(x, 30, z, 1.9, 31.2, 1.9, 8, MARL); b.cyl(x, 31.2, z, 1.3, 64.5, 1.3, 8, PIL(1)); }
  b.box(-67.5, 64, -49.5, 67.5, 67, 37.5, C.beam, { top: C.woodD });
  for (let x = -60; x <= 60; x += 15) lantern(b, x, 63.5, 37, 1.6);
  b.roof(-67, 67, -49, 37, 67, 13, { ov: 9, up: 4.5, ridge: false, bands: 3 });
  // upper storeys, each smaller, each with its own sweeping roof
  const storey = (hx, z0, z1, y0, y1, rh, last) => {
    walls(b, -hx, hx, z0, z1, y0, y1, { wall: "#c8402e" });
    for (let u = -hx + 9; u <= hx - 9; u += 12) windowOn(b, "front", -hx, hx, z0, z1, u, y0 + 3, 6, Math.min(8, y1 - y0 - 6));
    for (let u = -hx + 9; u <= hx - 9; u += 14) windowOn(b, "back", -hx, hx, z0, z1, u, y0 + 3, 6, Math.min(8, y1 - y0 - 6));
    windowOn(b, "left", -hx, hx, z0, z1, (z0 + z1) / 2, y0 + 3, 6, Math.min(8, y1 - y0 - 6), "slats"); windowOn(b, "right", -hx, hx, z0, z1, (z0 + z1) / 2, y0 + 3, 6, Math.min(8, y1 - y0 - 6), "slats");
    b.box(-hx - 2, y0 - 0.8, z0 - 2, hx + 2, y0, z1 + 2, C.woodD); railing(b, [-hx - 1.6, z1 + 1.6], [hx + 1.6, z1 + 1.6], y0, 2, PIL(1), 3.5);
    for (const sx of [-1, 1]) lantern(b, sx * (hx + 3), y1 - 0.5, z1 + 3, 1.4);
    b.roof(-hx, hx, z0, z1, y1, rh, last ? { ov: 9, up: 5, finial: C.gold, pow: 1.5 } : { ov: 8, up: 4, ridge: false, bands: 3 });
  };
  storey(52, -38, 26, 82, 104, 12, false);
  storey(42, -32, 20, 117, 137, 10, false);
  storey(32, -26, 14, 148, 164, 22, true);
  // bronze cauldrons on the top terrace
  for (const sx of [-1, 1]) { b.cyl(sx * 50, 30, 40 - 6, 3, 31, 3, 8, C.stone); b.cyl(sx * 50, 31, 34, 2.4, 35, 3.2, 8, "#8a6a3a"); b.cyl(sx * 50, 35, 34, 3.2, 35.6, 3.2, 8, "#6a4a2a"); }
}
/** Gilded guardian lion on a marble plinth (32-grid: ±8 × −9..+10, 24 high), sitting, facing +z. */
function lionStatue(b) {
  const G = "#e6b030", GD = "#b8862a", GL = "#f6d060";
  b.box(-7, 0, -8, 7, 4, 9, C.marbleL, { sides: C.marbleD }); b.box(-7.6, 0, -8.6, 7.6, 1.2, 9.6, C.marbleD);
  b.blob(0, 9.5, -2, 4.6, 5.5, 5.6, [GD, G, G], { seed: 3, jitter: 0.1 });               // haunches + body
  b.blob(0, 13, 2, 4, 4.8, 3.8, [GD, G, GL], { seed: 5, jitter: 0.1 });                     // chest
  for (const sx of [-1, 1]) { b.beam([sx * 2.2, 11, 3.4], [sx * 2.4, 4, 5.4], 1.1, G, 6); b.cube(sx * 2.4, 4, 6, 2.4, 1.2, 2.6, GD); }
  b.blob(0, 19, 3.2, 5.2, 4.8, 4.2, [GD, GD, G], { seed: 9, detail: 1, jitter: 0.2 });       // mane
  b.blob(0, 18.6, 6.4, 3, 2.8, 2.4, [G, GL, GL], { seed: 2, jitter: 0.08 });                // face
  b.cube(0, 16.6, 8.4, 2.4, 1, 1.4, C.red); for (const sx of [-1, 1]) b.cube(sx * 1.2, 19.6, 8.5, 0.8, 0.8, 0.5, C.ink);
  b.blob(-3.2, 4.6, 6.4, 1.5, 1.5, 1.5, GL, { seed: 4 });                                    // the ball under the paw
  b.beam([0, 7, -7], [0, 12, -9], 0.8, GD, 5); b.blob(0, 12.6, -9, 1.4, 1.4, 1.2, GD, { seed: 1 });
}
/** Jade dragon coiled round a marble column on a round base (48-grid: about ±12, 42 high). */
function dragonStatue(b) {
  const J = "#3aa080", JD = "#2a7a60", JL = "#6ad0a8";
  b.cyl(0, 0, 0, 11, 2, 10.5, 12, C.marbleD, { top: C.marbleL }); b.cyl(0, 2, 0, 8, 4, 7.5, 12, C.marbleL);
  b.cyl(0, 4, 0, 3.2, 34, 2.8, 8, C.marbleL); b.cyl(0, 34, 0, 4.2, 35.5, 4.2, 8, C.marbleD);
  let prev = null; for (let k = 0; k <= 36; k++) { const t = k / 36, a = t * Math.PI * 5, y = 5 + t * 30, r = 4.4, p = [Math.cos(a) * r, y, Math.sin(a) * r];
    if (prev) b.beam(prev, p, 1.3 - t * 0.3, k % 3 ? J : JD, 6); prev = p; }
  b.blob(prev[0] * 0.6, 37.5, prev[2] * 0.6 + 2, 2.6, 2.2, 3.4, [JD, J, JL], { seed: 4 });     // head
  for (const sx of [-1, 1]) b.beam([prev[0] * 0.6 + sx, 39, prev[2] * 0.6 + 1], [prev[0] * 0.6 + sx * 2, 42, prev[2] * 0.6 - 1.5], 0.35, C.gold);
  b.blob(0, 37, 5.5, 1.3, 1.3, 1.3, C.gold, { seed: 1 });                                   // the pearl
}
/** Bronze incense burner on a marble slab (24-grid: ±7), tripod cauldron with a lid and a curl of smoke. */
function incenseBurner(b) {
  const B = "#a0783a", BD = "#6a4a24", BL = "#c89850";
  b.box(-7, 0, -6, 7, 1.4, 7, C.marbleL, { sides: C.marbleD });
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.5; b.beam([Math.cos(a) * 3.2, 1.4, Math.sin(a) * 3.2], [Math.cos(a) * 3.6, 6, Math.sin(a) * 3.6], 0.6, BD, 5); }
  b.cyl(0, 5, 0, 3, 7, 5, 10, B).cyl(0, 7, 0, 5, 11, 5.2, 10, B, { sideCols: [B, BL] }).cyl(0, 11, 0, 5.2, 12, 4.2, 10, BD);
  for (const sx of [-1, 1]) b.beam([sx * 5, 11, 0], [sx * 6, 13.5, 0], 0.5, BD, 5);
  b.cyl(0, 12, 0, 4, 14, 2.5, 10, BD).cyl(0, 14, 0, 2.5, 15.5, 1, 8, B); b.blob(0, 16.2, 0, 1, 1, 1, C.gold, { seed: 2 });
  let p = [0, 16, 0]; for (let k = 1; k <= 5; k++) { const q = [Math.sin(k * 1.3) * 0.8, 16 + k * 1.2, Math.cos(k * 1.1) * 0.5]; b.beam(p, q, 0.22 + k * 0.04, "#e8e4dc", 5); p = q; }
}
/** The colossal marble Jupiter: a stepped pedestal (top 15) and a robed figure with a raised golden thunderbolt (95). */
function statue(b) {
  const M0 = C.marble, MD = C.marbleD, ML = C.marbleL, R = rng(77);
  const mar = () => [M0, ML, M0, MD][Math.floor(R() * 4)];
  // pedestal
  b.box(-PED.t1[0], 0, -PED.t1[1], PED.t1[0], PED.t1[2], PED.t1[1], ML, { sides: MD, bottom: false });
  b.box(-PED.t2[0], PED.t1[2], -PED.t2[1], PED.t2[0], PED.t2[2], PED.t2[1], ML, { sides: M0, bottom: false });
  b.box(-PED.die[0], PED.t2[2], -PED.die[1], PED.die[0], PED.die[2] - 1.2, PED.die[1], M0, { sides: MD, bottom: false });
  b.box(-PED.die[0] - 0.8, PED.die[2] - 1.2, -PED.die[1] - 0.8, PED.die[0] + 0.8, PED.die[2], PED.die[1] + 0.8, ML, { sides: M0, bottom: false });
  b.box(-7, 9.8, PED.die[1], 7, 12.4, PED.die[1] + 0.3, "#c8a040", { bottom: false });
  for (const L of [-5, -2.5, 0, 2.5, 5]) b.box(L - 0.4, 10.4, PED.die[1] + 0.3, L + 0.4, 11.8, PED.die[1] + 0.45, C.ink, { bottom: false });
  const y0 = FIG.base;
  // feet and robe (himation draped round the legs, left knee forward)
  b.cube(-3.2, y0, 5.5, 3, 1.6, 4.5, M0); b.cube(3.4, y0, 4, 3, 1.6, 4.5, M0);
  b.cyl(0, y0 + 1, -0.5, 9.5, y0 + 14, 8.4, 9, MD, { sideCols: [M0, MD, ML, M0], kz: 0.8 });
  b.cyl(0, y0 + 14, -0.3, 8.4, y0 + 30, 7.2, 9, M0, { sideCols: [ML, M0, MD], kz: 0.78 });
  b.blob(-3, y0 + 22, 3.6, 3.4, 6, 3, [M0, ML], { seed: 5, jitter: 0.08 });                       // knee under the drapery
  // torso (bare chest), drape over the left shoulder, belt of folds
  b.cyl(0, y0 + 30, 0, 7.2, y0 + 41, 8.6, 8, ML, { kz: 0.7 });
  b.cyl(0, y0 + 41, 0, 8.6, FIG.shoulderY, 9.8, 8, ML, { kz: 0.68 });
  b.blob(-2.5, y0 + 31, 0.4, 8.4, 2.6, 6.2, [MD, M0], { seed: 8, jitter: 0.1 });
  b.save(() => { b.t(-5, y0 + 43, 1.4).rz(-0.6); b.box(-2.2, -10, -5.2, 2.2, 10, 5.4, M0, { sides: MD }); });
  b.blob(0, FIG.shoulderY - 1.5, 0, FIG.shoulderX, 3.4, 6.4, [M0, ML], { seed: 12, jitter: 0.06 });   // shoulders
  // neck, head, beard and hair, laurel
  b.cyl(0, FIG.shoulderY, 0, 2.8, FIG.headY - 3, 2.6, 7, M0);
  b.blob(0, FIG.headY, 0.3, FIG.headR * 0.9, FIG.headR, FIG.headR * 0.95, [ML, M0, ML], { seed: 21, detail: 1, jitter: 0.05 });
  b.blob(0, FIG.headY - 3.4, 2.6, 3.6, 3.6, 2.6, [MD, M0], { seed: 6, jitter: 0.14 });             // beard
  b.blob(0, FIG.headY + 2.2, -0.8, FIG.headR * 0.95, 3, FIG.headR * 0.9, [M0, MD], { seed: 13, jitter: 0.16 });   // curls
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; b.blob(Math.cos(a) * FIG.headR * 0.95, FIG.headY + 2.6, Math.sin(a) * FIG.headR * 0.95 + 0.2, 1, 0.6, 1, "#c8b060", { seed: k }); }
  for (const sx of [-1, 1]) b.cube(sx * 1.6, FIG.headY + 0.6, FIG.headR * 0.9, 1, 0.6, 0.4, MD);
  // right arm raised high with the golden thunderbolt
  const sh = [FIG.shoulderX - 1, FIG.shoulderY - 0.5, 0], el = [14.5, 73.5, 1.2], ha = [14, 85, 2];
  b.beam(sh, el, 2.4, M0, 7); b.beam(el, ha, 2, ML, 7); b.blob(el[0], el[1], el[2], 2.3, 2.3, 2.3, M0, { seed: 3 }); b.blob(ha[0], ha[1], ha[2], 2.1, 2, 2.1, ML, { seed: 4 });
  const bolt = [[14, 80, 2], [15.6, 84, 2.6], [13, 87, 2], [15.4, 90.5, 2.4], [13.6, 95, 2]];
  for (let k = 1; k < bolt.length; k++) b.beam(bolt[k - 1], bolt[k], 0.95, k % 2 ? C.gold : "#ffd860", 5);
  b.beam([14, 80, 2], [12.8, 76, 1.6], 0.8, C.gold, 5); b.cone(12.6, 74, 1.6, 0.9, 2.2, 5, C.gold);
  // left arm down, holding the sceptre
  const ls = [-FIG.shoulderX + 1, FIG.shoulderY - 0.5, 0], le = [-13, 52, 2.5], lh = [-12.6, 44.5, 5.4];
  b.beam(ls, le, 2.4, M0, 7); b.beam(le, lh, 2, ML, 7); b.blob(le[0], le[1], le[2], 2.2, 2.2, 2.2, M0, { seed: 7 }); b.blob(lh[0], lh[1], lh[2], 2, 2, 2, ML, { seed: 9 });
  b.beam([-12.8, y0 + 0.2, 6], [-12.4, 74, 5], 0.7, MD, 6); b.blob(-12.4, 75, 5, 1.5, 1.5, 1.5, C.gold, { seed: 5 });
  // the eagle at his feet
  const E = EAGLE; b.blob(E.x, E.y + 3, E.z, 2.4, 3.2, 2.6, [M0, ML], { seed: 14, jitter: 0.1 }); b.blob(E.x, E.y + 6.6, E.z + 1.2, 1.4, 1.5, 1.5, ML, { seed: 15 });
  b.cone(E.x, E.y + 6.4, E.z + 2.8, 0.6, 1.2, 4, "#c8a040", { rot: 0 });
  for (const sx of [-1, 1]) b.quad([E.x + sx * 1.6, E.y + 5, E.z], [E.x + sx * 1.8, E.y + 2, E.z - 2], [E.x + sx * 4.6, E.y + 4.6, E.z - 1.8], [E.x + sx * 4.2, E.y + 7.6, E.z - 0.6], MD);
  for (const sx of [-1, 1]) b.quad([E.x + sx * 4.2, E.y + 7.6, E.z - 0.6], [E.x + sx * 4.6, E.y + 4.6, E.z - 1.8], [E.x + sx * 1.8, E.y + 2, E.z - 2], [E.x + sx * 1.6, E.y + 5, E.z], MD);
  b.cube(E.x, E.y, E.z, 3, 0.8, 3, MD);
  void mar;
}

// ---------------------------------------------------------------------------------------------------------------
// trees
function canopyTree(cols, seed, o = {}) {
  return (b) => {
    const R = rng(seed);
    b.cyl(0, 0, 0, 1.1, 8, 0.7, 6, C.trunk, { sideCols: [C.trunk, C.trunkD] });
    b.beam([0, 6, 0], [-3, 9.4, 0.4], 0.45, C.trunk, 5); b.beam([0, 6.4, 0], [3.2, 9.6, -0.6], 0.45, C.trunkD, 5);
    const blobs = [[0, 12, 0, 6.4], [-3.6, 10, 0.4, 4.6], [4, 10.2, 0.6, 4.6], [0.2, 10, -3.6, 4.5], [0.6, 10.2, 3.8, 4.5], [0.4, 15.4, 0.2, 4]];
    blobs.forEach(([x, y, z, r], i) => b.blob(x, y, z, r, r * 0.85, r, cols, { seed: seed * 7 + i, detail: 0, jitter: 0.2 }));
    if (o.fruit) for (let i = 0; i < 14; i++) { const a = R() * 6.28, y = 8.6 + R() * 8; b.blob(Math.cos(a) * 6.2, y, Math.sin(a) * 6.2, 0.6, 0.6, 0.6, C.orange, { seed: i }); }
  };
}
function pine(b) {
  b.cyl(0, 0, 0, 0.9, 6, 0.6, 5, C.trunk);
  let y = 3; for (const [r, h] of [[7.2, 6], [6, 5.6], [4.8, 5.2], [3.5, 4.8], [2.2, 4]]) { b.cone(0, y, 0, r, h, 7, C.leaf, { bottomCol: C.leafD, sideCols: [C.leaf, C.leafD, "#349a42"] }); y += h * 0.62; }
}
function bamboo(b) {
  const R = rng(17);
  for (let i = 0; i < 9; i++) { const x = (R() - 0.5) * 9, z = (R() - 0.5) * 9, h = 13 + R() * 8;
    b.cyl(x, 0, z, 0.34, h * 0.55, 0.3, 4, "#7ac860", { bottom: false, top: false }); b.cyl(x, h * 0.55, z, 0.3, h, 0.24, 4, "#8ad870", { bottom: false, top: false });
    for (let k = 0; k < 3; k++) { const yy = h - 1 - R() * 6, a = R() * 6.28, tip = [x + Math.cos(a) * 3.2, yy + 1, z + Math.sin(a) * 3.2], side = [x + Math.cos(a + 0.5) * 1.6, yy + 0.4, z + Math.sin(a + 0.5) * 1.6];
      b.tri([x, yy, z], tip, side, k % 2 ? C.leaf : C.leafL); b.tri(side, tip, [x, yy, z], C.leafD); } }
}
/** Giant camphor (64-grid, 46 high): buttress roots, a thick forked trunk, a broad cloud of foliage. */
function camphor(b) {
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; b.beam([Math.cos(a) * 6.5, 0, Math.sin(a) * 6.5], [Math.cos(a) * 1.5, 6, Math.sin(a) * 1.5], 1.1, C.trunkD, 5); }
  b.cyl(0, 0, 0, 3.6, 20, 2.6, 8, C.trunk, { sideCols: [C.trunk, C.trunkD, "#6a4a2a"] });
  for (const [x, y, z] of [[-9, 30, 2], [9, 31, -3], [2, 33, 9], [-1, 34, -9], [0, 36, 0]]) b.beam([x * 0.2, 18, z * 0.2], [x, y, z], 1.3, C.trunk, 6);
  const cl = [C.leafD, "#2f9a40", C.leaf, C.leafL];
  [[0, 36, 0, 12], [-10, 31, 3, 9], [10, 32, -3, 9], [2, 32, 11, 8.5], [-2, 33, -11, 8.5], [-8, 38, -6, 7], [8, 39, 6, 7], [0, 42, 0, 7]].forEach(([x, y, z, r], i) => b.blob(x, y, z, r, r * 0.7, r, cl, { seed: 40 + i, detail: 1, jitter: 0.18 }));
}
/** Giant golden ginkgo (64-grid, 48 high): a tall trunk, tiers of golden foliage, a carpet of fallen leaves. */
function ginkgo(b) {
  b.cyl(0, 0, 0, 2.6, 34, 1.4, 7, "#6a4a2a");
  const cl = ["#c8901a", "#e8b030", "#f6c840", "#ffe070"];
  [[0, 14, 0, 11], [0, 22, 0, 10], [0, 30, 0, 8.6], [0, 37.5, 0, 6.6], [0, 43, 0, 4.4]].forEach(([x, y, z, r], i) => {
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + i; b.blob(x + Math.cos(a) * r * 0.35, y, z + Math.sin(a) * r * 0.35, r * 0.8, 4, r * 0.8, cl, { seed: i * 5 + k, detail: 1, jitter: 0.2 }); } });
  const R = rng(4); for (let i = 0; i < 40; i++) { const a = R() * 6.28, d = 4 + R() * 14, x = Math.cos(a) * d, z = Math.sin(a) * d, s = 0.7 + R() * 0.6; b.flat([[x - s, z], [x, z - s], [x + s, z], [x, z + s]], 0.08, R() < 0.5 ? "#f6c840" : "#e8a828"); }
}

// ---------------------------------------------------------------------------------------------------------------
// street props
function lanternPost(b) {
  b.box(-1.2, 0, -1.2, 1.2, 0.8, 1.2, C.stone, { top: C.stoneL });
  b.cyl(0, 0.8, 0, 0.4, 12, 0.35, 6, PIL(1)); b.box(-3.6, 11.4, -0.3, 3.6, 12, 0.3, PIL(0.75));
  for (const x of [-3, 3]) lantern(b, x, 11.4, 0);
  b.cone(0, 12, 0, 0.6, 1, 6, C.gold);
}
function well(b) {
  b.cyl(-1, 0, -1, 5.2, 3.2, 5.2, 10, C.stone, { top: C.stoneL }); b.cyl(-1, 3.2, -1, 4.6, 3.3, 4.6, 10, "#2a5a88", { bottom: false });
  for (const x of [-6, 4]) b.cube(x, 3.2, -1, 0.8, 7.5, 0.8, C.wood);
  b.beam([-6.4, 10.6, -1], [4.4, 10.6, -1], 0.4, C.woodD, 6); b.beam([-1, 10.4, -1], [-1, 6.5, -1], 0.08, C.ink); b.cyl(-1, 5.6, -1, 0.7, 6.6, 0.8, 6, C.woodL);
  b.roof(-6, 4, -4, 2, 11, 3, { ov: 1.5, up: 1, bands: 2 });
}
function haystack(b) { b.blob(0, 0, 0, 6, 8, 6, [C.hayD, C.hay, C.hay, C.hayL], { seed: 3, detail: 1, flat: 0, jitter: 0.1 }); b.cyl(0, 6.5, 0, 1.6, 8.6, 0.2, 6, C.hayD); }
function jarsProp(b) { jar(b, -2.5, 0, -2.5, 2.5, C.jarBlue); jar(b, 2.5, 0, -1.5, 2.2, C.jarBrown); jar(b, -0.5, 0, 2.5, 1.8, "#3aa060"); }
function cratesProp(b) { crate(b, -1.5, 0, -1.5, 5); crate(b, 3, 0, 1, 4, C.wood); crate(b, -1, 5, -1, 4, C.wood); }
function target(b) {
  for (const sx of [-1, 1]) b.beam([sx * 2, 0, 0], [sx * 0.4, 6.5, 0.2], 0.35, C.wood, 5);
  b.save(() => { b.t(0, 7, 0.8).rx(Math.PI / 2); for (const [r, col, h] of [[5, C.hay, 0.6], [4, C.tomato, 0.7], [3, C.cream, 0.8], [2, C.tomato, 0.9], [1, C.cream, 1]]) b.cyl(0, -h / 2, 0, r, h / 2, r, 12, col); });
}

// ---------------------------------------------------------------------------------------------------------------
// people inside vehicle models (static): standing figure facing +x, seated figure
function figure(b, x, y, z, o = {}) {
  const top = o.top ?? "#8a8a96", bottom = o.bottom ?? "#3a6ad8", skin = o.skin ?? C.skin, hair = o.hair ?? "#2a2030";
  b.cube(x, y, z - 0.6, 0.9, 3, 0.9, bottom); b.cube(x, y, z + 0.6, 0.9, 3, 0.9, bottom);
  b.cyl(x, y + 3, z, 1.3, y + 6, 1.5, 6, top, { kz: 1.1 });
  b.beam([x, y + 5.4, z - 1.5], [x + 1.8, y + 4.4, z - 1.4], 0.4, top); b.beam([x, y + 5.4, z + 1.5], [x + 1.8, y + 4.4, z + 1.4], 0.4, top);
  b.blob(x, y + 7.3, z, 1.25, 1.35, 1.25, skin, { seed: 2, jitter: 0.05 }); b.blob(x - 0.3, y + 7.9, z, 1.25, 0.8, 1.25, hair, { seed: 3, jitter: 0.05 });
  if (o.hat === "straw") b.cone(x, y + 8.3, z, 2.6, 1.6, 8, C.straw, { bottomCol: C.strawD });
  if (o.hat === "cap") b.cyl(x, y + 8.2, z, 1.2, y + 9.1, 1.1, 6, o.hatColor ?? C.ink);
}
function seated(b, x, y, z, o = {}) {
  const top = o.top ?? "#d04a6a", skin = o.skin ?? C.skin, hair = o.hair ?? "#2a2030";
  b.cyl(x, y, z, 1.3, y + 3, 1.4, 6, top, { kz: 1.1 });
  b.blob(x, y + 4.2, z, 1.2, 1.3, 1.2, skin, { seed: 2, jitter: 0.05 }); b.blob(x - 0.3, y + 4.8, z, 1.2, 0.75, 1.2, hair, { seed: 3, jitter: 0.05 });
  if (o.hat === "straw") b.cone(x, y + 5.1, z, 2.5, 1.5, 8, C.straw, { bottomCol: C.strawD });
}

// ---------------------------------------------------------------------------------------------------------------
// vehicles (forward = +x). Wheels are separate instances (WHEELS) so they can roll; offsets in local units.
export const WHEELS = {
  rickshaw: { r: 5, at: [[-3.5, 5.5, -5.5], [-3.5, 5.5, 5.5]] },
  oxcart: { r: 5, at: [[-7.5, 5.5, -6.3], [-7.5, 5.5, 6.3]] },
  barrow: { r: 2.5, at: [[5.5, 3.5, 0]] },
};
/** One spoked wheel in the x–y plane (axis z), centred at the origin. */
export function wheel(b, r) {
  const n = 10;
  b.save(() => { b.rx(Math.PI / 2);
    b.cyl(0, -0.55, 0, r, 0.55, r, n, C.woodD, { top: C.wood, bottomCol: C.wood });
  });
  for (const zz of [0.6, -0.6]) b.save(() => { b.t(0, 0, zz).rx(Math.PI / 2); b.cyl(0, -0.1, 0, r - 0.9, 0.1, r - 0.9, n, C.woodL); });
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI; b.beam([Math.cos(a) * (r - 0.6), Math.sin(a) * (r - 0.6), 0], [-Math.cos(a) * (r - 0.6), -Math.sin(a) * (r - 0.6), 0], 0.28, C.woodD); }
  b.save(() => { b.rx(Math.PI / 2); b.cyl(0, -0.9, 0, 0.7, 0.9, 0.7, 6, C.gold); });
}
function rickshaw(b) {
  b.beam([-3.5, 5.5, -6], [-3.5, 5.5, 6], 0.3, C.woodD);
  b.box(-7, 6, -4.4, 1, 8.6, 4.4, CLOTHC(1), { top: CLOTHC(0.8) }); b.box(-7.2, 8.6, -4.4, -5.6, 13, 4.4, CLOTHC(0.85));
  for (const [a, c] of [[[-7.4, 13.4], [-4, 14.6]], [[-4, 14.6], [-1, 13.8]]]) b.quad([a[0], a[1], -4.6], [a[0], a[1], 4.6], [c[0], c[1], 4.6], [c[0], c[1], -4.6], "#3a3440");
  b.quad([-1, 13.8, -4.6], [-1, 13.8, 4.6], [-4, 14.6, 4.6], [-4, 14.6, -4.6], "#2a2430");
  seated(b, -3.6, 8.6, 0, { top: "#d04a6a" });
  for (const z of [-4.2, 4.2]) b.beam([1, 7.4, z], [10, 6.4, z], 0.28, C.woodL);
  figure(b, 6.5, 0, 0, { top: "#f0e8d0", bottom: "#3a6ad8", hat: "straw" });
}
function oxcart(b) {
  b.box(-14, 4, -5.5, -1, 5, 5.5, C.wood); for (const z of [-5.5, 5.5]) b.box(-14, 5, z - 0.4, -1, 7, z + 0.4, C.woodL); b.box(-14.4, 5, -5.5, -13.6, 7, 5.5, C.woodL);
  b.beam([-7.5, 5.5, -6.6], [-7.5, 5.5, 6.6], 0.35, C.woodD);
  b.blob(-7.5, 7, -0.5, 6, 4.5, 4.2, [C.hayD, C.hay, C.hayL], { seed: 8, detail: 1, flat: -0.2 });
  seated(b, -1.6, 5, -1.5, { top: "#8a5a32", hat: "straw" });
  b.beam([-1, 5.5, 0], [4, 5.5, 0], 0.35, C.woodD);
  // the ox (legs swing: parts k ±3 about z, pivot y 5 at each leg's x)
  const ox = "#8a5a32", oxD = "#6a4424", oxL = "#a87a4a";
  b.save(() => { b.t(7, 7.4, 0).rz(Math.PI / 2); b.cyl(0, -4.6, 0, 2.6, 4.6, 2.5, 7, ox, { top: ox }); });
  for (const [x, z] of [[4.5, -1.6], [4.5, 1.6], [9.6, -1.6], [9.6, 1.6]]) { b.part = [(x < 7) === (z < 0) ? 3 : -3, 5.2, x]; b.box(x - 0.6, 0, z - 0.6, x + 0.6, 5.4, z + 0.6, oxD); b.part = null; }
  b.save(() => { b.t(13, 8.6, 0).rz(-0.3); b.box(-1.6, -1.4, -1.6, 1.8, 1.6, 1.6, ox, { front: oxL }); b.box(1.8, -1.4, -1.2, 3, 0.2, 1.2, oxL); });
  for (const sx of [-1, 1]) b.beam([12.6, 10.4, sx * 1.4], [13, 11.8, sx * 3.2], 0.3, C.cream);
  b.beam([11, 10.2, -3.4], [11, 10.2, 3.4], 0.4, C.woodD); b.beam([3.6, 8, 0], [1.6, 6, 0], 0.4, oxD);
}
function sedan(b) {
  b.box(-4, 6, -4, 4, 15, 4, CLOTHC(1), { top: C.gold });
  b.box(-4.2, 6, -4.2, 4.2, 6.8, 4.2, C.gold); b.box(-4.2, 14.4, -4.2, 4.2, 15.2, 4.2, C.gold);
  for (const z of [-4.05, 4.05]) b.glowing("window", () => b.box(-2, 9, z - 0.15, 2, 12.4, z + 0.15, C.paper));
  b.roof(-4, 4, -4, 4, 15, 4, { ov: 1.6, up: 1, finial: C.gold, ridgeLen: 0 });
  for (const z of [-4.6, 4.6]) b.beam([-12, 10, z], [12, 10, z], 0.35, C.woodL);
  figure(b, -10.5, 0, 0, { top: "#c8342a", bottom: "#c8342a", hat: "cap" }); figure(b, 9.5, 0, 0, { top: "#c8342a", bottom: "#c8342a", hat: "cap" });
}
function barrow(b) {
  b.box(-1, 3, -2.6, 6, 4.6, 2.6, C.woodL, { top: C.wood });
  const cols = [C.veg, C.orange, C.tomato, C.hay]; for (let k = 0; k < 6; k++) b.blob(0.2 + (k % 3) * 2, 5, -1.2 + Math.floor(k / 3) * 2.4, 0.9, 0.7, 0.9, cols[k % 4], { seed: k });
  for (const z of [-2.2, 2.2]) b.beam([-1, 4, z], [-5, 5.4, z], 0.25, C.woodD);
  for (const z of [-2.2, 2.2]) b.beam([0, 3, z], [0, 0, z], 0.25, C.woodD);
  figure(b, -7.5, 0, 0, { top: "#8a8a96", bottom: "#3a2a22", hat: "straw" });
}
function boat(b) {
  // hull: tapered planked shell
  const prof = [[-15, 0.6, 3.5], [-11, 2.6, 2.2], [-4, 4.2, 1], [6, 4.2, 1], [12, 2.6, 2.4], [15.5, 0.6, 4]];   // x, half-width, deck height above keel... (width, rise)
  for (let i = 0; i < prof.length - 1; i++) { const [xa, wa, ra] = prof[i], [xb, wb, rb] = prof[i + 1], ya = ra - 0.5, yb = rb - 0.5;
    for (const s of [-1, 1]) { const A = [xa, ya, s * wa], B = [xb, yb, s * wb], Ab = [xa, Math.min(ya, 0.6), s * wa * 0.55], Bb = [xb, Math.min(yb, 0.6), s * wb * 0.55];
      if (s > 0) { b.quad(Ab, Bb, B, A, C.wood); b.quad([xa, 0, 0], [xb, 0, 0], Bb, Ab, C.woodD); } else { b.quad(A, B, Bb, Ab, C.wood); b.quad(Ab, Bb, [xb, 0, 0], [xa, 0, 0], C.woodD); } }
    b.quad([xa, ya + 0.01, -wa], [xa, ya + 0.01, wa], [xb, yb + 0.01, wb], [xb, yb + 0.01, -wb], C.woodL); }
  // mat cabin arch
  for (let k = 0; k < 5; k++) { const a0 = (k / 5) * Math.PI, a1 = ((k + 1) / 5) * Math.PI, col = k % 2 ? "#d8b070" : "#b89050";
    const p = (a, x) => [x, 3.6 + Math.sin(a) * 3.8, Math.cos(a) * 4]; b.quad(p(a0, -6), p(a1, -6), p(a1, 4), p(a0, 4), col); b.quad(p(a0, 4), p(a1, 4), p(a1, -6), p(a0, -6), shade(col, 0.7)); }
  figure(b, -12, 1.2, 0, { top: "#3a6ad8", bottom: "#2a2030", hat: "straw" });
  b.beam([-10, 9, -1.5], [-16, 0, -1.5], 0.22, C.woodL);
  crate(b, 8, 3.6, -0.8, 2); jar(b, 10.5, 3.6, 0.8, 0.9, C.jarBrown);
}
/** Mill wheel (centre pivot, axis z): two rims, spokes, ten paddles. */
function waterwheel(b) {
  for (const z of [-2.5, 2.5]) for (let k = 0; k < 16; k++) { const a0 = (k / 16) * Math.PI * 2, a1 = ((k + 1) / 16) * Math.PI * 2; b.beam([Math.cos(a0) * 11, Math.sin(a0) * 11, z], [Math.cos(a1) * 11, Math.sin(a1) * 11, z], 0.45, C.woodD); }
  for (const z of [-2.5, 2.5]) for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI; b.beam([Math.cos(a) * 11, Math.sin(a) * 11, z], [-Math.cos(a) * 11, -Math.sin(a) * 11, z], 0.4, C.wood); }
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; b.save(() => { b.rz(a); b.box(10.6, -0.9, -3, 12.8, 0.9, 3, C.woodL); }); }
  b.save(() => { b.rx(Math.PI / 2); b.cyl(0, -5.5, 0, 0.9, 5.5, 0.9, 6, C.ink); });
}

// ---------------------------------------------------------------------------------------------------------------
// rope machinery: bridges, bullwheel, capstan, gondola stations + car, cargo lift, airships, mooring mast
/** Stone arch bridge piece (32-grid: ±14 × ±12): deck top at y 10, an arch through it along z, parapets on both z edges. */
function bridgeStone(b) {
  archBlock(b, -14, 14, 0, 10, -11, 11, 0, 8.5, 0, C.stone, { top: "#c8c0a8", inner: C.stoneD });
  for (let x = -14; x < 14; x += 4) b.box(x, 9.99, -10, x + 3.9, 10.05, 10, (x / 4) % 2 ? "#c8c0a8" : "#bcb49c", { bottom: false });
  for (const z of [-11.4, 11.4]) { b.box(-14, 10, z - 0.6, 14, 12, z + 0.6, C.stoneL, { top: C.stone }); for (let x = -14; x <= 14; x += 7) b.cube(x, 10, z, 1.6, 3, 1.6, C.stoneL); }
  for (const z of [-11.4, 11.4]) { b.cube(0, 12, z, 1.4, 3, 1.4, C.stone); b.cyl(0, 15, z, 1.2, 15.6, 1.2, 6, C.stone); b.glowing("lantern", () => b.box(-0.7, 15.6, z - 0.7, 0.7, 17, z + 0.7, C.lantern)); b.light(0, 16, z, "lantern"); b.cone(0, 17, z, 1.3, 1.2, 4, C.stoneD); }
  b.box(-4, 4.5, 11, 4, 7, 11.3, C.plaque);
}
export function pulleyWheel(b) {
  b.save(() => { b.rx(Math.PI / 2);
    b.cyl(0, -4.5, 0, 12.6, -3, 12.6, 16, C.woodD, { top: C.wood, bottomCol: C.wood });
    b.cyl(0, 3, 0, 12.6, 4.5, 12.6, 16, C.woodD, { top: C.wood, bottomCol: C.wood });
    b.cyl(0, -3, 0, 11.6, 3, 11.6, 16, C.rope, { sideCols: [C.rope, C.ropeD] });
    b.cyl(0, -2, 0, 2.4, 2, 2.4, 8, C.iron); b.cyl(0, -6, 0, 0.9, 6, 0.9, 6, C.ironL); });
  for (const z of [-3.8, 3.8]) for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI + 0.2; b.beam([Math.cos(a) * 11.6, Math.sin(a) * 11.6, z], [-Math.cos(a) * 11.6, -Math.sin(a) * 11.6, z], 0.55, C.wood); }
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; b.save(() => { b.rz(a); b.box(11.9, -0.4, -4.6, 12.9, 0.4, 4.6, C.iron); }); }
}
function capstan(b) {
  b.cyl(0, 0, 0, 3.6, 1, 3.6, 8, C.stone); b.cyl(0, 1, 0, 3, 11, 3, 8, C.wood, { sideCols: [C.wood, C.woodL] }); b.cyl(0, 11, 0, 3.4, 12, 1.2, 8, C.woodD);
  for (const y of [4, 8]) b.cyl(0, y, 0, 3.2, y + 0.6, 3.2, 8, C.iron);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; const tip = [Math.cos(a) * 15.5, 8.6, Math.sin(a) * 15.5];
    b.beam([0, 8.6, 0], tip, 0.65, C.woodD, 4); b.beam([0, 11.5, 0], [Math.cos(a) * 9, 9, Math.sin(a) * 9], 0.3, C.rope);
    b.cube(tip[0], 7.4, tip[2], 1.2, 1.6, 1.2, C.red); }
  b.cone(0, 12, 0, 1.4, 2.2, 6, C.gold);
}
/** Lower gondola station (64-grid; placed rot 1 so local +x points north up the line): ox ring centred at local (−12, 0),
 *  platform x 6..31 × z −8..7 with its deck at y 6, roofed waiting hall, A-frame cable tower with the sheave at (28, 27). */
function gondolaStationLow(b) {
  // ox track: packed-earth ring with curbs
  const ring = (r0, r1, y, col) => { for (let k = 0; k < 24; k++) { const a0 = (k / 24) * Math.PI * 2, a1 = ((k + 1) / 24) * Math.PI * 2, P = (a, r) => [-12 + Math.cos(a) * r, y, Math.sin(a) * r]; b.quad(P(a0, r0), P(a0, r1), P(a1, r1), P(a1, r0), col); } };
  ring(11.5, 18.5, 0.15, C.earth); ring(18.5, 19.4, 0.6, C.stone); ring(10.6, 11.5, 0.6, C.stone);
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; b.cube(-12 + Math.cos(a) * 19, 0, Math.sin(a) * 19, 0.9, 0.6, 0.9, C.stoneD); }
  // haul rope from the drum along the trench to the tower
  b.beam([-12, 4, 0], [22, 1, 0], 0.4, C.rope); b.beam([22, 1, 0], [28, 27, 0], 0.4, C.rope); b.box(-1, 0, -1, 22, 0.4, 1, C.woodD);
  // platform
  for (const [x, z] of [[7, -7.5], [7, 6.5], [19, -7.5], [19, 6.5], [30.5, -7.5], [30.5, 6.5]]) b.box(x - 0.6, 0, z - 0.6, x + 0.6, 5, z + 0.6, C.woodD);
  b.box(6, 5, -8, 31.5, 6, 7.5, C.woodL, { sides: C.wood });
  for (let x = 7; x < 31; x += 2) b.box(x, 5.99, -8, x + 0.12, 6.04, 7.5, C.woodD, { bottom: false });
  railing(b, [6.5, -7.8], [31, -7.8], 6, 1.6); railing(b, [6.5, -7.8], [6.5, 7.3], 6, 1.6);
  railing(b, [6.5, 7.3], [11.5, 7.3], 6, 1.6); railing(b, [16, 7.3], [31, 7.3], 6, 1.6);
  // stairs down on +z
  for (let k = 0; k < 6; k++) b.box(12, 0, 7.5 + (5 - k) * 1, 15.5, k + 1, 8.5 + (5 - k) * 1, k % 2 ? C.woodL : C.wood);
  // boarding gate posts at +x
  for (const z of [-7.5, 7]) b.box(31, 6, z - 0.5, 32, 12.5, z + 0.5, PIL(1), { top: PIL(0.75) });
  // waiting hall
  for (const [x, z] of [[7.5, -7], [7.5, 6.5], [13.5, -7], [13.5, 6.5], [19.5, -7], [19.5, 6.5]]) b.cyl(x, 6, z, 0.45, 13.4, 0.45, 6, PIL(1));
  b.roof(7.5, 19.5, -7, 6.5, 13.4, 4.6, { ov: 2.2, up: 1.4 });
  for (const z of [-6.2, 5.6]) b.box(9, 6, z - 0.4, 18, 7.2, z + 0.4, C.woodD);
  b.box(10.5, 11, 7.2, 16.5, 12.6, 7.6, C.plaque); lantern(b, 7.5, 12.8, 7.5); lantern(b, 19.5, 12.8, 7.5);
  // A-frame tower with the sheave
  for (const x of [22.5, 30.5]) for (const sz of [-1, 1]) b.beam([x, 0, sz * 7], [x, 31, sz * 1.4], 0.65, C.wood);
  for (const y of [10, 20]) for (const x of [22.5, 30.5]) b.beam([x, y, -7 + y * 0.18], [x, y, 7 - y * 0.18], 0.4, C.woodD);
  for (const sz of [-1, 1]) b.beam([22.5, 30.5, sz * 1.5], [30.5, 30.5, sz * 1.5], 0.55, C.woodD);
  b.save(() => { b.t(28, 27, 0).rx(Math.PI / 2); b.cyl(0, -0.7, 0, 3.6, 0.7, 3.6, 10, C.iron, { top: C.ironL }); b.cyl(0, -1.6, 0, 0.6, 1.6, 0.6, 6, C.ironL); });
  b.beam([22.5, 32, 0], [22.5, 37, 0], 0.25, C.woodD); flag(b, 22.6, 37, 0, 4.5, 2.4, CLOTHC(1));
}
/** Upper gondola station (48-grid, rot 1): platform x −22..0 × z −8..7 (deck y 6), roof, bullwheel trestles (wheel at (10.5, 19)). */
function gondolaStationHigh(b) {
  for (const [x, z] of [[-21.5, -7.5], [-21.5, 6.5], [-11, -7.5], [-11, 6.5], [-0.5, -7.5], [-0.5, 6.5]]) b.box(x - 0.6, 0, z - 0.6, x + 0.6, 5, z + 0.6, C.woodD);
  b.box(-22, 5, -8, 0.5, 6, 7.5, C.woodL, { sides: C.wood });
  for (let x = -21; x < 0; x += 2) b.box(x, 5.99, -8, x + 0.12, 6.04, 7.5, C.woodD, { bottom: false });
  railing(b, [-21.5, -7.8], [0, -7.8], 6, 1.6); railing(b, [-8.5, 7.3], [0, 7.3], 6, 1.6); railing(b, [0, -7.8], [0, 7.3], 6, 1.6);
  for (const z of [-7.5, 7]) b.box(-22.5, 6, z - 0.5, -21.5, 12.5, z + 0.5, PIL(1), { top: PIL(0.75) });
  for (let k = 0; k < 6; k++) b.box(-15 + k, 0, 7.5, -14 + k, k + 1, 12, k % 2 ? C.woodL : C.wood);
  for (const [x, z] of [[-20, -7], [-20, 6.5], [-12, -7], [-12, 6.5], [-4, -7], [-4, 6.5]]) b.cyl(x, 6, z, 0.45, 13.4, 0.45, 6, PIL(1));
  b.roof(-20, -4, -7, 6.5, 13.4, 4.6, { ov: 2.2, up: 1.4 }); lantern(b, -20, 12.8, 7.5); lantern(b, -4, 12.8, 7.5);
  // bullwheel trestles
  for (const sz of [-1, 1]) { const z = sz * 5; b.beam([3, 0, z], [10.5, 19, z], 0.7, C.wood); b.beam([18, 0, z], [10.5, 19, z], 0.7, C.wood); b.beam([5.5, 7, z], [15.5, 7, z], 0.45, C.woodD); b.cube(10.5, 18, z, 2, 2.2, 1.8, C.iron); }
  for (const x of [2.5, 18.5]) b.box(x - 0.7, 0, -6.5, x + 0.7, 1, 6.5, C.woodD);
  b.cyl(-22.5, 6, 8, 0.25, 24, 0.2, 5, C.woodD); flag(b, -22.3, 24, 8, 5, 3, CLOTHC(1), C.gold);
}
/** Gondola cabin (10 × 8 × 8, floor y 1) hanging from a grip on the cable at local (0, 22, 0). */
function gondolaCar(b) {
  b.box(-5, 0, -4, 5, 1.2, 4, C.woodD, { top: C.woodL });
  for (const [x, z] of [[-5, -4], [5, -4], [-5, 4], [5, 4], [-5, 0], [5, 0]]) b.box(x - 0.45, 1.2, z - 0.45, x + 0.45, 8.4, z + 0.45, PIL(1));
  for (const z of [-4, 4]) { b.box(-5, 1.2, z - 0.3, -1.4, 3.6, z + 0.3, C.woodL); b.box(1.4, 1.2, z - 0.3, 5, 3.6, z + 0.3, C.woodL); b.box(-5, 3.4, z - 0.32, -1.4, 3.8, z + 0.32, C.red); b.box(1.4, 3.4, z - 0.32, 5, 3.8, z + 0.32, C.red); }
  for (const x of [-5, 5]) { b.box(x - 0.3, 1.2, -4, x + 0.3, 3.6, 4, C.woodL); b.box(x - 0.32, 3.4, -4, x + 0.32, 3.8, 4, C.red); }
  b.box(-5.4, 8.4, -4.4, 5.4, 9, 4.4, C.woodD);
  b.roof(-5, 5, -4, 4, 9, 3, { ov: 1.2, up: 0.8, bands: 2 });
  lantern(b, 4.6, 8.2, 4.4, 0.7);
  b.beam([0, 12, 0], [0, 21, 0], 0.5, C.iron); b.box(-1.6, 20.6, -1.2, 1.6, 23.8, 1.2, C.iron, { top: C.ironL });
  for (const x of [-1, 1]) b.save(() => { b.t(x, 23.6, 0).rx(Math.PI / 2); b.cyl(0, -0.6, 0, 0.7, 0.6, 0.7, 6, C.ironL); });
}
/** Cargo lift shaft section (48-grid): four timber posts at (±19.5, ±19.5), girts and cross braces on −x, +x, +z; −z open. */
function cargoLiftSection(b) {
  const P = 19.5;
  for (const [x, z] of [[-P, -P], [P, -P], [-P, P], [P, P]]) { b.box(x - 1.6, 0, z - 1.6, x + 1.6, 30, z + 1.6, C.wood); b.box(x - 1.7, 13.5, z - 1.7, x + 1.7, 15, z + 1.7, C.iron); b.box(x - 1.7, 28.5, z - 1.7, x + 1.7, 30, z + 1.7, C.iron); }
  const face = (a, c) => { b.beam([a[0], 28.6, a[1]], [c[0], 28.6, c[1]], 0.9, C.woodL); b.beam([a[0], 14.2, a[1]], [c[0], 14.2, c[1]], 0.8, C.woodL);
    b.beam([a[0], 1, a[1]], [c[0], 27.5, c[1]], 0.6, C.wood); b.beam([c[0], 1, c[1]], [a[0], 27.5, a[1]], 0.6, C.woodD); };
  face([-P, -P], [-P, P]); face([P, -P], [P, P]); face([-P, P], [P, P]);
  for (const x of [-10, 10]) b.box(x - 0.6, 0, -P + 0.4, x + 0.6, 30, -P + 1.4, C.woodD);   // guide rails against the cliff
}
/** Cargo lift head gantry on the clifftop (48-grid, 44 high): posts, a top frame, rope drums, a tiled roof, lanterns. */
function cargoLiftHead(b) {
  const P = 19.5;
  for (const [x, z] of [[-P, -P], [P, -P], [-P, P], [P, P]]) b.box(x - 1.6, 0, z - 1.6, x + 1.6, 26, z + 1.6, C.wood);
  for (const [a, c] of [[[-P, -P], [P, -P]], [[-P, P], [P, P]], [[-P, -P], [-P, P]], [[P, -P], [P, P]]]) { b.beam([a[0], 25, a[1]], [c[0], 25, c[1]], 1.2, C.woodL); b.beam([a[0], 12, a[1]], [c[0], 12, c[1]], 0.8, C.woodD); }
  b.box(-22, 25.5, -22, 22, 26.5, 22, C.woodD);
  for (const x of [-10, 10]) b.save(() => { b.t(x, 22, 0).rx(Math.PI / 2); b.cyl(0, -6, 0, 3.2, 6, 3.2, 10, C.rope, { sideCols: [C.rope, C.ropeD] }); b.cyl(0, -7, 0, 0.8, 7, 0.8, 6, C.iron); });
  for (const x of [-10, 10]) for (const z of [-8, 8]) b.box(x - 1, 12, z - 0.8, x + 1, 22, z + 0.8, C.woodD);
  // capstan bars for the oxen above, a counterweight sheave, the roof
  for (const z of [-17, 17]) b.box(-17, 26.5, z - 1, 17, 28.5, z + 1, C.woodL);
  walls(b, -14, 14, -14, 14, 26.5, 33, { posts: true });
  windowOn(b, "front", -14, 14, -14, 14, -6, 28.5, 4, 3); windowOn(b, "front", -14, 14, -14, 14, 6, 28.5, 4, 3);
  windowOn(b, "back", -14, 14, -14, 14, 0, 28.5, 4, 3, "slats");
  b.roof(-14, 14, -14, 14, 33, 9.5, { ov: 6, up: 2.2 });
  for (const [x, z] of [[-21, 21], [21, 21]]) lantern(b, x, 24, z);
}
/** Cargo lift cage (40-grid): a 32 × 32 plank floor, corner posts, side railings, a yoke at y 22 with the hoist rope eyes at x ±10. */
function cargoLiftCage(b) {
  b.box(-16, 0, -16, 16, 2, 16, C.woodL, { sides: C.wood });
  for (let x = -15; x < 16; x += 3) b.box(x, 1.99, -16, x + 0.15, 2.05, 16, C.woodD, { bottom: false });
  b.box(-16.2, 0.3, -16.2, 16.2, 1.2, 16.2, C.iron, { top: false });
  for (const [x, z] of [[-15.5, -15.5], [15.5, -15.5], [-15.5, 15.5], [15.5, 15.5]]) b.box(x - 0.6, 2, z - 0.6, x + 0.6, 11, z + 0.6, PIL(1), { top: PIL(0.75) });
  for (const x of [-15.5, 15.5]) { railing(b, [x, -15.5], [x, 15.5], 2, 3, C.woodL, 3); b.beam([x, 11, -15.5], [x, 11, 15.5], 0.5, C.red); }
  for (const x of [-15.5, 15.5]) { b.box(x - 0.6, 2, -0.6, x + 0.6, 23, 0.6, C.woodD); }
  b.box(-16, 22, -0.8, 16, 24, 0.8, C.woodD, { top: C.wood });
  for (const x of [-10, 10]) b.save(() => { b.t(x, 24.5, 0).rz(Math.PI / 2).rx(Math.PI / 2); b.cyl(0, -0.3, 0, 1, 0.3, 1, 8, C.iron); });
  for (const x of [-14, 14]) lantern(b, x, 10.6, 15.6, 0.8);
}
/** Cargo airship (64-grid: x −23..26): a striped envelope, fins, a boat-hull gondola with crew, crates in a net. */
function spindle(b, x0, x1, cy, rmax, n, cols) {
  const K = 10, prof = (t) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.65);
  const ring = (k) => { const t = k / K, x = x0 + (x1 - x0) * t, r = rmax * prof(t * 0.96 + 0.02); return [...Array(n)].map((_, i) => { const a = (i / n) * Math.PI * 2; return [x, cy + Math.cos(a) * r, Math.sin(a) * r]; }); };
  const tip0 = [x0 - 0.5, cy, 0], tip1 = [x1 + 0.5, cy, 0]; let prev = null;
  for (let k = 0; k <= K; k++) { const R = ring(k);
    if (k === 0) for (let i = 0; i < n; i++) b.tri(tip0, R[i], R[(i + 1) % n], cols[i % cols.length]);
    if (prev) for (let i = 0; i < n; i++) { const j = (i + 1) % n; b.quad(prev[i], R[i], R[j], prev[j], cols[(i + k) % cols.length]); }
    if (k === K) for (let i = 0; i < n; i++) b.tri(tip1, R[(i + 1) % n], R[i], cols[i % cols.length]);
    prev = R; }
}
function airshipCargo(b) {
  spindle(b, -22, 26, 34, 12.5, 10, ["#e0c890", "#c8a868", "#d8b878"]);
  for (const [dy, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.quad([-14, 34 + dy * 6, dz * 6], [-22, 34 + dy * 13, dz * 13], [-25, 34 + dy * 13, dz * 13], [-21, 34 + dy * 3, dz * 3], dy + dz > 0 ? C.red : "#b02a20"),
    b.quad([-21, 34 + dy * 3, dz * 3], [-25, 34 + dy * 13, dz * 13], [-22, 34 + dy * 13, dz * 13], [-14, 34 + dy * 6, dz * 6], "#902018");
  // hull
  const hull = [[-12, 3], [-8, 5], [8, 5], [13, 2.5]];
  for (let i = 0; i < hull.length - 1; i++) { const [xa, wa] = hull[i], [xb, wb] = hull[i + 1];
    b.quad([xa, 14, -wa * 0.5], [xb, 14, -wb * 0.5], [xb, 18.5, -wb], [xa, 18.5, -wa], C.wood); b.quad([xa, 18.5, wa], [xb, 18.5, wb], [xb, 14, wb * 0.5], [xa, 14, wa * 0.5], C.wood);
    b.quad([xa, 14, wa * 0.5], [xb, 14, wb * 0.5], [xb, 14, -wb * 0.5], [xa, 14, -wa * 0.5], C.woodD); b.quad([xa, 18.4, -wa], [xb, 18.4, -wb], [xb, 18.4, wb], [xa, 18.4, wa], C.woodL); }
  b.quad([-12, 14, 1.5], [-12, 14, -1.5], [-12, 18.5, -3], [-12, 18.5, 3], C.woodD); b.quad([13, 14, -1.25], [13, 14, 1.25], [13, 18.5, 2.5], [13, 18.5, -2.5], C.woodD);
  railing(b, [-11, -3.6], [11, -3.6], 18.5, 1.3); railing(b, [-11, 3.6], [11, 3.6], 18.5, 1.3);
  b.box(-4, 18.5, -2.6, 3, 22, 2.6, WALLC(1)); b.roof(-4, 3, -2.6, 2.6, 22, 2, { ov: 0.8, up: 0.6, bands: 2 }); b.glowing("window", () => b.box(-2, 19.6, 2.6, 1, 21.2, 2.75, C.paper));
  figure(b, 9, 18.5, 0, { top: "#3a6ad8", hat: "cap" }); figure(b, -9, 18.5, 0, { top: "#8a5a32" });
  b.beam([-12, 17, 0], [-17, 17, 0], 0.3, C.iron); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; b.quad([-17.3, 17, 0], [-17.3, 17 + Math.cos(a) * 3, Math.sin(a) * 3], [-17.3, 17 + Math.cos(a + 0.5) * 3, Math.sin(a + 0.5) * 3], [-17.3, 17, 0], C.woodL); b.quad([-17.3, 17, 0], [-17.3, 17 + Math.cos(a + 0.5) * 3, Math.sin(a + 0.5) * 3], [-17.3, 17 + Math.cos(a) * 3, Math.sin(a) * 3], [-17.3, 17, 0], C.woodD); }
  for (const x of [-10, -3, 4, 11]) for (const s of [-1, 1]) b.beam([x, 18.5, s * 3.6], [x * 1.1, 25, s * 8], 0.15, C.rope);
  lantern(b, 12.6, 18, 0, 0.8); lantern(b, -11.6, 18, 0, 0.8);
  // crates in a net under the hull
  for (const [x, z] of [[-3, -1.2], [1, 1.2], [-1, 1.4], [2.6, -1.4]]) crate(b, x, 8.5, z, 2.6, C.woodL);
  for (const [x, z] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) b.beam([x * 0.7, 8.5, z], [x, 14, z * 0.5], 0.12, C.rope);
}
/** Pleasure balloon (48-grid, ~43 high): a gored envelope, wicker basket, a little sail. */
function airshipSmall(b) {
  const n = 12, rows = [[-14, 0.2], [-9, 0.75], [-3, 0.98], [3, 1], [8, 0.9], [12, 0.6], [14.4, 0.15]], R0 = 12.5;
  for (let k = 0; k < rows.length - 1; k++) for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, [ya, ra] = rows[k], [yb, rb] = rows[k + 1];
    const P = (a, y, r) => [Math.cos(a) * r * R0, 28 + y, Math.sin(a) * r * R0], col = i % 2 ? "#f4f0e4" : "#2a9a7a";
    b.quad(P(a1, ya, ra), P(a0, ya, ra), P(a0, yb, rb), P(a1, yb, rb), k === 3 ? (i % 2 ? "#ffd860" : "#e04a3a") : col); }
  b.cyl(0, 42.3, 0, 2, 43, 1, 8, C.gold);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; b.beam([Math.cos(a) * 2.6, 14.3, Math.sin(a) * 2.6], [Math.cos(a) * 3.4, 7.5, Math.sin(a) * 3.4], 0.12, C.rope); }
  b.cyl(0, 13.6, 0, 2.6, 14.3, 2.8, 8, C.ropeD);
  b.box(-3.6, 2, -3.6, 3.6, 7.5, 3.6, "#c8a060", { top: "#8a6a3a" }); b.box(-3.9, 6.8, -3.9, 3.9, 7.6, 3.9, C.woodD);
  for (const [x, z] of [[-4, -1.5], [-4, 1.5], [4, -1.5], [4, 1.5]]) b.blob(x, 4.4, z, 0.7, 0.9, 0.7, "#b8a070", { seed: 2 });
  lantern(b, 4.2, 7, 3.4, 0.7); lantern(b, 4.2, 7, -3.4, 0.7);
  b.beam([-3.6, 6, 0], [-11, 8, 0], 0.15, C.woodD);
  b.quad([-4, 7.4, 0], [-10.6, 8.2, 0], [-9, 15, 0], [-4, 14, 0], "#e04a3a"); b.quad([-4, 14, 0], [-9, 15, 0], [-10.6, 8.2, 0], [-4, 7.4, 0], "#b83a2a");
}
/** Airship mooring mast (48-grid: x −16..7, ~47 high): a tapering timber tower, a platform at y 32, a mooring hook, a pennant. */
function mooringMast(b) {
  b.box(-7, 0, -7, 7, 1.4, 7, C.stone, { top: C.stoneL });
  for (const [x, z] of [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5]]) b.beam([x, 1.4, z], [x * 0.5, 32, z * 0.5], 0.75, C.wood);
  for (let y = 7; y < 31; y += 8) { const s = 5.5 - (y / 32) * 2.75; for (const [a, c] of [[[-s, -s], [s, -s]], [[s, -s], [s, s]], [[s, s], [-s, s]], [[-s, s], [-s, -s]]]) b.beam([a[0], y, a[1]], [c[0], y, c[1]], 0.35, C.woodD); }
  for (let y = 1.4; y < 32; y += 8) for (const s of [-1, 1]) b.beam([-5.5 + (y / 32) * 2.75, y, s * (5.5 - (y / 32) * 2.75)], [5.5 - ((y + 8) / 32) * 2.75, Math.min(32, y + 8), s * (5.5 - ((y + 8) / 32) * 2.75)], 0.25, C.wood);
  b.box(-7, 31.4, -7, 7, 32.4, 7, C.woodL, { sides: C.woodD });
  railing(b, [-7, -7], [7, -7], 32.4, 1.4); railing(b, [-7, 7], [7, 7], 32.4, 1.4); railing(b, [-7, -7], [-7, 7], 32.4, 1.4);
  b.cyl(0, 32.4, 0, 1.2, 44, 0.8, 6, C.woodD); b.cyl(0, 44, 0, 1.6, 45, 1.6, 6, C.iron);
  b.save(() => { b.t(0, 46, 0).rz(Math.PI / 2); b.cyl(0, -0.4, 0, 1.4, 0.4, 1.4, 8, C.ironL); });
  b.beam([0, 43, 0], [-15, 43, 0], 0.18, C.woodD); for (let k = 0; k < 6; k++) b.quad([-15 + k * 2.4, 43, 0], [-15 + k * 2.4, 41.4, 0], [-13 + k * 2.4, 41.4, 0], [-13 + k * 2.4, 43, 0], k % 2 ? C.gold : C.red), b.quad([-13 + k * 2.4, 43, 0], [-13 + k * 2.4, 41.4, 0], [-15 + k * 2.4, 41.4, 0], [-15 + k * 2.4, 43, 0], k % 2 ? C.goldD : "#a02a22");
  lantern(b, 6.6, 36, 6.6, 0.8); lantern(b, -6.6, 36, 6.6, 0.8); crate(b, 4, 32.4, -4, 2.4);
}

// ---------------------------------------------------------------------------------------------------------------
export const MODELS = {
  home1: house("home1"), home2: house("home2"), shop: house("shop"), inn: house("inn"),
  manor, hall_house: hallHouse, compound, teahouse, garden_flower: gardenFlower, garden_pond: gardenPond,
  pagoda, stall, city_gate: cityGate, fort_gate: fortGate, wall: wallSeg, tower, water_gate: waterGate, palace_wall: palaceWall,
  palace_great_hall: greatHall, lion_statue: lionStatue, dragon_statue: dragonStatue, incense_burner: incenseBurner, statue,
  tree_round: canopyTree([C.leafD, C.leaf, C.leafL, C.leafLL], 3), tree_fruit: canopyTree(["#2f8a3a", C.leaf, C.leafL], 5, { fruit: true }),
  tree_blossom: canopyTree([C.pinkD, C.pink, C.pinkL, "#fff2f6"], 7), tree_pine: pine, bamboo, tree_camphor: camphor, tree_ginkgo: ginkgo,
  lantern_post: lanternPost, well, haystack, jars: jarsProp, crates: cratesProp, target,
  rickshaw, oxcart, sedan, barrow, boat, waterwheel,
  bridge_stone: bridgeStone, pulley_wheel: pulleyWheel, capstan, gondola_station_low: gondolaStationLow, gondola_station_high: gondolaStationHigh, gondola_car: gondolaCar,
  cargo_lift_section: cargoLiftSection, cargo_lift_head: cargoLiftHead, cargo_lift_cage: cargoLiftCage,
  airship_cargo: airshipCargo, airship_small: airshipSmall, mooring_mast: mooringMast,
};
const cache = new Map();
/** Geometry for a model name (cached). userData: {glow, lights, tris}. */
export function modelGeometry(name) {
  if (!cache.has(name)) { const fn = MODELS[name]; if (!fn) throw new Error("no model " + name); const b = new Builder(); fn(b); cache.set(name, b.build()); }
  return cache.get(name);
}
export function wheelGeometry(r) { const key = "wheel:" + r; if (!cache.has(key)) { const b = new Builder(); wheel(b, r); cache.set(key, b.build()); } return cache.get(key); }
