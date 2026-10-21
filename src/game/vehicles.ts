// vehicle data and the shared car entity
import { noTune, type Tune } from "./garage";

export type CarModel = "sport" | "super" | "muscle" | "suv" | "sedan" | "van" | "police" | "taxi" | "bike" | "truck" | "bus" | "swat" | "armor" | "boat" | "heli"
  | "roadster" | "pickup" | "compact" | "wagon" | "offroad" | "tow" | "garbage" | "ambulance" | "fire" | "icecream" | "policebike" | "unmarked"
  | "scooter" | "bicycle" | "jetski" | "fishboat" | "policeboat" | "policeheli";
export const CAR_MODELS: CarModel[] = ["sport", "super", "muscle", "suv", "sedan", "van", "police", "taxi", "bike", "truck", "bus", "swat", "armor", "boat", "heli",
  "roadster", "pickup", "compact", "wagon", "offroad", "tow", "garbage", "ambulance", "fire", "icecream", "policebike", "unmarked", "scooter", "bicycle", "jetski", "fishboat", "policeboat", "policeheli"];
export const isBoat = (m: CarModel) => m === "boat" || m === "jetski" || m === "fishboat" || m === "policeboat";
export const isHeli = (m: CarModel) => m === "heli" || m === "policeheli";
export const isTwoWheel = (m: CarModel) => m === "bike" || m === "policebike" || m === "scooter" || m === "bicycle";
export const isPoliceModel = (m: CarModel) => m === "police" || m === "swat" || m === "policebike" || m === "unmarked" || m === "policeboat" || m === "policeheli";
// not a car: drives on water / flies (own physics, no garage, no traffic)
export const isCraft = (m: CarModel) => isBoat(m) || isHeli(m);
export const MODEL_NAME: Record<CarModel, string> = {
  sport: "Corsaro", super: "Zephyra", muscle: "Torvan", suv: "Granit", sedan: "Limousine", van: "Lieferwagen", police: "Streifenwagen",
  taxi: "Taxi", bike: "Motorrad", truck: "Lastwagen", bus: "Stadtbus", swat: "SEK-Transporter", armor: "Radpanzer", boat: "Speedboot", heli: "Hubschrauber",
  roadster: "Velocia", pickup: "Bravado-Pickup", compact: "Kompaktwagen", wagon: "Kombi", offroad: "Geländewagen", tow: "Abschleppwagen",
  garbage: "Müllwagen", ambulance: "Krankenwagen", fire: "Löschfahrzeug", icecream: "Eiswagen", policebike: "Polizeimotorrad", unmarked: "Zivilstreife",
  scooter: "Roller", bicycle: "Fahrrad", jetski: "Jetski", fishboat: "Fischerboot", policeboat: "Polizeiboot", policeheli: "Polizeihubschrauber",
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
  roadster: { maxV: 600, acc: 700, grip: 11, hp: 90, mass: 1.1, price: 6000 },
  pickup: { maxV: 500, acc: 560, grip: 10, hp: 170, mass: 1.7, price: 2600 },
  compact: { maxV: 450, acc: 520, grip: 11, hp: 80, mass: 0.75, price: 900 },
  wagon: { maxV: 470, acc: 520, grip: 11, hp: 100, mass: 0.95, price: 1300 },
  offroad: { maxV: 470, acc: 540, grip: 12, hp: 190, mass: 1.9, price: 3200 },
  tow: { maxV: 380, acc: 380, grip: 12, hp: 220, mass: 2.6, price: 1800 },
  garbage: { maxV: 320, acc: 280, grip: 13, hp: 280, mass: 3.4, price: 1600 },
  ambulance: { maxV: 480, acc: 520, grip: 12, hp: 180, mass: 2, price: 2400 },
  fire: { maxV: 400, acc: 380, grip: 12, hp: 300, mass: 3.4, price: 3000 },
  icecream: { maxV: 360, acc: 380, grip: 12, hp: 140, mass: 1.8, price: 1200 },
  policebike: { maxV: 600, acc: 780, grip: 13, hp: 70, mass: 0.6, price: 2200 },
  unmarked: { maxV: 580, acc: 660, grip: 11, hp: 120, mass: 1.3, price: 2600 },
  scooter: { maxV: 340, acc: 500, grip: 12, hp: 40, mass: 0.4, price: 600 },
  bicycle: { maxV: 230, acc: 320, grip: 12, hp: 30, mass: 0.25, price: 200 },
  jetski: { maxV: 560, acc: 640, grip: 2.8, hp: 60, mass: 0.5, price: 3000 },
  fishboat: { maxV: 330, acc: 300, grip: 2, hp: 200, mass: 2, price: 4000 },
  policeboat: { maxV: 540, acc: 540, grip: 2.6, hp: 180, mass: 1.4, price: 6000 },
  policeheli: { maxV: 500, acc: 400, grip: 2, hp: 260, mass: 1.6, price: 14000 },
};

// half length / half width of each model (collision boxes match the drawn models)
export const MODEL_DIM: Record<CarModel, { hl: number; hw: number }> = {
  // real sizes of the car bodies (10 units = 1 m), see SHAPES in carmodel.ts
  sport: { hl: 22.5, hw: 9.5 }, super: { hl: 23, hw: 10 }, muscle: { hl: 24.5, hw: 9.8 }, suv: { hl: 24, hw: 10 }, sedan: { hl: 24, hw: 9.3 },
  van: { hl: 26, hw: 10 }, police: { hl: 25, hw: 9.5 }, taxi: { hl: 24, hw: 9.3 }, bike: { hl: 17, hw: 4.5 }, truck: { hl: 34, hw: 12 },
  bus: { hl: 50, hw: 12.5 }, swat: { hl: 27, hw: 10.5 }, armor: { hl: 31, hw: 14.5 }, boat: { hl: 28, hw: 11 }, heli: { hl: 30, hw: 12 },
  roadster: { hl: 21, hw: 9.1 }, pickup: { hl: 27, hw: 10 }, compact: { hl: 20, hw: 8.8 }, wagon: { hl: 24.3, hw: 9.3 }, offroad: { hl: 25, hw: 9.8 },
  tow: { hl: 33, hw: 12 }, garbage: { hl: 37, hw: 12.3 }, ambulance: { hl: 28, hw: 10.3 }, fire: { hl: 41, hw: 12.5 }, icecream: { hl: 27, hw: 10.3 },
  policebike: { hl: 17, hw: 4.5 }, unmarked: { hl: 24, hw: 9.4 }, scooter: { hl: 12, hw: 4 }, bicycle: { hl: 11, hw: 3 },
  jetski: { hl: 14, hw: 6 }, fishboat: { hl: 34, hw: 13 }, policeboat: { hl: 30, hw: 12 }, policeheli: { hl: 30, hw: 12 },
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
  blink = 0;               // indicator: -1 left, 1 right, 2 hazard lights
  dents: number[] = [];    // where the body was hit: local x, local z (right side +), depth
  glass: Record<string, number> = {}; glassV = 0; // window panes: 1 cracked, 2 broken (glassV counts changes)
  bumpers = 0;             // torn off: bit 1 front, bit 2 rear
  doors = [0, 0, 0, 0];    // how far each door is open (0..1): 0 right front, 1 left front, 2 right rear, 3 left rear
  constructor(public kind: CarKind, public model: CarModel, public color: string) {}
  get speed() { return Math.hypot(this.vx, this.vy); }
  get hl() { return MODEL_DIM[this.model].hl; }
  get hw() { return MODEL_DIM[this.model].hw; }
}

// a hit at the world point (wx, wy): dents in the body, cracked or broken windows, a bumper that falls off
export function hitCar(c: Car, wx: number, wy: number, impact: number) {
  if (impact < 90 || isCraft(c.model) || isTwoWheel(c.model)) return;
  const ca = Math.cos(c.a), sa = Math.sin(c.a), dx = wx - c.x, dy = wy - c.y;
  const hl = c.hl, hw = c.hw;
  const lx = Math.max(-hl, Math.min(hl, dx * ca + dy * sa)), lz = Math.max(-hw, Math.min(hw, -dx * sa + dy * ca));
  if (c.dents.length < 14 * 3) c.dents.push(lx, lz, Math.min(2.6, impact / 260));
  if (impact > 260) {
    const id = lx > hl * 0.45 ? "front" : lx < -hl * 0.55 ? "rear" : "door" + ((lx > -hl * 0.05 ? 0 : 2) + (lz > 0 ? 0 : 1));
    const was = c.glass[id] ?? 0, now = Math.min(2, was + (impact > 460 ? 2 : 1));
    if (now !== was) { c.glass[id] = now; c.glassV++; }
  }
  if (impact > 380 && Math.abs(lx) > hl * 0.75) c.bumpers |= lx > 0 ? 1 : 2;
}
export function repairBody(c: Car) { c.dents = []; c.glass = {}; c.glassV++; c.bumpers = 0; }
export function copyBody(to: Car, from: Car) { to.dents = [...from.dents]; to.glass = { ...from.glass }; to.glassV++; to.bumpers = from.bumpers; to.doors = [0, 0, 0, 0]; to.blink = 0; }
