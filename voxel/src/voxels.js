// Voxel scenes → three.js geometry.
//  - decodeScene: Voxer's saved-scene format (RLE + base64, cells in (y*S+z)*S+x order, 0 = empty, n = palette[n-1])
//  - meshVoxels: face-culled, greedily merged quads with per-vertex ambient occlusion baked into vertex colors
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
  // palette index → unique final color id (two entries that remap to the same color may merge)
  const uniq = new Map(), col = [], cid = grid.palette.map((h) => {
    const hex = remap[h] ?? h; let k = uniq.get(hex);
    if (k === undefined) { k = col.length; col.push(new THREE.Color(hex)); uniq.set(hex, k); }
    return k;
  });
  const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= S || y >= S || z >= S ? 0 : cells[(y * S + z) * S + x]);
  const pos = [], nor = [], clr = [], ind = [];
  const ox = S / 2, oy = opts.pivot === "center" ? S / 2 : 0, oz = S / 2;
  const p = [0, 0, 0], q = [0, 0, 0], a = [0, 0, 0], b = [0, 0, 0], e = [0, 0, 0], ao = [0, 0, 0, 0];
  const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];
  // Greedy meshing: per face direction and slice, a mask of exposed faces keyed by (final color, 4 corner AO values).
  // Neighbouring faces with the same key merge only along axes where their AO is constant (ao0=ao1 & ao3=ao2 along u,
  // ao0=ao3 & ao1=ao2 along v), so the interpolated vertex colors — and the quad split — are exactly as per voxel.
  const mask = new Int32Array(S * S);
  for (const f of FACES) {
    const shade = f.d === 1 && f.s < 0 ? 0.8 : 1, nx = f.d === 0 ? f.s : 0, ny = f.d === 1 ? f.s : 0, nz = f.d === 2 ? f.s : 0;
    for (let w = 0; w < S; w++) {
      mask.fill(0);
      for (let vv = 0; vv < S; vv++) for (let uu = 0; uu < S; uu++) {
        q[f.d] = w; q[f.u] = uu; q[f.v] = vv;
        const c = cells[(q[1] * S + q[2]) * S + q[0]]; if (!c) continue;
        p[0] = q[0]; p[1] = q[1]; p[2] = q[2]; p[f.d] += f.s;
        if (at(p[0], p[1], p[2])) continue;
        let key = 0;
        for (let i = 0; i < 4; i++) {
          // ambient occlusion from the three cells touching this corner in front of the face
          const su = CORNERS[i][0] ? 1 : -1, sv = CORNERS[i][1] ? 1 : -1;
          a[0] = b[0] = e[0] = p[0]; a[1] = b[1] = e[1] = p[1]; a[2] = b[2] = e[2] = p[2];
          a[f.u] += su; b[f.v] += sv; e[f.u] += su; e[f.v] += sv;
          const s1 = at(a[0], a[1], a[2]) ? 1 : 0, s2 = at(b[0], b[1], b[2]) ? 1 : 0, s3 = at(e[0], e[1], e[2]) ? 1 : 0;
          key |= (s1 && s2 ? 0 : 3 - s1 - s2 - s3) << (2 * i);
        }
        mask[vv * S + uu] = ((cid[c - 1] + 1) << 8) | key;
      }
      for (let vv = 0; vv < S; vv++) for (let uu = 0; uu < S; uu++) {
        const key = mask[vv * S + uu]; if (!key) continue;
        for (let i = 0; i < 4; i++) ao[i] = (key >> (2 * i)) & 3;
        const canU = ao[0] === ao[1] && ao[3] === ao[2], canV = ao[0] === ao[3] && ao[1] === ao[2];
        let du = 1, dv = 1;
        if (canU) while (uu + du < S && mask[vv * S + uu + du] === key) du++;
        if (canV) for (; vv + dv < S; dv++) { let k = 0; while (k < du && mask[(vv + dv) * S + uu + k] === key) k++; if (k < du) break; }
        for (let j = 0; j < dv; j++) mask.fill(0, (vv + j) * S + uu, (vv + j) * S + uu + du);
        const c = col[(key >> 8) - 1], base = pos.length / 3;
        for (let i = 0; i < 4; i++) {
          q[f.d] = w + (f.s > 0 ? 1 : 0); q[f.u] = uu + CORNERS[i][0] * du; q[f.v] = vv + CORNERS[i][1] * dv;
          pos.push((q[0] - ox) * sc, (q[1] - oy) * sc, (q[2] - oz) * sc);
          nor.push(nx, ny, nz);
          const k = AO[ao[i]] * shade;
          clr.push(c.r * k, c.g * k, c.b * k);
        }
        // split the quad along the brighter diagonal so AO gradients don't crease
        const alt = ao[0] + ao[2] < ao[1] + ao[3];
        const tri = alt ? [0, 1, 3, 1, 2, 3] : [0, 1, 2, 0, 2, 3];
        if (f.flip) for (let i = 0; i < 6; i += 3) ind.push(base + tri[i], base + tri[i + 2], base + tri[i + 1]);
        else for (const t of tri) ind.push(base + t);
      }
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
