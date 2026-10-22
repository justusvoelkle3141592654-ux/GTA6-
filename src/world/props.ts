// street furniture that cars knock over: benches, litter bins, hydrants, letter boxes and the street lamps.
// Standing props are hit by car boxes; small ones fly away tumbling, lamps tip over about their base.
import { GRID, ROAD } from "./terrain";
import type { World } from "./world";

export type PropKind = "bench" | "bin" | "hydrant" | "post" | "lamp";
export interface Prop {
  kind: PropKind;
  x: number; y: number; yaw: number;      // standing place, rotation about the vertical (three.js y)
  st: 0 | 1 | 2;                          // 0 standing, 1 flying / falling, 2 lying
  px: number; py: number; pz: number;     // position while knocked over (pz = height)
  vx: number; vy: number; vz: number;
  rx: number; ry: number; rz: number;     // tumble angles (small props)
  wx: number; wy: number; wz: number;     // tumble speeds
  fa: number; ta: number; tv: number;     // lamps: fall direction, tilt angle, tilt speed
  t: number;                              // seconds since it was hit
}
// collision radius and how much of its speed a car keeps when it drives through
export const PROP_R: Record<PropKind, number> = { bench: 9, bin: 3.5, hydrant: 3, post: 3, lamp: 3 };
const KEEP: Record<PropKind, number> = { bench: 0.9, bin: 0.97, hydrant: 0.88, post: 0.95, lamp: 0.72 };
const GRAV = 620;
const CELL = 200;

export class Props {
  list: Prop[] = [];
  dirty = new Set<number>();              // indices whose matrix changed (read and cleared by the renderer)
  private cells = new Map<number, number[]>();

  constructor(world: World) {
    const stops = world.busStops();
    const nearStop = (x: number, y: number) => stops.some((s) => Math.hypot(s.x - x, s.y - y) < 40);
    const add = (kind: PropKind, x: number, y: number, yaw: number) => {
      this.list.push({ kind, x, y, yaw, st: 0, px: x, py: y, pz: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, fa: 0, ta: 0, tv: 0, t: 0 });
    };
    // the same places as before (curb points, a hash picks the kind); local frame: +z towards the street
    world.curbPoints().forEach((c, i) => {
      if (nearStop(c.x, c.y)) return;
      const k = (i * 2654435761) >>> 0, yaw = Math.atan2(c.nx, c.ny);
      if (k % 19 === 0) add("bench", c.x - c.nx * 3, c.y - c.ny * 3, yaw);
      else if (k % 13 === 4) add("bin", c.x, c.y, yaw);
      else if (k % 23 === 6) add("hydrant", c.x, c.y, yaw);
      else if (k % 37 === 9) add("post", c.x - c.nx * 2, c.y - c.ny * 2, yaw);
    });
    // street lamps at two corners of every crossing
    for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) {
      const n = world.nodePos(i, j), o = ROAD / 2 + 6;
      add("lamp", n.x - o, n.y - o, 0); add("lamp", n.x + o, n.y + o, 0);
    }
    this.list.forEach((p, i) => {
      const key = this.key(p.x, p.y);
      let l = this.cells.get(key); if (!l) { l = []; this.cells.set(key, l); } l.push(i);
    });
  }
  private key(x: number, y: number) { return (Math.floor(x / CELL) + 500) * 2000 + Math.floor(y / CELL) + 500; }

  // standing props whose circle touches the rotated box (x, y, a, hl, hw); calls hit for each
  touch(x: number, y: number, a: number, hl: number, hw: number, hit: (p: Prop, i: number) => void) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), ca = Math.cos(a), sa = Math.sin(a);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const l = this.cells.get((cx + ox + 500) * 2000 + cy + oy + 500);
      if (!l) continue;
      for (const i of l) {
        const p = this.list[i];
        if (p.st !== 0) continue;
        const dx = p.x - x, dy = p.y - y, r = PROP_R[p.kind];
        const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
        if (Math.abs(lx) < hl + r && Math.abs(ly) < hw + r) hit(p, i);
      }
    }
  }

  // knocked over by something moving with (vx, vy); returns the share of its speed the car keeps
  knock(i: number, vx: number, vy: number): number {
    const p = this.list[i], sp = Math.hypot(vx, vy), r = () => Math.random() - 0.5;
    p.st = 1; p.t = 0; p.px = p.x; p.py = p.y; p.pz = 0;
    if (p.kind === "lamp") {
      p.fa = Math.atan2(vy, vx) + r() * 0.5; p.ta = 0.05; p.tv = 0.6 + sp / 500;
    } else {
      const f = p.kind === "bench" ? 0.7 : 1.05;
      p.vx = vx * f + r() * 80; p.vy = vy * f + r() * 80; p.vz = 90 + sp * (p.kind === "bench" ? 0.15 : 0.35);
      p.wx = r() * 14; p.wy = r() * 10; p.wz = r() * 14;
    }
    this.dirty.add(i);
    return KEEP[p.kind];
  }

  // flying and falling props; standing ones come back after a minute when nobody looks (far away)
  update(dt: number, ground: (x: number, y: number) => number, fx: number, fy: number) {
    this.list.forEach((p, i) => {
      if (p.st === 0) return;
      p.t += dt;
      if (p.t > 60 && Math.hypot(p.x - fx, p.y - fy) > 1000 && Math.hypot(p.px - fx, p.py - fy) > 1000) {
        p.st = 0; p.rx = p.ry = p.rz = 0; p.ta = 0; this.dirty.add(i); return;
      }
      if (p.st === 2) return;
      if (p.kind === "lamp") {
        // tips over faster and faster, bounces once on the ground
        p.tv += Math.sin(p.ta) * 9 * dt; p.ta += p.tv * dt;
        if (p.ta >= Math.PI / 2 - 0.02) { p.ta = Math.PI / 2 - 0.02; if (p.tv > 1.2) p.tv = -p.tv * 0.2; else p.st = 2; }
      } else {
        p.vz -= GRAV * dt;
        p.px += p.vx * dt; p.py += p.vy * dt; p.pz += p.vz * dt;
        p.rx += p.wx * dt; p.ry += p.wy * dt; p.rz += p.wz * dt;
        const g = ground(p.px, p.py);
        if (p.pz < g) {
          p.pz = g; p.vz = -p.vz * 0.3; p.vx *= 0.6; p.vy *= 0.6; p.wx *= 0.5; p.wy *= 0.5; p.wz *= 0.5;
          if (Math.abs(p.vz) < 40 && Math.hypot(p.vx, p.vy) < 30) {
            // comes to rest lying on its side
            p.st = 2; p.rx = Math.round(p.rx / (Math.PI / 2)) * (Math.PI / 2); p.rz = Math.round(p.rz / (Math.PI / 2)) * (Math.PI / 2);
          }
        }
      }
      this.dirty.add(i);
    });
  }
}
