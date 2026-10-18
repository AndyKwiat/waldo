// Imperial palace centrepiece + courtyard statuary: the Great Hall (grid 256), guardian lion, dragon column
// (huabiao), bronze ding incense burner. Front faces +Z; every model is placed by grid centre in x/z, y = 0 at the ground.
// Roofs use the canonical ROOF ramp (the game remaps it to imperial gold), pillars the canonical PILLAR ramp.
// Night-glow colours (M.lantern / M.paper / M.lattice) appear only in the Great Hall's hanging lanterns.
import { G, rng } from "./lib.js";
import { M, ROOF, PILLAR, roofRamp, colRamp, shade } from "./colors.js";

const R = roofRamp(ROOF), C = colRamp(PILLAR);
const MAR = "#ece8e0", MARD = "#cfcac0", MARL = "#f8f6f0", MARS = "#b8b2a6", CARVE = "#dccc98", CARVED = "#c4b07a";
const REDW = "#c23a2c", REDWD = "#a03024", LAT = "#e8b040", LATD = "#5e1c16", GREEN = "#2e9a78", BLUE = M.beam, BLUEL = M.beamL;
const md = (a, n) => ((a % n) + n) % n;

/** Offset canvas: x/z relative to the grid centre (x symmetric as -h..h-1, i.e. centred on the cell boundary). */
function canvas(S) {
  const g = new G(S), c = S / 2;
  const W = {
    g, S,
    set: (x, y, z, col) => g.set(c + x, y, c + z, col),
    get: (x, y, z) => g.get(c + x, y, c + z),
    /** fills a box; a function colour returning undefined leaves the cell untouched */
    box(x0, y0, z0, x1, y1, z1, col) {
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const v = typeof col === "function" ? col(x, y, z) : col; if (v !== undefined) g.set(c + x, y, c + z, v);
      }
    },
    ball(cx, cy, cz, rx, ry, rz, col) {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let z = Math.floor(cz - rz); z <= cz + rz; z++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
        if (d <= 1) { const v = typeof col === "function" ? col(x, y, z, d) : col; if (v !== undefined) g.set(c + x, y, c + z, v); }
      }
    },
    disc(cx, y, cz, r, col) { const Rr = Math.ceil(r); for (let a = -Rr; a <= Rr; a++) for (let b = -Rr; b <= Rr; b++) if (a * a + b * b <= r * r + 0.3) W.set(cx + a, y, cz + b, typeof col === "function" ? col(cx + a, y, cz + b) : col); },
  };
  return W;
}

// ───────────────────────────── Great Hall pieces ─────────────────────────────

/** Concave hip roof painted as hollow stepped rings (each layer only where the next one doesn't cover it).
 *  o: outer rect x0,x1,z0,z1 · inner (top) rect ix0,ix1,iz0,iz1 · y0 · N layers · hole (rect left open for a storey above)
 *  · up (eave-corner upturn size) · beasts (ridge beasts per hip) · ridge (main ridge + chiwen if no hole). Returns top y. */
function roof(W, o) {
  const N = o.N, pw = o.pw ?? 1.8, f = (t) => 1 - Math.pow(1 - t, pw), hole = o.hole;
  const rect = (k) => { const t = f(k / N); return [Math.round(o.x0 + (o.ix0 - o.x0) * t), Math.round(o.x1 + (o.ix1 - o.x1) * t), Math.round(o.z0 + (o.iz0 - o.z0) * t), Math.round(o.z1 + (o.iz1 - o.z1) * t)]; };
  const inR = (r, x, z) => r && x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3];
  for (let k = 0; k <= N; k++) {
    const [X0, X1, Z0, Z1] = rect(k), nx = k < N ? rect(k + 1) : null, y = o.y0 + k;
    for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) {
      if (inR(nx, x, z) || inR(hole, x, z)) continue;
      const edge = x === X0 || x === X1 || z === Z0 || z === Z1; let c;
      if (!nx) { // top layer: deck around a storey, or the ridge strip
        c = hole ? (edge ? R.ridge : md(x + z, 2) ? M.woodD : M.wood) : R.ridge;
      } else {
        const side = x < nx[0] || x > nx[1], fb = z < nx[2] || z > nx[3];
        if (k === 0 && edge) c = md(z === Z0 || z === Z1 ? x : z, 3) === 0 ? R.dark : R.cap;
        else if (side && fb) c = R.ridge;
        else if (fb) c = md(x, 3) === 0 ? R.dark : (z === nx[2] - 1 || z === nx[3] + 1) && md(x, 3) === 1 ? R.light : R.base;
        else c = md(z, 3) === 0 ? R.dark : R.side;
      }
      W.set(x, y, z, c);
    }
    if (nx) for (const [cx, cz] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) W.set(cx, y + 1, cz, R.ridge); // raised hip ridges
    if (k === 0) { // rafter ends under the eave
      for (let x = X0; x <= X1; x++) for (const z of [Z0, Z1]) W.set(x, y - 1, z, x === X0 || x === X1 ? M.gold : md(x, 2) ? BLUE : GREEN);
      for (let z = Z0; z <= Z1; z++) for (const x of [X0, X1]) W.set(x, y - 1, z, z === Z0 || z === Z1 ? M.gold : md(z, 2) ? BLUE : GREEN);
    }
  }
  // upturned eave corners + ridge beasts
  const r0 = rect(0), u = o.up ?? 3;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = sx < 0 ? r0[0] : r0[1], cz = sz < 0 ? r0[2] : r0[3], L = u * 3;
    for (let d = 0; d <= L; d++) { const h = Math.round(u * ((L - d) / L) ** 2); for (let j = 1; j <= h; j++) { const c = j === h ? R.cap : R.dark; W.set(cx - sx * d, o.y0 + j, cz, c); W.set(cx, o.y0 + j, cz - sz * d, c); } }
    for (let i = 1; i <= u; i++) { W.set(cx + sx * i, o.y0 + u + i - 1, cz + sz * i, R.cap); W.set(cx + sx * i, o.y0 + u + i - 2, cz + sz * i, R.ridge); }
    W.set(cx + sx * u, o.y0 + 2 * u, cz + sz * u, M.gold);
    for (let k = 1; k <= (o.beasts ?? 0); k++) { const r = rect(k + 1), bx = sx < 0 ? r[0] : r[1], bz = sz < 0 ? r[2] : r[3], by = o.y0 + k + 3; W.set(bx, by, bz, k === 1 ? GREEN : M.gold); W.set(bx, by - 1, bz, M.goldD); }
  }
  const top = o.y0 + N;
  if (!hole && o.ridge !== false) { // main ridge: two courses + gold chiwen at the ends
    const [X0, X1, Z0, Z1] = rect(N);
    for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) { W.set(x, top + 1, z, R.ridge); W.set(x, top + 2, z, md(x, 4) === 0 ? M.gold : R.dark); }
    for (const [ex, d] of [[X0, -1], [X1, 1]]) chiwen(W, ex, top + 3, Z0, Z1, d, o.chiwen ?? 6);
    return top + 2;
  }
  return top;
}

/** Ridge-end dragon (chiwen): a gold block with an inward-curling tail and an open jaw clamping the ridge. */
function chiwen(W, ex, y, z0, z1, d, h) {
  for (let z = z0 - 1; z <= z1 + 1; z++) {
    for (let j = 0; j < h; j++) { W.set(ex, y + j, z, j % 3 === 2 ? M.goldD : M.gold); W.set(ex + d, y + j, z, j < h - 2 ? M.gold : undefined); }
    for (let i = 1; i <= 2; i++) W.set(ex - d * i, y + h - 1 + (i === 2 ? 0 : 1), z, M.gold); // curl over the ridge
    W.set(ex - d * 3, y + h - 2, z, M.goldD);
    W.set(ex + d * 2, y, z, M.gold); W.set(ex + d * 2, y + 1, z, M.goldD); // jaw
  }
  W.set(ex + d, y + h - 3, z0 - 1, M.ink); W.set(ex + d, y + h - 3, z1 + 1, M.ink); // eyes
  W.set(ex, y + h, (z0 + z1) >> 1, M.goldD);
}

/** Positions of 2-wide pillars evenly spaced along [a0, a1] (symmetric, roughly `sp` apart). */
function pillarsAlong(a0, a1, sp) { const n = Math.max(1, Math.round((a1 - a0 - 1) / sp)), out = []; for (let i = 0; i <= n; i++) out.push(a0 + Math.round((i * (a1 - a0 - 1)) / n)); return out; }

/** One storey: red walls, protruding red pillars, lattice-door bays, a painted beam band (architrave, green & blue beams,
 *  dougong brackets) on the top four rows. kinds: {front, back, left, right} → "doors" | "windows". Returns pillar lists. */
function storey(W, x0, x1, z0, z1, y0, y1, o = {}) {
  const sp = o.sp ?? 12, band = 4, py = y1 - band;
  const faces = { front: { fix: z1, out: 1, axis: "x", a0: x0, a1: x1 }, back: { fix: z0, out: -1, axis: "x", a0: x0, a1: x1 }, left: { fix: x0, out: -1, axis: "z", a0: z0, a1: z1 }, right: { fix: x1, out: 1, axis: "z", a0: z0, a1: z1 } };
  const at = (F, a, y, d, c) => (F.axis === "x" ? W.set(a, y, F.fix + F.out * d, c) : W.set(F.fix + F.out * d, y, a, c)); // d>0 outward, d<0 inward
  for (const [name, F] of Object.entries(faces)) {
    const kind = o[name] ?? "doors", pil = o.pillars?.[name] ?? pillarsAlong(F.a0, F.a1, sp), isP = new Set(pil.flatMap((p) => [p, p + 1]));
    for (let a = F.a0; a <= F.a1; a++) for (let y = y0; y <= y1; y++) {
      if (y > py) { // beam band
        const r = y - py; let c;
        if (r === 1) c = C.d; else if (r === 2) c = md(a, 8) === 4 ? M.gold : GREEN; else if (r === 3) c = md(a, 8) === 0 ? M.gold : md(a, 8) < 3 || md(a, 8) > 6 ? BLUEL : BLUE;
        else c = md(a, 3) === 0 ? M.gold : md(a, 3) === 1 ? BLUE : GREEN;
        at(F, a, y, 0, c); if (r === band) at(F, a, y, 1, md(a, 3) === 0 ? M.goldD : md(a, 3) === 1 ? BLUE : GREEN); else if (r >= 2) at(F, a, y, 1, undefined);
        continue;
      }
      if (isP.has(a)) { at(F, a, y, 0, C.base); at(F, a, y, 1, y === y0 ? MARD : C.base); continue; }
      if (y === y0) { at(F, a, y, 0, o.base ?? MARD); continue; }
      at(F, a, y, 0, REDW);
    }
    // bays
    for (let i = 0; i + 1 < pil.length; i++) {
      const b0 = pil[i] + 2, b1 = pil[i + 1] - 1; if (b1 - b0 < 2) continue;
      const centre = (b0 + b1 + 1) / 2;
      if (o.mainDoor && name === "front" && Math.abs(centre) < 1) { grandDoor(W, F, at, b0, b1, y0 + 1, py - 2); continue; }
      if (kind === "doors") latticeBay(at, F, b0, b1, y0 + 1, py - 1, true);
      else if (kind === "windows") latticeBay(at, F, b0 + 1, b1 - 1, Math.round(y0 + (py - y0) * 0.4), py - 2, false);
    }
  }
  return faces;
}

/** Recessed lattice doors (or a window) filling a bay: leaves ~4 wide, solid lower panels, checker lattice above. */
function latticeBay(at, F, b0, b1, ya, yb, doors) {
  const n = Math.max(1, Math.round((b1 - b0 + 1) / 4)), w = (b1 - b0 + 1) / n, split = doors ? Math.round(ya + (yb - ya) * 0.32) : ya - 1;
  for (let a = b0; a <= b1; a++) for (let y = ya; y <= yb; y++) {
    const leafEdge = Math.abs(((a - b0) % w)) < 0.99 && a !== b0, top = y === yb, c =
      top || leafEdge ? C.d : y === split ? M.gold : y < split ? (y === split - 2 && md(a - b0, 2) === 1 ? M.gold : REDWD) : md(a + y, 2) ? LAT : LATD;
    at(F, a, y, 0, undefined); at(F, a, y, 0, null); at(F, a, y, -1, c);
  }
}

/** The main gate-door: tall red leaves studded with gold, with gold door rings and a gold-framed lintel. */
function grandDoor(W, F, at, b0, b1, ya, yb) {
  const mid = (b0 + b1 + 1) / 2;
  for (let a = b0; a <= b1; a++) for (let y = ya; y <= yb; y++) {
    const seam = a === Math.floor(mid) - 1 || a === Math.floor(mid); let c = y === yb ? M.gold : seam && a === Math.floor(mid) ? M.doorD : md(a - b0, 2) === 1 && md(y - ya, 3) === 1 && y < yb - 1 ? M.gold : M.door;
    at(F, a, y, 0, null); at(F, a, y, -1, c);
  }
  for (const a of [Math.floor(mid) - 2, Math.floor(mid) + 1]) at(F, a, Math.round((ya + yb) / 2), 0, M.gold); // door rings
}

/** Marble terrace tier (hollow): moulded base, cornice lip, top surface (skipping `cover`), balustrade with posts and
 *  dragon-head spouts, gap in the front balustrade for the stair. */
function tier(W, x0, x1, z0, z1, y0, y1, cover, gap) {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const edge = x === x0 || x === x1 || z === z0 || z === z1;
    if (y === y1) { if (!edge && cover && x >= cover[0] && x <= cover[1] && z >= cover[2] && z <= cover[3]) continue; W.set(x, y, z, edge ? MARL : md(x, 6) === 0 || md(z, 6) === 0 ? MARD : MAR); continue; }
    if (!edge) continue;
    const a = z === z0 || z === z1 ? x : z;
    W.set(x, y, z, y === y0 ? MARS : y === y1 - 1 ? MARD : md(a, 10) === 0 ? MARD : MAR);
  }
  // base moulding + cornice lip (one cell outward)
  for (let x = x0 - 1; x <= x1 + 1; x++) for (const z of [z0 - 1, z1 + 1]) { W.set(x, y0, z, MARS); W.set(x, y1, z, MARL); }
  for (let z = z0; z <= z1; z++) for (const x of [x0 - 1, x1 + 1]) { W.set(x, y0, z, MARS); W.set(x, y1, z, MARL); }
  // balustrade along the edge
  const rail = (x, z, a, ox, oz) => {
    if (gap && z === z1 && x >= gap[0] && x <= gap[1]) return;
    W.set(x, y1 + 1, z, md(a, 4) === 0 ? MARD : MAR); W.set(x, y1 + 2, z, md(a, 4) === 0 ? MAR : md(a, 2) ? undefined : MARL);
    if (md(a, 4) === 0) { W.set(x, y1 + 3, z, MARL); W.set(x + ox * 2, y1 - 2, z + oz * 2, MARD); W.set(x + ox, y1 - 2, z + oz, MARD); }
  };
  for (let x = x0; x <= x1; x++) { rail(x, z0, x, 0, -1); rail(x, z1, x, 0, 1); }
  for (let z = z0; z <= z1; z++) { rail(x0, z, z, -1, 0); rail(x1, z, z, 1, 0); }
}

/** Front stair from a tier's edge (z1) down to its base: flanking steps, a carved dragon ramp in the middle, sloped rails. */
function stair(W, rnd, z1, yTop, yBase, sx0, sx1, rx0, rx1) {
  const n = yTop - yBase; // steps, 2 deep each
  for (let j = 0; j < n; j++) {
    const ys = yTop - 1 - j, za = z1 + 1 + 2 * j, zb = za + 1;
    for (let z = za; z <= zb; z++) for (let x = sx0; x <= sx1; x++) {
      const ramp = x >= rx0 && x <= rx1, border = x === rx0 || x === rx1;
      for (let y = yBase; y < ys; y++) if (x === sx0 || x === sx1 || z === zb || ramp) W.set(x, y, z, MARD);
      W.set(x, ys, z, ramp ? (border ? MARD : rnd() < 0.3 ? CARVED : rnd() < 0.12 ? MARL : CARVE) : z === za ? MARL : MAR);
    }
    for (const x of [sx0, sx1]) { W.set(x, ys + 1, za, MAR); W.set(x, ys + 1, zb, MAR); W.set(x, ys + 2, za, j % 2 ? MAR : MARL); }
  }
  for (const x of [sx0, sx1]) { W.set(x, yBase, z1 + 2 * n + 1, MARD); W.set(x, yBase + 1, z1 + 2 * n + 1, MARL); }
}

/** Big hanging palace lantern (glows at night). (x,y,z) = hook. */
function bigLantern(W, x, y, z) {
  W.set(x, y, z, M.goldD); W.set(x, y - 1, z, M.gold);
  for (const [yy, full] of [[y - 2, false], [y - 3, true], [y - 4, true], [y - 5, false]]) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (full || a === 0 || b === 0) W.set(x + a, yy, z + b, M.lantern);
  W.set(x, y - 6, z, M.gold); W.set(x, y - 7, z, M.goldD);
}

/** Gilded water vat (fire-fighting cauldron). */
function vat(W, x, y, z) { for (let j = 0; j < 4; j++) W.disc(x, y + j, z, j === 0 ? 1.6 : j === 3 ? 2.6 : 2.3, j === 3 ? M.gold : j === 1 ? M.goldD : "#d8a030"); W.set(x - 3, y + 2, z, M.goldD); W.set(x + 3, y + 2, z, M.goldD); }

/** Gold-framed name plaque in the x-y plane at depth z (dark blue field with gold glyph strokes). */
function plaque(W, xa, xb, ya, yb, z, vertical) {
  for (let x = xa; x <= xb; x++) for (let y = ya; y <= yb; y++) {
    const edge = x === xa || x === xb || y === ya || y === yb;
    const glyph = vertical ? (x > xa + 1 && x < xb - 1 && y > ya + 1 && y < yb - 1 && (md(y - ya, 4) === 2 || (x === ((xa + xb + 1) >> 1) && md(y - ya, 4) !== 0) || (md(y - ya, 4) === 3 && md(x - xa, 3) === 1)))
      : (y > ya + 1 && y < yb - 1 && x > xa + 1 && x < xb - 1 && (y === ((ya + yb) >> 1) ? md(x - xa, 4) !== 0 : md(x - xa, 4) === 1));
    W.set(x, y, z, edge ? M.gold : glyph ? M.gold : M.plaque);
    if (edge) W.set(x, y, z + 1, (x + y) % 2 ? M.gold : M.goldD);
  }
}

/** Gold railing around a deck rect (top surface y): posts every 3, red lower rail. */
function deckRail(W, x0, x1, z0, z1, y) {
  const post = (x, z, a) => { W.set(x, y + 1, z, md(a, 3) === 0 ? C.base : md(a, 2) ? C.d : undefined); W.set(x, y + 2, z, md(a, 3) === 0 ? M.gold : C.base); };
  for (let x = x0; x <= x1; x++) { post(x, z0, x); post(x, z1, x); }
  for (let z = z0; z <= z1; z++) { post(x0, z, z); post(x1, z, z); }
}

export function palaceGreatHall() {
  const W = canvas(256), rnd = rng(888), ZC = -17; // hall & tower centre line in z
  const zr = (h) => [ZC - h, ZC + h];
  // 1) three-tier marble terrace (tops at y 7 / 15 / 23), front stairs
  const T = [[-98, 97, -72, 58, 0, 7], [-90, 89, -64, 40, 8, 15], [-82, 81, -56, 22, 16, 23]];
  const hallR = [-64, 63, ...zr(27)];
  for (let i = 0; i < 3; i++) {
    const [x0, x1, z0, z1, y0, y1] = T[i], nx = T[i + 1], cover = nx ? [nx[0], nx[1], nx[2], nx[3]] : hallR;
    tier(W, x0, x1, z0, z1, y0, y1, cover, [-24, 23]);
    stair(W, rnd, z1, y1, y0, -24, 23, -8, 7);
  }
  // 2) the hall: walls y 24..57 inside a peristyle ring of red columns (x -70..69, z -50..16)
  const hy0 = 24, hy1 = 57, px0 = -70, px1 = 69, [pz0, pz1] = zr(33);
  const frontP = [-64, -50, -36, -22, -8, 6, 20, 34, 48, 62];
  storey(W, hallR[0], hallR[1], hallR[2], hallR[3], hy0, hy1, { mainDoor: true, pillars: { front: frontP, back: frontP }, sp: 12, back: "windows", left: "windows", right: "windows" });
  // peristyle columns + beam ring
  const ringX = [px0, ...frontP, px1 - 1], ringZ = pillarsAlong(pz0, pz1, 12);
  const col = (x, z) => { W.box(x, hy0, z, x + 1, hy1 - 4, z + 1, (xx, y) => (y === hy0 ? MARD : y === hy1 - 4 ? C.d : C.base)); };
  for (const x of ringX) { col(x, pz0); col(x, pz1 - 1); } for (const z of ringZ) { col(px0, z); col(px1 - 1, z); }
  for (let y = hy1 - 3; y <= hy1; y++) {
    const r = y - (hy1 - 4), paint = (a) => (r === 1 ? C.d : r === 2 ? (md(a, 8) === 4 ? M.gold : GREEN) : r === 3 ? (md(a, 8) === 0 ? M.gold : BLUE) : md(a, 3) === 0 ? M.gold : md(a, 3) === 1 ? BLUE : GREEN);
    for (let x = px0; x <= px1; x++) { W.set(x, y, pz0, paint(x)); W.set(x, y, pz1, paint(x)); }
    for (let z = pz0; z <= pz1; z++) { W.set(px0, y, z, paint(z)); W.set(px1, y, z, paint(z)); }
  }
  for (let x = px0; x <= px1; x++) for (let z = pz0; z <= pz1; z++) if (x < hallR[0] || x > hallR[1] || z < hallR[2] || z > hallR[3]) W.set(x, hy1, z, BLUE); // porch ceiling
  // lanterns between the front columns
  for (let i = 0; i + 1 < ringX.length; i++) { const lx = Math.round((ringX[i] + ringX[i + 1] + 1) / 2); if (Math.abs(lx) > 2) bigLantern(W, lx, hy1 - 4, pz1); }
  // 3) lower eave
  const cl = [-54, 53, ...zr(19)], up1 = roof(W, { x0: px0 - 12, x1: px1 + 12, z0: pz0 - 12, z1: pz1 + 12, ix0: cl[0] - 1, ix1: cl[1] + 1, iz0: cl[2] - 1, iz1: cl[3] + 1, y0: hy1 + 1, N: 12, hole: cl, up: 4, beasts: 5 });
  // 4) clerestory with lattice windows, vertical name plaque above the main door
  const cy0 = up1 + 1, cy1 = cy0 + 13;
  storey(W, cl[0], cl[1], cl[2], cl[3], cy0, cy1, { sp: 12, front: "windows", back: "windows", left: "windows", right: "windows", base: R.ridge });
  plaque(W, -6, 5, cy0 + 1, cy1 - 3, cl[3] + 2, true);
  // 5) upper eave with a walkway deck around tower storey 1
  const t1 = [-38, 37, ...zr(13)];
  const up2 = roof(W, { x0: cl[0] - 19, x1: cl[1] + 19, z0: cl[2] - 19, z1: cl[3] + 19, ix0: t1[0] - 4, ix1: t1[1] + 4, iz0: t1[2] - 4, iz1: t1[3] + 4, y0: cy1 + 1, N: 14, hole: t1, up: 4, beasts: 5 });
  deckRail(W, t1[0] - 4, t1[1] + 4, t1[2] - 4, t1[3] + 4, up2);
  // 6) the pagoda-palace tower: three more storeys with stacked eaves
  const levels = [{ r: t1, h: 13 }, { r: [-28, 27, ...zr(9)], h: 12 }, { r: [-18, 17, ...zr(6)], h: 12 }];
  let y = up2 + 1;
  for (let i = 0; i < levels.length; i++) {
    const { r, h } = levels[i], y1 = y + h;
    storey(W, r[0], r[1], r[2], r[3], y, y1, { sp: i === 2 ? 9 : 10, base: R.ridge, mainDoor: false, front: "doors", back: "windows", left: "windows", right: "windows" });
    for (const [lx, lz] of [[r[0] - 1, r[3] + 1], [r[1] + 1, r[3] + 1], [r[0] - 1, r[2] - 1], [r[1] + 1, r[2] - 1]]) bigLantern(W, lx, y1 - 4, lz);
    if (i === 0) plaque(W, -5, 4, y + 2, y + 8, r[3] + 1, false);
    const ov = [12, 10, 10][i];
    if (i < levels.length - 1) {
      const nr = levels[i + 1].r, top = roof(W, { x0: r[0] - ov, x1: r[1] + ov, z0: r[2] - ov, z1: r[3] + ov, ix0: nr[0] - 2, ix1: nr[1] + 2, iz0: nr[2] - 2, iz1: nr[3] + 2, y0: y1 + 1, N: 7, hole: nr, up: 3, beasts: 3 });
      deckRail(W, nr[0] - 2, nr[1] + 2, nr[2] - 2, nr[3] + 2, top);
      y = top + 1;
    } else {
      const top = roof(W, { x0: r[0] - ov, x1: r[1] + ov, z0: r[2] - ov, z1: r[3] + ov, ix0: -9, ix1: 8, iz0: ZC, iz1: ZC, y0: y1 + 1, N: 15, up: 3, beasts: 3, chiwen: 7 });
      // finial: lotus base, stacked gold discs, flaming pearl
      let fy = top + 1;
      W.box(-2, fy, ZC - 2, 1, fy, ZC + 2, M.goldD); W.box(-1, fy + 1, ZC - 1, 0, fy + 4, ZC + 1, M.gold);
      for (const [yy, rr] of [[fy + 2, 2.4], [fy + 4, 1.8]]) W.disc(-0.5, yy, ZC, rr, M.goldD);
      const pc = fy + 9;
      for (const [dx, dz] of [[-4, 0], [3, 0], [0, -3], [0, 3]]) { W.set(dx + (dx < 0 ? 0 : 0), pc - 1, ZC + dz, M.orange); W.set(dx, pc, ZC + dz, M.orange); W.set(dx + Math.sign(dx) * 0, pc + 1, ZC + dz, "#f8a040"); }
      W.ball(-0.5, pc, ZC, 3.2, 3.6, 3.2, (x, yy) => (yy > pc + 1 && x < 0 ? "#fff0b0" : M.gold));
      W.box(-1, pc + 4, ZC, 0, pc + 6, ZC, M.gold); W.set(-1, pc + 7, ZC, M.orange); W.set(0, pc + 7, ZC, "#f8a040");
    }
  }
  // 7) terrace dressing: gilded vats, bronze cranes
  for (const vx of [-74, 72]) for (const vz of [-40, -10]) vat(W, vx, 24, vz);
  for (const vx of [-82, 81]) vat(W, vx, 16, 30);
  return W.g;
}

// ───────────────────────────── statues ─────────────────────────────

const AU = "#d89a24", AUD = "#9a6614", AUL = "#f0c038", AUH = "#ffe070", AUS = "#6a420e"; // gilded bronze (lion, hou)
const BZ = "#a8682a", BZD = "#6a3e14", BZL = "#cc8a3a", BZH = "#ecb456", PAT = "#4aa890", PATL = "#7ad0b0"; // bronze + verdigris
const STN = "#b4aea2", STND = "#928c80", STNL = "#d2ccc0", EYE = "#fff8e0";

/** Stone plinth (Sumeru base): moulded bottom/top, recessed waist with carved panels. x -hx..hx-1, z zc-hz..zc+hz. */
function plinth(W, hx, hz, h, zc = 0) {
  for (let y = 0; y < h; y++) {
    const inset = y === 0 || y === h - 1 ? 0 : y === 1 || y === h - 2 ? 1 : 2;
    W.box(-hx + inset, y, zc - hz + inset, hx - 1 - inset, y, zc + hz - inset, (x, yy, z) => {
      const edge = x === -hx + inset || x === hx - 1 - inset || z === zc - hz + inset || z === zc + hz - inset;
      if (!edge && y < h - 1) return undefined;
      if (y === 0) return STND; if (y === h - 1) return edge ? STNL : STN;
      return inset === 2 && md((z === zc - hz + inset || z === zc + hz - inset ? x : z), 3) === 0 ? STND : STN;
    });
  }
}

/** Guardian lion (male: right fore-paw on an embroidered ball), sitting on a bronze pad atop a stone plinth, facing +Z.
 *  Grid 32, 23 tall. Mirror in x for the other of the pair. */
export function lionStatue() {
  const W = canvas(32), P = 4; plinth(W, 8, 9, P, 0);
  W.box(-7, P, -8, 6, P, 8, (x, y, z) => (x === -7 || x === 6 || z === -8 || z === 8 ? AUD : md(x + z, 4) === 0 ? AUL : AU)); // bronze base pad
  const b = P + 1, fur = (x, y, z) => (md(x + y + z, 4) === 0 ? AUD : md(x * 2 + y + z, 5) === 0 ? AUL : AU);
  W.ball(-0.5, b + 3, -3.5, 5.6, 3.6, 4.2, fur); // haunches
  for (const [x0, x1] of [[-7, -5], [4, 6]]) { W.box(x0, b, -2, x1, b + 1, 2, AU); for (let x = x0; x <= x1; x++) W.set(x, b, 3, AUL); } // hind paws
  W.ball(-0.5, b + 7, -1, 4.4, 4.6, 3.8, fur); // torso/chest
  W.ball(-0.5, b + 7, 1.5, 3.4, 3.2, 2.4, (x, y) => (y < b + 7 ? AUL : AU)); // chest
  // left fore-leg planted, right fore-leg on the ball
  W.box(-5, b, 2, -3, b + 6, 4, (x, y, z) => (y === b + 3 && z === 4 ? AUL : md(y, 3) === 0 && z === 4 ? AUD : AU));
  for (const x of [-5, -4, -3]) { W.set(x, b, 5, AUL); W.set(x, b + 1, 5, AU); }
  W.ball(2.5, b + 2.6, 5, 2.8, 2.8, 2.8, (x, y, z) => (md(x + y + z, 3) === 0 ? M.red : md(x - y + z, 4) === 0 ? AUD : md(x + y, 2) ? AUH : AUL)); // embroidered ball
  W.box(1, b + 5, 3, 4, b + 7, 4, AU); W.box(1, b + 5, 5, 4, b + 6, 6, AU); for (const x of [1, 2, 3, 4]) { W.set(x, b + 5, 7, x % 2 ? AUD : AUL); W.set(x, b + 6, 6, AUL); } // paw on ball
  // collar with bells
  for (let x = -5; x <= 4; x++) W.set(x, b + 10, 3, md(x, 2) ? M.red : AUH);
  W.box(-1, b + 8, 4, 0, b + 9, 4, AUH);
  // head: mane of curls, square face
  const hy = b + 12;
  W.ball(-0.5, hy, 0, 6, 5.2, 4.6, (x, y, z) => (md(x + y + z, 2) ? AUD : md(x, 2) ? AU : AUL));
  for (let x = -6; x <= 5; x++) for (let y = hy - 5; y <= hy + 5; y++) { // curl knobs framing the face
    const r = Math.max(Math.abs(x + 0.5) / 6, Math.abs(y - hy) / 5.2); if (r > 0.78 && r <= 1.02) W.set(x, y, 4, md(x + y, 2) ? AUL : AUD);
  }
  W.box(-4, hy - 4, 4, 3, hy + 3, 5, AUL); // face plate
  W.box(-4, hy + 3, 5, 3, hy + 3, 5, AUS); for (const x of [-4, -3, 2, 3]) W.set(x, hy + 4, 5, AUD); // brows
  for (const ex of [-3, 1]) { W.box(ex, hy + 1, 6, ex + 1, hy + 2, 6, EYE); W.set(ex + (ex < 0 ? 1 : 0), hy + 1, 6, M.ink); W.set(ex + (ex < 0 ? 1 : 0), hy + 2, 6, M.ink); }
  W.box(-1, hy - 1, 6, 0, hy + 1, 7, AU); W.box(-2, hy - 1, 6, 1, hy - 1, 6, AUD); W.set(-1, hy - 1, 7, M.ink); W.set(0, hy - 1, 7, M.ink); // nose
  W.box(-3, hy - 4, 6, 2, hy - 2, 6, "#7a1c12"); W.box(-2, hy - 4, 6, 1, hy - 4, 6, "#d84a3a"); // open mouth + tongue
  for (const x of [-3, 2]) { W.set(x, hy - 2, 6, EYE); W.set(x, hy - 4, 6, EYE); } W.box(-3, hy - 5, 5, 2, hy - 5, 6, AU); // fangs, chin
  for (const x of [-4, 3]) { W.set(x, hy - 3, 6, AU); W.set(x, hy - 2, 7, AUL); } // whisker pads
  for (const ex of [-6, 5]) W.box(ex, hy + 1, 0, ex, hy + 3, 2, AUD); // ears
  for (let x = -5; x <= 4; x++) for (let z = -3; z <= 3; z++) if (md(x + z, 2) === 0 && Math.abs(z) + Math.abs(x + 0.5) < 7) W.set(x, hy + 5 + (Math.abs(x + 0.5) < 3 ? 1 : 0), z, md(x, 4) ? AUL : AUH); // top curls
  // mane locks down the back, curly tail fan
  for (let y = b + 6; y <= hy - 2; y++) for (let x = -4; x <= 3; x++) if (md(x + y, 2) === 0) W.set(x, y, -5 - (y < b + 10 ? 0 : 0), md(y, 4) ? AUD : AU);
  for (let i = 0; i < 5; i++) W.ball(-0.5 + (i % 2 ? 1.5 : -1.5), b + 3 + i * 1.4, -8, 1.6, 1.4, 1.3, md(i, 2) ? AUL : AU);
  return W.g;
}

/** Huabiao: carved marble column on an octagonal base, wrapped by a coiling jade dragon whose head rears out to the
 *  front clutching a flaming pearl; cloud board near the top, disc cap with a crouching gilded hou. Grid 48, ~43 tall. */
export function dragonStatue() {
  const W = canvas(48), rnd = rng(4242);
  const JD = "#2a9a70", JDL = "#4cc490", JDD = "#1a6e50", JDH = "#a0ecc0", BELLY = "#e8e0a0";
  // octagonal stepped base with a little balustrade
  for (let y = 0; y <= 4; y++) { const r = [11.5, 11, 9.5, 8.5, 8.5][y]; W.disc(-0.5, y, -0.5, r, (x, yy, z) => (y === 4 ? (md(x + z, 4) ? MARL : MARD) : y === 0 ? MARS : (Math.hypot(x + 0.5, z + 0.5) > r - 1.2 ? (y % 2 ? MAR : MARD) : undefined))); }
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, x = Math.round(-0.5 + Math.cos(a) * 10.2), z = Math.round(-0.5 + Math.sin(a) * 10.2); W.set(x, 1, z, MAR); W.set(x, 2, z, k % 3 ? MAR : MARL); W.set(x, 3, z, k % 3 ? undefined : MARL); }
  const top = 32;
  for (let y = 5; y <= top; y++) W.disc(-0.5, y, -0.5, 2.9, () => (rnd() < 0.18 ? MARD : MAR)); // column
  for (let y = 5; y <= top; y += 6) W.disc(-0.5, y, -0.5, 3.2, MARL);
  // cloud board (yunban) across the column, curled ends
  for (let x = -8; x <= 7; x++) { const d = Math.abs(x + 0.5), lift = d > 6 ? 1 : 0; for (let y = 28; y <= 29; y++) W.set(x, y + lift, 0, y === 29 ? MARL : MAR); W.set(x, 28 + lift, -1, MARD); }
  for (const x of [-8, 7]) { W.set(x, 31, 0, MARL); W.set(x + (x < 0 ? 1 : -1), 31, 0, MAR); }
  W.disc(-0.5, top + 1, -0.5, 4.2, MARD); W.disc(-0.5, top + 2, -0.5, 4.8, (x, y, z) => (md(x + z, 2) ? MARL : MAR)); W.disc(-0.5, top + 3, -0.5, 3.8, MARL);
  // dragon body: a thick helix ending at the front, tapering to a flame-tipped tail at the bottom
  const turns = 2.25, y0 = 6, y1 = 25, steps = 260, endA = Math.PI / 2, startA = endA - turns * Math.PI * 2;
  const tube = (cx, y, cz, th, ang) => W.ball(cx, y, cz, th, th, th, (x, yy, z) => {
    const out = (x + 0.5) * Math.cos(ang) + (z + 0.5) * Math.sin(ang) - 4.3; // radial offset from tube centre line
    if (yy < y - th * 0.4 && out < 0.6) return BELLY;
    return yy > y + th * 0.5 ? JDL : md(Math.round(x * 2 + yy + z), 4) === 0 ? JDD : JD;
  });
  let end;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, ang = startA + t * turns * Math.PI * 2, y = y0 + (y1 - y0) * t, th = 0.9 + 1.25 * Math.min(1, t * 4);
    const cx = -0.5 + Math.cos(ang) * 4.3, cz = -0.5 + Math.sin(ang) * 4.3;
    tube(cx, y, cz, th, ang);
    if (i % 7 === 0 && t > 0.05) W.set(Math.round(-0.5 + Math.cos(ang) * (4.3 + th)), Math.round(y + th), Math.round(-0.5 + Math.sin(ang) * (4.3 + th)), M.gold); // dorsal fins
    if (i % 65 === 40) { // legs with gold claws gripping the column
      const lx = -0.5 + Math.cos(ang + 0.4) * 5.2, lz = -0.5 + Math.sin(ang + 0.4) * 5.2;
      W.ball(lx, y - 1.5, lz, 1, 1.4, 1, JD); W.set(Math.round(lx), Math.round(y - 3), Math.round(lz), M.gold); W.set(Math.round(-0.5 + Math.cos(ang + 0.4) * 3.6), Math.round(y - 3), Math.round(-0.5 + Math.sin(ang + 0.4) * 3.6), M.gold);
    }
    end = { cx, cz, y };
  }
  for (const [dx, dy, c] of [[0, -1, M.orange], [1, -2, M.gold], [-1, -2, M.orange]]) W.set(Math.round(-0.5 + Math.cos(startA) * 4.3) + dx, y0 + dy, Math.round(-0.5 + Math.sin(startA) * 4.3), c); // tail flame
  // neck rising out and forward
  for (let i = 0; i <= 10; i++) { const t = i / 10; tube(end.cx, end.y + 4 * t, end.cz + 2.5 * t, 2.1, Math.PI / 2); }
  const hy = 30, hz = 6; // head (faces +Z)
  W.box(-3, hy - 1, hz, 2, hy + 3, hz + 4, (x, y) => (y === hy + 3 ? JDL : JD)); // skull
  W.box(-2, hy - 1, hz + 5, 1, hy + 1, hz + 7, JD); W.box(-2, hy + 2, hz + 5, 1, hy + 2, hz + 6, JDL); // snout
  W.box(-2, hy, hz + 8, 1, hy + 1, hz + 8, JDD); W.set(-2, hy + 1, hz + 8, M.gold); W.set(1, hy + 1, hz + 8, M.gold); // nose + nostrils
  W.box(-2, hy - 4, hz + 2, 1, hy - 3, hz + 7, JD); // open lower jaw
  W.box(-1, hy - 3, hz + 3, 0, hy - 3, hz + 6, "#d84a3a"); // tongue
  for (const x of [-2, 1]) { W.set(x, hy - 2, hz + 7, EYE); W.set(x, hy - 2, hz + 5, EYE); W.set(x, hy - 2, hz + 6, "#7a1c12"); W.set(x, hy - 1 - 0, hz + 6 + 1, EYE); } // fangs
  for (const ex of [-3, 2]) { W.box(ex, hy + 1, hz + 3, ex, hy + 2, hz + 4, EYE); W.set(ex, hy + 1, hz + 4, M.ink); W.box(ex, hy + 3, hz + 3, ex, hy + 3, hz + 5, JDH); } // eyes + brows
  for (const hx of [-2, 1]) { W.set(hx, hy + 4, hz + 1, M.gold); W.set(hx, hy + 5, hz, M.gold); W.set(hx, hy + 6, hz - 1, M.gold); W.set(hx + (hx < 0 ? -1 : 1), hy + 6, hz - 1, M.goldD); W.set(hx, hy + 7, hz - 2, M.goldD); } // antlers
  for (const sx of [-1, 1]) for (let i = 1; i <= 4; i++) W.set(sx < 0 ? -2 - i : 1 + i, hy - (i > 2 ? 1 : 0), hz + 7 - (i > 3 ? 1 : 0), JDH); // whiskers
  for (let x = -4; x <= 3; x++) for (let y = hy - 2; y <= hy + 4; y++) if (md(x + y, 2) === 0) W.set(x, y, hz - 1, md(y, 3) ? JDD : JDH); // mane
  W.box(-2, hy - 5, hz + 3, 1, hy - 5, hz + 5, JDH); // beard
  // fore-claw holding the flaming pearl out front
  for (let i = 0; i <= 6; i++) { const t = i / 6; W.ball(1.5 + 1.5 * t, 22 + 1.5 * t, 4 + 5 * t, 1, 1, 1, JD); }
  W.ball(3, 23.5, 10.5, 1.8, 1.8, 1.8, (x, y) => (y > 24 ? "#fff6c8" : "#f8e090"));
  for (const [x, y, z, c] of [[3, 26, 10, M.orange], [3, 27, 11, "#f8a040"], [1, 25, 11, M.orange], [5, 25, 10, M.orange], [3, 23, 12, M.gold], [2, 22, 9, M.gold], [4, 22, 9, M.gold]]) W.set(x, y, z, c);
  // crouching gilded hou on the cap, facing +Z
  const cy = top + 4;
  W.ball(-0.5, cy + 0.5, -1, 2.2, 1.6, 2.6, (x, y) => (y > cy ? AUL : AU)); // crouching body
  W.box(-2, cy - 1, 1, -2, cy, 2, AU); W.box(1, cy - 1, 1, 1, cy, 2, AU); // fore-legs
  W.box(-2, cy + 2, 1, 1, cy + 4, 3, (x, y, z) => (y === cy + 4 ? AUL : AU)); // head, raised to the sky
  W.box(-2, cy + 2, 0, 1, cy + 5, 0, (x, y) => (md(x + y, 2) ? AUD : AU)); // mane
  for (const ex of [-2, 1]) { W.set(ex, cy + 3, 4, M.ink); W.set(ex, cy + 5, 1, AUD); } W.box(-1, cy + 2, 4, 0, cy + 2, 4, "#7a1c12"); W.box(-1, cy + 3, 4, 0, cy + 3, 4, AUL);
  W.set(-1, cy + 1, -4, AUD); W.set(0, cy + 2, -4, AU); // tail
  return W.g;
}

/** Bronze tripod ding incense burner (round belly, upright loop handles, verdigris patina, smouldering sticks) on a
 *  plinth, with a thin curl of smoke. Grid 24, ~14 tall (+ smoke wisp). */
export function incenseBurner() {
  const W = canvas(24), rnd = rng(777);
  plinth(W, 7, 6, 3, 0);
  const y0 = 3, pat = (c) => (rnd() < 0.14 ? PAT : rnd() < 0.05 ? PATL : c);
  for (const a of [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3]) { // three cabriole legs
    const lx = -0.5 + Math.cos(a) * 3.2, lz = -0.5 + Math.sin(a) * 3.2;
    for (let y = y0; y <= y0 + 3; y++) { const o = y === y0 ? 0.6 : 0; W.set(Math.round(lx + Math.cos(a) * o), y, Math.round(lz + Math.sin(a) * o), y === y0 ? BZD : BZ); }
    W.set(Math.round(lx + Math.cos(a)), y0, Math.round(lz + Math.sin(a)), BZD); // hoof
  }
  const prof = [3.2, 4.3, 4.9, 5.1, 5.0, 4.6, 4.3, 4.8]; // belly profile (y0+3 ..)
  prof.forEach((r, i) => { const y = y0 + 3 + i; W.disc(-0.5, y, -0.5, r, (x, yy, z) => {
    if (Math.hypot(x + 0.5, z + 0.5) < r - 1.1 && i > 0) return undefined;
    if (i === prof.length - 1) return md(x + z, 2) ? BZH : BZL; // rim
    if (i === 3 || i === 4) { const a = Math.atan2(z + 0.5, x + 0.5), k = Math.floor((a + Math.PI) / (Math.PI / 6)); return md(k + i, 2) ? BZH : BZD; } // taotie band
    return pat(i === 0 ? BZD : i < 3 ? BZ : BZL);
  }); });
  W.disc(-0.5, y0 + 9, -0.5, 3.4, "#4a3a2e"); for (let i = 0; i < 6; i++) W.set(Math.round(-3 + rnd() * 5), y0 + 9, Math.round(-3 + rnd() * 5), "#7a6a5a"); // ash
  for (const x of [-5, 4]) { W.box(x, y0 + 11, -2, x, y0 + 13, -2, BZ); W.box(x, y0 + 11, 1, x, y0 + 13, 1, BZ); W.box(x, y0 + 13, -1, x, y0 + 13, 0, BZL); } // loop handles
  for (const [x, z] of [[-2, -1], [0, 0], [1, -2], [-1, 1]]) { W.box(x, y0 + 10, z, x, y0 + 11, z, "#b88848"); W.set(x, y0 + 12, z, M.orange); } // incense sticks
  const SM = ["#e8eaf0", "#d6d8e2", "#f6f6fa"]; let sx = 0, sz = -1;
  for (let y = y0 + 13; y <= y0 + 18; y++) { sx += Math.sin(y * 1.1) * 0.8; sz += Math.cos(y * 0.8) * 0.4; W.set(Math.round(sx), y, Math.round(sz), SM[y % 3]); if (y < y0 + 16) W.set(Math.round(sx) + (y % 2 ? 1 : -1), y, Math.round(sz), SM[(y + 1) % 3]); }
  return W.g;
}
