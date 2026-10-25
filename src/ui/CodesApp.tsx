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
        <div className="sb-eyebrow mt-2">PIN eingeben</div>
        <div className="mt-3 flex gap-2">
          {Array.from({ length: CHEAT_PIN.length }, (_, i) => <span key={i} className={"h-3 w-3 rounded-full border border-white/50 " + (i < pin.length ? "border-sun-400 bg-sun-400" : "")} />)}
        </div>
        <div className="mt-1 h-5 text-xs text-alert-400">{wrong ? "Falsche PIN" : ""}</div>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d, i) => d === "" ? <span key={i} /> : (
            <button key={i} onClick={() => (d === "⌫" ? setPin(pin.slice(0, -1)) : press(d))} className="h-14 w-14 rounded-full border border-white/10 bg-white/[0.06] font-display text-2xl text-fog-100 active:bg-sun-500/30">{d}</button>
          ))}
        </div>
      </div>
    );
  }

  const go = (c = code) => { setMsg(game.cheat(c)); setCode(""); redraw((n) => n + 1); };
  const groups = [...new Set(CHEATS.map((c) => c.group))];
  return (
    <div className="space-y-3 text-sm">
      <div className="sb-card">
        <div className="sb-h3 mb-2">Code eingeben</div>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { (e.target as HTMLInputElement).blur(); return; } e.stopPropagation(); if (e.key === "Enter") go(); }} placeholder="Code"
            autoCapitalize="characters" autoComplete="off" spellCheck={false}
            className="sb-input min-w-0 flex-1 font-bold uppercase tracking-widest placeholder:text-fog-700" />
          <button onClick={() => go()} className="sb-btn sb-btn-primary">OK</button>
        </div>
        {msg && <div className="mt-2 text-fog-100">{msg}</div>}
        <button onClick={() => setBook(!book)} className="sb-btn sb-btn-ghost sb-btn-sm mt-2 px-0">{book ? "Codebuch schließen" : `Codebuch (${CHEATS.length} Codes)`}</button>
      </div>
      {book && groups.map((gr) => (
        <div key={gr} className="sb-card">
          <div className="sb-h3 mb-1 text-lg">{gr}</div>
          {CHEATS.filter((c) => c.group === gr).map((c) => {
            const on = c.flag ? game.cheats.has(c.flag) : false;
            return (
              <button key={c.code} onClick={() => go(c.code)} className={"flex w-full items-baseline justify-between gap-2 border-t border-white/5 py-1.5 text-left " + (on ? "text-sun-300" : "")}>
                <span className="font-bold tracking-wider">{c.code}</span>
                <span className="text-right text-xs text-fog-500">{c.name}{on ? " · AN" : ""}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
