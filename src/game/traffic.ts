import { BLOCK, ROAD, GRID, HIGHWAYS, mulberry32, isWater, inCity, cityDist, type World } from "./world";
import { Car, MODEL_STATS, type CarModel, type FactionId } from "./vehicles";
import { ROUNDABOUT } from "./world";
import { DISTRICTS, districtAt } from "./districts";
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
const PARKED_MODELS: CarModel[] = ["sedan", "sedan", "sedan", "suv", "van", "muscle", "taxi", "sport", "bike", "truck", "super"];
const GANG_COLORS: Record<FactionId, string> = { halcones: "#c0392b", kings: "#7d3c98" };

// braking for obstacles: look ahead, keep this gap, assumed comfortable deceleration
const LOOK_CAR = 110, LOOK_PED = 120, GAP_CAR = 40, GAP_PED = 26, BRAKE_DECEL = 650;
const safeSpeed = (dist: number, gap: number) => Math.sqrt(2 * BRAKE_DECEL * Math.max(0, dist - gap));
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
// walls and the bay are in the way of cars
const blocked = (w: World, x: number, y: number) => w.isSolid(x, y, 6) || isWater(x, y);
export function avoid(c: Car, w: World) {
  const look = 46 + Math.abs(c.vF) * 0.28;
  if (blocked(w, c.x + Math.cos(c.a) * look, c.y + Math.sin(c.a) * look)) {
    const l = blocked(w, c.x + Math.cos(c.a - 0.75) * look * 0.85, c.y + Math.sin(c.a - 0.75) * look * 0.85);
    const r = blocked(w, c.x + Math.cos(c.a + 0.75) * look * 0.85, c.y + Math.sin(c.a + 0.75) * look * 0.85);
    if (isWater(c.x + Math.cos(c.a) * look, c.y + Math.sin(c.a) * look) && Math.abs(c.vF) > 120) c.throttle = -1; // brake at the shore
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
    // nothing on or right in front of ramps
    if (world.nearRamp(x, y, 30) || world.nearRamp(x + ca * 28, y + sa * 28, 30) || world.nearRamp(x - ca * 28, y - sa * 28, 30)) return;
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

// traffic lights at the big crossings (highway lines and the centre); a green wave through the grid
export const LIGHT_CYCLE = 26;
export class TrafficLights {
  has: Uint8Array;
  t = 0;
  constructor() {
    const N = GRID + 1;
    this.has = new Uint8Array(N * N);
    for (let j = 1; j < GRID; j++) for (let i = 1; i < GRID; i++) {
      const major = HIGHWAYS.includes(i) || HIGHWAYS.includes(j);
      const centre = i >= 5 && i <= 11 && j >= 4 && j <= 11;
      if ((major && (HIGHWAYS.includes(i) && HIGHWAYS.includes(j) || (i + j) % 2 === 0)) || (centre && (i + j) % 2 === 1)) this.has[j * N + i] = 1;
    }
    this.has[ROUNDABOUT.j * N + ROUNDABOUT.i] = 0; // the roundabout has no lights
  }
  update(dt: number) { this.t += dt; }
  // phase of crossing (i, j): 0 green for traffic along x, 1 yellow x, 2 green along y, 3 yellow y
  phase(i: number, j: number) {
    const t = (this.t + (i + j) * 1.6) % LIGHT_CYCLE;
    return t < 11 ? 0 : t < 13 ? 1 : t < 24 ? 2 : 3;
  }
  red(i: number, j: number, alongX: boolean) {
    if (i < 0 || j < 0 || i > GRID || j > GRID || !this.has[j * (GRID + 1) + i]) return false;
    const ph = this.phase(i, j);
    return alongX ? ph !== 0 : ph !== 2;
  }
}

export class Traffic {
  lights = new TrafficLights();
  spots: ParkingSpot[];
  private taken = new Set<number>();   // stolen spots stay empty until the player is far away
  private present = new Set<number>();
  private cand: ParkingSpot[] = [];
  private scanT = 0;

  constructor(private world: World) { this.spots = buildParking(world); }

  reset() { this.taken.clear(); this.scanT = 0; }

  // the car leaves its spot for good (stolen)
  release(c: Car) { if (c.spotId >= 0) { this.taken.add(c.spotId); c.spotId = -1; } }

  private pickModel(h: TrafficHost, x: number, y: number) {
    const r = Math.random();
    // gang turf: some cars belong to the gang (their colour)
    const gang = h.rules.city ? DISTRICTS[districtAt(x, y)].gang : null;
    const isGang = !!gang && Math.random() < 0.3;
    // arcade modes keep the original traffic mix
    const model: CarModel = !h.rules.city ? (r < 0.15 ? "taxi" : r < 0.3 ? "van" : r < 0.4 ? "suv" : r < 0.5 ? "muscle" : "sedan")
      : isGang ? (r < 0.5 ? "muscle" : "suv")
      : r < 0.12 ? "taxi" : r < 0.24 ? "van" : r < 0.32 ? "suv" : r < 0.4 ? "muscle" : r < 0.47 ? "bike" : r < 0.52 ? "truck" : r < 0.56 ? "bus" : "sedan";
    const color = isGang ? GANG_COLORS[gang!] : model === "taxi" ? "#ffc21a" : model === "bus" ? "#2bb3ff" : CIV_COLORS[Math.floor(Math.random() * CIV_COLORS.length)];
    const c = new Car("civ", model, color);
    if (isGang) c.faction = gang;
    if (h.rules.city) { c.hp = c.maxHp = MODEL_STATS[model].hp; c.mass = MODEL_STATS[model].mass; }
    else { c.hp = c.maxHp = 90; c.mass = model === "van" || model === "suv" ? 1.2 : 0.8; }
    c.driver = true;
    return c;
  }

  spawnCiv(h: TrafficHost, anywhereNear = false) {
    const fx = h.fx, fy = h.fy, w = this.world;
    // outside the city: traffic on the highways and bridges
    if (!inCity(fx, fy) && cityDist(fx, fy) > 300) {
      for (let tries = 0; tries < 12; tries++) {
        const rd = w.roads.roads[Math.floor(Math.random() * w.roads.roads.length)];
        const p = Math.floor(Math.random() * rd.n);
        const dir = Math.random() < 0.5 ? 1 : -1;
        const q = w.roads.point(rd, p, 34 * dir);
        const d = Math.hypot(q.x - fx, q.y - fy);
        if (d > 1400 || d < (anywhereNear ? 250 : 650)) continue;
        const c = this.pickModel(h, q.x, q.y);
        c.x = q.x; c.y = q.y; c.z = w.roads.drawH(q.x, q.y); c.a = dir > 0 ? q.a : q.a + Math.PI;
        c.croad = rd.id; c.cp = p; c.cdir = dir; c.route = true;
        c.cruise = c.model === "bus" || c.model === "truck" ? rnd(170, 200) : rnd(230, 290);
        c.vx = Math.cos(c.a) * c.cruise; c.vy = Math.sin(c.a) * c.cruise;
        h.cars.push(c);
        return;
      }
      return;
    }
    for (let tries = 0; tries < 20; tries++) {
      const i = Math.floor(Math.random() * (GRID + 1)), j = Math.floor(Math.random() * (GRID + 1));
      const np = w.nodePos(i, j);
      const d = Math.hypot(np.x - fx, np.y - fy);
      if (d > 1400 || d < (anywhereNear ? 250 : 750)) continue;
      const dir = DIRS[Math.floor(Math.random() * 4)];
      const ni = i + dir[0], nj = j + dir[1];
      if (ni < 0 || nj < 0 || ni > GRID || nj > GRID) continue;
      const c = this.pickModel(h, np.x, np.y);
      const t = rnd(0.2, 0.7);
      c.x = np.x + dir[0] * BLOCK * t - dir[1] * LANE; c.y = np.y + dir[1] * BLOCK * t + dir[0] * LANE;
      c.a = Math.atan2(dir[1], dir[0]);
      c.prevI = i; c.prevJ = j; c.wpI = ni; c.wpJ = nj; c.route = true;
      c.cruise = c.model === "bus" || c.model === "truck" ? rnd(120, 150) : c.model === "bike" ? rnd(170, 220) : rnd(150, 200);
      c.vx = Math.cos(c.a) * c.cruise; c.vy = Math.sin(c.a) * c.cruise;
      h.cars.push(c);
      return;
    }
  }

  // highway driving: follow the road points on the right lane, turn back at the end, join the city grid at its first crossing
  private highwayAI(h: TrafficHost, c: Car) {
    const net = this.world.roads, rd = net.roads[c.croad];
    const look = c.cp + c.cdir * 4;
    const q = net.point(rd, look, 34 * c.cdir);
    if (Math.hypot(q.x - c.x, q.y - c.y) < 70) c.cp += c.cdir * 2;
    if (c.cdir > 0 && c.cp >= rd.n - 3) { c.cdir = -1; c.cp = rd.n - 3; } // dead end at the cliffs: turn around
    if (c.cdir < 0 && c.cp <= 1) {
      // back at the city: continue on the grid from the crossing where the road starts
      c.croad = -1;
      const n = rd.node;
      const inward = n.j === 0 ? [0, 1] : n.j === GRID ? [0, -1] : n.i === 0 ? [1, 0] : [-1, 0];
      c.prevI = n.i; c.prevJ = n.j; c.wpI = n.i + inward[0]; c.wpJ = n.j + inward[1];
      return;
    }
    void h;
    return q;
  }

  civAI(h: TrafficHost, c: Car, dt: number) {
    const w = this.world;
    let tx: number, ty: number, cruise = c.cruise;
    const hq = c.croad >= 0 ? this.highwayAI(h, c) : undefined;
    if (hq) { tx = hq.x; ty = hq.y; }
    else {
    const from = w.nodePos(c.prevI, c.prevJ), to = w.nodePos(c.wpI, c.wpJ);
    let dx = to.x - from.x, dy = to.y - from.y;
    const L = Math.hypot(dx, dy) || 1;
    dx /= L; dy /= L;
    tx = to.x - dy * LANE - dx * 10; ty = to.y + dx * LANE - dy * 10;
    // red light ahead: stop at the line (police with a siren ignores it)
    if (!(c.kind === "cop" && !c.calm) && !c.flee && !c.hunt && this.lights.red(c.wpI, c.wpJ, dx !== 0)) {
      const dStop = (to.x - c.x) * dx + (to.y - c.y) * dy - ROAD / 2 - 14;
      if (dStop > 2 && dStop < 140) cruise = Math.min(cruise, Math.sqrt(2 * BRAKE_DECEL * Math.max(0, dStop - 6)));
    }
    // leaving the city: a highway starts at this edge crossing
    if (Math.hypot(tx - c.x, ty - c.y) < 55 && !c.flee && Math.random() < 0.35) {
      const rd = w.roads.roads.find((r) => r.node.i === c.wpI && r.node.j === c.wpJ && (c.wpI === 0 || c.wpJ === 0 || c.wpI === GRID || c.wpJ === GRID));
      if (rd && c.kind === "civ") { c.croad = rd.id; c.cp = 1; c.cdir = 1; }
    }
    // roundabout: circle counter-clockwise on the map (island on the left), leave at the chosen road
    let circling = false;
    if (c.croad < 0 && c.wpI === ROUNDABOUT.i && c.wpJ === ROUNDABOUT.j) {
      const C = w.nodePos(ROUNDABOUT.i, ROUNDABOUT.j), rx = c.x - C.x, ry = c.y - C.y, d = Math.hypot(rx, ry);
      if (d < 140) {
        if (c.rbI < 0) {
          let n = 0;
          for (const dd of DIRS) {
            const ni = c.wpI + dd[0], nj = c.wpJ + dd[1];
            if (ni < 0 || nj < 0 || ni > GRID || nj > GRID || (ni === c.prevI && nj === c.prevJ)) continue;
            n++; if (Math.random() * n < 1) { c.rbI = ni; c.rbJ = nj; }
          }
        }
        const exitTh = Math.atan2(c.rbJ - c.wpJ, c.rbI - c.wpI) + 0.55; // outgoing lane is right of the road centre
        const th = Math.atan2(ry, rx);
        const rem = (((th - exitTh) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (rem < 0.45 && d > 30) {
          c.prevI = c.wpI; c.prevJ = c.wpJ; c.wpI = c.rbI; c.wpJ = c.rbJ; c.rbI = -1; c.rbJ = -1; c.blink = 0;
          const to2 = w.nodePos(c.wpI, c.wpJ), ex = Math.sign(to2.x - C.x), ey = Math.sign(to2.y - C.y);
          tx = to2.x - ey * LANE; ty = to2.y + ex * LANE;
        } else {
          circling = true;
          tx = C.x + Math.cos(th - 0.6) * ROUNDABOUT.lane; ty = C.y + Math.sin(th - 0.6) * ROUNDABOUT.lane;
          cruise = Math.min(cruise, 95);
          c.blink = rem < 1.6 ? 1 : 0;
        }
      }
    }
    if (c.croad < 0 && !circling && !(c.wpI === ROUNDABOUT.i && c.wpJ === ROUNDABOUT.j) && Math.hypot(tx - c.x, ty - c.y) < 55) {
      // pick the next crossing at random (fleeing cars: away from the player), never straight back
      let n = 0, ci = c.prevI, cj = c.prevJ, best = -Infinity;
      for (const d of DIRS) {
        const ni = c.wpI + d[0], nj = c.wpJ + d[1];
        if (ni < 0 || nj < 0 || ni > GRID || nj > GRID) continue;
        if (ni === c.prevI && nj === c.prevJ) continue;
        n++;
        if (c.flee) {
          const np = w.nodePos(ni, nj), score = Math.hypot(np.x - h.fx, np.y - h.fy) + Math.random() * 200;
          if (score > best) { best = score; ci = ni; cj = nj; }
        } else if (Math.random() * n < 1) { ci = ni; cj = nj; }
      }
      c.prevI = c.wpI; c.prevJ = c.wpJ; c.wpI = ci; c.wpJ = cj;
      // indicate the turn: right of the old direction is (-dy, dx)
      const ndx = Math.sign(ci - c.prevI), ndy = Math.sign(cj - c.prevJ), cross = -dy * ndx + dx * ndy;
      c.blink = cross > 0.5 ? 1 : cross < -0.5 ? -1 : 0;
    }
    }
    const diff = steerTo(c, tx, ty);
    if ((c.blink === 1 || c.blink === -1) && Math.abs(diff) < 0.08 && Math.hypot(tx - c.x, ty - c.y) > 120) c.blink = 0; // turn done
    const want = cruise * (Math.abs(diff) > 0.45 ? 0.55 : 1);
    c.throttle = c.vF < want ? 1 : c.vF > want + 40 ? -0.4 : 0;
    c.handbrake = false;
    // obstacles ahead: slow down to a speed that still stops in time instead of slamming the brakes
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    let vSafe = Infinity;
    for (const o of h.cars) {
      if (o === c) continue;
      const ox = o.x - c.x, oy = o.y - c.y;
      const fwd = ox * ca + oy * sa;
      if (fwd > 0 && fwd < LOOK_CAR && Math.abs(-ox * sa + oy * ca) < 22) vSafe = Math.min(vSafe, safeSpeed(fwd, GAP_CAR) + Math.max(0, o.vx * ca + o.vy * sa));
    }
    if (h.onFoot) {
      const ox = h.ped.x - c.x, oy = h.ped.y - c.y;
      const fwd = ox * ca + oy * sa;
      if (fwd > 0 && fwd < LOOK_PED && Math.abs(-ox * sa + oy * ca) < 20) vSafe = Math.min(vSafe, safeSpeed(fwd, GAP_PED));
    }
    if (h.rules.city) { const pd = h.peds.blockDist(c, LOOK_PED); if (pd < Infinity) vSafe = Math.min(vSafe, safeSpeed(pd, GAP_PED)); }
    if (c.vF > vSafe) c.throttle = -clamp((c.vF - vSafe) / 150, 0.2, 1);
    else if (c.vF > vSafe - 30) c.throttle = Math.min(c.throttle, 0);
    stuck(c, dt);
  }

  // cop without a wanted level: drive along the streets like traffic
  patrol(h: TrafficHost, c: Car, dt: number) {
    if (!c.route && !inCity(c.x, c.y) && cityDist(c.x, c.y) > 150) {
      // outside the city: join the nearest highway
      const net = this.world.roads;
      let br = -1, bp = 0, bd = Infinity;
      for (const rd of net.roads) for (let p = 0; p < rd.n; p += 5) { const d = Math.hypot(rd.pts[p * 2] - c.x, rd.pts[p * 2 + 1] - c.y); if (d < bd) { bd = d; br = rd.id; bp = p; } }
      if (br >= 0) { c.croad = br; c.cp = bp; c.cdir = Math.random() < 0.5 ? 1 : -1; c.route = true; }
    }
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
      c.x = sp.x; c.y = sp.y; c.a = sp.a; c.parked = true; c.handbrake = true; c.spotId = sp.id; c.locked = Math.random() < 0.4;
      c.hp = c.maxHp = MODEL_STATS[sp.model].hp; c.mass = MODEL_STATS[sp.model].mass;
      cars.push(c);
      n++;
    }
  }

  private occupied(cars: readonly Car[], sp: ParkingSpot) {
    for (const c of cars) if (Math.abs(c.x - sp.x) < 45 && Math.abs(c.y - sp.y) < 45) return true;
    return false;
  }
}
