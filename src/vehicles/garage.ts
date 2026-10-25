import type { CarModel } from "./vehicles";

export type TunePart = "engine" | "tires" | "armor";
export type Tune = Record<TunePart, number>; // level 0..3

export interface TuneDef { name: string; desc: string; prices: [number, number, number]; }
export const TUNE_DEFS: Record<TunePart, TuneDef> = {
  engine: { name: "Motor", desc: "Mehr Spitze und Beschleunigung", prices: [1000, 2500, 5000] },
  tires: { name: "Reifen", desc: "Mehr Grip in Kurven", prices: [800, 2000, 4000] },
  armor: { name: "Panzerung", desc: "Mehr Lebenspunkte, weniger Schaden", prices: [1200, 3000, 6000] },
};
export const TUNE_PARTS: TunePart[] = ["engine", "tires", "armor"];
export const MAX_TUNE = 3;
export const noTune = (): Tune => ({ engine: 0, tires: 0, armor: 0 });

// effect of a tuning level on the driving stats
export const tuneSpeed = (t: Tune) => 1 + t.engine * 0.06;
export const tuneAcc = (t: Tune) => 1 + t.engine * 0.12;
export const tuneGrip = (t: Tune) => 1 + t.tires * 0.12;
export const tuneHp = (t: Tune) => 1 + t.armor * 0.25;
export const tuneDamage = (t: Tune) => 1 - t.armor * 0.12;

// paint colours offered in the paint shop (a fixed list keeps the car mesh cache small)
export const PAINTS = ["#ff2d95", "#2bf0ff", "#ff8a1f", "#ffd23f", "#3dff8b", "#9d4dff", "#f4f4f6", "#15161b", "#c0392b", "#1d4e89", "#3c6e47", "#9aa3ad"];

export interface OwnedCar { model: CarModel; color: string; hp: number; maxHp: number; mass: number; tune: Tune; neon?: string; }
export const GARAGE_SLOTS = 4;
