// The statue's proportions (shared by its model in models.js and the pigeons' perches in the sim).
// Local coords around the pedestal centre; the figure faces +z (south, down the avenue).
export const PED = { t1: [23, 20, 4], t2: [20.5, 17.5, 8], die: [16, 13, 15] };   // half-width x, half-depth z, top y of each tier
export const FIG = { base: 15, shoulderY: 64, shoulderX: 10, headY: 74, headR: 5.2 };
export const EAGLE = { x: 9.5, z: 8, y: 15 };

/** Spots where pigeons can perch on the statue: the pedestal ledges, the figure's shoulders, head and raised arm. */
export const PERCHES = (() => {
  const out = [], [dx, dz, top] = PED.die;
  for (const z of [-10.5, -6, -2, 2, 6, 10.5]) for (const s of [-1, 1]) out.push({ x: s * (dx - 1.5), y: top, z });
  for (const x of [-12, -7, -2, 3]) for (const s of [-1, 1]) out.push({ x, y: top, z: s * (dz - 1.2) });
  for (const [hx, hz, y] of [PED.t2, PED.t1]) {
    const lx = (y === PED.t2[2] ? PED.die : PED.t2)[0], lz = (y === PED.t2[2] ? PED.die : PED.t2)[1];
    for (const z of [-8, 0, 8]) for (const s of [-1, 1]) out.push({ x: s * (lx + hx) / 2, y, z });
    for (const x of [-12, 0, 12]) for (const s of [-1, 1]) out.push({ x, y, z: s * (lz + hz) / 2 });
  }
  out.push({ x: -FIG.shoulderX + 1, y: FIG.shoulderY + 2.2, z: -1 }, { x: FIG.shoulderX - 1.5, y: FIG.shoulderY + 2.2, z: -1 }, { x: 0, y: FIG.headY + FIG.headR + 0.6, z: 0 }, { x: 14, y: 75.5, z: 1 });
  return out;
})();
