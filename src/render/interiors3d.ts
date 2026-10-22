// the walkable shops on screen: walls you can see through from inside, a door that opens, furniture,
// the clerk and a few customers, a mirror in the boutique, the lift in the workshop, cars on turntables,
// the mall with its upper floor and escalators
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { box, cyl, C, canvasTex, withColor } from "./meshutil";
import { HumanRig, lookFromSeed } from "../characters/human";
import type { Interior, Prop } from "../world/interiors";
import type { Building } from "../world/world";
import { furniture, floorTex, wallTex, type Parts } from "./furniture";
import type { Game } from "../core/engine";

const FLOOR_Y = 2.6;
// rooms without their own look (see Interior.floor / wallTex)
const FLOORS: Record<string, string> = { gun: "#5a5a60", boutique: "#d8cbb8", taco: "#b0743a", burger: "#c9c3b5", workshop: "#6a6a70", safehouse: "#8a6a4a", market: "#d8d8d2", cardealer: "#e8e8ec", barber: "#2a2a30", mall: "#cfc9bd" };
const WALLS: Record<string, string> = { gun: "#3a3d45", boutique: "#f2e6ee", taco: "#f2c14e", burger: "#e8e8ec", workshop: "#8f8b84", safehouse: "#d8d0c4", market: "#f4f4f0", cardealer: "#f4f6f8", barber: "#3a2a3a", mall: "#ece6dc" };

interface Room {
  it: Interior; group: THREE.Group; roof: THREE.Mesh; walls: { m: THREE.Mesh; mat: THREE.MeshStandardMaterial; b: Building }[]; tower: THREE.Mesh | null;
  doors: THREE.Mesh[]; doorOpen: number; gate?: THREE.Mesh;
  people: { rig: HumanRig; anim: string }[] | null; clerk: HumanRig | null;
  targets: THREE.Mesh[]; mirror: Reflector | null; lift: THREE.Mesh | null; liftH: number;
  lightK: number; // bright rooms (white walls and floors) get less light, so they do not glare
  tables: THREE.Group[]; steps: THREE.Texture | null; inner: THREE.Group; lamps: THREE.Mesh; upperMat: THREE.MeshStandardMaterial | null;
}

export class InteriorsRenderer {
  private rooms: Room[] = [];
  private light = new THREE.PointLight(0xfff1dc, 0, 260, 1.6);
  private propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 });
  private glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  private glassMat = new THREE.MeshPhysicalMaterial({ color: 0xbfd8e6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  private fGlassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.4, depthWrite: false });
  private texCache = new Map<string, THREE.Texture>();
  private tex(kind: "floor" | "wall", style: string, col: string) {
    const key = kind + style + col;
    let t = this.texCache.get(key);
    if (!t) { t = kind === "floor" ? floorTex(style, col) : wallTex(style, col); t.wrapS = t.wrapT = THREE.RepeatWrapping; this.texCache.set(key, t); }
    return t;
  }
  liftY = 0; // how far the player's car is lifted in the workshop (the renderer adds it to the car)

  constructor(private scene: THREE.Scene, interiors: Interior[], private carModel: (model: string, color: string) => THREE.Object3D | null, private setup: (o: THREE.Object3D) => void) {
    scene.add(this.light);
    for (const it of interiors) this.rooms.push(this.build(it));
  }

  private sign(text: string, color: string, w = 512, h = 96) {
    const t = canvasTex(w, h, (g) => {
      g.fillStyle = color; g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, h - 10, w, 10);
      g.fillStyle = "#ffffff"; g.font = `bold ${Math.round(h * 0.5)}px Inter, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(text, w / 2, h / 2 - 2, w - 24);
    });
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private build(it: Interior): Room {
    const group = new THREE.Group(), inner = new THREE.Group();
    group.add(inner);
    const cx = (it.x0 + it.x1) / 2, cy = (it.y0 + it.y1) / 2, W = it.x1 - it.x0, L = it.y1 - it.y0;
    const P: THREE.BufferGeometry[] = [], G: THREE.BufferGeometry[] = [], Lamp: THREE.BufferGeometry[] = [], Up: THREE.BufferGeometry[] = [];
    const parts: Parts = { std: [], glow: [], glass: [] }, extra: THREE.Object3D[] = [];
    // the floor (textured: wood, tiles, marble, ...) and ceiling lights (they hang under the roof: hidden with it while you are inside)
    const [fs, fc] = it.floor ?? ["paint", FLOORS[it.kind] ?? "#cfc9bd"];
    const ftex = this.tex("floor", fs, fc).clone(); ftex.needsUpdate = true; ftex.repeat.set((W + 8) / 90, (L + 8) / 90);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 8, 0.6, L + 8).translate(cx, FLOOR_Y, cy), new THREE.MeshStandardMaterial({ map: ftex, roughness: fs === "marble" || fs === "tile" ? 0.55 : 0.8, metalness: 0.02 }));
    floor.receiveShadow = true; inner.add(floor);
    for (let x = it.x0 + 25; x < it.x1 - 10; x += 45) for (let y = it.y0 + 25; y < it.y1 - 10; y += 45) Lamp.push(box(16, 0.4, 5, x, it.H - 1.4, y, "#fff6e0"));
    // walls: one mesh and material each, so the ones between the camera and you can fade out
    const [ws, wc] = it.wallTex ?? ["paint", WALLS[it.kind] ?? "#e8e2d6"];
    const wtex = this.tex("wall", ws, wc);
    const walls: Room["walls"] = [];
    for (const b of it.walls) {
      if (b.low) continue;
      const H = it.H, geo = new THREE.BoxGeometry(b.w, H, b.h);
      // texture in world units (one tile = 60 units) on every face
      const uv = geo.attributes.uv as THREE.BufferAttribute, size = [[b.h, H], [b.h, H], [b.w, b.h], [b.w, b.h], [b.w, H], [b.w, H]];
      for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * size[f][0] / 60, uv.getY(i) * size[f][1] / 60); }
      geo.translate(b.x + b.w / 2, H / 2, b.y + b.h / 2);
      const mat = new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.85, transparent: true, opacity: 1 });
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      group.add(m); walls.push({ m, mat, b });
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 10, 2, L + 10).translate(cx, it.H + 1, cy), new THREE.MeshStandardMaterial({ color: "#6a6a70", roughness: 0.9 }));
    roof.castShadow = true; group.add(roof);
    // the apartment tower: the storeys above the ground floor (seen from outside)
    let tower: THREE.Mesh | null = null;
    if (it.kind === "tower") {
      const th = 300, ft = canvasTex(256, 256, (g) => {
        g.fillStyle = "#d8cfc2"; g.fillRect(0, 0, 256, 256);
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
          g.fillStyle = (i * 7 + j * 3) % 5 === 0 ? "#ffe2a8" : "#3a5a7a"; g.fillRect(i * 64 + 10, j * 64 + 12, 44, 36);
          g.fillStyle = "#b8ad9e"; g.fillRect(i * 64 + 6, j * 64 + 50, 52, 5);
        }
      });
      ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(Math.round((W + 10) / 60), Math.round(th / 60));
      tower = new THREE.Mesh(new THREE.BoxGeometry(W + 10, th, L + 10).translate(cx, it.H + 2 + th / 2, cy), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.7 }));
      tower.castShadow = true; group.add(tower);
    }
    // street side: sign, awning, shop windows next to the door
    const d = it.door, fx = d.x - 0.6;
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(L * 0.8, 110), 12), new THREE.MeshBasicMaterial({ map: this.sign(it.name, it.color), toneMapped: false }));
    sg.position.set(fx - 0.4, Math.min(it.H - 8, 34), d.y); sg.rotation.y = -Math.PI / 2;
    group.add(sg);
    if (it.kind !== "workshop") {
      P.push(box(10, 1, Math.min(L * 0.7, 90), fx - 5, 24, d.y, it.color));
      for (const s of [-1, 1]) {
        const wy = d.y + s * (d.w / 2 + 20);
        if (wy - 16 > it.y0 && wy + 16 < it.y1) G.push(box(0.6, 16, 30, fx - 0.2, 12, wy, "#cfe6f2", 0.35));
      }
    }
    // the door: two glass panels that slide apart (workshop: a roller gate)
    const doors: THREE.Mesh[] = [];
    let gate: THREE.Mesh | undefined;
    if (it.kind === "workshop") {
      gate = new THREE.Mesh(new THREE.BoxGeometry(1, it.H - 6, d.w), new THREE.MeshStandardMaterial({ color: "#9aa0a8", metalness: 0.5, roughness: 0.4 }));
      gate.position.set(fx + 1, (it.H - 6) / 2, d.y); group.add(gate);
    } else for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 22, d.w / 2), this.glassMat);
      m.position.set(fx + 1.5, 11, d.y + s * d.w / 4); m.userData.s = s; group.add(m); doors.push(m);
    }
    // furniture
    const targets: THREE.Mesh[] = [];
    let seed = it.id.length * 131;
    for (const p of it.props) {
      if (p.k.startsWith("f:")) furniture({ k: p.k.slice(2), x: p.x, y: p.y, w: p.w, d: p.d, a: p.a, z: p.z, c: p.c, c2: p.c2 }, parts, seed++, extra, it.H, FLOOR_Y);
      else this.prop(p, P, G, inner);
    }
    for (const o of extra) inner.add(o);
    if (parts.std.length) { const m = new THREE.Mesh(mergeGeometries(parts.std)!, this.propMat); m.castShadow = true; m.receiveShadow = true; inner.add(m); for (const g of parts.std) g.dispose(); }
    if (parts.glow.length) { const m = new THREE.Mesh(mergeGeometries(parts.glow)!, this.glowMat); inner.add(m); for (const g of parts.glow) g.dispose(); }
    if (parts.glass.length) { const m = new THREE.Mesh(mergeGeometries(parts.glass)!, this.fGlassMat); inner.add(m); for (const g of parts.glass) g.dispose(); }
    if (it.range) for (const t of it.range.targets) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 12, 9).translate(0, 6, 0), new THREE.MeshStandardMaterial({ map: this.targetTex(), roughness: 0.7 }));
      m.position.set(t.x, FLOOR_Y + 4, t.y); m.rotation.z = -1.4; inner.add(m); targets.push(m);
      P.push(box(1, 4, 1, t.x, FLOOR_Y + 2, t.y, "#3a3d45"));
    }
    let mirror: Reflector | null = null;
    if (it.mirror) {
      const mr = it.mirror;
      mirror = new Reflector(new THREE.PlaneGeometry(mr.w, mr.h), { textureWidth: 512, textureHeight: 512, color: 0xc8ccd0 });
      mirror.position.set(mr.x - 0.6, FLOOR_Y + mr.h / 2 + 2, mr.y); mirror.rotation.y = -Math.PI / 2; mirror.visible = false;
      group.add(mirror);
    }
    let lift: THREE.Mesh | null = null;
    if (it.lift) {
      lift = new THREE.Mesh(new THREE.BoxGeometry(56, 1.5, 26), new THREE.MeshStandardMaterial({ color: "#c0392b", metalness: 0.4, roughness: 0.5 }));
      lift.position.set(it.lift.x, FLOOR_Y + 0.8, it.lift.y); inner.add(lift);
      for (const sx of [-30, 30]) P.push(box(3, 40, 3, it.lift.x + sx, 20, it.lift.y - 16, "#3a3d45"), box(3, 40, 3, it.lift.x + sx, 20, it.lift.y + 16, "#3a3d45"));
    }
    // cars in the showroom on turntables
    const tables: THREE.Group[] = [];
    if (it.show) for (const s of it.show) {
      const t = new THREE.Group(); t.position.set(s.x, FLOOR_Y + 1, s.y);
      const car = this.carModel(s.model, s.color);
      if (car) { t.add(car); this.setup(car); }
      inner.add(t); tables.push(t);
    }
    // the mall: upper floor around the open middle, glass railing, escalators
    let steps: THREE.Texture | null = null;
    if (it.gallery) {
      const b = it.gallery.band, y = it.gallery.y;
      Up.push(box(W, 2, b, cx, y - 1, it.y0 + b / 2, "#d8d2c6"), box(W, 2, b, cx, y - 1, it.y1 - b / 2, "#d8d2c6"));
      Up.push(box(b, 2, L - 2 * b, it.x0 + b / 2, y - 1, cy, "#d8d2c6"), box(b, 2, L - 2 * b, it.x1 - b / 2, y - 1, cy, "#d8d2c6"));
      const ix0 = it.x0 + b, ix1 = it.x1 - b, iy0 = it.y0 + b, iy1 = it.y1 - b;
      for (const [ax, ay, bx2, by2] of [[ix0, iy1, ix1, iy1], [ix0, iy0, ix0, iy1], [ix1, iy0, ix1, iy1]] as [number, number, number, number][]) G.push(box(Math.max(0.5, bx2 - ax), 10, Math.max(0.5, by2 - ay), (ax + bx2) / 2, y + 5, (ay + by2) / 2, "#cfe6f2", 0.3));
      for (let x = ix0; x < ix1; x += 40) P.push(cyl(2.2, 2.2, y, x, y / 2, iy0 - 4, "#bfbab0", 10), cyl(2.2, 2.2, y, x, y / 2, iy1 + 4, "#bfbab0", 10));
      steps = canvasTex(32, 128, (g) => { g.fillStyle = "#4a4d55"; g.fillRect(0, 0, 32, 128); g.fillStyle = "#8a8d95"; for (let k = 0; k < 128; k += 16) g.fillRect(0, k, 32, 3); });
      steps.wrapS = steps.wrapT = THREE.RepeatWrapping; steps.repeat.set(1, 4);
      const sm = new THREE.MeshStandardMaterial({ map: steps, roughness: 0.6, metalness: 0.3 });
      for (const e of it.escalators!) {
        const len = Math.hypot(e.y1 - e.y0, y), ang = Math.atan2(y, e.y1 - e.y0);
        const m = new THREE.Mesh(new THREE.BoxGeometry(e.x1 - e.x0, 1.2, len), sm);
        m.position.set((e.x0 + e.x1) / 2, y / 2 + 0.6, (e.y0 + e.y1) / 2); m.rotation.x = ang; inner.add(m);
        for (const sx of [e.x0, e.x1]) { const sd = new THREE.Mesh(new THREE.BoxGeometry(1, 8, len), this.glassMat); sd.position.set(sx, y / 2 + 4.6, (e.y0 + e.y1) / 2); sd.rotation.x = ang; inner.add(sd); }
      }
    }
    if (P.length) { const m = new THREE.Mesh(mergeGeometries(P)!, this.propMat); m.castShadow = true; m.receiveShadow = true; inner.add(m); for (const g of P) g.dispose(); }
    if (G.length) { const m = new THREE.Mesh(mergeGeometries(G)!, this.glowMat); inner.add(m); for (const g of G) g.dispose(); }
    const lamps = new THREE.Mesh(mergeGeometries(Lamp)!, this.glowMat); group.add(lamps); for (const g of Lamp) g.dispose();
    // the mall's upper floor: see-through while you are below it
    let upper: THREE.Mesh | null = null, upperMat: THREE.MeshStandardMaterial | null = null;
    if (Up.length) { upperMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, transparent: true }); upper = new THREE.Mesh(mergeGeometries(Up)!, upperMat); upper.receiveShadow = true; inner.add(upper); for (const g of Up) g.dispose(); }
    this.scene.add(group);
    this.setup(group);
    const lum = (hex: string) => { const c = new THREE.Color(hex); return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; };
    const bright = Math.max(lum(fc), lum(wc));
    const lightK = 1 - 0.85 * Math.max(0, Math.min(1, (bright - 0.3) / 0.5));
    return { it, group, roof, walls, tower, lightK, doors, doorOpen: 0, gate, people: null, clerk: null, targets, mirror, lift, liftH: 0, tables, steps, inner, lamps, upperMat };
  }

  private targetTex() {
    const t = canvasTex(64, 64, (g) => {
      g.fillStyle = "#f2efe6"; g.fillRect(0, 0, 64, 64);
      for (const [r, c] of [[28, "#c0392b"], [20, "#f2efe6"], [12, "#c0392b"], [5, "#1b1b1f"]] as [number, string][]) { g.fillStyle = c; g.beginPath(); g.arc(32, 32, r, 0, 7); g.fill(); }
    });
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // one piece of furniture (into the merged meshes; text signs as their own meshes)
  private prop(p: Prop, P: THREE.BufferGeometry[], G: THREE.BufferGeometry[], inner: THREE.Group) {
    const z = FLOOR_Y + (p.z ?? 0), c = p.c ?? "#888";
    const rot = (g: THREE.BufferGeometry) => { if (p.a) { g.translate(-p.x, 0, -p.y); g.rotateY(-p.a); g.translate(p.x, 0, p.y); } return g; };
    switch (p.k) {
      case "counter": case "desk":
        P.push(box(p.w, p.h, p.d, p.x, z + p.h / 2, p.y, c), box(p.w + 2, 1, p.d + 2, p.x, z + p.h + 0.5, p.y, "#d8d2c6"));
        P.push(box(2, 4, 3, p.x, z + p.h + 3, p.y - p.d * 0.3, "#1b1b1f")); // till
        break;
      case "gunrack": P.push(box(p.w, p.h, p.d, p.x, z + p.h / 2, p.y, "#5a4636")); for (let k = 0; k < 3; k++) P.push(box(1, 1.4, p.d * 0.8, p.x - 1.2, z + 5 + k * 7, p.y, "#1b1b1f")); break;
      case "lane": P.push(box(p.w, 0.2, 1, p.x, FLOOR_Y + 0.4, p.y, c)); break;
      case "bench": case "table": case "tattoochair":
        P.push(box(p.w, 1.2, p.d, p.x, z + p.h, p.y, c), cyl(1, 1.4, p.h, p.x, z + p.h / 2, p.y, "#3a3d45", 8)); break;
      case "chair": case "barberchair": P.push(box(p.w, 1, p.d, p.x, z + p.h, p.y, c), box(1, 7, p.d, p.x + (p.k === "chair" ? -p.w / 2 : p.w / 2), z + p.h + 3.5, p.y, c), cyl(0.6, 0.6, p.h, p.x, z + p.h / 2, p.y, "#888", 6)); break;
      case "rack": {
        P.push(box(1, 1, p.d, p.x, z + p.h, p.y, "#c9ced8"), box(1, p.h, 1, p.x, z + p.h / 2, p.y - p.d / 2, "#c9ced8"), box(1, p.h, 1, p.x, z + p.h / 2, p.y + p.d / 2, "#c9ced8"));
        const cols = ["#ff6f91", "#2bb3ff", "#ffd23f", "#3dd68c", "#1f2a44", "#f5f0e1"];
        for (let k = 0; k < 8; k++) P.push(box(6, 10, 1.2, p.x, z + p.h - 6, p.y - p.d / 2 + 3 + k * (p.d - 6) / 7, cols[k % cols.length]));
        break;
      }
      case "booth": P.push(box(p.w, p.h, 1, p.x, z + p.h / 2, p.y - 12, c), box(1, p.h, 24, p.x - p.w / 2, z + p.h / 2, p.y, c)); break;
      case "plant": P.push(cyl(3, 2.4, 5, p.x, z + 2.5, p.y, "#7a5a3a", 8), withColor(new THREE.SphereGeometry(5, 8, 6).translate(p.x, z + 10, p.y), C(c))); break;
      case "menu": G.push(box(1, p.h, p.d, p.x - 0.6, z + p.h / 2, p.y, c, 0.9)); break;
      case "lift": break;
      case "dancefloor": {
        // glowing tiles in neon colours
        const cols = ["#ff3cac", "#2bf0ff", "#ffd23f", "#9d4dff", "#3dff8b"], n = 8;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) G.push(box(p.w / n - 1, 0.3, p.d / n - 1, p.x - p.w / 2 + (i + 0.5) * p.w / n, FLOOR_Y + 0.5, p.y - p.d / 2 + (j + 0.5) * p.d / n, cols[(i * 3 + j * 2) % cols.length], 1.4));
        break;
      }
      case "tools": P.push(box(p.w, p.h, p.d, p.x, z + p.h / 2, p.y, "#5a5e66")); for (let k = 0; k < 4; k++) P.push(box(1, 4, 1.5, p.x - 1.2, z + 4 + k * 4, p.y - 4 + k * 2.5, "#c9ced8")); break;
      case "tyres": for (let k = 0; k < 4; k++) P.push(withColor(new THREE.TorusGeometry(3.6, 1.6, 6, 12).rotateX(Math.PI / 2).translate(p.x, z + 1.6 + k * 3.2, p.y), C("#151515"))); break;
      case "bed": P.push(box(p.w, 5, p.d, p.x, z + 2.5, p.y, "#5a4636"), box(p.w - 2, 2.4, p.d - 2, p.x, z + 6, p.y, c), box(6, 2, p.d - 4, p.x + p.w / 2 - 5, z + 7.6, p.y, "#e8e8ec")); break;
      case "wardrobe": P.push(box(p.w, p.h, p.d, p.x, z + p.h / 2, p.y, c), box(0.6, p.h - 4, 0.6, p.x - p.w / 2, z + p.h / 2, p.y, "#2a1e14")); break;
      case "tv": P.push(box(p.w + 2, p.h + 2, 1.5, p.x, z + p.h / 2, p.y + 1, "#15161b")); G.push(box(p.w, p.h, 0.4, p.x, z + p.h / 2, p.y + 2, "#3a6a9a", 0.8)); break;
      case "sofa": P.push(box(p.w, 4, p.d, p.x, z + 2, p.y, c), box(p.w, 6, 3, p.x, z + 5, p.y - p.d / 2 + 1.5, c)); break;
      case "shelf": {
        P.push(box(p.w, p.h, p.d, p.x, z + p.h / 2, p.y, "#e8e8ec"));
        const cols = ["#c0392b", "#e1b12c", "#2e6da4", "#2d8a5a", "#e67e22", "#8e44ad"];
        for (let lv = 0; lv < 4; lv++) for (let k = 0; k < p.d / 6; k++) P.push(box(p.w + 1, 3.2, 4.4, p.x, z + 3 + lv * 5, p.y - p.d / 2 + 3 + k * 6, cols[(k + lv * 2) % cols.length]));
        break;
      }
      case "fridge": P.push(box(p.w, p.h, p.d, p.x, z + p.h / 2, p.y, "#e8e8ec")); G.push(box(0.6, p.h - 4, p.d - 4, p.x - p.w / 2 - 0.3, z + p.h / 2, p.y, "#cfe6f2", 0.7)); break;
      case "turntable": P.push(cyl(p.w / 2, p.w / 2, 1, p.x, z + 0.5, p.y, c, 28)); break;
      case "mirrorwall": P.push(box(p.w, p.h, p.d, p.x - 0.6, z + p.h / 2, p.y, "#cfe6f2")); break;
      case "front": {
        // a closed shop inside the mall: glass front and a lit name
        const g1 = new THREE.BoxGeometry(p.w, p.h, 1).translate(p.x, z + p.h / 2, p.y + (p.a ? -1.5 : 1.5));
        G.push(withColor(g1, C("#cfe6f2"), 0.25));
        const sgn = new THREE.Mesh(new THREE.PlaneGeometry(p.w * 0.7, 6), new THREE.MeshBasicMaterial({ map: this.sign(c, "#2a2d33", 384, 64), toneMapped: false }));
        sgn.position.set(p.x, z + p.h + 4, p.y + (p.a ? -2 : 2)); sgn.rotation.y = p.a ? Math.PI : 0; inner.add(sgn);
        break;
      }
      default: P.push(rot(box(p.w, p.h, p.d, p.x, z + p.h / 2, p.y, c)));
    }
  }

  private people(room: Room) {
    const it = room.it, list: { rig: HumanRig; anim: string }[] = [];
    let seed = it.id.length * 97;
    const mk = (x: number, y: number, a: number, anim: string, role = "civ") => {
      const rig = new HumanRig(lookFromSeed(seed++ * 31 + 7, role), 1);
      rig.root.position.set(x, FLOOR_Y, y); rig.root.rotation.y = -a; rig.play(anim, 0);
      this.scene.add(rig.root); this.setup(rig.root);
      list.push({ rig, anim });
      return rig;
    };
    if (it.clerk.x > -1e4) room.clerk = mk(it.clerk.x, it.clerk.y, it.clerk.a, "idle");
    for (const g of it.guests) mk(g.x, g.y, g.a, g.anim);
    room.people = list;
  }
  private dropPeople(room: Room) {
    for (const p of room.people ?? []) { this.scene.remove(p.rig.root); p.rig.dispose(); }
    room.people = null; room.clerk = null;
  }

  update(g: Game, dt: number, cam: THREE.Vector3) {
    const pd = g.ped, px = g.onFoot ? pd.x : g.player.x, py = g.onFoot ? pd.y : g.player.y;
    let lit: Room | null = null;
    for (const room of this.rooms) {
      const it = room.it, cx = (it.x0 + it.x1) / 2, cy = (it.y0 + it.y1) / 2;
      const d = Math.hypot(cx - px, cy - py);
      const inside = g.inside === it;
      // people only when you are close
      if (d < 420 && !room.people) this.people(room);
      else if (d > 520 && room.people) this.dropPeople(room);
      if (room.people) for (const p of room.people) {
        if (p.rig === room.clerk) {
          const rob = g.robbery?.it === it;
          p.rig.play(rob ? "handsUp" : "idle", 0.2);
          // the clerk looks at you
          const rel = Math.atan2(py - it.clerk.y, px - it.clerk.x) - it.clerk.a;
          p.rig.lookYaw = Math.max(-1, Math.min(1, -Math.atan2(Math.sin(rel), Math.cos(rel))));
        }
        p.rig.update(dt);
      }
      // the door opens when somebody comes close
      const dd = Math.hypot(it.door.x - px, it.door.y - py);
      room.doorOpen += ((dd < 40 ? 1 : 0) - room.doorOpen) * Math.min(1, dt * 5);
      for (const m of room.doors) m.position.z = it.door.y + (m.userData.s as number) * (it.door.w / 4 + room.doorOpen * it.door.w * 0.45);
      if (room.gate) { room.gate.scale.y = 1 - room.doorOpen * 0.9; room.gate.position.y = ((it.H - 6) * (1 - room.doorOpen * 0.9)) / 2 + room.doorOpen * (it.H - 6) * 0.9; }
      // inside: no roof, walls between the camera and you see-through
      room.roof.visible = !inside; room.lamps.visible = !inside;
      if (room.tower) room.tower.visible = !inside;
      if (room.upperMat) { const o = inside && (g.onFoot ? pd.z : 0) < 20 ? 0.22 : 1; room.upperMat.opacity += (o - room.upperMat.opacity) * Math.min(1, dt * 8); room.upperMat.depthWrite = room.upperMat.opacity > 0.9; }
      // only the walls between the camera and you (or right at the camera) fade out
      for (const w of room.walls) {
        const b = w.b, fade = inside && (segHitsRect(cam.x, cam.z, px, py, b.x - 3, b.y - 3, b.x + b.w + 3, b.y + b.h + 3) || (cam.x > b.x - 10 && cam.x < b.x + b.w + 10 && cam.z > b.y - 10 && cam.z < b.y + b.h + 10)) ? 0.15 : 1;
        if (Math.abs(w.mat.opacity - fade) > 0.01) w.mat.opacity += (fade - w.mat.opacity) * Math.min(1, dt * 8);
        w.mat.depthWrite = w.mat.opacity > 0.9;
      }
      if (room.mirror) room.mirror.visible = inside;
      if (inside || d < 200) lit = room;
      // workshop lift: the car goes up while you are in the menu there
      if (room.lift) {
        const up = g.modal?.kind === "shop" && g.modal.place.id === it.id && !g.onFoot ? 14 : 0;
        room.liftH += (up - room.liftH) * Math.min(1, dt * 1.5);
        room.lift.position.y = FLOOR_Y + 0.8 + room.liftH;
        if (inside) this.liftY = room.liftH;
      }
      for (const t of room.tables) t.rotation.y += dt * 0.25;
      if (room.steps) room.steps.offset.y = (room.steps.offset.y + dt * 0.4) % 1;
      // shooting range: the target that is up
      if (room.targets.length) {
        const rg = g.range?.it === it ? g.range : null;
        room.targets.forEach((m, i) => { const up = rg && rg.tgt === i ? 0 : -1.4; m.rotation.z += (up - m.rotation.z) * Math.min(1, dt * 12); });
      }
    }
    if (!g.inside) this.liftY *= 0.9;
    // one light for the shop you are in (or next to)
    if (lit) {
      // big blocks (mall, tower): the light follows you, so the room you are in is lit and nothing glares
      const it = lit.it, big = it.x1 - it.x0 > 220 && g.inside === it;
      this.light.position.set(big ? px : (it.x0 + it.x1) / 2, it.H - 6, big ? py : (it.y0 + it.y1) / 2);
      this.light.intensity = 2200 * lit.lightK * (big ? 0.7 : 1); this.light.distance = big ? 260 : Math.max(it.x1 - it.x0, it.y1 - it.y0) * 1.4;
    }
    else this.light.intensity = 0;
  }
}

// does the segment (ax, ay) - (bx, by) cross the rectangle? (slab test)
function segHitsRect(ax: number, ay: number, bx: number, by: number, x0: number, y0: number, x1: number, y1: number) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 <= t1;
}
