// Baked large-scale ambient occlusion ("how much sky can you see") for the ground and for actors.
// Screen-space AO only reaches a few voxels; this darkens whole alleys, narrow streets, courtyards and the foot of
// the city walls, at zero per-frame cost.
//   1. heightMap: the top of every placed voxel model, column by column (rotated + translated into the world).
//   2. bakeSkyAO: horizon-based occlusion per cell — in K directions, the steepest building edge within R units,
//      weighted so near walls count more than far ones → 0 (open sky) … 1 (deep alley).
//   3. sampler: occlusion at any world (x, z), bilinear.
// Pure JS (no three.js), so it can be timed and tested outside the browser.

/** Column tops of a decoded model grid ({size, cells}, index (y*S+z)*S+x): Uint8Array S*S of (top y + 1), 0 = empty. */
export function columnTops(grid) {
  const S = grid.size, c = grid.cells, top = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) { const row = (y * S + z) * S; for (let x = 0; x < S; x++) if (c[row + x]) top[z * S + x] = y + 1; }
  return top;
}

/**
 * Height map over a world rectangle at `res` units per cell. `placements`: [{x, y, z, rot, tops, size}] (model
 * placed by grid centre in x/z, `rot` quarter turns about +y, three.js convention). Returns {h, nx, nz, x0, z0, res}.
 */
export function heightMap(placements, rect, res = 2, baseH = null) {
  const nx = Math.ceil(rect.w / res), nz = Math.ceil(rect.d / res), h = new Float32Array(nx * nz), base = new Float32Array(nx * nz);
  if (baseH) for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) base[j * nx + i] = h[j * nx + i] = baseH(rect.x + (i + 0.5) * res, rect.z + (j + 0.5) * res);   // the terrain itself occludes too
  for (const p of placements) {
    const S = p.size, t = p.tops, a = (p.rot || 0) * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
    for (let lz = 0; lz < S; lz++) for (let lx = 0; lx < S; lx++) {
      const top = t[lz * S + lx]; if (!top) continue;
      const ox = lx + 0.5 - S / 2, oz = lz + 0.5 - S / 2;
      const wx = p.x + ox * ca + oz * sa, wz = p.z - ox * sa + oz * ca;   // rotation about +y (x' = x cos + z sin, z' = −x sin + z cos)
      const i = Math.floor((wx - rect.x) / res), j = Math.floor((wz - rect.z) / res);
      if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
      const v = (p.y || 0) + top; if (v > h[j * nx + i]) h[j * nx + i] = v;
    }
  }
  return { h, base, nx, nz, x0: rect.x, z0: rect.z, res };
}

/**
 * Horizon-based sky occlusion for every cell of a height map: occ = mean over `dirs` directions of
 * max_k sin(elevation of the k-th sample) · (1 − (d/R)²). Cells far from anything tall are skipped (0).
 */
export function bakeSkyAO(hm, { radius = 44, dirs = 12, eye = 0.6 } = {}) {
  const { h, base, nx, nz, res } = hm, occ = new Float32Array(nx * nz), R = radius / res;
  // coarse max map (blocks of B cells) for an early out where nothing tall is within reach
  const B = 8, bx = Math.ceil(nx / B), bz = Math.ceil(nz / B), bmax = new Float32Array(bx * bz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = Math.floor(j / B) * bx + Math.floor(i / B); if (h[j * nx + i] > bmax[k]) bmax[k] = h[j * nx + i]; }
  const reach = Math.ceil(R / B) + 1;
  const DX = [], DZ = []; for (let d = 0; d < dirs; d++) { const a = (d + 0.5) / dirs * Math.PI * 2; DX.push(Math.cos(a)); DZ.push(Math.sin(a)); }
  const steps = []; for (let s = 1; s <= R; s += Math.max(1, s * 0.25)) steps.push(s);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const h0 = base ? base[j * nx + i] : 0; let tall = 0; const ci = Math.floor(i / B), cj = Math.floor(j / B);
    for (let b = Math.max(0, cj - reach); b <= Math.min(bz - 1, cj + reach) && !tall; b++) for (let a = Math.max(0, ci - reach); a <= Math.min(bx - 1, ci + reach); a++) if (bmax[b * bx + a] > h0 + 2) { tall = 1; break; }
    if (!tall) continue;
    let sum = 0;
    for (let d = 0; d < dirs; d++) {
      let best = 0;
      for (const s of steps) {
        const x = Math.round(i + DX[d] * s), z = Math.round(j + DZ[d] * s); if (x < 0 || z < 0 || x >= nx || z >= nz) break;
        const dh = h[z * nx + x] - h0 - eye; if (dh <= 0) continue;
        const dist = s * res, t = dh / dist, sin = t / Math.sqrt(1 + t * t), f = 1 - (s / R) * (s / R), o = sin * f;
        if (o > best) best = o;
      }
      sum += best;
    }
    occ[j * nx + i] = sum / dirs;
  }
  return { ...hm, occ };
}

/** Bilinear occlusion lookup at world (x, z); 0 outside the baked rectangle. */
export function sampler(ao) {
  const { occ, nx, nz, x0, z0, res } = ao;
  return (x, z) => {
    const fx = (x - x0) / res - 0.5, fz = (z - z0) / res - 0.5, i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= nx - 1 || j >= nz - 1) return 0;
    const u = fx - i, v = fz - j, k = j * nx + i;
    return (occ[k] * (1 - u) + occ[k + 1] * u) * (1 - v) + (occ[k + nx] * (1 - u) + occ[k + nx + 1] * u) * v;
  };
}
