import { useState } from "react";
import type { Game, GameConfig } from "../core/engine";
import { JOB_DEFS } from "../gameplay/jobs";
import BigMap from "./BigMap";
import Help from "./Help";
import Icon from "./icons";
import { ContactsTab, FlightTab, GarageTab, HideTab, JobsTab, MessagesApp, RadioApp } from "./GameTabs";
import { CAM_LABEL, CheatTab, Progress, SAVE_MSG, SettingsTab, SpawnTab } from "./PauseMenu";

type App = "home" | "jobs" | "contacts" | "map" | "messages" | "garage" | "radio" | "hide" | "flight" | "spawn" | "cheats" | "progress" | "settings" | "help" | "system";
// every function of the pause menu is an app here
const APPS: [App, string, string, string][] = [
  ["map", "Karte", "#2bf0ff", "map"], ["jobs", "Jobs", "#ff3cac", "money"], ["contacts", "Kontakte", "#3dff8b", "contacts"], ["messages", "Nachrichten", "#ffd23f", "messages"],
  ["garage", "Fahrzeug", "#ff8a1f", "garage"], ["spawn", "Spawnen", "#ff5a3d", "car"], ["flight", "Flug", "#7fb2ff", "plane"], ["hide", "Verstecken", "#5ad1c4", "hide"],
  ["radio", "Radio", "#c86bff", "radio"], ["progress", "Fortschritt", "#e1b12c", "star"], ["settings", "Einstellungen", "#9aa3ad", "settings"], ["help", "Hilfe", "#7ac8e8", "info"],
  ["cheats", "Cheats", "#ff4d6d", "tnt"], ["system", "Menü", "#f2f2f2", "save"],
];

export interface PhoneProps {
  game: Game; onClose: () => void; config: GameConfig; isTouch: boolean; muted: boolean;
  onCam: () => void; onMute: () => void; onMenu: () => void; onSaved: () => void;
}

// the in-game phone (T): apps on a phone screen; the game waits while it is open
export default function Phone(props: PhoneProps) {
  const { game, onClose } = props;
  const [app, setApp] = useState<App>("home");
  const [, redraw] = useState(0);
  const h = Math.floor(game.clock), m = Math.floor((game.clock % 1) * 60);
  const close = () => onClose();
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/30 p-3 sm:items-center" onClick={close}>
      <div className="popin phone-shell flex h-[min(94vh,680px)] w-[min(94vw,380px)] flex-col overflow-hidden rounded-[2.4rem] border-[5px] bg-[#0d1014] shadow-[0_20px_60px_rgba(0,0,0,0.6)]" style={{ borderColor: game.phoneColor() }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-3 text-xs text-white/80">
          <span className="font-semibold">{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}</span>
          <span className="h-5 w-20 rounded-full bg-black" />
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
            <div className="grid grid-cols-4 gap-x-2 gap-y-4 pt-4">
              {APPS.map(([k, label, col, icon]) => (
                <button key={k} onClick={() => setApp(k)} className="flex flex-col items-center gap-1 active:scale-95">
                  <span className="flex h-14 w-14 items-center justify-center rounded-[1.1rem] shadow-md" style={{ background: `linear-gradient(160deg, ${col}, ${col}99)`, color: "#0d1014" }}><Icon name={icon} size={26} /></span>
                  <span className="text-[10px] text-white/85">{label}</span>
                </button>
              ))}
            </div>
          )}
          {app === "jobs" && <JobsTab game={game} compact onDone={close} />}
          {app === "contacts" && <ContactsTab game={game} />}
          {app === "map" && <BigMap game={game} onChange={() => redraw((n) => n + 1)} onTravel={close} />}
          {app === "messages" && <MessagesApp game={game} />}
          {app === "garage" && <GarageTab game={game} onDone={close} />}
          {app === "radio" && <RadioApp game={game} />}
          {app === "hide" && <HideTab game={game} onDone={close} />}
          {app === "flight" && <FlightTab game={game} onDone={close} />}
          {app === "spawn" && <SpawnTab game={game} onResume={close} narrow />}
          {app === "progress" && <Progress game={game} narrow />}
          {app === "cheats" && <CheatTab game={game} />}
          {app === "settings" && <SettingsTab game={game} isTouch={props.isTouch} narrow />}
          {app === "help" && <div className="rounded-sm border border-white/5 bg-black/65 p-3 text-sm"><Help isTouch={props.isTouch} bind={game.bind} /></div>}
          {app === "system" && <SystemApp {...props} />}
        </div>
      </div>
    </div>
  );
}

// what the first page of the pause menu offers: save, camera, sound, cancel the mission, main menu
function SystemApp({ game, onClose, config, muted, onCam, onMute, onMenu, onSaved }: PhoneProps) {
  const [msg, setMsg] = useState("");
  const open = config.mode === "open";
  const b = "w-full rounded-xl bg-white/10 px-4 py-3 text-left text-sm font-bold text-white active:scale-[0.98]";
  return (
    <div className="space-y-2">
      {open && <button className={b} onClick={() => { setMsg(SAVE_MSG[game.saveGame()]); onSaved(); }}>Speichern</button>}
      {msg && <div className="px-1 text-xs text-white/70">{msg}</div>}
      <button className={b} onClick={onCam}>Kamera: {CAM_LABEL[config.camera]}</button>
      <button className={b} onClick={onMute}>{muted ? "Ton an" : "Ton aus"}</button>
      {open && game.missions.active && <button className={b} onClick={() => { game.missions.fail("Abgebrochen"); onClose(); }}>Mission abbrechen</button>}
      <button className={b} onClick={() => { onClose(); onMenu(); }}>Hauptmenü{open ? " (speichert)" : ""}</button>
      <div className="pt-1 text-[11px] text-white/45">Alles aus dem Pausenmenü gibt es hier als App: Karte, Spawnen, Flug, Garage, Fortschritt, Einstellungen und Hilfe.</div>
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
        <div className="font-display text-3xl tracking-widest text-white">{from}</div>
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
