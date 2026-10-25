// the 20 walkable rooms: shops, the clinic, the police station, the contacts' places, a night club and homes.
// A room sits inside its place's building (its walls are thin buildings, so people and cars collide with them
// like with any building), a door to the street, a counter where you buy, furniture per room.
// The mall and the apartment tower fill a whole block (mall: upper floor with escalators; tower: six flats).
import { BLOCK, ROAD, H_SCALE, PRISON, World, type Building } from "./world";
import { GAS_SHOP } from "./terrain";
import type { Place } from "./places";

export type InteriorKind = "gun" | "boutique" | "taco" | "burger" | "workshop" | "safehouse" | "market" | "cardealer" | "barber" | "mall"
  | "hospital" | "police" | "garage" | "cafe" | "office" | "harbor" | "precinct" | "club" | "loft" | "tower" | "jail" | "mess" | "rec"
  | "gas247" | "bar" | "pharmacy" | "boats" | "planes";
// k "f:<kind>": a piece from the furniture library (render/furniture.ts); w, d are its size before turning by a
// (a = 0: the front looks south (+y), PI/2 west, PI north, -PI/2 east)
export interface Prop { k: string; x: number; y: number; w: number; d: number; h: number; a?: number; z?: number; lv?: number; c?: string; c2?: string; solid?: boolean }
// a flat or house you can buy: sleep in its bed (heals, saves the game)
export interface Home { id: string; name: string; price: number; bed: { x: number; y: number; z?: number }; x0: number; y0: number; x1: number; y1: number; z?: number }
export interface Seat { x: number; y: number; a: number; z?: number } // z: the floor it is on (tower, roof)
export interface Interior {
  id: string; kind: InteriorKind; name: string; color: string;
  x0: number; y0: number; x1: number; y1: number; // inside of the walls
  H: number;                                      // ceiling
  door: { x: number; y: number; w: number };      // in the west wall (x = x0)
  counter: { x: number; y: number };              // you stand here to buy
  clerk: { x: number; y: number; a: number };
  props: Prop[];
  seats: Seat[];
  guests: Guest[];
  walls: Building[];
  // shop specific
  range?: { x0: number; x1: number; y0: number; y1: number; stand: { x: number; y: number }; targets: { x: number; y: number }[] };
  mirror?: { x: number; y: number; w: number; h: number; a: number };
  lift?: { x: number; y: number };
  show?: { x: number; y: number; model: string; color: string }[];
  bed?: { x: number; y: number };
  homes?: Home[];
  cell?: { x0: number; y0: number; x1: number; y1: number; spawn: { x: number; y: number }; bunk: { x: number; y: number } }; // the prison cell you sit in
  heal?: boolean;                                 // clinic: you are patched up while you are inside
  floor?: [string, string]; wallTex?: [string, string]; // floor and wall look (texture style, colour)
  // mall: upper floors (galleries around the open middle), escalators between them, a lift
  levels?: Level[];
  escalators?: Escalator[];
  elevator?: Elevator;
  // prison: more openings than the main door (drawn as door frames), no shop front on the street side
  doors?: { x: number; y: number; w: number; alongX: boolean }[];
  prison?: boolean;
  yard?: { props: Prop[]; guests: Guest[] }; // outdoor things drawn with this room (the prison yard)
  // ceiling (texture style, colour), ceiling lamps ("panel", "spot", "tube" or "none": the room has its own pendants), light colour
  ceil?: [string, string]; lamps?: string; light?: string;
  // tower: height of one storey (walls of a storey are drawn that high), where the roof is open (stair well, lift shaft)
  storey?: number; roofHoles?: Rect[];
}
export interface Rect { x0: number; y0: number; x1: number; y1: number }
// a floor above the ground: you stand at height z wherever one of its slabs is
export interface Level { z: number; slabs: Rect[] }
// rises from za at y0 to zb at y1 (along y); up: which way the steps run
export interface Escalator { x0: number; x1: number; y0: number; y1: number; za: number; zb: number; up: boolean; stairs?: boolean } // stairs: a flight of steps (does not move)
// the lift: a cabin in a shaft, its door on the south side (y1); z: where the cabin is now, to: where it goes
export interface Elevator extends Rect { floors: number[]; names?: string[]; z: number; to: number; open: number }
export interface Guest { x: number; y: number; a: number; anim: string; z?: number; role?: string; shirt?: string; pants?: string }

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
  bar: ["bar", 150, 130], pharmacy: ["pharmacy", 120, 110], boats: ["boats", 170, 170], planes: ["planes", 170, 170],
};
const WIDE_DOOR = new Set<InteriorKind>(["workshop", "garage"]);

export function buildInteriors(world: World, places: Place[]): Interior[] {
  const out: Interior[] = [];
  for (const pl of places) {
    if (pl.id === "mall") { const m = buildMall(world, pl, places.find((q) => q.id === "electro")); if (m) out.push(m); continue; }
    if (pl.id === "gas") { out.push(buildGasShop(world, pl)); continue; }
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
  out.push(...buildPrison(world));
  return out;
}

// the 24/7 shop of the gas station by the northern highway (outside the city blocks: its walls are extras)
function buildGasShop(world: World, pl: Place): Interior {
  const g = GAS_SHOP, x0 = g.x0, x1 = g.x1, y0 = g.y0, y1 = g.y1, dy = (y0 + y1) / 2, H = 46, doorW = 20;
  const it: Interior = {
    id: pl.id, kind: "gas247", name: pl.name, color: pl.color, x0: x0 + T, y0: y0 + T, x1: x1 - T, y1: y1 - T, H,
    door: { x: x0, y: dy, w: doorW }, counter: { x: 0, y: 0 }, clerk: { x: 0, y: 0, a: 0 }, props: [], seats: [], guests: [], walls: [],
  };
  it.walls.push(
    wallB(x0, y0, T, dy - doorW / 2 - y0, H), wallB(x0, dy + doorW / 2, T, y1 - dy - doorW / 2, H),
    wallB(x1 - T, y0, T, y1 - y0, H), wallB(x0, y0, x1 - x0, T, H), wallB(x0, y1 - T, x1 - x0, T, H),
  );
  furnish(it);
  solidProps(it);
  world.addExtras(it.walls);
  pl.x = it.counter.x; pl.y = it.counter.y; pl.a = 0;
  return it;
}

// the prison: one building along the west wall of the yard with the cell block, the canteen and the recreation room
// (connected by doors), each with a door to the yard. Everything inside the outer wall is free to walk.
// The yard has a basketball court, a weights corner, benches and picnic tables (drawn with the cell block).
export const PRISON_BLD = { x0: PRISON.x0 + 6, x1: PRISON.x0 + 340, y0: -300, y1: 300, mess: 0, rec: 160 }; // y relative to the gate line
function buildPrison(world: World): Interior[] {
  const gy = (PRISON.y0 + PRISON.y1) / 2, B = PRISON_BLD, bx0 = B.x0, bx1 = B.x1, cxB = (bx0 + bx1) / 2;
  const yN = gy + B.y0, yM = gy + B.mess, yR = gy + B.rec, yS = gy + B.y1;
  const H = 50, DW = 24, walls: Building[] = [];
  const w = (x: number, y: number, ww: number, hh: number) => walls.push(wallB(x, y, ww, hh, H));
  // outer walls (doors to the yard in the east wall), the walls between the rooms with a door in the middle
  w(bx0, yN, T, yS - yN); w(bx0, yN, bx1 - bx0, T); w(bx0, yS - T, bx1 - bx0, T);
  const yardDoor = [gy - 80, gy + 80, gy + 230];
  let ey = yN;
  for (const dy of yardDoor) { w(bx1 - T, ey, T, dy - DW / 2 - ey); ey = dy + DW / 2; }
  w(bx1 - T, ey, T, yS - ey);
  for (const yy of [yM, yR]) { w(bx0, yy - T / 2, cxB - DW / 2 - bx0, T); w(cxB + DW / 2, yy - T / 2, bx1 - cxB - DW / 2, T); }
  const room = (id: string, kind: InteriorKind, name: string, y0: number, y1: number, door: number): Interior => ({
    id, kind, name, color: "#8a9098", x0: bx0 + T, y0, x1: bx1 - T, y1, H, prison: true,
    door: { x: bx1, y: door, w: DW }, counter: { x: -1e5, y: -1e5 }, clerk: { x: -1e5, y: -1e5, a: 0 }, props: [], seats: [], guests: [], walls: [],
    doors: [{ x: bx1 - T / 2, y: door, w: DW, alongX: false }],
  });
  const cells = room("jail", "jail", "Zellentrakt", yN + T, yM - T / 2, yardDoor[0]);
  const mess = room("mess", "mess", "Mensa", yM + T / 2, yR - T / 2, yardDoor[1]);
  const rec = room("rec", "rec", "Freizeitraum", yR + T / 2, yS - T, yardDoor[2]);
  cells.doors!.push({ x: cxB, y: yM, w: DW, alongX: true }); mess.doors!.push({ x: cxB, y: yM, w: DW, alongX: true }, { x: cxB, y: yR, w: DW, alongX: true }); rec.doors!.push({ x: cxB, y: yR, w: DW, alongX: true });
  cells.walls = walls;
  for (const it of [cells, mess, rec]) { it.floor = ["concrete", "#8a8780"]; it.wallTex = ["block", "#c9c3b4"]; it.ceil = ["concrete", "#a8a49c"]; it.lamps = "tube"; it.light = "#eef4ff"; }
  mess.floor = ["tile", "#b8b2a4"]; mess.wallTex = ["tile2", "#d8d4c8"]; rec.floor = ["lino", "#9aa49a"]; rec.wallTex = ["block", "#b8c4bc"];
  furnishCells(cells, yardDoor[0]); furnishMess(mess); furnishRec(rec);
  for (const it of [cells, mess, rec]) { solidProps(it); world.addExtras(it.walls); }
  cells.yard = prisonYard(world, gy);
  return [cells, mess, rec];
}
const inmate = (x: number, y: number, a: number, anim: string) => ({ x, y, a, anim, shirt: "#e8742a", pants: "#e8742a" });
const guard = (x: number, y: number, a: number, anim = "idle") => ({ x, y, a, anim, role: "cop" });

// two rows of cells (west wall, east wall) facing the day room with the guard desk; the corridor to the yard door
function furnishCells(it: Interior, door: number) {
  const { x0, x1, y0, y1 } = it, CD = 58, CW = (y1 - y0) / 6;
  const F = (k: string, x: number, y: number, w: number, d: number, a = 0, c = "#8a8a8a", o: FOpt = {}) => addF(it, k, x, y, w, d, a, c, o);
  const wall = (x: number, y: number, w: number, h: number) => it.walls.push(wallB(x, y, w, h, it.H));
  // a cell: bunk bed at the back wall, toilet and basin, a shelf, a poster; bars with an open door to the day room
  const cell = (side: -1 | 1, c0: number, n: number) => {
    const back = side < 0 ? x0 : x1, front = side < 0 ? x0 + CD : x1 - CD, mid = c0 + CW / 2, IN = side < 0 ? -Math.PI / 2 : Math.PI / 2; // IN: front looks into the cell from the back wall
    wall(Math.min(back, front), c0 - 1.5, CD, 3);
    // bars: two pieces either side of the open cell door
    F("bars", front, c0 + 6, 2, 12, 0, "#5a5d66", { solid: true }); F("bars", front, c0 + CW - 7, 2, 14, 0, "#5a5d66", { solid: true });
    F("celldoor", front - side * 8, c0 + 13, 16, 2, side < 0 ? -0.5 : 0.5, "#5a5d66");
    F("bunk", back - side * 10, c0 + 20, 32, 18, IN, "#6a6e76", { solid: true });
    F("toilet", back - side * 6, c0 + CW - 8, 9, 10, IN, "#d8dce0"); F("basin", back - side * 26, c0 + CW - 2.5, 10, 6, Math.PI, "#d8dce0");
    F("wallshelf", back - side * 1.5, c0 + 20, 16, 3, IN, "#6a6e76", { z: 30 });
    F("poster", back - side * 36, c0 + 1.6, 12, 1, 0, ["#c0392b", "#2e6da4", "#e1b12c", "#2d8a5a"][n % 4], { z: 16, c2: ["sun", "wave", "abstract", "sea"][n % 4] });
    F("lampwall", back - side * 30, c0 + CW - 1.6, 6, 2, Math.PI, "#fff4d6", { z: 32 });
    return { mid, back, front };
  };
  let n = 0;
  const mine = { x0: 0, y0: 0, x1: 0, y1: 0, spawn: { x: 0, y: 0 }, bunk: { x: 0, y: 0 } };
  for (let k = 0; k < 6; k++) {
    const c0 = y0 + k * CW, c = cell(-1, c0, n++);
    if (k === 2) Object.assign(mine, { x0: x0, y0: c0, x1: x0 + CD, y1: c0 + CW, spawn: { x: x0 + 40, y: c0 + 24 }, bunk: { x: x0 + 24, y: c0 + 20 } });
    else if (k % 2 === 0) it.guests.push(inmate(x0 + 34, c.mid + 10, 0, k === 0 ? "smoke" : "lookAround"));
  }
  // east row: cells north of the corridor to the yard door and one south of it
  const cor0 = door - 26, cor1 = door + 26;
  const skip = (k: number) => y0 + (k + 1) * CW > cor0 && y0 + k * CW < cor1;
  for (let k = 0; k < 6; k++) {
    const c0 = y0 + k * CW;
    if (skip(k)) continue;
    const c = cell(1, c0, n++);
    if (k < 5 && skip(k + 1)) wall(x1 - CD, c0 + CW - 1.5, CD, 3); // the corridor to the yard door begins here
    if (k === 1) it.guests.push(inmate(x1 - 34, c.mid + 10, Math.PI, "bench"));
  }
  it.cell = mine;
  // the day room: guard desk by the corridor, steel tables with stools, a TV on the north wall, notice board, showers in the south
  const hx0 = x0 + CD + 6, hx1 = x1 - CD - 6, hc = (hx0 + hx1) / 2;
  F("guarddesk", x1 - 30, door - 36, 34, 14, 0, "#5a5e66", { solid: true });
  F("pc", x1 - 34, door - 38, 16, 8, 0, "#222", { z: 15 });
  it.guests.push(guard(x1 - 30, door - 48, Math.PI / 2, "idle"), guard(hc + 40, y1 - 40, 0.4, "lookAround"));
  for (const [tx, ty] of [[hc - 40, y0 + 70], [hc + 10, y0 + 70], [hc - 40, y0 + 150], [hc + 10, y0 + 150]]) {
    F("steeltable", tx, ty, 22, 22, 0, "#9aa3ad", { solid: true });
    for (const [sx, sy] of [[-15, 0], [15, 0], [0, -15], [0, 15]]) F("stool", tx + sx, ty + sy, 7, 7, 0, "#9aa3ad");
    it.seats.push({ x: tx - 15, y: ty, a: 0 }, { x: tx + 15, y: ty, a: Math.PI });
  }
  it.guests.push(inmate(hc - 55, y0 + 70, 0, "bench"), inmate(hc - 25, y0 + 70, Math.PI, "talk"), inmate(hc + 10, y0 + 135, Math.PI / 2, "phone"));
  F("tvwall", hc - 15, y0 + 2, 34, 2, 0, "#15161b", { z: 22 });
  F("board", hc + 40, y0 + 0.6, 34, 1, 0, "#f4f4f4", { z: 16, c2: "HAUSORDNUNG" });
  F("board", hx0 + 32, y1 - 0.6, 30, 1, Math.PI, "#f4f4f4", { z: 30, c2: "DUSCHEN 7–8 UHR" });
  F("showers", hx0 + 32, y1 - 8, 60, 14, Math.PI, "#d8dce0");
  F("camera", hx0 + 2, y0 + 4, 4, 4, -Math.PI / 4, "#2a2d33", { z: 38 }); F("camera", hx1 - 2, y1 - 4, 4, 4, Math.PI * 0.75, "#2a2d33", { z: 38 });
}

// the canteen: serving counter with the kitchen along the west wall, long tables with benches, a clock, the menu
function furnishMess(it: Interior) {
  const { x0, x1, y0, y1 } = it, cy = (y0 + y1) / 2;
  const F = (k: string, x: number, y: number, w: number, d: number, a = 0, c = "#8a8a8a", o: FOpt = {}) => addF(it, k, x, y, w, d, a, c, o);
  F("stove", x0 + 7, cy - 30, 18, 14, -Math.PI / 2, "#c9ced8", { solid: true }); F("stove", x0 + 7, cy - 10, 18, 14, -Math.PI / 2, "#c9ced8", { solid: true });
  F("sink", x0 + 7, cy + 12, 18, 14, -Math.PI / 2, "#c9ced8", { solid: true }); F("fridge", x0 + 7, cy + 36, 16, 12, -Math.PI / 2, "#c9ced8", { solid: true });
  F("shelfsteel", x0 + 6, y0 + 16, 24, 10, -Math.PI / 2, "#9aa3ad", { solid: true });
  F("servery", x0 + 42, cy, 90, 12, -Math.PI / 2, "#9aa3ad", { solid: true });
  it.guests.push({ x: x0 + 26, y: cy - 20, a: 0, anim: "idle", shirt: "#f4f4f4", pants: "#3a3d45" }, { x: x0 + 26, y: cy + 22, a: 0, anim: "lookAround", shirt: "#f4f4f4", pants: "#3a3d45" });
  F("trays", x0 + 42, y0 + 20, 10, 12, -Math.PI / 2, "#c0392b", { solid: true });
  const tx0 = x0 + 100, rows = [cy - 42, cy + 2, cy + 46];
  for (const ty of rows) for (const tx of [tx0, tx0 + 132]) {
    F("longtable", tx, ty, 60, 14, 0, "#9aa3ad", { solid: true });
    F("bench", tx, ty - 13, 56, 6, 0, "#6a6e76", { h: 8 }); F("bench", tx, ty + 13, 56, 6, Math.PI, "#6a6e76", { h: 8 });
    for (const sx of [-18, 0, 18]) it.seats.push({ x: tx + sx, y: ty - 13, a: Math.PI / 2 }, { x: tx + sx, y: ty + 13, a: -Math.PI / 2 });
    F("tray", tx - 18, ty - 3, 8, 6, 0, "#c0392b", { z: 13 }); F("tray", tx + 18, ty + 3, 8, 6, 0, "#2e6da4", { z: 13 });
  }
  for (const [gx, gy, a, an] of [[tx0 - 18, rows[0] - 13, Math.PI / 2, "bench"], [tx0 + 132, rows[1] + 13, -Math.PI / 2, "bench"], [tx0 + 150, rows[1] + 13, -Math.PI / 2, "talk"], [tx0 + 114, rows[2] - 13, Math.PI / 2, "bench"]] as [number, number, number, string][]) it.guests.push(inmate(gx, gy, a, an));
  it.guests.push(guard(x1 - 20, y0 + 20, Math.PI * 0.8, "lookAround"));
  F("board", x0 + 120, y0 + 0.6, 40, 1, 0, "#f4f4f4", { z: 18, c2: "SPEISEPLAN" });
  F("clock", x0 + 190, y0 + 0.6, 10, 1, 0, "#f4f4f4", { z: 30 });
  F("bin", x1 - 10, y1 - 10, 10, 10, 0, "#5a6a5a", { solid: true });
  F("camera", x1 - 3, y1 - 3, 4, 4, Math.PI * 0.75, "#2a2d33", { z: 38 });
}

// recreation room: TV corner with sofas, table tennis, card tables, a small library, a pool table
function furnishRec(it: Interior) {
  const { x0, x1, y0, y1 } = it, cy = (y0 + y1) / 2, cx = (x0 + x1) / 2;
  const F = (k: string, x: number, y: number, w: number, d: number, a = 0, c = "#8a8a8a", o: FOpt = {}) => addF(it, k, x, y, w, d, a, c, o);
  F("tv", x0 + 50, y1 - 6, 34, 10, Math.PI, "#3a3d45", { solid: true });
  F("sofa", x0 + 50, y1 - 46, 44, 15, 0, "#5a6a7a", { solid: true }); F("armchair", x0 + 16, y1 - 30, 16, 14, -Math.PI / 2, "#6a5a4a", { solid: true });
  it.seats.push({ x: x0 + 42, y: y1 - 50, a: Math.PI / 2 }, { x: x0 + 58, y: y1 - 50, a: Math.PI / 2 });
  it.guests.push(inmate(x0 + 42, y1 - 50, Math.PI / 2, "bench"));
  F("pingpong", cx + 10, cy, 40, 22, 0, "#2d6a4a", { solid: true });
  it.guests.push(inmate(cx - 18, cy, 0, "idle"), inmate(cx + 38, cy, Math.PI, "lookAround"));
  F("pool", x1 - 50, y0 + 32, 44, 24, 0, "#2d7a4a", { solid: true });
  it.guests.push(inmate(x1 - 82, y0 + 30, 0, "smoke"));
  for (const tx of [x0 + 40, x0 + 90]) {
    F("table", tx, y0 + 32, 20, 20, 0, "#7a6a54", { solid: true });
    F("chair", tx, y0 + 18, 9, 9, 0, "#5a5d66"); F("chair", tx, y0 + 46, 9, 9, Math.PI, "#5a5d66");
    F("cards", tx, y0 + 32, 10, 8, 0, "#f4f4f4", { z: 13 });
  }
  it.guests.push(inmate(x0 + 40, y0 + 18, Math.PI / 2, "bench"), inmate(x0 + 90, y0 + 46, -Math.PI / 2, "bench"));
  F("shelf", x1 - 6, y0 + 22, 34, 10, Math.PI / 2, "#6a4a32", { solid: true }); F("shelf", x1 - 6, y1 - 22, 34, 10, Math.PI / 2, "#6a4a32", { solid: true });
  F("board", cx + 20, y0 + 0.6, 34, 1, 0, "#f4f4f4", { z: 16, c2: "KURSE & SPORT" });
  it.guests.push(guard(cx - 40, y1 - 14, -Math.PI / 2, "idle"));
  F("camera", x0 + 3, y0 + 3, 4, 4, -Math.PI / 4, "#2a2d33", { z: 38 });
}

// the yard: basketball court, weights, benches, picnic tables, lamp posts (solid things go into the world)
function prisonYard(world: World, gy: number): { props: Prop[]; guests: Guest[] } {
  const B = PRISON_BLD, X0 = B.x1 + 20, X1 = PRISON.x1 - 30, out: Prop[] = [], solid: Building[] = [], guests: Guest[] = [];
  const F = (k: string, x: number, y: number, w: number, d: number, a = 0, c = "#8a8a8a", o: FOpt & { hard?: boolean } = {}) => {
    out.push({ k: "f:" + k, x, y, w, d, h: o.h ?? 20, a, z: o.z ?? 0, c, c2: o.c2 });
    if (o.hard) { const t = Math.abs(Math.sin(a)) > 0.7; solid.push(wallB(x - (t ? d : w) / 2, y - (t ? w : d) / 2, t ? d : w, t ? w : d, 30, true)); }
  };
  const cx = (X0 + X1) / 2;
  F("court", cx, gy - 170, 150, 230, 0, "#7a4a3a", { c2: "#f4f4f4" });
  F("hoop", cx, gy - 170 - 112, 16, 6, 0, "#e8e8ec", { hard: true }); F("hoop", cx, gy - 170 + 112, 16, 6, Math.PI, "#e8e8ec", { hard: true });
  guests.push(inmate(cx - 20, gy - 200, 0.4, "talk"), inmate(cx + 25, gy - 150, 3.5, "idle"), inmate(cx - 50, gy - 250, 1.2, "lookAround"));
  F("weights", cx - 60, gy + 120, 30, 16, 0, "#2a2d33", { hard: true }); F("weights", cx - 10, gy + 120, 30, 16, 0, "#2a2d33", { hard: true });
  F("rack", cx + 40, gy + 110, 34, 10, 0, "#2a2d33", { hard: true });
  F("rubber", cx - 10, gy + 125, 140, 60, 0, "#2a2a2e");
  guests.push(inmate(cx - 60, gy + 135, Math.PI, "bench"), inmate(cx + 20, gy + 140, 2.2, "smoke"));
  for (const [x, y] of [[X0 + 20, gy + 40], [X0 + 20, gy + 250], [cx + 90, gy + 230]]) F("picnic", x, y, 34, 30, 0, "#7a5a3a", { hard: true });
  for (const y of [gy - 40, gy + 300]) F("bench", X1 - 60, y, 30, 8, Math.PI, "#5a6a5a", { hard: true, h: 8 });
  for (const [x, y] of [[X0 + 10, gy - 300], [X0 + 10, gy + 180], [X1 - 20, gy + 180], [X1 - 20, gy - 300]]) F("yardlamp", x, y, 6, 6, 0, "#5a5d66", { hard: true });
  guests.push(guard(X1 - 40, gy + 20, Math.PI, "lookAround"));
  world.addExtras(solid);
  return { props: out, guests };
}

// furniture per room (x: from the door into the room, y: along the street)
const SOUTH = 0, WEST = Math.PI / 2, NORTH = Math.PI, EAST = -Math.PI / 2; // where the front of a piece looks
interface FOpt { solid?: boolean; z?: number; c2?: string; h?: number; lv?: number }
// lv: the floor it stands on (mall), z: height above that floor
const addF = (it: Interior, k: string, x: number, y: number, w: number, d: number, a = 0, c = "#8a8a8a", o: FOpt = {}) =>
  it.props.push({ k: "f:" + k, x, y, w, d, h: o.h ?? 20, a, z: (o.z ?? 0) + (o.lv ?? 0), lv: o.lv, c, c2: o.c2, solid: o.solid ?? false });
// world size of a piece (turned by a quarter: width and depth swap)
const turned = (p: Prop) => p.k.startsWith("f:") && Math.abs(Math.sin(p.a ?? 0)) > 0.7;
function solidProps(it: Interior) {
  for (const p of it.props) if (p.solid) {
    const w = turned(p) ? p.d : p.w, d = turned(p) ? p.w : p.d;
    const wb = wallB(p.x - w / 2, p.y - d / 2, w, d, Math.max(16, (p.z ?? 0) - (p.lv ?? 0) + p.h), true);
    // on an upper floor: only solid up there
    it.walls.push(p.lv ? { ...wb, height: (p.lv + Math.max(16, p.h) - 14) / H_SCALE, zb: p.lv, zt: p.lv + Math.max(16, p.h) } : wb);
  }
}

function furnish(it: Interior) {
  const { x0, x1, y0, y1 } = it, W = x1 - x0, L = y1 - y0, cy = (y0 + y1) / 2, cx = (x0 + x1) / 2;
  const P = (k: string, x: number, y: number, w: number, d: number, h: number, c: string, solid = false, z = 0, a = 0) => it.props.push({ k, x, y, w, d, h, c, solid, z, a });
  const F = (k: string, x: number, y: number, w: number, d: number, a = 0, c = "#8a8a8a", o: FOpt = {}) => addF(it, k, x, y, w, d, a, c, o);
  // pictures, signs and windows on the walls (west wall: the street side with the door)
  const onN = (k: string, x: number, w: number, c: string, c2?: string, z = 16) => F(k, x, y0 + 0.6, w, 1, SOUTH, c, { z, c2 });
  const onS = (k: string, x: number, w: number, c: string, c2?: string, z = 16) => F(k, x, y1 - 0.6, w, 1, NORTH, c, { z, c2 });
  const onE = (k: string, y: number, w: number, c: string, c2?: string, z = 16) => F(k, x1 - 0.6, y, w, 1, WEST, c, { z, c2 });
  const onW = (k: string, y: number, w: number, c: string, c2?: string, z = 16) => F(k, x0 + 0.6, y, w, 1, EAST, c, { z, c2 });
  // the street windows either side of the door (seen from inside)
  const streetWindows = (c2?: string) => { for (const s of [-1, 1]) { const wy = cy + s * (it.door.w / 2 + 20); if (wy - 16 > y0 && wy + 16 < y1) onW("window", wy, 28, "#e8e4dc", c2, 6); } };
  const wall = (x: number, y: number, w: number, h: number) => it.walls.push(wallB(x, y, w, h, it.H));
  // a shop counter with the till: you stand in front of it (west), the clerk behind it
  const counterAt = (ccx: number, cyy: number, along: number, c = "#5a4636") => {
    F("shopcounter", ccx, cyy, along, 12, WEST, c, { solid: true });
    F("register", ccx, cyy - along * 0.25, 7, 6, WEST, "#2a2d33", { z: 16 });
    it.counter = { x: ccx - 16, y: cyy };
    it.clerk = { x: ccx + 11, y: cyy, a: Math.PI };
  };
  // a desk or bar with its front to the door: you stand in front (west), the clerk behind it
  const deskAt = (k: string, dx: number, dy: number, along: number, c: string) => {
    F(k, dx, dy, along, 12, WEST, c, { solid: true });
    it.counter = { x: dx - 16, y: dy };
    it.clerk = { x: dx + 11, y: dy, a: Math.PI };
  };
  const look = (ceil: [string, string], lamps: string, light: string) => { it.ceil = ceil; it.lamps = lamps; it.light = light; };
  switch (it.kind) {
    case "gun": {
      // shop in front: glass counters, a wall of rifles, ammo shelves; behind a partition the range with booths and lanes
      const split = x0 + W * 0.48;
      counterAt(split - 24, cy - 14, 46, "#2a2b30");
      F("case", x0 + 30, y1 - 12, 34, 12, NORTH, "#2a2b30", { solid: true }); F("case", x0 + 30, y0 + 12, 34, 12, SOUTH, "#2a2b30", { solid: true });
      F("gunwall", (x0 + split) / 2 - 4, y0 + 3, Math.min(60, split - x0 - 30), 4, SOUTH, "#3a3d45", { z: 4 });
      F("ammo", split - 14, y1 - 8, 22, 10, NORTH, "#3a3d45", { solid: true });
      for (let y = y0 + 14; y < y1 - 26; y += 20) P("gunrack", split - 3, y, 2, 16, 26, "#2a2b30", false, 10);
      it.walls.push(wallB(split, y0, 3, L / 2 - 14, it.H), wallB(split, cy + 14, 3, y1 - cy - 14, it.H));
      it.range = { x0: split + 4, x1: x1 - 2, y0, y1, stand: { x: split + 22, y: cy }, targets: [] };
      for (let k = 0; k < 4; k++) {
        const ly = y0 + 18 + k * ((L - 36) / 3);
        P("lane", (split + x1) / 2 + 10, ly, x1 - split - 30, 1, 0.3, "#e8e8ec");
        it.range.targets.push({ x: x1 - 12, y: ly });
        if (k < 3) F("rangebooth", split + 14, ly + (L - 36) / 6, 2, 16, EAST, "#5a5e66");
      }
      P("bench", split + 12, cy, 6, L - 20, 10, "#3a3d45", true);
      F("board", (split + x1) / 2, y0 + 0.6, 30, 1, SOUTH, "#f4f4f4", { z: 18, c2: "AUGEN & OHREN SCHÜTZEN" });
      onS("neon", x0 + 30, 40, "#ff9f43", "KALIBER", 30); onN("poster", x0 + 70, 12, "#c0392b", "target", 16);
      F("plant", x0 + 8, cy + 26, 10, 10, 0, "#3a7a3a");
      F("spotrail", (x0 + split) / 2, cy, 60, 2, 0, "#15161b");
      streetWindows("blinds");
      it.floor = ["polished", "#5e5e64"]; it.wallTex = ["brick", "#4a4d55"];
      look(["concrete", "#4a4a50"], "tube", "#fff4e6");
      break;
    }
    case "boutique": {
      counterAt(x1 - 18, y0 + 26, 34, "#f4f2ee");
      for (let k = 0; k < 2; k++) F("rack", x0 + 40 + k * 30, cy + 14, 26, 8, k ? NORTH : SOUTH, "#c9ced8", { solid: true });
      F("cubeshelf", x0 + 60, y0 + 6, 40, 10, SOUTH, "#f4f2ee", { solid: true });
      F("displaytable", x0 + 52, y0 + 36, 30, 16, 0, "#e8e4dc", { solid: true });
      F("mannequin", x0 + 14, cy - 24, 8, 8, EAST, "#ff6f91", { c2: "#1f2a44" }); F("mannequin", x0 + 14, cy + 24, 8, 8, EAST, "#2bb3ff", { c2: "#f4f4f4" });
      // changing booth with a mirror on its back wall
      P("booth", x1 - 20, y1 - 22, 26, 2, 30, "#7a4a6a", false, 0);
      it.mirror = { x: x1 - 1, y: y1 - 22, w: 18, h: 30, a: Math.PI };
      F("curtain", x1 - 20, y1 - 35, 24, 2, SOUTH, "#c86bff");
      F("armchair", x0 + 34, y1 - 12, 16, 14, NORTH, "#c86bff", { solid: true });
      F("rug", x0 + 56, cy + 14, 60, 50, 0, "#f2c7d8", { c2: "#c86bff" });
      for (const px of [x0 + 40, x0 + 80]) F("pendant", px, cy, 10, 10, 0, "#c9a227");
      F("palm", x0 + 10, y1 - 10, 14, 14); onN("art", x0 + 40, 26, "#ff3cac"); onE("neon", y0 + 50, 34, "#ff3cac", "BAY", 30);
      streetWindows();
      it.floor = ["herringbone", "#c8a882"]; it.wallTex = ["wallpaper", "#f6e8f0"];
      look(["plaster", "#f4eef0"], "spot", "#fff0f4");
      break;
    }
    case "taco": case "burger": {
      const taco = it.kind === "taco";
      counterAt(x1 - 16, cy, 56, taco ? "#c86a3a" : "#c0392b");
      F("menuboard", x1 - 1, cy, 44, 1, WEST, taco ? "#ffd23f" : "#ff3a4d", { z: 24, c2: taco ? "TACO LOCO" : "BURGER BUCHT" });
      if (!taco) F("shake", x1 - 16, cy + 22, 8, 6, WEST, "#c9ced8", { z: 16 });
      if (taco) {
        for (let k = 0; k < 4; k++) {
          const tx = x0 + 24 + (k % 2) * 36, ty = y0 + 26 + Math.floor(k / 2) * (L - 52);
          F("rtable", tx, ty, 16, 16, 0, "#d35400", { solid: true });
          F("chair", tx - 13, ty, 9, 9, EAST, "#2d8a5a"); F("chair", tx + 13, ty, 9, 9, WEST, "#e1b12c");
          it.seats.push({ x: tx - 13, y: ty, a: 0 }, { x: tx + 13, y: ty, a: Math.PI });
        }
        F("garland", cx, y0 + 30, W - 10, 2, 0, "#ff3cac"); F("garland", cx, y1 - 30, W - 10, 2, 0, "#ff3cac");
        F("cactus", x0 + 8, cy + 26, 10, 10); F("cactus", x0 + 8, cy - 26, 10, 10);
        onS("art", x0 + 40, 22, "#e67e22", "sun"); onN("poster", x0 + 60, 14, "#2d8a5a", "sun", 18);
      } else {
        // diner: booths along the north and south walls, stools at the counter
        for (const [by, a] of [[y0 + 18, SOUTH], [y1 - 18, NORTH]] as [number, number][]) for (const bx of [x0 + 30, x0 + 66]) {
          F("booth", bx, by, 30, 36, a + Math.PI / 2, "#c0392b", { solid: true });
          it.seats.push({ x: bx - 13, y: by, a: 0 }, { x: bx + 13, y: by, a: Math.PI });
        }
        for (let k = 0; k < 3; k++) F("stool", x1 - 32, cy - 18 + k * 18, 7, 7, 0, "#c0392b");
        F("jukebox", x0 + 8, cy + 26, 12, 10, EAST, "#c0392b", { solid: true });
        onS("art", x0 + 48, 22, "#2bb3ff", "sun"); onN("neon", x0 + 48, 30, "#2bf0ff", "OPEN", 30);
      }
      if (taco) it.guests.push({ x: x0 + 24 - 13, y: y0 + 26, a: 0, anim: "bench" }, { x: x0 + 60 + 13, y: y1 - 26, a: Math.PI, anim: "bench" });
      else it.guests.push({ x: x0 + 30 - 13, y: y0 + 18, a: 0, anim: "bench" }, { x: x0 + 66 + 13, y: y1 - 18, a: Math.PI, anim: "bench" });
      F("vending", x1 - 24, y1 - 6, 14, 10, NORTH, taco ? "#2d8a5a" : "#c0392b", { solid: true });
      onN("neon", cx + 10, 44, taco ? "#ffd23f" : "#ff3a4d", taco ? "TACO LOCO" : "BURGER BUCHT", 32);
      for (const px of [x0 + 30, x0 + 66]) F("pendant", px, cy, 12, 12, 0, taco ? "#e67e22" : "#c0392b");
      streetWindows();
      it.floor = taco ? ["hex", "#c8783a"] : ["checker", "#e8e4dc"]; it.wallTex = taco ? ["tile2", "#f2c14e"] : ["tile2", "#f4f4f2"];
      look(["plaster", taco ? "#f2e2c4" : "#f4f4f2"], taco ? "none" : "panel", taco ? "#ffe2b8" : "#fff8f0");
      break;
    }
    case "workshop": {
      // a hall you drive into: the lift in the middle, tool chests, tyre rack, the clerk at a desk with a PC
      it.lift = { x: (x0 + x1) / 2 + 6, y: cy };
      P("lift", it.lift.x, it.lift.y, 56, 26, 1.5, "#c0392b");
      F("desk", x1 - 14, y0 + 16, 24, 12, WEST, "#5a5e66", { solid: true }); F("pc", x1 - 16, y0 + 16, 16, 8, WEST, "#222", { z: 13 });
      it.counter = { x: x1 - 30, y: y0 + 16 }; it.clerk = { x: x1 - 6, y: y0 + 16, a: Math.PI };
      F("toolchest", x1 - 8, y0 + 48, 24, 12, WEST, "#c0392b", { solid: true }); F("toolchest", x1 - 8, y0 + 76, 24, 12, WEST, "#2e6da4", { solid: true });
      P("tyres", x0 + 14, y1 - 14, 12, 12, 16, "#151515", true);
      F("toolwall", cx, y1 - 3, 60, 4, NORTH, "#c9b07a"); F("compressor", x0 + 40, y1 - 10, 20, 10, NORTH, "#c0392b", { solid: true });
      F("drum", x0 + 14, y0 + 12, 10, 10, 0, "#c0392b", { solid: true }); F("drum", x0 + 26, y0 + 12, 10, 10, 0, "#2e6da4", { solid: true });
      F("duct", cx, y0 + 20, W - 10, 8, 0, "#9aa0a8");
      onN("neon", cx - 10, 40, "#9d4dff", "LACK & TURBO", 36); onS("poster", x1 - 30, 14, "#9d4dff", "abstract", 18);
      it.floor = ["polished", "#6c6c70"]; it.wallTex = ["metal", "#8f8b84"];
      look(["concrete", "#5c5c60"], "tube", "#f4f6ff");
      break;
    }
    case "safehouse": {
      // your first home: bed, kitchenette, sofa and TV, boxes, a bookshelf
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
      F("table", x0 + 42, y1 - 34, 18, 14, 0, "#6a4a32", { solid: true }); F("chair", x0 + 32, y1 - 34, 9, 9, EAST, "#3a2a1a"); F("chair", x0 + 52, y1 - 34, 9, 9, WEST, "#3a2a1a");
      F("boxes", x1 - 10, cy + 6, 12, 12, 0.3); F("shelf", x1 - 62, y0 + 5, 26, 8, SOUTH, "#5a3a22", { solid: true });
      F("lamp", x0 + 8, y0 + 8, 8, 8); F("plant", x0 + 8, y1 - 26, 10, 10);
      F("pendant", x0 + 42, y1 - 34, 10, 10, 0, "#3a3d45");
      onE("art", y0 + 22, 24, "#2bb3ff", "wave", 22);
      streetWindows("blinds");
      it.counter = { x: it.bed.x - 4, y: it.bed.y + 20 }; it.clerk = { x: -1e5, y: -1e5, a: 0 }; // nobody works here
      it.seats.push({ x: x0 + 30, y: y0 + 39, a: -Math.PI / 2 }, { x: x0 + 42, y: y0 + 39, a: -Math.PI / 2 });
      it.homes = [{ id: "safehouse", name: "Safehouse", price: 0, bed: it.bed, x0, y0, x1, y1 }];
      it.floor = ["wood", "#8a6a4a"]; it.wallTex = ["paint", "#d8d0c4"];
      look(["plaster", "#e8e2d8"], "none", "#ffe8c8");
      break;
    }
    case "bar": {
      // a long bar along the east wall with stools, bottles behind it; tables, billiards, darts, a jukebox
      deskAt("bar", x1 - 20, cy, L - 46, "#3a2416");
      F("bottles", x1 - 3, cy, L - 56, 4, WEST, "#5a3a22", { z: 18 }); F("bottles", x1 - 3, cy, L - 56, 4, WEST, "#3a2a1a", { z: 26 });
      for (let k = 0; k < 5; k++) { const sy = cy - (L - 70) / 2 + k * ((L - 70) / 4); F("stool", x1 - 36, sy, 7, 7, 0, "#c9a070"); it.seats.push({ x: x1 - 36, y: sy, a: 0 }); }
      for (const [tx, ty] of [[x0 + 34, y0 + 26], [x0 + 34, y1 - 26], [x0 + 70, y1 - 26]]) {
        F("rtable", tx, ty, 16, 16, 0, "#5a3a22", { solid: true });
        F("chair", tx - 12, ty, 9, 9, EAST, "#3a2416"); F("chair", tx + 12, ty, 9, 9, WEST, "#3a2416");
        it.seats.push({ x: tx - 12, y: ty, a: 0 }, { x: tx + 12, y: ty, a: Math.PI });
      }
      F("pool", x0 + 78, y0 + 34, 44, 24, 0, "#7a1f2b", { solid: true });
      F("jukebox", x0 + 8, cy + 30, 12, 10, EAST, "#c0392b", { solid: true });
      onN("clock", x0 + 110, 12, "#f4f4f4", undefined, 22); onS("neon", x0 + 40, 36, "#ffb347", "ANKERPLATZ", 28); onN("neon", x0 + 40, 30, "#2bf0ff", "COLD BEER", 26);
      onE("tv", y0 + 22, 30, "#15161b", undefined, 20);
      for (const [px, py] of [[x0 + 34, y0 + 26], [x0 + 34, y1 - 26], [x0 + 70, y1 - 26], [x0 + 78, y0 + 34]]) F("pendant", px, py, 10, 10, 0, "#c9a227");
      it.guests.push({ x: x1 - 36, y: cy - 6, a: 0, anim: "bench", z: 0 }, { x: x0 + 60, y: y0 + 46, a: 0.6, anim: "talk" }, { x: x0 + 96, y: y0 + 50, a: 2.6, anim: "talk" }, { x: x0 + 22, y: y1 - 26, a: 0, anim: "bench" });
      streetWindows("blinds");
      it.floor = ["darkwood", "#4a3222"]; it.wallTex = ["brick", "#6a3a2a"];
      look(["wood", "#3a2a1e"], "none", "#ffcc8a");
      break;
    }
    case "pharmacy": {
      // white shelves full of boxes, a counter with a green cross, a waiting bench
      counterAt(x1 - 26, cy, 40, "#f4f6f8");
      for (let k = 0; k < 3; k++) F("cubeshelf", x0 + 30 + k * 26, y0 + 6, 22, 10, SOUTH, "#f4f6f8", { solid: true });
      for (let k = 0; k < 3; k++) F("cubeshelf", x0 + 30 + k * 26, y1 - 6, 22, 10, NORTH, "#f4f6f8", { solid: true });
      F("cabinet", x1 - 6, y0 + 20, 22, 10, WEST, "#f4f6f8", { solid: true }); F("cabinet", x1 - 6, y1 - 20, 22, 10, WEST, "#f4f6f8", { solid: true });
      F("gondola", x0 + 54, cy, 40, 8, WEST, "#2ecc71", { solid: true });
      F("bench", x0 + 14, y1 - 14, 26, 8, NORTH, "#2ecc71"); it.seats.push({ x: x0 + 14, y: y1 - 16, a: -Math.PI / 2 });
      F("brochure", x0 + 10, y0 + 24, 10, 6, EAST); F("plant", x0 + 8, cy + 30, 10, 10);
      onE("neon", cy, 20, "#2ecc71", "+", 34); onN("board", x0 + 90, 30, "#f4f4f4", "APOTHEKE", 22);
      it.guests.push({ x: x0 + 44, y: cy - 20, a: 0.3, anim: "idle" });
      streetWindows();
      it.floor = ["tile", "#eef2f0"]; it.wallTex = ["tile2", "#f6f8f8"];
      look(["tiles", "#f4f6f6"], "panel", "#f4fff8");
      break;
    }
    case "boats": {
      // showroom: two speedboats on trailers, a model ship, life rings, the sales desk
      counterAt(x0 + 30, y1 - 24, 34, "#e8e4dc");
      F("hull", x0 + 95, y0 + 45, 30, 70, 0, "#f4f4f6", { solid: true, c2: "#2b6bff" }); F("hull", x0 + 95, y1 - 50, 26, 60, 0, "#c0392b", { solid: true, c2: "#f4f4f6" });
      F("shipmodel", x0 + 40, y0 + 30, 22, 8, SOUTH, "#5a3a22", { z: 0, solid: true });
      F("lifering", x1 - 0.8, cy - 30, 12, 2, WEST, "#e8452a", { z: 16 }); F("lifering", x1 - 0.8, cy + 30, 12, 2, WEST, "#e8452a", { z: 16 });
      onN("poster", x0 + 120, 16, "#2b9bd6", "sea", 14); onE("neon", cy, 44, "#2bf0ff", "MARINA", 28); onS("map", x0 + 80, 30, "#c9b07a", undefined, 16);
      F("armchair", x0 + 18, y0 + 60, 16, 14, EAST, "#2b6bff", { solid: true }); F("palm", x0 + 10, y0 + 10, 14, 14);
      F("spotrail", x0 + 95, y0 + 45, 30, 2, 0, "#15161b"); F("spotrail", x0 + 95, y1 - 50, 30, 2, 0, "#15161b");
      it.guests.push({ x: x0 + 70, y: cy, a: 0, anim: "lookAround" });
      streetWindows();
      it.floor = ["planks", "#c9a070"]; it.wallTex = ["wood", "#e8e2d4"];
      look(["wood", "#d8cfbf"], "spot", "#fff8ec");
      break;
    }
    case "planes": {
      // showroom: scale models of planes and helicopters, maps, the sales desk, a lounge
      counterAt(x0 + 30, y1 - 24, 34, "#2a2d33");
      F("aircraft", x0 + 100, y0 + 50, 60, 50, 0, "#e8e8ec", { solid: true, c2: "#2b6bff" }); F("aircraft", x0 + 100, y1 - 52, 50, 40, 0.5, "#ffd23f", { solid: true, c2: "#2a2d33" });
      onN("map", x0 + 60, 36, "#7ab0c8", undefined, 16); onS("poster", x0 + 120, 16, "#7fb2ff", "sky", 14); onE("neon", cy, 44, "#7fb2ff", "SKYLINE", 28);
      F("sofa", x0 + 20, y0 + 40, 40, 15, EAST, "#2a2d33", { solid: true }); F("coffee", x0 + 40, y0 + 40, 22, 11, 0, "#c9ced8");
      F("brochure", x0 + 50, y1 - 12, 10, 6, NORTH); F("palm", x0 + 10, y1 - 10, 14, 14);
      F("spotrail", x0 + 100, y0 + 50, 30, 2, 0, "#15161b"); F("spotrail", x0 + 100, y1 - 52, 30, 2, 0, "#15161b");
      it.guests.push({ x: x0 + 70, y: cy + 6, a: 0.2, anim: "phone" });
      streetWindows();
      it.floor = ["polished", "#c9ced8"]; it.wallTex = ["panel", "#e2e6ea"];
      look(["plaster", "#f4f6f8"], "panel", "#f6faff");
      break;
    }
    case "market": {
      counterAt(x0 + 34, y0 + 22, 30, "#e8e8ec");
      F("checkout", x0 + 34, y0 + 48, 26, 10, WEST, "#2e6da4", { solid: true });
      for (let k = 0; k < 3; k++) F("gondola", x0 + 60 + k * 24, cy + 14, L - 64, 8, WEST, ["#e1b12c", "#2e6da4", "#2d8a5a"][k], { solid: true });
      F("fridgeglass", x1 - 6, cy + 6, L - 40, 10, WEST, "#2e6da4", { solid: true });
      it.guests.push({ x: x0 + 71, y: cy - 20, a: 0, anim: "idle" }, { x: x0 + 96, y: cy + 30, a: Math.PI, anim: "phone" });
      F("fruitstand", x0 + 14, y1 - 16, 24, 18, EAST, "#a0703a", { solid: true }); F("baskets", x0 + 10, y0 + 46, 10, 8);
      onS("neon", x0 + 40, 40, "#3dd68c", "FRISCHBUCHT", 30); onN("board", x0 + 80, 30, "#f4f4f4", "ANGEBOTE", 20);
      streetWindows();
      it.floor = ["lino", "#dcdcd4"]; it.wallTex = ["tile2", "#f4f4f0"];
      look(["tiles", "#f0f0ec"], "panel", "#f4fbff");
      break;
    }
    case "cardealer": {
      counterAt(x0 + 28, y1 - 24, 34, "#f4f6f8");
      it.show = [
        { x: x0 + 60, y: y0 + 45, model: "super", color: "#c0392b" }, { x: x0 + 125, y: y0 + 45, model: "suv", color: "#2c3e50" },
        { x: x0 + 90, y: cy + 10, model: "sport", color: "#f39c12" }, { x: x0 + 128, y: y1 - 40, model: "muscle", color: "#16a085" },
      ];
      for (const s of it.show) P("turntable", s.x, s.y, 44, 44, 1, "#d8d8dc");
      it.guests.push({ x: x0 + 110, y: cy - 20, a: Math.PI / 2, anim: "idle" });
      F("palm", x0 + 10, y0 + 10, 14, 14); F("palm", x0 + 10, y1 - 10, 14, 14);
      F("armchair", x0 + 30, y0 + 16, 16, 14, SOUTH, "#2a2d33", { solid: true }); F("armchair", x0 + 48, y0 + 16, 16, 14, SOUTH, "#2a2d33", { solid: true });
      F("coffee", x0 + 39, y0 + 32, 22, 10, 0, "#c9ced8"); F("brochure", x0 + 50, y1 - 12, 10, 6, NORTH);
      onE("neon", cy, 50, "#2bf0ff", "SOLARA MOTORS", 30); onE("board", y0 + 30, 30, "#f4f4f4", "TOP ANGEBOTE", 18);
      for (const s of it.show) F("spotrail", s.x, s.y, 30, 2, 0, "#15161b");
      streetWindows();
      it.floor = ["marble", "#d4d0ca"]; it.wallTex = ["panel", "#e2e6ea"];
      look(["plaster", "#f4f6f8"], "panel", "#f6faff");
      break;
    }
    case "barber": {
      counterAt(x0 + 24, y1 - 22, 26, "#2a2d33");
      for (let k = 0; k < 2; k++) { F("barber", x1 - 22, y0 + 26 + k * 36, 12, 12, WEST, "#1b1b1f"); F("mirrorstation", x1 - 4, y0 + 26 + k * 36, 18, 6, WEST); }
      F("hairsink", x1 - 10, y1 - 16, 14, 16, WEST, "#1b1b1f", { solid: true });
      P("tattoochair", x0 + 60, y0 + 24, 24, 9, 9, "#3a2a2a", true); F("lamp", x0 + 76, y0 + 12, 8, 8, 0, "#f4f4f4");
      it.guests.push({ x: x1 - 22, y: y0 + 26, a: 0, anim: "bench" });
      F("bench", x0 + 50, y1 - 6, 30, 8, NORTH, "#3a2a3a"); it.seats.push({ x: x0 + 44, y: y1 - 9, a: -Math.PI / 2 }, { x: x0 + 56, y: y1 - 9, a: -Math.PI / 2 });
      F("pole", x0 + 8, cy - 22, 6, 6); F("plant", x0 + 8, y0 + 8, 10, 10);
      onN("neon", x0 + 30, 30, "#c86bff", "INK BAY", 28); onN("art", x0 + 70, 20, "#c86bff"); onS("poster", x0 + 80, 12, "#2a2d33", "pin", 18);
      streetWindows();
      it.floor = ["checker", "#e8e4dc"]; it.wallTex = ["brick", "#5a3a3a"];
      look(["plaster", "#2a2228"], "spot", "#fff2e0");
      break;
    }
    case "hospital": {
      deskAt("reception", x0 + 40, cy - 24, 36, "#e8eef2");
      F("pc", x0 + 42, cy - 30, 14, 7, WEST, "#222", { z: 16 });
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
        F("monitor", x1 - 6, by - 14, 8, 6, WEST); F("iv", x1 - 41, by + 10, 6, 6);
        if (k < beds - 1) F("curtain", x1 - 22, by + 22, 36, 2, SOUTH, "#9ad0e8");
      }
      F("cabinet", cx + 30, y1 - 6, 26, 10, NORTH, "#e8eef2", { solid: true });
      F("vending", x0 + 70, y1 - 7, 14, 10, NORTH, "#c0392b", { solid: true }); F("cooler", x0 + 88, y1 - 6, 8, 8, NORTH);
      F("plant", x0 + 8, y1 - 10, 12, 12); F("plant", x0 + 8, y0 + 44, 10, 10);
      onN("board", cx + 26, 30, "#f4f4f4", "NOTAUFNAHME", 18); onS("art", x0 + 40, 24, "#2e86c1", "sea"); onW("clock", cy - 30, 8, "#f4f4f4", undefined, 26);
      streetWindows("blinds");
      it.heal = true;
      it.floor = ["lino", "#bcc8cc"]; it.wallTex = ["tile2", "#d6e2e6"];
      look(["tiles", "#eef2f4"], "panel", "#f2f8ff");
      break;
    }
    case "police": {
      deskAt("reception", x0 + 38, cy + 20, 34, "#2c3e50");
      F("locker", x0 + 56, y0 + 5, 36, 9, SOUTH, "#5a6a7a", { solid: true });
      F("desk", cx + 6, cy - 16, 28, 14, SOUTH, "#6a4a32", { solid: true }); F("pc", cx + 6, cy - 18, 20, 9, SOUTH, "#222", { z: 13 });
      F("chair", cx + 6, cy - 2, 9, 9, NORTH, "#2a2d33"); F("cooler", x0 + 12, y0 + 20, 8, 8, EAST);
      // two cells behind bars along the east wall
      const bx = x1 - 42;
      F("bars", bx, cy, 2, L - 4, 0, "#5a5d66", { solid: true });
      F("bars", bx + 21, cy, 40, 2, 0, "#5a5d66", { solid: true });
      F("bunk", x1 - 14, y0 + 20, 18, 30, WEST, "#5a5d66"); F("bunk", x1 - 14, y1 - 20, 18, 30, WEST, "#5a5d66");
      F("toilet", x1 - 32, y0 + 8, 9, 10, SOUTH); F("toilet", x1 - 32, y1 - 8, 9, 10, NORTH);
      it.guests.push({ x: x1 - 26, y: y0 + 34, a: Math.PI, anim: "lookAround" });
      onN("board", cx - 20, 30, "#f4f4f4", "MOST WANTED", 18); onS("map", cx - 20, 32, "#c9b07a", undefined, 14); onN("clock", cx + 30, 8, "#f4f4f4", undefined, 28);
      F("files", x0 + 12, y1 - 8, 16, 9, NORTH, "#7a8a9a", { solid: true }); F("plant", x0 + 8, y0 + 40, 10, 10);
      F("camera", bx - 3, y0 + 4, 4, 4, -Math.PI / 4, "#2a2d33", { z: 38 });
      streetWindows("blinds");
      it.floor = ["carpettile", "#5a6878"]; it.wallTex = ["panel", "#c9d4e2"];
      look(["tiles", "#e8ecf0"], "panel", "#f0f6ff");
      break;
    }
    case "garage": {
      // Lou's garage: a car up on the lift, tool wall, workbench, old sofa, a fridge and posters
      F("lift", cx - 4, cy, 34, 54, WEST, "#8a2a22", { solid: true });
      F("carprop", cx - 4, cy, 22, 46, WEST, "#a83a7c", { z: 12 });
      F("toolwall", x1 - 3, cy, 56, 4, WEST, "#c9b07a");
      F("workbench", x1 - 30, y0 + 8, 30, 12, SOUTH, "#6a4a32", { solid: true });
      it.counter = { x: x1 - 30, y: y0 + 30 }; it.clerk = { x: x1 - 30, y: y0 + 19, a: Math.PI / 2 };
      F("tires", x0 + 14, y0 + 12, 10, 10, 0, "#15161b", { solid: true }); F("toolchest", x0 + 40, y0 + 7, 22, 12, SOUTH, "#c0392b", { solid: true });
      F("drum", x0 + 12, y1 - 12, 10, 10, 0, "#c0392b", { solid: true }); F("drum", x0 + 24, y1 - 12, 10, 10, 0, "#2e6da4", { solid: true });
      F("sofa", cx + 18, y1 - 9, 36, 15, NORTH, "#7a4a3a", { solid: true }); F("fridge", x1 - 10, y1 - 8, 12, 12, WEST, "#c9ced8", { solid: true });
      it.seats.push({ x: cx + 12, y: y1 - 12, a: -Math.PI / 2 });
      onS("art", cx + 18, 28, "#ff5ad1", "pin", 24); onN("poster", cx - 20, 14, "#2bb3ff", "abstract", 18);
      F("pendant", cx - 4, cy, 14, 14, 0, "#2a2d33");
      it.floor = ["polished", "#8d8a84"]; it.wallTex = ["brick", "#8a4a36"];
      look(["concrete", "#5c5c60"], "tube", "#fff2e0");
      break;
    }
    case "cafe": {
      F("bar", x1 - 18, cy - 8, 44, 12, WEST, "#8a5a3a", { solid: true });
      it.counter = { x: x1 - 34, y: cy - 8 }; it.clerk = { x: x1 - 7, y: cy - 8, a: Math.PI };
      F("espresso", x1 - 18, cy - 24, 8, 6, WEST, "#c9ced8", { z: 16 });
      F("vitrine", x1 - 18, cy + 26, 24, 12, WEST, "#8a5a3a", { solid: true });
      F("bottles", x1 - 2, cy - 8, 30, 4, WEST, "#5a3a22", { z: 18 });
      F("chalk", x1 - 1, cy + 26, 26, 1, WEST, "#f4f4f4", { z: 22, c2: "KAFFEE & KUCHEN" });
      for (let k = 0; k < 3; k++) {
        const tx = x0 + 26 + (k % 2) * 34, ty = k < 2 ? y0 + 24 : y1 - 24;
        F("rtable", tx, ty, 16, 16, 0, "#f4efe6", { solid: true });
        F("chair", tx - 12, ty, 9, 9, EAST, "#5a3a22"); F("chair", tx + 12, ty, 9, 9, WEST, "#5a3a22");
        it.seats.push({ x: tx - 12, y: ty, a: 0 }, { x: tx + 12, y: ty, a: Math.PI });
        F("pendant", tx, ty, 10, 10, 0, "#2d6a4a");
      }
      it.guests.push({ x: x0 + 14, y: y0 + 24, a: 0, anim: "bench" }, { x: x0 + 72, y: y0 + 24, a: Math.PI, anim: "talk" });
      F("palm", x0 + 10, y1 - 10, 14, 14); F("plant", x1 - 10, y1 - 10, 12, 12); F("shelf", x0 + 60, y1 - 5, 24, 8, NORTH, "#6a4a32", { solid: true });
      onN("art", cx, 26, "#ff5ad1", "sun"); onS("neon", cx - 10, 44, "#ff5ad1", "CAFÉ MARISOL", 30);
      streetWindows();
      it.floor = ["herringbone", "#a07850"]; it.wallTex = ["brick", "#c98a68"];
      look(["wood", "#8a6a4a"], "none", "#ffe0b0");
      break;
    }
    case "office": {
      F("desk", x1 - 26, cy, 30, 16, WEST, "#5a3a22", { solid: true });
      F("pc", x1 - 24, cy, 18, 9, WEST, "#222", { z: 13 }); F("lamp", x1 - 8, y0 + 10, 8, 8);
      it.counter = { x: x1 - 46, y: cy }; it.clerk = { x: x1 - 10, y: cy, a: Math.PI };
      F("crate", x0 + 16, y0 + 14, 16, 16, 0, "#8a6a3a", { solid: true }); F("crate", x0 + 16, y0 + 31, 14, 14, 0.3, "#7a5a32", { solid: true });
      F("drum", x0 + 34, y0 + 12, 10, 10, 0, "#2e6da4", { solid: true }); F("boxes", x0 + 50, y0 + 10, 12, 12, 0.2);
      F("files", cx, y1 - 6, 18, 9, NORTH, "#5a6a5a", { solid: true }); F("locker", cx + 26, y1 - 5, 24, 8, NORTH, "#c0392b", { solid: true });
      F("armchair", x0 + 36, y1 - 14, 16, 14, NORTH, "#5a3a2a", { solid: true }); F("lifering", x0 + 0.8, cy + 30, 12, 2, EAST, "#e8452a", { z: 14 });
      onN("map", cx + 10, 34, "#c9b07a", undefined, 14); onE("clock", y1 - 20, 8, "#f4f4f4", undefined, 28);
      F("pendant", x1 - 26, cy, 12, 12, 0, "#2e6da4");
      streetWindows("blinds");
      it.floor = ["planks", "#7a5a3a"]; it.wallTex = ["wood", "#6a5038"];
      look(["wood", "#5a4430"], "tube", "#fff0d8");
      break;
    }
    case "harbor": {
      deskAt("reception", x0 + 48, cy, 40, "#2e6da4");
      F("desk", x1 - 18, y0 + 22, 26, 14, WEST, "#6a4a32", { solid: true }); F("pc", x1 - 16, y0 + 22, 18, 9, WEST, "#222", { z: 13 });
      F("files", x1 - 6, y1 - 20, 18, 9, WEST, "#5a6a7a", { solid: true });
      F("bench", x0 + 22, y1 - 6, 30, 8, NORTH, "#5a6a7a");
      it.seats.push({ x: x0 + 16, y: y1 - 9, a: -Math.PI / 2 }, { x: x0 + 28, y: y1 - 9, a: -Math.PI / 2 });
      F("plant", x0 + 8, y0 + 8, 12, 12); F("palm", x1 - 10, y1 - 40, 14, 14);
      F("table", cx + 14, y1 - 30, 20, 14, 0, "#6a4a32", { solid: true }); F("shipmodel", cx + 14, y1 - 30, 14, 5, 0, "#c0392b", { z: 13 });
      F("lifering", x0 + 0.8, y0 + 20, 12, 2, EAST, "#e8452a", { z: 14 });
      onE("map", cy + 4, 40, "#c9b07a", undefined, 14); onN("board", x0 + 40, 28, "#f4f4f4", "FAHRPLAN", 18); onN("clock", x0 + 70, 8, "#f4f4f4", undefined, 28);
      streetWindows();
      it.floor = ["terrazzo", "#d8d2c6"]; it.wallTex = ["panel", "#dfe8ee"];
      look(["tiles", "#f0f2f4"], "panel", "#f4faff");
      break;
    }
    case "precinct": {
      F("desk", x1 - 26, cy, 30, 16, WEST, "#3a2a1a", { solid: true });
      F("pc", x1 - 24, cy + 4, 18, 9, WEST, "#222", { z: 13 }); F("lamp", x1 - 8, y1 - 10, 8, 8, 0, "#2d6a4a");
      it.counter = { x: x1 - 46, y: cy }; it.clerk = { x: x1 - 10, y: cy, a: Math.PI };
      F("shelf", cx - 4, y0 + 5, 30, 8, SOUTH, "#5a3a22", { solid: true }); F("shelf", cx + 28, y0 + 5, 30, 8, SOUTH, "#5a3a22", { solid: true });
      F("files", x0 + 12, y0 + 8, 16, 9, SOUTH, "#6a7a8a", { solid: true });
      F("armchair", x0 + 30, y1 - 14, 16, 14, NORTH, "#5a2a2a", { solid: true }); F("armchair", x0 + 50, y1 - 14, 16, 14, NORTH, "#5a2a2a", { solid: true }); F("plant", x0 + 10, y1 - 10, 12, 12);
      F("rug", cx - 6, cy, 50, 40, 0, "#7a2a2a", { c2: "#c9a227" });
      onS("board", cx + 10, 34, "#f4f4f4", "FALL VALE", 18); onE("art", y0 + 20, 22, "#2a4a6a", "sea", 22);
      F("pendant", x1 - 26, cy, 12, 12, 0, "#c9a227");
      streetWindows("blinds");
      it.floor = ["carpet", "#3a4a6a"]; it.wallTex = ["wood", "#5a4030"];
      look(["wood", "#4a3424"], "none", "#ffe4c0");
      break;
    }
    case "club": {
      // bar along the north wall, a lit dance floor with a disco ball, the DJ at the east wall between speakers, booths
      F("bar", cx + 10, y0 + 14, 60, 12, SOUTH, "#2a1a3a", { solid: true });
      F("bottles", cx + 10, y0 + 2, 50, 3, SOUTH, "#3a2a4a", { z: 18 });
      it.counter = { x: cx + 10, y: y0 + 30 }; it.clerk = { x: cx + 10, y: y0 + 5, a: Math.PI / 2 };
      for (let k = 0; k < 4; k++) { F("stool", cx - 14 + k * 14, y0 + 27, 7, 7, 0, "#c9ced8"); it.seats.push({ x: cx - 14 + k * 14, y: y0 + 27, a: -Math.PI / 2 }); }
      P("dancefloor", cx + 16, cy + 22, Math.min(72, W - 70), Math.min(60, L - 70), 0.4, "#ff3cac");
      F("discoball", cx + 16, cy + 22, 8, 8);
      F("dj", x1 - 12, cy + 22, 26, 12, WEST, "#15161b", { solid: true });
      F("speaker", x1 - 8, cy - 4, 12, 10, WEST, "#15161b", { solid: true }); F("speaker", x1 - 8, cy + 48, 12, 10, WEST, "#15161b", { solid: true });
      F("booth", x0 + 22, y1 - 22, 30, 36, 0, "#7a1a4a", { solid: true });
      F("jukebox", x0 + 10, y0 + 12, 12, 10, EAST, "#9d4dff", { solid: true });
      F("column", cx - 26, cy + 10, 8, 8, 0, "#2a2a35", { solid: true });
      onS("neon", cx + 16, 50, "#ff3cac", "NEON TIDE", 30); onE("neon", y0 + 30, 34, "#2bf0ff", "DANCE", 28);
      for (const [gx, gy, ga, an] of [[cx + 6, cy + 14, 0.4, "talk"], [cx + 28, cy + 30, 3.4, "talk"], [cx + 20, cy + 6, 1.8, "phone"], [x1 - 6, cy + 22, Math.PI, "lookAround"], [cx - 8, y0 + 34, -1.2, "smoke"]] as [number, number, number, string][]) it.guests.push({ x: gx, y: gy, a: ga, anim: an });
      it.floor = ["polished", "#221c30"]; it.wallTex = ["metal", "#1f1a2e"];
      look(["concrete", "#14101c"], "spot", "#c86bff");
      break;
    }
    case "loft": {
      // a whole loft to buy: bedroom corner, living area, kitchen island, bathroom behind a partition
      it.bed = { x: x1 - 46, y: y0 + 22 };
      F("bed", x1 - 22, y0 + 22, 28, 36, WEST, "#2e4a7a", { solid: true });
      F("side", x1 - 8, y0 + 44, 10, 8, WEST, "#5a3a22"); F("lamp", x1 - 8, y0 + 56, 8, 8);
      F("wardrobe", x1 - 58, y0 + 6, 28, 10, SOUTH, "#6b4a2e", { solid: true });
      F("counter", x0 + 20, y0 + 7, 22, 14, SOUTH, "#2a2d33", { solid: true }); F("stove", x0 + 40, y0 + 7, 18, 14, SOUTH, "#2a2d33", { solid: true });
      F("sink", x0 + 58, y0 + 7, 18, 14, SOUTH, "#2a2d33", { solid: true }); F("fridge", x0 + 75, y0 + 7, 14, 12, SOUTH, "#c9ced8", { solid: true });
      F("island", x0 + 40, y0 + 34, 34, 12, 0, "#2a2d33", { solid: true });
      for (const sx of [-10, 4, 18]) F("stool", x0 + 26 + sx, y0 + 46, 7, 7, 0, "#c9a070");
      F("tv", cx - 6, cy + 4, 34, 10, SOUTH, "#3a2a1a", { solid: true });
      F("coffee", cx - 6, cy + 22, 26, 12, 0, "#6a4a32");
      F("sofaL", cx - 6, cy + 40, 48, 24, NORTH, "#3a5a7a", { solid: true });
      F("rug", cx - 6, cy + 24, 64, 44, 0, "#c9a070", { c2: "#8a4a3a" });
      it.seats.push({ x: cx - 14, y: cy + 35, a: -Math.PI / 2 }, { x: cx + 2, y: cy + 35, a: -Math.PI / 2 });
      // bathroom in the south-east corner
      const bw = 44, bh = 42;
      wall(x1 - bw, y1 - bh, 3, bh); wall(x1 - bw, y1 - bh, 12, 3);
      F("shower", x1 - 10, y1 - 10, 16, 16, NORTH, "#f4f2ee"); F("toilet", x1 - bw + 10, y1 - 8, 10, 12, NORTH);
      F("basin", x1 - 4, y1 - bh + 14, 12, 8, WEST, "#f4f2ee");
      F("plant", x0 + 8, y1 - 10, 12, 12); F("palm", cx + 30, y1 - 10, 14, 14); F("lamp", cx + 26, cy + 4, 8, 8);
      for (const px of [x0 + 30, x0 + 50]) F("pendant", px, y0 + 34, 8, 8, 0, "#c9a227");
      F("beams", cx, cy, W, L, 0, "#5a3a22");
      onN("art", x1 - 22, 22, "#ff8a1f", "sun", 22); onS("art", cx - 6, 30, "#2bb3ff", "wave", 20);
      streetWindows();
      it.counter = { x: it.bed.x, y: it.bed.y + 22 }; it.clerk = { x: -1e5, y: -1e5, a: 0 };
      it.homes = [{ id: "loft", name: "Loft am Hafen", price: 25000, bed: it.bed, x0, y0, x1, y1 }];
      it.floor = ["wood", "#a07850"]; it.wallTex = ["brick", "#b46a4a"];
      look(["concrete", "#8a8580"], "spot", "#ffe8cc");
      break;
    }
    case "mall": case "tower": case "jail": case "mess": case "rec": break;
    case "gas247": {
      // 24/7 shop of the gas station: counter with the till by the door, shelves, coolers, coffee, hot dogs, lottery
      counterAt(x0 + 30, y0 + 22, 30, "#e8e8ec");
      for (let k = 0; k < 2; k++) F("gondola", x0 + 56 + k * 22, cy + 10, L - 50, 8, WEST, ["#e8452a", "#2e6da4"][k], { solid: true });
      F("fridgeglass", x1 - 6, cy, L - 30, 10, WEST, "#2e6da4", { solid: true });
      F("espresso", x0 + 14, y1 - 8, 12, 8, NORTH, "#c9ced8", { z: 12 }); F("counter", x0 + 14, y1 - 8, 22, 12, NORTH, "#e8e4dc", { solid: true });
      F("shake", x0 + 34, y1 - 8, 14, 8, NORTH, "#e8452a", { z: 12 }); F("counter", x0 + 36, y1 - 8, 22, 12, NORTH, "#e8e4dc", { solid: true });
      F("brochure", x0 + 10, y0 + 40, 10, 6, EAST); F("vending", x0 + 8, cy + 30, 14, 10, EAST, "#2bb3ff", { solid: true });
      onN("neon", x0 + 60, 30, "#e8452a", "24/7", 30); onS("board", x0 + 70, 30, "#f4f4f4", "RUBBELLOSE", 20);
      it.guests.push({ x: x0 + 67, y: cy - 24, a: 0.2, anim: "idle" });
      streetWindows();
      it.floor = ["lino", "#dcdcd4"]; it.wallTex = ["tile2", "#f4f4f0"];
      look(["tiles", "#f0f0ec"], "panel", "#f4fbff");
      break;
    }
  }
}

// the mall: a whole block, three floors around an open atrium (galleries with glass rails), two pairs of escalators
// (ground floor -> 1st floor, 1st -> 2nd across the atrium), a glass lift in the north-east corner, shop fronts on every
// floor (closed shops: shop windows only), the food court on the ground floor
export const MALL = { band: 70, floors: [0, 38, 76], H: 114 };
function buildMall(world: World, pl: Place, electro?: Place): Interior | null {
  const bx = Math.floor((pl.x - ROAD) / BLOCK), by = Math.floor((pl.y - ROAD) / BLOCK);
  const blk = world.blockAt(pl.x, pl.y);
  if (!blk) return null;
  const s0x = bx * BLOCK + ROAD, s0y = by * BLOCK + ROAD, size = BLOCK - ROAD;
  const x0 = s0x + 25, y0 = s0y + 25, x1 = s0x + size - 25, y1 = s0y + size - 25, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  blk.buildings.length = 0; blk.trees.length = 0;
  const H = MALL.H, dw = 26, b = MALL.band, [, Z1, Z2] = MALL.floors;
  const it: Interior = {
    id: "mall", kind: "mall", name: pl.name, color: pl.color, x0: x0 + T, y0: y0 + T, x1: x1 - T, y1: y1 - T, H,
    door: { x: x0, y: cy, w: dw }, counter: { x: 0, y: 0 }, clerk: { x: 0, y: 0, a: 0 }, props: [], seats: [], guests: [], walls: [],
    levels: [], escalators: [], floor: ["terrazzo", "#e4ddd0"], wallTex: ["panel", "#ece6dc"], ceil: ["plaster", "#f4f0e8"], lamps: "panel", light: "#fff8ee",
  };
  it.walls.push(
    wallB(x0, y0, T, cy - dw / 2 - y0, H), wallB(x0, cy + dw / 2, T, y1 - cy - dw / 2, H),
    wallB(x1 - T, y0, T, cy - dw / 2 - y0, H), wallB(x1 - T, cy + dw / 2, T, y1 - cy - dw / 2, H),
    wallB(x0, y0, x1 - x0, T, H), wallB(x0, y1 - T, x1 - x0, T, H),
  );
  const ix0 = it.x0, ix1 = it.x1, iy0 = it.y0, iy1 = it.y1, A = (ix1 - ix0) / 2 - b; // atrium half size
  // a solid strip that only exists between two heights (rails, escalator sides); not drawn as a wall
  const zwall = (x: number, y: number, w: number, h: number, zb: number, zt: number) => it.walls.push({ ...wallB(x, y, w, h, zt, true), zb, zt });
  // the galleries of the upper floors: four slabs around the atrium
  for (const z of [Z1, Z2]) it.levels!.push({ z, slabs: [
    { x0: ix0, y0: iy0, x1: ix1, y1: cy - A }, { x0: ix0, y0: cy + A, x1: ix1, y1: iy1 },
    { x0: ix0, y0: cy - A, x1: cx - A, y1: cy + A }, { x0: cx + A, y0: cy - A, x1: ix1, y1: cy + A },
  ] });
  // escalators: a pair from the ground up to the south gallery, a pair from the north gallery (1st floor) across the atrium to the south gallery (2nd floor)
  const e01 = [cx - 72, cx - 53, cx - 34], e12 = [cx + 34, cx + 53, cx + 72], ys = cy + A - 96; // two lanes of 19 each (rails between them)
  it.escalators!.push(
    { x0: e01[0], x1: e01[1] - 1, y0: ys, y1: cy + A, za: 0, zb: Z1, up: true }, { x0: e01[1] + 1, x1: e01[2], y0: ys, y1: cy + A, za: 0, zb: Z1, up: false },
    { x0: e12[0], x1: e12[1] - 1, y0: cy - A, y1: cy + A, za: Z1, zb: Z2, up: true }, { x0: e12[1] + 1, x1: e12[2], y0: cy - A, y1: cy + A, za: Z1, zb: Z2, up: false },
  );
  for (const x of e01) zwall(x - 1, ys, 2, cy + A - ys, 0, Z1 + 12);
  zwall(e01[0] - 1, cy + A - 3, e01[2] - e01[0] + 2, 3, 0, Z1 - 8); // under the top end: closed on the ground floor
  for (const x of e12) zwall(x - 1, cy - A, 2, 2 * A, Z1, Z2 + 12);
  // glass rails around the atrium, open where an escalator arrives
  const rail = (z: number, gapN: number[] | null, gapS: number[] | null) => {
    const along = (y: number, gap: number[] | null) => {
      if (!gap) { zwall(cx - A, y - 1, 2 * A, 2, z, z + 12); return; }
      zwall(cx - A, y - 1, gap[0] - (cx - A), 2, z, z + 12); zwall(gap[1], y - 1, cx + A - gap[1], 2, z, z + 12);
    };
    along(cy - A, gapN); along(cy + A, gapS);
    zwall(cx - A - 1, cy - A, 2, 2 * A, z, z + 12); zwall(cx + A - 1, cy - A, 2, 2 * A, z, z + 12);
  };
  rail(Z1, [e12[0] - 1, e12[2] + 1], [e01[0] - 1, e01[2] + 1]);
  rail(Z2, null, [e12[0] - 1, e12[2] + 1]);
  // the lift: shaft in the north-east corner of the gallery, the door looks south
  const lx0 = cx + 100, lx1 = cx + 130, ly0 = iy0, ly1 = iy0 + 30;
  it.elevator = { x0: lx0, y0: ly0, x1: lx1, y1: ly1, floors: [...MALL.floors], z: 0, to: 0, open: 1 };
  it.walls.push(wallB(lx0 - 2, ly0, 2, ly1 - ly0 + 2, H), wallB(lx1, ly0, 2, ly1 - ly0 + 2, H));
  it.walls.push(wallB(lx0 - 2, ly1, 9, 2, H), wallB(lx1 - 7, ly1, 9, 2, H));
  // shop fronts on all three floors (a shallow shop window in front of the outer wall)
  const names = [
    ["Sunset Mode", "#ff6f91"], ["Bucht-Elektro", "#2bb3ff"], ["Café Brise", "#c9a070"], ["Schuh-Eck", "#e67e22"], ["Buchhafen", "#2d8a5a"], ["Solara Sport", "#ff3a4d"],
    ["Spielwelt", "#ffd23f"], ["Optik Klar", "#7ac8e8"], ["Juwelier Perla", "#c9a227"], ["Handy-Hafen", "#9d4dff"], ["Bay Kids", "#3dd68c"], ["Parfümerie Lys", "#f2c7d8"],
    ["Tech & Spiel", "#2bf0ff"], ["Brillenwerk", "#8a9098"], ["Taschen-Atelier", "#8a5a3a"], ["Blumen Mar", "#3aa85c"], ["Outdoor-Bay", "#56603e"], ["Uhren Kai", "#c9ced8"],
  ];
  let n = 0;
  const front = (x: number, y: number, w: number, a: number, z: number) => {
    const [nm, col] = names[n++ % names.length];
    it.props.push({ k: "front", x, y, w, d: 8, h: 30, z, a, c: nm, c2: col });
    const horiz = Math.abs(Math.sin(a)) < 0.5;
    if (horiz) zwall(x - w / 2, a ? y - 8 : y, w, 8, z, z + 30); else zwall(a > 0 ? x - 8 : x, y - w / 2, 8, w, z, z + 30);
  };
  for (const z of MALL.floors) {
    for (const fx of [-122, -62, 2, 62]) front(cx + fx, iy1, 54, Math.PI, z);             // south wall (front looks north)
    for (const fx of [-122, -62, 2, 62]) if (cx + fx + 27 < lx0 - 4 && !(z === 0 && fx < 0)) front(cx + fx, iy0, 54, 0, z); // north wall (ground floor: the electronics shop)
    for (const fy of z === 0 ? [-100, 100] : [-100, -40, 40, 100]) { front(ix0, cy + fy, 50, -Math.PI / 2, z); front(ix1, cy + fy, 50, Math.PI / 2, z); }
  }
  // ground floor: the food court in the atrium (stand with the counter, tables), benches, palms
  addF(it, "foodstand", cx + 26, cy - 56, 44, 12, WEST, "#c0392b", { solid: true });
  it.counter = { x: cx + 12, y: cy - 56 }; it.clerk = { x: cx + 34, y: cy - 56, a: Math.PI };
  for (const [tx, ty] of [[cx + 12, cy + 18], [cx + 52, cy + 18], [cx + 12, cy + 58], [cx + 52, cy + 58]]) {
    addF(it, "rtable", tx, ty, 16, 16, 0, "#f4f2ee", { solid: true });
    addF(it, "chair", tx - 12, ty, 9, 9, -Math.PI / 2, "#c0392b"); addF(it, "chair", tx + 12, ty, 9, 9, Math.PI / 2, "#c0392b");
    it.seats.push({ x: tx - 12, y: ty, a: 0 }, { x: tx + 12, y: ty, a: Math.PI });
  }
  addF(it, "planter", cx - 20, cy - 60, 30, 14, 0, "#3aa85c", { solid: true });
  addF(it, "fountain", cx - 20, cy - 20, 26, 26, 0, "#7ac8e8", { solid: true });
  for (const z of MALL.floors) {
    const o = { lv: z };
    for (const [px, py] of [[ix0 + 14, iy0 + 14], [ix0 + 14, iy1 - 14], [ix1 - 14, iy1 - 14]]) addF(it, "palm", px, py, 16, 16, 0, "#3aa85c", o);
    if (z > 0) {
      addF(it, "bench", cx - 110, cy - A - 14, 30, 8, Math.PI, "#6a4a32", o); addF(it, "bench", cx - 110, cy + A + 14, 30, 8, 0, "#6a4a32", o);
      addF(it, "planter", cx - A - 22, cy, 12, 40, 0, "#3aa85c", { ...o, solid: true }); addF(it, "planter", cx + A + 22, cy, 12, 40, 0, "#3aa85c", { ...o, solid: true });
      addF(it, "directory", lx0 - 22, ly1 + 6, 12, 4, 0, "#2a2d33", o);
    }
  }
  // ground floor, north side: Bucht-Elektro, an open electronics shop (phones, gadgets, TVs); its counter looks south
  {
    const ex = cx - 92, ey = iy0;
    addF(it, "neon", ex, ey + 0.6, 50, 1, SOUTH, "#2bb3ff", { z: 26, c2: "BUCHT-ELEKTRO" });
    addF(it, "tvwall", ex, ey + 3, 60, 4, SOUTH, "#15161b", { z: 6 });
    addF(it, "shopcounter", ex, ey + 54, 44, 12, SOUTH, "#f4f6f8", { solid: true });
    addF(it, "register", ex + 12, ey + 54, 7, 6, SOUTH, "#2a2d33", { z: 16 });
    addF(it, "monitor", ex - 12, ey + 54, 8, 4, SOUTH, "#2a2d33", { z: 13 });
    for (const [dx, dy] of [[-44, 24], [44, 24], [-44, 70], [44, 70]]) addF(it, "displaytable", ex + dx, ey + dy, 24, 14, 0, "#f4f6f8", { solid: true });
    addF(it, "cubeshelf", ex - 56, ey + 6, 22, 10, SOUTH, "#2a2d33", { solid: true }); addF(it, "cubeshelf", ex + 56, ey + 6, 22, 10, SOUTH, "#2a2d33", { solid: true });
    it.guests.push({ x: ex, y: ey + 43, a: Math.PI / 2, anim: "idle", role: "clerk", shirt: "#2bb3ff", pants: "#1c1c22" }, { x: ex - 30, y: ey + 38, a: -0.4, anim: "phone" });
    if (electro) { electro.x = ex; electro.y = ey + 70; electro.a = -Math.PI / 2; electro.cx = electro.x; electro.cy = electro.y; }
  }
  addF(it, "vending", ix0 + 6, cy + 40, 14, 10, -Math.PI / 2, "#2bb3ff", { solid: true });
  addF(it, "directory", ix0 + 16, cy - 30, 12, 4, -Math.PI / 2, "#2a2d33");
  solidProps(it);
  // shoppers on every floor
  const gs: [number, number, number, number, string][] = [
    [cx - 40, cy - 30, 0, 0, "talk"], [cx + 40, cy - 10, Math.PI, 0, "phone"], [cx - 100, cy + 20, 0.5, 0, "idle"], [cx + 52, cy + 58 - 12, 0, 0, "talk"],
    [cx - 120, cy - A - 30, 0.3, Z1, "phone"], [cx + 120, cy + A + 30, 2.5, Z1, "talk"], [cx - 60, cy + A + 40, 1.6, Z1, "lookAround"],
    [cx + 20, cy - A - 40, 3.6, Z2, "idle"], [cx - 130, cy + 60, 0, Z2, "phone"], [cx + 128, cy + 20, Math.PI, Z2, "lookAround"],
  ];
  for (const [x, y, a, z, anim] of gs) it.guests.push({ x, y, a, anim, z });
  blk.buildings.push(...it.walls);
  pl.x = it.counter.x; pl.y = it.counter.y; pl.a = 0;
  return it;
}


// the apartment tower: a whole block, six storeys of 38 (ground floor: lobby, gym, games room and lounge;
// floors 1-5: four flats each, every one furnished and for sale), a lift and a staircase from the lobby up to
// the roof terrace with its pool, bar and the penthouse
export const TOWER = { storey: 38, floors: 6 };
export const FLAT_PRICES = [8000, 10000, 12500, 15000]; // first floor; every floor further up costs $2.500 more
export const PENTHOUSE_PRICE = 60000;
function buildTower(world: World, pl: Place): Interior | null {
  if (!pl.bld) return null;
  const blk = world.blockAt(pl.bld.x + 1, pl.bld.y + 1);
  if (!blk) return null;
  const s0x = blk.bx * BLOCK + ROAD, s0y = blk.by * BLOCK + ROAD, size = BLOCK - ROAD;
  const x0 = s0x + 18, y0 = s0y + 25, x1 = s0x + size - 25, y1 = s0y + size - 25, cy = (y0 + y1) / 2;
  blk.buildings.length = 0; blk.trees.length = 0;
  const S = TOWER.storey, NF = TOWER.floors, H = S * NF, ROOF = H + 2, dw = 26, CH = 24, CORE = 64, PER = 2;
  const Zs = Array.from({ length: NF }, (_, k) => k * S);
  const it: Interior = {
    id: "tower", kind: "tower", name: pl.name, color: pl.color, x0: x0 + T, y0: y0 + T, x1: x1 - T, y1: y1 - T, H,
    door: { x: x0, y: cy, w: dw }, counter: { x: 0, y: 0 }, clerk: { x: 0, y: 0, a: 0 }, props: [], seats: [], guests: [], walls: [], homes: [],
    levels: [], escalators: [], roofHoles: [], storey: S,
    floor: ["marble", "#cfc6b8"], wallTex: ["panel", "#d6cebf"], ceil: ["plaster", "#efe8dc"], lamps: "spot", light: "#fff0dc",
  };
  const w = (x: number, y: number, ww: number, hh: number) => it.walls.push(wallB(x, y, ww, hh, H));
  // a wall of one storey (z .. z + h); on the roof: the housings of the lift and the stairs, the penthouse
  const zw = (x: number, y: number, ww: number, hh: number, z: number, h = S) => it.walls.push({ ...wallB(x, y, ww, hh, z + h), zb: z, zt: z + h });
  // a rail (drawn as glass with a handrail)
  const rail = (x: number, y: number, ww: number, hh: number, z: number) => it.walls.push({ ...wallB(x, y, ww, hh, z + 12, true), zb: z, zt: z + 12 });
  w(x0, y0, T, cy - dw / 2 - y0); w(x0, cy + dw / 2, T, y1 - cy - dw / 2);
  w(x1 - T, y0, T, y1 - y0); w(x0, y0, x1 - x0, T); w(x0, y1 - T, x1 - x0, T);
  zw(x0, cy - dw / 2, T, dw, 26, H - 26); // over the door: closed from the top of the door up to the roof
  const ix0 = it.x0, ix1 = it.x1, iy0 = it.y0, iy1 = it.y1, fx0 = ix0 + CORE, fw = (ix1 - fx0) / PER;
  // ---- the core: the lift in the north-west corner (door to the south), the staircase in the south-west corner
  const lx0 = ix0 + 18, lx1 = lx0 + 30, ly0 = iy0, ly1 = iy0 + 30;
  const names = Zs.map((_, k) => (k === 0 ? "Erdgeschoss · Lobby" : `${k}. Etage · Wohnungen ${(k - 1) * 4 + 1}–${k * 4}`)).concat("Dachterrasse & Penthouse");
  it.elevator = { x0: lx0, y0: ly0, x1: lx1, y1: ly1, floors: [...Zs, ROOF], names, z: 0, to: 0, open: 1 };
  w(lx0 - 2, ly0, 2, ly1 - ly0 + 2); w(lx1, ly0, 2, ly1 - ly0 + 2); w(lx0 - 2, ly1, 9, 2); w(lx1 - 7, ly1, 9, 2);
  // stairs: two lanes of LW, a strip of ST at the floor, flights of RUN, a landing of LD half way up
  const LW = 22, ST = 20, RUN = 40, LD = 24;
  const sx0 = ix0, sx1 = ix0 + 2 * LW + 2, sy0 = iy1 - ST - RUN - LD, sMid = sy0 + ST + RUN;
  w(sx1, sy0 + ST, 2, iy1 - sy0 - ST); w(sx0 + LW, sy0 + ST, 2, RUN);
  // two flights per storey: up along the west lane to the landing, back along the east lane to the next floor
  for (let k = 0; k < NF; k++) {
    const za = Zs[k], zm = za + S / 2, zt = k < NF - 1 ? Zs[k + 1] : ROOF;
    it.escalators!.push(
      { x0: sx0 + 0.5, x1: sx0 + LW, y0: sy0 + ST, y1: sMid, za, zb: zm, up: true, stairs: true },
      { x0: sx0 + LW + 2, x1: sx1 - 0.5, y0: sy0 + ST, y1: sMid, za: zt, zb: zm, up: false, stairs: true },
    );
    it.levels!.push({ z: zm, slabs: [{ x0: sx0, y0: sMid, x1: sx1, y1: iy1 }] });
  }
  // ---- the floors above the ground: everything but the lift shaft and the stair well
  for (let k = 1; k < NF; k++) it.levels!.push({ z: Zs[k], slabs: [
    { x0: lx1 + 2, y0: iy0, x1: ix1, y1: iy1 }, { x0: ix0, y0: ly1 + 2, x1: lx1 + 2, y1: sy0 + ST },
    { x0: ix0, y0: iy0, x1: lx0 - 2, y1: ly1 + 2 }, { x0: sx1, y0: sy0 + ST, x1: lx1 + 2, y1: iy1 },
  ] });
  // ---- every storey: corridor walls with a door to each room, walls between the rooms
  for (let k = 0; k < NF; k++) {
    const z = Zs[k];
    for (const side of [-1, 1]) {
      const wy = side < 0 ? cy - CH - 3 : cy + CH;
      for (let q = 0; q < PER; q++) {
        const a = fx0 + q * fw, door = a + 14;
        zw(a, wy, door - a, 3, z); zw(door + 28, wy, a + fw - door - 28, 3, z);
        zw(a, side < 0 ? iy0 : cy + CH, 3, side < 0 ? cy - CH - iy0 : iy1 - cy - CH, z);
      }
    }
    const lv = k ? { lv: z } : {};
    // the hall at the lift: a sign with the floor, a plant, a bench
    addF(it, "directory", lx1 + 8, ly1 + 4, 12, 4, 0, "#2a2d33", lv);
    addF(it, "plant", fx0 - 8, cy - CH - 10, 12, 12, 0, "#3aa85c", lv);
    if (k) {
      addF(it, "bench", ix0 + 10, cy + 20, 30, 8, EAST, "#6a4a32", lv);
      addF(it, "rug", fx0 + 60, cy, 100, 26, 0, "#7a2a2a", { ...lv, c2: "#c9a227" });
      for (let q = 0; q < 3; q++) addF(it, "art", fx0 + 30 + q * 80, cy - CH - 2.2, 18, 1, SOUTH, ["#2bb3ff", "#ff6f91", "#3dd68c"][(q + k) % 3], { ...lv, z: 20, c2: ["sun", "wave", "abstract"][(q + k) % 3] });
      // four flats
      for (const side of [-1, 1]) for (let q = 0; q < PER; q++) {
        const a = fx0 + q * fw + 3, b = fx0 + (q + 1) * fw, near = side < 0 ? cy - CH - 3 : cy + CH + 3, far = side < 0 ? iy0 : iy1;
        const n = (k - 1) * 4 + (side < 0 ? 0 : 2) + q;
        flat(it, a, b, near, far, n, side < 0 ? "Nord" : "Süd", z, k);
      }
    }
    // a few residents
    if (k) it.guests.push({ x: fx0 + 40 + (k % 2) * 120, y: cy + (k % 2 ? 8 : -8), a: k % 2 ? 0 : Math.PI, anim: k % 3 ? "phone" : "talk", z });
  }
  // ---- ground floor: lobby with the concierge, letter boxes, a sofa; gym, games room, cinema and lounge
  addF(it, "reception", ix0 + 30, cy - 56, 40, 12, 0, "#6a4a32", { solid: true });
  it.counter = { x: ix0 + 30, y: cy - 38 }; it.clerk = { x: ix0 + 30, y: cy - 66, a: Math.PI / 2 };
  addF(it, "mail", fx0 - 5, cy - 95, 34, 8, WEST, "#8a9098", { solid: true });
  addF(it, "sofa", ix0 + 8, cy + 40, 40, 14, EAST, "#7a5a3a", { solid: true });
  it.seats.push({ x: ix0 + 11, y: cy + 34, a: 0 }, { x: ix0 + 11, y: cy + 46, a: 0 });
  addF(it, "palm", ix0 + 52, cy - 34, 14, 14); addF(it, "palm", ix0 + 52, cy + 34, 14, 14);
  addF(it, "rug", ix0 + 30, cy, 44, 60, 0, "#8a2a2a", { c2: "#c9a227" });
  it.guests.push({ x: ix0 + 40, y: cy + 70, a: Math.PI, anim: "phone" });
  {
    const N0 = iy0, N1 = cy - CH - 3, S0 = cy + CH + 3, S1 = iy1, A = fx0 + 3, M = fx0 + fw, B = ix1;
    // gym (north-west)
    addF(it, "rubber", (A + M) / 2, (N0 + N1) / 2, M - A - 10, N1 - N0 - 10, 0, "#2a2a2e");
    for (let q = 0; q < 3; q++) addF(it, "treadmill", A + 20 + q * 34, N0 + 22, 14, 30, NORTH, "#2a2d33", { solid: true });
    addF(it, "weights", A + 40, N1 - 30, 30, 16, 0, "#2a2d33", { solid: true });
    addF(it, "dumbbells", M - 26, N1 - 30, 26, 10, WEST, "#2a2d33", { solid: true });
    addF(it, "mirror", M - 1, (N0 + N1) / 2, 40, 1, WEST, "#c9e6ff", { z: 6 });
    it.guests.push({ x: A + 70, y: N1 - 50, a: 0.4, anim: "idle" });
    // games room (north-east): billiards, arcade machines, jukebox
    addF(it, "pool", (M + B) / 2, (N0 + N1) / 2, 44, 24, 0, "#2d7a4a", { solid: true });
    for (let q = 0; q < 3; q++) addF(it, "arcade", M + 20 + q * 18, N0 + 8, 14, 12, SOUTH, ["#c0392b", "#2b6bff", "#9d4dff"][q], { solid: true });
    addF(it, "jukebox", B - 8, N1 - 20, 12, 10, WEST, "#c0392b", { solid: true });
    addF(it, "neon", (M + B) / 2, N0 + 0.6, 30, 1, SOUTH, "#2bf0ff", { z: 26, c2: "GAME ON" });
    it.guests.push({ x: (M + B) / 2 + 30, y: (N0 + N1) / 2 + 4, a: Math.PI, anim: "talk" });
    // cinema (south-west): screen, rows of sofas
    addF(it, "tvwall", (A + M) / 2, S1 - 4, 70, 4, NORTH, "#15161b", { z: 4 });
    for (let r = 0; r < 2; r++) {
      addF(it, "sofa", (A + M) / 2, S0 + 26 + r * 26, 60, 15, SOUTH, "#5a2a3a", { solid: true });
      for (const dx of [-16, 0, 16]) it.seats.push({ x: (A + M) / 2 + dx, y: S0 + 31 + r * 26, a: Math.PI / 2 });
    }
    // lounge (south-east): fireplace, piano, corner sofa
    addF(it, "fireplace", B - 6, (S0 + S1) / 2, 30, 10, WEST, "#8a7a6a", { solid: true });
    addF(it, "sofaL", M + 50, S1 - 30, 60, 40, NORTH, "#3a5a7a", { solid: true });
    addF(it, "piano", M + 22, S0 + 26, 26, 18, SOUTH, "#15161b", { solid: true });
    addF(it, "coffee", M + 50, S1 - 58, 22, 11, 0, "#6a4a32");
    addF(it, "plant", B - 10, S0 + 10, 12, 12);
    it.seats.push({ x: M + 40, y: S1 - 36, a: -Math.PI / 2 }, { x: M + 56, y: S1 - 36, a: -Math.PI / 2 });
  }
  // ---- the roof: lift and stair housings, a glass rail around the edge, a pool, a bar, loungers, the penthouse
  const RH = 36, R = { lv: ROOF };
  it.levels!.push({ z: ROOF, slabs: [] });
  zw(lx0 - 2, iy0 - 2, lx1 - lx0 + 4, 2, ROOF, RH); zw(lx0 - 2, iy0, 2, ly1 - iy0 + 2, ROOF, RH); zw(lx1, iy0, 2, ly1 - iy0 + 2, ROOF, RH);
  zw(lx0 - 2, ly1, 9, 2, ROOF, RH); zw(lx1 - 7, ly1, 9, 2, ROOF, RH);
  zw(x0, sy0 - 2, T, iy1 - sy0 + 2, ROOF, RH); zw(x0, iy1, sx1 + 2 - x0, T, ROOF, RH); zw(sx1, sy0 - 2, 2, iy1 - sy0 + 2, ROOF, RH);
  zw(sx0, sy0 - 2, 4, 2, ROOF, RH); zw(sx0 + 26, sy0 - 2, sx1 - sx0 - 26, 2, ROOF, RH);
  it.levels!.push({ z: ROOF + RH, slabs: [{ x0: lx0 - 2, y0: iy0 - 2, x1: lx1 + 2, y1: ly1 + 2 }, { x0: x0, y0: sy0 - 2, x1: sx1 + 2, y1: iy1 + T }] });
  it.roofHoles!.push({ x0: lx0, y0: ly0, x1: lx1, y1: ly1 }, { x0: sx0, y0: sy0 + ST - 1, x1: sx1, y1: iy1 });
  rail(x0, y0, x1 - x0, 2, ROOF); rail(x0, y1 - 2, x1 - x0, 2, ROOF); rail(x0, y0, 2, y1 - y0, ROOF); rail(x1 - 2, y0, 2, y1 - y0, ROOF);
  // the penthouse: a glass pavilion on the east half of the roof, its door looks west
  const px0 = ix1 - 150, px1 = ix1 - 6, py0 = iy0 + 20, py1 = cy + 30, pdy = (py0 + py1) / 2;
  zw(px0, py0, 3, pdy - 14 - py0, ROOF, RH); zw(px0, pdy + 14, 3, py1 - pdy - 14, ROOF, RH);
  zw(px1 - 3, py0, 3, py1 - py0, ROOF, RH); zw(px0, py0, px1 - px0, 3, ROOF, RH); zw(px0, py1 - 3, px1 - px0, 3, ROOF, RH);
  it.levels!.push({ z: ROOF + RH, slabs: [{ x0: px0, y0: py0, x1: px1, y1: py1 }] });
  for (const u of [0.25, 0.5, 0.75]) {
    addF(it, "window", px0 + (px1 - px0) * u, py0 + 3.6, 28, 1, SOUTH, "#e8e4dc", { ...R, z: 6 });
    addF(it, "window", px0 + (px1 - px0) * u, py1 - 3.6, 28, 1, NORTH, "#e8e4dc", { ...R, z: 6 });
  }
  addF(it, "bed", px1 - 30, py0 + 30, 30, 36, WEST, "#2a2d33", { ...R, solid: true });
  addF(it, "side", px1 - 8, py0 + 8, 9, 8, WEST, "#2a2016", R);
  addF(it, "wardrobe", px1 - 70, py0 + 9, 30, 10, SOUTH, "#2a2016", { ...R, solid: true });
  addF(it, "sofaL", px0 + 46, py1 - 26, 56, 36, NORTH, "#e8e2d4", { ...R, solid: true });
  addF(it, "tv", px0 + 46, py0 + 10, 34, 9, SOUTH, "#2a2016", { ...R, solid: true });
  addF(it, "rug", px0 + 46, (py0 + py1) / 2, 56, 40, 0, "#c9a070", { ...R, c2: "#2a2d33" });
  addF(it, "island", px1 - 40, py1 - 22, 30, 12, NORTH, "#e8e4dc", { ...R, solid: true });
  addF(it, "fridge", px1 - 12, py1 - 10, 12, 12, NORTH, "#c9ced8", { ...R, solid: true });
  addF(it, "palm", px0 + 10, py0 + 12, 14, 14, 0, "#3aa85c", R);
  it.seats.push({ x: px0 + 36, y: py1 - 30, a: -Math.PI / 2, z: ROOF }, { x: px0 + 52, y: py1 - 30, a: -Math.PI / 2, z: ROOF });
  it.homes!.push({ id: "penthouse", name: "Penthouse", price: PENTHOUSE_PRICE, bed: { x: px1 - 30, y: py0 + 52, z: ROOF }, x0: px0, y0: py0, x1: px1, y1: py1, z: ROOF });
  // the terrace: pool with loungers, a hot tub, a bar with stools, tables, palms, lamps
  const tx = (fx0 + px0) / 2;
  addF(it, "swim", tx + 10, cy + 90, 120, 60, 0, "#2bb3ff", R);
  for (let q = 0; q < 4; q++) { addF(it, "bench", tx - 40 + q * 32, cy + 140, 24, 10, NORTH, "#f4f2ee", R); it.seats.push({ x: tx - 40 + q * 32, y: cy + 138, a: -Math.PI / 2, z: ROOF }); }
  addF(it, "hottub", px1 - 30, cy + 100, 36, 36, 0, "#7ac8e8", { ...R, solid: true });
  addF(it, "bar", fx0 + 20, cy - 60, 50, 12, EAST, "#3a2a1a", { ...R, solid: true });
  for (let q = 0; q < 3; q++) { addF(it, "stool", fx0 + 36, cy - 76 + q * 16, 7, 7, 0, "#c9ced8", R); it.seats.push({ x: fx0 + 36, y: cy - 76 + q * 16, a: Math.PI, z: ROOF }); }
  for (const [qx, qy] of [[tx - 30, cy - 20], [tx + 30, cy - 20]]) {
    addF(it, "rtable", qx, qy, 16, 16, 0, "#f4f2ee", { ...R, solid: true });
    addF(it, "chair", qx - 12, qy, 9, 9, EAST, "#c9a070", R); addF(it, "chair", qx + 12, qy, 9, 9, WEST, "#c9a070", R);
    it.seats.push({ x: qx - 12, y: qy, a: 0, z: ROOF }, { x: qx + 12, y: qy, a: Math.PI, z: ROOF });
  }
  for (const [qx, qy] of [[fx0 - 10, iy0 + 50], [ix1 - 10, iy1 - 10], [fx0 + 10, iy1 - 12], [tx, iy0 + 14]]) addF(it, "palm", qx, qy, 16, 16, 0, "#3aa85c", R);
  for (const [qx, qy] of [[tx - 60, cy + 40], [tx + 70, cy + 40]]) addF(it, "lamp", qx, qy, 8, 8, 0, "#f2e2c0", R);
  it.guests.push({ x: tx - 10, y: cy - 40, a: 0.3, anim: "talk", z: ROOF }, { x: fx0 + 6, y: cy - 60, a: 0, anim: "idle", z: ROOF }, { x: tx + 60, y: cy + 128, a: 2, anim: "phone", z: ROOF });
  solidProps(it);
  blk.buildings.push(...it.walls);
  pl.x = it.counter.x; pl.y = it.counter.y; pl.a = 0;
  return it;
}

// one flat between x a..b; near: its corridor wall, far: the outer wall (u across from a, v from the corridor);
// lv: the floor it is on, k: which storey (the windows show more of the bay further up)
const FLAT_LOOK = [
  { sofa: "#3a5a7a", bed: "#2e4a7a", rug: "#c9a070", wood: "#6a4a32", art: "sun" },
  { sofa: "#7a3a4a", bed: "#7a2a3a", rug: "#8a9a6a", wood: "#3a2a1a", art: "wave" },
  { sofa: "#4a6a3a", bed: "#3a5a3a", rug: "#c97a5a", wood: "#8a6a4a", art: "abstract" },
  { sofa: "#c9a070", bed: "#5a4a8a", rug: "#2e6da4", wood: "#5a3a22", art: "sea" },
  { sofa: "#2a2d33", bed: "#c0392b", rug: "#e8e2d4", wood: "#2a2016", art: "abstract" },
  { sofa: "#9d4dff", bed: "#2bb3ff", rug: "#ffd23f", wood: "#c9a070", art: "sun" },
  { sofa: "#e8e2d4", bed: "#8a9098", rug: "#3a5a7a", wood: "#c9a070", art: "wave" },
];
function flat(it: Interior, a: number, b: number, near: number, far: number, n: number, side: string, lv: number, k: number) {
  const dir = Math.sign(far - near), D = Math.abs(far - near), Wf = b - a, lk = FLAT_LOOK[(n * 3 + k) % FLAT_LOOK.length];
  const X = (u: number) => a + u, Y = (v: number) => near + dir * v;
  const IN = dir > 0 ? 0 : Math.PI;            // front looks away from the corridor (into the flat)
  const OUT = dir > 0 ? Math.PI : 0;           // front looks to the corridor
  const LEFT = -Math.PI / 2, RIGHT = Math.PI / 2; // front looks east (+u) / west (-u)
  const S = it.storey ?? it.H;
  const F = (kk: string, u: number, v: number, w: number, d: number, ang: number, c = "#8a8a8a", o: FOpt = {}) => addF(it, kk, X(u), Y(v), w, d, ang, c, { ...o, lv });
  const sit = (u: number, v: number, toCorridor: boolean) => it.seats.push({ x: X(u), y: Y(v), a: (toCorridor ? -dir : dir) * Math.PI / 2, z: lv });
  const wall = (x: number, y: number, ww: number, hh: number) => it.walls.push({ ...wallB(x, y, ww, hh, lv + S), zb: lv, zt: lv + S });
  // bathroom by the corridor on the right: shower, toilet, basin with a mirror
  const bu = Wf - 40, bv = 40;
  wall(X(bu) - 1.5, Math.min(Y(0), Y(bv)), 3, bv); wall(X(bu), Y(bv) - 1.5, 8, 3);
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
  // windows in the outer wall, a lamp over the dining table, a bookshelf
  F("window", Wf * 0.2, D - 0.6, 24, 1, OUT, "#e8e4dc", { z: 8, c2: n % 2 ? "blinds" : undefined }); F("window", Wf * 0.86, D - 0.6, 20, 1, OUT, "#e8e4dc", { z: 8 });
  F("pendant", 34, bv + 30, 9, 9, 0, lk.wood);
  F("shelf", Wf * 0.56 - 42, D - 5, 18, 8, OUT, lk.wood, { solid: true });
  F("art", bedU, D - 0.6, 24, 1, OUT, lk.sofa, { z: 22, c2: lk.art });
  const bed = { x: X(bedU), y: Y(bedV - 24), z: lv };
  const price = FLAT_PRICES[n % 4] + Math.floor(n / 4) * 2500;
  it.homes!.push({ id: "flat" + (n + 1), name: `Wohnung ${n + 1} (${k}. Etage, ${side})`, price, bed, x0: Math.min(a, b), y0: Math.min(near, far), x1: Math.max(a, b), y1: Math.max(near, far), z: lv });
}

// ---------------------------------------------------------------------------------------- queries
export function interiorAt(list: Interior[], x: number, y: number): Interior | null {
  for (const it of list) if (x > it.x0 - 2 && x < it.x1 + 2 && y > it.y0 - 2 && y < it.y1 + 2) return it;
  return null;
}
// floor height inside (mall: upper floors, escalators, the lift cabin); z: where you are now (under a gallery you stay down)
export function interiorFloor(list: Interior[], x: number, y: number, z: number): number {
  for (const it of list) {
    if (!it.levels || x < it.x0 || x > it.x1 || y < it.y0 || y > it.y1) continue;
    const el = it.elevator;
    if (el && x > el.x0 && x < el.x1 && y > el.y0 && y < el.y1) return el.z;
    let best = -Infinity;
    for (const lv of it.levels) if (lv.z <= z + 12 && lv.z > best && lv.slabs.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1)) best = lv.z;
    for (const e of it.escalators!) if (x > e.x0 && x < e.x1 && y > e.y0 && y < e.y1) {
      const h = e.za + (e.zb - e.za) * (y - e.y0) / (e.y1 - e.y0);
      if (h <= z + 12 && h > best) best = h;
    }
    return best;
  }
  return -Infinity;
}
// the ceiling above (x, y) for someone standing at z: the underside of the next floor up, else the roof
export function interiorCeil(it: Interior, x: number, y: number, z: number): number {
  let c = onRoof(it, z) ? Infinity : it.H;
  if (it.levels) for (const lv of it.levels) if (lv.z > z + 12 && lv.z - 1.5 < c && lv.slabs.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1)) c = lv.z - 1.5;
  return c;
}
// standing on the roof (tower: the roof terrace) rather than in a storey
export const onRoof = (it: Interior, z: number) => z > it.H - 4;
// the roof is open here (stairs and lift go through)
export const inRoofHole = (it: Interior, x: number, y: number) => !!it.roofHoles?.some((r) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1);
// which floor (index) someone at height z is on
export const levelOf = (it: Interior, z: number) => { let k = 0; if (it.levels) it.levels.forEach((lv, i) => { if (z > lv.z - 14) k = i + 1; }); return k; };
