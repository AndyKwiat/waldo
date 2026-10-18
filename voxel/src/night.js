// Night mode helpers (graphics only; the sim is unchanged).
//  - GLOW: palette colours that light up at night (lantern bodies, paper window panes) → emitted colour + light kind
//  - glowGeometry: just the exposed faces of glowing voxels, drawn additively over the model at night
//  - lightSources: clusters of glowing voxels in a model → point lights (local coords, pivot "base")
//  - lightMapCanvas: all lights splatted as warm radial pools into one top-down texture; every lit material adds
//    diffuse × lightmap(x, z) × height falloff (patched into the shaders in main.js), so thousands of lamps cost one lookup
//  - nightSky: gradient dome + stars + moon that follow the camera
import * as THREE from "three";

export const GLOW = {
  "#e0382c": { emit: [1.0, 0.42, 0.2], kind: "lantern" },   // M.lantern
  "#f6e6b8": { emit: [1.0, 0.72, 0.36], kind: "window" },   // M.paper (lattice windows, paper screens)
};
// Light map channels: R = street-level lights (lanterns, windows; fade above ~y 8–30), G = high lights (wall-top
// torches; light a band around y 26). The colour is applied in the shader (warm), so channels are just intensity.
export const LIGHT_KIND = {
  lantern: { r: 17, ch: 0, a: 0.95 },
  window: { r: 10, ch: 0, a: 0.3 },
  torch: { r: 22, ch: 1, a: 1.0 },
  brazier: { r: 30, ch: 1, a: 0.9 },   // ground braziers whose light is meant for something tall (the statue)
};

const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** Exposed faces of glowing voxels (pivot "base": grid centre in x/z, y = 0 at the floor). Null if the model has none. */
export function glowGeometry(grid) {
  const S = grid.size, cells = grid.cells, glow = grid.palette.map((h) => GLOW[h.toLowerCase()] ?? null);
  if (!glow.some(Boolean)) return null;
  const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= S || y >= S || z >= S ? 0 : cells[(y * S + z) * S + x]);
  const pos = [], col = [], idx = [];
  for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const v = cells[(y * S + z) * S + x]; if (!v) continue; const g = glow[v - 1]; if (!g) continue;
    for (const [dx, dy, dz] of DIRS) {
      if (at(x + dx, y + dy, z + dz)) continue;
      // quad on the face: centre + two in-plane axes
      const n = [dx, dy, dz], u = dx ? [0, 1, 0] : [1, 0, 0], w = dz ? [0, 1, 0] : dy ? [0, 0, 1] : [0, 0, 1];
      const c = [x + 0.5 + dx * 0.5 - S / 2, y + 0.5 + dy * 0.5, z + 0.5 + dz * 0.5 - S / 2], b = pos.length / 3;
      for (const [su, sw] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(c[0] + (u[0] * su + w[0] * sw) * 0.5, c[1] + (u[1] * su + w[1] * sw) * 0.5, c[2] + (u[2] * su + w[2] * sw) * 0.5); col.push(...g.emit); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3); void n;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
  geo.computeBoundingSphere(); return geo;
}

/** Glowing-voxel clusters (3³ bins) → [{x, y, z, kind}] in local coords (pivot "base"); lanterns win over windows. */
export function lightSources(grid) {
  const S = grid.size, cells = grid.cells, glow = grid.palette.map((h) => GLOW[h.toLowerCase()] ?? null), bins = new Map();
  for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const v = cells[(y * S + z) * S + x]; if (!v) continue; const g = glow[v - 1]; if (!g) continue;
    const k = `${Math.floor(x / 3)},${Math.floor(y / 3)},${Math.floor(z / 3)}`; const b = bins.get(k) ?? bins.set(k, { x: 0, y: 0, z: 0, n: 0, kind: g.kind }).get(k);
    b.x += x + 0.5; b.y += y + 0.5; b.z += z + 0.5; b.n++; if (g.kind === "lantern") b.kind = "lantern";
  }
  return [...bins.values()].map((b) => ({ x: b.x / b.n - S / 2, y: b.y / b.n, z: b.z / b.n - S / 2, kind: b.kind }));
}

/** Splats world lights [{x, z, kind}] into a canvas covering `rect` at `res` world units per pixel. */
export function lightMapCanvas(lights, rect, res = 2) {
  const c = document.createElement("canvas"); c.width = Math.ceil(rect.w / res); c.height = Math.ceil(rect.d / res);
  const g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = "lighter";
  for (const L of lights) {
    const K = LIGHT_KIND[L.kind], px = (L.x - rect.x) / res, pz = (L.z - rect.z) / res, r = K.r / res * (L.scale ?? 1), a = K.a * (L.gain ?? 1);
    const gr = g.createRadialGradient(px, pz, 0, px, pz, r), R = K.ch === 0 ? 255 : 0, G = K.ch === 1 ? 255 : 0, B = 0;
    gr.addColorStop(0, `rgba(${R},${G},${B},${a})`); gr.addColorStop(0.35, `rgba(${R},${G},${B},${a * 0.45})`); gr.addColorStop(1, `rgba(${R},${G},${B},0)`);
    g.fillStyle = gr; g.fillRect(px - r, pz - r, 2 * r, 2 * r);
  }
  return c;
}

/** Night sky that follows the camera: gradient dome, ~2500 twinkle-free stars, a moon in the light's direction. */
export function nightSky(moonDir) {
  const group = new THREE.Group(); group.renderOrder = -10;
  const R = 3600, dome = new THREE.SphereGeometry(R, 32, 16), cols = [], p = dome.attributes.position;
  const zen = new THREE.Color("#040818"), mid = new THREE.Color("#0c1736"), hor = new THREE.Color("#1f2d5a"), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const h = p.getY(i) / R; if (h > 0.25) t.copy(mid).lerp(zen, Math.min(1, (h - 0.25) / 0.6)); else t.copy(hor).lerp(mid, Math.max(0, h + 0.05) / 0.3); cols.push(t.r, t.g, t.b); }
  dome.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  const domeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, transparent: true, opacity: 0 });
  const domeMesh = new THREE.Mesh(dome, domeMat); domeMesh.renderOrder = -10; group.add(domeMesh);
  const sp = [], sc = []; let s = 12345; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) { const u = r(), v = 0.04 + r() * 0.96, th = u * Math.PI * 2, y = Math.pow(v, 0.7), rr = Math.sqrt(1 - y * y);
    sp.push(Math.cos(th) * rr * (R - 50), y * (R - 50), Math.sin(th) * rr * (R - 50)); const b = 0.45 + r() * 0.55, warm = r(); sc.push(b, b * (0.92 + warm * 0.08), b * (0.9 + (1 - warm) * 0.1)); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute("color", new THREE.Float32BufferAttribute(sc, 3));
  const starMat = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(sg, starMat); stars.renderOrder = -9; group.add(stars);
  const moonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.15, 1.9), fog: false, transparent: true, opacity: 0, depthWrite: false });
  const moon = new THREE.Mesh(new THREE.CircleGeometry(70, 32), moonMat); moon.position.copy(moonDir.clone().normalize().multiplyScalar(R - 120)); moon.lookAt(0, 0, 0); moon.renderOrder = -8; group.add(moon);
  const hc = document.createElement("canvas"); hc.width = hc.height = 128; const hg = hc.getContext("2d"), grd = hg.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(150,170,255,0.9)"); grd.addColorStop(0.3, "rgba(90,110,200,0.35)"); grd.addColorStop(1, "rgba(40,50,120,0)"); hg.fillStyle = grd; hg.fillRect(0, 0, 128, 128);
  const haloMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc), fog: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), haloMat); halo.position.copy(moon.position).multiplyScalar(1.01); halo.lookAt(0, 0, 0); halo.renderOrder = -9; group.add(halo);
  group.visible = false;
  return { group, set(n) { group.visible = n > 0.01; domeMat.opacity = n; starMat.opacity = Math.min(1, n * 1.2); moonMat.opacity = n; haloMat.opacity = n * 0.6; } };
}
