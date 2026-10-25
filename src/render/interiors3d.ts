// the walkable rooms on screen: walls you can see through from inside, a door that opens, furniture,
// ceilings with their lamps, the clerk and a few customers, a mirror in the boutique, the lift in the workshop,
// cars on turntables, the mall with its three floors, escalators and the glass lift, the prison and its yard.
// Furniture and lamps are only drawn while you are close (the shell - walls and roof - always is).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { box, cyl, C, canvasTex, withColor } from "./meshutil";
import { HumanRig, lookFromSeed } from "../characters/human";
import { Ragdoll, type RagdollWorld } from "../characters/ragdoll";
import type { IndoorPerson } from "../gameplay/indoor";
import { interiorCeil, onRoof, type Guest, type Interior, type Prop } from "../world/interiors";
import type { Building } from "../world/world";
import { furniture, floorTex, wallTex, type Parts } from "./furniture";
import type { Game } from "../core/engine";

const FLOOR_Y = 2.6;
const NEAR = 300; // furniture is drawn within this distance of the room (or of the prison yard)

interface Person { rig: HumanRig; anim: string; clerk?: boolean; z: number; ip: IndoorPerson | null; rag: Ragdoll | null }
interface Level { z: number; group: THREE.Group }
interface Room {
  it: Interior; group: THREE.Group; inner: THREE.Group; roof: THREE.Mesh; ceiling: THREE.Mesh; walls: { m: THREE.Mesh; mat: THREE.MeshStandardMaterial; b: Building }[]; tower: THREE.Mesh | null;
  doors: THREE.Mesh[]; doorOpen: number; gate?: THREE.Mesh;
  people: Person[] | null; clerk: HumanRig | null;
  targets: THREE.Mesh[]; mirror: Reflector | null; lift: THREE.Mesh | null; liftH: number;
  lightK: number; lightCol: THREE.Color; // bright rooms (white walls and floors) get less light, so they do not glare
  tables: THREE.Group[]; steps: THREE.Texture | null; lamps: THREE.Mesh | null;
  levels: Level[];                                   // mall: the upper floors (hidden from the bird's eye view while you are below)
  cabin: THREE.Group | null; liftDoors: { m: THREE.Mesh; z: number; s: number }[];
  yard: THREE.Group | null; yardPeople: Person[] | null;
}

export class InteriorsRenderer {
  private rooms: Room[] = [];
  private light = new THREE.PointLight(0xfff1dc, 0, 260, 1.6);
  private propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 });
  private glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  private glassMat = new THREE.MeshPhysicalMaterial({ color: 0xbfd8e6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  private fGlassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.4, depthWrite: false });
  private paneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.22, depthWrite: false });
  private steelMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.7, roughness: 0.35 });
  private texCache = new Map<string, THREE.Texture>();
  private tex(kind: "floor" | "wall" | "ceil", style: string, col: string, H = 46, floors: number[] = [0]) {
    const key = kind + style + col + H + floors.join(",");
    let t = this.texCache.get(key);
    if (!t) { t = kind === "floor" ? floorTex(style, col) : kind === "wall" ? wallTex(style, col, H, floors) : ceilTex(style, col); t.wrapS = t.wrapT = THREE.RepeatWrapping; this.texCache.set(key, t); }
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

  // a box with its texture in world units: u along the length (one tile = 60), v over the whole height
  private wallGeo(b: Building, z0: number, H: number) {
    const geo = new THREE.BoxGeometry(b.w, H, b.h);
    const uv = geo.attributes.uv as THREE.BufferAttribute, size = [[b.h, 1], [b.h, 1], [b.w, b.h / 60], [b.w, b.h / 60], [b.w, 1], [b.w, 1]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * size[f][0] / 60, uv.getY(i) * size[f][1]); }
    return geo.translate(b.x + b.w / 2, z0 + H / 2, b.y + b.h / 2);
  }

  // ceiling lamps in a grid over the rect (panel lights, round down lights, fluorescent tubes)
  private lamps(style: string, x0: number, y0: number, x1: number, y1: number, y: number, P: THREE.BufferGeometry[], Lamp: THREE.BufferGeometry[]) {
    if (style === "none") return;
    const step = style === "spot" ? 32 : 46;
    for (let x = x0 + step / 2; x < x1 - 6; x += step) for (let z = y0 + step / 2; z < y1 - 6; z += step) {
      if (style === "panel") { P.push(box(18, 0.5, 9, x, y - 0.4, z, "#d8d8dc")); Lamp.push(box(16, 0.3, 7, x, y - 0.8, z, "#fff6e0")); }
      else if (style === "spot") { P.push(cyl(2.6, 2.6, 0.6, x, y - 0.4, z, "#c9ced8", 12)); Lamp.push(cyl(1.9, 1.9, 0.3, x, y - 0.8, z, "#fff4dc", 12)); }
      else { P.push(box(22, 1.4, 4, x, y - 1, z, "#c9ced8")); Lamp.push(box(20, 0.6, 1.4, x, y - 1.9, z, "#f4f8ff")); }
    }
  }

  private build(it: Interior): Room {
    const group = new THREE.Group(), inner = new THREE.Group();
    group.add(inner);
    const cx = (it.x0 + it.x1) / 2, cy = (it.y0 + it.y1) / 2, W = it.x1 - it.x0, L = it.y1 - it.y0;
    const P: THREE.BufferGeometry[] = [], G: THREE.BufferGeometry[] = [], Lamp: THREE.BufferGeometry[] = [], Q: THREE.BufferGeometry[] = []; // Q: glass panes
    const parts: Parts = { std: [], glow: [], glass: [] }, extra: THREE.Object3D[] = [];
    const floors = it.levels ? [0, ...it.levels.map((l) => l.z)] : [0];
    // the floor (textured: wood, tiles, marble, ...)
    const [fs, fc] = it.floor ?? ["paint", "#cfc9bd"];
    const ftex = this.tex("floor", fs, fc).clone(); ftex.needsUpdate = true; ftex.repeat.set((W + 8) / 90, (L + 8) / 90);
    const shiny = fs === "marble" || fs === "tile" || fs === "polished" || fs === "terrazzo" || fs === "checker";
    const floorMat = new THREE.MeshStandardMaterial({ map: ftex, roughness: shiny ? 0.35 : 0.8, metalness: shiny ? 0.08 : 0.02 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 8, 0.6, L + 8).translate(cx, FLOOR_Y, cy), floorMat);
    floor.receiveShadow = true; inner.add(floor);
    // walls: one mesh and material each, so the ones between the camera and you can fade out
    const [ws, wc] = it.wallTex ?? ["paint", "#e8e2d6"];
    const wtex = this.tex("wall", ws, wc, it.H, floors);
    const walls: Room["walls"] = [];
    for (const b of it.walls) {
      if (b.low) continue;
      // a wall of one storey (tower) is only as high as the storey, with its own texture
      const part = b.zb !== undefined;
      const mat = new THREE.MeshStandardMaterial({ map: part ? this.tex("wall", ws, wc, b.zt! - b.zb!) : wtex, roughness: 0.85, transparent: true, opacity: 1 });
      const m = new THREE.Mesh(part ? this.wallGeo(b, b.zb!, b.zt! - b.zb!) : this.wallGeo(b, 0, it.H), mat);
      m.castShadow = true; m.receiveShadow = true;
      group.add(m); walls.push({ m, mat, b });
    }
    // the roof (with openings where the stairs and the lift come up onto the roof terrace)
    const roofRects = rectMinus({ x0: it.x0 - 5, y0: it.y0 - 5, x1: it.x1 + 5, y1: it.y1 + 5 }, it.roofHoles ?? []);
    const roofG = roofRects.map((r) => new THREE.BoxGeometry(r.x1 - r.x0, 2, r.y1 - r.y0).translate((r.x0 + r.x1) / 2, it.H + 1, (r.y0 + r.y1) / 2));
    const roofMat = it.kind === "tower" ? new THREE.MeshStandardMaterial({ map: this.tex("floor", "stone", "#b8b0a2").clone(), roughness: 0.85 }) : new THREE.MeshStandardMaterial({ color: it.prison ? "#7a766e" : "#6a6a70", roughness: 0.9 });
    if (roofMat.map) { roofMat.map.needsUpdate = true; roofMat.map.repeat.set((W + 10) / 90, (L + 10) / 90); fixBoxUv(roofG, it.x0 - 5, it.y0 - 5, W + 10, L + 10); }
    const roof = new THREE.Mesh(roofG.length === 1 ? roofG[0] : mergeGeometries(roofG)!, roofMat);
    roof.receiveShadow = true;
    roof.castShadow = true; group.add(roof);
    // the ceiling seen from inside (acoustic tiles, plaster, wooden boards or raw concrete) and its lamps
    const [cs, cc] = it.ceil ?? ["tiles", "#b8b3aa"];
    const ct = this.tex("ceil", cs, cc).clone(); ct.needsUpdate = true; ct.repeat.set(W / 60, L / 60);
    const ceilMat = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.9 });
    const ceilG = rectMinus({ x0: it.x0 - 4, y0: it.y0 - 4, x1: it.x1 + 4, y1: it.y1 + 4 }, it.roofHoles ?? []).map((r) => new THREE.PlaneGeometry(r.x1 - r.x0, r.y1 - r.y0).rotateX(Math.PI / 2).translate((r.x0 + r.x1) / 2, it.H - 0.2, (r.y0 + r.y1) / 2));
    const ceiling = new THREE.Mesh(ceilG.length === 1 ? ceilG[0] : mergeGeometries(ceilG)!, ceilMat);
    ceiling.visible = false; ceiling.castShadow = true; group.add(ceiling); // keeps the sun out while the roof is hidden
    this.lamps(it.lamps ?? "panel", it.x0, it.y0, it.x1, it.y1, it.H, P, Lamp);
    // the apartment tower: the storeys above the ground floor (seen from outside)
    let tower: THREE.Mesh | null = null;
    if (it.kind === "tower" && it.storey) tower = this.facade(it, group);
    const doors: THREE.Mesh[] = [];
    let gate: THREE.Mesh | undefined;
    const d = it.door, fx = d.x - 0.6;
    if (!it.prison) {
      // street side: sign, awning, shop windows next to the door
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
      if (it.kind === "workshop") {
        gate = new THREE.Mesh(new THREE.BoxGeometry(1, it.H - 6, d.w), new THREE.MeshStandardMaterial({ color: "#9aa0a8", metalness: 0.5, roughness: 0.4 }));
        gate.position.set(fx + 1, (it.H - 6) / 2, d.y); group.add(gate);
      } else for (const s of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 22, d.w / 2), this.glassMat);
        m.position.set(fx + 1.5, 11, d.y + s * d.w / 4); m.userData.s = s; group.add(m); doors.push(m);
      }
    } else {
      // prison: steel door frames in every opening, a sign over the door to the yard
      for (const o of it.doors ?? []) {
        const hw = o.w / 2 + 1.5, dz = 30;
        if (o.alongX) P.push(box(o.w + 6, 3, 5, o.x, dz + 1.5, o.y, "#5a5d66"), box(3, dz, 5, o.x - hw, dz / 2, o.y, "#5a5d66"), box(3, dz, 5, o.x + hw, dz / 2, o.y, "#5a5d66"));
        else P.push(box(5, 3, o.w + 6, o.x, dz + 1.5, o.y, "#5a5d66"), box(5, dz, 3, o.x, dz / 2, o.y - hw, "#5a5d66"), box(5, dz, 3, o.x, dz / 2, o.y + hw, "#5a5d66"));
      }
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), new THREE.MeshBasicMaterial({ map: this.sign(it.name.toUpperCase(), "#3a4048", 384, 72), toneMapped: false }));
      sg.position.set(d.x + 0.8, 38, d.y); sg.rotation.y = Math.PI / 2; group.add(sg);
    }
    // furniture (mall: what stands on an upper floor goes with that floor)
    const levels: Level[] = (it.levels ?? []).map((lv) => ({ z: lv.z, group: new THREE.Group() }));
    const lvParts = levels.map((): Parts => ({ std: [], glow: [], glass: [] })), lvExtra = levels.map((): THREE.Object3D[] => []), lvP = levels.map((): THREE.BufferGeometry[] => []), lvG = levels.map((): THREE.BufferGeometry[] => []), lvQ = levels.map((): THREE.BufferGeometry[] => []);
    const levelIx = (z: number | undefined) => levels.findIndex((l) => Math.abs(l.z - (z ?? 0)) < 1);
    const targets: THREE.Mesh[] = [];
    let seed = it.id.length * 131;
    for (const p of it.props) {
      const li = p.lv ? levelIx(p.lv) : -1;
      const pp = li >= 0 ? lvParts[li] : parts, ex = li >= 0 ? lvExtra[li] : extra, pP = li >= 0 ? lvP[li] : P, pG = li >= 0 ? lvG[li] : G, pQ = li >= 0 ? lvQ[li] : Q;
      // the ceiling over the piece (pendant lamps hang from it): the next floor up, else the roof
      const ch = interiorCeil(it, p.x, p.y, p.lv ?? 0) - (p.lv ?? 0);
      if (p.k.startsWith("f:")) furniture({ k: p.k.slice(2), x: p.x, y: p.y, w: p.w, d: p.d, a: p.a, z: p.z, c: p.c, c2: p.c2 }, pp, seed++, ex, Number.isFinite(ch) ? ch : 40, FLOOR_Y);
      else if (p.k === "front") this.front(p, pP, pG, pQ, li >= 0 ? levels[li].group : inner);
      else this.prop(p, pP, pG);
    }
    for (const o of extra) inner.add(o);
    const flush = (pp: Parts, Pl: THREE.BufferGeometry[], Gl: THREE.BufferGeometry[], Ql: THREE.BufferGeometry[], to: THREE.Group) => {
      if (Ql.length) { const m = new THREE.Mesh(mergeGeometries(Ql)!, this.paneMat); m.renderOrder = 2; to.add(m); for (const g of Ql) g.dispose(); Ql.length = 0; }
      if (pp.std.length) { const m = new THREE.Mesh(mergeGeometries(pp.std)!, this.propMat); m.castShadow = true; m.receiveShadow = true; to.add(m); for (const g of pp.std) g.dispose(); }
      if (pp.glow.length) { const m = new THREE.Mesh(mergeGeometries(pp.glow)!, this.glowMat); to.add(m); for (const g of pp.glow) g.dispose(); }
      if (pp.glass.length) { const m = new THREE.Mesh(mergeGeometries(pp.glass)!, this.fGlassMat); to.add(m); for (const g of pp.glass) g.dispose(); }
      if (Pl.length) { const m = new THREE.Mesh(mergeGeometries(Pl)!, this.propMat); m.castShadow = true; m.receiveShadow = true; to.add(m); for (const g of Pl) g.dispose(); Pl.length = 0; }
      if (Gl.length) { const m = new THREE.Mesh(mergeGeometries(Gl)!, this.glowMat); to.add(m); for (const g of Gl) g.dispose(); Gl.length = 0; }
    };
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
    // the mall: the galleries (floor on top, ceiling below, lamps under them), glass rails, escalators, the glass lift
    let steps: THREE.Texture | null = null, cabin: THREE.Group | null = null;
    const liftDoors: Room["liftDoors"] = [];
    if (it.levels) {
      it.levels.forEach((lv, li) => {
        const lg = levels[li].group, LP = lvP[li], LL: THREE.BufferGeometry[] = [];
        for (const r of lv.slabs) {
          const w = r.x1 - r.x0, h = r.y1 - r.y0;
          const top = this.tex("floor", fs, fc).clone(); top.needsUpdate = true; top.repeat.set(w / 90, h / 90);
          const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 2, h).translate((r.x0 + r.x1) / 2, FLOOR_Y + lv.z - 1, (r.y0 + r.y1) / 2), new THREE.MeshStandardMaterial({ map: top, roughness: shiny ? 0.35 : 0.8 }));
          slab.receiveShadow = true; slab.castShadow = true; lg.add(slab);
          const under = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(Math.PI / 2).translate((r.x0 + r.x1) / 2, FLOOR_Y + lv.z - 2.1, (r.y0 + r.y1) / 2), ceilMat);
          lg.add(under);
          this.lamps(it.lamps ?? "panel", r.x0, r.y0, r.x1, r.y1, FLOOR_Y + lv.z - 2.2, LP, LL);
        }
        if (LL.length) { const m = new THREE.Mesh(mergeGeometries(LL)!, this.glowMat); lg.add(m); for (const g of LL) g.dispose(); }
      });
      // glass rails (the thin height-limited walls) with a steel handrail on top
      for (const b of it.walls) if (b.zb !== undefined && b.zt! - b.zb <= 14) {
        const li = levelIx(b.zb), to = li >= 0 ? lvQ[li] : Q, toP = li >= 0 ? lvP[li] : P;
        to.push(box(b.w, 10, b.h, b.x + b.w / 2, FLOOR_Y + b.zb + 5, b.y + b.h / 2, "#cfe6f2"));
        toP.push(box(b.w + 0.4, 0.8, b.h + 0.4, b.x + b.w / 2, FLOOR_Y + b.zb + 10.4, b.y + b.h / 2, "#9aa3ad"));
      }
      if (it.escalators!.some((e) => !e.stairs)) steps = canvasTex(32, 128, (g) => { g.fillStyle = "#4a4d55"; g.fillRect(0, 0, 32, 128); g.fillStyle = "#8a8d95"; for (let k = 0; k < 128; k += 16) g.fillRect(0, k, 32, 3); });
      if (steps) { steps.wrapS = steps.wrapT = THREE.RepeatWrapping; steps.repeat.set(1, 6); }
      const sm = new THREE.MeshStandardMaterial({ map: steps, roughness: 0.6, metalness: 0.3 });
      for (const e of it.escalators!) {
        if (e.stairs) { this.stairs(e, P); continue; }
        const run = e.y1 - e.y0, rise = e.zb - e.za, len = Math.hypot(run, rise), ang = -Math.atan2(rise, run), mx = (e.x0 + e.x1) / 2, mz = (e.y0 + e.y1) / 2, my = FLOOR_Y + (e.za + e.zb) / 2;
        const tread = new THREE.Mesh(new THREE.BoxGeometry(e.x1 - e.x0, 1.2, len), sm);
        tread.position.set(mx, my + 0.4, mz); tread.rotation.x = ang; inner.add(tread);
        if (!e.up) tread.userData.down = true;
        // the truss under it and the balustrades with their black handrails
        const truss = new THREE.Mesh(new THREE.BoxGeometry(e.x1 - e.x0 + 3, 5, len), this.steelMat);
        truss.position.set(mx, my - 2.6, mz); truss.rotation.x = ang; inner.add(truss);
        for (const sx of [e.x0, e.x1]) {
          const bal = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, len), this.glassMat); bal.position.set(sx, my + 5, mz); bal.rotation.x = ang; inner.add(bal);
          const rail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, len + 4), this.propMat); rail.position.set(sx, my + 9.8, mz); rail.rotation.x = ang; inner.add(rail);
        }
      }
      const el = it.elevator;
      if (el) {
        // the cabin: floor, glass on three sides, a lit ceiling; sliding doors on every floor
        cabin = new THREE.Group();
        const cw = el.x1 - el.x0, cd = el.y1 - el.y0, ccx = (el.x0 + el.x1) / 2, ccz = (el.y0 + el.y1) / 2;
        const cP = [box(cw, 1, cd, 0, -0.5, 0, "#3a3d45"), box(cw, 1, cd, 0, 30, 0, "#3a3d45"), box(1, 30, 1, -cw / 2 + 0.5, 15, cd / 2 - 0.5, "#9aa3ad"), box(1, 30, 1, cw / 2 - 0.5, 15, cd / 2 - 0.5, "#9aa3ad"), box(4, 6, 0.6, cw / 2 - 4, 14, -cd / 2 + 0.5, "#2a2d33")];
        const cm = new THREE.Mesh(mergeGeometries(cP)!, this.propMat); cabin.add(cm); for (const g of cP) g.dispose();
        const cg = new THREE.Mesh(new THREE.BoxGeometry(cw - 1, 29, cd - 1), this.glassMat); cg.position.y = 15; cabin.add(cg);
        const cl = new THREE.Mesh(withColor(new THREE.BoxGeometry(cw - 6, 0.4, cd - 6), C("#fff6e0")), this.glowMat); cl.position.y = 29.3; cabin.add(cl);
        cabin.position.set(ccx, FLOOR_Y + el.z, ccz); inner.add(cabin);
        for (const z of el.floors) for (const s of [-1, 1]) {
          const m = new THREE.Mesh(new THREE.BoxGeometry((cw - 14) / 2, 28, 0.8), this.steelMat);
          m.position.set(ccx + s * (cw - 14) / 4, FLOOR_Y + z + 14, el.y1 + 1); inner.add(m); liftDoors.push({ m, z, s });
        }
        P.push(box(cw + 4, 2, 2, ccx, FLOOR_Y + it.H - 1, el.y1 + 1, "#3a3d45"));
      }
      levels.forEach((l, li) => { flush(lvParts[li], lvP[li], lvG[li], lvQ[li], l.group); for (const o of lvExtra[li]) l.group.add(o); inner.add(l.group); });
    }
    flush(parts, P, G, Q, inner);
    let lamps: THREE.Mesh | null = null;
    if (Lamp.length) { lamps = new THREE.Mesh(mergeGeometries(Lamp)!, this.glowMat); inner.add(lamps); for (const g of Lamp) g.dispose(); }
    // the prison yard (outdoors, drawn with the cell block)
    let yard: THREE.Group | null = null;
    if (it.yard) {
      yard = new THREE.Group();
      const yp: Parts = { std: [], glow: [], glass: [] }, ye: THREE.Object3D[] = [];
      for (const p of it.yard.props) furniture({ k: p.k.slice(2), x: p.x, y: p.y, w: p.w, d: p.d, a: p.a, z: p.z, c: p.c, c2: p.c2 }, yp, seed++, ye, it.H, 0);
      flush(yp, [], [], [], yard); for (const o of ye) yard.add(o);
      this.scene.add(yard); this.setup(yard);
    }
    this.scene.add(group);
    this.setup(group);
    const lum = (hex: string) => { const c = new THREE.Color(hex); return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; };
    const bright = Math.max(lum(fc), lum(wc));
    const lightK = 1 - 0.85 * Math.max(0, Math.min(1, (bright - 0.3) / 0.5));
    return { it, group, inner, roof, ceiling, walls, tower, lightK, lightCol: new THREE.Color(it.light ?? "#fff1dc"), doors, doorOpen: 0, gate, people: null, clerk: null, targets, mirror, lift, liftH: 0, tables, steps, lamps, levels, cabin, liftDoors, yard, yardPeople: null };
  }

  private targetTex() {
    const t = canvasTex(64, 64, (g) => {
      g.fillStyle = "#f2efe6"; g.fillRect(0, 0, 64, 64);
      for (const [r, c] of [[28, "#c0392b"], [20, "#f2efe6"], [12, "#c0392b"], [5, "#1b1b1f"]] as [number, string][]) { g.fillStyle = c; g.beginPath(); g.arc(32, 32, r, 0, 7); g.fill(); }
    });
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // a closed shop in the mall: shop window with goods behind it, a frame, the lit name above
  private front(p: Prop, P: THREE.BufferGeometry[], G: THREE.BufferGeometry[], Q: THREE.BufferGeometry[], to: THREE.Group) {
    const z = FLOOR_Y + (p.z ?? 0), a = p.a ?? 0, w = p.w, dep = p.d, col = p.c2 ?? "#2a2d33";
    // local: x along the wall, the window looks to +n (into the mall); n = 0 at the wall
    const ca = Math.cos(a), sa = Math.sin(a);
    const at = (u: number, n: number): [number, number] => [p.x + u * ca - n * sa, p.y + u * sa + n * ca];
    const bx = (u: number, n: number, bw: number, bh: number, bd: number, y: number, c: string | THREE.Color, mul = 1) => { const [x, yy] = at(u, n); return box(bw, bh, bd, x, y, yy, c, mul, -a); };
    // window glass, frame, a dark backdrop, shelves and goods in the window
    Q.push(bx(0, dep, w - 2, 24, 0.5, z + 12, "#cfe6f2"));
    P.push(bx(0, dep, w, 2, 1.6, z + 25, "#3a3d45"), bx(-w / 2 + 0.8, dep, 1.6, 26, 1.6, z + 13, "#3a3d45"), bx(w / 2 - 0.8, dep, 1.6, 26, 1.6, z + 13, "#3a3d45"), bx(0, dep, w, 1.4, 1.6, z + 0.7, "#3a3d45"));
    P.push(bx(0, 0.6, w - 2, 24, 0.6, z + 12, C(col).clone().multiplyScalar(0.35)), bx(0, dep * 0.45, w - 4, 4, dep * 0.7, z + 2, "#e8e4dc"));
    for (let k = 0; k < Math.floor(w / 9); k++) {
      const u = -w / 2 + 5 + k * 9, h = 5 + ((k * 7) % 5) * 1.5;
      P.push(bx(u, dep * 0.45, 5, h, 4, z + 4 + h / 2, k % 2 ? col : "#f4f2ee"));
    }
    G.push(bx(0, dep - 0.4, w - 4, 0.6, 1, z + 23.6, "#fff6e0", 1.2));
    const [sx, sy] = at(0, dep + 0.4);
    const sgn = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 5.5), new THREE.MeshBasicMaterial({ map: this.sign(p.c ?? "", col, 384, 64), toneMapped: false }));
    sgn.position.set(sx, z + 29.5, sy); sgn.rotation.y = -a; to.add(sgn);
    P.push(bx(0, dep * 0.5, w, 6.5, dep, z + 29.5, "#2a2d33"));
  }

  // one piece of the older prop set (into the merged meshes)
  private prop(p: Prop, P: THREE.BufferGeometry[], G: THREE.BufferGeometry[]) {
    const z = FLOOR_Y + (p.z ?? 0), c = p.c ?? "#888";
    const rot = (g: THREE.BufferGeometry) => { if (p.a) { g.translate(-p.x, 0, -p.y); g.rotateY(-p.a); g.translate(p.x, 0, p.y); } return g; };
    switch (p.k) {
      case "gunrack": P.push(box(p.w, p.h, p.d, p.x, z + p.h / 2, p.y, "#5a4636")); for (let k = 0; k < 3; k++) P.push(box(1, 1.4, p.d * 0.8, p.x - 1.2, z + 5 + k * 7, p.y, "#1b1b1f")); break;
      case "lane": P.push(box(p.w, 0.2, 1, p.x, FLOOR_Y + 0.4, p.y, c)); break;
      case "bench": case "table": case "tattoochair":
        P.push(box(p.w, 1.2, p.d, p.x, z + p.h, p.y, c), cyl(1, 1.4, p.h, p.x, z + p.h / 2, p.y, "#3a3d45", 8)); break;
      case "booth": P.push(box(p.w, p.h, 1, p.x, z + p.h / 2, p.y - 12, c), box(1, p.h, 24, p.x - p.w / 2, z + p.h / 2, p.y, c)); break;
      case "lift": break;
      case "dancefloor": {
        // glowing tiles in neon colours
        const cols = ["#ff3cac", "#2bf0ff", "#ffd23f", "#9d4dff", "#3dff8b"], n = 8;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) G.push(box(p.w / n - 1, 0.3, p.d / n - 1, p.x - p.w / 2 + (i + 0.5) * p.w / n, FLOOR_Y + 0.5, p.y - p.d / 2 + (j + 0.5) * p.d / n, cols[(i * 3 + j * 2) % cols.length], 1.4));
        break;
      }
      case "tyres": for (let k = 0; k < 4; k++) P.push(withColor(new THREE.TorusGeometry(3.6, 1.6, 6, 12).rotateX(Math.PI / 2).translate(p.x, z + 1.6 + k * 3.2, p.y), C("#151515"))); break;
      case "turntable": P.push(cyl(p.w / 2, p.w / 2, 1, p.x, z + 0.5, p.y, c, 28), cyl(p.w / 2 + 0.6, p.w / 2 + 0.6, 0.4, p.x, z + 0.2, p.y, "#9aa3ad", 28)); break;
      default: P.push(rot(box(p.w, p.h, p.d, p.x, z + p.h / 2, p.y, c)));
    }
  }

  // a flight of stairs: solid steps on a sloped stringer, a wooden handrail on the open side
  private stairs(e: { x0: number; x1: number; y0: number; y1: number; za: number; zb: number }, P: THREE.BufferGeometry[]) {
    const run = e.y1 - e.y0, rise = e.zb - e.za, n = Math.max(2, Math.round(Math.abs(rise) / 2.2)), sd = run / n, w = e.x1 - e.x0, mx = (e.x0 + e.x1) / 2;
    for (let i = 0; i < n; i++) {
      // step i covers y0 + i*sd .. y0 + (i+1)*sd; its top is the height at its far end (going up) or near end (going down)
      const top = e.za + rise * (rise > 0 ? (i + 1) / n : i / n), lo = Math.min(e.za, e.zb);
      const h = Math.max(1, top - lo);
      P.push(box(w, h, sd + 0.1, mx, FLOOR_Y + lo + h / 2, e.y0 + (i + 0.5) * sd, i % 2 ? "#cfc6b8" : "#c4baa9"));
      P.push(box(w, 0.4, 1.2, mx, FLOOR_Y + top + 0.2, e.y0 + (rise > 0 ? (i + 1) * sd - 0.6 : i * sd + 0.6), "#7a7266"));
    }
    const len = Math.hypot(run, rise), ang = -Math.atan2(rise, run);
    const hr = box(1.2, 1.2, len, 0, 0, 0, "#6a4a32");
    hr.rotateX(ang).translate(e.x1 - 0.8, FLOOR_Y + (e.za + e.zb) / 2 + 11, (e.y0 + e.y1) / 2);
    P.push(hr);
  }

  // the tower seen from outside: a facade with a band of windows and balcony slabs on every storey (door left open)
  private facade(it: Interior, group: THREE.Group) {
    const S = it.storey!, NF = Math.round(it.H / S), o = 5.4;
    const t = canvasTex(256, 256, (g) => {
      // one storey, 60 wide: plaster, two windows with frames and a reflection, a balcony slab with a rail
      g.fillStyle = "#d9d0c2"; g.fillRect(0, 0, 256, 256);
      for (let k = 0; k < 900; k++) { g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
      for (const x of [18, 138]) {
        const gr = g.createLinearGradient(x, 40, x + 100, 190); gr.addColorStop(0, "#9fc3dc"); gr.addColorStop(0.45, "#3e6382"); gr.addColorStop(1, "#1d3550");
        g.fillStyle = "#4a4f57"; g.fillRect(x - 5, 34, 110, 166); g.fillStyle = gr; g.fillRect(x, 40, 100, 154);
        g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.moveTo(x + 10, 40); g.lineTo(x + 40, 40); g.lineTo(x + 5, 120); g.lineTo(x, 120); g.fill();
        g.fillStyle = "#4a4f57"; g.fillRect(x + 48, 40, 4, 154);
      }
      g.fillStyle = "#b4ab9c"; g.fillRect(0, 214, 256, 16); g.fillStyle = "#8a8378"; g.fillRect(0, 228, 256, 4);
      g.fillStyle = "rgba(60,64,72,0.85)"; for (let x = 0; x < 256; x += 12) g.fillRect(x, 196, 3, 18); g.fillRect(0, 194, 256, 3);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, NF); t.colorSpace = THREE.SRGBColorSpace;
    const X0 = it.x0 - o, X1 = it.x1 + o, Y0 = it.y0 - o, Y1 = it.y1 + o, d = it.door;
    const piece = (x: number, y: number, w: number, h: number, z0: number, H: number) => this.wallGeo({ x, y, w, h } as Building, z0, H);
    const parts = [
      piece(X0, Y0, X1 - X0, 1, 0, it.H), piece(X0, Y1 - 1, X1 - X0, 1, 0, it.H), piece(X1 - 1, Y0, 1, Y1 - Y0, 0, it.H),
      piece(X0, Y0, 1, d.y - d.w / 2 - 6 - Y0, 0, it.H), piece(X0, d.y + d.w / 2 + 6, 1, Y1 - d.y - d.w / 2 - 6, 0, it.H),
      piece(X0, d.y - d.w / 2 - 6, 1, d.w + 12, S, it.H - S),
    ];
    // the above-door piece starts one storey up: shift its texture so the storeys line up
    const uv = parts[5].attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (S + uv.getY(i) * (it.H - S)) / it.H);
    const m = new THREE.Mesh(mergeGeometries(parts)!, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.05 }));
    m.castShadow = true; m.receiveShadow = true; group.add(m);
    // an entrance canopy over the door, the house name on it
    const can = new THREE.Mesh(new THREE.BoxGeometry(24, 1.6, d.w + 30).translate(X0 - 12, 28, d.y), new THREE.MeshStandardMaterial({ color: "#2a2d33", roughness: 0.5, metalness: 0.4 }));
    group.add(can);
    return m;
  }

  private spawn(g: Guest, seed: number, list: Person[], clerk = false, ip: IndoorPerson | null = null) {
    const rig = new HumanRig(lookFromSeed(seed * 31 + 7, g.role ?? "civ", g.shirt ?? "", g.pants ?? ""), 1);
    rig.root.position.set(g.x, FLOOR_Y + (g.z ?? 0), g.y); rig.root.rotation.y = -g.a; rig.play(ip?.dead ? "lying" : g.anim, 0);
    this.scene.add(rig.root); this.setup(rig.root);
    list.push({ rig, anim: g.anim, clerk, z: g.z ?? 0, ip, rag: null });
    return rig;
  }
  private people(room: Room, g: Game) {
    const it = room.it, list: Person[] = [], ips = g.indoor.of(it);
    let seed = it.id.length * 97, k = 0;
    if (it.clerk.x > -1e4) room.clerk = this.spawn({ x: it.clerk.x, y: it.clerk.y, a: it.clerk.a, anim: "idle" }, seed++, list, true, ips[k++] ?? null);
    for (const q of it.guests) this.spawn(q, seed++, list, false, ips[k++] ?? null);
    room.people = list;
  }
  // the ground and the walls for the bodies of people that were shot (set by the renderer)
  ragWorld: RagdollWorld | null = null;
  // one person: shot people fall as ragdolls and stay down, frightened people duck (the clerk puts the hands up)
  private person(p: Person, dt: number, robbed: boolean) {
    const ip = p.ip, r = p.rig;
    if (ip?.dead) {
      if (!p.rag && this.ragWorld && r.current !== "lying") {
        r.root.updateMatrixWorld(true);
        p.rag = new Ragdoll(r, new THREE.Vector3(ip.vx, Math.max(ip.vz, 20), ip.vy), ip.spin);
        r.ragdoll = true; r.playUpper("");
      }
      if (p.rag) { p.rag.step(dt, this.ragWorld!); p.rag.pose(); }
      r.update(dt);
      return;
    }
    const scared = (ip?.scared ?? 0) > 0;
    if (p.clerk) r.play(robbed || scared ? "handsUp" : "idle", 0.2);
    else r.play(scared ? "cower" : p.anim, 0.25);
    r.update(dt);
  }
  private drop(list: Person[] | null) { for (const p of list ?? []) { this.scene.remove(p.rig.root); p.rig.dispose(); } }

  update(g: Game, dt: number, cam: THREE.Vector3) {
    const pd = g.ped, px = g.onFoot ? pd.x : g.player.x, py = g.onFoot ? pd.y : g.player.y, pz = g.onFoot ? pd.z : g.player.z;
    const top = g.config.camera === "top";
    let lit: Room | null = null, litD = Infinity;
    for (const room of this.rooms) {
      const it = room.it, cx = (it.x0 + it.x1) / 2, cy = (it.y0 + it.y1) / 2;
      // distance to the room's rectangle
      const d = Math.hypot(Math.max(it.x0 - px, 0, px - it.x1), Math.max(it.y0 - py, 0, py - it.y1));
      const inside = g.inside === it, sameHouse = inside || (!!it.prison && !!g.inside?.prison);
      const near = inside || d < NEAR;
      room.inner.visible = near;
      // people only when you are close
      if (d < 420 && !room.people) this.people(room, g);
      else if (d > 520 && room.people) { this.drop(room.people); room.people = null; room.clerk = null; }
      if (room.people) for (const p of room.people) {
        if (p.clerk && !p.ip?.dead) {
          // the clerk looks at you
          const rel = Math.atan2(py - it.clerk.y, px - it.clerk.x) - it.clerk.a;
          p.rig.lookYaw = Math.max(-1, Math.min(1, -Math.atan2(Math.sin(rel), Math.cos(rel))));
        }
        this.person(p, dt, g.robbery?.it === it);
      }
      // the prison yard: its props and inmates while you are near the prison
      if (room.yard) {
        const yd = Math.hypot(px - cx - 300, py - cy);
        room.yard.visible = yd < 900;
        if (yd < 700 && !room.yardPeople) { const l: Person[] = [], ips = g.indoor.yardOf(it); let s = 501, k = 0; for (const q of it.yard!.guests) this.spawn(q, s++, l, false, ips[k++] ?? null); room.yardPeople = l; }
        else if (yd > 800 && room.yardPeople) { this.drop(room.yardPeople); room.yardPeople = null; }
        if (room.yardPeople) for (const p of room.yardPeople) this.person(p, dt, false);
      }
      // the door opens when somebody comes close
      const dd = Math.hypot(it.door.x - px, it.door.y - py);
      room.doorOpen += ((dd < 40 ? 1 : 0) - room.doorOpen) * Math.min(1, dt * 5);
      for (const m of room.doors) m.position.z = it.door.y + (m.userData.s as number) * (it.door.w / 4 + room.doorOpen * it.door.w * 0.45);
      if (room.gate) { room.gate.scale.y = 1 - room.doorOpen * 0.9; room.gate.position.y = ((it.H - 6) * (1 - room.doorOpen * 0.9)) / 2 + room.doorOpen * (it.H - 6) * 0.9; }
      // inside: the roof gives way to the ceiling with its lamps (only the bird's eye view looks in from above)
      // on the roof terrace of the tower you are outdoors again
      const roofNow = inside && onRoof(it, pz), inRooms = inside && !roofNow, S = it.storey;
      room.roof.visible = !inRooms; room.ceiling.visible = inRooms && !top;
      if (room.lamps) room.lamps.visible = !inside || !top;
      if (room.tower) room.tower.visible = !inRooms;
      // mall: from above the floors over you are left out; tower: only your storey (with its ceiling) and the roof
      for (const lv of room.levels) {
        let vis = !(inRooms && top && lv.z > pz + 10);
        if (S) vis = lv.z >= it.H ? true : inRooms ? vis && lv.z <= pz + S + 2 && lv.z >= pz - S - 2 : false;
        lv.group.visible = vis;
      }
      if (S && room.people) for (const q of room.people) q.rig.root.visible = q.z >= it.H ? !inRooms || pz > it.H - 30 : inRooms && Math.abs(q.z - pz) < S - 4;
      // only the walls between the camera and you (or right at the camera) fade out
      for (const w of room.walls) {
        const b = w.b;
        if (b.zb !== undefined) {
          // a storey wall (tower): your storey only; the walls on the roof are seen from everywhere outside the rooms
          w.m.visible = b.zb >= it.H - 4 ? !inRooms || pz > it.H - 40 : inRooms ? b.zb <= pz + 30 && b.zt! >= pz - 8 : near && b.zb < 10;
          if (!w.m.visible) continue;
        }
        const fade = sameHouse && !roofNow && (segHitsRect(cam.x, cam.z, px, py, b.x - 3, b.y - 3, b.x + b.w + 3, b.y + b.h + 3) || (cam.x > b.x - 10 && cam.x < b.x + b.w + 10 && cam.z > b.y - 10 && cam.z < b.y + b.h + 10)) ? 0.15 : 1;
        if (Math.abs(w.mat.opacity - fade) > 0.01) w.mat.opacity += (fade - w.mat.opacity) * Math.min(1, dt * 8);
        w.mat.depthWrite = w.mat.opacity > 0.9;
      }
      if (room.mirror) room.mirror.visible = inside;
      if (inside) { lit = room; litD = -1; } else if (d < 200 && d < litD) { lit = room; litD = d; }
      // workshop lift: the car goes up while you are in the menu there
      if (room.lift) {
        const up = g.modal?.kind === "shop" && g.modal.place.id === it.id && !g.onFoot ? 14 : 0;
        room.liftH += (up - room.liftH) * Math.min(1, dt * 1.5);
        room.lift.position.y = FLOOR_Y + 0.8 + room.liftH;
        if (inside) this.liftY = room.liftH;
      }
      // the mall's lift: the cabin follows the game, the doors of the floor it stands at slide open
      const el = it.elevator;
      if (room.cabin && el) {
        room.cabin.position.y = FLOOR_Y + el.z;
        const cw = el.x1 - el.x0, ccx = (el.x0 + el.x1) / 2;
        for (const q of room.liftDoors) { const open = Math.abs(el.z - q.z) < 0.5 ? el.open : 0; q.m.position.x = ccx + q.s * ((cw - 14) / 4 + open * (cw - 14) * 0.42); }
      }
      if (near) {
        for (const t of room.tables) t.rotation.y += dt * 0.25;
        if (room.steps) room.steps.offset.y = (room.steps.offset.y + dt * 0.4) % 1;
      }
      // shooting range: the target that is up
      if (room.targets.length) {
        const rg = g.range?.it === it ? g.range : null;
        room.targets.forEach((m, i) => { const up = rg && rg.tgt === i ? 0 : -1.4; m.rotation.z += (up - m.rotation.z) * Math.min(1, dt * 12); });
      }
    }
    if (!g.inside) this.liftY *= 0.9;
    // one light for the room you are in (or the closest one)
    if (lit) {
      // big rooms (mall, tower, prison): the light follows you, so the part you are in is lit and nothing glares
      const it = lit.it, big = (it.x1 - it.x0 > 220 || it.y1 - it.y0 > 220) && g.inside === it;
      const z = g.onFoot ? Math.max(0, pd.z) : 0;
      // below the ceiling (not right under it: the ceiling would glare)
      this.light.position.set(big ? px : (it.x0 + it.x1) / 2, Math.min((it.levels && big ? 30 : it.H - 16), 30) + (big ? z : 0), big ? py : (it.y0 + it.y1) / 2);
      this.light.color.copy(lit.lightCol);
      this.light.intensity = 1700 * lit.lightK * (big ? 0.7 : 1); this.light.distance = big ? 260 : Math.max(it.x1 - it.x0, it.y1 - it.y0) * 1.4;
    }
    else this.light.intensity = 0;
  }
}

// ceilings: acoustic tiles, smooth plaster, wooden boards, raw concrete with formwork joints
function ceilTex(style: string, col: string) {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = col; g.fillRect(0, 0, 128, 128);
    if (style === "tiles") {
      g.strokeStyle = "rgba(0,0,0,0.2)"; g.lineWidth = 2; for (let k = 0; k <= 128; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 128); g.moveTo(0, k); g.lineTo(128, k); g.stroke(); }
      for (let k = 0; k < 600; k++) { g.fillStyle = "rgba(0,0,0,0.08)"; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1); }
    } else if (style === "wood") {
      for (let k = 0; k < 8; k++) { g.fillStyle = `rgba(0,0,0,${0.05 + (k % 3) * 0.04})`; g.fillRect(0, k * 16, 128, 15); g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(0, k * 16 + 15, 128, 1); }
    } else if (style === "concrete") {
      for (let k = 0; k < 1500; k++) { g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)"; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
      g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = 1; g.strokeRect(0, 0, 128, 64); g.strokeRect(0, 64, 128, 64);
    } else {
      for (let k = 0; k < 800; k++) { g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
    }
  });
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

// the parts of a rectangle that are not covered by any of the holes (cut along the holes' edges)
function rectMinus(r: { x0: number; y0: number; x1: number; y1: number }, holes: { x0: number; y0: number; x1: number; y1: number }[]) {
  if (!holes.length) return [r];
  const xs = [...new Set([r.x0, r.x1, ...holes.flatMap((h) => [h.x0, h.x1])])].filter((x) => x >= r.x0 && x <= r.x1).sort((a, b) => a - b);
  const ys = [...new Set([r.y0, r.y1, ...holes.flatMap((h) => [h.y0, h.y1])])].filter((y) => y >= r.y0 && y <= r.y1).sort((a, b) => a - b);
  const out: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let j = 0; j < ys.length - 1; j++) {
    let run: { x0: number; y0: number; x1: number; y1: number } | null = null;
    for (let i = 0; i < xs.length - 1; i++) {
      const mx = (xs[i] + xs[i + 1]) / 2, my = (ys[j] + ys[j + 1]) / 2;
      const open = holes.some((h) => mx > h.x0 && mx < h.x1 && my > h.y0 && my < h.y1);
      if (open) { if (run) { out.push(run); run = null; } continue; }
      if (run) run.x1 = xs[i + 1]; else run = { x0: xs[i], y0: ys[j], x1: xs[i + 1], y1: ys[j + 1] };
    }
    if (run) out.push(run);
  }
  return out;
}
// box faces in world units for a texture laid over the whole rectangle (top faces only matter)
function fixBoxUv(list: THREE.BufferGeometry[], x0: number, y0: number, w: number, h: number) {
  for (const g of list) {
    const P = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < P.count; i++) uv.setXY(i, (P.getX(i) - x0) / w, 1 - (P.getZ(i) - y0) / h);
  }
}
