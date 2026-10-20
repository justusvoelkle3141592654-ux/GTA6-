import { useEffect, useState } from "react";
import type { CameraMode, Game, GameConfig, HudData } from "../game/engine";
import type { SaveResult } from "../game/save";
import { MISSIONS } from "../game/missions";
import { JOB_DEFS, JOB_KINDS, RACES } from "../game/jobs";
import { ACTIONS, ACTION_LABEL, keyLabel, type Action } from "../game/input";
import { CHANNELS } from "../game/audio";
import { CHANNEL_LABEL, applySettings, loadSettings, saveSettings, type Settings } from "../game/settings";
import BigMap from "./BigMap";
import Help from "./Help";
import { Btn, fmt, fmtTime } from "./ui";

export type PauseTab = "menu" | "map" | "progress" | "settings" | "help";
const CAM_LABEL: Record<CameraMode, string> = { chase: "3D Verfolger", fp: "Ego (im Auto)", top: "Vogelperspektive" };
const SAVE_MSG: Record<SaveResult, string> = {
  saved: "Gespeichert ✓", memory: "Nur vorübergehend gespeichert – der Browser blockiert den lokalen Speicher",
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
  const tabs: [PauseTab, string][] = open ? [["menu", "Menü"], ["map", "Karte"], ["progress", "Fortschritt"], ["settings", "Optionen"], ["help", "Hilfe"]] : [["menu", "Menü"], ["settings", "Optionen"], ["help", "Hilfe"]];
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
        {tab === "map" && <BigMap game={game} onChange={() => redraw((n) => n + 1)} />}
        {tab === "progress" && <Progress game={game} />}
        {tab === "settings" && <SettingsTab game={game} isTouch={isTouch} />}
        {tab === "help" && <div className="rounded-2xl border border-white/10 bg-black/50 p-4"><Help isTouch={isTouch} bind={game.bind} /></div>}
      </div>
    </div>
  );
}

function Progress({ game }: { game: Game }) {
  const pr = game.progress, st = game.stats, done = new Set(pr.missions);
  const rep = (v: number) => (v <= -30 ? "feindlich" : v >= 30 ? "freundlich" : "neutral");
  const pct = Math.round(((pr.missions.length / MISSIONS.length) * 0.5 + (pr.shells.length / Math.max(1, game.jobs.shells.length)) * 0.2 + (pr.jumps.length / Math.max(1, game.jobs.jumps.length)) * 0.15 + (Object.keys(pr.records).length / RACES.length) * 0.15) * 100);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
            return <li key={m.id} className={done.has(m.id) ? "text-green-300" : avail ? "text-white" : "text-white/35"}>{done.has(m.id) ? "✓" : avail ? "▸" : "·"} {m.title} {avail && <span className="text-xs text-pink-300">({giver?.name})</span>}</li>;
          })}
        </ul>
      </div>
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm">
          <h3 className="mb-2 font-display text-2xl tracking-widest text-pink-300">Nebenbei</h3>
          <div>🐚 Muscheln: <b>{pr.shells.length}/{game.jobs.shells.length}</b></div>
          <div>🛹 Stuntsprünge: <b>{pr.jumps.length}/{game.jobs.jumps.length}</b></div>
          {JOB_KINDS.map((k) => <div key={k}>💼 {JOB_DEFS[k].name}: <b>{pr.jobs[k] ?? 0}</b> erledigt <span className="text-xs text-white/45">({JOB_DEFS[k].models.join("/")})</span></div>)}
          {RACES.map((r) => <div key={r.id}>🏁 {r.name}: <b>{pr.records[r.id] ? `${pr.records[r.id].toFixed(1)} s` : "–"}</b> <span className="text-xs text-white/45">(Ziel {r.par} s)</span></div>)}
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
            <span>Max. Fahndung</span><b>{"★".repeat(Math.max(st.maxStars, game.wanted.maxStars))}</b>
            <span>Halcones</span><b>{rep(pr.rep.halcones)}</b>
            <span>Neon Kings</span><b>{rep(pr.rep.kings)}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ game, isTouch }: { game: Game; isTouch: boolean }) {
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
    <div className="grid gap-3 sm:grid-cols-2">
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
