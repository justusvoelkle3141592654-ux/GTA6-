import { useEffect, useRef, useState } from "react";
import {
  CARS, END_LABEL, Game, LEGACY_CAR_IDS,
  type CameraMode, type Difficulty, type GameConfig, type GameOverData, type GameState, type HudData, type Mode, type Quality, type TouchInput, type Weapon,
} from "./game/engine";
import { sfx } from "./game/audio";
import { MODE_RULES, type ModeRules } from "./game/modes";
import { loadSave, storageAvailable, type SaveData, type SaveResult } from "./game/save";
import { DEFAULT_NAME, loadName, loadScores, saveName, saveScore, type ScoreEntry } from "./game/scores";
import TouchControls from "./components/TouchControls";

const EMPTY_HUD: HudData = {
  score: 0, mult: 1, combo01: 0, stars: 1, searching: false, cash: 0, health01: 1, carHealth01: 1, nitro01: 1, kmh: 0, time: 0, drift: 0, bust01: 0, takedowns: 0,
  weapon: "pistol", rockets: 3, bombs: 2, bombsPlaced: 0, onFoot: false, canEnter: false, hint: "", air: false,
};
const fmt = (n: number) => n.toLocaleString("de-DE");
const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const DIFF_LABEL: Record<Difficulty, string> = { easy: "Leicht", normal: "Normal", hard: "Schwer" };
const CAM_LABEL: Record<CameraMode, string> = { chase: "3D Verfolger", fp: "Ego (im Auto)", top: "Vogelperspektive" };
const WICON: Record<Weapon, string> = { pistol: "🔫", rocket: "🚀", bomb: "💣" };
const WNAME: Record<Weapon, string> = { pistol: "Pistole", rocket: "Raketenwerfer", bomb: "Haftbombe" };
const SAVE_MSG: Record<SaveResult, string> = {
  saved: "Gespeichert ✓", memory: "Nur vorübergehend gespeichert – der Browser blockiert den lokalen Speicher",
  wanted: "Speichern geht nur ohne Fahndung (keine Sterne)", busy: "Gerade nicht möglich", mode: "",
};
const fmtDate = (t: number) => new Date(t).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const CFG_KEY = "solarabay.config.v1";
const LEGACY_CFG_KEY = "viceheat.config.v3";

function isTouchDevice() { return typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window); }
function loadConfig(): GameConfig {
  const def: GameConfig = { mode: "open", difficulty: "easy", car: "corsaro", camera: "chase", quality: isTouchDevice() ? "low" : "high" };
  try {
    const raw = localStorage.getItem(CFG_KEY) ?? localStorage.getItem(LEGACY_CFG_KEY);
    if (raw) {
      const cfg: GameConfig = { ...def, ...JSON.parse(raw) };
      cfg.car = LEGACY_CAR_IDS[cfg.car] ?? cfg.car;
      if (!(cfg.mode in MODE_RULES)) cfg.mode = def.mode;
      return cfg;
    }
  } catch { /* ignore */ }
  return def;
}

export default function App() {
  const glRef = useRef<HTMLCanvasElement>(null);
  const ovRef = useRef<HTMLCanvasElement>(null);
  const hurtRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const nameRef = useRef(loadName());
  const [config, setConfig] = useState<GameConfig>(loadConfig);
  const cfgRef = useRef(config);
  const [state, setState] = useState<GameState>("menu");
  const [hud, setHud] = useState<HudData>(EMPTY_HUD);
  const [over, setOver] = useState<GameOverData | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [rank, setRank] = useState(-1);
  const [name, setName] = useState(nameRef.current);
  const [muted, setMuted] = useState(false);
  const [touchInput, setTouchInput] = useState<TouchInput | null>(null);
  const [isTouch] = useState(isTouchDevice);
  const [glError, setGlError] = useState(false);
  const [save, setSave] = useState<SaveData | null>(loadSave);
  const [saveMsg, setSaveMsg] = useState("");
  const startKeyRef = useRef<() => void>(() => {});

  useEffect(() => {
    let game: Game;
    try {
      game = new Game(glRef.current!, ovRef.current!, {
        onHud: setHud,
        onState: setState,
        onCamera: (c: CameraMode) => updateConfig({ camera: c }, false),
        onStartKey: () => startKeyRef.current(),
        onGameOver: (d: GameOverData) => {
          setOver(d);
          const tag = d.mode === "free" ? "Frei" : DIFF_LABEL[d.difficulty];
          const entry: ScoreEntry = { name: (nameRef.current || DEFAULT_NAME).slice(0, 12).toUpperCase(), score: d.score, time: d.time, stars: d.maxStars, reason: d.reason, date: Date.now(), tag };
          const res = saveScore(entry);
          setScores(res.list); setRank(res.rank);
        },
        onHurt: (amt: number) => {
          const el = hurtRef.current;
          if (!el) return;
          el.style.transition = "none";
          el.style.opacity = String(Math.min(0.85, 0.25 + amt / 20));
          requestAnimationFrame(() => { el.style.transition = "opacity 0.45s ease-out"; el.style.opacity = "0"; });
          if (navigator.vibrate && amt > 4) navigator.vibrate(Math.min(60, amt * 4));
        },
      }, cfgRef.current);
    } catch (e) { console.error(e); setGlError(true); return; }
    gameRef.current = game;
    if (import.meta.env.DEV) (window as unknown as { game?: Game }).game = game; // debugging / automated tests
    setTouchInput(game.touch);
    return () => game.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateConfig(patch: Partial<GameConfig>, apply = true) {
    const next = { ...cfgRef.current, ...patch };
    cfgRef.current = next;
    setConfig(next);
    try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    if (apply) gameRef.current?.configure(next);
  }

  const start = () => { saveName(nameRef.current); setOver(null); setRank(-1); setHud(EMPTY_HUD); gameRef.current?.configure(cfgRef.current); gameRef.current?.start(); };
  const continueGame = () => {
    const sv = loadSave();
    if (!sv) { setSave(null); start(); return; }
    saveName(nameRef.current); setOver(null); setRank(-1); setHud(EMPTY_HUD);
    updateConfig({ mode: "open", difficulty: sv.difficulty });
    gameRef.current?.start(sv);
  };
  // main button / Enter: continue the saved open-world game if there is one
  const primary = () => { if (cfgRef.current.mode === "open" && loadSave()) continueGame(); else start(); };
  startKeyRef.current = () => { if (gameRef.current?.state === "menu") primary(); else start(); };
  const saveNow = () => { const g = gameRef.current; if (!g) return; setSaveMsg(SAVE_MSG[g.saveGame()]); setSave(loadSave()); };
  const toMenu = () => {
    const g = gameRef.current;
    if (g && config.mode === "open") { g.saveGame(); setSave(loadSave()); }
    setOver(null); g?.setupMenu();
  };
  const toggleMute = () => { const m = !muted; setMuted(m); sfx.setMuted(m); };
  const cycleCam = () => gameRef.current?.cycleCamera();

  useEffect(() => { if (state === "paused") setSaveMsg(""); }, [state]);

  const playing = state === "playing";
  const rules = MODE_RULES[config.mode];
  const open = config.mode === "open";

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0b0614] font-sans text-white">
      <canvas ref={glRef} className="absolute inset-0 block h-full w-full" />
      <canvas ref={ovRef} className="pointer-events-none absolute inset-0 block" />
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 60%, rgba(5,0,15,0.6) 100%)" }} />
      <div ref={hurtRef} className="pointer-events-none absolute inset-0 opacity-0" style={{ background: "radial-gradient(ellipse at center, transparent 35%, rgba(255,20,50,0.75) 100%)" }} />
      {((hud.onFoot ? hud.health01 : hud.carHealth01) < 0.3) && playing && rules.damage && (
        <div className="pointer-events-none absolute inset-0 animate-pulse" style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(255,0,40,0.3) 100%)" }} />
      )}

      {glError && (
        <Overlay>
          <h2 className="font-display text-5xl text-pink-400">WebGL nicht verfügbar</h2>
          <p className="mt-2 max-w-sm text-center text-white/70">Dein Browser unterstützt kein 3D (WebGL). Bitte aktiviere die Hardwarebeschleunigung oder nutze einen aktuellen Browser.</p>
        </Overlay>
      )}

      {(playing || state === "paused") && (
        <Hud hud={hud} isTouch={isTouch} rules={rules} camera={config.camera} onPause={() => gameRef.current?.pause()} onCam={cycleCam} onToggleCar={() => gameRef.current?.toggleCar()} onDetonate={() => gameRef.current?.detonate()} onWeapon={(w) => gameRef.current?.setWeapon(w)} />
      )}
      {playing && isTouch && touchInput && (
        <TouchControls input={touchInput} nitro01={hud.nitro01} relative={config.camera !== "top"} onFoot={hud.onFoot} weapon={hud.weapon} rockets={hud.rockets} bombs={hud.bombs} bombsPlaced={hud.bombsPlaced}
          onCycleWeapon={() => gameRef.current?.cycleWeapon()} onDetonate={() => gameRef.current?.detonate()} />
      )}

      {state === "menu" && !glError && (
        <StartScreen name={name} setName={(n) => { setName(n); nameRef.current = n; }} scores={scores} config={config} update={updateConfig} onStart={primary} onNew={start} save={save} isTouch={isTouch} muted={muted} toggleMute={toggleMute} />
      )}

      {state === "paused" && (
        <Overlay>
          <h2 className="popin font-display text-7xl tracking-wider text-white neon-text">PAUSE</h2>
          <div className="mt-2 text-sm text-white/60">{open ? `$${fmt(hud.cash)}` : `Score: ${fmt(hud.score)}`} · {fmtTime(hud.time)}</div>
          <div className="mt-8 flex w-72 flex-col gap-3">
            <Btn primary onClick={() => gameRef.current?.resume()}>Weiter</Btn>
            <Btn onClick={cycleCam}>Kamera: {CAM_LABEL[config.camera]}</Btn>
            {open && <Btn onClick={saveNow}>Speichern</Btn>}
            {open && saveMsg && <div className="-mt-1 text-center text-xs text-white/70">{saveMsg}</div>}
            {!open && <Btn onClick={() => gameRef.current?.finish()}>Fahrt beenden</Btn>}
            {!open && <Btn onClick={start}>Neustart</Btn>}
            <Btn onClick={toggleMute}>{muted ? "Ton an" : "Ton aus"}</Btn>
            <Btn onClick={toMenu}>Hauptmenü</Btn>
          </div>
          {!isTouch && <div className="mt-6 text-xs text-white/40">P / ESC = weiter · C = Kamera{!open && " · R = Neustart"}</div>}
        </Overlay>
      )}

      {state === "over" && over && <GameOver data={over} scores={scores} rank={rank} onRestart={start} onMenu={toMenu} isTouch={isTouch} />}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-y-auto bg-[#0b0614]/70 p-6 backdrop-blur-sm">{children}</div>;
}

function Btn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} className={"w-full rounded-xl px-6 py-3 font-display text-2xl tracking-widest transition-all active:scale-95 " + (primary ? "pulseglow bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white hover:brightness-110" : "border border-white/20 bg-white/5 text-white/90 hover:border-cyan-300/60 hover:bg-white/10")}>
      {children}
    </button>
  );
}

function Stars({ n, size = "text-2xl" }: { n: number; size?: string }) {
  return (
    <div className={`flex gap-0.5 ${size} leading-none`}>
      {[0, 1, 2, 3, 4].map((i) => <span key={i} className={i < n ? "text-yellow-300" : "text-white/15"} style={i < n ? { textShadow: "0 0 10px rgba(255,210,63,0.9)" } : undefined}>★</span>)}
    </div>
  );
}

function Hud({ hud, isTouch, rules, camera, onPause, onCam, onToggleCar, onDetonate, onWeapon }: {
  hud: HudData; isTouch: boolean; rules: ModeRules; camera: CameraMode; onPause: () => void; onCam: () => void; onToggleCar: () => void; onDetonate: () => void; onWeapon: (w: Weapon) => void;
}) {
  const ammo = (w: Weapon) => (w === "rocket" ? hud.rockets : w === "bomb" ? hud.bombs : "∞");
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      <div className="absolute left-3 top-3 sm:left-5 sm:top-4">
        {rules.respawn ? (
          <div className="font-display text-4xl leading-none tracking-wide text-green-300 sm:text-6xl" style={{ textShadow: "0 3px 0 rgba(0,0,0,0.6), 0 0 18px rgba(61,255,139,0.5)" }}>${fmt(hud.cash)}</div>
        ) : (
          <div className="font-display text-4xl leading-none tracking-wide text-white sm:text-6xl" style={{ textShadow: "0 3px 0 rgba(0,0,0,0.6), 0 0 18px rgba(255,60,172,0.6)" }}>{fmt(hud.score)}</div>
        )}
        {!rules.respawn && <div className="mt-1 flex items-center gap-2">
          <div key={hud.mult} className={"popin rounded-md px-2 py-0.5 font-display text-xl tracking-wider sm:text-2xl " + (hud.mult > 1 ? "bg-pink-500 text-white shadow-[0_0_14px_rgba(255,60,172,0.9)]" : "bg-white/10 text-white/60")}>x{hud.mult}</div>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10 sm:w-28"><div className="h-full bg-gradient-to-r from-pink-500 to-yellow-300" style={{ width: `${hud.combo01 * 100}%` }} /></div>
        </div>}
        {rules.cops && <div className={"mt-2" + (hud.searching ? " animate-pulse" : "")}><Stars n={hud.stars} size={isTouch ? "text-xl" : "text-3xl"} /></div>}
        <div className="mt-2 w-36 space-y-1.5 sm:w-52">
          {rules.damage && <Bar label="DU" value={hud.health01} from={hud.health01 < 0.3 ? "#ff1a3a" : "#3dff8b"} to={hud.health01 < 0.3 ? "#ff6b3d" : "#9dffc8"} />}
          {rules.damage && !hud.onFoot && <Bar label="AUTO" value={hud.carHealth01} from={hud.carHealth01 < 0.3 ? "#ff1a3a" : "#ff3cac"} to={hud.carHealth01 < 0.3 ? "#ff6b3d" : "#ff8ad1"} />}
          {!hud.onFoot && <Bar label="N2O" value={hud.nitro01} from="#2bf0ff" to="#9d4dff" />}
        </div>
      </div>

      <div className="pointer-events-auto absolute left-1/2 top-3 flex -translate-x-1/2 gap-2">
        <button onClick={onPause} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur active:scale-90" aria-label="Pause">
          <span className="flex gap-1"><span className="h-4 w-1.5 rounded bg-white" /><span className="h-4 w-1.5 rounded bg-white" /></span>
        </button>
        <button onClick={onCam} className="flex h-11 items-center justify-center rounded-full border border-white/20 bg-black/40 px-3 text-xs font-bold tracking-wider backdrop-blur active:scale-90">🎥 {camera === "chase" ? "3D" : camera === "fp" ? "EGO" : "TOP"}</button>
        <button onClick={onToggleCar} className={"flex h-11 items-center justify-center rounded-full border px-3 text-xs font-bold tracking-wider backdrop-blur active:scale-90 " + (hud.onFoot && hud.canEnter ? "animate-pulse border-yellow-300 bg-yellow-400/30" : "border-white/20 bg-black/40")}>
          {hud.onFoot ? "🚗 EINSTEIGEN" : "🚪 AUSSTEIGEN"}
        </button>
      </div>
      <div className="absolute left-1/2 top-16 -translate-x-1/2 text-center text-xs font-semibold tracking-widest text-white/60">{fmtTime(hud.time)}{rules.cops && <> · {hud.takedowns} 🚓</>}</div>
      {hud.hint && <div className="popin absolute left-1/2 top-24 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm font-semibold text-yellow-200 backdrop-blur">{hud.hint}</div>}
      {hud.air && <div className="popin absolute left-1/2 top-[30%] -translate-x-1/2 font-display text-5xl tracking-widest text-cyan-200" style={{ textShadow: "0 0 20px rgba(43,240,255,0.8)" }}>AIR!</div>}

      {/* weapon */}
      <div className={"pointer-events-auto absolute right-3 flex items-center gap-1.5 " + (isTouch ? "bottom-40 right-4 hidden" : "bottom-6")}>
        {(["pistol", "rocket", "bomb"] as Weapon[]).map((w, i) => (
          <button key={w} onClick={() => onWeapon(w)} className={"flex h-14 w-16 flex-col items-center justify-center rounded-xl border transition-all " + (hud.weapon === w ? "border-pink-400 bg-pink-500/30 shadow-[0_0_16px_rgba(255,60,172,0.6)]" : "border-white/15 bg-black/40 hover:border-white/40")}>
            <span className="text-xl leading-none">{WICON[w]}</span>
            <span className="font-display text-sm tracking-wider text-white/80">{ammo(w)} <span className="text-[9px] text-white/40">[{i + 1}]</span></span>
          </button>
        ))}
        {hud.bombsPlaced > 0 && <button onClick={onDetonate} className="ml-2 flex h-14 w-20 animate-pulse flex-col items-center justify-center rounded-xl border border-red-400 bg-red-600/60 shadow-[0_0_20px_rgba(255,40,60,0.8)]"><span className="text-xl">💥</span><span className="font-display text-sm tracking-wider">ZÜNDEN [G]</span></button>}
      </div>
      {!isTouch && <div className="absolute bottom-24 right-4 text-right text-[11px] text-white/45">{WNAME[hud.weapon]} · Klick / F = Feuer · Q = Wechsel</div>}

      {!isTouch ? (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center">
          <div className="cyan-text font-display text-5xl leading-none tracking-wider">{hud.kmh}</div>
          <div className="text-[10px] font-semibold tracking-[0.3em] text-white/50">KM/H</div>
        </div>
      ) : (
        <div className="cyan-text absolute bottom-3 left-1/2 -translate-x-1/2 font-display text-2xl tracking-wider">{hud.kmh} <span className="text-xs text-white/50">KM/H</span></div>
      )}

      {hud.drift > 30 && (
        <div className="absolute left-1/2 top-[62%] -translate-x-1/2 text-center">
          <div className="font-display text-xl tracking-[0.3em] text-yellow-200/80">DRIFT</div>
          <div className="font-display text-5xl leading-none text-yellow-300" style={{ textShadow: "0 0 18px rgba(255,210,63,0.8), 0 3px 0 rgba(0,0,0,0.6)", transform: `scale(${1 + Math.min(0.5, hud.drift / 4000)})` }}>{fmt(hud.drift)}</div>
        </div>
      )}
      {rules.cops && hud.bust01 > 0.02 && (
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 text-center">
          <div className="animate-pulse font-display text-3xl tracking-widest text-blue-300" style={{ textShadow: "0 0 14px rgba(60,120,255,0.9)" }}>FESTNAHME!</div>
          <div className="mx-auto mt-1 h-2 w-48 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-blue-500 to-red-500" style={{ width: `${hud.bust01 * 100}%` }} /></div>
          <div className="mt-1 text-xs text-white/70">{hud.onFoot ? "Lauf weg oder schieß!" : "Gib Gas, um zu entkommen!"}</div>
        </div>
      )}
    </div>
  );
}

function Bar({ label, value, from, to }: { label: string; value: number; from: string; to: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-[10px] font-extrabold tracking-wider text-white/70">{label}</span>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
        <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${Math.max(0, value) * 100}%`, background: `linear-gradient(90deg, ${from}, ${to})`, boxShadow: `0 0 10px ${from}` }} />
      </div>
    </div>
  );
}

function ScoreTable({ scores, highlight = -1, limit = 10 }: { scores: ScoreEntry[]; highlight?: number; limit?: number }) {
  if (!scores.length) return <div className="py-6 text-center text-sm text-white/40">Noch keine Einträge – sei der Erste!</div>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {scores.slice(0, limit).map((s, i) => (
          <tr key={s.date + "-" + i} className={i === highlight ? "bg-pink-500/25 text-white" : i % 2 ? "bg-white/[0.03]" : ""}>
            <td className={"w-8 py-1.5 pl-2 font-display text-lg " + (i === 0 ? "text-yellow-300" : i === 1 ? "text-slate-200" : i === 2 ? "text-amber-500" : "text-white/40")}>{i + 1}</td>
            <td className="py-1.5 font-semibold tracking-wide">{s.name}</td>
            <td className="py-1.5 text-[10px] uppercase tracking-wider text-white/40">{s.tag || ""}</td>
            <td className="py-1.5 pr-2 text-right font-display text-lg tracking-wide text-cyan-200">{fmt(s.score)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Choice<T extends string>({ value, options, onChange, disabled }: { value: T; options: { v: T; label: string; sub?: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className={"grid gap-2 " + (options.length === 3 ? "grid-cols-3" : "grid-cols-2") + (disabled ? " pointer-events-none opacity-35" : "")}>
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={"rounded-xl border px-2 py-2 text-center transition-all active:scale-95 " + (value === o.v ? "border-pink-400 bg-pink-500/25 shadow-[0_0_16px_rgba(255,60,172,0.45)]" : "border-white/15 bg-black/30 hover:border-white/35")}>
          <div className="font-display text-xl leading-none tracking-wider">{o.label}</div>
          {o.sub && <div className="mt-1 text-[10px] leading-tight text-white/55">{o.sub}</div>}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">{title}</div>{children}</div>;
}
function StatBar({ v, color }: { v: number; color: string }) {
  return <div className="h-1 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.round(v * 100)}%`, background: color }} /></div>;
}

function StartScreen({ name, setName, scores, config, update, onStart, onNew, save, isTouch, muted, toggleMute }: {
  name: string; setName: (n: string) => void; scores: ScoreEntry[]; config: GameConfig; update: (p: Partial<GameConfig>) => void;
  onStart: () => void; onNew: () => void; save: SaveData | null; isTouch: boolean; muted: boolean; toggleMute: () => void;
}) {
  const [tab, setTab] = useState<"setup" | "scores" | "help">("setup");
  const [confirmNew, setConfirmNew] = useState(false);
  const cont = config.mode === "open" && !!save;
  const startLabel = cont ? "WEITERSPIELEN" : "LOS GEHT'S";
  const saveBox = cont && save && (
    <div className="rounded-xl border border-green-300/30 bg-green-400/10 p-3 text-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-green-200/80">Spielstand</div>
      <div className="mt-1 text-white/85">${fmt(save.cash)} · Spielzeit {fmtTime(save.stats.playTime)} · gespeichert {fmtDate(save.savedAt)}</div>
      <button onClick={() => { if (confirmNew) { setConfirmNew(false); onNew(); } else setConfirmNew(true); }} className="mt-2 text-xs font-semibold text-white/60 underline hover:text-white">
        {confirmNew ? "Wirklich neu anfangen? Der Spielstand wird beim nächsten Speichern überschrieben – nochmal tippen" : "Neues Spiel starten"}
      </button>
    </div>
  );
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b0614]/95 via-[#0b0614]/55 to-[#0b0614]/80 lg:to-transparent" />
      <div className="scanlines pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:gap-10">
        <div className="flex flex-col items-center text-center lg:w-[42%] lg:items-start lg:text-left">
          <div className="mb-2 rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-200">3D Open World · Stadt & Berge</div>
          <h1 className="floaty font-display text-[24vw] leading-[0.82] tracking-wide text-white neon-text sm:text-[8.5rem]">
            SOLARA<br /><span className="bg-gradient-to-b from-yellow-200 via-orange-400 to-pink-500 bg-clip-text text-transparent" style={{ textShadow: "none", filter: "drop-shadow(0 0 18px rgba(255,120,60,0.6))" }}>BAY</span>
          </h1>
          <p className="mt-3 max-w-md text-sm text-white/75 sm:text-base">Solara Bay und die Berge dahinter: klau Autos, steig aus, schieß mit Pistole, Raketenwerfer und Haftbomben zurück – oder genieß einfach die Fahrt über die Hügel.</p>
          <div className="mt-5 hidden w-full max-w-sm lg:block">
            <button onClick={onStart} className="pulseglow w-full rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-orange-400 px-8 py-4 font-display text-4xl tracking-[0.2em] text-white transition-transform hover:scale-[1.03] active:scale-95">{startLabel}</button>
            <div className="mt-2 text-xs text-white/40">Enter zum Starten</div>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-white/10 bg-black/55 p-4 backdrop-blur-md lg:w-[58%]">
          <div className="mb-4 flex gap-1 rounded-xl bg-white/5 p-1">
            {([["setup", "Einstellungen"], ["scores", "Bestenliste"], ["help", "Steuerung"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={"flex-1 rounded-lg py-2 font-display text-lg tracking-widest transition-colors " + (tab === k ? "bg-pink-500 text-white" : "text-white/60 hover:text-white")}>{l}</button>
            ))}
          </div>

          {tab === "setup" && (
            <div className="space-y-4">
              {saveBox}
              {config.mode === "open" && !storageAvailable() && <div className="rounded-xl border border-yellow-300/30 bg-yellow-300/10 p-3 text-xs text-yellow-100">Dein Browser blockiert den lokalen Speicher – der Fortschritt bleibt nur bis zum Neuladen der Seite erhalten.</div>}
              <Section title="Spielmodus">
                <Choice<Mode> value={config.mode} onChange={(v) => update({ mode: v })} options={[{ v: "open", label: "Open World", sub: "Stadtleben, Fahndung, Respawn" }, { v: "chase", label: "Verfolgungsjagd", sub: "Cops, Sterne, Takedowns" }, { v: "free", label: "Freie Fahrt", sub: "Keine Cops, kein Schaden" }]} />
              </Section>
              <Section title="Schwierigkeit">
                <Choice<Difficulty> value={config.difficulty} disabled={config.mode === "free"} onChange={(v) => update({ difficulty: v })} options={[{ v: "easy", label: "Leicht", sub: "Wenig Cops, Heilung" }, { v: "normal", label: "Normal", sub: "Ausgewogen" }, { v: "hard", label: "Schwer", sub: "Bis zu 9 Cops" }]} />
              </Section>
              <Section title="Dein Auto (unterwegs klaust du dir einfach ein anderes)">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CARS.map((c) => (
                    <button key={c.id} onClick={() => update({ car: c.id })} className={"rounded-xl border p-2 text-left transition-all active:scale-95 " + (config.car === c.id ? "border-pink-400 bg-pink-500/20 shadow-[0_0_16px_rgba(255,60,172,0.45)]" : "border-white/15 bg-black/30 hover:border-white/35")}>
                      <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} /><span className="font-display text-xl leading-none tracking-wider">{c.name}</span></div>
                      <div className="mb-1.5 mt-0.5 text-[10px] text-white/55">{c.desc}</div>
                      <div className="space-y-1">
                        <StatBar v={(c.maxV - 400) / 280} color="#2bf0ff" /><StatBar v={(c.acc - 450) / 320} color="#ffd23f" /><StatBar v={c.hp / 230} color="#ff3cac" /><StatBar v={1 - (c.grip - 6) / 7} color="#3dff8b" />
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex gap-3 text-[10px] text-white/45"><span><b className="text-cyan-300">■</b> Tempo</span><span><b className="text-yellow-300">■</b> Beschl.</span><span><b className="text-pink-400">■</b> Panzerung</span><span><b className="text-green-400">■</b> Drift</span></div>
              </Section>
              <Section title="Kamera (im Spiel mit C / 🎥 wechselbar)">
                <Choice<CameraMode> value={config.camera} onChange={(v) => update({ camera: v })} options={[{ v: "chase", label: "3D Verfolger" }, { v: "fp", label: "Ego-Sicht", sub: "Im Auto sitzen" }, { v: "top", label: "Vogelperspektive" }]} />
              </Section>
              <Section title="Grafik">
                <Choice<Quality> value={config.quality} onChange={(v) => update({ quality: v })} options={[{ v: "high", label: "Ultra", sub: "Bloom + Schatten + dichter Wald" }, { v: "low", label: "Schnell", sub: "Für Handys" }]} />
              </Section>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Section title="Dein Name">
                    <input value={name} maxLength={12} onChange={(e) => setName(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") onStart(); }} className="w-full rounded-xl border border-white/20 bg-black/40 px-4 py-2.5 font-display text-2xl tracking-widest text-white outline-none focus:border-pink-400 focus:shadow-[0_0_18px_rgba(255,60,172,0.5)]" />
                  </Section>
                </div>
                <button onClick={toggleMute} className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white/70 hover:text-white">{muted ? "🔇 Ton aus" : "🔊 Ton an"}</button>
              </div>
              <button onClick={onStart} className="pulseglow w-full rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-orange-400 px-8 py-4 font-display text-4xl tracking-[0.2em] text-white transition-transform active:scale-95 lg:hidden">{startLabel}</button>
            </div>
          )}

          {tab === "scores" && <ScoreTable scores={scores} />}

          {tab === "help" && (
            <div className="text-sm">
              {isTouch ? (
                <ul className="space-y-2 text-white/80">
                  <li><b className="text-white">Linker Daumen</b> – fahren / laufen (3D & Ego: hoch = Gas, seitlich = lenken; Vogelperspektive: Richtung ziehen)</li>
                  <li><b className="text-orange-300">FEUER</b> – schießt automatisch auf den nächsten Cop · <b>🔫/🚀/💣</b> antippen = Waffe wechseln · <b>💥</b> = Bomben zünden</li>
                  <li><b className="text-pink-300">DRIFT</b> – Handbremse · <b className="text-cyan-300">NITRO / SPRINT</b></li>
                  <li><b>🚪 / 🚗</b> oben – aus- & einsteigen (jedes Auto lässt sich klauen) · <b>🎥</b> – Kamera</li>
                  <li><b>⏸</b> Pause – <b>Speichern</b> (Open World, nur ohne Sterne)</li>
                </ul>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-white/80">
                  <span><Key>W A S D</Key> / <Key>↑←↓→</Key></span><span>Fahren / Laufen</span>
                  <span><Key>Leertaste</Key></span><span>Handbremse / Drift</span>
                  <span><Key>Shift</Key></span><span>Nitro / Sprint</span>
                  <span><Key>Maus</Key> / <Key>F</Key> / <Key>Strg</Key></span><span>Feuer (Auto-Zielen auf Cops)</span>
                  <span><Key>1</Key> <Key>2</Key> <Key>3</Key> / <Key>Q</Key> / Mausrad</span><span>Pistole · Raketenwerfer · Haftbombe</span>
                  <span><Key>G</Key></span><span>Haftbomben zünden</span>
                  <span><Key>E</Key></span><span>Aussteigen / Einsteigen (Auto klauen)</span>
                  <span><Key>C</Key></span><span>Kamera: 3D → Ego → Vogel</span>
                  <span><Key>P</Key> / <Key>Esc</Key></span><span>Pause (dort: Speichern in der Open World)</span>
                </div>
              )}
              <div className="mt-4 border-t border-white/10 pt-3 text-xs leading-relaxed text-white/60">
                🔫 Pistole: 3 Treffer = Cop kaputt · 🚀 Rakete: 1 Treffer · 💣 Haftbombe klebt an Autos, zünden mit G<br />
                Säulen: <b className="text-green-300">grün</b> Cash · <b className="text-orange-300">orange</b> Raketen · <b className="text-red-300">rot</b> Bomben · <b className="text-cyan-300">blau</b> Nitro · <b>weiß</b> Reparatur<br />
                ⛰️ Über die Highways raus in die Berge – Sprünge geben AIRTIME-Punkte. Cops folgen dir überall hin.<br />
                🌆 <b>Open World:</b> Verbrechen bringen Sterne. Bleib außer Sicht der Cops, bis die Sterne aufhören zu blinken – dann bist du entkommen.
                Erledigt → <b className="text-red-300">Krankenhaus (+)</b>, verhaftet → <b className="text-blue-300">Polizeiwache (★)</b>, jeweils mit Geldverlust und ohne Spezialmunition.<br />
                🚗 Geparkte Autos am Straßenrand lassen sich unauffälliger klauen als besetzte – der Fahrer flüchtet. Passanten anfahren oder anschießen bringt Sterne.<br />
                💾 Automatisches Speichern jede Minute, sobald du keine Sterne hast. Hauptmenü speichert ebenfalls.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-white/25 bg-white/10 px-1.5 py-0.5 font-sans text-[11px] font-bold text-white">{children}</kbd>;
}

function GameOver({ data, scores, rank, onRestart, onMenu, isTouch }: { data: GameOverData; scores: ScoreEntry[]; rank: number; onRestart: () => void; onMenu: () => void; isTouch: boolean }) {
  const title = data.reason === "finished" ? "FAHRT BEENDET" : END_LABEL[data.reason];
  const color = data.reason === "dead" ? "#ff2a3a" : data.reason === "arrested" ? "#4da3ff" : "#ff3cac";
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0b0614]/75 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-5 py-8">
        <h2 className="popin text-center font-display text-7xl tracking-wider sm:text-9xl" style={{ color, textShadow: `0 0 30px ${color}` }}>{title}</h2>
        {rank === 0 && <div className="popin mt-1 rounded-full bg-yellow-300 px-4 py-1 font-display text-xl tracking-widest text-black shadow-[0_0_24px_rgba(255,210,63,0.9)]">NEUER REKORD!</div>}
        {rank > 0 && <div className="popin mt-1 rounded-full bg-pink-500 px-4 py-1 font-display text-xl tracking-widest">PLATZ {rank + 1} IN DER BESTENLISTE</div>}
        <div className="mt-4 font-display text-6xl tracking-wide text-white sm:text-7xl" style={{ textShadow: "0 0 20px rgba(255,60,172,0.7)" }}>{fmt(data.score)}</div>
        <div className="mt-1 text-xs uppercase tracking-widest text-white/50">{data.mode === "free" ? "Freie Fahrt" : `Verfolgungsjagd · ${DIFF_LABEL[data.difficulty]}`}</div>
        <div className="mt-4 grid w-full max-w-lg grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Zeit" value={fmtTime(data.time)} /><Stat label="Cash" value={"$" + fmt(data.cash)} /><Stat label="Bester Drift" value={fmt(data.bestDrift)} /><Stat label="Cops erledigt" value={data.mode === "free" ? "–" : String(data.takedowns)} />
        </div>
        <div className="mt-6 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
          <div className="flex-1"><Btn primary onClick={onRestart}>NOCHMAL</Btn></div>
          <div className="flex-1"><Btn onClick={onMenu}>MENÜ</Btn></div>
        </div>
        {!isTouch && <div className="mt-2 text-xs text-white/40">Enter / R für sofortigen Neustart</div>}
        <div className="mt-6 w-full max-w-md rounded-2xl border border-pink-400/30 bg-black/50 p-4">
          <h3 className="mb-2 font-display text-2xl tracking-widest text-pink-300">Bestenliste</h3>
          <ScoreTable scores={scores} highlight={rank} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50">{label}</div>
      <div className="font-display text-2xl tracking-wide text-white">{value}</div>
    </div>
  );
}
