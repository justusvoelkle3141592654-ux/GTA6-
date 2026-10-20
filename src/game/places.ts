import { BLOCK, ROAD, GRID, type Building, type World } from "./world";
import type { EndReason } from "./engine";

export type PlaceKind = "hospital" | "police";

export interface PlaceDef { kind: PlaceKind; name: string; color: string; icon: string; near: [number, number]; }
// near: preferred block (bx, by); the closest city block with buildings is used
export const PLACE_DEFS: PlaceDef[] = [
  { kind: "hospital", name: "St. Aurelia Klinik", color: "#ff3b4e", icon: "+", near: [3, 7] },
  { kind: "police", name: "Polizeiwache Mitte", color: "#3d8bff", icon: "★", near: [7, 3] },
];

export interface Place extends PlaceDef {
  x: number; y: number; a: number; // entrance on the sidewalk and the direction facing the street
  bld: Building;
}

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
    const x0 = block.bx * BLOCK + ROAD;
    out.push({ ...def, x: x0 + 10, y: bld.y + bld.h / 2, a: Math.PI, bld });
  }
  return out;
}

const westFacing = (bx: number) => (b: Building) => Math.abs(b.x - (bx * BLOCK + ROAD + 18)) < 2 && bx >= 0 && bx < GRID;
