// the landmarks: town hall with its clock tower, the Vale Tower, the ferris wheel on the promenade,
// the stadium, the lighthouse beam and the roundabout in the centre
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { box, cyl, C, canvasTex, withColor } from "./meshutil";
import { FERRIS, ROUNDABOUT, roofOf, type Building, type World } from "../world/world";

type G = THREE.BufferGeometry;
const merge = (l: G[]) => { const m = mergeGeometries(l)!; for (const g of l) g.dispose(); return m; };
const lit = (l: G[]) => new THREE.Mesh(merge(l), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));

export class Landmarks {
  group = new THREE.Group();
  private hands: { h: THREE.Object3D; m: THREE.Object3D }[] = [];
  private wheel: THREE.Group | null = null;
  private beam: THREE.Mesh | null = null; private beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  private blink: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.2), toneMapped: false });
  private nightMats: THREE.MeshBasicMaterial[] = [];
  private mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 });

  constructor(world: World, scene: THREE.Scene) {
    for (const blk of world.blocks) for (const b of blk.buildings) {
      if (b.type === 25) this.townHall(b);
      else if (b.type === 26) this.clockTower(b);
      else if (b.type === 27) this.stadium(b);
      else if (b.type === 29) this.valeTower(b);
    }
    for (const e of world.extras) if (e.type === 24) this.lighthouseBeam(e);
    this.ferris();
    this.roundabout(world);
    scene.add(this.group);
  }
  // the generic city drawing leaves these out
  static owns(b: Building) { return b.type === 25 || b.type === 26 || b.type === 27 || b.type === 29; }

  private add(P: G[], cast = true, mat: THREE.Material = this.mat) {
    if (!P.length) return null;
    const m = new THREE.Mesh(merge(P), mat); m.castShadow = cast; m.receiveShadow = true; m.userData.cast = cast;
    this.group.add(m); return m;
  }

  // a stone hall with a portico of columns towards the square in front of it (south), copper roof
  private townHall(b: Building) {
    const H = roofOf(b), cx = b.x + b.w / 2, cy = b.y + b.h / 2, P: G[] = [], W: G[] = [];
    P.push(box(b.w, H, b.h, cx, H / 2, cy, "#e8dcc4"), box(b.w + 6, 4, b.h + 6, cx, 2, cy, "#cfc3aa"));
    for (const yy of [H * 0.35, H - 3]) P.push(box(b.w + 3, 2.5, b.h + 3, cx, yy, cy, "#d8cbb0"));
    // windows with round tops in two rows on all sides
    for (let x = b.x + 16; x < b.x + b.w - 10; x += 22) for (const yy of [H * 0.2, H * 0.6]) for (const zz of [b.y - 0.4, b.y + b.h + 0.4]) W.push(box(9, 14, 0.6, x, yy, zz, "#25303d"));
    // portico: steps, columns, pediment
    const fy = b.y + b.h, pw = b.w * 0.55;
    for (let k = 0; k < 4; k++) P.push(box(pw + 20 - k * 4, 1.5, 16 - k * 3, cx, 0.75 + k * 1.5, fy + 18 - k * 1.5, "#d8cbb0"));
    P.push(box(pw + 6, 3, 22, cx, H * 0.75 + 1.5, fy + 9, "#e8dcc4"));
    for (let k = 0; k < 8; k++) P.push(cyl(2.4, 2.8, H * 0.75 - 6, cx - pw / 2 + 4 + k * (pw - 8) / 7, (H * 0.75 - 6) / 2 + 6, fy + 16, "#f4ecda", 12));
    // pediment: a box whose top edge is pulled together in the middle (triangle seen from the front)
    const ped = new THREE.BoxGeometry(pw + 8, 14, 22), pp = ped.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) if (pp.getY(i) > 0) pp.setX(i, 0);
    ped.computeVertexNormals(); ped.translate(cx, H * 0.75 + 10, fy + 9);
    P.push(withColor(ped, C("#e8dcc4")));
    // copper roof
    const roof = new THREE.ConeGeometry(Math.hypot(b.w, b.h) * 0.52, 22, 4).rotateY(Math.PI / 4).scale(b.w / Math.hypot(b.w, b.h) * 1.42, 1, b.h / Math.hypot(b.w, b.h) * 1.42).translate(cx, H + 11, cy);
    P.push(withColor(roof, C("#5f9a86")));
    for (const sx of [-pw / 2 - 18, pw / 2 + 18]) P.push(cyl(0.6, 0.6, 40, cx + sx, 20, fy + 30, "#c9ced8", 6), box(10, 6, 0.4, cx + sx + 5, 37, fy + 30, sx < 0 ? "#2b6cb0" : "#e1b12c"));
    this.add(P);
    this.add(W, false, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.6 }));
  }

  // clock tower: four clock faces with hands that follow the game clock, belfry, spire
  private clockTower(b: Building) {
    const H = roofOf(b), cx = b.x + b.w / 2, cy = b.y + b.h / 2, s = b.w, P: G[] = [];
    P.push(box(s, H, s, cx, H / 2, cy, "#e8dcc4"));
    for (let k = 1; k < 6; k++) P.push(box(s + 2, 2, s + 2, cx, (H / 6) * k, cy, "#d8cbb0"));
    // belfry with open arches (corner pillars) and the spire
    const bh = 26;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push(box(6, bh, 6, cx + dx * (s / 2 - 3), H + bh / 2, cy + dz * (s / 2 - 3), "#e8dcc4"));
    P.push(box(s + 4, 3, s + 4, cx, H + bh + 1.5, cy, "#d8cbb0"), box(s * 0.5, 10, s * 0.5, cx, H + 6, cy, "#8a6a3a")); // bell
    P.push(withColor(new THREE.ConeGeometry(s * 0.72, 46, 4).rotateY(Math.PI / 4).translate(cx, H + bh + 26, cy), C("#5f9a86")));
    P.push(withColor(new THREE.SphereGeometry(2.2, 10, 8).translate(cx, H + bh + 51, cy), C("#e1b12c")));
    this.add(P);
    // clock faces
    const dial = canvasTex(256, 256, (g) => {
      g.fillStyle = "#f4efe0"; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
      g.lineWidth = 8; g.strokeStyle = "#2a2a30"; g.stroke();
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.lineWidth = k % 3 ? 4 : 9; g.beginPath(); g.moveTo(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100); g.lineTo(128 + Math.sin(a) * 118, 128 - Math.cos(a) * 118); g.stroke(); }
    });
    const dm = new THREE.MeshBasicMaterial({ map: dial, toneMapped: false, color: 0xd8d8d8 });
    this.nightMats.push(dm);
    const handM = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, metalness: 0.5, roughness: 0.4 });
    const y = H - s * 0.42;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2, nx = Math.sin(a), nz = Math.cos(a);
      const face = new THREE.Mesh(new THREE.CircleGeometry(s * 0.36, 32), dm);
      face.position.set(cx + nx * (s / 2 + 0.3), y, cy + nz * (s / 2 + 0.3)); face.rotation.y = a;
      const hg = new THREE.Group(), mg = new THREE.Group();
      hg.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, s * 0.2, 0.4).translate(0, s * 0.1, 0.6), handM));
      mg.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, s * 0.3, 0.4).translate(0, s * 0.15, 0.9), handM));
      face.add(hg, mg); this.group.add(face);
      this.hands.push({ h: hg, m: mg });
    }
  }

  // glass tower of Dorian Vale: blue-green glass, slim steel ribs, a slanted crown, a blinking antenna
  private valeTower(b: Building) {
    const H = roofOf(b), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x2c6a7a, metalness: 0.9, roughness: 0.06, envMapIntensity: 1.8, clearcoat: 1 });
    const g = new THREE.Mesh(new THREE.BoxGeometry(b.w, H, b.h).translate(cx, H / 2, cy), glass);
    g.castShadow = true; g.receiveShadow = true; this.group.add(g);
    const P: G[] = [];
    for (let x = b.x; x <= b.x + b.w + 0.1; x += b.w / 8) for (const z of [b.y - 0.3, b.y + b.h + 0.3]) P.push(box(0.8, H, 0.8, x, H / 2, z, "#b8c4cc"));
    for (let z = b.y; z <= b.y + b.h + 0.1; z += b.h / 8) for (const x of [b.x - 0.3, b.x + b.w + 0.3]) P.push(box(0.8, H, 0.8, x, H / 2, z, "#b8c4cc"));
    for (let y = 18; y < H; y += 18) P.push(box(b.w + 1, 0.6, b.h + 1, cx, y, cy, "#9aa6ae"));
    P.push(box(b.w + 8, 14, b.h + 8, cx, 7, cy, "#2a2d33")); // lobby
    // crown: a slanted glass top
    const crown = new THREE.BoxGeometry(b.w * 0.92, 40, b.h * 0.92); crown.translate(0, 20, 0);
    const pos = crown.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 20) pos.setY(i, pos.getY(i) + (pos.getX(i) > 0 ? 18 : -8));
    crown.computeVertexNormals(); crown.translate(cx, H, cy);
    const cm = new THREE.Mesh(crown, glass); this.group.add(cm);
    P.push(cyl(0.8, 1.4, 60, cx - b.w * 0.2, H + 78, cy, "#c9ced8", 6));
    this.add(P);
    const ant = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), this.blink); ant.position.set(cx - b.w * 0.2, H + 109, cy); this.group.add(ant);
    // the name on two sides
    const t = canvasTex(512, 128, (q) => { q.clearRect(0, 0, 512, 128); q.fillStyle = "#e8f4ff"; q.font = "bold 92px 'Bebas Neue', Impact, sans-serif"; q.textAlign = "center"; q.textBaseline = "middle"; q.fillText("VALE", 256, 70); });
    const nm = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false });
    this.nightMats.push(nm);
    for (const [x, z, a] of [[b.x - 0.8, cy, -Math.PI / 2], [cx, b.y + b.h + 0.8, 0]] as [number, number, number][]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(b.w, b.h) * 0.8, Math.min(b.w, b.h) * 0.2), nm);
      m.position.set(x, H - 24, z); m.rotation.y = a; this.group.add(m);
    }
  }

  // stadium: oval stands sloping inwards, the pitch, floodlights
  private stadium(b: Building) {
    const H = roofOf(b), cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2, rz = b.h / 2, P: G[] = [], L: G[] = [];
    const ring = (r0: number, r1: number, y0: number, y1: number, col: string, seg = 48) => {
      const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 1, true); g.scale(1, 1, rz / rx); g.translate(cx, (y0 + y1) / 2, cy);
      return withColor(g, C(col));
    };
    P.push(ring(rx, rx, 0, H, "#d9d6cf"));                       // outer wall
    P.push(ring(rx * 0.62, rx * 0.97, 4, H - 2, "#8a8f98"));     // stands
    for (let k = 1; k < 6; k++) P.push(ring(rx * (0.62 + k * 0.065) - 0.5, rx * (0.62 + k * 0.065) + 0.5, 4 + k * (H - 6) / 6, 5 + k * (H - 6) / 6, k % 2 ? "#c0392b" : "#2e6da4"));
    const pitch = new THREE.CircleGeometry(rx * 0.62, 40).rotateX(-Math.PI / 2).scale(1, 1, rz / rx).translate(cx, 3, cy);
    P.push(withColor(pitch, C("#3c8a4a")));
    P.push(box(rx * 0.8, 0.3, 1, cx, 3.3, cy - rz * 0.3, "#f4f4f6"), box(rx * 0.8, 0.3, 1, cx, 3.3, cy + rz * 0.3, "#f4f4f6"), box(1, 0.3, rz * 0.6, cx - rx * 0.4, 3.3, cy, "#f4f4f6"), box(1, 0.3, rz * 0.6, cx + rx * 0.4, 3.3, cy, "#f4f4f6"), box(1, 0.3, rz * 0.6, cx, 3.3, cy, "#f4f4f6"));
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = cx + dx * rx * 0.78, z = cy + dz * rz * 0.78;
      P.push(cyl(1.6, 2.4, H + 60, x, (H + 60) / 2, z, "#7a7f88", 8), box(18, 10, 3, x, H + 62, z, "#3a3d45"));
      L.push(box(16, 8, 0.6, x - dx * 0.5, H + 62, z - dz * 2, "#fffbe0"));
    }
    this.add(P, true, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
    const lm = lit(L); this.nightMats.push(lm.material as THREE.MeshBasicMaterial); this.group.add(lm);
  }

  // the lighthouse turns a beam at night
  private lighthouseBeam(e: Building) {
    const top = roofOf(e) + 6, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const g = new THREE.ConeGeometry(60, 700, 16, 1, true).translate(0, -350, 0).rotateZ(Math.PI / 2);
    this.beam = new THREE.Mesh(g, this.beamMat);
    this.beam.position.set(cx, top, cy); this.beam.renderOrder = 4;
    this.group.add(this.beam);
  }

  // ferris wheel: A-frame, two rims with spokes, 16 gondolas that hang straight down
  private gondolas: THREE.Object3D[] = [];
  private ferris() {
    const R = FERRIS.r, hub = R + 14, x = FERRIS.x, y = FERRIS.y, P: G[] = [];
    for (const dz of [-1, 1]) for (const dx of [-1, 1]) {
      const g = new THREE.CylinderGeometry(1.4, 2, Math.hypot(hub, R * 0.5), 8); g.rotateX(-dx * Math.atan2(R * 0.5, hub)); g.translate(x + dz * 12, hub / 2, y + dx * R * 0.25);
      P.push(withColor(g, C("#e8e8ec")));
    }
    P.push(withColor(new THREE.CylinderGeometry(2, 2, 26, 10).rotateZ(Math.PI / 2).translate(x, hub, y), C("#9aa0a8")));
    this.add(P);
    const wheel = new THREE.Group(); wheel.position.set(x, hub, y);
    const W: G[] = [], Lt: G[] = [];
    for (const sx of [-9, 9]) {
      W.push(withColor(new THREE.TorusGeometry(R, 1.1, 6, 64).rotateY(Math.PI / 2).translate(sx, 0, 0), C("#f4f4f6")));
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const g = new THREE.BoxGeometry(0.8, R, 0.8).translate(0, R / 2, 0).rotateX(a).translate(sx, 0, 0); W.push(withColor(g, C("#d8d8dc"))); }
    }
    for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2; Lt.push(box(1.6, 1.6, 1.6, 0, Math.cos(a) * (R + 1.5), Math.sin(a) * (R + 1.5), ["#ff3cac", "#2bf0ff", "#ffd23f"][k % 3])); }
    const wm = new THREE.Mesh(merge(W), this.mat); wm.castShadow = true; wheel.add(wm);
    const lm = lit(Lt); this.nightMats.push(lm.material as THREE.MeshBasicMaterial); wheel.add(lm);
    const cols = ["#c0392b", "#2e6da4", "#e1b12c", "#16a085", "#8e44ad", "#e67e22"];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, gd = new THREE.Group();
      gd.position.set(0, Math.cos(a) * R, Math.sin(a) * R);
      const cab = new THREE.Mesh(merge([box(10, 8, 9, 0, -6, 0, cols[k % cols.length]), box(10.6, 1, 9.6, 0, -1.8, 0, "#f4f4f6"), box(1, 3, 1, 0, -0.5, 0, "#9aa0a8")]), this.mat);
      gd.add(cab); wheel.add(gd); this.gondolas.push(gd);
    }
    this.group.add(wheel);
    this.wheel = wheel;
  }

  // the island with a fountain, a ring of paving and the road markings around it
  private roundabout(world: World) {
    const n = world.nodePos(ROUNDABOUT.i, ROUNDABOUT.j), P: G[] = [];
    P.push(cyl(ROUNDABOUT.r + 2, ROUNDABOUT.r + 2, 1.6, n.x, 1.0, n.y, "#c9c3b5", 40), cyl(ROUNDABOUT.r - 2, ROUNDABOUT.r - 2, 1.8, n.x, 1.2, n.y, "#4c7a3a", 40));
    P.push(cyl(12, 13, 2.4, n.x, 2.2, n.y, "#d8d2c6", 24), cyl(10.5, 10.5, 0.6, n.x, 3.2, n.y, "#1aa6c9", 24, 0.9), cyl(1.6, 2.4, 14, n.x, 8, n.y, "#d0ccdc", 10), withColor(new THREE.SphereGeometry(3, 12, 8).translate(n.x, 16, n.y), C("#e1b12c")));
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; P.push(withColor(new THREE.SphereGeometry(3.5, 8, 6).scale(1, 0.7, 1).translate(n.x + Math.cos(a) * 22, 3, n.y + Math.sin(a) * 22), C(k % 2 ? "#e84393" : "#fdcb6e"))); }
    // dashed lane line around the island and give-way lines at the four entries
    for (let k = 0; k < 36; k++) { if (k % 2) continue; const a = (k / 36) * Math.PI * 2; P.push(box(1.2, 0.2, 8, n.x + Math.cos(a) * 73, 0.65, n.y + Math.sin(a) * 73, "#f4f4f6", 1, -a)); }
    this.add(P, false);
  }

  update(clock: number, night: number, t: number, dt: number) {
    const hh = (clock % 12) / 12, mm = clock % 1;
    for (const h of this.hands) { h.h.rotation.z = -hh * Math.PI * 2; h.m.rotation.z = -mm * Math.PI * 2; }
    if (this.wheel) {
      this.wheel.rotation.x += dt * 0.06;
      for (const gd of this.gondolas) gd.rotation.x = -this.wheel.rotation.x; // cabins hang down
    }
    if (this.beam) { this.beam.rotation.y = t * 0.8; this.beam.visible = night > 0.3; this.beamMat.opacity = 0.22 * night; }
    this.blink.color.setRGB(Math.sin(t * 3) > 0.6 ? 4 : 0.3, 0.1, 0.1);
    const k = 0.35 + night * 0.9;
    for (const m of this.nightMats) m.color.setScalar(k);
  }
}
