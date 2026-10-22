// street furniture and lamps as instanced meshes: every piece can be moved on its own when a car knocks it over
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Props, PropKind } from "../world/props";
import { withColor, C } from "./meshutil";

type G = THREE.BufferGeometry;
const part = (w: number, h: number, d: number, ox: number, oy: number, oz: number, col: string) => withColor(new THREE.BoxGeometry(w, h, d).translate(ox, oy, oz), C(col));
const merge = (l: G[]) => mergeGeometries(l.map((g) => (g.index ? g.toNonIndexed() : g)))!;

// local frame: +z towards the street, base on the ground
function geoOf(kind: Exclude<PropKind, "lamp">): G {
  switch (kind) {
    case "bench": return merge([part(16, 1, 5, 0, 5, 0, "#8a5a3a"), part(16, 5, 1, 0, 8, -2.6, "#8a5a3a"), part(1, 5, 4, -7, 2.5, 0, "#3a3d45"), part(1, 5, 4, 7, 2.5, 0, "#3a3d45")]);
    case "bin": return merge([withColor(new THREE.CylinderGeometry(2.6, 2.2, 8, 10).translate(0, 4, 0), C("#2f6b3a")), part(1, 10, 1, 0, 5, -3, "#3a3d45")]);
    case "hydrant": return withColor(merge([new THREE.CylinderGeometry(1.5, 1.8, 6, 10).translate(0, 3, 0), new THREE.SphereGeometry(1.5, 10, 6).translate(0, 6, 0), new THREE.CylinderGeometry(0.6, 0.6, 4.4, 6).rotateZ(Math.PI / 2).translate(0, 4, 0)]), C("#c0392b"));
    case "post": return merge([part(5, 7, 4, 0, 10, 0, "#f1c40f"), part(1, 7, 1, 0, 3.5, 0, "#3a3d45"), part(3, 0.6, 0.4, 0, 12, 2.1, "#1b1b1f")]);
  }
}
// lying on the side: lifted by about half its thickness so it rests on the ground
const LIFT: Record<PropKind, number> = { bench: 2.5, bin: 2.6, hydrant: 1.8, post: 2.5, lamp: 1.5 };

export class PropMeshes {
  group = new THREE.Group();
  private meshes = new Map<PropKind, { mesh: THREE.InstancedMesh; ids: number[]; slot: Map<number, number> }>();
  private lampParts: THREE.InstancedMesh[] = [];
  private pool: THREE.InstancedMesh | null = null;
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(0, 0, 0, "YXZ");
  private v = new THREE.Vector3(); private s = new THREE.Vector3(1, 1, 1); private axis = new THREE.Vector3();

  constructor(private props: Props, headMat: THREE.Material, poolMat: THREE.Material) {
    const byKind = new Map<PropKind, number[]>();
    props.list.forEach((p, i) => { let l = byKind.get(p.kind); if (!l) { l = []; byKind.set(p.kind, l); } l.push(i); });
    const furn = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
    for (const [kind, ids] of byKind) {
      const slot = new Map<number, number>(); ids.forEach((id, k) => slot.set(id, k));
      if (kind === "lamp") {
        const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.5, 52, 6).translate(0, 26, 0), new THREE.MeshStandardMaterial({ color: 0x3d3f45, roughness: 0.5, metalness: 0.6 }), ids.length);
        const head = new THREE.InstancedMesh(new THREE.BoxGeometry(7, 2.4, 7).translate(0, 52, 0), headMat, ids.length);
        this.pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2).translate(0, 0.45, 0), poolMat, ids.length);
        this.pool.renderOrder = 1;
        pole.castShadow = true;
        this.lampParts = [pole, head];
        this.group.add(pole, head, this.pool);
        this.meshes.set(kind, { mesh: pole, ids, slot });
      } else {
        const mesh = new THREE.InstancedMesh(geoOf(kind), furn, ids.length);
        mesh.castShadow = true; mesh.receiveShadow = true;
        this.group.add(mesh);
        this.meshes.set(kind, { mesh, ids, slot });
      }
      for (const id of ids) this.place(id);
    }
    for (const o of this.group.children) { const im = o as THREE.InstancedMesh; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
  }

  private place(i: number) {
    const p = this.props.list[i], entry = this.meshes.get(p.kind)!, k = entry.slot.get(i)!;
    const m = this.m;
    if (p.kind === "lamp") {
      // tipped over about its base towards the fall direction
      this.axis.set(Math.sin(p.fa), 0, -Math.cos(p.fa));
      this.q.setFromAxisAngle(this.axis, p.st === 0 ? 0 : p.ta);
      this.v.set(p.x, p.st === 0 ? 0 : Math.sin(p.ta) * LIFT.lamp, p.y);
      m.compose(this.v, this.q, this.s);
      for (const mesh of this.lampParts) mesh.setMatrixAt(k, m);
      // the light on the ground goes out
      if (this.pool) { if (p.st === 0) m.makeTranslation(p.x, 0, p.y); else m.makeScale(0, 0, 0); this.pool.setMatrixAt(k, m); }
      return;
    }
    if (p.st === 0) { this.e.set(0, p.yaw, 0); this.v.set(p.x, 0, p.y); }
    else {
      this.e.set(p.rx, p.yaw + p.ry, p.rz);
      const tilt = Math.max(Math.abs(Math.sin(p.rx)), Math.abs(Math.sin(p.rz)));
      this.v.set(p.px, p.pz + tilt * LIFT[p.kind], p.py);
    }
    this.q.setFromEuler(this.e);
    m.compose(this.v, this.q, this.s);
    entry.mesh.setMatrixAt(k, m);
  }

  // move the pieces that changed since the last frame
  update() {
    const d = this.props.dirty;
    if (!d.size) return;
    const touched = new Set<THREE.InstancedMesh>();
    for (const i of d) {
      this.place(i);
      const kind = this.props.list[i].kind;
      if (kind === "lamp") { for (const mesh of this.lampParts) touched.add(mesh); if (this.pool) touched.add(this.pool); }
      else touched.add(this.meshes.get(kind)!.mesh);
    }
    d.clear();
    for (const mesh of touched) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
  }
}
