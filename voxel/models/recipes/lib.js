// Tiny voxel sketchpad for recipes. Recipes paint into a G (sparse grid), then G.toOps() turns it into
// Voxer draw ops ({op:"clear"}, {op:"set", voxels}) that the build script runs inside the Voxer editor.
// Conventions match Voxer: integer cells, Y up, model front faces +Z.
import { M } from "./colors.js";

export class G {
  constructor(size) { this.size = size; this.v = new Map(); }
  key(x, y, z) { return (y * this.size + z) * this.size + x; }
  inb(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.size && y < this.size && z < this.size; }
  set(x, y, z, c) { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (!this.inb(x, y, z)) return; if (c == null) this.v.delete(this.key(x, y, z)); else this.v.set(this.key(x, y, z), c); }
  get(x, y, z) { return this.v.get(this.key(Math.round(x), Math.round(y), Math.round(z))); }
  box(x0, y0, z0, x1, y1, z1, c) { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(x, y, z, typeof c === "function" ? c(x, y, z) : c); }
  /** Only the outer shell of a box (walls of a room). */
  shell(x0, y0, z0, x1, y1, z1, c) { this.box(x0, y0, z0, x1, y1, z1, (x, y, z) => (x === x0 || x === x1 || z === z0 || z === z1 ? (typeof c === "function" ? c(x, y, z) : c) : undefined)); }
  disc(cx, y, cz, r, c, axis = "y") { const R = Math.ceil(r); for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) if (a * a + b * b <= r * r + 0.3) {
    if (axis === "y") this.set(cx + a, y, cz + b, typeof c === "function" ? c(cx + a, y, cz + b) : c);
    else if (axis === "z") this.set(cx + a, y + b, cz, typeof c === "function" ? c(cx + a, y + b, cz) : c);
    else this.set(cx, y + a, cz + b, typeof c === "function" ? c(cx, y + a, cz + b) : c); } }
  ball(cx, cy, cz, rx, ry, rz, c) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let z = Math.floor(cz - rz); z <= cz + rz; z++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2; if (d <= 1) this.set(x, y, z, typeof c === "function" ? c(x, y, z, d) : c); } }
  line(x0, y0, z0, x1, y1, z1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1); for (let i = 0; i <= n; i++) this.set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, z0 + (z1 - z0) * i / n, c); }
  toOps() {
    const S = this.size, voxels = [];
    for (const [k, c] of this.v) voxels.push([k % S, Math.floor(k / (S * S)), Math.floor(k / S) % S, c]);
    return [{ op: "clear" }, { op: "set", voxels }];
  }
}

/** Deterministic RNG so rebuilding a recipe gives the same model. */
export function rng(seed = 1) { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** A small standing figure (4 wide incl. arms, 8 tall) facing +x — used as pullers, drivers, boatmen inside vehicle models. */
export function figure(g, x, y, z, o = {}) {
  const top = o.top ?? "#8a8a96", bottom = o.bottom ?? "#3a6ad8", skin = o.skin ?? M.skin, hair = o.hair ?? "#2a2030";
  g.box(x, y, z, x + 1, y + 2, z, bottom); g.box(x, y, z + 2, x + 1, y + 2, z + 2, bottom); // legs
  g.box(x, y + 3, z, x + 1, y + 5, z + 2, top); g.set(x + 2, y + 4, z, top); g.set(x + 2, y + 4, z + 2, top); // torso + arms forward
  g.box(x, y + 6, z, x + 1, y + 7, z + 2, skin); g.box(x, y + 7, z, x, y + 7, z + 2, hair); g.set(x + 1, y + 7, z + 1, hair);
  g.set(x + 1, y + 6, z, M.ink); g.set(x + 1, y + 6, z + 2, M.ink);
  if (o.hat === "straw") { g.box(x - 1, y + 8, z - 1, x + 2, y + 8, z + 3, M.straw); g.box(x, y + 9, z, x + 1, y + 9, z + 2, M.strawD); }
  if (o.hat === "cap") g.box(x, y + 8, z, x + 1, y + 8, z + 2, o.hatColor ?? M.ink);
}

/** Seated upper body facing +x (passengers, drivers). */
export function seated(g, x, y, z, o = {}) {
  const top = o.top ?? "#d04a6a", skin = o.skin ?? M.skin, hair = o.hair ?? "#2a2030";
  g.box(x, y, z, x + 1, y + 2, z + 2, top); g.box(x, y + 3, z, x + 1, y + 4, z + 2, skin); g.box(x, y + 4, z, x, y + 4, z + 2, hair); g.set(x + 1, y + 4, z + 1, hair);
  g.set(x + 1, y + 3, z, M.ink); g.set(x + 1, y + 3, z + 2, M.ink);
  if (o.hat === "straw") { g.box(x - 1, y + 5, z - 1, x + 2, y + 5, z + 3, M.straw); g.box(x, y + 6, z, x + 1, y + 6, z + 2, M.strawD); }
}

/** Spoked wheel in the x-y plane at depth z. */
export function wheel(g, cx, cy, z, r, c = M.woodD, spoke = M.woodL) {
  for (let a = 0; a < 64; a++) { const t = (a / 64) * Math.PI * 2; g.set(cx + Math.cos(t) * r, cy + Math.sin(t) * r, z, c); }
  for (let k = 0; k < 4; k++) { const t = (k / 4) * Math.PI; g.line(cx - Math.cos(t) * (r - 1), cy - Math.sin(t) * (r - 1), z, cx + Math.cos(t) * (r - 1), cy + Math.sin(t) * (r - 1), z, spoke); }
  g.set(cx, cy, z, M.gold);
}
