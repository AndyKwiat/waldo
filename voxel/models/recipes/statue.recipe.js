// Giant marble statue of Jupiter (after the classical "Jupiter with thunderbolt and eagle" type) for the
// centre of the market square. A Voxer recipe (build(ctx), slots, anchors) — built with Voxer's recipe CLI,
// not the waldo build-models driver:
//
//   cd voxel && bun run statue        # = cd ../../voxer && bun run recipe ../waldo/voxel/models/recipes/statue.recipe.js \
//                                     #     --out ../waldo/voxel/models --figure --views front,left,iso,iso_left,top
//
// Sculpted as solid primitives (ellipsoids, tapered capsules, swept drapery sections) into a material grid,
// then shaded per voxel: marble gets lighter on ridges / top faces and grey in the folds (local occupancy),
// plus a little weathering. Front faces +Z; the statue's right arm (raised, thunderbolt) is toward -X.

const S = 104;            // grid
const C = 52;             // pedestal centre (x and z)
const FX = 53.5, FZ = 51; // figure origin (u = 0, w = 0) in grid coords
const Y0 = 18;            // soles of the feet (top of the oval plinth + 1)

// materials
const SKIN = 1, CLOTH = 2, HAIR = 3, GOLD = 4, STONE = 5, PLINTH = 6, EAGLE = 7, TRIM = 8, LETTER = 9;
const MARBLE = new Set([SKIN, CLOTH, HAIR, PLINTH, EAGLE]);

export default {
  name: "statue",
  size: S,
  description: "Colossal marble Jupiter: raised gilded thunderbolt, left hand on hip, himation, eagle at his foot, on a stepped stone pedestal.",
  slots: {
    marble: { base: "#efe9dc", shades: { light: "#faf7f0", dark: "#d4cec2", deep: "#b3afa8", weather: "#e6dcc6", grime: "#c9bea6" } },
    stone: { base: "#8f8576", shades: { light: "#9e9484", dark: "#7a7266", joint: "#5e574e" } },
    gold: { base: "#e2b23a", shades: { light: "#f6d670", dark: "#a87a20" } },
  },
  sheet: { views: ["front", "left", "iso", "iso_left", "top"], tile: 340, figure: true },
  anchors: {
    base_center: { x: C, y: 0, z: C, note: "centre of the pedestal footprint (place the model here)" },
    top: { x: Math.round(FX - 23), y: 95, z: Math.round(FZ + 2), dir: "+y", note: "tip of the thunderbolt" },
  },
  build(ctx) {
    const g = new Uint8Array(S * S * S);
    const idx = (x, y, z) => (y * S + z) * S + x;
    const inb = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < S && y < S && z < S;
    const put = (x, y, z, m) => { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (inb(x, y, z)) g[idx(x, y, z)] = m; };
    const get = (x, y, z) => (inb(x, y, z) ? g[idx(x, y, z)] : 0);
    // figure space → grid
    const P = (u, v, w) => [FX + u, Y0 + v, FZ + w];

    /** Ellipsoid in figure space; `only(m)` keeps existing cells of other materials when `keep` is set. */
    function ell(u, v, w, rx, ry, rz, m, keep = false) {
      const [cx, cy, cz] = P(u, v, w);
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
          for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
            if (d <= 1 && (!keep || !get(x, y, z))) put(x, y, z, m);
          }
    }
    /** Tapered capsule a→b (figure space), radius r0→r1. */
    function cap(a, b, r0, r1, m, keep = false) {
      const A = P(...a), B = P(...b), d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1, R = Math.max(r0, r1);
      for (let y = Math.floor(Math.min(A[1], B[1]) - R); y <= Math.ceil(Math.max(A[1], B[1]) + R); y++)
        for (let z = Math.floor(Math.min(A[2], B[2]) - R); z <= Math.ceil(Math.max(A[2], B[2]) + R); z++)
          for (let x = Math.floor(Math.min(A[0], B[0]) - R); x <= Math.ceil(Math.max(A[0], B[0]) + R); x++) {
            let t = ((x - A[0]) * d[0] + (y - A[1]) * d[1] + (z - A[2]) * d[2]) / L2; t = Math.max(0, Math.min(1, t));
            const px = A[0] + d[0] * t - x, py = A[1] + d[1] * t - y, pz = A[2] + d[2] * t - z, r = r0 + (r1 - r0) * t;
            if (px * px + py * py + pz * pz <= r * r && (!keep || !get(x, y, z))) put(x, y, z, m);
          }
    }
    const rnd = ctx.rng(1907);

    // ================= pedestal (stone) =================
    const rect = (x0, x1, y0, y1, z0, z1, m) => { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) put(x, y, z, m); };
    const slab = (hx, hz, y0, y1, m, chamfer = 0) => { for (let y = y0; y <= y1; y++) for (let z = C - hz; z <= C + hz; z++) for (let x = C - hx; x <= C + hx; x++) {
      if (chamfer && Math.abs(x - C) + Math.abs(z - C) > hx + hz - chamfer) continue; put(x, y, z, m); } };
    slab(23, 20, 0, 1, STONE, 4);           // two broad steps
    slab(21, 18, 2, 3, STONE, 4);
    slab(18, 15, 4, 4, TRIM, 3);            // base moulding
    slab(16, 13, 5, 12, STONE, 2);          // the die
    slab(18, 15, 13, 13, TRIM, 3);          // cornice
    slab(17, 14, 14, 14, TRIM, 3);
    // corner pilasters on the die
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rect(C + sx * 16 - (sx > 0 ? 1 : 0), C + sx * 16 + (sx < 0 ? 1 : 0), 5, 12, C + sz * 13 - (sz > 0 ? 1 : 0), C + sz * 13 + (sz < 0 ? 1 : 0), TRIM);
    // inscription on the front of the die: I O V I (3×5 pixel letters), gilded
    const FONT = { I: ["111", "010", "010", "010", "111"], O: ["111", "101", "101", "101", "111"], V: ["101", "101", "101", "101", "010"], M: ["10001", "11011", "10101", "10001", "10001"] };
    { const word = "IOVI", wpx = word.length * 4 - 1; let x = C - Math.floor(wpx / 2); const zf = C + 14;
      for (const ch of word) { const rows = FONT[ch]; rows.forEach((row, r) => [...row].forEach((b, k) => { if (b === "1") put(x + k, 11 - r, zf, LETTER); })); x += rows[0].length + 1; }
      for (let xx = C - 9; xx <= C + 9; xx++) { put(xx, 5, zf, TRIM); put(xx, 13, zf + 1, TRIM); } }
    // laurel-ish panels on the sides: a sunk frame
    for (const sx of [-1, 1]) { const xf = C + sx * 17; for (let z = C - 8; z <= C + 8; z++) { put(xf, 6, z, TRIM); put(xf, 11, z, TRIM); } for (let y = 6; y <= 11; y++) { put(xf, y, C - 8, TRIM); put(xf, y, C + 8, TRIM); } }

    // ================= oval plinth (marble, part of the statue) =================
    { const pcx = FX - 0.5, pcz = FZ + 0.8;
      for (let y = 15; y <= 17; y++) { const grow = y === 15 ? 0.6 : 0; for (let z = 0; z < S; z++) for (let x = 0; x < S; x++)
        if (((x - pcx) / (17.4 + grow)) ** 2 + ((z - pcz) / (12 + grow)) ** 2 <= 1) put(x, y, z, PLINTH); } }

    // ================= legs & feet (below the hem) =================
    // weight leg = his left (+u), relaxed leg = his right (-u), stepping forward and out
    cap([2.5, 9, 0], [2.6, 1.6, 0.6], 2.1, 1.7, SKIN);         // left shin
    ell(2.8, 0.9, 2.6, 2.1, 1.1, 3.4, SKIN);                     // left foot
    cap([-5.5, 10, 1.5], [-7.4, 1.8, 3.2], 2.1, 1.7, SKIN);     // right shin
    ell(-8.6, 0.9, 5.4, 2.1, 1.1, 3.4, SKIN);                    // right foot (forward, turned out)
    for (const [u, w] of [[1.6, 5.7], [2.8, 5.9], [4, 5.5], [-9.6, 8.4], [-8.4, 8.6], [-7.3, 8.1]]) put(...P(u, 0, w), SKIN); // toes
    put(...P(2.8, 0, 6.2), SKIN); put(...P(-8.5, 0, 9), SKIN);

    // ================= drapery: skirt of the himation from hips to just above the ankles =================
    // cross-sections: ellipse around a centre that leans with the pose; folds as radial ripples
    const HEM = 5.5, TOP = 41;
    for (let v = Math.floor(HEM); v <= TOP; v++) {
      const t = (v - HEM) / (TOP - HEM);                         // 0 at hem, 1 at hips
      const cu = -1.6 + 0.9 * t, cw = -0.6 + 0.6 * t;
      let rx = 10.2 + 0.5 * Math.sin(t * Math.PI) - (t > 0.85 ? (t - 0.85) * 9 : 0);
      let rz = 7.6 - 1.2 * t;
      if (v < 8) { rx += (8 - v) * 0.25; rz += (8 - v) * 0.2; }     // hem flares a little
      const [gx, gy, gz] = P(cu, v, cw);
      for (let z = Math.floor(gz - rz - 3); z <= gz + rz + 3; z++) for (let x = Math.floor(gx - rx - 3); x <= gx + rx + 3; x++) {
        const dx = x - gx, dz = z - gz, th = Math.atan2(dz, dx), front = Math.max(0, Math.sin(th));
        // vertical folds everywhere; diagonal folds across the front (from his left hip down to his right knee)
        let rip = 1.25 * Math.sin(7 * th + v * 0.05) + 0.45 * Math.sin(13 * th + 1.7 + v * 0.09);
        if (v > 18 && v < 40) rip = rip * (1 - front) + front * (1.2 * Math.sin((v + 0.85 * dx) * 0.55));
        // the apron (overfold) ends in a lip at v ≈ 27, deeper on his left
        const lip = v >= 26 && v <= 28 + dx * 0.12 ? 0.9 : 0;
        const r = Math.hypot(dx / rx, dz / rz), R = 1 + (rip + lip) / Math.max(rx, rz);
        if (r <= R) put(x, gy, z, CLOTH);
      }
    }
    // relaxed right knee pressing the cloth forward, the thigh above it
    ell(-5.2, 20, 5.0, 3.6, 4.2, 3.0, CLOTH);
    cap([-4, 34, 2.5], [-5.2, 21, 5], 4, 3.4, CLOTH);
    // folds gathered between the legs, falling straight down in front of the weight leg
    cap([0.2, 26, 6.2], [-0.8, 7, 7.6], 1.3, 1.6, CLOTH);
    cap([3.5, 30, 5.6], [3.2, 8, 6.4], 1.1, 1.4, CLOTH);

    // ================= torso =================
    ell(0, 44.5, 0.4, 7.4, 6.5, 4.8, SKIN);       // abdomen / waist
    ell(0, 50.5, 0, 9, 6.6, 5.2, SKIN);           // ribcage
    ell(-4, 51, 2.6, 4.3, 3.2, 3.0, SKIN);        // pecs
    ell(4, 51, 2.6, 4.3, 3.2, 3.0, SKIN);
    ell(0, 56.5, -0.6, 6.5, 2.6, 4, SKIN);        // trapezius
    ell(-9.2, 55.6, 0, 3.7, 3.7, 3.7, SKIN);      // right deltoid
    ell(9.2, 55.6, 0, 3.7, 3.7, 3.7, SKIN);       // left deltoid (under the cloak)
    ell(-5.6, 45.5, 2.4, 2.6, 4.2, 2.4, SKIN);    // obliques
    ell(5.6, 45.5, 2.4, 2.6, 4.2, 2.4, SKIN);
    cap([0, 56, 0.2], [-0.6, 62, 1], 2.9, 2.6, SKIN); // neck

    // ================= right arm, raised with the thunderbolt =================
    cap([-9.5, 56, 0], [-19.2, 52.6, 1.2], 3.0, 2.4, SKIN);   // upper arm, out to the side and a little down
    ell(-19.4, 52.8, 1.2, 2.6, 2.6, 2.5, SKIN);                // elbow
    cap([-19.4, 53, 1.2], [-21.2, 63.6, 1.8], 2.4, 1.8, SKIN); // forearm up
    ell(-21.4, 65.2, 2, 2.3, 2.4, 2.2, SKIN);                  // fist
    // thunderbolt (gilded): spindle through the fist with flaring prongs at both ends
    cap([-21.2, 58.5, 2.2], [-22.6, 74, 2.2], 1.0, 1.0, GOLD);
    ell(-22.4, 70.5, 2.2, 1.8, 2.6, 1.8, GOLD);
    for (const [du, dw, h] of [[-2.6, 0, 76.5], [0, 0, 77.4], [2.2, 0, 76.3], [-1.2, -1.8, 76.2], [-1, 1.9, 76.4]])
      cap([-22.5, 72, 2.2], [-22.5 + du, h, 2.2 + dw], 0.9, 0.6, GOLD);
    for (const [du, h] of [[-1.6, 56.8], [1.2, 57]]) cap([-21.2, 59.5, 2.2], [-21.2 + du, h, 2.2], 0.8, 0.6, GOLD);

    // ================= left arm: elbow out, hand on the hip, under the cloak =================
    cap([9.5, 56, 0], [13.6, 47, -0.6], 3.0, 2.5, SKIN);       // upper arm
    ell(13.6, 47, -0.6, 2.6, 2.6, 2.6, SKIN);
    cap([13.6, 47, -0.6], [8.6, 39.4, 2.8], 2.4, 2.0, SKIN);   // forearm down to the hip
    ell(8, 38.6, 3.6, 2.0, 2.4, 2.0, SKIN);                    // hand gripping the fold

    // ================= himation: waist roll, cloak over the left shoulder, hanging folds =================
    // the rolled-over top edge, sagging across the belly from his left hip down to the right
    for (let a = 0; a < Math.PI * 2; a += 0.04) {
      const x = 8.4 * Math.cos(a), z = 0.4 + 6.4 * Math.sin(a), v = 41.6 + 0.16 * x - 1.3 * Math.max(0, Math.sin(a)) + 0.4 * Math.sin(5 * a);
      ell(x, v, z, 1.9, 1.7, 1.9, CLOTH);
    }
    // cloak over the left shoulder: covers the shoulder, the upper arm, the left flank and the back
    cap([9.5, 56.6, 0], [13.6, 47, -0.6], 4.3, 3.7, CLOTH, false);
    ell(8.2, 56.4, 0, 4.6, 3.6, 4.6, CLOTH);
    for (let v = 41; v <= 58; v++) {                                  // front panel down the left chest + the back
      for (let z = -9; z <= 9; z++) for (let x = -12; x <= 14; x++) {
        const [gx, gy, gz] = P(x, v, z); if (get(gx, gy, gz) !== SKIN) continue;
        const front = z > 0, edge = 3.2 + 0.18 * (58 - v) + 0.6 * Math.sin(v * 0.9);   // front edge drifts outward as it falls
        const back = z <= -1 && x > -6 + (58 - v) * 0.15;
        if ((front && x > edge) || back || (!front && x > 6)) {
          // thicken outward by one voxel: paint this cell and its outer neighbour
          put(gx, gy, gz, CLOTH);
          const nx = x > 0 ? 1 : 0, nz = z > 0 ? 1 : -1; if (!get(gx + nx, gy, gz + nz)) put(gx + nx, gy, gz + nz, CLOTH);
        }
      }
    }
    // the loose end falling from under the hand down the left side (zigzag edge), and the long fold behind the arm
    for (let v = 23; v <= 38; v++) {
      const k = (38 - v) / 15, zig = Math.round(1.2 * Math.sin(v * 1.3));
      for (let du = -1.6 - k * 1.2; du <= 1.6 + k * 0.6; du += 0.5) for (let dw = -1; dw <= 1.4; dw += 0.5) put(...P(9.6 + du + zig * 0.4, v, 4 + dw - k * 1.5), CLOTH);
    }
    for (let v = 12; v <= 46; v++) { const k = (46 - v) / 34; ell(14.5 - k * 3.4, v, -3 + k * 0.8, 1.9 + k * 0.6, 0.8, 2.6, CLOTH, true); }

    // ================= head: curly hair, full beard =================
    const HU = -0.8, HV = 66, HW = 1.2;
    ell(HU, HV, HW, 4.1, 4.9, 4.5, SKIN);                         // cranium + face
    ell(HU, HV - 2.2, HW + 2.2, 3.2, 2.6, 2.6, SKIN);             // cheeks / jaw forward
    // beard: a mass under the jaw and down onto the chest, with curls
    ell(HU, HV - 4.6, HW + 2.0, 3.9, 3.2, 3.1, HAIR);
    ell(HU, HV - 6.6, HW + 2.6, 2.9, 2.0, 2.4, HAIR);
    for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, rr = rnd() * 3.2; ell(HU + Math.cos(a) * rr, HV - 4 - rnd() * 4.2, HW + 3 + Math.sin(a) * 1.2 + rnd() * 1.4, 1.1, 1.1, 1.1, HAIR); }
    // mustache
    cap([HU - 2.3, HV - 2.1, HW + 4.6], [HU + 2.3, HV - 2.1, HW + 4.6], 0.8, 0.8, HAIR);
    // hair: curls over the crown, back and sides, framing the face
    for (let i = 0; i < 90; i++) {
      const th = rnd() * Math.PI * 2, ph = Math.acos(1 - 2 * rnd());   // uniform on the sphere
      const x = Math.sin(ph) * Math.cos(th), y = Math.cos(ph), z = Math.sin(ph) * Math.sin(th);
      if (y < -0.05 && z > -0.3) continue;                            // not over the lower face
      if (z > 0.55 && y < 0.55) continue;                             // keep the face clear
      ell(HU + x * 4.3, HV + 0.6 + y * 5.0, HW + z * 4.6, 1.5, 1.5, 1.5, HAIR);
    }
    ell(HU, HV + 0.8, HW - 0.6, 4.3, 4.7, 4.3, HAIR, true);         // fill gaps under the curls
    // face details (painted later): brow, eyes, nose
    const face = { brow: [], eye: [], nose: [] };
    for (const du of [-2, -1, 0, 1, 2]) face.brow.push(P(HU + du, HV + 1, HW + 4.6));
    for (const du of [-1.7, 1.5]) face.eye.push(P(HU + du, HV + 0.2, HW + 4.2));
    face.nose.push(P(HU, HV - 0.2, HW + 5.4), P(HU, HV - 1.0, HW + 5.5), P(HU, HV + 0.6, HW + 5.0));

    // ================= eagle at his left foot =================
    { const EU = 13.8, EW = 5.0, k = 1.25;
      const E = (du, v, dw) => [EU + du * k, v * k, EW + dw * k];
      const eel = (du, v, dw, rx, ry, rz, m = EAGLE) => ell(...E(du, v, dw), rx * k, ry * k, rz * k, m);
      const ecap = (a, b, r0, r1, m = EAGLE) => cap(E(...a), E(...b), r0 * k, r1 * k, m);
      eel(0, 4.6, -0.6, 3.0, 4.2, 3.8);                                  // body
      eel(0.2, 8.2, 1.4, 2.3, 2.4, 2.3);                                 // breast / neck
      eel(0.9, 10.7, 2.5, 1.7, 1.8, 1.8);                                // head, turned outward
      ecap([2.1, 10.8, 3.4], [3.1, 9.7, 4.3], 0.8, 0.45, GOLD);         // hooked beak (gilded)
      for (const s of [-1, 1]) {                                         // folded wings, shoulders raised high
        ecap([s * 2.6, 11.2, 0.0], [s * 2.9, 2.0, -4.6], 1.5, 0.9);
        ecap([s * 2.4, 9.4, 1.0], [s * 2.8, 3.0, -3.4], 1.3, 0.9);
        ecap([s * 2.2, 12.2, -0.6], [s * 2.6, 10.6, 0.6], 1.1, 1.1);    // wing-bow tips above the back
      }
      ecap([0, 2.4, -3.6], [0.3, 0.6, -7.2], 1.5, 1.1);                 // tail on the plinth
      for (const s of [-1, 1]) ecap([s * 1.3, 1.8, 1.4], [s * 1.5, 0.4, 2.8], 0.7, 0.7); // talons
    }

    // ================= shading =================
    const st = ctx.slots, M = st.marble, SN = st.stone, GD = st.gold;
    const occ = (x, y, z) => { let n = 0; for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (get(x + dx, y + dy, z + dz)) n++; return n / 125; };
    const exposed = (x, y, z) => !get(x + 1, y, z) || !get(x - 1, y, z) || !get(x, y + 1, z) || !get(x, y - 1, z) || !get(x, y, z + 1) || !get(x, y, z - 1);
    const faceCells = new Map(); for (const [k, list] of Object.entries(face)) for (const p of list) faceCells.set(p.map(Math.round).join(","), k);
    for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const m = g[idx(x, y, z)]; if (!m) continue;
      let col;
      if (MARBLE.has(m)) {
        if (!exposed(x, y, z)) col = M.base;
        else {
          const o = occ(x, y, z), up = !get(x, y + 1, z), n = ctx.hash3(x, y, z, 11);
          let lvl = o > 0.68 ? -2 : o > 0.6 ? -1 : o < 0.45 ? 1 : 0;    // -2 deep, -1 dark, 0 base, 1 light
          if (up && lvl < 1) lvl++;
          if (m === HAIR && lvl > -2 && n < 0.45) lvl--;
          if (m === PLINTH && y === 17 && lvl < 1) lvl = 0;
          col = lvl === -2 ? M.deep : lvl === -1 ? M.dark : lvl === 1 ? M.light : M.base;
          // weathering: soft yellowed patches and grime low down / in the deep folds
          const w = ctx.hash3(x >> 1, y >> 2, z >> 1, 5);
          if (lvl <= 0 && w < 0.09) col = M.weather;
          if ((y - Y0 < 3 || m === PLINTH) && n < 0.18 && lvl <= 0) col = M.grime;
          const fk = faceCells.get(`${x},${y},${z}`);
          if (fk === "eye") col = M.deep; else if (fk === "brow") col = M.light; else if (fk === "nose") col = M.light;
        }
      } else if (m === GOLD || m === LETTER) {
        col = !get(x, y + 1, z) ? GD.light : ctx.hash3(x, y, z, 3) < 0.3 ? GD.dark : GD.base;
      } else if (m === TRIM) {
        col = !get(x, y + 1, z) ? SN.light : SN.base;
      } else { // STONE: coursed blocks with darker joints, slight per-block tint
        const course = y <= 1 ? 0 : y <= 3 ? 1 : Math.floor((y - 5) / 4) + 2, joint = (y === 1 || y === 3 || (y >= 5 && (y - 5) % 4 === 3));
        const bx = Math.floor((x + course * 3) / 7), bz = Math.floor((z + course * 3) / 7), vert = (x + course * 3) % 7 === 0 || (z + course * 3) % 7 === 0;
        const tint = ctx.hash3(bx, course, bz, 9);
        col = !get(x, y + 1, z) ? SN.light : (joint || vert) && exposed(x, y, z) ? SN.joint : tint < 0.3 ? SN.dark : SN.base;
      }
      ctx.set(x, y, z, col);
    }
    ctx.anchor("head", { x: Math.round(FX + HU), y: Math.round(Y0 + HV + 5), z: Math.round(FZ + HW), dir: "+y", note: "crown of the head" });
  },
};
