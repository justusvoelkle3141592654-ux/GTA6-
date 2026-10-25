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
import { Btn, fmt, fmtTime } from "./ui";
import Icon from "./icons";

export type PauseTab = "menu" | "map" | "jobs" | "hide" | "contacts" | "progress" | "garage" | "flight" | "spawn" | "settings" | "help";
export const CAM_LABEL: Record<CameraMode, string> = { chase: "3D Verfolger", fp: "Ego (im Auto)", top: "Vogelperspektive" };
export const SAVE_MSG: Record<SaveResult, string> = {
  saved: "Gespeichert", memory: "Nur vorübergehend gespeichert – der Browser blockiert den lokalen Speicher",
  wanted: "Speichern geht nur ohne Fahndung (keine Sterne)", busy: "Gerade nicht möglich", mode: "",
};

interface Props {
  game: Game; tab: PauseTab; setTab: (t: PauseTab) => void; hud: HudData; config: GameConfig; isTouch: boolean; muted: boolean;
  onResume: () => void; onCam: () => void; onRestart: () => void; onFinish: () => void; onMute: () => void; onMenu: () => void; onSaved: () => void;
}

export default function PauseMenu({ game, tab, setTab, hud, config, isTouch, muted, onResume, onCam, onRestart, onFinish, onMute, onMenu, onSaved }: Props) {
  const open = config.mode === "open";
  const [saveMsg, setSaveMsg] = useState("");
  const [, redraw] = useState(0);
  const tabs: [PauseTab, string][] = open
    ? [["menu", "Weiter"], ["map", "Karte"], ["jobs", "Jobs"], ["hide", "Verstecken"], ["contacts", "Kontakte"], ["progress", "Fortschritt"], ["garage", "Garage"], ["flight", "Flug"], ["spawn", "Spawnen"], ["settings", "Einstellungen"], ["help", "Hilfe"]]
    : [["menu", "Menü"], ["settings", "Einstellungen"], ["help", "Hilfe"]];
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center overflow-y-auto bg-[#0b0614]/80 p-4 backdrop-blur-sm sm:p-6">
      <h2 className="popin font-display text-6xl tracking-wider text-white neon-text sm:text-7xl">PAUSE</h2>
      <div className="mt-1 text-sm text-white/60">{open ? `$${fmt(hud.cash)}` : `Score: ${fmt(hud.score)}`} · {fmtTime(hud.time)}</div>
      <div className="mt-4 flex flex-wrap justify-center gap-1 rounded-xl bg-white/5 p-1">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={"rounded-lg px-3 py-1.5 font-display text-lg tracking-widest " + (tab === k ? "bg-pink-500 text-white" : "text-white/60 hover:text-white")}>{l}</button>)}
      </div>
      <div className="mt-4 w-full max-w-3xl">
        {tab === "menu" && (
          <div className="mx-auto flex w-72 flex-col gap-3">
            <Btn primary onClick={onResume}>Weiter</Btn>
            <Btn onClick={onCam}>Kamera: {CAM_LABEL[config.camera]}</Btn>
            {open && <Btn onClick={() => { setSaveMsg(SAVE_MSG[game.saveGame()]); onSaved(); }}>Speichern</Btn>}
            {open && saveMsg && <div className="-mt-1 text-center text-xs text-white/70">{saveMsg}</div>}
            {open && game.missions.active && <Btn onClick={() => { game.missions.fail("Abgebrochen"); onResume(); }}>Mission abbrechen</Btn>}
            {!open && <Btn onClick={onFinish}>Fahrt beenden</Btn>}
            {!open && <Btn onClick={onRestart}>Neustart</Btn>}
            <Btn onClick={onMute}>{muted ? "Ton an" : "Ton aus"}</Btn>
            <Btn onClick={onMenu}>Hauptmenü{open ? " (speichert)" : ""}</Btn>
            {!isTouch && <div className="text-center text-xs text-white/40">P / Esc = weiter · M = Karte</div>}
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
        {tab === "help" && <div className="rounded-2xl border border-white/10 bg-black/50 p-4"><Help isTouch={isTouch} bind={game.bind} /></div>}
      </div>
    </div>
  );
}

export function Progress({ game, narrow = false }: { game: Game; narrow?: boolean }) {
  const pr = game.progress, st = game.stats, done = new Set(pr.missions);
  const rep = (v: number) => (v <= -30 ? "feindlich" : v >= 30 ? "freundlich" : "neutral");
  const pct = Math.round(((pr.missions.length / MISSIONS.length) * 0.5 + (pr.shells.length / Math.max(1, game.jobs.shells.length)) * 0.2 + (pr.jumps.length / Math.max(1, game.jobs.jumps.length)) * 0.15 + (RACES.filter((r) => pr.records[r.id]).length / RACES.length) * 0.15) * 100);
  return (
    <div className={narrow ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
      <div className="rounded-2xl border border-white/10 bg-black/50 p-4 sm:col-span-2">
        <div className="flex items-end justify-between"><h3 className="font-display text-2xl tracking-widest text-pink-300">Gesamt</h3><div className="font-display text-4xl text-white">{pct} %</div></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-pink-500 to-yellow-300" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
        <h3 className="mb-2 font-display text-2xl tracking-widest text-pink-300">Story {pr.missions.length}/{MISSIONS.length}</h3>
        <ul className="space-y-1 text-sm">
          {MISSIONS.map((m) => {
            const avail = !done.has(m.id) && m.requires.every((r) => done.has(r));
            const giver = game.places.find((p) => p.id === m.giver);
            return <li key={m.id} className={done.has(m.id) ? "text-green-300" : avail ? "text-white" : "text-white/35"}><span className="mr-1 inline-block w-4 align-middle">{done.has(m.id) ? <Icon name="check" size={14} /> : avail ? "›" : "·"}</span>{m.title} {avail && <span className="text-xs text-pink-300">({giver?.name})</span>}</li>;
          })}
        </ul>
      </div>
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
          <h3 className="mb-2 font-display text-2xl tracking-widest text-pink-300">Nebenbei</h3>
          <div className="flex items-center gap-1.5"><Icon name="shell" size={16} />Muscheln: <b>{pr.shells.length}/{game.jobs.shells.length}</b></div>
          <div className="flex items-center gap-1.5"><Icon name="skate" size={16} />Stuntsprünge: <b>{pr.jumps.length}/{game.jobs.jumps.length}</b></div>
          {JOB_KINDS.map((k) => <div key={k}>{JOB_DEFS[k].name}: <b>Stufe {jobLevel(pr.jobs[k] ?? 0)}</b> · {pr.jobs[k] ?? 0} erledigt</div>)}
          {RACES.map((r) => <div key={r.id} className="flex items-center gap-1.5"><Icon name="flag" size={16} />{r.name}: <b>{pr.records[r.id] ? `${pr.records[r.id].toFixed(1)} s` : "–"}</b> <span className="text-xs text-white/45">(Ziel {r.par} s)</span></div>)}
          <div>Versteckspiel: <b>{Object.entries(pr.records).filter(([k]) => k.startsWith("hide_")).reduce((a, [, v]) => a + v, 0)}</b> gewonnene Runden</div>
          <div className="flex items-center gap-1.5"><Icon name="bank" size={16} />Bankkonto: <b>${fmt(game.bank)}</b></div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
          <h3 className="mb-2 font-display text-2xl tracking-widest text-pink-300">Statistik</h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-white/80">
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
  const card = "rounded-2xl border border-white/10 bg-black/50 p-4 text-sm";
  const b = "rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-sm font-bold text-white transition hover:border-pink-400 active:scale-95";
  return (
    <div className={narrow ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
      <div className={card + " sm:col-span-2"}>
        <h3 className="mb-2 font-display text-2xl tracking-widest text-pink-300">Fahrzeug herbeirufen</h3>
        <div className={narrow ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 gap-2 sm:grid-cols-5"}>
          {SPAWN_MODELS.map((m) => <button key={m} className={b} onClick={() => run(sp.vehicle(m), true)}>{MODEL_NAME[m]}</button>)}
        </div>
        <div className="mt-2 text-[11px] text-white/50">Du steigst sofort ein. Boote erscheinen nur in der Nähe von Wasser.</div>
      </div>
      <div className={card}>
        <h3 className="mb-2 font-display text-2xl tracking-widest text-pink-300">Ausrüstung</h3>
        <div className="grid grid-cols-2 gap-2">
          <button className={b} onClick={() => run(sp.weapons())}>Alle Waffen</button>
          <button className={b} onClick={() => run(sp.heal())}>Alles auffüllen</button>
          <button className={b} onClick={() => run(sp.cash(1000))}>+$1.000</button>
          <button className={b} onClick={() => run(sp.cash(10000))}>+$10.000</button>
        </div>
      </div>
      <div className={card}>
        <h3 className="mb-2 font-display text-2xl tracking-widest text-pink-300">Leute</h3>
        <div className="grid grid-cols-2 gap-2">
          {people.map(([k, l]) => <button key={k} className={b} onClick={() => run(sp.people(k))}>{l}</button>)}
        </div>
      </div>
      <div className={card + " sm:col-span-2"}>
        <h3 className="mb-2 font-display text-2xl tracking-widest text-pink-300">Fahndung</h3>
        <div className={narrow ? "grid grid-cols-4 gap-2" : "grid grid-cols-7 gap-2"}>
          {[0, 1, 2, 3, 4, 5, 6].map((n) => <button key={n} className={b} onClick={() => run(sp.wanted(n))}>{n === 0 ? "0 Sterne" : n === 1 ? "1 Stern" : n + " Sterne"}</button>)}
        </div>
      </div>
      {msg && <div className="popin rounded-lg bg-white/10 px-3 py-2 text-center text-sm text-yellow-100 sm:col-span-2">{msg}</div>}
    </div>
  );
}

function Slider({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label className="mb-2 flex items-center gap-3">
      <span className="w-24 shrink-0 text-white/70">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-pink-500" />
      <span className="w-12 text-right text-white/60">{fmt(value)}</span>
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
    <div className={narrow ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
      <div className="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
        <h3 className="mb-2 font-display text-2xl tracking-widest text-pink-300">Lautstärke</h3>
        {CHANNELS.map((ch) => (
          <label key={ch} className="mb-2 flex items-center gap-3">
            <span className="w-16 text-white/70">{CHANNEL_LABEL[ch]}</span>
            <input type="range" min={0} max={1} step={0.05} value={s.volume[ch]} onChange={(e) => update({ ...s, volume: { ...s.volume, [ch]: Number(e.target.value) } })} className="flex-1 accent-pink-500" />
            <span className="w-9 text-right text-white/60">{Math.round(s.volume[ch] * 100)}</span>
          </label>
        ))}
        <h3 className="mb-2 mt-4 font-display text-2xl tracking-widest text-pink-300">Spiel</h3>
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.tips} onChange={(e) => update({ ...s, tips: e.target.checked })} className="accent-pink-500" /> Tutorial-Hinweise</label>
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.shake} onChange={(e) => update({ ...s, shake: e.target.checked })} className="accent-pink-500" /> Kamerawackeln</label>
        <button onClick={() => game.tips.reset()} className="mt-2 rounded-lg border border-white/20 px-3 py-1 text-xs text-white/70">Hinweise erneut zeigen</button>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
        <h3 className="mb-2 font-display text-2xl tracking-widest text-pink-300">Grafik & Welt</h3>
        <div className="mb-2 grid grid-cols-4 gap-1.5">
          {([["low", "Schnell"], ["medium", "Mittel"], ["high", "Hoch"], ["ultra", "Ultra"]] as const).map(([q, l]) => (
            <button key={q} onClick={() => { game.configure({ ...game.config, quality: q }); redraw((n) => n + 1); }} className={"rounded-lg border px-2 py-1.5 text-xs font-bold " + (game.config.quality === q ? "border-pink-400 bg-pink-500/30" : "border-white/15 bg-white/5")}>{l}</button>
          ))}
        </div>
        <Slider label="Sichtweite" value={s.viewDist} min={0.6} max={1.4} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={(v) => update({ ...s, viewDist: v })} />
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.shadows} onChange={(e) => update({ ...s, shadows: e.target.checked })} className="accent-pink-500" /> Schatten</label>
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.weather} onChange={(e) => update({ ...s, weather: e.target.checked })} className="accent-pink-500" /> Wetterwechsel</label>
        <div className="mb-2 mt-1 flex items-center gap-2"><span className="w-28 text-white/70">Tag-Nacht-Dauer</span>
          {([12, 24, 48] as const).map((m) => <button key={m} onClick={() => update({ ...s, dayMinutes: m })} className={"rounded-lg border px-2 py-1 text-xs font-bold " + (s.dayMinutes === m ? "border-pink-400 bg-pink-500/30" : "border-white/15 bg-white/5")}>{m} min</button>)}
        </div>
        <h3 className="mb-2 mt-3 font-display text-2xl tracking-widest text-pink-300">Fahrzeuge</h3>
        <Slider label="Tempo-Faktor" value={s.vehSpeed} min={1} max={5} step={0.25} fmt={(v) => `${v.toFixed(2).replace(".", ",").replace(/,?0+$/, "")}x`} onChange={(v) => update({ ...s, vehSpeed: v })} />
        <Slider label="Verkehr" value={s.traffic} min={0} max={3} step={0.25} fmt={(v) => (v === 0 ? "aus" : `${Math.round(v * 100)} %`)} onChange={(v) => update({ ...s, traffic: v })} />
        <div className="mb-2 text-[11px] text-white/45">Tempo-Faktor gilt für dein Auto, Boot und deinen Hubschrauber (Höchsttempo und Beschleunigung).</div>
        <h3 className="mb-2 mt-3 font-display text-2xl tracking-widest text-pink-300">Anzeige & Steuerung</h3>
        <Slider label="HUD-Größe" value={s.hudScale} min={0.8} max={1.3} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={(v) => update({ ...s, hudScale: v })} />
        <Slider label="Untertitel" value={s.subtitle} min={0.8} max={1.4} step={0.05} fmt={(v) => `${Math.round(v * 100)} %`} onChange={(v) => update({ ...s, subtitle: v })} />
        <Slider label="Kamera-Tempo" value={s.camSens} min={0.5} max={2} step={0.1} fmt={(v) => `${v.toFixed(1).replace(".", ",")}x`} onChange={(v) => update({ ...s, camSens: v })} />
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.camNear} onChange={(e) => update({ ...s, camNear: e.target.checked })} className="accent-pink-500" /> Kamera nah (Figuren und Autos größer im Bild)</label>
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.invertY} onChange={(e) => update({ ...s, invertY: e.target.checked })} className="accent-pink-500" /> Y-Achse umkehren</label>
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.mapRotate} onChange={(e) => update({ ...s, mapRotate: e.target.checked })} className="accent-pink-500" /> Minikarte dreht mit</label>
        <label className="mb-1 flex items-center gap-2"><input type="checkbox" checked={s.seekerCones} onChange={(e) => update({ ...s, seekerCones: e.target.checked })} className="accent-pink-500" /> Sichtkegel der Sucher (Versteckspiel)</label>
        <div className="mt-2 text-xs text-white/50">{game.pad.state.active ? `Gamepad verbunden: ${game.pad.state.name.slice(0, 40)}` : "Gamepad: anschließen und eine Taste drücken – die Belegung steht unter Hilfe."}</div>
      </div>
      {!isTouch && (
        <div className="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
          <h3 className="mb-2 font-display text-2xl tracking-widest text-pink-300">Tastenbelegung</h3>
          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {ACTIONS.map((a) => (
              <div key={a} className="flex items-center justify-between gap-2">
                <span className="text-white/75">{ACTION_LABEL[a]}</span>
                <button onClick={() => setWaiting(a)} className={"min-w-[5.5rem] rounded-lg border px-2 py-1 font-bold " + (waiting === a ? "animate-pulse border-pink-400 bg-pink-500/30" : "border-white/20 bg-white/5")}>
                  {waiting === a ? "Taste…" : keyLabel(game.bind.keys[a][0])}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-white/50"><span>Esc bricht ab</span><button onClick={() => { game.bind.reset(); redraw((n) => n + 1); }} className="underline">Standard</button></div>
        </div>
      )}
    </div>
  );
}
