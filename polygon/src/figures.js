// Low-poly people and animals (front faces +z, standing on y = 0, centred on x = z = 0, about 10 units tall).
// Simple on purpose: a few prisms and faceted blobs each. Limbs are tagged (Builder.part = [k, pivotY, pivotZ]) for the
// walk shader in main.js: k ±1 = legs, ±2 = arms (swing 0.7×); the sign is the phase (left leg with right arm).
import { Builder, shade } from "./geo.js";
import { DOG_COLORS, CAT_LOOKS, PIGEON_COLORS, DUCK_LOOKS } from "./people.js";

const INK = "#2a1f2d", GOLD = "#f0c040", WOOD = "#8a5a32", WOODL = "#b07a44", WOODD = "#5e3a1e", STRAW = "#e0c080", STRAWD = "#b89858";

/** Mesh for a person look (see people.js genPerson). */
export function personGeometry(p) {
  const b = new Builder(), dk = (h, f = 0.78) => shade(h, f);
  // legs or robe
  if (p.dress) { b.cyl(0, 0, 0, 2.0, 3.2, 1.45, 7, p.bottom, { kz: 0.85, sideCols: [p.bottom, dk(p.bottom, 0.9)] }); }
  else for (const s of [-1, 1]) { b.part = [s < 0 ? 1 : -1, 3, 0];
    b.box(s * 0.75 - 0.55, 0, -0.6, s * 0.75 + 0.55, 0.7, 0.75, p.shoe); b.box(s * 0.75 - 0.5, 0.7, -0.5, s * 0.75 + 0.5, 3.1, 0.5, p.bottom); b.part = null; }
  // torso + sash
  b.cyl(0, 3, 0, 1.55, 6.1, 1.75, 6, p.top, { kz: 0.72, rot: Math.PI / 6 });
  b.cyl(0, 3.1, 0, 1.68, 3.7, 1.7, 6, p.sash, { kz: 0.76, rot: Math.PI / 6, top: false, bottom: false });
  b.box(-0.5, 5.3, 1.18, 0.5, 6, 1.3, dk(p.top, 0.7), { bottom: false });
  // arms with hands (the right arm stays put when it holds something)
  for (const s of [-1, 1]) { const swing = s < 0 || !p.item; b.part = swing ? [s < 0 ? -2 : 2, 5.9, 0] : null;
    b.box(s * 2.15 - 0.45, 3.6, -0.45, s * 2.15 + 0.45, 6, 0.45, p.top); b.box(s * 2.15 - 0.4, 2.9, -0.4, s * 2.15 + 0.4, 3.6, 0.4, p.skin); b.part = null; }
  // head, face, hair
  b.cyl(0, 6.1, 0, 1.6, 6.6, 1.95, 8, p.skin, { bottom: false, top: false, kz: 0.92 }); b.cyl(0, 6.6, 0, 1.95, 8.7, 1.95, 8, p.skin, { bottom: false, top: false, kz: 0.92 });
  b.cyl(0, 8.7, 0, 1.95, 9.5, 1.3, 8, p.arch === "monk" ? p.skin : p.hair, { kz: 0.92, bottom: false });
  for (const s of [-1, 1]) b.quad([s * 0.75 - 0.25, 7.5, 1.86], [s * 0.75 + 0.25, 7.5, 1.86], [s * 0.75 + 0.25, 8.15, 1.86], [s * 0.75 - 0.25, 8.15, 1.86], INK);
  if (p.arch !== "monk") { b.box(-2.05, 6.4, -1.95, 2.05, 8.9, -0.5, p.hair, { bottom: false }); for (const s of [-1, 1]) b.box(s * 1.97 - 0.12, 7.3, -0.6, s * 1.97 + 0.12, 8.9, 0.6, p.hair, { bottom: false }); }
  if (p.beard) b.blob(0, 6.3, 1.35, 1.25, 1.1, 0.75, p.hair, { seed: 7 });
  if (p.bun) { b.blob(0, 10, -0.9, 0.95, 0.85, 0.95, p.hair, { seed: 2 }); b.beam([-1, 10.2, -0.9], [1, 10.4, -0.7], 0.15, GOLD); }
  switch (p.hat) {
    case "straw": b.cone(0, 9.2, 0, 4, 2.4, 9, STRAW, { bottomCol: STRAWD, sideCols: [STRAW, shade(STRAW, 0.92)] }); break;
    case "cap": b.cyl(0, 9.2, 0, 1.95, 10.1, 1.75, 7, p.hatColor); b.blob(0, 10.3, 0, 0.45, 0.4, 0.45, "#e04a3a", { seed: 1 }); break;
    case "official": b.cyl(0, 9.2, 0, 1.95, 10.2, 1.9, 7, "#2a2a30"); b.box(-1.2, 10.2, -0.8, 1.2, 11.2, 0.6, "#2a2a30"); b.box(-4.6, 10, -0.3, 4.6, 10.4, 0.1, "#2a2a30"); break;
    case "helmet": b.cyl(0, 8.9, 0, 2.3, 10.4, 1.6, 7, "#a8a8b8", { top: "#8a8a9a" }); b.cone(0, 10.4, 0, 1.4, 1.2, 6, "#8a8a9a"); b.beam([0, 11.4, 0], [0, 13, -0.4], 0.35, "#e04a3a", 4); break;
  }
  // held items (right hand at x 2.15, y 3.2)
  const hx = 2.6;
  switch (p.item) {
    case "spear": b.beam([hx, 0, 0.4], [hx, 14, 0.4], 0.18, WOOD); b.cone(hx, 14, 0.4, 0.45, 1.8, 4, "#d8e8f0"); b.blob(hx, 13.4, 0.6, 0.4, 0.5, 0.4, "#e04a3a"); break;
    case "halberd": b.beam([hx, 0, 0.4], [hx, 15, 0.4], 0.18, WOOD); b.box(hx, 12.4, 0.25, hx + 1.8, 14.4, 0.55, "#d8e8f0"); b.cone(hx, 15, 0.4, 0.3, 1.1, 4, "#d8e8f0"); break;
    case "staff": b.beam([hx, 0, 0.4], [hx + 0.2, 12.5, 0.3], 0.2, WOOD); b.blob(hx + 0.2, 12.9, 0.3, 0.55, 0.55, 0.55, GOLD); break;
    case "hoe": b.beam([hx, 0, 1], [hx, 10.5, 1], 0.17, WOOD); b.box(hx - 0.2, 10, 1, hx + 0.2, 10.6, 2.8, "#8a8a96"); break;
    case "flag": b.beam([hx, 0, 0.4], [hx, 14.5, 0.4], 0.17, WOOD); { const c = p.arch === "soldier" ? "#f0b830" : "#e04a3a"; b.quad([hx, 14.4, 0.4], [hx, 10, 0.4], [hx + 3.6, 11, 0.4], [hx + 3.6, 14.2, 0.4], c); b.quad([hx + 3.6, 14.2, 0.4], [hx + 3.6, 11, 0.4], [hx, 10, 0.4], [hx, 14.4, 0.4], dk(c, 0.8)); } break;
    case "parasol": b.beam([hx, 3, 0.4], [hx - 0.6, 12.6, 0.2], 0.12, WOOD); b.cone(hx - 0.6, 12.4, 0.2, 4.4, 1.8, 9, "#f0e8d0", { sideCols: ["#f0e8d0", dk(p.top, 0.95)], bottomCol: dk(p.top, 0.75) }); break;
    case "basket": b.cyl(hx + 0.3, 2.1, 1, 1.2, 3.6, 1.5, 7, STRAW, { top: "#58c060" }); b.blob(hx + 0.3, 3.8, 1, 0.7, 0.4, 0.7, "#e04a3a"); break;
    case "fan": b.save(() => { b.t(hx + 0.4, 3.9, 1).rz(-0.4); b.quad([0, 0, 0], [2, 1, 0], [2, 3.2, 0], [-0.6, 2.4, 0], "#fff4d8"); b.quad([-0.6, 2.4, 0], [2, 3.2, 0], [2, 1, 0], [0, 0, 0], "#e8d8b8"); }); break;
    case "kite": b.beam([hx, 3.2, 0.6], [hx + 1.6, 14, 3.4], 0.04, "#d8d4cc"); b.quad([hx + 1.6, 15.6, 3.4], [hx + 0.4, 14, 3.4], [hx + 1.6, 12.2, 3.4], [hx + 2.8, 14, 3.4], "#e04a3a"); b.quad([hx + 2.8, 14, 3.4], [hx + 1.6, 12.2, 3.4], [hx + 0.4, 14, 3.4], [hx + 1.6, 15.6, 3.4], "#c03a2a"); break;
    case "pole": b.beam([0.4, 6.3, -6.6], [0.4, 6.3, 6.6], 0.22, WOODL); for (const z of [-6.2, 6.2]) { b.beam([0.4, 6.2, z], [0.4, 4.2, z], 0.06, WOODD); b.cyl(0.4, 2, z, 1.3, 4.2, 1.6, 7, STRAW, { top: "#58c060" }); } break;
    case "rod": b.beam([hx, 3.4, 0.6], [hx, 11, 7.5], 0.13, WOODL); break;
  }
  return b.build();
}

/** Mesh for an animal look ({animal, variant}); pose (pigeons only): undefined = folded, "up" / "down" = flight frames. */
export function animalGeometry(kind, variant, pose) {
  const b = new Builder(), dk = (h, f = 0.75) => shade(h, f);
  const legs = (pts, y1, col, w = 0.55) => { for (const [x, z, k] of pts) { b.part = [k, y1, z]; b.box(x - w / 2, 0, z - w / 2, x + w / 2, y1 + 0.2, z + w / 2, col); b.part = null; } };
  switch (kind) {
    case "dog": { const c = DOG_COLORS[variant % DOG_COLORS.length];
      legs([[-0.8, -2.2, 1], [0.8, -2.2, -1], [-0.8, 2.2, -1], [0.8, 2.2, 1]], 2, dk(c), 0.6);
      b.box(-1.3, 2, -3, 1.3, 4.2, 3, c, { top: shade(c, 1.08) });
      b.box(-1.3, 3.6, 2.4, 1.3, 6.2, 4.8, c); b.box(-0.6, 3.8, 4.8, 0.6, 4.9, 5.8, dk(c, 0.7)); b.box(-0.25, 4.5, 5.8, 0.25, 4.95, 5.95, INK);
      for (const s of [-1, 1]) { b.box(s * 0.7 - 0.25, 5.1, 4.75, s * 0.7 + 0.25, 5.6, 4.85, INK); b.box(s * 1.05 - 0.35, 5.6, 2.6, s * 1.05 + 0.35, 7, 3.2, dk(c, 0.6)); }
      b.beam([0, 3.8, -3], [0, 5.6, -4.4], 0.35, c); break; }
    case "cat": { const L = CAT_LOOKS[variant % CAT_LOOKS.length], c = L.color, st = L.stripe ?? c;
      legs([[-0.55, -1.8, 1], [0.55, -1.8, -1], [-0.55, 1.8, -1], [0.55, 1.8, 1]], 1.6, dk(c), 0.45);
      b.box(-0.9, 1.6, -2.4, 0.9, 3.3, 2.4, c); for (const z of [-1.4, 0, 1.2]) b.box(-0.92, 3.0, z - 0.3, 0.92, 3.32, z + 0.3, st);
      b.blob(0, 4, 2.6, 1.4, 1.2, 1.2, c, { seed: 4, jitter: 0.05 }); for (const s of [-1, 1]) { b.cone(s * 0.8, 4.8, 2.6, 0.45, 1.2, 3, c); b.box(s * 0.5 - 0.18, 4.2, 3.6, s * 0.5 + 0.18, 4.6, 3.75, INK); }
      b.box(-0.2, 3.6, 3.7, 0.2, 3.9, 3.85, "#f08ab0"); b.beam([0, 3, -2.4], [0, 5.8, -3.2], 0.28, st); break; }
    case "pigeon": { const c = PIGEON_COLORS[variant % PIGEON_COLORS.length];
      b.blob(0, 2, 0, 1.1, 1, 1.6, [dk(c, 0.85), c], { seed: 2, jitter: 0.05 }); b.blob(0, 3.2, 1.3, 0.75, 0.75, 0.75, dk(c, 0.92), { seed: 3 });
      b.box(-0.6, 2.4, 0.8, 0.6, 2.9, 1.5, "#5aa08a"); b.cone(0, 3.1, 2.1, 0.22, 0.6, 4, "#f0c8a0", { rot: 0 }); b.save(() => { b.t(0, 3.1, 1.95).rx(Math.PI / 2); b.cone(0, 0, 0, 0.22, 0.6, 4, "#f0c8a0"); });
      for (const s of [-1, 1]) b.box(s * 0.4 - 0.15, 0, -0.1, s * 0.4 + 0.15, 1.2, 0.2, "#e04a3a");
      b.quad([-0.7, 2, -1.4], [0.7, 2, -1.4], [0.6, 2.2, -2.8], [-0.6, 2.2, -2.8], dk(c)); b.quad([-0.6, 2.2, -2.8], [0.6, 2.2, -2.8], [0.7, 2, -1.4], [-0.7, 2, -1.4], dk(c, 0.6));
      if (pose) { const w = dk(c, 0.88), tip = dk(c, 0.6), up = pose === "up" ? 1 : -1;
        for (const s of [-1, 1]) { const A = [s * 0.9, 2.3, 0.9], B = [s * 0.9, 2.3, -0.9], Cc = [s * 2.7, 2.3 + up * 1.1, -0.8], D = [s * 2.7, 2.3 + up * 1.1, 0.8], E = [s * 4.4, 2.3 + up * 2.4, 0];
          b.quad(A, B, Cc, D, w); b.quad(D, Cc, B, A, w); b.tri(D, Cc, E, tip); b.tri(E, Cc, D, tip); } }
      break; }
    case "chicken": { const c = ["#fff4d8", "#c88a5a", "#3a3440", "#f0b830"][variant % 4];
      for (const s of [-1, 1]) b.box(s * 0.45 - 0.15, 0, -0.1, s * 0.45 + 0.15, 1.3, 0.2, "#f07a2a");
      b.blob(0, 2.4, 0, 1.2, 1.2, 1.6, [dk(c, 0.85), c], { seed: 5 }); b.blob(0, 4.1, 1.2, 0.8, 0.9, 0.8, c, { seed: 6 });
      b.box(-0.15, 4.7, 0.8, 0.15, 5.6, 1.7, "#e04a3a"); b.save(() => { b.t(0, 4.1, 1.9).rx(Math.PI / 2); b.cone(0, 0, 0, 0.3, 0.7, 4, "#f07a2a"); });
      b.box(-0.5, 2.8, -2, 0.5, 4.2, -1.2, dk(c)); break; }
    case "duck": { const L = DUCK_LOOKS[variant % DUCK_LOOKS.length];
      b.blob(0, 0.9, 0, 1.4, 0.9, 2.3, [dk(L.body, 0.85), L.body], { seed: 8, flat: -0.4 }); b.blob(0, 2.4, 1.7, 0.8, 0.85, 0.8, L.head, { seed: 9 });
      b.box(-0.4, 2.1, 2.4, 0.4, 2.45, 3.3, "#f0a020"); for (const s of [-1, 1]) b.box(s * 0.55 - 0.12, 2.6, 2.2, s * 0.55 + 0.12, 2.85, 2.4, INK);
      b.cone(0, 1.2, -2.2, 0.5, 1, 4, dk(L.body)); break; }
    case "pig": { const P = "#f0a8a8";
      legs([[-1.2, -2.6, 1], [1.2, -2.6, -1], [-1.2, 2.4, -1], [1.2, 2.4, 1]], 1.6, "#d08a8a", 0.7);
      b.blob(0, 3.6, 0, 2.3, 2.1, 3.6, [dk(P, 0.88), P, shade(P, 1.05)], { seed: 4, jitter: 0.06 });
      b.box(-1, 3, 3.4, 1, 4.6, 4.3, "#e08a9a"); for (const s of [-1, 1]) { b.box(s * 0.7 - 0.2, 5, 3, s * 0.7 + 0.2, 5.4, 3.15, INK); b.cone(s * 1.2, 5.4, 2.4, 0.6, 1, 3, P); } break; }
    case "cow": { const spot = variant === "spotted", base = spot ? "#f4f0e8" : variant;
      legs([[-1.8, -3.6, 1], [1.8, -3.6, -1], [-1.8, 3.4, -1], [1.8, 3.4, 1]], 4, dk(base, 0.7), 0.9);
      b.box(-2.4, 4, -4.6, 2.4, 8.4, 4.4, base, { top: shade(base, 1.06) });
      if (spot) { b.box(-2.45, 5.6, -3, -1.5, 7.8, -0.6, "#2a2030"); b.box(1.5, 5, 0.6, 2.45, 7.2, 3, "#2a2030"); b.box(-1.2, 8.35, -3.6, 0.8, 8.45, -1.4, "#2a2030"); }
      b.box(-1.5, 6.2, 4, 1.5, 9.4, 6.8, base); b.box(-1.4, 6.2, 6.8, 1.4, 7.6, 7.6, "#e8a8a8");
      for (const s of [-1, 1]) { b.box(s * 0.85 - 0.25, 8.6, 6.75, s * 0.85 + 0.25, 9.1, 6.85, INK); b.beam([s * 1.2, 9.4, 5], [s * 2.6, 10.6, 5.2], 0.25, "#f0e8d0"); b.box(s * 2.2 - 0.6, 8.6, 4.4, s * 2.2 + 0.6, 9.2, 5.2, dk(base, 0.8)); }
      b.beam([0, 7.6, -4.6], [0, 4.4, -5.4], 0.3, dk(base, 0.7)); break; }
    case "sheep": {
      legs([[-1.1, -2, 1], [1.1, -2, -1], [-1.1, 2.4, -1], [1.1, 2.4, 1]], 2.6, "#3a3440", 0.55);
      b.blob(0, 5, 0.2, 2.6, 2.3, 3.6, ["#ddd6c8", "#f4f0e4", "#fffaf0"], { seed: 6, detail: 1, jitter: 0.12 });
      b.box(-0.9, 4.6, 3.5, 0.9, 6.8, 5.4, "#4a4450"); for (const s of [-1, 1]) { b.box(s * 1.2 - 0.4, 6, 3.8, s * 1.2 + 0.4, 6.4, 4.6, "#4a4450"); b.box(s * 0.5 - 0.15, 6.1, 5.4, s * 0.5 + 0.15, 6.4, 5.5, "#f4f0e4"); } break; }
    case "crane": {
      for (const s of [-1, 1]) b.beam([s * 0.6, 0, 0], [s * 0.5, 6, 0], 0.15, "#3a3440");
      b.blob(0, 7, 0, 1.4, 1.2, 2.6, ["#e8e4d4", "#fff4d8"], { seed: 3 }); b.quad([-1.3, 7.2, -1.6], [1.3, 7.2, -1.6], [1, 6.8, -3.4], [-1, 6.8, -3.4], "#3a3440"); b.quad([-1, 6.8, -3.4], [1, 6.8, -3.4], [1.3, 7.2, -1.6], [-1.3, 7.2, -1.6], "#2a2430");
      b.beam([0, 7.6, 2], [0, 12.6, 2.6], 0.32, "#fff4d8"); b.blob(0, 13, 2.8, 0.6, 0.6, 0.7, "#fff4d8", { seed: 2 }); b.box(-0.3, 13.4, 2.4, 0.3, 13.7, 3, "#e04a3a");
      b.save(() => { b.t(0, 12.9, 3.3).rx(Math.PI / 2); b.cone(0, 0, 0, 0.18, 1.6, 4, "#3a3440"); }); break; }
  }
  return b.build();
}
