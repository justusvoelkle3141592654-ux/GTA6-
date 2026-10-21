import { Car, type CarModel } from "./vehicles";
import { BLOCK, ROAD, GRID, WORLD, HIGHWAYS, mulberry32, terrainH, type World } from "./world";
import type { Game } from "./engine";
import type { Civilian } from "./peds";
import type { Marker } from "./missions";
import { sfx } from "./audio";

// ---------------------------------------------------------------- side jobs (started in the right vehicle)
export type JobKind = "taxi" | "delivery" | "bounty";
export interface JobDef { kind: JobKind; name: string; models: CarModel[]; desc: string; }
export const JOB_DEFS: Record<JobKind, JobDef> = {
  taxi: { kind: "taxi", name: "Taxi", models: ["taxi"], desc: "Fahrgäste einsammeln und pünktlich absetzen" },
  delivery: { kind: "delivery", name: "Lieferung", models: ["van", "truck"], desc: "Ware rechtzeitig zum Laden bringen" },
  bounty: { kind: "bounty", name: "Streife", models: ["police", "swat"], desc: "Flüchtige stoppen und zu Fuß festnehmen" },
};
export const JOB_KINDS: JobKind[] = ["taxi", "delivery", "bounty"];
export const jobFor = (m: CarModel): JobKind | null => JOB_KINDS.find((k) => JOB_DEFS[k].models.includes(m)) ?? null;

// ---------------------------------------------------------------- street races
export interface RaceDef { id: string; name: string; start: [number, number]; points: [number, number][]; par: number; reward: number; }
const node = (i: number, j: number): [number, number] => [i * BLOCK + ROAD / 2, j * BLOCK + ROAD / 2];
const hw = HIGHWAYS[1] * BLOCK + ROAD / 2;
export const RACES: RaceDef[] = [
  { id: "r1", name: "Küstenlauf", start: node(1, 1), points: [node(1, 10), node(4, 10), node(4, 6), node(8, 6), node(8, 1), node(1, 1)], par: 70, reward: 1000 },
  { id: "r2", name: "Bergsprint", start: node(5, 0), points: [[hw, -1400], [hw, -3200], [hw, -1400], node(5, 0)], par: 60, reward: 1500 },
];
export const RACE_RING = 50;

// ---------------------------------------------------------------- stunt jumps and hidden shells (deterministic)
export interface Jump { id: number; x: number; y: number; ramp: number; } // x, y: lower end of the ramp
export interface Shell { id: number; x: number; y: number; z: number; }
export const JUMP_REWARD = 500, SHELL_REWARD = 100, SHELL_BONUS = 5000, JUMP_AIR = 0.9;

export function buildJumps(world: World): Jump[] {
  const out: Jump[] = [];
  world.ramps.forEach((r, i) => {
    if (r.bld || r.h < 62 || out.length >= 10) return;
    const s = world.rampStart(r);
    out.push({ id: out.length, x: s.x, y: s.y, ramp: i });
  });
  return out;
}

export function buildShells(world: World): Shell[] {
  const r = mulberry32(2024);
  const out: Shell[] = [];
  let guard = 0;
  while (out.length < 30 && guard++ < 2000) {
    let x: number, y: number;
    const k = r();
    if (k < 0.45) { // parks and plazas in the city
      const b = world.blocks[Math.floor(r() * world.blocks.length)];
      if (b.kind === "city") continue;
      x = b.bx * BLOCK + ROAD + 40 + r() * (BLOCK - ROAD - 80); y = b.by * BLOCK + ROAD + 40 + r() * (BLOCK - ROAD - 80);
    } else if (k < 0.65) { x = -30 - r() * 170; y = 80 + r() * (WORLD - 160); } // beach
    else { // hills around the city
      const a = r() * Math.PI * 2, d = 900 + r() * 3200;
      x = WORLD / 2 + Math.cos(a) * (WORLD / 2 + d); y = WORLD / 2 + Math.sin(a) * (WORLD / 2 + d);
    }
    if (world.isSolid(x, y, 12)) continue;
    out.push({ id: out.length, x, y, z: terrainH(x, y) });
  }
  return out;
}

// ---------------------------------------------------------------- runner
// patrol (bounty): hunt = stop the getaway car, catch = arrest the suspect on foot, back = return to the patrol car
interface ActiveJob {
  kind: JobKind; stage: "pickup" | "drive" | "hunt" | "catch" | "back";
  timer: number; count: number;
  fare: Civilian | null; dest: { x: number; y: number }; target: Car | null; suspect: Civilian | null;
}
const SUSPECT_LOOK = { shirt: "#f39c12", pants: "#2c3e50" };
const STOP_HP = 0.35;     // the getaway car gives up below this share of its health
const ARREST_DIST = 20;   // on foot this close = handcuffs
interface ActiveRace { def: RaceDef; i: number; t: number; }

export class Jobs {
  active: ActiveJob | null = null;
  race: ActiveRace | null = null;
  markers: Marker[] = [];
  jumps: Jump[]; shells: Shell[];
  private lastRamp = -1; private raceLatch = "";

  constructor(private g: Game) {
    this.jumps = buildJumps(g.world);
    this.shells = buildShells(g.world);
  }

  get busy() { return !!this.active || !!this.race; }

  // job key: start the job of the car you sit in, or stop the running one
  toggle() {
    const g = this.g;
    if (this.active) { this.stop("Job beendet"); return; }
    if (g.onFoot || g.playerCarStored) { g.hintMsg("Jobs startest du im passenden Auto (Taxi, Lieferwagen, Streifenwagen)"); return; }
    if (g.missions.active || this.race) { g.hintMsg("Erst die laufende Mission beenden"); return; }
    const kind = jobFor(g.player.model);
    if (!kind) { g.hintMsg("In diesem Auto gibt's keinen Job – Taxi, Lieferwagen/LKW oder Streifenwagen"); return; }
    if (kind === "bounty" && g.wanted.stars > 0) { g.hintMsg("Mit Fahndung gibt dir die Zentrale keine Einsätze"); return; }
    this.active = { kind, stage: kind === "taxi" ? "pickup" : kind === "bounty" ? "hunt" : "drive", timer: 0, count: 0, fare: null, dest: { x: 0, y: 0 }, target: null, suspect: null };
    g.banner(JOB_DEFS[kind].name.toUpperCase(), JOB_DEFS[kind].desc, "#2bf0ff", 2);
    this.nextTask();
  }

  stop(reason: string) {
    const a = this.active;
    if (!a) return;
    if (a.fare && a.fare.active && a.fare.tag) a.fare.tag = "";
    if (a.target) { a.target.tag = ""; a.target.flee = false; a.target.keep = false; }
    if (a.suspect && a.suspect.active) a.suspect.tag = "";
    this.active = null;
    this.g.objective = ""; this.g.objTimer = -1;
    this.g.banner("JOB ENDE", `${reason} · ${a.count} erledigt`, "#2bf0ff", 2);
  }

  private lvl(k: JobKind) { return this.g.progress.jobs[k] ?? 0; }
  // on patrol: shooting and ramming the suspects is your job, not a crime
  get onDuty() { return this.active?.kind === "bounty"; }

  private spawnSuspect(x: number, y: number) {
    const a = this.active!, g = this.g;
    const s = g.peds.spawnRole("target", x, y);
    if (!s) { this.nextTask(); return; }
    s.tag = "suspect"; s.shirt = SUSPECT_LOOK.shirt; s.pants = SUSPECT_LOOK.pants; s.hp = s.maxHp = 40;
    g.peds.panic(s, g.fx, g.fy, 30);
    a.suspect = s; a.stage = "catch"; a.timer = 50;
  }

  private randomNode(minD: number, maxD: number) {
    const g = this.g;
    for (let t = 0; t < 40; t++) {
      const i = Math.floor(Math.random() * (GRID + 1)), j = Math.floor(Math.random() * (GRID + 1));
      const x = i * BLOCK + ROAD / 2, y = j * BLOCK + ROAD / 2, d = Math.hypot(x - g.fx, y - g.fy);
      if (d > minD && d < maxD) return { x, y };
    }
    return { x: WORLD / 2, y: WORLD / 2 };
  }

  private nextTask() {
    const a = this.active!, g = this.g;
    if (a.kind === "taxi") {
      a.stage = "pickup";
      const p = this.randomNode(250, 650);
      a.fare = g.peds.spawnRole("fare", p.x + 75 + 4, p.y + 75 + 4);
      if (a.fare) a.fare.tag = "fare";
      a.timer = 60;
    } else if (a.kind === "delivery") {
      const shops = g.places.filter((p) => p.kind !== "hospital" && p.kind !== "police" && p.kind !== "contact" && Math.hypot(p.cx - g.fx, p.cy - g.fy) > 700);
      const pl = shops[Math.floor(Math.random() * shops.length)] ?? g.places[0];
      a.dest = { x: pl.cx, y: pl.cy };
      a.timer = Math.hypot(a.dest.x - g.fx, a.dest.y - g.fy) / 7 + 25;
      g.hintMsg(`Lieferung für ${pl.name}`);
    } else if (Math.random() < 0.35) {
      // pickpocket on the run: starts on a sidewalk near a crossing
      const p = this.randomNode(350, 650);
      this.spawnSuspect(p.x + 75 + 12, p.y + 75 + 12);
      g.hintMsg("Zentrale: Taschendieb flüchtet zu Fuß – schnapp ihn dir!");
    } else {
      const p = this.randomNode(450, 800);
      const f = Math.random() < 0.5 ? "halcones" : "kings";
      const c = new Car("civ", Math.random() < 0.5 ? "muscle" : "suv", f === "halcones" ? "#c0392b" : "#7d3c98");
      c.x = p.x + 10; c.y = p.y + 34; c.z = terrainH(c.x, c.y); c.hp = c.maxHp = 140 + this.lvl("bounty") * 15; c.mass = 1.3;
      c.flee = true; c.driver = true; c.cruise = 240 + Math.min(80, this.lvl("bounty") * 8); c.tag = "target"; c.keep = true; c.faction = f;
      g.cars.push(c);
      a.target = c; a.stage = "hunt"; a.timer = 120; a.suspect = null;
      g.hintMsg("Zentrale: Fluchtwagen gesichtet – stoppen!");
    }
  }

  private pay(base: number) {
    const a = this.active!, g = this.g;
    a.count++;
    const k = a.kind;
    g.progress.jobs[k] = this.lvl(k) + 1;
    g.stats.jobsDone++;
    const bonus = Math.round(base * (1 + Math.min(1, this.lvl(k) / 20)));
    g.addCash(bonus);
    sfx.cashier();
    g.banner(`+$${bonus.toLocaleString("de-DE")}`, `${JOB_DEFS[k].name} ${a.count}`, "#3dff8b", 1.4);
    if (a.count % 5 === 0) { g.addCash(500); g.hintMsg("Serienbonus +$500"); }
  }

  update(dt: number) {
    const g = this.g;
    this.markers.length = 0;
    const inCar = !g.onFoot && !g.player.dead && !g.playerCarStored;
    this.updateCollectibles(inCar);
    this.updateRace(dt, inCar);
    const a = this.active;
    if (!a) return;
    const footOk = a.kind === "bounty" && (a.stage === "catch" || a.stage === "back"); // patrol: you chase suspects on foot
    if (!footOk && (!inCar || jobFor(g.player.model) !== a.kind)) { this.stop("Du hast das Fahrzeug verlassen"); return; }
    if (footOk && inCar && jobFor(g.player.model) !== "bounty") { this.stop("Du bist in ein anderes Auto gestiegen"); return; }
    a.timer -= dt;
    g.objTimer = Math.max(0, a.timer);
    if (a.timer <= 0) { this.stop(a.kind === "taxi" && a.stage === "drive" ? "Der Fahrgast ist sauer ausgestiegen" : a.stage === "catch" ? "Der Verdächtige ist entkommen" : "Zu spät"); return; }
    const p = g.player;
    if (a.kind === "taxi") {
      if (a.stage === "pickup") {
        const f = a.fare;
        if (!f || !f.active || f.state === "down") { this.nextTask(); return; }
        g.objective = "Taxi: Hol den Fahrgast ab";
        this.markers.push({ x: f.x, y: f.y, color: "#2bf0ff", kind: "goal", label: "" });
        if (Math.hypot(f.x - p.x, f.y - p.y) < 55 && p.speed < 45) {
          f.active = false; f.tag = "";
          a.dest = this.randomNode(700, 1700);
          a.timer = Math.hypot(a.dest.x - p.x, a.dest.y - p.y) / 7 + 20;
          a.stage = "drive"; sfx.door();
        }
      } else {
        g.objective = "Taxi: Bring den Fahrgast ans Ziel";
        this.markers.push({ x: a.dest.x, y: a.dest.y, color: "#ffd23f", kind: "goal", label: "" });
        if (Math.hypot(a.dest.x - p.x, a.dest.y - p.y) < 60 && p.speed < 70) { this.pay(60 + Math.round(a.timer * 3)); this.nextTask(); }
      }
    } else if (a.kind === "delivery") {
      g.objective = "Lieferung: Bring die Ware zum Laden";
      this.markers.push({ x: a.dest.x, y: a.dest.y, color: "#ffd23f", kind: "goal", label: "" });
      if (Math.hypot(a.dest.x - p.x, a.dest.y - p.y) < 50 && p.speed < 70) { this.pay(140 + Math.round(a.timer * 4)); this.nextTask(); }
    } else if (a.stage === "hunt") {
      const c = a.target;
      if (!c || !g.cars.includes(c)) { this.stop("Das Ziel ist entkommen"); return; }
      g.objective = "Streife: Stopp den Fluchtwagen (rammen oder schießen)";
      this.markers.push({ x: c.x, y: c.y, color: "#ff4d4d", kind: "enemy", label: "" });
      if (c.dead || c.hp < c.maxHp * STOP_HP) {
        // the car gives up: the driver jumps out and runs
        c.flee = false; c.driver = false; c.parked = true; c.handbrake = true; c.tag = ""; c.keep = false; c.faction = null;
        c.vx *= 0.1; c.vy *= 0.1; c.av = 0; // it stops before he gets out
        const ca = Math.cos(c.a), sa = Math.sin(c.a);
        let x = c.x + sa * 28, y = c.y - ca * 28;
        if (g.world.isSolid(x, y, 6)) { x = c.x - sa * 28; y = c.y + ca * 28; }
        a.target = null;
        this.spawnSuspect(x, y);
        g.banner("FAHRER FLÜCHTET", "Raus aus dem Wagen und festnehmen!", "#ffd23f", 1.8);
      } else if (Math.hypot(c.x - p.x, c.y - p.y) > 1700) this.stop("Das Ziel ist entkommen");
    } else if (a.stage === "catch") {
      const s = a.suspect;
      if (!s || !s.active) { this.stop("Der Verdächtige ist entkommen"); return; }
      g.objective = g.onFoot ? "Streife: Fang den Flüchtigen (berühren oder niederschlagen)" : "Streife: Steig aus und fang den Flüchtigen";
      this.markers.push({ x: s.x, y: s.y, color: "#ffd23f", kind: "enemy", label: "" });
      const d = Math.hypot(s.x - g.fx, s.y - g.fy);
      if (s.state !== "down" && s.state !== "flee") g.peds.panic(s, g.fx, g.fy, 30); // keeps running
      if (s.state === "down" || (g.onFoot && d < ARREST_DIST)) {
        s.active = false; s.tag = "";
        sfx.success();
        g.banner("FESTGENOMMEN", "Zurück zum Streifenwagen", "#3d8bff", 1.6);
        this.pay(s.state === "down" ? 250 + this.lvl("bounty") * 30 : 400 + this.lvl("bounty") * 40);
        a.suspect = null; a.stage = "back"; a.timer = 60;
      } else if (d > 1400) this.stop("Der Verdächtige ist entkommen");
    } else {
      g.objective = "Streife: Zurück in den Streifenwagen";
      if (inCar) this.nextTask();
    }
  }

  private updateRace(dt: number, inCar: boolean) {
    const g = this.g, r = this.race;
    if (!r) {
      if (g.missions.active || this.active) return;
      let latch = "";
      for (const def of RACES) {
        const [x, y] = def.start;
        const d = Math.hypot(x - g.fx, y - g.fy);
        if (d < 2500) this.markers.push({ x, y, color: "#9d4dff", kind: "race", label: "R" });
        if (inCar && d < RACE_RING) {
          latch = def.id;
          if (this.raceLatch !== def.id && g.player.speed < 80) {
            this.raceLatch = def.id;
            const rec = g.progress.records[def.id];
            this.race = { def, i: 0, t: 0 };
            g.banner(def.name.toUpperCase(), `Ziel: unter ${def.par} s${rec ? ` · Rekord ${rec.toFixed(1)} s` : ""}`, "#9d4dff", 2.2);
          }
        }
      }
      if (!latch) this.raceLatch = "";
      return;
    }
    if (!inCar) { this.race = null; g.objective = ""; g.objTimer = -1; g.banner("RENNEN ABGEBROCHEN", "Du bist ausgestiegen", "#ff4d4d", 2); return; }
    r.t += dt;
    const [x, y] = r.def.points[r.i];
    this.markers.push({ x, y, color: "#2bf0ff", kind: "race", label: String(r.i + 1) });
    g.objective = `${r.def.name}: Checkpoint ${r.i + 1}/${r.def.points.length}`;
    g.objTimer = Math.max(0, r.def.par - r.t);
    if (Math.hypot(x - g.fx, y - g.fy) < 75) {
      r.i++; sfx.checkpoint();
      if (r.i >= r.def.points.length) {
        const rec = g.progress.records[r.def.id];
        const won = r.t <= r.def.par;
        if (!rec || r.t < rec) g.progress.records[r.def.id] = Math.round(r.t * 10) / 10;
        if (won && !rec) g.addCash(r.def.reward);
        sfx[won ? "success" : "fail"]();
        g.banner(won ? "GEWONNEN" : "ZU LANGSAM", `${r.t.toFixed(1)} s${won && !rec ? ` · +$${r.def.reward}` : ""}${!rec || r.t < rec ? " · neuer Rekord" : ""}`, won ? "#3dff8b" : "#ff9f43", 2.6);
        this.race = null; g.objective = ""; g.objTimer = -1;
        g.saveSoon();
      }
    }
  }

  // shells to pick up; stunt jumps are checked when the player's car lands
  private updateCollectibles(inCar: boolean) {
    const g = this.g, pr = g.progress;
    for (const s of this.shells) {
      if (pr.shells.includes(s.id)) continue;
      if (Math.abs(s.x - g.fx) > 40 || Math.abs(s.y - g.fy) > 40) continue;
      if (Math.hypot(s.x - g.fx, s.y - g.fy) < (inCar ? 34 : 24)) {
        pr.shells.push(s.id);
        g.addCash(SHELL_REWARD); sfx.pickup(3);
        if (pr.shells.length === this.shells.length) { g.addCash(SHELL_BONUS); g.banner("ALLE MUSCHELN", `+$${SHELL_BONUS.toLocaleString("de-DE")}`, "#ffd23f", 3); }
        else g.banner("MUSCHEL", `${pr.shells.length}/${this.shells.length} · +$${SHELL_REWARD}`, "#ffd23f", 1.4);
        g.saveSoon();
      }
    }
    // remember the last ramp the car drove on
    if (inCar) { const i = g.world.rampIndexAt(g.player.x, g.player.y); if (i >= 0) this.lastRamp = i; }
  }

  // called by the game when the player's car lands after airtime
  landed(airT: number) {
    const g = this.g;
    const j = this.jumps.find((x) => x.ramp === this.lastRamp);
    this.lastRamp = -1;
    if (!j || airT < JUMP_AIR || g.progress.jumps.includes(j.id)) return;
    g.progress.jumps.push(j.id);
    g.addCash(JUMP_REWARD);
    sfx.success();
    g.banner("STUNTSPRUNG", `${g.progress.jumps.length}/${this.jumps.length} · +$${JUMP_REWARD}`, "#2bf0ff", 2);
    g.saveSoon();
  }
}
