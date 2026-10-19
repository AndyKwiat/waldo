// Time of day: a gradient sky dome with a sun glow, stars and a moon, drifting low-poly clouds, and the lighting
// palette (sun / moon key light, hemisphere, fill, fog) keyed by the hour. `skyState(tod)` is pure: main.js applies it.
import * as THREE from "three";
import { Builder, rng } from "./geo.js";

const col = (h) => new THREE.Color(h);
// keyframes: hour → palette. sky = zenith, hor = horizon, sun = key light colour/intensity, hemi sky/ground + intensity,
// fill = cool fill intensity, fog colour, exposure
const KEYS = [
  { t: 0, zen: "#030716", hor: "#16224a", sun: "#8fa8ff", si: 0.75, hs: "#34467e", hg: "#14141e", hi: 0.5, fi: 0.12, fog: "#121c3e", ex: 1.2 },
  { t: 4.6, zen: "#060c24", hor: "#1e2a58", sun: "#8fa8ff", si: 0.65, hs: "#34467e", hg: "#14141e", hi: 0.5, fi: 0.12, fog: "#16204a", ex: 1.2 },
  { t: 5.6, zen: "#1a2a5e", hor: "#d07a70", sun: "#ff9a6a", si: 0.6, hs: "#6a6aa0", hg: "#2a2228", hi: 0.55, fi: 0.2, fog: "#7a6a8a", ex: 1.15 },
  { t: 6.6, zen: "#4a7ac8", hor: "#f8c49a", sun: "#ffc08a", si: 2.0, hs: "#bcc8ea", hg: "#5a4e44", hi: 0.72, fi: 0.36, fog: "#dcc8b8", ex: 1.12 },
  { t: 8.5, zen: "#3f8fe0", hor: "#b4def6", sun: "#ffe4c0", si: 2.9, hs: "#d8e8ff", hg: "#7a6a4a", hi: 0.8, fi: 0.5, fog: "#acd8f4", ex: 1.1 },
  { t: 12, zen: "#3a8ce0", hor: "#a8d8f6", sun: "#fff0dc", si: 3.1, hs: "#dcecff", hg: "#7a6a4a", hi: 0.82, fi: 0.55, fog: "#a6d6f4", ex: 1.1 },
  { t: 15.5, zen: "#3f8ad8", hor: "#b0daf4", sun: "#ffe6c4", si: 3.0, hs: "#d8e6ff", hg: "#7a6a4a", hi: 0.8, fi: 0.52, fog: "#a8d4f0", ex: 1.1 },
  { t: 17.6, zen: "#5a80c4", hor: "#f8d0a0", sun: "#ffd098", si: 2.6, hs: "#ccd0ea", hg: "#6a5a48", hi: 0.75, fi: 0.42, fog: "#dcd0c0", ex: 1.12 },
  { t: 18.6, zen: "#40508e", hor: "#f49a70", sun: "#ffa070", si: 1.6, hs: "#a8a4d0", hg: "#4a4048", hi: 0.66, fi: 0.34, fog: "#b8a0a8", ex: 1.15 },
  { t: 19.5, zen: "#141c48", hor: "#7a4a6a", sun: "#9fb0ff", si: 0.5, hs: "#4a4a86", hg: "#1e1a24", hi: 0.52, fi: 0.16, fog: "#3a3058", ex: 1.2 },
  { t: 20.6, zen: "#050a1e", hor: "#1c2850", sun: "#8fa8ff", si: 0.75, hs: "#34467e", hg: "#14141e", hi: 0.5, fi: 0.12, fog: "#141e44", ex: 1.2 },
  { t: 24, zen: "#030716", hor: "#16224a", sun: "#8fa8ff", si: 0.75, hs: "#34467e", hg: "#14141e", hi: 0.5, fi: 0.12, fog: "#121c3e", ex: 1.2 },
].map((k) => ({ ...k, zen: col(k.zen), hor: col(k.hor), sun: col(k.sun), hs: col(k.hs), hg: col(k.hg), fog: col(k.fog) }));
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** How "night" it is (0 day … 1 night): drives lamps, windows, stars, bloom. */
export const nightness = (t) => (t < 12 ? 1 - sm(5.2, 6.8, t) : sm(18.4, 20.2, t));
const AZ = -0.62;   // the sun's compass bearing rotates through the day around this (shadows fall roughly NE at noon, like the voxel city)
/** Sun / moon direction (unit, pointing at the light) for an hour. */
export function lightDir(t, out = new THREE.Vector3()) {
  const day = (t - 6) / 12;   // 0 at 6:00 … 1 at 18:00
  if (day > -0.08 && day < 1.08) { const a = Math.PI * Math.max(0, Math.min(1, day)), el = Math.max(0.1, Math.sin(a) * 1.05), az = AZ + (day - 0.5) * 2.2;
    return out.set(-Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize(); }
  // night: the moon crosses the other way, high in the sky
  const n = ((t + 6) % 24) / 12, el = 0.62 + 0.25 * Math.sin(Math.PI * Math.max(0, Math.min(1, n))), az = AZ + 0.5 + (n - 0.5) * 1.2;
  return out.set(-Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
}
/** Interpolated palette for an hour. */
export function skyState(t) {
  t = ((t % 24) + 24) % 24; let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const A = KEYS[i], B = KEYS[i + 1], f = sm(A.t, B.t, t), L = (k) => A[k].clone().lerp(B[k], f), N = (k) => A[k] + (B[k] - A[k]) * f;
  return { zen: L("zen"), hor: L("hor"), sun: L("sun"), si: N("si"), hs: L("hs"), hg: L("hg"), hi: N("hi"), fi: N("fi"), fog: L("fog"), ex: N("ex"), night: nightness(t), dir: lightDir(t), sunUp: t > 5.6 && t < 18.9 };
}

function radial(stops, size = 128) {
  const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d"), r = size / 2, grd = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [t, cc] of stops) grd.addColorStop(t, cc); g.fillStyle = grd; g.fillRect(0, 0, size, size); return new THREE.CanvasTexture(c);
}
function moonTexture() {
  const S = 128, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d");
  g.fillStyle = "#f4f1e6"; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.fill(); g.save(); g.clip();
  for (const [x, y, r] of [[0.38, 0.36, 0.2], [0.6, 0.3, 0.13], [0.55, 0.58, 0.17], [0.32, 0.64, 0.11], [0.72, 0.66, 0.09]]) { g.fillStyle = "rgba(150,155,175,0.55)"; g.beginPath(); g.arc(x * S, y * S, r * S, 0, 7); g.fill(); }
  g.restore(); return new THREE.CanvasTexture(c);
}

/** Sky dome + stars + moon + sun glow, following the camera. */
export function buildSky() {
  const group = new THREE.Group(), R = 3500;
  const uni = { uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSun: { value: new THREE.Color() }, uSunVis: { value: 1 } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 16), new THREE.ShaderMaterial({
    uniforms: uni, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vDir; void main() { vDir = normalize( position ); gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }",
    fragmentShader: `uniform vec3 uZen, uHor, uSun, uSunDir; uniform float uSunVis; varying vec3 vDir;
      void main() { float h = vDir.y;
        vec3 c = mix( uHor, uZen, pow( smoothstep( -0.02, 0.75, h ), 0.55 ) );
        c = mix( c, uHor * 0.55, smoothstep( 0.0, -0.25, h ) );                       // below the horizon: darker haze
        float d = max( dot( normalize( vDir ), uSunDir ), 0.0 );
        c += uSun * uSunVis * ( pow( d, 900.0 ) * 6.0 + pow( d, 60.0 ) * 0.35 + pow( d, 6.0 ) * 0.12 * smoothstep( 0.3, -0.05, h ) );
        gl_FragColor = vec4( c, 1.0 ); }`,
  }));
  dome.renderOrder = -10; dome.frustumCulled = false; group.add(dome);
  // stars
  const sp = [], sc = [], r = rng(12345);
  for (let i = 0; i < 2400; i++) { const u = r(), v = 0.05 + r() * 0.95, th = u * Math.PI * 2, y = Math.pow(v, 0.7), rr = Math.sqrt(1 - y * y);
    sp.push(Math.cos(th) * rr * (R - 60), y * (R - 60), Math.sin(th) * rr * (R - 60)); const b = 0.45 + r() * 0.55; sc.push(b, b * 0.97, b * (0.92 + r() * 0.08)); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute("color", new THREE.Float32BufferAttribute(sc, 3));
  const starMat = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, opacity: 0, depthWrite: false });
  const stars = new THREE.Points(sg, starMat); stars.renderOrder = -9; stars.frustumCulled = false; group.add(stars);
  // moon (a disc with a soft halo) — placed in the light's direction at night
  const opts = { fog: false, transparent: true, depthWrite: false };
  const moonGlow = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshBasicMaterial({ ...opts, map: radial([[0, "rgba(170,190,255,0.45)"], [0.3, "rgba(110,130,220,0.14)"], [1, "rgba(60,70,150,0)"]]), blending: THREE.AdditiveBlending }));
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(190, 190), new THREE.MeshBasicMaterial({ ...opts, map: moonTexture(), color: new THREE.Color(0.9, 0.9, 0.95) }));
  for (const m of [moonGlow, moon]) { m.renderOrder = -8; m.frustumCulled = false; group.add(m); }
  const tmp = new THREE.Vector3();
  return {
    group,
    set(st, t) {
      uni.uZen.value.copy(st.zen); uni.uHor.value.copy(st.hor); uni.uSun.value.copy(st.sun);
      // the sun disc sits a little lower than the light so street-level views catch it
      if (st.sunUp) { tmp.copy(st.dir); tmp.y = Math.max(0.03, tmp.y * 0.55); uni.uSunDir.value.copy(tmp.normalize()); }
      uni.uSunVis.value = st.sunUp ? 1 - st.night : 0;
      starMat.opacity = Math.min(1, st.night * 1.3);
      const mo = st.night; moon.visible = moonGlow.visible = mo > 0.02; moon.material.opacity = mo; moonGlow.material.opacity = mo;
      if (!st.sunUp) { tmp.copy(st.dir); tmp.y = Math.max(0.12, tmp.y * 0.7); tmp.normalize().multiplyScalar(3200); for (const m of [moonGlow, moon]) { m.position.copy(tmp); m.lookAt(0, 0, 0); } }
      void t;
    },
  };
}

/** Low-poly cumulus: clusters of faceted puffs drifting slowly east over the valley. */
export function buildClouds(W) {
  const group = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: true, emissive: new THREE.Color("#30384a") });
  const R = rng(44), clouds = [];
  for (let k = 0; k < 7; k++) {
    const b = new Builder(), n = 4 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) { const r = 26 + R() * 30; b.blob((i - n / 2) * 30 + R() * 18, R() * 10, (R() - 0.5) * 40, r * 1.3, r * 0.7, r, ["#dfe6f0", "#f4f7fb", "#ffffff"], { seed: k * 13 + i, detail: 1, jitter: 0.14, flat: -0.25 }); }
    const m = new THREE.Mesh(b.build(), mat); m.castShadow = false; m.receiveShadow = false;
    // a ring of clouds round the valley (never over the city, where the cameras look down from)
    const a = (k / 7) * Math.PI * 2 + R() * 0.5, d = 1500 + R() * 700;
    const c = { m, x: W.WX / 2 + Math.cos(a) * d, z: W.WZ / 2 - 200 + Math.sin(a) * d * 0.8, y: 820 + R() * 300, sp: 2 + R() * 3, s: 1 + R() * 0.9, a };
    m.scale.setScalar(c.s); group.add(m); clouds.push(c);
  }
  return { group, mat, update(t) { for (const c of clouds) { const sway = Math.sin(t * 0.004 * c.sp + c.a) * 160; c.m.position.set(c.x + sway, c.y, c.z + Math.cos(t * 0.003 * c.sp + c.a) * 80); } } };
}
