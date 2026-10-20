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

export function terrainH(x: number, y: number): number {
  const d = cityDist(x, y);
  if (d < 220) return 0;
  const ramp = sstep(220, 1100, d);
  const n1 = vnoise(x / 1500 + 7.1, y / 1500 + 3.3);
  const n2 = vnoise(x / 620 + 2.2, y / 620 + 11.7);
  const n3 = vnoise(x / 260 + 5.5, y / 260 + 0.4);
  const hills = n1 * 140 + n2 * 60 + n3 * 18;
  const mnt = sstep(1700, 3600, d) * (0.4 + 0.6 * vnoise(x / 1900 + 1.3, y / 1900 + 9.1)) * 560;
  const ridge = sstep(1900, 3400, d) * Math.pow(vnoise(x / 700 + 4.4, y / 700 + 2.9), 2) * 340;
  const edge = 1 - sstep(EXT - 1000, EXT - 320, d);
  return (hills * ramp + mnt + ridge) * edge;
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
  extras: Building[] = []; // solid props outside the block grid (harbour containers, crane legs)

  constructor(seed = 1337) {
    this.rand = mulberry32(seed);
    this.generate();
    this.generateRamps();
    this.generateExtras(seed + 99);
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
    if (cityDist(x, y) > 320) return false;
    for (const e of this.extras) if (x > e.x - pad && x < e.x + e.w + pad && y > e.y - pad && y < e.y + e.h + pad) return true;
    return false;
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
    for (const rp of this.ramps) {
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
    for (let i = 0; i < this.ramps.length; i++) {
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
      if (cityDist(x, y) < 320) for (const e of this.extras) if (x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h) best = Math.max(best, roofOf(e));
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
    if (cityDist(x, y) > 0 && cityDist(x, y) < 320) for (const e of this.extras) if (Math.abs(e.x + e.w / 2 - x) < 260 && Math.abs(e.y + e.h / 2 - y) < 260) out.push(e);
    return out;
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
    // city
    const ox = -MAP_MIN * s;
    g.fillStyle = "#3a3550";
    g.fillRect(ox, ox, WORLD * s, WORLD * s);
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
