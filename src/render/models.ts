// 3D models made in Blender (tools/blender/*.py, exported as GLB and compressed with meshopt): the armoured car,
// the fighter jets, the helicopters, the prison and the gas station. They are inlined into the single game file
// and parsed at start; until a model is ready the game draws its simple built-in shape instead.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export type ModelId = "armor" | "jet" | "jet_police" | "heli" | "heli_police" | "prison_wall" | "prison_tower" | "prison_gate" | "gas_station" | "cash";
const FILES = import.meta.glob("../assets/models/*.glb", { query: "?url", import: "default", eager: true }) as Record<string, string>;

const ready = new Map<ModelId, THREE.Group>();
const waiting: (() => void)[] = [];
let started = false, done = false;

export function loadModels() {
  if (started) return;
  started = true;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let left = Object.keys(FILES).length;
  for (const [path, url] of Object.entries(FILES)) {
    const id = path.split("/").pop()!.replace(".glb", "") as ModelId;
    fetch(url).then((r) => r.arrayBuffer()).then((buf) => loader.parseAsync(buf, "")).then((gltf) => {
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true; m.receiveShadow = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.transparent) mat.depthWrite = false;
      });
      ready.set(id, gltf.scene);
    }).catch((e) => console.warn("Modell", id, "nicht geladen:", e)).finally(() => {
      if (--left === 0) { done = true; for (const f of waiting.splice(0)) f(); }
    });
  }
}
// a copy of a model (meshes and materials are shared), null while it is still loading
export function model(id: ModelId): THREE.Group | null {
  const g = ready.get(id);
  return g ? g.clone(true) : null;
}
export const hasModel = (id: ModelId) => ready.has(id);
// run once all models are parsed (right away when they already are)
export function whenModels(f: () => void) {
  if (done) f(); else waiting.push(f);
}
