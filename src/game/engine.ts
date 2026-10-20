import { sfx } from "./audio";
import { World, BLOCK, ROAD, GRID, MAP_MIN, MAP_MAX, inCity, terrainH, terrainGrad, roofOf, type Building } from "./world";
import { Renderer3D } from "./renderer3d";
import { MODE_RULES, type Mode, type ModeRules } from "./modes";
import { Wanted, SEEN_CLOSE, SEEN_DIST, type Crime } from "./wanted";
import { buildPlaces, respawnCost, RESPAWN_RULES, type Place } from "./places";

export type GameState = "menu" | "playing" | "paused" | "over";
export type { Mode } from "./modes";
export type Difficulty = "easy" | "normal" | "hard";
export type CameraMode = "chase" | "fp" | "top";
export type Quality = "high" | "low";
export type CarModel = "sport" | "super" | "muscle" | "suv" | "sedan" | "van" | "police" | "taxi";
export type Weapon = "pistol" | "rocket" | "bomb";
export const WEAPONS: Weapon[] = ["pistol", "rocket", "bomb"];

export interface CarDef { id: string; name: string; model: CarModel; color: string; maxV: number; acc: number; grip: number; hp: number; mass: number; desc: string; }
export const CARS: CarDef[] = [
  { id: "corsaro", name: "Corsaro", model: "sport", color: "#ff2d95", maxV: 560, acc: 640, grip: 11, hp: 120, mass: 1.4, desc: "Ausgewogen" },
  { id: "zephyra", name: "Zephyra", model: "super", color: "#2bf0ff", maxV: 650, acc: 740, grip: 10, hp: 90, mass: 1.2, desc: "Rakete" },
  { id: "torvan", name: "Torvan", model: "muscle", color: "#ff8a1f", maxV: 540, acc: 700, grip: 7, hp: 130, mass: 1.5, desc: "Drift-König" },
  { id: "granit", name: "Granit", model: "suv", color: "#ffd23f", maxV: 480, acc: 560, grip: 12, hp: 220, mass: 2.2, desc: "Panzer" },
];
// car ids of older versions -> current ids
export const LEGACY_CAR_IDS: Record<string, string> = { infernus: "corsaro", banshee: "zephyra", sabre: "torvan", patriot: "granit" };
const MODEL_STATS: Record<CarModel, { maxV: number; acc: number; grip: number }> = {
  sport: { maxV: 560, acc: 640, grip: 11 }, super: { maxV: 650, acc: 740, grip: 10 }, muscle: { maxV: 540, acc: 700, grip: 7 }, suv: { maxV: 480, acc: 560, grip: 12 },
  sedan: { maxV: 470, acc: 520, grip: 11 }, van: { maxV: 420, acc: 460, grip: 12 }, police: { maxV: 560, acc: 640, grip: 11 }, taxi: { maxV: 480, acc: 540, grip: 11 },
};

export interface GameConfig { mode: Mode; difficulty: Difficulty; car: string; camera: CameraMode; quality: Quality; }

interface DiffDef { dmg: number; cops: number[]; copV: number; copVStar: number; heat: number; bust: number; regen: number; firstCop: number; spawnGap: number; lead: number; }
const DIFFS: Record<Difficulty, DiffDef> = {
  easy: { dmg: 0.28, cops: [0, 1, 2, 2, 3, 4], copV: 330, copVStar: 16, heat: 1.3, bust: 0.22, regen: 4, firstCop: 8, spawnGap: 3.5, lead: 0.2 },
  normal: { dmg: 0.6, cops: [0, 1, 2, 3, 5, 6], copV: 390, copVStar: 24, heat: 2.3, bust: 0.75, regen: 1.5, firstCop: 4, spawnGap: 2, lead: 0.4 },
  hard: { dmg: 1, cops: [0, 2, 3, 5, 7, 9], copV: 440, copVStar: 30, heat: 3.2, bust: 1, regen: 0, firstCop: 2.5, spawnGap: 1.4, lead: 0.55 },
};

export interface HudData {
  score: number; mult: number; combo01: number; stars: number; searching: boolean; cash: number; health01: number; carHealth01: number; nitro01: number;
  kmh: number; time: number; drift: number; bust01: number; takedowns: number;
  weapon: Weapon; rockets: number; bombs: number; bombsPlaced: number; onFoot: boolean; canEnter: boolean; hint: string; air: boolean;
}
export type EndReason = "dead" | "arrested";
export const END_LABEL: Record<EndReason, string> = { dead: "ERLEDIGT", arrested: "VERHAFTET" };

export interface GameOverData {
  score: number; time: number; takedowns: number; maxStars: number; reason: EndReason | "finished";
  bestDrift: number; cash: number; mode: Mode; difficulty: Difficulty;
}
export interface TouchInput { active: boolean; jx: number; jy: number; drift: boolean; nitro: boolean; fire: boolean; }

interface Callbacks {
  onHud: (h: HudData) => void; onState: (s: GameState) => void; onGameOver: (d: GameOverData) => void;
  onHurt: (amount: number) => void; onCamera: (c: CameraMode) => void;
}

type Kind = "player" | "cop" | "civ";

export class Car {
  x = 0; y = 0; z = 0; vx = 0; vy = 0; vz = 0; a = 0; av = 0;
  air = false; airT = 0;
  vF = 0; vR = 0;
  hp = 100; maxHp = 100; mass = 1;
  calm = false; // cop without a wanted level: patrols like traffic, no siren
  route = false; // prevI/prevJ/wpI/wpJ hold a valid street route (traffic AI)
  dead = false; deadT = 0; wrecked = false; wreckT = 0; parked = false;
  throttle = 0; steer = 0; handbrake = false; nitro = false;
  wpI = 0; wpJ = 0; prevI = -1; prevJ = -1; hasWp = false;
  stuckT = 0; reverseT = 0; nearCd = 0; hitFlash = 0;
  rlx = NaN; rly = NaN; rrx = NaN; rry = NaN;
  siren = Math.random() * 10; cruise = 170; smokeT = 0;
  constructor(public kind: Kind, public model: CarModel, public color: string) {}
  get speed() { return Math.hypot(this.vx, this.vy); }
}

export interface Ped { x: number; y: number; z: number; a: number; vx: number; vy: number; hp: number; maxHp: number; walk: number; moving: boolean; sprint: boolean; shootT: number; hitFlash: number; dead: boolean; }
export interface Proj { kind: "bullet" | "rocket" | "bomb"; x: number; y: number; z: number; vx: number; vy: number; vz: number; a: number; life: number; px: number; py: number; }
export interface Bomb { car: Car | null; ox: number; oy: number; x: number; y: number; z: number; t: number; }
export interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; grow: number; color: string; type: number; drag: number; }
export type PickupType = "cash" | "repair" | "nitro" | "rocket" | "bomb";
export interface Pickup { x: number; y: number; type: PickupType; t: number; value: number; }
interface FloatText { x: number; y: number; h: number; text: string; color: string; life: number; max: number; size: number; }
interface Banner { text: string; sub: string; color: string; life: number; max: number; big: boolean; }
export interface Flash { x: number; y: number; z: number; life: number; max: number; size: number; }

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const TAU = Math.PI * 2;
const GRAV = 620;
const AIR_THRUST = 520, AIR_MAX = 900; // nitro thrust in the air, max air speed
export const wrap = (a: number) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const CIV_COLORS = ["#d8d8e0", "#2b2f3a", "#8a1c2b", "#1d4e89", "#3c6e47", "#c9a227", "#6b4c9a", "#e07a2e", "#9aa3ad", "#10141c"];
const MAX_PARTICLES = 560;
export const MAX_SKIDS = 900;

export class Game {
  overlay: HTMLCanvasElement; ctx: CanvasRenderingContext2D; r3d: Renderer3D; cb: Callbacks; config: GameConfig;
  world = new World(4242);
  places: Place[] = buildPlaces(this.world);
  wanted = new Wanted(MODE_RULES.chase);
  state: GameState = "menu";
  dpr = 1; cw = 0; ch = 0; mobile = false;

  player!: Car;
  ped: Ped = { x: 0, y: 0, z: 0, a: 0, vx: 0, vy: 0, hp: 100, maxHp: 100, walk: 0, moving: false, sprint: false, shootT: 0, hitFlash: 0, dead: false };
  onFoot = false;
  cars: Car[] = []; particles: Particle[] = []; pickups: Pickup[] = []; texts: FloatText[] = []; banners: Banner[] = []; flashes: Flash[] = [];
  projs: Proj[] = []; bombs: Bomb[] = [];
  skids = new Float32Array(MAX_SKIDS * 4); skidHead = 0; skidTotal = 0;

  trauma = 0; shakeX = 0; shakeY = 0; shakeR = 0; hitStop = 0; timeScale = 1; t = 0;

  score = 0; mult = 1; comboT = 0; time = 0; takedowns = 0; cash = 0;
  driftPts = 0; driftHold = 0; bestDrift = 0; bust = 0; nitro = 1; nitroWasOn = false; lastHurt = -10;
  weapon: Weapon = "pistol"; rockets = 30; bombsAmmo = 30; fireCd = 0; fireHeld = false; hint = ""; hintT = 0;
  ending: null | { reason: EndReason; t: number } = null;
  copSpawnT = 0;

  keys = new Set<string>();
  touch: TouchInput = { active: false, jx: 0, jy: 0, drift: false, nitro: false, fire: false };
  minimap: HTMLCanvasElement;

  private raf = 0; private last = 0; private hudT = 0; private tmpB: Building[] = [];

  constructor(glCanvas: HTMLCanvasElement, overlay: HTMLCanvasElement, cb: Callbacks, config: GameConfig) {
    this.overlay = overlay;
    this.ctx = overlay.getContext("2d")!;
    this.cb = cb;
    this.config = { ...config };
    this.mobile = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    this.minimap = this.world.renderMinimap(720);
    this.r3d = new Renderer3D(glCanvas, this.world, this.places, this.config.quality, this.config.camera);
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("wheel", this.onWheel, { passive: true });
    document.addEventListener("visibilitychange", this.onVis);
    this.setupMenu();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("visibilitychange", this.onVis);
    this.r3d.dispose();
  }

  get carDef(): CarDef { return CARS.find((c) => c.id === this.config.car) || CARS[0]; }
  get diff(): DiffDef { return DIFFS[this.config.difficulty]; }
  get rules(): ModeRules { return MODE_RULES[this.config.mode]; }
  get stars() { return this.wanted.stars; }
  // currently controlled entity
  get fx() { return this.onFoot ? this.ped.x : this.player.x; }
  get fy() { return this.onFoot ? this.ped.y : this.player.y; }
  get fz() { return this.onFoot ? this.ped.z : this.player.z; }
  get fa() { return this.onFoot ? this.ped.a : this.player.a; }
  get fvx() { return this.onFoot ? this.ped.vx : this.player.vx; }
  get fvy() { return this.onFoot ? this.ped.vy : this.player.vy; }
  get fspeed() { return Math.hypot(this.fvx, this.fvy); }

  configure(cfg: GameConfig) {
    const prevQ = this.config.quality;
    this.config = { ...cfg };
    if (cfg.quality !== prevQ) { this.r3d.setQuality(cfg.quality); this.resize(); }
    this.r3d.camMode = cfg.camera;
    if (this.state === "menu" && this.player) { const d = this.carDef; this.player.model = d.model; this.player.color = d.color; }
  }
  setCamera(c: CameraMode) { this.config.camera = c; this.r3d.camMode = c; this.cb.onCamera(c); }
  cycleCamera() { const o: CameraMode[] = ["chase", "fp", "top"]; this.setCamera(o[(o.indexOf(this.config.camera) + 1) % 3]); }

  // ---------- input ----------
  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const k = e.code;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(k)) e.preventDefault();
    this.keys.add(k);
    if (k === "KeyP" || k === "Escape") { if (this.state === "playing") this.pause(); else if (this.state === "paused") this.resume(); }
    if ((k === "KeyC" || k === "KeyV") && (this.state === "playing" || this.state === "paused")) this.cycleCamera();
    if (k === "Enter" || k === "KeyR") { if (this.state === "over" || this.state === "menu" || (this.state === "paused" && k === "KeyR")) this.start(); }
    if (this.state !== "playing" || this.ending) return;
    if (k === "KeyE") this.toggleCar();
    if (k === "KeyQ" || k === "Tab") { e.preventDefault(); this.cycleWeapon(); }
    if (k === "Digit1") this.setWeapon("pistol");
    if (k === "Digit2") this.setWeapon("rocket");
    if (k === "Digit3") this.setWeapon("bomb");
    if (k === "KeyG") this.detonate();
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onBlur = () => { this.keys.clear(); this.fireHeld = false; if (this.state === "playing") this.pause(); };
  private onVis = () => { if (document.hidden && this.state === "playing") this.pause(); };
  private onMouseDown = (e: MouseEvent) => {
    if (this.state !== "playing" || e.button !== 0) return;
    const el = e.target as HTMLElement;
    if (el && (el.tagName === "BUTTON" || el.closest?.("button, input"))) return;
    this.fireHeld = true;
  };
  private onMouseUp = () => { this.fireHeld = false; };
  private onWheel = (e: WheelEvent) => { if (this.state === "playing" && !this.ending) this.cycleWeapon(e.deltaY > 0 ? 1 : -1); };

  resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cw = window.innerWidth; this.ch = window.innerHeight;
    this.overlay.width = Math.floor(this.cw * this.dpr); this.overlay.height = Math.floor(this.ch * this.dpr);
    this.overlay.style.width = this.cw + "px"; this.overlay.style.height = this.ch + "px";
    this.r3d.resize(this.cw, this.ch);
  };

  // ---------- state ----------
  private setState(s: GameState) { this.state = s; this.cb.onState(s); }

  private resetWorld() {
    this.cars = []; this.particles = []; this.pickups = []; this.texts = []; this.banners = []; this.flashes = []; this.projs = []; this.bombs = [];
    this.skidHead = 0; this.skidTotal = 0;
    const d = this.carDef;
    const p = new Car("player", d.model, d.color);
    p.hp = p.maxHp = d.hp; p.mass = d.mass;
    const n = this.world.nodePos(5, 5);
    p.x = n.x + 10; p.y = n.y + 34; p.a = 0;
    p.wpI = 6; p.wpJ = 5; p.prevI = 5; p.prevJ = 5;
    this.player = p;
    this.cars.push(p);
    this.onFoot = false;
    this.ped = { x: p.x, y: p.y, z: 0, a: 0, vx: 0, vy: 0, hp: 100, maxHp: 100, walk: 0, moving: false, sprint: false, shootT: 0, hitFlash: 0, dead: false };
  }

  setupMenu() {
    this.resetWorld();
    this.player.cruise = 260;
    for (let i = 0; i < 14; i++) this.spawnCiv(true);
    this.ending = null; this.timeScale = 1;
    this.setState("menu");
  }

  start() {
    sfx.init();
    this.resetWorld();
    const rules = this.rules;
    this.wanted.reset(rules);
    this.score = 0; this.mult = 1; this.comboT = 0;
    this.time = 0; this.takedowns = 0; this.cash = rules.respawn ? 200 : 0; this.lastHurt = -10;
    this.driftPts = 0; this.driftHold = 0; this.bestDrift = 0;
    this.bust = 0; this.nitro = 1; this.ending = null; this.timeScale = 1; this.trauma = 0;
    this.weapon = "pistol"; this.rockets = rules.respawn ? 0 : 30; this.bombsAmmo = rules.respawn ? 0 : 30; this.fireCd = 0; this.hint = ""; this.hintT = 0;
    this.copSpawnT = this.diff.firstCop;
    const p = this.player;
    p.vx = 120;
    for (let i = 0; i < 6; i++) this.pickups.push({ x: p.x + 180 + i * 85, y: p.y, type: "cash", t: Math.random() * 6, value: 100 });
    this.pickups.push({ x: p.x + 760, y: p.y, type: "nitro", t: 0, value: 0 });
    for (let i = 0; i < 22; i++) this.spawnPickup("cash", true);
    for (let i = 0; i < 5; i++) this.spawnPickup("nitro", true);
    for (let i = 0; i < 5; i++) this.spawnPickup("repair", true);
    for (let i = 0; i < 5; i++) this.spawnPickup("rocket", true);
    for (let i = 0; i < 4; i++) this.spawnPickup("bomb", true);
    for (let i = 0; i < 14; i++) this.spawnCiv(true);
    const m = this.config.mode;
    this.banner(m === "free" ? "FREIE FAHRT" : m === "open" ? "SOLARA BAY" : "LOS GEHT'S", m === "free" ? "Keine Cops – erkunde Stadt & Berge" : m === "open" ? "Die Stadt gehört dir – benimm dich (oder nicht)" : "Schnapp dir das Cash!", "#ff3cac", 2.6);
    this.setState("playing");
  }

  pause() { if (this.state === "playing") { this.setState("paused"); this.keys.clear(); this.fireHeld = false; } }
  resume() { if (this.state === "paused") { this.setState("playing"); this.last = performance.now(); } }
  finish() {
    if (this.state !== "playing" && this.state !== "paused") return;
    this.bankDrift();
    this.setState("over");
    this.cb.onGameOver(this.overData("finished"));
  }
  private overData(reason: GameOverData["reason"]): GameOverData {
    return { score: Math.floor(this.score), time: this.time, takedowns: this.takedowns, maxStars: this.wanted.maxStars, reason, bestDrift: Math.round(this.bestDrift), cash: this.cash, mode: this.config.mode, difficulty: this.config.difficulty };
  }

  // ---------- spawning ----------
  private spawnCiv(anywhereNear = false) {
    const fx = this.fx, fy = this.fy;
    for (let tries = 0; tries < 20; tries++) {
      const i = Math.floor(Math.random() * (GRID + 1)), j = Math.floor(Math.random() * (GRID + 1));
      const np = this.world.nodePos(i, j);
      const d = Math.hypot(np.x - fx, np.y - fy);
      if (d > 1400 || d < (anywhereNear ? 250 : 750)) continue;
      const dir = DIRS[Math.floor(Math.random() * 4)];
      const ni = i + dir[0], nj = j + dir[1];
      if (ni < 0 || nj < 0 || ni > GRID || nj > GRID) continue;
      const r = Math.random();
      const model: CarModel = r < 0.15 ? "taxi" : r < 0.3 ? "van" : r < 0.4 ? "suv" : r < 0.5 ? "muscle" : "sedan";
      const color = model === "taxi" ? "#ffc21a" : CIV_COLORS[Math.floor(Math.random() * CIV_COLORS.length)];
      const c = new Car("civ", model, color);
      const t = rnd(0.2, 0.7);
      c.x = np.x + dir[0] * BLOCK * t - dir[1] * 34; c.y = np.y + dir[1] * BLOCK * t + dir[0] * 34;
      c.a = Math.atan2(dir[1], dir[0]);
      c.prevI = i; c.prevJ = j; c.wpI = ni; c.wpJ = nj; c.route = true;
      c.cruise = rnd(150, 200);
      c.vx = Math.cos(c.a) * c.cruise; c.vy = Math.sin(c.a) * c.cruise;
      c.hp = c.maxHp = 90; c.mass = model === "van" || model === "suv" ? 1.2 : 0.8;
      this.cars.push(c);
      return;
    }
  }

  private spawnCop() {
    const fx = this.fx, fy = this.fy;
    const outside = !inCity(fx, fy);
    for (let tries = 0; tries < 40; tries++) {
      let x: number, y: number;
      if (outside) {
        const a = Math.random() * TAU, d = rnd(850, 1250);
        x = fx + Math.cos(a) * d; y = fy + Math.sin(a) * d;
        if (inCity(x, y)) { const n = this.world.nearestNode(x, y); const np = this.world.nodePos(n.i, n.j); x = np.x; y = np.y; }
        if (this.world.isSolid(x, y, 20)) continue;
      } else {
        const i = Math.floor(Math.random() * (GRID + 1)), j = Math.floor(Math.random() * (GRID + 1));
        const np = this.world.nodePos(i, j);
        x = np.x; y = np.y;
      }
      const d = Math.hypot(x - fx, y - fy);
      if (d < 800 || d > 1350) continue;
      const c = new Car("cop", "police", "#f4f6fa");
      c.x = x; c.y = y; c.z = terrainH(x, y);
      c.a = Math.atan2(fy - y, fx - x);
      c.hp = c.maxHp = this.config.difficulty === "easy" ? 70 : 100;
      c.mass = 1.25;
      this.cars.push(c);
      return;
    }
  }

  private spawnPickup(type: PickupType, far = false) {
    const fx = this.fx, fy = this.fy;
    for (let tries = 0; tries < 30; tries++) {
      const pt = this.world.randomRoadPoint(Math.random, type === "cash" ? 0.3 : 0.4);
      const d = Math.hypot(pt.x - fx, pt.y - fy);
      if (!far && (d < 350 || d > 1300)) continue;
      if (far && d < 300) continue;
      this.pickups.push({ x: pt.x, y: pt.y, type, t: Math.random() * 6, value: type === "cash" ? [100, 100, 250, 500][Math.floor(Math.random() * 4)] : 0 });
      return;
    }
  }

  // ---------- feedback ----------
  shake(a: number) { this.trauma = Math.min(1, this.trauma + a); }
  private emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, grow: number, color: string, type: number, drag = 2) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({ x, y, z, vx, vy, vz, life, max: life, size, grow, color, type, drag });
  }
  private sparks(x: number, y: number, z: number, n: number, nx = 0, ny = 0, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(ny, nx) + rnd(-1.2, 1.2), s = rnd(150, 480) * power;
      this.emit(x, y, z, Math.cos(a) * s, Math.sin(a) * s, rnd(60, 260), rnd(0.25, 0.55), rnd(1.5, 3), 0, Math.random() < 0.5 ? "#ffd27a" : "#fff3c4", 1, 3);
    }
  }
  private text(x: number, y: number, text: string, color = "#fff", size = 22) {
    this.texts.push({ x, y, h: terrainH(x, y) + 40, text, color, life: 1.2, max: 1.2, size });
    if (this.texts.length > 14) this.texts.shift();
  }
  banner(text: string, sub: string, color: string, dur = 1.6, big = false) {
    this.banners.push({ text, sub, color, life: dur, max: dur, big });
    if (this.banners.length > 2) this.banners.shift();
  }
  private setHint(h: string, t = 1.5) { this.hint = h; this.hintT = t; }
  private addCombo() { this.mult = Math.min(10, this.mult + 1); this.comboT = 5; }
  private addScore(base: number, x: number, y: number, label: string, color: string, size = 22) {
    const v = Math.round(base * this.mult);
    this.score += v;
    this.text(x, y, `${label} +${v.toLocaleString("de-DE")}`, color, size);
    return v;
  }

  private explode(x: number, y: number, big = 1, power = 1) {
    const z = terrainH(x, y);
    sfx.explosion();
    this.shake(0.5 * big);
    this.hitStop = 0.06;
    this.flashes.push({ x, y, z: z + 20, life: 0.6, max: 0.6, size: 520 * big });
    for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, s = rnd(40, 300) * big; this.emit(x, y, z + 12, Math.cos(a) * s, Math.sin(a) * s, rnd(20, 160), rnd(0.4, 0.9), rnd(14, 26), 30, "#ff8a2a", 2, 3); }
    for (let i = 0; i < 18; i++) { const a = Math.random() * TAU, s = rnd(20, 120); this.emit(x, y, z + 14, Math.cos(a) * s, Math.sin(a) * s, rnd(30, 70), rnd(1.4, 2.6), rnd(16, 26), 40, "#2a2430", 0, 1.2); }
    for (let i = 0; i < 12; i++) { const a = Math.random() * TAU, s = rnd(150, 420); this.emit(x, y, z + 10, Math.cos(a) * s, Math.sin(a) * s, rnd(180, 380), rnd(0.8, 1.4), rnd(3, 6), 0, "#1a1a1f", 3, 1.5); }
    this.sparks(x, y, z + 10, 22, 0, 0, 1.3);
    this.emit(x, y, z + 1, 0, 0, 0, 0.45, 20, 520, "#ffc88c", 4, 0);
    const R = 160 * Math.sqrt(big);
    for (const c of this.cars) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < R && d > 1) {
        const f = 1 - d / R;
        c.vx += ((c.x - x) / d) * 380 * f; c.vy += ((c.y - y) / d) * 380 * f; c.av += rnd(-6, 6) * f;
        if (!c.air && f > 0.3) { c.air = true; c.vz = Math.max(c.vz, 120 * f * power); }
        if (c.kind === "player") this.damagePlayerCar(7 * f * big);
        else if (!c.dead) this.damageCar(c, 50 * f * power);
      }
    }
    if (this.onFoot) {
      const d = Math.hypot(this.ped.x - x, this.ped.y - y);
      if (d < R) { const f = 1 - d / R; this.damagePed(45 * f * big); this.ped.vx += ((this.ped.x - x) / Math.max(d, 1)) * 300 * f; this.ped.vy += ((this.ped.y - y) / Math.max(d, 1)) * 300 * f; }
    }
    this.crime("explosion", power);
  }

  private damagePlayerCar(amt: number) {
    if (this.state !== "playing" || this.ending || amt <= 0) return;
    const p = this.player;
    if (p.dead) return;
    p.hitFlash = 0.15;
    if (!this.rules.damage) return;
    amt *= this.diff.dmg;
    p.hp -= amt;
    if (!this.onFoot) { this.lastHurt = this.time; this.cb.onHurt(amt); }
    if (p.hp <= 0) {
      p.hp = 0; p.dead = true; p.wrecked = true;
      this.explode(p.x, p.y, 1.4);
      if (!this.onFoot) this.endRun("dead");
      else { this.banner("AUTO ZERSTÖRT", "Klau dir ein neues (E)", "#ff9f43", 2); this.detachBombs(p); }
    }
  }

  private damagePed(amt: number) {
    if (this.state !== "playing" || this.ending || amt <= 0 || !this.onFoot) return;
    const pd = this.ped;
    pd.hitFlash = 0.3;
    if (!this.rules.damage) return;
    amt *= this.diff.dmg;
    pd.hp -= amt;
    this.lastHurt = this.time;
    this.cb.onHurt(amt);
    this.shake(Math.min(0.5, amt / 40));
    if (pd.hp <= 0) { pd.hp = 0; pd.dead = true; this.endRun("dead"); }
  }

  private damageCar(c: Car, amt: number, byWeapon = false) {
    if (c.dead) return;
    if (c.kind === "player") { this.damagePlayerCar(amt); return; }
    c.hp -= amt;
    c.hitFlash = 0.12;
    if (c.kind === "civ" && !c.wrecked && amt > 3 && !c.parked) c.wrecked = true;
    if (c.hp <= 0) {
      c.dead = true; c.wrecked = true;
      this.detachBombs(c);
      if (c.kind === "cop") {
        this.explode(c.x, c.y, 1);
        if (this.state === "playing" && !this.ending) {
          this.takedowns++;
          this.addScore(750, c.x, c.y - 20, byWeapon ? "ABGESCHOSSEN" : "TAKEDOWN", "#ff3cac", 30);
          this.addCombo();
          this.crime("copTakedown");
          this.banner(byWeapon ? "COP ABGESCHOSSEN" : "COP TAKEDOWN", `x${this.mult} COMBO`, "#ff3cac", 1.3);
        }
      } else this.explode(c.x, c.y, 0.7);
    }
  }

  private detachBombs(c: Car) {
    for (const b of this.bombs) if (b.car === c) { b.car = null; }
  }

  private endRun(reason: EndReason) {
    if (this.ending) return;
    this.ending = { reason, t: 0 };
    this.banner(END_LABEL[reason], reason === "dead" ? (this.onFoot ? "Du bist draufgegangen" : "Dein Wagen ist Schrott") : "Die Cops haben dich", reason === "dead" ? "#ff2a3a" : "#4da3ff", 3, true);
    sfx.gameOver();
    this.bankDrift();
  }

  crime(c: Crime, mul = 1) { if (this.state === "playing" && !this.ending) this.wanted.crime(c, mul); }

  // a cop with a wanted level sees the player (close, or in line of sight)
  private copSeesPlayer() {
    const fx = this.fx, fy = this.fy;
    for (const c of this.cars) {
      if (c.kind !== "cop" || c.dead || c.calm) continue;
      const d = Math.hypot(c.x - fx, c.y - fy);
      if (d < SEEN_CLOSE || (d < SEEN_DIST && this.world.lineClear(c.x, c.y, fx, fy, 50))) return true;
    }
    return false;
  }

  // open world: no game over, wake up at the hospital or get released at the police station
  private respawn(reason: EndReason) {
    const rule = RESPAWN_RULES[reason];
    const place = this.places.find((pl) => pl.kind === rule.place);
    const cost = respawnCost(rule, this.cash);
    this.cash -= cost;
    this.rockets = 0; this.bombsAmmo = 0; this.weapon = "pistol";
    this.wanted.clear(); this.bust = 0; this.ending = null; this.timeScale = 1;
    this.cars = this.cars.filter((c) => c.kind !== "cop");
    this.projs.length = 0; this.bombs.length = 0;
    this.copSpawnT = this.diff.firstCop;
    const p = this.player;
    p.throttle = 0; p.steer = 0; p.nitro = false; p.handbrake = true;
    const n = this.world.nodePos(5, 5);
    const x = place ? place.x : n.x, y = place ? place.y : n.y;
    this.ped = { x, y, z: terrainH(x, y), a: place ? place.a : 0, vx: 0, vy: 0, hp: 100, maxHp: 100, walk: 0, moving: false, sprint: false, shootT: 0, hitFlash: 0, dead: false };
    this.onFoot = true;
    this.r3d.resetCamera(this.ped.a + Math.PI); // camera on the street, looking at the entrance
    this.banners.length = 0;
    this.banner(rule.title, `${place ? place.name + " · " : ""}−$${cost.toLocaleString("de-DE")} ${rule.sub}`, place ? place.color : "#ffffff", 3.2);
  }

  // ---------- weapons ----------
  setWeapon(w: Weapon) { this.weapon = w; sfx.beep(); }
  cycleWeapon(dir = 1) { const i = WEAPONS.indexOf(this.weapon); this.weapon = WEAPONS[(i + dir + 3) % 3]; sfx.beep(); }

  private findTarget(originX: number, originY: number, facing: number, cone: number) {
    let best: Car | null = null, bd = Infinity;
    for (const c of this.cars) {
      if (c.dead || c === this.player || (c.kind === "civ" && c.parked)) continue;
      if (c.kind !== "cop" && this.rules.cops) continue;
      const d = Math.hypot(c.x - originX, c.y - originY);
      if (d > 700 || d >= bd) continue;
      const da = Math.abs(wrap(Math.atan2(c.y - originY, c.x - originX) - facing));
      if (da > cone) continue;
      if (!this.world.lineClear(originX, originY, c.x, c.y, 50)) continue;
      best = c; bd = d;
    }
    return best;
  }

  private fire() {
    if (this.fireCd > 0 || this.ending || this.state !== "playing") return;
    const onFoot = this.onFoot;
    const p = this.player;
    const facing = onFoot ? (this.config.camera === "top" ? this.ped.a : this.r3d.camYaw) : p.a;
    const ox = onFoot ? this.ped.x : p.x + Math.cos(p.a) * 10;
    const oy = onFoot ? this.ped.y : p.y + Math.sin(p.a) * 10;
    const oz = onFoot ? this.ped.z + 15 : p.z + 13;
    const bvx = onFoot ? 0 : p.vx, bvy = onFoot ? 0 : p.vy;
    const w = this.weapon;
    if (w === "rocket" && this.rockets <= 0) { sfx.empty(); this.setHint("Keine Raketen – such die orangen Säulen", 1.5); this.fireCd = 0.3; return; }
    if (w === "bomb" && this.bombsAmmo <= 0) { sfx.empty(); this.setHint("Keine Bomben – such die roten Säulen", 1.5); this.fireCd = 0.3; return; }
    const speed = w === "pistol" ? 1500 : w === "rocket" ? 720 : 280;
    const target = this.findTarget(ox, oy, facing, onFoot ? Math.PI : 1.75);
    let a = facing;
    if (target) {
      const d = Math.hypot(target.x - ox, target.y - oy);
      const lead = d / speed;
      a = Math.atan2(target.y + target.vy * lead - oy, target.x + target.vx * lead - ox);
    }
    if (onFoot) { this.ped.a = a; this.ped.shootT = 0.4; }
    if (w === "pistol") {
      a += rnd(-0.025, 0.025);
      this.projs.push({ kind: "bullet", x: ox, y: oy, z: oz, vx: Math.cos(a) * speed + bvx * 0.3, vy: Math.sin(a) * speed + bvy * 0.3, vz: 0, a, life: 0.6, px: ox, py: oy });
      this.fireCd = 0.17;
      sfx.shot();
      this.shake(0.05);
      this.flashes.push({ x: ox + Math.cos(a) * 18, y: oy + Math.sin(a) * 18, z: oz, life: 0.06, max: 0.06, size: 90 });
      this.emit(ox + Math.cos(a) * 20, oy + Math.sin(a) * 20, oz, bvx * 0.5, bvy * 0.5, 0, 0.06, 7, 60, "#ffd36b", 2, 1);
      this.crime("shot");
    } else if (w === "rocket") {
      this.rockets--;
      this.projs.push({ kind: "rocket", x: ox, y: oy, z: oz, vx: Math.cos(a) * speed + bvx * 0.5, vy: Math.sin(a) * speed + bvy * 0.5, vz: 0, a, life: 3, px: ox, py: oy });
      this.fireCd = 0.85;
      sfx.rocket();
      this.shake(0.25);
      this.flashes.push({ x: ox, y: oy, z: oz, life: 0.12, max: 0.12, size: 200 });
      this.crime("rocket");
    } else {
      if (this.bombs.length >= 30) { this.setHint("Max. 30 Bomben – erst zünden (G)", 1.5); sfx.empty(); this.fireCd = 0.3; return; }
      this.bombsAmmo--;
      this.projs.push({ kind: "bomb", x: ox, y: oy, z: oz, vx: Math.cos(a) * speed + bvx * 0.9, vy: Math.sin(a) * speed + bvy * 0.9, vz: 170, a, life: 4, px: ox, py: oy });
      this.fireCd = 0.45;
      sfx.throwIt();
      this.setHint("G / 💥 zum Zünden", 2);
    }
  }

  detonate() {
    if (!this.bombs.length) return;
    const list = this.bombs;
    this.bombs = [];
    for (const b of list) {
      this.bombPos(b);
      const car = b.car;
      this.explode(b.x, b.y, 1.2, 4);
      if (car && !car.dead) this.damageCar(car, 400, true);
    }
    this.timeScale = 0.35;
    setTimeout(() => { this.timeScale = 1; }, 450);
  }

  private bombPos(b: Bomb) {
    if (b.car) {
      const c = b.car;
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      b.x = c.x + b.ox * ca - b.oy * sa; b.y = c.y + b.ox * sa + b.oy * ca; b.z = c.z + 11;
    }
  }

  private updateProjs(dt: number) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const q = this.projs[i];
      q.life -= dt;
      q.px = q.x; q.py = q.y;
      if (q.kind === "bomb") { q.vz -= GRAV * dt; q.vx *= Math.exp(-0.5 * dt); q.vy *= Math.exp(-0.5 * dt); }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const gh = terrainH(q.x, q.y);
      if (q.kind === "rocket") {
        q.z = Math.max(q.z, gh + 8);
        this.emit(q.x, q.y, q.z, rnd(-10, 10), rnd(-10, 10), rnd(5, 20), rnd(0.5, 0.9), 5, 26, "#9a93a9", 0, 1);
        this.emit(q.x, q.y, q.z, -q.vx * 0.2, -q.vy * 0.2, 0, 0.12, 6, -10, "#ff9a2a", 2, 1);
      }
      let remove = false;
      // cars
      const steps = q.kind === "bullet" ? 3 : 1;
      outer: for (let s = 1; s <= steps; s++) {
        const sx = q.px + (q.x - q.px) * (s / steps), sy = q.py + (q.y - q.py) * (s / steps);
        for (const c of this.cars) {
          if (c === this.player && !this.onFoot) continue;
          if (c.dead && q.kind !== "bomb") continue;
          const dx = sx - c.x, dy = sy - c.y;
          if (dx * dx + dy * dy > 26 * 26) continue;
          if (Math.abs(q.z - c.z) > 30) continue;
          if (q.kind === "bullet") {
            const dmg = c.kind === "cop" ? c.maxHp / 3 + 1 : 32;
            this.damageCar(c, dmg, true);
            this.sparks(sx, sy, q.z, 6, -q.vx, -q.vy, 0.6);
            if (c.kind !== "player" && !c.dead) { c.av += rnd(-0.6, 0.6); this.text(c.x, c.y, "HIT", "#ffd36b", 16); }
          } else if (q.kind === "rocket") {
            this.explode(sx, sy, 1.1, 4);
            this.damageCar(c, 500, true);
          } else {
            const ca = Math.cos(c.a), sa = Math.sin(c.a);
            this.bombs.push({ car: c, ox: dx * ca + dy * sa, oy: -dx * sa + dy * ca, x: sx, y: sy, z: c.z + 11, t: 0 });
            sfx.beep();
            this.text(c.x, c.y, "BOMBE KLEBT", "#ff4d6d", 18);
          }
          remove = true;
          break outer;
        }
      }
      if (!remove) {
        if (this.world.isSolid(q.x, q.y, 2) || q.z < gh) {
          if (q.kind === "rocket") this.explode(q.x, q.y, 1.1, 4);
          else if (q.kind === "bomb") { this.bombs.push({ car: null, ox: 0, oy: 0, x: q.px, y: q.py, z: gh + 3, t: 0 }); sfx.beep(); }
          else this.sparks(q.px, q.py, q.z, 5, -q.vx, -q.vy, 0.5);
          remove = true;
        } else if (q.life <= 0) {
          if (q.kind === "rocket") this.explode(q.x, q.y, 1.1, 4);
          else if (q.kind === "bomb") this.bombs.push({ car: null, ox: 0, oy: 0, x: q.x, y: q.y, z: gh + 3, t: 0 });
          remove = true;
        }
      }
      if (remove) this.projs.splice(i, 1);
    }
    for (const b of this.bombs) {
      b.t += dt;
      if (b.car && !this.cars.includes(b.car)) b.car = null;
      this.bombPos(b);
    }
  }

  // ---------- enter / exit ----------
  toggleCar() {
    if (this.state !== "playing" || this.ending) return;
    if (!this.onFoot) {
      if (this.player.speed > 220) { this.setHint("Zu schnell zum Aussteigen – erst bremsen!", 1.2); return; }
      this.exitCar();
    } else {
      const c = this.nearestEnterable();
      if (c) this.enterCar(c);
      else this.setHint("Kein Auto in der Nähe", 1);
    }
  }

  nearestEnterable(): Car | null {
    let best: Car | null = null, bd = 80;
    for (const c of this.cars) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - this.ped.x, c.y - this.ped.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  private exitCar() {
    const p = this.player;
    const ca = Math.cos(p.a), sa = Math.sin(p.a);
    let x = p.x + sa * 30, y = p.y - ca * 30;
    if (this.world.isSolid(x, y, 8)) { x = p.x - sa * 30; y = p.y + ca * 30; }
    const pd = this.ped;
    pd.x = x; pd.y = y; pd.z = terrainH(x, y); pd.a = p.a; pd.vx = p.vx * 0.3; pd.vy = p.vy * 0.3; pd.dead = false;
    this.onFoot = true;
    p.throttle = 0; p.steer = 0; p.handbrake = true; p.nitro = false;
    sfx.door();
    this.setHint("E / 🚗 zum Einsteigen", 2);
  }

  private enterCar(c: Car) {
    const p = this.player;
    if (c !== p) {
      // leave old car behind as a parked civ car (or wreck)
      const old = new Car("civ", p.model, p.color);
      old.x = p.x; old.y = p.y; old.z = p.z; old.a = p.a; old.vx = p.vx; old.vy = p.vy;
      old.hp = p.hp; old.maxHp = p.maxHp; old.mass = p.mass; old.dead = p.dead; old.wrecked = p.wrecked; old.parked = true; old.deadT = p.deadT; old.wreckT = p.wreckT;
      this.cars.push(old);
      for (const b of this.bombs) if (b.car === p) b.car = old;
      // take the new one
      const wasCop = c.kind === "cop";
      p.x = c.x; p.y = c.y; p.z = c.z; p.a = c.a; p.vx = c.vx; p.vy = c.vy; p.av = 0; p.vz = 0; p.air = false;
      p.model = c.model; p.color = c.color; p.hp = Math.max(c.hp, c.maxHp * 0.6); p.maxHp = c.maxHp; p.mass = Math.max(1, c.mass);
      p.dead = false; p.wrecked = false; p.deadT = 0; p.wreckT = 0; p.parked = false; p.hitFlash = 0;
      p.rlx = NaN;
      for (const b of this.bombs) if (b.car === c) b.car = p;
      this.cars.splice(this.cars.indexOf(c), 1);
      this.banner(wasCop ? "STREIFENWAGEN GEKLAUT" : "AUTO GEKLAUT", wasCop ? "Die mögen das gar nicht" : "+ Fahndung", "#ffd23f", 1.4);
      this.crime(wasCop ? "copCarjack" : "carjack");
      this.addScore(wasCop ? 300 : 100, p.x, p.y, "CARJACK", "#ffd23f", 20);
    }
    this.onFoot = false;
    p.handbrake = false; p.parked = false;
    sfx.door();
  }

  // ---------- loop ----------
  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt <= 0) return;
    if (this.state === "playing" || this.state === "menu") {
      if (this.hitStop > 0) this.hitStop -= dt;
      else {
        const sdt = dt * this.timeScale;
        const steps = sdt > 1 / 70 ? 2 : 1;
        for (let i = 0; i < steps; i++) this.update(sdt / steps);
      }
      this.updateFx(dt);
    } else if (this.state === "over") this.updateFx(dt);
    this.r3d.render(this, dt);
    this.renderOverlay();

    this.hudT -= dt;
    if (this.hudT <= 0 && this.state === "playing") {
      this.hudT = 0.066;
      const p = this.player;
      this.cb.onHud({
        score: Math.floor(this.score), mult: this.mult, combo01: this.comboT / 5, stars: this.wanted.stars, searching: this.wanted.searching, cash: this.cash,
        health01: this.ped.hp / this.ped.maxHp, carHealth01: p.dead ? 0 : p.hp / p.maxHp, nitro01: this.nitro,
        kmh: Math.round(this.fspeed * 0.36), time: this.time, drift: Math.round(this.driftPts), bust01: this.bust, takedowns: this.takedowns,
        weapon: this.weapon, rockets: this.rockets, bombs: this.bombsAmmo, bombsPlaced: this.bombs.length, onFoot: this.onFoot,
        canEnter: this.onFoot && !!this.nearestEnterable(), hint: this.hintT > 0 ? this.hint : "", air: !this.onFoot && p.air && p.airT > 0.25,
      });
    }
    const p = this.player;
    const playing = this.state === "playing" && !this.ending;
    let copsNear = 0;
    for (const c of this.cars) if (c.kind === "cop" && !c.dead && !c.calm && Math.hypot(c.x - this.fx, c.y - this.fy) < 900) copsNear++;
    const drive = playing && !this.onFoot;
    sfx.update(clamp(p.speed / 600, 0, 1), drive ? Math.max(0, p.throttle) : 0, drive ? clamp((Math.abs(p.vR) - 110) / 250, 0, 1) : 0, Math.min(1, copsNear / 2), this.t, playing && (drive || copsNear > 0));
  };

  private readCarInput() {
    const p = this.player, k = this.keys;
    const up = k.has("ArrowUp") || k.has("KeyW"), down = k.has("ArrowDown") || k.has("KeyS");
    const left = k.has("ArrowLeft") || k.has("KeyA"), right = k.has("ArrowRight") || k.has("KeyD");
    const kb = up || down || left || right;
    p.handbrake = k.has("Space") || this.touch.drift;
    const wantNitro = k.has("ShiftLeft") || k.has("ShiftRight") || this.touch.nitro;
    if (kb) { p.throttle = (up ? 1 : 0) - (down ? 1 : 0); p.steer = (right ? 1 : 0) - (left ? 1 : 0); }
    else if (this.touch.active) {
      const { jx, jy } = this.touch;
      const m = Math.min(1, Math.hypot(jx, jy));
      if (m < 0.15) { p.steer = 0; p.throttle = 0; }
      else if (this.config.camera !== "top") { p.steer = clamp(jx * 1.5, -1, 1); p.throttle = jy < -0.25 ? 1 : jy > 0.55 ? -1 : 0.85; }
      else { const diff = wrap(Math.atan2(jy, jx) - p.a); p.steer = clamp(diff * 2.6, -1, 1); p.throttle = m * (Math.abs(diff) > 1.9 ? 0.55 : 1); }
    } else { p.throttle = 0; p.steer = 0; }
    p.nitro = wantNitro && this.nitro > 0.02 && p.throttle >= 0;
    if (p.nitro && !this.nitroWasOn) { sfx.nitro(); this.shake(0.15); }
    this.nitroWasOn = p.nitro;
  }

  private readPedInput(dt: number) {
    const pd = this.ped, k = this.keys;
    const up = k.has("ArrowUp") || k.has("KeyW"), down = k.has("ArrowDown") || k.has("KeyS");
    const left = k.has("ArrowLeft") || k.has("KeyA"), right = k.has("ArrowRight") || k.has("KeyD");
    let jx = 0, jy = 0;
    if (up || down || left || right) { jx = (right ? 1 : 0) - (left ? 1 : 0); jy = (down ? 1 : 0) - (up ? 1 : 0); }
    else if (this.touch.active) { jx = this.touch.jx; jy = this.touch.jy; }
    pd.sprint = k.has("ShiftLeft") || k.has("ShiftRight") || this.touch.nitro;
    const m = Math.min(1, Math.hypot(jx, jy));
    let dx = 0, dy = 0;
    const cam = this.config.camera;
    if (m > 0.15) {
      if (cam === "top") { dx = jx; dy = jy; }
      else if (cam === "fp") {
        // tank controls: left/right turn, up/down move
        pd.a += jx * 2.6 * dt;
        dx = Math.cos(pd.a) * -jy; dy = Math.sin(pd.a) * -jy;
      } else {
        const yaw = this.r3d.camYaw;
        const fxv = Math.cos(yaw), fyv = Math.sin(yaw), rxv = -Math.sin(yaw), ryv = Math.cos(yaw);
        dx = fxv * -jy + rxv * jx; dy = fyv * -jy + ryv * jx;
      }
    }
    const L = Math.hypot(dx, dy);
    const spd = pd.sprint ? 250 : 165;
    const tvx = L > 0 ? (dx / L) * spd * Math.min(1, m / 0.8) : 0, tvy = L > 0 ? (dy / L) * spd * Math.min(1, m / 0.8) : 0;
    const kk = Math.min(1, dt * 10);
    pd.vx += (tvx - pd.vx) * kk; pd.vy += (tvy - pd.vy) * kk;
    pd.moving = L > 0;
    if (pd.moving && pd.shootT <= 0 && cam !== "fp") pd.a += wrap(Math.atan2(pd.vy, pd.vx) - pd.a) * Math.min(1, dt * 12);
  }

  private updatePed(dt: number) {
    const pd = this.ped;
    const w = this.world;
    const nx = pd.x + pd.vx * dt, ny = pd.y + pd.vy * dt;
    if (!w.isSolid(nx, pd.y, 7)) pd.x = nx; else pd.vx = 0;
    if (!w.isSolid(pd.x, ny, 7)) pd.y = ny; else pd.vy = 0;
    pd.x = clamp(pd.x, MAP_MIN + 10, MAP_MAX - 10); pd.y = clamp(pd.y, MAP_MIN + 10, MAP_MAX - 10);
    pd.z = terrainH(pd.x, pd.y);
    pd.walk += dt * Math.hypot(pd.vx, pd.vy) * 0.05;
    pd.shootT = Math.max(0, pd.shootT - dt);
    pd.hitFlash = Math.max(0, pd.hitFlash - dt);
    // cars vs ped
    for (const c of this.cars) {
      const dx = pd.x - c.x, dy = pd.y - c.y;
      if (dx * dx + dy * dy > 40 * 40) continue;
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
      const cx = clamp(lx, -25, 25), cy = clamp(ly, -13, 13);
      let ex = lx - cx, ey = ly - cy;
      let d = Math.hypot(ex, ey);
      if (d > 9) continue;
      if (d < 0.01) { ex = ly >= 0 ? 0 : 0; ey = ly >= 0 ? 1 : -1; d = 1; }
      const nxl = ex / d, nyl = ey / d;
      const wnx = nxl * ca - nyl * sa, wny = nxl * sa + nyl * ca;
      const push = 9 - d;
      pd.x += wnx * push; pd.y += wny * push;
      const vrel = (c.vx - pd.vx) * wnx + (c.vy - pd.vy) * wny;
      if (vrel > 90 && pd.hitFlash <= 0) {
        this.damagePed(vrel * 0.22);
        pd.vx += c.vx * 0.9 + wnx * 120; pd.vy += c.vy * 0.9 + wny * 120;
        sfx.crash(0.5);
        this.sparks(pd.x, pd.y, pd.z + 10, 4, wnx, wny, 0.5);
        if (c.kind === "cop" && !c.calm && this.rules.cops) this.bust = Math.min(1, this.bust + 0.15);
      } else if (vrel > 0) { pd.vx += wnx * vrel; pd.vy += wny * vrel; }
    }
  }

  private update(dt: number) {
    this.t += dt;
    const p = this.player;
    const playing = this.state === "playing";
    const D = this.diff;
    this.fireCd -= dt;
    this.hintT -= dt;

    if (playing && !this.ending) {
      this.time += dt;
      if (this.onFoot) { this.readPedInput(dt); p.throttle = 0; p.steer = 0; p.handbrake = true; p.nitro = false; }
      else this.readCarInput();
      if ((this.fireHeld || this.touch.fire || this.keys.has("KeyF") || this.keys.has("ControlLeft") || this.keys.has("ControlRight")) && (this.weapon === "pistol" || this.fireCd <= 0)) this.fire();
    } else if (playing && this.ending) {
      p.throttle = 0; p.steer = 0; p.nitro = false; p.handbrake = this.ending.reason === "arrested" || this.onFoot;
      this.ped.vx *= 0.9; this.ped.vy *= 0.9;
    } else { this.civAI(p, dt); p.nitro = false; }

    this.nitro = 1; // unlimited nitro

    for (const c of this.cars) {
      if (c === p) continue;
      if (c.dead || c.parked || (c.kind === "civ" && c.wrecked)) { c.throttle = 0; c.steer = 0; c.handbrake = true; continue; }
      if (c.kind === "cop") {
        c.calm = this.wanted.stars === 0;
        if (c.calm) this.patrolAI(c, dt); else this.copAI(c, dt);
      } else this.civAI(c, dt);
    }

    const def = this.carDef;
    for (const c of this.cars) {
      const grass = this.onGrass(c.x, c.y);
      if (c.kind === "player") {
        if (p.dead) this.wreckPhysics(c, dt);
        else if (playing) {
          const st = p.model === def.model ? def : MODEL_STATS[p.model];
          const maxV = p.nitro ? st.maxV + 280 : st.maxV;
          const acc = p.nitro ? st.acc + 500 : st.acc;
          this.drive(c, dt, acc, grass ? maxV * 0.8 : maxV, grass ? st.grip * 0.5 : st.grip, 1.7);
        } else this.drive(c, dt, 300, c.cruise + 20, 12, 3);
      } else if (c.dead || (c.kind === "civ" && c.wrecked && !c.parked)) this.wreckPhysics(c, dt);
      else if (c.kind === "cop") {
        const maxV = D.copV + this.stars * D.copVStar;
        this.drive(c, dt, 560, grass ? maxV * 0.85 : maxV, 9, 2);
      } else this.drive(c, dt, 300, c.cruise + 20, 12, 3);
      this.collideWorld(c);
    }
    this.collideCars();
    if (this.onFoot && playing) this.updatePed(dt);
    if (playing) this.updateProjs(dt);

    for (const c of this.cars) {
      c.hitFlash = Math.max(0, c.hitFlash - dt);
      c.nearCd = Math.max(0, c.nearCd - dt);
      this.carEffects(c, dt);
      if (c.dead) c.deadT += dt;
      if (c.wrecked) c.wreckT += dt;
    }

    const civTarget = this.mobile ? 12 : 16;
    let civs = 0, cops = 0;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (c === p) continue;
      const d = Math.hypot(c.x - this.fx, c.y - this.fy);
      const remove = d > 1900 || (c.wrecked && c.wreckT > 9 && d > 500) || (c.wrecked && c.wreckT > 20 && !c.parked);
      if (remove) { this.cars.splice(i, 1); continue; }
      if (c.kind === "civ" && !c.wrecked) civs++;
      if (c.kind === "cop" && !c.dead) cops++;
    }
    if (civs < civTarget && Math.random() < 0.1 && inCity(this.fx, this.fy)) this.spawnCiv();

    if (!playing) return;

    if (!this.ending) {
      const rules = this.rules;
      if (rules.cops) {
        const w = this.wanted;
        const ev = w.update(dt, D.heat, rules.starsDecay && w.stars > 0 && this.copSeesPlayer());
        if (ev === "up") {
          sfx.star();
          this.banner("★".repeat(w.stars), "FAHNDUNGSLEVEL STEIGT", "#ffd23f", 1.6);
          this.shake(0.2);
        } else if (ev === "lost") {
          sfx.bank();
          this.banner("ENTKOMMEN", "Die Cops haben deine Spur verloren", "#3dff8b", 2);
        }
        this.copSpawnT -= dt;
        const copTarget = D.cops[this.stars] + (!inCity(this.fx, this.fy) && this.stars >= 2 ? 1 : 0);
        if (cops < copTarget && this.copSpawnT <= 0) { this.spawnCop(); this.copSpawnT = D.spawnGap; }
        if (rules.timeHeat) this.score += dt * 6 * this.stars;
      }
      if (rules.damage) {
        if (D.regen > 0 && this.time - this.lastHurt > 3) {
          if (!this.onFoot && !p.dead && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + D.regen * dt);
          if (this.ped.hp < this.ped.maxHp) this.ped.hp = Math.min(this.ped.maxHp, this.ped.hp + D.regen * 1.5 * dt);
        }
      }
      if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) { this.mult = 1; this.comboT = 0; } }

      if (!this.onFoot) {
        const sp = p.speed;
        if (Math.abs(p.vR) > 130 && sp > 160 && !p.dead && !p.air) { this.driftPts += Math.abs(p.vR) * dt * 1.2 * (p.nitro ? 1.5 : 1); this.driftHold = 0.5; }
        else if (this.driftPts > 0) { this.driftHold -= dt; if (this.driftHold <= 0) this.bankDrift(); }
        if (sp > 280) {
          for (const c of this.cars) {
            if (c === p || c.wrecked || c.dead || c.nearCd > 0) continue;
            const d = Math.hypot(c.x - p.x, c.y - p.y);
            const rel = Math.hypot(c.vx - p.vx, c.vy - p.vy);
            if (d < 68 && d > 42 && rel > 240) {
              c.nearCd = 2.5;
              this.addScore(150, p.x, p.y - 30, "NEAR MISS", "#2bf0ff", 20);
              this.addCombo(); sfx.nearMiss(); this.shake(0.08);
            }
          }
        }
      }

      const fx = this.fx, fy = this.fy;
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pk = this.pickups[i];
        if (Math.hypot(pk.x - fx, pk.y - fy) < (this.onFoot ? 30 : 46)) { this.pickups.splice(i, 1); this.collect(pk); }
      }
      let nearCash = 0;
      for (const pk of this.pickups) if (pk.type === "cash" && Math.hypot(pk.x - fx, pk.y - fy) < 1200) nearCash++;
      if (nearCash < 6) this.spawnPickup("cash");
      if (this.pickups.length > 70) this.pickups.shift();

      if (rules.cops && this.wanted.stars > 0) {
        let close = 0;
        for (const c of this.cars) if (c.kind === "cop" && !c.calm && !c.dead && Math.hypot(c.x - fx, c.y - fy) < 85) close++;
        if (close > 0 && this.fspeed < 60) this.bust += dt * (0.3 + close * 0.1) * D.bust * (this.onFoot ? 1.6 : 1);
        else this.bust = Math.max(0, this.bust - dt * 0.8);
        if (this.bust >= 1) { this.bust = 1; this.endRun("arrested"); }
      }
    } else {
      this.ending.t += dt / Math.max(this.timeScale, 0.01);
      this.timeScale = Math.max(0.25, this.timeScale - dt * 2);
      if (this.ending.t > 2.2 && this.state === "playing") {
        this.timeScale = 1;
        if (this.rules.respawn) this.respawn(this.ending.reason);
        else {
          this.setState("over");
          this.cb.onGameOver(this.overData(this.ending.reason));
        }
      }
    }
  }

  private bankDrift() {
    const pts = this.driftPts;
    this.driftPts = 0;
    if (pts < 60) return;
    const p = this.player;
    this.bestDrift = Math.max(this.bestDrift, pts);
    this.addScore(pts, p.x, p.y - 34, "DRIFT", "#ffd23f", pts > 600 ? 30 : 22);
    if (pts > 300) this.addCombo();
    if (pts > 1200) this.banner("MEGA DRIFT", `+${Math.round(pts * this.mult).toLocaleString("de-DE")}`, "#ffd23f", 1.3);
    sfx.bank();
  }

  private collect(pk: Pickup) {
    const p = this.player;
    const z = terrainH(pk.x, pk.y);
    const ring = (col: string) => this.emit(pk.x, pk.y, z + 1, 0, 0, 0, 0.4, 10, 260, col, 4, 0);
    if (pk.type === "cash") {
      this.cash += pk.value;
      this.addScore(pk.value, pk.x, pk.y - 20, "$", "#3dff8b", pk.value >= 500 ? 30 : 22);
      this.addCombo();
      sfx.pickup(this.mult);
      for (let i = 0; i < 16; i++) { const a = Math.random() * TAU, s = rnd(60, 220); this.emit(pk.x, pk.y, z + 12, Math.cos(a) * s + this.fvx * 0.3, Math.sin(a) * s + this.fvy * 0.3, rnd(120, 280), rnd(0.5, 0.9), rnd(2.5, 4.5), 0, "#3dff8b", 5, 2); }
      ring("#3dff8b"); this.shake(0.06);
    } else if (pk.type === "repair") {
      if (!this.onFoot && !p.dead) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
      this.ped.hp = Math.min(this.ped.maxHp, this.ped.hp + 50);
      this.text(pk.x, pk.y - 20, "REPARATUR", "#ffffff", 24); sfx.powerup(); ring("#ffffff"); this.spawnPickup("repair", true);
    } else if (pk.type === "nitro") {
      this.nitro = Math.min(1, this.nitro + 0.6);
      this.text(pk.x, pk.y - 20, "NITRO", "#2bf0ff", 26); sfx.powerup(); ring("#2bf0ff"); this.spawnPickup("nitro", true);
    } else if (pk.type === "rocket") {
      this.rockets = Math.min(30, this.rockets + 10);
      this.text(pk.x, pk.y - 20, "RAKETEN +10", "#ff9a2a", 26); sfx.powerup(); ring("#ff9a2a"); this.spawnPickup("rocket", true);
    } else {
      this.bombsAmmo = Math.min(30, this.bombsAmmo + 10);
      this.text(pk.x, pk.y - 20, "HAFTBOMBEN +10", "#ff4d6d", 26); sfx.powerup(); ring("#ff4d6d"); this.spawnPickup("bomb", true);
    }
  }

  private onGrass(x: number, y: number) {
    if (!inCity(x, y)) return !this.world.isRoad(x, y);
    if (this.world.isRoad(x, y)) return false;
    const b = this.world.blockAt(x, y);
    return !!b && b.kind === "park";
  }

  // ---------- physics ----------
  private drive(c: Car, dt: number, acc: number, maxV: number, grip: number, gripDrift: number) {
    if (c.air) {
      c.airT += dt;
      // nitro in the air: thrust forward and float longer (less gravity)
      const boostAir = c.kind === "player" && c.nitro && !this.onFoot;
      if (boostAir) {
        const fa = Math.cos(c.a), fb = Math.sin(c.a);
        c.vx += fa * AIR_THRUST * dt; c.vy += fb * AIR_THRUST * dt;
        const sp = Math.hypot(c.vx, c.vy);
        if (sp > AIR_MAX) { c.vx *= AIR_MAX / sp; c.vy *= AIR_MAX / sp; }
      }
      c.vz -= GRAV * dt * (boostAir ? 0.45 : 1);
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      c.av *= Math.exp(-1.5 * dt);
      c.a += c.av * dt;
      const gh = this.groundH(c.x, c.y);
      if (c.z <= gh) { this.land(c, gh); }
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      c.vF = c.vx * ca + c.vy * sa; c.vR = -c.vx * sa + c.vy * ca;
      return;
    }
    if (!inCity(c.x, c.y)) {
      const g = terrainGrad(c.x, c.y);
      c.vx -= 520 * g.x * dt; c.vy -= 520 * g.y * dt;
    }
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    let vF = c.vx * ca + c.vy * sa;
    let vR = -c.vx * sa + c.vy * ca;
    const t = c.throttle;
    if (t > 0) { if (vF < maxV) vF += acc * t * dt * (vF < 120 ? 1.3 : 1); }
    else if (t < 0) { if (vF > 20) vF -= 1100 * -t * dt; else if (vF > -maxV * 0.4) vF += acc * 0.7 * t * dt; }
    else vF -= vF * 0.8 * dt;
    if (vF > maxV) vF += (maxV - vF) * Math.min(1, 1.5 * dt);
    vF -= vF * 0.12 * dt;
    const drifting = c.handbrake;
    vR *= Math.exp(-(drifting ? gripDrift : grip) * dt);
    if (drifting) vF -= vF * 0.5 * dt;
    vF -= Math.sign(vF) * Math.abs(vR) * 0.25 * dt;
    const sp = Math.abs(vF);
    const turnAmt = Math.min(1, sp / 100) * (1 - Math.min(0.3, sp / 2200));
    const dir = vF >= -5 ? 1 : -1;
    c.av += (c.steer * 3.2 * turnAmt * dir * (drifting ? 1.45 : 1) - c.av) * Math.min(1, dt * 14);
    c.a += c.av * dt;
    c.vx = ca * vF - sa * vR; c.vy = sa * vF + ca * vR;
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.vF = vF; c.vR = vR;
    this.followTerrain(c, dt);
  }

  private followTerrain(c: Car, dt: number) {
    const gh = this.groundH(c.x, c.y);
    const zFall = c.z + c.vz * dt - 0.5 * GRAV * dt * dt;
    // leave the ground when launched off a ramp or hill crest, or when driving off a roof edge
    if ((zFall > gh + 1.5 && c.vz > 40 && c.speed > 120) || c.z - gh > 25) { c.air = true; c.airT = 0; c.z = zFall; }
    else { c.vz = clamp((gh - c.z) / dt, -900, 900); c.z = gh; }
  }

  // ground height under a car: terrain, ramps and building roofs
  private groundH(x: number, y: number): number {
    const w = this.world;
    return Math.max(terrainH(x, y), w.rampH(x, y), w.roofAt(x, y));
  }

  private land(c: Car, gh: number) {
    const impact = -c.vz;
    c.z = gh; c.air = false;
    if (impact > 180) {
      const g = terrainGrad(c.x, c.y);
      c.vz = 0;
      for (let i = 0; i < 8; i++) this.emit(c.x + rnd(-15, 15), c.y + rnd(-15, 15), gh + 2, rnd(-60, 60), rnd(-60, 60), rnd(20, 60), rnd(0.5, 1), rnd(8, 12), 30, "#8a7a62", 0, 1.5);
      void g;
      if (c.kind === "player" && !this.onFoot) {
        sfx.land();
        this.shake(Math.min(0.5, impact / 900));
        if (c.airT > 0.6 && this.state === "playing" && !this.ending) {
          this.addScore(Math.round(c.airT * 250), c.x, c.y, "AIRTIME", "#2bf0ff", 24);
          if (c.airT > 1.2) this.banner("MEGA JUMP", `${c.airT.toFixed(1)}s in der Luft`, "#2bf0ff", 1.3);
          this.addCombo();
        }
        if (impact > 520) this.damagePlayerCar((impact - 520) * 0.04);
      } else if (impact > 600 && c.kind === "cop") this.damageCar(c, (impact - 600) * 0.1);
    } else c.vz = 0;
    c.airT = 0;
  }

  private wreckPhysics(c: Car, dt: number) {
    const f = Math.exp(-2.4 * dt);
    c.vx *= f; c.vy *= f;
    c.av *= Math.exp(-2.5 * dt);
    c.a += c.av * dt;
    c.x += c.vx * dt; c.y += c.vy * dt;
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    c.vF = c.vx * ca + c.vy * sa; c.vR = -c.vx * sa + c.vy * ca;
    if (c.air) { c.vz -= GRAV * dt; c.z += c.vz * dt; const gh = this.groundH(c.x, c.y); if (c.z <= gh) { c.z = gh; c.air = false; c.vz = 0; } }
    else c.z = this.groundH(c.x, c.y);
  }

  private collideWorld(c: Car) {
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    const R = 12;
    let maxImpact = 0, hx = 0, hy = 0, hnx = 0, hny = 0;
    const city = inCity(c.x, c.y);
    const bs = city ? this.world.nearbyBuildings(c.x, c.y, this.tmpB) : [];
    for (let s = -1; s <= 1; s += 2) {
      const resolve = (nx: number, ny: number, pen: number, cx: number, cy: number) => {
        c.x += nx * pen; c.y += ny * pen;
        const vn = c.vx * nx + c.vy * ny;
        if (vn < 0) {
          c.vx -= 1.3 * vn * nx; c.vy -= 1.3 * vn * ny; c.vx *= 0.96; c.vy *= 0.96;
          const cross = ca * ny - sa * nx;
          c.av += -s * cross * Math.min(4, -vn * 0.012);
          if (-vn > maxImpact) { maxImpact = -vn; hx = cx; hy = cy; hnx = nx; hny = ny; }
        }
      };
      const px = c.x + ca * 12 * s, py = c.y + sa * 12 * s;
      if (px < MAP_MIN + R) resolve(1, 0, MAP_MIN + R - px, MAP_MIN, py);
      if (py < MAP_MIN + R) resolve(0, 1, MAP_MIN + R - py, px, MAP_MIN);
      if (px > MAP_MAX - R) resolve(-1, 0, px - (MAP_MAX - R), MAP_MAX, py);
      if (py > MAP_MAX - R) resolve(0, -1, py - (MAP_MAX - R), px, MAP_MAX);
      for (const b of bs) {
        if (c.z >= roofOf(b) - 25) continue; // car is up on/above the roof: no wall
        const qx = c.x + ca * 12 * s, qy = c.y + sa * 12 * s;
        const cx = clamp(qx, b.x, b.x + b.w), cy = clamp(qy, b.y, b.y + b.h);
        let dx = qx - cx, dy = qy - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R) continue;
        if (d2 < 0.0001) {
          const l = qx - b.x, r = b.x + b.w - qx, t = qy - b.y, bt = b.y + b.h - qy;
          const m = Math.min(l, r, t, bt);
          if (m === l) resolve(-1, 0, l + R, b.x, qy); else if (m === r) resolve(1, 0, r + R, b.x + b.w, qy);
          else if (m === t) resolve(0, -1, t + R, qx, b.y); else resolve(0, 1, bt + R, qx, b.y + b.h);
          continue;
        }
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        resolve(dx, dy, R - d, cx, cy);
      }
    }
    if (maxImpact > 90) this.onWallHit(c, maxImpact, hx, hy, hnx, hny);
  }

  private onWallHit(c: Car, impact: number, x: number, y: number, nx: number, ny: number) {
    this.sparks(x, y, c.z + 8, Math.min(18, Math.floor(impact / 30)), nx, ny);
    for (let i = 0; i < 3; i++) this.emit(x, y, c.z + 8, nx * 40 + rnd(-30, 30), ny * 40 + rnd(-30, 30), rnd(15, 35), rnd(0.5, 1), rnd(6, 12), 20, "#6b6478", 0, 2);
    if (c.kind === "player") {
      if (!this.onFoot) { sfx.crash(impact / 500); this.shake(Math.min(0.6, impact / 900)); }
      if (impact > 160) {
        this.damagePlayerCar((impact - 160) * 0.045);
        if (this.driftPts > 100) { this.driftPts = 0; this.text(c.x, c.y - 30, "DRIFT VERLOREN", "#ff4d6d", 20); }
      }
      if (impact > 300 && !this.onFoot) this.hitStop = Math.max(this.hitStop, 0.035);
    } else if (c.kind === "cop") {
      if (impact > 130) {
        this.damageCar(c, (impact - 130) * (this.config.difficulty === "easy" ? 0.35 : 0.22));
        if (Math.hypot(c.x - this.fx, c.y - this.fy) < 600) sfx.crash(impact / 900);
      }
    } else if (impact > 150) this.damageCar(c, (impact - 150) * 0.1);
  }

  private collideCars() {
    const cars = this.cars;
    const R2 = 38;
    for (let i = 0; i < cars.length; i++) {
      const a = cars[i];
      for (let j = i + 1; j < cars.length; j++) {
        const b = cars[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        if (dx > R2 || dx < -R2 || dy > R2 || dy < -R2) continue;
        if (Math.abs(a.z - b.z) > 22) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R2 * R2 || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        const pen = R2 - d;
        const ma = a.mass, mb = b.mass;
        const ia = mb / (ma + mb), ib = ma / (ma + mb);
        a.x -= dx * pen * ia; a.y -= dy * pen * ia; b.x += dx * pen * ib; b.y += dy * pen * ib;
        const vn = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy;
        if (vn >= 0) continue;
        const jImp = -1.4 * vn;
        a.vx -= jImp * dx * ia; a.vy -= jImp * dy * ia; b.vx += jImp * dx * ib; b.vy += jImp * dy * ib;
        a.av += rnd(-1, 1) * Math.min(5, -vn * 0.01); b.av += rnd(-1, 1) * Math.min(5, -vn * 0.01);
        this.onCarHit(a, b, -vn, a.x + dx * 19, a.y + dy * 19, dx, dy);
      }
    }
  }

  private onCarHit(a: Car, b: Car, impact: number, x: number, y: number, nx: number, ny: number) {
    if (impact < 40) return;
    const playing = this.state === "playing" && !this.ending;
    const p = a.kind === "player" ? a : b.kind === "player" ? b : null;
    const other = p === a ? b : a;
    this.sparks(x, y, a.z + 8, Math.min(16, Math.floor(impact / 35)), nx, ny);
    if (p) {
      if (!this.onFoot) { sfx.crash(impact / 500); this.shake(Math.min(0.55, impact / 800)); }
      if (!playing) return;
      if (other.kind === "cop") {
        this.damageCar(other, impact * 0.15 + (p.nitro ? 22 : 0));
        if (impact > 80 && p.hitFlash <= 0) this.damagePlayerCar(impact * 0.025 + 2);
        this.crime("copRam");
      } else if (other.kind === "civ") {
        const wasWrecked = other.wrecked;
        this.damageCar(other, impact * 0.12 + 5);
        if (!wasWrecked && !this.onFoot) { this.addScore(100, other.x, other.y - 20, "CRASH", "#ff9f43", 18); this.crime("civCrash"); this.comboT = Math.max(this.comboT, 2); }
        if (p.hitFlash <= 0) this.damagePlayerCar(impact * 0.01);
      }
      if (impact > 300 && !this.onFoot) this.hitStop = Math.max(this.hitStop, 0.04);
    } else {
      if (a.kind === "cop" && b.kind === "cop") { this.damageCar(a, impact * 0.12); this.damageCar(b, impact * 0.12); }
      else {
        if (a.kind === "civ") this.damageCar(a, impact * 0.08 + 4);
        if (b.kind === "civ") this.damageCar(b, impact * 0.08 + 4);
        if (a.kind === "cop") this.damageCar(a, impact * 0.04);
        if (b.kind === "cop") this.damageCar(b, impact * 0.04);
      }
    }
  }

  // ---------- AI ----------
  private steerTo(c: Car, tx: number, ty: number) {
    const diff = wrap(Math.atan2(ty - c.y, tx - c.x) - c.a);
    c.steer = clamp(diff * 2.4, -1, 1);
    return diff;
  }
  private avoid(c: Car) {
    const look = 46 + Math.abs(c.vF) * 0.28;
    const w = this.world;
    if (w.isSolid(c.x + Math.cos(c.a) * look, c.y + Math.sin(c.a) * look, 6)) {
      const l = w.isSolid(c.x + Math.cos(c.a - 0.75) * look * 0.85, c.y + Math.sin(c.a - 0.75) * look * 0.85, 6);
      const r = w.isSolid(c.x + Math.cos(c.a + 0.75) * look * 0.85, c.y + Math.sin(c.a + 0.75) * look * 0.85, 6);
      if (l && !r) c.steer = 1; else if (r && !l) c.steer = -1;
      if (Math.abs(c.vF) > 260) c.throttle = Math.min(c.throttle, 0.2);
    }
  }
  private stuck(c: Car, dt: number) {
    if (c.reverseT > 0) { c.reverseT -= dt; c.throttle = -1; c.steer = -c.steer; return; }
    if (Math.abs(c.vF) < 25 && c.throttle > 0) { c.stuckT += dt; if (c.stuckT > 0.8) { c.reverseT = 0.7; c.stuckT = 0; } }
    else c.stuckT = 0;
  }

  private civAI(c: Car, dt: number) {
    const w = this.world;
    const from = w.nodePos(c.prevI, c.prevJ), to = w.nodePos(c.wpI, c.wpJ);
    let dx = to.x - from.x, dy = to.y - from.y;
    const L = Math.hypot(dx, dy) || 1;
    dx /= L; dy /= L;
    const tx = to.x - dy * 34 - dx * 10, ty = to.y + dx * 34 - dy * 10;
    if (Math.hypot(tx - c.x, ty - c.y) < 55) {
      const opts: number[][] = [];
      for (const d of DIRS) {
        const ni = c.wpI + d[0], nj = c.wpJ + d[1];
        if (ni < 0 || nj < 0 || ni > GRID || nj > GRID) continue;
        if (ni === c.prevI && nj === c.prevJ) continue;
        opts.push([ni, nj]);
      }
      const chs = opts.length ? opts[Math.floor(Math.random() * opts.length)] : [c.prevI, c.prevJ];
      c.prevI = c.wpI; c.prevJ = c.wpJ; c.wpI = chs[0]; c.wpJ = chs[1];
    }
    const diff = this.steerTo(c, tx, ty);
    const want = c.cruise * (Math.abs(diff) > 0.45 ? 0.55 : 1);
    c.throttle = c.vF < want ? 1 : c.vF > want + 40 ? -0.4 : 0;
    c.handbrake = false;
    for (const o of this.cars) {
      if (o === c) continue;
      const ox = o.x - c.x, oy = o.y - c.y;
      const fwd = ox * Math.cos(c.a) + oy * Math.sin(c.a);
      if (fwd > 0 && fwd < 80) { const lat = -ox * Math.sin(c.a) + oy * Math.cos(c.a); if (Math.abs(lat) < 22) { c.throttle = c.vF > 40 ? -0.6 : 0; break; } }
    }
    if (this.onFoot) {
      const ox = this.ped.x - c.x, oy = this.ped.y - c.y;
      const fwd = ox * Math.cos(c.a) + oy * Math.sin(c.a);
      if (fwd > 0 && fwd < 90 && Math.abs(-ox * Math.sin(c.a) + oy * Math.cos(c.a)) < 20) c.throttle = c.vF > 20 ? -1 : 0;
    }
    this.stuck(c, dt);
  }

  // cop without a wanted level: drive along the streets like traffic
  private patrolAI(c: Car, dt: number) {
    if (!c.route) {
      const n = this.world.nearestNode(c.x, c.y);
      const dir = DIRS[Math.floor(Math.random() * 4)];
      c.prevI = n.i; c.prevJ = n.j;
      c.wpI = clamp(n.i + dir[0], 0, GRID); c.wpJ = clamp(n.j + dir[1], 0, GRID);
      if (c.wpI === n.i && c.wpJ === n.j) c.wpI = n.i > 0 ? n.i - 1 : n.i + 1;
      c.route = true;
    }
    this.civAI(c, dt);
  }

  private copAI(c: Car, dt: number) {
    c.route = false;
    const fx = this.fx, fy = this.fy;
    const w = this.world;
    const d = Math.hypot(fx - c.x, fy - c.y);
    let tx: number, ty: number;
    if (this.ending || this.ped.dead) { this.steerTo(c, fx, fy); c.throttle = d > 120 ? 0.6 : -0.3; c.handbrake = false; return; }
    // cops also use ramps: "elevated" = currently on a ramp or roof
    const elevated = c.z > terrainH(c.x, c.y) + 15;
    const roofRamp = !this.onFoot && this.player.z > 25 ? w.rampToRoofAt(fx, fy) : null;
    const direct = elevated || !inCity(c.x, c.y) || !inCity(fx, fy) || (d < 650 && w.lineClear(c.x, c.y, fx, fy));
    if (roofRamp && !elevated) {
      // player is on a roof: head for the ramp that leads up there
      const rs = w.rampStart(roofRamp);
      tx = rs.x; ty = rs.y;
      c.hasWp = false;
    } else if (direct) {
      const lead = Math.min(this.diff.lead, d / 700);
      tx = fx + this.fvx * lead; ty = fy + this.fvy * lead;
      c.hasWp = false;
    } else {
      if (!c.hasWp || Math.hypot(c.x - w.nodePos(c.wpI, c.wpJ).x, c.y - w.nodePos(c.wpI, c.wpJ).y) < 70) {
        const cur = c.hasWp ? { i: c.wpI, j: c.wpJ } : w.nearestNode(c.x, c.y);
        const pn = w.nearestNode(fx, fy);
        const di = pn.i - cur.i, dj = pn.j - cur.j;
        let ni = cur.i, nj = cur.j;
        if (di === 0 && dj === 0) { /* direct */ }
        else if (Math.abs(di) > Math.abs(dj) || (Math.abs(di) === Math.abs(dj) && Math.random() < 0.5)) ni += Math.sign(di);
        else nj += Math.sign(dj);
        if (!c.hasWp) {
          const a = w.nodePos(cur.i, cur.j), b = w.nodePos(ni, nj);
          const onSeg = ni !== cur.i ? Math.abs(c.y - a.y) < ROAD / 2 && (c.x - a.x) * (b.x - a.x) > 0 : Math.abs(c.x - a.x) < ROAD / 2 && (c.y - a.y) * (b.y - a.y) > 0;
          if (onSeg || (di === 0 && dj === 0)) { c.wpI = ni; c.wpJ = nj; } else { c.wpI = cur.i; c.wpJ = cur.j; }
        } else { c.wpI = ni; c.wpJ = nj; }
        c.hasWp = true;
      }
      const np = w.nodePos(c.wpI, c.wpJ);
      tx = np.x; ty = np.y;
    }
    const diff = this.steerTo(c, tx, ty);
    c.throttle = Math.abs(diff) > 1.4 ? 0.45 : 1;
    c.handbrake = Math.abs(diff) > 1.1 && Math.abs(c.vF) > 260;
    if (this.onFoot && d < 320 && c.vF > 240) c.throttle = -0.3;
    this.avoid(c);
    this.stuck(c, dt);
  }

  // ---------- effects ----------
  private carEffects(c: Car, dt: number) {
    const ca = Math.cos(c.a), sa = Math.sin(c.a);
    const rx = c.x - ca * 15, ry = c.y - sa * 15;
    const lx = rx + sa * 10, ly = ry - ca * 10, rrx = rx - sa * 10, rry = ry + ca * 10;
    const sliding = !c.air && (Math.abs(c.vR) > 120 || (c.handbrake && Math.abs(c.vF) > 120) || (c.throttle < 0 && c.vF > 250));
    const near = Math.abs(c.x - this.fx) < 1100 && Math.abs(c.y - this.fy) < 1100;
    if (sliding && near && !c.wrecked) {
      if (!isNaN(c.rlx)) { this.addSkid(c.rlx, c.rly, lx, ly); this.addSkid(c.rrx, c.rry, rrx, rry); }
      c.rlx = lx; c.rly = ly; c.rrx = rrx; c.rry = rry;
      c.smokeT -= dt;
      if (c.smokeT <= 0) {
        c.smokeT = c.kind === "player" ? 0.025 : 0.06;
        const side = Math.random() < 0.5 ? 1 : -1;
        this.emit(rx + sa * 10 * side, ry - ca * 10 * side, c.z + 4, c.vx * 0.15 + rnd(-20, 20), c.vy * 0.15 + rnd(-20, 20), rnd(10, 30), rnd(0.7, 1.2), rnd(7, 11), 34, "#9a93a9", 0, 1.8);
      }
    } else c.rlx = NaN;
    if (near && !c.air && c.speed > 200 && !inCity(c.x, c.y) && !this.world.isRoad(c.x, c.y) && Math.random() < 0.5) {
      this.emit(rx, ry, c.z + 3, c.vx * 0.1 + rnd(-20, 20), c.vy * 0.1 + rnd(-20, 20), rnd(10, 40), rnd(0.6, 1.1), rnd(6, 10), 28, "#8a7a62", 0, 1.5);
    }
    if (near && (c.kind !== "civ" || c.dead)) {
      const hp01 = c.hp / c.maxHp;
      if ((hp01 < 0.5 || c.dead) && Math.random() < (c.dead ? 0.5 : (0.5 - hp01) * 1.2)) {
        const fxp = c.x + ca * 14, fyp = c.y + sa * 14;
        this.emit(fxp, fyp, c.z + 16, rnd(-15, 15), rnd(-15, 15), rnd(30, 60), rnd(0.9, 1.8), rnd(6, 10), 28, c.dead ? "#1f1b24" : "#4a4552", 0, 1);
        if (hp01 < 0.25 || (c.dead && c.deadT < 8)) this.emit(fxp, fyp, c.z + 14, rnd(-20, 20), rnd(-20, 20), rnd(20, 50), rnd(0.25, 0.5), rnd(6, 11), -8, "#ff7a1a", 2, 2);
      }
    }
    if (c.nitro && c.kind === "player") {
      for (let i = 0; i < 2; i++) {
        const sx = c.x - ca * 26 + sa * rnd(-5, 5), sy = c.y - sa * 26 - ca * rnd(-5, 5);
        this.emit(sx, sy, c.z + 8, -ca * rnd(200, 360) + c.vx * 0.6, -sa * rnd(200, 360) + c.vy * 0.6, 0, rnd(0.1, 0.22), rnd(5, 9), -12, Math.random() < 0.5 ? "#2bf0ff" : "#9d4dff", 2, 1);
      }
    }
  }

  private addSkid(x1: number, y1: number, x2: number, y2: number) {
    const i = this.skidHead * 4;
    this.skids[i] = x1; this.skids[i + 1] = y1; this.skids[i + 2] = x2; this.skids[i + 3] = y2;
    this.skidHead = (this.skidHead + 1) % MAX_SKIDS;
    this.skidTotal++;
  }

  private updateFx(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      if (q.life <= 0) { this.particles.splice(i, 1); continue; }
      const f = Math.exp(-q.drag * dt);
      q.vx *= f; q.vy *= f;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.type === 1 || q.type === 3 || q.type === 5) {
        q.vz -= 750 * dt; q.z += q.vz * dt;
        const gh = terrainH(q.x, q.y) + 0.5;
        if (q.z < gh) { q.z = gh; q.vz *= -0.35; q.vx *= 0.7; q.vy *= 0.7; }
      } else { q.vz *= f; q.z += q.vz * dt; }
      q.size = Math.max(0.5, q.size + q.grow * dt);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.life -= dt; t.h += 30 * dt; if (t.life <= 0) this.texts.splice(i, 1); }
    for (let i = this.banners.length - 1; i >= 0; i--) { this.banners[i].life -= dt; if (this.banners[i].life <= 0) this.banners.splice(i, 1); }
    for (let i = this.flashes.length - 1; i >= 0; i--) { this.flashes[i].life -= dt; if (this.flashes[i].life <= 0) this.flashes.splice(i, 1); }
    for (const pk of this.pickups) pk.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const s = this.trauma * this.trauma;
    const tt = performance.now() / 1000;
    this.shakeX = s * 22 * (Math.sin(tt * 47.3) * 0.6 + Math.sin(tt * 91.7) * 0.4);
    this.shakeY = s * 22 * (Math.sin(tt * 53.1 + 1) * 0.6 + Math.sin(tt * 79.3) * 0.4);
    this.shakeR = s * 0.04 * Math.sin(tt * 37.7);
  }

  // ---------- overlay ----------
  private renderOverlay() {
    const ctx = this.ctx;
    const { cw, ch, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    this.drawTexts(ctx);
    if (this.player.nitro && this.state === "playing" && !this.onFoot) this.drawSpeedLines(ctx);
    if (this.state === "playing" && !this.ending && this.config.camera !== "top") this.drawCrosshair(ctx);
    if (this.state !== "menu") { this.drawMinimap(ctx); this.drawBanners(ctx); }
  }

  private drawCrosshair(ctx: CanvasRenderingContext2D) {
    const facing = this.onFoot ? (this.config.camera === "fp" ? this.ped.a : this.r3d.camYaw) : this.player.a;
    const ox = this.fx, oy = this.fy;
    const t = this.findTarget(ox, oy, facing, this.onFoot ? Math.PI : 1.75);
    if (!t) return;
    const s = this.r3d.project(t.x, t.y, t.z + 14);
    if (!s.ok) return;
    const r = 22 + Math.sin(this.t * 10) * 3;
    ctx.strokeStyle = this.weapon === "rocket" ? "#ff9a2a" : this.weapon === "bomb" ? "#ff4d6d" : "#ff3cac";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      ctx.moveTo(s.x + Math.cos(a) * r * 0.55, s.y + Math.sin(a) * r * 0.55);
      ctx.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
    }
    ctx.stroke();
    ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, TAU); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
  }

  private drawTexts(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const t of this.texts) {
      const s = this.r3d.project(t.x, t.y, t.h);
      if (!s.ok) continue;
      const age = 1 - t.life / t.max;
      const pop = age < 0.15 ? 0.5 + (age / 0.15) * 0.8 : age < 0.25 ? 1.3 - ((age - 0.15) / 0.1) * 0.3 : 1;
      ctx.globalAlpha = Math.min(1, t.life * 2.5);
      ctx.font = `${Math.round(t.size * pop * 1.15)}px "Bebas Neue", Impact, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeText(t.text, s.x, s.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, s.x, s.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawSpeedLines(ctx: CanvasRenderingContext2D) {
    const { cw, ch } = this;
    ctx.strokeStyle = "rgba(200,240,255,0.2)"; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU, r0 = Math.max(cw, ch) * rnd(0.3, 0.5), r1 = r0 + rnd(60, 180);
      ctx.moveTo(cw / 2 + Math.cos(a) * r0, ch / 2 + Math.sin(a) * r0);
      ctx.lineTo(cw / 2 + Math.cos(a) * r1, ch / 2 + Math.sin(a) * r1);
    }
    ctx.stroke();
  }

  private drawMinimap(ctx: CanvasRenderingContext2D) {
    const size = this.mobile ? 104 : 150, pad = this.mobile ? 10 : 18;
    const x = this.cw - size - pad, y = this.mobile ? 64 : pad;
    const cxm = x + size / 2, cym = y + size / 2;
    const range = inCity(this.fx, this.fy) ? 1500 : 2600;
    const MS = MAP_MAX - MAP_MIN;
    const sc = this.minimap.width / MS;
    const fx = this.fx, fy = this.fy;
    ctx.save();
    ctx.beginPath(); ctx.arc(cxm, cym, size / 2, 0, TAU); ctx.fillStyle = "#06121f"; ctx.fill(); ctx.clip();
    const srcS = range * 2 * sc, W = this.minimap.width;
    const sx = (fx - range - MAP_MIN) * sc, sy = (fy - range - MAP_MIN) * sc;
    const sx0 = Math.max(0, sx), sy0 = Math.max(0, sy), sx1 = Math.min(W, sx + srcS), sy1 = Math.min(W, sy + srcS);
    if (sx1 > sx0 && sy1 > sy0) {
      const f = size / srcS;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(this.minimap, sx0, sy0, sx1 - sx0, sy1 - sy0, x + (sx0 - sx) * f, y + (sy0 - sy) * f, (sx1 - sx0) * f, (sy1 - sy0) * f);
      ctx.globalAlpha = 1;
    }
    const m = size / (range * 2);
    for (const pk of this.pickups) {
      const dx = (pk.x - fx) * m, dy = (pk.y - fy) * m;
      if (Math.abs(dx) > size / 2 || Math.abs(dy) > size / 2) continue;
      ctx.fillStyle = pk.type === "cash" ? "#3dff8b" : pk.type === "nitro" ? "#2bf0ff" : pk.type === "rocket" ? "#ff9a2a" : pk.type === "bomb" ? "#ff4d6d" : "#fff";
      ctx.fillRect(cxm + dx - 2, cym + dy - 2, 4, 4);
    }
    for (const c of this.cars) {
      if (c.kind !== "cop" || c.dead) continue;
      let dx = (c.x - fx) * m, dy = (c.y - fy) * m;
      const d = Math.hypot(dx, dy);
      if (d > size / 2 - 5) { dx *= (size / 2 - 5) / d; dy *= (size / 2 - 5) / d; }
      ctx.fillStyle = Math.sin(this.t * 14 + c.siren) > 0 ? "#ff2244" : "#3d7bff";
      ctx.beginPath(); ctx.arc(cxm + dx, cym + dy, 3.5, 0, TAU); ctx.fill();
    }
    if (this.rules.respawn) {
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 9px Inter, sans-serif";
      for (const pl of this.places) {
        let dx = (pl.x - fx) * m, dy = (pl.y - fy) * m;
        const d = Math.hypot(dx, dy);
        if (d > size / 2 - 7) { dx *= (size / 2 - 7) / d; dy *= (size / 2 - 7) / d; }
        ctx.fillStyle = pl.color; ctx.beginPath(); ctx.arc(cxm + dx, cym + dy, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillText(pl.icon, cxm + dx, cym + dy + 0.5);
      }
    }
    if (this.onFoot && !this.player.dead) {
      const dx = (this.player.x - fx) * m, dy = (this.player.y - fy) * m;
      ctx.fillStyle = "#ffd23f"; ctx.fillRect(cxm + dx - 3, cym + dy - 3, 6, 6);
    }
    ctx.translate(cxm, cym); ctx.rotate(this.fa);
    ctx.fillStyle = "#ff3cac";
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(255,60,172,0.8)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cxm, cym, size / 2, 0, TAU); ctx.stroke();
  }

  private drawBanners(ctx: CanvasRenderingContext2D) {
    const { cw, ch } = this;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    let yy = ch * 0.3;
    for (let i = this.banners.length - 1; i >= 0; i--) {
      const b = this.banners[i];
      const age = b.max - b.life;
      const pop = age < 0.12 ? 0.4 + (age / 0.12) * 0.8 : age < 0.22 ? 1.2 - ((age - 0.12) / 0.1) * 0.2 : 1;
      const alpha = Math.min(1, b.life * 3);
      const big = b.big;
      const fs = Math.min(cw * (big ? 0.2 : 0.11), big ? 140 : 72) * pop;
      const by = big ? ch * 0.42 : yy;
      ctx.globalAlpha = alpha;
      ctx.font = `${Math.round(fs)}px "Bebas Neue", Impact, sans-serif`;
      ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.strokeText(b.text, cw / 2, by);
      ctx.fillStyle = b.color; ctx.fillText(b.text, cw / 2, by);
      if (b.sub) {
        ctx.font = `600 ${Math.round(Math.max(13, fs * 0.24))}px Inter, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 4;
        ctx.strokeText(b.sub, cw / 2, by + fs * 0.55); ctx.fillText(b.sub, cw / 2, by + fs * 0.55);
      }
      yy += fs * 0.95;
    }
    ctx.globalAlpha = 1;
  }
}
