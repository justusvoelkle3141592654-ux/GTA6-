import { CAR_MODELS, type CarModel, type FactionId } from "./vehicles";
import { WEAPONS, WEAPON_DEFS, type InventorySave, type Weapon } from "./weapons";
import { MAX_TUNE, TUNE_PARTS, noTune, type OwnedCar, type Tune } from "./garage";
import { STATIONS } from "./radio";

export type SaveDifficulty = "easy" | "normal" | "hard";
const DIFFICULTIES: SaveDifficulty[] = ["easy", "normal", "hard"];

export const SAVE_KEY = "solarabay.save.v3";
const LEGACY_KEYS = ["solarabay.save.v2", "solarabay.save.v1"]; // older versions: read and converted
export const SAVE_VERSION = 3;
export const AUTOSAVE_EVERY = 60; // seconds

export interface SaveCar { model: CarModel; color: string; hp: number; maxHp: number; mass: number; x: number; y: number; a: number; tune: Tune; }
export interface SaveStats { playTime: number; carsStolen: number; pedsHit: number; deaths: number; arrests: number; maxStars: number; earned: number; jobsDone: number; }
export interface Progress {
  missions: string[];               // finished story missions
  shells: number[];                 // collected shells (ids)
  jumps: number[];                  // completed stunt jumps (ids)
  jobs: Record<string, number>;     // side job level per kind
  rep: Record<FactionId, number>;   // gang reputation (-100 hostile .. 100 friendly)
  records: Record<string, number>;  // best race times etc.
}
export interface SaveData {
  v: typeof SAVE_VERSION;
  savedAt: number;
  difficulty: SaveDifficulty;
  onFoot: boolean;
  ped: { x: number; y: number; a: number; hp: number; armor: number };
  car: SaveCar | null; // null: the player's car was destroyed or is in the garage
  carStored: boolean;  // the player's car is in the garage (since version 3)
  cash: number;
  bank: number;        // money on the account (since version 3)
  inventory: InventorySave;
  outfit: number;
  garage: OwnedCar[];
  radio: number;
  stats: SaveStats;
  progress: Progress;
}
export type SaveResult = "saved" | "memory" | "wanted" | "busy" | "mode";

export const emptyStats = (): SaveStats => ({ playTime: 0, carsStolen: 0, pedsHit: 0, deaths: 0, arrests: 0, maxStars: 0, earned: 0, jobsDone: 0 });
export const emptyProgress = (): Progress => ({ missions: [], shells: [], jumps: [], jobs: {}, rep: { halcones: 0, kings: 0 }, records: {} });

// fallback when localStorage is missing or blocked: keeps the save until the page is reloaded
let memory: string | null = null;

function storage(): Storage | null {
  try {
    const s = window.localStorage;
    const k = SAVE_KEY + ".probe";
    s.setItem(k, "1"); s.removeItem(k);
    return s;
  } catch { return null; }
}
export const storageAvailable = () => storage() !== null;

export function writeSave(d: SaveData): "saved" | "memory" {
  const raw = JSON.stringify(d);
  const s = storage();
  if (s) { try { s.setItem(SAVE_KEY, raw); return "saved"; } catch { /* quota: fall through */ } }
  memory = raw;
  return "memory";
}

export function clearSave() {
  memory = null;
  try { window.localStorage.removeItem(SAVE_KEY); for (const k of LEGACY_KEYS) window.localStorage.removeItem(k); } catch { /* ignore */ }
}

export function loadSave(): SaveData | null {
  let raw: string | null = null;
  try {
    const s = window.localStorage;
    raw = s.getItem(SAVE_KEY);
    for (const k of LEGACY_KEYS) raw = raw ?? s.getItem(k);
  } catch { /* ignore */ }
  raw = raw ?? memory;
  if (!raw) return null;
  try { return validate(JSON.parse(raw)); } catch { return null; }
}

export const hasSave = () => loadSave() !== null;

// ---------- validation (a save may be old, edited or broken) ----------
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
const isColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const clampN = (v: unknown, a: number, b: number, def: number) => (num(v) ? Math.max(a, Math.min(b, v)) : def);

function tuneOf(v: unknown): Tune {
  const t = noTune();
  if (isObj(v)) for (const p of TUNE_PARTS) t[p] = Math.round(clampN(v[p], 0, MAX_TUNE, 0));
  return t;
}

function carOf(c: unknown, withPos: boolean): (OwnedCar & { x: number; y: number; a: number }) | null {
  if (!isObj(c) || !oneOf(c.model, CAR_MODELS) || !isColor(c.color)) return null;
  if (!num(c.hp) || !num(c.maxHp) || !num(c.mass)) return null;
  if (withPos && (!num(c.x) || !num(c.y) || !num(c.a))) return null;
  return { model: c.model, color: c.color, hp: c.hp, maxHp: c.maxHp, mass: c.mass, tune: tuneOf(c.tune), x: num(c.x) ? c.x : 0, y: num(c.y) ? c.y : 0, a: num(c.a) ? c.a : 0 };
}

function numList(v: unknown): number[] { return Array.isArray(v) ? v.filter(num) : []; }
function numMap(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (isObj(v)) for (const [k, x] of Object.entries(v)) if (num(x)) out[k] = x;
  return out;
}

function inventoryOf(d: Obj): InventorySave {
  const inv = d.inventory;
  if (isObj(inv) && Array.isArray(inv.owned)) {
    const owned = inv.owned.filter((w): w is Weapon => oneOf(w, WEAPONS));
    const ammo: Partial<Record<Weapon, number>> = {}, clip: Partial<Record<Weapon, number>> = {};
    for (const w of owned) {
      ammo[w] = clampN(isObj(inv.ammo) ? inv.ammo[w] : 0, 0, WEAPON_DEFS[w].maxAmmo, 0);
      clip[w] = clampN(isObj(inv.clip) ? inv.clip[w] : 0, 0, WEAPON_DEFS[w].clip, 0);
    }
    return { owned, ammo, clip, current: oneOf(inv.current, WEAPONS) ? inv.current : "fist" };
  }
  // version 1: pistol + rocket and bomb counters
  const rockets = clampN(d.rockets, 0, 30, 0), bombs = clampN(d.bombs, 0, 30, 0);
  const owned: Weapon[] = ["pistol"];
  if (rockets > 0) owned.push("rocket");
  if (bombs > 0) owned.push("bomb");
  return { owned, ammo: { pistol: 48, rocket: rockets, bomb: bombs }, clip: { pistol: 12 }, current: "pistol" };
}

function validate(d: unknown): SaveData | null {
  if (!isObj(d) || (d.v !== SAVE_VERSION && d.v !== 2 && d.v !== 1)) return null;
  const p = d.ped, st = d.stats, pr = d.progress;
  if (!isObj(p) || !num(p.x) || !num(p.y) || !num(p.a) || !num(p.hp)) return null;
  if (!num(d.savedAt) || !num(d.cash) || typeof d.onFoot !== "boolean" || !oneOf(d.difficulty, DIFFICULTIES)) return null;
  let car: SaveCar | null = null;
  if (d.car !== null) { car = carOf(d.car, true); if (!car) return null; }
  const stats = emptyStats();
  if (isObj(st)) for (const k of Object.keys(stats) as (keyof SaveStats)[]) { const v = st[k]; if (num(v)) stats[k] = v; }
  const progress = emptyProgress();
  if (isObj(pr)) {
    progress.missions = Array.isArray(pr.missions) ? pr.missions.filter((m): m is string => typeof m === "string") : [];
    progress.shells = numList(pr.shells); progress.jumps = numList(pr.jumps);
    progress.jobs = numMap(pr.jobs); progress.records = numMap(pr.records);
    if (isObj(pr.rep)) { progress.rep.halcones = clampN(pr.rep.halcones, -100, 100, 0); progress.rep.kings = clampN(pr.rep.kings, -100, 100, 0); }
  }
  const garage: OwnedCar[] = [];
  if (Array.isArray(d.garage)) for (const c of d.garage) { const o = carOf(c, false); if (o) garage.push({ model: o.model, color: o.color, hp: o.hp, maxHp: o.maxHp, mass: o.mass, tune: o.tune }); }
  return {
    v: SAVE_VERSION, savedAt: d.savedAt, difficulty: d.difficulty, onFoot: d.onFoot,
    ped: { x: p.x, y: p.y, a: p.a, hp: p.hp, armor: clampN(p.armor, 0, 100, 0) }, car,
    // before version 3 "no car + cars in the garage" meant: parked in the garage
    carStored: !car && (typeof d.carStored === "boolean" ? d.carStored : garage.length > 0),
    cash: Math.max(0, d.cash), bank: clampN(d.bank, 0, 1e9, 0), inventory: inventoryOf(d),
    outfit: Math.round(clampN(d.outfit, 0, 99, 0)), garage: garage.slice(0, 8),
    radio: Math.round(clampN(d.radio, -1, STATIONS.length - 1, -1)),
    stats, progress,
  };
}
