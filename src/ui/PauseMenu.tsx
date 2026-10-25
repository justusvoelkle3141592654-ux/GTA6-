import { useEffect, useState } from "react";
import type { CameraMode, Game, GameConfig, HudData } from "../core/engine";
import type { SaveResult } from "../core/save";
import { MISSIONS } from "../gameplay/missions";
import { JOB_DEFS, JOB_KINDS, RACES, jobLevel } from "../gameplay/jobs";
import { ContactsTab, FlightTab, GarageTab, HideTab, JobsTab } from "./GameTabs";
import { ACTIONS, ACTION_LABEL, keyLabel, type Action } from "../core/input";
import { CHANNELS } from "../audio/audio";
import { SPAWN_MODELS, type SpawnPeople } from "../gameplay/spawner";
import { MODEL_NAME } from "../vehicles/vehicles";
import { CHANNEL_LABEL, applySettings, loadSettings, saveSettings, type Settings } from "../core/settings";
import BigMap from "./BigMap";
import Help from "./Help";
import { Toast, fmt, fmtTime } from "./ui";
import Icon from "./icons";

export type PauseTab = "menu" | "map" | "jobs" | "hide" | "contacts" | "progress" | "garage" | "flight" | "spawn" | "settings" | "help";
export const CAM_LABEL: Record<CameraMode, string> = { chase: "3D Verfolger", fp: "Ego (im Auto)", hood: "Motorhaube", front: "Von vorne", side: "Seitlich", top: "Vogelperspektive" };
export const SAVE_MSG: Record<SaveResult, string> = {
  saved: "Gespeichert", memory: "Nur vorübergehend gespeichert – der Browser blockiert den lokalen Speicher",
  wanted: "Speichern geht nur ohne Fahndung (keine Sterne)", busy: "Gerade nicht möglich", mode: "",
};
// leaving for the main menu saves; when saving is blocked a second tap is needed (the progress since the last save is lost)
export const LEAVE_MSG = (r: SaveResult) => `Nicht gespeichert: ${SAVE_MSG[r]}. Nochmal tippen = ohne Speichern zum Hauptmenü`;

interface Props {
  game: Game; tab: PauseTab; setTab: (t: PauseTab) => void; hud: HudData; config: GameConfig; isTouch: boolean; muted: boolean;
  onResume: () => void; onCam: () => void; onRestart: () => void; onFinish: () => void; onMute: () => void; onMenu: () => void; onSaved: () => void;
}

const TAB_ICON: Record<PauseTab, string> = { menu: "pause", map: "map", jobs: "money", hide: "hide", contacts: "contacts", progress: "star", garage: "garage", flight: "plane", spawn: "car", settings: "settings", help: "info" };

// pause: a side menu on the left (where am I, what is selected), the page on the right with its title,
// money and time; Weiter / Esc / the Android back button lead back
export default function PauseMenu({ game, tab, setTab, hud, config, isTouch, muted, onResume, onCam, onRestart, onFinish, onMute, onMenu, onSaved }: Props) {
  const open = config.mode === "open";
  const [saveMsg, setSaveMsg] = useState("");
  const [leave, setLeave] = useState(false);
  const toMenu = () => {
    const block = open ? game.saveBlock() : null;
    if (block && !leave) setLeave(true); else onMenu();
  };
  const [, redraw] = useState(0);
  const tabs: [PauseTab, string][] = open
    ? [["menu", "Übersicht"], ["map", "Karte"], ["jobs", "Jobs"], ["contacts", "Kontakte"], ["progress", "Fortschritt"], ["garage", "Garage"], ["flight", "Flug"], ["hide", "Verstecken"], ["spawn", "Spawnen"], ["settings", "Einstellungen"], ["help", "Hilfe"]]
    : [["menu", "Übersicht"], ["settings", "Einstellungen"], ["help", "Hilfe"]];
  const title = tabs.find(([k]) => k === tab)?.[1] ?? "";
  const hh = Math.floor(game.clock), mi = Math.floor((game.clock % 1) * 60);
  const clock = `${String(hh).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  const row = "sb-row w-full text-left text-[13px] font-semibold text-fog-100 transition-colors hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.99]";
  return (
    <div className="absolute inset-0 z-20">
      <div className="sb-screen-solid" />
      <div className="relative flex h-full" style={{ paddingLeft: "var(--sal)", paddingRight: "var(--sar)", paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }}>
        <nav className="flex w-[9.5rem] shrink-0 flex-col border-r border-white/[0.08] bg-ink-950/45 sm:w-52" aria-label="Pausenmenü">
          <div className="px-3 pb-2 pt-3 [@media(max-height:480px)]:pb-1 [@media(max-height:480px)]:pt-2">
            <div className="sb-title whitespace-nowrap text-2xl sm:text-3xl">SOLARA <span className="text-sun-500">BAY</span></div>
            <span className="sb-rule mt-1 [@media(max-height:480px)]:hidden" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-2 sb-scroll">
            {tabs.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined}
                className={"sb-nav [@media(max-height:480px)]:min-h-[1.8rem] [@media(max-height:480px)]:py-0.5 " + (tab === k ? "is-active" : "")}>
                <Icon name={TAB_ICON[k]} size={15} className={tab === k ? "text-sun-400" : "text-fog-500"} />{l}
              </button>
            ))}
          </div>
        </nav>
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-end justify-between gap-3 border-b border-white/[0.08] px-3 pb-2 pt-3 sm:px-5 [@media(max-height:480px)]:pt-2">
            <div className="min-w-0">
              <div className="sb-eyebrow">Pause{game.missions.active ? " · Mission läuft" : game.jobs.active ? " · Job läuft" : ""}</div>
              <h2 className="sb-title truncate text-3xl sm:text-4xl">{title}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right">
                <div className="sb-num text-2xl leading-none text-fog-100">{open ? <><span className="mr-0.5 text-lg text-ok-400">$</span>{fmt(hud.cash)}</> : `Score ${fmt(hud.score)}`}</div>
                <div className="sb-note mt-0.5">{clock} Uhr · Spielzeit {fmtTime(hud.time)}</div>
              </div>
              <button onClick={onResume} className="sb-btn sb-btn-primary" aria-label="Weiterspielen">Weiter<Icon name="arrow" size={16} /></button>
            </div>
          </header>
          <div className="@container min-h-0 flex-1 overflow-y-auto p-3 sb-scroll sm:p-5">
            {tab === "menu" && (
              <div className="grid max-w-3xl gap-3 @lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
                <div className="flex flex-col gap-1.5">
                  <button onClick={onResume} className={row}>Weiterspielen<Icon name="arrow" size={16} className="text-sun-400" /></button>
                  <button onClick={onCam} className={row}>Kamera<span className="text-xs font-medium text-fog-500">{CAM_LABEL[config.camera]}</span></button>
                  {open && <button onClick={() => { setSaveMsg(SAVE_MSG[game.saveGame()]); onSaved(); }} className={row}>Speichern<Icon name="save" size={16} className="text-fog-500" /></button>}
                  {open && saveMsg && <Toast>{saveMsg}</Toast>}
                  {open && game.missions.active && <button onClick={() => { game.missions.fail("Abgebrochen"); onResume(); }} className={row + " border-alert-500/40"}>Mission abbrechen<Icon name="close" size={15} className="text-alert-400" /></button>}
                  {!open && <button onClick={onFinish} className={row}>Fahrt beenden</button>}
                  {!open && <button onClick={onRestart} className={row}>Neustart</button>}
                  <button onClick={onMute} className={row}>Ton<span className="text-xs font-medium text-fog-500">{muted ? "aus" : "an"}</span></button>
                  <button onClick={toMenu} className={row + (leave ? " border-alert-500/60 bg-alert-500/10" : "")}>Hauptmenü{open ? (leave ? " ohne Speichern" : "") : ""}<span className="text-xs font-medium text-fog-500">{open && !leave ? "speichert" : ""}</span></button>
                  {leave && <div ref={(el) => el?.scrollIntoView({ block: "nearest" })}><Toast tone="bad" className="text-xs">{LEAVE_MSG(game.saveBlock() ?? "busy")}</Toast></div>}
                  {!isTouch && <div className="sb-note mt-1">P / Esc = weiter · M = Karte</div>}
                </div>
                {open && (
                  <div className="sb-card self-start">
                    <div className="sb-eyebrow mb-2">Status</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      <div><div className="sb-num text-xl text-ok-400">${fmt(game.bank)}</div><div className="sb-note">Bankkonto</div></div>
                      <div><div className="sb-num text-xl text-fog-100">{game.progress.missions.length}/{MISSIONS.length}</div><div className="sb-note">Story</div></div>
                      <div><div className={"sb-num text-xl " + (game.wanted.stars > 0 ? "text-alert-400" : "text-fog-100")}>{game.wanted.stars}</div><div className="sb-note">Fahndung</div></div>
                      <div><div className="sb-num text-xl text-fog-100">{game.garage.length}/{game.garageSlots}</div><div className="sb-note">Garage</div></div>
                    </div>
                    {game.objective && <div className="mt-3 border-t border-white/[0.08] pt-2"><div className="sb-eyebrow text-sun-400">Ziel</div><div className="sb-body text-fog-100">{game.objective}</div></div>}
                  </div>
                )}
              </div>
            )}
            {tab === "map" && <BigMap game={game} onChange={() => redraw((n) => n + 1)} onTravel={onResume} />}
            {tab === "jobs" && <JobsTab game={game} onDone={onResume} />}
            {tab === "hide" && <HideTab game={game} onDone={onResume} />}
            {tab === "contacts" && <ContactsTab game={game} />}
            {tab === "garage" && <GarageTab game={game} onDone={onResume} />}
            {tab === "progress" && <Progress game={game} />}
            {tab === "flight" && <FlightTab game={game} onDone={onResume} />}
            {tab === "spawn" && <SpawnTab game={game} onResume={onResume} />}
            {tab === "settings" && <SettingsTab game={game} isTouch={isTouch} />}
            {tab === "help" && <div className="sb-card max-w-4xl"><Help isTouch={isTouch} bind={game.bind} /></div>}
          </div>
        </main>
      </div>
    </div>
  );
}

export function Progress({ game, narrow = false }: { game: Game; narrow?: boolean }) {
  const pr = game.progress, st = game.stats, done = new Set(pr.missions);
  const rep = (v: number) => (v <= -30 ? "feindlich" : v >= 30 ? "freundlich" : "neutral");
  const part = (n: number, of: number) => Math.min(1, n / Math.max(1, of)); // an old save may hold ids that no longer exist: never above 100 %
  const pct = Math.round((part(pr.missions.length, MISSIONS.length) * 0.5 + part(pr.shells.length, game.jobs.shells.length) * 0.2 + part(pr.jumps.length, game.jobs.jumps.length) * 0.15 + part(RACES.filter((r) => pr.records[r.id]).length, RACES.length) * 0.15) * 100);
  return (
    <div className={narrow ? "grid gap-3" : "grid gap-3 @2xl:grid-cols-2"}>
      <div className="sb-card @2xl:col-span-2">
        <div className="flex items-end justify-between"><h3 className="sb-h3">Gesamt</h3><div className="sb-num text-4xl text-fog-100">{pct} %</div></div>
        <div className="sb-track mt-2 h-1.5"><div className="sb-fill" style={{ width: `${pct}%` }} /></div>
        <div className="sb-note mt-1.5">Story 50 % · Muscheln 20 % · Stuntsprünge 15 % · Rennrekorde 15 %</div>
      </div>
      <div className="sb-card">
        <h3 className="sb-h3 mb-2">Story {pr.missions.length}/{MISSIONS.length}</h3>
        <ul className="space-y-1 text-sm">
          {MISSIONS.map((m) => {
            const avail = !done.has(m.id) && m.requires.every((r) => done.has(r));
            const giver = game.places.find((p) => p.id === m.giver);
            return <li key={m.id} className={done.has(m.id) ? "text-ok-400" : avail ? "text-fog-100" : "text-fog-700"}><span className="mr-1 inline-block w-4 align-middle">{done.has(m.id) ? <Icon name="check" size={14} /> : avail ? "›" : "·"}</span>{m.title} {avail && <span className="text-xs text-sun-300">({giver?.name})</span>}</li>;
          })}
        </ul>
      </div>
      <div className="space-y-3">
        <div className="sb-card text-sm text-fog-300">
          <h3 className="sb-h3 mb-2">Nebenbei</h3>
          <div className="flex items-center gap-1.5"><Icon name="shell" size={16} />Muscheln: <b>{pr.shells.length}/{game.jobs.shells.length}</b></div>
          <div className="flex items-center gap-1.5"><Icon name="skate" size={16} />Stuntsprünge: <b>{pr.jumps.length}/{game.jobs.jumps.length}</b></div>
          {JOB_KINDS.map((k) => <div key={k}>{JOB_DEFS[k].name}: <b>Stufe {jobLevel(pr.jobs[k] ?? 0)}</b> · {pr.jobs[k] ?? 0} erledigt</div>)}
          {RACES.map((r) => <div key={r.id} className="flex items-center gap-1.5"><Icon name="flag" size={16} />{r.name}: <b>{pr.records[r.id] ? `${pr.records[r.id].toFixed(1)} s` : "–"}</b> <span className="text-xs text-fog-500">(Ziel {r.par} s)</span></div>)}
          <div>Versteckspiel: <b>{Object.entries(pr.records).filter(([k]) => k.startsWith("hide_")).reduce((a, [, v]) => a + v, 0)}</b> gewonnene Runden</div>
          <div className="flex items-center gap-1.5"><Icon name="bank" size={16} />Bankkonto: <b>${fmt(game.bank)}</b></div>
        </div>
        <div className="sb-card text-sm">
          <h3 className="sb-h3 mb-2">Statistik</h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-fog-300 [&_b]:text-fog-100">
            <span>Spielzeit</span><b>{fmtTime(st.playTime || game.time)}</b>
            <span>Verdient</span><b>${fmt(st.earned)}</b>
            <span>Autos geklaut</span><b>{st.carsStolen}</b>
            <span>Leute umgehauen</span><b>{st.pedsHit}</b>
            <span>Krankenhaus</span><b>{st.deaths}</b>
            <span>Verhaftet</span><b>{st.arrests}</b>
            <span>Max. Fahndung</span><b>{Math.max(st.maxStars, game.wanted.maxStars)} Sterne</b>
            <span>Halcones</span><b>{rep(pr.rep.halcones)}</b>
            <span>Neon Kings</span><b>{rep(pr.rep.kings)}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

// sandbox: everything on demand; vehicles take you back into the game right away
export function SpawnTab({ game, onResume, narrow = false }: { game: Game; onResume: () => void; narrow?: boolean }) {
  const [msg, setMsg] = useState("");
  const sp = game.spawner;
  const run = (m: string, resume = false) => { setMsg(m); if (resume && !/^(Nur|Nicht|Ein Boot|Hier)/.test(m)) onResume(); };
  const people: [SpawnPeople, string][] = [["civ", "Passanten"], ["cop", "Polizisten"], ["halcones", "Halcones"], ["kings", "Neon Kings"]];
  const card = "sb-card text-sm";
  const b = "sb-btn px-2 normal-case tracking-normal text-[13px]";
  return (
    <div className={narrow ? "grid gap-3" : "grid gap-3 @2xl:grid-cols-2"}>
      <div className={card + " @2xl:col-span-2"}>
        <h3 className="sb-h3 mb-2">Fahrzeug herbeirufen</h3>
        <div className={narrow ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 gap-2 @lg:grid-cols-3 @3xl:grid-cols-5"}>
          {SPAWN_MODELS.map((m) => <button key={m} className={b} onClick={() => run(sp.vehicle(m), true)}>{MODEL_NAME[m]}</button>)}
        </div>
        <div className="sb-note mt-2">Du steigst sofort ein. Boote erscheinen nur in der Nähe von Wasser.</div>
      </div>
      <div className={card}>
        <h3 className="sb-h3 mb-2">Ausrüstung</h3>
        <div className="grid grid-cols-2 gap-2">
          <button className={b} onClick={() => run(sp.weapons())}>Alle Waffen</button>
          <button className={b} onClick={() => run(sp.heal())}>Alles auffüllen</button>
          <button className={b} onClick={() => run(sp.cash(1000))}>+$1.000</button>
          <button className={b} onClick={() => run(sp.cash(10000))}>+$10.000</button>
        </div>
      </div>
      <div className={card}>
        <h3 className="sb-h3 mb-2">Leute</h3>
        <div className="grid grid-cols-2 gap-2">
          {people.map(([k, l]) => <button key={k} className={b} onClick={() => run(sp.people(k))}>{l}</button>)}
        </div>
      </div>
      <div className={card + " @2xl:col-span-2"}>
        <h3 className="sb-h3 mb-2">Fahndung</h3>
        <div className={narrow ? "grid grid-cols-4 gap-2" : "grid grid-cols-4 gap-2 @3xl:grid-cols-7"}>
          {[0, 1, 2, 3, 4, 5, 6].map((n) => <button key={n} className={b} onClick={() => run(sp.wanted(n))}>{n === 0 ? "0 Sterne" : n === 1 ? "1 Stern" : n + " Sterne"}</button>)}
        </div>
      </div>
      {msg && <Toast className="@2xl:col-span-2">{msg}</Toast>}
    </div>
  );
}

function Slider({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label className="mb-2 flex items-center gap-3">
      <span className="w-24 shrink-0 text-fog-300">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="sb-range flex-1" />
      <span className="w-14 text-right text-fog-500">{fmt(value)}</span>
    </label>
  );
}

// time in prison after being busted: any number of seconds (1 to 3600)
function JailInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [txt, setTxt] = useState(String(value));
  const commit = () => { const n = Math.round(Number(txt.replace(",", "."))); const v = Number.isFinite(n) ? Math.max(1, Math.min(3600, n)) : value; setTxt(String(v)); onChange(v); };
  return (
    <label className="mb-1 mt-2 flex items-center gap-2">
      <span className="text-fog-300">Haftdauer</span>
      <input type="number" inputMode="numeric" min={1} max={3600} value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Escape") { commit(); return; } e.stopPropagation(); if (e.key === "Enter") commit(); }}
        className="sb-input w-20 py-1 text-right font-bold" />
      <span className="text-fog-500">Sekunden</span>
    </label>
  );
}

export function SettingsTab({ game, isTouch, narrow = false }: { game: Game; isTouch: boolean; narrow?: boolean }) {
  const [s, setS] = useState<Settings>(loadSettings);
  const [waiting, setWaiting] = useState<Action | null>(null);
  const [, redraw] = useState(0);
  const update = (n: Settings) => { setS(n); saveSettings(n); applySettings(n); };

  // capture the next key for rebinding
  useEffect(() => {
    if (!waiting) return;
    game.rebinding = true;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.code !== "Escape") game.bind.set(waiting, e.code);
      setWaiting(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); window.setTimeout(() => { game.rebinding = false; }, 0); };
  }, [waiting, game]);

  return (
    <div className={narrow ? "grid gap-3" : "grid gap-3 @2xl:grid-cols-2"}>
      <div className="sb-card text-sm text-fog-300">
        <h3 className="sb-h3 mb-2">Lautstärke</h3>
        {CHANNELS.map((ch) => (
          <label key={ch} className="mb-2 flex items-center gap-3">
            <span className="w-16 text-fog-300">{CHANNEL_LABEL[ch]}</span>
            <input type="range" min={0} max={1} step={0.05} value={s.volume[ch]} onChange={(e) => update({ ...s, volume: { ...s.volume, [ch]: Number(e.target.value) } })} className="sb-range flex-1" />
            <span className="w-9 text-right text-fog-500">{Math.round(s.volume[ch] * 100)}</span>
          </label>
        ))}
        <h3 className="sb-h3 mb-2 mt-4">Spiel</h3>
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.tips} onChange={(e) => update({ ...s, tips: e.target.checked })} className="sb-check" /> Tutorial-Hinweise</label>
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.shake} onChange={(e) => update({ ...s, shake: e.target.checked })} className="sb-check" /> Kamerawackeln</label>
        <JailInput value={s.jailSec} onChange={(v) => update({ ...s, jailSec: v })} />
        <Slider label="Lauftempo" value={s.runSpeed} min={0.5} max={3} step={0.1} fmt={(v) => `${Math.round(20 * v)} / ${Math.round(32 * v)} km/h`} onChange={(v) => update({ ...s, runSpeed: v })} />
        <div className="mb-2 mt-1 flex items-center gap-2"><span className="w-28 text-fog-300">Feuermodus</span>
          {([["cooldown", "Cooldown"], ["auto", "Dauerfeuer"]] as const).map(([m, l]) => <button key={m} onClick={() => update({ ...s, fireMode: m })} className={"sb-btn sb-btn-sm " + (s.fireMode === m ? "is-on" : "")}>{l}</button>)}
        </div>
        <div className="sb-note mb-1">Lauftempo: Laufen / Sprinten. Dauerfeuer: keine Pause zwischen den Schüssen und kein Nachladen-Warten.</div>
        <button onClick={() => game.tips.reset()} className="sb-btn sb-btn-sm mt-2">Hinweise erneut zeigen</button>
      </div>
      <div className="sb-card text-sm text-fog-300">
        <h3 className="sb-h3 mb-2">Grafik & Welt</h3>
        <div className="mb-2 grid grid-cols-4 gap-1.5">
          {([["low", "Schnell"], ["medium", "Mittel"], ["high", "Hoch"], ["ultra", "Ultra"]] as const).map(([q, l]) => (
            <button key={q} onClick={() => { game.configure({ ...game.config, quality: q }); redraw((n) => n + 1); }} className={"sb-btn sb-btn-sm px-1 " + (game.config.quality === q ? "is-on" : "")}>{l}</button>
          ))}
        </div>
        <Slider label="Sichtweite" value={s.viewDist} min={0.6} max={1.4} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={(v) => update({ ...s, viewDist: v })} />
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.shadows} onChange={(e) => update({ ...s, shadows: e.target.checked })} className="sb-check" /> Schatten</label>
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.weather} onChange={(e) => update({ ...s, weather: e.target.checked })} className="sb-check" /> Wetterwechsel</label>
        <div className="mb-2 mt-1 flex items-center gap-2"><span className="w-28 text-fog-300">Tag-Nacht-Dauer</span>
          {([12, 24, 48] as const).map((m) => <button key={m} onClick={() => update({ ...s, dayMinutes: m })} className={"sb-btn sb-btn-sm " + (s.dayMinutes === m ? "is-on" : "")}>{m} min</button>)}
        </div>
        <h3 className="sb-h3 mb-2 mt-4">Fahrzeuge</h3>
        <Slider label="Tempo-Faktor" value={s.vehSpeed} min={1} max={5} step={0.25} fmt={(v) => `${v.toFixed(2).replace(".", ",").replace(/,?0+$/, "")}x`} onChange={(v) => update({ ...s, vehSpeed: v })} />
        <Slider label="Verkehr" value={s.traffic} min={0} max={3} step={0.25} fmt={(v) => (v === 0 ? "aus" : `${Math.round(v * 100)} %`)} onChange={(v) => update({ ...s, traffic: v })} />
        <div className="sb-note mb-2">Tempo-Faktor gilt für dein Auto, Boot und deinen Hubschrauber (Höchsttempo und Beschleunigung).</div>
        <h3 className="sb-h3 mb-2 mt-4">Anzeige & Steuerung</h3>
        <Slider label="HUD-Größe" value={s.hudScale} min={0.8} max={1.3} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={(v) => update({ ...s, hudScale: v })} />
        <Slider label="Untertitel" value={s.subtitle} min={0.8} max={1.4} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={(v) => update({ ...s, subtitle: v })} />
        <Slider label="Kamera-Tempo" value={s.camSens} min={0.5} max={2} step={0.1} fmt={(v) => `${v.toFixed(1).replace(".", ",")}x`} onChange={(v) => update({ ...s, camSens: v })} />
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.camNear} onChange={(e) => update({ ...s, camNear: e.target.checked })} className="sb-check" /> Kamera nah (Figuren und Autos größer im Bild)</label>
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.invertY} onChange={(e) => update({ ...s, invertY: e.target.checked })} className="sb-check" /> Y-Achse umkehren</label>
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.mapRotate} onChange={(e) => update({ ...s, mapRotate: e.target.checked })} className="sb-check" /> Minikarte dreht mit</label>
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.seekerCones} onChange={(e) => update({ ...s, seekerCones: e.target.checked })} className="sb-check" /> Sichtkegel der Sucher (Versteckspiel)</label>
        <div className="sb-note mt-2">{game.pad.state.active ? `Gamepad verbunden: ${game.pad.state.name.slice(0, 40)}` : "Gamepad: anschließen und eine Taste drücken – die Belegung steht unter Hilfe."}</div>
      </div>
      {!isTouch && (
        <div className="sb-card text-sm text-fog-300">
          <h3 className="sb-h3 mb-2">Tastenbelegung</h3>
          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {ACTIONS.map((a) => (
              <div key={a} className="flex items-center justify-between gap-2">
                <span className="text-fog-300">{ACTION_LABEL[a]}</span>
                <button onClick={() => setWaiting(a)} className={"sb-btn sb-btn-sm min-w-[5.5rem] normal-case tracking-normal " + (waiting === a ? "is-on" : "")}>
                  {waiting === a ? "Taste…" : keyLabel(game.bind.keys[a][0])}
                </button>
              </div>
            ))}
          </div>
          <div className="sb-note mt-2 flex items-center justify-between"><span>Esc bricht ab</span><button onClick={() => { game.bind.reset(); redraw((n) => n + 1); }} className="sb-btn sb-btn-ghost sb-btn-sm">Standard</button></div>
        </div>
      )}
    </div>
  );
}
