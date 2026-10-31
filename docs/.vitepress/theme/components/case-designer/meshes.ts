// Imported meshes, keyed by a hash of the file they came from (plus the node inside it), kept in
// memory and in IndexedDB so reopening a project doesn't need a re-import.
// Each mesh is centred on its bounding box, in mm, before any rotation.

export type MeshData = { positions: Float32Array; indices?: Uint32Array };

const mem = new Map<string, MeshData>();
const DB = "opentone-case-designer";
const STORE = "meshes";

let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
  return dbp;
}

export async function hashBytes(buf: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const h = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(h).slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const peekMesh = (key: string) => mem.get(key);

export async function putMesh(key: string, m: MeshData) {
  mem.set(key, m);
  const d = await db();
  if (!d) return;
  await new Promise<void>((res) => {
    const tx = d.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ positions: m.positions, indices: m.indices }, key);
    tx.oncomplete = tx.onerror = tx.onabort = () => res();
  });
}

export async function getMesh(key: string): Promise<MeshData | undefined> {
  const hit = mem.get(key);
  if (hit) return hit;
  const d = await db();
  if (!d) return undefined;
  return new Promise((res) => {
    const rq = d.transaction(STORE).objectStore(STORE).get(key);
    rq.onsuccess = () => {
      const v = rq.result as MeshData | undefined;
      if (v) mem.set(key, v);
      res(v);
    };
    rq.onerror = () => res(undefined);
  });
}

/** Bounds of a position array: [min, max] per axis. */
export function bounds(pos: Float32Array) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const v = pos[i + k];
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
  return { lo, hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], centre: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] };
}

/** Copy of the positions moved so that `c` is the origin. */
export function centred(pos: Float32Array, c: number[]) {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    out[i] = pos[i] - c[0];
    out[i + 1] = pos[i + 1] - c[1];
    out[i + 2] = pos[i + 2] - c[2];
  }
  return out;
}

/** Concatenates indexed or unindexed meshes into one indexed mesh. */
export function mergeMeshes(list: MeshData[]): MeshData {
  let nv = 0, ni = 0;
  for (const m of list) {
    nv += m.positions.length;
    ni += m.indices ? m.indices.length : m.positions.length / 3;
  }
  const positions = new Float32Array(nv), indices = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const m of list) {
    positions.set(m.positions, ov);
    const base = ov / 3;
    if (m.indices) for (let i = 0; i < m.indices.length; i++) indices[oi++] = m.indices[i] + base;
    else for (let i = 0; i < m.positions.length / 3; i++) indices[oi++] = base + i;
    ov += m.positions.length;
  }
  return { positions, indices };
}

/** Triangle soup in world coordinates: rotate about Z by `rot` degrees, then move to `c`. */
export function worldTriangles(m: MeshData, rot: number, c: [number, number, number]) {
  const n = m.indices ? m.indices.length : m.positions.length / 3;
  const out = new Float32Array(n * 3);
  const a = (rot * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  for (let i = 0; i < n; i++) {
    const j = (m.indices ? m.indices[i] : i) * 3;
    const x = m.positions[j], y = m.positions[j + 1], z = m.positions[j + 2];
    out[i * 3] = c[0] + x * ca - y * sa;
    out[i * 3 + 1] = c[1] + x * sa + y * ca;
    out[i * 3 + 2] = c[2] + z;
  }
  return out;
}
