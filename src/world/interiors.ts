// the 20 walkable rooms: shops, the clinic, the police station, the contacts' places, a night club and homes.
// A room sits inside its place's building (its walls are thin buildings, so people and cars collide with them
// like with any building), a door to the street, a counter where you buy, furniture per room.
// The mall and the apartment tower fill a whole block (mall: upper floor with escalators; tower: six flats).
import { BLOCK, ROAD, H_SCALE, type Building, type World } from "./world";
import type { Place } from "./places";

export type InteriorKind = "gun" | "boutique" | "taco" | "burger" | "workshop" | "safehouse" | "market" | "cardealer" | "barber" | "mall"
  | "hospital" | "police" | "garage" | "cafe" | "office" | "harbor" | "precinct" | "club" | "loft" | "tower";
// k "f:<kind>": a piece from the furniture library (render/furniture.ts); w, d are its size before turning by a
// (a = 0: the front looks south (+y), PI/2 west, PI north, -PI/2 east)
export interface Prop { k: string; x: number; y: number; w: number; d: number; h: number; a?: number; z?: number; c?: string; c2?: string; solid?: boolean }
// a flat or house you can buy: sleep in its bed (heals, saves the game)
export interface Home { id: string; name: string; price: number; bed: { x: number; y: number }; x0: number; y0: number; x1: number; y1: number }
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
  homes?: Home[];
  heal?: boolean;                                 // clinic: you are patched up while you are inside
  floor?: [string, string]; wallTex?: [string, string]; // floor and wall look (texture style, colour)
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
  safehouse: ["safehouse", 140, 130], market: ["market", 140, 140], cardealer: ["cardealer", 170, 180], barber: ["barber", 110, 110],
  hospital: ["hospital", 170, 150], police: ["police", 160, 140], lou: ["garage", 150, 130], marisol: ["cafe", 130, 120], dock: ["office", 120, 110],
  ines: ["harbor", 130, 120], ruiz: ["precinct", 120, 110], club: ["club", 170, 150], loft: ["loft", 160, 140],
};
const WIDE_DOOR = new Set<InteriorKind>(["workshop", "garage"]);

export function buildInteriors(world: World, places: Place[]): Interior[] {
  const out: Interior[] = [];
  for (const pl of places) {
    if (pl.id === "mall") { const m = buildMall(world, pl); if (m) out.push(m); continue; }
    if (pl.id === "tower") { const t = buildTower(world, pl); if (t) out.push(t); continue; }
    const spec = KIND_OF[pl.id];
    if (!spec || !pl.bld) continue;
    const [kind, depth, len] = spec;
    const bld = pl.bld, blk = world.blockAt(bld.x + 1, bld.y + 1);
    if (!blk) continue;
    // the room: at the west edge of the block around the entrance, full size; every building it overlaps keeps
    // the pieces outside of it (buildings with a ramp onto their roof are left alone: then the room stays in its own building)
    const bx0 = blk.bx * BLOCK + ROAD, by0 = blk.by * BLOCK + ROAD, size = BLOCK - ROAD;
    let x0 = bld.x, x1 = Math.min(x0 + depth, bx0 + size - 12);
    let y0 = Math.max(by0 + 12, Math.min(by0 + size - 12 - len, pl.y - len / 2)), y1 = y0 + len;
    const hit = (b: Building) => b.x < x1 + 2 && b.x + b.w > x0 - 2 && b.y < y1 + 2 && b.y + b.h > y0 - 2;
    if (blk.buildings.some((b) => hit(b) && world.ramps.some((r) => r.bld === b))) {
      const d = Math.min(depth, bld.w), l = Math.min(len, bld.h);
      x1 = x0 + d; y0 = Math.max(bld.y, Math.min(bld.y + bld.h - l, pl.y - l / 2)); y1 = y0 + l;
    }
    const keep: Building[] = [];
    for (const b of blk.buildings) {
      if (!hit(b)) { keep.push(b); continue; }
      const pieces: Building[] = [
        { ...b, h: y0 - 2 - b.y },                                                     // north of the room
        { ...b, y: y1 + 2, h: b.y + b.h - y1 - 2 },                                     // south of it
        { ...b, x: x1 + 2, w: b.x + b.w - x1 - 2, y: Math.max(b.y, y0 - 2), h: Math.min(b.y + b.h, y1 + 2) - Math.max(b.y, y0 - 2) }, // east
        { ...b, w: x0 - 2 - b.x, y: Math.max(b.y, y0 - 2), h: Math.min(b.y + b.h, y1 + 2) - Math.max(b.y, y0 - 2) },                 // west
      ];
      for (const q of pieces) if (q.w > 12 && q.h > 12) keep.push(q);
    }
    blk.buildings.length = 0; blk.buildings.push(...keep);
    blk.trees = blk.trees.filter((t) => t.x < x0 - 20 || t.x > x1 + 20 || t.y < y0 - 20 || t.y > y1 + 20);
    const H = WIDE_DOOR.has(kind) ? 60 : 46;
    const doorW = WIDE_DOOR.has(kind) ? 54 : 20, dy = (y0 + y1) / 2;
    const it: Interior = {
      id: pl.id, kind, name: pl.name, color: pl.color, x0: x0 + T, y0: y0 + T, x1: x1 - T, y1: y1 - T, H,
      door: { x: x0, y: dy, w: doorW }, counter: { x: 0, y: 0 }, clerk: { x: 0, y: 0, a: 0 }, props: [], seats: [], guests: [], walls: [],
    };
    it.walls.push(
      wallB(x0, y0, T, dy - doorW / 2 - y0, H), wallB(x0, dy + doorW / 2, T, y1 - dy - doorW / 2, H),
      wallB(x1 - T, y0, T, y1 - y0, H), wallB(x0, y0, x1 - x0, T, H), wallB(x0, y1 - T, x1 - x0, T, H),
    );
    furnish(it);
    solidProps(it);
    blk.buildings.push(...it.walls);
    // the shop menu opens at the counter (cars: on the lift in the workshop)
    pl.x = it.counter.x; pl.y = it.counter.y; pl.a = 0;
    if (kind === "workshop" && it.lift) { pl.cx = it.lift.x; pl.cy = it.lift.y; }
    if (pl.kind === "contact") it.clerk.a = Math.PI; // the contact waits behind the counter
    out.push(it);
  }
  return out;
}

// furniture per room (x: from the door into the room, y: along the street)
const SOUTH = 0, WEST = Math.PI / 2, NORTH = Math.PI, EAST = -Math.PI / 2; // where the front of a piece looks
interface FOpt { solid?: boolean; z?: number; c2?: string; h?: number }
const addF = (it: Interior, k: string, x: number, y: number, w: number, d: number, a = 0, c = "#8a8a8a", o: FOpt = {}) =>
  it.props.push({ k: "f:" + k, x, y, w, d, h: o.h ?? 20, a, z: o.z ?? 0, c, c2: o.c2, solid: o.solid ?? false });
// world size of a piece (turned by a quarter: width and depth swap)
const turned = (p: Prop) => p.k.startsWith("f:") && Math.abs(Math.sin(p.a ?? 0)) > 0.7;
function solidProps(it: Interior) {
  for (const p of it.props) if (p.solid) {
    const w = turned(p) ? p.d : p.w, d = turned(p) ? p.w : p.d;
    it.walls.push(wallB(p.x - w / 2, p.y - d / 2, w, d, Math.max(16, (p.z ?? 0) + p.h), true));
  }
}

function furnish(it: Interior) {
  const { x0, x1, y0, y1 } = it, W = x1 - x0, L = y1 - y0, cy = (y0 + y1) / 2, cx = (x0 + x1) / 2;
  const P = (k: string, x: number, y: number, w: number, d: number, h: number, c: string, solid = false, z = 0, a = 0) => it.props.push({ k, x, y, w, d, h, c, solid, z, a });
  const F = (k: string, x: number, y: number, w: number, d: number, a = 0, c = "#8a8a8a", o: FOpt = {}) => addF(it, k, x, y, w, d, a, c, o);
  // pictures, signs and maps on the walls (north / south / east wall; the west wall has the door)
  const onN = (k: string, x: number, w: number, c: string, c2?: string, z = 16) => F(k, x, y0 + 0.6, w, 1, SOUTH, c, { z, c2 });
  const onS = (k: string, x: number, w: number, c: string, c2?: string, z = 16) => F(k, x, y1 - 0.6, w, 1, NORTH, c, { z, c2 });
  const onE = (k: string, y: number, w: number, c: string, c2?: string, z = 16) => F(k, x1 - 0.6, y, w, 1, WEST, c, { z, c2 });
  const wall = (x: number, y: number, w: number, h: number) => it.walls.push(wallB(x, y, w, h, it.H));
  const counterAt = (cx: number, cyy: number, along: number) => {
    P("counter", cx, cyy, 10, along, 11, "#5a4636", true);
    it.counter = { x: cx - 14, y: cyy };
    it.clerk = { x: cx + 9, y: cyy, a: Math.PI };
  };
  // a desk or bar with its front to the door: you stand in front (west), the clerk behind it
  const deskAt = (k: string, dx: number, dy: number, along: number, c: string) => {
    F(k, dx, dy, along, 12, WEST, c, { solid: true });
    it.counter = { x: dx - 16, y: dy };
    it.clerk = { x: dx + 11, y: dy, a: Math.PI };
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
      F("gunwall", x0 + (split - x0) / 2 - 6, y0 + 3, Math.min(60, split - x0 - 30), 4, SOUTH, "#3a3d45");
      F("case", x0 + 26, y1 - 14, 30, 12, NORTH, "#2a2b30", { solid: true });
      onS("neon", x0 + 30, 40, "#ff9f43", "KALIBER", 28);
      F("plant", x0 + 8, y0 + 8, 10, 10, 0, "#3a7a3a");
      it.floor = ["concrete", "#5e5e64"]; it.wallTex = ["brick", "#4a4d55"];
      break;
    }
    case "boutique": {
      counterAt(x1 - 18, y0 + 26, 34);
      for (let k = 0; k < 3; k++) P("rack", x0 + 30 + k * 26, cy + 10, 4, 40, 18, "#c9ced8");
      // changing booth with a mirror on its back wall
      P("booth", x1 - 20, y1 - 22, 26, 2, 30, "#7a4a6a", false, 0);
      it.mirror = { x: x1 - 1, y: y1 - 22, w: 18, h: 30, a: Math.PI };
      F("plant", x0 + 10, y0 + 10, 12, 12, 0, "#3a7a3a"); F("palm", x0 + 10, y1 - 10, 14, 14);
      F("armchair", x0 + 34, y1 - 12, 16, 14, NORTH, "#c86bff", { solid: true });
      F("lamp", x0 + 52, y1 - 8, 8, 8, 0, "#f2e2c0");
      F("rug", x0 + 56, cy + 10, 60, 50, 0, "#f2c7d8", { c2: "#c86bff" });
      onN("art", x0 + 40, 26, "#ff3cac");
      it.floor = ["parquet", "#c8a882"]; it.wallTex = ["stripe", "#f6e8f0"];
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
      F(it.kind === "taco" ? "plant" : "jukebox", x0 + 8, cy + 26, 12, 10, EAST, "#c0392b", { solid: it.kind !== "taco" });
      F("vending", x1 - 24, y1 - 6, 14, 10, NORTH, it.kind === "taco" ? "#2d8a5a" : "#c0392b", { solid: true });
      onN("neon", cx - 10, 44, it.kind === "taco" ? "#ffd23f" : "#ff3a4d", it.kind === "taco" ? "TACO LOCO" : "BURGER BUCHT", 28);
      onS("art", x0 + 40, 22, it.kind === "taco" ? "#e67e22" : "#2bb3ff", "sun");
      it.floor = it.kind === "taco" ? ["tile", "#c8783a"] : ["checker", "#e8e4dc"]; it.wallTex = it.kind === "taco" ? ["tile", "#f2c14e"] : ["tile", "#f4f4f2"];
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
      F("toolwall", cx, y1 - 3, 60, 4, NORTH, "#c9b07a");
      F("drum", x0 + 30, y1 - 10, 10, 10, 0, "#c0392b", { solid: true }); F("drum", x0 + 42, y1 - 10, 10, 10, 0, "#2e6da4", { solid: true });
      onN("neon", cx - 20, 40, "#9d4dff", "LACK & TURBO", 34);
      it.floor = ["concrete", "#6c6c70"]; it.wallTex = ["concrete", "#8f8b84"];
      break;
    }
    case "safehouse": {
      // your first home: bed, kitchenette, sofa and TV, a shower corner
      it.bed = { x: x1 - 44, y: y0 + 22 };
      F("bed", x1 - 22, y0 + 22, 28, 36, WEST, "#2b3a55", { solid: true });
      F("side", x1 - 8, y0 + 44, 10, 8, WEST, "#5a3a22");
      F("wardrobe", x1 - 6, y1 - 26, 28, 10, WEST, "#6b4a2e", { solid: true });
      F("tv", x0 + 36, y0 + 6, 30, 10, SOUTH, "#3a2a1a", { solid: true });
      F("sofa", x0 + 36, y0 + 44, 40, 15, NORTH, "#7a6a5a", { solid: true });
      F("coffee", x0 + 36, y0 + 26, 22, 10, 0, "#6a4a32");
      F("rug", x0 + 36, y0 + 28, 52, 30, 0, "#8a5a3a", { c2: "#c9a070" });
      F("counter", x0 + 22, y1 - 7, 22, 14, NORTH, "#e8e4dc", { solid: true }); F("stove", x0 + 42, y1 - 7, 18, 14, NORTH, "#e8e4dc", { solid: true });
      F("fridge", x0 + 60, y1 - 7, 14, 12, NORTH, "#f4f2ee", { solid: true });
      F("lamp", x0 + 8, y0 + 8, 8, 8); F("plant", x1 - 8, cy + 6, 10, 10);
      onE("art", y0 + 22, 24, "#2bb3ff", "wave", 22);
      it.counter = { x: it.bed.x - 4, y: it.bed.y + 20 }; it.clerk = { x: -1e5, y: -1e5, a: 0 }; // nobody works here
      it.seats.push({ x: x0 + 30, y: y0 + 39, a: -Math.PI / 2 }, { x: x0 + 42, y: y0 + 39, a: -Math.PI / 2 });
      it.homes = [{ id: "safehouse", name: "Safehouse", price: 0, bed: it.bed, x0, y0, x1, y1 }];
      it.floor = ["wood", "#8a6a4a"]; it.wallTex = ["paint", "#d8d0c4"];
      break;
    }
    case "market": {
      counterAt(x0 + 34, y0 + 22, 30);
      for (let k = 0; k < 4; k++) P("shelf", x0 + 60 + k * 18, cy + 12, 6, L - 60, 22, ["#e1b12c", "#2e6da4", "#2d8a5a", "#c0392b"][k], true);
      P("fridge", x1 - 6, cy, 8, L - 30, 28, "#cfe6f2", true);
      it.guests.push({ x: x0 + 69, y: cy - 20, a: 0, anim: "idle" }, { x: x0 + 105, y: cy + 30, a: Math.PI, anim: "phone" });
      F("crate", x0 + 12, y1 - 12, 14, 14, 0, "#b5651d", { solid: true }); F("crate", x0 + 12, y1 - 26, 12, 12, 0.3, "#a0551a", { solid: true });
      F("plant", x0 + 8, y0 + 44, 10, 10);
      onS("neon", x0 + 40, 40, "#3dd68c", "FRISCHBUCHT", 28);
      it.floor = ["lino", "#dcdcd4"]; it.wallTex = ["tile", "#f4f4f0"];
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
      F("palm", x0 + 10, y0 + 10, 14, 14); F("palm", x0 + 10, y1 - 10, 14, 14);
      F("armchair", x0 + 30, y0 + 16, 16, 14, SOUTH, "#2a2d33", { solid: true }); F("coffee", x0 + 30, y0 + 32, 18, 10, 0, "#c9ced8");
      onE("board", cy, 40, "#f4f4f4", "TOP ANGEBOTE", 18);
      it.floor = ["marble", "#d4d0ca"]; it.wallTex = ["paint", "#e2e6ea"];
      break;
    }
    case "barber": {
      counterAt(x0 + 24, y1 - 22, 26);
      for (let k = 0; k < 2; k++) { P("barberchair", x1 - 22, y0 + 26 + k * 36, 10, 10, 10, "#1b1b1f"); P("mirrorwall", x1 - 1, y0 + 26 + k * 36, 1, 22, 26, "#cfe6f2", false, 10); }
      P("tattoochair", x0 + 60, y0 + 24, 24, 9, 9, "#3a2a2a", true);
      it.guests.push({ x: x1 - 22, y: y0 + 26, a: 0, anim: "bench" });
      F("bench", x0 + 50, y1 - 6, 30, 8, NORTH, "#3a2a3a"); it.seats.push({ x: x0 + 44, y: y1 - 9, a: -Math.PI / 2 }, { x: x0 + 56, y: y1 - 9, a: -Math.PI / 2 });
      F("plant", x0 + 8, y0 + 8, 10, 10); onN("neon", x0 + 30, 30, "#c86bff", "INK BAY", 26); onN("art", x0 + 70, 20, "#c86bff");
      it.floor = ["checker", "#e8e4dc"]; it.wallTex = ["paint", "#3a2a3a"];
      break;
    }
    // ---------------------------------------------------------------- new rooms
    case "hospital": {
      deskAt("reception", x0 + 40, cy - 24, 36, "#e8eef2");
      for (let k = 0; k < 4; k++) {
        const x = x0 + 18 + k * 13;
        F("chair", x, y0 + 8, 10, 10, SOUTH, "#2e86c1");
        it.seats.push({ x, y: y0 + 12, a: Math.PI / 2 });
      }
      it.guests.push({ x: x0 + 31, y: y0 + 12, a: Math.PI / 2, anim: "bench" }, { x: x0 + 57, y: y0 + 12, a: Math.PI / 2, anim: "phone" });
      const beds = Math.max(1, Math.min(3, Math.floor((L - 20) / 44)));
      for (let k = 0; k < beds; k++) {
        const by = y0 + 26 + k * 44;
        F("hbed", x1 - 20, by, 22, 34, WEST, "#ffffff", { solid: true });
        if (k < beds - 1) F("curtain", x1 - 22, by + 22, 36, 2, SOUTH, "#9ad0e8");
      }
      F("vending", x0 + 70, y1 - 7, 14, 10, NORTH, "#c0392b", { solid: true }); F("cooler", x0 + 88, y1 - 6, 8, 8, NORTH);
      F("plant", x0 + 8, y1 - 10, 12, 12); F("plant", x0 + 8, y0 + 44, 10, 10);
      onN("board", cx + 26, 30, "#f4f4f4", "NOTAUFNAHME", 18); onS("art", x0 + 40, 24, "#2e86c1", "sea");
      it.heal = true;
      it.floor = ["lino", "#bcc8cc"]; it.wallTex = ["tile", "#d6e2e6"];
      break;
    }
    case "police": {
      deskAt("reception", x0 + 38, cy + 20, 34, "#2c3e50");
      F("locker", x0 + 56, y0 + 5, 36, 9, SOUTH, "#5a6a7a", { solid: true });
      F("desk", cx + 6, cy - 16, 28, 14, SOUTH, "#6a4a32", { solid: true }); F("pc", cx + 6, cy - 18, 20, 9, SOUTH, "#222", { z: 13 });
      F("chair", cx + 6, cy - 2, 9, 9, NORTH, "#2a2d33");
      // two cells behind bars along the east wall
      const bx = x1 - 42;
      F("bars", bx, cy, 2, L - 4, 0, "#5a5d66", { solid: true });
      F("bars", bx + 21, cy, 40, 2, 0, "#5a5d66", { solid: true });
      F("bunk", x1 - 14, y0 + 20, 18, 30, WEST, "#5a5d66"); F("bunk", x1 - 14, y1 - 20, 18, 30, WEST, "#5a5d66");
      F("toilet", x1 - 32, y0 + 8, 9, 10, SOUTH); F("toilet", x1 - 32, y1 - 8, 9, 10, NORTH);
      it.guests.push({ x: x1 - 26, y: y0 + 34, a: Math.PI, anim: "lookAround" });
      onN("board", cx - 20, 30, "#f4f4f4", "MOST WANTED", 18); onS("map", cx - 20, 32, "#c9b07a", undefined, 14);
      F("files", x0 + 12, y1 - 8, 16, 9, NORTH, "#7a8a9a", { solid: true }); F("plant", x0 + 8, y0 + 8, 10, 10);
      it.floor = ["tile", "#a7b0ba"]; it.wallTex = ["paint", "#c9d4e2"];
      break;
    }
    case "garage": {
      // Lou's garage: a car up on the lift, tool wall, workbench, old sofa
      F("lift", cx - 4, cy, 34, 54, WEST, "#8a2a22", { solid: true });
      F("carprop", cx - 4, cy, 22, 46, WEST, "#a83a7c", { z: 12 });
      F("toolwall", x1 - 3, cy, 56, 4, WEST, "#c9b07a");
      F("workbench", x1 - 30, y0 + 8, 30, 12, SOUTH, "#6a4a32", { solid: true });
      it.counter = { x: x1 - 30, y: y0 + 30 }; it.clerk = { x: x1 - 30, y: y0 + 19, a: Math.PI / 2 };
      F("tires", x0 + 14, y0 + 12, 10, 10, 0, "#15161b", { solid: true });
      F("drum", x0 + 12, y1 - 12, 10, 10, 0, "#c0392b", { solid: true }); F("drum", x0 + 24, y1 - 12, 10, 10, 0, "#2e6da4", { solid: true });
      F("sofa", cx + 18, y1 - 9, 36, 15, NORTH, "#7a4a3a", { solid: true });
      it.seats.push({ x: cx + 12, y: y1 - 12, a: -Math.PI / 2 });
      onS("art", cx + 18, 28, "#ff5ad1", "pin", 24);
      it.floor = ["concrete", "#8d8a84"]; it.wallTex = ["brick", "#8a4a36"];
      break;
    }
    case "cafe": {
      F("bar", x1 - 18, cy - 8, 44, 12, WEST, "#8a5a3a", { solid: true });
      it.counter = { x: x1 - 34, y: cy - 8 }; it.clerk = { x: x1 - 7, y: cy - 8, a: Math.PI };
      F("espresso", x1 - 18, cy - 24, 8, 6, WEST, "#c9ced8", { z: 16 });
      F("bottles", x1 - 2, cy - 8, 30, 4, WEST, "#5a3a22", { z: 18 });
      for (let k = 0; k < 3; k++) {
        const tx = x0 + 26 + (k % 2) * 34, ty = k < 2 ? y0 + 24 : y1 - 24;
        F("rtable", tx, ty, 16, 16, 0, "#f4efe6", { solid: true });
        F("chair", tx - 12, ty, 9, 9, EAST, "#5a3a22"); F("chair", tx + 12, ty, 9, 9, WEST, "#5a3a22");
        it.seats.push({ x: tx - 12, y: ty, a: 0 }, { x: tx + 12, y: ty, a: Math.PI });
      }
      it.guests.push({ x: x0 + 14, y: y0 + 24, a: 0, anim: "bench" }, { x: x0 + 72, y: y0 + 24, a: Math.PI, anim: "talk" });
      F("palm", x0 + 10, y1 - 10, 14, 14); F("plant", x1 - 10, y1 - 10, 12, 12);
      onN("art", cx, 26, "#ff5ad1", "sun"); onS("neon", cx - 10, 44, "#ff5ad1", "CAFÉ MARISOL", 28);
      it.floor = ["checker", "#d6cdbd"]; it.wallTex = ["paint", "#dcbf98"];
      break;
    }
    case "office": {
      F("desk", x1 - 26, cy, 30, 16, WEST, "#5a3a22", { solid: true });
      F("pc", x1 - 24, cy, 18, 9, WEST, "#222", { z: 13 }); F("lamp", x1 - 8, y0 + 10, 8, 8);
      it.counter = { x: x1 - 46, y: cy }; it.clerk = { x: x1 - 10, y: cy, a: Math.PI };
      F("crate", x0 + 16, y0 + 14, 16, 16, 0, "#8a6a3a", { solid: true }); F("crate", x0 + 16, y0 + 31, 14, 14, 0.3, "#7a5a32", { solid: true });
      F("drum", x0 + 34, y0 + 12, 10, 10, 0, "#2e6da4", { solid: true });
      F("files", cx, y1 - 6, 18, 9, NORTH, "#5a6a5a", { solid: true });
      F("armchair", x0 + 36, y1 - 14, 16, 14, NORTH, "#5a3a2a", { solid: true });
      onN("map", cx + 10, 34, "#c9b07a", undefined, 14);
      it.floor = ["planks", "#7a5a3a"]; it.wallTex = ["wood", "#6a5038"];
      break;
    }
    case "harbor": {
      deskAt("reception", x0 + 48, cy, 40, "#2e6da4");
      F("desk", x1 - 18, y0 + 22, 26, 14, WEST, "#6a4a32", { solid: true }); F("pc", x1 - 16, y0 + 22, 18, 9, WEST, "#222", { z: 13 });
      F("files", x1 - 6, y1 - 20, 18, 9, WEST, "#5a6a7a", { solid: true });
      F("bench", x0 + 22, y1 - 6, 30, 8, NORTH, "#5a6a7a");
      it.seats.push({ x: x0 + 16, y: y1 - 9, a: -Math.PI / 2 }, { x: x0 + 28, y: y1 - 9, a: -Math.PI / 2 });
      F("plant", x0 + 8, y0 + 8, 12, 12); F("palm", x1 - 10, y1 - 40, 14, 14);
      onE("map", cy + 4, 40, "#c9b07a", undefined, 14); onN("board", x0 + 40, 28, "#f4f4f4", "FAHRPLAN", 18);
      it.floor = ["terrazzo", "#d8d2c6"]; it.wallTex = ["paint", "#dfe8ee"];
      break;
    }
    case "precinct": {
      F("desk", x1 - 26, cy, 30, 16, WEST, "#3a2a1a", { solid: true });
      F("pc", x1 - 24, cy + 4, 18, 9, WEST, "#222", { z: 13 }); F("lamp", x1 - 8, y1 - 10, 8, 8);
      it.counter = { x: x1 - 46, y: cy }; it.clerk = { x: x1 - 10, y: cy, a: Math.PI };
      F("shelf", cx - 4, y0 + 5, 30, 8, SOUTH, "#5a3a22", { solid: true });
      F("files", x0 + 12, y0 + 8, 16, 9, SOUTH, "#6a7a8a", { solid: true });
      F("armchair", x0 + 30, y1 - 14, 16, 14, NORTH, "#5a2a2a", { solid: true }); F("plant", x0 + 10, y1 - 10, 12, 12);
      F("rug", cx - 6, cy, 50, 40, 0, "#7a2a2a", { c2: "#c9a227" });
      onS("board", cx + 10, 34, "#f4f4f4", "FALL VALE", 18);
      it.floor = ["carpet", "#3a4a6a"]; it.wallTex = ["wood", "#5a4030"];
      break;
    }
    case "club": {
      // bar along the north wall, a lit dance floor, the DJ at the east wall, booths
      F("bar", cx + 10, y0 + 14, 60, 12, SOUTH, "#2a1a3a", { solid: true });
      F("bottles", cx + 10, y0 + 2, 50, 3, SOUTH, "#3a2a4a", { z: 18 });
      it.counter = { x: cx + 10, y: y0 + 30 }; it.clerk = { x: cx + 10, y: y0 + 5, a: Math.PI / 2 };
      for (let k = 0; k < 4; k++) { F("stool", cx - 14 + k * 14, y0 + 27, 7, 7, 0, "#c9ced8"); it.seats.push({ x: cx - 14 + k * 14, y: y0 + 27, a: -Math.PI / 2 }); }
      P("dancefloor", cx + 16, cy + 22, Math.min(72, W - 70), Math.min(60, L - 70), 0.4, "#ff3cac");
      F("dj", x1 - 12, cy + 22, 26, 12, WEST, "#15161b", { solid: true });
      F("booth", x0 + 22, y1 - 22, 30, 36, 0, "#7a1a4a", { solid: true });
      F("jukebox", x0 + 10, y0 + 12, 12, 10, EAST, "#9d4dff", { solid: true });
      F("column", cx - 26, cy + 10, 8, 8, 0, "#2a2a35", { solid: true });
      onS("neon", cx + 16, 50, "#ff3cac", "NEON TIDE", 28); onE("neon", y0 + 30, 34, "#2bf0ff", "DANCE", 26);
      for (const [gx, gy, ga, an] of [[cx + 6, cy + 14, 0.4, "talk"], [cx + 28, cy + 30, 3.4, "talk"], [cx + 20, cy + 6, 1.8, "phone"], [x1 - 6, cy + 22, Math.PI, "lookAround"], [cx - 8, y0 + 34, -1.2, "smoke"]] as [number, number, number, string][]) it.guests.push({ x: gx, y: gy, a: ga, anim: an });
      it.floor = ["tile", "#221c30"]; it.wallTex = ["paint", "#1f1a2e"];
      break;
    }
    case "loft": {
      // a whole loft to buy: bedroom corner, living area, open kitchen, bathroom behind a partition
      it.bed = { x: x1 - 46, y: y0 + 22 };
      F("bed", x1 - 22, y0 + 22, 28, 36, WEST, "#2e4a7a", { solid: true });
      F("side", x1 - 8, y0 + 44, 10, 8, WEST, "#5a3a22"); F("lamp", x1 - 8, y0 + 56, 8, 8);
      F("wardrobe", x1 - 58, y0 + 6, 28, 10, SOUTH, "#6b4a2e", { solid: true });
      F("counter", x0 + 20, y0 + 7, 22, 14, SOUTH, "#e8e4dc", { solid: true }); F("stove", x0 + 40, y0 + 7, 18, 14, SOUTH, "#e8e4dc", { solid: true });
      F("sink", x0 + 58, y0 + 7, 18, 14, SOUTH, "#e8e4dc", { solid: true }); F("fridge", x0 + 75, y0 + 7, 14, 12, SOUTH, "#c9ced8", { solid: true });
      F("table", x0 + 40, y0 + 38, 28, 16, 0, "#6a4a32", { solid: true });
      for (const [tx, ty, ta] of [[x0 + 32, y0 + 28, SOUTH], [x0 + 48, y0 + 28, SOUTH], [x0 + 32, y0 + 48, NORTH], [x0 + 48, y0 + 48, NORTH]] as [number, number, number][]) F("chair", tx, ty, 9, 9, ta, "#3a2a1a");
      F("tv", cx - 6, cy + 4, 34, 10, SOUTH, "#3a2a1a", { solid: true });
      F("coffee", cx - 6, cy + 22, 26, 12, 0, "#6a4a32");
      F("sofa", cx - 6, cy + 40, 48, 16, NORTH, "#3a5a7a", { solid: true });
      F("rug", cx - 6, cy + 24, 64, 44, 0, "#c9a070", { c2: "#8a4a3a" });
      it.seats.push({ x: cx - 14, y: cy + 35, a: -Math.PI / 2 }, { x: cx + 2, y: cy + 35, a: -Math.PI / 2 });
      // bathroom in the south-east corner
      const bw = 44, bh = 42;
      wall(x1 - bw, y1 - bh, 3, bh); wall(x1 - bw, y1 - bh, 12, 3);
      F("shower", x1 - 10, y1 - 10, 16, 16, NORTH, "#f4f2ee"); F("toilet", x1 - bw + 10, y1 - 8, 10, 12, NORTH);
      F("basin", x1 - 4, y1 - bh + 14, 12, 8, WEST, "#f4f2ee");
      F("plant", x0 + 8, y1 - 10, 12, 12); F("palm", cx + 30, y1 - 10, 14, 14); F("lamp", cx + 26, cy + 4, 8, 8);
      onN("art", x1 - 22, 22, "#ff8a1f", "sun", 22); onS("art", cx - 6, 30, "#2bb3ff", "wave", 20);
      it.counter = { x: it.bed.x, y: it.bed.y + 22 }; it.clerk = { x: -1e5, y: -1e5, a: 0 };
      it.homes = [{ id: "loft", name: "Loft am Hafen", price: 25000, bed: it.bed, x0, y0, x1, y1 }];
      it.floor = ["parquet", "#a07850"]; it.wallTex = ["brick", "#b46a4a"];
      break;
    }
    case "mall": case "tower": break;
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
  addF(it, "palm", it.x0 + 14, it.y0 + 14, 16, 16); addF(it, "palm", it.x1 - 14, it.y0 + 14, 16, 16); addF(it, "palm", it.x0 + 14, it.y1 - 14, 16, 16); addF(it, "palm", it.x1 - 14, it.y1 - 14, 16, 16);
  addF(it, "bench", cx - 40, cy - 40, 30, 8, 0, "#6a4a32"); addF(it, "bench", cx + 40, cy - 40, 30, 8, 0, "#6a4a32");
  addF(it, "vending", it.x0 + 6, cy + 40, 14, 10, -Math.PI / 2, "#2bb3ff", { solid: true });
  solidProps(it);
  for (const [x, y, a] of [[cx - 40, cy - 30, 0], [cx + 40, cy - 10, Math.PI], [cx - 100, cy + 20, 0.5], [cx + 90, gy - 30, Math.PI]] as [number, number, number][]) it.guests.push({ x, y, a, anim: Math.random() < 0.5 ? "talk" : "phone" });
  blk.buildings.push(...it.walls);
  pl.x = it.counter.x; pl.y = it.counter.y; pl.a = 0;
  return it;
}
const P = (it: Interior, k: string, x: number, y: number, w: number, d: number, h: number, c: string, solid = false) => it.props.push({ k, x, y, w, d, h, c, solid });

// the apartment tower: a whole block, lobby at the door, a corridor through the middle, two flats on each side
// (every flat furnished: living room, kitchen, bedroom, bathroom; each one can be bought)
export const FLAT_PRICES = [8000, 10000, 12500, 15000];
function buildTower(world: World, pl: Place): Interior | null {
  if (!pl.bld) return null;
  const blk = world.blockAt(pl.bld.x + 1, pl.bld.y + 1);
  if (!blk) return null;
  const s0x = blk.bx * BLOCK + ROAD, s0y = blk.by * BLOCK + ROAD, size = BLOCK - ROAD;
  const x0 = s0x + 18, y0 = s0y + 25, x1 = s0x + size - 25, y1 = s0y + size - 25, cy = (y0 + y1) / 2;
  blk.buildings.length = 0; blk.trees.length = 0;
  const H = 46, dw = 26, CH = 24, LOBBY = 60, PER = 2;
  const it: Interior = {
    id: "tower", kind: "tower", name: pl.name, color: pl.color, x0: x0 + T, y0: y0 + T, x1: x1 - T, y1: y1 - T, H,
    door: { x: x0, y: cy, w: dw }, counter: { x: 0, y: 0 }, clerk: { x: 0, y: 0, a: 0 }, props: [], seats: [], guests: [], walls: [], homes: [],
    floor: ["marble", "#cfc6b8"], wallTex: ["paint", "#d6cebf"],
  };
  const w = (x: number, y: number, ww: number, hh: number) => it.walls.push(wallB(x, y, ww, hh, H));
  w(x0, y0, T, cy - dw / 2 - y0); w(x0, cy + dw / 2, T, y1 - cy - dw / 2);
  w(x1 - T, y0, T, y1 - y0); w(x0, y0, x1 - x0, T); w(x0, y1 - T, x1 - x0, T);
  const ix0 = it.x0, ix1 = it.x1, iy0 = it.y0, iy1 = it.y1, fx0 = ix0 + LOBBY, fw = (ix1 - fx0) / PER;
  // lobby: concierge, letter boxes, the lift, a sofa
  addF(it, "reception", ix0 + 30, cy - 56, 40, 12, 0, "#6a4a32", { solid: true });
  it.counter = { x: ix0 + 30, y: cy - 38 }; it.clerk = { x: ix0 + 30, y: cy - 66, a: Math.PI / 2 };
  addF(it, "mail", ix0 + 30, iy0 + 5, 34, 8, 0, "#8a9098", { solid: true });
  addF(it, "elevator", ix0 + 30, iy1 - 6, 30, 10, Math.PI, "#8a9098", { solid: true });
  addF(it, "sofa", ix0 + 8, cy + 56, 40, 14, -Math.PI / 2, "#7a5a3a", { solid: true });
  it.seats.push({ x: ix0 + 11, y: cy + 50, a: 0 }, { x: ix0 + 11, y: cy + 62, a: 0 });
  addF(it, "palm", ix0 + 52, cy - 34, 14, 14); addF(it, "palm", ix0 + 52, cy + 34, 14, 14); addF(it, "plant", ix0 + 8, iy0 + 30, 12, 12);
  addF(it, "rug", ix0 + 30, cy, 44, 70, 0, "#8a2a2a", { c2: "#c9a227" });
  it.guests.push({ x: ix0 + 40, y: cy + 80, a: Math.PI, anim: "phone" });
  // corridor walls with a door to each flat, walls between the flats
  for (const side of [-1, 1]) {
    const wy = side < 0 ? cy - CH - 3 : cy + CH;
    for (let k = 0; k < PER; k++) {
      const a = fx0 + k * fw, door = a + 14;
      w(a, wy, door - a, 3); w(door + 28, wy, a + fw - door - 28, 3);
      w(a, side < 0 ? iy0 : cy + CH, 3, side < 0 ? cy - CH - iy0 : iy1 - cy - CH);
    }
  }
  // the six flats
  let n = 0;
  for (const side of [-1, 1]) for (let k = 0; k < PER; k++) {
    const a = fx0 + k * fw + 3, b = fx0 + (k + 1) * fw, near = side < 0 ? cy - CH - 3 : cy + CH + 3, far = side < 0 ? iy0 : iy1;
    flat(it, a, b, near, far, n, side < 0 ? "Nord" : "Süd");
    n++;
  }
  for (const p of it.props) if (p.solid) { const t = turned(p); it.walls.push(wallB(p.x - (t ? p.d : p.w) / 2, p.y - (t ? p.w : p.d) / 2, t ? p.d : p.w, t ? p.w : p.d, 16, true)); }
  blk.buildings.push(...it.walls);
  pl.x = it.counter.x; pl.y = it.counter.y; pl.a = 0;
  return it;
}

// one flat between x a..b; near: its corridor wall, far: the outer wall (u across from a, v from the corridor)
const FLAT_LOOK = [
  { sofa: "#3a5a7a", bed: "#2e4a7a", rug: "#c9a070", wood: "#6a4a32", art: "sun" },
  { sofa: "#7a3a4a", bed: "#7a2a3a", rug: "#8a9a6a", wood: "#3a2a1a", art: "wave" },
  { sofa: "#4a6a3a", bed: "#3a5a3a", rug: "#c97a5a", wood: "#8a6a4a", art: "abstract" },
  { sofa: "#c9a070", bed: "#5a4a8a", rug: "#2e6da4", wood: "#5a3a22", art: "sea" },
  { sofa: "#2a2d33", bed: "#c0392b", rug: "#e8e2d4", wood: "#2a2016", art: "abstract" },
  { sofa: "#9d4dff", bed: "#2bb3ff", rug: "#ffd23f", wood: "#c9a070", art: "sun" },
];
function flat(it: Interior, a: number, b: number, near: number, far: number, n: number, side: string) {
  const dir = Math.sign(far - near), D = Math.abs(far - near), Wf = b - a, lk = FLAT_LOOK[n % FLAT_LOOK.length];
  const X = (u: number) => a + u, Y = (v: number) => near + dir * v;
  const IN = dir > 0 ? 0 : Math.PI;            // front looks away from the corridor (into the flat)
  const OUT = dir > 0 ? Math.PI : 0;           // front looks to the corridor
  const LEFT = -Math.PI / 2, RIGHT = Math.PI / 2; // front looks east (+u) / west (-u)
  const F = (k: string, u: number, v: number, w: number, d: number, ang: number, c = "#8a8a8a", o: FOpt = {}) => addF(it, k, X(u), Y(v), w, d, ang, c, o);
  const sit = (u: number, v: number, toCorridor: boolean) => it.seats.push({ x: X(u), y: Y(v), a: (toCorridor ? -dir : dir) * Math.PI / 2 });
  // bathroom by the corridor on the right: shower, toilet, basin with a mirror
  const bu = Wf - 40, bv = 40;
  it.walls.push(wallB(X(bu) - 1.5, Math.min(Y(0), Y(bv)), 3, bv, it.H), wallB(X(bu), Y(bv) - 1.5, 8, 3, it.H));
  F("toilet", bu + 10, 7, 10, 12, IN); F("shower", Wf - 9, 9, 16, 16, IN, "#f4f2ee"); F("basin", Wf - 6, 30, 12, 8, RIGHT, "#f4f2ee");
  F("plant", 8, 8, 10, 10, 0);
  // kitchen along the left wall, a small dining table
  F("counter", 7, bv + 10, 14, 14, LEFT, "#e8e4dc", { solid: true }); F("stove", 7, bv + 24, 14, 14, LEFT, "#e8e4dc", { solid: true });
  F("sink", 7, bv + 38, 14, 14, LEFT, "#e8e4dc", { solid: true }); F("fridge", 7, bv + 52, 12, 12, LEFT, "#c9ced8", { solid: true });
  F("table", 34, bv + 30, 16, 16, 0, lk.wood, { solid: true }); F("chair", 34, bv + 20, 9, 9, IN, lk.wood); F("chair", 34, bv + 40, 9, 9, OUT, lk.wood);
  // living room on the right: TV on a stand, sofa facing it, coffee table on a rug
  const lu = Wf - 34;
  F("tv", lu, bv + 10, 32, 9, IN, lk.wood, { solid: true });
  F("rug", lu, bv + 28, 44, 30, 0, lk.rug, { c2: lk.sofa });
  F("coffee", lu, bv + 28, 22, 11, 0, lk.wood);
  F("sofa", lu, bv + 48, 40, 15, OUT, lk.sofa, { solid: true });
  sit(lu - 8, bv + 43, true); sit(lu + 8, bv + 43, true);
  F("lamp", Wf - 7, bv + 48, 8, 8, 0); F("palm", Wf - 9, bv + 66, 14, 14, 0);
  // bedroom at the far wall: bed with its head at the wall, wardrobe, desk, side tables, a picture over the bed
  const bedU = Wf * 0.56, bedV = D - 18;
  F("bed", bedU, bedV, 28, 34, OUT, lk.bed, { solid: true });
  F("side", bedU - 21, D - 6, 9, 8, OUT, lk.wood); F("side", bedU + 21, D - 6, 9, 8, OUT, lk.wood);
  F("wardrobe", 7, D - 20, 28, 10, LEFT, lk.wood, { solid: true });
  F("desk", Wf - 8, D - 24, 24, 12, RIGHT, lk.wood, { solid: true }); F("pc", Wf - 8, D - 24, 18, 9, RIGHT, "#222", { z: 13 });
  F("rug", bedU, D - 44, 40, 18, 0, lk.rug);
  F("art", bedU, D - 0.6, 24, 1, OUT, lk.sofa, { z: 22, c2: lk.art });
  const bed = { x: X(bedU), y: Y(bedV - 24) };
  it.homes!.push({ id: "flat" + (n + 1), name: `Wohnung ${n + 1} (${side})`, price: FLAT_PRICES[n], bed, x0: Math.min(a, b), y0: Math.min(near, far), x1: Math.max(a, b), y1: Math.max(near, far) });
}

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
