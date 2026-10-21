import type { Weapon } from "./weapons";
import type { TunePart } from "./garage";
import type { Top, Bottom, Shoes, Hair } from "./human";

// everything that can be bought, eaten or robbed (data only)
export interface FoodItem { name: string; price: number; heal: number; }
export const FOOD: FoodItem[] = [
  { name: "Fischtaco", price: 12, heal: 25 },
  { name: "Doppelburger", price: 25, heal: 55 },
  { name: "Mango-Smoothie", price: 8, heal: 15 },
  { name: "Familienplatte", price: 45, heal: 100 },
];

// clothes of Kai Romero: shirt / pants are the swatch colours in the shop; the rest describes the cut (see human.ts)
export interface Outfit {
  name: string; shirt: string; pants: string; price: number;
  top: Top; top2: string; bottom: Bottom; shoes: Shoes; shoeCol: string; accent?: string; hair?: Hair; hatCol?: string;
}
export const OUTFITS: Outfit[] = [
  { name: "Standard", shirt: "#4a3326", pants: "#2c3a52", price: 0, top: "leather", top2: "#b9b4ab", bottom: "jeans", shoes: "boot", shoeCol: "#3a2a1e" },
  { name: "Hawaii-Hemd", shirt: "#ff8a3d", pants: "#e6e1d6", price: 120, top: "hawaii", top2: "#ff8a3d", bottom: "shorts", shoes: "sandal", shoeCol: "#5a3a22" },
  { name: "Weißer Anzug", shirt: "#f2f0ea", pants: "#e8e5dc", price: 450, top: "suit", top2: "#7fb6d9", bottom: "pants", shoes: "leather", shoeCol: "#e8e5dc", accent: "#f2f0ea" },
  { name: "Trainingsanzug", shirt: "#2bb3ff", pants: "#1f2a44", price: 150, top: "track", top2: "#2bb3ff", bottom: "track", shoes: "sneaker", shoeCol: "#f2f2f2", accent: "#f2f2f2" },
  { name: "Lederjacke", shirt: "#1b1a1f", pants: "#2c2c35", price: 300, top: "leather", top2: "#e8e8ee", bottom: "jeans", shoes: "boot", shoeCol: "#141414" },
  { name: "Pink Flamingo", shirt: "#ff3cac", pants: "#f5f0e1", price: 200, top: "shirt", top2: "#ff3cac", bottom: "pants", shoes: "leather", shoeCol: "#f5f0e1" },
  { name: "Kapuzenpulli", shirt: "#55606e", pants: "#1d1d22", price: 90, top: "hoodie", top2: "#55606e", bottom: "jeans", shoes: "sneaker", shoeCol: "#e8e8ec" },
  { name: "Polo & Shorts", shirt: "#1d4e89", pants: "#c9b48c", price: 110, top: "polo", top2: "#f2f0ea", bottom: "shorts", shoes: "sneaker", shoeCol: "#f2f2f2" },
  { name: "Bomberjacke", shirt: "#3f4a2e", pants: "#1c1c22", price: 260, top: "bomber", top2: "#d9622b", bottom: "pants", shoes: "boot", shoeCol: "#1b1b1f", hair: "buzz" },
  { name: "Business-Hemd", shirt: "#dfe7f2", pants: "#2b3242", price: 180, top: "shirt", top2: "#dfe7f2", bottom: "pants", shoes: "leather", shoeCol: "#1b1410" },
  { name: "Tarnlook", shirt: "#56603e", pants: "#56603e", price: 220, top: "army", top2: "#3f4630", bottom: "camo", shoes: "boot", shoeCol: "#2a2418", hair: "cap", hatCol: "#3f4630" },
  { name: "Tanktop & Shorts", shirt: "#f2f2f2", pants: "#2c3e57", price: 60, top: "tank", top2: "#f2f2f2", bottom: "shorts", shoes: "sandal", shoeCol: "#1b1b1f", hair: "cap", hatCol: "#c0392b" },
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
