Read `README.md` (≈2 min): layout, how models/terrain/lighting are drawn, and the agent tooling.

Working loop for any visible change: edit → `bun run shot -- --views <relevant views> --sheet` (add `--eval "city.time(22)"`
for night) → Read the PNGs (and the printed errors / stats) → iterate. For model changes, `city.gallery("<model>,…")` puts
them on a plinth. Keep `world.js` / `sim.js` in step with `../voxel` (layout and simulation are shared logic); keep models
at the voxel footprints and attachment points.
