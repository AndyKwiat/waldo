// Registry of every model recipe: name → () => G (a sketch the build script replays inside Voxer).
// Add a model: write a function returning a G, register it here, run `bun run models <name>`, look at
// models/sheets/<name>.png, then reference it from src/world.js.
import { house, pagoda, cityGate, fortGate, wallSegment, watchtower, stall, pavilion, teahouse, manor, palaceHall, palaceWall, hallHouse, compound } from "./buildings.js";
import { treeCamphor, treeGinkgo, gardenFlower, gardenPond } from "./landmarks.js";
import { palaceGreatHall, lionStatue, dragonStatue, incenseBurner } from "./palace.js";
import { bridgeStone, waterGate, pulleyWheel, capstan, gondolaStationLow, gondolaStationHigh, gondolaCar, elevatorTower, elevatorCage, airshipCargo, airshipSmall, mooringMast } from "./tech.js";
import { tree, lanternPost, well, haystack, jars, crateStack, target, rickshaw, oxcart, sedan, barrow, boat, waterwheel } from "./props.js";

export const RECIPES = {
  home1: () => house("home1"), home2: () => house("home2"), shop: () => house("shop"), inn: () => house("inn"),
  teahouse, manor, hall_house: hallHouse, compound, palace_hall: palaceHall, palace_wall: palaceWall,
  pagoda, city_gate: cityGate, fort_gate: fortGate, wall: wallSegment, tower: watchtower, stall, pavilion,
  tree_round: () => tree("round"), tree_fruit: () => tree("fruit"), tree_blossom: () => tree("blossom"), tree_pine: () => tree("pine"), bamboo: () => tree("bamboo"),
  tree_camphor: treeCamphor, tree_ginkgo: treeGinkgo, garden_flower: gardenFlower, garden_pond: gardenPond,
  lantern_post: lanternPost, well, haystack, jars, crates: crateStack, target,
  rickshaw, oxcart, sedan, barrow, boat, waterwheel,
  palace_great_hall: palaceGreatHall, lion_statue: lionStatue, dragon_statue: dragonStatue, incense_burner: incenseBurner,
  bridge_stone: bridgeStone, water_gate: waterGate, pulley_wheel: pulleyWheel, capstan,
  gondola_station_low: gondolaStationLow, gondola_station_high: gondolaStationHigh, gondola_car: gondolaCar,
  elevator_tower: elevatorTower, elevator_cage: elevatorCage, airship_cargo: airshipCargo, airship_small: airshipSmall, mooring_mast: mooringMast,
};
