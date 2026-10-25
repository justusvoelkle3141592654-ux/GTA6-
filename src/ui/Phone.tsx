import { useState } from "react";
import type { Game, GameConfig } from "../core/engine";
import { JOB_DEFS } from "../gameplay/jobs";
import BigMap from "./BigMap";
import Help from "./Help";
import Icon from "./icons";
import { ContactsTab, FlightTab, GarageTab, HideTab, JobsTab, MessagesApp, RadioApp } from "./GameTabs";
import { CAM_LABEL, LEAVE_MSG, Progress, SAVE_MSG, SettingsTab, SpawnTab } from "./PauseMenu";
import CodesApp from "./CodesApp";
import { Toast } from "./ui";

type App = "home" | "jobs" | "contacts" | "map" | "messages" | "garage" | "radio" | "hide" | "flight" | "spawn" | "codes" | "progress" | "settings" | "help" | "system";
// every function of the pause menu is an app here
const APPS: [App, string, string, string][] = [
  ["map", "Karte", "#2bf0ff", "map"], ["jobs", "Jobs", "#ff3cac", "money"], ["contacts", "Kontakte", "#3dff8b", "contacts"], ["messages", "Nachrichten", "#ffd23f", "messages"],
  ["garage", "Fahrzeug", "#ff8a1f", "garage"], ["spawn", "Spawnen", "#ff5a3d", "car"], ["flight", "Flug", "#7fb2ff", "plane"], ["hide", "Verstecken", "#5ad1c4", "hide"],
  ["radio", "Radio", "#c86bff", "radio"], ["progress", "Fortschritt", "#e1b12c", "star"], ["settings", "Einstellungen", "#9aa3ad", "settings"], ["help", "Hilfe", "#7ac8e8", "info"],
  ["codes", "Codes", "#ff4d6d", "lock"], ["system", "Menü", "#f2f2f2", "save"],
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
    <div className="absolute inset-0 z-30 flex items-end justify-center p-3 sm:items-center" onClick={close}>
      <div className="sb-dim" />
      <div className="popin relative flex h-[min(94vh,680px)] w-[min(94vw,380px)] flex-col overflow-hidden rounded-[2rem] border-[4px] bg-ink-900 shadow-[0_20px_60px_rgba(0,0,0,0.6)]" style={{ borderColor: game.phoneColor() }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-2.5 text-xs text-fog-300">
          <span className="sb-num text-sm">{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}</span>
          <span className="h-4 w-16 rounded-full bg-ink-950" />
          <button onClick={close} className="sb-btn sb-btn-ghost sb-btn-sm h-7 min-h-7 px-1.5" aria-label="Handy schließen"><Icon name="close" size={16} /></button>
        </div>
        {app !== "home" && (
          <div className="flex items-center gap-2 border-b border-white/[0.08] px-3 py-2">
            <button onClick={() => setApp("home")} className="sb-btn sb-btn-sm px-2" aria-label="Zurück zum Startbildschirm"><Icon name="back" size={15} />Zurück</button>
            <span className="sb-h3 truncate">{APPS.find((a) => a[0] === app)?.[1]}</span>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-3 sb-scroll">
          {app === "home" && (
            <>
              <div className="px-1 pb-1 pt-2">
                <div className="sb-eyebrow">Solara Bay</div>
                <div className="sb-num text-4xl leading-none text-fog-100">{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}</div>
              </div>
              <div className="grid grid-cols-4 gap-x-2 gap-y-3 pt-3">
                {APPS.map(([k, label, , icon]) => (
                  <button key={k} onClick={() => setApp(k)} className="flex flex-col items-center gap-1 active:scale-95">
                    <span className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-white/10 bg-gradient-to-b from-ink-700 to-ink-800 text-fog-100 shadow-[0_3px_10px_rgba(0,0,0,0.35)]"><Icon name={icon} size={22} /></span>
                    <span className="text-[10px] text-fog-300">{label}</span>
                  </button>
                ))}
              </div>
            </>
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
          {app === "codes" && <CodesApp game={game} />}
          {app === "settings" && <SettingsTab game={game} isTouch={props.isTouch} narrow />}
          {app === "help" && <div className="sb-card text-sm"><Help isTouch={props.isTouch} bind={game.bind} /></div>}
          {app === "system" && <SystemApp {...props} />}
        </div>
      </div>
    </div>
  );
}

// what the first page of the pause menu offers: save, camera, sound, cancel the mission, main menu
function SystemApp({ game, onClose, config, muted, onCam, onMute, onMenu, onSaved }: PhoneProps) {
  const [msg, setMsg] = useState("");
  const [leave, setLeave] = useState(false);
  const open = config.mode === "open";
  const toMenu = () => {
    const block = open ? game.saveBlock() : null;
    if (block && !leave) setLeave(true); else { onClose(); onMenu(); }
  };
  const b = "sb-row w-full text-left text-sm font-semibold text-fog-100 active:scale-[0.98]";
  return (
    <div className="space-y-2">
      {open && <button className={b} onClick={() => { setMsg(SAVE_MSG[game.saveGame()]); onSaved(); }}>Speichern</button>}
      {msg && <Toast className="text-xs">{msg}</Toast>}
      <button className={b} onClick={onCam}>Kamera: {CAM_LABEL[config.camera]}</button>
      <button className={b} onClick={onMute}>{muted ? "Ton an" : "Ton aus"}</button>
      {open && game.missions.active && <button className={b} onClick={() => { game.missions.fail("Abgebrochen"); onClose(); }}>Mission abbrechen</button>}
      <button className={b} onClick={toMenu}>Hauptmenü{open ? (leave ? " ohne Speichern" : " (speichert)") : ""}</button>
      {leave && <div ref={(el) => el?.scrollIntoView({ block: "nearest" })}><Toast tone="bad" className="text-xs">{LEAVE_MSG(game.saveBlock() ?? "busy")}</Toast></div>}
      <div className="sb-note pt-1">Alles aus dem Pausenmenü gibt es hier als App: Karte, Spawnen, Flug, Garage, Fortschritt, Einstellungen und Hilfe.</div>
    </div>
  );
}

// an incoming call with a special job offer
export function IncomingCall({ game, from, text, job, onClose }: { game: Game; from: string; text: string; job: string; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center p-4 sm:items-center">
      <div className="sb-dim" />
      <div className="popin sb-panel relative w-[min(94vw,360px)] p-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-ok-500/60 bg-ok-500/15 text-ok-400"><Icon name="phone" size={24} /></div>
        <div className="sb-eyebrow mt-2">Eingehender Anruf</div>
        <div className="sb-title text-3xl">{from}</div>
        <p className="sb-body mt-2 text-fog-100">{text}</p>
        <div className="mt-4 flex gap-2">
          <button className="sb-btn sb-btn-danger flex-1" onClick={() => { game.declineCall(); onClose(); }}>Ablehnen</button>
          <button className="sb-btn flex-1 border-ok-500 bg-ok-500 text-ink-950 hover:bg-ok-400" onClick={() => { game.acceptCall(); onClose(); }}>Annehmen</button>
        </div>
        <div className="sb-note mt-2">{JOB_DEFS[job as keyof typeof JOB_DEFS]?.name ?? ""} · Bonus +50 %</div>
      </div>
    </div>
  );
}
