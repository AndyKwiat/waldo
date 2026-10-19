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
const streakTex = () => canvasTex(64, 128, (g, w, h) => { g.fillStyle = "#3f8fd0"; g.fillRect(0, 0, w, h); const r = rng(5);
  for (let x = 0; x < w; x += 4) { g.fillStyle = (x / 4) % 3 === 0 ? "#5aa8e0" : (x / 4) % 3 === 1 ? "#3a84c4" : "#4a9ad8"; g.fillRect(x, 0, 4, h); }   // vertical bands of deeper / paler water
  for (let i = 0; i < 160; i++) { const x = Math.floor(r() * w), y = r() * h, len = 8 + r() * 40, c = r(); g.fillStyle = c < 0.5 ? "#ffffff" : c < 0.8 ? "#d8f0ff" : "#9ad0f4";
    for (const dy of [-h, 0, h]) g.fillRect(x, Math.round(y + dy), 1 + (r() < 0.4 ? 1 : 0), Math.round(len)); } });
const puffTex = () => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,0.9)"); grd.addColorStop(0.5, "rgba(240,250,255,0.45)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); };

export function buildWater(scene, W) {
  const R = W.RIVER, flats = { pos: [], uv: [], idx: [] }, falls = { pos: [], uv: [], idx: [], rng: [] }, foams = [];
  const strip = (T, a, b, c, d, ua, ub) => { const i = T.pos.length / 3; T.pos.push(...a, ...b, ...c, ...d); T.uv.push(0, ua, 1, ua, 1, ub, 0, ub); T.idx.push(i, i + 2, i + 1, i, i + 3, i + 2); };
  // 1. the river's course, sampled every 2 units from the plateau gorge to far beyond the world's south edge
  const z0 = W.CLIFF_Z - 220, z1 = W.WZ + 3000;
  let pz = z0, py = R.y(z0);
  for (let z = z0 + 2; z <= z1; z += z > W.WZ ? 12 : 2) {
    const y = R.y(z), xa = R.x(pz), xb = R.x(z), ha = R.halfW(pz), hb = R.halfW(z);
    if (Math.abs(y - py) > 1.5) { // a fall between pz and z: vertical sheet at z (facing south) + foam at its foot
      const top = Math.max(y, py), bot = Math.min(y, py), hw = Math.min(ha, hb) + (top - bot > 40 ? 2 : 0); // the sheet hangs just in front of the drop face (which is at the grid line by pz…z)
      const big = top - bot > 40, iz = big ? z + 1.2 : z + 0.8, i0 = falls.pos.length / 3;   // the great falls hug the lip; terrace falls hang in front of the drop
      falls.pos.push(xb - hw, top, iz, xb + hw, top, iz, xb + hw, bot, iz + 0.6, xb - hw, bot, iz + 0.6); falls.uv.push(0, top, 2 * hw, top, 2 * hw, bot, 0, bot); for (let q = 0; q < 4; q++) falls.rng.push(top, bot, 2 * hw); falls.idx.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2);
      foams.push({ x: xb, y: bot + 0.5, z: iz + 2, w: hw, big: top - bot > 40 });
    }
    else if (!W.inRiverPool?.(xb, z)) strip(flats, [xa - ha, py, pz], [xa + ha, py, pz], [xb + hb, y, z], [xb - hb, y, z], pz / 48, z / 48);
    pz = z; py = y;
  }
  // 2. the pool on the shelf below the great falls (a disc)
  { const P = W.POOL, y = W.LV[0] - 3, n = 40, i0 = flats.pos.length / 3; flats.pos.push(P.x, y, P.z); flats.uv.push(0.5, P.z / 48);
    for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2; flats.pos.push(P.x + Math.cos(a) * P.r, y, P.z + Math.sin(a) * P.r); flats.uv.push(0.5 + Math.cos(a) * 0.5, (P.z + Math.sin(a) * P.r) / 48); if (k) flats.idx.push(i0, i0 + k + 1, i0 + k); } }
  const geo = (T) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(T.pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(T.uv, 2)); g.setIndex(T.idx); g.computeVertexNormals(); g.computeBoundingSphere(); return g; };
  const flatGeo = geo(flats), fallGeo = geo(falls); fallGeo.setAttribute("aRange", new THREE.Float32BufferAttribute(falls.rng, 3));
  { const n = fallGeo.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 0.35, 0.94); n.needsUpdate = true; }   // falls face south (lit, never black from the back)
  const water = new THREE.Mesh(flatGeo, new THREE.MeshLambertMaterial({ color: "#5ab8f0", transparent: true, opacity: 0.55, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }));
  water.receiveShadow = true; scene.add(water);
  const glints = [];
  for (const [seed, op, speed] of [[7, 0.24, 0.5], [91, 0.16, 0.3]]) {
    const map = glintTex(seed); map.repeat.set(1, 1);
    const m = new THREE.Mesh(flatGeo, new THREE.MeshBasicMaterial({ map, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16 }));
    m.renderOrder = 2; scene.add(m); glints.push({ map, speed, op, mat: m.material });
  }
  // Procedural waterfall: every 1-voxel column falls at its own speed with its own streak length and shade, wide slow
  // bands drift across the sheet, the lip curls bright over the top, foam churns at the foot and the edges fray —
  // nothing repeats. Pixel-quantised so it matches the voxels. Fog + night dimming are applied by hand.
  const fallMat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uDim: { value: 1 }, uFogColor: { value: new THREE.Color() }, uFogNear: { value: 1400 }, uFogFar: { value: 3800 } },
    vertexShader: `attribute vec3 aRange; varying vec2 vUv; varying vec3 vRange; varying float vDepth;
      void main() { vUv = uv; vRange = aRange; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uDim, uFogNear, uFogFar; uniform vec3 uFogColor; varying vec2 vUv; varying vec3 vRange; varying float vDepth;
      float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float top = vRange.x, bot = vRange.y, w = vRange.z, H = max(1.0, top - bot);
        vec2 q = floor(vUv);                                   // voxel-sized pixels
        float c = q.x, ra = h1(c * 1.37 + top), rb = h1(c * 2.91 + bot);
        float fromTop = top - q.y, fromBot = q.y - bot;
        float accel = sqrt(max(fromTop, 0.0) + 4.0);            // water speeds up as it falls: streaks stretch lower down
        float speed = 26.0 + 22.0 * ra, len = (5.0 + 12.0 * rb) * (0.6 + 0.12 * accel);
        float flow = (q.y + uTime * speed) / len + ra * 40.0;
        float streak = smoothstep(0.64, 0.92, n1(flow)) * (0.6 + 0.4 * n1(flow * 2.3 + 7.0));
        float band = n2(vec2(c / 7.0 + uTime * 0.05, (q.y + uTime * 9.0) / 55.0));             // wide drifting bands
        vec3 deep = vec3(0.12, 0.36, 0.66), mid = vec3(0.24, 0.52, 0.80), pale = vec3(0.58, 0.78, 0.94);
        vec3 col = mix(deep, mid, smoothstep(0.25, 0.75, band) * 0.8 + 0.2 * ra);
        col = mix(col, pale, streak * 0.85);
        col = mix(col, vec3(1.0), streak * streak * 0.35);
        // the lip: smooth bright water curling over the edge
        float lip = 1.0 - smoothstep(0.0, 3.0 + 2.0 * rb, fromTop);
        col = mix(col, mix(pale, vec3(0.95, 0.99, 1.0), n1(c * 0.7 + uTime * 2.0)), lip * 0.8);
        // the foot: churning white foam
        float foamH = min(10.0, 3.0 + H * 0.06);
        float foam = (1.0 - smoothstep(0.0, foamH, fromBot)) * smoothstep(0.35, 0.65, n2(vec2(c * 0.6, q.y * 0.7 - uTime * 6.0)) + 0.35);
        col = mix(col, vec3(0.97, 0.99, 1.0), clamp(foam, 0.0, 1.0));
        // frayed side edges
        float edge = min(vUv.x, w - vUv.x), fray = 1.5 + 2.5 * n1(q.y * 0.15 + c * 0.0 + uTime * 0.7 + ra);
        float a = smoothstep(0.0, fray, edge) * (0.88 + 0.12 * streak);
        col = pow(col, vec3(2.2)) * uDim;   // authored in sRGB; the pipeline is linear
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vDepth));   // fog colour is already linear
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  });
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
      fallMat.uniforms.uTime.value = t;
      if (scene.fog) { fallMat.uniforms.uFogColor.value.copy(scene.fog.color); fallMat.uniforms.uFogNear.value = scene.fog.near; fallMat.uniforms.uFogFar.value = scene.fog.far; }
      for (const c of clouds) { const a = c.g.attributes.position.array; c.pts.forEach((p, k) => { const u = (t * p.sp + p.ph) % 1; a[k * 3] = p.x; a[k * 3 + 1] = p.y + u * c.lift; a[k * 3 + 2] = p.z + u * 2; }); c.g.attributes.position.needsUpdate = true; }
    },
    setNight(n) { fallMat.uniforms.uDim.value = 1 - 0.62 * n; for (const c of clouds) c.m.opacity = 0.75 - 0.4 * n; },
  };
}
