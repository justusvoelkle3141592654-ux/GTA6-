// the 10 walkable shops: a room inside the shop's building (its walls are thin buildings, so people and cars
// collide with them like with any building), a door to the street, a counter where you buy, furniture per shop.
// The mall fills a whole block and has an upper floor with escalators.
import { BLOCK, ROAD, H_SCALE, type Building, type World } from "./world";
import type { Place } from "./places";

export type InteriorKind = "gun" | "boutique" | "taco" | "burger" | "workshop" | "safehouse" | "market" | "cardealer" | "barber" | "mall";
export interface Prop { k: string; x: number; y: number; w: number; d: number; h: number; a?: number; z?: number; c?: string; solid?: boolean }
export interface Seat { x: number; y: number; a: number }
export interface Interior {
  id: string; kind: InteriorKind; name: string; color: string;
  x0: number; y0: number; x1: number; y1: number; // inside of the walls
  H: number;                                      // ceiling
  door: { x: number; y: number; w: number };      // in the west wall (x = x0)
  counter: { x: number; y: number };              // you stand here to buy
  clerk: { x: number; y: number; a: number };
  props: Prop[];
  seats: Seat[];
  guests: { x: number; y: number; a: number; anim: string }[];
  walls: Building[];
  // shop specific
  range?: { x0: number; x1: number; y0: number; y1: number; stand: { x: number; y: number }; targets: { x: number; y: number }[] };
  mirror?: { x: number; y: number; w: number; h: number; a: number };
  lift?: { x: number; y: number };
  show?: { x: number; y: number; model: string; color: string }[];
  bed?: { x: number; y: number };
  // mall: upper floor (gallery around the open middle) and escalators
  gallery?: { y: number; band: number };
  escalators?: { x0: number; x1: number; y0: number; y1: number; up: boolean }[];
}

const T = 4; // wall thickness
const wallB = (x: number, y: number, w: number, h: number, H: number, low = false): Building => ({
  x, y, w, h, height: (H - 14) / H_SCALE, wall: "#d8d2c6", wallDark: "#9a948a", roof: "#5a5a60", neon: null, detail: 0, seed: 0, shell: true, low,
});

// which place gets which room, size (depth along x from the street, length along y)
const KIND_OF: Record<string, [InteriorKind, number, number]> = {
  gunshop: ["gun", 170, 120], clothes: ["boutique", 120, 120], food: ["taco", 120, 120], food2: ["burger", 120, 120], workshop: ["workshop", 150, 130],
  safehouse: ["safehouse", 130, 120], market: ["market", 140, 140], cardealer: ["cardealer", 170, 180], barber: ["barber", 110, 110],
};

export function buildInteriors(world: World, places: Place[]): Interior[] {
  const out: Interior[] = [];
  for (const pl of places) {
    if (pl.id === "mall") { const m = buildMall(world, pl); if (m) out.push(m); continue; }
    const spec = KIND_OF[pl.id];
    if (!spec || !pl.bld) continue;
    const [kind, depth, len] = spec;
    const bld = pl.bld, blk = world.blockAt(bld.x + 1, bld.y + 1);
    if (!blk) continue;
    // the room: west part of the building around the entrance; the rest of the building stays (up to three pieces)
    const d = Math.min(depth, bld.w), l = Math.min(len, bld.h);
    const x0 = bld.x, x1 = bld.x + d;
    const y0 = Math.max(bld.y, Math.min(bld.y + bld.h - l, pl.y - l / 2)), y1 = y0 + l;
    const rest: Building[] = [];
    if (bld.w - d > 12) rest.push({ ...bld, x: x1 + 2, w: bld.w - d - 2 });
    if (y0 - bld.y > 12) rest.push({ ...bld, y: bld.y, h: y0 - bld.y - 2, w: d });
    if (bld.y + bld.h - y1 > 12) rest.push({ ...bld, y: y1 + 2, h: bld.y + bld.h - y1 - 2, w: d });
    blk.buildings.splice(blk.buildings.indexOf(bld), 1, ...rest);
    const H = kind === "workshop" ? 60 : 46;
    const doorW = kind === "workshop" ? 54 : 18, dy = (y0 + y1) / 2;
    const it: Interior = {
      id: pl.id, kind, name: pl.name, color: pl.color, x0: x0 + T, y0: y0 + T, x1: x1 - T, y1: y1 - T, H,
      door: { x: x0, y: dy, w: doorW }, counter: { x: 0, y: 0 }, clerk: { x: 0, y: 0, a: 0 }, props: [], seats: [], guests: [], walls: [],
    };
    it.walls.push(
      wallB(x0, y0, T, dy - doorW / 2 - y0, H), wallB(x0, dy + doorW / 2, T, y1 - dy - doorW / 2, H),
      wallB(x1 - T, y0, T, y1 - y0, H), wallB(x0, y0, x1 - x0, T, H), wallB(x0, y1 - T, x1 - x0, T, H),
    );
    furnish(it);
    for (const p of it.props) if (p.solid) it.walls.push(wallB(p.x - p.w / 2, p.y - p.d / 2, p.w, p.d, Math.max(16, (p.z ?? 0) + p.h), true));
    blk.buildings.push(...it.walls);
    // the shop menu opens at the counter (cars: on the lift in the workshop)
    pl.x = it.counter.x; pl.y = it.counter.y; pl.a = 0;
    if (kind === "workshop" && it.lift) { pl.cx = it.lift.x; pl.cy = it.lift.y; }
    out.push(it);
  }
  return out;
}

// furniture per shop (x: from the door into the room, y: along the street)
function furnish(it: Interior) {
  const { x0, x1, y0, y1 } = it, W = x1 - x0, L = y1 - y0, cy = (y0 + y1) / 2;
  const P = (k: string, x: number, y: number, w: number, d: number, h: number, c: string, solid = false, z = 0, a = 0) => it.props.push({ k, x, y, w, d, h, c, solid, z, a });
  const counterAt = (cx: number, cyy: number, along: number) => {
    P("counter", cx, cyy, 10, along, 11, "#5a4636", true);
    it.counter = { x: cx - 14, y: cyy };
    it.clerk = { x: cx + 9, y: cyy, a: Math.PI };
  };
  switch (it.kind) {
    case "gun": {
      // shop in front, shooting range behind a partition with a doorway
      const split = x0 + W * 0.48;
      counterAt(split - 22, cy - 12, 50);
      for (let y = y0 + 12; y < y1 - 10; y += 20) P("gunrack", split - 3, y, 2, 16, 26, "#2a2b30", false, 10);
      it.walls.push(wallB(split, y0, 3, L / 2 - 14, it.H), wallB(split, cy + 14, 3, y1 - cy - 14, it.H));
      it.range = { x0: split + 4, x1: x1 - 2, y0, y1, stand: { x: split + 18, y: cy }, targets: [] };
      for (let k = 0; k < 4; k++) {
        const ly = y0 + 18 + k * ((L - 36) / 3);
        P("lane", (split + x1) / 2 + 10, ly, x1 - split - 30, 1, 0.3, "#e8e8ec");
        it.range.targets.push({ x: x1 - 12, y: ly });
      }
      P("bench", split + 12, cy, 6, L - 20, 10, "#3a3d45", true);
      it.range.stand = { x: split + 22, y: cy };
      break;
    }
    case "boutique": {
      counterAt(x1 - 18, y0 + 26, 34);
      for (let k = 0; k < 3; k++) P("rack", x0 + 30 + k * 26, cy + 10, 4, 40, 18, "#c9ced8");
      // changing booth with a mirror on its back wall
      P("booth", x1 - 20, y1 - 22, 26, 2, 30, "#7a4a6a", false, 0);
      it.mirror = { x: x1 - 1, y: y1 - 22, w: 18, h: 30, a: Math.PI };
      P("plant", x0 + 10, y0 + 10, 6, 6, 14, "#3a7a3a");
      break;
    }
    case "taco": case "burger": {
      counterAt(x1 - 16, cy, 60);
      P("menu", x1 - 1, cy, 1, 50, 14, it.kind === "taco" ? "#e1b12c" : "#c0392b", false, 22);
      for (let k = 0; k < 4; k++) {
        const tx = x0 + 24 + (k % 2) * 36, ty = y0 + 26 + Math.floor(k / 2) * (L - 52);
        P("table", tx, ty, 14, 14, 10, it.kind === "taco" ? "#d35400" : "#e8e8ec", true);
        it.seats.push({ x: tx - 13, y: ty, a: 0 }, { x: tx + 13, y: ty, a: Math.PI });
        P("chair", tx - 13, ty, 7, 7, 6, "#3a3d45"); P("chair", tx + 13, ty, 7, 7, 6, "#3a3d45");
      }
      it.guests.push({ x: x0 + 24 - 13, y: y0 + 26, a: 0, anim: "bench" }, { x: x0 + 60 + 13, y: y1 - 26, a: Math.PI, anim: "bench" });
      break;
    }
    case "workshop": {
      // a hall you drive into: the lift in the middle, tool walls, the clerk at a desk
      it.lift = { x: (x0 + x1) / 2 + 6, y: cy };
      P("lift", it.lift.x, it.lift.y, 56, 26, 1.5, "#c0392b");
      P("desk", x1 - 14, y0 + 16, 12, 24, 11, "#5a5e66", true);
      it.counter = { x: x1 - 30, y: y0 + 16 }; it.clerk = { x: x1 - 6, y: y0 + 16, a: Math.PI };
      for (let k = 0; k < 4; k++) P("tools", x1 - 2, y0 + 50 + k * 18, 2, 14, 22, "#3a3d45", false, 8);
      P("tyres", x0 + 14, y1 - 14, 12, 12, 16, "#151515", true);
      break;
    }
    case "safehouse": {
      it.bed = { x: x1 - 22, y: y0 + 22 };
      P("bed", it.bed.x, it.bed.y, 30, 20, 7, "#2b3a55", true);
      P("wardrobe", x1 - 8, y1 - 26, 12, 30, 32, "#6b4a2e", true);
      P("tv", x0 + 30, y0 + 4, 26, 2, 15, "#101014", false, 10);
      P("sofa", x0 + 30, y0 + 32, 26, 10, 8, "#7a6a5a", true);
      P("table", x0 + 30, cy + 20, 18, 12, 8, "#5a4636", true);
      it.counter = { x: it.bed.x - 18, y: it.bed.y + 16 }; it.clerk = { x: -1e5, y: -1e5, a: 0 }; // nobody works here
      it.seats.push({ x: x0 + 30, y: y0 + 32, a: -Math.PI / 2 });
      break;
    }
    case "market": {
      counterAt(x0 + 34, y0 + 22, 30);
      for (let k = 0; k < 4; k++) P("shelf", x0 + 60 + k * 18, cy + 12, 6, L - 60, 22, ["#e1b12c", "#2e6da4", "#2d8a5a", "#c0392b"][k], true);
      P("fridge", x1 - 6, cy, 8, L - 30, 28, "#cfe6f2", true);
      it.guests.push({ x: x0 + 69, y: cy - 20, a: 0, anim: "idle" }, { x: x0 + 105, y: cy + 30, a: Math.PI, anim: "phone" });
      break;
    }
    case "cardealer": {
      counterAt(x0 + 28, y1 - 24, 34);
      it.show = [
        { x: x0 + 60, y: y0 + 45, model: "super", color: "#c0392b" }, { x: x0 + 125, y: y0 + 45, model: "suv", color: "#2c3e50" },
        { x: x0 + 90, y: cy + 10, model: "sport", color: "#f39c12" }, { x: x0 + 128, y: y1 - 40, model: "muscle", color: "#16a085" },
      ];
      for (const s of it.show) P("turntable", s.x, s.y, 44, 44, 1, "#d8d8dc");
      it.guests.push({ x: x0 + 110, y: cy - 20, a: Math.PI / 2, anim: "idle" });
      break;
    }
    case "barber": {
      counterAt(x0 + 24, y1 - 22, 26);
      for (let k = 0; k < 2; k++) { P("barberchair", x1 - 22, y0 + 26 + k * 36, 10, 10, 10, "#1b1b1f"); P("mirrorwall", x1 - 1, y0 + 26 + k * 36, 1, 22, 26, "#cfe6f2", false, 10); }
      P("tattoochair", x0 + 60, y0 + 24, 24, 9, 9, "#3a2a2a", true);
      it.guests.push({ x: x1 - 22, y: y0 + 26, a: 0, anim: "bench" });
      break;
    }
    case "mall": break;
  }
}

// the mall: a whole block, two floors around an open middle, escalators, small shop fronts, food court
export const MALL = { band: 70, floor: 34 };
function buildMall(world: World, pl: Place): Interior | null {
  const bx = Math.floor((pl.x - ROAD) / BLOCK), by = Math.floor((pl.y - ROAD) / BLOCK);
  const blk = world.blockAt(pl.x, pl.y);
  if (!blk) return null;
  const s0x = bx * BLOCK + ROAD, s0y = by * BLOCK + ROAD, size = BLOCK - ROAD;
  const x0 = s0x + 25, y0 = s0y + 25, x1 = s0x + size - 25, y1 = s0y + size - 25, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  blk.buildings.length = 0; blk.trees.length = 0;
  const H = 74, dw = 26;
  const it: Interior = {
    id: "mall", kind: "mall", name: pl.name, color: pl.color, x0: x0 + T, y0: y0 + T, x1: x1 - T, y1: y1 - T, H,
    door: { x: x0, y: cy, w: dw }, counter: { x: cx - 20, y: cy + 40 }, clerk: { x: cx + 2, y: cy + 40, a: Math.PI }, props: [], seats: [], guests: [], walls: [],
    gallery: { y: MALL.floor, band: MALL.band }, escalators: [],
  };
  it.walls.push(
    wallB(x0, y0, T, cy - dw / 2 - y0, H), wallB(x0, cy + dw / 2, T, y1 - cy - dw / 2, H),
    wallB(x1 - T, y0, T, cy - dw / 2 - y0, H), wallB(x1 - T, cy + dw / 2, T, y1 - cy - dw / 2, H),
    wallB(x0, y0, x1 - x0, T, H), wallB(x0, y1 - T, x1 - x0, T, H),
  );
  // escalators from the middle up to the north gallery
  const gy = it.y0 + MALL.band;
  it.escalators!.push({ x0: cx - 34, x1: cx - 20, y0: gy, y1: gy + 80, up: true }, { x0: cx + 20, x1: cx + 34, y0: gy, y1: gy + 80, up: false });
  // food court in the middle, the counter of the food stand
  P(it, "counter", cx + 0, cy + 40, 10, 40, 11, "#5a4636", true);
  for (let k = 0; k < 6; k++) {
    const tx = cx - 60 + (k % 3) * 60, ty = cy + 80 + Math.floor(k / 3) * 34;
    P(it, "table", tx, ty, 14, 14, 10, "#e8e8ec", true);
    it.seats.push({ x: tx - 13, y: ty, a: 0 }, { x: tx + 13, y: ty, a: Math.PI });
    P(it, "chair", tx - 13, ty, 7, 7, 6, "#3a3d45"); P(it, "chair", tx + 13, ty, 7, 7, 6, "#3a3d45");
  }
  // shop fronts on both floors along the walls (signs only, the shops are closed)
  const names = ["Sunset Mode", "Bucht-Elektro", "Café Brise", "Schuh-Eck", "Buchhafen", "Solara Sport", "Spielwelt", "Optik Klar"];
  let n = 0;
  for (const fy of [0, MALL.floor]) for (const [sx, sy, a] of [[cx - 90, it.y0, 0], [cx + 90, it.y0, 0], [cx - 90, it.y1, Math.PI], [cx + 90, it.y1, Math.PI]] as [number, number, number][]) {
    it.props.push({ k: "front", x: sx, y: sy, w: 80, d: 2, h: 26, z: fy, a, c: names[n++ % names.length] });
  }
  for (const p of it.props) if (p.solid) it.walls.push(wallB(p.x - p.w / 2, p.y - p.d / 2, p.w, p.d, 16, true));
  for (const [x, y, a] of [[cx - 40, cy - 30, 0], [cx + 40, cy - 10, Math.PI], [cx - 100, cy + 20, 0.5], [cx + 90, gy - 30, Math.PI]] as [number, number, number][]) it.guests.push({ x, y, a, anim: Math.random() < 0.5 ? "talk" : "phone" });
  blk.buildings.push(...it.walls);
  pl.x = it.counter.x; pl.y = it.counter.y; pl.a = 0;
  return it;
}
const P = (it: Interior, k: string, x: number, y: number, w: number, d: number, h: number, c: string, solid = false) => it.props.push({ k, x, y, w, d, h, c, solid });

// ---------------------------------------------------------------------------------------- queries
export function interiorAt(list: Interior[], x: number, y: number): Interior | null {
  for (const it of list) if (x > it.x0 - 2 && x < it.x1 + 2 && y > it.y0 - 2 && y < it.y1 + 2) return it;
  return null;
}
// floor height inside (mall: upper floor and escalators); z: where you are now (under the gallery you stay down)
export function interiorFloor(list: Interior[], x: number, y: number, z: number): number {
  for (const it of list) {
    if (!it.gallery || x < it.x0 || x > it.x1 || y < it.y0 || y > it.y1) continue;
    for (const e of it.escalators!) if (x > e.x0 && x < e.x1 && y > e.y0 && y < e.y1) return it.gallery.y * (1 - (y - e.y0) / (e.y1 - e.y0));
    const b = it.gallery.band;
    const onBand = x < it.x0 + b || x > it.x1 - b || y < it.y0 + b || y > it.y1 - b;
    if (onBand && z > it.gallery.y - 12) return it.gallery.y;
  }
  return -Infinity;
}
