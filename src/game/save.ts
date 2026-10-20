import { CAR_MODELS, type CarModel } from "./vehicles";
import { WEAPONS, type Weapon } from "./weapons";

export type SaveDifficulty = "easy" | "normal" | "hard";
const DIFFICULTIES: SaveDifficulty[] = ["easy", "normal", "hard"];

export const SAVE_KEY = "solarabay.save.v1";
export const SAVE_VERSION = 1;
export const AUTOSAVE_EVERY = 60; // seconds

export interface SaveCar { model: CarModel; color: string; hp: number; maxHp: number; mass: number; x: number; y: number; a: number; }
export interface SaveStats { playTime: number; carsStolen: number; pedsHit: number; deaths: number; arrests: number; maxStars: number; }
export interface SaveData {
  v: typeof SAVE_VERSION;
  savedAt: number;
  difficulty: SaveDifficulty;
  onFoot: boolean;
  ped: { x: number; y: number; a: number; hp: number };
  car: SaveCar | null; // null: the player's car was destroyed
  cash: number; rockets: number; bombs: number; weapon: Weapon;
  stats: SaveStats;
}
export type SaveResult = "saved" | "memory" | "wanted" | "busy" | "mode";

export const emptyStats = (): SaveStats => ({ playTime: 0, carsStolen: 0, pedsHit: 0, deaths: 0, arrests: 0, maxStars: 0 });

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
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function loadSave(): SaveData | null {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(SAVE_KEY); } catch { /* ignore */ }
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

function validate(d: unknown): SaveData | null {
  if (!isObj(d) || d.v !== SAVE_VERSION) return null;
  const p = d.ped, st = d.stats;
  if (!isObj(p) || !num(p.x) || !num(p.y) || !num(p.a) || !num(p.hp)) return null;
  if (!num(d.savedAt) || !num(d.cash) || !num(d.rockets) || !num(d.bombs) || typeof d.onFoot !== "boolean") return null;
  if (!oneOf(d.weapon, WEAPONS) || !oneOf(d.difficulty, DIFFICULTIES)) return null;
  let car: SaveCar | null = null;
  if (d.car !== null) {
    const c = d.car;
    if (!isObj(c) || !oneOf(c.model, CAR_MODELS) || typeof c.color !== "string" || !/^#[0-9a-f]{6}$/i.test(c.color)) return null;
    if (!num(c.hp) || !num(c.maxHp) || !num(c.mass) || !num(c.x) || !num(c.y) || !num(c.a)) return null;
    car = { model: c.model, color: c.color, hp: c.hp, maxHp: c.maxHp, mass: c.mass, x: c.x, y: c.y, a: c.a };
  }
  const stats = emptyStats();
  if (isObj(st)) for (const k of Object.keys(stats) as (keyof SaveStats)[]) { const v = st[k]; if (num(v)) stats[k] = v; }
  return {
    v: SAVE_VERSION, savedAt: d.savedAt, difficulty: d.difficulty, onFoot: d.onFoot,
    ped: { x: p.x, y: p.y, a: p.a, hp: p.hp }, car,
    cash: Math.max(0, d.cash), rockets: Math.max(0, d.rockets), bombs: Math.max(0, d.bombs), weapon: d.weapon, stats,
  };
}
