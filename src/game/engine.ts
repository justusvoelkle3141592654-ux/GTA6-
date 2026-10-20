import { sfx } from "./audio";
import { World, MAP_MIN, MAP_MAX, inCity, terrainH, terrainGrad, roofOf, type Building } from "./world";
import { Renderer3D } from "./renderer3d";
import { MODE_RULES, type Mode, type ModeRules } from "./modes";
import { Wanted, CRIMES, type Crime } from "./wanted";
import { buildPlaces, respawnCost, RESPAWN_RULES, type Place } from "./places";
import { PedSystem, PED_LIMIT, type Civilian } from "./peds";
import { Car, CARS, MODEL_STATS, MODEL_NAME, type CarDef, type FactionId } from "./vehicles";
import { Inventory, WEAPONS, WEAPON_DEFS, type Weapon } from "./weapons";
import { AUTOSAVE_EVERY, emptyProgress, emptyStats, writeSave, type Progress, type SaveData, type SaveResult, type SaveStats } from "./save";
import { Traffic, PARKED_LIMIT } from "./traffic";
import { DISTRICTS, districtAt, type DistrictId } from "./districts";
import { Radio } from "./radio";
import { GARAGE_SLOTS, MAX_TUNE, PAINTS, TUNE_DEFS, tuneAcc, tuneDamage, tuneGrip, tuneHp, tuneSpeed, type OwnedCar, type TunePart } from "./garage";
import { AMMO_FOR_SALE, ARMOR_PRICE, FOOD, GUNS_FOR_SALE, OUTFITS, PAINT_PRICE, REPAIR_PER_HP, ROB_COOLDOWN, ROB_HEAT, ROB_REWARD, type ShopAction } from "./economy";
import { PLACE_RADIUS } from "./places";
import { Bindings } from "./input";
import { Missions } from "./missions";
import { Jobs, jobFor } from "./jobs";
import { currentSettings } from "./settings";
import { findRoute, MAX_ROUTE } from "./route";
import { Tips } from "./tips";
import { Police } from "./police";

export type GameState = "menu" | "playing" | "paused" | "over" | "modal";
// overlays that stop the game while open (shops, dialogs, weapon wheel)
export type ModalInfo =
  | { kind: "shop"; place: Place }
  | { kind: "dialog"; speaker: string; text: string; color: string; index: number; count: number }
  | { kind: "wheel" };
export interface DialogLine { speaker: string; text: string; color: string; }

// what the shop overlay shows
export interface ShopView {
  cash: number; hp: number; maxHp: number; armor: number; outfit: number; stars: number;
  weapons: { w: Weapon; owned: boolean; total: number; canAmmo: boolean }[];
  car: { name: string; hp: number; maxHp: number; color: string; tune: Record<TunePart, number>; repair: number } | null;
  garage: { name: string; color: string; tune: Record<TunePart, number>; value: number }[];
  slots: number;
  robWait: number; // seconds until the shop can be robbed again
}
export type { Mode } from "./modes";
export { Car, CARS, LEGACY_CAR_IDS } from "./vehicles";
export type { CarDef, CarModel } from "./vehicles";
export type Difficulty = "easy" | "normal" | "hard";
export type CameraMode = "chase" | "fp" | "top";
export type Quality = "high" | "low";
export { WEAPONS } from "./weapons";
export type { Weapon } from "./weapons";

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
  weapon: Weapon; ammo: number; reserve: number; reloading: boolean; owned: Weapon[];
  bombsPlaced: number; onFoot: boolean; canEnter: boolean; hint: string; air: boolean;
  armor01: number; district: string; districtColor: string;
  place: string;          // name of the place you can enter right now ("" = none)
  radio: string;          // station name while driving ("" = off)
  objective: string; objTimer: number; // mission text and seconds left (-1 = no timer)
  job: string;            // "starten" / "beenden" when the job key does something
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
  onStartKey?: () => void; // Enter/R in menu or after a run: lets the UI decide (new game or continue)
  onModal?: (m: ModalInfo | null) => void;
  onMapKey?: () => void; // M: open the big map (pause menu)
}

export interface Ped { x: number; y: number; z: number; a: number; vx: number; vy: number; hp: number; maxHp: number; armor: number; walk: number; moving: boolean; sprint: boolean; shootT: number; hitFlash: number; dead: boolean; }
export const MAX_ARMOR = 100;
const newPed = (x: number, y: number, a = 0): Ped => ({ x, y, z: terrainH(x, y), a, vx: 0, vy: 0, hp: 100, maxHp: 100, armor: 0, walk: 0, moving: false, sprint: false, shootT: 0, hitFlash: 0, dead: false });
export interface Proj { kind: "bullet" | "rocket" | "bomb" | "grenade"; from: "player" | "enemy"; dmg: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; a: number; life: number; px: number; py: number; }
export interface Bomb { car: Car | null; ox: number; oy: number; x: number; y: number; z: number; t: number; }
export interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; grow: number; color: string; type: number; drag: number; }
export type PickupType = "cash" | "repair" | "nitro" | "rocket" | "bomb";
export interface Pickup { x: number; y: number; type: PickupType; t: number; value: number; }
interface FloatText { x: number; y: number; h: number; text: string; color: string; life: number; max: number; size: number; }
interface Banner { text: string; sub: string; color: string; life: number; max: number; big: boolean; }
export interface Flash { x: number; y: number; z: number; life: number; max: number; size: number; }

const TAU = Math.PI * 2;
const GRAV = 620;
const AIR_THRUST = 520, AIR_MAX = 900; // nitro thrust in the air, max air speed
const NITRO_DRAIN = 0.22, NITRO_REGEN = 0.03; // tank per second: ~4.5 s of boost, ~33 s to refill
export const wrap = (a: number) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const DIGITS = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8"];
const MAX_PARTICLES = 560;
const PAIR_R = 13; // half width of a car for the side-by-side test
export const MAX_SKIDS = 900;

export class Game {
  overlay: HTMLCanvasElement; ctx: CanvasRenderingContext2D; r3d: Renderer3D; cb: Callbacks; config: GameConfig;
  world = new World(4242);
  places: Place[] = buildPlaces(this.world);
  wanted = new Wanted(MODE_RULES.chase);
  peds = new PedSystem(this.world);
  traffic = new Traffic(this.world);
  missions: Missions = new Missions(this);
  jobs: Jobs = new Jobs(this);
  tips: Tips = new Tips(this);
  police: Police = new Police(this);
  state: GameState = "menu";
  dpr = 1; cw = 0; ch = 0; mobile = false;

  player!: Car;
  ped: Ped = newPed(0, 0);
  onFoot = false;
  cars: Car[] = []; particles: Particle[] = []; pickups: Pickup[] = []; texts: FloatText[] = []; banners: Banner[] = []; flashes: Flash[] = [];
  projs: Proj[] = []; bombs: Bomb[] = [];
  skids = new Float32Array(MAX_SKIDS * 4); skidHead = 0; skidTotal = 0;

  trauma = 0; shakeX = 0; shakeY = 0; shakeR = 0; hitStop = 0; timeScale = 1; t = 0;

  score = 0; mult = 1; comboT = 0; time = 0; takedowns = 0; cash = 0;
  driftPts = 0; driftHold = 0; bestDrift = 0; bust = 0; nitro = 1; nitroWasOn = false; lastHurt = -10;
  inv = new Inventory(); fireCd = 0; fireHeld = false; hint = ""; hintT = 0;
  ending: null | { reason: EndReason; t: number } = null;
  copSpawnT = 0;
  slowT = 0; // slow motion after detonating bombs (game seconds)

  // open world
  outfit = 0;
  garage: OwnedCar[] = [];
  district: DistrictId = "downtown"; districtT = 0; // name is shown big for a moment after entering
  nearPlace: Place | null = null;
  modal: ModalInfo | null = null;
  radio = new Radio();
  private robbedAt = new Map<string, number>();
  private placeLatch = ""; // car places open once per visit
  get weapon(): Weapon { return this.inv.current; }

  keys = new Set<string>();
  touch: TouchInput = { active: false, jx: 0, jy: 0, drift: false, nitro: false, fire: false };
  minimap: HTMLCanvasElement;

  stats: SaveStats = emptyStats();
  progress: Progress = emptyProgress();
  private autosaveT = AUTOSAVE_EVERY;
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
    this.onContact = (pl) => this.missions.talk(pl.id);
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
  get parkedLimit() { return this.config.quality === "low" ? PARKED_LIMIT.low : PARKED_LIMIT.high; }
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
    if (cfg.quality !== prevQ) { this.r3d.setQuality(cfg.quality); this.resize(); this.peds.limit = cfg.quality === "low" ? PED_LIMIT.low : PED_LIMIT.high; }
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
    const b = this.bind;
    if (k === "Tab") e.preventDefault();
    if (this.rebinding) return; // settings screen is waiting for a key
    if (this.state === "modal") {
      // dialogs advance with E / Enter / Space, other overlays close with Esc
      if (this.modal?.kind === "dialog" && (b.is("enter", k) || k === "Enter" || k === "Space")) this.dialogNext();
      else if (k === "Escape" && this.modal?.kind !== "dialog") this.closeModal();
      return;
    }
    if (b.is("pause", k) || k === "Escape") { if (this.state === "playing") this.pause(); else if (this.state === "paused") this.resume(); }
    if (b.is("map", k) && this.state === "playing" && this.rules.city) { this.pause(); this.cb.onMapKey?.(); }
    if (b.is("camera", k) && (this.state === "playing" || this.state === "paused")) this.cycleCamera();
    if (k === "Enter" || k === "KeyR") {
      if (this.state === "paused" && k === "KeyR" && this.rules.respawn) { /* no quick restart in the open world */ }
      else if (this.state === "over" || this.state === "menu" || (this.state === "paused" && k === "KeyR")) { if (this.cb.onStartKey) this.cb.onStartKey(); else this.start(); }
    }
    if (this.state !== "playing" || this.ending || e.repeat) return;
    if (b.is("enter", k)) { if (!this.interact()) this.toggleCar(); }
    if (b.is("nextWeapon", k)) this.cycleWeapon();
    if (b.is("wheel", k)) this.openModal({ kind: "wheel" });
    const n = DIGITS.indexOf(k);
    if (n >= 0 && n < this.inv.owned.length) this.setWeapon(this.inv.owned[n]); // number keys follow the carried weapons
    if (b.is("reload", k)) this.reload();
    if (b.is("radio", k)) this.cycleRadio();
    if (b.is("detonate", k)) this.detonate();
    if (b.is("job", k)) this.toggleJob();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (this.bind.is("wheel", e.code) && this.modal?.kind === "wheel") this.closeModal();
  };
  bind = new Bindings();
  rebinding = false;
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
    this.peds.clear();
    const d = this.carDef;
    const p = new Car("player", d.model, d.color);
    p.hp = p.maxHp = d.hp; p.mass = d.mass;
    const n = this.world.nodePos(5, 5);
    p.x = n.x + 10; p.y = n.y + 34; p.a = 0;
    p.wpI = 6; p.wpJ = 5; p.prevI = 5; p.prevJ = 5;
    this.player = p;
    this.cars.push(p);
    this.onFoot = false;
    this.ped = newPed(p.x, p.y);
    this.modal = null; this.playerCarStored = false;
  }

  setupMenu() {
    this.resetWorld();
    this.player.cruise = 260;
    for (let i = 0; i < 14; i++) this.traffic.spawnCiv(this, true);
    this.ending = null; this.timeScale = 1;
    this.setState("menu");
  }

  // save: continue an open-world game (the caller sets mode and difficulty before)
  start(save?: SaveData) {
    sfx.init();
    this.resetWorld();
    const rules = this.rules;
    this.stats = save ? { ...save.stats } : emptyStats();
    this.progress = emptyProgress();
    this.missions = new Missions(this); this.jobs = new Jobs(this);
    this.police.reset(); this.pendingHeat = 0; this.pendingT = 0; this.waypoint = null; this.routeN = 0; this.nav = null;
    this.objective = ""; this.objTimer = -1;
    this.autosaveT = AUTOSAVE_EVERY;
    this.wanted.reset(rules);
    this.score = 0; this.mult = 1; this.comboT = 0;
    this.time = 0; this.takedowns = 0; this.cash = rules.respawn ? 200 : 0; this.lastHurt = -10;
    this.driftPts = 0; this.driftHold = 0; this.bestDrift = 0;
    this.bust = 0; this.nitro = 1; this.ending = null; this.timeScale = 1; this.slowT = 0; this.trauma = 0;
    this.fireCd = 0; this.hint = ""; this.hintT = 0;
    // open world: fists and a pistol; arcade modes: endless pistol, rockets and sticky bombs
    if (rules.respawn) this.inv.reset(["pistol"], { pistol: 48 });
    else this.inv.reset(["pistol", "rocket", "bomb"], { rocket: 30, bomb: 30 }, ["pistol"], false);
    this.outfit = 0; this.garage = []; this.robbedAt.clear(); this.placeLatch = "";
    this.district = districtAt(this.player.x, this.player.y);
    this.copSpawnT = this.diff.firstCop;
    const p = this.player;
    if (save) this.applySave(save);
    else p.vx = 120;
    if (!save) for (let i = 0; i < 6; i++) this.pickups.push({ x: p.x + 180 + i * 85, y: p.y, type: "cash", t: Math.random() * 6, value: 100 });
    if (!save) this.pickups.push({ x: p.x + 760, y: p.y, type: "nitro", t: 0, value: 0 });
    for (let i = 0; i < 22; i++) this.spawnPickup("cash", true);
    for (let i = 0; i < 5; i++) this.spawnPickup("nitro", true);
    for (let i = 0; i < 5; i++) this.spawnPickup("repair", true);
    for (let i = 0; i < 5; i++) this.spawnPickup("rocket", true);
    for (let i = 0; i < 4; i++) this.spawnPickup("bomb", true);
    for (let i = 0; i < 14; i++) this.traffic.spawnCiv(this, true);
    this.peds.limit = this.config.quality === "low" ? PED_LIMIT.low : PED_LIMIT.high;
    this.traffic.reset();
    if (rules.city) { this.peds.populate(this.fx, this.fy); this.traffic.updateParking(this, 0, this.parkedLimit, true); }
    const m = this.config.mode;
    if (save) this.banner("WILLKOMMEN ZURÜCK", "Spielstand geladen", "#3dff8b", 2.6);
    else this.banner(m === "free" ? "FREIE FAHRT" : m === "open" ? "SOLARA BAY" : "LOS GEHT'S", m === "free" ? "Keine Cops – erkunde Stadt & Berge" : m === "open" ? "Die Stadt gehört dir – benimm dich (oder nicht)" : "Schnapp dir das Cash!", "#ff3cac", 2.6);
    this.setState("playing");
  }

  private applySave(sv: SaveData) {
    const p = this.player;
    this.cash = sv.cash;
    this.inv.load(sv.inventory);
    this.outfit = sv.outfit; this.garage = sv.garage.map((c) => ({ ...c, tune: { ...c.tune } }));
    this.time = sv.stats.playTime;
    const pd = this.ped;
    pd.x = sv.ped.x; pd.y = sv.ped.y; pd.z = terrainH(pd.x, pd.y); pd.a = sv.ped.a; pd.hp = Math.min(pd.maxHp, Math.max(1, sv.ped.hp));
    pd.armor = Math.min(MAX_ARMOR, sv.ped.armor);
    if (sv.car) {
      const c = sv.car;
      p.model = c.model; p.color = c.color; p.maxHp = c.maxHp; p.hp = Math.min(c.maxHp, Math.max(1, c.hp)); p.mass = c.mass;
      p.tune = { ...c.tune };
      p.x = c.x; p.y = c.y; p.a = c.a;
    } else if (sv.garage.length) {
      // the car is in the garage: walk
      this.cars.splice(this.cars.indexOf(p), 1);
      this.playerCarStored = true;
    } else {
      // the car was destroyed: a replacement waits on the nearest street
      const n = this.world.nearestNode(pd.x, pd.y), np = this.world.nodePos(n.i, n.j);
      p.x = np.x + 10; p.y = np.y + 34; p.a = 0;
    }
    p.z = terrainH(p.x, p.y); p.vx = 0; p.vy = 0;
    this.onFoot = sv.onFoot || !sv.car;
    if (this.onFoot) p.handbrake = true;
    else { pd.x = p.x; pd.y = p.y; }
    this.radio.station = sv.radio;
    this.district = districtAt(this.fx, this.fy);
    this.progress = JSON.parse(JSON.stringify(sv.progress)) as Progress;
    this.r3d.resetCamera(this.onFoot ? pd.a : p.a);
  }

  // why saving is not possible right now (null: it is)
  saveBlock(): SaveResult | null {
    if (!this.rules.save) return "mode";
    if (this.ending || (this.state !== "playing" && this.state !== "paused")) return "busy";
    if (this.wanted.stars > 0) return "wanted";
    return null;
  }

  saveGame(): SaveResult {
    const block = this.saveBlock();
    if (block) return block;
    const p = this.player, pd = this.ped;
    this.stats.playTime = this.time;
    this.stats.maxStars = Math.max(this.stats.maxStars, this.wanted.maxStars);
    const d: SaveData = {
      v: 2, savedAt: Date.now(), difficulty: this.config.difficulty,
      onFoot: this.onFoot, ped: { x: pd.x, y: pd.y, a: pd.a, hp: pd.hp, armor: pd.armor },
      car: p.dead || this.playerCarStored ? null : { model: p.model, color: p.color, hp: p.hp, maxHp: p.maxHp, mass: p.mass, x: p.x, y: p.y, a: p.a, tune: { ...p.tune } },
      cash: this.cash, inventory: this.inv.save(), outfit: this.outfit,
      garage: this.garage.map((c) => ({ ...c, tune: { ...c.tune } })), radio: this.radio.station,
      stats: { ...this.stats }, progress: JSON.parse(JSON.stringify(this.progress)) as Progress,
    };
    this.autosaveT = AUTOSAVE_EVERY;
    return writeSave(d);
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
  shake(a: number) { if (currentSettings.shake) this.trauma = Math.min(1, this.trauma + a); }
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
    const knocked = this.peds.blast(x, y, R);
    if (knocked && this.state === "playing" && !this.ending) { this.crime("pedHit", knocked); this.stats.pedsHit += knocked; }
    this.peds.alarm(x, y, 900, "blast");
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
    amt *= this.diff.dmg * tuneDamage(p.tune);
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
    // the vest takes most of the hit
    if (pd.armor > 0) { const a = Math.min(pd.armor, amt * 0.75); pd.armor -= a; amt -= a; }
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

  // a pedestrian was run over (PedSystem callback)
  pedHit(c: Civilian, by: Car, speed: number) {
    this.peds.alarm(c.x, c.y, 350, "blast");
    if (by !== this.player || this.onFoot) return;
    this.crime("pedHit");
    this.stats.pedsHit++;
    sfx.crash(Math.min(0.5, speed / 900));
    this.shake(0.06);
  }

  crime(c: Crime, mul = 1) {
    if (this.state !== "playing" || this.ending) return;
    // arcade modes and an existing wanted level: every crime counts right away
    if (!this.rules.starsDecay || this.wanted.stars > 0) { this.wanted.crime(c, mul); return; }
    this.reportCrime(c, mul);
  }

  // a cop or gang member on foot fires at the player
  enemyShot(x: number, y: number, z: number, a: number, dmg: number) {
    const sp = 1100;
    this.projs.push({ kind: "bullet", from: "enemy", dmg, x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 0, a, life: 0.6, px: x, py: y });
    this.flashes.push({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, z, life: 0.05, max: 0.05, size: 70 });
    if (Math.hypot(x - this.fx, y - this.fy) < 900) sfx.shot();
  }

  // gangs attack when their reputation with you is bad or you recently hurt one of them
  private gangAggro: Record<FactionId, number> = { halcones: 0, kings: 0 };
  gangHostile(f: FactionId) { return this.rules.city && (this.progress.rep[f] <= -30 || this.gangAggro[f] > 0); }

  // a cop with a wanted level sees the player (close, in line of sight, or from the helicopter)
  private copSeesPlayer() { return this.police.copSees(this.fx, this.fy); }
  explodeAt(x: number, y: number, big: number) { this.explode(x, y, big, 2); }

  // crimes in the open world need a witness: police nearby sees it at once, a passer-by calls them (delayed)
  private pendingHeat = 0; private pendingT = 0;
  private reportCrime(c: Crime, mul: number) {
    const loud = c === "shot" || c === "rocket" || c === "explosion";
    if (this.police.copSees(this.fx, this.fy, loud) || this.police.patrolSees(this.fx, this.fy)) { this.wanted.crime(c, mul); return; }
    if (this.peds.witness(this.fx, this.fy, loud ? 500 : 320)) {
      if (this.pendingT <= 0) { this.pendingT = 3.5; this.setHint("📞 Ein Zeuge ruft die Polizei!", 2.2); }
      this.pendingHeat += CRIMES[c] * mul;
    }
  }
  private updatePending(dt: number) {
    if (this.pendingT <= 0) return;
    this.pendingT -= dt;
    if (this.pendingT <= 0 && this.pendingHeat > 0) { this.wanted.heat += this.pendingHeat; this.wanted.lostT = 0; this.police.lastX = this.fx; this.police.lastY = this.fy; this.pendingHeat = 0; }
  }

  // open world: no game over, wake up at the hospital or get released at the police station
  private respawn(reason: EndReason) {
    const rule = RESPAWN_RULES[reason];
    if (reason === "dead") this.stats.deaths++; else this.stats.arrests++;
    this.missions.fail(reason === "dead" ? "Du wurdest erledigt" : "Du wurdest verhaftet");
    this.police.reset(); this.pendingHeat = 0; this.pendingT = 0;
    for (const c of this.peds.list) if (c.active && (c.role === "cop" || c.role === "swat")) c.active = false;
    this.jobs.stop(reason === "dead" ? "Erledigt" : "Verhaftet");
    this.jobs.race = null; this.objective = ""; this.objTimer = -1;
    const place = this.places.find((pl) => pl.kind === rule.place);
    const cost = respawnCost(rule, this.cash);
    this.cash -= cost;
    // dead: explosives are gone; arrested: the police keeps everything except the pistol
    this.inv.drop(reason === "dead" ? ["grenade", "rocket", "bomb"] : WEAPONS.filter((w) => w !== "fist" && w !== "pistol"));
    this.ped.armor = 0;
    this.wanted.clear(); this.bust = 0; this.ending = null; this.timeScale = 1;
    this.cars = this.cars.filter((c) => c.kind !== "cop");
    this.projs.length = 0; this.bombs.length = 0;
    this.copSpawnT = this.diff.firstCop;
    const p = this.player;
    p.throttle = 0; p.steer = 0; p.nitro = false; p.handbrake = true;
    const n = this.world.nodePos(5, 5);
    const x = place ? place.x : n.x, y = place ? place.y : n.y;
    this.ped = newPed(x, y, place ? place.a : 0);
    this.onFoot = true;
    this.r3d.resetCamera(this.ped.a + Math.PI); // camera on the street, looking at the entrance
    this.banners.length = 0;
    this.autosaveT = 1; // save the new state right after waking up
    this.banner(rule.title, `${place ? place.name + " · " : ""}−$${cost.toLocaleString("de-DE")} ${rule.sub}`, place ? place.color : "#ffffff", 3.2);
  }

  // ---------- weapons ----------
  setWeapon(w: Weapon) { if (this.inv.select(w)) sfx.beep(); }
  cycleWeapon(dir = 1) { this.inv.cycle(dir); sfx.beep(); }
  reload() { if (this.inv.startReload()) sfx.reload(); }

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
    const d = this.inv.def, w = d.id;
    if (d.kind === "melee") {
      if (!onFoot) { this.fireCd = 0.5; this.setHint("Nahkampf geht nur zu Fuß – wähl eine Schusswaffe (Q)", 1.4); return; }
      this.melee();
      return;
    }
    if (this.inv.reloadT > 0) return;
    if (d.kind === "sticky" && this.bombs.length >= 30) { this.setHint("Max. 30 Bomben – erst zünden (G)", 1.5); sfx.empty(); this.fireCd = 0.3; return; }
    if (!this.inv.consume()) {
      if (this.inv.reloadT > 0) { sfx.reload(); this.setHint("Nachladen …", 0.8); }
      else { sfx.empty(); this.setHint(this.rules.respawn ? `Keine Munition: ${d.name} – Waffenladen (W)` : `Keine Munition – such die Säulen`, 1.5); }
      this.fireCd = 0.3;
      return;
    }
    const facing = onFoot ? (this.config.camera === "top" ? this.ped.a : this.r3d.camYaw) : p.a;
    const ox = onFoot ? this.ped.x : p.x + Math.cos(p.a) * 10;
    const oy = onFoot ? this.ped.y : p.y + Math.sin(p.a) * 10;
    const oz = onFoot ? this.ped.z + 15 : p.z + 13;
    const bvx = onFoot ? 0 : p.vx, bvy = onFoot ? 0 : p.vy;
    const speed = d.speed;
    const target = this.findTarget(ox, oy, facing, onFoot ? Math.PI : 1.75);
    let a = facing;
    const heli = target ? null : this.police.heliTarget(ox, oy, facing, onFoot ? Math.PI : 1.75);
    if (target) {
      const dist = Math.hypot(target.x - ox, target.y - oy);
      const lead = dist / speed;
      a = Math.atan2(target.y + target.vy * lead - oy, target.x + target.vx * lead - ox);
    } else if (heli) a = Math.atan2(heli.y - oy, heli.x - ox);
    if (onFoot) { this.ped.a = a; this.ped.shootT = 0.4; }
    this.fireCd = d.cd;
    if (d.noise > 0) this.peds.alarm(ox, oy, d.noise, "shot");
    if (d.crime) this.crime(d.crime);
    if (d.kind === "gun") {
      for (let i = 0; i < d.pellets; i++) {
        const aa = a + rnd(-d.spread, d.spread);
        this.projs.push({ kind: "bullet", from: "player", dmg: d.dmg, x: ox, y: oy, z: oz, vx: Math.cos(aa) * speed * rnd(0.92, 1) + bvx * 0.3, vy: Math.sin(aa) * speed * rnd(0.92, 1) + bvy * 0.3, vz: 0, a: aa, life: d.range, px: ox, py: oy });
      }
      if (w === "shotgun") { sfx.shotgun(); this.shake(0.14); } else { sfx.shot(); this.shake(0.05); }
      this.flashes.push({ x: ox + Math.cos(a) * 18, y: oy + Math.sin(a) * 18, z: oz, life: 0.06, max: 0.06, size: w === "shotgun" ? 140 : 90 });
      this.emit(ox + Math.cos(a) * 20, oy + Math.sin(a) * 20, oz, bvx * 0.5, bvy * 0.5, 0, 0.06, 7, 60, "#ffd36b", 2, 1);
    } else if (d.kind === "rocket") {
      this.projs.push({ kind: "rocket", from: "player", dmg: 500, x: ox, y: oy, z: oz, vx: Math.cos(a) * speed + bvx * 0.5, vy: Math.sin(a) * speed + bvy * 0.5, vz: 0, a, life: d.range, px: ox, py: oy });
      sfx.rocket();
      this.shake(0.25);
      this.flashes.push({ x: ox, y: oy, z: oz, life: 0.12, max: 0.12, size: 200 });
    } else if (d.kind === "throw") {
      this.projs.push({ kind: "grenade", from: "player", dmg: 0, x: ox, y: oy, z: oz + 4, vx: Math.cos(a) * speed + bvx * 0.8, vy: Math.sin(a) * speed + bvy * 0.8, vz: 210, a, life: 2.2, px: ox, py: oy });
      sfx.throwIt();
    } else {
      this.projs.push({ kind: "bomb", from: "player", dmg: 0, x: ox, y: oy, z: oz, vx: Math.cos(a) * speed + bvx * 0.9, vy: Math.sin(a) * speed + bvy * 0.9, vz: 170, a, life: d.range, px: ox, py: oy });
      sfx.throwIt();
      this.setHint("G / 💥 zum Zünden", 2);
    }
  }

  // punch / bat: hits the pedestrian in front, a little damage to cars
  private melee() {
    const d = this.inv.def, pd = this.ped;
    pd.shootT = 0.4; this.fireCd = d.cd;
    sfx.swing();
    const c = this.peds.meleeTarget(pd.x, pd.y, pd.a, d.range + 8);
    if (c) {
      pd.a = Math.atan2(c.y - pd.y, c.x - pd.x);
      sfx.punch(); this.shake(0.08);
      if (this.peds.damage(c, d.dmg, pd.x, pd.y, d.id === "bat" ? 220 : 120)) this.onPedDown(c);
      else this.crime("shot");
      return;
    }
    for (const car of this.cars) {
      if (car === this.player || car.dead) continue;
      if (Math.hypot(car.x - (pd.x + Math.cos(pd.a) * 16), car.y - (pd.y + Math.sin(pd.a) * 16)) < 26) {
        sfx.punch(); this.damageCar(car, d.dmg * 0.25); this.sparks(car.x, car.y, car.z + 10, 3, -Math.cos(pd.a), -Math.sin(pd.a), 0.4);
        return;
      }
    }
  }

  // a pedestrian was knocked out by the player (weapon or fists)
  private onPedDown(c: Civilian) {
    this.stats.pedsHit++;
    this.peds.alarm(c.x, c.y, 400, "blast");
    this.crime(c.role === "cop" || c.role === "swat" ? "copTakedown" : "pedShot");
    if (c.faction) {
      // hurting a gang member makes the whole gang angry for a while
      this.progress.rep[c.faction] = Math.max(-100, this.progress.rep[c.faction] - 8);
      this.gangAggro[c.faction] = 60;
    }
    this.onPedKnocked?.(c);
  }
  // hooks for systems that care about knocked-out pedestrians / stolen cars (gangs, missions)
  onPedKnocked: ((c: Civilian) => void) | null = null;
  onCarTaken: ((c: Car) => void) | null = null;

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
    this.slowT = 0.45;
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
      if (q.kind === "bomb" || q.kind === "grenade") { q.vz -= GRAV * dt; q.vx *= Math.exp(-0.5 * dt); q.vy *= Math.exp(-0.5 * dt); }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const gh = terrainH(q.x, q.y);
      if (q.kind === "rocket") {
        q.z = Math.max(q.z, gh + 8);
        this.emit(q.x, q.y, q.z, rnd(-10, 10), rnd(-10, 10), rnd(5, 20), rnd(0.5, 0.9), 5, 26, "#9a93a9", 0, 1);
        this.emit(q.x, q.y, q.z, -q.vx * 0.2, -q.vy * 0.2, 0, 0.12, 6, -10, "#ff9a2a", 2, 1);
      }
      // grenades bounce and explode when the fuse runs out
      if (q.kind === "grenade") {
        const gz = Math.max(gh, this.world.roofAt(q.x, q.y));
        if (q.z < gz + 2) { q.z = gz + 2; if (q.vz < 0) q.vz = -q.vz * 0.35; q.vx *= 0.6; q.vy *= 0.6; }
        if (this.world.isSolid(q.x, q.y, 2) && q.z < this.world.roofAt(q.x, q.y)) { q.x = q.px; q.y = q.py; q.vx *= -0.4; q.vy *= -0.4; }
        if (q.life <= 0) { this.explode(q.x, q.y, 1.15, 3); this.projs.splice(i, 1); }
        continue;
      }
      // enemy bullets only hit the player (on foot or in the car)
      if (q.from === "enemy") {
        let hit = false;
        if (this.onFoot) { const pd = this.ped; if (Math.hypot(q.x - pd.x, q.y - pd.y) < 9 && Math.abs(q.z - pd.z - 12) < 16) { this.damagePed(q.dmg); hit = true; } }
        else { const p = this.player; if (Math.hypot(q.x - p.x, q.y - p.y) < 24 && Math.abs(q.z - p.z) < 30) { this.damagePlayerCar(q.dmg * 0.35); this.sparks(q.x, q.y, q.z, 4, -q.vx, -q.vy, 0.5); hit = true; } }
        if (hit || q.life <= 0 || this.world.isSolid(q.x, q.y, 2) || q.z < gh) this.projs.splice(i, 1);
        continue;
      }
      let remove = false;
      // police helicopter (shots aimed at it count by ground position)
      if ((q.kind === "bullet" || q.kind === "rocket") && this.police.hitHeli(q.x, q.y, q.kind === "rocket" ? 400 : q.dmg)) {
        const h = this.police.heli;
        if (h) this.sparks(h.x, h.y, h.z, 6, -q.vx, -q.vy, 0.6);
        if (q.kind === "rocket" && h) { this.flashes.push({ x: h.x, y: h.y, z: h.z, life: 0.5, max: 0.5, size: 400 }); sfx.explosion(); }
        this.projs.splice(i, 1);
        continue;
      }
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
            this.damageCar(c, q.dmg, true);
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
      // pedestrians (bullets and rockets)
      if (!remove && q.kind !== "bomb") {
        for (let s = 1; s <= steps && !remove; s++) {
          const cv = this.peds.hitTest(q.px + (q.x - q.px) * (s / steps), q.py + (q.y - q.py) * (s / steps), q.z, q.kind === "bullet" ? 7 : 10);
          if (!cv) continue;
          if (q.kind === "bullet") {
            if (this.peds.damage(cv, q.dmg, q.px, q.py, 90)) this.onPedDown(cv);
            else { this.crime("shot"); this.peds.alarm(cv.x, cv.y, 400, "blast"); }
          } else this.explode(cv.x, cv.y, 1.1, 4);
          remove = true;
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

  // ---------- open world: places, shops, garage, radio, overlays ----------
  openModal(m: ModalInfo) {
    if (this.state !== "playing" || this.ending) return;
    this.modal = m; this.keys.clear(); this.fireHeld = false;
    this.setState("modal");
    this.cb.onModal?.(m);
  }
  closeModal() {
    if (this.state !== "modal") return;
    this.modal = null;
    this.r3d.cinematic = null;
    this.setState("playing");
    this.last = performance.now();
    this.cb.onModal?.(null);
    if (this.dialogDone) { const f = this.dialogDone; this.dialogDone = null; f(); }
  }

  // story dialog: lines are shown one by one, the camera looks at (fx, fy)
  private dialogLines: DialogLine[] = []; private dialogI = 0; private dialogDone: (() => void) | null = null;
  // focus.a: direction from the speaker towards the camera (for places: towards the street)
  say(lines: DialogLine[], focus: { x: number; y: number; a?: number } | null, done?: () => void) {
    if (!lines.length) { done?.(); return; }
    this.dialogLines = lines; this.dialogI = 0; this.dialogDone = done ?? null;
    if (focus) this.r3d.cinematic = { x: focus.x, y: focus.y, z: terrainH(focus.x, focus.y), a: focus.a ?? this.r3d.camYaw + Math.PI };
    sfx.phone();
    this.openModal(this.dialogInfo());
  }
  private dialogInfo(): ModalInfo {
    const l = this.dialogLines[this.dialogI];
    return { kind: "dialog", speaker: l.speaker, text: l.text, color: l.color, index: this.dialogI, count: this.dialogLines.length };
  }
  dialogNext() {
    if (this.modal?.kind !== "dialog") return;
    this.dialogI++;
    if (this.dialogI >= this.dialogLines.length) { this.closeModal(); return; }
    this.modal = this.dialogInfo();
    this.cb.onModal?.(this.modal);
  }

  // place you can enter right now; car places (workshop, garage) open by driving in slowly
  private updatePlaces() {
    this.nearPlace = null;
    if (!this.rules.city) return;
    let latch = "";
    for (const pl of this.places) {
      if (pl.access === "none") continue;
      if (this.onFoot && (pl.access === "foot" || pl.access === "both") && Math.hypot(this.ped.x - pl.x, this.ped.y - pl.y) < PLACE_RADIUS.foot) this.nearPlace = pl;
      if (!this.onFoot && (pl.access === "car" || pl.access === "both") && Math.hypot(this.player.x - pl.cx, this.player.y - pl.cy) < PLACE_RADIUS.car) {
        this.nearPlace = pl; latch = pl.id;
        if (this.placeLatch !== pl.id && this.player.speed < 90 && pl.kind !== "contact") { this.placeLatch = pl.id; this.openModal({ kind: "shop", place: pl }); }
      }
    }
    if (!latch) this.placeLatch = "";
  }

  // E on foot: enter the shop / talk to the contact in front of you
  interact(): boolean {
    const pl = this.nearPlace;
    if (!pl || !this.onFoot) return false;
    if (pl.kind === "contact") return this.onContact?.(pl) ?? false;
    this.openModal({ kind: "shop", place: pl });
    return true;
  }
  onContact: ((pl: Place) => boolean) | null = null; // missions decide what a contact says

  // the player's own car was put into the garage (it is not in the car list until you drive another one)
  playerCarStored = false;

  shopView(): ShopView {
    const p = this.player, pd = this.ped;
    const pl = this.modal?.kind === "shop" ? this.modal.place : null;
    const inCar = !this.onFoot && !this.playerCarStored;
    return {
      cash: this.cash, hp: pd.hp, maxHp: pd.maxHp, armor: pd.armor, outfit: this.outfit, stars: this.wanted.stars,
      weapons: GUNS_FOR_SALE.map((w) => ({ w, owned: this.inv.has(w), total: this.inv.total(w), canAmmo: AMMO_FOR_SALE.includes(w) })),
      car: inCar ? { name: MODEL_NAME[p.model], hp: p.hp, maxHp: p.maxHp, color: p.color, tune: { ...p.tune }, repair: Math.ceil(Math.max(0, p.maxHp - p.hp) * REPAIR_PER_HP) } : null,
      garage: this.garage.map((c) => ({ name: MODEL_NAME[c.model], color: c.color, tune: { ...c.tune }, value: Math.round(MODEL_STATS[c.model].price * 0.6) })),
      slots: GARAGE_SLOTS,
      robWait: pl ? Math.max(0, Math.ceil(ROB_COOLDOWN - (this.time - (this.robbedAt.get(pl.id) ?? -1e9)))) : 0,
    };
  }

  private pay(price: number): boolean {
    if (this.cash < price) { sfx.empty(); return false; }
    this.cash -= price; sfx.cashier();
    return true;
  }

  // a shop button was pressed; returns the message to show
  shopAction(a: ShopAction): string {
    const p = this.player, pd = this.ped;
    const pl = this.modal?.kind === "shop" ? this.modal.place : null;
    const broke = "Zu wenig Geld";
    switch (a.t) {
      case "weapon": {
        const d = WEAPON_DEFS[a.w];
        if (this.inv.has(a.w)) return "Hast du schon";
        if (!this.pay(d.price)) return broke;
        this.inv.give(a.w, d.ammoPack); this.inv.select(a.w);
        return `${d.name} gekauft`;
      }
      case "ammo": {
        const d = WEAPON_DEFS[a.w];
        if (!this.inv.has(a.w)) return "Erst die Waffe kaufen";
        if (this.inv.total(a.w) >= d.maxAmmo) return "Munition ist voll";
        if (!this.pay(d.ammoPrice)) return broke;
        this.inv.give(a.w, d.ammoPack);
        return `+${d.ammoPack} Schuss ${d.name}`;
      }
      case "armor": {
        if (pd.armor >= MAX_ARMOR) return "Weste ist schon voll";
        const price = Math.ceil(((MAX_ARMOR - pd.armor) / MAX_ARMOR) * ARMOR_PRICE);
        if (!this.pay(price)) return broke;
        pd.armor = MAX_ARMOR;
        return "Schutzweste angezogen";
      }
      case "food": {
        const f = FOOD[a.i];
        if (!f) return "";
        if (pd.hp >= pd.maxHp) return "Du bist satt";
        if (!this.pay(f.price)) return broke;
        pd.hp = Math.min(pd.maxHp, pd.hp + f.heal);
        return `${f.name} – lecker (+${f.heal})`;
      }
      case "outfit": {
        const o = OUTFITS[a.i];
        if (!o || a.i === this.outfit) return "";
        if (!this.pay(o.price)) return broke;
        this.outfit = a.i;
        // a new look throws off the police (up to 2 stars, if nobody sees you right now)
        if (this.wanted.stars > 0 && this.wanted.stars <= 2 && !this.copSeesPlayer()) { this.wanted.clear(); return `${o.name} – die Cops erkennen dich nicht mehr`; }
        return `${o.name} steht dir`;
      }
      case "repair": {
        if (!pl || this.onFoot) return "";
        const cost = Math.ceil(Math.max(0, p.maxHp - p.hp) * REPAIR_PER_HP);
        if (cost <= 0) return "Der Wagen ist in Ordnung";
        if (!this.pay(cost)) return broke;
        p.hp = p.maxHp;
        return "Repariert";
      }
      case "paint": {
        if (this.onFoot || !PAINTS.includes(a.color) || a.color === p.color) return "";
        if (!this.pay(PAINT_PRICE)) return broke;
        p.color = a.color; p.hp = p.maxHp;
        if (this.wanted.stars > 0 && !this.copSeesPlayer()) { this.wanted.clear(); return "Neue Farbe – die Polizei sucht jetzt ein anderes Auto"; }
        return "Frisch lackiert";
      }
      case "tune": {
        if (this.onFoot) return "";
        const lvl = p.tune[a.part];
        if (lvl >= MAX_TUNE) return "Maximal getunt";
        if (!this.pay(TUNE_DEFS[a.part].prices[lvl])) return broke;
        const next = { ...p.tune, [a.part]: lvl + 1 };
        if (a.part === "armor") { const f = tuneHp(next) / tuneHp(p.tune); p.maxHp *= f; p.hp *= f; }
        p.tune = next;
        return `${TUNE_DEFS[a.part].name} Stufe ${lvl + 1}`;
      }
      case "save": {
        pd.hp = pd.maxHp;
        const r = this.saveGame();
        return r === "saved" ? "Ausgeruht und gespeichert" : r === "memory" ? "Ausgeruht – nur vorübergehend gespeichert" : r === "wanted" ? "Mit Fahndung kannst du nicht speichern" : "Gerade nicht möglich";
      }
      case "store": {
        if (this.onFoot || this.playerCarStored || !pl) return "Fahr mit dem Auto in die Garage";
        if (this.garage.length >= GARAGE_SLOTS) return "Garage ist voll";
        if (p.kind === "player" && (p.model === "police" || p.model === "swat")) return "Polizeiautos nimmt die Garage nicht";
        this.garage.push({ model: p.model, color: p.color, hp: p.hp, maxHp: p.maxHp, mass: p.mass, tune: { ...p.tune } });
        this.cars.splice(this.cars.indexOf(p), 1);
        this.playerCarStored = true;
        this.ped = newPed(pl.x, pl.y, pl.a); this.ped.armor = pd.armor; this.ped.hp = pd.hp;
        this.onFoot = true;
        this.closeModal();
        return "Eingeparkt";
      }
      case "takeCar": {
        const c = this.garage[a.i];
        if (!c || !pl) return "";
        const car = new Car("civ", c.model, c.color);
        car.x = pl.cx; car.y = pl.cy; car.a = -Math.PI / 2; car.z = terrainH(car.x, car.y);
        for (const o of this.cars) if (Math.hypot(o.x - car.x, o.y - car.y) < 45) car.y += 60; // free spot
        car.hp = c.hp; car.maxHp = c.maxHp; car.mass = c.mass; car.tune = { ...c.tune };
        car.parked = true; car.handbrake = true; car.owned = true; car.keep = true;
        this.cars.push(car);
        this.garage.splice(a.i, 1);
        return `${MODEL_NAME[c.model]} steht vor der Tür`;
      }
      case "sellCar": {
        const c = this.garage[a.i];
        if (!c) return "";
        const v = Math.round(MODEL_STATS[c.model].price * 0.6);
        this.garage.splice(a.i, 1); this.cash += v; this.stats.earned += v; sfx.cashier();
        return `Verkauft für $${v.toLocaleString("de-DE")}`;
      }
      case "rob": {
        if (!pl?.robbable) return "";
        const last = this.robbedAt.get(pl.id) ?? -1e9;
        if (this.time - last < ROB_COOLDOWN) return "Die Kasse ist noch leer";
        const v = Math.round(rnd(ROB_REWARD[0], ROB_REWARD[1]));
        this.robbedAt.set(pl.id, this.time);
        this.cash += v; this.stats.earned += v;
        this.wanted.heat = Math.max(this.wanted.heat, ROB_HEAT);
        this.wanted.lostT = 0;
        this.peds.alarm(pl.x, pl.y, 500, "shot");
        sfx.cashier();
        this.closeModal();
        this.banner("ÜBERFALL", `+$${v.toLocaleString("de-DE")} – die Polizei ist alarmiert`, "#ff9f43", 2);
        return "";
      }
    }
  }

  cycleRadio() {
    if (this.onFoot) { this.setHint("Radio gibt's nur im Auto", 1.2); return; }
    const st = this.radio.cycle();
    sfx.beep();
    this.setHint(st ? `📻 ${st.name} · ${st.genre}` : "📻 Radio aus", 2);
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
      if (this.playerCarStored) { this.cars.push(p); this.playerCarStored = false; } // own car is in the garage: nothing to leave behind
      else {
        // leave old car behind as a parked civ car (or wreck)
        const old = new Car("civ", p.model, p.color);
        old.x = p.x; old.y = p.y; old.z = p.z; old.a = p.a; old.vx = p.vx; old.vy = p.vy;
        old.hp = p.hp; old.maxHp = p.maxHp; old.mass = p.mass; old.dead = p.dead; old.wrecked = p.wrecked; old.parked = true; old.owned = true; old.deadT = p.deadT; old.wreckT = p.wreckT; old.tune = p.tune;
        old.keep = p.keep && !p.dead;
        this.cars.push(old);
        for (const b of this.bombs) if (b.car === p) b.car = old;
      }
      p.keep = c.keep;
      // take the new one; whoever sits inside gets pulled out
      const wasCop = c.kind === "cop";
      const jacked = c.kind === "civ" && c.driver && !c.dead;
      if (jacked && this.rules.city) {
        const ca = Math.cos(c.a), sa = Math.sin(c.a);
        let dx = c.x + sa * 26, dy = c.y - ca * 26;
        if (this.world.isSolid(dx, dy, 6)) { dx = c.x - sa * 26; dy = c.y + ca * 26; }
        this.peds.spawnAt(dx, dy, this.ped.x, this.ped.y);
      }
      const parkedTheft = c.kind === "civ" && !c.driver;
      const own = c.owned && this.rules.city; // back into your own car: no crime
      this.traffic.release(c);
      p.x = c.x; p.y = c.y; p.z = c.z; p.a = c.a; p.vx = c.vx; p.vy = c.vy; p.av = 0; p.vz = 0; p.air = false;
      p.model = c.model; p.color = c.color; p.hp = Math.max(c.hp, c.maxHp * 0.6); p.maxHp = c.maxHp; p.mass = Math.max(1, c.mass);
      p.tune = c.tune; p.tag = c.tag; p.faction = null;
      if (c.tag) this.onCarTaken?.(c);
      p.dead = false; p.wrecked = false; p.deadT = 0; p.wreckT = 0; p.parked = false; p.hitFlash = 0;
      p.rlx = NaN;
      for (const b of this.bombs) if (b.car === c) b.car = p;
      this.cars.splice(this.cars.indexOf(c), 1);
      if (!own) this.banner(wasCop ? "STREIFENWAGEN GEKLAUT" : jacked ? "AUTO GEKLAUT" : "AUTO GEKNACKT", wasCop ? "Die mögen das gar nicht" : jacked ? "Der Fahrer ergreift die Flucht" : "+ Fahndung", "#ffd23f", 1.4);
      if (!own) { this.crime(wasCop ? "copCarjack" : parkedTheft ? "parkedTheft" : "carjack"); this.stats.carsStolen++; }
      if (!own) this.addScore(wasCop ? 300 : 100, p.x, p.y, "CARJACK", "#ffd23f", 20);
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
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0 && !this.ending) this.timeScale = 1; }
    if (this.state === "playing" || this.state === "menu") {
      if (this.hitStop > 0) this.hitStop -= dt;
      else {
        const sdt = dt * this.timeScale;
        const steps = sdt > 1 / 70 ? 2 : 1;
        for (let i = 0; i < steps; i++) this.update(sdt / steps);
      }
      this.updateFx(dt);
    } else if (this.state === "over" || this.state === "modal") this.updateFx(dt);
    this.r3d.render(this, dt);
    this.renderOverlay();
    this.radio.update(sfx.ctx, sfx.radioOut, (this.state === "playing" || this.state === "modal") && !this.onFoot && !this.ending);

    this.hudT -= dt;
    if (this.hudT <= 0 && this.state === "playing") {
      this.hudT = 0.066;
      this.cb.onHud(this.hudData());
    }
    const p = this.player;
    const playing = this.state === "playing" && !this.ending;
    let copsNear = 0;
    for (const c of this.cars) if (c.kind === "cop" && !c.dead && !c.calm && Math.hypot(c.x - this.fx, c.y - this.fy) < 900) copsNear++;
    const drive = playing && !this.onFoot;
    sfx.update(clamp(p.speed / 600, 0, 1), drive ? Math.max(0, p.throttle) : 0, drive ? clamp((Math.abs(p.vR) - 110) / 250, 0, 1) : 0, Math.min(1, copsNear / 2), this.t, playing && (drive || copsNear > 0));
  };

  private hudData(): HudData {
    const p = this.player, inv = this.inv, dist = DISTRICTS[this.district];
    const st = this.radio.current;
    return {
      score: Math.floor(this.score), mult: this.mult, combo01: this.comboT / 5, stars: this.wanted.stars, searching: this.wanted.searching, cash: this.cash,
      health01: this.ped.hp / this.ped.maxHp, carHealth01: p.dead ? 0 : p.hp / p.maxHp, nitro01: this.nitro,
      kmh: Math.round(this.fspeed * 0.36), time: this.time, drift: Math.round(this.driftPts), bust01: this.bust, takedowns: this.takedowns,
      weapon: inv.current, ammo: inv.loaded(), reserve: inv.reserve(), reloading: inv.reloadT > 0, owned: inv.owned,
      bombsPlaced: this.bombs.length, onFoot: this.onFoot,
      canEnter: this.onFoot && !!this.nearestEnterable(), hint: this.hintT > 0 ? this.hint : "", air: !this.onFoot && p.air && p.airT > 0.25,
      armor01: this.ped.armor / MAX_ARMOR,
      district: this.rules.city ? dist.name : "", districtColor: this.districtT > 0 ? dist.color : "",
      place: this.nearPlace && this.nearPlace.kind !== "contact" ? this.nearPlace.name : this.nearPlace ? this.contactLabel(this.nearPlace) : "",
      radio: !this.onFoot && st ? st.name : "",
      objective: this.objective, objTimer: this.objTimer,
      job: this.jobs.active ? "beenden" : !this.onFoot && this.rules.city && !this.missions.active && jobFor(p.model) ? "starten" : "",
    };
  }
  // mission system sets these
  objective = ""; objTimer = -1;
  contactLabel(pl: Place) { const m = this.missions.available(pl.id); return m ? `${pl.name}: „${m.title}“` : pl.name; }

  // ---------- navigation: waypoint from the big map, route to the current goal ----------
  waypoint: { x: number; y: number } | null = null;
  route = new Float32Array(MAX_ROUTE * 2); routeN = 0;
  nav: { x: number; y: number; color: string } | null = null;
  private routeT = 0;
  setWaypoint(x: number, y: number) { this.waypoint = { x, y }; this.routeT = 0; sfx.beep(); }
  clearWaypoint() { this.waypoint = null; this.routeT = 0; }
  private updateNav(dt: number) {
    let goal: { x: number; y: number; color: string } | null = null;
    for (const list of [this.missions.markers, this.jobs.markers]) {
      for (const m of list) if (m.kind !== "contact" && !(m.kind === "race" && m.label === "R")) { goal = m; break; }
      if (goal) break;
    }
    if (!goal && this.waypoint) {
      goal = { x: this.waypoint.x, y: this.waypoint.y, color: "#ff3cac" };
      if (Math.hypot(this.waypoint.x - this.fx, this.waypoint.y - this.fy) < 60) { this.waypoint = null; goal = null; this.setHint("Wegpunkt erreicht", 1.2); }
    }
    this.nav = goal;
    this.routeT -= dt;
    if (this.routeT > 0) return;
    this.routeT = 0.4;
    this.routeN = goal ? findRoute(this.fx, this.fy, goal.x, goal.y, this.route) : 0;
  }

  hintMsg(h: string) { this.setHint(h, 2.4); }
  tip(h: string) { this.setHint("💡 " + h, 5); }
  addCash(v: number) { this.cash += v; this.stats.earned += v; }
  saveSoon() { this.autosaveT = Math.min(this.autosaveT, 1); }
  // job key / button
  toggleJob() { if (this.state === "playing" && !this.ending && this.rules.city) this.jobs.toggle(); }

  private readCarInput() {
    const p = this.player, k = this.keys, b = this.bind;
    const up = b.held("up", k), down = b.held("down", k), left = b.held("left", k), right = b.held("right", k);
    const kb = up || down || left || right;
    p.handbrake = b.held("handbrake", k) || this.touch.drift;
    const wantNitro = b.held("nitro", k) || this.touch.nitro;
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
    const pd = this.ped, k = this.keys, b = this.bind;
    const up = b.held("up", k), down = b.held("down", k), left = b.held("left", k), right = b.held("right", k);
    let jx = 0, jy = 0;
    if (up || down || left || right) { jx = (right ? 1 : 0) - (left ? 1 : 0); jy = (down ? 1 : 0) - (up ? 1 : 0); }
    else if (this.touch.active) { jx = this.touch.jx; jy = this.touch.jy; }
    pd.sprint = b.held("nitro", k) || this.touch.nitro;
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
    this.inv.update(dt);

    if (playing && !this.ending) {
      this.time += dt;
      if (this.onFoot) { this.readPedInput(dt); p.throttle = 0; p.steer = 0; p.handbrake = true; p.nitro = false; }
      else this.readCarInput();
      if ((this.fireHeld || this.touch.fire || this.bind.held("fire", this.keys)) && this.fireCd <= 0) this.fire();
    } else if (playing && this.ending) {
      p.throttle = 0; p.steer = 0; p.nitro = false; p.handbrake = this.ending.reason === "arrested" || this.onFoot;
      this.ped.vx *= 0.9; this.ped.vy *= 0.9;
    } else { this.traffic.civAI(this, p, dt); p.nitro = false; }

    // nitro burns while boosting and refills slowly (pickups refill faster)
    if (p.nitro && !this.onFoot) { this.nitro = Math.max(0, this.nitro - dt * NITRO_DRAIN); if (this.nitro <= 0) p.nitro = false; }
    else this.nitro = Math.min(1, this.nitro + dt * NITRO_REGEN);

    for (const c of this.cars) {
      if (c === p) continue;
      if (c.dead || c.parked || (c.kind === "civ" && c.wrecked)) { c.throttle = 0; c.steer = 0; c.handbrake = true; continue; }
      if (c.kind === "cop") {
        c.calm = this.wanted.stars === 0;
        if (c.calm) this.traffic.patrol(this, c, dt); else this.police.copAI(c, dt);
      } else this.traffic.patrol(this, c, dt); // sets up a route first if the car has none
    }

    const def = this.carDef;
    for (const c of this.cars) {
      const grass = this.onGrass(c.x, c.y);
      if (c.kind === "player") {
        if (p.dead) this.wreckPhysics(c, dt);
        else if (playing) {
          const st = p.model === def.model ? def : MODEL_STATS[p.model];
          const t = p.tune, top = st.maxV * tuneSpeed(t), grip = st.grip * tuneGrip(t);
          const maxV = p.nitro ? top + 280 : top;
          const acc = (p.nitro ? st.acc + 500 : st.acc) * tuneAcc(t);
          this.drive(c, dt, acc, grass ? maxV * 0.8 : maxV, grass ? grip * 0.5 : grip, 1.7);
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
    if (playing && this.rules.city) { this.peds.update(dt, this); this.traffic.updateParking(this, dt, this.parkedLimit); }
    if (playing) this.updateProjs(dt);
    if (playing && !this.ending) {
      this.updatePlaces();
      if (this.rules.city) { this.missions.update(dt); this.jobs.update(dt); this.updateNav(dt); this.tips.update(dt); }
      const dId = districtAt(this.fx, this.fy);
      if (dId !== this.district) { this.district = dId; this.districtT = 2.5; }
    }
    this.districtT = Math.max(0, this.districtT - dt);

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
      const remove = c.keep && !c.dead ? false : d > 1900 || (c.wrecked && c.wreckT > 9 && d > 500) || (c.wrecked && c.wreckT > 20 && !c.parked);
      if (remove) { this.cars.splice(i, 1); continue; }
      if (c.kind === "civ" && !c.wrecked && !c.parked) civs++;
      if (c.kind === "cop" && !c.dead) cops++;
    }
    if (civs < civTarget && Math.random() < 0.1 && inCity(this.fx, this.fy)) this.traffic.spawnCiv(this);

    if (!playing) return;

    if (!this.ending) {
      const rules = this.rules;
      if (rules.cops) {
        const w = this.wanted;
        this.police.update(dt);
        this.updatePending(dt);
        const far = Math.hypot(this.fx - this.police.lastX, this.fy - this.police.lastY) > this.police.searchRadius;
        const ev = w.update(dt, D.heat, rules.starsDecay && w.stars > 0 && this.police.seen, far);
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
        if (cops < copTarget && this.copSpawnT <= 0) { this.police.spawnCop(); this.copSpawnT = D.spawnGap; }
        if (rules.timeHeat) this.score += dt * 6 * this.stars;
      }
      if (rules.damage) {
        if (D.regen > 0 && this.time - this.lastHurt > 3) {
          if (!this.onFoot && !p.dead && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + D.regen * dt);
          if (this.ped.hp < this.ped.maxHp) this.ped.hp = Math.min(this.ped.maxHp, this.ped.hp + D.regen * 1.5 * dt);
        }
      }
      if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) { this.mult = 1; this.comboT = 0; } }
      if (rules.save) {
        this.autosaveT -= dt;
        if (this.autosaveT <= 0 && !this.saveBlock()) { if (this.saveGame() === "saved") this.setHint("Automatisch gespeichert", 1.6); }
      }

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

      this.gangAggro.halcones = Math.max(0, this.gangAggro.halcones - dt);
      this.gangAggro.kings = Math.max(0, this.gangAggro.kings - dt);
      if (rules.cops && this.wanted.stars > 0) {
        let close = this.onFoot ? this.peds.copsNear(fx, fy, 30) : 0; // police on foot grabs you
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
      this.inv.give("rocket", 10);
      this.text(pk.x, pk.y - 20, "RAKETEN +10", "#ff9a2a", 26); sfx.powerup(); ring("#ff9a2a"); this.spawnPickup("rocket", true);
    } else {
      this.inv.give("bomb", 10);
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
    if (c.kind === "player" && !this.onFoot && this.rules.city && this.state === "playing") this.jobs.landed(c.airT); // stunt jumps
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
    const bs = this.world.nearbyBuildings(c.x, c.y, this.tmpB); // city buildings and harbour containers
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
        if ((a.parked || b.parked) && !this.closePair(a, b)) continue;
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

  // finer test for cars side by side: two circles per car (front and back half)
  private closePair(a: Car, b: Car) {
    const R = PAIR_R * 2;
    const ax = Math.cos(a.a) * 12, ay = Math.sin(a.a) * 12, bx = Math.cos(b.a) * 12, by = Math.sin(b.a) * 12;
    for (let i = -1; i <= 1; i += 2) for (let j = -1; j <= 1; j += 2) {
      const dx = (b.x + bx * j) - (a.x + ax * i), dy = (b.y + by * j) - (a.y + ay * i);
      if (dx * dx + dy * dy < R * R) return true;
    }
    return false;
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
      // GPS route to the current goal
      if (this.routeN > 1) {
        ctx.strokeStyle = this.nav?.color ?? "#ff3cac"; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.globalAlpha = 0.85;
        ctx.beginPath();
        for (let i = 0; i < this.routeN; i++) {
          const px = cxm + (this.route[i * 2] - fx) * m, py = cym + (this.route[i * 2 + 1] - fy) * m;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 9px Inter, sans-serif";
      // shops and services nearby
      for (const pl of this.places) {
        if (pl.kind === "contact") continue;
        const dx = (pl.x - fx) * m, dy = (pl.y - fy) * m;
        if (Math.hypot(dx, dy) > size / 2 - 7) continue;
        ctx.fillStyle = pl.color; ctx.beginPath(); ctx.arc(cxm + dx, cym + dy, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillText(pl.icon, cxm + dx, cym + dy + 0.5);
      }
      // mission / job markers stay on the edge when far away
      for (const list of [this.missions.markers, this.jobs.markers]) for (const mk of list) {
        let dx = (mk.x - fx) * m, dy = (mk.y - fy) * m;
        const d = Math.hypot(dx, dy);
        if (d > size / 2 - 7) { dx *= (size / 2 - 7) / d; dy *= (size / 2 - 7) / d; }
        ctx.fillStyle = mk.color; ctx.beginPath(); ctx.arc(cxm + dx, cym + dy, mk.kind === "enemy" ? 4 : 6, 0, TAU); ctx.fill();
        if (mk.label) { ctx.fillStyle = "#fff"; ctx.fillText(mk.label, cxm + dx, cym + dy + 0.5); }
      }
      // search area while the police looks for you, helicopter
      if (this.wanted.searching) {
        ctx.strokeStyle = Math.sin(this.t * 8) > 0 ? "rgba(255,40,70,0.75)" : "rgba(60,120,255,0.75)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cxm + (this.police.lastX - fx) * m, cym + (this.police.lastY - fy) * m, this.police.searchRadius * m, 0, TAU); ctx.stroke();
      }
      const h = this.police.heli;
      if (h && !h.dead) {
        let dx = (h.x - fx) * m, dy = (h.y - fy) * m;
        const d = Math.hypot(dx, dy);
        if (d > size / 2 - 6) { dx *= (size / 2 - 6) / d; dy *= (size / 2 - 6) / d; }
        ctx.fillStyle = "#ffffff"; ctx.fillText("✚", cxm + dx, cym + dy);
      }
      if (this.waypoint) {
        let dx = (this.waypoint.x - fx) * m, dy = (this.waypoint.y - fy) * m;
        const d = Math.hypot(dx, dy);
        if (d > size / 2 - 7) { dx *= (size / 2 - 7) / d; dy *= (size / 2 - 7) / d; }
        ctx.strokeStyle = "#ff3cac"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cxm + dx, cym + dy, 5, 0, TAU); ctx.stroke();
      }
    }
    if (this.onFoot && !this.player.dead && !this.playerCarStored) {
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
