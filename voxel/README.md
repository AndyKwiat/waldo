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
```

**Controls:** left-drag orbit · right-drag pan · scroll zoom · WASD move · click someone to follow them
(orbiting keeps following; right-drag, WASD or Esc stops).
**URL params:** `?view=town|overview|city|plaza|street|gate|walls|fort|river|paddies|pagoda|country` · `&t=<sim seconds to
fast-forward>` · `&seed=N` · `&low` (cheap rendering) · `&noshadow`.

## Layout

| Path | What |
|---|---|
| `index.html` | page, HUD styles, import map (three from `node_modules`) |
| `src/main.js` | renderer, lights, camera/controls, instancing of models and actors, picking/follow, `window.city` |
| `src/world.js` | world layout (street grid, blocks, plaza, fort, walls, river, paddies, fields, hamlets, roads, hills), static placements, ground texture, mountain + hill meshes, `groundH(x,z)` |
| `src/sim.js` | street graph + shortest routes, places with door approaches, citizens/vehicles/soldiers/pets/livestock/pigeons/boats/ducks, crowd steering + collisions |
| `src/people.js` | procedural voxel people (archetype looks) and animals |
| `src/voxels.js` | Voxer scene decoding + face-culled mesher with per-vertex ambient occlusion |
| `models/recipes/*.js` | model recipes (Voxer draw ops); `colors.js` is shared with the browser for variant re-coloring |
| `models/*.json` | built models in Voxer's scene format; `models/sheets/*.png` Voxer's multi-view snapshots |
| `scripts/` | `serve.ts` static server · `shot.ts` headless screenshots · `build-models.ts` + `voxer.ts` Voxer driver |

## Conventions
- **World:** 1 unit = 1 voxel. x east, z south, y up. 6×5 blocks of 106×76 (three houses per row), streets 22 wide,
  city walls 24 tall just outside the outer street (`WALL` holds the walkway lines sentries patrol). Everything outside
  `CITY_R` is countryside; `occupied(x,z)` says where hills/forest can't go and `groundH(x,z)` is the hill height
  (0 in the city) — anything standing in the countryside should add it.
- **Crowds:** each walker looks ~7 units ahead (`steer` in `sim.js`): it eases behind someone walking its way (and drifts
  past if they're slower), veers right around oncoming or standing people, and briefly waits only when right on
  someone's heels. Collision circles (2.4 for adults) are the hard backstop. Health check numbers worth keeping:
  close pairs (<3.2 apart) in the single digits, average walking speed ≳ 50%, no NaN positions.
- **Models:** Voxer conventions — front faces **+Z**; placed by **grid center in x/z, y = 0 at the grid floor**
  (`meshVoxels` pivot "base"). Rotation is in quarter turns (`rot` 1 = front faces +x). Vehicles and boats
  face **+X**. Houses (40³ grid): door centered at x=20, front wall z=27, platform edge z=31 → door is
  ~+12 in local z, which `world.js` uses for `outZ`/`inZ`.
- **Variants:** recipes paint with canonical `ROOF`/`WALL`/`PILLAR`/`CLOTH` ramps; `rampRemap` swaps a
  whole ramp for another base color at mesh time, so one model yields many looks.
- **Actors** are instanced per look (people come from a ≤10-variant library per archetype), so adding
  people is cheap; adding *looks* adds draw calls.

## Agent tooling
- **See your change:** `bun run shot -- --views <names> [--t secs] [--sheet] [--cam x,y,z:tx,ty,tz] [--eval js] [--hq]`.
  Writes PNGs to `shots/`, prints page errors and `city.stats()` (actors, draw calls, triangles). Read the PNGs.
  Default is `?low` (SwiftShader); `--hq` turns antialiasing/shadow resolution back up.
- **In-page API** (`window.city`, also usable from the browser console):
  `ready`, `error`, `view(name)`, `cam([x,y,z],[tx,ty,tz])`, `advance(secs)` (runs the sim without waiting
  for frames, then renders), `follow(entity|index)`, `pickAt(px,py)`, `screenOf(entity)`, `stats()`,
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
