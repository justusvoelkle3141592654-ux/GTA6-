// walk-in interiors: room layouts (walls, furniture, people, interaction spots) and their collision
// Room coordinates: x from 0 (west) to w (east), y from 0 (north) to h (south); 16 units are about one metre.
// The entrance is a door gap in the south wall at x = door. Rooms live far outside the map (ROOM_ORIGIN),
// so nothing of the city can touch the player while inside.

export const ROOM_ORIGIN = { x: 60000, y: 60000 };
export const ROOM_WALL_H = 52;   // ceiling height
export const ROOM_WALL_T = 6;    // wall thickness
export const ROOM_DOOR = 20;     // half width of a door gap
export const ROOM_PED_R = 7;     // the player's radius inside
export const SPOT_RADIUS = 24;   // how close you have to be to use a spot

export type FloorStyle = "wood" | "darkwood" | "parquet" | "planks" | "tile" | "marble" | "checker" | "carpet" | "concrete" | "lino" | "terrazzo" | "tatami";
export type WallStyle = "paint" | "brick" | "wood" | "tile" | "stripe" | "concrete";

export type FurnKind =
  | "bed" | "waterbed" | "futon" | "bunk" | "side" | "sofa" | "sofaL" | "armchair" | "coffee" | "table" | "rtable" | "chair" | "stool" | "desk" | "pc"
  | "counter" | "stove" | "sink" | "fridge" | "island" | "espresso" | "tv" | "tvwall" | "shelf" | "plant" | "palm" | "bonsai" | "rug" | "lamp" | "wardrobe"
  | "bath" | "toilet" | "basin" | "shower" | "shopcounter" | "rack" | "gunwall" | "case" | "booth" | "bar" | "bottles" | "hbed" | "reception" | "bench"
  | "locker" | "bars" | "crate" | "drum" | "tires" | "carprop" | "lift" | "toolwall" | "workbench" | "piano" | "pool" | "arcade" | "hottub" | "swim"
  | "fireplace" | "mail" | "elevator" | "door" | "neon" | "art" | "mirror" | "board" | "map" | "lowtable" | "cushion" | "tank" | "jukebox" | "files"
  | "vending" | "cooler" | "curtain" | "treadmill" | "column" | "dj";

export interface Furn {
  k: FurnKind;
  x: number; y: number; // centre
  w: number; d: number; // width and depth before turning (the front looks to +y = south)
  r: 0 | 1 | 2 | 3;     // turned in 90° steps: 0 front south, 1 west, 2 north, 3 east
  c: string; c2: string; // main and second colour (neon / art: c2 is the text)
  solid: boolean;
  z: number;            // lifted (things on a desk or high on a wall)
}
export interface Wall { x0: number; y0: number; x1: number; y1: number; } // straight inner wall (along x or y)
export type SpotKind = "exit" | "shop" | "talk" | "bed" | "fridge" | "tv" | "pc" | "heal" | "door" | "buy" | "info" | "shower" | "music" | "game";
export interface Spot { x: number; y: number; k: SpotKind; label: string; to?: string; }
export interface Npc { x: number; y: number; a: number; shirt: string; pants: string; hair: string; skin: string; }

export interface RoomDef {
  id: string; name: string;
  w: number; h: number; door: number;
  floor: FloorStyle; floorCol: string;
  wallStyle: WallStyle; wallCol: string; trim: string;
  light: string;                        // colour of the ceiling lights
  win: [number, number][];              // window x-ranges in the north wall
  winW?: [number, number][]; winE?: [number, number][]; // y-ranges in the west / east wall
  walls: Wall[]; furn: Furn[]; spots: Spot[]; npcs: Npc[];
  lamps: [number, number][];            // ceiling lights
  parent?: string;                      // apartments: you leave into the tower hallway
  price?: number;                       // can be bought as a home
  home?: boolean;                       // always yours (safehouse)
}

// default: big things block the way, small ones (chairs, rugs, wall decoration) do not
const SOFT = new Set<FurnKind>(["chair", "stool", "rug", "pc", "neon", "art", "mirror", "board", "map", "cushion", "tvwall", "espresso", "curtain", "door", "elevator", "bottles", "gunwall", "toolwall", "mail"]);
// base height: things standing on a desk / counter, or hanging on a wall
const HIGH: Partial<Record<FurnKind, number>> = { pc: 13, espresso: 15.5, neon: 32, art: 22, map: 20, board: 18, tvwall: 16, mirror: 10, bottles: 20, gunwall: 14, toolwall: 14, mail: 6 };
function F(k: FurnKind, x: number, y: number, w: number, d: number, r: 0 | 1 | 2 | 3 = 0, c = "", c2 = ""): Furn {
  return { k, x, y, w, d, r, c, c2, solid: !SOFT.has(k), z: HIGH[k] ?? 0 };
}
const exit = (x: number, y: number): Spot => ({ x, y, k: "exit", label: "Rausgehen" });
const P = (shirt: string, pants: string, hair = "#2b1d14", skin = "#c98b66") => ({ shirt, pants, hair, skin });
const npc = (x: number, y: number, a: number, look: ReturnType<typeof P>): Npc => ({ x, y, a, ...look });
const S = Math.PI / 2, W = Math.PI;

// four chairs around a table at (x, y)
function dining(x: number, y: number, w: number, d: number, col: string, chairCol: string, round = false): Furn[] {
  const t = F(round ? "rtable" : "table", x, y, w, d, 0, col);
  const out = [t];
  if (round) { out.push(F("chair", x, y - d / 2 - 8, 12, 12, 0, chairCol), F("chair", x, y + d / 2 + 8, 12, 12, 2, chairCol), F("chair", x - w / 2 - 8, y, 12, 12, 3, chairCol), F("chair", x + w / 2 + 8, y, 12, 12, 1, chairCol)); return out; }
  const n = Math.max(1, Math.round(w / 22));
  for (let i = 0; i < n; i++) { const cx = x - w / 2 + (w / n) * (i + 0.5); out.push(F("chair", cx, y - d / 2 - 8, 12, 12, 0, chairCol), F("chair", cx, y + d / 2 + 8, 12, 12, 2, chairCol)); }
  return out;
}

export const ROOMS: Record<string, RoomDef> = {
  // ---------------------------------------------------------------- 1 safehouse (always yours)
  safehouse: {
    id: "safehouse", name: "Safehouse", w: 240, h: 170, door: 120, home: true,
    floor: "wood", floorCol: "#a0714a", wallStyle: "paint", wallCol: "#d9d2c3", trim: "#5a4636", light: "#ffd9a8",
    win: [[90, 160]], winE: [[50, 90]],
    walls: [], lamps: [[60, 60], [150, 70], [210, 120]],
    furn: [
      F("bed", 34, 40, 40, 56, 0, "#c94f6d"), F("side", 64, 12, 14, 12, 0, "#6a4a32"), F("wardrobe", 8, 112, 30, 16, 3, "#7a5a40"),
      F("rug", 125, 66, 100, 62, 0, "#4b5f8a", "#e8d9b0"), F("sofa", 125, 18, 76, 28, 0, "#3d4a5c"), F("coffee", 125, 58, 40, 20, 0, "#6a4a32"),
      F("tv", 125, 106, 60, 14, 2, "#22252c"), F("lamp", 78, 26, 12, 12, 0, "#f2e2c0"),
      F("sink", 188, 12, 28, 22, 0, "#e8e4dc"), F("stove", 213, 12, 22, 22, 0, "#e8e4dc"), F("fridge", 232, 12, 16, 22, 0, "#d8dde4"),
      ...dining(204, 70, 30, 30, "#8a6a4a", "#5a4636", true),
      F("desk", 229, 130, 40, 22, 1, "#5a4636"), F("pc", 229, 130, 30, 12, 1, "#22252c"), F("chair", 210, 130, 12, 12, 3, "#22252c"),
      F("plant", 160, 152, 14, 14), F("plant", 12, 152, 14, 14), F("art", 40, 1, 36, 3, 0, "#e86a5a", "sun"), F("shelf", 90, 152, 30, 12, 2, "#6a4a32"),
    ],
    spots: [exit(120, 154), { x: 34, y: 82, k: "bed", label: "Schlafen & speichern" }, { x: 125, y: 90, k: "tv", label: "Fernsehen" }, { x: 204, y: 130, k: "pc", label: "Computer: Bank & Garage" }, { x: 232, y: 38, k: "fridge", label: "Kühlschrank" }],
    npcs: [],
  },
  // ---------------------------------------------------------------- 2 gun shop
  gunshop: {
    id: "gunshop", name: "Kaliber Waffen", w: 220, h: 150, door: 110,
    floor: "concrete", floorCol: "#7a7670", wallStyle: "brick", wallCol: "#6a4f44", trim: "#2a2d33", light: "#fff0d8",
    win: [], walls: [], lamps: [[60, 50], [160, 50], [110, 110]],
    furn: [
      F("shopcounter", 110, 64, 130, 18, 0, "#2a2d33"), F("gunwall", 110, 4, 160, 8, 0, "#3a3d45"),
      F("case", 36, 108, 44, 20, 0, "#2a2d33"), F("case", 184, 108, 44, 20, 0, "#2a2d33"),
      F("crate", 14, 22, 22, 22, 0, "#7a6040"), F("crate", 14, 46, 22, 22, 0, "#6a5236"), F("drum", 206, 20, 16, 16, 0, "#3f5a2a"),
      F("neon", 219, 90, 70, 4, 1, "#ff9f43", "KALIBER"), F("art", 1, 100, 30, 3, 3, "#3a5a2a", "target"), F("plant", 206, 138, 14, 14),
    ],
    spots: [exit(110, 134), { x: 110, y: 88, k: "shop", label: "Waffen & Munition kaufen" }],
    npcs: [npc(110, 44, S, P("#3f5a2a", "#2b2f3a", "#1b1410", "#b07a58"))],
  },
  // ---------------------------------------------------------------- 3 boutique
  clothes: {
    id: "clothes", name: "Bay Boutique", w: 230, h: 160, door: 115,
    floor: "terrazzo", floorCol: "#e8e2da", wallStyle: "paint", wallCol: "#f2d5e0", trim: "#ffffff", light: "#ffe8f2",
    win: [[20, 60], [170, 210]], walls: [], lamps: [[60, 70], [170, 70], [115, 120]],
    furn: [
      F("shopcounter", 115, 30, 70, 18, 0, "#ffffff"), F("rack", 44, 52, 54, 14, 0, "#c9ced8"), F("rack", 44, 100, 54, 14, 0, "#c9ced8"),
      F("rack", 186, 52, 54, 14, 0, "#c9ced8"), F("rack", 186, 100, 54, 14, 0, "#c9ced8"), F("bench", 115, 96, 40, 18, 0, "#ff8ad1"),
      F("rug", 115, 96, 80, 50, 0, "#ffd1e6", "#ffffff"), F("mirror", 1, 140, 30, 3, 3, "#c9e6ff"), F("mirror", 229, 140, 30, 3, 1, "#c9e6ff"),
      F("curtain", 12, 14, 24, 24, 0, "#9d4dff"), F("curtain", 218, 14, 24, 24, 0, "#9d4dff"),
      F("plant", 14, 146, 14, 14), F("plant", 216, 146, 14, 14), F("neon", 115, 1, 80, 4, 0, "#ff3cac", "BAY BOUTIQUE"),
    ],
    spots: [exit(115, 144), { x: 115, y: 54, k: "shop", label: "Kleidung kaufen" }],
    npcs: [npc(115, 12, S, P("#ff8ad1", "#2b2f3a", "#e8c070", "#e0b090"))],
  },
  // ---------------------------------------------------------------- 4 taco restaurant
  food: {
    id: "food", name: "Taco Loco", w: 240, h: 160, door: 120,
    floor: "checker", floorCol: "#f4f4f4", wallStyle: "stripe", wallCol: "#f4c542", trim: "#c0392b", light: "#ffe2b0",
    win: [], winW: [[50, 130]], winE: [[50, 130]], walls: [], lamps: [[60, 70], [180, 70], [120, 110]],
    furn: [
      F("bar", 120, 26, 120, 20, 0, "#c0392b"), F("espresso", 150, 26, 12, 10, 0, "#c9ced8"), F("bottles", 120, 2, 100, 6, 0, "#6a4a32"),
      F("booth", 30, 64, 52, 40, 0, "#c0392b"), F("booth", 30, 118, 52, 40, 0, "#c0392b"), F("booth", 210, 64, 52, 40, 0, "#c0392b"), F("booth", 210, 118, 52, 40, 0, "#c0392b"),
      F("rtable", 120, 96, 26, 26, 0, "#f4f4f4"), F("stool", 104, 96, 10, 10, 0, "#2a2d33"), F("stool", 136, 96, 10, 10, 0, "#2a2d33"),
      F("jukebox", 224, 146, 18, 14, 2, "#c0392b"), F("palm", 16, 146, 16, 16), F("neon", 120, 1, 90, 4, 0, "#3dff8b", "TACO LOCO"),
    ],
    spots: [exit(120, 144), { x: 120, y: 52, k: "shop", label: "Essen bestellen" }, { x: 204, y: 150, k: "music", label: "Jukebox" }],
    npcs: [npc(120, 10, S, P("#ffffff", "#2b2f3a", "#1b1410", "#a8704c"))],
  },
  // ---------------------------------------------------------------- 5 burger restaurant
  food2: {
    id: "food2", name: "Burger Bucht", w: 240, h: 160, door: 120,
    floor: "tile", floorCol: "#d8d2c8", wallStyle: "tile", wallCol: "#eadbc8", trim: "#c73e3e", light: "#fff0d8",
    win: [[16, 70], [170, 224]], walls: [], lamps: [[60, 80], [180, 80], [120, 40]],
    furn: [
      F("bar", 120, 26, 110, 20, 0, "#c73e3e"), F("bottles", 120, 2, 90, 6, 0, "#3a3d45"),
      ...dining(62, 82, 40, 24, "#f4f4f4", "#c73e3e"), ...dining(178, 82, 40, 24, "#f4f4f4", "#c73e3e"),
      ...dining(62, 126, 40, 22, "#f4f4f4", "#c73e3e"), ...dining(178, 126, 40, 22, "#f4f4f4", "#c73e3e"),
      F("arcade", 14, 50, 16, 16, 3, "#2b6dff"), F("vending", 226, 50, 18, 16, 1, "#c73e3e"), F("plant", 14, 146, 14, 14), F("plant", 226, 146, 14, 14),
      F("neon", 120, 1, 96, 4, 0, "#ffd23f", "BURGER BUCHT"),
    ],
    spots: [exit(120, 144), { x: 120, y: 52, k: "shop", label: "Essen bestellen" }, { x: 30, y: 50, k: "game", label: "Automat spielen ($5)" }],
    npcs: [npc(120, 10, S, P("#c73e3e", "#2b2f3a", "#6a4020", "#e0b090"))],
  },
  // ---------------------------------------------------------------- 6 hospital
  hospital: {
    id: "hospital", name: "St. Aurelia Klinik", w: 260, h: 170, door: 130,
    floor: "lino", floorCol: "#c8d6dc", wallStyle: "paint", wallCol: "#eef2f4", trim: "#5aa0c8", light: "#f2fbff",
    win: [[20, 80]], winE: [[20, 150]], walls: [{ x0: 180, y0: 0, x1: 180, y1: 60 }, { x0: 180, y0: 100, x1: 180, y1: 170 }], lamps: [[70, 60], [130, 120], [220, 40], [220, 130]],
    furn: [
      F("reception", 100, 36, 80, 24, 0, "#ffffff"), F("pc", 90, 36, 24, 10, 0, "#22252c"),
      F("bench", 12, 92, 56, 16, 3, "#5aa0c8"), F("bench", 12, 140, 40, 16, 3, "#5aa0c8"), F("cooler", 14, 20, 14, 14, 0, "#c9e6ff"),
      F("vending", 164, 150, 18, 16, 1, "#3d8bff"), F("plant", 164, 14, 14, 14), F("plant", 60, 156, 14, 14),
      F("hbed", 220, 30, 30, 50, 0, "#ffffff"), F("hbed", 220, 128, 30, 50, 2, "#ffffff"), F("curtain", 246, 80, 26, 8, 0, "#a8d8e8"),
      F("cushion", 200, 80, 12, 12, 0, "#ff3b4e"), F("board", 100, 1, 50, 3, 0, "#ffffff", "+"),
    ],
    spots: [exit(130, 154), { x: 100, y: 62, k: "heal", label: "Behandlung ($150)" }],
    npcs: [npc(100, 16, S, P("#ffffff", "#c9e6ff", "#3b2a1e", "#e0b090")), npc(236, 80, W, P("#7ac8a0", "#7ac8a0", "#1b1410", "#a8704c"))],
  },
  // ---------------------------------------------------------------- 7 police station
  police: {
    id: "police", name: "Polizeiwache Mitte", w: 260, h: 170, door: 130,
    floor: "lino", floorCol: "#a9b0b8", wallStyle: "stripe", wallCol: "#cfd6de", trim: "#1f3a6e", light: "#eef4ff",
    win: [[30, 90]], walls: [], lamps: [[70, 60], [130, 120], [220, 50]],
    furn: [
      F("reception", 130, 44, 90, 22, 0, "#1f3a6e"), F("pc", 120, 44, 24, 10, 0, "#22252c"),
      F("desk", 40, 50, 44, 22, 0, "#6a7480"), F("pc", 40, 50, 24, 10, 0, "#22252c"), F("chair", 40, 34, 12, 12, 0, "#22252c"),
      F("desk", 40, 104, 44, 22, 0, "#6a7480"), F("pc", 40, 104, 24, 10, 0, "#22252c"), F("chair", 40, 88, 12, 12, 0, "#22252c"),
      F("bars", 200, 52, 4, 104, 0, "#8a9098"), F("bars", 230, 102, 60, 4, 0, "#8a9098"), F("bench", 240, 20, 30, 14, 2, "#6a7480"),
      F("locker", 8, 150, 36, 12, 3, "#5a6a7a"), F("files", 176, 150, 20, 14, 2, "#6a7480"), F("board", 130, 1, 70, 3, 0, "#f4f4f4", "FAHNDUNG"), F("plant", 176, 14, 14, 14),
    ],
    spots: [exit(130, 154), { x: 130, y: 70, k: "info", label: "Schwarzes Brett" }],
    npcs: [npc(130, 24, S, P("#1f3a6e", "#16213a", "#1b1410", "#b07a58")), npc(236, 40, S, P("#ff8a1f", "#ff8a1f", "#3b2a1e", "#e0b090"))],
  },
  // ---------------------------------------------------------------- 8 Lou's workshop (contact)
  lou: {
    id: "lou", name: "Lous Werkstatt", w: 260, h: 180, door: 130,
    floor: "concrete", floorCol: "#6e6a64", wallStyle: "brick", wallCol: "#7a5444", trim: "#2a2d33", light: "#fff4dc",
    win: [[30, 90], [170, 230]], walls: [], lamps: [[70, 70], [190, 70], [130, 130]],
    furn: [
      F("lift", 70, 62, 52, 72, 0, "#d9b23a"), { ...F("carprop", 70, 62, 30, 54, 0, "#ff2d95"), z: 14 }, F("carprop", 192, 62, 30, 54, 0, "#2bf0ff"),
      F("toolwall", 130, 3, 80, 6, 0, "#3a3d45"), F("workbench", 248, 140, 50, 22, 1, "#6a5236"), F("tires", 14, 150, 20, 20), F("tires", 14, 124, 20, 20),
      F("drum", 248, 20, 16, 16, 0, "#c0392b"), F("drum", 230, 18, 16, 16, 0, "#2b6dff"), F("crate", 40, 156, 22, 22, 0, "#7a6040"), F("art", 259, 90, 30, 3, 1, "#ff5ad1", "pin"),
    ],
    spots: [exit(130, 164), { x: 130, y: 132, k: "talk", label: "Lou" }],
    npcs: [npc(130, 114, S, P("#2b4a6e", "#2b4a6e", "#8a8a8a", "#d8a07c"))],
  },
  // ---------------------------------------------------------------- 9 Café Marisol (contact)
  marisol: {
    id: "marisol", name: "Café Marisol", w: 220, h: 150, door: 110,
    floor: "parquet", floorCol: "#9a6a42", wallStyle: "paint", wallCol: "#e9d8c0", trim: "#5a3a22", light: "#ffd9a0",
    win: [[16, 70], [150, 204]], walls: [], lamps: [[60, 70], [160, 70]],
    furn: [
      F("bar", 110, 24, 100, 18, 0, "#5a3a22"), F("espresso", 90, 24, 14, 10, 0, "#c9ced8"), F("bottles", 110, 2, 80, 6, 0, "#5a3a22"),
      ...dining(48, 80, 24, 24, "#e8e2da", "#5a3a22", true), ...dining(172, 80, 24, 24, "#e8e2da", "#5a3a22", true),
      F("shelf", 6, 128, 34, 12, 3, "#5a3a22"), F("armchair", 186, 128, 26, 26, 1, "#a04a3a"), F("plant", 214, 104, 14, 14), F("art", 219, 50, 30, 3, 1, "#3a7a8a", "sea"),
    ],
    spots: [exit(110, 134), { x: 110, y: 46, k: "talk", label: "Marisol" }],
    npcs: [npc(110, 8, S, P("#a04a3a", "#2b2f3a", "#1b1410", "#b07a58"))],
  },
  // ---------------------------------------------------------------- 10 Kai 9 harbour office (contact)
  dock: {
    id: "dock", name: "Kai 9", w: 220, h: 160, door: 110,
    floor: "planks", floorCol: "#8a7458", wallStyle: "wood", wallCol: "#6f7f86", trim: "#3a3022", light: "#ffe8c0",
    win: [[80, 140]], walls: [], lamps: [[60, 70], [160, 70], [110, 120]],
    furn: [
      F("desk", 110, 40, 60, 24, 0, "#6a5236"), F("pc", 120, 40, 24, 10, 0, "#22252c"), F("map", 30, 1, 46, 3, 0, "#c9b07a", "harbour"),
      F("crate", 14, 70, 24, 24, 0, "#7a6040"), F("crate", 14, 96, 24, 24, 0, "#6a5236"), F("crate", 38, 96, 22, 22, 0, "#7a6040"),
      F("drum", 206, 120, 16, 16, 0, "#2b6dff"), F("drum", 206, 140, 16, 16, 0, "#2b6dff"), F("files", 206, 30, 20, 16, 1, "#5a6a7a"),
      F("bench", 160, 146, 50, 14, 2, "#6a5236"), F("lamp", 70, 20, 12, 12, 0, "#ffd9a0"),
    ],
    spots: [exit(110, 144), { x: 110, y: 68, k: "talk", label: "Hafenmeister" }],
    npcs: [npc(110, 22, S, P("#2b4a6e", "#3a3022", "#c8c8c8", "#c98b66"))],
  },
  // ---------------------------------------------------------------- 11 harbour authority (contact)
  ines: {
    id: "ines", name: "Hafenamt", w: 230, h: 150, door: 115,
    floor: "carpet", floorCol: "#3a5a7a", wallStyle: "paint", wallCol: "#dfe6ea", trim: "#2a3a4a", light: "#f4f8ff",
    win: [[16, 90], [140, 214]], walls: [], lamps: [[60, 60], [170, 60], [115, 110]],
    furn: [
      F("desk", 115, 36, 64, 24, 0, "#e8e4dc"), F("pc", 105, 36, 24, 10, 0, "#22252c"), F("files", 14, 30, 20, 16, 3, "#8a9098"), F("files", 14, 52, 20, 16, 3, "#8a9098"),
      F("desk", 196, 70, 40, 22, 1, "#e8e4dc"), F("pc", 196, 70, 22, 10, 1, "#22252c"), F("cooler", 216, 136, 14, 14, 0, "#c9e6ff"),
      F("bench", 30, 132, 50, 14, 0, "#2a3a4a"), F("plant", 60, 14, 14, 14), F("plant", 170, 14, 14, 14), F("map", 229, 30, 40, 3, 1, "#c9b07a", "bay"),
    ],
    spots: [exit(115, 134), { x: 115, y: 62, k: "talk", label: "Ines" }],
    npcs: [npc(115, 18, S, P("#2a3a4a", "#2a3a4a", "#5a3a22", "#e0b090"))],
  },
  // ---------------------------------------------------------------- 12 inspector Ruiz' office (contact)
  ruiz: {
    id: "ruiz", name: "Büro Kommissarin Ruiz", w: 220, h: 150, door: 110,
    floor: "carpet", floorCol: "#3d4a3d", wallStyle: "wood", wallCol: "#7a5a3a", trim: "#3a2a1a", light: "#ffe0b0",
    win: [[70, 150]], walls: [], lamps: [[60, 60], [160, 60], [110, 110]],
    furn: [
      F("desk", 110, 38, 70, 26, 0, "#4a3020"), F("pc", 96, 38, 24, 10, 0, "#22252c"), F("armchair", 86, 76, 24, 24, 2, "#6a3a2a"), F("armchair", 134, 76, 24, 24, 2, "#6a3a2a"),
      F("shelf", 14, 40, 40, 14, 3, "#4a3020"), F("shelf", 206, 40, 40, 14, 1, "#4a3020"), F("board", 1, 100, 50, 3, 3, "#f4f4f4", "VALE"),
      F("plant", 14, 136, 14, 14), F("plant", 206, 136, 14, 14), F("rug", 110, 90, 90, 60, 0, "#5a2a2a", "#d9b23a"),
    ],
    spots: [exit(110, 134), { x: 110, y: 100, k: "talk", label: "Kommissarin Ruiz" }],
    npcs: [npc(110, 18, S, P("#1f3a6e", "#16213a", "#1b1410", "#b07a58"))],
  },
  // ---------------------------------------------------------------- 13 residential tower: hallway with six apartments
  tower: {
    id: "tower", name: "Wohnturm Bayview", w: 360, h: 190, door: 180,
    floor: "marble", floorCol: "#e8e2d8", wallStyle: "paint", wallCol: "#e8e1d4", trim: "#8a6a4a", light: "#fff2dc",
    win: [], walls: [], lamps: [[70, 60], [180, 60], [290, 60], [180, 140]],
    furn: [
      F("elevator", 180, 2, 50, 6, 0, "#c9ced8"), F("reception", 80, 150, 60, 20, 0, "#8a6a4a"), F("mail", 2, 150, 40, 6, 3, "#b08a4a"),
      F("rug", 180, 100, 120, 60, 0, "#7a3a3a", "#d9b23a"), F("sofa", 180, 128, 60, 24, 2, "#3a4a5a"), F("coffee", 180, 100, 34, 16, 0, "#4a3020"),
      F("plant", 130, 20, 16, 16), F("plant", 230, 20, 16, 16), F("palm", 300, 160, 18, 18), F("lamp", 240, 130, 12, 12, 0, "#ffd9a0"),
      F("door", 50, 1, 30, 4, 0, "#6a4a32", "1"), F("door", 110, 1, 30, 4, 0, "#6a4a32", "2"), F("door", 250, 1, 30, 4, 0, "#6a4a32", "3"),
      F("door", 310, 1, 30, 4, 0, "#6a4a32", "4"), F("door", 1, 80, 30, 4, 3, "#6a4a32", "5"), F("door", 359, 80, 30, 4, 1, "#6a4a32", "6"),
      F("art", 359, 150, 34, 3, 1, "#3a7a8a", "sea"),
    ],
    spots: [
      exit(180, 174),
      { x: 50, y: 18, k: "door", label: "Wohnung 1 · Studio Neon", to: "aptA" }, { x: 110, y: 18, k: "door", label: "Wohnung 2 · Familienwohnung", to: "aptB" },
      { x: 250, y: 18, k: "door", label: "Wohnung 3 · Industrie-Loft", to: "aptC" }, { x: 310, y: 18, k: "door", label: "Wohnung 4 · Penthouse Skyline", to: "aptD" },
      { x: 18, y: 80, k: "door", label: "Wohnung 5 · Retro 80er", to: "aptE" }, { x: 342, y: 80, k: "door", label: "Wohnung 6 · Zen-Apartment", to: "aptF" },
    ],
    npcs: [npc(80, 134, S, P("#2a2d33", "#2a2d33", "#c8c8c8", "#d8a07c"))],
  },
  // ---------------------------------------------------------------- 14 apartment 1: neon studio
  aptA: {
    id: "aptA", name: "Studio Neon", w: 200, h: 150, door: 100, parent: "tower", price: 8000,
    floor: "darkwood", floorCol: "#3a2a22", wallStyle: "paint", wallCol: "#2a2438", trim: "#ff3cac", light: "#d8b0ff",
    win: [[60, 140]], walls: [], lamps: [[50, 60], [150, 60], [100, 110]],
    furn: [
      F("bed", 30, 36, 40, 56, 0, "#9d4dff"), F("side", 58, 12, 12, 12, 0, "#15161b"), F("neon", 1, 40, 50, 4, 3, "#ff3cac", "~"),
      F("desk", 170, 24, 50, 22, 0, "#15161b"), F("pc", 170, 24, 36, 12, 0, "#22252c"), F("chair", 170, 44, 14, 14, 2, "#ff3cac"),
      F("sofa", 110, 70, 60, 24, 0, "#3a3050"), F("tv", 110, 112, 54, 14, 2, "#15161b"), F("rug", 110, 90, 70, 40, 0, "#2bf0ff", "#9d4dff"),
      F("counter", 12, 110, 40, 22, 3, "#15161b"), F("fridge", 12, 140, 18, 20, 3, "#d8dde4"), F("arcade", 186, 132, 18, 16, 1, "#2bf0ff"), F("tank", 190, 90, 34, 18, 1, "#2bf0ff"),
    ],
    spots: [exit(100, 134), { x: 62, y: 128, k: "buy", label: "Wohnung kaufen" }, { x: 30, y: 76, k: "bed", label: "Schlafen & speichern" }, { x: 110, y: 96, k: "tv", label: "Fernsehen" }, { x: 168, y: 132, k: "game", label: "Automat spielen ($5)" }, { x: 34, y: 140, k: "fridge", label: "Kühlschrank" }],
    npcs: [],
  },
  // ---------------------------------------------------------------- 15 apartment 2: family flat (living room, bedrooms, bathroom)
  aptB: {
    id: "aptB", name: "Familienwohnung", w: 280, h: 200, door: 70, parent: "tower", price: 15000,
    floor: "parquet", floorCol: "#b08050", wallStyle: "paint", wallCol: "#e8dcc8", trim: "#6a4a32", light: "#ffe2b8",
    win: [[30, 110], [190, 260]], walls: [{ x0: 150, y0: 0, x1: 150, y1: 80 }, { x0: 150, y0: 120, x1: 150, y1: 200 }, { x0: 150, y0: 120, x1: 205, y1: 120 }, { x0: 245, y0: 120, x1: 280, y1: 120 }],
    lamps: [[70, 60], [70, 150], [215, 60], [215, 160]],
    furn: [
      F("sofaL", 54, 30, 80, 40, 0, "#6a8a6a"), F("coffee", 60, 66, 40, 20, 0, "#6a4a32"), F("tv", 60, 108, 60, 14, 2, "#22252c"), F("rug", 60, 70, 100, 60, 0, "#c9a070", "#6a4a32"),
      F("counter", 136, 160, 40, 22, 1, "#ffffff"), F("stove", 136, 129, 22, 22, 1, "#ffffff"), F("fridge", 136, 191, 18, 22, 1, "#d8dde4"),
      ...dining(70, 160, 46, 26, "#8a6a4a", "#6a4a32"), F("plant", 12, 112, 14, 14),
      F("bed", 205, 34, 44, 56, 0, "#4a7aa8"), F("side", 234, 12, 14, 12, 0, "#6a4a32"), F("wardrobe", 272, 40, 34, 16, 1, "#8a6a4a"),
      F("bunk", 266, 152, 48, 26, 1, "#ff9f43"), F("shelf", 165, 170, 26, 12, 3, "#ff9f43"), F("rug", 210, 162, 50, 40, 0, "#ffd23f", "#ff9f43"),
      F("bath", 258, 104, 40, 22, 2, "#ffffff"), F("toilet", 230, 106, 14, 18, 2, "#ffffff"), F("curtain", 210, 108, 8, 18, 0, "#c9e6ff"),
    ],
    spots: [exit(70, 184), { x: 70, y: 124, k: "buy", label: "Wohnung kaufen" }, { x: 205, y: 76, k: "bed", label: "Schlafen & speichern" }, { x: 60, y: 92, k: "tv", label: "Fernsehen" }, { x: 112, y: 191, k: "fridge", label: "Kühlschrank" }, { x: 258, y: 84, k: "shower", label: "Baden" }],
    npcs: [],
  },
  // ---------------------------------------------------------------- 16 apartment 3: industrial loft
  aptC: {
    id: "aptC", name: "Industrie-Loft", w: 300, h: 200, door: 150, parent: "tower", price: 22000,
    floor: "concrete", floorCol: "#8a8680", wallStyle: "brick", wallCol: "#8a4a3a", trim: "#22252c", light: "#ffd9a0",
    win: [[20, 120], [180, 280]], walls: [], lamps: [[70, 60], [230, 60], [70, 150], [230, 150]],
    furn: [
      F("bed", 40, 40, 48, 60, 0, "#d8d2c8"), F("side", 74, 14, 14, 12, 0, "#22252c"), F("lamp", 10, 10, 12, 12, 0, "#ffd9a0"),
      F("pool", 150, 70, 70, 40, 0, "#2d8a5a"), F("lamp", 150, 40, 10, 10, 0, "#ffd9a0"),
      F("sofaL", 244, 34, 80, 40, 0, "#5a4a3a"), F("coffee", 240, 70, 40, 20, 0, "#22252c"), F("tvwall", 298, 100, 60, 4, 1, "#15161b"), F("rug", 244, 70, 100, 70, 0, "#3a3d45", "#8a8680"),
      F("island", 120, 150, 60, 24, 0, "#22252c"), F("stool", 104, 168, 10, 10, 0, "#c9ced8"), F("stool", 136, 168, 10, 10, 0, "#c9ced8"),
      F("counter", 12, 150, 60, 22, 3, "#22252c"), F("fridge", 12, 190, 18, 22, 3, "#c9ced8"), F("bar", 250, 170, 70, 18, 0, "#22252c"), F("bottles", 297, 170, 40, 6, 1, "#22252c"),
      F("carprop", 210, 128, 14, 34, 1, "#ff8a1f"), F("palm", 286, 186, 16, 16), F("art", 150, 1, 50, 3, 0, "#ff3cac", "pop"),
    ],
    spots: [exit(150, 184), { x: 150, y: 124, k: "buy", label: "Wohnung kaufen" }, { x: 40, y: 82, k: "bed", label: "Schlafen & speichern" }, { x: 270, y: 100, k: "tv", label: "Fernsehen" }, { x: 34, y: 190, k: "fridge", label: "Kühlschrank" }, { x: 150, y: 100, k: "game", label: "Billard spielen" }],
    npcs: [],
  },
  // ---------------------------------------------------------------- 17 apartment 4: penthouse
  aptD: {
    id: "aptD", name: "Penthouse Skyline", w: 340, h: 220, door: 170, parent: "tower", price: 60000,
    floor: "marble", floorCol: "#f0ece4", wallStyle: "paint", wallCol: "#f6f4f0", trim: "#c9a227", light: "#fff4e0",
    win: [[16, 324]], winW: [[16, 120]], winE: [[16, 120]], walls: [{ x0: 240, y0: 120, x1: 240, y1: 220 }, { x0: 240, y0: 120, x1: 260, y1: 120 }, { x0: 300, y0: 120, x1: 340, y1: 120 }],
    lamps: [[80, 60], [190, 60], [290, 60], [80, 160], [290, 170]],
    furn: [
      F("sofaL", 120, 40, 100, 44, 0, "#f4f4f4"), F("coffee", 120, 82, 50, 22, 0, "#22252c"), F("tvwall", 120, 1, 70, 4, 0, "#15161b"), F("rug", 120, 74, 140, 80, 0, "#c9a227", "#f4f4f4"),
      F("piano", 40, 150, 50, 40, 0, "#0e0e11"), F("hottub", 300, 50, 60, 60, 0, "#2bf0ff"), F("palm", 252, 20, 18, 18), F("palm", 326, 104, 16, 16),
      F("bar", 170, 160, 70, 18, 0, "#22252c"), F("bottles", 170, 194, 60, 6, 2, "#22252c"), F("stool", 150, 144, 10, 10, 0, "#c9a227"), F("stool", 190, 144, 10, 10, 0, "#c9a227"),
      F("bed", 312, 175, 50, 56, 1, "#c9a227"), F("side", 334, 210, 14, 12, 1, "#22252c"), F("wardrobe", 262, 210, 30, 16, 2, "#f4f4f4"),
      F("art", 1, 60, 50, 3, 3, "#2bf0ff", "abstract"), F("plant", 14, 206, 14, 14), F("lamp", 200, 30, 12, 12, 0, "#fff4e0"),
    ],
    spots: [exit(170, 204), { x: 205, y: 118, k: "buy", label: "Penthouse kaufen" }, { x: 270, y: 175, k: "bed", label: "Schlafen & speichern" }, { x: 120, y: 104, k: "tv", label: "Fernsehen" }, { x: 40, y: 182, k: "music", label: "Klavier spielen" }, { x: 262, y: 66, k: "shower", label: "Whirlpool" }],
    npcs: [],
  },
  // ---------------------------------------------------------------- 18 apartment 5: 80s retro
  aptE: {
    id: "aptE", name: "Retro 80er", w: 220, h: 160, door: 110, parent: "tower", price: 12000,
    floor: "checker", floorCol: "#2bb3a8", wallStyle: "stripe", wallCol: "#ffb3d1", trim: "#2bf0ff", light: "#ffe0f0",
    win: [[60, 160]], walls: [], lamps: [[60, 60], [160, 60], [110, 120]],
    furn: [
      F("waterbed", 40, 44, 52, 56, 0, "#ff3cac"), F("neon", 1, 100, 50, 4, 3, "#ff3cac", "RAD"), F("arcade", 200, 20, 18, 16, 1, "#ff3cac"), F("arcade", 200, 42, 18, 16, 1, "#2bf0ff"),
      F("sofa", 130, 70, 60, 24, 0, "#ff8ad1"), F("tv", 130, 114, 44, 16, 2, "#c9a070"), F("rug", 130, 92, 70, 40, 0, "#2bf0ff", "#ffd23f"),
      F("jukebox", 206, 140, 18, 14, 1, "#ffd23f"), F("counter", 12, 132, 40, 22, 3, "#f4f4f4"), F("fridge", 46, 150, 18, 18, 0, "#ffb3d1"), F("palm", 96, 14, 16, 16),
    ],
    spots: [exit(110, 144), { x: 160, y: 140, k: "buy", label: "Wohnung kaufen" }, { x: 40, y: 84, k: "bed", label: "Schlafen & speichern" }, { x: 130, y: 96, k: "tv", label: "Fernsehen" }, { x: 180, y: 30, k: "game", label: "Automat spielen ($5)" }, { x: 190, y: 140, k: "music", label: "Jukebox" }, { x: 66, y: 150, k: "fridge", label: "Kühlschrank" }],
    npcs: [],
  },
  // ---------------------------------------------------------------- 19 apartment 6: zen
  aptF: {
    id: "aptF", name: "Zen-Apartment", w: 240, h: 170, door: 120, parent: "tower", price: 18000,
    floor: "tatami", floorCol: "#c9b98a", wallStyle: "wood", wallCol: "#e8dcc0", trim: "#5a3a22", light: "#fff0d0",
    win: [[20, 100], [140, 220]], walls: [], lamps: [[70, 60], [170, 60], [120, 120]],
    furn: [
      F("futon", 44, 40, 44, 56, 0, "#f4f4f4"), F("lamp", 80, 14, 12, 12, 0, "#fff0d0"),
      F("lowtable", 140, 70, 50, 30, 0, "#5a3a22"), F("cushion", 140, 48, 16, 14, 0, "#a04a3a"), F("cushion", 140, 92, 16, 14, 0, "#a04a3a"), F("cushion", 110, 70, 14, 16, 0, "#a04a3a"), F("cushion", 170, 70, 14, 16, 0, "#a04a3a"),
      F("bonsai", 226, 20, 18, 18), F("shelf", 228, 80, 50, 14, 1, "#5a3a22"), F("tank", 230, 130, 30, 18, 1, "#2bb3a8"),
      F("counter", 12, 120, 50, 22, 3, "#5a3a22"), F("fridge", 12, 157, 18, 22, 3, "#e8e4dc"), F("art", 140, 1, 40, 3, 0, "#a04a3a", "wave"), F("bonsai", 90, 150, 16, 16),
    ],
    spots: [exit(120, 154), { x: 160, y: 140, k: "buy", label: "Wohnung kaufen" }, { x: 44, y: 80, k: "bed", label: "Schlafen & speichern" }, { x: 36, y: 156, k: "fridge", label: "Kühlschrank" }],
    npcs: [],
  },
  // ---------------------------------------------------------------- 20 beach villa
  villa: {
    id: "villa", name: "Strandvilla", w: 380, h: 240, door: 190, price: 250000,
    floor: "wood", floorCol: "#c9a070", wallStyle: "paint", wallCol: "#fbf8f2", trim: "#3a7a8a", light: "#fff4e0",
    win: [[16, 364]], winW: [[20, 220]],
    walls: [{ x0: 110, y0: 110, x1: 110, y1: 240 }, { x0: 0, y0: 110, x1: 30, y1: 110 }, { x0: 70, y0: 110, x1: 110, y1: 110 }, { x0: 270, y0: 100, x1: 270, y1: 240 }, { x0: 270, y0: 100, x1: 300, y1: 100 }, { x0: 340, y0: 100, x1: 380, y1: 100 }],
    lamps: [[60, 50], [190, 50], [320, 50], [60, 170], [190, 170], [320, 170]],
    furn: [
      F("swim", 190, 44, 140, 60, 0, "#2bb3ff"), F("palm", 104, 18, 18, 18), F("palm", 276, 18, 18, 18),
      F("sofaL", 196, 168, 80, 40, 1, "#e8e2da"), F("coffee", 150, 168, 22, 44, 0, "#8a6a4a"), F("fireplace", 119, 170, 50, 12, 3, "#c9c2b6"), F("rug", 170, 168, 100, 90, 0, "#3a7a8a", "#f4f4f4"),
      F("island", 50, 150, 60, 24, 0, "#ffffff"), F("counter", 12, 196, 60, 22, 3, "#ffffff"), F("stove", 50, 228, 26, 22, 2, "#ffffff"), F("fridge", 86, 228, 22, 20, 2, "#d8dde4"),
      ...dining(60, 60, 60, 28, "#8a6a4a", "#3a7a8a"),
      F("bed", 335, 180, 56, 60, 1, "#3a7a8a"), F("side", 362, 143, 14, 12, 1, "#8a6a4a"), F("wardrobe", 294, 226, 36, 16, 2, "#8a6a4a"),
      F("bath", 320, 20, 50, 24, 0, "#ffffff"), F("shower", 362, 70, 30, 30, 0, "#c9e6ff"), F("basin", 300, 86, 24, 14, 2, "#ffffff"),
      F("piano", 240, 200, 44, 36, 0, "#0e0e11"), F("plant", 124, 226, 14, 14), F("art", 270, 160, 40, 3, 1, "#ff9f43", "sun"), F("treadmill", 358, 226, 18, 30, 1, "#22252c"),
    ],
    spots: [exit(190, 224), { x: 150, y: 226, k: "buy", label: "Villa kaufen" }, { x: 292, y: 180, k: "bed", label: "Schlafen & speichern" }, { x: 86, y: 206, k: "fridge", label: "Kühlschrank" }, { x: 190, y: 82, k: "shower", label: "Schwimmen" }, { x: 240, y: 226, k: "music", label: "Klavier spielen" }, { x: 336, y: 70, k: "shower", label: "Duschen" }],
    npcs: [],
  },
};

// which room is behind which door in the city
export const PLACE_ROOM: Record<string, string> = {
  safehouse: "safehouse", gunshop: "gunshop", clothes: "clothes", food: "food", food2: "food2", hospital: "hospital", police: "police",
  lou: "lou", marisol: "marisol", dock: "dock", ines: "ines", ruiz: "ruiz", tower: "tower", villa: "villa",
};
export const ROOM_COUNT = Object.keys(ROOMS).length;

// ---------------------------------------------------------------- collision
export interface Rect { x0: number; y0: number; x1: number; y1: number; }
// footprint of a piece of furniture after turning it
export function furnRect(f: Furn): Rect {
  const odd = f.r % 2 === 1, w = odd ? f.d : f.w, d = odd ? f.w : f.d;
  return { x0: f.x - w / 2, y0: f.y - d / 2, x1: f.x + w / 2, y1: f.y + d / 2 };
}
export function wallRect(wl: Wall): Rect {
  const t = ROOM_WALL_T / 2;
  return { x0: Math.min(wl.x0, wl.x1) - t, y0: Math.min(wl.y0, wl.y1) - t, x1: Math.max(wl.x0, wl.x1) + t, y1: Math.max(wl.y0, wl.y1) + t };
}
const solidCache = new Map<string, Rect[]>();
export function roomSolids(room: RoomDef): Rect[] {
  let s = solidCache.get(room.id);
  if (!s) {
    s = [...room.walls.map(wallRect), ...room.furn.filter((f) => f.solid).map(furnRect)];
    // NPCs stand in the way too
    for (const n of room.npcs) s.push({ x0: n.x - 6, y0: n.y - 6, x1: n.x + 6, y1: n.y + 6 });
    solidCache.set(room.id, s);
  }
  return s;
}
// a circle of radius r at (x, y) (room coordinates) touches a wall or something solid; the door gap leads outside (y > h)
export function roomBlocked(room: RoomDef, x: number, y: number, r = ROOM_PED_R): boolean {
  if (x < r || x > room.w - r || y < r) return true;
  if (y > room.h - r) {
    if (Math.abs(x - room.door) > ROOM_DOOR - r) return true; // the south wall
    if (y > room.h + 30) return true;
  }
  for (const b of roomSolids(room)) if (x > b.x0 - r && x < b.x1 + r && y > b.y0 - r && y < b.y1 + r) return true;
  return false;
}
// the closest spot of the room you can use from (x, y)
export function spotAt(room: RoomDef, x: number, y: number): Spot | null {
  let best: Spot | null = null, bd = SPOT_RADIUS;
  for (const s of room.spots) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } }
  return best;
}
// where you stand after coming in (through the south door, or from an apartment door of the tower)
export function roomEntry(room: RoomDef): { x: number; y: number; a: number } {
  return { x: room.door, y: room.h - 16, a: -Math.PI / 2 };
}
