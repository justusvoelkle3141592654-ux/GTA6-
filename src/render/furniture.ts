// furniture for the walkable rooms: beds, sofas, kitchens, bathrooms, shelves with books, plants, lamps, bars, ...
// every piece is built from vertex-coloured parts in local coordinates (x across the front, z towards the front, y up),
// then turned and moved into the room; floor, wall, window and picture textures are drawn on canvases
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mulberry32 } from "../world/world";

export interface FurnSpec { k: string; x: number; y: number; w: number; d: number; a?: number; z?: number; c?: string; c2?: string; }
// ---------------------------------------------------------------- geometry helpers (vertex coloured, non-indexed so they merge)
const colCache = new Map<string, THREE.Color>();
const C = (hex: string) => { let c = colCache.get(hex); if (!c) { c = new THREE.Color(hex); colCache.set(hex, c); } return c; };
function paint(g: THREE.BufferGeometry, col: string | THREE.Color, mul = 1) {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo !== g) g.dispose();
  const c = typeof col === "string" ? C(col) : col, n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r * mul; a[i * 3 + 1] = c.g * mul; a[i * 3 + 2] = c.b * mul; }
  geo.setAttribute("color", new THREE.BufferAttribute(a, 3));
  if (geo.attributes.uv) geo.deleteAttribute("uv");
  return geo;
}
const B = (w: number, h: number, d: number, x: number, y: number, z: number, col: string | THREE.Color, mul = 1) => paint(new THREE.BoxGeometry(Math.max(0.05, w), Math.max(0.05, h), Math.max(0.05, d)).translate(x, y, z), col, mul);
const RB = (w: number, h: number, d: number, x: number, y: number, z: number, col: string | THREE.Color, rad = 1) =>
  paint(new RoundedBoxGeometry(w, h, d, 2, Math.max(0.05, Math.min(rad, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01))).translate(x, y, z), col);
const CY = (rt: number, rb: number, h: number, x: number, y: number, z: number, col: string | THREE.Color, seg = 14) => paint(new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y, z), col);
const CYX = (r: number, len: number, x: number, y: number, z: number, col: string | THREE.Color, seg = 14) => paint(new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2).translate(x, y, z), col);
const CYZ = (r: number, len: number, x: number, y: number, z: number, col: string | THREE.Color, seg = 14) => paint(new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2).translate(x, y, z), col);
const SP = (r: number, x: number, y: number, z: number, col: string | THREE.Color, sx = 1, sy = 1, sz = 1, seg = 10) => paint(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)).scale(sx, sy, sz).translate(x, y, z), col);
const lighten = (hex: string, k: number) => C(hex).clone().lerp(new THREE.Color(1, 1, 1), k);
const darken = (hex: string, k: number) => C(hex).clone().multiplyScalar(1 - k);

// ---------------------------------------------------------------- textures
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const shade = (hex: string, k: number) => { const c = C(hex).clone().multiplyScalar(k); return `rgb(${Math.min(255, c.r * 255) | 0},${Math.min(255, c.g * 255) | 0},${Math.min(255, c.b * 255) | 0})`; };

export function floorTex(style: string, col: string) {
  const r = mulberry32(7 + style.length * 31);
  return canvasTex(256, 256, (g) => {
    g.fillStyle = col; g.fillRect(0, 0, 256, 256);
    switch (style) {
      case "wood": case "darkwood": case "planks": {
        const rows = style === "planks" ? 6 : 8, rh = 256 / rows;
        for (let j = 0; j < rows; j++) {
          let x = -r() * 120;
          while (x < 256) {
            const len = 90 + r() * 110;
            g.fillStyle = shade(col, 0.82 + r() * 0.3); g.fillRect(x, j * rh, len, rh);
            g.strokeStyle = shade(col, 0.7); g.lineWidth = 1;
            for (let k = 0; k < 5; k++) { const yy = j * rh + 3 + r() * (rh - 6); g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + len * 0.3, yy + r() * 4 - 2, x + len * 0.6, yy + r() * 4 - 2, x + len, yy); g.globalAlpha = 0.35; g.stroke(); g.globalAlpha = 1; }
            g.fillStyle = shade(col, 0.45); g.fillRect(x, j * rh, 2, rh);
            x += len;
          }
          g.fillStyle = shade(col, 0.45); g.fillRect(0, j * rh, 256, 2);
        }
        break;
      }
      case "parquet": {
        for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
          const x = i * 32, y = j * 32, vert = (i + j) % 2 === 0;
          for (let k = 0; k < 4; k++) { g.fillStyle = shade(col, 0.8 + r() * 0.35); if (vert) g.fillRect(x + k * 8, y, 8, 32); else g.fillRect(x, y + k * 8, 32, 8); }
          g.strokeStyle = shade(col, 0.5); g.strokeRect(x, y, 32, 32);
        }
        break;
      }
      case "tile": case "lino": {
        const n = style === "tile" ? 4 : 2, s = 256 / n;
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { g.fillStyle = shade(col, 0.92 + r() * 0.12); g.fillRect(i * s, j * s, s, s); }
        if (style === "lino") for (let k = 0; k < 900; k++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.12)"; g.fillRect(r() * 256, r() * 256, 2, 2); }
        g.strokeStyle = shade(col, style === "tile" ? 0.6 : 0.85); g.lineWidth = style === "tile" ? 3 : 1;
        for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 256); g.moveTo(0, i * s); g.lineTo(256, i * s); g.stroke(); }
        break;
      }
      case "marble": {
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { g.fillStyle = shade(col, 0.95 + r() * 0.08); g.fillRect(i * 128, j * 128, 128, 128); }
        g.strokeStyle = "rgba(120,110,100,0.35)"; g.lineWidth = 1.2;
        for (let k = 0; k < 14; k++) { g.beginPath(); let x = r() * 256, y = r() * 256; g.moveTo(x, y); for (let q = 0; q < 6; q++) { x += r() * 60 - 20; y += r() * 60 - 30; g.lineTo(x, y); } g.stroke(); }
        g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = 1; g.strokeRect(0, 0, 128, 128); g.strokeRect(128, 128, 128, 128); g.strokeRect(128, 0, 128, 128); g.strokeRect(0, 128, 128, 128);
        break;
      }
      case "checker": {
        const s = 32;
        for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { g.fillStyle = (i + j) % 2 ? "#1d1d22" : col; g.fillRect(i * s, j * s, s, s); }
        break;
      }
      case "carpet": case "concrete": case "terrazzo": {
        const id = g.getImageData(0, 0, 256, 256), c = C(col);
        for (let i = 0; i < id.data.length; i += 4) { const v = (style === "carpet" ? 0.85 : 0.9) + r() * (style === "carpet" ? 0.3 : 0.15); id.data[i] = c.r * 255 * v; id.data[i + 1] = c.g * 255 * v; id.data[i + 2] = c.b * 255 * v; id.data[i + 3] = 255; }
        g.putImageData(id, 0, 0);
        if (style === "concrete") { for (let k = 0; k < 6; k++) { g.fillStyle = "rgba(30,25,20,0.12)"; g.beginPath(); g.ellipse(r() * 256, r() * 256, 10 + r() * 30, 6 + r() * 16, r() * 3, 0, 7); g.fill(); } g.strokeStyle = "rgba(0,0,0,0.2)"; g.strokeRect(0, 0, 256, 256); }
        if (style === "terrazzo") for (let k = 0; k < 500; k++) { g.fillStyle = ["#c9a070", "#8a9098", "#e8e4dc", "#a04a3a", "#5a6a7a"][Math.floor(r() * 5)]; g.beginPath(); g.ellipse(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 2, r() * 3, 0, 7); g.fill(); }
        break;
      }
      case "tatami": {
        for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) {
          const x = i * 64, y = j * 128;
          g.fillStyle = shade(col, 0.95 + r() * 0.08); g.fillRect(x, y, 64, 128);
          g.strokeStyle = shade(col, 0.8); for (let k = 0; k < 64; k += 3) { g.beginPath(); g.moveTo(x, y + k * 2); g.lineTo(x + 64, y + k * 2); g.stroke(); }
          g.fillStyle = "#3a5a3a"; g.fillRect(x, y, 4, 128); g.fillRect(x + 60, y, 4, 128);
        }
        break;
      }
    }
  });
}

export function wallTex(style: string, col: string) {
  const r = mulberry32(99 + style.length);
  return canvasTex(256, 256, (g) => {
    g.fillStyle = col; g.fillRect(0, 0, 256, 256);
    if (style === "brick") {
      const bh = 16, bw = 48;
      for (let j = 0; j < 256 / bh; j++) for (let i = -1; i < 256 / bw + 1; i++) {
        const x = i * bw + (j % 2 ? bw / 2 : 0), y = j * bh;
        g.fillStyle = shade(col, 0.82 + r() * 0.3); g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      }
      g.fillStyle = shade(col, 0.55);
      for (let j = 0; j <= 256 / bh; j++) g.fillRect(0, j * bh - 1, 256, 2);
    } else if (style === "wood") {
      for (let i = 0; i < 8; i++) { g.fillStyle = shade(col, 0.85 + r() * 0.25); g.fillRect(i * 32, 0, 32, 256); g.fillStyle = shade(col, 0.55); g.fillRect(i * 32, 0, 2, 256); }
    } else if (style === "tile") {
      for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { g.fillStyle = shade(col, 0.94 + r() * 0.1); g.fillRect(i * 16 + 1, j * 16 + 1, 14, 14); }
    } else if (style === "stripe") {
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? shade(col, 0.88) : col; g.fillRect(i * 16, 0, 16, 256); }
    } else if (style === "concrete") {
      for (let k = 0; k < 2000; k++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"; g.fillRect(r() * 256, r() * 256, 2, 2); }
    } else {
      for (let k = 0; k < 1500; k++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)"; g.fillRect(r() * 256, r() * 256, 3, 3); }
    }
  });
}

// the view out of the windows: sky, sea and the skyline of Solara Bay
let windowTexCache: THREE.Texture | null = null;
export function windowTex() {
  if (windowTexCache) return windowTexCache;
  const r = mulberry32(4242);
  windowTexCache = canvasTex(512, 128, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, "#6a98d4"); gr.addColorStop(0.65, "#e6d6bb"); gr.addColorStop(1, "#c9bba5");
    g.fillStyle = gr; g.fillRect(0, 0, 512, 128);
    g.fillStyle = "#2a6a8a"; g.fillRect(0, 100, 512, 28);
    for (let x = 0; x < 512;) {
      const w = 14 + r() * 30, h = 20 + r() * 60;
      g.fillStyle = `rgb(${90 + r() * 40},${95 + r() * 40},${110 + r() * 40})`; g.fillRect(x, 104 - h, w, h);
      g.fillStyle = "rgba(255,240,200,0.55)";
      for (let yy = 104 - h + 4; yy < 100; yy += 6) for (let xx = x + 3; xx < x + w - 3; xx += 5) if (r() < 0.4) g.fillRect(xx, yy, 2, 3);
      x += w + r() * 10;
    }
  });
  return windowTexCache;
}

export function artTex(kind: string, col: string) {
  const r = mulberry32(kind.length * 17 + col.length);
  return canvasTex(128, 96, (g) => {
    g.fillStyle = "#f4efe6"; g.fillRect(0, 0, 128, 96);
    if (kind === "sun") { g.fillStyle = "#ffd9a0"; g.fillRect(0, 0, 128, 60); g.fillStyle = col; g.beginPath(); g.arc(64, 60, 26, Math.PI, 0); g.fill(); g.fillStyle = "#3a7a8a"; g.fillRect(0, 60, 128, 36); }
    else if (kind === "sea" || kind === "wave") { g.fillStyle = "#cfe6f0"; g.fillRect(0, 0, 128, 96); g.strokeStyle = col; g.lineWidth = 6; for (let k = 0; k < 4; k++) { g.beginPath(); for (let x = 0; x <= 128; x += 4) g.lineTo(x, 40 + k * 14 + Math.sin(x / 10 + k) * 6); g.stroke(); } }
    else if (kind === "target") { for (let k = 5; k > 0; k--) { g.fillStyle = k % 2 ? col : "#f4efe6"; g.beginPath(); g.arc(64, 48, k * 9, 0, 7); g.fill(); } }
    else if (kind === "pin") { g.fillStyle = "#2a2d33"; g.fillRect(0, 0, 128, 96); g.fillStyle = col; g.beginPath(); g.ellipse(64, 40, 18, 24, 0, 0, 7); g.fill(); g.fillRect(52, 60, 24, 30); g.fillStyle = "#fff"; g.font = "bold 16px sans-serif"; g.fillText("LOU'S", 40, 92); }
    else { for (let k = 0; k < 9; k++) { g.fillStyle = [col, "#ff3cac", "#ffd23f", "#2bf0ff", "#15161b"][Math.floor(r() * 5)]; if (r() < 0.5) g.fillRect(r() * 100, r() * 70, 20 + r() * 40, 14 + r() * 30); else { g.beginPath(); g.arc(r() * 128, r() * 96, 8 + r() * 20, 0, 7); g.fill(); } } }
  });
}
export function textTex(text: string, col: string, bg: string, w = 256, h = 64) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = col; g.textAlign = "center"; g.textBaseline = "middle";
    let fs = h * 0.7;
    do { g.font = `bold ${fs}px 'Bebas Neue', Impact, sans-serif`; fs -= 2; } while (fs > 10 && g.measureText(text).width > w * 0.9);
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

// ---------------------------------------------------------------- furniture
export interface Parts { std: THREE.BufferGeometry[]; glow: THREE.BufferGeometry[]; glass: THREE.BufferGeometry[]; }
const WOOD = "#6a4a32", DARK = "#22252c", METAL = "#9aa3ad", WHITE = "#f4f2ee";

// builds one piece in local coordinates (x across the front, z towards the front, y up), then turns and moves it
export function furniture(f: FurnSpec, out: Parts, seed: number, extra: THREE.Object3D[], H: number, baseY: number) {
  const r = mulberry32(seed);
  const s: THREE.BufferGeometry[] = [], gl: THREE.BufferGeometry[] = [], gs: THREE.BufferGeometry[] = [];
  const w = f.w, d = f.d, c = f.c || "#8a8a8a", hw = w / 2, hd = d / 2;
  const legs = (h: number, col: string | THREE.Color, inset = 1.5, th = 1.6) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.push(B(th, h, th, sx * (hw - inset), h / 2, sz * (hd - inset), col)); };
  const sofa = (ww: number, dd: number, x: number, z: number, col: string) => {
    const n = Math.max(1, Math.round(ww / 24)), sw = (ww - 10) / n;
    s.push(B(ww, 5, dd, x, 3, z, darken(col, 0.35)), B(ww, 10, 6, x, 11, z - dd / 2 + 3, col));
    for (let i = 0; i < n; i++) s.push(RB(sw - 0.8, 3.4, dd - 7, x - ww / 2 + 5 + sw * (i + 0.5), 7.2, z + 2.5, lighten(c, 0.08), 1.2), RB(sw - 1.5, 7, 3, x - ww / 2 + 5 + sw * (i + 0.5), 11, z - dd / 2 + 7, lighten(c, 0.04), 1.2));
    for (const sx of [-1, 1]) s.push(RB(5, 8.5, dd, x + sx * (ww / 2 - 2.5), 8, z, col, 1.5));
  };
  switch (f.k) {
    case "bed": case "waterbed": case "futon": {
      const low = f.k === "futon", y0 = low ? 0 : 4;
      if (!low) s.push(B(w, 5, d, 0, 3, 0, WOOD), B(w + 1, 18, 2.5, 0, 9, -hd + 1.2, darken(WOOD, 0.25)));
      s.push(RB(w - 2, 4.5, d - 3, 0, y0 + 4, 1, f.k === "waterbed" ? lighten(c, 0.2) : WHITE, 1.5));
      if (f.k !== "waterbed") s.push(RB(w - 1.4, 1.6, d * 0.62, 0, y0 + 6.6, hd * 0.36, c, 0.7), RB(w - 1.2, 2.2, 4, 0, y0 + 6.9, hd * 0.36 - d * 0.31, lighten(c, 0.35), 0.8));
      for (const sx of [-1, 1]) s.push(RB(w * 0.4, 2.8, 7, sx * w * 0.22, y0 + 7.5, -hd + 6.5, WHITE, 1.2));
      if (f.k === "waterbed") s.push(B(w + 2, 7, 2, 0, 4, hd, "#c9a227"), B(w + 2, 7, 2, 0, 4, -hd, "#c9a227"));
      break;
    }
    case "bunk": {
      for (const y of [4, 22]) { s.push(B(w, 2, d, 0, y, 0, c), RB(w - 2, 3, d - 2, 0, y + 2.5, 0, WHITE, 1), RB(w - 2, 1.2, d * 0.6, 0, y + 4.2, hd * 0.3, "#2b6dff", 0.5)); }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.push(B(2, 34, 2, sx * (hw - 1), 17, sz * (hd - 1), c));
      for (let k = 0; k < 4; k++) s.push(B(6, 1, 1, hw - 4, 8 + k * 5, hd + 0.6, METAL));
      break;
    }
    case "side": s.push(B(w, 10, d, 0, 5, 0, c), B(w - 2, 0.4, 0.4, 0, 6, hd + 0.1, DARK), CY(1.6, 2.2, 3, 0, 11.5, 0, "#d8d0c0")); gl.push(SP(2.2, 0, 14.5, 0, "#ffd9a0")); break;
    case "sofa": sofa(w, d, 0, 0, c); s.push(RB(7, 6, 2, -hw + 12, 11, -hd + 9, "#ffd23f", 1.5), RB(7, 6, 2, hw - 12, 11, -hd + 9, "#ff8ad1", 1.5)); break;
    case "sofaL": sofa(w, d * 0.55, 0, -hd + d * 0.275, c); s.push(B(26, 5, d * 0.5, -hw + 13, 3, hd - d * 0.25, darken(c, 0.35)), RB(25, 3.4, d * 0.5 - 1, -hw + 13, 7.2, hd - d * 0.25, lighten(c, 0.08), 1.2)); break;
    case "armchair": sofa(w, d, 0, 0, c); break;
    case "coffee": s.push(B(w, 2, d, 0, 8, 0, c), B(w - 4, 1, d - 4, 0, 3, 0, darken(c, 0.2))); legs(7, darken(c, 0.4)); s.push(B(6, 2.5, 4, w * 0.2, 10, 0, "#c9a227")); break;
    case "table": s.push(B(w, 2, d, 0, 12, 0, c)); legs(11, darken(c, 0.35)); break;
    case "rtable": s.push(CY(hw, hw, 2, 0, 12, 0, c, 22), CY(1.4, 1.4, 11, 0, 5.5, 0, DARK), CY(hw * 0.5, hw * 0.55, 1, 0, 0.5, 0, DARK, 16)); break;
    case "chair": s.push(B(w - 1, 1.5, d - 1, 0, 7, 0, c), B(w - 1, 9, 1.4, 0, 12.5, -hd + 1.2, c)); legs(6.5, DARK, 1.2, 1.1); break;
    case "stool": s.push(CY(hw, hw, 1.6, 0, 10, 0, c, 14), CY(0.8, 0.8, 9.5, 0, 5, 0, METAL, 8), CY(hw * 0.7, hw * 0.8, 0.8, 0, 0.4, 0, METAL, 12)); break;
    case "desk": s.push(B(w, 2, d, 0, 12, 0, c), B(2, 11, d - 2, -hw + 1, 5.5, 0, darken(c, 0.2)), B(w * 0.3, 11, d - 2, hw - w * 0.15, 5.5, 0, darken(c, 0.15)), B(w * 0.26, 0.4, 0.4, hw - w * 0.15, 8, hd - 0.8, METAL)); break;
    case "pc": {
      const mw = Math.min(w * 0.7, 22);
      s.push(B(2, 1, 2, 0, 0.5, -hd + 3, DARK), B(1, 5, 1, 0, 3, -hd + 3, DARK), B(mw, mw * 0.6, 1, 0, 5.5 + mw * 0.3, -hd + 3.6, "#111216"), B(mw * 0.8, 0.5, 4, 0, 0.3, hd - 3, DARK), B(2.5, 0.6, 3.5, mw * 0.55, 0.3, hd - 3, DARK));
      gl.push(B(mw - 1.4, mw * 0.6 - 1.4, 0.2, 0, 5.5 + mw * 0.3, -hd + 4.15, "#4ab0ff", 1.4));
      break;
    }
    case "counter": case "stove": case "sink": case "island": {
      const top = f.k === "island" ? "#e8e4dc" : "#d8d4cc";
      s.push(B(w, 14, d - 1, 0, 7, -0.5, c), B(w + 0.4, 1.4, d + 0.4, 0, 14.7, 0, top), B(w, 1.5, d - 2, 0, 0.75, 0, DARK));
      const n = Math.max(1, Math.round(w / 14));
      for (let i = 0; i < n; i++) { const x = -hw + (w / n) * (i + 0.5); s.push(B(w / n - 1, 12, 0.4, x, 7.5, hd - 0.8, lighten(c, 0.06)), B(3, 0.6, 0.6, x, 12, hd - 0.4, METAL)); }
      if (f.k !== "island") s.push(B(w, 9, 7, 0, 32, -hd + 3.5, c), B(w + 0.6, 0.8, 7.6, 0, 27.2, -hd + 3.8, darken(c, 0.2)));
      if (f.k === "stove") { s.push(B(w - 2, 0.3, d - 4, 0, 15.5, 0, "#111216")); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.push(CY(2.6, 2.6, 0.4, x * w * 0.22, 15.8, z * d * 0.2, "#3a3d45", 14)); gs.push(B(w * 0.7, 6, 0.3, 0, 7, hd - 0.4, "#1a1d24")); }
      if (f.k === "sink") s.push(B(w * 0.55, 0.4, d * 0.5, 0, 15.4, 0, METAL), CY(0.6, 0.6, 6, 0, 18, -hd + 4, METAL, 8), B(0.8, 0.8, 4, 0, 21, -hd + 6, METAL));
      if (f.k === "island") s.push(B(w + 4, 1.4, d + 6, 0, 14.7, 0, top));
      break;
    }
    case "fridge": s.push(RB(w, 31, d, 0, 15.5, 0, c, 1.2), B(w - 1, 0.3, 0.3, 0, 21, hd + 0.05, darken(c, 0.4)), B(0.8, 7, 0.8, -hw + 2.5, 25, hd + 0.4, METAL), B(0.8, 8, 0.8, -hw + 2.5, 13, hd + 0.4, METAL)); break;
    case "espresso": s.push(B(w, 9, d, 0, 4.5, 0, "#c9ced8"), B(w * 0.6, 1, d * 0.5, 0, 1, d * 0.2, DARK), CY(1.2, 1.2, 3, 0, 4, hd * 0.3, DARK, 8)); gl.push(B(1, 1, 0.2, -w * 0.3, 7, hd + 0.05, "#3dff8b", 2)); break;
    case "tv": case "tvwall": {
      const stand = f.k === "tv", tw = w * 0.9, th = tw * 0.55, y = stand ? 7.5 + th / 2 + 1 : th / 2, z = stand ? -hd + 3 : 0;
      if (stand) s.push(B(w, 7, d, 0, 3.5, 0, c), B(w - 2, 0.4, 0.4, 0, 5, hd + 0.05, METAL), B(4, 1.2, 3, 0, 8, z, DARK));
      s.push(B(tw + 1, th + 1, 1.4, 0, y, z, "#0b0c10"));
      gl.push(B(tw - 0.6, th - 0.6, 0.2, 0, y, z + 0.8, "#4a7ab8", 1.25));
      break;
    }
    case "shelf": {
      s.push(B(w, 32, 1, 0, 16, -hd + 0.5, darken(c, 0.2)), B(1.2, 32, d, -hw + 0.6, 16, 0, c), B(1.2, 32, d, hw - 0.6, 16, 0, c));
      for (let k = 0; k < 5; k++) {
        const y = 1 + k * 7.6;
        s.push(B(w, 1, d, 0, y, 0, c));
        if (k === 4) break;
        for (let x = -hw + 2; x < hw - 2;) { const bw = 1.2 + r() * 2, bh = 4 + r() * 2.5; if (r() < 0.85) s.push(B(bw, bh, d - 3, x + bw / 2, y + 0.5 + bh / 2, 0.5, ["#c0392b", "#2e6da4", "#e1b12c", "#2d8a5a", "#7d3c98", "#e8e2da", "#3a3d45"][Math.floor(r() * 7)])); x += bw + 0.3; }
      }
      break;
    }
    case "plant": s.push(CY(hw * 0.55, hw * 0.4, 8, 0, 4, 0, "#b5651d", 12)); for (let k = 0; k < 6; k++) { const a = k * 1.05, rr = hw * 0.35; s.push(SP(hw * 0.45, Math.cos(a) * rr, 12 + r() * 6, Math.sin(a) * rr, k % 2 ? "#2f8f4e" : "#3aa85c", 1, 1.3, 1, 8)); } break;
    case "palm": {
      s.push(CY(hw * 0.5, hw * 0.4, 8, 0, 4, 0, "#c9c2b6", 12), CY(1, 1.4, 22, 0, 18, 0, "#7a5a3a", 8));
      for (let k = 0; k < 7; k++) { const g = new THREE.BoxGeometry(16, 0.6, 4); g.translate(8, 0, 0); g.rotateZ(-0.45); g.rotateY((k / 7) * Math.PI * 2); g.translate(0, 29, 0); s.push(paint(g, k % 2 ? "#2f8f4e" : "#3aa85c")); }
      break;
    }
    case "bonsai": s.push(B(w * 0.8, 3, d * 0.6, 0, 1.5, 0, "#3a3d45"), CY(0.8, 1.2, 9, 0, 6, 0, "#5a3a22", 6)); for (const [x, y, z] of [[-3, 10, 0], [3, 12, 1], [0, 14, -2]]) s.push(SP(4, x, y, z, "#3a7a3a", 1.3, 0.55, 1.1, 8)); break;
    case "rug": s.push(B(w, 0.4, d, 0, 0.2, 0, f.c2 || darken(c, 0.3)), B(w - 4, 0.5, d - 4, 0, 0.3, 0, c), B(w * 0.5, 0.55, d * 0.5, 0, 0.32, 0, f.c2 || lighten(c, 0.2))); break;
    case "lamp": s.push(CY(3.5, 4, 1, 0, 0.5, 0, DARK, 12), CY(0.5, 0.5, 30, 0, 15.5, 0, METAL, 6), CY(3.2, 5, 6, 0, 31, 0, c || "#f2e2c0", 14)); gl.push(SP(2, 0, 29.5, 0, "#fff0c8", 1, 1, 1, 8)); break;
    case "wardrobe": s.push(B(w, 34, d, 0, 17, 0, c), B(w + 1, 1.5, d + 1, 0, 34.5, 0, darken(c, 0.25)), B(0.4, 32, 0.4, 0, 17, hd + 0.1, darken(c, 0.5)), B(0.6, 5, 0.8, -1.5, 18, hd + 0.4, METAL), B(0.6, 5, 0.8, 1.5, 18, hd + 0.4, METAL)); break;
    case "bath": s.push(RB(w, 9, d, 0, 4.5, 0, WHITE, 2), B(1, 6, 1, -hw + 4, 11, -hd + 2, METAL)); gl.push(B(w - 4, 0.3, d - 4, 0, 8.4, 0, "#7ac8e8", 0.9)); break;
    case "toilet": s.push(RB(w * 0.8, 7, d * 0.6, 0, 3.5, hd * 0.25, WHITE, 2), RB(w, 9, d * 0.3, 0, 9, -hd + d * 0.15, WHITE, 1), RB(w * 0.85, 1, d * 0.6, 0, 7.5, hd * 0.25, "#e8e4dc", 0.4)); break;
    case "basin": s.push(B(w * 0.3, 10, d * 0.4, 0, 5, -hd * 0.3, WHITE), RB(w, 3, d, 0, 11.5, 0, WHITE, 1), B(1, 4, 1, 0, 14, -hd + 1.5, METAL)); gs.push(B(w * 0.9, 14, 0.4, 0, 26, -hd + 0.2, "#c9e6ff")); break;
    case "shower": s.push(B(w, 1, d, 0, 0.5, 0, WHITE), CY(0.5, 0.5, 34, -hw + 2, 17, -hd + 2, METAL, 6), CY(2.4, 2.4, 0.6, -hw + 5, 33, -hd + 5, METAL, 12)); gs.push(B(0.4, 34, d, hw - 0.2, 17, 0, "#c9e6ff"), B(w, 34, 0.4, 0, 17, hd - 0.2, "#c9e6ff")); break;
    case "shopcounter": case "reception": case "bar": {
      const front = f.k === "bar" ? c : f.k === "reception" ? c : c;
      s.push(B(w, 15, d, 0, 7.5, 0, front), B(w + 1, 1.4, d + 2, 0, 15.7, 0.5, f.k === "bar" ? "#4a3020" : "#e8e4dc"), B(w - 2, 1.2, d - 2, 0, 0.6, 0, DARK));
      if (f.k === "reception") s.push(B(w, 4, 3, 0, 18, hd - 1.5, lighten(c, 0.2)));
      if (f.k === "bar") s.push(CYX(0.5, w - 4, 0, 3, hd + 2, METAL, 6));
      if (f.k !== "bar") { s.push(B(6, 4, 5, w * 0.28, 18.4, 0, DARK)); gl.push(B(4, 2, 0.2, w * 0.28, 19.5, 2.6, "#3dff8b", 1.4)); }
      break;
    }
    case "rack": {
      s.push(B(1, 28, 1, -hw + 1, 14, 0, METAL), B(1, 28, 1, hw - 1, 14, 0, METAL), B(w, 0.8, 0.8, 0, 27.5, 0, METAL), B(6, 1, d, -hw + 1, 0.5, 0, METAL), B(6, 1, d, hw - 1, 0.5, 0, METAL));
      for (let x = -hw + 4; x < hw - 3; x += 3.2) { const col = ["#ff3cac", "#2bf0ff", "#ffd23f", "#f4f4f4", "#15161b", "#9d4dff", "#3dff8b", "#ff8a1f"][Math.floor(r() * 8)]; s.push(B(1.6, 14, d - 2, x, 19.5, 0, col), B(1.6, 6, d - 5, x, 11, 0, darken(col, 0.1))); }
      break;
    }
    case "gunwall": {
      s.push(B(w, 22, d, 0, 11, 0, "#3a3d45"), B(w + 2, 1, d + 1, 0, 22.5, 0, "#2a2d33"));
      for (let row = 0; row < 3; row++) for (let x = -hw + 8; x < hw - 6; x += 14 + r() * 6) {
        const long = r() < 0.6;
        s.push(B(long ? 12 : 6, 1.6, 1.2, x, 4 + row * 7, hd + 0.4, row === 1 ? "#4a3a2a" : "#15161b"), B(1.2, 2.6, 1.2, x - (long ? 2 : 1), 2.6 + row * 7, hd + 0.4, "#15161b"));
      }
      break;
    }
    case "case": s.push(B(w, 9, d, 0, 4.5, 0, c)); gs.push(B(w - 1, 7, d - 1, 0, 12.6, 0, "#c9e6ff")); for (let k = 0; k < 4; k++) s.push(B(5, 1, 2, -hw + 6 + k * (w - 12) / 3, 9.6, 0, k % 2 ? "#15161b" : "#c9a227")); break;
    case "booth": {
      for (const sz of [-1, 1]) { s.push(B(w - 4, 6, 9, 0, 3, sz * (hd - 4.5), darken(c, 0.2)), RB(w - 4, 2.5, 8, 0, 7, sz * (hd - 4.5), c, 1), RB(w - 4, 13, 3, 0, 9, sz * (hd - 1.5), c, 1.2)); }
      s.push(B(w - 10, 1.6, d - 24, 0, 12, 0, "#f4f4f4"), CY(1.2, 1.2, 11, 0, 5.5, 0, METAL, 8), B(4, 3, 3, 4, 14.5, 0, "#c0392b"));
      break;
    }
    case "bottles": {
      for (const y of [0, 10]) { s.push(B(w, 1, d, 0, y, 0, c)); for (let x = -hw + 2; x < hw - 1; x += 2.6) { const col = ["#3a7a3a", "#8a3a1a", "#c9a227", "#e8e4dc", "#3a5a8a"][Math.floor(r() * 5)]; gs.push(CY(0.8, 0.9, 5 + r() * 2, x, y + 3.5, 0, col, 8)); } }
      break;
    }
    case "hbed": {
      s.push(B(w, 2, d, 0, 9, 0, "#c9ced8"), RB(w - 2, 3, d - 2, 0, 11.5, 0, WHITE, 1), RB(w - 1.6, 1, d * 0.6, 0, 13, hd * 0.3, "#7ac8e8", 0.4), RB(w * 0.6, 2.5, 6, 0, 14, -hd + 5, WHITE, 1));
      legs(9, METAL, 1.5, 1.2); s.push(B(w, 10, 1.2, 0, 14, -hd, "#c9ced8"), B(1, 2, d * 0.5, -hw - 0.5, 14, 0, METAL), B(1, 2, d * 0.5, hw + 0.5, 14, 0, METAL));
      s.push(CY(0.4, 0.4, 32, hw + 3, 16, -hd + 4, METAL, 6)); gs.push(B(3, 5, 1, hw + 3, 30, -hd + 4, "#c9e6ff"));
      break;
    }
    case "bench": s.push(B(w, 2, d, 0, 7, 0, c), B(w, 8, 1.6, 0, 12, -hd + 0.8, c)); legs(6, METAL, 2, 1.4); break;
    case "locker": { s.push(B(w, 32, d, 0, 16, 0, c)); const n = Math.max(2, Math.round(w / 9)); for (let i = 1; i < n; i++) s.push(B(0.4, 32, 0.4, -hw + (w / n) * i, 16, hd + 0.1, darken(c, 0.5))); for (let i = 0; i < n; i++) s.push(B(4, 0.6, 0.3, -hw + (w / n) * (i + 0.5), 28, hd + 0.1, darken(c, 0.5)), B(0.6, 2, 0.4, -hw + (w / n) * (i + 0.5) + 2, 17, hd + 0.2, METAL)); break; }
    case "bars": {
      const alongX = w >= d, len = Math.max(w, d);
      for (let k = -len / 2 + 1; k <= len / 2; k += 4) s.push(alongX ? CY(0.5, 0.5, 38, k, 19, 0, c, 6) : CY(0.5, 0.5, 38, 0, 19, k, c, 6));
      s.push(alongX ? B(len, 1.4, 1.4, 0, 37.5, 0, c) : B(1.4, 1.4, len, 0, 37.5, 0, c), alongX ? B(len, 1.4, 1.4, 0, 2, 0, c) : B(1.4, 1.4, len, 0, 2, 0, c));
      break;
    }
    case "crate": { const h = Math.min(w, d); s.push(B(w, h, d, 0, h / 2, 0, c)); for (const y of [1, h - 1]) s.push(B(w + 0.4, 1.4, d + 0.4, 0, y, 0, darken(c, 0.3))); s.push(B(w + 0.3, h, 1.2, 0, h / 2, 0, darken(c, 0.2))); break; }
    case "drum": s.push(CY(hw, hw, 20, 0, 10, 0, c, 16), CY(hw + 0.3, hw + 0.3, 1, 0, 6, 0, darken(c, 0.3), 16), CY(hw + 0.3, hw + 0.3, 1, 0, 14, 0, darken(c, 0.3), 16), CY(hw - 1, hw - 1, 0.3, 0, 20.1, 0, darken(c, 0.15), 16)); break;
    case "tires": for (let k = 0; k < 3; k++) s.push(CY(hw, hw, 4.4, 0, 2.3 + k * 4.6, 0, "#15161b", 18), CY(hw * 0.5, hw * 0.5, 4.6, 0, 2.3 + k * 4.6, 0, "#5a5d66", 12)); break;
    case "carprop": {
      s.push(RB(w, 7, d, 0, 7, 0, c, 2), RB(w - 4, 6, d * 0.45, 0, 13, -d * 0.05, c, 2), B(w + 0.4, 2, d * 0.2, 0, 5, hd - d * 0.1, DARK));
      gs.push(B(w - 4.6, 5, d * 0.47, 0, 13.4, -d * 0.05, "#1a2633"));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.push(CYX(4.5, 3.4, sx * (hw - 1), 4.5, sz * (hd - 9), "#15161b", 14));
      gl.push(B(4, 1.5, 0.3, -hw + 4, 8, hd + 0.1, "#fff4d6", 2), B(4, 1.5, 0.3, hw - 4, 8, hd + 0.1, "#fff4d6", 2));
      break;
    }
    case "lift": for (const sx of [-1, 1]) s.push(B(5, 40, 5, sx * (hw - 2.5), 20, 0, c), B(w * 0.42, 1.6, 3, sx * hw * 0.55, 13, -hd * 0.5, METAL), B(w * 0.42, 1.6, 3, sx * hw * 0.55, 13, hd * 0.5, METAL)); s.push(B(w, 2, 5, 0, 40, 0, c)); break;
    case "toolwall": s.push(B(w, 20, d, 0, 10, 0, "#c9b07a")); for (let x = -hw + 4; x < hw - 3; x += 5 + r() * 3) { const col = ["#c0392b", "#2e6da4", "#e1b12c", "#9aa3ad"][Math.floor(r() * 4)]; s.push(B(1.2, 8 + r() * 6, 0.8, x, 10, hd + 0.4, METAL), B(1.8, 3, 1, x, 6, hd + 0.6, col)); } break;
    case "workbench": s.push(B(w, 3, d, 0, 13, 0, c)); legs(12, DARK, 2, 2); s.push(B(w * 0.3, 6, d * 0.6, -w * 0.25, 17, 0, "#c0392b"), B(4, 4, 6, w * 0.3, 16.5, -2, METAL)); break;
    case "piano": {
      s.push(B(w, 7, d * 0.55, 0, 13, -hd + d * 0.275, c), CY(d * 0.32, d * 0.32, 7, w * 0.15, 13, hd - d * 0.4, c, 20), paint(new THREE.BoxGeometry(w * 0.9, 0.6, d * 0.7).rotateX(-0.3).translate(0, 20, -d * 0.05), c), B(w * 0.8, 1, 4, 0, 13, hd - 5, WHITE));
      for (let k = 0; k < 14; k++) s.push(B(0.8, 0.6, 2, -w * 0.38 + k * w * 0.056, 13.8, hd - 6, "#0e0e11"));
      legs(10, c, 3, 2); s.push(B(w * 0.45, 7, 7, 0, 3.5, hd + 4, c));
      break;
    }
    case "pool": {
      s.push(B(w, 10, d, 0, 8, 0, "#4a2a1a"), B(w - 6, 0.6, d - 6, 0, 13.3, 0, c));
      for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) s.push(CY(1.6, 1.6, 0.4, sx * (hw - 3), 13.5, sz * (hd - 3), "#0e0e11", 10));
      for (let k = 0; k < 8; k++) s.push(SP(1.2, -8 + (k % 4) * 3, 14.6, -4 + Math.floor(k / 4) * 3, ["#ffd23f", "#c0392b", "#2e6da4", "#15161b", "#ff8a1f", "#7d3c98", "#2d8a5a", WHITE][k], 1, 1, 1, 8));
      legs(8, "#3a2010", 3, 4);
      break;
    }
    case "arcade": s.push(B(w, 30, d, 0, 15, 0, c), B(w + 0.4, 6, d * 0.5, 0, 14, hd * 0.3, darken(c, 0.3)), B(w, 3, d * 0.4, 0, 31.5, hd * 0.2, c)); gl.push(B(w - 3, 9, 0.3, 0, 22, hd * 0.55, "#3dff8b", 1.3), B(w - 2, 2, 0.3, 0, 31.5, hd * 0.42, "#ffd23f", 1.6)); break;
    case "hottub": s.push(B(w, 10, d, 0, 5, 0, "#8a6a4a")); gl.push(B(w - 6, 0.4, d - 6, 0, 9.4, 0, c, 0.85)); for (let k = 0; k < 6; k++) gl.push(SP(0.8, (r() - 0.5) * (w - 10), 9.8, (r() - 0.5) * (d - 10), WHITE, 1, 1, 1, 6)); break;
    case "swim": s.push(B(w, 1.6, 4, 0, 0.8, -hd + 2, "#e8e4dc"), B(w, 1.6, 4, 0, 0.8, hd - 2, "#e8e4dc"), B(4, 1.6, d, -hw + 2, 0.8, 0, "#e8e4dc"), B(4, 1.6, d, hw - 2, 0.8, 0, "#e8e4dc")); gl.push(B(w - 8, 0.3, d - 8, 0, 0.5, 0, c, 0.75)); s.push(CY(0.4, 0.4, 8, hw - 8, 4, hd - 6, METAL, 6)); break;
    case "fireplace": s.push(B(w, 30, d, 0, 15, 0, c), B(w + 4, 2, d + 2, 0, 20, 0.5, darken(c, 0.3)), B(w * 0.55, 12, 1, 0, 7, hd + 0.1, "#15161b")); gl.push(B(w * 0.4, 4, 0.5, 0, 4, hd - 0.5, "#ff8a2a", 2.2), B(w * 0.25, 6, 0.5, 0, 6, hd - 0.3, "#ffd23f", 2.4)); break;
    case "mail": s.push(B(w, 22, d, 0, 11, 0, c)); for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) s.push(B(w / 6 - 1, 4, 0.4, -hw + (w / 6) * (i + 0.5), 2.5 + j * 5.2, hd + 0.1, darken(c, 0.25))); break;
    case "elevator": s.push(B(w, 40, d, 0, 20, 0, "#8a9098"), B(w * 0.36, 34, 0.6, -w * 0.18, 17, hd + 0.2, "#c9ced8"), B(w * 0.36, 34, 0.6, w * 0.18, 17, hd + 0.2, "#c9ced8")); gl.push(B(8, 2.5, 0.3, 0, 37, hd + 0.4, "#ff9f43", 1.6)); break;
    case "door": s.push(B(w + 3, 38, d, 0, 19, 0, darken(c, 0.4)), B(w, 36, d + 0.6, 0, 18, 0.2, c), B(0.8, 0.8, 2, w * 0.35, 18, hd + 0.8, "#c9a227"), B(4, 3, 0.4, 0, 30, hd + 0.6, "#c9a227")); break;
    case "lowtable": s.push(B(w, 2, d, 0, 6, 0, c)); legs(5, darken(c, 0.3), 2, 2); s.push(CY(2, 2, 3, 0, 8.5, 0, WHITE, 10)); break;
    case "cushion": s.push(RB(w, 2.6, d, 0, 1.3, 0, c, 1)); break;
    case "tank": s.push(B(w, 10, d, 0, 5, 0, DARK)); gl.push(B(w - 1, 12, d - 1, 0, 16.5, 0, c, 0.8)); for (let k = 0; k < 5; k++) s.push(B(2, 1.2, 0.6, (r() - 0.5) * (w - 6), 13 + r() * 8, (r() - 0.5) * (d - 4), "#ff8a1f")); s.push(B(w, 1, d, 0, 23, 0, DARK)); break;
    case "jukebox": s.push(B(w, 22, d, 0, 11, 0, c), CYZ(hw, d, 0, 22, 0, c, 16)); gl.push(B(w - 4, 10, 0.3, 0, 13, hd + 0.1, "#ffd23f", 1.4), B(w - 6, 3, 0.3, 0, 23, hd + 0.1, "#ff3cac", 1.6)); break;
    case "files": { s.push(B(w, 22, d, 0, 11, 0, c)); for (let k = 0; k < 3; k++) s.push(B(w - 2, 6, 0.4, 0, 4 + k * 7, hd + 0.1, lighten(c, 0.1)), B(3, 0.6, 0.6, 0, 6 + k * 7, hd + 0.4, METAL)); break; }
    case "vending": s.push(B(w, 32, d, 0, 16, 0, c), B(w * 0.3, 8, 0.4, w * 0.3, 18, hd + 0.1, DARK)); gl.push(B(w * 0.55, 22, 0.3, -w * 0.15, 18, hd + 0.1, "#e8f6ff", 1.2)); break;
    case "cooler": s.push(B(w * 0.8, 16, d * 0.8, 0, 8, 0, WHITE)); gs.push(CY(w * 0.3, w * 0.3, 10, 0, 21, 0, "#7ac8e8", 12)); break;
    case "curtain": s.push(B(w, 1, d, 0, 36, 0, METAL)); for (let k = 0; k < Math.max(w, d) / 3; k++) s.push(w > d ? B(3, 34, d * 0.4, -hw + 1.5 + k * 3, 18, (k % 2) * 1 - 0.5, k % 2 ? c : darken(c, 0.12)) : B(d * 0.4, 34, 3, (k % 2) * 1 - 0.5, 18, -hd + 1.5 + k * 3, k % 2 ? c : darken(c, 0.12))); break;
    case "treadmill": s.push(B(w, 3, d, 0, 1.5, 0, c), B(w - 3, 0.4, d - 4, 0, 3.2, 1, "#0e0e11"), B(1.4, 18, 1.4, -hw + 1, 10, -hd + 2, METAL), B(1.4, 18, 1.4, hw - 1, 10, -hd + 2, METAL), B(w, 3, 5, 0, 19, -hd + 2.5, DARK)); gl.push(B(w * 0.5, 1.6, 0.3, 0, 19.5, -hd + 5.1, "#3dff8b", 1.4)); break;
    case "column": s.push(CY(hw, hw, H, 0, H / 2, 0, c, 16)); break;
    case "dj": s.push(B(w, 15, d, 0, 7.5, 0, c)); break;
    case "neon": case "art": case "mirror": case "board": case "map": {
      // flat things on a wall: a frame and a picture (own material)
      const ph = f.k === "neon" ? 12 : f.k === "map" || f.k === "board" ? w * 0.6 : f.k === "mirror" ? 26 : w * 0.72;
      if (f.k !== "neon") s.push(B(w + 2, ph + 2, 1, 0, ph / 2, 0, f.k === "mirror" ? "#c9a227" : f.k === "board" ? "#8a9098" : "#2a2016"));
      let mat: THREE.Material;
      if (f.k === "mirror") mat = new THREE.MeshStandardMaterial({ color: 0xdfeaf2, metalness: 1, roughness: 0.04, envMapIntensity: 1.4 });
      else if (f.k === "neon") mat = new THREE.MeshBasicMaterial({ map: textTex(f.c2 || "OPEN", c, "rgba(0,0,0,0)"), transparent: true, toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2) });
      else if (f.k === "board") mat = new THREE.MeshStandardMaterial({ map: textTex(f.c2 || "", "#c0392b", f.c || "#f4f4f4", 256, 160), roughness: 0.8 });
      else if (f.k === "map") mat = new THREE.MeshStandardMaterial({ map: mapTex(c), roughness: 0.9 });
      else mat = new THREE.MeshStandardMaterial({ map: artTex(f.c2 || "abstract", c), roughness: 0.7 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, ph), mat);
      m.position.set(0, ph / 2, 0.6);
      if (f.k === "neon") { const glowM = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.1, ph * 1.4), new THREE.MeshBasicMaterial({ color: C(c).clone().multiplyScalar(0.5), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })); glowM.position.set(0, ph / 2, 0.3); extraPlace(glowM, f); }
      extraPlace(m, f);
      break;
    }
    default: s.push(B(w, 10, d, 0, 5, 0, c));
  }
  const place = (g: THREE.BufferGeometry) => g.rotateY(-(f.a ?? 0)).translate(f.x, baseY + (f.z ?? 0), f.y);
  for (const g of s) out.std.push(place(g));
  for (const g of gl) out.glow.push(place(g));
  for (const g of gs) out.glass.push(place(g));
  function extraPlace(m: THREE.Mesh, fu: FurnSpec) {
    const grp = new THREE.Group();
    grp.add(m);
    grp.rotation.y = -(fu.a ?? 0);
    grp.position.set(fu.x, baseY + (fu.z ?? 0), fu.y);
    extra.push(grp);
  }
}
export function mapTex(col: string) {
  const r = mulberry32(3);
  return canvasTex(256, 160, (g) => {
    g.fillStyle = "#7ab0c8"; g.fillRect(0, 0, 256, 160);
    g.fillStyle = col || "#c9b07a";
    g.beginPath(); g.moveTo(90, 0); for (let y = 0; y <= 160; y += 10) g.lineTo(90 + r() * 30, y); g.lineTo(256, 160); g.lineTo(256, 0); g.fill();
    g.strokeStyle = "#5a4a3a"; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(130 + k * 20, 0); g.lineTo(130 + k * 20, 160); g.moveTo(110, 20 + k * 24); g.lineTo(256, 20 + k * 24); g.stroke(); }
    g.fillStyle = "#c0392b"; g.beginPath(); g.arc(150, 70, 5, 0, 7); g.fill();
  });
}

