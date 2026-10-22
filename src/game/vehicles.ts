// vehicle data and the shared car entity
import { noTune, type Tune } from "./garage";

export type CarModel = "sport" | "super" | "muscle" | "suv" | "sedan" | "van" | "police" | "taxi" | "bike" | "truck" | "bus" | "swat" | "armor" | "boat" | "heli" | "interceptor" | "polsuv" | "jet";
export const CAR_MODELS: CarModel[] = ["sport", "super", "muscle", "suv", "sedan", "van", "police", "taxi", "bike", "truck", "bus", "swat", "armor", "boat", "heli", "interceptor", "polsuv", "jet"];
// not a car: drives on water / flies (own physics, no garage, no traffic)
export const isCraft = (m: CarModel) => m === "boat" || m === "heli" || m === "jet";
export const isAircraft = (m: CarModel) => m === "heli" || m === "jet";
// police cars with a light bar (the player may drive them too)
export const isCopModel = (m: CarModel) => m === "police" || m === "interceptor" || m === "polsuv" || m === "swat";
export const MODEL_NAME: Record<CarModel, string> = {
  sport: "Corsaro", super: "Zephyra", muscle: "Torvan", suv: "Granit", sedan: "Limousine", van: "Lieferwagen", police: "Streifenwagen",
  taxi: "Taxi", bike: "Motorrad", truck: "Lastwagen", bus: "Stadtbus", swat: "SEK-Transporter", armor: "Radpanzer", boat: "Speedboot", heli: "Hubschrauber",
  interceptor: "Polizei-Interceptor", polsuv: "Polizei-Geländewagen", jet: "Kampfjet",
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
  interceptor: { maxV: 660, acc: 760, grip: 12, hp: 140, mass: 1.35, price: 6000 },
  polsuv: { maxV: 520, acc: 600, grip: 13, hp: 230, mass: 2.1, price: 4500 },
  jet: { maxV: 1150, acc: 430, grip: 2, hp: 280, mass: 2, price: 40000 },
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
  rotor = 0;      // helicopter rotor angle; jet: afterburner glow 0..1
  px = 0; py = 0; // position before this physics step (walls push back to the side it came from)
  dead = false; deadT = 0; wrecked = false; wreckT = 0; parked = false;
  throttle = 0; steer = 0; handbrake = false; nitro = false;
  wpI = 0; wpJ = 0; prevI = -1; prevJ = -1; hasWp = false;
  stuckT = 0; reverseT = 0; nearCd = 0; hitFlash = 0;
  rlx = NaN; rly = NaN; rrx = NaN; rry = NaN;
  siren = Math.random() * 10; cruise = 170; smokeT = 0; shootT = 0;
  constructor(public kind: CarKind, public model: CarModel, public color: string) {}
  get speed() { return Math.hypot(this.vx, this.vy); }
}
