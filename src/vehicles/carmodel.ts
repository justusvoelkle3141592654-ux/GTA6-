// realistic procedural cars (no external models): the body is lofted from cross sections along the car,
// the wheel arches are cut out of it, doors are separate parts that swing open, every window is its own pane,
// there is an interior with seats, dashboard and a steering wheel, and the lights are separate parts that switch
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CarModel } from "./vehicles";

// all sizes in world units (10 units = 1 m); x forward, y up, z to the right side
export interface Shape {
  L: number; W: number; R: number;       // length, width, wheel radius
  wf: number; wr: number;                // x of the front / rear axle
  y0: number;                            // sill height (bottom of the body)
  nose: number; cowl: number; cowlX: number; // top of the bumper at the nose, hood height at the windshield, x of the windshield base
  roofF: number; roofR: number; roof: number; // roof front / rear x and height
  deckX: number; deck: number; tail: number;  // rear window base, rear deck height there, top at the tail
  belt: number;                          // window line on the sides
  doors: 2 | 4; taper: number;           // cabin narrower than the body at the roof (0..1)
  box?: { x0: number; x1: number; h: number; col?: string }; // cargo box behind the cab (vans, trucks, bus)
  open?: boolean;                        // convertible: no roof
  seatX: number;                         // x of the driver's seat (hip)
  track?: number;                        // wheel centre distance from the middle (open wheels outside the body)
  wd?: number;                           // tyre width
}
const S = (o: Partial<Shape> & Pick<Shape, "L" | "W" | "R">): Shape => ({
  wf: o.L * 0.31, wr: -o.L * 0.29, y0: 2.2, nose: 6.8, cowl: 9.4, cowlX: o.L * 0.19, roofF: o.L * 0.035, roofR: -o.L * 0.235, roof: 14.5,
  deckX: -o.L * 0.355, deck: 10, tail: 9.6, belt: 9.2, doors: 4, taper: 0.8, seatX: -o.L * 0.05, ...o,
});
export const SHAPES: Partial<Record<CarModel, Shape>> = {
  sedan: S({ L: 48, W: 18.6, R: 3.3 }),
  taxi: S({ L: 48, W: 18.6, R: 3.3 }),
  police: S({ L: 50, W: 19, R: 3.4, roof: 14.8 }),
  unmarked: S({ L: 48, W: 18.8, R: 3.4 }),
  sport: S({ L: 45, W: 19, R: 3.4, nose: 6, cowl: 8.8, cowlX: 7, roofF: 0, roofR: -9, roof: 12.8, deckX: -15, deck: 9.4, tail: 9.2, belt: 8.6, doors: 2, taper: 0.74, seatX: -4 }),
  super: S({ L: 46, W: 20, R: 3.5, nose: 5, cowl: 8, cowlX: 10, roofF: 1, roofR: -6, roof: 11.6, deckX: -13, deck: 9.2, tail: 9.4, belt: 8.2, doors: 2, taper: 0.7, seatX: -1 }),
  muscle: S({ L: 49, W: 19.5, R: 3.5, nose: 7.5, cowl: 9.8, cowlX: 8, roofF: 0, roofR: -10, roof: 13.4, deckX: -15.5, deck: 10, tail: 9.8, belt: 9.4, doors: 2, taper: 0.78, seatX: -5 }),
  roadster: S({ L: 42, W: 18.2, R: 3.3, nose: 6, cowl: 8.6, cowlX: 5, roofF: 1, roofR: -6, roof: 11.6, deckX: -9, deck: 9.2, tail: 9.2, belt: 8.6, doors: 2, open: true, seatX: -4 }),
  compact: S({ L: 40, W: 17.6, R: 3.1, nose: 7, cowl: 9.6, cowlX: 9, roofF: 4, roofR: -14, roof: 15, deckX: -17, deck: 13, tail: 11.5, belt: 9.4, seatX: -1 }),
  wagon: S({ L: 48.5, W: 18.6, R: 3.3, roofR: -21, deckX: -23, deck: 13.5, tail: 11 }),
  suv: S({ L: 48, W: 20, R: 3.9, y0: 3.4, nose: 9.5, cowl: 11.6, cowlX: 12, roofF: 6, roofR: -19, roof: 17.6, deckX: -22.5, deck: 15, tail: 12.5, belt: 11.6, taper: 0.86, seatX: -1 }),
  offroad: S({ L: 47, W: 19.6, R: 4.2, y0: 4.2, nose: 10.5, cowl: 12.2, cowlX: 11, roofF: 6, roofR: -20, roof: 19, deckX: -22.5, deck: 17, tail: 13, belt: 12.4, taper: 0.92, seatX: -1 }),
  pickup: S({ L: 54, W: 20, R: 4, y0: 3.6, nose: 10, cowl: 12, cowlX: 14, roofF: 8, roofR: -5, roof: 18.6, deckX: -7, deck: 12, tail: 12, belt: 12, taper: 0.9, seatX: 2 }),
  van: S({ L: 52, W: 20, R: 3.5, y0: 2.6, nose: 9, cowl: 11.5, cowlX: 18, roofF: 13, roofR: -25, roof: 22, deckX: -26, deck: 21, tail: 20, belt: 12, taper: 0.97, doors: 2, box: { x0: -26, x1: 12, h: 22 }, seatX: 9 }),
  ambulance: S({ L: 56, W: 20.5, R: 3.6, y0: 2.8, nose: 9, cowl: 11.5, cowlX: 21, roofF: 16, roofR: -27, roof: 23.5, deckX: -28, deck: 22.5, tail: 22, belt: 12, taper: 0.97, doors: 2, box: { x0: -28, x1: 13, h: 25, col: "#f4f4f6" }, seatX: 11 }),
  icecream: S({ L: 54, W: 20.5, R: 3.6, y0: 2.8, nose: 9, cowl: 11.5, cowlX: 20, roofF: 15, roofR: -26, roof: 23, deckX: -27, deck: 22, tail: 22, belt: 12, taper: 0.97, doors: 2, box: { x0: -27, x1: 12, h: 24, col: "#f2c7d8" }, seatX: 10 }),
  swat: S({ L: 54, W: 21, R: 3.8, y0: 3.2, nose: 10, cowl: 12.5, cowlX: 19, roofF: 14, roofR: -26, roof: 23, deckX: -27, deck: 22, tail: 21, belt: 13, taper: 0.97, doors: 2, box: { x0: -27, x1: 12, h: 23 }, seatX: 9 }),
  truck: S({ L: 68, W: 24, R: 4.8, y0: 4.4, nose: 13, cowl: 17, cowlX: 30, roofF: 27, roofR: 14, roof: 31, deckX: 13, deck: 15, tail: 14, belt: 17, taper: 0.97, doors: 2, box: { x0: -34, x1: 12, h: 34, col: "#e4e2dc" }, seatX: 21 }),
  garbage: S({ L: 72, W: 24.5, R: 4.8, y0: 4.4, nose: 13, cowl: 17, cowlX: 32, roofF: 29, roofR: 16, roof: 31, deckX: 15, deck: 15, tail: 14, belt: 17, taper: 0.97, doors: 2, box: { x0: -36, x1: 14, h: 32, col: "#3c6e47" }, seatX: 23 }),
  tow: S({ L: 66, W: 24, R: 4.8, y0: 4.4, nose: 13, cowl: 17, cowlX: 29, roofF: 26, roofR: 13, roof: 31, deckX: 12, deck: 15, tail: 13, belt: 17, taper: 0.97, doors: 2, seatX: 20 }),
  fire: S({ L: 82, W: 25, R: 4.9, y0: 4.4, nose: 14, cowl: 18, cowlX: 37, roofF: 33, roofR: 18, roof: 32, deckX: 17, deck: 16, tail: 15, belt: 18, taper: 0.97, doors: 4, box: { x0: -41, x1: 16, h: 30 }, seatX: 27 }),
  hyper: S({ L: 47, W: 20.6, R: 3.6, nose: 4.6, cowl: 7.6, cowlX: 11, roofF: 2, roofR: -5, roof: 11, deckX: -12, deck: 9, tail: 9.6, belt: 7.8, doors: 2, taper: 0.66, seatX: 0 }),
  lowrider: S({ L: 56, W: 19.8, R: 3.2, y0: 1.6, nose: 7.2, cowl: 8.6, cowlX: 10, roofF: 1, roofR: -12, roof: 13.6, deckX: -16, deck: 8.6, tail: 8.4, belt: 8.6, doors: 2, open: true, seatX: -5, wf: 18, wr: -17 }),
  monster: S({ L: 50, W: 21, R: 9, y0: 14, nose: 20, cowl: 22.5, cowlX: 12, roofF: 6, roofR: -6, roof: 31, deckX: -8, deck: 22, tail: 22, belt: 22.5, doors: 2, taper: 0.9, seatX: 0, wf: 17, wr: -16, track: 13.5, wd: 8 }),
  formula: S({ L: 50, W: 9, R: 3.6, y0: 1.2, nose: 3, cowl: 5.4, cowlX: 6, roofF: 0, roofR: -6, roof: 9, deckX: -8, deck: 7.6, tail: 6.2, belt: 5.4, doors: 2, open: true, taper: 0.9, seatX: -3, wf: 17, wr: -15, track: 9.6, wd: 3.8 }),
  interceptor: S({ L: 47, W: 20.4, R: 3.6, nose: 4.8, cowl: 7.8, cowlX: 11, roofF: 2, roofR: -6, roof: 11.6, deckX: -13, deck: 9.2, tail: 9.6, belt: 8, doors: 2, taper: 0.68, seatX: 0 }),
  polsuv: S({ L: 49, W: 20.4, R: 3.9, y0: 3.4, nose: 9.5, cowl: 11.6, cowlX: 12, roofF: 6, roofR: -19, roof: 17.6, deckX: -22.5, deck: 15, tail: 12.5, belt: 11.6, taper: 0.86, seatX: -1 }),
  bus: S({ L: 100, W: 25, R: 4.8, y0: 3.4, nose: 14, cowl: 16, cowlX: 49, roofF: 47, roofR: -49, roof: 31, deckX: -49.5, deck: 31, tail: 30, belt: 14, taper: 0.98, doors: 2, seatX: 41, wf: 32, wr: -28 }),
};
export const hasRig = (m: CarModel) => !!SHAPES[m];

// the look of each model (body sculpting and the parts that make it recognisable)
type Grille = "mesh" | "bars" | "split" | "truck" | "none";
type Lamp = "slim" | "round" | "square";
type Tail = "bar" | "split" | "vertical" | "round";
type Rim = "five" | "multi" | "mesh" | "steel" | "dish" | "wire" | "turbine";
interface Style {
  crease: number;   // shoulder line: how far it stands out (0 soft .. 1 sharp)
  flare: number;    // wheel arches: extra width over the wheels
  grille: Grille; lamp: Lamp; tail: Tail; rim: Rim; rimCol: string;
  chrome?: boolean; // chrome window line and bumper strips
  spoiler?: "lip" | "duck" | "wing"; skirts?: boolean; diffuser?: boolean; rails?: boolean; scoop?: boolean; antenna?: boolean; pipes?: 1 | 2;
}
const ST = (o: Partial<Style>): Style => ({ crease: 0.5, flare: 0.5, grille: "bars", lamp: "slim", tail: "split", rim: "five", rimCol: "#c9ced8", ...o });
const STYLE: Partial<Record<CarModel, Style>> = {
  sedan: ST({ chrome: true, antenna: true }),
  taxi: ST({ rim: "steel", rimCol: "#b8bec8", antenna: true }),
  police: ST({ grille: "mesh", rim: "steel", rimCol: "#9aa3ad", antenna: true }),
  unmarked: ST({ grille: "mesh", rim: "five", rimCol: "#3a3d45", antenna: true }),
  sport: ST({ crease: 0.8, flare: 1.1, grille: "split", tail: "bar", rim: "multi", spoiler: "duck", skirts: true, diffuser: true, pipes: 2 }),
  super: ST({ crease: 0.9, flare: 1.3, grille: "none", tail: "bar", rim: "turbine", rimCol: "#2a2d33", skirts: true, diffuser: true, spoiler: "lip", pipes: 2 }),
  muscle: ST({ crease: 0.9, flare: 1.0, grille: "bars", lamp: "round", tail: "round", rim: "dish", scoop: true, pipes: 2, chrome: true }),
  roadster: ST({ crease: 0.6, flare: 0.9, grille: "mesh", tail: "split", rim: "multi", pipes: 2 }),
  compact: ST({ crease: 0.4, flare: 0.5, grille: "mesh", tail: "vertical", rim: "five", spoiler: "lip" }),
  wagon: ST({ crease: 0.5, flare: 0.4, tail: "vertical", rails: true, chrome: true }),
  suv: ST({ crease: 0.6, flare: 1.0, grille: "truck", lamp: "square", tail: "vertical", rim: "multi", rails: true }),
  offroad: ST({ crease: 0.3, flare: 1.5, grille: "bars", lamp: "round", tail: "vertical", rim: "steel", rimCol: "#3a3d45" }),
  pickup: ST({ crease: 0.5, flare: 1.1, grille: "truck", lamp: "square", tail: "vertical", rim: "steel", rimCol: "#c9ced8" }),
  van: ST({ crease: 0.2, flare: 0.3, grille: "bars", lamp: "square", tail: "vertical", rim: "steel" }),
  ambulance: ST({ crease: 0.2, flare: 0.3, grille: "bars", lamp: "square", tail: "vertical", rim: "steel" }),
  icecream: ST({ crease: 0.2, flare: 0.3, grille: "bars", lamp: "round", tail: "vertical", rim: "steel", chrome: true }),
  swat: ST({ crease: 0.3, flare: 0.6, grille: "mesh", lamp: "square", tail: "vertical", rim: "steel", rimCol: "#2a2d33" }),
  truck: ST({ crease: 0.2, flare: 0.3, grille: "truck", lamp: "square", tail: "vertical", rim: "steel" }),
  garbage: ST({ crease: 0.2, flare: 0.3, grille: "truck", lamp: "square", tail: "vertical", rim: "steel" }),
  tow: ST({ crease: 0.2, flare: 0.3, grille: "truck", lamp: "square", tail: "vertical", rim: "steel" }),
  fire: ST({ crease: 0.2, flare: 0.3, grille: "truck", lamp: "square", tail: "vertical", rim: "steel", chrome: true }),
  hyper: ST({ crease: 1, flare: 1.4, grille: "none", tail: "bar", rim: "turbine", rimCol: "#15161b", skirts: true, diffuser: true, pipes: 2 }),
  lowrider: ST({ crease: 0.7, flare: 0.3, grille: "bars", lamp: "round", tail: "round", rim: "wire", rimCol: "#e8ecf2", chrome: true }),
  monster: ST({ crease: 0.5, flare: 0.2, grille: "truck", lamp: "square", tail: "vertical", rim: "steel", rimCol: "#ffd23f" }),
  formula: ST({ crease: 0, flare: 0, grille: "none", tail: "split", rim: "multi", rimCol: "#2a2d33" }),
  interceptor: ST({ crease: 0.9, flare: 1.2, grille: "mesh", tail: "bar", rim: "multi", rimCol: "#2a2d33", skirts: true, diffuser: true, pipes: 2 }),
  polsuv: ST({ crease: 0.6, flare: 1.0, grille: "mesh", lamp: "square", tail: "vertical", rim: "steel", rimCol: "#3a3d45", rails: true }),
  bus: ST({ crease: 0.1, flare: 0.1, grille: "none", lamp: "square", tail: "vertical", rim: "steel" }),
};
const styleOf = (m: CarModel) => STYLE[m] ?? ST({});

// --------------------------------------------------------------------------- body loft
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// top line of the lower body (hood, window line, rear deck) at x
export function topAt(s: Shape, x: number) {
  const hl = s.L / 2;
  if (s.box && x <= s.box.x1 && x >= s.box.x0) return s.belt;
  if (x >= s.cowlX) return lerp(s.cowl, s.nose, smooth(clamp01((x - s.cowlX) / (hl - s.cowlX))));
  if (x <= s.deckX) return lerp(s.deck, s.tail, smooth(clamp01((s.deckX - x) / (s.deckX + hl))));
  return lerp(s.belt, s.belt, 0);
}
// bottom edge: the sill, cut out around the wheels (wheel arches)
function bottomAt(s: Shape, x: number) {
  let b = s.y0;
  for (const wx of [s.wf, s.wr]) {
    const r = s.R + 1.4, d = Math.abs(x - wx);
    if (d < r) b = Math.max(b, s.R + Math.sqrt(r * r - d * d) * 0.98);
  }
  return b;
}
// half width (rounded corners in the plan view)
function halfW(s: Shape, x: number) {
  const u = Math.abs(x) / (s.L / 2);
  return (s.W / 2) * (1 - 0.18 * Math.pow(u, 8) - 0.04 * u * u);
}

interface Loft { pos: number[]; idx: number[]; }
// one cross section: from the bottom middle round one side to the top middle (z positive = right side).
// fl: the wheel arch flare (the lower body is wider there), cr: how sharp the shoulder line stands out
const RING_N = 10;
const ringPts = (hw: number, bot: number, top: number, fl: number, cr: number) => {
  const h = top - bot, crease = bot + h * 0.66, sh = top - Math.min(1.6, h * 0.22), lw = hw + fl;
  return [[0, bot - 0.2], [lw * 0.84, bot], [lw * 0.975, bot + Math.min(0.9, h * 0.15)], [lw, bot + (crease - bot) * 0.42], [hw + fl * 0.45, crease - Math.min(1.2, h * 0.14)],
    [hw + 0.12 + cr * 0.28, crease], [hw * (0.985 - cr * 0.012), sh], [hw * 0.9, top], [hw * 0.46, top + 0.38], [0, top + 0.48]];
};
// the flare over a wheel at x (0 away from the wheels)
function flareAt(s: Shape, x: number, amount: number) {
  let f = 0;
  for (const wx of [s.wf, s.wr]) { const d = Math.abs(x - wx) / ((s.R + 1.4) * 1.9); if (d < 1) f = Math.max(f, smooth(1 - d)); }
  return f * amount;
}
// faces of station segments that belong to a door are put into their own lists
function buildBody(s: Shape, doorRanges: [number, number][], st: Style) {
  const hl = s.L / 2, N = 46;
  const xs: number[] = [];
  for (let i = 0; i <= N; i++) { const t = i / N; xs.push(-hl + s.L * (0.5 - 0.5 * Math.cos(t * Math.PI))); } // denser at the ends
  for (const d of doorRanges) xs.push(d[0], d[1]);
  for (const wx of [s.wf, s.wr]) for (let k = -6; k <= 6; k++) xs.push(wx + (k / 6) * (s.R + 1.4));
  xs.sort((a, b) => a - b);
  const X = xs.filter((v, i) => i === 0 || v - xs[i - 1] > 0.05);
  const rings: number[][][] = X.map((x) => {
    const end = 1 - smooth(clamp01((Math.abs(x) - (hl - 2.5)) / 2.5)) * 0.18;
    const hw = halfW(s, x) * end, bot = bottomAt(s, x), top = topAt(s, x) * (0.96 + 0.04 * end);
    const one = ringPts(hw, bot, top, flareAt(s, x, st.flare) * end, st.crease * end);
    const full = [...one, ...one.slice(1, -1).reverse().map(([z, y]) => [-z, y])]; // mirrored left side
    return full.map(([z, y]) => [x, y, z]);
  });
  const M = rings[0].length;
  const body: Loft = { pos: [], idx: [] };
  const doors: Loft[] = doorRanges.map(() => ({ pos: [], idx: [] }));
  const quad = (L: Loft, a: number[], b: number[], c: number[], d: number[]) => {
    const o = L.pos.length / 3;
    L.pos.push(...a, ...b, ...c, ...d);
    L.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  // the cabin is open at the top (window line): the greenhouse, glass and interior sit there
  const cabF = s.cowlX - 0.2, cabR = s.box ? s.box.x1 : s.deckX + 0.2;
  for (let i = 0; i < X.length - 1; i++) {
    const xm = (X[i] + X[i + 1]) / 2;
    const cabin = xm < cabF && xm > cabR;
    for (let k = 0; k < M; k++) {
      const k2 = (k + 1) % M;
      if (cabin && k >= RING_N - 3 && k <= RING_N) continue;
      const a = rings[i][k], b = rings[i + 1][k], c = rings[i + 1][k2], d = rings[i][k2];
      // side faces between the sill and the shoulder inside a door range go to that door
      const side = (k >= 1 && k <= RING_N - 4) ? 1 : (k >= M - (RING_N - 3) && k <= M - 2) ? -1 : 0;
      let target = body;
      doorRanges.forEach((dr, j) => { if (side && xm > dr[0] && xm < dr[1] && Math.sign(j % 2 ? -1 : 1) === side) target = doors[j]; });
      // counter-clockwise seen from outside: the normals point out on both sides
      quad(target, a, b, c, d);
    }
  }
  // caps at nose and tail
  for (const [ri, flip] of [[0, true], [X.length - 1, false]] as [number, boolean][]) {
    const r = rings[ri], cx = r[0][0], cy = r.reduce((a, p) => a + p[1], 0) / M;
    const o = body.pos.length / 3;
    body.pos.push(cx, cy, 0, ...r.flat());
    for (let k = 0; k < M; k++) { const k2 = (k + 1) % M; if (flip) body.idx.push(o, o + 1 + k, o + 1 + k2); else body.idx.push(o, o + 1 + k2, o + 1 + k); }
  }
  const toGeo = (L: Loft) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(L.pos, 3)); g.setIndex(L.idx); g.computeVertexNormals(); return g.toNonIndexed(); };
  return { body: toGeo(body), doors: doors.map(toGeo) };
}

// --------------------------------------------------------------------------- parts
const col = (g: THREE.BufferGeometry, hex: string, mul = 1) => {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r * mul; a[i * 3 + 1] = c.g * mul; a[i * 3 + 2] = c.b * mul; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  g.deleteAttribute("uv"); // the loft has none: all merged parts need the same attributes
  return g.index ? g.toNonIndexed() : g;
};
const bx = (w: number, h: number, d: number, x: number, y: number, z: number, c: string, mul = 1, rx = 0, ry = 0, rz = 0) => {
  const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z); return col(g, c, mul);
};
const cy = (r: number, h: number, x: number, y: number, z: number, c: string, axis: "x" | "y" | "z" = "y", seg = 12, r2 = r) => {
  const g = new THREE.CylinderGeometry(r, r2, h, seg); if (axis === "x") g.rotateZ(Math.PI / 2); if (axis === "z") g.rotateX(Math.PI / 2); g.translate(x, y, z); return col(g, c);
};
// a flat pane through four points (window glass), both sides
function pane(p: number[][]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]], 3));
  g.computeVertexNormals();
  return g;
}
const merge = (l: THREE.BufferGeometry[]) => { const m = mergeGeometries(l)!; for (const g of l) g.dispose(); return m; };

export interface RigGeo {
  shape: Shape;
  body: THREE.BufferGeometry;        // painted body (without the doors)
  trim: THREE.BufferGeometry;        // black / chrome / rubber parts, grille, mirrors, handles
  doors: { geo: THREE.BufferGeometry; glass: THREE.BufferGeometry; hinge: [number, number]; side: 1 | -1 }[]; // hinge: x, z
  glass: { geo: THREE.BufferGeometry; id: string }[]; // fixed panes: windshield, rear window, quarter windows
  interior: THREE.BufferGeometry;
  wheel: { tire: THREE.BufferGeometry; rim: THREE.BufferGeometry };
  wheels: { x: number; z: number; front: boolean }[];
  steering: { geo: THREE.BufferGeometry; x: number; y: number; z: number };
  wiper: { geo: THREE.BufferGeometry; x: number; y: number; z: number; n: THREE.Vector3 }[];
  lights: Record<"head" | "tail" | "brake" | "rev" | "indL" | "indR", THREE.BufferGeometry>;
  bumperF: THREE.BufferGeometry; bumperR: THREE.BufferGeometry;
  plateF: [number, number, number]; plateR: [number, number, number];
  extra: THREE.BufferGeometry | null; // model specific painted parts (cargo box, ladder, light bar housing ...)
  seat: [number, number, number];   // driver's hip
  lean: number;                      // seat back angle (radians backwards)
  eye: [number, number, number];     // driver's eyes (first person camera)
  exhaust: [number, number, number];
}

const cache = new Map<CarModel, RigGeo>();
export function rigGeo(model: CarModel): RigGeo {
  const hit = cache.get(model);
  if (hit) return hit;
  const s = SHAPES[model]!;
  const hl = s.L / 2, hw = s.W / 2;
  const front = s.cowlX - 2;
  // door ranges along x (front doors behind the windshield base; rear doors up to the rear wheel arch)
  const dF: [number, number] = [Math.min(front, s.roofF + 2) - (s.doors === 2 ? s.L * 0.24 : s.L * 0.18), Math.min(front, s.roofF + 2)];
  const dR: [number, number] = [Math.max(s.wr + 0.5, dF[0] - s.L * 0.2), dF[0] - 0.3];
  const ranges: [number, number][] = s.doors === 4 ? [dF, dF, dR, dR] : [dF, dF];
  const st = styleOf(model);
  const lb = buildBody(s, ranges, st);
  // ---- greenhouse: roof, pillars, glass
  const T: THREE.BufferGeometry[] = [], P: THREE.BufferGeometry[] = [], G: { geo: THREE.BufferGeometry; id: string }[] = [], X: THREE.BufferGeometry[] = [];
  const bw = hw * 0.93, rw = hw * s.taper;
  const roofR = s.box ? s.box.x1 : s.roofR;
  if (!s.open) {
    // roof panel (painted), slightly crowned
    const roof = new THREE.BoxGeometry(s.roofF - roofR + 0.6, 1.3, rw * 2 + 0.4); roof.translate((s.roofF + roofR) / 2, s.roof - 0.5, 0);
    P.push(col(roof, "#ffffff"));
    // pillars
    for (const z of [-1, 1]) {
      const pil = (x0: number, y0: number, x1: number, y1: number, t: number) => {
        const L = Math.hypot(x1 - x0, y1 - y0), g = new THREE.BoxGeometry(L, t, 1.1);
        g.rotateZ(Math.atan2(y1 - y0, x1 - x0)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, z * lerp(bw, rw, 0.5)); return g;
      };
      P.push(col(pil(s.cowlX, s.belt, s.roofF, s.roof, 1.2), "#ffffff"));
      if (!s.box) P.push(col(pil(s.deckX, s.belt, s.roofR, s.roof, 1.6), "#ffffff"));
      P.push(col(pil(dF[0], s.belt, dF[0] + 0.5, s.roof, 1.4), "#ffffff")); // B pillar
    }
    // windshield and rear window
    G.push({ id: "front", geo: pane([[s.cowlX, s.belt + 0.2, -bw], [s.cowlX, s.belt + 0.2, bw], [s.roofF, s.roof - 0.4, rw], [s.roofF, s.roof - 0.4, -rw]]) });
    if (!s.box) G.push({ id: "rear", geo: pane([[s.deckX, s.belt + 0.2, bw], [s.deckX, s.belt + 0.2, -bw], [s.roofR, s.roof - 0.4, -rw], [s.roofR, s.roof - 0.4, rw]]) });
    // fixed side glass behind the doors (quarter windows)
    const lastDoor = s.doors === 4 ? dR[0] : dF[0];
    if (!s.box && lastDoor - 0.5 > s.deckX + 1) for (const z of [-1, 1]) {
      const x0 = lastDoor - 0.6, x1 = s.deckX + 1.5;
      const top = (x: number) => (x > roofR ? s.roof - 0.8 : lerp(s.belt + 0.4, s.roof - 0.8, clamp01((x - s.deckX) / Math.max(0.1, roofR - s.deckX))));
      G.push({ id: z > 0 ? "qR" : "qL", geo: pane([[x0, s.belt + 0.4, z * bw], [x1, s.belt + 0.4, z * bw], [x1, top(x1), z * lerp(bw, rw, 0.9)], [x0, top(x0), z * lerp(bw, rw, 0.9)]]) });
    }
  } else {
    // convertible: windshield with a frame, roll hoops behind the seats
    G.push({ id: "front", geo: pane([[s.cowlX, s.belt + 0.2, -bw], [s.cowlX, s.belt + 0.2, bw], [s.cowlX - 3.5, s.roof, rw], [s.cowlX - 3.5, s.roof, -rw]]) });
    T.push(bx(1, 0.8, rw * 2 + 1, s.cowlX - 3.5, s.roof, 0, "#15161b"));
    for (const z of [-1, 1]) T.push(cy(0.6, s.roof - s.belt + 2, s.seatX - 5, s.belt + 2, z * 5, "#c9ced8"));
  }
  // ---- doors: panel from the loft + door window
  const doors: RigGeo["doors"] = [];
  ranges.forEach((r, j) => {
    const side: 1 | -1 = j % 2 ? -1 : 1;
    const wg: THREE.BufferGeometry[] = [];
    const winTop = (x: number) => x > s.roofF ? lerp(s.roof - 0.8, s.belt + 0.5, clamp01((x - s.roofF) / Math.max(0.1, s.cowlX - s.roofF)))
      : x < roofR && !s.box ? lerp(s.roof - 0.8, s.belt + 0.5, clamp01((roofR - x) / Math.max(0.1, roofR - s.deckX))) : s.roof - 0.8;
    if (!s.open) {
      const x0 = r[0] + 0.5, x1 = r[1] - 0.5, zz = side * lerp(bw, rw, 0.55);
      wg.push(pane([[x0, s.belt + 0.4, side * bw], [x1, s.belt + 0.4, side * bw], [x1, winTop(x1), zz], [x0, winTop(x0), zz]]));
    }
    // handle and the seam at the door edge
    const door = lb.doors[j];
    const extra = [bx(2.2, 0.5, 0.5, r[0] + 3.2, s.belt - 1.6, side * (halfW(s, r[0]) + 0.2), "#cfd2d8"),
      bx(r[1] - r[0] - 0.4, s.belt - s.y0 - 1.2, 0.35, (r[0] + r[1]) / 2, (s.belt + s.y0 + 1.2) / 2, side * (halfW(s, (r[0] + r[1]) / 2) - 0.75), "#3a3633")]; // door card inside
    const dGeo = mergeGeometries([col(door, "#ffffff"), ...extra.map((e) => e)])!;
    const hingeX = r[1], hingeZ = side * halfW(s, r[1]);
    dGeo.translate(-hingeX, 0, -hingeZ);
    const gGeo = wg.length ? wg[0] : new THREE.BufferGeometry();
    gGeo.translate(-hingeX, 0, -hingeZ);
    doors.push({ geo: dGeo, glass: gGeo, hinge: [hingeX, hingeZ], side });
  });
  // ---- trim: grille, intakes, bumpers (separate), sills, mirrors, exhaust tips, diffuser, spoilers, roof rails
  const yb = s.y0 + 0.5, fh = s.nose - s.y0, big = !!s.box || s.L > 60, low = s.nose < 7;
  const chrome = "#dfe4ea", black = "#0c0d10", dark = "#1a1b1f";
  const gw = s.W * (st.grille === "truck" ? 0.62 : 0.42), gy = s.y0 + fh * (st.grille === "truck" ? 0.55 : 0.5), gh = Math.max(1.4, fh * (st.grille === "truck" ? 0.62 : 0.34));
  switch (st.grille) {
    case "mesh": {
      T.push(bx(0.6, gh, gw, hl - 0.3, gy, 0, black));
      for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) T.push(bx(0.3, gh / 5, gw / 9, hl - 0.05, gy - gh / 2 + gh * (i + 0.7) / 4.4, -gw / 2 + gw * (j + 0.6) / 7.2, "#2c2f36"));
      T.push(bx(0.4, 0.4, gw + 0.6, hl - 0.1, gy + gh / 2 + 0.2, 0, st.chrome ? chrome : "#2a2d34"));
      break;
    }
    case "bars": {
      T.push(bx(0.6, gh, gw, hl - 0.3, gy, 0, black));
      for (let i = 0; i < 4; i++) T.push(bx(0.4, 0.28, gw - 0.4, hl, gy - gh / 2 + gh * (i + 0.5) / 4, 0, st.chrome ? chrome : "#5a5e66"));
      T.push(bx(0.5, gh + 0.5, 0.5, hl - 0.05, gy, gw / 2, st.chrome ? chrome : "#3a3d45"), bx(0.5, gh + 0.5, 0.5, hl - 0.05, gy, -gw / 2, st.chrome ? chrome : "#3a3d45"));
      break;
    }
    case "split": {
      // a slim upper opening and two big lower intakes either side
      T.push(bx(0.6, Math.max(0.8, gh * 0.4), gw * 0.7, hl - 0.25, gy + gh * 0.25, 0, black));
      for (const z of [-1, 1]) T.push(bx(0.6, gh * 0.9, s.W * 0.18, hl - 0.4, s.y0 + 1.6, z * s.W * 0.3, black), bx(0.3, 0.3, s.W * 0.18, hl - 0.1, s.y0 + 1.6, z * s.W * 0.3, "#3a3d45"));
      break;
    }
    case "truck": {
      // big chrome grille with vertical bars and a badge
      T.push(bx(0.8, gh, gw, hl - 0.2, gy, 0, "#15161b"), bx(0.6, gh + 0.8, gw + 0.8, hl - 0.35, gy, 0, chrome));
      for (let j = 0; j < 9; j++) T.push(bx(0.4, gh - 0.6, 0.35, hl + 0.05, gy, -gw / 2 + gw * (j + 0.5) / 9, "#b8bec8"));
      T.push(bx(0.4, 0.5, gw - 0.6, hl + 0.1, gy, 0, "#b8bec8"), cy(0.7, 0.3, hl + 0.3, gy + gh * 0.25, 0, "#e8ecf2", "x", 12));
      break;
    }
    case "none": T.push(bx(0.5, Math.max(0.8, fh * 0.22), s.W * 0.56, hl - 0.4, s.y0 + 1.4, 0, black)); break;
  }
  if (!big && st.grille !== "truck") T.push(cy(0.55, 0.3, hl + 0.05, gy + gh / 2 + 0.6, 0, "#e8ecf2", "x", 12)); // badge
  for (const z of [-1, 1]) {
    // mirrors on a short arm, glass towards the back
    T.push(bx(0.8, 0.5, 1.2, s.cowlX - 1.3, s.belt + 0.9, z * (hw + 0.2), dark));
    T.push(col(new THREE.SphereGeometry(1, 10, 8).scale(1.3, 0.85, 1.05).translate(s.cowlX - 1.6, s.belt + 1.5, z * (hw + 1.2)), dark));
    T.push(bx(0.2, 1.0, 1.4, s.cowlX - 2.8, s.belt + 1.5, z * (hw + 1.2), "#9fb0c0", 1.3));
    T.push(bx(s.L * 0.5, 0.8, 0.6, (s.wf + s.wr) / 2, s.y0 + 0.4, z * (hw - 0.2), "#121316")); // sill
    if (st.skirts) T.push(bx(s.wf - s.wr - s.R * 2.4, 1.2, 0.8, (s.wf + s.wr) / 2, s.y0 + 0.2, z * (hw + st.flare * 0.4), black));
    if (st.chrome) T.push(bx(s.cowlX - (s.box ? s.box.x1 : s.deckX), 0.28, 0.25, (s.cowlX + (s.box ? s.box.x1 : s.deckX)) / 2, s.belt + 0.25, z * (hw * 0.93 + 0.1), chrome)); // window line
  }
  // bumpers in body colour (big vehicles: grey plastic) with a dark lower lip; they take the paint material
  const bc = big ? "#3a3d45" : "#ffffff";
  const bF: THREE.BufferGeometry[] = [col(new THREE.CapsuleGeometry(1.3, s.W * 0.78, 4, 10).rotateX(Math.PI / 2).translate(hl - 1.0, yb + 0.9, 0), bc), bx(1.4, 0.8, s.W * 0.8, hl - 0.6, yb - 0.6, 0, dark)];
  if (!low) bF.push(bx(0.6, 0.9, s.W * 0.4, hl + 0.35, yb + 0.6, 0, "#121316"));
  if (st.chrome) bF.push(bx(0.4, 0.35, s.W * 0.7, hl + 0.3, yb + 1.3, 0, chrome));
  const bR: THREE.BufferGeometry[] = [col(new THREE.CapsuleGeometry(1.4, s.W * 0.78, 4, 10).rotateX(Math.PI / 2).translate(-hl + 1.0, yb + 1.1, 0), bc), bx(1.4, 0.8, s.W * 0.8, -hl + 0.6, yb - 0.4, 0, dark)];
  if (st.chrome) bR.push(bx(0.4, 0.35, s.W * 0.7, -hl - 0.3, yb + 1.5, 0, chrome));
  const bumperF = merge(bF), bumperR = merge(bR);
  // exhaust tips (one or a pair), a diffuser with fins for the fast ones
  const pipes = st.pipes ?? 1;
  for (let k = 0; k < pipes; k++) { const z = pipes === 1 ? hw * 0.55 : (k ? -1 : 1) * hw * 0.42; T.push(cy(0.6, 2.6, -hl - 0.5, s.y0 + 0.9, z, "#8a8f98", "x", 10), cy(0.45, 2.7, -hl - 0.55, s.y0 + 0.9, z, "#15161b", "x", 10)); }
  if (st.diffuser) { T.push(bx(2.6, 0.5, s.W * 0.6, -hl + 0.6, s.y0 + 0.2, 0, black)); for (let k = -2; k <= 2; k++) T.push(bx(2.4, 1.4, 0.3, -hl + 0.6, s.y0 + 0.8, k * s.W * 0.1, black)); }
  if (st.spoiler === "duck") X.push(col(new THREE.BoxGeometry(2.2, 0.5, s.W * 0.82).rotateZ(0.35).translate(-hl + 1.4, s.tail + 0.4, 0), "#ffffff"));
  if (st.spoiler === "lip") X.push(bx(1.6, 0.35, s.W * 0.7, s.box ? s.box.x1 : -hl + 1.2, (s.box ? s.roof : s.tail) + 0.2, 0, "#ffffff"));
  if (st.rails && !s.open) for (const z of [-1, 1]) { T.push(bx(s.roofF - (s.box ? s.box.x1 : s.roofR) - 2, 0.5, 0.6, (s.roofF + (s.box ? s.box.x1 : s.roofR)) / 2, s.roof + 1.1, z * hw * s.taper * 0.85, "#2a2d33")); for (const x of [s.roofF - 1.5, (s.box ? s.box.x1 : s.roofR) + 1.5]) T.push(bx(0.8, 0.9, 0.6, x, s.roof + 0.6, z * hw * s.taper * 0.85, "#2a2d33")); }
  if (st.scoop) { X.push(bx(7, 1.4, s.W * 0.26, (s.cowlX + hl) / 2 - 2, topAt(s, (s.cowlX + hl) / 2) + 0.4, 0, "#ffffff")); T.push(bx(0.4, 0.9, s.W * 0.22, (s.cowlX + hl) / 2 + 1.5, topAt(s, (s.cowlX + hl) / 2) + 0.6, 0, black)); }
  if (st.antenna && !s.open) T.push(cy(0.08, 5, s.roofR + 3, s.roof + 2.4, 0, "#15161b", "y", 4));
  // ---- lights (lenses; housings and reflectors are trim). Lenses sit on the nose and tail surfaces
  const lz = hw - Math.min(4, s.W * 0.2), ly = Math.min(s.nose - 1.6, s.y0 + 4.5);
  const head: THREE.BufferGeometry[] = [], tail: THREE.BufferGeometry[] = [], brake: THREE.BufferGeometry[] = [], rev: THREE.BufferGeometry[] = [], indL: THREE.BufferGeometry[] = [], indR: THREE.BufferGeometry[] = [];
  const ty = Math.min(s.tail - 1.5, s.y0 + 6);
  const ind = (z: number, l: THREE.BufferGeometry[]) => { (z < 0 ? indL : indR).push(...l); };
  for (const z of [-1, 1]) {
    if (st.lamp === "slim") {
      // a slim swept lamp with an LED strip below it
      const wy = -z * 0.32;
      T.push(bx(1.2, 1.9, 5.6, hl - 0.7, ly + 0.4, z * lz, "#15171c", 1, 0, wy), bx(0.4, 1.1, 4.4, hl - 0.25, ly + 0.5, z * lz, "#cfd5de", 1.4, 0, wy));
      head.push(bx(0.35, 1.0, 3.4, hl, ly + 0.5, z * (lz + 0.4), "#ffffff", 1, 0, wy), bx(0.3, 0.3, 4.4, hl + 0.02, ly - 0.4, z * lz, "#ffffff", 1, 0, wy));
      ind(z, [bx(0.35, 0.5, 1.4, hl - 0.1, ly + 0.5, z * (lz - 2.4), "#ffffff", 1, 0, wy)]);
    } else if (st.lamp === "round") {
      // twin round lamps in chrome rings
      const n = s.W > 19 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const zz = z * (lz + (n === 2 ? (k ? -1.4 : 1.2) : 0.4)), r = n === 2 ? 1.05 : 1.4;
        T.push(cy(r + 0.35, 0.8, hl - 0.25, ly + 0.3, zz, chrome, "x", 16));
        head.push(cy(r, 0.5, hl + 0.05, ly + 0.3, zz, "#ffffff", "x", 16));
      }
      ind(z, [bx(0.4, 0.8, 1.2, hl, ly - 1.4, z * (lz - 1), "#ffffff")]);
    } else {
      // square lamps (vans, trucks, the big SUVs)
      T.push(bx(1.2, 2.8, 4.8, hl - 0.6, ly + 0.3, z * lz, "#2a2d34"), bx(0.5, 2.2, 4.2, hl - 0.15, ly + 0.3, z * lz, "#cfd5de", 1.4));
      head.push(bx(0.4, 1.9, 3.0, hl + 0.15, ly + 0.4, z * (lz + 0.5), "#ffffff"));
      ind(z, [bx(0.4, 1.9, 0.9, hl + 0.12, ly + 0.4, z * (lz - 1.8), "#ffffff")]);
    }
    // the rear: a light bar across the tail, two clusters, tall vertical lamps or round ones
    if (st.tail === "bar") {
      T.push(bx(0.8, 1.6, s.W * 0.42, -hl + 0.4, ty + 0.6, z * s.W * 0.22, "#2a1012"));
      tail.push(bx(0.3, 0.5, s.W * 0.42, -hl - 0.1, ty + 0.9, z * s.W * 0.22, "#ffffff"));
      brake.push(bx(0.3, 0.6, 3.6, -hl - 0.12, ty + 0.3, z * lz, "#ffffff"));
      rev.push(bx(0.3, 0.6, 1.4, -hl - 0.14, ty + 0.3, z * (lz - 3.2), "#ffffff"));
      ind(z, [bx(0.3, 0.4, 1.6, -hl - 0.12, ty + 1.4, z * lz, "#ffffff")]);
    } else if (st.tail === "vertical") {
      const th = Math.min(8, s.tail - s.y0 - 3), tz = hw - 1.6;
      T.push(bx(1.0, th + 0.8, 2.4, -hl + 0.5, s.y0 + 3 + th / 2, z * tz, "#2a1012"));
      tail.push(bx(0.4, th * 0.45, 2.0, -hl - 0.12, s.y0 + 3 + th * 0.75, z * tz, "#ffffff"));
      brake.push(bx(0.4, th * 0.3, 2.0, -hl - 0.14, s.y0 + 3 + th * 0.4, z * tz, "#ffffff"));
      rev.push(bx(0.4, th * 0.15, 2.0, -hl - 0.15, s.y0 + 3 + th * 0.12, z * tz, "#ffffff"));
      ind(z, [bx(0.4, 0.6, 2.0, -hl - 0.13, s.y0 + 3 + th * 0.97, z * tz, "#ffffff")]);
    } else if (st.tail === "round") {
      for (const k of [0, 1]) {
        const zz = z * (lz + (k ? -2.6 : 0.4));
        T.push(cy(1.35, 0.8, -hl + 0.3, ty + 0.3, zz, chrome, "x", 14));
        (k ? brake : tail).push(cy(1.05, 0.5, -hl - 0.05, ty + 0.3, zz, "#ffffff", "x", 14));
      }
      rev.push(bx(0.4, 0.6, 1.2, -hl - 0.1, ty - 1.4, z * (lz - 1), "#ffffff"));
      ind(z, [bx(0.4, 0.6, 1.4, -hl - 0.1, ty - 1.4, z * (lz + 0.8), "#ffffff")]);
    } else {
      T.push(bx(1.0, 2.6, 6, -hl + 0.5, ty, z * lz, "#2a1012"));
      tail.push(bx(0.4, 1.4, 5, -hl - 0.15, ty + 0.5, z * lz, "#ffffff"));
      brake.push(bx(0.4, 0.9, 5, -hl - 0.17, ty - 0.6, z * lz, "#ffffff"));
      rev.push(bx(0.4, 0.8, 1.6, -hl - 0.18, ty - 0.6, z * (lz - 3.6), "#ffffff"));
      ind(z, [bx(0.4, 1.0, 1.2, -hl - 0.1, ty, z * (lz - 2.8), "#ffffff")]);
    }
  }
  if (st.tail === "bar") tail.push(bx(0.3, 0.3, s.W * 0.1, -hl - 0.1, ty + 0.9, 0, "#ffffff"));
  // the third brake light under the rear window / on the roof edge of boxes
  if (!s.open && !s.box && !big) brake.push(bx(0.4, 0.35, s.W * 0.2, s.roofR - 0.4, s.roof - 0.6, 0, "#ffffff"));
  // ---- interior: seats, dashboard, centre console, gear lever, rear view mirror
  const I: THREE.BufferGeometry[] = [];
  // hip height so that a seated person fits under the roof; low cars recline the seats (lean)
  const floorY = s.y0 + 0.6, hip = Math.max(s.y0 + 1.4, Math.min(s.y0 + 2.6, s.roof - 10.3)), seatH = hip - 0.6;
  const room = s.roof - 1.4 - hip, lean = room >= 8.9 || s.open ? 0.12 : Math.min(0.65, Math.acos(room / 8.9));
  const rot = (x: number, y: number) => [x * Math.cos(lean) - y * Math.sin(lean), x * Math.sin(lean) + y * Math.cos(lean)];
  // front row, and a rear bench under the roof for four doors (lower backs so it stays below the rear window)
  const rows: [number, number][] = s.doors === 4 && !s.box ? [[s.seatX, 1], [Math.max(s.seatX - 10, roofR + 0.5), 0.78]] : [[s.seatX, 1]];
  for (const [sx, k] of rows) for (const z of [-1, 1]) {
    const [bxx, byy] = rot(-2.4, 3.2 * k), [hx2, hy2] = rot(-2.6, 6.9 * k);
    I.push(bx(5, 1.6, 4.4, sx, seatH, z * hw * 0.42, "#2a2724"), bx(1.4, 6 * k, 4.4, sx + bxx, hip + byy, z * hw * 0.42, "#2a2724", 1, 0, 0, lean + (1 - k)), bx(1.2, 1.6, 3, sx + hx2 - (1 - k) * 2, hip + hy2, z * hw * 0.42, "#2a2724", 1, 0, 0, lean));
  }
  I.push(bx(4, 2.6, s.W * 0.86, s.cowlX - 3, s.belt - 0.8, 0, "#1d1e22"), bx(s.cowlX - s.seatX, 1.6, 2.4, (s.cowlX + s.seatX) / 2, floorY + 1.4, 0, "#18191c"));
  I.push(bx(0.5, 2.2, 0.5, s.seatX + 4, floorY + 3.2, 0, "#3a3d45"), bx(0.9, 0.9, 0.9, s.seatX + 4, floorY + 4.4, 0, "#15161b"));
  if (!s.open) I.push(bx(0.4, 0.9, 3, s.roofF - 1.2, s.roof - 1.6, 0, "#15161b"));
  const cabR = s.box ? s.box.x1 : s.deckX;
  I.push(bx(s.cowlX - cabR, 0.6, s.W * 0.86, (s.cowlX + cabR) / 2, floorY, 0, "#121314"));
  // inner side walls and the wall behind the rear seats / cab
  for (const z of [-1, 1]) I.push(bx(s.cowlX - cabR, s.belt - floorY, 0.4, (s.cowlX + cabR) / 2, (s.belt + floorY) / 2, z * (hw - 0.9), "#24211f"));
  I.push(bx(0.5, s.belt - floorY, s.W * 0.86, cabR + 0.4, (s.belt + floorY) / 2, 0, "#1b1a19"));
  // steering wheel (separate, turns with the steering) and dashboard dials
  const sw = new THREE.TorusGeometry(1.7, 0.28, 6, 18); const swHub = new THREE.CylinderGeometry(0.5, 0.5, 0.6, 8).rotateX(Math.PI / 2);
  const steerGeo = mergeGeometries([col(sw, "#141416"), col(swHub, "#2a2d34"), bx(0.3, 3.2, 0.3, 0, 0, 0, "#141416")])!;
  steerGeo.rotateY(Math.PI / 2); // in the y-z plane, facing the driver
  const steer = { geo: steerGeo, x: s.cowlX - 5.2, y: s.belt - 0.2, z: -hw * 0.42 };
  I.push(bx(0.4, 1.2, 3, s.cowlX - 4.4, s.belt + 0.4, -hw * 0.42, "#0d0f12"));
  // wipers (two, they sweep in the rain)
  const wn = new THREE.Vector3(s.roof - s.belt, s.cowlX - s.roofF, 0).normalize(); // windshield normal
  const wipers = [-1, 1].map((k) => ({ geo: col(new THREE.BoxGeometry(0.35, 0.3, s.W * 0.36).translate(0, 0.25, s.W * 0.18), "#101114"), x: s.cowlX - 0.2, y: s.belt + 0.45, z: k * hw * 0.2 - hw * 0.42, n: wn }));
  // ---- wheels: tyre with tread and a sidewall, rim (style per model) with a brake disc and calliper
  const R = s.R, wd = s.wd ?? Math.max(1.8, R * 0.62);
  const tire = new THREE.CylinderGeometry(R, R, wd, 28, 1, false); tire.rotateX(Math.PI / 2);
  const tread = new THREE.TorusGeometry(R - 0.2, 0.32, 4, 28); // rounded shoulders
  const TP = [col(tire, "#121214"), col(tread.clone().translate(0, 0, wd / 2 - 0.2), "#121214"), col(tread.translate(0, 0, -wd / 2 + 0.2), "#121214")];
  for (let k = 0; k < 14; k++) { const g = new THREE.BoxGeometry(0.5, 0.25, wd * 0.9); g.translate(0, R + 0.02, 0); g.rotateZ((k / 14) * Math.PI * 2); TP.push(col(g, "#1c1c20")); } // tread blocks
  const tGeo = merge(TP);
  const RP: THREE.BufferGeometry[] = [], rc = st.rimCol, rr = R * (st.rim === "steel" ? 0.6 : st.rim === "dish" || st.rim === "wire" ? 0.66 : 0.72);
  const disc = (sd: number, r: number, h: number, z: number, c: string, seg = 22) => RP.push(col(new THREE.CylinderGeometry(r, r, h, seg).rotateX(Math.PI / 2).translate(0, 0, sd * z), c));
  const spoke = (sd: number, len: number, w: number, a: number, z: number, c: string, off = 0) => { const g = new THREE.BoxGeometry(len, w, 0.35); g.translate(off + len / 2, 0, 0); g.rotateZ(a); g.translate(0, 0, sd * z); RP.push(col(g, c)); };
  for (const sd of [-1, 1]) {
    const face = wd / 2 + 0.05;
    disc(sd, rr, 0.3, face, rc); // the rim lip
    disc(sd, rr * 0.9, 0.35, face + 0.06, st.rim === "steel" ? rc : "#202226"); // the dark between the spokes
    switch (st.rim) {
      case "five": for (let k = 0; k < 5; k++) for (const o of [-0.16, 0.16]) spoke(sd, rr * 0.75, 0.36, (k / 5) * Math.PI * 2 + o, face + 0.18, rc, rr * 0.12); break;
      case "multi": for (let k = 0; k < 10; k++) spoke(sd, rr * 0.8, 0.26, (k / 10) * Math.PI * 2, face + 0.18, rc, rr * 0.1); break;
      case "mesh": for (let k = 0; k < 8; k++) { spoke(sd, rr * 0.82, 0.2, (k / 8) * Math.PI * 2 + 0.3, face + 0.18, rc); spoke(sd, rr * 0.82, 0.2, (k / 8) * Math.PI * 2 - 0.3, face + 0.2, rc); } break;
      case "turbine": for (let k = 0; k < 12; k++) { const g = new THREE.BoxGeometry(rr * 0.75, 0.5, 0.3); g.translate(rr * 0.45, 0, 0); g.rotateY(0.35); g.rotateZ((k / 12) * Math.PI * 2); g.translate(0, 0, sd * (face + 0.2)); RP.push(col(g, k % 2 ? rc : "#e8ecf2")); } break;
      case "dish": disc(sd, rr * 0.88, 0.4, face + 0.12, "#e8ecf2"); for (let k = 0; k < 5; k++) spoke(sd, rr * 0.5, 0.6, (k / 5) * Math.PI * 2, face + 0.3, "#9aa3ad", rr * 0.2); break;
      case "wire": disc(sd, rr * 0.9, 0.3, face + 0.08, "#c9ced8"); for (let k = 0; k < 24; k++) spoke(sd, rr * 0.85, 0.08, (k / 24) * Math.PI * 2 + (k % 2 ? 0.25 : -0.25), face + 0.15 + (k % 2) * 0.05, "#e8ecf2", 0); break;
      case "steel": for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; RP.push(col(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 8).rotateX(Math.PI / 2).translate(Math.cos(a) * rr * 0.55, Math.sin(a) * rr * 0.55, sd * (face + 0.1)), "#15161b")); } disc(sd, rr * 0.4, 0.5, face + 0.2, "#c9ced8", 14); break;
    }
    disc(sd, R * 0.15, 0.55, face + 0.3, "#7a7f88", 10); // hub
    disc(sd, R * 0.5, 0.25, wd / 2 - 0.4, "#6a6e76", 20); // brake disc
  }
  // a brake calliper (red on the fast ones) at the top of the disc
  RP.push(bx(R * 0.3, R * 0.18, 0.6, 0, R * 0.42, wd / 2 - 0.55, st.diffuser ? "#c0392b" : "#3a3d45"), bx(R * 0.3, R * 0.18, 0.6, 0, R * 0.42, -wd / 2 + 0.55, st.diffuser ? "#c0392b" : "#3a3d45"));
  const rim = merge(RP);
  const wz = s.track ?? hw - wd / 2 - 0.2;
  const wheels = [{ x: s.wf, z: wz, front: true }, { x: s.wf, z: -wz, front: true }, { x: s.wr, z: wz, front: false }, { x: s.wr, z: -wz, front: false }];
  if (s.L > 70) wheels.push({ x: s.wr + R * 2.3, z: wz, front: false }, { x: s.wr + R * 2.3, z: -wz, front: false });
  // ---- model specific painted / coloured parts
  if (s.box) {
    const b = s.box, L = b.x1 - b.x0;
    const g = new THREE.BoxGeometry(L, b.h - s.y0 - 1, s.W * 0.98); g.translate((b.x0 + b.x1) / 2, s.y0 + 1 + (b.h - s.y0 - 1) / 2, 0);
    X.push(col(g, b.col ?? "#ffffff"));
    for (const z of [-1, 1]) X.push(bx(L - 2, 0.4, 0.3, (b.x0 + b.x1) / 2, s.y0 + 5, z * (s.W * 0.49 + 0.1), "#8a8f98"));
    X.push(bx(0.4, b.h - s.y0 - 4, 0.3, b.x0 - 0.1, (b.h + s.y0) / 2, 0, "#2a2d34")); // rear door seam
  }
  if (model === "bus") {
    // a row of side windows, a destination sign
    for (const z of [-1, 1]) for (let x = -hl + 8; x < hl - 18; x += 12) G.push({ id: "bus", geo: pane([[x, s.belt + 1, z * (hw + 0.05)], [x + 10.5, s.belt + 1, z * (hw + 0.05)], [x + 10.5, s.roof - 4, z * (hw + 0.05)], [x, s.roof - 4, z * (hw + 0.05)]]) });
    X.push(bx(0.4, 2.6, s.W * 0.6, hl - 0.1, s.roof - 2.4, 0, "#141416"));
  }
  if (model === "pickup") for (const z of [-1, 1]) X.push(bx(-hl - s.deckX + 0, 4, 0.8, (s.deckX - hl) / 2, s.deck + 2, z * (hw - 0.4), "#ffffff"));
  if (model === "offroad") { X.push(bx(18, 0.8, s.W * 0.8, (s.roofF + s.roofR) / 2, s.roof + 1.4, 0, "#2a2c33"), bx(14, 2.4, s.W * 0.6, (s.roofF + s.roofR) / 2, s.roof + 2.8, 0, "#5a5040")); T.push(cy(s.R, 2.2, -hl - 1.4, s.y0 + 6, 0, "#121214", "x", 18)); }
  if (model === "polsuv") { T.push(bx(2, 7, s.W * 0.86, hl + 1.4, yb + 3, 0, "#22252b")); for (const z of [-1, 1]) T.push(bx(2, 9, 1, hl + 1.4, yb + 4, z * s.W * 0.3, "#22252b")); }
  if (model === "interceptor") { X.push(bx(3.2, 0.5, s.W * 0.86, -hl + 2.2, s.deck + 3.6, 0, "#15161b")); for (const z of [-1, 1]) T.push(bx(1.4, 3, 0.5, -hl + 2.6, s.deck + 1.9, z * s.W * 0.25, "#15161b")); }
  if (model === "police" || model === "unmarked") T.push(bx(1.2, 3, s.W * 0.9, hl + 0.8, yb + 1.5, 0, "#22252b"));
  if (model === "taxi") X.push(bx(3.5, 2.8, 8, (s.roofF + s.roofR) / 2, s.roof + 1.4, 0, "#fff5b0", 1.2));
  if (model === "fire") { X.push(bx(s.box!.x1 - s.box!.x0 - 4, 1.2, 6, (s.box!.x0 + s.box!.x1) / 2, s.box!.h + 1, 0, "#c9ced8")); for (let i = 0; i < 12; i++) X.push(bx(0.6, 1, 6, s.box!.x0 + 3 + i * 4.4, s.box!.h + 2, 0, "#c9ced8")); }
  if (model === "tow") { X.push(bx(s.deckX + hl - 2, 1.6, s.W * 0.92, (s.deckX - hl) / 2, s.deck, 0, "#3a3d45")); const g = new THREE.BoxGeometry(24, 1.8, 2); g.rotateZ(0.6); g.translate(-hl + 10, s.deck + 8, 0); X.push(col(g, "#d9b23a")); }
  if (model === "garbage") X.push(bx(2, 20, s.W * 0.9, -hl - 1, s.y0 + 12, 0, "#2a2d34"));
  if (model === "icecream") X.push(col(new THREE.ConeGeometry(2.6, 7, 12).rotateX(Math.PI).translate(-8, s.box!.h + 3.6, 0), "#e0a860"), col(new THREE.SphereGeometry(2.8, 12, 8).translate(-8, s.box!.h + 7.8, 0), "#ffb3c6"));
  if (model === "ambulance") for (const z of [-1, 1]) X.push(bx(s.box!.x1 - s.box!.x0 - 2, 2.2, 0.3, (s.box!.x0 + s.box!.x1) / 2, s.y0 + 7, z * (s.W * 0.49 + 0.15), "#c0392b"));
  if (model === "hyper") {
    // rear wing on two struts, side intakes
    X.push(bx(3.4, 0.5, s.W * 0.9, -hl + 2.2, s.deck + 4.6, 0, "#ffffff"));
    for (const z of [-1, 1]) { T.push(bx(1.6, 4, 0.5, -hl + 2.6, s.deck + 2.4, z * s.W * 0.25, "#15161b")); T.push(bx(8, 2.4, 0.4, -4, s.belt - 3, z * (hw + 0.05), "#0c0d10")); T.push(bx(3.6, 0.5, 0.5, -hl + 2.2, s.deck + 4.6, z * s.W * 0.45, "#15161b")); }
  }
  if (model === "lowrider") {
    // chrome trims along the sides, white wall tyres look: chrome bumpers
    for (const z of [-1, 1]) T.push(bx(s.L - 6, 0.5, 0.3, 0, s.y0 + 4.4, z * (hw + 0.1), "#e8ecf2"));
    T.push(bx(1.2, 1.4, s.W * 0.95, hl + 0.4, s.y0 + 3, 0, "#e8ecf2"), bx(1.2, 1.4, s.W * 0.95, -hl - 0.4, s.y0 + 3, 0, "#e8ecf2"));
  }
  if (model === "monster") {
    // frame, shocks and a roll bar; the body sits high above the huge wheels
    T.push(bx(s.L * 0.8, 3, 6, 0, s.R + 1, 0, "#1b1c20"));
    for (const x of [s.wf, s.wr]) { T.push(bx(2, 2, s.track! * 2, x, s.R, 0, "#2a2c31")); for (const z of [-1, 1]) T.push(cy(0.9, s.y0 - s.R + 2, x + 2.5, (s.y0 + s.R) / 2, z * (hw - 2), "#ffd23f")); }
    T.push(bx(1.2, 6, s.W * 0.8, s.roofR - 1, s.roof + 2.5, 0, "#1b1c20"), bx(10, 1.2, 1.2, s.roofR + 3, s.roof + 5, s.W * 0.38, "#1b1c20"), bx(10, 1.2, 1.2, s.roofR + 3, s.roof + 5, -s.W * 0.38, "#1b1c20"));
    for (let i = 0; i < 4; i++) T.push(cy(0.8, 2.4, s.roofR + 2 + i * 2.6, s.roof + 6.2, 0, "#ffd23f", "y", 8)); // roof lights
  }
  if (model === "formula") {
    // front and rear wings with end plates, air intake above the driver, side pods
    X.push(bx(4, 0.5, s.track! * 2 + 2, hl - 2, 1.8, 0, "#ffffff"), bx(3.6, 0.6, s.track! * 2 - 2, -hl + 2, 11.5, 0, "#ffffff"));
    for (const z of [-1, 1]) { T.push(bx(5, 2.6, 0.4, hl - 2, 2.6, z * (s.track! + 1), "#15161b"), bx(5, 6, 0.4, -hl + 2, 9.4, z * (s.track! - 1), "#15161b")); X.push(bx(14, 3.4, 3, -6, 3.6, z * (hw + 1.2), "#ffffff")); }
    T.push(bx(1.2, 4, 1.2, -hl + 3, 8, 0, "#15161b"), cy(1.4, 3, s.seatX - 3, 9.6, 0, "#15161b", "y", 10));
  }
  // the doors of vans and trucks only have the cab part; the rest of the side is the box
  const res: RigGeo = {
    shape: s, body: col(lb.body, "#ffffff"), trim: merge(T), doors, glass: G, interior: merge(I),
    wheel: { tire: tGeo, rim }, wheels, steering: steer, wiper: wipers,
    lights: { head: merge(head), tail: merge(tail), brake: merge(brake), rev: merge(rev), indL: merge(indL), indR: merge(indR) },
    bumperF, bumperR,
    plateF: [hl + 0.35, yb + 1.2, 0], plateR: [-hl - 0.35, ty - 2.4 > s.y0 ? ty - 2.6 : yb + 1.4, 0],
    extra: X.length ? merge(X) : null,
    seat: [s.seatX, hip, -hw * 0.42], lean,
    eye: [s.seatX + rot(-0.2, 7.5)[0], hip + rot(-0.2, 7.5)[1], -hw * 0.42],
    exhaust: [-hl - 1.4, s.y0 + 0.8, hw * 0.55],
  };
  // painted pillars and roof belong to the body (they take the paint colour)
  if (P.length) { const b = mergeGeometries([res.body, ...P])!; res.body.dispose(); for (const g of P) g.dispose(); res.body = b; }
  cache.set(model, res);
  return res;
}

// a seated person (hip at the origin, facing +x), hands at the steering wheel (hx, hy, hz relative to the hip)
const driverCache = new Map<string, THREE.BufferGeometry>();
function driverGeo(skin: string, shirt: string, hair: string, hx: number, hy: number, hz: number, lean: number) {
  const key = [skin, shirt, hair, hx.toFixed(1), hy.toFixed(1), hz.toFixed(1), lean.toFixed(2)].join();
  const rz = (g: THREE.BufferGeometry) => g.rotateZ(lean - 0.12);
  const rp = (p: number[]) => { const a = lean - 0.12, c = Math.cos(a), sn = Math.sin(a); return [p[0] * c - p[1] * sn, p[0] * sn + p[1] * c, p[2]]; };
  const hit = driverCache.get(key);
  if (hit) return hit;
  const pants = "#2d3340";
  const limb = (a: number[], b: number[], t: number, c: string) => {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
    const g = new THREE.CylinderGeometry(t, t * 0.9, L, 7);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    return col(g, c);
  };
  const P: THREE.BufferGeometry[] = [];
  for (const z of [-1.1, 1.1]) {
    P.push(limb([0, 0, z], [4.4, 0.6, z], 0.95, pants), limb([4.4, 0.6, z], [5.4, -3.8, z], 0.75, pants), bx(2.4, 0.9, 1.3, 6, -4.2, z, "#1b1b1f"));
  }
  P.push(col(rz(new THREE.CapsuleGeometry(1.7, 3.2, 4, 10).scale(0.8, 1, 1.15).rotateZ(0.12).translate(-0.5, 3.4, 0)), shirt));
  P.push(col(rz(new THREE.CylinderGeometry(0.5, 0.55, 1, 8).translate(-0.6, 6.2, 0)), skin));
  P.push(col(rz(new THREE.SphereGeometry(1.2, 14, 10).scale(0.95, 1.12, 0.9).translate(-0.6, 7.6, 0)), skin));
  P.push(col(rz(new THREE.SphereGeometry(1.26, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 1.1, 0.95).translate(-0.75, 7.75, 0)), hair));
  for (const z of [-1, 1]) {
    const sh = rp([-0.4, 5.3, z * 2.0]), hand = [hx, hy + 0.3, hz + z * 1.5], el = [(sh[0] + hand[0]) / 2 + 0.2, (sh[1] + hand[1]) / 2 - 1.2, z * 2.2];
    P.push(limb(sh, el, 0.62, shirt), limb(el, hand, 0.5, shirt), col(new THREE.SphereGeometry(0.5, 8, 6).translate(hand[0], hand[1], hand[2]), skin));
  }
  const g = merge(P);
  driverCache.set(key, g);
  return g;
}

// --------------------------------------------------------------------------- materials and the per-car rig
export interface CarMats {
  paint: (hex: string) => THREE.MeshPhysicalMaterial;
  dented: (hex: string) => THREE.MeshPhysicalMaterial;
  trim: THREE.MeshStandardMaterial; interior: THREE.MeshStandardMaterial; glass: THREE.MeshPhysicalMaterial; cracked: THREE.MeshPhysicalMaterial;
  tire: THREE.MeshStandardMaterial; rim: THREE.MeshStandardMaterial;
  headOn: THREE.MeshBasicMaterial; headOff: THREE.MeshStandardMaterial; tailOn: THREE.MeshBasicMaterial; tailDim: THREE.MeshBasicMaterial;
  brakeOn: THREE.MeshBasicMaterial; revOn: THREE.MeshBasicMaterial; indOn: THREE.MeshBasicMaterial; offLens: THREE.MeshStandardMaterial;
  wreck: THREE.MeshStandardMaterial;
}
export function carMaterials(): CarMats {
  const canvas = (w: number, h: number, f: (g: CanvasRenderingContext2D) => void) => { const c = document.createElement("canvas"); c.width = w; c.height = h; f(c.getContext("2d")!); return c; };
  const crack = new THREE.CanvasTexture(canvas(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 1;
    for (let k = 0; k < 3; k++) { const cx = 20 + Math.random() * 88, cyy = 20 + Math.random() * 88; for (let i = 0; i < 9; i++) { const a = Math.random() * 6.28; g.beginPath(); g.moveTo(cx, cyy); let x = cx, y = cyy; for (let j = 0; j < 5; j++) { x += Math.cos(a + (Math.random() - 0.5)) * 9; y += Math.sin(a + (Math.random() - 0.5)) * 9; g.lineTo(x, y); } g.stroke(); } }
  }));
  const paints = new Map<string, THREE.MeshPhysicalMaterial>(), dents = new Map<string, THREE.MeshPhysicalMaterial>();
  return {
    paint: (hex) => { let m = paints.get(hex); if (!m) { m = new THREE.MeshPhysicalMaterial({ color: hex, vertexColors: true, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 }); paints.set(hex, m); } return m; },
    dented: (hex) => { let m = dents.get(hex); if (!m) { m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex).multiplyScalar(0.72), vertexColors: true, metalness: 0.3, roughness: 0.68, clearcoat: 0.15, envMapIntensity: 0.5 }); dents.set(hex, m); } return m; },
    trim: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.4, roughness: 0.45 }),
    interior: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x1c2a36, metalness: 0.2, roughness: 0.04, transparent: true, opacity: 0.66, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false }),
    cracked: new THREE.MeshPhysicalMaterial({ color: 0x5a6a78, map: crack, metalness: 0.1, roughness: 0.3, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }),
    tire: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
    rim: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.25 }),
    headOn: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.8, 2.3), toneMapped: false }),
    headOff: new THREE.MeshStandardMaterial({ color: 0xe8eef6, metalness: 0.2, roughness: 0.05, emissive: 0x404040 }),
    tailOn: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.1, 0.15), toneMapped: false }),
    tailDim: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.04, 0.06) }),
    brakeOn: new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 0.2, 0.25), toneMapped: false }),
    revOn: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.6, 2.6), toneMapped: false }),
    indOn: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 1.6, 0.1), toneMapped: false }),
    offLens: new THREE.MeshStandardMaterial({ color: 0x6a1a10, roughness: 0.2, metalness: 0.1 }),
    wreck: new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x2a2624, metalness: 0.2, roughness: 0.95 }),
  };
}

// one car on screen
export class CarRig {
  root = new THREE.Group();   // placed at the car position, turned by the car heading (set by the renderer)
  tilt = new THREE.Group();   // body motion (pitch, roll)
  body: THREE.Mesh; trim: THREE.Mesh; extra: THREE.Mesh | null = null; interior: THREE.Mesh;
  bumperF: THREE.Mesh; bumperR: THREE.Mesh;
  doors: { pivot: THREE.Group; panel: THREE.Mesh; glass: THREE.Mesh; open: number; target: number; side: 1 | -1 }[] = [];
  panes: { mesh: THREE.Mesh; id: string }[] = [];
  wheels: { pivot: THREE.Group; spin: THREE.Group; front: boolean; x: number; z: number }[] = [];
  steering: THREE.Mesh; wipers: THREE.Mesh[] = [];
  driver: THREE.Mesh; private driverKey = "";
  lights: Record<"head" | "tail" | "brake" | "rev" | "indL" | "indR", THREE.Mesh>;
  plates: THREE.Mesh[] = [];
  geo: RigGeo;
  private plateTex: THREE.CanvasTexture;
  private dentGeo: THREE.BufferGeometry | null = null; dents = 0;
  constructor(public model: CarModel, public color: string, private mats: CarMats, plate: string) {
    const g = this.geo = rigGeo(model);
    this.root.add(this.tilt);
    this.body = new THREE.Mesh(g.body, mats.paint(color));
    this.trim = new THREE.Mesh(g.trim, mats.trim);
    this.interior = new THREE.Mesh(g.interior, mats.interior);
    this.bumperF = new THREE.Mesh(g.bumperF, mats.paint(color)); this.bumperR = new THREE.Mesh(g.bumperR, mats.paint(color));
    this.tilt.add(this.body, this.trim, this.interior, this.bumperF, this.bumperR);
    if (g.extra) { this.extra = new THREE.Mesh(g.extra, mats.paint(color)); this.tilt.add(this.extra); }
    for (const d of g.doors) {
      const pivot = new THREE.Group(); pivot.position.set(d.hinge[0], 0, d.hinge[1]);
      const panel = new THREE.Mesh(d.geo, mats.paint(color)), glass = new THREE.Mesh(d.glass, mats.glass);
      glass.renderOrder = 2;
      pivot.add(panel, glass); this.tilt.add(pivot);
      this.doors.push({ pivot, panel, glass, open: 0, target: 0, side: d.side });
    }
    for (const p of g.glass) { const m = new THREE.Mesh(p.geo, mats.glass); m.renderOrder = 2; this.tilt.add(m); this.panes.push({ mesh: m, id: p.id }); }
    for (const w of g.wheels) {
      const pivot = new THREE.Group(); pivot.position.set(w.x, g.shape.R, w.z);
      const spin = new THREE.Group(); spin.add(new THREE.Mesh(g.wheel.tire, mats.tire), new THREE.Mesh(g.wheel.rim, mats.rim));
      pivot.add(spin); this.root.add(pivot);
      this.wheels.push({ pivot, spin, front: w.front, x: w.x, z: w.z });
    }
    this.steering = new THREE.Mesh(g.steering.geo, mats.interior);
    this.steering.position.set(g.steering.x, g.steering.y, g.steering.z);
    this.steering.rotation.order = "ZXY"; this.steering.rotation.z = 0.45; // leaning back; rotation.x turns it
    this.tilt.add(this.steering);
    // each wiper turns about the windshield normal (rotation.y of the blade, negative sweeps it up the glass)
    for (const w of g.wiper) {
      const arm = new THREE.Group(); arm.position.set(w.x, w.y, w.z); arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), w.n);
      const m = new THREE.Mesh(w.geo, mats.trim); arm.add(m); this.tilt.add(arm); this.wipers.push(m);
    }
    this.driver = new THREE.Mesh(new THREE.BufferGeometry(), mats.interior);
    this.driver.position.set(...g.seat); this.driver.visible = false;
    this.tilt.add(this.driver);
    this.lights = {
      head: new THREE.Mesh(g.lights.head, mats.headOff), tail: new THREE.Mesh(g.lights.tail, mats.tailDim), brake: new THREE.Mesh(g.lights.brake, mats.offLens),
      rev: new THREE.Mesh(g.lights.rev, mats.headOff), indL: new THREE.Mesh(g.lights.indL, mats.offLens), indR: new THREE.Mesh(g.lights.indR, mats.offLens),
    };
    for (const m of Object.values(this.lights)) this.tilt.add(m);
    // licence plates "SB · 1234" (Solara Bay)
    this.plateTex = new THREE.CanvasTexture((() => {
      const c = document.createElement("canvas"); c.width = 128; c.height = 32; const x = c.getContext("2d")!;
      x.fillStyle = "#f4f4f6"; x.fillRect(0, 0, 128, 32); x.fillStyle = "#1d4e89"; x.fillRect(0, 0, 14, 32); x.strokeStyle = "#15161b"; x.lineWidth = 2; x.strokeRect(1, 1, 126, 30);
      x.fillStyle = "#15161b"; x.font = "bold 20px Inter, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(plate, 71, 17);
      return c;
    })());
    this.plateTex.colorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.MeshStandardMaterial({ map: this.plateTex, roughness: 0.5 });
    for (const [pos, rot] of [[g.plateF, Math.PI / 2], [g.plateR, -Math.PI / 2]] as [[number, number, number], number][]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), pm); m.position.set(...pos); m.rotation.y = rot; this.tilt.add(m); this.plates.push(m);
    }
  }
  // somebody at the wheel (skin, shirt, hair colours); hands on the steering wheel
  setDriver(skin: string, shirt: string, hair: string) {
    const key = skin + shirt + hair;
    if (key === this.driverKey) return;
    this.driverKey = key;
    const g = this.geo, st = g.steering;
    this.driver.geometry = driverGeo(skin, shirt, hair, st.x - g.seat[0], st.y - g.seat[1], st.z - g.seat[2], g.lean);
  }
  // detail by distance: 0 near (everything), 1 mid (no interior), 2 far (body, wheels and lights only)
  lod = 0;
  setLod(l: number) {
    if (l === this.lod) return;
    this.lod = l;
    this.interior.visible = this.steering.visible = l === 0;
    for (const w of this.wipers) w.visible = l === 0;
    for (const p of this.plates) p.visible = l < 2;
  }
  setPaint(hex: string, damaged: boolean) {
    const m = damaged ? this.mats.dented(hex) : this.mats.paint(hex);
    this.body.material = m; this.bumperF.material = m; this.bumperR.material = m; for (const d of this.doors) d.panel.material = m;
    if (this.extra && !this.geo.shape.box) this.extra.material = m;
    this.color = hex;
  }
  wreck() {
    this.body.material = this.mats.wreck; this.bumperF.material = this.bumperR.material = this.mats.wreck; for (const d of this.doors) d.panel.material = this.mats.wreck;
    if (this.extra) this.extra.material = this.mats.wreck;
    for (const p of this.panes) p.mesh.visible = false;
    for (const d of this.doors) d.glass.visible = false;
  }
  // a dent where the car was hit (local x, z): the body is pushed in around that point
  dent(lx: number, lz: number, depth: number) {
    if (!this.dentGeo) { this.dentGeo = this.geo.body.clone(); this.body.geometry = this.dentGeo; }
    const p = this.dentGeo.attributes.position as THREE.BufferAttribute, R = 7;
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i) - lx, dz = p.getZ(i) - lz, d = Math.hypot(dx, dz);
      if (d > R) continue;
      const k = (1 - d / R) * depth;
      // inwards: towards the middle of the car
      const cx = -Math.sign(p.getX(i)) * (Math.abs(lx) > this.geo.shape.L / 2 - 6 ? 1 : 0), cz = -Math.sign(p.getZ(i)) * (Math.abs(lz) > this.geo.shape.W / 2 - 4 ? 1 : 0);
      p.setXYZ(i, p.getX(i) + cx * k, p.getY(i) - k * 0.3, p.getZ(i) + cz * k);
    }
    p.needsUpdate = true;
    this.dentGeo.computeVertexNormals();
    this.dents++;
  }
  // broken windows (a set of pane ids, "door0".."door3" for the door windows)
  setGlass(state: (id: string) => 0 | 1 | 2) { // 0 intact, 1 cracked, 2 gone
    for (const p of this.panes) { const s = state(p.id); p.mesh.visible = s < 2; p.mesh.material = s === 1 ? this.mats.cracked : this.mats.glass; }
    this.doors.forEach((d, i) => { const s = state("door" + i); d.glass.visible = s < 2; d.glass.material = s === 1 ? this.mats.cracked : this.mats.glass; });
  }
  dispose() { this.plateTex.dispose(); (this.plates[0].material as THREE.Material).dispose(); for (const pl of this.plates) pl.geometry.dispose(); this.dentGeo?.dispose(); }
  // a bumper hangs down and then is gone
  dropBumper(front: boolean) { const b = front ? this.bumperF : this.bumperR; b.visible = false; }
}
