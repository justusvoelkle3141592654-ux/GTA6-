// vehicle data and the shared car entity

export type CarModel = "sport" | "super" | "muscle" | "suv" | "sedan" | "van" | "police" | "taxi";

export interface CarDef { id: string; name: string; model: CarModel; color: string; maxV: number; acc: number; grip: number; hp: number; mass: number; desc: string; }
export const CARS: CarDef[] = [
  { id: "corsaro", name: "Corsaro", model: "sport", color: "#ff2d95", maxV: 560, acc: 640, grip: 11, hp: 120, mass: 1.4, desc: "Ausgewogen" },
  { id: "zephyra", name: "Zephyra", model: "super", color: "#2bf0ff", maxV: 650, acc: 740, grip: 10, hp: 90, mass: 1.2, desc: "Rakete" },
  { id: "torvan", name: "Torvan", model: "muscle", color: "#ff8a1f", maxV: 540, acc: 700, grip: 7, hp: 130, mass: 1.5, desc: "Drift-König" },
  { id: "granit", name: "Granit", model: "suv", color: "#ffd23f", maxV: 480, acc: 560, grip: 12, hp: 220, mass: 2.2, desc: "Panzer" },
];
// car ids of older versions -> current ids
export const LEGACY_CAR_IDS: Record<string, string> = { infernus: "corsaro", banshee: "zephyra", sabre: "torvan", patriot: "granit" };
export const MODEL_STATS: Record<CarModel, { maxV: number; acc: number; grip: number }> = {
  sport: { maxV: 560, acc: 640, grip: 11 }, super: { maxV: 650, acc: 740, grip: 10 }, muscle: { maxV: 540, acc: 700, grip: 7 }, suv: { maxV: 480, acc: 560, grip: 12 },
  sedan: { maxV: 470, acc: 520, grip: 11 }, van: { maxV: 420, acc: 460, grip: 12 }, police: { maxV: 560, acc: 640, grip: 11 }, taxi: { maxV: 480, acc: 540, grip: 11 },
};

export type CarKind = "player" | "cop" | "civ";

export class Car {
  x = 0; y = 0; z = 0; vx = 0; vy = 0; vz = 0; a = 0; av = 0;
  air = false; airT = 0;
  vF = 0; vR = 0;
  hp = 100; maxHp = 100; mass = 1;
  calm = false; // cop without a wanted level: patrols like traffic, no siren
  route = false; // prevI/prevJ/wpI/wpJ hold a valid street route (traffic AI)
  driver = false; // somebody sits inside (gets pulled out when the car is stolen)
  spotId = -1;    // parking spot this car belongs to (-1: none)
  owned = false;  // left behind by the player
  dead = false; deadT = 0; wrecked = false; wreckT = 0; parked = false;
  throttle = 0; steer = 0; handbrake = false; nitro = false;
  wpI = 0; wpJ = 0; prevI = -1; prevJ = -1; hasWp = false;
  stuckT = 0; reverseT = 0; nearCd = 0; hitFlash = 0;
  rlx = NaN; rly = NaN; rrx = NaN; rry = NaN;
  siren = Math.random() * 10; cruise = 170; smokeT = 0;
  constructor(public kind: CarKind, public model: CarModel, public color: string) {}
  get speed() { return Math.hypot(this.vx, this.vy); }
}
