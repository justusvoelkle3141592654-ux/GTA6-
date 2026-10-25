// cheat codes (phone app "Codes", behind the PIN): money, health, weapons, new items, the police, vehicles, the world
import type { Game } from "../core/engine";
import type { CarModel } from "../vehicles/vehicles";
import { MODEL_NAME } from "../vehicles/vehicles";
import { CHEAT_ONLY, WEAPONS, WEAPON_DEFS, type Weapon } from "./weapons";

export const CHEAT_PIN = "240413";

// switches that stay on until the code is entered again (or ALLESAUS); they are not saved
export type CheatFlag =
  | "god" | "ammo" | "explosive" | "gold" | "fist" | "invisible" | "nopolice" | "nitro" | "turbo" | "carGod"
  | "jetpack" | "parachute" | "jump" | "quick" | "moon" | "timeStop" | "slowmo" | "noTraffic";

export const FLAG_NAME: Record<CheatFlag, string> = {
  god: "Unverwundbar", ammo: "Unendlich Munition", explosive: "Explosivmunition", gold: "Goldmunition", fist: "Superfaust",
  invisible: "Tarnumhang", nopolice: "Keine Polizei", nitro: "Unendlich Nitro", turbo: "Turbo", carGod: "Panzerauto",
  jetpack: "Jetpack", parachute: "Fallschirm", jump: "Sprungfedern", quick: "Flinke Schuhe", moon: "Mondschwerkraft",
  timeStop: "Zeitstopp", slowmo: "Zeitlupe", noTraffic: "Leere Straßen",
};

export interface CheatDef { code: string; name: string; group: string; flag?: CheatFlag; run: (g: Game) => string }

const toggle = (flag: CheatFlag, on?: (g: Game, now: boolean) => void) => (g: Game) => {
  const now = !g.cheats.has(flag);
  if (now) g.cheats.add(flag); else g.cheats.delete(flag);
  on?.(g, now);
  return `${FLAG_NAME[flag]} ${now ? "an" : "aus"}`;
};
const give = (w: Weapon, n: number) => (g: Game) => {
  g.inv.give(w, n); g.inv.select(w);
  return `${WEAPON_DEFS[w].name} (${g.inv.total(w)})`;
};
const car = (m: CarModel) => (g: Game) => g.spawner.vehicle(m) || `${MODEL_NAME[m]} ist da`;
const time = (h: number, label: string) => (g: Game) => { g.clock = h; return label; };

export const CHEATS: CheatDef[] = [
  // money
  { code: "GELD", name: "+$10.000", group: "Geld", run: (g) => g.spawner.cash(10000) },
  { code: "REICH", name: "+$100.000", group: "Geld", run: (g) => g.spawner.cash(100000) },
  { code: "MILLIONAER", name: "+$1.000.000", group: "Geld", run: (g) => g.spawner.cash(1000000) },
  { code: "GELDREGEN", name: "Geldscheine regnen um dich herum", group: "Geld", run: (g) => { g.cheatFx("money"); return "Geldregen!"; } },
  // health
  { code: "GESUND", name: "Leben, Weste, Auto und Nitro voll", group: "Gesundheit", run: (g) => g.spawner.heal() },
  { code: "GOTT", name: "Unverwundbar (an/aus)", group: "Gesundheit", flag: "god", run: toggle("god") },
  { code: "WESTE", name: "Schutzweste voll", group: "Gesundheit", run: (g) => { g.ped.armor = 100; return "Weste voll"; } },
  { code: "MEDIKITS", name: "+5 Erste-Hilfe-Sets (H)", group: "Gesundheit", run: (g) => { for (let i = 0; i < 5; i++) g.items.push("kit"); return `${g.kits} Erste-Hilfe-Sets`; } },
  { code: "ENERGIE", name: "Energydrink: 2 Minuten schneller", group: "Gesundheit", run: (g) => { g.energyT = 120; return "Energie für 2 Minuten"; } },
  // weapons and new items
  { code: "WAFFEN", name: "Alle Waffen, volle Munition", group: "Waffen & Items", run: (g) => g.spawner.weapons() },
  { code: "MUNITION", name: "Unendlich Munition (an/aus)", group: "Waffen & Items", flag: "ammo", run: toggle("ammo", (g, on) => { for (const w of WEAPONS) if (!CHEAT_ONLY.includes(w)) { if (on) g.inv.infinite.add(w); else g.inv.infinite.delete(w); } }) },
  { code: "TNT", name: "5 Blöcke TNT", group: "Waffen & Items", run: (g) => { g.inv.give("tnt", 5); g.inv.select("tnt"); return `5 Blöcke TNT (jetzt ${g.inv.total("tnt")}) – Feuer legt einen ab`; } },
  { code: "RAKETEN", name: "Raketenwerfer + 30 Raketen", group: "Waffen & Items", run: give("rocket", 30) },
  { code: "GRANATEN", name: "25 Granaten", group: "Waffen & Items", run: give("grenade", 25) },
  { code: "HAFTBOMBEN", name: "30 Haftbomben", group: "Waffen & Items", run: give("bomb", 30) },
  { code: "SCHARF", name: "Scharfschützengewehr", group: "Waffen & Items", run: give("sniper", 75) },
  { code: "MINIGUN", name: "Maschinenpistole, volle Munition", group: "Waffen & Items", run: give("smg", 450) },
  { code: "EXPLOSIV", name: "Neu: Explosivmunition – jede Kugel explodiert (an/aus)", group: "Waffen & Items", flag: "explosive", run: toggle("explosive") },
  { code: "GOLDMUNITION", name: "Neu: Goldmunition – fünffacher Schaden (an/aus)", group: "Waffen & Items", flag: "gold", run: toggle("gold") },
  { code: "SUPERFAUST", name: "Neu: Superfaust – ein Schlag schleudert jeden weg (an/aus)", group: "Waffen & Items", flag: "fist", run: toggle("fist") },
  // police
  { code: "SAUBER", name: "Fahndung löschen", group: "Polizei", run: (g) => g.spawner.wanted(0) },
  { code: "STERN", name: "Ein Stern mehr", group: "Polizei", run: (g) => g.spawner.wanted(g.wanted.stars + 1) },
  { code: "CHAOS", name: "Sechs Sterne", group: "Polizei", run: (g) => g.spawner.wanted(6) },
  { code: "TARNUMHANG", name: "Neu: Tarnumhang – die Polizei sieht dich nicht (an/aus)", group: "Polizei", flag: "invisible", run: toggle("invisible") },
  { code: "KEINEPOLIZEI", name: "Verbrechen bringen keine Sterne (an/aus)", group: "Polizei", flag: "nopolice", run: toggle("nopolice", (g, on) => { if (on) g.spawner.wanted(0); }) },
  { code: "FREI", name: "Sofort aus dem Gefängnis", group: "Polizei", run: (g) => g.jailFree() },
  // vehicles
  { code: "GTAV", name: "Das GTA V (1000 km/h)", group: "Fahrzeuge", run: car("gtav") },
  { code: "PANZER", name: "Panzer", group: "Fahrzeuge", run: car("tank") },
  { code: "KAMPFJET", name: "Kampfjet", group: "Fahrzeuge", run: car("jet") },
  { code: "HELI", name: "Hubschrauber", group: "Fahrzeuge", run: car("heli") },
  { code: "FLUGZEUG", name: "Propellerflugzeug", group: "Fahrzeuge", run: car("plane") },
  { code: "MONSTER", name: "Monstertruck", group: "Fahrzeuge", run: car("monster") },
  { code: "FORMEL", name: "Formel-Rennwagen", group: "Fahrzeuge", run: car("formula") },
  { code: "HYPER", name: "Hypercar Vortex X", group: "Fahrzeuge", run: car("hyper") },
  { code: "YACHT", name: "Yacht (am Wasser)", group: "Fahrzeuge", run: car("yacht") },
  { code: "HOVER", name: "Luftkissenboot", group: "Fahrzeuge", run: car("hovercraft") },
  { code: "LIMO", name: "Stretch-Limousine", group: "Fahrzeuge", run: car("limo") },
  { code: "TRAKTOR", name: "Traktor", group: "Fahrzeuge", run: car("tractor") },
  { code: "STREIFE", name: "Polizei-Sportwagen", group: "Fahrzeuge", run: car("polsport") },
  { code: "JETSKI", name: "Jetski (am Wasser)", group: "Fahrzeuge", run: car("jetski") },
  // vehicle effects
  { code: "REPARIEREN", name: "Fahrzeug reparieren", group: "Fahrzeug-Extras", run: (g) => { const p = g.player; if (p.dead) return "Kein Fahrzeug"; p.hp = p.maxHp; p.flat = false; return "Fahrzeug repariert"; } },
  { code: "NITRO", name: "Unendlich Nitro (an/aus)", group: "Fahrzeug-Extras", flag: "nitro", run: toggle("nitro") },
  { code: "TURBO", name: "Doppeltes Tempo für dein Fahrzeug (an/aus)", group: "Fahrzeug-Extras", flag: "turbo", run: toggle("turbo") },
  { code: "PANZERAUTO", name: "Unzerstörbares Fahrzeug (an/aus)", group: "Fahrzeug-Extras", flag: "carGod", run: toggle("carGod") },
  { code: "FLUGAUTO", name: "Jedes Auto fliegt (an/aus)", group: "Fahrzeug-Extras", run: (g) => { g.toggleFly(); return g.flyMode ? "Fliegen an (Leertaste/HOCH, Shift/RUNTER)" : "Fliegen aus"; } },
  { code: "BUMM", name: "Alle Autos in der Nähe explodieren", group: "Fahrzeug-Extras", run: (g) => { g.cheatFx("boom"); return "BUMM!"; } },
  // the world
  { code: "SONNE", name: "Sonnenschein", group: "Welt", run: (g) => { g.setWeather("sun"); return "Sonnig"; } },
  { code: "REGEN", name: "Regen", group: "Welt", run: (g) => { g.setWeather("rain"); return "Regen"; } },
  { code: "NEBEL", name: "Nebel", group: "Welt", run: (g) => { g.setWeather("fog"); return "Nebel"; } },
  { code: "WOLKEN", name: "Bewölkt", group: "Welt", run: (g) => { g.setWeather("clouds"); return "Bewölkt"; } },
  { code: "MORGEN", name: "8 Uhr morgens", group: "Welt", run: time(8, "8:00 Uhr") },
  { code: "MITTAG", name: "12 Uhr mittags", group: "Welt", run: time(12, "12:00 Uhr") },
  { code: "ABEND", name: "Sonnenuntergang", group: "Welt", run: time(19.2, "19:12 Uhr") },
  { code: "NACHT", name: "Mitternacht", group: "Welt", run: time(0, "0:00 Uhr") },
  { code: "ZEITSTOPP", name: "Die Uhr bleibt stehen (an/aus)", group: "Welt", flag: "timeStop", run: toggle("timeStop") },
  { code: "ZEITLUPE", name: "Alles in Zeitlupe (an/aus)", group: "Welt", flag: "slowmo", run: toggle("slowmo") },
  { code: "LEERESTRASSEN", name: "Kein Verkehr (an/aus)", group: "Welt", flag: "noTraffic", run: toggle("noTraffic", (g, on) => { if (on) g.cheatFx("clearTraffic"); }) },
  { code: "METEORE", name: "Meteoritenregen in der Umgebung", group: "Welt", run: (g) => { g.cheatFx("meteors"); return "Meteore im Anflug!"; } },
  // you
  { code: "JETPACK", name: "Neu: Jetpack – zu Fuß fliegen (an/aus)", group: "Du", flag: "jetpack", run: toggle("jetpack", (g, on) => { if (on !== g.flyMode && g.onFoot) g.toggleFly(); }) },
  { code: "FALLSCHIRM", name: "Neu: Fallschirm – sanft landen, kein Fallschaden (an/aus)", group: "Du", flag: "parachute", run: toggle("parachute") },
  { code: "SPRUNGFEDERN", name: "Neu: Sprungfedern – Riesensprung mit Leertaste / SPRUNG (an/aus)", group: "Du", flag: "jump", run: toggle("jump") },
  { code: "FLINK", name: "Flinke Schuhe – doppelt so schnell zu Fuß (an/aus)", group: "Du", flag: "quick", run: toggle("quick") },
  { code: "MOND", name: "Mondschwerkraft (an/aus)", group: "Du", flag: "moon", run: toggle("moon") },
  { code: "BETRUNKEN", name: "Betrunken", group: "Du", run: (g) => { g.drunk = 100; return "Hicks!"; } },
  { code: "NUECHTERN", name: "Wieder nüchtern", group: "Du", run: (g) => { g.drunk = 0; return "Nüchtern"; } },
  { code: "WOHNUNGEN", name: "Alle Wohnungen gehören dir", group: "Du", run: (g) => g.ownAllHomes() },
  // fun
  { code: "FEUERWERK", name: "Neu: Feuerwerk über dir", group: "Spaß", run: (g) => { g.cheatFx("fireworks"); return "Feuerwerk!"; } },
  { code: "PARTY", name: "Leute kommen zur Party, mit Feuerwerk", group: "Spaß", run: (g) => { g.spawner.people("civ"); g.cheatFx("fireworks"); return "Party!"; } },
  { code: "LEUTE", name: "Passanten erscheinen", group: "Spaß", run: (g) => g.spawner.people("civ") },
  { code: "BANDE", name: "Eine Bande erscheint", group: "Spaß", run: (g) => g.spawner.people("halcones") },
  { code: "ALLESAUS", name: "Alle Cheats ausschalten", group: "Spaß", run: (g) => g.cheatsOff() },
];

// the phone app: a code was entered
export function runCheat(g: Game, raw: string): string {
  const code = raw.trim().toUpperCase().replace(/[\s\-_.]/g, "").replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE");
  if (!code) return "";
  if (g.state === "menu" || g.state === "over") return "Erst ein Spiel starten";
  if (!g.rules.city) return "Codes gibt es nur in der Open World";
  const c = CHEATS.find((q) => q.code === code);
  if (!c) return "Unbekannter Code";
  return c.run(g);
}
