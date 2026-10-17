// Jade River City — 3D voxel edition. Wiring: world layout → instanced voxel meshes → simulation loop → UI.
// Agent/debug API: window.city (see README "Agent tooling").
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as W from "./world.js";
import { loadModel, meshVoxels, gridFromVoxels } from "./voxels.js";
import { personVoxels, animalVoxels, DOG_COLORS, CAT_LOOKS, PIGEON_COLORS, DUCK_LOOKS } from "./people.js";
import { createSim } from "./sim.js";
import { WHEELS, wheelModel } from "../models/recipes/props.js";

const qs = new URLSearchParams(location.search);
if (qs.get("seed")) W.setSeed(+qs.get("seed"));
const LOW = qs.has("low");           // cheaper rendering for headless screenshots
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
scene.background = new THREE.Color("#a6d8f2");
scene.fog = new THREE.Fog("#bfe3f5", 1400, 3800);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 1, 5000);
const controls = new OrbitControls(camera, renderer.domElement);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.12, screenSpacePanning: false, maxPolarAngle: 1.42, minDistance: 12, maxDistance: 1600, zoomSpeed: 1.2 });
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
const hemi = new THREE.HemisphereLight("#e8f4ff", "#8a7a5a", 1.05); scene.add(hemi);
const sun = new THREE.DirectionalLight("#fff4e0", 2.6); sun.castShadow = true;
sun.shadow.mapSize.set(LOW ? 2048 : 4096, LOW ? 2048 : 4096); Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, near: 10, far: 1400 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const VIEWS = {
  town: () => [[W.CENTER.x + 170, 190, W.CENTER.z + 260], [W.CENTER.x, 0, W.CENTER.z - 10]],
  overview: () => [[W.WX / 2, 1150, W.WZ + 560], [W.WX / 2, 0, W.WZ / 2 - 30]],
  city: () => [[W.CITY.x0 + W.CW / 2, 760, W.CITY.z1 + 600], [W.CITY.x0 + W.CW / 2, 0, (W.CITY.z0 + W.CITY.z1) / 2]],
  walls: () => [[W.CITY.x1 + 70, 70, W.CITY.z1 + 80], [W.CITY.x1 - 60, 22, W.CITY.z1 - 10]],
  country: () => [[W.HAMLETS[2].x + 160, 120, W.HAMLETS[2].z + 210], [W.HAMLETS[2].x + 40, 0, W.HAMLETS[2].z - 20]],
  plaza: () => [[W.CENTER.x + 40, 70, W.CENTER.z + 110], [W.CENTER.x, 0, W.CENTER.z]],
  street: () => [[W.SX[0] + 6, 18, W.SZ[3] + 4], [W.SX[2] + 20, 4, W.SZ[3] - 2]],
  gate: () => [[W.GATE_X + 35, 42, W.WALL_S + 105], [W.GATE_X, 10, W.WALL_S + 4]],
  palace: () => [[W.GATE_X + 190, 210, W.PALACE.z + W.PALACE.d + 210], [W.GATE_X, 10, W.PALACE.z + W.PALACE.d / 2]],
  fort: () => VIEWS.palace(),
  district: () => [[W.SX[1] - 40, 210, W.SZ[7] + 170], [W.SX[2] + 30, 0, W.SZ[5] + 20]],
  yard: () => [[W.GATE_X + 70, 60, W.YARD.z + W.YARD.d + 70], [W.GATE_X, 8, W.YARD.z + 10]],
  alley: () => { const e = W.EDGE_LIST.find((q) => q.type === "alley" && q.a[0] > 0) ?? W.EDGE_LIST[0], x = (W.SX[e.a[0]] + W.SX[e.b[0]]) / 2, z = W.alleyZ(e.a[1], e.a[0], x); return [[x - 26, 75, z + 34], [x + 6, 0, z]]; },
  river: () => [[L.WHEEL.x - 40, 48, W.RIVER.zc(L.WHEEL.x) + 70], [L.WHEEL.x + 20, 4, W.RIVER.zc(L.WHEEL.x) - 4]],
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
  for (const b of viewBar.children) b.classList.toggle("on", b.dataset.view === name); const v = VIEWS[name] ?? VIEWS.town; const [p, t] = v(); placeCam(p, t); }
city.view = setView;
city.cam = (pos, target) => placeCam(pos, target);

// ---------- static world
const vmat = new THREE.MeshLambertMaterial({ vertexColors: true });
const L = W.layout();
const tex = W.groundTexture();
// Flat ground layers are only centimetres apart, far below depth-buffer precision at city distances, so each
// layer gets a polygon offset (in depth units, so it holds at any distance): outer grass < painted ground < ribbons.
const layer = (n) => ({ polygonOffset: true, polygonOffsetFactor: -n, polygonOffsetUnits: -4 * n });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(W.WX, W.WZ), new THREE.MeshLambertMaterial({ map: tex, ...layer(1) }));
ground.rotation.x = -Math.PI / 2; ground.position.set(W.WX / 2, 0, W.WZ / 2); ground.receiveShadow = true; scene.add(ground);
const outer = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshLambertMaterial({ color: "#5fae44", ...layer(-1) }));
outer.rotation.x = -Math.PI / 2; outer.position.set(W.WX / 2, -0.3, W.WZ / 2); scene.add(outer);
const mountains = new THREE.Mesh(W.mountainGeometry(), vmat); mountains.receiveShadow = true; scene.add(mountains);
/** Flat ribbon following f(x) (river, roads) — used to carry the river and roads past the painted ground into the haze. */
function ribbon(x0, x1, zc, hw, y, color, opts = {}) {
  const pos = [], idx = []; for (let x = x0, i = 0; x <= x1; x += 4, i++) { const z = zc(x); pos.push(x, y, z - hw, x, y, z + hw); if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, ...opts })); m.receiveShadow = true; scene.add(m); return m;
}
for (const [a, b] of [[-3000, 0], [W.WX, W.WX + 3000]]) { ribbon(a, b, W.RIVER.zc, W.RIVER.hw + 5, 0.02, "#e8d8a0", layer(2)); ribbon(a, b, W.RIVER.zc, W.RIVER.hw, 0.04, "#3a8ac8", layer(4)); }
for (const r of W.ROADS) if (r.w > r.d) for (const [a, b] of [[-3000, 0], [W.WX, W.WX + 3000]]) ribbon(a, b, () => r.z + r.d / 2, r.d / 2, 0.03, "#c8a878", layer(3));
{ const r = W.ROADS[0]; const g = new THREE.Mesh(new THREE.PlaneGeometry(r.w, 3000), new THREE.MeshLambertMaterial({ color: "#c8a878", ...layer(3) })); g.rotation.x = -Math.PI / 2; g.position.set(r.x + r.w / 2, 0.03, W.WZ + 1500); scene.add(g); }
const hills = new THREE.Mesh(W.hillGeometry(L.bumps), vmat); hills.receiveShadow = true; hills.castShadow = true; scene.add(hills);
{ // translucent river surface
  const pos = [], idx = []; for (let x = -3000, i = 0; x <= W.WX + 3000; x += 4, i++) { const zc = W.RIVER.zc(x); pos.push(x, 0.25, zc - W.RIVER.hw, x, 0.25, zc + W.RIVER.hw); if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const water = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: "#5ab8f0", transparent: true, opacity: 0.4 })); water.receiveShadow = true; scene.add(water);
}

const geoCache = new Map();
async function modelGeometry(model, remap, key) {
  if (!geoCache.has(key)) geoCache.set(key, loadModel(model).then((g) => meshVoxels(g, { remap: remap ?? {}, pivot: model === "waterwheel" ? "center" : "base" })));
  return geoCache.get(key);
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
async function buildStatics() {
  const groups = new Map(); for (const s of L.statics) (groups.get(s.key) ?? groups.set(s.key, []).get(s.key)).push(s);
  await Promise.all([...groups].map(async ([key, list]) => {
    const geo = await modelGeometry(list[0].model, list[0].remap, key);
    const im = new THREE.InstancedMesh(geo, vmat, list.length); im.castShadow = im.receiveShadow = true;
    list.forEach((s, i) => { Q.setFromAxisAngle(UP, s.rot * Math.PI / 2); im.setMatrixAt(i, M4.compose(V.set(s.x, s.y, s.z), Q, SC.set(1, 1, 1))); });
    im.computeBoundingSphere(); scene.add(im);
  }));
}
function tufts() { // little 3D grass tufts and rice seedlings to break up the flat ground
  const geo = meshVoxels(gridFromVoxels([[8, 0, 8, "#ffffff"], [8, 1, 8, "#ffffff"], [7, 0, 8, "#ffffff"], [9, 0, 9, "#ffffff"]], 16));
  const pts = [];
  for (const p of W.PADDIES) for (let z = p.z + 3; z < p.z + p.d; z += 12) for (let x = p.x + 2; x < p.x + p.w - 2; x += 3) pts.push([x + W.rnd(-0.6, 0.6), z + W.rnd(0, 4), W.pick(["#58c048", "#6cd058", "#48a838"])]);
  for (let i = 0; i < 16000; i++) { const x = W.rnd(0, W.WX), z = W.rnd(W.RIVER.zc(0) + 20, W.WZ); if (W.occupied(x, z, -6) && !W.inRect(x, z, W.CITY_R)) continue;
    if (W.isStreet(x, z) || W.inRect(x, z, W.PLAZA) || W.inRect(x, z, W.PALACE) || (W.inRect(x, z, W.CITY_R) && !W.isStreet(x, z) && chance3())) continue; pts.push([x, z, W.pick(["#4ea23a", "#62b446", "#3a8430", "#90d866"])]); }
  const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), pts.length); const col = new THREE.Color();
  pts.forEach(([x, z, c], i) => { Q.setFromAxisAngle(UP, W.rnd(0, 6.28)); im.setMatrixAt(i, M4.compose(V.set(x, W.groundH(x, z), z), Q, SC.set(1, 1, 1))); im.setColorAt(i, col.set(c)); });
  im.receiveShadow = true; scene.add(im);
}
const chance3 = () => W.rand() < 0.7;
function bushes() { // leafy bushes and flower clumps scattered over the countryside
  const vox = []; for (const [x, y, z] of [[7, 0, 7], [8, 0, 7], [9, 0, 7], [7, 0, 8], [8, 0, 8], [9, 0, 8], [8, 0, 9], [7, 0, 9], [8, 1, 7], [8, 1, 8], [7, 1, 8], [9, 1, 8], [8, 2, 8]]) vox.push([x, y, z, "#ffffff"]);
  const pts = []; for (let i = 0; i < 2600; i++) { const x = W.rnd(-60, W.WX + 60), z = W.rnd(W.RIVER.zc(0) + 24, W.WZ + 40); if (W.occupied(x, z, 2)) continue; pts.push([x, z, W.pick(["#3aa848", "#2e8a3a", "#4cb85a", "#58c060", "#3a9a40", "#f8b8c8", "#f0e060"])]); }
  const im = new THREE.InstancedMesh(meshVoxels(gridFromVoxels(vox, 16)), new THREE.MeshLambertMaterial({ vertexColors: true }), pts.length), col = new THREE.Color();
  pts.forEach(([x, z, c], i) => { const sc = W.rnd(0.7, 1.5); Q.setFromAxisAngle(UP, W.rnd(0, 6.28)); im.setMatrixAt(i, M4.compose(V.set(x, W.groundH(x, z), z), Q, SC.set(sc, sc * W.rnd(0.7, 1.1), sc))); im.setColorAt(i, col.set(c)); });
  im.castShadow = true; im.receiveShadow = true; scene.add(im);
}
function crops() { // 3D crop rows on the farm fields: cabbages and wheat
  const kinds = { cabbage: [[[8, 0, 8], [9, 0, 8], [8, 0, 9], [9, 0, 9], [8, 1, 8], [9, 1, 9], [8, 1, 9]], ["#58c060", "#3aa848", "#7ad870"]], wheat: [[[8, 0, 8], [8, 1, 8], [8, 2, 8], [8, 3, 8], [8, 3, 9]], ["#e8c048", "#d8b038", "#f0d060"]] };
  const col = new THREE.Color();
  for (const [k, [vox, cols]] of Object.entries(kinds)) { const list = L.crops.filter((c) => c.kind === k); if (!list.length) continue;
    const im = new THREE.InstancedMesh(meshVoxels(gridFromVoxels(vox.map((v) => [...v, "#ffffff"]), 16)), new THREE.MeshLambertMaterial({ vertexColors: true }), list.length);
    list.forEach((c, i) => { Q.setFromAxisAngle(UP, W.rnd(0, 6.28)); im.setMatrixAt(i, M4.compose(V.set(c.x, 0, c.z), Q, SC.set(1, 1, 1))); im.setColorAt(i, col.set(W.pick(cols))); });
    im.receiveShadow = true; im.castShadow = k === "wheat"; scene.add(im); }
}

// ---------- actors: one InstancedMesh per look (people share a library of looks; animals/vehicles by kind)
const sim = createSim(L); city.sim = sim;
const actorMeshes = new Map(); const pickables = [];
const lookKey = (look) => (look.model ? "m:" + look.model : look.animal ? `a:${look.animal}:${look.variant}` : look);
function animalGrid(look) {
  const k = look.animal, v = look.variant;
  const c = k === "dog" ? DOG_COLORS[v % DOG_COLORS.length] : k === "cat" ? CAT_LOOKS[v % CAT_LOOKS.length] : k === "pigeon" ? PIGEON_COLORS[v % PIGEON_COLORS.length] : k === "duck" ? DUCK_LOOKS[v % DUCK_LOOKS.length] : k === "chicken" ? ["#fff4d8", "#c88a5a", "#3a3440", "#f0b830"][v % 4] : v; // cows/sheep carry their colour in the variant
  return gridFromVoxels(animalVoxels(k, c), 16);
}
async function buildActors() {
  const all = [...sim.ents.map((e) => ({ a: e, pick: true })), ...sim.pigeons.map((a) => ({ a })), ...sim.boats.map((a) => ({ a })), ...sim.ducks.map((a) => ({ a }))];
  const groups = new Map(); for (const it of all) { const k = lookKey(it.a.look); (groups.get(k) ?? groups.set(k, []).get(k)).push(it); }
  await Promise.all([...groups].map(async ([k, list]) => {
    const look = list[0].a.look;
    const geo = look.model ? await modelGeometry(look.model, null, "m:" + look.model) : meshVoxels(look.animal ? animalGrid(look) : gridFromVoxels(personVoxels(look), 16), { pivot: "base" });
    const im = new THREE.InstancedMesh(geo, vmat, list.length); im.castShadow = true; im.receiveShadow = !LOW; im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.userData.actors = list.map((x) => x.a);
    list.forEach((x, i) => { x.a._mesh = im; x.a._slot = i; x.a.hp = Math.random() * 6; });
    scene.add(im); actorMeshes.set(k, im); if (list[0].pick) pickables.push(im);
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
let wheel = null;
async function buildWheel() { wheel = new THREE.Mesh(await modelGeometry("waterwheel", null, "waterwheel"), vmat); wheel.castShadow = true; wheel.position.set(L.WHEEL.x, 10, W.RIVER.zc(L.WHEEL.x) - 3); scene.add(wheel); }

const HIDE = new THREE.Vector3(0, 0, 0);
function place(a, x, y, z, yaw, scale) { Q.setFromAxisAngle(UP, yaw); a._mesh.setMatrixAt(a._slot, M4.compose(V.set(x, y, z), Q, scale ? SC.set(scale, scale, scale) : HIDE)); }
function updateActors(dt) {
  for (const e of sim.ents) {
    if (e.hidden) { place(e, e.x, -50, e.z, 0, 0); continue; }
    const moved = Math.hypot(e.x - (e.px ?? e.x), e.z - (e.pz ?? e.z)); e.px = e.x; e.pz = e.z;
    e.hp += moved * (e.kind === "vehicle" ? 0.5 : 0.75);
    if (e.kind === "vehicle") e.roll = (e.roll ?? 0) + moved / (e.scale ?? 1);
    const hop = e.mv ? Math.abs(Math.sin(e.hp)) * e.hop * Math.min(1, 0.35 + (e.spd ?? e.speed) / e.speed * 0.65) : 0;   // slower walkers bob less
    place(e, e.x, (e.y || 0) + (e.brain === "field" ? W.groundH(e.x, e.z) : 0) + hop, e.z, e.kind === "vehicle" ? e.yaw - Math.PI / 2 : e.yaw, e.scale ?? 1);
  }
  for (const g of sim.pigeons) place(g, g.x, g.y + (g.state === "fly" ? Math.abs(Math.sin(sim.time * 14 + g.phase)) * 0.6 : 0), g.z, g.yaw, 1);
  for (const b of sim.boats) place(b, b.x, -0.6 + Math.sin(sim.time * 1.5 + b.phase) * 0.25, b.z, b.yaw, 1);
  for (const d of sim.ducks) place(d, d.x, -0.2 + Math.sin(sim.time * 2 + d.phase) * 0.15, d.z, d.yaw, d.k ? 0.7 : 1);
  for (const im of actorMeshes.values()) im.instanceMatrix.needsUpdate = true;
  updateVehicleWheels();
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
city.screenOf = (e) => { const v = new THREE.Vector3(e.x, (e.y || 0) + 4, e.z).project(camera); return [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight)]; };
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
function frame(dt, draw = true) {
  sim.step(dt); updateActors(dt); keyPan(dt);
  if (followed) { const t = new THREE.Vector3(followed.x, (followed.y || 0) + 5, followed.z), d = t.sub(controls.target).multiplyScalar(Math.min(1, dt * 4)); controls.target.add(d); camera.position.add(d); }
  controls.target.x = Math.max(-100, Math.min(W.WX + 100, controls.target.x)); controls.target.z = Math.max(-100, Math.min(W.WZ + 100, controls.target.z));
  controls.update();
  const T = controls.target; sun.target.position.set(Math.round(T.x / 4) * 4, 0, Math.round(T.z / 4) * 4); sun.position.copy(sun.target.position).add(V.set(-260, 420, 220));
  const dist = camera.position.distanceTo(T); const ext = Math.max(120, Math.min(420, dist * 0.75)); Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext }); sun.shadow.camera.updateProjectionMatrix();
  if (draw) renderer.render(scene, camera);
  infoT += dt; if (infoT > 0.3) { infoT = 0; if (followed) updateInfo(); const s = sim.stats(); census.innerHTML = `Out &amp; about: ${s.outside}<br>Indoors: ${s.inside}<br>Carts &amp; chairs: ${s.vehicles}`; }
  fpsN++; fpsT += dt; if (fpsT > 1) { document.getElementById("stats").textContent = `${Math.round(fpsN / fpsT)} fps · ${sim.stats().actors} actors`; fpsN = 0; fpsT = 0; }
}
city.advance = (secs, fps = 30) => { for (let i = 0; i < secs * fps; i++) frame(1 / fps, false); renderer.render(scene, camera); };
city.render = () => renderer.render(scene, camera);
city.stats = () => ({ ...sim.stats(), simTime: sim.time, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles });

(async () => {
  try {
    setStatus("BUILDING THE CITY...");
    tufts(); crops(); bushes();
    await Promise.all([buildStatics(), buildActors(), buildWheel()]); buildVehicleWheels();
    setView(qs.get("view") ?? "town");
    if (qs.get("t")) city.advance(+qs.get("t"));
    document.getElementById("loading")?.remove();
    city.ready = true;
    const loop = () => { requestAnimationFrame(loop); const dt = Math.min(0.05, clock.getDelta()); if (dt > 0) frame(dt); };
    loop();
  } catch (err) { setStatus("ERROR: " + err.message); console.error(err); city.error = String(err.stack || err); }
})();
