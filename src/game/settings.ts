import { sfx, CHANNELS, type Channel } from "./audio";

// player settings that are not part of a save game
export interface Settings { volume: Record<Channel, number>; tips: boolean; shake: boolean; }

const KEY = "solarabay.settings.v1";
export const defaultSettings = (): Settings => ({ volume: { master: 1, effects: 1, engine: 1, radio: 0.7 }, tips: true, shake: true });

export function loadSettings(): Settings {
  const s = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return s;
    const d = JSON.parse(raw) as Partial<Settings>;
    if (d.volume) for (const ch of CHANNELS) { const v = d.volume[ch]; if (typeof v === "number" && Number.isFinite(v)) s.volume[ch] = Math.max(0, Math.min(1, v)); }
    if (typeof d.tips === "boolean") s.tips = d.tips;
    if (typeof d.shake === "boolean") s.shake = d.shake;
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
