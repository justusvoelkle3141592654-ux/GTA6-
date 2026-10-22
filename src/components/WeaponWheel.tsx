import { WEAPONS, WEAPON_DEFS, type Weapon } from "../game/weapons";
import { WeaponIcon } from "./ui";

// all weapons on a circle; the ones you carry can be picked (click / tap); Tab released or Esc closes
export default function WeaponWheel({ owned, current, onPick, onClose }: { owned: Weapon[]; current: Weapon; onPick: (w: Weapon) => void; onClose: () => void }) {
  const R = 120;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 backdrop-blur-[2px]" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative h-80 w-80">
        <div className="absolute inset-8 rounded-full border-2 border-white/15 bg-black/40" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="flex justify-center"><WeaponIcon w={current} size={34} /></div>
          <div className="font-display text-xl tracking-wider">{WEAPON_DEFS[current].name}</div>
        </div>
        {WEAPONS.map((w, i) => {
          const a = (i / WEAPONS.length) * Math.PI * 2 - Math.PI / 2, has = owned.includes(w);
          return (
            <button key={w} disabled={!has} onClick={() => onPick(w)} style={{ left: 160 + Math.cos(a) * R - 32, top: 160 + Math.sin(a) * R - 32 }}
              className={"absolute flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 transition active:scale-90 " + (w === current ? "border-pink-400 bg-pink-500/40" : has ? "border-white/30 bg-black/60 hover:border-white" : "border-white/5 bg-black/30 opacity-30")}>
              <WeaponIcon w={w} size={26} />
              <span className="mt-0.5 text-[9px] text-white/70">{WEAPON_DEFS[w].name.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
