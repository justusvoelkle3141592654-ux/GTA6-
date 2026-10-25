import type { ModalInfo } from "../core/engine";
import { currentSettings } from "../core/settings";
import { tone } from "./palette";

type Dialog = Extract<ModalInfo, { kind: "dialog" }>;

// story dialog: speaker, text, tap / E / Enter to continue
export default function DialogBox({ d, isTouch, onNext }: { d: Dialog; isTouch: boolean; onNext: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center p-4 pb-8" onPointerDown={(e) => { e.stopPropagation(); onNext(); }}>
      {/* cinematic bars; the line of the speaker sits on the lower one like a subtitle */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[12%] min-h-10 bg-ink-950" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[12%] min-h-10 bg-ink-950" />
      <div key={d.index} className="popin relative w-full max-w-2xl cursor-pointer rounded-[6px] border border-white/10 bg-ink-950/85 px-4 py-3" style={{ boxShadow: `inset 3px 0 0 ${tone(d.color)}` }}>
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-display text-xl tracking-[0.14em]" style={{ color: tone(d.color) }}>{d.speaker}</div>
          <div className="sb-note">{d.index + 1}/{d.count} · {isTouch ? "Tippen" : "E / Enter"} = weiter</div>
        </div>
        <div className="mt-1 leading-relaxed text-fog-100" style={{ fontSize: `${(isTouch ? 16 : 18) * currentSettings.subtitle}px` }}>{d.text}</div>
      </div>
    </div>
  );
}
