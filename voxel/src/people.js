// Procedural voxel characters and animals (16³ sketches, front faces +Z, centered on x=8.5 / z=8).
// They're simple on purpose: everyone moves by hopping, no limb animation.
import { M } from "../models/recipes/colors.js";

const SKINS = ["#f8d8b8", "#f0c498", "#e0a878", "#c88a5a", "#a86a42", "#80502e"];
const HAIRS = ["#2a2030", "#3a2a22", "#4a3020", "#6a4a2a", "#9a9aa8", "#f0e0b0"];
const CLOTH = ["#e04a3a", "#3a6ad8", "#3aa04a", "#f0b830", "#8a4ab0", "#f07a2a", "#8a5a32", "#2aa0a0", "#f08ab0", "#f0e8d0", "#8a8a96", "#3a3440",
  "#c0303a", "#5a9ae8", "#7ac050", "#ffd050", "#5a4ab0", "#d04a6a", "#5ac0a0", "#a0603a", "#d8b078", "#a8d0e8", "#f0a8a8", "#fff4d8"];

export const TITLES = { farmer: "Rice farmer", merchant: "Merchant", porter: "Porter", official: "Magistrate", monk: "Monk", kid: "Child", scholar: "Scholar",
  lady: "Townswoman", plain: "Townsperson", performer: "Street performer", daoist: "Daoist sage", soldier: "Soldier" };

/** Randomized look for an archetype (same spirit as the 2D game's genPerson). R = {pick, chance}. */
export function genPerson(arch, R) {
  const { pick, chance } = R;
  const p = { arch, skin: pick(SKINS), hair: pick(HAIRS), top: pick(CLOTH), bottom: pick(CLOTH), sash: pick(CLOTH), shoe: pick(["#3a3440", "#3a2a22", "#8a5a32"]), dress: chance(0.4), hat: null, hatColor: "#3a3440", item: null, beard: false, kid: false, bun: false };
  switch (arch) {
    case "farmer": p.hat = chance(0.75) ? "straw" : null; p.dress = false; p.top = pick(["#8a5a32", "#d8b078", "#8a8a96", "#3aa04a", "#3a6ad8", "#f0e8d0"]); p.bottom = pick(["#3a6ad8", "#3a2a22", "#8a8a96"]); p.item = pick(["hoe", "basket", null]); break;
    case "porter": p.hat = chance(0.6) ? "straw" : null; p.dress = false; p.top = pick(["#8a8a96", "#f0e8d0", "#d8b078"]); p.item = "pole"; break;
    case "merchant": p.hat = pick(["cap", null]); p.item = pick(["basket", "fan", null]); break;
    case "scholar": p.dress = true; p.hat = "cap"; p.top = p.bottom = pick(["#3a6ad8", "#8a8a96", "#f0e8d0", "#2aa0a0", "#5a4ab0"]); p.beard = chance(0.3); break;
    case "official": p.dress = true; p.hat = "official"; p.top = p.bottom = pick(["#e04a3a", "#5a4ab0", "#3a6ad8", "#3aa04a"]); p.sash = M.gold; p.beard = chance(0.5); break;
    case "monk": p.dress = true; p.hair = p.skin; p.top = p.bottom = pick(["#f0b830", "#f07a2a", "#d8783a"]); p.sash = "#c0303a"; break;
    case "lady": p.dress = true; p.bun = true; p.top = p.bottom = pick(["#f08ab0", "#f0a8a8", "#a8d0e8", "#fff4d8", "#5ac0a0", "#d04a6a", "#f0b830"]); p.item = pick(["parasol", "parasol", "fan", "basket", null]); break;
    case "daoist": p.dress = true; p.beard = true; p.hair = "#f0e0b0"; p.hat = "cap"; p.top = p.bottom = pick(["#8a8a96", "#a8d0e8", "#f0e8d0"]); p.item = "staff"; break;
    case "performer": p.hat = "cap"; p.hatColor = "#e04a3a"; p.top = pick(["#f0b830", "#e04a3a"]); p.item = pick(["flag", "fan"]); break;
    case "kid": p.kid = true; p.dress = chance(0.4); p.item = chance(0.3) ? "kite" : null; break;
    case "soldier": p.hat = "helmet"; p.dress = false; p.top = "#8a6a3a"; p.bottom = pick(["#3a3440", "#c0303a"]); p.sash = "#4a3020"; p.item = pick(["spear", "spear", "halberd", "flag"]); break;
    case "bearer": p.hat = "cap"; p.dress = false; p.top = p.bottom = "#c8342a"; break;
    default: p.hat = chance(0.3) ? "straw" : null; p.item = chance(0.3) ? pick(["basket", "fan"]) : null;
  }
  if (!p.dress && !p.kid && !p.beard && chance(0.12)) p.beard = true;
  return p;
}

/** Voxel list [[x,y,z,hex]] for a person look. */
export function personVoxels(p) {
  const v = [], S = (x, y, z, c) => v.push([x, y, z, c]);
  const box = (x0, y0, z0, x1, y1, z1, c) => { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) S(x, y, z, c); };
  const dk = (h, f = 0.78) => { const n = parseInt(h.slice(1), 16); return "#" + [16, 8, 0].map((s) => Math.round(((n >> s) & 255) * f).toString(16).padStart(2, "0")).join(""); };
  // legs / robe
  if (p.dress) { box(7, 0, 7, 9, 2, 8, p.bottom); box(6, 0, 7, 6, 0, 8, dk(p.bottom)); box(10, 0, 7, 10, 0, 8, dk(p.bottom)); box(7, 0, 9, 9, 0, 9, dk(p.bottom)); }
  else { box(7, 0, 7, 7, 0, 8, p.shoe); box(9, 0, 7, 9, 0, 8, p.shoe); box(7, 1, 7, 9, 2, 8, p.bottom); box(8, 1, 7, 8, 1, 8, dk(p.bottom)); }
  // torso, sash, arms with hands
  box(7, 3, 7, 9, 5, 8, p.top); box(7, 3, 7, 9, 3, 8, p.sash); S(8, 5, 9, dk(p.top, 0.7));
  for (const ax of [6, 10]) { box(ax, 4, 7, ax, 5, 8, p.top); box(ax, 3, 7, ax, 3, 8, p.skin); }
  // head with eyes; hair on top, back and sides
  box(6, 6, 6, 10, 8, 8, p.skin); S(7, 7, 8, M.ink); S(9, 7, 8, M.ink);
  if (p.arch === "monk") box(6, 9, 6, 10, 9, 8, p.skin);
  else { box(6, 9, 6, 10, 9, 8, p.hair); box(6, 6, 6, 10, 8, 6, p.hair); S(6, 8, 7, p.hair); S(10, 8, 7, p.hair); S(6, 8, 8, p.hair); S(10, 8, 8, p.hair); }
  if (p.beard) { box(7, 5, 9, 9, 6, 9, p.hair); }
  if (p.bun) { S(8, 10, 7, p.hair); S(8, 10, 6, p.hair); S(7, 10, 7, M.gold); }
  switch (p.hat) {
    case "straw": box(4, 10, 4, 12, 10, 10, M.straw); box(6, 11, 6, 10, 11, 8, M.straw); S(8, 12, 7, M.strawD); break;
    case "cap": box(6, 10, 6, 10, 10, 8, p.hatColor); S(8, 11, 7, "#e04a3a"); break;
    case "official": box(6, 10, 6, 10, 10, 8, "#2a2a30"); box(7, 11, 7, 9, 11, 8, "#2a2a30"); box(3, 10, 7, 5, 10, 7, "#2a2a30"); box(11, 10, 7, 13, 10, 7, "#2a2a30"); break;
    case "helmet": box(6, 10, 6, 10, 10, 8, "#a8a8b8"); box(7, 11, 6, 9, 11, 8, "#8a8a9a"); S(8, 12, 7, "#e04a3a"); S(8, 13, 7, "#e04a3a"); box(6, 9, 6, 10, 9, 6, "#a8a8b8"); break;
  }
  // held items (right hand is x=10, y=3)
  switch (p.item) {
    case "spear": box(11, 0, 8, 11, 13, 8, M.wood); box(11, 14, 8, 11, 15, 8, "#d8e8f0"); S(11, 13, 9, "#e04a3a"); break;
    case "halberd": box(11, 0, 8, 11, 14, 8, M.wood); box(12, 12, 8, 13, 14, 8, "#d8e8f0"); S(11, 15, 8, "#d8e8f0"); break;
    case "staff": box(11, 0, 8, 11, 12, 8, M.wood); S(11, 13, 8, M.gold); break;
    case "hoe": box(11, 0, 9, 11, 10, 9, M.wood); box(11, 10, 10, 11, 10, 11, "#8a8a96"); break;
    case "flag": box(11, 0, 8, 11, 14, 8, M.wood); box(12, 10, 8, 14, 14, 8, p.arch === "soldier" ? "#f0b830" : "#e04a3a"); break;
    case "parasol": box(11, 3, 8, 11, 12, 8, M.wood); for (let x = 5; x <= 13; x++) for (let z = 4; z <= 11; z++) { const d = Math.hypot(x - 9, z - 7.5); if (d <= 4.2) S(x, d < 2 ? 14 : 13, z, d > 3.4 ? dk(p.top, 0.85) : "#f0e8d0"); } break;
    case "basket": box(10, 2, 9, 12, 3, 10, M.straw); S(11, 4, 9, "#e04a3a"); S(10, 4, 10, M.veg); break;
    case "fan": box(11, 4, 9, 13, 6, 9, "#fff4d8"); S(11, 3, 9, M.woodD); break;
    case "kite": box(11, 3, 9, 11, 5, 9, "#8a8a96"); box(11, 12, 12, 13, 14, 12, "#e04a3a"); S(12, 15, 12, "#e04a3a"); S(12, 11, 12, "#e04a3a"); break;
    case "pole": box(11, 6, 1, 11, 6, 14, M.woodL); for (const z of [1, 14]) { box(10, 2, z - 1, 12, 4, z + 1, M.straw); box(11, 5, z, 11, 5, z, M.woodD); } break;
    case "rod": box(11, 3, 9, 11, 4, 9, M.wood); for (let k = 0; k < 7; k++) S(11, 5 + k, 10 + k, M.woodL); break;
  }
  return v;
}

// ---- animals (front +Z)
export function animalVoxels(kind, c) {
  const v = [], S = (x, y, z, col) => v.push([x, y, z, col]);
  const box = (x0, y0, z0, x1, y1, z1, col) => { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) S(x, y, z, col); };
  const dk = (h, f = 0.75) => { const n = parseInt(h.slice(1), 16); return "#" + [16, 8, 0].map((s) => Math.round(((n >> s) & 255) * f).toString(16).padStart(2, "0")).join(""); };
  switch (kind) {
    case "dog": box(7, 2, 5, 9, 4, 10, c); for (const [x, z] of [[7, 5], [9, 5], [7, 10], [9, 10]]) box(x, 0, z, x, 1, z, dk(c));
      box(7, 4, 10, 9, 6, 12, c); S(8, 4, 13, dk(c, 0.6)); S(8, 5, 13, M.ink); S(7, 6, 12, M.ink); S(9, 6, 12, M.ink); S(7, 7, 10, dk(c, 0.6)); S(9, 7, 10, dk(c, 0.6)); box(8, 4, 4, 8, 6, 4, c); break;
    case "cat": box(8, 2, 6, 9, 3, 10, c.color); for (const [x, z] of [[8, 6], [9, 6], [8, 10], [9, 10]]) box(x, 0, z, x, 1, z, dk(c.color));
      box(7, 3, 10, 10, 5, 12, c.color); S(7, 6, 11, c.color); S(10, 6, 11, c.color); S(8, 4, 13, "#f08ab0"); S(8, 5, 12, M.ink); S(10, 5, 12, M.ink);
      box(8, 3, 5, 8, 7, 5, c.stripe ?? c.color); if (c.stripe) { S(8, 4, 8, c.stripe); S(9, 4, 8, c.stripe); S(8, 4, 6, c.stripe); } break;
    case "pigeon": box(8, 1, 7, 9, 2, 9, c); box(8, 3, 9, 9, 3, 10, dk(c, 0.92)); S(8, 2, 10, "#5aa08a"); S(9, 2, 10, "#5aa08a"); S(8, 3, 11, "#f0c8a0"); S(8, 0, 8, "#e04a3a"); S(9, 0, 8, "#e04a3a"); box(8, 1, 6, 9, 1, 6, dk(c)); break;
    case "chicken": box(8, 1, 7, 9, 3, 9, c); box(8, 4, 9, 9, 5, 10, c); S(8, 6, 10, "#e04a3a"); S(9, 6, 10, "#e04a3a"); S(8, 4, 11, M.orange); S(8, 0, 8, M.orange); S(9, 0, 8, M.orange); box(8, 3, 6, 9, 4, 6, dk(c)); break;
    case "duck": box(7, 0, 6, 9, 1, 10, c.body); box(7, 2, 10, 9, 3, 11, c.head); S(8, 2, 12, "#f0a020"); S(7, 3, 11, M.ink); S(9, 3, 11, M.ink); box(8, 1, 5, 8, 2, 5, dk(c.body)); break;
    case "pig": box(6, 2, 5, 10, 5, 11, "#f0a8a8"); for (const [x, z] of [[6, 5], [10, 5], [6, 11], [10, 11]]) box(x, 0, z, x, 1, z, "#d08a8a"); box(7, 3, 12, 9, 4, 12, "#e08a9a"); S(7, 5, 11, M.ink); S(9, 5, 11, M.ink); S(6, 6, 10, "#f0a8a8"); S(10, 6, 10, "#f0a8a8"); break;
    case "crane": for (const x of [7, 9]) box(x, 0, 8, x, 5, 8, "#3a3440"); box(7, 6, 6, 9, 7, 10, "#fff4d8"); box(7, 7, 5, 9, 7, 6, "#3a3440"); box(8, 8, 10, 8, 12, 10, "#fff4d8"); box(8, 13, 10, 8, 13, 11, "#fff4d8"); S(8, 14, 10, "#e04a3a"); S(8, 13, 12, "#3a3440"); break;
  }
  return v;
}
export const DOG_COLORS = ["#8a5a32", "#d8b078", "#3a3440", "#fff4d8", "#a0603a", "#f0b830", "#c8a070"];
export const CAT_LOOKS = [{ color: "#f09030", stripe: "#c06010" }, { color: "#3a3440" }, { color: "#fff4d8" }, { color: "#8a8a96", stripe: "#5a5a66" }, { color: "#f0c080", stripe: "#c89050" }];
export const PIGEON_COLORS = ["#9aa0b0", "#b0b4c0", "#7a7e8e", "#d8d4cc"];
export const DUCK_LOOKS = [{ body: "#a07a50", head: "#2a8a5a" }, { body: "#fff4d8", head: "#fff4d8" }, { body: "#c8a070", head: "#a07a50" }];
