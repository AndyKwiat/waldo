// Shared color ramps. Recipes paint with the canonical colors below; the renderer re-colors model variants
// (roof / wall / pillar / cloth) by mapping each canonical ramp onto the ramp of a new base color.
// Imported by both the model build script (Bun) and the browser.

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

export const roofRamp = (c) => ({ base: c, dark: shade(c, 0.74), light: shade(c, 1.22), cap: shade(c, 1.42), ridge: shade(c, 0.45), side: shade(c, 0.86) });
export const wallRamp = (c) => ({ base: c, d: shade(c, 0.93), l: shade(c, 1.04), shadow: shade(c, 0.72) });
export const colRamp = (c) => ({ base: c, d: shade(c, 0.74) });
export const clothRamp = (c) => ({ base: c, d: shade(c, 0.8) });

// canonical colors used by recipes (the renderer swaps these per variant)
export const ROOF = "#3a9ab0";
export const WALL = "#f6e8c8";
export const PILLAR = "#d0402e";
export const CLOTH = "#e04a3a";

/** Builds an exact hex→hex map that re-colors every shade of the canonical ramp to a new base color. */
export function rampRemap(kind, to) {
  const R = { roof: [roofRamp, ROOF], wall: [wallRamp, WALL], pillar: [colRamp, PILLAR], cloth: [clothRamp, CLOTH] }[kind];
  const [ramp, from] = R;
  const a = ramp(from), b = ramp(to), m = {};
  for (const k of Object.keys(a)) m[a[k]] = b[k];
  return m;
}

// fixed materials
export const M = {
  stone: "#a8a49a", stoneD: "#8a867e", stoneL: "#c8c4b8",
  brick: "#b8ae9a", brickD: "#9a907e", brickL: "#d0c8b6", skirt: "#9e978b", skirtD: "#86807a",
  wood: "#8a5a32", woodD: "#5e3a1e", woodL: "#b07a44",
  paper: "#f6e6b8", lattice: "#a8743e", door: "#c8342a", doorD: "#9a2a22", gold: "#f0c040", goldD: "#b8862a",
  beam: "#2f6fa8", beamL: "#4f8fc8", jade: "#3aa080", plaque: "#2a2a48", red: "#d8342a", lantern: "#e0382c",
  leaf: "#3aa848", leafD: "#2e8a3a", leafL: "#58c060", leafLL: "#7ad870", trunk: "#7a5232", trunkD: "#5a3a22",
  pink: "#f8b8c8", pinkD: "#e08aa0", pinkL: "#ffe0e8", hay: "#e8c048", hayD: "#c8a030", hayL: "#f8e080",
  water: "#3a8ac8", waterD: "#2a6aa8", cream: "#fff4d8", ink: "#2a1f2d", skin: "#f0c498", straw: "#e0c080", strawD: "#b89858",
  blue: "#2f6fa8", jarBlue: "#2f6fa8", jarBrown: "#a0603a", veg: "#58c060", orange: "#f07a2a", tomato: "#e04a3a",
};
