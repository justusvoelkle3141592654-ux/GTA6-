import { BLOCK, ROAD, GRID, HELIPAD, type Building, type World } from "./world";
import type { EndReason } from "./engine";
import type { JobKind } from "./jobs";
import { STUNT_PARK } from "./terrain";

export type PlaceKind = "hospital" | "police" | "gunshop" | "workshop" | "clothes" | "food" | "safehouse" | "contact" | "dock" | "heliport" | "park" | "job" | "market" | "cardealer" | "barber" | "mall";
export type PlaceAccess = "foot" | "car" | "both" | "none";

export interface PlaceDef {
  id: string; kind: PlaceKind; name: string; color: string;
  icon: string;          // short symbol for signs and maps (ASCII so every font has it)
  near: [number, number]; // preferred block (bx, by); the closest free city block is used
  access: PlaceAccess;   // how it is entered
  robbable?: boolean;
  at?: [number, number, number]; // fixed spot outside the city blocks (x, y, facing); vehicles wait next to it
  inPark?: boolean;              // entrance at the west edge of the nearest park (cx, cy: middle of the park)
  job?: JobKind;                 // job start point: the vehicle waits at the car spot, drive into the ring to start
}
// boat jetty on the beach and the helipad north of the industrial district
export const DOCK_SPOT = { x: -340, y: 3455, a: Math.PI };
export const HELI_SPOT = { x: HELIPAD.x, y: HELIPAD.y, a: Math.PI };
// the wooden jetty you can walk on (from the beach out to the boat)
export const JETTY = { x0: DOCK_SPOT.x - 40, x1: -186, y: DOCK_SPOT.y - 26, hw: 15 };
export const onJetty = (x: number, y: number) => x > JETTY.x0 && x < JETTY.x1 && Math.abs(y - JETTY.y) < JETTY.hw;

export const PLACE_DEFS: PlaceDef[] = [
  { id: "hospital", kind: "hospital", name: "St. Aurelia Klinik", color: "#ff3b4e", icon: "+", near: [4, 10], access: "none" },
  { id: "police", kind: "police", name: "Polizeiwache Mitte", color: "#3d8bff", icon: "*", near: [10, 4], access: "none" },
  { id: "safehouse", kind: "safehouse", name: "Safehouse & Garage", color: "#3dff8b", icon: "H", near: [7, 9], access: "both" },
  { id: "gunshop", kind: "gunshop", name: "Kaliber Waffen", color: "#ff9f43", icon: "W", near: [9, 6], access: "foot" },
  { id: "workshop", kind: "workshop", name: "Lack & Turbo", color: "#9d4dff", icon: "T", near: [6, 6], access: "car" },
  { id: "clothes", kind: "clothes", name: "Bay Boutique", color: "#ff3cac", icon: "K", near: [3, 7], access: "foot", robbable: true },
  { id: "food", kind: "food", name: "Taco Loco", color: "#ffd23f", icon: "I", near: [7, 12], access: "foot", robbable: true },
  { id: "food2", kind: "food", name: "Burger Bucht", color: "#ffd23f", icon: "I", near: [12, 10], access: "foot", robbable: true },
  // new walkable shops (see interiors.ts); the mall fills its own block
  { id: "market", kind: "market", name: "Supermarkt Frischbucht", color: "#3dd68c", icon: "$", near: [5, 8], access: "foot", robbable: true },
  { id: "cardealer", kind: "cardealer", name: "Autohaus Solara Motors", color: "#2bb3ff", icon: "#", near: [10, 7], access: "foot" },
  { id: "barber", kind: "barber", name: "Friseur & Tattoo Ink Bay", color: "#c86bff", icon: "&", near: [2, 9], access: "foot" },
  { id: "mall", kind: "mall", name: "Einkaufszentrum Bay Plaza", color: "#ff8a1f", icon: "@", near: [9, 9], access: "foot", at: [9 * BLOCK + ROAD + 10, 9 * BLOCK + ROAD + (BLOCK - ROAD) / 2, Math.PI] },
  // mission contacts (story)
  { id: "lou", kind: "contact", name: "Lous Werkstatt", color: "#ff5ad1", icon: "L", near: [4, 4], access: "foot" },
  { id: "marisol", kind: "contact", name: "Café Marisol", color: "#ff5ad1", icon: "M", near: [1, 10], access: "foot" },
  { id: "dock", kind: "contact", name: "Kai 9", color: "#ff5ad1", icon: "D", near: [13, 12], access: "foot" },
  { id: "ines", kind: "contact", name: "Hafenamt", color: "#ff5ad1", icon: "A", near: [0, 7], access: "foot" },
  { id: "ruiz", kind: "contact", name: "Kommissarin Ruiz", color: "#ff5ad1", icon: "R", near: [12, 6], access: "foot" },
  // vehicles: a speedboat at the jetty, a helicopter on the pad (always there again when you come back)
  // side job start points
  { id: "taxistand", kind: "job", job: "taxi", name: "Taxistand", color: "#ffc21a", icon: "X", near: [6, 10], access: "both" },
  { id: "depot", kind: "job", job: "delivery", name: "Lieferdepot", color: "#e67e22", icon: "P", near: [13, 9], access: "both" },
  { id: "patrol", kind: "job", job: "bounty", name: "Streife (Revier)", color: "#3d8bff", icon: "S", near: [10, 3], access: "both" },
  { id: "ambulance", kind: "job", job: "ambulance", name: "Rettungswache", color: "#ff4d6d", icon: "N", near: [5, 10], access: "both" },
  { id: "firestation", kind: "job", job: "fire", name: "Feuerwache", color: "#ff5a3d", icon: "Q", near: [11, 7], access: "both" },
  { id: "trashyard", kind: "job", job: "trash", name: "Müllhof", color: "#3c9a57", icon: "U", near: [14, 6], access: "both" },
  { id: "towyard", kind: "job", job: "tow", name: "Abschlepphof", color: "#e1b12c", icon: "Y", near: [15, 10], access: "both" },
  { id: "busdepot", kind: "job", job: "bus", name: "Busdepot", color: "#2bb3ff", icon: "O", near: [8, 12], access: "both" },
  { id: "icefactory", kind: "job", job: "icecream", name: "Eisfabrik", color: "#ff9ad5", icon: "E", near: [6, 13], access: "both" },
  { id: "courier", kind: "job", job: "courier", name: "Kurierzentrale", color: "#ff8a1f", icon: "C", near: [7, 4], access: "both" },
  { id: "hunter", kind: "job", job: "hunter", name: "Kopfgeldbüro", color: "#9d4dff", icon: "Z", near: [11, 4], access: "both" },
  { id: "racescene", kind: "job", job: "race", name: "Rennszene", color: "#c86bff", icon: "1", near: [3, 2], access: "both" },
  { id: "watertaxi", kind: "job", job: "watertaxi", name: "Wassertaxi", color: "#2bf0ff", icon: "J", near: [0, 6], access: "foot", at: [-150, 3330, Math.PI] },
  { id: "tours", kind: "job", job: "heli", name: "Rundflüge", color: "#ffd23f", icon: "G", near: [15, 1], access: "foot", at: [HELIPAD.x - 100, HELIPAD.y - 150, Math.PI] },
  { id: "stuntpark", kind: "job", job: "stunt", name: "Stunt-Park", color: "#ffd23f", icon: "2", near: [14, 0], access: "both", at: [STUNT_PARK.x0 - 130, (STUNT_PARK.y0 + STUNT_PARK.y1) / 2 + 60, Math.PI] },
  // hide and seek in the park
  { id: "hide", kind: "park", name: "Versteckspiel im Park", color: "#3dff8b", icon: "V", near: [9, 10], access: "foot", inPark: true },
  { id: "jetty", kind: "dock", name: "Bootssteg", color: "#2bb3ff", icon: "B", near: [0, 9], access: "none", at: [-196, 3455, Math.PI] },
  { id: "helipad", kind: "heliport", name: "Heliport", color: "#ffd23f", icon: "F", near: [15, 4], access: "none", at: [HELIPAD.x - 120, HELIPAD.y + 60, Math.PI] },
];

export interface Place extends PlaceDef {
  x: number; y: number; a: number; // entrance on the sidewalk, direction facing the street
  cx: number; cy: number;          // spot for cars (on the street in front of it)
  bld: Building | null;            // null: a fixed spot outside the blocks (jetty, helipad)
}

export const PLACE_RADIUS = { foot: 22, car: 46 };
// shops with a room you walk into (door symbol on the maps)
export const WALKABLE = new Set(["gunshop", "clothes", "food", "food2", "workshop", "safehouse", "market", "cardealer", "barber", "mall"]);

// what you lose when you are taken to a place after a run ends (open world)
export interface RespawnRule { place: PlaceKind; cashPct: number; cashMin: number; title: string; sub: string; }
export const RESPAWN_RULES: Record<EndReason, RespawnRule> = {
  dead: { place: "hospital", cashPct: 0.1, cashMin: 100, title: "KRANKENHAUS", sub: "Behandlungskosten" },
  arrested: { place: "police", cashPct: 0.2, cashMin: 100, title: "ENTLASSEN", sub: "Kaution" },
};
export const respawnCost = (rule: RespawnRule, cash: number) => Math.min(cash, Math.max(rule.cashMin, Math.round(cash * rule.cashPct)));

// deterministic: depends only on the world layout
export function buildPlaces(world: World): Place[] {
  const used = new Set<number>();
  const out: Place[] = [];
  const ok = (bx: number) => { const w = westFacing(bx); return (b: Building) => w(b) && !world.ramps.some((r) => r.bld === b); };
  for (const def of PLACE_DEFS) {
    if (def.at) { const [x, y, a] = def.at; out.push({ ...def, x, y, a, cx: x, cy: y, bld: null }); continue; }
    if (def.inPark) {
      let pk = world.blocks[0], pd = Infinity;
      for (const b of world.blocks) { const d = Math.hypot(b.bx - def.near[0], b.by - def.near[1]); if (b.kind === "park" && d < pd) { pd = d; pk = b; } }
      const x0 = pk.bx * BLOCK + ROAD, y0 = pk.by * BLOCK + ROAD, half = (BLOCK - ROAD) / 2;
      out.push({ ...def, x: x0 + 10, y: y0 + half, a: Math.PI, cx: x0 + half, cy: y0 + half, bld: null });
      continue;
    }
    let best = -1, bd = Infinity;
    for (let i = 0; i < world.blocks.length; i++) {
      const b = world.blocks[i];
      if (b.kind !== "city" || used.has(i) || !b.buildings.some(ok(b.bx))) continue;
      const d = Math.hypot(b.bx - def.near[0], b.by - def.near[1]);
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) continue;
    used.add(best);
    const block = world.blocks[best];
    // entrance on the west sidewalk, at the biggest building touching the west edge of the block (no ramp in front)
    const bld = block.buildings.filter(ok(block.bx)).sort((p, q) => q.h - p.h)[0];
    const x0 = block.bx * BLOCK + ROAD, y = bld.y + bld.h / 2;
    out.push({ ...def, x: x0 + 10, y, a: Math.PI, cx: x0 - 44, cy: y, bld });
  }
  return out;
}

const westFacing = (bx: number) => (b: Building) => Math.abs(b.x - (bx * BLOCK + ROAD + 18)) < 2 && bx >= 0 && bx < GRID;
