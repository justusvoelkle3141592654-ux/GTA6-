import { BLOCK, ROAD, GRID, HIGHWAYS, mulberry32, type World } from "./world";
import { Car, type CarModel } from "./vehicles";
import type { PedSystem } from "./peds";
import type { ModeRules } from "./modes";

export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const CIV_COLORS = ["#d8d8e0", "#2b2f3a", "#8a1c2b", "#1d4e89", "#3c6e47", "#c9a227", "#6b4c9a", "#e07a2e", "#9aa3ad", "#10141c"];
const LANE = 34; // traffic drives this far right of the road centre

// parking along the curb (open world)
export interface ParkingSpot { id: number; x: number; y: number; a: number; model: CarModel; color: string; d: number; }
export const PARKED_LIMIT = { high: 14, low: 8 };
const PARK_OFF = 62;          // distance from the road centre (lane cars pass at 34)
const PARK_STEP = 66, PARK_MARGIN = 55, PARK_CHANCE = 0.22;
const PARK_SPAWN_MIN = 380, PARK_SPAWN_MAX = 1100, PARK_DESPAWN = 1350, PARK_FREE = 1900;
const PARKED_MODELS: CarModel[] = ["sedan", "sedan", "sedan", "suv", "van", "muscle", "taxi", "sport"];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// what traffic needs from the game
export interface TrafficHost {
  cars: Car[];
  readonly fx: number; readonly fy: number;
  readonly onFoot: boolean;
  readonly ped: { x: number; y: number };
  readonly peds: PedSystem;
  readonly rules: ModeRules;
}

// ---------- steering helpers (also used by the police AI) ----------
export function steerTo(c: Car, tx: number, ty: number) {
  const diff = wrap(Math.atan2(ty - c.y, tx - c.x) - c.a);
  c.steer = clamp(diff * 2.4, -1, 1);
  return diff;
}
export function avoid(c: Car, w: World) {
  const look = 46 + Math.abs(c.vF) * 0.28;
  if (w.isSolid(c.x + Math.cos(c.a) * look, c.y + Math.sin(c.a) * look, 6)) {
    const l = w.isSolid(c.x + Math.cos(c.a - 0.75) * look * 0.85, c.y + Math.sin(c.a - 0.75) * look * 0.85, 6);
    const r = w.isSolid(c.x + Math.cos(c.a + 0.75) * look * 0.85, c.y + Math.sin(c.a + 0.75) * look * 0.85, 6);
    if (l && !r) c.steer = 1; else if (r && !l) c.steer = -1;
    if (Math.abs(c.vF) > 260) c.throttle = Math.min(c.throttle, 0.2);
  }
}
export function stuck(c: Car, dt: number) {
  if (c.reverseT > 0) { c.reverseT -= dt; c.throttle = -1; c.steer = -c.steer; return; }
  if (Math.abs(c.vF) < 25 && c.throttle > 0) { c.stuckT += dt; if (c.stuckT > 0.8) { c.reverseT = 0.7; c.stuckT = 0; } }
  else c.stuckT = 0;
}

// deterministic parking spots: depend only on the world layout and the seed
export function buildParking(world: World, seed = 777): ParkingSpot[] {
  const r = mulberry32(seed);
  const out: ParkingSpot[] = [];
  const add = (x: number, y: number, a: number) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    // no ramps under the car
    if (world.rampH(x, y) > 0 || world.rampH(x + ca * 28, y + sa * 28) > 0 || world.rampH(x - ca * 28, y - sa * 28) > 0) return;
    const model = PARKED_MODELS[Math.floor(r() * PARKED_MODELS.length)];
    const color = model === "taxi" ? "#ffc21a" : CIV_COLORS[Math.floor(r() * CIV_COLORS.length)];
    out.push({ id: out.length, x, y, a, model, color, d: 0 });
  };
  for (let line = 0; line <= GRID; line++) {
    if (HIGHWAYS.includes(line)) continue;
    const c = line * BLOCK + ROAD / 2;
    for (let seg = 0; seg < GRID; seg++) {
      const s0 = seg * BLOCK + ROAD + PARK_MARGIN, s1 = (seg + 1) * BLOCK - PARK_MARGIN;
      for (let s = s0; s <= s1; s += PARK_STEP) {
        // horizontal road: +x traffic on the +y side; vertical road: +y traffic on the -x side
        if (r() < PARK_CHANCE) add(s, c + PARK_OFF, 0);
        if (r() < PARK_CHANCE) add(s, c - PARK_OFF, Math.PI);
        if (r() < PARK_CHANCE) add(c - PARK_OFF, s, Math.PI / 2);
        if (r() < PARK_CHANCE) add(c + PARK_OFF, s, -Math.PI / 2);
      }
    }
  }
  return out;
}

export class Traffic {
  spots: ParkingSpot[];
  private taken = new Set<number>();   // stolen spots stay empty until the player is far away
  private present = new Set<number>();
  private cand: ParkingSpot[] = [];
  private scanT = 0;

  constructor(private world: World) { this.spots = buildParking(world); }

  reset() { this.taken.clear(); this.scanT = 0; }

  // the car leaves its spot for good (stolen)
  release(c: Car) { if (c.spotId >= 0) { this.taken.add(c.spotId); c.spotId = -1; } }

  spawnCiv(h: TrafficHost, anywhereNear = false) {
    const fx = h.fx, fy = h.fy, w = this.world;
    for (let tries = 0; tries < 20; tries++) {
      const i = Math.floor(Math.random() * (GRID + 1)), j = Math.floor(Math.random() * (GRID + 1));
      const np = w.nodePos(i, j);
      const d = Math.hypot(np.x - fx, np.y - fy);
      if (d > 1400 || d < (anywhereNear ? 250 : 750)) continue;
      const dir = DIRS[Math.floor(Math.random() * 4)];
      const ni = i + dir[0], nj = j + dir[1];
      if (ni < 0 || nj < 0 || ni > GRID || nj > GRID) continue;
      const r = Math.random();
      const model: CarModel = r < 0.15 ? "taxi" : r < 0.3 ? "van" : r < 0.4 ? "suv" : r < 0.5 ? "muscle" : "sedan";
      const color = model === "taxi" ? "#ffc21a" : CIV_COLORS[Math.floor(Math.random() * CIV_COLORS.length)];
      const c = new Car("civ", model, color);
      const t = rnd(0.2, 0.7);
      c.x = np.x + dir[0] * BLOCK * t - dir[1] * LANE; c.y = np.y + dir[1] * BLOCK * t + dir[0] * LANE;
      c.a = Math.atan2(dir[1], dir[0]);
      c.prevI = i; c.prevJ = j; c.wpI = ni; c.wpJ = nj; c.route = true;
      c.cruise = rnd(150, 200);
      c.vx = Math.cos(c.a) * c.cruise; c.vy = Math.sin(c.a) * c.cruise;
      c.hp = c.maxHp = 90; c.mass = model === "van" || model === "suv" ? 1.2 : 0.8;
      c.driver = true;
      h.cars.push(c);
      return;
    }
  }

  civAI(h: TrafficHost, c: Car, dt: number) {
    const w = this.world;
    const from = w.nodePos(c.prevI, c.prevJ), to = w.nodePos(c.wpI, c.wpJ);
    let dx = to.x - from.x, dy = to.y - from.y;
    const L = Math.hypot(dx, dy) || 1;
    dx /= L; dy /= L;
    const tx = to.x - dy * LANE - dx * 10, ty = to.y + dx * LANE - dy * 10;
    if (Math.hypot(tx - c.x, ty - c.y) < 55) {
      // pick the next crossing at random, never straight back
      let n = 0, ci = c.prevI, cj = c.prevJ;
      for (const d of DIRS) {
        const ni = c.wpI + d[0], nj = c.wpJ + d[1];
        if (ni < 0 || nj < 0 || ni > GRID || nj > GRID) continue;
        if (ni === c.prevI && nj === c.prevJ) continue;
        n++;
        if (Math.random() * n < 1) { ci = ni; cj = nj; }
      }
      c.prevI = c.wpI; c.prevJ = c.wpJ; c.wpI = ci; c.wpJ = cj;
    }
    const diff = steerTo(c, tx, ty);
    const want = c.cruise * (Math.abs(diff) > 0.45 ? 0.55 : 1);
    c.throttle = c.vF < want ? 1 : c.vF > want + 40 ? -0.4 : 0;
    c.handbrake = false;
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    for (const o of h.cars) {
      if (o === c) continue;
      const ox = o.x - c.x, oy = o.y - c.y;
      const fwd = ox * ca + oy * sa;
      if (fwd > 0 && fwd < 80) { const lat = -ox * sa + oy * ca; if (Math.abs(lat) < 22) { c.throttle = c.vF > 40 ? -0.6 : 0; break; } }
    }
    if (h.onFoot) {
      const ox = h.ped.x - c.x, oy = h.ped.y - c.y;
      const fwd = ox * ca + oy * sa;
      if (fwd > 0 && fwd < 90 && Math.abs(-ox * sa + oy * ca) < 20) c.throttle = c.vF > 20 ? -1 : 0;
    }
    if (h.rules.city && h.peds.blocking(c)) c.throttle = c.vF > 20 ? -1 : 0;
    stuck(c, dt);
  }

  // cop without a wanted level: drive along the streets like traffic
  patrol(h: TrafficHost, c: Car, dt: number) {
    if (!c.route) {
      const n = this.world.nearestNode(c.x, c.y);
      const dir = DIRS[Math.floor(Math.random() * 4)];
      c.prevI = n.i; c.prevJ = n.j;
      c.wpI = clamp(n.i + dir[0], 0, GRID); c.wpJ = clamp(n.j + dir[1], 0, GRID);
      if (c.wpI === n.i && c.wpJ === n.j) c.wpI = n.i > 0 ? n.i - 1 : n.i + 1;
      c.route = true;
    }
    this.civAI(h, c, dt);
  }

  // keep parked cars around the player: spawn into free spots ahead, remove far ones
  updateParking(h: TrafficHost, dt: number, limit: number, initial = false) {
    this.scanT -= dt;
    if (this.scanT > 0 && !initial) return;
    this.scanT = 0.5;
    const fx = h.fx, fy = h.fy, cars = h.cars;
    this.present.clear();
    let n = 0;
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      if (c.spotId < 0) continue;
      if (c.parked && Math.hypot(c.x - fx, c.y - fy) > PARK_DESPAWN) { cars.splice(i, 1); continue; }
      this.present.add(c.spotId);
      if (c.parked) n++;
    }
    for (const id of this.taken) { const sp = this.spots[id]; if (Math.hypot(sp.x - fx, sp.y - fy) > PARK_FREE) this.taken.delete(id); }
    if (n >= limit) return;
    const cand = this.cand;
    cand.length = 0;
    const minD = initial ? 60 : PARK_SPAWN_MIN;
    for (const sp of this.spots) {
      if (this.present.has(sp.id) || this.taken.has(sp.id)) continue;
      sp.d = Math.hypot(sp.x - fx, sp.y - fy);
      if (sp.d > PARK_SPAWN_MAX || sp.d < minD) continue;
      cand.push(sp);
    }
    cand.sort((a, b) => a.d - b.d);
    for (const sp of cand) {
      if (n >= limit) break;
      if (this.occupied(cars, sp)) continue;
      const c = new Car("civ", sp.model, sp.color);
      c.x = sp.x; c.y = sp.y; c.a = sp.a; c.parked = true; c.handbrake = true; c.spotId = sp.id;
      c.hp = c.maxHp = 90; c.mass = sp.model === "van" || sp.model === "suv" ? 1.2 : 0.8;
      cars.push(c);
      n++;
    }
  }

  private occupied(cars: readonly Car[], sp: ParkingSpot) {
    for (const c of cars) if (Math.abs(c.x - sp.x) < 45 && Math.abs(c.y - sp.y) < 45) return true;
    return false;
  }
}
