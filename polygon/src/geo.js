// Low-poly geometry builder: every model is a list of flat-shaded, vertex-coloured triangles built from a handful of
// primitives (boxes, prisms, cones, faceted blobs, curved hip roofs, beams). Output is non-indexed so each face keeps
// its own colour and normal — the faceted indie look — with no textures.
//
// Colours: "#hex" for fixed paint, or a slot colour (slot(name, shade)) that the instanced material swaps per
// instance (roof / wall / pillar / cloth), so one geometry serves every colour variant of a building.
// Glow: triangles added inside b.glowing(kind, fn) are also copied (pushed out a hair along their normal) into a
// separate glow geometry that is drawn additively at night; b.light(x, y, z, kind) records a light source.
// Parts (walk animation): b.part = [k, pivotY, pivotZ] tags following triangles for the walk shader (see main.js).
import * as THREE from "three";

export const SLOTS = { roof: 1, wall: 2, pillar: 3, cloth: 4 };
export const SLOT_DEFAULT = { roof: "#3a9ab0", wall: "#f6e8c8", pillar: "#d0402e", cloth: "#e04a3a" };
/** A slot colour: the instance's slot colour × shade. */
export const slot = (name, shade = 1) => ({ slot: SLOTS[name], shade });
export const ROOF = (k = 1) => slot("roof", k), WALLC = (k = 1) => slot("wall", k), PIL = (k = 1) => slot("pillar", k), CLOTHC = (k = 1) => slot("cloth", k);

const CC = new Map();
function rgb(c) {
  if (typeof c === "string") { let v = CC.get(c); if (!v) { const t = new THREE.Color(c); v = [t.r, t.g, t.b]; CC.set(c, v); } return v; }
  if (Array.isArray(c)) return c;
  if (c && c.isColor) return [c.r, c.g, c.b];
  return [1, 0, 1];
}
/** Lighten / darken a hex colour (sRGB space), returns hex. */
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return "#" + [16, 8, 0].map((s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f))).toString(16).padStart(2, "0")).join("");
}
export function mix(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  return "#" + [16, 8, 0].map((s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t).toString(16).padStart(2, "0")).join("");
}
/** Deterministic RNG. */
export function rng(seed = 1) { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const GLOW_EMIT = { lantern: [1.0, 0.45, 0.2], window: [1.0, 0.7, 0.34], dim: [0.5, 0.28, 0.12], fire: [1.0, 0.55, 0.15] };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();

export class Builder {
  constructor() {
    this.P = []; this.N = []; this.C = []; this.S = []; this.A = []; this.G = { P: [], C: [] };
    this.M = new THREE.Matrix4(); this.stack = []; this.part = null; this.glow = null; this.lights = []; this.anyPart = false;
  }
  // ---- transforms (applied to everything added afterwards; save() restores)
  save(fn) { this.stack.push(this.M.clone()); try { fn(); } finally { this.M = this.stack.pop(); } return this; }
  t(x, y, z) { this.M.multiply(new THREE.Matrix4().makeTranslation(x, y, z)); return this; }
  ry(a) { if (a) this.M.multiply(new THREE.Matrix4().makeRotationY(a)); return this; }
  rx(a) { if (a) this.M.multiply(new THREE.Matrix4().makeRotationX(a)); return this; }
  rz(a) { if (a) this.M.multiply(new THREE.Matrix4().makeRotationZ(a)); return this; }
  sc(x, y = x, z = x) { this.M.multiply(new THREE.Matrix4().makeScale(x, y, z)); return this; }
  /** Run fn at (x, y, z) turned by ry. */
  at(x, y, z, ry, fn) { if (typeof ry === "function") { fn = ry; ry = 0; } return this.save(() => { this.t(x, y, z).ry(ry); fn(); }); }
  glowing(kind, fn) { const g = this.glow; this.glow = kind; try { fn(); } finally { this.glow = g; } return this; }
  /** Record a light source at local (x, y, z) (transformed). kind: lantern | window | torch | brazier. */
  light(x, y, z, kind = "lantern") { const p = new THREE.Vector3(x, y, z).applyMatrix4(this.M); this.lights.push({ x: p.x, y: p.y, z: p.z, kind }); return this; }

  // ---- raw triangles
  tri(a, b, c, col) {
    _a.set(a[0], a[1], a[2]).applyMatrix4(this.M); _b.set(b[0], b[1], b[2]).applyMatrix4(this.M); _c.set(c[0], c[1], c[2]).applyMatrix4(this.M);
    _n.crossVectors(_e1.subVectors(_b, _a), _e2.subVectors(_c, _a)); const len = _n.length(); if (len < 1e-9) return this; _n.multiplyScalar(1 / len);
    let r, g, bl, s = 0;
    if (col && col.slot) { r = g = bl = col.shade; s = col.slot; } else [r, g, bl] = rgb(col);
    for (const v of [_a, _b, _c]) { this.P.push(v.x, v.y, v.z); this.N.push(_n.x, _n.y, _n.z); this.C.push(r, g, bl); this.S.push(s); }
    const p = this.part; if (p) this.anyPart = true; for (let k = 0; k < 3; k++) this.A.push(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0);
    if (this.glow) { const e = GLOW_EMIT[this.glow] ?? GLOW_EMIT.window, o = 0.04;
      for (const v of [_a, _b, _c]) { this.G.P.push(v.x + _n.x * o, v.y + _n.y * o, v.z + _n.z * o); this.G.C.push(...e); } }
    return this;
  }
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); return this; }
  /** Polygon fan (convex, CCW seen from the front). */
  poly(pts, col) { for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0], pts[i], pts[i + 1], col); return this; }

  // ---- primitives
  /** Axis-aligned box [x0,x1]×[y0,y1]×[z0,z1]. o: {top, bottom: false to skip, sides: colour, inset: shrink the top face by (ix, iz)}. */
  box(x0, y0, z0, x1, y1, z1, col, o = {}) {
    const ix = o.inset?.[0] ?? o.inset ?? 0, iz = o.inset?.[1] ?? o.inset ?? 0, side = o.sides ?? col, top = o.top ?? col;
    const A = [x0, y0, z1], B = [x1, y0, z1], C = [x1, y1 - 0, z1], D = [x0, y1, z1];   // front (+z) bottom-left, bottom-right, top-right, top-left
    const tA = [x0 + ix, y1, z1 - iz], tB = [x1 - ix, y1, z1 - iz], tC = [x1 - ix, y1, z0 + iz], tD = [x0 + ix, y1, z0 + iz];
    const bA = [x0, y0, z1], bB = [x1, y0, z1], bC = [x1, y0, z0], bD = [x0, y0, z0];
    void A; void B; void C; void D;
    this.quad(bA, bB, tB, tA, o.front ?? side);          // +z
    this.quad(bC, bD, tD, tC, o.back ?? side);           // -z
    this.quad(bB, bC, tC, tB, o.right ?? side);          // +x
    this.quad(bD, bA, tA, tD, o.left ?? side);           // -x
    this.quad(tA, tB, tC, tD, top);                      // top
    if (o.bottom !== false) this.quad(bD, bC, bB, bA, o.bottom ?? side);
    return this;
  }
  /** Box by centre (x, z), base y, size w × h × d. */
  cube(cx, y0, cz, w, h, d, col, o) { return this.box(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2, col, o); }
  /** Vertical prism / frustum with n sides: centre (cx, cz), y0..y1, bottom radius r0, top radius r1. o: {top, bottom:false, rot, rz (z-scale)} */
  cyl(cx, y0, cz, r0, y1, r1, n, col, o = {}) {
    const rot = o.rot ?? (n === 4 ? Math.PI / 4 : 0), kz = o.kz ?? 1, top = o.top ?? col, bot = o.bottomCol ?? col;
    const P = (r, y, k) => { const a = rot + (k / n) * Math.PI * 2; return [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r * kz]; };
    for (let k = 0; k < n; k++) {
      const a0 = P(r0, y0, k), a1 = P(r0, y0, k + 1), b0 = P(r1, y1, k), b1 = P(r1, y1, k + 1);
      if (r1 > 1e-6) this.quad(a1, a0, b0, b1, o.sideCols ? o.sideCols[k % o.sideCols.length] : col); else this.tri(a1, a0, b0, col);
      if (r1 > 1e-6 && o.top !== false) this.tri([cx, y1 + (o.dome ?? 0), cz], b1, b0, top);
      if (o.bottom !== false && r0 > 1e-6) this.tri([cx, y0, cz], a0, a1, bot);
    }
    return this;
  }
  cone(cx, y0, cz, r, h, n, col, o = {}) { return this.cyl(cx, y0, cz, r, y0 + h, 0, n, col, o); }
  /** Prism along an arbitrary segment p→q (beams, poles, ropes): square (n = 4) or n-gon section of radius r. */
  beam(p, q, r, col, n = 4, o = {}) {
    const a = new THREE.Vector3(...p), b = new THREE.Vector3(...q), d = new THREE.Vector3().subVectors(b, a), len = d.length(); if (len < 1e-6) return this;
    const m = new THREE.Matrix4().lookAt(a, b, Math.abs(d.y / len) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
    // lookAt makes -z point from a to b; build the prism along -z in that frame
    return this.save(() => { this.M.multiply(new THREE.Matrix4().makeTranslation(a.x, a.y, a.z)).multiply(m).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
      this.cyl(0, 0, 0, r, len, o.r1 ?? r, n, col, { rot: n === 4 ? Math.PI / 4 : 0, bottom: o.caps !== false, top: o.caps === false ? false : undefined }); });
  }
  /** Faceted blob: an icosahedron (detail 0 or 1) scaled to rx × ry × rz with jittered vertices (canopies, rocks, hay). */
  blob(cx, cy, cz, rx, ry, rz, col, o = {}) {
    const g = new THREE.IcosahedronGeometry(1, o.detail ?? 0), p = g.attributes.position, R = rng(o.seed ?? 7), jit = o.jitter ?? 0.18, cache = new Map();
    const vert = (i) => { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
      let v = cache.get(k); if (!v) { const j = 1 + (R() - 0.5) * 2 * jit; v = [cx + x * rx * j, cy + Math.max(o.flat ?? -1, y) * ry * j, cz + z * rz * j]; cache.set(k, v); } return v; };
    const cols = Array.isArray(col) ? col : null;
    for (let i = 0; i < p.count; i += 3) {
      const a = vert(i), b = vert(i + 1), c = vert(i + 2), my = (a[1] + b[1] + c[1]) / 3 - cy;
      const pickC = cols ? cols[Math.max(0, Math.min(cols.length - 1, Math.floor(((my / ry + 1) / 2) * cols.length + (R() - 0.5) * 1.2)))] : col;
      this.tri(a, b, c, pickC);
    }
    g.dispose(); return this;
  }
  /** Flat polygon on the ground plane at height y (CCW from above): pts [[x,z],…]. */
  flat(pts, y, col) { return this.poly(pts.map(([x, z]) => [x, y, z]).reverse(), col); }
  /**
   * Curved hip roof (Chinese style) over [x0,x1]×[z0,z1] at eave height y: concave slopes rising h to a ridge along the
   * longer axis, overhang ov, corners swept up by `up`. o: {col, under, fascia, ridge, bands, ridgeLen (0..1 ridge fraction),
   * pyramid, gable}. Colours default to the roof slot.
   */
  roof(x0, x1, z0, z1, y, h, o = {}) {
    const ov = o.ov ?? 2, up = o.up ?? 1.6, K = o.bands ?? 4, E = 3;   // E: points per edge segment (curved eave line)
    const X0 = x0 - ov, X1 = x1 + ov, Z0 = z0 - ov, Z1 = z1 + ov, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
    const hx = (X1 - X0) / 2, hz = (Z1 - Z0) / 2, along = o.axis ?? (hx >= hz ? "x" : "z");
    const short = along === "x" ? hz : hx, long = along === "x" ? hx : hz;
    const ridgeHalf = o.pyramid ? 0 : Math.max(0, long - short) * (o.ridgeLen ?? 1) + (o.pyramid ? 0 : 0);
    const col = o.col ?? ROOF(1), colB = o.col2 ?? ROOF(0.88), under = o.under ?? ROOF(0.55), fascia = o.fascia ?? ROOF(1.35);
    const prof = (s) => Math.pow(s, o.pow ?? 1.7);   // concave: shallow at the eave, steep at the ridge
    // ring k: a rectangle (in "along/short" coords) shrunk toward the ridge
    const ring = (k) => {
      const s = k / K, sh = short * (1 - s), lo = ridgeHalf + (long - ridgeHalf) * (1 - s), yy = y + h * prof(s);
      const pts = []; // walk the rectangle: corners and E-1 points between, CCW from above
      const corners = [[-lo, -sh], [lo, -sh], [lo, sh], [-lo, sh]];
      for (let c = 0; c < 4; c++) { const [a0, b0] = corners[c], [a1, b1] = corners[(c + 1) % 4];
        for (let e = 0; e < E; e++) { const u = e / E, a = a0 + (a1 - a0) * u, b = b0 + (b1 - b0) * u;
          const edgeT = Math.abs(u - 0.5) * 2;   // 1 at the corners
          const lift = (k === 0 ? up : k === 1 ? up * 0.3 : 0) * Math.pow(edgeT, 2.2);
          pts.push(along === "x" ? [cx + a, yy + lift, cz + b] : [cx + b, yy + lift, cz + a]); } }
      return pts;
    };
    const rings = []; for (let k = 0; k <= K; k++) rings.push(ring(k));
    const n = rings[0].length;
    // orientation-safe triangles: facing up (roof surface) / down (underside) / outward (fascia)
    const ny = (a, b, c) => (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const face = (a, b, c, col, wantUp) => { const v = ny(a, b, c); if (Math.abs(v) < 1e-9) return; if ((v > 0) === wantUp) this.tri(a, b, c, col); else this.tri(a, c, b, col); };
    for (let k = 0; k < K; k++) { const A = rings[k], B = rings[k + 1], c = k % 2 ? colB : col;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; face(A[i], A[j], B[j], c, true); face(A[i], B[j], B[i], c, true); } }
    // underside (seen from below the eaves) and a thin bright fascia along the eave
    const R0 = rings[0], inner = ring(Math.min(K, 1)).map((p) => [p[0], p[1] - 0.6, p[2]]);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; face(R0[j], R0[i], inner[i], under, false); face(R0[j], inner[i], inner[j], under, false); }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, a = R0[i], b = R0[j], a2 = [a[0], a[1] - 0.7, a[2]], b2 = [b[0], b[1] - 0.7, b[2]];
      const mx = (a[0] + b[0]) / 2 - cx, mz = (a[2] + b[2]) / 2 - cz, nx = -(b[2] - a[2]), nz = b[0] - a[0];   // candidate normal of (a2, b2, b)
      if (nx * mx + nz * mz >= 0) this.quad(a2, b2, b, a, fascia); else this.quad(b2, a2, a, b, fascia); }
    // ridge beam with upturned ends, and hip ridges down to the swept corners
    const top = y + h, rc = o.ridge ?? ROOF(0.5);
    if (o.ridge !== false) {
      if (ridgeHalf > 0.5) { const a = along === "x" ? [cx - ridgeHalf - 0.6, top, cz] : [cx, top, cz - ridgeHalf - 0.6], b = along === "x" ? [cx + ridgeHalf + 0.6, top, cz] : [cx, top, cz + ridgeHalf + 0.6];
        this.beam(a, b, 0.75, rc, 4);
        for (const p of [a, b]) this.beam(p, along === "x" ? [p[0] + Math.sign(p[0] - cx) * 1.6, p[1] + 1.8, p[2]] : [p[0], p[1] + 1.8, p[2] + Math.sign(p[2] - cz) * 1.6], 0.55, rc, 4); }
      const cornerIdx = [0, E, 2 * E, 3 * E];
      for (const ci of cornerIdx) { const p = rings[0][ci], q = rings[K][ci]; this.beam([p[0], p[1] + 0.35, p[2]], [q[0], q[1] + 0.35, q[2]], 0.45, rc, 4); }
    }
    if (o.finial) { const fy = top + 0.5; this.cyl(cx, fy, cz, 0.9, fy + 1.2, 0.5, 6, o.finial).cone(cx, fy + 1.2, cz, 0.7, 2.6, 6, o.finial); }
    return this;
  }

  /** Bake into a BufferGeometry (+ glow geometry, lights, column tops for sky occlusion). */
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute("aSlot", new THREE.Float32BufferAttribute(this.S, 1));
    if (this.anyPart) g.setAttribute("aPart", new THREE.Float32BufferAttribute(this.A, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    let glow = null;
    if (this.G.P.length) { glow = new THREE.BufferGeometry(); glow.setAttribute("position", new THREE.Float32BufferAttribute(this.G.P, 3)); glow.setAttribute("color", new THREE.Float32BufferAttribute(this.G.C, 3)); glow.computeBoundingSphere(); }
    g.userData = { glow, lights: this.lights, tris: this.P.length / 9 };
    return g;
  }
}

/** Column tops of a geometry for the sky-occlusion bake: {size, tops} with tops[z*S+x] = highest y + 1 over that 1×1 cell (0 = empty). */
export function columnTops(geo) {
  const p = geo.attributes.position.array, bb = geo.boundingBox ?? (geo.computeBoundingBox(), geo.boundingBox);
  const S = 2 * Math.ceil(Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x), Math.abs(bb.min.z), Math.abs(bb.max.z))) + 2, H = S / 2, tops = new Float32Array(S * S);
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i], ay = p[i + 1], az = p[i + 2], bx = p[i + 3], by = p[i + 4], bz = p[i + 5], cx = p[i + 6], cy = p[i + 7], cz = p[i + 8];
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    const x0 = Math.floor(Math.min(ax, bx, cx) + H), x1 = Math.ceil(Math.max(ax, bx, cx) + H), z0 = Math.floor(Math.min(az, bz, cz) + H), z1 = Math.ceil(Math.max(az, bz, cz) + H);
    for (let zi = Math.max(0, z0); zi < Math.min(S, z1); zi++) for (let xi = Math.max(0, x0); xi < Math.min(S, x1); xi++) {
      const x = xi + 0.5 - H, z = zi + 0.5 - H; let y;
      if (Math.abs(den) < 1e-6) { y = Math.max(ay, by, cy); if (!(x >= Math.min(ax, bx, cx) && x <= Math.max(ax, bx, cx))) continue; }
      else { const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, l3 = 1 - l1 - l2;
        if (l1 < -0.02 || l2 < -0.02 || l3 < -0.02) continue; y = l1 * ay + l2 * by + l3 * cy; }
      if (y + 1 > tops[zi * S + xi]) tops[zi * S + xi] = y + 1;
    }
  }
  return { size: S, tops };
}
