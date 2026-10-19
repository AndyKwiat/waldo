// Rendering for the wood-and-rope machines and the airships. Positions come from world.js (TRANSPORTS, carState,
// carPos — the same functions the sim uses for riders), so cars, ropes and passengers always agree.
//  - gondola: two cars on a sagging rope over a timber pylon; the bullwheel at the shrine turns with the rope; two oxen
//    walk round the capstan in the lower station (only while the cars move) and the capstan turns with them
//  - lift: the cage rides the shaft, a counterweight goes the other way, the head wheel turns
//  - airships: cargo ships fly mast to mast (cruise, descend, hover with the crates at the platform, climb), small
//    pleasure balloons drift in slow loops; all bob and bank gently
import * as THREE from "three";

export async function buildTransport(scene, W, h) {
  const { modelGeometry: mg, vmat, walkMat, meshVoxels, gridFromVoxels, animalVoxels, animalParts } = h;
  const modelGeometry = (m) => mg(m, null, "m:" + m);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
  const has = (m) => W.hasModel(m);
  const G = W.TRANSPORTS[0], LIFT = W.TRANSPORTS[1];
  const ropeMat = new THREE.MeshLambertMaterial({ color: "#6a4a2a" }), timber = new THREE.MeshLambertMaterial({ color: "#7a5232" });
  // ---- gondola rope (static sagging tube through the supports) + the pylon
  const pts = []; for (let s = 0; s <= 1.0001; s += 0.005) { const p = W.carPos(G, s); pts.push(new THREE.Vector3(p.x, p.rope, p.z)); }
  const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.45, 5), ropeMat); rope.castShadow = true; scene.add(rope);
  for (const py of G.pylons) { // a timber A-frame with a cross-arm and a sheave on top
    const g = new THREE.Group(); g.position.set(py.x, py.y, py.z); scene.add(g);
    for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, py.h + 2, 1.6), timber); leg.position.set(sx * 5, py.h / 2, 0); leg.rotation.z = sx * 0.11; leg.castShadow = true; g.add(leg); }
    for (const y of [py.h * 0.35, py.h * 0.7]) { const b = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 1.2), timber); b.position.y = y; g.add(b); }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 3), timber); arm.position.y = py.h + 0.6; g.add(arm);
  }
  // ---- gondola cars
  const carGeo = has("gondola_car") ? await modelGeometry("gondola_car") : new THREE.BoxGeometry(10, 8, 8).translate(0, 4, 0);
  const cars = new THREE.InstancedMesh(carGeo, vmat, G.cars); cars.castShadow = true; cars.frustumCulled = false; scene.add(cars);
  // ---- shrine bullwheel (high station, rot 1 → wheel plane y–z, spinning about world x)
  const wheelGeo = has("pulley_wheel") ? await modelGeometry("pulley_wheel") : new THREE.CylinderGeometry(12, 12, 2, 24).rotateX(Math.PI / 2);
  const wheels = [];
  const addWheel = (x, y, z, rotY, r) => { const holder = new THREE.Group(); holder.position.set(x, y, z); holder.rotation.y = rotY; const m = new THREE.Mesh(wheelGeo, vmat); m.castShadow = true; holder.add(m); scene.add(holder); wheels.push({ m, r }); return m; };
  const gWheel = addWheel(W.GONDOLA_HIGH.x, W.GONDOLA_HIGH.y + 19, W.GONDOLA_HIGH.z - 10.5, Math.PI / 2, 11);
  const lWheel = addWheel(W.LIFT.wheel.x, W.LIFT.wheel.y, W.LIFT.wheel.z, 0, 11);
  // ---- capstan + two oxen
  const capGeo = has("capstan") ? await modelGeometry("capstan") : null;
  const capstan = capGeo ? new THREE.Mesh(capGeo, vmat) : new THREE.Group(); capstan.position.set(W.CAPSTAN.x, W.CAPSTAN.y, W.CAPSTAN.z); capstan.castShadow = true; scene.add(capstan);
  const oxGeo = meshVoxels(gridFromVoxels(animalVoxels("cow", "#8a5a32"), 16), { pivot: "base", parts: animalParts("cow") });
  const oxWalk = new THREE.InstancedBufferAttribute(new Float32Array(4), 2); oxWalk.setUsage(THREE.DynamicDrawUsage); oxGeo.setAttribute("aWalk", oxWalk);
  const oxen = new THREE.InstancedMesh(oxGeo, walkMat, 2); oxen.castShadow = true; oxen.frustumCulled = false; scene.add(oxen);
  // ---- lift cage + counterweight + ropes
  const cageGeo = has("elevator_cage") ? await modelGeometry("elevator_cage") : new THREE.BoxGeometry(9, 10, 9).translate(0, 5, 0);
  const cage = new THREE.Mesh(cageGeo, vmat); cage.castShadow = true; scene.add(cage);
  const cw = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 3), new THREE.MeshLambertMaterial({ color: "#5a5a62" })); cw.castShadow = true; scene.add(cw);
  const vRope = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.5), ropeMat); scene.add(m); return m; };
  const cageRope = vRope(), cwRope = vRope();
  // ---- airships
  const airGeo = { cargo: has("airship_cargo") ? await modelGeometry("airship_cargo") : null, small: has("airship_small") ? await modelGeometry("airship_small") : null };
  const ships = [];
  const MASTS = W.MASTS.map((m) => ({ ...m, y: W.groundH(m.x, m.z) }));
  if (airGeo.cargo) for (let k = 0; k < 2; k++) { const m = new THREE.Mesh(airGeo.cargo, vmat); m.castShadow = true; scene.add(m); ships.push({ m, kind: "cargo", k }); }
  if (airGeo.small) for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(airGeo.small, vmat); m.castShadow = true; scene.add(m); ships.push({ m, kind: "small", k }); }
  const CRUISE = 70, LEG = 34, HOVER = 12, CYCLE = LEG + HOVER;   // seconds per mast-to-mast leg / per hover
  // cargo legs follow a fixed tour of the masts (palace → district → lowland → hamlet → shrine → …)
  const TOUR = [0, 4, 2, 3, 1];
  function cargoPose(k, t) {
    const n = TOUR.length, u = t + k * CYCLE * 2.5, leg = Math.floor(u / CYCLE), f = (u % CYCLE) / CYCLE;
    const a = MASTS[TOUR[((leg % n) + n) % n]], b = MASTS[TOUR[(((leg + 1) % n) + n) % n]];
    const dock = (m) => ({ x: m.x + 15, y: m.y + 33, z: m.z });   // hull alongside, crates level with the mast platform
    const A = dock(a), B = dock(b), hoverF = HOVER / CYCLE;
    if (f < hoverF) return { x: A.x, y: A.y + Math.sin(t * 0.9 + k) * 0.6, z: A.z, yaw: Math.atan2(-(B.z - A.z), B.x - A.x) * 0.0 + (k ? 0.3 : -0.3), docked: true };
    const g = (f - hoverF) / (1 - hoverF), e = g * g * (3 - 2 * g), top = Math.max(A.y, B.y) + CRUISE, sm = (v) => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
    const base = A.y + (B.y - A.y) * e, bump = sm(g / 0.25) * sm((1 - g) / 0.25);   // climb out, cruise, descend onto the next mast
    return { x: A.x + (B.x - A.x) * e, y: base + (top - base) * bump, z: A.z + (B.z - A.z) * e, yaw: Math.atan2(-(B.z - A.z), B.x - A.x) };
  }
  function smallPose(k, t) { // slow loops over the city at different heights
    const cx = W.CENTER.x + (k - 1) * 240, cz = W.CENTER.z - 160 + k * 90, rx = 260 + k * 60, rz = 200 + k * 40, w = 0.018 + k * 0.005, a = t * w + k * 2.1;
    const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz, dx = -Math.sin(a) * rx, dz = Math.cos(a) * rz;
    return { x, y: 230 + k * 28 + Math.sin(t * 0.4 + k) * 6, z, yaw: Math.atan2(-dz, dx) };
  }
  let oxA = 0, prevT = null;
  return {
    update(t) {
      const dtv = prevT === null ? 0 : Math.max(0, Math.min(0.2, t - prevT)); prevT = t;
      // gondola cars + rope motion (drives the wheels, the capstan and the oxen)
      let moving = false;
      for (let k = 0; k < G.cars; k++) { const st = W.carState(G, k, t), p = W.carPos(G, st.s); if (!st.dock) moving = true;
        Q.setFromAxisAngle(UP, Math.PI / 2 + Math.sin(t * 0.8 + k) * 0.03); M.compose(V.set(p.x, p.y - 1, p.z), Q, S1); cars.setMatrixAt(k, M); }
      cars.instanceMatrix.needsUpdate = true;
      const st0 = W.carState(G, 0, t), ropeV = st0.dock ? 0 : 1;
      if (moving) oxA += dtv * 0.32;
      gWheel.rotation.z = oxA * 4; capstan.rotation.y = -oxA;
      for (let i = 0; i < 2; i++) { const a = -oxA + i * Math.PI + Math.PI / 2, r = 15;
        Q.setFromAxisAngle(UP, a + Math.PI); M.compose(V.set(W.CAPSTAN.x + Math.cos(a) * r, W.CAPSTAN.y, W.CAPSTAN.z - Math.sin(a) * r), Q, S1); oxen.setMatrixAt(i, M);
        oxWalk.array[i * 2] = oxA * 30 + i; oxWalk.array[i * 2 + 1] = moving ? 0.35 : 0; }
      oxen.instanceMatrix.needsUpdate = true; oxWalk.needsUpdate = true; void ropeV;
      // lift
      const ls = W.carState(LIFT, 0, t), lp = W.carPos(LIFT, ls.s), top = LIFT.path[1].y, bot = LIFT.path[0].y;
      cage.position.set(lp.x - 0.5, lp.y - 1, lp.z - 0.5);
      const cwy = top + 8 - (lp.y - bot); cw.position.set(W.LIFT.x + 22, cwy, W.LIFT.z);
      const wy = W.LIFT.wheel.y; cageRope.position.set(lp.x, (lp.y + 10 + wy) / 2, lp.z); cageRope.scale.y = Math.max(1, wy - lp.y - 10);
      cwRope.position.set(W.LIFT.x + 22, (cwy + 3 + wy) / 2, W.LIFT.z); cwRope.scale.y = Math.max(1, wy - cwy - 3);
      lWheel.rotation.z = (lp.y - bot) / 11;
      // airships
      for (const s of ships) { const p = s.kind === "cargo" ? cargoPose(s.k, t) : smallPose(s.k, t);
        s.yaw = s.yaw === undefined ? p.yaw : s.yaw + Math.atan2(Math.sin(p.yaw - s.yaw), Math.cos(p.yaw - s.yaw)) * Math.min(1, dtv * 0.8);
        s.m.position.set(p.x, p.y + Math.sin(t * 0.7 + s.k * 2) * 1.2, p.z); s.m.rotation.set(Math.sin(t * 0.5 + s.k) * 0.03, s.yaw, Math.sin(t * 0.6 + s.k) * 0.04); }
    },
  };
}
