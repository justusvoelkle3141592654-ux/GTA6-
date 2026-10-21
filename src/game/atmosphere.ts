// sky, sun and moon, day/night light, fog, weather (rain), cascaded shadows
import * as THREE from "three";
import { CSM } from "three/examples/jsm/csm/CSM.js";
import { WATER_Y } from "./world";

export type Weather = "sun" | "clouds" | "rain" | "fog";
export const WEATHER_NAME: Record<Weather, string> = { sun: "Sonnig", clouds: "Bewölkt", rain: "Regen", fog: "Nebel" };
export type QualityLevel = "low" | "medium" | "high" | "ultra";

const sstep = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mixC = (out: THREE.Color, a: string, b: string, t: number) => out.set(a).lerp(new THREE.Color(b), t);

// direction towards the sun for a time of day (rises in the east over the land, sets over the sea in the west)
export function sunDirection(clock: number, out: THREE.Vector3) {
  // sunrise at 6, sunset at 20
  const c = ((clock % 24) + 24) % 24;
  const th = c >= 6 && c <= 20 ? ((c - 6) / 14) * Math.PI : Math.PI + (((c < 6 ? c + 24 : c) - 20) / 10) * Math.PI;
  return out.set(Math.cos(th), Math.sin(th) * 0.9, 0.35).normalize();
}

export interface SkyState {
  day: number;      // 0 night .. 1 full day
  dusk: number;     // 0..1 warm light around sunrise / sunset
  night: number;    // 1 - day
  wet: number;      // 0..1 streets after rain
  rain: number;     // 0..1 rain falling
  fog: number;      // 0..1 morning fog at the coast
  cloud: number;    // 0..1
}

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_FRAG = `
uniform vec3 uSun; uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunCol; uniform float uNight; uniform float uCloud; uniform float uTime;
varying vec3 vDir;
float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); float a = h(vec3(i,0.)), b = h(vec3(i+vec2(1,0),0.)), c = h(vec3(i+vec2(0,1),0.)), d = h(vec3(i+vec2(1,1),0.)); return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
void main(){
  vec3 d = normalize(vDir);
  float e = max(d.y, -0.05);
  vec3 col = mix(uHorizon, uTop, pow(clamp(e * 1.6, 0.0, 1.0), 0.6));
  float s = max(dot(d, uSun), 0.0);
  col += uSunCol * (pow(s, 8.0) * 0.25 + pow(s, 900.0) * 6.0) * (1.0 - uCloud * 0.7);
  // moon on the other side, stars at night
  vec3 m = normalize(vec3(-uSun.x, max(0.25, -uSun.y), -uSun.z));
  col += vec3(0.85, 0.9, 1.0) * pow(max(dot(d, m), 0.0), 2000.0) * 3.0 * uNight;
  if (d.y > 0.0) {
    vec3 q = floor(d * 380.0);
    float st = step(0.9975, h(q)) * uNight * (1.0 - uCloud) * smoothstep(0.0, 0.25, d.y);
    col += vec3(st) * (0.6 + 0.4 * sin(uTime * 3.0 + h(q + 1.0) * 30.0));
    // soft clouds
    vec2 uv = d.xz / max(d.y, 0.08) * 0.8 + vec2(uTime * 0.004, uTime * 0.002);
    float c = smoothstep(0.45 - uCloud * 0.35, 0.95, n2(uv) * 0.6 + n2(uv * 2.7) * 0.4) * smoothstep(0.0, 0.2, d.y);
    vec3 cc = mix(vec3(1.0), uHorizon * 1.1, 0.35) * (0.35 + 0.65 * (1.0 - uNight)) * (1.0 - uCloud * 0.45);
    col = mix(col, cc, c * (0.55 + uCloud * 0.4));
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Atmosphere {
  sky: THREE.Mesh;
  skyMat: THREE.ShaderMaterial;
  sun: THREE.DirectionalLight;   // used when cascades are off
  hemi: THREE.HemisphereLight;
  csm: CSM | null = null;
  state: SkyState = { day: 1, dusk: 0, night: 0, wet: 0, rain: 0, fog: 0, cloud: 0 };
  sunDir = new THREE.Vector3(1, 1, 0.3).normalize();
  sunColor = new THREE.Color();
  horizon = new THREE.Color();
  top = new THREE.Color();
  private rainMesh: THREE.LineSegments;
  private rainPos: Float32Array;
  private seen = new WeakSet<THREE.Material>();
  private tmp = new THREE.Color();
  private t = 0;

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, private quality: QualityLevel) {
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uSun: { value: new THREE.Vector3() }, uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uCloud: { value: 0 }, uTime: { value: 0 } },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), this.skyMat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    scene.add(this.sky);
    this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x80705c, 1.3);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe4bd, 4);
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -700; sc.right = 700; sc.top = 700; sc.bottom = -700; sc.near = 10; sc.far = 4000;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 1.5;
    scene.add(this.sun, this.sun.target);
    // rain: short streaks around the camera
    const N = 1800;
    this.rainPos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) this.seedDrop(i, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.rainMesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab8cc, transparent: true, opacity: 0.45, depthWrite: false }));
    this.rainMesh.frustumCulled = false; this.rainMesh.visible = false;
    scene.add(this.rainMesh);
    this.setQuality(quality);
  }

  private seedDrop(i: number, any: boolean) {
    const c = this.camera.position, R = 420;
    const x = c.x + (Math.random() - 0.5) * R * 2, z = c.z + (Math.random() - 0.5) * R * 2, y = any ? c.y - 150 + Math.random() * 400 : c.y + 250;
    const p = this.rainPos, k = i * 6;
    p[k] = x; p[k + 1] = y; p[k + 2] = z; p[k + 3] = x + 1.5; p[k + 4] = y - 16; p[k + 5] = z + 0.8;
  }

  setQuality(q: QualityLevel) {
    this.quality = q;
    const cascades = q === "ultra" ? 3 : q === "high" ? 3 : q === "medium" ? 2 : 0;
    if (this.csm) { this.csm.remove(); this.csm.dispose(); this.csm = null; this.seen = new WeakSet(); }
    this.sun.castShadow = q === "low";
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.visible = cascades === 0;
    if (cascades) {
      this.csm = new CSM({
        camera: this.camera, parent: this.scene, cascades, maxFar: q === "ultra" ? 4200 : q === "high" ? 3000 : 1800,
        mode: "practical", shadowMapSize: q === "medium" ? 1024 : 2048, lightDirection: this.sunDir.clone().negate(), lightIntensity: 4,
        shadowBias: -0.0004, lightMargin: 600, lightNear: 1, lightFar: 6000,
      });
      for (const l of this.csm.lights) { l.shadow.normalBias = 1.2; l.color.set(0xffe4bd); }
      this.csm.fade = true;
    }
  }
  // materials have to know about the cascades (called for every new lit material)
  setupMaterials(root: THREE.Object3D) {
    const csm = this.csm;
    root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) return;
      for (const mat of Array.isArray(m) ? m : [m]) {
        // a shader hook of the material itself (people: palette colours) runs too; CSM.dispose() deletes hooks
        const own = mat.userData.ownCompile as THREE.Material["onBeforeCompile"] | undefined;
        if (!csm) { if (own && mat.onBeforeCompile !== own) { mat.onBeforeCompile = own; mat.needsUpdate = true; } continue; }
        if (this.seen.has(mat) || !(mat instanceof THREE.MeshStandardMaterial)) continue;
        this.seen.add(mat);
        csm.setupMaterial(mat);
        if (own) { const cs = mat.onBeforeCompile; mat.onBeforeCompile = (sh, r) => { cs.call(mat, sh, r); own.call(mat, sh, r); }; }
        mat.needsUpdate = true;
      }
    });
  }

  // clock: hours; weather from the game; target: what the camera looks at (shadow centre without cascades)
  update(clock: number, weather: Weather, weatherT: number, dt: number, tx: number, ty: number, tz: number, weatherOn: boolean) {
    this.t += dt;
    const s = this.state;
    sunDirection(clock, this.sunDir);
    const elev = this.sunDir.y;
    s.day = sstep(-0.08, 0.18, elev);
    s.night = 1 - s.day;
    s.dusk = sstep(-0.1, 0.05, elev) * (1 - sstep(0.12, 0.35, elev));
    // weather blends in over a few seconds (weatherT: seconds since the change)
    const w = weatherOn ? weather : "sun", k = Math.min(1, weatherT / 6);
    const goal = { rain: w === "rain" ? 1 : 0, cloud: w === "clouds" ? 0.7 : w === "rain" ? 1 : w === "fog" ? 0.4 : 0, fog: w === "fog" ? 1 : 0 };
    s.rain += (goal.rain - s.rain) * Math.min(1, dt * 0.5) * k + 0;
    s.cloud += (goal.cloud - s.cloud) * Math.min(1, dt * 0.4);
    s.fog += (goal.fog * (clock > 4 && clock < 11 ? 1 : 0.35) - s.fog) * Math.min(1, dt * 0.3);
    s.wet = Math.max(s.rain, s.wet - dt * 0.004); // streets dry slowly
    // colours
    const top = this.top, hor = this.horizon, sunC = this.sunColor;
    mixC(top, "#0a1024", "#3f6fbf", s.day);
    mixC(hor, "#151a30", "#c9d8ea", s.day);
    hor.lerp(this.tmp.set("#ff9a5a"), s.dusk * 0.75);
    top.lerp(this.tmp.set("#5a4a7a"), s.dusk * 0.35);
    const grey = this.tmp.set("#8a9099").multiplyScalar(0.4 + s.day * 0.6);
    top.lerp(grey, s.cloud * 0.7); hor.lerp(grey, s.cloud * 0.6);
    hor.lerp(this.tmp.set("#b8bec6").multiplyScalar(0.3 + 0.7 * s.day), s.fog * 0.8);
    mixC(sunC, "#ff8a4a", "#fff1d6", sstep(0.05, 0.4, elev));
    const u = this.skyMat.uniforms;
    u.uSun.value.copy(this.sunDir); u.uTop.value.copy(top); u.uHorizon.value.copy(hor); u.uSunCol.value.copy(sunC);
    u.uNight.value = s.night; u.uCloud.value = s.cloud; u.uTime.value = this.t;
    this.sky.position.copy(this.camera.position);
    // lights: the sun by day, a weak blue moon by night
    const sunI = (s.day * 4.2 + (1 - s.day) * 0.22) * (1 - s.cloud * 0.6);
    const lightCol = this.tmp.copy(sunC).lerp(new THREE.Color("#7f9bd6"), s.night);
    const dir = s.day > 0.02 ? this.sunDir : new THREE.Vector3(-this.sunDir.x, Math.max(0.35, -this.sunDir.y), -this.sunDir.z).normalize();
    if (this.csm) {
      this.csm.lightDirection.copy(dir).negate();
      for (const l of this.csm.lights) { l.intensity = sunI; l.color.copy(lightCol); }
      this.csm.update();
    } else {
      this.sun.intensity = sunI; this.sun.color.copy(lightCol);
      this.sun.position.set(tx + dir.x * 1500, tz + dir.y * 1500, ty + dir.z * 1500);
      this.sun.target.position.set(tx, tz, ty); this.sun.target.updateMatrixWorld();
    }
    this.hemi.intensity = 0.12 + s.day * 1.2 - s.cloud * 0.1 * s.day;
    this.hemi.color.copy(top).lerp(this.tmp.set("#ffffff"), 0.4);
    this.hemi.groundColor.set("#80705c").multiplyScalar(0.3 + s.day * 0.7);
    // fog follows the horizon colour, thicker in fog and rain
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(hor);
    const far = (this.quality === "ultra" ? 6200 : this.quality === "high" ? 5000 : this.quality === "medium" ? 4000 : 3000);
    fog.far = far * (1 - s.fog * 0.75) * (1 - s.rain * 0.35);
    fog.near = 300 * (1 - s.fog * 0.8);
    (this.scene.background as THREE.Color | null)?.copy(hor);
    // rain streaks
    this.rainMesh.visible = s.rain > 0.05;
    if (this.rainMesh.visible) {
      const p = this.rainPos, n = p.length / 6, c = this.camera.position, fall = dt * 900;
      const active = Math.floor(n * s.rain);
      for (let i = 0; i < n; i++) {
        const kk = i * 6;
        if (i >= active) { p[kk + 1] = p[kk + 4] = -9999; continue; }
        p[kk + 1] -= fall; p[kk + 4] -= fall; p[kk] += dt * 40; p[kk + 3] += dt * 40;
        if (p[kk + 4] < Math.max(WATER_Y, c.y - 180) || Math.abs(p[kk] - c.x) > 440 || Math.abs(p[kk + 2] - c.z) > 440) this.seedDrop(i, p[kk + 1] < -9000);
      }
      (this.rainMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.rainMesh.material as THREE.LineBasicMaterial).opacity = 0.45 + 0.3 * s.day;
    }
  }
}
