import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "./world";
import type { Civilian } from "./peds";

// pedestrians: one InstancedMesh per body part, colours per instance
const SKIN = ["#f1c7a5", "#e0a982", "#c68a62", "#a86b45", "#7d4a2c", "#5a3420"];
const SHIRT = ["#e8e8ee", "#ff6f91", "#2bb3ff", "#ffd23f", "#3dd68c", "#ff8a3d", "#9b6bff", "#1f2a44", "#c0392b", "#16a085", "#f5f0e1", "#ff3cac"];
const PANTS = ["#2c3e57", "#3b3b44", "#c9b48c", "#1c1c22", "#5b6e8c", "#e6e1d6"];
const HAIR = ["#1b1410", "#3b2a1e", "#6b4a2a", "#c9a15a", "#8a8a8a", "#a33a1e"];

type Part = "legL" | "legR" | "hips" | "torso" | "head" | "hair" | "armL" | "armR";
const PARTS: Part[] = ["legL", "legR", "hips", "torso", "head", "hair", "armL", "armR"];

// geometry with vertex colours (white = takes the instance colour fully, dark = shoes etc.)
function tint(g: THREE.BufferGeometry, v: number) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(v);
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return g;
}
const cap = (r: number, len: number, y: number, sx = 1, sz = 1) => { const g = new THREE.CapsuleGeometry(r, len, 3, 8); g.scale(sx, 1, sz); g.translate(0, y, 0); return g; };

function buildGeos(): Record<Part, THREE.BufferGeometry> {
  const leg = mergeGeometries([tint(cap(1.75, 6.4, -4.9), 1), tint(new THREE.BoxGeometry(5.4, 2, 3.1).translate(0.9, -10.3, 0), 0.22)])!;
  const head = mergeGeometries([
    tint(new THREE.SphereGeometry(2.3, 12, 10).scale(0.95, 1.18, 0.88).translate(0, 3.0, 0), 1),
    tint(new THREE.CylinderGeometry(1.1, 1.3, 1.6, 8).translate(0, 0.4, 0), 1),
    tint(new THREE.BoxGeometry(0.7, 1, 0.7).translate(2.15, 2.7, 0), 1),
  ])!;
  const hair = tint(new THREE.SphereGeometry(2.42, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(0.98, 1.2, 0.93).rotateZ(0.5).translate(-0.1, 3.0, 0), 1);
  const torso = mergeGeometries([
    tint(cap(3.0, 3.4, 4.7, 0.78, 1.38), 1),
    tint(new THREE.SphereGeometry(1.6, 8, 6).translate(0, 8.2, 5.2), 1),
    tint(new THREE.SphereGeometry(1.6, 8, 6).translate(0, 8.2, -5.2), 1),
  ])!;
  const arm = mergeGeometries([tint(cap(1.2, 5.6, -4.2), 1), tint(new THREE.SphereGeometry(1.2, 8, 6).translate(0, -8.6, 0), 0.92)])!;
  const hips = tint(new THREE.BoxGeometry(4, 2.8, 7.6).translate(0, 10.6, 0), 1);
  return { legL: leg, legR: leg, hips, torso, head, hair, armL: arm, armR: arm };
}

const _m = new THREE.Matrix4(), _base = new THREE.Matrix4(), _torso = new THREE.Matrix4(), _r = new THREE.Matrix4(), _t = new THREE.Matrix4();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const _col = new THREE.Color();
const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(0, 0, 0, "YXZ");

export class CrowdRenderer {
  private meshes = {} as Record<Part, THREE.InstancedMesh>;
  private shadow: THREE.InstancedMesh;
  private looks: number[];

  constructor(scene: THREE.Scene, private max: number, castShadow: boolean, shadowGeo: THREE.BufferGeometry, shadowMat: THREE.Material) {
    const geos = buildGeos();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
    for (const p of PARTS) {
      const m = new THREE.InstancedMesh(geos[p], mat, max);
      m.frustumCulled = false; // instances are spread over the city
      m.castShadow = castShadow;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < max; i++) { m.setMatrixAt(i, _zero); m.setColorAt(i, _col.set(1, 1, 1)); }
      scene.add(m);
      this.meshes[p] = m;
    }
    this.shadow = new THREE.InstancedMesh(shadowGeo, shadowMat, max);
    this.shadow.frustumCulled = false; this.shadow.renderOrder = 1;
    for (let i = 0; i < max; i++) this.shadow.setMatrixAt(i, _zero);
    scene.add(this.shadow);
    this.looks = new Array(max).fill(-1);
  }

  setShadows(on: boolean) { for (const p of PARTS) this.meshes[p].castShadow = on; }

  private setLook(i: number, c: Civilian) {
    const look = c.look, r = mulberry32(look);
    const pick = (a: string[]) => a[Math.floor(r() * a.length)];
    const skin = pick(SKIN), hair = pick(HAIR);
    let shirt = pick(SHIRT), pants = pick(PANTS);
    if (c.shirt) { shirt = c.shirt; pants = c.pants; } // uniforms and gang colours
    const M = this.meshes;
    M.head.setColorAt(i, _col.set(skin)); M.armL.setColorAt(i, _col); M.armR.setColorAt(i, _col);
    M.torso.setColorAt(i, _col.set(shirt));
    M.legL.setColorAt(i, _col.set(pants)); M.legR.setColorAt(i, _col); M.hips.setColorAt(i, _col);
    M.hair.setColorAt(i, _col.set(hair));
    this.looks[i] = look;
  }

  // px, py: the player (people hiding in hide and seek only show up close to you)
  update(list: readonly Civilian[], visible: boolean, px = 0, py = 0) {
    const M = this.meshes;
    let colors = false;
    for (let i = 0; i < this.max; i++) {
      const c = list[i];
      if (!visible || !c || !c.active || (c.tag === "hiding" && Math.hypot(c.x - px, c.y - py) > 45)) {
        for (const p of PARTS) M[p].setMatrixAt(i, _zero);
        this.shadow.setMatrixAt(i, _zero);
        continue;
      }
      if (this.looks[i] !== c.look) { this.setLook(i, c); colors = true; }
      const sp = Math.hypot(c.vx, c.vy);
      const w = c.walk, amp = c.state === "down" ? 0 : Math.min(1.1, sp / 120) * 0.8;
      const bob = Math.abs(Math.sin(w * 2)) * amp * 0.9;
      // base: position, heading, size; knocked down = lying on the back
      let fall = 0, lift = 0;
      if (c.state === "down") { fall = Math.min(1, c.t / 0.35) * (Math.PI / 2); lift = 2.2 * Math.min(1, c.t / 0.35); }
      _e.set(0, -c.a, fall); _q.setFromEuler(_e);
      _base.compose(_p.set(c.x, c.z + lift, c.y), _q, _s.set(c.scale, c.scale, c.scale));
      const cower = c.state === "cower";
      const aim = c.state === "attack" && c.armed; // arms forward like holding a gun
      const hipY = cower ? -3.5 : bob;
      // legs (pivot at the hips)
      const legA = cower ? 1.0 : Math.sin(w) * amp;
      this.part("legL", i, 0, 10 + hipY, -2.0, legA);
      this.part("legR", i, 0, 10 + hipY, 2.0, cower ? 1.0 : -legA);
      _m.makeTranslation(0, hipY, 0).premultiply(_base); M.hips.setMatrixAt(i, _m);
      // torso with head and arms
      const lean = cower ? -0.55 : Math.min(1, sp / 250) * 0.12 * -1 + (c.state === "flee" ? -0.18 : 0);
      _torso.makeRotationZ(lean).premultiply(_t.makeTranslation(0, 11.5 + hipY, 0)).premultiply(_base);
      M.torso.setMatrixAt(i, _torso);
      _m.makeTranslation(0, 9.5, 0).premultiply(_torso); M.head.setMatrixAt(i, _m); M.hair.setMatrixAt(i, _m);
      const armA = -Math.sin(w) * amp * 0.8;
      this.arm("armL", i, -5.2, cower ? 2.7 : aim ? 1.35 : armA); // cowering: hands over the head
      this.arm("armR", i, 5.2, cower ? 2.7 : aim ? 1.5 : -armA);
      // blob shadow stays flat on the ground
      _e.set(0, -c.a, 0); _q.setFromEuler(_e);
      _m.compose(_p.set(c.x, 0, c.y), _q, _s.set(0.32 * c.scale * (c.state === "down" ? 1.6 : 1), 1, 0.42 * c.scale));
      this.shadow.setMatrixAt(i, _m);
    }
    for (const p of PARTS) { M[p].instanceMatrix.needsUpdate = true; if (colors && M[p].instanceColor) M[p].instanceColor!.needsUpdate = true; }
    this.shadow.instanceMatrix.needsUpdate = true;
  }

  private part(p: Part, i: number, x: number, y: number, z: number, rotZ: number) {
    _r.makeRotationZ(rotZ);
    _m.makeTranslation(x, y, z).multiply(_r).premultiply(_base);
    this.meshes[p].setMatrixAt(i, _m);
  }
  private arm(p: Part, i: number, z: number, rotZ: number) {
    _r.makeRotationZ(rotZ);
    _m.makeTranslation(0, 8.2, z).multiply(_r).premultiply(_torso);
    this.meshes[p].setMatrixAt(i, _m);
  }
}
