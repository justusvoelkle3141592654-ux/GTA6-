import * as THREE from "three";

// small helpers to build vertex-coloured geometry and canvas textures
export const wrapA = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function radialTex(inner: string, outer: string, size = 128) {
  return canvasTex(size, size, (g) => {
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
  });
}
export function withColor(g: THREE.BufferGeometry, col: THREE.Color, mul = 1) {
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = col.r * mul; arr[i * 3 + 1] = col.g * mul; arr[i * 3 + 2] = col.b * mul; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}
export const colCache = new Map<string, THREE.Color>();
export function C(hex: string) { let c = colCache.get(hex); if (!c) { c = new THREE.Color(hex); colCache.set(hex, c); } return c; }
export function box(w: number, h: number, d: number, x: number, y: number, z: number, col: string | THREE.Color, mul = 1, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return withColor(g, typeof col === "string" ? C(col) : col, mul);
}
export function flat(w: number, d: number, x: number, z: number, col: string, y = 0.12, mul = 1) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(x, y, z);
  return withColor(g, C(col), mul);
}
export function cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, col: string, seg = 8, mul = 1) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y, z);
  return withColor(g, C(col), mul);
}
export function sph(r: number, x: number, y: number, z: number, col: string, seg = 10) {
  const g = new THREE.SphereGeometry(r, seg, seg); g.translate(x, y, z);
  return withColor(g, C(col));
}
