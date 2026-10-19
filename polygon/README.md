# Jade River City — low-poly edition

The voxel city (`../voxel`) rebuilt with ordinary flat-shaded polygons: the same mountain city, layout and simulation
(people, carts, sedan chairs, oxen, dogs, cats, pigeons, cranes, ducks, boats, gondolas, cargo lifts, airships), but every
building, prop, figure and the terrain are low-poly meshes coloured almost entirely by vertex colour. One painted
texture remains (the ground: street paving, plaza, fields, paddies). Plain ES modules + three.js, no build step.

```sh
cd polygon
bun install                 # three.js (node_modules was copied from ../voxel)
bun run dev                 # http://localhost:3011
bun run shot -- --views town,plaza --sheet        # headless screenshots → shots/
bun run shot -- --views town --eval "city.time(22)" --out shots/night   # at night
```

**Controls:** left-drag orbit · right-drag pan · scroll zoom · WASD move · click someone to follow them (Esc stops) ·
**N** night on/off · **T** day cycle (a day every 8 minutes) · **[ ]** time −/+ 30 min · **O** ambient occlusion · **F** depth fog.
**Views:** buttons bottom-left (same names as the voxel city). **URL params:** `?view=…` · `&t=<sim seconds>` · `&seed=N` ·
`&low` · `&noshadow` · `&noao` · `&nosky` · `&nodark` · `&night` (22:00) · `&tod=18.5` (any hour) · `&cycle`.

## Layout

| Path | What |
|---|---|
| `index.html` | page, HUD (rounded glass panels, clock), import map |
| `src/main.js` | renderer, post-processing, materials (colour slots, walk animation, night light map, depth fog), instancing of statics and actors, time of day, picking/follow, `window.city` |
| `src/world.js` | the layout — copied from the voxel city (street grid, terraces, river, palace, transport lines, `terrainH`/`groundH`, `layout()`); voxel meshers removed, voxel-scale terrain noise smoothed, colour variants are slot colours |
| `src/sim.js` | the simulation, unchanged from the voxel city |
| `src/people.js` | archetype looks (`genPerson`) and animal colours |
| `src/geo.js` | the low-poly `Builder`: boxes, prisms/frustums, cones, faceted blobs, curved hip roofs, beams; slot colours, glow tagging, light sources, limb tags; `columnTops` for the sky-occlusion bake |
| `src/models.js` | every static model as a function of a Builder (houses, manor, hall house, compound, teahouse, gardens, pagoda, gates, walls, towers, palace + great hall, lions, dragon columns, incense burners, the statue, trees, props, vehicles, bridges, gondola stations/car, bullwheel, capstan, cargo lift, airships, mooring mast) |
| `src/figures.js` | people and animals (a few prisms and blobs each, limbs tagged for the walk shader) |
| `src/terrain.js` | terrain mesh (stitched multi-resolution heightfield in 256–2048-unit tiles), its material (painted texture / rock strata / masonry / plain per face), the ground texture, stone stairs, boulders |
| `src/water.js` | river, pool, falls (faceted heaving water, glints, waterfall shader, foam) |
| `src/transport.js` | gondola ropes/pylons/cars/oxen, cargo lifts, airships (positions from `world.js`, shared with the sim) |
| `src/sky.js` | time-of-day palette keyframes, sun/moon direction, sky dome (gradient + sun glow), stars, moon, low-poly clouds |
| `src/night.js` | the top-down light map of every lamp |
| `src/skyao.js` | baked sky occlusion (unchanged) |
| `src/perches.js` | the statue's proportions and the pigeons' perches on it |

## How it's drawn
- **Models** are non-indexed triangle lists (each face its own colour and normal — the faceted look). Placed like the
  voxel models: centre of the footprint in x/z, y = 0 at the floor, front +z (vehicles +x). Footprints, door positions
  and attachment points (gondola cable exits, bullwheel, lift ropes, mast platforms, bridge decks at y 10) match the voxel
  models, so `world.js` and `sim.js` work unchanged.
- **Colour variants:** geometry painted with `ROOF(k)` / `WALLC(k)` / `PIL(k)` / `CLOTHC(k)` stores a slot + shade; every
  instance carries its own four slot colours (`iRoof`… instanced attributes, set by `inst()` in `main.js` from the
  layout's `remap`), so one InstancedMesh per model draws all its colour variants. Vehicles get random cloth/roof colours.
- **Walk animation:** `Builder.part = [k, pivotY, pivotZ]` tags limbs (k ±1 legs, ±2 arms, ±3 vehicle legs about z);
  `walkMat` swings them by `sin(phase) × amp` from the per-instance `aWalk`. Plus a gentle bob.
- **Terrain:** `renderH` = the world's `terrainH0`, except stair streets (sunk under their stone steps), the zig-zag
  stair (cut into the slope) and the city's terrace cliffs (resampled on a 6-unit lattice along x for chunky facets).
  Regions: 2-unit cells over the city, 4 over the world rect, 8 and 32 further out, outer boundary vertices pulled onto
  the coarser grid (no cracks), flat 8×8-cell chunks merged. Per face: gentle → painted texture (world rect) or plain
  colour (grass / forest / rock / snow), steep → rock with shader strata (wavy bands, seams), river banks → coursed masonry.
- **Lighting / time of day** (`sky.js`): keyframes from midnight through dawn, noon, sunset and dusk drive the key light
  (sun by day, moon by night: colour, intensity, direction), hemisphere, fill, fog, exposure and the sky dome. `nightness`
  (0 → 1 from 18:30 to 20:15, back by 6:45) drives window/lantern glows (additive copies of the tagged faces, ~half the
  houses lit), the light map (lanterns, windows, wall torches, braziers), stars, moon and bloom.
- **Post:** RenderPass → GTAO → bloom (night) → OutputPass (ACES). Depth fog: everything dims and cools beyond the orbit target.

## Agent tooling
Same as the voxel city: `bun run shot -- --views <names> [--t secs] [--sheet] [--cam x,y,z:tx,ty,tz] [--eval js] [--out dir] [--hq]`
writes PNGs and prints `city.stats()` (draw calls, triangles — all passes). In-page API (`window.city`): `ready`, `error`,
`view(name)`, `cam(p, t)`, `advance(secs)`, `time(hours?)`, `fx({night, cycle, ao, dark})`, `ao()`, `follow()`, `pickAt()`,
`screenOf()`, `stats()`, `sim`, `scene`, `gallery()` (lines up every vehicle, animal and archetype on a plinth for inspection;
`gallery("home1,pagoda")` does models). Model triangle counts: `node` can import `src/models.js` directly (`modelGeometry(name).userData.tris`).
