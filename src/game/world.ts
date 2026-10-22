export const BLOCK = 520;
export const ROAD = 150;
export const GRID = 11; // city blocks per axis
export const WORLD = GRID * BLOCK + ROAD; // city size
export const EXT = 7500; // countryside around the city
export const MAP_MIN = -EXT;
export const MAP_MAX = WORLD + EXT;
export const MAP_SIZE = MAP_MAX - MAP_MIN;
export const HIGHWAYS = [2, 5, 8];
export const H_SCALE = 1.6; // building wall height -> world height
export const roofOf = (b: Building) => b.height * H_SCALE + 14;
export const RAMP_MAX_ROOF = 230; // buildings with a roof up to this height get a ramp

// A ramp is a sloped surface. Height rises from 0 at the low end to h at the lip.
export interface Ramp {
  x0: number; y0: number; // minimum corner
  l: number; w: number;   // length along the axis, width across it
  alongX: boolean;        // true: axis is x, false: axis is y
  rising: 1 | -1;         // 1: height grows towards +axis, -1: towards -axis
  h: number;              // height at the lip
  bld: Building | null;   // building this ramp leads onto (null = free launch ramp)
}

export interface Building {
  x: number; y: number; w: number; h: number; height: number;
  wall: string; wallDark: string; roof: string; neon: string | null; detail: number; seed: number;
}
export interface Tree { x: number; y: number; r: number; rot: number; }
export type BlockKind = "city" | "park" | "plaza";
export interface Block { bx: number; by: number; kind: BlockKind; buildings: Building[]; trees: Tree[]; }

export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- terrain ----------------
function hash2(ix: number, iy: number) {
  let h = (ix * 374761393 + iy * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const sstep = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export const inCity = (x: number, y: number) => x >= 0 && y >= 0 && x <= WORLD && y <= WORLD;
export function cityDist(x: number, y: number) {
  return Math.max(0, -x, x - WORLD, -y, y - WORLD);
}

// ---------------- the bay west of the city (real water) ----------------
export const WATER_Y = -5;                  // sea level (the renderer's water plane)
const BAY = { x0: -3400, x1: -260, y0: -1900, y1: WORLD + 1900 };
const CAUSEWAY = 110;                       // the highways cross the bay on dams (half width)
// distance to the coast: > 0 in the water, < 0 on land (very negative far away)
export function seaDist(x: number, y: number): number {
  if (x > BAY.x1 + 200 || x < BAY.x0 - 500 || y < BAY.y0 - 500 || y > BAY.y1 + 500) return -1000;
  const wob = (vnoise(x / 420 + 3.7, y / 420 + 8.1) - 0.5) * 360 * sstep(500, 900, -x); // straight beach next to the city
  let d = Math.min(x - BAY.x0, BAY.x1 - x, y - BAY.y0, BAY.y1 - y) + wob;
  for (let i = 0; i < HIGHWAYS.length; i++) d = Math.min(d, Math.abs(y - (HIGHWAYS[i] * BLOCK + ROAD / 2)) - CAUSEWAY);
  return d;
}
export const isWater = (x: number, y: number) => seaDist(x, y) > 0;
// flat ground for the helipad east of the harbour
export const HELIPAD = { x: WORLD + 520, y: 1900, r: 170 };

// airfield east of the harbour: a flat runway (north-south) between two highways, hangar and tower beside it
export const AIRFIELD = { x: WORLD + 760, y0: 2860, y1: 4060, hw: 55 };
function airfieldDist(x: number, y: number) {
  const dx = Math.max(0, Math.abs(x - (AIRFIELD.x + 70)) - (AIRFIELD.hw + 160)), dy = Math.max(0, AIRFIELD.y0 - 40 - y, y - AIRFIELD.y1 - 40);
  return Math.hypot(dx, dy);
}

// terrain without the tunnel cuttings (the mountain itself)
export function naturalH(x: number, y: number): number {
  const d = cityDist(x, y);
  if (d < 220) return 0;
  const sd = seaDist(x, y);
  if (sd > 0) return WATER_Y - 3 - Math.min(35, sd * 0.08); // sea floor
  const ramp = sstep(220, 1100, d), shore = sstep(0, 450, -sd); // flat shore along the bay
  const n1 = vnoise(x / 1500 + 7.1, y / 1500 + 3.3);
  const n2 = vnoise(x / 620 + 2.2, y / 620 + 11.7);
  const n3 = vnoise(x / 260 + 5.5, y / 260 + 0.4);
  const hills = n1 * 140 + n2 * 60 + n3 * 18;
  const mnt = sstep(1700, 3600, d) * (0.4 + 0.6 * vnoise(x / 1900 + 1.3, y / 1900 + 9.1)) * 560;
  const ridge = sstep(1900, 3400, d) * Math.pow(vnoise(x / 700 + 4.4, y / 700 + 2.9), 2) * 340;
  const edge = 1 - sstep(EXT - 1000, EXT - 320, d);
  const pad = Math.hypot(x - HELIPAD.x, y - HELIPAD.y);
  return (hills * ramp + mnt + ridge) * edge * shore * (pad < HELIPAD.r ? sstep(HELIPAD.r * 0.55, HELIPAD.r, pad) : 1) * sstep(0, 280, airfieldDist(x, y));
}

// ---------------- highway tunnels through the mountains ----------------
// The road inside runs on a straight slope between the two ends. "covered" is the part inside the mountain:
// walls, ceiling and a lid on top; before and after it the road runs in an open cutting.
export const TUN_HW = 82;            // half width between the walls
export const TUN_H = 72;             // clear height above the road
export const TUN_PORTAL = 80;        // length of the concrete portal block at each end
const TUN_CUT = 92, TUN_SLOPE = 70;  // open cutting: flat to TUN_CUT, slopes up to the hills within TUN_SLOPE
export const TUN_SIDE = TUN_CUT + TUN_SLOPE; // half width of everything that belongs to a tunnel
export interface Tunnel {
  name: string; alongX: boolean; c: number; // axis and position of the highway
  s0: number; s1: number; h0: number; h1: number; // road ends (s0 < s1) and their heights
  cov0: number; cov1: number;                     // inside the mountain (the portal blocks are in front of these)
  top0: number; top1: number;                     // height of the portal blocks
}
function makeTunnel(name: string, alongX: boolean, c: number, a: number, b: number): Tunnel {
  const s0 = Math.min(a, b), s1 = Math.max(a, b);
  const at = (s: number) => (alongX ? naturalH(s, c) : naturalH(c, s));
  const h0 = at(s0), h1 = at(s1);
  let cov0 = NaN, cov1 = NaN;
  for (let s = s0; s <= s1; s += 10) if (at(s) - (h0 + ((h1 - h0) * (s - s0)) / (s1 - s0)) > 100) { if (Number.isNaN(cov0)) cov0 = s; cov1 = s; }
  const t: Tunnel = { name, alongX, c, s0, s1, h0, h1, cov0, cov1, top0: 0, top1: 0 };
  // portal blocks reach a little over the hillside around them
  const top = (sa: number, sb: number) => {
    let m = -Infinity;
    for (let s = sa; s <= sb; s += 10) for (let d = -TUN_SIDE; d <= TUN_SIDE; d += 10) m = Math.max(m, alongX ? naturalH(s, c + d) : naturalH(c + d, s));
    return Math.max(m + 6, tunnelRoad(t, sb) + TUN_H + 14);
  };
  t.top0 = top(cov0 - TUN_PORTAL, cov0); t.top1 = top(cov1, cov1 + TUN_PORTAL);
  return t;
}
export const tunnelRoad = (t: Tunnel, s: number) => t.h0 + ((t.h1 - t.h0) * Math.max(0, Math.min(1, (s - t.s0) / (t.s1 - t.s0))));
export const TUNNELS: Tunnel[] = [
  makeTunnel("WESTTUNNEL", true, HIGHWAYS[0] * BLOCK + ROAD / 2, -3400, -6000),
  makeTunnel("SÜDTUNNEL", false, HIGHWAYS[1] * BLOCK + ROAD / 2, 8470, 11070),
];
// tunnel at (x, y): along-axis position s and distance d from the middle of the road
function tunnelAt(x: number, y: number): { t: Tunnel; s: number; d: number } | null {
  for (const t of TUNNELS) {
    const s = t.alongX ? x : y, d = Math.abs((t.alongX ? y : x) - t.c);
    if (s >= t.s0 && s <= t.s1 && d < TUN_SIDE) return { t, s, d };
  }
  return null;
}
// inside the part with walls and ceiling (including the portal blocks)?
export const tubeSpan = (t: Tunnel, s: number) => s >= t.cov0 - TUN_PORTAL && s <= t.cov1 + TUN_PORTAL;

// ground height: the hills with the tunnel roads cut into them
export function terrainH(x: number, y: number): number {
  const h = naturalH(x, y);
  const tu = tunnelAt(x, y);
  if (!tu) return h;
  const { t, s, d } = tu, R = tunnelRoad(t, s);
  if (tubeSpan(t, s)) return d < TUN_CUT ? R : h; // in the tube the road, outside of it the rock
  return R + (h - R) * sstep(TUN_CUT, TUN_SIDE, d);
}
// the terrain mesh dips under the tube (the walls, ceiling and lid hide it); null: no change
export function tunnelSink(x: number, y: number): number | null {
  const tu = tunnelAt(x, y);
  if (!tu || tu.s < tu.t.cov0 || tu.s > tu.t.cov1) return null;
  return tunnelRoad(tu.t, tu.s) - 40;
}
// standing on top of a tunnel: ground height of the lid (or portal block) when z is up there, null otherwise
export function tunnelLid(x: number, y: number, z: number): number | null {
  const tu = tunnelAt(x, y);
  if (!tu || tu.d >= TUN_HW || !tubeSpan(tu.t, tu.s)) return null;
  const { t, s } = tu, R = tunnelRoad(t, s);
  if (z < R + TUN_H * 0.6) return null; // down in the tube
  if (s < t.cov0) return t.top0;
  if (s > t.cov1) return t.top1;
  return Math.max(naturalH(x, y), R + TUN_H + 8);
}
// inside a tube (between the walls, under the ceiling)?
export function inTube(x: number, y: number, z: number): { t: Tunnel; s: number; R: number } | null {
  const tu = tunnelAt(x, y);
  if (!tu || tu.d >= TUN_HW || !tubeSpan(tu.t, tu.s)) return null;
  const R = tunnelRoad(tu.t, tu.s);
  return z < R + TUN_H * 0.6 ? { t: tu.t, s: tu.s, R } : null;
}
// inside the rock above a tube (shots from the air stop there)
export function inRock(x: number, y: number, z: number): boolean {
  const tu = tunnelAt(x, y);
  if (!tu || tu.d >= TUN_HW || !tubeSpan(tu.t, tu.s)) return false;
  const R = tunnelRoad(tu.t, tu.s), lid = tunnelLid(x, y, Infinity) ?? -Infinity;
  return z > R + TUN_H && z < lid;
}
// close to a tunnel / the airfield (no trees or rocks there)
export function nearTunnel(x: number, y: number, m: number): boolean {
  for (const t of TUNNELS) {
    const s = t.alongX ? x : y, d = Math.abs((t.alongX ? y : x) - t.c);
    if (s > t.cov0 - TUN_PORTAL - m && s < t.cov1 + TUN_PORTAL + m && d < TUN_SIDE + m) return true;
  }
  return false;
}
export const nearAirfield = (x: number, y: number, m: number) => airfieldDist(x, y) < m;
// highest surface (aircraft and the police helicopter fly over it)
export function surfaceH(x: number, y: number): number {
  const h = terrainH(x, y), lid = tunnelLid(x, y, Infinity);
  return lid === null ? h : Math.max(h, lid);
}
export function terrainGrad(x: number, y: number, e = 6) {
  return { x: (terrainH(x + e, y) - terrainH(x - e, y)) / (2 * e), y: (terrainH(x, y + e) - terrainH(x, y - e)) / (2 * e) };
}
export function isHighway(x: number, y: number) {
  for (const i of HIGHWAYS) {
    const c = i * BLOCK + ROAD / 2;
    if (Math.abs(x - c) < ROAD / 2 || Math.abs(y - c) < ROAD / 2) return true;
  }
  return false;
}

const WALLS = [
  ["#3b2d52", "#251a38", "#4a3a66"], ["#2f3d55", "#1c2639", "#3d4e6b"], ["#4d2f45", "#30192b", "#5e3b55"],
  ["#2d4a4a", "#1a2e2f", "#3a5c5c"], ["#4a3f35", "#2e2620", "#5c4e42"], ["#55546a", "#343445", "#68677f"],
  ["#d9b7a0", "#9e7f6c", "#e8cdb9"], ["#9fd3c7", "#6a9990", "#b8e6dc"], ["#e6a3c0", "#a96f88", "#f2bfd4"],
];
const NEONS = ["#ff3cac", "#2bf0ff", "#ffd23f", "#9d4dff", "#3dff8b", "#ff6b3d"];

export class World {
  blocks: Block[] = [];
  rand: () => number;

  ramps: Ramp[] = [];
  extras: Building[] = []; // solid props outside the block grid (harbour containers, crane legs, airfield hangar and tower)
  // tunnel walls and portal blocks: solid boxes along the tubes, one list per tunnel with its bounding box
  tunnelSolids: { x0: number; y0: number; x1: number; y1: number; list: Building[] }[] = [];
  private extraReach = 320; // the extras are this close to the city

  constructor(seed = 1337) {
    this.rand = mulberry32(seed);
    this.generate();
    this.generateRamps();
    this.generateExtras(seed + 99);
    this.generateAirfield();
    this.generateTunnelSolids();
    this.indexRamps();
  }

  // hangar and tower next to the runway (solid; detail -1 marks them, they are not drawn as containers)
  private generateAirfield() {
    const A = AIRFIELD, mk = (x: number, y: number, w: number, h: number, roof: number, col: string): Building =>
      ({ x, y, w, h, height: (roof - 14) / H_SCALE, wall: col, wallDark: col, roof: col, neon: null, detail: -1, seed: 0 });
    this.extras.push(mk(A.x + A.hw + 90, 3280, 150, 190, 74, "#c9ccd2"), mk(A.x + A.hw + 110, 3640, 34, 34, 120, "#e8e4dc"));
    for (const e of this.extras) this.extraReach = Math.max(this.extraReach, cityDist(e.x, e.y) + Math.max(e.w, e.h) + 40);
  }

  private generateTunnelSolids() {
    const mk = (s0: number, s1: number, d0: number, d1: number, t: Tunnel, roof: number): Building => {
      const a = Math.min(s0, s1), b = Math.max(s0, s1);
      const r = t.alongX ? { x: a, y: d0, w: b - a, h: d1 - d0 } : { x: d0, y: a, w: d1 - d0, h: b - a };
      return { ...r, height: (roof - 14) / H_SCALE, wall: "#9a958c", wallDark: "#6b665e", roof: "#9a958c", neon: null, detail: -1, seed: 0 };
    };
    for (const t of TUNNELS) {
      const list: Building[] = [];
      const side = (d0: number, d1: number) => {
        // the walls in short pieces: the road climbs, every piece is just as high as needed
        for (let s = t.cov0; s < t.cov1; s += 40) {
          const e = Math.min(t.cov1, s + 40);
          list.push(mk(s, e, t.c + d0, t.c + d1, t, Math.max(tunnelRoad(t, s), tunnelRoad(t, e)) + TUN_H + 2));
        }
        list.push(mk(t.cov0 - TUN_PORTAL, t.cov0, t.c + d0, t.c + d1, t, t.top0), mk(t.cov1, t.cov1 + TUN_PORTAL, t.c + d0, t.c + d1, t, t.top1));
      };
      side(TUN_HW, TUN_SIDE + 8); side(-TUN_SIDE - 8, -TUN_HW);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const b of list) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
      this.tunnelSolids.push({ x0, y0, x1, y1, list });
    }
  }
  // solid boxes outside the block grid near (x, y): extras and tunnel walls
  private outsideSolids(x: number, y: number, pad: number, fn: (b: Building) => void) {
    if (cityDist(x, y) < this.extraReach) for (const e of this.extras) fn(e);
    for (const ts of this.tunnelSolids) if (x > ts.x0 - pad - 300 && x < ts.x1 + pad + 300 && y > ts.y0 - pad - 300 && y < ts.y1 + pad + 300) for (const b of ts.list) fn(b);
  }

  // ramps sorted into grid cells (one block wide) so height queries only test a few of them
  private rampCells: number[][] = [];
  private static readonly RC = GRID + 2; // cells per axis, the city plus one ring
  rampBld = new Set<Building>(); // buildings with a ramp onto the roof
  private indexRamps() {
    for (const rp of this.ramps) if (rp.bld) this.rampBld.add(rp.bld);
    const n = World.RC;
    this.rampCells = Array.from({ length: n * n }, () => []);
    this.ramps.forEach((rp, i) => {
      const x1 = rp.x0 + (rp.alongX ? rp.l : rp.w), y1 = rp.y0 + (rp.alongX ? rp.w : rp.l);
      for (let cy = this.rampCell(rp.y0); cy <= this.rampCell(y1); cy++) for (let cx = this.rampCell(rp.x0); cx <= this.rampCell(x1); cx++) this.rampCells[cy * n + cx].push(i);
    });
  }
  private rampCell(v: number) { return Math.max(0, Math.min(World.RC - 1, Math.floor(v / BLOCK) + 1)); }
  private rampsAt(x: number, y: number): number[] | null {
    if (x < -BLOCK || y < -BLOCK || x > WORLD + BLOCK || y > WORLD + BLOCK) return null;
    return this.rampCells[this.rampCell(y) * World.RC + this.rampCell(x)];
  }

  // harbour quay east of the city: container stacks between the highways (own seed: the city stays the same)
  private generateExtras(seed: number) {
    const r = mulberry32(seed);
    const COLS = ["#c0392b", "#1d4e89", "#e67e22", "#3c6e47", "#7d3c98", "#c9a227", "#9aa3ad"];
    const free = (y: number, h: number) => HIGHWAYS.every((i) => Math.abs(y + h / 2 - (i * BLOCK + ROAD / 2)) > ROAD / 2 + h / 2 + 30);
    for (let y = 120; y < WORLD - 120; y += 70) {
      if (r() < 0.35) continue;
      const h = 28, w = 60 + Math.floor(r() * 2) * 30;
      const x = WORLD + 40 + Math.floor(r() * 3) * 30;
      if (!free(y, h)) continue;
      const stack = 1 + Math.floor(r() * 3);
      const pal = COLS[Math.floor(r() * COLS.length)];
      this.extras.push({ x, y, w, h, height: (stack * 26) / H_SCALE - 14 / H_SCALE, wall: pal, wallDark: pal, roof: pal, neon: null, detail: stack, seed: r() });
    }
  }

  private extraHit(x: number, y: number, pad: number) {
    let hit = false;
    this.outsideSolids(x, y, pad, (e) => { if (!hit && x > e.x - pad && x < e.x + e.w + pad && y > e.y - pad && y < e.y + e.h + pad) hit = true; });
    return hit;
  }

  private generateRamps() {
    const r = this.rand;
    const L = 150, M = 18; // ramp length, inset of city buildings from block edge (see generate)
    for (const block of this.blocks) {
      if (block.kind !== "city") continue;
      const x0 = block.bx * BLOCK + ROAD, y0 = block.by * BLOCK + ROAD;
      const x1 = x0 + (BLOCK - ROAD), y1 = y0 + (BLOCK - ROAD);
      const sides = [
        { key: "W", ok: (b: Building) => Math.abs(b.x - (x0 + M)) < 2 },
        { key: "E", ok: (b: Building) => Math.abs(b.x + b.w - (x1 - M)) < 2 },
        { key: "N", ok: (b: Building) => Math.abs(b.y - (y0 + M)) < 2 },
        { key: "S", ok: (b: Building) => Math.abs(b.y + b.h - (y1 - M)) < 2 },
      ];
      for (const sd of sides) {
        if (r() > 0.25) continue;
        const bd = block.buildings.find((b) => sd.ok(b) && roofOf(b) <= RAMP_MAX_ROOF);
        if (!bd) continue;
        const h = roofOf(bd);
        if (sd.key === "W" || sd.key === "E") {
          const w = Math.max(40, Math.min(100, bd.h - 6)), cy = bd.y + bd.h / 2;
          this.ramps.push(sd.key === "W"
            ? { x0: bd.x - L, y0: cy - w / 2, l: L, w, alongX: true, rising: 1, h, bld: bd }
            : { x0: bd.x + bd.w, y0: cy - w / 2, l: L, w, alongX: true, rising: -1, h, bld: bd });
        } else {
          const w = Math.max(40, Math.min(100, bd.w - 6)), cx = bd.x + bd.w / 2;
          this.ramps.push(sd.key === "N"
            ? { x0: cx - w / 2, y0: bd.y - L, l: L, w, alongX: false, rising: 1, h, bld: bd }
            : { x0: cx - w / 2, y0: bd.y + bd.h, l: L, w, alongX: false, rising: -1, h, bld: bd });
        }
      }
    }
    // free launch ramps on the city streets (centre of the road, never on an intersection)
    for (let k = 0; k < 70; k++) {
      const horiz = r() < 0.5;
      const line = Math.floor(r() * (GRID + 1));
      const seg = Math.floor(r() * GRID);
      const len = 120, w = 110;
      const s0 = seg * BLOCK + ROAD + 20 + r() * (BLOCK - ROAD - 40 - len);
      const c = line * BLOCK + ROAD / 2 - w / 2;
      const rising = r() < 0.5 ? 1 : -1;
      const h = 40 + r() * 40;
      this.ramps.push(horiz
        ? { x0: s0, y0: c, l: len, w, alongX: true, rising, h, bld: null }
        : { x0: c, y0: s0, l: len, w, alongX: false, rising, h, bld: null });
    }
  }

  // height of the ramp surface at (x, y), 0 if no ramp is there
  rampH(x: number, y: number): number {
    let best = 0;
    const ids = this.rampsAt(x, y);
    if (!ids) return 0;
    for (const id of ids) {
      const rp = this.ramps[id];
      const s = rp.alongX ? x : y, v = rp.alongX ? y : x;
      const sA = rp.alongX ? rp.x0 : rp.y0, vA = rp.alongX ? rp.y0 : rp.x0;
      if (s < sA || s > sA + rp.l || v < vA || v > vA + rp.w) continue;
      const t = (s - sA) / rp.l;
      const hh = rp.h * (rp.rising > 0 ? t : 1 - t);
      if (hh > best) best = hh;
    }
    return best;
  }

  // index of the ramp under (x, y), -1 if none
  rampIndexAt(x: number, y: number): number {
    const ids = this.rampsAt(x, y);
    if (!ids) return -1;
    for (const i of ids) {
      const rp = this.ramps[i];
      const s = rp.alongX ? x : y, v = rp.alongX ? y : x;
      const sA = rp.alongX ? rp.x0 : rp.y0, vA = rp.alongX ? rp.y0 : rp.x0;
      if (s >= sA && s <= sA + rp.l && v >= vA && v <= vA + rp.w) return i;
    }
    return -1;
  }

  // roof height of the building whose footprint contains (x, y), -Infinity if none
  roofAt(x: number, y: number): number {
    const b = this.blockAt(x, y);
    let best = -Infinity;
    if (!b) {
      this.outsideSolids(x, y, 0, (e) => { if (x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h) best = Math.max(best, roofOf(e)); });
      return best;
    }
    for (const bd of b.buildings) {
      if (x >= bd.x && x <= bd.x + bd.w && y >= bd.y && y <= bd.y + bd.h) best = Math.max(best, roofOf(bd));
    }
    return best;
  }

  // ramp that leads onto the building containing (x, y)
  rampToRoofAt(x: number, y: number): Ramp | null {
    for (const rp of this.ramps) {
      const bd = rp.bld;
      if (bd && x >= bd.x && x <= bd.x + bd.w && y >= bd.y && y <= bd.y + bd.h) return rp;
    }
    return null;
  }

  // low (ground level) end of a ramp
  rampStart(rp: Ramp): { x: number; y: number } {
    const off = rp.rising > 0 ? 0 : rp.l;
    return rp.alongX ? { x: rp.x0 + off, y: rp.y0 + rp.w / 2 } : { x: rp.x0 + rp.w / 2, y: rp.y0 + off };
  }

  private generate() {
    const r = this.rand;
    for (let by = 0; by < GRID; by++) {
      for (let bx = 0; bx < GRID; bx++) {
        const x0 = bx * BLOCK + ROAD, y0 = by * BLOCK + ROAD;
        const size = BLOCK - ROAD;
        const roll = r();
        const center = Math.hypot(bx - GRID / 2, by - GRID / 2);
        const kind: BlockKind = roll < 0.12 ? "park" : roll < 0.2 ? "plaza" : "city";
        const block: Block = { bx, by, kind, buildings: [], trees: [] };
        const m = 18;
        if (kind === "city") {
          const tallness = Math.max(0.35, 1.25 - center / (GRID * 0.55));
          const split = r();
          const rects: [number, number, number, number][] = [];
          const ix = x0 + m, iy = y0 + m, is = size - m * 2;
          if (split < 0.3) rects.push([ix, iy, is, is]);
          else if (split < 0.6) {
            const s = is * (0.4 + r() * 0.2), gap = 14;
            if (r() < 0.5) { rects.push([ix, iy, s - gap / 2, is]); rects.push([ix + s + gap / 2, iy, is - s - gap / 2, is]); }
            else { rects.push([ix, iy, is, s - gap / 2]); rects.push([ix, iy + s + gap / 2, is, is - s - gap / 2]); }
          } else {
            const sx = is * (0.4 + r() * 0.2), sy = is * (0.4 + r() * 0.2), g = 14;
            rects.push([ix, iy, sx - g / 2, sy - g / 2]);
            rects.push([ix + sx + g / 2, iy, is - sx - g / 2, sy - g / 2]);
            rects.push([ix, iy + sy + g / 2, sx - g / 2, is - sy - g / 2]);
            rects.push([ix + sx + g / 2, iy + sy + g / 2, is - sx - g / 2, is - sy - g / 2]);
          }
          for (const [x, y, w, h] of rects) {
            const pal = WALLS[Math.floor(r() * WALLS.length)];
            const height = (40 + r() * 120 + (r() < 0.2 ? 160 : 0)) * tallness;
            block.buildings.push({ x, y, w, h, height, wall: pal[0], wallDark: pal[1], roof: pal[2], neon: r() < 0.55 ? NEONS[Math.floor(r() * NEONS.length)] : null, detail: Math.floor(r() * 4), seed: r() });
          }
        } else if (kind === "park") {
          const n = 7 + Math.floor(r() * 6);
          for (let i = 0; i < n; i++) block.trees.push({ x: x0 + 40 + r() * (size - 80), y: y0 + 40 + r() * (size - 80), r: 16 + r() * 10, rot: r() * Math.PI * 2 });
        } else {
          const s = size * 0.36;
          const pal = WALLS[Math.floor(r() * WALLS.length)];
          block.buildings.push({ x: x0 + size / 2 - s / 2, y: y0 + size / 2 - s / 2, w: s, h: s, height: 60 + r() * 60, wall: pal[0], wallDark: pal[1], roof: pal[2], neon: NEONS[Math.floor(r() * NEONS.length)], detail: 3, seed: r() });
          const c = 44;
          for (const [tx, ty] of [[c, c], [size - c, c], [c, size - c], [size - c, size - c]]) block.trees.push({ x: x0 + tx, y: y0 + ty, r: 18, rot: r() * 6 });
        }
        if (kind === "city" && r() < 0.5) {
          for (let i = 0; i < 3; i++) {
            const side = Math.floor(r() * 4), t = 40 + r() * (size - 80);
            const pts = [[x0 + t, y0 + 8], [x0 + t, y0 + size - 8], [x0 + 8, y0 + t], [x0 + size - 8, y0 + t]][side];
            block.trees.push({ x: pts[0], y: pts[1], r: 12, rot: r() * 6 });
          }
        }
        this.blocks.push(block);
      }
    }
  }

  blockAt(x: number, y: number): Block | null {
    const bx = Math.floor((x - ROAD) / BLOCK), by = Math.floor((y - ROAD) / BLOCK);
    if (bx < 0 || by < 0 || bx >= GRID || by >= GRID) return null;
    return this.blocks[by * GRID + bx];
  }

  isRoad(x: number, y: number) {
    if (!inCity(x, y)) return isHighway(x, y);
    const lx = ((x % BLOCK) + BLOCK) % BLOCK, ly = ((y % BLOCK) + BLOCK) % BLOCK;
    return lx < ROAD || ly < ROAD;
  }

  isSolid(x: number, y: number, pad = 0): boolean {
    if (x < MAP_MIN + pad || y < MAP_MIN + pad || x > MAP_MAX - pad || y > MAP_MAX - pad) return true;
    const b = this.blockAt(x, y);
    if (!b) return this.extraHit(x, y, pad);
    for (const bd of b.buildings) {
      if (x > bd.x - pad && x < bd.x + bd.w + pad && y > bd.y - pad && y < bd.y + bd.h + pad) return true;
    }
    return false;
  }

  // tree trunk (and a bit of the canopy) at (x, y)? pedestrians walk around them
  treeHit(x: number, y: number, pad = 0): boolean {
    const b = this.blockAt(x, y);
    if (!b) return false;
    for (const t of b.trees) { const r = t.r * 0.4 + pad, dx = x - t.x, dy = y - t.y; if (dx * dx + dy * dy < r * r) return true; }
    return false;
  }
  // nearest tree whose canopy covers (x, y) (hiding spots), null if none
  treeAt(x: number, y: number): Tree | null {
    const b = this.blockAt(x, y);
    if (!b) return null;
    for (const t of b.trees) { const dx = x - t.x, dy = y - t.y; if (dx * dx + dy * dy < t.r * t.r) return t; }
    return null;
  }

  lineClear(x0: number, y0: number, x1: number, y1: number, step = 40): boolean {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / step);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.isSolid(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 10)) return false;
    }
    return true;
  }

  nearbyBuildings(x: number, y: number, out: Building[]) {
    out.length = 0;
    const bx = Math.floor((x - ROAD) / BLOCK), by = Math.floor((y - ROAD) / BLOCK);
    for (let j = by - 1; j <= by + 1; j++) for (let i = bx - 1; i <= bx + 1; i++) {
      if (i < 0 || j < 0 || i >= GRID || j >= GRID) continue;
      for (const bd of this.blocks[j * GRID + i].buildings) out.push(bd);
    }
    if (!inCity(x, y)) this.outsideSolids(x, y, 0, (e) => { if (x > e.x - 60 && x < e.x + e.w + 60 && y > e.y - 60 && y < e.y + e.h + 60) out.push(e); });
    return out;
  }

  // (x, y) is inside a building / wall (grown by pad): the closest free spot next to it; returns null when it is free already
  pushOut(x: number, y: number, pad: number): { x: number; y: number } | null {
    if (!this.isSolid(x, y, pad)) return null;
    const tmp: Building[] = [];
    let px = x, py = y;
    for (let k = 0; k < 4; k++) {
      this.nearbyBuildings(px, py, tmp);
      let moved = false;
      for (const b of tmp) {
        if (!(px > b.x - pad && px < b.x + b.w + pad && py > b.y - pad && py < b.y + b.h + pad)) continue;
        const l = px - (b.x - pad), r = b.x + b.w + pad - px, t = py - (b.y - pad), bt = b.y + b.h + pad - py, m = Math.min(l, r, t, bt);
        if (m === l) px -= l + 0.5; else if (m === r) px += r + 0.5; else if (m === t) py -= t + 0.5; else py += bt + 0.5;
        moved = true; break;
      }
      if (!moved || !this.isSolid(px, py, pad)) break;
    }
    if (!this.isSolid(px, py, pad)) return { x: px, y: py };
    // stuck between several walls: search in rings around the spot
    for (let r = 10; r <= 260; r += 10) for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, qx = x + Math.cos(a) * r, qy = y + Math.sin(a) * r;
      if (!this.isSolid(qx, qy, pad)) return { x: qx, y: qy };
    }
    return { x: px, y: py };
  }

  nodePos(i: number, j: number) { return { x: i * BLOCK + ROAD / 2, y: j * BLOCK + ROAD / 2 }; }
  nearestNode(x: number, y: number) {
    const i = Math.max(0, Math.min(GRID, Math.round((x - ROAD / 2) / BLOCK)));
    const j = Math.max(0, Math.min(GRID, Math.round((y - ROAD / 2) / BLOCK)));
    return { i, j };
  }

  randomRoadPoint(r = Math.random, outside = 0.25) {
    if (r() < outside) {
      // highway point in the countryside
      const i = HIGHWAYS[Math.floor(r() * HIGHWAYS.length)];
      const c = i * BLOCK + ROAD / 2 + (r() - 0.5) * ROAD * 0.5;
      const side = r() < 0.5 ? -1 : 1;
      const along = side < 0 ? MAP_MIN + 500 + r() * (EXT - 700) : WORLD + 200 + r() * (EXT - 700);
      return r() < 0.5 ? { x: along, y: c } : { x: c, y: along };
    }
    const horiz = r() < 0.5;
    const line = Math.floor(r() * (GRID + 1));
    const along = ROAD + r() * (WORLD - ROAD * 2);
    const off = ROAD / 2 + (r() - 0.5) * ROAD * 0.5;
    return horiz ? { x: along, y: line * BLOCK + off } : { x: line * BLOCK + off, y: along };
  }

  renderMinimap(size: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const g = c.getContext("2d")!;
    const s = size / MAP_SIZE;
    g.fillStyle = "#0b3a5c";
    g.fillRect(0, 0, size, size);
    const step = 6;
    for (let py = 0; py < size; py += step) for (let px = 0; px < size; px += step) {
      const wx = MAP_MIN + (px + step / 2) / s, wy = MAP_MIN + (py + step / 2) / s;
      const d = cityDist(wx, wy);
      if (d > EXT - 330) { g.fillStyle = "#b09a6a"; }
      else {
        const h = terrainH(wx, wy);
        const t = Math.min(1, h / 600);
        const r = Math.round(50 + t * 150), gg = Math.round(100 + t * 110), b = Math.round(50 + t * 160);
        g.fillStyle = `rgb(${r},${gg},${b})`;
      }
      g.fillRect(px, py, step, step);
    }
    // highways
    g.strokeStyle = "#4a4660"; g.lineWidth = Math.max(2, ROAD * s);
    for (const i of HIGHWAYS) {
      const cc = (i * BLOCK + ROAD / 2 - MAP_MIN) * s;
      g.beginPath(); g.moveTo(cc, 0); g.lineTo(cc, size); g.moveTo(0, cc); g.lineTo(size, cc); g.stroke();
    }
    // tunnels (dashed) and the runway
    g.strokeStyle = "#1c1a24"; g.lineWidth = Math.max(2, ROAD * s * 0.7); g.setLineDash([4, 3]);
    for (const t of TUNNELS) {
      const a = (t.cov0 - TUN_PORTAL - MAP_MIN) * s, b = (t.cov1 + TUN_PORTAL - MAP_MIN) * s, c = (t.c - MAP_MIN) * s;
      g.beginPath(); if (t.alongX) { g.moveTo(a, c); g.lineTo(b, c); } else { g.moveTo(c, a); g.lineTo(c, b); } g.stroke();
    }
    g.setLineDash([]);
    g.fillStyle = "#4a4660"; g.fillRect((AIRFIELD.x - AIRFIELD.hw - MAP_MIN) * s, (AIRFIELD.y0 - MAP_MIN) * s, AIRFIELD.hw * 2 * s, (AIRFIELD.y1 - AIRFIELD.y0) * s);
    // city
    const ox = -MAP_MIN * s;
    g.fillStyle = "#3a3550";
    g.fillRect(ox, ox, WORLD * s, WORLD * s);
    // the bay
    g.fillStyle = "#0b3a5c";
    for (let py = 0; py < size; py += 3) for (let px = 0; px < size * 0.36; px += 3) {
      const wx = MAP_MIN + (px + 1.5) / s, wy = MAP_MIN + (py + 1.5) / s;
      if (isWater(wx, wy)) g.fillRect(px, py, 3, 3);
    }
    for (const b of this.blocks) {
      const x0 = ox + (b.bx * BLOCK + ROAD) * s, y0 = ox + (b.by * BLOCK + ROAD) * s, sz = (BLOCK - ROAD) * s;
      g.fillStyle = b.kind === "park" ? "#1f5a3a" : "#1a1428";
      g.fillRect(x0, y0, sz, sz);
      g.fillStyle = "#2c2342";
      for (const bd of b.buildings) g.fillRect(ox + bd.x * s, ox + bd.y * s, bd.w * s, bd.h * s);
    }
    // beach strip west, quay east
    g.fillStyle = "#d9c08a"; g.fillRect(ox - 220 * s, ox, 220 * s, WORLD * s);
    g.fillStyle = "#5c5f66"; g.fillRect(ox + WORLD * s, ox, 230 * s, WORLD * s);
    g.fillStyle = "#8a6a4a";
    for (const e of this.extras) g.fillRect(ox + e.x * s, ox + e.y * s, Math.max(1, e.w * s), Math.max(1, e.h * s));
    return c;
  }
}
