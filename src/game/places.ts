import { BLOCK, ROAD, GRID, type Building, type World } from "./world";
import type { EndReason } from "./engine";

export type PlaceKind = "hospital" | "police" | "gunshop" | "workshop" | "clothes" | "food" | "safehouse" | "contact";
export type PlaceAccess = "foot" | "car" | "both" | "none";

export interface PlaceDef {
  id: string; kind: PlaceKind; name: string; color: string;
  icon: string;          // short symbol for signs and maps (ASCII so every font has it)
  near: [number, number]; // preferred block (bx, by); the closest free city block is used
  access: PlaceAccess;   // how it is entered
  robbable?: boolean;
}

export const PLACE_DEFS: PlaceDef[] = [
  { id: "hospital", kind: "hospital", name: "St. Aurelia Klinik", color: "#ff3b4e", icon: "+", near: [3, 7], access: "none" },
  { id: "police", kind: "police", name: "Polizeiwache Mitte", color: "#3d8bff", icon: "*", near: [7, 3], access: "none" },
  { id: "safehouse", kind: "safehouse", name: "Safehouse & Garage", color: "#3dff8b", icon: "H", near: [5, 6], access: "both" },
  { id: "gunshop", kind: "gunshop", name: "Kaliber Waffen", color: "#ff9f43", icon: "W", near: [6, 4], access: "foot" },
  { id: "workshop", kind: "workshop", name: "Lack & Turbo", color: "#9d4dff", icon: "T", near: [4, 4], access: "car" },
  { id: "clothes", kind: "clothes", name: "Bay Boutique", color: "#ff3cac", icon: "K", near: [2, 5], access: "foot", robbable: true },
  { id: "food", kind: "food", name: "Taco Loco", color: "#ffd23f", icon: "I", near: [5, 8], access: "foot", robbable: true },
  { id: "food2", kind: "food", name: "Burger Bucht", color: "#ffd23f", icon: "I", near: [8, 7], access: "foot", robbable: true },
  // mission contacts (story)
  { id: "lou", kind: "contact", name: "Lous Werkstatt", color: "#ff5ad1", icon: "L", near: [3, 3], access: "foot" },
  { id: "marisol", kind: "contact", name: "Café Marisol", color: "#ff5ad1", icon: "M", near: [1, 7], access: "foot" },
  { id: "dock", kind: "contact", name: "Kai 9", color: "#ff5ad1", icon: "D", near: [9, 8], access: "foot" },
];

export interface Place extends PlaceDef {
  x: number; y: number; a: number; // entrance on the sidewalk, direction facing the street
  cx: number; cy: number;          // spot for cars (on the street in front of it)
  bld: Building;
}

export const PLACE_RADIUS = { foot: 22, car: 46 };

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
