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
  const GONDOLAS = W.TRANSPORTS.filter((T) => T.kind === "gondola"), LIFTS = W.LIFTS;
  const ropeMat = new THREE.MeshLambertMaterial({ color: "#6a4a2a" }), timber = new THREE.MeshLambertMaterial({ color: "#7a5232" });
  const carGeo = has("gondola_car") ? await modelGeometry("gondola_car") : new THREE.BoxGeometry(10, 8, 8).translate(0, 4, 0);
  const wheelGeo = has("pulley_wheel") ? await modelGeometry("pulley_wheel") : new THREE.CylinderGeometry(12, 12, 2, 24).rotateX(Math.PI / 2);
  const capGeo = has("capstan") ? await modelGeometry("capstan") : null;
  const oxGeo = meshVoxels(gridFromVoxels(animalVoxels("cow", "#8a5a32"), 16), { pivot: "base", parts: animalParts("cow") });
  const addWheel = (x, y, z, rotY) => { const holder = new THREE.Group(); holder.position.set(x, y, z); holder.rotation.y = rotY; const m = new THREE.Mesh(wheelGeo, vmat); m.castShadow = true; holder.add(m); scene.add(holder); return m; };
  // ---- gondolas: sagging rope through the supports, timber pylons, cars, the top bullwheel, the ox capstan at the bottom
  const G = GONDOLAS.map((T) => {
    const pts = []; for (let s = 0; s <= 1.0001; s += 0.0025) { const p = W.carPos(T, s); pts.push(new THREE.Vector3(p.x, p.rope, p.z)); }
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 800, 0.45, 5), ropeMat); rope.castShadow = true; scene.add(rope);
    for (const py of T.pylons) { const g = new THREE.Group(); g.position.set(py.x, py.y, py.z); scene.add(g);
      for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1.8, py.h + 2, 1.8), timber); leg.position.set(sx * 6, py.h / 2, 0); leg.rotation.z = sx * 0.12; leg.castShadow = true; g.add(leg); }
      for (let y = py.h * 0.25; y < py.h; y += py.h * 0.25) { const b = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 1.2), timber); b.position.y = y; g.add(b); }
      const arm = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 3), timber); arm.position.y = py.h + 0.6; g.add(arm); }
    const cars = new THREE.InstancedMesh(carGeo, vmat, T.cars); cars.castShadow = true; cars.frustumCulled = false; scene.add(cars);
    const wheel = addWheel(T.wheel.x, T.wheel.y, T.wheel.z, Math.PI / 2);
    const cap = capGeo ? new THREE.Mesh(capGeo, vmat) : new THREE.Group(); cap.position.set(T.capstan.x, T.capstan.y, T.capstan.z); cap.castShadow = true; scene.add(cap);
    const og = oxGeo.clone(), walk = new THREE.InstancedBufferAttribute(new Float32Array(4), 2); walk.setUsage(THREE.DynamicDrawUsage); og.setAttribute("aWalk", walk);
    const oxen = new THREE.InstancedMesh(og, walkMat, 2); oxen.castShadow = true; oxen.frustumCulled = false; scene.add(oxen);
    return { T, cars, wheel, cap, oxen, walk, a: 0 };
  });
  // ---- cargo lifts: big cage, counterweight, ropes, head wheel
  const cageGeo = has("cargo_lift_cage") ? await modelGeometry("cargo_lift_cage") : has("elevator_cage") ? (await modelGeometry("elevator_cage")).clone().scale(3.4, 1, 3.4) : new THREE.BoxGeometry(32, 10, 32).translate(0, 5, 0);
  const cages = new THREE.InstancedMesh(cageGeo, vmat, LIFTS.length); cages.castShadow = true; cages.frustumCulled = false; scene.add(cages);
  const cwGeo = new THREE.BoxGeometry(5, 9, 5), cws = new THREE.InstancedMesh(cwGeo, new THREE.MeshLambertMaterial({ color: "#5a5a62" }), LIFTS.length); cws.castShadow = true; cws.frustumCulled = false; scene.add(cws);
  const ropes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 1, 0.6), ropeMat, LIFTS.length * 3); ropes.frustumCulled = false; scene.add(ropes);
  const liftWheels = LIFTS.map((T) => addWheel(T.x, T.path[1].y + 20, T.z, 0));
  const S = new THREE.Vector3();
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
    return { x, y: 470 + k * 34 + Math.sin(t * 0.4 + k) * 6, z, yaw: Math.atan2(-dz, dx) };
  }
  let oxA = 0, prevT = null;
  return {
    update(t) {
      const dtv = prevT === null ? 0 : Math.max(0, Math.min(0.2, t - prevT)); prevT = t;
      // gondolas: cars on the rope; while any car moves the oxen walk the capstan round and the bullwheel turns
      for (const g of G) { let moving = false;
        for (let k = 0; k < g.T.cars; k++) { const st = W.carState(g.T, k, t), p = W.carPos(g.T, st.s); if (st.dock === null) moving = true;
          Q.setFromAxisAngle(UP, Math.PI / 2 + Math.sin(t * 0.8 + k) * 0.03); M.compose(V.set(p.x, p.y - 1, p.z), Q, S1); g.cars.setMatrixAt(k, M); }
        g.cars.instanceMatrix.needsUpdate = true;
        if (moving) g.a += dtv * 0.32;
        g.wheel.rotation.z = g.a * 4; g.cap.rotation.y = -g.a;
        for (let i = 0; i < 2; i++) { const a = -g.a + i * Math.PI + Math.PI / 2, r = 15, c = g.T.capstan;
          Q.setFromAxisAngle(UP, a + Math.PI); M.compose(V.set(c.x + Math.cos(a) * r, c.y, c.z - Math.sin(a) * r), Q, S1); g.oxen.setMatrixAt(i, M);
          g.walk.array[i * 2] = g.a * 30 + i; g.walk.array[i * 2 + 1] = moving ? 0.35 : 0; }
        g.oxen.instanceMatrix.needsUpdate = true; g.walk.needsUpdate = true; }
      // cargo lifts
      LIFTS.forEach((T, i) => { const st = W.carState(T, 0, t), p = W.carPos(T, st.s), bot = T.path[0].y, top = T.path[1].y, wy = top + 20;
        cages.setMatrixAt(i, M.makeTranslation(p.x, p.y - 2, p.z));
        const cwy = top - 2 - (p.y - bot); cws.setMatrixAt(i, M.makeTranslation(p.x + 20, cwy, p.z + 10));
        const rope = (k, x, y0, z) => ropes.setMatrixAt(i * 3 + k, M.compose(V.set(x, (y0 + wy) / 2, z), Q.identity(), S.set(1, Math.max(1, wy - y0), 1)));
        rope(0, p.x - 10, p.y + 12, p.z); rope(1, p.x + 10, p.y + 12, p.z); rope(2, p.x + 20, cwy + 4.5, p.z + 10);
        liftWheels[i].rotation.z = (p.y - bot) / 11; });
      cages.instanceMatrix.needsUpdate = true; cws.instanceMatrix.needsUpdate = true; ropes.instanceMatrix.needsUpdate = true;
      // airships
      for (const s of ships) { const p = s.kind === "cargo" ? cargoPose(s.k, t) : smallPose(s.k, t);
        s.yaw = s.yaw === undefined ? p.yaw : s.yaw + Math.atan2(Math.sin(p.yaw - s.yaw), Math.cos(p.yaw - s.yaw)) * Math.min(1, dtv * 0.8);
        s.m.position.set(p.x, p.y + Math.sin(t * 0.7 + s.k * 2) * 1.2, p.z); s.m.rotation.set(Math.sin(t * 0.5 + s.k) * 0.03, s.yaw, Math.sin(t * 0.6 + s.k) * 0.04); }
    },
  };
}
