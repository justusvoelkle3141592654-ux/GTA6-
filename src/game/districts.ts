import { BLOCK, ROAD, GRID, WORLD, inCity, cityDist } from "./world";

export type DistrictId = "downtown" | "harbor" | "beach" | "industry" | "residential" | "hills";

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
  downtown: { id: "downtown", name: "Zentrum", color: "#2bf0ff", wall: "#9fb4c8", wallMix: 0.25, ground: "#5d5b57", gang: null, label: [5, 5] },
  harbor: { id: "harbor", name: "Hafen Ostkai", color: "#ff9f43", wall: "#7d8a96", wallMix: 0.45, ground: "#56595e", gang: "halcones", label: [9.2, 8.6] },
  beach: { id: "beach", name: "Playa Dorada", color: "#ffd23f", wall: "#f2c7d8", wallMix: 0.5, ground: "#c9b48c", gang: null, label: [0.6, 3] },
  industry: { id: "industry", name: "Eisenwerk", color: "#ff5a4d", wall: "#8a5a48", wallMix: 0.5, ground: "#4e4a46", gang: "kings", label: [8.6, 1.2] },
  residential: { id: "residential", name: "Palmenhain", color: "#3dff8b", wall: "#e8d6b8", wallMix: 0.35, ground: "#6a6658", gang: null, label: [4.5, 9.4] },
  hills: { id: "hills", name: "Hinterland", color: "#c8e6a0", wall: "#ffffff", wallMix: 0, ground: "#6a6658", gang: null, label: null },
};

// district of a city block (deterministic, only depends on the grid position)
export function blockDistrict(bx: number, by: number): DistrictId {
  if (Math.abs(bx - 5) <= 2 && Math.abs(by - 5) <= 2) return "downtown";
  if (bx <= 1) return "beach";
  if (bx >= 8 && by >= 6) return "harbor";
  if (bx >= 7 && by <= 3) return "industry";
  return "residential";
}

export function districtAt(x: number, y: number): DistrictId {
  if (inCity(x, y)) {
    const bx = Math.max(0, Math.min(GRID - 1, Math.floor((x - ROAD / 2) / BLOCK)));
    const by = Math.max(0, Math.min(GRID - 1, Math.floor((y - ROAD / 2) / BLOCK)));
    return blockDistrict(bx, by);
  }
  const d = cityDist(x, y);
  if (d < 450 && x < 0) return "beach";
  if (d < 450 && x > WORLD) return "harbor";
  return "hills";
}

// label positions for the big map
export function districtLabels(): { id: DistrictId; x: number; y: number }[] {
  const out: { id: DistrictId; x: number; y: number }[] = [];
  for (const d of Object.values(DISTRICTS)) if (d.label) out.push({ id: d.id, x: d.label[0] * BLOCK + ROAD + (BLOCK - ROAD) / 2, y: d.label[1] * BLOCK + ROAD + (BLOCK - ROAD) / 2 });
  return out;
}
