import { Car } from "./vehicles";
import { ROAD, GRID, inCity, terrainH } from "./world";
import { steerTo, avoid, stuck } from "./traffic";
import { SEEN_CLOSE, SEEN_DIST } from "./wanted";
import { isPolice } from "./peds";
import { sfx } from "./audio";
import type { Game } from "./engine";

// police beyond the patrol cars: sight / last known position, cops on foot, roadblocks, helicopter, SWAT
export const HELI_STARS = 4, ROADBLOCK_STARS = 3, SWAT_STARS = 5, ARMY_STARS = 6, SPIKE_STARS = 4;
const SHELL_EVERY: [number, number] = [3.2, 4.5], SHELL_RANGE = 750; // armoured car: time between shots, range
const PIT_RANGE = 150;            // a cop this close to a fast player aims for the rear corner (spin him out)
const SPIKE_LIFE = 60, SPIKE_W = 120, SPIKE_D = 12;
const HELI_HP = 260, HELI_ALT = 190, HELI_SPEED = 300, HELI_SPOT = 260;
const ROADBLOCK_EVERY = 22;
const SEARCH_R = (stars: number) => 260 + stars * 120;

export interface Spike { x: number; y: number; alongX: boolean; t: number; } // strip across the road, alongX: strip runs along x
export interface Heli { x: number; y: number; z: number; a: number; vx: number; vy: number; hp: number; dead: boolean; vz: number; shootT: number; rotor: number; }

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Police {
  heli: Heli | null = null;
  spikes: Spike[] = [];
  lastX = 0; lastY = 0;        // where the police saw you last
  seen = false;                // somebody sees you right now
  private searchX = 0; private searchY = 0; private searchT = 0;
  private roadblockT = ROADBLOCK_EVERY;
  private armyCalled = false;
  private rotorT = 0;

  constructor(private g: Game) {}

  reset() { this.heli = null; this.seen = false; this.roadblockT = ROADBLOCK_EVERY; this.spikes.length = 0; }
  get searchRadius() { return SEARCH_R(this.g.wanted.stars); }

  // a cop car / cop on foot / the helicopter can see (x, y)
  copSees(x: number, y: number, loud = false): boolean {
    const g = this.g;
    for (const c of g.cars) {
      if (c.kind !== "cop" || c.dead || c.calm) continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < SEEN_CLOSE || (loud && d < 600) || (d < SEEN_DIST && g.world.lineClear(c.x, c.y, x, y, 50))) return true;
    }
    for (const p of g.peds.list) {
      if (!p.active || p.state === "down" || !isPolice(p.role)) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 120 || (d < 420 && g.world.lineClear(p.x, p.y, x, y, 40))) return true;
    }
    const h = this.heli;
    return !!h && !h.dead && Math.hypot(h.x - x, h.y - y) < HELI_SPOT + 120;
  }
  // also counts calm patrol cars: a crime right in front of them is noticed
  patrolSees(x: number, y: number): boolean {
    for (const c of this.g.cars) {
      if (c.kind !== "cop" || c.dead || !c.calm) continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < SEEN_CLOSE || (d < 450 && this.g.world.lineClear(c.x, c.y, x, y, 50))) return true;
    }
    return false;
  }

  spawnCop() {
    const g = this.g, fx = g.fx, fy = g.fy;
    const outside = !inCity(fx, fy);
    for (let tries = 0; tries < 40; tries++) {
      let x: number, y: number;
      if (outside) {
        const a = Math.random() * TAU, d = rnd(850, 1250);
        x = fx + Math.cos(a) * d; y = fy + Math.sin(a) * d;
        if (inCity(x, y)) { const n = g.world.nearestNode(x, y); const np = g.world.nodePos(n.i, n.j); x = np.x; y = np.y; }
        if (g.world.isSolid(x, y, 20)) continue;
      } else {
        const i = Math.floor(Math.random() * (GRID + 1)), j = Math.floor(Math.random() * (GRID + 1));
        const np = g.world.nodePos(i, j);
        x = np.x; y = np.y;
      }
      const d = Math.hypot(x - fx, y - fy);
      if (d < 800 || d > 1350) continue;
      // SWAT vans at 5 stars, armoured cars of the military at 6 (open world)
      const army = g.rules.city && g.wanted.stars >= ARMY_STARS && Math.random() < 0.45;
      const swat = !army && g.rules.city && g.wanted.stars >= SWAT_STARS && Math.random() < 0.6;
      const c = new Car("cop", army ? "armor" : swat ? "swat" : "police", army ? "#4b5320" : swat ? "#1b1d22" : "#f4f6fa");
      c.x = x; c.y = y; c.z = terrainH(x, y);
      c.a = Math.atan2(fy - y, fx - x);
      c.hp = c.maxHp = army ? 600 : swat ? 220 : g.config.difficulty === "easy" ? 70 : 100;
      c.mass = army ? 4 : swat ? 2 : 1.25;
      c.shootT = rnd(SHELL_EVERY[0], SHELL_EVERY[1]);
      if (army && !this.armyCalled) { this.armyCalled = true; g.banner("MILITÄR", "Radpanzer rücken aus – versteck dich!", "#9fb35a", 2.4); }
      c.driver = g.rules.city; // open world: officers get out when you are on foot
      g.cars.push(c);
      return;
    }
  }

  copAI(c: Car, dt: number) {
    const g = this.g, w = g.world;
    c.route = false;
    // chase mode: always straight at you; open world: at the last known position while nobody sees you
    let fx = g.fx, fy = g.fy, fvx = g.fvx, fvy = g.fvy;
    if (g.rules.starsDecay && !this.seen) {
      if (Math.hypot(c.x - this.searchX, c.y - this.searchY) < 120 || this.searchT <= 0) this.pickSearch();
      fx = this.searchX; fy = this.searchY; fvx = 0; fvy = 0;
    }
    const d = Math.hypot(fx - c.x, fy - c.y);
    let tx: number, ty: number;
    if (g.ending || g.ped.dead) { steerTo(c, g.fx, g.fy); c.throttle = d > 120 ? 0.6 : -0.3; c.handbrake = false; return; }
    // officers get out when you are on foot and close (open world)
    if (c.driver && g.onFoot && this.seen && Math.hypot(g.fx - c.x, g.fy - c.y) < 170 && c.speed < 60) { this.dismount(c); return; }
    // cops also use ramps: "elevated" = currently on a ramp or roof
    const elevated = c.z > terrainH(c.x, c.y) + 15;
    const roofRamp = !g.onFoot && g.player.z > 25 && this.seen ? w.rampToRoofAt(fx, fy) : null;
    const direct = elevated || !inCity(c.x, c.y) || !inCity(fx, fy) || (d < 650 && w.lineClear(c.x, c.y, fx, fy));
    if (c.model === "armor") this.turret(c, d, dt);
    // half of the cars try to cut you off: they head for the crossing in front of you
    const intercept = c.siren > 5 && this.seen && !g.onFoot && g.player.speed > 150;
    if (roofRamp && !elevated) {
      const rs = w.rampStart(roofRamp);
      tx = rs.x; ty = rs.y;
      c.hasWp = false;
    } else if (direct) {
      const lead = Math.min(g.diff.lead, d / 700);
      tx = fx + fvx * lead; ty = fy + fvy * lead;
      // close behind a fast car: aim for its rear corner (PIT manoeuvre)
      const p = g.player;
      if (!g.onFoot && d < PIT_RANGE && p.speed > 150 && this.seen) {
        const ca = Math.cos(p.a), sa = Math.sin(p.a), side = c.siren % 2 < 1 ? 1 : -1;
        tx = p.x - ca * 16 - sa * 14 * side + p.vx * 0.12; ty = p.y - sa * 16 + ca * 14 * side + p.vy * 0.12;
      }
      c.hasWp = false;
    } else {
      if (!c.hasWp || Math.hypot(c.x - w.nodePos(c.wpI, c.wpJ).x, c.y - w.nodePos(c.wpI, c.wpJ).y) < 70) {
        const cur = c.hasWp ? { i: c.wpI, j: c.wpJ } : w.nearestNode(c.x, c.y);
        const pn = intercept ? w.nearestNode(fx + fvx * 1.4, fy + fvy * 1.4) : w.nearestNode(fx, fy);
        const di = pn.i - cur.i, dj = pn.j - cur.j;
        let ni = cur.i, nj = cur.j;
        if (di === 0 && dj === 0) { /* direct */ }
        else if (Math.abs(di) > Math.abs(dj) || (Math.abs(di) === Math.abs(dj) && Math.random() < 0.5)) ni += Math.sign(di);
        else nj += Math.sign(dj);
        if (!c.hasWp) {
          const a = w.nodePos(cur.i, cur.j), b = w.nodePos(ni, nj);
          const onSeg = ni !== cur.i ? Math.abs(c.y - a.y) < ROAD / 2 && (c.x - a.x) * (b.x - a.x) > 0 : Math.abs(c.x - a.x) < ROAD / 2 && (c.y - a.y) * (b.y - a.y) > 0;
          if (onSeg || (di === 0 && dj === 0)) { c.wpI = ni; c.wpJ = nj; } else { c.wpI = cur.i; c.wpJ = cur.j; }
        } else { c.wpI = ni; c.wpJ = nj; }
        c.hasWp = true;
      }
      const np = w.nodePos(c.wpI, c.wpJ);
      tx = np.x; ty = np.y;
    }
    const diff = steerTo(c, tx, ty);
    c.throttle = Math.abs(diff) > 1.4 ? 0.45 : 1;
    c.handbrake = Math.abs(diff) > 1.1 && Math.abs(c.vF) > 260;
    if (g.onFoot && d < 320 && c.vF > 240) c.throttle = -0.3;
    if (g.onFoot && this.seen && d < 160 && c.driver) { c.throttle = c.vF > 40 ? -1 : 0; c.handbrake = false; } // stop next to you, then get out
    if (!this.seen && g.rules.starsDecay) c.throttle *= 0.7; // searching: slower
    avoid(c, w);
    stuck(c, dt);
  }

  private pickSearch() {
    const r = this.searchRadius, a = Math.random() * TAU, d = Math.random() * r;
    this.searchX = this.lastX + Math.cos(a) * d; this.searchY = this.lastY + Math.sin(a) * d;
    this.searchT = rnd(4, 8);
  }

  // armoured car: fires a shell at you every few seconds when it can see you
  private turret(c: Car, d: number, dt: number) {
    const g = this.g;
    if (d > SHELL_RANGE || !this.seen || !g.world.lineClear(c.x, c.y, g.fx, g.fy, 40)) return;
    c.shootT -= dt;
    if (c.shootT > 0) return;
    c.shootT = rnd(SHELL_EVERY[0], SHELL_EVERY[1]);
    const lead = d / 700;
    const a = Math.atan2(g.fy + g.fvy * lead * 0.5 - c.y, g.fx + g.fvx * lead * 0.5 - c.x) + rnd(-0.05, 0.05);
    g.enemyShell(c.x + Math.cos(a) * 34, c.y + Math.sin(a) * 34, c.z + 26, a);
  }

  // the car stops and one or two officers get out
  private dismount(c: Car) {
    const g = this.g;
    c.driver = false; c.parked = true; c.handbrake = true;
    const role = c.model === "swat" ? "swat" : c.model === "armor" ? "army" : "cop";
    const n = c.model === "swat" || c.model === "armor" ? 3 : 1 + (g.wanted.stars >= 2 ? 1 : 0);
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      let x = c.x + sa * 24 * side + ca * (i - 1) * 10, y = c.y - ca * 24 * side + sa * (i - 1) * 10;
      if (g.world.isSolid(x, y, 6)) { x = c.x - sa * 24 * side; y = c.y + ca * 24 * side; }
      g.peds.spawnRole(role, x, y);
    }
    sfx.door();
  }

  update(dt: number) {
    const g = this.g, w = g.wanted;
    this.searchT -= dt;
    this.seen = w.stars > 0 && this.copSees(g.fx, g.fy);
    if (this.seen) { this.lastX = g.fx; this.lastY = g.fy; }
    if (!g.rules.city) return;
    if (w.stars < ARMY_STARS) this.armyCalled = false;
    this.updateHeli(dt);
    this.updateSpikes(dt);
    // roadblocks ahead of you while you drive fast
    if (w.stars >= ROADBLOCK_STARS && !g.onFoot && inCity(g.fx, g.fy)) {
      this.roadblockT -= dt;
      if (this.roadblockT <= 0 && g.player.speed > 150) { this.roadblockT = ROADBLOCK_EVERY; this.roadblock(); }
    }
  }

  // two cars across the road two crossings ahead, officers behind them
  roadblock() {
    const g = this.g, p = g.player, wd = g.world;
    const dirx = Math.abs(p.vx) > Math.abs(p.vy) ? Math.sign(p.vx) : 0, diry = dirx ? 0 : Math.sign(p.vy);
    const n = wd.nearestNode(p.x, p.y);
    const ni = n.i + dirx * 2, nj = n.j + diry * 2;
    if (ni < 0 || nj < 0 || ni > GRID || nj > GRID) return;
    const np = wd.nodePos(ni, nj);
    // block the segment just before that crossing, across the road
    const bx = np.x - dirx * (ROAD / 2 + 70), by = np.y - diry * (ROAD / 2 + 70);
    if (Math.hypot(bx - p.x, by - p.y) < 500) return;
    for (const off of [-34, 34]) {
      const c = new Car("cop", "police", "#f4f6fa");
      c.x = bx + (diry ? off : 0); c.y = by + (dirx ? off : 0); c.z = terrainH(c.x, c.y);
      c.a = dirx ? Math.PI / 2 : 0; // across the driving direction
      c.hp = c.maxHp = 100; c.mass = 1.6; c.parked = true; c.handbrake = true; c.roadblock = true;
      g.cars.push(c);
    }
    for (const off of [-20, 20]) g.peds.spawnRole("cop", bx - dirx * 40 + (diry ? off : 0), by - diry * 40 + (dirx ? off : 0));
    // from 4 stars: a spike strip across the whole road in front of the cars
    if (g.wanted.stars >= SPIKE_STARS) {
      this.spikes.push({ x: bx - dirx * 70, y: by - diry * 70, alongX: diry !== 0, t: 0 });
      if (this.spikes.length > 4) this.spikes.shift();
      g.hintMsg("Straßensperre mit Nagelband voraus!");
    } else g.hintMsg("Straßensperre voraus!");
  }

  // spike strips: the player's tyres burst when driving over one
  private updateSpikes(dt: number) {
    const g = this.g, p = g.player;
    for (let i = this.spikes.length - 1; i >= 0; i--) {
      const s = this.spikes[i];
      s.t += dt;
      if (s.t > SPIKE_LIFE) { this.spikes.splice(i, 1); continue; }
      if (g.onFoot || p.flat || p.air) continue;
      const hw = (s.alongX ? SPIKE_W : SPIKE_D) / 2 + 10, hh = (s.alongX ? SPIKE_D : SPIKE_W) / 2 + 10;
      if (Math.abs(p.x - s.x) < hw && Math.abs(p.y - s.y) < hh) g.burstTyres();
    }
  }

  private updateHeli(dt: number) {
    const g = this.g, w = g.wanted;
    const want = w.stars >= HELI_STARS;
    let h = this.heli;
    if (!h && want) {
      const a = Math.random() * TAU;
      h = this.heli = { x: g.fx + Math.cos(a) * 1200, y: g.fy + Math.sin(a) * 1200, z: HELI_ALT, a: 0, vx: 0, vy: 0, hp: HELI_HP, dead: false, vz: 0, shootT: 2, rotor: 0 };
      g.hintMsg("Polizeihubschrauber!");
    }
    if (!h) return;
    h.rotor += dt * 40;
    if (h.dead) {
      // falls down and explodes on the ground
      h.vz -= 400 * dt; h.z += h.vz * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.a += dt * 3;
      if (h.z <= terrainH(h.x, h.y) + 4) { g.explodeAt(h.x, h.y, 1.6); this.heli = null; }
      return;
    }
    // follow: hover over you (or the last known position), leave when the stars are gone
    const tx = !want ? h.x + Math.cos(h.a) * 2000 : this.seen ? g.fx : this.lastX, ty = !want ? h.y + Math.sin(h.a) * 2000 : this.seen ? g.fy : this.lastY;
    const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy);
    const sp = Math.min(HELI_SPEED, d * 1.2);
    const k = Math.min(1, dt * 1.5);
    h.vx += ((d > 1 ? (dx / d) * sp : 0) - h.vx) * k; h.vy += ((d > 1 ? (dy / d) * sp : 0) - h.vy) * k;
    h.x += h.vx * dt; h.y += h.vy * dt;
    if (Math.hypot(h.vx, h.vy) > 20) h.a = Math.atan2(h.vy, h.vx);
    const ground = Math.max(terrainH(h.x, h.y), g.world.roofAt(h.x, h.y));
    h.z += (Math.max(HELI_ALT, ground + 90) - h.z) * Math.min(1, dt);
    if (!want && Math.hypot(h.x - g.fx, h.y - g.fy) > 1800) { this.heli = null; return; }
    // rotor sound
    this.rotorT -= dt;
    const near = Math.hypot(h.x - g.fx, h.y - g.fy);
    if (this.rotorT <= 0) { this.rotorT = 0.11; sfx.rotor(Math.max(0, 1 - near / 1400)); }
    // the gunner shoots at the top wanted level
    if (w.stars >= SWAT_STARS && this.seen && near < 420) {
      h.shootT -= dt;
      if (h.shootT <= 0) {
        h.shootT = rnd(0.25, 0.5);
        const a = Math.atan2(g.fy - h.y, g.fx - h.x) + rnd(-0.08, 0.08);
        g.enemyShot(h.x + Math.cos(a) * 30, h.y + Math.sin(a) * 30, g.fz + 15, a, 6);
      }
    }
  }

  // projectile at (x, y) hits the helicopter? (it flies high, so only the ground position counts)
  hitHeli(x: number, y: number, dmg: number): boolean {
    const h = this.heli;
    if (!h || h.dead || Math.hypot(x - h.x, y - h.y) > 42) return false;
    h.hp -= dmg;
    if (h.hp <= 0) {
      h.dead = true; h.vz = 0;
      const g = this.g;
      g.banner("HUBSCHRAUBER ABGESCHOSSEN", "Die Polizei schickt Verstärkung", "#ff3cac", 2);
      g.crime("copTakedown", 2);
    }
    return true;
  }

  heliTarget(ox: number, oy: number, facing: number, cone: number): Heli | null {
    const h = this.heli;
    if (!h || h.dead) return null;
    const d = Math.hypot(h.x - ox, h.y - oy);
    if (d > 650) return null;
    const da = Math.abs(((Math.atan2(h.y - oy, h.x - ox) - facing + Math.PI * 3) % TAU) - Math.PI);
    return da < cone ? h : null;
  }
}
