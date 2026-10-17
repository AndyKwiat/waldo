Read `README.md` (≈2 min): layout, coordinate conventions, and the agent tooling.

Working loop for any visible change: edit → `bun run shot -- --views <relevant views> --sheet` → Read the PNGs
(and the printed page errors / stats) → iterate. For model changes: `bun run models -- <name>` and Read
`models/sheets/<name>.png` first. Never write into `../../voxer/models/` from scripts.
