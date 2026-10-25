// realistic people without external models: a skinned mesh with a skeleton of 54 bones (fingers included),
// generated from code for male and female proportions, with a face, hair styles and clothing,
// and keyframe animations played by an AnimationMixer with crossfades
import * as THREE from "three";

// people are drawn this much bigger than real (same factor as the vehicles, so they still fit in the seats)
export const PERSON_SCALE = 1.2;

// ----------------------------------------------------------------------------------------------- looks
export type Sex = "m" | "f";
export type Top = "tshirt" | "shirt" | "polo" | "suit" | "hoodie" | "leather" | "jacket" | "tank" | "track" | "dress" | "police" | "swat" | "army" | "hawaii" | "bomber";
export type Bottom = "jeans" | "pants" | "shorts" | "skirt" | "track" | "camo";
export type Shoes = "sneaker" | "leather" | "sandal" | "boot";
export type Hair = "short" | "buzz" | "long" | "ponytail" | "curls" | "bald" | "beanie" | "cap" | "policecap" | "helmet";
export interface Look {
  sex: Sex; height: number; build: number; age: 0 | 1 | 2; // size factor, girth factor (0.9 slim .. 1.15 strong), young/middle/old
  skin: string; hairCol: string; hair: Hair; stubble: boolean; beard?: number; tattoo?: number; // beard 2: full beard; tattoo 1..3 on bare arms
  top: Top; topCol: string; top2Col: string; bottom: Bottom; bottomCol: string; shoes: Shoes; shoeCol: string; accent: string; hatCol: string;
}

export const SKINS = ["#f6d3b8", "#f1c7a5", "#e0a982", "#c68a62", "#a86b45", "#8a5434", "#6b3e24", "#4f2c19"];
const HAIRS = ["#16100c", "#2b1d14", "#4a3220", "#6b4a2a", "#a07a48", "#c9a15a", "#7a3a1c", "#8a8a8a", "#c8c8c8"];
const TOPS = ["#e8e8ee", "#ff6f91", "#2bb3ff", "#ffd23f", "#3dd68c", "#ff8a3d", "#9b6bff", "#1f2a44", "#c0392b", "#16a085", "#f5f0e1", "#3a3d45", "#6d7f8f", "#b5835a"];
const BOTTOMS = ["#2c3e57", "#3b3b44", "#c9b48c", "#1c1c22", "#5b6e8c", "#e6e1d6", "#4a4a3a", "#7a5a3a"];
const SHOE = ["#e8e8ec", "#1b1b1f", "#5a3a22", "#c0392b", "#2b3242"];

const R = (seed: number) => { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// a person from a number (the same number always gives the same person); role: uniforms and gang colours
export function lookFromSeed(seed: number, role = "civ", shirt = "", pants = ""): Look {
  const r = R(seed * 7919 + 13), pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const sex: Sex = r() < 0.5 ? "m" : "f";
  const age = (r() < 0.2 ? 2 : r() < 0.5 ? 1 : 0) as 0 | 1 | 2;
  const L: Look = {
    sex, height: sex === "m" ? 0.96 + r() * 0.1 : 0.92 + r() * 0.09, build: 0.9 + r() * 0.25, age,
    skin: pick(SKINS), hairCol: age === 2 ? pick(["#8a8a8a", "#c8c8c8", "#a8a8a8"]) : pick(HAIRS),
    hair: sex === "m" ? pick(["short", "short", "buzz", "curls", "bald", "cap", "beanie"] as Hair[]) : pick(["long", "long", "ponytail", "curls", "short", "beanie"] as Hair[]),
    stubble: sex === "m" && r() < 0.35, beard: 0, tattoo: r() < 0.12 ? 1 + Math.floor(r() * 3) : 0,
    top: sex === "m" ? pick(["tshirt", "tshirt", "shirt", "polo", "hoodie", "jacket", "tank", "suit"] as Top[]) : pick(["tshirt", "shirt", "dress", "hoodie", "jacket", "tank", "polo"] as Top[]),
    topCol: pick(TOPS), top2Col: pick(["#f2f0ea", "#e8e8ee", "#1d1d22", "#c9c3b5"]),
    bottom: sex === "m" ? pick(["jeans", "jeans", "pants", "shorts"] as Bottom[]) : pick(["jeans", "skirt", "shorts", "pants"] as Bottom[]),
    bottomCol: pick(BOTTOMS), shoes: pick(["sneaker", "sneaker", "leather", "sandal"] as Shoes[]), shoeCol: pick(SHOE), accent: pick(["#c0392b", "#1d4e89", "#d4a017", "#1b1b1f"]), hatCol: pick(["#1b1b1f", "#c0392b", "#1d4e89", "#3a5a2a", "#e8e8ec"]),
  };
  if (L.sex === "m" && !L.stubble && r() < 0.15) L.beard = 2;
  if (L.top === "suit") { L.bottom = "pants"; L.bottomCol = L.topCol = pick(["#1d1d22", "#2b3242", "#4a4a52", "#6b5a45"]); L.shoes = "leather"; L.shoeCol = "#1b1b1f"; L.top2Col = "#f2f0ea"; }
  if (L.top === "dress") L.bottom = "skirt";
  if (role === "cop") Object.assign(L, { top: "police", topCol: "#1f3a6e", top2Col: "#1f3a6e", bottom: "pants", bottomCol: "#1b2436", shoes: "boot", shoeCol: "#111", hair: "policecap", hatCol: "#1b2436", accent: "#d4a017" });
  if (role === "swat") Object.assign(L, { top: "swat", topCol: "#1d1f24", top2Col: "#2a2d33", bottom: "pants", bottomCol: "#1d1f24", shoes: "boot", shoeCol: "#111", hair: "helmet", hatCol: "#16181c", accent: "#e8e8ec" });
  if (role === "army") Object.assign(L, { top: "army", topCol: "#56603e", top2Col: "#3f4630", bottom: "camo", bottomCol: "#56603e", shoes: "boot", shoeCol: "#2a2418", hair: "helmet", hatCol: "#4a5236", accent: "#2a2418" });
  if (role === "gang" && shirt) Object.assign(L, { top: pick(["tshirt", "hoodie", "tank"] as Top[]), topCol: shirt, bottom: "jeans", bottomCol: pants || "#1c1c22", hair: pick(["cap", "beanie", "buzz", "short"] as Hair[]), hatCol: shirt });
  else if (shirt && role !== "cop" && role !== "swat" && role !== "army") { L.topCol = shirt; if (pants) L.bottomCol = pants; }
  return L;
}

// ----------------------------------------------------------------------------------------------- skeleton
// bone: name, parent, offset from the parent in the rest pose (facing +x, y up, +z = right side)
type BoneDef = [string, string, number, number, number];
const FINGERS = ["thumb", "index", "middle", "ring", "pinky"];
function skeletonDefs(sex: Sex): BoneDef[] {
  const f = sex === "f", k = f ? 0.94 : 1;
  const sh = f ? 1.75 : 2.05, hipW = f ? 1.0 : 0.92;
  const B: BoneDef[] = [
    ["root", "", 0, 0, 0], ["hips", "root", 0, 9.5 * k, 0], ["spine", "hips", 0, 1.1 * k, 0], ["spine1", "spine", 0, 1.5 * k, 0], ["spine2", "spine1", 0, 1.6 * k, 0],
    ["neck", "spine2", 0.05, 1.55 * k, 0], ["head", "neck", 0.1, 0.85 * k, 0], ["jaw", "head", 0.35, -0.25, 0], ["eyeL", "head", 0.94, 0.95, -0.31], ["eyeR", "head", 0.94, 0.95, 0.31],
  ];
  const a = 0.2; // the arms hang 11° away from the body
  const up = 2.9 * k, fo = 2.55 * k;
  for (const [s, S] of [[-1, "L"], [1, "R"]] as const) {
    B.push([`shoulder${S}`, "spine2", -0.05, 1.05 * k, s * 0.55], [`upperArm${S}`, `shoulder${S}`, 0, -0.1, s * (sh - 0.55)]);
    B.push([`foreArm${S}`, `upperArm${S}`, 0, -up * Math.cos(a), s * up * Math.sin(a)], [`hand${S}`, `foreArm${S}`, 0.05, -fo * Math.cos(a), s * fo * Math.sin(a)]);
    // fingers: thumb in front, the others side by side along the palm (x), pointing down
    B.push([`thumb1${S}`, `hand${S}`, 0.32, -0.32, -s * 0.12], [`thumb2${S}`, `thumb1${S}`, 0.12, -0.32, 0]);
    [0.24, 0.08, -0.08, -0.24].forEach((x, i) => {
      const n = FINGERS[i + 1], l = [0.36, 0.4, 0.37, 0.3][i] * k;
      B.push([`${n}1${S}`, `hand${S}`, x, -0.88 * k, 0], [`${n}2${S}`, `${n}1${S}`, 0, -l, 0], [`${n}3${S}`, `${n}2${S}`, 0, -l * 0.8, 0]);
    });
    B.push([`upLeg${S}`, "hips", 0, -0.35, s * hipW], [`leg${S}`, `upLeg${S}`, 0.05, -4.45 * k, 0], [`foot${S}`, `leg${S}`, -0.1, -4.15 * k, 0], [`toe${S}`, `foot${S}`, 1.55 * k, -0.45, 0]);
  }
  return B;
}
export const BONE_COUNT = skeletonDefs("m").length; // 54

// ----------------------------------------------------------------------------------------------- mesh builder
// palette zones (colour per person, see the material)
const Z = { skin: 0, top: 1, top2: 2, bottom: 3, shoes: 4, hair: 5, dark: 6, white: 7, lips: 8, accent: 9, hat: 10, stubble: 11, vest: 12, sole: 13, arm: 14 } as const;
const ZONES = 15;

class Builder {
  pos: number[] = []; uv: number[] = []; zone: number[] = []; zp: number[] = []; si: number[] = []; sw: number[] = []; idx: number[] = [];
  constructor(private bones: Map<string, { i: number; p: THREE.Vector3 }>) {}
  bi(n: string) { return this.bones.get(n)!.i; }
  bp(n: string) { return this.bones.get(n)!.p; }
  vert(p: THREE.Vector3, w: [string, number][], zone: number, u: number, v: number, zp = 0) {
    this.pos.push(p.x, p.y, p.z); this.uv.push(u, v); this.zone.push(zone); this.zp.push(zp);
    const ws = w.slice(0, 4), tot = ws.reduce((a, b) => a + b[1], 0) || 1;
    for (let k = 0; k < 4; k++) { this.si.push(ws[k] ? this.bi(ws[k][0]) : 0); this.sw.push(ws[k] ? ws[k][1] / tot : 0); }
    return this.pos.length / 3 - 1;
  }
  // a tube through rings; side/front: unit vectors of the ring plane; f(φ) gives the zone (φ = 0 right side, π/2 front)
  tube(rings: { c: THREE.Vector3; rs: number; rf: number; w: [string, number][]; zone: (phi: number) => number; v: number; sq?: number }[], side: THREE.Vector3, front: THREE.Vector3, n: number, caps: [boolean, boolean], skinUv = false) {
    const start = this.pos.length / 3;
    for (const r of rings) for (let j = 0; j <= n; j++) {
      const phi = (j / n) * Math.PI * 2, c = Math.cos(phi), s = Math.sin(phi), q = r.sq ?? 2;
      const cx = Math.sign(c) * Math.pow(Math.abs(c), 2 / q), sx = Math.sign(s) * Math.pow(Math.abs(s), 2 / q);
      const p = r.c.clone().addScaledVector(side, cx * r.rs).addScaledVector(front, sx * r.rf);
      const z = r.zone(phi);
      this.vert(p, r.w, z, z === Z.skin || skinUv ? 0.97 : j / n * 0.85, r.v);
    }
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n; j++) {
      const a = start + i * (n + 1) + j, b = a + n + 1;
      this.idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    for (const [k, on] of [[0, caps[0]], [rings.length - 1, caps[1]]] as [number, boolean][]) {
      if (!on) continue;
      const r = rings[k], ci = this.vert(r.c.clone(), r.w, r.zone(Math.PI / 2), 0.97, r.v), base = start + k * (n + 1);
      for (let j = 0; j < n; j++) { if (k === 0) this.idx.push(ci, base + j + 1, base + j); else this.idx.push(ci, base + j, base + j + 1); }
    }
  }
  // any three.js geometry fixed to one bone (offset in bone space = rest position + p)
  geo(g: THREE.BufferGeometry, bone: string, zone: number | ((p: THREE.Vector3) => number), w?: [string, number][]) {
    const P = g.attributes.position, start = this.pos.length / 3, base = this.bp(bone), v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      const z = typeof zone === "number" ? zone : zone(v);
      this.vert(v.clone().add(base), w ?? [[bone, 1]], z, 0.97, 0.5);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(start + g.index.getX(i));
    else for (let i = 0; i < P.count; i++) this.idx.push(start + i);
    g.dispose();
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("zone", new THREE.Float32BufferAttribute(this.zone, 1));
    g.setAttribute("zparam", new THREE.Float32BufferAttribute(this.zp, 1));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SIDE = V(0, 0, 1), FRONT = V(1, 0, 0);

export interface BodySpec { look: Look; detail: 0 | 1; } // 0: player (hands with single fingers), 1: people around
function restPositions(defs: BoneDef[]) {
  const m = new Map<string, { i: number; p: THREE.Vector3 }>();
  defs.forEach(([n, par, x, y, z], i) => { const pp = par ? m.get(par)!.p : V(0, 0, 0); m.set(n, { i, p: pp.clone().add(V(x, y, z)) }); });
  return m;
}

function buildBody(L: Look, detail: 0 | 1, vestOnly = false): THREE.BufferGeometry {
  if (!vestOnly && BASE[L.sex + detail]) return buildModelled(L, detail);
  const defs = skeletonDefs(L.sex), bones = restPositions(defs), b = new Builder(bones);
  const f = L.sex === "f", g = L.build, n = detail === 0 ? 26 : 12, nl = detail === 0 ? 16 : 9;
  const P = (s: string) => bones.get(s)!.p;
  const top = L.top, bottom = L.bottom;
  const jacketOpen = top === "suit" || top === "leather" || top === "jacket" || top === "bomber";
  const longSleeve = ["shirt", "suit", "hoodie", "leather", "jacket", "track", "swat", "army", "bomber"].includes(top);
  const sleeve = top === "tank" || top === "dress" ? 0 : longSleeve ? 1 : top === "police" ? 0.42 : 0.36;
  const pantLen = bottom === "shorts" ? 0.42 : bottom === "skirt" ? 0 : 1;
  if (vestOnly) {
    // armour vest over the clothes
    const big = BASE[L.sex + "1"] ? 1.1 : 1; // around the modelled body (a little fuller than the old one)
    const rings = [10.3, 11.4, 12.6, 13.8, 14.6].map((y, i) => ({ c: V(0.05, y * (f ? 0.94 : 1), 0), rs: [1.75, 1.7, 1.95, 2.0, 1.7][i] * g * big, rf: [1.25, 1.2, 1.45, 1.4, 1.1][i] * g * big, w: torsoW(y * (f ? 0.94 : 1), f), zone: () => Z.vest, v: i / 4, sq: 3 }));
    b.tube(rings, SIDE, FRONT, 12, [false, false]);
    return b.build();
  }
  // ---- torso: hips to the neck, sections with width (rs) and depth (rf)
  const T: [number, number, number][] = f
    ? [[8.5, 1.5, 0.95], [9.2, 1.9, 1.1], [10.2, 1.85, 1.0], [11.0, 1.4, 0.9], [11.9, 1.45, 0.95], [12.6, 1.58, 1.2], [13.3, 1.62, 1.12], [13.9, 1.62, 0.92], [14.4, 1.4, 0.78], [14.8, 0.85, 0.6], [15.0, 0.55, 0.5]]
    : [[8.9, 1.45, 0.9], [9.6, 1.7, 1.05], [10.5, 1.65, 1.0], [11.4, 1.5, 0.95], [12.3, 1.62, 1.05], [13.2, 1.78, 1.12], [14.0, 1.86, 1.02], [14.6, 1.62, 0.85], [15.1, 0.95, 0.66], [15.5, 0.6, 0.55]];
  const neckY = T[T.length - 1][0];
  const zoneTorso = (y: number) => (phi: number) => {
    const front = Math.abs(phi - Math.PI / 2);
    if (y > neckY - 0.4) return top === "tank" || top === "dress" ? Z.skin : (top === "hoodie" ? Z.top : Z.top2);
    if (y < 10.2 * (f ? 0.94 : 1)) {
      if (bottom === "skirt") return top === "dress" ? Z.top : Z.bottom;
      if (Math.abs(y - 10.15 * (f ? 0.94 : 1)) < 0.25 && top !== "dress" && top !== "hoodie" && top !== "track") return Z.dark; // belt
      return Z.bottom;
    }
    if (jacketOpen && y > 10.6) { const w = 0.12 + (y - 10.6) * 0.09; if (front < w) return top === "suit" && front < 0.07 && y > 11.2 ? Z.accent : Z.top2; }
    if (top === "police" && y > 13 && y < 13.6 && phi > 1.0 && phi < 1.3) return Z.accent; // badge
    if (top === "track" && Math.abs(Math.cos(phi)) > 0.97) return Z.accent;
    if (top === "tank" && y > 13.6 && Math.abs(Math.cos(phi)) > 0.75) return Z.skin;
    return Z.top;
  };
  b.tube(T.map(([y, rs, rf], i) => ({ c: V(y > 12 ? -0.05 : 0, y, 0), rs: rs * g, rf: rf * g, w: torsoW(y, f), zone: zoneTorso(y), v: i / (T.length - 1), sq: y > 14.3 ? 2 : 2.25 })), SIDE, FRONT, n, [true, false]);
  // neck
  const nk = P("neck"), hd = P("head");
  b.tube([0, 0.5, 1].map((t) => ({ c: nk.clone().lerp(hd, t).add(V(0, -0.35, 0)), rs: lerp(0.62, 0.5, t) * Math.min(1.1, g), rf: lerp(0.6, 0.52, t), w: t < 0.5 ? [["neck", 1]] as [string, number][] : [["neck", 0.5], ["head", 0.5]] as [string, number][], zone: () => (top === "hoodie" && t === 0 ? Z.top : Z.skin), v: t })), SIDE, FRONT, nl, [false, false]);
  if (top === "shirt" || top === "polo" || top === "suit" || top === "police" || top === "leather" || top === "bomber") {
    // collar
    b.tube([0, 1].map((t) => ({ c: V(0, neckY - 0.2 + t * 0.55, 0).add(V(0.02, 0, 0)), rs: 0.72 + t * 0.06, rf: 0.68 + t * 0.06, w: [["spine2", 0.5], ["neck", 0.5]] as [string, number][], zone: () => (top === "leather" || top === "bomber" ? Z.top : Z.top2), v: t })), SIDE, FRONT, nl, [false, false]);
  }
  if (top === "hoodie") b.geo(new THREE.SphereGeometry(1.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.8, 0.7, 1.1).rotateZ(1.2).translate(-0.95, -0.3, 0), "spine2", Z.top, [["spine2", 0.7], ["neck", 0.3]]);
  // ---- arms and hands
  for (const [s, S] of [[-1, "L"], [1, "R"]] as const) {
    const sho = P(`upperArm${S}`), wr = P(`hand${S}`), dir = wr.clone().sub(sho).normalize();
    const side = V(0, 0, 1).sub(dir.clone().multiplyScalar(dir.z)).normalize();
    const A: { t: number; r: number; w: [string, number][] }[] = [
      { t: -0.1, r: 0.68, w: [[`shoulder${S}`, 0.75], [`upperArm${S}`, 0.25]] }, { t: 0.04, r: 0.66, w: [[`shoulder${S}`, 0.2], [`upperArm${S}`, 0.8]] }, { t: 0.2, r: 0.56, w: [[`upperArm${S}`, 1]] },
      { t: 0.4, r: 0.47, w: [[`upperArm${S}`, 1]] }, { t: 0.5, r: 0.41, w: [[`upperArm${S}`, 0.5], [`foreArm${S}`, 0.5]] }, { t: 0.6, r: 0.43, w: [[`foreArm${S}`, 1]] },
      { t: 0.75, r: 0.38, w: [[`foreArm${S}`, 1]] }, { t: 0.92, r: 0.29, w: [[`foreArm${S}`, 0.8], [`hand${S}`, 0.2]] }, { t: 1.0, r: 0.27, w: [[`foreArm${S}`, 0.4], [`hand${S}`, 0.6]] },
    ];
    const armLen = wr.distanceTo(sho);
    b.tube(A.map((a) => ({ c: sho.clone().addScaledVector(dir, a.t * armLen), rs: a.r * Math.min(1.15, g) * (f ? 0.88 : 1), rf: a.r * Math.min(1.15, g) * (f ? 0.88 : 1), w: a.w,
      zone: (phi: number) => (a.t < sleeve ? (top === "track" && Math.abs(Math.sin(phi)) > 0.94 ? Z.accent : Z.top) : Z.arm), v: a.t })), side, FRONT, nl, [false, false]);
    // palm and fingers (pointing down along the arm)
    const hand = P(`hand${S}`);
    const palm = [0, 0.45, 0.9].map((t, i) => ({ c: hand.clone().add(V(0.02, -t, 0)), rs: [0.2, 0.17, 0.15][i] * (f ? 0.9 : 1), rf: [0.36, 0.42, 0.4][i] * (f ? 0.9 : 1), w: [[`hand${S}`, 1]] as [string, number][], zone: () => Z.skin, v: t, sq: 2.6 }));
    b.tube(palm, SIDE, FRONT, 8, [true, false], true);
    if (detail === 0) {
      for (const fn of FINGERS) {
        const segs = fn === "thumb" ? [`thumb1${S}`, `thumb2${S}`] : [`${fn}1${S}`, `${fn}2${S}`, `${fn}3${S}`];
        const pts = segs.map((x) => P(x));
        const tip = pts[pts.length - 1].clone().add(pts[pts.length - 1].clone().sub(pts[pts.length - 2]).multiplyScalar(0.75));
        const all = fn === "thumb" ? [hand.clone().add(V(0.22, -0.2, -s * 0.08)), ...pts, tip] : [...pts, tip];
        const rr = fn === "thumb" ? 0.12 : fn === "pinky" ? 0.08 : 0.095;
        b.tube(all.map((c, i) => ({ c, rs: rr * (f ? 0.9 : 1), rf: rr * (f ? 0.9 : 1), w: [[segs[Math.min(segs.length - 1, Math.max(0, fn === "thumb" ? i - 1 : i))], 1]] as [string, number][], zone: () => Z.skin, v: i / all.length })), SIDE, FRONT, 6, [false, true], true);
      }
    } else {
      // people around: the four fingers as one part, plus the thumb
      const m1 = P(`middle1${S}`), m3 = P(`middle3${S}`);
      b.tube([m1.clone().add(V(0, 0.1, 0)), P(`middle2${S}`), m3, m3.clone().add(V(0, -0.3, 0))].map((c, i) => ({ c, rs: 0.13, rf: [0.38, 0.36, 0.32, 0.22][i], w: [[[`middle1${S}`, `middle1${S}`, `middle2${S}`, `middle3${S}`][i], 1]] as [string, number][], zone: () => Z.skin, v: i / 3 })), SIDE, FRONT, 6, [false, true], true);
      b.tube([hand.clone().add(V(0.22, -0.2, -s * 0.08)), P(`thumb1${S}`), P(`thumb2${S}`), P(`thumb2${S}`).clone().add(V(0.1, -0.25, 0))].map((c, i) => ({ c, rs: 0.11, rf: 0.11, w: [[[`hand${S}`, `thumb1${S}`, `thumb2${S}`, `thumb2${S}`][i], 1]] as [string, number][], zone: () => Z.skin, v: i / 3 })), SIDE, FRONT, 5, [false, true], true);
    }
  }
  // ---- legs and shoes
  for (const [s, S] of [[-1, "L"], [1, "R"]] as const) {
    const hp = P(`upLeg${S}`), kn = P(`leg${S}`), an = P(`foot${S}`);
    const Lr: { y: number; r: number; w: [string, number][] }[] = [
      { y: 0, r: 0.98, w: [["hips", 0.6], [`upLeg${S}`, 0.4]] }, { y: 0.12, r: 0.9, w: [["hips", 0.2], [`upLeg${S}`, 0.8]] }, { y: 0.3, r: 0.78, w: [[`upLeg${S}`, 1]] },
      { y: 0.45, r: 0.6, w: [[`upLeg${S}`, 1]] }, { y: 0.5, r: 0.54, w: [[`upLeg${S}`, 0.5], [`leg${S}`, 0.5]] }, { y: 0.56, r: 0.52, w: [[`leg${S}`, 1]] },
      { y: 0.66, r: 0.58, w: [[`leg${S}`, 1]] }, { y: 0.82, r: 0.42, w: [[`leg${S}`, 1]] }, { y: 0.96, r: 0.32, w: [[`leg${S}`, 0.8], [`foot${S}`, 0.2]] }, { y: 1.0, r: 0.31, w: [[`leg${S}`, 0.5], [`foot${S}`, 0.5]] },
    ];
    const pt = (t: number) => (t <= 0.5 ? hp.clone().lerp(kn, t / 0.5) : kn.clone().lerp(an, (t - 0.5) / 0.5));
    const boot = L.shoes === "boot";
    b.tube(Lr.map((l) => ({ c: pt(l.y).add(V(l.y > 0.6 && l.y < 0.9 ? -0.1 : 0, 0, -s * l.y * 0.05)), rs: l.r * g * (f && l.y < 0.4 ? 1.05 : 1), rf: l.r * g * (l.y > 0.6 && l.y < 0.9 ? 1.08 : 1), w: l.w,
      zone: (phi: number) => (boot && l.y > 0.85 ? Z.shoes : l.y < pantLen ? (bottom === "track" && Math.abs(Math.cos(phi)) > 0.95 ? Z.accent : Z.bottom) : Z.skin), v: l.y })), SIDE, FRONT, nl, [false, false]);
    // shoe: from the heel to the toes along +x, sole at the bottom
    const sh = (x: number, h: number, w: number, bone: [string, number][], yb = 0) => ({ c: an.clone().add(V(x, -0.62 + h / 2 + yb, 0)), rs: w, rf: h / 2, w: bone, zone: (phi: number) => (L.shoes === "sandal" ? (Math.sin(phi) < -0.6 ? Z.sole : phi > 0.4 && phi < 2.7 && x > 0.4 ? Z.skin : Z.shoes) : Math.sin(phi) < -0.75 ? Z.sole : Z.shoes), v: x });
    const fw: [string, number][] = [[`foot${S}`, 1]], tw: [string, number][] = [[`toe${S}`, 1]], mw: [string, number][] = [[`foot${S}`, 0.5], [`toe${S}`, 0.5]];
    const sz = L.shoes === "sandal" ? 0.9 : 1;
    b.tube([sh(-0.45, 0.7, 0.36 * sz, fw), sh(-0.3, 1.0, 0.42 * sz, fw), sh(0.25, 1.0, 0.45 * sz, fw, 0.05), sh(0.95, 0.75, 0.48 * sz, fw), sh(1.45, 0.6, 0.48 * sz, mw), sh(1.95, 0.5, 0.44 * sz, tw), sh(2.2, 0.36, 0.34 * sz, tw)], FRONT.clone().negate().cross(V(0, 1, 0)).normalize().negate(), V(0, 1, 0), 10, [true, true]);
  }
  // skirt / dress
  if (bottom === "skirt") {
    const y0 = 10.6 * (f ? 0.94 : 1);
    b.tube([0, 0.33, 0.66, 1].map((t, i) => ({ c: V(0, y0 - t * 4.4, 0), rs: lerp(1.75, 2.35, t) * g, rf: lerp(1.05, 1.9, t) * g, w: i === 0 ? [["hips", 1]] as [string, number][] : [["hips", 1 - t * 0.6], ["upLegL", t * 0.3], ["upLegR", t * 0.3]] as [string, number][], zone: () => (top === "dress" ? Z.top : Z.bottom), v: t })), SIDE, FRONT, n, [false, false]);
  }
  if (top === "swat" || top === "police") {
    // duty belt with pouches
    for (const s of [-1, 1]) b.geo(new THREE.BoxGeometry(0.7, 0.8, 0.5).translate(0.6, 0.6, s * 1.55), "hips", Z.dark);
  }
  if (top === "swat") {
    const rings = [10.3, 11.4, 12.6, 13.8, 14.6].map((y, i) => ({ c: V(0.05, y, 0), rs: [1.75, 1.7, 1.95, 2.15, 1.8][i] * g, rf: [1.25, 1.2, 1.45, 1.45, 1.15][i] * g, w: torsoW(y, f), zone: () => Z.vest, v: i / 4, sq: 3 }));
    b.tube(rings, SIDE, FRONT, 12, [false, false]);
  }
  // ---- head: a shaped ellipsoid with face
  head(b, L, P("head"), detail);
  return b.build();
}

// ----------------------------------------------------------------------------------------------- modelled bodies (Blender)
// tools/blender/human.py makes a male and a female body in two levels of detail on the same skeleton; the game reads
// their rest pose, normals, skin weights and face regions once and dresses them here (colour zones, hair, shoes, collars)
interface BaseBody { pos: Float32Array; nrm: Float32Array; reg: Uint8Array; si: Uint16Array; sw: Float32Array; idx: Uint32Array; dom: Uint8Array }
const BASE: Record<string, BaseBody> = {};
export let BODY_GEN = 0; // goes up when the modelled bodies arrive (people built before get rebuilt)
const REG = { body: 0, head: 1, lips: 2, brow: 3, eye: 4, iris: 5, lowface: 6, hand: 7 } as const;
export function setModelledBodies(src: { sex: Sex; scene: THREE.Object3D }[]) {
  for (const { sex, scene } of src) {
    const meshes: THREE.SkinnedMesh[] = [];
    scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh); });
    if (meshes.length < 2) continue;
    meshes.sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count); // lod0 has more vertices
    const order = skeletonDefs(sex).map((d) => d[0]);
    meshes.slice(0, 2).forEach((m, lod) => {
      const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
      const map = m.skeleton.bones.map((bn) => Math.max(0, order.indexOf(bn.name)));
      const n = P.count, out: BaseBody = { pos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), reg: new Uint8Array(n), si: new Uint16Array(n * 4), sw: new Float32Array(n * 4), idx: new Uint32Array(g.index ? g.index.count : n), dom: new Uint8Array(n) };
      for (let i = 0; i < n; i++) {
        out.pos[i * 3] = P.getX(i); out.pos[i * 3 + 1] = P.getY(i); out.pos[i * 3 + 2] = P.getZ(i);
        out.nrm[i * 3] = N.getX(i); out.nrm[i * 3 + 1] = N.getY(i); out.nrm[i * 3 + 2] = N.getZ(i);
        out.reg[i] = Math.floor(U.getX(i) * 10);
        let best = 0, bw = -1, tot = 0;
        for (let k = 0; k < 4; k++) { const w = W.getComponent(i, k); tot += w; }
        for (let k = 0; k < 4; k++) {
          const w = W.getComponent(i, k) / (tot || 1), j = map[J.getComponent(i, k)];
          out.si[i * 4 + k] = j; out.sw[i * 4 + k] = w;
          if (w > bw) { bw = w; best = j; }
        }
        out.dom[i] = best;
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) out.idx[i] = g.index.getX(i); else for (let i = 0; i < n; i++) out.idx[i] = i;
      BASE[sex + lod] = out;
    });
  }
  BODY_GEN++;
  // bodies built from the old shapes are not used any more
  for (const [k, e] of geoCache) if (e.refs === 0) { e.g.dispose(); geoCache.delete(k); }
  for (const g of vestCache.values()) g.dispose();
  vestCache.clear();
}

// hair on a modelled head: coloured above the hair line (per pixel) and lifted off the scalp a little
const HAIR_THICK: Partial<Record<Hair, number>> = { buzz: 0.035, short: 0.09, curls: 0.16, long: 0.1, ponytail: 0.08 };
// centre of the skull in the rest pose (the hair line is measured from it)
const headC: Partial<Record<Sex, THREE.Vector3>> = {};
function headCentre(sex: Sex) { return (headC[sex] ??= restPositions(skeletonDefs(sex)).get("head")!.p.clone().add(V(0.12, 0.85, 0))); }

function buildModelled(L: Look, detail: 0 | 1): THREE.BufferGeometry {
  const B = BASE[L.sex + detail], f = L.sex === "f", g = L.build, k = f ? 0.94 : 1;
  const defs = skeletonDefs(L.sex), bones = restPositions(defs), b = new Builder(bones), names = defs.map((d) => d[0]);
  const P = (n: string) => bones.get(n)!.p;
  const top = L.top, bottom = L.bottom;
  const jacketOpen = top === "suit" || top === "leather" || top === "jacket" || top === "bomber";
  const longSleeve = ["shirt", "suit", "hoodie", "leather", "jacket", "track", "swat", "army", "bomber"].includes(top);
  const sleeve = top === "tank" || top === "dress" ? 0 : longSleeve ? 1 : top === "police" ? 0.42 : 0.36;
  const pantLen = bottom === "shorts" ? 0.42 : bottom === "skirt" ? 0 : 1;
  const neckY = (f ? 14.5 : 15.35);
  const thick = jacketOpen || top === "hoodie" || top === "swat" || top === "army" ? 0.14 : 0.06; // jackets stand off the body more
  // where the clothes end is decided per pixel in the material (zones 20-23, see personMaterial)
  const ARM = /^(shoulder|upperArm|foreArm)/, HAND = /^(hand|thumb|index|middle|ring|pinky)/, LEG = /^(upLeg|leg)/, FOOT = /^(foot|toe)/;
  const n = B.pos.length / 3, start = b.pos.length / 3;
  const p = V(0, 0, 0), q = V(0, 0, 0), seg = V(0, 0, 0);
  const nrmOut: number[] = [];
  const hc0 = headCentre(L.sex);
  const ramp = (edge: number, t: number) => Math.max(0, Math.min(1, (edge + 0.04 - t) / 0.08)); // 1 well inside the cloth, 0 outside
  const tAlong = (a0: THREE.Vector3, a1: THREE.Vector3) => seg.subVectors(a1, a0).dot(q.subVectors(p, a0)) / seg.lengthSq();
  for (let i = 0; i < n; i++) {
    p.set(B.pos[i * 3], B.pos[i * 3 + 1], B.pos[i * 3 + 2]);
    const reg = B.reg[i], bone = names[B.dom[i]] ?? "hips", side = p.z < 0 ? "L" : "R";
    let zone: number = Z.skin, lift = 0, zp = 0;
    const phi = (Math.atan2(p.x, p.z) + Math.PI * 2) % (Math.PI * 2); // 0 right side, π/2 front
    if (reg === REG.lips) zone = Z.lips;
    else if (reg === REG.brow) zone = Z.hair;
    else if (reg === REG.eye) zone = Z.white;
    else if (reg === REG.iris) zone = Z.dark;
    else if (reg === REG.lowface) zone = L.stubble || (L.beard ?? 0) >= 1 ? Z.stubble : Z.skin;
    else if (reg === REG.head) {
      zone = 24;
      // the hair stands off the scalp a little (fades out at the hair line)
      const th = HAIR_THICK[L.hair];
      if (th) {
        const dx = p.x - hc0.x, dy = p.y - hc0.y, dz = p.z - hc0.z, ang = Math.atan2(dz, dx), back = (1 - Math.cos(ang)) / 2;
        const line = 0.42 - 0.97 * back + 0.3 * Math.sin(ang) ** 2 - (L.hair === "long" || L.hair === "ponytail" ? 0.25 * back : 0);
        lift = th * Math.max(0, Math.min(1, (dy - line) / 0.12));
      }
    } else if (reg === REG.hand || HAND.test(bone)) zone = Z.skin;
    else if (ARM.test(bone) && !bone.startsWith("shoulder")) {
      zone = 21; zp = tAlong(P("upperArm" + side), P("hand" + side));
      lift = thick * 0.7 * ramp(sleeve, zp);
    } else if (LEG.test(bone) || (bone === "hips" && p.y < 9.4 * k && Math.abs(p.z) > 0.5)) {
      zone = 22; zp = Math.max(0, tAlong(P("upLeg" + side), P("foot" + side)));
      lift = 0.05 * ramp(pantLen, zp);
    } else if (FOOT.test(bone)) zone = 23;
    else {
      zone = 20;
      lift = p.y > neckY - 0.4 ? (top === "tank" || top === "dress" ? 0 : 0.03) : p.y < 10.2 * k ? 0.05 : thick;
    }
    // build: fuller or slimmer around the bone the vertex belongs to (not the head, the hands and the feet)
    if (g !== 1 && reg === REG.body && !HAND.test(bone) && !FOOT.test(bone) && bone !== "head" && bone !== "neck") {
      let ax: THREE.Vector3, bx: THREE.Vector3;
      if (ARM.test(bone) && !bone.startsWith("shoulder")) { ax = P("upperArm" + side); bx = P("hand" + side); }
      else if (LEG.test(bone)) { ax = P("upLeg" + side); bx = P("foot" + side); }
      else { ax = V(0, 0, 0); bx = V(0, 20, 0); }
      seg.subVectors(bx, ax); const t = Math.max(0, Math.min(1, q.subVectors(p, ax).dot(seg) / seg.lengthSq()));
      const c = ax.clone().addScaledVector(seg, t);
      const gg = ARM.test(bone) ? Math.min(1.15, g) : g;
      p.sub(c).multiplyScalar(gg).add(c);
    }
    // clothes sit on the skin
    if (lift) { p.x += B.nrm[i * 3] * lift; p.y += B.nrm[i * 3 + 1] * lift; p.z += B.nrm[i * 3 + 2] * lift; }
    const w: [string, number][] = [];
    for (let kk = 0; kk < 4; kk++) if (B.sw[i * 4 + kk] > 0) w.push([names[B.si[i * 4 + kk]], B.sw[i * 4 + kk]]);
    b.vert(p.clone(), w.length ? w : [["hips", 1]], zone, zone >= 20 ? (phi / (Math.PI * 2)) * 0.85 : 0.97, p.y / 18, zp);
    nrmOut.push(B.nrm[i * 3], B.nrm[i * 3 + 1], B.nrm[i * 3 + 2]);
  }
  for (let i = 0; i < B.idx.length; i++) b.idx.push(start + B.idx[i]);
  const bodyEnd = b.pos.length / 3;
  // collar, hood, duty belt, skirt, shoes (the old parts fit the new body)
  const nl = detail === 0 ? 16 : 9, nn = detail === 0 ? 26 : 12;
  if (top === "shirt" || top === "polo" || top === "suit" || top === "police" || top === "leather" || top === "bomber") {
    b.tube([0, 1].map((t) => ({ c: V(0.02, neckY - 0.25 + t * 0.55, 0), rs: (f ? 0.68 : 0.78) + t * 0.06, rf: (f ? 0.64 : 0.74) + t * 0.06, w: [["spine2", 0.5], ["neck", 0.5]] as [string, number][], zone: () => (top === "leather" || top === "bomber" ? Z.top : Z.top2), v: t })), SIDE, FRONT, nl, [false, false]);
  }
  if (top === "hoodie") b.geo(new THREE.SphereGeometry(1.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.8, 0.7, 1.1).rotateZ(1.2).translate(-1.0, -0.3, 0), "spine2", Z.top, [["spine2", 0.7], ["neck", 0.3]]);
  if (top === "swat" || top === "police") for (const s of [-1, 1]) b.geo(new THREE.BoxGeometry(0.7, 0.8, 0.5).translate(0.6, 0.6, s * 1.75), "hips", Z.dark);
  if (bottom === "skirt") {
    const y0 = 10.6 * k;
    b.tube([0, 0.33, 0.66, 1].map((t, i) => ({ c: V(0, y0 - t * 4.4, 0), rs: lerp(1.95, 2.55, t) * g, rf: lerp(1.25, 2.05, t) * g, w: i === 0 ? [["hips", 1]] as [string, number][] : [["hips", 1 - t * 0.6], ["upLegL", t * 0.3], ["upLegR", t * 0.3]] as [string, number][], zone: () => (top === "dress" ? Z.top : Z.bottom), v: t })), SIDE, FRONT, nn, [false, false]);
  }
  for (const [s, S] of [[-1, "L"], [1, "R"]] as const) {
    if (L.shoes === "sandal") continue; // bare feet with straps (the foot itself)
    const an = P(`foot${S}`);
    const sh = (x: number, h: number, w: number, bone: [string, number][], yb = 0) => ({ c: an.clone().add(V(x, -0.62 + h / 2 + yb, 0)), rs: w, rf: h / 2, w: bone, zone: (phi: number) => (Math.sin(phi) < -0.75 ? Z.sole : Z.shoes), v: x });
    const fw: [string, number][] = [[`foot${S}`, 1]], tw: [string, number][] = [[`toe${S}`, 1]], mw: [string, number][] = [[`foot${S}`, 0.5], [`toe${S}`, 0.5]];
    const sz = 1.12;
    b.tube([sh(-0.52, 0.8, 0.36 * sz, fw), sh(-0.32, 1.05, 0.43 * sz, fw), sh(0.25, 1.05, 0.46 * sz, fw, 0.05), sh(0.95, 0.8, 0.5 * sz, fw), sh(1.45, 0.66, 0.5 * sz, mw), sh(1.98, 0.54, 0.46 * sz, tw), sh(2.25, 0.4, 0.36 * sz, tw)], FRONT.clone().negate().cross(V(0, 1, 0)).normalize().negate(), V(0, 1, 0), 10, [true, true]);
    void s;
  }
  if (top === "swat") {
    const rings = [10.3, 11.4, 12.6, 13.8, 14.6].map((y, i) => ({ c: V(0.05, y, 0), rs: [1.9, 1.85, 2.1, 2.3, 1.95][i] * g, rf: [1.4, 1.35, 1.6, 1.6, 1.3][i] * g, w: torsoW(y, f), zone: () => Z.vest, v: i / 4, sq: 3 }));
    b.tube(rings, SIDE, FRONT, 12, [false, false]);
  }
  if (L.beard === 2) b.geo(new THREE.SphereGeometry(1.0, 14, 8, -Math.PI * 0.5, Math.PI, Math.PI * 0.55, Math.PI * 0.4).scale(1.08, 1.2, 0.86).translate(0.14, 0.83, 0), "head", Z.hair);
  // hats and helmets from the old shapes (a little bigger); curls, long hair and the ponytail add their extra parts
  if (HAIR_THICK[L.hair] === undefined) { if (L.hair !== "bald") hair(b, L, P("head"), V(0.12, 0.85, 0), 1.07); }
  else if (L.hair === "curls" || L.hair === "long" || L.hair === "ponytail") hair(b, L, P("head"), V(0.12, 0.85, 0), 1.07, true);
  const geo = b.build();
  // the body keeps the normals of the model (smoother than recomputed ones)
  const N = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = start; i < bodyEnd; i++) N.setXYZ(i, nrmOut[(i - start) * 3], nrmOut[(i - start) * 3 + 1], nrmOut[(i - start) * 3 + 2]);
  return geo;
}

// spine weights by height (smooth blends between the vertebrae)
function torsoW(y: number, f: boolean): [string, number][] {
  const k = f ? 0.94 : 1, ys = [9.5 * k, 10.6 * k, 12.1 * k, 13.7 * k, 15.25 * k], names = ["hips", "spine", "spine1", "spine2", "neck"];
  if (y <= ys[0]) return [["hips", 1]];
  for (let i = 0; i < ys.length - 1; i++) if (y <= ys[i + 1]) { const t = (y - ys[i]) / (ys[i + 1] - ys[i]); return [[names[i], 1 - t], [names[i + 1], t]]; }
  return [["neck", 1]];
}

function head(b: Builder, L: Look, hc: THREE.Vector3, detail: 0 | 1) {
  const f = L.sex === "f";
  const rows = detail === 0 ? 22 : 11, cols = detail === 0 ? 28 : 14;
  const c0 = V(0.12, 0.85, 0); // centre of the skull above the head bone
  const start = b.pos.length / 3;
  const shape = (th: number, ph: number) => {
    // th: 0 top .. π bottom, ph: around (0 right side, π/2 front)
    const y = Math.cos(th), r = Math.sin(th);
    let x = r * Math.sin(ph), z = r * Math.cos(ph);
    const low = sstep(0.1, -0.9, y); // lower face: narrower jaw, chin forward
    z *= 1 - low * (f ? 0.32 : 0.26);
    x *= 1 - low * 0.12;
    if (x > 0) x *= 1 + low * 0.1;
    return V(x * 1.02, y * 1.2 - (y < 0 ? low * 0.12 : 0), z * (f ? 0.8 : 0.83)).add(c0);
  };
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
    const th = (i / rows) * Math.PI, ph = (j / cols) * Math.PI * 2, p = shape(th, ph);
    const front = Math.sin(ph), y = p.y - c0.y;
    let z: number = Z.skin;
    if ((L.stubble || (L.beard ?? 0) >= 1) && y < -0.25 && front > 0.25) z = Z.stubble;
    b.vert(p.add(hc), y < -0.85 ? [["head", 0.8], ["neck", 0.2]] : [["head", 1]], z, 0.97, 0.5);
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = start + i * (cols + 1) + j, c = a + cols + 1;
    b.idx.push(a, c, a + 1, a + 1, c, c + 1);
  }
  const H = (g: THREE.BufferGeometry, zone: number, bone = "head") => b.geo(g, bone, zone);
  // eyes (white and iris on the eye bones: blinking squashes them), brows, nose, lips, ears
  for (const S of ["L", "R"]) {
    H(new THREE.SphereGeometry(0.15, 10, 8).scale(0.6, 0.6, 0.95), Z.white, `eye${S}`);
    H(new THREE.SphereGeometry(0.07, 8, 6).scale(0.5, 1, 1).translate(0.075, 0, 0), Z.dark, `eye${S}`);
    const s = S === "L" ? -1 : 1;
    H(new THREE.BoxGeometry(0.12, 0.07, 0.36).rotateX(s * (f ? 0.18 : 0.08)).translate(1.05, 1.15, s * 0.33), Z.hair);
    H(new THREE.SphereGeometry(0.28, 8, 6).scale(0.45, 1, 0.3).translate(0.12 + c0.x - 0.12, 0.9, s * 0.86), Z.skin);
  }
  H(new THREE.ConeGeometry(0.16, 0.55, 4).rotateZ(-1.35).rotateX(Math.PI / 4).scale(1, 1, 0.9).translate(1.08 + c0.x - 0.12, 0.62, 0), Z.skin);
  H(new THREE.SphereGeometry(0.2, 8, 4).scale(0.35, 0.28, 1.2).translate(0.68, 0.65, 0), Z.lips, "jaw");
  if (L.beard === 2) {
    // full beard: a shell around the chin and the jaw line
    b.geo(new THREE.SphereGeometry(1.0, 14, 8, -Math.PI * 0.5, Math.PI, Math.PI * 0.55, Math.PI * 0.4).scale(1.06, 1.22, 0.86).translate(c0.x + 0.02, c0.y - 0.02, 0), "head", Z.hair);
  }
  hair(b, L, hc, c0);
}

function hair(b: Builder, L: Look, hc: THREE.Vector3, c0: THREE.Vector3, big = 1, extrasOnly = false) {
  const G = (g: THREE.BufferGeometry, zone: number, w?: [string, number][]) => b.geo(g.scale(big, big, big).translate(c0.x, c0.y, c0.z), "head", zone, w);
  const cap = (sc: number, down: number, zone: number) => extrasOnly ? undefined : G(new THREE.SphereGeometry(1.0, 16, 10, 0, Math.PI * 2, 0, Math.PI * down).rotateZ(0.5).scale(1.07 * sc, 1.24 * sc, 0.88 * sc).translate(-0.05, 0.02, 0), zone); // rim high on the forehead, low at the nape
  void hc;
  switch (L.hair) {
    case "bald": break;
    case "buzz": cap(1.0, 0.5, Z.hair); break;
    case "short": cap(1.04, 0.55, Z.hair); break;
    case "curls": cap(1.06, 0.55, Z.hair); for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, y = 0.55 + (i % 3) * 0.2; G(new THREE.SphereGeometry(0.3, 6, 4).translate(Math.sin(a) * 0.95 - 0.1, y + 0.1, Math.cos(a) * 0.8), Z.hair); } break;
    case "long":
      cap(1.05, 0.55, Z.hair);
      G(new THREE.CylinderGeometry(0.95, 1.05, 2.6, 12, 1, true, Math.PI * 0.85, Math.PI * 1.3).scale(1, 1, 0.9).translate(-0.12, -0.7, 0), Z.hair, [["head", 0.7], ["neck", 0.3]]);
      break;
    case "ponytail":
      cap(1.04, 0.55, Z.hair);
      G(new THREE.CapsuleGeometry(0.22, 1.5, 3, 6).rotateZ(-0.35).translate(-1.15, -0.3, 0), Z.hair, [["head", 0.8], ["neck", 0.2]]);
      break;
    case "beanie": cap(1.08, 0.5, Z.hat); G(new THREE.TorusGeometry(0.98, 0.12, 6, 18).rotateX(Math.PI / 2).scale(1.07, 1, 0.9).translate(-0.05, 0.08, 0), Z.hat); break;
    case "cap": cap(1.06, 0.48, Z.hat); G(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 12, 1, false, 0, Math.PI).scale(1.2, 1, 0.95).translate(0.75, 0.32, 0), Z.hat); break;
    case "policecap":
      G(new THREE.CylinderGeometry(1.12, 0.98, 0.75, 14).translate(-0.05, 0.85, 0), Z.hat); G(new THREE.CylinderGeometry(0.98, 0.98, 0.18, 14).translate(-0.05, 0.52, 0), Z.accent);
      G(new THREE.CylinderGeometry(0.75, 0.75, 0.05, 12, 1, false, 0, Math.PI).scale(1, 1, 1.1).translate(0.72, 0.45, 0), Z.dark); break;
    case "helmet": cap(1.16, 0.56, Z.hat); G(new THREE.BoxGeometry(0.3, 0.25, 1.9).translate(0.95, 0.25, 0), Z.dark); break;
  }
}

// ----------------------------------------------------------------------------------------------- material
// one material per person: the palette (colour per zone) and the clothing pattern are uniforms
const noiseTex = (() => {
  // fabric folds as a normal map (vertical creases); the right edge stays flat (skin uses it)
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d")!;
  x.fillStyle = "rgb(128,128,255)"; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) {
    const px = Math.random() * 110, w = 2 + Math.random() * 5;
    const gr = x.createLinearGradient(px - w, 0, px + w, 0);
    gr.addColorStop(0, "rgb(128,128,255)"); gr.addColorStop(0.35, "rgb(90,128,240)"); gr.addColorStop(0.65, "rgb(166,128,240)"); gr.addColorStop(1, "rgb(128,128,255)");
    x.fillStyle = gr; x.globalAlpha = 0.5 + Math.random() * 0.5; x.fillRect(px - w, Math.random() * 64, w * 2, 30 + Math.random() * 90);
  }
  x.globalAlpha = 1; x.fillStyle = "rgb(128,128,255)"; x.fillRect(118, 0, 10, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})();

export function personMaterial(): THREE.MeshStandardMaterial & { userData: { pal: THREE.Color[]; pattern: { value: number }; tattoo: { value: number }; cloth: { value: THREE.Vector4 }; style: { value: THREE.Vector4 }; head: { value: THREE.Vector4 }; ownCompile: THREE.Material["onBeforeCompile"] } } {
  const pal = Array.from({ length: ZONES }, () => new THREE.Color(1, 1, 1));
  const pattern = { value: 0 }, tattoo = { value: 0 };
  // modelled bodies: where the clothes end is decided per pixel (straight hems): sleeve, trousers, neck line, size factor; top / bottom kind, boots, sandals
  const cloth = { value: new THREE.Vector4(1, 1, 15.35, 1) }, style = { value: new THREE.Vector4(0, 0, 0, 0) };
  const headU = { value: new THREE.Vector4(0, 17, 0, 1) }; // centre of the skull, hair: 0 none, 1 short, 2 long
  const m = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0, normalMap: noiseTex, normalScale: new THREE.Vector2(0.6, 0.6) });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPal = { value: pal }; sh.uniforms.uPattern = pattern; sh.uniforms.uTattoo = tattoo; sh.uniforms.uCloth = cloth; sh.uniforms.uStyle = style; sh.uniforms.uHead = headU;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float zone; attribute float zparam; flat varying float vZone; varying float vZp; varying vec2 vPuv; varying vec3 vBind;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvZone = zone; vZp = zparam; vPuv = uv; vBind = position;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
uniform vec3 uPal[${ZONES}]; uniform float uPattern; uniform float uTattoo; uniform vec4 uCloth; uniform vec4 uStyle; uniform vec4 uHead; flat varying float vZone; varying float vZp; varying vec2 vPuv; varying vec3 vBind;
float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
float n21(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
int zi = int(vZone + 0.5);
// modelled body: 20 torso, 21 arm, 22 leg, 23 foot -> the clothing zone at this pixel
if (zi >= 20) {
  vec3 q = vBind; float phi = atan(q.x, q.z), frontD = abs(phi - 1.5708), k = uCloth.w;
  int top = int(uStyle.x + 0.5), bot = int(uStyle.y + 0.5);
  if (zi == 20) {
    float y = q.y;
    if (y > uCloth.z + 0.05 && length(q.xz) < 0.95) zi = top == 3 ? 1 : 0;   // the neck (a hoodie covers it)
    else if (y > uCloth.z - 0.4 && length(q.xz) < 0.95) zi = (top == 1 || top == 2) ? 0 : (top == 3 ? 1 : 2);
    else if (y < 10.2 * k) {
      if (bot == 1) zi = top == 2 ? 1 : 3;
      else if (abs(y - 10.15 * k) < 0.22 && top != 2 && top != 3 && top != 7) zi = 6;
      else zi = 3;
    } else {
      zi = 1;
      if ((top == 4 || top == 5) && y > 10.6) { float w = 0.12 + (y - 10.6) * 0.09; if (frontD < w) zi = (top == 5 && frontD < 0.07 && y > 11.2) ? 9 : 2; }
      if (top == 6 && y > 13.0 && y < 13.6 && phi > 1.0 && phi < 1.3) zi = 9;
      if (top == 7 && abs(cos(phi)) > 0.97) zi = 9;
      if (top == 1 && y > 13.6 && abs(cos(phi)) > 0.75) zi = 0;
    }
  } else if (zi == 21) zi = vZp < uCloth.x ? 1 : 14;
  else if (zi == 22) zi = (uStyle.z > 0.5 && vZp > 0.85) ? 4 : (vZp < uCloth.y ? ((bot == 2 && abs(cos(phi)) > 0.95) ? 9 : 3) : 0);
  else if (zi == 23) zi = uStyle.w > 0.5 ? 0 : 4;
  else {
    // head: hair above the hair line (high on the forehead, above the ears, low at the nape)
    vec3 d = q - uHead.xyz; float ang = atan(d.z, d.x), back = (1.0 - cos(ang)) * 0.5, sk = sin(ang) * sin(ang);
    float line = 0.42 - 0.97 * back + 0.3 * sk - (uHead.w > 1.5 ? 0.25 * back : 0.0);
    zi = (uHead.w > 0.5 && d.y > line) ? 5 : 0;
  }
}
vec3 zc = uPal[0];
for (int k = 0; k < ${ZONES}; k++) if (k == zi) zc = uPal[k];
// patterns: 1 flowers on the shirt (Hawaii), 2 camouflage on shirt and trousers
if (uPattern > 0.5 && uPattern < 1.5 && zi == 1) { vec2 q = vPuv * vec2(9.0, 7.0); float d = length(fract(q) - 0.5); float pet = 0.5 + 0.5 * sin(atan(fract(q).y - 0.5, fract(q).x - 0.5) * 5.0); zc = mix(zc, vec3(1.0, 0.92, 0.55), step(d, 0.18 + 0.12 * pet) * step(0.5, h21(floor(q)))); zc = mix(zc, vec3(0.1, 0.45, 0.25), step(0.75, n21(q * 1.7)) * 0.7); }
if (uPattern > 1.5 && (zi == 1 || zi == 3)) { float c = n21(vPuv * vec2(10.0, 8.0)) + 0.5 * n21(vPuv * vec2(23.0, 19.0)); zc *= c > 1.0 ? 0.55 : c > 0.7 ? 0.8 : c < 0.45 ? 1.25 : 1.0; }
// tattoos on the bare arms (ink drawn from the rest-pose position on the skin)
if (zi == 14 && uTattoo > 0.5) {
  float ink = 0.0; vec3 q = vBind;
  if (uTattoo < 1.5) ink = step(0.75, sin(q.y * 9.0 + sin(q.x * 8.0 + q.z * 6.0) * 2.0)) * step(10.5, q.y);
  else if (uTattoo < 2.5) ink = step(0.82, sin(q.y * 6.0 + sin(atan(q.x, q.z) * 3.0) * 1.5)) * step(9.5, q.y) * step(q.y, 13.5);
  else if (uTattoo < 3.5) { vec2 g = fract(vec2(atan(q.x, abs(q.z) - 2.0) * 1.6, q.y * 1.4)) - 0.5; ink = step(length(g), 0.18) * step(10.0, q.y); }
  else if (uTattoo < 4.5) ink = step(0.86, sin(q.y * 4.0 + sin(atan(q.x, q.z) * 2.0 + q.y * 1.3) * 2.4)) * step(9.0, q.y); // vines
  else if (uTattoo < 5.5) ink = step(0.7, sin(q.y * 14.0)) * step(10.5, q.y) * step(q.y, 12.5); // bands
  else { vec2 g = fract(vec2(atan(q.x, abs(q.z) - 2.0) * 3.0 + floor(q.y * 3.0) * 0.5, q.y * 3.0)) - 0.5; ink = step(0.3, length(g)) * step(length(g), 0.45) * step(9.5, q.y); } // scales
  zc = mix(zc, vec3(0.08, 0.1, 0.16), ink * 0.85);
}
diffuseColor.rgb *= zc;`)
      .replace("#include <normal_fragment_maps>", "if (zi == 1 || zi == 2 || zi == 3 || zi == 10 || zi == 12) {\n#include <normal_fragment_maps>\n}")
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
if (zi == 0 || zi == 8 || zi == 11) roughnessFactor = 0.55; if (zi == 7) roughnessFactor = 0.2; if (zi == 4 || zi == 13) roughnessFactor = 0.45;`);
  };
  m.customProgramCacheKey = () => "person-v3";
  m.userData = { pal, pattern, tattoo, cloth, style, head: headU, ownCompile: m.onBeforeCompile };
  return m as ReturnType<typeof personMaterial>;
}
export function paintPerson(m: ReturnType<typeof personMaterial>, L: Look) {
  const p = m.userData.pal;
  const skin = new THREE.Color(L.skin);
  p[Z.skin].copy(skin); p[Z.top].set(L.topCol); p[Z.top2].set(L.top2Col); p[Z.bottom].set(L.bottomCol); p[Z.shoes].set(L.shoeCol); p[Z.hair].set(L.hairCol);
  p[Z.dark].set("#141416"); p[Z.white].set("#f2f2ee"); p[Z.lips].copy(skin).multiplyScalar(0.78).lerp(new THREE.Color("#b0625a"), 0.25); p[Z.accent].set(L.accent); p[Z.hat].set(L.hatCol);
  p[Z.stubble].copy(skin).lerp(new THREE.Color(L.hairCol), 0.35); p[Z.vest].set(L.top === "army" ? "#4a5236" : "#2a2d33"); p[Z.sole].set(L.shoes === "leather" ? "#1b1410" : "#d8d8d8");
  if (L.shoes === "boot" || L.shoes === "leather") p[Z.sole].set("#121212");
  m.userData.pattern.value = L.top === "hawaii" ? 1 : L.top === "army" ? 2 : 0;
  m.userData.tattoo.value = L.tattoo ?? 0;
  const t = L.top, f = L.sex === "f";
  const longSleeve = ["shirt", "suit", "hoodie", "leather", "jacket", "track", "swat", "army", "bomber"].includes(t);
  m.userData.cloth.value.set(t === "tank" || t === "dress" ? 0 : longSleeve ? 1.02 : t === "police" ? 0.42 : 0.36, L.bottom === "shorts" ? 0.42 : L.bottom === "skirt" ? 0 : 1.02, f ? 14.5 : 15.35, f ? 0.94 : 1);
  const topCode = t === "tank" ? 1 : t === "dress" ? 2 : t === "hoodie" ? 3 : t === "suit" ? 5 : t === "leather" || t === "jacket" || t === "bomber" ? 4 : t === "police" ? 6 : t === "track" ? 7 : 0;
  const hc = headCentre(L.sex);
  m.userData.head.value.set(hc.x, hc.y, hc.z, L.hair === "bald" ? 0 : L.hair === "long" || L.hair === "ponytail" ? 2 : 1);
  m.userData.style.value.set(topCode, L.bottom === "skirt" ? 1 : L.bottom === "track" ? 2 : 0, L.shoes === "boot" ? 1 : 0, L.shoes === "sandal" ? 1 : 0);
  p[Z.arm].copy(skin);
}

// geometry cache: same body and clothes cut = same geometry (colours are in the material);
// counted references, unused bodies are freed once there are many (people come and go all the time)
const geoCache = new Map<string, { g: THREE.BufferGeometry; refs: number }>();
const KEEP = 60;
function bodyKey(L: Look, detail: number) { return [L.sex, (Math.round(L.build * 10) / 10).toFixed(1), L.top, L.bottom, L.shoes, L.hair, L.stubble ? 1 : 0, L.beard ?? 0, detail, BODY_GEN].join(); }
export function bodyGeo(L: Look, detail: 0 | 1) {
  const k = bodyKey(L, detail);
  let e = geoCache.get(k);
  if (!e) { e = { g: buildBody({ ...L, build: Math.round(L.build * 10) / 10 }, detail), refs: 0 }; geoCache.set(k, e); }
  e.refs++;
  return e.g;
}
function releaseBody(k: string) {
  const e = geoCache.get(k);
  if (e) e.refs = Math.max(0, e.refs - 1);
  if (geoCache.size <= KEEP) return;
  for (const [key, v] of geoCache) if (v.refs === 0) { v.g.dispose(); geoCache.delete(key); if (geoCache.size <= KEEP) break; }
}
const vestCache = new Map<string, THREE.BufferGeometry>();
function vestGeo(L: Look) { const k = L.sex + L.build.toFixed(1); let g = vestCache.get(k); if (!g) { g = buildBody(L, 1, true); vestCache.set(k, g); } return g; }

// ----------------------------------------------------------------------------------------------- animations
// a pose: euler angles (x, y, z) per bone, relative to the rest pose; drop: how far the body sinks (root y)
type Pose = Record<string, [number, number, number]> & { _drop?: [number, number, number]; _turn?: [number, number, number] };
// limbs with the sign of the side applied: fw swings forward, ab moves away from the body, tw twists
const arm = (S: "L" | "R", fw: number, ab = 0, elbow = 0, tw = 0, hand = 0): Pose => {
  const s = S === "R" ? 1 : -1;
  return { [`upperArm${S}`]: [-s * ab, s * tw, fw], [`foreArm${S}`]: [0, 0, elbow], [`hand${S}`]: [0, 0, hand] } as Pose;
};
const leg = (S: "L" | "R", fw: number, knee = 0, foot = 0, ab = 0): Pose => {
  const s = S === "R" ? 1 : -1;
  return { [`upLeg${S}`]: [-s * ab, 0, fw], [`leg${S}`]: [0, 0, -knee], [`foot${S}`]: [0, 0, foot] } as Pose;
};
const fist = (S: "L" | "R", k: number): Pose => {
  const o: Pose = {} as Pose;
  for (const n of ["index", "middle", "ring", "pinky"]) { o[`${n}1${S}`] = [0, 0, 1.3 * k]; o[`${n}2${S}`] = [0, 0, 1.4 * k]; o[`${n}3${S}`] = [0, 0, 0.9 * k]; }
  o[`thumb1${S}`] = [0, 0, 0.4 * k]; o[`thumb2${S}`] = [0, 0, 0.6 * k];
  return o;
};
const P = (...ps: Pose[]): Pose => Object.assign({}, ...ps);
const spine = (fw: number, tw = 0, side = 0): Pose => ({ spine: [side * 0.3, tw * 0.3, -fw * 0.3], spine1: [side * 0.35, tw * 0.35, -fw * 0.35], spine2: [side * 0.35, tw * 0.35, -fw * 0.35] } as Pose);
const headP = (nod: number, yaw = 0, tilt = 0): Pose => ({ neck: [tilt * 0.4, yaw * 0.4, -nod * 0.4], head: [tilt * 0.6, yaw * 0.6, -nod * 0.6] } as Pose);
const drop = (y: number, x = 0): Pose => ({ _drop: [x, -y, 0] } as Pose);
const turn = (x: number, y: number, z: number): Pose => ({ _turn: [x, y, z] } as Pose); // whole body (hips) rotation

const relaxed = P(arm("L", 0.05, 0.05, 0.18), arm("R", 0.05, 0.05, 0.18), fist("L", 0.25), fist("R", 0.25));
function walkKeys(st: number, arms: number, lean: number, knee: number, bob: number, elbow: number, armsUp = false): [number, Pose][] {
  // one step cycle: contact L (0), passing (0.25), contact R (0.5), passing (0.75)
  const A = (k: number): Pose => armsUp ? P(arm("L", 2.5 + k * 0.25, 0.3, 0.7), arm("R", 2.5 - k * 0.25, 0.3, 0.7)) : P(arm("L", -k * arms, 0.08, elbow + Math.max(0, -k) * 0.3), arm("R", k * arms, 0.08, elbow + Math.max(0, k) * 0.3));
  const base = P(spine(lean), headP(-lean * 0.6), fist("L", 0.35), fist("R", 0.35));
  return [
    [0, P(base, A(1), leg("L", st, 0.05, 0.15), leg("R", -st * 0.75, knee * 0.35, -0.1), drop(bob), { hips: [0, 0.07, 0] } as Pose, { spine2: [0, -0.1, -lean * 0.35] } as Pose)],
    [0.25, P(base, A(0), leg("L", 0, 0.1), leg("R", st * 0.2, knee, -0.1), drop(0), { hips: [0.03, 0, 0] } as Pose)],
    [0.5, P(base, A(-1), leg("R", st, 0.05, 0.15), leg("L", -st * 0.75, knee * 0.35, -0.1), drop(bob), { hips: [0, -0.07, 0] } as Pose, { spine2: [0, 0.1, -lean * 0.35] } as Pose)],
    [0.75, P(base, A(0), leg("R", 0, 0.1), leg("L", st * 0.2, knee, -0.1), drop(0), { hips: [-0.03, 0, 0] } as Pose)],
    [1, P(base, A(1), leg("L", st, 0.05, 0.15), leg("R", -st * 0.75, knee * 0.35, -0.1), drop(bob), { hips: [0, 0.07, 0] } as Pose, { spine2: [0, -0.1, -lean * 0.35] } as Pose)],
  ];
}
const sit = (thigh: number, knee: number, dropY: number) => P(leg("L", thigh, knee, 0.2, 0.08), leg("R", thigh, knee, 0.2, 0.08), drop(dropY));
const swimArm = (S: "L" | "R", a: number) => arm(S, a, 0.15, 0.4);

interface ClipDef { dur: number; keys: [number, Pose][]; }
const CLIPS: Record<string, ClipDef> = {
  idle: { dur: 3, keys: [[0, P(relaxed, spine(0.02))], [1.5, P(relaxed, spine(0.05), { hips: [0.02, 0, 0] } as Pose, headP(0.05, 0.1))], [3, P(relaxed, spine(0.02))]] },
  walk: { dur: 1.05, keys: walkKeys(0.42, 0.38, 0.04, 0.75, 0.25, 0.25).map(([t, p]) => [t * 1.05, p]) },
  run: { dur: 0.72, keys: walkKeys(0.75, 0.75, 0.2, 1.7, 0.6, 1.35).map(([t, p]) => [t * 0.72, p]) },
  sprint: { dur: 0.56, keys: walkKeys(0.95, 1.0, 0.35, 2.0, 0.8, 1.5).map(([t, p]) => [t * 0.56, p]) },
  panic: { dur: 0.7, keys: walkKeys(0.75, 0, 0.12, 1.6, 0.6, 0, true).map(([t, p]) => [t * 0.7, p]) },
  jump: { dur: 0.5, keys: [[0, P(relaxed, sit(0.5, 0.9, 1.5), spine(0.2))], [0.2, P(arm("L", 0.6, 0.3, 0.5), arm("R", 0.6, 0.3, 0.5), leg("L", 0.7, 1.2), leg("R", 0.2, 0.6), spine(0.1))], [0.5, P(arm("L", 0.3, 0.6, 0.6), arm("R", 0.3, 0.6, 0.6), leg("L", 0.5, 0.9), leg("R", 0.1, 0.5))]] },
  fall: { dur: 0.8, keys: [[0, P(arm("L", 1.2, 1.2, 0.5), arm("R", 0.8, 1.0, 0.4), leg("L", 0.4, 0.8), leg("R", -0.2, 0.5), spine(-0.1))], [0.4, P(arm("L", 0.8, 1.0, 0.4), arm("R", 1.3, 1.3, 0.6), leg("L", -0.2, 0.5), leg("R", 0.5, 0.9), spine(-0.15))], [0.8, P(arm("L", 1.2, 1.2, 0.5), arm("R", 0.8, 1.0, 0.4), leg("L", 0.4, 0.8), leg("R", -0.2, 0.5), spine(-0.1))]] },
  // swimming: the body lies flat (turn), crawl strokes
  swim: { dur: 1.4, keys: [0, 0.35, 0.7, 1.05, 1.4].map((t, i) => [t, P(turn(0, 0, -1.35), drop(-2, -2), headP(-0.6, i % 2 ? 0.5 : -0.3), swimArm("L", [0, 1.6, 3.14, 4.7, 6.28][i]), swimArm("R", [3.14, 4.7, 6.28, 7.85, 9.42][i]), leg("L", [0.2, -0.2, 0.2, -0.2, 0.2][i], 0.2, -0.6), leg("R", [-0.2, 0.2, -0.2, 0.2, -0.2][i], 0.2, -0.6))] as [number, Pose]) },
  tread: { dur: 1.6, keys: [0, 0.8, 1.6].map((t, i) => [t, P(drop(0.5), arm("L", 0.4, 0.6 + (i % 2) * 0.4, 0.5), arm("R", 0.4, 0.6 + (i % 2) * 0.4, 0.5), leg("L", 0.5 - (i % 2) * 0.5, 0.8), leg("R", (i % 2) * 0.5, 0.8 - (i % 2) * 0.4))] as [number, Pose]) },
  drive: { dur: 2, keys: [[0, P(sit(1.45, 1.25, 0), spine(-0.12), arm("L", 1.05, -0.1, 0.55, 0, -0.2), arm("R", 1.05, -0.1, 0.55, 0, -0.2), fist("L", 0.8), fist("R", 0.8))], [2, P(sit(1.45, 1.25, 0), spine(-0.12), arm("L", 1.05, -0.1, 0.55, 0, -0.2), arm("R", 1.05, -0.1, 0.55, 0, -0.2), fist("L", 0.8), fist("R", 0.8))]] },
  ride: { dur: 2, keys: [[0, P(sit(1.05, 1.4, 0), leg("L", 1.05, 1.4, 0.3, 0.35), leg("R", 1.05, 1.4, 0.3, 0.35), spine(0.45), headP(-0.4), arm("L", 1.2, 0.1, 0.5), arm("R", 1.2, 0.1, 0.5), fist("L", 0.8), fist("R", 0.8))], [2, P(sit(1.05, 1.4, 0), leg("L", 1.05, 1.4, 0.3, 0.35), leg("R", 1.05, 1.4, 0.3, 0.35), spine(0.45), headP(-0.4), arm("L", 1.2, 0.1, 0.5), arm("R", 1.2, 0.1, 0.5), fist("L", 0.8), fist("R", 0.8))]] },
  bench: { dur: 4, keys: [[0, P(sit(1.5, 1.5, 4.2), spine(-0.08), arm("L", 0.5, 0.1, 0.9), arm("R", 0.5, 0.1, 0.9))], [2, P(sit(1.5, 1.5, 4.2), spine(-0.04), arm("L", 0.5, 0.1, 0.9), arm("R", 0.55, 0.1, 1.0), headP(0, 0.3))], [4, P(sit(1.5, 1.5, 4.2), spine(-0.08), arm("L", 0.5, 0.1, 0.9), arm("R", 0.5, 0.1, 0.9))]] },
  aimPistol: { dur: 1, keys: [[0, P(arm("R", 1.52, 0.05, 0.02, 0, 0), arm("L", 1.35, -0.35, 0.35), fist("R", 0.7), fist("L", 0.6), spine(0.04, 0.25), headP(0, -0.2))], [1, P(arm("R", 1.52, 0.05, 0.02, 0, 0), arm("L", 1.35, -0.35, 0.35), fist("R", 0.7), fist("L", 0.6), spine(0.04, 0.25), headP(0, -0.2))]] },
  aimRifle: { dur: 1, keys: [[0, P(arm("R", 0.75, 0.55, 1.6, 0, 0.2), arm("L", 1.35, -0.4, 0.4), fist("R", 0.7), fist("L", 0.5), spine(0.08, 0.35), headP(0.1, -0.3))], [1, P(arm("R", 0.75, 0.55, 1.6, 0, 0.2), arm("L", 1.35, -0.4, 0.4), fist("R", 0.7), fist("L", 0.5), spine(0.08, 0.35), headP(0.1, -0.3))]] },
  reload: { dur: 1.1, keys: [[0, P(arm("R", 0.9, 0, 0.6), arm("L", 0.8, -0.3, 0.8), spine(0.1))], [0.5, P(arm("R", 0.8, 0, 0.8), arm("L", 0.3, 0, 0.6), spine(0.15), headP(0.3))], [0.8, P(arm("R", 0.9, 0, 0.6), arm("L", 0.9, -0.4, 0.9), spine(0.12), headP(0.25))], [1.1, P(arm("R", 1.2, 0, 0.3), arm("L", 1.1, -0.3, 0.4), spine(0.05))]] },
  throw: { dur: 0.7, keys: [[0, P(relaxed, spine(0, 0.2))], [0.3, P(arm("R", -0.6, 0.7, 1.6), arm("L", 1.0, 0.2, 0.3), spine(-0.1, -0.5), leg("L", 0.3, 0.2), leg("R", -0.3, 0.3))], [0.5, P(arm("R", 2.2, 0.2, 0.2), arm("L", 0.2, 0.2, 0.4), spine(0.25, 0.5), leg("L", 0.3, 0.2), leg("R", -0.3, 0.3))], [0.7, P(relaxed, spine(0.05, 0.1))]] },
  punch: { dur: 0.42, keys: [[0, P(arm("R", 0.6, 0.1, 2.0), arm("L", 0.7, 0.1, 2.0), fist("R", 1), fist("L", 1), spine(0.05, -0.2))], [0.16, P(arm("R", 1.55, -0.05, 0.1), arm("L", 0.6, 0.1, 2.0), fist("R", 1), fist("L", 1), spine(0.15, 0.4))], [0.42, P(arm("R", 0.6, 0.1, 2.0), arm("L", 0.7, 0.1, 2.0), fist("R", 1), fist("L", 1), spine(0.05, -0.2))]] },
  bat: { dur: 0.6, keys: [[0, P(arm("R", 1.6, 0.9, 1.8), arm("L", 1.4, -0.5, 1.6), fist("R", 1), fist("L", 1), spine(0, -0.6))], [0.25, P(arm("R", 1.35, -0.2, 0.2), arm("L", 1.3, -0.6, 0.3), fist("R", 1), fist("L", 1), spine(0.15, 0.6))], [0.6, P(arm("R", 0.6, 0.1, 0.8), arm("L", 0.6, -0.3, 0.8), fist("R", 1), fist("L", 1), spine(0.05, 0.2))]] },
  hit: { dur: 0.35, keys: [[0, P(relaxed)], [0.1, P(relaxed, spine(-0.3, 0.2), headP(-0.4, 0.3), arm("L", 0.4, 0.5, 0.6), arm("R", 0.3, 0.6, 0.6))], [0.35, P(relaxed)]] },
  // knocked over: the whole body falls on its back and lies there
  fallBack: { dur: 0.6, keys: [[0, P(relaxed)], [0.25, P(turn(0, 0, 0.7), drop(3, -1), arm("L", 1.2, 1.0, 0.4), arm("R", 1.0, 1.2, 0.4), leg("L", 0.4, 0.5), leg("R", 0.1, 0.3))], [0.6, P(turn(0, 0, 1.52), drop(8.5, -1), arm("L", 0.6, 0.9, 0.3), arm("R", 0.3, 1.1, 0.2), leg("L", 0.15, 0.3), leg("R", -0.05, 0.1), headP(0.2))]] },
  lying: { dur: 2, keys: [[0, P(turn(0, 0, 1.52), drop(8.5, -1), arm("L", 0.6, 0.9, 0.3), arm("R", 0.3, 1.1, 0.2), leg("L", 0.15, 0.3), leg("R", -0.05, 0.1), headP(0.2))], [2, P(turn(0, 0, 1.52), drop(8.5, -1), arm("L", 0.6, 0.9, 0.3), arm("R", 0.3, 1.1, 0.2), leg("L", 0.15, 0.3), leg("R", -0.05, 0.1), headP(0.2))]] },
  getup: { dur: 1.1, keys: [[0, P(turn(0, 0, 1.52), drop(8.5, -1), arm("L", 0.6, 0.9, 0.3), arm("R", 0.3, 1.1, 0.2), leg("L", 0.15, 0.3), leg("R", -0.05, 0.1))], [0.45, P(turn(0, 0, 0.3), drop(6, 0), sit(1.9, 2.4, 0), spine(0.9), arm("L", 0.6, 0.3, 0.6), arm("R", 0.6, 0.3, 0.6))], [0.8, P(drop(3), sit(1.2, 1.8, 0), spine(0.6), arm("L", 0.3, 0.2, 0.4), arm("R", 0.3, 0.2, 0.4))], [1.1, P(relaxed)]] },
  // thrown about by a car or an explosion (physics moves the body, the limbs flail)
  ragdoll: { dur: 0.5, keys: [[0, P(turn(0.3, 0, 0.9), drop(5, -1), arm("L", 2.2, 1.4, 0.8), arm("R", 1.4, 1.5, 0.3), leg("L", 0.8, 1.2), leg("R", -0.3, 0.4), spine(-0.3), headP(-0.4))], [0.25, P(turn(-0.3, 0, 1.2), drop(6, -1), arm("L", 1.2, 1.6, 0.3), arm("R", 2.4, 1.2, 0.9), leg("L", -0.2, 0.5), leg("R", 0.9, 1.3), spine(-0.4), headP(-0.3))], [0.5, P(turn(0.3, 0, 0.9), drop(5, -1), arm("L", 2.2, 1.4, 0.8), arm("R", 1.4, 1.5, 0.3), leg("L", 0.8, 1.2), leg("R", -0.3, 0.4), spine(-0.3), headP(-0.4))]] },
  cower: { dur: 1.2, keys: [[0, P(sit(1.6, 2.3, 4.6), spine(0.75), headP(0.5), arm("L", 2.0, 0.3, 2.1), arm("R", 2.0, 0.3, 2.1))], [0.6, P(sit(1.6, 2.3, 4.7), spine(0.8), headP(0.55), arm("L", 2.05, 0.32, 2.15), arm("R", 2.0, 0.28, 2.1))], [1.2, P(sit(1.6, 2.3, 4.6), spine(0.75), headP(0.5), arm("L", 2.0, 0.3, 2.1), arm("R", 2.0, 0.3, 2.1))]] },
  crouch: { dur: 2, keys: [[0, P(sit(1.6, 2.3, 4.6), spine(0.5), arm("L", 0.9, 0.1, 1.0), arm("R", 0.9, 0.1, 1.0))], [2, P(sit(1.6, 2.3, 4.6), spine(0.5), headP(0, 0.4), arm("L", 0.9, 0.1, 1.0), arm("R", 0.9, 0.1, 1.0))]] },
  phone: { dur: 3, keys: [[0, P(relaxed, arm("R", 0.35, 0.35, 2.35, 0.3, 0.3), fist("R", 0.6), headP(0.05, 0, 0.15))], [1.5, P(relaxed, arm("R", 0.35, 0.38, 2.35, 0.3, 0.3), fist("R", 0.6), headP(0.1, 0.2, 0.15), arm("L", 0.15, 0.25, 0.6))], [3, P(relaxed, arm("R", 0.35, 0.35, 2.35, 0.3, 0.3), fist("R", 0.6), headP(0.05, 0, 0.15))]] },
  smoke: { dur: 4, keys: [[0, P(relaxed, arm("R", 0.2, 0.15, 1.2, 0, 0.3))], [1.2, P(relaxed, arm("R", 0.5, 0.1, 2.45, 0.3, 0.2), headP(-0.1))], [1.8, P(relaxed, arm("R", 0.5, 0.1, 2.45, 0.3, 0.2), headP(-0.1))], [2.6, P(relaxed, arm("R", 0.2, 0.15, 1.2, 0, 0.3), headP(-0.15))], [4, P(relaxed, arm("R", 0.2, 0.15, 1.2, 0, 0.3))]] },
  talk: { dur: 3, keys: [[0, P(relaxed, arm("R", 0.5, 0.2, 1.2, 0.3))], [0.7, P(relaxed, arm("R", 0.7, 0.35, 1.0, 0.5), headP(0.1, 0.1))], [1.4, P(relaxed, arm("L", 0.6, 0.3, 1.1, 0.4), arm("R", 0.3, 0.2, 0.9), headP(-0.05, -0.1))], [2.2, P(relaxed, arm("R", 0.55, 0.25, 1.3, 0.3), headP(0.12))], [3, P(relaxed, arm("R", 0.5, 0.2, 1.2, 0.3))]] },
  // fly mode: body stretched forward, one fist ahead; hovering upright with the arms out and the legs dangling
  fly: { dur: 1.6, keys: [0, 0.8, 1.6].map((t, i) => [t, P(turn(0, 0, -1.2), headP(-0.75), arm("R", 2.95, 0.12, 0.08), fist("R", 0.9), arm("L", -0.15, 0.2 + (i % 2) * 0.06, 0.15), fist("L", 0.4), leg("L", -0.05 + (i % 2) * 0.05, 0.12), leg("R", 0.05 - (i % 2) * 0.05, 0.18), spine(-0.12))] as [number, Pose]) },
  hover: { dur: 2, keys: [0, 1, 2].map((t, i) => [t, P(drop((i % 2) * -0.6), arm("L", 0.3, 0.75 + (i % 2) * 0.1, 0.25), arm("R", 0.3, 0.75 + (i % 2) * 0.1, 0.25), fist("L", 0.3), fist("R", 0.3), leg("L", 0.12 + (i % 2) * 0.08, 0.3), leg("R", -0.05, 0.22 + (i % 2) * 0.1, 0.4), spine(-0.04), headP(0.05))] as [number, Pose]) },
  handsUp: { dur: 1.2, keys: [[0, P(arm("L", 2.6, 0.45, 0.6, 0, -0.3), arm("R", 2.6, 0.45, 0.6, 0, -0.3), spine(-0.08), headP(-0.1))], [0.6, P(arm("L", 2.65, 0.5, 0.55, 0, -0.3), arm("R", 2.55, 0.42, 0.65, 0, -0.3), spine(-0.1), headP(-0.05, 0.15))], [1.2, P(arm("L", 2.6, 0.45, 0.6, 0, -0.3), arm("R", 2.6, 0.45, 0.6, 0, -0.3), spine(-0.08), headP(-0.1))]] },
  lookAround: { dur: 3.2, keys: [[0, P(relaxed, headP(0, 0.8))], [1.2, P(relaxed, headP(0.05, -0.8), spine(0, -0.2))], [2.2, P(relaxed, headP(-0.1, 0.2))], [3.2, P(relaxed, headP(0, 0.8))]] },
  // getting into a car (stands at the driver's door, the car is on the right of the person)
  openDoor: { dur: 0.6, keys: [[0, P(relaxed)], [0.25, P(relaxed, arm("R", 0.9, 0.5, 0.7, 0.2), spine(0.1, 0.3))], [0.6, P(relaxed, arm("R", 0.8, -0.2, 0.9, 0.2), spine(0.05, -0.1), leg("R", 0.2, 0.3))]] },
  getIn: { dur: 0.6, keys: [[0, P(relaxed, spine(0.1))], [0.3, P(spine(0.5, 0.4), sit(0.9, 1.0, 1.5), arm("L", 0.6, 0.3, 0.6), arm("R", 0.8, 0.2, 0.5))], [0.6, P(sit(1.45, 1.25, 4), spine(-0.1), arm("L", 1.0, 0, 0.6), arm("R", 1.0, 0, 0.6))]] },
  smash: { dur: 0.8, keys: [[0, P(relaxed)], [0.3, P(arm("R", 1.4, -0.3, 2.3, 0.2), fist("R", 1), spine(0, -0.6), leg("L", 0.2, 0.2))], [0.45, P(arm("R", 1.0, 0.9, 1.9, 0.2), fist("R", 1), spine(0.15, 0.6), leg("L", 0.2, 0.2))], [0.8, P(relaxed, arm("R", 0.8, 0.5, 1.2))]] },
  buttStrike: { dur: 0.8, keys: [[0, P(arm("R", 0.75, 0.55, 1.6), arm("L", 1.35, -0.4, 0.4))], [0.3, P(arm("R", 1.3, 0.2, 2.2), arm("L", 1.6, -0.2, 0.6), spine(-0.05, -0.5))], [0.45, P(arm("R", 1.0, 1.0, 1.4), arm("L", 1.3, 0.5, 0.5), spine(0.15, 0.6))], [0.8, P(relaxed)]] },
  pull: { dur: 0.9, keys: [[0, P(relaxed)], [0.3, P(arm("R", 1.3, 0.7, 0.4), arm("L", 1.3, 0.4, 0.4), fist("R", 1), fist("L", 1), spine(0.3, 0.5))], [0.65, P(arm("R", 0.8, -0.3, 1.4), arm("L", 0.7, -0.4, 1.4), fist("R", 1), fist("L", 1), spine(-0.15, -0.4), leg("L", -0.3, 0.3), leg("R", 0.3, 0.4))], [0.9, P(relaxed)]] },
  getOut: { dur: 0.7, keys: [[0, P(sit(1.45, 1.25, 4), spine(-0.1), arm("L", 1.0, 0, 0.6), arm("R", 1.0, 0, 0.6))], [0.35, P(spine(0.45, -0.3), sit(0.9, 1.0, 1.5), arm("L", 0.6, 0.3, 0.6), arm("R", 0.5, 0.3, 0.6))], [0.7, P(relaxed)]] },
  // rolling out of a moving car: tuck and one forward roll
  roll: { dur: 0.9, keys: [0, 0.2, 0.4, 0.6, 0.9].map((t, i) => [t, P(turn(0, 0, [0, -1.6, -3.14, -4.7, -6.28][i]), drop([0, 6, 7.5, 6, 0][i], [0, 1, 1.5, 1, 0][i]), sit(i && i < 4 ? 2.0 : 0.3, i && i < 4 ? 2.3 : 0.3, 0), spine(i && i < 4 ? 0.9 : 0.1), arm("L", 1.5, 0.4, 1.6), arm("R", 1.5, 0.4, 1.6), headP(0.7))] as [number, Pose]) },
  climb: { dur: 0.8, keys: [[0, P(relaxed)], [0.3, P(arm("L", 2.2, 0.2, 0.4), arm("R", 2.2, 0.2, 0.4), leg("R", 1.5, 1.8), spine(0.3), drop(-2))], [0.6, P(arm("L", 0.8, 0.3, 0.2), arm("R", 0.8, 0.3, 0.2), leg("L", 1.2, 1.6), leg("R", 0.3, 0.3), spine(0.4), drop(-4))], [0.8, P(relaxed)]] },
};
const DEFAULT_LOOP = new Set(["fly", "hover", "handsUp", "idle", "walk", "run", "sprint", "panic", "fall", "swim", "tread", "drive", "ride", "bench", "aimPistol", "aimRifle", "lying", "ragdoll", "cower", "crouch", "phone", "smoke", "talk", "lookAround"]);
export type Anim = keyof typeof CLIPS;

const clipCache = new Map<string, THREE.AnimationClip>();
// part: "" whole body, "lo" hips and legs only, "up" everything above the hips (for an upper body layer)
const LOWER = /^(hips|upLeg|leg|foot|toe)/;
function clip(name: string, defs: BoneDef[], part: "" | "lo" | "up" = ""): THREE.AnimationClip {
  const hipsY = defs.find((x) => x[0] === "hips")![3], ck = name + ":" + hipsY + part;
  let c = clipCache.get(ck);
  if (c) return c;
  const d = CLIPS[name];
  const bones = new Set<string>();
  for (const [, p] of d.keys) for (const k of Object.keys(p)) if (!k.startsWith("_")) bones.add(k);
  const tracks: THREE.KeyframeTrack[] = [];
  const times = d.keys.map((k) => k[0]);
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const b of bones) {
    const vals: number[] = [];
    for (const [, p] of d.keys) {
      const r = p[b] ?? [0, 0, 0];
      e.set(r[0], r[1], r[2], "ZXY"); q.setFromEuler(e);
      if (b === "hips" && p._turn) q.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(p._turn[0], p._turn[1], p._turn[2], "ZXY")));
      vals.push(q.x, q.y, q.z, q.w);
    }
    // keep the shortest way between keys (long turns are split into quarter steps in the clip data)
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, vals));
  }
  if (!bones.has("hips") && d.keys.some((k) => k[1]._turn)) {
    const vals: number[] = [];
    for (const [, p] of d.keys) { const t = p._turn ?? [0, 0, 0]; q.setFromEuler(e.set(t[0], t[1], t[2], "ZXY")); vals.push(q.x, q.y, q.z, q.w); }
    tracks.push(new THREE.QuaternionKeyframeTrack("hips.quaternion", times, vals));
  }
  // the body sinks (sitting, crouching, lying): hips position relative to the rest height
  tracks.push(new THREE.VectorKeyframeTrack("hips.position", times, d.keys.flatMap(([, p]) => { const dr = p._drop ?? [0, 0, 0]; return [dr[0], hipsY + dr[1], dr[2]]; })));
  const keep = part === "" ? tracks : tracks.filter((t) => LOWER.test(t.name) === (part === "lo"));
  c = new THREE.AnimationClip(name + part, d.dur, keep);
  clipCache.set(ck, c);
  return c;
}

// ----------------------------------------------------------------------------------------------- one person
export class HumanRig {
  root = new THREE.Group();          // placed in the world (position, heading = rotation.y)
  mesh: THREE.SkinnedMesh;
  vest: THREE.SkinnedMesh | null = null;
  skeleton: THREE.Skeleton;
  bones = new Map<string, THREE.Bone>();
  mixer: THREE.AnimationMixer;
  mat: ReturnType<typeof personMaterial>;
  private actions = new Map<string, THREE.AnimationAction>();
  current = ""; private blinkT = 2 + Math.random() * 3;
  lookYaw = 0; lookPitch = 0;        // extra head turn on top of the animation (radians)
  eyeYaw = 0;
  look: Look; private defs: BoneDef[]; private key = "";
  constructor(look: Look, detail: 0 | 1, castShadow = true) {
    this.look = look;
    this.defs = skeletonDefs(look.sex);
    const list: THREE.Bone[] = [];
    for (const [n, par, x, y, z] of this.defs) {
      const b = new THREE.Bone(); b.name = n; b.position.set(x, y, z);
      if (par) this.bones.get(par)!.add(b);
      this.bones.set(n, b); list.push(b);
    }
    list[0].updateMatrixWorld(true); // the inverse bind matrices come from the rest pose
    this.skeleton = new THREE.Skeleton(list);
    this.mat = personMaterial();
    paintPerson(this.mat, look);
    this.mesh = new THREE.SkinnedMesh(bodyGeo(look, detail), this.mat);
    this.mesh.add(list[0]);
    this.mesh.bind(this.skeleton);
    this.mesh.castShadow = castShadow; this.mesh.frustumCulled = false;
    this.root.add(this.mesh);
    this.root.scale.setScalar(look.height * PERSON_SCALE);
    this.mixer = new THREE.AnimationMixer(this.mesh);
    this.key = bodyKey(look, detail);
    this.play("idle", 0);
  }
  // new clothes / another person on the same rig (same sex): only geometry and colours change
  setLook(look: Look, detail: 0 | 1) {
    if (look.sex !== this.look.sex) return false;
    this.look = look;
    const k = bodyKey(look, detail);
    if (k !== this.key) { const old = this.key; this.key = k; this.mesh.geometry = bodyGeo(look, detail); releaseBody(old); }
    paintPerson(this.mat, look);
    this.root.scale.setScalar(look.height * PERSON_SCALE);
    if (this.vest) { this.vest.geometry = vestGeo(look); }
    return true;
  }
  setVest(on: boolean) {
    if (on && !this.vest) {
      const m = new THREE.SkinnedMesh(vestGeo(this.look), this.mat);
      m.bind(this.skeleton, this.mesh.bindMatrix); m.castShadow = true; m.frustumCulled = false;
      this.mesh.add(m); this.vest = m;
    }
    if (this.vest) this.vest.visible = on;
  }
  bone(n: string) { return this.bones.get(n)!; }
  private action(name: string, part: "" | "lo" | "up") {
    const k = name + part;
    let a = this.actions.get(k);
    if (!a) {
      a = this.mixer.clipAction(clip(name, this.defs, part));
      if (!DEFAULT_LOOP.has(name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions.set(k, a);
    }
    return a;
  }
  // body animation (whole body, or only hips and legs while an upper body animation runs)
  upper = "";
  private active = new Set<THREE.AnimationAction>();
  private apply(fade: number, keepTime: number, restartUp: boolean, speed: number, upSpeed: number) {
    const want = new Set<THREE.AnimationAction>();
    const part = this.upper ? "lo" : "";
    const base = this.action(this.current === "loco" ? "walk" : this.current, part);
    if (this.current === "loco") {
      // walking, running and sprinting play together; update() sets their weights and their common phase
      for (const n of this.gaits()) { const a = this.action(n, part); want.add(a); }
      this.locoFade = this.active.size ? 0 : 1; this.locoFadeT = Math.max(0.01, fade);
    } else { base.timeScale = speed; want.add(base); }
    let up: THREE.AnimationAction | null = null;
    if (this.upper) { up = this.action(this.upper, "up"); up.timeScale = upSpeed; want.add(up); }
    for (const a of this.active) if (!want.has(a)) { if (fade > 0) a.fadeOut(fade); else a.stop(); }
    for (const a of want) {
      if (!this.active.has(a) || (a === up && restartUp)) {
        a.reset(); if (a === base && keepTime >= 0) a.time = keepTime;
        a.enabled = true; a.setEffectiveWeight(1); a.play();
        if (this.current === "loco" && a !== up) a.setEffectiveWeight(0); else if (fade > 0) a.fadeIn(fade);
      }
    }
    this.active = want;
  }
  // switch the body animation with a crossfade (0.15–0.3 s); restart plays a one-shot again
  play(name: Anim | string, fade = 0.2, speed = 1, restart = false) {
    if (this.current === name && !restart) { if (name !== "loco") this.action(name, this.upper ? "lo" : "").timeScale = speed; return; }
    this.current = name;
    this.apply(fade, -1, false, speed, 1);
  }
  // an animation for the arms and the upper body on top of the legs ("" ends it)
  playUpper(name: Anim | string, fade = 0.15, speed = 1, restart = false) {
    if (this.upper === name && !restart) return;
    const was = this.action(this.current === "loco" ? "walk" : this.current, this.upper ? "lo" : "");
    this.upper = name;
    this.apply(fade, was.time, restart, was.timeScale, speed);
  }
  // a one-shot is over (or not playing)
  done(name: string) {
    const a = this.actions.get(name + (this.upper === name ? "up" : this.upper ? "lo" : ""));
    if (!a || (this.current !== name && this.upper !== name)) return true;
    return !a.isRunning() && a.time >= a.getClip().duration - 1e-3;
  }
  // ---- moving on foot: walk / run / sprint blended by speed, the step rate follows the speed (no sliding feet)
  private locoSpeed = 0; private locoPhase = 0; private locoFade = 1; private locoFadeT = 0.2; private panic = false;
  private gaits() { return ["walk", this.panic ? "panic" : "run", "sprint"]; }
  // speed in world units per second (0: stand); panic: run with raised arms
  move(speed: number, panic = false, fade = 0.25) {
    if (speed < 6) { this.play("idle", fade); return; }
    if (panic !== this.panic && this.current === "loco") { this.panic = panic; this.current = ""; }
    this.panic = panic;
    this.locoSpeed = speed;
    this.play("loco", fade);
  }
  private updateLoco(dt: number) {
    const v = this.locoSpeed, k = this.root.scale.x || 1; // bigger people take longer steps
    const ramp = (a: number, b: number) => Math.max(0, Math.min(1, (v - a) / (b - a)));
    const toRun = ramp(45, 80), toSprint = ramp(175, 215);
    const w = [1 - toRun, toRun * (1 - toSprint), toSprint];
    const len = [14, 24, 30].map((l) => l * k); // distance of one full step cycle (two steps)
    const L = w[0] * len[0] + w[1] * len[1] + w[2] * len[2];
    this.locoPhase = (this.locoPhase + (v * dt) / L) % 1;
    this.locoFade = Math.min(1, this.locoFade + dt / this.locoFadeT);
    const part = this.upper ? "lo" : "";
    this.gaits().forEach((n, i) => {
      const a = this.action(n, part);
      a.timeScale = 0; a.time = this.locoPhase * a.getClip().duration;
      a.setEffectiveWeight(w[i] * this.locoFade);
    });
  }
  update(dt: number) {
    // head and neck back to rest first: the extra look turn must not add up when no clip moves them
    this.bone("head").quaternion.identity(); this.bone("neck").quaternion.identity();
    if (this.current === "loco") this.updateLoco(dt);
    this.mixer.update(dt);
    // head and eyes on top of the animation, blinking
    if (this.lookYaw || this.lookPitch) {
      const h = this.bone("head");
      h.quaternion.multiply(_q.setFromEuler(_e.set(0, this.lookYaw * 0.7, -this.lookPitch, "ZXY")));
      this.bone("neck").quaternion.multiply(_q.setFromEuler(_e.set(0, this.lookYaw * 0.3, 0, "ZXY")));
    }
    this.blinkT -= dt;
    const shut = this.blinkT < 0.12;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 4;
    for (const S of ["eyeL", "eyeR"]) { const e = this.bone(S); e.scale.y = shut ? 0.12 : 1; e.rotation.set(0, this.eyeYaw, 0); }
  }
  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.mesh); this.mat.dispose(); this.skeleton.dispose(); releaseBody(this.key); this.key = ""; }
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler();

// ----------------------------------------------------------------------------------------------- the player
export interface OutfitLook { top: Top; topCol: string; top2Col: string; bottom: Bottom; bottomCol: string; shoes: Shoes; shoeCol: string; accent?: string; hair?: Hair; hatCol?: string; }
// Kai Romero: mid thirties, short dark hair, stubble
// style: hair, beard and tattoo from the barber (a hat of the outfit wins over the hair style)
export function kaiLook(o: OutfitLook, style?: { hair: Hair; beard: number; tattoo: number }): Look {
  const hat = o.hair === "cap" || o.hair === "beanie" || o.hair === "helmet" || o.hair === "policecap";
  const beard = style?.beard ?? 1;
  return { sex: "m", height: 1.02, build: 1.05, age: 1, skin: "#c99572", hairCol: "#1e1510", stubble: beard === 1, beard, tattoo: style?.tattoo ?? 0, accent: o.accent ?? "#c0392b", hatCol: o.hatCol ?? "#1b1b1f", ...o, hair: hat ? o.hair! : style?.hair ?? o.hair ?? "short" };
}

// weapons in the right hand: grip in the palm, barrel along the fingers (local -y)
export function weaponGeo(kind: string): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  const B = (w: number, h: number, d: number, x: number, y: number, z: number) => parts.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  const Cy = (r: number, l: number, x: number, y: number, z: number, r2 = r) => parts.push(new THREE.CylinderGeometry(r, r2, l, 10).translate(x, y, z));
  switch (kind) {
    case "pistol": B(0.35, 2.0, 0.3, 0.45, -1.1, 0); B(0.3, 0.9, 0.28, 0.05, -0.4, 0); break;
    case "revolver": B(0.32, 2.3, 0.28, 0.45, -1.25, 0); Cy(0.32, 0.6, 0.45, -0.75, 0); B(0.3, 0.9, 0.28, 0.05, -0.4, 0); break;
    case "knife": B(0.25, 0.9, 0.3, 0.05, -0.35, 0); B(0.06, 1.8, 0.32, 0.05, -1.7, 0); break;
    case "rifle": B(0.45, 5.2, 0.38, 0.45, -2.2, 0); B(0.3, 1.0, 0.3, 0.05, -0.45, 0); B(0.32, 1.1, 0.3, 0.8, -1.6, 0); B(0.45, 1.6, 0.4, 0.4, 1.0, 0); Cy(0.1, 1.4, 0.5, -5.4, 0); break;
    case "sniper": B(0.4, 6.2, 0.34, 0.45, -2.6, 0); B(0.3, 1.0, 0.3, 0.05, -0.45, 0); B(0.5, 1.8, 0.4, 0.35, 1.1, 0); Cy(0.09, 2.4, 0.5, -6.6, 0); Cy(0.22, 2.2, 0.95, -2.0, 0); break;
    case "smg": B(0.5, 3.0, 0.4, 0.45, -1.4, 0); B(0.3, 1.0, 0.3, 0.05, -0.45, 0); B(0.3, 0.9, 0.3, 0.75, -1.2, 0); break;
    case "shotgun": Cy(0.22, 6.5, 0.5, -3.2, 0); B(0.5, 2.6, 0.45, 0.35, 0.6, 0); break;
    case "rocket": Cy(0.7, 9, 1.0, -2.2, 0); Cy(0.9, 1.2, 1.0, -6.9, 0, 0.7); B(0.4, 1.0, 0.4, 0.2, -0.3, 0); break;
    case "bat": Cy(0.22, 8.5, 0, -3.5, 0, 0.42); break;
    case "grenade": parts.push(new THREE.SphereGeometry(0.4, 8, 6).translate(0.2, -0.6, 0)); break;
    case "bomb": parts.push(new THREE.SphereGeometry(0.45, 8, 6).translate(0.2, -0.6, 0)); break;
    case "phone": B(0.12, 0.85, 0.42, 0.2, -0.5, 0); break;
    default: return null;
  }
  const g = parts.length > 1 ? mergeGeos(parts) : parts[0];
  return g;
}
function mergeGeos(list: THREE.BufferGeometry[]) {
  const pos: number[] = [], nrm: number[] = [];
  for (const g of list) { const n = g.index ? g.toNonIndexed() : g; pos.push(...(n.attributes.position.array as Float32Array)); nrm.push(...(n.attributes.normal.array as Float32Array)); g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  return out;
}
