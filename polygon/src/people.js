// Character looks: archetypes, titles and randomized outfits (the sim picks them; figures.js turns them into meshes).
const M = { gold: "#f0c040" };

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

export const DOG_COLORS = ["#8a5a32", "#d8b078", "#3a3440", "#fff4d8", "#a0603a", "#f0b830", "#c8a070"];
export const CAT_LOOKS = [{ color: "#f09030", stripe: "#c06010" }, { color: "#3a3440" }, { color: "#fff4d8" }, { color: "#8a8a96", stripe: "#5a5a66" }, { color: "#f0c080", stripe: "#c89050" }];
export const PIGEON_COLORS = ["#9aa0b0", "#b0b4c0", "#7a7e8e", "#d8d4cc"];
export const DUCK_LOOKS = [{ body: "#a07a50", head: "#2a8a5a" }, { body: "#fff4d8", head: "#fff4d8" }, { body: "#c8a070", head: "#a07a50" }];
