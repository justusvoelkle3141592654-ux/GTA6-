import {
  BLOCK, ROAD, GRID, WORLD, MAP_MIN, MAP_SIZE, EXT, HIGHWAYS, WATER_Y, COAST, ISLAND, HELIPAD, STUNT_PARK, VILLA_HILL, MASK_N,
  mulberry32, terrainH, terrainGrad, isWater, inCity, cityDist, lineC, waterMask, edgeDist, EDGE_LAND,
} from "./terrain";
import { RoadNet } from "./roads";
import { blockDistrict, type DistrictId } from "./districts";

export * from "./terrain";
export const H_SCALE = 1.6; // building wall height -> world height
export const roofOf = (b: Building) => (b.base ?? 0) + b.height * H_SCALE + 14;

// A ramp is a sloped surface. Height rises from 0 at the low end to h at the lip.
// It can only be driven onto over the low edge; from the sides and the back it is a wall (see Game.collideWorld).
export type RampKind = "wood" | "steel" | "concrete";
export interface Ramp {
  x0: number; y0: number; // minimum corner
  l: number; w: number;   // length along the axis, width across it
  alongX: boolean;        // true: axis is x, false: axis is y
  rising: 1 | -1;         // 1: height grows towards +axis, -1: towards -axis
  h: number;              // height of the lip above the ground
  base: number;           // ground height at the low end
  bld: Building | null;   // building roof this ramp leads onto (parking garages)
  kind: RampKind;
  jump: boolean;          // launch ramp (stunt jumps, records)
}
export const RAMP_MAX_JUMP = 22, RAMP_MAX_ROOF = 12; // steepest slopes in degrees

export interface Building {
  x: number; y: number; w: number; h: number; height: number;
  wall: string; wallDark: string; roof: string; neon: string | null; detail: number; seed: number;
  type?: number;          // facade style 0..24
  base?: number;          // ground height (buildings outside the flat city)
  garage?: boolean;       // parking garage (its roof is reached over a ramp)
  low?: boolean;          // fences, rails, containers: cars stop, but it is no building to enter
  shell?: boolean;        // wall or furniture of a walkable shop (drawn by interiors3d, not as a city building)
}
export interface Tree { x: number; y: number; r: number; rot: number; kind?: number; }
export type BlockKind = "city" | "park" | "plaza" | "site" | "lot" | "garage" | "skate" | "townhall" | "stadium" | "mall";
export interface Block { bx: number; by: number; kind: BlockKind; district: DistrictId; buildings: Building[]; trees: Tree[]; }

export function isHighway(x: number, y: number) {
  for (const i of HIGHWAYS) {
    const c = lineC(i);
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
// special blocks (bx,by)
const SPECIAL: Record<string, BlockKind> = {
  "7,2": "garage", "12,8": "garage", "3,12": "garage", "9,13": "garage", "14,4": "garage",
  "6,14": "site", "11,11": "site", "2,14": "site", "13,2": "site", "4,1": "site", "10,3": "site",
  "10,15": "lot", "5,12": "lot", "12,13": "lot", "15,3": "lot", "8,15": "skate", "7,7": "townhall", "12,14": "stadium", "9,9": "mall",
};
const M = 18; // inset of buildings from the block edge

// the ferris wheel on the beach promenade (drawn in worldmesh, solid base here)
export const FERRIS = { x: -130, y: 3.4 * BLOCK, r: 70 };

export class World {
  blocks: Block[] = [];
  rand: () => number;
  roads = new RoadNet();
  ramps: Ramp[] = [];
  extras: Building[] = []; // solid things outside the block grid (containers, villas, rails, the lighthouse ...)
  extraTrees: Tree[] = []; // palms on the island and the promenade
  pools: { x: number; y: number; w: number; h: number; z: number }[] = []; // villa pools (drawn only)
  constructor(seed = 1337) {
    this.rand = mulberry32(seed);
    waterMask();
    this.generate();
    this.generateExtras(seed + 99);
    this.indexExtras();
    this.generateRamps(seed + 7);
  }

  // ---------------- spatial index for extras and ramps (cells one block wide)
  private extraCells = new Map<number, Building[]>();
  private rampCells = new Map<number, number[]>();
  private static key(cx: number, cy: number) { return (cx + 64) * 256 + (cy + 64); }
  private static cell(v: number) { return Math.floor(v / BLOCK); }
  private indexExtras() {
    for (const e of this.extras) for (let cy = World.cell(e.y); cy <= World.cell(e.y + e.h); cy++) for (let cx = World.cell(e.x); cx <= World.cell(e.x + e.w); cx++) {
      const k = World.key(cx, cy); let l = this.extraCells.get(k); if (!l) { l = []; this.extraCells.set(k, l); } l.push(e);
    }
  }
  private indexRamp(i: number) {
    {
      const rp = this.ramps[i];
      const x1 = rp.x0 + (rp.alongX ? rp.l : rp.w), y1 = rp.y0 + (rp.alongX ? rp.w : rp.l);
      for (let cy = World.cell(rp.y0 - 30); cy <= World.cell(y1 + 30); cy++) for (let cx = World.cell(rp.x0 - 30); cx <= World.cell(x1 + 30); cx++) {
        const k = World.key(cx, cy); let l = this.rampCells.get(k); if (!l) { l = []; this.rampCells.set(k, l); } l.push(i);
      }
    }
  }
  rampsAt(x: number, y: number): number[] | undefined { return this.rampCells.get(World.key(World.cell(x), World.cell(y))); }
  private extrasAt(x: number, y: number): Building[] | undefined { return this.extraCells.get(World.key(World.cell(x), World.cell(y))); }

  // ---------------- ramps
  // local coordinates of (x, y) on ramp rp: s = 0 at the low end, l at the lip; v = 0..w across
  rampLocal(rp: Ramp, x: number, y: number) {
    const sA = rp.alongX ? rp.x0 : rp.y0, vA = rp.alongX ? rp.y0 : rp.x0;
    const s0 = (rp.alongX ? x : y) - sA, v = (rp.alongX ? y : x) - vA;
    return { s: rp.rising > 0 ? s0 : rp.l - s0, v };
  }
  // surface height of ramp rp at (x, y) (relative to nothing: absolute), -Infinity outside
  rampSurface(rp: Ramp, x: number, y: number, pad = 0) {
    const q = this.rampLocal(rp, x, y);
    if (q.s < -pad || q.s > rp.l + pad || q.v < -pad || q.v > rp.w + pad) return -Infinity;
    return rp.base + rp.h * Math.max(0, Math.min(1, q.s / rp.l));
  }
  // highest ramp surface at (x, y), 0 if no ramp is there (drawing, pedestrians)
  rampH(x: number, y: number): number {
    let best = 0;
    const ids = this.rampsAt(x, y);
    if (!ids) return 0;
    for (const id of ids) { const h = this.rampSurface(this.ramps[id], x, y); if (h > best) best = h; }
    return best;
  }
  rampIndexAt(x: number, y: number): number {
    const ids = this.rampsAt(x, y);
    if (!ids) return -1;
    for (const i of ids) if (this.rampSurface(this.ramps[i], x, y) > -Infinity) return i;
    return -1;
  }
  // direction a car must face to drive up the ramp
  rampDir(rp: Ramp) { return rp.alongX ? (rp.rising > 0 ? 0 : Math.PI) : (rp.rising > 0 ? Math.PI / 2 : -Math.PI / 2); }
  // low (ground level) end of a ramp, a bit in front of it
  rampStart(rp: Ramp, before = 0): { x: number; y: number } {
    const off = rp.rising > 0 ? -before : rp.l + before;
    return rp.alongX ? { x: rp.x0 + off, y: rp.y0 + rp.w / 2 } : { x: rp.x0 + rp.w / 2, y: rp.y0 + off };
  }
  rampLip(rp: Ramp): { x: number; y: number } {
    const off = rp.rising > 0 ? rp.l : 0;
    return rp.alongX ? { x: rp.x0 + off, y: rp.y0 + rp.w / 2 } : { x: rp.x0 + rp.w / 2, y: rp.y0 + off };
  }
  // ramp that leads onto the building containing (x, y)
  rampToRoofAt(x: number, y: number): Ramp | null {
    for (const rp of this.ramps) {
      const bd = rp.bld;
      if (bd && x >= bd.x && x <= bd.x + bd.w && y >= bd.y && y <= bd.y + bd.h) return rp;
    }
    return null;
  }
  // a ramp closer than d to (x, y) (spawn rules: nothing on or right in front of ramps)
  nearRamp(x: number, y: number, d = 30): boolean {
    const ids = this.rampsAt(x, y);
    if (!ids) return false;
    for (const i of ids) {
      const rp = this.ramps[i], q = this.rampLocal(rp, x, y);
      if (q.s > -d - 40 && q.s < rp.l + d && q.v > -d && q.v < rp.w + d) return true;
    }
    return false;
  }

  private addRamp(sx: number, sy: number, dir: number, L: number, w: number, h: number, kind: RampKind, jump: boolean, bld: Building | null = null): Ramp {
    // (sx, sy): middle of the low edge; dir 0 +x, 1 -x, 2 +y, 3 -y
    const alongX = dir < 2, rising: 1 | -1 = dir === 0 || dir === 2 ? 1 : -1;
    const x0 = alongX ? (rising > 0 ? sx : sx - L) : sx - w / 2;
    const y0 = alongX ? sy - w / 2 : (rising > 0 ? sy : sy - L);
    const rp: Ramp = { x0, y0, l: L, w, alongX, rising, h, base: Math.max(0, terrainH(sx, sy)), bld, kind, jump };
    this.ramps.push(rp);
    this.indexRamp(this.ramps.length - 1);
    return rp;
  }

  // launch ramp with a free run-up and a free landing zone
  private tryJump(sx: number, sy: number, dir: number, kind: RampKind, r: () => number): boolean {
    const deg = 15 + r() * 7, L = 95 + Math.floor(r() * 3) * 10, w = 56;
    const h = L * Math.tan((deg * Math.PI) / 180);
    const dx = dir === 0 ? 1 : dir === 1 ? -1 : 0, dy = dir === 2 ? 1 : dir === 3 ? -1 : 0;
    const base = terrainH(sx, sy);
    for (let s = -170; s <= L + 330; s += 15) for (const v of [-w / 2 - 6, 0, w / 2 + 6]) {
      const x = sx + dx * s - dy * v, y = sy + dy * s + dx * v;
      if (this.isSolid(x, y, 6) || isWater(x, y) || this.nearRamp(x, y, 4)) return false;
      if (Math.abs(terrainH(x, y) - base) > (s > L ? 45 : 14)) return false;
      if (s >= -20 && s <= L + 10 && (this.isCityRoad(x, y) || this.roads.isRoad(x, y))) return false; // never on a lane
    }
    if (Math.hypot(sx - HELIPAD.x, sy - HELIPAD.y) < 300) return false;
    this.addRamp(sx, sy, dir, L, w, h, kind, true);
    return true;
  }

  private generateRamps(seed: number) {
    const r = mulberry32(seed);
    const inner = (b: Block) => ({ x0: b.bx * BLOCK + ROAD, y0: b.by * BLOCK + ROAD, s: BLOCK - ROAD });
    // parking garages: a long 12 degree ramp up to the roof deck
    for (const b of this.blocks) if (b.kind === "garage") {
      const { x0, y0 } = inner(b), bd = b.buildings[0];
      const H = 46, L = Math.ceil(H / Math.tan((RAMP_MAX_ROOF * Math.PI) / 180));
      this.addRamp(x0 + 185, y0 + 352, 3, L, 60, H, "concrete", false, bd);
    }
    // construction sites, parking lots, the skate park
    for (const b of this.blocks) {
      const { x0, y0, s } = inner(b);
      if (b.kind === "site") { this.tryJump(x0 + 22, y0 + s * 0.3, 0, "wood", r); this.tryJump(x0 + s * 0.7, y0 + 22, 2, "wood", r); }
      else if (b.kind === "lot") this.tryJump(x0 + s / 2, y0 + s - 22, 3, "steel", r);
      else if (b.kind === "skate") { this.tryJump(x0 + 25, y0 + s / 2, 0, "concrete", r); this.tryJump(x0 + s - 25, y0 + 60, 1, "concrete", r); this.tryJump(x0 + s / 2, y0 + 25, 2, "concrete", r); }
    }
    // beach and harbour quay (along the coast)
    for (let y = 300; y < WORLD - 300; y += 1250) { this.tryJump(-120, y, 2, "wood", r); this.tryJump(-120, y + 620, 3, "wood", r); }
    for (let y = 500; y < WORLD - 300; y += 1600) this.tryJump(WORLD + 70, y, 2, "steel", r);
    // hills next to the highways
    for (const rd of this.roads.roads) {
      if (rd.dir === "S") continue;
      for (const at of [0.25, 0.5, 0.75]) {
        const p = Math.floor(rd.n * at), q = this.roads.point(rd, p, 230 * (at === 0.5 ? -1 : 1));
        const dir = Math.abs(Math.cos(q.a)) > Math.abs(Math.sin(q.a)) ? (Math.cos(q.a) > 0 ? 0 : 1) : (Math.sin(q.a) > 0 ? 2 : 3);
        this.tryJump(q.x, q.y, dir, r() < 0.5 ? "wood" : "concrete", r);
      }
    }
    // stunt park
    const sp = STUNT_PARK;
    for (let k = 0; k < 40 && this.ramps.filter((x) => x.jump).length < 52; k++) {
      const x = sp.x0 + 120 + r() * (sp.x1 - sp.x0 - 240), y = sp.y0 + 120 + r() * (sp.y1 - sp.y0 - 240);
      this.tryJump(x, y, Math.floor(r() * 4), k % 3 === 0 ? "wood" : "steel", r);
    }
    const n = this.ramps.filter((x) => x.jump).length;
    if (n < 40) console.warn(`Nur ${n} Sprungrampen platziert`);
  }

  // ---------------- things outside the city blocks
  private extra(x: number, y: number, w: number, h: number, height: number, col: string, opt: Partial<Building> = {}) {
    const b: Building = { x, y, w, h, height, wall: col, wallDark: col, roof: col, neon: null, detail: 0, seed: this.rand(), ...opt };
    this.extras.push(b);
    return b;
  }
  private generateExtras(seed: number) {
    const r = mulberry32(seed);
    const COLS = ["#c0392b", "#1d4e89", "#e67e22", "#3c6e47", "#7d3c98", "#c9a227", "#9aa3ad"];
    const freeY = (y: number, h: number) => HIGHWAYS.every((i) => Math.abs(y + h / 2 - lineC(i)) > ROAD / 2 + h / 2 + 40);
    // harbour quay: container stacks (a free lane along the city side)
    for (let y = 8 * BLOCK; y < WORLD - 80; y += 70) {
      if (r() < 0.3) continue;
      const h = 28, w = 60;
      const x = WORLD + 130 + Math.floor(r() * 2) * 50;
      if (!freeY(y, h)) continue;
      const stack = 1 + Math.floor(r() * 3);
      this.extra(x, y, w, h, (stack * 26) / H_SCALE - 14 / H_SCALE, COLS[Math.floor(r() * COLS.length)], { detail: stack, low: true });
    }
    // villas with pools on the hill above the city
    const rd = this.roads.roads.find((q) => q.dir === "N" && q.node.i === 3)!;
    let villas = 0;
    for (let p = 20; p < rd.n - 10 && villas < 8; p += 9) {
      for (const side of [-1, 1]) {
        const q = this.roads.point(rd, p, side * (175 + r() * 60));
        if (Math.hypot(q.x - VILLA_HILL.x, q.y - VILLA_HILL.y) > VILLA_HILL.r * 0.95) continue;
        const w = 70 + r() * 40, h = 60 + r() * 30;
        const g = terrainGrad(q.x, q.y, 40);
        if (Math.hypot(g.x, g.y) > 0.35 || this.extras.some((e) => Math.abs(e.x + e.w / 2 - q.x) < 150 && Math.abs(e.y + e.h / 2 - q.y) < 150)) continue;
        const base = Math.min(terrainH(q.x - w / 2, q.y - h / 2), terrainH(q.x + w / 2, q.y + h / 2), terrainH(q.x, q.y)) - 2;
        this.extra(q.x - w / 2, q.y - h / 2, w, h, 14 + r() * 8, "#f4efe6", { base, type: 20, roof: "#a85a3a", wallDark: "#c9c0b0" });
        this.pools.push({ x: q.x - w / 2 + (side > 0 ? w + 8 : -58), y: q.y - 18, w: 50, h: 36, z: terrainH(q.x, q.y) + 0.5 });
        villas++;
      }
    }
    // the island: lighthouse and a few houses, palms
    const ix = ISLAND.x, iy = ISLAND.y;
    this.extra(ix + 180, iy + 120, 40, 40, 70, "#f4f1ea", { base: terrainH(ix + 200, iy + 140), type: 24, roof: "#c0392b" });
    for (let k = 0; k < 5; k++) {
      const a = 0.6 + k * 1.1, d = 260 + r() * 120, x = ix + Math.cos(a) * d, y = iy + Math.sin(a) * d;
      if (isWater(x, y) || Math.abs(x - lineC(8)) < 110) continue;
      this.extra(x - 28, y - 24, 56, 48, 14 + r() * 6, ["#f4f1ea", "#9fd3c7", "#f2c7d8"][k % 3], { base: terrainH(x, y), type: 21 });
    }
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2, d = 120 + r() * 520, x = ix + Math.cos(a) * d, y = iy + Math.sin(a) * d;
      if (isWater(x, y) || Math.abs(x - lineC(8)) < 100 || this.isSolid(x, y, 20)) continue;
      this.extraTrees.push({ x, y, r: 14 + r() * 8, rot: r() * 6, kind: 1 });
    }
    // ferris wheel base on the promenade
    this.extra(FERRIS.x - 30, FERRIS.y - 12, 60, 24, 6, "#c9ced8", { type: 28, low: true });
    // palms along the beach promenade
    for (let y = 60; y < WORLD; y += 140) if (HIGHWAYS.every((i) => Math.abs(y - lineC(i)) > 110) && Math.abs(y - FERRIS.y) > 100) this.extraTrees.push({ x: -16, y, r: 14, rot: r() * 6, kind: 1 });
    // stunt park fence (gap on the west side, towards the highway) and a few containers to jump over
    const sp = STUNT_PARK, gapY = (sp.y0 + sp.y1) / 2;
    const fence = { low: true, type: 23 };
    this.extra(sp.x0, sp.y0 - 4, sp.x1 - sp.x0, 4, 6, "#9aa3ad", fence);
    this.extra(sp.x0, sp.y1, sp.x1 - sp.x0, 4, 6, "#9aa3ad", fence);
    this.extra(sp.x1, sp.y0, 4, sp.y1 - sp.y0, 6, "#9aa3ad", fence);
    this.extra(sp.x0 - 4, sp.y0, 4, gapY - 110 - sp.y0, 6, "#9aa3ad", fence);
    this.extra(sp.x0 - 4, gapY + 110, 4, sp.y1 - gapY - 110, 6, "#9aa3ad", fence);
    for (let k = 0; k < 6; k++) {
      const x = sp.x0 + 200 + r() * (sp.x1 - sp.x0 - 400), y = sp.y0 + 200 + r() * (sp.y1 - sp.y0 - 400);
      this.extra(x, y, 60, 28, 26 / H_SCALE - 14 / H_SCALE, COLS[k % COLS.length], { detail: 1, low: true });
    }
    // rails and a viewpoint where the highways end before the cliffs
    for (const q of this.roads.roads) {
      if (q.dir === "S") continue;
      const e = this.roads.point(q, q.n - 1, 0), ca = Math.cos(e.a), sa = Math.sin(e.a);
      const cx = e.x + ca * 30, cy = e.y + sa * 30, half = ROAD / 2 + 10;
      const base = terrainH(cx, cy);
      if (Math.abs(ca) > 0.7) this.extra(cx - 3, cy - half, 6, half * 2, 3, "#c9ced8", { low: true, base, type: 22 });
      else this.extra(cx - half, cy - 3, half * 2, 6, 3, "#c9ced8", { low: true, base, type: 22 });
    }
  }

  // roof height of the building whose footprint contains (x, y), -Infinity if none
  roofAt(x: number, y: number): number {
    const b = this.blockAt(x, y);
    let best = -Infinity;
    if (b) for (const bd of b.buildings) if (x >= bd.x && x <= bd.x + bd.w && y >= bd.y && y <= bd.y + bd.h) best = Math.max(best, roofOf(bd));
    const ex = this.extrasAt(x, y);
    if (ex) for (const e of ex) if (x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h) best = Math.max(best, roofOf(e));
    return best;
  }

  private generate() {
    const r = this.rand;
    const center = (bx: number, by: number) => Math.hypot(bx - 7.5, by - 7);
    for (let by = 0; by < GRID; by++) {
      for (let bx = 0; bx < GRID; bx++) {
        const x0 = bx * BLOCK + ROAD, y0 = by * BLOCK + ROAD;
        const size = BLOCK - ROAD;
        const roll = r();
        const dist = blockDistrict(bx, by);
        let kind: BlockKind = SPECIAL[`${bx},${by}`] ?? (roll < (dist === "residential" ? 0.14 : 0.09) ? "park" : roll < 0.16 ? "plaza" : "city");
        if (dist === "harbor" || dist === "industry") { if (kind === "park" || kind === "plaza") kind = "city"; }
        const block: Block = { bx, by, kind, district: dist, buildings: [], trees: [] };
        const pal = () => WALLS[Math.floor(r() * WALLS.length)];
        const add = (x: number, y: number, w: number, h: number, height: number, type: number, neonP = 0.5) => {
          const p = pal();
          block.buildings.push({ x, y, w, h, height, wall: p[0], wallDark: p[1], roof: p[2], neon: r() < neonP ? NEONS[Math.floor(r() * NEONS.length)] : null, detail: Math.floor(r() * 4), seed: r(), type });
        };
        const ix = x0 + M, iy = y0 + M, is = size - M * 2;
        if (kind === "garage") {
          add(x0 + 30, iy, 310, 352 - 18 - Math.ceil(46 / Math.tan((RAMP_MAX_ROOF * Math.PI) / 180)) - 0, 20, 19, 0);
          block.buildings[0].garage = true;
        } else if (kind === "city") {
          const split = r();
          const rects: [number, number, number, number][] = [];
          if (dist === "oldtown") {
            // narrow old houses with alleys between them
            const g = 40, s = (is - g) / 2;
            for (const [ox, oy] of [[0, 0], [s + g, 0], [0, s + g], [s + g, s + g]]) {
              if (r() < 0.5) { rects.push([ix + ox, iy + oy, s, s / 2 - 6]); rects.push([ix + ox, iy + oy + s / 2 + 6, s, s / 2 - 6]); }
              else rects.push([ix + ox, iy + oy, s, s]);
            }
          } else if (dist === "residential") {
            // houses with gardens
            const n = 3, g = 34, s = (is - g * (n - 1)) / n;
            for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
              if ((i === 1 && j === 1) || r() < 0.15) continue;
              const sh = s * (0.62 + r() * 0.2);
              rects.push([ix + i * (s + g) + (s - sh) / 2, iy + j * (s + g) + (s - sh) / 2, sh, sh]);
            }
          } else if (split < 0.3 || dist === "harbor" || dist === "industry") {
            if ((dist === "harbor" || dist === "industry") && r() < 0.6) { rects.push([ix, iy, is, is * 0.55]); rects.push([ix, iy + is * 0.55 + 30, is * 0.6, is * 0.45 - 30]); }
            else rects.push([ix, iy, is, is]);
          } else if (split < 0.6) {
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
            let height: number, type: number;
            switch (dist) {
              case "downtown": { const t = Math.max(0.5, 1.35 - center(bx, by) / 6); height = (60 + r() * 140 + (r() < 0.3 ? 180 : 0)) * t; type = 0 + Math.floor(r() * 6); break; }
              case "oldtown": height = 22 + r() * 30; type = 6 + Math.floor(r() * 4); break;
              case "beach": height = 14 + r() * 28 + (r() < 0.2 ? 50 : 0); type = 10 + Math.floor(r() * 3); break;
              case "harbor": height = 20 + r() * 22; type = 13 + Math.floor(r() * 2); break;
              case "industry": height = 22 + r() * 30; type = 15 + Math.floor(r() * 2); break;
              default: height = 12 + r() * 14 + (r() < 0.08 ? 40 : 0); type = 17 + Math.floor(r() * 2);
            }
            add(x, y, w, h, height, type, dist === "downtown" || dist === "beach" ? 0.6 : dist === "residential" ? 0.1 : 0.35);
          }
          if (dist === "residential") for (let i = 0; i < 4; i++) block.trees.push({ x: x0 + 40 + r() * (size - 80), y: y0 + 40 + r() * (size - 80), r: 12 + r() * 6, rot: r() * 6, kind: r() < 0.5 ? 1 : 0 });
        } else if (kind === "park" || kind === "skate") {
          const n = kind === "park" ? 7 + Math.floor(r() * 6) : 3;
          for (let i = 0; i < n; i++) block.trees.push({ x: x0 + 40 + r() * (size - 80), y: y0 + 40 + r() * (size - 80), r: 16 + r() * 10, rot: r() * Math.PI * 2, kind: r() < 0.4 ? 1 : 0 });
          if (kind === "skate") block.trees = block.trees.filter((t) => Math.hypot(t.x - (x0 + size / 2), t.y - (y0 + size / 2)) > 150);
        } else if (kind === "townhall") {
          // town hall with the clock tower on a square with a fountain
          const p = pal();
          block.buildings.push({ x: x0 + 95, y: y0 + 40, w: 180, h: 110, height: 34, wall: "#e8dcc4", wallDark: p[1], roof: "#7a5a4a", neon: null, detail: 0, seed: r(), type: 25 });
          block.buildings.push({ x: x0 + 165, y: y0 + 60, w: 40, h: 40, height: 95, wall: "#e8dcc4", wallDark: p[1], roof: "#3a5a4a", neon: null, detail: 0, seed: r(), type: 26 });
          for (const [tx, ty] of [[60, 230], [310, 230], [60, 330], [310, 330]]) block.trees.push({ x: x0 + tx, y: y0 + ty, r: 16, rot: r() * 6, kind: 0 });
        } else if (kind === "stadium") {
          block.buildings.push({ x: x0 + 30, y: y0 + 30, w: size - 60, h: size - 60, height: 28, wall: "#d9d6cf", wallDark: "#9a968e", roof: "#3c8a4a", neon: null, detail: 0, seed: r(), type: 27 });
        } else if (kind === "plaza") {
          const s = size * 0.36, p = pal();
          block.buildings.push({ x: x0 + size / 2 - s / 2, y: y0 + size / 2 - s / 2, w: s, h: s, height: 60 + r() * 60, wall: p[0], wallDark: p[1], roof: p[2], neon: NEONS[Math.floor(r() * NEONS.length)], detail: 3, seed: r(), type: dist === "downtown" ? 5 : 9 });
          const c = 44;
          for (const [tx, ty] of [[c, c], [size - c, c], [c, size - c], [size - c, size - c]]) block.trees.push({ x: x0 + tx, y: y0 + ty, r: 18, rot: r() * 6, kind: 1 });
        } else if (kind === "site") {
          add(x0 + size - 90, y0 + size - 60, 70, 40, 8, 23, 0); // site office container
        }
        if (kind === "city" && dist !== "residential" && r() < 0.5) {
          for (let i = 0; i < 3; i++) {
            const side = Math.floor(r() * 4), t = 40 + r() * (size - 80);
            const pts = [[x0 + t, y0 + 8], [x0 + t, y0 + size - 8], [x0 + 8, y0 + t], [x0 + size - 8, y0 + t]][side];
            block.trees.push({ x: pts[0], y: pts[1], r: 12, rot: r() * 6, kind: dist === "beach" ? 1 : 0 });
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

  // streets of the city grid (not the highways outside)
  isCityRoad(x: number, y: number) {
    if (!inCity(x, y)) return false;
    const lx = ((x % BLOCK) + BLOCK) % BLOCK, ly = ((y % BLOCK) + BLOCK) % BLOCK;
    return lx < ROAD || ly < ROAD;
  }
  isRoad(x: number, y: number) {
    if (inCity(x, y)) return this.isCityRoad(x, y);
    return this.roads.isRoad(x, y);
  }

  isSolid(x: number, y: number, pad = 0): boolean {
    const b = this.blockAt(x, y);
    if (b) for (const bd of b.buildings) if (x > bd.x - pad && x < bd.x + bd.w + pad && y > bd.y - pad && y < bd.y + bd.h + pad) return true;
    const ex = this.extrasAt(x, y);
    if (ex) for (const e of ex) if (x > e.x - pad && x < e.x + e.w + pad && y > e.y - pad && y < e.y + e.h + pad) return true;
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
    const cx = World.cell(x), cy = World.cell(y);
    for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
      const l = this.extraCells.get(World.key(i, j));
      if (l) for (const e of l) if (!out.includes(e)) out.push(e);
    }
    return out;
  }

  nodePos(i: number, j: number) { return { x: i * BLOCK + ROAD / 2, y: j * BLOCK + ROAD / 2 }; }
  nearestNode(x: number, y: number) {
    const i = Math.max(0, Math.min(GRID, Math.round((x - ROAD / 2) / BLOCK)));
    const j = Math.max(0, Math.min(GRID, Math.round((y - ROAD / 2) / BLOCK)));
    return { i, j };
  }

  // a point on a street (city grid or highway), r: random source, outside: share of highway points
  randomRoadPoint(r = Math.random, outside = 0.25) {
    if (r() < outside) {
      const rd = this.roads.roads[Math.floor(r() * this.roads.roads.length)];
      const p = this.roads.point(rd, Math.floor(r() * rd.n), (r() - 0.5) * ROAD * 0.5);
      return { x: p.x, y: p.y };
    }
    const horiz = r() < 0.5;
    const line = Math.floor(r() * (GRID + 1));
    const along = ROAD + r() * (WORLD - ROAD * 2);
    const off = ROAD / 2 + (r() - 0.5) * ROAD * 0.5;
    return horiz ? { x: along, y: line * BLOCK + off } : { x: line * BLOCK + off, y: along };
  }

  // valid points on the sidewalks next to the streets (taxi customers, suspects, drop-offs): never in a wall,
  // never on or right in front of a ramp, never in the water; computed once
  // bus stops with shelters (every few blocks), docks for the water taxi, landmarks for the sightseeing flights
  private stops: { x: number; y: number; nx: number; ny: number }[] | null = null;
  busStops() {
    if (this.stops) return this.stops;
    const out: { x: number; y: number; nx: number; ny: number }[] = [];
    for (const c of this.curbPoints()) {
      if ((c.bx * 7 + c.by * 3) % 4 !== 0 || out.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < 600)) continue;
      out.push({ x: c.x, y: c.y, nx: c.nx, ny: c.ny });
    }
    this.stops = out;
    return out;
  }
  docks(): { name: string; x: number; y: number; lx: number; ly: number }[] {
    const out = [{ name: "Bootssteg Strand", x: -340, y: 3455, lx: -150, ly: 3430 }];
    // island: walk out from the middle until the water
    for (const [name, ang] of [["Insel Nordsteg", -2.2], ["Insel Südsteg", 1.2]] as [string, number][]) {
      let d = 100;
      while (d < 1500 && !isWater(ISLAND.x + Math.cos(ang) * d, ISLAND.y + Math.sin(ang) * d)) d += 20;
      out.push({ name, x: ISLAND.x + Math.cos(ang) * (d + 70), y: ISLAND.y + Math.sin(ang) * (d + 70), lx: ISLAND.x + Math.cos(ang) * (d - 40), ly: ISLAND.y + Math.sin(ang) * (d - 40) });
    }
    out.push({ name: "Hafenkai", x: COAST.east + 70, y: 11.5 * BLOCK, lx: COAST.east - 40, ly: 11.5 * BLOCK });
    out.push({ name: "Promenade Süd", x: 2600, y: COAST.south + 70, lx: 2600, ly: COAST.south - 30 });
    return out;
  }
  landmarks(): { name: string; x: number; y: number; h: number }[] {
    const th = this.blocks.find((b) => b.kind === "townhall")!, st = this.blocks.find((b) => b.kind === "stadium")!;
    const c = (b: Block) => ({ x: b.bx * BLOCK + ROAD + (BLOCK - ROAD) / 2, y: b.by * BLOCK + ROAD + (BLOCK - ROAD) / 2 });
    let tower = this.blocks[0].buildings[0];
    for (const b of this.blocks) if (b.district === "downtown") for (const bd of b.buildings) if (!tower || bd.height > tower.height) tower = bd;
    const lh = this.extras.find((e) => e.type === 24)!;
    return [
      { name: "Rathaus mit Uhrturm", ...c(th), h: 170 },
      { name: "Vale Tower", x: tower.x + tower.w / 2, y: tower.y + tower.h / 2, h: roofOf(tower) },
      { name: "Riesenrad an der Promenade", x: FERRIS.x, y: FERRIS.y, h: 150 },
      { name: "Leuchtturm Isla Faro", x: lh.x + lh.w / 2, y: lh.y + lh.h / 2, h: roofOf(lh) },
      { name: "Stadion Palmenhain", ...c(st), h: 60 },
    ];
  }

  private curbs: { x: number; y: number; nx: number; ny: number; bx: number; by: number }[] | null = null;
  curbPoints() {
    if (this.curbs) return this.curbs;
    const out: { x: number; y: number; nx: number; ny: number; bx: number; by: number }[] = [];
    const IN = 9;
    for (const b of this.blocks) {
      const x0 = b.bx * BLOCK + ROAD + IN, y0 = b.by * BLOCK + ROAD + IN, s = BLOCK - ROAD - IN * 2;
      for (let t = 30; t < s - 30; t += 40) for (const [x, y, nx, ny] of [[x0 + t, y0, 0, -1], [x0 + t, y0 + s, 0, 1], [x0, y0 + t, -1, 0], [x0 + s, y0 + t, 1, 0]]) {
        if (this.isSolid(x, y, 7) || this.treeHit(x, y, 6) || this.nearRamp(x, y, 30) || isWater(x, y)) continue;
        out.push({ x, y, nx, ny, bx: b.bx, by: b.by }); // nx, ny: towards the street
      }
    }
    this.curbs = out;
    return out;
  }
  // a random curb point between minD and maxD away from (x, y)
  curbPoint(x: number, y: number, minD: number, maxD: number, r = Math.random) {
    const pts = this.curbPoints();
    for (let k = 0; k < 60; k++) {
      const p = pts[Math.floor(r() * pts.length)], d = Math.hypot(p.x - x, p.y - y);
      if (d > minD && d < maxD) return p;
    }
    let best = pts[0], bd = Infinity;
    for (const p of pts) { const d = Math.abs(Math.hypot(p.x - x, p.y - y) - (minD + maxD) / 2); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  // nearest safe point on a street (respawns after a fall, old saves): on land, not in a wall, not on a ramp
  nearestSafeRoad(x: number, y: number): { x: number; y: number; a: number } {
    let best = { x: lineC(8), y: lineC(8), a: 0 }, bd = Infinity;
    const consider = (px: number, py: number, a: number) => {
      const d = Math.hypot(px - x, py - y);
      if (d >= bd || edgeDist(px, py) < EDGE_LAND + 500 || isWater(px, py) || this.isSolid(px, py, 20) || this.nearRamp(px, py, 30) || this.roads.bridgeAt(px, py, 20)) return;
      bd = d; best = { x: px, y: py, a };
    };
    for (const rd of this.roads.roads) for (let p = 0; p < rd.n; p += 6) { const q = this.roads.point(rd, p, 34); consider(q.x, q.y, q.a); }
    const n = this.nearestNode(x, y);
    for (let j = Math.max(0, n.j - 2); j <= Math.min(GRID, n.j + 2); j++) for (let i = Math.max(0, n.i - 2); i <= Math.min(GRID, n.i + 2); i++) {
      const p = this.nodePos(i, j);
      consider(p.x + BLOCK / 2, p.y + 34, 0); consider(p.x - 34, p.y + BLOCK / 2, Math.PI / 2);
    }
    return best;
  }

  // the map picture: terrain, the sea from the water mask, streets, blocks, buildings
  renderMinimap(size: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const g = c.getContext("2d")!;
    const s = size / MAP_SIZE;
    const img = g.createImageData(size, size), D = img.data;
    const wm = waterMask(), cell = MAP_SIZE / MASK_N;
    for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
      const wx = MAP_MIN + (px + 0.5) / s, wy = MAP_MIN + (py + 0.5) / s;
      const mi = Math.min(MASK_N - 1, Math.floor((wx - MAP_MIN) / cell)), mj = Math.min(MASK_N - 1, Math.floor((wy - MAP_MIN) / cell));
      let R: number, G: number, B: number;
      if (wm[mj * MASK_N + mi] === 1 && isWater(wx, wy)) { const deep = Math.min(1, -terrainH(wx, wy) / 90); R = 18 - deep * 10; G = 92 - deep * 40; B = 130 - deep * 30; }
      else {
        const h = terrainH(wx, wy), t = Math.max(0, Math.min(1, h / 600));
        if (h < 6 && !inCity(wx, wy) && cityDist(wx, wy) > 200) { R = 200; G = 182; B = 130; }
        else { R = 50 + t * 150; G = 100 + t * 110; B = 50 + t * 160; }
      }
      const k = (py * size + px) * 4;
      D[k] = R; D[k + 1] = G; D[k + 2] = B; D[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const ox = -MAP_MIN * s;
    // beach strip west, quay east, promenade south
    g.fillStyle = "#d9c08a"; g.fillRect(ox + COAST.west * s, ox, -COAST.west * s, WORLD * s);
    g.fillStyle = "#5c5f66"; g.fillRect(ox + WORLD * s, ox, (COAST.east - WORLD) * s, WORLD * s);
    g.fillStyle = "#8a8578"; g.fillRect(ox, ox + WORLD * s, WORLD * s, (COAST.south - WORLD) * s);
    // highways, bridges
    g.lineCap = "round"; g.lineJoin = "round";
    for (const rd of this.roads.roads) {
      g.strokeStyle = "#4a4660"; g.lineWidth = Math.max(2, ROAD * s);
      g.beginPath();
      for (let p = 0; p < rd.n; p += 3) { const X = ox + rd.pts[p * 2] * s, Y = ox + rd.pts[p * 2 + 1] * s; if (p) g.lineTo(X, Y); else g.moveTo(X, Y); }
      g.stroke();
    }
    g.strokeStyle = "#b9b4c8"; g.lineWidth = Math.max(1.5, ROAD * s * 0.7);
    for (const b of this.roads.bridges) {
      g.beginPath();
      if (b.alongX) { g.moveTo(ox + b.s0 * s, ox + b.c * s); g.lineTo(ox + b.s1 * s, ox + b.c * s); }
      else { g.moveTo(ox + b.c * s, ox + b.s0 * s); g.lineTo(ox + b.c * s, ox + b.s1 * s); }
      g.stroke();
    }
    // city streets and blocks
    g.fillStyle = "#3a3550";
    g.fillRect(ox, ox, WORLD * s, WORLD * s);
    for (const b of this.blocks) {
      const x0 = ox + (b.bx * BLOCK + ROAD) * s, y0 = ox + (b.by * BLOCK + ROAD) * s, sz = (BLOCK - ROAD) * s;
      g.fillStyle = b.kind === "park" || b.kind === "skate" ? "#1f5a3a" : b.kind === "site" ? "#5a4a32" : b.kind === "lot" ? "#2a2838" : "#1a1428";
      g.fillRect(x0, y0, sz, sz);
      g.fillStyle = "#2c2342";
      for (const bd of b.buildings) g.fillRect(ox + bd.x * s, ox + bd.y * s, bd.w * s, bd.h * s);
    }
    g.fillStyle = "#8a6a4a";
    for (const e of this.extras) g.fillRect(ox + e.x * s, ox + e.y * s, Math.max(1, e.w * s), Math.max(1, e.h * s));
    const sp = STUNT_PARK;
    g.strokeStyle = "#ffd23f"; g.lineWidth = 1.5; g.strokeRect(ox + sp.x0 * s, ox + sp.y0 * s, (sp.x1 - sp.x0) * s, (sp.y1 - sp.y0) * s);
    return c;
  }
}
void EXT; void WATER_Y;
