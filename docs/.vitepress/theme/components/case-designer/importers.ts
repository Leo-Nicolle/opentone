// Reads 3D files into meshes (mm, original coordinates). STEP goes through occt-import-js in a
// worker; STL, GLB and 3MF through the three.js loaders. A STEP from KiCad (File › Export › STEP,
// with 3D models) comes back as one item per component plus the board.
import { BufferGeometry, Mesh, Object3D } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import occtJsUrl from "occt-import-js/dist/occt-import-js.js?url";
import occtWasmUrl from "occt-import-js/dist/occt-import-js.wasm?url";
import { bounds, hashBytes, mergeMeshes, type MeshData } from "./meshes.ts";
import type { Mat, Role } from "./model.ts";

export type ImportedItem = { name: string; mesh: MeshData };
export type Imported = { file: string; hash: string; items: ImportedItem[]; board: number };

export const ACCEPT = ".step,.stp,.stl,.glb,.gltf,.3mf";

// --- STEP, through occt-import-js -----------------------------------------------------------
type OcctNode = { name: string; meshes: number[]; children: OcctNode[] };
type OcctMesh = { name: string; attributes: { position: { array: ArrayLike<number> } }; index?: { array: ArrayLike<number> } };
type OcctResult = { success: boolean; root: OcctNode; meshes: OcctMesh[] };

let occt: Worker | null = null;
function occtWorker() {
  if (occt) return occt;
  // occt-import-js is a classic script, so it runs in a classic worker made from a blob.
  const js = new URL(occtJsUrl, location.href).href, wasm = new URL(occtWasmUrl, location.href).href;
  const src = `importScripts(${JSON.stringify(js)});
let ready = null;
onmessage = async (e) => {
  try {
    ready = ready || occtimportjs({ locateFile: () => ${JSON.stringify(wasm)} });
    const o = await ready;
    const r = o.ReadFile("step", new Uint8Array(e.data.buffer), { linearUnit: "millimeter", linearDeflectionType: "bounding_box_ratio", linearDeflection: 0.002, angularDeflection: 0.5 });
    postMessage({ id: e.data.id, result: r });
  } catch (err) { postMessage({ id: e.data.id, error: String(err) }); }
};`;
  occt = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
  return occt;
}
let occtSeq = 0;
function readStep(buffer: ArrayBuffer): Promise<OcctResult> {
  const w = occtWorker(), id = ++occtSeq;
  return new Promise((res, rej) => {
    const on = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      w.removeEventListener("message", on);
      if (e.data.error || !e.data.result?.success) rej(new Error(e.data.error || "Couldn't read this STEP file."));
      else res(e.data.result);
    };
    w.addEventListener("message", on);
    w.postMessage({ id, buffer }, [buffer]);
  });
}

const occtMesh = (m: OcctMesh): MeshData => ({
  positions: Float32Array.from(m.attributes.position.array),
  indices: m.index ? Uint32Array.from(m.index.array) : undefined,
});
function nodeMeshes(n: OcctNode, all: OcctMesh[], out: MeshData[] = []) {
  for (const i of n.meshes) out.push(occtMesh(all[i]));
  for (const c of n.children) nodeMeshes(c, all, out);
  return out;
}

async function stepItems(buffer: ArrayBuffer, file: string): Promise<ImportedItem[]> {
  const r = await readStep(buffer);
  let n = r.root;
  // Assemblies often wrap everything in a chain of single-child nodes.
  while (!n.meshes.length && n.children.length === 1) n = n.children[0];
  const items: ImportedItem[] = [];
  if (n.meshes.length) {
    const own = n.meshes.map((i) => occtMesh(r.meshes[i]));
    items.push({ name: r.meshes[n.meshes[0]].name || n.name || file, mesh: mergeMeshes(own) });
  }
  for (const c of n.children) {
    const ms = nodeMeshes(c, r.meshes);
    if (ms.length) items.push({ name: c.name || "Part", mesh: mergeMeshes(ms) });
  }
  return items;
}

// --- STL, GLB, 3MF ------------------------------------------------------------------------
function geomMesh(g: BufferGeometry): MeshData {
  const pos = g.getAttribute("position");
  return { positions: Float32Array.from(pos.array as ArrayLike<number>), indices: g.index ? Uint32Array.from(g.index.array as ArrayLike<number>) : undefined };
}
function sceneItems(root: Object3D, scale: number): ImportedItem[] {
  root.updateMatrixWorld(true);
  const ms: MeshData[] = [];
  root.traverse((o) => {
    if (!(o as Mesh).isMesh) return;
    const g = (o as Mesh).geometry.clone().applyMatrix4(o.matrixWorld);
    if (scale !== 1) g.scale(scale, scale, scale);
    ms.push(geomMesh(g));
  });
  return ms.length ? [{ name: root.name || "Model", mesh: mergeMeshes(ms) }] : [];
}

export async function readModel(file: File): Promise<Imported> {
  const buf = await file.arrayBuffer();
  const hash = await hashBytes(buf);
  const ext = file.name.split(".").pop()!.toLowerCase();
  const base = file.name.replace(/\.[^.]+$/, "");
  let items: ImportedItem[];
  if (ext === "step" || ext === "stp") items = await stepItems(buf, base);
  else if (ext === "stl") items = [{ name: base, mesh: geomMesh(new STLLoader().parse(buf)) }];
  else if (ext === "3mf") items = sceneItems(new ThreeMFLoader().parse(buf), 1);
  else if (ext === "glb" || ext === "gltf") {
    const g = await new GLTFLoader().parseAsync(buf, "");
    // glTF is in metres by convention; a model under 1 unit across is taken as metres.
    const its = sceneItems(g.scene, 1);
    const big = its.length ? Math.max(...bounds(its[0].mesh.positions).size) : 1;
    items = big < 1 ? sceneItems(g.scene, 1000) : its;
  } else throw new Error(`Can't read .${ext} files. Use STEP, STL, GLB or 3MF.`);
  if (!items.length) throw new Error(`${file.name} has no geometry.`);
  if (items.length === 1) items[0].name = base;
  return { file: file.name, hash, items, board: findBoard(items) };
}

/** The bare board of a KiCad export: named like one, else the widest thin item. */
function findBoard(items: ImportedItem[]) {
  if (items.length < 2) return -1;
  const sz = items.map((it) => bounds(it.mesh.positions).size);
  let i = items.findIndex((it, k) => /pcb|board/i.test(it.name) && sz[k][2] < 3);
  if (i < 0) {
    let best = 0;
    sz.forEach((s, k) => {
      if (s[2] < 3 && s[0] * s[1] > best) { best = s[0] * s[1]; i = k; }
    });
  }
  return i;
}

/** First guess at a component's role and material, from its name. */
export function guessRole(name: string): { role: Role; mat: Mat } {
  const n = name.toLowerCase();
  if (/usb/.test(n)) return { role: "usb", mat: "conn" };
  if (/jack|audio|pj-?3|phone/.test(n)) return { role: "jack", mat: "conn" };
  if (/micro.?sd|tf.?card|\bsd\b|sd.?card|sdcard/.test(n)) return { role: "sd", mat: "conn" };
  if (/hold|slide|ss-?12|switch_slide/.test(n)) return { role: "hold", mat: "conn" };
  if (/lipo|batt|cell/.test(n)) return { role: "battery", mat: "batt" };
  if (/screen|lcd|tft|display|oled/.test(n)) return { role: "screen", mat: "screen" };
  if (/tact|sw_push|evqp|ts-?0|button|^sw\d/.test(n)) return { role: "", mat: "tact" };
  return { role: "", mat: "conn" };
}

/** A KiCad reference designator, if the name is one. */
export const refOf = (name: string) => (/^[A-Z]{1,3}\d{1,4}$/.test(name.trim()) ? name.trim() : undefined);

/** Reads `radius` and `innerRadius` from a Click Wheel designer JSON. */
export async function readWheelJson(file: File): Promise<{ R?: number; flexIn?: number }> {
  const j = JSON.parse(await file.text());
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : undefined);
  const src = j.params ?? j;
  const R = num(src.radius) ?? num(src.outR) ?? (num(src.od) != null ? src.od / 2 : undefined);
  const flexIn = num(src.innerRadius) ?? num(src.inR) ?? (num(src.id) != null ? src.id / 2 : undefined);
  return { R, flexIn };
}
