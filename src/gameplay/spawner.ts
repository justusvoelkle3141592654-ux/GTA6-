import { Car, CAR_MODELS, MODEL_NAME, MODEL_STATS, isBoat, isHeli, type CarModel } from "../vehicles/vehicles";
import { WATER_Y, isWater, terrainH } from "../world/world";
import { WEAPONS, WEAPON_DEFS } from "./weapons";
import { STAR_HEAT } from "../ai/wanted";
import { MAX_ARMOR, type Game } from "../core/engine";
import type { FactionId } from "../vehicles/vehicles";

// sandbox menu (pause menu, open world): vehicles, weapons, money, people and the wanted level on demand
export type SpawnPeople = "civ" | "cop" | FactionId;
export const SPAWN_MODELS: CarModel[] = CAR_MODELS;
const COLOR: Partial<Record<CarModel, string>> = {
  police: "#f4f6fa", swat: "#1b1d22", armor: "#4b5320", taxi: "#ffc21a", bus: "#2bb3ff", boat: "#f4f6fa", heli: "#ff3cac",
  ambulance: "#f4f4f6", fire: "#c0392b", garbage: "#3c6e47", tow: "#e1b12c", icecream: "#f2c7d8", policebike: "#f4f6fa", unmarked: "#2b2f3a",
  policeboat: "#1f3a6e", policeheli: "#1f3a6e", fishboat: "#2e6da4", jetski: "#ffd23f",
};
const PAINT = ["#ff2d95", "#2bf0ff", "#ffd23f", "#ff8a1f", "#3dff8b", "#9d4dff", "#f4f4f6", "#15161b"];
const CASH_MAX = 1e8;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Spawner {
  constructor(private g: Game) {}

  get allowed() { return this.g.rules.city; }

  // a vehicle next to you, and you get in right away (it is yours: no crime)
  vehicle(model: CarModel): string {
    const g = this.g;
    if (!this.allowed) return "Nur in der Open World";
    if (g.missions.active || g.hide.active) return "Nicht während einer Mission oder des Versteckspiels";
    const fx = g.fx, fy = g.fy;
    let x = fx, y = fy;
    if (isBoat(model)) {
      // a boat needs water close by
      let found = false;
      for (let r = 40; r <= 320 && !found; r += 40) for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, px = fx + Math.cos(a) * r, py = fy + Math.sin(a) * r;
        if (isWater(px, py) && isWater(px + 30, py) && isWater(px - 30, py)) { x = px; y = py; found = true; break; }
      }
      if (!found) return "Ein Boot braucht Wasser – geh zur Bucht im Westen (Bootssteg B)";
    } else {
      // beside you, on a free spot
      const a = g.fa;
      const tries = [[Math.sin(a) * 40, -Math.cos(a) * 40], [-Math.sin(a) * 40, Math.cos(a) * 40], [Math.cos(a) * 60, Math.sin(a) * 60], [-Math.cos(a) * 60, -Math.sin(a) * 60]];
      let ok = false;
      for (const [dx, dy] of tries) { if (!g.world.isSolid(fx + dx, fy + dy, 18) && !isWater(fx + dx, fy + dy)) { x = fx + dx; y = fy + dy; ok = true; break; } }
      if (!ok) return "Hier ist kein Platz – geh auf die Straße";
    }
    const c = new Car("civ", model, COLOR[model] ?? PAINT[Math.floor(Math.random() * PAINT.length)]);
    const st = MODEL_STATS[model];
    c.x = x; c.y = y; c.a = g.fa; c.z = isBoat(model) ? WATER_Y : isHeli(model) ? g.groundAt(x, y) : terrainH(x, y);
    c.hp = c.maxHp = st.hp; c.mass = st.mass;
    c.parked = true; c.handbrake = true; c.owned = true;
    g.cars.push(c);
    g.takeVehicle(c);
    return `${MODEL_NAME[model]} ist da`;
  }

  weapons(): string {
    const g = this.g;
    for (const w of WEAPONS) { const d = WEAPON_DEFS[w]; g.inv.give(w, d.maxAmmo); }
    return "Alle Waffen mit voller Munition";
  }

  cash(v: number): string {
    const g = this.g;
    g.cash = Math.min(CASH_MAX, g.cash + v);
    return `+$${v.toLocaleString("de-DE")}`;
  }

  heal(): string {
    const g = this.g, pd = g.ped, p = g.player;
    pd.hp = pd.maxHp; pd.armor = MAX_ARMOR;
    if (!p.dead) { p.hp = p.maxHp; p.flat = false; }
    g.nitro = 1;
    return "Gesundheit, Weste, Auto und Nitro voll";
  }

  // a few people around you
  people(kind: SpawnPeople): string {
    const g = this.g;
    if (!this.allowed) return "Nur in der Open World";
    const n = kind === "civ" ? 5 : 3;
    let made = 0;
    for (let i = 0; i < n * 4 && made < n; i++) {
      const a = Math.random() * Math.PI * 2, d = rnd(50, 110);
      const x = g.fx + Math.cos(a) * d, y = g.fy + Math.sin(a) * d;
      if (g.world.isSolid(x, y, 8) || isWater(x, y)) continue;
      const make = () => kind === "civ" ? g.peds.spawnCiv(x, y) : kind === "cop" ? g.peds.spawnRole("cop", x, y) : g.peds.spawnRole("gang", x, y, kind);
      const c = make() ?? (g.peds.makeRoom(g.fx, g.fy) ? make() : null);
      if (!c) break;
      made++;
    }
    return made ? `${made} Personen erscheinen` : "Kein Platz für weitere Personen";
  }

  // set the wanted level directly (0 = clean)
  wanted(stars: number): string {
    const g = this.g, w = g.wanted;
    if (!g.rules.cops) return "In diesem Modus gibt es keine Polizei";
    const s = Math.max(0, Math.min(g.rules.maxStars, stars));
    if (s === 0) { w.clear(); g.police.reset(); return "Fahndung gelöscht"; }
    w.heat = STAR_HEAT[s] + 1; w.stars = s; w.maxStars = Math.max(w.maxStars, s); w.lostT = 0;
    g.police.lastX = g.fx; g.police.lastY = g.fy;
    g.copSpawnT = 0;
    return `${s} ${s === 1 ? "Stern" : "Sterne"}`;
  }
}
