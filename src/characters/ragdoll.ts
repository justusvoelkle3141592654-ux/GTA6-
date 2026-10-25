// a real ragdoll for the people: point masses at the joints (Verlet integration), held together by the bone lengths,
// with joint limits (elbows and knees bend one way only, the head stays on the shoulders), gravity, the ground,
// walls and friction. Every frame the skeleton is posed from the points: the body falls, rolls and lands as it
// really would after a car, a shot or an explosion, and then lies there (or gets up again).
import * as THREE from "three";
import type { HumanRig } from "./human";

// the points and the bone each one sits on
const PTS = ["hips", "spine2", "neck", "head", "upperArmL", "foreArmL", "handL", "upperArmR", "foreArmR", "handR",
  "upLegL", "legL", "footL", "toeL", "upLegR", "legR", "footR", "toeR"] as const;
type PName = (typeof PTS)[number];
const I = Object.fromEntries(PTS.map((n, i) => [n, i])) as Record<PName, number>;
// radius of each point (body units, scaled with the person): keeps the body above the ground
const RAD = [1.0, 1.1, 0.6, 1.0, 0.6, 0.45, 0.35, 0.6, 0.45, 0.35, 0.8, 0.55, 0.4, 0.25, 0.8, 0.55, 0.4, 0.25];
const MASS = [3, 3, 1, 1.4, 1, 0.8, 0.5, 1, 0.8, 0.5, 1.8, 1.2, 0.7, 0.3, 1.8, 1.2, 0.7, 0.3];
// sticks: pairs that keep their distance (bones, and braces that keep the torso and the feet in shape)
const STICKS: [PName, PName, number][] = [
  ["hips", "spine2", 1], ["spine2", "neck", 1], ["neck", "head", 1], ["spine2", "head", 0.6],
  ["spine2", "upperArmL", 1], ["spine2", "upperArmR", 1], ["upperArmL", "upperArmR", 1], ["neck", "upperArmL", 1], ["neck", "upperArmR", 1],
  ["hips", "upLegL", 1], ["hips", "upLegR", 1], ["upLegL", "upLegR", 1],
  ["upperArmL", "upLegL", 1], ["upperArmR", "upLegR", 1], ["upperArmL", "upLegR", 0.8], ["upperArmR", "upLegL", 0.8],
  ["upperArmL", "foreArmL", 1], ["foreArmL", "handL", 1], ["upperArmR", "foreArmR", 1], ["foreArmR", "handR", 1],
  ["upLegL", "legL", 1], ["legL", "footL", 1], ["footL", "toeL", 1], ["legL", "toeL", 1],
  ["upLegR", "legR", 1], ["legR", "footR", 1], ["footR", "toeR", 1], ["legR", "toeR", 1],
];
// limbs that may not fold shut: [root, middle, end, least share of the straight length]
const FOLD: [PName, PName, PName, number][] = [["upperArmL", "foreArmL", "handL", 0.3], ["upperArmR", "foreArmR", "handR", 0.3], ["upLegL", "legL", "footL", 0.45], ["upLegR", "legR", "footR", 0.45]];
// knees and elbows bend one way: the middle joint stays on its side of the line root-end (knees forward, elbows back)
const HINGE: [PName, PName, PName, number][] = [["upLegL", "legL", "footL", 1], ["upLegR", "legR", "footR", 1], ["upperArmL", "foreArmL", "handL", -1], ["upperArmR", "foreArmR", "handR", -1]];

export interface RagdollWorld {
  ground(x: number, y: number, z: number): number; // height of the ground under (x, y) for something at height z (game axes: y on the map)
  solid(x: number, y: number, z: number): boolean;  // a wall
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q2 = new THREE.Vector3();
const GRAV = 420;

export class Ragdoll {
  p: THREE.Vector3[] = []; private o: THREE.Vector3[] = []; // position now and in the step before (three.js world axes: y up)
  private len: number[] = [];
  private fold: number[] = [];
  private still = 0;
  settled = false;
  t = 0;
  private acc = 0;
  private restDir = new Map<string, THREE.Vector3>(); // bone direction to its child in the rest pose
  private scale = 1;

  // from the pose the figure has right now; v: velocity of the body (world, units per second), spin: tumbling (radians per second)
  constructor(private rig: HumanRig, v: THREE.Vector3, spin: number) {
    const root = rig.root;
    root.updateMatrixWorld(true);
    this.scale = root.scale.x;
    for (const n of PTS) {
      const b = rig.bone(n);
      const w = b.getWorldPosition(new THREE.Vector3());
      this.p.push(w); this.o.push(w.clone());
    }
    // tumble: the head goes one way, the feet the other (about an axis across the flight)
    const axis = _v.set(-v.z, 0, v.x); if (axis.lengthSq() < 1) axis.set(1, 0, 0); axis.normalize();
    const pelvis = this.p[0];
    for (let i = 0; i < PTS.length; i++) {
      const r = _w.subVectors(this.p[i], pelvis);
      const tang = new THREE.Vector3().crossVectors(axis, r).multiplyScalar(spin);
      const vel = v.clone().add(tang).multiplyScalar(1 / 120);
      this.o[i].sub(vel); // Verlet: the previous position holds the velocity
    }
    for (const [a, b] of STICKS) this.len.push(this.p[I[a]].distanceTo(this.p[I[b]]));
    for (const [a, b, c, k] of FOLD) this.fold.push((this.p[I[a]].distanceTo(this.p[I[b]]) + this.p[I[b]].distanceTo(this.p[I[c]])) * k);
    // rest directions of the bones that get aimed (in the figure's own frame)
    const rest = (n: string) => rig.restPos(n);
    for (const [b, c] of [["hips", "spine2"], ["spine2", "neck"], ["neck", "head"], ["upperArmL", "foreArmL"], ["foreArmL", "handL"], ["upperArmR", "foreArmR"], ["foreArmR", "handR"],
      ["upLegL", "legL"], ["legL", "footL"], ["footL", "toeL"], ["upLegR", "legR"], ["legR", "footR"], ["footR", "toeR"]]) {
      this.restDir.set(b, rest(c).sub(rest(b)).normalize());
    }
  }

  // a push on one point (a shot, another car); world velocity change
  hit(point: number, dv: THREE.Vector3) { this.o[point].addScaledVector(dv, -1 / 120); this.settled = false; this.still = 0; }

  step(dt: number, world: RagdollWorld) {
    this.t += dt;
    if (this.settled) return;
    this.acc += Math.min(dt, 0.1);
    const h = 1 / 120;
    while (this.acc >= h) { this.sub(h, world); this.acc -= h; }
  }

  private sub(h: number, world: RagdollWorld) {
    const P = this.p, O = this.o, s = this.scale;
    let fastest = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i], o = O[i];
      const vx = p.x - o.x, vy = p.y - o.y, vz = p.z - o.z;
      o.copy(p);
      const damp = 0.998;
      p.x += vx * damp; p.y += vy * damp - GRAV * h * h; p.z += vz * damp;
      fastest = Math.max(fastest, (vx * vx + vy * vy + vz * vz) / (h * h));
    }
    for (let it = 0; it < 6; it++) {
      // bone lengths (stiffer for the torso braces)
      STICKS.forEach(([a, b, k], j) => {
        const pa = P[I[a]], pb = P[I[b]], ma = 1 / MASS[I[a]], mb = 1 / MASS[I[b]];
        _v.subVectors(pb, pa); const d = _v.length() || 1e-6, diff = ((d - this.len[j]) / d) * k;
        const wa = ma / (ma + mb), wb = mb / (ma + mb);
        pa.addScaledVector(_v, diff * wa); pb.addScaledVector(_v, -diff * wb);
      });
      // elbows and knees: no folding shut, no bending the wrong way
      FOLD.forEach(([a, , c], j) => {
        const pa = P[I[a]], pc = P[I[c]];
        _v.subVectors(pc, pa); const d = _v.length() || 1e-6;
        if (d < this.fold[j]) { const diff = (d - this.fold[j]) / d * 0.5; pa.addScaledVector(_v, diff); pc.addScaledVector(_v, -diff); }
      });
      const fwd = this.forward(_w);
      for (const [a, b, c, sgn] of HINGE) {
        const pa = P[I[a]], pb = P[I[b]], pc = P[I[c]];
        // where the middle joint is, seen from the line root-end, along the body's forward direction
        _v.subVectors(pc, pa); const L2 = _v.lengthSq() || 1e-6;
        const t = Math.max(0, Math.min(1, _v.dot(_q2.subVectors(pb, pa)) / L2));
        const foot = pa.clone().addScaledVector(_v, t), off = pb.clone().sub(foot);
        const side = off.dot(fwd) * sgn;
        if (side < 0) pb.addScaledVector(fwd, -side * sgn * 0.5);
      }
      // the ground and the walls
      for (let i = 0; i < P.length; i++) {
        const p = P[i], r = RAD[i] * s;
        const g = world.ground(p.x, p.z, p.y);
        if (p.y < g + r) {
          p.y = g + r;
          // friction: sliding on the ground slows down
          const o = O[i]; o.x += (p.x - o.x) * 0.12; o.z += (p.z - o.z) * 0.12;
        }
        if (world.solid(p.x, p.z, p.y)) { p.x = O[i].x; p.z = O[i].z; }
      }
    }
    // lying still for half a second: settled (no more work)
    if (fastest < 9 * 9) { this.still += h; if (this.still > 0.5 && this.t > 0.6) this.settled = true; } else this.still = 0;
  }

  // the body's forward direction (chest side), from the hips and the shoulders
  forward(out: THREE.Vector3) {
    const P = this.p;
    const right = new THREE.Vector3().subVectors(P[I.upLegR], P[I.upLegL]).add(_q2.subVectors(P[I.upperArmR], P[I.upperArmL])).normalize();
    const up = new THREE.Vector3().subVectors(P[I.neck], P[I.hips]).normalize();
    return out.crossVectors(up, right).normalize();
  }
  // lying on the back (chest up)?
  onBack() { return this.forward(new THREE.Vector3()).y > 0; }
  // pelvis position and the direction from the pelvis to the head on the ground (for getting up)
  pelvis() { return this.p[0]; }
  headDir() { const d = new THREE.Vector3().subVectors(this.p[I.head], this.p[0]); return Math.atan2(d.z, d.x); }

  // turn the bones so the skeleton follows the points (the animation mixer must not run meanwhile)
  pose() {
    const rig = this.rig, P = this.p;
    const root = rig.root;
    root.updateMatrixWorld(true);
    const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    // a frame from the points: x forward, y up, z right (the figure's own axes)
    const frame = (lo: THREE.Vector3, hi: THREE.Vector3, l: THREE.Vector3, r: THREE.Vector3) => {
      const Z = new THREE.Vector3().subVectors(r, l).normalize();
      const Y = new THREE.Vector3().subVectors(hi, lo); Y.addScaledVector(Z, -Y.dot(Z)).normalize();
      const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
      return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    };
    const qP = frame(P[I.hips], P[I.spine2], P[I.upLegL], P[I.upLegR]);
    const qC = frame(P[I.spine2], P[I.neck], P[I.upperArmL], P[I.upperArmR]);
    const world = new Map<string, THREE.Quaternion>();
    const setW = (name: string, wq: THREE.Quaternion) => {
      const b = rig.bone(name), par = b.parent!;
      const pq = world.get(par.name) ?? par.getWorldQuaternion(new THREE.Quaternion());
      b.quaternion.copy(pq.clone().invert().multiply(wq));
      world.set(name, wq);
    };
    // hips: position and turn
    const hips = rig.bone("hips");
    const hp = P[I.hips].clone().applyMatrix4(rootInv); // in the figure's own space (scale included)
    const par = hips.parent!; // the skeleton's root bone (no own transform)
    hips.position.copy(hp).sub(par.position);
    setW("hips", qP);
    setW("spine", qP.clone().slerp(qC, 0.33));
    setW("spine1", qP.clone().slerp(qC, 0.66));
    setW("spine2", qC);
    setW("shoulderL", qC); setW("shoulderR", qC);
    // a bone aimed at a point: the parent's turn, then the shortest turn from the rest direction onto the target
    const aim = (name: string, parent: string, from: THREE.Vector3, to: THREE.Vector3) => {
      const pq = world.get(parent)!;
      const d0 = this.restDir.get(name)!.clone().applyQuaternion(pq);
      const d1 = new THREE.Vector3().subVectors(to, from).normalize();
      setW(name, new THREE.Quaternion().setFromUnitVectors(d0, d1).multiply(pq));
    };
    aim("neck", "spine2", P[I.neck], P[I.head]);
    setW("head", world.get("neck")!.clone());
    for (const S of ["L", "R"] as const) {
      aim("upperArm" + S, "shoulder" + S, P[I[("upperArm" + S) as PName]], P[I[("foreArm" + S) as PName]]);
      aim("foreArm" + S, "upperArm" + S, P[I[("foreArm" + S) as PName]], P[I[("hand" + S) as PName]]);
      setW("hand" + S, world.get("foreArm" + S)!.clone());
      aim("upLeg" + S, "hips", P[I[("upLeg" + S) as PName]], P[I[("leg" + S) as PName]]);
      aim("leg" + S, "upLeg" + S, P[I[("leg" + S) as PName]], P[I[("foot" + S) as PName]]);
      aim("foot" + S, "leg" + S, P[I[("foot" + S) as PName]], P[I[("toe" + S) as PName]]);
    }
  }
}
