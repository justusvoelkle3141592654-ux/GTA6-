import { useRef, useState } from "react";
import type { TouchInput, Weapon } from "../core/engine";
import { WeaponIcon } from "./ui";
import Icon from "./icons";
import { currentSettings } from "../core/settings";

interface Props {
  input: TouchInput;
  nitro01: number;
  relative?: boolean;
  onFoot: boolean;
  flying?: boolean; // helicopter: DRIFT = climb, NITRO = descend
  jet?: boolean;    // fighter jet: a missile button
  weapon: Weapon;
  ammo: string;
  bombsPlaced: number;
  onCycleWeapon: () => void;
  onWheel: () => void;
  onDetonate: () => void;
  onLook: (dx: number, dy: number) => void; // swiping on the right half turns the camera
  jump?: boolean;   // springs in the shoes (code): a jump button on foot
  canEnter?: boolean; // on foot next to a vehicle
  onToggleCar: () => void;
}

const RADIUS = 60;
const LONG_PRESS = 420; // ms: holding the weapon button opens the wheel

export default function TouchControls({ input, nitro01, relative = false, onFoot, flying = false, jet = false, weapon, ammo, bombsPlaced, onCycleWeapon, onWheel, onDetonate, onLook, jump = false, canEnter = false, onToggleCar }: Props) {
  const hs = currentSettings.hudScale; // the HUD size setting scales the touch controls too
  // camera: one finger swiping over the free right half of the screen
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  const lookDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (look.current) return;
    look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const lookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const l = look.current;
    if (!l || l.id !== e.pointerId) return;
    onLook((e.clientX - l.x) * 1.6, (e.clientY - l.y) * 1.2);
    l.x = e.clientX; l.y = e.clientY;
  };
  const lookUp = (e: React.PointerEvent<HTMLDivElement>) => { if (look.current?.id === e.pointerId) look.current = null; };
  const pressT = useRef<number | null>(null);
  const weaponDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    pressT.current = window.setTimeout(() => { pressT.current = null; onWheel(); }, LONG_PRESS);
  };
  const weaponUp = () => { if (pressT.current !== null) { clearTimeout(pressT.current); pressT.current = null; onCycleWeapon(); } };
  const [stick, setStick] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null);
  const pid = useRef<number | null>(null);
  const [drift, setDrift] = useState(false);
  const [nitro, setNitro] = useState(false);
  const [fire, setFire] = useState(false);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pid.current !== null) return;
    pid.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setStick({ x: e.clientX, y: e.clientY, kx: 0, ky: 0 });
    input.active = true; input.jx = 0; input.jy = 0;
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pid.current !== e.pointerId || !stick) return;
    let dx = e.clientX - stick.x, dy = e.clientY - stick.y;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) { dx = (dx / d) * RADIUS; dy = (dy / d) * RADIUS; }
    input.jx = dx / RADIUS; input.jy = dy / RADIUS;
    setStick({ ...stick, kx: dx, ky: dy });
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    setStick(null);
    input.active = false; input.jx = 0; input.jy = 0;
  };

  // round action button: dark glass, gold when pressed (fire: red); pointer capture keeps it pressed while the finger slides
  const btn = (label: string, active: boolean, set: (v: boolean) => void, key: "drift" | "nitro" | "fire", size = "h-16 w-16", extra?: React.ReactNode) => (
    <div
      className={`relative flex ${size} select-none items-center justify-center rounded-full border font-display text-lg tracking-[0.1em] transition-[transform,background-color] duration-100`}
      style={{
        borderColor: key === "fire" ? "rgba(224,70,75,0.75)" : active ? "var(--color-sun-400)" : "rgba(255,255,255,0.24)",
        background: active ? (key === "fire" ? "rgba(224,70,75,0.85)" : "rgba(230,165,54,0.88)") : "rgba(9,12,16,0.55)",
        color: active && key !== "fire" ? "var(--color-ink-950)" : "var(--color-fog-100)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.35)", transform: active ? "scale(0.93)" : "scale(1)",
      }}
      onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); input[key] = true; set(true); }}
      onPointerUp={() => { input[key] = false; set(false); }}
      onPointerCancel={() => { input[key] = false; set(false); }}
      onLostPointerCapture={() => { input[key] = false; set(false); }}
    >
      {extra}
      <span className="relative">{label}</span>
    </div>
  );
  const square = "flex h-14 w-14 flex-col items-center justify-center rounded-[6px] border border-white/25 bg-ink-950/55 shadow-[0_4px_14px_rgba(0,0,0,0.35)] active:scale-[0.93]";

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-auto absolute bottom-0 left-0 top-24 w-[55%]" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {!stick && (
          <div className="absolute flex h-32 w-32 items-center justify-center rounded-full border border-white/20 bg-ink-950/25"
            style={{ left: "calc(var(--sal) + 26px)", bottom: "calc(var(--sab) + 30px)", transform: `scale(${hs})`, transformOrigin: "bottom left" }}>
            <div className="h-12 w-12 rounded-full border border-white/40 bg-fog-100/15" />
            <span className="sb-hud-text absolute -top-5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-fog-500">{onFoot ? "Laufen" : relative ? "Gas · Lenken" : "Lenken"}</span>
          </div>
        )}
        {stick && (
          <div className="fixed flex h-32 w-32 items-center justify-center rounded-full border border-white/25 bg-ink-950/25" style={{ left: stick.x - 64, top: stick.y - 64, transform: `scale(${hs})` }}>
            <div className="h-14 w-14 rounded-full border-2 border-sun-400 bg-fog-100/80" style={{ transform: `translate(${stick.kx / hs}px, ${stick.ky / hs}px)` }} />
          </div>
        )}
      </div>

      <div className="pointer-events-auto absolute bottom-0 right-0 top-24 w-[45%] touch-none" onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp}>
        <span className="sb-hud-text absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-fog-500/80">Wischen: Kamera</span>
      </div>
      <div className="pointer-events-auto absolute flex items-end gap-2.5" style={{ right: "calc(var(--sar) + 14px)", bottom: "calc(var(--sab) + 18px)", transform: `scale(${hs})`, transformOrigin: "bottom right" }}>
        <button onPointerDown={(e) => { e.stopPropagation(); onToggleCar(); }} className={square + (onFoot && canEnter ? " border-sun-400 bg-sun-500/25" : "")} aria-label={onFoot ? "Einsteigen" : "Aussteigen"}>
          <Icon name={onFoot ? "car" : "exit"} size={22} />
          <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-fog-300">{onFoot ? "Rein" : "Raus"}</span>
        </button>
        <div className="flex flex-col items-center gap-2.5">
          {jet && (
            <button onPointerDown={(e) => { e.stopPropagation(); onDetonate(); }} className={square + " border-alert-500/80 bg-alert-500/30"} aria-label="Rakete"><Icon name="boom" size={22} /><span className="text-[9px] font-bold tracking-wider">RAKETE</span></button>
          )}
          {bombsPlaced > 0 && (
            <button onPointerDown={(e) => { e.stopPropagation(); onDetonate(); }} className={square + " sb-blink border-alert-500 bg-alert-500/40"} aria-label="Zünden"><Icon name="boom" size={24} /><span className="text-[9px] font-bold tracking-wider">ZÜNDEN</span></button>
          )}
          <button onPointerDown={weaponDown} onPointerUp={weaponUp} onPointerCancel={weaponUp} className={square} aria-label="Waffe wechseln, halten für Waffenrad">
            <WeaponIcon w={weapon} size={24} />
            <span className="sb-num mt-0.5 text-xs text-fog-300">{ammo}</span>
          </button>
          {(!onFoot || flying || jump) && btn(flying ? "HOCH" : onFoot ? "SPRUNG" : "DRIFT", drift, setDrift, "drift")}
        </div>
        <div className="flex flex-col items-center gap-2.5">
          {btn(flying ? "RUNTER" : onFoot ? "SPRINT" : "NITRO", nitro, setNitro, "nitro", "h-16 w-16",
            !onFoot && !flying ? (
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="37" fill="none" stroke="var(--color-sun-400)" strokeWidth="3" strokeDasharray={`${nitro01 * 232} 232`} opacity="0.95" />
              </svg>
            ) : undefined)}
          {btn("FEUER", fire, setFire, "fire", "h-[5.5rem] w-[5.5rem]")}
        </div>
      </div>
    </div>
  );
}
