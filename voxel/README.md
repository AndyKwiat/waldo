# Jade River City — voxel edition

A 3D voxel take on the 2D city sim in `../index.html` (which is untouched). Buildings and props are
**Voxer models** built from code recipes; people and animals are small procedural voxel figures that hop
around running errands. Plain ES modules + three.js, no build step.

```sh
cd voxel
bun install                 # three.js
bun run dev                 # http://localhost:3010
bun run shot -- --views town,plaza --sheet    # headless screenshots → shots/
bun run models              # rebuild every model through Voxer → models/*.json + models/sheets/*.png
bun run statue              # rebuild the giant statue (a Voxer recipe file, built by ../../voxer's recipe CLI)
```

**Controls:** left-drag orbit · right-drag pan · scroll zoom · WASD move · click someone to follow them
(orbiting keeps following; right-drag, WASD or Esc stops).
**Views:** small buttons (incl. `gondola`, `lift`, `shrine`, `falls`, `mill`) in the bottom-left jump the camera to each named view (also `?view=` / `city.view(name)`).
**URL params:** `?view=town|overview|city|district|alley|plaza|statue|street|gate|walls|palace|yard|river|paddies|pagoda|country` · `&t=<sim seconds to
fast-forward>` · `&seed=N` · `&low` (cheap rendering) · `&noshadow` · `&noao` (no screen-space AO; also the **O** key / AO button) · `&nosky` (no baked sky occlusion) · `&nodark` (no distance darkening; **F** key / DEPTH FOG button) · `&night` (start at night; **N** key / NIGHT button).

## Layout

| Path | What |
|---|---|
| `index.html` | page, HUD styles, import map (three from `node_modules`) |
| `src/main.js` | renderer, lights, camera/controls, instancing of models and actors, picking/follow, `window.city` |
| `src/world.js` | world layout (street grid, blocks, plaza, fort, walls, river, paddies, fields, hamlets, roads, hills), static placements, ground texture, mountain + hill meshes, `groundH(x,z)` |
| `src/sim.js` | street graph + shortest routes, places with door approaches, citizens/vehicles/soldiers/pets/livestock/pigeons/boats/ducks, crowd steering + collisions |
| `src/people.js` | procedural voxel people (archetype looks) and animals |
| `src/night.js` | night mode: glow-face geometry, light sources from glowing voxels, light-map splatting, night sky |
| `src/skyao.js` | baked sky occlusion: model column tops → height map → horizon AO → bilinear sampler (pure JS) |
| `src/voxels.js` | Voxer scene decoding + face-culled greedy mesher (merges flat faces with equal color and AO) with per-vertex ambient occlusion |
| `models/recipes/*.js` | model recipes (Voxer draw ops); `colors.js` is shared with the browser for variant re-coloring |
| `models/recipes/statue.recipe.js` | the giant marble Jupiter in the market square — a **Voxer recipe file** (`build(ctx)`, slots, anchors), not part of the `index.js` registry; `bun run statue` builds it with Voxer's `bun run recipe` into `models/statue.json` + `models/sheets/statue.png` (and merges its `manifest.json` entry) |
| `models/*.json` | built models in Voxer's scene format; `models/sheets/*.png` Voxer's multi-view snapshots |
| `scripts/` | `serve.ts` static server · `shot.ts` headless screenshots · `build-models.ts` + `voxer.ts` Voxer driver |

## The mountain
The city is cut into a mountain (`world.js`): every east–west street line r sits at terrace level `LV[r]` (gate 10 → palace
334); inside a block the drop happens at the block's middle as a jagged rock cliff 75–90 high (`cliffZ`: a wandering,
ragged edge; houses keep to their half), and north–south streets climb it as long stairs. The mountain's flanks
(`flankRise`) rise up on both sides of the city, so it sits in a notch; city walls are only built where the flank
doesn't already wall it in. The river is 54 wide (bridges are three arches, water gates three side by side). `terrainH(x, z)` is the surface (also the plateau at `PLATEAU` = 196 above a
tiered 234-high cliff at `CLIFF_Z` (the great falls drop into a slot gorge), the pool on the shelf below it, slopes and pads outside the walls, the lowland); `groundH` adds
bridge decks. The river (`RIVER.x/halfW/y(z)`) falls off the plateau in the great waterfall, runs down the city in a stone
channel along column `RIVER_C` with a fall at every terrace, under `water_gate`s in the walls, and out across the
lowland; `water.js` meshes it (flat stretches with scrolling glints, fall sheets with streaks, foam/mist point clouds).
`terrainGeometry()` meshes the ground as greedy voxel columns (painted texture on tops, brick on retaining walls).
**Transport** (`TRANSPORTS` in `world.js`, drawn by `transport.js`, ridden in `sim.js`):
- **Gondola:** the riverside station on the plaza terrace up over a timber pylon, the north wall and the falls to the
  mountain shrine on the plateau. Two cars shuttle on one rope; two oxen walk round the capstan while they move.
- **Mountain gondola:** a second line on the west side, from the lowland just outside the south wall (through a gap in
  it) over five pylons, with a stop on the plaza terrace, up to the plateau; a bridge carries the plateau path over the
  river to the shrine. Lines can have any number of stops (`stops`, `carState` with per-stop dwells).
- **Cargo lifts:** one per cliff band on the east side (`LIFT_SPOTS`), a stack of `cargo_lift_section`s up the rock (scaled to the drop)
  with a `cargo_lift_head` gantry on the clifftop and a 32×32 `cargo_lift_cage`. Carts can't climb stairs: their graph
  is level streets + lifts only (a cart counts 4 of a cage's 10 places). Stairs: the main avenue's grand stair (double
  width, top to bottom) plus one more per band; the other stair streets became garden strips.
- **Riding:** both ends are graph nodes joined by a "ride" edge, so routes take them when that's quicker (or to reach
  the shrine). Riders wait on the platform for a docked car with room, ride along (`absY`), and step off at the far end.
  `carState/carPos` give car positions to both the sim and the renderer.
- **Airships:** two cargo ships fly a tour of the five `MASTS` (climb, cruise, descend, hover at the platform); three small
  balloons drift in slow loops.

## Lighting
Warm key sun with soft shadows, a cool blue fill light from the opposite side and a dim hemisphere ambient (shadow
sides read cool, lit sides warm), ACES tone mapping. Ambient occlusion at two scales: per-vertex voxel AO baked into
every mesh (`voxels.js`) and screen-space **GTAO** (`EffectComposer`: RenderPass → GTAOPass → OutputPass, 4× MSAA
target) for contact shadows between people, buildings and the ground. GTAO re-renders the scene for normals (~+60%
triangles); the sun's shadow map is drawn once per frame. `city.ao(false)` / `?noao` / **O** turns it off.
Large-scale **sky occlusion** is baked at load (`src/skyao.js`, ~0.3 s): a height map of every placed model's
column tops, then horizon-based "how much sky is visible" per 2-unit cell over the city. It multiplies a cool
shadow tint into the ground texture, grass tufts and bushes, and tints people/animals by where they stand (less when
up on walls or roofs), so alleys, courtyards and the foot of the walls read darker. `?nosky` disables it.
**Distance darkening ("depth fog"):** every fogged material's shader gets a shared-uniform dimming (up to ~45%, cool
blue) that ramps from the orbit-target distance (×0.9) to twice it — what you look at stays bright, whatever is
beyond recedes, at any zoom — before the sky-coloured haze (1400–3800); the sky itself stays bright.
**Night mode** (`src/night.js`, graphics only — the sim is unchanged): eases over ~2 s. Moon replaces the sun (cool,
dim, soft shadows), hemisphere/fill drop, a gradient sky dome with stars and a moon follows the camera, fog goes navy.
Lantern bodies (`M.lantern`) and paper windows (`M.paper`) glow: an additive overlay of just their exposed faces per
model, plus bloom. Light pools come from one baked top-down **light map** (2 units/px over the whole world): every glowing
voxel cluster in every lit building (each building has a fixed chance of being lit: ~45% of houses, half the lantern
posts, 80% of other buildings), wall-top torches and four braziers around the statue are splatted as radial
gradients — R channel for street-level lights (fades above ~y 20), G for high lights (a band around y 26). Every Lambert
material adds `diffuse × warm × lightmap × height falloff × uNight` in its shader, so ground, walls, people and animals are
all lit by thousands of lamps with a single texture lookup. Add a light: give a model `M.lantern` / `M.paper` voxels, or
push into `lights` in `buildNight()`.
Lattice windows glow as a soft warm grid (the wooden lattice glows dimly too: a bright/black single-voxel checkerboard
shimmers at a distance), and glow faces sit 0.02 in front of the surface rather than using polygon offset. A sun (day)
and full moon (night) sit at the light's compass direction, lower in the sky than the light itself so street-level views
see them (`celestial()` in `night.js`).
**Toggles:** buttons bottom-right (**NIGHT**, **AO**, **DEPTH FOG**), keys **N** / **O** / **F**, `city.fx({night, ao, dark})`; `?noao` / `?nodark` start them off.

## Conventions
- **World:** 1 unit = 1 voxel. x east, z south, y up. An 8×8 grid of blocks with irregular column widths / row
  depths (`COLW`, `ROWH`), streets 22 wide. Every street segment has a type in `HSEG[r][c]` / `VSEG[c][r]`:
  `street`, `alley` (narrow winding path, pedestrians only — `alleyZ(r,c,x)` is its centre line), `garden` (closed
  side street → T-junction, often with a teahouse), or `none`. The palace (blocks 3–4 × rows 0–1), the market square,
  the north–south avenue (`AV_C`), the city ring and a few cross avenues are always plain streets. `EDGE_LIST` is the
  walkable network the sim builds its routes from; `cellAt(x,z)` classifies any point. City walls are 24 tall just
  outside the outer street (`WALL` holds the walkway lines sentries patrol). Everything outside `CITY_R` is
  countryside; `occupied(x,z)` says where hills/forest can't go and `groundH(x,z)` is the hill height (0 in the city).
- **Buildings:** `home1`, `home2`, `shop`, `inn`, `manor` (walled courtyard compound), and the bigger `hall_house`
  (two-storey guild hall) and `compound` (warehouse courtyard) fill block rows. Rows are even around the plaza, palace and
  avenue and loosen with distance from the centre (`organicAt`): a random mix of widths, uneven spacing (so houses across a
  street are offset), per-house setbacks that make street fronts jagged, and garden gaps with trees. Houses always stay
  square to the street. About one slot in ten (more in the outer districts) is a `garden_flower` or `garden_pond`
  instead (no door). Landmark trees `tree_camphor` and `tree_ginkgo` (46–48 tall, above every house) stand in about a quarter
  of the back-yard strips (≥ 80 apart) and near most hamlets (`GARDENS` / `GIANT_TREES`). Footprints live in `FOOT` / `BIG_FOOT` in `world.js`; `teahouse`
  (three storeys, 20 wide) stands in garden strips. All share the house door convention (door at local x=0, front
  edge ≈ +12, teahouse +10). The palace (blocks 3–4 × rows 0–2) is the 191-tall `palace_great_hall` on three marble terraces (`HALL` in
  `world.js`), `palace_wall`s, the `fort_gate` gatehouse, side halls, gilded `lion_statue` pairs (hall stair, inside and
  outside the gate), jade `dragon_statue` columns along the approach and bronze `incense_burner`s, all roofs re-coloured to
  imperial gold. Optional models are skipped when missing from `models/manifest.json` (`setAvailableModels`).
- **Statue:** a colossal marble Jupiter (thunderbolt raised, eagle at his foot) stands on a stepped pedestal in the middle of
  the market square, facing south down the avenue (`STATUE` in `world.js`: 104³ grid, ~95 tall, pedestal footprint
  47×41). It replaced the old plaza pavilion. The pedestal is a 3×3 grid of obstacle circles, `onStatue(x,z,m)` marks the
  footprint (`occupied()` includes it; cats and pigeons avoid it, pigeons never fly through it). View: `statue`.
- **Crowds:** each walker looks ~7 units ahead (`steer` in `sim.js`): it eases behind someone walking its way (and drifts
  past if they're slower), veers right around oncoming or standing people, and briefly waits only when right on
  someone's heels. Collision circles (2.4 for adults) are the hard backstop. Routes are built on centre lines and shifted
  into a per-walker **keep-right lane** (`keepRight` in `sim.js`; narrow in alleys and doorways, sub-lanes through the
  gates), so opposite flows don't meet head-on. **Congestion-aware routing:** every second the sim counts slowed walkers on each street segment and junction (smoothed);
  each new route is a Dijkstra over the street graph where a segment costs its length + 26 per slowed walker on it and on
  the junctions it passes (±7% noise so a crowd doesn't all take the same detour). Jammed destinations are avoided too:
  a busy errand street makes people likelier to pick another errand, and market shoppers enter from whichever of the
  plaza's four streets is nearest their stall. Single doors that many people use (city gate, palace gatehouse, pagoda)
  are kept clear by longer stays inside and spread-out start times — check them with the jam metric (slow walkers with
  ≥5 others within 6) rather than average speed alone. Health check numbers worth keeping:
  close pairs (<3.2 apart) in the single digits, average walking speed ≳ 50%, no NaN positions.
- **Models:** Voxer conventions — front faces **+Z**; placed by **grid center in x/z, y = 0 at the grid floor**
  (`meshVoxels` pivot "base"). Rotation is in quarter turns (`rot` 1 = front faces +x). Vehicles and boats
  face **+X**. Houses (40³ grid): door centered at x=20, front wall z=27, platform edge z=31 → door is
  ~+12 in local z, which `world.js` uses for `outZ`/`inZ`.
- **Variants:** recipes paint with canonical `ROOF`/`WALL`/`PILLAR`/`CLOTH` ramps; `rampRemap` swaps a
  whole ramp for another base color at mesh time, so one model yields many looks.
- **Walk animation:** people, dogs, cats, cows and the ox-cart oxen (`MODEL_PARTS` in `main.js`; vehicles face +x, so their legs swing about z) keep their hop, and their limbs swing with it. `meshVoxels(…, {parts})`
  tags each voxel's limb (`personParts` / `animalParts` in `people.js`: legs hinge at the hip, arms at the shoulder,
  diagonal trot for four legs) into an `aPart` vertex attribute and keeps faces between limbs; `walkMat`'s vertex shader
  rotates limbs by `sin(phase) × amp` from a per-instance `aWalk` (phase = the hop phase, so legs pass on landing; amp
  eases in/out with walking speed). No extra draw calls. Robes and hands holding items stay still.
- **Actors** are instanced per look (people come from a ≤10-variant library per archetype), so adding
  people is cheap; adding *looks* adds draw calls.

## Agent tooling
- **See your change:** `bun run shot -- --views <names> [--t secs] [--sheet] [--cam x,y,z:tx,ty,tz] [--eval js] [--hq]`.
  Writes PNGs to `shots/`, prints page errors and `city.stats()` (actors, draw calls, triangles). Read the PNGs.
  Default is `?low` (SwiftShader); `--hq` turns antialiasing/shadow resolution back up.
- **In-page API** (`window.city`, also usable from the browser console):
  `ready`, `error`, `view(name)`, `cam([x,y,z],[tx,ty,tz])`, `advance(secs)` (runs the sim without waiting
  for frames, then renders), `ao(on?)` (screen-space AO), `follow(entity|index)`, `pickAt(px,py)`, `screenOf(entity)`, `stats()`,
  `sim` (`ents`, `pigeons`, `boats`, `ducks`, `step`, `stats`), `camera`, `controls`, `scene`.
  Example health check: advance 60 s and count `hidden` transitions (people entering buildings) and
  `e.stuck > 1` walkers.
- **Models:** edit a recipe → `bun run models -- <name>` → look at `models/sheets/<name>.png` → reload.
  The driver runs Voxer headlessly with an **in-memory** store on a private port, so it never touches
  `voxer/models/` (your autosave is safe). For hands-on sculpting use the Voxer app / `voxer` MCP server
  (registered in `../.mcp.json`), save the scene, and copy the JSON into `models/`.

## Known quirks
- SwiftShader sometimes times out rendering Voxer snapshots of some models (`waterwheel`); the build
  keeps the JSON and retries a smaller sheet, else skips it.
- Picking uses `InstancedMesh` bounding spheres, which go stale as actors move — `pickAt` recomputes them.
