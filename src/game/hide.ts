import { sfx } from "./audio";
import type { Civilian } from "./peds";
import type { Marker } from "./missions";
import type { Place } from "./places";
import type { Game } from "./engine";

// hide and seek in the park: computer seekers look for you, stay hidden until the time runs out
export interface HideRound { seekers: number; time: number; reward: number; }
export const HIDE_ROUNDS: HideRound[] = [
  { seekers: 3, time: 45, reward: 250 },
  { seekers: 4, time: 60, reward: 500 },
  { seekers: 5, time: 75, reward: 1000 },
];
export const HIDE_RADIUS = 560;            // playing field around the park
const COUNTDOWN = 8;                       // seconds to hide before they start looking
const SEE_RANGE = 270, SEE_CONE = 0.95, HEAR = 38, TAG = 16;
const HIDDEN_RANGE = 32;                   // under a tree or in a parked car they only spot you this close
const WALK = 72, RUN = 182;                // you sprint faster (250), walking is slower (165)
const LOSE_SIGHT = 3;                      // seconds a chasing seeker keeps going to where it saw you last
const REACT = 0.7;                         // a seeker that spots you shouts first (your head start)
const SEEKER_LOOK = { shirt: "#3dff8b", pants: "#1c2a22" };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

interface Seeker { c: Civilian; tx: number; ty: number; chase: boolean; lostT: number; retarget: number; react: number; }
interface HideState {
  x: number; y: number; round: number; t: number; countdown: number;
  seekers: Seeker[]; seenT: number; // seconds since a seeker last saw you
}

export class HideSeek {
  active: HideState | null = null;
  markers: Marker[] = [];

  constructor(private g: Game) {}

  get busy() { return !!this.active; }

  start(pl: Place) {
    const g = this.g;
    if (this.active) return;
    if (g.wanted.stars > 0) { g.hintMsg("Mit der Polizei im Nacken spielt keiner mit"); return; }
    if (g.missions.active || g.jobs.busy) { g.hintMsg("Erst den laufenden Auftrag beenden"); return; }
    this.active = { x: pl.cx, y: pl.cy, round: 0, t: 0, countdown: COUNTDOWN, seekers: [], seenT: 99 };
    this.beginRound();
  }

  private beginRound() {
    const a = this.active!, g = this.g, r = HIDE_ROUNDS[a.round];
    this.clearSeekers();
    a.t = r.time; a.countdown = COUNTDOWN; a.seenT = 99;
    for (let i = 0; i < r.seekers; i++) {
      const ang = (i / r.seekers) * Math.PI * 2;
      const c = g.peds.spawnRole("seeker", a.x + Math.cos(ang) * 22, a.y + Math.sin(ang) * 22);
      if (!c) continue;
      c.tag = "seeker"; c.shirt = SEEKER_LOOK.shirt; c.pants = SEEKER_LOOK.pants; c.state = "idle";
      c.a = ang + Math.PI; // face the middle (eyes closed)
      a.seekers.push({ c, tx: c.x, ty: c.y, chase: false, lostT: 0, retarget: 0, react: 0 });
    }
    sfx.checkpoint();
    g.banner(`RUNDE ${a.round + 1}/${HIDE_ROUNDS.length}`, `Versteck dich! ${r.seekers} Sucher zählen bis ${COUNTDOWN}`, "#3dff8b", 2.4);
  }

  private clearSeekers() {
    const a = this.active;
    if (!a) return;
    for (const s of a.seekers) { s.c.active = false; s.c.tag = ""; }
    a.seekers.length = 0;
  }

  stop(reason: string, won = false) {
    const a = this.active;
    if (!a) return;
    const g = this.g;
    this.clearSeekers();
    this.active = null;
    this.markers.length = 0;
    g.objective = ""; g.objTimer = -1;
    const rounds = won ? HIDE_ROUNDS.length : a.round;
    const rec = g.progress.records.hide ?? 0;
    if (rounds > rec) g.progress.records.hide = rounds;
    if (!won) sfx.fail();
    g.banner(won ? "NICHT GEFUNDEN!" : "VERSTECKSPIEL VORBEI", `${reason} · ${rounds}/${HIDE_ROUNDS.length} Runden${rounds > rec ? " · neuer Rekord" : ""}`, won ? "#3dff8b" : "#ff9f43", 2.6);
    g.saveSoon();
  }

  // how close a seeker has to be to notice you right now
  private seeRange(): number {
    const g = this.g;
    if (!g.onFoot) return g.player.speed < 20 && this.active!.seenT > 2 ? HIDDEN_RANGE : SEE_RANGE; // got into the car unseen
    const still = g.fspeed < 30;
    if (still && g.world.treeAt(g.fx, g.fy)) return HIDDEN_RANGE; // under a tree canopy
    return SEE_RANGE;
  }

  private sees(s: Seeker, range: number): boolean {
    const g = this.g, c = s.c;
    const dx = g.fx - c.x, dy = g.fy - c.y, d = Math.hypot(dx, dy);
    if (d < HEAR && (g.fspeed > 30 || range === SEE_RANGE)) return true;
    if (d > range) return false;
    if (Math.abs(wrap(Math.atan2(dy, dx) - c.a)) > SEE_CONE && d > HEAR) return false;
    return g.world.lineClear(c.x, c.y, g.fx, g.fy, 30);
  }

  update(dt: number) {
    const a = this.active, g = this.g;
    this.markers.length = 0;
    if (!a) return;
    if (g.wanted.stars > 0) { this.stop("Die Polizei hat das Spiel gesprengt"); return; }
    if (Math.hypot(g.fx - a.x, g.fy - a.y) > HIDE_RADIUS) { this.stop("Du hast das Spielfeld verlassen"); return; }
    for (const s of a.seekers) if (!s.c.active || s.c.state === "down") { this.stop("Ein Sucher wurde verletzt – das Spiel ist aus"); return; }
    const r = HIDE_ROUNDS[a.round];
    this.markers.push({ x: a.x, y: a.y, color: "#3dff8b", kind: "goal", label: "V" });
    for (const s of a.seekers) this.markers.push({ x: s.c.x, y: s.c.y, color: s.chase ? "#ff4d4d" : "#3dff8b", kind: "enemy", label: "" });
    if (a.countdown > 0) {
      a.countdown -= dt;
      g.objective = `Versteckspiel: Versteck dich! Noch ${Math.ceil(a.countdown)} s`;
      g.objTimer = -1;
      return;
    }
    a.t -= dt; a.seenT += dt;
    g.objective = `Versteckspiel Runde ${a.round + 1}/${HIDE_ROUNDS.length}: Lass dich nicht finden`;
    g.objTimer = Math.max(0, a.t);
    const range = this.seeRange();
    for (const s of a.seekers) {
      const c = s.c;
      if (this.sees(s, range)) {
        if (!s.chase) { g.hintMsg("👀 GESEHEN – lauf weg!"); sfx.beep(); s.react = REACT; }
        s.chase = true; s.lostT = 0; s.tx = g.fx; s.ty = g.fy; a.seenT = 0;
      } else if (s.chase) {
        s.lostT += dt;
        if (s.lostT > LOSE_SIGHT) { s.chase = false; s.retarget = 0; }
      }
      // tagged?
      if (Math.hypot(g.fx - c.x, g.fy - c.y) < (g.onFoot ? TAG : 30) && (s.chase || g.onFoot)) { this.stop("Abgeschlagen!"); return; }
      // search: walk to random spots in the field (near where you were seen last, if they saw you)
      s.retarget -= dt;
      if (!s.chase && (s.retarget <= 0 || Math.hypot(s.tx - c.x, s.ty - c.y) < 20)) {
        const near = a.seenT < 12;
        const cx = near ? g.fx + rnd(-140, 140) : a.x, cy = near ? g.fy + rnd(-140, 140) : a.y, rr = near ? 60 : HIDE_RADIUS * 0.85;
        const ang = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * rr;
        s.tx = cx + Math.cos(ang) * d; s.ty = cy + Math.sin(ang) * d;
        s.retarget = rnd(4, 8);
      }
      if (s.react > 0) { s.react -= dt; c.vx = 0; c.vy = 0; c.a = Math.atan2(g.fy - c.y, g.fx - c.x); continue; }
      this.walk(c, s.tx, s.ty, s.chase ? RUN : WALK, dt);
      if (!s.chase) c.a += Math.sin(g.t * 1.3 + c.look) * dt * 0.8; // look around while searching
    }
    if (a.t <= 0) {
      g.addCash(r.reward); sfx.success();
      if (a.round + 1 >= HIDE_ROUNDS.length) { this.stop(`+$${r.reward}`, true); return; }
      g.banner("RUNDE GESCHAFFT", `+$${r.reward}`, "#3dff8b", 1.8);
      a.round++;
      this.beginRound();
    }
  }

  // seekers walk around buildings and trees like everybody else
  private walk(c: Civilian, tx: number, ty: number, speed: number, dt: number) {
    const w = this.g.world;
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    if (d < 4) { c.vx = 0; c.vy = 0; return; }
    const want = Math.atan2(dy, dx);
    c.a += wrap(want - c.a) * Math.min(1, dt * 8);
    let mx = (dx / d) * speed * dt, my = (dy / d) * speed * dt;
    if (w.isSolid(c.x + mx, c.y + my, 5) || w.treeHit(c.x + mx, c.y + my, 5)) {
      // slide around: try left, then right
      const l = want + 1.2, rgt = want - 1.2, s = speed * dt;
      if (!w.isSolid(c.x + Math.cos(l) * s, c.y + Math.sin(l) * s, 5)) { mx = Math.cos(l) * s; my = Math.sin(l) * s; }
      else if (!w.isSolid(c.x + Math.cos(rgt) * s, c.y + Math.sin(rgt) * s, 5)) { mx = Math.cos(rgt) * s; my = Math.sin(rgt) * s; }
      else { mx = 0; my = 0; }
    }
    c.x += mx; c.y += my;
    c.vx = mx / dt; c.vy = my / dt;
    c.walk += dt * speed * 0.05;
  }
}
