import { sfx, CHANNELS, type Channel } from "../audio/audio";

// player settings that are not part of a save game
export interface Settings {
  volume: Record<Channel, number>; tips: boolean; shake: boolean;
  dayMinutes: 12 | 24 | 48;   // real minutes per game day
  weather: boolean;           // changing weather (off: always sunny)
  viewDist: number;           // 0.6 .. 1.4 times the normal view distance
  shadows: boolean;
  hudScale: number;           // 0.8 .. 1.3
  subtitle: number;           // dialog text size 0.8 .. 1.4
  camSens: number;            // camera / aim sensitivity 0.5 .. 2
  invertY: boolean;
  mapRotate: boolean;         // the minimap turns with you
  seekerCones: boolean;       // hide and seek: show the seekers' view on the minimap
  vehSpeed: number;           // multiplier for the top speed and pull of your own vehicle 1 .. 5
  traffic: number;            // multiplier for the number of cars driving around 0 .. 3
  camNear: boolean;           // the follow camera stays close (people and cars look bigger)
  jailSec: number;            // seconds in the cell after being busted 1 .. 3600
}

const KEY = "solarabay.settings.v1";
export const defaultSettings = (): Settings => ({
  volume: { master: 1, effects: 1, engine: 1, radio: 0.7 }, tips: true, shake: true,
  dayMinutes: 24, weather: true, viewDist: 1, shadows: true, hudScale: 1, subtitle: 1, camSens: 1, invertY: false, mapRotate: false, seekerCones: true, vehSpeed: 1, traffic: 1, camNear: true, jailSec: 30,
});

export function loadSettings(): Settings {
  const s = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return s;
    const d = JSON.parse(raw) as Partial<Settings>;
    if (d.volume) for (const ch of CHANNELS) { const v = d.volume[ch]; if (typeof v === "number" && Number.isFinite(v)) s.volume[ch] = Math.max(0, Math.min(1, v)); }
    if (typeof d.tips === "boolean") s.tips = d.tips;
    if (typeof d.shake === "boolean") s.shake = d.shake;
    if (d.dayMinutes === 12 || d.dayMinutes === 24 || d.dayMinutes === 48) s.dayMinutes = d.dayMinutes;
    const num = (v: unknown, a: number, b: number, def: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : def);
    s.viewDist = num(d.viewDist, 0.6, 1.4, 1); s.hudScale = num(d.hudScale, 0.8, 1.3, 1); s.subtitle = num(d.subtitle, 0.8, 1.4, 1); s.camSens = num(d.camSens, 0.5, 2, 1);
    s.vehSpeed = num(d.vehSpeed, 1, 5, 1); s.traffic = num(d.traffic, 0, 3, 1); s.jailSec = Math.round(num(d.jailSec, 1, 3600, 30));
    for (const k of ["weather", "shadows", "invertY", "mapRotate", "seekerCones", "camNear"] as const) if (typeof d[k] === "boolean") s[k] = d[k] as boolean;
  } catch { /* ignore */ }
  return s;
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// push the settings into the running systems
export let currentSettings: Settings = defaultSettings();
export function applySettings(s: Settings) {
  currentSettings = s;
  for (const ch of CHANNELS) sfx.setVolume(ch, s.volume[ch]);
}

export const CHANNEL_LABEL: Record<Channel, string> = { master: "Gesamt", effects: "Effekte", engine: "Motor", radio: "Radio" };
