import { Car, MODEL_STATS, isBoat, isHeli, type CarModel } from "./vehicles";
import { WATER_Y, isWater, terrainH } from "../world/world";
import { DOCK_SPOT, HELI_SPOT } from "../world/places";
import { steerTo } from "../ai/traffic";
import { sfx } from "../audio/audio";
import type { Game } from "../core/engine";

// boats and the helicopter: own physics, a vehicle waiting at the jetty / helipad, cars sinking in the bay
const SPAWN_NEAR = 1600, SPAWN_MIN = 260; // the vehicle (re)appears at its spot when you come this close (but not right under your nose)
const SPOT_FREE = 300;                    // ... and none of its kind is closer to the spot than this
export const HELI_CEIL = 900;             // highest flying altitude
const HELI_CLIMB = 230, HELI_TURN = 1.9, HELI_LAND_HIT = 260;
const SINK_TIME = 1.1;                    // seconds until a car in the water is lost
const FLEE_TRY = [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3, 3.1];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Craft {
  private checkT = 0;

  constructor(private g: Game) {}

  // every second: a speedboat at the jetty and a helicopter on the pad
  update(dt: number) {
    const g = this.g;
    if (!g.rules.city) return;
    this.checkT -= dt;
    if (this.checkT > 0) return;
    this.checkT = 1;
    this.keepAt("boat", DOCK_SPOT.x, DOCK_SPOT.y, DOCK_SPOT.a, "#f4f6fa");
    this.keepAt("heli", HELI_SPOT.x, HELI_SPOT.y, HELI_SPOT.a, "#ff3cac");
  }

  // a vehicle of this model waits at (x, y) when you come close (also used for the job start points)
  keepAt(model: CarModel, x: number, y: number, a: number, color: string) {
    const g = this.g;
    const d = Math.hypot(g.fx - x, g.fy - y);
    if (d > SPAWN_NEAR || d < SPAWN_MIN) return;
    for (const c of g.cars) if (c.model === model && !c.dead && Math.hypot(c.x - x, c.y - y) < SPOT_FREE) return;
    const c = new Car("civ", model, color);
    const st = MODEL_STATS[model];
    c.x = x; c.y = y; c.a = a; c.z = isBoat(model) ? WATER_Y : terrainH(x, y) + (isHeli(model) ? 3 : 0);
    c.hp = c.maxHp = st.hp; c.mass = st.mass;
    c.parked = true; c.handbrake = true; c.owned = true; // free to use: no crime
    g.cars.push(c);
  }

  // ---------- speedboat: only moves in the water, gets stuck on the shore ----------
  boat(c: Car, dt: number, acc: number, maxV: number) {
    const g = this.g;
    const wet = isWater(c.x, c.y);
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    let vF = c.vx * ca + c.vy * sa, vR = -c.vx * sa + c.vy * ca;
    // on land a boat has no drive: it runs aground and stops (push it back into the water on foot)
    const t = wet ? c.throttle : 0;
    if (t > 0 && vF < maxV) vF += acc * t * dt;
    else if (t < 0) vF += (vF > 0 ? -700 : -acc * 0.45) * -t * dt;
    vF -= vF * (wet ? 0.35 : 9) * dt;
    if (vF < -maxV * 0.35) vF = -maxV * 0.35;
    vR *= Math.exp(-(c.handbrake ? 0.7 : wet ? 2.4 : 12) * dt);
    const sp = Math.abs(vF), dir = vF >= -5 ? 1 : -1;
    c.av += ((wet ? c.steer : 0) * 2.1 * Math.max(0.35, Math.min(1, sp / 140)) * dir * (c.handbrake ? 1.4 : 1) - c.av) * Math.min(1, dt * 6); // turns slowly even when almost standing
    c.a += c.av * dt;
    c.vx = ca * vF - sa * vR; c.vy = sa * vF + ca * vR;
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.vF = vF; c.vR = vR;
    const z = wet ? WATER_Y + Math.sin(g.t * 2.3 + c.x * 0.013) * 0.8 : Math.max(WATER_Y, terrainH(c.x, c.y));
    c.z += (z - c.z) * Math.min(1, dt * 6);
    c.air = false; c.vz = 0;
    // wake behind the boat
    if (wet && sp > 90 && Math.random() < 42 * dt) g.spray(c.x - ca * 26, c.y - sa * 26, WATER_Y + 1, -ca * sp * 0.2, -sa * sp * 0.2);
  }

  // police boat: straight at you
  boatAI(c: Car) {
    const g = this.g;
    const lead = 0.3;
    steerTo(c, g.fx + g.fvx * lead, g.fy + g.fvy * lead);
    const d = Math.hypot(g.fx - c.x, g.fy - c.y);
    c.throttle = d > 90 ? 1 : 0.2;
    c.handbrake = false;
  }

  // mission boat on the run: away from you, but it keeps to the water
  fleeBoat(c: Car) {
    const g = this.g;
    const away = Math.atan2(c.y - g.fy, c.x - g.fx);
    let best = c.a;
    for (const off of FLEE_TRY) {
      const a = away + off;
      if (isWater(c.x + Math.cos(a) * 260, c.y + Math.sin(a) * 260) && isWater(c.x + Math.cos(a) * 130, c.y + Math.sin(a) * 130)) { best = a; break; }
    }
    if (!isWater(c.x, c.y)) {
      // ran aground: the crew pushes it back into the water
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        if (isWater(c.x + Math.cos(a) * 70, c.y + Math.sin(a) * 70)) { c.vx = Math.cos(a) * 90; c.vy = Math.sin(a) * 90; c.a = a; break; }
      }
      c.throttle = 0; return;
    }
    const diff = steerTo(c, c.x + Math.cos(best) * 100, c.y + Math.sin(best) * 100);
    c.throttle = Math.abs(diff) > 1.4 ? 0.3 : 1; // a sharp turn: slow down so it can come round
    c.handbrake = false;
  }

  // ---------- helicopter ----------
  // lift: +1 climb, -1 descend, 0 hold the altitude; the player's input or -1 (lands by itself when empty)
  // mul: vehicle multiplier from the settings (top speed and pull)
  fly(c: Car, dt: number, lift: number, engine: boolean, mul = 1) {
    const g = this.g, st = MODEL_STATS[c.model];
    const ground = g.groundAt(c.x, c.y);
    c.rotor += dt * (engine ? 42 : c.z > ground + 1 ? 30 : 6);
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    let vF = c.vx * ca + c.vy * sa, vR = -c.vx * sa + c.vy * ca;
    const landed = c.z <= ground + 0.5 && lift <= 0;
    if (landed) {
      vF *= Math.exp(-6 * dt); vR *= Math.exp(-6 * dt); c.vz = 0; c.z = ground;
      c.av += ((engine ? c.steer * 0.8 : 0) - c.av) * Math.min(1, dt * 5);
    } else {
      if (engine) vF += c.throttle * st.acc * mul * dt;
      vF -= vF * (engine && c.throttle !== 0 ? 0.25 : 0.9) * dt;
      vF = clamp(vF, -st.maxV * 0.4 * mul, st.maxV * mul);
      vR *= Math.exp(-2.2 * dt);
      c.av += ((engine ? c.steer * HELI_TURN : 0) - c.av) * Math.min(1, dt * 5);
      c.vz += (lift * HELI_CLIMB - c.vz) * Math.min(1, dt * 3);
    }
    c.a += c.av * dt;
    c.vx = ca * vF - sa * vR; c.vy = sa * vF + ca * vR;
    c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
    c.vF = vF; c.vR = vR;
    if (c.z > HELI_CEIL) { c.z = HELI_CEIL; c.vz = Math.min(0, c.vz); }
    const gh = g.groundAt(c.x, c.y);
    if (c.z < gh) {
      const hit = -c.vz;
      c.z = gh; c.vz = 0;
      if (hit > HELI_LAND_HIT && c.kind === "player") { g.heliCrash((hit - HELI_LAND_HIT) * 0.25); }
    }
    c.air = c.z > gh + 2;
    // rotor sound for the player's helicopter
    if (engine && Math.random() < dt * 9) sfx.rotor(0.8);
  }

  // a car that drove into the bay sinks (true when it is lost this frame)
  sink(c: Car, dt: number): boolean {
    if (c.air || c.dead || !isWater(c.x, c.y)) { c.wetT = 0; return false; }
    c.wetT += dt;
    c.vx *= Math.exp(-3 * dt); c.vy *= Math.exp(-3 * dt);
    if (Math.random() < 30 * dt) this.g.spray(c.x + rnd(-14, 14), c.y + rnd(-14, 14), WATER_Y + 1, rnd(-30, 30), rnd(-30, 30));
    if (c.wetT < SINK_TIME) return false;
    c.dead = true; c.wrecked = true; c.hp = 0; c.parked = true; c.driver = false;
    return true;
  }
}
