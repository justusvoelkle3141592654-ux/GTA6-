import { useState } from "react";
import type { Game } from "../core/engine";
import { CHEATS, CHEAT_PIN } from "../gameplay/cheats";
import Icon from "./icons";

// phone app "Codes": first the PIN, then cheat codes (typed in, or picked from the code book)
export default function CodesApp({ game }: { game: Game }) {
  const [pin, setPin] = useState("");
  const [open, setOpen] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [book, setBook] = useState(false);
  const [, redraw] = useState(0);

  if (!open) {
    const press = (d: string) => {
      setWrong(false);
      const next = (pin + d).slice(0, CHEAT_PIN.length);
      setPin(next);
      if (next.length === CHEAT_PIN.length) {
        if (next === CHEAT_PIN) setOpen(true);
        else { setWrong(true); setPin(""); }
      }
    };
    return (
      <div className="flex flex-col items-center py-2">
        <Icon name="lock" size={28} />
        <div className="mt-2 text-sm font-semibold text-white/80">PIN eingeben</div>
        <div className="mt-3 flex gap-2">
          {Array.from({ length: CHEAT_PIN.length }, (_, i) => <span key={i} className={"h-3 w-3 rounded-full border border-white/60 " + (i < pin.length ? "bg-white" : "")} />)}
        </div>
        <div className="mt-1 h-5 text-xs text-red-400">{wrong ? "Falsche PIN" : ""}</div>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d, i) => d === "" ? <span key={i} /> : (
            <button key={i} onClick={() => (d === "⌫" ? setPin(pin.slice(0, -1)) : press(d))} className="h-14 w-14 rounded-full bg-white/10 font-display text-2xl text-white active:bg-white/30">{d}</button>
          ))}
        </div>
      </div>
    );
  }

  const go = (c = code) => { setMsg(game.cheat(c)); setCode(""); redraw((n) => n + 1); };
  const groups = [...new Set(CHEATS.map((c) => c.group))];
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-sm bg-black/65 p-3">
        <div className="mb-2 font-display text-xl tracking-widest">Code eingeben</div>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { (e.target as HTMLInputElement).blur(); return; } e.stopPropagation(); if (e.key === "Enter") go(); }} placeholder="Code"
            autoCapitalize="characters" autoComplete="off" spellCheck={false}
            className="min-w-0 flex-1 rounded-sm border border-white/20 bg-white/10 px-3 py-2 font-bold uppercase tracking-widest text-white placeholder:text-white/30" />
          <button onClick={() => go()} className="rounded-sm bg-white px-4 py-2 font-display text-lg tracking-widest text-black">OK</button>
        </div>
        {msg && <div className="mt-2 text-white/90">{msg}</div>}
        <button onClick={() => setBook(!book)} className="mt-2 text-xs text-white/60 underline">{book ? "Codebuch schließen" : `Codebuch (${CHEATS.length} Codes)`}</button>
      </div>
      {book && groups.map((gr) => (
        <div key={gr} className="rounded-sm bg-black/65 p-3">
          <div className="mb-1 font-display text-lg tracking-widest">{gr}</div>
          {CHEATS.filter((c) => c.group === gr).map((c) => {
            const on = c.flag ? game.cheats.has(c.flag) : false;
            return (
              <button key={c.code} onClick={() => go(c.code)} className={"flex w-full items-baseline justify-between gap-2 border-t border-white/5 py-1.5 text-left " + (on ? "text-yellow-200" : "")}>
                <span className="font-bold tracking-wider">{c.code}</span>
                <span className="text-right text-xs text-white/60">{c.name}{on ? " · AN" : ""}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
