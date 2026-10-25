// keyboard bindings (rebindable in the settings, stored in localStorage)
export type Action =
  | "up" | "down" | "left" | "right" | "handbrake" | "nitro" | "fire" | "enter"
  | "nextWeapon" | "wheel" | "reload" | "detonate" | "camera" | "zoom" | "radio" | "job" | "phone" | "map" | "pause" | "heal" | "binoc";

export const ACTIONS: Action[] = ["up", "down", "left", "right", "handbrake", "nitro", "fire", "enter", "nextWeapon", "wheel", "reload", "detonate", "camera", "zoom", "radio", "job", "phone", "map", "pause", "heal", "binoc"];

export const ACTION_LABEL: Record<Action, string> = {
  up: "Gas / vorwärts", down: "Bremse / rückwärts", left: "Links", right: "Rechts", handbrake: "Handbremse / Drift · Hubschrauber steigen",
  nitro: "Nitro / Sprint · Hubschrauber sinken", fire: "Feuer", enter: "Einsteigen / Aussteigen / Betreten", nextWeapon: "Nächste Waffe",
  wheel: "Waffenrad (halten)", reload: "Nachladen", detonate: "Haftbomben zünden", camera: "Kamera wechseln", zoom: "Kamera nah / weit",
  radio: "Radiosender", job: "Jobs (Menü) / Job beenden", phone: "Handy", map: "Karte", pause: "Pause",
  heal: "Erste-Hilfe-Set benutzen", binoc: "Fernglas",
};

// the first key of each list is the one you can rebind; the others stay as alternatives
export const DEFAULT_KEYS: Record<Action, string[]> = {
  up: ["KeyW", "ArrowUp"], down: ["KeyS", "ArrowDown"], left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
  handbrake: ["Space"], nitro: ["ShiftLeft", "ShiftRight"], fire: ["KeyF", "ControlLeft", "ControlRight"], enter: ["KeyE"],
  nextWeapon: ["KeyQ"], wheel: ["Tab"], reload: ["KeyR"], detonate: ["KeyG"], camera: ["KeyC", "KeyV"], zoom: ["KeyX"], radio: ["KeyN"], job: ["KeyJ"], phone: ["KeyT"],
  map: ["KeyM"], pause: ["KeyP", "Escape"], heal: ["KeyH"], binoc: ["KeyZ"],
};

const KEY = "solarabay.keys.v1";

export class Bindings {
  keys: Record<Action, string[]> = clone(DEFAULT_KEYS);

  constructor() { this.load(); }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as unknown;
      if (typeof d !== "object" || d === null) return;
      for (const a of ACTIONS) {
        const v = (d as Record<string, unknown>)[a];
        if (typeof v === "string" && v) this.keys[a] = [v, ...DEFAULT_KEYS[a].slice(1).filter((k) => k !== v)];
      }
    } catch { /* ignore */ }
  }

  private persist() {
    const out: Partial<Record<Action, string>> = {};
    for (const a of ACTIONS) out[a] = this.keys[a][0];
    try { localStorage.setItem(KEY, JSON.stringify(out)); } catch { /* ignore */ }
  }

  // give an action a new main key; the key is taken away from any other action
  set(a: Action, code: string) {
    if (code === "Escape") return;
    for (const o of ACTIONS) if (o !== a) this.keys[o] = this.keys[o].filter((k) => k !== code);
    this.keys[a] = [code, ...this.keys[a].slice(1).filter((k) => k !== code)];
    this.persist();
  }

  reset() { this.keys = clone(DEFAULT_KEYS); try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

  is(a: Action, code: string) { return this.keys[a].includes(code); }
  held(a: Action, down: Set<string>) { for (const k of this.keys[a]) if (down.has(k)) return true; return false; }
  label(a: Action) { return keyLabel(this.keys[a][0]); }
}

function clone(k: Record<Action, string[]>): Record<Action, string[]> {
  const out = {} as Record<Action, string[]>;
  for (const a of ACTIONS) out[a] = [...k[a]];
  return out;
}

export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const names: Record<string, string> = {
    Space: "Leertaste", ShiftLeft: "Shift", ShiftRight: "Shift rechts", ControlLeft: "Strg", ControlRight: "Strg rechts",
    AltLeft: "Alt", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Tab: "Tab", Escape: "Esc", Enter: "Enter",
    Backspace: "Rücktaste", CapsLock: "Feststell",
  };
  return names[code] ?? code;
}
