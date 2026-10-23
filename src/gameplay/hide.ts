import { sfx } from "../audio/audio";
import { BLOCK, ROAD, WORLD, COAST, isWater, mulberry32, type World } from "../world/world";
import type { Civilian } from "../ai/peds";
import type { Marker } from "./missions";
import type { Place } from "../world/places";
import type { Car } from "../vehicles/vehicles";
import type { Game } from "../core/engine";

// ---------------------------------------------------------------- fields, modes, difficulty
export type HideMode = "hide" | "seek" | "tag";
export type HideDiff = "easy" | "normal" | "hard";
export type SpotKind = "bin" | "toilet" | "bush" | "chair" | "wardrobe" | "car";
export interface HideSpot { x: number; y: number; kind: SpotKind; range: number; } // range: how close a seeker must come to find you there
export interface HideField { id: string; name: string; x: number; y: number; r: number; night?: boolean; spots: HideSpot[]; desc: string; }
export const MODE_NAME: Record<HideMode, string> = { hide: "Verstecken", seek: "Suchen", tag: "Fangen" };
export const MODE_RULES: Record<HideMode, string[]> = {
  hide: ["Die Sucher zählen bis 8 – such dir in der Zeit ein Versteck.", "In Mülltonnen, Dixi-Klos, Strandkörben, Schränken, im Gebüsch oder unter Autos (E) sieht man dich kaum.", "Lass dich bis zum Ende der Zeit nicht abschlagen."],
  seek: ["Ein paar Leute verstecken sich im Spielfeld.", "Geh nah an Verstecke heran und sieh nach (E oder berühren).", "Finde alle, bevor die Zeit abläuft."],
  tag: ["Einer ist „es“ und jagt die anderen.", "Wer berührt wird, ist „es“ – dann musst du jemanden abschlagen.", "Wer am Ende der Runde nicht „es“ ist, gewinnt die Runde."],
};
export const DIFF_NAME: Record<HideDiff, string> = { easy: "Leicht", normal: "Normal", hard: "Schwer" };
interface DiffDef { seekers: number; walk: number; run: number; cone: number; see: number; hearSprint: number; reward: number; hidden: number; }
const DIFFS: Record<HideDiff, DiffDef> = {
  easy: { seekers: 3, walk: 58, run: 160, cone: 0.75, see: 220, hearSprint: 0, reward: 200, hidden: 26 },
  normal: { seekers: 4, walk: 72, run: 182, cone: 0.95, see: 270, hearSprint: 0, reward: 350, hidden: 32 },
  hard: { seekers: 6, walk: 86, run: 205, cone: 1.1, see: 320, hearSprint: 150, reward: 600, hidden: 38 },
};
export const ROUND_CHOICES = [3, 5, 7];
const SPOT_RANGE: Record<SpotKind, number> = { bin: 22, toilet: 16, bush: 30, chair: 24, wardrobe: 14, car: 28 };
export const SPOT_NAME: Record<SpotKind, string> = { bin: "Mülltonne", toilet: "Dixi-Klo", bush: "Gebüsch", chair: "Strandkorb", wardrobe: "Schrank", car: "unter dem Auto" };
// the mall block (its interior is a playing field, see the shops)
export const MALL_BLOCK: [number, number] = [9, 9];

// deterministic: the renderer draws the same spots
export function buildHideFields(world: World): HideField[] {
  const r = mulberry32(919);
  const fields: HideField[] = [];
  const blockC = (bx: number, by: number) => ({ x: bx * BLOCK + ROAD + (BLOCK - ROAD) / 2, y: by * BLOCK + ROAD + (BLOCK - ROAD) / 2 });
  const free = (x: number, y: number, list: HideSpot[]) => !world.isSolid(x, y, 10) && !isWater(x, y) && !world.nearRamp(x, y, 20) && !world.isCityRoad(x, y) && list.every((s) => Math.hypot(s.x - x, s.y - y) > 40);
  const scatter = (f: HideField, kind: SpotKind, n: number, tries = 200) => {
    for (let k = 0; k < tries && n > 0; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * f.r * 0.92, x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d;
      if (!free(x, y, f.spots)) continue;
      f.spots.push({ x, y, kind, range: SPOT_RANGE[kind] }); n--;
    }
  };
  // 1 city park (the old one), trees give bushes
  let park = world.blocks[0], pd = Infinity;
  for (const b of world.blocks) { const d = Math.hypot(b.bx - 9, b.by - 10); if (b.kind === "park" && d < pd) { pd = d; park = b; } }
  const pc = blockC(park.bx, park.by);
  const pf: HideField = { id: "park", name: "Stadtpark", x: pc.x, y: pc.y, r: 300, spots: [], desc: "Bäume, Hecken, Brunnen" };
  for (const t of park.trees) { const a = r() * 6.28; const x = t.x + Math.cos(a) * (t.r + 8), y = t.y + Math.sin(a) * (t.r + 8); if (free(x, y, pf.spots)) pf.spots.push({ x, y, kind: "bush", range: SPOT_RANGE.bush }); }
  scatter(pf, "bin", 4); scatter(pf, "toilet", 2);
  fields.push(pf);
  // 2 harbour: containers and warehouses
  const hf: HideField = { id: "harbor", name: "Hafen", x: WORLD + 60, y: 11.2 * BLOCK, r: 330, spots: [], desc: "Container, Lagerhallen, Kräne" };
  scatter(hf, "bin", 6); scatter(hf, "toilet", 3);
  fields.push(hf);
  // 3 old town: alleys and back yards
  const oc = blockC(3, 6);
  const of: HideField = { id: "oldtown", name: "Altstadt", x: oc.x, y: oc.y, r: 330, spots: [], desc: "Gassen, Hinterhöfe, Torbögen" };
  scatter(of, "bin", 8); scatter(of, "bush", 3);
  fields.push(of);
  // 4 mall (inside, see the shop interiors)
  const mc = blockC(MALL_BLOCK[0], MALL_BLOCK[1]);
  const mf: HideField = { id: "mall", name: "Einkaufszentrum", x: mc.x, y: mc.y, r: 200, spots: [], desc: "Drei Etagen, Rolltreppen, Aufzug, Läden" };
  // inside the mall walls (inner half size about 130), clear of the escalators and the food court
  for (const [dx, dy, k] of [[-115, -60, "wardrobe"], [115, -60, "wardrobe"], [-115, 60, "wardrobe"], [115, 60, "wardrobe"], [-100, 118, "bin"], [100, 118, "bin"], [0, -118, "wardrobe"], [-90, -20, "bin"], [90, -20, "bin"]] as [number, number, SpotKind][]) mf.spots.push({ x: mc.x + dx, y: mc.y + dy, kind: k, range: SPOT_RANGE[k] });
  fields.push(mf);
  // 5 beach at night: beach chairs, boats, dunes
  const bf: HideField = { id: "beach", name: "Strand bei Nacht", x: -130, y: 2600, r: 330, night: true, spots: [], desc: "Strandkörbe, Boote, Dunkelheit" };
  for (let y = bf.y - 280; y < bf.y + 280; y += 70) { const x = -60 - r() * 150; if (free(x, y, bf.spots) && x > COAST.west + 20) bf.spots.push({ x, y, kind: "chair", range: SPOT_RANGE.chair }); }
  scatter(bf, "bush", 3);
  fields.push(bf);
  return fields;
}

// ---------------------------------------------------------------- the game
interface Seeker { c: Civilian; tx: number; ty: number; chase: boolean; lostT: number; retarget: number; react: number; saw: boolean; }
interface HideState {
  field: HideField; mode: HideMode; diff: HideDiff; rounds: number;
  x: number; y: number; round: number; t: number; countdown: number; won: number;
  seekers: Seeker[]; seenT: number;   // hide: seconds since a seeker last saw you
  hidden: Civilian[];                 // seek: people still hidden
  it: number; immune: number;         // tag: who is "it" (-1: the player), short protection after a change
}
const COUNTDOWN = 8, LOSE_SIGHT = 3, REACT = 0.7, TAG = 16, HEAR = 38;
const SEEKER_LOOK = { shirt: "#3dff8b", pants: "#1c2a22" };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export class HideSeek {
  active: HideState | null = null;
  markers: Marker[] = [];
  fields: HideField[];
  // settings of the next game (tab "Verstecken")
  mode: HideMode = "hide"; diff: HideDiff = "normal"; rounds = 3;
  pending: { field: HideField } | null = null; // waypoint set: starts when you walk into the field
  spot: HideSpot | null = null;               // the hiding spot you are in
  spotCar: Car | null = null;

  constructor(private g: Game) { this.fields = buildHideFields(g.world); }

  get busy() { return !!this.active; }
  recordKey(f: HideField, mode = this.mode, diff = this.diff) { return `hide_${f.id}_${mode}_${diff}`; }
  record(f: HideField, mode = this.mode, diff = this.diff) { return this.g.progress.records[this.recordKey(f, mode, diff)] ?? 0; }

  blocked(): string | null {
    const g = this.g;
    if (!g.rules.city) return "Nur in der Open World";
    if (this.active) return "Es läuft schon ein Versteckspiel";
    if (g.wanted.stars > 0) return "Mit der Polizei im Nacken spielt keiner mit";
    if (g.missions.active || g.jobs.busy) return "Erst den laufenden Auftrag beenden";
    return null;
  }

  // tab / phone: bring me there now (short fade) or set a waypoint
  play(fieldId: string, now: boolean): string {
    const g = this.g, f = this.fields.find((q) => q.id === fieldId);
    if (!f) return "Unbekanntes Spielfeld";
    const why = this.blocked();
    if (why) return why;
    if (!now) { g.setWaypoint(f.x, f.y); this.pending = { field: f }; return `Wegpunkt gesetzt: ${f.name} – das Spiel startet, wenn du zu Fuß ankommst`; }
    g.teleportOnFoot(f.x, f.y + (f.id === "mall" ? 0 : 0));
    this.begin(f);
    return `${f.name}: ${MODE_NAME[this.mode]} · ${DIFF_NAME[this.diff]}`;
  }
  // the old start point in the park (E)
  start(pl: Place) { void pl; const why = this.blocked(); if (why) { this.g.hintMsg(why); return; } this.begin(this.fields[0]); }

  private begin(f: HideField) {
    const g = this.g;
    this.pending = null;
    if (f.night && !g.isNight) { g.clock = 22; g.hintMsg("Es ist Nacht am Strand"); }
    this.active = { field: f, mode: this.mode, diff: this.diff, rounds: this.rounds, x: f.x, y: f.y, round: 0, t: 0, countdown: COUNTDOWN, won: 0, seekers: [], seenT: 99, hidden: [], it: 0, immune: 0 };
    this.beginRound();
  }

  private spawn(x: number, y: number) {
    const c = this.g.peds.spawnRole("seeker", x, y);
    if (!c) return null;
    c.tag = "seeker"; c.shirt = SEEKER_LOOK.shirt; c.pants = SEEKER_LOOK.pants; c.state = "idle";
    return c;
  }

  private beginRound() {
    const a = this.active!, g = this.g, d = DIFFS[a.diff];
    this.clearPeople();
    a.countdown = a.mode === "hide" ? COUNTDOWN : 3; a.seenT = 99; a.immune = 0;
    if (a.mode === "hide") {
      a.t = 45 + a.round * 5;
      for (let i = 0; i < d.seekers; i++) {
        const ang = (i / d.seekers) * Math.PI * 2;
        const c = this.spawn(a.x + Math.cos(ang) * 22, a.y + Math.sin(ang) * 22);
        if (!c) continue;
        c.a = ang + Math.PI; // face the middle (eyes closed)
        a.seekers.push({ c, tx: c.x, ty: c.y, chase: false, lostT: 0, retarget: 0, react: 0, saw: false });
      }
      g.banner(`RUNDE ${a.round + 1}/${a.rounds}`, `Versteck dich! ${a.seekers.length} Sucher zählen bis ${COUNTDOWN}`, "#3dff8b", 2.4);
    } else if (a.mode === "seek") {
      a.t = 70 + a.round * 5;
      const n = Math.min(6, 3 + Math.floor(a.round / 2) + (a.diff === "hard" ? 1 : 0));
      const spots = [...a.field.spots].sort(() => Math.random() - 0.5).slice(0, n);
      for (const s of spots) { const c = this.spawn(s.x, s.y); if (c) { c.tag = "hiding"; c.shirt = "#ffd23f"; a.hidden.push(c); } }
      g.banner(`RUNDE ${a.round + 1}/${a.rounds}`, `Finde ${a.hidden.length} Versteckte`, "#3dff8b", 2.4);
    } else {
      a.t = 50;
      for (let i = 0; i < 3 + (a.diff === "hard" ? 1 : 0); i++) {
        const ang = (i / 4) * Math.PI * 2;
        const c = this.spawn(a.x + Math.cos(ang) * 90, a.y + Math.sin(ang) * 90);
        if (c) a.seekers.push({ c, tx: c.x, ty: c.y, chase: false, lostT: 0, retarget: 0, react: 0, saw: false });
      }
      a.it = 0; // the first NPC starts as "it"
      g.banner(`RUNDE ${a.round + 1}/${a.rounds}`, "Fangen: weg vom „es“!", "#3dff8b", 2.4);
    }
    sfx.checkpoint();
  }

  private clearPeople() {
    const a = this.active;
    if (!a) return;
    for (const s of a.seekers) { s.c.active = false; s.c.tag = ""; }
    for (const c of a.hidden) { c.active = false; c.tag = ""; }
    a.seekers.length = 0; a.hidden.length = 0;
  }

  stop(reason: string, won = false) {
    const a = this.active;
    if (!a) return;
    const g = this.g;
    this.leaveSpot();
    this.clearPeople();
    this.active = null;
    this.markers.length = 0;
    g.objective = ""; g.objTimer = -1;
    const key = this.recordKey(a.field, a.mode, a.diff), rec = g.progress.records[key] ?? 0;
    if (a.won > rec) g.progress.records[key] = a.won;
    if (!won) sfx.fail();
    g.banner(won ? "GESCHAFFT!" : "VERSTECKSPIEL VORBEI", `${reason} · ${a.won}/${a.rounds} Runden${a.won > rec ? " · neuer Rekord" : ""}`, won ? "#3dff8b" : "#ff9f43", 2.6);
    g.saveSoon();
  }

  // ---------------- hiding spots (E)
  nearSpot(): HideSpot | null {
    const g = this.g, a = this.active;
    if (!a || a.mode !== "hide" || !g.onFoot) return null;
    for (const s of a.field.spots) if (Math.hypot(s.x - g.fx, s.y - g.fy) < 26) return s;
    for (const c of g.cars) if (c.parked && !c.dead && Math.hypot(c.x - g.fx, c.y - g.fy) < c.hl + 8 && Math.hypot(c.x - a.x, c.y - a.y) < a.field.r) return { x: c.x, y: c.y, kind: "car", range: SPOT_RANGE.car };
    return null;
  }
  interact(): boolean {
    if (this.spot) { this.leaveSpot(); return true; }
    const a = this.active, g = this.g;
    if (!a) return false;
    if (a.mode === "seek") {
      // look into the spot in front of you
      const c = a.hidden.find((h) => h.active && Math.hypot(h.x - g.fx, h.y - g.fy) < 30);
      if (c) { this.found(c); return true; }
      return false;
    }
    const s = this.nearSpot();
    if (!s) return false;
    this.spot = s;
    this.spotCar = s.kind === "car" ? g.cars.find((c) => c.x === s.x && c.y === s.y) ?? null : null;
    const pd = g.ped;
    pd.x = s.x; pd.y = s.y; pd.vx = 0; pd.vy = 0;
    sfx.door();
    g.hintMsg(`Versteckt: ${SPOT_NAME[s.kind]} – E zum Rauskommen`);
    return true;
  }
  leaveSpot() {
    if (!this.spot) return;
    const g = this.g, s = this.spot;
    this.spot = null; this.spotCar = null;
    // step out next to the spot
    for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2, x = s.x + Math.cos(ang) * 22, y = s.y + Math.sin(ang) * 22; if (!g.world.isSolid(x, y, 8)) { g.ped.x = x; g.ped.y = y; break; } }
  }
  // the player is inside a spot (drawn hidden, cannot move)
  get hiddenIn() { return this.spot; }

  private found(c: Civilian) {
    const a = this.active!;
    c.active = false; c.tag = "";
    sfx.pickup(2);
    this.g.hintMsg(`Gefunden! Noch ${a.hidden.filter((h) => h.active).length}`);
  }

  // how close a seeker has to be to notice you right now
  private seeRange(d: DiffDef): number {
    const g = this.g;
    if (this.spot) return this.spot.range;
    if (!g.onFoot) return g.player.speed < 20 && this.active!.seenT > 2 ? d.hidden : d.see; // got into the car unseen
    const still = g.fspeed < 30;
    if (still && g.world.treeAt(g.fx, g.fy)) return d.hidden; // under a tree canopy
    return d.see * (this.active!.field.night ? 0.6 : 1);
  }

  private sees(s: Seeker, range: number, d: DiffDef): boolean {
    const g = this.g, c = s.c;
    const dx = g.fx - c.x, dy = g.fy - c.y, dist = Math.hypot(dx, dy);
    if (!this.spot && g.ped.sprint && g.fspeed > 180 && dist < d.hearSprint) return true; // hard: they hear you sprint
    if (dist < HEAR && !this.spot && (g.fspeed > 30 || range === d.see)) return true;
    if (dist > range) return false;
    if (Math.abs(wrap(Math.atan2(dy, dx) - c.a)) > d.cone && dist > HEAR) return false;
    return g.world.lineClear(c.x, c.y, g.fx, g.fy, 30);
  }

  update(dt: number) {
    const a = this.active, g = this.g;
    this.markers.length = 0;
    if (!a) {
      const p = this.pending;
      if (p) {
        this.markers.push({ x: p.field.x, y: p.field.y, color: "#3dff8b", kind: "goal", label: "V" });
        if (g.onFoot && Math.hypot(g.fx - p.field.x, g.fy - p.field.y) < p.field.r * 0.6 && !this.blocked()) this.begin(p.field);
      }
      return;
    }
    const d = DIFFS[a.diff];
    if (g.wanted.stars > 0) { this.stop("Die Polizei hat das Spiel gesprengt"); return; }
    if (Math.hypot(g.fx - a.x, g.fy - a.y) > a.field.r + 120) { this.stop("Du hast das Spielfeld verlassen"); return; }
    // only knocking someone down on purpose ends the game (pushing past them does not)
    for (const s of a.seekers) if (!s.c.active || s.c.state === "down") { this.stop("Ein Mitspieler wurde verletzt – das Spiel ist aus"); return; }
    this.markers.push({ x: a.x, y: a.y, color: "#3dff8b", kind: "goal", label: "V" });
    if (this.spot) { g.ped.x = this.spot.x; g.ped.y = this.spot.y; g.ped.vx = 0; g.ped.vy = 0; }
    if (a.countdown > 0) {
      a.countdown -= dt;
      g.objective = a.mode === "hide" ? `Versteckspiel: Versteck dich! Noch ${Math.ceil(a.countdown)} s` : `${MODE_NAME[a.mode]}: gleich geht's los … ${Math.ceil(a.countdown)}`;
      g.objTimer = -1;
      return;
    }
    a.t -= dt; a.seenT += dt;
    g.objTimer = Math.max(0, a.t);
    if (a.mode === "hide") this.updateHide(a, d, dt);
    else if (a.mode === "seek") this.updateSeek(a, d);
    else this.updateTag(a, d, dt);
    if (!this.active) return;
    if (a.t <= 0) {
      const won = a.mode === "seek" ? a.hidden.every((h) => !h.active) : a.mode === "tag" ? a.it >= 0 : true;
      if (!won) { this.stop(a.mode === "seek" ? "Nicht alle gefunden" : "Du warst am Ende „es“"); return; }
      this.roundWon(a, d);
    }
  }

  private roundWon(a: HideState, d: DiffDef) {
    const g = this.g;
    a.won++;
    const reward = Math.round(d.reward * (1 + a.round * 0.25));
    g.addCash(reward); sfx.success();
    if (a.round + 1 >= a.rounds) { this.stop(`+$${reward}`, true); return; }
    g.banner("RUNDE GESCHAFFT", `+$${reward}`, "#3dff8b", 1.8);
    a.round++;
    this.leaveSpot();
    this.beginRound();
  }

  private updateHide(a: HideState, d: DiffDef, dt: number) {
    const g = this.g;
    g.objective = `Verstecken · Runde ${a.round + 1}/${a.rounds}: Lass dich nicht finden${this.spot ? ` (${SPOT_NAME[this.spot.kind]})` : ""}`;
    const range = this.seeRange(d);
    for (const s of a.seekers) {
      const c = s.c;
      this.markers.push({ x: c.x, y: c.y, color: s.chase ? "#ff4d4d" : "#3dff8b", kind: "enemy", label: "" });
      if (this.sees(s, range, d)) {
        if (!s.chase) { g.hintMsg("GESEHEN – lauf weg!"); sfx.beep(); s.react = REACT; }
        s.chase = true; s.lostT = 0; s.tx = g.fx; s.ty = g.fy; a.seenT = 0;
        if (this.spot && Math.hypot(g.fx - c.x, g.fy - c.y) < this.spot.range) { this.stop(`Gefunden: ${SPOT_NAME[this.spot.kind]}`); return; }
      } else if (s.chase) { s.lostT += dt; if (s.lostT > LOSE_SIGHT) { s.chase = false; s.retarget = 0; } }
      s.saw = s.chase;
      // tagged?
      if (Math.hypot(g.fx - c.x, g.fy - c.y) < (g.onFoot ? TAG : 30) && (s.chase || g.onFoot) && !this.spot) { this.stop("Abgeschlagen!"); return; }
      // search: walk to random spots (hiding spots first, near where you were seen last)
      s.retarget -= dt;
      if (!s.chase && (s.retarget <= 0 || Math.hypot(s.tx - c.x, s.ty - c.y) < 20)) {
        const near = a.seenT < 12;
        if (!near && Math.random() < 0.5 && a.field.spots.length) { const sp = a.field.spots[Math.floor(Math.random() * a.field.spots.length)]; s.tx = sp.x + rnd(-20, 20); s.ty = sp.y + rnd(-20, 20); }
        else {
          const cx = near ? g.fx + rnd(-140, 140) : a.x, cy = near ? g.fy + rnd(-140, 140) : a.y, rr = near ? 60 : a.field.r * 0.85;
          const ang = Math.random() * Math.PI * 2, dd = Math.sqrt(Math.random()) * rr;
          s.tx = cx + Math.cos(ang) * dd; s.ty = cy + Math.sin(ang) * dd;
        }
        s.retarget = rnd(4, 8);
      }
      if (s.react > 0) { s.react -= dt; c.vx = 0; c.vy = 0; c.a = Math.atan2(g.fy - c.y, g.fx - c.x); continue; }
      this.walk(c, s.tx, s.ty, s.chase ? d.run : d.walk, dt);
      if (!s.chase) c.a += Math.sin(g.t * 1.3 + c.look) * dt * 1.4; // look around while searching
    }
  }

  private updateSeek(a: HideState, d: DiffDef) {
    const g = this.g;
    const left = a.hidden.filter((h) => h.active);
    g.objective = `Suchen · Runde ${a.round + 1}/${a.rounds}: ${left.length} noch versteckt`;
    for (const c of left) {
      c.vx = 0; c.vy = 0;
      if (Math.hypot(c.x - g.fx, c.y - g.fy) < 16) this.found(c); // touched
    }
    if (!left.some((h) => h.active)) { this.roundWon(a, d); return; }
  }

  private updateTag(a: HideState, d: DiffDef, dt: number) {
    const g = this.g;
    a.immune = Math.max(0, a.immune - dt);
    const itC = a.it >= 0 ? a.seekers[a.it]?.c : null;
    g.objective = `Fangen · Runde ${a.round + 1}/${a.rounds}: ${a.it < 0 ? "DU bist „es“ – schlag jemanden ab!" : "Lauf weg vom „es“!"}`;
    a.seekers.forEach((s, i) => {
      const c = s.c, isIt = i === a.it;
      this.markers.push({ x: c.x, y: c.y, color: isIt ? "#ff4d4d" : "#3dff8b", kind: "enemy", label: isIt ? "!" : "" });
      s.saw = isIt;
      if (isIt) {
        // chase the nearest one (the player counts)
        let tx = g.fx, ty = g.fy, best = Math.hypot(g.fx - c.x, g.fy - c.y);
        a.seekers.forEach((o, j) => { if (j !== i) { const dd = Math.hypot(o.c.x - c.x, o.c.y - c.y); if (dd < best * 0.8) { best = dd; tx = o.c.x; ty = o.c.y; } } });
        this.walk(c, tx, ty, d.run, dt);
        if (a.immune <= 0 && Math.hypot(g.fx - c.x, g.fy - c.y) < TAG) { a.it = -1; a.immune = 2; sfx.beep(); g.hintMsg("Du bist „es“!"); }
        else if (a.immune <= 0) a.seekers.forEach((o, j) => { if (j !== i && a.immune <= 0 && Math.hypot(o.c.x - c.x, o.c.y - c.y) < TAG) { a.it = j; a.immune = 2; } });
      } else {
        // run away from "it", stay inside the field
        const fx = itC ? itC.x : g.fx, fy = itC ? itC.y : g.fy;
        const away = Math.atan2(c.y - fy, c.x - fx), back = Math.hypot(c.x - a.x, c.y - a.y) > a.field.r * 0.75;
        const ang = back ? Math.atan2(a.y - c.y, a.x - c.x) : away + Math.sin(g.t + c.look) * 0.6;
        const dist = Math.hypot(c.x - fx, c.y - fy);
        this.walk(c, c.x + Math.cos(ang) * 60, c.y + Math.sin(ang) * 60, dist < 200 ? d.run * 0.9 : d.walk, dt);
        if (a.it < 0 && a.immune <= 0 && Math.hypot(g.fx - c.x, g.fy - c.y) < TAG) { a.it = i; a.immune = 2; sfx.pickup(1); g.hintMsg("Abgeschlagen – lauf!"); }
      }
    });
  }

  // seekers walk around buildings and trees like everybody else
  private walk(c: Civilian, tx: number, ty: number, speed: number, dt: number) {
    const w = this.g.world;
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    if (d < 4) { c.vx = 0; c.vy = 0; return; }
    const want = Math.atan2(dy, dx);
    c.a += wrap(want - c.a) * Math.min(1, dt * 8);
    let mx = (dx / d) * speed * dt, my = (dy / d) * speed * dt;
    const bad = (x: number, y: number) => w.isSolid(x, y, 5) || w.treeHit(x, y, 5) || isWater(x, y);
    if (bad(c.x + mx, c.y + my)) {
      const l = want + 1.2, rgt = want - 1.2, s = speed * dt;
      if (!bad(c.x + Math.cos(l) * s, c.y + Math.sin(l) * s)) { mx = Math.cos(l) * s; my = Math.sin(l) * s; }
      else if (!bad(c.x + Math.cos(rgt) * s, c.y + Math.sin(rgt) * s)) { mx = Math.cos(rgt) * s; my = Math.sin(rgt) * s; }
      else { mx = 0; my = 0; }
    }
    c.x += mx; c.y += my;
    c.vx = mx / dt; c.vy = my / dt;
    c.walk += dt * speed * 0.05;
  }
}
export const HIDE_RADIUS = 330;
