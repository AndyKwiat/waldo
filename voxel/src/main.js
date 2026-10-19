// Jade River City — 3D voxel edition. Wiring: world layout → instanced voxel meshes → simulation loop → UI.
// Agent/debug API: window.city (see README "Agent tooling").
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import * as W from "./world.js";
import { loadModel, meshVoxels, gridFromVoxels } from "./voxels.js";
import { personVoxels, personParts, animalParts, animalVoxels, DOG_COLORS, CAT_LOOKS, PIGEON_COLORS, DUCK_LOOKS } from "./people.js";
import { createSim } from "./sim.js";
import { WHEELS, wheelModel } from "../models/recipes/props.js";
import { columnTops, heightMap, bakeSkyAO, sampler } from "./skyao.js";
import { buildWater } from "./water.js";
import { buildTransport } from "./transport.js";
import { glowGeometry, lightSources, lightMapCanvas, nightSky, celestial } from "./night.js";

const qs = new URLSearchParams(location.search);
if (qs.get("seed")) W.setSeed(+qs.get("seed"));
const LOW = qs.has("low");           // cheaper rendering for headless screenshots

// Distance darkening: before the usual sky-coloured haze, every fogged material dims (and cools) with distance from
// the camera, so the foreground pops and far districts recede. Injected into each fogged material's shader with one
// shared uniform, so it costs nothing and can be toggled live (F key / button / city.fx({dark}); `?nodark` starts off).
const distDark = { value: qs.has("nodark") ? 0 : 1 }, distFocus = { value: 300 };   // focus = distance to the orbit target (updated per frame)
// Night lighting (night.js): one top-down light map of every lantern / window / torch; lit materials add
// diffuse × light × height falloff, scaled by uNight (0 by day → no-op).
const nightU = { uNight: { value: 0 }, uLightMap: { value: null }, uLightRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uLightGain: { value: 1.15 }, uGroundMap: { value: null } };
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
          " float lo = lm.r * clamp( 1.0 - ( ry - 5.0 ) / 15.0, 0.04, 1.0 ); float hi = lm.g * ( 1.0 - smoothstep( 4.0, 30.0, abs( ry - 26.0 ) ) );" +
          " gl_FragColor.rgb += diffuseColor.rgb * vec3( 1.0, 0.62, 0.32 ) * ( lo + hi ) * uNight * uLightGain; } }\n";
      }
      sh.fragmentShader = "uniform float uDistDark;\nuniform float uDistFocus;\nuniform float uNight;\nuniform sampler2D uGroundMap;\nuniform sampler2D uLightMap;\nuniform vec4 uLightRect;\nuniform float uLightGain;\n" + (lit ? "varying vec3 vNightWP;\n" : "") +
        sh.fragmentShader.replace("#include <fog_fragment>", "#ifdef USE_FOG\n\tgl_FragColor.rgb *= mix( vec3( 1.0 ), vec3( 0.52, 0.57, 0.74 ), smoothstep( uDistFocus * 0.9, uDistFocus * 2.0, vFogDepth ) * uDistDark );\n#endif\n" + night + "#include <fog_fragment>");
    };
    m.customProgramCacheKey = () => prevKey() + "|distDark+night" + (lit ? "L" : ""); m.needsUpdate = true; } });
}
const city = (window.city = { ready: false });
const setStatus = (t) => { const el = document.getElementById("loading"); if (el) el.textContent = t; };

// ---------- renderer / scene / camera
const renderer = new THREE.WebGLRenderer({ antialias: !LOW, preserveDrawingBuffer: true });
renderer.setPixelRatio(LOW ? 1 : Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !qs.has("noshadow");
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#7cc6f4");   // pre-compensated for ACES tone mapping (shows as the old #a6d8f2-ish sky)
scene.fog = new THREE.Fog("#a2d6f4", 1400, 3800);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 1, 5000);
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.12, screenSpacePanning: false, maxPolarAngle: 1.42, minDistance: 12, maxDistance: 1600, zoomSpeed: 1.2 });
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
// Lighting: warm key sun + cool sky fill from the opposite side (two-tone, cartoony) + a dimmer hemisphere ambient,
// so shadowed sides read blue-ish instead of flat grey. Ambient occlusion comes from two places: per-vertex voxel AO
// baked into every mesh (voxels.js) and screen-space GTAO (below) for larger contact shadows between objects.
const hemi = new THREE.HemisphereLight("#dcecff", "#7a6a4a", 0.8); scene.add(hemi);
const fill = new THREE.DirectionalLight("#9cc4ff", 0.55); fill.position.set(300, 260, -260); scene.add(fill);
const sun = new THREE.DirectionalLight("#ffe8c8", 3.0); sun.castShadow = true;
sun.shadow.mapSize.set(LOW ? 2048 : 4096, LOW ? 2048 : 4096); Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, near: 10, far: 1400 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;

// Post-processing: scene → GTAO (screen-space ambient occlusion, denoised) → output (tone mapping + sRGB).
// `?noao` (or the O key) renders straight to the screen instead. The composer target keeps 4× MSAA.
let AO = !qs.has("noao");
let night = qs.has("night") ? 1 : 0, nightTarget = night;   // 0 = day … 1 = night (eased); N key / NIGHT button / ?night
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: LOW ? 0 : 4 }));
composer.setPixelRatio(renderer.getPixelRatio());
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtao.updateGtaoMaterial({ radius: 6, distanceExponent: 1.4, thickness: 3, scale: 1.25, samples: LOW ? 8 : 16, distanceFallOff: 1 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: LOW ? 8 : 16 });
gtao.blendIntensity = 1.0;
composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0, 0.55, 0.92); bloom.enabled = false; composer.addPass(bloom);   // night glow halos
composer.addPass(new OutputPass());
renderer.info.autoReset = false;   // count every pass of a frame (stats)
renderer.shadowMap.autoUpdate = false;   // the GTAO normal pass re-renders the scene: draw the shadow map once per frame, not per pass
const draw = () => { renderer.info.reset(); renderer.shadowMap.needsUpdate = true; gtao.enabled = AO; if (AO || night > 0.01) composer.render(); else renderer.render(scene, camera); };
// Effect toggles: small buttons bottom-right + keys (O = ambient occlusion, F = distance darkening)
const FX = { night: { label: "NIGHT", key: "n", get: () => nightTarget > 0, set: (v) => { nightTarget = v ? 1 : 0; } }, ao: { label: "AO", key: "o", get: () => AO, set: (v) => { AO = v; } }, dark: { label: "DEPTH FOG", key: "f", get: () => distDark.value > 0, set: (v) => { distDark.value = v ? 1 : 0; } } };
const fxBar = document.getElementById("fx");
for (const [k, f] of Object.entries(FX)) { const b = document.createElement("button"); b.dataset.fx = k; b.title = `toggle (${f.key.toUpperCase()} key)`; b.onclick = () => { f.set(!f.get()); syncFx(); }; fxBar?.appendChild(b); }
function syncFx() { for (const b of fxBar?.children ?? []) { const f = FX[b.dataset.fx]; b.textContent = `${f.label} ${f.get() ? "ON" : "OFF"}`; b.classList.toggle("on", f.get()); } }
syncFx();
addEventListener("keydown", (e) => { if (e.metaKey || e.ctrlKey || e.altKey) return; for (const f of Object.values(FX)) if (e.key.toLowerCase() === f.key) { f.set(!f.get()); syncFx(); } });
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
  upland: () => [[1300, 70, 640], [1500, -40, 360]],   // the zig-zag stair up to the hill village (target y is ground-relative)
  gondola2: () => [[W.GX2 - 140, 110, W.G2.mid.z + 160], [W.GX2, 60, W.G2.mid.z - 40]],
  shrine: () => [[W.SHRINE.x + 120, 60, W.SHRINE.z + 130], [W.SHRINE.x + 20, 10, W.SHRINE.z + 20]],
  falls: () => [[W.RX + 200, 180, W.CITY.z0 + 230], [W.RX, 130, W.CLIFF_Z - 20]],
  mountain: () => [[W.CITY.x1 + 500, 650, W.CITY.z1 + 700], [W.CENTER.x + 80, -60, W.CENTER.z - 120]],
  mill: () => [[L.WHEEL.x - 50, 40, L.WHEEL.z + 70], [L.WHEEL.x + 10, 4, L.WHEEL.z]],
  paddies: () => [[W.GATE_X - 160, 70, W.WALL_S + 150], [W.GATE_X - 160, 0, W.WALL_S + 55]],
  pagoda: () => { const b = W.block(...W.PAGODA_BLOCK); return [[b.x + 120, 80, b.z + 170], [b.x + 42, 10, b.z + 40]]; },
  statue: () => [[W.STATUE.x + 2, 17, W.STATUE.z + 150], [W.STATUE.x - 2, 44, W.STATUE.z]],   // up the south avenue at Jupiter, who faces it
};
// small camera-view buttons (bottom-left); "fort" is an alias of "palace" so it gets no button
const viewBar = document.getElementById("views");
for (const name of Object.keys(VIEWS).filter((n) => n !== "fort")) {
  const b = document.createElement("button"); b.textContent = name; b.dataset.view = name;
  b.onclick = () => setView(name); viewBar.appendChild(b);
}
/** Places the camera; lets it look up from below the target (statue view) by relaxing the orbit's polar limit just enough. */
function placeCam(p, t) {
  const polar = Math.acos(Math.max(-1, Math.min(1, (p[1] - t[1]) / Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]))));
  controls.maxPolarAngle = Math.max(1.42, polar + 0.02);
  camera.position.set(...p); controls.target.set(...t); followed = null; controls.update();
}
function setView(name) {
  for (const b of viewBar.children) b.classList.toggle("on", b.dataset.view === name); const v = VIEWS[name] ?? VIEWS.town; const [p, t] = v();
  const g = W.groundH(t[0], t[2]); placeCam([p[0], p[1] + g, p[2]], [t[0], t[1] + g, t[2]]); }   // views are relative to the ground under their target
city.view = setView;
city.cam = (pos, target) => placeCam(pos, target);

// ---------- static world
const vmat = new THREE.MeshLambertMaterial({ vertexColors: true });
// Walk animation for people / dogs / cats: limbs tagged per vertex (aPart = [k, pivotY, pivotZ], see meshVoxels opts.parts)
// swing about the x axis at their hip/shoulder by sin(phase) × amplitude, from a per-instance aWalk = [phase, amp].
const walkMat = new THREE.MeshLambertMaterial({ vertexColors: true });
walkMat.onBeforeCompile = (sh) => {
  sh.vertexShader = "attribute vec3 aPart;\nattribute vec2 aWalk;\n" + sh.vertexShader
    // |k| 1 = leg, 2 = arm (0.7×): swing about x (models facing +z); |k| 3 = leg of a model facing +x (vehicles): swing about z,
    // and the pivot's third component is x instead of z.
    .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n\tfloat wK = abs( aPart.x ); bool wZ = wK > 2.5;\n\tfloat wAng = aPart.x == 0.0 ? 0.0 : sign( aPart.x ) * ( wK > 1.5 && wK < 2.5 ? 0.7 : 1.0 ) * sin( aWalk.x ) * aWalk.y;\n\tfloat wc = cos( wAng ), ws = sin( wAng );\n\tobjectNormal = wZ ? vec3( objectNormal.x * wc - objectNormal.y * ws, objectNormal.x * ws + objectNormal.y * wc, objectNormal.z ) : vec3( objectNormal.x, objectNormal.y * wc - objectNormal.z * ws, objectNormal.y * ws + objectNormal.z * wc );")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n\tif ( wZ ) { vec2 wd = vec2( transformed.x - aPart.z, transformed.y - aPart.y ); transformed.x = aPart.z + wd.x * wc - wd.y * ws; transformed.y = aPart.y + wd.x * ws + wd.y * wc; }\n\telse { vec2 wd = vec2( transformed.y - aPart.y, transformed.z - aPart.z ); transformed.y = aPart.y + wd.x * wc - wd.y * ws; transformed.z = aPart.z + wd.x * ws + wd.y * wc; }");
};
walkMat.customProgramCacheKey = () => "walk";
try { W.setAvailableModels(Object.keys(await (await fetch("models/manifest.json", { cache: "no-store" })).json())); } catch {}   // optional palace models
const L = W.layout();
const tex = W.groundTexture();
// Flat ground layers are only centimetres apart, far below depth-buffer precision at city distances, so each
// layer gets a polygon offset (in depth units, so it holds at any distance): outer grass < painted ground < ribbons.
const layer = (n) => ({ polygonOffset: true, polygonOffsetFactor: -n, polygonOffsetUnits: -4 * n });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(W.WX, W.WZ), new THREE.MeshLambertMaterial({ map: tex, ...layer(1) }));
ground.rotation.x = -Math.PI / 2; ground.position.set(W.WX / 2, 0, W.WZ / 2); ground.receiveShadow = true; scene.add(ground);
const outer = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshLambertMaterial({ color: "#5fae44", ...layer(-1) }));
outer.rotation.x = -Math.PI / 2; outer.position.set(W.WX / 2, -0.3, W.WZ / 2); scene.add(outer);
// the mountainside: terraces, retaining walls, slopes, the cliff and plateau (one greedy voxel-column mesh per region)
function brickTexture() { // tileable dressed-stone courses for the retaining walls (6 × 3 voxels per tile)
  const c = document.createElement("canvas"); c.width = 48; c.height = 24; const g = c.getContext("2d"); g.fillStyle = "#f2efe8"; g.fillRect(0, 0, 48, 24);
  g.fillStyle = "#a8a296"; for (let y = 0; y < 24; y += 8) { g.fillRect(0, y, 48, 1); for (let x = (y / 8) % 2 ? 12 : 0; x < 48; x += 24) g.fillRect(x, y, 1, 8); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`; g.fillRect(Math.random() * 48, Math.random() * 24, 3, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1, 1); return t;
}
const TG = W.terrainGeometry();
const brickMat = new THREE.MeshLambertMaterial({ map: brickTexture(), vertexColors: true });
const terrainMain = new THREE.Mesh(TG.main, [new THREE.MeshLambertMaterial({ map: tex }), brickMat, vmat]); terrainMain.receiveShadow = true; terrainMain.castShadow = true; scene.add(terrainMain);
for (const g of TG.outer) { const m = new THREE.Mesh(g, [vmat, brickMat, vmat]); m.receiveShadow = true; scene.add(m); }
/** Flat ribbon following f(x) (river, roads) — used to carry the river and roads past the painted ground into the haze. */
function ribbon(x0, x1, zc, hw, y, color, opts = {}) {
  const pos = [], idx = []; for (let x = x0, i = 0; x <= x1; x += 4, i++) { const z = zc(x); pos.push(x, y, z - hw, x, y, z + hw); if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, ...opts })); m.receiveShadow = true; scene.add(m); return m;
}
for (const r of W.ROADS) if (r.w > r.d) for (const [a, b] of [[-3000, 0], [W.WX, W.WX + 3000]]) ribbon(a, b, () => r.z + r.d / 2, r.d / 2, 0.03, "#c8a878", layer(3));
{ const r = W.ROADS[0]; const g = new THREE.Mesh(new THREE.PlaneGeometry(r.w, 3000), new THREE.MeshLambertMaterial({ color: "#c8a878", ...layer(3) })); g.rotation.x = -Math.PI / 2; g.position.set(r.x + r.w / 2, 0.03, W.WZ + 1500); scene.add(g); }
const water = buildWater(scene, W);
const geoCache = new Map();
// Models with walking parts: the ox pulling the ox cart (legs at x 20/26, z 11/16, y 0–4 in the 32-grid; faces +x → k ±3).
const MODEL_PARTS = { oxcart: (x, y, z) => { if (y > 4 || !((x === 20 || x === 26) && (z === 11 || z === 16))) return null; return [(x === 20) === (z === 11) ? 3 : -3, 5, x + 0.5 - 16]; } };
async function modelGeometry(model, remap, key) {
  if (!geoCache.has(key)) geoCache.set(key, loadModel(model).then((g) => meshVoxels(g, { remap: remap ?? {}, pivot: model === "waterwheel" || model === "pulley_wheel" ? "center" : "base", parts: MODEL_PARTS[model] })));
  return geoCache.get(key);
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
async function buildStatics() {
  const groups = new Map(); for (const s of L.statics) (groups.get(s.key) ?? groups.set(s.key, []).get(s.key)).push(s);
  await Promise.all([...groups].map(async ([key, list]) => {
    const geo = await modelGeometry(list[0].model, list[0].remap, key);
    const im = new THREE.InstancedMesh(geo, vmat, list.length); im.castShadow = im.receiveShadow = true;
    list.forEach((s, i) => { Q.setFromAxisAngle(UP, s.rot * Math.PI / 2); im.setMatrixAt(i, M4.compose(V.set(s.x, s.y, s.z), Q, s.scale ? SC.set(...s.scale) : SC.set(1, 1, 1))); });
    im.computeBoundingSphere(); scene.add(im);
  }));
}
function tufts() { // little 3D grass tufts and rice seedlings to break up the flat ground
  const geo = meshVoxels(gridFromVoxels([[8, 0, 8, "#ffffff"], [8, 1, 8, "#ffffff"], [7, 0, 8, "#ffffff"], [9, 0, 9, "#ffffff"]], 16));
  const pts = [];
  for (const p of W.PADDIES) for (let z = p.z + 3; z < p.z + p.d; z += 12) for (let x = p.x + 2; x < p.x + p.w - 2; x += 3) pts.push([x + W.rnd(-0.6, 0.6), z + W.rnd(0, 4), W.pick(["#58c048", "#6cd058", "#48a838"])]);
  for (let i = 0; i < 16000; i++) { const x = W.rnd(0, W.WX), z = W.rnd(W.CLIFF_Z + 40, W.WZ); if (W.inRiver(x, z, 2) || (W.occupied(x, z, -6) && !W.inRect(x, z, W.CITY_R))) continue;
    if (W.isStreet(x, z) || W.inRect(x, z, W.PLAZA) || W.inRect(x, z, W.PALACE) || (W.inRect(x, z, W.CITY_R) && !W.isStreet(x, z) && chance3())) continue; pts.push([x, z, W.pick(["#4ea23a", "#62b446", "#3a8430", "#90d866"])]); }
  const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), pts.length); const col = new THREE.Color();
  pts.forEach(([x, z, c], i) => { Q.setFromAxisAngle(UP, W.rnd(0, 6.28)); im.setMatrixAt(i, M4.compose(V.set(x, W.groundH(x, z), z), Q, SC.set(1, 1, 1))); im.setColorAt(i, col.set(c)); });
  im.receiveShadow = true; scene.add(im); groundCover.push({ im, pts });
}
const chance3 = () => W.rand() < 0.7;
function bushes() { // leafy bushes and flower clumps scattered over the countryside
  const vox = []; for (const [x, y, z] of [[7, 0, 7], [8, 0, 7], [9, 0, 7], [7, 0, 8], [8, 0, 8], [9, 0, 8], [8, 0, 9], [7, 0, 9], [8, 1, 7], [8, 1, 8], [7, 1, 8], [9, 1, 8], [8, 2, 8]]) vox.push([x, y, z, "#ffffff"]);
  const pts = []; for (let i = 0; i < 2600; i++) { const x = W.rnd(-60, W.WX + 60), z = W.rnd(W.CLIFF_Z + 44, W.WZ + 40); if (W.occupied(x, z, 2)) continue; pts.push([x, z, W.pick(["#3aa848", "#2e8a3a", "#4cb85a", "#58c060", "#3a9a40", "#f8b8c8", "#f0e060"])]); }
  const im = new THREE.InstancedMesh(meshVoxels(gridFromVoxels(vox, 16)), new THREE.MeshLambertMaterial({ vertexColors: true }), pts.length), col = new THREE.Color();
  pts.forEach(([x, z, c], i) => { const sc = W.rnd(0.7, 1.5); Q.setFromAxisAngle(UP, W.rnd(0, 6.28)); im.setMatrixAt(i, M4.compose(V.set(x, W.groundH(x, z), z), Q, SC.set(sc, sc * W.rnd(0.7, 1.1), sc))); im.setColorAt(i, col.set(c)); });
  im.castShadow = true; im.receiveShadow = true; scene.add(im); groundCover.push({ im, pts });
}
function crops() { // 3D crop rows on the farm fields: cabbages and wheat
  const kinds = { cabbage: [[[8, 0, 8], [9, 0, 8], [8, 0, 9], [9, 0, 9], [8, 1, 8], [9, 1, 9], [8, 1, 9]], ["#58c060", "#3aa848", "#7ad870"]], wheat: [[[8, 0, 8], [8, 1, 8], [8, 2, 8], [8, 3, 8], [8, 3, 9]], ["#e8c048", "#d8b038", "#f0d060"]] };
  const col = new THREE.Color();
  for (const [k, [vox, cols]] of Object.entries(kinds)) { const list = L.crops.filter((c) => c.kind === k); if (!list.length) continue;
    const im = new THREE.InstancedMesh(meshVoxels(gridFromVoxels(vox.map((v) => [...v, "#ffffff"]), 16)), new THREE.MeshLambertMaterial({ vertexColors: true }), list.length);
    list.forEach((c, i) => { Q.setFromAxisAngle(UP, W.rnd(0, 6.28)); im.setMatrixAt(i, M4.compose(V.set(c.x, W.groundH(c.x, c.z), c.z), Q, SC.set(1, 1, 1))); im.setColorAt(i, col.set(W.pick(cols))); });
    im.receiveShadow = true; im.castShadow = k === "wheat"; scene.add(im); }
}

// ---------- actors: one InstancedMesh per look (people share a library of looks; animals/vehicles by kind)
const sim = createSim(L); city.sim = sim;
const actorMeshes = new Map(); const pickables = [];
const lookKey = (look) => (look.model ? "m:" + look.model : look.animal ? `a:${look.animal}:${look.variant}` : look);
function animalGrid(look, pose) {
  const k = look.animal, v = look.variant;
  const c = k === "dog" ? DOG_COLORS[v % DOG_COLORS.length] : k === "cat" ? CAT_LOOKS[v % CAT_LOOKS.length] : k === "pigeon" ? PIGEON_COLORS[v % PIGEON_COLORS.length] : k === "duck" ? DUCK_LOOKS[v % DUCK_LOOKS.length] : k === "chicken" ? ["#fff4d8", "#c88a5a", "#3a3440", "#f0b830"][v % 4] : v; // cows/sheep carry their colour in the variant
  return gridFromVoxels(animalVoxels(k, c, pose), 16);
}
async function buildActors() {
  const all = [...sim.ents.map((e) => ({ a: e, pick: true })), ...sim.pigeons.map((a) => ({ a })), ...sim.boats.map((a) => ({ a })), ...sim.ducks.map((a) => ({ a }))];
  const groups = new Map(); for (const it of all) { const k = lookKey(it.a.look); (groups.get(k) ?? groups.set(k, []).get(k)).push(it); }
  await Promise.all([...groups].map(async ([k, list]) => {
    const look = list[0].a.look;
    const parts = look.model ? MODEL_PARTS[look.model] ?? null : look.animal ? animalParts(look.animal) : personParts(look);
    const geo = look.model ? await modelGeometry(look.model, null, "m:" + look.model) : meshVoxels(look.animal ? animalGrid(look) : gridFromVoxels(personVoxels(look), 16), { pivot: "base", parts: parts ?? undefined });
    let walk = null;
    if (parts) { walk = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 2), 2); walk.setUsage(THREE.DynamicDrawUsage); geo.setAttribute("aWalk", walk); }
    const im = new THREE.InstancedMesh(geo, walk ? walkMat : vmat, list.length); im.userData.walk = walk; im.castShadow = true; im.receiveShadow = !LOW; im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.userData.actors = list.map((x) => x.a);
    list.forEach((x, i) => { x.a._mesh = im; x.a._slot = i; x.a.hp = Math.random() * 6; im.setColorAt(i, WHITE); });
    scene.add(im); actorMeshes.set(k, im); if (list[0].pick) pickables.push(im);
    if (look.animal === "pigeon") { // flight frames: wings up / wings down, same slots as the folded mesh
      const poses = ["up", "down"].map((pose) => { const m = new THREE.InstancedMesh(meshVoxels(animalGrid(look, pose), { pivot: "base" }), vmat, list.length);
        m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); for (let i = 0; i < list.length; i++) m.setColorAt(i, WHITE); scene.add(m); actorMeshes.set(k + ":" + pose, m); return m; });
      for (const x of list) x.a._poses = poses;
    }
  }));
}
// Vehicle wheels: one InstancedMesh per wheeled model (WHEELS in props.js), spun by distance travelled / radius.
const wheelSets = [];
function buildVehicleWheels() {
  for (const [model, spec] of Object.entries(WHEELS)) {
    const carts = sim.ents.filter((e) => e.look?.model === model); if (!carts.length) continue;
    const g = wheelModel(spec.r), grid = gridFromVoxels([...g.v].map(([k, c]) => [k % g.size, Math.floor(k / (g.size * g.size)), Math.floor(k / g.size) % g.size, c]), g.size);
    const im = new THREE.InstancedMesh(meshVoxels(grid, { pivot: "center" }), vmat, carts.length * spec.at.length);
    im.castShadow = true; im.receiveShadow = !LOW; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const offs = spec.at.map(([x, y, z]) => new THREE.Vector3(x + 0.5 - spec.grid / 2, y + 0.5, z + 0.5 - spec.grid / 2));
    scene.add(im); wheelSets.push({ im, carts, offs, r: spec.r });
  }
}
const WM = new THREE.Matrix4(), WR = new THREE.Matrix4();
function updateVehicleWheels() {
  for (const { im, carts, offs, r } of wheelSets) {
    carts.forEach((e, i) => {
      e._mesh.getMatrixAt(e._slot, M4);
      WR.makeRotationZ(-(e.roll ?? 0) / r);   // forward is +x in model space, so rolling turns the wheel about z
      offs.forEach((o, k) => im.setMatrixAt(i * offs.length + k, WM.copy(M4).multiply(WR.setPosition(o))));
    });
    im.instanceMatrix.needsUpdate = true;
  }
}
// ---------- baked sky occlusion (skyao.js): darkens the ground in alleys / narrow streets / courtyards and tints
// people and animals walking through them. Screen-space GTAO handles the small-scale contact shading on top.
const AO_TINT = new THREE.Color("#5d6c9c"), WHITE = new THREE.Color(1, 1, 1), AOC = new THREE.Color();
const aoDark = (o) => { const t = Math.min(1, Math.max(0, (o - 0.1) / 0.45)); return t * t * (3 - 2 * t); };   // smoothstep: open streets stay bright
let occAt = () => 0;
const groundCover = [];   // grass tufts / bushes: [{im, pts: [[x, z, …]]}], shaded with the ground after the bake
const SKY = !qs.has("nosky");
async function bakeSkyOcclusion() {
  if (!SKY) return;
  const tops = new Map();
  for (const st of L.statics) if (!tops.has(st.model)) { const g = await loadModel(st.model); tops.set(st.model, { tops: columnTops(g), size: g.size }); }
  const M = 90, rect = { x: W.CITY.x0 - M, z: W.CITY.z0 - M, w: W.CITY.x1 - W.CITY.x0 + 2 * M, d: W.CITY.z1 - W.CITY.z0 + 2 * M };
  const ao = bakeSkyAO(heightMap(L.statics.map((st) => ({ ...st, ...tops.get(st.model) })), rect, 2, W.terrainH)); occAt = sampler(ao);
  // multiply a soft, cool shadow layer into the painted ground (bilinear upscale from the 2-unit bake)
  const c = document.createElement("canvas"); c.width = ao.nx; c.height = ao.nz; const g = c.getContext("2d"), img = g.createImageData(ao.nx, ao.nz);
  for (let k = 0; k < ao.occ.length; k++) { const d = aoDark(ao.occ[k]) * 0.65; AOC.copy(WHITE).lerp(AO_TINT, d); img.data[k * 4] = AOC.r * 255; img.data[k * 4 + 1] = AOC.g * 255; img.data[k * 4 + 2] = AOC.b * 255; img.data[k * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const gc = tex.image.getContext("2d"); gc.save(); gc.globalCompositeOperation = "multiply"; gc.imageSmoothingEnabled = true; gc.drawImage(c, rect.x, rect.z, ao.nx * ao.res, ao.nz * ao.res); gc.restore();
  tex.needsUpdate = true;
  const col = new THREE.Color();
  for (const { im, pts } of groundCover) { pts.forEach(([x, z], i) => { im.getColorAt(i, col); im.setColorAt(i, col.multiply(AOC.copy(WHITE).lerp(AO_TINT, aoDark(occAt(x, z)) * 0.65))); }); im.instanceColor.needsUpdate = true; }
}
/** Actor tint from the sky occlusion where it stands (less when up on a wall or roof). */
function aoTint(e, y) { const d = aoDark(occAt(e.x, e.z)) * 0.45 * Math.max(0, 1 - y / 12); return AOC.copy(WHITE).lerp(AO_TINT, d); }

// ---------- night mode: glowing lanterns/windows, torch-lit walls, warm light pools (light map), moon + night sky
const DAY = { bg: new THREE.Color("#7cc6f4"), fog: new THREE.Color("#a2d6f4"), hemiS: new THREE.Color("#dcecff"), hemiG: new THREE.Color("#7a6a4a"), sun: new THREE.Color("#ffe8c8") };
const NGT = { bg: new THREE.Color("#070c20"), fog: new THREE.Color("#18234a"), hemiS: new THREE.Color("#3a4c86"), hemiG: new THREE.Color("#181822"), sun: new THREE.Color("#9fb6ff") };
const glowMats = []; let sky = null, sunMoon = null;
const HOUSE_MODELS = new Set(["home1", "home2", "shop", "inn", "manor", "hall_house", "compound"]);
async function buildNight() {
  const lights = [], byModel = new Map();
  for (const st of L.statics) (byModel.get(st.model) ?? byModel.set(st.model, []).get(st.model)).push(st);
  for (const [model, list] of byModel) {
    const g = await loadModel(model), geo = glowGeometry(g); if (!geo) continue;
    const ls = lightSources(g);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const im = new THREE.InstancedMesh(geo, mat, list.length); im.frustumCulled = false; im.visible = false;
    // not every household is still up: a stable per-building chance of being lit, and a little brightness variety
    const pLit = HOUSE_MODELS.has(model) ? 0.45 : model === "lantern_post" ? 0.5 : 0.8, col = new THREE.Color();
    list.forEach((st, i) => {
      Q.setFromAxisAngle(UP, st.rot * Math.PI / 2); im.setMatrixAt(i, M4.compose(V.set(st.x, st.y, st.z), Q, SC.set(1, 1, 1)));
      const h = Math.abs(Math.sin(st.x * 12.9898 + st.z * 78.233) * 43758.5453) % 1, lit = h < pLit, gain = lit ? 0.75 + 0.35 * (h / pLit) : 0;
      im.setColorAt(i, col.setScalar(gain)); if (!lit) return;
      const a = st.rot * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      for (const l of ls) lights.push({ x: st.x + l.x * ca + l.z * sa, z: st.z - l.x * sa + l.z * ca, kind: l.kind, gain });
    });
    scene.add(im); glowMats.push({ mat, im });
  }
  // torches along the city wall walkways (skipping the south gate)
  const torches = [], H = W.WALL.h;
  for (const z of [W.WALL.n, W.WALL.s]) for (let x = W.CITY.x0 + 20; x < W.CITY.x1 - 10; x += 78) if (!(z === W.WALL.s && Math.abs(x - W.GATE_X) < 36)) torches.push([x, z]);
  for (const x of [W.WALL.w, W.WALL.e]) for (let z = W.CITY.z0 + 20; z < W.CITY.z1 - 10; z += 78) torches.push([x, z]);
  for (const t of torches) t.push(H);
  // braziers around the statue's pedestal light the figure from below (the high light band reaches its body)
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; torches.push([W.STATUE.x + Math.cos(a) * 31, W.STATUE.z + Math.sin(a) * 29, 0]); }
  const pole = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 4, 0.7), new THREE.MeshLambertMaterial({ color: "#3a2618" }), torches.length);
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.1, 0.35), fog: false, transparent: true, opacity: 0 });
  const flame = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 1.6, 1.4), flameMat, torches.length); flame.visible = false;
  torches.forEach(([x, z, yr], i) => { const y = yr + W.terrainH(x, z); pole.setMatrixAt(i, M4.makeTranslation(x, y + 2, z)); flame.setMatrixAt(i, M4.makeTranslation(x, y + 4.8, z)); lights.push({ x, z, kind: y ? "torch" : "brazier" }); });
  scene.add(pole, flame); glowMats.push({ mat: flameMat, im: flame, opacityMode: true });
  // the light map covers the whole world
  const rect = { x: 0, z: 0, w: W.WX, d: W.WZ }, lm = new THREE.CanvasTexture(lightMapCanvas(lights, rect, 2));
  lm.flipY = false; lm.colorSpace = THREE.NoColorSpace; lm.minFilter = THREE.LinearFilter; lm.generateMipmaps = false;
  nightU.uLightMap.value = lm; nightU.uLightRect.value.set(rect.x, rect.z, rect.w, rect.d);
  { const gw = Math.ceil(rect.w / 4), gd = Math.ceil(rect.d / 4), gd8 = new Uint8Array(gw * gd);   // ground height (÷256) so light heights are relative to the terrain
    for (let j = 0; j < gd; j++) for (let i = 0; i < gw; i++) gd8[j * gw + i] = Math.min(255, Math.round(W.terrainH(rect.x + i * 4 + 2, rect.z + j * 4 + 2) / 4));
    const gt = new THREE.DataTexture(gd8, gw, gd, THREE.RedFormat, THREE.UnsignedByteType); gt.minFilter = gt.magFilter = THREE.LinearFilter; gt.needsUpdate = true; nightU.uGroundMap.value = gt; }
  sky = nightSky(new THREE.Vector3(-260, 420, 220)); scene.add(sky.group);
  sunMoon = celestial(new THREE.Vector3(-260, 420, 220)); scene.add(sunMoon.group);
  city.nightLights = lights.length;
}
function applyNight(n) {
  scene.background.copy(DAY.bg).lerp(NGT.bg, n); scene.fog.color.copy(DAY.fog).lerp(NGT.fog, n);
  scene.fog.near = 1400 - 700 * n; scene.fog.far = 3800 - 900 * n;
  hemi.color.copy(DAY.hemiS).lerp(NGT.hemiS, n); hemi.groundColor.copy(DAY.hemiG).lerp(NGT.hemiG, n); hemi.intensity = 0.8 - 0.3 * n;
  sun.color.copy(DAY.sun).lerp(NGT.sun, n); sun.intensity = 3.0 - 2.35 * n; fill.intensity = 0.55 - 0.42 * n;
  renderer.toneMappingExposure = 1.12 + 0.1 * n;
  nightU.uNight.value = n;
  for (const g of glowMats) { g.im.visible = n > 0.01; if (g.opacityMode) g.mat.opacity = n; else g.mat.color.setScalar(1.6 * n); }
  bloom.enabled = n > 0.01; bloom.strength = 0.9 * n;
  sky?.set(n); sunMoon?.set(n); water.setNight(n);
}

let wheel = null, transport = null;
async function buildWheel() { // the mill wheel stands in the south-flowing river: its plane is y–z, turning about x
  const holder = new THREE.Group(); holder.position.set(L.WHEEL.x + 2, 10, L.WHEEL.z); holder.rotation.y = Math.PI / 2; scene.add(holder);
  wheel = new THREE.Mesh(await modelGeometry("waterwheel", null, "waterwheel"), vmat); wheel.castShadow = true; holder.add(wheel); }

const HIDE = new THREE.Vector3(0, 0, 0);
function place(a, x, y, z, yaw, scale) { Q.setFromAxisAngle(UP, yaw); a._mesh.setMatrixAt(a._slot, M4.compose(V.set(x, y, z), Q, scale ? SC.set(scale, scale, scale) : HIDE)); }
function updateActors(dt) {
  for (const e of sim.ents) {
    if (e.hidden) { place(e, e.x, -50, e.z, 0, 0); continue; }
    const moved = Math.hypot(e.x - (e.px ?? e.x), e.z - (e.pz ?? e.z)); e.px = e.x; e.pz = e.z;
    e.hp += moved * (e.kind === "vehicle" ? 0.5 : 0.75);
    if (e.kind === "vehicle") e.roll = (e.roll ?? 0) + moved / (e.scale ?? 1);
    const hop = e.mv ? Math.abs(Math.sin(e.hp)) * e.hop * Math.min(1, 0.35 + (e.spd ?? e.speed) / e.speed * 0.65) : 0;   // slower walkers bob less
    e.ry = e.absY ?? W.groundH(e.x, e.z) + (e.y || 0);   // riders of the gondola / lift carry an absolute height
    place(e, e.x, e.ry + hop, e.z, e.kind === "vehicle" ? e.yaw - Math.PI / 2 : e.yaw, e.scale ?? 1);
    const wk = e._mesh.userData.walk;
    if (wk) { // legs pass on landing, spread at the top of each hop; eases in/out as they start and stop walking
      const target = e.mv ? (e.kind === "person" ? 0.4 : e.kind === "vehicle" ? 0.38 : e.kind === "cow" ? 0.35 : 0.55) * Math.min(1, 0.35 + (e.spd ?? e.speed) / e.speed * 0.65) : 0;
      e.walkAmp = (e.walkAmp ?? 0) + (target - (e.walkAmp ?? 0)) * Math.min(1, dt * 8);
      wk.array[e._slot * 2] = e.hp; wk.array[e._slot * 2 + 1] = e.walkAmp;
    }
    e._mesh.setColorAt(e._slot, aoTint(e, e.y || 0));
  }
  for (const g of sim.pigeons) { // folded on the ground; flying birds alternate the wings-up / wings-down meshes
    const fly = g.state === "fly", flap = Math.sin(sim.time * 14 + g.phase), main = g._mesh;
    const base = fly ? (g.b0 ?? 0) + ((g.b1 ?? 0) - (g.b0 ?? 0)) * Math.min(1, g.ft) : W.groundH(g.x, g.z), y = base + g.y + (fly ? Math.abs(flap) * 0.6 : 0);
    const show = fly ? g._poses[flap > 0 ? 0 : 1] : main;
    for (const m of [main, ...g._poses]) { g._mesh = m; place(g, g.x, y, g.z, g.yaw, m === show ? 1 : 0); }
    show.setColorAt(g._slot, aoTint(g, y - base));
    g._mesh = main;
  }
  for (const b of sim.boats) place(b, b.x, W.RIVER.y(b.z) - 0.85 + Math.sin(sim.time * 1.5 + b.phase) * 0.25, b.z, b.yaw, 1);
  for (const d of sim.ducks) place(d, d.x, W.RIVER.y(d.z) - 0.45 + Math.sin(sim.time * 2 + d.phase) * 0.15, d.z, d.yaw, d.k ? 0.7 : 1);
  for (const im of actorMeshes.values()) { im.instanceMatrix.needsUpdate = true; if (im.userData.walk) im.userData.walk.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  updateVehicleWheels(); water.update(sim.time); transport?.update(sim.time);
  if (night !== nightTarget) { night += (nightTarget - night) * Math.min(1, dt * 1.6); if (Math.abs(nightTarget - night) < 0.004) night = nightTarget; applyNight(night); }
  if (sky) sky.group.position.copy(camera.position);
  if (sunMoon) sunMoon.group.position.copy(camera.position);
  if (wheel) wheel.rotation.z = -sim.time * 0.8;
}

// ---------- interaction: click to follow, WASD to pan, census + info HUD
let followed = null, downAt = null;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
renderer.domElement.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) { if (downAt && e.button === 2) { followed = null; updateInfo(); } downAt = null; return; } // orbiting keeps following; panning stops it
  downAt = null; followed = pickAt(e.clientX, e.clientY); updateInfo();
});
function pickAt(sx, sy) {
  ndc.set((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  for (const im of pickables) im.computeBoundingSphere(); // actors move, so the cached spheres go stale
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
  const T = controls.target; sun.target.position.set(Math.round(T.x / 4) * 4, Math.round(T.y), Math.round(T.z / 4) * 4); sun.position.copy(sun.target.position).add(V.set(-260, 420, 220));
  const dist = camera.position.distanceTo(T); distFocus.value = Math.max(60, dist);   // what you're looking at stays bright; beyond it darkens const ext = Math.max(120, Math.min(420, dist * 0.75)); Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext }); sun.shadow.camera.updateProjectionMatrix();
  if (render) draw();
  infoT += dt; if (infoT > 0.3) { infoT = 0; if (followed) updateInfo(); const s = sim.stats(); census.innerHTML = `Out &amp; about: ${s.outside}<br>Indoors: ${s.inside}<br>Carts &amp; chairs: ${s.vehicles}`; }
  fpsN++; fpsT += dt; if (fpsT > 1) { document.getElementById("stats").textContent = `${Math.round(fpsN / fpsT)} fps · ${sim.stats().actors} actors`; fpsN = 0; fpsT = 0; }
}
city.advance = (secs, fps = 30) => { for (let i = 0; i < secs * fps; i++) frame(1 / fps, false); draw(); };
city.render = () => draw();
city.ao = (on) => { if (on !== undefined) { AO = !!on; syncFx(); } return AO; };
city.fx = (o = {}) => { for (const [k, v] of Object.entries(o)) FX[k]?.set(!!v); syncFx(); return Object.fromEntries(Object.entries(FX).map(([k, f]) => [k, f.get()])); };
city.stats = () => ({ ...sim.stats(), simTime: sim.time, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles });

(async () => {
  try {
    setStatus("BUILDING THE CITY...");
    tufts(); crops(); bushes();
    await Promise.all([buildStatics(), buildActors(), buildWheel()]); buildVehicleWheels(); transport = await buildTransport(scene, W, { modelGeometry, vmat, walkMat, meshVoxels, gridFromVoxels, animalVoxels, animalParts }); await bakeSkyOcclusion(); await buildNight(); addDistanceDarkening(scene); applyNight(night);
    setView(qs.get("view") ?? "town");
    if (qs.get("t")) city.advance(+qs.get("t"));
    document.getElementById("loading")?.remove();
    city.ready = true;
    const loop = () => { requestAnimationFrame(loop); const dt = Math.min(0.05, clock.getDelta()); if (dt > 0) frame(dt); };
    loop();
  } catch (err) { setStatus("ERROR: " + err.message); console.error(err); city.error = String(err.stack || err); }
})();
