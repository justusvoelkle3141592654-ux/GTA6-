import type { ModeRules } from "../core/modes";

export type Crime =
  | "shot" | "rocket" | "explosion" | "carjack" | "copCarjack" | "parkedTheft"
  | "copTakedown" | "copRam" | "civCrash" | "pedHit" | "pedShot";

// heat per crime (explosion is multiplied by its power)
export const CRIMES: Record<Crime, number> = {
  shot: 0.4, rocket: 4, explosion: 2, carjack: 8, copCarjack: 25, parkedTheft: 3,
  copTakedown: 20, copRam: 2, civCrash: 5, pedHit: 15, pedShot: 20,
};

const CHASE_STAR_HEAT = 90;                     // chase: one more star per 90 heat
export const STAR_HEAT = [0, 5, 60, 140, 240, 380, 600]; // decaying modes: heat needed for 0..6 stars (6: military)
export const LOSE_TIME = [0, 7, 10, 13, 16, 20, 26];     // seconds out of sight to escape, per star level
export const SEARCH_AFTER = 1.5;                    // stars start blinking after this long out of sight
export const SEEN_DIST = 650, SEEN_CLOSE = 220;     // a cop sees you within SEEN_DIST with line of sight, always within SEEN_CLOSE

export type WantedEvent = "up" | "lost" | null;

export class Wanted {
  heat = 0; stars = 0; maxStars = 0;
  lostT = 0; // time since a cop last saw the player

  constructor(public rules: ModeRules) { this.reset(rules); }

  reset(rules: ModeRules) {
    this.rules = rules;
    this.heat = 0; this.stars = rules.minStars; this.maxStars = this.stars; this.lostT = 0;
  }

  get searching() { return this.rules.starsDecay && this.stars > 0 && this.lostT > SEARCH_AFTER; }

  crime(c: Crime, mul = 1) {
    if (!this.rules.cops) return;
    this.heat += CRIMES[c] * mul;
    this.lostT = 0;
  }

  clear() { this.heat = 0; this.stars = this.rules.minStars; this.lostT = 0; }

  // raise the stars to what the heat says right away (missions that start a chase)
  syncStars() {
    if (!this.rules.cops || !this.rules.starsDecay) return;
    for (let i = 1; i < STAR_HEAT.length && i <= this.rules.maxStars; i++) if (this.heat >= STAR_HEAT[i] && i > this.stars) this.stars = i;
    this.maxStars = Math.max(this.maxStars, this.stars);
  }

  // heatRate: heat per second (only used when the mode has timeHeat), seen: a cop currently sees the player,
  // far: the player is outside the search area (escape goes twice as fast)
  update(dt: number, heatRate: number, seen: boolean, far = false): WantedEvent {
    if (!this.rules.cops) return null;
    if (this.rules.timeHeat) this.heat += dt * heatRate;
    let target: number;
    if (this.rules.starsDecay) {
      target = 0;
      for (let i = 1; i < STAR_HEAT.length && i <= this.rules.maxStars; i++) if (this.heat >= STAR_HEAT[i]) target = i;
    } else target = Math.min(this.rules.maxStars, this.rules.minStars + Math.floor(this.heat / CHASE_STAR_HEAT));
    if (target > this.stars) {
      this.stars = target; this.maxStars = Math.max(this.maxStars, target); this.lostT = 0;
      return "up";
    }
    if (this.rules.starsDecay && this.stars > 0) {
      if (seen) this.lostT = 0;
      else {
        this.lostT += far ? dt * 2 : dt;
        if (this.lostT > LOSE_TIME[this.stars]) { this.clear(); return "lost"; }
      }
    }
    return null;
  }
}
