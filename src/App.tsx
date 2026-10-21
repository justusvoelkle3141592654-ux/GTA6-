import { useEffect, useRef, useState } from "react";
import {
  Game, LEGACY_CAR_IDS,
  type CameraMode, type GameConfig, type GameOverData, type GameState, type HudData, type ModalInfo, type TouchInput,
} from "./game/engine";
import { sfx } from "./game/audio";
import { MODE_RULES } from "./game/modes";
import { loadSave, type SaveData } from "./game/save";
import { DEFAULT_NAME, loadName, loadScores, saveName, saveScore, type ScoreEntry } from "./game/scores";
import TouchControls from "./components/TouchControls";
import Hud from "./components/Hud";
import ShopMenu from "./components/ShopMenu";
import DialogBox from "./components/DialogBox";
import WeaponWheel from "./components/WeaponWheel";
import StartScreen from "./components/StartScreen";
import GameOver, { DIFF_LABEL } from "./components/GameOver";
import PauseMenu, { type PauseTab } from "./components/PauseMenu";
import { Overlay, ammoText } from "./components/ui";
import { loadSettings, applySettings } from "./game/settings";

const EMPTY_HUD: HudData = {
  score: 0, mult: 1, combo01: 0, stars: 1, searching: false, cash: 0, health01: 1, carHealth01: 1, nitro01: 1, kmh: 0, time: 0, drift: 0, bust01: 0, takedowns: 0,
  weapon: "pistol", ammo: -1, reserve: -1, reloading: false, owned: ["pistol"], bombsPlaced: 0, onFoot: false, canEnter: false, hint: "", air: false,
  armor01: 0, district: "", districtColor: "", place: "", radio: "", objective: "", objTimer: -1, job: "", alt: -1, swim: false,
};
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
  const [modal, setModal] = useState<ModalInfo | null>(null);
  const [pauseTab, setPauseTab] = useState<PauseTab>("menu");
  const startKeyRef = useRef<() => void>(() => {});
  const backRef = useRef<() => boolean>(() => false);

  useEffect(() => {
    // wait for the bundled fonts (signs in the 3D world are drawn once with them), at most 1.5 s
    let game: Game | null = null, gone = false;
    const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
    fontsReady.then(() => { if (!gone) game = createGame(); });
    return () => { gone = true; game?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createGame(): Game | null {
    let game: Game;
    applySettings(loadSettings());
    try {
      game = new Game(glRef.current!, ovRef.current!, {
        onHud: setHud,
        onState: setState,
        onModal: setModal,
        onMapKey: () => setPauseTab("map"),
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
    } catch (e) { console.error(e); setGlError(true); return null; }
    gameRef.current = game;
    if (import.meta.env.DEV) (window as unknown as { game?: Game }).game = game; // debugging / automated tests
    setTouchInput(game.touch);
    return game;
  }

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
  const toMenu = () => {
    const g = gameRef.current;
    if (g && config.mode === "open") { g.saveGame(); setSave(loadSave()); }
    setOver(null); g?.setupMenu();
  };
  const toggleMute = () => { const m = !muted; setMuted(m); sfx.setMuted(m); };
  const cycleCam = () => gameRef.current?.cycleCamera();

  useEffect(() => { if (state !== "paused") setPauseTab("menu"); }, [state]);

  // Android back button (called by the app wrapper); false = nothing to go back to, the app may close
  backRef.current = () => {
    const g = gameRef.current;
    if (!g) return false;
    if (g.state === "playing") g.pause();
    else if (g.state === "paused") { if (pauseTab !== "menu") setPauseTab("menu"); else g.resume(); }
    else if (g.state === "modal") { if (modal?.kind === "dialog") g.dialogNext(); else g.closeModal(); }
    else if (g.state === "over") toMenu();
    else return false;
    return true;
  };
  useEffect(() => {
    const w = window as unknown as { solaraBack?: () => boolean };
    w.solaraBack = () => backRef.current();
    return () => { delete w.solaraBack; };
  }, []);

  const g = gameRef.current;
  const playing = state === "playing";
  const rules = MODE_RULES[config.mode];

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

      {(playing || state === "paused") && g && (
        <Hud hud={hud} isTouch={isTouch} rules={rules} camera={config.camera} onPause={() => g.pause()} onCam={cycleCam} onToggleCar={() => g.toggleCar()}
          onInteract={() => g.interact()} onRadio={() => g.cycleRadio()} onJob={() => g.toggleJob()} onDetonate={() => g.detonate()} onWeapon={(w) => g.setWeapon(w)} onWheel={() => g.openModal({ kind: "wheel" })} />
      )}
      {playing && isTouch && touchInput && g && (
        <TouchControls input={touchInput} nitro01={hud.nitro01} flying={hud.alt >= 0} relative={config.camera !== "top"} onFoot={hud.onFoot} weapon={hud.weapon} ammo={hud.reloading ? "…" : ammoText(hud.ammo, hud.reserve)} bombsPlaced={hud.bombsPlaced}
          onCycleWeapon={() => g.cycleWeapon()} onWheel={() => g.openModal({ kind: "wheel" })} onDetonate={() => g.detonate()} />
      )}

      {state === "modal" && g && modal?.kind === "shop" && <ShopMenu key={modal.place.id} game={g} place={modal.place} onClose={() => g.closeModal()} />}
      {state === "modal" && g && modal?.kind === "dialog" && <DialogBox d={modal} isTouch={isTouch} onNext={() => g.dialogNext()} />}
      {state === "modal" && g && modal?.kind === "wheel" && <WeaponWheel owned={g.inv.owned} current={g.inv.current} onPick={(w) => { g.setWeapon(w); g.closeModal(); }} onClose={() => g.closeModal()} />}

      {state === "menu" && !glError && (
        <StartScreen name={name} setName={(n) => { setName(n); nameRef.current = n; }} scores={scores} config={config} update={updateConfig} onStart={primary} onNew={start} save={save} isTouch={isTouch} muted={muted} toggleMute={toggleMute} bind={g?.bind ?? null} />
      )}

      {state === "paused" && g && (
        <PauseMenu game={g} tab={pauseTab} setTab={setPauseTab} hud={hud} config={config} isTouch={isTouch} muted={muted}
          onResume={() => g.resume()} onCam={cycleCam} onRestart={start} onFinish={() => g.finish()} onMute={toggleMute} onMenu={toMenu} onSaved={() => setSave(loadSave())} />
      )}

      {state === "over" && over && <GameOver data={over} scores={scores} rank={rank} onRestart={start} onMenu={toMenu} isTouch={isTouch} />}
    </div>
  );
}
