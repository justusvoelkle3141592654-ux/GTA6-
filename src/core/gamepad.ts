// controllers through the Gamepad API (standard layout, e.g. Xbox / PlayStation pads):
// buttons act like the bound keys, the sticks and triggers are analog; in menus the d-pad moves the focus
import type { Action } from "./input";

// button index (standard mapping) -> action; in the car some buttons mean something else (see carAction)
const FOOT: Partial<Record<number, Action>> = {
  0: "enter", 1: "handbrake", 2: "reload", 3: "camera", 4: "nextWeapon", 5: "nitro", 7: "fire",
  8: "map", 9: "pause", 10: "radio", 11: "wheel", 12: "job", 13: "detonate", 14: "radio", 15: "phone",
};
const CAR: Partial<Record<number, Action>> = { 2: "fire", 7: "up", 6: "down" }; // X shoots from the car, triggers: gas and brake
export const PAD_LABEL: Partial<Record<Action, string>> = {
  enter: "A", handbrake: "B", reload: "X", camera: "Y", nextWeapon: "LB", nitro: "RB", fire: "RT (im Auto X)", up: "RT / linker Stick",
  down: "LT / linker Stick", map: "Back", pause: "Start", radio: "L3 / Steuerkreuz links", wheel: "R3", job: "Steuerkreuz oben", detonate: "Steuerkreuz unten", phone: "Steuerkreuz rechts",
};

export interface PadState { active: boolean; lx: number; ly: number; rx: number; ry: number; lt: number; rt: number; name: string }
const DEAD = 0.18;
const dz = (v: number) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

export class Gamepads {
  state: PadState = { active: false, lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, name: "" };
  private prev: boolean[] = [];
  private repeatT = 0;
  // press / release: the engine turns these into key events of the bound keys
  constructor(private press: (a: Action) => void, private release: (a: Action) => void) {}

  poll(dt: number, inCar: boolean, inMenu: boolean) {
    const list = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    let gp: Gamepad | null = null;
    for (const g of list) if (g && g.connected) { gp = g; break; }
    const s = this.state;
    if (!gp) { if (s.active) this.releaseAll(inCar); s.active = false; return; }
    s.active = true; s.name = gp.id;
    s.lx = dz(gp.axes[0] ?? 0); s.ly = dz(gp.axes[1] ?? 0); s.rx = dz(gp.axes[2] ?? 0); s.ry = dz(gp.axes[3] ?? 0);
    s.lt = gp.buttons[6]?.value ?? 0; s.rt = gp.buttons[7]?.value ?? 0;
    if (inMenu) { this.menu(gp, dt); return; }
    gp.buttons.forEach((b, i) => {
      const down = b.pressed || b.value > 0.5, was = this.prev[i] ?? false;
      this.prev[i] = down;
      if (down === was) return;
      const a = (inCar ? CAR[i] : undefined) ?? FOOT[i];
      if (!a || ((i === 6 || i === 7) && inCar)) return; // the triggers are read as analog values in the car
      if (down) this.press(a); else this.release(a);
    });
  }
  private releaseAll(inCar: boolean) {
    this.prev.forEach((d, i) => { if (!d) return; const a = (inCar ? CAR[i] : undefined) ?? FOOT[i]; if (a) this.release(a); });
    this.prev = [];
  }

  // menus: d-pad / left stick move the focus between the buttons on screen, A presses, B goes back, Start closes the pause menu
  private menu(gp: Gamepad, dt: number) {
    const pressed = (i: number) => { const d = !!gp.buttons[i]?.pressed, was = this.prev[i] ?? false; this.prev[i] = d; return d && !was; };
    const a = pressed(0), b = pressed(1), start = pressed(9);
    const ux = (gp.buttons[15]?.pressed ? 1 : 0) - (gp.buttons[14]?.pressed ? 1 : 0) || Math.round(this.state.lx);
    const uy = (gp.buttons[13]?.pressed ? 1 : 0) - (gp.buttons[12]?.pressed ? 1 : 0) || Math.round(this.state.ly);
    this.repeatT -= dt;
    if ((ux || uy) && this.repeatT <= 0) { this.repeatT = 0.22; moveFocus(ux, uy); }
    if (!ux && !uy) this.repeatT = 0;
    if (a) (document.activeElement as HTMLElement | null)?.click();
    if (b || start) window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape" }));
  }
}

// nearest visible button in the pressed direction
function moveFocus(dx: number, dy: number) {
  const els = [...document.querySelectorAll<HTMLElement>("button:not([disabled]), input, select")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  if (!els.length) return;
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || !els.includes(cur)) { els[0].focus(); return; }
  const r0 = cur.getBoundingClientRect(), x0 = r0.left + r0.width / 2, y0 = r0.top + r0.height / 2;
  let best: HTMLElement | null = null, bd = Infinity;
  for (const e of els) {
    if (e === cur) continue;
    const r = e.getBoundingClientRect(), x = r.left + r.width / 2 - x0, y = r.top + r.height / 2 - y0;
    const along = x * dx + y * dy, side = Math.abs(x * dy - y * dx);
    if (along <= 2) continue;
    const d = along + side * 2;
    if (d < bd) { bd = d; best = e; }
  }
  best?.focus();
  best?.scrollIntoView({ block: "nearest" });
}
