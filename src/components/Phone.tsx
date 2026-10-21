import { useState } from "react";
import type { Game } from "../game/engine";
import { JOB_DEFS } from "../game/jobs";
import { applySettings, loadSettings, saveSettings } from "../game/settings";
import BigMap from "./BigMap";
import Icon from "./icons";
import { ContactsTab, GarageTab, HideTab, JobsTab, MessagesApp, RadioApp } from "./GameTabs";

type App = "home" | "jobs" | "contacts" | "map" | "messages" | "garage" | "radio" | "hide" | "settings";
const APPS: [App, string, string][] = [
  ["jobs", "Jobs", "#ff3cac"], ["contacts", "Kontakte", "#3dff8b"], ["map", "Karte", "#2bf0ff"], ["messages", "Nachrichten", "#ffd23f"],
  ["garage", "Fahrzeug", "#ff8a1f"], ["radio", "Radio", "#c86bff"], ["hide", "Verstecken", "#5ad1c4"], ["settings", "Einstellungen", "#9aa3ad"],
];
const ICON: Record<App, string> = { home: "phone", jobs: "money", contacts: "contacts", map: "map", messages: "messages", garage: "garage", radio: "radio", hide: "hide", settings: "settings" };

// the in-game phone (T): apps on a phone screen; the game waits while it is open
export default function Phone({ game, onClose }: { game: Game; onClose: () => void }) {
  const [app, setApp] = useState<App>("home");
  const [, redraw] = useState(0);
  const h = Math.floor(game.clock), m = Math.floor((game.clock % 1) * 60);
  const close = () => onClose();
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/30 p-3 sm:items-center" onClick={close}>
      <div className="popin flex h-[min(92vh,640px)] w-[min(94vw,360px)] flex-col overflow-hidden rounded-[2.2rem] border-4 border-[#1a1626] bg-[#0f0b1a] shadow-[0_0_40px_rgba(255,60,172,0.35)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-3 text-xs text-white/70">
          <span className="font-semibold">{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}</span>
          <span className="font-display tracking-widest text-pink-300">SB-MOBIL</span>
          <button onClick={close} className="rounded-full p-1 hover:bg-white/10" aria-label="Handy schließen"><Icon name="close" size={16} /></button>
        </div>
        {app !== "home" && (
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
            <button onClick={() => setApp("home")} className="rounded-lg bg-white/10 px-2 py-1 text-xs">Zurück</button>
            <span className="font-display text-xl tracking-widest">{APPS.find((a) => a[0] === app)?.[1]}</span>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-3">
          {app === "home" && (
            <div className="grid grid-cols-4 gap-3 pt-4">
              {APPS.map(([k, label, col]) => (
                <button key={k} onClick={() => setApp(k)} className="flex flex-col items-center gap-1 active:scale-95">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: col + "33", color: col, boxShadow: `0 0 12px ${col}55` }}><Icon name={ICON[k]} size={26} /></span>
                  <span className="text-[10px] text-white/80">{label}</span>
                </button>
              ))}
            </div>
          )}
          {app === "jobs" && <JobsTab game={game} compact onDone={close} />}
          {app === "contacts" && <ContactsTab game={game} />}
          {app === "map" && <BigMap game={game} onChange={() => redraw((n) => n + 1)} />}
          {app === "messages" && <MessagesApp game={game} />}
          {app === "garage" && <GarageTab game={game} onDone={close} />}
          {app === "radio" && <RadioApp game={game} />}
          {app === "hide" && <HideTab game={game} onDone={close} />}
          {app === "settings" && <PhoneSettings />}
        </div>
      </div>
    </div>
  );
}

function PhoneSettings() {
  const [s, setS] = useState(loadSettings);
  const upd = (n: typeof s) => { setS(n); saveSettings(n); applySettings(n); };
  const row = (label: string, v: boolean, f: (b: boolean) => void) => (
    <label className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">{label}<input type="checkbox" checked={v} onChange={(e) => f(e.target.checked)} className="accent-pink-500" /></label>
  );
  return (
    <div className="space-y-2">
      {row("Minikarte dreht mit", s.mapRotate, (b) => upd({ ...s, mapRotate: b }))}
      {row("Sichtkegel der Sucher", s.seekerCones, (b) => upd({ ...s, seekerCones: b }))}
      {row("Wetterwechsel", s.weather, (b) => upd({ ...s, weather: b }))}
      {row("Tutorial-Hinweise", s.tips, (b) => upd({ ...s, tips: b }))}
      <div className="text-[11px] text-white/45">Alle Einstellungen findest du im Pausenmenü.</div>
    </div>
  );
}

// an incoming call with a special job offer
export function IncomingCall({ game, from, text, job, onClose }: { game: Game; from: string; text: string; job: string; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="popin w-[min(94vw,360px)] rounded-3xl border border-pink-400/40 bg-[#0f0b1a]/95 p-5 text-center shadow-[0_0_30px_rgba(255,60,172,0.4)]">
        <div className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-green-500/25 text-green-300"><Icon name="phone" size={28} /></div>
        <div className="mt-2 text-xs uppercase tracking-widest text-white/50">Anruf</div>
        <div className="font-display text-3xl tracking-widest text-pink-300">{from}</div>
        <p className="mt-2 text-sm text-white/85">{text}</p>
        <div className="mt-4 flex gap-3">
          <button className="flex-1 rounded-xl bg-red-500/80 py-2 font-bold" onClick={() => { game.declineCall(); onClose(); }}>Ablehnen</button>
          <button className="flex-1 rounded-xl bg-green-500/80 py-2 font-bold" onClick={() => { game.acceptCall(); onClose(); }}>Annehmen</button>
        </div>
        <div className="mt-2 text-[11px] text-white/45">{JOB_DEFS[job as keyof typeof JOB_DEFS]?.name ?? ""} · Bonus +50 %</div>
      </div>
    </div>
  );
}
