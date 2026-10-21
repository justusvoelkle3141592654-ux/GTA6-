// vehicle data and the shared car entity
import { noTune, type Tune } from "./garage";

export type CarModel = "sport" | "super" | "muscle" | "suv" | "sedan" | "van" | "police" | "taxi" | "bike" | "truck" | "bus" | "swat" | "armor" | "boat" | "heli";
export const CAR_MODELS: CarModel[] = ["sport", "super", "muscle", "suv", "sedan", "van", "police", "taxi", "bike", "truck", "bus", "swat", "armor", "boat", "heli"];
// not a car: drives on water / flies (own physics, no garage, no traffic)
export const isCraft = (m: CarModel) => m === "boat" || m === "heli";
export const MODEL_NAME: Record<CarModel, string> = {
  sport: "Corsaro", super: "Zephyra", muscle: "Torvan", suv: "Granit", sedan: "Limousine", van: "Lieferwagen", police: "Streifenwagen",
  taxi: "Taxi", bike: "Motorrad", truck: "Lastwagen", bus: "Stadtbus", swat: "SEK-Transporter", armor: "Radpanzer", boat: "Speedboot", heli: "Hubschrauber",
};

export interface CarDef { id: string; name: string; model: CarModel; color: string; maxV: number; acc: number; grip: number; hp: number; mass: number; desc: string; }
export const CARS: CarDef[] = [
  { id: "corsaro", name: "Corsaro", model: "sport", color: "#ff2d95", maxV: 560, acc: 640, grip: 11, hp: 120, mass: 1.4, desc: "Ausgewogen" },
  { id: "zephyra", name: "Zephyra", model: "super", color: "#2bf0ff", maxV: 650, acc: 740, grip: 10, hp: 90, mass: 1.2, desc: "Rakete" },
  { id: "torvan", name: "Torvan", model: "muscle", color: "#ff8a1f", maxV: 540, acc: 700, grip: 7, hp: 130, mass: 1.5, desc: "Drift-König" },
  { id: "granit", name: "Granit", model: "suv", color: "#ffd23f", maxV: 480, acc: 560, grip: 12, hp: 220, mass: 2.2, desc: "Panzer" },
];
// car ids of older versions -> current ids
export const LEGACY_CAR_IDS: Record<string, string> = { infernus: "corsaro", banshee: "zephyra", sabre: "torvan", patriot: "granit" };

export interface ModelStats { maxV: number; acc: number; grip: number; hp: number; mass: number; price: number; }
// hp/mass: for traffic and parked cars; price: what the garage pays when you sell one
export const MODEL_STATS: Record<CarModel, ModelStats> = {
  sport: { maxV: 560, acc: 640, grip: 11, hp: 110, mass: 1.3, price: 4000 },
  super: { maxV: 650, acc: 740, grip: 10, hp: 90, mass: 1.2, price: 7000 },
  muscle: { maxV: 540, acc: 700, grip: 7, hp: 120, mass: 1.4, price: 3000 },
  suv: { maxV: 480, acc: 560, grip: 12, hp: 160, mass: 1.6, price: 2500 },
  sedan: { maxV: 470, acc: 520, grip: 11, hp: 90, mass: 0.8, price: 1200 },
  van: { maxV: 420, acc: 460, grip: 12, hp: 120, mass: 1.2, price: 1000 },
  police: { maxV: 560, acc: 640, grip: 11, hp: 100, mass: 1.25, price: 2000 },
  taxi: { maxV: 480, acc: 540, grip: 11, hp: 90, mass: 0.8, price: 1100 },
  bike: { maxV: 600, acc: 780, grip: 13, hp: 60, mass: 0.6, price: 2200 },
  truck: { maxV: 360, acc: 320, grip: 13, hp: 240, mass: 3, price: 1800 },
  bus: { maxV: 340, acc: 290, grip: 13, hp: 260, mass: 3.2, price: 1500 },
  swat: { maxV: 520, acc: 600, grip: 12, hp: 220, mass: 2.2, price: 3500 },
  armor: { maxV: 440, acc: 430, grip: 13, hp: 600, mass: 4, price: 9000 },
  boat: { maxV: 520, acc: 520, grip: 2.6, hp: 140, mass: 1.2, price: 6000 },
  heli: { maxV: 480, acc: 380, grip: 2, hp: 200, mass: 1.5, price: 12000 },
};

// half length / half width of each model (collision boxes match the drawn models)
export const MODEL_DIM: Record<CarModel, { hl: number; hw: number }> = {
  sport: { hl: 24, hw: 12 }, super: { hl: 25, hw: 12.5 }, muscle: { hl: 25, hw: 12.5 }, suv: { hl: 25, hw: 13 }, sedan: { hl: 24, hw: 12 },
  van: { hl: 26, hw: 12.5 }, police: { hl: 25, hw: 12.5 }, taxi: { hl: 24, hw: 12 }, bike: { hl: 17, hw: 4.5 }, truck: { hl: 33, hw: 13.5 },
  bus: { hl: 41, hw: 14 }, swat: { hl: 27, hw: 13 }, armor: { hl: 31, hw: 14.5 }, boat: { hl: 28, hw: 11 }, heli: { hl: 30, hw: 12 },
};

export type CarKind = "player" | "cop" | "civ";
export type FactionId = "halcones" | "kings";

export class Car {
  x = 0; y = 0; z = 0; vx = 0; vy = 0; vz = 0; a = 0; av = 0;
  air = false; airT = 0;
  vF = 0; vR = 0;
  hp = 100; maxHp = 100; mass = 1;
  tune: Tune = noTune();
  calm = false; // cop without a wanted level: patrols like traffic, no siren
  route = false; // prevI/prevJ/wpI/wpJ hold a valid street route (traffic AI)
  driver = false; // somebody sits inside (gets pulled out when the car is stolen)
  spotId = -1;    // parking spot this car belongs to (-1: none)
  owned = false;  // left behind by the player
  keep = false;   // taken out of the garage: never despawns
  roadblock = false; // police car standing across the road
  faction: FactionId | null = null; // gang car
  tag = "";       // mission marker ("target", "deliver", ...)
  flee = false;   // drives away from the player (mission targets)
  hunt = false;   // gang car chasing the player (drives faster)
  flat = false;   // tyres burst by a spike strip (slow and slippery until repaired)
  wetT = 0;       // seconds a car has been in the water (it sinks)
  rotor = 0;      // helicopter rotor angle
  onRamp = -1;    // ramp the car drives on (entered over its low edge), -1: none
  croad = -1; cp = 0; cdir = 1; // highway traffic: road id, point index, direction (1 away from the city)
  route2: Float32Array | null = null; routeN = 0; routeT = 0; // police: street route to the target
  dead = false; deadT = 0; wrecked = false; wreckT = 0; parked = false;
  throttle = 0; steer = 0; handbrake = false; nitro = false;
  wpI = 0; wpJ = 0; prevI = -1; prevJ = -1; hasWp = false;
  stuckT = 0; reverseT = 0; nearCd = 0; hitFlash = 0;
  rlx = NaN; rly = NaN; rrx = NaN; rry = NaN;
  siren = Math.random() * 10; cruise = 170; smokeT = 0; shootT = 0;
  constructor(public kind: CarKind, public model: CarModel, public color: string) {}
  get speed() { return Math.hypot(this.vx, this.vy); }
  get hl() { return MODEL_DIM[this.model].hl; }
  get hw() { return MODEL_DIM[this.model].hw; }
}
