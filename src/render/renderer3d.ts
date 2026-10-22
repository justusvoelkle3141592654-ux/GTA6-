import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { wrapA, clamp, canvasTex, radialTex, withColor, C, box, flat, cyl, sph } from "./meshutil";
import { World, BLOCK, ROAD, GRID, WORLD, MAP_MIN, MAP_SIZE, H_SCALE, EDGE_LAND, STUNT_PARK, terrainH, terrainGrad, cityDist, inCity, coast, edgeDist, mulberry32, type Building, tunnelAt, TUNNEL } from "../world/world";
import { terrainMesh, backdropMesh, roadsMesh, rampsMesh, coastMesh, extrasMesh, furnitureMesh, LightsMesh } from "./worldmesh";
import { TrafficLights } from "../ai/traffic";
import { Atmosphere } from "./atmosphere";
import { currentSettings } from "../core/settings";
import { WaterSurface } from "./water";
import { buildHideFields } from "../gameplay/hide";
const inStuntPark = (x: number, y: number) => x > STUNT_PARK.x0 - 60 && x < STUNT_PARK.x1 + 60 && y > STUNT_PARK.y0 - 60 && y < STUNT_PARK.y1 + 60;
import { isCraft, isBoat, isHeli, isTwoWheel, VEH_SCALE } from "../vehicles/vehicles";
import { CarRig, carMaterials, hasRig, topAt, type CarMats } from "../vehicles/carmodel";
import { JETTY, HELI_SPOT, WALKABLE, type Place } from "../world/places";
import type { Interior } from "../world/interiors";
import { CrowdRenderer } from "./crowd3d";
import { PlayerFigure, CrowdFigures } from "./people3d";
import { InteriorsRenderer } from "./interiors3d";
import { Landmarks } from "./landmarks3d";
import { DISTRICTS, blockDistrict } from "../world/districts";
import { MAX_PEDS } from "../ai/peds";
import type { Game, Car, Pickup, CameraMode, Quality, CarModel, Proj, Bomb, PickupType } from "../core/engine";

const MAX_SKIDS = 900;
const MAX_PTS = 600;
const WIN = 16;
const FLOOR = 18;


// ---------------------------------------------------------------- car models
type PaintCol = string | THREE.Color;
const ni = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
const pc = (c: PaintCol) => (typeof c === "string" ? C(c) : c);
// all car parts are non-indexed so they can be merged freely
function nb(w: number, h: number, d: number, x: number, y: number, z: number, col: PaintCol, mul = 1) { return ni(box(w, h, d, x, y, z, col, mul)); }
function rbox(w: number, h: number, d: number, x: number, y: number, z: number, col: PaintCol, rad = 1, mul = 1) {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.max(0.05, Math.min(rad, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01)));
  g.translate(x, y, z);
  return ni(withColor(g, pc(col), mul));
}
// side-view profile (x = forward, y = up) extruded across the car width, with rounded flank edges
function prof(pts: [number, number][], width: number, bev: number, col: PaintCol, mul = 1) {
  const sh = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.closePath();
  const depth = Math.max(0.1, width - 2 * bev);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 3, curveSegments: 1, steps: 1 });
  g.translate(0, 0, -depth / 2);
  return ni(withColor(g, pc(col), mul));
}
function bar(x0: number, y0: number, x1: number, y1: number, th: number, depth: number, z: number, col: PaintCol) {
  const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
  const g = new THREE.BoxGeometry(len, th, depth);
  g.rotateZ(ang); g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
  return ni(withColor(g, pc(col)));
}
function cylX(rad: number, len: number, x: number, y: number, z: number, col: string, seg = 16) {
  const g = new THREE.CylinderGeometry(rad, rad, len, seg); g.rotateZ(Math.PI / 2); g.translate(x, y, z);
  return ni(withColor(g, C(col)));
}
function cylY(rad: number, len: number, x: number, y: number, z: number, col: string, seg = 10) {
  const g = new THREE.CylinderGeometry(rad, rad, len, seg); g.translate(x, y, z);
  return ni(withColor(g, C(col)));
}

// one wheel (tire + rim + spokes), centered on its axle; the axle runs along z
const wheelGeoCache = new Map<string, THREE.BufferGeometry>();
function getWheelGeo(r: number, wd: number) {
  const key = r + "_" + wd;
  const hit = wheelGeoCache.get(key);
  if (hit) return hit;
  const P: THREE.BufferGeometry[] = [];
  const cz = (rad: number, len: number, z: number, col: string) => {
    const c = new THREE.CylinderGeometry(rad, rad, len, 22); c.rotateX(Math.PI / 2); c.translate(0, 0, z);
    return ni(withColor(c, C(col)));
  };
  P.push(cz(r, wd, 0, "#121214"));
  P.push(cz(r * 0.66, wd + 0.5, 0, "#2c2e34"));
  P.push(cz(r * 0.6, wd + 0.7, 0, "#b9bec9"));
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const b = new THREE.BoxGeometry(r * 1.15, 0.8, 0.4); b.rotateZ((k * Math.PI) / 3); b.translate(0, 0, side * (wd / 2 + 0.4));
      P.push(ni(withColor(b, C("#6e7380"))));
    }
    P.push(cz(r * 0.16, 0.8, side * (wd / 2 + 0.5), "#3a3d45"));
  }
  const g = mergeGeometries(P)!;
  for (const p of P) p.dispose();
  wheelGeoCache.set(key, g);
  return g;
}

interface CarSpec { L: number; W: number; y0: number; noseY: number; beltY: number; deckY: number; xCowl: number; xRoofF: number; xRoofR: number; xDeck: number; roofY: number; r: number; wx: number; wxr: number; wd: number; }
const SEDAN: CarSpec = { L: 48, W: 24, y0: 3.5, noseY: 8.5, beltY: 12.5, deckY: 13, xCowl: 8, xRoofF: 1, xRoofR: -9, xDeck: -14, roofY: 20, r: 6, wx: 15, wxr: -15, wd: 4 };
const SPECS: Record<CarModel, CarSpec> = {
  sport: { L: 48, W: 24, y0: 3, noseY: 7, beltY: 11.5, deckY: 11.5, xCowl: 9, xRoofF: 1, xRoofR: -10, xDeck: -15, roofY: 17.5, r: 6, wx: 15, wxr: -15, wd: 4 },
  super: { L: 50, W: 25, y0: 2.5, noseY: 6, beltY: 10.5, deckY: 11.5, xCowl: 10, xRoofF: 1, xRoofR: -8, xDeck: -14, roofY: 16, r: 6, wx: 16, wxr: -15, wd: 5 },
  muscle: { L: 50, W: 25, y0: 3.5, noseY: 9, beltY: 13.5, deckY: 14, xCowl: 9, xRoofF: 2, xRoofR: -10, xDeck: -15, roofY: 20.5, r: 6.5, wx: 15, wxr: -15, wd: 5 },
  suv: { L: 50, W: 26, y0: 5, noseY: 13, beltY: 17.5, deckY: 18, xCowl: 12, xRoofF: 8, xRoofR: -19, xDeck: -22, roofY: 27, r: 7.5, wx: 16, wxr: -16, wd: 5 },
  van: { L: 52, W: 25, y0: 4, noseY: 11, beltY: 15, deckY: 15, xCowl: 25, xRoofF: 17, xRoofR: 15, xDeck: 15, roofY: 24.5, r: 6.5, wx: 16, wxr: -16, wd: 4 },
  police: { L: 50, W: 25, y0: 3.5, noseY: 11, beltY: 12.2, deckY: 13, xCowl: 9, xRoofF: 2, xRoofR: -9, xDeck: -14, roofY: 19.6, r: 6.2, wx: 15.5, wxr: -15.5, wd: 4.5 },
  sedan: SEDAN,
  taxi: SEDAN,
  truck: { L: 66, W: 27, y0: 5, noseY: 18, beltY: 22, deckY: 20, xCowl: 27, xRoofF: 23, xRoofR: 13, xDeck: 12, roofY: 33, r: 7.5, wx: 22, wxr: -21, wd: 5 },
  bus: { L: 82, W: 28, y0: 4, noseY: 16, beltY: 17, deckY: 17, xCowl: 39, xRoofF: 37, xRoofR: -38, xDeck: -39.5, roofY: 34, r: 7, wx: 27, wxr: -25, wd: 5 },
  swat: { L: 54, W: 26, y0: 4.5, noseY: 12, beltY: 16, deckY: 16, xCowl: 25, xRoofF: 17, xRoofR: 15, xDeck: 15, roofY: 26, r: 7, wx: 17, wxr: -17, wd: 5 },
  armor: { L: 62, W: 29, y0: 6, noseY: 15, beltY: 19, deckY: 19, xCowl: 22, xRoofF: 16, xRoofR: -24, xDeck: -27, roofY: 25, r: 8, wx: 20, wxr: -20, wd: 6 },
  boat: SEDAN, heli: SEDAN, // own geometry (boatGeo / heliGeo)
  bike: { L: 34, W: 8, y0: 6, noseY: 12, beltY: 14, deckY: 14, xCowl: 6, xRoofF: 2, xRoofR: -4, xDeck: -6, roofY: 18, r: 6, wx: 13, wxr: -13, wd: 3 },
  roadster: { L: 46, W: 23, y0: 3, noseY: 7, beltY: 11, deckY: 11.5, xCowl: 6, xRoofF: 1, xRoofR: -9, xDeck: -12, roofY: 15, r: 6, wx: 14.5, wxr: -14.5, wd: 4 },
  pickup: { L: 54, W: 26, y0: 5, noseY: 13, beltY: 17, deckY: 17, xCowl: 13, xRoofF: 8, xRoofR: -4, xDeck: -6, roofY: 27, r: 7.5, wx: 17, wxr: -17, wd: 5 },
  compact: { L: 40, W: 22, y0: 3.5, noseY: 9, beltY: 12.5, deckY: 13, xCowl: 7, xRoofF: 1, xRoofR: -12, xDeck: -15, roofY: 20, r: 5.5, wx: 12.5, wxr: -12.5, wd: 4 },
  wagon: { L: 50, W: 24, y0: 3.5, noseY: 8.5, beltY: 12.5, deckY: 13, xCowl: 8, xRoofF: 1, xRoofR: -19, xDeck: -23, roofY: 20, r: 6, wx: 15.5, wxr: -15.5, wd: 4 },
  offroad: { L: 50, W: 27, y0: 6, noseY: 14, beltY: 18, deckY: 18.5, xCowl: 12, xRoofF: 8, xRoofR: -19, xDeck: -22, roofY: 28, r: 8, wx: 16, wxr: -16, wd: 6 },
  tow: { L: 66, W: 27, y0: 5, noseY: 18, beltY: 22, deckY: 12, xCowl: 27, xRoofF: 23, xRoofR: 13, xDeck: 12, roofY: 33, r: 7.5, wx: 22, wxr: -21, wd: 5 },
  garbage: { L: 72, W: 28, y0: 5, noseY: 18, beltY: 22, deckY: 20, xCowl: 30, xRoofF: 26, xRoofR: 16, xDeck: 15, roofY: 33, r: 7.5, wx: 25, wxr: -22, wd: 5 },
  ambulance: { L: 56, W: 26, y0: 4.5, noseY: 12, beltY: 15, deckY: 15, xCowl: 26, xRoofF: 18, xRoofR: 16, xDeck: 16, roofY: 25, r: 6.5, wx: 18, wxr: -17, wd: 4.5 },
  fire: { L: 80, W: 28, y0: 5, noseY: 18, beltY: 22, deckY: 20, xCowl: 36, xRoofF: 32, xRoofR: 22, xDeck: 21, roofY: 34, r: 7.5, wx: 28, wxr: -25, wd: 5 },
  icecream: { L: 54, W: 26, y0: 4.5, noseY: 12, beltY: 15, deckY: 15, xCowl: 25, xRoofF: 17, xRoofR: 15, xDeck: 15, roofY: 25, r: 6.5, wx: 17, wxr: -17, wd: 4.5 },
  unmarked: { L: 48, W: 24, y0: 3.5, noseY: 9, beltY: 12.5, deckY: 13, xCowl: 8, xRoofF: 1, xRoofR: -9, xDeck: -14, roofY: 20, r: 6, wx: 15, wxr: -15, wd: 4.5 },
  policebike: SEDAN, scooter: SEDAN, bicycle: SEDAN, jetski: SEDAN, fishboat: SEDAN, policeboat: SEDAN, policeheli: SEDAN, // own geometry  // only used if the realistic rig is missing (all four have one in carmodel.ts)
  hyper: { L: 50, W: 25, y0: 2.5, noseY: 6, beltY: 10.5, deckY: 11.5, xCowl: 10, xRoofF: 1, xRoofR: -8, xDeck: -14, roofY: 16, r: 6, wx: 16, wxr: -15, wd: 5 },
  formula: { L: 50, W: 14, y0: 2, noseY: 5, beltY: 8, deckY: 9, xCowl: 6, xRoofF: 0, xRoofR: -6, xDeck: -8, roofY: 12, r: 6, wx: 17, wxr: -15, wd: 5 },
  monster: { L: 50, W: 28, y0: 14, noseY: 22, beltY: 26, deckY: 26, xCowl: 12, xRoofF: 6, xRoofR: -6, xDeck: -8, roofY: 34, r: 14, wx: 17, wxr: -16, wd: 9 },
  lowrider: { L: 56, W: 24, y0: 2.5, noseY: 8, beltY: 11, deckY: 11, xCowl: 10, xRoofF: 1, xRoofR: -12, xDeck: -16, roofY: 15, r: 5.5, wx: 18, wxr: -17, wd: 4 },
};

// two wheelers: frame, tank, seat, handlebar; the rider goes into the "glass" mesh so it can be hidden
function bikeGeo(color: string, model: CarModel): CarGeo {
  const B: THREE.BufferGeometry[] = [], G: THREE.BufferGeometry[] = [], Lg: THREE.BufferGeometry[] = [];
  const body = C(color), trim = "#15161b", chrome = "#c9ced8";
  const k = model === "bicycle" ? 0.62 : model === "scooter" ? 0.72 : 1; // overall size
  let wheels: CarWheel[];
  if (model === "bicycle") {
    // thin tubes, pedals, no engine
    B.push(bar(-7, 4, 1, 4, 0.7, 0.7, 0, body), bar(1, 4, 7, 4, 0.7, 0.7, 0, body), bar(-7, 4, -2, 11, 0.7, 0.7, 0, body), bar(-2, 11, 6, 11, 0.7, 0.7, 0, body), bar(1, 4, -2, 11, 0.7, 0.7, 0, body), bar(6, 11, 7, 4, 0.7, 0.7, 0, body));
    B.push(nb(4, 1, 2.4, -2.5, 12, 0, "#1d1d22"), nb(0.6, 0.6, 7, 6.5, 13.5, 0, trim), nb(3, 0.5, 1.2, 1, 3, 1.6, trim), nb(3, 0.5, 1.2, 1, 3, -1.6, trim));
    wheels = [{ x: 7.5, z: 0, r: 4.4, wd: 1, front: true }, { x: -7.5, z: 0, r: 4.4, wd: 1, front: false }];
  } else if (model === "scooter") {
    B.push(rbox(16, 3, 6, 0, 4.5, 0, body, 1.2), rbox(6, 9, 6, 7, 9, 0, body, 1.4), rbox(7, 4, 6, -5, 8, 0, body, 1.6), rbox(7, 1.6, 5, -5, 10.6, 0, "#1d1d22", 0.6));
    B.push(nb(1, 6, 1, 9, 14, 0, trim), nb(1, 1, 9, 9, 17, 0, trim));
    Lg.push(nb(1, 1.6, 2.4, 10.3, 12, 0, "#fff4d6", 3.2), nb(0.8, 1, 2.4, -8.6, 8, 0, "#ff1838", 2.6));
    wheels = [{ x: 9, z: 0, r: 4, wd: 2.4, front: true }, { x: -8, z: 0, r: 4, wd: 2.4, front: false }];
  } else {
    B.push(bar(-13, 6, 2, 11, 1.6, 1.6, 0, trim), bar(2, 11, 12, 6, 1.6, 1.6, 0, trim), bar(-4, 7, 9, 14, 1.4, 1.4, 0, trim));
    B.push(rbox(11, 5, 7, 2, 14.5, 0, body, 1.8), rbox(10, 2.2, 6, -6, 15.5, 0, "#1d1d22", 0.8), rbox(7, 4, 7.5, -12, 11.5, 0, body, 1.4));
    B.push(bar(9, 14, 12.5, 6, 1, 1, 2.2, chrome), bar(9, 14, 12.5, 6, 1, 1, -2.2, chrome), nb(1, 1, 13, 9.5, 19, 0, trim), nb(1, 6, 1, 9, 16.5, 0, trim));
    B.push(cylX(1.3, 12, -9, 7, 3.2, chrome, 8), nb(8, 4, 4, 0, 8, 0, "#3a3d45"));
    Lg.push(nb(1, 2.4, 3, 13.4, 15, 0, "#fff4d6", 3.2), nb(0.8, 1.4, 3, -15.6, 12, 0, "#ff1838", 2.6));
    if (model === "policebike") { B.push(rbox(8, 7, 9, 10, 18, 0, "#f4f6fa", 1.5), rbox(9, 6, 10, -13, 13, 0, "#f4f6fa", 1.5)); Lg.push(nb(1, 1.4, 2, 9, 22, 2.5, "#ff1838", 3), nb(1, 1.4, 2, 9, 22, -2.5, "#2a5bff", 3)); }
    wheels = [{ x: 13, z: 0, r: 6, wd: 3, front: true }, { x: -13, z: 0, r: 6, wd: 3, front: false }];
  }
  // rider: legs, torso, helmet (scaled with the vehicle)
  const jacket = model === "policebike" ? "#1f3a6e" : "#23252c", helmet = "#e8e8ec";
  const R: THREE.BufferGeometry[] = [];
  for (const sd of [-1, 1]) R.push(bar(-6, 16, 2, 13, 2.4, 2.6, sd * 3.2, "#2c3e57"), bar(2, 13, 1, 6, 2.2, 2.2, sd * 3.4, "#2c3e57"));
  R.push(bar(-6, 16, 0, 27, 4.5, 6.5, 0, jacket), bar(-1, 26, 8, 19, 1.8, 1.8, 3.6, jacket), bar(-1, 26, 8, 19, 1.8, 1.8, -3.6, jacket));
  R.push(ni(withColor(new THREE.SphereGeometry(3.4, 12, 10).scale(1.1, 1, 0.95).translate(0.5, 30.5, 0), C(model === "bicycle" ? "#3b2a1e" : helmet))), nb(1.5, 2, 5, 3.6, 30.4, 0, "#0b121c"));
  G.push(...R);
  if (k !== 1) for (const g of G) { g.scale(k * 1.25, k * 1.25, 1); g.translate(model === "bicycle" ? 1 : 0, model === "bicycle" ? -4 : -5, 0); }
  const res: CarGeo = { body: mergeGeometries(B)!, glass: mergeGeometries(G)!, lights: Lg.length ? mergeGeometries(Lg)! : nb(0.01, 0.01, 0.01, 0, -50, 0, "#000"), wheels, roofY: 26 * k };
  for (const g of [...B, ...G, ...Lg]) g.dispose();
  return res;
}

// boats: hull below the waterline, deck, windshield, outboard motor (jetski, fishing boat and police boat are variants)
function boatGeo(color: string, model: CarModel): CarGeo {
  const B: THREE.BufferGeometry[] = [], G: THREE.BufferGeometry[] = [], Lg: THREE.BufferGeometry[] = [];
  const body = C(color), dark = body.clone().multiplyScalar(0.45);
  if (model === "jetski") {
    B.push(prof([[-13, -2], [8, -2], [15, 4], [-13, 4]], 11, 1.5, body), rbox(10, 3, 6, -3, 6, 0, "#1d1d22", 1), rbox(4, 4, 6, 5, 7, 0, body, 1), nb(1, 1, 8, 7, 10, 0, "#15161b"));
    Lg.push(nb(0.8, 1, 2, 14, 4.5, 0, "#fff4d6", 2.4));
    const res: CarGeo = { body: mergeGeometries(B)!, glass: nb(0.01, 0.01, 0.01, 0, -50, 0, "#000"), lights: mergeGeometries(Lg)!, wheels: [], roofY: 10 };
    for (const g of [...B, ...Lg]) g.dispose();
    return res;
  }
  if (model === "fishboat") {
    B.push(prof([[-32, -4], [20, -4], [36, 8], [-33, 8]], 26, 2, body), nb(60, 1, 23, -2, 8.4, 0, "#c9b48c"), rbox(18, 14, 18, -10, 16, 0, "#f4f1ea", 1));
    B.push(nb(1.5, 30, 1.5, 8, 23, 0, "#5c4632"), nb(26, 1, 1, 8, 30, 0, "#5c4632"), nb(14, 3, 10, -24, 10, 0, "#7a5a3a"));
    G.push(nb(1, 6, 15, -0.8, 19, 0, "#0b121c"));
    Lg.push(nb(1, 1.2, 1.2, 34, 9, 6, "#3dff8b", 2.4), nb(1, 1.2, 1.2, 34, 9, -6, "#ff1838", 2.4), nb(1.6, 1.6, 1.6, -10, 24, 0, "#fff4d6", 2.4));
  } else {
    B.push(prof([[-25, -3], [14, -3], [31, 6], [-26, 6]], 22, 2, body));
    B.push(nb(42, 1, 19, -4, 6.4, 0, model === "policeboat" ? "#1f3a6e" : "#f4f4f6"), nb(44, 1.4, 22.4, -2, 2.5, 0, dark));
    B.push(nb(8, 3, 16, -14, 8.3, 0, "#e9e4d8"), nb(6, 5, 8, -2, 9, 0, "#2a2d36"), nb(5, 9, 6, -27.5, 7, 0, "#22252b"), nb(2, 6, 2, -29, 1, 0, "#22252b"));
    for (const sd of [-1, 1]) B.push(nb(30, 1.6, 1, -2, 8, sd * 10.6, "#c9ced8"));
    G.push(prof([[3, 6.5], [9, 6.5], [5, 12.5], [1, 12.5]], 17, 0.5, "#0b121c"));
    Lg.push(nb(1, 1.2, 1.2, 24, 7, 6, "#3dff8b", 2.4), nb(1, 1.2, 1.2, 24, 7, -6, "#ff1838", 2.4), nb(1.6, 1.6, 1.6, -22, 12, 0, "#fff4d6", 2.4));
    if (model === "policeboat") { B.push(rbox(12, 8, 14, -6, 11, 0, "#f4f6fa", 1)); Lg.push(nb(2, 1.4, 4, -6, 15.7, 3, "#ff1838", 3), nb(2, 1.4, 4, -6, 15.7, -3, "#2a5bff", 3)); }
  }
  const res: CarGeo = { body: mergeGeometries(B)!, glass: mergeGeometries(G)!, lights: mergeGeometries(Lg)!, wheels: [], roofY: 14 };
  for (const g of [...B, ...G, ...Lg]) g.dispose();
  return res;
}
// helicopter: fuselage, tail boom, skids, cockpit glass (the rotor is a separate mesh, see makeCar)
function heliGeo(color: string, police = false): CarGeo {
  const B: THREE.BufferGeometry[] = [], G: THREE.BufferGeometry[] = [], Lg: THREE.BufferGeometry[] = [];
  const body = C(color), y = 14;
  B.push(ni(withColor(new THREE.SphereGeometry(12, 14, 10).scale(1.6, 1, 1).translate(0, y, 0), body)), nb(30, 6, 6, -30, y + 2, 0, body), nb(2, 12, 2, -45, y + 8, 0, body), nb(8, 2, 10, -45, y + 2, 0, "#f4f6fa"));
  for (const sd of [-1, 1]) B.push(nb(26, 1.6, 1.6, 0, 2, sd * 8, "#2a2d36"), nb(1.5, 6, 1.5, 6, 5, sd * 8, "#2a2d36"), nb(1.5, 6, 1.5, -6, 5, sd * 8, "#2a2d36"));
  B.push(nb(3, 4, 3, 0, y + 12, 0, "#2a2d36"));
  if (police) { B.push(nb(30, 3, 19.4, -2, y - 2, 0, "#f4f6fa"), cylY(2.2, 3, 14, y - 9, 0, "#c9ced8", 10)); Lg.push(nb(1.4, 1.4, 1.4, 14, y - 11, 0, "#fff8e0", 3)); }
  G.push(ni(withColor(new THREE.SphereGeometry(7, 10, 8).scale(1, 0.8, 1.1).translate(9, y + 2, 0), C("#0b121c"))));
  Lg.push(nb(1.4, 1.4, 1.4, -46, y + 14, 0, "#ff1838", 2.6), nb(1.2, 1.2, 1.2, 0, y - 9, 0, "#fff4d6", 2.4));
  const res: CarGeo = { body: mergeGeometries(B)!, glass: mergeGeometries(G)!, lights: mergeGeometries(Lg)!, wheels: [], roofY: y + 12 };
  for (const g of [...B, ...G, ...Lg]) g.dispose();
  return res;
}

interface CarWheel { x: number; z: number; r: number; wd: number; front: boolean; }
interface CarGeo { body: THREE.BufferGeometry; glass: THREE.BufferGeometry; lights: THREE.BufferGeometry; wheels: CarWheel[]; roofY: number; }
const carGeoCache = new Map<string, CarGeo>();

function getCarGeo(model: CarModel, color: string): CarGeo {
  const key = model + color;
  const hit = carGeoCache.get(key);
  if (hit) return hit;
  if (isTwoWheel(model)) { const g = bikeGeo(color, model); carGeoCache.set(key, g); return g; }
  if (isBoat(model)) { const g = boatGeo(color, model); carGeoCache.set(key, g); return g; }
  if (isHeli(model)) { const g = heliGeo(color, model === "policeheli"); carGeoCache.set(key, g); return g; }
  const B: THREE.BufferGeometry[] = [], G: THREE.BufferGeometry[] = [], Lg: THREE.BufferGeometry[] = [];
  const s = SPECS[model] ?? SEDAN;
  const body = C(color), dark = body.clone().multiplyScalar(0.45);
  const trim = "#15161b";
  const hl = s.L / 2, hw = s.W / 2, rm = (s.xRoofF + s.xRoofR) / 2;

  // lower body (rounded flanks) + greenhouse glass + roof + pillars
  const bev = Math.min(2.2, (s.noseY - s.y0) * 0.38);
  B.push(prof([[-hl, s.y0], [hl, s.y0], [hl, s.noseY], [s.xCowl, s.beltY], [s.xDeck, s.beltY], [-hl, s.deckY]], s.W, bev, body));
  if (model === "roadster") {
    // open two-seater: windshield frame, seats, roll hoops
    G.push(bar(s.xCowl - 0.5, s.beltY, s.xCowl - 4, s.roofY, 0.6, s.W - 4, 0, "#0b121c"));
    B.push(bar(s.xCowl, s.beltY, s.xCowl - 4, s.roofY, 1, 1.4, hw - 2, trim), bar(s.xCowl, s.beltY, s.xCowl - 4, s.roofY, 1, 1.4, -hw + 2, trim));
    for (const sd of [-1, 1]) B.push(rbox(6, 7, 7, -4, s.beltY + 1, sd * 5, "#3a2a22", 1.2), rbox(2, 6, 6, -8, s.beltY + 5, sd * 5, "#3a2a22", 1));
    B.push(nb(10, 0.6, s.W - 4, -2, s.beltY - 0.5, 0, "#1a1a1e"));
  } else {
    G.push(prof([[s.xCowl - 0.5, s.beltY - 0.3], [s.xRoofF, s.roofY], [s.xRoofR, s.roofY], [s.xDeck + 0.5, s.beltY - 0.3]], s.W - 3.2, 0, "#0b121c"));
    B.push(rbox(s.xRoofF - s.xRoofR + 1.5, 1.6, s.W - 3, rm, s.roofY + 0.2, 0, body, 0.7));
    for (const sd of [-1, 1]) {
      const z = sd * (hw - 1.7);
      B.push(bar(s.xCowl, s.beltY, s.xRoofF, s.roofY, 1.5, 1.8, z, body));
      B.push(bar(s.xDeck, s.beltY, s.xRoofR, s.roofY, 1.7, 1.8, z, body));
      B.push(bar(rm, s.beltY, rm, s.roofY, 1.1, 1.8, z, trim));
    }
  }
  // underbody, bumpers, grille
  const hbF = (s.noseY - s.y0) * 0.5 + 0.6, hbR = (s.deckY - s.y0) * 0.45 + 0.6;
  B.push(nb(s.L - 8, 2.4, s.W - 3, 0, s.y0 + 0.6, 0, "#0e0e11"));
  B.push(rbox(2.4, hbF, s.W - 1, hl - 0.4, s.y0 + hbF / 2 - 0.3, 0, trim, 1));
  B.push(rbox(2.4, hbR, s.W - 1, -hl + 0.4, s.y0 + hbR / 2 - 0.3, 0, trim, 1));
  B.push(nb(0.5, 2.2, s.W * 0.4, hl + 0.5, s.noseY - 1.6, 0, "#08080a"));
  // mirrors, door seams, handles, fender flares
  for (const sd of [-1, 1]) {
    B.push(rbox(2.2, 1.6, 2.2, s.xCowl - 1, s.beltY + 2.4, sd * (hw + 0.9), body, 0.5));
    B.push(nb(0.5, 1.2, 1.4, s.xCowl - 0.3, s.beltY + 1.4, sd * (hw - 0.3), trim));
    B.push(nb(2.2, 0.45, 0.5, rm + 4, s.beltY - 2, sd * (hw + 0.15), "#cfd2d8"), nb(2.2, 0.45, 0.5, rm - 5, s.beltY - 2, sd * (hw + 0.15), "#cfd2d8"));
  }
  B.push(nb(0.3, s.beltY - s.y0 - 2.2, s.W + 0.3, rm, (s.beltY + s.y0) / 2 + 0.2, 0, "#101114"));
  B.push(nb(0.3, s.beltY - s.y0 - 2.2, s.W + 0.3, (s.xCowl + rm) / 2 + 1, (s.beltY + s.y0) / 2 + 0.2, 0, "#101114"));
  const wheels: CarWheel[] = [];
  const wz = hw - 1.0;
  for (const sd of [-1, 1]) wheels.push({ x: s.wx, z: sd * wz, r: s.r, wd: s.wd, front: true }, { x: s.wxr, z: sd * wz, r: s.r, wd: s.wd, front: false });
  for (const w of wheels) B.push(rbox(2 * s.r + 3.4, 1.8, 3.2, w.x, 2 * s.r + 0.2, w.z * 0.88, body, 0.8));
  // lights
  for (const sd of [-1, 1]) {
    Lg.push(nb(0.8, 1.8, 5.5, hl + 0.2, s.noseY - 1.3, sd * (hw - 4.8), "#fff4d6", 3.2));
    Lg.push(nb(0.8, 1.8, 6.5, -hl - 0.2, s.deckY - 1.9, sd * (hw - 4.2), "#ff1838", 2.6));
  }

  switch (model) {
    case "sport":
      B.push(rbox(4.5, 0.8, s.W - 3, -hl + 3.5, s.deckY + 3.4, 0, trim, 0.3), nb(1.2, 3.2, 1.2, -hl + 4, s.deckY + 1.6, 6, trim), nb(1.2, 3.2, 1.2, -hl + 4, s.deckY + 1.6, -6, trim));
      B.push(nb(40, 0.3, 1.6, 0, s.beltY + 0.1, 3.2, "#f4f4f4"), nb(40, 0.3, 1.6, 0, s.beltY + 0.1, -3.2, "#f4f4f4"));
      break;
    case "super":
      B.push(rbox(6, 0.9, s.W + 1, -hl + 3, s.deckY + 6.5, 0, trim, 0.3), nb(1.4, 6, 1.4, -hl + 3.4, s.deckY + 3.2, 9, trim), nb(1.4, 6, 1.4, -hl + 3.4, s.deckY + 3.2, -9, trim));
      B.push(rbox(4, 0.8, s.W, hl + 1.5, s.y0 + 0.4, 0, trim, 0.3));
      for (const sd of [-1, 1]) B.push(nb(8, 2.5, 0.6, -4, 6.5, sd * (hw + 0.1), "#0a0a0c"));
      break;
    case "muscle":
      B.push(rbox(9, 2.4, 8, 13, s.beltY + 0.4, 0, dark, 0.8));
      B.push(bar(s.xCowl, s.beltY + 0.15, hl, s.noseY + 0.15, 0.3, 2.4, 2.3, "#f0f0f0"), bar(s.xCowl, s.beltY + 0.15, hl, s.noseY + 0.15, 0.3, 2.4, -2.3, "#f0f0f0"));
      B.push(nb(s.xRoofF - s.xRoofR + 1.5, 0.3, 2.4, rm, s.roofY + 1.05, 2.3, "#f0f0f0"), nb(s.xRoofF - s.xRoofR + 1.5, 0.3, 2.4, rm, s.roofY + 1.05, -2.3, "#f0f0f0"));
      B.push(bar(s.xDeck, s.beltY + 0.15, -hl, s.deckY + 0.15, 0.3, 2.4, 2.3, "#f0f0f0"), bar(s.xDeck, s.beltY + 0.15, -hl, s.deckY + 0.15, 0.3, 2.4, -2.3, "#f0f0f0"));
      break;
    case "pickup":
      // open load bed behind the cab
      for (const sd of [-1, 1]) B.push(nb(hl + s.xDeck - 1, 5, 1.2, (-hl + s.xDeck) / 2, s.beltY + 2, sd * (hw - 0.6), body));
      B.push(nb(1.2, 5, s.W - 1, -hl + 0.8, s.beltY + 2, 0, body), nb(hl + s.xDeck - 2, 0.6, s.W - 3, (-hl + s.xDeck) / 2, s.beltY - 0.3, 0, "#1a1a1e"));
      break;
    case "offroad":
      B.push(nb(26, 1.2, s.W - 6, rm, s.roofY + 2.4, 0, "#2a2c33"), nb(20, 4, s.W - 10, rm, s.roofY + 4.6, 0, "#5a5040"));
      B.push(cylX(6, 2.6, -hl - 1.8, 14, 0, "#121214", 18), nb(2, 4, s.W - 2, hl + 1.5, s.noseY - 2, 0, "#2a2c33"));
      break;
    case "tow":
      B.push(nb(s.xDeck + hl - 2, 2, s.W, (-hl + s.xDeck) / 2, s.deckY, 0, "#3a3d45"));
      B.push(bar(-8, s.deckY + 1, -hl - 2, s.deckY + 16, 2.4, 3, 0, "#d9b23a"), bar(-8, s.deckY + 1, -8, s.deckY + 14, 2.4, 3, 0, "#d9b23a"));
      B.push(nb(1, 10, 1, -hl - 2, s.deckY + 10, 0, "#15161b"), nb(3, 2, 6, -hl - 2, s.deckY + 4, 0, "#15161b"));
      Lg.push(nb(3, 1.4, 10, s.xRoofR + 4, s.roofY + 1.5, 0, "#ffb020", 2.6));
      break;
    case "garbage":
      B.push(rbox(s.xDeck + hl - 1.5, 26, s.W + 1, (-hl + s.xDeck - 1.5) / 2, s.y0 + 15, 0, "#3c6e47", 1.6), nb(2, 18, s.W - 2, -hl - 0.5, s.y0 + 12, 0, "#2a2d36"));
      for (const sd of [-1, 1]) B.push(nb(s.xDeck + hl - 4, 1.4, 0.4, (-hl + s.xDeck) / 2, s.y0 + 12, sd * (hw + 0.8), "#f4f4f6"));
      Lg.push(nb(3, 1.4, 10, s.xRoofR + 4, s.roofY + 1.5, 0, "#ffb020", 2.6));
      break;
    case "ambulance": case "icecream": {
      B.push(rbox(s.xDeck + hl - 1, 22, s.W + 0.6, (-hl + s.xDeck - 1) / 2, s.y0 + 12, 0, model === "ambulance" ? "#f4f4f6" : "#f2c7d8", 1.4));
      if (model === "ambulance") {
        for (const sd of [-1, 1]) B.push(nb(s.xDeck + hl - 4, 2.4, 0.4, (-hl + s.xDeck) / 2, s.y0 + 9, sd * (hw + 0.6), "#c0392b"), nb(4, 8, 0.4, -12, s.y0 + 15, sd * (hw + 0.6), "#c0392b"), nb(8, 2.4, 0.4, -12, s.y0 + 15, sd * (hw + 0.6), "#c0392b"));
      } else {
        for (const sd of [-1, 1]) B.push(nb(20, 9, 0.4, -10, s.y0 + 15, sd * (hw + 0.6), "#2a2d36"), nb(22, 1.4, 4, -10, s.y0 + 10, sd * (hw + 2), "#f4f4f6"));
        B.push(ni(withColor(new THREE.ConeGeometry(4, 10, 12).rotateX(Math.PI).translate(-10, s.y0 + 30, 0), C("#e0a860"))), ni(withColor(new THREE.SphereGeometry(4.2, 12, 8).translate(-10, s.y0 + 36, 0), C("#ffb3c6"))));
      }
      break;
    }
    case "fire":
      B.push(rbox(s.xDeck + hl - 1.5, 20, s.W + 1, (-hl + s.xDeck - 1.5) / 2, s.y0 + 11, 0, body, 1.4));
      for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) B.push(nb(9, 12, 0.4, -hl + 8 + i * 11, s.y0 + 11, sd * (hw + 1), "#c9ced8"));
      B.push(nb(s.xDeck + hl - 4, 1.2, 8, (-hl + s.xDeck) / 2, s.y0 + 23, 0, "#c9ced8"));
      for (let i = 0; i < 10; i++) B.push(nb(0.8, 1.2, 8, -hl + 4 + i * 5, s.y0 + 24.5, 0, "#c9ced8"));
      B.push(nb(s.L - 2, 1.4, s.W + 0.4, 0, s.y0 + 4, 0, "#f4f4f6"));
      break;
    case "unmarked":
      Lg.push(nb(0.6, 1, 3, hl + 0.3, s.noseY - 3.6, 4, "#2a5bff", 2), nb(0.6, 1, 3, hl + 0.3, s.noseY - 3.6, -4, "#ff1838", 2));
      break;
    case "suv":
      for (const sd of [-1, 1]) B.push(nb(26, 0.8, 0.8, rm, s.roofY + 1.7, sd * (hw - 3), "#2a2c33"), nb(0.8, 1.4, 0.8, rm + 10, s.roofY + 1.1, sd * (hw - 3), "#2a2c33"), nb(0.8, 1.4, 0.8, rm - 10, s.roofY + 1.1, sd * (hw - 3), "#2a2c33"));
      B.push(cylX(6, 2.6, -hl - 1.8, 14, 0, "#121214", 18), cylX(3.4, 2.8, -hl - 1.8, 14, 0, "#9ea3ae", 12));
      break;
    case "van": {
      B.push(rbox(41, 20.5, s.W, -5.5, s.y0 + 10.25, 0, body, 1.4));
      B.push(nb(0.3, 17, s.W + 0.3, -26, s.y0 + 10, 0, "#101114"), nb(0.3, 17, s.W + 0.3, -8, s.y0 + 10, 0, "#101114"));
      B.push(nb(10, 1.6, 6, -10, s.roofY + 1.0, 0, "#c9ccd2"));
      break;
    }
    case "police": {
      const navy = "#0b1530";
      B.push(rbox(14, 7.6, s.W + 0.3, 18, 8, 0, navy, 0.6), rbox(9, 7.6, s.W + 0.3, -20.5, 8.2, 0, navy, 0.6), nb(s.L - 2, 0.6, s.W + 0.35, 0, 11.4, 0, navy));
      B.push(nb(5, 1.2, 17, -3, s.roofY + 1.05, 0, "#1a1d26"));
      B.push(nb(1.5, 6, 22, hl + 1.2, 6.5, 0, "#2a2d36"), nb(1.5, 1.2, 1.2, hl + 1.2, 6.5, 11, "#2a2d36"), nb(1.2, 4, 8, hl + 1.6, 6.5, 0, "#2a2d36"));
      B.push(cylY(1.4, 2.5, 8, 15.5, 11.5, "#1a1d26", 8), nb(0.4, 10, 0.4, -16, 18, 8, "#111"), nb(0.4, 8, 0.4, -17, 17, -9, "#111"));
      B.push(cylY(1, 3, -hl - 0.5, 3.5, 7, "#444", 8));
      Lg.push(nb(1, 1.2, 3, hl + 0.3, s.y0 + 2.7, 9.5, "#ffb020", 2.2), nb(1, 1.2, 3, hl + 0.3, s.y0 + 2.7, -9.5, "#ffb020", 2.2));
      break;
    }
    case "taxi":
      Lg.push(nb(4, 3.5, 10, -3, s.roofY + 2.8, 0, "#fff5b0", 1.8));
      for (let i = 0; i < 8; i++) for (const sd of [-1, 1]) B.push(nb(3, 1.2, 0.3, -10 + i * 3.2, s.beltY - 3.2 + (i % 2) * 1.2, sd * (hw + 0.12), "#111"));
      break;
    case "truck":
      // cargo box behind the cab
      B.push(rbox(s.xDeck + hl - 1.5, 27, s.W + 1, (-hl + s.xDeck - 1.5) / 2, s.y0 + 15.5, 0, "#e4e2dc", 1));
      B.push(nb(s.xDeck + hl - 2, 1.2, s.W + 1.3, (-hl + s.xDeck - 1.5) / 2, s.y0 + 6, 0, dark));
      B.push(cylY(1, 14, s.xCowl - 6, s.roofY + 2, hw - 1, "#3a3d45", 8));
      break;
    case "bus":
      B.push(nb(s.L - 2, 1, s.W + 0.4, 0, s.beltY - 4, 0, "#f4f4f6"), nb(s.L - 2, 1, s.W + 0.4, 0, s.beltY - 7, 0, dark));
      B.push(nb(10, 3, s.W - 6, -10, s.roofY + 1.5, 0, "#c9ccd2"));
      Lg.push(nb(0.6, 3, 14, hl + 0.3, s.roofY - 3, 0, "#ffc21a", 2));
      break;
    case "armor": {
      // armoured car: slab sides, turret with a long barrel, spare wheel, vision slits instead of windows
      B.push(rbox(54, 14, s.W, -2, s.y0 + 9, 0, body, 2.4), rbox(48, 3, s.W + 2, -2, s.y0 + 3, 0, dark, 1));
      B.push(rbox(18, 8, 17, -4, s.roofY + 4.5, 0, body, 2), cylY(5, 2, -4, s.roofY + 9.5, 0, "#3a3f2a", 12));
      B.push(cylX(1.5, 26, 16, s.roofY + 5, 0, "#2a2d22", 8), cylX(2.2, 4, 28, s.roofY + 5, 0, "#2a2d22", 8));
      B.push(cylX(6, 3, -hl - 1.5, 16, 0, "#141414", 16));
      for (const sd of [-1, 1]) B.push(nb(10, 1.6, 0.5, 10, s.beltY + 2, sd * (hw + 0.2), "#0b0d08"), nb(26, 1.2, 0.6, -6, s.beltY - 4, sd * (hw + 0.3), dark));
      break;
    }
    case "swat": {
      const navy = "#141820";
      B.push(rbox(43, 21, s.W, -5.5, s.y0 + 10.5, 0, body, 1.4), nb(s.L - 2, 2.5, s.W + 0.4, 0, 10, 0, navy));
      B.push(nb(1.5, 6, 22, hl + 1.2, 7, 0, "#2a2d36"), nb(2, 4, s.W - 6, -hl - 1, 8, 0, "#2a2d36"));
      break;
    }
    default:
      break;
  }

  const res: CarGeo = { body: mergeGeometries(B)!, glass: mergeGeometries(G)!, lights: mergeGeometries(Lg)!, wheels, roofY: s.roofY };
  for (const g of B) g.dispose();
  for (const g of G) g.dispose();
  for (const g of Lg) g.dispose();
  carGeoCache.set(key, res);
  return res;
}

interface CarObj {
  group: THREE.Group; tilt: THREE.Group; body: THREE.Mesh; glass: THREE.Mesh; lights: THREE.Mesh; pool: THREE.Mesh; glow?: THREE.Mesh; rotor?: THREE.Mesh;
  wheels: { pivot: THREE.Object3D; spin: THREE.Object3D; front: boolean; r: number; y: number }[];
  bar?: { reds: THREE.MeshBasicMaterial; blues: THREE.MeshBasicMaterial; white: THREE.MeshBasicMaterial };
  model: CarModel; color: string; wreck: boolean; pitch: number; roll: number; spinA: number; steerA: number;
  rig?: CarRig; gangDriver?: boolean; dentN: number; glassV: number; bumpers: number; prevV: number; brakeT: number; wipe: number; bounce: number; bounceV: number;
}
// people at the wheel of traffic cars
const DRIVERS: [string, string, string][] = [
  ["#f1c7a5", "#2b3242", "#3a2a1c"], ["#d9a07c", "#c0392b", "#1b1410"], ["#b07850", "#eef0f2", "#0d0d0d"],
  ["#7a4f32", "#3d6e9a", "#1b1410"], ["#5a3a26", "#5a7a3a", "#0d0d0d"], ["#f1c7a5", "#d4a017", "#b08850"], ["#d9a07c", "#6a4a8a", "#8a8a8a"],
];
// main menu camera flight: [camera x, camera y, height, look x, look y] (block coordinates of the landmarks)
const B = (v: number) => v * BLOCK + ROAD + (BLOCK - ROAD) / 2;
const MENU_PATH: [number, number, number, number, number][] = [
  [B(5), B(9), 260, B(7), B(7)],          // town hall and clock tower
  [B(4), B(5), 420, B(6), B(6)],          // Vale Tower
  [B(1), B(3), 180, -130, 3.4 * BLOCK],   // ferris wheel on the promenade
  [B(3), B(8), 220, B(5), B(9)],          // old town
  [B(8), B(10), 200, B(9), B(9)],         // mall and the roundabout
  [B(11), B(13), 300, B(12.5), B(14.5)],  // stadium
  [B(13), B(10), 260, B(15), B(9)],       // harbour
  [B(9), B(5), 340, B(7), B(7)],
];
// how many people near the camera are full animated figures, per quality level
const CROWD_RIGS: Record<string, number> = { low: 16, medium: 24, high: 32, ultra: 40 };
let plateNo = 1000 + Math.floor(Math.random() * 7000);

// ---------------------------------------------------------------- particles
class PointsLayer {
  geo = new THREE.BufferGeometry();
  pos = new Float32Array(MAX_PTS * 3); col = new Float32Array(MAX_PTS * 4); size = new Float32Array(MAX_PTS);
  points: THREE.Points; mat: THREE.ShaderMaterial; n = 0;
  constructor(additive: boolean) {
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("rgba", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("size", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 500 } },
      vertexShader: `attribute float size; attribute vec4 rgba; uniform float scale; varying vec4 vC;
        void main(){ vC = rgba; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = min(size * scale / max(-mv.z, 1.0), 256.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c,c) * 4.0; if (d > 1.0) discard;
          gl_FragColor = vec4(vC.rgb, vC.a * (1.0 - d) * (1.0 - d * 0.3));
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
  }
  begin() { this.n = 0; }
  push(x: number, y: number, z: number, c: THREE.Color, a: number, s: number, mul = 1) {
    if (this.n >= MAX_PTS) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 4] = c.r * mul; this.col[i * 4 + 1] = c.g * mul; this.col[i * 4 + 2] = c.b * mul; this.col[i * 4 + 3] = a;
    this.size[i] = s;
  }
  end() {
    this.geo.setDrawRange(0, this.n);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.rgba as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ---------------------------------------------------------------- renderer
export class Renderer3D {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, 1, 9000);
  composer: EffectComposer | null = null;
  quality: Quality; camMode: CameraMode; world: World;
  w = 1; h = 1;
  camYaw = 0;

  private head!: THREE.SpotLight;
  private plights: THREE.PointLight[] = [];
  private cityMeshes: THREE.Mesh[] = [];
  private terrain!: THREE.Mesh;
  private forest: THREE.InstancedMesh[] = [];
  private carObjs = new Map<Car, CarObj>();
  private seenCars = new Set<Car>();
  private seenProjs = new Set<Proj>(); private seenBombs = new Set<Bomb>();
  private enemyBulletMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.8, 0.6), toneMapped: false });
  private grenadeMat = new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 0.6 });
  private nearCops: Car[] = [];
  private dmgMat!: THREE.MeshStandardMaterial;
  private pickObjs = new Map<Pickup, THREE.Group>();
  private projObjs = new Map<Proj, THREE.Mesh>();
  private bombObjs = new Map<Bomb, THREE.Mesh>();
  private bodyMat!: THREE.MeshStandardMaterial; private wreckMat!: THREE.MeshStandardMaterial; private glassMat!: THREE.MeshStandardMaterial; private wheelMat!: THREE.MeshStandardMaterial;
  private flashMat!: THREE.MeshBasicMaterial; private lightMat!: THREE.MeshBasicMaterial;
  private poolGeo!: THREE.PlaneGeometry; private poolMat!: THREE.MeshBasicMaterial; private poolMatP!: THREE.MeshBasicMaterial;
  private shadowGeo!: THREE.PlaneGeometry; private shadowMat!: THREE.MeshBasicMaterial;
  private rotorGeo!: THREE.BufferGeometry; private rotorMat!: THREE.MeshStandardMaterial;
  private glowGeo!: THREE.PlaneGeometry; private glowMat!: THREE.MeshBasicMaterial;
  private barSeg = new THREE.BoxGeometry(3.2, 2, 2.6);
  // shared unit shapes for parts made per car (scaled), so nothing new is allocated when cars come and go
  private unitBox = new THREE.BoxGeometry(1, 1, 1); private unitPlane = new THREE.PlaneGeometry(1, 1);
  private decalGeo = new THREE.PlaneGeometry(20, 5.5);
  private decalMat!: THREE.MeshBasicMaterial; private decalMatB!: THREE.MeshBasicMaterial; private roofDecalMat!: THREE.MeshBasicMaterial;
  private pickGeo: Partial<Record<PickupType, THREE.BufferGeometry>> = {};
  private pickMat: Partial<Record<PickupType, THREE.Material>> = {};
  private beamGeo!: THREE.CylinderGeometry;
  private beamMat: Partial<Record<PickupType, THREE.MeshBasicMaterial>> = {};
  private bulletGeo!: THREE.BufferGeometry; private bulletMat!: THREE.MeshBasicMaterial;
  private rocketGeo!: THREE.BufferGeometry; private rocketMat!: THREE.MeshStandardMaterial;
  private bombGeo!: THREE.BufferGeometry; private bombMat!: THREE.MeshStandardMaterial; private bombLightMat!: THREE.MeshBasicMaterial;
  private smoke = new PointsLayer(false); private glowPts = new PointsLayer(true);
  private rings: THREE.Mesh[] = [];
  private skidGeo = new THREE.BufferGeometry(); private skidPos = new Float32Array(MAX_SKIDS * 18); private skidSeen = 0;
  private arrow!: THREE.Mesh;
  private ped!: PlayerFigure;
  private rooms!: InteriorsRenderer;
  private landmarks!: Landmarks;
  private people!: CrowdFigures;
  private crowd!: CrowdRenderer;
  private camPos = new THREE.Vector3(); private camLook = new THREE.Vector3(); private camInit = false; private orbit = 0; private fov = 62;
  private tmpV = new THREE.Vector3();
  private copRed = C("#ff1a3a"); private copBlue = C("#2a5bff");

  private interiorList: Interior[];
  constructor(canvas: HTMLCanvasElement, world: World, places: Place[], quality: Quality, camMode: CameraMode, interiors: Interior[] = []) {
    this.interiorList = interiors;
    this.world = world; this.quality = quality; this.camMode = camMode;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === "high" || quality === "ultra", powerPreference: "high-performance" });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;
    pmrem.dispose();
    this.scene.fog = new THREE.Fog(0xcdbca4, 450, 3600);
    this.scene.background = new THREE.Color(0xb7cbe6);
    this.atm = new Atmosphere(this.scene, this.camera, quality);
    this.water = new WaterSurface(this.scene, world, quality);
    this.buildLights(); this.buildGround(); this.buildTerrain(); this.buildCity(); this.buildRamps(); this.buildLamps(); this.buildShared(); this.buildPlaces(places); this.buildMarkers(); this.buildHeli(); this.buildSpikes();
    this.setQuality(quality);
    this.atm.setupMaterials(this.scene);
  }
  atm: Atmosphere;
  private water: WaterSurface;

  dispose() { this.renderer.dispose(); this.composer?.dispose(); }

  setQuality(q: Quality) {
    const changed = this.quality !== q;
    this.quality = q;
    const hi = q === "high" || q === "ultra";
    for (const m of this.cityMeshes) m.castShadow = q !== "low" && m.userData.cast;
    for (const f of this.forest) f.castShadow = hi;
    this.crowd.setShadows(q !== "low");
    this.people?.setMax(CROWD_RIGS[q]);
    this.camera.far = (q === "ultra" ? 12000 : hi ? 9000 : 7000) * currentSettings.viewDist;
    this.camera.updateProjectionMatrix();
    if (changed && this.atm) {
      this.atm.setQuality(q); this.atm.setupMaterials(this.scene);
      this.scene.remove(this.water.mesh); this.water = new WaterSurface(this.scene, this.world, q);
    }
    if (hi) {
      if (!this.composer) {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(this.w, this.h), 0.28, 0.5, 0.92));
        this.composer.addPass(new OutputPass());
      }
    } else if (this.composer) { this.composer.dispose(); this.composer = null; }
    this.resize(this.w, this.h);
  }

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    const dpr = window.devicePixelRatio || 1;
    const pr = this.quality === "ultra" ? Math.min(dpr, 2) : this.quality === "high" ? Math.min(dpr, 1.5) : this.quality === "medium" ? Math.min(dpr, 1.25) : Math.min(dpr, 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  project(x: number, y: number, h: number) {
    const v = this.tmpV.set(x, h, y).project(this.camera);
    return { x: (v.x + 1) * 0.5 * this.w, y: (1 - v.y) * 0.5 * this.h, ok: v.z < 1 && v.z > -1 };
  }

  // ---------------------------------------------------------- build
  private buildLights() {
    const head = new THREE.SpotLight(0xfff0d0, 5, 750, 0.55, 0.65, 0);
    this.scene.add(head, head.target);
    this.head = head;
    for (let i = 0; i < 5; i++) { const l = new THREE.PointLight(0xff0000, 0, 260, 0); this.scene.add(l); this.plights.push(l); }
  }

  private buildGround() {
    const noise = canvasTex(256, 256, (g) => {
      g.fillStyle = "#808080"; g.fillRect(0, 0, 256, 256);
      const id = g.getImageData(0, 0, 256, 256);
      for (let i = 0; i < id.data.length; i += 4) { const v = 110 + Math.random() * 40; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; }
      g.putImageData(id, 0, 0);
    });
    noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
    noise.repeat.set(WORLD / 160, WORLD / 160);
    noise.anisotropy = 4;
    this.asphaltMat = new THREE.MeshStandardMaterial({ color: 0x46464b, map: noise, roughness: 0.55, metalness: 0.15, envMapIntensity: 0.6 });
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD).rotateX(-Math.PI / 2).translate(WORLD / 2, 0, WORLD / 2), this.asphaltMat);
    asphalt.receiveShadow = true;
    this.scene.add(asphalt);

    const M: THREE.BufferGeometry[] = [];
    for (let j = 0; j <= GRID; j++) {
      const cy = j * BLOCK + ROAD / 2;
      for (let i = 0; i < GRID; i++) {
        const sx = i * BLOCK + ROAD + 26, ex = (i + 1) * BLOCK - 26, mx = (sx + ex) / 2, L = ex - sx;
        M.push(flat(L, 2.4, mx, cy - 3, "#e0a82a"), flat(L, 2.4, mx, cy + 3, "#e0a82a"), flat(L, 2, mx, cy - ROAD / 2 + 8, "#c8c8d2"), flat(L, 2, mx, cy + ROAD / 2 - 8, "#c8c8d2"));
        for (let k = sx + 10; k < ex - 20; k += 50) M.push(flat(22, 1.6, k + 11, cy - 34, "#9a9aa6"), flat(22, 1.6, k + 11, cy + 34, "#9a9aa6"));
      }
    }
    for (let i = 0; i <= GRID; i++) {
      const cx = i * BLOCK + ROAD / 2;
      for (let j = 0; j < GRID; j++) {
        const sy = j * BLOCK + ROAD + 26, ey = (j + 1) * BLOCK - 26, my = (sy + ey) / 2, L = ey - sy;
        M.push(flat(2.4, L, cx - 3, my, "#e0a82a"), flat(2.4, L, cx + 3, my, "#e0a82a"), flat(2, L, cx - ROAD / 2 + 8, my, "#c8c8d2"), flat(2, L, cx + ROAD / 2 - 8, my, "#c8c8d2"));
        for (let k = sy + 10; k < ey - 20; k += 50) M.push(flat(1.6, 22, cx - 34, k + 11, "#9a9aa6"), flat(1.6, 22, cx + 34, k + 11, "#9a9aa6"));
      }
    }
    for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) {
      const x = i * BLOCK, y = j * BLOCK;
      for (let k = 0; k < 7; k++) {
        const o = 14 + k * 18 + 4.5;
        if (i < GRID) M.push(flat(18, 9, x + ROAD + 13, y + o, "#b8b8c4", 0.13));
        if (i > 0) M.push(flat(18, 9, x - 13, y + o, "#b8b8c4", 0.13));
        if (j < GRID) M.push(flat(9, 18, x + o, y + ROAD + 13, "#b8b8c4", 0.13));
        if (j > 0) M.push(flat(9, 18, x + o, y - 13, "#b8b8c4", 0.13));
      }
    }
    const marks = new THREE.Mesh(mergeGeometries(M)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }));
    marks.receiveShadow = true;
    this.scene.add(marks);
    for (const g of M) g.dispose();
  }

  private padMat: THREE.MeshBasicMaterial | null = null;
  // launch ramps (wood, steel, concrete) and parking garage ramps
  private buildRamps() {
    const g = rampsMesh(this.world);
    this.padMat = (g.userData.pad as THREE.MeshBasicMaterial | undefined) ?? null;
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.userData.cast) this.cityMeshes.push(o as THREE.Mesh); });
    this.scene.add(g);
  }

  private buildTerrain() {
    this.terrain = terrainMesh(this.quality);
    this.scene.add(this.terrain, backdropMesh());
    const roads = roadsMesh(this.world);
    roads.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.userData.cast) this.cityMeshes.push(o as THREE.Mesh); });
    this.scene.add(roads);
    // forest + rocks
    const treeN = this.quality === "high" ? 3600 : 2000, rockN = 700;
    const pine = mergeGeometries([
      withColor(new THREE.CylinderGeometry(1.6, 2.4, 14, 6).translate(0, 7, 0), C("#4a3320")),
      withColor(new THREE.ConeGeometry(11, 26, 7).translate(0, 24, 0), C("#1f4d2a")),
      withColor(new THREE.ConeGeometry(8.5, 20, 7).translate(0, 36, 0), C("#276038")),
      withColor(new THREE.ConeGeometry(5.5, 14, 7).translate(0, 46, 0), C("#2f7042")),
    ])!;
    const trees = new THREE.InstancedMesh(pine, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), treeN);
    const rockG = withColor(new THREE.DodecahedronGeometry(8, 0), C("#8a8176"));
    const rocks = new THREE.InstancedMesh(rockG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), rockN);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    const rr = mulberry32(2024);
    let placed = 0, guard = 0;
    while (placed < treeN && guard++ < treeN * 12) {
      const x = MAP_MIN + 400 + rr() * (MAP_SIZE - 800), z = MAP_MIN + 400 + rr() * (MAP_SIZE - 800);
      const d = cityDist(x, z);
      if (d < 320 || coast(x, z).d < 260 || edgeDist(x, z) < EDGE_LAND + 120 || Math.hypot(x - HELI_SPOT.x, z - HELI_SPOT.y) < 230 || this.world.roads.nearest(x, z, 140).road >= 0 || this.world.isSolid(x, z, 30) || inStuntPark(x, z)) continue;
      const h = terrainH(x, z);
      const g = terrainGrad(x, z, 10);
      if (Math.hypot(g.x, g.y) > 0.42 || h > 460) continue;
      const sc = 0.8 + rr() * 0.7;
      p.set(x, h - 1, z); s.set(sc, sc * (0.9 + rr() * 0.3), sc); q.setFromEuler(e.set(0, rr() * 6.28, 0));
      trees.setMatrixAt(placed++, m.compose(p, q, s));
    }
    trees.count = placed;
    placed = 0; guard = 0;
    while (placed < rockN && guard++ < rockN * 12) {
      const x = MAP_MIN + 400 + rr() * (MAP_SIZE - 800), z = MAP_MIN + 400 + rr() * (MAP_SIZE - 800);
      const d = cityDist(x, z);
      if (d < 420 || coast(x, z).d < 120 || this.world.roads.nearest(x, z, 110).road >= 0 || Math.hypot(x - HELI_SPOT.x, z - HELI_SPOT.y) < 230 || inStuntPark(x, z)) continue;
      const h = terrainH(x, z);
      const g = terrainGrad(x, z, 10);
      if (h < 120 && Math.hypot(g.x, g.y) < 0.2 && rr() < 0.7) continue;
      const sc = 0.6 + rr() * 2.2;
      p.set(x, h - sc * 3, z); s.set(sc * (0.8 + rr() * 0.6), sc * (0.6 + rr() * 0.5), sc); q.setFromEuler(e.set(rr(), rr() * 6.28, rr()));
      rocks.setMatrixAt(placed++, m.compose(p, q, s));
    }
    rocks.count = placed;
    trees.receiveShadow = rocks.receiveShadow = true;
    this.scene.add(trees, rocks);
    this.forest.push(trees, rocks);
  }

  private buildCity() {
    const N = 8, S = 512, cell = S / N;
    const rr = mulberry32(99);
    const map = canvasTex(S, S, (g) => {
      g.fillStyle = "#d9d6cf"; g.fillRect(0, 0, S, S);
      for (let j = 0; j < N; j++) {
        g.fillStyle = "#c2beb6"; g.fillRect(0, j * cell, S, 5);
        for (let i = 0; i < N; i++) {
          const x = i * cell + 9, y = j * cell + 11, w = cell - 18, h = cell - 22;
          g.fillStyle = "#b3afa7"; g.fillRect(x - 2, y - 2, w + 4, h + 4);
          const gr = g.createLinearGradient(0, y, 0, y + h);
          const t = rr();
          gr.addColorStop(0, t < 0.5 ? "#6f8aa6" : "#5f7b98"); gr.addColorStop(1, t < 0.5 ? "#26364a" : "#1b2838");
          g.fillStyle = gr; g.fillRect(x, y, w, h);
          g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w * 0.55, y); g.lineTo(x + w * 0.8, y); g.lineTo(x + w * 0.25, y + h); g.fill();
          g.fillStyle = "#b3afa7"; g.fillRect(x + w / 2 - 1, y, 2, h);
          if (rr() < 0.18) { g.fillStyle = "rgba(230,220,200,0.55)"; g.fillRect(x, y, w, h * (0.3 + rr() * 0.4)); }
        }
      }
    });
    const emi = canvasTex(S, S, (g) => {
      g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
      const pal = ["#ffcf87", "#ffd9a0", "#ffe7c2", "#bfe8ff", "#ff9ad5", "#ffb36b"];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        if (rr() < 0.42) {
          g.globalAlpha = 0.45 + rr() * 0.55; g.fillStyle = pal[Math.floor(rr() * pal.length)];
          const blind = rr() < 0.3 ? (cell - 24) * 0.45 : 0;
          g.fillRect(i * cell + 11, j * cell + 13 + blind, cell - 22, cell - 24 - blind);
        }
      }
      g.globalAlpha = 1;
    });
    for (const t of [map, emi]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
    const wallMat = this.wallMat = new THREE.MeshStandardMaterial({ map, emissiveMap: emi, emissive: 0xffffff, emissiveIntensity: 0.16, vertexColors: true, roughness: 0.7, metalness: 0.05, envMapIntensity: 0.6 });
    const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05, envMapIntensity: 0.4 });
    const neonMat = this.neonMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0.5, 0.5, 0.5), toneMapped: false });
    const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, envMapIntensity: 0.3 });
    type Layers = { wall: THREE.BufferGeometry[]; prop: THREE.BufferGeometry[]; neon: THREE.BufferGeometry[]; ground: THREE.BufferGeometry[] };
    const chunks = new Map<string, Layers>();
    const r = mulberry32(31337);
    const WALL_COLS = ["#cfc8bb", "#b9b4aa", "#d8cfbd", "#a9a59d", "#c9b79c", "#bfa78f", "#9fa7ad", "#aab4bb", "#c4a58f", "#b08d78", "#d6d1c6", "#8f9aa3"];
    const SHOP = ["#c0392b", "#2e6da4", "#e1b12c", "#e67e22", "#7d3c98", "#2d8a5a"];
    const wallBox = (b: Building, H: number, col: THREE.Color) => {
      const g = new THREE.BoxGeometry(b.w, H, b.h);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      const ou = Math.floor(r() * 8) / 8, ov = Math.floor(r() * 8) / 8;
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        if (f === 2 || f === 3) { uv.setXY(i, 0.004, 0.004); continue; }
        const fw = f < 2 ? b.h : b.w;
        uv.setXY(i, ou + (uv.getX(i) * fw) / (8 * WIN), ov + (uv.getY(i) * H) / (8 * FLOOR));
      }
      g.translate(b.x + b.w / 2, H / 2, b.y + b.h / 2);
      return withColor(g, col);
    };
    for (const blk of this.world.blocks) {
      const key = `${Math.floor(blk.bx / 4)}_${Math.floor(blk.by / 4)}`;
      let L = chunks.get(key);
      if (!L) { L = { wall: [], prop: [], neon: [], ground: [] }; chunks.set(key, L); }
      const size = BLOCK - ROAD;
      const x0 = blk.bx * BLOCK + ROAD, z0 = blk.by * BLOCK + ROAD, mx = x0 + size / 2, mz = z0 + size / 2;
      const dist = DISTRICTS[blockDistrict(blk.bx, blk.by)], distWall = C(dist.wall);
      L.ground.push(box(size, 2, size, mx, 1, mz, "#8f8c86"), box(size - 8, 0.2, size - 8, mx, 2.1, mz, "#a09d96"));
      if (blk.kind === "city") L.ground.push(box(size - 32, 0.4, size - 32, mx, 2.3, mz, dist.ground));
      else if (blk.kind === "park") {
        L.ground.push(box(size - 20, 0.8, size - 20, mx, 2.5, mz, "#4c7a3a"), box(size * 0.45, 0.4, size * 0.4, x0 + size * 0.35, 3.0, z0 + size * 0.4, "#58853f"));
        L.ground.push(box(size - 20, 0.6, 12, mx, 3.0, mz, "#6b6350"), box(12, 0.6, size - 20, mx, 3.0, mz, "#6b6350"));
        L.prop.push(cyl(36, 38, 4, mx, 4, mz, "#b0aca2", 20)); L.neon.push(cyl(31, 31, 0.6, mx, 6.2, mz, "#1aa6c9", 20, 0.55)); L.prop.push(cyl(3, 4, 14, mx, 10, mz, "#d0ccdc", 8));
      } else if (blk.kind === "site") {
        L.ground.push(box(size - 20, 0.6, size - 20, mx, 2.4, mz, "#8a7556"));
        for (let k = 0; k < 6; k++) L.prop.push(box(14 + r() * 20, 6 + r() * 8, 10 + r() * 14, x0 + 40 + r() * (size - 80), 4, z0 + 40 + r() * (size - 80), r() < 0.5 ? "#9a8a6a" : "#7a6a52"));
        for (let k = 0; k < size; k += 30) L.prop.push(box(1.6, 12, 1.6, x0 + 6 + k, 8, z0 + 6, "#ff8a1a"), box(1.6, 12, 1.6, x0 + 6, 8, z0 + 6 + k, "#ff8a1a"));
      } else if (blk.kind === "lot" || blk.kind === "garage") {
        L.ground.push(box(size - 16, 0.4, size - 16, mx, 2.3, mz, "#4a4852"));
        for (let k = 0; k < 9; k++) L.ground.push(box(1.4, 0.2, 40, x0 + 30 + k * 36, 2.6, z0 + size - 40, "#e8e8ec"));
      } else if (blk.kind === "skate") {
        L.ground.push(box(size - 20, 0.6, size - 20, mx, 2.4, mz, "#b0aca4"));
        L.prop.push(cyl(48, 48, 1, mx, 2.8, mz, "#8f8b84", 24));
      } else L.ground.push(box(size - 24, 0.4, size - 24, mx, 2.3, mz, "#a8a49a"));
      for (const b of blk.buildings) {
        if (b.shell || Landmarks.owns(b)) continue; // walkable shops: interiors3d; town hall, tower, stadium: landmarks3d
        if (b.garage) {
          // parking garage: concrete decks with open bands
          const H = b.height * H_SCALE + 14, cx = b.x + b.w / 2, cz = b.y + b.h / 2;
          L.prop.push(box(b.w, H, b.h, cx, H / 2, cz, "#a9a59d"));
          for (const yy of [H * 0.25, H * 0.7]) L.prop.push(box(b.w + 0.4, H * 0.18, b.h + 0.4, cx, yy, cz, "#2a2a30"));
          L.prop.push(box(b.w + 2, 4, b.h + 2, cx, H + 2, cz, "#8f8b84"), box(b.w - 6, 0.4, b.h - 6, cx, H + 0.3, cz, "#4a4852"));
          for (let k = 0; k < 6; k++) L.ground.push(box(1.2, 0.2, 30, b.x + 30 + k * 44, H + 0.6, cz, "#e8e8ec"));
          continue;
        }
        const H = b.height * H_SCALE + 14, cx = b.x + b.w / 2, cz = b.y + b.h / 2;
        const col = C(WALL_COLS[Math.floor(r() * WALL_COLS.length)]).clone().multiplyScalar(0.75 + r() * 0.3).lerp(distWall, dist.wallMix);
        L.wall.push(wallBox(b, H, col));
        // ground-floor storefront band, cornice and corner piers
        const dk = col.clone().multiplyScalar(0.62);
        L.prop.push(box(b.w + 0.8, 11, b.h + 0.8, cx, 6.5, cz, "#3a3f46"));
        L.prop.push(box(b.w + 2.4, 2.2, b.h + 2.4, cx, H - 1.1, cz, dk));
        for (const [px, pz] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) L.prop.push(box(3.2, H, 3.2, px, H / 2, pz, dk));
        L.prop.push(box(b.w - 4, 1.6, b.h - 4, cx, H + 0.8, cz, col.clone().multiplyScalar(0.55)));
        L.prop.push(box(b.w, 3, 1.5, cx, H + 1.5, b.y + 0.75, col), box(b.w, 3, 1.5, cx, H + 1.5, b.y + b.h - 0.75, col), box(1.5, 3, b.h, b.x + 0.75, H + 1.5, cz, col), box(1.5, 3, b.h, b.x + b.w - 0.75, H + 1.5, cz, col));
        const s = Math.min(b.w, b.h);
        if (b.detail === 0) { L.prop.push(box(s * 0.16, 8, s * 0.12, b.x + b.w * 0.3, H + 5, b.y + b.h * 0.3, "#b9b9c8"), box(s * 0.2, 10, s * 0.16, b.x + b.w * 0.68, H + 6, b.y + b.h * 0.62, "#a6a6b6")); }
        else if (b.detail === 1 && s > 100) {
          L.prop.push(cyl(s * 0.3, s * 0.3, 1.5, cx, H + 2.4, cz, "#2b2b33", 24));
          L.neon.push(withColor(new THREE.RingGeometry(s * 0.24, s * 0.26, 32).rotateX(-Math.PI / 2).translate(cx, H + 3.3, cz), C("#ffd23f"), 1.6));
          L.neon.push(box(s * 0.04, 0.4, s * 0.22, cx - s * 0.07, H + 3.3, cz, "#ffd23f", 1.6), box(s * 0.04, 0.4, s * 0.22, cx + s * 0.07, H + 3.3, cz, "#ffd23f", 1.6), box(s * 0.14, 0.4, s * 0.04, cx, H + 3.3, cz, "#ffd23f", 1.6));
        } else if (b.detail === 2 && s > 70) { L.prop.push(box(b.w * 0.56, 2, b.h * 0.42, cx, H + 2.2, cz, "#e8e4f0")); L.neon.push(box(b.w * 0.5, 0.5, b.h * 0.36, cx, H + 3.3, cz, "#22c4ee", 1.1)); }
        else { L.prop.push(cyl(s * 0.09, s * 0.09, 14, b.x + b.w * 0.7, H + 10, b.y + b.h * 0.3, "#6b5a4a", 10), box(1.5, 46, 1.5, b.x + b.w * 0.3, H + 23, b.y + b.h * 0.65, "#555")); L.neon.push(box(3, 3, 3, b.x + b.w * 0.3, H + 47, b.y + b.h * 0.65, "#ff2040", 2.5)); }
        this.facade(b, H, cx, cz, col, L, wallBox, r);
        const faces: [number, number, number, number][] = [[cx, b.y - 0.6, b.w * 0.8, 0], [cx, b.y + b.h + 0.6, b.w * 0.8, 0], [b.x - 0.6, cz, b.h * 0.8, 1], [b.x + b.w + 0.6, cz, b.h * 0.8, 1]];
        for (const [fx, fz, len, rot] of faces) {
          if (r() < 0.45) continue;
          const sc = SHOP[Math.floor(r() * SHOP.length)];
          if (rot) L.neon.push(box(0.8, 9, len, fx, 8.5, fz, sc, 0.9), box(1.2, 1.4, len + 2, fx, 14.5, fz, sc, 2.2));
          else L.neon.push(box(len, 9, 0.8, fx, 8.5, fz, sc, 0.9), box(len + 2, 1.4, 1.2, fx, 14.5, fz, sc, 2.2));
        }
      }
      for (const t of blk.trees) {
        if (t.kind === 0) { this.leafTree(L.prop, t.x, t.y, 0, t.r, r); continue; }
        const H = 42 + t.r * 2.2, lean = (r() - 0.5) * 6;
        L.prop.push(cyl(1.5, 2.6, H, t.x + lean * 0.5, H / 2 + 2, t.y, "#6b4a2e", 6));
        const top = H + 2;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + t.rot, len = 24 + t.r * 0.5;
          const g = new THREE.BoxGeometry(len, 0.8, 7); g.translate(len / 2, 0, 0); g.rotateZ(-0.5 - r() * 0.25); g.rotateY(a); g.translate(t.x + lean, top, t.y);
          L.prop.push(withColor(g, C(k % 2 ? "#2f8f4e" : "#3aa85c")));
        }
        L.prop.push(cyl(3.5, 3.5, 4, t.x + lean, top, t.y, "#4a3a22", 6));
      }
    }
    for (const L of chunks.values()) {
      const add = (geos: THREE.BufferGeometry[], mat: THREE.Material, cast: boolean, recv: boolean) => {
        if (!geos.length) return;
        const m = new THREE.Mesh(mergeGeometries(geos)!, mat);
        m.receiveShadow = recv; m.userData.cast = cast; m.castShadow = cast;
        this.scene.add(m); this.cityMeshes.push(m);
        for (const g of geos) g.dispose();
      };
      add(L.ground, groundMat, false, true); add(L.wall, wallMat, true, true); add(L.prop, propMat, true, true); add(L.neon, neonMat, false, false);
    }
    // palms on the island and along the promenade
    const T: THREE.BufferGeometry[] = [];
    for (const t of this.world.extraTrees) {
      const z0 = terrainH(t.x, t.y), H = 42 + t.r * 2.2, lean = (r() - 0.5) * 6;
      T.push(cyl(1.5, 2.6, H, t.x + lean * 0.5, z0 + H / 2, t.y, "#6b4a2e", 6));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + t.rot, len = 24 + t.r * 0.5;
        const g = new THREE.BoxGeometry(len, 0.8, 7); g.translate(len / 2, 0, 0); g.rotateZ(-0.5 - r() * 0.25); g.rotateY(a); g.translate(t.x + lean, z0 + H, t.y);
        T.push(withColor(g, C(k % 2 ? "#2f8f4e" : "#3aa85c")));
      }
    }
    if (T.length) { const tm = new THREE.Mesh(mergeGeometries(T)!, propMat); tm.castShadow = true; tm.userData.cast = true; this.scene.add(tm); this.cityMeshes.push(tm); for (const g of T) g.dispose(); }
    this.buildEdge();
  }

  // what makes the building types different (see Building.type): roofs, balconies, awnings, setbacks ...
  private facade(b: Building, H: number, cx: number, cz: number, col: THREE.Color, L: { wall: THREE.BufferGeometry[]; prop: THREE.BufferGeometry[]; neon: THREE.BufferGeometry[] }, wallBox: (b: Building, H: number, col: THREE.Color) => THREE.BufferGeometry, r: () => number) {
    const t = b.type ?? 0, dk = col.clone().multiplyScalar(0.6), lt = col.clone().lerp(new THREE.Color(1, 1, 1), 0.35);
    const long = b.w >= b.h; // balconies and awnings on the long sides
    const sides: [number, number, number, number][] = long ? [[cx, b.y, 1, 0], [cx, b.y + b.h, -1, 0]] : [[b.x, cz, 0, 1], [b.x + b.w, cz, 0, -1]]; // x, y, along-normal flags
    const len = long ? b.w : b.h;
    const onFace = (f: [number, number, number, number], u: number, w: number, h: number, d: number, y: number, c: string | THREE.Color, out = 0) => {
      // u: offset along the face, out: distance in front of the wall
      const [fx, fy, nyS, nxS] = f;
      const nx = nxS ? -nxS : 0, ny = nyS ? -nyS : 0; // outward normal
      if (long) L.prop.push(box(w, h, d, fx + u, y, fy + ny * (out + d / 2), c));
      else L.prop.push(box(d, h, w, fx + nx * (out + d / 2), y, fy + u, c));
    };
    const awnings = (cols: string[]) => { for (const f of sides) for (let u = -len / 2 + 16; u < len / 2 - 16; u += 34) onFace(f, u, 26, 1.2, 9, 15.5, cols[Math.floor(r() * cols.length)], 0); };
    const balconies = (every: number, from: number) => { for (const f of sides) for (let y = from; y < H - 10; y += every) for (let u = -len / 2 + 20; u < len / 2 - 14; u += 36) { onFace(f, u, 22, 1.2, 7, y, lt); onFace(f, u, 22, 4, 0.6, y + 2.6, "#e8e8ec", 6.6); } };
    const acUnits = () => { for (const f of sides) for (let k = 0; k < Math.min(10, H / 20); k++) onFace(f, (r() - 0.5) * (len - 20), 5, 4, 3, 24 + r() * (H - 34), "#c9ced8"); };
    const pitched = (h: number, c: string) => { const g = new THREE.ConeGeometry(Math.hypot(b.w, b.h) * 0.5, h, 4); g.rotateY(Math.PI / 4); g.scale(b.w / Math.hypot(b.w, b.h) * 1.45, 1, b.h / Math.hypot(b.w, b.h) * 1.45); g.translate(cx, H + h / 2 + 1, cz); L.prop.push(withColor(g, C(c))); };
    const setback = (k: number, h: number) => { const b2 = { ...b, x: cx - (b.w * k) / 2, y: cz - (b.h * k) / 2, w: b.w * k, h: b.h * k }; L.wall.push(wallBox(b2, h, col).translate(0, H, 0)); L.prop.push(box(b2.w + 2, 2, b2.h + 2, cx, H + h, cz, dk)); };
    switch (t) {
      case 0: // glass tower: blue tint, vertical mullions
        for (const f of sides) for (let u = -len / 2 + 8; u < len / 2; u += 16) onFace(f, u, 1, H - 12, 0.8, H / 2 + 6, "#b8c4cc");
        break;
      case 1: acUnits(); break; // office slab with AC units
      case 2: if (H > 80) { setback(0.72, H * 0.25); setback(0.45, H * 0.5); } break; // stepped tower
      case 3: if (H > 60) L.prop.push(cyl(Math.min(b.w, b.h) * 0.25, Math.min(b.w, b.h) * 0.3, 18, cx, H + 9, cz, "#3a3d45", 16)); L.neon.push(cyl(Math.min(b.w, b.h) * 0.26, Math.min(b.w, b.h) * 0.26, 1.2, cx, H + 17, cz, "#2bf0ff", 16, 1.2)); break; // tower with a lit crown
      case 4: for (const f of sides) for (let y = 30; y < H - 6; y += 18) onFace(f, 0, len - 6, 1.6, 1.2, y, dk); break; // stone office: cornice bands
      case 5: if (H > 70) setback(0.6, H * 0.18); break;
      case 6: pitched(18, "#8a4a32"); break; // old town house, tiled roof
      case 7: pitched(16, "#6a3a2a"); awnings(["#2d8a5a", "#c0392b", "#e1b12c"]); break;
      case 8: pitched(16, "#7a4a3a"); balconies(18, 30); break;
      case 9: for (const f of sides) for (let u = -len / 2 + 10; u <= len / 2 - 10; u += 20) onFace(f, u, 3, 13, 3, 6.5, lt, 6); for (const f of sides) onFace(f, 0, len, 1.5, 9, 13.5, lt); break; // arcade
      case 10: balconies(16, 26); break; // beach hotel
      case 11: balconies(18, 28); awnings(["#2bb3ff", "#ff6f91", "#f1c40f"]); break;
      case 12: awnings(["#2bb3ff", "#ffffff", "#ff8a3d"]); break;
      case 13: L.prop.push(box(b.w - 6, 4, b.h - 6, cx, H + 2, cz, "#7a7f88")); break; // warehouse with a vent ridge
      case 14: for (const f of sides) for (let u = -len / 2 + 22; u < len / 2 - 20; u += 40) onFace(f, u, 24, 20, 0.6, 10, "#5f666e", 0.1); break; // loading doors
      case 15: for (let k = 0; k < Math.floor(b.w / 30); k++) { const g = new THREE.CylinderGeometry(1, 1, b.h - 4, 3).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(15, 10, 1); g.translate(b.x + 15 + k * 30, H + 5, cz); L.prop.push(withColor(g, C("#8a8f98"))); } break; // sawtooth roof
      case 16: L.prop.push(cyl(5, 7, 60, b.x + b.w * 0.8, H + 30, b.y + b.h * 0.25, "#7a5a4a", 12), cyl(5.4, 5.4, 4, b.x + b.w * 0.8, H + 52, b.y + b.h * 0.25, "#c0392b", 12)); break; // chimney
      case 17: pitched(14, r() < 0.5 ? "#a85a3a" : "#5a5a62"); break; // house with a gable roof
      case 18: L.prop.push(box(b.w * 0.4, 12, 8, cx, 6, b.y + b.h + 4, lt), box(b.w * 0.36, 10, 0.6, cx, 6, b.y + b.h + 8.2, "#c9ced8")); break; // flat house with a garage
    }
  }

  // deciduous tree: trunk and a few overlapping crowns
  private leafTree(out: THREE.BufferGeometry[], x: number, y: number, z0: number, rad: number, r: () => number) {
    const H = 18 + rad * 1.1;
    out.push(cyl(1.6, 2.4, H, x, z0 + H / 2 + 2, y, "#5a3e26", 6));
    const greens = ["#3f6f2e", "#4c7d34", "#355f28", "#5a8a3a"];
    for (let k = 0; k < 4; k++) {
      const a = r() * 6.28, d = k ? rad * 0.45 : 0, s = rad * (k ? 0.75 : 1);
      const g = new THREE.SphereGeometry(s, 8, 6); g.scale(1, 0.85, 1); g.translate(x + Math.cos(a) * d, z0 + H + 2 + s * 0.4 + (k ? r() * 6 : 4), y + Math.sin(a) * d);
      out.push(withColor(g, C(greens[(k + Math.floor(r() * 4)) % 4])));
    }
  }

  // beach, harbour quay and promenade, everything outside the blocks
  private buildEdge() {
    const c = coastMesh(this.world);
    this.scene.add(c); this.cityMeshes.push(c);
    const fu = furnitureMesh(this.world);
    fu.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.userData.cast) this.cityMeshes.push(o as THREE.Mesh); });
    this.scene.add(fu);
    const e = extrasMesh(this.world);
    e.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.userData.cast) this.cityMeshes.push(o as THREE.Mesh); });
    this.scene.add(e);
    this.lightsMesh = new LightsMesh(new TrafficLights());
    this.scene.add(this.lightsMesh.group);
  }
  private lightsMesh: LightsMesh | null = null;
  private wallMat: THREE.MeshStandardMaterial | null = null; private neonMat: THREE.MeshBasicMaterial | null = null;
  private asphaltMat: THREE.MeshStandardMaterial | null = null; private lampHeadMat: THREE.MeshBasicMaterial | null = null; private lampPoolMat: THREE.MeshBasicMaterial | null = null;
  // day / night and wet streets on the shared materials
  private applyTime(g: Game) {
    const s = this.atm.state, n = s.night;
    if (this.wallMat) this.wallMat.emissiveIntensity = 0.08 + n * 0.85;
    if (this.neonMat) this.neonMat.color.setScalar(0.35 + n * 0.9);
    if (this.lampHeadMat) this.lampHeadMat.color.setRGB(0.5 + n * 1.3, 0.45 + n * 1.1, 0.35 + n * 0.75);
    if (this.lampPoolMat) this.lampPoolMat.opacity = 0.02 + n * 0.3;
    this.poolMat.opacity = 0.04 + n * 0.3; this.poolMatP.opacity = 0.1 + n * 0.4;
    this.head.intensity = n * 30 + (s.fog + s.rain) * 6;
    if (this.asphaltMat) { this.asphaltMat.roughness = 0.55 - s.wet * 0.42; this.asphaltMat.metalness = 0.15 + s.wet * 0.35; this.asphaltMat.color.setHex(0x46464b).multiplyScalar(1 - s.wet * 0.35); }
    this.renderer.toneMappingExposure = 1 - n * 0.15;
    void g;
  }

  // places outside the blocks: sign on a post, plus a jetty into the bay or a helipad
  private buildSpot(pl: Place, sign: THREE.Texture) {
    const col = new THREE.Color(pl.color).multiplyScalar(1.6);
    const gz = terrainH(pl.x, pl.y);
    const P: THREE.BufferGeometry[] = [cyl(1.2, 1.2, 34, pl.x + 14, gz + 17, pl.y - 30, "#c9ced8", 8)];
    if (pl.kind === "dock") {
      // wooden jetty from the beach into the water, with posts
      const x0 = JETTY.x1 + 10, x1 = JETTY.x0, len = x0 - x1;
      P.push(box(len, 2, JETTY.hw * 2, (x0 + x1) / 2, 1.5, JETTY.y, "#8a6a4a"));
      for (let x = x1 + 6; x < x0; x += 22) for (const dz of [-12, 12]) P.push(cyl(1.4, 1.4, 14, x, -4, JETTY.y + dz, "#5c4632", 6));
    } else if (pl.kind === "heliport") {
      // helipad: round slab with a big H
      const hx = HELI_SPOT.x, hy = HELI_SPOT.y, hz = terrainH(hx, hy);
      P.push(cyl(64, 66, 4, hx, hz + 1, hy, "#3a3d45", 32), box(10, 1, 44, hx - 12, hz + 3.3, hy, "#ffd23f"), box(10, 1, 44, hx + 12, hz + 3.3, hy, "#ffd23f"), box(14, 1, 9, hx, hz + 3.3, hy, "#ffd23f"));
    }
    const m = new THREE.Mesh(mergeGeometries(P)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    m.receiveShadow = true;
    this.scene.add(m);
    for (const g of P) g.dispose();
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(56, 14), new THREE.MeshBasicMaterial({ map: sign, toneMapped: false, side: THREE.DoubleSide }));
    panel.rotation.y = -Math.PI / 2;
    panel.position.set(pl.x + 14, gz + 36, pl.y - 30);
    this.scene.add(panel);
    const ring = new THREE.Mesh(new THREE.RingGeometry(9, 12, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
    ring.position.set(pl.x, gz + 0.5, pl.y); ring.renderOrder = 1;
    this.scene.add(ring);
  }

  // signs and entrance markers for hospital, police station, ...
  private buildPlaces(places: Place[]) {
    for (const pl of places) {
      const sign = canvasTex(512, 128, (g) => {
        g.fillStyle = "#f4f4f6"; g.fillRect(0, 0, 512, 128);
        g.fillStyle = pl.color; g.fillRect(0, 0, 128, 128);
        g.fillStyle = "#ffffff"; g.font = "bold 96px Inter, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(pl.icon, 64, 70);
        g.fillStyle = "#15161b"; g.textAlign = "left";
        let fs = 64;
        do { g.font = `bold ${fs}px 'Bebas Neue', Impact, sans-serif`; fs -= 2; } while (fs > 20 && g.measureText(pl.name.toUpperCase()).width > 340);
        g.fillText(pl.name.toUpperCase(), 150, 68);
      });
      const b = pl.bld, walk = WALKABLE.has(pl.id); // walkable shops: sign and door by interiors3d, the ring at the counter
      if (!b && !walk) { this.buildSpot(pl, sign); continue; }
      const col = new THREE.Color(pl.color).multiplyScalar(1.6);
      if (b && !walk) {
        const H = b.height * H_SCALE + 14;
        const w = Math.min(b.h - 10, 84);
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: sign, toneMapped: false }));
        panel.rotation.y = -Math.PI / 2;
        panel.position.set(b.x - 0.8, Math.min(H - w / 8 - 4, 46), pl.y);
        this.scene.add(panel);
        // roof symbol
        const symMat = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
        const cx = b.x + b.w / 2, cz = b.y + b.h / 2;
        const sym = pl.kind === "hospital"
          ? mergeGeometries([new THREE.BoxGeometry(10, 44, 10), new THREE.BoxGeometry(10, 10, 44).translate(0, 8, 0)])!
          : new THREE.CylinderGeometry(20, 20, 6, 5);
        const symMesh = new THREE.Mesh(sym, symMat);
        symMesh.position.set(cx, H + (pl.kind === "hospital" ? 22 : 4), cz);
        this.scene.add(symMesh);
      } else sign.dispose();
      // entrance ring on the sidewalk, a big one on the street for places you drive into
      const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
      if (pl.access === "foot" || pl.access === "both" || pl.access === "none") {
        const ring = new THREE.Mesh(new THREE.RingGeometry(9, 12, 32).rotateX(-Math.PI / 2), ringMat);
        ring.position.set(pl.x, walk ? 3.1 : 0.5, pl.y); ring.renderOrder = 1;
        this.scene.add(ring);
      }
      if (pl.access === "car" || pl.access === "both") {
        const ring = new THREE.Mesh(new THREE.RingGeometry(36, 42, 40).rotateX(-Math.PI / 2), ringMat);
        ring.position.set(pl.cx, walk ? 3.2 : 0.6, pl.cy); ring.renderOrder = 1;
        this.scene.add(ring);
      }
    }
  }

  resetCamera(yaw = this.camYaw) { this.camInit = false; this.camYaw = yaw; }
  cinematic: { x: number; y: number; z: number; a: number } | null = null;
  // falling over a cliff: the camera stays at the edge and looks down after you
  set fallCam(v: boolean) { this.fallFix = v ? this.camPos.clone() : null; }
  get fallCam() { return !!this.fallFix; }
  private fallFix: THREE.Vector3 | null = null;

  private buildLamps() {
    const pts: [number, number][] = [];
    for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) { const n = this.world.nodePos(i, j), o = ROAD / 2 + 6; pts.push([n.x - o, n.y - o], [n.x + o, n.y + o]); }
    const n = pts.length;
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.5, 52, 6).translate(0, 26, 0), new THREE.MeshStandardMaterial({ color: 0x3d3f45, roughness: 0.5, metalness: 0.6 }), n);
    this.lampHeadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 1.0), toneMapped: false });
    const headM = new THREE.InstancedMesh(new THREE.BoxGeometry(7, 2.4, 7).translate(0, 52, 0), this.lampHeadMat, n);
    const poolM = new THREE.InstancedMesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2).translate(0, 0.45, 0), this.lampPoolMat = new THREE.MeshBasicMaterial({ map: radialTex("rgba(255,190,120,0.9)", "rgba(255,160,80,0)"), transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false }), n);
    poolM.renderOrder = 1;
    const m = new THREE.Matrix4();
    pts.forEach(([x, z], i) => { m.makeTranslation(x, 0, z); pole.setMatrixAt(i, m); headM.setMatrixAt(i, m); poolM.setMatrixAt(i, m); });
    this.scene.add(pole, headM, poolM);
  }

  private buildShared() {
    this.bodyMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.2 });
    this.glassMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.06, envMapIntensity: 1.7 });
    this.wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.55 });
    this.wreckMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x2a2624, metalness: 0.2, roughness: 0.95 });
    this.dmgMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x8a7f78, metalness: 0.3, roughness: 0.8 });
    this.flashMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.5, 2.5), toneMapped: false });
    this.lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const cone = canvasTex(256, 192, (g) => {
      const gr = g.createRadialGradient(0, 96, 0, 0, 96, 256);
      gr.addColorStop(0, "rgba(255,240,210,0.9)"); gr.addColorStop(0.5, "rgba(255,230,190,0.3)"); gr.addColorStop(1, "rgba(255,230,190,0)");
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 86); g.lineTo(256, 0); g.lineTo(256, 192); g.lineTo(0, 106); g.closePath(); g.fill();
    });
    this.poolGeo = new THREE.PlaneGeometry(170, 128).rotateX(-Math.PI / 2).translate(24 + 85, 0.55, 0);
    this.poolMat = new THREE.MeshBasicMaterial({ map: cone, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false });
    this.poolMatP = this.poolMat.clone(); this.poolMatP.opacity = 0.3;
    this.shadowGeo = new THREE.PlaneGeometry(66, 40).rotateX(-Math.PI / 2).translate(0, 0.35, 0);
    this.rotorGeo = mergeGeometries([new THREE.BoxGeometry(80, 0.6, 3), new THREE.BoxGeometry(3, 0.6, 80)])!;
    this.rotorMat = new THREE.MeshStandardMaterial({ color: 0x15161b });
    this.shadowMat = new THREE.MeshBasicMaterial({ map: radialTex("rgba(0,0,0,0.85)", "rgba(0,0,0,0)"), transparent: true, depthWrite: false });
    this.glowGeo = new THREE.PlaneGeometry(80, 52).rotateX(-Math.PI / 2).translate(0, 0.6, 0);
    this.glowMat = new THREE.MeshBasicMaterial({ map: radialTex("rgba(255,60,172,1)", "rgba(255,60,172,0)"), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });

    // police decals
    const decal = canvasTex(256, 70, (g) => {
      g.clearRect(0, 0, 256, 70);
      g.fillStyle = "#0b1530"; g.fillRect(0, 26, 256, 18);
      g.fillStyle = "#ffffff"; g.font = "bold 44px 'Bebas Neue', Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("POLICE", 150, 36);
      g.fillStyle = "#ffd23f"; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 9 : 20; g.lineTo(36 + Math.cos(a) * rr, 35 + Math.sin(a) * rr); }
      g.closePath(); g.fill();
      g.fillStyle = "#0b1530"; g.font = "bold 12px Inter, sans-serif"; g.fillText("SBPD", 36, 60);
    });
    this.decalMat = new THREE.MeshBasicMaterial({ map: decal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const decalB = canvasTex(256, 70, (g) => {
      g.save(); g.translate(256, 0); g.scale(-1, 1);
      g.fillStyle = "#0b1530"; g.fillRect(0, 26, 256, 18);
      g.fillStyle = "#ffffff"; g.font = "bold 44px 'Bebas Neue', Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.restore();
      g.fillStyle = "#ffffff"; g.font = "bold 44px 'Bebas Neue', Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("POLICE", 106, 36);
      g.fillStyle = "#ffd23f"; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 9 : 20; g.lineTo(220 + Math.cos(a) * rr, 35 + Math.sin(a) * rr); }
      g.closePath(); g.fill();
    });
    this.decalMatB = new THREE.MeshBasicMaterial({ map: decalB, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const roofDecal = canvasTex(128, 64, (g) => { g.clearRect(0, 0, 128, 64); g.fillStyle = "#0b1530"; g.font = "bold 46px 'Bebas Neue', Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("S-07", 64, 34); });
    this.roofDecalMat = new THREE.MeshBasicMaterial({ map: roofDecal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });

    // pickups
    this.pickGeo.cash = mergeGeometries([box(22, 7, 13, 0, 0, 0, "#1f8a43"), box(22.4, 2, 13.4, 0, 0, 0, "#e8ffe8"), box(6, 7.4, 6, 0, 0, 0, "#e8ffe8")])!;
    this.pickGeo.repair = mergeGeometries([box(16, 16, 16, 0, 0, 0, "#f4f4f4"), box(4.5, 12, 16.6, 0, 0, 0, "#ff2a3a"), box(12, 4.5, 16.6, 0, 0, 0, "#ff2a3a"), box(16.6, 12, 4.5, 0, 0, 0, "#ff2a3a"), box(16.6, 4.5, 12, 0, 0, 0, "#ff2a3a")])!;
    this.pickGeo.nitro = mergeGeometries([cyl(5, 5, 18, 0, 0, 0, "#2bf0ff", 14), cyl(2, 2, 4, 0, 11, 0, "#c0c8d8", 8), cyl(5.2, 5.2, 3, 0, -4, 0, "#123a66", 14)])!;
    this.pickGeo.rocket = mergeGeometries([cyl(3, 3, 22, 0, 0, 0, "#5a6a4a", 10), cyl(0.5, 3, 6, 0, 14, 0, "#ff5a2a", 10), box(1, 5, 6, 0, -9, 0, "#ff9a2a"), box(6, 5, 1, 0, -9, 0, "#ff9a2a")])!;
    this.pickGeo.bomb = mergeGeometries([sph(7, 0, 0, 0, "#33343e"), box(3, 3, 3, 0, 7, 0, "#ff2040"), cyl(1, 1, 5, 0, 10, 0, "#888", 6)])!;
    const pm = (emi: number) => new THREE.MeshStandardMaterial({ vertexColors: true, emissive: emi, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.4 });
    this.pickMat.cash = pm(0x1aff6a); this.pickMat.repair = pm(0x553333); this.pickMat.nitro = pm(0x1aaacc); this.pickMat.rocket = pm(0x883300); this.pickMat.bomb = pm(0x661020);
    const beamTex = canvasTex(4, 128, (g) => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(255,255,255,1)"); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); });
    this.beamGeo = new THREE.CylinderGeometry(4, 6, 360, 10, 1, true).translate(0, 180, 0);
    const bm = (c: string) => new THREE.MeshBasicMaterial({ color: C(c), map: beamTex, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beamMat.cash = bm("#3dff8b"); this.beamMat.repair = bm("#ffffff"); this.beamMat.nitro = bm("#2bf0ff"); this.beamMat.rocket = bm("#ff9a2a"); this.beamMat.bomb = bm("#ff4d6d");

    // projectiles
    this.bulletGeo = new THREE.BoxGeometry(14, 1.2, 1.2);
    this.bulletMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 1.6), toneMapped: false });
    this.rocketGeo = mergeGeometries([withColor(new THREE.CylinderGeometry(2, 2, 16, 10).rotateZ(-Math.PI / 2), C("#6a7a5a")), withColor(new THREE.ConeGeometry(2, 5, 10).rotateZ(-Math.PI / 2).translate(10.5, 0, 0), C("#ff4a2a")), withColor(new THREE.BoxGeometry(4, 6, 0.6).translate(-6, 0, 0), C("#ff9a2a")), withColor(new THREE.BoxGeometry(4, 0.6, 6).translate(-6, 0, 0), C("#ff9a2a"))])!;
    this.rocketMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.4 });
    this.bombGeo = mergeGeometries([withColor(new THREE.SphereGeometry(3.5, 10, 8), C("#33343e")), withColor(new THREE.BoxGeometry(1.5, 1.5, 1.5).translate(0, 3.6, 0), C("#ff2040"))])!;
    this.bombMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.4 });
    this.bombLightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.5, 1), toneMapped: false });

    this.scene.add(this.smoke.points, this.glowPts.points);
    for (let i = 0; i < 8; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      ring.visible = false; ring.renderOrder = 3;
      this.scene.add(ring); this.rings.push(ring);
    }
    this.skidGeo.setAttribute("position", new THREE.BufferAttribute(this.skidPos, 3).setUsage(THREE.DynamicDrawUsage));
    const skids = new THREE.Mesh(this.skidGeo, new THREE.MeshBasicMaterial({ color: 0x050407, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    skids.frustumCulled = false; skids.renderOrder = 1;
    this.scene.add(skids);
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(6, 18, 8).rotateZ(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 1.1), toneMapped: false, transparent: true, opacity: 0.9 }));
    this.scene.add(this.arrow);

    // player character and the people close to the camera: skinned and animated (people3d.ts)
    this.ped = new PlayerFigure(this.scene, this.shadowGeo, this.shadowMat);
    this.landmarks = new Landmarks(this.world, this.scene);
    this.landmarks.group.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.userData.cast) this.cityMeshes.push(o as THREE.Mesh); });
    this.atm.setupMaterials(this.landmarks.group);
    this.rooms = new InteriorsRenderer(this.scene, this.interiorList, (model, color) => {
      if (!hasRig(model as CarModel)) return null;
      const rig = new CarRig(model as CarModel, color, this.carMats ??= carMaterials(), "SB · NEU");
      rig.root.rotation.y = 0.6;
      return rig.root;
    }, (o) => this.atm.setupMaterials(o));
    this.people = new CrowdFigures(this.scene, CROWD_RIGS[this.quality], this.quality !== "low", (o) => this.atm.setupMaterials(o));
    this.crowd = new CrowdRenderer(this.scene, MAX_PEDS, this.quality === "high", this.shadowGeo, this.shadowMat);
  }

  // ---------------------------------------------------------- per-frame
  private carMats: CarMats | null = null;
  // a realistic car: lofted body, doors, glass, interior, switchable lights (carmodel.ts)
  private makeRigCar(c: Car): CarObj {
    const mats = this.carMats ??= carMaterials();
    plateNo = plateNo >= 9999 ? 1000 : plateNo + 37;
    const rig = new CarRig(c.model, c.color, mats, `SB · ${plateNo}`);
    const s = rig.geo.shape, hi = this.quality === "high" || this.quality === "ultra";
    const group = rig.root, tilt = rig.tilt;
    group.rotation.order = "YXZ"; group.scale.setScalar(VEH_SCALE);
    rig.body.castShadow = this.quality !== "low"; rig.trim.castShadow = hi;
    if (rig.extra) rig.extra.castShadow = this.quality !== "low";
    for (const w of rig.wheels) for (const m of w.spin.children) m.castShadow = hi;
    const wheels: CarObj["wheels"] = rig.wheels.map((w) => ({ pivot: w.pivot, spin: w.spin, front: w.front, r: s.R, y: s.R }));
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.renderOrder = 1; shadow.scale.set(s.L / 50, 1, s.W / 30);
    const pool = new THREE.Mesh(this.poolGeo, c.kind === "player" ? this.poolMatP : this.poolMat);
    pool.renderOrder = 2;
    group.add(shadow, pool);
    const r = Math.abs(Math.sin(c.siren * 7.31));
    // a few fixed driver looks (their geometry is cached per car model, so the cache stays small)
    const dv = DRIVERS[Math.floor(r * 97) % DRIVERS.length];
    rig.setDriver(dv[0], c.kind === "cop" ? "#1f3a6e" : dv[1], dv[2]);
    const obj: CarObj = { group, tilt, body: rig.body, glass: rig.body, lights: rig.lights.head, pool, wheels, model: c.model, color: c.color, wreck: false, pitch: 0, roll: 0, spinA: 0, steerA: 0,
      rig, dentN: 0, glassV: -1, bumpers: 0, prevV: c.vF, brakeT: 0, wipe: 0, bounce: 0, bounceV: 0 };
    if (c.kind === "player") { obj.glow = new THREE.Mesh(this.glowGeo, this.glowMat); obj.glow.renderOrder = 2; group.add(obj.glow); }
    if (c.model === "police" || c.model === "swat" || c.model === "ambulance" || c.model === "fire") {
      const reds = new THREE.MeshBasicMaterial({ color: this.copRed.clone(), toneMapped: false });
      const blues = new THREE.MeshBasicMaterial({ color: this.copBlue.clone(), toneMapped: false });
      const white = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), toneMapped: false });
      const bx = s.box ? Math.min(s.box.x1, s.roofF) - 3 : (s.roofF + s.roofR) / 2 + 2, top = s.box ? Math.max(s.roof, s.box.h) : s.roof;
      const housing = new THREE.Mesh(this.unitBox, mats.trim); housing.scale.set(3.6, 0.6, s.W * 0.66); housing.position.set(bx, top + 0.35, 0); tilt.add(housing);
      for (let i = 0; i < 6; i++) {
        const z = (-2.5 + i) * s.W * 0.11;
        const seg = new THREE.Mesh(this.barSeg, i < 2 ? reds : i > 3 ? blues : white);
        seg.scale.set(0.9, 0.7, s.W * 0.04);
        seg.position.set(bx, top + 1.3, z);
        tilt.add(seg);
      }
      if (c.model === "police") {
        const sy = s.belt - 3.2, sz = s.W / 2 + 0.12;
        const d1 = new THREE.Mesh(this.decalGeo, this.decalMat); d1.scale.set(0.9, 0.7, 1); d1.position.set(-2, sy, sz); tilt.add(d1);
        const d2 = new THREE.Mesh(this.decalGeo, this.decalMatB); d2.scale.set(0.9, 0.7, 1); d2.position.set(-2, sy, -sz); d2.rotation.y = Math.PI; tilt.add(d2);
        const d3 = new THREE.Mesh(this.unitPlane, this.roofDecalMat); d3.scale.set(10, 5, 1); d3.rotation.x = -Math.PI / 2; d3.rotation.z = -Math.PI / 2; d3.position.set(bx - 7, s.roof + 0.16, 0); tilt.add(d3);
        const hx = (s.cowlX + s.L / 2) / 2;
        const d4 = new THREE.Mesh(this.unitPlane, this.roofDecalMat); d4.scale.set(9, 4.5, 1); d4.rotation.x = -Math.PI / 2; d4.rotation.z = -Math.PI / 2; d4.position.set(hx, topAt(s, hx) + 0.55, 0); tilt.add(d4);
      }
      obj.bar = { reds, blues, white };
    }
    this.scene.add(group);
    this.atm.setupMaterials(group);
    return obj;
  }

  private makeCar(c: Car): CarObj {
    if (hasRig(c.model)) return this.makeRigCar(c);
    const geo = getCarGeo(c.model, c.color);
    const group = new THREE.Group();
    group.rotation.order = "YXZ"; group.scale.setScalar(VEH_SCALE);
    const tilt = new THREE.Group();
    group.add(tilt);
    const body = new THREE.Mesh(geo.body, this.bodyMat);
    body.castShadow = this.quality === "high";
    const glass = new THREE.Mesh(geo.glass, this.glassMat);
    const lights = new THREE.Mesh(geo.lights, this.lightMat);
    tilt.add(body, glass, lights);
    const wheels: CarObj["wheels"] = [];
    for (const w of geo.wheels) {
      const pivot = new THREE.Group();
      pivot.position.set(w.x, w.r, w.z);
      const spin = new THREE.Mesh(getWheelGeo(w.r, w.wd), this.wheelMat);
      spin.castShadow = this.quality === "high";
      pivot.add(spin);
      tilt.add(pivot);
      wheels.push({ pivot, spin, front: w.front, r: w.r, y: w.r });
    }
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.renderOrder = 1;
    const pool = new THREE.Mesh(this.poolGeo, c.kind === "player" ? this.poolMatP : this.poolMat);
    pool.renderOrder = 2;
    group.add(shadow, pool);
    const obj: CarObj = { group, tilt, body, glass, lights, pool, wheels, model: c.model, color: c.color, wreck: false, pitch: 0, roll: 0, spinA: 0, steerA: 0, dentN: 0, glassV: 0, bumpers: 0, prevV: 0, brakeT: 0, wipe: 0, bounce: 0, bounceV: 0 };
    if (c.kind === "player") { obj.glow = new THREE.Mesh(this.glowGeo, this.glowMat); obj.glow.renderOrder = 2; group.add(obj.glow); }
    if (isHeli(c.model)) { obj.rotor = new THREE.Mesh(this.rotorGeo, this.rotorMat); obj.rotor.position.y = 27; tilt.add(obj.rotor); shadow.visible = false; }
    if (isBoat(c.model)) { shadow.visible = false; pool.visible = false; }
    if (isTwoWheel(c.model)) shadow.scale.set(0.6, 1, 0.35);
    else if (c.model === "bus" || c.model === "truck") shadow.scale.set(1.5, 1, 1.15);
    if (c.model === "police" || c.model === "swat" || c.model === "ambulance" || c.model === "fire") {
      const reds = new THREE.MeshBasicMaterial({ color: this.copRed.clone(), toneMapped: false });
      const blues = new THREE.MeshBasicMaterial({ color: this.copBlue.clone(), toneMapped: false });
      const white = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), toneMapped: false });
      for (let i = 0; i < 6; i++) {
        const z = -7.5 + i * 3;
        const mat = i < 2 ? reds : i > 3 ? blues : white;
        const seg = new THREE.Mesh(this.barSeg, mat);
        seg.position.set(-3, geo.roofY + 1.5, z);
        tilt.add(seg);
      }
      if (c.model === "police") {
        const d1 = new THREE.Mesh(this.decalGeo, this.decalMat); d1.position.set(-1, 8.2, 12.65); tilt.add(d1);
        const d2 = new THREE.Mesh(this.decalGeo, this.decalMatB); d2.position.set(-1, 8.2, -12.65); d2.rotation.y = Math.PI; tilt.add(d2);
        const d3 = new THREE.Mesh(this.unitPlane, this.roofDecalMat); d3.scale.set(12, 6, 1); d3.rotation.x = -Math.PI / 2; d3.rotation.z = -Math.PI / 2; d3.position.set(-3, geo.roofY + 0.05, 0); tilt.add(d3);
        const d4 = new THREE.Mesh(this.unitPlane, this.roofDecalMat); d4.scale.set(12, 6, 1); d4.rotation.x = -Math.PI / 2; d4.rotation.z = -Math.PI / 2; d4.position.set(14, 12.15, 0); tilt.add(d4);
      }
      obj.bar = { reds, blues, white };
    }
    this.scene.add(group);
    this.atm.setupMaterials(group);
    return obj;
  }

  private disposeCar(o: CarObj) {
    this.scene.remove(o.group);
    o.rig?.dispose();
    if (o.bar) { o.bar.reds.dispose(); o.bar.blues.dispose(); o.bar.white.dispose(); }
  }

  private syncCars(g: Game, dt: number) {
    const seen = this.seenCars;
    seen.clear();
    const t = g.t;
    for (const c of g.cars) {
      seen.add(c);
      let o = this.carObjs.get(c);
      if (o && (o.model !== c.model || o.color !== c.color || (o.wreck && !c.dead) || c.dents.length < o.dentN * 3 || (o.bumpers & ~c.bumpers) !== 0)) { this.disposeCar(o); o = undefined; }
      if (!o) { o = this.makeCar(c); this.carObjs.set(c, o); }
      o.group.position.set(c.x, c.z + (c === g.player && !g.onFoot ? this.rooms.liftY : 0), c.y);
      // terrain tilt
      let tp = 0, tr = 0;
      if (!inCity(c.x, c.y) && !isCraft(c.model)) {
        const gr = terrainGrad(c.x, c.y, 10);
        const ca = Math.cos(c.a), sa = Math.sin(c.a);
        tp = Math.atan(gr.x * ca + gr.y * sa);
        tr = -Math.atan(-gr.x * sa + gr.y * ca);
      }
      if (c.air) tp = Math.atan2(c.vz, Math.max(60, c.speed)) * 0.6;
      const k = Math.min(1, dt * (c.air ? 3 : 12));
      o.pitch += (tp - o.pitch) * k; o.roll += (tr - o.roll) * k;
      o.group.rotation.set(o.roll, -c.a, o.pitch);
      if (isHeli(c.model)) {
        // nose down when flying forward, bank into turns, spinning rotor
        o.tilt.rotation.z = clamp(-c.vF / 1400, -0.3, 0.2);
        o.tilt.rotation.x = clamp(-c.av * 0.12, -0.3, 0.3);
        if (o.rotor) o.rotor.rotation.y = c.rotor;
      } else if (isBoat(c.model)) {
        o.tilt.rotation.z = clamp(c.vF / 2600, -0.05, 0.16) + Math.sin(t * 2.1 + c.x * 0.01) * 0.02; // bow up when fast
        o.tilt.rotation.x = clamp(-c.av * 0.06, -0.15, 0.15) + Math.sin(t * 1.7 + c.y * 0.01) * 0.02;
      } else if (isTwoWheel(c.model)) {
        // lean into the curve; the rider is only there when somebody rides it
        o.tilt.rotation.x = clamp(-c.av * Math.min(1, c.speed / 250) * 0.22, -0.55, 0.55);
        o.glass.visible = c === g.player ? false : c.kind !== "civ" || c.driver; // the player rides as the full figure
      } else o.tilt.rotation.x = clamp(-c.vR / 900, -0.09, 0.09);
      if (!isCraft(c.model)) o.tilt.rotation.z = c.dead ? 0 : c.throttle > 0 ? 0.025 * c.throttle : c.throttle < 0 && c.vF > 50 ? -0.04 : 0;
      o.pool.visible = !c.air && !c.dead && !isBoat(c.model);
      if (o.rig) this.updateRig(g, c, o, dt);
      else if (c.dead && !o.wreck) {
        o.wreck = true; o.body.material = this.wreckMat; o.glass.material = this.wreckMat; o.lights.visible = false; o.pool.visible = false;
        if (o.glow) o.glow.visible = false;
        if (o.bar) { o.bar.reds.color.setScalar(0.1); o.bar.blues.color.setScalar(0.1); o.bar.white.color.setScalar(0.1); }
      }
      if (o.rig) { /* see updateRig */ }
      else if (!o.wreck) {
        // badly damaged cars look scorched and dull
        o.body.material = c.hitFlash > 0.07 ? this.flashMat : c.hp < c.maxHp * 0.4 ? this.dmgMat : this.bodyMat;
        if (o.glow) { o.glow.visible = !g.onFoot; (o.glow.material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(t * 4) * 0.15 + (c.nitro ? 0.3 : 0); }
        if (o.bar) {
          const on = (c.kind === "cop" && !c.calm) || c === g.player;
          const ph = Math.sin(t * 16 + c.siren) > 0;
          const ph2 = Math.sin(t * 32 + c.siren) > 0;
          o.bar.reds.color.copy(this.copRed).multiplyScalar(on ? (ph ? 4 : 0.25) : 0.3);
          o.bar.blues.color.copy(this.copBlue).multiplyScalar(on ? (ph ? 0.25 : 4) : 0.3);
          o.bar.white.color.setScalar(on && ph2 ? 3 : 0.4);
        }
      }
      if (o.glow) o.glow.visible = false;
      // wheels: roll with speed, front wheels follow the steering
      const steerTarget = c.dead ? 0 : clamp(-c.steer, -1, 1) * 0.5;
      o.steerA += (steerTarget - o.steerA) * Math.min(1, dt * 14);
      o.spinA += (c.dead ? 0 : c.vF) * dt;
      for (const w of o.wheels) { if (w.front) w.pivot.rotation.y = o.steerA; w.spin.rotation.z = -o.spinA / (w.r * VEH_SCALE); }
      if (o.rig) o.rig.steering.rotation.x = -o.steerA * 3.2; // the steering wheel turns about 3 times as far as the wheels
    }
    for (const [c, o] of this.carObjs) if (!seen.has(c)) { this.disposeCar(o); this.carObjs.delete(c); }
  }

  // lights, doors, glass, dents, suspension, driver and detail level of a realistic car
  private updateRig(g: Game, c: Car, o: CarObj, dt: number) {
    const rig = o.rig!, m = this.carMats!, st = this.atm.state, t = g.t;
    const d = Math.hypot(c.x - this.camPos.x, c.y - this.camPos.z);
    rig.setLod(d < 260 ? 0 : d < 900 ? 1 : 2);
    if (c.dead) {
      if (!o.wreck) {
        o.wreck = true; rig.wreck(); o.pool.visible = false;
        if (o.glow) o.glow.visible = false;
        if (o.bar) { o.bar.reds.color.setScalar(0.1); o.bar.blues.color.setScalar(0.1); o.bar.white.color.setScalar(0.1); }
        for (const k of ["head", "tail", "brake", "rev", "indL", "indR"] as const) rig.lights[k].material = k === "head" || k === "rev" ? m.headOff : m.offLens;
        rig.driver.visible = false;
      }
      return;
    }
    // paint: scratched and dull when badly damaged, a short flash when hit
    rig.setPaint(c.color, c.hp < c.maxHp * 0.45 || c.dents.length >= 12);
    if (c.hitFlash > 0.07) { rig.body.material = this.flashMat; }
    // dents where the car was hit (only new ones are added)
    while (o.dentN * 3 < c.dents.length) { const i = o.dentN * 3; rig.dent(c.dents[i] / VEH_SCALE, c.dents[i + 1] / VEH_SCALE, c.dents[i + 2]); o.dentN++; }
    if (o.glassV !== c.glassV) { o.glassV = c.glassV; rig.setGlass((id) => (c.glass[id] ?? 0) as 0 | 1 | 2); }
    if (c.bumpers & 1 && !(o.bumpers & 1)) { rig.dropBumper(true); o.bumpers |= 1; }
    if (c.bumpers & 2 && !(o.bumpers & 2)) { rig.dropBumper(false); o.bumpers |= 2; }
    // who sits inside: traffic and police drivers, the player (not in first person)
    const isP = c === g.player;
    // the player sits there as the full figure (PlayerFigure); traffic and police drivers are simple figures
    rig.driver.visible = rig.lod < 2 && !isP && (c.kind === "cop" || (c.kind === "civ" && (c.driver || (!c.parked && c.speed > 5))));
    if (rig.driver.visible && c.faction && !o.gangDriver) { o.gangDriver = true; rig.setDriver("#a86b45", c.faction === "halcones" ? "#c0392b" : "#8e44ad", "#16100c"); }
    // lights: dipped beam at night and in bad weather, brake lights when slowing down, reversing light, indicators, hazards
    const occupied = isP ? !g.onFoot : c.kind === "cop" || !c.parked;
    const lightsOn = occupied && (st.day < 0.55 || st.rain > 0.3 || st.fog > 0.3);
    const decel = (o.prevV - c.vF) / Math.max(dt, 1e-3);
    o.prevV = c.vF;
    if (occupied && ((c.throttle < -0.05 && c.vF > 15) || (c.handbrake && c.speed > 10) || (decel > 140 && c.vF > 10) || (c.speed < 4 && !isP && !c.parked))) o.brakeT = 0.25;
    else o.brakeT = Math.max(0, o.brakeT - dt);
    o.pool.visible = o.pool.visible && lightsOn;
    rig.lights.head.material = lightsOn ? m.headOn : m.headOff;
    rig.lights.tail.material = lightsOn ? m.tailOn : m.tailDim;
    rig.lights.brake.material = o.brakeT > 0 ? m.brakeOn : m.offLens;
    rig.lights.rev.material = occupied && c.vF < -8 && c.throttle < 0 ? m.revOn : m.headOff;
    const blink = c.alarmT > 0 || (c.wrecked && c.kind === "civ") ? 2 : c.blink, on = Math.floor(t * 2.6) % 2 === 0;
    rig.lights.indL.material = on && (blink === -1 || blink === 2) ? m.indOn : m.offLens;
    rig.lights.indR.material = on && (blink === 1 || blink === 2) ? m.indOn : m.offLens;
    // wipers in the rain
    if (occupied && st.rain > 0.15) o.wipe += dt * 2.4; else if (o.wipe % Math.PI > 0.05) o.wipe += dt * 2.4; else o.wipe = 0;
    const wa = -Math.abs(Math.sin(o.wipe)) * 1.45;
    for (const w of rig.wipers) w.rotation.y = wa;
    // doors swing open and shut
    for (let i = 0; i < rig.doors.length; i++) {
      const dr = rig.doors[i];
      dr.target = c.doors[i] ?? 0;
      dr.open += (dr.target - dr.open) * Math.min(1, dt * 7);
      dr.pivot.rotation.y = dr.side * dr.open * 1.15;
    }
    // suspension: the body bounces on landing and over bumps; flat tyres sit lower
    const ground = c.air ? 0 : 1;
    o.bounceV += (-o.bounce * 160 - o.bounceV * 14) * dt;
    if (c.vz < -120 && !c.air) o.bounceV -= Math.min(30, -c.vz * 0.05);
    o.bounce += o.bounceV * dt;
    rig.tilt.position.y = clamp(o.bounce, -1.6, 1.2) * ground;
    for (const w of o.wheels) w.pivot.position.y = w.y - (c.flat ? w.r * 0.22 : 0) - (c.air ? 0.8 : 0);
  }

  // where the player figure sits in the current vehicle (null: not shown inside, e.g. boats and helicopters)
  private seatOf(g: Game) {
    if (g.onFoot) return null;
    const p = g.player, o = this.carObjs.get(p);
    if (!o) return null;
    if (o.rig) return { host: o.tilt, seat: o.rig.geo.seat, ride: false, steer: p.steer };
    if (isTwoWheel(p.model)) {
      const seat: [number, number, number] = p.model === "bicycle" ? [-2.5, 13.4, 0] : p.model === "scooter" ? [-5, 12.3, 0] : [-5, 17.4, 0];
      return { host: o.tilt, seat, ride: true, steer: p.steer };
    }
    return null;
  }

  private syncPickups(g: Game) {
    const seen = new Set<Pickup>();
    for (const pk of g.pickups) {
      seen.add(pk);
      let o = this.pickObjs.get(pk);
      if (!o) {
        o = new THREE.Group();
        const m = new THREE.Mesh(this.pickGeo[pk.type]!, this.pickMat[pk.type]!);
        const s = pk.type === "cash" ? (pk.value >= 500 ? 1.5 : pk.value >= 250 ? 1.2 : 1) : 1;
        m.scale.setScalar(s);
        const beam = new THREE.Mesh(this.beamGeo, this.beamMat[pk.type]!);
        beam.renderOrder = 3;
        o.add(m, beam);
        o.position.set(pk.x, terrainH(pk.x, pk.y), pk.y);
        this.scene.add(o);
        this.pickObjs.set(pk, o);
      }
      const m = o.children[0];
      m.position.y = 16 + Math.sin(pk.t * 4) * 3;
      m.rotation.y = pk.t * 2;
      o.children[1].visible = g.state !== "menu";
    }
    for (const [pk, o] of this.pickObjs) if (!seen.has(pk)) { this.scene.remove(o); this.pickObjs.delete(pk); }
  }

  private syncProjs(g: Game) {
    const seen = this.seenProjs;
    seen.clear();
    for (const q of g.projs) {
      seen.add(q);
      let o = this.projObjs.get(q);
      if (!o) { o = new THREE.Mesh(this.bulletGeo, this.bulletMat); this.scene.add(o); this.projObjs.set(q, o); }
      // projectiles are pooled: the same object can come back as another kind
      if (q.kind === "bullet") { o.geometry = this.bulletGeo; o.material = q.from === "enemy" ? this.enemyBulletMat : this.bulletMat; }
      else if (q.kind === "rocket") { o.geometry = this.rocketGeo; o.material = this.rocketMat; }
      else if (q.kind === "grenade") { o.geometry = this.bombGeo; o.material = this.grenadeMat; }
      else { o.geometry = this.bombGeo; o.material = this.bombMat; }
      o.position.set(q.x, q.z, q.y);
      const a = Math.atan2(q.vy, q.vx);
      o.rotation.set(0, -a, q.kind === "bomb" || q.kind === "grenade" ? g.t * 8 : Math.atan2(q.vz, Math.hypot(q.vx, q.vy)));
    }
    for (const [q, o] of this.projObjs) if (!seen.has(q)) { this.scene.remove(o); this.projObjs.delete(q); }
    const seenB = this.seenBombs;
    seenB.clear();
    for (const b of g.bombs) {
      seenB.add(b);
      let o = this.bombObjs.get(b);
      if (!o) {
        o = new THREE.Mesh(this.bombGeo, this.bombMat);
        const light = new THREE.Mesh(new THREE.SphereGeometry(1.2, 6, 6), this.bombLightMat);
        light.position.y = 4.4;
        o.add(light);
        this.scene.add(o);
        this.bombObjs.set(b, o);
      }
      o.position.set(b.x, b.z, b.y);
      o.children[0].visible = Math.sin(b.t * 10) > 0;
    }
    for (const [b, o] of this.bombObjs) if (!seenB.has(b)) { this.scene.remove(o); this.bombObjs.delete(b); }
  }

  private syncSkids(g: Game) {
    if (g.skidTotal < this.skidSeen) { this.skidPos.fill(0); this.skidSeen = 0; (this.skidGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true; }
    let n = g.skidTotal - this.skidSeen;
    if (n <= 0) return;
    if (n > MAX_SKIDS) n = MAX_SKIDS;
    const P = this.skidPos;
    for (let k = 0; k < n; k++) {
      const idx = (g.skidTotal - n + k) % MAX_SKIDS, s = idx * 4;
      const x1 = g.skids[s], y1 = g.skids[s + 1], x2 = g.skids[s + 2], y2 = g.skids[s + 3];
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), o = idx * 18;
      if (L < 0.01 || L > 60) { P.fill(0, o, o + 18); continue; }
      const nx = (-dy / L) * 2, ny = (dx / L) * 2;
      const Y1 = terrainH(x1, y1) + 0.3, Y2 = terrainH(x2, y2) + 0.3;
      const v = [x1 + nx, Y1, y1 + ny, x1 - nx, Y1, y1 - ny, x2 + nx, Y2, y2 + ny, x2 + nx, Y2, y2 + ny, x1 - nx, Y1, y1 - ny, x2 - nx, Y2, y2 - ny];
      for (let q = 0; q < 18; q++) P[o + q] = v[q];
    }
    this.skidSeen = g.skidTotal;
    (this.skidGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private syncParticles(g: Game) {
    this.smoke.begin(); this.glowPts.begin();
    let ri = 0;
    for (const q of g.particles) {
      const k = q.life / q.max, c = C(q.color);
      switch (q.type) {
        case 0: this.smoke.push(q.x, q.z, q.y, c, k * 0.5, q.size * 2.2); break;
        case 3: this.smoke.push(q.x, q.z, q.y, c, Math.min(1, k * 2), q.size * 1.6); break;
        case 1: this.glowPts.push(q.x, q.z, q.y, c, k, q.size * 2.4, 2.5); break;
        case 2: this.glowPts.push(q.x, q.z, q.y, c, k * 0.9, q.size * 2.6, 1.8); break;
        case 5: this.glowPts.push(q.x, q.z, q.y, c, k, q.size * 2, 1.6); break;
        case 4: {
          const r = this.rings[ri++]; if (!r) break;
          r.visible = true; r.position.set(q.x, q.z + 1, q.y); r.scale.setScalar(Math.max(1, q.size));
          const m = r.material as THREE.MeshBasicMaterial; m.color.copy(c).multiplyScalar(2); m.opacity = k * 0.85;
          break;
        }
      }
    }
    for (; ri < this.rings.length; ri++) this.rings[ri].visible = false;
    this.smoke.end(); this.glowPts.end();
  }

  private syncLights(g: Game) {
    const p = g.player;
    const ca = Math.cos(p.a), sa = Math.sin(p.a);
    this.head.visible = !p.dead && !g.playerCarStored;
    this.head.position.set(p.x + ca * 22, p.z + 13, p.y + sa * 22);
    this.head.target.position.set(p.x + ca * 220, p.z - 10, p.y + sa * 220);
    this.head.target.updateMatrixWorld();
    let li = 0;
    for (const f of g.flashes) {
      if (li >= this.plights.length) break;
      const l = this.plights[li++], k = f.life / f.max;
      l.color.setRGB(1, 0.55, 0.2); l.intensity = 30 * k * (f.size / 520); l.distance = f.size * 0.9; l.position.set(f.x, f.z + 20, f.y);
    }
    // nearest active cops (reused array, insertion sort keeps it small)
    const cops = this.nearCops;
    cops.length = 0;
    const d2 = (c: Car) => (c.x - g.fx) ** 2 + (c.y - g.fy) ** 2;
    for (const c of g.cars) {
      if (c.kind !== "cop" || c.dead || c.calm) continue;
      let i = cops.length;
      if (i >= this.plights.length && d2(c) >= d2(cops[i - 1])) continue;
      while (i > 0 && d2(cops[i - 1]) > d2(c)) i--;
      cops.splice(i, 0, c);
      if (cops.length > this.plights.length) cops.length = this.plights.length;
    }
    for (const c of cops) {
      if (li >= this.plights.length) break;
      const l = this.plights[li++];
      const ph = Math.sin(g.t * 16 + c.siren) > 0;
      l.color.copy(ph ? this.copRed : this.copBlue); l.intensity = 13; l.distance = 230; l.position.set(c.x, c.z + 34, c.y);
    }
    for (; li < this.plights.length; li++) this.plights[li].intensity = 0;
  }

  private syncArrow(g: Game) {
    // open world: points along the GPS route to the goal; arcade modes: to the nearest cash
    let tx = 0, ty = 0, bd = Infinity, found = false;
    if (g.state === "playing" && !g.ending) {
      if (g.rules.city) {
        if (g.nav && g.routeN > 1) {
          // first route point that is not right under us
          for (let i = 1; i < g.routeN; i++) { tx = g.route[i * 2]; ty = g.route[i * 2 + 1]; if (Math.hypot(tx - g.fx, ty - g.fy) > 120 || i === g.routeN - 1) break; }
          bd = Math.hypot(g.nav.x - g.fx, g.nav.y - g.fy); found = true;
          (this.arrow.material as THREE.MeshBasicMaterial).color.set(g.nav.color).multiplyScalar(2);
        }
      } else {
        for (const pk of g.pickups) { if (pk.type !== "cash") continue; const d = Math.hypot(pk.x - g.fx, pk.y - g.fy); if (d < bd) { bd = d; tx = pk.x; ty = pk.y; found = true; } }
      }
    }
    if (!found || bd < 160 || this.camMode === "fp") { this.arrow.visible = false; return; }
    this.arrow.visible = true;
    const a = Math.atan2(ty - g.fy, tx - g.fx);
    const r = this.camMode === "chase" ? 0 : 62;
    this.arrow.position.set(g.fx + Math.cos(a) * r, g.fz + (this.camMode === "chase" ? 42 : 30) + Math.sin(g.t * 5) * 2.5, g.fy + Math.sin(a) * r);
    this.arrow.rotation.set(0, -a, 0);
  }

  // mission / job goals: light beam + ring; shells and stunt jump signs (only near the player)
  private markerObjs: { beam: THREE.Mesh; ring: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private shellMesh: THREE.InstancedMesh | null = null;
  private jumpMesh: THREE.InstancedMesh | null = null;
  private buildMarkers() {
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 260, 14, 1, true).translate(0, 130, 0), mat);
      const ring = new THREE.Mesh(new THREE.RingGeometry(20, 26, 36).rotateX(-Math.PI / 2), mat);
      beam.visible = ring.visible = false; beam.renderOrder = ring.renderOrder = 3;
      this.scene.add(beam, ring);
      this.markerObjs.push({ beam, ring, mat });
    }
    const shellGeo = mergeGeometries([withColor(new THREE.ConeGeometry(5, 7, 9).rotateX(Math.PI).translate(0, 4, 0), C("#ffe2b8")), withColor(new THREE.SphereGeometry(3.4, 10, 8).scale(1.3, 0.6, 1).translate(0, 7.5, 0), C("#ffb3c6"))])!;
    this.shellMesh = new THREE.InstancedMesh(shellGeo, new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xff9f7a, emissiveIntensity: 0.6, roughness: 0.4 }), 30);
    this.shellMesh.frustumCulled = false;
    const jumpGeo = mergeGeometries([withColor(new THREE.BoxGeometry(1.5, 26, 1.5).translate(0, 13, 0), C("#3a3d45")), withColor(new THREE.BoxGeometry(2, 12, 18).translate(0, 30, 0), C("#2bf0ff"), 1.6)])!;
    this.jumpMesh = new THREE.InstancedMesh(jumpGeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), 10);
    this.jumpMesh.frustumCulled = false;
    this.scene.add(this.shellMesh, this.jumpMesh);
  }
  private syncMarkers(g: Game) {
    let k = 0;
    const show = g.state !== "menu" && g.rules.city;
    if (show) for (const list of [g.missions.markers, g.jobs.markers]) for (const mk of list) {
      if (k >= this.markerObjs.length) break;
      if (mk.kind === "enemy") continue; // enemies are visible themselves
      const o = this.markerObjs[k++], z = terrainH(mk.x, mk.y);
      o.mat.color.set(mk.color).multiplyScalar(1.4);
      o.mat.opacity = 0.32 + Math.sin(g.t * 4) * 0.08;
      o.beam.visible = o.ring.visible = true;
      o.beam.position.set(mk.x, z, mk.y); o.ring.position.set(mk.x, z + 0.8, mk.y);
      const s = mk.kind === "race" ? 2.4 : 1; o.ring.scale.set(s, 1, s);
    }
    for (; k < this.markerObjs.length; k++) this.markerObjs[k].beam.visible = this.markerObjs[k].ring.visible = false;
    const m = this.tmpM, q = this.tmpQ, sc = this.tmpS, p = this.tmpP;
    if (this.shellMesh) {
      const sh = g.jobs.shells, got = g.progress.shells;
      for (let i = 0; i < 30; i++) {
        const s = sh[i];
        if (!show || !s || got.includes(s.id) || Math.hypot(s.x - g.fx, s.y - g.fy) > 700) { m.makeScale(0, 0, 0); this.shellMesh.setMatrixAt(i, m); continue; }
        q.setFromAxisAngle(this.up, g.t * 2 + i);
        m.compose(p.set(s.x, s.z + 6 + Math.sin(g.t * 3 + i) * 2, s.y), q, sc.set(1.4, 1.4, 1.4));
        this.shellMesh.setMatrixAt(i, m);
      }
      this.shellMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.jumpMesh) {
      const js = g.jobs.jumps, got = g.progress.jumps;
      for (let i = 0; i < 10; i++) {
        const j = js[i];
        if (!show || !j || got.includes(j.id)) { m.makeScale(0, 0, 0); this.jumpMesh.setMatrixAt(i, m); continue; }
        const rp = this.world.ramps[j.ramp];
        const side = rp.alongX ? [j.x, j.y - rp.w / 2 - 8] : [j.x - rp.w / 2 - 8, j.y];
        q.setFromAxisAngle(this.up, rp.alongX ? 0 : Math.PI / 2);
        m.compose(p.set(side[0], 0, side[1]), q, sc.set(1, 1, 1));
        this.jumpMesh.setMatrixAt(i, m);
      }
      this.jumpMesh.instanceMatrix.needsUpdate = true;
    }
  }
  // spike strips of the police (a few pooled meshes, strip along x; rotated for strips along y)
  private spikeMeshes: THREE.Mesh[] = [];
  private buildSpikes() {
    const P: THREE.BufferGeometry[] = [nb(120, 1.2, 10, 0, 0.6, 0, "#2b2d33")];
    for (let i = 0; i < 20; i++) P.push(ni(withColor(new THREE.ConeGeometry(1.4, 4, 4).translate(-57 + i * 6, 3, i % 2 ? 2.5 : -2.5), C("#c9ced8"))));
    const geo = mergeGeometries(P)!;
    for (const p of P) p.dispose();
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(geo, this.bodyMat); m.visible = false; this.scene.add(m); this.spikeMeshes.push(m); }
  }
  private syncSpikes(g: Game) {
    const list = g.police.spikes;
    for (let i = 0; i < this.spikeMeshes.length; i++) {
      const m = this.spikeMeshes[i], s = list[i];
      m.visible = !!s && g.state !== "menu";
      if (!s) continue;
      m.position.set(s.x, terrainH(s.x, s.y), s.y);
      m.rotation.y = s.alongX ? 0 : Math.PI / 2;
    }
  }

  // police helicopter with spotlight cone on the ground
  private heliG: THREE.Group | null = null; private heliRotor: THREE.Mesh | null = null; private heliSpot: THREE.Mesh | null = null;
  private buildHeli() {
    const B: THREE.BufferGeometry[] = [];
    B.push(ni(withColor(new THREE.SphereGeometry(12, 14, 10).scale(1.6, 1, 1), C("#1f3a6e"))), nb(30, 6, 6, -30, 2, 0, "#1f3a6e"), nb(2, 12, 2, -45, 8, 0, "#1f3a6e"), nb(8, 2, 10, -45, 2, 0, "#f4f6fa"));
    B.push(nb(26, 1.6, 1.6, 0, -12, 8, "#2a2d36"), nb(26, 1.6, 1.6, 0, -12, -8, "#2a2d36"), nb(1.5, 6, 1.5, 6, -9, 8, "#2a2d36"), nb(1.5, 6, 1.5, -6, -9, -8, "#2a2d36"), nb(1.5, 6, 1.5, 6, -9, -8, "#2a2d36"), nb(1.5, 6, 1.5, -6, -9, 8, "#2a2d36"));
    B.push(ni(withColor(new THREE.SphereGeometry(7, 10, 8).scale(1, 0.8, 1.1).translate(9, 2, 0), C("#0b121c"))), nb(3, 4, 3, 0, 12, 0, "#2a2d36"));
    const g = new THREE.Group();
    g.add(new THREE.Mesh(mergeGeometries(B)!, this.bodyMat));
    for (const b of B) b.dispose();
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(80, 0.6, 3).translate(0, 14, 0), new THREE.MeshStandardMaterial({ color: 0x15161b }));
    rotor.add(new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 80).translate(0, 14, 0), rotor.material));
    g.add(rotor);
    g.visible = false;
    const spot = new THREE.Mesh(new THREE.CircleGeometry(120, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTex("rgba(255,250,220,0.7)", "rgba(255,250,220,0)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    spot.renderOrder = 2; spot.visible = false;
    this.scene.add(g, spot);
    this.heliG = g; this.heliRotor = rotor; this.heliSpot = spot;
  }
  private syncHeli(g: Game) {
    const h = g.police.heli;
    if (!this.heliG || !this.heliRotor || !this.heliSpot) return;
    this.heliG.visible = !!h && g.state !== "menu";
    this.heliSpot.visible = !!h && !h.dead && g.state !== "menu";
    if (!h) return;
    this.heliG.position.set(h.x, h.z, h.y);
    this.heliG.rotation.set(0, -h.a, h.dead ? 0.4 : -Math.min(0.25, Math.hypot(h.vx, h.vy) / 1200));
    this.heliRotor.rotation.y = h.rotor;
    // the spotlight looks at you when they see you
    const sx = g.police.seen ? g.fx : h.x, sy = g.police.seen ? g.fy : h.y;
    this.heliSpot.position.set(sx, terrainH(sx, sy) + 1, sy);
  }

  // hide and seek spots (static) and job props (bins, burning bins) plus the bin you carry
  private propBins: THREE.InstancedMesh | null = null;
  private carryBin: THREE.Mesh | null = null;
  private buildProps() {
    const P: THREE.BufferGeometry[] = [];
    for (const f of buildHideFields(this.world)) for (const s of f.spots) {
      const z = terrainH(s.x, s.y);
      if (s.kind === "bin") P.push(cyl(6, 5.4, 14, s.x, z + 7, s.y, "#2f6b3a", 10), cyl(6.6, 6.6, 1.5, s.x, z + 14.6, s.y, "#244f2c", 10));
      else if (s.kind === "toilet") P.push(box(14, 30, 14, s.x, z + 15, s.y, "#2b7bd1"), box(15, 2, 15, s.x, z + 31, s.y, "#e8e8ec"), box(1, 22, 8, s.x + 7.2, z + 13, s.y, "#1d5aa0"));
      else if (s.kind === "chair") P.push(box(16, 4, 12, s.x, z + 2, s.y, "#e8dcc4"), box(16, 20, 3, s.x, z + 12, s.y - 6, "#e8dcc4"), box(17, 3, 13, s.x, z + 22, s.y - 3, "#c0392b"));
      else if (s.kind === "bush") for (let k = 0; k < 3; k++) P.push(withColor(new THREE.SphereGeometry(9 - k * 1.5, 8, 6).scale(1.2, 0.8, 1.1).translate(s.x + (k - 1) * 6, z + 6 + k, s.y + (k % 2) * 4), C(k % 2 ? "#3f6f2e" : "#4c7d34")));
    }
    if (P.length) { const m = new THREE.Mesh(mergeGeometries(P)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); m.castShadow = true; m.receiveShadow = true; m.userData.cast = true; this.scene.add(m); this.cityMeshes.push(m); for (const g of P) g.dispose(); }
    const binGeo = mergeGeometries([withColor(new THREE.CylinderGeometry(6, 5.4, 14, 10).translate(0, 7, 0), C("#3a3d45")), withColor(new THREE.CylinderGeometry(6.6, 6.6, 1.5, 10).translate(0, 14.6, 0), C("#2a2d36"))])!;
    this.propBins = new THREE.InstancedMesh(binGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), 24);
    this.propBins.frustumCulled = false; this.propBins.castShadow = true;
    this.scene.add(this.propBins);
    this.carryBin = new THREE.Mesh(binGeo, this.propBins.material as THREE.Material);
    this.carryBin.visible = false;
    this.scene.add(this.carryBin);
  }
  private syncProps(g: Game) {
    if (!this.propBins) this.buildProps();
    const m = this.tmpM, list = g.jobs.props;
    for (let i = 0; i < 24; i++) {
      const p = list[i];
      if (!p) { m.makeScale(0, 0, 0); this.propBins!.setMatrixAt(i, m); continue; }
      m.makeTranslation(p.x, terrainH(p.x, p.y), p.y);
      this.propBins!.setMatrixAt(i, m);
    }
    this.propBins!.instanceMatrix.needsUpdate = true;
    const cb = this.carryBin!;
    cb.visible = g.jobs.carrying && g.onFoot;
    if (cb.visible) { const pd = g.ped; cb.position.set(pd.x + Math.cos(pd.a) * 8, pd.z + 4, pd.y + Math.sin(pd.a) * 8); cb.rotation.set(0, -pd.a, 0); }
  }

  private tmpM = new THREE.Matrix4(); private tmpQ = new THREE.Quaternion(); private tmpS = new THREE.Vector3(); private tmpP = new THREE.Vector3(); private up = new THREE.Vector3(0, 1, 0);

  // a camera placed from outside (camera flight in the main menu, test shots)
  flyCam: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  // the player turns the camera (right stick / right mouse button); it swings back after lookT seconds
  lookYaw = 0; lookPitch = 0; lookT = 0;
  private viewDist = 1;
  private updateCamera(g: Game, dt: number) {
    const p = g.player;
    const fx = g.fx, fy = g.fy, fz = g.fz, sp = g.fspeed;
    const tgt = this.tmpV;
    let lx: number, ly: number, lz: number, fov: number, kp: number;
    let instant = false;
    const cin = this.cinematic;
    if (cin) {
      // dialog: slow swing in front of the speaker, pulled in when a wall is in the way
      this.orbit += dt;
      const a = cin.a + Math.sin(this.orbit * 0.3) * 0.45;
      const cx = Math.cos(a), cy = Math.sin(a);
      let dist = 115;
      for (let s = 0.15; s <= 1.0001; s += 0.1) if (this.world.isSolid(cin.x + cx * 115 * s, cin.y + cy * 115 * s, 6)) { dist = Math.max(30, 115 * s - 10); break; }
      tgt.set(cin.x + cx * dist, cin.z + 42, cin.y + cy * dist);
      lx = cin.x; ly = cin.z + 20; lz = cin.y; fov = 50; kp = 2.5;
    } else if (g.state === "menu") {
      // main menu: a slow flight over the city past the landmarks (at the current time of day)
      this.orbit += dt * 0.018;
      const P = MENU_PATH, n = P.length, u = (this.orbit % 1) * n, i = Math.floor(u), f = u - i;
      const a = P[i % n], b = P[(i + 1) % n], c0 = P[(i + n - 1) % n], c3 = P[(i + 2) % n];
      const cr = (q0: number, q1: number, q2: number, q3: number) => 0.5 * (2 * q1 + (-q0 + q2) * f + (2 * q0 - 5 * q1 + 4 * q2 - q3) * f * f + (-q0 + 3 * q1 - 3 * q2 + q3) * f * f * f);
      const px = cr(c0[0], a[0], b[0], c3[0]), py = cr(c0[1], a[1], b[1], c3[1]), ph = cr(c0[2], a[2], b[2], c3[2]);
      const lxx = cr(c0[3], a[3], b[3], c3[3]), lyy = cr(c0[4], a[4], b[4], c3[4]);
      tgt.set(px, ph, py); lx = lxx; ly = 30; lz = lyy; fov = 55; kp = 1.2;
      this.camYaw = p.a;
    } else if (this.camMode === "fp") {
      if (g.onFoot) {
        this.camYaw = g.ped.a;
        const cx = Math.cos(this.camYaw), cy = Math.sin(this.camYaw);
        tgt.set(fx + cx * 2, fz + 22, fy + cy * 2);
        lx = fx + cx * 200; ly = fz + 18; lz = fy + cy * 200;
      } else {
        this.camYaw += wrapA(p.a - this.camYaw) * Math.min(1, dt * 18);
        const cx = Math.cos(p.a), cy = Math.sin(p.a);
        const rx = -cy, ry = cx;
        const roll = clamp(-p.vR / 900, -0.09, 0.09);
        // eye of the driver: from the seat of a realistic car, else below the roof
        const rg = this.carObjs.get(p)?.rig?.geo;
        const eye = (rg ? rg.eye[1] : getCarGeo(p.model, p.color).roofY - 3.2) * VEH_SCALE, fw = (rg ? rg.eye[0] : 3) * VEH_SCALE, sd = (rg ? -rg.eye[2] : 5) * VEH_SCALE;
        tgt.set(p.x + cx * fw - rx * sd, p.z + eye + roll * 3, p.y + cy * fw - ry * sd);
        lx = p.x + cx * 220 - rx * sd; ly = p.z + eye - 2 + (p.air ? p.vz * 0.05 : 0); lz = p.y + cy * 220 - ry * sd;
      }
      fov = 78 + clamp(sp / 700, 0, 1) * 10 + (p.nitro && !g.onFoot ? 6 : 0);
      kp = 40; instant = true;
    } else if (this.camMode === "chase") {
      this.lookT -= dt;
      if (this.lookT <= 0) { const k = 1 - Math.exp(-dt * 2); this.lookYaw -= wrapA(this.lookYaw) * k; this.lookPitch -= this.lookPitch * k; }
      if (g.onFoot) {
        const pd = g.ped;
        if (Math.hypot(pd.vx, pd.vy) > 30) this.camYaw += wrapA(Math.atan2(pd.vy, pd.vx) - this.camYaw) * (1 - Math.exp(-dt * 2.5));
        const cx = Math.cos(this.camYaw + this.lookYaw), cy = Math.sin(this.camYaw + this.lookYaw);
        // inside a shop: closer, the walls on the camera side become see-through (interiors3d)
        // "near" (setting / zoom button): about half the distance, people look twice as big
        const it = g.inside, near = currentSettings.camNear, far = it ? 56 : near ? 54 : 108, chk = near ? 48 : 95;
        let dist = far;
        if (!it) for (let s = 0.15; s <= 1.0001; s += 0.1) if (this.world.isSolid(fx - cx * chk * s, fy - cy * chk * s, 6)) { dist = Math.max(24, chk * s - 8); break; }
        tgt.set(fx - cx * dist * Math.cos(this.lookPitch * 0.6), fz + (it ? 62 : near ? 30 : 54) + this.lookPitch * (near ? 40 : 60), fy - cy * dist * Math.cos(this.lookPitch * 0.6));
        // the camera stays inside the room (from above, the roof is hidden)
        if (it) { tgt.x = clamp(tgt.x, it.x0 + 6, it.x1 - 6); tgt.z = clamp(tgt.z, it.y0 + 6, it.y1 - 6); }
        lx = fx + cx * 30; ly = fz + 16; lz = fy + cy * 30; fov = 60; kp = 9;
      } else {
        let desired = p.a;
        if (p.vF > 60) desired = p.a + wrapA(Math.atan2(p.vy, p.vx) - p.a) * 0.55;
        this.camYaw += wrapA(desired - this.camYaw) * (1 - Math.exp(-dt * 5));
        const fly = isHeli(p.model);
        const zoom = currentSettings.camNear ? (fly ? 0.75 : 0.6) : 1;
        const full = (128 + sp * 0.07 + (fly ? 70 : 0)) * zoom;
        let dist = full;
        const cx = Math.cos(this.camYaw + this.lookYaw), cy = Math.sin(this.camYaw + this.lookYaw);
        for (let s = 0.12; s <= 1.0001; s += 0.08) if (this.world.isSolid(p.x - cx * full * s, p.y - cy * full * s, 6)) { dist = Math.max(36, full * s - 12); break; }
        const behindH = terrainH(p.x - cx * dist, p.y - cy * dist);
        let h = (46 + sp * 0.025 + (fly ? 45 : 0)) * zoom * (0.55 + 0.45 * (dist / full)) + (g.ending ? 40 : 0) + this.lookPitch * 70;
        // in the tunnel the camera stays under the ceiling, close behind the car
        const tf = tunnelAt(p.x, p.y), tb = tunnelAt(p.x - cx * dist, p.y - cy * dist);
        const inTunnel = (!isNaN(tf) && p.z < tf + TUNNEL.clear) || (!isNaN(tb) && p.z < tb + TUNNEL.clear);
        if (inTunnel) { h = Math.min(h, TUNNEL.clear - 14); dist = Math.min(dist, 80); }
        tgt.set(p.x - cx * dist, inTunnel ? p.z + h : Math.max(p.z + h, behindH + 22), p.y - cy * dist);
        lx = p.x + cx * 70; ly = p.z + 12; lz = p.y + cy * 70;
        fov = 62 + clamp(sp / 700, 0, 1) * 14 + (p.nitro ? 8 : 0);
        kp = 11;
      }
    } else {
      const ax = fx + g.fvx * 0.35, az = fy + g.fvy * 0.35;
      const h = (g.onFoot ? 320 : 560 + sp * 0.35) * (currentSettings.camNear ? 0.6 : 1) + (g.ending ? -120 : 0);
      tgt.set(ax, fz + h, az + h * 0.42);
      lx = ax; ly = fz; lz = az; fov = 50 + (p.nitro && !g.onFoot ? 5 : 0); kp = 5;
      this.camYaw = -Math.PI / 2;
    }
    if (this.fallFix && !cin) { tgt.copy(this.fallFix); lx = fx; ly = fz; lz = fy; kp = 6; }
    if (this.flyCam) { tgt.copy(this.flyCam.pos); lx = this.flyCam.look.x; ly = this.flyCam.look.y; lz = this.flyCam.look.z; instant = true; }
    if (!this.camInit) { this.camPos.copy(tgt); this.camLook.set(lx, ly, lz); this.camInit = true; }
    if (instant) { this.camPos.copy(tgt); this.camLook.set(lx, ly, lz); }
    else {
      const k = 1 - Math.exp(-dt * kp);
      this.camPos.lerp(tgt, k);
      this.camLook.lerp(tgt.set(lx, ly, lz), 1 - Math.exp(-dt * kp * 1.4));
    }
    const cam = this.camera;
    cam.position.copy(this.camPos);
    cam.position.x += g.shakeX * 0.5; cam.position.y += g.shakeY * 0.35;
    cam.lookAt(this.camLook);
    cam.rotateZ(g.shakeR);
    this.fov += (fov - this.fov) * (1 - Math.exp(-dt * 4));
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }

  render(g: Game, dt: number) {
    this.syncCars(g, dt);
    this.syncPickups(g);
    this.syncProjs(g);
    this.syncSkids(g);
    this.syncParticles(g);
    this.syncLights(g);
    this.syncArrow(g);
    this.syncMarkers(g);
    this.syncHeli(g);
    this.syncSpikes(g);
    this.rooms.update(g, dt, this.camPos);
    this.landmarks.update(g.clock, this.atm.state.night, g.t, dt);
    this.ped.update(g, dt, this.seatOf(g), this.camMode === "fp");
    if (this.padMat?.map) this.padMat.map.offset.y = (this.padMat.map.offset.y - dt * 1.6) % 1; // boost pads: chevrons run towards the ramp
    this.people.update(g.peds.list, g.state !== "menu", this.camPos.x, this.camPos.z, g.fx, g.fy, dt);
    this.crowd.update(g.peds.list, g.state !== "menu", g.fx, g.fy, this.people.drawn);
    this.syncProps(g);
    this.lightsMesh?.update(g.traffic.lights);
    this.atm.update(g.clock, g.weather, g.weatherT, dt, g.fx, g.fy, g.fz, currentSettings.weather);
    // settings that can change while playing
    const cs = currentSettings;
    if (this.renderer.shadowMap.enabled !== cs.shadows) this.renderer.shadowMap.enabled = cs.shadows;
    if (this.viewDist !== cs.viewDist) { this.viewDist = cs.viewDist; this.setQuality(this.quality); }
    this.water.update(g.t, this.atm);
    this.applyTime(g);
    this.updateCamera(g, dt);
    const scale = this.renderer.domElement.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.smoke.mat.uniforms.scale.value = scale;
    this.glowPts.mat.uniforms.scale.value = scale;
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
