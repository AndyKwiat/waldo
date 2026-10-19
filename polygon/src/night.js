// Night lighting: every lantern, lit window, wall torch and brazier is splatted into one top-down light map; lit
// materials add diffuse × warm × lightmap × height falloff × uNight in their shaders (main.js), so thousands of lamps
// cost a single texture lookup. R = street-level lights (fade above ~y 20), G = high lights (a band around y 26).
export const LIGHT_KIND = {
  lantern: { r: 17, ch: 0, a: 0.95 },
  window: { r: 10, ch: 0, a: 0.32 },
  torch: { r: 22, ch: 1, a: 1.0 },
  brazier: { r: 30, ch: 1, a: 0.9 },
};

/** Splats world lights [{x, z, kind, gain?}] into a canvas covering `rect` at `res` world units per pixel. */
export function lightMapCanvas(lights, rect, res = 2) {
  const c = document.createElement("canvas"); c.width = Math.ceil(rect.w / res); c.height = Math.ceil(rect.d / res);
  const g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = "lighter";
  for (const L of lights) {
    const K = LIGHT_KIND[L.kind] ?? LIGHT_KIND.lantern, px = (L.x - rect.x) / res, pz = (L.z - rect.z) / res, r = K.r / res * (L.scale ?? 1), a = K.a * (L.gain ?? 1);
    const gr = g.createRadialGradient(px, pz, 0, px, pz, r), R = K.ch === 0 ? 255 : 0, G = K.ch === 1 ? 255 : 0;
    gr.addColorStop(0, `rgba(${R},${G},0,${a})`); gr.addColorStop(0.35, `rgba(${R},${G},0,${a * 0.45})`); gr.addColorStop(1, `rgba(${R},${G},0,0)`);
    g.fillStyle = gr; g.fillRect(px - r, pz - r, 2 * r, 2 * r);
  }
  return c;
}
