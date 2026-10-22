// static world geometry outside the city blocks: terrain, coast, highways, bridges, the tunnel, ramps, extras
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  World, BLOCK, ROAD, GRID, WORLD, MAP_MIN, MAP_SIZE, MAP_MAX, WATER_Y, COAST, EDGE_LAND, TUNNEL, STUNT_PARK, H_SCALE,
  terrainH, terrainGrad, coast, cityDist, edgeDist, tunnelAt, tunnelFloor, isWater, mulberry32, roofOf, type Ramp, type Building,
} from "./world";
import { canvasTex, withColor, C, box, cyl, clamp } from "./meshutil";
import { TrafficLights } from "./traffic";

type G = THREE.BufferGeometry;
const merge = (list: G[]) => { const m = mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)))!; for (const g of list) g.dispose(); return m; };

// a box from (x0, z0, y0) to (x1, z1, y1) rotated around the vertical axis by a (world x/y plane)
function beam(len: number, h: number, d: number, x: number, z: number, y: number, a: number, col: string | THREE.Color, pitch = 0) {
  const g = new THREE.BoxGeometry(len, h, d);
  if (pitch) g.rotateZ(pitch);
  g.rotateY(-a); g.translate(x, z, y);
  return withColor(g, typeof col === "string" ? C(col) : col);
}

// ---------------------------------------------------------------- terrain
export function terrainMesh(quality: "low" | "medium" | "high" | "ultra"): THREE.Mesh {
  const SEG = quality === "ultra" ? 640 : quality === "high" ? 520 : quality === "medium" ? 440 : 360;
  const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  geo.translate(MAP_MIN + MAP_SIZE / 2, 0, MAP_MIN + MAP_SIZE / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const grassLo = C("#667a3c"), grassHi = C("#9a9158"), rock = C("#6e665c"), cliffRock = C("#5a524a"), peak = C("#5f574c"), sand = C("#d2bf91"), wetSand = C("#a8946a"), dirt = C("#8d7352"), floor = C("#7d7258");
  const tmp = new THREE.Color();
  const r = mulberry32(55);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainH(x, z);
    pos.setY(i, h - 0.6);
    const d = cityDist(x, z), cs = coast(x, z), cd = cs.d, cliff = cs.cliff;
    const g = terrainGrad(x, z, 14), slope = Math.hypot(g.x, g.y);
    if (cd < 0) tmp.copy(cliff ? cliffRock : floor).multiplyScalar(0.7);                   // sea floor
    else if (cliff && cd < 90) tmp.copy(cliffRock).lerp(rock, r() * 0.4);                  // rock face of the cliffs
    else if (!cliff && cd < 150) tmp.copy(wetSand).lerp(sand, clamp(cd / 70, 0, 1));         // beach, wet towards the water
    else if (x > COAST.west - 10 && x < 0 && z > -200 && z < WORLD + 200) tmp.copy(sand);     // beach next to the city
    else {
      tmp.copy(grassLo).lerp(grassHi, clamp(h / 350, 0, 1));
      if (d < 260 && d > 0) tmp.copy(dirt).lerp(tmp, clamp((d - 120) / 140, 0, 1));
      tmp.lerp(rock, clamp((slope - 0.25) * 2.2, 0, 1));
      if (h > 420) tmp.lerp(peak, clamp((h - 420) / 260, 0, 1) * 0.8);
      tmp.multiplyScalar(0.9 + r() * 0.2);
    }
    cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  // open the hill where the road goes into the tunnel (the portals cover the edges)
  const idx = geo.index!;
  const keep: number[] = [];
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    let inBand = false, lo = Infinity, hi = -Infinity;
    for (const v of [a, b, c]) {
      const x = pos.getX(v), z = pos.getZ(v), y = pos.getY(v);
      if (Math.abs(x - TUNNEL.x) < TUNNEL.hw + 30 && z < TUNNEL.yA + 40 && z > TUNNEL.yB - 40) inBand = true;
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    if (inBand && hi - lo > 26) continue;
    keep.push(a, b, c);
  }
  geo.setIndex(keep);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.25 }));
  m.receiveShadow = true;
  return m;
}

// far islands beyond the map border (scenery only, the fog swallows them)
export function backdropMesh(): THREE.Mesh {
  const P: G[] = [];
  const r = mulberry32(808);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + r() * 0.2, d = MAP_SIZE * 0.72 + r() * 3000;
    const x = WORLD / 2 + Math.cos(a) * d, y = WORLD / 2 + Math.sin(a) * d;
    const rad = 900 + r() * 1400, hh = 300 + r() * 700;
    const g = new THREE.ConeGeometry(rad, hh, 9, 1); g.translate(x, hh / 2 + WATER_Y - 20, y);
    P.push(withColor(g, C(r() < 0.5 ? "#5d6e52" : "#6e7066")));
  }
  return new THREE.Mesh(merge(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
}

// ---------------------------------------------------------------- highways, bridges, the tunnel
export function roadsMesh(world: World): THREE.Group {
  const net = world.roads;
  const R: G[] = [], S: G[] = [];
  const grp = new THREE.Group();
  // a strip along road rd between lateral offsets o0 and o1 (positive: right of the outward direction)
  const strip = (rd: (typeof net.roads)[number], o0: number, o1: number, lift: number, col: string, dash = 0) => {
    const v: number[] = [], idx: number[] = [];
    let n = 0;
    for (let p = 0; p < rd.n; p++) {
      if (dash && Math.floor(p / dash) % 2) { n = 0; continue; }
      const a = net.point(rd, p, o0), b = net.point(rd, p, o1);
      v.push(a.x, net.drawH(a.x, a.y) + lift, a.y, b.x, net.drawH(b.x, b.y) + lift, b.y);
      const k = v.length / 3 - 2;
      if (n > 0) idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
      n++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    g.setIndex(idx); g.computeVertexNormals();
    R.push(withColor(g, C(col)));
  };
  for (const rd of net.roads) {
    const hw = rd.hw;
    strip(rd, -hw, hw, 0.35, "#3c3846");
    strip(rd, -2, 2, 0.6, "#e0a82a", 3);
    strip(rd, -hw + 6, -hw + 8, 0.6, "#c8c8d2"); strip(rd, hw - 8, hw - 6, 0.6, "#c8c8d2");
    // reflector posts along the edges
    for (let p = 6; p < rd.n - 2; p += 10) for (const side of [-1, 1]) {
      const q = net.point(rd, p, side * (hw + 8));
      if (net.bridgeAt(q.x, q.y, 10) || !isNaN(tunnelAt(q.x, q.y))) continue;
      const z = terrainH(q.x, q.y);
      S.push(box(1.4, 9, 1.4, q.x, z + 4.5, q.y, "#e8e8ec"), box(1.6, 1.6, 1.6, q.x, z + 8, q.y, side > 0 ? "#ff8a1a" : "#ffffff", 2));
    }
  }
  const roadMesh = new THREE.Mesh(merge(R), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -1, side: THREE.DoubleSide }));
  roadMesh.receiveShadow = true;
  grp.add(roadMesh);
  // bridges: deck, rails, piers, lamps
  const B: G[] = [], L: G[] = [];
  for (const b of net.bridges) {
    const ax = (s: number, v: number) => (b.alongX ? [s, v] : [v, s]);
    const a = b.alongX ? 0 : Math.PI / 2;
    for (let s = b.s0; s < b.s1; s += 20) {
      const s1 = Math.min(b.s1, s + 20), h0 = net.deckH(b, s), h1 = net.deckH(b, s1), sm = (s + s1) / 2, hm = (h0 + h1) / 2;
      const pitch = Math.atan2(h1 - h0, s1 - s), len = Math.hypot(s1 - s, h1 - h0) + 0.6;
      const [x, y] = ax(sm, b.c);
      B.push(beam(len, 6, b.hw * 2 + 8, x, hm - 3.2, y, a, "#8d8a86", b.alongX ? pitch : -pitch));
      for (const side of [-1, 1]) {
        const [rx, ry] = ax(sm, b.c + side * (b.hw + 2));
        B.push(beam(len, 2.2, 1.6, rx, hm + 5, ry, a, "#c9ced8", b.alongX ? pitch : -pitch));
        B.push(beam(len, 3, 2.4, rx, hm + 1.5, ry, a, "#6f6c68", b.alongX ? pitch : -pitch));
      }
    }
    for (let s = b.s0 + 30; s < b.s1; s += 40) for (const side of [-1, 1]) {
      const [rx, ry] = ax(s, b.c + side * (b.hw + 2));
      B.push(box(1.2, 5, 1.2, rx, net.deckH(b, s) + 2.5, ry, "#c9ced8"));
    }
    for (const s of b.piers) {
      const dz = net.deckH(b, s);
      for (const off of [-42, 42]) { const [x, y] = ax(s, b.c + off); const fl = terrainH(x, y); B.push(cyl(7, 8, dz - fl, x, (dz + fl) / 2 - 4, y, "#9a968e", 12)); }
      const [x, y] = ax(s, b.c);
      B.push(beam(100, 7, 14, x, dz - 9, y, a + Math.PI / 2, "#9a968e"));
    }
    for (let s = b.s0 + 100; s < b.s1 - 60; s += 220) {
      const side = Math.round((s - b.s0) / 220) % 2 ? 1 : -1;
      const [x, y] = ax(s, b.c + side * (b.hw + 4)), z = net.deckH(b, s);
      B.push(cyl(0.9, 1.2, 38, x, z + 19, y, "#3d3f45", 6));
      L.push(box(6, 1.6, 6, x - (b.alongX ? 0 : side * 4), z + 38, y - (b.alongX ? side * 4 : 0), "#ffe7c2", 1.6));
    }
  }
  if (B.length) {
    const bm = new THREE.Mesh(merge(B), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.15 }));
    bm.castShadow = true; bm.receiveShadow = true; bm.userData.cast = true;
    grp.add(bm);
  }
  // the tunnel: walls, ceiling and portals over the bored part
  const T: G[] = [];
  let inside = false, start = 0;
  const bore: [number, number][] = [];
  for (let y = TUNNEL.yA; y >= TUNNEL.yB; y -= 10) {
    const on = !isNaN(tunnelAt(TUNNEL.x, y));
    if (on && !inside) { inside = true; start = y; }
    if (!on && inside) { inside = false; bore.push([start, y + 10]); }
  }
  if (inside) bore.push([start, TUNNEL.yB]);
  const half = ROAD / 2 + 6;
  for (const [ya, yb] of bore) {
    for (let y = ya; y > yb; y -= 20) {
      const y1 = Math.max(yb, y - 20), f0 = tunnelFloor(y), f1 = tunnelFloor(y1), ym = (y + y1) / 2, fm = (f0 + f1) / 2;
      const pitch = Math.atan2(f1 - f0, y - y1);
      for (const side of [-1, 1]) T.push(beam(22, TUNNEL.clear + 6, 10, TUNNEL.x + side * (half + 5), fm + TUNNEL.clear / 2, ym, Math.PI / 2, "#a7a39b", -pitch));
      T.push(beam(22, 5, half * 2 + 20, TUNNEL.x, fm + TUNNEL.clear + 2.5, ym, Math.PI / 2, "#77736c", -pitch));
      L.push(beam(18, 0.6, 3, TUNNEL.x, fm + TUNNEL.clear - 0.4, ym, Math.PI / 2, "#ffe0a8", -pitch));
    }
    for (const yp of [ya, yb]) {
      const f = tunnelFloor(yp), top = Math.max(f + TUNNEL.clear + 20, terrainH(TUNNEL.x, yp + (yp === ya ? -40 : 40)) + 10);
      const hgt = top - f, side = 70;
      T.push(box(side, hgt, 8, TUNNEL.x - half - side / 2, f + hgt / 2, yp, "#b8b2a6"), box(side, hgt, 8, TUNNEL.x + half + side / 2, f + hgt / 2, yp, "#b8b2a6"));
      T.push(box(half * 2, hgt - TUNNEL.clear, 8, TUNNEL.x, f + TUNNEL.clear + (hgt - TUNNEL.clear) / 2, yp, "#b8b2a6"));
      T.push(box(half * 2 + side * 2 + 4, 3, 10, TUNNEL.x, top, yp, "#8f897d"), box(half * 2, 2, 9, TUNNEL.x, f + TUNNEL.clear + 1, yp, "#d9b23a"));
    }
  }
  if (T.length) { const tm = new THREE.Mesh(merge(T), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })); tm.receiveShadow = true; grp.add(tm); }
  if (L.length) grp.add(new THREE.Mesh(merge(L), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  if (S.length) grp.add(new THREE.Mesh(merge(S), new THREE.MeshBasicMaterial({ vertexColors: true })));
  return grp;
}

// ---------------------------------------------------------------- ramps (wood, steel, concrete)
function rampTex(kind: "wood" | "steel" | "concrete") {
  const t = canvasTex(256, 256, (g) => {
    const r = mulberry32(kind.length * 31);
    if (kind === "wood") {
      for (let i = 0; i < 8; i++) {
        const base = 120 + Math.floor(r() * 40);
        g.fillStyle = `rgb(${base + 40},${base},${base - 50})`; g.fillRect(0, i * 32, 256, 30);
        g.strokeStyle = "rgba(60,35,15,0.35)"; g.lineWidth = 1;
        for (let k = 0; k < 6; k++) { g.beginPath(); const y = i * 32 + 4 + r() * 22; g.moveTo(0, y); g.bezierCurveTo(80, y + r() * 6 - 3, 160, y + r() * 6 - 3, 256, y); g.stroke(); }
        g.fillStyle = "#2a1c10"; g.fillRect(0, i * 32 + 30, 256, 2);
        g.fillStyle = "#5a5a60"; for (const x of [20, 236]) { g.beginPath(); g.arc(x, i * 32 + 8, 2.2, 0, 7); g.arc(x, i * 32 + 22, 2.2, 0, 7); g.fill(); }
      }
    } else if (kind === "steel") {
      g.fillStyle = "#8d939c"; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < 256; x += 16) {
        g.save(); g.translate(x + 4, y + 8); g.rotate(0.7); g.fillStyle = "#b6bcc6"; g.fillRect(-1.5, -5, 3, 10); g.fillStyle = "#5f646c"; g.fillRect(1.5, -5, 1, 10); g.restore();
      }
      g.strokeStyle = "rgba(20,20,20,0.35)"; g.lineWidth = 9;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(60 + k * 40 + r() * 10, 0); g.lineTo(70 + k * 40 + r() * 10, 256); g.stroke(); } // tyre marks
    } else {
      g.fillStyle = "#a9a6a0"; g.fillRect(0, 0, 256, 256);
      const id = g.getImageData(0, 0, 256, 256);
      for (let i = 0; i < id.data.length; i += 4) { const v = (r() - 0.5) * 26; id.data[i] += v; id.data[i + 1] += v; id.data[i + 2] += v; }
      g.putImageData(id, 0, 0);
      g.fillStyle = "rgba(60,55,50,0.25)"; for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(r() * 256, r() * 256, 6 + r() * 20, 0, 7); g.fill(); }
      const tag = ["#ff3cac", "#2bf0ff", "#ffd23f", "#3dff8b"];
      g.lineWidth = 7; g.lineCap = "round";
      for (let k = 0; k < 3; k++) { g.strokeStyle = tag[k]; g.beginPath(); g.moveTo(30 + r() * 60, 60 + k * 60); for (let q = 0; q < 6; q++) g.lineTo(40 + q * 30 + r() * 20, 50 + k * 60 + r() * 30); g.stroke(); }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function rampsMesh(world: World): THREE.Group {
  const grp = new THREE.Group();
  const byKind: Record<string, G[]> = { wood: [], steel: [], concrete: [] };
  const D: G[] = [], E: G[] = [], SH: G[] = [];
  // quad with uv in ramp space (u across, v along the slope)
  const quad = (out: G[], p: number[][], uv: number[][]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([...uv[0], ...uv[1], ...uv[2], ...uv[0], ...uv[2], ...uv[3]], 2));
    g.computeVertexNormals();
    out.push(withColor(g, C("#ffffff")));
  };
  for (const rp of world.ramps as Ramp[]) {
    const { l, w, h, base } = rp;
    const kind = rp.kind;
    // local frame: s along the ramp (0 low end), v across (0..w); world position:
    const P = (s: number, z: number, v: number) => {
      const sa = rp.rising > 0 ? s : l - s;
      return rp.alongX ? [rp.x0 + sa, base + z + 0.3, rp.y0 + v] : [rp.x0 + v, base + z + 0.3, rp.y0 + sa];
    };
    const out = byKind[kind];
    const top = (s: number) => (h * s) / l;
    // surface (with a little thickness at the lip so it never looks paper thin)
    quad(out, [P(0, 0, 0), P(l, h, 0), P(l, h, w), P(0, 0, w)], [[0, 0], [0, l / 40], [w / 40, l / 40], [w / 40, 0]]);
    // closed side walls and the back
    for (const v of [0, w]) quad(out, [P(0, 0, v), P(l, 0, v), P(l, h, v), P(l * 0.999, top(l * 0.999), v)], [[0, 0], [l / 40, 0], [l / 40, h / 40], [l / 40, h / 40]]);
    quad(out, [P(l, 0, 0), P(l, 0, w), P(l, h, w), P(l, h, 0)], [[0, 0], [w / 40, 0], [w / 40, h / 40], [0, h / 40]]);
    const a = rp.alongX ? (rp.rising > 0 ? 0 : Math.PI) : (rp.rising > 0 ? Math.PI / 2 : -Math.PI / 2);
    // under structure: posts and cross braces for wood and steel
    if (kind !== "concrete") {
      const col = kind === "wood" ? "#6a4a2a" : "#3a3f48";
      for (const s of [l * 0.35, l * 0.7, l - 3]) for (const v of [4, w - 4]) {
        const p = P(s, 0, v);
        D.push(box(kind === "wood" ? 3 : 2.2, top(s), kind === "wood" ? 3 : 2.2, p[0], base + top(s) / 2, p[2], col));
      }
      const pm = P(l * 0.6, 0, w / 2);
      D.push(beam(w - 6, 1.6, 1.6, pm[0], base + top(l * 0.45), pm[2], a + Math.PI / 2, col));
    }
    // warning stripes on the steel lip, curb edge on concrete
    if (kind === "steel") for (let k = 0; k < 8; k++) { const p = P(l - 2, h + 0.15, (k + 0.5) * (w / 8)); D.push(beam(4, 0.4, w / 8 - 0.3, p[0], p[1], p[2], a, k % 2 ? "#15161b" : "#ffd23f")); }
    if (kind === "concrete" && rp.bld) for (const v of [0, w]) {
      // garage ramp: low walls on both sides
      for (let s = 0; s < l; s += 20) { const p = P(s + 10, 0, v); D.push(beam(20.4, 7, 2.5, p[0], base + top(s + 10) + 3.5, p[2], a, "#bdb8ae", Math.atan2(h, l) * (rp.rising > 0 ? 1 : -1) * (rp.alongX ? 1 : -1))); }
    }
    // arrow on the ground in front, reflector posts at the low corners, a soft shadow
    if (rp.jump) {
      const pa = P(-26, 0, w / 2);
      const g = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-9, -5), new THREE.Vector2(3, -5), new THREE.Vector2(3, -10), new THREE.Vector2(13, 0), new THREE.Vector2(3, 10), new THREE.Vector2(3, 5), new THREE.Vector2(-9, 5)]));
      g.rotateX(-Math.PI / 2); g.rotateY(-a); g.translate(pa[0], terrainH(pa[0], pa[2]) + 0.5, pa[2]);
      E.push(withColor(g, C("#f4f4f6"), 1.2));
      for (const v of [-3, w + 3]) {
        const p = P(-2, 0, v);
        D.push(box(1.5, 10, 1.5, p[0], base + 5, p[2], "#f4f4f6"));
        E.push(box(1.7, 2.2, 1.7, p[0], base + 9, p[2], "#ff8a1a", 2));
      }
      const sh = new THREE.PlaneGeometry(1, 1); sh.rotateX(-Math.PI / 2);
      const pc = P(l * 0.7, 0, w / 2);
      sh.scale(rp.alongX ? l * 0.9 : w + 14, 1, rp.alongX ? w + 14 : l * 0.9); sh.translate(pc[0], base + 0.25, pc[2]);
      SH.push(sh);
    }
  }
  for (const k of ["wood", "steel", "concrete"] as const) {
    if (!byKind[k].length) continue;
    const m = new THREE.Mesh(merge(byKind[k]), new THREE.MeshStandardMaterial({ map: rampTex(k), roughness: k === "steel" ? 0.45 : 0.85, metalness: k === "steel" ? 0.6 : 0, side: THREE.DoubleSide }));
    m.castShadow = true; m.receiveShadow = true; m.userData.cast = true;
    grp.add(m);
  }
  if (D.length) { const m = new THREE.Mesh(merge(D), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 })); m.castShadow = true; m.userData.cast = true; grp.add(m); }
  if (E.length) grp.add(new THREE.Mesh(merge(E), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  if (SH.length) {
    const shadow = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, "rgba(0,0,0,0.5)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    const m = new THREE.Mesh(merge(SH), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false }));
    m.renderOrder = 1; grp.add(m);
  }
  return grp;
}

// ---------------------------------------------------------------- coast: beach, quay wall, promenade, cranes, ships
export function coastMesh(world: World): THREE.Mesh {
  const r = mulberry32(4711);
  const P: G[] = [];
  // harbour quay along the whole east side, concrete promenade along the south shore
  P.push(box(COAST.east - WORLD, 2.4, WORLD + 1700, (WORLD + COAST.east) / 2, 1.2, (WORLD - 1700) / 2 + 0, "#6e7177"));
  P.push(box(8, 40, WORLD + 1700, COAST.east - 2, -18, (WORLD - 1700) / 2, "#55575c"));
  P.push(box(4, 3, WORLD + 1700, COAST.east - 30, 1.5, (WORLD - 1700) / 2, "#d9b23a"));
  for (let y = -1600; y < WORLD; y += 90) P.push(cyl(2.4, 2.8, 5, COAST.east - 8, 4.4, y, "#2a2d36", 8));
  P.push(box(WORLD + 520, 1.6, COAST.south - WORLD, WORLD / 2 + 0, 0.8, (WORLD + COAST.south) / 2, "#b4aa96"));
  P.push(box(8, 40, 8, -230, -18, COAST.south, "#55575c"));
  P.push(box(WORLD + 500, 30, 8, WORLD / 2, -14, COAST.south - 2, "#55575c"));
  for (let x = 0; x < WORLD; x += 30) P.push(box(1, 6, 1, x, 4, COAST.south - 6, "#c9ced8"));
  P.push(box(WORLD, 1.2, 1.4, WORLD / 2, 7, COAST.south - 6, "#c9ced8"));
  // beach umbrellas and loungers
  const UMB = ["#ff3cac", "#2bf0ff", "#ffd23f", "#ff8a3d", "#3dff8b"];
  for (let i = 0; i < 70; i++) {
    const z = 60 + r() * (WORLD - 120);
    const x = -40 - r() * 190;
    if (world.nearRamp(x, z, 40) || isWater(x, z)) continue;
    P.push(cyl(0.8, 0.8, 22, x, 11, z, "#e8e8ec", 6), withColor(new THREE.ConeGeometry(15, 6, 10).translate(x, 24, z), C(UMB[i % UMB.length])));
    P.push(box(18, 2, 7, x + 12, 2, z + 4, "#f4f4f6"));
  }
  // cranes on the harbour quay
  for (const zc of [8.6 * BLOCK, 11 * BLOCK, 13.4 * BLOCK, 15.4 * BLOCK]) {
    const x = WORLD + 205;
    for (const dz of [-22, 22]) P.push(box(4, 120, 4, x - 18, 60, zc + dz, "#d98a1a"), box(4, 120, 4, x + 18, 60, zc + dz, "#d98a1a"));
    P.push(box(44, 6, 50, x, 122, zc, "#d98a1a"), box(230, 5, 6, x + 40, 128, zc, "#d98a1a"), box(12, 10, 12, x + 140, 118, zc, "#555"));
  }
  const m = new THREE.Mesh(merge(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  m.receiveShadow = true; m.castShadow = true; m.userData.cast = true;
  return m;
}

// ---------------------------------------------------------------- extras: containers, villas, the lighthouse, fences, rails, pools
export function extrasMesh(world: World): THREE.Group {
  const grp = new THREE.Group();
  const P: G[] = [], N: G[] = [], W: G[] = [];
  const sign = canvasTex(256, 128, (g) => {
    g.fillStyle = "#ffd23f"; g.fillRect(0, 0, 256, 128); g.strokeStyle = "#15161b"; g.lineWidth = 10; g.strokeRect(5, 5, 246, 118);
    g.fillStyle = "#15161b"; g.font = "bold 46px 'Bebas Neue', Impact, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("STEILKÜSTE", 128, 50);
    g.font = "bold 26px Inter, sans-serif"; g.fillText("Lebensgefahr!", 128, 94);
  });
  const signs: G[] = [];
  for (const e of world.extras as Building[]) {
    const b = e.base ?? 0, cx = e.x + e.w / 2, cy = e.y + e.h / 2, H = roofOf(e) - b;
    if (e.type === 28 || e.type === 30) continue; // ferris wheel, roundabout: landmarks3d
    if (e.type === 23) { // fence: posts and mesh
      P.push(box(e.w, H, e.h, cx, b + H / 2, cy, "#9aa3ad"));
      const L = Math.max(e.w, e.h);
      for (let k = 0; k <= L; k += 40) P.push(box(2, H + 4, 2, e.w > e.h ? e.x + k : cx, b + (H + 4) / 2, e.w > e.h ? cy : e.y + k, "#5f666e"));
    } else if (e.type === 22) { // guard rail and viewpoint at a highway end
      P.push(box(e.w, 3, e.h, cx, b + 5, cy, "#c9ced8"));
      const L = Math.max(e.w, e.h);
      for (let k = 6; k < L; k += 22) P.push(box(2, 6, 2, e.w > e.h ? e.x + k : cx, b + 3, e.w > e.h ? cy : e.y + k, "#7a7f88"));
      const sx = e.w > e.h ? e.x - 14 : cx, sy = e.w > e.h ? cy : e.y - 14;
      P.push(box(1.6, 30, 1.6, sx, b + 15, sy, "#7a7f88"));
      const g = new THREE.PlaneGeometry(24, 12); if (e.w > e.h) g.rotateY(Math.PI / 2); g.translate(sx, b + 30, sy);
      signs.push(g);
    } else if (e.type === 20) { // villa: white cube, big windows, flat roof terrace
      P.push(box(e.w, H, e.h, cx, b + H / 2, cy, "#f4efe6"), box(e.w + 6, 2, e.h + 6, cx, b + H + 1, cy, "#d9d2c4"));
      P.push(box(e.w * 0.5, H * 0.6, e.h * 0.6, cx + e.w * 0.2, b + H + H * 0.3, cy - e.h * 0.1, "#efe8db"));
      W.push(box(e.w + 0.6, H * 0.38, e.h * 0.7, cx, b + H * 0.42, cy, "#1b2838"));
      P.push(box(e.w + 30, 2, e.h + 30, cx, b + 0.6, cy, "#c9c0b0"));
    } else if (e.type === 24) { // lighthouse
      for (let k = 0; k < 6; k++) P.push(cyl(16 - k * 1.2, 17 - k * 1.2, H / 6, cx, b + (k + 0.5) * (H / 6), cy, k % 2 ? "#c0392b" : "#f4f1ea", 16));
      P.push(cyl(12, 12, 3, cx, b + H + 1.5, cy, "#2a2d36", 16), cyl(10, 10, 4, cx, b + H + 12, cy, "#2a2d36", 16), withColor(new THREE.ConeGeometry(11, 8, 16).translate(cx, b + H + 18, cy), C("#c0392b")));
      N.push(cyl(7, 7, 9, cx, b + H + 6, cy, "#fff3c4", 12));
    } else if (e.type === 21) { // island house
      P.push(box(e.w, H, e.h, cx, b + H / 2, cy, e.wall));
      const roof = new THREE.ConeGeometry(Math.hypot(e.w, e.h) * 0.55, 14, 4); roof.rotateY(Math.PI / 4); roof.scale(e.w / Math.hypot(e.w, e.h) * 1.4, 1, e.h / Math.hypot(e.w, e.h) * 1.4); roof.translate(cx, b + H + 7, cy);
      P.push(withColor(roof, C("#b5523a")));
      W.push(box(e.w + 0.6, 7, e.h * 0.4, cx, b + H * 0.5, cy, "#1b2838"));
    } else if (e.low && e.detail > 0) { // stacked containers
      const col = C(e.wall);
      for (let k = 0; k < e.detail; k++) P.push(box(e.w - 1, 25, e.h - 1, cx, b + 13 + k * 26, cy, col.clone().multiplyScalar(0.85 + 0.15 * ((k + e.seed * 3) % 1))));
    } else P.push(box(e.w, H, e.h, cx, b + H / 2, cy, e.wall));
  }
  for (const pl of world.pools) {
    P.push(box(pl.w + 8, 1.2, pl.h + 8, pl.x + pl.w / 2, pl.z + 0.2, pl.y + pl.h / 2, "#e8e4da"));
    N.push(box(pl.w, 0.4, pl.h, pl.x + pl.w / 2, pl.z + 0.9, pl.y + pl.h / 2, "#33c3e8", 0.9));
  }
  // stunt park: asphalt ground with a landing strip
  const sp = STUNT_PARK;
  P.push(box(sp.x1 - sp.x0, 0.6, sp.y1 - sp.y0, (sp.x0 + sp.x1) / 2, 0.3, (sp.y0 + sp.y1) / 2, "#4a4852"));
  for (let y = sp.y0 + 100; y < sp.y1 - 100; y += 60) P.push(box(6, 0.4, 30, (sp.x0 + sp.x1) / 2, 0.75, y, "#f4f4f6"));
  const m = new THREE.Mesh(merge(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  m.castShadow = true; m.receiveShadow = true; m.userData.cast = true;
  grp.add(m);
  if (W.length) grp.add(new THREE.Mesh(merge(W), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.8, envMapIntensity: 1.4 })));
  if (N.length) grp.add(new THREE.Mesh(merge(N), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  if (signs.length) grp.add(new THREE.Mesh(mergeGeometries(signs)!, new THREE.MeshBasicMaterial({ map: sign, side: THREE.DoubleSide })));
  return grp;
}

// ---------------------------------------------------------------- traffic lights (lamps are recoloured every frame)
export class LightsMesh {
  group = new THREE.Group();
  private lamps: THREE.InstancedMesh;
  private info: { i: number; j: number; alongX: boolean; k: number }[] = []; // k: 0 red, 1 yellow, 2 green
  private last = -1;
  private on = [new THREE.Color(4, 0.25, 0.2), new THREE.Color(4, 2.6, 0.3), new THREE.Color(0.3, 4, 1)];
  private off = [new THREE.Color(0.18, 0.03, 0.03), new THREE.Color(0.18, 0.13, 0.02), new THREE.Color(0.02, 0.15, 0.06)];
  constructor(layout: TrafficLights) {
    const P: G[] = [];
    const N = GRID + 1, pts: { x: number; z: number; y: number; i: number; j: number; alongX: boolean; face: number }[] = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!layout.has[j * N + i]) continue;
      const cx = i * BLOCK + ROAD / 2, cy = j * BLOCK + ROAD / 2, o = ROAD / 2 + 8;
      // one pole at each corner, its head faces the traffic that has to stop before it (right-hand traffic)
      for (const [px, py, alongX, face] of [[cx - o, cy + o, true, Math.PI], [cx + o, cy - o, true, 0], [cx - o, cy - o, false, -Math.PI / 2], [cx + o, cy + o, false, Math.PI / 2]] as [number, number, boolean, number][]) {
        P.push(cyl(1, 1.3, 34, px, 17, py, "#2a2d36", 6));
        P.push(beam(4, 15, 5, px, 30, py, face, "#15161b"));
        pts.push({ x: px + Math.cos(face) * 2.4, z: 30, y: py + Math.sin(face) * 2.4, i, j, alongX, face });
      }
    }
    this.group.add(new THREE.Mesh(merge(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })));
    this.lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(1.7, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), pts.length * 3);
    const m = new THREE.Matrix4();
    let n = 0;
    for (const p of pts) for (let k = 0; k < 3; k++) {
      m.makeTranslation(p.x, p.z + 4.5 - k * 4.5, p.y);
      this.lamps.setMatrixAt(n, m); this.lamps.setColorAt(n, this.off[k]);
      this.info.push({ i: p.i, j: p.j, alongX: p.alongX, k });
      n++;
    }
    this.group.add(this.lamps);
  }
  update(lights: TrafficLights) {
    const key = Math.floor(lights.t * 4);
    if (key === this.last) return;
    this.last = key;
    for (let n = 0; n < this.info.length; n++) {
      const f = this.info[n], ph = lights.phase(f.i, f.j);
      const state = f.alongX ? (ph === 0 ? 2 : ph === 1 ? 1 : 0) : (ph === 2 ? 2 : ph === 3 ? 1 : 0);
      this.lamps.setColorAt(n, state === f.k ? this.on[f.k] : this.off[f.k]);
    }
    this.lamps.instanceColor!.needsUpdate = true;
  }
}
void EDGE_LAND; void edgeDist; void MAP_MAX; void H_SCALE;

// ---------------------------------------------------------------- street furniture on the sidewalks
// benches, bins, hydrants, letter boxes and bus shelters (decoration: people and cars pass through them)
export function furnitureMesh(world: World): THREE.Group {
  const grp = new THREE.Group();
  const P: G[] = [], Gl: G[] = [];
  const stops = world.busStops();
  const nearStop = (x: number, y: number) => stops.some((s) => Math.hypot(s.x - x, s.y - y) < 40);
  const rot = (g: G, x: number, y: number, nx: number, ny: number) => { g.rotateY(Math.atan2(nx, ny)); g.translate(x, 0, y); return g; };
  const part = (w: number, h: number, d: number, ox: number, oy: number, oz: number, col: string) => withColor(new THREE.BoxGeometry(w, h, d).translate(ox, oy, oz), C(col));
  const pts = world.curbPoints();
  pts.forEach((c, i) => {
    if (nearStop(c.x, c.y)) return;
    const k = (i * 2654435761) >>> 0;
    // local frame: +z towards the street
    if (k % 19 === 0) { // bench facing the street
      for (const g of [part(16, 1, 5, 0, 5, 0, "#8a5a3a"), part(16, 5, 1, 0, 8, -2.6, "#8a5a3a"), part(1, 5, 4, -7, 2.5, 0, "#3a3d45"), part(1, 5, 4, 7, 2.5, 0, "#3a3d45")]) P.push(rot(g, c.x - c.nx * 3, c.y - c.ny * 3, c.nx, c.ny));
    } else if (k % 13 === 4) { // litter bin
      P.push(rot(withColor(new THREE.CylinderGeometry(2.6, 2.2, 8, 10).translate(0, 4, 0), C("#2f6b3a")), c.x, c.y, c.nx, c.ny), rot(part(1, 10, 1, 0, 5, -3, "#3a3d45"), c.x, c.y, c.nx, c.ny));
    } else if (k % 23 === 6) { // hydrant
      P.push(rot(withColor(mergeGeometries([new THREE.CylinderGeometry(1.5, 1.8, 6, 10).translate(0, 3, 0), new THREE.SphereGeometry(1.5, 10, 6).translate(0, 6, 0), new THREE.CylinderGeometry(0.6, 0.6, 4.4, 6).rotateZ(Math.PI / 2).translate(0, 4, 0)])!, C("#c0392b")), c.x, c.y, c.nx, c.ny));
    } else if (k % 37 === 9) { // letter box on a post
      P.push(rot(part(5, 7, 4, 0, 10, 0, "#f1c40f"), c.x - c.nx * 2, c.y - c.ny * 2, c.nx, c.ny), rot(part(1, 7, 1, 0, 3.5, 0, "#3a3d45"), c.x - c.nx * 2, c.y - c.ny * 2, c.nx, c.ny), rot(part(3, 0.6, 0.4, 0, 12, 2.1, "#1b1b1f"), c.x - c.nx * 2, c.y - c.ny * 2, c.nx, c.ny));
    }
  });
  // bus stops: shelter with glass back wall, roof, bench, the H sign on a pole
  for (const s of stops) {
    const r = (g: G) => rot(g, s.x - s.nx * 2, s.y - s.ny * 2, s.nx, s.ny);
    for (const g of [part(1, 22, 1, -12, 11, -5, "#5f666e"), part(1, 22, 1, 12, 11, -5, "#5f666e"), part(1, 22, 1, -12, 11, 5, "#5f666e"), part(1, 22, 1, 12, 11, 5, "#5f666e"), part(28, 1.2, 13, 0, 22.5, 0, "#3a3d45"), part(20, 1, 4, 0, 5, -3, "#8a5a3a"), part(1.2, 26, 1.2, 15, 13, 5, "#5f666e"), part(5, 5, 0.6, 15, 27, 5, "#1d8a4a"), part(3, 3, 0.7, 15, 27, 5.1, "#f1c40f")]) P.push(r(g));
    Gl.push(r(part(24, 16, 0.5, 0, 12, -5, "#cfe6f2")), r(part(0.5, 16, 9, -12, 12, 0, "#cfe6f2")));
  }
  if (P.length) { const m = new THREE.Mesh(merge(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 })); m.castShadow = true; m.receiveShadow = true; m.userData.cast = true; grp.add(m); }
  if (Gl.length) grp.add(new THREE.Mesh(merge(Gl), new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false })));
  return grp;
}
