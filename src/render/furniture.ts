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
      case "herringbone": {
        for (let j = -1; j < 9; j++) for (let i = -1; i < 9; i++) {
          g.save(); g.translate(i * 32 + (j % 2) * 16, j * 32); g.rotate(Math.PI / 4);
          g.fillStyle = shade(col, 0.8 + r() * 0.35); g.fillRect(0, 0, 40, 10); g.fillStyle = shade(col, 0.8 + r() * 0.35); g.fillRect(0, 10, 10, 40);
          g.strokeStyle = shade(col, 0.5); g.lineWidth = 1; g.strokeRect(0, 0, 40, 10); g.strokeRect(0, 10, 10, 40); g.restore();
        }
        break;
      }
      case "hex": {
        g.fillStyle = shade(col, 0.6); g.fillRect(0, 0, 256, 256);
        const R = 16, hx = R * Math.sqrt(3);
        for (let j = -1; j < 12; j++) for (let i = -1; i < 10; i++) {
          const x = i * hx + (j % 2 ? hx / 2 : 0), y = j * R * 1.5;
          g.fillStyle = (i * 7 + j * 3) % 11 === 0 ? shade(col, 0.7) : shade(col, 0.95 + r() * 0.08);
          g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(x + Math.cos(a) * (R - 1), y + Math.sin(a) * (R - 1)); } g.fill();
        }
        break;
      }
      case "polished": {
        const id = g.getImageData(0, 0, 256, 256), c = C(col);
        for (let i = 0; i < id.data.length; i += 4) { const v = 0.94 + r() * 0.08; id.data[i] = c.r * 255 * v; id.data[i + 1] = c.g * 255 * v; id.data[i + 2] = c.b * 255 * v; id.data[i + 3] = 255; }
        g.putImageData(id, 0, 0);
        g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = 1.5; g.strokeRect(0, 0, 256, 256); g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.stroke();
        for (let k = 0; k < 5; k++) { g.fillStyle = "rgba(255,255,255,0.06)"; g.beginPath(); g.ellipse(r() * 256, r() * 256, 30 + r() * 40, 8, r() * 3, 0, 7); g.fill(); }
        break;
      }
      case "carpettile": {
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
          g.fillStyle = shade(col, (i + j) % 2 ? 0.92 : 1.04); g.fillRect(i * 64, j * 64, 64, 64);
          g.strokeStyle = shade(col, 0.8); g.lineWidth = 1; for (let k = 4; k < 64; k += 6) { g.beginPath(); if ((i + j) % 2) { g.moveTo(i * 64 + k, j * 64); g.lineTo(i * 64 + k, j * 64 + 64); } else { g.moveTo(i * 64, j * 64 + k); g.lineTo(i * 64 + 64, j * 64 + k); } g.stroke(); }
        }
        break;
      }
      case "stone": {
        g.fillStyle = shade(col, 0.55); g.fillRect(0, 0, 256, 256);
        for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) { const w = 256 / 3, x = i * w + (j % 2 ? w / 2 : 0); for (const xx of [x, x - 256]) { g.fillStyle = shade(col, 0.85 + r() * 0.25); g.fillRect(xx + 2, j * 64 + 2, w - 4, 60); } }
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

// walls: the texture covers 60 units across and the whole wall height H (baseboard at every floor, a trim under the ceiling)
export function wallTex(style: string, col: string, H = 46, floors: number[] = [0]) {
  const r = mulberry32(99 + style.length);
  return canvasTex(256, 256, (g) => {
    g.scale(256 / 60, 256 / H); // draw in world units: x 0..60, y 0 (ceiling) .. H (floor)
    g.fillStyle = col; g.fillRect(0, 0, 60, H);
    const dots = (n: number, a: number, s = 0.4) => { for (let k = 0; k < n; k++) { g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.3})`; g.fillRect(r() * 60, r() * H, s, s); } };
    const lowerTo = (y0: number, y1: number) => { g.fillStyle = shade(col, 0.82); g.fillRect(0, y0, 60, y1 - y0); };
    switch (style) {
      case "brick": {
        const bh = 2.2, bw = 6.5;
        g.fillStyle = shade(col, 0.6); g.fillRect(0, 0, 60, H);
        for (let j = 0; j * bh < H; j++) for (let i = -1; i * bw < 60; i++) { g.fillStyle = shade(col, 0.8 + r() * 0.35); g.fillRect(i * bw + (j % 2 ? bw / 2 : 0) + 0.2, j * bh + 0.2, bw - 0.4, bh - 0.4); }
        break;
      }
      case "wood": for (let i = 0; i < 15; i++) { g.fillStyle = shade(col, 0.82 + r() * 0.3); g.fillRect(i * 4, 0, 4, H); g.fillStyle = shade(col, 0.5); g.fillRect(i * 4, 0, 0.25, H); } break;
      case "tile": { g.fillStyle = shade(col, 0.75); g.fillRect(0, 0, 60, H); for (let j = 0; j * 3 < H; j++) for (let i = 0; i < 20; i++) { g.fillStyle = shade(col, 0.95 + r() * 0.08); g.fillRect(i * 3 + 0.15, j * 3 + 0.15, 2.7, 2.7); } break; }
      case "stripe": for (let i = 0; i < 20; i++) { g.fillStyle = i % 2 ? shade(col, 0.9) : col; g.fillRect(i * 3, 0, 3, H); } break;
      case "concrete": { dots(2600, 0.05); g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 0.2; for (let y = 12; y < H; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(60, y); g.stroke(); } for (let y = 6; y < H; y += 12) for (const x of [10, 30, 50]) { g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.arc(x, y, 0.5, 0, 7); g.fill(); } break; }
      case "panel": {
        // wainscoting: framed panels up to the chair rail, paint above
        for (const z of floors) {
          const y1 = H - z, y0 = y1 - 14;
          lowerTo(y0, y1);
          g.strokeStyle = shade(col, 0.62); g.lineWidth = 0.35; for (let x = 1.5; x < 60; x += 10) g.strokeRect(x, y0 + 2, 7, 10);
          g.fillStyle = shade(col, 1.12); g.fillRect(0, y0 - 1, 60, 1);
        }
        dots(800, 0.03);
        break;
      }
      case "wallpaper": {
        dots(500, 0.03);
        g.fillStyle = shade(col, 0.86);
        for (let y = 2; y < H; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < 62; x += 6) { g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x + 1.6, y); g.lineTo(x, y + 2); g.lineTo(x - 1.6, y); g.fill(); }
        break;
      }
      case "block": {
        // cinder blocks, the lower part painted darker (prison)
        g.fillStyle = shade(col, 0.72); g.fillRect(0, 0, 60, H);
        for (let j = 0; j * 4 < H; j++) for (let i = -1; i * 8 < 60; i++) { g.fillStyle = shade(col, 0.95 + r() * 0.1); g.fillRect(i * 8 + (j % 2 ? 4 : 0) + 0.25, j * 4 + 0.25, 7.5, 3.5); }
        g.globalAlpha = 0.85; g.fillStyle = shade(col, 0.62); g.fillRect(0, H - 14, 60, 14); g.fillStyle = shade(col, 0.45); g.fillRect(0, H - 14.6, 60, 0.6); g.globalAlpha = 1;
        dots(1200, 0.05);
        break;
      }
      case "tile2": {
        // tiles up to shoulder height, paint above
        const y0 = H - 18;
        g.fillStyle = shade(col, 0.7); g.fillRect(0, y0, 60, 18);
        for (let j = 0; j * 3 < 18; j++) for (let i = 0; i < 20; i++) { g.fillStyle = shade(col, 1.05 + r() * 0.06); g.fillRect(i * 3 + 0.15, y0 + j * 3 + 0.15, 2.7, 2.7); }
        g.fillStyle = shade(col, 0.6); g.fillRect(0, y0 - 0.6, 60, 0.6);
        break;
      }
      case "metal": for (let i = 0; i < 30; i++) { g.fillStyle = shade(col, i % 2 ? 0.82 : 1.06); g.fillRect(i * 2, 0, 2, H); } break;
      default: dots(1600, 0.035);
    }
    // baseboard at every floor and a thin trim under the ceiling
    if (style !== "block" && style !== "metal" && style !== "concrete") for (const z of floors) { g.fillStyle = style === "brick" || style === "wood" ? shade(col, 0.45) : "#f2efe8"; g.fillRect(0, H - z - 3, 60, 3); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, H - z - 3.3, 60, 0.3); }
    g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(0, 0, 60, 1);
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
    else if (kind === "sky") { const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, "#3a7ac8"); gr.addColorStop(1, "#cfe6f0"); g.fillStyle = gr; g.fillRect(0, 0, 128, 96); g.fillStyle = col; g.beginPath(); g.moveTo(20, 50); g.lineTo(108, 44); g.lineTo(112, 48); g.lineTo(20, 54); g.fill(); g.fillRect(56, 34, 10, 26); g.fillRect(24, 42, 4, 10); }
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

// textures and materials that many pieces share
const matMemo = new Map<string, THREE.Material>();
function memoMat(key: string, make: () => THREE.Material) { let m = matMemo.get(key); if (!m) { m = make(); matMemo.set(key, m); } return m; }
// a menu or chalk board: a title and a few lines with prices
export function menuTex(title: string, col: string, bg = "#15161b") {
  const r = mulberry32(title.length * 13 + col.length);
  return canvasTex(256, 96, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 256, 96);
    g.fillStyle = col; g.textAlign = "center"; g.font = "bold 22px 'Bebas Neue', Impact, sans-serif"; g.fillText(title, 128, 24, 240);
    g.font = "11px Inter, sans-serif"; g.textAlign = "left";
    const items = ["Klassiker", "Spezial", "Menü", "Extra", "Getränk", "Dessert"];
    for (let k = 0; k < 6; k++) { const x = k < 3 ? 14 : 136, y = 44 + (k % 3) * 17; g.fillStyle = "rgba(255,255,255,0.85)"; g.fillText(items[k], x, y); g.fillStyle = col; g.fillText("$" + (2 + Math.floor(r() * 9)) + "," + (r() < 0.5 ? "50" : "90"), x + 80, y); }
  });
}
function clockTex() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = "#f4f4f2"; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.strokeStyle = "#1d1d22"; g.lineWidth = 3;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.moveTo(64 + Math.cos(a) * 48, 64 + Math.sin(a) * 48); g.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56); g.stroke(); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 30); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(64, 64); g.lineTo(94, 72); g.stroke();
  });
}
// basketball court: coloured floor, white lines, the key at both ends
function courtTex(col: string) {
  return canvasTex(256, 384, (g) => {
    g.fillStyle = "#4a5a6a"; g.fillRect(0, 0, 256, 384); g.fillStyle = col; g.fillRect(12, 12, 232, 360);
    g.strokeStyle = "#f4f4f4"; g.lineWidth = 3; g.strokeRect(12, 12, 232, 360);
    g.beginPath(); g.moveTo(12, 192); g.lineTo(244, 192); g.stroke(); g.beginPath(); g.arc(128, 192, 34, 0, 7); g.stroke();
    for (const [y, s] of [[12, 1], [372, -1]] as [number, number][]) { g.strokeRect(88, s > 0 ? y : y - 70, 80, 70); g.beginPath(); g.arc(128, y + s * 70, 30, 0, 7); g.stroke(); g.beginPath(); g.arc(128, y + s * 10, 96, s > 0 ? 0 : Math.PI, s > 0 ? Math.PI : Math.PI * 2); g.stroke(); }
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
    // ---------------------------------------------------------------- prison
    case "celldoor": {
      // an open barred cell door (frame and bars)
      s.push(B(w, 1.4, 1.4, 0, 1, 0, c), B(w, 1.4, 1.4, 0, 35, 0, c), B(1.4, 36, 1.4, -hw, 18, 0, c), B(1.4, 36, 1.4, hw, 18, 0, c), B(w, 1, 1, 0, 18, 0, c));
      for (let x = -hw + 3; x < hw - 1; x += 3) s.push(CY(0.45, 0.45, 34, x, 18, 0, c, 6));
      s.push(B(1.2, 3, 2, hw - 2, 17, 0.8, METAL));
      break;
    }
    case "wallshelf": s.push(B(w, 1, d, 0, 0, 0, c), B(1, 3, d, -hw + 0.5, -1.5, 0, c), B(1, 3, d, hw - 0.5, -1.5, 0, c)); for (let k = 0; k < 4; k++) s.push(B(1.6 + r() * 1.4, 4 + r() * 2, d - 0.8, -hw + 2.5 + k * (w - 4) / 4, 2.8, 0, ["#c0392b", "#2e6da4", "#e8e2da", "#3a3d45"][k])); break;
    case "lampwall": s.push(B(w, 2, d, 0, 0, 0, DARK)); gl.push(B(w - 1, 1.4, d * 0.6, 0, -0.9, d * 0.2, "#fff4d6", 1.6)); break;
    case "guarddesk": {
      s.push(B(w, 15, d, 0, 7.5, 0, c), B(w + 1, 1.4, d + 1, 0, 15.7, 0, "#3a3d45"), B(w, 2, 1, 0, 1, hd - 0.5, DARK));
      gs.push(B(w, 10, 0.4, 0, 21.4, hd - 0.5, "#c9e6ff"));
      for (const x of [-w * 0.25, w * 0.25]) { s.push(B(9, 6, 1, x, 20, -hd + 3, "#111216")); gl.push(B(8, 5, 0.2, x, 20, -hd + 3.6, "#4ab0ff", 1.2)); }
      gl.push(CY(0.8, 0.8, 0.6, w * 0.4, 16.7, 0, "#ff3a3a", 8));
      break;
    }
    case "steeltable": s.push(CY(hw, hw, 1.4, 0, 12, 0, c, 20), CY(1.6, 2.2, 11.5, 0, 6, 0, darken(c, 0.2), 10), CY(hw * 0.5, hw * 0.5, 0.8, 0, 0.4, 0, darken(c, 0.3), 14)); break;
    case "showers": {
      s.push(B(w, 34, 1, 0, 17, -hd + 0.5, "#e8eef2"), B(w, 0.4, d, 0, 0.2, 0, "#c9d2d8"));
      const n = Math.max(2, Math.round(w / 15));
      for (let i = 0; i < n; i++) {
        const x = -hw + (w / n) * (i + 0.5);
        s.push(CY(0.4, 0.4, 6, x, 30, -hd + 2, METAL, 6), CY(2, 1.2, 1, x, 27, -hd + 4, METAL, 10), B(3, 0.6, 1, x + 3, 16, -hd + 1, METAL), CY(1.2, 1.2, 0.2, x, 0.5, 0, "#5a5d66", 10));
        if (i > 0) s.push(B(0.8, 24, d * 0.8, -hw + (w / n) * i, 14, -hd + d * 0.4, "#d8dce0"));
      }
      break;
    }
    case "camera": s.push(B(1, 1, 3, 0, 0, -1.5, DARK), B(2.4, 2.4, 5, 0, -1.2, 1.5, c), CY(1, 1, 0.6, 0, -1.2, 4.2, "#0e0e11", 10)); gl.push(SP(0.4, 0.8, 0, 2, "#ff2a2a", 1, 1, 1, 6)); break;
    case "servery": {
      s.push(B(w, 14, d, 0, 7, 0, c), B(w + 1, 1.2, d + 2, 0, 14.6, 0, METAL), B(w, 1, 4, 0, 10, hd + 2, METAL));
      const n = Math.max(2, Math.round(w / 12));
      for (let i = 0; i < n; i++) { const x = -hw + (w / n) * (i + 0.5); s.push(B(w / n - 2, 1.2, d - 4, x, 15.4, 0, "#5a5d66"), B(w / n - 3, 0.8, d - 5, x, 15.9, 0, ["#e1b12c", "#c0392b", "#2d8a5a", "#e8dcc0", "#8a5a3a"][i % 5])); }
      gs.push(B(w, 0.4, d * 0.7, 0, 22, 0, "#c9e6ff"), B(w, 7, 0.4, 0, 18.5, hd - 0.5, "#c9e6ff"));
      for (const x of [-hw + 1, hw - 1]) s.push(CY(0.4, 0.4, 7, x, 18.5, 0, METAL, 6));
      gl.push(B(w - 2, 0.3, 2, 0, 21.6, 0, "#fff0c8", 1.4));
      break;
    }
    case "trays": for (let k = 0; k < 8; k++) s.push(B(w, 0.6, d, 0, 0.3 + k * 0.9, 0, k % 2 ? c : darken(c, 0.15))); s.push(B(w + 2, 14, d + 2, 0, -7, 0, "#9aa3ad")); break;
    case "longtable": s.push(B(w, 1.4, d, 0, 12, 0, c)); for (const x of [-hw + 4, hw - 4]) s.push(B(1.6, 11, d - 4, x, 6, 0, darken(c, 0.25)), B(2.5, 1, d, x, 0.5, 0, darken(c, 0.35))); break;
    case "tray": s.push(B(w, 0.5, d, 0, 0.25, 0, c), B(w * 0.35, 0.8, d * 0.5, -w * 0.2, 0.9, 0, "#e8dcc0"), CY(1.2, 1, 1.2, w * 0.25, 1.1, 0, "#f4f4f4", 10), B(0.3, 0.3, d * 0.7, w * 0.05, 0.7, 0, METAL)); break;
    case "bin": s.push(CY(hw, hw * 0.85, 14, 0, 7, 0, c, 14), CY(hw + 0.3, hw + 0.3, 1, 0, 14, 0, darken(c, 0.3), 14)); break;
    case "shelfsteel": {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.push(B(1, 32, 1, sx * (hw - 0.5), 16, sz * (hd - 0.5), METAL));
      for (let k = 0; k < 4; k++) { s.push(B(w, 0.6, d, 0, 2 + k * 9, 0, METAL)); for (let i = 0; i < 3; i++) if (r() < 0.8) s.push(B(w / 3 - 1.4, 5 + r() * 2, d - 2, -hw + (w / 3) * (i + 0.5), 5 + k * 9, 0, ["#c9a070", "#e8e2da", "#c0392b", "#8a9098"][Math.floor(r() * 4)])); }
      break;
    }
    case "pingpong": {
      s.push(B(w, 1, d, 0, 12, 0, c), B(w, 0.06, 0.4, 0, 12.55, 0, WHITE), B(0.4, 0.06, d, 0, 12.55, 0, WHITE), B(w, 0.06, 0.4, 0, 12.55, hd - 0.3, WHITE), B(w, 0.06, 0.4, 0, 12.55, -hd + 0.3, WHITE));
      s.push(B(0.4, 2.5, d + 2, 0, 13.8, 0, "#e8e8ec")); legs(11.5, DARK, 3, 1.4);
      s.push(B(4, 0.6, 3, -hw + 5, 13, 2, "#c0392b"), SP(0.5, 4, 13, -3, "#ffffff", 1, 1, 1, 6));
      break;
    }
    case "cards": for (let k = 0; k < 6; k++) { const g = new THREE.BoxGeometry(2.4, 0.1, 3.4).rotateY(r() * 3).translate((r() - 0.5) * w * 0.8, 0.05 + k * 0.05, (r() - 0.5) * d * 0.8); s.push(paint(g, k % 3 ? WHITE : "#c0392b")); } break;
    case "court": {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), memoMat("court" + c, () => new THREE.MeshStandardMaterial({ map: courtTex(c), roughness: 0.85 })));
      m.position.set(0, 0.35, 0); m.receiveShadow = true; extraPlace(m, f);
      break;
    }
    case "hoop": {
      s.push(CY(1.2, 1.2, 46, 0, 23, -hd, "#3a3d45", 8), B(2, 2, 10, 0, 45, -hd + 5, "#3a3d45"), B(w, 11, 0.8, 0, 50, hd - 1, WHITE), B(w * 0.4, 0.3, 0.3, 0, 48, hd - 0.4, "#c0392b"));
      s.push(paint(new THREE.TorusGeometry(2.6, 0.25, 6, 18).rotateX(Math.PI / 2).translate(0, 46, hd + 2.4), "#ff6a1a"));
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; s.push(B(0.2, 4, 0.2, Math.cos(a) * 2.2, 44, hd + 2.4 + Math.sin(a) * 2.2, WHITE)); }
      s.push(SP(1.6, 4, 1.6, hd + 6, "#e8742a", 1, 1, 1, 10));
      break;
    }
    case "weights": {
      s.push(B(6, 1.6, d - 2, 0, 8, 2, "#1d1d22"), B(1.4, 7, 1.4, 0, 3.5, 6, METAL), B(1.4, 7, 1.4, 0, 3.5, -2, METAL));
      for (const sx of [-1, 1]) s.push(B(1.2, 16, 1.2, sx * 5, 8, -hd + 2, METAL));
      s.push(CYX(0.4, w, 0, 15, -hd + 2, METAL, 8));
      for (const sx of [-1, 1]) for (const o of [0, 1.4]) s.push(CYX(4 - o, 1.2, sx * (hw - 4 - o), 15, -hd + 2, "#15161b", 16));
      break;
    }
    case "dumbbells": {
      s.push(B(w, 1, d, 0, 9, 0, METAL), B(w, 1, d, 0, 4, 0, METAL)); for (const x of [-hw + 1, hw - 1]) s.push(B(1.4, 10, d, x, 5, 0, METAL));
      for (const y of [5.3, 10.3]) for (let x = -hw + 4; x < hw - 3; x += 5) s.push(CYX(1.4, 1, x - 1.4, y, 0, "#15161b", 10), CYX(1.4, 1, x + 1.4, y, 0, "#15161b", 10), CYX(0.4, 2.4, x, y, 0, METAL, 6));
      break;
    }
    case "rubber": s.push(B(w, 0.4, d, 0, 0.2, 0, c)); for (let x = -hw; x < hw; x += 20) s.push(B(0.3, 0.45, d, x, 0.22, 0, darken(c, 0.4))); break;
    case "picnic": {
      s.push(B(w, 1.4, d * 0.45, 0, 13, 0, c)); for (const sz of [-1, 1]) s.push(B(w, 1.2, d * 0.18, 0, 7.5, sz * hd * 0.75, c));
      for (const sx of [-1, 1]) { const g = new THREE.BoxGeometry(1.4, 16, 1.4).rotateX(0.55); s.push(paint(g.clone().translate(sx * (hw - 4), 6.5, -3), darken(c, 0.3)), paint(new THREE.BoxGeometry(1.4, 16, 1.4).rotateX(-0.55).translate(sx * (hw - 4), 6.5, 3), darken(c, 0.3))); g.dispose(); s.push(B(1.2, 1.2, d, sx * (hw - 4), 7, 0, darken(c, 0.3))); }
      break;
    }
    case "yardlamp": s.push(CY(1, 1.4, 60, 0, 30, 0, c, 8), B(2, 2, 12, 0, 59, 5, c), B(5, 2, 7, 0, 58, 10, DARK)); gl.push(B(4, 0.5, 6, 0, 56.8, 10, "#fff4d6", 2)); break;
    // ---------------------------------------------------------------- mall and shops
    case "planter": {
      s.push(RB(w, 9, d, 0, 4.5, 0, "#d8d2c6", 1), B(w - 2, 0.6, d - 2, 0, 8.8, 0, "#4a3a2a"));
      const n = Math.max(2, Math.round((w * d) / 120));
      for (let k = 0; k < n; k++) s.push(SP(3 + r() * 2, (r() - 0.5) * (w - 6), 11 + r() * 4, (r() - 0.5) * (d - 6), k % 2 ? "#2f8f4e" : "#3aa85c", 1, 1.2, 1, 8));
      break;
    }
    case "fountain": {
      s.push(CY(hw, hw, 5, 0, 2.5, 0, "#d8d2c6", 24), CY(hw - 1.5, hw - 1.5, 5.2, 0, 2.6, 0, "#a8a296", 24), CY(2.6, 3.4, 10, 0, 5, 0, "#d8d2c6", 14), CY(5, 3, 1.5, 0, 10.5, 0, "#d8d2c6", 16));
      gl.push(CY(hw - 1.6, hw - 1.6, 0.4, 0, 4.4, 0, c, 24, ), CY(0.6, 1.4, 9, 0, 15, 0, "#d8f2ff", 10), CY(4.4, 4.4, 0.3, 0, 11.3, 0, c, 16));
      break;
    }
    case "directory": s.push(B(w, 1, d, 0, 0.5, 0, DARK), B(w, 28, 1.6, 0, 15, 0, "#2a2d33")); gl.push(B(w - 2, 22, 0.3, 0, 16, 0.9, "#7ac8e8", 1.1), B(w - 4, 3, 0.3, 0, 26, 0.95, "#ffd23f", 1.4)); break;
    case "foodstand": {
      s.push(B(w, 14, d, 0, 7, 0, c), B(w + 1, 1.4, d + 3, 0, 14.7, 1, "#e8e4dc"), B(w, 2, 1, 0, 1, hd + 0.4, DARK));
      for (let x = -hw + 4; x < hw - 2; x += 8) s.push(B(4, 12, 0.4, x, 7.5, hd + 0.3, lighten(c, 0.15)));
      s.push(B(w, 1.4, 1.4, 0, 36, -hd, "#3a3d45"), B(1.4, 22, 1.4, -hw + 1, 25, -hd, "#3a3d45"), B(1.4, 22, 1.4, hw - 1, 25, -hd, "#3a3d45"));
      gl.push(B(w - 4, 7, 0.4, 0, 31, -hd + 0.6, "#ffd23f", 1.3));
      s.push(B(8, 3, 6, -w * 0.3, 16.5, -1, METAL), B(5, 4, 4, w * 0.3, 17, -1, "#c9ced8"), CY(1.2, 1.2, 3, 0, 17, 0, "#c0392b", 8));
      break;
    }
    case "window": {
      // a window with the view over the city (frame, mullion, sill); c2 "blinds": half closed blinds
      const ph = Math.min(26, w * 0.6);
      s.push(B(w + 3, 1.4, 2.6, 0, 0, 1, "#e8e4dc"), B(w + 3, 1.4, 1, 0, ph + 0.7, 0.4, "#e8e4dc"), B(1.4, ph, 1, -hw - 0.7, ph / 2, 0.4, "#e8e4dc"), B(1.4, ph, 1, hw + 0.7, ph / 2, 0.4, "#e8e4dc"), B(0.8, ph, 0.8, 0, ph / 2, 0.6, "#e8e4dc"));
      if (f.c2 === "blinds") for (let y = ph - 1; y > ph * 0.45; y -= 1.4) s.push(B(w, 0.7, 0.2, 0, y, 0.9, "#ece8de"));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, ph), memoMat("window", () => new THREE.MeshBasicMaterial({ map: windowTex(), toneMapped: false, color: new THREE.Color(0.9, 0.9, 0.9) })));
      m.position.set(0, ph / 2, 0.2); extraPlace(m, f);
      break;
    }
    case "pendant": {
      // hangs from the ceiling: cable, shade, bulb (z is ignored, it is placed under the ceiling)
      const y = H - 2 - (d > 6 ? 16 : 12);
      s.push(CY(0.15, 0.15, H - y - 4, 0, (H + y) / 2 - 1, 0, DARK, 4), CY(hw * 0.3, hw, hw * 0.9, 0, y, 0, c, 16));
      gl.push(SP(hw * 0.32, 0, y - hw * 0.3, 0, "#fff2cc", 1, 1, 1, 8), CY(hw * 0.92, hw * 0.92, 0.2, 0, y - hw * 0.45, 0, "#fff2cc", 16));
      break;
    }
    case "spotrail": {
      const y = H - 3;
      s.push(B(w, 1, 1.4, 0, y, 0, DARK));
      for (let x = -hw + 4; x < hw - 2; x += 9) { s.push(CY(1.2, 1.6, 3, x, y - 2, 0, DARK, 10)); gl.push(CY(1.2, 1.2, 0.2, x, y - 3.6, 0, "#fff6e0", 10)); }
      break;
    }
    case "mannequin": {
      s.push(CY(3, 3.4, 0.8, 0, 0.4, 0, DARK, 14), CY(0.4, 0.4, 10, 0, 5, 0, METAL, 6));
      s.push(paint(new THREE.CylinderGeometry(2.8, 2.2, 10, 12).scale(1, 1, 0.62).translate(0, 15, 0), c), paint(new THREE.CylinderGeometry(2.2, 2.6, 7, 12).scale(1, 1, 0.65).translate(0, 7.8, 0), f.c2 || darken(c, 0.4)));
      s.push(SP(1.7, 0, 22.4, 0, "#e8e2da", 1, 1.15, 1, 10), CY(0.7, 0.8, 1.6, 0, 20.4, 0, "#e8e2da", 8));
      for (const sx of [-1, 1]) s.push(paint(new THREE.CylinderGeometry(0.7, 0.6, 8, 8).rotateZ(sx * 0.18).translate(sx * 3.4, 15.5, 0), c));
      break;
    }
    case "cubeshelf": {
      s.push(B(w, 32, d, 0, 16, -hd * 0.05, "#f4f2ee"));
      const nx = Math.max(2, Math.round(w / 9)), ny = 4, cw = w / nx;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const x = -hw + cw * (i + 0.5), y = 3 + j * 8;
        s.push(B(cw - 1, 6.6, 0.4, x, y + 0.6, hd - 0.2, "#e8e4dc"));
        if (r() < 0.85) for (let k = 0; k < 3; k++) s.push(B(cw - 2.6, 1.3, d - 2, x, y - 1.6 + k * 1.4, 0.4, ["#ff6f91", "#2bb3ff", "#ffd23f", "#f4f4f4", "#15161b", "#3dd68c", "#c9a070"][Math.floor(r() * 7)]));
      }
      break;
    }
    case "displaytable": {
      s.push(B(w, 2, d, 0, 11, 0, c), B(w - 4, 9, d - 4, 0, 5, 0, darken(c, 0.25)));
      for (let k = 0; k < 4; k++) for (let n = 0; n < 3; n++) s.push(B(w / 4 - 2, 1.2, d * 0.5, -hw + (w / 4) * (k + 0.5), 12.6 + n * 1.3, (k % 2 ? 1 : -1) * d * 0.12, ["#ff6f91", "#2bb3ff", "#f4f4f4", "#ffd23f", "#1f2a44"][(k + n) % 5]));
      break;
    }
    case "register": s.push(B(w, 2, d, 0, 1, 0, DARK), B(w * 0.8, 3, d * 0.5, 0, 3.5, -d * 0.15, "#2a2d33"), B(w * 0.7, 3.2, 0.6, 0, 6, -d * 0.05, "#111216")); gl.push(B(w * 0.6, 2.4, 0.2, 0, 6, 0.3, "#3dff8b", 1.2)); break;
    case "menuboard": {
      s.push(B(w + 2, w * 0.36 + 2, 1, 0, w * 0.18, 0, DARK));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.36), memoMat("menu" + f.c2 + c, () => new THREE.MeshBasicMaterial({ map: menuTex(f.c2 || "MENÜ", c), toneMapped: false })));
      m.position.set(0, w * 0.18, 0.6); extraPlace(m, f);
      break;
    }
    case "garland": {
      // a string of paper flags under the ceiling across the room (w long)
      const y = H - 8;
      s.push(B(w, 0.2, 0.2, 0, y, 0, DARK));
      for (let x = -hw + 2; x < hw - 1; x += 4) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([x - 1.6, y, 0, x + 1.6, y, 0, x, y - 3.4, 0, x + 1.6, y, 0, x - 1.6, y, 0, x, y - 3.4, 0], 3)); g.computeVertexNormals(); s.push(paint(g, ["#ff3cac", "#ffd23f", "#2bf0ff", "#3dff8b", "#ff8a1f"][Math.floor(r() * 5)])); }
      break;
    }
    case "cactus": s.push(CY(hw * 0.6, hw * 0.45, 7, 0, 3.5, 0, "#c86a3a", 12), CY(1.8, 2, 14, 0, 13, 0, "#3a8a4a", 10), SP(1.8, 0, 20, 0, "#3a8a4a", 1, 0.6, 1, 10), CY(1, 1, 5, 2.8, 13, 0, "#3a8a4a", 8), CY(1, 1, 4, -2.8, 11, 0, "#3a8a4a", 8)); break;
    case "toolchest": {
      s.push(RB(w, 26, d, 0, 13, 0, c, 0.8), B(w + 0.6, 1, d + 0.6, 0, 26.5, 0, DARK));
      for (let k = 0; k < 6; k++) s.push(B(w - 2, 0.4, 0.4, 0, 4 + k * 3.8, hd + 0.2, METAL), B(w - 2, 0.3, 0.3, 0, 2 + k * 3.8, hd + 0.1, darken(c, 0.3)));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.push(CY(1, 1, 1.4, sx * (hw - 2), 0.7, sz * (hd - 2), DARK, 8));
      break;
    }
    case "compressor": s.push(CYX(hd * 0.8, w * 0.8, 0, hd * 0.8 + 2, 0, c, 16), B(w * 0.4, 6, d * 0.6, w * 0.1, hd * 1.6 + 5, 0, DARK), CY(1.4, 1.4, 2, w * 0.3, hd * 1.6 + 3, 0, METAL, 10)); for (const sx of [-1, 1]) s.push(CY(1.2, 1.2, 1, sx * w * 0.3, 0.6, 0, DARK, 8)); break;
    case "boxes": { let y = 0; for (let k = 0; k < 3; k++) { const bw = w * (0.9 - k * 0.12), bh = 6 + r() * 3; s.push(B(bw, bh, d * (0.9 - k * 0.1), (r() - 0.5) * 2, y + bh / 2, (r() - 0.5) * 2, k % 2 ? "#b58a5a" : "#c9a070"), B(bw * 0.9, 0.3, 1.2, 0, y + bh + 0.1, 0, "#d8c8a0")); y += bh; } break; }
    case "gondola": {
      // supermarket shelf, products on both sides, a price strip on every board
      s.push(B(w, 30, 1, 0, 15, 0, "#e8e8ec"), B(w, 2.4, d, 0, 1.2, 0, "#c9ced8"));
      for (let lv = 0; lv < 4; lv++) {
        const y = 4 + lv * 7;
        s.push(B(w, 0.6, d, 0, y, 0, "#e8e8ec"));
        for (const sz of [-1, 1]) {
          s.push(B(w, 1, 0.3, 0, y - 0.2, sz * hd, ["#ffd23f", "#f4f4f4"][lv % 2]));
          for (let x = -hw + 1.5; x < hw - 1;) { const pw = 1.6 + r() * 2.4, ph = 2.5 + r() * 3; s.push(B(pw, ph, hd - 1.4, x + pw / 2, y + 0.3 + ph / 2, sz * hd * 0.5, ["#c0392b", "#e1b12c", "#2e6da4", "#2d8a5a", "#e67e22", "#8e44ad", "#f4f4f4", "#15161b"][Math.floor(r() * 8)])); x += pw + 0.4; }
        }
      }
      s.push(B(1, 30, d, -hw, 15, 0, c), B(1, 30, d, hw, 15, 0, c), B(w, 4, d, 0, 32, 0, c));
      break;
    }
    case "fridgeglass": {
      s.push(B(w, 34, d, 0, 17, 0, "#e8e8ec"), B(w, 4, d, 0, 36, 0, c));
      const n = Math.max(1, Math.round(w / 12));
      for (let i = 0; i < n; i++) {
        const x = -hw + (w / n) * (i + 0.5);
        for (let lv = 0; lv < 5; lv++) for (let k = 0; k < 4; k++) s.push(CY(0.9, 0.9, 3.6, x - w / n / 2 + 2.2 + k * (w / n - 3) / 3, 3 + lv * 6.2, 1, ["#c0392b", "#2e6da4", "#2d8a5a", "#f4f4f4", "#e1b12c"][(i + lv + k) % 5], 8));
        s.push(B(0.6, 32, 0.6, -hw + (w / n) * i, 17, hd, METAL), B(0.5, 8, 0.8, x + w / n * 0.4, 17, hd + 0.5, METAL));
        gl.push(B(w / n - 1.5, 0.4, 0.4, x, 33, hd - 2, "#e8f6ff", 1.4));
      }
      gs.push(B(w, 32, 0.4, 0, 17, hd, "#d8f0ff"));
      break;
    }
    case "checkout": {
      s.push(B(w, 13, d, 0, 6.5, 0, c), B(w, 0.6, d - 2, 0, 13.3, 0, "#1d1d22"), B(w * 0.3, 1, d, -w * 0.35, 13.7, 0, METAL));
      s.push(B(6, 2, 5, w * 0.3, 15, 0, DARK), B(5, 4, 0.6, w * 0.3, 18, -1.5, "#111216")); gl.push(B(4, 3, 0.2, w * 0.3, 18, -1.1, "#3dff8b", 1.2));
      s.push(B(1, 18, 1, -hw + 1, 22, 0, METAL)); gl.push(B(4, 4, 1, -hw + 1, 32, 0, "#ffd23f", 1.5));
      for (let k = 0; k < 3; k++) s.push(B(w * 0.25, 4, 1, -w * 0.1, 3 + k * 4, -hd - 0.6, ["#e1b12c", "#c0392b", "#2e6da4"][k]));
      break;
    }
    case "fruitstand": {
      for (let k = 0; k < 3; k++) {
        const z = -hd + d * (k + 0.5) / 3, y = 6 + (2 - k) * 4;
        s.push(B(w, 3, d / 3 - 0.5, 0, y, z, "#a0703a"));
        const col = ["#c0392b", "#f39c12", "#2d8a5a", "#e1b12c", "#8e44ad"][(k * 2) % 5];
        for (let x = -hw + 2; x < hw - 1; x += 2.6) s.push(SP(1.2, x, y + 2.2, z + (r() - 0.5), col, 1, 1, 1, 6));
      }
      legs(6, "#7a5a32", 1.5, 1.6);
      break;
    }
    case "baskets": for (let k = 0; k < 4; k++) s.push(B(w, 1.6, d, 0, 1 + k * 1.8, 0, c), B(w - 1, 0.4, d - 1, 0, 1.9 + k * 1.8, 0, darken(c, 0.4))); s.push(B(0.4, 4, d, 0, 8.5, 0, DARK)); break;
    case "brochure": s.push(B(w, 1, d, 0, 0.5, 0, DARK), B(1, 18, 1, 0, 9, 0, METAL), paint(new THREE.BoxGeometry(w, 14, 2).rotateX(-0.25).translate(0, 18, 0), "#2a2d33")); for (let k = 0; k < 3; k++) s.push(paint(new THREE.BoxGeometry(w / 3 - 1, 6, 0.4).rotateX(-0.25).translate(-hw + (w / 3) * (k + 0.5), 18, 1.4), ["#c0392b", "#f4f4f4", "#2bb3ff"][k])); break;
    case "barber": {
      s.push(CY(4.5, 5, 1, 0, 0.5, 0, METAL, 16), CY(1.4, 1.4, 6, 0, 4, 0, METAL, 10));
      s.push(RB(10, 3, 10, 0, 8.5, 0, c, 1.2), RB(10, 13, 3, 0, 15, -4.5, c, 1.2), RB(4, 3, 2.4, 0, 22.5, -4.4, c, 1));
      for (const sx of [-1, 1]) s.push(RB(2, 2, 9, sx * 5.4, 12, 0, c, 0.8), B(0.6, 3, 0.6, sx * 5.4, 10, 3, METAL));
      s.push(B(7, 0.8, 4, 0, 4, 7, METAL), B(1, 4, 1, 0, 6, 5.5, METAL));
      break;
    }
    case "mirrorstation": {
      s.push(B(w, 1.4, d, 0, 13, 0, "#2a2016"));
      for (let k = 0; k < 4; k++) s.push(CY(0.8, 0.8, 3 + r() * 2, -hw + 3 + k * 2.6, 15.5, 0, ["#2bb3ff", "#c9a227", "#f4f4f4", "#c0392b"][k], 8));
      s.push(B(w + 2, 24, 0.8, 0, 28, -hd + 0.4, "#c9a227"));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 22), memoMat("mirror", () => new THREE.MeshStandardMaterial({ color: 0xdfeaf2, metalness: 1, roughness: 0.04 })));
      m.position.set(0, 28, -hd + 0.9); extraPlace(m, f);
      gl.push(B(w, 1, 1, 0, 40.5, -hd + 1, "#fff4d6", 1.6));
      break;
    }
    case "hairsink": s.push(B(w, 14, d * 0.4, 0, 7, -hd + d * 0.2, "#2a2d33"), RB(w * 0.8, 3, d * 0.45, 0, 15, -hd + d * 0.25, WHITE, 1.2), CY(0.4, 0.4, 4, 0, 18, -hd + 1, METAL, 6)); s.push(RB(w * 0.8, 3, d * 0.4, 0, 8, hd * 0.4, c, 1), RB(w * 0.8, 9, 2, 0, 12, hd * 0.05, c, 1)); break;
    case "pole": s.push(CY(hw * 0.9, hw * 0.9, 2, 0, 1, 0, METAL, 12), CY(hw * 0.9, hw * 0.9, 2, 0, 19, 0, METAL, 12)); gl.push(CY(hw * 0.7, hw * 0.7, 16, 0, 10, 0, "#ffffff", 12)); for (let k = 0; k < 4; k++) gl.push(paint(new THREE.TorusGeometry(hw * 0.72, 0.5, 4, 12).rotateX(Math.PI / 2 + 0.5).translate(0, 4 + k * 4, 0), k % 2 ? "#c0392b" : "#2e6da4", 1.3)); break;
    case "monitor": s.push(CY(3, 3.4, 1, 0, 0.5, 0, DARK, 5), CY(0.5, 0.5, 20, 0, 10, 0, METAL, 6), B(8, 6, 3, 0, 22, 0, "#d8dce0")); gl.push(B(6.5, 4.5, 0.2, 0, 22, 1.6, "#0a1a12", 1), B(5.5, 0.4, 0.2, 0, 22.8, 1.75, "#3dff8b", 1.6), B(4, 0.4, 0.2, 0, 21.2, 1.75, "#ffd23f", 1.6)); break;
    case "iv": s.push(CY(3, 3, 0.6, 0, 0.6, 0, METAL, 5), CY(0.3, 0.3, 32, 0, 16, 0, METAL, 6), B(5, 0.4, 0.4, 0, 31, 0, METAL)); gs.push(B(2.4, 4, 1.4, 1.8, 28, 0, "#c9e6ff")); break;
    case "cabinet": s.push(B(w, 30, d, 0, 15, 0, c)); gs.push(B(w - 2, 16, 0.4, 0, 22, hd + 0.1, "#c9e6ff")); for (let k = 0; k < 6; k++) s.push(B(1.4, 2.4, 1.4, -hw + 3 + k * (w - 6) / 5, 18 + (k % 2) * 6, 0, ["#f4f4f4", "#c0392b", "#2bb3ff"][k % 3])); s.push(B(w - 2, 0.3, 0.3, 0, 10, hd + 0.1, darken(c, 0.4))); break;
    case "vitrine": {
      s.push(B(w, 12, d, 0, 6, 0, c), B(w + 0.6, 0.8, d + 0.6, 0, 12.4, 0, "#e8e4dc"));
      gs.push(B(w - 0.4, 8, d - 0.4, 0, 16.8, 0, "#e0f2ff"));
      for (let k = 0; k < 6; k++) s.push(SP(1.6, -hw + 2.5 + k * (w - 5) / 5, 13.8, (k % 2 ? 1 : -1) * d * 0.15, ["#c98a4a", "#e8c070", "#7a3a2a", "#f2d0d8", "#e1b12c", "#c98a4a"][k], 1.2, 0.6, 1, 8));
      gl.push(B(w - 2, 0.3, 1, 0, 20.6, 0, "#fff4d6", 1.6));
      break;
    }
    case "lifering": s.push(paint(new THREE.TorusGeometry(hw * 0.8, hw * 0.22, 8, 20).translate(0, hw, 0.8), "#e8452a")); for (let k = 0; k < 4; k++) s.push(B(hw * 0.5, hw * 0.5, hw * 0.5, Math.cos(k * Math.PI / 2) * hw * 0.8, hw + Math.sin(k * Math.PI / 2) * hw * 0.8, 0.8, WHITE)); break;
    case "hull": {
      // a speedboat on a trailer: the hull (length along z, pointed bow at +z), a stripe, windscreen, seats, outboard motor
      const L2 = hd, B2 = hw * 0.85, y0 = 9;
      s.push(B(w * 0.9, 1.2, d * 0.9, 0, 1.6, 0, DARK), CY(2.4, 2.4, 1.8, -hw * 0.75, 2.4, -L2 * 0.3, "#15161b"), CY(2.4, 2.4, 1.8, hw * 0.75, 2.4, -L2 * 0.3, "#15161b"));
      for (let i = 0; i < 6; i++) {
        const t0 = i / 6, t1 = (i + 1) / 6, z0 = -L2 + t0 * 2 * L2, z1 = -L2 + t1 * 2 * L2;
        const bw = (t: number) => B2 * (t < 0.62 ? 1 : 1 - (t - 0.62) / 0.38 * 0.9);
        const wv = (bw(t0) + bw(t1)) / 2, hgt = 7 + t1 * 2;
        s.push(B(wv * 2, hgt, z1 - z0 + 0.2, 0, y0 + hgt / 2 - 1, (z0 + z1) / 2, c));
        s.push(B(wv * 2 + 0.2, 1.2, z1 - z0 + 0.2, 0, y0 + hgt * 0.55, (z0 + z1) / 2, f.c2 || "#2b6bff"));
        s.push(B(wv * 1.4, 2.4, z1 - z0 + 0.2, 0, y0 - 1.5, (z0 + z1) / 2, darken(c, 0.25)));
      }
      gs.push(B(B2 * 1.6, 4, 0.5, 0, y0 + 9, L2 * 0.15, "#c9e6ff"));
      s.push(B(B2 * 0.7, 3, 6, -B2 * 0.4, y0 + 8, -L2 * 0.2, "#2a2d33"), B(B2 * 0.7, 3, 6, B2 * 0.4, y0 + 8, -L2 * 0.2, "#2a2d33"));
      s.push(B(4, 8, 4, 0, y0 + 5, -L2 - 2, "#15161b"), B(2, 6, 2, 0, y0 - 1, -L2 - 2.5, METAL));
      break;
    }
    case "aircraft": {
      // a scale model of a small plane on a pole: fuselage along z (nose at +z), wings, tail, propeller
      const L2 = hd, y0 = 16;
      s.push(CY(hw * 0.25, hw * 0.3, 1, 0, 0.5, 0, DARK, 16), CY(0.8, 0.8, y0, 0, y0 / 2, 0, METAL, 8));
      s.push(paint(new THREE.CylinderGeometry(3.2, 1.6, L2 * 1.8, 12).rotateX(Math.PI / 2).translate(0, y0 + 3, 0), c));
      s.push(SP(3.2, 0, y0 + 3, L2 * 0.9, c, 1, 1, 1.2, 12));
      s.push(B(w, 0.8, L2 * 0.45, 0, y0 + 4, L2 * 0.15, c), B(w + 0.2, 0.9, 2, 0, y0 + 4.1, L2 * 0.3, f.c2 || "#2b6bff"));
      s.push(B(w * 0.4, 0.6, L2 * 0.2, 0, y0 + 3.5, -L2 * 0.85, c), B(0.6, 6, L2 * 0.22, 0, y0 + 6, -L2 * 0.85, f.c2 || "#2b6bff"));
      gs.push(B(4, 2.4, 6, 0, y0 + 5.6, L2 * 0.45, "#c9e6ff"));
      s.push(B(0.6, w * 0.32, 1, 0, y0 + 3, L2 * 0.9 + 3.6, DARK), B(w * 0.32, 0.6, 1, 0, y0 + 3, L2 * 0.9 + 3.6, DARK));
      break;
    }
    case "shipmodel": s.push(B(w, 1.4, d, 0, 0.7, 0, "#3a2a1a"), CY(0.4, 0.4, 3, 0, 2.5, 0, METAL, 6), paint(new THREE.CylinderGeometry(1.6, 0.8, w * 0.8, 8).rotateZ(Math.PI / 2).scale(1, 0.8, 0.9).translate(0, 5, 0), "#c0392b"), B(w * 0.5, 2, 1.8, -w * 0.05, 7, 0, WHITE), B(w * 0.2, 2.4, 1.4, w * 0.12, 9, 0, "#2a2d33")); break;
    case "speaker": s.push(B(w, 30, d, 0, 15, 0, "#15161b")); for (const [y, rr] of [[8, hw * 0.75], [20, hw * 0.5], [27, hw * 0.28]] as [number, number][]) s.push(CYZ(rr, 0.6, 0, y, hd + 0.2, "#2a2d33", 16), CYZ(rr * 0.4, 0.8, 0, y, hd + 0.4, "#3a3d45", 12)); break;
    case "discoball": {
      const y = H - 14;
      s.push(CY(0.15, 0.15, 12, 0, y + 7, 0, DARK, 4), SP(hw, 0, y, 0, "#c9ced8", 1, 1, 1, 12));
      for (let k = 0; k < 14; k++) { const a = r() * 6.28, b = r() * 3.14; gl.push(B(0.9, 0.9, 0.2, Math.cos(a) * Math.sin(b) * hw, y + Math.cos(b) * hw, Math.sin(a) * Math.sin(b) * hw, ["#ffffff", "#ff3cac", "#2bf0ff"][k % 3], 2)); }
      break;
    }
    case "shake": s.push(B(w, 10, d, 0, 5, 0, c), B(w * 0.8, 1, d * 0.6, 0, 1, d * 0.1, DARK)); for (const x of [-w * 0.25, w * 0.25]) gs.push(CY(1.3, 1, 4, x, 4.5, hd * 0.3, "#f2c7d8", 8)); gl.push(B(w * 0.7, 1.4, 0.2, 0, 8.5, hd + 0.05, "#ff3cac", 1.6)); break;
    case "rangebooth": s.push(B(1.4, 24, d, -hw, 12, 0, c), B(1.4, 24, d, hw, 12, 0, c), B(w, 1.4, d * 0.4, 0, 13, hd - d * 0.2, "#5a4636"), B(w, 1, 1, 0, 24, -hd + 0.5, c)); gl.push(B(2, 1, 0.3, 0, 22, hd - 1, "#3dff8b", 1.5)); break;
    case "ammo": s.push(B(w, 30, d, 0, 15, 0, "#3a3d45")); for (let lv = 0; lv < 5; lv++) for (let x = -hw + 2; x < hw - 1; x += 3.2) s.push(B(2.6, 3.4, d - 1.4, x, 3 + lv * 6, 0.4, ["#c9a227", "#2d6a4a", "#8a3a1a", "#2a2d33"][Math.floor(r() * 4)])); break;
    case "duct": s.push(B(w, 6, d, 0, H - 6, 0, "#9aa0a8")); for (let x = -hw + 6; x < hw; x += 18) s.push(B(1, 6.6, d + 0.6, x, H - 6, 0, "#7a8088"), B(1.2, 4, 1.2, x, H - 1, 0, DARK)); break;
    case "beams": for (let x = -hw + 8; x < hw; x += 30) s.push(B(5, 4, d, x, H - 3, 0, c)); break;
    case "neon": case "art": case "mirror": case "board": case "map": case "poster": case "clock": case "chalk": {
      // flat things on a wall: a frame and a picture (own material)
      const ph = f.k === "neon" ? 12 : f.k === "clock" ? w : f.k === "poster" ? w * 1.4 : f.k === "map" || f.k === "board" || f.k === "chalk" ? w * 0.6 : f.k === "mirror" ? 26 : w * 0.72;
      if (f.k !== "neon" && f.k !== "poster" && f.k !== "clock") s.push(B(w + 2, ph + 2, 1, 0, ph / 2, 0, f.k === "mirror" ? "#c9a227" : f.k === "board" ? "#8a9098" : f.k === "chalk" ? "#6a4a32" : "#2a2016"));
      if (f.k === "clock") s.push(CYZ(hw + 0.6, 1, 0, ph / 2, 0, DARK, 20));
      let mat: THREE.Material;
      if (f.k === "mirror") mat = new THREE.MeshStandardMaterial({ color: 0xdfeaf2, metalness: 1, roughness: 0.04, envMapIntensity: 1.4 });
      else if (f.k === "clock") mat = memoMat("clock", () => new THREE.MeshStandardMaterial({ map: clockTex(), roughness: 0.6, transparent: true }));
      else if (f.k === "chalk") mat = memoMat("chalk" + f.c2, () => new THREE.MeshStandardMaterial({ map: menuTex(f.c2 || "", "#f4f4f4", "#1d2a22"), roughness: 0.95 }));
      else if (f.k === "poster") mat = memoMat("poster" + f.c2 + c, () => new THREE.MeshStandardMaterial({ map: artTex(f.c2 || "abstract", c), roughness: 0.8 }));
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

