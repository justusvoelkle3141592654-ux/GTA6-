// terrain, coast and the sea: everything that only depends on world coordinates (no city objects)
export const BLOCK = 520;
export const ROAD = 150;
export const GRID = 16; // city blocks per axis
export const WORLD = GRID * BLOCK + ROAD; // city size (8470)
export const EXT = 9000; // countryside and sea around the city (about 1.6 times the old area)
export const MAP_MIN = -EXT;
export const MAP_MAX = WORLD + EXT;
export const MAP_SIZE = MAP_MAX - MAP_MIN;
export const HIGHWAYS = [3, 8, 13];
export const lineC = (i: number) => i * BLOCK + ROAD / 2; // centre of street line i
export const WATER_Y = -5; // sea level (the renderer's water plane)

// the sea surrounds the city on three sides: the bay in the west, the harbour sea in the east, open sea in the south
export const COAST = { west: -260, east: WORLD + 250, south: WORLD + 250 }; // straight beach, quay wall and promenade
export const BAY = { west: -3400, east: WORLD + 3400, north: -1700, tipY: WORLD + 2200 }; // outer shores of the bays
export const ISLAND = { x: WORLD * 0.5, y: WORLD + 2950, r: 720 };
export const EDGE_LAND = 800; // the land ends at cliffs this far inside the map border (deep sea below)
export const SOFT_EDGE = 700; // boats, swimmers and the helicopter are pushed back inside this distance from the border
// flat places outside the city
export const HELIPAD = { x: WORLD - 500, y: -620, r: 170 };
export const STUNT_PARK = { x0: WORLD - 1500, x1: WORLD + 60, y0: -2700, y1: -1080 };
// the state prison north of the city (gate to the east, at the northern highway on line 8) and a gas station
export const PRISON = { x0: 3380, x1: 4080, y0: -1720, y1: -1020 };
export const GAS_STATION = { x: lineC(8) + 175, y: -880, w: 150, h: 110 };
// the 24/7 shop next to it (a walkable room, door to the west)
export const GAS_SHOP = { x0: GAS_STATION.x + 92, x1: GAS_STATION.x + 192, y0: GAS_STATION.y - 50, y1: GAS_STATION.y + 50 };
export const TUNNEL_HILL = { x: lineC(8), y: -3050, rx: 1150, ry: 700, h: 300 };
export const VILLA_HILL = { x: 2300, y: -1650, r: 1000, h: 150 };

export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iy: number) {
  let h = (ix * 374761393 + iy * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export const sstep = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export const inCity = (x: number, y: number) => x >= 0 && y >= 0 && x <= WORLD && y <= WORLD;
export function cityDist(x: number, y: number) {
  return Math.max(0, -x, x - WORLD, -y, y - WORLD);
}
// distance to the map border (negative outside the map)
export const edgeDist = (x: number, y: number) => Math.min(x - MAP_MIN, MAP_MAX - x, y - MAP_MIN, MAP_MAX - y);

// ---------------- coast: signed distance, > 0 on land, < 0 in the sea
interface CoastInfo { d: number; cliff: boolean; island: boolean; }
const CI: CoastInfo = { d: 0, cliff: false, island: false };
function coastRaw(x: number, y: number): CoastInfo {
  const near = cityDist(x, y);
  const wob = (vnoise(x / 520 + 3.7, y / 520 + 8.1) - 0.5) * 2 * sstep(300, 1400, near); // straight coast next to the city
  const wob2 = (vnoise(x / 230 + 1.3, y / 230 + 5.9) - 0.5) * 2;
  const city = Math.min(x - COAST.west, COAST.east - x, COAST.south - y);
  const north = BAY.north - y + wob * 260;
  const west = Math.min(BAY.west - x + wob * 300, BAY.tipY - y + wob * 300);
  const east = Math.min(x - BAY.east + wob * 300, BAY.tipY - y + wob * 300);
  const island = ISLAND.r - Math.hypot(x - ISLAND.x, y - ISLAND.y) + wob2 * 110;
  const inner = Math.max(city, north, west, east, island);
  const edge = edgeDist(x, y) - EDGE_LAND + wob2 * 160 + wob * 120;
  CI.cliff = edge < inner; CI.island = island >= inner && island > -400;
  CI.d = Math.min(inner, edge);
  return CI;
}

// ---------------- the water mask: one connected sea, checked with a flood fill
export const MASK_N = 1024;
const CELL = MAP_SIZE / MASK_N;
let mask: Uint8Array | null = null; // 0 land, 1 sea (connected), 2 water that was cut off (turned into land)
export let maskCells = 0;

function buildMask() {
  const n = MASK_N, m = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = MAP_MIN + (i + 0.5) * CELL, y = MAP_MIN + (j + 0.5) * CELL;
    m[j * n + i] = coastRaw(x, y).d < 0 ? 2 : 0;
  }
  // flood fill from the open sea in the south; everything reached is the one sea
  const stack = new Int32Array(n * n);
  let sp = 0;
  const seed = (n - 2) * n + (n >> 1);
  if (m[seed] === 2) { m[seed] = 1; stack[sp++] = seed; }
  while (sp > 0) {
    const c = stack[--sp], ci = c % n, cj = (c / n) | 0;
    if (ci > 0 && m[c - 1] === 2) { m[c - 1] = 1; stack[sp++] = c - 1; }
    if (ci < n - 1 && m[c + 1] === 2) { m[c + 1] = 1; stack[sp++] = c + 1; }
    if (cj > 0 && m[c - n] === 2) { m[c - n] = 1; stack[sp++] = c - n; }
    if (cj < n - 1 && m[c + n] === 2) { m[c + n] = 1; stack[sp++] = c + n; }
  }
  let sea = 0, cut = 0;
  for (let k = 0; k < m.length; k++) { if (m[k] === 1) sea++; else if (m[k] === 2) cut++; }
  maskCells = sea;
  mask = m;
  console.info(`Wasser: 1 zusammenhängende Fläche, ${sea} Zellen${cut ? ` (${cut} abgetrennte Zellen zu Land gemacht)` : ""}`);
}
export function waterMask(): Uint8Array { if (!mask) buildMask(); return mask!; }
const maskAt = (x: number, y: number) => {
  const m = waterMask();
  const i = Math.floor((x - MAP_MIN) / CELL), j = Math.floor((y - MAP_MIN) / CELL);
  if (i < 0 || j < 0 || i >= MASK_N || j >= MASK_N) return 1;
  return m[j * MASK_N + i];
};

// signed coast distance with cut-off basins turned into land
export function coast(x: number, y: number): CoastInfo {
  const c = coastRaw(x, y);
  if (c.d < 0 && maskAt(x, y) === 2) c.d = 30;
  return c;
}
export function seaDist(x: number, y: number): number { return -coast(x, y).d; }
// the only water test of the game (boats, swimming, AI, spawning, maps)
export const isWater = (x: number, y: number) => coastRaw(x, y).d < 0 && maskAt(x, y) !== 2;
// deep sea below the cliffs at the world border (falling in there costs nothing)
export const isEdgeSea = (x: number, y: number) => edgeDist(x, y) < EDGE_LAND + 260 && isWater(x, y);

// ---------------- the tunnel of the northern highway (line 8) through the tunnel hill
// between the portals the road keeps a straight grade; where the hill is low the road runs in a cut,
// where it is high enough the road goes through a bored tunnel (terrainH is the hill on top of it)
export const TUNNEL = { x: lineC(8), yA: -2250, yB: -3850, hw: 92, bore: 58, clear: 46 };
let tunFloor: [number, number] | null = null;
export function tunnelFloor(y: number): number {
  if (!tunFloor) tunFloor = [baseH(TUNNEL.x, TUNNEL.yA), baseH(TUNNEL.x, TUNNEL.yB)];
  const t = Math.max(0, Math.min(1, (TUNNEL.yA - y) / (TUNNEL.yA - TUNNEL.yB)));
  return tunFloor[0] + (tunFloor[1] - tunFloor[0]) * t;
}
const CUT_HW = TUNNEL.hw + 70; // the cut with its embankments
const inTunnelBand = (x: number, y: number) => Math.abs(x - TUNNEL.x) < TUNNEL.hw && y < TUNNEL.yA && y > TUNNEL.yB;
// floor height inside the bored part of the tunnel, NaN elsewhere
export function tunnelAt(x: number, y: number): number {
  if (!inTunnelBand(x, y)) return NaN;
  const f = tunnelFloor(y);
  return baseH(TUNNEL.x, y) - f >= TUNNEL.bore ? f : NaN; // the centre line decides (the same as for the cut)
}

// ---------------- height
export function terrainH(x: number, y: number): number {
  const h = baseH(x, y);
  // road cut in front of the portals: flat under the road, then sloped embankments up (or down) to the hill
  const dx = Math.abs(x - TUNNEL.x);
  if (dx < CUT_HW && y < TUNNEL.yA + 60 && y > TUNNEL.yB - 60) {
    const yc = Math.max(TUNNEL.yB, Math.min(TUNNEL.yA, y)), f = tunnelFloor(yc);
    if (baseH(TUNNEL.x, yc) - f < TUNNEL.bore) {
      const k = Math.max(0, dx - (ROAD / 2 + 10)) * 1.25 + Math.max(0, Math.abs(y - yc)) * 1.25;
      return h > f ? Math.min(h, f + k) : Math.max(h, f - k);
    }
  }
  return h;
}
function baseH(x: number, y: number): number {
  const d = cityDist(x, y);
  if (d < 220 && x > COAST.west + 30 && x < COAST.east - 30 && y < COAST.south - 30) return 0;
  const c = coast(x, y);
  if (c.d < 0) {
    if (c.cliff) return WATER_Y - 90 - Math.min(60, -c.d * 0.1); // deep sea below the cliffs
    return WATER_Y - 4 - Math.min(70, -c.d * 0.05);              // sea floor
  }
  const n1 = vnoise(x / 1500 + 7.1, y / 1500 + 3.3);
  const n2 = vnoise(x / 620 + 2.2, y / 620 + 11.7);
  const n3 = vnoise(x / 260 + 5.5, y / 260 + 0.4);
  let h: number;
  if (c.island) h = (n2 * 50 + n3 * 14) * sstep(0, 260, c.d);
  else {
    const hills = n1 * 140 + n2 * 60 + n3 * 18;
    const ramp = sstep(220, 1100, d);
    const mnt = sstep(1700, 3600, d) * (0.4 + 0.6 * vnoise(x / 1900 + 1.3, y / 1900 + 9.1)) * 520;
    const ridge = sstep(1900, 3400, d) * Math.pow(vnoise(x / 700 + 4.4, y / 700 + 2.9), 2) * 320;
    h = hills * ramp + mnt + ridge;
    // the hill the tunnel goes through and the villa hill above the city
    const tx = (x - TUNNEL_HILL.x) / TUNNEL_HILL.rx, ty = (y - TUNNEL_HILL.y) / TUNNEL_HILL.ry;
    h += TUNNEL_HILL.h * (1 - sstep(0, 1, Math.hypot(tx, ty)));
    h += VILLA_HILL.h * (1 - sstep(0, 1, Math.hypot(x - VILLA_HILL.x, y - VILLA_HILL.y) / VILLA_HILL.r));
    // high plateau along the border: the land ends at a steep cliff
    const e = edgeDist(x, y);
    h = Math.max(h, (90 + n2 * 70) * (1 - sstep(EDGE_LAND + 500, EDGE_LAND + 1800, e)));
    if (!c.cliff) h *= sstep(0, 450, c.d); // beaches along the bays
  }
  // flat places
  const pad = Math.hypot(x - HELIPAD.x, y - HELIPAD.y);
  if (pad < HELIPAD.r * 1.6) h *= sstep(HELIPAD.r * 0.55, HELIPAD.r * 1.6, pad);
  const sp = STUNT_PARK, out = Math.max(sp.x0 - x, x - sp.x1, sp.y0 - y, y - sp.y1);
  if (out < 260) h *= sstep(0, 260, out);
  for (const f of [PRISON, { x0: GAS_STATION.x - GAS_STATION.w / 2 - 20, x1: GAS_SHOP.x1 + 20, y0: GAS_STATION.y - GAS_STATION.h / 2 - 20, y1: GAS_STATION.y + GAS_STATION.h / 2 + 20 }]) {
    const o = Math.max(f.x0 - x, x - f.x1, f.y0 - y, y - f.y1);
    if (o < 260) h *= sstep(0, 260, o);
  }
  if (c.cliff) return WATER_Y - 90 + (h - WATER_Y + 90) * sstep(0, 70, c.d); // steep rock face
  return h;
}
export function terrainGrad(x: number, y: number, e = 6) {
  return { x: (terrainH(x + e, y) - terrainH(x - e, y)) / (2 * e), y: (terrainH(x, y + e) - terrainH(x, y - e)) / (2 * e) };
}
