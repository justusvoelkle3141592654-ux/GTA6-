import type { Weapon } from "./weapons";
import type { TunePart } from "./garage";

// everything that can be bought, eaten or robbed (data only)
export interface FoodItem { name: string; price: number; heal: number; }
export const FOOD: FoodItem[] = [
  { name: "Fischtaco", price: 12, heal: 25 },
  { name: "Doppelburger", price: 25, heal: 55 },
  { name: "Mango-Smoothie", price: 8, heal: 15 },
  { name: "Familienplatte", price: 45, heal: 100 },
];

export interface Outfit { name: string; shirt: string; pants: string; price: number; }
export const OUTFITS: Outfit[] = [
  { name: "Standard", shirt: "#2b3242", pants: "#36485f", price: 0 },
  { name: "Hawaii-Hemd", shirt: "#ff8a3d", pants: "#e6e1d6", price: 120 },
  { name: "Weißer Anzug", shirt: "#f2f0ea", pants: "#e8e5dc", price: 450 },
  { name: "Trainingsanzug", shirt: "#2bb3ff", pants: "#1f2a44", price: 150 },
  { name: "Lederjacke", shirt: "#1b1a1f", pants: "#2c2c35", price: 300 },
  { name: "Pink Flamingo", shirt: "#ff3cac", pants: "#f5f0e1", price: 200 },
];

export const ARMOR_PRICE = 500;       // full vest
export const REPAIR_PER_HP = 4;       // workshop: price per missing car hit point
export const PAINT_PRICE = 200;
export const TYRE_PRICE = 150;       // new tyres after a spike strip
export const ROB_REWARD: [number, number] = [250, 700];
export const ROB_COOLDOWN = 180;      // seconds until a shop can be robbed again
export const ROB_HEAT = 60;           // heat added by a robbery (2 stars)

export const AMMO_FOR_SALE: Weapon[] = ["pistol", "smg", "shotgun", "grenade", "rocket", "bomb"];
export const GUNS_FOR_SALE: Weapon[] = ["bat", "pistol", "smg", "shotgun", "grenade", "rocket", "bomb"];

export type ShopAction =
  | { t: "weapon"; w: Weapon } | { t: "ammo"; w: Weapon } | { t: "armor" }
  | { t: "food"; i: number } | { t: "outfit"; i: number }
  | { t: "repair" } | { t: "paint"; color: string } | { t: "tune"; part: TunePart }
  | { t: "save" } | { t: "store" } | { t: "takeCar"; i: number } | { t: "sellCar"; i: number }
  | { t: "rob" }
  | { t: "deposit"; amount: number } | { t: "withdraw"; amount: number }; // amount -1: everything
