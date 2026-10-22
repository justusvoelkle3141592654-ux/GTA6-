import { Car, MODEL_NAME, MODEL_STATS, isBoat, isCraft, isHeli, type CarModel } from "../vehicles/vehicles";
import { BLOCK, ROAD, WORLD, HIGHWAYS, STUNT_PARK, mulberry32, terrainH, isWater, inCity, roofOf, type World } from "../world/world";
import type { Game } from "../core/engine";
import type { Civilian } from "../ai/peds";
import type { Marker } from "./missions";
import type { Place } from "../world/places";
import { sfx } from "../audio/audio";
import { oldNode, districtAt, DISTRICTS } from "../world/districts";
import { GARAGE_SLOTS } from "../vehicles/garage";

// ---------------------------------------------------------------- the jobs
export type JobKind = "taxi" | "delivery" | "bounty" | "ambulance" | "fire" | "trash" | "tow" | "bus" | "icecream" | "courier" | "watertaxi" | "heli" | "hunter" | "race" | "stunt";
export type JobIcon = JobKind;
export interface JobDef {
  kind: JobKind; name: string; desc: string; extra: string;
  models: CarModel[];          // vehicles that count for this job (empty: any land vehicle)
  foot: boolean;               // can also be done on foot
  vehicle: { model: CarModel; color: string } | null; // what is delivered / waits at the start point
  pay: [number, number];       // typical pay per task (level 1 .. level 10)
  when: "any" | "day" | "night";
  wantedBlock: boolean;        // not with a wanted level
}
export const JOB_DEFS: Record<JobKind, JobDef> = {
  taxi: { kind: "taxi", name: "Taxi", desc: "Fahrgast abholen und ans Ziel bringen", extra: "Manche wollen es schnell, manche vorsichtig – Crashs kosten Trinkgeld", models: ["taxi"], foot: false, vehicle: { model: "taxi", color: "#ffc21a" }, pay: [80, 400], when: "any", wantedBlock: false },
  delivery: { kind: "delivery", name: "Lieferung", desc: "Ware zum Laden bringen", extra: "Zerbrechlich: Schaden am Wagen senkt die Bezahlung", models: ["van", "truck"], foot: false, vehicle: { model: "van", color: "#e4e2dc" }, pay: [150, 600], when: "any", wantedBlock: false },
  bounty: { kind: "bounty", name: "Streife", desc: "Fluchtwagen stoppen, Flüchtige zu Fuß festnehmen", extra: "Festnahme ohne einen Schuss gibt Bonus", models: ["police", "interceptor", "polsuv", "swat", "policebike", "unmarked"], foot: false, vehicle: { model: "police", color: "#f4f6fa" }, pay: [250, 900], when: "any", wantedBlock: true },
  ambulance: { kind: "ambulance", name: "Krankenwagen", desc: "Verletzte einsammeln und ins Krankenhaus bringen", extra: "Zeitdruck – und Patienten nicht durchschütteln", models: ["ambulance"], foot: false, vehicle: { model: "ambulance", color: "#f4f4f6" }, pay: [200, 700], when: "any", wantedBlock: true },
  fire: { kind: "fire", name: "Feuerwehr", desc: "Auto- und Mülltonnenbrände löschen (Feuer = Wasserwerfer)", extra: "Brände breiten sich langsam aus", models: ["fire"], foot: false, vehicle: { model: "fire", color: "#c0392b" }, pay: [250, 800], when: "any", wantedBlock: true },
  trash: { kind: "trash", name: "Müllabfuhr", desc: "Tonnen abholen: aussteigen, Tonne zum Wagen tragen", extra: "Ruhiger Job ohne Zeitdruck – gut für Anfänger", models: ["garbage"], foot: false, vehicle: { model: "garbage", color: "#3c6e47" }, pay: [200, 500], when: "any", wantedBlock: false },
  tow: { kind: "tow", name: "Abschleppdienst", desc: "Falschparker und Wracks ankoppeln und zum Hof bringen", extra: "Langsam rückwärts ran, dann hängt der Wagen dran", models: ["tow"], foot: false, vehicle: { model: "tow", color: "#e1b12c" }, pay: [180, 600], when: "any", wantedBlock: false },
  bus: { kind: "bus", name: "Busfahrer", desc: "Haltestellen der Reihe nach anfahren und halten", extra: "Pünktlichkeit zählt", models: ["bus"], foot: false, vehicle: { model: "bus", color: "#2bb3ff" }, pay: [200, 600], when: "any", wantedBlock: false },
  icecream: { kind: "icecream", name: "Eiswagen", desc: "Im Wohnviertel langsam fahren und bei Kindern halten", extra: "Nur tagsüber", models: ["icecream"], foot: false, vehicle: { model: "icecream", color: "#f2c7d8" }, pay: [120, 450], when: "day", wantedBlock: false },
  courier: { kind: "courier", name: "Kurier", desc: "Pakete unter Zeitdruck zustellen – auch auf Dächer und in Gassen", extra: "Roller, Fahrrad oder zu Fuß; Abkürzungen durch Parks erlaubt", models: ["scooter", "bicycle"], foot: true, vehicle: { model: "scooter", color: "#ff8a1f" }, pay: [100, 450], when: "any", wantedBlock: false },
  watertaxi: { kind: "watertaxi", name: "Wassertaxi", desc: "Fahrgäste zwischen Stegen, Insel und Hafen fahren", extra: "Das ganze Meer gehört dir", models: ["boat"], foot: false, vehicle: { model: "boat", color: "#f4f6fa" }, pay: [200, 650], when: "any", wantedBlock: false },
  heli: { kind: "heli", name: "Rundflug", desc: "Touristen über die Wahrzeichen fliegen, dort kurz schweben", extra: "Ruhiger Flugstil wird belohnt", models: ["heli", "policeheli"], foot: false, vehicle: { model: "heli", color: "#ff3cac" }, pay: [400, 1200], when: "any", wantedBlock: false },
  hunter: { kind: "hunter", name: "Kopfgeldjäger", desc: "Gesuchte finden (Hinweise im Handy) und festnehmen", extra: "Ab Stufe 3 sind die Ziele bewaffnet", models: [], foot: true, vehicle: null, pay: [400, 1500], when: "any", wantedBlock: false },
  race: { kind: "race", name: "Straßenrennen", desc: "Rennen gegen drei Fahrer – Startgeld rein, Siegprämie raus", extra: "Mehrere Strecken, schnelles Auto empfohlen", models: [], foot: false, vehicle: { model: "sport", color: "#ff2d95" }, pay: [600, 2500], when: "any", wantedBlock: true },
  stunt: { kind: "stunt", name: "Stunt-Fahrer", desc: "Aufgaben im Stunt-Park: Sprungweite, Drift, Zeitfahrt", extra: "Nutzt die neuen Rampen", models: [], foot: false, vehicle: { model: "muscle", color: "#ff8a1f" }, pay: [300, 1000], when: "any", wantedBlock: false },
};
export const JOB_KINDS: JobKind[] = ["taxi", "delivery", "bounty", "ambulance", "fire", "trash", "tow", "bus", "icecream", "courier", "watertaxi", "heli", "hunter", "race", "stunt"];
// a level every 3 finished tasks, 1..10
export const jobLevel = (done: number) => Math.min(10, 1 + Math.floor(done / 3));
export const jobLevelProgress = (done: number) => (jobLevel(done) >= 10 ? 1 : (done % 3) / 3);
// what each level gives you (every level also pays a cash bonus)
export const LEVEL_REWARD: Record<number, string> = { 4: "Neue Lackfarbe in der Werkstatt", 7: "Neues Outfit in der Boutique", 10: "Ein zusätzlicher Garagenplatz" };
export const levelCash = (lvl: number) => lvl * 250;
const JOB_PAINT: Partial<Record<JobKind, string>> = {};
export const jobPaint = (k: JobKind) => JOB_PAINT[k] ?? ["#c9a227", "#5ad1c4", "#d95a8a", "#6a7dff", "#e0703a"][JOB_KINDS.indexOf(k) % 5];

// does the vehicle the player sits in count for this job
export function jobVehicleOk(k: JobKind, model: CarModel | null): boolean {
  const d = JOB_DEFS[k];
  if (model === null) return d.foot;
  if (d.models.length) return d.models.includes(model);
  if (k === "hunter") return true;
  return !isCraft(model) && model !== "bus" && model !== "truck" && model !== "garbage" && model !== "fire" && model !== "bicycle";
}
export const jobFor = (m: CarModel): JobKind | null => JOB_KINDS.find((k) => JOB_DEFS[k].models.includes(m)) ?? null;

// ---------------------------------------------------------------- street races
export interface RaceDef { id: string; name: string; start: [number, number]; points: [number, number][]; par: number; reward: number; }
const node = (i: number, j: number): [number, number] => [oldNode(i) * BLOCK + ROAD / 2, oldNode(j) * BLOCK + ROAD / 2];
const nn = (i: number, j: number): [number, number] => [i * BLOCK + ROAD / 2, j * BLOCK + ROAD / 2];
const hw = HIGHWAYS[1] * BLOCK + ROAD / 2;
export const RACES: RaceDef[] = [
  { id: "r1", name: "Küstenlauf", start: node(1, 1), points: [node(1, 10), node(4, 10), node(4, 6), node(8, 6), node(8, 1), node(1, 1)], par: 95, reward: 1000 },
  { id: "r2", name: "Bergsprint", start: node(5, 0), points: [[hw, -1400], [hw, -3200], [hw, -1400], node(5, 0)], par: 60, reward: 1500 },
  { id: "r3", name: "Hafenrunde", start: nn(12, 8), points: [nn(16, 8), nn(16, 15), nn(12, 15), nn(12, 11), nn(9, 11), nn(9, 8), nn(12, 8)], par: 70, reward: 1200 },
  { id: "r4", name: "Altstadt-Slalom", start: nn(2, 3), points: [nn(5, 3), nn(5, 5), nn(2, 5), nn(2, 7), nn(5, 7), nn(5, 10), nn(2, 10)], par: 65, reward: 1100 },
];
export const RACE_RING = 50;

// ---------------------------------------------------------------- stunt jumps and hidden shells (deterministic)
export interface Jump { id: number; x: number; y: number; ramp: number; } // x, y: lower end of the ramp
export interface Shell { id: number; x: number; y: number; z: number; }
export const JUMP_REWARD = 500, SHELL_REWARD = 100, SHELL_BONUS = 5000, JUMP_AIR = 0.9;

// every fourth launch ramp is a stunt jump (blue sign; land after enough air time)
export function buildJumps(world: World): Jump[] {
  const out: Jump[] = [];
  let k = 0;
  world.ramps.forEach((r, i) => {
    if (!r.jump || out.length >= 10 || k++ % 4) return;
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
    else { // hills north of the city
      x = -2000 + r() * (WORLD + 4000); y = -600 - r() * 4500;
    }
    let tries = 0;
    while (isWater(x, y) && tries++ < 80) x += 60; // the bay: move it to the shore
    if (isWater(x, y) || world.isSolid(x, y, 12) || world.nearRamp(x, y, 30)) continue;
    out.push({ id: out.length, x, y, z: terrainH(x, y) });
  }
  return out;
}

// ---------------------------------------------------------------- runner
export interface JobFire { x: number; y: number; size: number; car: Car | null; } // size 0 = out
export interface JobProp { x: number; y: number; kind: "bin" | "cone"; }
interface Opp { car: Car; i: number; done: boolean; }
interface ActiveJob {
  kind: JobKind; stage: string; timer: number; count: number;
  fare: Civilian | null; dest: { x: number; y: number }; target: Car | null; suspect: Civilian | null;
  pref: "fast" | "careful"; crashes: number; hp0: number; shots: number;
  fires: JobFire[]; bins: { x: number; y: number; done: boolean }[]; carrying: boolean;
  stops: { x: number; y: number; nx: number; ny: number }[]; stopI: number; holdT: number; late: boolean;
  kids: Civilian[][]; serveT: number; rough: number;
  dockFrom: number; spots: { x: number; y: number; h: number; name: string }[]; hint: { x: number; y: number; r: number }; hintT: number;
  race: RaceDef | null; raceI: number; raceT: number; opps: Opp[]; fee: number;
  task: "jump" | "drift" | "time"; goal: number; best: number; checks: [number, number][];
}
const SUSPECT_LOOK = { shirt: "#f39c12", pants: "#2c3e50" };
const STOP_HP = 0.35;     // the getaway car gives up below this share of its health
const ARREST_DIST = 20;   // on foot this close = handcuffs
const DELIVER_TIME: [number, number] = [10, 18]; // seconds until a job vehicle is delivered
interface ActiveRace { def: RaceDef; i: number; t: number; }
// a vehicle on its way to you (job vehicle or a car out of the garage)
export interface Delivery { kind: JobKind | null; model: CarModel; color: string; t: number; x: number; y: number; a: number; car: Car | null; garageI: number; }

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const fmt = (v: number) => v.toLocaleString("de-DE");

export class Jobs {
  active: ActiveJob | null = null;
  race: ActiveRace | null = null;
  delivery: Delivery | null = null;
  bonus = 1; // a phone offer pays more for the next task
  props: JobProp[] = [];
  markers: Marker[] = [];
  jumps: Jump[]; shells: Shell[];
  private raceLatch = "";

  constructor(private g: Game) {
    this.jumps = buildJumps(g.world);
    this.shells = buildShells(g.world);
  }

  get busy() { return !!this.active || !!this.race; }
  done(k: JobKind) { return this.g.progress.jobs[k] ?? 0; }
  level(k: JobKind) { return jobLevel(this.done(k)); }
  best(k: JobKind) { return this.g.progress.records["job_" + k] ?? 0; }
  // can this job be taken right now? null: yes, otherwise the reason
  blocked(k: JobKind): string | null {
    const g = this.g, d = JOB_DEFS[k];
    if (!g.rules.city) return "Nur in der Open World";
    if (g.missions.active) return "Während einer Story-Mission gibt es keine Jobs";
    if (g.hide.active) return "Erst das Versteckspiel beenden";
    if (this.race) return "Erst das Rennen beenden";
    if (d.wantedBlock && g.wanted.stars > 0) return "Mit Fahndung gibt es diesen Job nicht – häng die Polizei erst ab";
    if (d.when === "day" && g.isNight) return "Nur tagsüber (6 bis 20 Uhr)";
    if (d.when === "night" && !g.isNight) return "Nur nachts";
    return null;
  }

  // job key / HUD button: stop the running job, otherwise the job menu opens (UI)
  toggle() {
    if (this.active) { this.stop("Job beendet"); return; }
    this.g.openJobs?.();
  }

  // accept a job (menu, phone or a start point on the map): start now or have the vehicle delivered
  accept(k: JobKind): string {
    const g = this.g, d = JOB_DEFS[k];
    const why = this.blocked(k);
    if (why) { g.hintMsg(why); return why; }
    if (this.active) this.stop("Neuer Job");
    const model = g.onFoot || g.playerCarStored ? null : g.player.model;
    if (jobVehicleOk(k, model) && !(model === null && d.vehicle && !d.foot)) { this.begin(k); return `${d.name}: los geht's`; }
    if (!d.vehicle) { this.begin(k); return `${d.name}: los geht's`; }
    return this.order(d.vehicle.model, d.vehicle.color, k, -1);
  }

  // a vehicle comes to you: the nearest free street spot around the corner (not right in front of you)
  order(model: CarModel, color: string, kind: JobKind | null, garageI: number): string {
    const g = this.g;
    const spot = this.deliverySpot(model);
    if (!spot) { const m = isBoat(model) ? "Kein Wasser in der Nähe – geh zum Ufer" : "Hier kann nichts geliefert werden – geh auf eine Straße"; g.hintMsg(m); return m; }
    const t = Math.round(rnd(DELIVER_TIME[0], DELIVER_TIME[1]));
    this.delivery = { kind, model, color, t, x: spot.x, y: spot.y, a: spot.a, car: null, garageI };
    if (kind) g.banner(JOB_DEFS[kind].name.toUpperCase(), `${MODEL_NAME[model]} kommt in ${t} s – Markierung auf der Karte`, "#2bf0ff", 2.4);
    sfx.phone();
    return `${MODEL_NAME[model]} kommt in ${t} s`;
  }

  private deliverySpot(model: CarModel): { x: number; y: number; a: number } | null {
    const g = this.g, w = g.world, fx = g.fx, fy = g.fy;
    const camA = g.r3d.camYaw;
    const hidden = (x: number, y: number) => Math.cos(Math.atan2(y - fy, x - fx) - camA) < 0.3 || !w.lineClear(fx, fy, x, y, 40);
    if (isBoat(model)) {
      for (let r = 150; r <= 900; r += 50) for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, x = fx + Math.cos(a) * r, y = fy + Math.sin(a) * r;
        if (isWater(x, y) && isWater(x + 40, y) && isWater(x - 40, y) && isWater(x, y + 40) && isWater(x, y - 40) && !w.roads.bridgeAt(x, y, 30)) return { x, y, a: a + Math.PI };
      }
      return null;
    }
    let best: { x: number; y: number; a: number } | null = null, bd = Infinity;
    const consider = (x: number, y: number, a: number) => {
      const d = Math.hypot(x - fx, y - fy);
      if (d < 180 || d > 700 || isWater(x, y) || w.isSolid(x, y, 26) || w.nearRamp(x, y, 40) || w.roads.bridgeAt(x, y, 30)) return;
      for (const c of g.cars) if (Math.abs(c.x - x) < 50 && Math.abs(c.y - y) < 50) return;
      const score = d + (hidden(x, y) ? 0 : 600);
      if (score < bd) { bd = score; best = { x, y, a }; }
    };
    if (inCity(fx, fy)) {
      const n = w.nearestNode(fx, fy);
      for (let j = n.j - 2; j <= n.j + 2; j++) for (let i = n.i - 2; i <= n.i + 2; i++) {
        if (i < 0 || j < 0 || i > 16 || j > 16) continue;
        const p = w.nodePos(i, j);
        for (const t of [0.35, 0.65]) { if (i < 16) consider(p.x + BLOCK * t, p.y + 34, 0); if (j < 16) consider(p.x - 34, p.y + BLOCK * t, Math.PI / 2); }
      }
    } else for (const rd of w.roads.roads) for (let p = 0; p < rd.n; p += 4) { const q = w.roads.point(rd, p, 34); consider(q.x, q.y, q.a); }
    // far from the streets (helipad, fields): any flat free spot nearby
    if (!best) for (let r = 160; r <= 600 && !best; r += 40) for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2, x = fx + Math.cos(ang) * r, y = fy + Math.sin(ang) * r, gr = terrainH(x + 20, y) - terrainH(x - 20, y);
      if (Math.abs(gr) < 8 && Math.abs(terrainH(x, y + 20) - terrainH(x, y - 20)) < 8) consider(x, y, ang + Math.PI);
    }
    return best;
  }

  private updateDelivery(dt: number) {
    const g = this.g, d = this.delivery;
    if (!d) return;
    if (!d.car) {
      d.t -= dt;
      this.markers.push({ x: d.x, y: d.y, color: "#2bf0ff", kind: "goal", label: "" });
      g.objective = `${MODEL_NAME[d.model]} kommt in ${Math.max(1, Math.ceil(d.t))} s`; g.objTimer = -1;
      if (d.t > 0) return;
      const c = new Car("civ", d.model, d.color);
      const st = MODEL_STATS[d.model];
      c.x = d.x; c.y = d.y; c.a = d.a; c.z = isBoat(d.model) ? -5 : g.groundAt(d.x, d.y);
      c.hp = c.maxHp = st.hp; c.mass = st.mass; c.parked = true; c.handbrake = true; c.owned = true; c.keep = true;
      if (d.garageI >= 0) { const o = g.garage[d.garageI]; if (o) { c.hp = o.hp; c.maxHp = o.maxHp; c.tune = { ...o.tune }; c.mass = o.mass; g.garage.splice(d.garageI, 1); } }
      g.cars.push(c);
      d.car = c;
      g.hintMsg(`${MODEL_NAME[d.model]} ist da – steig ein`);
      sfx.beep();
    }
    const c = d.car;
    if (!c) return;
    this.markers.push({ x: c.x, y: c.y, color: "#2bf0ff", kind: "goal", label: "" });
    g.objective = d.kind ? `${JOB_DEFS[d.kind].name}: Steig in den ${MODEL_NAME[d.model]}` : `Steig in deinen ${MODEL_NAME[d.model]}`;
    // you got in (the car object was taken over by the player car)
    if (!g.cars.includes(c)) {
      this.delivery = null; g.objective = "";
      if (d.kind && !g.onFoot && jobVehicleOk(d.kind, g.player.model)) this.begin(d.kind);
    } else if (Math.hypot(c.x - g.fx, c.y - g.fy) > 2500) { this.delivery = null; g.objective = ""; c.keep = false; }
  }
  cancelDelivery() { const d = this.delivery; if (d?.car) d.car.keep = false; this.delivery = null; this.g.objective = ""; }

  // drove into the ring of a job start point (or pressed E there on foot)
  startAt(pl: Place) {
    const g = this.g, kind = pl.job;
    if (!kind || this.active) return;
    const def = JOB_DEFS[kind];
    const model = g.onFoot || g.playerCarStored ? null : g.player.model;
    // without the right vehicle the job vehicle is brought to you (on foot at the jetty or the helipad it waits there anyway)
    if (!jobVehicleOk(kind, model) && def.vehicle && !def.foot) { this.accept(kind); return; }
    const why = this.blocked(kind);
    if (why) { g.hintMsg(why); return; }
    this.begin(kind);
  }

  private newJob(kind: JobKind): ActiveJob {
    return {
      kind, stage: "", timer: 0, count: 0, fare: null, dest: { x: 0, y: 0 }, target: null, suspect: null,
      pref: "careful", crashes: 0, hp0: 0, shots: 0, fires: [], bins: [], carrying: false, stops: [], stopI: 0, holdT: 0, late: false,
      kids: [], serveT: 0, rough: 0, dockFrom: 0, spots: [], hint: { x: 0, y: 0, r: 0 }, hintT: 0,
      race: null, raceI: 0, raceT: 0, opps: [], fee: 0, task: "jump", goal: 0, best: 0, checks: [],
    };
  }

  private begin(kind: JobKind) {
    const g = this.g;
    this.cancelDelivery();
    this.active = this.newJob(kind);
    const d = JOB_DEFS[kind];
    g.banner(d.name.toUpperCase(), `Stufe ${this.level(kind)} · ${d.desc}`, "#2bf0ff", 2.2);
    this.nextTask();
  }

  stop(reason: string) {
    const a = this.active;
    if (!a) return;
    const g = this.g;
    if (a.fare && a.fare.active && a.fare.tag) { a.fare.tag = ""; a.fare.active = false; }
    if (a.target) { a.target.tag = ""; a.target.flee = false; a.target.keep = false; }
    if (a.suspect && a.suspect.active) a.suspect.tag = "";
    for (const f of a.fires) if (f.car) f.car.keep = false;
    for (const grp of a.kids) for (const k of grp) k.active = false;
    for (const o of a.opps) { o.car.keep = false; o.car.tag = ""; }
    this.props.length = 0;
    this.active = null;
    g.objective = ""; g.objTimer = -1;
    g.banner("JOB ENDE", `${reason} · ${a.count} erledigt`, "#2bf0ff", 2);
  }

  // on patrol: shooting and ramming the suspects is your job, not a crime
  get onDuty() { const k = this.active?.kind; return k === "bounty" || k === "hunter"; }
  // the fire truck's water cannon replaces the weapon
  get waterCannon() { return this.active?.kind === "fire" && !this.g.onFoot && this.g.player.model === "fire"; }
  // the trash bin you carry (drawn in the hands)
  get carrying() { return !!this.active?.carrying; }

  // ---------------- events from the game
  onCrash(impact: number) {
    const a = this.active;
    if (!a || impact < 110) return;
    a.crashes++;
    if (a.kind === "ambulance" && a.stage === "drive") { a.rough++; this.g.hintMsg("Vorsicht – der Patient wird durchgeschüttelt!"); }
    if (a.kind === "taxi" && a.stage === "drive" && a.pref === "careful") this.g.hintMsg("Fahrgast: „Geht's noch?!“");
    if (a.kind === "heli") a.rough++;
  }
  onShot() { if (this.active) this.active.shots++; }
  onJump(m: number) {
    const a = this.active;
    if (!a || a.kind !== "stunt" || a.task !== "jump" || !this.inPark()) return;
    a.best = Math.max(a.best, m);
    if (m >= a.goal) this.payStunt(`Sprung ${m.toFixed(1).replace(".", ",")} m`);
  }
  onDrift(pts: number) {
    const a = this.active;
    if (!a || a.kind !== "stunt" || a.task !== "drift" || !this.inPark()) return;
    a.best += pts;
  }
  // E on foot near something of the job (trash bins)
  interact(): boolean {
    const a = this.active, g = this.g;
    if (!a || a.kind !== "trash" || !g.onFoot) return false;
    if (!a.carrying) {
      const b = a.bins.find((q) => !q.done && Math.hypot(q.x - g.fx, q.y - g.fy) < 26);
      if (!b) return false;
      b.done = true; a.carrying = true;
      this.props = this.props.filter((p) => Math.hypot(p.x - b.x, p.y - b.y) > 1);
      sfx.door(); g.hintMsg("Tonne geschnappt – bring sie zum Müllwagen");
      return true;
    }
    return false;
  }
  private inPark() { const g = this.g, s = STUNT_PARK; return g.fx > s.x0 && g.fx < s.x1 && g.fy > s.y0 && g.fy < s.y1; }

  // water cannon: called while the fire button is held in the fire truck
  spray(dt: number) {
    const a = this.active, g = this.g, p = g.player;
    if (!a || a.kind !== "fire") return;
    const ca = Math.cos(p.a), sa = Math.sin(p.a);
    for (let i = 0; i < 2; i++) { const s = rnd(380, 520), d = rnd(-0.12, 0.12); g.water(p.x + ca * 30, p.y + sa * 30, p.z + 26, Math.cos(p.a + d) * s + p.vx, Math.sin(p.a + d) * s + p.vy); }
    for (const f of a.fires) {
      if (f.size <= 0) continue;
      const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy);
      if (d > 260 || d < 10) continue;
      if (Math.abs(Math.atan2(dy, dx) - p.a) % (Math.PI * 2) > 0.35 && Math.abs(Math.atan2(dy, dx) - p.a) % (Math.PI * 2) < Math.PI * 2 - 0.35) continue;
      f.size = Math.max(0, f.size - dt * 0.55);
      if (f.size <= 0) { g.hintMsg("Feuer gelöscht"); sfx.checkpoint(); if (f.car) f.car.keep = false; }
    }
  }

  // tow truck: the hooked car follows behind (after the physics step)
  afterPhysics() {
    const a = this.active, g = this.g;
    if (!a || a.kind !== "tow" || a.stage !== "haul" || !a.target || g.onFoot) return;
    const p = g.player, c = a.target, ca = Math.cos(p.a), sa = Math.sin(p.a), back = p.hl + c.hl + 4;
    c.x = p.x - ca * back; c.y = p.y - sa * back; c.a = p.a; c.vx = p.vx; c.vy = p.vy; c.z = g.groundAt(c.x, c.y) + 3; c.parked = false; c.handbrake = false;
  }

  // ---------------- payment, levels, series
  private pay(base: number, label = "") {
    const a = this.active!, g = this.g, k = a.kind;
    a.count++;
    const before = this.level(k);
    g.progress.jobs[k] = this.done(k) + 1;
    g.stats.jobsDone++;
    const lvl = this.level(k);
    const money = Math.max(10, Math.round(base * (1 + (lvl - 1) * 0.12) * this.bonus));
    this.bonus = 1;
    g.addCash(money);
    sfx.cashier();
    if (money > this.best(k)) g.progress.records["job_" + k] = money;
    g.banner(`+$${fmt(money)}`, `${JOB_DEFS[k].name} ${a.count}${label ? " · " + label : ""}`, "#3dff8b", 1.6);
    if (a.count % 5 === 0) { g.addCash(500); g.hintMsg("Serienbonus +$500"); }
    if (lvl > before) this.levelUp(k, lvl);
    g.saveSoon();
  }
  private levelUp(k: JobKind, lvl: number) {
    const g = this.g, pr = g.progress;
    const cash = levelCash(lvl);
    g.addCash(cash);
    const reward = LEVEL_REWARD[lvl];
    if (lvl === 4) pr.unlocks.push("paint:" + jobPaint(k));
    if (lvl === 7) pr.unlocks.push("outfit:" + k);
    if (lvl === 10 && !pr.unlocks.includes("slot:" + k)) pr.unlocks.push("slot:" + k);
    sfx.success();
    g.banner(`${JOB_DEFS[k].name.toUpperCase()} STUFE ${lvl}`, `+$${fmt(cash)}${reward ? " · " + reward : ""}`, "#ffd23f", 3);
    void GARAGE_SLOTS;
  }
  private payStunt(label: string) { const a = this.active!; this.pay(300 + a.goal * 4, label); this.nextTask(); }

  // ---------------- tasks
  private spawnSuspect(x: number, y: number) {
    const a = this.active!, g = this.g;
    const s = g.peds.spawnRole("target", x, y);
    if (!s) { this.nextTask(); return; }
    s.tag = "suspect"; s.shirt = SUSPECT_LOOK.shirt; s.pants = SUSPECT_LOOK.pants; s.hp = s.maxHp = 40;
    g.peds.panic(s, g.fx, g.fy, 30);
    a.suspect = s; a.stage = "catch"; a.timer = 50;
  }
  private curb(minD: number, maxD: number, fromX = this.g.fx, fromY = this.g.fy) { return this.g.world.curbPoint(fromX, fromY, minD, maxD); }

  private nextTask() {
    const a = this.active!, g = this.g, w = g.world, lvl = this.level(a.kind);
    a.crashes = 0; a.shots = 0; a.rough = 0;
    switch (a.kind) {
      case "taxi": {
        a.stage = "pickup";
        const p = this.curb(250, 650);
        a.fare = g.peds.spawnRole("fare", p.x, p.y);
        if (a.fare) a.fare.tag = "fare";
        a.pref = Math.random() < 0.5 ? "fast" : "careful";
        a.timer = 60;
        break;
      }
      case "delivery": {
        const shops = g.places.filter((p) => p.kind !== "hospital" && p.kind !== "police" && p.kind !== "contact" && p.kind !== "job" && !p.at && Math.hypot(p.cx - g.fx, p.cy - g.fy) > 700);
        const pl = shops[Math.floor(Math.random() * shops.length)] ?? g.places[0];
        a.dest = { x: pl.cx, y: pl.cy };
        a.timer = Math.hypot(a.dest.x - g.fx, a.dest.y - g.fy) / (6 + lvl * 0.3) + 25;
        a.hp0 = g.player.hp;
        a.pref = Math.random() < 0.5 ? "careful" : "fast"; // careful = fragile goods
        g.hintMsg(`Lieferung für ${pl.name}${a.pref === "careful" ? " – zerbrechlich!" : ""}`);
        break;
      }
      case "bounty":
        if (Math.random() < 0.35) {
          const p = this.curb(350, 650);
          this.spawnSuspect(p.x, p.y);
          g.hintMsg("Zentrale: Taschendieb flüchtet zu Fuß – schnapp ihn dir!");
        } else {
          const n = w.nearestNode(g.fx, g.fy), np = w.nodePos(Math.min(16, n.i + (Math.random() < 0.5 ? 2 : -2) + 0), Math.min(16, Math.max(0, n.j + 1)));
          const f = Math.random() < 0.5 ? "halcones" : "kings";
          const c = new Car("civ", Math.random() < 0.5 ? "muscle" : "suv", f === "halcones" ? "#c0392b" : "#7d3c98");
          c.x = Math.max(75, Math.min(WORLD - 75, np.x)) + 10; c.y = np.y + 34; c.z = terrainH(c.x, c.y); c.hp = c.maxHp = 140 + lvl * 15; c.mass = 1.3;
          c.flee = true; c.driver = true; c.cruise = 240 + Math.min(80, lvl * 8); c.tag = "target"; c.keep = true; c.faction = f;
          g.cars.push(c);
          a.target = c; a.stage = "hunt"; a.timer = 120; a.suspect = null;
          g.hintMsg("Zentrale: Fluchtwagen gesichtet – stoppen!");
        }
        break;
      case "ambulance": {
        const p = this.curb(300, 800);
        const v = g.peds.spawnRole("fare", p.x, p.y);
        if (v) { v.tag = "patient"; g.peds.knockDown(v, 0, 0, 0); }
        a.fare = v; a.stage = "pickup";
        a.timer = (a.count === 0 ? 70 : Math.max(a.timer, 0) + 45) - lvl * 2;
        g.hintMsg("Notruf: Verletzte Person – hol sie ab");
        break;
      }
      case "fire": {
        const c0 = this.curb(400, 900);
        a.fires = [];
        const n = 2 + Math.floor(lvl / 3);
        for (let i = 0; i < n; i++) {
          const p = i ? this.curb(30, 260, c0.x, c0.y) : c0;
          let car: Car | null = null;
          if (i % 2 === 0) {
            // a burning car at the curb
            const sp = g.world.curbPoints().find((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1) ?? { nx: 0, ny: 1 };
            car = new Car("civ", "sedan", "#3a3d45");
            car.x = p.x + sp.nx * 30; car.y = p.y + sp.ny * 30; car.a = Math.atan2(sp.nx, -sp.ny); car.z = 0; car.parked = true; car.handbrake = true; car.wrecked = true; car.keep = true; car.hp = car.maxHp = 60;
            g.cars.push(car);
          } else this.props.push({ x: p.x, y: p.y, kind: "bin" });
          a.fires.push({ x: car ? car.x : p.x, y: car ? car.y : p.y, size: 0.7 + Math.random() * 0.3, car });
        }
        a.stage = "fight"; a.timer = 100 + n * 15;
        g.hintMsg("Brand gemeldet – halte mit dem Wasserwerfer drauf (Feuer-Taste)");
        break;
      }
      case "trash": {
        a.bins = []; this.props = this.props.filter((p) => p.kind !== "bin");
        let from = { x: g.fx, y: g.fy };
        for (let i = 0; i < 4 + Math.floor(lvl / 2); i++) { const p = this.curb(200, 450, from.x, from.y); a.bins.push({ x: p.x, y: p.y, done: false }); this.props.push({ x: p.x, y: p.y, kind: "bin" }); from = p; }
        a.carrying = false; a.stage = "collect"; a.timer = -1;
        g.hintMsg("Fahr die Tonnen ab: aussteigen, Tonne nehmen (E), zum Wagen tragen");
        break;
      }
      case "tow": {
        const p = this.curb(350, 900);
        const sp = g.world.curbPoints().find((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1) ?? { nx: 0, ny: 1 };
        const wreck = Math.random() < 0.4;
        const c = new Car("civ", Math.random() < 0.5 ? "sedan" : "compact", wreck ? "#3a3530" : ["#8a1c2b", "#1d4e89", "#d8d8e0"][Math.floor(Math.random() * 3)]);
        c.x = p.x + sp.nx * 30; c.y = p.y + sp.ny * 30; c.a = Math.atan2(sp.nx, -sp.ny); c.z = 0; c.parked = true; c.handbrake = true; c.keep = true; c.tag = "tow"; c.wrecked = wreck;
        c.hp = c.maxHp = 80; c.mass = 0.9;
        g.cars.push(c);
        a.target = c; a.stage = "hook"; a.timer = 120;
        const yard = g.places.find((q) => q.job === "tow");
        a.dest = yard ? { x: yard.cx, y: yard.cy } : { x: 15 * BLOCK, y: 10 * BLOCK };
        g.hintMsg(wreck ? "Wrack am Straßenrand – ankoppeln und zum Hof" : "Falschparker – ankoppeln und zum Hof");
        break;
      }
      case "bus": {
        const all = w.busStops();
        let cur = { x: g.fx, y: g.fy };
        a.stops = [];
        for (let i = 0; i < 4 + Math.floor(lvl / 3); i++) {
          const cand = all.filter((s) => !a.stops.includes(s) && Math.hypot(s.x - cur.x, s.y - cur.y) > 350 && Math.hypot(s.x - cur.x, s.y - cur.y) < 1100);
          const s = cand[Math.floor(Math.random() * cand.length)] ?? all[Math.floor(Math.random() * all.length)];
          a.stops.push(s); cur = s;
        }
        a.stopI = 0; a.holdT = 0; a.late = false; a.stage = "drive";
        a.timer = Math.hypot(a.stops[0].x - g.fx, a.stops[0].y - g.fy) / 6 + 20;
        g.hintMsg(`Linie ${10 + Math.floor(Math.random() * 80)}: ${a.stops.length} Haltestellen`);
        break;
      }
      case "icecream": {
        a.kids = [];
        const res = w.curbPoints().filter((c) => DISTRICTS[districtAt(c.x, c.y)].id === "residential" && Math.hypot(c.x - g.fx, c.y - g.fy) > 200 && Math.hypot(c.x - g.fx, c.y - g.fy) < 2600);
        for (let i = 0; i < 3 && res.length; i++) {
          const p = res.splice(Math.floor(Math.random() * res.length), 1)[0];
          const grp: Civilian[] = [];
          for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) { const kid = g.peds.spawnRole("fare", p.x + rnd(-8, 8), p.y + rnd(-8, 8)); if (kid) { kid.tag = "kid"; kid.scale = 0.62; grp.push(kid); } }
          if (grp.length) a.kids.push(grp);
        }
        a.stage = "sell"; a.timer = 150; a.rough = 0; a.serveT = 0;
        g.hintMsg(a.kids.length ? "Kinder warten im Wohnviertel – langsam ranfahren und halten" : "Fahr ins Wohnviertel Palmenhain");
        break;
      }
      case "courier": {
        const r = Math.random();
        if (r < 0.25) {
          // on a parking garage roof
          const gar = w.blocks.filter((b) => b.kind === "garage").map((b) => b.buildings[0]);
          const bd = gar[Math.floor(Math.random() * gar.length)];
          a.dest = { x: bd.x + bd.w / 2, y: bd.y + bd.h / 2 }; a.hint.r = roofOf(bd);
          g.hintMsg("Paket aufs Dach des Parkhauses");
        } else if (r < 0.5) {
          const old = w.blocks.filter((b) => b.district === "oldtown" && b.kind === "city");
          const b = old[Math.floor(Math.random() * old.length)];
          a.dest = { x: b.bx * BLOCK + ROAD + 18 + 165, y: b.by * BLOCK + ROAD + 18 + 160 }; a.hint.r = 0; // the alley crossing in the middle of the block
          g.hintMsg("Paket in eine Gasse der Altstadt");
        } else { const p = this.curb(400, 1000); a.dest = { x: p.x, y: p.y }; a.hint.r = 0; g.hintMsg("Paket an die Haustür"); }
        a.stage = "drive";
        a.timer = Math.hypot(a.dest.x - g.fx, a.dest.y - g.fy) / (5 + lvl * 0.2) + 25;
        break;
      }
      case "watertaxi": {
        const docks = w.docks();
        let from = 0, bd = Infinity;
        docks.forEach((d, i) => { const dd = Math.hypot(d.x - g.fx, d.y - g.fy); if (dd < bd) { bd = dd; from = i; } });
        if (a.count > 0) from = (a.dockFrom + 1 + Math.floor(Math.random() * (docks.length - 1))) % docks.length;
        a.dockFrom = from;
        const d = docks[from];
        a.fare = g.peds.spawnRole("fare", d.lx, d.ly);
        if (a.fare) a.fare.tag = "fare";
        a.stage = "pickup"; a.timer = Math.hypot(d.x - g.fx, d.y - g.fy) / 6 + 40;
        g.hintMsg(`Fahrgast wartet: ${d.name}`);
        break;
      }
      case "heli": {
        const lm = w.landmarks().sort(() => Math.random() - 0.5).slice(0, 3);
        a.spots = lm.map((l) => ({ x: l.x, y: l.y, h: l.h, name: l.name }));
        a.stopI = 0; a.holdT = 0; a.rough = 0; a.stage = "fly"; a.timer = 240;
        g.hintMsg(`Rundflug: ${a.spots.map((s) => s.name).join(" · ")}`);
        break;
      }
      case "hunter": {
        const p = this.curb(700, 1600);
        const s = g.peds.spawnRole("target", p.x, p.y);
        if (s) {
          s.tag = "wanted"; s.shirt = "#6b4c9a"; s.pants = "#1c1c22"; s.hp = s.maxHp = 50 + lvl * 8;
          if (lvl >= 3) { s.armed = true; s.role = "gang"; s.faction = null; }
        }
        a.suspect = s; a.stage = "search"; a.timer = 200;
        a.hint = { x: p.x + rnd(-250, 250), y: p.y + rnd(-250, 250), r: 520 }; a.hintT = 0;
        g.addMessage("Kopfgeldbüro", `Gesucht: ${["Rico „Wiesel“ Santos", "Mara Ventura", "Lenny Boone", "Dario Feld", "Ivo Kranz"][Math.floor(Math.random() * 5)]} – zuletzt gesehen in ${DISTRICTS[districtAt(p.x, p.y)].name}`);
        g.hintMsg("Hinweis im Handy: Gesuchter im markierten Gebiet");
        break;
      }
      case "race": {
        const def = RACES.filter((r) => r.id !== "r2")[Math.floor(Math.random() * 3)];
        a.race = def; a.raceI = -1; a.raceT = 0; a.fee = 200 + lvl * 50;
        a.stage = "start"; a.timer = -1; a.opps = [];
        g.hintMsg(`${def.name}: Fahr zum Start (Startgeld $${a.fee})`);
        break;
      }
      case "stunt": {
        const tasks: ActiveJob["task"][] = ["jump", "drift", "time"];
        a.task = tasks[a.count % 3]; a.best = 0;
        if (a.task === "jump") { a.goal = 22 + lvl * 3; a.timer = 90; }
        else if (a.task === "drift") { a.goal = 700 + lvl * 200; a.timer = 60; }
        else {
          const s = STUNT_PARK, cx = (s.x0 + s.x1) / 2, cy = (s.y0 + s.y1) / 2;
          a.checks = [[s.x0 + 200, cy], [cx, s.y0 + 200], [s.x1 - 200, cy], [cx, s.y1 - 200], [s.x0 + 200, cy]];
          a.raceI = 0; a.goal = Math.max(28, 52 - lvl * 2); a.timer = a.goal;
        }
        a.stage = "go";
        g.hintMsg(a.task === "jump" ? `Stunt: Spring mindestens ${a.goal} m weit` : a.task === "drift" ? `Stunt: ${fmt(a.goal)} Driftpunkte im Park` : `Stunt: Zeitfahrt durch den Park unter ${a.goal} s`);
        break;
      }
    }
  }

  // the job vehicles wait at their start points
  private keepVehicles() {
    const g = this.g;
    for (const pl of g.places) if (pl.job) { const v = JOB_DEFS[pl.job].vehicle; if (v && !isCraft(v.model)) g.craft.keepAt(v.model, pl.cx, pl.cy, -Math.PI / 2, v.color); }
  }
  private keepT = 0;

  update(dt: number) {
    const g = this.g;
    this.markers.length = 0;
    const inCar = !g.onFoot && !g.player.dead && !g.playerCarStored;
    this.keepT -= dt;
    if (this.keepT <= 0) { this.keepT = 1; this.keepVehicles(); }
    this.updateDelivery(dt);
    // start points (shown while no job runs)
    if (!this.active && !g.missions.active) for (const pl of g.places) if (pl.job && Math.hypot(pl.cx - g.fx, pl.cy - g.fy) < 2500) this.markers.push({ x: pl.cx, y: pl.cy, color: pl.color, kind: "contact", label: pl.icon });
    this.updateCollectibles(inCar);
    this.updateRace(dt, inCar);
    const a = this.active;
    if (!a) return;
    const model = inCar ? g.player.model : null;
    // the job vehicle matters except while you are on foot for a part of the job
    const footOk = (a.kind === "bounty" && (a.stage === "catch" || a.stage === "back")) || (a.kind === "trash") || (a.kind === "hunter");
    if (!footOk && !jobVehicleOk(a.kind, model)) { this.stop(model ? "Du bist in ein anderes Fahrzeug gestiegen" : "Du hast das Fahrzeug verlassen"); return; }
    if (a.timer > 0 || a.timer === 0) {
      a.timer -= dt;
      g.objTimer = Math.max(0, a.timer);
      if (a.timer <= 0) { this.stop(a.kind === "taxi" && a.stage === "drive" ? "Der Fahrgast ist sauer ausgestiegen" : a.stage === "catch" ? "Der Verdächtige ist entkommen" : "Zu spät"); return; }
    } else g.objTimer = -1;
    const p = g.player;
    switch (a.kind) {
      case "taxi": this.taxi(a, p); break;
      case "delivery":
        g.objective = `Lieferung: Bring die Ware zum Laden${a.pref === "careful" ? " (zerbrechlich)" : ""}`;
        this.markers.push({ x: a.dest.x, y: a.dest.y, color: "#ffd23f", kind: "goal", label: "" });
        if (Math.hypot(a.dest.x - p.x, a.dest.y - p.y) < 55 && p.speed < 70) {
          const dmg = Math.max(0, (a.hp0 - p.hp) / p.maxHp);
          const f = a.pref === "careful" ? Math.max(0.2, 1 - dmg * 4) : 1;
          this.pay((140 + Math.round(a.timer * 4)) * f, f < 1 ? `Ware beschädigt (−${Math.round((1 - f) * 100)} %)` : "");
          this.nextTask();
        }
        break;
      case "bounty": this.bounty(a, p, inCar); break;
      case "ambulance": this.ambulance(a, p); break;
      case "fire": this.fire(a, dt); break;
      case "trash": this.trash(a, p); break;
      case "tow": this.tow(a, p); break;
      case "bus": this.bus(a, p, dt); break;
      case "icecream": this.icecream(a, p, dt); break;
      case "courier": {
        g.objective = "Kurier: Stell das Paket zu";
        this.markers.push({ x: a.dest.x, y: a.dest.y, color: "#ffd23f", kind: "goal", label: "" });
        const up = a.hint.r > 0 ? g.fz > a.hint.r - 6 : true;
        if (Math.hypot(a.dest.x - g.fx, a.dest.y - g.fy) < 32 && up && g.fspeed < 120) { this.pay(90 + Math.round(a.timer * 5)); this.nextTask(); }
        break;
      }
      case "watertaxi": this.watertaxi(a, p); break;
      case "heli": this.heliTour(a, p, dt); break;
      case "hunter": this.hunter(a, dt); break;
      case "race": this.streetRace(a, p, dt); break;
      case "stunt": this.stunt(a, dt); break;
    }
  }

  private taxi(a: ActiveJob, p: Car) {
    const g = this.g;
    if (a.stage === "pickup") {
      const f = a.fare;
      if (!f || !f.active || f.state === "down") { this.nextTask(); return; }
      g.objective = "Taxi: Hol den Fahrgast ab";
      this.markers.push({ x: f.x, y: f.y, color: "#2bf0ff", kind: "goal", label: "" });
      if (Math.hypot(f.x - p.x, f.y - p.y) < 60 && p.speed < 45) {
        f.active = false; f.tag = "";
        a.dest = g.world.curbPoint(p.x, p.y, 700, 1700);
        a.timer = Math.hypot(a.dest.x - p.x, a.dest.y - p.y) / 7 + 20;
        a.stage = "drive"; a.crashes = 0; sfx.door();
        g.hintMsg(a.pref === "fast" ? "Fahrgast: „Ich hab's eilig – gib Gas!“" : "Fahrgast: „Bitte vorsichtig fahren.“");
      }
    } else {
      g.objective = `Taxi: Bring den Fahrgast ans Ziel (${a.pref === "fast" ? "eilig" : "vorsichtig"})`;
      this.markers.push({ x: a.dest.x, y: a.dest.y, color: "#ffd23f", kind: "goal", label: "" });
      if (Math.hypot(a.dest.x - p.x, a.dest.y - p.y) < 75 && p.speed < 70) {
        const tip = a.pref === "fast" ? Math.round(a.timer * 3) : Math.max(0, 120 - a.crashes * 50);
        const stars = Math.max(1, 5 - a.crashes - (a.pref === "fast" && a.timer < 10 ? 1 : 0));
        this.pay(60 + tip, `Bewertung ${stars}/5 · Trinkgeld $${tip}`);
        this.nextTask();
      }
    }
  }

  private bounty(a: ActiveJob, p: Car, inCar: boolean) {
    const g = this.g, lvl = this.level("bounty");
    if (a.stage === "hunt") {
      const c = a.target;
      if (!c || !g.cars.includes(c)) { this.stop("Das Ziel ist entkommen"); return; }
      g.objective = "Streife: Stopp den Fluchtwagen (rammen oder schießen)";
      this.markers.push({ x: c.x, y: c.y, color: "#ff4d4d", kind: "enemy", label: "" });
      if (c.dead || c.hp < c.maxHp * STOP_HP) {
        c.flee = false; c.driver = false; c.parked = true; c.handbrake = true; c.tag = ""; c.keep = false; c.faction = null;
        c.vx *= 0.1; c.vy *= 0.1; c.av = 0;
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
      if (s.state !== "down" && s.state !== "flee") g.peds.panic(s, g.fx, g.fy, 30);
      if (s.state === "down" || (g.onFoot && d < ARREST_DIST)) {
        s.active = false; s.tag = "";
        sfx.success();
        g.banner("FESTGENOMMEN", "Zurück zum Streifenwagen", "#3d8bff", 1.6);
        const clean = a.shots === 0;
        this.pay((s.state === "down" ? 250 + lvl * 30 : 400 + lvl * 40) + (clean ? 200 : 0), clean ? "ohne Schuss: Bonus $200" : "");
        a.suspect = null; a.stage = "back"; a.timer = 60;
      } else if (d > 1400) this.stop("Der Verdächtige ist entkommen");
    } else {
      g.objective = "Streife: Zurück in den Streifenwagen";
      if (inCar) this.nextTask();
    }
  }

  private ambulance(a: ActiveJob, p: Car) {
    const g = this.g;
    const hosp = g.places.find((q) => q.kind === "hospital")!;
    if (a.stage === "pickup") {
      const v = a.fare;
      if (!v || !v.active) { this.nextTask(); return; }
      g.objective = "Krankenwagen: Fahr zum Verletzten";
      this.markers.push({ x: v.x, y: v.y, color: "#ff4d6d", kind: "goal", label: "+" });
      if (Math.hypot(v.x - p.x, v.y - p.y) < 65 && p.speed < 40) { v.active = false; v.tag = ""; a.stage = "drive"; a.rough = 0; a.timer += 20; sfx.door(); g.hintMsg("Patient an Bord – ab ins Krankenhaus, aber ruhig!"); }
    } else {
      g.objective = "Krankenwagen: Ins Krankenhaus – ruhig fahren";
      this.markers.push({ x: hosp.cx, y: hosp.cy, color: "#ff4d6d", kind: "goal", label: "+" });
      if (Math.hypot(hosp.cx - p.x, hosp.cy - p.y) < 80 && p.speed < 50) {
        const f = Math.max(0.3, 1 - a.rough * 0.2);
        this.pay((200 + Math.round(a.timer * 3)) * f, a.rough ? `durchgeschüttelt (−${Math.round((1 - f) * 100)} %)` : "ruhige Fahrt");
        this.nextTask();
      }
    }
  }

  private fire(a: ActiveJob, dt: number) {
    const g = this.g;
    g.objective = `Feuerwehr: Lösch die Brände (${a.fires.filter((f) => f.size > 0).length} übrig) – Feuer-Taste = Wasserwerfer`;
    let left = 0;
    for (const f of a.fires) {
      if (f.size <= 0) continue;
      left++;
      f.size = Math.min(1.6, f.size + dt * 0.012); // fires grow
      this.markers.push({ x: f.x, y: f.y, color: "#ff8a1a", kind: "goal", label: "" });
      g.flame(f.x, f.y, f.size, dt);
    }
    // a big fire spreads to the next bin
    for (const f of a.fires) if (f.size > 1.4 && a.fires.length < 10 && Math.random() < dt * 0.05) {
      const ang = Math.random() * Math.PI * 2, x = f.x + Math.cos(ang) * 60, y = f.y + Math.sin(ang) * 60;
      if (!g.world.isSolid(x, y, 8) && !isWater(x, y)) { a.fires.push({ x, y, size: 0.4, car: null }); this.props.push({ x, y, kind: "bin" }); g.hintMsg("Das Feuer breitet sich aus!"); }
    }
    if (!left) { this.props.length = 0; this.pay(220 + a.fires.length * 60 + Math.round(a.timer * 2)); this.nextTask(); }
  }

  private trash(a: ActiveJob, p: Car) {
    const g = this.g;
    const left = a.bins.filter((b) => !b.done).length;
    g.objective = a.carrying ? "Müllabfuhr: Trag die Tonne zum Müllwagen" : `Müllabfuhr: ${left} Tonnen übrig – aussteigen, Tonne nehmen (E)`;
    for (const b of a.bins) if (!b.done) this.markers.push({ x: b.x, y: b.y, color: "#3dff8b", kind: "goal", label: "" });
    if (a.carrying) {
      const ca = Math.cos(p.a), sa = Math.sin(p.a), rx = p.x - ca * (p.hl + 6), ry = p.y - sa * (p.hl + 6);
      this.markers.push({ x: rx, y: ry, color: "#ffd23f", kind: "pickup", label: "" });
      if (g.onFoot && Math.hypot(g.fx - rx, g.fy - ry) < 30) { a.carrying = false; sfx.crash(0.2); g.hintMsg("Ausgekippt"); if (!a.bins.some((b) => !b.done)) { this.pay(160 + a.bins.length * 30); this.nextTask(); } }
    }
  }

  private tow(a: ActiveJob, p: Car) {
    const g = this.g, c = a.target;
    if (!c || !g.cars.includes(c)) { this.nextTask(); return; }
    if (a.stage === "hook") {
      g.objective = "Abschleppdienst: Fahr rückwärts an das Auto heran";
      this.markers.push({ x: c.x, y: c.y, color: "#ffd23f", kind: "goal", label: "" });
      const ca = Math.cos(p.a), sa = Math.sin(p.a), rx = p.x - ca * p.hl, ry = p.y - sa * p.hl;
      if (Math.hypot(c.x - rx, c.y - ry) < c.hl + 26 && p.speed < 45) { a.stage = "haul"; c.parked = false; c.driver = false; sfx.door(); g.hintMsg("Angekoppelt – ab zum Abschlepphof"); a.timer += 30; }
    } else {
      g.objective = "Abschleppdienst: Bring das Auto zum Hof";
      this.markers.push({ x: a.dest.x, y: a.dest.y, color: "#ffd23f", kind: "goal", label: "" });
      if (Math.hypot(a.dest.x - p.x, a.dest.y - p.y) < 90 && p.speed < 40) {
        c.parked = true; c.handbrake = true; c.keep = false; c.tag = ""; a.target = null;
        this.pay(150 + Math.round(a.timer * 3) + (c.wrecked ? 80 : 0));
        this.nextTask();
      }
    }
  }

  private bus(a: ActiveJob, p: Car, dt: number) {
    const g = this.g, s = a.stops[a.stopI];
    g.objective = `Bus: Haltestelle ${a.stopI + 1}/${a.stops.length} – anhalten${a.late ? " (Verspätung)" : ""}`;
    this.markers.push({ x: s.x, y: s.y, color: "#2bb3ff", kind: "goal", label: "H" });
    const lane = { x: s.x + s.nx * 45, y: s.y + s.ny * 45 };
    if (Math.hypot(lane.x - p.x, lane.y - p.y) < 60 && p.speed < 15) {
      a.holdT += dt;
      if (a.holdT > 0.2 && a.holdT - dt <= 0.2) {
        // a few people step in (and some get off)
        for (let k = 0; k < 1 + Math.floor(Math.random() * 3); k++) { const c = g.peds.spawnCiv(s.x + rnd(-15, 15), s.y + rnd(-15, 15)); if (c) { c.tx = p.x; c.ty = p.y; c.offPath = true; c.tag = "board"; } }
      }
      if (a.holdT > 2.2) {
        for (const c of g.peds.list) if (c.active && c.tag === "board" && Math.hypot(c.x - p.x, c.y - p.y) < 60) { c.active = false; c.tag = ""; }
        a.holdT = 0; a.stopI++; sfx.checkpoint();
        if (a.stopI >= a.stops.length) { this.pay((200 + a.stops.length * 40) * (a.late ? 0.6 : 1.2), a.late ? "mit Verspätung" : "pünktlich: +20 %"); this.nextTask(); return; }
        const n = a.stops[a.stopI];
        if (a.timer < 0) a.late = true;
        a.timer = Math.hypot(n.x - p.x, n.y - p.y) / 6 + 18;
      }
    } else a.holdT = 0;
  }

  private icecream(a: ActiveJob, p: Car, dt: number) {
    const g = this.g;
    if (g.isNight) { this.stop("Feierabend – nachts kauft keiner Eis"); return; }
    const res = DISTRICTS[districtAt(p.x, p.y)].id === "residential";
    if (res && p.speed > 260) { a.rough += dt; if (a.rough > 1 && Math.random() < dt) g.hintMsg("Langsam! Hier spielen Kinder"); }
    a.kids = a.kids.filter((grp) => grp.some((k) => k.active));
    g.objective = `Eiswagen: ${a.kids.length} Kindergruppen warten`;
    for (const grp of a.kids) { const k = grp[0]; this.markers.push({ x: k.x, y: k.y, color: "#ff9ad5", kind: "goal", label: "" }); }
    const near = a.kids.find((grp) => Math.hypot(grp[0].x - p.x, grp[0].y - p.y) < 75);
    if (near && p.speed < 20) {
      a.serveT += dt;
      if (a.serveT > 2.5) {
        a.serveT = 0;
        for (const k of near) k.active = false;
        sfx.cashier();
        const f = Math.max(0.4, 1 - a.rough * 0.1);
        this.pay(near.length * 45 * f, `${near.length} Eis verkauft`);
        if (!a.kids.some((grp) => grp !== near && grp.some((k) => k.active))) this.nextTask();
      }
    } else a.serveT = 0;
  }

  private watertaxi(a: ActiveJob, p: Car) {
    const g = this.g, docks = g.world.docks();
    if (a.stage === "pickup") {
      const d = docks[a.dockFrom];
      g.objective = `Wassertaxi: Hol den Fahrgast ab (${d.name})`;
      this.markers.push({ x: d.x, y: d.y, color: "#2bf0ff", kind: "goal", label: "" });
      if (Math.hypot(d.x - p.x, d.y - p.y) < 110 && p.speed < 50) {
        if (a.fare) { a.fare.active = false; a.fare.tag = ""; }
        let to = (a.dockFrom + 1 + Math.floor(Math.random() * (docks.length - 1))) % docks.length;
        if (to === a.dockFrom) to = (to + 1) % docks.length;
        a.dest = { x: docks[to].x, y: docks[to].y }; a.stopI = to;
        a.stage = "drive"; a.timer = Math.hypot(a.dest.x - p.x, a.dest.y - p.y) / 7 + 30; sfx.door();
        g.hintMsg(`Ziel: ${docks[to].name}`);
      }
    } else {
      g.objective = `Wassertaxi: Bring den Fahrgast zu ${docks[a.stopI].name}`;
      this.markers.push({ x: a.dest.x, y: a.dest.y, color: "#ffd23f", kind: "goal", label: "" });
      if (Math.hypot(a.dest.x - p.x, a.dest.y - p.y) < 110 && p.speed < 60) { this.pay(160 + Math.round(a.timer * 4)); a.dockFrom = a.stopI; this.nextTask(); }
    }
  }

  private heliTour(a: ActiveJob, p: Car, dt: number) {
    const g = this.g;
    if (Math.abs(p.vz) > 190 || Math.abs(p.av) > 1.7) a.rough += dt;
    if (a.stopI < a.spots.length) {
      const s = a.spots[a.stopI];
      const alt = p.z - g.groundAt(p.x, p.y);
      g.objective = `Rundflug: ${s.name} – dort langsam schweben (${a.stopI + 1}/${a.spots.length})`;
      this.markers.push({ x: s.x, y: s.y, color: "#ffd23f", kind: "goal", label: String(a.stopI + 1) });
      if (Math.hypot(s.x - p.x, s.y - p.y) < 240 && alt > 60 && p.z < s.h + 420 && p.speed < 90) {
        a.holdT += dt;
        if (a.holdT > 3) { a.holdT = 0; a.stopI++; sfx.checkpoint(); g.hintMsg("Touristen: „Wunderschön!“"); }
      } else a.holdT = Math.max(0, a.holdT - dt);
    } else {
      const pad = g.places.find((q) => q.kind === "heliport")!;
      g.objective = "Rundflug: Zurück zum Heliport und landen";
      this.markers.push({ x: pad.cx, y: pad.cy, color: "#ffd23f", kind: "goal", label: "F" });
      if (Math.hypot(pad.cx - p.x, pad.cy - p.y) < 160 && p.z <= g.groundAt(p.x, p.y) + 2) {
        const stars = Math.max(1, 5 - Math.floor(a.rough));
        this.pay((420 + Math.round(a.timer)) * (0.6 + stars * 0.1), `Flugstil ${stars}/5`);
        this.nextTask();
      }
    }
  }

  private hunter(a: ActiveJob, dt: number) {
    const g = this.g, s = a.suspect, lvl = this.level("hunter");
    if (!s || !s.active) { this.stop("Der Gesuchte ist untergetaucht"); return; }
    a.hintT += dt;
    if (a.hintT > 20 && a.hint.r > 180) { a.hintT = 0; a.hint.r -= 60; a.hint.x += (s.x - a.hint.x) * 0.35; a.hint.y += (s.y - a.hint.y) * 0.35; g.hintMsg("Neuer Hinweis: das Gebiet wird kleiner"); }
    const d = Math.hypot(s.x - g.fx, s.y - g.fy);
    const seen = d < 260 && g.world.lineClear(g.fx, g.fy, s.x, s.y, 40);
    if (seen && a.stage === "search") { a.stage = "chase"; g.hintMsg("Da ist er! Festnehmen (berühren oder niederschlagen)"); if (!s.armed) g.peds.panic(s, g.fx, g.fy, 30); else { s.state = "attack"; s.target = -1; } }
    g.objective = a.stage === "search" ? "Kopfgeld: Such den Gesuchten im markierten Gebiet" : "Kopfgeld: Festnehmen!";
    this.markers.push(a.stage === "search" ? { x: a.hint.x, y: a.hint.y, color: "#9d4dff", kind: "goal", label: "?" } : { x: s.x, y: s.y, color: "#ff4d4d", kind: "enemy", label: "" });
    if (s.state === "down" || (g.onFoot && d < ARREST_DIST)) {
      s.active = false; s.tag = "";
      this.pay(400 + lvl * 60 + (a.shots === 0 ? 150 : 0), s.state === "down" ? "überwältigt" : "festgenommen");
      this.nextTask();
    }
  }
  // the search area of the bounty hunter (drawn on the maps)
  get searchArea() { const a = this.active; return a?.kind === "hunter" && a.stage === "search" ? a.hint : null; }

  private streetRace(a: ActiveJob, p: Car, dt: number) {
    const g = this.g, def = a.race!;
    if (a.stage === "start") {
      const [sx, sy] = def.start;
      g.objective = `Straßenrennen: Fahr zum Start (${def.name})`;
      this.markers.push({ x: sx, y: sy, color: "#9d4dff", kind: "race", label: "R" });
      if (Math.hypot(sx - p.x, sy - p.y) < 70 && p.speed < 60) {
        if (g.cash < a.fee) { this.stop(`Zu wenig Geld für das Startgeld ($${a.fee})`); return; }
        g.cash -= a.fee;
        // three opponents on the grid next to you
        const ang = Math.atan2(def.points[0][1] - sy, def.points[0][0] - sx), ca = Math.cos(ang), sa = Math.sin(ang);
        for (let i = 0; i < 3; i++) {
          const c = new Car("civ", ["sport", "super", "muscle"][i] as CarModel, ["#2bf0ff", "#ffd23f", "#3dff8b"][i]);
          const back = 50 + i * 45, side = i % 2 ? 40 : -40;
          c.x = sx - ca * back - sa * side; c.y = sy - sa * back + ca * side; c.a = ang; c.z = g.groundAt(c.x, c.y);
          c.hp = c.maxHp = 120; c.mass = 1.3; c.driver = true; c.keep = true; c.tag = "racer"; c.cruise = 330 + this.level("race") * 12 + i * 15;
          g.cars.push(c);
          a.opps.push({ car: c, i: 0, done: false });
        }
        a.stage = "count"; a.raceT = 3; p.vx = 0; p.vy = 0;
        sfx.beep();
      }
      return;
    }
    if (a.stage === "count") {
      a.raceT -= dt;
      g.objective = `Straßenrennen: ${Math.ceil(a.raceT)} …`;
      p.vx *= 0.5; p.vy *= 0.5;
      for (const o of a.opps) { o.car.vx = 0; o.car.vy = 0; }
      if (a.raceT <= 0) { a.stage = "race"; a.raceI = 0; a.raceT = 0; g.banner("LOS!", def.name, "#9d4dff", 1.2); sfx.checkpoint(); }
      return;
    }
    a.raceT += dt;
    const [x, y] = def.points[a.raceI];
    this.markers.push({ x, y, color: "#2bf0ff", kind: "race", label: String(a.raceI + 1) });
    for (const o of a.opps) this.markers.push({ x: o.car.x, y: o.car.y, color: "#ff4d4d", kind: "enemy", label: "" });
    const place = 1 + a.opps.filter((o) => o.done || o.i > a.raceI || (o.i === a.raceI && Math.hypot(def.points[o.i][0] - o.car.x, def.points[o.i][1] - o.car.y) < Math.hypot(x - p.x, y - p.y))).length;
    g.objective = `${def.name}: Checkpoint ${a.raceI + 1}/${def.points.length} · Platz ${place}/4`;
    if (Math.hypot(x - p.x, y - p.y) < 75) {
      a.raceI++; sfx.checkpoint();
      if (a.raceI >= def.points.length) {
        const won = place === 1;
        for (const o of a.opps) { o.car.keep = false; o.car.tag = ""; o.car.flee = false; }
        a.opps = [];
        if (won) this.pay(a.fee * 4, `${def.name} gewonnen in ${a.raceT.toFixed(1).replace(".", ",")} s`);
        else { sfx.fail(); g.banner(`PLATZ ${place}`, "Kein Preisgeld – nochmal?", "#ff9f43", 2.2); }
        const rec = g.progress.records[def.id];
        if (!rec || a.raceT < rec) g.progress.records[def.id] = Math.round(a.raceT * 10) / 10;
        this.nextTask();
      }
    }
  }
  // opponents drive from checkpoint to checkpoint (called from the game's AI step)
  racerAI(c: Car): boolean {
    const a = this.active;
    if (!a || a.kind !== "race" || c.tag !== "racer") return false;
    const o = a.opps.find((q) => q.car === c);
    if (!o || o.done || a.stage !== "race") { c.throttle = 0; c.handbrake = true; return true; }
    const def = a.race!, [x, y] = def.points[o.i];
    const diff = Math.atan2(y - c.y, x - c.x) - c.a;
    const d = Math.atan2(Math.sin(diff), Math.cos(diff));
    c.steer = Math.max(-1, Math.min(1, d * 2.4));
    c.throttle = c.vF < c.cruise * (Math.abs(d) > 0.6 ? 0.55 : 1) ? 1 : 0;
    c.handbrake = Math.abs(d) > 1.2 && c.vF > 250;
    if (Math.hypot(x - c.x, y - c.y) < 80) { o.i++; if (o.i >= def.points.length) { o.done = true; o.i = def.points.length; } }
    return true;
  }

  private stunt(a: ActiveJob, dt: number) {
    const g = this.g, s = STUNT_PARK;
    if (!this.inPark()) { g.objective = "Stunt: Fahr in den Stunt-Park"; this.markers.push({ x: s.x0 - 60, y: (s.y0 + s.y1) / 2, color: "#ffd23f", kind: "goal", label: "" }); if (a.timer > 0) a.timer += dt; return; }
    if (a.task === "jump") g.objective = `Stunt: Spring ${a.goal} m weit (bisher ${a.best.toFixed(1).replace(".", ",")} m)`;
    else if (a.task === "drift") {
      g.objective = `Stunt: Driftpunkte ${fmt(Math.round(a.best + g.driftPts))}/${fmt(a.goal)}`;
      if (a.best + g.driftPts >= a.goal) this.payStunt(`${fmt(a.goal)} Driftpunkte`);
    } else {
      const [x, y] = a.checks[a.raceI];
      g.objective = `Stunt: Zeitfahrt – Tor ${a.raceI + 1}/${a.checks.length}`;
      this.markers.push({ x, y, color: "#2bf0ff", kind: "race", label: String(a.raceI + 1) });
      if (Math.hypot(x - g.fx, y - g.fy) < 70) { a.raceI++; sfx.checkpoint(); if (a.raceI >= a.checks.length) this.payStunt(`Zeitfahrt ${(a.goal - a.timer).toFixed(1).replace(".", ",")} s`); }
    }
  }

  // ---------------- free races (start points on the map) and collectibles
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
  }

  // called by the game when the player's car lands after airtime
  landed(airT: number, ramp: number) {
    const g = this.g;
    const j = this.jumps.find((x) => x.ramp === ramp);
    if (!j || airT < JUMP_AIR || g.progress.jumps.includes(j.id)) return;
    g.progress.jumps.push(j.id);
    g.addCash(JUMP_REWARD);
    sfx.success();
    g.banner("STUNTSPRUNG", `${g.progress.jumps.length}/${this.jumps.length} · +$${JUMP_REWARD}`, "#2bf0ff", 2);
    g.saveSoon();
  }
}
void isHeli;
