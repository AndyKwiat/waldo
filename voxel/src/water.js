// Water: the river from the mountain plateau, over the great cliff waterfall into the pool on the shelf, down the
// city's stone channel (a waterfall at every terrace step) and out across the lowland. Flat stretches are translucent
// blue with two scrolling glint layers (flowing south); falls are vertical sheets with fast-scrolling white streaks;
// foam/mist puffs bob at the foot of every fall. `update(t, dt)` animates it all.
import * as THREE from "three";

function canvasTex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; return t; }
function rng(seed) { let t = seed; return () => ((t = (t * 16807) % 2147483647) / 2147483647); }
const glintTex = (seed) => canvasTex(64, 256, (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); const r = rng(seed);
  for (let i = 0; i < 70; i++) { const x = r() * w, y = r() * h, len = 6 + r() * 22, a = 0.25 + r() * 0.6; g.fillStyle = `rgba(255,255,255,${a})`;
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) g.fillRect(Math.round(x + dx), Math.round(y + dy), 1 + (r() < 0.3 ? 1 : 0), Math.round(len)); } });
const streakTex = () => canvasTex(64, 128, (g, w, h) => { g.fillStyle = "#6ab8e8"; g.fillRect(0, 0, w, h); const r = rng(5);
  for (let i = 0; i < 160; i++) { const x = Math.floor(r() * w), y = r() * h, len = 8 + r() * 40, c = r(); g.fillStyle = c < 0.5 ? "#ffffff" : c < 0.8 ? "#d8f0ff" : "#9ad0f4";
    for (const dy of [-h, 0, h]) g.fillRect(x, Math.round(y + dy), 1 + (r() < 0.4 ? 1 : 0), Math.round(len)); } });
const puffTex = () => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,0.9)"); grd.addColorStop(0.5, "rgba(240,250,255,0.45)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); };

export function buildWater(scene, W) {
  const R = W.RIVER, flats = { pos: [], uv: [], idx: [] }, falls = { pos: [], uv: [], idx: [] }, foams = [];
  const strip = (T, a, b, c, d, ua, ub) => { const i = T.pos.length / 3; T.pos.push(...a, ...b, ...c, ...d); T.uv.push(0, ua, 1, ua, 1, ub, 0, ub); T.idx.push(i, i + 2, i + 1, i, i + 3, i + 2); };
  // 1. the river's course, sampled every 2 units from the plateau gorge to far beyond the world's south edge
  const z0 = W.CLIFF_Z - 220, z1 = W.WZ + 3000;
  let pz = z0, py = R.y(z0);
  for (let z = z0 + 2; z <= z1; z += z > W.WZ ? 12 : 2) {
    const y = R.y(z), xa = R.x(pz), xb = R.x(z), ha = R.halfW(pz), hb = R.halfW(z);
    if (Math.abs(y - py) > 1.5) { // a fall between pz and z: vertical sheet at z (facing south) + foam at its foot
      const top = Math.max(y, py), bot = Math.min(y, py), hw = Math.min(ha, hb) + (top - bot > 40 ? 2 : 0);
      const iz = pz + 1.2, i0 = falls.pos.length / 3;
      falls.pos.push(xb - hw, top, iz, xb + hw, top, iz, xb + hw, bot, iz + 0.6, xb - hw, bot, iz + 0.6); falls.uv.push(0, top / 24, 1, top / 24, 1, bot / 24, 0, bot / 24); falls.idx.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2);
      foams.push({ x: xb, y: bot + 0.5, z: iz + 2, w: hw, big: top - bot > 40 });
    }
    if (!W.inRiverPool?.(xb, z)) strip(flats, [xa - ha, py, pz], [xa + ha, py, pz], [xb + hb, y, z], [xb - hb, y, z], pz / 48, z / 48);
    pz = z; py = y;
  }
  // 2. the pool on the shelf below the great falls (a disc)
  { const P = W.POOL, y = W.LV[0] - 3, n = 40, i0 = flats.pos.length / 3; flats.pos.push(P.x, y, P.z); flats.uv.push(0.5, P.z / 48);
    for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2; flats.pos.push(P.x + Math.cos(a) * P.r, y, P.z + Math.sin(a) * P.r); flats.uv.push(0.5 + Math.cos(a) * 0.5, (P.z + Math.sin(a) * P.r) / 48); if (k) flats.idx.push(i0, i0 + k + 1, i0 + k); } }
  const geo = (T) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(T.pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(T.uv, 2)); g.setIndex(T.idx); g.computeVertexNormals(); g.computeBoundingSphere(); return g; };
  const flatGeo = geo(flats), fallGeo = geo(falls);
  { const n = fallGeo.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 0.35, 0.94); n.needsUpdate = true; }   // falls face south (lit, never black from the back)
  const water = new THREE.Mesh(flatGeo, new THREE.MeshLambertMaterial({ color: "#5ab8f0", transparent: true, opacity: 0.55, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }));
  water.receiveShadow = true; scene.add(water);
  const glints = [];
  for (const [seed, op, speed] of [[7, 0.24, 0.5], [91, 0.16, 0.3]]) {
    const map = glintTex(seed); map.repeat.set(1, 1);
    const m = new THREE.Mesh(flatGeo, new THREE.MeshBasicMaterial({ map, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16 }));
    m.renderOrder = 2; scene.add(m); glints.push({ map, speed, op, mat: m.material });
  }
  const streaks = streakTex(); streaks.repeat.set(1, 1);
  const fallMat = new THREE.MeshLambertMaterial({ map: streaks, transparent: true, opacity: 0.88, side: THREE.DoubleSide, emissive: new THREE.Color("#4a8ab0"), emissiveIntensity: 0.35 });
  const fall = new THREE.Mesh(fallGeo, fallMat); scene.add(fall);
  // 3. foam and mist at every fall's foot: point clouds (the AO pass skips points, so they never darken the scene)
  const r = rng(33), clouds = [];
  for (const big of [false, true]) {
    const pts = []; for (const f of foams) if (f.big === big) for (let k = 0; k < (big ? 40 : 6); k++) pts.push({ x: f.x + (r() - 0.5) * f.w * 2, y: f.y + r() * (big ? 8 : 1.5), z: f.z + r() * (big ? 14 : 4), ph: r(), sp: 0.4 + r() * 0.6 });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(pts.length * 3), 3));
    const m = new THREE.PointsMaterial({ map: puffTex(), size: big ? 16 : 5, transparent: true, depthWrite: false, opacity: 0.75, sizeAttenuation: true });
    const P = new THREE.Points(g, m); P.frustumCulled = false; scene.add(P); clouds.push({ g, m, pts, lift: big ? 9 : 2.5 });
  }
  return {
    falls: foams,
    update(t) {
      for (const g of glints) { g.map.offset.y = -t * g.speed * 0.25; g.map.offset.x = Math.sin(t * 0.3 + g.speed * 9) * 0.04; g.mat.opacity = g.op * (0.8 + 0.2 * Math.sin(t * 1.3 + g.speed * 7)); }
      streaks.offset.y = t * 1.6;
      for (const c of clouds) { const a = c.g.attributes.position.array; c.pts.forEach((p, k) => { const u = (t * p.sp + p.ph) % 1; a[k * 3] = p.x; a[k * 3 + 1] = p.y + u * c.lift; a[k * 3 + 2] = p.z + u * 2; }); c.g.attributes.position.needsUpdate = true; }
    },
    setNight(n) { fallMat.emissiveIntensity = 0.35 * (1 - n) + 0.05; for (const c of clouds) c.m.opacity = 0.75 - 0.4 * n; },
  };
}
