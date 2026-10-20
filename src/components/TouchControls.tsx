import { useRef, useState } from "react";
import type { TouchInput, Weapon } from "../game/engine";

interface Props {
  input: TouchInput;
  nitro01: number;
  relative?: boolean;
  onFoot: boolean;
  weapon: Weapon;
  rockets: number;
  bombs: number;
  bombsPlaced: number;
  onCycleWeapon: () => void;
  onDetonate: () => void;
}

const RADIUS = 60;
const WICON: Record<Weapon, string> = { pistol: "🔫", rocket: "🚀", bomb: "💣" };

export default function TouchControls({ input, nitro01, relative = false, onFoot, weapon, rockets, bombs, bombsPlaced, onCycleWeapon, onDetonate }: Props) {
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

  const btn = (label: string, active: boolean, set: (v: boolean) => void, key: "drift" | "nitro" | "fire", color: string, size = "h-20 w-20", extra?: React.ReactNode) => (
    <div
      className={`relative flex ${size} select-none items-center justify-center rounded-full border-2 font-display text-xl tracking-wider text-white transition-transform`}
      style={{ borderColor: color, background: active ? color + "88" : "rgba(10,6,20,0.45)", boxShadow: active ? `0 0 26px ${color}` : `0 0 10px ${color}55`, transform: active ? "scale(0.92)" : "scale(1)" }}
      onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); input[key] = true; set(true); }}
      onPointerUp={() => { input[key] = false; set(false); }}
      onPointerCancel={() => { input[key] = false; set(false); }}
    >
      {extra}
      <span className="relative">{label}</span>
    </div>
  );

  const ammo = weapon === "rocket" ? rockets : weapon === "bomb" ? bombs : "∞";

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-auto absolute bottom-0 left-0 top-24 w-[55%]" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {!stick && (
          <div className="absolute bottom-10 left-8 flex h-32 w-32 items-center justify-center rounded-full border-2 border-white/15 bg-white/5">
            <div className="h-12 w-12 rounded-full border-2 border-pink-400/50 bg-pink-500/20" />
            <span className="absolute -top-6 whitespace-nowrap text-[11px] font-semibold uppercase tracking-widest text-white/40">{onFoot ? "Laufen" : relative ? "↑ Gas · ↔ Lenken" : "Lenken"}</span>
          </div>
        )}
        {stick && (
          <div className="fixed flex h-32 w-32 items-center justify-center rounded-full border-2 border-white/25 bg-white/5" style={{ left: stick.x - 64, top: stick.y - 64 }}>
            <div className="h-14 w-14 rounded-full border-2 border-pink-300 bg-pink-500/50 shadow-[0_0_20px_rgba(255,60,172,0.8)]" style={{ transform: `translate(${stick.kx}px, ${stick.ky}px)` }} />
          </div>
        )}
      </div>

      <div className="pointer-events-auto absolute bottom-6 right-4 flex items-end gap-3">
        <div className="flex flex-col items-center gap-3">
          {bombsPlaced > 0 && (
            <button onPointerDown={(e) => { e.stopPropagation(); onDetonate(); }} className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full border-2 border-red-400 bg-red-600/70 text-2xl shadow-[0_0_24px_rgba(255,40,60,0.9)] active:scale-90">💥</button>
          )}
          <button onPointerDown={(e) => { e.stopPropagation(); onCycleWeapon(); }} className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl border-2 border-white/30 bg-black/50 active:scale-90">
            <span className="text-2xl leading-none">{WICON[weapon]}</span>
            <span className="mt-0.5 font-display text-sm tracking-wider text-white/80">{ammo}</span>
          </button>
          {!onFoot && btn("DRIFT", drift, setDrift, "drift", "#ff3cac", "h-16 w-16")}
        </div>
        <div className="flex flex-col items-center gap-3">
          {btn(onFoot ? "SPRINT" : "NITRO", nitro, setNitro, "nitro", "#2bf0ff", "h-16 w-16",
            !onFoot ? (
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#2bf0ff" strokeWidth="4" strokeDasharray={`${nitro01 * 226} 226`} opacity="0.9" />
              </svg>
            ) : undefined)}
          {btn("FEUER", fire, setFire, "fire", "#ff5a2a", "h-24 w-24")}
        </div>
      </div>
    </div>
  );
}
