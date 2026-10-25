// the people inside the walkable rooms (clerks, guests, inmates in the prison yard): they can be shot, they duck when
// shots are fired close to them, and the dead lie there until you have been away for a while
import type { Interior } from "../world/interiors";

export interface IndoorPerson {
  x: number; y: number; z: number; a: number;
  hp: number; dead: boolean;
  vx: number; vy: number; vz: number; spin: number; // how the body was hit (the ragdoll starts with it)
  scared: number;                                   // seconds left ducking / hands up
  clerk: boolean; role: string;
}
interface RoomState { people: IndoorPerson[]; yard: IndoorPerson[]; awayT: number; hurt: boolean; ruinT: number }

const HP = { civ: 30, guard: 80 } as const;
const KEEP = 900, RESET_AFTER = 90; // rooms with dead or scared people are reset this long after you have left (units, seconds)

export class IndoorPeople {
  private rooms = new Map<Interior, RoomState>();

  private make(it: Interior): RoomState {
    const mk = (x: number, y: number, z: number, a: number, role: string, clerk: boolean): IndoorPerson => ({
      x, y, z, a, hp: role === "guard" || role === "cop" ? HP.guard : HP.civ, dead: false, vx: 0, vy: 0, vz: 0, spin: 0, scared: 0, clerk, role,
    });
    const people: IndoorPerson[] = [];
    if (it.clerk.x > -1e4) people.push(mk(it.clerk.x, it.clerk.y, 0, it.clerk.a, "civ", true));
    for (const g of it.guests) people.push(mk(g.x, g.y, g.z ?? 0, g.a, g.role ?? "civ", false));
    const yard = (it.yard?.guests ?? []).map((g) => mk(g.x, g.y, g.z ?? 0, g.a, g.role ?? "civ", false));
    const s = { people, yard, awayT: 0, hurt: false, ruinT: 0 };
    this.rooms.set(it, s);
    return s;
  }
  // the people of a room (in the order the renderer spawns them: the clerk first, then the guests)
  of(it: Interior): IndoorPerson[] { return (this.rooms.get(it) ?? this.make(it)).people; }
  yardOf(it: Interior): IndoorPerson[] { return (this.rooms.get(it) ?? this.make(it)).yard; }
  // blown up with TNT: smoke comes out of the door for a while, the shop stays closed until the room is reset
  ruin(it: Interior) { const s = this.rooms.get(it) ?? this.make(it); s.ruinT = 120; s.hurt = true; }
  ruinT(it: Interior) { return this.rooms.get(it)?.ruinT ?? 0; }
  *ruins() { for (const [it, s] of this.rooms) if (s.ruinT > 0) yield it; }
  clerkDead(it: Interior) { const s = this.rooms.get(it); return !!s && (s.ruinT > 0 || (it.clerk.x > -1e4 && s.people[0]?.dead === true)); }

  private *all() { for (const [it, s] of this.rooms) { for (const p of s.people) yield { it, p, s }; for (const p of s.yard) yield { it, p, s }; } }

  // a bullet at (x, y, z): the person it hits
  hitTest(x: number, y: number, z: number, r: number): { it: Interior; p: IndoorPerson } | null {
    for (const h of this.all()) {
      const p = h.p;
      if (p.dead || Math.abs(z - (p.z + 11)) > 14) continue;
      if ((p.x - x) ** 2 + (p.y - y) ** 2 < r * r) return h;
    }
    return null;
  }
  // damage from (fromX, fromY); true when the person goes down
  damage(it: Interior, p: IndoorPerson, dmg: number, fromX: number, fromY: number, push = 90): boolean {
    if (p.dead) return false;
    p.hp -= dmg;
    const s = this.rooms.get(it); if (s) s.hurt = true;
    if (p.hp > 0) { p.scared = 6; return false; }
    const d = Math.max(1, Math.hypot(p.x - fromX, p.y - fromY));
    p.dead = true; p.vx = ((p.x - fromX) / d) * push; p.vy = ((p.y - fromY) / d) * push; p.vz = 30; p.spin = 1;
    return true;
  }
  // an explosion: everybody close goes down; returns how many
  blast(x: number, y: number, z: number, R: number): number {
    let n = 0;
    for (const { it, p } of this.all()) {
      if (p.dead) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d > R || Math.abs(p.z - z) > 40) continue;
      const f = 1 - d / R;
      p.hp = 0; p.dead = true;
      const s = this.rooms.get(it); if (s) s.hurt = true;
      p.vx = ((p.x - x) / Math.max(1, d)) * 320 * f; p.vy = ((p.y - y) / Math.max(1, d)) * 320 * f; p.vz = 120 * f + 40; p.spin = 3;
      n++;
    }
    return n;
  }
  // shots or a blast close by: the people around duck (the clerk puts the hands up)
  alarm(x: number, y: number, R: number) {
    for (const { p } of this.all()) if (!p.dead && Math.hypot(p.x - x, p.y - y) < R) p.scared = Math.max(p.scared, 6);
  }

  update(dt: number, px: number, py: number) {
    for (const [it, s] of this.rooms) {
      for (const p of s.people) p.scared = Math.max(0, p.scared - dt);
      for (const p of s.yard) p.scared = Math.max(0, p.scared - dt);
      s.ruinT = Math.max(0, s.ruinT - dt);
      const d = Math.hypot(Math.max(it.x0 - px, 0, px - it.x1), Math.max(it.y0 - py, 0, py - it.y1));
      s.awayT = d > KEEP ? s.awayT + dt : 0;
      // far away for long enough: new people (rooms nobody was hurt in are simply forgotten)
      if (s.awayT > (s.hurt ? RESET_AFTER : 5)) this.rooms.delete(it);
    }
  }
  clear() { this.rooms.clear(); }
}
