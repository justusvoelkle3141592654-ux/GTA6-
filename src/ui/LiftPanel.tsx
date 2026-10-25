import type { ModalInfo } from "../core/engine";

type Lift = Extract<ModalInfo, { kind: "lift" }>;

// the buttons in the mall's lift: one per floor (keys 1-3 work as well), Esc closes
export default function LiftPanel({ d, onPick, onClose }: { d: Lift; onPick: (i: number) => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* scrolls when there are more floors than fit (the tower on a phone held sideways) */}
      <div className="popin sb-panel flex max-h-full w-full max-w-sm flex-col p-4">
        <div className="sb-eyebrow">Etage wählen</div>
        <div className="sb-title text-3xl">Aufzug</div>
        <div className={"mt-3 min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain " + (d.floors.length > 4 ? "grid grid-cols-2 gap-2" : "flex flex-col-reverse gap-2")}>
          {(d.floors.length > 4 ? d.floors.map((name, i) => ({ name, i })).reverse() : d.floors.map((name, i) => ({ name, i }))).map(({ name, i }) => (
            <button key={i} disabled={i === d.at} onClick={() => onPick(i)}
              className="sb-row text-left text-sm font-semibold text-fog-100 transition-colors hover:bg-white/[0.07] active:scale-[0.98] disabled:border-sun-500/50 disabled:bg-sun-500/10">
              <span className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] font-display text-xl " + (i === d.at ? "bg-sun-500 text-ink-950" : "border border-white/20 text-fog-100")}>{i}</span>
              {name}{i === d.at ? " · hier" : ""}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="sb-btn sb-btn-ghost mt-3 w-full">Schließen</button>
      </div>
    </div>
  );
}
