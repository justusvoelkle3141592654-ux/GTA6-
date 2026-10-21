// highways outside the city: curved roads into the countryside, bridges over the sea, the tunnel
import { ROAD, WORLD, HIGHWAYS, MAP_MIN, MAP_MAX, EDGE_LAND, WATER_Y, TUNNEL, lineC, isWater, terrainH, tunnelAt, tunnelFloor, sstep } from "./terrain";

export type RoadDir = "N" | "W" | "E" | "S";
export interface CRoad {
  id: number; dir: RoadDir;
  node: { i: number; j: number };   // city crossing where it starts
  pts: Float32Array;                // x, y every STEP units from the city outwards
  n: number;                        // number of points
  hw: number;                       // half width
}
// a straight bridge: the deck rises over RAMP units at both ends
export interface Bridge {
  road: number; alongX: boolean; c: number; // lateral centre line
  s0: number; s1: number;                   // start and end along the axis (s0 < s1)
  z0: number; z1: number; deck: number;     // ground at both ends, deck height
  hw: number;
  piers: number[];                          // positions of the pier pairs along the axis (in the water)
}
export const STEP = 20;
export const BRIDGE_DECK = 58;   // deck top (boats pass below with more than 40 units of headroom)
const BRIDGE_RAMP = 420;
const END_GAP = EDGE_LAND + 300; // roads stop this far from the map border (viewpoint before the cliff)

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function landRun(x0: number, y0: number, dx: number, dy: number, hw: number): number {
  // distance from (x0, y0) along (dx, dy) to the first point where the road is on land for 160 units
  let run = 0;
  for (let s = 0; s < 8000; s += 20) {
    const x = x0 + dx * s, y = y0 + dy * s, nx = -dy * hw, ny = dx * hw;
    const wet = isWater(x, y) || isWater(x + nx, y + ny) || isWater(x - nx, y - ny);
    if (wet) run = 0; else { run += 20; if (run >= 160) return s - 160; }
  }
  return 0;
}

export class RoadNet {
  roads: CRoad[] = [];
  bridges: Bridge[] = [];
  private cells = new Map<number, number[]>(); // segment index lists per 400-unit cell: road * 65536 + point
  private static readonly CS = 400;

  constructor() {
    const hw = ROAD / 2;
    const make = (dir: RoadDir, node: { i: number; j: number }, pts: number[]) => {
      const r: CRoad = { id: this.roads.length, dir, node, pts: new Float32Array(pts), n: pts.length / 2, hw };
      this.roads.push(r);
      return r;
    };
    // straight part over the water (bridge), then a gently curving road to the cliffs
    const out = (dir: RoadDir, k: number) => {
      const c = lineC(k);
      const dx = dir === "W" ? -1 : dir === "E" ? 1 : 0, dy = dir === "N" ? -1 : dir === "S" ? 1 : 0;
      const sx = dir === "E" ? WORLD : dir === "W" ? 0 : c, sy = dir === "S" ? WORLD : dir === "N" ? 0 : c;
      const node = dir === "N" ? { i: k, j: 0 } : dir === "S" ? { i: k, j: 16 } : dir === "W" ? { i: 0, j: k } : { i: 16, j: k };
      // where the coast is: walk out until the first water, then until land again
      let wetStart = -1;
      for (let s = 0; s < 4000; s += 20) if (isWater(sx + dx * s, sy + dy * s)) { wetStart = s; break; }
      let bridgeEnd = 0;
      if (wetStart >= 0) bridgeEnd = wetStart + landRun(sx + dx * wetStart, sy + dy * wetStart, dx, dy, hw + 10) + 140;
      const endS = dir === "W" ? sx - (MAP_MIN + END_GAP) : dir === "E" ? MAP_MAX - END_GAP - sx : dir === "N" ? sy - (MAP_MIN + END_GAP) : 0;
      const total = dir === "S" ? bridgeEnd + 520 : endS;
      const amp = dir === "N" ? (k === 8 ? 0 : k === 3 ? 240 : 300) : dir === "S" ? 0 : 340;
      const start = dir === "N" ? (k === 13 ? 2900 : 2300) : bridgeEnd + 300;
      const ph = k * 1.7;
      const pts: number[] = [];
      for (let s = 0; s <= total; s += STEP) {
        const m = amp * sstep(start, start + 900, s) * Math.sin((s - start) / 1100 + ph) * sstep(0, 1, (total - s) / 200 + 1);
        pts.push(sx + dx * s - dy * m, sy + dy * s + dx * m);
      }
      const r = make(dir, node, pts);
      if (wetStart >= 0 && bridgeEnd > wetStart) {
        const a = Math.max(0, wetStart - 260), b = bridgeEnd;
        const s0 = dx ? Math.min(sx + dx * a, sx + dx * b) : Math.min(sy + dy * a, sy + dy * b);
        const s1 = dx ? Math.max(sx + dx * a, sx + dx * b) : Math.max(sy + dy * a, sy + dy * b);
        const alongX = dx !== 0;
        const z0 = Math.max(0, alongX ? terrainH(s0, c) : terrainH(c, s0)), z1 = Math.max(0, alongX ? terrainH(s1, c) : terrainH(c, s1));
        const piers: number[] = [];
        for (let q = s0 + 260; q < s1 - 200; q += 300) if (alongX ? isWater(q, c) : isWater(c, q)) piers.push(q);
        this.bridges.push({ road: r.id, alongX, c, s0, s1, z0, z1, deck: WATER_Y + BRIDGE_DECK, hw: hw + 6, piers });
      }
      return r;
    };
    for (const k of HIGHWAYS) { out("N", k); out("W", k); out("E", k); }
    out("S", 8);
    this.index();
  }

  private index() {
    const CS = RoadNet.CS;
    for (const r of this.roads) for (let p = 0; p < r.n - 1; p++) {
      const x0 = r.pts[p * 2], y0 = r.pts[p * 2 + 1], x1 = r.pts[p * 2 + 2], y1 = r.pts[p * 2 + 3];
      for (const [x, y] of [[x0, y0], [x1, y1]]) {
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const key = (Math.floor(x / CS) + ox + 100) * 1000 + (Math.floor(y / CS) + oy + 100);
          let l = this.cells.get(key);
          if (!l) { l = []; this.cells.set(key, l); }
          const id = r.id * 65536 + p;
          if (l[l.length - 1] !== id) l.push(id);
        }
      }
    }
  }

  // nearest country road point: distance to the centre line, road id, point index, lateral side (+ right of the outward direction)
  hit = { d: Infinity, road: -1, p: 0, t: 0, side: 0, x: 0, y: 0 };
  nearest(x: number, y: number, maxD = 200) {
    const h = this.hit;
    h.d = Infinity; h.road = -1;
    const CS = RoadNet.CS;
    const l = this.cells.get((Math.floor(x / CS) + 100) * 1000 + (Math.floor(y / CS) + 100));
    if (!l) return h;
    for (const id of l) {
      const r = this.roads[(id / 65536) | 0], p = id & 65535;
      const x0 = r.pts[p * 2], y0 = r.pts[p * 2 + 1], x1 = r.pts[p * 2 + 2], y1 = r.pts[p * 2 + 3];
      const ex = x1 - x0, ey = y1 - y0, L2 = ex * ex + ey * ey || 1;
      const t = clamp(((x - x0) * ex + (y - y0) * ey) / L2, 0, 1);
      const px = x0 + ex * t, py = y0 + ey * t, d = Math.hypot(x - px, y - py);
      if (d < h.d && d < maxD) { h.d = d; h.road = r.id; h.p = p; h.t = t; h.x = px; h.y = py; h.side = ex * (y - y0) - ey * (x - x0) > 0 ? 1 : -1; }
    }
    return h;
  }

  isRoad(x: number, y: number) { const h = this.nearest(x, y, ROAD); return h.road >= 0 && h.d < this.roads[h.road].hw; }

  // bridge deck under (x, y) (NaN if none)
  bridgeAt(x: number, y: number, pad = 0): { b: Bridge; h: number } | null {
    for (const b of this.bridges) {
      const s = b.alongX ? x : y, v = b.alongX ? y : x;
      if (s < b.s0 || s > b.s1 || Math.abs(v - b.c) > b.hw + pad) continue;
      return { b, h: this.deckH(b, s) };
    }
    return null;
  }
  deckH(b: Bridge, s: number) {
    if (s < b.s0 + BRIDGE_RAMP) return b.z0 + (b.deck - b.z0) * sstep(0, 1, (s - b.s0) / BRIDGE_RAMP);
    if (s > b.s1 - BRIDGE_RAMP) return b.z1 + (b.deck - b.z1) * sstep(0, 1, (b.s1 - s) / BRIDGE_RAMP);
    return b.deck;
  }

  // height of the road surface for something at height z: bridge deck, tunnel floor or the ground
  surface(x: number, y: number, z: number, ground: number): number {
    const br = this.bridgeAt(x, y);
    if (br && z >= br.h - 14) return Math.max(ground, br.h);
    const tf = tunnelAt(x, y);
    if (!isNaN(tf) && z < tf + TUNNEL.clear) return tf;
    return ground;
  }
  // road height for drawing the road ribbons (the deck on bridges, the floor in the tunnel)
  drawH(x: number, y: number) {
    const br = this.bridgeAt(x, y);
    if (br) return br.h;
    const tf = tunnelAt(x, y);
    if (!isNaN(tf)) return tf;
    return terrainH(x, y);
  }

  // point at index p of road r with lateral offset (positive: right of the outward direction)
  point(r: CRoad, p: number, off: number) {
    const q = clamp(p, 0, r.n - 2);
    const x0 = r.pts[q * 2], y0 = r.pts[q * 2 + 1], x1 = r.pts[q * 2 + 2], y1 = r.pts[q * 2 + 3];
    const L = Math.hypot(x1 - x0, y1 - y0) || 1;
    const pi = clamp(p, 0, r.n - 1);
    return { x: r.pts[pi * 2] - ((y1 - y0) / L) * off, y: r.pts[pi * 2 + 1] + ((x1 - x0) / L) * off, a: Math.atan2(y1 - y0, x1 - x0) };
  }
}
export { tunnelFloor };
