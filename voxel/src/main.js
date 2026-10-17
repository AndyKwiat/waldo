// Jade River City — 3D voxel edition. Wiring: world layout → instanced voxel meshes → simulation loop → UI.
// Agent/debug API: window.city (see README "Agent tooling").
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as W from "./world.js";
import { loadModel, meshVoxels, gridFromVoxels } from "./voxels.js";
import { personVoxels, animalVoxels, DOG_COLORS, CAT_LOOKS, PIGEON_COLORS, DUCK_LOOKS } from "./people.js";
import { createSim } from "./sim.js";

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
scene.fog = new THREE.Fog("#bfe3f5", 900, 2200);
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
  overview: () => [[W.WX / 2, 640, W.WZ + 330], [W.WX / 2, 0, W.WZ / 2 - 30]],
  plaza: () => [[W.CENTER.x + 40, 70, W.CENTER.z + 110], [W.CENTER.x, 0, W.CENTER.z]],
  street: () => [[W.SX[0] + 6, 18, W.SZ[3] + 4], [W.SX[2] + 20, 4, W.SZ[3] - 2]],
  gate: () => [[W.GATE_X + 35, 42, W.WALL_S + 105], [W.GATE_X, 10, W.WALL_S + 4]],
  fort: () => [[W.GATE_X + 60, 110, W.FORT.z + 190], [W.GATE_X, 0, W.FORT.z + 40]],
  river: () => [[L.WHEEL.x - 40, 48, W.RIVER.zc(L.WHEEL.x) + 70], [L.WHEEL.x + 20, 4, W.RIVER.zc(L.WHEEL.x) - 4]],
  paddies: () => [[W.GATE_X - 160, 70, W.WALL_S + 150], [W.GATE_X - 160, 0, W.WALL_S + 55]],
  pagoda: () => { const b = W.block(...W.PAGODA_BLOCK); return [[b.x + 120, 80, b.z + 170], [b.x + 42, 10, b.z + 40]]; },
};
function setView(name) { const v = VIEWS[name] ?? VIEWS.town; const [p, t] = v(); camera.position.set(...p); controls.target.set(...t); followed = null; controls.update(); }
city.view = setView;
city.cam = (pos, target) => { camera.position.set(...pos); controls.target.set(...target); followed = null; controls.update(); };

// ---------- static world
const vmat = new THREE.MeshLambertMaterial({ vertexColors: true });
const L = W.layout();
const tex = W.groundTexture();
const ground = new THREE.Mesh(new THREE.PlaneGeometry(W.WX, W.WZ), new THREE.MeshLambertMaterial({ map: tex }));
ground.rotation.x = -Math.PI / 2; ground.position.set(W.WX / 2, 0, W.WZ / 2); ground.receiveShadow = true; scene.add(ground);
const outer = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshLambertMaterial({ color: "#5fae44" }));
outer.rotation.x = -Math.PI / 2; outer.position.set(W.WX / 2, -0.05, W.WZ / 2); scene.add(outer);
const mountains = new THREE.Mesh(W.mountainGeometry(), vmat); mountains.receiveShadow = true; mountains.castShadow = true; scene.add(mountains);
{ // translucent river surface
  const pos = [], idx = []; for (let x = -40, i = 0; x <= W.WX + 40; x += 4, i++) { const zc = W.RIVER.zc(x); pos.push(x, 0.25, zc - W.RIVER.hw, x, 0.25, zc + W.RIVER.hw); if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
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
  for (let i = 0; i < 2600; i++) { const x = W.rnd(0, W.WX), z = W.rnd(40, W.WZ); if (W.isStreet(x, z) || W.inRect(x, z, W.PLAZA) || W.inRect(x, z, W.FORT) || Math.abs(z - W.RIVER.zc(x)) < W.RIVER.hw + 4) continue;
    if (W.PADDIES.some((p) => x > p.x - 2 && x < p.x + p.w + 2 && z > p.z - 2 && z < p.z + p.d + 2)) continue; pts.push([x, z, W.pick(["#4ea23a", "#62b446", "#3a8430", "#90d866"])]); }
  const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), pts.length); const col = new THREE.Color();
  pts.forEach(([x, z, c], i) => { Q.setFromAxisAngle(UP, W.rnd(0, 6.28)); im.setMatrixAt(i, M4.compose(V.set(x, 0, z), Q, SC.set(1, 1, 1))); im.setColorAt(i, col.set(c)); });
  im.receiveShadow = true; scene.add(im);
}

// ---------- actors: one InstancedMesh per look (people share a library of looks; animals/vehicles by kind)
const sim = createSim(L); city.sim = sim;
const actorMeshes = new Map(); const pickables = [];
const lookKey = (look) => (look.model ? "m:" + look.model : look.animal ? `a:${look.animal}:${look.variant}` : look);
function animalGrid(look) {
  const k = look.animal, v = look.variant;
  const c = k === "dog" ? DOG_COLORS[v % DOG_COLORS.length] : k === "cat" ? CAT_LOOKS[v % CAT_LOOKS.length] : k === "pigeon" ? PIGEON_COLORS[v % PIGEON_COLORS.length] : k === "duck" ? DUCK_LOOKS[v % DUCK_LOOKS.length] : k === "chicken" ? ["#fff4d8", "#c88a5a", "#3a3440", "#f0b830"][v % 4] : null;
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
let wheel = null;
async function buildWheel() { wheel = new THREE.Mesh(await modelGeometry("waterwheel", null, "waterwheel"), vmat); wheel.castShadow = true; wheel.position.set(L.WHEEL.x, 10, W.RIVER.zc(L.WHEEL.x) - 3); scene.add(wheel); }

const HIDE = new THREE.Vector3(0, 0, 0);
function place(a, x, y, z, yaw, scale) { Q.setFromAxisAngle(UP, yaw); a._mesh.setMatrixAt(a._slot, M4.compose(V.set(x, y, z), Q, scale ? SC.set(scale, scale, scale) : HIDE)); }
function updateActors(dt) {
  for (const e of sim.ents) {
    if (e.hidden) { place(e, e.x, -50, e.z, 0, 0); continue; }
    const moved = Math.hypot(e.x - (e.px ?? e.x), e.z - (e.pz ?? e.z)); e.px = e.x; e.pz = e.z;
    e.hp += moved * (e.kind === "vehicle" ? 0.5 : 0.75);
    const hop = e.mv ? Math.abs(Math.sin(e.hp)) * e.hop : 0;
    place(e, e.x, (e.y || 0) + hop, e.z, e.kind === "vehicle" ? e.yaw - Math.PI / 2 : e.yaw, e.scale ?? 1);
  }
  for (const g of sim.pigeons) place(g, g.x, g.y + (g.state === "fly" ? Math.abs(Math.sin(sim.time * 14 + g.phase)) * 0.6 : 0), g.z, g.yaw, 1);
  for (const b of sim.boats) place(b, b.x, -0.6 + Math.sin(sim.time * 1.5 + b.phase) * 0.25, b.z, b.yaw, 1);
  for (const d of sim.ducks) place(d, d.x, -0.2 + Math.sin(sim.time * 2 + d.phase) * 0.15, d.z, d.yaw, d.k ? 0.7 : 1);
  for (const im of actorMeshes.values()) im.instanceMatrix.needsUpdate = true;
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
city.camera = camera; city.controls = controls; city.scene = scene;
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
    tufts();
    await Promise.all([buildStatics(), buildActors(), buildWheel()]);
    setView(qs.get("view") ?? "town");
    if (qs.get("t")) city.advance(+qs.get("t"));
    document.getElementById("loading")?.remove();
    city.ready = true;
    const loop = () => { requestAnimationFrame(loop); frame(Math.min(0.05, clock.getDelta())); };
    loop();
  } catch (err) { setStatus("ERROR: " + err.message); console.error(err); city.error = String(err.stack || err); }
})();
