// The ground, low-poly: one flat-shaded triangle heightfield over the whole mountain (2-unit cells in the city, 4 in
// the world rect, 8 and 16 further out, stitched crack-free), coloured per face: gentle faces show the painted ground
// texture (streets, fields, paddies — the one big texture), cliffs get banded rock strata from the shader, river
// banks coursed masonry, everything outside the world rect plain vertex colour (grass, forest, rock, snow).
// Plus stone stairs (the city's stair streets and the zig-zag stair), boulders, grass tufts, bushes and crops.
import * as THREE from "three";
import * as W from "./world.js";
import { Builder, shade, rng } from "./geo.js";

const { vnoise, hash, flankRise, CITY, WX, WZ, CLIFF_Z, PLATEAU, LV, SX, SZ, ROWS, COLS, STREET, VSEG, AV_C, STAIR_HALF, POOL, RX, RIVER_HW } = W;
const sstep = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const KIND = { tex: 0, rock: 1, masonry: 2, plain: 3 };

// ---------------------------------------------------------------------------------------------------------------
// render heights: the natural terrain, with stair streets sunk a little under their stone steps (rendered separately)
// and the zig-zag stair left out (its masonry steps stand on the natural slope)
function stairStreet(x, z) {
  if (x < CITY.x0 || x > CITY.x1 || z < SZ[0] + STREET / 2 || z > SZ[ROWS] - STREET / 2) return false;
  let r = 0; while (r < ROWS - 1 && z >= SZ[r + 1]) r++;
  if (LV[r] === LV[r + 1] || Math.abs(z - SZ[r]) <= STREET / 2 || Math.abs(z - SZ[r + 1]) <= STREET / 2) return false;
  for (let c = 0; c <= COLS; c++) if (VSEG[c][r] === "street" && Math.abs(x - SX[c]) < STAIR_HALF(c) + 0.5) return true;
  return false;
}
/** The terrace cliffs inside the city are resampled on a 6-unit lattice along x, so each face breaks into chunky
 *  vertical facets (the low-poly rock look) instead of following every bump. */
function cityCliff(x, z) {
  if (x < CITY.x0 + 2 || x > CITY.x1 - 2 || z < SZ[0] + STREET / 2 || z > SZ[ROWS] - STREET / 2) return false;
  let r = 0; while (r < ROWS - 1 && z >= SZ[r + 1]) r++;
  if (LV[r] === LV[r + 1] || Math.abs(z - W.cliffZ(r, x)) > W.CLIFF_W + 9 || W.liftAt(r, x)) return false;
  for (let c = 0; c <= COLS; c++) if (Math.abs(x - SX[c]) < STAIR_HALF(c) + 8) return false;
  return !W.inRiver(x, z, 8);
}
/** Nearest point of the zig-zag stair: {d, y} (distance to its centre line and the step height there), or null far away. */
function stairNear(x, z) {
  const f = W.FIELDS[4]; if (x < CITY.x1 - 12 || x > f.x + 16 || z < f.z - 12 || z > f.z + 150) return null;
  const P = W.upStair().pts; let best = null;
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L)), d = Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
    if (!best || d < best.d) { const len = Math.sqrt(L), s = (Math.floor((t * len) / 2) * 2) / Math.max(1, len); best = { d, y: Math.round(a.y + (b.y - a.y) * Math.min(1, s)) }; } }
  return best;
}
export function renderH(x, z) {
  if (stairStreet(x, z)) return W.terrainH0(x, z) - 1.2;
  const sn = stairNear(x, z);
  if (sn && sn.d < 9) { const h0 = W.terrainH0(x, z); return Math.min(h0, sn.y - 0.4 + Math.max(0, sn.d - 4.2) * 1.6); }   // the stair's cutting through the slope
  if (cityCliff(x, z)) { const x0 = Math.floor(x / 6) * 6, t = (x - x0) / 6; return W.terrainH0(x0, z) * (1 - t) + W.terrainH0(x0 + 6, z) * t; }
  return W.terrainH0(x, z);
}

// ---------------------------------------------------------------------------------------------------------------
// face colouring
const ROCK = ["#948f88", "#837f7a", "#a19c94", "#78757a", "#8c8a86", "#aaa59c", "#968f84"];
const inCityWalls = (x, z) => x > CITY.x0 - 30 && x < CITY.x1 + 30 && z > CLIFF_Z - 2 && z < CITY.z1 + 30;
const dressed = (x, z) => inCityWalls(x, z) && (W.inRiver(x, z, 5) || Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 5);
function mountainTop(h, x, z) {
  const r = h - PLATEAU, snow = 62 + 10 * vnoise(x / 9, z / 9), rock = 30 + 6 * vnoise(x / 7 + 50, z / 7), k = hash(Math.floor(x / 8), Math.floor(z / 8));
  if (h < PLATEAU - 4) return k > 0.5 ? "#6cc04c" : "#64b648";
  return r > snow ? (k > 0.5 ? "#f4f8ff" : "#e6ecf6") : r > rock ? (k > 0.5 ? "#8aa0b0" : "#7e94a6") : r > 12 ? (k > 0.5 ? "#4f9a5a" : "#478f52") : k > 0.5 ? "#5cae48" : "#54a442";
}
function groundTop(h, x, z) {
  if (z < CLIFF_Z && h >= PLATEAU - 4) return mountainTop(h, x, z);
  const n = vnoise(x / 40, z / 40), k = hash(Math.floor(x / 6), Math.floor(z / 6));
  const rise = z < CLIFF_Z ? h - LV[0] : flankRise(x, z);
  if (rise < 8 || n > 0.62) return k > 0.5 ? "#6cbc4a" : "#64b446";
  if (n > 0.5) return k > 0.5 ? "#7a9a58" : "#6e8e50";
  return ROCK[Math.floor(k * ROCK.length)];
}
/** Face colour + kind from its centroid and normal. */
function faceStyle(cx, cy, cz, ny, inTex) {
  if (ny > 0.72) {
    if (inTex && cz >= CLIFF_Z && flankRise(cx, cz) < 8) return [KIND.tex, "#ffffff"];
    return [KIND.plain, groundTop(cy, cx, cz)];
  }
  if (dressed(cx, cz) && ny < 0.4) return [KIND.masonry, "#cfc5ae"];
  if (!inCityWalls(cx, cz) && ny > 0.5 && flankRise(cx, cz) < 8 && cz > CLIFF_Z) return [KIND.plain, hash(cx, cz) > 0.5 ? "#7aa84a" : "#8a9a52"];   // grassy banks on gentle hills
  const band = hash(Math.floor(cx / 23) + Math.floor(cz / 23) * 7, 3), moss = ny > 0.45 && vnoise(cx / 12, cz / 12 + cy / 30) > 0.62;
  const col = moss ? (cy > PLATEAU - 40 ? "#5d7a46" : "#6a7f50") : ROCK[Math.floor(band * ROCK.length)];
  return [KIND.rock, col];
}

// ---------------------------------------------------------------------------------------------------------------
// the mesher
/** Growable float buffers (the terrain is about a million triangles: plain arrays would be too heavy). */
class Buf { constructor(n = 1 << 20) { this.a = new Float32Array(n); this.n = 0; } push(...v) { if (this.n + v.length > this.a.length) { const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b; } for (const x of v) this.a[this.n++] = x; } get data() { return this.a.subarray(0, this.n); } }
class Acc { constructor() { this.P = new Buf(1 << 16); this.C = new Buf(1 << 16); this.K = new Buf(1 << 14); this.N = new Buf(1 << 16); } }
const _c = new THREE.Color();
function emitTri(tiles, a, b, c, inTex, TILE = 256) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
  const [kind, col] = faceStyle(cx, cy, cz, ny, inTex); _c.set(col);
  const key = TILE + ":" + Math.floor(cx / TILE) + ":" + Math.floor(cz / TILE); let acc = tiles.get(key); if (!acc) tiles.set(key, (acc = new Acc()));
  for (const p of [a, b, c]) { acc.P.push(p[0], p[1], p[2]); acc.N.push(nx, ny, nz); acc.C.push(_c.r, _c.g, _c.b); acc.K.push(kind); }
}
/**
 * Heightfield over [x0,x1]×[z0,z1] at cell size s (bounds multiples of s), skipping cells inside `hole`. Vertices on the
 * outer boundary that fall between the coarser neighbour's vertices (spacing `outer`) are pulled onto its edge, so the
 * regions meet without cracks. 8×8-cell chunks that are completely flat become two triangles.
 */
function region(acc, x0, x1, z0, z1, s, H, o = {}) {
  const nx = Math.round((x1 - x0) / s), nz = Math.round((z1 - z0) / s), Wd = nx + 1, h = new Float32Array(Wd * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) h[j * Wd + i] = H(x0 + i * s, z0 + j * s);
  if (o.outer) { const q = Math.round(o.outer / s);   // stitch the outer boundary to the coarser grid
    const fix = (get, set, n) => { for (let k = 0; k <= n; k++) { const a = Math.floor(k / q) * q, b = Math.min(n, a + q); if (k === a) continue; const t = (k - a) / (b - a); set(k, get(a) * (1 - t) + get(b) * t); } };
    fix((i) => h[i], (i, v) => (h[i] = v), nx); fix((i) => h[nz * Wd + i], (i, v) => (h[nz * Wd + i] = v), nx);
    fix((j) => h[j * Wd], (j, v) => (h[j * Wd] = v), nz); fix((j) => h[j * Wd + nx], (j, v) => (h[j * Wd + nx] = v), nz); }
  const hole = o.hole, inHole = (i, j) => hole && x0 + i * s >= hole.x0 && x0 + (i + 1) * s <= hole.x1 && z0 + j * s >= hole.z0 && z0 + (j + 1) * s <= hole.z1;
  const V = (i, j) => [x0 + i * s, h[j * Wd + i], z0 + j * s];
  const CH = 8;
  for (let cj = 0; cj < nz; cj += CH) for (let ci = 0; ci < nx; ci += CH) {
    const ie = Math.min(nx, ci + CH), je = Math.min(nz, cj + CH);
    let flat = true, h0 = h[cj * Wd + ci], anyHole = false;
    for (let j = cj; j <= je && flat; j++) for (let i = ci; i <= ie; i++) if (h[j * Wd + i] !== h0) { flat = false; break; }
    for (let j = cj; j < je && !anyHole; j++) for (let i = ci; i < ie; i++) if (inHole(i, j)) { anyHole = true; break; }
    if (flat && !anyHole) { const a = V(ci, cj), b = V(ci, je), c = V(ie, je), d = V(ie, cj); emitTri(acc, a, b, c, o.tex, o.tile); emitTri(acc, a, c, d, o.tex, o.tile); continue; }
    for (let j = cj; j < je; j++) for (let i = ci; i < ie; i++) {
      if (inHole(i, j)) continue;
      const a = V(i, j), b = V(i, j + 1), c = V(i + 1, j + 1), d = V(i + 1, j);
      // split along the diagonal that follows the terrain better (keeps ridges and cliff lips crisp)
      if (Math.abs(a[1] - c[1]) < Math.abs(b[1] - d[1])) { emitTri(acc, a, b, c, o.tex, o.tile); emitTri(acc, a, c, d, o.tex, o.tile); }
      else { emitTri(acc, a, b, d, o.tex, o.tile); emitTri(acc, b, c, d, o.tex, o.tile); }
    }
  }
}
const snap = (v, s, up) => (up ? Math.ceil(v / s) * s : Math.floor(v / s) * s);
/** Terrain tiles: [BufferGeometry] (position, normal, color, aKind). */
export function terrainGeometry() {
  W.upStair();
  const acc = new Map();
  const fine = { x0: snap(CITY.x0 - 48, 8), x1: snap(CITY.x1 + 48, 8, true), z0: snap(CLIFF_Z - 8, 8), z1: snap(CITY.z1 + 56, 8, true) };
  const mid = { x0: 0, x1: snap(WX, 16, true), z0: snap(CLIFF_Z - 248, 16), z1: snap(WZ, 16, true) };
  const far = { x0: snap(-1200, 32), x1: snap(WX + 1200, 32, true), z0: snap(-720, 32), z1: snap(WZ + 600, 32, true) };
  const huge = { x0: -3200, x1: snap(WX + 3200, 32, true), z0: -2560, z1: snap(WZ + 2400, 32, true) };
  region(acc, fine.x0, fine.x1, fine.z0, fine.z1, 2, renderH, { outer: 4, tex: true });
  region(acc, mid.x0, mid.x1, mid.z0, mid.z1, 4, renderH, { outer: 8, hole: fine, tex: true, tile: 512 });
  region(acc, far.x0, far.x1, far.z0, far.z1, 8, W.terrainH0, { outer: 32, hole: mid, tile: 768 });
  region(acc, huge.x0, huge.x1, huge.z0, huge.z1, 32, (x, z) => (z < -720 || x < -1200 || x > WX + 1200 || z > WZ + 600 ? farH(x, z) : W.terrainH0(x, z)), { hole: far, tile: 2048 });
  const out = [];
  for (const t of acc.values()) { const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(t.P.data.slice(), 3)); g.setAttribute("normal", new THREE.BufferAttribute(t.N.data.slice(), 3));
    g.setAttribute("color", new THREE.BufferAttribute(t.C.data.slice(), 3)); g.setAttribute("aKind", new THREE.BufferAttribute(t.K.data.slice(), 1));
    g.computeBoundingSphere(); g.computeBoundingBox(); out.push(g); }
  return out;   // one geometry per 256-unit tile
}
/** Far away: the plateau rolls into distant peaks to the north, foothills east and west, the lowland south. */
function farH(x, z) {
  const base = W.terrainH0(Math.max(-1200, Math.min(WX + 1200, x)), Math.max(-720, Math.min(WZ + 600, z)));
  const n = vnoise(x / 260, z / 260), m = vnoise(x / 90 + 7, z / 90);
  if (z < -720) return Math.round(base + Math.max(0, (n - 0.35) * 520 + (m - 0.5) * 80) * sstep((-720 - z) / 500));
  if (z > WZ + 600) return Math.round(Math.max(0, base + ((n - 0.5) * 60 + (m - 0.5) * 20) * sstep((z - WZ - 600) / 400)));
  return Math.round(Math.max(0, base + Math.max(0, (n - 0.4) * 300) * sstep((Math.abs(x - WX / 2) - WX / 2 - 1200) / 600)));
}

/** Terrain material: Lambert + per-face style (texture / rock strata / masonry / plain), from the aKind attribute. */
export function terrainMaterial(groundTex) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGround = { value: groundTex }; sh.uniforms.uWorld = { value: new THREE.Vector2(WX, WZ) };
    sh.vertexShader = "attribute float aKind;\nvarying float vKind;\nvarying vec3 vTW;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n\tvKind = aKind; vTW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;");
    sh.fragmentShader = "uniform sampler2D uGround;\nuniform vec2 uWorld;\nvarying float vKind;\nvarying vec3 vTW;\nfloat th( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }\n" +
      sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        if ( vKind < 0.5 ) {
          vec2 guv = vTW.xz / uWorld; diffuseColor.rgb *= texture2D( uGround, vec2( guv.x, 1.0 - guv.y ) ).rgb;
        } else if ( vKind < 1.5 ) {
          // layered rock: wavy horizontal strata, each with its own shade, dark seams between some of them
          float wav = 2.4 * sin( vTW.x * 0.045 + vTW.z * 0.031 ) + 1.6 * sin( vTW.z * 0.11 - vTW.x * 0.07 );
          float yy = vTW.y + wav, band = floor( yy / 5.0 ), f = fract( yy / 5.0 );
          float cell = floor( ( vTW.x + vTW.z ) / 37.0 );
          float s = mix( 0.74, 1.18, th( vec2( band, cell ) ) );
          if ( f < 0.12 && th( vec2( band, 7.0 ) ) > 0.4 ) s *= 0.66;
          s *= mix( 0.92, 1.06, th( vec2( floor( yy / 17.0 ), cell + 3.0 ) ) );
          diffuseColor.rgb *= s;
        } else if ( vKind < 2.5 ) {
          // coursed masonry: 3-high courses, 6-long blocks in running bond, darker mortar
          float course = floor( vTW.y / 3.0 ), along = ( vTW.x + vTW.z ) / 6.0 + course * 0.5;
          float mortar = step( fract( vTW.y / 3.0 ), 0.09 ) + step( fract( along ), 0.06 );
          diffuseColor.rgb *= ( 0.9 + 0.14 * th( vec2( floor( along ), course ) ) ) * ( mortar > 0.0 ? 0.74 : 1.0 );
        }`);
  };
  m.customProgramCacheKey = () => "terrain";
  return m;
}

// ---------------------------------------------------------------------------------------------------------------
// painted ground (2 texels per unit over the world rect): streets, plaza, palace courts, alleys, gardens, fields, paddies
export function groundTexture() {
  const S = 2, c = document.createElement("canvas"); c.width = WX * S; c.height = WZ * S; const g = c.getContext("2d"); g.scale(S, S);
  const R = rng(99), rnd = (a, b) => a + R() * (b - a), pick = (a) => a[Math.floor(R() * a.length)];
  const F = (x, z, w, d, col) => { g.fillStyle = col; g.fillRect(x, z, w, d); };
  const { PADDIES, FIELDS, HAMLETS, ROADS, GATE_X, RIVER, PLAZA, STATUE, CENTER, PALACE, HALL, HSEG, alleyZ, isSpecialBlock, block, cellAt, PAGODA_BLOCK } = W;
  F(0, 0, WX, WZ, "#6cbc4a");
  for (let i = 0; i < 1400; i++) { g.fillStyle = pick(["#66b646", "#72c050", "#6ab848"]); g.beginPath(); g.ellipse(rnd(0, WX), rnd(0, WZ), rnd(10, 40), rnd(8, 26), rnd(0, 3), 0, 6.3); g.fill(); }
  for (let i = 0; i < 2500; i++) { g.fillStyle = pick(["#ffffff", "#ffe050", "#ff90b0", "#b0c8ff"]); g.beginPath(); g.arc(rnd(0, WX), rnd(0, WZ), 0.5, 0, 6.3); g.fill(); }
  for (const p of PADDIES) { F(p.x - 2, p.z - 2, p.w + 4, p.d + 4, "#b89a62"); for (let z = p.z; z < p.z + p.d; z += 12) { F(p.x, z, p.w, 9, "#64b4dc"); F(p.x, z, p.w, 1, "#4a94c0"); } }
  for (const f of FIELDS) { F(f.x - 2, f.z - 2, f.w + 4, f.d + 4, "#9a7040"); F(f.x, f.z, f.w, f.d, "#b8844a"); for (let z = f.z + 1; z < f.z + f.d; z += f.crop === "wheat" ? 3 : 5) F(f.x, z, f.w, 1.2, "#9a6a38"); }
  for (const H of HAMLETS) { g.fillStyle = "#cfb084"; g.beginPath(); g.arc(H.x, H.z, 22, 0, 6.3); g.fill(); g.fillStyle = "#c2a274"; g.beginPath(); g.arc(H.x, H.z, 14, 0, 6.3); g.fill(); }
  for (const r of ROADS) { const x0 = Math.max(0, r.x), z0 = Math.max(0, r.z), x1 = Math.min(WX, r.x + r.w), z1 = Math.min(WZ, r.z + r.d); F(x0, z0, x1 - x0, z1 - z0, "#cdb084"); F(x0, z0, x1 - x0, 0.8, "#b89a6c"); }
  for (let z = CITY.z1; z < WZ; z += 4) for (let x = GATE_X - 9 + ((z / 4) % 2 ? 3 : 0); x < GATE_X + 9; x += 6) F(x + 0.3, z + 0.3, 5.4, 3.4, pick(["#e2d2a8", "#dccb9e", "#e8dab4"]));
  for (let z = CITY.z1 + 4; z < WZ; z++) { const xc = RIVER.x(z), hw = RIVER.halfW(z); F(xc - hw - 6, z, 2 * hw + 12, 1, "#e6d6a2"); F(xc - hw, z, 2 * hw, 1, "#3a8ac8"); }
  for (const dz of [CITY.z1 + 260, CITY.z1 + 360]) { const xr = RIVER.x(dz) + RIVER.halfW(dz); F(xr - 2, dz - 5, 12, 10, "#8a5a32"); for (let x = xr - 1; x < xr + 10; x += 2) F(x, dz - 5, 1.4, 10, "#b07a44"); }
  { g.fillStyle = "#d4c8aa"; g.beginPath(); g.ellipse(POOL.x, POOL.z, POOL.r + 8, POOL.r * 0.9 + 6, 0, 0, 6.3); g.fill(); }
  // the city floor
  F(CITY.x0, CITY.z0, CITY.x1 - CITY.x0, CITY.z1 - CITY.z0, "#c8b48a");
  for (let z = CITY.z0; z < CITY.z1; z += 4) for (let x = CITY.x0; x < CITY.x1; x += 4) { const k = cellAt(x + 2, z + 2); if (k === "alley" || k === "garden") F(x, z, 4, 4, "#6cbc4a"); }
  const SLAB = ["#e2d2a8", "#e2d2a8", "#dccb9e", "#e8dab4", "#ddcca0"], KERB = "#b8a47c";
  const bandH = (z) => SZ.some((sz) => Math.abs(z - sz) < STREET / 2), bandV = (x) => SX.some((sx) => Math.abs(x - sx) < STREET / 2);
  const streetAt = (x, z) => cellAt(x, z) === "street";
  for (let r = 0; r < SZ.length; r++) { const z0 = SZ[r] - STREET / 2;
    for (let x = CITY.x0; x < CITY.x1; x += 2) if (streetAt(x + 1, SZ[r]) && !bandV(x + 1)) F(x, z0, 2, STREET, "#d6c498");
    for (let row = 0; row * 4 < STREET - 2; row++) { const z = z0 + 1 + row * 4;
      for (let x = CITY.x0 + (row % 2 ? 3 : 0); x < CITY.x1; x += 6) { if (!streetAt(x + 2.5, z + 1.5) || bandV(x + 2.5)) continue; F(x + 0.25, z + 0.25, 5.5, 3.5, pick(SLAB)); } }
    for (const kz of [z0, z0 + STREET - 1]) for (let x = CITY.x0; x < CITY.x1; x += 2) if (streetAt(x + 1, kz + 0.5) && !bandV(x + 1)) F(x, kz, 2, 1, KERB); }
  for (let c = 0; c < SX.length; c++) { const x0 = SX[c] - STREET / 2;
    for (let z = CITY.z0; z < CITY.z1; z += 2) if (streetAt(SX[c], z + 1) && !bandH(z + 1)) F(x0, z, STREET, 2, "#d6c498");
    for (let col = 0; col * 4 < STREET - 2; col++) { const x = x0 + 1 + col * 4;
      for (let z = CITY.z0 + (col % 2 ? 3 : 0); z < CITY.z1; z += 6) { if (!streetAt(x + 1.5, z + 2.5) || bandH(z + 2.5)) continue; F(x + 0.25, z + 0.25, 3.5, 5.5, pick(SLAB)); } }
    for (const kx of [x0, x0 + STREET - 1]) for (let z = CITY.z0; z < CITY.z1; z += 2) if (streetAt(kx + 0.5, z + 1) && !bandH(z + 1)) F(kx, z, 1, 2, KERB); }
  for (const sx of SX) for (const sz of SZ) { if (!streetAt(sx, sz)) continue; const x0 = sx - STREET / 2, z0 = sz - STREET / 2; F(x0, z0, STREET, STREET, KERB);
    for (let z = z0 + 1; z < z0 + STREET - 1; z += 5) for (let x = x0 + 1; x < x0 + STREET - 1; x += 5) F(x + 0.2, z + 0.2, Math.min(4.6, x0 + STREET - 1 - x), Math.min(4.6, z0 + STREET - 1 - z), pick(SLAB)); }
  for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (HSEG[r][c] === "alley") {
    g.strokeStyle = "#c8b48a"; g.lineWidth = 7; g.lineCap = "round"; g.beginPath(); for (let x = SX[c] - STREET / 2; x <= SX[c + 1] + STREET / 2; x += 2) { const zc = alleyZ(r, c, x); if (x === SX[c] - STREET / 2) g.moveTo(x, zc); else g.lineTo(x, zc); } g.stroke();
    g.strokeStyle = "#ddcca0"; g.lineWidth = 4.5; g.stroke();
  }
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) { if (isSpecialBlock(c, r)) continue; const b = block(c, r);
    F(b.x - 2, b.z - 2, b.w + 4, b.d + 4, "#d0ccc0"); F(b.x, b.z, b.w, b.d, "#6cbc4a");
    if (LV[r] === LV[r + 1]) { F(b.x + 8, b.z + b.d / 2 - 4, b.w - 16, 8, "#b8844a"); for (let x = b.x + 9; x < b.x + b.w - 9; x += 3) F(x, b.z + b.d / 2 - 3, 1.4, 6, "#4ea83e"); } }
  { const pb = block(...PAGODA_BLOCK); F(pb.x - 2, pb.z - 2, pb.w + 4, pb.d + 4, "#d0ccc0"); F(pb.x, pb.z, pb.w, pb.d, "#6cbc4a"); g.fillStyle = "#ddcca0"; F(pb.x + pb.w / 2 - 3, pb.z + pb.d / 2 + 18, 6, pb.d / 2 - 18, "#ddcca0"); }
  F(PLAZA.x - 2, PLAZA.z - 2, PLAZA.w + 4, PLAZA.d + 4, "#c8b48a");
  for (let z = PLAZA.z; z < PLAZA.z + PLAZA.d; z += 6) for (let x = PLAZA.x + ((z / 6) % 2 ? 4 : 0); x < PLAZA.x + PLAZA.w; x += 8) F(x + 0.3, z + 0.3, 7.4, 5.4, pick(["#efe0b8", "#efe0b8", "#e8d6aa", "#f6eacc"]));
  g.fillStyle = "#dcd6c8"; g.beginPath(); g.arc(STATUE.x, STATUE.z, 30, 0, 6.3); g.fill();
  for (const [r, col, w] of [[31, "#d0503a", 1.6], [38, "#c2ac80", 1.2], [46, "#d0503a", 1.6]]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(CENTER.x, CENTER.z, r, 0, 6.3); g.stroke(); }
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; g.strokeStyle = "#cfc8b8"; g.lineWidth = 0.5; g.beginPath(); g.moveTo(STATUE.x + Math.cos(a) * 24, STATUE.z + Math.sin(a) * 22); g.lineTo(STATUE.x + Math.cos(a) * 30, STATUE.z + Math.sin(a) * 30); g.stroke(); }
  F(PALACE.x, PALACE.z, PALACE.w, PALACE.d, "#b4a690");
  for (let z = PALACE.z; z < PALACE.z + PALACE.d; z += 5) for (let x = PALACE.x + ((z / 5) % 2 ? 5 : 0); x < PALACE.x + PALACE.w; x += 10) F(x + 0.3, z + 0.3, 9.4, 4.4, pick(["#ddd2be", "#ddd2be", "#d4c8b2", "#e8decc"]));
  const hb = HALL.z + HALL.front;
  F(GATE_X - 13, hb - 4, 26, PALACE.d - (hb - PALACE.z) + 4, "#c8bca8"); F(GATE_X - 11, hb - 4, 22, PALACE.d - (hb - PALACE.z) + 4, "#f2eee6"); for (let z = hb; z < PALACE.z + PALACE.d; z += 6) F(GATE_X - 11, z, 22, 0.6, "#dcd4c4");
  for (const [x0, x1] of [[PALACE.x + 4, PALACE.x + 30], [PALACE.x + PALACE.w - 30, PALACE.x + PALACE.w - 4]]) F(x0, PALACE.z + 8, x1 - x0, 170, "#6cbc4a");
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------------------------------------------------------
// stone stairs: the city's stair streets (the grand stair is double width) and the zig-zag stair up the east flank
export function stairsGeometry() {
  const b = new Builder(), STEP = ["#d8ccb0", "#cdc0a2"], KERB = "#b0a688";
  for (let r = 0; r < ROWS; r++) { if (LV[r] === LV[r + 1]) continue;
    for (let c = 0; c <= COLS; c++) { if (VSEG[c][r] !== "street") continue;
      const hw = STAIR_HALF(c), x = SX[c], z0 = SZ[r] + STREET / 2, z1 = SZ[r + 1] - STREET / 2, top = LV[r], d = top - LV[r + 1], n = Math.round(d / 1.5), run = (z1 - z0) / n;
      for (let k = 0; k < n; k++) { const y = top - (d * k) / n, za = z0 + k * run;
        b.box(x - hw + 1, y - d / n - 2.5, za, x + hw - 1, y, za + run + 0.02, STEP[k % 2], { bottom: false, front: shade(STEP[k % 2], 0.86) });
        for (const sx of [-1, 1]) b.box(x + sx * (hw - 0.5) - 1, y - d / n - 3, za, x + sx * (hw - 0.5) + 1, y + 1.4, za + run + 0.02, KERB, { bottom: false }); }
      if (c === AV_C) for (const sx of [-1, 1]) for (let k = 0; k <= n; k += 6) { const y = top - (d * k) / n, za = z0 + k * run; b.cube(x + sx * (hw - 0.5), y + 1.4, za, 2.4, 1.6, 2.4, "#c8bea4"); }
    } }
  const P = W.upStair().pts;
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], c2 = P[i], dx = c2.x - a.x, dz = c2.z - a.z, len = Math.hypot(dx, dz), n = Math.max(1, Math.floor(len / 2)), ang = Math.atan2(dx, dz);
    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, s = (Math.floor((t0 * len + 0.01) / 2) * 2) / Math.max(1, len), y = Math.round(a.y + (c2.y - a.y) * Math.min(1, s));
      const cx = a.x + dx * (t0 + t1) / 2, cz = a.z + dz * (t0 + t1) / 2, foot = Math.min(y - 1, W.terrainH0(cx, cz)) - 3;
      b.at(cx, 0, cz, ang, () => { b.box(-3.6, foot, -len / n / 2 - 0.02, 3.6, y, len / n / 2 + 0.02, STEP[k % 2], { sides: "#a8a294", bottom: false }); for (const sx of [-1, 1]) b.box(sx * 3.6 - 0.5, y, -len / n / 2, sx * 3.6 + 0.5, y + 1.2, len / n / 2, KERB, { bottom: false }); }); }
    // landing at each turn
    const y = Math.round(c2.y), foot = Math.min(y - 1, W.terrainH0(c2.x, c2.z)) - 3; b.box(c2.x - 4.2, foot, c2.z - 4.2, c2.x + 4.2, y, c2.z + 4.2, STEP[0], { sides: "#a8a294", bottom: false });
  }
  return b.build();
}

// ---------------------------------------------------------------------------------------------------------------
// boulders: along the foot and lip of every terrace cliff, on the great cliff's ledges and over the flanks / countryside
export function rockSpots() {
  const out = [], R = rng(31);
  for (let r = 0; r < ROWS; r++) { if (LV[r] === LV[r + 1]) continue;
    for (let x = CITY.x0 + 4; x < CITY.x1 - 4; x += 7 + R() * 9) { if (VSEG.some((col, c) => col[r] === "street" && Math.abs(x - SX[c]) < STAIR_HALF(c) + 4) || Math.abs(x - RX) < RIVER_HW + 8 || W.liftAt(r, x)) continue;
      const zc = W.cliffZ(r, x), foot = R() < 0.6; const z = foot ? zc + W.CLIFF_W + 2 + R() * 3 : zc - W.CLIFF_W - 1 - R() * 2;
      if (W.isReserved(x - 3, z - 3, x + 3, z + 3)) continue;
      out.push({ x, z, s: foot ? 1.4 + R() * 2.2 : 0.8 + R() * 1.2 }); } }
  for (let i = 0; i < 2600; i++) { const x = -200 + R() * (WX + 400), z = CLIFF_Z - 300 + R() * (WZ - CLIFF_Z + 500);
    if (W.occupied(x, z, 4) || W.inRiver(x, z, 6)) continue; const f = flankRise(x, z);
    if (f < 10 && R() > 0.12) continue; out.push({ x, z, s: f > 10 ? 1.5 + R() * 4 : 1 + R() * 2 }); }
  return out;
}
export function rockGeometry() { const b = new Builder(); b.blob(0, 0.6, 0, 2.2, 1.7, 1.9, ["#7a7c82", "#8c8e94", "#9ea0a4", "#a8aaa8"], { seed: 5, jitter: 0.28, flat: -0.35 }); return b.build(); }
