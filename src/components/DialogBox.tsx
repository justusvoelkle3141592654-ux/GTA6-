import type { ModalInfo } from "../game/engine";

type Dialog = Extract<ModalInfo, { kind: "dialog" }>;

// story dialog: speaker, text, tap / E / Enter to continue
export default function DialogBox({ d, isTouch, onNext }: { d: Dialog; isTouch: boolean; onNext: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center p-4 pb-8" onPointerDown={(e) => { e.stopPropagation(); onNext(); }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-black sm:h-20" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-black sm:h-20" />
      <div key={d.index} className="popin relative w-full max-w-2xl cursor-pointer rounded-2xl border border-white/15 bg-black/80 p-4 backdrop-blur">
        <div className="font-display text-2xl tracking-widest" style={{ color: d.color }}>{d.speaker}</div>
        <div className="mt-1 text-base leading-relaxed text-white/90 sm:text-lg">{d.text}</div>
        <div className="mt-2 text-right text-xs text-white/45">{d.index + 1}/{d.count} · {isTouch ? "Tippen" : "E / Enter"} = weiter</div>
      </div>
    </div>
  );
}
