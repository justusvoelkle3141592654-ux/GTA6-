// the sea: waves, fresnel reflection (planar mirror on high settings), depth colour, foam at the shore
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { MAP_MIN, MAP_SIZE, WATER_Y, terrainH, isWater, type World } from "../world/world";
import type { Atmosphere, QualityLevel } from "./atmosphere";

const VERT = `
uniform mat4 textureMatrix;
varying vec4 vRefl; varying vec3 vWorld;
#include <fog_pars_vertex>
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vRefl = textureMatrix * vec4(position, 1.0);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = `
uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform float uRefl;
uniform float uTime; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uTop; uniform vec3 uHorizon; uniform float uDay; uniform float uRain;
uniform vec2 uMapMin; uniform float uMapSize;
varying vec4 vRefl; varying vec3 vWorld;
#include <fog_pars_fragment>
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
// several overlapping wave trains: returns the slope (dh/dx, dh/dz)
vec2 waves(vec2 p, float t){
  vec2 g = vec2(0.0);
  vec4 dirs[4];
  dirs[0] = vec4(normalize(vec2(1.0, 0.3)), 0.012, 1.1);
  dirs[1] = vec4(normalize(vec2(-0.4, 1.0)), 0.021, 1.5);
  dirs[2] = vec4(normalize(vec2(0.7, -0.8)), 0.037, 2.2);
  dirs[3] = vec4(normalize(vec2(-0.9, -0.2)), 0.061, 3.1);
  for (int i = 0; i < 4; i++) {
    float k = dirs[i].z, ph = dot(dirs[i].xy, p) * k + t * dirs[i].w;
    g += dirs[i].xy * cos(ph) * (0.55 / (1.0 + float(i)));
  }
  g += (vec2(noise(p * 0.08 + t * 0.3), noise(p * 0.08 - t * 0.27)) - 0.5) * 0.35;
  return g * (1.0 + uRain * 0.6);
}
void main(){
  vec2 uv = (vWorld.xz - uMapMin) / uMapSize;
  float depth = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 1.0 : texture2D(tDepth, uv).r;
  vec2 sl = waves(vWorld.xz, uTime);
  vec3 N = normalize(vec3(-sl.x * 0.22, 1.0, -sl.y * 0.22));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uTop, pow(clamp(R.y, 0.0, 1.0), 0.6));
  if (uRefl > 0.5) {
    vec2 ruv = vRefl.xy / vRefl.w + N.xz * 0.035;
    vec3 rc = texture2D(tDiffuse, ruv).rgb;
    sky = mix(sky, rc, 0.85);
  }
  // colour through the water: turquoise where it is shallow, dark blue far out
  vec3 shallow = vec3(0.10, 0.52, 0.52), deep = vec3(0.015, 0.10, 0.20);
  vec3 body = mix(shallow, deep, smoothstep(0.02, 0.45, depth)) * (0.25 + 0.75 * uDay);
  vec3 col = mix(body, sky, fres);
  // sun glitter
  col += uSunCol * pow(max(dot(R, uSun), 0.0), 260.0) * 3.0 * uDay;
  // foam along the shore and quay walls, moving with the waves
  float f = smoothstep(0.055, 0.0, depth) * (0.55 + 0.45 * sin(uTime * 1.7 + depth * 160.0 + noise(vWorld.xz * 0.05) * 6.0));
  f *= smoothstep(0.3, 0.7, noise(vWorld.xz * 0.12 + uTime * 0.2) + 0.25);
  col = mix(col, vec3(0.92, 0.96, 1.0) * (0.35 + 0.65 * uDay), clamp(f, 0.0, 1.0) * 0.85);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// depth of the sea (0 shore .. 1 deep) over the whole map
function depthTexture(): THREE.DataTexture {
  const N = 512, data = new Uint8Array(N * N * 4), cell = MAP_SIZE / N;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = MAP_MIN + (i + 0.5) * cell, y = MAP_MIN + (j + 0.5) * cell;
    const d = isWater(x, y) ? Math.min(1, Math.max(0, (WATER_Y - terrainH(x, y)) / 90)) : 0;
    const k = (j * N + i) * 4;
    data[k] = Math.round(d * 255); data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

export class WaterSurface {
  mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private foam: THREE.InstancedMesh;

  constructor(scene: THREE.Scene, world: World, quality: QualityLevel) {
    const size = 140000;
    const reflect = quality === "high" || quality === "ultra";
    const uniforms = {
      tDiffuse: { value: null as THREE.Texture | null }, textureMatrix: { value: new THREE.Matrix4() }, tDepth: { value: depthTexture() }, uRefl: { value: reflect ? 1 : 0 },
      uTime: { value: 0 }, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uDay: { value: 1 }, uRain: { value: 0 }, uMapMin: { value: new THREE.Vector2(MAP_MIN, MAP_MIN) }, uMapSize: { value: MAP_SIZE },
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    };
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, fog: true });
    const geo = new THREE.PlaneGeometry(size, size);
    if (reflect) {
      const r = new Reflector(geo, { textureWidth: quality === "ultra" ? 1024 : 512, textureHeight: quality === "ultra" ? 1024 : 512, clipBias: 0.003, multisample: 0 });
      uniforms.tDiffuse = (r.material as THREE.ShaderMaterial).uniforms.tDiffuse;
      uniforms.textureMatrix = (r.material as THREE.ShaderMaterial).uniforms.textureMatrix;
      (r.material as THREE.Material).dispose();
      r.material = this.mat;
      this.mesh = r;
    } else this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(MAP_MIN + MAP_SIZE / 2, WATER_Y, MAP_MIN + MAP_SIZE / 2);
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
    // foam rings around the bridge piers
    const piers: [number, number][] = [];
    for (const b of world.roads.bridges) for (const s of b.piers) for (const off of [-42, 42]) piers.push(b.alongX ? [s, b.c + off] : [b.c + off, s]);
    const ring = new THREE.CanvasTexture((() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 10, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.35, "rgba(255,255,255,0.85)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c; })());
    this.foam = new THREE.InstancedMesh(new THREE.PlaneGeometry(34, 34).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ring, transparent: true, depthWrite: false, opacity: 0.8 }), Math.max(1, piers.length));
    const m = new THREE.Matrix4();
    piers.forEach(([x, y], i) => { m.makeTranslation(x, WATER_Y + 0.4, y); this.foam.setMatrixAt(i, m); });
    this.foam.count = piers.length;
    scene.add(this.foam);
  }

  update(t: number, atm: Atmosphere) {
    const u = this.mat.uniforms;
    u.uTime.value = t;
    u.uSun.value.copy(atm.sunDir); u.uSunCol.value.copy(atm.sunColor); u.uTop.value.copy(atm.top); u.uHorizon.value.copy(atm.horizon);
    u.uDay.value = atm.state.day; u.uRain.value = atm.state.rain;
    const s = 1 + Math.sin(t * 1.3) * 0.08;
    this.foam.scale.set(1, 1, 1); (this.foam.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.25 * s * (0.3 + 0.7 * atm.state.day);
  }
}
