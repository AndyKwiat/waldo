// Jade River City — low-poly edition. Wiring: world layout → instanced flat-shaded meshes → simulation loop → UI.
// Agent/debug API: window.city (see README "Agent tooling").
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import * as W from "./world.js";
import { SLOT_DEFAULT, Builder, columnTops } from "./geo.js";
import { modelGeometry, wheelGeometry, WHEELS } from "./models.js";
import { personGeometry, animalGeometry } from "./figures.js";
import { createSim } from "./sim.js";
import { heightMap, bakeSkyAO, sampler } from "./skyao.js";
import { buildWater } from "./water.js";
import { buildTransport } from "./transport.js";
import { lightMapCanvas } from "./night.js";
import { terrainGeometry, terrainMaterial, groundTexture, stairsGeometry, rockSpots, rockGeometry } from "./terrain.js";
import { buildSky, buildClouds, skyState } from "./sky.js";

const qs = new URLSearchParams(location.search);
if (qs.get("seed")) W.setSeed(+qs.get("seed"));
const LOW = qs.has("low");           // cheaper rendering for headless screenshots

// Distance darkening ("depth fog"): every fogged material dims (and cools) with distance beyond the orbit target, so
// what you look at stays bright and far districts recede. Night lighting: one top-down light map of every lamp; lit
// materials add diffuse × light × height falloff, scaled by uNight. Both are injected into each material's shader.
const distDark = { value: qs.has("nodark") ? 0 : 1 }, distFocus = { value: 300 };
const nightU = { uNight: { value: 0 }, uLightMap: { value: null }, uLightRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uLightGain: { value: 1.2 }, uGroundMap: { value: null } };
function addDistanceDarkening(root) {
  root.traverse((o) => { for (const m of [o.material].flat()) { if (!m || !m.fog || m.userData.distDark) continue; m.userData.distDark = true;
    const lit = m.isMeshLambertMaterial, prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey.bind(m);
    m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r);
      sh.uniforms.uDistDark = distDark; sh.uniforms.uDistFocus = distFocus; Object.assign(sh.uniforms, nightU);
      let night = "";
      if (lit) {
        sh.vertexShader = "varying vec3 vNightWP;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n\tvec4 nwp = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\n\tnwp = instanceMatrix * nwp;\n#endif\n\tvNightWP = ( modelMatrix * nwp ).xyz;");
        night = "\tif ( uNight > 0.0 ) { vec2 luv = ( vNightWP.xz - uLightRect.xy ) / uLightRect.zw; if ( luv.x > 0.0 && luv.y > 0.0 && luv.x < 1.0 && luv.y < 1.0 ) {" +
          " vec2 lm = texture2D( uLightMap, luv ).rg; float ry = vNightWP.y - texture2D( uGroundMap, luv ).r * 1020.0;" +
          " float lo = lm.r * clamp( 1.0 - ( ry - 5.0 ) / 15.0, 0.04, 1.0 ) * smoothstep( -9.0, -2.0, ry ); float hi = lm.g * ( 1.0 - smoothstep( 4.0, 30.0, abs( ry - 26.0 ) ) );" +
          " gl_FragColor.rgb += diffuseColor.rgb * vec3( 1.0, 0.62, 0.32 ) * ( lo + hi ) * uNight * uLightGain; } }\n";
      }
      sh.fragmentShader = "uniform float uDistDark;\nuniform float uDistFocus;\nuniform float uNight;\nuniform sampler2D uGroundMap;\nuniform sampler2D uLightMap;\nuniform vec4 uLightRect;\nuniform float uLightGain;\n" + (lit ? "varying vec3 vNightWP;\n" : "") +
        sh.fragmentShader.replace("#include <fog_fragment>", "#ifdef USE_FOG\n\tgl_FragColor.rgb *= mix( vec3( 1.0 ), vec3( 0.55, 0.6, 0.76 ), smoothstep( uDistFocus * 0.9, uDistFocus * 2.2, vFogDepth ) * uDistDark * 0.85 );\n#endif\n" + night + "#include <fog_fragment>");
    };
    m.customProgramCacheKey = () => prevKey() + "|distDark+night" + (lit ? "L" : ""); m.needsUpdate = true; } });
}
const city = (window.city = { ready: false });
const setStatus = (t) => { const el = document.getElementById("loading"); if (el) el.textContent = t; };

// ---------- renderer / scene / camera
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(LOW ? 1 : Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !qs.has("noshadow");
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog("#a6d6f4", 1500, 4200);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 1, 6000);
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.12, screenSpacePanning: false, maxPolarAngle: 1.42, minDistance: 12, maxDistance: 1700, zoomSpeed: 1.2 });
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
// Lighting: a warm key (sun by day, moon by night) with soft shadows, a cool fill from the opposite side and a
// hemisphere ambient, all re-tinted through the day by sky.js (dawn orange, noon white, dusk pink, blue night).
const hemi = new THREE.HemisphereLight("#dcecff", "#7a6a4a", 0.8); scene.add(hemi);
const fill = new THREE.DirectionalLight("#9cc4ff", 0.5); scene.add(fill, fill.target);
const sun = new THREE.DirectionalLight("#ffe8c8", 3.0); sun.castShadow = true;
sun.shadow.mapSize.set(LOW ? 2048 : 4096, LOW ? 2048 : 4096); Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, near: 10, far: 2400 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.5;
scene.add(sun, sun.target);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;

// Post-processing: scene → GTAO (screen-space ambient occlusion) → bloom (night glow) → output (tone mapping + sRGB).
let AO = !qs.has("noao");
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: LOW ? 0 : 4 }));
composer.setPixelRatio(renderer.getPixelRatio());
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.updateGtaoMaterial({ radius: 5, distanceExponent: 1.5, thickness: 3, scale: 1.1, samples: LOW ? 8 : 16, distanceFallOff: 1 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: LOW ? 8 : 16 });
gtao.blendIntensity = 0.85;
composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0, 0.55, 0.9); bloom.enabled = false; composer.addPass(bloom);
composer.addPass(new OutputPass());
renderer.info.autoReset = false;
renderer.shadowMap.autoUpdate = false;   // the GTAO normal pass re-renders the scene: draw the shadow map once per frame
const draw = () => { renderer.info.reset(); renderer.shadowMap.needsUpdate = true; gtao.enabled = AO; composer.render(); };

// ---------- time of day: tod in hours; NIGHT jumps between noon and late evening, CYCLE lets the day run (8 min per day)
let tod = qs.has("tod") ? +qs.get("tod") : qs.has("night") ? 22 : 10.5, todTarget = null, cycle = qs.has("cycle");
const CYCLE_RATE = 24 / 480;   // hours per second
const FX = {
  night: { label: "NIGHT", key: "n", get: () => (todTarget ?? tod) >= 19.5 || (todTarget ?? tod) < 5, set: (v) => { todTarget = v ? 22 : 10.5; cycle = false; } },
  cycle: { label: "DAY CYCLE", key: "t", get: () => cycle, set: (v) => { cycle = v; todTarget = null; } },
  ao: { label: "AO", key: "o", get: () => AO, set: (v) => { AO = v; } },
  dark: { label: "DEPTH FOG", key: "f", get: () => distDark.value > 0, set: (v) => { distDark.value = v ? 1 : 0; } },
};
const fxBar = document.getElementById("fx");
for (const [k, f] of Object.entries(FX)) { const b = document.createElement("button"); b.dataset.fx = k; b.title = `toggle (${f.key.toUpperCase()} key)`; b.onclick = () => { f.set(!f.get()); syncFx(); }; fxBar?.appendChild(b); }
const clockEl = document.getElementById("clock");
function syncFx() { for (const b of fxBar?.children ?? []) { const f = FX[b.dataset.fx]; b.textContent = `${f.label} ${f.get() ? "ON" : "OFF"}`; b.classList.toggle("on", f.get()); } }
syncFx();
addEventListener("keydown", (e) => { if (e.metaKey || e.ctrlKey || e.altKey) return; for (const f of Object.values(FX)) if (e.key.toLowerCase() === f.key) { f.set(!f.get()); syncFx(); }
  if (e.key === "[" || e.key === "]") { todTarget = null; tod = (tod + (e.key === "]" ? 0.5 : -0.5) + 24) % 24; syncFx(); } });
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

const VIEWS = {
  town: () => [[W.CENTER.x + 170, 190, W.CENTER.z + 260], [W.CENTER.x, 0, W.CENTER.z - 10]],
  overview: () => [[W.WX / 2, 1250, W.WZ + 800], [W.WX / 2, -60, W.WZ / 2 - 30]],
  city: () => [[W.CITY.x0 + W.CW / 2, 760, W.CITY.z1 + 600], [W.CITY.x0 + W.CW / 2, 0, (W.CITY.z0 + W.CITY.z1) / 2]],
  walls: () => [[W.CITY.x1 + 70, 70, W.CITY.z1 + 80], [W.CITY.x1 - 60, 22, W.CITY.z1 - 10]],
  country: () => [[W.HAMLETS[2].x + 160, 120, W.HAMLETS[2].z + 210], [W.HAMLETS[2].x + 40, 0, W.HAMLETS[2].z - 20]],
  plaza: () => [[W.CENTER.x + 40, 70, W.CENTER.z + 110], [W.CENTER.x, 0, W.CENTER.z]],
  street: () => [[W.SX[0] + 6, 18, W.SZ[3] + 4], [W.SX[2] + 20, 4, W.SZ[3] - 2]],
  gate: () => [[W.GATE_X + 35, 42, W.WALL_S + 105], [W.GATE_X, 10, W.WALL_S + 4]],
  palace: () => [[W.GATE_X + 250, 230, W.PALACE.z + W.PALACE.d + 300], [W.GATE_X, 60, W.PALACE.z + W.PALACE.d / 2 - 20]],
  fort: () => VIEWS.palace(),
  district: () => [[W.SX[1] - 40, 210, W.SZ[7] + 170], [W.SX[2] + 30, 0, W.SZ[5] + 20]],
  yard: () => [[W.GATE_X + 70, 60, W.YARD.z + W.YARD.d + 70], [W.GATE_X, 8, W.YARD.z + 10]],
  alley: () => { const e = W.EDGE_LIST.find((q) => q.type === "alley" && q.a[0] > 0) ?? W.EDGE_LIST[0], x = (W.SX[e.a[0]] + W.SX[e.b[0]]) / 2, z = W.alleyZ(e.a[1], e.a[0], x); return [[x - 26, 75, z + 34], [x + 6, 0, z]]; },
  river: () => [[W.RX + 120, 80, W.SZ[6] + 140], [W.RX, 0, W.SZ[5]]],
  gondola: () => [[W.GX + 110, 60, W.GONDOLA_LOW.z + 90], [W.GX, 30, W.GONDOLA_LOW.z - 40]],
  lift: () => { const T = W.LIFTS[0]; return [[T.x + 90, 50, T.z + 110], [T.x, 40, T.z - 10]]; },
  upland: () => [[1300, 70, 640], [1500, -40, 360]],
  gondola2: () => [[W.GX2 - 140, 110, W.G2.mid.z + 160], [W.GX2, 60, W.G2.mid.z - 40]],
  shrine: () => [[W.SHRINE.x + 120, 60, W.SHRINE.z + 130], [W.SHRINE.x + 20, 10, W.SHRINE.z + 20]],
  falls: () => [[W.RX + 200, 180, W.CITY.z0 + 230], [W.RX, 130, W.CLIFF_Z - 20]],
  mountain: () => [[W.CITY.x1 + 500, 650, W.CITY.z1 + 700], [W.CENTER.x + 80, -60, W.CENTER.z - 120]],
  mill: () => [[L.WHEEL.x - 50, 40, L.WHEEL.z + 70], [L.WHEEL.x + 10, 4, L.WHEEL.z]],
  paddies: () => [[W.GATE_X - 160, 70, W.WALL_S + 150], [W.GATE_X - 160, 0, W.WALL_S + 55]],
  pagoda: () => { const b = W.block(...W.PAGODA_BLOCK); return [[b.x + 120, 80, b.z + 170], [b.x + 42, 10, b.z + 40]]; },
  statue: () => [[W.STATUE.x + 2, 17, W.STATUE.z + 150], [W.STATUE.x - 2, 44, W.STATUE.z]],
};
const viewBar = document.getElementById("views");
for (const name of Object.keys(VIEWS).filter((n) => n !== "fort")) { const b = document.createElement("button"); b.textContent = name; b.dataset.view = name; b.onclick = () => setView(name); viewBar.appendChild(b); }
function placeCam(p, t) {
  const polar = Math.acos(Math.max(-1, Math.min(1, (p[1] - t[1]) / Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]))));
  controls.maxPolarAngle = Math.max(1.42, polar + 0.02);
  camera.position.set(...p); controls.target.set(...t); followed = null; controls.update();
}
function setView(name) {
  for (const b of viewBar.children) b.classList.toggle("on", b.dataset.view === name); const v = VIEWS[name] ?? VIEWS.town; const [p, t] = v();
  const g = W.groundH(t[0], t[2]); placeCam([p[0], p[1] + g, p[2]], [t[0], t[1] + g, t[2]]); }
city.view = setView;
city.cam = (pos, target) => placeCam(pos, target);

// ---------- materials
// Model material: vertex colours × per-instance colour slots (roof / wall / pillar / cloth) so one geometry serves every
// colour variant. Instanced meshes carry iRoof/iWall/iPillar/iCloth; plain meshes use the default slot colours.
const SLOT_U = Object.fromEntries(Object.entries(SLOT_DEFAULT).map(([k, v]) => ["u" + k[0].toUpperCase() + k.slice(1), { value: new THREE.Color(v) }]));
const SLOT_GLSL = `attribute float aSlot;
#ifdef USE_INSTANCING
attribute vec3 iRoof; attribute vec3 iWall; attribute vec3 iPillar; attribute vec3 iCloth;
#endif
uniform vec3 uRoof; uniform vec3 uWall; uniform vec3 uPillar; uniform vec3 uCloth;
`;
const SLOT_APPLY = `#include <color_vertex>
#ifdef USE_INSTANCING
  vec3 sR = iRoof, sW = iWall, sP = iPillar, sC = iCloth;
#else
  vec3 sR = uRoof, sW = uWall, sP = uPillar, sC = uCloth;
#endif
  if ( aSlot > 0.5 ) vColor.rgb *= aSlot < 1.5 ? sR : aSlot < 2.5 ? sW : aSlot < 3.5 ? sP : sC;`;
function slotMaterial(extraKey = "", extra = null) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, SLOT_U); sh.vertexShader = SLOT_GLSL + sh.vertexShader.replace("#include <color_vertex>", SLOT_APPLY); extra?.(sh); };
  m.customProgramCacheKey = () => "slots" + extraKey; return m;
}
const vmat = slotMaterial();
// Walk animation for people / animals / the ox-cart ox: limbs tagged per vertex (aPart = [k, pivotY, pivotZ], see geo.js)
// swing at the hip / shoulder by sin(phase) × amplitude from a per-instance aWalk = [phase, amp].
const walkMat = slotMaterial("walk", (sh) => {
  sh.vertexShader = "attribute vec3 aPart;\nattribute vec2 aWalk;\n" + sh.vertexShader
    .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n\tfloat wK = abs( aPart.x ); bool wZ = wK > 2.5;\n\tfloat wAng = aPart.x == 0.0 ? 0.0 : sign( aPart.x ) * ( wK > 1.5 && wK < 2.5 ? 0.7 : 1.0 ) * sin( aWalk.x ) * aWalk.y;\n\tfloat wc = cos( wAng ), ws = sin( wAng );\n\tobjectNormal = wZ ? vec3( objectNormal.x * wc - objectNormal.y * ws, objectNormal.x * ws + objectNormal.y * wc, objectNormal.z ) : vec3( objectNormal.x, objectNormal.y * wc - objectNormal.z * ws, objectNormal.y * ws + objectNormal.z * wc );")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tif ( wZ ) { vec2 wd = vec2( transformed.x - aPart.z, transformed.y - aPart.y ); transformed.x = aPart.z + wd.x * wc - wd.y * ws; transformed.y = aPart.y + wd.x * ws + wd.y * wc; }\n\telse { vec2 wd = vec2( transformed.y - aPart.y, transformed.z - aPart.z ); transformed.y = aPart.y + wd.x * wc - wd.y * ws; transformed.z = aPart.z + wd.x * ws + wd.y * wc; }");
});
const plainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const glowMat = () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const C3 = new THREE.Color();
/** An InstancedMesh of a slot-coloured geometry: its own geometry view with per-instance slot colours (variants: [{roof,…}] or null). */
function inst(geo, n, variants = null, mat = vmat) {
  const g = new THREE.BufferGeometry(); for (const [k, a] of Object.entries(geo.attributes)) g.setAttribute(k, a); g.boundingSphere = geo.boundingSphere; g.boundingBox = geo.boundingBox; g.userData = geo.userData;
  for (const [slot, def] of Object.entries(SLOT_DEFAULT)) { const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { C3.set(variants?.[i]?.[slot] ?? def); arr[i * 3] = C3.r; arr[i * 3 + 1] = C3.g; arr[i * 3 + 2] = C3.b; }
    g.setAttribute("i" + slot[0].toUpperCase() + slot.slice(1), new THREE.InstancedBufferAttribute(arr, 3)); }
  return new THREE.InstancedMesh(g, mat, n);
}
city.inst = inst;

// ---------- static world
const L = W.layout();
const tex = groundTexture();
const terrainMat = terrainMaterial(tex);
for (const g of terrainGeometry()) { const m = new THREE.Mesh(g, terrainMat); m.receiveShadow = true; const bb = g.boundingBox; m.castShadow = bb.max.x > -100 && bb.min.x < W.WX + 100 && bb.max.z > W.CLIFF_Z - 300 && bb.min.z < W.WZ; scene.add(m); }
const outer = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000), new THREE.MeshLambertMaterial({ color: "#5fae44" })); outer.rotation.x = -Math.PI / 2; outer.position.set(W.WX / 2, -2, W.WZ / 2); scene.add(outer);
{ const st = new THREE.Mesh(stairsGeometry(), plainMat); st.castShadow = st.receiveShadow = true; scene.add(st); }
/** Flat ribbon following f(x) (roads beyond the world rect). */
function ribbon(x0, x1, zc, hw, y, color) {
  const pos = [], idx = []; for (let x = x0, i = 0; x <= x1; x += 8, i++) { const z = zc(x); pos.push(x, W.terrainH0(Math.max(-1190, Math.min(W.WX + 1190, x)), z) + y, z - hw, x, W.terrainH0(Math.max(-1190, Math.min(W.WX + 1190, x)), z) + y, z + hw); if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 })); m.receiveShadow = true; scene.add(m); return m;
}
{ const r = W.ROADS[1]; for (const [a, b] of [[-1180, 0], [W.WX, W.WX + 1180]]) ribbon(a, b, () => r.z + r.d / 2, r.d / 2, 0.15, "#cdb084"); }
const water = buildWater(scene, W);

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const glowSets = [];   // {im, mat} additive night glows (windows, lanterns)
const HOUSE_MODELS = new Set(["home1", "home2", "shop", "inn", "manor", "hall_house", "compound"]);
const lights = [];
function buildStatics() {
  const groups = new Map(); for (const s of L.statics) (groups.get(s.model) ?? groups.set(s.model, []).get(s.model)).push(s);
  for (const [model, list] of groups) {
    const geo = modelGeometry(model);
    const im = inst(geo, list.length, list.map((s) => s.remap)); im.castShadow = im.receiveShadow = true;
    list.forEach((s, i) => { Q.setFromAxisAngle(UP, s.rot * Math.PI / 2); im.setMatrixAt(i, M4.compose(V.set(s.x, s.y, s.z), Q, s.scale ? SC.set(...s.scale) : SC.set(1, 1, 1))); });
    im.computeBoundingSphere(); scene.add(im);
    // night: glowing windows / lanterns (not every household is still up) and their light pools
    const glow = geo.userData.glow; if (!glow) continue;
    const mat = glowMat(), gim = new THREE.InstancedMesh(glow, mat, list.length); gim.frustumCulled = false; gim.visible = false;
    const pLit = HOUSE_MODELS.has(model) ? 0.5 : model === "lantern_post" ? 0.6 : 0.85;
    list.forEach((s, i) => { im.getMatrixAt(i, M4); gim.setMatrixAt(i, M4);
      const h = Math.abs(Math.sin(s.x * 12.9898 + s.z * 78.233) * 43758.5453) % 1, lit = h < pLit, gain = lit ? 0.75 + 0.35 * (h / pLit) : 0;
      gim.setColorAt(i, C3.setScalar(gain)); if (!lit) return;
      for (const l of geo.userData.lights) { V.set(l.x, l.y, l.z).applyMatrix4(M4); lights.push({ x: V.x, z: V.z, kind: l.kind, gain }); } });
    scene.add(gim); glowSets.push({ mat, im: gim });
  }
}
// small instanced ground cover: grass tufts, rice seedlings, bushes, crops, boulders
function tuftGeometry() { const b = new Builder(); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; b.tri([Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5], [Math.cos(a + 1.2) * 0.5, 0, Math.sin(a + 1.2) * 0.5], [Math.cos(a + 0.6) * 0.9, 1.6 + k * 0.3, Math.sin(a + 0.6) * 0.9], "#ffffff"); b.tri([Math.cos(a + 0.6) * 0.9, 1.6 + k * 0.3, Math.sin(a + 0.6) * 0.9], [Math.cos(a + 1.2) * 0.5, 0, Math.sin(a + 1.2) * 0.5], [Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5], "#cccccc"); } return b.build(); }
const groundCover = [];   // [{im, pts: [[x, z, …]]}], shaded with the sky occlusion after the bake
function scatter(geo, pts, { shadow = false, scale = () => 1, yScale = () => 1 } = {}) {
  const im = new THREE.InstancedMesh(geo, plainMat, pts.length);
  pts.forEach(([x, z, c], i) => { const s = scale(); Q.setFromAxisAngle(UP, W.rnd(0, 6.28)); im.setMatrixAt(i, M4.compose(V.set(x, W.groundH(x, z), z), Q, SC.set(s, s * yScale(), s))); im.setColorAt(i, C3.set(c)); });
  im.castShadow = shadow; im.receiveShadow = true; scene.add(im); groundCover.push({ im, pts }); return im;
}
function groundStuff() {
  const pts = [];
  for (const p of W.PADDIES) for (let z = p.z + 3; z < p.z + p.d; z += 12) for (let x = p.x + 2; x < p.x + p.w - 2; x += 3) pts.push([x + W.rnd(-0.6, 0.6), z + W.rnd(0, 4), W.pick(["#58c048", "#6cd058", "#48a838"])]);
  for (let i = 0; i < 14000; i++) { const x = W.rnd(0, W.WX), z = W.rnd(W.CLIFF_Z + 40, W.WZ); if (W.inRiver(x, z, 2) || (W.occupied(x, z, -6) && !W.inRect(x, z, W.CITY_R)) || W.flankRise(x, z) > 30) continue;
    if (W.isStreet(x, z) || W.inRect(x, z, W.PLAZA) || W.inRect(x, z, W.PALACE) || (W.inRect(x, z, W.CITY_R) && W.rand() < 0.7)) continue; pts.push([x, z, W.pick(["#4ea23a", "#62b446", "#3a8430", "#90d866"])]); }
  scatter(tuftGeometry(), pts);
  const bush = new Builder(); bush.blob(0, 1.2, 0, 1.9, 1.5, 1.9, ["#ffffff", "#e8e8e8", "#ffffff"], { seed: 3, jitter: 0.22, flat: -0.5 });
  const bp = []; for (let i = 0; i < 2600; i++) { const x = W.rnd(-60, W.WX + 60), z = W.rnd(W.CLIFF_Z + 44, W.WZ + 40); if (W.occupied(x, z, 2)) continue; bp.push([x, z, W.pick(["#3aa848", "#2e8a3a", "#4cb85a", "#58c060", "#3a9a40", "#f8b8c8", "#f0e060"])]); }
  scatter(bush.build(), bp, { shadow: true, scale: () => W.rnd(0.7, 1.5), yScale: () => W.rnd(0.7, 1.1) });
  const cab = new Builder(); cab.blob(0, 0.6, 0, 1.1, 0.8, 1.1, ["#d8d8d8", "#ffffff"], { seed: 6, jitter: 0.15, flat: -0.6 });
  const wh = new Builder(); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI, dx = Math.cos(a) * 0.35, dz = Math.sin(a) * 0.35, top = 2.6 + k * 0.4;
    wh.tri([-dx, 0, -dz], [dx, 0, dz], [dx * 0.2, top, dz * 0.2], "#e0e0e0"); wh.tri([dx * 0.2, top, dz * 0.2], [dx, 0, dz], [-dx, 0, -dz], "#c8c8c8");
    wh.tri([-dx * 0.9, top - 1.2, -dz * 0.9], [dx * 0.9, top - 1.2, dz * 0.9], [0, top + 0.6, 0], "#ffffff"); wh.tri([0, top + 0.6, 0], [dx * 0.9, top - 1.2, dz * 0.9], [-dx * 0.9, top - 1.2, -dz * 0.9], "#f0f0f0"); }
  const cl = { cabbage: ["#58c060", "#3aa848", "#7ad870"], wheat: ["#e8c048", "#d8b038", "#f0d060"] };
  for (const [k, geo] of [["cabbage", cab.build()], ["wheat", wh.build()]]) { const list = L.crops.filter((c) => c.kind === k); if (list.length) scatter(geo, list.map((c) => [c.x, c.z, W.pick(cl[k])])); }
  const rocks = rockSpots(); const rim = new THREE.InstancedMesh(rockGeometry(), plainMat, rocks.length);
  rocks.forEach((r, i) => { Q.setFromEuler(new THREE.Euler(W.rnd(-0.2, 0.2), W.rnd(0, 6.28), W.rnd(-0.2, 0.2))); rim.setMatrixAt(i, M4.compose(V.set(r.x, W.terrainH0(r.x, r.z) - 0.3 * r.s, r.z), Q, SC.set(r.s, r.s * W.rnd(0.7, 1.2), r.s))); rim.setColorAt(i, C3.setScalar(W.rnd(0.85, 1.1))); });
  rim.castShadow = rim.receiveShadow = true; scene.add(rim);
}

// ---------- actors: one InstancedMesh per look (people share a library of looks; animals / vehicles by kind)
const sim = createSim(L); city.sim = sim;
const actorMeshes = new Map(); const pickables = [];
const lookKey = (look) => (look.model ? "m:" + look.model : look.animal ? `a:${look.animal}:${look.variant}` : look);
const WHITE = new THREE.Color(1, 1, 1);
function buildActors() {
  const all = [...sim.ents.map((e) => ({ a: e, pick: true })), ...sim.pigeons.map((a) => ({ a })), ...sim.boats.map((a) => ({ a })), ...sim.ducks.map((a) => ({ a }))];
  const groups = new Map(); for (const it of all) { const k = lookKey(it.a.look); (groups.get(k) ?? groups.set(k, []).get(k)).push(it); }
  for (const [k, list] of groups) {
    const look = list[0].a.look;
    const geo = look.model ? modelGeometry(look.model) : look.animal ? animalGeometry(look.animal, look.variant) : personGeometry(look);
    const walking = !!geo.attributes.aPart;
    const variants = look.model ? list.map(() => ({ cloth: W.pick(W.CLOTHS), roof: W.pick(W.ROOFS) })) : null;
    const im = inst(geo, list.length, variants, walking ? walkMat : vmat);
    let walk = null;
    if (walking) { walk = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 2), 2); walk.setUsage(THREE.DynamicDrawUsage); im.geometry.setAttribute("aWalk", walk); }
    im.userData.walk = walk; im.castShadow = true; im.receiveShadow = !LOW; im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.userData.actors = list.map((x) => x.a);
    list.forEach((x, i) => { x.a._mesh = im; x.a._slot = i; x.a.hp = Math.random() * 6; im.setColorAt(i, WHITE); });
    scene.add(im); actorMeshes.set(k, im); if (list[0].pick) pickables.push(im);
    if (look.animal === "pigeon") { // flight frames: wings up / wings down, same slots as the folded mesh
      const poses = ["up", "down"].map((pose) => { const m = inst(animalGeometry("pigeon", look.variant, pose), list.length); m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); for (let i = 0; i < list.length; i++) m.setColorAt(i, WHITE); scene.add(m); actorMeshes.set(k + ":" + pose, m); return m; });
      for (const x of list) x.a._poses = poses;
    }
  }
}
// vehicle wheels: one InstancedMesh per wheeled model, spun by distance travelled / radius
const wheelSets = [];
function buildVehicleWheels() {
  for (const [model, spec] of Object.entries(WHEELS)) {
    const carts = sim.ents.filter((e) => e.look?.model === model); if (!carts.length) continue;
    const im = inst(wheelGeometry(spec.r), carts.length * spec.at.length);
    im.castShadow = true; im.receiveShadow = !LOW; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(im); wheelSets.push({ im, carts, offs: spec.at.map(([x, y, z]) => new THREE.Vector3(x, y, z)), r: spec.r });
  }
}
const WM = new THREE.Matrix4(), WR = new THREE.Matrix4();
function updateVehicleWheels() {
  for (const { im, carts, offs, r } of wheelSets) {
    carts.forEach((e, i) => { e._mesh.getMatrixAt(e._slot, M4); WR.makeRotationZ(-(e.roll ?? 0) / r); offs.forEach((o, k) => im.setMatrixAt(i * offs.length + k, WM.copy(M4).multiply(WR.setPosition(o)))); });
    im.instanceMatrix.needsUpdate = true;
  }
}
// ---------- baked sky occlusion (skyao.js): darkens the painted ground in alleys / courtyards and tints actors there
const AO_TINT = new THREE.Color("#5d6c9c"), AOC = new THREE.Color();
const aoDark = (o) => { const t = Math.min(1, Math.max(0, (o - 0.1) / 0.45)); return t * t * (3 - 2 * t); };
let occAt = () => 0;
const SKY = !qs.has("nosky");
function bakeSkyOcclusion() {
  if (!SKY) return;
  const tops = new Map(); for (const st of L.statics) if (!tops.has(st.model)) tops.set(st.model, columnTops(modelGeometry(st.model)));
  const Mg = 90, rect = { x: W.CITY.x0 - Mg, z: W.CITY.z0 - Mg, w: W.CITY.x1 - W.CITY.x0 + 2 * Mg, d: W.CITY.z1 - W.CITY.z0 + 2 * Mg };
  const ao = bakeSkyAO(heightMap(L.statics.map((st) => ({ ...st, ...tops.get(st.model) })), rect, 2, W.terrainH)); occAt = sampler(ao);
  const c = document.createElement("canvas"); c.width = ao.nx; c.height = ao.nz; const g = c.getContext("2d"), img = g.createImageData(ao.nx, ao.nz);
  for (let k = 0; k < ao.occ.length; k++) { const d = aoDark(ao.occ[k]) * 0.6; AOC.copy(WHITE).lerp(AO_TINT, d); img.data[k * 4] = AOC.r * 255; img.data[k * 4 + 1] = AOC.g * 255; img.data[k * 4 + 2] = AOC.b * 255; img.data[k * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const gc = tex.image.getContext("2d"); gc.save(); gc.setTransform(2, 0, 0, 2, 0, 0); gc.globalCompositeOperation = "multiply"; gc.imageSmoothingEnabled = true; gc.drawImage(c, rect.x, rect.z, ao.nx * ao.res, ao.nz * ao.res); gc.restore();
  tex.needsUpdate = true;
  for (const { im, pts } of groundCover) { pts.forEach(([x, z], i) => { im.getColorAt(i, C3); im.setColorAt(i, C3.multiply(AOC.copy(WHITE).lerp(AO_TINT, aoDark(occAt(x, z)) * 0.6))); }); im.instanceColor.needsUpdate = true; }
}
function aoTint(e, y) { const d = aoDark(occAt(e.x, e.z)) * 0.4 * Math.max(0, 1 - y / 12); return AOC.copy(WHITE).lerp(AO_TINT, d); }

// ---------- night: torches on the walls, braziers round the statue, the light map; sky, clouds, palette
let sky = null, clouds = null;
function buildNight() {
  const torches = [], H = W.WALL.h;
  for (const z of [W.WALL.n, W.WALL.s]) for (let x = W.CITY.x0 + 20; x < W.CITY.x1 - 10; x += 78) if (!(z === W.WALL.s && Math.abs(x - W.GATE_X) < 36)) torches.push([x, z, H]);
  for (const x of [W.WALL.w, W.WALL.e]) for (let z = W.CITY.z0 + 20; z < W.CITY.z1 - 10; z += 78) torches.push([x, z, H]);
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; torches.push([W.STATUE.x + Math.cos(a) * 31, W.STATUE.z + Math.sin(a) * 29, 0]); }
  const tb = new Builder(); tb.cyl(0, 0, 0, 0.35, 4, 0.3, 5, "#3a2618"); tb.cyl(0, 4, 0, 0.9, 4.6, 1.1, 6, "#4e4c58");
  const fb = new Builder(); fb.glowing("fire", () => { fb.cone(0, 4.6, 0, 0.9, 2.2, 5, "#ff9a30"); fb.cone(0.2, 4.6, 0.1, 0.5, 2.9, 4, "#ffd060"); });
  const pole = new THREE.InstancedMesh(tb.build(), plainMat, torches.length), fg = fb.build(), flame = new THREE.InstancedMesh(fg.userData.glow, glowMat(), torches.length); flame.visible = false; flame.frustumCulled = false;
  torches.forEach(([x, z, yr], i) => { const y = yr + W.terrainH(x, z), m = M4.makeTranslation(x, y, z); pole.setMatrixAt(i, m); pole.setColorAt(i, WHITE); flame.setMatrixAt(i, m); flame.setColorAt(i, WHITE); lights.push({ x, z, kind: yr ? "torch" : "brazier" }); });
  pole.castShadow = true; scene.add(pole, flame); glowSets.push({ mat: flame.material, im: flame });
  const rect = { x: 0, z: 0, w: W.WX, d: W.WZ }, lm = new THREE.CanvasTexture(lightMapCanvas(lights, rect, 2));
  lm.flipY = false; lm.colorSpace = THREE.NoColorSpace; lm.minFilter = THREE.LinearFilter; lm.generateMipmaps = false;
  nightU.uLightMap.value = lm; nightU.uLightRect.value.set(rect.x, rect.z, rect.w, rect.d);
  { const gw = Math.ceil(rect.w / 4), gd = Math.ceil(rect.d / 4), gd8 = new Uint8Array(gw * gd);
    for (let j = 0; j < gd; j++) for (let i = 0; i < gw; i++) gd8[j * gw + i] = Math.min(255, Math.round(W.terrainH(rect.x + i * 4 + 2, rect.z + j * 4 + 2) / 4));
    const gt = new THREE.DataTexture(gd8, gw, gd, THREE.RedFormat, THREE.UnsignedByteType); gt.minFilter = gt.magFilter = THREE.LinearFilter; gt.needsUpdate = true; nightU.uGroundMap.value = gt; }
  sky = buildSky(); scene.add(sky.group);
  clouds = buildClouds(W); clouds.mat.userData.distDark = true; scene.add(clouds.group);
  city.nightLights = lights.length;
}
const LD = new THREE.Vector3();
let lastTod = -1;
function applySky(t) {
  const st = skyState(t); city.skyState = st;
  scene.fog.color.copy(st.hor).lerp(st.fog, 0.5);
  scene.fog.near = 1500 - 600 * st.night; scene.fog.far = 4200 - 800 * st.night;
  hemi.color.copy(st.hs); hemi.groundColor.copy(st.hg); hemi.intensity = st.hi;
  sun.color.copy(st.sun); sun.intensity = st.si; fill.intensity = st.fi; LD.copy(st.dir);
  renderer.toneMappingExposure = st.ex;
  nightU.uNight.value = st.night;
  for (const g of glowSets) { g.im.visible = st.night > 0.01; g.mat.color.setScalar(1.7 * st.night); }
  bloom.enabled = st.night > 0.02; bloom.strength = 0.85 * st.night;
  sky?.set(st, t); water.setNight(st.night);
  if (clouds) clouds.mat.emissive.copy(st.hor).multiplyScalar(0.25 + 0.2 * (1 - st.night));
  if (clockEl) { const h = Math.floor(t), m = Math.floor((t - h) * 60); clockEl.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }
}

let wheel = null, transport = null;
function buildWheel() { const holder = new THREE.Group(); holder.position.set(L.WHEEL.x + 2, 10, L.WHEEL.z); holder.rotation.y = Math.PI / 2; scene.add(holder);
  wheel = new THREE.Mesh(modelGeometry("waterwheel"), vmat); wheel.castShadow = true; holder.add(wheel); }

const HIDE = new THREE.Vector3(0, 0, 0);
function place(a, x, y, z, yaw, scale) { Q.setFromAxisAngle(UP, yaw); a._mesh.setMatrixAt(a._slot, M4.compose(V.set(x, y, z), Q, scale ? SC.set(scale, scale, scale) : HIDE)); }
function updateActors(dt) {
  for (const e of sim.ents) {
    if (e.hidden) { place(e, e.x, -50, e.z, 0, 0); continue; }
    const moved = Math.hypot(e.x - (e.px ?? e.x), e.z - (e.pz ?? e.z)); e.px = e.x; e.pz = e.z;
    e.hp += moved * (e.kind === "vehicle" ? 0.5 : 0.75);
    if (e.kind === "vehicle") e.roll = (e.roll ?? 0) + moved / (e.scale ?? 1);
    const hop = e.mv ? Math.abs(Math.sin(e.hp)) * e.hop * 0.55 * Math.min(1, 0.35 + (e.spd ?? e.speed) / e.speed * 0.65) : 0;   // a gentle bob (smaller than the voxel hop)
    e.ry = e.absY ?? W.groundH(e.x, e.z) + (e.y || 0);
    place(e, e.x, e.ry + hop, e.z, e.kind === "vehicle" ? e.yaw - Math.PI / 2 : e.yaw, e.scale ?? 1);
    const wk = e._mesh.userData.walk;
    if (wk) { const target = e.mv ? (e.kind === "person" ? 0.5 : e.kind === "vehicle" ? 0.38 : e.kind === "cow" ? 0.35 : 0.55) * Math.min(1, 0.35 + (e.spd ?? e.speed) / e.speed * 0.65) : 0;
      e.walkAmp = (e.walkAmp ?? 0) + (target - (e.walkAmp ?? 0)) * Math.min(1, dt * 8);
      wk.array[e._slot * 2] = e.hp; wk.array[e._slot * 2 + 1] = e.walkAmp; }
    e._mesh.setColorAt(e._slot, aoTint(e, e.y || 0));
  }
  for (const g of sim.pigeons) {
    const fly = g.state === "fly", flap = Math.sin(sim.time * 14 + g.phase), main = g._mesh;
    const base = fly ? (g.b0 ?? 0) + ((g.b1 ?? 0) - (g.b0 ?? 0)) * Math.min(1, g.ft) : W.groundH(g.x, g.z), y = base + g.y + (fly ? Math.abs(flap) * 0.6 : 0);
    const show = fly ? g._poses[flap > 0 ? 0 : 1] : main;
    for (const m of [main, ...g._poses]) { g._mesh = m; place(g, g.x, y, g.z, g.yaw, m === show ? 1 : 0); }
    show.setColorAt(g._slot, aoTint(g, y - base)); g._mesh = main;
  }
  for (const b of sim.boats) place(b, b.x, W.RIVER.y(b.z) - 0.85 + Math.sin(sim.time * 1.5 + b.phase) * 0.25, b.z, b.yaw, 1);
  for (const d of sim.ducks) place(d, d.x, W.RIVER.y(d.z) - 0.45 + Math.sin(sim.time * 2 + d.phase) * 0.15, d.z, d.yaw, d.k ? 0.7 : 1);
  for (const im of actorMeshes.values()) { im.instanceMatrix.needsUpdate = true; if (im.userData.walk) im.userData.walk.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  updateVehicleWheels(); water.update(sim.time); transport?.update(sim.time); clouds?.update(sim.time);
  // time of day
  if (todTarget !== null) { let d = todTarget - tod; if (d > 12) d -= 24; if (d < -12) d += 24; const step = Math.sign(d) * Math.min(Math.abs(d), dt * 7); tod = (tod + step + 24) % 24; if (Math.abs(d) < 0.01) { tod = todTarget; todTarget = null; } }
  else if (cycle) tod = (tod + dt * CYCLE_RATE) % 24;
  if (Math.abs(tod - lastTod) > 1e-4) { applySky(tod); lastTod = tod; }
  if (sky) sky.group.position.copy(camera.position);
  if (wheel) wheel.rotation.z = -sim.time * 0.8;
}

// ---------- interaction: click to follow, WASD to pan, census + info HUD
let followed = null, downAt = null;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
renderer.domElement.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) { if (downAt && e.button === 2) { followed = null; updateInfo(); } downAt = null; return; }
  downAt = null; followed = pickAt(e.clientX, e.clientY); updateInfo();
});
function pickAt(sx, sy) {
  ndc.set((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  for (const im of pickables) im.computeBoundingSphere();
  const hit = ray.intersectObjects(pickables, false)[0]; return hit ? hit.object.userData.actors[hit.instanceId] : null;
}
city.pickAt = pickAt;
city.screenOf = (e) => { const v = new THREE.Vector3(e.x, (e.ry ?? e.y ?? 0) + 4, e.z).project(camera); return [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight)]; };
city.world = W; city.layout = L; city.camera = camera; city.controls = controls; city.scene = scene;
const keys = new Set(); addEventListener("keydown", (e) => { keys.add(e.key.toLowerCase()); if (e.key === "Escape") { followed = null; updateInfo(); } }); addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
function keyPan(dt) {
  const f = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0), r = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0); if (!f && !r) return;
  const dir = new THREE.Vector3().subVectors(controls.target, camera.position).setY(0).normalize(), side = new THREE.Vector3().crossVectors(dir, UP);
  const sp = camera.position.distanceTo(controls.target) * 0.9 * dt, mv = dir.multiplyScalar(f * sp).add(side.multiplyScalar(r * sp));
  camera.position.add(mv); controls.target.add(mv); if (followed) { followed = null; updateInfo(); }
}
const info = document.getElementById("info"), census = document.getElementById("census");
function updateInfo() { if (!followed) { info.style.opacity = 0; return; } const e = followed; info.innerHTML = `<div class="nm">${e.name}</div>${e.title ? `<div class="tt">${e.title}</div>` : ""}<div class="ac">${e.activity}</div>`; info.style.opacity = 1; }
city.follow = (e) => { followed = typeof e === "number" ? sim.ents[e] : e; updateInfo(); };

// ---------- main loop
const clock = new THREE.Clock(); let infoT = 0, fpsN = 0, fpsT = 0;
function frame(dt, render = true) {
  sim.step(dt); updateActors(dt); keyPan(dt);
  if (followed) { const t = new THREE.Vector3(followed.x, (followed.ry ?? followed.y ?? 0) + 5, followed.z), d = t.sub(controls.target).multiplyScalar(Math.min(1, dt * 4)); controls.target.add(d); camera.position.add(d); }
  controls.target.x = Math.max(-100, Math.min(W.WX + 100, controls.target.x)); controls.target.z = Math.max(-100, Math.min(W.WZ + 100, controls.target.z));
  controls.update();
  const T = controls.target; sun.target.position.set(Math.round(T.x / 4) * 4, Math.round(T.y), Math.round(T.z / 4) * 4); sun.position.copy(sun.target.position).addScaledVector(LD, 900);
  fill.target.position.copy(sun.target.position); fill.position.copy(sun.target.position).add(V.set(-LD.x * 500, 300, -LD.z * 500));
  const dist = camera.position.distanceTo(T); distFocus.value = Math.max(60, dist);
  const ext = Math.max(120, Math.min(460, dist * 0.8)); Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext }); sun.shadow.camera.updateProjectionMatrix();
  if (render) draw();
  infoT += dt; if (infoT > 0.3) { infoT = 0; if (followed) updateInfo(); const s = sim.stats(); census.innerHTML = `Out &amp; about: ${s.outside}<br>Indoors: ${s.inside}<br>Carts &amp; chairs: ${s.vehicles}`; }
  fpsN++; fpsT += dt; if (fpsT > 1) { const se = document.getElementById("stats"); if (se) se.textContent = `${Math.round(fpsN / fpsT)} fps · ${sim.stats().actors} actors`; fpsN = 0; fpsT = 0; }
}
city.advance = (secs, fps = 30) => { for (let i = 0; i < secs * fps; i++) frame(1 / fps, false); draw(); };
city.render = () => draw();
city.ao = (on) => { if (on !== undefined) { AO = !!on; syncFx(); } return AO; };
city.fx = (o = {}) => { for (const [k, v] of Object.entries(o)) FX[k]?.set(!!v); syncFx(); return Object.fromEntries(Object.entries(FX).map(([k, f]) => [k, f.get()])); };
city.time = (h) => { if (h !== undefined) { tod = ((+h % 24) + 24) % 24; todTarget = null; applySky(tod); lastTod = tod; syncFx(); } return tod; };
/** Debug: a row of every vehicle, animal and a few people on the lowland west of the gate road; camera on it. */
city.gallery = (which = "actors") => {
  const g = new THREE.Group(), x0 = 40, z0 = W.WZ - 120, y0 = 30;
  const items = which === "actors" ? [...["rickshaw", "sedan", "oxcart", "barrow", "boat"].map((m) => modelGeometry(m)), ...["dog", "cat", "pigeon", "chicken", "duck", "pig", "cow", "sheep", "crane"].map((a) => animalGeometry(a, a === "cow" ? "spotted" : 0)),
    ...["farmer", "porter", "merchant", "scholar", "official", "monk", "lady", "daoist", "performer", "kid", "soldier"].map((a) => personGeometry(sim.ents.find((e) => e.look?.arch === a)?.look ?? sim.ents.find((e) => e.kind === "person").look))]
    : which.split(",").map((m) => modelGeometry(m));
  const deck = new THREE.Mesh(new THREE.BoxGeometry(150, 2, 90), new THREE.MeshLambertMaterial({ color: "#d8d0bc" })); deck.position.set(x0 + 70, y0 - 1, z0 + 20); deck.receiveShadow = true; g.add(deck);
  let x = x0, z = z0, rowW = 0; for (const geo of items) { const bb = geo.boundingBox, w = bb.max.x - bb.min.x; if (x + w > x0 + 140) { x = x0; z += 24; }
    const mesh = new THREE.Mesh(geo, geo.attributes.aPart ? walkMat : vmat); mesh.position.set(x - bb.min.x, y0, z); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); x += w + 3; rowW = Math.max(rowW, x - x0); }
  scene.add(g); const cx = x0 + 70; placeCam([cx + 20, y0 + 70, z + 75], [cx, y0 + 2, (z0 + z) / 2 + 4]); city.render(); return g;
};
city.stats = () => ({ ...sim.stats(), simTime: sim.time, tod, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles });

(async () => {
  try {
    setStatus("BUILDING THE CITY...");
    await new Promise((r) => setTimeout(r, 30));
    groundStuff(); buildStatics(); buildActors(); buildWheel(); buildVehicleWheels();
    transport = await buildTransport(scene, W, { modelGeometry, vmat, walkMat, animalGeometry, inst });
    bakeSkyOcclusion(); buildNight(); addDistanceDarkening(scene); applySky(tod); lastTod = tod;
    setView(qs.get("view") ?? "town");
    if (qs.get("t")) city.advance(+qs.get("t"));
    document.getElementById("loading")?.remove();
    city.ready = true;
    const loop = () => { requestAnimationFrame(loop); const dt = Math.min(0.05, clock.getDelta()); if (dt > 0) frame(dt); };
    loop();
  } catch (err) { setStatus("ERROR: " + err.message); console.error(err); city.error = String(err.stack || err); }
})();
