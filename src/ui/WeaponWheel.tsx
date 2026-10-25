import { WEAPONS, WEAPON_DEFS, type Weapon } from "../gameplay/weapons";
import { WeaponIcon } from "./ui";

// all weapons on a circle; the ones you carry can be picked (click / tap); Tab released or Esc closes
export default function WeaponWheel({ owned, current, onPick, onClose }: { owned: Weapon[]; current: Weapon; onPick: (w: Weapon) => void; onClose: () => void }) {
  const R = 120;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink-950/55" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative h-80 w-80">
        <div className="pointer-events-none absolute inset-8 rounded-full border border-white/15 bg-ink-950/60" />
        <div className="pointer-events-none absolute inset-[5.5rem] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="flex justify-center text-sun-400"><WeaponIcon w={current} size={32} /></div>
          <div className="sb-h3 mt-0.5">{WEAPON_DEFS[current].name}</div>
        </div>
        {WEAPONS.map((w, i) => {
          const a = (i / WEAPONS.length) * Math.PI * 2 - Math.PI / 2, has = owned.includes(w);
          return (
            <button key={w} disabled={!has} onClick={() => onPick(w)} style={{ left: 160 + Math.cos(a) * R - 32, top: 160 + Math.sin(a) * R - 32 }}
              className={"absolute flex h-16 w-16 flex-col items-center justify-center rounded-full border transition active:scale-90 " + (w === current ? "border-sun-500 bg-sun-500/20 text-sun-300" : has ? "border-white/25 bg-ink-900/80 text-fog-100 hover:border-white/50" : "border-white/5 bg-ink-950/40 text-fog-700")}>
              <WeaponIcon w={w} size={24} />
              <span className="mt-0.5 text-[9px] text-fog-300">{WEAPON_DEFS[w].name.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
