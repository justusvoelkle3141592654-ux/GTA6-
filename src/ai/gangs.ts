import type { Car, FactionId } from "../vehicles/vehicles";
import { steerTo, avoid, stuck } from "./traffic";
import type { Game } from "../core/engine";

// gang mood towards the player and gang cars that hunt you (drive-bys)
const ANGRY_TIME = 60;          // seconds a gang stays hostile after you hurt one of them
const HOSTILE_REP = -30;        // reputation at which a gang attacks on sight
const HUNT_RANGE = 700, SHOOT_RANGE = 300, SIDE_OFF = 70, DRIVEBY_DMG = 5;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Gangs {
  private aggro: Record<FactionId, number> = { halcones: 0, kings: 0 };

  constructor(private g: Game) {}

  reset() { this.aggro.halcones = 0; this.aggro.kings = 0; }

  hostile(f: FactionId) { return this.g.rules.city && (this.g.progress.rep[f] <= HOSTILE_REP || this.aggro[f] > 0); }

  // you knocked out one of them: worse reputation, the whole gang is angry for a while
  angered(f: FactionId) {
    const rep = this.g.progress.rep;
    rep[f] = Math.max(-100, rep[f] - 8);
    this.aggro[f] = ANGRY_TIME;
  }

  // you hurt one of them (not knocked out): the gang is angry, reputation stays
  provoked(f: FactionId) { this.aggro[f] = Math.max(this.aggro[f], ANGRY_TIME * 0.5); }

  update(dt: number) {
    this.aggro.halcones = Math.max(0, this.aggro.halcones - dt);
    this.aggro.kings = Math.max(0, this.aggro.kings - dt);
  }

  // gang car of a hostile gang near you: pulls up beside you and the passenger shoots; false = normal traffic
  carAI(c: Car, dt: number): boolean {
    const g = this.g;
    const f = c.faction;
    const hunting = !!f && c.driver && !c.tag && this.hostile(f) && Math.hypot(g.fx - c.x, g.fy - c.y) < HUNT_RANGE;
    if (!hunting) { if (c.hunt) { c.hunt = false; c.route = false; } return false; }
    c.hunt = true; c.route = false;
    const fx = g.fx, fy = g.fy, d = Math.hypot(fx - c.x, fy - c.y);
    // aim for a point beside you (each car keeps its side)
    const side = c.siren % 2 < 1 ? 1 : -1, fa = g.fa;
    const tx = fx - Math.sin(fa) * SIDE_OFF * side + g.fvx * 0.3, ty = fy + Math.cos(fa) * SIDE_OFF * side + g.fvy * 0.3;
    steerTo(c, tx, ty);
    const close = Math.hypot(tx - c.x, ty - c.y) < 90;
    c.throttle = !close ? 1 : c.vF > g.fspeed + 40 ? -0.3 : 0.6;
    c.handbrake = false;
    avoid(c, g.world);
    stuck(c, dt);
    c.shootT -= dt;
    if (d < SHOOT_RANGE && c.shootT <= 0) {
      c.shootT = rnd(0.5, 1);
      if (g.world.lineClear(c.x, c.y, fx, fy, 30)) {
        const a = Math.atan2(fy - c.y, fx - c.x) + rnd(-0.12, 0.12);
        g.enemyShot(c.x + Math.cos(a) * 16, c.y + Math.sin(a) * 16, c.z + 14, a, DRIVEBY_DMG, f!, -1);
      }
    }
    return true;
  }
}
