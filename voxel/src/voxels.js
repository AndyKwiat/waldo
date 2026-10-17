// Voxel scenes → three.js geometry.
//  - decodeScene: Voxer's saved-scene format (RLE + base64, cells in (y*S+z)*S+x order, 0 = empty, n = palette[n-1])
//  - meshVoxels: face-culled quads with per-vertex ambient occlusion baked into vertex colors
// Pivot: models are placed by their grid center in x/z and y = 0 at the grid floor, so every recipe's
// coordinates map predictably into the world (see models/recipes/*.js for where doors etc. are).
import * as THREE from "three";

export function decodeScene(scene) {
  const S = scene.size, n = S * S * S, bin = atob(scene.data), src = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) src[i] = bin.charCodeAt(i);
  const cells = new Uint8Array(n); let o = 0;
  for (let i = 0; i < src.length;) {
    const v = src[i++]; let run = 0, shift = 0;
    for (;;) { const b = src[i++]; run |= (b & 0x7f) << shift; if (b < 0x80) break; shift += 7; }
    cells.fill(v, o, o + run); o += run;
  }
  return { size: S, palette: scene.palette, cells };
}

/** Builds a dense grid from a sparse list of [x, y, z, "#hex"] (procedural characters, animals). */
export function gridFromVoxels(list, S) {
  const palette = [], idx = new Map(), cells = new Uint8Array(S * S * S);
  for (const [x, y, z, c] of list) {
    if (x < 0 || y < 0 || z < 0 || x >= S || y >= S || z >= S) continue;
    let k = idx.get(c); if (k === undefined) { palette.push(c); k = palette.length; idx.set(c, k); }
    cells[(y * S + z) * S + x] = k;
  }
  return { size: S, palette, cells };
}

const AO = [0.5, 0.68, 0.84, 1];
// For each face: normal axis d, sign s, and the two in-plane axes u, v (ordered so u × v = normal).
const FACES = [
  { d: 0, s: 1, u: 2, v: 1, flip: true }, { d: 0, s: -1, u: 2, v: 1, flip: false },
  { d: 1, s: 1, u: 0, v: 2, flip: true }, { d: 1, s: -1, u: 0, v: 2, flip: false },
  { d: 2, s: 1, u: 0, v: 1, flip: false }, { d: 2, s: -1, u: 0, v: 1, flip: true },
];

/**
 * @param grid {size, palette, cells}
 * @param opts.remap  hex→hex color substitutions (model variants)
 * @param opts.pivot  "base" (default: grid center x/z, y=0) or "center" (grid center in all axes, for spinning parts)
 * @param opts.scale  world units per voxel (default 1)
 */
export function meshVoxels(grid, opts = {}) {
  const S = grid.size, cells = grid.cells, remap = opts.remap ?? {}, sc = opts.scale ?? 1;
  const col = grid.palette.map((h) => new THREE.Color(remap[h] ?? h));
  const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= S || y >= S || z >= S ? 0 : cells[(y * S + z) * S + x]);
  const pos = [], nor = [], clr = [], ind = [];
  const ox = S / 2, oy = opts.pivot === "center" ? S / 2 : 0, oz = S / 2;
  const p = [0, 0, 0], q = [0, 0, 0];
  for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const v = cells[(y * S + z) * S + x]; if (!v) continue;
    const c = col[v - 1];
    for (const f of FACES) {
      p[0] = x; p[1] = y; p[2] = z; p[f.d] += f.s;
      if (at(p[0], p[1], p[2])) continue;
      const base = pos.length / 3, ao = [];
      for (const [cu, cv] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        q[0] = x; q[1] = y; q[2] = z; if (f.s > 0) q[f.d] += 1; q[f.u] += cu; q[f.v] += cv;
        pos.push((q[0] - ox) * sc, (q[1] - oy) * sc, (q[2] - oz) * sc);
        const n = [0, 0, 0]; n[f.d] = f.s; nor.push(n[0], n[1], n[2]);
        // ambient occlusion from the three cells touching this corner in front of the face
        const su = cu ? 1 : -1, sv = cv ? 1 : -1;
        const a = [p[0], p[1], p[2]], b = [p[0], p[1], p[2]], e = [p[0], p[1], p[2]];
        a[f.u] += su; b[f.v] += sv; e[f.u] += su; e[f.v] += sv;
        const s1 = at(a[0], a[1], a[2]) ? 1 : 0, s2 = at(b[0], b[1], b[2]) ? 1 : 0, s3 = at(e[0], e[1], e[2]) ? 1 : 0;
        const o = s1 && s2 ? 0 : 3 - s1 - s2 - s3; ao.push(o);
        const k = AO[o] * (f.d === 1 && f.s < 0 ? 0.8 : 1);
        clr.push(c.r * k, c.g * k, c.b * k);
      }
      // split the quad along the brighter diagonal so AO gradients don't crease
      const alt = ao[0] + ao[2] < ao[1] + ao[3];
      const tri = alt ? [0, 1, 3, 1, 2, 3] : [0, 1, 2, 0, 2, 3];
      if (f.flip) for (let i = 0; i < 6; i += 3) ind.push(base + tri[i], base + tri[i + 2], base + tri[i + 1]);
      else for (const t of tri) ind.push(base + t);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(clr, 3));
  g.setIndex(ind);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

const sceneCache = new Map();
export async function loadModel(name) {
  if (!sceneCache.has(name)) sceneCache.set(name, fetch(`models/${name}.json`).then((r) => { if (!r.ok) throw new Error(`model ${name}: ${r.status}`); return r.json(); }).then(decodeScene));
  return sceneCache.get(name);
}
