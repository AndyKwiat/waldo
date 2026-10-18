// Registry of every model recipe: name → () => G (a sketch the build script replays inside Voxer).
// Add a model: write a function returning a G, register it here, run `bun run models <name>`, look at
// models/sheets/<name>.png, then reference it from src/world.js.
import { house, pagoda, cityGate, fortGate, wallSegment, watchtower, stall, pavilion, teahouse, manor, palaceHall, palaceWall, hallHouse, compound } from "./buildings.js";
import { tree, lanternPost, well, haystack, jars, crateStack, target, rickshaw, oxcart, sedan, barrow, boat, waterwheel } from "./props.js";

export const RECIPES = {
  home1: () => house("home1"), home2: () => house("home2"), shop: () => house("shop"), inn: () => house("inn"),
  teahouse, manor, hall_house: hallHouse, compound, palace_hall: palaceHall, palace_wall: palaceWall,
  pagoda, city_gate: cityGate, fort_gate: fortGate, wall: wallSegment, tower: watchtower, stall, pavilion,
  tree_round: () => tree("round"), tree_fruit: () => tree("fruit"), tree_blossom: () => tree("blossom"), tree_pine: () => tree("pine"), bamboo: () => tree("bamboo"),
  lantern_post: lanternPost, well, haystack, jars, crates: crateStack, target,
  rickshaw, oxcart, sedan, barrow, boat, waterwheel,
};
