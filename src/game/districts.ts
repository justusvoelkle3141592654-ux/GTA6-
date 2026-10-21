import { BLOCK, ROAD, GRID, WORLD, ISLAND, VILLA_HILL, inCity, cityDist } from "./terrain";

export type DistrictId = "downtown" | "oldtown" | "harbor" | "beach" | "industry" | "residential" | "villas" | "island" | "hills";

export interface District {
  id: DistrictId; name: string;
  color: string;   // label / HUD colour
  wall: string;    // building colour the walls are pulled towards
  wallMix: number; // 0..1, how strongly
  ground: string;  // block ground colour
  gang: "halcones" | "kings" | null; // gang territory
  label: [number, number] | null;    // map label position in block coordinates
}

export const DISTRICTS: Record<DistrictId, District> = {
  downtown: { id: "downtown", name: "Zentrum", color: "#2bf0ff", wall: "#9fb4c8", wallMix: 0.25, ground: "#5d5b57", gang: null, label: [7.5, 7] },
  oldtown: { id: "oldtown", name: "Altstadt", color: "#e8b06a", wall: "#d9b48a", wallMix: 0.45, ground: "#7a6a58", gang: null, label: [3, 6.5] },
  harbor: { id: "harbor", name: "Hafen Ostkai", color: "#ff9f43", wall: "#7d8a96", wallMix: 0.45, ground: "#56595e", gang: "halcones", label: [14, 12] },
  beach: { id: "beach", name: "Strandpromenade", color: "#ffd23f", wall: "#f2c7d8", wallMix: 0.5, ground: "#c9b48c", gang: null, label: [0.4, 4] },
  industry: { id: "industry", name: "Eisenwerk", color: "#ff5a4d", wall: "#8a5a48", wallMix: 0.5, ground: "#4e4a46", gang: "kings", label: [13, 2] },
  residential: { id: "residential", name: "Palmenhain", color: "#3dff8b", wall: "#e8d6b8", wallMix: 0.35, ground: "#6a6658", gang: null, label: [7.5, 13.5] },
  villas: { id: "villas", name: "Villenhügel", color: "#c9a2ff", wall: "#f4efe6", wallMix: 0.5, ground: "#6a7a4a", gang: null, label: null },
  island: { id: "island", name: "Isla Faro", color: "#7fe0ff", wall: "#f4f1ea", wallMix: 0.5, ground: "#c9b48c", gang: null, label: null },
  hills: { id: "hills", name: "Hinterland", color: "#c8e6a0", wall: "#ffffff", wallMix: 0, ground: "#6a6658", gang: null, label: null },
};

// district of a city block (deterministic, only depends on the grid position)
export function blockDistrict(bx: number, by: number): DistrictId {
  if (bx <= 1) return "beach";
  if (bx >= 5 && bx <= 10 && by >= 4 && by <= 10) return "downtown";
  if (bx >= 2 && bx <= 4 && by >= 3 && by <= 10) return "oldtown";
  if (bx >= 13 && by >= 8) return "harbor";
  if (bx >= 11 && by <= 5) return "industry";
  return "residential";
}

export function districtAt(x: number, y: number): DistrictId {
  if (inCity(x, y)) {
    const bx = Math.max(0, Math.min(GRID - 1, Math.floor((x - ROAD / 2) / BLOCK)));
    const by = Math.max(0, Math.min(GRID - 1, Math.floor((y - ROAD / 2) / BLOCK)));
    return blockDistrict(bx, by);
  }
  if (Math.hypot(x - ISLAND.x, y - ISLAND.y) < ISLAND.r + 500) return "island";
  if (Math.hypot(x - VILLA_HILL.x, y - VILLA_HILL.y) < VILLA_HILL.r) return "villas";
  const d = cityDist(x, y);
  if (d < 450 && x < 0) return "beach";
  if (d < 450 && x > WORLD) return y > 8 * BLOCK ? "harbor" : "industry";
  if (d < 450 && y > WORLD) return "residential";
  return "hills";
}

// label positions for the big map
export function districtLabels(): { id: DistrictId; x: number; y: number }[] {
  const out: { id: DistrictId; x: number; y: number }[] = [];
  for (const d of Object.values(DISTRICTS)) if (d.label) out.push({ id: d.id, x: d.label[0] * BLOCK + ROAD + (BLOCK - ROAD) / 2, y: d.label[1] * BLOCK + ROAD + (BLOCK - ROAD) / 2 });
  out.push({ id: "villas", x: VILLA_HILL.x, y: VILLA_HILL.y }, { id: "island", x: ISLAND.x, y: ISLAND.y });
  return out;
}

// story data was written for the old 11 x 11 city: map an old crossing index to the new grid
export const oldNode = (i: number) => Math.round((i * GRID) / 11);
