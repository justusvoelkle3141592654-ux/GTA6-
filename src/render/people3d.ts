// the player figure and the people near the camera as skinned, animated humans (human.ts);
// people further away stay instanced simple figures (crowd3d.ts, the far detail level)
import * as THREE from "three";
import { Ragdoll, type RagdollWorld } from "../characters/ragdoll";
import { BODY_GEN, HumanRig, PERSON_SCALE, kaiLook, lookFromSeed, weaponGeo, type Look } from "../characters/human";
import { VEH_SCALE } from "../vehicles/vehicles";
import { OUTFITS, type Style } from "../gameplay/economy";
import { WEAPONS, WEAPON_DEFS, type Weapon } from "../gameplay/weapons";
import type { Game } from "../core/engine";
import type { Civilian } from "../ai/peds";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrapA = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const HIPS = 9.5; // hip height of the male rest pose (human.ts); female: 9.5 * 0.94

export function outfitLook(i: number, style?: Style): Look {
  const o = OUTFITS[i] ?? OUTFITS[0];
  return kaiLook({ top: o.top, topCol: o.shirt, top2Col: o.top2, bottom: o.bottom, bottomCol: o.pants, shoes: o.shoes, shoeCol: o.shoeCol, accent: o.accent, hair: o.hair, hatCol: o.hatCol }, style);
}

// walking, running, sprinting blended by speed (see HumanRig.move)
function locomote(r: HumanRig, sp: number, _sprint: boolean, panic = false) { r.move(sp, panic); }

const gunMats = {
  metal: new THREE.MeshStandardMaterial({ color: 0x23252c, metalness: 0.7, roughness: 0.35 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.7 }),
  green: new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 0.6 }),
  launcher: new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.6, metalness: 0.3 }),
  bomb: new THREE.MeshStandardMaterial({ color: 0x3a3a44, emissive: 0xff2040, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.5 }),
  phone: new THREE.MeshStandardMaterial({ color: 0x15161b, roughness: 0.3, metalness: 0.4 }),
};
const WMAT: Record<Weapon, THREE.Material> = { fist: gunMats.metal, knife: gunMats.metal, bat: gunMats.wood, pistol: gunMats.metal, revolver: gunMats.metal, smg: gunMats.metal, rifle: gunMats.metal, shotgun: gunMats.wood, sniper: gunMats.metal, grenade: gunMats.green, rocket: gunMats.launcher, bomb: gunMats.bomb, tnt: new THREE.MeshStandardMaterial({ color: "#c0261c", roughness: 0.7 }) };

// the animation for an action of the player (entering and leaving cars, rolling out)
export type ActKind = "open" | "smash" | "butt" | "jack" | "getin" | "getout" | "roll";
const ACT_CLIP: Record<ActKind, string> = { open: "openDoor", smash: "smash", butt: "buttStrike", jack: "pull", getin: "getIn", getout: "getOut", roll: "roll" };

export class PlayerFigure {
  ragWorld: RagdollWorld | null = null;
  private rag: Ragdoll | null = null;
  rig: HumanRig;
  shadow: THREE.Mesh;
  private guns = {} as Record<Weapon, THREE.Mesh | null>;
  private lookKey = ""; private lastA = 0; private lean = 0; private lastShoot = 0; private lastHit = 0; private actKey = ""; private wasAir = false;
  constructor(private scene: THREE.Scene, shadowGeo: THREE.BufferGeometry, shadowMat: THREE.Material) {
    this.rig = new HumanRig(outfitLook(0), 0);
    const hand = this.rig.bone("handR");
    for (const w of WEAPONS) {
      const g = weaponGeo(w);
      if (!g) { this.guns[w] = null; continue; }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, WMAT[w]); m.castShadow = true; m.visible = false;
      hand.add(m); this.guns[w] = m;
    }
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.scale.set(0.36, 1, 0.5); this.shadow.renderOrder = 1;
    scene.add(this.rig.root, this.shadow);
    this.rig.root.visible = false;
  }

  // car: where the figure sits when driving (host: the car's body group, seat: hip position in it)
  update(g: Game, dt: number, car: { host: THREE.Object3D; seat: [number, number, number]; ride: boolean; steer: number } | null, fp: boolean) {
    const r = this.rig, root = r.root, pd = g.ped;
    const sk = g.outfit + ":" + g.style.hair + g.style.beard + g.style.tattoo + ":" + BODY_GEN;
    if (this.lookKey !== sk) { this.lookKey = sk; r.setLook(outfitLook(g.outfit, g.style), 0); }
    r.setVest(pd.armor > 0);
    const hidden = g.state === "menu" || !!g.hide.hiddenIn;
    if (car && !g.onFoot) {
      // at the wheel: hands on the wheel, the head turns a little into the curve
      if (root.parent !== car.host) car.host.add(root);
      // the car group is already scaled up (VEH_SCALE): inside it the figure keeps its own height
      const sc = (r.look.height * PERSON_SCALE) / VEH_SCALE, h = sc * (r.look.sex === "f" ? HIPS * 0.94 : HIPS);
      root.scale.setScalar(sc);
      root.position.set(car.seat[0], car.seat[1] - h, car.seat[2]); root.rotation.set(0, 0, 0);
      r.play(car.ride ? "ride" : "drive", 0.2); r.playUpper("");
      r.lookYaw += (clamp(-car.steer * 0.45, -0.5, 0.5) - r.lookYaw) * Math.min(1, dt * 4);
      for (const w of WEAPONS) { const m = this.guns[w]; if (m) m.visible = false; }
      root.visible = !hidden;
      this.shadow.visible = false;
      r.update(dt);
      // first person: no head in front of the camera (the hands on the wheel stay)
      r.bone("head").scale.setScalar(fp ? 0.001 : 1);
      return;
    }
    r.bone("head").scale.setScalar(1);
    if (root.parent !== this.scene) this.scene.add(root);
    root.visible = g.onFoot && !hidden;
    this.shadow.visible = root.visible && !pd.swim;
    if (!root.visible) return;
    root.scale.setScalar(r.look.height * PERSON_SCALE);
    root.position.set(pd.x, pd.z, pd.y);
    // lean into curves when running (roll about the forward axis), smoothed
    const turn = Math.atan2(Math.sin(pd.a - this.lastA), Math.cos(pd.a - this.lastA)) / Math.max(dt, 1e-3);
    this.lastA = pd.a;
    const spd = Math.hypot(pd.vx, pd.vy);
    this.lean += (clamp(turn * spd * 0.0009, -0.22, 0.22) - this.lean) * Math.min(1, dt * 6);
    root.rotation.order = "YXZ";
    root.rotation.set(pd.swim ? 0 : this.lean, -pd.a, 0);
    this.shadow.position.set(pd.x, pd.z + 0.3, pd.y); this.shadow.rotation.y = -pd.a;
    r.lookYaw *= 0.9;
    const sp = Math.hypot(pd.vx, pd.vy);
    const wpn = g.weapon, kind = WEAPON_DEFS[wpn].kind;
    const act = g.act;
    let upper = "";
    if (pd.dead && this.ragWorld) {
      // dead: the body falls as a ragdoll (pushed back a little, plus the speed it had)
      if (!this.rag) {
        root.updateMatrixWorld(true);
        const back = new THREE.Vector3(-Math.cos(pd.a), 0, -Math.sin(pd.a)).multiplyScalar(45);
        this.rag = new Ragdoll(r, new THREE.Vector3(pd.vx, Math.max(pd.vz, 25), pd.vy).add(back), 1.5);
        r.ragdoll = true; r.playUpper("");
      }
      this.rag.step(dt, this.ragWorld);
      this.rag.pose();
      for (const w of WEAPONS) { const m = this.guns[w]; if (m) m.visible = false; }
      const pv = this.rag.pelvis(); this.shadow.position.set(pv.x, pd.z + 0.3, pv.z);
      r.update(dt);
      return;
    }
    if (this.rag) { this.rag = null; r.ragdoll = false; r.play("idle", 0, 1, true); }
    if (pd.dead) {
      r.play(r.current === "fallBack" || r.current === "lying" ? (r.done("fallBack") ? "lying" : "fallBack") : "fallBack", 0.15);
    } else if (act && !pd.swim) {
      const key = act.kind + act.id;
      if (key !== this.actKey) { this.actKey = key; r.play(ACT_CLIP[act.kind], 0.12, 1, true); }
    } else if (g.seat) {
      r.play("bench", 0.3);
    } else if (pd.swim) {
      if (sp > 20) r.play("swim", 0.3, clamp(sp / 60, 0.6, 1.6)); else r.play("tread", 0.3);
    } else if (g.travel || (g.flyMode && pd.air)) {
      r.play(g.travel || sp > 120 ? "fly" : "hover", 0.3);
    } else if (pd.air && pd.vz < -150) {
      r.play("fall", 0.25);
    } else if (pd.air && !this.wasAir && pd.vz > 0) {
      r.play("jump", 0.1, 1, true);
    } else if (!pd.air || r.done("jump")) {
      locomote(r, sp, pd.sprint);
    }
    this.wasAir = pd.air;
    if (!act) this.actKey = "";
    // arms: weapons, throwing, punching, reloading, flinching when hit
    if (!pd.dead && !act && !pd.swim) {
      const fresh = pd.shootT > this.lastShoot + 0.05;
      if (kind === "melee" && (pd.shootT > 0 || !r.done(wpn === "bat" ? "bat" : "punch"))) upper = wpn === "bat" ? "bat" : "punch";
      else if ((kind === "throw" || kind === "sticky" || kind === "tnt") && (pd.shootT > 0 || !r.done("throw"))) upper = "throw";
      else if (kind === "gun" && g.inv.reloadT > 0) upper = "reload";
      else if ((kind === "gun" && pd.shootT > 0) || kind === "rocket") upper = wpn === "pistol" || wpn === "revolver" ? "aimPistol" : "aimRifle";
      if (!upper && pd.hitFlash > this.lastHit + 0.05) upper = "hit";
      if (!upper && r.upper === "hit" && !r.done("hit")) upper = "hit";
      r.playUpper(upper, 0.12, 1, fresh && (upper === "punch" || upper === "bat" || upper === "throw"));
    } else r.playUpper("");
    this.lastShoot = pd.shootT; this.lastHit = pd.hitFlash;
    for (const w of WEAPONS) { const m = this.guns[w]; if (m) m.visible = w === wpn && !pd.swim && !pd.dead && !act; }
    r.update(dt);
    // recoil: the gun arm kicks up right after a shot
    if (kind === "gun" && pd.shootT > 0.3) r.bone("upperArmR").rotateZ((pd.shootT - 0.3) * 0.8);
  }
}

// ---------------------------------------------------------------------------------------- people around
interface Slot { rig: HumanRig; ped: number; look: number; acc: number; prev: string; getup: boolean; punchT: number; tumble: number; rag: Ragdoll | null; props: { phone: THREE.Mesh; cig: THREE.Mesh; gun: THREE.Mesh } }
const roleName = (c: Civilian) => (c.role === "cop" ? "cop" : c.role === "swat" ? "swat" : c.role === "army" ? "army" : c.role === "gang" ? "gang" : "civ");
const phoneGeo = weaponGeo("phone")!, gunGeo = weaponGeo("pistol")!, cigGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 5).translate(0.1, -0.7, 0.05);
const cigMat = new THREE.MeshBasicMaterial({ color: 0xf2efe6 });

export class CrowdFigures {
  ragWorld: RagdollWorld | null = null; // the ground and the walls (set by the renderer)
  private slots: (Slot | null)[] = [];
  private byPed = new Map<number, number>();
  readonly drawn = new Set<number>();
  constructor(private scene: THREE.Scene, public max: number, private shadows: boolean, private setup: (o: THREE.Object3D) => void = () => {}) {}
  setMax(n: number) { this.max = n; }

  private make(c: Civilian): Slot {
    const look = lookFromSeed(c.look, roleName(c), c.shirt, c.pants);
    const rig = new HumanRig(look, 1, this.shadows);
    const hand = rig.bone("handR");
    const phone = new THREE.Mesh(phoneGeo, gunMats.phone), cig = new THREE.Mesh(cigGeo, cigMat), gun = new THREE.Mesh(gunGeo, gunMats.metal);
    phone.visible = cig.visible = gun.visible = false;
    hand.add(phone, cig, gun);
    this.scene.add(rig.root);
    this.setup(rig.root);
    return { rig, ped: c.id, look: c.look * 1000 + c.role.length + BODY_GEN * 0.1, acc: 0, prev: "", getup: false, punchT: 0, tumble: 0, rag: null, props: { phone, cig, gun } };
  }

  // camera position (x, y on the map), list of all peds; returns the peds drawn here (the instanced crowd skips them)
  update(list: readonly Civilian[], visible: boolean, camX: number, camY: number, px: number, py: number, dt: number) {
    this.drawn.clear();
    const cand: [number, number][] = [];
    if (visible) for (const c of list) {
      if (!c || !c.active) continue;
      if (c.tag === "hiding" && Math.hypot(c.x - px, c.y - py) > 45) continue;
      const d = Math.hypot(c.x - camX, c.y - camY);
      if (d < 650) cand.push([c.id, d]);
    }
    cand.sort((a, b) => a[1] - b[1]);
    const want = new Set(cand.slice(0, this.max).map((x) => x[0]));
    // free slots of people who are gone or too far
    for (const [pid, si] of this.byPed) if (!want.has(pid)) { const s = this.slots[si]; if (s) s.rig.root.visible = false; this.byPed.delete(pid); if (s) s.ped = -1; }
    const dist = new Map(cand);
    for (const pid of want) {
      const c = list[pid];
      let si = this.byPed.get(pid);
      const lookKey = c.look * 1000 + c.role.length + BODY_GEN * 0.1;
      if (si === undefined) {
        si = this.slots.findIndex((s) => s === null || s.ped < 0);
        if (si < 0) { si = this.slots.length; this.slots.push(null); }
        this.byPed.set(pid, si);
      }
      let s = this.slots[si];
      if (!s || s.look !== lookKey) {
        const look = lookFromSeed(c.look, roleName(c), c.shirt, c.pants);
        if (s && s.rig.setLook(look, 1)) { s.look = lookKey; s.prev = ""; s.getup = false; }
        else { if (s) { this.scene.remove(s.rig.root); s.rig.dispose(); } s = this.make(c); this.slots[si] = s; }
      }
      if (s.ped !== pid && s.rag) { s.rag = null; s.rig.ragdoll = false; s.prev = ""; }
      s.ped = pid;
      this.drawn.add(pid);
      this.animate(s, c, list, dist.get(pid) ?? 0, dt);
    }
  }

  private animate(s: Slot, c: Civilian, list: readonly Civilian[], d: number, dt: number) {
    const r = s.rig, root = r.root;
    root.visible = true;
    const scale = r.look.height * c.scale * PERSON_SCALE;
    root.scale.setScalar(scale);
    root.position.set(c.x, c.z, c.y);
    root.rotation.order = "YXZ";
    root.rotation.set(0, -c.a, 0);
    // knocked down: a real ragdoll (joint physics) from the pose the person had; the person lies where the body ends up
    if (c.state === "down" && this.ragWorld && d < 420) {
      if (!s.rag) {
        root.updateMatrixWorld(true);
        s.rag = new Ragdoll(r, new THREE.Vector3(c.vx, Math.max(c.vz, 20), c.vy), c.spin * 0.6);
        r.ragdoll = true; r.playUpper(""); s.props.phone.visible = s.props.cig.visible = s.props.gun.visible = false;
      }
      s.rag.step(dt, this.ragWorld);
      const pv = s.rag.pelvis(); c.x = pv.x; c.y = pv.z; c.vx = 0; c.vy = 0;
      root.position.set(c.x, c.z, c.y);
      s.rag.pose();
      s.prev = "down";
      r.update(dt);
      return;
    }
    if (s.rag) {
      // getting up: face the way the body lies, keep the lying pose and blend into the getting-up animation
      const back = s.rag.onBack(), hd = s.rag.headDir();
      c.a = back ? hd + Math.PI : hd;
      root.rotation.set(0, -c.a, 0); root.position.set(c.x, c.z, c.y);
      s.rag.pose(); r.freezePose(); r.ragdoll = false; s.rag = null;
      if (c.state !== "down") { s.getup = true; r.play(back ? "getup" : "getupFront", 0.4, 1, true); s.prev = c.state; }
    }
    const sp = Math.hypot(c.vx, c.vy);
    let upper = "", prop = "";
    r.lookYaw *= 0.9; r.eyeYaw *= 0.9;
    // got up again after lying on the ground
    if (s.prev === "down" && c.state !== "down" && !s.getup) { s.getup = true; r.play("getup", 0.1, 1, true); }
    if (s.getup && r.done("getup") && r.done("getupFront")) s.getup = false;
    if (s.getup) { /* keep getting up */ }
    else switch (c.state) {
      case "walk": locomote(r, sp, false); if (c.role === "seeker") upper = "lookAround"; break;
      case "flee": locomote(r, Math.max(sp, 70), false, c.look % 2 === 0); break;
      case "cower": r.play(c.tag === "hiding" ? "crouch" : "cower", 0.2); break;
      case "down":
        if (c.t < 0.45 && sp > 40) r.play("ragdoll", 0.1);
        else r.play(r.current === "fallBack" || r.current === "lying" ? (r.done("fallBack") ? "lying" : "fallBack") : "fallBack", 0.12);
        break;
      case "attack":
        locomote(r, sp, false);
        if (c.armed) { upper = c.role === "swat" || c.role === "army" ? "aimRifle" : "aimPistol"; prop = "gun"; }
        else {
          s.punchT -= dt;
          if (s.punchT <= 0 && sp < 30) { s.punchT = 0.7; r.playUpper("punch", 0.1, 1, true); }
          upper = r.done("punch") ? "" : "punch";
        }
        break;
      default: {
        // standing: phone, smoking, talking to somebody close by, or just waiting
        r.play("idle", 0.3);
        const v = c.look % 5;
        let partner: Civilian | null = null;
        if (v >= 3) for (const o of list) if (o && o.active && o !== c && (o.state === "wait" || o.state === "idle") && Math.abs(o.x - c.x) < 40 && Math.abs(o.y - c.y) < 40) { partner = o; break; }
        if (partner) {
          upper = "talk";
          const rel = wrapA(Math.atan2(partner.y - c.y, partner.x - c.x) - c.a);
          r.lookYaw = clamp(-rel, -1.1, 1.1); r.eyeYaw = clamp(-rel - r.lookYaw, -0.4, 0.4);
        } else if (v === 1) { upper = "phone"; prop = "phone"; }
        else if (v === 2) { upper = "smoke"; prop = "cig"; }
      }
    }
    s.prev = c.state;
    if (upper !== "punch") r.playUpper(upper, 0.2);
    s.props.phone.visible = prop === "phone"; s.props.cig.visible = prop === "cig"; s.props.gun.visible = prop === "gun";
    // far away people are animated at a lower rate
    s.acc += dt;
    const every = d < 250 ? 0 : d < 450 ? 1 / 30 : 1 / 15;
    if (s.acc >= every) { r.update(s.acc); s.acc = 0; }
  }
}
