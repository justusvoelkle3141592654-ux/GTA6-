import type { ModalInfo } from "../core/engine";

type Lift = Extract<ModalInfo, { kind: "lift" }>;

// the buttons in the mall's lift: one per floor (keys 1-3 work as well), Esc closes
export default function LiftPanel({ d, onPick, onClose }: { d: Lift; onPick: (i: number) => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="popin w-full max-w-xs rounded-2xl border border-white/15 bg-black/85 p-4 backdrop-blur">
        <div className="font-display text-2xl tracking-widest text-white">AUFZUG</div>
        <div className="mt-3 flex flex-col-reverse gap-2">
          {d.floors.map((name, i) => (
            <button key={i} disabled={i === d.at} onClick={() => onPick(i)}
              className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-left font-semibold text-white transition-all hover:bg-white/20 active:scale-95 disabled:opacity-40">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400/90 font-display text-xl text-black">{i}</span>
              {name}{i === d.at ? " · hier" : ""}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-3 w-full rounded-xl px-4 py-2 text-sm text-white/60 hover:text-white">Schließen (Esc)</button>
      </div>
    </div>
  );
}
