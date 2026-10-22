import { BLOCK, ROAD, GRID, inCity, isWater, type World } from "../world/world";
import type { Car, FactionId } from "../vehicles/vehicles";
import { DISTRICTS, blockDistrict } from "../world/districts";

export type CivState = "walk" | "wait" | "flee" | "cower" | "down" | "attack" | "idle";
export type AlarmKind = "shot" | "blast";
// civ: passer-by; cop/swat: police on foot; gang: gang member; fare: taxi customer; target: mission target
export type PedRole = "civ" | "cop" | "swat" | "army" | "gang" | "fare" | "target" | "seeker";
// police on foot (army: soldiers at the top wanted level)
export const isPolice = (r: PedRole) => r === "cop" || r === "swat" || r === "army";
// who fired a shot: the player, the police or a gang (gangs and police fight each other)
export type Team = "player" | "cop" | FactionId;

export interface Civilian {
  active: boolean;
  x: number; y: number; z: number; a: number; vx: number; vy: number; vz: number;
  state: CivState; t: number; dur: number; // time in the current state, planned duration
  bx: number; by: number;   // block whose sidewalk loop the ped walks around
  corner: number;           // corner it is walking to (0 NW, 1 NE, 2 SE, 3 SW)
  dir: 1 | -1;              // walking direction around the block
  cross: boolean;           // crossing a street to the next block
  offPath: boolean;         // walking back to the sidewalk first (e.g. after being pulled out of a car)
  tx: number; ty: number;   // current target point
  speed: number; walk: number; // walking speed, animation phase
  look: number; scale: number; // appearance seed, body size
  threatX: number; threatY: number;
  role: PedRole; faction: FactionId | null;
  hp: number; maxHp: number;
  armed: boolean; shootT: number; // carries a gun / time to the next shot
  shirt: string; pants: string;   // fixed colours (uniforms, gang colours); "" = random look
  tag: string;                    // mission marker
  id: number;                     // index in the pool
  target: number;                 // ped it fights (-1: the player)
  getUp: number;                  // knocked down but not hurt: stands up after this many seconds (0: stays down)
  air: boolean; spin: number;     // flying after a hit (ragdoll), how fast the body tumbles
}

// what the pedestrian system needs from the game
export interface PedHost {
  readonly cars: readonly Car[];
  readonly fx: number; readonly fy: number; readonly fz: number;
  readonly onFoot: boolean;
  readonly ped: { x: number; y: number };
  readonly stars: number;
  pedHit(c: Civilian, by: Car, speed: number): void;
  enemyShot(x: number, y: number, z: number, a: number, dmg: number, team: Team, src: number): void;
  gangHostile(f: FactionId): boolean;
}

// uniforms and gang colours
export const ROLE_LOOK: Record<"cop" | "swat" | "army" | FactionId, { shirt: string; pants: string; hp: number }> = {
  cop: { shirt: "#1f3a6e", pants: "#16213a", hp: 80 },
  swat: { shirt: "#1b1d22", pants: "#22252b", hp: 160 },
  army: { shirt: "#4b5320", pants: "#3b3f2a", hp: 200 },
  halcones: { shirt: "#c0392b", pants: "#2b2f3a", hp: 70 },
  kings: { shirt: "#7d3c98", pants: "#1c1c22", hp: 70 },
};

export const MAX_PEDS = 32;
export const PED_LIMIT = { high: 24, low: 12 };
const HOSTILE_EXTRA = 8;                 // armed peds may exceed the normal limit by this much
const ATTACK_RANGE = 230, ATTACK_KEEP = 120, ENEMY_DMG = { cop: 7, swat: 10, army: 12, gang: 6 };
const INSET = 12;                        // sidewalk path: distance from the block edge (buildings start at 18)
const SPAWN_MIN = 300, SPAWN_MAX = 950, DESPAWN = 1150;
const WALK_V: [number, number] = [14, 19], FLEE_V: [number, number] = [75, 95]; // 1.4–1.9 m/s walking, running away
const CROSS_CHANCE = 0.3, MAX_WAIT = 5;
const DOWN_TIME = 10;                    // knocked-down peds disappear after this
const PED_R = 5;
const DODGE_DIST = 110, DODGE_SPEED = 110;
const GRAV = 620;
const TURNS = [0.9, -0.9, 1.6, -1.6];     // directions tried when something blocks the way
const FIGHT_RANGE = 280;                 // gang members open fire on police officers this close

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// neighbour reached by crossing a street from a corner: [dbx, dby, corner on the other side]
const CROSSINGS: [number, number, number][][] = [
  [[0, -1, 3], [-1, 0, 1]], // NW: north, west
  [[0, -1, 2], [1, 0, 0]],  // NE: north, east
  [[0, 1, 1], [1, 0, 3]],   // SE: south, east
  [[0, 1, 0], [-1, 0, 2]],  // SW: south, west
];

const P = { x: 0, y: 0 }, Q = { x: 0, y: 0 }; // scratch points

function cornerPos(bx: number, by: number, k: number, out: { x: number; y: number }) {
  const x0 = bx * BLOCK + ROAD + INSET, y0 = by * BLOCK + ROAD + INSET, s = BLOCK - ROAD - INSET * 2;
  out.x = k === 1 || k === 2 ? x0 + s : x0;
  out.y = k >= 2 ? y0 + s : y0;
  return out;
}

function newCiv(id: number): Civilian {
  return {
    active: false, x: 0, y: 0, z: 0, a: 0, vx: 0, vy: 0, vz: 0, state: "walk", t: 0, dur: 0,
    bx: 0, by: 0, corner: 0, dir: 1, cross: false, offPath: false, tx: 0, ty: 0,
    speed: 30, walk: 0, look: 0, scale: 1, threatX: 0, threatY: 0,
    role: "civ", faction: null, hp: 30, maxHp: 30, armed: false, shootT: 0, shirt: "", pants: "", tag: "",
    id, target: -1, getUp: 0, air: false, spin: 0,
  };
}

export class PedSystem {
  list: Civilian[] = [];
  limit = PED_LIMIT.high;
  private cars: readonly Car[] = [];

  constructor(private world: World) {
    for (let i = 0; i < MAX_PEDS; i++) this.list.push(newCiv(i));
  }

  get count() { let n = 0; for (const c of this.list) if (c.active) n++; return n; }

  clear() { for (const c of this.list) c.active = false; }

  // fill the area around the player right away (game start)
  populate(fx: number, fy: number) {
    const n = Math.round(this.limit * 0.7);
    for (let i = 0; i < n; i++) this.trySpawn(fx, fy, 120);
  }

  // extra: police, gang fights and mission peds may use the slots above the normal limit
  private free(extra = false): Civilian | null {
    const n = extra ? Math.min(MAX_PEDS, this.limit + HOSTILE_EXTRA) : this.limit;
    for (let i = 0; i < n; i++) if (!this.list[i].active) return this.list[i];
    return null;
  }

  private init(c: Civilian, x: number, y: number) {
    c.active = true; c.x = x; c.y = y; c.z = 0; c.vx = 0; c.vy = 0; c.vz = 0;
    c.state = "walk"; c.t = 0; c.dur = 0; c.cross = false; c.offPath = false;
    c.speed = rnd(WALK_V[0], WALK_V[1]); c.walk = Math.random() * 10;
    c.look = Math.floor(Math.random() * 1e6); c.scale = rnd(0.9, 1.06);
    c.role = "civ"; c.faction = null; c.hp = c.maxHp = 30; c.armed = false; c.shootT = 0; c.shirt = ""; c.pants = ""; c.tag = ""; c.target = -1; c.getUp = 0;
  }

  // police on foot, gang members, mission peds
  spawnRole(role: PedRole, x: number, y: number, faction: FactionId | null = null): Civilian | null {
    const c = this.free(true);
    if (!c) return null;
    this.init(c, x, y);
    c.role = role; c.faction = faction;
    c.bx = clamp(Math.floor((x - ROAD / 2) / BLOCK), 0, GRID - 1); c.by = clamp(Math.floor((y - ROAD / 2) / BLOCK), 0, GRID - 1);
    const look = role === "cop" || role === "swat" || role === "army" ? ROLE_LOOK[role] : faction ? ROLE_LOOK[faction] : null;
    if (look) { c.shirt = look.shirt; c.pants = look.pants; c.hp = c.maxHp = look.hp; }
    if (role === "swat" || role === "army") c.scale = 1.08;
    c.armed = isPolice(role) || role === "gang";
    c.state = isPolice(role) ? "attack" : role === "gang" ? "idle" : "walk";
    if (role === "fare" || role === "target") { c.state = "idle"; c.hp = c.maxHp = 40; }
    c.shootT = rnd(0.8, 1.6);
    return c;
  }

  // gang members hang around in their own district
  private trySpawnGang(h: PedHost, fx: number, fy: number) {
    const gx = clamp(Math.floor((fx - ROAD) / BLOCK) + Math.floor(rnd(-2, 3)), 0, GRID - 1), gy = clamp(Math.floor((fy - ROAD) / BLOCK) + Math.floor(rnd(-2, 3)), 0, GRID - 1);
    const f = DISTRICTS[blockDistrict(gx, gy)].gang;
    if (!f) return;
    let n = 0;
    for (const c of this.list) if (c.active && c.role === "gang") n++;
    if (n >= 6) return;
    cornerPos(gx, gy, Math.floor(Math.random() * 4), P);
    if (Math.hypot(P.x - fx, P.y - fy) < SPAWN_MIN) return;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const c = this.spawnRole("gang", P.x + rnd(-14, 14), P.y + rnd(-14, 14), f);
      if (c && h.gangHostile(f)) c.state = "attack";
    }
  }

  private trySpawn(fx: number, fy: number, minD = SPAWN_MIN) {
    if (!inCity(fx, fy)) return;
    const c = this.free();
    if (!c) return;
    const cbx = Math.floor((fx - ROAD) / BLOCK), cby = Math.floor((fy - ROAD) / BLOCK);
    for (let tries = 0; tries < 8; tries++) {
      const bx = clamp(cbx + Math.floor(rnd(-2, 3)), 0, GRID - 1), by = clamp(cby + Math.floor(rnd(-2, 3)), 0, GRID - 1);
      const k = Math.floor(Math.random() * 4), t = Math.random();
      cornerPos(bx, by, k, P); cornerPos(bx, by, (k + 1) % 4, Q);
      const x = P.x + (Q.x - P.x) * t, y = P.y + (Q.y - P.y) * t;
      const d = Math.hypot(x - fx, y - fy);
      if (d < minD || d > SPAWN_MAX) continue;
      this.init(c, x, y);
      c.bx = bx; c.by = by;
      if (Math.random() < 0.5) { c.dir = 1; c.corner = (k + 1) % 4; } else { c.dir = -1; c.corner = k; }
      this.targetCorner(c);
      c.a = Math.atan2(c.ty - y, c.tx - x);
      return;
    }
  }

  // the pool is full: the passer-by farthest from (x, y) goes home (sandbox menu)
  makeRoom(x: number, y: number): boolean {
    let best: Civilian | null = null, bd = -1;
    for (const c of this.list) { if (!c.active || c.tag || (c.role !== "civ" && c.state !== "down")) continue; const d = Math.hypot(c.x - x, c.y - y); if (d > bd) { bd = d; best = c; } }
    if (best) best.active = false;
    return !!best;
  }

  // a passer-by at (x, y) who walks to the nearest sidewalk first (sandbox menu)
  spawnCiv(x: number, y: number): Civilian | null {
    const c = this.free(true);
    if (!c) return null;
    this.init(c, x, y);
    this.targetSidewalk(c);
    return c;
  }

  // a person pulled out of a car: runs away from the car, then back to the sidewalk
  // somebody gets out of a car (pulled out by the player: falls, gets up and runs; fight: a gang member or cop who hits back)
  spawnAt(x: number, y: number, threatX: number, threatY: number, pulled = false, fight: { role: PedRole; faction: FactionId | null } | null = null) {
    const c = this.free() ?? this.list.find((o) => o.active && o.state !== "down") ?? null;
    if (!c) return null;
    this.init(c, x, y);
    c.bx = clamp(Math.floor((x - ROAD) / BLOCK), 0, GRID - 1); c.by = clamp(Math.floor((y - ROAD) / BLOCK), 0, GRID - 1);
    c.dir = 1; c.corner = 0;
    c.threatX = threatX; c.threatY = threatY;
    if (fight) {
      c.role = fight.role; c.faction = fight.faction; c.hp = c.maxHp = 60;
      if (fight.faction) { const col = fight.faction === "halcones" ? "#c0392b" : "#8e44ad"; c.shirt = col; c.pants = "#1c1c22"; }
      c.state = "attack"; c.target = -1; c.speed = 115;
      return c;
    }
    if (pulled) {
      const dx = x - threatX, dy = y - threatY, d = Math.hypot(dx, dy) || 1;
      this.knockDown(c, (dx / d) * 60, (dy / d) * 60, 40);
      c.getUp = 1.6;
      return c;
    }
    this.scare(c, threatX, threatY);
    return c;
  }

  private targetCorner(c: Civilian) { cornerPos(c.bx, c.by, c.corner, P); c.tx = P.x; c.ty = P.y; }

  // nearest point on the sidewalk loop of the block the ped is in or next to
  private targetSidewalk(c: Civilian) {
    c.bx = clamp(Math.floor((c.x - ROAD / 2) / BLOCK), 0, GRID - 1); c.by = clamp(Math.floor((c.y - ROAD / 2) / BLOCK), 0, GRID - 1);
    cornerPos(c.bx, c.by, 0, P); cornerPos(c.bx, c.by, 2, Q);
    const x = clamp(c.x, P.x, Q.x), y = clamp(c.y, P.y, Q.y);
    // push to the closest edge of the loop
    const dl = x - P.x, dr = Q.x - x, dt = y - P.y, db = Q.y - y, m = Math.min(dl, dr, dt, db);
    c.tx = m === dl ? P.x : m === dr ? Q.x : x;
    c.ty = m === dt ? P.y : m === db ? Q.y : y;
    c.offPath = true;
  }

  // after reaching the loop: head for the nearest corner (the other end of this edge is "behind")
  private joinLoop(c: Civilian) {
    c.offPath = false;
    let best = 0, bd = Infinity;
    for (let k = 0; k < 4; k++) { cornerPos(c.bx, c.by, k, P); const d = Math.hypot(P.x - c.x, P.y - c.y); if (d < bd) { bd = d; best = k; } }
    c.corner = best;
    cornerPos(c.bx, c.by, (best + 1) % 4, P);
    const nextOnEdge = Math.abs(P.x - c.x) < 3 || Math.abs(P.y - c.y) < 3;
    c.dir = nextOnEdge ? -1 : 1;
    if (c.state === "flee") this.fleeDir(c);
    else this.targetCorner(c);
  }

  // flee along the sidewalk: keep going or turn around, whichever end of the edge is further from the threat
  private fleeDir(c: Civilian) {
    const prev = (c.corner + (c.dir > 0 ? 3 : 1)) % 4;
    cornerPos(c.bx, c.by, c.corner, P); cornerPos(c.bx, c.by, prev, Q);
    if (Math.hypot(Q.x - c.threatX, Q.y - c.threatY) > Math.hypot(P.x - c.threatX, P.y - c.threatY)) { c.corner = prev; c.dir = c.dir > 0 ? -1 : 1; }
    this.targetCorner(c);
  }

  private scare(c: Civilian, x: number, y: number) {
    if (c.state === "down" || c.state === "attack" || isPolice(c.role) || c.tag === "fare" || c.role === "seeker") return;
    if (c.role === "gang") return; // gangs do not run away (they fight back when hurt, see damage)
    c.threatX = x; c.threatY = y;
    const wasFleeing = c.state === "flee";
    c.state = "flee"; c.t = 0; c.dur = rnd(5, 8);
    c.speed = rnd(FLEE_V[0], FLEE_V[1]);
    if (c.cross) return; // keep running across the street
    if (!inCity(c.x, c.y) || this.offLoop(c)) { this.targetSidewalk(c); return; }
    if (!wasFleeing) this.fleeDir(c);
  }

  private offLoop(c: Civilian) {
    cornerPos(c.bx, c.by, 0, P); cornerPos(c.bx, c.by, 2, Q);
    const e = 4;
    const inX = c.x > P.x - e && c.x < Q.x + e, inY = c.y > P.y - e && c.y < Q.y + e;
    const onV = Math.abs(c.x - P.x) < e || Math.abs(c.x - Q.x) < e, onH = Math.abs(c.y - P.y) < e || Math.abs(c.y - Q.y) < e;
    return !((onV && inY) || (onH && inX));
  }

  // make a ped run away from (x, y) for dur seconds (fleeing suspects)
  panic(c: Civilian, x: number, y: number, dur: number) {
    if (!c.active || c.state === "down") return;
    this.scare(c, x, y);
    c.dur = dur;
  }

  // gunshots and explosions scare everybody around
  alarm(x: number, y: number, radius: number, kind: AlarmKind) {
    for (const c of this.list) {
      if (!c.active || c.state === "down" || c.armed || c.role === "seeker") continue; // police and gangs do not run, the hide-and-seek game goes on
      const d = Math.hypot(c.x - x, c.y - y);
      if (d > radius) continue;
      if (kind === "shot" && d < 160 && c.state !== "flee" && Math.random() < 0.35) { c.state = "cower"; c.t = 0; c.dur = rnd(2.5, 4.5); c.threatX = x; c.threatY = y; }
      else if (c.state !== "cower") this.scare(c, x, y);
    }
  }

  knockDown(c: Civilian, vx: number, vy: number, vz: number) {
    c.state = "down"; c.t = 0; c.cross = false;
    c.vx = vx; c.vy = vy; c.vz = vz;
    const sp = Math.hypot(vx, vy);
    if (sp > 5) c.a = Math.atan2(-vy, -vx); // falls on the back, feet towards the hit
    c.spin = Math.min(16, sp / 45 + vz / 60) * (Math.random() < 0.5 ? -1 : 1); // tumbles through the air
  }

  // explosion: knock down everybody inside the radius; returns how many
  blast(x: number, y: number, r: number) {
    let n = 0;
    for (const c of this.list) {
      if (!c.active || c.state === "down") continue;
      const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy);
      if (d > r) continue;
      const f = 1 - d / r, s = 260 * f / Math.max(d, 1);
      this.knockDown(c, dx * s, dy * s, 120 + 220 * f);
      n++;
    }
    return n;
  }

  // standing ped hit by a projectile at (x, y, z)?
  hitTest(x: number, y: number, z: number, r: number): Civilian | null {
    for (const c of this.list) {
      if (!c.active || c.state === "down") continue;
      if (Math.abs(z - c.z - 12) > 16) continue;
      const dx = c.x - x, dy = c.y - y;
      if (dx * dx + dy * dy < r * r) return c;
    }
    return null;
  }

  // distance to the nearest pedestrian walking in front of car c (traffic brakes for it), Infinity if none
  blockDist(c: Car, range: number): number {
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    let best = Infinity;
    for (const p of this.list) {
      if (!p.active) continue;
      const ox = p.x - c.x, oy = p.y - c.y;
      const fwd = ox * ca + oy * sa;
      if (fwd < 0 || fwd > range || fwd >= best) continue;
      if (Math.abs(-ox * sa + oy * ca) < 18) best = fwd;
    }
    return best;
  }

  // projectile hit / punch; returns true when the ped goes down
  // by: ped that fired (-1: the player or nobody); armed peds fight back against it
  damage(c: Civilian, dmg: number, fromX: number, fromY: number, push: number, by = -1): boolean {
    if (!c.active || c.state === "down") return false;
    c.hp -= dmg;
    if (c.hp <= 0) {
      const dx = c.x - fromX, dy = c.y - fromY, d = Math.max(1, Math.hypot(dx, dy));
      this.knockDown(c, (dx / d) * push, (dy / d) * push, 50);
      return true;
    }
    if (by >= 0 && by !== c.id && c.armed) { c.target = by; c.state = "attack"; c.t = 0; } // fight back against that ped
    else if (by < 0 && c.role === "gang") { c.target = -1; c.state = "attack"; c.t = 0; } // the player hurt a gang member
    else if (!c.armed) this.scare(c, fromX, fromY);
    return false;
  }

  // standing ped in front of (x, y) facing a, for punches and bats
  meleeTarget(x: number, y: number, a: number, range: number): Civilian | null {
    let best: Civilian | null = null, bd = range;
    for (const c of this.list) {
      if (!c.active || c.state === "down") continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d >= bd) continue;
      if (Math.abs(wrap(Math.atan2(c.y - y, c.x - x) - a)) > 1.1) continue;
      best = c; bd = d;
    }
    return best;
  }

  // police on foot standing close to (x, y) (arrests)
  copsNear(x: number, y: number, r: number) {
    let n = 0;
    for (const c of this.list) if (c.active && c.state === "attack" && isPolice(c.role) && Math.hypot(c.x - x, c.y - y) < r) n++;
    return n;
  }

  // a passer-by who can see (x, y) (crime witnesses)
  witness(x: number, y: number, r: number): boolean {
    for (const c of this.list) {
      if (!c.active || c.state === "down" || c.role !== "civ") continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < r && (d < 60 || this.world.lineClear(c.x, c.y, x, y, 40))) return true;
    }
    return false;
  }

  // police and gangs are enemies
  static hostile(team: Team, c: Civilian): boolean {
    if (team === "player") return false;
    if (team === "cop") return c.role === "gang";
    return isPolice(c.role);
  }
  static teamOf(c: Civilian): Team { return c.role === "gang" && c.faction ? c.faction : "cop"; }

  // a gang member looks for police officers close by (gang turf firefights)
  private findOpponent(c: Civilian): number {
    let best = -1, bd = FIGHT_RANGE;
    for (const o of this.list) {
      if (!o.active || o.state === "down" || !isPolice(o.role)) continue;
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (d < bd && this.world.lineClear(c.x, c.y, o.x, o.y, 40)) { bd = d; best = o.id; }
    }
    return best;
  }

  private civCount() { let n = 0; for (const c of this.list) if (c.active && c.role === "civ") n++; return n; }

  update(dt: number, h: PedHost) {
    const fx = h.fx, fy = h.fy;
    this.cars = h.cars;
    if (this.civCount() < this.limit && Math.random() < 15 * dt) this.trySpawn(fx, fy);
    if (Math.random() < 0.72 * dt) this.trySpawnGang(h, fx, fy);
    for (const c of this.list) {
      if (!c.active) continue;
      c.t += dt;
      const dist = Math.hypot(c.x - fx, c.y - fy);
      const far = c.tag ? Infinity : c.armed ? DESPAWN + 400 : DESPAWN; // mission peds stay
      if ((c.state === "down" && c.t > DOWN_TIME && !c.tag) || (dist > far && c.state !== "down")) { c.active = false; continue; }
      if (c.state === "down") {
        this.fall(c, dt);
        // not hurt badly: stands up again and runs off
        if (c.getUp > 0 && c.t > c.getUp && c.hp > 0) { c.getUp = 0; c.state = "walk"; this.scare(c, c.threatX, c.threatY); }
        continue;
      }
      const cop = isPolice(c.role);
      if (cop && c.state === "attack" && h.stars === 0 && c.target < 0) { c.state = "walk"; c.speed = rnd(WALK_V[0], WALK_V[1]); this.targetSidewalk(c); }
      else if (cop && c.state !== "attack" && h.stars > 0 && dist < 500) { c.state = "attack"; c.t = 0; }
      if (c.role === "gang" && c.state === "idle" && c.faction && h.gangHostile(c.faction) && dist < 320) { c.state = "attack"; c.t = 0; }
      if (c.target >= 0) { const o = this.list[c.target]; if (!o.active || o.state === "down") c.target = -1; }
      // a gang member that is not angry at you (any more) calms down
      if (c.role === "gang" && !c.tag && c.state === "attack" && c.target < 0 && c.faction && !h.gangHostile(c.faction) && c.t > 4) { c.state = "idle"; c.t = 0; }
      // gangs shoot at police in their turf (checked about once a second)
      if (c.role === "gang" && c.target < 0 && (c.state === "idle" || c.state === "attack") && Math.random() < dt) {
        const o = this.findOpponent(c);
        if (o >= 0) { c.target = o; c.state = "attack"; c.t = 0; const cop = this.list[o]; if (cop.target < 0) { cop.target = c.id; cop.state = "attack"; } }
      }
      switch (c.state) {
        case "idle":
          c.vx = 0; c.vy = 0;
          if (c.role === "gang") c.a += Math.sin(c.t * 0.7 + c.look) * dt * 0.6;
          break;
        case "attack":
          this.attack(c, dt, h, dist);
          break;
        case "walk": case "flee":
          if (c.state === "flee" && c.t > c.dur && !c.cross) {
            c.state = "walk"; c.speed = rnd(WALK_V[0], WALK_V[1]); c.t = 0;
            if (!c.offPath) { this.targetCorner(c); }
          }
          if (this.move(c, dt)) this.arrive(c);
          break;
        case "wait":
          c.vx = 0; c.vy = 0;
          if (c.t > c.dur || this.roadClear(c)) { c.state = "walk"; c.t = 0; c.cross = true; }
          break;
        case "cower":
          c.vx = 0; c.vy = 0;
          if (c.t > c.dur) this.scare(c, c.threatX, c.threatY);
          break;
      }
      if (c.state === "walk" || c.state === "wait" || c.state === "idle") this.watchTraffic(c, h);
      this.hitByCars(c, h);
      if (h.onFoot) this.pushFrom(c, h.ped.x, h.ped.y, 10);
    }
  }

  // police and gang members: close in on the player and shoot when they have a clear line
  private attack(c: Civilian, dt: number, h: PedHost, dPlayer: number) {
    const cop = isPolice(c.role);
    const foe = c.target >= 0 ? this.list[c.target] : null;
    const fx = foe ? foe.x : h.fx, fy = foe ? foe.y : h.fy, fz = foe ? foe.z : h.fz;
    const dx = fx - c.x, dy = fy - c.y, d = foe ? Math.max(1, Math.hypot(dx, dy)) : dPlayer;
    c.a = Math.atan2(dy, dx);
    const speed = c.role === "swat" || c.role === "army" ? 125 : cop ? 135 : 115;
    const arrest = cop && !foe && h.stars <= 1; // 1 star: they want to cuff you, not shoot
    if (d > (arrest ? 18 : ATTACK_KEEP)) {
      const nx = c.x + (dx / d) * speed * dt, ny = c.y + (dy / d) * speed * dt;
      if (!this.blocked(nx, c.y)) c.x = nx;
      if (!this.blocked(c.x, ny)) c.y = ny;
      c.vx = (dx / d) * speed; c.vy = (dy / d) * speed;
      c.walk += dt * speed * 0.05;
    } else { c.vx = 0; c.vy = 0; }
    if (!c.armed || arrest || d > ATTACK_RANGE) return;
    c.shootT -= dt;
    if (c.shootT > 0) return;
    c.shootT = c.role === "swat" || c.role === "army" ? rnd(0.35, 0.7) : rnd(0.7, 1.4);
    if (!this.world.lineClear(c.x, c.y, fx, fy, 30)) return;
    const dmg = c.role === "swat" ? ENEMY_DMG.swat : c.role === "army" ? ENEMY_DMG.army : cop ? ENEMY_DMG.cop : ENEMY_DMG.gang;
    const za = Math.atan2(fz + 12 - (c.z + 15), d);
    h.enemyShot(c.x + Math.cos(c.a) * 8, c.y + Math.sin(c.a) * 8, c.z + 15 + Math.sin(za) * 8, c.a + rnd(-0.1, 0.1), dmg, PedSystem.teamOf(c), c.id);
  }

  // buildings, harbour containers and tree trunks block pedestrians
  private blocked(x: number, y: number) { return this.world.isSolid(x, y, 5) || this.world.treeHit(x, y, PED_R) || isWater(x, y); }

  // move towards the target; true when it is reached
  private move(c: Civilian, dt: number) {
    const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy), step = c.speed * dt;
    if (d > 0.01) c.a += wrap(Math.atan2(dy, dx) - c.a) * Math.min(1, dt * 10);
    if (d <= step) { c.x = c.tx; c.y = c.ty; c.vx = 0; c.vy = 0; c.walk += step * 0.05; return true; }
    c.vx = (dx / d) * c.speed; c.vy = (dy / d) * c.speed;
    let nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
    if (this.blocked(nx, ny)) {
      // step around the obstacle: try turning left or right, keep the side that works
      let ok = false;
      for (const turn of TURNS) {
        const a = Math.atan2(dy, dx) + turn;
        const sx = c.x + Math.cos(a) * step, sy = c.y + Math.sin(a) * step;
        if (!this.blocked(sx, sy)) { nx = sx; ny = sy; ok = true; break; }
      }
      if (!ok && this.world.isSolid(nx, ny, 2)) { nx = c.x; ny = c.y; } // a wall: wait; a tree: squeeze past
    }
    c.x = nx; c.y = ny;
    c.z = this.world.rampH(c.x, c.y); // walk up and over ramps
    c.walk += dt * c.speed * 0.05;
    return false;
  }

  private arrive(c: Civilian) {
    if (c.offPath) { this.joinLoop(c); return; }
    if (c.cross) {
      // reached the other side of the street: tx/ty are on the new block
      c.cross = false;
      c.dir = Math.random() < 0.5 ? 1 : -1;
      c.corner = (c.corner + (c.dir > 0 ? 1 : 3)) % 4;
      this.targetCorner(c);
      return;
    }
    if (c.state === "walk" && Math.random() < CROSS_CHANCE) {
      const opts = CROSSINGS[c.corner];
      const o = opts[Math.random() < 0.5 ? 0 : 1];
      const nbx = c.bx + o[0], nby = c.by + o[1];
      if (nbx >= 0 && nby >= 0 && nbx < GRID && nby < GRID) {
        c.bx = nbx; c.by = nby; c.corner = o[2];
        this.targetCorner(c);
        c.state = "wait"; c.t = 0; c.dur = rnd(1, MAX_WAIT);
        return;
      }
    }
    c.corner = (c.corner + (c.dir > 0 ? 1 : 3)) % 4;
    this.targetCorner(c);
  }

  // no moving car close to the crossing
  private roadClear(c: Civilian) {
    const mx = (c.x + c.tx) / 2, my = (c.y + c.ty) / 2;
    for (const car of this.cars) {
      if (car.speed < 40) continue;
      if (Math.abs(car.x - mx) < 170 && Math.abs(car.y - my) < 170) return false;
    }
    return true;
  }

  // dodge cars that come straight at them
  private watchTraffic(c: Civilian, h: PedHost) {
    for (const car of h.cars) {
      const sp = car.speed;
      if (sp < DODGE_SPEED) continue;
      const dx = c.x - car.x, dy = c.y - car.y, d = Math.hypot(dx, dy);
      if (d > DODGE_DIST || d < 1) continue;
      if ((car.vx * dx + car.vy * dy) / (sp * d) > 0.8) { this.scare(c, car.x, car.y); return; }
    }
  }

  private hitByCars(c: Civilian, h: PedHost) {
    for (const car of h.cars) {
      const dx = c.x - car.x, dy = c.y - car.y;
      const R = car.hl + PED_R + 2;
      if (dx * dx + dy * dy > R * R) continue;
      if (Math.abs(car.z - c.z) > 20) continue;
      const ca = Math.cos(car.a), sa = Math.sin(car.a);
      const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
      if (Math.abs(lx) > car.hl + PED_R || Math.abs(ly) > car.hw + PED_R) continue; // the real size of this car
      const sp = car.speed;
      if (sp > 60 && !car.dead && (c.role !== "seeker" || (car.kind === "player" && !h.onFoot && sp > 150))) { // hide and seek: only running them over on purpose counts
        const s = sp * 0.7;
        const side = ly >= 0 ? 1 : -1;
        this.knockDown(c, car.vx * 0.85 - sa * side * 50, car.vy * 0.85 + ca * side * 50, 80 + s * 0.55);
        car.vx *= 0.94; car.vy *= 0.94;
        h.pedHit(c, car, sp);
        return;
      }
      // slow car: just step aside
      const px = car.hw + PED_R - Math.abs(ly);
      const side = ly >= 0 ? 1 : -1;
      c.x += -sa * side * px; c.y += ca * side * px;
    }
  }

  private pushFrom(c: Civilian, x: number, y: number, r: number) {
    const dx = c.x - x, dy = c.y - y, d2 = dx * dx + dy * dy;
    if (d2 >= r * r || d2 < 0.0001) return;
    const d = Math.sqrt(d2), k = (r - d) / d;
    c.x += dx * k; c.y += dy * k;
  }

  private fall(c: Civilian, dt: number) {
    const f = Math.exp(-(c.z > 0.5 ? 0.6 : 5) * dt);
    c.vx *= f; c.vy *= f;
    const nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
    if (!this.world.isSolid(nx, ny, 4)) { c.x = nx; c.y = ny; } else { c.vx = 0; c.vy = 0; }
    c.vz -= GRAV * dt; c.z += c.vz * dt;
    const gz = this.world.rampH(c.x, c.y);
    if (c.z < gz) { c.z = gz; c.vz = c.vz < -150 ? -c.vz * 0.25 : 0; c.spin *= 0.5; }
    c.air = c.z > gz + 1.5;
  }
}
