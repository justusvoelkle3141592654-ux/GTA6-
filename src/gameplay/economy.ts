import type { Weapon } from "./weapons";
import type { TunePart } from "../vehicles/garage";
import type { Top, Bottom, Shoes, Hair } from "../characters/human";
import type { CarModel } from "../vehicles/vehicles";

// everything that can be bought, eaten or robbed (data only)
export interface FoodItem { name: string; price: number; heal: number; at: string[]; } // at: which places sell it
export const FOOD: FoodItem[] = [
  { name: "Fischtaco", price: 12, heal: 25, at: ["food"] },
  { name: "Doppelburger", price: 25, heal: 55, at: ["food2"] },
  { name: "Mango-Smoothie", price: 8, heal: 15, at: ["food", "mall"] },
  { name: "Familienplatte", price: 45, heal: 100, at: ["food", "food2"] },
  { name: "Burrito Grande", price: 16, heal: 40, at: ["food"] },
  { name: "Nachos mit Käse", price: 9, heal: 18, at: ["food"] },
  { name: "Quesadilla", price: 11, heal: 24, at: ["food"] },
  { name: "Horchata", price: 5, heal: 8, at: ["food"] },
  { name: "Cheeseburger", price: 14, heal: 32, at: ["food2"] },
  { name: "Pommes groß", price: 6, heal: 14, at: ["food2"] },
  { name: "Chicken Wings (8)", price: 18, heal: 38, at: ["food2"] },
  { name: "Milchshake", price: 7, heal: 12, at: ["food2"] },
  { name: "Pizza Margherita", price: 15, heal: 35, at: ["mall"] },
  { name: "Sushi-Box", price: 22, heal: 45, at: ["mall"] },
  { name: "Nudeln aus dem Wok", price: 13, heal: 30, at: ["mall"] },
  { name: "Döner", price: 10, heal: 28, at: ["mall"] },
  { name: "Eisbecher", price: 6, heal: 10, at: ["mall"] },
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
  { name: "Schwarzer Anzug", shirt: "#1b1b20", pants: "#1b1b20", price: 650, top: "suit", top2: "#f2f0ea", bottom: "pants", shoes: "leather", shoeCol: "#111111", accent: "#1b1b20" },
  { name: "Grauer Anzug", shirt: "#5a5e66", pants: "#5a5e66", price: 600, top: "suit", top2: "#dfe7f2", bottom: "pants", shoes: "leather", shoeCol: "#2a1c14", accent: "#7a1f2b" },
  { name: "Biker-Kutte", shirt: "#2a2420", pants: "#22252c", price: 340, top: "leather", top2: "#8a8a8a", bottom: "jeans", shoes: "boot", shoeCol: "#111111", hair: "beanie", hatCol: "#1b1b1f" },
  { name: "Roter Trainingsanzug", shirt: "#c0392b", pants: "#c0392b", price: 160, top: "track", top2: "#c0392b", bottom: "track", shoes: "sneaker", shoeCol: "#f2f2f2", accent: "#f2f2f2" },
  { name: "Goldener Hoodie", shirt: "#d4a017", pants: "#1b1b1f", price: 280, top: "hoodie", top2: "#d4a017", bottom: "jeans", shoes: "sneaker", shoeCol: "#d4a017", hair: "cap", hatCol: "#1b1b1f" },
  { name: "Golfer", shirt: "#f2f0ea", pants: "#c9b48c", price: 210, top: "polo", top2: "#1d4e89", bottom: "pants", shoes: "leather", shoeCol: "#f2f0ea", hair: "cap", hatCol: "#f2f0ea" },
  { name: "Strandtag", shirt: "#2bb3ff", pants: "#ffd23f", price: 80, top: "hawaii", top2: "#2bb3ff", bottom: "shorts", shoes: "sandal", shoeCol: "#5a3a22" },
  { name: "Bürojacke", shirt: "#3a4a5a", pants: "#2c3e57", price: 240, top: "jacket", top2: "#dfe7f2", bottom: "pants", shoes: "leather", shoeCol: "#1b1410" },
];

// supermarket: snacks heal, energy drinks make you run faster for a while
export interface MarketItem { name: string; price: number; heal: number; energy: number; }
export const MARKET: MarketItem[] = [
  { name: "Schokoriegel", price: 4, heal: 10, energy: 0 },
  { name: "Sandwich", price: 9, heal: 30, energy: 0 },
  { name: "Obstschale", price: 7, heal: 20, energy: 0 },
  { name: "Energydrink", price: 12, heal: 5, energy: 60 },
  { name: "Wasserflasche", price: 2, heal: 6, energy: 0 },
  { name: "Banane", price: 1, heal: 5, energy: 0 },
  { name: "Chips", price: 3, heal: 8, energy: 0 },
  { name: "Fertigsalat", price: 6, heal: 22, energy: 0 },
  { name: "Proteinriegel", price: 5, heal: 18, energy: 20 },
  { name: "Kaffee to go", price: 4, heal: 4, energy: 30 },
  { name: "Grillhähnchen", price: 11, heal: 45, energy: 0 },
];
// gas station shop (24/7): snacks, a scratch card, the car (nitro, wash)
export const GAS_ITEMS: MarketItem[] = [
  { name: "Hot Dog", price: 5, heal: 18, energy: 0 }, { name: "Belegtes Brötchen", price: 4, heal: 14, energy: 0 },
  { name: "Cola", price: 3, heal: 6, energy: 10 }, { name: "Energydrink", price: 12, heal: 5, energy: 60 }, { name: "Kaffee to go", price: 4, heal: 4, energy: 30 },
  { name: "Schokoriegel", price: 3, heal: 10, energy: 0 },
];
export const SCRATCH_PRICE = 5;          // a scratch card: wins 0 / 10 / 50 / 500
export const NITRO_FILL_PRICE = 40;      // fills the nitro of your car (it must stand at the station)
export const WASH_PRICE = 30;            // car wash: dents and broken glass gone (not the engine damage)
// the bar: drinks heal a little; alcohol makes you tipsy (the picture sways, steering wobbles) for a while
export interface Drink { name: string; price: number; heal: number; booze: number }
export const DRINKS: Drink[] = [
  { name: "Wasser", price: 2, heal: 5, booze: 0 }, { name: "Limonade", price: 4, heal: 8, booze: 0 },
  { name: "Bier vom Fass", price: 6, heal: 6, booze: 25 }, { name: "Bay Sunset (Cocktail)", price: 12, heal: 10, booze: 40 },
  { name: "Whiskey", price: 15, heal: 4, booze: 55 }, { name: "Tequila-Runde", price: 20, heal: 4, booze: 75 },
  { name: "Erdnüsse", price: 3, heal: 10, booze: 0 },
];
// pharmacy: heal now, first aid kits to carry (use with H), vitamins raise your health for good
export const PHARMA: { name: string; price: number; heal: number; desc: string; kind: "heal" | "kit" | "vit" | "clean" }[] = [
  { name: "Pflaster", price: 8, heal: 20, desc: "+20 Gesundheit", kind: "heal" },
  { name: "Schmerztabletten", price: 25, heal: 50, desc: "+50 Gesundheit", kind: "heal" },
  { name: "Erste-Hilfe-Set", price: 60, heal: 60, desc: "zum Mitnehmen (höchstens 3), mit H benutzen: +60", kind: "kit" },
  { name: "Vitamine", price: 400, heal: 0, desc: "+10 maximale Gesundheit (bis +50)", kind: "vit" },
  { name: "Katerfrühstück", price: 15, heal: 10, desc: "macht sofort nüchtern", kind: "clean" },
];
export const MAX_KITS = 3, MAX_VIT = 5;
// electronics shop in the mall: gadgets with an effect, phone cases (colour of the phone)
export interface Gadget { id: string; name: string; price: number; desc: string }
export const GADGETS: Gadget[] = [
  { id: "headphones", name: "Kopfhörer", price: 250, desc: "Radio hören auch zu Fuß" },
  { id: "scanner", name: "Polizeiscanner", price: 1500, desc: "Meldet den Beginn einer Fahndung; die Polizei verliert dich schneller" },
  { id: "flashlight", name: "Taschenlampe", price: 60, desc: "Leuchtet nachts zu Fuß" },
  { id: "binoculars", name: "Fernglas", price: 400, desc: "Zoom mit Z (Knopf ZOOM am Handy)" },
  { id: "laptop", name: "Laptop mit Schlüssel-App", price: 2200, desc: "Verschlossene Autos leise öffnen (keine Scheibe, kein Alarm)" },
  { id: "smartwatch", name: "Smartwatch", price: 350, desc: "Uhrzeit und Puls im HUD" },
];
export const PHONE_CASES: { id: string; name: string; color: string; price: number }[] = [
  { id: "case:black", name: "Bay Phone 15 Schwarz", color: "#16181c", price: 0 },
  { id: "case:gold", name: "Bay Phone 15 Gold", color: "#c9a227", price: 900 },
  { id: "case:pink", name: "Bay Phone 15 Pink", color: "#ff3cac", price: 700 },
  { id: "case:blue", name: "Bay Phone 15 Blau", color: "#2b6bff", price: 700 },
  { id: "case:white", name: "Bay Phone 15 Weiß", color: "#e8e8ec", price: 700 },
];
// car dealer: these are for sale (they go into the garage)
// boat dealer and aircraft dealer (bought ones wait at the jetty / the heliport)
export const BOAT_DEALER: CarModel[] = ["jetski", "boat", "fishboat"];
export const AIR_DEALER: CarModel[] = ["heli", "jet"];
export const DEALER_CARS: CarModel[] = ["compact", "sedan", "wagon", "suv", "pickup", "offroad", "roadster", "sport", "muscle", "super", "lowrider", "monster", "hyper", "formula"];
// barber and tattoo studio
export const HAIR_STYLES: { hair: Hair; name: string; price: number }[] = [
  { hair: "short", name: "Kurz", price: 30 }, { hair: "buzz", name: "Raspel", price: 25 }, { hair: "curls", name: "Locken", price: 45 },
  { hair: "long", name: "Lang", price: 60 }, { hair: "ponytail", name: "Zopf", price: 50 }, { hair: "bald", name: "Glatze", price: 20 },
];
export const BEARDS = [{ name: "Glatt rasiert", price: 15 }, { name: "Dreitagebart", price: 15 }, { name: "Vollbart", price: 35 }];
export const TATTOOS = [{ name: "Keins (entfernen)", price: 200 }, { name: "Tribal", price: 150 }, { name: "Wellen", price: 180 }, { name: "Sterne", price: 160 }, { name: "Ranken", price: 220 }, { name: "Streifen", price: 140 }, { name: "Schuppen", price: 260 }];
export interface Style { hair: Hair; beard: number; tattoo: number; }
export const DEFAULT_STYLE: Style = { hair: "short", beard: 1, tattoo: 0 };

export const ARMOR_PRICE = 500;
export const NEON_PRICE = 600;        // underglow in the workshop
export const NEONS = ["#ff3cac", "#2bf0ff", "#3dff8b", "#ffd23f", "#9d4dff", "#ff3a3a", "#ffffff", ""]; // "" = remove       // full vest
export const REPAIR_PER_HP = 4;       // workshop: price per missing car hit point
export const PAINT_PRICE = 200;
export const TYRE_PRICE = 150;       // new tyres after a spike strip
export const ROB_REWARD: [number, number] = [250, 700];
export const ROB_COOLDOWN = 180;      // seconds until a shop can be robbed again
export const ROB_HEAT = 60;           // heat added by a robbery (2 stars)

export const AMMO_FOR_SALE: Weapon[] = ["pistol", "revolver", "smg", "rifle", "shotgun", "sniper", "grenade", "rocket", "bomb"];
export const GUNS_FOR_SALE: Weapon[] = ["knife", "bat", "pistol", "revolver", "smg", "rifle", "shotgun", "sniper", "grenade", "rocket", "bomb"];

export type ShopAction =
  | { t: "weapon"; w: Weapon } | { t: "ammo"; w: Weapon } | { t: "armor" }
  | { t: "food"; i: number } | { t: "outfit"; i: number }
  | { t: "repair" } | { t: "paint"; color: string } | { t: "tune"; part: TunePart }
  | { t: "save" } | { t: "store" } | { t: "takeCar"; i: number } | { t: "sellCar"; i: number }
  | { t: "rob" } | { t: "sleep" }
  | { t: "market"; i: number } | { t: "buyCar"; i: number } | { t: "hair"; i: number } | { t: "beard"; i: number } | { t: "tattoo"; i: number }
  | { t: "deposit"; amount: number } | { t: "withdraw"; amount: number } // amount -1: everything
  | { t: "gas"; i: number } | { t: "scratch" } | { t: "nitroFill" } | { t: "wash" } | { t: "neon"; color: string }
  | { t: "drink"; i: number } | { t: "pharma"; i: number } | { t: "gadget"; id: string } | { t: "case"; id: string }
  | { t: "buyCraft"; model: CarModel } | { t: "fetchCraft"; model: CarModel };
