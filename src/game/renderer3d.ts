import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { World, BLOCK, ROAD, GRID, WORLD, MAP_MIN, MAP_MAX, MAP_SIZE, EXT, HIGHWAYS, H_SCALE, WATER_Y, terrainH, terrainGrad, cityDist, inCity, isHighway, seaDist, mulberry32, type Building, type Ramp,
  TUNNELS, TUN_HW, TUN_H, TUN_PORTAL, TUN_SIDE, AIRFIELD, tunnelRoad, tunnelSink, naturalH, inRock, inTube, nearTunnel, nearAirfield } from "./world";
import { InteriorView } from "./interior3d";
import { isCraft, isAircraft, isCopModel } from "./vehicles";
import { JETTY, HELI_SPOT, type Place } from "./places";
import { CrowdRenderer } from "./crowd3d";
import { DISTRICTS, blockDistrict } from "./districts";
import { WEAPONS, WEAPON_DEFS, type Weapon } from "./weapons";
import { OUTFITS } from "./economy";
import { MAX_PEDS } from "./peds";
import type { Game, Car, Pickup, CameraMode, Quality, CarModel, Proj, Bomb, PickupType } from "./engine";

const MAX_SKIDS = 900;
const MAX_PTS = 600;
const WIN = 16;
const FLOOR = 18;

const wrapA = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function radialTex(inner: string, outer: string, size = 128) {
  return canvasTex(size, size, (g) => {
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
  });
}
function withColor(g: THREE.BufferGeometry, col: THREE.Color, mul = 1) {
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = col.r * mul; arr[i * 3 + 1] = col.g * mul; arr[i * 3 + 2] = col.b * mul; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}
const colCache = new Map<string, THREE.Color>();
function C(hex: string) { let c = colCache.get(hex); if (!c) { c = new THREE.Color(hex); colCache.set(hex, c); } return c; }
function box(w: number, h: number, d: number, x: number, y: number, z: number, col: string | THREE.Color, mul = 1, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return withColor(g, typeof col === "string" ? C(col) : col, mul);
}
function flat(w: number, d: number, x: number, z: number, col: string, y = 0.12, mul = 1) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(x, y, z);
  return withColor(g, C(col), mul);
}
function cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, col: string, seg = 8, mul = 1) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y, z);
  return withColor(g, C(col), mul);
}
function sph(r: number, x: number, y: number, z: number, col: string, seg = 10) {
  const g = new THREE.SphereGeometry(r, seg, seg); g.translate(x, y, z);
  return withColor(g, C(col));
}

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
  boat: SEDAN, heli: SEDAN, jet: SEDAN, // own geometry (boatGeo / heliGeo / jetGeo)
  interceptor: { L: 50, W: 25, y0: 2.8, noseY: 6.5, beltY: 10.8, deckY: 11.8, xCowl: 10, xRoofF: 1, xRoofR: -8, xDeck: -14, roofY: 16.5, r: 6, wx: 16, wxr: -15, wd: 5 },
  polsuv: { L: 52, W: 26, y0: 5, noseY: 13.5, beltY: 17.5, deckY: 18, xCowl: 12, xRoofF: 8, xRoofR: -19, xDeck: -22, roofY: 27, r: 7.5, wx: 16, wxr: -16, wd: 5 },
  bike: { L: 34, W: 8, y0: 6, noseY: 12, beltY: 14, deckY: 14, xCowl: 6, xRoofF: 2, xRoofR: -4, xDeck: -6, roofY: 18, r: 6, wx: 13, wxr: -13, wd: 3 },
};

// motorbike: frame, tank, seat, handlebar; the rider goes into the "glass" mesh so it can be hidden
function bikeGeo(color: string): CarGeo {
  const B: THREE.BufferGeometry[] = [], G: THREE.BufferGeometry[] = [], Lg: THREE.BufferGeometry[] = [];
  const body = C(color), trim = "#15161b", chrome = "#c9ced8";
  B.push(bar(-13, 6, 2, 11, 1.6, 1.6, 0, trim), bar(2, 11, 12, 6, 1.6, 1.6, 0, trim), bar(-4, 7, 9, 14, 1.4, 1.4, 0, trim));
  B.push(rbox(11, 5, 7, 2, 14.5, 0, body, 1.8), rbox(10, 2.2, 6, -6, 15.5, 0, "#1d1d22", 0.8), rbox(7, 4, 7.5, -12, 11.5, 0, body, 1.4));
  B.push(bar(9, 14, 12.5, 6, 1, 1, 2.2, chrome), bar(9, 14, 12.5, 6, 1, 1, -2.2, chrome), nb(1, 1, 13, 9.5, 19, 0, trim), nb(1, 6, 1, 9, 16.5, 0, trim));
  B.push(cylX(1.3, 12, -9, 7, 3.2, chrome, 8), nb(8, 4, 4, 0, 8, 0, "#3a3d45"));
  Lg.push(nb(1, 2.4, 3, 13.4, 15, 0, "#fff4d6", 3.2), nb(0.8, 1.4, 3, -15.6, 12, 0, "#ff1838", 2.6));
  // rider: legs, torso, helmet
  const jacket = "#23252c", helmet = "#e8e8ec";
  for (const sd of [-1, 1]) G.push(bar(-6, 16, 2, 13, 2.4, 2.6, sd * 3.2, "#2c3e57"), bar(2, 13, 1, 6, 2.2, 2.2, sd * 3.4, "#2c3e57"));
  G.push(bar(-6, 16, 0, 27, 4.5, 6.5, 0, jacket), bar(-1, 26, 8, 19, 1.8, 1.8, 3.6, jacket), bar(-1, 26, 8, 19, 1.8, 1.8, -3.6, jacket));
  G.push(ni(withColor(new THREE.SphereGeometry(3.4, 12, 10).scale(1.1, 1, 0.95).translate(0.5, 30.5, 0), C(helmet))), nb(1.5, 2, 5, 3.6, 30.4, 0, "#0b121c"));
  const wheels: CarWheel[] = [{ x: 13, z: 0, r: 6, wd: 3, front: true }, { x: -13, z: 0, r: 6, wd: 3, front: false }];
  const res: CarGeo = { body: mergeGeometries(B)!, glass: mergeGeometries(G)!, lights: mergeGeometries(Lg)!, wheels, roofY: 26 };
  for (const g of [...B, ...G, ...Lg]) g.dispose();
  return res;
}

// speedboat: hull below the waterline, white deck, windshield, outboard motor
function boatGeo(color: string): CarGeo {
  const B: THREE.BufferGeometry[] = [], G: THREE.BufferGeometry[] = [], Lg: THREE.BufferGeometry[] = [];
  const body = C(color), dark = body.clone().multiplyScalar(0.45);
  B.push(prof([[-25, -3], [14, -3], [31, 6], [-26, 6]], 22, 2, body));
  B.push(nb(42, 1, 19, -4, 6.4, 0, "#f4f4f6"), nb(44, 1.4, 22.4, -2, 2.5, 0, dark));
  B.push(nb(8, 3, 16, -14, 8.3, 0, "#e9e4d8"), nb(6, 5, 8, -2, 9, 0, "#2a2d36"), nb(5, 9, 6, -27.5, 7, 0, "#22252b"), nb(2, 6, 2, -29, 1, 0, "#22252b"));
  for (const sd of [-1, 1]) B.push(nb(30, 1.6, 1, -2, 8, sd * 10.6, "#c9ced8"));
  G.push(prof([[3, 6.5], [9, 6.5], [5, 12.5], [1, 12.5]], 17, 0.5, "#0b121c"));
  Lg.push(nb(1, 1.2, 1.2, 24, 7, 6, "#3dff8b", 2.4), nb(1, 1.2, 1.2, 24, 7, -6, "#ff1838", 2.4), nb(1.6, 1.6, 1.6, -22, 12, 0, "#fff4d6", 2.4));
  const res: CarGeo = { body: mergeGeometries(B)!, glass: mergeGeometries(G)!, lights: mergeGeometries(Lg)!, wheels: [], roofY: 14 };
  for (const g of [...B, ...G, ...Lg]) g.dispose();
  return res;
}
// fighter jet: fuselage along x, delta wings, two tail fins, canopy; stands on its landing gear
function jetGeo(color: string, police = false): CarGeo {
  const B: THREE.BufferGeometry[] = [], G: THREE.BufferGeometry[] = [], Lg: THREE.BufferGeometry[] = [];
  const body = C(color), dark = body.clone().multiplyScalar(0.55), y = 10;
  B.push(ni(withColor(new THREE.CylinderGeometry(4.6, 4.2, 50, 16).rotateZ(Math.PI / 2).translate(-4, y, 0), body)));
  B.push(ni(withColor(new THREE.ConeGeometry(4.6, 16, 16).rotateZ(-Math.PI / 2).translate(29, y, 0), body)), ni(withColor(new THREE.ConeGeometry(1.2, 4, 8).rotateZ(-Math.PI / 2).translate(38.5, y, 0), C("#2a2d36"))));
  B.push(ni(withColor(new THREE.CylinderGeometry(3.6, 4.2, 5, 16).rotateZ(Math.PI / 2).translate(-31, y, 0), C("#3a3d45"))));
  for (const sd of [-1, 1]) B.push(nb(14, 5, 3.4, 8, y - 1.5, sd * 5.4, dark));
  // wings and tail planes: flat triangles extruded across their thickness
  const plate = (pts: [number, number][], th: number, yy: number, col: THREE.Color) => {
    const sh = new THREE.Shape(); pts.forEach(([a, b], i) => (i ? sh.lineTo(a, b) : sh.moveTo(a, b))); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false });
    g.rotateX(Math.PI / 2); g.translate(0, yy + th / 2, 0);
    return ni(withColor(g, col));
  };
  B.push(plate([[12, 3], [-14, 27], [-22, 27], [-20, 3]], 1.2, y - 1, body), plate([[12, -3], [-14, -27], [-22, -27], [-20, -3]], 1.2, y - 1, body));
  B.push(plate([[-22, 3], [-31, 13], [-35, 13], [-34, 3]], 0.9, y, body), plate([[-22, -3], [-31, -13], [-35, -13], [-34, -3]], 0.9, y, body));
  for (const sd of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(-20, 0); sh.lineTo(-30, 15); sh.lineTo(-35, 15); sh.lineTo(-34, 0); sh.closePath();
    const fin = new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: false }); fin.translate(0, 0, -0.45); fin.rotateX(sd * 0.32); fin.translate(0, y + 2, sd * 3.2);
    B.push(ni(withColor(fin, police ? C("#f4f6fa") : body)));
  }
  if (police) for (const sd of [-1, 1]) B.push(nb(30, 1.2, 0.3, 0, y + 1.5, sd * 4.55, "#f4f6fa"), nb(8, 0.5, 6, -16, y - 0.2, sd * 18, "#f4f6fa"));
  // landing gear (folded in the air: see syncCars)
  for (const [gx, gz] of [[22, 0], [-8, -6], [-8, 6]]) B.push(nb(1.2, y - 3, 1.2, gx, (y - 3) / 2 + 2, gz, "#2a2d36"), ni(withColor(new THREE.CylinderGeometry(2, 2, 1.6, 12).rotateX(Math.PI / 2).translate(gx, 2, gz), C("#121214"))));
  G.push(ni(withColor(new THREE.SphereGeometry(4, 14, 10).scale(2.6, 1, 0.95).translate(14, y + 3.4, 0), C("#0b121c"))));
  Lg.push(nb(1.2, 1.2, 1.2, -18, y - 0.4, 27.2, "#3dff8b", 2.6), nb(1.2, 1.2, 1.2, -18, y - 0.4, -27.2, "#ff1838", 2.6), nb(1, 1, 1, -35, y + 15, 0, "#ffffff", 2.4));
  const res: CarGeo = { body: mergeGeometries(B)!, glass: mergeGeometries(G)!, lights: mergeGeometries(Lg)!, wheels: [], roofY: y + 8 };
  for (const g of [...B, ...G, ...Lg]) g.dispose();
  return res;
}

// helicopter: fuselage, tail boom, skids, cockpit glass (the rotor is a separate mesh, see makeCar)
function heliGeo(color: string): CarGeo {
  const B: THREE.BufferGeometry[] = [], G: THREE.BufferGeometry[] = [], Lg: THREE.BufferGeometry[] = [];
  const body = C(color), y = 14;
  B.push(ni(withColor(new THREE.SphereGeometry(12, 14, 10).scale(1.6, 1, 1).translate(0, y, 0), body)), nb(30, 6, 6, -30, y + 2, 0, body), nb(2, 12, 2, -45, y + 8, 0, body), nb(8, 2, 10, -45, y + 2, 0, "#f4f6fa"));
  for (const sd of [-1, 1]) B.push(nb(26, 1.6, 1.6, 0, 2, sd * 8, "#2a2d36"), nb(1.5, 6, 1.5, 6, 5, sd * 8, "#2a2d36"), nb(1.5, 6, 1.5, -6, 5, sd * 8, "#2a2d36"));
  B.push(nb(3, 4, 3, 0, y + 12, 0, "#2a2d36"));
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
  if (model === "bike") { const g = bikeGeo(color); carGeoCache.set(key, g); return g; }
  if (model === "boat") { const g = boatGeo(color); carGeoCache.set(key, g); return g; }
  if (model === "heli") { const g = heliGeo(color); carGeoCache.set(key, g); return g; }
  if (model === "jet") { const g = jetGeo(color); carGeoCache.set(key, g); return g; }
  const B: THREE.BufferGeometry[] = [], G: THREE.BufferGeometry[] = [], Lg: THREE.BufferGeometry[] = [];
  const s = SPECS[model] ?? SEDAN;
  const body = C(color), dark = body.clone().multiplyScalar(0.45);
  const trim = "#15161b";
  const hl = s.L / 2, hw = s.W / 2, rm = (s.xRoofF + s.xRoofR) / 2;

  // lower body (rounded flanks) + greenhouse glass + roof + pillars
  const bev = Math.min(2.2, (s.noseY - s.y0) * 0.38);
  B.push(prof([[-hl, s.y0], [hl, s.y0], [hl, s.noseY], [s.xCowl, s.beltY], [s.xDeck, s.beltY], [-hl, s.deckY]], s.W, bev, body));
  G.push(prof([[s.xCowl - 0.5, s.beltY - 0.3], [s.xRoofF, s.roofY], [s.xRoofR, s.roofY], [s.xDeck + 0.5, s.beltY - 0.3]], s.W - 3.2, 0, "#0b121c"));
  B.push(rbox(s.xRoofF - s.xRoofR + 1.5, 1.6, s.W - 3, rm, s.roofY + 0.2, 0, body, 0.7));
  for (const sd of [-1, 1]) {
    const z = sd * (hw - 1.7);
    B.push(bar(s.xCowl, s.beltY, s.xRoofF, s.roofY, 1.5, 1.8, z, body));
    B.push(bar(s.xDeck, s.beltY, s.xRoofR, s.roofY, 1.7, 1.8, z, body));
    B.push(bar(rm, s.beltY, rm, s.roofY, 1.1, 1.8, z, trim));
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
    case "interceptor": {
      // black-and-white police supercar: white doors, push bar, big wing
      for (const sd of [-1, 1]) B.push(nb(20, 6, 0.4, -2, 7.4, sd * (hw + 0.05), "#f4f6fa"));
      B.push(rbox(6, 0.9, s.W + 1, -hl + 3, s.deckY + 5.5, 0, trim, 0.3), nb(1.4, 5, 1.4, -hl + 3.4, s.deckY + 2.7, 8, trim), nb(1.4, 5, 1.4, -hl + 3.4, s.deckY + 2.7, -8, trim));
      B.push(nb(1.5, 5, 20, hl + 1.2, 5.5, 0, "#2a2d36"), nb(1.2, 3.5, 7, hl + 1.6, 5.5, 0, "#2a2d36"));
      Lg.push(nb(1, 1, 3, hl + 0.3, s.y0 + 2.2, 9.5, "#2a5bff", 2.4), nb(1, 1, 3, hl + 0.3, s.y0 + 2.2, -9.5, "#ff1a3a", 2.4));
      break;
    }
    case "polsuv": {
      const navy = "#0b1530";
      B.push(rbox(16, 9, s.W + 0.3, 14, 10, 0, navy, 0.6), nb(s.L - 2, 0.6, s.W + 0.35, 0, 15.6, 0, navy));
      B.push(nb(2, 9, 24, hl + 1.6, 8, 0, "#2a2d36"), nb(1.5, 2, 2, hl + 1.6, 13, 11, "#2a2d36"), nb(1.5, 2, 2, hl + 1.6, 13, -11, "#2a2d36"));
      for (const sd of [-1, 1]) B.push(nb(26, 0.8, 0.8, rm, s.roofY + 1.7, sd * (hw - 3), "#2a2c33"));
      B.push(cylX(6, 2.6, -hl - 1.8, 14, 0, "#121214", 18));
      Lg.push(nb(1, 1.4, 3, hl + 0.3, s.y0 + 4, 9.5, "#ffb020", 2.2), nb(1, 1.4, 3, hl + 0.3, s.y0 + 4, -9.5, "#ffb020", 2.2));
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
  group: THREE.Group; tilt: THREE.Group; body: THREE.Mesh; glass: THREE.Mesh; lights: THREE.Mesh; pool: THREE.Mesh; glow?: THREE.Mesh; rotor?: THREE.Mesh; burner?: THREE.Mesh; shadow: THREE.Mesh;
  wheels: { pivot: THREE.Group; spin: THREE.Mesh; front: boolean; r: number }[];
  bar?: { reds: THREE.MeshBasicMaterial; blues: THREE.MeshBasicMaterial; white: THREE.MeshBasicMaterial };
  model: CarModel; color: string; wreck: boolean; pitch: number; roll: number; spinA: number; steerA: number;
}

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

// ---------------------------------------------------------------- player character
class PedModel {
  group = new THREE.Group();
  hips = new THREE.Group();
  legL = new THREE.Group(); legR = new THREE.Group();
  armL = new THREE.Group(); armR = new THREE.Group();
  torsoG = new THREE.Group();
  guns: Record<Weapon, THREE.Mesh | null>;
  vest: THREE.Mesh; jacket: THREE.MeshStandardMaterial; jeans: THREE.MeshStandardMaterial;
  flashMats: THREE.MeshStandardMaterial[];
  shadow: THREE.Mesh;
  private flashOn = false; private outfit = -1;
  constructor(shirtTex: THREE.Texture, shadowGeo: THREE.PlaneGeometry, shadowMat: THREE.Material) {
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a07c, roughness: 0.6 });
    const jacket = new THREE.MeshStandardMaterial({ map: shirtTex, roughness: 0.85 });
    const jeans = new THREE.MeshStandardMaterial({ color: 0x36485f, roughness: 0.9 });
    const shoeM = new THREE.MeshStandardMaterial({ color: 0xe8e8ec, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x15161b, roughness: 0.5 });
    const hairM = new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.9 });
    const gunM = new THREE.MeshStandardMaterial({ color: 0x23252c, metalness: 0.7, roughness: 0.35 });
    const mk = (g: THREE.BufferGeometry, m: THREE.Material) => { const me = new THREE.Mesh(g, m); me.castShadow = true; return me; };
    const cap = (r: number, len: number, y: number, mat: THREE.Material, sx = 1, sz = 1) => {
      const g = new THREE.CapsuleGeometry(r, len, 4, 12); g.scale(sx, 1, sz); g.translate(0, y, 0); return mk(g, mat);
    };
    // legs (pivot at hip, y=10)
    for (const [leg, side] of [[this.legL, -1], [this.legR, 1]] as const) {
      leg.position.set(0, 10, side * 2.0);
      leg.add(cap(1.85, 3.6, -2.9, jeans), cap(1.45, 3.2, -6.9, jeans));
      leg.add(mk(new RoundedBoxGeometry(5.6, 2, 3.2, 2, 0.8).translate(0.9, -10.2, 0), shoeM));
      leg.add(mk(new RoundedBoxGeometry(5.8, 0.6, 3.3, 2, 0.25).translate(0.9, -11.0, 0), dark));
      this.hips.add(leg);
    }
    this.hips.add(mk(new RoundedBoxGeometry(4, 2.8, 7.6, 2, 1).translate(0, 10.6, 0), jeans));
    this.hips.add(mk(new THREE.BoxGeometry(4.2, 0.7, 7.8).translate(0, 11.5, 0), dark));
    // torso
    this.torsoG.position.set(0, 11.5, 0);
    this.torsoG.add(cap(3.0, 3.4, 4.7, jacket, 0.78, 1.38));
    // head
    const headG = new THREE.Group();
    headG.position.set(0, 9.5, 0);
    const headGeo = new THREE.SphereGeometry(2.3, 18, 14); headGeo.scale(0.95, 1.18, 0.88); headGeo.translate(0, 3.0, 0);
    headG.add(mk(headGeo, skin));
    const hairGeo = new THREE.SphereGeometry(2.42, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52); hairGeo.scale(0.98, 1.2, 0.93); hairGeo.rotateZ(0.55); hairGeo.translate(-0.1, 3.0, 0);
    headG.add(mk(hairGeo, hairM));
    headG.add(mk(new THREE.SphereGeometry(0.5, 8, 6).translate(0, 3.0, 2.0), skin), mk(new THREE.SphereGeometry(0.5, 8, 6).translate(0, 3.0, -2.0), skin));
    headG.add(mk(new THREE.BoxGeometry(0.7, 1.0, 0.7).translate(2.15, 2.7, 0), skin));
    headG.add(mk(new RoundedBoxGeometry(1.0, 0.9, 4.1, 2, 0.35).translate(1.85, 3.5, 0), dark)); // sunglasses
    headG.add(mk(new THREE.CylinderGeometry(1.1, 1.3, 1.6, 10).translate(0, 0.4, 0), skin)); // neck
    this.torsoG.add(headG);
    // arms (pivot at shoulder)
    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(0, 8.2, side * 5.2);
      arm.add(mk(new THREE.SphereGeometry(1.55, 10, 8), jacket), cap(1.4, 3.2, -2.6, jacket), cap(1.2, 3.0, -6.5, jacket), mk(new THREE.SphereGeometry(1.25, 10, 8).translate(0, -9.1, 0), skin));
      this.torsoG.add(arm);
    }
    // weapons in the right hand
    const gun = (parts: THREE.BufferGeometry[], m: THREE.Material) => mk(mergeGeometries(parts)!, m);
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.7 });
    this.guns = {
      fist: null,
      bat: gun([new THREE.CylinderGeometry(0.6, 1.1, 18, 8).translate(0, -9, 0).rotateZ(-1.2).translate(4, -6, 0)], wood),
      pistol: gun([new THREE.BoxGeometry(4.5, 1.6, 1.2).translate(2.2, -9.2, 0), new THREE.BoxGeometry(1.2, 2.8, 1.1).translate(0.6, -10.6, 0)], gunM),
      smg: gun([new THREE.BoxGeometry(8, 2, 1.4).translate(3.5, -9.2, 0), new THREE.BoxGeometry(1.2, 4, 1).translate(3.2, -11.4, 0), new THREE.BoxGeometry(1.2, 2.6, 1.1).translate(0.4, -10.6, 0)], gunM),
      shotgun: gun([new THREE.CylinderGeometry(0.7, 0.7, 16, 8).rotateZ(Math.PI / 2).translate(6, -8.8, 0), new THREE.BoxGeometry(6, 2.2, 1.6).translate(-1, -9.6, 0)], wood),
      grenade: gun([new THREE.SphereGeometry(1.6, 10, 8).translate(1.4, -9.4, 0)], new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 0.6 })),
      rocket: gun([new THREE.CylinderGeometry(1.8, 1.8, 20, 10).rotateZ(Math.PI / 2).translate(2, -8.5, 0), new THREE.CylinderGeometry(2.4, 1.8, 3, 10).rotateZ(Math.PI / 2).translate(12.5, -8.5, 0), new THREE.BoxGeometry(2, 3, 1.5).translate(-2, -11, 0)], new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.6, metalness: 0.3 })),
      bomb: gun([new THREE.SphereGeometry(1.8, 10, 8).translate(1.4, -9.4, 0)], new THREE.MeshStandardMaterial({ color: 0x3a3a44, emissive: 0xff2040, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.5 })),
    };
    for (const w of WEAPONS) { const m = this.guns[w]; if (m) this.armR.add(m); }
    // armour vest over the jacket
    this.vest = cap(3.25, 3.0, 4.9, new THREE.MeshStandardMaterial({ color: 0x3a4a34, roughness: 0.8 }), 0.82, 1.42);
    this.vest.visible = false;
    this.torsoG.add(this.vest);
    this.jacket = jacket; this.jeans = jeans;
    this.flashMats = [skin, jacket, jeans, shoeM, dark, hairM];
    this.group.add(this.hips, this.torsoG);
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.scale.set(0.35, 1, 0.5);
    this.shadow.renderOrder = 1;
    this.group.add(this.shadow);
    this.group.visible = false;
  }
  update(g: Game, dt: number) {
    const pd = g.ped;
    const vis = g.onFoot && g.state !== "menu";
    this.group.visible = vis;
    if (!vis) return;
    this.group.position.set(pd.x, pd.z, pd.y);
    const sp = Math.hypot(pd.vx, pd.vy);
    const w = pd.walk;
    const amp = clamp(sp / 180, 0, 1.1) * 0.8;
    const bob = Math.abs(Math.sin(w * 2)) * amp * 0.9;
    this.hips.position.y = bob;
    this.torsoG.position.y = 11.5 + bob;
    this.legL.rotation.z = Math.sin(w) * amp;
    this.legR.rotation.z = -Math.sin(w) * amp;
    const wpn = g.weapon, kind = WEAPON_DEFS[wpn].kind;
    const twoHand = wpn === "pistol" || wpn === "smg" || wpn === "shotgun";
    const aiming = pd.shootT > 0 || wpn === "rocket";
    if (kind === "melee" && pd.shootT > 0) {
      // swing / punch: arm goes up and comes down
      const k = 1 - pd.shootT / 0.4;
      this.armR.rotation.z = (wpn === "bat" ? 2.2 : 1.6) * Math.sin(k * Math.PI) - 0.2;
      this.armL.rotation.z = -Math.sin(w) * amp; this.armL.rotation.y = 0;
    } else if (aiming) {
      const t = Math.min(1, pd.shootT * 4 + (wpn === "rocket" ? 1 : 0));
      const kick = pd.shootT > 0.3 ? (pd.shootT - 0.3) * 4 : 0;
      this.armR.rotation.z = -(Math.PI / 2 - 0.1) * t + kick * 0.6;
      this.armL.rotation.z = twoHand ? -(Math.PI / 2 - 0.4) * t : -Math.sin(w) * amp;
      this.armL.rotation.y = twoHand ? 0.5 * t : 0;
    } else {
      this.armR.rotation.z = -Math.sin(w) * amp * 0.8; this.armL.rotation.z = Math.sin(w) * amp * 0.8; this.armL.rotation.y = 0;
    }
    for (const k of WEAPONS) { const m = this.guns[k]; if (m) m.visible = k === wpn; }
    this.vest.visible = g.ped.armor > 0;
    if (this.outfit !== g.outfit) {
      this.outfit = g.outfit;
      const o = OUTFITS[g.outfit] ?? OUTFITS[0];
      this.jacket.color.set(o.shirt); this.jeans.color.set(o.pants);
    }
    this.torsoG.rotation.x = Math.sin(w) * amp * 0.08;
    const lean = clamp(sp / 250, 0, 1) * 0.12;
    this.torsoG.rotation.z = lean;
    if (pd.dead) {
      this.group.rotation.set(0, -pd.a, 0);
      this.group.rotation.x = Math.min(Math.PI / 2, (this.group.rotation.x || 0) + dt * 4);
      this.group.position.y = pd.z + 1;
    } else {
      this.group.rotation.set(0, -pd.a, 0);
    }
    const flash = pd.hitFlash > 0.2;
    if (flash !== this.flashOn) { this.flashOn = flash; for (const m of this.flashMats) m.emissive.setScalar(flash ? 0.6 : 0); }
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

  private moon!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private dark = 0; // 0 daylight .. 1 inside a tunnel (sky light dimmed)
  private head!: THREE.SpotLight;
  private plights: THREE.PointLight[] = [];
  private sky!: THREE.Mesh;
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
  private burnerGeo = new THREE.ConeGeometry(3.4, 16, 12).rotateZ(Math.PI / 2).translate(-8, 0, 0);
  private burnerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.5), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  private barSeg = new THREE.BoxGeometry(3.2, 2, 2.6);
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
  private ped!: PedModel;
  private crowd!: CrowdRenderer;
  private renderPass: RenderPass | null = null;
  interior!: InteriorView;
  private camPos = new THREE.Vector3(); private camLook = new THREE.Vector3(); private camInit = false; private orbit = 0; private fov = 62;
  private tmpV = new THREE.Vector3();
  private copRed = C("#ff1a3a"); private copBlue = C("#2a5bff");

  constructor(canvas: HTMLCanvasElement, world: World, places: Place[], quality: Quality, camMode: CameraMode) {
    this.world = world; this.quality = quality; this.camMode = camMode;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === "high", powerPreference: "high-performance" });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;
    pmrem.dispose();
    this.scene.fog = new THREE.Fog(0xcdbca4, 450, 3600);
    this.scene.background = new THREE.Color(0xb7cbe6);
    this.buildLights(); this.buildSky(); this.buildGround(); this.buildTerrain(); this.buildCity(); this.buildRamps(); this.buildLamps(); this.buildShared(); this.buildPlaces(places); this.buildMarkers(); this.buildHeli(); this.buildSpikes(); this.buildTunnels(); this.buildAirfield(); this.buildPoliceJets();
    this.setQuality(quality);
  }

  dispose() { this.renderer.dispose(); this.composer?.dispose(); }

  setQuality(q: Quality) {
    this.quality = q;
    const hi = q === "high";
    this.moon.castShadow = hi;
    for (const m of this.cityMeshes) m.castShadow = hi && m.userData.cast;
    for (const f of this.forest) f.castShadow = hi;
    this.crowd.setShadows(hi);
    this.interior?.setShadows(hi);
    const fog = this.scene.fog as THREE.Fog;
    fog.far = hi ? 4600 : 3000;
    this.camera.far = hi ? 9000 : 7000;
    this.camera.updateProjectionMatrix();
    if (hi) {
      if (!this.composer) {
        this.composer = new EffectComposer(this.renderer);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);
        this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(this.w, this.h), 0.28, 0.5, 0.92));
        this.composer.addPass(new OutputPass());
      }
    } else if (this.composer) { this.composer.dispose(); this.composer = null; this.renderPass = null; }
    this.resize(this.w, this.h);
  }

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    const dpr = window.devicePixelRatio || 1;
    const pr = this.quality === "high" ? Math.min(dpr, 1.75) : Math.min(dpr, 1);
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
    this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x80705c, 1.35);
    this.scene.add(this.hemi);
    const moon = new THREE.DirectionalLight(0xffe4bd, 4.2);
    moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera;
    sc.left = -650; sc.right = 650; sc.top = 650; sc.bottom = -650; sc.near = 10; sc.far = 2600;
    moon.shadow.bias = -0.0006; moon.shadow.normalBias = 1.5;
    this.scene.add(moon, moon.target);
    this.moon = moon;
    const head = new THREE.SpotLight(0xfff0d0, 5, 750, 0.55, 0.65, 0);
    this.scene.add(head, head.target);
    this.head = head;
    for (let i = 0; i < 5; i++) { const l = new THREE.PointLight(0xff0000, 0, 260, 0); this.scene.add(l); this.plights.push(l); }
  }

  private buildSky() {
    const g = new THREE.SphereGeometry(6500, 48, 24);
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const sunDir = new THREE.Vector3(-1, 0, -0.35).normalize();
    const cFog = C("#c9bba5"), cHaze = C("#e6d6bb"), cSun = C("#ffdca8"), cMid = C("#a4c3e6"), cHi = C("#6a98d4"), cTop = C("#3f6fbf");
    const tmp = new THREE.Color(), hz = new THREE.Color(), v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const e = v.y, sun = Math.pow(Math.max(0, v.x * sunDir.x + v.z * sunDir.z), 4);
      hz.copy(cHaze).lerp(cSun, sun);
      if (e < -0.02) tmp.copy(cFog); else if (e < 0.05) tmp.copy(cFog).lerp(hz, (e + 0.02) / 0.07);
      else if (e < 0.22) tmp.copy(hz).lerp(cMid, (e - 0.05) / 0.17); else if (e < 0.5) tmp.copy(cMid).lerp(cHi, (e - 0.22) / 0.28);
      else tmp.copy(cHi).lerp(cTop, Math.min(1, (e - 0.5) / 0.5));
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10;
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.2, 3), fog: false }));
    sunDisc.position.set(-5200, 2900, -1800);
    sky.add(sunDisc);
    this.sky = sky;
    this.scene.add(sky);
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
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD).rotateX(-Math.PI / 2).translate(WORLD / 2, 0, WORLD / 2), new THREE.MeshStandardMaterial({ color: 0x46464b, map: noise, roughness: 0.55, metalness: 0.15, envMapIntensity: 0.6 }));
    asphalt.receiveShadow = true;
    this.scene.add(asphalt);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2).translate(WORLD / 2, WATER_Y, WORLD / 2), new THREE.MeshStandardMaterial({ color: 0x1d5c78, roughness: 0.08, metalness: 0.6, envMapIntensity: 1.2 }));
    this.scene.add(water);

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

  // sloped launch ramps (street ramps and ramps onto buildings)
  private buildRamps() {
    const top: THREE.BufferGeometry[] = [], side: THREE.BufferGeometry[] = [];
    const lift = 0.4;
    for (const rp of this.world.ramps as Ramp[]) {
      const { x0, y0, l, w, alongX, rising, h } = rp;
      const sA = alongX ? x0 : y0, vA = alongX ? y0 : x0;
      const sLo = rising > 0 ? sA : sA + l; // ground-level end
      const sHi = rising > 0 ? sA + l : sA; // lip
      const P = (s: number, y: number, v: number) => (alongX ? [s, y + lift, v] : [v, y + lift, s]);
      const tri = (dst: number[], a: number[], b: number[], c: number[]) => dst.push(...a, ...b, ...c);
      const pTop: number[] = [], pSide: number[] = [];
      const pA = P(sLo, 0, vA), pB = P(sHi, h, vA), pC = P(sHi, h, vA + w), pD = P(sLo, 0, vA + w);
      const pE = P(sHi, 0, vA), pF = P(sHi, 0, vA + w);
      tri(pTop, pA, pB, pC); tri(pTop, pA, pC, pD);      // sloped surface
      tri(pSide, pB, pE, pF); tri(pSide, pB, pF, pC);    // lip
      tri(pSide, pA, pB, pE); tri(pSide, pD, pF, pC);    // side walls
      const gt = new THREE.BufferGeometry(); gt.setAttribute("position", new THREE.Float32BufferAttribute(pTop, 3)); gt.computeVertexNormals();
      const gs = new THREE.BufferGeometry(); gs.setAttribute("position", new THREE.Float32BufferAttribute(pSide, 3)); gs.computeVertexNormals();
      top.push(withColor(gt, C("#ffc23a")));
      side.push(withColor(gs, C("#4a4458")));
    }
    if (!top.length) return;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide });
    const m = new THREE.Mesh(mergeGeometries([...top, ...side])!, mat);
    m.castShadow = true; m.receiveShadow = true;
    this.scene.add(m);
  }

  private buildTerrain() {
    const SEG = this.quality === "high" ? 420 : 300;
    const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    geo.translate(MAP_MIN + MAP_SIZE / 2, 0, MAP_MIN + MAP_SIZE / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const cols = new Float32Array(pos.count * 3);
    const vh = new Float32Array(pos.count); // vertex heights: the roads lie on the mesh exactly as it is drawn
    const grassLo = C("#667a3c"), grassHi = C("#9a9158"), rock = C("#6e665c"), peak = C("#5f574c"), sand = C("#d2bf91"), dirt = C("#8d7352");
    const tmp = new THREE.Color();
    const r = mulberry32(55);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainH(x, z);
      const sink = tunnelSink(x, z); // under a tunnel the hillside is replaced by the tube and its lid
      pos.setY(i, (sink ?? h) - 0.6);
      vh[i] = (sink ?? h) - 0.6;
      const d = cityDist(x, z);
      const g = terrainGrad(x, z, 12);
      const slope = Math.hypot(g.x, g.y);
      const sd = seaDist(x, z);
      if (d > EXT - 330 || sd > -160) tmp.copy(sand).multiplyScalar(sd > 0 ? 0.7 : 1); // outer beach, bay shore and sea floor
      else {
        tmp.copy(grassLo).lerp(grassHi, clamp(h / 350, 0, 1));
        if (d < 260 && d > 0) tmp.copy(dirt).lerp(tmp, clamp((d - 120) / 140, 0, 1));
        tmp.lerp(rock, clamp((slope - 0.25) * 2.2, 0, 1));
        if (h > 420) tmp.lerp(peak, clamp((h - 420) / 260, 0, 1) * 0.8);
        const n = 0.9 + r() * 0.2;
        tmp.multiplyScalar(n);
      }
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    this.terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.25 }));
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);

    // height of the drawn terrain mesh (same triangles as the PlaneGeometry), so no hill pokes through a road
    const cell = MAP_SIZE / SEG, row = SEG + 1;
    const meshH = (x: number, z: number) => {
      const fx = (x - MAP_MIN) / cell, fz = (z - MAP_MIN) / cell;
      const ix = clamp(Math.floor(fx), 0, SEG - 1), iz = clamp(Math.floor(fz), 0, SEG - 1), u = fx - ix, v = fz - iz;
      const ha = vh[iz * row + ix], hb = vh[(iz + 1) * row + ix], hc = vh[(iz + 1) * row + ix + 1], hd = vh[iz * row + ix + 1];
      return u + v <= 1 ? ha + (hd - ha) * u + (hb - ha) * v : hc + (hb - hc) * (1 - u) + (hd - hc) * (1 - v);
    };
    const roadH = (x: number, z: number) => Math.max(terrainH(x, z), meshH(x, z));
    // highways as terrain-conforming ribbons
    const R: THREE.BufferGeometry[] = [];
    const ribbon = (ax: number, ay: number, bx: number, by: number, width: number, col: string, lift: number) => {
      const L = Math.hypot(bx - ax, by - ay), n = Math.ceil(L / 12);
      const dx = (bx - ax) / L, dy = (by - ay) / L, nx = -dy * width / 2, ny = dx * width / 2;
      const v: number[] = [], idx: number[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        // the middle of the road counts too (a crest between the edges)
        const mid = Math.max(0, roadH(x, y) - (roadH(x + nx, y + ny) + roadH(x - nx, y - ny)) / 2);
        v.push(x + nx, roadH(x + nx, y + ny) + lift + mid, y + ny, x - nx, roadH(x - nx, y - ny) + lift + mid, y - ny);
        if (i < n) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      R.push(withColor(g, C(col)));
    };
    for (const i of HIGHWAYS) {
      const c = i * BLOCK + ROAD / 2;
      for (const [a0, a1] of [[MAP_MIN + 40, -8], [WORLD + 8, MAP_MAX - 40]]) {
        ribbon(c, a0, c, a1, ROAD, "#3c3846", 0.3); ribbon(a0, c, a1, c, ROAD, "#3c3846", 0.3);
        ribbon(c, a0, c, a1, 3, "#e0a82a", 0.6); ribbon(a0, c, a1, c, 3, "#e0a82a", 0.6);
        ribbon(c - ROAD / 2 + 8, a0, c - ROAD / 2 + 8, a1, 2, "#c8c8d2", 0.6); ribbon(c + ROAD / 2 - 8, a0, c + ROAD / 2 - 8, a1, 2, "#c8c8d2", 0.6);
        ribbon(a0, c - ROAD / 2 + 8, a1, c - ROAD / 2 + 8, 2, "#c8c8d2", 0.6); ribbon(a0, c + ROAD / 2 - 8, a1, c + ROAD / 2 - 8, 2, "#c8c8d2", 0.6);
      }
    }
    const roads = new THREE.Mesh(mergeGeometries(R)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 }));
    roads.receiveShadow = true;
    this.scene.add(roads);
    for (const g of R) g.dispose();

    // forest + rocks
    const treeN = this.quality === "high" ? 2100 : 1200, rockN = 430;
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
      if (d < 320 || d > EXT - 420 || seaDist(x, z) > -260 || Math.hypot(x - HELI_SPOT.x, z - HELI_SPOT.y) < 230 || nearTunnel(x, z, 40) || nearAirfield(x, z, 120)) continue;
      if (isHighway(x, z) || Math.min(...HIGHWAYS.map((i) => Math.abs(x - (i * BLOCK + ROAD / 2)))) < 110 || Math.min(...HIGHWAYS.map((i) => Math.abs(z - (i * BLOCK + ROAD / 2)))) < 110) continue;
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
      if (d < 420 || d > EXT - 420 || isHighway(x, z) || seaDist(x, z) > -120 || Math.hypot(x - HELI_SPOT.x, z - HELI_SPOT.y) < 230 || nearTunnel(x, z, 60) || nearAirfield(x, z, 120)) continue;
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
    const wallMat = new THREE.MeshStandardMaterial({ map, emissiveMap: emi, emissive: 0xffffff, emissiveIntensity: 0.16, vertexColors: true, roughness: 0.7, metalness: 0.05, envMapIntensity: 0.6 });
    const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05, envMapIntensity: 0.4 });
    const neonMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0.5, 0.5, 0.5), toneMapped: false });
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
      } else L.ground.push(box(size - 24, 0.4, size - 24, mx, 2.3, mz, "#a8a49a"));
      for (const b of blk.buildings) {
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
        const faces: [number, number, number, number][] = [[cx, b.y - 0.6, b.w * 0.8, 0], [cx, b.y + b.h + 0.6, b.w * 0.8, 0], [b.x - 0.6, cz, b.h * 0.8, 1], [b.x + b.w + 0.6, cz, b.h * 0.8, 1]];
        for (const [fx, fz, len, rot] of faces) {
          if (r() < 0.45) continue;
          const sc = SHOP[Math.floor(r() * SHOP.length)];
          if (rot) L.neon.push(box(0.8, 9, len, fx, 8.5, fz, sc, 0.9), box(1.2, 1.4, len + 2, fx, 14.5, fz, sc, 2.2));
          else L.neon.push(box(len, 9, 0.8, fx, 8.5, fz, sc, 0.9), box(len + 2, 1.4, 1.2, fx, 14.5, fz, sc, 2.2));
        }
      }
      for (const t of blk.trees) {
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
    this.buildEdge();
    const E: THREE.BufferGeometry[] = [];
    const B = MAP_SIZE;
    for (const [w, d, x, z] of [[B, 3, MAP_MIN + B / 2, MAP_MIN - 2], [B, 3, MAP_MIN + B / 2, MAP_MAX + 2], [3, B, MAP_MIN - 2, MAP_MIN + B / 2], [3, B, MAP_MAX + 2, MAP_MIN + B / 2]]) E.push(box(w, 6, d, x, 2, z, "#a8a49c"));
    this.scene.add(new THREE.Mesh(mergeGeometries(E)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })));
  }

  // beach west of the city, harbour quay with containers and cranes east of it
  private buildEdge() {
    const r = mulberry32(4711);
    const P: THREE.BufferGeometry[] = [];
    const hw = HIGHWAYS.map((i) => i * BLOCK + ROAD / 2);
    // strips between the highways
    let a = 0;
    for (const c of [...hw, WORLD + ROAD]) {
      const b = Math.min(WORLD, c - ROAD / 2 - 4);
      if (b - a > 20) {
        P.push(box(216, 0.8, b - a, -112, 0.4, (a + b) / 2, "#e3cd98"));
        P.push(box(226, 2.4, b - a, WORLD + 117, 1.2, (a + b) / 2, "#6e7177"));
        P.push(box(4, 3, b - a, WORLD + 228, 1.5, (a + b) / 2, "#d9b23a"));
      }
      a = c + ROAD / 2 + 4;
    }
    // beach umbrellas and loungers
    const UMB = ["#ff3cac", "#2bf0ff", "#ffd23f", "#ff8a3d", "#3dff8b"];
    for (let i = 0; i < 46; i++) {
      const z = 60 + r() * (WORLD - 120);
      if (hw.some((c) => Math.abs(z - c) < ROAD / 2 + 30)) continue;
      const x = -40 - r() * 160;
      P.push(cyl(0.8, 0.8, 22, x, 11, z, "#e8e8ec", 6), withColor(new THREE.ConeGeometry(15, 6, 10).translate(x, 24, z), C(UMB[i % UMB.length])));
      P.push(box(18, 2, 7, x + 12, 2, z + 4, "#f4f4f6"));
    }
    // containers (solid, from world.extras) and cranes
    for (const e of this.world.extras) {
      const stack = e.detail, col = C(e.wall);
      for (let k = 0; k < stack; k++) P.push(box(e.w - 1, 25, e.h - 1, e.x + e.w / 2, 13 + k * 26, e.y + e.h / 2, col.clone().multiplyScalar(0.85 + 0.15 * ((k + e.seed * 3) % 1))));
    }
    for (const zc of [WORLD * 0.18, WORLD * 0.5, WORLD * 0.82]) {
      const x = WORLD + 205;
      for (const dz of [-22, 22]) P.push(box(4, 120, 4, x - 18, 60, zc + dz, "#d98a1a"), box(4, 120, 4, x + 18, 60, zc + dz, "#d98a1a"));
      P.push(box(44, 6, 50, x, 122, zc, "#d98a1a"), box(190, 5, 6, x - 60, 128, zc, "#d98a1a"), box(12, 10, 12, x - 130, 118, zc, "#555"));
    }
    const m = new THREE.Mesh(mergeGeometries(P)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    m.receiveShadow = true; m.castShadow = this.quality === "high"; m.userData.cast = true;
    this.scene.add(m); this.cityMeshes.push(m);
    for (const g of P) g.dispose();
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
      const b = pl.bld;
      if (!b) { this.buildSpot(pl, sign); continue; }
      const H = b.height * H_SCALE + 14;
      const w = Math.min(b.h - 10, 84);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: sign, toneMapped: false }));
      panel.rotation.y = -Math.PI / 2;
      panel.position.set(b.x - 0.8, Math.min(H - w / 8 - 4, 46), pl.y);
      this.scene.add(panel);
      // roof symbol
      const col = new THREE.Color(pl.color).multiplyScalar(1.6);
      const symMat = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
      const cx = b.x + b.w / 2, cz = b.y + b.h / 2;
      const sym = pl.kind === "hospital"
        ? mergeGeometries([new THREE.BoxGeometry(10, 44, 10), new THREE.BoxGeometry(10, 10, 44).translate(0, 8, 0)])!
        : new THREE.CylinderGeometry(20, 20, 6, 5);
      const symMesh = new THREE.Mesh(sym, symMat);
      symMesh.position.set(cx, H + (pl.kind === "hospital" ? 22 : 4), cz);
      this.scene.add(symMesh);
      // entrance ring on the sidewalk, a big one on the street for places you drive into
      const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
      if (pl.access === "foot" || pl.access === "both" || pl.access === "none") {
        const ring = new THREE.Mesh(new THREE.RingGeometry(9, 12, 32).rotateX(-Math.PI / 2), ringMat);
        ring.position.set(pl.x, 0.5, pl.y); ring.renderOrder = 1;
        this.scene.add(ring);
      }
      if (pl.access === "car" || pl.access === "both") {
        const ring = new THREE.Mesh(new THREE.RingGeometry(36, 42, 40).rotateX(-Math.PI / 2), ringMat);
        ring.position.set(pl.cx, 0.6, pl.cy); ring.renderOrder = 1;
        this.scene.add(ring);
      }
    }
  }

  resetCamera(yaw = this.camYaw) { this.camInit = false; this.camYaw = yaw; }
  cinematic: { x: number; y: number; z: number; a: number } | null = null;

  private buildLamps() {
    const pts: [number, number][] = [];
    for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) { const n = this.world.nodePos(i, j), o = ROAD / 2 + 6; pts.push([n.x - o, n.y - o], [n.x + o, n.y + o]); }
    const n = pts.length;
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.5, 52, 6).translate(0, 26, 0), new THREE.MeshStandardMaterial({ color: 0x3d3f45, roughness: 0.5, metalness: 0.6 }), n);
    const headM = new THREE.InstancedMesh(new THREE.BoxGeometry(7, 2.4, 7).translate(0, 52, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 1.0), toneMapped: false }), n);
    const poolM = new THREE.InstancedMesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2).translate(0, 0.45, 0), new THREE.MeshBasicMaterial({ map: radialTex("rgba(255,190,120,0.9)", "rgba(255,160,80,0)"), transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false }), n);
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

    // player character
    const shirtTex = canvasTex(128, 128, (g) => {
      // neutral fabric; the outfit colour tints it
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, 128, 128);
      const rr = mulberry32(5);
      for (let i = 0; i < 1200; i++) { g.fillStyle = rr() < 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)"; g.fillRect(rr() * 128, rr() * 128, 2, 2); }
    });
    this.ped = new PedModel(shirtTex, this.shadowGeo, this.shadowMat);
    this.scene.add(this.ped.group);
    // rooms you walk into have their own scene (with a second copy of the player model)
    this.interior = new InteriorView(this.scene.environment, new PedModel(shirtTex, this.shadowGeo, this.shadowMat), this.quality === "high");
    this.crowd = new CrowdRenderer(this.scene, MAX_PEDS, this.quality === "high", this.shadowGeo, this.shadowMat);
  }

  // ---------------------------------------------------------- per-frame
  private makeCar(c: Car): CarObj {
    const geo = getCarGeo(c.model, c.color);
    const group = new THREE.Group();
    group.rotation.order = "YXZ";
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
      wheels.push({ pivot, spin, front: w.front, r: w.r });
    }
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.renderOrder = 1;
    const pool = new THREE.Mesh(this.poolGeo, c.kind === "player" ? this.poolMatP : this.poolMat);
    pool.renderOrder = 2;
    group.add(shadow, pool);
    const obj: CarObj = { group, tilt, body, glass, lights, pool, shadow, wheels, model: c.model, color: c.color, wreck: false, pitch: 0, roll: 0, spinA: 0, steerA: 0 };
    if (c.kind === "player") { obj.glow = new THREE.Mesh(this.glowGeo, this.glowMat); obj.glow.renderOrder = 2; group.add(obj.glow); }
    if (c.model === "heli") { obj.rotor = new THREE.Mesh(this.rotorGeo, this.rotorMat); obj.rotor.position.y = 27; tilt.add(obj.rotor); shadow.visible = false; }
    if (c.model === "boat") { shadow.visible = false; pool.visible = false; }
    if (c.model === "jet") { obj.burner = new THREE.Mesh(this.burnerGeo, this.burnerMat); obj.burner.position.set(-33.5, 10, 0); tilt.add(obj.burner); shadow.scale.set(1.3, 1, 1.4); pool.visible = false; }
    if (c.model === "bike") shadow.scale.set(0.6, 1, 0.35);
    else if (c.model === "bus" || c.model === "truck") shadow.scale.set(1.5, 1, 1.15);
    if (isCopModel(c.model)) {
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
      if (c.model === "police" || c.model === "polsuv" || c.model === "interceptor") {
        const hz = SPECS[c.model].W / 2 + 0.15, dy = c.model === "polsuv" ? 11 : c.model === "interceptor" ? 7 : 8.2;
        const d1 = new THREE.Mesh(this.decalGeo, this.decalMat); d1.position.set(-1, dy, hz); tilt.add(d1);
        const d2 = new THREE.Mesh(this.decalGeo, this.decalMatB); d2.position.set(-1, dy, -hz); d2.rotation.y = Math.PI; tilt.add(d2);
      }
      if (c.model === "police") {
        const d3 = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), this.roofDecalMat); d3.rotation.x = -Math.PI / 2; d3.rotation.z = -Math.PI / 2; d3.position.set(-3, geo.roofY + 0.05, 0); tilt.add(d3);
        const d4 = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), this.roofDecalMat); d4.rotation.x = -Math.PI / 2; d4.rotation.z = -Math.PI / 2; d4.position.set(14, 12.15, 0); tilt.add(d4);
      }
      obj.bar = { reds, blues, white };
    }
    this.scene.add(group);
    return obj;
  }

  private disposeCar(o: CarObj) {
    this.scene.remove(o.group);
    if (o.bar) { o.bar.reds.dispose(); o.bar.blues.dispose(); o.bar.white.dispose(); }
  }

  private syncCars(g: Game, dt: number) {
    const seen = this.seenCars;
    seen.clear();
    const t = g.t;
    for (const c of g.cars) {
      seen.add(c);
      let o = this.carObjs.get(c);
      if (o && (o.model !== c.model || o.color !== c.color || (o.wreck && !c.dead))) { this.disposeCar(o); o = undefined; }
      if (!o) { o = this.makeCar(c); this.carObjs.set(c, o); }
      o.group.position.set(c.x, c.z, c.y);
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
      if (c.model === "jet") {
        // nose follows the climb, wings bank into the turn, gear folds away in the air, afterburner glows
        o.tilt.rotation.z = c.air ? clamp(Math.atan2(c.vz, Math.max(150, c.vF)), -0.6, 0.6) : 0;
        o.tilt.rotation.x = c.air ? clamp(-c.av * 0.45, -0.9, 0.9) : 0;
        o.group.rotation.x = 0; o.group.rotation.z = 0;
        if (o.burner) { const k = c.dead ? 0 : c.rotor; o.burner.visible = k > 0.05; o.burner.scale.set(0.6 + k * 1.4, 0.8 + k * 0.4, 0.8 + k * 0.4); }
        o.shadow.visible = !c.air;
      } else if (c.model === "heli") {
        // nose down when flying forward, bank into turns, spinning rotor
        o.tilt.rotation.z = clamp(-c.vF / 1400, -0.3, 0.2);
        o.tilt.rotation.x = clamp(-c.av * 0.12, -0.3, 0.3);
        if (o.rotor) o.rotor.rotation.y = c.rotor;
      } else if (c.model === "boat") {
        o.tilt.rotation.z = clamp(c.vF / 2600, -0.05, 0.16) + Math.sin(t * 2.1 + c.x * 0.01) * 0.02; // bow up when fast
        o.tilt.rotation.x = clamp(-c.av * 0.06, -0.15, 0.15) + Math.sin(t * 1.7 + c.y * 0.01) * 0.02;
      } else if (c.model === "bike") {
        // lean into the curve; the rider is only there when somebody rides it
        o.tilt.rotation.x = clamp(-c.av * Math.min(1, c.speed / 250) * 0.22, -0.55, 0.55);
        o.glass.visible = c === g.player ? !g.onFoot : c.kind !== "civ" || c.driver;
      } else o.tilt.rotation.x = clamp(-c.vR / 900, -0.09, 0.09);
      if (!isCraft(c.model)) o.tilt.rotation.z = c.dead ? 0 : c.throttle > 0 ? 0.025 * c.throttle : c.throttle < 0 && c.vF > 50 ? -0.04 : 0;
      o.pool.visible = !c.air && !c.dead && c.model !== "boat";
      if (c.dead && !o.wreck) {
        o.wreck = true; o.body.material = this.wreckMat; o.glass.material = this.wreckMat; o.lights.visible = false; o.pool.visible = false;
        if (o.glow) o.glow.visible = false;
        if (o.bar) { o.bar.reds.color.setScalar(0.1); o.bar.blues.color.setScalar(0.1); o.bar.white.color.setScalar(0.1); }
      }
      if (!o.wreck) {
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
      for (const w of o.wheels) { if (w.front) w.pivot.rotation.y = o.steerA; w.spin.rotation.z = -o.spinA / w.r; }
    }
    for (const [c, o] of this.carObjs) if (!seen.has(c)) { this.disposeCar(o); this.carObjs.delete(c); }
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
    this.moon.position.set(g.fx - 900, g.fz + 520, g.fy - 330);
    this.moon.target.position.set(g.fx, g.fz, g.fy);
    this.moon.target.updateMatrixWorld();
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

  // ---------------------------------------------------------- tunnels
  private tunnelRoofs: THREE.Mesh[] = []; // ceiling and lid: hidden in the bird's eye view while you drive inside
  private buildTunnels() {
    const std: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = [], roofG: THREE.BufferGeometry[] = [];
    const strip = (dst: THREE.BufferGeometry[], col: string, s0: number, s1: number, edge: (s: number) => [number[], number[]]) => {
      const n = Math.max(1, Math.ceil((s1 - s0) / 40)), v: number[] = [], idx: number[] = [];
      for (let i = 0; i <= n; i++) { const [a, b] = edge(s0 + ((s1 - s0) * i) / n); v.push(...a, ...b); if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
      g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((v.length / 3) * 2), 2)); // same attributes as the boxes it is merged with
      dst.push(withColor(g, C(col)));
    };
    const sign = (text: string) => canvasTex(512, 96, (g) => {
      g.fillStyle = "#1d4e89"; g.fillRect(0, 0, 512, 96); g.strokeStyle = "#ffffff"; g.lineWidth = 6; g.strokeRect(6, 6, 500, 84);
      g.fillStyle = "#ffffff"; g.font = "bold 64px 'Bebas Neue', Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 256, 52);
    });
    for (const t of TUNNELS) {
      const P = (s: number, d: number, y: number) => (t.alongX ? [s, y, t.c + d] : [t.c + d, y, s]);
      const R = (s: number) => tunnelRoad(t, s);
      const S0 = t.cov0 - TUN_PORTAL, S1 = t.cov1 + TUN_PORTAL;
      // walls (dark band at the bottom, light tiles above), raised walkways, ceiling
      for (const sd of [-1, 1]) {
        strip(std, "#3a3d45", S0, S1, (s) => [P(s, sd * TUN_HW, R(s) - 2), P(s, sd * TUN_HW, R(s) + 12)]);
        strip(std, "#8e8b84", S0, S1, (s) => [P(s, sd * TUN_HW, R(s) + 12), P(s, sd * TUN_HW, R(s) + TUN_H)]);
        strip(std, "#5f5d58", S0, S1, (s) => [P(s, sd * 76, R(s) + 3), P(s, sd * TUN_HW, R(s) + 3)]);
        strip(std, "#8a8780", S0, S1, (s) => [P(s, sd * 76, R(s)), P(s, sd * 76, R(s) + 3)]);
        strip(glow, "#ffb84a", S0, S1, (s) => [P(s, sd * (TUN_HW - 0.3), R(s) + 30), P(s, sd * (TUN_HW - 0.3), R(s) + 31.5)]);
      }
      strip(roofG, "#35343a", S0, S1, (s) => [P(s, -TUN_HW - 1, R(s) + TUN_H), P(s, TUN_HW + 1, R(s) + TUN_H)]);
      // lamps on the ceiling, emergency signs on the walls
      for (let s = S0 + 20; s < S1; s += 48) for (const d of [-36, 36]) { const [x, y, z] = P(s, d, R(s) + TUN_H - 1); glow.push(t.alongX ? box(16, 1.2, 4, x, y, z, "#fff2d0", 2.2) : box(4, 1.2, 16, x, y, z, "#fff2d0", 2.2)); }
      for (let s = S0 + 150; s < S1; s += 400) for (const sd of [-1, 1]) { const [x, y, z] = P(s, sd * (TUN_HW - 0.6), R(s) + 22); glow.push(t.alongX ? box(10, 5, 1, x, y, z, "#3dff8b", 1.8) : box(1, 5, 10, x, y, z, "#3dff8b", 1.8)); }
      // portal blocks with the opening, warning stripes and the name sign
      for (const end of [0, 1]) {
        const sA = end === 0 ? S0 : t.cov1, sB = end === 0 ? t.cov0 : S1, top = end === 0 ? t.top0 : t.top1;
        const lo = Math.min(R(sA), R(sB)) - 40, hiRoad = Math.max(R(sA), R(sB)), ms = (sA + sB) / 2, ls = sB - sA;
        const blk = (d0: number, d1: number, y0: number, y1: number, col: string) => {
          const md = (d0 + d1) / 2, ld = d1 - d0, [x, , z] = P(ms, md, 0);
          std.push(t.alongX ? box(ls, y1 - y0, ld, x, (y0 + y1) / 2, z, col) : box(ld, y1 - y0, ls, x, (y0 + y1) / 2, z, col));
        };
        blk(TUN_HW, TUN_SIDE + 8, lo, top, "#8e8a82"); blk(-TUN_SIDE - 8, -TUN_HW, lo, top, "#8e8a82"); blk(-TUN_HW, TUN_HW, hiRoad + TUN_H, top, "#a09b92");
        // warning stripes round the opening, on the outer face
        const face = end === 0 ? sA - 0.6 : sB + 0.6, fr = R(face);
        for (let k = -TUN_HW; k < TUN_HW; k += 12) { const [x, y, z] = P(face, k + 6, fr + TUN_H + 3); std.push(t.alongX ? box(1, 6, 6, x, y, z, (k / 12) % 2 === 0 ? "#ffd23f" : "#15161b") : box(6, 6, 1, x, y, z, (k / 12) % 2 === 0 ? "#ffd23f" : "#15161b")); }
        const pm = new THREE.Mesh(new THREE.PlaneGeometry(110, 21), new THREE.MeshBasicMaterial({ map: sign(t.name), toneMapped: false }));
        const [px, py, pz] = P(face + (end === 0 ? -0.4 : 0.4), 0, fr + TUN_H + 18);
        pm.position.set(px, py, pz);
        pm.rotation.y = t.alongX ? (end === 0 ? -Math.PI / 2 : Math.PI / 2) : end === 0 ? Math.PI : 0;
        this.scene.add(pm);
      }
      // the lid: hillside over the tube (follows the mountain, never lower than the ceiling)
      const lidV: number[] = [], lidC: number[] = [], lidI: number[] = [];
      const ns = Math.ceil((t.cov1 - t.cov0) / 25), nd = 20, DW = 230;
      const grass = C("#667a3c"), grassHi = C("#9a9158"), rock = C("#6e665c"), tmp = new THREE.Color();
      const hAt = (s: number, d: number) => { const [x, , z] = P(s, d, 0), nat = naturalH(x, z); return Math.abs(d) <= 170 ? Math.max(nat, R(s) + TUN_H + 8) : nat; };
      for (let i = 0; i <= ns; i++) for (let j = 0; j <= nd; j++) {
        const sv = t.cov0 + ((t.cov1 - t.cov0) * i) / ns, d = -DW + (2 * DW * j) / nd, h = hAt(sv, d);
        const [x, , z] = P(sv, d, 0);
        lidV.push(x, h + 0.8, z);
        const slope = Math.abs(hAt(sv + 12, d) - hAt(sv - 12, d)) / 24 + Math.abs(hAt(sv, d + 12) - hAt(sv, d - 12)) / 24;
        tmp.copy(grass).lerp(grassHi, clamp(h / 350, 0, 1)).lerp(rock, clamp((slope - 0.25) * 2.2, 0, 1));
        lidC.push(tmp.r, tmp.g, tmp.b);
        if (i < ns && j < nd) { const a = i * (nd + 1) + j, b = a + nd + 1; lidI.push(a, b, a + 1, b, b + 1, a + 1); }
      }
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.Float32BufferAttribute(lidV, 3)); lg.setAttribute("color", new THREE.Float32BufferAttribute(lidC, 3)); lg.setIndex(lidI); lg.computeVertexNormals();
      const lid = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.25 }));
      lid.receiveShadow = true;
      this.scene.add(lid); this.tunnelRoofs.push(lid);
    }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, envMapIntensity: 0.12 });
    const tube = new THREE.Mesh(mergeGeometries(std)!, mat);
    tube.castShadow = true; tube.receiveShadow = true; tube.userData.cast = true;
    this.scene.add(tube); this.cityMeshes.push(tube);
    const ceil = new THREE.Mesh(mergeGeometries(roofG)!, mat);
    ceil.castShadow = true; ceil.receiveShadow = true; ceil.userData.cast = true;
    this.scene.add(ceil); this.cityMeshes.push(ceil); this.tunnelRoofs.push(ceil);
    this.scene.add(new THREE.Mesh(mergeGeometries(glow)!, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide })));
    for (const g of [...std, ...glow, ...roofG]) g.dispose();
  }

  // ---------------------------------------------------------- airfield: runway, apron, hangar, tower
  private buildAirfield() {
    const A = AIRFIELD, P: THREE.BufferGeometry[] = [], G: THREE.BufferGeometry[] = [];
    const len = A.y1 - A.y0, cy = (A.y0 + A.y1) / 2;
    P.push(box(A.hw * 2, 0.6, len, A.x, 0.3, cy, "#3a3742"));
    for (let y = A.y0 + 80; y < A.y1 - 80; y += 60) P.push(box(2.4, 0.7, 30, A.x, 0.35, y, "#f4f4f4"));
    for (const sd of [-1, 1]) P.push(box(2, 0.7, len - 10, A.x + sd * (A.hw - 5), 0.35, cy, "#f4f4f4"));
    for (const yEnd of [A.y0 + 30, A.y1 - 30]) for (let k = -4; k <= 4; k++) if (k) P.push(box(4, 0.7, 34, A.x + k * 10, 0.36, yEnd, "#f4f4f4"));
    for (let y = A.y0 + 10; y < A.y1; y += 80) for (const sd of [-1, 1]) G.push(box(2.4, 1.6, 2.4, A.x + sd * (A.hw + 3), 1, y, sd < 0 ? "#3dff8b" : "#ffd23f", 2));
    // apron between runway and hangar
    P.push(box(150, 0.5, 520, A.x + A.hw + 75, 0.25, 3460, "#4a4752"));
    for (const e of this.world.extras) {
      if (e.detail !== -1) continue;
      const cx = e.x + e.w / 2, cz = e.y + e.h / 2, H = e.height * H_SCALE + 14;
      if (e.w > 100) {
        // hangar: corrugated walls, big gate towards the runway
        P.push(box(e.w, H - 4, e.h, cx, (H - 4) / 2, cz, "#8f959e"), box(e.w + 4, 4, e.h + 4, cx, H - 2, cz, "#6a707a"));
        for (let k = 0; k < 7; k++) P.push(box(e.w + 0.6, 1, 2, cx, H - 4, e.y + 20 + k * 25, "#9aa3ad"));
        P.push(box(1, H * 0.7, e.h * 0.7, e.x - 0.6, H * 0.35, cz, "#3a3d45"));
        for (let k = 0; k < 10; k++) P.push(box(1.2, 4, e.h * 0.07, e.x - 1, H * 0.7 + 2, e.y + e.h * 0.15 + k * e.h * 0.07, k % 2 ? "#15161b" : "#ffd23f"));
      } else {
        // tower: shaft, glass cab, antenna
        P.push(box(e.w * 0.6, H - 22, e.h * 0.6, cx, (H - 22) / 2, cz, "#b8b2a8"), box(e.w + 6, 3, e.h + 6, cx, H - 20.5, cz, "#5a5d66"), box(e.w + 4, 2, e.h + 4, cx, H, cz, "#5a5d66"), box(1, 18, 1, cx, H + 9, cz, "#c9ced8"));
        G.push(box(e.w + 3, 16, e.h + 3, cx, H - 10, cz, "#8ad0ff", 1.2), box(2, 2, 2, cx, H + 18.5, cz, "#ff2040", 2.5));
      }
    }
    // windsock
    P.push(cyl(0.8, 0.8, 34, A.x + A.hw + 30, 17, A.y0 + 60, "#c9ced8", 6), withColor(new THREE.ConeGeometry(3.5, 16, 10).rotateZ(Math.PI / 2).translate(A.x + A.hw + 38, 32, A.y0 + 60), C("#ff8a1f")));
    const m = new THREE.Mesh(mergeGeometries(P)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -1 }));
    m.receiveShadow = true; m.castShadow = this.quality === "high"; m.userData.cast = true;
    this.scene.add(m); this.cityMeshes.push(m);
    this.scene.add(new THREE.Mesh(mergeGeometries(G)!, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
    for (const g of [...P, ...G]) g.dispose();
  }

  // ---------------------------------------------------------- police fighter jets
  private jetObjs: { g: THREE.Group; burner: THREE.Mesh }[] = [];
  private buildPoliceJets() {
    const geo = jetGeo("#22355e", true);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group(); g.rotation.order = "YXZ";
      const tilt = new THREE.Group();
      tilt.add(new THREE.Mesh(geo.body, this.bodyMat), new THREE.Mesh(geo.glass, this.glassMat), new THREE.Mesh(geo.lights, this.lightMat));
      const burner = new THREE.Mesh(this.burnerGeo, this.burnerMat); burner.position.set(-33.5, 10, 0); burner.scale.set(1.8, 1.1, 1.1);
      tilt.add(burner); tilt.position.y = -10;
      g.add(tilt); g.visible = false;
      this.scene.add(g);
      this.jetObjs.push({ g, burner });
    }
  }
  private syncPoliceJets(g: Game) {
    const js = g.police.jets;
    this.jetObjs.forEach((o, i) => {
      const j = js[i];
      o.g.visible = !!j && g.state !== "menu";
      if (!j) return;
      o.g.position.set(j.x, j.z, j.y);
      o.g.rotation.set(j.dead ? j.bank : clamp(-j.bank * 0.6, -1.1, 1.1), -j.a, Math.atan2(j.vz, 760) * 0.8);
      o.burner.visible = !j.dead;
      o.burner.scale.x = 1.6 + Math.sin(g.t * 40 + i) * 0.2;
    });
  }

  private tmpM = new THREE.Matrix4(); private tmpQ = new THREE.Quaternion(); private tmpS = new THREE.Vector3(); private tmpP = new THREE.Vector3(); private up = new THREE.Vector3(0, 1, 0);

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
      this.orbit += dt * 0.12;
      const d = 210;
      tgt.set(p.x + Math.cos(this.orbit) * d, 80, p.y + Math.sin(this.orbit) * d);
      lx = p.x; ly = 16; lz = p.y; fov = 55; kp = 3;
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
        const eye = getCarGeo(p.model, p.color).roofY - 3.2;
        tgt.set(p.x + cx * 3 - rx * 5, p.z + eye + roll * 3, p.y + cy * 3 - ry * 5);
        lx = p.x + cx * 220 - rx * 5; ly = p.z + eye - 5 + (p.air ? p.vz * 0.05 : 0); lz = p.y + cy * 220 - ry * 5;
      }
      fov = 78 + clamp(sp / 700, 0, 1) * 10 + (p.nitro && !g.onFoot ? 6 : 0);
      kp = 40; instant = true;
    } else if (this.camMode === "chase") {
      if (g.onFoot) {
        const pd = g.ped;
        if (Math.hypot(pd.vx, pd.vy) > 30) this.camYaw += wrapA(Math.atan2(pd.vy, pd.vx) - this.camYaw) * (1 - Math.exp(-dt * 2.5));
        const cx = Math.cos(this.camYaw), cy = Math.sin(this.camYaw);
        let dist = 95;
        for (let s = 0.15; s <= 1.0001; s += 0.1) if (this.world.isSolid(fx - cx * 95 * s, fy - cy * 95 * s, 6)) { dist = Math.max(28, 95 * s - 10); break; }
        tgt.set(fx - cx * dist, fz + 48, fy - cy * dist);
        lx = fx + cx * 30; ly = fz + 16; lz = fy + cy * 30; fov = 60; kp = 9;
      } else {
        let desired = p.a;
        if (p.vF > 60) desired = p.a + wrapA(Math.atan2(p.vy, p.vx) - p.a) * 0.55;
        this.camYaw += wrapA(desired - this.camYaw) * (1 - Math.exp(-dt * 5));
        const fly = isAircraft(p.model);
        const full = 112 + sp * 0.07 + (fly ? (p.model === "jet" ? 110 : 70) : 0);
        let dist = full;
        const cx = Math.cos(this.camYaw), cy = Math.sin(this.camYaw);
        for (let s = 0.12; s <= 1.0001; s += 0.08) if (this.world.isSolid(p.x - cx * full * s, p.y - cy * full * s, 6)) { dist = Math.max(36, full * s - 12); break; }
        const behindH = terrainH(p.x - cx * dist, p.y - cy * dist);
        const h = (46 + sp * 0.025 + (fly ? 45 : 0)) * (0.55 + 0.45 * (dist / full)) + (g.ending ? 40 : 0);
        tgt.set(p.x - cx * dist, Math.max(p.z + h, behindH + 22), p.y - cy * dist);
        lx = p.x + cx * 70; ly = p.z + 12; lz = p.y + cy * 70;
        fov = 62 + clamp(sp / 700, 0, 1) * 14 + (p.nitro ? 8 : 0);
        kp = 11;
      }
    } else {
      const ax = fx + g.fvx * 0.35, az = fy + g.fvy * 0.35;
      const h = (g.onFoot ? 320 : 560 + sp * 0.35) + (g.ending ? -120 : 0);
      tgt.set(ax, fz + h, az + h * 0.42);
      lx = ax; ly = fz; lz = az; fov = 50 + (p.nitro && !g.onFoot ? 5 : 0); kp = 5;
      this.camYaw = -Math.PI / 2;
    }
    if (!this.camInit) { this.camPos.copy(tgt); this.camLook.set(lx, ly, lz); this.camInit = true; }
    if (instant) { this.camPos.copy(tgt); this.camLook.set(lx, ly, lz); }
    else {
      const k = 1 - Math.exp(-dt * kp);
      this.camPos.lerp(tgt, k);
      this.camLook.lerp(tgt.set(lx, ly, lz), 1 - Math.exp(-dt * kp * 1.4));
    }
    // never look through a wall, a hillside or a tunnel ceiling: pull the camera in front of it
    if (cin) this.unblock(cin.x, cin.z + 20, cin.y);
    else if (g.state !== "menu" && this.camMode === "chase") this.unblock(fx, fz + 14, fy);
    const cam = this.camera;
    cam.position.copy(this.camPos);
    cam.position.x += g.shakeX * 0.5; cam.position.y += g.shakeY * 0.35;
    cam.lookAt(this.camLook);
    cam.rotateZ(g.shakeR);
    this.fov += (fov - this.fov) * (1 - Math.exp(-dt * 4));
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    this.sky.position.copy(cam.position);
  }

  // the camera (already moved) and the point it looks at: is anything solid in between?
  private unblock(tx: number, th: number, ty: number) {
    const c = this.camPos, dx = c.x - tx, dh = c.y - th, dy = c.z - ty, N = 16;
    let free = 1;
    for (let i = 1; i <= N; i++) {
      const k = i / N, x = tx + dx * k, h = th + dh * k, y = ty + dy * k;
      const hit = (this.world.isSolid(x, y, 4) && h < this.world.roofAt(x, y) + 4) || h < terrainH(x, y) + 3 || inRock(x, y, h + 6);
      if (hit) { free = (i - 1) / N; break; }
    }
    if (free < 1) { const k = Math.max(0.1, free - 0.04); c.set(tx + dx * k, th + dh * k, ty + dy * k); }
  }

  // draw: the room you are in, or the city
  private draw(scene: THREE.Scene, cam: THREE.Camera, dt: number) {
    if (this.composer && this.renderPass) {
      const ps = this.renderPass.scene, pc = this.renderPass.camera;
      this.renderPass.scene = scene; this.renderPass.camera = cam;
      this.composer.render(dt);
      this.renderPass.scene = ps; this.renderPass.camera = pc;
    } else this.renderer.render(scene, cam);
  }

  render(g: Game, dt: number) {
    if (g.inside) {
      const ins = g.inside;
      this.interior.load(ins.room.id);
      this.interior.update(g, dt, this.w / Math.max(1, this.h), ins.spot);
      this.renderer.toneMappingExposure = 0.85; // indoor light: no blown-out white walls
      this.draw(this.interior.scene, this.interior.camera, dt);
      this.renderer.toneMappingExposure = 1;
      return;
    }
    // driving through a tunnel in the bird's eye view: the hill and the ceiling are left out
    const tube = !!inTube(g.fx, g.fy, g.fz);
    const hideRoof = this.camMode === "top" && tube;
    for (const m of this.tunnelRoofs) m.visible = !hideRoof;
    // in a tunnel the daylight fades, the lamps take over (and back when you come out)
    this.dark += ((tube && g.state !== "menu" ? 1 : 0) - this.dark) * Math.min(1, dt * 2.5);
    this.hemi.intensity = 1.35 - this.dark * 0.95; this.moon.intensity = 4.2 - this.dark * 3.6;
    this.syncCars(g, dt);
    this.syncPickups(g);
    this.syncProjs(g);
    this.syncSkids(g);
    this.syncParticles(g);
    this.syncLights(g);
    this.syncArrow(g);
    this.syncMarkers(g);
    this.syncHeli(g);
    this.syncPoliceJets(g);
    this.syncSpikes(g);
    this.ped.update(g, dt);
    this.crowd.update(g.peds.list, g.state !== "menu");
    this.updateCamera(g, dt);
    const scale = this.renderer.domElement.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.smoke.mat.uniforms.scale.value = scale;
    this.glowPts.mat.uniforms.scale.value = scale;
    this.draw(this.scene, this.camera, dt);
  }
}
